-- Contrat du cycle de vie complet des rappels Prestations.
-- Vérifie les déclencheurs, l'annulation, le rescheduling et l'ACL du worker.
do $test$
declare
  v_home_state_constraint text;
  v_global_state_constraint text;
  v_trigger_count integer;
  v_helper_acl boolean;
  v_claim_definition text;
  v_sync_definition text;
  v_profile_trigger boolean;
  v_partner_trigger boolean;
  v_member_trigger boolean;
  v_preference_trigger boolean;
  v_appointment_trigger boolean;
begin
  select pg_get_constraintdef(c.oid) into v_home_state_constraint
  from pg_constraint c
  join pg_class t on t.oid=c.conrelid
  join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public'
    and t.relname='home_service_reminder_dispatches'
    and c.contype='c'
    and pg_get_constraintdef(c.oid) like '%cancelled%failed%';
  if v_home_state_constraint is null then
    raise exception 'Home-service dispatch states must include cancelled and failed';
  end if;

  select pg_get_constraintdef(c.oid) into v_global_state_constraint
  from pg_constraint c
  join pg_class t on t.oid=c.conrelid
  join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public'
    and t.relname='naxa_notification_push_outbox'
    and c.contype='c'
    and pg_get_constraintdef(c.oid) like '%failed%';
  if v_global_state_constraint is null then
    raise exception 'Global Push outbox must support terminal failed state';
  end if;

  select count(*) into v_trigger_count
  from pg_trigger t
  join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and not t.tgisinternal
    and t.tgname in (
      'home_service_reminder_lifecycle_sync',
      'home_service_reminder_preferences_sync',
      'home_service_reminder_members_sync',
      'home_service_reminder_partner_sync',
      'home_service_reminder_profile_sync'
    );
  if v_trigger_count<>5 then
    raise exception 'Reminder lifecycle triggers incomplete: %/5',v_trigger_count;
  end if;

  select not has_function_privilege('anon',
      'public.sync_home_service_reminder_user_scope(uuid,uuid)','EXECUTE')
    and not has_function_privilege('authenticated',
      'public.sync_home_service_reminder_user_scope(uuid,uuid)','EXECUTE')
    and not has_function_privilege('service_role',
      'public.sync_home_service_reminder_user_scope(uuid,uuid)','EXECUTE')
    into v_helper_acl;
  if not coalesce(v_helper_acl,false) then
    raise exception 'Internal reminder scope helper must not be directly executable by API roles';
  end if;

  select pg_get_functiondef('public.claim_home_service_reminder_dispatches(integer)'::regprocedure)
    into v_claim_definition;
  if position('pref.enabled' in v_claim_definition)=0
    or position('pr.actif' in v_claim_definition)=0
    or position('partenaire_domicile' in v_claim_definition)=0 then
    raise exception 'Atomic reminder claim must enforce preference, active profile and partner scope';
  end if;

  select pg_get_functiondef('public.sync_home_service_reminder_lifecycle()'::regprocedure)
    into v_sync_definition;
  if position('appointment_cancelled' in v_sync_definition)=0
    or position('appointment_completed' in v_sync_definition)=0
    or position('notification_created_at=null' in v_sync_definition)=0 then
    raise exception 'Appointment cancellation/completion/reschedule lifecycle incomplete';
  end if;

  select exists (
    select 1 from pg_trigger
    where tgname='home_service_reminder_profile_sync'
  ) into v_profile_trigger;
  select exists (
    select 1 from pg_trigger
    where tgname='home_service_reminder_partner_sync'
  ) into v_partner_trigger;
  select exists (
    select 1 from pg_trigger
    where tgname='home_service_reminder_members_sync'
  ) into v_member_trigger;
  select exists (
    select 1 from pg_trigger
    where tgname='home_service_reminder_preferences_sync'
  ) into v_preference_trigger;
  select exists (
    select 1 from pg_trigger
    where tgname='home_service_reminder_lifecycle_sync'
  ) into v_appointment_trigger;

  if not (v_profile_trigger and v_partner_trigger and v_member_trigger
      and v_preference_trigger and v_appointment_trigger) then
    raise exception 'At least one reminder synchronization trigger is missing';
  end if;
end
$test$;

select 'naxa_home_service_reminder_lifecycle_contract_pass' as test, true as passed;
