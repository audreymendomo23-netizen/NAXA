-- NAXA — corriger la journalisation d'une référence de paiement sur réservation.
-- Cause : la fonction Replay utilisait reservation_events.to_value, colonne inexistante.
-- Le schéma canonique stocke la référence dans reservation_events.paiement_ref.
-- Aucun changement de table, de contrainte, de RLS ou de privilège n'est requis.

begin;

create or replace function public.log_reservation_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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

    if new.statut in ('payee','retiree') then
      insert into public.reservation_events (
        reservation_id, client_id, pharmacie_id, event_type,
        from_statut, to_statut, paiement_ref, occurred_at, actor_id
      )
      values (
        new.id, new.client_id, new.pharmacie_id, 'status_changed',
        null, new.statut, new.paiement_ref, now(), (select auth.uid())
      );
    end if;

    if new.paiement_ref is not null then
      insert into public.reservation_events (
        reservation_id, client_id, pharmacie_id, event_type,
        from_statut, to_statut, paiement_ref, occurred_at, actor_id
      )
      values (
        new.id, new.client_id, new.pharmacie_id, 'payment_declared',
        null, new.statut, new.paiement_ref, now(), (select auth.uid())
      );
    end if;

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
$function$;

revoke execute on function public.log_reservation_event() from public, anon, authenticated;

commit;
