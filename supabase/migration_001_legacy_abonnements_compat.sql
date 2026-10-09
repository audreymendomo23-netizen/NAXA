-- NAXA — couche historique de compatibilité des abonnements pharmacie
-- Restaurée car les migrations 009/010/019/039 la référencent explicitement.
-- Le modèle commercial canonique reste l'abonnement au niveau Promoteur (migration_019).

create table if not exists public.abonnements (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  formule text not null default 'essentiel',
  montant_mensuel integer not null default 30000 check (montant_mensuel > 0),
  debut date not null default current_date,
  fin date,
  echeance date,
  statut text not null default 'actif' check (statut in ('actif','impaye','resilie')),
  rappel_5j_envoye_at timestamptz,
  rappel_5j_en_cours_at timestamptz,
  dernier_paiement_le timestamptz,
  dernier_paiement_ref text,
  bloque_le timestamptz,
  reactive_le timestamptz,
  reactive_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists abonnements_pharmacie_unique_base
  on public.abonnements(pharmacie_id);