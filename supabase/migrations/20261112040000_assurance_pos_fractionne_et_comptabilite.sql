-- Paiement fractionné Marketplace Assurance : client + créance assureur.
-- La vente reste au montant brut ; seuls les paiements réellement encaissés alimentent la caisse.
create or replace function public.vente_reservation_encaisser(
  p_reservation uuid,p_session uuid,p_montant_percu integer,p_canal text,p_code_paiement text
) returns table(
  vente_id uuid,numero_vente text,total integer,monnaie_rendue integer,canal text,code_paiement text
) language plpgsql security definer set search_path=''
as $$
declare
  r public.reservations%rowtype;
  v_session public.caisses_sessions%rowtype;
  v_vente uuid;
  v_numero text;
  v_monnaie integer:=0;
  v_canal public.mode_paiement_caisse;
  v_montant_enregistre integer;
  v_snapshot public.assurance_reservation_snapshots%rowtype;
  v_dossier public.dossiers_assurance%rowtype;
  v_has_assurance boolean:=false;
  v_part_assureur bigint:=0;
  v_part_client bigint;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_reservation is null or p_session is null then raise exception 'Réservation et session de caisse requises'; end if;
  if p_code_paiement is null or length(btrim(p_code_paiement))<6 then raise exception 'Code de paiement requis'; end if;
  if p_montant_percu is null or p_montant_percu<0 then raise exception 'Montant perçu invalide'; end if;
  if p_canal not in ('especes','orange_money','mtn_momo','mobile_money','carte','autre') then raise exception 'Canal de paiement non pris en charge'; end if;
  v_canal:=p_canal::public.mode_paiement_caisse;

  select * into r from public.reservations where id=p_reservation for update;
  if not found then raise exception 'Réservation introuvable'; end if;
  if r.mode<>'reservation' then raise exception 'Seules les réservations avec retrait en pharmacie sont encaissables ici'; end if;
  if upper(btrim(r.code_paiement))<>upper(btrim(p_code_paiement)) then raise exception 'Code de paiement incorrect'; end if;
  if r.statut<>'confirmee' then raise exception 'La réservation doit être confirmée par la pharmacie avant encaissement'; end if;
  if r.expires_at<=now() then raise exception 'Réservation expirée : aucun encaissement ne peut être effectué'; end if;
  if r.paiement_statut='effectue' then raise exception 'Cette réservation est déjà marquée comme payée'; end if;
  if not public.naxa_caisse_actor_for_pharmacy(r.pharmacie_id) then raise exception 'Encaissement réservé à un compte Caisse actif de cette pharmacie'; end if;

  select cs.* into v_session
  from public.caisses_sessions cs join public.caisses c on c.id=cs.caisse_id
  where cs.id=p_session and cs.statut='ouverte' and cs.ouvert_par=auth.uid()
    and c.actif=true and c.pharmacie_id=r.pharmacie_id
  for update of cs;
  if not found then raise exception 'Session ouverte introuvable ou hors pharmacie'; end if;
  if exists(select 1 from public.ventes v where v.reservation_id=r.id) then raise exception 'Une vente POS est déjà liée à cette réservation'; end if;

  select coalesce(sum(ri.quantite*ri.prix_unitaire),0)::integer into v_montant_enregistre
  from public.reservation_items ri where ri.reservation_id=r.id;
  if not exists(select 1 from public.reservation_items ri where ri.reservation_id=r.id) then raise exception 'Réservation sans articles'; end if;
  if v_montant_enregistre<>r.total then raise exception 'Le total des articles ne correspond pas au total de la réservation'; end if;

  select * into v_snapshot from public.assurance_reservation_snapshots s
  where s.reservation_id=r.id for update;
  v_has_assurance:=found;
  select * into v_dossier from public.dossiers_assurance d
  where d.reservation_id=r.id and d.pharmacie_id=r.pharmacie_id for update;
  if v_has_assurance and not found then raise exception 'Snapshot Assurance sans dossier correspondant'; end if;
  if not v_has_assurance and found then raise exception 'Dossier Assurance sans snapshot financier'; end if;

  if v_has_assurance then
    if not v_snapshot.valide_client then raise exception 'Accord client Assurance obligatoire'; end if;
    if v_snapshot.controle_documents_statut<>'conforme' then raise exception 'Contrôle conforme des justificatifs obligatoire'; end if;
    if v_dossier.statut not in ('accepte','clos') then raise exception 'Prise en charge assureur non confirmée par la pharmacie'; end if;
    if v_dossier.vente_id is not null then raise exception 'Dossier Assurance déjà lié à une vente'; end if;
    if v_snapshot.montant_brut_fcfa<>r.total
      or round(v_dossier.montant_total)::bigint<>v_snapshot.montant_brut_fcfa
      or round(v_dossier.montant_prise_en_charge)::bigint<>v_snapshot.montant_assureur_fcfa
      or round(v_dossier.montant_client)::bigint<>v_snapshot.montant_client_fcfa
      or v_snapshot.montant_assureur_fcfa+v_snapshot.montant_client_fcfa<>v_snapshot.montant_brut_fcfa then
      raise exception 'Incohérence des montants entre réservation, devis et dossier Assurance';
    end if;
    v_part_assureur:=v_snapshot.montant_assureur_fcfa;
    v_part_client:=v_snapshot.montant_client_fcfa::bigint;
  else
    v_part_client:=r.total::bigint;
  end if;

  if p_canal='especes' then
    if p_montant_percu<v_part_client then raise exception 'Montant espèces insuffisant pour le reste à payer client'; end if;
    v_monnaie:=p_montant_percu-v_part_client;
  else
    if p_montant_percu<>v_part_client then raise exception 'Le montant reçu doit être exactement égal à la part client figée'; end if;
  end if;

  insert into public.ventes(
    pharmacie_id,caisse_session_id,client_id,statut,remise,total_brut,total_net,created_by,reservation_id
  ) values(r.pharmacie_id,p_session,r.client_id,'brouillon',0,r.total,r.total,auth.uid(),r.id)
  returning id into v_vente;

  insert into public.vente_lignes(vente_id,produit_id,quantite,prix_unitaire)
  select v_vente,ri.produit_id,ri.quantite,ri.prix_unitaire
  from public.reservation_items ri where ri.reservation_id=r.id order by ri.produit_id;

  if v_has_assurance and v_part_assureur>0 then
    perform public.vente_payer_assurance(v_vente,v_dossier.id,v_part_assureur::integer);
  end if;
  if v_part_client>0 then
    insert into public.vente_paiements(
      vente_id,mode,montant,reference,created_by,montant_percu,monnaie_rendue
    ) values(
      v_vente,v_canal,v_part_client::integer,'Marketplace NAXA · '||upper(r.code_paiement),
      auth.uid(),p_montant_percu,v_monnaie
    );
  end if;

  -- Finalizer checks the sum of client payment + insurer receivable = gross sale.
  perform public.vente_finaliser(v_vente);

  update public.reservations
  set paiement_mode=case when p_canal='especes' then 'especes_retrait' else p_canal end,
      paiement_ref='Marketplace NAXA · '||upper(r.code_paiement)
  where id=r.id;
  perform public.set_reservation_status(r.id,'payee'::public.resa_statut);

  select v.numero_vente into v_numero from public.ventes v where v.id=v_vente;
  return query select v_vente,v_numero,r.total,v_monnaie,p_canal,upper(r.code_paiement);
