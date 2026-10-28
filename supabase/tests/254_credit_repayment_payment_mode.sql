-- NAXA 254 — contrat structurel du moyen d'encaissement des remboursements.
-- Test statique uniquement : aucune opération métier n'est créée.
begin;

do $test$
declare
  v_rpc text;
  v_close text;
  v_guard text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='client_credit_operations'
      and column_name='mode_paiement'
      and udt_name='mode_paiement_caisse'
  ) then
    raise exception 'Le moyen de paiement structuré du remboursement est absent';
  end if;

  if to_regprocedure('public.client_credit_rembourser(uuid,integer,public.mode_paiement_caisse,text,text)') is null then
    raise exception 'La RPC explicite avec mode de paiement est absente';
  end if;
  select pg_get_functiondef('public.client_credit_rembourser(uuid,integer,public.mode_paiement_caisse,text,text)'::regprocedure)
    into v_rpc;
  if position('p_mode' in v_rpc)=0
    or position('is distinct from' in v_rpc)=0
    or position('especes' in v_rpc)=0
    or position('mode_paiement' in v_rpc)=0
    or position('client_credit_operations' in v_rpc)=0 then
    raise exception 'La RPC ne valide pas et ne persiste pas le mode de remboursement';
  end if;

  select pg_get_functiondef('public.caisse_cloturer(uuid,integer,text)'::regprocedure)
    into v_close;
  if position('o.mode_paiement=''especes''' in v_close)=0 then
    raise exception 'La clôture ajoute encore tous les remboursements au tiroir espèces';
  end if;

  select pg_get_functiondef('public.naxa_guard_caisse_session_write()'::regprocedure)
    into v_guard;
  if position('o.mode_paiement=''especes''' in v_guard)=0 then
    raise exception 'La garde de clôture ne filtre pas les remboursements espèces';
  end if;
end
$test$;

rollback;
select '254_credit_repayment_payment_mode_contract PASS' as resultat;
