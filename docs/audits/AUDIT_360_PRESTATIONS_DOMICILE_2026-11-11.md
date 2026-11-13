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


---

## Addendum — correction du modèle Partenaire indépendant (13 novembre 2026)

### Règle canonique rétablie

- Une seule catégorie : `Partenaire — Prestations et soins à domicile` (`partner_type='professionnel_domicile'`).
- Les univers `prestations` et `suivi_connecte` sont des canaux d’accès/usage du même Partenaire, pas deux catégories ou identités.
- L’agrément médical dans `suivi_professionals` reste une qualification distincte.
- L’emploi ou l’affectation dans `partner_members` ne donne aucun droit indépendant de publication, d’offre en nom propre, de planning public ni de modification des coordonnées publiques du Partenaire.
- Le titulaire doit accepter personnellement une convention NAXA publiée ; un Admin actif doit ensuite l’approuver. L’accord est versionné, horodaté, révocable et peut expirer.
- L’offre commerciale, les demandes et les tâches d’équipe restent rattachées au Partenaire ; les droits opérationnels des membres ne sont pas remplacés par le statut indépendant.
- Le planning public est porté par `partner_weekly_availability`, au niveau du Partenaire. L’ancien planning utilisateur est conservé pour traçabilité mais ses écritures directes sont révoquées.
- Les droits cliniques restent fondés sur l’agrément médical, les relations de suivi, le consentement du patient et les politiques RLS. Ils ne sont pas confondus avec le droit de publication indépendante.

### Migrations correctives Replay

| Version | Objet |
|---|---|
| `20261113180231` | Modèles et contrats indépendants, garde de statut, planning du Partenaire, annuaire indépendant et catalogue conditionné par convention active |
| `20261113180543` | Publication Admin du modèle officiel et correction de l’appel serveur du RPC de géolocalisation |
| `20261113180834` | Droit d’exécution du garde interne réservé à `service_role` |
| `20261113181202` | Expiration de la convention antérieure lors de la demande de renouvellement |
| `20261113181311` | Séparation explicite entre agrément médical et statut de Partenaire indépendant |

### Contrôles réalisés

- Projet vérifié : `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`) uniquement.
- Le test transactionnel `supabase/tests/20261113181000_partner_independent_agreements_contract.sql` est **PASS** : le titulaire agréé avec convention active apparaît dans l’annuaire ; l’employé agréé sans convention conserve sa qualification médicale mais n’est pas listé comme Partenaire indépendant ; le catalogue utilise le Partenaire conventionné et son planning.
- Les accès directs `anon/authenticated` au RPC de géolocalisation sont refusés ; seul `service_role` peut l’appeler. Le garde interne est exécutable par `service_role`, pas par `anon/authenticated`.
- Les écritures Authenticated sur l’ancien planning individuel sont refusées.
- La transaction E2E a été annulée ; les compteurs Replay de Partenaires, membres, agréments, conventions, offres et plannings restent à zéro.
- Aucun compte, Partenaire ou accord de test n’a été conservé.

### Réserves non clôturées

1. Aucun texte juridique de convention n’a été inventé ni publié. La publication Admin attend le texte officiel relu et approuvé par NAXA.
2. Le parcours de demande d’un nouveau Partenaire indépendant par une personne qui n’est pas encore titulaire d’un Partenaire existant reste à raccorder au formulaire canonique de création de dossier ; le raccourci Suivi renvoie désormais au même espace convention, sans créer une catégorie parallèle.
3. Les changements n’ont pas été appliqués à Supabase Production.
4. Build Next.js, TypeScript, lint et recette navigateur multi-comptes non exécutés dans cette passe.
5. Aucun déploiement Vercel n’a été demandé ni exécuté.

**Statut :** schéma et sécurités Replay corrigés, test SQL transactionnel PASS ; livraison Git sur `main` et recette applicative restent à vérifier. Non AU VERT.


### Inventaire Git — commits ayant touché les parcours concernés

Après vérification des historiques GitHub de 15 fichiers/migrations et des deux commits racine du schéma, l’inventaire opérationnel comporte **49 références de commits**. Ce chiffre désigne les commits qui ont touché ces surfaces, pas 49 commits tous fautifs. Les changements de catalogue, demandes, créneaux, notifications, recherche, filtres, géolocalisation Admin et index utiles sont conservés. Les voies qui faisaient du membre salarié la source du statut indépendant, du planning public ou de la géolocalisation ont été neutralisées/remplacées dans le nouveau code actif.

