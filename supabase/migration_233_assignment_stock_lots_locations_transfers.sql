-- NAXA 233 — gardes d'affectation des autres opérations Stock/Lots.
-- Les affectations sont vérifiées séparément sur chaque pharmacie; aucune RPC Marketplace partenaire n'est modifiée.
begin;
create or replace function public.stock_emplacement_modifier(p_pharmacie uuid,p_produit uuid,p_emplacement text)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_profile public.profiles%rowtype;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_emplacement is not null and char_length(trim(p_emplacement))>160 then raise exception 'Emplacement limité à 160 caractères'; end if;
 if not public.naxa_scope_allows(v_user,p_pharmacie,'PHARMACIE') and not public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'gestionnaire_stock') and not public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'magasinier') then raise exception 'Pharmacie hors périmètre'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
   or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
   or public.naxa_has_privilege('MANAGE_LOTS',p_pharmacie,'PHARMACIE')
    or public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'gestionnaire_stock')
    or public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'magasinier')) then
  raise exception 'Modification d’emplacement non autorisée';
 end if;
 update public.stocks set emplacement=nullif(trim(coalesce(p_emplacement,'')),'')
 where pharmacie_id=p_pharmacie and produit_id=p_produit;
 if not found then raise exception 'Ligne de stock introuvable'; end if;
 return true;
end;
$function$;

create or replace function public.stock_lot_emplacement_modifier(p_lot uuid,p_emplacement text)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_pharmacie uuid; v_user uuid:=auth.uid(); v_profile public.profiles%rowtype;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_emplacement is not null and char_length(trim(p_emplacement))>160 then raise exception 'Emplacement limité à 160 caractères'; end if;
 select pharmacie_id into v_pharmacie from public.stocks_lots where id=p_lot;
 if v_pharmacie is null or (not public.naxa_scope_allows(v_user,v_pharmacie,'PHARMACIE') and not public.naxa_has_active_professional_assignment(v_user,v_pharmacie,'gestionnaire_stock') and not public.naxa_has_active_professional_assignment(v_user,v_pharmacie,'magasinier')) then raise exception 'Lot hors périmètre ou introuvable'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
   or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
   or public.naxa_has_privilege('MANAGE_LOTS',v_pharmacie,'PHARMACIE')
    or public.naxa_has_active_professional_assignment(v_user,v_pharmacie,'gestionnaire_stock')
    or public.naxa_has_active_professional_assignment(v_user,v_pharmacie,'magasinier')) then
  raise exception 'Modification d’emplacement non autorisée';
 end if;
 update public.stocks_lots set emplacement=nullif(trim(coalesce(p_emplacement,'')),'') where id=p_lot;
 return true;
end;
$function$;

create or replace function public.gestionnaire_stock_service_ouvrir(p_pharmacie uuid)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_profile public.profiles%rowtype; v_id uuid;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if not public.naxa_scope_allows(v_user,p_pharmacie,'PHARMACIE') and not public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'gestionnaire_stock') and not public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'magasinier') then raise exception 'Pharmacie hors périmètre'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur') or coalesce(v_profile.fonction_interne,'') in ('gestionnaire_stock','magasinier','pharmacien','pharmacien_assistant','responsable')
   or public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'gestionnaire_stock')
   or public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'magasinier')) then raise exception 'Rôle Gestionnaire de stock requis'; end if;
 if exists(select 1 from public.gestionnaire_stock_sessions where pharmacie_id=p_pharmacie and user_id=v_user and ended_at is null) then raise exception 'Un service est déjà ouvert pour ce compte'; end if;
 insert into public.gestionnaire_stock_sessions(pharmacie_id,user_id) values(p_pharmacie,v_user) returning id into v_id;
 return v_id;
end;
$function$;

create or replace function public.stock_lot_blocage_modifier(p_lot uuid,p_bloque boolean,p_motif text default null)
returns boolean language plpgsql security definer set search_path=''
as $f$
declare v_user uuid:=auth.uid(); v_pharmacie uuid; v_profile public.profiles%rowtype; v_motif text;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_bloque is null then raise exception 'État de blocage requis'; end if;
 v_motif:=nullif(trim(coalesce(p_motif,'')),'');
 if p_bloque and (v_motif is null or char_length(v_motif)>500) then raise exception 'Un motif de blocage de 1 à 500 caractères est requis'; end if;
 select pharmacie_id into v_pharmacie from public.stocks_lots where id=p_lot for update;
 if v_pharmacie is null or (not public.naxa_scope_allows(v_user,v_pharmacie,'PHARMACIE') and not public.naxa_has_active_professional_assignment(v_user,v_pharmacie,'gestionnaire_stock') and not public.naxa_has_active_professional_assignment(v_user,v_pharmacie,'magasinier')) then raise exception 'Lot hors périmètre ou introuvable'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
   or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
   or public.naxa_has_privilege('MANAGE_LOTS',v_pharmacie,'PHARMACIE')
    or public.naxa_has_active_professional_assignment(v_user,v_pharmacie,'gestionnaire_stock')
    or public.naxa_has_active_professional_assignment(v_user,v_pharmacie,'magasinier')) then raise exception 'Gestion des lots non autorisée'; end if;
 update public.stocks_lots set bloque=p_bloque,motif_blocage=case when p_bloque then v_motif else null end,updated_at=now()
 where id=p_lot and pharmacie_id=v_pharmacie;
 return found;
