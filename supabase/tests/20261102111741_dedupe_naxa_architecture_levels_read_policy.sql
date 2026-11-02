-- Regression: removing the legacy alias leaves the canonical read grant unchanged.
-- The duplicate is synthesized inside this transaction to reproduce the Production state.
begin;

drop policy if exists naxa_architecture_levels_read
  on public.naxa_architecture_niveaux;

create policy naxa_architecture_levels_read
  on public.naxa_architecture_niveaux
  for select to authenticated
  using (true);

do $test$
declare
  v_count integer;
  v_canonical record;
  v_duplicate record;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname='public'
    and tablename='naxa_architecture_niveaux'
    and policyname in ('naxa_architecture_levels_read','naxa_architecture_niveaux_read');

  if v_count <> 2 then
    raise exception 'Expected two equivalent SELECT policies before deduplication, got %',v_count;
  end if;

  select cmd,roles,qual,with_check into v_canonical
  from pg_policies
  where schemaname='public' and tablename='naxa_architecture_niveaux'
    and policyname='naxa_architecture_niveaux_read';

  select cmd,roles,qual,with_check into v_duplicate
  from pg_policies
  where schemaname='public' and tablename='naxa_architecture_niveaux'
    and policyname='naxa_architecture_levels_read';

  if v_canonical.cmd <> v_duplicate.cmd
     or v_canonical.roles <> v_duplicate.roles
     or v_canonical.qual <> v_duplicate.qual
     or v_canonical.with_check is distinct from v_duplicate.with_check
     or v_canonical.cmd <> 'SELECT'
     or v_canonical.roles <> '{authenticated}'
     or v_canonical.qual <> 'true'
     or v_canonical.with_check is not null then
    raise exception 'The two policies are not semantically identical';
  end if;
end;
$test$;

drop policy naxa_architecture_levels_read
  on public.naxa_architecture_niveaux;

do $test$
declare
  v_count integer;
  v_policy record;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname='public'
    and tablename='naxa_architecture_niveaux'
    and cmd='SELECT' and roles='{authenticated}';

  if v_count <> 1 then
    raise exception 'Expected exactly one authenticated SELECT policy, got %',v_count;
  end if;

  select cmd,roles,qual,with_check into v_policy
  from pg_policies
  where schemaname='public' and tablename='naxa_architecture_niveaux'
    and policyname='naxa_architecture_niveaux_read';

  if v_policy.cmd <> 'SELECT'
     or v_policy.roles <> '{authenticated}'
     or v_policy.qual <> 'true'
     or v_policy.with_check is not null then
    raise exception 'Canonical read policy changed during deduplication';
  end if;
end;
$test$;

select 'Duplicate architecture read policy removed; authenticated catalogue read preserved: PASS' as resultat;
rollback;
