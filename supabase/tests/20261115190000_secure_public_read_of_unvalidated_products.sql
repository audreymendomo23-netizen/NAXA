do $test$
declare
  v_rls_enabled boolean;
  v_public_policy record;
  v_authenticated_policy record;
  v_insert_policy record;
begin
  select c.relrowsecurity into v_rls_enabled
  from pg_class c where c.oid='public.produits'::regclass;
  if v_rls_enabled is not true then
    raise exception 'RLS doit rester activée sur public.produits';
  end if;

  select policyname,cmd,roles,qual into v_public_policy
  from pg_policies
  where schemaname='public' and tablename='produits'
    and policyname='produits_public_validated_read';
  if not found or v_public_policy.cmd<>'SELECT'
     or v_public_policy.roles<>'{anon}'
     or position('fiche_validee' in lower(v_public_policy.qual))=0
     or position('is_admin' in lower(v_public_policy.qual))>0
     or position('my_pharmacie' in lower(v_public_policy.qual))>0 then
    raise exception 'La lecture anon doit être strictement limitée aux fiches validées';
  end if;

  select policyname,cmd,roles,qual into v_authenticated_policy
  from pg_policies
  where schemaname='public' and tablename='produits'
    and policyname='produits_authenticated_catalog_read';
  if not found or v_authenticated_policy.cmd<>'SELECT'
     or v_authenticated_policy.roles<>'{authenticated}'
     or position('fiche_validee' in lower(v_authenticated_policy.qual))=0
     or position('is_admin' in lower(v_authenticated_policy.qual))=0
     or position('naxa_business_function' in lower(v_authenticated_policy.qual))=0
     or position('my_pharmacie' in lower(v_authenticated_policy.qual))=0
     or position('livreur' in lower(v_authenticated_policy.qual))>0 then
    raise exception 'La lecture authentifiée doit distinguer catalogue validé, Admin et postes pharmacie actifs';
  end if;

  select policyname,cmd,roles,with_check into v_insert_policy
  from pg_policies
  where schemaname='public' and tablename='produits'
    and policyname='produits_write';
  if not found or v_insert_policy.cmd<>'INSERT'
     or v_insert_policy.roles<>'{authenticated}'
     or position('fiche_validee' in lower(v_insert_policy.with_check))=0
     or position('is_admin' in lower(v_insert_policy.with_check))=0
     or position('naxa_business_function' in lower(v_insert_policy.with_check))=0 then
    raise exception 'L INSERT pharmacie doit refuser fiche_validee=true hors Admin';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='produits'
      and cmd='SELECT' and roles::text like '%public%'
      and policyname not in ('produits_public_validated_read','produits_authenticated_catalog_read')
  ) then
    raise exception 'Une autre policy SELECT publique pourrait élargir l''accès';
  end if;

  if not has_table_privilege('anon','public.produits','SELECT') then
    raise exception 'Le test attend le privilège SELECT anon existant, filtré par RLS';
  end if;
end
$test$;

begin;
set local role anon;
do $anon_test$
begin
  if exists (select 1 from public.produits where fiche_validee is not true) then
    raise exception 'Anon peut encore lire une fiche non validée';
  end if;
end
$anon_test$;
reset role;

select set_config(
  'request.jwt.claim.sub',
  (select p.id::text from public.profiles p where p.role='admin' and p.actif=true order by p.created_at limit 1),
  true
);
select set_config(
  'naxa_test.expected_products',
  (select count(*)::text from public.produits),
  true
);
set local role authenticated;
do $admin_test$
declare
  v_expected integer;
  v_visible integer;
begin
  v_expected := current_setting('naxa_test.expected_products')::integer;
  select count(*) into v_visible from public.produits;
  if v_visible <> v_expected then
    raise exception 'Admin doit conserver l''accès complet au catalogue (% attendus, % visibles)', v_expected, v_visible;
  end if;
end
$admin_test$;
rollback;

select 'Products RLS: anon limited to validated; authenticated internal/admin scope preserved; pharmacy INSERT cannot self-validate: PASS' as result;
