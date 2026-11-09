-- Structural regression test for the dictionnaire RLS policy split.
-- Behavioral probes were executed transactionally on Replay for admin,
-- authenticated non-admin, and anon identities; this file keeps the policy
-- contract executable for future migration/test passes.
do $$
declare
  v_rls_enabled boolean;
  v_select_policy_count integer;
begin
  select c.relrowsecurity
    into v_rls_enabled
  from pg_class c
  where c.oid = 'public.dictionnaire'::regclass;

  if v_rls_enabled is distinct from true then
    raise exception 'RLS must remain enabled on public.dictionnaire';
  end if;

  select count(*)
    into v_select_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'dictionnaire'
    and cmd = 'SELECT'
    and permissive = 'PERMISSIVE'
    and roles = array['public']::name[];

  if v_select_policy_count <> 1 then
    raise exception 'Expected exactly one permissive public SELECT policy; found %',
      v_select_policy_count;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dictionnaire'
      and policyname = 'dico_lecture'
      and cmd = 'SELECT'
      and roles = array['public']::name[]
      and qual = 'true'
  ) then
    raise exception 'Public dictionary read policy must remain unrestricted';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dictionnaire'
      and policyname = 'dico_admin'
  ) then
    raise exception 'Legacy overlapping dico_admin ALL policy must be removed';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dictionnaire'
      and policyname = 'dico_admin_insert'
      and cmd = 'INSERT'
      and roles = array['public']::name[]
      and with_check = 'is_admin()'
  ) then
    raise exception 'Admin INSERT must remain guarded by is_admin()';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dictionnaire'
      and policyname = 'dico_admin_update'
      and cmd = 'UPDATE'
      and roles = array['public']::name[]
      and qual = 'is_admin()'
      and with_check = 'is_admin()'
  ) then
    raise exception 'Admin UPDATE must remain guarded by is_admin() in USING and WITH CHECK';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dictionnaire'
      and policyname = 'dico_admin_delete'
      and cmd = 'DELETE'
      and roles = array['public']::name[]
      and qual = 'is_admin()'
  ) then
    raise exception 'Admin DELETE must remain guarded by is_admin()';
  end if;
end;
$$;
