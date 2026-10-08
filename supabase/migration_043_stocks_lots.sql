-- NAXA ERP-002 — Lots, péremptions, alertes et blocage
-- Additif : socle canonique des lots rattaché à stocks/pharmacies/produits existants.
-- Aucun remplacement de stocks : stocks reste le stock agrégé opérationnel.
create table if not exists public.stocks_lots (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  produit_id uuid not null references public.produits(id) on delete cascade,
  numero_lot text not null,
  date_peremption date not null,
  quantite integer not null default 0 check (quantite >= 0),
  bloque boolean not null default false,
  motif_blocage text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pharmacie_id, produit_id, numero_lot),
  check (not bloque or motif_blocage is not null)
);

alter table public.stocks_lots enable row level security;

drop policy if exists stocks_lots_lecture on public.stocks_lots;
create policy stocks_lots_lecture on public.stocks_lots
for select to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists stocks_lots_equipe_insert on public.stocks_lots;
create policy stocks_lots_equipe_insert on public.stocks_lots
for insert to authenticated
with check (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists stocks_lots_equipe_update on public.stocks_lots;
create policy stocks_lots_equipe_update on public.stocks_lots
for update to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id))
with check (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists stocks_lots_equipe_delete on public.stocks_lots;
create policy stocks_lots_equipe_delete on public.stocks_lots
for delete to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

revoke all on public.stocks_lots from anon;
grant select, insert, update, delete on public.stocks_lots to authenticated;

create index if not exists stocks_lots_peremption_idx
  on public.stocks_lots(pharmacie_id, date_peremption);
create index if not exists stocks_lots_produit_idx
  on public.stocks_lots(produit_id);

create or replace function public.stocks_lots_touch()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_stocks_lots_touch on public.stocks_lots;
create trigger trg_stocks_lots_touch
before update on public.stocks_lots
for each row execute function public.stocks_lots_touch();

comment on table public.stocks_lots is
  'Lots de stock par pharmacie et produit ; stocks reste le stock agrégé.';
comment on column public.stocks_lots.date_peremption is
  'Date de péremption du lot utilisée pour les alertes et blocages.';
comment on column public.stocks_lots.bloque is
  'Lot interdit à la vente/retrait lorsqu''il est bloqué par une règle métier.';
