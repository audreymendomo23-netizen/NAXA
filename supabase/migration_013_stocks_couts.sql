-- NAXA — Passe 4 : coûts d'achat séparés du stock opérationnel
-- Additif, non destructif. Aucun coût existant n'est déplacé ou supprimé.
-- Règle : stocks = quantité/prix public ; stocks_couts = coût d'achat interne.
-- La marge historique transactionnelle n'est PAS déduite de cette table seule.
-- Elle restera interdite tant qu'un coût au moment de la vente n'est pas figé
-- au grain de la transaction.

create table if not exists public.stocks_couts (
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  produit_id uuid not null references public.produits(id) on delete cascade,
  cout_unitaire integer not null check (cout_unitaire >= 0),
  devise text not null default 'XAF' check (devise = 'XAF'),
  updated_at timestamptz not null default now(),
  primary key (pharmacie_id, produit_id)
);

alter table public.stocks_couts enable row level security;

drop policy if exists stocks_couts_lecture on public.stocks_couts;
create policy stocks_couts_lecture
on public.stocks_couts
for select
using (
  public.is_admin()
  or pharmacie_id = public.my_pharmacie()
);

drop policy if exists stocks_couts_equipe_maj on public.stocks_couts;
create policy stocks_couts_equipe_maj
on public.stocks_couts
for insert
with check (
  public.is_admin()
  or pharmacie_id = public.my_pharmacie()
);

drop policy if exists stocks_couts_equipe_update on public.stocks_couts;
create policy stocks_couts_equipe_update
on public.stocks_couts
for update
using (
  public.is_admin()
  or pharmacie_id = public.my_pharmacie()
)
with check (
  public.is_admin()
  or pharmacie_id = public.my_pharmacie()
);

revoke all on public.stocks_couts from anon, authenticated;
grant select, insert, update on public.stocks_couts to authenticated;

create index if not exists stocks_couts_produit_idx
  on public.stocks_couts(produit_id);

comment on table public.stocks_couts is
  'Coût d''achat interne courant par pharmacie et produit. Séparé de stocks : le prix de vente/public reste dans stocks.prix.';

comment on column public.stocks_couts.cout_unitaire is
  'Coût d''achat unitaire courant en XAF. Ne constitue pas à lui seul un coût historique de vente.';

comment on column public.stocks_couts.updated_at is
  'Dernière modification du coût d''achat courant.';
