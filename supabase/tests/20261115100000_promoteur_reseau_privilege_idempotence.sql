-- Replay-only regression test for idempotent Promoteur RESEAU provisioning.
-- Uses the dedicated fixture; never runs against Production.
do $test$
declare
  v_profile_id uuid;
  v_pharmacies uuid[];
  v_pharmacy uuid;
  v_before jsonb;
  v_after jsonb;
  v_cycle integer;
  v_expected jsonb := jsonb_build_object(
    'VIEW_CA_BY_PHARMACY', 1,
    'VIEW_COMPARISON', 1,
    'VIEW_NETWORK_HEALTH', 1,
    'VIEW_NETWORK_PILOTAGE', 1,
    'VIEW_NETWORK_REPORT', 1
  );
begin
  select p.id
    into v_profile_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = 'naxa.e2e.promoteur@example.invalid';

  if v_profile_id is null then
    raise exception 'Replay Promoteur fixture introuvable';
  end if;

  select array_agg(pharmacie_id order by pharmacie_id)
    into v_pharmacies
  from public.promoteur_pharmacies
  where promoteur_id = v_profile_id
    and actif is true;

  if coalesce(cardinality(v_pharmacies), 0) < 2 then
    raise exception 'Deux pharmacies actives liées sont requises pour ce test';
  end if;

  select coalesce(jsonb_object_agg(privilege_code, active_count), '{}'::jsonb)
    into v_before
  from (
    select privilege_code, count(*)::integer as active_count
    from public.naxa_profile_privileges
    where profile_id = v_profile_id
      and pharmacie_id is null
      and scope_type = 'RESEAU'
      and partner_id is null
      and active is true
      and revoked_at is null
      and privilege_code in (
        'VIEW_CA_BY_PHARMACY',
        'VIEW_COMPARISON',
        'VIEW_NETWORK_HEALTH',
        'VIEW_NETWORK_PILOTAGE',
        'VIEW_NETWORK_REPORT'
      )
    group by privilege_code
  ) counts;

  if v_before is distinct from v_expected then
    raise exception 'État initial RESEAU incorrect: %', v_before;
  end if;

  for v_cycle in 1..3 loop
    foreach v_pharmacy in array v_pharmacies loop
      perform public.naxa_provision_promoteur_pharmacie(v_profile_id, v_pharmacy);
    end loop;
  end loop;

  select coalesce(jsonb_object_agg(privilege_code, active_count), '{}'::jsonb)
    into v_after
  from (
    select privilege_code, count(*)::integer as active_count
    from public.naxa_profile_privileges
    where profile_id = v_profile_id
      and pharmacie_id is null
      and scope_type = 'RESEAU'
      and partner_id is null
      and active is true
      and revoked_at is null
      and privilege_code in (
        'VIEW_CA_BY_PHARMACY',
        'VIEW_COMPARISON',
        'VIEW_NETWORK_HEALTH',
        'VIEW_NETWORK_PILOTAGE',
        'VIEW_NETWORK_REPORT'
      )
    group by privilege_code
  ) counts;

  if v_after is distinct from v_before then
    raise exception 'Le provisionnement a créé ou perdu des privilèges RESEAU: avant %, après %',
      v_before, v_after;
  end if;

  -- Prove the unique index itself rejects a duplicate active network grant.
  begin
    insert into public.naxa_profile_privileges (
      profile_id, privilege_code, pharmacie_id, scope_type, granted_by, active, revoked_at
    ) values (
      v_profile_id, 'VIEW_NETWORK_PILOTAGE', null, 'RESEAU', v_profile_id, true, null
    );

    raise exception 'L index unique a accepté un privilège RESEAU actif en double';
  exception
    when unique_violation then
      null;
  end;
end
$test$;
