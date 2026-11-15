-- Contrat du garde de transition : une réservation peut être réglée par plusieurs lignes POS.
do $test$
declare
  v_definition text;
begin
  v_definition:=pg_get_functiondef(
    'private.set_reservation_status(uuid,public.resa_statut)'::regprocedure
  );

  if position('sum(vp.montant)' in lower(v_definition))=0
     or position('exists (' in lower(v_definition))=0
     or position('v.total_net = r.total' in lower(v_definition))=0 then
    raise exception 'Le garde doit agréger les paiements POS et conserver le contrôle du brut';
  end if;

  if position('vp.montant = r.total' in lower(v_definition))>0 then
    raise exception 'L''ancienne exigence d''une ligne de paiement égale au brut est encore présente';
  end if;
end
$test$;

select 'split_pos_reservation_payment_contract PASS' as resultat;
