-- NAXA — aligner les détails de réservation et l'intégrité des mouvements sur le périmètre ERP.
begin;

drop policy if exists universe_reservation_items_client_read
  on public.universe_reservation_items;

create policy universe_reservation_items_client_read
on public.universe_reservation_items
for select to authenticated
using (
  exists (
    select 1
    from public.universe_reservations r
    where r.id=universe_reservation_items.reservation_id
      and (
        r.client_id=(select auth.uid())
        or public.is_admin()
        or exists (
          select 1
          from public.partners pa
          where pa.id=r.partner_id
            and pa.status='active'
            and (
              (
                pa.partner_type='parapharmacie'
                and private.naxa_partner_actor_can(pa.id,'VIEW_RESERVATIONS')
              )
              or (
                pa.partner_type<>'parapharmacie'
                and exists (
                  select 1 from public.partner_members pm
                  where pm.partner_id=pa.id
                    and pm.user_id=(select auth.uid())
                )
              )
            )
        )
      )
  )
);

-- Les mouvements directs doivent référencer un produit du même établissement,
-- sur un univers actif, et respecter le droit de mutation du poste courant.
drop policy if exists stock_movements_partner_insert on public.stock_movements;

create policy stock_movements_partner_insert
on public.stock_movements
for insert to authenticated
with check (
  created_by=(select auth.uid())
  and exists (
    select 1
    from public.partners pa
    join public.partner_products pp
      on pp.partner_id=pa.id
      and pp.id=stock_movements.product_id
      and pp.partner_id=stock_movements.partner_id
    join public.partner_universes pu
      on pu.partner_id=pp.partner_id
      and pu.universe_slug=pp.universe_slug
      and pu.enabled=true
    where pa.id=stock_movements.partner_id
      and pa.status='active'
      and (
        (
          pa.partner_type='parapharmacie'
          and private.naxa_partner_actor_can(pa.id,'EDIT_STOCK_QUANTITY')
        )
        or (
          pa.partner_type<>'parapharmacie'
          and exists (
            select 1
            from public.partner_members pm
            where pm.partner_id=pa.id
              and pm.user_id=(select auth.uid())
              and pm.member_role in ('owner','manager','operator')
          )
        )
      )
  )
);

commit;
