-- Vérifie que stocks_lots.id peut être référencé par une clé étrangère.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_index i
    where i.indrelid='public.stocks_lots'::regclass
      and i.indisunique
      and i.indpred is null
      and i.indexprs is null
      and i.indnkeyatts=1
      and (
        select a.attname
        from pg_catalog.pg_attribute a
        where a.attrelid=i.indrelid and a.attnum=i.indkey[0]
      )='id'
  ) then
    raise exception 'stocks_lots.id ne possède aucune clé unique';
  end if;
end
$$;
