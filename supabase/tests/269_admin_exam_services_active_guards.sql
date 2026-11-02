-- NAXA 269 — ADM-EXAM-03 + ADM-SERVICES-03 : Admin actif, RLS et transitions à domicile.
-- À exécuter dans une base Replay isolée. Tous les utilisateurs et fixtures sont annulés.
begin;

alter table public.home_service_requests disable trigger home_service_request_created_notification;
alter table public.home_service_requests disable trigger home_service_request_status_notification;

do $structure$
declare v_def text;
begin
  if not (select relrowsecurity from pg_class where oid='public.exam_appointments'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.home_service_requests'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.home_service_offers'::regclass) then
    raise exception '269.1 : RLS doit rester active sur les trois tables';
  end if;

  if not exists(select 1 from pg_policies where schemaname='public' and tablename='exam_appointments'
      and policyname='exam_appointments_admin_read' and qual ilike '%is_admin%') then
    raise exception '269.2 : politique Admin active absente sur exam_appointments';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='home_service_requests'
      and policyname='home_service_requests_admin_read' and qual ilike '%is_admin%') then
    raise exception '269.3 : politique Admin active absente sur home_service_requests';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='home_service_offers'
      and policyname='home_service_offers_admin_manage'
      and qual ilike '%is_admin%' and with_check ilike '%is_admin%') then
    raise exception '269.4 : politique Admin active absente sur les mutations des offres';
  end if;

  select pg_get_functiondef('private.is_admin()'::regprocedure) into v_def;
  if v_def not ilike '%role = ''admin''%' or v_def not ilike '%actif is true%' then
    raise exception '269.5 : le garde canonique ne vérifie pas rôle et activité';
  end if;

  select pg_get_functiondef('public.transition_home_service_request(uuid,text)'::regprocedure) into v_def;
  if v_def not ilike '%public.is_admin()%' then
    raise exception '269.6 : la transition Admin ne délègue pas au garde canonique';
  end if;

  if not has_table_privilege('authenticated','public.exam_appointments','SELECT')
     or not has_table_privilege('authenticated','public.home_service_requests','SELECT')
     or not has_table_privilege('authenticated','public.home_service_offers','UPDATE')
     or not has_function_privilege('authenticated','public.transition_home_service_request(uuid,text)','EXECUTE') then
    raise exception '269.7 : privilèges applicatifs attendus absents';
  end if;
end
$structure$;

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('00000000-0000-4000-8000-000000000001','authenticated','authenticated','naxa-269-admin-active@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"naxa_signup_pending":"true"}',now(),now()),
('00000000-0000-4000-8000-000000000002','authenticated','authenticated','naxa-269-admin-inactive@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"naxa_signup_pending":"true"}',now(),now()),
('00000000-0000-4000-8000-000000000003','authenticated','authenticated','naxa-269-client-owner@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"naxa_signup_pending":"true"}',now(),now()),
('00000000-0000-4000-8000-000000000004','authenticated','authenticated','naxa-269-client-other@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"naxa_signup_pending":"true"}',now(),now()),
('00000000-0000-4000-8000-000000000005','authenticated','authenticated','naxa-269-partner-member@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"naxa_signup_pending":"true"}',now(),now());

insert into public.profiles(id,role,username,actif) values
('00000000-0000-4000-8000-000000000001','admin','naxa_269_admin_active',true),
('00000000-0000-4000-8000-000000000002','admin','naxa_269_admin_inactive',false),
('00000000-0000-4000-8000-000000000003','client','naxa_269_client_owner',true),
('00000000-0000-4000-8000-000000000004','client','naxa_269_client_other',true),
('00000000-0000-4000-8000-000000000005','client','naxa_269_partner_member',true);

insert into public.partners(id,name,partner_type,status) values
('10000000-0000-4000-8000-000000000001','NAXA 269 Centre examens','centre_examen','active'),
('10000000-0000-4000-8000-000000000002','NAXA 269 Prestations domicile','professionnel_domicile','active');

insert into public.partner_members(partner_id,user_id,member_role) values
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005','manager'),
('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000005','manager');

insert into public.exam_centers(id,partner_id,display_name,address_label,status) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Centre NAXA 269','Yaoundé - test','draft');
insert into public.exam_services(id,center_id,name,category,price_fcfa,status) values
('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Analyse NAXA 269','Analyse',1000,'draft');
insert into public.exam_slots(id,center_id,starts_at,ends_at,capacity,reserved_count,status) values
('20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001',now()+interval '2 days',now()+interval '2 days 1 hour',10,0,'open');
insert into public.exam_appointments(id,client_id,center_id,slot_id,service_id,item_name,price_fcfa,status,ticket_code) values
('30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','Analyse NAXA 269',1000,'booked','NAXA2691');

insert into public.home_service_offers(id,partner_id,name,category,service_area_label,price_fcfa,status,created_by) values
('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Prestation NAXA 269','Test','Yaoundé - test',5000,'draft','00000000-0000-4000-8000-000000000005');

insert into public.home_service_requests(id,client_id,partner_id,offer_id,offer_name,category,price_fcfa,service_area_label,status)
values
('50000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','Prestation NAXA 269','Test',5000,'Yaoundé - test','requested'),
('50000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','Prestation NAXA 269','Test',5000,'Yaoundé - test','requested'),
('50000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','Prestation NAXA 269','Test',5000,'Yaoundé - test','requested'),
('50000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','Prestation NAXA 269','Test',5000,'Yaoundé - test','requested');

