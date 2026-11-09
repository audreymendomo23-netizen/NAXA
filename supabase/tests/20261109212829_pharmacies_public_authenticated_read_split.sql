-- Regression contract for the anonymous/authenticated pharmacy read split.
do $$
declare
  v_rls_enabled boolean;
begin
  select c.relrowsecurity into v_rls_enabled
  from pg_class c
  where c.oid='public.pharmacies'::regclass;

  if v_rls_enabled is distinct from true then
    raise exception 'RLS must remain enabled on public.pharmacies';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pharmacies'
      and policyname in ('pharmacies_read','pharmacies_admin')
  ) then
    raise exception 'Legacy overlapping pharmacy policies must be removed';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pharmacies'
      and policyname='pharmacies_read_anon'
      and cmd='SELECT'
      and roles=array['anon']::name[]
      and position('actif' in coalesce(qual,''))>0
      and position('private.is_admin' in coalesce(qual,''))=0
  ) then
    raise exception 'Anonymous pharmacy read must filter active rows without calling private.is_admin';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pharmacies'
      and policyname='pharmacies_read_authenticated'
      and cmd='SELECT'
      and roles=array['authenticated']::name[]
      and position('actif' in coalesce(qual,''))>0
      and position('private.is_admin()' in coalesce(qual,''))>0
  ) then
    raise exception 'Authenticated read must preserve active rows and admin visibility';
  end if;

  if (
    select count(*) from pg_policies
    where schemaname='public' and tablename='pharmacies'
      and cmd='SELECT' and 'anon'=any(roles)
  ) <> 1 then
    raise exception 'Expected exactly one anon SELECT policy';
  end if;

  if (
    select count(*) from pg_policies
    where schemaname='public' and tablename='pharmacies'
      and cmd='SELECT' and 'authenticated'=any(roles)
  ) <> 1 then
    raise exception 'Expected exactly one authenticated SELECT policy';
  end if;

  if has_function_privilege('anon','private.is_admin()','EXECUTE') is distinct from false then
    raise exception 'Do not grant anonymous EXECUTE on private.is_admin';
  end if;

  if has_function_privilege('authenticated','private.is_admin()','EXECUTE') is distinct from true then
    raise exception 'Authenticated role must retain the guarded private admin helper';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pharmacies'
      and policyname='pharmacies_admin_insert'
      and cmd='INSERT'
      and roles=array['authenticated']::name[]
      and position('is_admin()' in coalesce(with_check,''))>0
  ) then
    raise exception 'Admin INSERT must be limited to authenticated admins';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pharmacies'
      and policyname='pharmacies_admin_update'
      and cmd='UPDATE'
      and roles=array['authenticated']::name[]
      and position('is_admin()' in coalesce(qual,''))>0
      and position('is_admin()' in coalesce(with_check,''))>0
  ) then
    raise exception 'Admin UPDATE must remain guarded in USING and WITH CHECK';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pharmacies'
      and policyname='pharmacies_admin_delete'
      and cmd='DELETE'
      and roles=array['authenticated']::name[]
      and position('is_admin()' in coalesce(qual,''))>0
  ) then
    raise exception 'Admin DELETE must be limited to authenticated admins';
  end if;
end;
$$;
