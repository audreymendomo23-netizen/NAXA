-- NAXA 118 — indexes de clés étrangères et optimisation des prédicats RLS.
begin;

create index if not exists home_service_offers_created_by_idx
  on public.home_service_offers(created_by) where created_by is not null;
create index if not exists home_service_requests_offer_idx
  on public.home_service_requests(offer_id);
create index if not exists home_service_request_addresses_client_idx
  on public.home_service_request_addresses(client_id);

drop policy if exists home_service_offers_admin_manage on public.home_service_offers;
create policy home_service_offers_admin_manage on public.home_service_offers
for all to authenticated using (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
) with check (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
);

drop policy if exists home_service_offers_partner_read on public.home_service_offers;
create policy home_service_offers_partner_read
on public.home_service_offers for select to authenticated using (
  exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=home_service_offers.partner_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active' and pa.partner_type='professionnel_domicile'
  )
);

drop policy if exists home_service_offers_partner_insert_draft on public.home_service_offers;
create policy home_service_offers_partner_insert_draft
on public.home_service_offers for insert to authenticated with check (
  status='draft'
  and exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=home_service_offers.partner_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active' and pa.partner_type='professionnel_domicile'
  )
);

drop policy if exists home_service_offers_partner_update_unpublished on public.home_service_offers;
create policy home_service_offers_partner_update_unpublished
on public.home_service_offers for update to authenticated using (
  exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=home_service_offers.partner_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active' and pa.partner_type='professionnel_domicile'
  )
) with check (
  status in ('draft','archived')
  and exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=home_service_offers.partner_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active' and pa.partner_type='professionnel_domicile'
  )
);

drop policy if exists home_service_requests_client_read on public.home_service_requests;
create policy home_service_requests_client_read on public.home_service_requests
for select to authenticated using (client_id=(select auth.uid()));

drop policy if exists home_service_requests_partner_read on public.home_service_requests;
create policy home_service_requests_partner_read on public.home_service_requests
for select to authenticated using (
  exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=home_service_requests.partner_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager','operator') and pa.status='active'
  )
);

drop policy if exists home_service_requests_admin_read on public.home_service_requests;
create policy home_service_requests_admin_read on public.home_service_requests
for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
);

drop policy if exists home_service_request_addresses_client_read on public.home_service_request_addresses;
create policy home_service_request_addresses_client_read on public.home_service_request_addresses
for select to authenticated using (client_id=(select auth.uid()));

drop policy if exists home_service_request_addresses_confirmed_partner_read on public.home_service_request_addresses;
create policy home_service_request_addresses_confirmed_partner_read on public.home_service_request_addresses
for select to authenticated using (
  exists (
    select 1 from public.home_service_requests r
    join public.partner_members pm on pm.partner_id=r.partner_id
    join public.partners pa on pa.id=pm.partner_id and pa.status='active'
    where r.id=home_service_request_addresses.request_id
      and r.status in ('confirmed','completed')
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager','operator')
  )
);

commit;
