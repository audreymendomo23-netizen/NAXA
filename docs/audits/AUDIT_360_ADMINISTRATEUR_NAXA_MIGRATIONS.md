# État courant — addendum de traçabilité après ratissage (02/11/2026)

Le snapshot historique du 26/10 demeure inchangé plus bas. Ses nombres 37/290/251 ne doivent plus être interprétés comme l'état live.

## Inventaire live et versionné

- Supabase Production `Naxa` : **288 migrations appliquées** selon l'historique `schema_migrations` relu.
- GitHub `main` : **79 fichiers SQL** sous `supabase/migrations/`, **306 fichiers historiques** `supabase/migration_NNN*.sql` à la racine de `supabase/`, et **229 tests SQL** sous `supabase/tests/`.
- Les nombres source/live ne sont pas comparables par le seul préfixe 14 chiffres : l'historique Supabase conserve des timestamps d'application distincts et des noms normalisés; certaines sources legacy utilisent un numéro interne ou une autre convention.
- Aucune version dont le préfixe diffère n'a été assimilée automatiquement à une migration manquante. Les changements Admin actuels ont été rapprochés par nom, source correspondante, historique live et relecture des objets SQL déployés.

## Migrations Admin et sécurité associée confirmées en Production

| Version Production | Nom enregistré | Fichier source associé |
|---|---|---|
| `20261102032259` | `admin_active_read_policies` | `supabase/migrations/20261102032259_admin_active_read_policies.sql` |
| `20261102032304` | `admin_active_home_services_guards` | `supabase/migrations/20261102032304_admin_active_home_services_guards.sql` |
| `20261102095050` | `admin_active_catalog_stock_rls` | `supabase/migrations/20261102083000_admin_active_catalog_stock_rls.sql` |
| `20261102095056` | `admin_active_medicament_storage_rls` | `supabase/migrations/20261102084500_admin_active_medicament_storage_rls.sql` |
| `20261102101510` | `admin_partner_dossier_membership_guard` | `supabase/migrations/20261102101510_admin_partner_dossier_membership_guard.sql` |
| `20261102101654` | `admin_global_accounts_pilotage` | `supabase/migrations/20261102014000_admin_global_accounts_pilotage.sql` |
| `20261102101658` | `admin_partner_accounts_summary` | `supabase/migrations/20261102015500_admin_partner_accounts_summary.sql` |
| `20261102104330` | `admin_unique_clients_network_totals` | `supabase/migrations/20261102104330_admin_unique_clients_network_totals.sql` |
| `20261102105033` | `admin_exam_centers_public_scope` | `supabase/migrations/20261102105033_admin_exam_centers_public_scope.sql` |
| `20261102105229` | `notification_email_outbox_delivery` | `supabase/migrations/20261102105229_notification_email_outbox_delivery.sql` |
| `20261102105542` | `admin_exam_catalog_active_read` | `supabase/migrations/20261102105542_admin_exam_catalog_active_read.sql` |

## Tests Replay et relectures Production

- Replay : 269 (31 assertions), 270, 271, 122 réaligné, 124, `20261102014000`, `20261102101510` (structurel et comportemental), `20261102105033`, `20261102105229`, `20261102105542` et 262 : tous PASS. Les tests transactionnels annulent leurs fixtures.
- Production : les politiques Admin ciblées, les gardes `public.is_admin()`, la RPC de validation partenaire, la politique publique de visibilité Examens, les politiques catalogue Examens et la table/RPC outbox ont été relues en SQL.
- Réserve : le test 271 ne simule pas un véritable upload; le bucket `medicaments` n'est pas provisionné en Replay. Aucune action Storage réelle ou donnée métier Production n'a été créée.
- Réserve : le cycle outbox a été vérifié jusqu'à `claim`/`finish` sans envoi Google externe. Le cron `naxa-promoteur-echeance-5j` est actif à 06:00 UTC; la réception effective doit être confirmée par une recette contrôlée dans l'application.
- Le build/Node/CI sur le SHA courant, HTTP/JWT réel et navigateur restent réservés à la CI et à la recette d'application; aucun déploiement n'a été lancé.

---
# Complément technique — rapprochement des migrations NAXA
Date : 26 octobre 2026
Branche : main
Référence initiale du chantier : `165be5154c8af57999c1c3591829fc251f67b0b5`
État : vérification en lecture seule; aucune migration appliquée.

## Résultat observé

Comparaison de l'arbre Git courant avec l'historique Supabase du projet principal :

- `supabase/migrations/` : 37 fichiers SQL horodatés.
- `supabase/migration_NNN*.sql` à la racine du répertoire Supabase : 290 fichiers historiques.
- Historique Supabase : 251 versions appliquées.
- Égalité stricte entre préfixe de 14 chiffres du fichier moderne et version live : 3 correspondances; 248 versions live ne correspondent pas par ce seul critère.

## Interprétation contradictoire

Ce résultat ne signifie pas que 248 migrations manquent du dépôt. Les versions attribuées par Supabase peuvent différer du préfixe source, et le nom live peut inclure le nom source ainsi que son horodatage. Exemple observé : le fichier `20261026190000_admin_rpc_empty_search_path_hardening.sql` est enregistré en live sous la version `20261026150907`, avec le nom `admin_rpc_empty_search_path_hardening_20261026190000`.

La coexistence de deux familles de fichiers (37 modernes et 290 historiques) est un risque de traçabilité à examiner. Le rapprochement doit se faire par nom normalisé, puis par contenu SQL, et non par version seule.

## Vérifications restantes

1. Normaliser les noms de migration des 251 entrées live.
2. Comparer ces noms avec les 37 fichiers modernes et les 290 fichiers historiques.
3. Identifier les migrations live sans source retrouvée, les fichiers présents non appliqués et les contenus divergents.
4. Vérifier en particulier les migrations récentes de garde Admin, de contrôle actif et de durcissement de `search_path`.
5. Consigner les résultats dans le registre principal après rapprochement.

Aucune écriture Supabase n'a été exécutée. Aucun déploiement n'a été déclenché. Aucun fichier SQL n'a été modifié.

## Constat

- **PRE-027 — Confirmé :** les versions live ne correspondent pas systématiquement aux préfixes horodatés des fichiers.
- **PRE-028 — Signal de rapprochement :** 248 entrées live ne correspondent pas au préfixe de 14 chiffres d'un fichier moderne; ce n'est pas une preuve d'absence de source.
- **PRE-029 — Confirmé :** deux conventions de stockage des migrations coexistent.


## Addendum — migrations 258/259 et replay crédit (29 octobre 2026)

- `supabase/migration_258_marketplace_availability_subtract_holds.sql` : la disponibilité Marketplace retranche les holds actifs non expirés, non consommés, non restaurés et non déjà débités. Test `supabase/tests/258_marketplace_availability_subtract_holds.sql` : **PASS** sur le replay.
- `supabase/migration_259_credit_withdrawal_qualify_request_columns.sql` : corrige les références PL/pgSQL ambiguës, autorise `paiement_mode='credit'`, finalise la vente POS crédit et renseigne les champs requis au snapshot du reçu. Test E2E `supabase/tests/259_credit_withdrawal_inverse_order_e2e.sql` : **PASS**, retrait dans l'ordre inverse des allocations, rollback confirmé.
- Les migrations 258/259 ont été appliquées uniquement au replay non-Production `naxa-ci-replay-2` pour validation; elles ne sont pas appliquées à Supabase Production. Aucun déploiement n'a été lancé.
