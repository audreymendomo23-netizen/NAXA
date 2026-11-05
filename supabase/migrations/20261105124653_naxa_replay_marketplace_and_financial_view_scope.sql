-- NAXA — Replay security pass (2026-11-05).
-- Restrict marketplace stock offers to active, visible, real pharmacies.
-- Make the financial aggregate view respect the caller's RLS scope.
begin;

alter view public.v_reservations_ca set (security_invoker = true);

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
  v_sellable integer;
  v_reserved integer;
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
    and ph.visible_recherche = true
    and ph.est_demo is false
    and ph.archivee_le is null;

  if not found then
    return;
  end if;

  select coalesce(sum(ri.quantite), 0)::integer
    into v_reserved
  from public.reservation_items ri
  join public.reservations r on r.id = ri.reservation_id
  where r.pharmacie_id = p_pharmacie
    and ri.produit_id = p_produit
    and r.statut in ('en_attente', 'confirmee')
    and r.expires_at > now()
    and r.consumed_at is null
    and coalesce(r.stock_restored, false) = false
    and coalesce(r.stock_decremented, false) = false;

  select exists (
    select 1
    from public.stocks_lots l
    where l.pharmacie_id = p_pharmacie
      and l.produit_id = p_produit
  )
  into v_has_lots;

  if v_has_lots then
    select coalesce(sum(l.quantite), 0)::integer
      into v_sellable
    from public.stocks_lots l
    where l.pharmacie_id = p_pharmacie
      and l.produit_id = p_produit
      and coalesce(l.bloque, false) = false
      and (l.date_peremption is null or l.date_peremption >= current_date);
  else
    v_sellable := case
      when v_stock.date_peremption is null or v_stock.date_peremption >= current_date
        then greatest(coalesce(v_stock.quantite, 0), 0)
      else 0
    end;
  end if;

  return query
    select v_stock.prix, greatest(coalesce(v_sellable, 0) - coalesce(v_reserved, 0), 0);
end;
$function$;

revoke all on function public.marketplace_offre_stock_disponible(uuid, uuid) from public;
grant execute on function public.marketplace_offre_stock_disponible(uuid, uuid) to anon, authenticated;

comment on function public.marketplace_offre_stock_disponible(uuid, uuid) is
  'Quantité vendable Marketplace : offres de pharmacies actives, visibles, non-demo et non archivées; lots non bloqués/non périmés ou stock agrégé non périmé, moins les holds actifs non consommés et non restaurés.';

commit;
