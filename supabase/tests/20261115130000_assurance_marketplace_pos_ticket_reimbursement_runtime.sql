-- Runtime transactionnel Marketplace Assurance -> Caisse POS -> Ticket -> remboursements.
-- Réutilise un Client et une Caisse Auth existants sur Replay, crée seulement un Responsable
-- synthétique dans la transaction, prépare stock/réservation de test, puis ROLLBACK intégral.
-- Aucun compte, stock, vente, import, remboursement ou écriture comptable n'est conservé.
begin;
select set_config('request.jwt.claim.role','service_role',true);

do $setup$
declare
  v_admin uuid;
  v_responsable uuid;
  v_cashier uuid;
  v_client uuid;
  v_insurer uuid;
  v_pharmacy uuid;
  v_register uuid;
  v_open_session uuid;
  v_reservation uuid;
  v_product uuid;
  v_code text:='AS'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
begin
  select p.id,a.pharmacie_id,c.id
    into v_cashier,v_pharmacy,v_register
  from public.profiles p
  join public.naxa_professional_assignments a
    on a.profile_id=p.id and a.role_code='caisse' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now())
  join public.pharmacies ph on ph.id=a.pharmacie_id
  join public.caisses c on c.pharmacie_id=ph.id and c.actif=true
  where p.actif=true and p.role::text='client'
    and p.pharmacie_id=ph.id
    and ph.actif=true and ph.visible_recherche=true
    and private.naxa_business_function(p.id)='caisse'
    and private.naxa_active_role_pharmacy(p.id)=ph.id
  order by p.created_at,p.id,c.id
  limit 1;

  select p.id into v_client
  from public.profiles p
  where p.actif=true and p.role::text='client'
    and private.naxa_business_function(p.id)='client'
    and p.id is distinct from v_cashier
  order by p.created_at,p.id
  limit 1;

  select a.id into v_insurer from public.assureurs a
  where a.actif=true order by a.nom,a.id limit 1;

  select p.id into v_product from public.produits p
  where p.nom='Amoxicilline NAXA Test' order by p.id limit 1;

  select cs.id into v_open_session
  from public.caisses_sessions cs
  where cs.caisse_id=v_register and cs.statut='ouverte'
  order by cs.ouvert_at desc limit 1;

  if v_cashier is null or v_client is null or v_insurer is null
     or v_pharmacy is null or v_register is null or v_product is null then
    raise exception 'Pré-requis Replay absents : Client, Caisse affectée, registre, pharmacie visible, assureur et produit de recette';
  end if;
  if exists(select 1 from public.caisses_sessions cs
    where cs.caisse_id=v_register and cs.statut='ouverte'
      and cs.ouvert_par is distinct from v_cashier) then
    raise exception 'Le registre de recette est déjà ouvert par un autre titulaire ; aucune session n''est détournée';
  end if;
  if exists(select 1 from public.stocks_lots l
    where l.pharmacie_id=v_pharmacy and l.produit_id=v_product) then
    raise exception 'Le produit de recette possède déjà des lots : le test sans lot doit utiliser une autre référence de fixture';
  end if;

  select p.id into v_admin from public.profiles p
  where p.role::text='admin' and p.actif=true order by p.created_at limit 1;
  if v_admin is null then raise exception 'Profil Admin d''audit absent'; end if;

  -- Même compte professionnel : ajout temporaire du poste Responsable, puis
  -- retour explicite au poste Caisse via la RPC standard, dans la transaction.
  v_responsable:=v_cashier;
  if not exists(select 1 from public.naxa_professional_assignments a
    where a.profile_id=v_cashier and a.pharmacie_id=v_pharmacy
      and a.role_code='responsable' and a.statut='active') then
    insert into public.naxa_professional_assignments(
      profile_id,pharmacie_id,fonction,statut,motif,commence_at,
      accorde_par,accorde_at,nature_affectation,role_code
    ) values(
      v_cashier,v_pharmacy,'responsable','active',
      'Fixture transactionnelle E2E Assurance POS',now(),
      v_admin,now(),'ordinaire','responsable'
    );
  end if;
  if private.naxa_business_function(v_cashier)<>'responsable'
     or private.naxa_active_role_pharmacy(v_cashier) is distinct from v_pharmacy then
    raise exception 'Bascule temporaire vers le rôle Responsable non appliquée';
  end if;

  -- Stock agrégé temporaire : aucune ligne de lot n'est créée.
  insert into public.stocks(pharmacie_id,produit_id,prix,quantite,date_peremption,updated_at)
  values(v_pharmacy,v_product,10000,5,current_date+30,now())
  on conflict(pharmacie_id,produit_id) do update
    set prix=excluded.prix,
        quantite=greatest(public.stocks.quantite,excluded.quantite),
        date_peremption=excluded.date_peremption,
        updated_at=now();

  insert into public.reservations(
    client_id,pharmacie_id,statut,total,expires_at,mode,paiement_statut,
    code_paiement,stock_decremented,stock_restored
  ) values(
    v_client,v_pharmacy,'confirmee',10000,now()+interval '2 hours',
    'reservation','a_verifier',v_code,false,false
  ) returning id into v_reservation;
  insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
  values(v_reservation,v_product,1,10000);

  perform set_config('naxa.test.assurance.pos.responsable',v_responsable::text,true);
  perform set_config('naxa.test.assurance.pos.cashier',v_cashier::text,true);
  perform set_config('naxa.test.assurance.pos.client',v_client::text,true);
  perform set_config('naxa.test.assurance.pos.insurer',v_insurer::text,true);
  perform set_config('naxa.test.assurance.pos.pharmacy',v_pharmacy::text,true);
  perform set_config('naxa.test.assurance.pos.register',v_register::text,true);
  perform set_config('naxa.test.assurance.pos.product',v_product::text,true);
  perform set_config('naxa.test.assurance.pos.code',v_code,true);
  perform set_config('naxa.test.assurance.pos.reservation',v_reservation::text,true);
  if v_open_session is not null then
    perform set_config('naxa.test.assurance.pos.session',v_open_session::text,true);
  end if;
