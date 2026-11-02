-- NAXA 270 — les politiques RLS Admin catalogue/stock exigent un profil Admin actif.
-- Exécuter dans une base Replay isolée. Fixtures transactionnels annulés en fin de test.
begin;

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('00000000-0000-4000-8000-000000000991','authenticated','authenticated','naxa-270-admin-active@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"naxa_signup_pending":"true"}',now(),now()),
('00000000-0000-4000-8000-000000000992','authenticated','authenticated','naxa-270-admin-inactive@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"naxa_signup_pending":"true"}',now(),now()),
('00000000-0000-4000-8000-000000000993','authenticated','authenticated','naxa-270-client@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"naxa_signup_pending":"true"}',now(),now());

insert into public.profiles(id,role,username,actif) values
('00000000-0000-4000-8000-000000000991','admin','naxa_270_admin_active',true),
('00000000-0000-4000-8000-000000000992','admin','naxa_270_admin_inactive',false),
('00000000-0000-4000-8000-000000000993','client','naxa_270_client',true);

insert into public.partners(id,name,partner_type,status)
values ('10000000-0000-4000-8000-000000000991','NAXA 270 partenaire de contrôle','professionnel_domicile','active');

do $structure$
declare
  v_table text;
  v_policy text;
  v_qual text;
  v_check text;
  v_tables text[] := array[
    'feature_flag_test_accounts',
    'feature_flags',
    'partner_members',
    'partner_universes',
    'partners',
    'stock_movements',
    'suivi_professionals',
    'universes'
  ];
begin
  foreach v_table in array v_tables loop
    v_policy := case v_table
      when 'feature_flag_test_accounts' then 'feature_flag_test_accounts_admin_all'
      when 'feature_flags' then 'feature_flags_admin_all'
      when 'partner_members' then 'partner_members_admin_all'
      when 'partner_universes' then 'partner_universes_admin_all'
      when 'partners' then 'partners_admin_all'
      when 'stock_movements' then 'stock_movements_admin_all'
      when 'suivi_professionals' then 'suivi_professionals_admin_manage'
      when 'universes' then 'universes_admin_all'
    end;

    select qual, with_check into v_qual, v_check
    from pg_policies
    where schemaname='public' and tablename=v_table and policyname=v_policy
      and cmd='ALL' and roles @> array['authenticated']::name[];

    if v_qual is null or v_qual not ilike '%is_admin%'
      or v_qual ilike '%role_type%' or v_check is null or v_check not ilike '%is_admin%'
      or v_check ilike '%role_type%' then
      raise exception '270.1 : politique % sur % ne vérifie pas le garde Admin actif dans USING et WITH CHECK',v_policy,v_table;
    end if;

    if not (select relrowsecurity from pg_class where oid=format('public.%I',v_table)::regclass) then
      raise exception '270.2 : RLS désactivée sur %',v_table;
    end if;
  end loop;

  select qual into v_qual from pg_policies
  where schemaname='public' and tablename='stock_movements'
    and policyname='stock_movements_partner_read' and cmd='SELECT';
  if v_qual is null or v_qual not ilike '%is_admin%'
     or v_qual not ilike '%partner_members%' then
    raise exception '270.3 : la lecture stock ne préserve pas les membres partenaires et le garde Admin';
  end if;

  if not exists(select 1 from pg_policies where schemaname='public'
      and tablename='partner_members' and policyname='partner_members_self_read'
      and cmd='SELECT' and qual ilike '%auth.uid%') then
    raise exception '270.4 : la lecture personnelle des membres partenaires a été perdue';
  end if;

  if not exists(select 1 from pg_policies where schemaname='public'
      and tablename='partner_universes' and policyname='partner_universes_member_read'
      and cmd='SELECT') then
    raise exception '270.5 : la lecture des associations par les membres partenaires a été perdue';
  end if;

  if not exists(select 1 from pg_policies where schemaname='public'
      and tablename='partners' and policyname='partners_member_read'
      and cmd='SELECT') then
    raise exception '270.6 : la lecture des partenaires par leurs membres a été perdue';
  end if;
end
$structure$;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000991';
do $active$
declare n integer;
begin
  if not public.is_admin() then raise exception '270.7 : Admin actif refusé par le garde canonique'; end if;
  update public.partners set name=name
  where id='10000000-0000-4000-8000-000000000991';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '270.8 : Admin actif ne peut pas modifier le partenaire de contrôle'; end if;
end
$active$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000992';
do $inactive$
declare n integer;
begin
  if public.is_admin() then raise exception '270.9 : Admin inactif accepté par le garde canonique'; end if;
  update public.partners set name='MUTATION INTERDITE — ADMIN INACTIF'
  where id='10000000-0000-4000-8000-000000000991';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '270.10 : Admin inactif a muté un partenaire'; end if;
end
$inactive$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000993';
do $client$
declare n integer;
begin
  if public.is_admin() then raise exception '270.11 : Client reconnu Admin'; end if;
  update public.partners set name='MUTATION INTERDITE — CLIENT'
  where id='10000000-0000-4000-8000-000000000991';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '270.12 : Client a muté un partenaire'; end if;
end
$client$;

reset role;
select 'PASS — 270 : huit politiques Admin, garde stock partenaire, Admin actif autorisé, Admin inactif/client refusés' as result;
rollback;
