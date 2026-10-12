# Courrier automatique de bienvenue NAXA — Google gratuit

NAXA utilise Gmail via Google Apps Script. Aucun compte Resend ni prestataire e-mail payant n'est requis. Le compte Google qui déploie le script est l'expéditeur. Cette solution convient au lancement et aux faibles volumes; les quotas gratuits Google s'appliquent.

## Configuration unique

1. Ouvrir Google Apps Script avec le compte Gmail qui enverra les courriers et créer un projet dédié.
2. Copier `scripts/google-welcome-email.gs` dans le fichier `Code.gs`.
3. Dans **Paramètres du projet → Propriétés du script**, ajouter `NAXA_WELCOME_SECRET` avec un secret aléatoire long (32 caractères minimum). Optionnel : `NAXA_WELCOME_FROM_NAME=NAXA`.
4. Déployer comme **application Web**, exécuter en tant que propriétaire et autoriser Gmail.
5. Copier l'URL de déploiement se terminant par `/exec`.
6. Ajouter aux variables serveur de l'application :
   - `GOOGLE_APPS_SCRIPT_URL` : URL /exec.
   - `GOOGLE_APPS_SCRIPT_SECRET` : même secret que la propriété Apps Script.
   - `NEXT_PUBLIC_SITE_URL` : URL HTTPS du site dans cet environnement, sans barre finale.
   - `NAXA_PRIVACY_CONTACT_EMAIL` : adresse Gmail consultée par l'équipe pour les questions relatives aux données.
7. Tester avec un compte confirmé et vérifier la réception réelle avant de considérer l'envoi opérationnel.

## Ce que signifie « domaine officiel »

C'est l'adresse HTTPS stable du site contrôlée par NAXA, utilisée pour créer les liens vers les Conditions et la Politique de confidentialité. `NEXT_PUBLIC_SITE_URL` est une URL, pas un secret. En prévisualisation, elle pointe vers le preview; en Production, elle doit pointer vers le site public retenu par NAXA. Ne pas inventer de domaine. NAXA peut utiliser un compte Gmail pour envoyer les messages même si le site ne possède pas encore de domaine personnalisé.

## Anti-doublon et limites

Le serveur vérifie la session Supabase et la confirmation de l'adresse. Apps Script utilise un verrou et une clé d'idempotence enregistrée dans les propriétés du script. Google peut limiter temporairement les envois si les quotas du compte sont dépassés. Une réponse non confirmée n'est jamais affichée comme un succès.

## Version des textes juridiques

Le courrier indique la version initiale proposée du 12 octobre 2026. Cette date ne vaut pas validation juridique. Avant diffusion réelle, le responsable NAXA doit confirmer l'identité légale de l'opérateur, les coordonnées de contact et la conformité des textes à la loi camerounaise n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel.
