-- NAXA 219 test — FEFO lot allocation stays synchronized with aggregate and Marketplace stock.
begin;
do $test$
declare
  v_user uuid;
  v_pharmacie uuid;
  v_produit uuid;
  v_stock_before integer;
  v_market_before integer;
  v_stock_after integer;
  v_market_after integer;
  v_caisse uuid;
  v_session uuid;
  v_vente uuid;
  v_total integer;
  v_early_lot uuid;
  v_late_lot uuid;
  v_line_lot uuid;
  v_lots_total integer;
begin
  select id into v_user from public.profiles where role::text='admin' and actif=true order by created_at limit 1;
  if v_user is null then
    v_user:=gen_random_uuid();
    set local session_replication_role=replica;
    insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
    values(v_user,'authenticated','authenticated',
      'naxa219a_'||substr(replace(v_user::text,'-',''),1,12)||'@invalid.local','',now(),now(),'{}'::jsonb,'{}'::jsonb);
    set local session_replication_role=origin;
    insert into public.profiles(id,role,username,actif)
    values(v_user,'admin','naxa219a_'||substr(replace(v_user::text,'-',''),1,12),true);
  end if;
  select s.pharmacie_id,s.produit_id,s.quantite into v_pharmacie,v_produit,v_stock_before
  from public.stocks s
  join public.pharmacies ph on ph.id=s.pharmacie_id and ph.actif and ph.visible_recherche
  cross join lateral public.marketplace_offre_stock_disponible(s.pharmacie_id,s.produit_id) a
  where s.quantite>2 and a.quantite>2
    and not exists(select 1 from public.stocks_lots l where l.pharmacie_id=s.pharmacie_id and l.produit_id=s.produit_id)
  order by a.quantite desc limit 1;
  if v_produit is null then raise exception 'Fixture de stock non lotisé absente'; end if;
  -- POS freezes the purchase cost on each sale line; provide a deterministic test cost.
  insert into public.stocks_couts(pharmacie_id,produit_id,cout_unitaire,devise)
  values(v_pharmacie,v_produit,50,'XAF')
  on conflict(pharmacie_id,produit_id) do update set cout_unitaire=excluded.cout_unitaire,devise=excluded.devise;
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user::text,'role','authenticated')::text,true);

  select coalesce(max(quantite),0) into v_market_before from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit);
  insert into public.stocks_lots(pharmacie_id,produit_id,numero_lot,date_peremption,quantite,bloque)
  values(v_pharmacie,v_produit,'NAXA-TEST-FEFO-EARLY',current_date+30,1,false)
  returning id into v_early_lot;
  insert into public.stocks_lots(pharmacie_id,produit_id,numero_lot,date_peremption,quantite,bloque)
  values(v_pharmacie,v_produit,'NAXA-TEST-FEFO-LATE',current_date+60,v_stock_before-1,false)
  returning id into v_late_lot;

  insert into public.caisses(pharmacie_id,nom,actif) values(v_pharmacie,'NAXA_TEST_FEFO_219',true) returning id into v_caisse;
  v_session:=public.caisse_ouvrir(v_caisse,0);
  v_vente:=public.vente_creer(v_session,null);
  perform public.vente_ajouter_produit(v_vente,v_produit,1);
  select quantite into v_stock_after from public.stocks where pharmacie_id=v_pharmacie and produit_id=v_produit;
  select coalesce(max(quantite),0) into v_market_after from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit);
  if v_stock_after<>v_stock_before or v_market_after<>v_market_before then raise exception 'Le brouillon a modifié le stock lotisé'; end if;

  select total_net into v_total from public.ventes where id=v_vente;
  perform * from public.vente_encaisser_finaliser(v_vente,v_total);
  select quantite into v_stock_after from public.stocks where pharmacie_id=v_pharmacie and produit_id=v_produit;
  select coalesce(max(quantite),0) into v_market_after from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit);
  select lot_id into v_line_lot from public.vente_lignes where vente_id=v_vente and produit_id=v_produit limit 1;
  select coalesce(sum(quantite),0)::integer into v_lots_total from public.stocks_lots where pharmacie_id=v_pharmacie and produit_id=v_produit;
  if v_stock_after<>v_stock_before-1 or v_market_after<>v_market_before-1 then raise exception 'Le débit lotisé ne synchronise pas stock et Marketplace'; end if;
  if v_line_lot is distinct from v_early_lot then raise exception 'Le lot FEFO le plus proche n’a pas été consommé en premier'; end if;
  if v_lots_total<>v_stock_after then raise exception 'La somme des lots diverge du stock agrégé'; end if;
  if (select quantite from public.stocks_lots where id=v_early_lot)<>0 then raise exception 'Le lot FEFO attendu n’a pas été décrémenté'; end if;
  if (select quantite from public.stocks_lots where id=v_late_lot)<>v_stock_before-1 then raise exception 'Le lot suivant a été modifié à tort'; end if;
  raise notice 'PASS: FEFO lot debited once; aggregate, lot sum, sale line and Marketplace remain synchronized.';
end;
$test$;
rollback;