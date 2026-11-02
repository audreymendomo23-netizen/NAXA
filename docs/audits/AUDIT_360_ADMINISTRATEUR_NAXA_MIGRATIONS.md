# État courant — addendum de traçabilité (02/11/2026)

Ce document conserve le rapprochement historique réalisé le 26/10/2026. Son en-tête « aucune migration appliquée » et ses décomptes 37/290/251 décrivent exclusivement le snapshot de cette date; ils ne décrivent pas l'état live du 02/11/2026.

Depuis ce snapshot, les quatre migrations du ratissage Admin ont été appliquées à Supabase Production et vérifiées par relecture SQL :
- `20261102032259` — `admin_active_read_policies`
- `20261102032304` — `admin_active_home_services_guards`
- `20261102095050` — `admin_active_catalog_stock_rls`
- `20261102095056` — `admin_active_medicament_storage_rls`

Les tests Replay 269 (31 assertions), 270 et 271 ont retourné PASS. Les tests 270/271 utilisent des transactions annulées; le test 271 est structurel et ne certifie pas un upload Storage réel, le bucket `medicaments` étant absent du Replay. Le détail des politiques live, des contrôles et des limites figure dans le registre courant : `docs/audits/AUDIT_360_ADMINISTRATEUR_NAXA.md`.

Aucune donnée métier n'a été modifiée et aucun déploiement n'a été déclenché dans cette passe.

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
