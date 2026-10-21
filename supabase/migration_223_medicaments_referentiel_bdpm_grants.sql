-- NAXA 223 — Garantir explicitement l’accès lecture à l’API de données.
begin;
grant select on public.medicaments_referentiel_sources to anon, authenticated;
grant select, insert, update on public.medicaments_referentiel_sources to service_role;
commit;
