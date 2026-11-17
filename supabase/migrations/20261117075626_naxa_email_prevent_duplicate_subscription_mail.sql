-- NAXA — évite tout double envoi : les abonnements partenaires sont déjà couverts par l'outbox historique.
begin;
drop trigger if exists trg_naxa_partner_subscription_notification_email on public.notifications;
drop function if exists private.naxa_partner_subscription_notification_email();
commit;
