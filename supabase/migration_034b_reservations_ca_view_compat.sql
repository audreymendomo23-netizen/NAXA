-- NAXA 034b — compatibilité additive des vues avant le KPI canonique 035.
-- migration_014 expose encore v_reservations_ca(id, pharmacie_id, jour, total).
-- 035 remplace cette forme par (pharmacie_id, jour, ventes, total, panier_moyen),
-- ce que CREATE OR REPLACE VIEW ne peut pas faire. Si l'ancienne forme existe,
-- recréer les dépendances avec la forme canonique avant l'exécution de 035.
do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid=c.oid
    where n.nspname='public'
      and c.relname='v_reservations_ca'
      and c.relkind='v'
      and a.attnum>0
      and not a.attisdropped
      and a.attname='id'
  ) then
    execute 'drop view if exists bi.activite_mensuelle';
    execute 'drop view if exists public.v_ventes_journalieres';
    execute 'drop view if exists public.v_reservations_ca';
  end if;
end
$$;

create or replace view public.v_reservations_ca
with (security_invoker=true)
as
select
  r.pharmacie_id,
  r.created_at::date as jour,
  count(*)::integer as ventes,
  coalesce(sum(r.total),0)::integer as total,
  coalesce(avg(r.total),0)::numeric as panier_moyen
from public.reservations r
where r.statut in ('payee','retiree')
group by r.pharmacie_id,r.created_at::date;

revoke all on public.v_reservations_ca from anon,authenticated;
grant select on public.v_reservations_ca to authenticated;

create or replace view public.v_ventes_journalieres
with (security_invoker=true)
as
select
  r.pharmacie_id,
  r.created_at::date as jour,
  count(*) filter (where r.statut::text in ('retiree','payee'))::integer as ventes,
  coalesce(sum(r.total) filter (where r.statut::text in ('retiree','payee')),0)::integer as ca,
  coalesce(avg(r.total) filter (where r.statut::text in ('retiree','payee')),0)::numeric as panier_moyen
from public.reservations r
group by r.pharmacie_id,r.created_at::date;

create or replace view bi.activite_mensuelle
with (security_invoker=true)
as
select
  date_trunc('month',r.created_at)::date as mois,
  ph.nom as pharmacie,
  ph.quartier,
  ph.ville,
  count(*)::integer as reservations,
  count(*) filter (where r.statut::text in ('retiree','payee'))::integer as ventes,
  coalesce(sum(r.total) filter (where r.statut::text in ('retiree','payee')),0)::integer as ca
from public.reservations r
join public.pharmacies ph on ph.id=r.pharmacie_id
where ph.est_demo is not true
group by 1,2,3,4;
