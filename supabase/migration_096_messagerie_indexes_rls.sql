-- NAXA 096 — indexation des conversations et consolidation des politiques de lecture.
begin;
create index if not exists fils_messages_pharmacie_created_idx on public.fils_messages(pharmacie_id,created_at desc);
create index if not exists fils_messages_produit_idx on public.fils_messages(produit_id);
create index if not exists messages_pharmacie_fil_created_idx on public.messages_pharmacie(fil_id,created_at desc);
create index if not exists notifications_fil_idx on public.notifications(fil_id);
create index if not exists notifications_pharmacie_created_idx on public.notifications(pharmacie_id,created_at desc);
create index if not exists notifications_user_created_idx on public.notifications(user_id,created_at desc);
create index if not exists reservation_events_actor_idx on public.reservation_events(actor_id);
drop policy if exists fils_messages_client_read on public.fils_messages;
drop policy if exists fils_messages_pharmacy_read on public.fils_messages;
drop policy if exists fils_messages_participant_read on public.fils_messages;
create policy fils_messages_participant_read on public.fils_messages for select to authenticated
using (client_id=(select auth.uid()) or public.is_admin() or public.naxa_scope_allows((select auth.uid()),pharmacie_id,'PHARMACIE'));
drop policy if exists reservation_events_client_read on public.reservation_events;
drop policy if exists reservation_events_pharmacie_read on public.reservation_events;
drop policy if exists reservation_events_participant_read on public.reservation_events;
create policy reservation_events_participant_read on public.reservation_events for select to authenticated
using (client_id=(select auth.uid()) or public.is_admin() or public.naxa_scope_allows((select auth.uid()),pharmacie_id,'PHARMACIE'));
commit;