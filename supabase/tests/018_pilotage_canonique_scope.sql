-- NAXA 018 — acceptance test canonique Pilotage par scope
-- Exécution attendue dans une transaction ; ce test ne doit laisser aucune donnée persistante.
begin;

do $$
declare
  v_admin uuid;
  v_promoteur uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_json jsonb;
begin
  select id into v_admin from public.profiles order by created_at asc limit 1;
  select id into v_promoteur from public.profiles where id <> v_admin order by created_at asc limit 1;
  if v_admin is null or v_promoteur is null then
    raise exception 'Fixture insuffisante: deux profils requis';
  end if;

  select id into v_a from public.pharmacies order by created_at asc limit 1;
  select id into v_b from public.pharmacies where id <> v_a order by created_at asc limit 1;
  select id into v_c from public.pharmacies where id not in (v_a,v_b) order by created_at asc limit 1;
  if v_a is null or v_b is null or v_c is null then
    raise exception 'Fixture insuffisante: trois pharmacies requises';
  end if;

  update public.profiles set role='admin', actif=true, pharmacie_id=null where id=v_admin;
  update public.profiles set role='promoteur', actif=true, pharmacie_id=v_a where id=v_promoteur;
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(v_promoteur,v_a,true),(v_promoteur,v_b,true)
  on conflict (promoteur_id,pharmacie_id) do update set actif=true;

  update public.pharmacies set est_demo=false where id in (v_a,v_b,v_c);

  insert into public.evenements(type,pharmacie_id,resultats) values
    ('recherche',null,0),
    ('recherche',v_a,1),
    ('recherche',v_c,1);

  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);
  v_json := public.stats_pilotage_scope(7);
  if (v_json->'pharmacies'->>'total')::int <> 3 then
    raise exception 'Admin scope attendu=3, obtenu=%',v_json->'pharmacies'->>'total';
  end if;
  if (v_json->'recherches'->>'total')::int <> 3 then
    raise exception 'Admin recherches attendu=3, obtenu=%',v_json->'recherches'->>'total';
  end if;

  perform set_config('request.jwt.claims',json_build_object('sub',v_promoteur::text,'role','authenticated')::text,true);
  v_json := public.stats_pilotage_scope(7);
  if (v_json->'pharmacies'->>'total')::int <> 2 then
    raise exception 'Promoteur scope attendu=2, obtenu=%',v_json->'pharmacies'->>'total';
  end if;
  if (v_json->'recherches'->>'total')::int <> 1 then
    raise exception 'Promoteur recherches attendu=1 (A seulement), obtenu=%',v_json->'recherches'->>'total';
  end if;

  update public.profiles set role='responsable', pharmacie_id=v_a, actif=true where id=v_promoteur;
  v_json := public.stats_pilotage_scope(7);
  if v_json->'pharmacies'->>'total' <> '1' then
    raise exception 'Responsable scope attendu=1, obtenu=%',v_json->'pharmacies'->>'total';
  end if;
  if v_json->'recherches'->>'total' <> '1' then
    raise exception 'Responsable recherches attendu=1, obtenu=%',v_json->'recherches'->>'total';
  end if;

  update public.profiles set role='caisse', pharmacie_id=v_a, actif=true where id=v_promoteur;
  v_json := public.stats_pilotage_scope(7);
  if v_json->'pharmacies'->>'total' <> '1' then
    raise exception 'Caisse scope attendu=1, obtenu=%',v_json->'pharmacies'->>'total';
  end if;

  update public.profiles set role='client', pharmacie_id=null, actif=true where id=v_promoteur;
  begin
    perform public.stats_pilotage_scope(7);
    raise exception 'Client ne doit pas accéder au pilotage';
  exception when others then
    if sqlerrm <> 'Accès pilotage refusé' then
      raise;
    end if;
  end;
end
$$;

rollback;
