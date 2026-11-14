# Continuité des recettes E2E NAXA

> **Document de reprise vivant.** Mettre à jour ce fichier dès qu'une réponse fait avancer une recette, apporte une preuve, découvre un blocage ou modifie une décision. Toute correction nécessaire doit être intégrée à la source versionnée sur `main`, vérifiée, puis référencée ici avec son commit. Aucun correctif ne doit rester uniquement dans la conversation.

**Dernière mise à jour :** 14 novembre 2026  
**Dépôt / branche :** `audreymendomo23-netizen/NAXA` / `main`  
**État global :** 🟡 PARTIEL — la recette Storage de base est validée sur Replay (11/11 PASS) ; matrices Admin/Promoteur et autres parcours E2E toujours ouverts.

## 1. Règles et périmètre sécurisé

- Travailler sur `main` uniquement ; aucune branche de travail ni PR.
- Distinguer code modifié, contrôle statique, exécution réelle, nettoyage et recette métier sur appareil.
- **Replay :** `naxa-ci-replay-2`, ref `pwfftcsjyeibxxqhwysw`, URL `https://pwfftcsjyeibxxqhwysw.supabase.co`.
- **Production NAXA :** projet `Naxa`, ref observée `eouwtuusnsuxaejsxknf`. Aucun test destructif, création de compte temporaire, nettoyage automatisé, migration ou déploiement Production dans cette séquence.
- Secrets et mots de passe restent dans GitHub Actions Secrets ; jamais dans Git, le document ou la conversation.
- Workflow Storage strictement épinglé à Replay. `vercel.json` désactive les déploiements Git de `main`. Aucun déploiement Vercel ou Play Store.
- Les deux matrices de rôles facultatives restent désactivées tant que les comptes et affectations Replay ne sont pas correctement préparés.

## 2. Périmètre Storage E2E

Fichiers :
- Workflow : `.github/workflows/naxa-storage-e2e.yml`
- Script : `scripts/storage-e2e.cjs`
- Commande : `npm run test:storage:e2e`
- Déclenchement : `workflow_dispatch` et push sur le workflow, le script, `package.json` ou `package-lock.json`.

Le workflow vérifie la présence de ces trois secrets et refuse toute URL différente de Replay :
- `NAXA_STORAGE_E2E_URL`
- `NAXA_STORAGE_E2E_ANON_KEY`
- `NAXA_STORAGE_E2E_ADMIN_KEY`

Secrets facultatifs pour les matrices :
- Admin : `NAXA_STORAGE_E2E_ADMIN_EMAIL`, `NAXA_STORAGE_E2E_ADMIN_PASSWORD`.
- Promoteur : `NAXA_STORAGE_E2E_PROMOTEUR_EMAIL`, `NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD`, `NAXA_STORAGE_E2E_PROMOTEUR_PHARMACY_ID`, `NAXA_STORAGE_E2E_OTHER_PHARMACY_ID`.
- `require_role_matrix` reste `false` par défaut.

Scénarios de base exécutés :
1. Création de deux comptes Auth techniques temporaires.
2. Upload d'un vrai PDF par son propriétaire et téléchargement par ce propriétaire.
3. Refus de lecture et d'écriture inter-utilisateurs.
4. Refus de lecture anonyme d'un bucket privé.
5. Création et consommation d'une URL signée par le propriétaire ; refus de création par un autre utilisateur.
6. Refus d'un type MIME interdit.
7. Refus d'upload client dans les buckets réservés aux services et à l'administration.
8. Upload de service et lecture HTTP publique d'une vraie image.
9. Suppression propriétaire du PDF et nettoyage administrateur de l'objet public.
10. Révocation des sessions temporaires et suppression des comptes Auth temporaires.

Les matrices Admin et Promoteur sont distinctes et ne sont pas couvertes par le PASS du scénario de base.

## 3. Résultat de la recette Storage de base


| Run | Événement / commit | Résultat | Motif |
|---|---|---|---|
| [Run 1 — 43582501626](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43582501626) | Push, `38cfbcae16fc679cf42050bdd389413de9a0d463` | FAIL préflight | Les trois secrets n'étaient pas encore configurés ; le script n'a pas démarré. |
| [Run 2 — 43595339170](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43595339170) | Manuel, `2c596bf548589f8c6750f3b8d07e8284db3ce5de` | FAIL Auth | Création du premier utilisateur temporaire HTTP 500. |
| [Run 3 — 43595620015](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43595620015) | Push, `440d987dd377d335b416add01ef81685c146b146` | FAIL Auth | Même cause que le run 2 ; préflight et `npm ci` réussis. |
| [Run 4 — 43597515368](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43597515368) | Push, `c026fb9d3737a66c8a67be150a36d994e1f5e47b` | FAIL nettoyage | Les 11 scénarios Storage passent ; suppression des deux comptes Auth échoue sur le trigger d'audit de session. |
| [Run 5 — 43597924877](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43597924877) | Push, `7d9dadd970ef802e4327f0c49b83327696641cbe` | **SUCCESS** | 11 PASS, 2 SKIP optionnels ; sessions, comptes et objets temporaires nettoyés. |

**Preuve du run 5 :**
- Préflight Replay : PASS ; installation des dépendances : PASS.
- Les 11 assertions de base sont PASS : upload PDF, lecture propriétaire, isolation lecture/écriture, refus anonyme, URL signée propriétaire et refusée à un tiers, MIME interdit, buckets réservés, lecture image publique, suppression propriétaire.
- Logs de nettoyage : un objet public supprimé ; deux sessions révoquées ; deux comptes Auth supprimés. Toutes les lignes de nettoyage sont `CLEANUP PASS`.
- Résultat terminal du job : `Storage E2E Replay : 11 PASS, 2 SKIP.`
- Les deux SKIP sont explicites : matrice Admin sans identifiants, matrice Promoteur multi-pharmacies sans compte/UUID configurés.

**Contrôle SQL post-run sur Replay :**
- `auth.users` avec `raw_user_meta_data->>'naxa_storage_e2e' = 'true'` : **0**.
- `storage.objects` avec nom contenant `storage-e2e` : **0**.
- Les deux comptes techniques laissés par l'échec de nettoyage du run 4 ont été supprimés manuellement sur Replay après révocation ciblée de leurs sessions ; le contrôle post-run 5 confirme qu'il ne reste aucun compte technique E2E.

**Conclusion de recette :** le Storage de base est validé sur Replay. Le chantier global reste PARTIEL à cause des deux matrices de rôles et des autres parcours E2E non exécutés.

## 4. Audit des causes racines et corrections enregistrées

### 4.1 Création Auth temporaire — runs 2 et 3

