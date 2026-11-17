-- NAXA — réaligner la fonction d'événements de réservation avec le schéma déployé.
-- Correctif additif : référence paiement dans paiement_ref ; événements paiement vérifié
-- et livraison conservés. Aucun changement de schéma ni de politique RLS.

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
      to_statut, paiement_ref, detail, actor_id
    )
    values (
      new.id, new.client_id, new.pharmacie_id, 'reservation_created',
      new.statut, new.paiement_ref,
      jsonb_build_object('mode', new.mode, 'total', new.total, 'expires_at', new.expires_at),
      auth.uid()
    );
    if new.paiement_ref is not null then
      insert into public.reservation_events (
        reservation_id, client_id, pharmacie_id, event_type, paiement_ref, detail, actor_id
      )
      values (
        new.id, new.client_id, new.pharmacie_id, 'payment_declared',
        new.paiement_ref, '{}'::jsonb, auth.uid()
      );
    end if;
    return new;
  end if;
  if new.statut is distinct from old.statut then
    insert into public.reservation_events (
      reservation_id, client_id, pharmacie_id, event_type,
      from_statut, to_statut, paiement_ref, detail, actor_id
    )
    values (
      new.id, new.client_id, new.pharmacie_id, 'status_changed',
      old.statut, new.statut, new.paiement_ref,
      jsonb_build_object('mode', new.mode), auth.uid()
    );
  end if;
  if new.statut in ('annulee','expiree')
     and new.mode = 'commande'
     and new.commande_statut is distinct from 'annulee' then
    update public.reservations
       set commande_statut = 'annulee'
     where id = new.id
       and commande_statut is distinct from 'annulee';
  end if;
  if new.paiement_ref is distinct from old.paiement_ref
     and new.paiement_ref is not null then
    insert into public.reservation_events (
      reservation_id, client_id, pharmacie_id, event_type, paiement_ref, detail, actor_id
    )
    values (
      new.id, new.client_id, new.pharmacie_id, 'payment_declared',
      new.paiement_ref, '{}'::jsonb, auth.uid()
    );
  end if;
  if new.paiement_statut is distinct from old.paiement_statut
     and new.paiement_statut = 'effectue' then
    insert into public.reservation_events (
      reservation_id, client_id, pharmacie_id, event_type, paiement_ref, detail, actor_id
    )
    values (
      new.id, new.client_id, new.pharmacie_id, 'payment_verified',
      new.paiement_ref,
      jsonb_build_object('from', old.paiement_statut, 'to', new.paiement_statut, 'payment_mode', new.paiement_mode),
      auth.uid()
    );
  end if;
  if new.commande_statut is distinct from old.commande_statut then
    insert into public.reservation_events (
      reservation_id, client_id, pharmacie_id, event_type, paiement_ref, detail, actor_id
    )
    values (
      new.id, new.client_id, new.pharmacie_id, 'delivery_status_changed',
      new.paiement_ref,
      jsonb_build_object('from', old.commande_statut, 'to', new.commande_statut),
      auth.uid()
    );
  end if;
  return new;
end;
$function$;
revoke execute on function public.log_reservation_event() from public, anon, authenticated;
commit;
