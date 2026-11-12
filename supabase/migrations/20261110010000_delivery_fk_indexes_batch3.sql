-- NAXA — indexes couvrant les FK des parcours Livraison / Livreur.
-- Les colonnes FK sont placées en tête de chaque index.
-- Les index composites existants sur mission, réservation, pharmacie et livreur
-- sont conservés ; ce lot ne crée que les couvertures manquantes vérifiées.

create index if not exists naxa_delivery_missions_ready_by_idx
  on public.naxa_delivery_missions (ready_by);

create index if not exists naxa_delivery_events_actor_id_idx
  on public.naxa_delivery_events (actor_id);

create index if not exists naxa_delivery_events_pharmacie_time_idx
  on public.naxa_delivery_events (pharmacie_id, created_at desc);

create index if not exists naxa_delivery_commission_pharmacie_month_idx
  on public.naxa_delivery_commission_ledger (pharmacie_id, settlement_month);

create index if not exists naxa_delivery_commission_promoteur_month_idx
  on public.naxa_delivery_commission_ledger (promoteur_id, settlement_month);

create index if not exists naxa_delivery_commission_zone_idx
  on public.naxa_delivery_commission_ledger (zone_id);

create index if not exists naxa_delivery_offers_pharmacie_status_time_idx
  on public.naxa_delivery_mission_offers (pharmacie_id, offer_status, offered_at desc);

create index if not exists naxa_delivery_offers_reservation_idx
  on public.naxa_delivery_mission_offers (reservation_id);

create index if not exists naxa_delivery_payment_caisse_session_idx
  on public.naxa_delivery_payment_records (caisse_session_id);

create index if not exists naxa_delivery_payment_client_time_idx
  on public.naxa_delivery_payment_records (client_id, created_at desc);

create index if not exists naxa_delivery_payment_declared_by_idx
  on public.naxa_delivery_payment_records (declared_by);

create index if not exists naxa_delivery_payment_livreur_time_idx
  on public.naxa_delivery_payment_records (livreur_id, created_at desc);

create index if not exists naxa_delivery_payment_validated_by_idx
  on public.naxa_delivery_payment_records (validated_by);

create index if not exists naxa_delivery_reviews_client_time_idx
  on public.naxa_delivery_reviews (client_id, created_at desc);

create index if not exists naxa_livreur_invites_pharmacie_time_idx
  on public.naxa_livreur_invites (pharmacie_id, created_at desc);

create index if not exists naxa_livreur_invites_assignment_idx
  on public.naxa_livreur_invites (assignment_id);

create index if not exists naxa_livreur_invites_inviteur_time_idx
  on public.naxa_livreur_invites (inviteur_id, created_at desc);

create index if not exists naxa_livreur_invites_accepted_by_idx
  on public.naxa_livreur_invites (accepted_by);
