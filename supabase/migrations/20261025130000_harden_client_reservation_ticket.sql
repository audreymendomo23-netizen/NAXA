-- Preview bootstrap: the ticket RPC declares POS rowtypes, so create their tables before compiling it.
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


-- NAXA: restore the strict server-side POS receipt checks lost in the unified cron migration.
begin;
create or replace function public.get_client_reservation_ticket(p_reservation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_res public.reservations%rowtype;
  v_sale public.ventes%rowtype;
  v_items jsonb;
  v_payments jsonb;
  v_lines_total bigint;
  v_payments_total bigint;
  v_last_payment public.vente_paiements%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_reservation_id is null then raise exception 'Référence de réservation requise'; end if;

  select r.* into v_res from public.reservations r
   where r.id = p_reservation_id and r.client_id = auth.uid()
     and r.statut::text in ('payee','retiree')
     and r.paiement_statut in ('effectue','payee');
  if not found then raise exception 'Ticket indisponible pour cette réservation'; end if;

  select v.* into v_sale from public.ventes v
   where v.reservation_id = v_res.id and v.client_id = auth.uid()
     and v.pharmacie_id = v_res.pharmacie_id and v.statut::text = 'payee'
     and v.paid_at is not null
   order by v.paid_at desc, v.created_at desc limit 1;
  if not found then raise exception 'Aucune vente POS payée correspondante'; end if;

  if v_res.paiement_ticket_numero is not null and v_res.paiement_ticket_numero is distinct from v_sale.numero_vente
    then raise exception 'Le numéro du ticket ne correspond pas à la vente POS'; end if;
  if v_sale.total_net is distinct from v_res.total then raise exception 'Le total POS ne correspond pas à la réservation'; end if;

  select coalesce(sum(l.total_ligne),0) into v_lines_total from public.vente_lignes l where l.vente_id=v_sale.id;
  select coalesce(sum(p.montant),0) into v_payments_total from public.vente_paiements p where p.vente_id=v_sale.id;
  select p.* into v_last_payment from public.vente_paiements p where p.vente_id=v_sale.id order by p.created_at desc,p.id desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('produit_id',l.produit_id,'produit_nom',coalesce(pr.nom,'Article'),'produit_dosage',pr.dosage,'quantite',l.quantite,'prix_unitaire',l.prix_unitaire,'total_ligne',l.total_ligne) order by l.id),'[]'::jsonb)
    into v_items from public.vente_lignes l left join public.produits pr on pr.id=l.produit_id where l.vente_id=v_sale.id;
  select coalesce(jsonb_agg(jsonb_build_object('mode',p.mode::text,'montant',p.montant,'montant_percu',p.montant_percu,'monnaie_rendue',p.monnaie_rendue,'created_at',p.created_at) order by p.created_at,p.id),'[]'::jsonb)
    into v_payments from public.vente_paiements p where p.vente_id=v_sale.id;

  if jsonb_array_length(v_items)=0 then raise exception 'Ticket POS incomplet : aucune ligne'; end if;
  if jsonb_array_length(v_payments)=0 or v_last_payment.id is null then raise exception 'Ticket POS incomplet : aucun paiement'; end if;
  if v_lines_total is distinct from v_sale.total_brut::bigint then raise exception 'Les lignes ne correspondent pas au total brut POS'; end if;
  if v_payments_total is distinct from v_sale.total_net::bigint then raise exception 'Les paiements ne correspondent pas au total net POS'; end if;
  if v_res.paiement_montant_percu is not null and v_res.paiement_montant_percu is distinct from v_last_payment.montant_percu
    then raise exception 'Le montant encaissé du ticket est incohérent'; end if;
  if v_res.paiement_monnaie_rendue is not null and v_res.paiement_monnaie_rendue is distinct from v_last_payment.monnaie_rendue
    then raise exception 'La monnaie rendue du ticket est incohérente'; end if;

  return jsonb_build_object('receipt_type','cashier_ticket',
    'sale',jsonb_build_object('vente_id',v_sale.id,'numero_vente',v_sale.numero_vente,'pharmacie_id',v_sale.pharmacie_id,'statut',v_sale.statut::text,'created_at',v_sale.created_at,'paid_at',v_sale.paid_at,'total_brut',v_sale.total_brut,'remise',v_sale.remise,'total_net',v_sale.total_net,'mode_paiement',v_sale.mode_paiement::text,'paiement_ref',v_sale.paiement_ref,'caisse_session_id',v_sale.caisse_session_id,'caisse_id',(select cs.caisse_id from public.caisses_sessions cs where cs.id=v_sale.caisse_session_id),'caisse_nom',(select c.nom from public.caisses_sessions cs join public.caisses c on c.id=cs.caisse_id where cs.id=v_sale.caisse_session_id),
    'items',v_items,'payments',v_payments,
    'reservation',jsonb_build_object('reservation_id',v_res.id,'ticket_numero_snapshot',v_res.paiement_ticket_numero,'montant_percu_snapshot',v_res.paiement_montant_percu,'monnaie_rendue_snapshot',v_res.paiement_monnaie_rendue,'paiement_valide_at',v_res.paiement_valide_at));
end;
$function$;
revoke all on function public.get_client_reservation_ticket(uuid) from public, anon;
grant execute on function public.get_client_reservation_ticket(uuid) to authenticated;
comment on function public.get_client_reservation_ticket(uuid) is 'Ticket POS vérifié côté serveur : propriétaire, pharmacie, vente payée, lignes, paiements et snapshots cohérents.';
commit;
