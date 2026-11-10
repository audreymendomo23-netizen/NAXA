-- Replay regression: only a commercially valid Promoteur can access child profiles.
-- All users, profiles, pharmacies, memberships and subscriptions are rolled back.
begin;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('00000000-0000-0000-0000-000000000000','02400000-0000-4000-8000-000000000001','authenticated','authenticated','valid-promoter-rls4@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"username":"valid_promoter_rls4","first_name":"Valid","last_name":"Promoter","phone":"+237600000241","phone_country":"CM","date_of_birth":"1990-01-01","consent_accepted":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000000','02400000-0000-4000-8000-000000000002','authenticated','authenticated','expired-promoter-rls4@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"username":"expired_promoter_rls4","first_name":"Expired","last_name":"Promoter","phone":"+237600000242","phone_country":"CM","date_of_birth":"1990-01-01","consent_accepted":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000000','02400000-0000-4000-8000-000000000011','authenticated','authenticated','valid-child-rls4@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"username":"valid_child_rls4","first_name":"Valid","last_name":"Child","phone":"+237600000243","phone_country":"CM","date_of_birth":"1990-01-01","consent_accepted":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000021','02400000-0000-4000-8000-000000000021','authenticated','authenticated','expired-child-rls4@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"username":"expired_child_rls4","first_name":"Expired","last_name":"Child","phone":"+237600000244","phone_country":"CM","date_of_birth":"1990-01-01","consent_accepted":true}'::jsonb,now(),now());

insert into public.pharmacies(id,nom,lat,lng,actif)
values
('02400000-0000-4000-8000-000000000101','Audit valid promoter pharmacy 4',3.8631,11.5131,true),
('02400000-0000-4000-8000-000000000102','Audit expired promoter pharmacy 4',3.8632,11.5132,true);

update public.profiles set role='promoteur',username='valid_promoter_rls4',first_name='Valid',last_name='Promoter',phone='+237600000241',phone_country='CM',date_of_birth='1990-01-01',age_verified=true,consent_accepted_at=now(),actif=true,fonction_interne='promoteur',niveau_interne=1,niveau_hierarchique=1,architecture_code='ORPHELIN',parent_profile_id=null,pharmacie_id=null where id='02400000-0000-4000-8000-000000000001';
update public.profiles set role='promoteur',username='expired_promoter_rls4',first_name='Expired',last_name='Promoter',phone='+237600000242',phone_country='CM',date_of_birth='1990-01-01',age_verified=true,consent_accepted_at=now(),actif=true,fonction_interne='promoteur',niveau_interne=1,niveau_hierarchique=1,architecture_code='ORPHELIN',parent_profile_id=null,pharmacie_id=null where id='02400000-0000-4000-8000-000000000002';
update public.profiles set role='caisse',username='valid_child_rls4',first_name='Valid',last_name='Child',phone='+237600000243',phone_country='CM',date_of_birth='1990-01-01',age_verified=true,consent_accepted_at=now(),actif=true,fonction_interne='caisse',niveau_interne=3,niveau_hierarchique=3,architecture_code='ORPHELIN',parent_profile_id='02400000-0000-4000-8000-000000000001',pharmacie_id='02400000-0000-4000-8000-000000000101' where id='02400000-0000-4000-8000-000000000011';
update public.profiles set role='caisse',username='expired_child_rls4',first_name='Expired',last_name='Child',phone='+237600000244',phone_country='CM',date_of_birth='1990-01-01',age_verified=true,consent_accepted_at=now(),actif=true,fonction_interne='caisse',niveau_interne=3,niveau_hierarchique=3,architecture_code='ORPHELIN',parent_profile_id='02400000-0000-4000-8000-000000000002',pharmacie_id='02400000-0000-4000-8000-000000000102' where id='02400000-0000-4000-8000-000000000021';

insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
values
('02400000-0000-4000-8000-000000000001',30000,current_date+30,'active','ORPHELIN'),
('02400000-0000-4000-8000-000000000002',30000,current_date-1,'expiree','ORPHELIN');

insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
select p.id,c.id,30000,current_date,
       case when p.id='02400000-0000-4000-8000-000000000001'::uuid then current_date+30 else current_date-1 end,
       case when p.id='02400000-0000-4000-8000-000000000001'::uuid then 'actif' else 'impaye' end
from public.profiles p join public.conventions_promoteurs c on c.promoteur_id=p.id
where p.id in ('02400000-0000-4000-8000-000000000001','02400000-0000-4000-8000-000000000002');

insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
values ('02400000-0000-4000-8000-000000000101','ORPHELIN','02400000-0000-4000-8000-000000000001',true,0,1);

-- The expired Promoteur deliberately receives no active pharmacy link.
insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
values ('02400000-0000-4000-8000-000000000001','02400000-0000-4000-8000-000000000101',true);

set local role authenticated;
set local request.jwt.claim.sub='02400000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"sub":"02400000-0000-4000-8000-000000000001","role":"authenticated"}';
do $valid_promoter$
declare n integer;
begin
  if public.naxa_business_function(auth.uid()) is distinct from 'promoteur' then raise exception 'Valid promoter fixture not recognized'; end if;
  select count(*) into n from public.profiles where id='02400000-0000-4000-8000-000000000011';
  if n<>1 then raise exception 'Valid promoter must read its own team profile, got %',n; end if;
end
$valid_promoter$;

set local request.jwt.claim.sub='02400000-0000-4000-8000-000000000002';
set local request.jwt.claims='{"sub":"02400000-0000-4000-8000-000000000002","role":"authenticated"}';
do $expired_promoter$
declare n integer;
begin
  if public.is_promoteur() is not true then raise exception 'Fixture must exercise the legacy helper'; end if;
  if public.naxa_business_function(auth.uid()) is not null then raise exception 'Expired promoter should have no canonical role'; end if;
  select count(*) into n from public.profiles where id='02400000-0000-4000-8000-000000000021';
  if n<>0 then raise exception 'Expired promoter can still read child profile, got %',n; end if;
  update public.profiles set username='expired_child_modified'
    where id='02400000-0000-4000-8000-000000000021';
  get diagnostics n = row_count;
  if n<>0 then raise exception 'Expired promoter can still update child profile'; end if;
end
$expired_promoter$;

reset role;
set local role anon;
set local request.jwt.claim.sub='';
set local request.jwt.claims='{"role":"anon"}';
do $anonymous$
declare n integer;
begin
  select count(*) into n from public.profiles where id='02400000-0000-4000-8000-000000000011';
  if n<>0 then raise exception 'Anonymous user can read a profile'; end if;
end
$anonymous$;

select 'PASS — profiles RLS canonical promoter validity: active read 1, expired read/update 0, anon read 0' as result;
rollback;
