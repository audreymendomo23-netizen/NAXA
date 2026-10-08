-- NAXA ERP-007 — Ordonnancier
create type public.ordonnancier_statut as enum ('enregistre','annule');
create table if not exists public.ordonnancier (
 id uuid primary key default gen_random_uuid(),
 pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
 prescription_id uuid not null references public.prescriptions(id) on delete restrict,
 vente_id uuid not null references public.ventes(id) on delete restrict,
 prescription_item_id uuid references public.prescription_items(id) on delete set null,
 dispensateur_id uuid not null references auth.users(id) on delete restrict,
 designation text not null,
 quantite_dispensee integer not null check(quantite_dispensee>0),
 statut public.ordonnancier_statut not null default 'enregistre',
 reference_interne text,note_interne text,
 dispensed_at timestamptz not null default now(),created_at timestamptz not null default now()
);
create index if not exists ordonnancier_pharmacie_date_idx on public.ordonnancier(pharmacie_id,dispensed_at desc);
create index if not exists ordonnancier_prescription_idx on public.ordonnancier(prescription_id);
create unique index if not exists ordonnancier_vente_item_unique on public.ordonnancier(vente_id,prescription_item_id) where prescription_item_id is not null;