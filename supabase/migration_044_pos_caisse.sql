-- NAXA ERP-003 — Socle POS / caisse
-- Additif : ventes et clôtures utilisent les produits/stocks existants.
create type public.vente_statut as enum ('brouillon','payee','annulee');
create type public.mode_paiement_caisse as enum ('especes','mobile_money','carte','autre');
create type public.caisse_cloture_statut as enum ('ouverte','cloturee');

create table if not exists public.caisses (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  nom text not null default 'Caisse principale',
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists caisses_pharmacie_nom_uq
  on public.caisses(pharmacie_id, lower(nom));

create table if not exists public.caisses_sessions (
  id uuid primary key default gen_random_uuid(),
  caisse_id uuid not null references public.caisses(id) on delete cascade,
  ouvert_par uuid not null references auth.users(id),
  ouvert_at timestamptz not null default now(),
  fond_initial integer not null default 0 check (fond_initial >= 0),
  statut public.caisse_cloture_statut not null default 'ouverte',
  cloture_at timestamptz,
  cloture_par uuid references auth.users(id),
  total_theorique integer not null default 0,
  total_compte integer,
  ecart integer,
  unique(caisse_id) deferrable initially immediate
);

create table if not exists public.ventes (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id),
  caisse_session_id uuid not null references public.caisses_sessions(id),
  client_id uuid references auth.users(id),
  statut public.vente_statut not null default 'brouillon',
  remise integer not null default 0 check (remise >= 0),
  total_brut integer not null default 0 check (total_brut >= 0),
  total_net integer not null default 0 check (total_net >= 0),
  mode_paiement public.mode_paiement_caisse,
  paiement_ref text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.vente_lignes (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null references public.ventes(id) on delete cascade,
  produit_id uuid not null references public.produits(id),
  quantite integer not null check (quantite > 0),
  prix_unitaire integer not null check (prix_unitaire >= 0),
  total_ligne integer generated always as (quantite * prix_unitaire) stored
);

create index if not exists ventes_pharmacie_date_idx on public.ventes(pharmacie_id, created_at);
create index if not exists ventes_session_idx on public.ventes(caisse_session_id);
create index if not exists vente_lignes_produit_idx on public.vente_lignes(produit_id);

alter table public.caisses enable row level security;
alter table public.caisses_sessions enable row level security;
alter table public.ventes enable row level security;
alter table public.vente_lignes enable row level security;

drop policy if exists caisses_scope on public.caisses;
create policy caisses_scope on public.caisses for all to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id))
with check (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists caisses_sessions_scope on public.caisses_sessions;
create policy caisses_sessions_scope on public.caisses_sessions for all to authenticated
using (exists(select 1 from public.caisses c where c.id=caisse_id and (public.is_admin() or public.can_access_pharmacy(c.pharmacie_id))))
with check (exists(select 1 from public.caisses c where c.id=caisse_id and (public.is_admin() or public.can_access_pharmacy(c.pharmacie_id))));

drop policy if exists ventes_scope on public.ventes;
create policy ventes_scope on public.ventes for all to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id))
with check (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists vente_lignes_scope on public.vente_lignes;
create policy vente_lignes_scope on public.vente_lignes for all to authenticated
using (exists(select 1 from public.ventes v where v.id=vente_id and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))))
with check (exists(select 1 from public.ventes v where v.id=vente_id and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))));

create or replace function public.caisse_ouvrir(p_caisse uuid,p_fond_initial integer default 0)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_id uuid; v_pharmacie uuid;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 if p_fond_initial < 0 then raise exception 'Fond initial invalide'; end if;
 select pharmacie_id into v_pharmacie from caisses where id=p_caisse and actif;
 if v_pharmacie is null or not (is_admin() or can_access_pharmacy(v_pharmacie)) then raise exception 'Caisse non autorisée'; end if;
 if exists(select 1 from caisses_sessions where caisse_id=p_caisse and statut='ouverte') then raise exception 'Une session caisse est déjà ouverte'; end if;
 insert into caisses_sessions(caisse_id,ouvert_par,fond_initial) values(p_caisse,auth.uid(),p_fond_initial) returning id into v_id;
 return v_id;
end $$;

create or replace function public.vente_creer(p_session uuid,p_client uuid default null)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_id uuid; v_pharmacie uuid;
begin
 select c.pharmacie_id into v_pharmacie from caisses_sessions cs join caisses c on c.id=cs.caisse_id where cs.id=p_session and cs.statut='ouverte';
 if v_pharmacie is null or not (is_admin() or can_access_pharmacy(v_pharmacie)) then raise exception 'Session caisse non autorisée ou fermée'; end if;
 insert into ventes(pharmacie_id,caisse_session_id,client_id,created_by) values(v_pharmacie,p_session,p_client,auth.uid()) returning id into v_id;
 return v_id;
end $$;

revoke all on function public.caisse_ouvrir(uuid,integer) from public,anon,authenticated;
revoke all on function public.vente_creer(uuid,uuid) from public,anon,authenticated;
grant execute on function public.caisse_ouvrir(uuid,integer) to authenticated;
grant execute on function public.vente_creer(uuid,uuid) to authenticated;
