# NAXA — Registre des contradictions et preuves opérationnelles
## Audit Promoteur — garde-fous des RPC (29/10/2026)

- La définition active de `admin_confirmer_reglement_promoteur` vérifie Admin actif, la cohérence convention/abonnement/tarif et les éléments de preuve; elle conserve l'état des pharmacies et profils, même après renouvellement.
- `promoteur_soumettre_reglement` valide les champs métier et interdit un second règlement en attente. Son chemin applicatif privilégié doit vérifier explicitement l'identité du Promoteur.
- Contradiction potentielle à résoudre avant toute conclusion : `reactiver_promoteur` reste une fonction distincte qui peut réactiver tout le réseau et les profils liés sous garde Admin, contrairement au chemin de confirmation du règlement. Les droits EXECUTE et appelants doivent être recherchés avant de décider si ce chemin est encore accessible ou conforme à la règle métier.
- Aucun changement fonctionnel ou de droits effectué dans cette passe; le constat est documenté dans `docs/audits/AUDIT_360_PARCOURS_PROMOTEUR_NAXA.md`.

## Audit 360° du parcours Promoteur — constat initial (29/10/2026)

- Le périmètre d'exécution est le parcours Promoteur et la clôture du Pilotage 360° définis par `naxa_prompt_maitre_fusion_v2.md`; rapport vivant : `docs/audits/AUDIT_360_PARCOURS_PROMOTEUR_NAXA.md`.
- Contrôle Supabase en lecture seule : cinq tables commerciales/réseau présentes avec RLS activée; aucun accès SELECT direct `anon`; les privilèges `authenticated` sont filtrés par RLS sur conventions, abonnements, paiements et relation Promoteur-pharmacies. La table des règlements n'accorde pas de privilèges directs à `authenticated`.
- Des policies SELECT se recouvrent sur `promoteur_pharmacies`. À analyser avec les routes et les tests; aucune suppression spéculative.
- Les fonctions de soumission et de décision de règlement ont des droits EXECUTE restreints d'après `has_function_privilege`. Les corps de toutes les fonctions, les appelants applicatifs et le comportement bout en bout restent à auditer.
- La partie 3 du Pilotage Promoteur est toujours « à revalider »; parties 4 à 6 non certifiées. L'existence du schéma n'est pas une preuve de complétude métier. Aucun déploiement manuel ni relance de workflow.

**Mise à jour : 29 octobre 2026 — branche de référence : `main`**

Ce registre sépare les faits vérifiés, les corrections appliquées et les limites encore ouvertes. Il prévaut sur les formulations historiques contradictoires des anciens rapports, sans effacer leur valeur d'archive.

## 1. Gouvernance et référence Git
- **Dépôt actif :** `audreymendomo23-netizen/NAXA`, branche `main`.
- **Règle actuelle :** aucune branche de travail, aucune PR imposée, aucun déploiement manuel sans autorisation explicite.
- Les références à `audit/admin-360-20261026`, à une fusion différée ou à un travail qui resterait sur cette branche dans `docs/audits/AUDIT_CTO_ADMIN_360_PRELIMINAIRE_2026-10-26.md` décrivent le contexte historique du rapport, pas l'état opérationnel actuel.
- Aucune branche n'a été créée pendant cette correction.

## 2. Réconciliation Supabase — projet NAXA
Projet ciblé : `eouwtuusnsuxaejsxknf`. Les écritures ci-dessous ont été explicitement autorisées le 29 octobre 2026.

| Migration | Version Supabase observée | Résultat |
|---|---:|---|
| `disable_admin_manual_promoter_payment_entry` | `20261027063825` | Déjà présente; l'ancienne fonction d'enregistrement manuel n'est exécutable ni par `anon`, ni par `authenticated`, ni par `service_role`. |
| `safe_promoter_payment_reactivation_scope` | `20261029052116` | Appliquée et retrouvée dans l'historique. |
| `admin_validate_dossier_pending_only` | `20261029052125` | Appliquée et retrouvée dans l'historique. |
| `promoteur_notifications_include_pharmacies` | `20261029052131` | Appliquée et retrouvée dans l'historique. |
| `remove_duplicate_stocks_lots_id_index` | `20261029052838` | Appliquée; index strictement dupliqué retiré, index unique référencé par les contraintes conservé. |
| `harden_public_catalog_function_search_path` | `20261029053057` | Appliquée; deux fonctions SECURITY DEFINER publiques utilisent désormais `search_path=''` avec relations qualifiées. |
| `harden_rls_helper_search_paths` | `20261029053353` | Appliquée; `can_access_pharmacy` et `suivi_has_consent` utilisent désormais `search_path=''`, sans changement de permissions ni de logique de consentement. |

