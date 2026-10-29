-- NAXA — réconciliation additive du helper de validité commerciale Promoteur.
-- Constat : la migration 147 est enregistrée comme appliquée, mais la définition
-- active de private.naxa_promoteur_valide(uuid) en Production ne contient plus
-- ses gardes architecture/réseau/cohérence. Cette migration rétablit le contrat
-- 147 sans modifier les données ni les droits EXECUTE.
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

-- Réaffirmer le minimum de privilèges, sans accorder EXECUTE à aucun rôle API.
revoke all on function private.naxa_promoteur_valide(uuid) from public, anon, authenticated, service_role;
