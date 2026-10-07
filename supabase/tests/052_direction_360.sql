-- NAXA — Pilotage 360° Partie 4 : test contradictoire Direction 360°
begin;

do $$
declare
  admin_id uuid;
  ph_id uuid;
  prod_id uuid;
  v jsonb;
begin
  select id into admin_id
  from public.profiles
  order by created_at
  limit 1;

  if admin_id is null then
    raise exception 'PART4_DIRECTION_FIXTURE_ADMIN_MISSING';
  end if;

  insert into public.pharmacies(id,nom,ville,lat,lng,actif)
  values(gen_random_uuid(),'__PART4_DIRECTION__','Yaoundé',3.848,11.502,true)
  returning id into ph_id;

  update public.profiles
  set role='admin',actif=true,pharmacie_id=null,parent_profile_id=null,
      fonction_interne=null,niveau_interne=null,niveau_hierarchique=0,
      architecture_code=null,custom_role_code=null
  where id=admin_id;

  insert into public.produits(nom,dci,dosage,forme)
  values('__PART4_DIRECTION_PROD__','TEST','1','unite')
  returning id into prod_id;

  insert into public.reservations(client_id,pharmacie_id,statut,total,expires_at)
  values(admin_id,ph_id,'payee',15000,now()+interval '1 hour');

  insert into public.stocks(pharmacie_id,produit_id,prix,quantite)
  values(ph_id,prod_id,1500,0);

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub',admin_id,'role','authenticated')::text,
    true
  );

  v:=public.stats_direction_360(30);

  if v->>'role' <> 'admin' then
    raise exception 'PART4_FAIL_ROLE';
  end if;

  if (v->'network'->>'pharmacies_actives')::bigint < 1 then
    raise exception 'PART4_FAIL_NETWORK';
  end if;

  if (v->'commercial'->>'ca_xaf')::bigint <> 15000 then
    raise exception 'PART4_FAIL_CANONICAL_CA';
  end if;

  if (v->'commercial'->>'ventes')::bigint <> 1 then
    raise exception 'PART4_FAIL_DOUBLE_COUNT';
  end if;

  if (v->'performance'->>'ruptures_lignes')::bigint < 1 then
    raise exception 'PART4_FAIL_STOCK_RUPTURE';
  end if;

  if (v->'security'->>'sessions_actives' is null) then
    raise exception 'PART4_FAIL_SECURITY_METRIC';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub',admin_id,'role','authenticated')::text,
    true
  );

  begin
    perform public.stats_direction_360(0);
    raise exception 'PART4_FAIL_INVALID_PERIOD_ACCEPTED';
  exception when others then
    if sqlerrm='PART4_FAIL_INVALID_PERIOD_ACCEPTED' then raise; end if;
  end;

  raise notice 'PART4_DIRECTION_360_GREEN';
end $$;

rollback;
