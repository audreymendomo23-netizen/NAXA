-- NAXA 252 — contrat structurel du retrait Marketplace à crédit.
-- À exécuter uniquement sur une base de test dont les migrations sont appliquées.
begin;
do $test$
declare v_fn text;
begin
  select pg_get_functiondef('public.vente_reservation_credit_finaliser(uuid,uuid,text)'::regprocedure) into v_fn;
  if position('credit_request_id' in v_fn)=0
     or position('statut=''approuvee''' in lower(v_fn))=0 then
    raise exception 'Le retrait ne vérifie pas la demande Marketplace approuvée';
  end if;
  if position('q.montant<>r.total' in replace(v_fn,' ',''))=0 then
    raise exception 'Le montant approuvé n’est pas rapproché du total réservation';
  end if;
  if position('client_credit_enregistrer_vente' in v_fn)=0 then
    raise exception 'Le retrait ne passe pas par le registre atomique de crédit';
  end if;
  if position('caisse_session_id' in v_fn)=0 or position('consumed_at=now()' in replace(v_fn,' ',''))=0 then
    raise exception 'Le retrait ne trace pas la session ou la consommation';
  end if;
  if position('vente_encaisser_finaliser' in v_fn)>0 then
    raise exception 'Le parcours crédit appelle à tort le finaliseur de paiement espèces';
  end if;
end;
$test$;
select '252_marketplace_credit_withdrawal_contract PASS' as resultat;
rollback;
