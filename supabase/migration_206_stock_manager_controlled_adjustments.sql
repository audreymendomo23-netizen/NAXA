-- NAXA 206 — ajustement, perte et retour stock par RPC autorisée et traçable.
begin;
alter table public.stock_manager_movement_journal add column if not exists motif_operation text;

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
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
  or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
  or public.naxa_has_privilege('MANAGE_LOTS',p_pharmacie,'PHARMACIE')) then raise exception 'Mouvement de stock non autorisé'; end if;
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
comment on function public.gestionnaire_stock_quantite_ajuster(uuid,uuid,integer,text,text,uuid) is
 'Enregistre une perte, un retour ou un ajustement avec motif obligatoire; ajuste d’abord le lot puis le stock agrégé et journalise l’opération.';
commit;