| SHA (12 caractères) | Sujet du commit |
|---|---|
| [`6d3c94700fde`](https://github.com/audreymendomo23-netizen/NAXA/commit/6d3c94700fde) | Add partner home service management actions |
| [`18dcc1652223`](https://github.com/audreymendomo23-netizen/NAXA/commit/18dcc1652223) | Build partner home services workspace |
| [`d2baaa27e694`](https://github.com/audreymendomo23-netizen/NAXA/commit/d2baaa27e694) | Show home service request notifications in partner portal |
| [`56200a3ed7e0`](https://github.com/audreymendomo23-netizen/NAXA/commit/56200a3ed7e0) | Filtrer catalogue et demandes de prestations partenaire |
| [`5e17714961c6`](https://github.com/audreymendomo23-netizen/NAXA/commit/5e17714961c6) | Minimiser la lecture des coordonnées privées des demandes |
| [`7746ac1ac8bd`](https://github.com/audreymendomo23-netizen/NAXA/commit/7746ac1ac8bd) | Refresh tracking after partner status updates |
| [`e126632eaa75`](https://github.com/audreymendomo23-netizen/NAXA/commit/e126632eaa75) | Avoid false empty states on partner data errors |
| [`891c2fb4dd8c`](https://github.com/audreymendomo23-netizen/NAXA/commit/891c2fb4dd8c) | Complete guarded empty-state branches |
| [`ed93de651eb6`](https://github.com/audreymendomo23-netizen/NAXA/commit/ed93de651eb6) | Use clear partner data outage message |
| [`80d2de141d71`](https://github.com/audreymendomo23-netizen/NAXA/commit/80d2de141d71) | Stabiliser la vérification du partenaire avant archivage |
| [`ebebb22179f6`](https://github.com/audreymendomo23-netizen/NAXA/commit/ebebb22179f6) | Expliciter la garde TypeScript avant archivage |
| [`828e172b7e1f`](https://github.com/audreymendomo23-netizen/NAXA/commit/828e172b7e1f) | Confirmer créneaux et rappels professionnels |
| [`d1e14b0f5775`](https://github.com/audreymendomo23-netizen/NAXA/commit/d1e14b0f5775) | Confirmer le créneau du rendez-vous |
| [`f0011c4531b8`](https://github.com/audreymendomo23-netizen/NAXA/commit/f0011c4531b8) | Raccorder le réabonnement canonique |
| [`f123ce1db3f4`](https://github.com/audreymendomo23-netizen/NAXA/commit/f123ce1db3f4) | Raccorde le parcours GPS prestations |
| [`53cfdb8d2684`](https://github.com/audreymendomo23-netizen/NAXA/commit/53cfdb8d2684) | Aligne les coordonnées partagées avec le typage Supabase |
| [`efc69d3f0d9d`](https://github.com/audreymendomo23-netizen/NAXA/commit/efc69d3f0d9d) | Ajoute l’éditeur de planning hebdomadaire du personnel médical |
| [`1add51ea5fbe`](https://github.com/audreymendomo23-netizen/NAXA/commit/1add51ea5fbe) | Ajoute la position prioritaire et le planning au tableau de bord partenaire |
| [`48fb4b324988`](https://github.com/audreymendomo23-netizen/NAXA/commit/48fb4b324988) | Enregistre la position professionnelle et le retour à la position admin |
| [`9b27fb5c7f2b`](https://github.com/audreymendomo23-netizen/NAXA/commit/9b27fb5c7f2b) | Raccorde le planning et le partage GPS au tableau de bord partenaire |
| [`4d158353c9bc`](https://github.com/audreymendomo23-netizen/NAXA/commit/4d158353c9bc) | Crée la page de disponibilité du professionnel agréé |
| [`e4670d5a182f`](https://github.com/audreymendomo23-netizen/NAXA/commit/e4670d5a182f) | Ajoute la recherche sécurisée des professionnels agréés, disponibilités et proximité |
| [`a4539c50999b`](https://github.com/audreymendomo23-netizen/NAXA/commit/a4539c50999b) | Ajoute l’annuaire médical avec disponibilité proximité spécialité et recherche IA |
| [`54fe6579fc83`](https://github.com/audreymendomo23-netizen/NAXA/commit/54fe6579fc83) | Fiabilise le jour local dans l’annuaire médical |
| [`c33b61618429`](https://github.com/audreymendomo23-netizen/NAXA/commit/c33b61618429) | Corrige la recherche par symptômes dans l’annuaire médical |
| [`a8491e96b9de`](https://github.com/audreymendomo23-netizen/NAXA/commit/a8491e96b9de) | Utilise les opérations atomiques et auditées pour la position professionnelle |
| [`b86ece26978a`](https://github.com/audreymendomo23-netizen/NAXA/commit/b86ece26978a) | Réutilise la session professionnelle vérifiée pour réinitialiser la position |
| [`6f6ed70d60f5`](https://github.com/audreymendomo23-netizen/NAXA/commit/6f6ed70d60f5) | Limite les suggestions et résultats médicaux à deux caractères minimum |
| [`1d84154f7aff`](https://github.com/audreymendomo23-netizen/NAXA/commit/1d84154f7aff) | Stabilise la lecture de l’heure camerounaise pour l’annuaire |
| [`478c8dccc112`](https://github.com/audreymendomo23-netizen/NAXA/commit/478c8dccc112) | Applique la fermeture du jour aux filtres de l’annuaire |
| [`91800ac4398b`](https://github.com/audreymendomo23-netizen/NAXA/commit/91800ac4398b) | Inclut les rôles médicaux dans le filtre de spécialité et les suggestions IA |
| [`c77e62e5ea88`](https://github.com/audreymendomo23-netizen/NAXA/commit/c77e62e5ea88) | Type les spécialités issues des rôles professionnels |
| [`bd460214830e`](https://github.com/audreymendomo23-netizen/NAXA/commit/bd460214830e) | Stabilise le chargement annuaire et affiche les heures même après fermeture |
| [`b72526f5afe6`](https://github.com/audreymendomo23-netizen/NAXA/commit/b72526f5afe6) | Synchronise le socle GPS et planning appliqué sur Replay |
| [`1734ad9f4808`](https://github.com/audreymendomo23-netizen/NAXA/commit/1734ad9f4808) | Relie la disponibilité aux membres médicaux vérifiés du partenaire |
| [`62e80a0bf409`](https://github.com/audreymendomo23-netizen/NAXA/commit/62e80a0bf409) | Ajoute le repli de disponibilité sur les membres actifs du partenaire |
| [`0a2b64e7fea5`](https://github.com/audreymendomo23-netizen/NAXA/commit/0a2b64e7fea5) | Ferme le critère disponible aujourd’hui après l’heure de fermeture |
| [`5b66ddfb243a`](https://github.com/audreymendomo23-netizen/NAXA/commit/5b66ddfb243a) | Synchronise les positions admin et professionnelles atomiques |
| [`464392325814`](https://github.com/audreymendomo23-netizen/NAXA/commit/464392325814) | Réserve la spécialité affichée aux accréditations vérifiées |
| [`adc0ecb88fa7`](https://github.com/audreymendomo23-netizen/NAXA/commit/adc0ecb88fa7) | Empêche le rayon de proximité de réinitialiser le filtre GPS |
| [`70fb3fb680a9`](https://github.com/audreymendomo23-netizen/NAXA/commit/70fb3fb680a9) | Indexe les références d’audit des positions partenaires |
| [`42608b1a8ad8`](https://github.com/audreymendomo23-netizen/NAXA/commit/42608b1a8ad8) | Consigne les index des clés étrangères d’audit GPS |
| [`01c1d93c542c`](https://github.com/audreymendomo23-netizen/NAXA/commit/01c1d93c542c) | Ajoute la position professionnelle au tableau de bord santé |
| [`23df6f39c9ce`](https://github.com/audreymendomo23-netizen/NAXA/commit/23df6f39c9ce) | Ajoute l’action serveur de position du professionnel |
| [`b8a481249f57`](https://github.com/audreymendomo23-netizen/NAXA/commit/b8a481249f57) | Crée l’éditeur de position du personnel médical |
| [`4ec3178febf0`](https://github.com/audreymendomo23-netizen/NAXA/commit/4ec3178febf0) | Clarifie le retour à la position de repli Admin |
| [`84824708f022`](https://github.com/audreymendomo23-netizen/NAXA/commit/84824708f022) | Protège le planning si son chargement échoue |
| [`56c09681aad9`](https://github.com/audreymendomo23-netizen/NAXA/commit/56c09681aad9) | Ajoute la localisation prioritaire, le planning professionnel et la disponibilité client (migration initiale) |
| [`8a1921e879a8`](https://github.com/audreymendomo23-netizen/NAXA/commit/8a1921e879a8) | Assure la disponibilité même pour les partenaires sans fiche médicale Suivi (logique de repli latéral) |

**Décision sur l’historique :** les anciens commits restent dans l’historique Git pour auditabilité. Ils ne sont pas tous supprimés physiquement de l’ascendance de `main`, car plusieurs commits touchent aussi des fonctionnalités valides et des changements métier indépendants. La correction est une nouvelle version cohérente du code actif et des migrations additives, sans réécriture forcée qui aurait effacé les commits paiement, rendez-vous, notifications ou catalogue.