### Contrôles après application
- `admin_confirmer_reglement_promoteur(uuid,uuid)` : exécution limitée à `service_role`; logique de non-réactivation en bloc présente.
- `admin_valider_dossier_pharmacie(uuid,boolean)` : garde « dossier en attente uniquement » présente; l'appel authentifié reste protégé par le contrôle administrateur dans la fonction.
- `generer_rappels_echeance_promoteurs()` : l'implémentation active inclut les noms du Promoteur et des pharmacies dans les rappels.
- `promoteur_soumettre_reglement(...)` : les droits sont limités à `service_role`; les notifications de paiement et le rappel J-5 ont été mis à jour par la migration appliquée.
- Aucune ligne métier n'a été modifiée intentionnellement par ces migrations; elles remplacent des fonctions et leurs droits. Une recette métier multi-rôles reste nécessaire.

## 3. Contradictions documentaires
- `docs/CONTRADICTIONS.md` était absent de `main`; ce registre le rétablit.
- Le rapport d'audit initial présentait la création d'une branche comme workflow actif et un état antérieur de `main`. Une note datée en tête clarifie que ces passages sont historiques.
- Les décomptes de pages admin et de fichiers dans le rapport d'octobre sont des instantanés historiques, pas une certification de l'arbre actuel.

## 4. Variables d'environnement et domaines
- L'inventaire précédent a relevé `NEXT_PUBLIC_SITE_URL=https://nnaxa.vercel.app`, différente des autres domaines référencés dans les métadonnées et documents.
- La recherche ciblée dans le dépôt n'a pas renvoyé d'occurrence de `NEXT_PUBLIC_SITE_URL`; `.env.example` ne déclare pas cette variable. **L'impact applicatif de l'écart n'est pas démontré.** La variable n'a pas été modifiée pour éviter de choisir arbitrairement un domaine canonique.
- Aucun secret ni valeur secrète n'est reproduit ici.

## 5. Vérifications de code et contrôles externes
- `src/lib/admin/require-admin-active.ts` vérifie l'identité authentifiée, le rôle `admin` et `profiles.actif === true`. Les anciennes observations disant qu'il ne vérifiait que le rôle sont obsolètes.
- L'inventaire antérieur compte 19 fichiers `page.tsx` sous l'administration; ce nombre n'est pas une preuve de fonctionnement de chaque écran.
- Les journaux Supabase consultés sur la fenêtre des dernières 24 heures n'ont pas renvoyé de lignes `ERROR`, `FATAL` ou `PANIC` dans la requête ciblée. Un événement SQLSTATE `08006` reste à qualifier par corrélation temporelle.
- **Contrôles après corrections :** l'alerte `duplicate_index` a disparu après retrait de `stocks_lots_id_uidx`; `stocks_lots_id_uq` demeure et reste utilisé par les contraintes. Deux fonctions SECURITY DEFINER exposées publiquement (`get_home_service_catalog`, `universe_partner_is_public`) ont été durcies avec `search_path=''` sans changer leurs droits d'exécution ni leurs résultats. Le linter signale encore 120 clés étrangères sans index couvrant, 95 index déclarés inutilisés et 59 groupes de politiques permissives.
- **Contrôle sécurité :** 6 tables avec RLS activée sans politique; l'inspection des privilèges confirme qu'`anon` et `authenticated` n'ont aucun droit direct sur ces tables, alors que `service_role` y accède — état cohérent avec des tables internes. Cinq fonctions `SECURITY DEFINER` restent exécutables par `anon`, mais deux ont été durcies sur `search_path`; 119 sont exécutables par `authenticated`, dont deux autres helpers durcis. La protection des mots de passe compromis reste désactivée. Ces alertes de linter ne prouvent pas à elles seules une exploitabilité. Un échantillon de fonctions `admin_*` vérifié contient un contrôle interne de rôle administrateur actif; il faut poursuivre par famille de fonctions avant de changer les privilèges.
- Les constats ne sont pas supprimés en masse : une correction aveugle pourrait changer les accès métier.
- Le build, les tests complets, la recette visuelle et l'état Production n'ont pas été validés par cette passe. Aucun déploiement manuel ni relance de workflow n'a été déclenché.

## 6. Statut honnête des étapes 0–7

