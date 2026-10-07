-- NAXA — Partie 2 Pilotage 360° : socle Performance
begin;

create view if not exists public.v_reservations_ca as
select r.id reservation_id,r.pharmacie_id,r.client_id,r.total ca_xaf,r.statut,r.created_at
from public.reservations r where r.statut in ('payee','retiree');

create or replace view public.v_reservations_ca as
select r.id reservation_id,r.pharmacie_id,r.client_id,r.total ca_xaf,r.statut,r.created_at
from public.reservations r where r.statut in ('payee','retiree');

alter view public.v_reservations_ca set (security_invoker = true);
revoke all on public.v_reservations_ca from anon;
grant select on public.v_reservations_ca to authenticated;

create index if not exists reservations_pilotage_statut_created_idx on public.reservations(statut,created_at,pharmacie_id);
create index if not exists stocks_pilotage_pharmacie_updated_idx on public.stocks(pharmacie_id,updated_at);

commit;
