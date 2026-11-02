-- Regression test for production Suivi access, sharing and consent-oracle scope.
-- Transactional fixtures are always rolled back.
begin;

do $structure$
declare
  v_enabled text;
  v_owner_select text;
  v_alert_share text;
  v_function text;
begin
  select pg_get_functiondef('public.suivi_is_enabled_user(uuid)'::regprocedure) into v_enabled;
  if v_enabled not ilike '%auth.uid%'
     or v_enabled not ilike '%profiles%'
     or v_enabled not ilike '%actif%'
     or v_enabled not ilike '%suivi_connecte%'
     or v_enabled not ilike '%coalesce%' then
    raise exception 'Suivi active-user gate does not enforce current identity, active profile and global flag';
  end if;

  select qual into v_owner_select
  from pg_policies
  where schemaname='public' and tablename='suivi_measurements'
    and policyname='suivi_measurements_owner_select';
  if v_owner_select is null
     or v_owner_select not ilike '%suivi_is_enabled_user%'
     or v_owner_select not ilike '%suivi_is_verified_professional%'
     or v_owner_select not ilike '%suivi_has_consent%'
     or v_owner_select not ilike '%suivi_shares%' then
    raise exception 'Suivi measurement reads are not scoped to enabled owner or verified professional share plus consent';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='suivi_measurements'
      and policyname='suivi_measurements_recipient_shared_select'
  ) then
    raise exception 'Legacy permissive recipient policy remains alongside the canonical scoped policy';
  end if;

  select qual into v_alert_share
  from pg_policies
  where schemaname='public' and tablename='suivi_alerts'
    and policyname='suivi_alerts_recipient_shared_select';
  if v_alert_share is null
     or v_alert_share not ilike '%suivi_has_consent%'
     or v_alert_share not ilike '%suivi_shares%'
     or v_alert_share not ilike '%suivi_measurements%' then
    raise exception 'Shared alerts are not scoped to an active measurement share and consent';
  end if;

  select pg_get_functiondef('public.suivi_has_consent(uuid,text)'::regprocedure) into v_function;
  if v_function not ilike '%auth.uid%'
     or v_function not ilike '%suivi_is_verified_professional%'
     or v_function not ilike '%suivi_shares%'
     or v_function not ilike '%service_role%' then
    raise exception 'Public consent helper does not scope arbitrary user ids to an owner, live professional share or trusted service role';
  end if;
