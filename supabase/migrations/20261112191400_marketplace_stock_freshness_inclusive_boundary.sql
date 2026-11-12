-- Seuil inclusif : un stock horodaté exactement à T-48 h reste admissible.
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
    and ph.visible_recherche = true;

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
CREATE OR REPLACE FUNCTION private.reserve_stock(p_pharmacie uuid, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  it jsonb;
  v_total integer := 0;
  v_prix integer;
  v_q integer;
  v_produit uuid;
  v_stock integer;
  v_available integer;
  v_stock_updated_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from public.pharmacies where id=p_pharmacie and actif) then
    raise exception 'Pharmacie indisponible';
  end if;
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 10 then
    raise exception 'Panier invalide';
  end if;
  if exists(
    select 1
    from (select value->>'produit_id' pid, count(*) n
          from jsonb_array_elements(p_items) group by value->>'produit_id') x
    where x.n > 1
  ) then raise exception 'Produit dupliqué dans le panier'; end if;

  -- Verrouillage déterministe, puis contrôle fraîcheur + stock sous le même verrou.
  for it in
    select value from jsonb_array_elements(p_items)
    order by (value->>'produit_id')::uuid
  loop
    v_produit := (it->>'produit_id')::uuid;
    v_q := coalesce((it->>'quantite')::integer, 1);
    if v_q < 1 or v_q > 10 then raise exception 'Quantité invalide'; end if;

    select s.quantite, s.prix
      into v_stock, v_prix
    from public.stocks s
    where s.pharmacie_id=p_pharmacie and s.produit_id=v_produit
      and (s.date_peremption is null or s.date_peremption >= current_date)
    for update;
    if not found then raise exception 'Produit absent ou périmé'; end if;
    v_stock_updated_at := private.marketplace_stock_last_quantity_update(p_pharmacie, v_produit);
    if v_stock_updated_at is null
       or v_stock_updated_at < now() - interval '48 hours' then
      raise exception 'Stock non actualisé depuis plus de 48 heures : produit indisponible sur le Marketplace';
    end if;

    select o.prix, o.quantite
      into v_prix, v_available
    from public.marketplace_offre_stock_disponible(p_pharmacie, v_produit) o;
    if not found then
      raise exception 'Produit indisponible sur le Marketplace';
    end if;
    if v_available < v_q then
      raise exception 'Stock disponible insuffisant après réservations actives';
    end if;
    v_total := v_total + v_prix * v_q;
  end loop;

  insert into public.reservations(client_id,pharmacie_id,expires_at,stock_decremented,stock_restored)
  values(auth.uid(),p_pharmacie,now()+interval '3 hours',false,false)
  returning id into v_id;

  for it in
    select value from jsonb_array_elements(p_items)
    order by (value->>'produit_id')::uuid
  loop
    v_produit := (it->>'produit_id')::uuid;
    v_q := coalesce((it->>'quantite')::integer,1);
    select s.prix into v_prix from public.stocks s
      where s.pharmacie_id=p_pharmacie and s.produit_id=v_produit;
    insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
    values(v_id,v_produit,v_q,v_prix);
  end loop;

  update public.reservations set total=v_total where id=v_id;
  return v_id;
end;
$function$
;
commit;
