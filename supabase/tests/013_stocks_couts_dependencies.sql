-- NAXA N4 regression — dépendances SQL découvertes par audit architectural.
-- Ce test ne valide pas seulement l'existence des objets : il verrouille les deux
-- contrats qui avaient cassé le replay complet.
select to_regprocedure('public.can_access_pharmacy(uuid)') is not null as can_access_pharmacy_exists;
select to_regclass('public.naxa_profile_privileges') is not null as canonical_profile_privileges_exists;
select to_regclass('public.stocks_couts') is not null as stocks_couts_exists;
select exists (
  select 1
  from pg_policies
  where schemaname='public'
    and tablename='stocks_couts'
    and policyname='stocks_couts_lecture'
) as stocks_couts_read_policy_exists;
