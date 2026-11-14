-- F07 / 284 — Replay-only end-to-end test for deferred cash POS sales.
-- Uses the seeded demo pharmacy/product below. Each transaction temporarily changes
-- est_demo to false so the Marketplace sellable-stock helper models a real published
-- pharmacy; the final ROLLBACK restores the demo fixture. A synthetic stocks_couts row
-- satisfies the mandatory POS cost snapshot. Both scenarios are wrapped in ROLLBACK:
-- no Auth user, profile, register, session, device, sale, payment, stock or cost persists.
-- Do NOT run this fixture against Production.

begin;
create temporary table f07_e2e_results(stage text primary key, details jsonb) on commit drop;

do $test$
declare
  v_user uuid:=gen_random_uuid();
  v_pharmacy uuid:='c57f49e0-5319-40c5-8486-967ed8316e8e';
  v_product uuid:='d38b7aff-a3a7-43b1-9c47-ed7739958e94';
  v_cashier uuid:=gen_random_uuid();
  v_device uuid:=gen_random_uuid();
  v_operation uuid:=gen_random_uuid();
  v_price_op uuid:=gen_random_uuid();
  v_stock_op uuid:=gen_random_uuid();
  v_price integer;
  v_stock_before integer;
  v_stock_after integer;
  v_sale_count integer;
  v_payment_count integer;
  v_payment_amount integer;
  v_payment_received integer;
  v_change integer;
  v_session uuid;
  v_sequence_time bigint;
  v_payload jsonb;
  v_applied jsonb;
  v_duplicate jsonb;
  v_price_conflict jsonb;
  v_price_duplicate jsonb;
  v_stock_conflict jsonb;
  v_result_sale uuid;
