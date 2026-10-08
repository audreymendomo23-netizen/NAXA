-- NAXA ERP-003 — POS étape 1 : lignes de vente + allocation stock/FEFO
-- Additif : complète le socle POS existant sans créer de second moteur de vente.

alter table public.vente_lignes
  add column if not exists lot_id uuid references public.stocks_lots(id) on delete restrict;

create index if not exists vente_lignes_lot_idx
  on public.vente_lignes(lot_id);

create or replace function public.vente_recalculer_totaux(p_vente uuid)
returns void
language plpgsql
security definer
set search_path=''
as $totaux$
declare v_brut integer;
begin
  select coalesce(sum(total_ligne),0) into v_brut
  from public.vente_lignes
  where vente_id=p_vente;

  update public.ventes
  set total_brut=v_brut,
      total_net=greatest(v_brut-remise,0)
  where id=p_vente;
end;
$totaux$;

create or replace function public.vente_ajouter_produit(
  p_vente uuid,
  p_produit uuid,
  p_quantite integer
)
returns integer
language plpgsql
security definer
set search_path=''
as $vente$
declare
  v_vente public.ventes%rowtype;
  v_stock public.stocks%rowtype;
  v_lot record;
  v_restant integer := p_quantite;
  v_prix integer;
  v_pris integer;
  v_total_lots integer := 0;
  v_lots_count integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_quantite is null or p_quantite <= 0 then raise exception 'Quantité invalide'; end if;

  select * into v_vente from public.ventes where id=p_vente for update;
  if not found then raise exception 'Vente introuvable'; end if;
  if v_vente.statut <> 'brouillon' then raise exception 'Vente déjà finalisée'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Vente hors périmètre';
  end if;

  select * into v_stock
  from public.stocks
  where pharmacie_id=v_vente.pharmacie_id and produit_id=p_produit
  for update;
  if not found then raise exception 'Produit absent du stock de la pharmacie'; end if;

  v_prix := v_stock.prix;

  select count(*) into v_lots_count
  from public.stocks_lots
  where pharmacie_id=v_vente.pharmacie_id
    and produit_id=p_produit;

  if v_lots_count > 0 then
    for v_lot in
      select id, quantite, date_peremption
      from public.stocks_lots
      where pharmacie_id=v_vente.pharmacie_id
        and produit_id=p_produit
        and quantite > 0
        and bloque=false
        and date_peremption >= current_date
      order by date_peremption asc, created_at asc, id asc
      for update
    loop
      exit when v_restant=0;
      v_pris := least(v_restant, v_lot.quantite);

      update public.stocks_lots
      set quantite=quantite-v_pris
      where id=v_lot.id;

      insert into public.vente_lignes(vente_id,produit_id,lot_id,quantite,prix_unitaire)
      values(p_vente,p_produit,v_lot.id,v_pris,v_prix);

      v_restant := v_restant-v_pris;
      v_total_lots := v_total_lots+v_pris;
    end loop;

    if v_restant > 0 then
      raise exception 'Stock lotisé insuffisant ou lots expirés/bloqués';
    end if;

    update public.stocks
    set quantite=quantite-p_quantite
    where pharmacie_id=v_vente.pharmacie_id
      and produit_id=p_produit
      and quantite >= p_quantite;

    if not found then
      raise exception 'Stock agrégé insuffisant';
    end if;
  else
    update public.stocks
    set quantite=quantite-p_quantite
    where pharmacie_id=v_vente.pharmacie_id
      and produit_id=p_produit
      and quantite >= p_quantite;

    if not found then raise exception 'Stock insuffisant'; end if;

    insert into public.vente_lignes(vente_id,produit_id,quantite,prix_unitaire)
    values(p_vente,p_produit,p_quantite,v_prix);
  end if;

  perform public.vente_recalculer_totaux(p_vente);
  return p_quantite;
exception
  when others then
    -- Toute erreur annule atomiquement la transaction : aucun stock/lot partiellement débité.
    raise;
end;
$vente$;

revoke all on function public.vente_recalculer_totaux(uuid) from public,anon,authenticated;
revoke all on function public.vente_ajouter_produit(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.vente_ajouter_produit(uuid,uuid,integer) to authenticated;

comment on column public.vente_lignes.lot_id is
  'Lot effectivement débité. NULL uniquement pour un stock non lotisé historique ou encore non lotisé.';

comment on function public.vente_ajouter_produit(uuid,uuid,integer) is
  'Ajoute une ligne POS et débite le stock de façon atomique. Si des lots existent, allocation FEFO excluant les lots expirés ou bloqués.';
