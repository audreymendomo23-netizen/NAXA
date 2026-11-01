# Courrier automatique de bienvenue NAXA — Google gratuit

NAXA utilise Gmail via Google Apps Script (service MailApp, limité à l’envoi). Aucun compte Resend ni prestataire e-mail payant n'est requis. Le compte Google qui déploie le script est l'expéditeur. Cette solution convient au lancement et aux faibles volumes; les quotas gratuits Google s'appliquent.

## Configuration unique

1. Ouvrir Google Apps Script avec le compte Gmail qui enverra les courriers et créer un projet dédié.
2. Copier `scripts/google-welcome-email.gs` dans le fichier `Code.gs`.
3. Dans **Paramètres du projet → Propriétés du script**, ajouter `NAXA_WELCOME_SECRET` avec un secret aléatoire long (32 caractères minimum). Optionnel : `NAXA_WELCOME_FROM_NAME=NAXA`.
4. Déployer comme **application Web**, exécuter en tant que propriétaire et autoriser l’envoi de courriels.
5. Copier l'URL de déploiement se terminant par `/exec`.
6. Ajouter aux variables serveur de l'application :
   - `GOOGLE_APPS_SCRIPT_URL` : URL /exec.
   - `GOOGLE_APPS_SCRIPT_SECRET` : même secret que la propriété Apps Script.
   - `NAXA_VERCEL_BYPASS_SECRET` : secret de contournement de la protection de déploiement Vercel, utilisé uniquement par le déclencheur Google pour appeler le worker protégé. Il doit correspondre au secret configuré dans Vercel; ne jamais le journaliser ni le transmettre dans une URL.
   - `NEXT_PUBLIC_SITE_URL` : URL HTTPS du site dans cet environnement, sans barre finale.
   - `NAXA_PRIVACY_CONTACT_EMAIL` : adresse Gmail consultée par l'équipe pour les questions relatives aux données.
7. Tester avec un compte confirmé et vérifier la réception réelle avant de considérer l'envoi opérationnel.

## Ce que signifie « domaine officiel »

C'est l'adresse HTTPS stable du site contrôlée par NAXA, utilisée pour créer les liens vers les Conditions et la Politique de confidentialité. `NEXT_PUBLIC_SITE_URL` est une URL, pas un secret. En prévisualisation, elle pointe vers le preview; en Production, elle doit pointer vers le site public retenu par NAXA. Ne pas inventer de domaine. NAXA peut utiliser un compte Gmail pour envoyer les messages même si le site ne possède pas encore de domaine personnalisé.

## Anti-doublon et limites

Le serveur vérifie la session Supabase et la confirmation de l'adresse. Apps Script utilise un verrou et une clé d'idempotence enregistrée dans les propriétés du script. Google peut limiter temporairement les envois si les quotas du compte sont dépassés. Une réponse non confirmée n'est jamais affichée comme un succès.

## Version des textes juridiques

Le courrier indique la version initiale proposée du 12 octobre 2026. Cette date ne vaut pas validation juridique. Avant diffusion réelle, le responsable NAXA doit confirmer l'identité légale de l'opérateur, les coordonnées de contact et la conformité des textes à la loi camerounaise n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel.

## Notifications Promoteur — réutilisation de la passerelle existante

Le même projet Google Apps Script et le même endpoint peuvent aussi délivrer les notifications de la file Promoteur. Le fichier source canonique est `scripts/google-welcome-email.gs`; il conserve le contrat de bienvenue existant et accepte en plus un champ texte facultatif `text` pour les notifications.

- Le worker `/api/cron/validite` transmet `to`, `subject`, `html`, `text`, `secret` et une clé `naxa-notification-<UUID>`.
- La passerelle conserve le même secret `NAXA_WELCOME_SECRET` dans Script Properties, correspondant à `GOOGLE_APPS_SCRIPT_SECRET` côté Vercel.
- Les clés de bienvenue historiques restent conservées; seules les clés de notifications sont nettoyées après 30 jours.
- La réponse existante `{sent, alreadySent}` est conservée pour ne pas casser le parcours de bienvenue.
- Les variables `GOOGLE_APPS_SCRIPT_URL` et `GOOGLE_APPS_SCRIPT_SECRET` ont été observées dans la configuration Vercel Production. Leur valeur reste masquée; aucune valeur n'a été déchiffrée ni modifiée.

**Important :** après modification du fichier Apps Script source, le propriétaire doit mettre à jour le projet Apps Script existant et publier une nouvelle version du déploiement Web App. Le simple commit GitHub ne met pas à jour le code Google déjà déployé. Effectuer ensuite un test de bienvenue et un test de notification sur une adresse de recette.

### Déclencheur Google pour vider la file Promoteur

Le script canonique contient aussi `processNaxaNotificationQueue` et `installNaxaNotificationTrigger`. Pour activer l'appel périodique du worker depuis le compte Google propriétaire :

1. Dans les Script Properties du même projet, ajouter `NAXA_WORKER_URL` avec l'URL HTTPS de Production suivie de `/api/cron/validite`.
2. Ajouter `NAXA_CRON_SECRET` avec la valeur de la variable Vercel Production `CRON_SECRET`. Ne jamais confondre ce secret avec `NAXA_WELCOME_SECRET`.
3. Ajouter `NAXA_VERCEL_BYPASS_SECRET` avec la valeur du secret de contournement Vercel du projet `naxa` (Protection Bypass for Automation). Le worker transmet ce secret dans l'en-tête `x-vercel-protection-bypass`; il ne remplace jamais `CRON_SECRET`.
4. Mettre à jour le manifeste avec les scopes de `scripts/google-welcome-email.appsscript.json` (envoi mail, requêtes externes, gestion des déclencheurs).
5. Enregistrer le projet et autoriser les nouveaux scopes.
6. Exécuter manuellement `installNaxaNotificationTrigger` une seule fois. Il remplace les anciens déclencheurs du même handler et crée une exécution toutes les 5 minutes.
7. Vérifier dans **Déclencheurs** Apps Script que le déclencheur est actif, puis contrôler les journaux d'exécution et l'outbox.

Pour arrêter le traitement automatique, exécuter `removeNaxaNotificationTrigger`. Le déclencheur Google n'est pas encore installé par le code GitHub : cette activation nécessite l'autorisation du propriétaire du compte Google.


**Contrôle de cohérence obligatoire avant activation :** vérifier que les trois propriétés NAXA_WORKER_URL, NAXA_CRON_SECRET et NAXA_VERCEL_BYPASS_SECRET sont présentes dans Apps Script, et que CRON_SECRET, GOOGLE_APPS_SCRIPT_URL et GOOGLE_APPS_SCRIPT_SECRET sont présentes dans Vercel Production. Les valeurs ne doivent jamais être copiées dans un rapport. Une variable simplement présente ne prouve ni l'installation du déclencheur ni la réception d'un e-mail.
