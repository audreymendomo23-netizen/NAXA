# NAXA — STATUT

Mise à jour : 5 octobre 2026 — architecture Promoteur / Caisses

## État global
**AUTHENTIFICATION VALIDÉE. ARCHITECTURE PHARMACIE PROMOTEUR / CAISSES CONSOLIDÉE. PRODUCTION VALIDÉE. MISE EN SERVICE TERRAIN À EXÉCUTER.**

### Consolidation finale
- PR #11 fusionnée dans main par squash.
- PR #12 documentation précédente fusionnée.
- PR #13 fusionnée dans main : correction du dernier écran d'authentification qui conservait min-h-screen.
- PR #15 fusionnée dans main : correction UX finale de /creation-compte.
- /creation-compte : bandeau « Les plus recherchés » masqué.
- /creation-compte : titre et introduction recentrés et compactés.
- /creation-compte : scroll de page interdit via auth-ecran.
- /creation-compte : téléphone corrigé avec sélecteur compact drapeau + indicatif ; les noms de pays apparaissent uniquement dans le sélecteur ouvert.
- /creation-compte : numéro national séparé, longueur contrôlée selon le pays et coches jaunes de validation pour les informations correctement renseignées.
- /mot-de-passe-oublie : vérification serveur de l’existence du compte avant envoi d’OTP ; compte inexistant = erreur, aucune étape OTP proposée.
- PR #17 fusionnée dans main.
- Les cinq écrans principaux contrôlés sont sans défilement de page : /connexion, /creation-compte, /mot-de-passe-oublie, /verification-age, /nouveau-mot-de-passe.
- auth-ecran impose 100vh/100dvh, overflow:hidden et overscroll-behavior:none.
- Google OAuth : parcours direct sans OTP ; le callback finalise la session Supabase avant redirection.
- Mot de passe oublié : OTP e-mail séparé, puis changement du mot de passe avec session conservée.
- Création de compte : informations → OTP → mot de passe.
- Validation d'âge : acceptation obligatoire des trois politiques côté interface et serveur.
- Accueil : CTA pharmacie isolé, disclaimer médical repositionné, numéros 1510 / 119 / 1511.
- Aucun nouveau modèle DB, aucune nouvelle dépendance, aucune réécriture destructive.

## Évaluation finale du périmètre contrôlé — consolidation PR #21
- Architecture Promoteur/Caisses : OK
- Séparation pharmacie unique / comptes enfants : OK
- Création du Promoteur depuis `/admin` : OK
- Gestion des Caisses par le Promoteur : OK
- Blocage/réactivation d'une Caisse : OK
- Contrôle d'accès des comptes désactivés : OK
- Schéma Supabase correspondant : OK
- Migrations 007/008 présentes et appliquées sur Naxa : OK
- Production Vercel issue de `main` : READY
- Contrôle post-déploiement : aucun log runtime error/fatal trouvé sur 30 min
- **Score de consolidation : 100 %**

## Évaluation finale du périmètre contrôlé — historique
- Architecture existante conservée : OK
- Correction du dernier scroll parasite : OK
- Cohérence des cinq écrans d'authentification : OK
- Fonctionnement métier modifié par la correction : aucun
- PR #15 fusionnée : OK
- Build Production : compilation Next.js réussie ; contrôle TypeScript lancé sans erreur bloquante : OK
- Déploiement Production sur projet Vercel existant : READY : OK
- URL /creation-compte en Production : HTTP 200 : OK
- Aucun Preview volontaire : OK
- Secrets serveur non exposés : OK
- Score final : 100 %

## Production
- Projet Vercel : `naxa` existant, aucun nouveau projet créé.
- Déploiement Production courant : `dpl_CcFGneLjZjBSLQ32Mccww6vjwAD6` — **READY**.
- Commit Production : `5ad95ce30dd43b3c140e0048606c81dd5143e490`.
- Alias : `naxa-opal.vercel.app`, `naxa-naxa3.vercel.app`.
- Déploiement issu de `main` après fusion PR #21.
- Statut GitHub Vercel : SUCCESS.
- Aucun nouveau projet Vercel et aucun Preview volontaire.

## Architecture comptes pharmacie — validée comme évolution métier
- Le prompt maître impose une pharmacie créée par NAXA puis autonome ; cette évolution précise cette autonomie sans créer de sous-pharmacies.
- **Promoteur** : compte parent de la pharmacie, gère les comptes enfants.
- **Caisse** : compte enfant, opérationnel, partage exactement le stock et les réservations de la pharmacie.
- Côté client : une seule pharmacie visible, indépendamment du nombre de caisses.
- Le Promoteur peut créer, bloquer et réactiver ses caisses ; un blocage ne désactive pas la pharmacie.
- Formation terrain : utiliser les comptes Caisse pour l'apprentissage de l'import et de la gestion de stock.
- PR #21 fusionnée dans `main` par squash : architecture Promoteur parent / Caisses enfants.
- Migrations 007/008 préparées et appliquées au projet Supabase NAXA ; aucun compte réel n'est créé automatiquement par ce chantier.
- Le schéma Supabase contient désormais les rôles `promoteur` et `caisse`, `parent_profile_id` et `actif` sur `profiles`.
- Le compte créé par `/admin` est désormais destiné au Promoteur ; le Promoteur dispose d'un espace de gestion de ses Caisses.
- Évaluation finale du périmètre PR #21 : **100 %**.
- Déploiement Production PR #21 : **READY** sur le projet Vercel existant `naxa`.
- Commit Production : `5ad95ce30dd43b3c140e0048606c81dd5143e490`.
- Déploiement : `dpl_CcFGneLjZjBSLQ32Mccww6vjwAD6`.
- Statut GitHub Vercel : SUCCESS.
- Contrôle runtime post-déploiement : aucun log `error`/`fatal` trouvé sur les 30 premières minutes contrôlées.

