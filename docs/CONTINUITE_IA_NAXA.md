# NAXA — Continuité opérationnelle IA
Dernière mise à jour : 2026-10-13

## Règles impératives
- Déclencheur « Rappel » : relire ce document, vérifier l'état réel GitHub/CI, comparer avec le dernier point, puis reprendre sans refaire inutilement le travail.
- Aucune nouvelle branche. Aucun brouillon de PR. Ne jamais contourner un refus d'outil.
- Les seuls commits autorisés par défaut sont ceux qui créent ou mettent à jour ce document de continuité. Aucun commit de code, configuration, migration ou fonctionnalité sous cette autorisation.
- Travailler une branche existante à la fois. Vérifier les preuves réelles avant d'annoncer un résultat. Ne jamais déclarer CI verte sans logs correspondant au SHA exact.
- Ne pas modifier directement main, ne pas fusionner et ne pas déployer sans autorisation explicite. Production Supabase reste en lecture seule.
- Après chaque réponse concernant NAXA, mettre à jour ce document sur les branches du périmètre actif, avec état vérifié, preuves, blocages et prochaine action autorisée.
- Méthode : audit → contradictions → cause racine → correction ciblée (uniquement après autorisation) → tests/preuves → documentation → CI verte → validation utilisateur → intégration autorisée → vérification → suppression de la branche terminée.

## Chevauchements d'authentification identifiés
- Inscription/téléphone : `fix/signup-phone-validation` (validation 073), `fix/signup-trigger-production` (déclencheur/migration 074) et `feat/naxa-messagerie-profil-yaounde` (PR #56, onboarding et correctif téléphone). Même domaine et cause apparentée, mais périmètres techniques distincts ; vérifier les commits/migrations pour confirmer le chevauchement exact.
- OTP : `fix/auth-restore-otp-flow` (PR #57, restauration du modèle OTP) puis `fix/auth-signup-feedback-otp` (PR #58, compte à rebours, renvoi et erreurs). Branches empilées : complémentaires, pas strictement identiques.
- Identité visuelle : `feat/auth-water-bubbles` (PR #59, bulles animées) puis `feat/auth-visual-identity` (PR #60, composants et parcours visuel). Branches empilées et complémentaires.
- Sessions : `feat/session-audit` (PR #42, audit SQL) et `feat/login-session-limit` (PR #43, réponse de connexion et journalisation). Même fonctionnalité globale, couches DB/application complémentaires.
- Navigation/connexion : `fix/accueil-footer-signature-verte` (PR #54) et `feat/logo-navigation-role` (PR #52) touchent aussi la redirection selon le rôle. `fix/login-page-layout-20261012` (PR #62) porte principalement sur la connexion pharmacie et le mode hors ligne, et peut croiser la page de connexion sans être équivalent aux branches OTP.

## État de validation
Les descriptions de PR fournissent les périmètres ci-dessus, mais ne constituent pas à elles seules une preuve que toutes les branches passent la CI ni que leurs changements sont dans main. Les tests CI doivent être vérifiés sur le SHA exact de chaque branche avant toute décision.

## Journal de continuité
- 2026-10-13 : inventaire GitHub des branches d'authentification et lecture des descriptions de PR. Aucun code n'a été modifié par cette étape. Le document est le seul fichier que les commits de continuité peuvent modifier.

## Fiche de cette branche
Branche : `feat/auth-water-bubbles`
PR #59 : fond animé de bulles sur connexion, inscription et mot de passe oublié. Validation CI et aperçu mobile à confirmer selon la description de PR.

## Prochaine action autorisée
Vérifier l'état Git/PR/CI et les différences réelles avec les branches apparentées. Toute modification future reste limitée à ce document, sauf nouvelle autorisation explicite.


## Journal de continuité — 2026-10-13 (point 1 : identité visuelle)
- Autorisation utilisateur reçue pour corriger le lot identité visuelle avant le test final pré-déploiement.
- Branche active : `feat/auth-water-bubbles`; commit code : `4c184af270d7ef9ed82cdeb68e3ef098a6ad5b1a`.
- Correction ciblée dans `src/components/BullesAuthentification.tsx` : lorsque `prefers-reduced-motion` est actif, le canvas est dessiné sans boucle permanente de requestAnimationFrame; il est redessiné après redimensionnement. Les animations restent désactivées.
- Aucun changement sur `main`, aucune fusion et aucun déploiement Production.
- Validation restante : vérifier la CI sur le commit exact et construire une Preview Vercel. Le lot ne doit être déclaré vert qu'après preuve réelle des contrôles et, pour le visuel, contrôle du rendu en Preview.
