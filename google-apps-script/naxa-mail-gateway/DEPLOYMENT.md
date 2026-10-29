# NAXA — Configuration de la passerelle e-mail Google

## Objectif

Remplacer Resend par Google Apps Script `MailApp` pour délivrer les notifications inscrites dans `private.notification_email_outbox`. La route Next.js transmet les messages au Web App Google. Elle est protégée côté NAXA par `CRON_SECRET` et côté Google par un secret partagé distinct.

## 1. Créer le projet Apps Script

1. Ouvrir https://script.google.com avec le compte Google expéditeur.
2. Créer un projet nommé **NAXA Mail Gateway**.
3. Copier le contenu de `Code.gs` depuis `google-apps-script/naxa-mail-gateway/Code.gs`.
4. Activer l'affichage du manifeste et copier `appsscript.json` depuis le dépôt.
5. Dans Paramètres du projet > Propriétés du script, ajouter `NAXA_MAIL_SECRET` (secret aléatoire long, 32 octets minimum) et `NAXA_TEST_EMAIL` (adresse de recette contrôlée).
6. Enregistrer puis exécuter `testNaxaMailGateway` depuis l'éditeur. Autoriser l'envoi d'e-mails et vérifier la réception.

## 2. Publier l'application Web

1. Déployer > Nouveau déploiement > Application Web.
2. Exécuter en tant que : **Moi** (propriétaire du script).
3. Accès : **Tout le monde**. Le POST reste protégé par le secret partagé vérifié dans le script.
4. Déployer et copier l'URL terminée par `/exec`. Ne pas utiliser l'URL `/dev`.

## 3. Configurer NAXA

Dans les variables Vercel du projet NAXA, ajouter pour l'environnement visé :
- `GOOGLE_APPS_SCRIPT_URL` : URL Web App `/exec`.
- `GOOGLE_APPS_SCRIPT_SECRET` : même valeur que `NAXA_MAIL_SECRET`.

Conserver `CRON_SECRET` : il protège l'accès à la route NAXA. Les deux secrets sont distincts. Ne jamais mettre les secrets dans GitHub, le navigateur ou les journaux.

## 4. Déclenchement et recette

- Le worker est `/api/cron/validite`; il exige `Authorization: Bearer <CRON_SECRET>`.
- Déclencher d'abord depuis une recette et envoyer vers une adresse contrôlée.
- Vérifier le résultat Apps Script, le statut `sent` dans l'outbox et la réception effective.
- Tester le quota épuisé et une nouvelle tentative avec le même `idempotencyKey`.

## 5. Limites et sécurité

- `MailApp` envoie au nom du compte Google et ne donne pas à NAXA accès à la boîte de réception.
- Les quotas dépendent du type de compte et peuvent évoluer. `MailApp.getRemainingDailyQuota()` permet de connaître le quota restant. Voir la documentation Google.
- La passerelle publique doit toujours vérifier le secret partagé. En cas de fuite, régénérer les deux côtés ensemble.
- Le registre d'idempotence est conservé 30 jours dans Script Properties; les requêtes concurrentes sont sérialisées. Une petite fenêtre théorique de doublon subsiste si l'exécution s'interrompt après l'envoi mais avant l'enregistrement de la clé.
- Les notifications in-app restent indépendantes de l'e-mail.

## État

Le code est présent sur GitHub `main`. Le projet Apps Script n'a pas été créé ni déployé automatiquement, aucune autorisation Google n'a été accordée et aucun e-mail n'a été envoyé pendant cette intervention. La création du projet, les propriétés secrètes et l'URL `/exec` restent à configurer par le propriétaire du compte.