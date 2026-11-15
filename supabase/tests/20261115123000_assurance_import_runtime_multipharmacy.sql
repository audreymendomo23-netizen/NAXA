-- Runtime Replay: rapprochement assureur lié à un Responsable et à sa pharmacie affectée.
-- Un import synthétique passe par la même façade SQL que l'import UI ; aucune authentification n'est créée.
-- Toutes les couvertures, réservations, snapshots, imports et vérifications sont annulés par ROLLBACK.

begin;

create temporary table naxa_assurance_import_runtime_results (
  check_name text not null,
  result text not null,
  details jsonb not null
);
grant select,insert on pg_temp.naxa_assurance_import_runtime_results to authenticated;

do $fixtures$
declare
  v_responsable uuid;
  v_client uuid;
  v_insurer uuid;
  v_pharmacy uuid;
  v_other_pharmacy uuid;
  v_product uuid;
  v_reservation_allowed uuid;
  v_reservation_other uuid;
  v_reservation_stale uuid;
begin
  select p.id into v_responsable
  from public.profiles p
  join public.naxa_professional_assignments a
    on a.profile_id=p.id
   and a.role_code='responsable'
   and a.statut='active'
   and a.commence_at<=now()
   and (a.expire_at is null or a.expire_at>now())
  join public.pharmacies ph on ph.id=a.pharmacie_id
  where p.actif=true
    and private.naxa_business_function(p.id)='responsable'
    and ph.actif=true
    and ph.est_demo=false
    and ph.visible_recherche=false
    and ph.archivee_le is null
    and private.naxa_scope_allows(p.id,ph.id,'PHARMACIE')
  order by p.created_at,p.id,ph.id
  limit 1;

  select ph.id into v_pharmacy
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  join public.pharmacies ph on ph.id=a.pharmacie_id
  where p.id=v_responsable
    and a.role_code='responsable'
    and a.statut='active'
    and a.commence_at<=now()
    and (a.expire_at is null or a.expire_at>now())
    and ph.actif=true and ph.est_demo=false
    and ph.visible_recherche=false and ph.archivee_le is null
  order by ph.id
  limit 1;

  select p.id into v_client
  from public.profiles p
  where p.role::text='client'
    and p.actif=true
    and private.naxa_business_function(p.id)='client'
  order by p.created_at,p.id
  limit 1;

  select a.id into v_insurer
  from public.assureurs a
  where a.actif=true
  order by a.nom,a.id
  limit 1;

  select p.id into v_product
  from public.produits p
  where p.nom='Amoxicilline NAXA Test'
  order by p.id
  limit 1;

  select ph.id into v_other_pharmacy
  from public.pharmacies ph
  where ph.id is distinct from v_pharmacy
    and ph.actif=true
    and ph.archivee_le is null
  order by ph.id
  limit 1;

  if v_responsable is null or v_pharmacy is null
     or v_client is null or v_insurer is null
     or v_product is null or v_other_pharmacy is null then
    raise exception 'Pré-requis Replay absents : Responsable affecté à pharmacie non commerciale cachée, Client, assureur, produit de test et autre pharmacie active requis';
  end if;

  if exists (
    select 1 from public.assurance_conventions c
    where c.pharmacie_id=v_pharmacy
      and c.assureur_id=v_insurer
      and c.reference_convention='NAXA-E2E-ROSTER-RUNTIME'
  ) then
    raise exception 'La convention runtime existe déjà ; ne pas superposer une fixture';
  end if;

  if exists (
    select 1 from public.couvertures_assurance c
    where c.client_id=v_client
      and c.assureur_id=v_insurer
      and c.numero_adherent='NAXA-E2E-ROSTER-RUNTIME'
  ) then
    raise exception 'La couverture runtime existe déjà ; ne pas superposer une fixture';
  end if;

  insert into public.reservations(
    client_id,pharmacie_id,statut,total,mode,paiement_statut,stock_decremented
  ) values
    (v_client,v_pharmacy,'en_attente',10000,'reservation','a_verifier',false),
    (v_client,v_other_pharmacy,'en_attente',10000,'reservation','a_verifier',false),
    (v_client,v_pharmacy,'en_attente',10000,'reservation','a_verifier',false)
  returning id into v_reservation_allowed;

  -- Retrieve all three IDs in insertion order to avoid direct reliance on table ordering.
  select r.id into v_reservation_allowed
  from public.reservations r
  where r.client_id=v_client
    and r.pharmacie_id=v_pharmacy
    and r.total=10000
    and r.stock_decremented=false
    and r.created_at >= transaction_timestamp()
  order by r.created_at,r.id
  limit 1;

  select r.id into v_reservation_stale
  from public.reservations r
  where r.client_id=v_client
    and r.pharmacie_id=v_pharmacy
    and r.total=10000
    and r.stock_decremented=false
    and r.created_at >= transaction_timestamp()
    and r.id<>v_reservation_allowed
  order by r.created_at,r.id
  limit 1;

  select r.id into v_reservation_other
  from public.reservations r
  where r.client_id=v_client
    and r.pharmacie_id=v_other_pharmacy
    and r.total=10000
    and r.stock_decremented=false
    and r.created_at >= transaction_timestamp()
  order by r.created_at,r.id
  limit 1;

  if v_reservation_allowed is null or v_reservation_stale is null or v_reservation_other is null then
    raise exception 'Les trois réservations de recette ne sont pas disponibles';
  end if;

  insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
  values
    (v_reservation_allowed,v_product,1,10000),
    (v_reservation_other,v_product,1,10000),
    (v_reservation_stale,v_product,1,10000);

  perform set_config('naxa.test.roster.responsable',v_responsable::text,true);
  perform set_config('naxa.test.roster.client',v_client::text,true);
  perform set_config('naxa.test.roster.insurer',v_insurer::text,true);
  perform set_config('naxa.test.roster.pharmacy',v_pharmacy::text,true);
  perform set_config('naxa.test.roster.other_pharmacy',v_other_pharmacy::text,true);
  perform set_config('naxa.test.roster.reservation_allowed',v_reservation_allowed::text,true);
  perform set_config('naxa.test.roster.reservation_other',v_reservation_other::text,true);
  perform set_config('naxa.test.roster.reservation_stale',v_reservation_stale::text,true);

  insert into pg_temp.naxa_assurance_import_runtime_results
  values (
    'Fixture Responsable et réservations sans mouvement de stock',
    'PASS',
    jsonb_build_object(
      'responsable_scope',true,
      'pharmacy_noncommercial_hidden',true,
      'reservations_created',3,
      'stock_decremented',false,
      'product_is_existing_test_fixture',true
    )
  );
