-- Accès Realtime/lecture directe limité aux dossiers attribués à l'Agent authentifié.
do $test$
declare v_def text;
begin
  if not exists(select 1 from pg_policies where schemaname='public'
    and tablename='tickets_support' and policyname='support_agent_assigned_ticket_read'
    and cmd='SELECT' and position('naxa_support_agent_has_ticket_permission' in qual)>0) then
    raise exception 'Policy de lecture ticket Agent attribué absente'; end if;

  if not exists(select 1 from pg_policies where schemaname='public'
    and tablename='messages_support' and policyname='support_agent_assigned_message_read'
    and cmd='SELECT' and position('ticket_internal_note' in qual)>0) then
    raise exception 'Policy de lecture messages/notes Agent absente'; end if;

  if not exists(select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='naxa_support_attachment_read_assigned_agent'
    and cmd='SELECT' and position('naxa_support_agent_can_read_attachment' in qual)>0) then
    raise exception 'Policy Storage pièces jointes Agent absente'; end if;

  select pg_get_functiondef('private.naxa_support_agent_has_ticket_permission(uuid,text)'::regprocedure) into v_def;
  if position('auth.uid()' in v_def)=0 or position('status=''active''' in v_def)=0
    or position('released_at is null' in v_def)=0 then
    raise exception 'Helper de permission ne contrôle pas l''Agent actif et son affectation'; end if;
  if has_function_privilege('anon','private.naxa_support_agent_has_ticket_permission(uuid,text)','EXECUTE')
    or not has_function_privilege('authenticated','private.naxa_support_agent_has_ticket_permission(uuid,text)','EXECUTE') then
    raise exception 'ACL helper Realtime incorrecte'; end if;

  select pg_get_functiondef('private.naxa_support_agent_can_read_attachment(text)'::regprocedure) into v_def;
  if position('attachments_read' in v_def)=0 or position('ticket_internal_note' in v_def)=0
    or position('auth.uid()' in v_def)=0 then
    raise exception 'Helper Storage ne vérifie pas les permissions Agent'; end if;
end;
$test$;
select 'naxa_support_agent_assigned_realtime_access_pass' as test_name, true as passed;
