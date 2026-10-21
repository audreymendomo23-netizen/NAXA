-- Test structurel : le rôle Comptable ne doit pas disposer d'une politique d'écriture générique.
begin;

do $$
declare
  v_bad integer;
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='commandes_fournisseurs'
      and policyname='commandes_fournisseurs_read_scope' and cmd='SELECT'
  ) then
    raise exception 'PASS attendu: policy SELECT commandes_fournisseurs manquante';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='commandes_fournisseurs'
      and policyname='commandes_fournisseurs_scope' and cmd='ALL'
  ) then
    raise exception 'FAIL: ancienne policy ALL commandes_fournisseurs encore active';
  end if;

  select count(*) into v_bad
  from pg_policies
  where schemaname='public'
    and tablename in ('commandes_fournisseurs','fournisseurs')
    and cmd in ('INSERT','UPDATE','DELETE')
    and coalesce(qual,'') || ' ' || coalesce(with_check,'') not ilike '%MANAGE_ACCOUNTING%';
  if v_bad > 0 then
    raise exception 'FAIL: % policy(s) écriture sans exclusion MANAGE_ACCOUNTING', v_bad;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='fournisseurs'
      and policyname='fournisseurs_read_scope' and cmd='SELECT'
  ) then
    raise exception 'FAIL: policy SELECT fournisseurs manquante';
  end if;
end $$;

select 'PASS 165_compta_readonly_reference_rls' as result;
rollback;
