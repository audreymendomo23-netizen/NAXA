-- NAXA 026 — correction du scope PHARMACIE pour Promoteur
-- Le scope d'un Promoteur repose sur promoteur_pharmacies, jamais sur profiles.pharmacie_id.
-- Les autres rôles conservent le moteur can_access_pharmacy existant.

create or replace function public.naxa_scope_allows(
  p_actor uuid,
  p_pharmacie uuid,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    case
      when p_scope='RESEAU' then
        exists (
          select 1
          from public.profiles p
          where p.id=p_actor
            and p.role='promoteur'
            and p.actif
        )
        and (
          p_pharmacie is null
          or exists (
            select 1
            from public.promoteur_pharmacies pp
            where pp.promoteur_id=p_actor
              and pp.pharmacie_id=p_pharmacie
              and pp.actif
          )
        )
      when p_scope='PHARMACIE' then
        p_pharmacie is not null
        and (
          (
            exists (
              select 1
              from public.profiles p
              where p.id=p_actor
                and p.role='promoteur'
                and p.actif
            )
            and exists (
              select 1
              from public.promoteur_pharmacies pp
              where pp.promoteur_id=p_actor
                and pp.pharmacie_id=p_pharmacie
                and pp.actif
            )
          )
          or public.can_access_pharmacy(p_pharmacie)
        )
      when p_scope='POSTE_CAISSE' then
        p_pharmacie is not null
        and exists (
          select 1
          from public.profiles p
          where p.id=p_actor
            and p.role='caisse'
            and p.actif
            and p.pharmacie_id=p_pharmacie
        )
      else false
    end
$$;

revoke all on function public.naxa_scope_allows(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.naxa_scope_allows(uuid,uuid,text)
  to authenticated;