begin
  if not exists(select 1 from public.pharmacies where id=v_pharmacy and actif and visible_recherche and est_demo) then
    raise exception 'F07_284_FAIL: Replay demo pharmacy fixture unavailable';
  end if;

  -- Simulate a genuine, public-listed pharmacy and validated catalogue fiche
  -- only inside this transaction; final ROLLBACK restores both demo fixtures.
  update public.pharmacies set est_demo=false where id=v_pharmacy;
  update public.produits set fiche_validee=true where id=v_product;
  select prix,quantite into v_price,v_stock_before
  from public.stocks where pharmacie_id=v_pharmacy and produit_id=v_product
    and (date_peremption is null or date_peremption>=current_date)
  for update;
  if not found or v_stock_before<2
     or exists(select 1 from public.stocks_lots where pharmacie_id=v_pharmacy and produit_id=v_product) then
    raise exception 'F07_284_FAIL: expected active non-lotized Replay stock fixture unavailable';
  end if;

  -- Test-only cost record; never committed.
  insert into public.stocks_couts(pharmacie_id,produit_id,cout_unitaire,devise)
  values(v_pharmacy,v_product,v_price,'XAF')
  on conflict(pharmacie_id,produit_id) do update set cout_unitaire=excluded.cout_unitaire;

  insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(v_user,'authenticated','authenticated',
    'f07-replay-'||replace(v_user::text,'-','')||'@example.invalid',
    now(),'{"provider":"email","providers":["email"]}'::jsonb,
    '{"naxa_signup_pending":"true"}'::jsonb,now(),now());
  insert into public.profiles(id,role,username,pharmacie_id,actif,fonction_interne,niveau_interne)
  values(v_user,'caisse'::public.role_type,'f07qa'||replace(v_user::text,'-',''),v_pharmacy,true,'caisse',4);

  -- Le stock de démonstration est ancien : créer un mouvement physique récent dans la transaction.
  insert into public.stock_manager_movement_journal(
    pharmacie_id,produit_id,source_table,event_type,quantite_avant,quantite_apres,acteur_id,occurred_at,event_source
  ) values(v_pharmacy,v_product,'stocks','quantite',v_stock_before,v_stock_before,v_user,clock_timestamp(),'online_movement');
  insert into public.caisses(id,pharmacie_id,nom,actif)
  values(v_cashier,v_pharmacy,'F07 TEST — POSTE TEMPORAIRE',true);
  insert into public.appareils(id,pharmacie_id,utilisateur_id,nom,jeton_hash,cree_le,derniere_synchro,actif,installation_id)
  values(v_device,v_pharmacy,v_user,'F07 TEST — APPAREIL TEMPORAIRE',
    'f07-replay-token-'||replace(v_device::text,'-',''),
    clock_timestamp()-interval '1 second',now(),true,replace(v_device::text,'-',''));

  perform pg_catalog.set_config('request.jwt.claim.sub',v_user::text,true);
  if not public.naxa_caisse_actor_for_pharmacy(v_pharmacy) then
    raise exception 'F07_284_FAIL: cashier actor scope denied';
  end if;
  v_session:=public.caisse_ouvrir(v_cashier,10000);
  v_sequence_time:=floor(extract(epoch from clock_timestamp())*1000)::bigint;

  v_payload:=jsonb_build_object(
    'session_id',v_session,'naxa_device_sequence',1,
    'total_attendu',v_price,'montant_percu',v_price+300,
    'lignes',jsonb_build_array(jsonb_build_object(
      'produit_id',v_product,'quantite',1,'prix_unitaire',v_price
    ))
  );
  v_applied:=public.naxa_apply_offline_sale_v1(v_device,v_operation,v_payload,v_sequence_time);
  if v_applied->>'status'<>'applied' then
    raise exception 'F07_284_FAIL: offline sale not applied: %',v_applied;
  end if;
  v_result_sale:=(v_applied->>'sale_id')::uuid;

  v_duplicate:=public.naxa_apply_offline_sale_v1(v_device,v_operation,v_payload,v_sequence_time);
  if v_duplicate->>'status'<>'applied'
     or (v_duplicate->>'sale_id')::uuid<>v_result_sale then
    raise exception 'F07_284_FAIL: duplicate replay created a different sale: %',v_duplicate;
  end if;

  select quantite into v_stock_after from public.stocks
  where pharmacie_id=v_pharmacy and produit_id=v_product;
  select count(*) into v_sale_count from public.ventes
  where id=v_result_sale and caisse_session_id=v_session and statut='payee';
  select count(*),coalesce(sum(montant),0)::integer,
    coalesce(sum(montant_percu),0)::integer,coalesce(sum(monnaie_rendue),0)::integer
    into v_payment_count,v_payment_amount,v_payment_received,v_change
  from public.vente_paiements where vente_id=v_result_sale and mode='especes';

  if v_stock_after<>v_stock_before-1 or v_sale_count<>1 or v_payment_count<>1
     or v_payment_amount<>v_price or v_payment_received<>v_price+300 or v_change<>300 then
    raise exception 'F07_284_FAIL: sale side effects invalid (qty %, sales %, payments %, amount %, received %, change %)',
      v_stock_after,v_sale_count,v_payment_count,v_payment_amount,v_payment_received,v_change;
  end if;

  v_price_conflict:=public.naxa_apply_offline_sale_v1(v_device,v_price_op,
    jsonb_build_object('session_id',v_session,'naxa_device_sequence',2,'total_attendu',v_price-1,
      'montant_percu',v_price+100,'lignes',jsonb_build_array(jsonb_build_object(
        'produit_id',v_product,'quantite',1,'prix_unitaire',v_price-1))),
    v_sequence_time+1);
  if v_price_conflict->>'status'<>'conflict'
     or (select statut from public.naxa_offline_sales where operation_id=v_price_op)<>'conflict' then
    raise exception 'F07_284_FAIL: changed price was not persisted as conflict: %',v_price_conflict;
  end if;
  v_price_duplicate:=public.naxa_apply_offline_sale_v1(v_device,v_price_op,
    jsonb_build_object('session_id',v_session,'naxa_device_sequence',2,'total_attendu',v_price-1,
      'montant_percu',v_price+100,'lignes',jsonb_build_array(jsonb_build_object(
        'produit_id',v_product,'quantite',1,'prix_unitaire',v_price-1))),
    v_sequence_time+1);
  if v_price_duplicate->>'status'<>'conflict' then
    raise exception 'F07_284_FAIL: conflict replay was not idempotent: %',v_price_duplicate;
  end if;

  v_stock_conflict:=public.naxa_apply_offline_sale_v1(v_device,v_stock_op,
    jsonb_build_object('session_id',v_session,'naxa_device_sequence',3,
      'total_attendu',v_price*(v_stock_before+5),'montant_percu',v_price*(v_stock_before+5),
      'lignes',jsonb_build_array(jsonb_build_object(
        'produit_id',v_product,'quantite',v_stock_before+5,'prix_unitaire',v_price))),
    v_sequence_time+2);
  if v_stock_conflict->>'status'<>'conflict'
     or (select statut from public.naxa_offline_sales where operation_id=v_stock_op)<>'conflict' then
    raise exception 'F07_284_FAIL: insufficient stock was not persisted as conflict: %',v_stock_conflict;
  end if;
  select quantite into v_stock_after from public.stocks
  where pharmacie_id=v_pharmacy and produit_id=v_product;
  if v_stock_after<>v_stock_before-1 then
    raise exception 'F07_284_FAIL: failed/conflicting replays mutated physical stock';
  end if;

  insert into pg_temp.f07_e2e_results values
    ('sale_replay',jsonb_build_object('status',v_applied->>'status','total',v_price,'change',v_change)),
    ('idempotency',jsonb_build_object('same_sale_id',true,'sale_rows',v_sale_count,
      'payment_rows',v_payment_count,'stock_before',v_stock_before,'stock_after',v_stock_after)),
    ('changed_price',jsonb_build_object('first',v_price_conflict->>'status',
      'duplicate',v_price_duplicate->>'status','persisted','conflict')),
    ('insufficient_stock',jsonb_build_object('status',v_stock_conflict->>'status','persisted','conflict'));
