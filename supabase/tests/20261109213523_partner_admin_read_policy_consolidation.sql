-- Contract test for partner-admin read/write policy consolidation.
do $$
declare
  t text;
begin
  foreach t in array array['partner_members','partner_universes','partners'] loop
    if not exists (
      select 1 from pg_class c
      where c.oid=to_regclass(format('public.%I',t)) and c.relrowsecurity
    ) then raise exception 'RLS must remain enabled on public.%',t; end if;

    if (
      select count(*) from pg_policies
      where schemaname='public' and tablename=t
        and cmd='SELECT' and 'authenticated'=any(roles)
    ) <> 1 then
      raise exception 'Expected one authenticated SELECT policy on %',t;
    end if;
  end loop;

  if exists (
    select 1 from pg_policies
    where schemaname='public'
      and ((tablename='partner_members' and policyname='partner_members_admin_all')
        or (tablename='partner_universes' and policyname='partner_universes_admin_all')
        or (tablename='partners' and policyname='partners_admin_all'))
  ) then raise exception 'Legacy Admin ALL policies remain'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='partner_members'
      and policyname='partner_members_self_read'
      and cmd='SELECT' and roles=array['authenticated']::name[]
      and position('auth.uid()' in coalesce(qual,''))>0
      and position('is_admin()' in coalesce(qual,''))>0
  ) then raise exception 'partner_members self/Admin read scope changed'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='partner_universes'
      and policyname='partner_universes_member_read'
      and cmd='SELECT' and roles=array['authenticated']::name[]
      and position('partner_members' in coalesce(qual,''))>0
      and position('partners' in coalesce(qual,''))>0
      and position('status' in coalesce(qual,''))>0
      and position('is_admin()' in coalesce(qual,''))>0
  ) then raise exception 'partner_universes membership/Admin read scope changed'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='partners'
      and policyname='partners_member_read'
      and cmd='SELECT' and roles=array['authenticated']::name[]
      and position('partner_members' in coalesce(qual,''))>0
      and position('status' in coalesce(qual,''))>0
      and position('is_admin()' in coalesce(qual,''))>0
  ) then raise exception 'partners membership/Admin read scope changed'; end if;

  if exists (
    select 1
    from (values
      ('partner_members','partner_members_admin_insert'),
      ('partner_members','partner_members_admin_update'),
      ('partner_members','partner_members_admin_delete'),
      ('partner_universes','partner_universes_admin_insert'),
      ('partner_universes','partner_universes_admin_update'),
      ('partner_universes','partner_universes_admin_delete'),
      ('partners','partners_admin_insert'),
      ('partners','partners_admin_update'),
      ('partners','partners_admin_delete')
    ) as expected(tablename,policyname)
    where not exists (
      select 1 from pg_policies p
      where p.schemaname='public' and p.tablename=expected.tablename
        and p.policyname=expected.policyname
        and p.roles=array['authenticated']::name[]
        and position('is_admin()' in coalesce(p.qual,'') || coalesce(p.with_check,''))>0
    )
  ) then raise exception 'Admin-only DML policy missing or unguarded'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.partner_universes'::regclass
      and tgname='guard_medical_devices_partner_universe_phase1'
      and not tgisinternal
  ) then raise exception 'Medical devices phase-1 guard trigger must remain'; end if;
end;
$$;
