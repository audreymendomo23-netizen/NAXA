-- NAXA ERP-009 — Trésorerie / dépenses (F66)
-- Fondation additive : aucun remplacement du CA canonique ni du moteur de caisse.
-- Les écritures sensibles passent par des RPC contrôlées.

do $$ begin
  create type public.tresorerie_compte_type as enum ('especes','mobile_money','carte','banque','autre');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tresorerie_mouvement_nature as enum ('encaissement','decaissement');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.depense_statut as enum ('brouillon','validee','annulee');
exception when duplicate_object then null; end $$;

create table if not exists public.tresorerie_comptes (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  nom text not null,
  type public.tresorerie_compte_type not null,
  devise text not null default 'XAF' check (devise='XAF'),
  solde_initial integer not null default 0 check (solde_initial>=0),
  actif boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(pharmacie_id, nom)
);

create table if not exists public.categories_depenses (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.depenses (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  categorie_id uuid references public.categories_depenses(id) on delete restrict,
  compte_id uuid references public.tresorerie_comptes(id) on delete restrict,
  montant integer not null check (montant>0),
  libelle text not null check (length(trim(libelle)) between 2 and 200),
  reference text,
  date_depense date not null default current_date,
  statut public.depense_statut not null default 'brouillon',
  fournisseur_id uuid references public.fournisseurs(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint depense_compte_pharmacie_fk
    foreign key (compte_id, pharmacie_id)
    references public.tresorerie_comptes(id, pharmacie_id)
);

create table if not exists public.tresorerie_mouvements (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  compte_id uuid not null references public.tresorerie_comptes(id) on delete restrict,
  nature public.tresorerie_mouvement_nature not null,
  montant integer not null check (montant>0),
  libelle text not null,
  reference text,
  source_type text not null check (source_type in ('depense','vente','ajustement','transfert')),
  source_id uuid,
  date_operation timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint mouvement_compte_pharmacie_fk
    foreign key (compte_id, pharmacie_id)
    references public.tresorerie_comptes(id, pharmacie_id)
);

create index if not exists tresorerie_comptes_scope_idx
  on public.tresorerie_comptes(pharmacie_id, actif);
create index if not exists depenses_scope_date_idx
  on public.depenses(pharmacie_id, date_depense desc, statut);
create index if not exists mouvements_scope_date_idx
  on public.tresorerie_mouvements(pharmacie_id, date_operation desc);
create unique index if not exists mouvements_depense_unique_idx
  on public.tresorerie_mouvements(source_id)
  where source_type='depense';

alter table public.tresorerie_comptes enable row level security;
alter table public.categories_depenses enable row level security;
alter table public.depenses enable row level security;
alter table public.tresorerie_mouvements enable row level security;

drop policy if exists tresorerie_comptes_read on public.tresorerie_comptes;
create policy tresorerie_comptes_read
on public.tresorerie_comptes for select to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists categories_depenses_read on public.categories_depenses;
create policy categories_depenses_read
on public.categories_depenses for select to authenticated
using (actif or public.is_admin());

drop policy if exists depenses_read on public.depenses;
create policy depenses_read
on public.depenses for select to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists mouvements_read on public.tresorerie_mouvements;
create policy mouvements_read
on public.tresorerie_mouvements for select to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

revoke all on public.tresorerie_comptes from anon, authenticated;
revoke all on public.categories_depenses from anon, authenticated;
revoke all on public.depenses from anon, authenticated;
revoke all on public.tresorerie_mouvements from anon, authenticated;
grant select on public.tresorerie_comptes, public.categories_depenses,
  public.depenses, public.tresorerie_mouvements to authenticated;

create or replace function public.tresorerie_creer_compte(
  p_pharmacie uuid,
  p_nom text,
  p_type public.tresorerie_compte_type,
  p_solde_initial integer default 0
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(p_pharmacie)) then
    raise exception 'Pharmacie hors périmètre';
  end if;
  if p_solde_initial < 0 then raise exception 'Solde initial invalide'; end if;
  insert into public.tresorerie_comptes(pharmacie_id,nom,type,solde_initial,created_by)
  values(p_pharmacie,trim(p_nom),p_type,p_solde_initial,auth.uid())
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.depense_creer(
  p_pharmacie uuid,
  p_montant integer,
  p_libelle text,
  p_categorie uuid default null,
  p_compte uuid default null,
  p_fournisseur uuid default null,
  p_reference text default null,
  p_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(p_pharmacie)) then
    raise exception 'Pharmacie hors périmètre';
  end if;
  if p_montant <= 0 then raise exception 'Montant invalide'; end if;
  if p_compte is not null and not exists (
    select 1 from public.tresorerie_comptes c
    where c.id=p_compte and c.pharmacie_id=p_pharmacie and c.actif
  ) then raise exception 'Compte de trésorerie invalide'; end if;
  insert into public.depenses(
    pharmacie_id,categorie_id,compte_id,montant,libelle,reference,date_depense,created_by,fournisseur_id
  ) values (
    p_pharmacie,p_categorie,p_compte,p_montant,trim(p_libelle),nullif(trim(p_reference),''),
    coalesce(p_date,current_date),auth.uid(),p_fournisseur
  ) returning id into v_id;
  return v_id;
end
$$;

create or replace function public.depense_valider(p_depense uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare d public.depenses%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into d from public.depenses where id=p_depense for update;
  if not found then raise exception 'Dépense introuvable'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(d.pharmacie_id)) then
    raise exception 'Pharmacie hors périmètre';
  end if;
  if d.statut <> 'brouillon' then raise exception 'Dépense non validable'; end if;
  if d.compte_id is null then raise exception 'Compte de trésorerie requis'; end if;
  if not exists (
    select 1 from public.tresorerie_comptes c
    where c.id=d.compte_id and c.pharmacie_id=d.pharmacie_id and c.actif
  ) then raise exception 'Compte de trésorerie invalide'; end if;

  update public.depenses
    set statut='validee', validated_by=auth.uid(), validated_at=now()
  where id=d.id;

  insert into public.tresorerie_mouvements(
    pharmacie_id,compte_id,nature,montant,libelle,reference,source_type,source_id,created_by
  )
  values(
    d.pharmacie_id,d.compte_id,'decaissement',d.montant,d.libelle,d.reference,
    'depense',d.id,auth.uid()
  );
end
$$;

revoke all on function public.tresorerie_creer_compte(uuid,text,public.tresorerie_compte_type,integer)
  from public, anon, authenticated;
revoke all on function public.depense_creer(uuid,integer,text,uuid,uuid,uuid,text,date)
  from public, anon, authenticated;
revoke all on function public.depense_valider(uuid)
  from public, anon, authenticated;
grant execute on function public.tresorerie_creer_compte(uuid,text,public.tresorerie_compte_type,integer) to authenticated;
grant execute on function public.depense_creer(uuid,integer,text,uuid,uuid,uuid,text,date) to authenticated;
grant execute on function public.depense_valider(uuid) to authenticated;

comment on table public.tresorerie_mouvements is
'Journal financier interne. Les encaissements de ventes seront raccordés au moteur de caisse canonique lors du chantier POS final; aucune duplication du CA canonique ici.';
