# NAXA — Registre des contradictions et preuves opérationnelles
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
