-- Matrice RLS Admin actif/inactif, partenaire, Client et anonyme pour le catalogue Examens.
begin;

do $structure$
begin
  if not (select relrowsecurity from pg_class where oid='public.exam_centers'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.exam_services'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.exam_packs'::regclass) then
    raise exception 'E17 FAIL: RLS must remain enabled';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='exam_centers' and policyname='exam_centers_admin_read' and qual ilike '%is_admin%')
     or not exists(select 1 from pg_policies where schemaname='public' and tablename='exam_services' and policyname='exam_services_admin_read' and qual ilike '%is_admin%')
     or not exists(select 1 from pg_policies where schemaname='public' and tablename='exam_packs' and policyname='exam_packs_admin_read' and qual ilike '%is_admin%') then
    raise exception 'E17 FAIL: missing Admin read policies';
  end if;
end;
$structure$;

insert into auth.users(instance_id,id,aud,role,email,raw_user_meta_data,created_at,updated_at)
values
('00000000-0000-0000-0000-000000000000','01700000-0000-4000-8000-000000000001','authenticated','authenticated','e17-admin-active@example.invalid','{"naxa_signup_pending":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000000','01700000-0000-4000-8000-000000000002','authenticated','authenticated','e17-admin-inactive@example.invalid','{"naxa_signup_pending":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000000','01700000-0000-4000-8000-000000000003','authenticated','authenticated','e17-client@example.invalid','{"naxa_signup_pending":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000000','01700000-0000-4000-8000-000000000004','authenticated','authenticated','e17-partner-owner@example.invalid','{"naxa_signup_pending":true}'::jsonb,now(),now());

insert into public.profiles(id,role,username,actif,niveau_interne)
values
('01700000-0000-4000-8000-000000000001','admin','e17_admin_active',true,1),
('01700000-0000-4000-8000-000000000002','admin','e17_admin_inactive',false,1),
('01700000-0000-4000-8000-000000000003','client','e17_client',true,4),
('01700000-0000-4000-8000-000000000004','client','e17_partner_owner',true,4);

insert into public.partners(id,name,partner_type,status)
values ('01700000-0000-4000-8000-000000000101','E17 Partner','centre_examen','active');

insert into public.partner_members(partner_id,user_id,member_role)
values ('01700000-0000-4000-8000-000000000101','01700000-0000-4000-8000-000000000004','owner');

insert into public.exam_centers(id,partner_id,display_name,status)
values ('01700000-0000-4000-8000-000000000201','01700000-0000-4000-8000-000000000101','E17 Centre brouillon','draft');

insert into public.exam_services(id,center_id,name,price_fcfa,status)
values ('01700000-0000-4000-8000-000000000301','01700000-0000-4000-8000-000000000201','E17 Examen brouillon',1000,'draft');

insert into public.exam_packs(id,center_id,name,price_fcfa,status)
values ('01700000-0000-4000-8000-000000000401','01700000-0000-4000-8000-000000000201','E17 Pack brouillon',2000,'draft');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"01700000-0000-4000-8000-000000000001"}',true);
select set_config('request.jwt.claim.sub','01700000-0000-4000-8000-000000000001',true);

do $active_admin$
declare c integer; s integer; p integer;
begin
  if not public.is_admin() then raise exception 'E17 FAIL: active Admin rejected'; end if;
  select count(*) into c from public.exam_centers where id='01700000-0000-4000-8000-000000000201';
  select count(*) into s from public.exam_services where id='01700000-0000-4000-8000-000000000301';
  select count(*) into p from public.exam_packs where id='01700000-0000-4000-8000-000000000401';
  if c<>1 or s<>1 or p<>1 then
    raise exception 'E17 FAIL: active Admin cannot read drafts: centers %, services %, packs %',c,s,p;
  end if;
end;
$active_admin$;

select set_config('request.jwt.claim.sub','01700000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"01700000-0000-4000-8000-000000000002"}',true);
do $inactive_admin$
declare c integer; s integer; p integer;
begin
  if public.is_admin() then raise exception 'E17 FAIL: inactive Admin accepted'; end if;
  select count(*) into c from public.exam_centers where id='01700000-0000-4000-8000-000000000201';
  select count(*) into s from public.exam_services where id='01700000-0000-4000-8000-000000000301';
  select count(*) into p from public.exam_packs where id='01700000-0000-4000-8000-000000000401';
  if c<>0 or s<>0 or p<>0 then
    raise exception 'E17 FAIL: inactive Admin can read drafts: centers %, services %, packs %',c,s,p;
  end if;
end;
$inactive_admin$;

select set_config('request.jwt.claim.sub','01700000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"01700000-0000-4000-8000-000000000003"}',true);
do $client$
declare c integer; s integer; p integer;
begin
  select count(*) into c from public.exam_centers where id='01700000-0000-4000-8000-000000000201';
  select count(*) into s from public.exam_services where id='01700000-0000-4000-8000-000000000301';
  select count(*) into p from public.exam_packs where id='01700000-0000-4000-8000-000000000401';
  if c<>0 or s<>0 or p<>0 then
    raise exception 'E17 FAIL: Client can read drafts';
  end if;
end;
$client$;

select set_config('request.jwt.claim.sub','01700000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"01700000-0000-4000-8000-000000000004"}',true);
do $partner$
declare c integer; s integer; p integer;
begin
  select count(*) into c from public.exam_centers where id='01700000-0000-4000-8000-000000000201';
  select count(*) into s from public.exam_services where id='01700000-0000-4000-8000-000000000301';
  select count(*) into p from public.exam_packs where id='01700000-0000-4000-8000-000000000401';
  if c<>1 or s<>1 or p<>1 then
    raise exception 'E17 FAIL: partner owner lost own center scope';
  end if;
end;
$partner$;

reset role;
select set_config('request.jwt.claim.role','anon',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $anon$
declare c integer; s integer; p integer;
begin
  select count(*) into c from public.exam_centers where id='01700000-0000-4000-8000-000000000201';
  select count(*) into s from public.exam_services where id='01700000-0000-4000-8000-000000000301';
  select count(*) into p from public.exam_packs where id='01700000-0000-4000-8000-000000000401';
  if c<>0 or s<>0 or p<>0 then
    raise exception 'E17 FAIL: anon can read drafts';
  end if;
end;
$anon$;

reset role;
rollback;
select 'E17 Admin exam catalog read matrix PASS' as resultat;
