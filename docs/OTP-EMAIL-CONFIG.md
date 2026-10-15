# NAXA — Configuration de l’OTP e-mail

Le code côté navigateur demande un code de confirmation à Supabase Auth. Le succès de `signUp` signifie que Supabase a accepté la demande, pas que le message a été livré dans la boîte de réception.

## Configuration nécessaire dans chaque projet Supabase

1. Dans **Authentication → Providers → Email**, activer la confirmation de l’adresse e-mail.
2. Dans **Authentication → Email Templates → Confirm signup**, coller le modèle HTML ci-dessous. Il affiche le code OTP (`{{ .Token }}`) et des liens directs vers les pages publiques de NAXA. Ne pas remplacer le code OTP par un simple lien `{{ .ConfirmationURL }}`, car l’écran NAXA demande à l’utilisateur de saisir le code.
3. Configurer un fournisseur SMTP fonctionnel dans **Project Settings → Authentication/SMTP Settings** selon l’interface Supabase du projet. L’adresse expéditeur souhaitée est `naxa.home@gmail.com`; vérifier dans les paramètres SMTP de Supabase que le compte et l’adresse From utilisent bien cette adresse. Les variables SMTP enregistrées dans Vercel ne configurent pas automatiquement le SMTP de Supabase Auth.
4. Tester avec une adresse réelle, puis vérifier les journaux Auth et SMTP sans consigner le code OTP ni les secrets.
5. Vérifier la boîte de réception, les indésirables et les restrictions du fournisseur. Le bouton de renvoi NAXA est disponible après le délai de 60 secondes.

### Modèle HTML à configurer dans Supabase Auth\n\n```html\n<h2>Confirmez votre adresse e-mail NAXA</h2>\n<p>Votre code de confirmation est :</p>\n<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>\n<p>Ce code est personnel. Ne le communiquez à personne.</p>\n<hr>\n<p>Avant de poursuivre, consultez les documents NAXA :</p>\n<ul>\n  <li><a href="https://naxa-naxa3.vercel.app/conditions-utilisation">Conditions générales d’utilisation</a></li>\n  <li><a href="https://naxa-naxa3.vercel.app/politique-confidentialite">Politique de confidentialité</a></li>\n</ul>\n<p>Contact : <a href="mailto:naxa.home@gmail.com">naxa.home@gmail.com</a></p>\n```\n\nPour le modèle **Magic Link** ou tout modèle utilisé par un parcours OTP, appliquer également le même bloc de liens en conservant la variable d’action attendue par le modèle. Ne jamais supprimer la variable OTP ou le lien d’authentification nécessaire au flux concerné.\n\n## Limites et sécurité

- Le délai de 60 secondes est un délai avant **renvoi**; il ne rend pas automatiquement invalide un code déjà reçu. La validité réelle du code est contrôlée par Supabase Auth.
- Si Supabase retourne une session dès l’inscription, la confirmation e-mail est probablement désactivée; NAXA affiche alors une erreur de configuration au lieu de prétendre qu’un OTP a été envoyé.
- Ne jamais désactiver la confirmation pour contourner un problème SMTP.
- Les modèles e-mail Supabase et le compte SMTP sont des réglages du projet Supabase : une modification du code NAXA ou un déploiement Vercel ne les change pas à lui seul. Après configuration, envoyer un OTP réel et vérifier que les deux liens et le champ expéditeur sont visibles dans le message reçu.


## Diagnostic opérationnel — 14 octobre 2026

- Le flux d’inscription est l’OTP natif Supabase : `signInWithOtp` avec `shouldCreateUser: true`, puis `verifyOtp` de type `email`. Ce couple est cohérent et n’utilise pas de table OTP maison.
- Les journaux Auth de Production consultés en lecture seule montrent des vérifications `/verify` en erreur `500 unexpected_failure` liées à `NAXA_SESSION_LIMIT_REACHED`, ainsi que des réponses `403 otp_expired`. Le refus `500` n’indique donc pas nécessairement un code faux : la limite de quatre sessions actives est appliquée par la base.
- Le code pré-vérifie maintenant la disponibilité d’une session dans le parcours de récupération, journalise le code/status/message Supabase sans l’adresse ni le token, et distingue le plafond de sessions d’un OTP invalide. Aucun changement de base Production n’a été appliqué.
