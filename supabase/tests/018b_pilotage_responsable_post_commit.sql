-- NAXA PASS 6 — acceptance test Responsable, POST-COMMIT enum gate
-- Prérequis : migrations 016 + 018 déjà appliquées dans l'environnement de test.
-- Ce test ne doit PAS être exécuté dans une transaction qui contient ALTER TYPE ... ADD VALUE.
-- Aucun compte réel ne doit être créé ; les profils existants sont temporairement réutilisés puis rollback.

BEGIN;

DO $$
declare
  v_admin uuid;
  v_actor uuid;
  v_a uuid;
  v_b uuid;
  v_json jsonb;
begin
  select id into v_admin from public.profiles order by created_at asc limit 1;
  select id into v_actor from public.profiles where id<>v_admin order by created_at asc limit 1;
  select id into v_a from public.pharmacies order by created_at asc limit 1;
  select id into v_b from public.pharmacies where id<>v_a order by created_at asc limit 1;

  if v_admin is null or v_actor is null or v_a is null or v_b is null then
    raise exception 'Fixture insuffisante';
  end if;

  update public.profiles set role='responsable', actif=true, pharmacie_id=v_a where id=v_actor;

  insert into public.evenements(type,pharmacie_id,resultats)
  values ('recherche',v_a,1),('recherche',v_b,1);

  perform set_config('request.jwt.claims',json_build_object('sub',v_actor::text,'role','authenticated')::text,true);
  v_json := public.stats_pilotage_scope(7);

  if v_json->>'role' <> 'responsable' then
    raise exception 'Responsable role attendu, obtenu=%',v_json->>'role';
  end if;
  if (v_json->'pharmacies'->>'total')::int <> 1 then
    raise exception 'Responsable scope attendu=1, obtenu=%',v_json->'pharmacies'->>'total';
  end if;
  if (v_json->'recherches'->>'total')::int <> 1 then
    raise exception 'Responsable recherches attendu=1 (A seulement), obtenu=%',v_json->'recherches'->>'total';
  end if;
end $$;

ROLLBACK;
