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

### Ordonnanceurs e-mail et Web Push

Les deux canaux sont volontairement séparés afin qu'une panne du fournisseur e-mail ne bloque pas les rappels Push.

#### E-mail (Apps Script)

Le script canonique contient `processNaxaNotificationQueue` et `installNaxaNotificationTrigger`. Le déclencheur Google appelle uniquement le worker e-mail `/api/cron/validite`, qui synchronise les validités puis vide l'outbox idempotente.

1. Dans les Script Properties du projet, définir `NAXA_WORKER_URL=https://nnaxa.vercel.app/api/cron/validite`.
2. Définir `NAXA_CRON_SECRET` avec la valeur Vercel Production de `CRON_SECRET`. Ne jamais confondre ce secret avec `NAXA_WELCOME_SECRET`.
3. Définir `NAXA_VERCEL_BYPASS_SECRET` avec le secret Protection Bypass for Automation si l'alias appelé le requiert. Le code envoie cet en-tête séparément de `Authorization: Bearer CRON_SECRET`.
4. Vérifier le manifeste `scripts/google-welcome-email.appsscript.json`, enregistrer le projet et autoriser les scopes.
5. Exécuter `installNaxaNotificationTrigger` une seule fois. Il remplace les anciens déclencheurs du handler et planifie un cycle toutes les cinq minutes.
6. Contrôler les exécutions Apps Script, les réponses JSON du worker et l'outbox `private.notification_email_outbox`.

Le handler impose le domaine stable Production `nnaxa.vercel.app`, désactive les redirections et échoue si la réponse HTTP ou le contrat JSON n'est pas conforme. Une page SSO HTML ne compte jamais comme un succès. Pour arrêter l'ordonnancement, exécuter `removeNaxaNotificationTrigger`.

#### Web Push (Supabase pg_cron)

Le Web Push n'est pas appelé par Apps Script. Il est déclenché par le job PostgreSQL `naxa-posology-web-push-every-five-minutes` toutes les cinq minutes vers `https://nnaxa.vercel.app/api/cron/posologie`.

- Le jeton dédié est stocké dans Supabase Vault sous le nom `naxa_posology_cron_secret`. Sa valeur ne doit jamais être recopiée dans un rapport ou une variable cliente.
- Le worker vérifie le jeton côté serveur ; la fonction `naxa_verify_posology_cron_secret(text)` ne renvoie qu'un booléen et son exécution est réservée à `service_role`.
- Le job appelle le domaine Production stable, pas l'alias Preview `naxa-git-main-...`. Les réponses HTTP/JSON sont contrôlées ; un sous-traitement en échec doit produire un statut HTTP non-2xx.
- La migration canonique `20261105144009_posology_cron_secret_verification_and_prod_dispatch.sql` porte la vérification du secret et le ciblage Production. Elle a été exécutée et testée sur Replay ; son application Production relève d'une autorisation distincte.
- La fondation Favoris et rappels est désormais versionnée dans `supabase/migrations/20261105145307_naxa_favoris_reminders_schema_alignment.sql`. Le fichier historique `supabase/migration_238_favoris_sync_achat_reminders.sql` se trouvait hors du répertoire canonique de migrations et n'avait pas créé les tables attendues en Production. La migration canonique a été appliquée et vérifiée sur Replay ; la Production contrôlée n'a pas encore ces trois tables.

**Certification :** un job `pg_cron` marqué `succeeded` ne prouve que la soumission SQL. Vérifier la réponse dans `net._http_response` (code HTTP, type et corps JSON), puis vérifier `checked`, `due`, `sent` et `failed`. La clé publique VAPID HTTP 200 ne prouve pas qu'un appareil a reçu une notification : un abonnement Push réel et un rappel arrivé à échéance sont nécessaires.

**Contrôle d'e-mail :** `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` et `SMTP_FROM` dans Vercel ne configurent pas Supabase Auth. L'OTP utilise le SMTP configuré dans **Supabase Authentication**. Une demande `signInWithOtp` acceptée ne prouve pas la réception ; il faut envoyer un code à une boîte de recette, le recevoir et le valider. Le courrier de bienvenue suit un parcours distinct via Google Apps Script, et doit être vérifié séparément.

