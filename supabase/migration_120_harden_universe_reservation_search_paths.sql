-- NAXA 120 — durcir le search_path des RPC SECURITY DEFINER de réservation multi-univers.
-- Additif : aucun changement métier, aucune modification du parcours Pharmacie.
-- pg_temp est explicitement placé en dernier pour éviter l'ombrage d'objets par une session authentifiée.
begin;

alter function public.reserve_universe_products(uuid,text,jsonb,text)
  set search_path = public, extensions, pg_temp;

alter function public.transition_universe_reservation(uuid,text)
  set search_path = public, extensions, pg_temp;

commit;
