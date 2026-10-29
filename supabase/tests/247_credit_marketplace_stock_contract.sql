-- NAXA 247 — tests structurels du contrat de crédit Marketplace / hold de stock.
-- Aucun dossier, crédit, réservation ou utilisateur de test n'est créé.
begin;

do $test$
declare
  v_submit text;
  v_decide text;
  v_hold text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='client_credit_requests' and column_name='telephone_demande'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='client_credit_requests' and column_name='date_remboursement'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='client_credit_requests' and column_name='justificatif_path'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='client_credit_requests' and column_name='panier_items'
  ) then raise exception 'Champs du contrat Marketplace incomplets'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='reservations' and column_name='credit_request_id'
  ) then raise exception 'Lien de réservation crédit absent'; end if;

  select pg_get_functiondef('public.client_credit_marketplace_soumettre(uuid,jsonb,text,date,text)'::regprocedure) into v_submit;
  select pg_get_functiondef('public.client_credit_demande_decider(uuid,boolean)'::regprocedure) into v_decide;
  select pg_get_functiondef('private.reserve_stock(uuid,jsonb)'::regprocedure) into v_hold;

  if position('auth.uid()' in v_submit)=0
     or position('date_remboursement' in v_submit)=0
     or position('justificatif_path' in v_submit)=0
     or position('solde>0' in replace(v_submit,' ',''))=0 then
    raise exception 'La soumission ne vérifie pas authentification, échéance, justificatif et crédit actif';
  end if;
  if position('private.reserve_stock' in v_decide)=0
     or position('credit_request_id' in v_decide)=0
     or position('reservation_item_lots' in v_decide)=0
     or position('stock_decremented,stock_restored' in replace(v_hold,' ',''))=0
     or position('false,false' in replace(v_hold,' ',''))=0
     or position('updatepublic.stockssetquantite=quantite-' in lower(replace(v_hold,' ','')))>0 then
    raise exception 'L’approbation ne crée pas un hold lié et alloué sans débit physique';
  end if;
  if position('p_approuver' in v_decide)=0 or position('statut=''rejetee''' in replace(v_decide,' ',''))=0 then
    raise exception 'Le refus de crédit ne suit pas le chemin attendu';
  end if;
end;
$test$;

select '247_credit_marketplace_stock_contract PASS' as resultat;
rollback;
