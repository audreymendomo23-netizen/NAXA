# Audit 360° — NAXA Prestations et soins à domicile

**Date :** 11 novembre 2026  
**Branche :** `main` uniquement  
**Référence d'audit :** HEAD observé avant intervention : `c68ac072f38c39d1e50c7f2659abc139f039a472`  
**État après intervention :** partiel — non AU VERT

## 1. Audit initial — constats vérifiés dans le code

- Le catalogue client et les demandes existent dans `src/app/prestations`.
- Le compte professionnel est créé par `src/app/admin/creation-univers-actions.ts` avec un mot de passe provisoire saisi par l'Admin. Le flux ne montre pas l'envoi d'une invitation à usage unique au professionnel.
- `preferred_at` représente une préférence horaire proposée par le client. Le professionnel pouvait confirmer la demande sans choisir un créneau effectif distinct.
- Les migrations 112/113/114/117/118/124 et les gardes ultérieures couvrent catalogue, demandes, notifications in-app et périmètres de lecture.
- Aucune préférence de rappel de rendez-vous ni file de distribution de ces rappels n'existait dans les migrations consultées.
- NAXA dispose déjà d'un service worker Web Push, d'abonnements appareils dans `naxa_push_subscriptions` et d'un dispatcher planifié dans `src/app/api/cron/posologie/route.ts`.
- L'arbre du dépôt ne contient pas de projet Android natif ou Capacitor. Le code livré est une PWA Next.js ; il ne peut donc pas garantir une vraie sonnerie d'appel système ni des canaux sonores Android distincts.

## 2. Corrections codées sur main

### 2.1 Créneau de rendez-vous réel

- Ajout de `home_service_requests.scheduled_at`.
- Nouvelle RPC `confirm_home_service_appointment` : exige un créneau futur (au moins 5 minutes, au plus 180 jours), vérifie un Admin actif ou un membre actif du partenaire Prestations, écrit l'audit et confirme la demande.
- L'ancienne RPC `transition_home_service_request` refuse désormais une confirmation sans créneau explicite.
- Le tableau partenaire affiche le choix du créneau en heure de Yaoundé et distingue la préférence du client du rendez-vous retenu.

### 2.2 Préférences de rappel du professionnel

- Nouvelle table `home_service_reminder_preferences`, avec RLS par utilisateur, établissement actif et rôle `owner/manager/operator`.
- Le professionnel configure ses rappels par établissement : 24 h, 2 h, 1 h, 30 min, 15 min et/ou à l'heure du rendez-vous.
- Fuseau enregistré : `Africa/Douala`.
- Nouvel écran `/partenaire/prestations/parametres` et action serveur de sauvegarde.

### 2.3 Distribution des rappels et notifications NAXA

- Nouvelle file `home_service_reminder_dispatches` et RPC de revendication atomique réservée à `service_role`.
- Le cron existant crée les échéances, produit une notification in-app et distribue le Push via les abonnements appareils déjà enregistrés.
- Les tâches en cours abandonnées sont récupérables après 10 minutes ; les tentatives sont plafonnées.
- Nouvelle file globale `naxa_notification_push_outbox` et trigger sur `public.notifications`, pour les notifications ayant un destinataire utilisateur ou pharmacie.
- Les notifications de messagerie avec `fil_id` restent exclues de la file globale : elles conservent leur flux Push dédié afin d'éviter un double envoi.
- Le service worker respecte les motifs de vibration transmis et sécurise la destination de clic sur l'origine NAXA.
- Les contenus détaillés ne sont pas envoyés sur l'écran verrouillé : le Push global affiche un texte générique.
- L'espace partenaire donne accès à `/promoteur/paiements`, le flux canonique de réabonnement. Aucun moteur de facturation parallèle n'a été créé.

## 3. Sécurité et limites à ne pas masquer

- Les préférences de rappel sont privées et limitées aux membres actifs des partenaires `professionnel_domicile`.
- La file interne de distribution Push n'est ni lisible ni modifiable par `anon` ou `authenticated`; seules les RPC de revendication sont exécutables par `service_role`.
- La confirmation d'un rendez-vous exige une autorisation et un créneau.
- Le contenu sensible de notification n'est pas affiché sur l'écran verrouillé.
- Les utilisateurs doivent avoir activé les notifications Push sur leur appareil ; les clés VAPID et le dispatcher planifié doivent être opérationnels.
- Une PWA Android peut afficher des notifications système et demander une vibration prise en charge par le navigateur. Elle ne garantit pas une sonnerie d'appel, un son distinct par catégorie ou un comportement si l'appareil est silencieux, en Ne pas déranger ou sans autorisation. Une application Android native avec canaux de notification, intégration Telecom/VoIP et tests sur appareils reste nécessaire pour cette exigence.

## 4. Vérifications réalisées pendant cette intervention

| Vérification | Résultat |
|---|---|
| Dépôt et branche | `main` confirmé ; aucun changement de branche |
| Lecture des migrations/flux existants | Réalisée |
| Service worker `node --check` | PASS |
| Test SQL de contrat | Écrit, non exécuté |
| Migration Supabase | Écrite, non appliquée |
| `npm test` | Non exécuté : dépôt non monté localement |
| `tsc --noEmit` | Non exécuté |
| `next lint` | Non exécuté |
| Build Next.js | Non exécuté |
| Recette fonctionnelle client/professionnel | Non exécutée |
| Recette réelle Android | Non exécutée |
| Déploiement | Aucun déploiement demandé ni effectué par cette intervention |

Le statut CircleCI observé avant les derniers commits était `pending` ; il ne constitue pas une preuve de réussite de cette version.

## 5. Points encore ouverts — bloquants pour le vert

1. **Invitation professionnelle :** remplacer la saisie Admin d'un mot de passe provisoire par une activation individuelle sûre, puis vérifier l'envoi effectif du courriel/lien et le parcours de première connexion.
2. **Profil et médias :** le professionnel ne dispose pas encore du formulaire complet en autonomie, du portrait, de la galerie photos et du dépôt vidéo (3 minutes / 50 Mo) avec validation avant publication.
3. **Réabonnement initial :** le lien vers le parcours Promoteur est raccordé, mais `admin_create_partner_dossier` ne crée pas, dans le code audité, de convention ni de ligne `abonnements_promoteurs`. La création de l'abonnement doit réutiliser l'étape de validation de paiement déjà figée ; aucun abonnement actif ou période payée n'a été inventé.
4. **Android natif :** aucune app Android native n'est présente dans le dépôt ; appels sonores système et canaux de son distincts non réalisés.
5. **Migration et tests :** appliquer d'abord la migration sur l'environnement Replay autorisé, exécuter le test de contrat SQL, puis tests comportementaux RLS/permissions, TypeScript, lint, build et recettes multi-comptes.
6. **Recette planifiée :** vérifier les rappels 24 h/2 h/1 h/30 min/15 min/à l'heure, désactivation, retards cron, retries, doublons, appareil sans abonnement Push, plusieurs membres, partenaire suspendu, annulation et rendez-vous passés.

## 6. Critère de clôture

Cette intervention est une **tranche de code préparée**, pas une mise en production et pas un statut vert. Le vert exige : migration appliquée sur Replay, tests SQL et E2E prouvés, vérifications Next.js réussies, invitation et médias terminés, réabonnement canonique fonctionnel et recette Android réalisée sur un client natif pour les exigences de sonnerie.
