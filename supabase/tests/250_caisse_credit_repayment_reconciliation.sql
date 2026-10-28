-- NAXA 250 — contrat de clôture : les remboursements encaissés augmentent le théorique.
-- Vérification structurelle sans mutation métier.
begin;

do $test$
declare
  v_def text;
  v_guard text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='client_credit_operations'
      and column_name='caisse_session_id'
  ) then
    raise exception 'Lien remboursement/session absent';
  end if;

  select pg_get_functiondef('public.caisse_cloturer(uuid,integer,text)'::regprocedure)
    into v_def;
  if position('v_credit_remboursements' in v_def)=0
    or position('client_credit_operations' in v_def)=0
    or position('caisse_session_id' in v_def)=0
    or position('remboursement' in v_def)=0
    or position('coalesce(v_credit_remboursements,0)' in v_def)=0 then
    raise exception 'La clôture ne réconcilie pas les remboursements de crédit';
  end if;

  if position('v_session.fond_initial+coalesce(v_cash,0)' in v_def)=0
    or position('+coalesce(v_credit_remboursements,0)-coalesce(v_decaissements,0)' in v_def)=0 then
    raise exception 'Formule du solde théorique incorrecte';
  end if;

  -- La garde BEFORE UPDATE recalculait auparavant le solde sans les remboursements.
  -- Elle doit partager la même formule, sinon elle annule toute clôture concernée.
  select pg_get_functiondef('public.naxa_guard_caisse_session_write()'::regprocedure)
    into v_guard;
  if position('v_credit_remboursements' in v_guard)=0
    or position('client_credit_operations' in v_guard)=0
    or position('caisse_session_id' in v_guard)=0
    or position('+coalesce(v_credit_remboursements,0)-coalesce(v_decaissements,0)' in v_guard)=0 then
    raise exception 'La garde de session ne réconcilie pas les remboursements de crédit';
  end if;
end
$test$;

rollback;
select '250_caisse_credit_repayment_reconciliation PASS' as resultat;
