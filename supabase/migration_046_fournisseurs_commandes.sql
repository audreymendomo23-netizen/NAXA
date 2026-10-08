-- NAXA ERP-005 — Fournisseurs / commandes / réception
create table if not exists public.fournisseurs (
 id uuid primary key default gen_random_uuid(), nom text not null, contact text, telephone text, email text,
 actif boolean not null default true, created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists fournisseurs_nom_uq on public.fournisseurs(lower(trim(nom)));
create table if not exists public.commandes_fournisseurs (
 id uuid primary key default gen_random_uuid(), pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
 fournisseur_id uuid not null references public.fournisseurs(id) on delete restrict, reference text,
 statut text not null default 'brouillon' check(statut in ('brouillon','envoyee','partielle','recue','annulee')),
 date_commande timestamptz not null default now(), date_reception timestamptz,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists commandes_fournisseurs_ref_uq on public.commandes_fournisseurs(pharmacie_id,lower(trim(reference))) where reference is not null;
create table if not exists public.commandes_fournisseurs_lignes (
 id uuid primary key default gen_random_uuid(), commande_id uuid not null references public.commandes_fournisseurs(id) on delete cascade,
 produit_id uuid not null references public.produits(id) on delete restrict, quantite_commandee integer not null check(quantite_commandee>0),
 prix_unitaire_prevu integer check(prix_unitaire_prevu is null or prix_unitaire_prevu>=0),
 quantite_recue integer not null default 0 check(quantite_recue>=0 and quantite_recue<=quantite_commandee)
);
create index if not exists commandes_fournisseurs_lignes_commande_idx on public.commandes_fournisseurs_lignes(commande_id);
create table if not exists public.receptions_fournisseurs (
 id uuid primary key default gen_random_uuid(), commande_id uuid not null references public.commandes_fournisseurs(id) on delete restrict,
 pharmacie_id uuid not null references public.pharmacies(id) on delete restrict, reference_reception text,
 recu_par uuid not null references auth.users(id), recu_at timestamptz not null default now(), commentaire text
);
create table if not exists public.receptions_fournisseurs_lignes (
 id uuid primary key default gen_random_uuid(), reception_id uuid not null references public.receptions_fournisseurs(id) on delete cascade,
 commande_ligne_id uuid not null references public.commandes_fournisseurs_lignes(id) on delete restrict,
 quantite_recue integer not null check(quantite_recue>0)
);
create index if not exists commandes_fournisseurs_scope_idx on public.commandes_fournisseurs(pharmacie_id,statut,date_commande desc);
create index if not exists receptions_fournisseurs_commande_idx on public.receptions_fournisseurs(commande_id,recu_at desc);
alter table public.fournisseurs enable row level security;
alter table public.commandes_fournisseurs enable row level security;
alter table public.commandes_fournisseurs_lignes enable row level security;
alter table public.receptions_fournisseurs enable row level security;
alter table public.receptions_fournisseurs_lignes enable row level security;
drop policy if exists fournisseurs_scope on public.fournisseurs;
create policy fournisseurs_scope on public.fournisseurs for all to authenticated
using(public.is_admin() or created_by=(select auth.uid()) or exists(select 1 from public.commandes_fournisseurs c where c.fournisseur_id=fournisseurs.id and public.can_access_pharmacy(c.pharmacie_id)))
with check((select auth.uid()) is not null);
drop policy if exists commandes_fournisseurs_scope on public.commandes_fournisseurs;
create policy commandes_fournisseurs_scope on public.commandes_fournisseurs for all to authenticated using(public.is_admin() or public.can_access_pharmacy(pharmacie_id)) with check(public.is_admin() or public.can_access_pharmacy(pharmacie_id));
drop policy if exists commandes_fournisseurs_lignes_scope on public.commandes_fournisseurs_lignes;
create policy commandes_fournisseurs_lignes_scope on public.commandes_fournisseurs_lignes for all to authenticated using(exists(select 1 from public.commandes_fournisseurs c where c.id=commande_id and (public.is_admin() or public.can_access_pharmacy(c.pharmacie_id)))) with check(exists(select 1 from public.commandes_fournisseurs c where c.id=commande_id and (public.is_admin() or public.can_access_pharmacy(c.pharmacie_id))));
drop policy if exists receptions_fournisseurs_scope on public.receptions_fournisseurs;
create policy receptions_fournisseurs_scope on public.receptions_fournisseurs for all to authenticated using(public.is_admin() or public.can_access_pharmacy(pharmacie_id)) with check(public.is_admin() or public.can_access_pharmacy(pharmacie_id));
drop policy if exists receptions_fournisseurs_lignes_scope on public.receptions_fournisseurs_lignes;
create policy receptions_fournisseurs_lignes_scope on public.receptions_fournisseurs_lignes for all to authenticated using(exists(select 1 from public.receptions_fournisseurs r join public.commandes_fournisseurs c on c.id=r.commande_id where r.id=receptions_fournisseurs_lignes.reception_id and (public.is_admin() or public.can_access_pharmacy(c.pharmacie_id)))) with check(exists(select 1 from public.receptions_fournisseurs r join public.commandes_fournisseurs c on c.id=r.commande_id where r.id=receptions_fournisseurs_lignes.reception_id and (public.is_admin() or public.can_access_pharmacy(c.pharmacie_id))));
