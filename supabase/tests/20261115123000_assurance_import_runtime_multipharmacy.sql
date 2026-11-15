-- Test runtime positif du rapprochement assureur sur Replay.
-- Utilise les profils Promoteur/Client et pharmacies déjà présents.
-- Toutes les données métier et les imports temporaires sont annulés au ROLLBACK.
begin;

do $runtime_import$
declare
  v_promoter uuid;
  v_client uuid;
  v_insurer uuid;
  v_pharmacy_a uuid;
  v_pharmacy_b uuid;
  v_coverage uuid;
  v_result jsonb;
  v_adherent text;
  v_policy text;
  v_sha text;
  v_verification_a text;
  v_verification_b text;
  v_replaced integer;
begin
  select p.id into v_promoter
  from public.profiles p
  where p.role::text='promoteur' and p.actif=true
    and private.naxa_promoteur_valide(p.id)
    and (select count(*) from public.promoteur_pharmacies pp
      join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif
      where pp.promoteur_id=p.id and pp.actif)>=2
  order by p.created_at,p.id
  limit 1;

  select p.id into v_client
  from public.profiles p
  where p.role::text='client' and p.actif=true
  order by p.created_at,p.id limit 1;

  select a.id into v_insurer
  from public.assureurs a where a.actif=true
  order by a.nom,a.id limit 1;

  if v_promoter is null or v_client is null or v_insurer is null then
    raise exception 'Replay doit contenir un Promoteur avec deux pharmacies, un Client et un assureur actif';
  end if;

  select (array_agg(pp.pharmacie_id order by pp.pharmacie_id))[1],
         (array_agg(pp.pharmacie_id order by pp.pharmacie_id))[2]
  into v_pharmacy_a,v_pharmacy_b
  from public.promoteur_pharmacies pp
  join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif
  where pp.promoteur_id=v_promoter and pp.actif;

  if not private.naxa_scope_allows(v_promoter,v_pharmacy_a,'PHARMACIE')
     or not private.naxa_scope_allows(v_promoter,v_pharmacy_b,'PHARMACIE') then
    raise exception 'Le Promoteur ne dispose pas du périmètre actif sur les deux pharmacies';
  end if;

  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('role','authenticated','sub',v_promoter::text)::text,true);

  v_adherent:='E2E-'||upper(replace(gen_random_uuid()::text,'-',''));
  v_policy:='POL-'||upper(replace(gen_random_uuid()::text,'-',''));

  insert into public.couvertures_assurance(
    client_id,assureur_id,numero_adherent,numero_police,date_debut,
    plafond,taux_prise_en_charge,actif,verification_statut
  ) values(
    v_client,v_insurer,v_adherent,v_policy,current_date,
    null,100,true,'non_verifiee'
  ) returning id into v_coverage;

  -- Deux imports delta indépendants : même couverture, deux pharmacies.
  v_sha:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  v_result:=public.assurance_import_simuler_mode(
    v_pharmacy_a,v_insurer,'E2E-DELTA-A-'||substr(v_sha,1,12),'liste-e2e-a.csv',v_sha,
    jsonb_build_array(jsonb_build_object(
      'numero_adherent',v_adherent,'numero_police',v_policy,
      'date_debut',current_date::text,'statut','actif'
    )),'delta'
  );
  if (v_result->>'correspondances')::integer<>1
     or (v_result->>'invalides')::integer<>0
     or (v_result->>'ambiguite')::integer<>0 then
    raise exception 'Le rapprochement delta A doit avoir une correspondance unique : %',v_result;
  end if;
  perform public.assurance_import_appliquer((v_result->>'import_id')::uuid);

  v_sha:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  v_result:=public.assurance_import_simuler_mode(
    v_pharmacy_b,v_insurer,'E2E-DELTA-B-'||substr(v_sha,1,12),'liste-e2e-b.csv',v_sha,
    jsonb_build_array(jsonb_build_object(
      'numero_adherent',v_adherent,'numero_police',v_policy,
      'date_debut',current_date::text,'statut','actif'
    )),'delta'
  );
  if (v_result->>'correspondances')::integer<>1 then
    raise exception 'Le rapprochement delta B doit avoir une correspondance unique : %',v_result;
  end if;
  perform public.assurance_import_appliquer((v_result->>'import_id')::uuid);

  select v.statut into v_verification_a
  from public.assurance_couverture_verifications v
  where v.couverture_id=v_coverage and v.pharmacie_id=v_pharmacy_a
  order by v.verification_le desc,v.id desc limit 1;
  select v.statut into v_verification_b
  from public.assurance_couverture_verifications v
  where v.couverture_id=v_coverage and v.pharmacie_id=v_pharmacy_b
  order by v.verification_le desc,v.id desc limit 1;

  if v_verification_a<>'verifiee' or v_verification_b<>'verifiee' then
    raise exception 'Une couverture doit être vérifiée indépendamment dans A et B : A=% B=%',
      v_verification_a,v_verification_b;
  end if;

  -- Une liste complète suspend l'adhésion de A, mais conserve la vérification de B.
  v_sha:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  v_result:=public.assurance_import_simuler_mode(
    v_pharmacy_a,v_insurer,'E2E-FULL-A-'||substr(v_sha,1,12),'liste-e2e-full-a.csv',v_sha,
    jsonb_build_array(jsonb_build_object(
      'numero_adherent',v_adherent,'numero_police',v_policy,
      'date_debut',current_date::text,'statut','suspendu'
    )),'complet'
  );
  if (v_result->>'correspondances')::integer<>1 then
    raise exception 'La liste complète suspendue doit être rapprochée : %',v_result;
  end if;
  perform public.assurance_import_appliquer((v_result->>'import_id')::uuid);

  select v.statut into v_verification_a
  from public.assurance_couverture_verifications v
  where v.couverture_id=v_coverage and v.pharmacie_id=v_pharmacy_a
  order by v.verification_le desc,v.id desc limit 1;
  select v.statut into v_verification_b
  from public.assurance_couverture_verifications v
  where v.couverture_id=v_coverage and v.pharmacie_id=v_pharmacy_b
  order by v.verification_le desc,v.id desc limit 1;

  select count(*) into v_replaced
  from public.assurance_couverture_verifications v
  where v.couverture_id=v_coverage and v.pharmacie_id=v_pharmacy_a
    and v.statut='remplacee';

  if v_verification_a<>'suspendue' or v_verification_b<>'verifiee' or v_replaced<>1 then
    raise exception 'Le remplacement complet doit isoler la suspension A : A=% B=% remplacées=%',
      v_verification_a,v_verification_b,v_replaced;
  end if;
end
$runtime_import$;

select '20261115123000_assurance_import_runtime_multipharmacy PASS' as result;
rollback;