end;
$f$;

create or replace function public.gestionnaire_stock_reference_initialiser(
 p_pharmacie uuid,p_produit uuid,p_prix integer,p_emplacement text default null
) returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_profile public.profiles%rowtype;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_prix is null or p_prix<0 then raise exception 'Prix de vente invalide'; end if;
 if p_emplacement is not null and char_length(trim(p_emplacement))>160 then raise exception 'Emplacement limité à 160 caractères'; end if;
 if not public.naxa_scope_allows(v_user,p_pharmacie,'PHARMACIE') and not public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'gestionnaire_stock') and not public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'magasinier') then raise exception 'Pharmacie hors périmètre'; end if;
 if not exists(select 1 from public.pharmacies p where p.id=p_pharmacie and p.actif=true and p.archivee_le is null) then raise exception 'Pharmacie inactive ou archivée'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
  or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
  or public.naxa_has_privilege('MANAGE_LOTS',p_pharmacie,'PHARMACIE')
   or public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'gestionnaire_stock')
   or public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'magasinier')) then raise exception 'Initialisation de stock non autorisée'; end if;
 if not exists(select 1 from public.produits p where p.id=p_produit) then raise exception 'Produit catalogue introuvable'; end if;
 insert into public.stocks(pharmacie_id,produit_id,prix,quantite,emplacement)
 values(p_pharmacie,p_produit,p_prix,0,nullif(trim(coalesce(p_emplacement,'')),''));
 if not found then raise exception 'Référence non initialisée'; end if;
 return true;
exception when unique_violation then
 raise exception 'Cette référence existe déjà dans le stock de cette pharmacie';
end;
$function$;

