-- NAXA stock manager foundation — reconcile the live legacy stock schema before migrations 175+.
begin;

-- New internal pharmacy functions used by the stock manager and pharmacist workflows.
alter table public.profiles drop constraint if exists profiles_fonction_interne_check;
alter table public.profiles add constraint profiles_fonction_interne_check check (
 fonction_interne is null or fonction_interne = any(array[
  'promoteur','responsable','caisse','manager_regional','chef_agence','custom',
  'pharmacien','pharmacien_assistant','gestionnaire_stock','magasinier'
 ]::text[])
);

-- Preserve the legacy columns and backfill canonical lot fields without inventing lot data.
alter table public.stocks add column if not exists emplacement text;
alter table public.stocks_lots
 add column if not exists id uuid default gen_random_uuid(),
 add column if not exists numero_lot text,
 add column if not exists date_peremption date,
 add column if not exists bloque boolean not null default false,
 add column if not exists motif_blocage text,
 add column if not exists emplacement text;
update public.stocks_lots
 set id=coalesce(id,gen_random_uuid()),
     numero_lot=coalesce(numero_lot,nullif(btrim(lot),'')),
     date_peremption=coalesce(date_peremption,peremption),
     bloque=coalesce(bloque,false);
alter table public.stocks_lots alter column id set default gen_random_uuid();
alter table public.stocks_lots alter column id set not null;
create unique index if not exists stocks_lots_id_uq on public.stocks_lots(id);
create unique index if not exists stocks_lots_pharmacie_produit_numero_uq
 on public.stocks_lots(pharmacie_id,produit_id,numero_lot) where numero_lot is not null;
alter table public.stocks_lots drop constraint if exists stocks_lots_blocage_motif_check;
alter table public.stocks_lots add constraint stocks_lots_blocage_motif_check
 check(not bloque or nullif(btrim(motif_blocage),'') is not null);

