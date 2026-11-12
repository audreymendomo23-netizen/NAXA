-- Structural regression test for authenticated architecture-level RLS.
do $$
declare
  v_rls_enabled boolean;
  v_select_policy_count integer;
begin
  select c.relrowsecurity
    into v_rls_enabled
  from pg_class c
  where c.oid = 'public.naxa_architecture_niveaux'::regclass;

  if v_rls_enabled is distinct from true then
    raise exception 'RLS must remain enabled on public.naxa_architecture_niveaux';
  end if;

  select count(*)
    into v_select_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'naxa_architecture_niveaux'
    and cmd = 'SELECT'
    and permissive = 'PERMISSIVE'
    and roles = array['authenticated']::name[];

  if v_select_policy_count <> 1 then
    raise exception 'Expected exactly one permissive authenticated SELECT policy; found %',
      v_select_policy_count;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'naxa_architecture_niveaux'
      and policyname = 'naxa_architecture_niveaux_read'
      and cmd = 'SELECT'
      and roles = array['authenticated']::name[]
      and qual = 'true'
  ) then
    raise exception 'Authenticated architecture-level read policy must remain unchanged';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'naxa_architecture_niveaux'
      and policyname = 'naxa_architecture_niveaux_admin_write'
  ) then
    raise exception 'Legacy overlapping admin ALL policy must be removed';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'naxa_architecture_niveaux'
      and policyname = 'naxa_architecture_niveaux_admin_insert'
      and cmd = 'INSERT'
      and roles = array['authenticated']::name[]
      and position('is_admin()' in coalesce(with_check,'')) > 0
  ) then
    raise exception 'Admin INSERT must remain guarded by is_admin()';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'naxa_architecture_niveaux'
      and policyname = 'naxa_architecture_niveaux_admin_update'
      and cmd = 'UPDATE'
      and roles = array['authenticated']::name[]
      and position('is_admin()' in coalesce(qual,'')) > 0
      and position('is_admin()' in coalesce(with_check,'')) > 0
  ) then
    raise exception 'Admin UPDATE must remain guarded by is_admin() in USING and WITH CHECK';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'naxa_architecture_niveaux'
      and policyname = 'naxa_architecture_niveaux_admin_delete'
      and cmd = 'DELETE'
      and roles = array['authenticated']::name[]
      and position('is_admin()' in coalesce(qual,'')) > 0
  ) then
    raise exception 'Admin DELETE must remain guarded by is_admin()';
  end if;
end;
$$;
