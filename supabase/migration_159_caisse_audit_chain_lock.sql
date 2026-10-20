-- NAXA 159 — audit POS chaîné et verrouillage après clôture.
-- Migration additive : réutilise caisses_sessions, ventes, vente_lignes et vente_paiements.
begin;

create table if not exists public.caisse_audit_chain_heads (
  pharmacie_id uuid primary key,
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  last_hash text not null default repeat('0', 64),
  updated_at timestamptz not null default clock_timestamp(),
  constraint caisse_audit_chain_heads_hash_format_ck
    check (length(last_hash) = 64 and last_hash ~ '^[0-9a-f]{64}$')
);

create table if not exists public.caisse_audit_events (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null,
  sequence_no bigint not null check (sequence_no > 0),
  event_at timestamptz not null,
  actor_id uuid,
  entity_type text not null check (entity_type in ('caisses_sessions','ventes','vente_lignes','vente_paiements')),
  entity_id uuid not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb,
  previous_hash text not null check (length(previous_hash) = 64),
  event_hash text not null unique check (length(event_hash) = 64),
  hash_payload jsonb not null,
  transaction_id bigint not null default txid_current(),
  unique (pharmacie_id, sequence_no)
);

create index if not exists caisse_audit_events_scope_idx
  on public.caisse_audit_events(pharmacie_id, sequence_no desc);
create index if not exists caisse_audit_events_entity_idx
  on public.caisse_audit_events(pharmacie_id, entity_type, entity_id, sequence_no desc);
create index if not exists caisse_audit_events_actor_idx
  on public.caisse_audit_events(actor_id, event_at desc);

alter table public.caisse_audit_chain_heads enable row level security;
alter table public.caisse_audit_events enable row level security;
revoke all on public.caisse_audit_chain_heads from public, anon, authenticated;
revoke all on public.caisse_audit_events from public, anon, authenticated;
grant select on public.caisse_audit_events to authenticated;

drop policy if exists caisse_audit_events_read_scope on public.caisse_audit_events;
create policy caisse_audit_events_read_scope
  on public.caisse_audit_events
  for select to authenticated
  using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

