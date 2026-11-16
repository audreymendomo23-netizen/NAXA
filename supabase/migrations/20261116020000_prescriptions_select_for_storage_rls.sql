-- NAXA — Accorder SELECT à authenticated sur prescriptions pour l'évaluation RLS Storage.
-- La visibilité des lignes reste bornée par les politiques RLS client/staff existantes.
-- Aucun accès SELECT n'est accordé à anon.
begin;

grant select on table public.prescriptions to authenticated;

commit;
