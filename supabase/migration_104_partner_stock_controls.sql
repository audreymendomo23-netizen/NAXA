-- NAXA 104 — ajustements de stock atomiques et journal en lecture partenaire.
-- Additif : ne touche pas au stock ni au journal historiques de la pharmacie.
begin;

create or replace function public.partner_adjust_universe_stock(
  p_product_id uuid,
  p_quantity_delta numeric,
  p_movement_type text,
  p_reason text default null
) returns numeric
language plpgsql
security definer
set search_path=public
as $function$
declare
  uid uuid := auth.uid();
  product_row public.partner_products%rowtype;
  next_quantity numeric(12,3);
  clean_reason text := left(trim(coalesce(p_reason,'')),240);
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if p_product_id is null or p_quantity_delta is null
    or p_quantity_delta=0 or abs(p_quantity_delta)>1000000
    or p_quantity_delta::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Quantité invalide';
  end if;
  if p_movement_type not in ('receipt','adjustment','loss','return','transfer_in','transfer_out','opening') then
    raise exception 'Type de mouvement invalide';
  end if;
  select pp.* into product_row
  from public.partner_products pp
  where pp.id=p_product_id
  for update;
  if not found then raise exception 'Produit introuvable'; end if;
  if not exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id and pa.status='active'
    join public.partner_universes pu on pu.partner_id=pa.id
      and pu.universe_slug=product_row.universe_slug and pu.enabled=true
    where pm.partner_id=product_row.partner_id and pm.user_id=uid
      and pm.member_role in ('owner','manager','operator')
  ) and not exists (
    select 1 from public.profiles p where p.id=uid and p.role='admin'
  ) then
    raise exception 'Action non autorisée';
  end if;
  next_quantity := product_row.stock_quantity + p_quantity_delta;
  if next_quantity < 0 then raise exception 'Le stock ne peut pas devenir négatif'; end if;
  update public.partner_products
    set stock_quantity=next_quantity,updated_at=now()
    where id=p_product_id;
  insert into public.stock_movements(
    partner_id,product_id,quantity_delta,movement_type,reason,reference,created_by
  ) values (
    product_row.partner_id,p_product_id,p_quantity_delta,p_movement_type,
    nullif(clean_reason,''),'manual:'||gen_random_uuid()::text,uid
  );
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(uid,'partner_stock.adjusted','partner_product',p_product_id::text,
    jsonb_build_object('delta',p_quantity_delta,'resulting_stock',next_quantity,
      'movement_type',p_movement_type,'reason',nullif(clean_reason,'')));
  return next_quantity;
end;
$function$;

revoke all on function public.partner_adjust_universe_stock(uuid,numeric,text,text) from public,anon;
grant execute on function public.partner_adjust_universe_stock(uuid,numeric,text,text) to authenticated;

drop policy if exists stock_movements_partner_read on public.stock_movements;
create policy stock_movements_partner_read on public.stock_movements
for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
  or exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id and pa.status='active'
    where pm.partner_id=stock_movements.partner_id and pm.user_id=auth.uid()
  )
);
-- Le journal reste append-only : aucune politique d'écriture directe n'est ajoutée.

commit;
