# Préparation de NAXA Android native — audit et contrat multi-plateforme

**Date :** 12 novembre 2026  
**Référence audit :** `main` — checkpoint initial `6b068c8bab667a3a6da6952714598b6e7872e1ca`  
**Décision produit :** Web + PWA + application Android 100 % native Kotlin, distribuée exclusivement en APK signé depuis le site officiel NAXA. Aucune publication Play Store.

## 1. Décision d'architecture

NAXA reste un seul produit et un seul backend, mais pas une seule interface :

| Cible | Technologie / distribution | Règle |
|---|---|---|
| Web | Next.js 14 / React 18 | Projet actuel conservé |
| PWA | PWA du projet Next.js, Service Worker et manifeste | Même interface Web, installable depuis le navigateur |
| Android | Kotlin + Jetpack Compose, projet natif autonome | APK signé distribué depuis le site NAXA ; aucun WebView, Capacitor ou React Native |

Les trois clients partagent les règles métier, l'authentification, les données et les contrôles serveur. L'application Android ne réutilise pas les composants React : ses écrans, sa navigation, son stockage local, ses permissions et ses intégrations système sont natifs.

Le projet Android sera ajouté au dépôt NAXA, dans un module isolé (cible proposée : `apps/android/`). Il ne doit pas créer une seconde base de données, un second référentiel de rôles ou des règles métier concurrentes.

## 2. Périmètre de l'audit réalisé

Audit ciblé des fichiers et contrats les plus directement concernés par la séparation Web/PWA/Android :

- `package.json`, `next.config.mjs`, `public/manifest.webmanifest` et `worker/index.js` ;
- `src/app/layout.tsx` et `src/middleware.ts` ;
- `src/lib/supabase/client.ts` et `src/lib/supabase/server.ts` ;
- routes Auth représentatives : OAuth Google, OTP, contrôle de mot de passe et modification des mots de passe ;
- `src/lib/pharmacie-code-session.ts` ;
- `supabase/migration_220_offline_device_sync_contract.sql` ;
- protocole d'exécution `AGENTS.md`.

Cet audit est ciblé sur les frontières d'architecture. Il ne constitue pas une revue ligne par ligne de toutes les pages, Server Actions, RPC et policies du dépôt, ni une recette complète Web/PWA.

## 3. Constats — contradictions et causes

### 3.1 Authentification Web liée aux cookies

Le client navigateur utilise `createBrowserClient` de `@supabase/ssr`. Le client serveur utilise `createServerClient` et `next/headers` pour lire/écrire les cookies. Le middleware vérifie la session avec les cookies Supabase.

**Conséquence :** une application Kotlin ne peut pas réutiliser le mécanisme SSR du navigateur. Elle doit obtenir et renouveler ses propres jetons Supabase Auth, puis présenter le jeton d'accès en `Authorization: Bearer <access_token>`.

**Correction préparatoire versionnée :**
- `src/lib/supabase/bearer-auth.ts` lit uniquement l'en-tête Authorization ;
- il appelle `supabase.auth.getUser(token)` pour valider le jeton auprès de Supabase Auth, au lieu de faire confiance à un décodage local des claims ;
- le client de données utilise exclusivement l'URL et la clé publique/anon, porte le JWT du compte et conserve donc les contrôles RLS ;
- aucune clé `service_role` ou `SUPABASE_SECRET_KEY`, aucun cookie et aucune persistance de session serveur ne sont utilisés dans ce helper.

### 3.2 Premier contrat API natif

Route ajoutée : `GET /api/v1/auth/session`.

Elle valide le Bearer token, lit uniquement `profiles` pour l'ID de l'utilisateur authentifié, respecte RLS et retourne un résumé minimal : ID, rôle, état actif et état de vérification d'âge. Elle renvoie `no-store`, refuse un profil absent/inactif et n'expose aucune clé ou donnée privée.

Ce endpoint est un point d'entrée de vérification de session, pas une API métier complète et pas un parcours de connexion. Les futurs écrans natifs devront appeler des endpoints versionnés ou des RPC directement autorisées par RLS ; ils ne doivent pas appeler les Server Actions React.

### 3.3 Garde d'âge

