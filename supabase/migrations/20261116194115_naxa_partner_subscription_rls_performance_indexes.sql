begin;

create index if not exists naxa_cumulative_requests_requested_by_idx
  on public.naxa_cumulative_activity_requests(requested_by);
create index if not exists naxa_cumulative_requests_destination_pharmacy_idx
  on public.naxa_cumulative_activity_requests(destination_pharmacy_id)
  where destination_pharmacy_id is not null;
create index if not exists naxa_cumulative_requests_destination_partner_idx
  on public.naxa_cumulative_activity_requests(destination_partner_id)
  where destination_partner_id is not null;

alter policy partner_universes_member_read on public.partner_universes using (
 public.is_admin() or exists(
  select 1 from public.partner_members pm join public.partners pa on pa.id=pm.partner_id
  where pm.partner_id=partner_universes.partner_id and pm.user_id=(select auth.uid())
    and pa.status='active' and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);
alter policy partners_member_read on public.partners using (
 public.is_admin() or (
  exists(select 1 from public.partner_members pm where pm.partner_id=partners.id and pm.user_id=(select auth.uid()))
  and status='active' and private.naxa_partner_has_confirmed_payment(partners.id)
 )
);

alter policy home_service_offers_partner_insert_draft on public.home_service_offers with check (
 status='draft' and exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_offers.partner_id and pm.user_id=(select auth.uid())
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);
alter policy home_service_offers_partner_read on public.home_service_offers using (
 exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_offers.partner_id and pm.user_id=(select auth.uid())
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);
alter policy home_service_offers_partner_update_unpublished on public.home_service_offers
using (
 exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_offers.partner_id and pm.user_id=(select auth.uid())
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
)
with check (
 status in ('draft','archived') and exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_offers.partner_id and pm.user_id=(select auth.uid())
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);

alter policy home_service_requests_partner_read on public.home_service_requests using (
 exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_requests.partner_id and pm.user_id=(select auth.uid())
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);
alter policy home_service_request_addresses_confirmed_partner_read on public.home_service_request_addresses using (
 exists(
  select 1 from public.home_service_requests r
  join public.partner_members pm on pm.partner_id=r.partner_id
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where r.id=home_service_request_addresses.request_id
    and r.status in ('confirmed','completed')
    and pm.user_id=(select auth.uid()) and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);

alter policy home_service_reminder_preferences_read on public.home_service_reminder_preferences using (
 user_id=(select auth.uid()) and exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_reminder_preferences.partner_id and pm.user_id=(select auth.uid())
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);
alter policy home_service_reminder_preferences_insert on public.home_service_reminder_preferences with check (
 user_id=(select auth.uid()) and exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_reminder_preferences.partner_id and pm.user_id=(select auth.uid())
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);
alter policy home_service_reminder_preferences_update on public.home_service_reminder_preferences
using (
 user_id=(select auth.uid()) and exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_reminder_preferences.partner_id and pm.user_id=(select auth.uid())
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
)
with check (
 user_id=(select auth.uid()) and exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_reminder_preferences.partner_id and pm.user_id=(select auth.uid())
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);
alter policy home_service_reminder_preferences_delete on public.home_service_reminder_preferences using (
 user_id=(select auth.uid()) and exists(
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
  join public.profiles pr on pr.id=pm.user_id
  where pm.partner_id=home_service_reminder_preferences.partner_id and pm.user_id=(select auth.uid())
    and pm.member_role in ('owner','manager','operator')
    and pa.status='active' and pa.partner_type='professionnel_domicile'
    and pr.actif=true and private.naxa_partner_has_confirmed_payment(pa.id)
 )
);

commit;
