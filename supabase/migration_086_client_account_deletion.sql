-- NAXA 086 — suppression de compte client avec conservation des dossiers de réservation
-- Les réservations restent consultables par la pharmacie après suppression du compte client.
-- Aucune option de suppression n'est ajoutée côté pharmacie.
begin;
alter table public.reservations alter column client_id drop not null;
alter table public.reservations drop constraint if exists reservations_client_id_fkey;
alter table public.reservations add constraint reservations_client_id_fkey foreign key (client_id) references auth.users(id) on delete set null;
commit;
