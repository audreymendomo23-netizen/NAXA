-- Contrat de non-régression des invitations du personnel Examens.
-- Toutes les données sont temporaires et la transaction est annulée à la fin.
begin;

create temporary table exam_staff_invite_fixture (
  owner_id uuid not null,
  invitee_id uuid not null,
  wrong_user_id uuid not null,
  partner_id uuid not null,
  center_id uuid not null
) on commit drop;

insert into exam_staff_invite_fixture
values (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());

grant select on table pg_temp.exam_staff_invite_fixture to authenticated;

insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id,'authenticated','authenticated',
  'owner-'||left(owner_id::text,8)||'@example.invalid',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"naxa_signup_pending":"true"}'::jsonb,now(),now()
from exam_staff_invite_fixture
union all
select invitee_id,'authenticated','authenticated',
  'invitee-'||left(invitee_id::text,8)||'@example.invalid',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"naxa_signup_pending":"true"}'::jsonb,now(),now()
from exam_staff_invite_fixture
union all
select wrong_user_id,'authenticated','authenticated',
  'wrong-'||left(wrong_user_id::text,8)||'@example.invalid',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"naxa_signup_pending":"true"}'::jsonb,now(),now()
from exam_staff_invite_fixture;

insert into public.profiles(id,username,first_name,last_name,phone,phone_country,date_of_birth,age_verified,consent_accepted_at,actif)
select owner_id,'owner_'||replace(owner_id::text,'-',''),'Test','Owner','699000001','CM',date '1990-01-01',true,now(),true
from exam_staff_invite_fixture
union all
select invitee_id,'invitee_'||replace(invitee_id::text,'-',''),'Test','Invitee','699000002','CM',date '1990-01-01',true,now(),true
from exam_staff_invite_fixture;

insert into public.partners(id,name,partner_type,status,created_by)
select partner_id,'Examens invitation fixture '||left(partner_id::text,8),'centre_examen','active',owner_id
from exam_staff_invite_fixture;

insert into public.partner_members(partner_id,user_id,member_role)
select partner_id,owner_id,'owner' from exam_staff_invite_fixture;

insert into public.exam_centers(id,partner_id,display_name,address_label,status)
select center_id,partner_id,'Invitation fixture '||left(center_id::text,8),'Rollback test','active'
from exam_staff_invite_fixture;

update public.partner_members pm
set member_role='manager'
from exam_staff_invite_fixture f
where pm.partner_id=f.partner_id and pm.user_id=f.owner_id;

create or replace function pg_temp.exam_staff_account_survives(p_user uuid)
returns boolean language sql security definer set search_path=''
as $function$
  select exists(select 1 from auth.users where id=p_user)
     and exists(select 1 from public.profiles where id=p_user and actif is true);
$function$;

set local role authenticated;

do $test$
declare
  f record;
  v_email text;
  v_token uuid;
  v_token_again uuid;
  v_invite_id uuid;
  v_new_token uuid;
  v_result jsonb;
  v_direct jsonb;
  v_count integer;
  v_rejected boolean;
