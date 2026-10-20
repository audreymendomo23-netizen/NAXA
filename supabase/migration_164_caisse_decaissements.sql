-- NAXA 164 — décaissements de caisse tracés et pris en compte à la clôture.
-- Additif : les retraits Marketplace restent des retraits de produits par le client.
begin;

create table if not exists public.caisse_decaissements (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  caisse_session_id uuid not null references public.caisses_sessions(id) on delete restrict,
  montant integer not null check (montant > 0),
  categorie text not null check (categorie in ('depense', 'remise_coffre', 'appoint', 'autre')),
  motif text not null check (length(trim(motif)) between 5 and 500),
  justificatif_ref text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  constraint caisse_decaissements_justificatif_length_ck
    check (justificatif_ref is null or length(trim(justificatif_ref)) <= 200)
);

create index if not exists caisse_decaissements_session_idx
  on public.caisse_decaissements(caisse_session_id, created_at desc);
create index if not exists caisse_decaissements_pharmacie_idx
  on public.caisse_decaissements(pharmacie_id, created_at desc);

alter table public.caisse_decaissements enable row level security;
revoke all on public.caisse_decaissements from public, anon, authenticated;
grant select on public.caisse_decaissements to authenticated;
drop policy if exists caisse_decaissements_read_scope on public.caisse_decaissements;
create policy caisse_decaissements_read_scope on public.caisse_decaissements
  for select to authenticated
  using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