end
$$;

-- Vérifie les trois montants réels avant de laisser clôturer une vente Assurance.
create or replace function private.assurance_lier_vente_reservation()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_dossier public.dossiers_assurance%rowtype;
  v_snapshot public.assurance_reservation_snapshots%rowtype;
  v_part_client bigint;
  v_part_assureur bigint;
begin
  if new.reservation_id is null then return new; end if;
  select * into v_dossier from public.dossiers_assurance d
  where d.reservation_id=new.reservation_id and d.pharmacie_id=new.pharmacie_id
  for update;
  if not found then return new; end if;

  select * into v_snapshot from public.assurance_reservation_snapshots s
  where s.reservation_id=new.reservation_id for update;
  if not found then raise exception 'Dossier Assurance sans snapshot : vente bloquée'; end if;

  if new.statut='payee' then
    if not v_snapshot.valide_client or v_snapshot.controle_documents_statut<>'conforme'
      or v_dossier.statut not in ('accepte','clos') then
      raise exception 'Accord client, justificatifs conformes et prise en charge confirmée obligatoires';
    end if;
    if new.total_brut<>v_snapshot.montant_brut_fcfa
      or new.total_net<>v_snapshot.montant_brut_fcfa then
      raise exception 'Total brut POS différent du devis Assurance figé';
    end if;
    select coalesce(sum(vp.montant),0)::bigint into v_part_assureur
    from public.vente_paiements vp
    where vp.vente_id=new.id and vp.reference like 'ASSURANCE:%';
    select coalesce(sum(vp.montant),0)::bigint into v_part_client
    from public.vente_paiements vp
    where vp.vente_id=new.id and coalesce(vp.reference,'') not like 'ASSURANCE:%';
    if v_part_assureur<>v_snapshot.montant_assureur_fcfa
      or v_part_client<>v_snapshot.montant_client_fcfa
      or v_part_assureur+v_part_client<>new.total_net then
      raise exception 'Répartition POS incohérente : part client + part assureur doit égaler le brut';
    end if;
  end if;

  update public.dossiers_assurance d set vente_id=new.id
  where d.id=v_dossier.id and (d.vente_id is null or d.vente_id=new.id);
  if not found then raise exception 'Dossier Assurance déjà rattaché à une autre vente'; end if;

  if new.statut='payee' then
    insert into public.assurance_evenements(
      pharmacie_id,reservation_id,dossier_id,assureur_id,acteur_id,type,montant_fcfa,details
    ) values(
      new.pharmacie_id,new.reservation_id,v_dossier.id,v_snapshot.assureur_id,new.created_by,
      'vente_assurance_enregistree',v_snapshot.montant_brut_fcfa,
      jsonb_build_object('vente_id',new.id,'part_client_fcfa',v_snapshot.montant_client_fcfa,
        'part_assureur_fcfa',v_snapshot.montant_assureur_fcfa)
    ) on conflict do nothing;

    if v_snapshot.montant_assureur_fcfa>0 then
      insert into public.compta_evenement(
        pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,donnees,statut
      ) values(
        new.pharmacie_id,'assurance_prise_en_charge','dossier_assurance',v_dossier.id::text,
        'assurance-prise-en-charge:'||v_dossier.id::text,coalesce(new.paid_at,now()),
        jsonb_build_object('date_comptable',timezone('Africa/Douala',coalesce(new.paid_at,now()))::date::text,
          'montant_fcfa',v_snapshot.montant_assureur_fcfa,
          'reference_source',coalesce(v_dossier.reference_externe,v_dossier.id::text),
          'dossier_id',v_dossier.id::text,'assureur_id',v_snapshot.assureur_id::text,
          'vente_id',new.id::text),
        'a_traiter'
      ) on conflict(pharmacie_id,cle_idempotence) do nothing;
    end if;
  end if;
  return new;
