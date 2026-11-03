-- Ruoli cumulativi: ruolo economico (accountant/member/none) + abilitazione ai questionari.
-- Nessun utente ottiene permessi senza approvazione: i default restano senza privilegi aggiuntivi.
alter table public.association_members drop constraint association_members_role_check;
alter table public.association_members add constraint association_members_role_check check(role in ('accountant','member','none'));
alter table public.association_members add column psychologist boolean not null default false;
alter table public.association_members add constraint association_members_some_permission check(role<>'none' or psychologist);

drop function public.association_review_access(uuid,uuid,text,uuid,text);
create function public.association_review_access(p_id uuid,p_actor uuid,p_action text,p_user uuid default null,p_role text default null,p_psychologist boolean default false) returns public.association_access_requests language plpgsql security invoker set search_path='' as $$
declare req public.association_access_requests;
begin
 select * into req from public.association_access_requests where id=p_id for update;
 if not found then raise exception 'request not found'; end if;
 if p_action='claim' then
  if req.status<>'pending' and not(req.status='processing' and req.reviewed_at<now()-interval '5 minutes') then raise exception 'request already reviewed' using errcode='40001'; end if;
  update public.association_access_requests set status='processing',reviewed_by=p_actor,reviewed_at=now() where id=p_id returning * into req;
 elsif p_action='release' then
  if req.status='processing' and req.reviewed_by=p_actor then update public.association_access_requests set status='pending' where id=p_id returning * into req; end if;
 elsif p_action='reject' then
  if req.status<>'pending' then raise exception 'request already reviewed' using errcode='40001'; end if;
  update public.association_access_requests set status='rejected',reviewed_by=p_actor,reviewed_at=now() where id=p_id returning * into req;
 elsif p_action='approve' then
  if req.status<>'processing' or req.reviewed_by<>p_actor or p_user is null or p_role is null or p_role not in ('accountant','member','none')
   or (p_role='none' and not coalesce(p_psychologist,false)) then raise exception 'invalid approval'; end if;
  insert into public.association_members(user_id,name,email,username,role,psychologist,active,activated_at) values(p_user,req.name,req.email,req.username,p_role,coalesce(p_psychologist,false),true,null);
  update public.association_access_requests set status='approved',user_id=p_user,reviewed_at=now() where id=p_id returning * into req;
 else raise exception 'invalid action';
 end if;
 if p_action in ('approve','reject') then insert into public.association_audit(entity,entity_id,actor_id,action,after_data) values('association_access_requests',p_id,p_actor,p_action,to_jsonb(req)); end if;
 return req;
