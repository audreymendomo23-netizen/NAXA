-- NAXA ERP-011 / F64 — lot registration through a scoped RPC; no direct table writes.
begin;

drop policy if exists stocks_lots_equipe_insert on public.stocks_lots;
drop policy if exists stocks_lots_equipe_update on public.stocks_lots;
drop policy if exists stocks_lots_equipe_delete on public.stocks_lots;
revoke insert,update,delete on public.stocks_lots from public,anon,authenticated;
grant select on public.stocks_lots to authenticated;

create or replace function public.stock_lot_enregistrer(
  p_pharmacie uuid,
  p_produit uuid,
  p_numero_lot text,
  p_date_peremption date,
  p_quantite integer,
  p_lot_source uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_stock public.stocks%rowtype;
  v_source public.stocks_lots%rowtype;
  v_total_lots integer;
  v_user uuid:=auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if p_pharmacie is null or p_produit is null then raise exception 'Pharmacie et produit requis'; end if;
  if length(trim(coalesce(p_numero_lot,''))) not between 1 and 120 then raise exception 'Numéro de lot requis (120 caractères maximum)'; end if;
  if p_date_peremption is null then raise exception 'Date de péremption requise'; end if;
  if p_quantite is null or p_quantite<=0 then raise exception 'Quantité de lot invalide'; end if;
  if not public.can_access_pharmacy(p_pharmacie) then raise exception 'Pharmacie hors périmètre'; end if;

  select * into v_profile from public.profiles where id=v_user and actif=true;
  if not found or coalesce(v_profile.role::text,'')='caisse' or coalesce(v_profile.fonction_interne,'')='caisse'
     or not (coalesce(v_profile.role::text,'')='promoteur'
       or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable')
       or public.naxa_has_privilege('MANAGE_LOTS',p_pharmacie,'PHARMACIE')) then
    raise exception 'Gestion des lots non autorisée pour ce compte';
  end if;

  select * into v_stock from public.stocks
  where pharmacie_id=p_pharmacie and produit_id=p_produit
  for update;
  if not found then raise exception 'Produit absent du stock de la pharmacie'; end if;

  select coalesce(sum(quantite),0)::integer into v_total_lots
  from public.stocks_lots where pharmacie_id=p_pharmacie and produit_id=p_produit;

  if v_total_lots=0 then
    if p_lot_source is not null then raise exception 'Aucun lot source à répartir'; end if;
    if p_quantite<>v_stock.quantite then
      raise exception 'Le premier lot doit reprendre exactement le stock agrégé (% unités) pour éviter un stock fantôme',v_stock.quantite;
    end if;
  else
    if v_total_lots<>v_stock.quantite then
      raise exception 'Stock lotisé incohérent : lots %, stock agrégé %. Corrigez l’écart avant de créer un lot',v_total_lots,v_stock.quantite;
    end if;
    if p_lot_source is null then raise exception 'Choisissez le lot source dont une quantité sera transférée'; end if;
    select * into v_source from public.stocks_lots
    where id=p_lot_source and pharmacie_id=p_pharmacie and produit_id=p_produit
    for update;
    if not found then raise exception 'Lot source hors périmètre ou introuvable'; end if;
    if v_source.bloque then raise exception 'Impossible de répartir un lot bloqué'; end if;
    if v_source.quantite<p_quantite then raise exception 'Quantité supérieure au stock du lot source'; end if;
    update public.stocks_lots set quantite=quantite-p_quantite where id=v_source.id;
  end if;

  insert into public.stocks_lots(pharmacie_id,produit_id,lot,peremption,numero_lot,date_peremption,quantite,bloque,motif_blocage)
  values(p_pharmacie,p_produit,trim(p_numero_lot),p_date_peremption,trim(p_numero_lot),p_date_peremption,p_quantite,false,null)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.stock_lot_enregistrer(uuid,uuid,text,date,integer,uuid) from public,anon,authenticated;
grant execute on function public.stock_lot_enregistrer(uuid,uuid,text,date,integer,uuid) to authenticated;
comment on function public.stock_lot_enregistrer(uuid,uuid,text,date,integer,uuid) is
  'Enregistre un lot en conservant la quantité agrégée : premier lot reprend le stock complet, les lots suivants transfèrent une quantité depuis un lot source.';
commit;