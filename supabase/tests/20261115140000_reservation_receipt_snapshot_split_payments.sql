-- Contrat du snapshot de reçu quand le POS comporte une ligne ASSURANCE:%.
do $test$
declare
  v_definition text;
begin
  v_definition:=pg_get_functiondef(
    'public.naxa_reservation_receipt_snapshot()'::regprocedure
  );

  if position('not like ''assurance:%''' in lower(v_definition))=0 then
    raise exception 'Le snapshot doit exclure la ligne de créance assureur du paiement Client';
  end if;
  if position('a_convenir' in lower(v_definition))=0
     or position('v_percu:=0' in replace(lower(v_definition),' ',''))=0
     or position('v_monnaie:=0' in replace(lower(v_definition),' ',''))=0 then
    raise exception 'La prise en charge totale doit produire un reçu explicite à 0 FCFA côté Client';
  end if;
  if position('p.montant_percu,p.montant' in replace(lower(v_definition),' ',''))=0 then
    raise exception 'Le montant reçu Client doit être privilégié au montant réglé comptablement';
  end if;
end
$test$;

select 'reservation_receipt_snapshot_split_payments PASS' as resultat;
