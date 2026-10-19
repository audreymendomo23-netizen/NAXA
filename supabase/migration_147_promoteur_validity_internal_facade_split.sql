-- NAXA 147 — séparer validation interne et autorisation de lecture du statut.
-- La façade publique contrôle qui peut consulter un Promoteur ; les fonctions
-- SECURITY DEFINER internes doivent pouvoir valider un tiers, y compris depuis un trigger.
create or replace function private.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists (
    select 1
    from public.profiles p
    join public.conventions_promoteurs c on c.promoteur_id=p.id
    join public.abonnements_promoteurs a
      on a.promoteur_id=p.id and a.convention_id=c.id
    where p.id=p_promoteur
      and p.role::text='promoteur'
      and p.actif=true
      and c.statut='active'
      and c.date_expiration>=current_date
      and c.architecture_code is not null
      and a.statut='actif'
      and a.echeance>=current_date
      and exists (
        select 1 from public.promoteur_pharmacies pp
        where pp.promoteur_id=p.id and pp.actif=true
      )
      and not exists (
        select 1
        from public.promoteur_pharmacies pp
        left join public.pharmacies ph on ph.id=pp.pharmacie_id
        left join public.pharmacie_architectures pa
          on pa.pharmacie_id=pp.pharmacie_id
         and pa.active=true
         and pa.architecture_code=c.architecture_code
        where pp.promoteur_id=p.id
          and pp.actif=true
          and (ph.id is null or ph.actif is not true or pa.pharmacie_id is null)
      )
  );
$function$;

revoke all on function private.naxa_promoteur_valide(uuid) from public,anon,authenticated;

-- NAXA 146 — bloquer le provisionnement de privilèges pour un Promoteur invalide.
create or replace function public.naxa_provision_promoteur_pharmacie(
  p_promoteur uuid,
  p_pharmacie uuid
)
returns integer
language plpgsql
security definer
set search_path=''
as $function$
declare
  arch text;
  cnt integer:=0;
begin
  if not exists(
    select 1 from public.profiles
    where id=p_promoteur and role::text='promoteur' and actif=true
  ) then
    raise exception 'Promoteur invalide';
  end if;

  if not private.naxa_promoteur_valide(p_promoteur) then
    raise exception 'Promoteur commercialement invalide';
  end if;

  if not exists(
    select 1 from public.promoteur_pharmacies
    where promoteur_id=p_promoteur and pharmacie_id=p_pharmacie and actif=true
  ) then
    raise exception 'Lien Promoteur/pharmacie absent ou inactif';
  end if;

  select architecture_code into arch
  from public.pharmacie_architectures
  where pharmacie_id=p_pharmacie and active=true;
  if arch is null then return 0; end if;

  insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by)
  select p_promoteur,ap.privilege_code,p_pharmacie,'PHARMACIE',p_promoteur
  from public.naxa_architecture_privileges ap
  join public.naxa_privileges n on n.code=ap.privilege_code
  where ap.architecture_code=arch and ap.role_key='promoteur'
    and n.active and not n.governance and n.delegable
    and n.governance_only is not true
  on conflict(profile_id,privilege_code,pharmacie_id,scope_type)
  do update set active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now();

  insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by)
  select p_promoteur,ap.privilege_code,null,'RESEAU',p_promoteur
  from public.naxa_architecture_privileges ap
  join public.naxa_privileges n on n.code=ap.privilege_code
  where ap.architecture_code=arch and ap.role_key='promoteur'
    and n.active and not n.governance and n.delegable
    and n.governance_only is not true
    and ap.privilege_code in ('VIEW_NETWORK_PILOTAGE','VIEW_NETWORK_REPORT','VIEW_NETWORK_HEALTH','VIEW_CA_BY_PHARMACY','VIEW_COMPARISON')
  on conflict(profile_id,privilege_code,pharmacie_id,scope_type)
  do update set active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now();

  get diagnostics cnt=row_count;
  return cnt;
end
$function$;
