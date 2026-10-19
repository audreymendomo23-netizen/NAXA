-- NAXA 133 — validité Promoteur basée exclusivement sur la convention canonique.
-- Contradiction corrigée : la migration 019 désactive la création d'abonnements par pharmacie,
-- mais la validité introduite en 039 continuait à exiger un abonnement legacy par pharmacie.
-- Une nouvelle pharmacie pouvait donc être correctement liée à une convention Promoteur et
-- rester invalide malgré un abonnement Promoteur actif.
begin;

create or replace function private.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $naxa$
begin
  if auth.uid() is null then
    return false;
  end if;

  -- Éviter qu'un utilisateur authentifié interroge la validité commerciale d'un tiers.
  if p_promoteur is distinct from auth.uid() and not public.is_admin() then
    return false;
  end if;

  return exists (
    select 1
    from public.profiles p
    join public.conventions_promoteurs c
      on c.promoteur_id = p.id
    join public.abonnements_promoteurs a
      on a.promoteur_id = p.id
     and a.convention_id = c.id
    where p.id = p_promoteur
      and p.role::text = 'promoteur'
      and p.actif = true
      and c.statut = 'active'
      and c.date_expiration >= current_date
      and c.architecture_code is not null
      and a.statut = 'actif'
      and a.echeance >= current_date
      and exists (
        select 1
        from public.promoteur_pharmacies pp
        where pp.promoteur_id = p.id
          and pp.actif = true
      )
      and not exists (
        select 1
        from public.promoteur_pharmacies pp
        left join public.pharmacies ph
          on ph.id = pp.pharmacie_id
        left join public.pharmacie_architectures pa
          on pa.pharmacie_id = pp.pharmacie_id
         and pa.active = true
         and pa.architecture_code = c.architecture_code
        where pp.promoteur_id = p.id
          and pp.actif = true
          and (ph.id is null or ph.actif is not true or pa.pharmacie_id is null)
      )
  );
end
$naxa$;

revoke all on function private.naxa_promoteur_valide(uuid) from public, anon, authenticated;

-- Façade protégée : seulement soi-même ou l'administration peut demander le statut.
create or replace function public.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $naxa$
begin
  if auth.uid() is null then
    return false;
  end if;
  if p_promoteur is distinct from auth.uid() and not public.is_admin() then
    return false;
  end if;
  return private.naxa_promoteur_valide(p_promoteur);
end
$naxa$;

revoke all on function public.naxa_promoteur_valide(uuid) from public, anon;
grant execute on function public.naxa_promoteur_valide(uuid) to authenticated;

commit;
