-- Vérifie que la prise de file est strictement serveur et atomique.
do $test$
declare
  v_def text;
begin
  if not exists (
    select 1 from pg_proc p
    where p.oid='public.support_agent_claim_ticket(uuid,uuid)'::regprocedure
      and p.prosecdef is true
  ) then raise exception 'RPC de prise atomique absente ou non SECURITY DEFINER'; end if;

  if has_function_privilege('anon','public.support_agent_claim_ticket(uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.support_agent_claim_ticket(uuid,uuid)','EXECUTE') then
    raise exception 'La prise de file ne doit pas être appelable par anon/authenticated';
  end if;

  if not has_function_privilege('service_role','public.support_agent_claim_ticket(uuid,uuid)','EXECUTE') then
    raise exception 'La route serveur ne peut pas appeler la RPC de prise';
  end if;

  select pg_get_functiondef('public.support_agent_claim_ticket(uuid,uuid)'::regprocedure) into v_def;
  if (length(lower(v_def))-length(replace(lower(v_def),'for update','')))/length('for update') < 2 then
    raise exception 'Verrous Agent et ticket absents'; end if;
  if position('status=''active''' in v_def)=0 or position('presence=''available''' in v_def)=0 then
    raise exception 'Vérification statut/présence Agent absente'; end if;
  if position('queue_view' in v_def)=0 or position('ticket_view_assigned' in v_def)=0 then
    raise exception 'Vérification des permissions de file absente'; end if;
  if position('support_naxa' in v_def)=0 or position('statut<>''ouvert''' in v_def)=0 then
    raise exception 'Restriction au ticket NAXA ouvert absente'; end if;
  if position('support_ticket_assignments' in v_def)=0 or position('ticket_claimed' in v_def)=0 then
    raise exception 'Affectation ou audit de prise absent'; end if;
end;
$test$;
select 'naxa_support_agent_atomic_queue_claim_structure_pass' as test_name, true as passed;