end
$$;

-- L'événement de vente ne comptabilise que le paiement client.
-- La part assureur est reconnue séparément comme créance à la vente finalisée.
create or replace function public.compta_emettre_evenement_metier()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_type text; v_source text; v_source_id text; v_date timestamptz;
  v_date_comptable date; v_montant bigint; v_ref text; v_vente_id uuid; v_demande_id uuid;
begin
  if tg_table_name='ventes' then
    if new.statut::text='annulee' and old.statut::text='payee' then
      select d.id into v_demande_id from public.vente_annulation_demandes d
      where d.vente_id=new.id and d.statut='approuvee'
      order by d.decidee_at desc nulls last,d.created_at desc limit 1;
      if v_demande_id is null then raise exception 'Annulation comptable impossible : approbation absente'; end if;
      v_type:='vente_annulee';v_source:='vente_annulation';v_source_id:=v_demande_id::text;
      v_date:=clock_timestamp();v_date_comptable:=timezone('Africa/Douala',v_date)::date;
      v_montant:=new.total_net::bigint;v_ref:=new.numero_vente;v_vente_id:=new.id;
    elsif new.statut::text='payee' and old.statut::text<>'payee' then
      v_type:='vente_encaissee';v_source:='vente';v_source_id:=new.id::text;
      v_date:=coalesce(new.paid_at,new.created_at,clock_timestamp());
      v_date_comptable:=timezone('Africa/Douala',v_date)::date;v_ref:=new.numero_vente;v_vente_id:=new.id;
      select coalesce(sum(vp.montant),0)::bigint into v_montant
      from public.vente_paiements vp
      where vp.vente_id=new.id and coalesce(vp.reference,'') not like 'ASSURANCE:%';
    else
      return new;
    end if;
  elsif tg_table_name='depenses' then
    if new.statut::text<>'validee' or old.statut::text='validee' then return new; end if;
    v_type:='depense_validee';v_source:='depense';v_source_id:=new.id::text;
    v_date:=coalesce(new.validated_at,new.created_at,clock_timestamp());
    v_date_comptable:=new.date_depense;v_montant:=new.montant::bigint;
    v_ref:=coalesce(nullif(trim(new.reference),''),new.id::text);
  else
    raise exception 'Source d''événement comptable non prise en charge';
  end if;
  if v_montant is null or v_montant<=0 then return new; end if;
  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,donnees
  ) values(
    new.pharmacie_id,v_type,v_source,v_source_id,v_source||':'||v_source_id||':'||v_type,
    v_date,jsonb_build_object('montant_fcfa',v_montant::text,'date_comptable',v_date_comptable::text,
      'reference_source',v_ref) ||
      case when v_type='vente_annulee'
        then jsonb_build_object('vente_id',v_vente_id,'annulation_demande_id',v_demande_id)
        else '{}'::jsonb end
  ) on conflict(pharmacie_id,cle_idempotence) do nothing;
  return new;
