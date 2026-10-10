-- NAXA 067 — autoriser les vérifications de capacités de lecture sans cible
-- Le scope et le privilège restent obligatoires ; seules les capacités VIEW_* n'ont
-- pas besoin d'un identifiant de profil cible.

begin;

-- Validité Promoteur canonique : une convention et un abonnement au niveau réseau.
-- Les anciennes lignes abonnements par pharmacie restent conservées, mais ne gouvernent plus
-- l'expiration commerciale du Promoteur.
create or replace function private.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=''
as $naxavalid$
  select exists (
    select 1
    from public.profiles p
    join public.conventions_promoteurs c on c.promoteur_id=p.id
    join public.abonnements_promoteurs a
      on a.promoteur_id=p.id and a.convention_id=c.id
    where p.id=p_promoteur
      and p.role::text='promoteur'
      and p.actif
      and c.statut='active'
      and c.date_expiration >= current_date
      and a.statut='actif'
      and a.echeance >= current_date
  )
$naxavalid$;

create or replace function public.naxa_can(
  p_privilege text,
  p_pharmacie uuid default null,
  p_target uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $naxacan$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or p_privilege is null or p_pharmacie is null then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  if not public.naxa_scope_allows(v_uid,p_pharmacie,'PHARMACIE') then
    return false;
  end if;

  if not public.naxa_has_privilege(p_privilege,p_pharmacie,'PHARMACIE') then
    return false;
  end if;

  if p_privilege='CREATE_CAISSE' then
    return p_target is null;
  end if;

  if p_target is null then
    return p_privilege like 'VIEW_%';
  end if;

  if p_privilege='BLOCK_CAISSE' then
    return exists (
      select 1 from public.profiles t
      where t.id=p_target
        and t.role::text='caisse'
        and t.pharmacie_id=p_pharmacie
        and t.parent_profile_id=v_uid
        and t.actif
    );
  end if;

  if p_privilege='REACTIVATE_CAISSE' then
    return exists (
      select 1 from public.profiles t
      where t.id=p_target
        and t.role::text='caisse'
        and t.pharmacie_id=p_pharmacie
        and t.parent_profile_id=v_uid
        and not t.actif
    );
  end if;

  return public.naxa_can_manage_privilege_target(p_target,p_pharmacie);
end;
$naxacan$;

revoke all on function public.naxa_can(text,uuid,uuid) from public,anon;
grant execute on function public.naxa_can(text,uuid,uuid) to authenticated;

commit;
