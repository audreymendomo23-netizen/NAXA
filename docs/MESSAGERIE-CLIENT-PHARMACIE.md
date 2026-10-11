# Messagerie client–pharmacie NAXA

## Modèle et sécurité
La migration 075 ajoute les préférences client, les fils, les messages et les notifications. Les écritures de messages passent par les RPC `envoyer_message_client` et `repondre_message`; les tables de messages n'accordent pas d'écriture directe aux rôles applicatifs. Le client ne reçoit pas d'identifiant client dans la boîte pharmacie : le libellé est « Client anonyme » ou « Client ». Les RPC exigent une session authentifiée et utilisent `security definer` avec `search_path` vide.

## Alertes
L'abonnement Realtime peut fonctionner lorsque l'application est active et connectée. Les alertes système nécessitent l'autorisation du navigateur. Une alerte lorsque le navigateur/application est fermé nécessite une infrastructure Web Push (clés VAPID, stockage sécurisé des abonnements et service worker) qui n'est pas comprise dans cette première migration.

## Configuration OAuth Google
Dans Supabase, activer Google dans Authentication → Providers, configurer l'URL du site et ajouter `https://<domaine>/auth/callback` aux URL de redirection autorisées. Dans Google Cloud, ajouter `https://<projet>.supabase.co/auth/v1/callback` comme URI de redirection autorisée. Vérifier les métadonnées de profil et le parcours d'âge/consentement avant l'ouverture aux utilisateurs.

## Limites à valider
Le test SQL est structurel et doit être exécuté contre une base de test initialisée avec le schéma NAXA. Le comportement Realtime, les notifications du système, les permissions pharmacie et le parcours complet restent à tester en navigateur. Ne pas appliquer ces migrations à la Production sans revue et autorisation distinctes.
