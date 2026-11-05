-- Aggiunge il ruolo Presidente senza attribuire permessi di contabilità o di admin principale.
-- Da applicare soltanto dopo approvazione e verifiche sull'ambiente di test.
alter table public.association_members drop constraint association_members_role_check;
alter table public.association_members add constraint association_members_role_check check(role in ('accountant','member','none','president'));
create or replace function public.association_review_access(p_id uuid,p_actor uuid,p_action text,p_user uuid default null,p_role text default null,p_psychologist boolean default false) returns public.association_access_requests language plpgsql security invoker set search_path='' as $$
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
  if req.status<>'processing' or req.reviewed_by<>p_actor or p_user is null or p_role is null or p_role not in ('accountant','member','none','president')
   or (p_role='none' and not coalesce(p_psychologist,false)) then raise exception 'invalid approval'; end if;
  insert into public.association_members(user_id,name,email,username,role,psychologist,active,activated_at) values(p_user,req.name,req.email,req.username,p_role,coalesce(p_psychologist,false),true,null);
  update public.association_access_requests set status='approved',user_id=p_user,reviewed_at=now() where id=p_id returning * into req;
 else raise exception 'invalid action';
 end if;
 if p_action in ('approve','reject') then insert into public.association_audit(entity,entity_id,actor_id,action,after_data) values('association_access_requests',p_id,p_actor,p_action,to_jsonb(req)); end if;
 return req;
end $$;
-- I privilegi della funzione restano riservati al service_role; nessun accesso diretto aggiuntivo.
revoke all on function public.association_review_access(uuid,uuid,text,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.association_review_access(uuid,uuid,text,uuid,text,boolean) to service_role;
