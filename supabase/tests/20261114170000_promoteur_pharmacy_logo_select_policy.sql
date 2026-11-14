-- Verify the scoped SELECT policy required for Promoteur pharmacy-logo upserts.
do $test$
declare
  v_cmd text;
  v_roles text[];
  v_qual text;
begin
  select cmd, roles, qual
    into v_cmd, v_roles, v_qual
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname = 'promoteur_pharmacy_logo_select';

  if not found then
    raise exception 'Logo SELECT policy is missing';
  end if;
  if v_cmd <> 'SELECT' or not ('authenticated' = any(v_roles)) then
    raise exception 'Logo SELECT policy must target authenticated SELECT';
  end if;
  if position('pharmacies-photos' in v_qual) = 0
     or position('logos' in v_qual) = 0
     or position('promoteur_pharmacies' in v_qual) = 0
     or position('pharmacies' in v_qual) = 0
     or position('auth.uid()' in v_qual) = 0
     or position('promoteur' in v_qual) = 0 then
    raise exception 'Logo SELECT policy is not restricted to the active Promoteur pharmacy scope';
  end if;
end
$test$;

select 'Promoteur pharmacy logo SELECT policy: PASS' as result;
