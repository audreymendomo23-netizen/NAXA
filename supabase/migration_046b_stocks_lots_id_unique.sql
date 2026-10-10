-- NAXA 046b — garantir une clé unique sur stocks_lots.id pour la FK ERP-004.
-- Le snapshot historique a une PK composite sur (pharmacie_id, produit_id, lot),
-- alors que migration_047 référence stocks_lots(id). Ne pas remplacer la PK existante.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid='public.stocks_lots'::regclass
      and c.contype in ('p','u')
      and c.conkey = array[
        (select a.attnum::smallint
         from pg_catalog.pg_attribute a
         where a.attrelid='public.stocks_lots'::regclass and a.attname='id' and not a.attisdropped)
      ]::smallint[]
  ) then
    execute 'create unique index if not exists stocks_lots_id_uidx on public.stocks_lots(id)';
  end if;
end
$$;