create or replace function public.naxa_caisse_audit_append()
returns trigger
language plpgsql
security definer
set search_path = ''
as $audit$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_pharmacie uuid;
  v_entity_id uuid;
  v_event_id uuid := gen_random_uuid();
  v_event_at timestamptz := clock_timestamp();
  v_actor uuid := auth.uid();
  v_sequence bigint;
  v_previous_hash text;
  v_payload jsonb;
  v_hash text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_new := null;
    v_row := v_old;
  else
    v_old := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
    v_new := to_jsonb(new);
    v_row := v_new;
  end if;

  v_entity_id := nullif(v_row ->> 'id', '')::uuid;

  if tg_table_name = 'caisses_sessions' then
    select c.pharmacie_id into v_pharmacie
    from public.caisses c
    where c.id = nullif(v_row ->> 'caisse_id', '')::uuid;
  elsif tg_table_name = 'ventes' then
    v_pharmacie := nullif(v_row ->> 'pharmacie_id', '')::uuid;
  else
    select v.pharmacie_id into v_pharmacie
    from public.ventes v
    where v.id = nullif(v_row ->> 'vente_id', '')::uuid;
  end if;

  if v_pharmacie is null or v_entity_id is null then
    raise exception 'Audit caisse impossible : périmètre ou identifiant absent';
  end if;

  insert into public.caisse_audit_chain_heads(pharmacie_id)
  values (v_pharmacie)
  on conflict (pharmacie_id) do nothing;

  select h.last_sequence, h.last_hash
    into v_sequence, v_previous_hash
  from public.caisse_audit_chain_heads h
  where h.pharmacie_id = v_pharmacie
  for update;

  v_sequence := v_sequence + 1;
  v_payload := jsonb_build_object(
    'id', v_event_id,
    'pharmacie_id', v_pharmacie,
    'sequence_no', v_sequence,
    'event_at', v_event_at,
    'actor_id', v_actor,
    'entity_type', tg_table_name,
    'entity_id', v_entity_id,
    'operation', tg_op,
    'old_data', v_old,
    'new_data', v_new,
    'previous_hash', v_previous_hash,
    'transaction_id', txid_current()
  );
  v_hash := encode(
    extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.caisse_audit_events(
    id, pharmacie_id, sequence_no, event_at, actor_id,
    entity_type, entity_id, operation, old_data, new_data,
    previous_hash, event_hash, hash_payload, transaction_id
  )
  values (
    v_event_id, v_pharmacie, v_sequence, v_event_at, v_actor,
    tg_table_name, v_entity_id, tg_op, v_old, v_new,
    v_previous_hash, v_hash, v_payload, txid_current()
  );

  update public.caisse_audit_chain_heads
  set last_sequence = v_sequence,
      last_hash = v_hash,
      updated_at = v_event_at
  where pharmacie_id = v_pharmacie;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$audit$;

revoke all on function public.naxa_caisse_audit_append() from public, anon, authenticated;

create or replace function public.naxa_caisse_audit_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $immutable$
begin
  raise log 'NAXA_CAISSE_AUDIT_MUTATION_REJECTED table=% operation=% actor=%', tg_table_name, tg_op, auth.uid();
  raise exception 'Journal d’audit caisse append-only : modification interdite';
end;
$immutable$;

revoke all on function public.naxa_caisse_audit_immutable() from public, anon, authenticated;
drop trigger if exists trg_caisse_audit_events_immutable on public.caisse_audit_events;
create trigger trg_caisse_audit_events_immutable
before update or delete on public.caisse_audit_events
for each row execute function public.naxa_caisse_audit_immutable();
drop trigger if exists trg_caisse_audit_events_no_truncate on public.caisse_audit_events;
create trigger trg_caisse_audit_events_no_truncate
before truncate on public.caisse_audit_events
for each statement execute function public.naxa_caisse_audit_immutable();

create or replace function public.naxa_caisse_guard_closed_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $guard$
declare
  v_session_statut public.caisse_cloture_statut;
  v_vente_statut public.vente_statut;
  v_session_id uuid;
  v_vente_id uuid;
begin
  if tg_table_name = 'caisses_sessions' then
    if tg_op = 'DELETE' then
      if old.statut = 'cloturee' then
        raise log 'NAXA_CAISSE_MUTATION_REJECTED table=% operation=DELETE row=% actor=% reason=closed_session', tg_table_name, old.id, auth.uid();
        raise exception 'Session clôturée immuable : suppression interdite';
      end if;
      return old;
    end if;

    if old.statut = 'cloturee' then
      raise log 'NAXA_CAISSE_MUTATION_REJECTED table=% operation=UPDATE row=% actor=% reason=closed_session', tg_table_name, old.id, auth.uid();
      raise exception 'Session clôturée immuable : modification interdite';
    end if;
    return new;
  end if;

  if tg_table_name = 'ventes' then
    if tg_op = 'DELETE' then
      raise log 'NAXA_CAISSE_MUTATION_REJECTED table=% operation=DELETE row=% actor=% reason=sale_delete_forbidden', tg_table_name, old.id, auth.uid();
      raise exception 'Suppression de vente interdite : utiliser le parcours contrôlé';
    end if;

    v_session_id := old.caisse_session_id;
    select cs.statut into v_session_statut
    from public.caisses_sessions cs
    where cs.id = v_session_id;

    if not found then
      raise log 'NAXA_CAISSE_MUTATION_REJECTED table=% operation=UPDATE row=% actor=% reason=session_missing', tg_table_name, old.id, auth.uid();
      raise exception 'Session de caisse introuvable';
    end if;

    if old.statut = 'payee' and new.statut = 'annulee'
       and (to_jsonb(new) - 'statut') = (to_jsonb(old) - 'statut')
       and exists (
         select 1 from public.vente_annulation_demandes d
         where d.vente_id = old.id and d.statut = 'approuvee'
       ) then
      return new;
    end if;

    if v_session_statut <> 'ouverte' or old.statut in ('payee','annulee') then
      raise log 'NAXA_CAISSE_MUTATION_REJECTED table=% operation=UPDATE row=% actor=% reason=finalized_or_closed', tg_table_name, old.id, auth.uid();
      raise exception 'Vente finalisée ou session clôturée : modification interdite';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    v_vente_id := old.vente_id;
  else
    v_vente_id := new.vente_id;
  end if;

  select v.statut, v.caisse_session_id
    into v_vente_statut, v_session_id
  from public.ventes v
  where v.id = v_vente_id;
  if not found then
    raise log 'NAXA_CAISSE_MUTATION_REJECTED table=% operation=% row=% actor=% reason=sale_missing', tg_table_name, tg_op, v_vente_id, auth.uid();
    raise exception 'Vente liée introuvable';
  end if;

  select cs.statut into v_session_statut
  from public.caisses_sessions cs
  where cs.id = v_session_id;

  if v_session_statut <> 'ouverte' or v_vente_statut <> 'brouillon' then
    raise log 'NAXA_CAISSE_MUTATION_REJECTED table=% operation=% row=% actor=% reason=finalized_or_closed', tg_table_name, tg_op, v_vente_id, auth.uid();
    raise exception 'Lignes et paiements d’une vente finalisée ou clôturée sont immuables';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$guard$;

revoke all on function public.naxa_caisse_guard_closed_mutation() from public, anon, authenticated;

drop trigger if exists trg_naxa_caisse_session_closed_lock on public.caisses_sessions;
create trigger trg_naxa_caisse_session_closed_lock
before update or delete on public.caisses_sessions
for each row execute function public.naxa_caisse_guard_closed_mutation();

drop trigger if exists trg_naxa_caisse_vente_closed_lock on public.ventes;
create trigger trg_naxa_caisse_vente_closed_lock
before update or delete on public.ventes
for each row execute function public.naxa_caisse_guard_closed_mutation();

drop trigger if exists trg_naxa_caisse_line_closed_lock on public.vente_lignes;
create trigger trg_naxa_caisse_line_closed_lock
before update or delete on public.vente_lignes
for each row execute function public.naxa_caisse_guard_closed_mutation();

drop trigger if exists trg_naxa_caisse_payment_closed_lock on public.vente_paiements;
create trigger trg_naxa_caisse_payment_closed_lock
before update or delete on public.vente_paiements
for each row execute function public.naxa_caisse_guard_closed_mutation();

drop trigger if exists trg_caisse_audit_caisses_sessions on public.caisses_sessions;
create trigger trg_caisse_audit_caisses_sessions
after insert or update or delete on public.caisses_sessions
for each row execute function public.naxa_caisse_audit_append();

drop trigger if exists trg_caisse_audit_ventes on public.ventes;
create trigger trg_caisse_audit_ventes
after insert or update or delete on public.ventes
for each row execute function public.naxa_caisse_audit_append();

drop trigger if exists trg_caisse_audit_vente_lignes on public.vente_lignes;
create trigger trg_caisse_audit_vente_lignes
after insert or update or delete on public.vente_lignes
for each row execute function public.naxa_caisse_audit_append();

drop trigger if exists trg_caisse_audit_vente_paiements on public.vente_paiements;
create trigger trg_caisse_audit_vente_paiements
after insert or update or delete on public.vente_paiements
for each row execute function public.naxa_caisse_audit_append();

comment on table public.caisse_audit_events is
  'Journal append-only des mutations POS, chaîné SHA-256 par pharmacie. Les refus de mutation sont envoyés aux logs PostgreSQL car la transaction refusée est annulée.';
comment on table public.caisse_audit_chain_heads is
  'Tête privée de la chaîne SHA-256 d’audit POS, une tête sérialisée par pharmacie.';
comment on function public.naxa_caisse_guard_closed_mutation() is
  'Verrouille les sessions clôturées et empêche la modification des ventes finalisées, lignes et paiements après clôture. Une annulation approuvée reste autorisée par le parcours dédié.';

commit;
