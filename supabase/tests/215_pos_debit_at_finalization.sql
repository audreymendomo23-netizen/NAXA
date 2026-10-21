-- NAXA 215 — transactional E2E contract for POS -> physical stock -> Marketplace.
-- Safe to run on a test/staging DB or against demo data: all fixtures roll back.
begin;
do $test$
declare
  v_user uuid;
  v_pharmacie uuid;
  v_produit uuid;
  v_caisse uuid;
  v_session uuid;
  v_vente uuid;
  v_resa uuid;
  v_code text;
  v_total integer;
  v_stock_before integer;
  v_market_before integer;
  v_stock_after integer;
  v_market_after integer;
  v_market_hold integer;
  v_status text;
  v_consumed uuid;
begin
  select id into v_user from public.profiles
  where role::text='admin' and actif=true order by created_at limit 1;
  if v_user is null then raise exception 'Fixture admin active absente'; end if;

  select s.pharmacie_id,s.produit_id into v_pharmacie,v_produit
  from public.stocks s
  join public.pharmacies ph on ph.id=s.pharmacie_id and ph.actif and ph.visible_recherche
  cross join lateral public.marketplace_offre_stock_disponible(s.pharmacie_id,s.produit_id) a
  where s.quantite>2 and a.quantite>2
    and not exists(select 1 from public.stocks_lots l where l.pharmacie_id=s.pharmacie_id and l.produit_id=s.produit_id)
  order by a.quantite desc limit 1;
  if v_produit is null then raise exception 'Fixture stock non lotisé vendable (>2 unités) absente'; end if;

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user::text,'role','authenticated')::text,true);

  -- Ordinary in-pharmacy sale: adding to draft changes neither physical nor Marketplace stock.
  select quantite into v_stock_before from public.stocks where pharmacie_id=v_pharmacie and produit_id=v_produit;
  select coalesce(max(quantite),0) into v_market_before from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit);
  insert into public.caisses(pharmacie_id,nom,actif) values(v_pharmacie,'NAXA_TEST_215_ORDINARY',true) returning id into v_caisse;
  v_session:=public.caisse_ouvrir(v_caisse,0);
  v_vente:=public.vente_creer(v_session,null);
  perform public.vente_ajouter_produit(v_vente,v_produit,1);

  select quantite into v_stock_after from public.stocks where pharmacie_id=v_pharmacie and produit_id=v_produit;
  select coalesce(max(quantite),0) into v_market_after from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit);
  if v_stock_after<>v_stock_before or v_market_after<>v_market_before then
    raise exception 'Échec POS: un brouillon a modifié stock physique ou Marketplace';
  end if;

  select total_net into v_total from public.ventes where id=v_vente;
  perform * from public.vente_encaisser_finaliser(v_vente,v_total);
  select quantite into v_stock_after from public.stocks where pharmacie_id=v_pharmacie and produit_id=v_produit;
  select coalesce(max(quantite),0) into v_market_after from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit);
  select statut::text into v_status from public.ventes where id=v_vente;
  if v_stock_after<>v_stock_before-1 or v_market_after<>v_market_before-1 or v_status<>'payee' then
    raise exception 'Échec POS: le paiement ne synchronise pas stock physique et Marketplace exactement une fois';
  end if;

  -- Marketplace reservation: create a hold without a physical debit; cashier consumes it once.
  select quantite into v_stock_before from public.stocks where pharmacie_id=v_pharmacie and produit_id=v_produit;
  select coalesce(max(quantite),0) into v_market_before from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit);
  v_resa:=public.reserve_stock(v_pharmacie,jsonb_build_array(jsonb_build_object('produit_id',v_produit::text,'quantite',1)));
  select code_paiement,total into v_code,v_total from public.reservations where id=v_resa;
  select quantite into v_stock_after from public.stocks where pharmacie_id=v_pharmacie and produit_id=v_produit;
  select coalesce(max(quantite),0) into v_market_hold from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit);
  if v_stock_after<>v_stock_before or v_market_hold<>v_market_before-1 then
    raise exception 'Échec Marketplace: la réservation doit tenir une unité sans débit physique';
  end if;

  perform public.set_reservation_status(v_resa,'confirmee'::public.resa_statut);
  insert into public.caisses(pharmacie_id,nom,actif) values(v_pharmacie,'NAXA_TEST_215_MARKETPLACE',true) returning id into v_caisse;
  v_session:=public.caisse_ouvrir(v_caisse,0);
  select vente_id into v_vente from public.vente_reservation_encaisser(v_resa,v_session,v_total,'especes',v_code);

  select quantite into v_stock_after from public.stocks where pharmacie_id=v_pharmacie and produit_id=v_produit;
  select coalesce(max(quantite),0) into v_market_after from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit);
  select statut::text,consumed_by_vente_id into v_status,v_consumed from public.reservations where id=v_resa;
  if v_stock_after<>v_stock_before-1 or v_market_after<>v_market_hold
     or v_status<>'payee' or v_consumed is distinct from v_vente then
    raise exception 'Échec Marketplace -> caisse: hold non converti en vente payée une seule fois';
  end if;

  raise notice 'PASS 215: ordinary POS sale and Marketplace reservation both synchronize stock exactly once.';
end;
$test$;
rollback;