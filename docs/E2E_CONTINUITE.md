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
