-- Login names are server-owned; pending requests never create permission grants.
alter table public.association_members add column username text;
alter table public.association_members add column activated_at timestamptz default now();
alter table public.association_members add constraint association_username_format check(username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');
create unique index association_members_username_key on public.association_members(username) where username is not null;
create unique index association_members_email_key on public.association_members(lower(email));
create table public.association_access_requests (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 120),
 email text not null check(length(email)<=254 and email=lower(email)),
 username text not null check(username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
 status text not null default 'pending' check(status in ('pending','processing','approved','rejected')),
 user_id uuid references auth.users(id), reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 created_at timestamptz not null default now(), privacy_at timestamptz not null default now(),
 notification_sent_at timestamptz, invitation_sent_at timestamptz
);
create unique index association_pending_email_key on public.association_access_requests(email) where status in ('pending','processing');
create unique index association_pending_username_key on public.association_access_requests(username) where status in ('pending','processing');
create index association_requests_status_idx on public.association_access_requests(status,created_at desc);
create table public.association_access_attempts(id bigint generated always as identity primary key, key_hash text not null, kind text not null,created_at timestamptz not null default now());
create index association_attempts_key_idx on public.association_access_attempts(key_hash,kind,created_at);
alter table public.association_access_requests enable row level security;
alter table public.association_access_attempts enable row level security;
revoke all on public.association_access_requests,public.association_access_attempts from public,anon,authenticated;
grant select,insert,update on public.association_access_requests to service_role;
grant select,insert,delete on public.association_access_attempts to service_role;
grant usage,select on sequence public.association_access_attempts_id_seq to service_role;
create function public.association_access_limit(p_key text,p_kind text) returns boolean language plpgsql security invoker set search_path='' as $$
declare n int; maximum int;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_key||p_kind,0));
 maximum:=case when p_kind='request' then 5 else 10 end;
 select count(*) into n from public.association_access_attempts where key_hash=p_key and kind=p_kind and created_at>now()-interval '15 minutes';
 if n>=maximum then return false; end if;
 insert into public.association_access_attempts(key_hash,kind) values(p_key,p_kind);
 delete from public.association_access_attempts where created_at<now()-interval '1 day';
 return true;
end $$;
create function public.association_submit_access(p_name text,p_email text,p_username text) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 if exists(select 1 from public.association_members where lower(email)=p_email or username=p_username) then return null; end if;
 insert into public.association_access_requests(name,email,username) values(p_name,p_email,p_username) on conflict do nothing returning id into result;
 return result;
end $$;
create function public.association_review_access(p_id uuid,p_actor uuid,p_action text,p_user uuid default null,p_role text default null) returns public.association_access_requests language plpgsql security invoker set search_path='' as $$
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
  if req.status<>'processing' or req.reviewed_by<>p_actor or p_user is null or p_role not in ('accountant','member') then raise exception 'invalid approval'; end if;
  insert into public.association_members(user_id,name,email,username,role,active,activated_at) values(p_user,req.name,req.email,req.username,p_role,true,null);
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
 update public.association_members set name=p_member->>'name',username=p_member->>'username',role=p_member->>'role',active=(p_member->>'active')::boolean where user_id=(p_member->>'user_id')::uuid;
 select to_jsonb(m) into result from public.association_members m where user_id=(p_member->>'user_id')::uuid;
 insert into public.association_audit(entity,entity_id,actor_id,action,before_data,after_data) values('association_members',(p_member->>'user_id')::uuid,p_actor,'permissions',previous,result);
end $$;
create function public.association_activate_member(p_user uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.association_members set activated_at=now() where user_id=p_user and active and activated_at is null;
 if found then insert into public.association_audit(entity,entity_id,actor_id,action) values('association_members',p_user,p_user,'activate'); end if;
 return exists(select 1 from public.association_members where user_id=p_user and active and activated_at is not null);
end $$;
revoke all on function public.association_access_limit(text,text),public.association_submit_access(text,text,text),public.association_review_access(uuid,uuid,text,uuid,text),public.association_activate_member(uuid),public.association_save_member(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.association_access_limit(text,text),public.association_submit_access(text,text,text),public.association_review_access(uuid,uuid,text,uuid,text),public.association_activate_member(uuid),public.association_save_member(uuid,jsonb) to service_role;
