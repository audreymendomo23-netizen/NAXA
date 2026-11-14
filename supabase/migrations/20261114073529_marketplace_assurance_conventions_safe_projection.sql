-- La vue conventions reste une projection publique explicite et limitée.
-- Une vue invoker exigerait un SELECT global sur la table source et exposerait
-- ses colonnes internes aux lecteurs publics ; les grants anon restent colonnaires.
begin;
alter view public.marketplace_assurance_conventions reset (security_invoker);
alter view public.marketplace_assurance_conventions set (security_barrier=true);
commit;
