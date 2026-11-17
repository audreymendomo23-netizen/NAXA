-- Un rejeu idempotent doit être porté par le même acteur et reproduire exactement les preuves visuelles.
create or replace function public.client_credit_rembourser(
  p_credit uuid,p_montant integer,p_mode public.mode_paiement_caisse,
  p_reference text,p_motif text,p_idempotency_key uuid,
  p_verification_beneficiaire boolean,p_verification_montant boolean,p_confirmation_client_vue boolean
)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare
  v_credit public.client_credits%rowtype;
  v_session uuid;
  v_compte uuid;
  v_type_compte public.tresorerie_compte_type;
  v_op uuid;
  v_existing public.client_credit_operations%rowtype;
  v_reference text;
  v_motif text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_credit is null or p_montant is null or p_montant<=0 then raise exception 'Montant ou compte crédit invalide'; end if;
  if p_idempotency_key is null then raise exception 'Clé idempotence obligatoire'; end if;
  if p_mode not in ('especes'::public.mode_paiement_caisse,'orange_money'::public.mode_paiement_caisse,'mtn_momo'::public.mode_paiement_caisse) then
    raise exception 'Canal non pris en charge pour un remboursement de crédit';
  end if;

  select * into v_credit from public.client_credits where id=p_credit for update;
  if not found then raise exception 'Crédit introuvable'; end if;
  if not v_credit.actif then raise exception 'Crédit inactif'; end if;
  if not (public.is_admin() or public.naxa_caisse_actor_for_pharmacy(v_credit.pharmacie_id)) then raise exception 'Pharmacie hors périmètre Caisse'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_credit.pharmacie_id::text || ':' || p_idempotency_key::text,0));
  v_reference := nullif(trim(p_reference),'');
  v_motif := coalesce(nullif(trim(p_motif),''),'Remboursement de crédit reçu au comptoir');

  select * into v_existing from public.client_credit_operations o
  where o.pharmacie_id=v_credit.pharmacie_id and o.idempotency_key=p_idempotency_key for update;

  if found then
    if v_existing.nature <> 'remboursement' or v_existing.credit_id <> v_credit.id
       or v_existing.montant <> p_montant or v_existing.mode_paiement is distinct from p_mode
       or v_existing.reference is distinct from v_reference or v_existing.motif is distinct from v_motif
       or v_existing.created_by <> auth.uid()
       or coalesce(v_existing.verification_beneficiaire,false) <> coalesce(p_verification_beneficiaire,false)
       or coalesce(v_existing.verification_montant,false) <> coalesce(p_verification_montant,false)
       or coalesce(v_existing.confirmation_client_vue,false) <> coalesce(p_confirmation_client_vue,false) then
      raise exception 'Clé idempotence déjà utilisée avec des paramètres différents';
    end if;
    if not exists (select 1 from public.tresorerie_mouvements m
      where m.source_type='credit_remboursement' and m.source_id=v_existing.id
        and m.pharmacie_id=v_credit.pharmacie_id and m.canal_paiement=p_mode::text) then
      raise exception 'Intégrité incomplète : mouvement de trésorerie absent pour ce remboursement';
    end if;
    return v_existing.id;
  end if;

  if p_montant>v_credit.solde then raise exception 'Remboursement supérieur au solde disponible'; end if;
  if p_mode in ('orange_money'::public.mode_paiement_caisse,'mtn_momo'::public.mode_paiement_caisse) then
    if v_reference is null then raise exception 'Référence opérateur obligatoire pour un paiement mobile'; end if;
    if p_verification_beneficiaire is distinct from true or p_verification_montant is distinct from true
       or p_confirmation_client_vue is distinct from true then
      raise exception 'Confirmez visuellement le bénéficiaire, le montant et la confirmation du client avant validation';
    end if;
  end if;

  select c.id,c.type into v_compte,v_type_compte from public.tresorerie_comptes c
  where c.pharmacie_id=v_credit.pharmacie_id and c.canal_paiement=p_mode::text and c.actif for update;
  if v_compte is null then raise exception 'Aucun compte de trésorerie actif n’est configuré pour le canal %',p_mode::text; end if;
  if (p_mode='especes' and v_type_compte <> 'especes'::public.tresorerie_compte_type)
     or (p_mode in ('orange_money','mtn_momo') and v_type_compte <> 'mobile_money'::public.tresorerie_compte_type) then
    raise exception 'Le compte de trésorerie configuré ne correspond pas au canal';
  end if;

  select s.id into v_session from public.caisses_sessions s
  join public.caisses c on c.id=s.caisse_id
  where c.pharmacie_id=v_credit.pharmacie_id and c.actif and s.statut='ouverte'
    and s.cloture_at is null and s.ouvert_par=auth.uid()
  order by s.ouvert_at desc limit 1 for update of s;
  if v_session is null then raise exception 'Ouvrez votre session de caisse dans cette pharmacie avant d’enregistrer un remboursement'; end if;

  update public.client_credits set solde=solde-p_montant,updated_at=now() where id=v_credit.id;

  insert into public.client_credit_operations(
    credit_id,pharmacie_id,client_id,nature,montant,reference,motif,created_by,
    caisse_session_id,mode_paiement,idempotency_key,verification_beneficiaire,verification_montant,
    confirmation_client_vue,verification_effectuee_par,verification_effectuee_at
  ) values (
    v_credit.id,v_credit.pharmacie_id,v_credit.client_id,'remboursement',p_montant,
    v_reference,v_motif,auth.uid(),v_session,p_mode,p_idempotency_key,
    coalesce(p_verification_beneficiaire,false),coalesce(p_verification_montant,false),coalesce(p_confirmation_client_vue,false),
    case when p_mode in ('orange_money'::public.mode_paiement_caisse,'mtn_momo'::public.mode_paiement_caisse) then auth.uid() else null end,
    case when p_mode in ('orange_money'::public.mode_paiement_caisse,'mtn_momo'::public.mode_paiement_caisse) then clock_timestamp() else null end
  ) returning id into v_op;

  insert into public.tresorerie_mouvements(
    pharmacie_id,compte_id,nature,montant,libelle,reference,source_type,source_id,created_by,canal_paiement,origine
  ) values (
    v_credit.pharmacie_id,v_compte,'encaissement',p_montant,'Remboursement crédit client · ' || p_mode::text,
    v_reference,'credit_remboursement',v_op,auth.uid(),p_mode::text,'comptoir'
  );
  return v_op;
end;
$function$;