Le middleware Web repose notamment sur le cookie `naxa-age-status-v2`. Un cookie local ne constitue pas une preuve d'âge réutilisable dans l'application native.

**À faire avant la recette Android :** reconstruire le parcours natif de déclaration/vérification, relire l'état persistant du profil côté serveur et faire appliquer les règles d'accès côté API/RLS. Ne jamais se fier à une variable locale ou à un simple écran validé dans le téléphone.

### 3.4 OAuth Google / PKCE

Le parcours Web `/api/auth/google` initialise OAuth et PKCE dans des cookies sur l'hôte canonique. Ce cycle ne doit pas être copié dans l'application Kotlin.

**À faire pour Android :** définir un callback natif vérifiable (Android App Links ou schéma d'application explicitement enregistré), échanger le code PKCE dans le client natif et gérer le renouvellement/révocation des sessions dans le stockage sécurisé Android. Aucun secret OAuth serveur ne doit être embarqué dans l'APK.

### 3.5 Session spéciale pharmacie

`src/lib/pharmacie-code-session.ts` émet un cookie HMAC HttpOnly d'une durée de 15 minutes, qui porte un identifiant pharmacie. La route de changement de mot de passe pharmacie dépend de ce cookie.

**Blocage de portabilité :** ce cookie ne peut pas servir d'identité Android. Avant le parcours natif des comptes pharmacie concernés, il faut définir une session/appareil signée côté serveur, à durée limitée, liée à un utilisateur, à une pharmacie et à une affectation active. Le client ne doit jamais pouvoir choisir librement son `pharmacie_id`. Les mêmes règles de suspension, périmètre et révocation doivent s'appliquer.

### 3.6 Synchronisation hors ligne

La migration `supabase/migration_220_offline_device_sync_contract.sql` contient un registre d'appareils et une RPC de synchronisation réservée à `service_role`. Pour le stock, la fonction compare `base_updated_at` à `stocks.updated_at` et retourne un conflit si le serveur a changé. Le paramètre `p_created_at_ms` figure dans la signature mais n'est pas utilisé dans cette fonction. La documentation NAXA existante signale déjà que la règle de résolution multi-appareils/LWW et la chronologie fiable ne sont pas clôturées.

**Décision :** ne pas implémenter une seconde logique hors ligne dans Android maintenant. Avant toute écriture native hors ligne, établir un contrat unique pour Web/PWA et Android : opérations idempotentes, identité/appareil et périmètre vérifiés côté serveur, ordre serveur fiable, journal des conflits et politique explicite de résolution. Ne pas faire confiance à l'horloge du téléphone et ne pas écraser les mouvements append-only.

### 3.7 Service Worker et notifications

Le Service Worker Workbox et le cache de navigation/images sont propres au navigateur. Ils ne sont ni le moteur offline ni le gestionnaire de notifications de l'application Kotlin. Les API sont exclues de la règle de cache de navigation observée.

Pour Android, il faudra un stockage local natif et une couche de synchronisation dédiée. Le canal de notification natif devra être enregistré par appareil et relié aux préférences/permissions NAXA ; il ne devra pas réutiliser mécaniquement les abonnements Web Push.

## 4. Contrat obligatoire pour les futurs endpoints

Tout endpoint consommé par Android doit :

1. accepter un jeton Bearer Supabase et le vérifier auprès d'Auth ;
2. utiliser un client dont le JWT utilisateur est envoyé à PostgREST/RPC afin que RLS s'applique ;
3. ne jamais accepter un ID utilisateur, rôle, pharmacie ou périmètre comme preuve d'autorisation fournie par le client ;
4. vérifier l'état actif, le rôle fonctionnel, l'affectation, le périmètre et les plafonds côté serveur/RPC ;
5. réserver le client Admin/service-role aux opérations serveur strictement nécessaires, après authentification et autorisation explicites ;
6. avoir un contrat JSON versionné, des erreurs stables, des statuts HTTP corrects et `Cache-Control: no-store` pour les réponses privées ;
7. appliquer idempotence et journalisation aux opérations métier répétables/sensibles.

Le helper Bearer ajouté est un socle partagé pour les routes qui adoptent ce contrat. Il ne transforme pas automatiquement les routes Web existantes en routes Android : chaque route utilisant aujourd'hui cookies, Server Actions ou session pharmacie doit être auditée et migrée explicitement avant d'être exposée au client natif.

## 5. Critères de passage au chantier Kotlin

Le développement Android commencera seulement après stabilisation et recette Web/PWA, conformément au séquencement retenu.

Avant cette ouverture, il faudra clôturer les points suivants :

- [ ] Cartographie complète des pages, Server Actions, RPC et opérations métier nécessaires à chaque rôle.
- [ ] Matrice API v1 : endpoint/RPC, payload, réponse, erreurs, idempotence, rôle et périmètre exigés.
- [ ] Authentification native validée : e-mail/OTP, OAuth, renouvellement, déconnexion, révocation et profil suspendu.
- [ ] Remplacement natif documenté des cookies d'âge et de session pharmacie.
- [ ] Contrats d'accès aux fichiers privés, caméra, scan, ordonnances et permissions.
- [ ] Synchronisation hors ligne commune, notamment stock, conflits et appareils.
- [ ] Notifications natives et enregistrement/révocation d'appareil.
- [ ] Recette API multi-rôles avec comptes réels de test et preuves RLS.
- [ ] Politique APK : signature de release protégée, même certificat pour les mises à jour, versionnement, empreinte SHA-256, canal officiel HTTPS, notes de version et procédure de révocation. L'installation et les mises à jour restent soumises aux protections Android et à l'action de l'utilisateur.

## 6. Changements réalisés dans cette passe

| Fichier | Changement |
|---|---|
| `src/lib/supabase/bearer-auth.ts` | Authentification Bearer et client RLS non privilégié |
| `src/app/api/v1/auth/session/route.ts` | Endpoint v1 de vérification de session native |
| `scripts/test-native-bearer-api-contract.cjs` | Tests statiques de non-régression du contrat Bearer |
| `docs/architecture/NAXA_NATIVE_ANDROID_PREPARATION.md` | Audit, décisions, risques et critères de passage |

Le test ajouté est un contrôle structurel du code source ; il ne remplace pas un appel HTTP avec un vrai JWT ni une recette sur appareil Android.

## 7. Limites et statut honnête

- Le socle Bearer et le endpoint de session sont versionnés sur `main`.
- Aucun projet Kotlin, APK ou écran Android n'est créé dans cette étape.
- Le test statique ajouté n'a pas été exécuté dans un runner local dans cette passe ; le build, TypeScript, lint et CI ne sont donc pas déclarés verts.
- Aucune migration, donnée, clé ou permission Supabase Production n'a été modifiée.
- Aucun déploiement Vercel, APK publié ou distribution n'a été effectué.
- L'authentification native complète, le flux pharmacie par code, l'OAuth natif, les API métier, le hors-ligne multi-appareils et la recette réelle restent ouverts.

**Statut :** préparation d'architecture intégrée ; non certifiée verte avant exécution des tests et recette. Web/PWA restent le chantier prioritaire ; Android natif reste planifié après leur recette.


## Preuves au checkpoint final — 12 novembre 2026

- Tête GitHub `main` après cette passe : `2a930b37dd8ce5cb0859ea028b45111a91c6a59f`.
- Relecture structurelle indépendante des fichiers enregistrés : **7/7 contrôles PASS** (lecture Bearer, validation Auth, clé publique seulement, JWT transmis à RLS, lecture du profil propre, absence de cache privé et inclusion du test dans le glob `npm test`).
- Le script `scripts/test-native-bearer-api-contract.cjs` est découvert automatiquement par `npm test` via `scripts/test-*.cjs`. La commande Node, le TypeScript, le lint et le build n'ont pas été exécutés dans cet environnement ; aucun PASS de runner n'est revendiqué.
- Le statut combiné GitHub de la tête observée ne montre que `ci/circleci: quality = pending`. CircleCI n'a pas été relancé.
- Le miroir GitLab `main` est au commit `61afc7c2983157bbcaa814587db280cedc0e8e51` du 5 novembre 2026, antérieur aux changements GitHub du 12 novembre. Aucun pipeline GitLab n'a été déclenché sur ce miroir obsolète.
- Aucun déploiement, aucune migration ou écriture Production, aucune modification de secret et aucun projet Android n'ont été effectués.
