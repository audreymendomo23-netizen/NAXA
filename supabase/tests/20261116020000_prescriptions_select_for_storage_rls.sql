-- Contrat de privilèges de la table consultée par les politiques Storage.
do $test$
declare
  v_rls boolean;
begin
  select relrowsecurity into v_rls
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='prescriptions';

  if v_rls is not true then
    raise exception 'RLS doit rester activé sur public.prescriptions';
  end if;

  if not has_table_privilege('authenticated','public.prescriptions','SELECT') then
    raise exception 'authenticated doit pouvoir évaluer les politiques Storage liées aux prescriptions';
  end if;

  if has_table_privilege('anon','public.prescriptions','SELECT') then
    raise exception 'anon ne doit pas recevoir SELECT sur public.prescriptions';
  end if;
end
$test$;
