-- NAXA — Contrat des RPC de configuration du plan/journal pour le crédit.
-- Contrat statique ; aucune configuration commerciale ou écriture n'est créée.
begin;

do $test$
declare
  v_journal text;
  v_mapping text;
begin
  select pg_get_functiondef(
    'public.compta_config_enregistrer_journal(uuid,uuid,text,text,date,date)'::regprocedure
  ) into v_journal;
  select pg_get_functiondef(
    'public.compta_plan_enregistrer_mapping(uuid,uuid,text,text,uuid,date,date)'::regprocedure
  ) into v_mapping;

  if position('credit_octroi' in v_journal)=0
     or position('credit_remboursement' in v_journal)=0 then
    raise exception 'Les RPC de journal ne permettent pas de configurer les événements de crédit';
  end if;
  if position('credit_octroi' in v_mapping)=0
     or position('credit_remboursement' in v_mapping)=0 then
    raise exception 'Les RPC de mapping ne permettent pas de configurer les événements de crédit';
  end if;
  if position('compta_ecriture_autorisee' in v_journal)=0
     or position('compta_ecriture_autorisee' in v_mapping)=0 then
    raise exception 'La configuration de crédit ne conserve pas les autorisations comptables existantes';
  end if;
end
$test$;

rollback;
select '20261115230000_credit_accounting_configuration_contract PASS' as resultat;
