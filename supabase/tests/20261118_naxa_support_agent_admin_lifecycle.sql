-- Contrat structurel de gestion Agent : RPC serveur, révocation et libération transactionnelles.
do $test$
declare v_def text;
begin
  if not exists(select 1 from pg_proc p
    where p.oid='public.support_agent_admin_update(uuid,uuid,text,text,text[])'::regprocedure
      and p.prosecdef is true) then
    raise exception 'RPC Admin Agent absente ou non SECURITY DEFINER'; end if;

  if has_function_privilege('anon','public.support_agent_admin_update(uuid,uuid,text,text,text[])','EXECUTE')
    or has_function_privilege('authenticated','public.support_agent_admin_update(uuid,uuid,text,text,text[])','EXECUTE') then
    raise exception 'RPC Admin Agent exposée à un rôle API'; end if;
  if not has_function_privilege('service_role','public.support_agent_admin_update(uuid,uuid,text,text,text[])','EXECUTE') then
    raise exception 'RPC Admin Agent inaccessible au serveur'; end if;

  select pg_get_functiondef('public.support_agent_admin_update(uuid,uuid,text,text,text[])'::regprocedure) into v_def;
  if position('p_actor_user_id' in v_def)=0 or position('role=''admin''' in v_def)=0
    or position('actif is true' in v_def)=0 then
    raise exception 'Contrôle Administrateur actif absent'; end if;
  if position('for update' in lower(v_def))=0 then raise exception 'Verrou Agent absent'; end if;
  if position('support_ticket_assignments' in v_def)=0
    or position('released_at' in v_def)=0
    or position('support_agent_permissions' in v_def)=0
    or position('revoked_at' in v_def)=0 then
    raise exception 'Révocation des droits ou libération des dossiers absente'; end if;
  if position('agent_suspended' in v_def)=0 or position('agent_revoked' in v_def)=0 then
    raise exception 'Journal des changements de statut absent'; end if;
  if position('ticket_released_after_agent_status_change' in v_def)=0 then
    raise exception 'Journal de libération des dossiers absent'; end if;
end;
$test$;
select 'naxa_support_agent_admin_lifecycle_pass' as test_name, true as passed;
