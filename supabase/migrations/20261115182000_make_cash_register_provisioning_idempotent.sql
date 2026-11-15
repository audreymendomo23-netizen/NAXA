-- Make pharmacy cash-register provisioning repairable after a partial
-- assignment/resource state without weakening the canonical authorization guard.

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

  begin
    perform public.naxa_grant_professional_assignment(
      p_target,
      p_pharmacie,
      'caisse',
      now(),
      null,
      'Attribution du poste Caisse via la gestion d’équipe NAXA.'
    );
  exception
    when raise_exception then
      -- The grant RPC has already checked actor role, network, CREATE_CAISSE,
      -- active target/pharmacy, architecture and quota before this exact error.
      if sqlerrm <> 'Une affectation active de ce rôle chevauche déjà la période' then
        raise;
      end if;
      if not exists (
        select 1
        from public.naxa_professional_assignments a
        join public.profiles p on p.id = a.profile_id and p.actif = true
        join public.pharmacies ph on ph.id = a.pharmacie_id and ph.actif = true
          and ph.archivee_le is null
        where a.profile_id = p_target
          and a.pharmacie_id = p_pharmacie
          and a.role_code = 'caisse'
          and a.statut = 'active'
          and a.commence_at <= now()
          and (a.expire_at is null or a.expire_at > now())
      ) then
        raise;
      end if;
  end;

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
