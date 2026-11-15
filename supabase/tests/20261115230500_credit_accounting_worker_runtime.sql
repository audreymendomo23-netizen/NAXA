-- NAXA — Test runtime du worker comptable pour les événements de crédit.
-- Exécuter sur Replay uniquement. Le plan, les journaux, les mappings, la période,
-- les événements et écritures sont synthétiques et entièrement annulés par ROLLBACK.
begin;
do $credit_worker_e2e$
declare
  v_pharmacie uuid := '1a4f1ce5-cccf-477e-9a5b-474c8c9fc713';
  v_actor uuid := 'b5b79627-46ac-4dea-8ea9-6f0464cb3404';
  v_date date := timezone('Africa/Douala',now())::date;
  v_period uuid := gen_random_uuid();
  v_debit uuid := gen_random_uuid();
  v_credit uuid := gen_random_uuid();
  v_event_octroi uuid := gen_random_uuid();
  v_event_refund uuid := gen_random_uuid();
  v_claim_octroi uuid := gen_random_uuid();
  v_claim_refund uuid := gen_random_uuid();
  v_source_octroi text := 'E2E-WORKER-OCTROI-' || gen_random_uuid()::text;
  v_source_refund text := 'E2E-WORKER-REFUND-' || gen_random_uuid()::text;
  v_result text;
  v_debit_total bigint;
  v_credit_total bigint;
  v_count integer;
begin
  if not exists(
    select 1 from public.pharmacies
    where id=v_pharmacie and est_demo=false and visible_recherche=false and actif=true
  ) then
    raise exception 'La pharmacie technique isolée Replay n’est pas conforme';
  end if;

  insert into public.compta_periodes(id,pharmacie_id,date_debut,date_fin,statut)
  values(v_period,v_pharmacie,v_date,v_date,'ouverte');

  insert into public.compta_plan_comptable(
    id,pharmacie_id,code,libelle,classe,statut,valide_par,valide_le,source_validation
  ) values
    (v_debit,v_pharmacie,'E2E-CR-D','Compte technique débit crédit E2E',1,'valide',v_actor,now(),'e2e_rollback'),
    (v_credit,v_pharmacie,'E2E-CR-C','Compte technique crédit crédit E2E',4,'valide',v_actor,now(),'e2e_rollback');

  insert into public.compta_mapping_compte(
    pharmacie_id,evenement_type,sens,compte_id,statut,valide_du,valide_jusquau,valide_par,valide_le
  ) values
    (v_pharmacie,'credit_octroi','debit',v_debit,'valide',v_date,v_date,v_actor,now()),
    (v_pharmacie,'credit_octroi','credit',v_credit,'valide',v_date,v_date,v_actor,now()),
    (v_pharmacie,'credit_remboursement','debit',v_debit,'valide',v_date,v_date,v_actor,now()),
    (v_pharmacie,'credit_remboursement','credit',v_credit,'valide',v_date,v_date,v_actor,now());

  insert into public.compta_parametre(
    pharmacie_id,cle,valeur,statut,valide_du,valide_jusquau,valide_par
  ) values
    (v_pharmacie,'journal_code.credit_octroi',to_jsonb('E2E'::text),'valide',v_date,v_date,v_actor),
    (v_pharmacie,'journal_code.credit_remboursement',to_jsonb('E2E'::text),'valide',v_date,v_date,v_actor);

  insert into public.compta_evenement(
    id,pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,
    donnees,statut,claim_token,verrouille_jusqua
  ) values
    (v_event_octroi,v_pharmacie,'credit_octroi','credit_operation',v_source_octroi,
      'e2e:'||v_source_octroi,now(),
      jsonb_build_object('montant_fcfa','350','date_comptable',v_date::text,'reference_source','E2E octroi'),
      'en_cours',v_claim_octroi,now()+interval '5 minutes'),
    (v_event_refund,v_pharmacie,'credit_remboursement','credit_operation',v_source_refund,
      'e2e:'||v_source_refund,now(),
      jsonb_build_object('montant_fcfa','150','date_comptable',v_date::text,'reference_source','E2E remboursement'),
      'en_cours',v_claim_refund,now()+interval '5 minutes');

  perform set_config('request.jwt.claim.role','service_role',true);
  v_result:=public.compta_traiter_evenement(v_event_octroi,v_claim_octroi);
  if v_result<>'traite' then raise exception 'Worker octroi retourne %',v_result; end if;
  v_result:=public.compta_traiter_evenement(v_event_refund,v_claim_refund);
  if v_result<>'traite' then raise exception 'Worker remboursement retourne %',v_result; end if;

  select count(distinct e.id),coalesce(sum(l.debit_fcfa),0),coalesce(sum(l.credit_fcfa),0)
  into v_count,v_debit_total,v_credit_total
  from public.compta_ecriture e
  join public.compta_ligne l on l.ecriture_id=e.id
  where e.pharmacie_id=v_pharmacie
    and e.source_id in (v_source_octroi,v_source_refund)
    and e.source_type='credit_operation';

  if v_count<>2 or v_debit_total<>500 or v_credit_total<>500 then
    raise exception 'Les écritures crédit ne sont pas équilibrées : écritures %, débit %, crédit %',
      v_count,v_debit_total,v_credit_total;
  end if;

  select count(*) into v_count
  from public.compta_evenement
  where id in (v_event_octroi,v_event_refund) and statut='traite';
  if v_count<>2 then raise exception 'Les deux événements crédit ne sont pas marqués traités'; end if;
end
$credit_worker_e2e$;
rollback;
select '20261115230500_credit_accounting_worker_runtime PASS (octroi + remboursement; balanced; rollback)' as resultat;