end;
$structure$;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('00000000-0000-4000-8000-000000012301','authenticated','authenticated','naxa-suivi-owner-a@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('00000000-0000-4000-8000-000000012302','authenticated','authenticated','naxa-suivi-owner-b@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('00000000-0000-4000-8000-000000012303','authenticated','authenticated','naxa-suivi-owner-c@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('00000000-0000-4000-8000-000000012304','authenticated','authenticated','naxa-suivi-owner-d@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('00000000-0000-4000-8000-000000012305','authenticated','authenticated','naxa-suivi-professional@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('00000000-0000-4000-8000-000000012306','authenticated','authenticated','naxa-suivi-unverified@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('00000000-0000-4000-8000-000000012307','authenticated','authenticated','naxa-suivi-inactive-professional@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());

insert into public.profiles(id,role,username,actif)
values
('00000000-0000-4000-8000-000000012301','client','naxa_suivi_owner_a',true),
('00000000-0000-4000-8000-000000012302','client','naxa_suivi_owner_b',true),
('00000000-0000-4000-8000-000000012303','client','naxa_suivi_owner_c',true),
('00000000-0000-4000-8000-000000012304','client','naxa_suivi_owner_d',true),
('00000000-0000-4000-8000-000000012305','client','naxa_suivi_professional',true),
('00000000-0000-4000-8000-000000012306','client','naxa_suivi_unverified',true),
('00000000-0000-4000-8000-000000012307','client','naxa_suivi_inactive_pro',false);

insert into public.suivi_professionals(user_id,professional_role,display_name,verified)
values
('00000000-0000-4000-8000-000000012305','medecin','Professionnel NAXA test',true),
('00000000-0000-4000-8000-000000012307','pharmacien','Professionnel inactif test',true);

insert into public.suivi_consents(user_id,family_key,granted,granted_at,consent_version)
values
('00000000-0000-4000-8000-000000012301','constantes',true,now(),'test-1'),
('00000000-0000-4000-8000-000000012302','constantes',true,now(),'test-1'),
('00000000-0000-4000-8000-000000012303','constantes',true,now(),'test-1'),
('00000000-0000-4000-8000-000000012305','constantes',true,now(),'test-1');

insert into public.suivi_shares(owner_user_id,recipient_user_id,measurement_type,active,revoked_at)
values
('00000000-0000-4000-8000-000000012301','00000000-0000-4000-8000-000000012305','tension_systolique',true,null),
('00000000-0000-4000-8000-000000012301','00000000-0000-4000-8000-000000012307','tension_systolique',true,null),
('00000000-0000-4000-8000-000000012301','00000000-0000-4000-8000-000000012306','tension_systolique',true,null),
('00000000-0000-4000-8000-000000012303','00000000-0000-4000-8000-000000012305','tension_systolique',false,now()),
('00000000-0000-4000-8000-000000012304','00000000-0000-4000-8000-000000012305','tension_systolique',true,null);

insert into public.suivi_measurements(user_id,measurement_type,value_numeric,unit,measured_at,source)
values
('00000000-0000-4000-8000-000000012301','tension_systolique',120,'mmHg',now(),'manual'),
('00000000-0000-4000-8000-000000012302','tension_systolique',121,'mmHg',now(),'manual'),
('00000000-0000-4000-8000-000000012303','tension_systolique',122,'mmHg',now(),'manual'),
('00000000-0000-4000-8000-000000012304','tension_systolique',123,'mmHg',now(),'manual');

select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000012305',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000012305"}',true);
set local role authenticated;

do $professional$
declare v_visible integer;
begin
  if not public.suivi_is_enabled_user('00000000-0000-4000-8000-000000012305') then
    raise exception 'Verified active professional was unexpectedly disabled';
  end if;
  if public.suivi_is_enabled_user('00000000-0000-4000-8000-000000012301') then
    raise exception 'An authenticated user must not query another user through the active-user gate';
  end if;
  if public.suivi_is_enabled_user(null) is distinct from false then
    raise exception 'NULL identity must be rejected as FALSE';
  end if;

  if not public.suivi_has_consent('00000000-0000-4000-8000-000000012301','constantes') then
    raise exception 'Active verified professional with matching live share should see the granted family consent';
  end if;
  if public.suivi_has_consent('00000000-0000-4000-8000-000000012302','constantes') then
    raise exception 'Consent status leaked without a share';
  end if;
  if public.suivi_has_consent('00000000-0000-4000-8000-000000012303','constantes') then
    raise exception 'Consent status leaked through a revoked share';
  end if;
  if public.suivi_has_consent('00000000-0000-4000-8000-000000012304','constantes') then
    raise exception 'Consent status leaked when no consent exists';
  end if;
  if public.suivi_has_consent('00000000-0000-4000-8000-000000012301','metabolisme') then
    raise exception 'Consent status leaked across measurement families';
  end if;

  select count(*) into v_visible from public.suivi_measurements
  where user_id='00000000-0000-4000-8000-000000012301';
  if v_visible <> 1 then raise exception 'Authorized professional should read the shared measurement'; end if;

  select count(*) into v_visible from public.suivi_measurements
  where user_id in (
    '00000000-0000-4000-8000-000000012302',
    '00000000-0000-4000-8000-000000012303',
    '00000000-0000-4000-8000-000000012304'
  );
  if v_visible <> 0 then raise exception 'Measurements without consent/live matching share were visible'; end if;
end;
$professional$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000012306',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000012306"}',true);

do $unverified$
begin
  if public.suivi_has_consent('00000000-0000-4000-8000-000000012301','constantes') then
    raise exception 'Unverified recipient was able to query another user consent';
  end if;
end;
$unverified$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000012307',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000012307"}',true);

do $inactive$
begin
  if public.suivi_is_enabled_user('00000000-0000-4000-8000-000000012307') then
    raise exception 'Inactive professional profile must not access Suivi';
  end if;
  if public.suivi_has_consent('00000000-0000-4000-8000-000000012301','constantes') then
    raise exception 'Inactive professional profile must not query consent';
  end if;
end;
$inactive$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000012301',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000012301"}',true);

do $owner$
declare v_visible integer;
begin
  if not public.suivi_has_consent('00000000-0000-4000-8000-000000012301','constantes') then
    raise exception 'Owner must still be able to inspect their own consent';
  end if;
  select count(*) into v_visible from public.suivi_measurements
  where user_id='00000000-0000-4000-8000-000000012301';
  if v_visible <> 1 then raise exception 'Owner must retain access to their own measurement'; end if;
end;
$owner$;

reset role;
rollback;

select 'PASS — Suivi consent oracle, active-profile gate and share RLS regression' as result;
