# Messagerie client–pharmacie NAXA

## Modèle et sécurité
La migration 075 ajoute les préférences client, les fils, les messages et les notifications. Les écritures de messages passent par les RPC `envoyer_message_client` et `repondre_message`; les tables de messages n'accordent pas d'écriture directe aux rôles applicatifs. Le client ne reçoit pas d'identifiant client dans la boîte pharmacie : le libellé est « Client anonyme » ou « Client ». Les RPC exigent une session authentifiée et utilisent `security definer` avec `search_path` vide.

## Alertes
L'abonnement Realtime peut fonctionner lorsque l'application est active et connectée. Les alertes système nécessitent l'autorisation du navigateur. Une alerte lorsque le navigateur/application est fermé nécessite une infrastructure Web Push (clés VAPID, stockage sécurisé des abonnements et service worker) qui n'est pas comprise dans cette première migration.

## OAuth Google — configuration et onboarding

### Configuration des fournisseurs
1. Dans Supabase, activer Google dans **Authentication → Providers** et renseigner les identifiants OAuth.
2. Dans **Authentication → URL Configuration**, définir l'URL du site et ajouter l'URL absolue `https://<domaine>/auth/callback` aux URL de redirection autorisées.
3. Dans Google Cloud, configurer comme URI de redirection autorisée l'URL de callback fournie par le projet Supabase, généralement `https://<projet>.supabase.co/auth/v1/callback`.
4. Vérifier les domaines, les secrets OAuth et les URL autorisées dans les environnements de prévisualisation et de production séparément. Ne jamais placer un secret OAuth côté client.

### Parcours de création et de complétion du profil
- Le callback `/auth/callback` échange le code OAuth, conserve les cookies de session et redirige vers `/completer-profil` lorsqu'un profil client est absent ou incomplet.
- La page de complétion recueille le nom, le prénom, le nom d'utilisateur, le pays et le téléphone, la date de naissance et le consentement explicite.
- Le trigger `handle_new_user()` distingue Google OAuth : lorsqu'il manque des métadonnées applicatives requises, il laisse l'identité Auth être créée sans fabriquer un profil applicatif incomplet.
- La RPC `public.naxa_complete_google_profile(...)` réalise la validation côté serveur. Les validations côté navigateur servent uniquement à guider l'utilisateur et ne constituent pas une barrière de sécurité.
- La migration 078 prend également en charge les profils clients Google historiques absents ou incomplets. Elle refuse de transformer les profils non-clients et les profils déjà complets.
- Le middleware bloque l'accès applicatif aux utilisateurs authentifiés dont le profil client est incomplet, tout en laissant accessibles les routes d'authentification, de complétion et les pages publiques autorisées. Les profils pharmacie et administrateur ne doivent pas être forcés dans l'onboarding client.

### Validations de sécurité attendues
- Le fournisseur doit être Google pour utiliser la RPC de complétion.
- L'âge minimal est de 18 ans, vérifié côté serveur.
- Le consentement requis doit être explicite et enregistré côté serveur.
- Le nom d'utilisateur, le pays et le téléphone doivent être validés côté serveur avant la création ou la mise à jour du profil.
- La RPC est réservée aux sessions authentifiées et utilise les privilèges minimaux nécessaires, avec `SECURITY DEFINER` et un `search_path` vide.
- Ne pas contourner un refus de validation serveur en s'appuyant uniquement sur le formulaire client.

### Tests et limites
Les tests SQL des migrations 077 et 078 vérifient principalement la structure, les privilèges et les branches de validation. Ils ne prouvent pas à eux seuls le bon fonctionnement de la connexion Google dans un navigateur réel. Avant ouverture aux utilisateurs, tester en environnement non-production :
1. un nouveau compte Google sans métadonnées de profil complètes ;
2. un utilisateur qui refuse le consentement ou n'a pas 18 ans ;
3. un nom d'utilisateur déjà pris et un téléphone invalide ;
4. un client Google historique avec profil absent/incomplet ;
5. un profil client déjà complet ;
6. les profils pharmacie et administrateur ;
7. la persistance des cookies, les redirections et l'accès direct aux routes protégées.

Ne pas appliquer ces migrations à la Production sans revue et autorisation distinctes. Ne pas publier de secrets dans les logs ou dans la documentation.
