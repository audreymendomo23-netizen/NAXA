-- NAXA 256 — contrat structurel : le retrait utilise l'allocation de lots de sa réservation.
-- À exécuter uniquement sur une base de test dont les migrations prérequises sont appliquées.
begin;

do $test$
declare
  v_fn text;
  v_compact text;
begin
  select pg_get_functiondef(
    'public.vente_reservation_credit_finaliser(uuid,uuid,text)'::regprocedure
  ) into v_fn;
  v_compact := lower(regexp_replace(v_fn, '[[:space:]]+', '', 'g'));

  if position('public.reservation_item_lots' in lower(v_fn))=0
     or position('a.reservation_id=r.id' in v_compact)=0
     or position('a.produit_id=v_item.produit_id' in v_compact)=0 then
    raise exception 'Le retrait ne cible pas les lots affectés à la réservation et au produit';
  end if;
  if position('v_allocated<>v_item.quantite' in v_compact)=0
     or position('allocation de lots absente ou incohérente' in lower(v_fn))=0 then
    raise exception 'Le retrait ne bloque pas une allocation de lots absente ou incohérente';
  end if;
  if position('forupdateofl,a' in v_compact)=0
     or position('a.quantiteasreserve_qty' in v_compact)=0 then
    raise exception 'Les lots réservés ne sont pas verrouillés et consommés selon les quantités allouées';
  end if;
  if position('forv_lotinselectl.id,l.quantite,l.date_peremptionfrompublic.stocks_lotsl' in v_compact)>0 then
    raise exception 'Le retrait conserve le parcours FEFO global qui peut ignorer l''allocation du hold';
  end if;
  if position('updatepublic.stocks_lotssetquantite=quantite-v_take' in v_compact)=0 then
    raise exception 'Le débit physique des lots affectés a disparu';
  end if;
end;
$test$;

rollback;
select '256_credit_withdrawal_reserved_lots_contract PASS' as resultat;