-- Anonyme : aucune réservation privée; la table de demandes n'est même pas accordée à anon.
set local role anon;
set local request.jwt.claim.sub = '';
do $anon$
declare n integer;
begin
  select count(*) into n from public.exam_appointments where id='30000000-0000-4000-8000-000000000001';
  if n <> 0 then raise exception '269.8 : anon lit un ticket examen'; end if;
  if has_table_privilege('anon','public.home_service_requests','SELECT') then
    select count(*) into n from public.home_service_requests where id in ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000004');
    if n <> 0 then raise exception '269.9 : anon lit une demande domicile'; end if;
  end if;
end
$anon$;
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
do $admin_active$
declare n integer;
begin
  if not public.is_admin() then raise exception '269.10 : Admin actif refusé par le garde'; end if;
  select count(*) into n from public.exam_appointments where id='30000000-0000-4000-8000-000000000001';
  if n <> 1 then raise exception '269.11 : Admin actif ne lit pas le ticket examen'; end if;
  select count(*) into n from public.home_service_requests where id in ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000004');
  if n <> 4 then raise exception '269.12 : Admin actif ne lit pas les demandes'; end if;
  update public.home_service_offers set description='edited-by-active-admin'
    where id='40000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '269.13 : Admin actif ne modifie pas l’offre'; end if;
  perform public.transition_home_service_request('50000000-0000-4000-8000-000000000001','confirmed');
  perform public.transition_home_service_request('50000000-0000-4000-8000-000000000001','completed');
end
$admin_active$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
do $admin_inactive$
declare n integer;
begin
  if public.is_admin() then raise exception '269.14 : Admin inactif autorisé par le garde'; end if;
  select count(*) into n from public.exam_appointments where id='30000000-0000-4000-8000-000000000001';
  if n <> 0 then raise exception '269.15 : Admin inactif lit le ticket examen'; end if;
  select count(*) into n from public.home_service_requests where id in ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000004');
  if n <> 0 then raise exception '269.16 : Admin inactif lit les demandes'; end if;
  update public.home_service_offers set description='edited-by-inactive-admin'
    where id='40000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '269.17 : Admin inactif modifie une offre'; end if;
  begin
    perform public.transition_home_service_request('50000000-0000-4000-8000-000000000002','confirmed');
    raise exception '269.18 : Admin inactif effectue une transition';
  exception when insufficient_privilege then null;
  end;
end
$admin_inactive$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';
do $client_owner$
declare n integer;
begin
  if public.is_admin() then raise exception '269.19 : Client reconnu Admin'; end if;
  select count(*) into n from public.exam_appointments where id='30000000-0000-4000-8000-000000000001';
  if n <> 1 then raise exception '269.20 : Client propriétaire ne lit pas son ticket'; end if;
  select count(*) into n from public.home_service_requests where id in ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000004');
  if n <> 2 then raise exception '269.21 : le Client ne reste pas limité à ses demandes'; end if;
  perform public.transition_home_service_request('50000000-0000-4000-8000-000000000004','cancelled');
  begin
    perform public.transition_home_service_request('50000000-0000-4000-8000-000000000002','confirmed');
    raise exception '269.22 : Client non autorisé à confirmer une demande';
  exception when insufficient_privilege then null;
  end;
end
$client_owner$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000004';
do $client_other$
declare n integer;
begin
  select count(*) into n from public.exam_appointments where id='30000000-0000-4000-8000-000000000001';
  if n <> 0 then raise exception '269.23 : Client tiers lit un ticket étranger'; end if;
  select count(*) into n from public.home_service_requests where id in ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000004');
  if n <> 2 then raise exception '269.24 : second Client non limité à ses demandes'; end if;
end
$client_other$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000005';
do $partner$
declare n integer;
begin
  select count(*) into n from public.exam_appointments where id='30000000-0000-4000-8000-000000000001';
  if n <> 1 then raise exception '269.25 : membre partenaire ne lit pas le ticket de son centre'; end if;
  select count(*) into n from public.home_service_requests where id in ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000004');
  if n <> 4 then raise exception '269.26 : membre partenaire ne voit pas son périmètre'; end if;
  perform public.transition_home_service_request('50000000-0000-4000-8000-000000000003','confirmed');
end
$partner$;

reset role;
do $final$
declare n integer;
begin
  select count(*) into n from public.home_service_requests where id='50000000-0000-4000-8000-000000000001' and status='completed';
  if n <> 1 then raise exception '269.27 : transition Admin non finalisée'; end if;
  select count(*) into n from public.home_service_requests where id='50000000-0000-4000-8000-000000000002' and status='requested';
  if n <> 1 then raise exception '269.28 : Admin inactif a modifié une demande'; end if;
  select count(*) into n from public.home_service_requests where id='50000000-0000-4000-8000-000000000003' and status='confirmed';
  if n <> 1 then raise exception '269.29 : transition partenaire non finalisée'; end if;
  select count(*) into n from public.home_service_requests where id='50000000-0000-4000-8000-000000000004' and status='cancelled';
  if n <> 1 then raise exception '269.30 : annulation Client non finalisée'; end if;
  select count(*) into n from public.audit_log where entity_type='home_service_request' and entity_id in (
    '50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000004');
  if n < 4 then raise exception '269.31 : transitions non journalisées'; end if;
end
$final$;

select 'PASS — ADM-EXAM-03 / ADM-SERVICES-03 : 31 assertions structurelles et comportementales' as result;
rollback;
