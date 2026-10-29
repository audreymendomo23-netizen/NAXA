-- NAXA — retire uniquement l'index strictement dupliqué sur stocks_lots(id).
-- Les contraintes FK référencent stocks_lots_id_uq; cet index reste conservé.
do $$
declare
  v_duplicate oid;
  v_retained oid;
begin
  select i.indexrelid into v_duplicate
  from pg_index i
  join pg_class idx on idx.oid = i.indexrelid
  join pg_class tbl on tbl.oid = i.indrelid
  join pg_namespace ns on ns.oid = tbl.relnamespace
  where ns.nspname = 'public'
    and tbl.relname = 'stocks_lots'
    and idx.relname = 'stocks_lots_id_uidx'
    and i.indisunique
    and i.indpred is null
    and i.indexprs is null
    and i.indkey::text = '1';

  select i.indexrelid into v_retained
  from pg_index i
  join pg_class idx on idx.oid = i.indexrelid
  join pg_class tbl on tbl.oid = i.indrelid
  join pg_namespace ns on ns.oid = tbl.relnamespace
  where ns.nspname = 'public'
    and tbl.relname = 'stocks_lots'
    and idx.relname = 'stocks_lots_id_uq'
    and i.indisunique
    and i.indpred is null
    and i.indexprs is null
    and i.indkey::text = '1';

  if v_duplicate is null or v_retained is null then
    raise exception 'Expected duplicate/retained unique indexes on public.stocks_lots(id) not found; aborting';
  end if;

  if exists (select 1 from pg_constraint where conindid = v_duplicate) then
    raise exception 'Duplicate index is referenced by a constraint; refusing to drop';
  end if;

  if not exists (select 1 from pg_constraint where conindid = v_retained) then
    raise exception 'Retained index is not constraint-backed; refusing to drop duplicate';
  end if;

  drop index public.stocks_lots_id_uidx;
end
$$;