end
$$;

-- La prise en charge confirmée n'est pas encore un produit vendu.
-- L'événement comptable de créance sera créé par le trigger POS au paiement effectif.
create or replace function public.assurance_confirmer_prise_en_charge(p_dossier uuid,p_reference text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=auth.uid(); v_d public.dossiers_assurance%rowtype;
  v_s public.assurance_reservation_snapshots%rowtype;
begin
  select * into v_d from public.dossiers_assurance where id=p_dossier for update;
  if not found or not private.naxa_scope_allows(v_uid,v_d.pharmacie_id,'PHARMACIE')
    or private.naxa_business_function(v_uid) not in ('promoteur','pharmacien','responsable','caisse') then
    raise exception 'Dossier inaccessible ou poste non autorisé';
  end if;
  select * into v_s from public.assurance_reservation_snapshots where reservation_id=v_d.reservation_id for update;
  if not found or not v_s.valide_client or v_s.controle_documents_statut<>'conforme' then
    raise exception 'Accord client et contrôle conforme des justificatifs obligatoires';
  end if;
  if v_d.statut<>'soumis' then raise exception 'Dossier non soumis ou déjà traité'; end if;
  if round(v_d.montant_total)::bigint<>v_s.montant_brut_fcfa
    or round(v_d.montant_prise_en_charge)::bigint<>v_s.montant_assureur_fcfa
    or round(v_d.montant_client)::bigint<>v_s.montant_client_fcfa then
    raise exception 'Montants du dossier différents du devis figé';
  end if;
  update public.dossiers_assurance set statut='accepte',
    reference_externe=nullif(trim(coalesce(p_reference,'')),''),traite_at=now()
  where id=v_d.id;
  insert into public.assurance_evenements(
    pharmacie_id,reservation_id,dossier_id,assureur_id,acteur_id,type,montant_fcfa,reference
  ) values(v_d.pharmacie_id,v_d.reservation_id,v_d.id,v_s.assureur_id,v_uid,
    'prise_en_charge_confirmee',v_s.montant_assureur_fcfa,
    nullif(trim(coalesce(p_reference,'')),'')); 
end
$$;

revoke all on function public.vente_reservation_encaisser(uuid,uuid,integer,text,text) from public,anon;
grant execute on function public.vente_reservation_encaisser(uuid,uuid,integer,text,text) to authenticated;
revoke all on function public.assurance_confirmer_prise_en_charge(uuid,text) from public,anon;
grant execute on function public.assurance_confirmer_prise_en_charge(uuid,text) to authenticated;
