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
  updated_at timestamptz not null default now(),
  constraint abonnements_promoteurs_convention_promoteur_uq unique (convention_id,promoteur_id),
  constraint abonnements_promoteurs_promoteur_convention_fk
    foreign key (convention_id,promoteur_id)
    references public.conventions_promoteurs(id,promoteur_id)
    on delete restrict
);
alter table public.conventions_promoteurs add constraint conventions_promoteurs_id_promoteur_uq unique (id,promoteur_id);
alter table public.abonnements_promoteurs enable row level security;

create table if not exists public.abonnement_promoteur_paiements (
  id uuid primary key default gen_random_uuid(),
  abonnement_id uuid not null,
  promoteur_id uuid not null,
  periode_du date not null,
  periode_au date not null,
  montant integer not null check (montant > 0),
  reference text,
  paye_le timestamptz not null default now(),
  enregistre_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint abonnement_promoteur_paiement_periode_ck check (periode_au >= periode_du),
  constraint abonnement_promoteur_paiement_abonnement_fk
    foreign key (abonnement_id,promoteur_id)
    references public.abonnements_promoteurs(id,promoteur_id)
    on delete cascade
);
alter table public.abonnements_promoteurs add constraint abonnements_promoteurs_id_promoteur_uq unique (id,promoteur_id);
alter table public.abonnement_promoteur_paiements enable row level security;

create or replace function private.validate_promoteur_pharmacie_link()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id=new.promoteur_id and p.role::text='promoteur' and p.actif
  ) then raise exception 'PROMOTEUR_RESEAU_INVALIDE'; end if;
  if not exists (
    select 1 from public.pharmacies ph
    where ph.id=new.pharmacie_id
  ) then raise exception 'PHARMACIE_INEXISTANTE'; end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_promoteur_pharmacie on public.promoteur_pharmacies;
create trigger trg_validate_promoteur_pharmacie
before insert or update of promoteur_id,pharmacie_id on public.promoteur_pharmacies
for each row execute function private.validate_promoteur_pharmacie_link();

create unique index if not exists promoteur_pharmacies_one_active_promoteur_per_pharmacie
on public.promoteur_pharmacies(pharmacie_id)
where actif;

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
      select 1 from public.promoteur_pharmacies pp
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

drop policy if exists conventions_promoteurs_select_own on public.conventions_promoteurs;
create policy conventions_promoteurs_select_own on public.conventions_promoteurs
for select to authenticated
using (promoteur_id=(select auth.uid()) or (select public.is_admin()));

drop policy if exists abonnements_promoteurs_select_own on public.abonnements_promoteurs;
create policy abonnements_promoteurs_select_own on public.abonnements_promoteurs
for select to authenticated
using (promoteur_id=(select auth.uid()) or (select public.is_admin()));

drop policy if exists abonnement_promoteur_paiements_select_own on public.abonnement_promoteur_paiements;
create policy abonnement_promoteur_paiements_select_own on public.abonnement_promoteur_paiements
for select to authenticated
using (promoteur_id=(select auth.uid()) or (select public.is_admin()));

create policy conventions_promoteurs_admin_write on public.conventions_promoteurs
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy abonnements_promoteurs_admin_write on public.abonnements_promoteurs
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy abonnement_promoteur_paiements_admin_write on public.abonnement_promoteur_paiements
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

commit;