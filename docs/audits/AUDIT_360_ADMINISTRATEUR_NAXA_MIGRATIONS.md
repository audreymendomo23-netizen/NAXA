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

- Replay : 122 réaligné, 124, 261 (soumission de règlement/notifications), 269 (31 assertions), 270, 271, `20261102014000`, `20261102101510` (structurel et comportemental), `20261102105033`, `20261102105229`, `20261102105542` et 262 : tous PASS. Les tests transactionnels annulent leurs fixtures.
- Production : les politiques Admin ciblées, les gardes `public.is_admin()`, la RPC de validation partenaire, la politique publique de visibilité Examens, les politiques catalogue Examens et la table/RPC outbox ont été relues en SQL.
- Réserve : le test 271 ne simule pas un véritable upload; le bucket `medicaments` n'est pas provisionné en Replay. Aucune action Storage réelle ou donnée métier Production n'a été créée.
- Réserve : le cycle outbox a été vérifié jusqu'à `claim`/`finish` sans envoi Google externe. Le cron `naxa-promoteur-echeance-5j` est actif à 06:00 UTC; la réception effective doit être confirmée par une recette contrôlée dans l'application. Le test 261 confirme également la soumission du règlement et les notifications sans transfert bancaire réel.
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


---

# Addendum — réconciliation Production / Replay exécutée (5 novembre 2026)

## Périmètre et résultat

Intervention autorisée explicitement par l’utilisateur le 5 novembre 2026 sur Supabase Production `Naxa` (`eouwtuusnsuxaejsxknf`), avec comparaison de référence au projet non-Production `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`).

- Historique Supabase Production avant intervention : **288 migrations enregistrées**.
- Historique Supabase Production après intervention : **368 migrations enregistrées** (80 entrées supplémentaires, y compris les migrations de compatibilité et de correction ACL).
- Tables publiques Production après intervention : **159** ; Replay : **156**.
- Les deux historiques ne sont pas fusionnables par simple comparaison de préfixes : ils contiennent des versions d'application et des conventions de nommage différentes. Le registre live a été enrichi à partir du SQL de `main`, en gardant des noms d'application explicites `production_*`.
- Aucune migration destructive, aucun reset de base et aucune suppression des données Production n'ont été réalisés.

## Blocs réconciliés en Production

1. Appareils et contrat offline, adapté au modèle Production : `appareils.utilisateur_id` référence `profiles(id)`; la table historique canonique `offline_operations` est conservée.
2. Catalogue : équivalences de produits.
3. Pharmacien : préparation des prescriptions, lecture sous RLS, journal append-only, exports audités, partage des mesures et accès opérationnel.
4. Comptabilité : périodes, plan comptable, mappings, écritures, lignes, audit chaîné, outbox/worker, contrôles et clôture, sessions Comptable et contrepassation de vente.
5. Gestion Stock : sessions, affectations, inventaires, mouvements, réception, lots, transferts, quarantaines, contrôles d'accès offline et vente POS offline.
6. RBAC autonome : catalogue canonique de 11 rôles, affectations multi-postes, sélection d'un espace actif par identité, routage des privilèges, séparation Admin/Caisse et gardes Responsable/Pharmacien/Stock/Comptable.
7. Marketplace crédit et abonnement Promoteur : débit à l'approbation, protections anti-double débit, destinations de paiement figées dans la déclaration, preuve facultative après déclaration et période renouvelée à la confirmation réelle.
8. Sécurité et compatibilité Production : façade `public.naxa_scope_allows` alignée sur le helper privé RBAC ; `can_manage_profile(uuid)` n'est plus exécutable par `anon` et reste exécutable par `authenticated` et `service_role`.

### Adaptations indispensables à Production

Les scripts Replay n'ont pas été rejoués aveuglément. Des divergences vérifiées ont nécessité des adaptations :
- Le contrat appareil a été aligné sur la FK Production vers `profiles` et le type `installation_id text`.
- La migration 266 a conservé la signature d'argument existante `p_profile` et son défaut de scope.
- La migration 295 a patché `private.naxa_grant_privilege`, le vrai moteur utilisé par la façade publique Production.
- La migration 296 a été adaptée au corps réel du helper `naxa_stock_manager_actor`; les RPC Admin déjà protégées par `is_admin()` ont conservé leur garde.
- Le helper privé de périmètre est devenu la source de vérité de la façade publique, ce qui a corrigé un écart fonctionnel révélé par le test 287.
- La fonction nouvellement créée `can_manage_profile` a reçu un ACL explicite : `anon=false`, `authenticated=true`, `service_role=true`.

