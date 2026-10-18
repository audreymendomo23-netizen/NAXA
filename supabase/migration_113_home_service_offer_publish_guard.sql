-- NAXA 113 — empêcher un partenaire de publier lui-même une prestation.
-- Les partenaires peuvent lire leurs offres, créer en brouillon et modifier/archiver leurs offres.
-- Seule la RPC administrative migration 112 peut faire passer une offre à active.
begin;

drop policy if exists home_service_offers_partner_manage on public.home_service_offers;

drop policy if exists home_service_offers_partner_read on public.home_service_offers;
create policy home_service_offers_partner_read
on public.home_service_offers
for select to authenticated
using (
  exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=home_service_offers.partner_id
      and pm.user_id=auth.uid()
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active'
      and pa.partner_type='professionnel_domicile'
  )
);

drop policy if exists home_service_offers_partner_insert_draft on public.home_service_offers;
create policy home_service_offers_partner_insert_draft
on public.home_service_offers
for insert to authenticated
with check (
  status='draft'
  and exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=home_service_offers.partner_id
      and pm.user_id=auth.uid()
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active'
      and pa.partner_type='professionnel_domicile'
  )
);

drop policy if exists home_service_offers_partner_update_unpublished on public.home_service_offers;
create policy home_service_offers_partner_update_unpublished
on public.home_service_offers
for update to authenticated
using (
  exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=home_service_offers.partner_id
      and pm.user_id=auth.uid()
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active'
      and pa.partner_type='professionnel_domicile'
  )
)
with check (
  status in ('draft','archived')
  and exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=home_service_offers.partner_id
      and pm.user_id=auth.uid()
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active'
      and pa.partner_type='professionnel_domicile'
  )
);

commit;
