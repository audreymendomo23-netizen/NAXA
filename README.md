# NAXA : base de l'application

Votre médicament, à 2 minutes. Next.js 14 + Supabase + Tailwind, PWA, 100 % offre gratuite.

## Démarrage
1. npm install
2. Créer un projet Supabase (gratuit). Dans Database > Extensions, activer pg_cron.
3. Dans l'éditeur SQL, exécuter dans cet ordre : supabase/schema.sql, supabase/migration_002_catalogue_panier.sql, supabase/migration_003_security_hardening.sql, supabase/migration_004_corrections.sql, supabase/migration_006_auth_profile_age_gate.sql, puis (démo seulement) supabase/seed.sql.
4. Planifier l'expiration des réservations avec le job naxa-expire toutes les 5 minutes.
5. Copier .env.example vers .env.local et renseigner les clés. La clé service_role ne doit jamais être exposée.
6. npm run dev, puis ouvrir /admin après avoir configuré un compte administrateur.

## Fonctionnalités
Recherche et scan d'ordonnance (OCR avec choix import téléphone/caméra), accès protégé par connexion pour les actions opérationnelles, traduction des noms de médicaments du bandeau « Les plus recherchés », classement prix/distance/temps, circulation, réservation 3 h, WhatsApp, paiement guidé par code marchand, reçu imprimable, panneau pharmacie, espace admin, fiches produits, panier et PWA.

Aucune photo de médicament n'est fournie : à ajouter par l'équipe NAXA (droits d'usage à vérifier).

## État
### Phase 0 — terminée et validée
- Cahier des charges et prompt maître lus et pris comme sources de vérité.
- Code existant conservé ; aucune réécriture de l'application.
- Aucun déploiement manuel effectué. Les changements de ce chantier restent sur une branche de correction ; aucune fusion dans main ni aucun déploiement Production/Preview n'est effectué sans autorisation.

### Phase 1 — fondations
- Projet Supabase NAXA connecté et sain.
- Schéma initial + migration catalogue/panier appliqués.
- Migration de durcissement sécurité/performance ajoutée et appliquée sur l'environnement NAXA.
- 9 tables publiques créées avec RLS activé.
- Données de démonstration chargées.
- pg_cron activé et expiration des réservations planifiée toutes les 5 minutes.
- Correction du typage Supabase SSR effectuée, notamment dans le middleware.
- Page panier corrigée pour éliminer l'erreur de syntaxe JSX signalée par Vercel.
- Composant ImportAdmin ajouté pour restaurer la fonctionnalité d'import de stock référencée par /admin.
- Parcours compte refondu : connexion par nom d'utilisateur + mot de passe, récupération du mot de passe par nom d'utilisateur → OTP e-mail → nouveau mot de passe, création de compte en 3 étapes (informations, OTP e-mail, mot de passe), contrôle d'unicité du nom d'utilisateur, téléphone avec indicatif/drapeau et validation de la date de naissance. Les médicaments « Les plus recherchés » restent uniquement sur l'accueil ; les politiques d'utilisation, confidentialité et sécurité sont consultables individuellement depuis l'inscription.
- Audit par contradiction : validations serveur du panier renforcées (1–10 produits, quantité 1–10, pas de doublon) et écritures de fiches produits limitées à l'administration.
- L'import de stock conserve la création de produits mais n'utilise plus une mise à jour produit générale.
- Les variables Vercel Production/Preview/Development NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont maintenant configurées avec le projet Supabase NAXA.
- Le dernier échec Vercel provenait du prerender /pharmacie sans ces variables Supabase ; une nouvelle construction doit confirmer la correction.

### Règles de gouvernance
- Aucun déploiement Preview n'est autorisé. Aucun déploiement Production n'est effectué sans autorisation stricte explicite.
- Les décisions du cahier des charges et du prompt maître restent prioritaires.


## Réconciliation du chantier 4 octobre 2026
- Les évolutions d'authentification les plus récentes (connexion username/mot de passe, récupération OTP, OAuth callback et durcissement de l'accès par âge) sont conservées comme base.
- Les corrections d'accueil approuvées ont été réintégrées par-dessus cette base : CTA pharmacie isolé en bas, disclaimer médical repositionné, traduction/affichage et corrections de recherche associées.
- Les versions concurrentes n'ont pas été écrasées sur main : la réconciliation est isolée sur une branche dédiée pour validation avant toute fusion.
- Aucun déploiement Preview ou Production n'est autorisé dans cette étape.
- Google OAuth dépend en plus de la configuration du fournisseur Supabase : le Client ID et le Client Secret doivent correspondre au même client Google, avec le callback Supabase autorisé côté Google.

## Clôture de la réconciliation — 4 octobre 2026
- PR #8 : réconciliation accueil + authentification, fusionnée dans main.
- PR #9 : correction minimale de syntaxe de `src/app/politique-securite/page.tsx`, fusionnée dans main après échec du premier build Production.
- main : `1a28b0fa7b7651efb27f635d0ca3051595e9e7c2`.
- Production Vercel : READY sur ce commit.
- Build Production : compilation réussie, vérification TypeScript réussie, 23/23 pages statiques générées et fonctions serverless créées.
- Runtime Production : aucune erreur détectée sur la fenêtre de contrôle de 30 minutes.
- Google OAuth : le code est prêt ; la configuration externe Google/Supabase doit utiliser le même Client ID + Client Secret et le callback Supabase autorisé côté Google.


## Consolidation finale — authentification, âge et politiques — 4 octobre 2026
- Google OAuth reste un parcours sans OTP : le callback finalise la session Supabase avant de rediriger vers la destination demandée.
- La récupération « Mot de passe oublié » conserve son OTP e-mail séparé et conserve la session après validation afin de permettre le changement de mot de passe.
- Le parcours d'authentification utilise un écran sans défilement de page.
- Le sélecteur téléphone a été resserré sur mobile sans modifier la liste des pays ni la validation du numéro.
- La validation d'âge exige maintenant l'acceptation explicite des Conditions d'utilisation, de la Politique de confidentialité et de la Politique de sécurité, côté interface et côté serveur.
- Les trois documents juridiques ont été enrichis pour refléter les comportements réellement présents dans NAXA.
- Les numéros affichés sur l'accueil ont été mis à jour vers 1510, 119 et 1511.
- Aucun nouveau modèle de données ni aucune réécriture de l'application n'ont été introduits.

- Validation Production : déploiement `dpl_7LEmWPTL8QB7iGGeheQZZxx1Xfww` sur le commit `35decd227c9175bbc69c1805a55f2b77f2ca6f17`, état READY.
- Build Production : compilation Next.js réussie et contrôle TypeScript intégré au build réussi.
- Runtime Production : aucun log de niveau error/fatal détecté sur la fenêtre contrôlée de 30 minutes.
