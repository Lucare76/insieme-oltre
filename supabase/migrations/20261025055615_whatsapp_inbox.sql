begin;
create table public.wa_operators (
  user_id uuid primary key references public.association_members(user_id) on delete cascade,
  enabled boolean not null default false,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
create table public.wa_conversations (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null unique check (wa_id ~ '^[0-9]{6,20}$'),
  contact_name text not null default '',
  last_inbound_at timestamptz,
  last_message_at timestamptz not null default now(),
  last_preview text not null default '',
  unread_count integer not null default 0 check (unread_count >= 0),
  status text not null default 'open' check (status in ('open','assigned','closed')),
  assigned_to uuid references auth.users(id),
  version integer not null default 1,
  read_at timestamptz
);
create table public.wa_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.wa_conversations(id) on delete cascade,
  meta_id text unique,
  direction text not null check (direction in ('in','out')),
  type text not null default 'text',
  body text not null check (length(body) <= 4096),
  media_id text,
  mime text,
  filename text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users(id),
  state text not null default 'received' check (state in ('received','sending','accepted','sent','delivered','read','failed','unknown')),
  error_code text
);
create index wa_conversations_recent on public.wa_conversations(last_message_at desc, id);
create index wa_messages_conversation on public.wa_messages(conversation_id, created_at desc, id);
create index wa_messages_month on public.wa_messages(created_at) where direction = 'out';
alter table public.wa_operators enable row level security;
alter table public.wa_conversations enable row level security;
alter table public.wa_messages enable row level security;
revoke all on public.wa_operators, public.wa_conversations, public.wa_messages from public, anon, authenticated;
grant all on public.wa_operators, public.wa_conversations, public.wa_messages to service_role;

