-- NAXA 249 — contrat structurel du raccordement remboursement -> outbox comptable.
-- Test sans écriture métier ; transaction annulée.
begin;

do $test$
declare
  v_trigger text;
  v_worker text;
  v_finish text;
begin
  if to_regclass('public.client_credit_operations') is null
    or to_regclass('public.compta_evenement') is null
    or to_regclass('public.compta_ecriture') is null then
    raise exception 'Prérequis comptables ou crédit absents';
  end if;

  select pg_get_triggerdef(t.oid) into v_trigger
  from pg_trigger t
  where t.tgrelid='public.client_credit_operations'::regclass
    and t.tgname='compta_outbox_credit_remboursement'
    and not t.tgisinternal;
  if v_trigger is null
    or position('AFTER INSERT' in upper(v_trigger))=0
    or position('nature' in v_trigger)=0
    or position('remboursement' in v_trigger)=0 then
    raise exception 'Trigger comptable des remboursements absent ou mal filtré';
  end if;

  select pg_get_functiondef('public.compta_emettre_remboursement_credit()'::regprocedure)
    into v_worker;
  if position('credit_remboursement' in v_worker)=0
    or position('credit_operation' in v_worker)=0
    or position('montant_fcfa' in v_worker)=0
    or position('date_comptable' in v_worker)=0
    or position('ON CONFLICT' in upper(v_worker))=0 then
    raise exception 'Émission outbox remboursement incomplète ou non idempotente';
  end if;

  select pg_get_functiondef('public.compta_traiter_evenement(uuid,uuid)'::regprocedure)
    into v_worker;
  if position('credit_remboursement' in v_worker)=0
    or position('credit_operation' in v_worker)=0 then
    raise exception 'Worker comptable ne prend pas en charge les remboursements';
  end if;

  select pg_get_functiondef('public.compta_evenement_terminer(uuid,uuid,boolean,text)'::regprocedure)
    into v_finish;
  if position('compta_ecriture' in v_finish)=0 then
    raise exception 'Finalisation ne vérifie pas la présence de l’écriture comptable';
  end if;
end
$test$;

rollback;
select '249_credit_repayment_accounting_contract PASS' as resultat;