end
$fixtures$;

set local role authenticated;

-- Le Client saisit sa couverture : aucune autorisation n'est déduite de la saisie seule.
select set_config('request.jwt.claims',
  jsonb_build_object('role','authenticated','sub',current_setting('naxa.test.roster.client'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('naxa.test.roster.client'),true);
select set_config('request.jwt.claim.role','authenticated',true);

do $client_declaration$
declare
  v_coverage uuid;
  v_client uuid:=current_setting('naxa.test.roster.client')::uuid;
  v_insurer uuid:=current_setting('naxa.test.roster.insurer')::uuid;
begin
  v_coverage:=public.assurance_enregistrer_couverture(
    v_insurer,
    'NAXA-E2E-ROSTER-RUNTIME',
    'NAXA-E2E-ROSTER-POLICY',
    current_date,
    current_date+30,
    null,
    100
  );
  if not exists (
    select 1 from public.couvertures_assurance c
    where c.id=v_coverage and c.client_id=v_client
      and c.verification_statut='non_verifiee'
  ) then
    raise exception 'La couverture déclarée doit démarrer non vérifiée';
  end if;

  perform set_config('naxa.test.roster.coverage',v_coverage::text,true);
  insert into pg_temp.naxa_assurance_import_runtime_results
  values (
    'Déclaration Client distincte de la vérification assureur',
    'PASS',
    jsonb_build_object('coverage_created',true,'initial_status','non_verifiee')
  );
end
$client_declaration$;

-- Le Responsable existant configure la convention et applique une liste complète simulée.
select set_config('request.jwt.claims',
  jsonb_build_object('role','authenticated','sub',current_setting('naxa.test.roster.responsable'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('naxa.test.roster.responsable'),true);
select set_config('request.jwt.claim.role','authenticated',true);

do $responsable_import$
declare
  v_responsable uuid:=current_setting('naxa.test.roster.responsable')::uuid;
  v_pharmacy uuid:=current_setting('naxa.test.roster.pharmacy')::uuid;
  v_insurer uuid:=current_setting('naxa.test.roster.insurer')::uuid;
  v_coverage uuid:=current_setting('naxa.test.roster.coverage')::uuid;
  v_convention uuid;
  v_import jsonb;
  v_applied jsonb;
  v_import_id uuid;
  v_verified integer;
  v_status text;
  v_adherent text:='NAXA-E2E-ROSTER-RUNTIME';
  v_policy text:='NAXA-E2E-ROSTER-POLICY';
  v_sha text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
begin
  if private.naxa_business_function(v_responsable)<>'responsable'
     or not private.naxa_scope_allows(v_responsable,v_pharmacy,'PHARMACIE') then
    raise exception 'Le rôle actif Responsable ne possède plus le périmètre requis';
  end if;

  v_convention:=public.assurance_configurer_convention(
    v_pharmacy,
    v_insurer,
    'NAXA-E2E-ROSTER-RUNTIME',
    current_date,
    null,
    60,
    null,
    0
  );
  if v_convention is null then
    raise exception 'Convention runtime non créée par le Responsable autorisé';
  end if;

  v_import:=public.assurance_import_simuler_mode(
    v_pharmacy,
    v_insurer,
    'NAXA-E2E-ROSTER-RUNTIME-SOURCE',
    'naxa-e2e-roster-runtime.csv',
    v_sha,
    jsonb_build_array(jsonb_build_object(
      'numero_adherent',v_adherent,
      'numero_police',v_policy,
      'beneficiaire_nom',null,
      'date_debut',current_date::text,
      'date_fin',(current_date+30)::text,
      'statut','actif'
    )),
    'complet'
  );

  v_import_id:=(v_import->>'import_id')::uuid;
  if (v_import->>'correspondances')::integer<>1
     or (v_import->>'invalides')::integer<>0
     or (v_import->>'ambiguite')::integer<>0
     or (v_import->>'doublons')::integer<>0 then
    raise exception 'Simulation de la liste : correspondance unique attendue, résultat %',v_import;
  end if;

  v_applied:=public.assurance_import_appliquer(v_import_id);
  if v_applied->>'statut'<>'appliquee'
     or (v_applied->>'couvertures_appliquees')::integer<>1 then
    raise exception 'Application de la liste non conforme : %',v_applied;
  end if;

  select count(*),max(v.statut) into v_verified,v_status
  from public.assurance_couverture_verifications v
  where v.couverture_id=v_coverage
    and v.pharmacie_id=v_pharmacy
    and v.import_id=v_import_id;

  if v_verified<>1 or v_status<>'verifiee' then
    raise exception 'La vérification par pharmacie est absente : count %, statut %',v_verified,v_status;
  end if;

  perform set_config('naxa.test.roster.import_id',v_import_id::text,true);
  perform set_config('naxa.test.roster.convention_id',v_convention::text,true);

  insert into pg_temp.naxa_assurance_import_runtime_results
  values (
    'Responsable : convention, simulation et application complète du fichier',
    'PASS',
    jsonb_build_object(
      'matches',1,
      'invalides',0,
      'ambiguites',0,
      'doublons',0,
      'applied',1,
      'verification_status',v_status,
      'mode','complet',
      'file_sha256_present',length(v_sha)=64
    )
  );
end
$responsable_import$;

-- Le Client calcule le devis uniquement dans la pharmacie dont la liste est vérifiée.
select set_config('request.jwt.claims',
  jsonb_build_object('role','authenticated','sub',current_setting('naxa.test.roster.client'))::text,true);
select set_config('request.jwt.claim.sub',current_setting('naxa.test.roster.client'),true);
select set_config('request.jwt.claim.role','authenticated',true);

do $client_quote$
declare
  v_coverage uuid:=current_setting('naxa.test.roster.coverage')::uuid;
  v_reservation uuid:=current_setting('naxa.test.roster.reservation_allowed')::uuid;
  v_other_reservation uuid:=current_setting('naxa.test.roster.reservation_other')::uuid;
  v_snapshot uuid;
  v_gross bigint;
  v_insurer bigint;
  v_client bigint;
  v_other_blocked boolean:=false;
begin
  v_snapshot:=public.assurance_calculer_devis(v_reservation,v_coverage);

  select s.montant_brut_fcfa,s.montant_assureur_fcfa,s.montant_client_fcfa
  into v_gross,v_insurer,v_client
  from public.assurance_reservation_snapshots s
  where s.id=v_snapshot;

  if v_gross<>10000 or v_insurer<>6000 or v_client<>4000 then
    raise exception 'Partage du devis inattendu : brut %, assureur %, client %',v_gross,v_insurer,v_client;
  end if;

  begin
    perform public.assurance_calculer_devis(v_other_reservation,v_coverage);
  exception when others then
    if position(
      'Couverture non retrouvée dans une liste assureur importée pour cette pharmacie'
      in sqlerrm
    )>0 then
      v_other_blocked:=true;
    else
      raise;
    end if;
  end;

  if not v_other_blocked then
    raise exception 'La vérification propre à la pharmacie a été réutilisée dans une autre pharmacie';
  end if;

  insert into pg_temp.naxa_assurance_import_runtime_results
  values (
    'Devis Client autorisé uniquement dans la pharmacie vérifiée',
    'PASS',
    jsonb_build_object(
      'gross_fcfa',v_gross,
      'insurer_fcfa',v_insurer,
      'client_fcfa',v_client,
      'other_pharmacy_blocked',v_other_blocked
    )
  );
end
$client_quote$;

-- Toute correction déclarative du Client doit invalider l'ancienne correspondance.
do $client_correction$
declare
  v_coverage uuid:=current_setting('naxa.test.roster.coverage')::uuid;
  v_client uuid:=current_setting('naxa.test.roster.client')::uuid;
  v_insurer uuid:=current_setting('naxa.test.roster.insurer')::uuid;
  v_reservation uuid:=current_setting('naxa.test.roster.reservation_stale')::uuid;
  v_existing uuid;
  v_before timestamptz;
  v_after timestamptz;
  v_blocked boolean:=false;
begin
  select c.declaration_maj_at into v_before
  from public.couvertures_assurance c
  where c.id=v_coverage and c.client_id=v_client;

  v_existing:=public.assurance_enregistrer_couverture(
    v_insurer,
    'NAXA-E2E-ROSTER-RUNTIME',
    'NAXA-E2E-ROSTER-POLICY-CORRECTED',
    current_date,
    current_date+30,
    null,
    100
  );

  if v_existing is distinct from v_coverage then
    raise exception 'La correction n''a pas mis à jour la couverture existante';
  end if;

  select c.declaration_maj_at into v_after
  from public.couvertures_assurance c
  where c.id=v_coverage and c.client_id=v_client;

  if v_before is null or v_after is null or v_after<=v_before then
    raise exception 'L''horodatage de déclaration n''a pas avancé';
  end if;

  begin
    perform public.assurance_calculer_devis(v_reservation,v_coverage);
  exception when others then
    if position(
      'Couverture non retrouvée dans une liste assureur importée pour cette pharmacie'
      in sqlerrm
    )>0 then
      v_blocked:=true;
    else
      raise;
    end if;
  end;

  if not v_blocked then
    raise exception 'Une ancienne vérification autorise encore le devis après correction de la déclaration';
  end if;

  insert into pg_temp.naxa_assurance_import_runtime_results
  values (
    'Correction Client : horodatage avancé et ancienne vérification invalidée',
    'PASS',
    jsonb_build_object(
      'timestamp_advanced',true,
      'stale_verification_blocked',v_blocked
    )
  );
end
$client_correction$;

reset role;

select check_name,result,details
from pg_temp.naxa_assurance_import_runtime_results
order by check_name;

rollback;
