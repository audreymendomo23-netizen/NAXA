do $test$
declare
  v_qual text;
begin
  select qual into v_qual
  from pg_policies
  where schemaname='public'
    and tablename='assurance_evenements'
    and policyname='assurance_evenements_scope_read';

  if v_qual is null
     or position('accord_client_refuse' in v_qual)=0
     or position('r.client_id' in v_qual)=0
     or position('can_access_pharmacy' in v_qual)=0 then
    raise exception 'Le refus Client doit rester visible à son propriétaire et au personnel du périmètre pharmacie';
  end if;
end
$test$;

select 'Assurance client refusal event is readable by the reservation owner and pharmacy scope: PASS' as result;
