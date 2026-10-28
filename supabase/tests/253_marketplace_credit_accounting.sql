-- NAXA 253 — contrat structurel : une vente à crédit n'est pas un encaissement.
begin;

do $test$
declare
  v_fn text;
  v_worker text;
  v_trigger text;
begin
  select pg_get_functiondef('public.compta_emettre_evenement_metier()'::regprocedure) into v_fn;
  if position('mode_paiement' in v_fn)=0 or position('credit' in v_fn)=0 then
    raise exception 'L''outbox des ventes ne filtre pas explicitement le mode crédit';
  end if;

  select pg_get_functiondef('public.compta_emettre_octroi_credit()'::regprocedure) into v_fn;
  if position('credit_octroi' in v_fn)=0
    or position('credit_operation' in v_fn)=0
    or position('montant_fcfa' in v_fn)=0
    or position('date_comptable' in v_fn)=0
    or position('ON CONFLICT' in upper(v_fn))=0 then
    raise exception 'Émission outbox octroi de crédit absente ou non idempotente';
  end if;

  select pg_get_triggerdef(t.oid) into v_trigger
  from pg_trigger t
  where t.tgrelid='public.client_credit_operations'::regclass
    and t.tgname='compta_outbox_credit_octroi'
    and not t.tgisinternal;
  if v_trigger is null or position('AFTER INSERT' in upper(v_trigger))=0
    or position('credit' in v_trigger)=0 then
    raise exception 'Trigger outbox octroi de crédit absent ou mal filtré';
  end if;

  select pg_get_functiondef('public.compta_traiter_evenement(uuid,uuid)'::regprocedure) into v_worker;
  if position('credit_octroi' in v_worker)=0 or position('credit_remboursement' in v_worker)=0 then
    raise exception 'Worker comptable incomplet pour octroi/remboursement';
  end if;
end
$test$;

rollback;
select '253_marketplace_credit_accounting_contract PASS' as resultat;
