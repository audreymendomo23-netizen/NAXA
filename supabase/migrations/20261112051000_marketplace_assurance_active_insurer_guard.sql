-- Une convention d'un assureur désactivé ne doit jamais être proposée au Marketplace.
create or replace view public.marketplace_assurance_conventions
with (security_barrier = true)
as
select c.pharmacie_id, c.assureur_id, c.date_debut, c.date_fin
from public.assurance_conventions c
join public.assureurs a on a.id = c.assureur_id and a.actif = true
join public.pharmacies p on p.id = c.pharmacie_id
where c.statut = 'active'
  and c.date_debut <= current_date
  and (c.date_fin is null or c.date_fin >= current_date)
  and p.visible_recherche = true
  and p.est_demo = false
  and p.archivee_le is null;
grant select on public.marketplace_assurance_conventions to anon, authenticated;
