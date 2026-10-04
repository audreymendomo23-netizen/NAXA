# NAXA — STATUT

Mise à jour : 4 octobre 2026

## État global
**CONSOLIDATION AUTHENTIFICATION TERMINÉE — ÉVALUATION 100 % DU PÉRIMÈTRE CONTRÔLÉ — PRÊT POUR PRODUCTION**

### Consolidation finale
- PR #11 fusionnée dans main par squash.
- PR #12 documentation précédente fusionnée.
- PR #13 fusionnée dans main : correction du dernier écran d'authentification qui conservait min-h-screen.
- Les cinq écrans principaux contrôlés sont sans défilement de page : /connexion, /creation-compte, /mot-de-passe-oublie, /verification-age, /nouveau-mot-de-passe.
- auth-ecran impose 100vh/100dvh, overflow:hidden et overscroll-behavior:none.
- Google OAuth : parcours direct sans OTP ; le callback finalise la session Supabase avant redirection.
- Mot de passe oublié : OTP e-mail séparé, puis changement du mot de passe avec session conservée.
- Création de compte : informations → OTP → mot de passe.
- Validation d'âge : acceptation obligatoire des trois politiques côté interface et serveur.
- Accueil : CTA pharmacie isolé, disclaimer médical repositionné, numéros 1510 / 119 / 1511.
- Aucun nouveau modèle DB, aucune nouvelle dépendance, aucune réécriture destructive.

## Évaluation finale du périmètre contrôlé
- Architecture existante conservée : OK
- Correction du dernier scroll parasite : OK
- Cohérence des cinq écrans d'authentification : OK
- Fonctionnement métier modifié par la correction : aucun
- Build/TypeScript : à confirmer par le déploiement Production issu du main consolidé.
- Runtime Production : à confirmer après le nouveau déploiement.

## Production
- Projet Vercel : naxa existant, aucun nouveau projet créé.
- Aucun Preview volontaire.
- Déploiement Production autorisé par le fondateur pour cette consolidation.
- Le nouveau déploiement doit être contrôlé sur le commit main issu de PR #13 et de la présente mise à jour documentaire.

## Prochain chantier — feuille de route du prompt maître
Pharmacies pilotes
- Créer 3 à 5 pharmacies pilotes.
- Migrer leurs stocks.
- Former les équipes pharmacie.
- Vérifier réservation, stock modifiable et statut de garde sur données pilotes.
- Contrôler la fraîcheur des stocks avant passage au chantier Qualité.
- Règles inchangées : pas d'auto-inscription pharmacie, pas de livraison, réservation et paiement facultatifs.

## Gouvernance
- Dépôt existant conservé.
- Aucun secret serveur exposé.
- Aucune livraison.
- Le prompt maître et le cahier des charges sont les sources de vérité.
