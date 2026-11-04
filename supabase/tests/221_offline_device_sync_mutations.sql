-- MC-03 — end-to-end server contract for device-token stock synchronization.
-- The fixture is isolated in a PL/pgSQL subtransaction and always rolled back.
do $test$
declare
  v_uid uuid := gen_random_uuid();
  v_device uuid := gen_random_uuid();
  v_op1 uuid := gen_random_uuid();
  v_op2 uuid := gen_random_uuid();
  v_installation uuid := gen_random_uuid();
  v_stock record;
  v_target integer;
  v_after integer;
  v_result jsonb;
begin
  begin
    select s.pharmacie_id, s.produit_id, s.quantite, s.updated_at
      into v_stock
    from public.stocks s
    where not exists (
      select 1 from public.stocks_lots l
      where l.pharmacie_id=s.pharmacie_id and l.produit_id=s.produit_id
    )
    order by s.updated_at desc
    limit 1;
    if not found then
      raise exception 'MC-03: test requires one stock row without lots';
    end if;

    insert into auth.users(id,aud,role,email,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
    values(v_uid,'authenticated','authenticated',
      'mc03-' || replace(v_uid::text,'-','') || '@example.invalid',
      now(),now(),'{}'::jsonb,'{"naxa_signup_pending":"true"}'::jsonb);

    insert into public.profiles(id,role,pharmacie_id,actif,fonction_interne)
    values(v_uid,'caisse',v_stock.pharmacie_id,true,null)
    on conflict(id) do update
      set role='caisse',pharmacie_id=excluded.pharmacie_id,actif=true,fonction_interne=null;

    perform set_config('request.jwt.claim.sub',v_uid::text,true);

    insert into public.appareils(id,pharmacie_id,utilisateur_id,nom,jeton_hash,installation_id,actif,derniere_synchro)
    values(v_device,v_stock.pharmacie_id,v_uid,'MC03 isolated test device',
      'mc03-test-' || replace(v_device::text,'-',''),v_installation,true,now());

    v_target := v_stock.quantite + 1;
    v_result := public.naxa_apply_offline_operation_v1(
      v_device,v_op1,'stock_set_quantity',
      jsonb_build_object('produit_id',v_stock.produit_id,'quantite',v_target,'base_updated_at',v_stock.updated_at),
      (extract(epoch from now()) * 1000)::bigint
    );
    if v_result->>'status' is distinct from 'applied' then
      raise exception 'MC-03: valid stock operation failed: %',v_result;
    end if;
    select quantite into v_after from public.stocks
      where pharmacie_id=v_stock.pharmacie_id and produit_id=v_stock.produit_id;
    if v_after is distinct from v_target then
      raise exception 'MC-03: valid operation did not update quantity';
    end if;

    v_result := public.naxa_apply_offline_operation_v1(
      v_device,v_op1,'stock_set_quantity',
      jsonb_build_object('produit_id',v_stock.produit_id,'quantite',v_target,'base_updated_at',v_stock.updated_at),
      (extract(epoch from now()) * 1000)::bigint
    );
    if v_result->>'status' is distinct from 'applied' then
      raise exception 'MC-03: duplicate replay is not idempotent: %',v_result;
    end if;
    select quantite into v_after from public.stocks
      where pharmacie_id=v_stock.pharmacie_id and produit_id=v_stock.produit_id;
    if v_after is distinct from v_target then
      raise exception 'MC-03: duplicate replay changed the stock quantity';
    end if;

    v_result := public.naxa_apply_offline_operation_v1(
      v_device,v_op2,'stock_set_quantity',
      jsonb_build_object('produit_id',v_stock.produit_id,'quantite',v_stock.quantite + 2,'base_updated_at',v_stock.updated_at),
      (extract(epoch from now()) * 1000)::bigint
    );
    if v_result->>'status' is distinct from 'conflict' then
      raise exception 'MC-03: stale write was not rejected as conflict: %',v_result;
    end if;
    select quantite into v_after from public.stocks
      where pharmacie_id=v_stock.pharmacie_id and produit_id=v_stock.produit_id;
    if v_after is distinct from v_target then
      raise exception 'MC-03: conflicting operation changed the stock quantity';
    end if;

    raise exception 'MC03_TEST_FIXTURE_ROLLBACK';
  exception when others then
    if sqlerrm <> 'MC03_TEST_FIXTURE_ROLLBACK' then raise; end if;
  end;
end $test$;

select '221_offline_device_sync_mutations PASS (all test fixtures rolled back)' as resultat;
