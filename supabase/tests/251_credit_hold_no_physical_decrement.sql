-- NAXA 251 — contrat structurel : une réservation n'effectue aucun débit physique.
-- Le retrait réel du hold est porté par vente_reservation_credit_finaliser (252/256).
-- L'ancienne RPC générique d'encaissement doit refuser le chemin Marketplace obsolète.
-- À exécuter uniquement sur une base de test dont les migrations sont appliquées.
begin;
do $test$
declare
  v_hold text;
  v_approval text;
  v_cash text;
  v_withdrawal text;
  v_hold_compact text;
  v_withdrawal_compact text;
begin
  select pg_get_functiondef('private.reserve_stock(uuid,jsonb)'::regprocedure) into v_hold;
  select pg_get_functiondef('public.client_credit_demande_decider(uuid,boolean)'::regprocedure) into v_approval;
  select pg_get_functiondef('public.vente_reservation_encaisser(uuid,uuid,integer)'::regprocedure) into v_cash;
  select pg_get_functiondef('public.vente_reservation_credit_finaliser(uuid,uuid,text)'::regprocedure) into v_withdrawal;
  v_hold_compact := lower(regexp_replace(v_hold, '[[:space:]]+', '', 'g'));
  v_withdrawal_compact := lower(regexp_replace(v_withdrawal, '[[:space:]]+', '', 'g'));

  if position('stock_decremented,stock_restored' in v_hold_compact)=0
     or position('false,false' in v_hold_compact)=0 then
    raise exception 'Le hold ne marque pas explicitement le stock comme non débité';
  end if;
  if position('updatepublic.stockssetquantite=quantite-' in v_hold_compact)>0
     or position('updatepublic.stocks_lotssetquantite=quantite-' in v_hold_compact)>0 then
    raise exception 'La création du hold débite encore le stock physique ou les lots';
  end if;
  if position('private.reserve_stock' in lower(v_approval))=0
     or position('reservation_item_lots' in lower(v_approval))=0 then
    raise exception 'L’approbation crédit ne relie plus le hold à l’allocation FEFO';
  end if;
  if position('stock_decremented' in v_withdrawal_compact)=0
     or position('consumed_at=now()' in v_withdrawal_compact)=0
     or position('client_credit_enregistrer_vente' in lower(v_withdrawal))=0 then
    raise exception 'La RPC de retrait crédit ne consomme pas le hold de façon traçable';
  end if;
  if position('raise exception' in lower(v_cash))=0
     or position('parcours marketplace mis à jour' in lower(v_cash))=0 then
    raise exception 'L’ancienne RPC d’encaissement doit refuser le chemin Marketplace obsolète';
  end if;
end;
$test$;
select '251_credit_hold_no_physical_decrement PASS' as resultat;
rollback;
