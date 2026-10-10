-- NAXA 019 — validation intégrée de 021 : historique d'achats Client
-- Test exécutable sur Supabase sans dépendance à pgTAP.
-- Toutes les mutations sont encapsulées dans une transaction puis rollbackées.

begin;

create temporary table _client_019_results (
  assertion_no integer primary key,
  name text not null,
  ok boolean not null,
  detail text not null
);

insert into _client_019_results values
(1, 'reservation_events protégée par RLS',
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='reservation_events'),
  'RLS activé'),
(2, 'client_achats existe comme vue',
  exists(select 1 from pg_views where schemaname='public' and viewname='client_achats'),
  'vue présente'),
(3, 'client_achats est security_invoker',
  exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relname='client_achats'
           and 'security_invoker=true' = any(coalesce(c.reloptions,'{}'::text[]))),
  'security_invoker=true'),
(4, 'anon ne peut pas lire reservation_events',
  not has_table_privilege('anon','public.reservation_events','select'),
  'SELECT refusé à anon'),
(5, 'authenticated ne peut pas écrire reservation_events',
  not has_table_privilege('authenticated','public.reservation_events','insert'),
  'INSERT refusé à authenticated'),
(6, 'client_achats expose achat_le',
  exists(select 1 from information_schema.columns
         where table_schema='public' and table_name='client_achats' and column_name='achat_le'),
  'colonne présente'),
(7, 'client_achats expose payee_le',
  exists(select 1 from information_schema.columns
         where table_schema='public' and table_name='client_achats' and column_name='payee_le'),
  'colonne présente'),
(8, 'client_achats expose horodatage_achat_exact',
  exists(select 1 from information_schema.columns
         where table_schema='public' and table_name='client_achats' and column_name='horodatage_achat_exact'),
  'colonne présente'),
(9, 'client_achats expose photo_url',
  exists(select 1 from information_schema.columns
         where table_schema='public' and table_name='client_achats' and column_name='photo_url'),
  'colonne présente'),
(10, 'client_achats expose confirmee_le',
  exists(select 1 from information_schema.columns
         where table_schema='public' and table_name='client_achats' and column_name='confirmee_le'),
  'colonne présente'),
(11, 'client_achats expose paiement_declare_le',
  exists(select 1 from information_schema.columns
         where table_schema='public' and table_name='client_achats' and column_name='paiement_declare_le'),
  'colonne présente'),
(12, 'client_achats est bornée aux achats payés/retirés',
  position('r.statut = ANY' in pg_get_viewdef('public.client_achats'::regclass,true)) > 0
  and position('payee' in pg_get_viewdef('public.client_achats'::regclass,true)) > 0
  and position('retiree' in pg_get_viewdef('public.client_achats'::regclass,true)) > 0,
  'filtre terminal présent'),
(13, 'client_achats est bornée au Client courant',
  position('r.client_id = auth.uid()' in pg_get_viewdef('public.client_achats'::regclass,true)) > 0,
  'ownership auth.uid présent'),
(14, 'authenticated ne peut pas appeler le trigger',
  has_function_privilege('authenticated','public.log_reservation_event()','execute') is false,
  'EXECUTE refusé'),
(15, 'création directe payee/retiree horodatée',
  lower(regexp_replace(pg_get_functiondef('public.log_reservation_event()'::regprocedure), '\\s+', ' ', 'g')) like '%new.statut in (''payee'',''retiree'')%',
  'branche terminal présente'),
(16, 'référence de paiement à la création historisée',
  lower(regexp_replace(pg_get_functiondef('public.log_reservation_event()'::regprocedure), '\\s+', ' ', 'g')) like '%new.paiement_ref is not null%',
  'branche paiement présente');

-- Fixtures runtime autonomes, entièrement rollbackées à la fin du test.
-- Le test porte sur l'historique ; il ne revalide pas le trigger d'inscription.
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '01900000-0000-4000-8000-000000000001',
  'authenticated','authenticated','naxa-test-client-019@example.invalid','',
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()
);
insert into public.profiles(id,role,username,first_name,last_name,actif)
values ('01900000-0000-4000-8000-000000000001','client','naxa-test-client-019','Test','Client',true);
alter table auth.users enable trigger on_auth_user_created;

insert into public.pharmacies(id,nom,ville,lat,lng,slug,est_demo)
values ('01900000-0000-4000-8000-000000000101','NAXA Test 019','Yaoundé',3.8510,11.5050,'naxa-test-019',false);

insert into public.produits(id,nom,dci,dosage,forme,nom_norm)
values ('01900000-0000-4000-8000-000000000201','Produit test 019','Produit test','100 mg','comprimé','produit test 019');

insert into public.reservations(id,client_id,pharmacie_id,statut,total,expires_at,paiement_ref)
values ('01900000-0000-4000-8000-000000000301',
        '01900000-0000-4000-8000-000000000001',
        '01900000-0000-4000-8000-000000000101',
        'en_attente',100,now()+interval '1 hour',null);

insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
values ('01900000-0000-4000-8000-000000000301',
        '01900000-0000-4000-8000-000000000201',1,100);

-- Preuve runtime : une transition terminale et une référence de paiement
-- doivent produire les événements attendus. La modification est rollbackée.
with target as (
  select '01900000-0000-4000-8000-000000000301'::uuid
)
update public.reservations
set statut='payee', paiement_ref='TEST-CLIENT-019'
where id=(select id from target);

update _client_019_results
set ok = ok and exists(
  select 1
  from public.reservation_events e
  join public.reservations r on r.id=e.reservation_id
  where r.paiement_ref='TEST-CLIENT-019'
    and e.event_type='status_changed'
    and e.to_statut='payee'
),
detail = detail || ' + transition runtime payee'
where assertion_no=15;

update _client_019_results
set ok = ok and exists(
  select 1
  from public.reservation_events e
  join public.reservations r on r.id=e.reservation_id
  where r.paiement_ref='TEST-CLIENT-019'
    and e.event_type='payment_declared'
),
detail = detail || ' + référence runtime'
where assertion_no=16;

select
  count(*) filter (where ok) as passed,
  count(*) as total,
  count(*) filter (where not ok) as failed
from _client_019_results;

select assertion_no, name, ok, detail
from _client_019_results
order by assertion_no;

do $$
declare failed_count integer;
begin
  select count(*) into failed_count from _client_019_results where not ok;
  if failed_count > 0 then
    raise exception 'NAXA test 019 FAILED: % assertion(s)', failed_count;
  end if;
end
$$;

rollback;
