-- NAXA 211 — aligner la recherche Caisse sur le stock réellement vendable.
-- Corrige aussi la vente non lotisée : un stock agrégé déjà périmé ne peut plus être débité.
begin;

create or replace function public.vente_ajouter_produit(
  p_vente uuid,
  p_produit uuid,
  p_quantite integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $vente$
declare
  v_vente public.ventes%rowtype;
  v_stock public.stocks%rowtype;
  v_lot record;
  v_restant integer := p_quantite;
  v_prix integer;
  v_pris integer;
  v_lots_count integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_quantite is null or p_quantite <= 0 then raise exception 'Quantité invalide'; end if;

  select * into v_vente
  from public.ventes
  where id = p_vente
  for update;
  if not found then raise exception 'Vente introuvable'; end if;
  if v_vente.statut <> 'brouillon' then raise exception 'Vente déjà finalisée'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Vente hors périmètre';
  end if;

  select * into v_stock
  from public.stocks
  where pharmacie_id = v_vente.pharmacie_id
    and produit_id = p_produit
  for update;
  if not found then raise exception 'Produit absent du stock de la pharmacie'; end if;

  v_prix := v_stock.prix;

  select count(*) into v_lots_count
  from public.stocks_lots
  where pharmacie_id = v_vente.pharmacie_id
    and produit_id = p_produit;

  if v_lots_count > 0 then
    for v_lot in
      select id, quantite, date_peremption
      from public.stocks_lots
      where pharmacie_id = v_vente.pharmacie_id
        and produit_id = p_produit
        and quantite > 0
        and bloque = false
        and date_peremption >= current_date
      order by date_peremption asc, created_at asc, id asc
      for update
    loop
      exit when v_restant = 0;
      v_pris := least(v_restant, v_lot.quantite);

      update public.stocks_lots
      set quantite = quantite - v_pris
      where id = v_lot.id;

      insert into public.vente_lignes(vente_id, produit_id, lot_id, quantite, prix_unitaire)
      values(p_vente, p_produit, v_lot.id, v_pris, v_prix);

      v_restant := v_restant - v_pris;
    end loop;

    if v_restant > 0 then
      raise exception 'Stock lotisé insuffisant ou lots expirés/bloqués';
    end if;

    update public.stocks
    set quantite = quantite - p_quantite
    where pharmacie_id = v_vente.pharmacie_id
      and produit_id = p_produit
      and quantite >= p_quantite;
    if not found then raise exception 'Stock agrégé insuffisant'; end if;
  else
    if v_stock.date_peremption is not null and v_stock.date_peremption < current_date then
      raise exception 'Stock périmé : vente refusée';
    end if;

    update public.stocks
    set quantite = quantite - p_quantite
    where pharmacie_id = v_vente.pharmacie_id
      and produit_id = p_produit
      and quantite >= p_quantite;
    if not found then raise exception 'Stock insuffisant'; end if;

    insert into public.vente_lignes(vente_id, produit_id, quantite, prix_unitaire)
    values(p_vente, p_produit, p_quantite, v_prix);
  end if;

  perform public.vente_recalculer_totaux(p_vente);
  return p_quantite;
end;
$vente$;

revoke all on function public.vente_ajouter_produit(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.vente_ajouter_produit(uuid, uuid, integer) to authenticated;

create or replace function public.caisse_rechercher_produit(
  p_pharmacie uuid,
  p_code_barre text default null,
  p_recherche text default null
)
returns table(
  produit_id uuid,
  nom text,
  dosage text,
  conditionnement text,
  code_barre text,
  prix integer,
  quantite integer,
  emplacement text
)
language plpgsql
security definer
set search_path = ''
as $lookup$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(p_pharmacie)) then
    raise exception 'Pharmacie hors périmètre';
  end if;

  return query
  select p.id, p.nom, p.dosage, p.conditionnement, p.code_barre,
         s.prix, avail.quantite, s.emplacement
  from public.produits p
  join public.stocks s on s.produit_id = p.id and s.pharmacie_id = p_pharmacie
  cross join lateral public.marketplace_offre_stock_disponible(p_pharmacie, p.id) avail
  where
    (
      nullif(trim(coalesce(p_code_barre, '')), '') is not null
      and p.code_barre = trim(p_code_barre)
    )
    or
    (
      nullif(trim(coalesce(p_recherche, '')), '') is not null
      and (
        lower(p.nom) like '%' || lower(trim(p_recherche)) || '%'
        or lower(coalesce(p.reference_catalogue, '')) like '%' || lower(trim(p_recherche)) || '%'
        or lower(coalesce(p.code_barre, '')) like '%' || lower(trim(p_recherche)) || '%'
      )
    )
  order by p.nom
  limit 50;
end;
$lookup$;

create or replace function public.caisse_rechercher_codes(
  p_pharmacie uuid,
  p_codes text[]
)
returns table(
  code_barre text,
  produit_id uuid,
  nom text,
  dosage text,
  prix integer,
  quantite integer,
  emplacement text
)
language plpgsql
security definer
set search_path = ''
as $bulk$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(p_pharmacie)) then
    raise exception 'Pharmacie hors périmètre';
  end if;

  return query
  select p.code_barre, p.id, p.nom, p.dosage, s.prix, avail.quantite, s.emplacement
  from public.produits p
  join public.stocks s on s.produit_id = p.id and s.pharmacie_id = p_pharmacie
  cross join lateral public.marketplace_offre_stock_disponible(p_pharmacie, p.id) avail
  where p.code_barre = any(coalesce(p_codes, array[]::text[]))
  order by array_position(p_codes, p.code_barre);
end;
$bulk$;

revoke all on function public.caisse_rechercher_produit(uuid, text, text) from public, anon, authenticated;
revoke all on function public.caisse_rechercher_codes(uuid, text[]) from public, anon, authenticated;
grant execute on function public.caisse_rechercher_produit(uuid, text, text) to authenticated;
grant execute on function public.caisse_rechercher_codes(uuid, text[]) to authenticated;

commit;
