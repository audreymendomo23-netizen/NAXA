# Configuration du courrier de bienvenue NAXA

Le parcours de bienvenue est déclenché après confirmation de l’adresse e-mail et enregistrement du mot de passe. L’interface n’annonce un envoi réussi que si l’API du fournisseur confirme la requête.

## Variables serveur requises

Configurer ces variables dans l’environnement de prévisualisation puis de production, sans les exposer au navigateur :

- `RESEND_API_KEY` : clé API Resend.
- `NAXA_EMAIL_FROM` : expéditeur vérifié par Resend, par exemple une adresse du domaine officiel validé par l’équipe.
- `NEXT_PUBLIC_SITE_URL` : origine HTTPS officielle de NAXA, sans barre oblique finale.
- `NAXA_TERMS_VERSION` : version réellement publiée des Conditions d’utilisation.
- `NAXA_PRIVACY_VERSION` : version réellement publiée de la Politique de confidentialité.
- `NAXA_PRIVACY_CONTACT_EMAIL` : adresse surveillée pour les questions relatives aux données personnelles.

Les liens du message utilisent les routes existantes `/conditions-utilisation` et `/politique-confidentialite` sur `NEXT_PUBLIC_SITE_URL`. Ne pas renseigner de versions ou d’adresse de contact fictives. Tant que les variables requises ne sont pas configurées, l’API renvoie un échec explicite et l’interface ne prétend pas que le message a été envoyé.

## Protection contre les doublons et reprises

L’API exige une session Supabase valide et une adresse confirmée, n’envoie qu’à l’adresse du compte connecté et utilise une clé d’idempotence Resend fondée sur l’identifiant utilisateur. Après confirmation par le fournisseur, un marqueur est enregistré dans les métadonnées serveur `app_metadata`. Une erreur de configuration ou du fournisseur reste visible et l’utilisateur peut relancer l’envoi depuis l’écran de réussite.

Avant toute mise en Production, vérifier les variables, le domaine expéditeur, les versions juridiques approuvées et l’adresse de contact.
