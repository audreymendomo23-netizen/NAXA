-- NAXA 068 — réconcilier le scope PHARMACIE avec la hiérarchie Promoteur/Responsable/Caisse.
-- Correctif additif : les Responsables et Caisses doivent être bornés à leur pharmacie,
-- tout en héritant de la validité commerciale du Promoteur parent. Aucun accès réseau élargi.

begin;

create or replace function public.naxa_scope_allows(
  p_actor uuid,
  p_pharmacie uuid,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $scope$
  with recursive ancestors(id,parent_profile_id,role,actif,depth) as (
    select p.id,p.parent_profile_id,p.role::text,p.actif,0
    from public.profiles p
    where p.id=p_actor
    union all
    select parent.id,parent.parent_profile_id,parent.role::text,parent.actif,a.depth+1
    from ancestors a
    join public.profiles parent on parent.id=a.parent_profile_id
    where a.depth < 3
  )
  select case
    when p_actor is null then false
    when p_scope='RESEAU' then
      exists (
        select 1
        from public.profiles p
        where p.id=p_actor and p.role::text='promoteur' and p.actif
          and private.naxa_promoteur_valide(p.id)
      )
      and (
        p_pharmacie is null
        or exists (
          select 1 from public.promoteur_pharmacies pp
          where pp.promoteur_id=p_actor and pp.pharmacie_id=p_pharmacie and pp.actif
        )
      )
    when p_scope='PHARMACIE' then
      p_pharmacie is not null
      and (
        exists (
          select 1
          from public.profiles p
          join public.promoteur_pharmacies pp
            on pp.promoteur_id=p.id and pp.pharmacie_id=p_pharmacie and pp.actif
          where p.id=p_actor and p.role::text='promoteur' and p.actif
            and private.naxa_promoteur_valide(p.id)
        )
        or (
          exists (
            select 1 from public.profiles actor
            where actor.id=p_actor and actor.actif
              and actor.pharmacie_id=p_pharmacie
              and actor.role::text in ('pharmacie','caisse')
          )
          and exists (
            select 1
            from ancestors a
            join public.promoteur_pharmacies pp
              on pp.promoteur_id=a.id and pp.pharmacie_id=p_pharmacie and pp.actif
            where a.role='promoteur' and a.actif
              and private.naxa_promoteur_valide(a.id)
          )
        )
      )
    when p_scope='POSTE_CAISSE' then
      p_pharmacie is not null
      and exists (
        select 1
        from public.profiles actor
        where actor.id=p_actor and actor.role::text='caisse' and actor.actif
          and actor.pharmacie_id=p_pharmacie
      )
      and exists (
        select 1
        from ancestors a
        join public.promoteur_pharmacies pp
          on pp.promoteur_id=a.id and pp.pharmacie_id=p_pharmacie and pp.actif
        where a.role='promoteur' and a.actif
          and private.naxa_promoteur_valide(a.id)
      )
    else false
  end;
$scope$;

revoke all on function public.naxa_scope_allows(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.naxa_scope_allows(uuid,uuid,text) to authenticated;

commit;
