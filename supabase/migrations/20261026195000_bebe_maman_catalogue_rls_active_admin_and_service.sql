begin;

-- Use the centralized active-admin predicate for direct RLS access too.
drop policy if exists partner_products_admin_all on public.partner_products;
create policy partner_products_admin_all
on public.partner_products
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists universe_reservations_admin_read on public.universe_reservations;
create policy universe_reservations_admin_read
on public.universe_reservations
for select to authenticated
using (public.is_admin());

drop policy if exists universe_reservation_items_client_read on public.universe_reservation_items;
create policy universe_reservation_items_client_read
on public.universe_reservation_items
for select to authenticated
using (
  exists (
    select 1
    from public.universe_reservations r
    where r.id = universe_reservation_items.reservation_id
      and (
        r.client_id = (select auth.uid())
        or exists (
          select 1 from public.partner_members pm
          where pm.partner_id = r.partner_id
            and pm.user_id = (select auth.uid())
        )
        or public.is_admin()
      )
  )
);

-- Direct public reads must obey the same active-pharmacy/service requirement as the catalogue RPC.
drop policy if exists partner_products_public_active_read on public.partner_products;
create policy partner_products_public_active_read
on public.partner_products
for select to anon, authenticated
using (
  status = 'active'
  and (expires_at is null or expires_at >= current_date)
  and public.universe_partner_is_public(partner_id, universe_slug)
  and (
    universe_slug <> 'bebe-maman'
    or (
      pharmacie_id is not null
      and exists (
        select 1 from public.pharmacies ph
        join public.pharmacie_services ps on ps.pharmacie_id = ph.id
        where ph.id = partner_products.pharmacie_id
          and ph.actif = true
          and ph.visible_recherche = true
          and ps.service_slug = 'bebe-maman'
          and ps.status = 'active'
      )
    )
  )
);

commit;
