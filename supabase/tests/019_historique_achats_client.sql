-- NAXA 021 — tests de sécurité et de cohérence de l'historique d'achats
-- Exécuter dans une base de test avec les fixtures auth/profils du chantier.
-- Aucun test ne doit écrire durablement : transaction rollbackée.

begin;

select plan(14);

-- 1. La table existe et RLS est activée.
select ok(
  exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='reservation_events' and c.relrowsecurity
  ),
  'reservation_events est protégée par RLS'
);

-- 2. Le listing existe et reste une vue.
select ok(
  exists (
    select 1
    from pg_views v
    where v.schemaname='public'
      and v.viewname='client_achats'
  ),
  'client_achats existe'
);

-- 3. La vue est explicitement security_invoker.
select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='client_achats'
      and 'security_invoker=true' = any(coalesce(c.reloptions, '{}'::text[]))
  ),
  'client_achats est security_invoker'
);

-- 4-5. Aucun accès public/anonyme à la table brute.
select ok(
  not has_table_privilege('anon','public.reservation_events','select'),
  'anon ne peut pas lire reservation_events'
);

select ok(
  not has_table_privilege('authenticated','public.reservation_events','insert'),
  'authenticated ne peut pas écrire reservation_events'
);

-- 5-6. Le listing expose les grains nécessaires.
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='client_achats' and column_name='achat_le'
  ),
  'client_achats expose achat_le'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='client_achats' and column_name='payee_le'
  ),
  'client_achats expose payee_le'
);

-- 7. Le listing expose l'indicateur d'exactitude historique.
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='client_achats' and column_name='horodatage_achat_exact'
  ),
  'client_achats expose horodatage_achat_exact'
);

-- 8-10. Les détails Client enrichis existent dans le listing.
select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='client_achats' and column_name='photo_url'),
  'client_achats expose la photo produit'
);

select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='client_achats' and column_name='confirmee_le'),
  'client_achats expose la confirmation'
);

select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='client_achats' and column_name='paiement_declare_le'),
  'client_achats expose la déclaration de paiement'
);

-- 8. Les achats sont bornés aux états commerciaux terminaux autorisés.
select ok(
  pg_get_viewdef('public.client_achats'::regclass, true) like '%where r.statut in (%',
  'client_achats est bornée aux achats payés/retirés'
);

-- 12. Le listing Client est explicitement borné au propriétaire courant.
select ok(
  pg_get_viewdef('public.client_achats'::regclass, true) like '%r.client_id = auth.uid()%',
  'client_achats ne peut retourner que les achats du Client courant'
);

-- 13. La fonction de trigger n'est pas directement exposée.
select ok(
  has_function_privilege('authenticated','public.log_reservation_event()','execute') is false,
  'authenticated ne peut pas appeler directement le trigger'
);

select * from finish();
rollback;
