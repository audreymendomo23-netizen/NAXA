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


## Audit de mise au vert — 7 octobre 2026

**État réel contrôlé contre GitHub + Vercel + Supabase. Cette section supersède les informations historiques de Production ci-dessus lorsqu'elles divergent.**

- **GitHub / main :** HEAD réel = `c171b5465b423d3c576d22ef48c99af5d59ba5f7` (`Add files via upload`), créé le 7 octobre 2026 à 09:48 UTC. Ce commit ajoute notamment le cahier v3.7 et le prompt maître de fusion v2.
- **Vercel / Production :** le projet `naxa` a actuellement un déploiement Production **READY** `dpl_HxzyGDhYhiLLeagQBeYNPrMrCjv4`, issu de **main / c171b5465b423d3c576d22ef48c99af5d59ba5f7**. Le commit de Production historique `5ad95ce...` n'est donc plus le déploiement courant.
- **Écart de gouvernance :** le prompt maître v2 exige « OUI, DÉPLOIE » avant toute Production. Aucun tel accord n'est constaté dans l'état des ressources contrôlées. Le déploiement automatique de ce commit doit donc être traité comme un **écart de processus**, sans le considérer comme une validation fonctionnelle.
- **GitHub CI :** le statut combiné observé sur `c171b546...` ne rapporte qu'un statut **Vercel = success**. Aucun workflow GitHub Actions associé à ce commit n'a été retourné par le contrôle disponible. **La CI qualité n'est donc pas prouvée verte.**
- **Supabase Production :** projet `eouwtuusnsuxaejsxknf`, état `ACTIVE_HEALTHY`, PostgreSQL 17.11. La base contient **29 migrations** et la plus récente est `20261007090927 / 041_promoteur_validite_facade_invoker`. Les migrations 038 à 041 sont réellement présentes en base. Toute documentation indiquant « 013 et suivantes non appliquées » est obsolète.
- **Contrôle RLS :** les tables publiques contrôlées disposent de RLS activé, notamment `promoteur_pharmacies`, `naxa_privileges`, `naxa_role_privileges`, `naxa_architecture_privileges` et `naxa_profile_privileges`.
- **Contrôle CA :** la vue `v_reservations_ca` existe et agrège les réservations de statut `payee` ou `retiree`. La preuve actuelle confirme l'existence du moteur, mais ne suffit pas à déclarer le scénario anti-double-comptage 100 % vert.
- **Branches / PR :** PR #24 reste ouverte et non mergeable ; PR #25 (Promoteur Partie 3) est ouverte vers `consolidation). Aucune de ces PR n'est une preuve de Production verte.
- **Verdict mise au vert : 🔴 NON VERT.** Les preuves manquantes principales sont : CI qualité réellement exécutée et observée, réconciliation documentaire, réconciliation branche/Production, puis tests comportementaux complets du chantier Pilotage 360° avant toute déclaration à 100 %.

**Règle de travail :** aucune migration Supabase supplémentaire, aucun merge vers `main` et aucun nouveau déploiement Production ne doit être effectué pour contourner ces écarts. Les corrections suivantes doivent rester sur branche jusqu'à obtention des preuves requises et autorisation explicite de Production.
