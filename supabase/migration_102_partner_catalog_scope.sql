-- NAXA 102 — limiter la gestion du catalogue aux univers associés au partenaire.
begin;

drop policy if exists partner_products_member_manage on public.partner_products;
create policy partner_products_member_manage on public.partner_products
for all to authenticated
using (
  exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id and pa.status='active'
    join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug=partner_products.universe_slug and pu.enabled=true
    where pm.partner_id=partner_products.partner_id
      and pm.user_id=auth.uid()
      and pm.member_role in ('owner','manager','operator')
  )
)
with check (
  exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id and pa.status='active'
    join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug=partner_products.universe_slug and pu.enabled=true
    where pm.partner_id=partner_products.partner_id
      and pm.user_id=auth.uid()
      and pm.member_role in ('owner','manager','operator')
  )
);

commit;
