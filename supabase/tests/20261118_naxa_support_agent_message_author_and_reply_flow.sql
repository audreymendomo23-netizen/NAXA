-- Vérifie l'intégration d'identité Agent dans le fil support sans compte de test.
do $test$
declare
  v_def text;
begin
  if not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='messages_support'
      and column_name='auteur_support_agent_id' and is_nullable='YES') then
    raise exception 'Colonne auteur Agent absente'; end if;

  if not exists(select 1 from pg_constraint
    where conrelid='public.messages_support'::regclass
      and conname='messages_support_single_author_identity_ck') then
    raise exception 'Contrainte empêchant deux auteurs simultanés absente'; end if;

  select pg_get_functiondef('public.support_chat_mark_first_response()'::regprocedure) into v_def;
  if position('auteur_support_agent_id' in v_def)=0
    or position('ticket_internal_note' in v_def)=0
    or position('ticket_reply' in v_def)=0
    or position('released_at' in v_def)=0 then
    raise exception 'Le trigger de réponse ne contrôle pas Agent, permission et affectation'; end if;

  if has_function_privilege('anon','public.support_chat_mark_first_response()','EXECUTE')
    or has_function_privilege('authenticated','public.support_chat_mark_first_response()','EXECUTE') then
    raise exception 'Le trigger ne doit pas être appelable directement'; end if;

  if not exists(select 1 from pg_trigger
    where tgname='trg_naxa_support_notify_agent_reply' and not tgisinternal) then
    raise exception 'Trigger de notification Client après réponse Agent absent'; end if;

  select pg_get_functiondef('private.naxa_support_notify_agent_reply()'::regprocedure) into v_def;
  if position('auteur_support_agent_id' in v_def)=0
    or position('support_ticket_assignments' in v_def)=0
    or position('ticket_reply' in v_def)=0 then
    raise exception 'La notification ne vérifie pas l''affectation et la permission Agent'; end if;
end;
$test$;
select 'naxa_support_agent_message_author_and_reply_flow_pass' as test_name, true as passed;