begin
  select * into f from pg_temp.exam_staff_invite_fixture;

  select 'invitee-'||left(f.invitee_id::text,8)||'@example.invalid' into v_email;

  perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.owner_id,'role','authenticated')::text,true);

  select count(*) into v_count
  from public.exam_staff_assignments
  where center_id=f.center_id and user_id=f.owner_id and role_key='directeur'
    and is_active and active_role and revoked_at is null;
  if v_count<>1 then raise exception 'Partner/center director synchronization failed'; end if;

  perform set_config('request.jwt.claim.sub',f.wrong_user_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.wrong_user_id,'role','authenticated')::text,true);
  v_rejected:=false;
  begin
    perform public.exam_assign_existing_staff(
      f.center_id,'invitee_'||replace(f.invitee_id::text,'-',''),'accueil'
    );
  exception when insufficient_privilege then v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Unauthorised direct assignment was not rejected'; end if;

  perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.owner_id,'role','authenticated')::text,true);

  v_direct:=public.exam_assign_existing_staff(
    f.center_id,'invitee_'||replace(f.invitee_id::text,'-',''),'accueil'
  );
  if coalesce((v_direct->>'assigned')::boolean,false) is not true
    or (v_direct->>'user_id')::uuid<>f.invitee_id then
    raise exception 'Direct assignment of an existing NAXA account failed';
  end if;

  select count(*) into v_count
  from public.exam_staff_assignments
  where center_id=f.center_id and user_id=f.invitee_id
    and role_key='accueil' and is_active and revoked_at is null;
  if v_count<>1 then raise exception 'Direct assignment was not persisted'; end if;

  v_rejected:=false;
  begin
    perform public.exam_assign_existing_staff(
      f.center_id,'invitee_'||replace(f.invitee_id::text,'-',''),'accueil'
    );
  exception when unique_violation then v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Duplicate direct assignment was not rejected'; end if;

  v_rejected:=false;
  begin
    perform public.exam_assign_existing_staff(f.center_id,'missing-account','accueil');
  exception when no_data_found then v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Unknown direct-assignment account was not rejected'; end if;

  v_rejected:=false;
  begin
    perform public.exam_create_staff_invite(f.center_id,'null-role@example.invalid',null);
  exception when sqlstate '22023' then v_rejected:=true;
  end;
  if not v_rejected then raise exception 'NULL role was not rejected'; end if;

  v_rejected:=false;
  begin
    perform public.exam_create_staff_invite(f.center_id,'director-role@example.invalid','directeur');
  exception when sqlstate '22023' then v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Director role must not be self-invited'; end if;

  v_rejected:=false;
  begin
    perform public.exam_create_staff_invite(f.center_id,'livreur@example.invalid','livreur');
  exception when sqlstate '22023' then v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Livreur role must be excluded from Examens invitations'; end if;

  v_rejected:=false;
  begin
    perform public.exam_assign_existing_staff(f.center_id,'invitee_'||replace(f.invitee_id::text,'-',''),'livreur');
  exception when sqlstate '22023' then v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Livreur role must be excluded from direct Examens assignment'; end if;

  v_token:=public.exam_create_staff_invite(f.center_id,v_email,'technicien_laboratoire');
  select invite_id into v_invite_id
  from public.exam_list_staff_invites(f.center_id)
  where email=v_email and role_key='technicien_laboratoire';
  if v_invite_id is null then raise exception 'Invite was not listed'; end if;

  v_token_again:=public.exam_get_staff_invite_token(f.center_id,v_invite_id);
  if v_token_again is distinct from v_token then raise exception 'Secure invite token retrieval failed'; end if;

  perform set_config('request.jwt.claim.sub',f.wrong_user_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.wrong_user_id,'role','authenticated')::text,true);
  v_rejected:=false;
  begin
    perform public.exam_accept_staff_invite(v_token);
  exception when insufficient_privilege then v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Wrong email account accepted invite'; end if;

  perform set_config('request.jwt.claim.sub',f.invitee_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.invitee_id,'role','authenticated')::text,true);
  v_result:=public.exam_accept_staff_invite(v_token);
  if coalesce((v_result->>'accepted')::boolean,false) is not true then
    raise exception 'Valid invitation was not accepted';
  end if;

  v_rejected:=false;
  begin
    perform public.exam_accept_staff_invite(v_token);
  exception when others then v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Invitation was accepted twice'; end if;

  perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.owner_id,'role','authenticated')::text,true);
  update public.exam_staff_assignments
  set is_active=false,active_role=false,revoked_at=now()
  where center_id=f.center_id and user_id=f.invitee_id
    and role_key='technicien_laboratoire' and is_active;
  if not found then raise exception 'Assignment revocation failed'; end if;

  if not pg_temp.exam_staff_account_survives(f.invitee_id) then
    raise exception 'Revoking an assignment must preserve the active NAXA profile and Auth account';
  end if;

  select count(*) into v_count from public.exam_staff_assignments
  where center_id=f.center_id and user_id=f.invitee_id
    and role_key='technicien_laboratoire' and is_active is false
    and active_role is false and revoked_at is not null;
  if v_count<>1 then raise exception 'Revoked assignment history must be retained'; end if;

  v_new_token:=public.exam_create_staff_invite(f.center_id,v_email,'technicien_laboratoire');
  perform set_config('request.jwt.claim.sub',f.invitee_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.invitee_id,'role','authenticated')::text,true);
  v_result:=public.exam_accept_staff_invite(v_new_token);
  if coalesce((v_result->>'accepted')::boolean,false) is not true then
    raise exception 'Reassignment after revocation failed';
  end if;

  perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.owner_id,'role','authenticated')::text,true);
  perform public.exam_create_staff_invite(f.center_id,'revoke-'||left(f.owner_id::text,8)||'@example.invalid','accueil');
  select invite_id into v_invite_id
  from public.exam_list_staff_invites(f.center_id)
  where email='revoke-'||left(f.owner_id::text,8)||'@example.invalid';
  if public.exam_revoke_staff_invite(f.center_id,v_invite_id) is not true then
    raise exception 'Invite revocation failed';
  end if;

  select count(*) into v_count
  from public.exam_list_staff_invites(f.center_id)
  where invite_id=v_invite_id;
  if v_count<>0 then raise exception 'Revoked invitation remains pending'; end if;
end
$test$;

rollback;