-- Supplier directory and purchase orders.
create table if not exists public.fournisseurs (
 id uuid primary key default gen_random_uuid(),
 nom text not null check(char_length(btrim(nom)) between 2 and 160),
 contact text,
 telephone text,
 email text,
 actif boolean not null default true,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create unique index if not exists fournisseurs_nom_lower_uq on public.fournisseurs(lower(nom));
create table if not exists public.commandes_fournisseurs (
 id uuid primary key default gen_random_uuid(),
 pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
 fournisseur_id uuid not null references public.fournisseurs(id) on delete restrict,
 reference text,
 statut text not null default 'brouillon' check(statut in ('brouillon','envoyee','partielle','recue','annulee')),
 date_commande timestamptz not null default now(),
 date_reception timestamptz,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists commandes_fournisseurs_pharmacie_date_idx on public.commandes_fournisseurs(pharmacie_id,date_commande desc);
create table if not exists public.commandes_fournisseurs_lignes (
 id uuid primary key default gen_random_uuid(),
 commande_id uuid not null references public.commandes_fournisseurs(id) on delete restrict,
 produit_id uuid not null references public.produits(id) on delete restrict,
 quantite_commandee integer not null check(quantite_commandee>0),
 quantite_recue integer not null default 0 check(quantite_recue>=0 and quantite_recue<=quantite_commandee),
 prix_unitaire_prevu integer check(prix_unitaire_prevu is null or prix_unitaire_prevu>=0),
 created_at timestamptz not null default now()
);
create index if not exists commandes_fournisseurs_lignes_order_idx on public.commandes_fournisseurs_lignes(commande_id);
create table if not exists public.receptions_fournisseurs (
 id uuid primary key default gen_random_uuid(),
 commande_id uuid not null references public.commandes_fournisseurs(id) on delete restrict,
 pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
 reference_reception text,
 recu_par uuid not null references auth.users(id) on delete restrict,
 commentaire text,
 recu_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create index if not exists receptions_fournisseurs_pharmacie_date_idx on public.receptions_fournisseurs(pharmacie_id,recu_at desc);
create table if not exists public.receptions_fournisseurs_lignes (
 id uuid primary key default gen_random_uuid(),
 reception_id uuid not null references public.receptions_fournisseurs(id) on delete restrict,
 commande_ligne_id uuid not null references public.commandes_fournisseurs_lignes(id) on delete restrict,
 quantite_recue integer not null check(quantite_recue>0),
 created_at timestamptz not null default now()
);
create index if not exists receptions_fournisseurs_lignes_receipt_idx on public.receptions_fournisseurs_lignes(reception_id);

-- Inventory lifecycle and generated variance.
do $types$
begin
 if not exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='inventaire_type') then
  create type public.inventaire_type as enum ('complet','cible');
 end if;
 if not exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='inventaire_statut') then
  create type public.inventaire_statut as enum ('brouillon','en_cours','cloture','annule');
 end if;
end;
$types$;
create table if not exists public.inventaires (
 id uuid primary key default gen_random_uuid(),
 pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
 type public.inventaire_type not null,
 statut public.inventaire_statut not null default 'brouillon',
 reference text,
 started_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id) on delete restrict,
 closed_at timestamptz,
 closed_by uuid references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists inventaires_pharmacie_date_idx on public.inventaires(pharmacie_id,created_at desc);
create table if not exists public.inventaire_lignes (
 id uuid primary key default gen_random_uuid(),
 inventaire_id uuid not null references public.inventaires(id) on delete restrict,
 produit_id uuid not null references public.produits(id) on delete restrict,
 lot_id uuid references public.stocks_lots(id) on delete restrict,
 quantite_theorique integer not null check(quantite_theorique>=0),
 quantite_comptee integer check(quantite_comptee is null or quantite_comptee>=0),
 ecart integer generated always as (quantite_comptee-quantite_theorique) stored,
 created_at timestamptz not null default now()
);
create unique index if not exists inventaire_lignes_aggregate_uq on public.inventaire_lignes(inventaire_id,produit_id) where lot_id is null;
create unique index if not exists inventaire_lignes_lot_uq on public.inventaire_lignes(inventaire_id,produit_id,lot_id) where lot_id is not null;
create index if not exists inventaire_lignes_inventaire_idx on public.inventaire_lignes(inventaire_id);

-- All new tables start with RLS; later hardening migrations replace these base policies.
alter table public.fournisseurs enable row level security;
alter table public.commandes_fournisseurs enable row level security;
alter table public.commandes_fournisseurs_lignes enable row level security;
alter table public.receptions_fournisseurs enable row level security;
alter table public.receptions_fournisseurs_lignes enable row level security;
alter table public.inventaires enable row level security;
alter table public.inventaire_lignes enable row level security;

drop policy if exists fournisseurs_scope on public.fournisseurs;
create policy fournisseurs_scope on public.fournisseurs for all to authenticated
 using(public.is_admin() or created_by=(select auth.uid()))
 with check(public.is_admin() or created_by=(select auth.uid()));
drop policy if exists commandes_fournisseurs_scope on public.commandes_fournisseurs;
create policy commandes_fournisseurs_scope on public.commandes_fournisseurs for all to authenticated
 using(public.is_admin() or public.naxa_scope_allows((select auth.uid()),pharmacie_id,'PHARMACIE'))
 with check(public.is_admin() or public.naxa_scope_allows((select auth.uid()),pharmacie_id,'PHARMACIE'));
drop policy if exists commandes_fournisseurs_lignes_scope on public.commandes_fournisseurs_lignes;
create policy commandes_fournisseurs_lignes_scope on public.commandes_fournisseurs_lignes for all to authenticated
 using(exists(select 1 from public.commandes_fournisseurs c where c.id=commande_id and (public.is_admin() or public.naxa_scope_allows((select auth.uid()),c.pharmacie_id,'PHARMACIE'))))
 with check(exists(select 1 from public.commandes_fournisseurs c where c.id=commande_id and (public.is_admin() or public.naxa_scope_allows((select auth.uid()),c.pharmacie_id,'PHARMACIE'))));
drop policy if exists receptions_fournisseurs_scope on public.receptions_fournisseurs;
create policy receptions_fournisseurs_scope on public.receptions_fournisseurs for all to authenticated
 using(public.is_admin() or public.naxa_scope_allows((select auth.uid()),pharmacie_id,'PHARMACIE'))
 with check(public.is_admin() or public.naxa_scope_allows((select auth.uid()),pharmacie_id,'PHARMACIE'));
drop policy if exists receptions_fournisseurs_lignes_scope on public.receptions_fournisseurs_lignes;
create policy receptions_fournisseurs_lignes_scope on public.receptions_fournisseurs_lignes for all to authenticated
 using(exists(select 1 from public.receptions_fournisseurs r where r.id=reception_id and (public.is_admin() or public.naxa_scope_allows((select auth.uid()),r.pharmacie_id,'PHARMACIE'))))
 with check(exists(select 1 from public.receptions_fournisseurs r where r.id=reception_id and (public.is_admin() or public.naxa_scope_allows((select auth.uid()),r.pharmacie_id,'PHARMACIE'))));
drop policy if exists inventaires_scope on public.inventaires;
create policy inventaires_scope on public.inventaires for all to authenticated
 using(public.is_admin() or public.naxa_scope_allows((select auth.uid()),pharmacie_id,'PHARMACIE'))
 with check(public.is_admin() or public.naxa_scope_allows((select auth.uid()),pharmacie_id,'PHARMACIE'));
drop policy if exists inventaire_lignes_scope on public.inventaire_lignes;
create policy inventaire_lignes_scope on public.inventaire_lignes for all to authenticated
 using(exists(select 1 from public.inventaires i where i.id=inventaire_id and (public.is_admin() or public.naxa_scope_allows((select auth.uid()),i.pharmacie_id,'PHARMACIE'))))
 with check(exists(select 1 from public.inventaires i where i.id=inventaire_id and (public.is_admin() or public.naxa_scope_allows((select auth.uid()),i.pharmacie_id,'PHARMACIE'))));

revoke all on public.fournisseurs,public.commandes_fournisseurs,public.commandes_fournisseurs_lignes,
 public.receptions_fournisseurs,public.receptions_fournisseurs_lignes,public.inventaires,public.inventaire_lignes
 from public,anon;
grant select,insert,update,delete on public.fournisseurs,public.commandes_fournisseurs,public.commandes_fournisseurs_lignes,
 public.receptions_fournisseurs,public.receptions_fournisseurs_lignes,public.inventaires,public.inventaire_lignes
 to authenticated;
commit;