| Étape | Statut | Preuve / limite |
|---|---|---|
| 0 — Référence Git et périmètre | 🟢 | Travail direct sur `main`; aucune branche créée. |
| 1 — Historique de conversations | 🟡 | Contexte/synthèses disponibles consultés; pas d'archive exhaustive de toutes les conversations. |
| 2 — Inventaire du dépôt | 🟢 inventaire | Comptage de l'arbre disponible; pas une lecture ligne par ligne de tous les fichiers. |
| 3 — Supabase/migrations | 🟢 pour les 6 migrations ciblées | Quatre versions présentes après écriture et vérification; autres migrations/contrats métier non certifiés par ce contrôle. |
| 4 — Documentation | 🟢 contradictions ciblées | Registre rétabli et rapport historique clarifié; l'ensemble des documents n'est pas intégralement réécrit. |
| 5 — Audit du code | 🟡 ciblé | Garde admin et fonctions concernées contrôlées; audit ligne par ligne complet non réalisé. |
| 6 — Logs | 🟡 ciblé | Pas d'ERROR/FATAL/PANIC dans la requête ciblée; SQLSTATE 08006 reste à qualifier. |
| 7 — Environnement | 🟡 impact non démontré | Écart de domaine documenté; aucun changement arbitraire; déploiement non testé. |

**Règle :** le vert signifie uniquement que le point précis indiqué est traité et vérifié, jamais une certification complète de NAXA.


## Audit 360° Promoteur — résolution d'une contradiction ACL (29/10/2026)
- La définition de `reactiver_promoteur(uuid,text)` peut réactiver un réseau complet, mais l'ACL effective de Production interdit EXECUTE à `anon`, `authenticated` et `service_role`; seul `postgres` est autorisé. La voie n'est donc pas accessible via l'API Supabase standard dans l'état contrôlé. Point clos sans changement de fonction ni de grants.
- Les deux RPC de règlement restent réservées à `service_role`. La contradiction restante n'est plus le privilège SQL : c'est la garantie d'identité dans leurs routes appelantes. Étape suivante unique : inspecter ces routes, prouver la liaison utilisateur/Promoteur et l'autorisation Admin avant de toucher au code.
- L'indexation/recherche GitHub n'a pas retourné de résultats de code pour ces symboles; cela ne prouve pas l'absence d'appelants. Ils restent non vérifiés jusqu'à lecture directe des fichiers pertinents.



## Audit 360° Promoteur — résolution de la contradiction sur les routes (29/10/2026)
- Les routes de soumission et de confirmation de règlement ont été localisées dans `src/app/promoteur/paiements/actions.ts` et `src/app/admin/pilotage/reglements/actions.ts`. L'identité n'est pas prise d'un champ libre : Promoteur = `auth.getUser().user.id`; Admin = utilisateur renvoyé par `requireAdminActive`, qui impose `role='admin'` et `actif=true`. Point clos pour la revue statique.
- Le test runtime multi-rôles reste à exécuter dans un environnement non-Production. Aucun test de fixture n'a été lancé sur Production.
- Reprise : partie 3 du Pilotage Promoteur (accréditation Responsable), sans revenir sur les routes déjà vérifiées.


## Audit 360° Promoteur — contradiction SQL à résoudre
La définition active de `private.naxa_promoteur_valide(uuid)` en Production est plus permissive que la définition du dépôt `migration_147` et le contrat du test 147 : elle ne vérifie ni architecture de convention, ni réseau actif, ni cohérence pharmacie/architecture. Le Promoteur actuellement présent en base passe les deux critères, mais cela ne supprime pas le risque de dérive. Localiser d'abord la redéfinition postérieure; aucun changement SQL n'est appliqué dans cette passe.


## Audit 360° Promoteur — réconciliation préparée, sans exécution Production (29/10/2026)
- Le helper `private.naxa_promoteur_valide(uuid)` actif en Production reste plus permissif que le contrat de la migration 147. Les migrations 149, 151, 152 et 153 consultées ne le redéfinissent pas directement; l'origine exacte de la dérive demeure inconnue.
- Une migration additive de réconciliation et un test ciblé sont désormais présents sur `main` : `supabase/migration_20261029_promoteur_validity_helper_reconciliation.sql` et `supabase/tests/promoteur_validity_helper_reconciliation.sql`. Ils ne sont **pas appliqués ni exécutés**.
- Le test ne sera pas lancé sur Production. La partie 3 reste non close jusqu'à validation sur un environnement non-Production accessible et exécution des cas comportementaux 028/147.


