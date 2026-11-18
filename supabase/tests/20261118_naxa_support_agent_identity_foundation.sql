-- Tests structurels de sécurité du socle Agent NAXA. Aucun compte ou ticket créé.
begin;

do $test$
declare
  v_table text;
  v_id uuid;
  v_update_rejected boolean := false;
  v_delete_rejected boolean := false;
begin
  foreach v_table in array array[
    'support_agents','support_agent_permissions',
    'support_ticket_assignments','support_agent_events'
  ] loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table and c.relrowsecurity
    ) then
      raise exception 'RLS absent sur public.%', v_table;
    end if;

    if has_table_privilege('authenticated',format('public.%I',v_table),'SELECT')
      or has_table_privilege('authenticated',format('public.%I',v_table),'INSERT')
      or has_table_privilege('authenticated',format('public.%I',v_table),'UPDATE')
      or has_table_privilege('authenticated',format('public.%I',v_table),'DELETE') then
      raise exception 'Privilège direct authenticated détecté sur public.%', v_table;
    end if;

    if not has_table_privilege('service_role',format('public.%I',v_table),'SELECT')
      or not has_table_privilege('service_role',format('public.%I',v_table),'INSERT')
      or not has_table_privilege('service_role',format('public.%I',v_table),'UPDATE')
      or not has_table_privilege('service_role',format('public.%I',v_table),'DELETE') then
      raise exception 'Privilèges serveur incomplets sur public.%', v_table;
    end if;

    if exists(select 1 from pg_policies p
      where p.schemaname='public' and p.tablename=v_table) then
      raise exception 'Une policy client inattendue expose public.%', v_table;
    end if;
  end loop;

  if exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='role_type' and e.enumlabel='support_agent') then
    raise exception 'Le rôle Agent ne doit pas être injecté dans role_type';
  end if;

  if not exists(select 1 from pg_trigger where tgname='trg_naxa_guard_support_agent_profile' and not tgisinternal)
    or not exists(select 1 from pg_trigger where tgname='trg_naxa_guard_profile_not_support_agent' and not tgisinternal) then
    raise exception 'Garde de séparation Agent/profiles absente';
  end if;

  if not exists(select 1 from pg_trigger where tgname='trg_naxa_support_agent_event_immutable' and not tgisinternal) then
    raise exception 'Trigger d’immutabilité du journal absent';
  end if;

  if not exists(select 1 from pg_indexes where schemaname='public'
    and indexname='support_ticket_assignments_one_active_ticket_uq') then
    raise exception 'Verrou d’unicité d’affectation active absent';
  end if;

  if not exists(select 1 from pg_constraint where conname='support_agent_permissions_permission_code_check') then
    raise exception 'Liste blanche des permissions absente';
  end if;

  insert into public.support_agent_events(event_code,details)
  values('test_immutable_event','{"test":true}'::jsonb)
  returning id into v_id;

  begin
    update public.support_agent_events set details='{"mutated":true}'::jsonb where id=v_id;
  exception when raise_exception then
    v_update_rejected := true;
  end;
  if not v_update_rejected then raise exception 'Le journal accepte UPDATE'; end if;

  begin
    delete from public.support_agent_events where id=v_id;
  exception when raise_exception then
    v_delete_rejected := true;
  end;
  if not v_delete_rejected then raise exception 'Le journal accepte DELETE'; end if;
end;
$test$;

rollback;