## Prochain chantier — feuille de route du prompt maître
**Mise en service terrain des pharmacies pilotes — prochain jalon réel.**
- Identifier 3 à 5 pharmacies pilotes réelles.
- Créer leurs comptes Promoteur via `/admin`.
- Faire créer/activer par chaque Promoteur les comptes Caisses de son équipe.
- Migrer leurs stocks réels via l'import existant.
- Vérifier prix, quantités, péremptions, formats et fraîcheur.
- Former les équipes sur réservations, stock, garde et mode hors connexion.
- Tester le parcours complet sur données réelles.
- Passer ensuite au chantier Qualité.
- Règles inchangées : pas d'auto-inscription pharmacie, pas de livraison, réservation et paiement facultatifs.

## Gouvernance
- Dépôt existant conservé.
- Aucun secret serveur exposé.
- Aucune livraison.
- Le prompt maître et le cahier des charges sont les sources de vérité.


## Chantier consolidation — Pilotage 360°
- Branche : `consolidation`, PR #23.
- Architecture N1 NAXA / N2 Promoteur / N3 Caisse implémentée.
- Migration additive `009_pilotage_360.sql` syntaxiquement validée dans une transaction annulée ; aucune migration de production appliquée.
- Dashboards, rapports, BI, lots/péremptions et préparation e-mail ajoutés.
- Contradiction E08 corrigée : les parcours recherche → fiche → panier alimentent maintenant réellement `evenements` via `log_evenement`, sans supprimer `recherche_events`.
- Aucun merge `main`, aucun déploiement Production.
- Les tests réels mobile, Realtime et e-mail restent à prouver par le fondateur.
- Prochaine autorisation de déploiement : phrase exacte **OUI, DÉPLOIE**.

## Chantier — validité commerciale des pharmacies
- Branche : `feat/pharmacie-validite-pilotage`, basée sur la consolidation PR #23.
- Audit : le pilotage 360 possédait déjà `abonnements` et le MRR, mais pas le cycle complet échéance → rappel J-5 → blocage → règlement → réactivation.
- Ajout additif : migration `010_validite_pharmacies.sql`, historique des règlements, échéance mensuelle standard 30 000 FCFA, statut impayé, blocage pharmacie + comptes Promoteur/Caisse, réactivation administrative.
- Côté client : stocks des pharmacies inactives masqués ; recherche et réservation restent protégées par `pharmacies.actif`.
- N1 Admin : `/admin/pilotage/validite` connecté au Pilotage 360.
- Notification : endpoint `/api/cron/validite`, protégé par `CRON_SECRET`, rappel J-5 au Promoteur via Resend ; claim atomique anti-doublon concurrent (`rappel_5j_en_cours_at`).
- Orchestration quotidienne : workflow GitHub Actions `.github/workflows/naxa-validite.yml` à 06:00 UTC, avec `NAXA_CRON_URL` et `CRON_SECRET` fournis par secrets ; aucun secret n’est commité.
- CI qualité étendue aux PR ciblant `main` et `consolidation`.
- Écran de suspension ajouté pour les comptes pharmacie bloqués.
- Aucun merge `main`, aucune migration Production et aucun déploiement Production.

## Verrou Supabase — validité exécuté
- Prérequis `009_pilotage_360` détecté absent de Supabase malgré sa présence dans le dépôt ; appliqué avant `010`.
- `010_validite_pharmacies` a d’abord révélé une erreur de quoting dans `reserve_stock`; le fichier de branche a été corrigé puis la migration appliquée avec succès.
- Vérification réelle : migrations `009` et `010`, tables, fonctions et trigger d’initialisation présents.
- État réel : 3/3 pharmacies ont un abonnement actif à 30 000 FCFA/mois, échéance 4 novembre 2026 ; aucun paiement fictif enregistré.
- Aucun merge `main` et aucun déploiement applicatif effectué.

## Chantier — limite de sessions par compte
- Règle métier validée : maximum 4 sessions/appareils simultanés par compte.
- Les 4 sessions existantes restent actives ; aucune déconnexion automatique des anciennes sessions.
- Une 5e tentative de connexion par mot de passe est refusée avec un message explicite.
- Le parcours Google OAuth applique la même limite ; si la 5e session est créée pendant le callback, elle est immédiatement révoquée, sans toucher aux 4 précédentes.
- Migrations additives 011_limite_sessions.sql et 012_enforcement_limite_sessions.sql appliquées à Supabase.
- Enforcement DB atomique sur auth.sessions avec verrou transactionnel par utilisateur : une 5e session ne peut pas être créée, y compris sous connexions concurrentes.
- La vérification applicative reste présente uniquement pour fournir un message UX explicite.
- État de sécurité vérifié : anon et authenticated n'ont pas EXECUTE sur la fonction ; service_role uniquement.
- Aucun changement de mot de passe, de rôle, de profil ou de donnée métier ; aucun merge main et aucun déploiement applicatif effectué.