## Écarts Replay volontairement conservés

Les 4 tables Replay-only restantes n'ont pas été importées, car elles appartiennent à un modèle ancien/draft ou à un schéma incompatible avec Production :
- `naxa_profile_custom_roles` : le modèle de `naxa_custom_roles` diffère entre Replay et Production (clé métier Promoteur côté Replay, modèle pharmacie côté Production). La policy Replay référence notamment `promoteur_id`, absent du modèle Production.
- `tentatives_code`, `naxa_offline_operations`, `naxa_offline_alertes` : objets d'une fondation offline draft historique ; Production conserve déjà le contrat canonique `offline_operations` et les tables offline POS nouvelles.
- Ne pas importer ces objets sans une migration de conception qui réconcilie leurs schémas, usages applicatifs et politiques RLS.

Les 6 tables existant avant cette intervention uniquement en Production ont été préservées : `suivi_user_devices`, `naxa_session_audit_failures`, `reservation_statut_historique`, `medicaments_referentiel_sources`, `pharmacie_donnees_historique` et `medicaments_images`. La nouvelle table `naxa_payment_destinations` porte le septième écart Production-only.

## Tests et preuve de rollback

Recettes SQL transactionnelles exécutées sur Production, à partir des tests versionnés sur `main`, avec fixtures temporaires adaptées au déclencheur d'inscription Production :

| Test | Assertions Production |
|---|---:|
| 287 — rôles autonomes et sélection active | 8 PASS |
| 295 — scopes stricts et gardes legacy | 11 PASS |
| 297 — parcours Pharmacien | 8 PASS |
| 298 — inventaire, Stock et Admin actif | 7 PASS |
| 299 — Responsable et Comptable autonomes | 4 PASS |
| **Total** | **38 PASS** |

- Le test 296 (Stock/Caisse/pilotage) a réussi sur Replay, mais l'exécution de son script complet sur Production a été bloquée par le contrôle de sécurité de l'outil avant exécution. Il n'est donc **pas déclaré PASS Production**.
- Tous les tests Production effectivement exécutés se sont terminés par `ROLLBACK`.
- Contrôle post-tests : **0** pharmacie fixture, **0** profil fixture, **0** affectation, **0** sélection active, **0** session Stock de test, **0** session Comptable de test et **0** vente offline.
- Données métier Production préservées : 10 profils et 4 pharmacies ; aucun poste professionnel, période comptable, écriture comptable ou vente offline n'a été provisionné par cette réconciliation.

## Advisories après intervention

- `can_manage_profile` retirée du rôle `anon`; les alertes SECURITY DEFINER exécutables par anon sont passées de 6 à **5**. Les cinq RPC restantes sont des façades publiques de catalogue/lecture (`get_home_service_catalog`, `get_universe_catalog`, `marketplace_offre_stock_disponible`, `produits_populaires`, `universe_partner_is_public`) et n'ont pas été révoquées sans analyse de leur contrat public.
- 147 fonctions SECURITY DEFINER restent exécutables par `authenticated` : revue individuelle requise, aucune révocation massive.
- 12 constats RLS « enabled / no policy » demeurent. Les tables serveur concernées ont été contrôlées en ACL : les rôles `anon` et `authenticated` n'ont aucun privilège direct sur les tables vérifiées ; ne pas ajouter une policy publique pour faire disparaître un simple constat INFO.
- Advisories performance : 129 FK sans index, 132 index inutilisés, 69 groupes de policies permissives multiples et 6 constats RLS initplan. Ils exigent une optimisation ciblée, pas une suppression ou création massive.
- Protection Auth contre les mots de passe compromis toujours désactivée ; durcissement Auth séparé à planifier.

## Limites et statut de livraison