end
$setup$;

-- Déclaration de couverture par le Client : ne vaut jamais vérification assureur.
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('naxa.test.assurance.pos.client'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('naxa.test.assurance.pos.client'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $client_declaration$
declare
  v_coverage uuid;
  v_member text:='NAXA-POS-RUNTIME-'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
  v_policy text:='NAXA-POS-POLICY-'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
begin
  v_coverage:=public.assurance_enregistrer_couverture(
    current_setting('naxa.test.assurance.pos.insurer')::uuid,
    v_member,v_policy,current_date,current_date+30,null,100
  );
  perform set_config('naxa.test.assurance.pos.member',v_member,true);
  perform set_config('naxa.test.assurance.pos.policy',v_policy,true);
  if not exists(select 1 from public.couvertures_assurance c
    where c.id=v_coverage and c.client_id=auth.uid()
      and c.verification_statut='non_verifiee') then
    raise exception 'La déclaration Client doit rester non vérifiée avant import';
  end if;
  perform set_config('naxa.test.assurance.pos.coverage',v_coverage::text,true);
end
$client_declaration$;

reset role;

-- Responsable affecté : convention et rapprochement strict de la liste synthétique.
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('naxa.test.assurance.pos.responsable'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('naxa.test.assurance.pos.responsable'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $responsable_import$
declare
  v_pharmacy uuid:=current_setting('naxa.test.assurance.pos.pharmacy')::uuid;
  v_insurer uuid:=current_setting('naxa.test.assurance.pos.insurer')::uuid;
  v_coverage uuid:=current_setting('naxa.test.assurance.pos.coverage')::uuid;
  v_convention uuid;
  v_simulation jsonb;
  v_applied jsonb;
  v_import uuid;
  v_sha text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
begin
  if private.naxa_business_function(auth.uid())<>'responsable'
    or not private.naxa_scope_allows(auth.uid(),v_pharmacy,'PHARMACIE') then
    raise exception 'Responsable de recette hors périmètre';
  end if;

  v_convention:=public.assurance_configurer_convention(
    v_pharmacy,v_insurer,'NAXA-POS-RUNTIME-CONVENTION',
    current_date,current_date+30,60,null,0
  );

  v_simulation:=public.assurance_import_simuler_mode(
    v_pharmacy,v_insurer,'NAXA-POS-RUNTIME-SOURCE',
    'naxa-pos-runtime.csv',v_sha,
    jsonb_build_array(jsonb_build_object(
      'numero_adherent',current_setting('naxa.test.assurance.pos.member'),
      'numero_police',current_setting('naxa.test.assurance.pos.policy'),
      'beneficiaire_nom',null,
      'date_debut',current_date::text,
      'date_fin',(current_date+30)::text,
      'statut','actif'
    )),'complet'
  );
  if (v_simulation->>'correspondances')::integer<>1
     or (v_simulation->>'invalides')::integer<>0
     or (v_simulation->>'ambiguite')::integer<>0
     or (v_simulation->>'doublons')::integer<>0 then
    raise exception 'Rapprochement assureur non unique : %, lignes %',v_simulation,
      (select jsonb_agg(jsonb_build_object('resultat',l.resultat,'motif',l.motif,'adherent',l.numero_adherent,'police',l.numero_police,'date_debut',l.date_debut,'date_fin',l.date_fin,'statut',l.membre_statut)) from public.assurance_import_lignes l where l.import_id=(v_simulation->>'import_id')::uuid);
  end if;

  v_import:=(v_simulation->>'import_id')::uuid;
  v_applied:=public.assurance_import_appliquer(v_import);
  if v_applied->>'statut'<>'appliquee'
     or (v_applied->>'couvertures_appliquees')::integer<>1 then
    raise exception 'Application liste assureur échouée : %',v_applied;
  end if;
  perform set_config('naxa.test.assurance.pos.import',v_import::text,true);
  perform set_config('naxa.test.assurance.pos.convention',v_convention::text,true);
end
$responsable_import$;

reset role;

-- Le Client obtient le devis de pharmacie vérifié et accepte le devis initial.
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('naxa.test.assurance.pos.client'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('naxa.test.assurance.pos.client'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $client_quote$
declare
  v_snapshot uuid;
  v_reservation uuid:=current_setting('naxa.test.assurance.pos.reservation')::uuid;
  v_coverage uuid:=current_setting('naxa.test.assurance.pos.coverage')::uuid;
begin
  v_snapshot:=public.assurance_calculer_devis(v_reservation,v_coverage);
  if not exists(select 1 from public.assurance_reservation_snapshots s
    where s.id=v_snapshot and s.montant_brut_fcfa=10000
      and s.montant_assureur_fcfa=6000 and s.montant_client_fcfa=4000
      and s.valide_client=false) then
    raise exception 'Partage initial 60/40 incorrect';
  end if;
  perform public.assurance_valider_devis(v_snapshot);
  perform set_config('naxa.test.assurance.pos.snapshot',v_snapshot::text,true);
end
$client_quote$;

reset role;

-- La pharmacie contrôle les pièces, propose un écart, puis le Client donne un nouvel accord.
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('naxa.test.assurance.pos.responsable'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('naxa.test.assurance.pos.responsable'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $responsable_review$
declare
  v_snapshot uuid:=current_setting('naxa.test.assurance.pos.snapshot')::uuid;
  v_dossier uuid;
  v_proposal uuid;
begin
  select d.id into v_dossier from public.dossiers_assurance d
  where d.reservation_id=current_setting('naxa.test.assurance.pos.reservation')::uuid;
  perform public.assurance_controler_documents(v_snapshot,true,jsonb_build_object('source','runtime_pos','controle','conforme'));
  v_proposal:=public.assurance_proposer_montant(v_dossier,5500,'Ajustement de prise en charge après vérification des justificatifs');
  perform set_config('naxa.test.assurance.pos.dossier',v_dossier::text,true);
  perform set_config('naxa.test.assurance.pos.proposal',v_proposal::text,true);
end
$responsable_review$;

reset role;

select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('naxa.test.assurance.pos.client'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('naxa.test.assurance.pos.client'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $client_accept$
begin
  perform public.assurance_repondre_proposition_montant(
    current_setting('naxa.test.assurance.pos.proposal')::uuid,true
  );
  if not exists(select 1 from public.dossiers_assurance d
    where d.id=current_setting('naxa.test.assurance.pos.dossier')::uuid
      and d.montant_prise_en_charge=5500 and d.montant_client=4500) then
    raise exception 'Le dossier n''a pas repris le dernier partage accepté';
  end if;
end
$client_accept$;

reset role;

select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('naxa.test.assurance.pos.responsable'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('naxa.test.assurance.pos.responsable'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $responsable_confirm$
begin
  perform public.assurance_confirmer_prise_en_charge(
    current_setting('naxa.test.assurance.pos.dossier')::uuid,'NAXA-POS-RUNTIME-ACCEPTED'
  );
end
$responsable_confirm$;

reset role;

-- La Caisse ouvre/reprend sa propre session et encaisse uniquement la part Client.
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('naxa.test.assurance.pos.cashier'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('naxa.test.assurance.pos.cashier'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

select public.naxa_select_active_role('caisse',current_setting('naxa.test.assurance.pos.pharmacy')::uuid);

do $cashier_pos$
declare
  v_session uuid;
  v_vente uuid;
  v_number text;
  v_total integer;
  v_change integer;
  v_canal text;
  v_code text;
begin
  v_session:=nullif(current_setting('naxa.test.assurance.pos.session',true),'')::uuid;
  if v_session is null then
    v_session:=public.caisse_ouvrir(current_setting('naxa.test.assurance.pos.register')::uuid,0);
  end if;
  perform set_config('naxa.test.assurance.pos.session',v_session::text,true);

  select vente_id,numero_vente,total,monnaie_rendue,canal,code_paiement
    into v_vente,v_number,v_total,v_change,v_canal,v_code
  from public.vente_reservation_encaisser(
    current_setting('naxa.test.assurance.pos.reservation')::uuid,
    v_session,5000,'especes',
    (select r.code_paiement from public.reservations r
      where r.id=current_setting('naxa.test.assurance.pos.reservation')::uuid)
  );

  if v_total<>10000 or v_change<>500 or v_canal<>'especes' then
    raise exception 'Résultat POS incohérent : total %, monnaie %, canal %',v_total,v_change,v_canal;
  end if;
  if not exists(select 1 from public.ventes v
    where v.id=v_vente and v.statut='payee' and v.total_net=10000) then
    raise exception 'Vente POS non finalisée';
  end if;
  if not exists(select 1 from public.vente_paiements p
    where p.vente_id=v_vente and p.montant=4500
      and p.reference not like 'ASSURANCE:%') then
    raise exception 'Part Client réellement encaissée incorrecte';
  end if;
  if not exists(select 1 from public.vente_paiements p
    where p.vente_id=v_vente and p.montant=5500
      and p.reference like 'ASSURANCE:%') then
    raise exception 'Créance assureur non rattachée à la vente POS';
  end if;
  if not exists(select 1 from public.dossiers_assurance d
    where d.id=current_setting('naxa.test.assurance.pos.dossier')::uuid
      and d.vente_id=v_vente) then
    raise exception 'Dossier Assurance non rattaché à la vente POS';
  end if;
  perform set_config('naxa.test.assurance.pos.vente',v_vente::text,true);
end
$cashier_pos$;

reset role;

-- Le ticket est lu par le Client propriétaire et doit afficher le partage initial et le partage accepté.
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('naxa.test.assurance.pos.client'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('naxa.test.assurance.pos.client'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $client_ticket$
declare
  v_ticket jsonb;
  v_assurance jsonb;
begin
  v_ticket:=public.get_client_reservation_ticket(
    current_setting('naxa.test.assurance.pos.reservation')::uuid
  );
  v_assurance:=v_ticket->'assurance';
  if v_ticket->'sale'->>'statut'<>'payee'
     or (v_assurance->>'montant_brut_fcfa')::bigint<>10000
     or (v_assurance->>'montant_assureur_initial_fcfa')::bigint<>6000
     or (v_assurance->>'montant_client_initial_fcfa')::bigint<>4000
     or (v_assurance->>'montant_assureur_fcfa')::bigint<>5500
     or (v_assurance->>'montant_client_fcfa')::bigint<>4500
     or v_assurance->'proposition_acceptee' is null then
    raise exception 'Ticket client : partage initial/négocié incorrect : %',v_assurance;
  end if;
end
$client_ticket$;

reset role;

-- Responsable enregistre deux règlements réellement reçus : partiel puis solde.
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('naxa.test.assurance.pos.responsable'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('naxa.test.assurance.pos.responsable'),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $responsable_repayments$
declare
  v_dossier uuid:=current_setting('naxa.test.assurance.pos.dossier')::uuid;
  v_first uuid;
  v_second uuid;
begin
  v_first:=public.assurance_enregistrer_remboursement(
    v_dossier,2000,current_date,'NAXA-POS-REMBOURSEMENT-1',null
  );
  v_second:=public.assurance_enregistrer_remboursement(
    v_dossier,3500,current_date,'NAXA-POS-REMBOURSEMENT-2',null
  );
  if v_first is null or v_second is null or v_first=v_second then
    raise exception 'Références de règlements assurance invalides';
  end if;
  if not exists(select 1 from public.dossiers_assurance d
    where d.id=v_dossier and d.montant_rembourse=5500
      and d.statut_remboursement='solde') then
    raise exception 'Créance assureur non soldée après les règlements reçus';
  end if;
  if (select count(*) from public.assurance_reglements r where r.dossier_id=v_dossier)<>2 then
    raise exception 'Les deux règlements partiel/final ne sont pas conservés';
  end if;
end
$responsable_repayments$;

reset role;

do $final_assertions$
declare
  v_pharmacy uuid:=current_setting('naxa.test.assurance.pos.pharmacy')::uuid;
  v_dossier uuid:=current_setting('naxa.test.assurance.pos.dossier')::uuid;
  v_reservation uuid:=current_setting('naxa.test.assurance.pos.reservation')::uuid;
  v_vente uuid:=current_setting('naxa.test.assurance.pos.vente')::uuid;
  v_assurance_events integer;
  v_accounting_events integer;
  v_sale_events integer;
begin
  select count(*) into v_assurance_events from public.assurance_evenements e
  where e.pharmacie_id=v_pharmacy and e.reservation_id=v_reservation
    and e.type in ('devis_calcule','reservation_assurance_validee','documents_controles',
      'montant_modifie','accord_client_obtenu','prise_en_charge_confirmee',
      'vente_assurance_enregistree','remboursement_partiel','dossier_solde');
  if v_assurance_events<9 then raise exception 'Journal Assurance incomplet : %',v_assurance_events; end if;

  select count(*) into v_accounting_events from public.compta_evenement e
  where e.pharmacie_id=v_pharmacy and (
    (e.evenement_type='assurance_prise_en_charge' and e.source_id=v_dossier::text)
    or (e.evenement_type='assurance_remboursement_recu' and e.donnees->>'dossier_id'=v_dossier::text)
  );
  if v_accounting_events<>3 then
    raise exception 'Outbox comptable Assurance attendue (créance + 2 règlements) : %',v_accounting_events;
  end if;

  select count(*) into v_sale_events from public.compta_evenement e
  where e.pharmacie_id=v_pharmacy and e.evenement_type='vente_encaissee'
    and e.source_id=v_vente::text
    and (e.donnees->>'montant_fcfa')::bigint=4500;
  if v_sale_events<>1 then
    raise exception 'Outbox vente encaissée ne doit retenir que la part client : %',v_sale_events;
  end if;

  if not exists(select 1 from public.reservations r
    where r.id=v_reservation and r.statut='payee' and r.consumed_by_vente_id=v_vente) then
    raise exception 'Réservation Marketplace non consommée par la vente POS';
  end if;
end
$final_assertions$;

rollback;

select jsonb_build_object(
 'result','assurance_marketplace_pos_ticket_reimbursement_runtime PASS',
 'scope','Client → couverture vérifiée → devis → accord → proposition → accord client → prise en charge → Caisse POS → ticket → remboursements',
 'gross_fcfa',10000,
 'insurer_fcfa',5500,
 'client_fcfa',4500,
 'cash_received_fcfa',5000,
 'cash_change_fcfa',500,
 'reimbursements_fcfa',array[2000,3500],
 'all_fixtures_rolled_back',true
) as resultat;
