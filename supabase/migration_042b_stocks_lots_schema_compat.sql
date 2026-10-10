-- NAXA 042b — compatibilité additive du socle historique stocks_lots.
-- Le schema.sql contient encore (lot, peremption) sans id ; la migration 043
-- attend (id, numero_lot, date_peremption, bloque, motif_blocage, created_at).
alter table public.stocks_lots add column if not exists id uuid;
update public.stocks_lots set id=gen_random_uuid() where id is null;
alter table public.stocks_lots alter column id set default gen_random_uuid();
alter table public.stocks_lots alter column id set not null;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid='public.stocks_lots'::regclass and contype='p'
  ) then
    alter table public.stocks_lots add constraint stocks_lots_pkey primary key (id);
  end if;
end
$$;

alter table public.stocks_lots add column if not exists numero_lot text;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='stocks_lots' and column_name='lot'
  ) then
    execute 'update public.stocks_lots set numero_lot=lot where numero_lot is null and lot is not null';
  end if;
end
$$;
update public.stocks_lots set numero_lot='LEGACY-'||id::text where numero_lot is null;
alter table public.stocks_lots alter column numero_lot set not null;

alter table public.stocks_lots add column if not exists date_peremption date;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='stocks_lots' and column_name='peremption'
  ) then
    execute 'update public.stocks_lots set date_peremption=peremption where date_peremption is null and peremption is not null';
  end if;
end
$$;
-- Ne pas inventer de date pour un lot historique sans péremption.
alter table public.stocks_lots alter column date_peremption set not null;

alter table public.stocks_lots add column if not exists bloque boolean not null default false;
alter table public.stocks_lots add column if not exists motif_blocage text;
alter table public.stocks_lots add column if not exists created_at timestamptz not null default now();

create unique index if not exists stocks_lots_pharmacie_id_produit_id_numero_lot_key
  on public.stocks_lots(pharmacie_id,produit_id,numero_lot);

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid='public.stocks_lots'::regclass and conname='stocks_lots_bloque_motif_ck'
  ) then
    alter table public.stocks_lots add constraint stocks_lots_bloque_motif_ck
      check (not bloque or motif_blocage is not null);
  end if;
end
$$;
