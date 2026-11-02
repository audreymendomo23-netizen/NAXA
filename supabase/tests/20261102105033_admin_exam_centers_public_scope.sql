-- Test comportemental de cloisonnement public des centres Examens.
-- Les deux partenaires sont actifs, mais un seul a l'association Examens activée.
-- Univers/feature flag sont activés temporairement et tous les changements sont annulés.

begin;

update public.universes set enabled=true where slug='examens';
update public.feature_flags set enabled=true where flag_key='universe.examens';

insert into public.partners(id,name,partner_type,status,city)
values
('01500000-0000-4000-8000-000000000101','E14 Centre autorisé','centre_examen','active','Yaoundé'),
('01500000-0000-4000-8000-000000000102','E14 Centre non associé','centre_examen','active','Yaoundé');

insert into public.partner_universes(partner_id,universe_slug,enabled)
values
('01500000-0000-4000-8000-000000000101','examens',true),
('01500000-0000-4000-8000-000000000102','examens',false);

insert into public.exam_centers(id,partner_id,display_name,status)
values
('01500000-0000-4000-8000-000000000201','01500000-0000-4000-8000-000000000101','Centre autorisé E14','active'),
('01500000-0000-4000-8000-000000000202','01500000-0000-4000-8000-000000000102','Centre non associé E14','active');

select set_config('request.jwt.claim.role','anon',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;

do $test$
declare
  v_count integer;
  v_allowed boolean;
  v_forbidden boolean;
begin
  select count(*) into v_count from public.exam_centers;
  select exists(select 1 from public.exam_centers where id='01500000-0000-4000-8000-000000000201') into v_allowed;
  select exists(select 1 from public.exam_centers where id='01500000-0000-4000-8000-000000000202') into v_forbidden;
  if v_count <> 1 or not v_allowed or v_forbidden then
    raise exception 'E14 public scope mismatch: count=%, allowed=%, forbidden=%',v_count,v_allowed,v_forbidden;
  end if;
end;
$test$;

reset role;
rollback;
select 'E14 exam public partner scope PASS' as resultat;
