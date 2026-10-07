begin;

create table if not exists public.conventions_promoteurs (
  id uuid primary key default gen_random_uuid(),
  promoteur_id uuid not null unique references public.profiles(id) on delete restrict,
  tarif_mensuel integer not null check (tarif_mensuel >= 0),
  montant_paye integer not null default 0 check (montant_paye >= 0),
  date_paiement timestamptz,
  date_expiration date,
  statut text not null default 'actif' check (statut in ('actif','impaye','resilie')),
  rappel_5j_envoye_at timestamptz,
  rappel_5j_en_cours_at timestamptz,
  bloque_le timestamptz,
  reactive_le timestamptz,
  reactive_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.conventions_promoteurs enable row level security;

create table if not exists public.abonnements_promoteurs (
  id uuid primary key default gen_random_uuid(),
  convention_id uuid not null unique references public.conventions_promoteurs(id) on delete restrict,
  promoteur_id uuid not null unique references public.profiles(id) on delete restrict,
  debut date not null default current_date,
  echeance date,
  statut text not null default 'actif' check (statut in ('actif','impaye','resilie')),
  dernier_paiement_le timestamptz,
  dernier_paiement_ref text,
  bloque_le timestamptz,
  reactive_le timestamptz,
  reactive_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.abonnements_promoteurs enable row level security;

create table if not exists public.abonnement_promoteur_paiements (
  id uuid primary key default gen_random_uuid(),
  abonnement_id uuid not null references public.abonnements_promoteurs(id) on delete cascade,
  promoteur_id uuid not null references public.profiles(id) on delete restrict,
  periode_du date not null,
  periode_au date not null,
  montant integer not null check (montant > 0),
  reference text,
  paye_le timestamptz not null default now(),
  enregistre_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint abonnement_promoteur_paiement_periode_ck check (periode_au >= periode_du)
);
alter table public.abonnement_promoteur_paiements enable row level security;

create or replace function private.naxa_promoteur_abonnement_actif(p_promoteur uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.conventions_promoteurs c on c.promoteur_id=p.id
    join public.abonnements_promoteurs a on a.promoteur_id=p.id and a.convention_id=c.id
    where p.id=p_promoteur
      and p.role::text='promoteur'
      and p.actif
      and c.statut='actif'
      and a.statut='actif'
      and (a.echeance is null or a.echeance >= current_date)
      and (c.date_expiration is null or c.date_expiration >= current_date)
  );
$$;

create or replace function private.naxa_promoteur_valide_canonique(p_promoteur uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select private.naxa_promoteur_abonnement_actif(p_promoteur)
  and exists (
    select 1 from public.promoteur_pharmacies pp
    join public.pharmacies ph on ph.id=pp.pharmacie_id
    where pp.promoteur_id=p_promoteur and pp.actif and ph.actif
  );
$$;

create or replace function public.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean
language sql stable
set search_path to ''
as $$
  select private.naxa_promoteur_valide_canonique($1);
$$;

create or replace function public.synchroniser_validite_promoteurs()
returns integer
language plpgsql security definer
set search_path to 'public'
as $$
declare n integer := 0;
begin
  update public.conventions_promoteurs c
  set statut='impaye', bloque_le=coalesce(c.bloque_le,now()), updated_at=now()
  where c.date_expiration is not null and c.date_expiration < current_date and c.statut='actif';

  update public.abonnements_promoteurs a
  set statut='impaye', bloque_le=coalesce(a.bloque_le,now()), updated_at=now()
  where a.echeance is not null and a.echeance < current_date and a.statut='actif';

  update public.pharmacies ph
  set actif=false
  where ph.actif
    and exists (
      select 1
      from public.promoteur_pharmacies pp
      where pp.pharmacie_id=ph.id and pp.actif
        and not private.naxa_promoteur_abonnement_actif(pp.promoteur_id)
    );
  get diagnostics n=row_count;

  update public.profiles p
  set actif=false
  where p.actif
    and p.role::text in ('caisse','pharmacie')
    and exists (
      select 1 from public.promoteur_pharmacies pp
      where pp.pharmacie_id=p.pharmacie_id and pp.actif
        and not private.naxa_promoteur_abonnement_actif(pp.promoteur_id)
    );
  return n;
end;
$$;

-- Compatibility facade: legacy per-pharmacy validity must no longer define promoter validity.
create or replace function private.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select private.naxa_promoteur_valide_canonique($1);
$$;

commit;