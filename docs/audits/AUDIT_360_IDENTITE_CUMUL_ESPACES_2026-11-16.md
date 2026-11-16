# Audit 360 — Identité unique et cumul des espaces Pharmacie ↔ SPD

**Date :** 16 novembre 2026  
**Dépôt :** `audreymendomo23-netizen/NAXA`  
**Branche :** `main`  
**Base d'exécution SQL :** Replay `pwfftcsjyeibxxqhwysw`  
**Production :** non touchée  
**Déploiement :** aucun

## 1. Mandat et résultat recherché

Livrer une identité NAXA unique qui conserve son espace Client personnel et peut activer plusieurs espaces professionnels indépendants, un seul à la fois. Le cumul Pharmacie↔SPD doit exiger l'accord de toutes les organisations concernées, l'arbitrage Admin quand le candidat est Promoteur, et les contrôles réglementaires/habilitations séparés.

La révocation d'une affectation professionnelle ne supprime jamais l'identité Auth ni l'espace Client. Un verrou d'abonnement est limité à l'espace professionnel concerné.

## 2. État initial et causes racines

L'audit du code et du schéma Replay a révélé les écarts suivants :

1. Le sélecteur actif existait, mais le SPD n'était pas résolu comme espace professionnel distinct.
2. Le SPD utilisait `partners.partner_type='professionnel_domicile'` et `partner_members` (`owner/manager/operator`), alors que les fonctions partenaires initiales étaient orientées Parapharmacie.
3. Le provisionnement Admin pouvait créer une identité Auth au lieu de réutiliser un profil existant.
4. Les affectations Pharmacie étaient attribuées directement ; le cumul SPD devait être vérifié avant le grant.
5. Le verrou d'abonnement pouvait agir sur `profiles.actif`, ce qui risquait de bloquer l'identité entière et Client.
6. La révocation d'une source d'affectation devait invalider les approbations précédentes et recalculer les Promoteurs attendus.
7. Les politiques RLS de réservations/ordonnances et Storage permettaient à certains rôles professionnels de lire des données personnelles de membres de leur organisation.
8. Certaines décisions d'approbation et politiques Admin n'étaient pas suffisamment liées au contexte d'espace actif.

## 3. Corrections livrées

### Identité et provisionnement
- Recherche d'un profil existant par username et téléphone normalisé.
- Concordance des informations d'identité avant réutilisation.
- Réutilisation du même Auth ID ; création Auth réservée aux nouveaux profils.
- Espace Client disponible dès que les prérequis d'identité Client sont complets, indépendamment des rôles professionnels.
- Contexte Admin désactivé lorsque l'identité est dans Client ; réactivation uniquement après retour dans Admin.

### Cumul Pharmacie ↔ SPD
- Demande Pharmacie→SPD et SPD→Pharmacie.
- Une approbation distincte par organisation source active.
- Absence de réponse = attente ; aucun consentement implicite.
- Un seul refus = refus global.
- Promoteur candidat : arbitrage Admin, aucune auto-approbation.
- SPD→Pharmacie : accord du propriétaire SPD avant activation de l'affectation.
- Contrôle de l'autorité et du contexte actif au moment de la décision.
- Révocation/changement d'affectation source : annulation, invalidation des anciennes approbations et recalcul du nouveau groupe d'approbateurs.
- Notifications in-app persistantes ; push asynchrone.

### Sélecteur et notifications
- RPC `naxa_list_accessible_spd_workspaces` : retourne seulement les memberships SPD actifs, payés et autorisés de l'identité courante.
- `EspaceNaxaSwitcher.tsx` consomme cette RPC.
- Les notifications de cumul conduisent vers `/naxa/cumuls`.
- La page ne montre les décisions que dans le bon contexte : Promoteur, SPD correspondant ou Admin.

### Confidentialité Client et RLS
- Helpers `private.naxa_client_identity_is_staff_of_pharmacy` et `private.naxa_client_identity_is_partner_member`.
- Client ne lit ses réservations/ordonnances personnelles que dans son contexte Client.
- Employeur et personnel pharmacie ne lisent pas les dossiers personnels d'un membre affecté à cette pharmacie.
- Pharmacien ne lit pas le fichier d'ordonnance personnel d'un membre de la même pharmacie.
- Un partenaire SPD ne lit pas les réservations Client personnelles de ses membres.
- Les enfants de réservations héritent de la visibilité du parent.
- Les policies Admin utilisent le contexte Admin actif ; les policies professionnelles sensibles utilisent les fonctions d'espace actif.

