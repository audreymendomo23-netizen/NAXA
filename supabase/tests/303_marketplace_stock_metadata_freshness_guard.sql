-- Un mouvement physique crée le journal, mais une modification de prix seule ne doit pas
-- renouveler sa date. Tout le scénario est transactionnel et rollbacké.
begin;

do $test$
declare
  v_pharmacie uuid;
  v_produit uuid;
  v_quantite integer;
  v_prix integer;
  v_before timestamptz;
  v_after timestamptz;
begin
  select s.pharmacie_id,s.produit_id,s.quantite,s.prix
    into v_pharmacie,v_produit,v_quantite,v_prix
  from public.stocks s
  where s.quantite>0
    and not exists(select 1 from public.stocks_lots l
      where l.pharmacie_id=s.pharmacie_id and l.produit_id=s.produit_id)
  limit 1;

  if v_pharmacie is null then
    raise exception 'NO_UNLOTTED_STOCK_FIXTURE_AVAILABLE';
  end if;

  -- Génère une trace physique réelle, puis restaure la quantité initiale.
  update public.stocks set quantite=v_quantite+1
    where pharmacie_id=v_pharmacie and produit_id=v_produit;
  update public.stocks set quantite=v_quantite
    where pharmacie_id=v_pharmacie and produit_id=v_produit;

  v_before:=private.marketplace_stock_last_quantity_update(v_pharmacie,v_produit);
  update public.stocks set prix=prix+1
    where pharmacie_id=v_pharmacie and produit_id=v_produit;
  v_after:=private.marketplace_stock_last_quantity_update(v_pharmacie,v_produit);

  if v_after is distinct from v_before then
    raise exception 'METADATA_UPDATE_MUST_NOT_REFRESH_STOCK_FRESHNESS';
  end if;

  update public.stocks set prix=v_prix
    where pharmacie_id=v_pharmacie and produit_id=v_produit;
end
$test$;

rollback;
select 'MARKETPLACE_METADATA_CANNOT_REFRESH_STOCK PASS' as result;