end $$;
create or replace function public.association_save_member(p_actor uuid,p_member jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare previous jsonb; result jsonb;
begin
 select to_jsonb(m) into previous from public.association_members m where user_id=(p_member->>'user_id')::uuid for update;
 if previous is null then raise exception 'approve a request first'; end if;
 update public.association_members set name=p_member->>'name',username=p_member->>'username',role=p_member->>'role',
  -- Senza il campo (pannello della versione precedente) il ruolo Psicologa resta invariato.
  psychologist=coalesce((p_member->>'psychologist')::boolean,psychologist),active=(p_member->>'active')::boolean
 where user_id=(p_member->>'user_id')::uuid;
 select to_jsonb(m) into result from public.association_members m where user_id=(p_member->>'user_id')::uuid;
 insert into public.association_audit(entity,entity_id,actor_id,action,before_data,after_data) values('association_members',(p_member->>'user_id')::uuid,p_actor,'permissions',previous,result);
end $$;
revoke all on function public.association_review_access(uuid,uuid,text,uuid,text,boolean),public.association_save_member(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.association_review_access(uuid,uuid,text,uuid,text,boolean),public.association_save_member(uuid,jsonb) to service_role;

-- Questionari: accesso esclusivamente dalle API server. Le risposte non sono mai leggibili con la chiave pubblica.
create table public.qs_questionnaires (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 title text not null check(length(trim(title)) between 1 and 200), description text not null default '',
 meeting_ref text not null default '' check(length(meeting_ref)<=200),
 status text not null default 'draft' check(status in ('draft','published','closed','archived')),
 retention_months integer check(retention_months is null or retention_months between 1 and 120),
 version integer not null default 1, source_id uuid references public.qs_questionnaires(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz
);
create index qs_questionnaires_owner_idx on public.qs_questionnaires(owner_id,updated_at desc);
create table public.qs_questions (
 id uuid primary key default gen_random_uuid(), questionnaire_id uuid not null references public.qs_questionnaires(id) on delete cascade,
 position integer not null check(position>=0), kind text not null check(kind in ('single','multiple','text')),
 prompt text not null check(length(trim(prompt))>=1), help text not null default '', required boolean not null default true,
 unique(questionnaire_id,position)
);
create table public.qs_options (
 id uuid primary key default gen_random_uuid(), question_id uuid not null references public.qs_questions(id) on delete cascade,
 position integer not null check(position>=0), label text not null check(length(trim(label))>=1), unique(question_id,position)
);
create table public.qs_sessions (
 id uuid primary key default gen_random_uuid(), questionnaire_id uuid not null references public.qs_questionnaires(id) on delete cascade,
 -- 122 bit casuali: il link non è prevedibile né enumerabile.
 token text not null unique default replace(gen_random_uuid()::text,'-','') check(token ~ '^[0-9a-f]{32}$'),
 label text not null check(length(trim(label)) between 1 and 200), meeting_date date,
 status text not null default 'open' check(status in ('open','closed')), submission_count integer not null default 0,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), closed_at timestamptz
);
create index qs_sessions_questionnaire_idx on public.qs_sessions(questionnaire_id,created_at desc);
-- Nessun dato identificativo: niente IP, user agent o account. Orario arrotondato al minuto.
create table public.qs_submissions (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.qs_sessions(id) on delete cascade,
 seq integer not null check(seq>0), client_key uuid not null,
 submitted_at timestamptz not null default date_trunc('minute',now()),
 unique(session_id,seq), unique(session_id,client_key)
);
-- question_id senza cascade: una domanda con risposte non può essere eliminata (blocco strutturale).
create table public.qs_answers (
 submission_id uuid not null references public.qs_submissions(id) on delete cascade,
 question_id uuid not null references public.qs_questions(id),
 option_ids uuid[], text_value text,
 primary key(submission_id,question_id), check((option_ids is null)<>(text_value is null))
);
create index qs_answers_question_idx on public.qs_answers(question_id);
alter table public.qs_questionnaires enable row level security;
alter table public.qs_questions enable row level security;
alter table public.qs_options enable row level security;
alter table public.qs_sessions enable row level security;
alter table public.qs_submissions enable row level security;
alter table public.qs_answers enable row level security;
revoke all on public.qs_questionnaires,public.qs_questions,public.qs_options,public.qs_sessions,public.qs_submissions,public.qs_answers from public,anon,authenticated;
grant select,insert,update,delete on public.qs_questionnaires,public.qs_questions,public.qs_options,public.qs_sessions,public.qs_submissions,public.qs_answers to service_role;

create function public.qs_audit(p_entity uuid,p_actor uuid,p_action text,p_data jsonb default null) returns void language sql security invoker set search_path='' as $$
 insert into public.association_audit(entity,entity_id,actor_id,action,after_data) values('qs_questionnaires',p_entity,p_actor,p_action,p_data);
$$;

-- Salvataggio atomico: metadati sempre modificabili, domande soltanto in bozza e senza compilazioni.
create function public.qs_save(p_actor uuid,p_id uuid,p_version integer,p_data jsonb) returns public.qs_questionnaires language plpgsql security invoker set search_path='' as $$
declare result public.qs_questionnaires; q jsonb; o jsonb; qid uuid; qpos integer:=0; opos integer;
begin
 if p_id is null then
  insert into public.qs_questionnaires(owner_id,title,description,meeting_ref,retention_months)
  values(p_actor,p_data->>'title',coalesce(p_data->>'description',''),coalesce(p_data->>'meeting_ref',''),(p_data->>'retention_months')::integer) returning * into result;
 else
  select * into result from public.qs_questionnaires where id=p_id for update;
  if not found then raise exception 'Questionario non trovato.' using errcode='QS404'; end if;
  if result.version<>p_version then raise exception 'Il questionario è stato modificato in un''altra finestra. Ricarica.' using errcode='QS409'; end if;
  update public.qs_questionnaires set title=p_data->>'title',description=coalesce(p_data->>'description',''),meeting_ref=coalesce(p_data->>'meeting_ref',''),
   retention_months=(p_data->>'retention_months')::integer,version=version+1,updated_at=now() where id=p_id returning * into result;
 end if;
 if p_data ? 'questions' then
  if result.status<>'draft' or exists(select 1 from public.qs_submissions s join public.qs_sessions x on x.id=s.session_id where x.questionnaire_id=result.id) then
   raise exception 'Le domande si modificano solo in bozza e prima delle compilazioni. Duplica il questionario per crearne una nuova versione.' using errcode='QS423';
  end if;
  delete from public.qs_questions where questionnaire_id=result.id;
  for q in select * from jsonb_array_elements(p_data->'questions') loop
   if q->>'kind' not in ('single','multiple','text') or length(trim(coalesce(q->>'prompt','')))=0 then
    raise exception 'Domanda % incompleta.',qpos+1 using errcode='QS422'; end if;
   if q->>'kind'<>'text' and jsonb_array_length(coalesce(q->'options','[]'))<2 then
    raise exception 'La domanda % deve avere almeno due opzioni.',qpos+1 using errcode='QS422'; end if;
   insert into public.qs_questions(questionnaire_id,position,kind,prompt,help,required)
   values(result.id,qpos,q->>'kind',q->>'prompt',coalesce(q->>'help',''),coalesce((q->>'required')::boolean,true)) returning id into qid;
   opos:=0;
   if q->>'kind'<>'text' then
    for o in select * from jsonb_array_elements(q->'options') loop
     if length(trim(coalesce(o#>>'{}','')))=0 then raise exception 'La domanda % ha un''opzione vuota.',qpos+1 using errcode='QS422'; end if;
     insert into public.qs_options(question_id,position,label) values(qid,opos,o#>>'{}'); opos:=opos+1;
    end loop;
   end if;
   qpos:=qpos+1;
  end loop;
 end if;
 return result;
end $$;

create function public.qs_new_session(p_actor uuid,p_questionnaire uuid,p_label text,p_date date) returns public.qs_sessions language plpgsql security invoker set search_path='' as $$
declare result public.qs_sessions;
begin
 perform 1 from public.qs_questionnaires where id=p_questionnaire and status='published' for update;
 if not found then raise exception 'Pubblica il questionario prima di aprire una sessione.' using errcode='QS409'; end if;
 insert into public.qs_sessions(questionnaire_id,label,meeting_date,created_by) values(p_questionnaire,p_label,p_date,p_actor) returning * into result;
 perform public.qs_audit(p_questionnaire,p_actor,'session_open',jsonb_build_object('session',result.id,'label',result.label));
 return result;
end $$;

-- BOZZA → PUBBLICATO → CHIUSO → ARCHIVIATO, con riapertura e ritorno in bozza solo senza compilazioni.
create function public.qs_set_status(p_actor uuid,p_id uuid,p_action text) returns public.qs_questionnaires language plpgsql security invoker set search_path='' as $$
declare result public.qs_questionnaires; target text;
begin
 select * into result from public.qs_questionnaires where id=p_id for update;
 if not found then raise exception 'Questionario non trovato.' using errcode='QS404'; end if;
 target:=case
  when p_action='publish' and result.status='draft' then 'published'
  when p_action='close' and result.status='published' then 'closed'
  when p_action='reopen' and result.status='closed' then 'published'
  when p_action='archive' and result.status in ('draft','published','closed') then 'archived'
  when p_action='restore' and result.status='archived' then 'closed'
  when p_action='draft' and result.status in ('published','closed') then 'draft' end;
 if target is null then raise exception 'Operazione non consentita in questo stato.' using errcode='QS409'; end if;
 if p_action='publish' and not exists(select 1 from public.qs_questions where questionnaire_id=p_id) then
  raise exception 'Aggiungi almeno una domanda prima di pubblicare.' using errcode='QS422'; end if;
 if p_action='draft' and exists(select 1 from public.qs_submissions s join public.qs_sessions x on x.id=s.session_id where x.questionnaire_id=p_id) then
  raise exception 'Il questionario ha già ricevuto compilazioni: duplicalo per modificarne le domande.' using errcode='QS423'; end if;
 if target in ('closed','archived','draft') then
  update public.qs_sessions set status='closed',closed_at=now() where questionnaire_id=p_id and status='open';
 end if;
 update public.qs_questionnaires set status=target,version=version+1,updated_at=now(),
  published_at=case when target='published' then coalesce(published_at,now()) else published_at end where id=p_id returning * into result;
 if p_action='publish' and not exists(select 1 from public.qs_sessions where questionnaire_id=p_id and status='open') then
  insert into public.qs_sessions(questionnaire_id,label,meeting_date,created_by)
  values(p_id,coalesce(nullif(trim(result.meeting_ref),''),'Prima sessione'),current_date,p_actor);
 end if;
 perform public.qs_audit(p_id,p_actor,'status_'||target);
 return result;
end $$;

create function public.qs_session_status(p_actor uuid,p_session uuid,p_open boolean) returns public.qs_sessions language plpgsql security invoker set search_path='' as $$
declare result public.qs_sessions;
begin
 select s.* into result from public.qs_sessions s where s.id=p_session for update;
 if not found then raise exception 'Sessione non trovata.' using errcode='QS404'; end if;
 if p_open and not exists(select 1 from public.qs_questionnaires where id=result.questionnaire_id and status='published') then
  raise exception 'Riapri o pubblica il questionario prima di riaprire la sessione.' using errcode='QS409'; end if;
 update public.qs_sessions set status=case when p_open then 'open' else 'closed' end,closed_at=case when p_open then null else now() end
 where id=p_session returning * into result;
 perform public.qs_audit(result.questionnaire_id,p_actor,case when p_open then 'session_reopen' else 'session_close' end,jsonb_build_object('session',p_session));
 return result;
end $$;

create function public.qs_duplicate(p_actor uuid,p_id uuid) returns public.qs_questionnaires language plpgsql security invoker set search_path='' as $$
declare src public.qs_questionnaires; result public.qs_questionnaires; q public.qs_questions; qid uuid;
begin
 select * into src from public.qs_questionnaires where id=p_id;
 if not found then raise exception 'Questionario non trovato.' using errcode='QS404'; end if;
 insert into public.qs_questionnaires(owner_id,title,description,meeting_ref,retention_months,source_id)
 values(p_actor,left(src.title||' (copia)',200),src.description,'',src.retention_months,src.id) returning * into result;
 for q in select * from public.qs_questions where questionnaire_id=p_id order by position loop
  insert into public.qs_questions(questionnaire_id,position,kind,prompt,help,required) values(result.id,q.position,q.kind,q.prompt,q.help,q.required) returning id into qid;
  insert into public.qs_options(question_id,position,label) select qid,position,label from public.qs_options where question_id=q.id;
 end loop;
 perform public.qs_audit(result.id,p_actor,'duplicate',jsonb_build_object('source',p_id));
 return result;
end $$;

create function public.qs_delete_draft(p_actor uuid,p_id uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.qs_questionnaires where id=p_id and status='draft' for update;
 if not found or exists(select 1 from public.qs_sessions where questionnaire_id=p_id) then
  raise exception 'Si possono eliminare solo bozze mai pubblicate.' using errcode='QS409'; end if;
 delete from public.qs_questionnaires where id=p_id;
 perform public.qs_audit(p_id,p_actor,'delete_draft');
end $$;

create function public.qs_delete_results(p_actor uuid,p_session uuid) returns integer language plpgsql security invoker set search_path='' as $$
declare n integer; qid uuid;
begin
 select questionnaire_id into qid from public.qs_sessions where id=p_session for update;
 if not found then raise exception 'Sessione non trovata.' using errcode='QS404'; end if;
 delete from public.qs_submissions where session_id=p_session; get diagnostics n=row_count;
 perform public.qs_audit(qid,p_actor,'delete_results',jsonb_build_object('session',p_session,'count',n));
 return n;
end $$;

-- Conservazione configurabile per questionario: cancellazione delle compilazioni scadute.
create function public.qs_purge_expired() returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 delete from public.qs_submissions s using public.qs_sessions x, public.qs_questionnaires q
 where x.id=s.session_id and q.id=x.questionnaire_id and q.retention_months is not null
  and s.submitted_at < now()-make_interval(months=>q.retention_months);
 get diagnostics n=row_count;
 return n;
end $$;

-- Invio anonimo: validazione completa e salvataggio atomico di compilazione e risposte.
create function public.qs_submit(p_token text,p_client_key uuid,p_answers jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare s public.qs_sessions; qstatus text; q record; v jsonb; picked uuid[]; txt text; n integer; sub uuid; existing integer;
begin
 if jsonb_typeof(p_answers)<>'object' then raise exception 'Risposte non valide.' using errcode='QS422'; end if;
 select * into s from public.qs_sessions where token=p_token for update;
 if not found then raise exception 'Questionario non trovato.' using errcode='QS404'; end if;
 select status into qstatus from public.qs_questionnaires where id=s.questionnaire_id;
 if s.status<>'open' or qstatus<>'published' then raise exception 'Questo questionario non accetta più risposte.' using errcode='QS410'; end if;
 select seq into existing from public.qs_submissions where session_id=s.id and client_key=p_client_key;
 if found then return existing; end if;
 if exists(select 1 from jsonb_object_keys(p_answers) k where k !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or not exists(select 1 from public.qs_questions where questionnaire_id=s.questionnaire_id and id=k::uuid)) then
  raise exception 'Il questionario è stato aggiornato. Ricarica la pagina.' using errcode='QS422'; end if;
 n:=s.submission_count+1;
 update public.qs_sessions set submission_count=n where id=s.id;
 insert into public.qs_submissions(session_id,seq,client_key) values(s.id,n,p_client_key) returning id into sub;
 for q in select * from public.qs_questions where questionnaire_id=s.questionnaire_id order by position loop
  v:=p_answers->(q.id::text);
  if q.kind='text' then
   txt:=case when jsonb_typeof(v->'text')='string' then v->>'text' end;
   if txt is not null and length(trim(txt))=0 then txt:=null; end if;
   if txt is null and q.required then raise exception 'Rispondi alla domanda %.',q.position+1 using errcode='QS422'; end if;
   if txt is not null then insert into public.qs_answers(submission_id,question_id,text_value) values(sub,q.id,txt); end if;
  else
   if v is not null and jsonb_typeof(v->'options') is distinct from 'array' then raise exception 'Risposte non valide.' using errcode='QS422'; end if;
   if exists(select 1 from jsonb_array_elements(coalesce(v->'options','[]')) e where jsonb_typeof(e)<>'string'
     or e#>>'{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'Risposte non valide.' using errcode='QS422'; end if;
   select coalesce(array_agg(distinct (e#>>'{}')::uuid),'{}') into picked from jsonb_array_elements(coalesce(v->'options','[]')) e;
   if exists(select 1 from unnest(picked) p where not exists(select 1 from public.qs_options o where o.question_id=q.id and o.id=p)) then
    raise exception 'Il questionario è stato aggiornato. Ricarica la pagina.' using errcode='QS422'; end if;
   if q.kind='single' and cardinality(picked)>1 then raise exception 'Alla domanda % si può dare una sola risposta.',q.position+1 using errcode='QS422'; end if;
   if cardinality(picked)=0 and q.required then raise exception 'Rispondi alla domanda %.',q.position+1 using errcode='QS422'; end if;
   if cardinality(picked)>0 then insert into public.qs_answers(submission_id,question_id,option_ids) values(sub,q.id,picked); end if;
  end if;
 end loop;
 return n;
end $$;

-- Limite anti-abuso generoso: molti partecipanti possono condividere la stessa rete Wi-Fi.
create function public.qs_submit_limit(p_key text) returns boolean language plpgsql security invoker set search_path='' as $$
declare n int;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_key||'qs',0));
 select count(*) into n from public.association_access_attempts where key_hash=p_key and kind='qs' and created_at>now()-interval '15 minutes';
 if n>=200 then return false; end if;
 insert into public.association_access_attempts(key_hash,kind) values(p_key,'qs');
 return true;
end $$;

create function public.qs_session_stats(p_session uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'total',(select count(*) from public.qs_submissions where session_id=p_session),
  'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'answered',
     (select count(*) from public.qs_answers a join public.qs_submissions s on s.id=a.submission_id where s.session_id=p_session and a.question_id=q.id),
     'options',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'count',
       (select count(*) from public.qs_answers a join public.qs_submissions s on s.id=a.submission_id
        where s.session_id=p_session and a.question_id=q.id and o.id=any(a.option_ids))) order by o.position),'[]')
      from public.qs_options o where o.question_id=q.id)) order by q.position)
   from public.qs_questions q join public.qs_sessions x on x.questionnaire_id=q.questionnaire_id where x.id=p_session),'[]'));
$$;

revoke all on function public.qs_audit(uuid,uuid,text,jsonb),public.qs_save(uuid,uuid,integer,jsonb),public.qs_new_session(uuid,uuid,text,date),
 public.qs_set_status(uuid,uuid,text),public.qs_session_status(uuid,uuid,boolean),public.qs_duplicate(uuid,uuid),public.qs_delete_draft(uuid,uuid),
 public.qs_delete_results(uuid,uuid),public.qs_purge_expired(),public.qs_submit(text,uuid,jsonb),public.qs_submit_limit(text),public.qs_session_stats(uuid) from public,anon,authenticated;
grant execute on function public.qs_audit(uuid,uuid,text,jsonb),public.qs_save(uuid,uuid,integer,jsonb),public.qs_new_session(uuid,uuid,text,date),
 public.qs_set_status(uuid,uuid,text),public.qs_session_status(uuid,uuid,boolean),public.qs_duplicate(uuid,uuid),public.qs_delete_draft(uuid,uuid),
 public.qs_delete_results(uuid,uuid),public.qs_purge_expired(),public.qs_submit(text,uuid,jsonb),public.qs_submit_limit(text),public.qs_session_stats(uuid) to service_role;
