-- MC-03 — end-to-end server contract for device-token stock synchronization.
-- The fixture is isolated in a PL/pgSQL subtransaction and always rolled back.
do $test$
declare
  v_uid uuid := gen_random_uuid();
  v_device uuid := gen_random_uuid();
  v_op1 uuid := gen_random_uuid();
  v_op2 uuid := gen_random_uuid();
  v_op_online uuid := gen_random_uuid();
  v_op3 uuid := gen_random_uuid();
  v_op4 uuid := gen_random_uuid();
  v_installation uuid := gen_random_uuid();
  v_stock record;
  v_target integer;
  v_after integer;
  v_result jsonb;
  v_modified_ms bigint;
  v_server_quantity integer;
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
    insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,max_responsables,max_caisses,active)
    values(v_stock.pharmacie_id,'ORPHELIN',v_uid,0,0,true)
    on conflict(pharmacie_id) do update
      set architecture_code='ORPHELIN',assigned_by=v_uid,max_responsables=0,max_caisses=0,active=true;
    insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by,active)
    values(v_uid,'EDIT_STOCK_QUANTITY',v_stock.pharmacie_id,'PHARMACIE',v_uid,true)
    on conflict(profile_id,privilege_code,pharmacie_id,scope_type) do update
      set granted_by=v_uid,active=true;

    insert into public.appareils(id,pharmacie_id,utilisateur_id,nom,jeton_hash,installation_id,actif,derniere_synchro)
    values(v_device,v_stock.pharmacie_id,v_uid,'MC03 isolated test device',
      'mc03-test-' || replace(v_device::text,'-',''),v_installation,true,now());

    -- Use a client millisecond strictly after the device activation timestamp.
    v_modified_ms := (extract(epoch from clock_timestamp() + interval '1 second') * 1000)::bigint;

    v_target := v_stock.quantite + 1;
    v_result := public.naxa_apply_offline_operation_v1(
      v_device,v_op1,'stock_set_quantity',
      jsonb_build_object('produit_id',v_stock.produit_id,'quantite',v_target,'base_updated_at',v_stock.updated_at,'naxa_device_sequence',1),
      v_modified_ms
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
      jsonb_build_object('produit_id',v_stock.produit_id,'quantite',v_target,'base_updated_at',v_stock.updated_at,'naxa_device_sequence',1),
      v_modified_ms
    );
    if v_result->>'status' is distinct from 'applied' then
      raise exception 'MC-03: duplicate replay is not idempotent: %',v_result;
    end if;
    select quantite into v_after from public.stocks
      where pharmacie_id=v_stock.pharmacie_id and produit_id=v_stock.produit_id;
    if v_after is distinct from v_target then
      raise exception 'MC-03: duplicate replay changed the stock quantity';
    end if;

    -- Materialize a server online count and force the exact same millisecond
    -- as the offline operation to exercise the explicit server tie priority.
    v_server_quantity := v_target + 10;
    v_result := public.offline_stock_set_quantity(
      v_op_online,v_stock.pharmacie_id,v_stock.produit_id,v_server_quantity,v_stock.updated_at
    );
    if v_result->>'status' is distinct from 'applied' then
      raise exception 'MC-03: online authoritative count failed: %',v_result;
    end if;
    update public.offline_operations
      set modified_at=to_timestamp(v_modified_ms::double precision/1000.0)
      where operation_id=v_op_online and device_id is null and device_sequence is null;
    if not found then raise exception 'MC-03: online count was not stored as server-owned'; end if;

    v_result := public.naxa_apply_offline_operation_v1(
      v_device,v_op2,'stock_set_quantity',
      jsonb_build_object('produit_id',v_stock.produit_id,'quantite',v_target + 20,'base_updated_at',v_stock.updated_at,'naxa_device_sequence',2),
      v_modified_ms
    );
    if v_result->>'status' is distinct from 'conflict'
      or v_result->>'reason' is distinct from 'superseded_by_newer_write' then
      raise exception 'MC-03: equal timestamp must favor server online count: %',v_result;
    end if;
    if (v_result->>'winner_operation_id')::uuid is distinct from v_op_online then
      raise exception 'MC-03: server online count was not selected as the LWW winner: %',v_result;
    end if;
    select quantite into v_after from public.stocks
      where pharmacie_id=v_stock.pharmacie_id and produit_id=v_stock.produit_id;
    if v_after is distinct from v_server_quantity then
      raise exception 'MC-03: losing offline tie overwrote the server count';
    end if;

    -- Revoking the explicit stock privilege must stop a later device mutation.
    update public.naxa_profile_privileges set active=false
      where profile_id=v_uid and privilege_code='EDIT_STOCK_QUANTITY' and pharmacie_id=v_stock.pharmacie_id;
    v_result := public.naxa_apply_offline_operation_v1(
      v_device,v_op3,'stock_set_quantity',
      jsonb_build_object('produit_id',v_stock.produit_id,'quantite',v_target + 30,'base_updated_at',v_stock.updated_at,'naxa_device_sequence',3),
      v_modified_ms + 100
    );
    if v_result->>'status' is distinct from 'rejected'
      or v_result->>'reason' is distinct from 'stock_edit_privilege_denied' then
      raise exception 'MC-03: revoked stock privilege must be rejected: %',v_result;
    end if;
    if exists(select 1 from public.offline_operations where operation_id=v_op3) then
      raise exception 'MC-03: revoked privilege must not create an operation';
    end if;

    -- A role downgrade/unauthorized role must also be rejected at synchronization time.
    update public.profiles set role='admin' where id=v_uid;
    v_result := public.naxa_apply_offline_operation_v1(
      v_device,v_op4,'stock_set_quantity',
      jsonb_build_object('produit_id',v_stock.produit_id,'quantite',v_target + 40,'base_updated_at',v_stock.updated_at,'naxa_device_sequence',4),
      v_modified_ms + 200
    );
    if v_result->>'status' is distinct from 'rejected'
      or v_result->>'reason' is distinct from 'professional_inactive_or_role_unauthorized' then
      raise exception 'MC-03: unauthorized role must be rejected at sync: %',v_result;
    end if;
    if exists(select 1 from public.offline_operations where operation_id=v_op4) then
      raise exception 'MC-03: unauthorized role must not create an operation';
    end if;

    raise exception 'MC03_TEST_FIXTURE_ROLLBACK';
  exception when others then
    if sqlerrm <> 'MC03_TEST_FIXTURE_ROLLBACK' then raise; end if;
  end;
end $test$;

select '221_offline_device_sync_mutations PASS (all test fixtures rolled back)' as resultat;
