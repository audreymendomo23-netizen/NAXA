-- NAXA — autoriser les événements de confirmation Client et Livreur utilisés par les RPC.
BEGIN;

ALTER TABLE public.naxa_delivery_events
  DROP CONSTRAINT IF EXISTS naxa_delivery_events_event_type_check;

ALTER TABLE public.naxa_delivery_events
  ADD CONSTRAINT naxa_delivery_events_event_type_check
  CHECK (
    event_type = ANY (ARRAY[
      'ready',
      'accepted',
      'picked_up',
      'location',
      'arrived',
      'client_confirmed',
      'courier_confirmed',
      'delivered',
      'failed',
      'reoffered',
      'cancelled'
    ]::text[])
  );

COMMIT;