- Réconciliation des migrations et schéma Production : **appliqués et vérifiés structurellement**.
- Recettes Production : **38 assertions PASS sur cinq scripts** ; recette 296 non exécutée sur Production.
- Les quatre tables Replay-only listées plus haut restent intentionnellement hors Production.
- Aucune donnée utilisateur/commerciale réelle n'a été créée ou transformée par les tests.
- Aucun déploiement Vercel, build navigateur ou test HTTP/JWT applicatif n'a été lancé dans cette opération.



---

# Addendum — séparation Vercel Production / Supabase Replay (5 novembre 2026)

## Configuration appliquée

Projet Vercel `naxa` — équipe `naxa3` :

- `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` Production : ciblées sur **Production uniquement**; valeurs Production conservées.
- `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` Replay : ciblées sur **Preview et Development uniquement**; URL et publishable key lues du projet Supabase `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`).
- `SUPABASE_SERVICE_ROLE_KEY` global Preview et Development : valeurs vidées et commentaires explicites de désactivation. La valeur Production reste limitée à Production.
- `SUPABASE_SECRET_KEY` Preview : valeur vidée, car sa provenance Replay n'a pas pu être certifiée. Aucune clé secrète Production n'a été copiée ou utilisée pour tester Replay.
- `NAXA_REPLAY_EDGE_JWT` Development : ancienne variable E2E temporaire vidée.
- `NAXA_ADMIN_BOOTSTRAP_SECRET` Preview est restée inchangée, son commentaire l'identifiant comme secret de bootstrap Replay.
- Protection Vercel Authentication / SSO : toujours activée sur tous les déploiements; aucune protection d'accès n'a été désactivée.

## Vérifications

- Supabase Replay confirmé `ACTIVE_HEALTHY`, région `eu-west-1`, PostgreSQL 17.
- Requête SQL en lecture seule exécutée directement sur Replay : `current_database() = postgres`, connexion confirmée. Aucune requête ni écriture dans Production.
- Relecture de la configuration Vercel après modification : les deux variables publiques Production ne ciblent plus que Production; les deux variables publiques Replay ciblent Preview/Development; les secrets privilégiés globaux Preview/Development sont vides.
- Aucun déploiement, build ou changement de domaine déclenché. Les variables s'appliqueront au prochain build/déploiement Preview ou Production correspondant.

## Blocages résiduels explicites

1. Le code `src/lib/supabase/server.ts` exige `SUPABASE_SECRET_KEY` pour `supabaseAdmin()`. La clé `sb_secret_...` propre à Replay n'a pas pu être créée/récupérée par les outils Supabase disponibles dans cette intervention. Les routes serveur privilégiées/admin restent donc non configurées sur Preview tant qu'une clé secrète issue exclusivement de Replay n'est pas créée dans Supabase Replay puis stockée comme variable Vercel Preview (et Development si nécessaire). Ne jamais utiliser la clé Production comme solution de contournement.
2. Une ancienne entrée de variable `SUPABASE_SERVICE_ROLE_KEY` reste attachée à la Preview de la branche supprimée `fix/login-page-layout-20261012`. Sa mise à jour a été rejetée par l'API Vercel (`400: Project "naxa" does not have a connected Git repository`). Son commentaire interdit déjà son utilisation; cette entrée n'a pas été lue déchiffrée ni réutilisée. Le projet Vercel signalant l'absence de dépôt Git connecté, le nettoyage de cette portée de branche demande de rétablir ce lien ou de supprimer cette entrée depuis les paramètres Vercel.
3. L'accès automatisé aux Preview protégées par SSO nécessite un bypass Vercel dédié aux tests, envoyé par l'en-tête `x-vercel-protection-bypass` et stocké côté runner/secret manager. Aucun secret de bypass n'a été créé ou exposé durant cette intervention.

Le fichier `.env.example` a été aligné sur le nom réellement lu par le serveur (`SUPABASE_SECRET_KEY`) et précise qu'en Preview/Development la clé doit provenir de Replay. Cette modification est documentaire et ne crée pas de secret.

**Statut :** variables publiques Production/Replay séparées et vérifiées; secrets privilégiés non Production neutralisés; connexion SQL Replay confirmée. Accès serveur Admin Replay et exécution E2E HTTP à travers SSO restent conditionnés à la clé `sb_secret_...` Replay et au bypass de test dédiés. Aucun déploiement n'a été effectué.