## 4. Migrations Replay appliquées et versionnées

Migrations principales :
- `20261116191135_naxa_identity_client_and_spd_workspace`
- `20261116191403_naxa_spd_active_role_profile_compat`
- `20261116191719_naxa_cumulative_activity_cross_approval`
- Correctifs de demandes/notifications/autorité/arbitrage/réconciliation : `20261116191751`, `20261116191809`, `20261116191857`, `20261116192448`, `20261116192636`, `20261116192700`, `20261116192834`, `20261116192929`
- Verrou commercial / continuité identité / révocation : `20261116193330`, `20261116193348`, `20261116193535`, `20261116193552`, `20261116193603`, `20261116193809`, `20261116194008`, `20261116194147`
- `20261116194956_naxa_cumulative_source_reconciliation_guards`
- `20261116195501_naxa_admin_client_identity_workspace_access`
- `20261116195526_naxa_admin_client_context_resolution`
- `20261116195628_naxa_list_authorized_spd_workspaces`
- `20261116200105_naxa_client_personal_data_workspace_isolation`
- `20261116200551_naxa_cumulative_decisions_require_active_workspace`
- `20261116200725_naxa_cumulative_decision_context_mismatch_is_denied`

Les fichiers de migration correspondants sont présents dans `supabase/migrations/` sur `main`. Aucune de ces migrations n'a été appliquée à Production.

## 5. Recette SQL E2E Replay

**5 suites exécutées**

| Suite | Scénarios prouvés | Résultat |
|---|---|---|
| `20261116_naxa_identity_cumulative_replay.sql` | Deux sens du cumul, arbitrage Admin, bypass grant, bascule Client/SPD, verrou commercial, accréditation | PASS |
| `20261116_naxa_cumulative_multi_promoter_reconciliation_replay.sql` | Deux Promoteurs, attente, notifications, révocation partielle, recalcul, refus | PASS |
| `20261116_naxa_cumulative_rls_replay.sql` | RLS, isolation, permissions RPC, écriture directe bloquée, contexte Client refusé pour approbation | PASS |
| `20261116_naxa_admin_client_workspace_replay.sql` | Admin→Client sans privilèges Admin, retour Admin | PASS |
| `20261116_naxa_client_data_privacy_replay.sql` | Confidentialité réservations, ordonnances, fichiers et données SPD des collaborateurs | PASS |

Toutes les suites utilisent `BEGIN` / `ROLLBACK`. Les profils, partenaires, réservations, documents et verrous synthétiques ne sont pas conservés.

## 6. Vérifications de sécurité

- RPC cumul : exécution autorisée à `authenticated`, pas à `anon`.
- Tables cumul : RLS activée ; les statuts ne sont pas modifiables directement par le client.
- Notifications : lecture limitée au destinataire.
- Helpers privés : `SECURITY DEFINER` avec `search_path='' `.
- Sélecteur SPD : liste serveur limitée aux espaces payés et actifs.
- Décision : contexte actif obligatoire ; mauvais contexte renvoie un refus d'autorisation et ne clôture pas la demande.

Les advisors Supabase signalent encore des constats préexistants à examiner sur d'autres tables/policies ; ils ne sont pas assimilés à une validation de sécurité globale de tout NAXA. Le présent audit prouve uniquement le périmètre décrit.

## 7. État des contrôles applicatifs et de livraison

- Les modifications applicatives sont versionnées sur `main`.
- Un test statique `scripts/test-identity-cumulative-workspaces.cjs` a été ajouté au lot `npm test`.
- Les workflows GitHub `naxa-quality` (tests, TypeScript, lint, build) et `naxa-replay-promoteur-secret-safe-v2` (recette navigateur Replay) ont été déclenchés par les changements applicatifs. Leurs résultats finaux doivent être consultés avant le statut final de livraison.
- Les cinq suites SQL Replay sont passées, mais elles ne remplacent pas le résultat de la recette navigateur.

## 8. Décision d'audit

**Développement de la couche identité/cumul/RLS : implémenté et prouvé sur Replay.**  
**Livraison globale : en attente des workflows GitHub et de la recette navigateur.**  
**Production : non migrée.**  
**Vercel : aucun déploiement.**  
**Play Store : aucun usage.**

Ne pas déclarer le chantier globalement vert tant que les workflows GitHub n'ont pas terminé avec succès. Si un contrôle échoue, corriger la cause et relancer. Toute migration Production ou publication reste une décision distincte et nécessite une autorisation explicite.
