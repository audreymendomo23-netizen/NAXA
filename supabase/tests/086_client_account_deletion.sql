-- NAXA 086 — contrôle structurel de la suppression de compte client
do $$
declare v_nullable text; v_delete_action "char";
begin
  select is_nullable into v_nullable from information_schema.columns where table_schema='public' and table_name='reservations' and column_name='client_id';
  if v_nullable is distinct from 'YES' then raise exception 'FAIL: reservations.client_id doit accepter NULL après suppression'; end if;
  select c.confdeltype into v_delete_action from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname='reservations' and c.conname='reservations_client_id_fkey' and c.contype='f';
  if v_delete_action is distinct from 'n' then raise exception 'FAIL: la suppression doit dissocier le client (ON DELETE SET NULL)'; end if;
  raise notice 'PASS: suppression client dissocie le compte et conserve les réservations';
end $$;
