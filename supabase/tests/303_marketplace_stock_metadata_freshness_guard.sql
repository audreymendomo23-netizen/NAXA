-- Une modification de prix ne doit pas renouveler la fraîcheur d'un stock journalisé.
do $test$
declare
  v_pharmacie uuid;
  v_produit uuid;
  v_prix integer;
  v_before timestamptz;
  v_after timestamptz;
begin
  select s.pharmacie_id,s.produit_id,s.prix
    into v_pharmacie,v_produit,v_prix
  from public.stocks s
  where exists (
    select 1 from public.stock_manager_movement_journal j
    where j.pharmacie_id=s.pharmacie_id
      and j.produit_id=s.produit_id
      and j.source_table in ('stocks','stocks_lots')
  )
  limit 1;

  if v_pharmacie is null then
    raise exception 'NO_JOURNALED_STOCK_FIXTURE_AVAILABLE';
  end if;

  v_before:=private.marketplace_stock_last_quantity_update(v_pharmacie,v_produit);
  update public.stocks
    set prix=prix+1
  where pharmacie_id=v_pharmacie and produit_id=v_produit;

  v_after:=private.marketplace_stock_last_quantity_update(v_pharmacie,v_produit);
  if v_after is distinct from v_before then
    raise exception 'METADATA_UPDATE_MUST_NOT_REFRESH_STOCK_FRESHNESS';
  end if;

  update public.stocks
    set prix=v_prix
  where pharmacie_id=v_pharmacie and produit_id=v_produit;
end
$test$;

select 'MARKETPLACE_METADATA_CANNOT_REFRESH_STOCK PASS' as result;
