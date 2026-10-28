-- NAXA 255 — contrat structurel de rejet de l'ancienne signature.
begin;

do $test$
declare
  v_legacy text;
  v_typed text;
begin
  if to_regprocedure('public.client_credit_rembourser(uuid,integer,text,text)') is null
    or to_regprocedure('public.client_credit_rembourser(uuid,integer,public.mode_paiement_caisse,text,text)') is null then
    raise exception 'Les signatures legacy ou typée sont absentes';
  end if;

  select pg_get_functiondef('public.client_credit_rembourser(uuid,integer,text,text)'::regprocedure)
    into v_legacy;
  if position('raise exception' in lower(v_legacy))=0
    or position('contrat de remboursement obsolète' in lower(v_legacy))=0
    or position('v_motif' in v_legacy)>0
    or position('return public.client_credit_rembourser' in lower(v_legacy))>0 then
    raise exception 'Le wrapper legacy doit rejeter tout appel sans déduire un mode du motif';
  end if;

  select pg_get_functiondef('public.client_credit_rembourser(uuid,integer,public.mode_paiement_caisse,text,text)'::regprocedure)
    into v_typed;
  if position('p_mode is distinct from' in v_typed)=0
    or position('especes' in v_typed)=0 then
    raise exception 'La RPC typée ne contraint pas le remboursement aux espèces';
  end if;
end
$test$;

rollback;
select '255_credit_repayment_legacy_guard_contract PASS' as resultat;
