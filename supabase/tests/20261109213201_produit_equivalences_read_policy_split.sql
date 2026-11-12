-- Regression contract for product-equivalence read and admin-write scopes.
do $$
declare
  v_rls_enabled boolean;
begin
  select relrowsecurity into v_rls_enabled
  from pg_class where oid='public.produit_equivalences'::regclass;
  if v_rls_enabled is distinct from true then
    raise exception 'RLS must remain enabled';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='produit_equivalences'
      and policyname in ('produit_equivalences_admin','produit_equivalences_lecture')
  ) then raise exception 'Legacy overlapping policies remain'; end if;

  if (
    select count(*) from pg_policies
    where schemaname='public' and tablename='produit_equivalences'
      and cmd='SELECT' and 'anon'=any(roles)
  ) <> 1 then raise exception 'Expected one anon SELECT policy'; end if;

  if (
    select count(*) from pg_policies
    where schemaname='public' and tablename='produit_equivalences'
      and cmd='SELECT' and 'authenticated'=any(roles)
  ) <> 1 then raise exception 'Expected one authenticated SELECT policy'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='produit_equivalences'
      and policyname='produit_equivalences_read_anon'
      and cmd='SELECT' and roles=array['anon']::name[]
      and position('actif' in coalesce(qual,''))>0
      and position('private.is_admin' in coalesce(qual,''))=0
  ) then raise exception 'Anon must read active equivalents without private helper'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='produit_equivalences'
      and policyname='produit_equivalences_read_authenticated'
      and cmd='SELECT' and roles=array['authenticated']::name[]
      and position('actif' in coalesce(qual,''))>0
      and position('private.is_admin()' in coalesce(qual,''))>0
  ) then raise exception 'Authenticated read must preserve active and admin visibility'; end if;

  if has_function_privilege('anon','private.is_admin()','EXECUTE') is distinct from false then
    raise exception 'Anon must not execute private.is_admin'; end if;
  if has_function_privilege('authenticated','private.is_admin()','EXECUTE') is distinct from true then
    raise exception 'Authenticated must retain private admin helper'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='produit_equivalences'
      and policyname='produit_equivalences_admin_insert'
      and cmd='INSERT' and roles=array['authenticated']::name[]
      and position('is_admin()' in coalesce(with_check,''))>0
  ) then raise exception 'Admin INSERT guard missing'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='produit_equivalences'
      and policyname='produit_equivalences_admin_update'
      and cmd='UPDATE' and roles=array['authenticated']::name[]
      and position('is_admin()' in coalesce(qual,''))>0
      and position('is_admin()' in coalesce(with_check,''))>0
  ) then raise exception 'Admin UPDATE guards missing'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='produit_equivalences'
      and policyname='produit_equivalences_admin_delete'
      and cmd='DELETE' and roles=array['authenticated']::name[]
      and position('is_admin()' in coalesce(qual,''))>0
  ) then raise exception 'Admin DELETE guard missing'; end if;
end;
$$;
