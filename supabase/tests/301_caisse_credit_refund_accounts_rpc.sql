-- NAXA 301 — projection autorisée des comptes à rembourser dans la Caisse.
-- Vérifie le contrat RPC et ses privilèges sans créer de remboursement métier.
begin;

do $test$
declare
  v_def text;
  v_result_type text;
begin
  if to_regprocedure('public.caisse_credit_remboursement_comptes_lister(uuid)') is null then
    raise exception 'FAIL: RPC de projection des comptes crédit absente';
  end if;

  select pg_get_functiondef('public.caisse_credit_remboursement_comptes_lister(uuid)'::regprocedure)
    into v_def;
  if position('naxa_caisse_actor_for_pharmacy' in v_def)=0
    or position('auth.uid()' in v_def)=0
    or position('c.id' in v_def)=0
    or position('c.solde > 0' in v_def)=0 then
    raise exception 'FAIL: la projection ne limite pas les comptes au périmètre Caisse ou omet le crédit_id';
  end if;

  if has_function_privilege('anon','public.caisse_credit_remboursement_comptes_lister(uuid)','EXECUTE') then
    raise exception 'FAIL: anon peut exécuter la RPC de projection';
  end if;
  if not has_function_privilege('authenticated','public.caisse_credit_remboursement_comptes_lister(uuid)','EXECUTE') then
    raise exception 'FAIL: authenticated ne peut pas exécuter la RPC de projection';
  end if;

  select pg_get_function_result('public.caisse_credit_remboursement_comptes_lister(uuid)'::regprocedure)
    into v_result_type;
  if v_result_type not ilike '%credit_id uuid%' then
    raise exception 'FAIL: la RPC ne retourne pas credit_id';
  end if;
end
$test$;

rollback;
select '301_caisse_credit_refund_accounts_rpc PASS' as resultat;
