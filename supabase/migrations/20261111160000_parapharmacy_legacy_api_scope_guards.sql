-- NAXA — fermer les mutations REST directes qui contournaient le RBAC ERP Parapharmacie.
begin;

-- Les justificatifs photo Parapharmacie exigent maintenant le poste actif et
-- EDIT_PRODUCT. Les partenaires non-Parapharmacie conservent leur modèle historique.
drop policy if exists partner_product_photo_provenance_member_manage
  on public.partner_product_photo_provenance;

create policy partner_product_photo_provenance_member_manage
on public.partner_product_photo_provenance
for all to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.partner_products pp
    join public.partners pa
      on pa.id=pp.partner_id and pa.status='active'
    join public.partner_universes pu
      on pu.partner_id=pp.partner_id
      and pu.universe_slug=pp.universe_slug
      and pu.enabled=true
    where pp.id=partner_product_photo_provenance.product_id
      and pp.partner_id=partner_product_photo_provenance.partner_id
      and pp.universe_slug=partner_product_photo_provenance.universe_slug
      and (
        (
          pa.partner_type='parapharmacie'
          and private.naxa_partner_actor_can(pa.id,'EDIT_PRODUCT')
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
)
with check (
  public.is_admin()
  or (
    rights_confirmed_by=(select auth.uid())
    and uploaded_by=(select auth.uid())
    and exists (
      select 1
      from public.partner_products pp
      join public.partners pa
        on pa.id=pp.partner_id and pa.status='active'
      join public.partner_universes pu
        on pu.partner_id=pp.partner_id
        and pu.universe_slug=pp.universe_slug
        and pu.enabled=true
      where pp.id=partner_product_photo_provenance.product_id
        and pp.partner_id=partner_product_photo_provenance.partner_id
        and pp.universe_slug=partner_product_photo_provenance.universe_slug
        and (
          (
            pa.partner_type='parapharmacie'
            and private.naxa_partner_actor_can(pa.id,'EDIT_PRODUCT')
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
  )
);

-- Un Promoteur Parapharmacie ne peut pas injecter un faux mouvement en
-- contournant partner_adjust_universe_stock. Les autres types de partenaires
-- gardent leurs rôles génériques historiques.
drop policy if exists stock_movements_partner_insert on public.stock_movements;

create policy stock_movements_partner_insert
on public.stock_movements
for insert to authenticated
with check (
  created_by=(select auth.uid())
  and exists (
    select 1
    from public.partners pa
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