create or replace function public.caisse_decaisser(
  p_session uuid,
  p_montant integer,
  p_categorie text,
  p_motif text,
  p_justificatif_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $decaisser$
declare
  v_session public.caisses_sessions%rowtype;
  v_pharmacie uuid;
  v_id uuid;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_session is null then raise exception 'Session de caisse requise'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Le montant du décaissement doit être supérieur à zéro'; end if;
  if p_categorie not in ('depense', 'remise_coffre', 'appoint', 'autre') then raise exception 'Catégorie de décaissement invalide'; end if;
  if p_motif is null or length(trim(p_motif)) < 5 or length(trim(p_motif)) > 500 then
    raise exception 'Le motif doit contenir entre 5 et 500 caractères';
  end if;
  if p_justificatif_ref is not null and length(trim(p_justificatif_ref)) > 200 then
    raise exception 'Référence de justificatif trop longue';
  end if;

  select cs.*, c.pharmacie_id
    into v_session, v_pharmacie
  from public.caisses_sessions cs
  join public.caisses c on c.id = cs.caisse_id
  where cs.id = p_session
    and cs.statut = 'ouverte'
    and cs.ouvert_par = auth.uid()
    and c.actif = true
  for update of cs;
  if not found then raise exception 'Session ouverte introuvable, inactive ou non détenue par ce compte'; end if;

  select * into v_profile
  from public.profiles p
  where p.id = auth.uid()
    and p.actif = true
    and p.pharmacie_id = v_pharmacie
    and (coalesce(p.role::text, '') = 'caisse' or coalesce(p.fonction_interne, '') = 'caisse');
  if not found and not public.is_admin() then
    raise exception 'Décaissement réservé à un compte Caisse actif de cette pharmacie';
  end if;

  if exists (select 1 from public.caisses_sessions cs where cs.id=p_session and cs.statut <> 'ouverte') then
    raise exception 'Session clôturée : décaissement interdit';
  end if;

  insert into public.caisse_decaissements(
    pharmacie_id, caisse_session_id, montant, categorie, motif, justificatif_ref, created_by
  ) values (
    v_pharmacie, p_session, p_montant, p_categorie, trim(p_motif), nullif(trim(p_justificatif_ref), ''), auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$decaisser$;

revoke all on function public.caisse_decaisser(uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.caisse_decaisser(uuid, integer, text, text, text) to authenticated;

-- Inclure les décaissements dans la chaîne d'audit SHA-256 existante.
alter table public.caisse_audit_events
  drop constraint if exists caisse_audit_events_entity_type_check;
alter table public.caisse_audit_events
  add constraint caisse_audit_events_entity_type_check
  check (entity_type in ('caisses_sessions','ventes','vente_lignes','vente_paiements','caisse_decaissements'));

create or replace function public.naxa_caisse_decaissement_audit_append()
returns trigger
language plpgsql
security definer
set search_path = ''
as $audit$
declare
  v_row jsonb;
  v_pharmacie uuid;
  v_event_id uuid := gen_random_uuid();
  v_event_at timestamptz := clock_timestamp();
  v_actor uuid := auth.uid();
  v_sequence bigint;
  v_previous_hash text;
  v_payload jsonb;
  v_hash text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;
  v_pharmacie := nullif(v_row ->> 'pharmacie_id', '')::uuid;
  if v_pharmacie is null or nullif(v_row ->> 'id', '') is null then
    raise exception 'Audit décaissement impossible : périmètre ou identifiant absent';
  end if;

  insert into public.caisse_audit_chain_heads(pharmacie_id)
  values (v_pharmacie) on conflict (pharmacie_id) do nothing;

  select h.last_sequence, h.last_hash into v_sequence, v_previous_hash
  from public.caisse_audit_chain_heads h
  where h.pharmacie_id = v_pharmacie
  for update;
  v_sequence := v_sequence + 1;
  v_payload := jsonb_build_object(
    'id', v_event_id, 'pharmacie_id', v_pharmacie, 'sequence_no', v_sequence,
    'event_at', v_event_at, 'actor_id', v_actor, 'entity_type', 'caisse_decaissements',
    'entity_id', (v_row ->> 'id')::uuid, 'operation', tg_op,
    'old_data', case when tg_op='INSERT' then null else to_jsonb(old) end,
    'new_data', case when tg_op='DELETE' then null else to_jsonb(new) end,
    'previous_hash', v_previous_hash, 'transaction_id', txid_current()
  );
  v_hash := encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.caisse_audit_events(
    id, pharmacie_id, sequence_no, event_at, actor_id, entity_type, entity_id,
    operation, old_data, new_data, previous_hash, event_hash, hash_payload, transaction_id
  ) values (
    v_event_id, v_pharmacie, v_sequence, v_event_at, v_actor, 'caisse_decaissements',
    (v_row ->> 'id')::uuid, tg_op,
    case when tg_op='INSERT' then null else to_jsonb(old) end,
    case when tg_op='DELETE' then null else to_jsonb(new) end,
    v_previous_hash, v_hash, v_payload, txid_current()
  );

  update public.caisse_audit_chain_heads
  set last_sequence=v_sequence, last_hash=v_hash, updated_at=v_event_at
  where pharmacie_id=v_pharmacie;

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$audit$;

revoke all on function public.naxa_caisse_decaissement_audit_append() from public, anon, authenticated;
drop trigger if exists trg_caisse_audit_decaissements on public.caisse_decaissements;
create trigger trg_caisse_audit_decaissements
after insert or update or delete on public.caisse_decaissements
for each row execute function public.naxa_caisse_decaissement_audit_append();

-- Les mouvements sont historiques : aucune modification ni suppression applicative.
drop trigger if exists trg_caisse_decaissements_immutable on public.caisse_decaissements;
create trigger trg_caisse_decaissements_immutable
before update or delete on public.caisse_decaissements
for each row execute function public.naxa_caisse_audit_immutable();

-- Le solde théorique à la clôture tient compte des entrées espèces et des sorties.
create or replace function public.caisse_cloturer(p_session uuid, p_total_compte integer)
returns table(total_theorique integer, total_compte integer, ecart integer)
language plpgsql
security definer
set search_path = ''
as $cloturer$
declare
  v_session public.caisses_sessions%rowtype;
  v_theorique integer;
  v_cash integer;
  v_decaissements integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_total_compte is null or p_total_compte < 0 then raise exception 'Comptage invalide'; end if;

  select cs.* into v_session
  from public.caisses_sessions cs
  join public.caisses c on c.id=cs.caisse_id
  where cs.id=p_session and (public.is_admin() or public.can_operate_pharmacy(c.pharmacie_id))
  for update;
  if not found then raise exception 'Session caisse introuvable ou hors périmètre'; end if;
  if v_session.statut <> 'ouverte' then raise exception 'Session déjà clôturée'; end if;
  if exists(select 1 from public.ventes v where v.caisse_session_id=p_session and v.statut='brouillon') then
    raise exception 'Impossible de clôturer : vente brouillon encore ouverte';
  end if;

  select coalesce(sum(
    case
      when vp.nb > 0 then vp.montant
      when vp.nb = 0 and v.mode_paiement='especes' then v.total_net
      else 0
    end
  ),0)
  into v_cash
  from public.ventes v
  left join lateral (
    select coalesce(sum(vp2.montant) filter (where vp2.mode='especes'),0) as montant,
           count(*) as nb
    from public.vente_paiements vp2
    where vp2.vente_id=v.id
  ) vp on true
  where v.caisse_session_id=p_session and v.statut='payee';

  select coalesce(sum(d.montant),0)::integer into v_decaissements
  from public.caisse_decaissements d
  where d.caisse_session_id=p_session;

  v_theorique := v_session.fond_initial + coalesce(v_cash,0) - coalesce(v_decaissements,0);
  if v_theorique < 0 then raise exception 'Solde théorique négatif : vérifier les décaissements enregistrés'; end if;

  update public.caisses_sessions
  set statut='cloturee',cloture_at=now(),cloture_par=auth.uid(),
      total_theorique=v_theorique,total_compte=p_total_compte,ecart=p_total_compte-v_theorique
  where id=p_session;

  return query select v_theorique,p_total_compte,p_total_compte-v_theorique;
end;
$cloturer$;

revoke all on function public.caisse_cloturer(uuid, integer) from public, anon, authenticated;
grant execute on function public.caisse_cloturer(uuid, integer) to authenticated;

comment on table public.caisse_decaissements is
  'Sorties de liquidités de caisse, historisées et incluses dans le solde théorique de clôture.';
comment on function public.caisse_decaisser(uuid, integer, text, text, text) is
  'Enregistre atomiquement un décaissement motivé dans la session active détenue par le compte Caisse autorisé.';
commit;
