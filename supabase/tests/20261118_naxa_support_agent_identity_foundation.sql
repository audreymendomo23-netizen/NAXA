-- Tests structurels de sécurité du socle Agent NAXA. Aucun compte ou ticket créé.
begin;

do $test$
declare
  v_table text;
  v_id uuid;
  v_def text;
  v_update_rejected boolean := false;
  v_delete_rejected boolean := false;
  v_minor_rejected boolean := false;
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

    if (v_table <> 'support_agents' and has_table_privilege('authenticated',format('public.%I',v_table),'SELECT'))
      or has_table_privilege('authenticated',format('public.%I',v_table),'INSERT')
      or has_table_privilege('authenticated',format('public.%I',v_table),'UPDATE')
      or has_table_privilege('authenticated',format('public.%I',v_table),'DELETE') then
      raise exception 'Privilège authenticated excessif détecté sur public.%', v_table;
    end if;

    if not has_table_privilege('service_role',format('public.%I',v_table),'SELECT')
      or not has_table_privilege('service_role',format('public.%I',v_table),'INSERT')
      or not has_table_privilege('service_role',format('public.%I',v_table),'UPDATE')
      or not has_table_privilege('service_role',format('public.%I',v_table),'DELETE') then
      raise exception 'Privilèges serveur incomplets sur public.%', v_table;
    end if;

    if v_table <> 'support_agents' and not exists(select 1 from pg_policies p
      where p.schemaname='public' and p.tablename=v_table
        and p.policyname=case v_table
          when 'support_agent_permissions' then 'support_agent_permissions_server_only'
          when 'support_ticket_assignments' then 'support_ticket_assignments_server_only'
          else 'support_agent_events_server_only' end
        and p.cmd='ALL' and p.qual='false' and p.with_check='false') then
      raise exception 'Policy de refus direct authenticated absente sur public.%', v_table;
    end if;
  end loop;

  if not has_table_privilege('authenticated','public.support_agents','SELECT') then
    raise exception 'Lecture du profil propre Agent non accordée'; end if;
  if not exists(select 1 from pg_policies
    where schemaname='public' and tablename='support_agents'
      and policyname='support_agents_self_read' and cmd='SELECT'
      and position('auth.uid' in qual)>0 and position('user_id' in qual)>0) then
    raise exception 'Policy de lecture du seul profil Agent absente ou trop large'; end if;

  if not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='support_agents' and column_name='date_of_birth' and is_nullable='NO')
    or not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='support_agents' and column_name='age_attested_at' and is_nullable='NO')
    or not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='support_agents' and column_name='consent_accepted_at' and is_nullable='YES') then
    raise exception 'Date de naissance, attestation de majorité ou consentement manquant'; end if;
  if not exists(select 1 from pg_trigger where tgname='trg_naxa_support_agent_age_guard' and not tgisinternal) then
    raise exception 'Garde SQL de majorité Agent absente'; end if;
  select pg_get_functiondef('private.naxa_support_agent_age_guard()'::regprocedure) into v_def;
  if position('18 years' in v_def)=0 then raise exception 'Garde SQL de majorité Agent incorrecte'; end if;

  begin
    insert into public.support_agents(user_id,username,first_name,last_name,date_of_birth)
    values(gen_random_uuid(),'e2eminor_guard','Test','Mineur',(current_date - interval '17 years')::date);
  exception when check_violation then
    v_minor_rejected := true;
  end;
  if not v_minor_rejected then
    raise exception 'La base accepte un Agent déclaré mineur';
  end if;

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

  insert into public.support_agent_events(actor_user_id,event_code,details)
  values((select p.id from public.profiles p where p.role='admin'::public.role_type limit 1),
    'test_immutable_event','{"test":true}'::jsonb)
  returning id into v_id;

  -- Les FK peuvent être anonymisées lors d'une suppression Auth, sans modifier le contenu de l'audit.
  update public.support_agent_events set actor_user_id=null where id=v_id;

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