create or replace function public.gestionnaire_stock_transfert_atomique(
 p_source uuid,p_destination uuid,p_produit uuid,p_quantite integer,p_lot uuid,p_motif text
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare
 v_user uuid:=auth.uid(); v_profile public.profiles%rowtype;
 v_source_stock public.stocks%rowtype; v_destination_stock public.stocks%rowtype;
 v_source_exists boolean:=false; v_destination_exists boolean:=false;
 v_source_has_lots boolean; v_destination_has_lots boolean;
 v_source_lot public.stocks_lots%rowtype; v_destination_lot public.stocks_lots%rowtype;
 v_source_lot_sum integer; v_destination_lot_sum integer;
 v_destination_lot_id uuid; v_transfer uuid;
 v_motif text:=nullif(trim(coalesce(p_motif,'')),'');
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_source is null or p_destination is null or p_source=p_destination then raise exception 'Deux pharmacies différentes sont requises'; end if;
 if p_quantite is null or p_quantite<1 or p_quantite>1000000 then raise exception 'Quantité de transfert invalide'; end if;
 if v_motif is null or char_length(v_motif)<3 or char_length(v_motif)>500 then raise exception 'Un motif de transfert de 3 à 500 caractères est obligatoire'; end if;
 if (not public.naxa_scope_allows(v_user,p_source,'PHARMACIE') and not public.naxa_has_active_professional_assignment(v_user,p_source,'gestionnaire_stock') and not public.naxa_has_active_professional_assignment(v_user,p_source,'magasinier'))
   or (not public.naxa_scope_allows(v_user,p_destination,'PHARMACIE') and not public.naxa_has_active_professional_assignment(v_user,p_destination,'gestionnaire_stock') and not public.naxa_has_active_professional_assignment(v_user,p_destination,'magasinier')) then raise exception 'Les deux pharmacies doivent appartenir au périmètre autorisé'; end if;
 if (select count(*) from public.pharmacies p where p.id in (p_source,p_destination) and p.actif=true and p.archivee_le is null)<>2 then raise exception 'Une des pharmacies est inactive ou archivée'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
  or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
  or (public.naxa_has_privilege('MANAGE_LOTS',p_source,'PHARMACIE') and public.naxa_has_privilege('MANAGE_LOTS',p_destination,'PHARMACIE'))
   or ((public.naxa_has_active_professional_assignment(v_user,p_source,'gestionnaire_stock') or public.naxa_has_active_professional_assignment(v_user,p_source,'magasinier'))
    and (public.naxa_has_active_professional_assignment(v_user,p_destination,'gestionnaire_stock') or public.naxa_has_active_professional_assignment(v_user,p_destination,'magasinier')))) then raise exception 'Transfert non autorisé'; end if;

 -- Verrouiller les lignes agrégées dans un ordre stable avant toute ligne de lot.
 perform 1 from public.stocks s where s.pharmacie_id in (p_source,p_destination) and s.produit_id=p_produit order by s.pharmacie_id for update;
 select * into v_source_stock from public.stocks s where s.pharmacie_id=p_source and s.produit_id=p_produit;
 v_source_exists:=found;
 if not v_source_exists then raise exception 'Référence source absente du stock'; end if;
 select * into v_destination_stock from public.stocks s where s.pharmacie_id=p_destination and s.produit_id=p_produit;
 v_destination_exists:=found;
 if v_source_stock.quantite<p_quantite then raise exception 'Stock source insuffisant'; end if;
 select exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=p_source and sl.produit_id=p_produit) into v_source_has_lots;
 select exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=p_destination and sl.produit_id=p_produit) into v_destination_has_lots;

 if v_source_has_lots then
  if p_lot is null then raise exception 'Choisissez le lot source à transférer'; end if;
  select * into v_source_lot from public.stocks_lots sl
   where sl.id=p_lot and sl.pharmacie_id=p_source and sl.produit_id=p_produit for update;
  if not found then raise exception 'Lot source introuvable'; end if;
  if v_source_lot.bloque or v_source_lot.date_peremption is null or v_source_lot.date_peremption<current_date then raise exception 'Un lot bloqué, périmé ou sans date ne peut pas être transféré'; end if;
  if nullif(trim(v_source_lot.numero_lot),'') is null then raise exception 'Le lot source doit avoir un numéro traçable avant transfert'; end if;
  if v_source_lot.quantite<p_quantite then raise exception 'Quantité du lot source insuffisante'; end if;
  select coalesce(sum(sl.quantite),0)::integer into v_source_lot_sum from public.stocks_lots sl where sl.pharmacie_id=p_source and sl.produit_id=p_produit;
  if v_source_lot_sum<>v_source_stock.quantite then raise exception 'Stock source et lots incohérents'; end if;
  if v_destination_has_lots then
   if not v_destination_exists then raise exception 'Des lots destination existent sans ligne de stock : réconciliation requise'; end if;
   select coalesce(sum(sl.quantite),0)::integer into v_destination_lot_sum from public.stocks_lots sl where sl.pharmacie_id=p_destination and sl.produit_id=p_produit;
   if v_destination_lot_sum<>v_destination_stock.quantite then raise exception 'Stock destination et lots incohérents'; end if;
  elsif v_destination_exists and v_destination_stock.quantite<>0 then
   raise exception 'La destination contient un stock non lotisé : réconciliation requise avant transfert';
  end if;
 else
  if p_lot is not null then raise exception 'La référence source n’est pas lotisée'; end if;
  if v_destination_has_lots then raise exception 'La destination est lotisée alors que la source ne l’est pas'; end if;
 end if;

 perform pg_catalog.set_config('naxa.stock_motif','Transfert '||p_source::text||' vers '||p_destination::text||' : '||v_motif,true);
 if not v_destination_exists then
  insert into public.stocks(pharmacie_id,produit_id,prix,quantite)
   values(p_destination,p_produit,v_source_stock.prix,0)
   returning * into v_destination_stock;
  v_destination_exists:=true;
 end if;

 if v_source_has_lots then
  update public.stocks_lots set quantite=quantite-p_quantite,updated_at=now() where id=p_lot;
  if v_destination_has_lots then
   select * into v_destination_lot from public.stocks_lots sl
    where sl.pharmacie_id=p_destination and sl.produit_id=p_produit and sl.numero_lot=v_source_lot.numero_lot for update;
   if found then
    if v_destination_lot.date_peremption is distinct from v_source_lot.date_peremption or v_destination_lot.bloque then raise exception 'Le lot de destination a une péremption différente ou est bloqué'; end if;
    update public.stocks_lots set quantite=quantite+p_quantite,updated_at=now() where id=v_destination_lot.id returning id into v_destination_lot_id;
   else
    insert into public.stocks_lots(pharmacie_id,produit_id,lot,peremption,numero_lot,date_peremption,quantite,bloque,motif_blocage,emplacement)
    values(p_destination,p_produit,v_source_lot.numero_lot,v_source_lot.date_peremption,v_source_lot.numero_lot,v_source_lot.date_peremption,p_quantite,false,null,null)
    returning id into v_destination_lot_id;
   end if;
  else
   insert into public.stocks_lots(pharmacie_id,produit_id,lot,peremption,numero_lot,date_peremption,quantite,bloque,motif_blocage,emplacement)
   values(p_destination,p_produit,v_source_lot.numero_lot,v_source_lot.date_peremption,v_source_lot.numero_lot,v_source_lot.date_peremption,p_quantite,false,null,null)
   returning id into v_destination_lot_id;
  end if;
 end if;
 update public.stocks set quantite=quantite-p_quantite where pharmacie_id=p_source and produit_id=p_produit;
 update public.stocks set quantite=quantite+p_quantite where pharmacie_id=p_destination and produit_id=p_produit;

 insert into public.stock_manager_transfers(source_pharmacie_id,destination_pharmacie_id,produit_id,source_lot_id,destination_lot_id,numero_lot,quantite,motif,acteur_id)
 values(p_source,p_destination,p_produit,case when v_source_has_lots then p_lot else null end,v_destination_lot_id,
  case when v_source_has_lots then v_source_lot.numero_lot else null end,p_quantite,v_motif,v_user)
 returning id into v_transfer;
 return v_transfer;
end;
$function$;
commit;
