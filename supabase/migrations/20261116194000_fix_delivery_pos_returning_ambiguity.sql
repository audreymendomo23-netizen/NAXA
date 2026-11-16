-- NAXA — qualifier le RETURNING de la vente POS de livraison.
-- Le nom de sortie numero_vente entre en conflit avec la colonne de ventes.
BEGIN;
CREATE OR REPLACE FUNCTION public.naxa_delivery_pos_encaisser(p_reservation uuid, p_session uuid, p_montant_percu integer, p_canal text, p_code_paiement text, p_reference text DEFAULT NULL::text)
 RETURNS TABLE(vente_id uuid, numero_vente text, total integer, monnaie_rendue integer, canal text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_r public.reservations%rowtype;
  v_session public.caisses_sessions%rowtype;
  v_record public.naxa_delivery_payment_records%rowtype;
  v_sale uuid;
  v_number text;
  v_due integer;
  v_change integer:=0;
  v_mode public.mode_paiement_caisse;
  v_expected_channel text;
  v_existing uuid;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_reservation is null or p_session is null or p_code_paiement is null then
    raise exception 'Commande, session et code de paiement requis';
  end if;
  if p_montant_percu is null or p_montant_percu<=0 then raise exception 'Montant encaissé invalide'; end if;
  if p_canal not in ('especes','orange_money','mtn_momo','mobile_money') then
    raise exception 'Canal de paiement non pris en charge';
  end if;
  v_mode:=p_canal::public.mode_paiement_caisse;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.mode<>'commande' or v_r.livraison_confirmee_stock_at is null
    or v_r.commande_statut not in ('acceptee','preparation','livreur_assigne','en_livraison')
    or v_r.statut in ('annulee','expiree','retiree') then
    raise exception 'Commande non éligible à un encaissement Livraison';
  end if;
  if upper(btrim(v_r.code_paiement))<>upper(btrim(p_code_paiement)) then
    raise exception 'Code de commande incorrect';
  end if;
  if not public.naxa_caisse_actor_for_pharmacy(v_r.pharmacie_id) then
    raise exception 'Encaissement réservé à la Caisse active de cette pharmacie';
  end if;
  select cs.* into v_session
  from public.caisses_sessions cs join public.caisses c on c.id=cs.caisse_id
  where cs.id=p_session and cs.statut='ouverte' and cs.ouvert_par=v_uid
    and c.actif=true and c.pharmacie_id=v_r.pharmacie_id
  for update of cs;
  if not found then raise exception 'Session Caisse ouverte introuvable ou hors pharmacie'; end if;
  select * into v_record from public.naxa_delivery_payment_records
  where reservation_id=v_r.id for update;
  if not found then raise exception 'Déclaration de paiement ou de remise espèces absente'; end if;
  if v_record.status='paid' then raise exception 'Paiement déjà validé'; end if;

  v_due:=v_r.total+v_r.frais_livraison;
  if p_canal='especes' then
    if v_r.paiement_mode is distinct from 'especes_livraison' or v_record.status<>'cash_declared'
      or v_record.cash_received is null or p_montant_percu<>v_record.cash_received
      or p_montant_percu<v_due then
      raise exception 'Les espèces doivent avoir été déclarées par le Livreur et rapprochées exactement';
    end if;
    v_change:=p_montant_percu-v_due;
    v_expected_channel:='especes';
  else
    v_expected_channel:=case when p_canal='mtn_momo' then 'mtn_marchand'
      when p_canal='orange_money' then 'orange_money' else 'mobile_money' end;
    if v_r.paiement_mode is distinct from v_expected_channel or v_record.status<>'declared'
      or v_record.reference is null
      or upper(btrim(v_record.reference))<>upper(btrim(coalesce(p_reference,'')))
      or upper(btrim(coalesce(v_r.paiement_ref,'')))<>upper(btrim(coalesce(p_reference,'')))
      or p_montant_percu<>v_due then
      raise exception 'Référence, canal ou montant ne correspond pas à la déclaration du Client';
    end if;
  end if;
  if exists(select 1 from public.ventes v where v.reservation_id=v_r.id) then
    raise exception 'Une vente est déjà liée à cette commande';
  end if;

  insert into public.ventes AS v(
    pharmacie_id,caisse_session_id,client_id,statut,remise,total_brut,total_net,
    frais_livraison,created_by,reservation_id,stock_decremented_at_draft
  ) values(
    v_r.pharmacie_id,p_session,v_r.client_id,'brouillon',0,v_r.total,v_due,
    v_r.frais_livraison,v_uid,v_r.id,true
  ) returning v.id,v.numero_vente into v_sale,v_number;

  insert into public.vente_lignes(vente_id,produit_id,quantite,prix_unitaire)
  select v_sale,ri.produit_id,ri.quantite,ri.prix_unitaire
  from public.reservation_items ri
  where ri.reservation_id=v_r.id
  order by ri.produit_id;

  insert into public.vente_paiements(
    vente_id,mode,montant,reference,created_by,montant_percu,monnaie_rendue
  ) values(
    v_sale,v_mode,v_due,
    coalesce(nullif(trim(p_reference),''),'Livraison espèces déclarée par le Livreur'),
    v_uid,p_montant_percu,v_change
  );

  update public.ventes set
    statut='payee',mode_paiement=v_mode,
    paiement_ref=coalesce(nullif(trim(p_reference),''),'Livraison espèces'),
    paid_at=now()
  where id=v_sale and statut='brouillon';
  if not found then raise exception 'La vente de livraison n’a pas pu être finalisée'; end if;

  update public.naxa_delivery_payment_records
  set status='paid',validated_by=v_uid,validated_at=now(),
      caisse_session_id=p_session,vente_id=v_sale,
      cash_change=v_change,updated_at=now()
  where id=v_record.id;

  update public.reservations set
    paiement_statut='effectue',
    paiement_montant_percu=p_montant_percu,
    paiement_monnaie_rendue=v_change,
    paiement_valide_at=now(),
    paiement_ticket_numero=v_number
  where id=v_r.id;
  perform public.set_reservation_status(v_r.id,'payee'::public.resa_statut);
  perform private.naxa_delivery_finalize_if_confirmed((select id from public.naxa_delivery_missions where reservation_id=v_r.id));

  insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
  values(v_r.client_id,'delivery_payment_confirmed','Paiement de livraison confirmé',
    'La pharmacie a validé votre paiement. Votre reçu est disponible dans le suivi de commande.',
    v_r.id,v_sale);
  return query select v_sale,v_number,v_due,v_change,p_canal;
end;
$function$
;
COMMIT;
