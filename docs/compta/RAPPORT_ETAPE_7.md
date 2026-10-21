# Rapport d’étape 7 — Documents, journal d’audit, profil et déconnexion

Date : 21 octobre 2026  
Branche : `main`  
Référence : `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md`, sections 3, 4.9–4.12, 5, 6, 8 et 9.  
Statut : **CODE INTÉGRÉ — VALIDATION FRONTEND NON EXÉCUTÉE — PARCOURS ET RLS PARTIELLEMENT VÉRIFIÉS**.

## 1. Parcours livrés dans cette tranche

### Journal d’audit — `/pharmacie/comptable/journal-audit`
- Authentification et profil actif vérifiés côté serveur.
- Vérification du privilège `MANAGE_ACCOUNTING`.
- Requête bornée par `pharmacie_id`, 200 événements maximum, filtres de date et d’action.
- Colonnes limitées à l’horodatage, acteur abrégé, action, objet, résultat et motif.
- Lecture seule ; aucune modification du journal ni exposition de `hash_payload`.

### Profil et déconnexion — `/pharmacie/comptable/profil`
- Affiche l’identité du compte, l’e-mail d’authentification, la fonction interne, le rôle technique, la pharmacie et l’état actif.
- Aucun formulaire de modification du rôle, de la pharmacie ou des privilèges.
- Action serveur de déconnexion via `supabase.auth.signOut()`, puis redirection vers `/connexion`.
- L’échec de déconnexion renvoie un message explicite.
- Le changement de mot de passe n’est pas réimplémenté ici : il reste délégué au mécanisme d’authentification NAXA.

### Documents — `/pharmacie/comptable/documents`
- Liste en lecture seule des rapports liés à la pharmacie.
- Liste des rappels de lots avec métadonnées non cliniques.
- Pas de génération de faux PDF ni de liens de fichiers supposés.
- Les reçus d’abonnement sont explicitement signalés comme indisponibles au Comptable avec les privilèges actuels, au lieu d’être lus via une clé de service ou de contourner RLS.
- Le tableau de bord relie les trois pages de cette tranche.

## 2. Contrôle RLS ciblé sur l’environnement isolé

Projet de test : `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`). Aucune migration ni modification n’a été appliquée à la base active.

Observations du catalogue Postgres :
- `compta_audit` : RLS activée ; politique de lecture `compta_scope_autorise(pharmacie_id)`, sans politique d’écriture affichée.
- `rappels_lots` : RLS activée ; politique de lecture limitée à l’administration ou à `can_access_pharmacy(pharmacie_id)`.
- `rapports` : RLS activée ; lecture bornée à la pharmacie via `can_access_pharmacy` ou à l’administration.
- `abonnement_paiements` : RLS activée, mais la politique observée est réservée à `is_admin()`. Le parcours Comptable n’essaie donc pas de lire ces données.
- `profiles` : des privilèges SQL UPDATE/DELETE existent au niveau de table, tandis que les politiques observées restreignent ces actions à l’administration ou à des cas métier spécifiques (notamment gestion d’enfants du Promoteur). Ce constat nécessite des tests négatifs par identité ; le seul catalogue ne prouve pas l’absence de contournement.
- Le test ciblé précédent `164_compta_reports_rls.sql` a réussi sur l’environnement isolé. Il ne remplace pas une vérification complète des rôles métier.

Ces observations ne constituent pas une certification complète de RLS par rôle. L’environnement isolé ne contient pas les profils de test nécessaires pour simuler proprement Comptable, Promoteur, Caisse, Pharmacien et Gestionnaire de stock.

## 3. Limites restantes — ne pas déclarer l’étape entièrement certifiée

- Factures fournisseurs et pièces justificatives : aucune table de documents ou de métadonnées de fichiers correspondant à ce parcours n’a été confirmée dans le schéma inspecté. Aucun lien de stockage n’est inventé.
- Reçus d’abonnement : lecture Comptable bloquée par la politique actuelle d’`abonnement_paiements`. Une politique de lecture dédiée, une vue sécurisée ou une RPC métier devra être décidée et testée avant activation.
- Historique des téléchargements : la page d’audit montre les événements existants. La couverture de chaque type de consultation/téléchargement dépend de l’émission effective de l’événement par le serveur ; elle n’est pas prouvée pour tous les écrans.
- Le workflow de bordereaux (préparation, validation Promoteur, dépôt, paiement), rejets, relances et tâches n’est pas activé faute de privilèges atomiques et de RPC confirmés.
- Vérification complète des permissions RLS/RPC par rôle et par pharmacie : NON TERMINÉE.
- Tests navigateur, typecheck, lint, build et compilation des Server Actions : NON EXÉCUTÉS.
- CI : NON CONSULTÉE / NON LANCÉE.
- Base active : NON MODIFIÉE.
- Déploiement : NON EFFECTUÉ.

## 4. Fichiers ajoutés ou modifiés

- `src/app/pharmacie/comptable/journal-audit/page.tsx`
- `src/app/pharmacie/comptable/profil/page.tsx`
- `src/app/pharmacie/comptable/documents/page.tsx`
- `src/app/pharmacie/comptable/page.tsx` — navigation ajoutée
- `docs/compta/RAPPORT_ETAPE_7.md`

## 5. Suite logique

1. Créer des profils dédiés sur une base de test isolée et exécuter les tests négatifs par rôle/pharmacie.
2. Auditer les privilèges de table et politiques RLS de `profiles`, paiements d’abonnement, rapports, documents et toutes les RPC invoquées par le poste Comptable.
3. Arbitrer un accès lecture minimal aux reçus d’abonnement et une source réelle pour les documents.
4. Construire le workflow des bordereaux, validations Promoteur, rejets, relances et tâches avec privilèges atomiques distincts et piste d’audit.
5. Exécuter typecheck, lint, build et tests UI sur le HEAD exact avant toute revendication de conformité.

Aucune étape de ce rapport n’autorise l’application des migrations à la base active ni le déploiement.
