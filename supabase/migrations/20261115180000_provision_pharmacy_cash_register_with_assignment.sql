-- Provision the pharmacy's shared physical cash register together with the
-- first Caisse professional assignment. Keep the assignment guard as the
-- authority for pharmacy scope, CREATE_CAISSE privilege and architecture quota.

create or replace function public.naxa_provision_caisse(
  p_target uuid,
  p_pharmacie uuid
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_existing_active boolean;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  if p_target is null or p_pharmacie is null then
    raise exception 'Compte Caisse et pharmacie requis';
  end if;

  -- The canonical assignment function validates the target, promoter network,
  -- CREATE_CAISSE privilege, active pharmacy, architecture and quota.
  perform public.naxa_grant_professional_assignment(
    p_target,
    p_pharmacie,
    'caisse',
    now(),
    null,
    'Attribution du poste Caisse via la gestion d’équipe NAXA.'
  );

  -- Serialize physical register provisioning for this pharmacy. Multiple
  -- cashiers (when an architecture permits them) use the same pharmacy register.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('naxa-caisse-resource:' || p_pharmacie::text, 0)
  );

  select c.actif
    into v_existing_active
  from public.caisses c
  where c.pharmacie_id = p_pharmacie
  order by c.created_at, c.id
  limit 1
  for update;

  if found then
    if v_existing_active is not true then
      raise exception 'Une caisse existe déjà mais elle est inactive ; réactivation requise avant nouvelle attribution';
    end if;
    return;
  end if;

  insert into public.caisses(pharmacie_id, nom, actif)
  values (p_pharmacie, 'Caisse principale', true);
end;
$function$;

revoke all on function public.naxa_provision_caisse(uuid, uuid) from public, anon;
grant execute on function public.naxa_provision_caisse(uuid, uuid) to authenticated, service_role;
