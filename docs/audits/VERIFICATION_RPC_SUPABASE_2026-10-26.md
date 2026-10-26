# Vérification n°2 — RPC Supabase sécurisées
Date : 26 octobre 2026
Branche : `audit/admin-360-20261026`
Projet Supabase : `eouwtuusnsuxaejsxknf`

## Résultat

**Validée — aucun retour prévu sur ce point dans le parcours séquentiel convenu.**

## Correctif de durcissement complémentaire

L'inspection des définitions live a révélé huit RPC `SECURITY DEFINER` dont le `search_path` n'était pas vide. La migration additive suivante a été appliquée au projet Supabase et ajoutée à la branche :

- Fichier : `supabase/migrations/20261026190000_admin_rpc_empty_search_path_hardening.sql`
- Migration enregistrée en base : `20261026150907`, nom `admin_rpc_empty_search_path_hardening_20261026190000`.
- Commit Git de la migration : `f87d32147564ef0356cf9ef405646b90f4faaad2`.

Elle fixe `search_path = ''` pour :
`admin_set_home_service_offer_status`,
`admin_set_partner_universe`,
`admin_set_universe_enabled`,
`expire_universe_reservations`,
`get_home_service_request_receipt`,
`is_suivi_test_account`,
`partner_adjust_universe_stock` et
`partner_import_universe_products`.

## Contrôles SQL post-correction

- Les 12 RPC ciblées ont été relues dans les catalogues PostgreSQL : les 12 ont `SECURITY DEFINER`, un `search_path` vide, aucune autorisation d'exécution pour `anon`, et une autorisation d'exécution pour `authenticated` (les fonctions doivent donc faire leur propre contrôle d'accès).
- Les 12 fonctions appellent `public.is_admin()` pour leur branche d'autorisation administrateur; les contrôles métier propres aux propriétaires/gestionnaires/opérateurs partenaires et le chemin `service_role` de l'expiration restent préservés.
- Test transactionnel : le profil administrateur actif a été temporairement désactivé dans une transaction, l'identité de session correspondante a été posée, puis `public.is_admin()` a été vérifié faux et l'appel à `public.admin_set_universe_enabled` a été vérifié refusé par privilège insuffisant. La transaction a été annulée.
- Le profil administrateur a ensuite été relu : `actif = true`; aucun changement durable du profil.
- Les tests transactionnels antérieurs sur cette même série avaient aussi vérifié le refus des six RPC de statut et les refus de chemins sensibles (expiration, génération de créneaux et import catalogue) pour un administrateur désactivé.
- Historique Supabase relu après le correctif : la migration complémentaire est enregistrée.

## Verdict et limites

- Garde SQL administrateur actif : **VERT**.
- `search_path` des 12 RPC ciblées : **VERT**.
- Refus d'exécution pour `anon` sur les 12 RPC : **VERT**.
- Refus d'une RPC représentative pour administrateur désactivé, transaction annulée : **VERT**.
- Lint, typecheck, build Next.js et tests navigateur : non exécutés via les connecteurs disponibles; cela n'invalide pas les contrôles SQL effectués mais reste une limite générale de validation applicative.
- Aucun merge dans `main` et aucun déploiement.

Cette validation porte sur le lot ciblé des 12 RPC administratives/partenaires décrit dans les migrations du 26 octobre 2026; elle ne signifie pas que toutes les fonctions `SECURITY DEFINER` du projet ont été auditées intégralement.
