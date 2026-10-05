-- NAXA 021 — Historique d'achats client et horodatage des transitions
-- Additif, non destructif.
-- Objectif : fournir au Client un historique exact des achats avec date/heure,
-- tout en conservant les événements nécessaires au BI canonique.
--
-- Règle :
--   réservation créée -> événements de statut/paiement -> achat (payée/retirée)
-- Les anciens enregistrements restent consultables via reservations/reservation_items.
-- Les horodatages de transition ne peuvent être reconstitués pour le passé ;
-- la traçabilité exacte démarre avec cette migration.

create table if not exists public.reservation_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  event_type text not null check (
    event_type in ('reservation_created','status_changed','payment_declared')
  ),
  from_statut resa_statut,
  to_statut resa_statut,
  paiement_ref text,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null
);

create index if not exists reservation_events_reservation_idx
  on public.reservation_events(reservation_id, occurred_at);

create index if not exists reservation_events_client_idx
  on public.reservation_events(client_id, occurred_at desc);

create index if not exists reservation_events_pharmacie_idx
  on public.reservation_events(pharmacie_id, occurred_at desc);

alter table public.reservation_events enable row level security;

revoke all on table public.reservation_events from anon, authenticated;

drop policy if exists reservation_events_client_read on public.reservation_events;
create policy reservation_events_client_read
on public.reservation_events
for select
to authenticated
using (
  client_id = (select auth.uid())
);

drop policy if exists reservation_events_pharmacie_read on public.reservation_events;
create policy reservation_events_pharmacie_read
on public.reservation_events
for select
to authenticated
using (
  pharmacie_id = public.my_pharmacie()
  or public.is_admin()
);

grant select on table public.reservation_events to authenticated;

create or replace function public.log_reservation_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $naxa$
begin
  if tg_op = 'INSERT' then
    insert into public.reservation_events (
      reservation_id, client_id, pharmacie_id, event_type,
      from_statut, to_statut, paiement_ref, occurred_at, actor_id
    )
    values (
      new.id, new.client_id, new.pharmacie_id, 'reservation_created',
      null, new.statut, new.paiement_ref, now(), (select auth.uid())
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.statut is distinct from old.statut then
      insert into public.reservation_events (
        reservation_id, client_id, pharmacie_id, event_type,
        from_statut, to_statut, paiement_ref, occurred_at, actor_id
      )
      values (
        new.id, new.client_id, new.pharmacie_id, 'status_changed',
        old.statut, new.statut, new.paiement_ref, now(), (select auth.uid())
      );
    end if;

    if new.paiement_ref is distinct from old.paiement_ref then
      insert into public.reservation_events (
        reservation_id, client_id, pharmacie_id, event_type,
        from_statut, to_statut, paiement_ref, occurred_at, actor_id
      )
      values (
        new.id, new.client_id, new.pharmacie_id, 'payment_declared',
        old.statut, new.statut, new.paiement_ref, now(), (select auth.uid())
      );
    end if;
  end if;

  return new;
end;
$naxa$;

revoke execute on function public.log_reservation_event() from public, anon, authenticated;

drop trigger if exists trg_reservation_event_history on public.reservations;
create trigger trg_reservation_event_history
after insert or update of statut, paiement_ref
on public.reservations
for each row
execute function public.log_reservation_event();

-- Vue canonique du listing d'achats du Client.
-- security_invoker garantit que les RLS des tables sous-jacentes restent applicables.
create or replace view public.client_achats
with (security_invoker=true)
as
select
  r.id as reservation_id,
  ri.produit_id,
  p.nom as medicament,
  p.dci,
  p.dosage,
  p.forme,
  p.photo_url,
  ri.quantite,
  ri.prix_unitaire,
  (ri.quantite * ri.prix_unitaire)::int as total_ligne,
  r.total as total_transaction,
  r.paiement_ref as reference_paiement,
  r.created_at as reservation_creee_le,
  ph.id as pharmacie_id,
  ph.nom as pharmacie,
  ph.ville,
  ph.quartier,
  ph.adresse,
  min(e.occurred_at) filter (where e.event_type='status_changed' and e.to_statut='confirmee') as confirmee_le,
  min(e.occurred_at) filter (where e.event_type='payment_declared') as paiement_declare_le,
  min(e.occurred_at) filter (where e.event_type='status_changed' and e.to_statut='payee') as payee_le,
  min(e.occurred_at) filter (where e.event_type='status_changed' and e.to_statut='retiree') as retiree_le,
  min(e.occurred_at) filter (where e.event_type='status_changed' and e.to_statut='annulee') as annulee_le,
  min(e.occurred_at) filter (where e.event_type='status_changed' and e.to_statut='expiree') as expiree_le,
  min(e.occurred_at) filter (where e.event_type='status_changed' and e.to_statut in ('payee','retiree')) as achat_le,
  (
    min(e.occurred_at) filter (
      where e.event_type='status_changed'
        and e.to_statut in ('payee','retiree')
    ) is not null
  ) as horodatage_achat_exact,
  r.statut
from public.reservations r
join public.reservation_items ri on ri.reservation_id=r.id
join public.produits p on p.id=ri.produit_id
join public.pharmacies ph on ph.id=r.pharmacie_id
left join public.reservation_events e on e.reservation_id=r.id
where r.statut in ('payee','retiree')
group by
  r.id, ri.produit_id, p.nom, p.dci, p.dosage, p.forme, p.photo_url,
  ri.quantite, ri.prix_unitaire, r.total, r.paiement_ref,
  r.created_at, ph.id, ph.nom, ph.ville, ph.quartier, ph.adresse, r.statut;

revoke all on table public.client_achats from anon, authenticated;
grant select on table public.client_achats to authenticated;

comment on table public.reservation_events is
  'Historique horodaté des événements d''une réservation : création, transition de statut et déclaration de paiement.';

comment on view public.client_achats is
  'Listing canonique des médicaments achetés par le Client, avec détails transactionnels et horodatage. Ne contient que les réservations payées ou retirées.';
