-- NAXA — la projection publique des conventions respecte les RLS des tables sources.
-- La seule colonne additionnelle lue par le prédicat de la vue est statut.
-- La policy source ne retourne que les conventions actives de pharmacies publiques.
begin;
grant select (statut) on table public.assurance_conventions to anon;
alter view public.marketplace_assurance_conventions
  set (security_barrier=true,security_invoker=true);
commit;
