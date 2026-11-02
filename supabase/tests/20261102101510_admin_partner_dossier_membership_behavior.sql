-- Test comportemental transactionnel du garde de validation des dossiers partenaires.
-- Couvre le chemin positif et les refus atomiques owner/association. Aucun état ne persiste.

begin;

insert into auth.users(instance_id,id,aud,role,email,raw_user_meta_data,created_at,updated_at)
values
('00000000-0000-0000-0000-000000000000','01800000-0000-4000-8000-000000000001','authenticated','authenticated','e18-admin@example.invalid','{"naxa_signup_pending":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000002','01800000-0000-4000-8000-000000000002','authenticated','authenticated','e18-owner-good@example.invalid','{"naxa_signup_pending":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000003','01800000-0000-4000-8000-000000000003','authenticated','authenticated','e18-owner-missing-assoc@example.invalid','{"naxa_signup_pending":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000004','01800000-0000-4000-8000-000000000004','authenticated','authenticated','e18-wrong-owner@example.invalid','{"naxa_signup_pending":true}'::jsonb,now(),now());

insert into public.profiles(id,role,username,actif,niveau_interne)
values
('01800000-0000-4000-8000-000000000001','admin','e18_admin',true,1),
('01800000-0000-4000-8000-000000000002','client','e18_owner_good',false,4),
('01800000-0000-4000-8000-000000000003','client','e18_owner_missing',false,4),
('01800000-0000-4000-8000-000000000004','client','e18_wrong_owner',false,4);

insert into public.partners(id,name,partner_type,status)
values
('01800000-0000-4000-8000-000000000101','E18 partenaire valide','autre','pending'),
('01800000-0000-4000-8000-000000000102','E18 association absente','autre','pending'),
('01800000-0000-4000-8000-000000000103','E18 rôle owner incorrect','autre','pending');

insert into public.partner_members(partner_id,user_id,member_role)
values
('01800000-0000-4000-8000-000000000101','01800000-0000-4000-8000-000000000002','owner'),
('01800000-0000-4000-8000-000000000102','01800000-0000-4000-8000-000000000003','owner'),
('01800000-0000-4000-8000-000000000103','01800000-0000-4000-8000-000000000004','manager');

insert into public.partner_universes(partner_id,universe_slug,enabled)
values
('01800000-0000-4000-8000-000000000101','aide',false),
('01800000-0000-4000-8000-000000000103','aide',false);

insert into public.admin_partner_dossiers(partner_id,promoteur_id,universe_slug,monthly_fee_fcfa,dossier_status,created_by)
values
('01800000-0000-4000-8000-000000000101','01800000-0000-4000-8000-000000000002','aide',5000,'pending','01800000-0000-4000-8000-000000000001'),
('01800000-0000-4000-8000-000000000102','01800000-0000-4000-8000-000000000003','aide',5000,'pending','01800000-0000-4000-8000-000000000001'),
('01800000-0000-4000-8000-000000000103','01800000-0000-4000-8000-000000000004','aide',5000,'pending','01800000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"01800000-0000-4000-8000-000000000001"}',true);
select set_config('request.jwt.claim.sub','01800000-0000-4000-8000-000000000001',true);
set local role authenticated;

do $behavior$
declare
  v_status text;
  v_enabled boolean;
  v_owner_active boolean;
  v_failures integer := 0;
begin
  perform public.admin_valider_dossier_partenaire('01800000-0000-4000-8000-000000000101');
  select p.status,pu.enabled into v_status,v_enabled
  from public.partners p
  join public.partner_universes pu on pu.partner_id=p.id and pu.universe_slug='aide'
  where p.id='01800000-0000-4000-8000-000000000101';
  select actif into v_owner_active from public.profiles where id='01800000-0000-4000-8000-000000000002';
  if v_status<>'active' or v_enabled is not true or v_owner_active is not true
     or not exists(select 1 from public.admin_partner_dossiers where partner_id='01800000-0000-4000-8000-000000000101' and dossier_status='validated')
     or not exists(select 1 from public.audit_log where entity_id='01800000-0000-4000-8000-000000000101' and action='partner.dossier_validated') then
    raise exception 'E18 FAIL: positive validation did not complete all linked states';
  end if;

  begin
    perform public.admin_valider_dossier_partenaire('01800000-0000-4000-8000-000000000102');
    raise exception 'E18 FAIL: missing partner_universes association accepted';
  exception when check_violation then
    v_failures:=v_failures+1;
  end;

  begin
    perform public.admin_valider_dossier_partenaire('01800000-0000-4000-8000-000000000103');
    raise exception 'E18 FAIL: non-owner member accepted';
  exception when check_violation then
    v_failures:=v_failures+1;
  end;

  if v_failures<>2
     or not exists(select 1 from public.partners where id='01800000-0000-4000-8000-000000000102' and status='pending')
     or not exists(select 1 from public.admin_partner_dossiers where partner_id='01800000-0000-4000-8000-000000000102' and dossier_status='pending')
     or not exists(select 1 from public.partners where id='01800000-0000-4000-8000-000000000103' and status='pending')
     or not exists(select 1 from public.admin_partner_dossiers where partner_id='01800000-0000-4000-8000-000000000103' and dossier_status='pending') then
    raise exception 'E18 FAIL: rejected validations modified a dossier';
  end if;
end;
$behavior$;

reset role;
rollback;
select 'E18 partner dossier validation positive/negative matrix PASS' as resultat;
