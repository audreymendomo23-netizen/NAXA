-- NAXA 028b — créer le schéma interne avant les fonctions privées de 029.
-- Additif et idempotent : ne modifie aucun objet métier existant.
create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
