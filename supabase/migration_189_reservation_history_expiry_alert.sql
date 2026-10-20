-- NAXA 189 — historique client des réservations et rappel d'expiration à 30 minutes.
begin;

create table if not exists public.reservation_statut_historique (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  ancien_statut text,
  nouveau_statut text not null,
  acteur_id uuid references auth.users(id) on delete set null,
  cree_le timestamptz not null default now()
);
create index if not exists reservation_statut_historique_reservation_idx
  on public.reservation_statut_historique(reservation_id, cree_le desc);

alter table public.reservation_statut_historique enable row level security;
drop policy if exists reservation_historique_participants_read on public.reservation_statut_historique;
create policy reservation_historique_participants_read on public.reservation_statut_historique
for select to authenticated using (
  exists (
    select 1 from public.reservations r
    where r.id = reservation_id
      and (r.client_id = (select auth.uid())
        or public.is_admin()
        or public.naxa_scope_allows((select auth.uid()), r.pharmacie_id, 'PHARMACIE'))
  )
);
revoke all on public.reservation_statut_historique from anon, public;
grant select on public.reservation_statut_historique to authenticated;

create or replace function private.journaliser_statut_reservation()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.reservation_statut_historique(reservation_id, ancien_statut, nouveau_statut, acteur_id)
    values(new.id, null, new.statut::text, auth.uid());
    return new;
  end if;
  if new.statut is distinct from old.statut then
    insert into public.reservation_statut_historique(reservation_id, ancien_statut, nouveau_statut, acteur_id)
    values(new.id, old.statut::text, new.statut::text, auth.uid());

    insert into public.notifications(user_id, type, titre, corps)
    values (
      new.client_id,
      'reservation_status',
      'Mise à jour de votre réservation',
      left('Réservation #' || upper(left(replace(new.id::text, '-', ''), 8))
        || ' : ' || coalesce(new.statut::text, 'statut mis à jour')
        || '. Consultez le détail pour suivre votre dossier.', 1000)
    );
  end if;
  return new;
end;
$function$;
revoke all on function private.journaliser_statut_reservation() from public, anon, authenticated;

drop trigger if exists trg_reservation_statut_historique_insert on public.reservations;
create trigger trg_reservation_statut_historique_insert
after insert on public.reservations
for each row execute function private.journaliser_statut_reservation();

drop trigger if exists trg_reservation_statut_historique_update on public.reservations;
create trigger trg_reservation_statut_historique_update
after update of statut on public.reservations
for each row execute function private.journaliser_statut_reservation();

-- Fonction idempotente à appeler toutes les 5 minutes par pg_cron ou un ordonnanceur sécurisé.
-- La fenêtre de 25 à 30 minutes évite les doublons et les alertes après l'expiration.
create or replace function public.notifier_reservations_expirant_30m()
returns integer language plpgsql security definer set search_path = ''
as $function$
declare v_count integer := 0;
begin
  with due as (
    select r.id, r.client_id, r.expires_at
    from public.reservations r
    where r.mode = 'reservation'
      and r.statut in ('en_attente', 'confirmee')
      and r.expires_at > now() + interval '25 minutes'
      and r.expires_at <= now() + interval '30 minutes'
      and not exists (
        select 1 from public.notifications n
        where n.user_id = r.client_id
          and n.type = 'reservation_expiry_30m'
          and n.corps like '%' || upper(left(replace(r.id::text, '-', ''), 8)) || '%'
      )
  ), inserted as (
    insert into public.notifications(user_id, type, titre, corps)
    select d.client_id, 'reservation_expiry_30m', 'Votre réservation expire dans 30 minutes',
      left('Réservation #' || upper(left(replace(d.id::text, '-', ''), 8))
        || ' : échéance prévue à ' || to_char(d.expires_at, 'DD/MM/YYYY HH24:MI TZH:TZM')
        || '. Contactez la pharmacie ou retirez vos articles avant cette heure.', 1000)
    from due d
    returning id
  )
  select count(*)::integer into v_count from inserted;
  return v_count;
end;
$function$;
revoke all on function public.notifier_reservations_expirant_30m() from public, anon, authenticated;
comment on function public.notifier_reservations_expirant_30m() is
  'À planifier toutes les 5 minutes via pg_cron/ordonnanceur de confiance; crée une seule notification par réservation dans la fenêtre de 25–30 min.';

-- Planification uniquement si pg_cron est déjà installé. Aucun secret ni accès HTTP ajouté.
do $schedule$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'naxa-reservation-expiry-30m') then
      perform cron.schedule(
        'naxa-reservation-expiry-30m',
        '*/5 * * * *',
        'select public.notifier_reservations_expirant_30m();'
      );
    end if;
  end if;
exception when undefined_table or insufficient_privilege then
  raise notice 'pg_cron présent mais non accessible : planifier notifier_reservations_expirant_30m via un ordonnanceur sécurisé.';
end;
$schedule$;

commit;
