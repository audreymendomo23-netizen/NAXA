-- Contrat : le Directeur peut préparer le personnel d'un Centre brouillon
-- avant paiement, sans accès opérationnel et sans activation du Partenaire.
begin;

create temporary table exam_pending_setup_fixture (
  owner_id uuid not null,
  staff_id uuid not null,
  partner_id uuid not null,
  center_id uuid not null
) on commit drop;

insert into exam_pending_setup_fixture
values (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());

grant select on table pg_temp.exam_pending_setup_fixture to authenticated;

insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id,'authenticated','authenticated',
  'pending-director-'||left(owner_id::text,8)||'@example.invalid',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"naxa_signup_pending":"true"}'::jsonb,now(),now()
from exam_pending_setup_fixture
union all
select staff_id,'authenticated','authenticated',
  'pending-staff-'||left(staff_id::text,8)||'@example.invalid',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"naxa_signup_pending":"true"}'::jsonb,now(),now()
from exam_pending_setup_fixture;

insert into public.profiles(id,username,first_name,last_name,phone,phone_country,date_of_birth,age_verified,consent_accepted_at,actif)
select owner_id,'pending_director_'||replace(owner_id::text,'-',''),'Test','Director','699001101','CM',date '1990-01-01',true,now(),true
from exam_pending_setup_fixture
union all
select staff_id,'pending_staff_'||replace(staff_id::text,'-',''),'Test','Staff','699001102','CM',date '1990-01-01',true,now(),true
from exam_pending_setup_fixture;

insert into public.partners(id,name,partner_type,status,created_by)
select partner_id,'Pending exam setup fixture '||left(partner_id::text,8),'centre_examen','pending',owner_id
from exam_pending_setup_fixture;

insert into public.partner_members(partner_id,user_id,member_role)
select partner_id,owner_id,'owner' from exam_pending_setup_fixture;

insert into public.partner_universes(partner_id,universe_slug,enabled)
select partner_id,'examens',false from exam_pending_setup_fixture;

insert into public.admin_partner_dossiers(
  partner_id,promoteur_id,universe_slug,monthly_fee_fcfa,documents_received,dossier_status,created_by
)
select partner_id,owner_id,'examens',10000,'{"sql_test_fixture":true}'::jsonb,'pending',owner_id
from exam_pending_setup_fixture;

insert into public.exam_centers(id,partner_id,display_name,address_label,status)
select center_id,partner_id,'Pending setup fixture '||left(center_id::text,8),'Rollback test','draft'
from exam_pending_setup_fixture;

set local role authenticated;

do $test$
declare
  f record;
  v_token uuid;
  v_result jsonb;
  v_count integer;
  v_rejected boolean;
begin
  select * into f from pg_temp.exam_pending_setup_fixture;

  perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.owner_id,'role','authenticated')::text,true);

  if not private.exam_has_capability(f.center_id,'staff_manage') then
    raise exception 'Pending draft owner Director must be allowed to manage the initial roster';
  end if;
  if private.exam_has_capability(f.center_id,'appointments_read')
    or private.exam_has_capability(f.center_id,'appointments_manage')
    or private.exam_has_capability(f.center_id,'center_manage')
    or private.exam_has_capability(f.center_id,'finance_read')
    or private.exam_has_capability(f.center_id,'finance_write')
    or private.exam_has_capability(f.center_id,'results_draft')
    or private.exam_has_capability(f.center_id,'results_publish') then
    raise exception 'Pending setup must not grant operational, financial, clinical or publication capabilities';
  end if;

  select count(*) into v_count from public.exam_centers where id=f.center_id;
  if v_count<>1 then raise exception 'Draft center must be readable by its setup Director'; end if;

  v_token:=public.exam_create_staff_invite(
    f.center_id,
    'pending-staff-'||left(f.staff_id::text,8)||'@example.invalid',
    'accueil'
  );
  if v_token is null then raise exception 'Draft setup Director could not create a staff invitation'; end if;

  perform set_config('request.jwt.claim.sub',f.staff_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.staff_id,'role','authenticated')::text,true);

  v_result:=public.exam_accept_staff_invite(v_token);
  if coalesce((v_result->>'accepted')::boolean,false) is not true then
    raise exception 'Existing confirmed Client could not accept the pending-center staff invitation';
  end if;
  if private.exam_has_capability(f.center_id,'staff_manage')
    or private.exam_has_capability(f.center_id,'appointments_read') then
    raise exception 'Invited staff must not inherit Director or operational capabilities before payment';
  end if;

  perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.owner_id,'role','authenticated')::text,true);

  reset role;
  update public.partner_universes set enabled=true
   where partner_id=f.partner_id and universe_slug='examens';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.owner_id,'role','authenticated')::text,true);
  if private.exam_has_capability(f.center_id,'staff_manage') then
    raise exception 'Pending roster setup must not survive a non-disabled universe';
  end if;

  reset role;
  update public.partner_universes set enabled=false
   where partner_id=f.partner_id and universe_slug='examens';
  update public.exam_centers set status='active' where id=f.center_id;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.owner_id,'role','authenticated')::text,true);
  if private.exam_has_capability(f.center_id,'staff_manage') then
    raise exception 'Pending dossier must not grant pre-opening access to an active center';
  end if;

  reset role;
  update public.exam_centers set status='draft' where id=f.center_id;
  update public.partners set status='active' where id=f.partner_id;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.owner_id,'role','authenticated')::text,true);
  if private.exam_has_capability(f.center_id,'staff_manage') then
    raise exception 'An active Partner with a pending dossier must not receive setup exemption';
  end if;

  reset role;
  update public.partners set status='pending' where id=f.partner_id;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.owner_id,'role','authenticated')::text,true);

  reset role;
  select count(*) into v_count
  from public.partners pa
  join public.admin_partner_dossiers d on d.partner_id=pa.id
  join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug='examens'
  join public.exam_centers c on c.partner_id=pa.id
  where pa.id=f.partner_id and pa.status='pending'
    and d.dossier_status='pending' and pu.enabled=false and c.status='draft';
  if v_count<>1 then raise exception 'Setup exception must leave Partner, dossier, universe and center unopened'; end if;
end
$test$;

rollback;
