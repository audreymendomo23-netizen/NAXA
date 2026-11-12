-- Vérifie la frontière inclusive des 48 h avec des dates de journal contrôlées.
-- Les quantités et les journaux sont restaurés par rollback.
begin;

do $test$
declare
  v_pharmacie uuid;
  v_produit uuid;
  v_quantite integer;
  v_pharmacie_stale uuid;
  v_produit_stale uuid;
  v_quantite_stale integer;
  v_count integer;
begin
  select s.pharmacie_id,s.produit_id,s.quantite
    into v_pharmacie,v_produit,v_quantite
  from public.stocks s
  join public.pharmacies ph on ph.id=s.pharmacie_id
  where s.quantite>0 and ph.actif is true and ph.visible_recherche is true
    and not exists(select 1 from public.stocks_lots l
      where l.pharmacie_id=s.pharmacie_id and l.produit_id=s.produit_id)
  limit 1;

  select s.pharmacie_id,s.produit_id,s.quantite
    into v_pharmacie_stale,v_produit_stale,v_quantite_stale
  from public.stocks s
  join public.pharmacies ph on ph.id=s.pharmacie_id
  where s.quantite>0 and ph.actif is true and ph.visible_recherche is true
    and (s.pharmacie_id,s.produit_id)<>(v_pharmacie,v_produit)
    and not exists(select 1 from public.stocks_lots l
      where l.pharmacie_id=s.pharmacie_id and l.produit_id=s.produit_id)
  limit 1;

  if v_pharmacie is null or v_pharmacie_stale is null then
    raise exception 'TWO_ACTIVE_UNLOTTED_STOCK_FIXTURES_REQUIRED';
  end if;

  perform set_config('naxa.stock_occurred_at',(now()-interval '48 hours')::text,true);
  update public.stocks set quantite=v_quantite+1
    where pharmacie_id=v_pharmacie and produit_id=v_produit;
  select count(*) into v_count
    from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit);
  if v_count<>1 then raise exception 'EXACTLY_48_HOURS_MUST_REMAIN_PUBLISHABLE'; end if;

  perform set_config('naxa.stock_occurred_at',(now()-interval '48 hours'-interval '1 second')::text,true);
  update public.stocks set quantite=v_quantite_stale+1
    where pharmacie_id=v_pharmacie_stale and produit_id=v_produit_stale;
  select count(*) into v_count
    from public.marketplace_offre_stock_disponible(v_pharmacie_stale,v_produit_stale);
  if v_count<>0 then raise exception 'MORE_THAN_48_HOURS_MUST_BE_HIDDEN'; end if;
end
$test$;

rollback;
select 'MARKETPLACE_48H_INCLUSIVE_BOUNDARY PASS' as result;