create function public.wa_set_operator(p_user uuid, p_enabled boolean, p_actor uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
begin
  perform pg_advisory_xact_lock(82510);
  if p_enabled and not exists(select 1 from association_members where user_id=p_user and active and activated_at is not null) then
    return jsonb_build_object('error','Utente non attivo.');
  end if;
  if p_enabled and not exists(select 1 from wa_operators where user_id=p_user and enabled)
    and (select count(*) from wa_operators where enabled) >= 2 then
    return jsonb_build_object('error','Sono già abilitati due operatori, oltre all’amministratore.');
  end if;
  insert into wa_operators(user_id, enabled, updated_by) values(p_user,p_enabled,p_actor)
    on conflict(user_id) do update set enabled=excluded.enabled, updated_by=p_actor, updated_at=now();
  return jsonb_build_object('ok',true);
end $$;

create function public.wa_receive(p_event jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare c wa_conversations; inserted uuid; message_at timestamptz;
begin
  message_at := (p_event->>'sent_at')::timestamptz;
  insert into wa_conversations(wa_id) values(p_event->>'wa_id') on conflict(wa_id) do nothing;
  select * into c from wa_conversations where wa_id=p_event->>'wa_id' for update;
  insert into wa_messages(conversation_id,meta_id,direction,type,body,media_id,mime,filename,sent_at)
    values(c.id,p_event->>'meta_id','in',p_event->>'type',p_event->>'text',p_event->>'media_id',
      p_event->>'mime',p_event->>'filename',message_at)
    on conflict(meta_id) do nothing returning id into inserted;
  if inserted is null then return; end if;
  update wa_conversations set
    contact_name=case when coalesce(p_event->>'name','')<>'' then p_event->>'name' else contact_name end,
    last_inbound_at=greatest(last_inbound_at,message_at),
    last_message_at=greatest(last_message_at,message_at),
    last_preview=case when message_at >= last_message_at or last_preview='' then left(p_event->>'text',180) else last_preview end,
    unread_count=unread_count+1,
    status=case when status='closed' then 'open' else status end,
    assigned_to=case when status='closed' then null else assigned_to end,
    version=version+1 where id=c.id;
end $$;

create function public.wa_manage(p_id uuid, p_version integer, p_status text, p_actor uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare c wa_conversations;
begin
  select * into c from wa_conversations where id=p_id for update;
  if not found or c.version<>p_version then return jsonb_build_object('error','Conversazione aggiornata da un’altra persona. Ricarica.'); end if;
  if p_status not in ('open','assigned','closed','read') then return jsonb_build_object('error','Stato non valido.'); end if;
  if p_status='assigned' and c.assigned_to is not null and c.assigned_to<>p_actor then
    return jsonb_build_object('error','La conversazione è già in gestione a un’altra persona.');
  end if;
  update wa_conversations set
    status=case when p_status='read' then status else p_status end,
    assigned_to=case when p_status='assigned' then p_actor when p_status in ('open','closed') then null else assigned_to end,
    unread_count=case when p_status='read' then 0 else unread_count end,
    read_at=case when p_status='read' then now() else read_at end,
    version=version+1 where id=p_id;
  return jsonb_build_object('ok',true);
end $$;

create function public.wa_reserve(p_id uuid, p_conversation uuid, p_actor uuid, p_owner boolean, p_body text, p_limit integer)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare c wa_conversations; existing wa_messages; used integer;
begin
  -- One transaction serializes quota reservations and same-conversation replies.
  perform pg_advisory_xact_lock(82511);
  if not p_owner and not exists(
    select 1 from wa_operators o join association_members m on m.user_id=o.user_id
    where o.user_id=p_actor and o.enabled and m.active and m.activated_at is not null
  ) then return jsonb_build_object('error','Permesso WhatsApp revocato.'); end if;
  select * into existing from wa_messages where id=p_id;
  if found then return jsonb_build_object('error','Richiesta già registrata. Verifica lo stato prima di inviare ancora.'); end if;
  select * into c from wa_conversations where id=p_conversation for update;
  if not found or c.last_inbound_at is null or c.last_inbound_at<=now()-interval '24 hours' or c.last_inbound_at>now() then
    return jsonb_build_object('error','Finestra di risposta chiusa. Attendi un nuovo messaggio.');
  end if;
  if c.assigned_to is distinct from p_actor or c.status<>'assigned' then
    return jsonb_build_object('error','Prendi in gestione la conversazione prima di rispondere.');
  end if;
  if exists(select 1 from wa_messages where conversation_id=c.id and direction='out' and state in ('sending','unknown')) then
    return jsonb_build_object('error','C’è un invio con esito da verificare. Nessun nuovo invio eseguito.');
  end if;
  if p_body is null or length(trim(p_body)) not between 1 and 4096 then
    return jsonb_build_object('error','Messaggio non valido.');
  end if;
  select count(*) into used from wa_messages where direction='out' and state<>'failed'
    and created_at >= date_trunc('month', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome';
  if used>=least(greatest(p_limit,1),1000) then return jsonb_build_object('error','Limite mensile interno raggiunto. Invio bloccato.'); end if;
  insert into wa_messages(id,conversation_id,direction,body,actor_id,state)
    values(p_id,c.id,'out',p_body,p_actor,'sending');
  return jsonb_build_object('ok',true,'wa_id',c.wa_id);
end $$;

create function public.wa_delivery(p_meta text, p_request uuid, p_state text, p_error text default null)
returns void language plpgsql security invoker set search_path = public as $$
declare m wa_messages; new_rank integer; old_rank integer;
begin
  if p_state not in ('accepted','sent','delivered','read','failed','unknown') then return; end if;
  select * into m from wa_messages where direction='out' and
    (meta_id=p_meta or (p_request is not null and id=p_request)) for update;
  if not found then return; end if;
  if m.meta_id is not null and p_meta is not null and m.meta_id<>p_meta then return; end if;
  old_rank := case m.state when 'accepted' then 1 when 'sent' then 2 when 'delivered' then 3 when 'read' then 4 else 0 end;
  new_rank := case p_state when 'accepted' then 1 when 'sent' then 2 when 'delivered' then 3 when 'read' then 4 else 0 end;
  update wa_messages set meta_id=coalesce(meta_id,p_meta),
    state=case when p_state='failed' and old_rank<3 then 'failed' when new_rank>old_rank then p_state when old_rank=0 then p_state else state end,
    error_code=case when (p_state='failed' and old_rank<3) or old_rank=0 or new_rank>old_rank then p_error else error_code end where id=m.id;
  if new_rank>0 then
    update wa_conversations set last_message_at=greatest(last_message_at,m.created_at),
      last_preview=case when last_message_at<=m.created_at then left(m.body,180) else last_preview end
      where id=m.conversation_id;
  end if;
end $$;
create function public.wa_usage()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'reserved', count(*) filter(where state<>'failed'),
    'delivered', count(*) filter(where state in ('delivered','read')),
    'uncertain', count(*) filter(where state in ('sending','unknown'))
  ) from wa_messages where direction='out'
    and created_at >= date_trunc('month', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome';
$$;
revoke all on function public.wa_usage() from public, anon, authenticated;
grant execute on function public.wa_usage() to service_role;
revoke all on function public.wa_set_operator(uuid,boolean,uuid), public.wa_receive(jsonb),
  public.wa_manage(uuid,integer,text,uuid), public.wa_reserve(uuid,uuid,uuid,boolean,text,integer),
  public.wa_delivery(text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.wa_set_operator(uuid,boolean,uuid), public.wa_receive(jsonb),
  public.wa_manage(uuid,integer,text,uuid), public.wa_reserve(uuid,uuid,uuid,boolean,text,integer),
  public.wa_delivery(text,uuid,text,text) to service_role;
commit;
