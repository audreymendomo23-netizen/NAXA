-- NAXA 191 — vérifie l'export audité côté serveur.
do $test$
begin
  if to_regprocedure('public.pharmacien_journaliser_export(text,integer)') is null then
    raise exception 'NAXA 191: RPC de journalisation de rapport absente';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.pharmacien_audit_events'::regclass
      and conname='pharmacien_audit_events_action_check'
      and pg_get_constraintdef(oid) like '%exported%'
  ) then raise exception 'NAXA 191: action exportée absente du journal'; end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.pharmacien_audit_events'::regclass
      and conname='pharmacien_audit_events_entity_type_check'
      and pg_get_constraintdef(oid) like '%report%'
  ) then raise exception 'NAXA 191: type rapport absent du journal'; end if;
end;
$test$;
select true as naxa_191_pharmacien_audited_report_exports_pass;
