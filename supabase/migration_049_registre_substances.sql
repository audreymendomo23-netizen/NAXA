-- NAXA ERP-007 — Registre interne des substances signalées comme contrôlées
create table if not exists public.registre_substances_controlees (
 id uuid primary key default gen_random_uuid(),
 ordonnancier_id uuid not null references public.ordonnancier(id) on delete restrict,
 pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
 designation text not null,quantite integer not null check(quantite>0),
 reference_registre text,observation text,
 enregistre_par uuid not null references auth.users(id) on delete restrict,
 enregistre_at timestamptz not null default now()
);
create index if not exists registre_substances_pharmacie_date_idx on public.registre_substances_controlees(pharmacie_id,enregistre_at desc);
create unique index if not exists registre_substances_ordonnancier_unique on public.registre_substances_controlees(ordonnancier_id);