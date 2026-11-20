begin;
do $test$
declare v_definition text;
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.support_call_events'::regclass
      and conname='support_call_events_event_code_check'
      and pg_get_constraintdef(oid) ilike '%screen_share_consented%'
      and pg_get_constraintdef(oid) ilike '%screen_share_started%'
      and pg_get_constraintdef(oid) ilike '%screen_share_stopped%'
      and pg_get_constraintdef(oid) ilike '%screen_share_denied%'
  ) then raise exception 'Codes d’audit partage écran absents'; end if;

  if not has_function_privilege('service_role','private.naxa_support_call_screen_share_event(uuid,uuid,uuid,text,text)','EXECUTE')
    or has_function_privilege('authenticated','private.naxa_support_call_screen_share_event(uuid,uuid,uuid,text,text)','EXECUTE')
    or has_function_privilege('anon','private.naxa_support_call_screen_share_event(uuid,uuid,uuid,text,text)','EXECUTE')
  then raise exception 'RPC privé partage écran réservé à service_role'; end if;

  if not has_function_privilege('service_role','public.naxa_support_call_screen_share_event(uuid,uuid,uuid,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.naxa_support_call_screen_share_event(uuid,uuid,uuid,text,text)','EXECUTE')
    or has_function_privilege('anon','public.naxa_support_call_screen_share_event(uuid,uuid,uuid,text,text)','EXECUTE')
  then raise exception 'Wrapper PostgREST partage écran réservé à service_role'; end if;

  select pg_get_functiondef('public.naxa_support_call_screen_share_event(uuid,uuid,uuid,text,text)'::regprocedure)
    into v_definition;
  if position('private.naxa_support_call_screen_share_event' in v_definition)=0
  then raise exception 'Le wrapper public ne délègue pas au RPC privé'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.support_calls'::regclass
      and tgname='trg_naxa_support_call_close_screen_shares' and not tgisinternal
  ) then raise exception 'Fermeture automatique des partages absente'; end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='support_call_screen_share_event_once_uq'
  ) then raise exception 'Index idempotent absent'; end if;

  select pg_get_functiondef('private.naxa_support_call_screen_share_event(uuid,uuid,uuid,text,text)'::regprocedure)
    into v_definition;
  if position('requester_user_id' in v_definition)=0
    or position('consentement de partage absent' in lower(v_definition))=0
  then raise exception 'Vérification du demandeur/consentement absente'; end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name in ('support_calls','support_call_events')
      and (column_name ilike '%frame%' or column_name ilike '%image%'
        or column_name ilike '%video_blob%' or column_name ilike '%recording%')
  ) then raise exception 'Aucun média ne doit être stocké'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.support_call_events'::regclass
      and tgname='trg_naxa_support_call_event_immutable' and not tgisinternal
  ) then raise exception 'Journal append-only absent'; end if;
end;
$test$;
rollback;