## Audit 360° Promoteur — divergence du replay isolé (29/10/2026)
- Le projet de test `naxa-ci-replay-2` n'est pas un miroir fidèle de la façade Production : `public.naxa_promoteur_valide(uuid)` y délègue directement au helper privé sans la garde `auth.uid()`/Admin attendue par le test 147.3 et le test PVH.4.
- Le helper privé réconcilié passe un contrôle ciblé des trois gardes métier (architecture, réseau actif, cohérence pharmacie/architecture) et des ACL (aucun EXECUTE pour `anon`, `authenticated`, `service_role`). Le test comportemental 028 passe également sur le replay.
- Les tests complets 147/PVH restent bloqués par la façade de replay, non par les assertions du helper. La tentative d'application de la migration 040 sur ce projet a été refusée par le contrôle de sécurité de l'outil; ne pas boucler sur la même opération. La prochaine action doit réaligner le replay avec les migrations canoniques disponibles, puis rejouer les tests.
- Production n'a pas été modifiée : la migration corrective du helper est toujours préparée dans le dépôt, non appliquée. La partie 3 reste partielle jusqu'aux tests complets et cas limites.


## Réconciliation façade Promoteur — test non-Production (29/10/2026)

- La façade publique ancienne du projet de test `naxa-ci-replay-2` a été réalignée via une migration de diagnostic dédiée; tests statiques 147 et PVH PASS. Ce correctif ne constitue pas une migration canonique appliquée à Production.
- Production conserve sa façade publique avec garde identité/Admin, mais le helper privé actif ne satisfait pas encore le contrat de garde architecture/réseau/cohérence de la migration 147. Correction helper non appliquée en Production.
- ACL test vérifiées : `anon` ne peut exécuter la façade; `authenticated` et `service_role` le peuvent avec contrôle interne; aucun des trois ne peut exécuter le helper privé.
- Restent ouverts : tests comportementaux ciblés architecture absente/réseau inactif/incohérence; partie 3 reste partielle. Aucun déploiement ni workflow relancé.


## Promoteur — clôture de la réconciliation test et transition partie 4 (29/10/2026)

- La contradiction de façade publique sur le projet de test `naxa-ci-replay-2` est levée et le sous-chantier de réalignement du replay est clos. Les assertions SQL ciblées 147/PVH sont PASS; le test comportemental 028 a été relancé avec rollback confirmé.
- Cette clôture n'équivalait pas à la certification globale de la partie 3. Les cas comportementaux limites restent ouverts et le helper privé Production demeure divergent; aucune migration Production n'a été appliquée.
- La partie 4 est maintenant en revue statique : gestion Caisse, quotas, délégation et périmètres. Un point à qualifier concerne l'absence de filtre explicite `target.actif` dans `naxa_can_manage_team_member`; aucun défaut n'est déclaré avant lecture de `naxa_set_caisse_status` et tests de transition.
- Les tests 029–031 n'ont pas été exécutés dans cette passe; aucun contournement de trigger, déploiement ni workflow relancé.


## Partie 4 Promoteur — replay incomplet de la garde d'activation (29/10/2026)
- Les tests exacts 147, PVH et 141 passent sur le replay non-Production après réalignement de la façade.
- Le test 156 échoue uniquement parce que le replay ne contient ni la fonction de garde ni son trigger. Une vérification directe confirme que les deux existent en Production. Il faut aligner le replay par la migration canonique avant de conclure sur le test 156; aucune migration Production n'est requise pour cette vérification.
- Le point `target.actif` de `naxa_can_manage_team_member` ne constitue pas, à lui seul, un défaut : la réactivation passe par un privilège spécifique, puis par les gardes d'architecture et de quota; la suspension passe par son propre privilège.
- Les tests transactionnels 029–031 restent non exécutés; aucun contournement ni écriture Production.


## Partie 4 — statut Caisse et permissions de service (29/10/2026)
- La revue live de `private.naxa_set_caisse_status` confirme que la réactivation passe par `REACTIVATE_CAISSE`, vérification d'architecture niveau 3 et quota; la suspension passe par `SUSPEND_CAISSE`. Le helper de management accepte les cibles inactives pour permettre leur réactivation, mais exige acteur actif, descendant direct, fonction/niveau cohérents, pharmacie identique et lien réseau actif pour le Promoteur. Pas de défaut confirmé sur `target.actif`.
- Les façades de gestion Caisse disposent de droits EXECUTE pour `authenticated` et `service_role`, sans EXECUTE `anon`. Le code interne vérifie l'identité et les autorisations métier; l'utilité du grant `service_role` reste à justifier dans les migrations canoniques. Ce point est à examiner, pas à qualifier de vulnérabilité démontrée.
- Les tests 029/030/031 n'ont pas été exécutés parce qu'ils utilisent un contournement de triggers par `session_replication_role`; aucun contournement n'a été fait. Le replay ne contient pas la garde 156 pourtant présente en Production.
- Revue statique du statut Caisse clôturée; partie 4 non certifiée avant tests comportementaux sûrs et réconciliation ACL ciblée. Aucune modification Production.
