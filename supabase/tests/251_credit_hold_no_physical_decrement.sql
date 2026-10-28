-- NAXA 251 — contrat structurel : une réservation n'effectue aucun débit physique.
-- À exécuter uniquement sur une base de test dont les migrations sont appliquées.
begin;
do $test$
declare v_hold text; v_approval text; v_cash text;
begin
  select pg_get_functiondef('private.reserve_stock(uuid,jsonb)'::regprocedure) into v_hold;
  select pg_get_functiondef('public.client_credit_demande_decider(uuid,boolean)'::regprocedure) into v_approval;
  select pg_get_functiondef('public.vente_reservation_encaisser(uuid,uuid,integer)'::regprocedure) into v_cash;
  if position('stock_decremented,stock_restored' in replace(v_hold,' ',''))=0
     or position('false,false' in replace(v_hold,' ',''))=0 then
    raise exception 'Le hold ne marque pas explicitement le stock comme non débité';
  end if;
  if position('update public.stocks set quantite=quantite-' in lower(replace(v_hold,' ','')))>0
     or position('update public.stocks_lots set quantite=quantite-' in lower(replace(v_hold,' ','')))>0 then
    raise exception 'La création du hold débite encore le stock physique ou les lots';
  end if;
  if position('private.reserve_stock' in v_approval)=0
     or position('reservation_item_lots' in v_approval)=0 then
    raise exception 'L’approbation crédit ne relie plus le hold à l’allocation FEFO';
  end if;
  if position('stock_decremented' in v_cash)=0
     or position('consumed_at = now()' in v_cash)=0 then
    raise exception 'Le parcours caisse ne consomme pas le hold de façon traçable';
  end if;
end;
$test$;
select '251_credit_hold_no_physical_decrement PASS' as resultat;
rollback;
