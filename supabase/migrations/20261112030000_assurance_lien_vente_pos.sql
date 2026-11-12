-- NAXA Preview: schema prerequisites for the POS/Assurance migrations.
-- The canonical POS table migrations still live in supabase/migration_*.sql,
-- outside the directory replayed by Supabase Preview. This migration restores
-- their required table shape only; it does not copy legacy RPCs or seed data.
-- RLS is enabled and direct writes stay closed; controlled server RPCs own mutations.

do $$
begin
  create type public.vente_statut as enum ('brouillon', 'payee', 'annulee');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.mode_paiement_caisse as enum ('especes', 'mobile_money', 'carte', 'autre');
exception when duplicate_object then null;
end
$$;

alter type public.mode_paiement_caisse add value if not exists 'orange_money';
alter type public.mode_paiement_caisse add value if not exists 'mtn_momo';

do $$
begin
  create type public.caisse_cloture_statut as enum ('ouverte', 'cloturee');
exception when duplicate_object then null;
end
$$;

create sequence if not exists public.vente_numero_seq
  as bigint start with 1 increment by 1 minvalue 1 no cycle;

create table if not exists public.stocks_lots (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  produit_id uuid not null references public.produits(id) on delete cascade,
  numero_lot text not null,
  date_peremption date not null,
  quantite integer not null default 0 check (quantite >= 0),
  bloque boolean not null default false,
  motif_blocage text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pharmacie_id, produit_id, numero_lot),
  check (not bloque or motif_blocage is not null)
);

create index if not exists stocks_lots_peremption_idx
  on public.stocks_lots(pharmacie_id, date_peremption);
create index if not exists stocks_lots_produit_idx
  on public.stocks_lots(produit_id);

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
  unique (caisse_id) deferrable initially immediate
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
  paid_at timestamptz,
  numero_vente text not null default (
    'V-' || to_char(current_timestamp, 'YYYYMMDD') || '-' ||
    lpad(nextval('public.vente_numero_seq')::text, 6, '0')
  ),
  reservation_id uuid references public.reservations(id) on delete restrict,
  stock_decremented_at_draft boolean not null default true
);
create unique index if not exists ventes_numero_vente_uq
  on public.ventes(numero_vente);
create unique index if not exists ventes_reservation_id_uq
  on public.ventes(reservation_id) where reservation_id is not null;
create index if not exists ventes_pharmacie_date_idx
  on public.ventes(pharmacie_id, created_at);
create index if not exists ventes_session_idx
  on public.ventes(caisse_session_id);

create table if not exists public.vente_lignes (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null references public.ventes(id) on delete cascade,
  produit_id uuid not null references public.produits(id),
  lot_id uuid references public.stocks_lots(id) on delete restrict,
  quantite integer not null check (quantite > 0),
  prix_unitaire integer not null check (prix_unitaire >= 0),
  total_ligne integer generated always as (quantite * prix_unitaire) stored
);
create index if not exists vente_lignes_produit_idx
  on public.vente_lignes(produit_id);
create index if not exists vente_lignes_lot_idx
  on public.vente_lignes(lot_id);

create table if not exists public.vente_paiements (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null references public.ventes(id) on delete cascade,
  mode public.mode_paiement_caisse not null,
  montant integer not null check (montant > 0),
  reference text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  montant_percu integer,
  monnaie_rendue integer
);
create index if not exists vente_paiements_vente_idx
  on public.vente_paiements(vente_id);
create index if not exists vente_paiements_mode_date_idx
  on public.vente_paiements(mode, created_at desc);

alter table public.stocks_lots enable row level security;
alter table public.caisses enable row level security;
alter table public.caisses_sessions enable row level security;
alter table public.ventes enable row level security;
alter table public.vente_lignes enable row level security;
alter table public.vente_paiements enable row level security;

drop policy if exists stocks_lots_lecture on public.stocks_lots;
create policy stocks_lots_lecture on public.stocks_lots
  for select to authenticated
  using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists stocks_lots_equipe_insert on public.stocks_lots;
create policy stocks_lots_equipe_insert on public.stocks_lots
  for insert to authenticated
  with check (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists stocks_lots_equipe_update on public.stocks_lots;
create policy stocks_lots_equipe_update on public.stocks_lots
  for update to authenticated
  using (public.is_admin() or public.can_access_pharmacy(pharmacie_id))
  with check (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists stocks_lots_equipe_delete on public.stocks_lots;
create policy stocks_lots_equipe_delete on public.stocks_lots
  for delete to authenticated
  using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists caisses_scope on public.caisses;
create policy caisses_scope on public.caisses
  for select to authenticated
  using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists caisses_sessions_scope on public.caisses_sessions;
create policy caisses_sessions_scope on public.caisses_sessions
  for select to authenticated
  using (
    exists (
      select 1 from public.caisses c
      where c.id=caisses_sessions.caisse_id
        and (public.is_admin() or public.can_access_pharmacy(c.pharmacie_id))
    )
  );

drop policy if exists ventes_scope on public.ventes;
create policy ventes_scope on public.ventes
  for select to authenticated
  using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists vente_lignes_scope on public.vente_lignes;
create policy vente_lignes_scope on public.vente_lignes
  for select to authenticated
  using (
    exists (
      select 1 from public.ventes v
      where v.id=vente_lignes.vente_id
        and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))
    )
  );

drop policy if exists vente_paiements_scope on public.vente_paiements;
create policy vente_paiements_scope on public.vente_paiements
  for select to authenticated
  using (
    exists (
      select 1 from public.ventes v
      where v.id=vente_paiements.vente_id
        and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))
    )
  );

revoke all on public.stocks_lots from anon, authenticated;
revoke all on public.caisses from anon, authenticated;
revoke all on public.caisses_sessions from anon, authenticated;
revoke all on public.ventes from anon, authenticated;
revoke all on public.vente_lignes from anon, authenticated;
revoke all on public.vente_paiements from anon, authenticated;
grant select on public.stocks_lots to authenticated;
grant select on public.caisses to authenticated;
grant select on public.caisses_sessions to authenticated;
grant select on public.ventes to authenticated;
grant select on public.vente_lignes to authenticated;
grant select on public.vente_paiements to authenticated;


-- Self-contained fallback for Preview runners that only resume from the failing migration.
-- Relier la vente POS au dossier Assurance de la réservation sans créer de paiement fictif.
create or replace function private.assurance_lier_vente_reservation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_dossier uuid; v_assureur uuid; v_montant bigint;
begin
  if new.reservation_id is null then return new; end if;
  update public.dossiers_assurance d
  set vente_id=new.id
  where d.reservation_id=new.reservation_id
    and d.pharmacie_id=new.pharmacie_id
    and (d.vente_id is null or d.vente_id=new.id)
  returning d.id,d.couverture_id,d.montant_total
  into v_dossier,v_assureur,v_montant;
  if v_dossier is not null and new.statut='payee' then
    insert into public.assurance_evenements(
      pharmacie_id,reservation_id,dossier_id,acteur_id,type,montant_fcfa,details
    )
    select new.pharmacie_id,new.reservation_id,v_dossier,new.created_by,
      'vente_assurance_enregistree',v_montant,
      jsonb_build_object('vente_id',new.id)
    where not exists(
      select 1 from public.assurance_evenements e
      where e.dossier_id=v_dossier and e.type='vente_assurance_enregistree'
    );
  end if;
  return new;
end
$$;
drop trigger if exists assurance_lier_vente_reservation on public.ventes;
create trigger assurance_lier_vente_reservation
after insert or update of reservation_id,statut on public.ventes
for each row execute function private.assurance_lier_vente_reservation();
