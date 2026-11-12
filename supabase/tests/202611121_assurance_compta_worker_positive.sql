-- NAXA Assurance — recette positive du worker comptable.
-- Fixtures synthétiques et transactionnelles : aucun compte/mapping réel n'est créé.
-- Couvre prise en charge, remboursement partiel, remboursement final et idempotence.
begin;
select set_config('request.jwt.claim.role','service_role',true);

do $assurance_worker$
declare
  v_pharmacie uuid;
  v_actor uuid := gen_random_uuid();
  v_username text := 'assurance_cpta_' || substr(replace(gen_random_uuid()::text,'-',''),1,16);
  v_periode uuid := gen_random_uuid();
  v_receivable uuid := gen_random_uuid();
  v_revenue uuid := gen_random_uuid();
  v_bank uuid := gen_random_uuid();
  v_event_prise uuid;
  v_event_partiel uuid;
  v_event_solde uuid;
  v_events uuid[];
  v_row record;
  v_result text;
  v_processed integer := 0;
  v_entry_prise uuid;
  v_entry_partiel uuid;
  v_entry_solde uuid;
  v_count integer;
  v_debit bigint;
  v_credit bigint;
  v_receivable_debit bigint;
  v_receivable_credit bigint;
begin
  select id into v_pharmacie from public.pharmacies order by id limit 1;
  if v_pharmacie is null then raise exception 'Fixture pharmacie absente'; end if;

  set local session_replication_role = replica;
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values(v_actor,'authenticated','authenticated',v_username||'@invalid.local','',now(),now());
  set local session_replication_role = origin;
  insert into public.profiles(id,role,username,actif,pharmacie_id)
  values(v_actor,'admin',v_username,true,v_pharmacie);

  insert into public.compta_periodes(id,pharmacie_id,date_debut,date_fin,statut)
  values(v_periode,v_pharmacie,current_date-1,current_date+1,'ouverte');

  insert into public.compta_plan_comptable(
    id,pharmacie_id,code,libelle,classe,statut,source_validation,valide_par,valide_le
  ) values
    (v_receivable,v_pharmacie,'TST-ASS-REC-'||substr(replace(v_receivable::text,'-',''),1,8),
      'TEST — créance assureur',null,'valide','Fixture transactionnelle',v_actor,now()),
    (v_revenue,v_pharmacie,'TST-ASS-PROD-'||substr(replace(v_revenue::text,'-',''),1,8),
      'TEST — produit vente',null,'valide','Fixture transactionnelle',v_actor,now()),
    (v_bank,v_pharmacie,'TST-ASS-BQ-'||substr(replace(v_bank::text,'-',''),1,8),
      'TEST — trésorerie',null,'valide','Fixture transactionnelle',v_actor,now());

  insert into public.compta_mapping_compte(
    pharmacie_id,evenement_type,sens,compte_id,statut,valide_du,valide_par,valide_le
  ) values
    (v_pharmacie,'assurance_prise_en_charge','debit',v_receivable,'valide',current_date,v_actor,now()),
    (v_pharmacie,'assurance_prise_en_charge','credit',v_revenue,'valide',current_date,v_actor,now()),
    (v_pharmacie,'assurance_remboursement_recu','debit',v_bank,'valide',current_date,v_actor,now()),
    (v_pharmacie,'assurance_remboursement_recu','credit',v_receivable,'valide',current_date,v_actor,now());

  insert into public.compta_parametre(pharmacie_id,cle,valeur,statut,valide_du,valide_par)
  values
    (v_pharmacie,'journal_code.assurance_prise_en_charge',to_jsonb('AS'::text),'valide',current_date,v_actor),
    (v_pharmacie,'journal_code.assurance_remboursement_recu',to_jsonb('TR'::text),'valide',current_date,v_actor);

  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,donnees
  ) values (
    v_pharmacie,'assurance_prise_en_charge','dossier_assurance',gen_random_uuid()::text,
    'assurance-worker-test:prise:'||gen_random_uuid()::text,now(),
    jsonb_build_object('montant_fcfa','10000','date_comptable',to_char(current_date,'YYYY-MM-DD'),'reference_source','TEST-PRISE')
  ) returning id into v_event_prise;

  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,donnees
  ) values (
    v_pharmacie,'assurance_remboursement_recu','reglement_assurance',gen_random_uuid()::text,
    'assurance-worker-test:partiel:'||gen_random_uuid()::text,now(),
    jsonb_build_object('montant_fcfa','4000','date_comptable',to_char(current_date,'YYYY-MM-DD'),'reference_source','TEST-REMBOURSEMENT-1')
  ) returning id into v_event_partiel;

  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,donnees
  ) values (
    v_pharmacie,'assurance_remboursement_recu','reglement_assurance',gen_random_uuid()::text,
    'assurance-worker-test:solde:'||gen_random_uuid()::text,now(),
    jsonb_build_object('montant_fcfa','6000','date_comptable',to_char(current_date,'YYYY-MM-DD'),'reference_source','TEST-REMBOURSEMENT-2')
  ) returning id into v_event_solde;

  v_events := array[v_event_prise,v_event_partiel,v_event_solde];

  -- Une seconde émission avec la même clé ne doit jamais créer un doublon.
  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,donnees
  )
  select pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,
    jsonb_set(donnees,'{montant_fcfa}','"99999"'::jsonb)
  from public.compta_evenement where id=v_event_partiel
  on conflict(pharmacie_id,cle_idempotence) do nothing;

  select count(*) into v_count from public.compta_evenement
  where pharmacie_id=v_pharmacie and cle_idempotence like 'assurance-worker-test:%';
  if v_count<>3 then raise exception 'Idempotence outbox incorrecte : % événements',v_count; end if;

  for v_row in
    select c.event_id,c.claim_token
    from public.compta_evenements_reclamer(100) c
    where c.event_id=any(v_events)
  loop
    v_result:=public.compta_traiter_evenement(v_row.event_id,v_row.claim_token);
    if v_result<>'traite' then
      raise exception 'Worker Assurance non traité pour % : %',v_row.event_id,v_result;
    end if;
    v_processed:=v_processed+1;
  end loop;
  if v_processed<>3 then raise exception 'Nombre événements traités incorrect : %',v_processed; end if;

  select id into v_entry_prise from public.compta_ecriture
  where pharmacie_id=v_pharmacie and source_id=(select source_id from public.compta_evenement where id=v_event_prise);
  select id into v_entry_partiel from public.compta_ecriture
  where pharmacie_id=v_pharmacie and source_id=(select source_id from public.compta_evenement where id=v_event_partiel);
  select id into v_entry_solde from public.compta_ecriture
  where pharmacie_id=v_pharmacie and source_id=(select source_id from public.compta_evenement where id=v_event_solde);

  if v_entry_prise is null or v_entry_partiel is null or v_entry_solde is null then
    raise exception 'Une écriture comptable attendue est absente';
  end if;

  -- Chaque événement doit produire exactement deux lignes équilibrées.
  for v_row in select unnest(array[v_entry_prise,v_entry_partiel,v_entry_solde]) as entry_id
  loop
    select count(*),coalesce(sum(debit_fcfa),0),coalesce(sum(credit_fcfa),0)
      into v_count,v_debit,v_credit
    from public.compta_ligne where ecriture_id=v_row.entry_id;
    if v_count<>2 or v_debit<>v_credit then
      raise exception 'Écriture déséquilibrée % : lignes %, débit %, crédit %',v_row.entry_id,v_count,v_debit,v_credit;
    end if;
  end loop;

  select coalesce(sum(debit_fcfa),0),coalesce(sum(credit_fcfa),0)
    into v_receivable_debit,v_receivable_credit
  from public.compta_ligne where pharmacie_id=v_pharmacie and compte_id=v_receivable
    and ecriture_id in (v_entry_prise,v_entry_partiel,v_entry_solde);
  if v_receivable_debit<>10000 or v_receivable_credit<>10000 then
    raise exception 'Solde créance assureur incorrect : débit %, crédit %',v_receivable_debit,v_receivable_credit;
  end if;

  select coalesce(sum(debit_fcfa),0),coalesce(sum(credit_fcfa),0)
    into v_debit,v_credit
  from public.compta_ligne where pharmacie_id=v_pharmacie and compte_id=v_bank
    and ecriture_id in (v_entry_prise,v_entry_partiel,v_entry_solde);
  if v_debit<>10000 or v_credit<>0 then
    raise exception 'Remboursements reçus incorrects : débit trésorerie %, crédit %',v_debit,v_credit;
  end if;

  if exists(select 1 from public.compta_evenement where id=any(v_events) and statut<>'traite') then
    raise exception 'Tous les événements doivent être finalisés';
  end if;

  raise notice 'PASS Assurance comptable : prise en charge 10 000, remboursements 4 000 + 6 000, écritures équilibrées, créance soldée, idempotence';
end;
$assurance_worker$;

rollback;
select '202611121_assurance_compta_worker_positive PASS' as resultat;
