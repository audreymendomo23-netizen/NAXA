-- NAXA 190 — vérifie le journal append-only et ses déclencheurs métier.
do $test$
begin
  if to_regclass('public.pharmacien_audit_events') is null then
    raise exception 'NAXA 190: table du journal d’audit absente';
  end if;
  if to_regprocedure('public.capture_pharmacien_audit_event()') is null
     or to_regprocedure('public.prevent_pharmacien_audit_event_mutation()') is null then
    raise exception 'NAXA 190: fonction de capture ou de verrouillage absente';
  end if;
  if not exists(select 1 from pg_trigger where tgname='capture_pharmacien_consultation_audit' and not tgisinternal)
     or not exists(select 1 from pg_trigger where tgname='capture_pharmacien_prescription_audit' and not tgisinternal)
     or not exists(select 1 from pg_trigger where tgname='capture_pharmacien_preparation_audit' and not tgisinternal) then
    raise exception 'NAXA 190: un déclencheur métier du journal est absent';
  end if;
  if not exists(select 1 from pg_trigger where tgname='pharmacien_audit_events_no_update' and not tgisinternal) then
    raise exception 'NAXA 190: verrouillage append-only absent';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='pharmacien_audit_events' and policyname='pharmacien_audit_events_read_scope') then
    raise exception 'NAXA 190: contrôle RLS du journal absent';
  end if;
end;
$test$;
select true as naxa_190_pharmacien_audit_trail_pass;
