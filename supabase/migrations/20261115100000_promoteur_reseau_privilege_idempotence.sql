begin;

-- Prevent concurrent writes while normalizing active RESEAU grants and installing
-- the uniqueness guarantee.
lock table public.naxa_profile_privileges in share row exclusive mode;

-- Keep the oldest active grant for each network scope and soft-revoke extras.
-- This preserves audit/history rows instead of deleting them.
with ranked as (
  select
    id,
    row_number() over (
      partition by profile_id, privilege_code, scope_type
      order by granted_at asc nulls last, id asc
    ) as position
  from public.naxa_profile_privileges
  where pharmacie_id is null
    and scope_type = 'RESEAU'
    and partner_id is null
    and active is true
    and revoked_at is null
)
update public.naxa_profile_privileges as privileges
set active = false,
    revoked_at = coalesce(privileges.revoked_at, now())
from ranked
where privileges.id = ranked.id
  and ranked.position > 1;

-- NULL pharmacy IDs must participate in uniqueness for active network grants.
create unique index if not exists naxa_profile_privileges_active_reseau_scope_uidx
  on public.naxa_profile_privileges (profile_id, privilege_code, scope_type)
  where pharmacie_id is null
    and scope_type = 'RESEAU'
    and partner_id is null
    and active is true
    and revoked_at is null;

-- Preserve the existing authorization checks and make the network-scope upsert
-- target the partial unique index above.
create or replace function public.naxa_provision_promoteur_pharmacie(
  p_promoteur uuid,
  p_pharmacie uuid
)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  arch text;
  cnt integer := 0;
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_promoteur
      and role::text = 'promoteur'
      and actif = true
  ) then
    raise exception 'Promoteur invalide';
  end if;

  if not private.naxa_promoteur_valide(p_promoteur) then
    raise exception 'Promoteur commercialement invalide';
  end if;

  if not exists (
    select 1
    from public.promoteur_pharmacies
    where promoteur_id = p_promoteur
      and pharmacie_id = p_pharmacie
      and actif = true
  ) then
    raise exception 'Lien Promoteur/pharmacie absent ou inactif';
  end if;

  select architecture_code
    into arch
  from public.pharmacie_architectures
  where pharmacie_id = p_pharmacie
    and active = true;

  if arch is null then
    return 0;
  end if;

  insert into public.naxa_profile_privileges (
    profile_id, privilege_code, pharmacie_id, scope_type, granted_by
  )
  select
    p_promoteur, ap.privilege_code, p_pharmacie, 'PHARMACIE', p_promoteur
  from public.naxa_architecture_privileges ap
  join public.naxa_privileges n on n.code = ap.privilege_code
  where ap.architecture_code = arch
    and ap.role_key = 'promoteur'
    and n.active
    and not n.governance
    and n.delegable
    and n.governance_only is not true
  on conflict (profile_id, privilege_code, pharmacie_id, scope_type)
  do update
    set active = true,
        revoked_at = null,
        granted_by = excluded.granted_by,
        granted_at = now();

  insert into public.naxa_profile_privileges (
    profile_id, privilege_code, pharmacie_id, scope_type, granted_by
  )
  select
    p_promoteur, ap.privilege_code, null, 'RESEAU', p_promoteur
  from public.naxa_architecture_privileges ap
  join public.naxa_privileges n on n.code = ap.privilege_code
  where ap.architecture_code = arch
    and ap.role_key = 'promoteur'
    and n.active
    and not n.governance
    and n.delegable
    and n.governance_only is not true
    and ap.privilege_code in (
      'VIEW_NETWORK_PILOTAGE',
      'VIEW_NETWORK_REPORT',
      'VIEW_NETWORK_HEALTH',
      'VIEW_CA_BY_PHARMACY',
      'VIEW_COMPARISON'
    )
  on conflict (profile_id, privilege_code, scope_type)
    where pharmacie_id is null
      and scope_type = 'RESEAU'
      and partner_id is null
      and active is true
      and revoked_at is null
  do update
    set active = true,
        revoked_at = null,
        granted_by = excluded.granted_by,
        granted_at = now();

  get diagnostics cnt = row_count;
  return cnt;
end
$function$;

commit;