end
$test$;
select stage,details from f07_e2e_results order by stage;
rollback;

begin;
create temporary table f07_close_results(stage text primary key, details jsonb) on commit drop;
do $close_test$
declare
  u uuid:=gen_random_uuid();
  p uuid:='c57f49e0-5319-40c5-8486-967ed8316e8e';
  product uuid:='d38b7aff-a3a7-43b1-9c47-ed7739958e94';
  register_id uuid:=gen_random_uuid();
  device_id uuid:=gen_random_uuid();
  op_id uuid:=gen_random_uuid();
  price integer;
  before_qty integer;
  after_qty integer;
  session_id uuid;
  timestamp_ms bigint;
  payload jsonb;
  result jsonb;
  close_result record;
  session_status text;
  sale_rows integer;
begin
  if not exists(select 1 from public.pharmacies where id=p and actif and visible_recherche and est_demo) then
    raise exception 'F07_284_FAIL: Replay demo pharmacy fixture unavailable for closure';
  end if;

  -- Simulate a genuine, public-listed pharmacy and validated catalogue fiche
  -- only inside this transaction; final ROLLBACK restores both demo fixtures.
  update public.pharmacies set est_demo=false where id=p;
  update public.produits set fiche_validee=true where id=product;
  select prix,quantite into price,before_qty from public.stocks
  where pharmacie_id=p and produit_id=product and (date_peremption is null or date_peremption>=current_date)
  for update;
  if not found or before_qty<2 then raise exception 'F07_284_FAIL: closure stock fixture unavailable'; end if;
  insert into public.stocks_couts(pharmacie_id,produit_id,cout_unitaire,devise)
  values(p,product,price,'XAF')
  on conflict(pharmacie_id,produit_id) do update set cout_unitaire=excluded.cout_unitaire;
  insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(u,'authenticated','authenticated','f07-close-'||replace(u::text,'-','')||'@example.invalid',now(),
    '{"provider":"email","providers":["email"]}'::jsonb,'{"naxa_signup_pending":"true"}'::jsonb,now(),now());
  insert into public.profiles(id,role,username,pharmacie_id,actif,fonction_interne,niveau_interne)
  values(u,'caisse'::public.role_type,'f07clo'||replace(u::text,'-',''),p,true,'caisse',4);
  insert into public.stock_manager_movement_journal(
    pharmacie_id,produit_id,source_table,event_type,quantite_avant,quantite_apres,acteur_id,occurred_at,event_source
  ) values(p,product,'stocks','quantite',before_qty,before_qty,u,clock_timestamp(),'online_movement');
  insert into public.caisses(id,pharmacie_id,nom,actif) values(register_id,p,'F07 CLOSE TEST',true);
  insert into public.appareils(id,pharmacie_id,utilisateur_id,nom,jeton_hash,cree_le,derniere_synchro,actif,installation_id)
  values(device_id,p,u,'F07 CLOSE TEST','f07-close-'||replace(device_id::text,'-',''),
    clock_timestamp()-interval '1 second',now(),true,replace(device_id::text,'-',''));
  perform set_config('request.jwt.claim.sub',u::text,true);
  session_id:=public.caisse_ouvrir(register_id,10000);
  timestamp_ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  payload:=jsonb_build_object('session_id',session_id,'naxa_device_sequence',1,
    'total_attendu',price,'montant_percu',price+300,
    'lignes',jsonb_build_array(jsonb_build_object('produit_id',product,'quantite',1,'prix_unitaire',price)));
  result:=public.naxa_apply_offline_sale_v1(device_id,op_id,payload,timestamp_ms);
  if result->>'status'<>'applied' then raise exception 'F07_284_FAIL: closure scenario sale not applied: %',result; end if;

  select * into close_result from public.caisse_cloturer(session_id,10000+price,null::text);
  select statut::text into session_status from public.caisses_sessions where id=session_id;
  select quantite into after_qty from public.stocks where pharmacie_id=p and produit_id=product;
  select count(*) into sale_rows from public.ventes where caisse_session_id=session_id and statut='payee';
  if session_status<>'cloturee' or close_result.ecart<>0 or after_qty<>before_qty-1 or sale_rows<>1 then
    raise exception 'F07_284_FAIL: closure assertions failed (status %, discrepancy %, qty %, sales %)',
      session_status,close_result.ecart,after_qty,sale_rows;
  end if;
  insert into pg_temp.f07_close_results values
    ('sale',jsonb_build_object('status',result->>'status','total',price,'change',result->>'monnaie_rendue')),
    ('closure',jsonb_build_object('status',session_status,'theoretical',close_result.total_theorique,
      'counted',close_result.total_compte,'discrepancy',close_result.ecart)),
    ('stock',jsonb_build_object('before',before_qty,'after',after_qty,'paid_sales',sale_rows));
end
$close_test$;
select stage,details from f07_close_results order by stage;
rollback;