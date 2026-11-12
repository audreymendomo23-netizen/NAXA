-- L'offre publique ne doit jamais exposer une pharmacie de démonstration ou archivée.
begin;
CREATE OR REPLACE FUNCTION public.marketplace_offre_stock_disponible(p_pharmacie uuid, p_produit uuid)
 RETURNS TABLE(prix integer, quantite integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_stock public.stocks%rowtype;
  v_has_lots boolean;
  v_disponible integer;
  v_reserve integer;
  v_last_stock_update timestamptz;
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
    and ph.est_demo = false
    and ph.archivee_le is null;

  if not found then
    return;
  end if;

  -- Exactement 48 h reste admissible ; sans mouvement de quantité traçable,
  -- le stock est considéré non vérifié et n'est jamais publié.
  v_last_stock_update := private.marketplace_stock_last_quantity_update(p_pharmacie, p_produit);
  if v_last_stock_update is null
     or v_last_stock_update < now() - interval '48 hours' then
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

  -- Les holds modernes ne débitent pas le stock physique : ils sont soustraits
  -- ici, sans double-déduction des réservations legacy déjà débitées.
  select coalesce(sum(ri.quantite), 0)::integer
    into v_reserve
  from public.reservation_items ri
  join public.reservations r on r.id = ri.reservation_id
  where r.pharmacie_id = p_pharmacie
    and ri.produit_id = p_produit
    and r.mode in ('reservation', 'commande')
    and r.statut in ('en_attente', 'confirmee')
    and r.expires_at > now()
    and r.consumed_at is null
    and coalesce(r.stock_restored, false) = false
    and coalesce(r.stock_decremented, false) = false;

  return query
    select v_stock.prix, greatest(coalesce(v_disponible, 0) - coalesce(v_reserve, 0), 0);
end;
$function$
;
commit;
