-- NAXA — contrat autonome du Partenaire indépendant et séparation salarié / titulaire.
-- Le test utilise uniquement des identités et données temporaires ; tout est annulé.
begin;

do $test$
declare
  v_admin uuid:=gen_random_uuid();
  v_owner uuid:=gen_random_uuid();
  v_employee uuid:=gen_random_uuid();
  v_patient uuid:=gen_random_uuid();
  v_partner uuid:=gen_random_uuid();
  v_template uuid:=gen_random_uuid();
  v_agreement uuid:=gen_random_uuid();
  v_offer uuid:=gen_random_uuid();
  v_count integer;
  v_weekday smallint:=extract(isodow from timezone('Africa/Douala',now()))::smallint;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at)
  values
    (v_admin,'authenticated','authenticated','naxa-agreement-admin-'||replace(v_admin::text,'-','')||'@example.invalid','',now(),'{}'::jsonb,'{"naxa_signup_pending":true}'::jsonb,false,now(),now()),
    (v_owner,'authenticated','authenticated','naxa-agreement-owner-'||replace(v_owner::text,'-','')||'@example.invalid','',now(),'{}'::jsonb,'{"naxa_signup_pending":true}'::jsonb,false,now(),now()),
    (v_employee,'authenticated','authenticated','naxa-agreement-staff-'||replace(v_employee::text,'-','')||'@example.invalid','',now(),'{}'::jsonb,'{"naxa_signup_pending":true}'::jsonb,false,now(),now()),
    (v_patient,'authenticated','authenticated','naxa-agreement-patient-'||replace(v_patient::text,'-','')||'@example.invalid','',now(),'{}'::jsonb,'{"naxa_signup_pending":true}'::jsonb,false,now(),now());

  insert into public.profiles(id,role,username,actif)
  values
    (v_admin,'admin','naxa_ag_admin_'||substr(replace(v_admin::text,'-',''),1,12),true),
    (v_owner,'client','naxa_ag_owner_'||substr(replace(v_owner::text,'-',''),1,12),true),
    (v_employee,'client','naxa_ag_staff_'||substr(replace(v_employee::text,'-',''),1,12),true),
    (v_patient,'client','naxa_ag_patient_'||substr(replace(v_patient::text,'-',''),1,12),true);

  insert into public.partners(id,name,partner_type,city,status,created_by,latitude,longitude)
  values(v_partner,'NAXA E2E Partenaire','professionnel_domicile','Yaoundé','active',v_admin,3.86,11.52);

  insert into public.partner_members(partner_id,user_id,member_role)
  values(v_partner,v_owner,'owner'),(v_partner,v_employee,'manager');

  insert into public.suivi_professionals(
    user_id,professional_role,display_name,verified,verified_by,registration_number,
    issuing_authority,specialty,verification_status,verified_at
  ) values
    (v_owner,'medecin','Titulaire E2E',true,v_admin,'REG-OWNER','Autorité E2E','Médecine générale','verified',now()),
    (v_employee,'infirmier','Salarié E2E',true,v_admin,'REG-STAFF','Autorité E2E','Soins infirmiers','verified',now());

  insert into public.partner_independent_agreement_templates(
    id,partner_type,version,title,body,sha256,status,created_by,published_by,published_at
  ) values (
    v_template,'professionnel_domicile','E2E-1','Convention E2E',
    repeat('Texte juridique de test uniquement. ',8),
    repeat('a',64),'published',v_admin,v_admin,now()
  );

  insert into public.partner_independent_agreements(
    id,partner_id,professional_user_id,template_id,agreement_version,agreement_sha256,
    status,accepted_at,accepted_by,approved_at,approved_by
  ) values(
    v_agreement,v_partner,v_owner,v_template,'E2E-1',repeat('a',64),
    'active',now(),v_owner,now(),v_admin
  );

  insert into public.partner_weekly_availability(
    partner_id,weekday,is_open,opens_at,closes_at,timezone
  ) values(v_partner,v_weekday,true,'00:00','23:59','Africa/Douala');

  insert into public.universes(slug,name,enabled)
  values('prestations','Prestations et soins à domicile',true)
  on conflict(slug) do update set enabled=true;
  insert into public.partner_universes(partner_id,universe_slug,enabled)
  values(v_partner,'prestations',true)
  on conflict(partner_id,universe_slug) do update set enabled=true;
  insert into public.feature_flags(flag_key,enabled,description)
  values('universe.prestations',true,'temporary E2E')
  on conflict(flag_key) do update set enabled=true;
  insert into public.feature_flags(flag_key,enabled,description)
  values('suivi_connecte',true,'temporary E2E')
  on conflict(flag_key) do update set enabled=true;

  insert into public.home_service_offers(
    id,partner_id,name,category,description,service_area_label,price_fcfa,status,created_by
  ) values(
    v_offer,v_partner,'Prestation E2E','Soins','Offre temporaire de test','Yaoundé',1000,'active',v_employee
  );

  if private.naxa_partner_has_active_independent_agreement(v_partner,v_owner) is distinct from true then
    raise exception 'FAIL: owner active agreement not recognized';
  end if;
  if private.naxa_partner_has_active_independent_agreement(v_partner,v_employee) is distinct from false then
    raise exception 'FAIL: employee without independent agreement was recognized';
  end if;
  if private.suivi_is_verified_professional(v_owner) is distinct from true then
    raise exception 'FAIL: independent accredited owner not recognized';
  end if;
  if private.suivi_is_verified_professional(v_employee) is distinct from true then
    raise exception 'FAIL: medical accreditation for an employee was incorrectly disabled';
  end if;
  if private.naxa_partner_has_active_independent_agreement(v_partner,v_employee) is distinct from false then
    raise exception 'FAIL: employee without independent agreement acquired independent Partner status';
  end if;

  perform set_config('request.jwt.claim.sub',v_employee::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_employee::text,'role','authenticated')::text,true);
  if public.suivi_is_verified_professional(v_employee) is distinct from true then
    raise exception 'FAIL: employee medical accreditation cannot support consent-based clinical access';
  end if;

  perform set_config('request.jwt.claim.sub',v_patient::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_patient::text,'role','authenticated')::text,true);

  select count(*) into v_count from public.suivi_list_independent_partner_directory()
  where user_id=v_owner and partner_id=v_partner;
  if v_count<>1 then raise exception 'FAIL: owner should appear in independent directory, found %',v_count; end if;
  select count(*) into v_count from public.suivi_list_independent_partner_directory()
  where user_id=v_employee;
  if v_count<>0 then raise exception 'FAIL: employee without agreement appeared in independent directory'; end if;

  select count(*) into v_count from public.suivi_list_verified_professional_directory()
  where user_id=v_owner;
  if v_count<>1 then raise exception 'FAIL: owner missing from verified directory'; end if;
  select count(*) into v_count from public.suivi_list_verified_professional_directory()
  where user_id=v_employee;
  if v_count<>0 then raise exception 'FAIL: employee without agreement appeared in verified directory'; end if;

  select count(*) into v_count from private.get_home_service_catalog_for_client()
  where partner_id=v_partner and offer_id=v_offer;
  if v_count<>1 then raise exception 'FAIL: active independent Partner offer missing from client catalogue'; end if;

  if has_table_privilege('authenticated','public.suivi_professional_weekly_availability','INSERT')
    or has_table_privilege('authenticated','public.suivi_professional_weekly_availability','UPDATE')
    or has_table_privilege('authenticated','public.suivi_professional_weekly_availability','DELETE') then
    raise exception 'FAIL: legacy individual schedule still accepts direct authenticated writes';
  end if;

  if not has_table_privilege('authenticated','public.partner_weekly_availability','INSERT') then
    raise exception 'FAIL: Partner schedule INSERT grant missing';
  end if;

  if has_table_privilege('authenticated','public.partner_independent_agreement_templates','INSERT')
    or has_table_privilege('authenticated','public.partner_independent_agreement_templates','UPDATE')
    or has_table_privilege('authenticated','public.partner_independent_agreement_templates','DELETE') then
    raise exception 'FAIL: template writes must be restricted to audited Admin publication RPC';
  end if;

  if (select count(*) from pg_policies
      where schemaname='public' and tablename='partner_independent_agreement_templates'
        and cmd='SELECT' and policyname in ('partner_independent_templates_published_read','partner_independent_templates_admin_archived_read'))<>2 then
    raise exception 'FAIL: non-overlapping published/Admin template read policies missing';
  end if;

  if has_function_privilege('authenticated','public.partner_independent_agreement_accept(uuid)','EXECUTE') is not true
    or has_function_privilege('authenticated','public.admin_review_partner_independent_agreement(uuid,boolean,timestamptz,text)','EXECUTE') is not true
    or has_function_privilege('anon','public.partner_independent_agreement_accept(uuid)','EXECUTE') then
    raise exception 'FAIL: agreement RPC ACL mismatch';
  end if;
end
$test$;

select 'PASS — contrat indépendant, exclusion du salarié, annuaire et catalogue Partenaire' as result;
rollback;
