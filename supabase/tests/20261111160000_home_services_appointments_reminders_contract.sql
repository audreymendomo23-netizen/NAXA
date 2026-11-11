-- Contrat de sécurité et de schéma des rendez-vous Prestations.
-- Ce test vérifie la migration installée ; il ne remplace pas une recette multi-utilisateur.
do $test$
declare
  v_rls_preferences boolean;
  v_rls_dispatches boolean;
  v_scheduled_at boolean;
  v_confirm_function boolean;
  v_authenticated_can_confirm boolean;
  v_anon_can_confirm boolean;
  v_dispatch_not_exposed boolean;
  v_transition_guard boolean;
  v_policy_count integer;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='home_service_requests'
      and column_name='scheduled_at' and data_type='timestamp with time zone'
  ) into v_scheduled_at;
  if not v_scheduled_at then raise exception 'home_service_requests.scheduled_at is missing'; end if;

  select coalesce(c.relrowsecurity,false) into v_rls_preferences
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='home_service_reminder_preferences';
  if not coalesce(v_rls_preferences,false) then
    raise exception 'Reminder preferences must enforce RLS';
  end if;

  select coalesce(c.relrowsecurity,false) into v_rls_dispatches
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='home_service_reminder_dispatches';
  if not coalesce(v_rls_dispatches,false) then
    raise exception 'Reminder dispatches must enforce RLS';
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname='public' and tablename='home_service_reminder_preferences'
    and policyname in (
      'home_service_reminder_preferences_read',
      'home_service_reminder_preferences_insert',
      'home_service_reminder_preferences_update',
      'home_service_reminder_preferences_delete'
    );
  if v_policy_count<>4 then raise exception 'Reminder preference policies incomplete: %',v_policy_count; end if;

  select to_regprocedure('public.confirm_home_service_appointment(uuid,timestamp with time zone)') is not null
    into v_confirm_function;
  if not v_confirm_function then raise exception 'Appointment confirmation RPC missing'; end if;

  select has_function_privilege('authenticated',
      'public.confirm_home_service_appointment(uuid,timestamp with time zone)','EXECUTE')
    into v_authenticated_can_confirm;
  select has_function_privilege('anon',
      'public.confirm_home_service_appointment(uuid,timestamp with time zone)','EXECUTE')
    into v_anon_can_confirm;
  if not v_authenticated_can_confirm or v_anon_can_confirm then
    raise exception 'Appointment confirmation RPC grants are unsafe';
  end if;

  select not has_table_privilege('authenticated','public.home_service_reminder_dispatches','SELECT')
    and not has_table_privilege('anon','public.home_service_reminder_dispatches','SELECT')
    into v_dispatch_not_exposed;
  if not v_dispatch_not_exposed then
    raise exception 'Internal reminder dispatch queue is exposed to client roles';
  end if;

  select position('confirm_home_service_appointment' in pg_get_functiondef(
    'public.transition_home_service_request(uuid,text)'::regprocedure
  ))>0 into v_transition_guard;
  if not v_transition_guard then
    raise exception 'Legacy transition RPC must reject confirmation without a scheduled slot';
  end if;

  if to_regclass('public.naxa_notification_push_outbox') is null then
    raise exception 'Global NAXA notification Push outbox missing';
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='notifications'
      and t.tgname='naxa_notification_push_enqueue' and not t.tgisinternal
  ) then
    raise exception 'Global notification Push enqueue trigger missing';
  end if;

  if has_table_privilege('authenticated','public.naxa_notification_push_outbox','SELECT')
    or has_table_privilege('anon','public.naxa_notification_push_outbox','SELECT') then
    raise exception 'Global notification Push outbox is exposed to client roles';
  end if;

  if to_regprocedure('public.claim_home_service_reminder_dispatches(integer)') is null then
    raise exception 'Atomic home-service reminder claim RPC missing';
  end if;
  if not has_function_privilege('service_role',
      'public.claim_home_service_reminder_dispatches(integer)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.claim_home_service_reminder_dispatches(integer)','EXECUTE')
    or has_function_privilege('anon',
      'public.claim_home_service_reminder_dispatches(integer)','EXECUTE') then
    raise exception 'Home-service reminder claim RPC grants are unsafe';
  end if;

  if to_regprocedure('public.claim_naxa_notification_push_outbox(integer)') is null then
    raise exception 'Atomic global notification Push claim RPC missing';
  end if;
  if not has_function_privilege('service_role',
      'public.claim_naxa_notification_push_outbox(integer)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.claim_naxa_notification_push_outbox(integer)','EXECUTE')
    or has_function_privilege('anon',
      'public.claim_naxa_notification_push_outbox(integer)','EXECUTE') then
    raise exception 'Global notification Push claim RPC grants are unsafe';
  end if;
end
$test$;

select 'naxa_home_service_appointments_reminders_contract_pass' as test, true as passed;
