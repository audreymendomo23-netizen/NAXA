-- NAXA 210 — source de disponibilité Marketplace alignée sur les lots réellement vendables.
-- La quantité retournée est le stock non réservé, non bloqué et non périmé.
-- Les réservations et la caisse continuent d'utiliser stocks/stocks_lots comme source de vérité.
begin;

create or replace function public.marketplace_offre_stock_disponible(
  p_pharmacie uuid,
  p_produit uuid
)
returns table(prix integer, quantite integer)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_stock public.stocks%rowtype;
  v_has_lots boolean;
  v_disponible integer;
begin
  if p_pharmacie is null or p_produit is null then
    return;
  end if;

  select s.*
    into v_stock
  from public.stocks s
  join public.pharmacies ph on ph.id = s.pharmacie_id
  where s.pharmacie_id = p_pharmacie
    and s.produit_id = p_produit
    and ph.actif = true
    and ph.visible_recherche = true;

  if not found then
    return;
  end if;

  select exists (
    select 1
    from public.stocks_lots l
    where l.pharmacie_id = p_pharmacie
      and l.produit_id = p_produit
  ) into v_has_lots;

  if v_has_lots then
    select coalesce(sum(l.quantite), 0)::integer
      into v_disponible
    from public.stocks_lots l
    where l.pharmacie_id = p_pharmacie
      and l.produit_id = p_produit
      and coalesce(l.bloque, false) = false
      and (l.date_peremption is null or l.date_peremption >= current_date);
  else
    v_disponible := case
      when v_stock.date_peremption is null or v_stock.date_peremption >= current_date
        then greatest(coalesce(v_stock.quantite, 0), 0)
      else 0
    end;
  end if;

  return query select v_stock.prix, greatest(coalesce(v_disponible, 0), 0);
end;
$function$;

revoke all on function public.marketplace_offre_stock_disponible(uuid, uuid) from public;
grant execute on function public.marketplace_offre_stock_disponible(uuid, uuid) to anon, authenticated;

comment on function public.marketplace_offre_stock_disponible(uuid, uuid) is
  'Quantité disponible pour une offre Marketplace : lots non bloqués et non périmés si la référence est lotisée, sinon stock agrégé non périmé. Les quantités déjà réservées doivent avoir été déduites des stocks/lots par les RPC métier.';

commit;