**Cause prouvée :**
- `POST /admin/users` retournait HTTP 500.
- Les logs Auth et PostgreSQL Replay ont relié les erreurs au même appel : SQLSTATE `P0001`, `Nom d'utilisateur invalide`, levé par `public.handle_new_user()`, ligne 27.
- Le trigger valide `raw_user_meta_data->>'username'`, sauf quand `naxa_signup_pending='true'`.
- Le harnais envoyait seulement `{ naxa_storage_e2e: true }` et ne respectait donc pas le contrat prévu pour une identité Auth temporaire.

**Correction :**
- Commit [`c026fb9d3737a66c8a67be150a36d994e1f5e47b`](https://github.com/audreymendomo23-netizen/NAXA/commit/c026fb9d3737a66c8a67be150a36d994e1f5e47b).
- Ajout de `naxa_signup_pending: true` à `user_metadata` lors de la création des comptes techniques.
- Aucun changement du trigger, des policies RLS ou des profils métier. Le run 4 a confirmé que les deux comptes pouvaient désormais être créés et connectés.

### 4.2 Suppression Auth et trigger d'audit de session — run 4

**Cause prouvée :**
- Les scénarios Storage étaient tous PASS, mais `DELETE /admin/users/{id}` retournait HTTP 500 pour les deux comptes techniques.
- Les logs Auth/PostgreSQL Replay ont révélé SQLSTATE `23503` sur la FK `naxa_session_audit_user_id_fkey`.
- La suppression du compte cascade vers ses lignes `auth.sessions`. Le trigger `trg_naxa_session_audit_delete` exécute `public.naxa_audit_session_delete()`, qui tente d'insérer `SESSION_REVOKED` dans `public.naxa_session_audit` en gardant `old.user_id`. Durant la cascade de suppression du parent Auth, cette insertion viole la FK vers l'utilisateur en cours de suppression.
- Le `HTTP 500` vient donc du trigger d'audit PostgreSQL, et non des droits Storage.

**Correction du harnais :**
- Commit [`7d9dadd970ef802e4327f0c49b83327696641cbe`](https://github.com/audreymendomo23-netizen/NAXA/commit/7d9dadd970ef802e4327f0c49b83327696641cbe).
- Le harnais conserve l'ID et le jeton de chaque compte temporaire, révoque d'abord sa session avec `POST /auth/v1/logout?scope=local`, puis supprime le compte via Admin API.
- Le scope `local` ne révoque que la session en cours de ce compte de test.
- Run 5 confirme deux révocations et deux suppressions sans erreur.

**Risque général restant :** la logique SQL du trigger n'a pas été modifiée. Toute suppression Auth d'un compte possédant encore des sessions actives pourrait emprunter le même chemin de cascade. Le correctif E2E contourne ce chemin en révoquant la session avant la suppression ; une revue séparée de la logique d'audit de suppression reste à conduire avant de corriger ou modifier le trigger. Aucune migration SQL n'a été appliquée dans cette passe.

## 5. Autres chantiers E2E — état connu

| Parcours | État prouvé | Réserve restante |
|---|---|---|
| Storage HTTP / isolation client / nettoyage | **11/11 PASS** au run 5 ; zéro compte et objet E2E résiduel sur Replay. | Matrices Admin et Promoteur multi-pharmacies encore SKIP. |
| Matrice Auth Admin / Promoteur / multi-pharmacies | Scénarios optionnels présents dans le script. | Comptes et affectations Replay à préparer ; ne pas activer avant validation des comptes. |
| Réservation → préparation Gestionnaire Stock → proposition Livreur → acceptation → suivi Client → livraison → paiement → clôture/reporting | Parcours métier défini dans le périmètre NAXA. | Aucune preuve E2E intégrale de bout en bout enregistrée. |
| Caméra, galerie, PDF, scanner/OCR sur appareils réels | Fonctions concernées identifiées. | Recette Android réelle à exécuter ; pas de preuve appareil. |
| GPS, Bluetooth, SMS, notifications FCM et mode hors ligne | Contrats et structures partiellement vérifiés dans les travaux antérieurs. | Réception et comportement sur téléphones enrôlés non prouvés. |
| Sécurité Supabase Replay | Les tests de rôles 287, 295, 296, 297, 298 et 299 totalisent 45 assertions PASS selon `STATUT.md`. | Ne remplace pas une recette complète de toutes les RPC et policies. |
| Exposition API du schéma `private` | Privilèges SQL inventoriés. | Confirmer le réglage Supabase « Exposed schemas » ; ne pas révoquer globalement USAGE/EXECUTE sans analyse. |
| Protection HIBP des mots de passe compromis | Blocage de plan documenté. | Organisation sur Free ; fonctionnalité réservée à Pro ou supérieur ; aucune montée de plan autorisée. |

Les autres historiques et preuves de sécurité restent référencés dans `STATUT.md` et `docs/audits/AUDIT_360_ADMINISTRATEUR_NAXA.md`. Ne pas convertir des contrôles SQL isolés en validation E2E métier.

## 6. Prochain point de reprise

1. Préparer des comptes Auth et affectations Replay réels pour la matrice Admin/Promoteur ; conserver `require_role_matrix=false` tant qu'ils ne sont pas prêts.
2. Examiner séparément le trigger `naxa_audit_session_delete` et les suppressions normales d'utilisateurs avec sessions actives ; ne pas déployer de correction SQL sur Production.
3. Poursuivre par le parcours navigateur métier réservation → Stock → Livreur → Client → paiement/clôture.
4. Continuer par les recettes Android sur téléphones enrôlés : caméra, galerie/PDF/OCR, GPS/Bluetooth, SMS/FCM et offline.

## 7. Journal de continuité

| Date | Commit / preuve | Avancement |
|---|---|---|
| 14/11/2026 | Base `2c596bf548589f8c6750f3b8d07e8284db3ce5de` | État initial de la séquence E2E. |
| 14/11/2026 | `47738ab30842ac041c7ead08d3038dede96bcd46` | Le nettoyage incomplet ne peut plus être silencieusement ignoré. |
| 14/11/2026 | `440d987dd377d335b416add01ef81685c146b146` | Déclenchement du workflow sur les changements du harnais et de ses dépendances. |
| 14/11/2026 | `ba49e13c660108f944d74dcd50e177dcc693320d` | Création du document de continuité E2E. |
| 14/11/2026 | `c026fb9d3737a66c8a67be150a36d994e1f5e47b` | Cause Auth « Nom d'utilisateur invalide » corrigée par le marqueur de signup provisoire. |
| 14/11/2026 | `343363e6fc96d863597e6234647cee446cfd0ce4` | Premier diagnostic documenté ; cette révision remplace la version du document devenue dupliquée. |
| 14/11/2026 | `7d9dadd970ef802e4327f0c49b83327696641cbe` | Révocation de la session avant suppression Auth ; run 5 SUCCESS : 11 PASS, 2 SKIP et nettoyage complet. |
| 14/11/2026 | `3718b8bcf61710b0832524cf409b1b6123787e4f` | Consolidation du présent document ; correction de son ancienne duplication et mise à jour des preuves Storage. |

---

**Règle de reprise :** commencer par le dernier commit et le dernier run disponibles ; consigner les preuves, corrections et SHA ; conserver les réserves ouvertes ; ne jamais déclarer AU VERT sans preuves d'exécution réelles.


## 8. Reprise recette globale et préparation des comptes (14/11/2026)

**Décision utilisateur :** autorisation explicite de créer les comptes de recette sur Supabase Replay uniquement, avec données fictives ; Production exclue.

**Contrôles préalables effectués :**
- Projet ciblé : Replay `pwfftcsjyeibxxqhwysw`.
- Profils présents au contrôle : un seul profil `admin`.
- Pharmacies : 9 au total, 9 marquées `est_demo=true`, aucune non-démo.
- Relations `promoteur_pharmacies` : 0 relation, donc aucune pharmacie actuellement rattachée à un Promoteur dans Replay.
- Rôles actifs du référentiel : `admin`, `client`, `promoteur`, `caisse`, `comptable`, `gestionnaire_stock`, `livreur`, `magasinier`, `pharmacien`, `responsable`, `pharmacie`. Les fonctions professionnelles sont marquées assignables selon le référentiel.
- Le trigger `auth.users` appelle `public.handle_new_user()`. Pour les identités Auth provisoires, le marqueur `naxa_signup_pending=true` empêche la création prématurée d'un profil ; le profil et les affectations doivent ensuite être créés explicitement selon les règles métier.

**Limite d'exécution rencontrée :**
- Les outils Supabase disponibles dans cette session exposent les requêtes SQL et la gestion de projet, mais aucune action Auth Admin `createUser`/invitation ni aucun canal sûr pour remettre les mots de passe de comptes persistants.
- Aucune insertion directe dans `auth.users` n'a été tentée : contourner l'API Auth et fabriquer des mots de passe par SQL serait une méthode fragile et non acceptable pour cette recette.
- En conséquence, l'autorisation est enregistrée, mais **aucun des six comptes n'est encore créé**. Pas d'écriture de comptes ni d'affectations dans Replay pendant cette passe.

**Correction du contrat qualité :**
- Les runs NAXA quality 2883 à 2885 échouaient sur une assertion obsolète du test statique `scripts/test-storage-contract.cjs` : il cherchait `deleteUser(id)`, alors que le harnais révoque désormais la session puis exécute `deleteUser(user.id)`.
- Commit `7df278ec7cb53199338842ca4504c643c40b3f58` : le test vérifie explicitement l'appel `logoutTemporaryUser(user.accessToken)`, le chemin `/auth/v1/logout?scope=local` et l'ordre révocation avant suppression.
- Run NAXA quality **2886** sur ce commit : job complet PASS (tests, TypeScript, lint et build Next.js) ; contrôle actionlint des workflows PASS.

**Statut à cette reprise :**
- Qualité logicielle CI : PASS sur commit `7df278ec7cb53199338842ca4504c643c40b3f58`.
- Storage Replay : 11 PASS, 2 SKIP (preuve run 5 antérieure).
- Matrice des comptes et affectations : **BLOQUÉE — action Auth Admin indisponible dans les outils de cette session**.
- Aucun compte, affectation ou donnée métier ajouté à Replay dans cette passe ; Production et Vercel non touchés.

**Prochain point précis :** fournir un canal d'administration Auth utilisable par le workflow de recette (par exemple secrets GitHub dédiés au harnais avec création automatisée et credentials générés/stockés hors logs), puis créer les identités et leurs affectations sur Replay, vérifier chaque login et lancer la matrice Admin/Promoteur/Client/équipe. Ne jamais afficher les secrets ni faire transiter les mots de passe dans le dépôt.


## 9. Secrets Supabase génériques reliés au workflow Replay (14/11/2026)

**Retour utilisateur :** les deux secrets génériques `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` ont été ajoutés dans GitHub Actions Secrets. Leurs valeurs n'ont pas été consultées ni exposées.

**Contrôle du contrat initial :**
- Le workflow `.github/workflows/naxa-storage-e2e.yml` ne transmettait initialement au job que les secrets `NAXA_STORAGE_E2E_URL`, `NAXA_STORAGE_E2E_ANON_KEY` et `NAXA_STORAGE_E2E_ADMIN_KEY`.
- Le script `scripts/storage-e2e.cjs` acceptait déjà `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` comme replis, mais le workflow ne les injectait pas dans l'environnement du job. Les replis du script étaient donc inopérants via GitHub Actions.
- Une clé anon reste obligatoire ; le workflow conserve les secrets dédiés existants et accepte également `NEXT_PUBLIC_SUPABASE_ANON_KEY` ou `SUPABASE_ANON_KEY` comme alias.

**Correction versionnée sur main :**
- Commit `3a2c98a2d83383d8dcdb6e0b367516037498046a`.
- Le workflow mappe désormais les alias génériques vers les variables attendues par le harnais, tout en donnant priorité aux secrets dédiés `NAXA_STORAGE_E2E_*`.
- L'URL reste strictement épinglée à `https://pwfftcsjyeibxxqhwysw.supabase.co` ; une URL Production est refusée au préflight.
- Le lancement du workflow est déclenché par le changement du fichier workflow. Son résultat doit être contrôlé avant toute activation de matrice de rôles.

**Limite de cette étape :** ce correctif relie les secrets existants ; il ne crée aucun compte persistant Admin/Promoteur/équipe et ne modifie aucune donnée métier. Ne jamais afficher les clés ni les mots de passe.


**Preuve d'exécution après correction :**
- Run Storage Replay **6** : [43600197045](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43600197045), commit testé `3a2c98a2d83383d8dcdb6e0b367516037498046a`, conclusion GitHub Actions **SUCCESS**.
- Préflight des identifiants Replay : PASS ; le workflow a bien démarré avec les alias génériques.
- Recette de base : **11 PASS, 2 SKIP** ; les deux SKIP restent uniquement les matrices Admin et Promoteur, faute de comptes persistants/affectations.
- Nettoyage : objet Storage supprimé, deux sessions temporaires révoquées et deux comptes Auth temporaires supprimés. Aucune création de compte métier persistant.
- Ce résultat prouve le branchement URL + clé Admin et la disponibilité d'une clé anon via les secrets déjà présents ; il ne prouve pas que les matrices de rôles sont configurées.


## 10. Contrat de création des profils et prérequis matrice Admin (14/11/2026)

**Audit du parcours applicatif :**
- `src/app/api/auth/complete-signup/route.ts` finalise un compte Client : session Auth vérifiée, e-mail confirmé, âge >=18 ans, consentement, nom d'utilisateur, identité et téléphone pays. Le profil est créé avec `role='client'`.
- `supabase/migration_085_signup_pending_no_profile.sql` confirme que `naxa_signup_pending=true` évite la création automatique du profil. Le compte temporaire Storage utilise volontairement ce marqueur et ne constitue donc pas un compte métier.
- Les rôles professionnels ne doivent pas être fabriqués en modifiant directement `profiles.role` ou en insérant arbitrairement des affectations. Le contrat métier utilise les fonctions autorisées, notamment `accrediter_profile`, `naxa_grant_professional_assignment` et les mécanismes spécifiques Promoteur.
- Le flux d'invitation Livreur versionné dans `supabase/migrations/20261106154000_livreur_invitation_signup.sql` exige d'abord un compte Client finalisé et une invitation émise par un Promoteur ou un compte Pharmacie autorisé ; il refuse qu'un Livreur cumule un autre poste professionnel actif.

**Contrôle Replay complémentaire :**
- Un profil Admin actif existe.
- Son identité Auth est confirmée et possède un mot de passe configuré (contrôle agrégé uniquement ; aucun email ni hash/mot de passe n'a été lu ou divulgué).
- Le workflow Storage sait déjà exécuter la matrice Admin si les deux secrets `NAXA_STORAGE_E2E_ADMIN_EMAIL` et `NAXA_STORAGE_E2E_ADMIN_PASSWORD` sont renseignés.
- Aucun de ces identifiants n'a été extrait de la base, ni testé dans cette passe.

**Point de reprise concret :**
1. L'utilisateur ajoute les deux secrets Admin ci-dessus dans GitHub Actions, avec les identifiants du compte Admin Replay existant ; ne jamais les transmettre dans le chat.
2. Exécuter la matrice Admin et vérifier son nettoyage.
3. Préparer ensuite un compte Client de test par le parcours normal, puis le faire accréditer/affecter par les fonctions métier autorisées pour construire les matrices Promoteur et équipe. Ne pas activer `NAXA_STORAGE_E2E_REQUIRE_ROLE_MATRIX=1` avant d'avoir les UUID et les comptes validés.

**Aucune écriture métier n'a été effectuée sur Replay dans cette étape. Production et Vercel restent intacts.**

## 11. Première tentative de matrice Storage Admin — échec d'authentification (14/11/2026)

**Retour utilisateur :** les secrets GitHub Actions `NAXA_STORAGE_E2E_ADMIN_EMAIL` et `NAXA_STORAGE_E2E_ADMIN_PASSWORD` ont été ajoutés. Leurs valeurs ne sont ni lues ni exposées dans le chat.

**Exécution :**
- Run Storage Replay **6**, tentative **2** : [43600197045](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43600197045).
- Job relancé avec succès ; commit testé : `3a2c98a2d83383d8dcdb6e0b367516037498046a`.
- Installation npm : PASS.
- Préflight URL/identifiants Replay : PASS ; GitHub masque les variables Admin dans les logs.
- Recette Storage de base : **10 PASS** avant la tentative de connexion Admin.
- Nettoyage : objets Storage supprimés et sessions/comptes temporaires nettoyés ; nettoyage complet à confirmer dans le récapitulatif final du script.
- Échec : `Connexion du rôle Admin actif impossible (HTTP 400)`. Le script ne journalise pas le corps de réponse Auth ; la cause précise (adresse ou mot de passe incorrect, compte/état Auth) n'est donc pas établie. Ne pas conclure que le compte Admin est invalide sans diagnostic supplémentaire.

**Interprétation :**
- La présence des deux secrets est confirmée par leur injection masquée dans le job ; cela ne valide pas leurs valeurs.
- La connexion Admin n'a pas été validée. La matrice Admin reste **BLOQUÉE — authentification HTTP 400**.
- Les matrices Promoteur restent non configurées : les secrets Promoteur et UUID des pharmacies ne sont pas présents dans l'environnement de ce run.
- Aucun compte métier persistant, profil ou affectation n'a été créé/modifié par cette relance. Projet strictement Replay ; Production et Vercel non touchés.

**Prochain point précis :** vérifier dans Supabase Replay > Authentication > Users l'adresse du compte Admin existant, puis ressaisir dans GitHub Actions les secrets Admin correspondants (sans partager le mot de passe dans le chat). Ensuite relancer le même job. Si l'échec persiste, instrumenter le harnais pour journaliser uniquement le code/message Auth non sensible, jamais l'adresse ni le mot de passe.


## 12. Disparition apparente du compte Admin Replay — vérification en lecture seule (14/11/2026)

**Signalement utilisateur :** dans Supabase Replay > Authentication > Users, le seul compte visible est différent du compte Admin attendu.

**Vérifications directes effectuées sur Replay uniquement :**
- Lecture agrégée de `auth.users` : **1 seul utilisateur Auth actuellement présent**. Aucun email, hash ou secret n'a été extrait dans le compte rendu.
- Consultation des événements `auth_audit_logs` disponibles sur la fenêtre récente (24 heures) : les événements `user_deleted` observés concernent uniquement des adresses techniques `naxa-storage-e2e-...@example.invalid`, supprimées par `service_role`.
- Recherche ciblée sur cette même fenêtre d'un événement `user_deleted` dont l'adresse ne serait pas une adresse temporaire `example.invalid` : **aucun résultat**.
- Le code versionné de `scripts/storage-e2e.cjs` confirme que `createdUsers` ne reçoit que les deux comptes générés par `createTemporaryUser()`. Le compte Admin préexistant, utilisé par `loginExisting()`, n'est pas ajouté à la liste supprimée par le nettoyage.

**Conclusion limitée :**
- Le workflow Storage Replay examiné ne fournit pas de preuve qu'il ait supprimé le compte Admin.
- Les journaux consultés ne montrent aucune suppression d'un compte non temporaire durant les dernières 24 heures.
- Le compte Admin est néanmoins absent de l'état actuel de `auth.users` (un seul utilisateur restant). La date et l'origine de sa disparition ne sont pas établies par les traces récentes consultées ; une suppression antérieure à cette fenêtre ou une autre opération reste possible.
- **État : BLOQUÉ — compte Admin Replay manquant / cause racine non déterminée.** Ne pas recréer le compte, ne pas modifier les profils/roles par SQL, ne pas relancer de nettoyage Auth. Production et Vercel restent intacts.

**Prochain point précis :** examiner l'historique Auth plus ancien disponible et les journaux des autres workflows/actions susceptibles d'avoir utilisé une clé privilégiée. Ensuite seulement, définir une restauration contrôlée du compte Admin via le mécanisme Auth officiel, avec vérification du profil métier existant et sans duplication.

## 13. Identification de l'adresse prévue pour le premier compte Admin (14/11/2026)

**Demande utilisateur retrouvée dans le contexte antérieur :** le 11/10/2026, l'adresse explicitement demandée pour le futur compte Admin N0 était `naxa.home@gmail.com`.

**Audit du code actuel sur `main` :**
- `docs/BOOTSTRAP-PREMIER-ADMIN.md` nomme explicitement `naxa.home@gmail.com` comme seule adresse autorisée au bootstrap du premier Admin.
- `src/app/api/auth/admin-bootstrap/route.ts` fixe `ALLOWED_EMAIL = "naxa.home@gmail.com"`, vérifie le secret serveur `NAXA_ADMIN_BOOTSTRAP_SECRET`, recherche ce compte dans Auth, exige que son email soit confirmé, puis appelle la RPC `naxa_bootstrap_first_admin`.
- `supabase/migration_080_first_admin_bootstrap.sql` n'autorise que cette adresse, vérifie la confirmation email et l'absence préalable d'un profil `admin`, puis passe le profil existant à `role='admin'`. La fonction est exécutable uniquement par `service_role`.
- `supabase/tests/080_first_admin_bootstrap.sql` vérifie structurellement la liste blanche email, la confirmation, le verrou anti-concurrence, l'absence d'Admin préexistant et l'interdiction d'exécution par `anon`/ `authenticated`.

**Conclusion :** l'adresse demandée et codée pour le premier administrateur NAXA est **`naxa.home@gmail.com`**. Le mécanisme est un bootstrap unique d'un compte Auth déjà créé et confirmé ; il ne crée pas lui-même le compte Auth. La présence actuelle de cette adresse dans Replay n'a pas été établie par cette inspection de code. Ne pas supposer qu'un autre utilisateur actuellement visible est l'Admin attendu.

**Point de reprise :** comparer l'adresse Auth du seul utilisateur Replay à `naxa.home@gmail.com`, puis vérifier l'existence du profil correspondant avant toute restauration. Aucune écriture Auth, SQL métier, migration distante, modification de secret ou action Production/Vercel effectuée pendant cet audit.

## 14. Comparaison de l'identité Auth Replay et du compte Admin attendu (14/11/2026)

**Contrôle SQL strictement en lecture seule sur Replay** (pwfftcsjyeibxxqhwysw) :
- Jointure de l'unique ligne auth.users avec public.profiles sur l'UUID Auth.
- Adresse Auth présente : naxa.e2e.20261104.admin@example.invalid.
- Cette adresse est **différente** de l'adresse Admin attendue et autorisée par le bootstrap : naxa.home@gmail.com.
- L'email du compte actuellement présent est confirmé.
- Un profil NAXA correspondant existe et son rôle actuel est admin.

**Conclusion vérifiée :**
- Replay contient actuellement un profil de rôle admin, mais il est lié à une identité technique E2E @example.invalid, pas à l'adresse Admin N0 demandée.
- Le contrôle ne prouve pas que naxa.home@gmail.com ait été supprimée ; il prouve seulement qu'elle ne figure pas parmi les utilisateurs Auth actuels (la base n'en retourne qu'un).
- La cause et la date de disparition éventuelle du compte attendu restent inconnues.
- Ne pas utiliser le compte technique comme substitut de l'identité Admin attendue ; ne pas le supprimer, renommer, promouvoir/dégrader ou modifier. Ne pas créer/recréer naxa.home@gmail.com ni lancer le bootstrap avant audit de l'historique et vérification des contraintes métier.
- Production et Vercel non consultés/non modifiés ; aucune écriture Auth ou SQL métier exécutée.

**Point de reprise :** auditer les migrations, fonctions, workflows et historiques disponibles qui auraient pu créer le compte technique naxa.e2e.20261104.admin@example.invalid ou supprimer naxa.home@gmail.com. Déterminer ensuite la procédure de restauration Auth officielle, en conservant l'intégrité du profil et des références métier.

## 15. Nouvelle tentative de la matrice Storage Admin après mise à jour des secrets (14/11/2026)

**Retour utilisateur :** les variables/Secrets GitHub Actions ont été renseignés avec l'identité Admin attendue naxa.home (valeur exacte non consultée ni exposée).

**Relance effectuée :**
- Relance des jobs échoués du workflow Storage Replay, run 43600197045, tentative 3, sur commit 3a2c98a2d83383d8dcdb6e0b367516037498046a.
- GitHub a accepté la relance ; le run est passé à l'état queued puis le job unique est apparu in_progress.
- Au dernier contrôle, les étapes Checkout étaient en cours ; installation, préflight, matrice Storage et nettoyage n'avaient pas encore fourni de résultat.
- L'exécution reprend le workflow existant, épinglé exclusivement à l'URL Replay pwfftcsjyeibxxqhwysw. Aucune activation de la matrice Promoteur n'a été demandée ; aucun secret ni mot de passe n'a été lu ou affiché.

**État : EN COURS — aucun PASS/FAIL de la tentative 3 ne peut encore être annoncé.** Le compte Auth technique observé dans Replay n'a pas été modifié ; aucune écriture Auth ou métier, migration distante, action Production ou Vercel effectuée.

**Point de reprise :** consulter la conclusion du run 43600197045, tentative 3, puis ses étapes/logs pour vérifier le résultat de la connexion Admin et le nettoyage. Actualiser cette section avec la preuve finale avant toute conclusion.

## 16. Résultat de la tentative 3 — accès Admin non accepté (14/11/2026)

**Preuve GitHub Actions :** run 43600197045, tentative 3, commit testé 3a2c98a2d83383d8dcdb6e0b367516037498046a.
- Checkout, Node 22, installation npm et préflight Replay : PASS.
- Les variables NAXA_STORAGE_E2E_ADMIN_EMAIL et NAXA_STORAGE_E2E_ADMIN_PASSWORD sont présentes dans l'environnement du job (valeurs masquées par GitHub ; aucune valeur secrète lue ou exposée).
- Les 10 assertions Storage exécutées : PASS (upload/téléchargement propriétaire, isolation inter-utilisateur, refus sans session, URLs signées, MIME, buckets réservés, image publique).
- Nettoyage : PASS pour les deux objets, révocation des deux sessions temporaires et suppression des deux comptes temporaires.
- Échec final : « Storage E2E FAILED — Connexion du rôle Admin actif impossible (HTTP 400). » L'étape d'authentification Admin échoue donc malgré la présence des secrets. Cela ne permet pas de conclure si l'email, le mot de passe ou l'état Auth du compte est la cause ; la réponse HTTP 400 n'est pas suffisamment détaillée dans le log.
- Variables Promoteur non renseignées ; matrice Promoteur non exigée (REQUIRE_ROLE_MATRIX=0). Aucun test Promoteur effectué.

**Conclusion :** accès Admin NON VALIDÉ. La simple présence de naxa.home dans les secrets ne prouve pas que l'identité existe dans Replay ni que le mot de passe associé soit correct. Ne pas modifier le compte technique E2E actuellement admin et ne pas lancer de bootstrap/création de compte à l'aveugle.

**Point de reprise :** vérifier dans Replay l'existence Auth de naxa.home@gmail.com, la confirmation email et l'état du profil lié ; puis contrôler de façon sécurisée la variable de mot de passe correspondante sans jamais l'afficher. Après correction éventuelle, relancer le workflow pour obtenir une preuve de connexion Admin. Production/Vercel non touchés.


## 17. Demande de restauration du compte Admin N0 — blocage outil Auth (14/11/2026)

**Décision utilisateur :** « restaure » — autorisation explicite de restaurer l'identité Admin attendue `naxa.home@gmail.com` sur Supabase Replay uniquement.

**État signalé et contrôles :**
- L'utilisateur confirme que `naxa.home@gmail.com` n'existe pas parmi les utilisateurs Auth de Replay.
- Projet ciblé : Replay `pwfftcsjyeibxxqhwysw`. Production `eouwtuusnsuxaejsxknf` exclue.
- Le schéma `public.profiles` a été inspecté en lecture seule ; il contient notamment `id`, `role`, `username`, `first_name`, `last_name`, etc., mais aucun champ email direct.
- Les outils Supabase disponibles dans cette session ne proposent aucune action Auth Admin `createUser`, restauration ou invitation. Ils permettent les requêtes SQL et opérations de projet uniquement.

**Décision de sécurité / limite d'exécution :**
- Aucune insertion directe dans `auth.users` n'a été tentée. Elle ne remplace pas l'API Auth officielle et risquerait de produire une identité incomplète/incohérente.
- Aucun profil, rôle ou affectation n'a été créé/modifié ; le compte technique `naxa.e2e.20261104.admin@example.invalid` n'a pas été touché.
- Le mécanisme `naxa_bootstrap_first_admin` ne crée pas l'identité Auth : il ne peut être exécuté qu'après création officielle et confirmation de l'adresse autorisée.
- Aucun mot de passe n'a été généré, lu ou transmis. Aucun secret GitHub n'a été modifié.
- Production, Vercel et Play Store non touchés.

**Résultat :** restauration demandée mais **NON EFFECTUÉE — BLOQUÉE par l'absence d'une action Auth Admin officielle dans les outils disponibles**. Ne pas déclarer l'identité restaurée.

**Point de reprise précis :** créer `naxa.home@gmail.com` dans Supabase Replay via Authentication > Users (ou via l'API Admin Auth sécurisée exécutée dans un environnement contrôlé), confirmer l'adresse et configurer un mot de passe robuste hors chat. Ensuite vérifier le profil associé, appeler le bootstrap Admin existant et relancer la matrice Admin Storage. Ne pas toucher au compte technique existant.


## 18. Défaut de cookies Supabase SSR en Production — correction et déploiement (14/11/2026)

**Cause racine confirmée avant correction :**
- Production exécutait Next.js 16.4.6 avec `@supabase/ssr` 0.5.2.
- `src/lib/supabase/server.ts` appelait `cookies()` de Next.js comme si le résultat était un magasin synchrone, au moyen d'un cast TypeScript. Dans cette version de Next, `cookies()` fournit une promesse ; le cast ne résout pas cette promesse.
- Vercel avait enregistré `TypeError: t.getAll is not a function` sur `/api/auth/google`, ainsi que `getAll is not a function` sur les pages SSR protégées. La même fabrique était utilisée par le flux de connexion par mot de passe et le callback OAuth Google.
- Le déploiement Production antérieur n'incluait pas de correction applicative de cette fabrique.

**Correction versionnée sur `main` :**
- Commit `f60cb975953cd43ddeb7467bbcf26664bb836c4f`.
- Fichier modifié : `src/lib/supabase/server.ts`.
- L'adaptateur Supabase conserve la fabrique synchrone pour ne pas casser les appelants existants ; `getAll` et `setAll` deviennent asynchrones et attendent le cookie store résolu par `cookies()`.
- Les écritures de cookies restent protégées contre le contexte Server Components qui ne permet pas de modifier les cookies de réponse au rendu.
- Aucun secret, variable d'environnement Supabase, utilisateur ou donnée métier n'a été modifié.

**Publication Vercel Production :**
- Projet : `naxa` ; déploiement `dpl_BdfoPmMgB5zuDXjGzY4pd9LoCRGq`.
- SHA déployé : `f60cb975953cd43ddeb7467bbcf26664bb836c4f`.
- État Vercel : `READY` ; alias de Production confirmés : `nnaxa.vercel.app`, `naxa-opal.vercel.app`, `naxa-naxa3.vercel.app`, `naxa-git-main-naxa3.vercel.app`.
- Build Vercel terminé ; les 392 tests automatisés du pipeline ont réussi, aucun échec de test. TypeScript et compilation Next.js ont atteint la fin du build. Des avertissements ESLint/React et de compatibilité React 18 avec Next.js 16 sont présents ; ils ne sont pas des échecs bloquants de ce build.
- Le garde-fou Vercel qui empêche les builds automatiques ordinaires de `main` a été conservé ; l'exception de publication ne vise que le SHA autorisé ci-dessus. Les futurs pushs `main` restent soumis au mode de publication manuelle.

**Contrôle post-déploiement et réserve :**
- Le déploiement Production est `READY` et porte les alias de domaine attendus.
- Les logs runtime filtrés sur ce nouveau déploiement, sur la fenêtre consultée, n'ont retourné aucune entrée error/fatal. Cela ne constitue pas encore une preuve de connexion utilisateur réussie.
- Les agrégats d'erreurs encore visibles concernent le déploiement précédent `dpl_GpncGxV63iJACaUWk7KDe5M8fUbF` et des événements dont le dernier est antérieur à la fin du nouveau build ; ils ne démontrent pas la persistance du défaut dans le nouveau déploiement.
- La validation fonctionnelle finale doit encore être faite en conditions réelles : connexion mot de passe avec un compte autorisé, lancement OAuth Google jusqu'au retour callback, puis accès à une page protégée. Aucun mot de passe ni compte de test n'a été créé/utilisé dans cette passe.

**État :** correctif commité sur `main` et Production déployée `READY`. Le défaut d'implémentation des cookies est corrigé ; le succès de connexion réelle par mot de passe et Google reste à confirmer par un essai utilisateur contrôlé.



## 18. Nouvelle relance du job Storage Replay — en attente (14/11/2026)

**Demande utilisateur :** relancer le run Storage Replay précédent après le point de blocage Auth Admin.

**Action effectuée :**
- Relance des seuls jobs échoués du run GitHub Actions `43600197045` via la fonction GitHub Actions de rerun failed jobs.
- GitHub a confirmé l'acceptation de la relance (`success=true`).
- Contrôle immédiat des jobs : job `132477787960`, « Upload/download réel, isolation RLS et nettoyage Replay », état **queued**.
- Projet ciblé par le workflow : Replay uniquement. Aucun changement de code, secret, compte Auth, profil ou donnée métier effectué par cette relance.
- Production et Vercel non touchés.

**État : EN ATTENTE —** le job est en file d'attente. Aucun résultat PASS/FAIL de cette nouvelle tentative n'est encore disponible.

**Point de reprise :** recontrôler le job `132477787960` et ses logs après exécution ; vérifier séparément le résultat Storage, l'authentification Admin et le nettoyage. Ne pas conclure au succès sur la seule acceptation de la relance.


## 19. Création du compte Admin Replay — erreur Auth confirmée par les journaux (14/11/2026)

**Retour utilisateur :** la création manuelle dans Supabase Authentication > Users retourne `Failed to create user: Database error creating new user`.

**Preuve PostgreSQL Replay :**
- Projet contrôlé : Replay `pwfftcsjyeibxxqhwysw` uniquement.
- Les journaux PostgreSQL contiennent deux tentatives d'insertion Auth autour de 14:39 UTC, avec SQLSTATE `P0001`.
- Message exact levé : `Nom d'utilisateur invalide`.
- Contexte PostgreSQL : `PL/pgSQL function public.handle_new_user() line 27 at RAISE`.
- La fonction `public.handle_new_user()` est déclenchée par `on_auth_user_created`, après insertion dans `auth.users`.
- Le code de la fonction exige un `raw_user_meta_data.username` valide, sauf si le marqueur `naxa_signup_pending=true` est présent. Le formulaire Dashboard utilisé n'a pas fourni ce marqueur ni le nom d'utilisateur attendu ; l'exception annule donc la transaction Auth.
- La documentation Supabase confirme qu'un trigger de création de profil qui échoue peut bloquer l'inscription.

**Cause racine :** incompatibilité entre la création d'un utilisateur depuis le Dashboard Supabase (métadonnées métier absentes) et le contrat strict du trigger NAXA `handle_new_user()`. Ce n'est pas un problème de mot de passe, d'adresse email ou de disponibilité du projet.

**État et sécurité :**
- La transaction ayant échoué, aucune identité Auth issue de ces tentatives n'est considérée créée.
- Aucun trigger n'a été désactivé ou modifié ; aucune donnée Auth/profil/rôle n'a été insérée directement par SQL.
- Le compte technique Admin E2E existant reste intact.
- Aucun changement sur Production, Vercel, GitHub Secrets ou Play Store.
- La route `/api/auth/admin-bootstrap` ne crée pas l'identité Auth ; elle ne peut promouvoir que le compte `naxa.home@gmail.com` déjà créé, confirmé et doté d'un profil NAXA.

**Correction à concevoir avant reprise :**
1. Utiliser le parcours NAXA d'inscription contrôlée qui envoie explicitement `naxa_signup_pending=true`, puis finalise le profil avec les validations normales ; ou
2. concevoir un chemin d'invitation Auth Admin qui fournisse un marqueur de création provisoire sans affaiblir les validations du parcours Client ni attribuer de rôle à la création Auth.
3. Pour le premier Admin, garantir ensuite la création du profil minimal requis avant l'appel sécurisé du bootstrap ; ne pas modifier `auth.users` directement.

**État : BLOQUÉ — cause racine prouvée, correction non appliquée.** Aucun nouveau compte métier n'est créé par cette étape. Production reste exclue.


## 20. Audit de visibilité des interfaces Admin — navigation complétée (14/11/2026)

**Périmètre contrôlé :** inventaire des pages sous `src/app/admin/**/page.tsx`, menu partagé `AdminNavigation`, disposition responsive définie dans `admin-bento.css`.

**Constat :**
- Le menu latéral ne référençait qu'une partie des écrans Admin. Plusieurs pages existaient mais n'étaient accessibles que par des liens contextuels ou en saisissant leur URL.
- Écrans absents du menu : règlements Promoteur, configuration des coordonnées de paiement, réservations Marketplace, livraisons/commissions, pharmacies de garde, géolocalisation, rappels de lots, accréditations santé, prestations à domicile, demandes de prestations et conventions indépendantes.
- Les pages de détail dynamiques (dossier partenaire et fiche pharmacie) restent accessibles depuis leurs listes parentes et ne sont pas des entrées de navigation permanentes.
- Sur mobile, le menu est une barre horizontale défilante ; ses entrées restent accessibles par balayage. Le défilement tactile et l'alignement des éléments ont été explicités.

**Corrections sur `main` :**
- `src/components/admin/AdminNavigation.tsx` : inventaire de navigation étendu à 24 destinations Admin, dont les deux pages de paiement (« Paiements & réabonnements » et « Coordonnées de paiement »).
- `src/app/admin/admin-bento.css` : amélioration du défilement horizontal mobile (`overscroll-behavior-x`, défilement tactile natif et alignement de défilement).
- Aucun droit, rôle, parcours métier, secret ou donnée métier modifié.

**État du contrôle :**
- Toutes les pages Admin permanentes identifiées dans l'arborescence sont représentées par une entrée de menu ; les pages de détail restent rattachées à leurs écrans parents.
- Les entrées sont scrollables dans la barre latérale desktop et par balayage horizontal sur mobile.
- Contrôle statique du code effectué. Aucun test navigateur connecté à un compte Admin n'a été exécuté dans cette passe ; la visibilité réelle après authentification doit être confirmée dans l'interface.

**Commits :**
- `3018a07f46698816517c152ebc03dab90f519edf` — menu Admin complété.
- `85f549944eb3dadfd650bbe92b1ed1ca15c51dc5` — navigation mobile améliorée.

**Publication :** aucun déploiement Production/Preview n'a été lancé dans cette passe. Le code est sur `main`, la disponibilité sur le domaine Production dépend d'une publication autorisée ultérieure.

**État : CORRECTION COMMITÉE SUR MAIN — vérification navigateur et déploiement non effectués.**


## 21. Inventaire Auth/Profils Replay — clarification sur les comptes existants (14/11/2026)

**Question utilisateur :** plusieurs utilisateurs NAXA devraient exister ; pourquoi ne pas les réutiliser lorsque Supabase indique qu'une adresse e-mail existe déjà ?

**Contrôle SQL en lecture seule — Replay uniquement (pwfftcsjyeibxxqhwysw) :**
- auth.users : 1 identité.
- auth.users avec e-mail confirmé : 1.
- public.profiles : 1 profil.
- Identités Auth sans profil : 0.
- Profils sans identité Auth : 0.

**Interprétation :** dans la base Replay interrogée, il n'existe actuellement qu'une seule identité et un seul profil liés. Le compte technique Admin E2E précédemment inventorié est conservé ; il ne doit pas être réutilisé comme identité d'un autre rôle ni modifié sans procédure autorisée. Une adresse déjà enregistrée dans un autre projet Supabase (par exemple Production) n'est pas automatiquement disponible comme identité Auth dans Replay : les projets ont des bases Auth distinctes. Les profils métier ne remplacent pas les identités Auth.

**Limite :** ce comptage ne prouve pas où se trouve l'adresse que l'utilisateur tente actuellement d'inscrire, ni si l'interface NAXA pointe vers Replay ou un autre projet. Aucun e-mail individuel n'a été exposé dans ce contrôle.

**Sécurité / actions :** requête strictement agrégée et en lecture seule ; aucun compte, profil, rôle, secret ou paramètre n'a été modifié. Production et Vercel non touchés.

**État :** inventaire Replay confirmé ; localisation de l'adresse signalée « déjà existante » non déterminée. Étape suivante : vérifier l'URL Supabase configurée dans l'interface utilisée et identifier le projet Auth correspondant, sans révéler de clés ni toucher aux comptes existants.


## 21. Publication Production des interfaces Admin — build en cours (14/11/2026)

**Autorisation utilisateur :** « Déploi » — publication Production des corrections de navigation Admin précédemment auditées.

**Commit ciblé et garde-fou :**
- Dépôt / branche : `audreymendomo23-netizen/NAXA` / `main`.
- SHA exact publié : `4d86a1e94f9cff938ca6877325042cc9703d41c5`.
- Projet Vercel : `naxa` (`prj_WtDcnR5OvRWKCt2xXgBPvpzzRYVH`), équipe `team_BMPHZQHTElVZL77cwpFxk59X`.
- La commande « Ignoring Build Step » a été mise à jour pour laisser passer uniquement ce SHA (exit 1) et ignorer les autres commits (exit 0). Le journal du build confirme l'exécution de cette commande pour le SHA ciblé.

**Déploiement déclenché :**
- ID : `dpl_3RorCudtNALUXSS4yPTAaMWcQXqb`.
- URL de déploiement : `https://naxa-r9jb6qrk8-naxa3.vercel.app`.
- Cible : Production ; commit GitHub `4d86a1e...` confirmé dans les métadonnées Vercel.
- Les tests automatisés dans les journaux du build affichent **392 PASS, 0 FAIL**.
- Au dernier contrôle, l'état Vercel est encore **BUILDING** ; la fin de compilation et l'affectation finale des domaines Production ne sont donc pas encore prouvées.
- Des avertissements npm de configuration/peer dependencies sont présents ; aucun échec de test n'est signalé dans les événements consultés.

**État : PUBLICATION EN COURS — ne pas déclarer READY avant confirmation Vercel.** Les 24 destinations Admin restent validées statiquement ; la vérification navigateur avec une session Admin n'a pas été exécutée.

**Point de reprise :** contrôler `dpl_3RorCudtNALUXSS4yPTAaMWcQXqb` jusqu'à son état terminal ; si READY, vérifier les alias Production et les erreurs runtime, puis compléter cette section. Si ERROR, lire les événements de build et corriger la cause sur `main` avant toute nouvelle publication.


## 22. Recherche des identités Auth hors Replay actif (14/11/2026)

**Demande utilisateur :** vérifier si les utilisateurs NAXA sont présents dans d'autres projets Supabase que Replay actif.

**Inventaire des projets du compte NAXA :**
- `pwfftcsjyeibxxqhwysw` — `naxa-ci-replay-2`, ACTIVE_HEALTHY (Replay actif déjà contrôlé : 1 Auth, 1 profil).
- `eouwtuusnsuxaejsxknf` — `Naxa`, ACTIVE_HEALTHY (Production).
- `fnlyjlvflgiewrkmnisi` — `naxa-ci-replay`, INACTIVE (ancien Replay).

**Tentatives de contrôle agrégé en lecture seule :**
- Production `eouwtuusnsuxaejsxknf` : requête de comptage Auth/profils refusée par Supabase avec `Database is possibly not accessible at the moment`.
- Ancien Replay `fnlyjlvflgiewrkmnisi` : même indisponibilité retournée.
- Aucun e-mail ni contenu de compte n'a été lu. Aucun compte, profil, rôle, secret ou paramètre modifié.

**Conclusion :** l'inventaire prouve qu'il existe deux autres projets, mais leur contenu Auth n'a pas pu être vérifié à cette passe. Il est donc impossible d'affirmer que les comptes recherchés s'y trouvent ou non. Production n'a subi aucune écriture ni migration ; seule une requête SELECT agrégée a été tentée et rejetée. Aucun déploiement Vercel.

**Point de reprise :** lorsque les bases seront accessibles, relancer uniquement le comptage agrégé Auth/profils sur Production et l'ancien Replay, sans afficher les adresses e-mail et sans modifier les utilisateurs.


### Clôture du contrôle de publication Production (14/11/2026)

**État final Vercel : READY — confirmé.**
- Déploiement : `dpl_3RorCudtNALUXSS4yPTAaMWcQXqb`.
- Commit servi : `4d86a1e94f9cff938ca6877325042cc9703d41c5` (branche `main`).
- Alias attachés au déploiement : `nnaxa.vercel.app`, `naxa-opal.vercel.app`, `naxa-naxa3.vercel.app`, `naxa-git-main-naxa3.vercel.app`.
- `aliasError: null`.
- Erreurs runtime agrégées sur les 30 dernières minutes : aucune.
- Logs runtime `error/fatal` pour ce déploiement sur la fenêtre de 30 minutes : aucun résultat.
- Les 392 tests du build restent à 392 PASS / 0 FAIL (preuve des événements de build consultés).

**Conclusion :** publication Production terminée et état Vercel vert. Cela confirme la disponibilité du déploiement et l'association des alias, mais ne remplace pas un parcours manuel authentifié dans l'interface Admin. Le contrôle navigateur Admin reste à effectuer.
