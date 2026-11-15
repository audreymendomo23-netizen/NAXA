-- Products become public through pharmacy-owned publication, not NAXA fiche approval.
-- Anonymous reads require a real active public pharmacy offer; pharmacy staff and Admin
-- retain their separate, scoped read paths.
begin;

do $test$
declare
  v_rls_enabled boolean;
  v_public_policy record;
  v_authenticated_policy record;
  v_insert_policy record;
  v_update_policy record;
begin
  select c.relrowsecurity into v_rls_enabled
  from pg_class c where c.oid='public.produits'::regclass;
  if v_rls_enabled is not true then
    raise exception 'RLS doit rester activée sur public.produits';
  end if;

  select policyname,cmd,roles,qual into v_public_policy
  from pg_policies
  where schemaname='public' and tablename='produits'
    and policyname='produits_public_live_offer_read';
  if not found or v_public_policy.cmd<>'SELECT'
     or v_public_policy.roles<>'{anon}'
     or position('marketplace_produit_visible' in lower(v_public_policy.qual))=0 then
    raise exception 'La lecture anon doit dépendre de la visibilité réelle de la pharmacie propriétaire';
  end if;

  select policyname,cmd,roles,qual into v_authenticated_policy
  from pg_policies
  where schemaname='public' and tablename='produits'
    and policyname='produits_authenticated_live_offer_read';
  if not found or v_authenticated_policy.cmd<>'SELECT'
     or v_authenticated_policy.roles<>'{authenticated}'
     or position('marketplace_produit_visible' in lower(v_authenticated_policy.qual))=0
     or position('is_admin' in lower(v_authenticated_policy.qual))=0
     or position('my_pharmacie' in lower(v_authenticated_policy.qual))=0
     or position('fiche_validee' in lower(v_authenticated_policy.qual))>0 then
    raise exception 'La lecture authentifiée doit préserver Marketplace, Admin et catalogue interne sans validation NAXA';
  end if;

  select policyname,cmd,roles,with_check into v_insert_policy
  from pg_policies
  where schemaname='public' and tablename='produits'
    and policyname='produits_write';
  if not found or v_insert_policy.cmd<>'INSERT'
     or v_insert_policy.roles<>'{authenticated}'
     or position('created_by' in lower(v_insert_policy.with_check))=0
     or position('created_by_pharmacie_id' in lower(v_insert_policy.with_check))=0
     or position('naxa_scope_allows' in lower(v_insert_policy.with_check))=0
     or position('fiche_validee' in lower(v_insert_policy.with_check))=0 then
    raise exception 'INSERT doit rester attribué à la pharmacie, sans auto-validation NAXA';
  end if;

  select policyname,cmd,roles,qual,with_check into v_update_policy
  from pg_policies
  where schemaname='public' and tablename='produits'
    and policyname='produits_update';
  if not found or v_update_policy.cmd<>'UPDATE'
     or v_update_policy.roles<>'{authenticated}'
     or position('created_by_pharmacie_id' in lower(v_update_policy.qual))=0
     or position('created_by_pharmacie_id' in lower(v_update_policy.with_check))=0 then
    raise exception 'UPDATE doit rester limité à la pharmacie propriétaire de la déclaration';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='produits'
      and cmd='SELECT' and 'public'=any(roles)
      and policyname not in ('produits_public_live_offer_read','produits_authenticated_live_offer_read')
  ) then
    raise exception 'Une policy SELECT publique supplémentaire pourrait élargir la lecture du catalogue';
  end if;

  if not has_table_privilege('anon','public.produits','SELECT') then
    raise exception 'Le test attend le privilège SELECT anon filtré par RLS';
  end if;
end
$test$;

set local role anon;
do $anon_test$
begin
  -- This Replay fixture is demo-only: no demo pharmacy may expose product rows.
  if exists (select 1 from public.produits) then
    raise exception 'Une pharmacie démo/masquée a exposé une fiche à anon';
  end if;
end
$anon_test$;
reset role;

select set_config(
  'request.jwt.claim.sub',
  (select p.id::text from public.profiles p
   where p.role='admin' and p.actif=true
   order by p.created_at limit 1),
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
    raise exception 'Admin doit conserver la lecture complète du catalogue (% attendus, % visibles)', v_expected, v_visible;
  end if;
end
$admin_test$;
rollback;

select 'Products RLS: pharmacy-owned listing, live public visibility, pharmacy-scoped updates; no NAXA fiche approval gate: PASS' as result;
