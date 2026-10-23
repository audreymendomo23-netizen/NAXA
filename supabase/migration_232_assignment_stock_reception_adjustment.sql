-- NAXA 232 — compléter les gardes des RPC Stock sans élargir le périmètre Marketplace.
-- Seules les affectations actives dans la pharmacie cible autorisent les opérations Stock.
begin;
create or replace function public.naxa_stock_manager_actor(p_pharmacie uuid)
returns boolean language sql stable security definer set search_path=''
as $f$
 select auth.uid() is not null
 and public.naxa_scope_allows(auth.uid(),p_pharmacie,'PHARMACIE')
 and exists(select 1 from public.profiles p where p.id=auth.uid() and p.actif=true
  and (coalesce(p.role::text,'') in ('admin','promoteur')
   or coalesce(p.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
   or public.naxa_has_active_professional_assignment(auth.uid(),p_pharmacie,'gestionnaire_stock')
   or public.naxa_has_active_professional_assignment(auth.uid(),p_pharmacie,'magasinier')));
$f$;
revoke all on function public.naxa_stock_manager_actor(uuid) from public,anon;
grant execute on function public.naxa_stock_manager_actor(uuid) to authenticated;
create or replace function public.fournisseur_reception_enregistrer(
 p_commande uuid,p_lignes jsonb,p_reference text default null,p_commentaire text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare
 v_user uuid:=auth.uid(); v_order public.commandes_fournisseurs%rowtype; v_profile public.profiles%rowtype;
 v_reception uuid; v_lot_id uuid; v_line record; v_order_line public.commandes_fournisseurs_lignes%rowtype;
 v_stock public.stocks%rowtype; v_lot_total integer; v_qty integer; v_numero text; v_exp date; v_emplacement text;
 v_total integer:=0; v_remaining integer; v_all_received boolean;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_lignes is null or jsonb_typeof(p_lignes) is distinct from 'array' or jsonb_array_length(p_lignes)=0 then raise exception 'Au moins une ligne de réception est requise'; end if;
 if jsonb_array_length(p_lignes)>100 then raise exception 'Une réception est limitée à 100 lignes'; end if;
 if char_length(trim(coalesce(p_reference,'')))>100 or char_length(trim(coalesce(p_commentaire,'')))>500 then raise exception 'Référence ou commentaire trop long'; end if;
 select * into v_order from public.commandes_fournisseurs where id=p_commande for update;
 if not found or not public.naxa_scope_allows(v_user,v_order.pharmacie_id,'PHARMACIE') then raise exception 'Commande hors périmètre ou introuvable'; end if;
 if v_order.statut not in ('envoyee','partielle') then raise exception 'La commande doit être envoyée avant sa réception'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
  or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
  or public.naxa_has_privilege('MANAGE_LOTS',v_order.pharmacie_id,'PHARMACIE')
  or public.naxa_has_active_professional_assignment(v_user,v_order.pharmacie_id,'gestionnaire_stock')
  or public.naxa_has_active_professional_assignment(v_user,v_order.pharmacie_id,'magasinier')) then raise exception 'Réception non autorisée'; end if;

 insert into public.receptions_fournisseurs(commande_id,pharmacie_id,reference_reception,recu_par,commentaire)
 values(p_commande,v_order.pharmacie_id,nullif(trim(coalesce(p_reference,'')),''),v_user,nullif(trim(coalesce(p_commentaire,'')),''))
 returning id into v_reception;

 for v_line in select value from jsonb_array_elements(p_lignes) order by value->>'commande_ligne_id' loop
  if coalesce(v_line.value->>'commande_ligne_id','') !~* '^[0-9a-f-]{36}$' then raise exception 'Ligne de commande invalide'; end if;
  v_qty:=nullif(v_line.value->>'quantite_recue','')::integer;
  v_numero:=trim(coalesce(v_line.value->>'numero_lot',''));
  v_exp:=nullif(v_line.value->>'date_peremption','')::date;
  v_emplacement:=nullif(trim(coalesce(v_line.value->>'emplacement','')),'');
  if v_qty is null or v_qty<=0 then continue; end if;
  if length(v_numero)=0 or length(v_numero)>120 or v_exp is null then raise exception 'Numéro de lot et péremption sont obligatoires pour chaque quantité reçue'; end if;
  if v_exp < current_date then raise exception 'Date de péremption invalide'; end if;
  select * into v_order_line from public.commandes_fournisseurs_lignes
   where id=(v_line.value->>'commande_ligne_id')::uuid and commande_id=p_commande for update;
  if not found then raise exception 'Ligne absente de cette commande'; end if;
  v_remaining:=v_order_line.quantite_commandee-v_order_line.quantite_recue;
  if v_qty>v_remaining then raise exception 'Quantité reçue supérieure au reliquat commandé'; end if;
  select * into v_stock from public.stocks where pharmacie_id=v_order.pharmacie_id and produit_id=v_order_line.produit_id for update;
  if not found then raise exception 'Le produit doit d’abord être initialisé dans le stock de la pharmacie'; end if;
  select coalesce(sum(quantite),0)::integer into v_lot_total from public.stocks_lots
   where pharmacie_id=v_order.pharmacie_id and produit_id=v_order_line.produit_id;
  if v_lot_total=0 and v_stock.quantite<>0 then
   raise exception 'Stock existant non lotisé : réconciliez les lots avant la réception pour éviter un stock fantôme';
  end if;
  if v_lot_total<>v_stock.quantite then
   raise exception 'Stock et lots incohérents pour le produit : réconciliez avant réception';
  end if;
  -- D'abord les lots, ensuite le total agrégé : le garde de cohérence compare
  -- stocks.quantite à la somme des lots au moment de l'UPDATE du stock.
  insert into public.stocks_lots(pharmacie_id,produit_id,lot,peremption,numero_lot,date_peremption,quantite,bloque,motif_blocage,emplacement)
  values(v_order.pharmacie_id,v_order_line.produit_id,v_numero,v_exp,v_numero,v_exp,v_qty,false,null,v_emplacement)
  on conflict (pharmacie_id,produit_id,numero_lot) where numero_lot is not null do update
    set quantite=public.stocks_lots.quantite+excluded.quantite,
        emplacement=coalesce(excluded.emplacement,public.stocks_lots.emplacement),
        updated_at=now()
    where public.stocks_lots.date_peremption=excluded.date_peremption
      and not public.stocks_lots.bloque
  returning id into v_lot_id;
  if not found then raise exception 'Lot existant bloqué ou avec une péremption différente : réception refusée'; end if;
  update public.stocks set quantite=quantite+v_qty where pharmacie_id=v_order.pharmacie_id and produit_id=v_order_line.produit_id;
  update public.commandes_fournisseurs_lignes set quantite_recue=quantite_recue+v_qty where id=v_order_line.id;
  insert into public.receptions_fournisseurs_lignes(reception_id,commande_ligne_id,quantite_recue)
  values(v_reception,v_order_line.id,v_qty);
  v_total:=v_total+v_qty;
 end loop;
 if v_total=0 then raise exception 'Aucune quantité reçue : réception annulée'; end if;
 select not exists(select 1 from public.commandes_fournisseurs_lignes where commande_id=p_commande and quantite_recue<quantite_commandee)
 into v_all_received;
 update public.commandes_fournisseurs set statut=case when v_all_received then 'recue' else 'partielle' end,
  date_reception=case when v_all_received then now() else date_reception end,updated_at=now()
 where id=p_commande;
 return v_reception;
end;
$function$;
revoke all on function public.fournisseur_reception_enregistrer(uuid,jsonb,text,text) from public,anon;
grant execute on function public.fournisseur_reception_enregistrer(uuid,jsonb,text,text) to authenticated;
create or replace function public.gestionnaire_stock_quantite_ajuster(
 p_pharmacie uuid,p_produit uuid,p_delta integer,p_type text,p_motif text,p_lot uuid default null
) returns boolean language plpgsql security definer set search_path=''
as $function$
declare
 v_user uuid:=auth.uid(); v_profile public.profiles%rowtype; v_stock integer;
 v_has_lots boolean; v_lot_total integer; v_lot_quantite integer; v_lot_pharmacie uuid; v_lot_produit uuid; v_bloque boolean;
 v_motif text:=nullif(trim(coalesce(p_motif,'')),'');
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_delta is null or p_delta=0 or p_delta < -1000000 or p_delta > 1000000 then raise exception 'Variation entière comprise entre -1 000 000 et +1 000 000 requise'; end if;
 if p_type is null or p_type not in ('perte','retour','ajustement') then raise exception 'Type de mouvement invalide'; end if;
 if p_type='perte' and p_delta>=0 then raise exception 'Une perte doit avoir une variation négative'; end if;
 if p_type='retour' and p_delta<=0 then raise exception 'Un retour doit avoir une variation positive'; end if;
 if v_motif is null or char_length(v_motif)<3 or char_length(v_motif)>500 then raise exception 'Un motif de 3 à 500 caractères est obligatoire'; end if;
 if not public.naxa_scope_allows(v_user,p_pharmacie,'PHARMACIE') then raise exception 'Pharmacie hors périmètre'; end if;
 if not exists(select 1 from public.pharmacies p where p.id=p_pharmacie and p.actif=true and p.archivee_le is null) then raise exception 'Pharmacie inactive ou archivée'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
  or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
  or public.naxa_has_privilege('MANAGE_LOTS',p_pharmacie,'PHARMACIE')
  or public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'gestionnaire_stock')
  or public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'magasinier')) then raise exception 'Mouvement de stock non autorisé'; end if;
 select s.quantite into v_stock from public.stocks s where s.pharmacie_id=p_pharmacie and s.produit_id=p_produit for update;
 if not found then raise exception 'Référence absente du stock : initialisez-la avant le mouvement'; end if;
 if v_stock+p_delta<0 then raise exception 'Quantité insuffisante pour cette variation'; end if;
 select exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=p_pharmacie and sl.produit_id=p_produit) into v_has_lots;
 if v_has_lots then
  select coalesce(sum(sl.quantite),0)::integer into v_lot_total from public.stocks_lots sl where sl.pharmacie_id=p_pharmacie and sl.produit_id=p_produit;
  if v_lot_total<>v_stock then raise exception 'Stock agrégé et lots incohérents : réconciliation requise avant mouvement'; end if;
 end if;
 perform pg_catalog.set_config('naxa.stock_motif',v_motif,true);
 if v_has_lots then
  if p_lot is null then raise exception 'Cette référence est lotisée : choisissez le lot concerné'; end if;
  select sl.quantite,sl.pharmacie_id,sl.produit_id,sl.bloque into v_lot_quantite,v_lot_pharmacie,v_lot_produit,v_bloque
   from public.stocks_lots sl where sl.id=p_lot for update;
  if not found or v_lot_pharmacie<>p_pharmacie or v_lot_produit<>p_produit then raise exception 'Lot absent ou hors référence/pharmacie'; end if;
  if v_lot_quantite+p_delta<0 then raise exception 'Variation supérieure à la quantité du lot'; end if;
  update public.stocks_lots set quantite=quantite+p_delta,updated_at=now() where id=p_lot;
  update public.stocks set quantite=quantite+p_delta where pharmacie_id=p_pharmacie and produit_id=p_produit;
 else
  if p_lot is not null then raise exception 'Cette référence n’a pas de lots : mouvement agrégé uniquement'; end if;
  update public.stocks set quantite=quantite+p_delta where pharmacie_id=p_pharmacie and produit_id=p_produit;
 end if;
 return true;
end;
$function$;
revoke all on function public.gestionnaire_stock_quantite_ajuster(uuid,uuid,integer,text,text,uuid) from public,anon;
grant execute on function public.gestionnaire_stock_quantite_ajuster(uuid,uuid,integer,text,text,uuid) to authenticated;
commit;
