-- NAXA ERP-002 — Test structurel lots/péremptions
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='stocks_lots'
  ) then raise exception 'stocks_lots absent'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='stocks_lots' and column_name='pharmacie_id'
  ) then raise exception 'stocks_lots.pharmacie_id absent'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='stocks_lots' and column_name='numero_lot'
  ) then raise exception 'stocks_lots.numero_lot absent'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='stocks_lots' and column_name='date_peremption'
  ) then raise exception 'stocks_lots.date_peremption absent'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='stocks_lots' and column_name='quantite'
  ) then raise exception 'stocks_lots.quantite absent'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='stocks_lots' and column_name='bloque'
  ) then raise exception 'stocks_lots.bloque absent'; end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='stocks_lots'
      and indexname='stocks_lots_peremption_idx'
  ) then raise exception 'index péremption absent'; end if;
end $$;
