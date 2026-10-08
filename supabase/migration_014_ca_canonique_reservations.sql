-- NAXA — Passe 4 / C4 : CA canonique et transitions de réservation
-- Additif, non destructif. À appliquer après validation de la branche.
-- Règle : une réservation ne contribue au CA que lorsqu'elle est payée ou retirée.
-- Une réservation reste une seule ligne de CA, quel que soit son passage payee -> retiree.

create or replace function public.set_reservation_status(p_id uuid,p_statut resa_statut)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.reservations;
  transition_ok boolean := false;
begin
  select * into r from public.reservations where id=p_id for update;
  if not found then raise exception 'Réservation introuvable'; end if;

  if not (
    public.is_admin()
    or r.pharmacie_id=public.my_pharmacie()
    or (r.client_id=(select auth.uid()) and p_statut='annulee')
  ) then
    raise exception 'Action non autorisée';
  end if;

  transition_ok := case
    when r.statut='en_attente' then p_statut in ('confirmee','payee','annulee','expiree')
    when r.statut='confirmee' then p_statut in ('payee','retiree','annulee','expiree')
    when r.statut='payee' then p_statut='retiree'
    else false
  end;

  if not transition_ok then
    raise exception 'Transition de réservation interdite: % -> %', r.statut, p_statut;
  end if;

  if p_statut in ('annulee','expiree') then
    perform public.restore_stock(p_id);
  end if;

  update public.reservations
  set statut=p_statut
  where id=p_id;
end;
$$;

drop view if exists public.v_reservations_ca;
create view public.v_reservations_ca
with (security_invoker=true)
as
select
  id,
  pharmacie_id,
  created_at::date as jour,
  total
from public.reservations
where statut in ('payee','retiree');

revoke all on public.v_reservations_ca from anon,authenticated;
grant select on public.v_reservations_ca to authenticated;

create or replace view public.v_ventes_journalieres
with (security_invoker=true)
as
select
  v.pharmacie_id,
  v.jour,
  count(*)::int as ventes,
  coalesce(sum(v.total),0)::int as ca,
  coalesce(avg(v.total),0)::numeric as panier_moyen
from public.v_reservations_ca v
group by v.pharmacie_id,v.jour;

create or replace view bi.activite_mensuelle
with (security_invoker=true)
as
select
  date_trunc('month',r.created_at)::date as mois,
  ph.nom as pharmacie,
  ph.quartier,
  ph.ville,
  count(*)::int as reservations,
  count(v.id)::int as ventes,
  coalesce(sum(v.total),0)::int as ca
from public.reservations r
join public.pharmacies ph on ph.id=r.pharmacie_id
left join public.v_reservations_ca v on v.id=r.id
where ph.est_demo is not true
group by 1,2,3,4;
