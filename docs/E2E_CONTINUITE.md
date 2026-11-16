# Continuité des recettes E2E NAXA

> **Document de reprise vivant.** Mettre à jour ce fichier dès qu'une réponse fait avancer une recette, apporte une preuve, découvre un blocage ou modifie une décision. Toute correction nécessaire doit être intégrée à la source versionnée sur `main`, vérifiée, puis référencée ici avec son commit. Aucun correctif ne doit rester uniquement dans la conversation.

**Dernière mise à jour :** 15 novembre 2026 (§66)  
**Dépôt / branche :** `audreymendomo23-netizen/NAXA` / `main`  
**État global :** 🟡 PARTIEL — correctifs backend crédit Marketplace/comptoir et tests SQL Replay ciblés PASS (§59–§60). Run Replay E2E 129 : SUCCESS, Web Push Chromium 3/3 et Storage 17 PASS / 0 SKIP (§61). Configuration comptable `credit_octroi` / `credit_remboursement` corrigée sur Replay ; worker runtime octroi + remboursement PASS en transaction annulée, écritures équilibrées (§62–§63). Le contrôle Caisse ne confond plus publication Marketplace et disponibilité ERP : une pharmacie active non archivée, même masquée, peut ouvrir sa propre Caisse. Une fixture interne masquée et un parcours navigateur crédit comptoir (demande au-dessus plafond → décision Promoteur → reprise du même panier → stock unique → remboursement par JWT Caisse → clôture rapprochée) sont maintenant versionnés et branchés à l’Action Replay (§64), mais **leur exécution Actions n'est pas encore confirmée**. Le parcours Marketplace complet dans le navigateur n'est pas encore prouvé. Les mappings/journaux/périodes commerciaux restent à configurer et valider par chaque Promoteur/Comptable. Aucun PASS qualité terminal sur le dernier SHA n'est confirmé. Production, Vercel et Play Store inchangés.



> **Décision métier prioritaire (15 novembre 2026) :** NAXA est un connecteur, pas une autorité pharmaceutique ou réglementaire. NAXA ne comprend, ne contrôle, ne corrige, ne certifie, n'approuve ni ne valide les fiches déclarées par les pharmacies. La pharmacie déclare ses références, prix, stocks, lots et disponibilités sous sa propre responsabilité. La section §43 remplace les anciens garde-fous de validation centrale décrits en §41/§42 et tout ancien point de reprise exigeant une validation Admin/DPML avant publication.

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


## 23. Inventaire des comptes NAXA Production et autorisation de réutilisation (14/11/2026)

**Précision utilisateur :** l'utilisateur confirme que les profils visibles dans NAXA Production sont tous des comptes de test et autorise leur réutilisation pour la recette. Il ne peut pas transmettre de capture d'écran actuellement.

**Contrôle SQL en lecture seule — Production `eouwtuusnsuxaejsxknf` :**
```sql
select p.role,
       count(*)::int as profiles_count,
       count(u.id)::int as linked_auth_count,
       count(*) filter (where u.id is null)::int as profiles_without_auth
from public.profiles p
left join auth.users u on u.id = p.id
group by p.role
order by p.role;
```

**Résultat agrégé vérifié :**
- `client` : 8 profils, 8 identités Auth liées, 0 profil sans Auth.
- `admin` : 1 profil, 1 identité Auth liée, 0 profil sans Auth.
- `promoteur` : 1 profil, 1 identité Auth liée, 0 profil sans Auth.
- **Total : 10 profils, 10 identités Auth liées, 0 profil orphelin.**
- Aucun e-mail, mot de passe, jeton ou secret n'a été affiché.

**Décision / périmètre :**
- Réutilisation des comptes de test Production autorisée par l'utilisateur.
- Cette autorisation ne vaut pas autorisation de modifier les profils, rôles, affectations, données métier, mots de passe ou sessions ; aucune écriture n'a été effectuée.
- Aucun compte Auth n'a été créé, supprimé ou modifié. Aucun déploiement Vercel ni changement de configuration.
- Replay reste isolé : son inventaire précédent reste 1 Auth / 1 profil. Les identités d'un projet ne sont pas automatiquement disponibles dans l'autre.

**Limite / prochaine étape :**
- L'inventaire confirme les rôles et l'existence d'une identité Auth liée à chaque profil, mais ne vérifie pas les mots de passe ni la possibilité de connexion.
- Étape suivante : examiner les champs non secrets des 10 profils et leurs relations métier (notamment Promoteur/pharmacies) pour établir une matrice de réutilisation ; ensuite tester les connexions uniquement par un mécanisme sécurisé, sans afficher ni demander les mots de passe dans la conversation.
- **État : INVENTAIRE PRODUCTION CONFIRMÉ ; réutilisation autorisée mais tests de connexion et matrice E2E non encore exécutés.**


## 24. Détail des profils Production et relations métier — inventaire en lecture seule (14/11/2026)

**Périmètre :** suite à l'autorisation utilisateur de réutiliser les comptes de test déjà présents en Production, inventaire agrégé des profils, états Auth et relations métier. Aucune capture d'écran demandée.

**Comptes / état Auth (Production `eouwtuusnsuxaejsxknf`) :**
- Admin : 1 profil actif ; identité Auth liée et e-mail confirmé ; aucune interdiction Auth active ; connexion antérieure enregistrée.
- Promoteur : 1 profil **inactif** ; identité Auth liée et e-mail confirmé ; aucune interdiction Auth active ; connexion antérieure enregistrée.
- Client : 8 profils actifs ; 8 identités Auth liées ; 7 e-mails confirmés, 7 connexions antérieures ; aucune interdiction Auth active.
- Pour les 8 Clients, les champs de profil agrégés sont renseignés comme suit : username 8/8 ; nom/prénom 7/8 ; téléphone 7/8 ; vérification d'âge 7/8 ; consentement enregistré 7/8. L'identité Auth non confirmée et les champs incomplets doivent être traités comme réserve, pas comme compte prêt à tester.
- Aucun e-mail, nom, téléphone, date de naissance, UUID, mot de passe ou jeton n'a été extrait dans le rapport.

**Relations professionnelles et pharmacies :**
- `naxa_professional_assignments` : 0 affectation.
- `profile_accreditations` : 0 accréditation.
- `naxa_profile_privileges` : 103 privilèges actifs rattachés au seul profil Promoteur (93 de portée PHARMACIE, 10 de portée RESEAU).
- `promoteur_pharmacies` : 1 lien actif entre le profil Promoteur et 1 pharmacie.
- Le profil Promoteur porte aussi un `pharmacie_id` direct.
- Contradiction à traiter : le profil Promoteur est inactif alors que son lien Promoteur-pharmacie et ses 103 privilèges restent actifs. La pharmacie liée est à Yaoundé, marquée non-démo, inactive et visible dans la recherche. Ne pas l'utiliser pour des mutations métier de recette avant clarification et isolation.
- Inventaire global des pharmacies Production : 4 lignes, 3 marquées démo, 0 active, 1 visible en recherche. La pharmacie reliée au Promoteur n'est pas marquée démo.

**Matrice de réutilisation proposée (sans écriture) :**
- Admin : 1 identité techniquement liée/confirmée ; candidat à un contrôle d'accès en lecture seule, mais ne pas exercer d'action Admin destructive en Production.
- Client : 7 identités confirmées candidates à des essais de connexion non destructifs ; 1 identité non confirmée à exclure tant que son état n'est pas résolu.
- Promoteur : identité confirmée mais profil inactif et relation/privileges incohérents ; exclu des tests métier jusqu'à correction contrôlée ou préparation d'un environnement isolé.
- Aucun compte Gestionnaire stock, Caisse, Comptable, Pharmacien, Responsable ou Livreur n'est présent dans cet inventaire de profils.

**Décision de sécurité :**
- L'utilisateur confirme que les comptes visibles sont des comptes de test et autorise leur réutilisation. Cette autorisation ne transforme pas les données liées en données jetables : Production reste protégée. Pas de modification des profils, statuts, privilèges, relations, pharmacies, sessions ou Auth.
- Les comptes sont inventoriés, mais les mots de passe ne sont pas connus et aucune connexion n'a été testée dans cette passe.
- Replay reste le seul environnement autorisé pour les scénarios E2E avec mutations de données.

**État : INVENTAIRE MÉTIER EFFECTUÉ ; réutilisation partielle possible pour contrôles de connexion non destructifs seulement. Le Promoteur et les données de pharmacie associées sont bloqués par incohérence d'état ; les rôles professionnels manquants doivent être créés/préparés sur Replay, pas en Production.**


## 25. Cause racine de la désactivation Promoteur — échéance et synchronisation automatique (14/11/2026)

**Décision utilisateur sur le périmètre E2E :** l'utilisateur confirme que les quatre pharmacies actuellement présentes dans le projet Supabase Production sont toutes des données de test et demande qu'elles soient utilisées pour la recette E2E. La pharmacie liée au Promoteur peut donc être incluse dans l'investigation malgré son indicateur historique `est_demo=false`. Cette passe de diagnostic est restée strictement en lecture seule.

**État agrégé constaté en Production :**
- 4 pharmacies au total ; 3 marquées démo, 1 non-démo selon la colonne historique ; 0 pharmacie active ; 1 visible dans la recherche.
- 1 profil Promoteur, inactif ; 1 lien Promoteur/pharmacie toujours actif.
- 103 lignes de privilèges Promoteur encore `active=true` : 93 portée `PHARMACIE`, 10 portée `RESEAU`.
- La pharmacie liée est inactive ; son architecture active correspond bien à celle de la convention (`ORPHELIN`). Ce point n'explique donc pas à lui seul l'invalidité commerciale observée.

**Chronologie reconstruite depuis `pharmacie_donnees_historique` (UTC) :**
1. 22/10/2026 12:14:13 — création du profil Promoteur.
2. 22/10/2026 12:14:14 — création de la pharmacie avec `actif=false`.
3. 22/10/2026 12:14:15 — conversion du profil de `client` vers `promoteur`, avec `actif=false`.
4. 22/10/2026 12:14:16 — création du lien Promoteur/pharmacie inactif ; convention et abonnement créés avec échéance au 05/11/2026.
5. 22/10/2026 12:15:28 — activation du profil, de la pharmacie et du lien ; le déclencheur de provisionnement a ensuite créé les privilèges d'architecture.
6. 31/10/2026 06:00 — contrôle planifié observé, abonnement toujours `actif`, échéance inchangée.
7. 14/11/2026 01:15:00 — le job cron 36 exécute avec succès `public.synchroniser_validite_pharmacies()` ; l'abonnement passe de `actif` à `impaye`, la convention de `active` à `expiree`, puis la pharmacie et le profil Promoteur passent de `actif=true` à `actif=false`. Les événements de désactivation ont `acteur_id` absent, cohérent avec une exécution système.

**Cause immédiate confirmée :**
- Abonnement Promoteur : `echeance=2026-11-05`, `statut=impaye`, `bloque_le=2026-11-14 01:15:00 UTC`.
- Convention : `date_expiration=2026-11-05`, `statut=expiree`.
- Aucun enregistrement dans `abonnement_promoteur_paiements` et aucun règlement dans `abonnement_promoteur_reglements` pour cet abonnement ; donc aucun règlement confirmé ni règlement en attente recevable ne protégeait l'échéance.
- Le job cron 36 est actif avec le calendrier `15 * * * *` et la commande `select public.synchroniser_validite_pharmacies();`. Son exécution du 14/11 à 01:15 UTC est enregistrée `succeeded`.
- La fonction synchronise l'impayé, l'expiration de convention et la désactivation de pharmacie/profil. Elle ne désactive ni `promoteur_pharmacies` ni `naxa_profile_privileges`.

**Pourquoi le tableau montrait encore 103 privilèges et un lien actifs :**
- Le traitement d'échéance ne révoque pas les lignes de rattachement ni les privilèges persistés ; leurs indicateurs restent donc actifs.
- Le contrôle central `private.naxa_promoteur_valide` retourne actuellement `false`. Ses critères incluent le profil actif, la convention active/non échue, l'abonnement actif/non échu, le lien actif et la pharmacie active avec architecture concordante.
- Le moteur `private.naxa_has_privilege` refuse les privilèges Promoteur si ce contrôle commercial échoue ; `private.naxa_can` passe également par ce moteur. Les 103 lignes sont donc des droits persistés non révoqués, mais elles ne constituent pas une preuve d'accès effectif tant que la validité commerciale échoue.
- La policy SELECT de `naxa_profile_privileges` autorise la lecture par soi-même, Admin ou gestionnaire autorisé ; cela ne contourne pas les contrôles d'autorisation métier.

**Conclusion / qualification :**
- **Cause racine de la désactivation : échéance du 05/11/2026 dépassée sans règlement recevable ; synchronisation automatique du 14/11/2026 à 01:15 UTC.**
- **Anomalie secondaire de cohérence d'état :** le job suspend le profil et la pharmacie mais conserve le lien Promoteur/pharmacie et les 103 privilèges avec `active=true`. Le moteur central bloque actuellement leur usage effectif ; le statut persisté reste toutefois trompeur pour l'inventaire et les écrans d'administration.
- Le code d'architecture `ORPHELIN` est présent et concordant entre la convention et l'architecture active de la pharmacie ; il n'est pas la cause immédiate de la désactivation observée.
- Aucun profil, abonnement, convention, pharmacie, lien, privilège, session ou compte Auth n'a été modifié pendant cette investigation. Aucun paiement fictif n'a été créé. Aucun déploiement.

**Point de reprise E2E :**
1. Reproduire en environnement Replay le cycle échéance dépassée → job de validité → suspension, et vérifier le comportement des privilèges persistés.
2. Tester le parcours de règlement confirmé puis la réactivation Admin avec la RPC prévue ; vérifier explicitement si la pharmacie et le Promoteur doivent être réactivés séparément ou par une opération atomique contrôlée.
3. Ajouter une assertion de cohérence sur les rattachements/privilèges suspendus : soit les lignes sont révoquées à la suspension et reprovisionnées après réactivation, soit leur statut doit être distingué de l'autorisation effective. Ne pas corriger Production avant d'avoir validé le contrat métier et les tests de régression.

**État : CAUSE IMMÉDIATE PROUVÉE ; incohérence des indicateurs de privilèges identifiée ; correction et recette de réactivation non encore exécutées.**


## 26. Reprise du blocage de création du Promoteur E2E (14/11/2026)

**Décision utilisateur :** poursuivre la préparation d'une identité Promoteur fictive sur Replay uniquement. L'Admin technique existant doit être conservé ; Production reste exclue.

**Contrôle live Replay, lecture seule :**
- Projet `pwfftcsjyeibxxqhwysw` ; inventaire inchangé : 1 identité Auth et 1 profil.
- `public.handle_new_user()` est bien dans sa version avec garde `naxa_signup_pending=true` : une identité provisoire peut être créée sans déclencher l'erreur « Nom d'utilisateur invalide » et sans profil prématuré.
- La définition live correspond au comportement des migrations 085/088 et au parcours OTP du dépôt. L'ancien diagnostic qui attribuait encore le blocage actuel au trigger est donc dépassé pour les créations marquées pending.

**Contradiction applicative identifiée :**
- `src/app/api/auth/signup-otp/route.ts` crée/reprend une identité provisoire avec `naxa_signup_pending=true`.
- `src/app/api/auth/complete-signup/route.ts` ne finalise que des profils `client` ; en l'absence de profil, il insère explicitement `role='client'` et refuse un rôle existant différent.
- Le parcours public `/creation-compte` est donc un parcours Client, pas un parcours de création de Promoteur/Partenaire.
- Le bootstrap Admin existant ne convient pas : il ne fait qu'attribuer le rôle Admin à une identité préexistante et confirmée.

**Cause immédiate actuelle :** il manque un parcours contrôlé de finalisation d'identité et d'affectation initiale pour un compte Promoteur de recette. Le correctif du trigger est déjà présent ; le prochain changement ne doit ni contourner Auth, ni modifier le trigger pour cette erreur historique.

**Sécurité / actions :** aucune identité Auth, profil, affectation ou donnée métier n'a été créée/modifiée pendant cette passe ; aucune écriture SQL, migration, déploiement ou action Production. L'Admin technique est intact.

**Point exact de reprise :** concevoir puis implémenter sur `main` un flux serveur restreint au projet Replay et aux comptes explicitement marqués recette, qui finalise une identité Auth confirmée en profil Promoteur selon le vrai contrat NAXA (validation d'âge/consentement, unicité username/téléphone, rôle autorisé, audit et garde environnement). Ajouter tests automatisés sur la finalisation, les refus de rôle arbitraire, les comptes non confirmés et l'interdiction Production. Ensuite seulement créer le Promoteur fictif et ses établissements/équipes via les parcours métier.


## 27. Regroupement de la navigation Admin en six rubriques (14/11/2026)

**Demande utilisateur :** réduire le nombre d'entrées visibles dans la barre latérale Admin en regroupant les pages, après un audit exhaustif des routes afin de ne rien oublier.

**Périmètre réel vérifié sur `main` avant implémentation :**
- Arborescence `src/app/admin/**/page.tsx` : 26 pages au total.
- 24 pages à route fixe et 2 pages dynamiques :
  - `/admin/pharmacies/[id]`
  - `/admin/promoteurs/partenaires/[id]`
- Les 24 routes fixes sont représentées une fois chacune dans le menu.
- Les deux fiches dynamiques sont accessibles depuis le registre Promoteurs ; elles ne deviennent pas des entrées permanentes supplémentaires.
- Aucune page fixe orpheline ni destination de menu sans page correspondante dans l'inventaire contrôlé.

**Architecture implémentée :**
1. Accueil & supervision — 4 pages.
2. Réseau & professionnels — 5 pages.
3. Pilotage & finances — 6 pages.
4. Marketplace & opérations — 5 pages.
5. Catalogue — 2 pages.
6. Compte & configuration — 2 pages.

Total : **6 rubriques repliables, 24 destinations fixes conservées, aucune route supprimée**.

**Corrections et comportement :**
- `src/components/admin/AdminNavigation.tsx` : configuration hiérarchique unique ; résolution de la route active calculée une fois ; règle de correspondance la plus précise conservée pour les routes imbriquées.
- La route racine `/admin` n'est active que pour le tableau de bord et ne capture plus les autres routes Admin.
- La fiche dynamique `/admin/pharmacies/[id]`, qui n'est pas sous `/admin/promoteurs`, est explicitement rattachée à l'entrée « Dossiers Promoteurs ». La fiche `/admin/promoteurs/partenaires/[id]` reste rattachée à cette même entrée par le préfixe de route.
- Le groupe correspondant à la page active s'ouvre automatiquement. L'Admin peut ouvrir un autre groupe ou tout replier ; un clic sur un lien rétablit le suivi automatique de la route.
- Les commandes de groupe utilisent des boutons natifs `type="button"`, `aria-expanded` et `aria-controls`. Les pages restent des liens de navigation standards ; aucun faux rôle ARIA `menu` n'est ajouté.
- `src/app/admin/admin-bento.css` : sidebar accordéon sur desktop et six groupes compacts sur mobile ; suppression de l'ancienne barre fixe horizontale de 24 liens et de la réserve inférieure associée. Le contenu mobile n'est donc plus masqué par cette barre.

**Commits sur `main` :**
- `4df4d05091f50340463b467a15a1886ad8094fcb` — regroupement du composant de navigation.
- `317a564302a179bc8e600dd3a7085a555384163f` — adaptation CSS desktop/mobile.

**Preuves statiques après implémentation :**
- Comparaison du composant avec l'arborescence : 6 groupes, 24 liens, 24 routes fixes, 0 route fixe manquante, 0 lien orphelin, 0 doublon.
- Cas vérifiés par simulation de la règle de résolution : `/admin`, `/admin/alertes`, `/admin/pilotage/reglements`, `/admin/pilotage/reglements/configuration`, `/admin/prestations/demandes`, `/admin/prestations/conventions`, `/admin/pharmacies/{id}` et `/admin/promoteurs/partenaires/{id}`.
- Contrôle CSS : absence de l'ancienne barre mobile fixe et de son padding inférieur réservé ; disposition mobile en deux colonnes pour les rubriques, avec expansion pleine largeur du groupe ouvert.
- Le workflow `NAXA quality` est configuré pour exécuter tests, TypeScript, lint et build Next.js sur chaque push `main`. Le premier run déclenché par ces commits est en cours au moment de cette mise à jour ; le résultat final du commit de documentation doit encore être contrôlé.
- Aucun test navigateur authentifié ni contrôle réel au clavier/tactile n'a encore été exécuté.

**Sécurité / périmètre exclu :**
- Aucune route, page métier, API, action serveur, RPC, policy RLS, rôle, permission, table ou donnée métier modifiée.
- `src/app/admin/layout.tsx` et la garde `requireAdminActive` laissés intacts.
- Aucun paramètre Supabase/Vercel touché. Aucun déploiement Preview ou Production lancé ; le garde-fou Vercel n'a pas été modifié.

**État : IMPLÉMENTATION COMMITÉE SUR MAIN ; inventaire et couverture statique des routes conformes. Validation qualité distante en attente, contrôle navigateur et validation responsive réelle encore requis. Ne pas déclarer la navigation entièrement verte avant le succès du workflow et un parcours Admin authentifié desktop/mobile.**


**Complément qualité après le premier run (14/11/2026) :**
- Workflow `43615999167` sur le commit `ffe3880d4a69c208fe4f8b1c61dee7403c26cd67` : échec TypeScript après exécution des tests.
- Résultat tests : **392 PASS / 0 FAIL**. Validation `actionlint` : PASS.
- Cause exacte : inférence TypeScript incorrecte sur le résultat de `groups.flatMap()` en raison de la déclaration `as const`, entraînant un type d'union incompatible et des références `unknown`.
- Correction : types communs explicites `AdminNavItem` / `AdminNavGroup`, tableau `groups: AdminNavGroup[]` et type explicite du tableau aplati `AdminNavItem[]`.
- Commit de correction : `c57f40435945536c4ef82a2de466187d48b6d221`.
- Le contrôle qualité complet doit être jugé sur le commit final après correction et après la présente mise à jour documentaire. Déploiement conditionné à un succès complet de ce contrôle.


**Clôture qualité et publication Production — navigation Admin (14/11/2026) :**
- Contrôle GitHub Actions final : run `43616386314`, commit testé `8ed4d811f34518583185fdfe015f0e4a981c633d`, conclusion **success**.
- Job « Tests, TypeScript et lint » : success ; les 392 tests unitaires, TypeScript, ESLint et le build Next.js sont passés.
- Job « GitHub Actions syntax and expression checks » : success ; `actionlint` a validé les workflows.
- Le premier run antérieur `43615999167` avait échoué uniquement sur l'inférence TypeScript de `groups.flatMap` ; la correction explicite `AdminNavItem` / `AdminNavGroup` a ensuite été validée par le run final.

**Déploiement Production :**
- Projet Vercel : `naxa` / `prj_WtDcnR5OvRWKCt2xXgBPvpzzRYVH`, équipe `team_BMPHZQHTElVZL77cwpFxk59X`.
- Garde-fou Vercel conservé : seul le SHA `8ed4d811f34518583185fdfe015f0e4a981c633d` pouvait franchir `commandForIgnoringBuildStep`; tout autre commit `main` est ignoré.
- Déploiement : `dpl_GZT4aUPVzLkWfM3W6KXmP4iJ4k28`, commit exact `8ed4d811f34518583185fdfe015f0e4a981c633d`, cible Production.
- Résultat Vercel : **READY**, événement de build `Deployment completed`, `aliasError=null`.
- Alias confirmés : `nnaxa.vercel.app`, `naxa-opal.vercel.app`, `naxa-naxa3.vercel.app`, `naxa-git-main-naxa3.vercel.app`.
- Logs runtime Production filtrés sur ce déploiement, fenêtre des 30 dernières minutes, niveaux `error/fatal` : aucun résultat.
- Avertissements non bloquants observés : peer dependencies ESLint 10 vs plugins ESLint 9, configuration npm `cache-dir`, scripts d'installation npm non autorisés par `allowScripts`, et avertissement de dépréciation du support React 18 dans Next.js 16.4.6. Ils n'ont pas empêché le build READY et restent à traiter séparément.
- Aucun changement Supabase, migration, rôle, droit, API, RPC ou RLS. Aucun déploiement Preview.

**Réserve fonctionnelle :** le contrôle confirme le build, le déploiement, les alias et l'absence d'erreurs runtime dans la fenêtre observée. Un parcours visuel avec session Admin authentifiée sur desktop et mobile n'a pas été exécuté dans cette passe ; l'expérience réelle d'ouverture/repli des six rubriques reste à valider manuellement.

**État final : QUALITÉ AUTOMATISÉE PASS — PRODUCTION READY — 24/24 ROUTES FIXES PRÉSERVÉES.**

## 28. Recette Promoteur E2E et Storage Replay — résultat et réserve (15/11/2026)

**Périmètre exécuté : Replay uniquement** (projet pwfftcsjyeibxxqhwysw ; Production exclue).

**Provisionnement de la fixture Promoteur :**
- Identité technique fictive dédiée conservée sur Replay, explicitement marquée comme fixture E2E Promoteur.
- Profil vérifié : rôle promoteur, actif, fonction_interne=promoteur, niveau_interne=1, niveau_hierarchique=1, architecture HYBRIDE.
- naxa_architecture_for_profile() résout HYBRIDE et private.naxa_promoteur_valide() retourne vrai.
- Deux pharmacies démo actives HYBRIDE sont rattachées au Promoteur ; une troisième pharmacie démo HYBRIDE, non rattachée, sert au contrôle négatif.
- Les deux rattachements et les deux privilèges ASSIGN_USER_TO_PHARMACY sont vérifiés actifs.
- Convention et abonnement de recette à 1 FCFA / 30 jours pour exercer le contrôle de validité ; aucun paiement ni règlement fictif créé.
- L'identité Admin technique existante n'a pas été modifiée. Aucun compte Auth de Production, profil métier Production ou paramètre Vercel touché.

**Corrections prouvées sur Replay :**
1. Le premier échec de provisionnement venait du niveau hiérarchique incorrect du Promoteur. La fixture et le provisionneur ont été corrigés pour initialiser le Promoteur en racine HYBRIDE (niveau_interne=1, niveau_hierarchique=1, fonction_interne=promoteur).
2. Le remplacement du logo échouait car le bucket pharmacies-photos avait les politiques INSERT/UPDATE/DELETE Promoteur, mais aucune politique SELECT pour l'upsert. Une policy SELECT a été ajoutée, limitée aux objets logos/ des pharmacies actives auxquelles le Promoteur actif est effectivement lié. DDL appliqué sur Replay et migration versionnée : supabase/migrations/20261114170000_promoteur_pharmacy_logo_select_policy.sql.
3. Les anciens workflows de provisionnement concurrents ont été retirés ; le workflow actif secret-safe est .github/workflows/naxa-replay-promoteur-secret-safe-v2.yml. Le mot de passe éphémère est transmis dans un fichier privé temporaire, masqué avant usage puis supprimé par trap ; aucune valeur de secret n'est imprimée dans les logs.

**Résultat E2E final :**
- Workflow 43618611055, commit testé cce5c136c954653e7162549bacb13623847b07e4 : SUCCESS.
- Storage E2E : 14 PASS / 0 FAIL / 1 SKIP.
- Contrôles réussis : upload PDF propriétaire, lecture authentifiée, refus de lecture/écriture inter-utilisateurs, refus anonyme du bucket privé, URL signée propriétaire et refus pour un autre utilisateur, rejet MIME interdit, refus d'accès aux buckets réservés, lecture publique d'un vrai objet image, upload Promoteur sur pharmacie liée, remplacement du logo (upsert), refus d'écriture sur la troisième pharmacie non liée, suppression et nettoyage des fichiers/sessions/comptes temporaires.
- Seul SKIP : matrice Storage Admin, car les identifiants Admin E2E ne sont pas configurés. Le test Promoteur est exécuté et passe.
- Contrôle qualité du même commit : workflow 43618611165 SUCCESS ; job tests/TypeScript/ESLint/build Next.js PASS ; job actionlint PASS.

**Réserve métier découverte par le contrôle SQL final :**
- Le compte fixture comporte actuellement 292 privilèges actifs.
- Les cinq privilèges réseau canoniques (VIEW_CA_BY_PHARMACY, VIEW_COMPARISON, VIEW_NETWORK_HEALTH, VIEW_NETWORK_PILOTAGE, VIEW_NETWORK_REPORT) présentent chacun 20 lignes actives pour le même profil avec pharmacie_id IS NULL et scope_type='RESEAU'.
- Cause racine vérifiée dans public.naxa_provision_promoteur_pharmacie(uuid,uuid) : l'INSERT réseau utilise ON CONFLICT(profile_id,privilege_code,pharmacie_id,scope_type), mais la clé contient pharmacie_id=NULL et l'index unique PostgreSQL standard traite les NULL comme distincts. Chaque nouvel événement de provisionnement peut donc ajouter une nouvelle ligne réseau au lieu de réutiliser la ligne existante.
- Les deux privilèges d'affectation par pharmacie restent présents ; cette duplication réseau n'a pas fait échouer la recette Storage, mais rend les données d'autorisation non canoniques et doit être corrigée avant de déclarer la recette des privilèges Promoteur verte.
- À la découverte initiale, aucune migration de correction n'avait encore été appliquée ; cette réserve a depuis été corrigée sur Replay et les preuves figurent en §29.
- Pas de changement Production, pas de déploiement Vercel.

**État au moment du contrôle initial : STORAGE PROMOTEUR E2E VALIDÉ SUR REPLAY ; QUALITÉ AUTOMATISÉE PASS ; réserve d'idempotence RESEAU ouverte. Cette réserve est levée sur Replay au §29 ; la recette globale reste partielle pour les autres matrices non exécutées.**

**Point de reprise initial (clos au §29) :** corriger l'idempotence des privilèges RESEAU sur Replay, normaliser les doublons, puis prouver la stabilité sur plusieurs cycles. Ces trois éléments sont maintenant exécutés et documentés au §29.


## 29. Correction idempotence des privilèges Promoteur RESEAU — Replay (15/11/2026)

**Périmètre : Replay uniquement.** Projet ciblé : `pwfftcsjyeibxxqhwysw`. Production et Vercel n'ont pas été modifiés.

**Audit avant correction :**
- L'inventaire global Replay montrait un seul profil affecté : la fixture `naxa.e2e.promoteur@example.invalid`.
- Pour chacun des cinq codes `VIEW_CA_BY_PHARMACY`, `VIEW_COMPARISON`, `VIEW_NETWORK_HEALTH`, `VIEW_NETWORK_PILOTAGE` et `VIEW_NETWORK_REPORT`, 20 lignes étaient actives avec `pharmacie_id IS NULL` et `scope_type='RESEAU'`.
- Cause racine confirmée dans `public.naxa_provision_promoteur_pharmacie(uuid,uuid)` : la cible `ON CONFLICT(profile_id,privilege_code,pharmacie_id,scope_type)` ne détecte pas les doublons lorsque `pharmacie_id` vaut NULL, puisque l'index unique standard traite ces NULL comme des valeurs distinctes.

**Correction appliquée :**
- Migration versionnée : `supabase/migrations/20261115100000_promoteur_reseau_privilege_idempotence.sql` ; commit `15cfe4b990312848c41fefc1023920a24b6ea350`. Historique Replay : version `20261115054533`, nom `promoteur_reseau_privilege_idempotence`.
- Dans une transaction protégée par verrou de table, conservation de la ligne active la plus ancienne pour chaque combinaison Promoteur/droit/portée ; les autres lignes actives sont révoquées (`active=false`, `revoked_at` renseigné), sans suppression physique.
- Création de l'index unique partiel `naxa_profile_privileges_active_reseau_scope_uidx`, limité aux lignes réseau actives, non révoquées, sans pharmacie ni partenaire.
- Modification de la fonction de provisionnement pour cibler explicitement cet index partiel dans l'upsert RESEAU. Les contrôles d'identité Promoteur, de validité commerciale, d'affectation active et d'architecture sont conservés ; l'upsert des privilèges PHARMACIE reste inchangé.
- Test de non-régression versionné : `supabase/tests/20261115100000_promoteur_reseau_privilege_idempotence.sql` ; commit initial `d24856eeda59af7c84772e8ab104f074a91424fa`, puis assertion ajoutée pour prouver que l'index rejette lui-même une insertion active en double.

**Preuve d'exécution sur Replay :**
- Test SQL exécuté avec succès : 3 cycles de provisionnement sur chacune des 2 pharmacies actives liées (6 appels à la fonction).
- Avant/après : les cinq codes RESEAU conservent chacun exactement **1 ligne active**. Aucun ajout ni perte de privilège réseau.
- Nettoyage : **95 doublons** (19 par code) conservés comme historique et révoqués ; aucune suppression physique.
- Vérification globale après correction : **0 groupe de doublons actifs restant** dans `naxa_profile_privileges` pour les portées RESEAU.
- Vérification catalogue PostgreSQL : l'index unique partiel est présent avec le prédicat attendu.
- La migration a été appliquée sur Replay ; aucun changement Production ni déploiement Vercel.

**Conclusion :** la réserve d'idempotence des privilèges RESEAU est **CORRIGÉE ET TESTÉE SUR REPLAY**. Cela ne valide pas encore la matrice complète des rôles : la matrice Storage Admin reste SKIP faute d'identifiants Admin E2E, et les parcours des autres profils professionnels restent à exécuter. La recette globale NAXA demeure PARTIELLE, sans déclaration AU VERT.

**Point exact de reprise :** reprendre la matrice Admin/Promoteur et les profils professionnels sur Replay ; conserver la séparation explicite entre validations SQL ciblées, E2E Storage déjà passé et recette métier complète non encore exécutée.


## 30. Reprise après correction RESEAU — préparation de la matrice Storage Admin (15/11/2026)

**État hérité et confirmé :**
- Le correctif RESEAU du §29 est appliqué à Replay et le test SQL de régression a été exécuté après ajout de l'assertion d'unicité. Résultat SQL sans erreur ; vérification post-test : 0 groupe de doublons RESEAU actifs, 5 lignes réseau actives canoniques et 95 anciennes lignes conservées révoquées.
- Dernier commit documentaire : `cd9821163ff40b56e5c28da33fcb68df221d8b23`. Les trois fichiers migration/test/documentation sont présents sur `main`.

**Contrôle d'identité Admin Replay effectué en lecture seule :**
- Une seule identité Auth Admin de recette est présente : `naxa.e2e.20261104.admin@example.invalid`.
- Identité Auth confirmée ; profil lié avec `role='admin'` et `actif=true`.
- Marqueurs d'identité vérifiés : `naxa_e2e_fixture='NAXA-E2E-20261104'`, `naxa_e2e_persona='admin'`. Le compte est donc une fixture Admin dédiée, et non un compte utilisateur réel.
- Aucun profil `naxa.home@gmail.com` trouvé sur Replay lors de ce contrôle ; aucun autre compte Admin créé.
- Aucun mot de passe ni secret existant n'est récupéré ni exposé.

**Cause du SKIP Admin :**
- `scripts/storage-e2e.cjs` exécute sa matrice Admin uniquement si `NAXA_STORAGE_E2E_ADMIN_EMAIL` et `NAXA_STORAGE_E2E_ADMIN_PASSWORD` sont transmis.
- Le workflow Promoteur secret-safe prépare un mot de passe éphémère Promoteur mais ne prépare pas celui de la fixture Admin. Le workflow de base ne possède pas non plus ces identifiants ; il marque donc explicitement la matrice Admin SKIP.

**Décision technique de reprise :**
- Ne pas créer, supprimer, renommer, convertir ou réattribuer de rôle à un compte Auth.
- Approvisionneur dédié désormais ajouté : validation stricte de l'e-mail exact, des deux marqueurs E2E, de la confirmation Auth et du profil lié `admin/actif`. Seul le mot de passe de cette fixture est renouvelé, aléatoirement et pour le job en cours.
- Le mot de passe est transmis via un fichier temporaire privé runner (mode 0600), masqué dans GitHub Actions puis supprimé par nettoyage, y compris en cas d'échec.
- Le workflow E2E exige maintenant les matrices Admin et Promoteur, et ferme les sessions des deux rôles en fin de recette.

**Point exact de reprise :** code et tests sont versionnés au §31. Confirmer le résultat du run déclenché par le push `main`, examiner ses assertions Admin/Promoteur et ses lignes de nettoyage. Ne pas annoncer la matrice Admin PASS tant que les logs du job ne sont pas consultés.


## 31. Activation de la matrice Storage Admin — provisionnement secret-safe (15/11/2026)

**Périmètre : Replay uniquement.** Pas de Production, Vercel ni Play Store.

**Fixture Admin conservée :**
- Identité existante `naxa.e2e.20261104.admin@example.invalid` ; Auth confirmé ; profil lié `role='admin'`, `actif=true`.
- Marqueurs validés en lecture seule : `naxa_e2e_fixture='NAXA-E2E-20261104'`, `naxa_e2e_persona='admin'`.
- Le compte n'a été ni créé, ni supprimé, ni renommé, ni converti, ni réactivé durant le contrôle. Aucun rôle ou privilège n'a été modifié.
- Aucun compte Replay correspondant à `naxa.home@gmail.com` n'a été trouvé ; l'identité Admin technique dédiée reste la seule utilisée pour la recette.

**Code versionné sur main :**
- `scripts/e2e/provision-replay-admin-safe.cjs` — commit `3dff0daca9734460f5567c50d3d6f1c444868673`. L'approvisionneur refuse tout hôte autre que Replay, exige exactement une identité avec marqueurs Admin E2E + confirmation Auth et un profil Admin actif lié ; il ne crée aucun compte et ne change aucun rôle. Il renouvelle seulement le mot de passe de cette fixture avec une valeur aléatoire propre au job.
- `scripts/test-replay-admin-safe.cjs` — commit `ebfdfd656b33b05c357401b0f8bb443fae341f39`. Huit tests unitaires codés pour URL Replay, identité, marqueurs, confirmation, liaison Auth/profil, rôle actif et génération de secret.
- `scripts/storage-e2e.cjs` — commit `90439d0fab52330abfdc062ecccef7529449012d`. Les sessions existantes Admin et Promoteur sont maintenant fermées localement après leur matrice ; elles ne sont ni supprimées ni globalement révoquées.
- `.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml` — commit `5f24e339b562704830b9d77043745f14eaa6888b`. Le workflow exécute les tests de provisionnement, prépare la fixture Admin puis la fixture Promoteur, exige `NAXA_STORAGE_E2E_REQUIRE_ROLE_MATRIX=1`, exécute les deux matrices et supprime les fichiers de mot de passe éphémère dans un bloc de nettoyage `always()`.

**Protections :**
- URL épinglée sur `https://pwfftcsjyeibxxqhwysw.supabase.co`; l'URL Production est explicitement refusée.
- Aucune valeur de mot de passe n'est écrite dans Git, les logs ou le document ; génération au runtime, fichier sous `RUNNER_TEMP` avec mode 0600 et masquage GitHub Actions.
- Les tests Admin utilisent seulement l'identité confirmée et déjà marquée comme fixture. Le profil Auth n'est jamais converti ni réactivé automatiquement.
- Les sessions Admin et Promoteur ouvertes pour la recette sont fermées avec le scope local ; aucune révocation globale.

**État d'exécution et précontrôles SQL :**
- Le push du workflow sur `main` est le déclencheur configuré pour lancer le nouveau job obligatoire.
- Les fichiers et le workflow ont été relus après écriture ; le câblage des deux provisionneurs, les huit tests unitaires et le nettoyage des sessions sont présents.
- Contrôle SQL Replay : le bucket `pharmacie-documents` est privé avec les politiques Admin SELECT/INSERT/UPDATE/DELETE ; le bucket `medicaments` est public avec les politiques Admin INSERT/UPDATE/DELETE et SELECT public. Les limites et MIME sont conformes aux fichiers utilisés par le test.
- Simulation transactionnelle des claims JWT de la fixture : `auth.uid()` résout le profil Admin attendu et `is_admin()` retourne `true` ; transaction annulée après le contrôle. Cela prouve le garde SQL, pas une opération HTTP Storage réelle.
- Le run GitHub Actions `43682840616` (commit `5f24e339b562704830b9d77043745f14eaa6888b`) a été consulté : les huit tests unitaires Admin passent, le provisionneur Promoteur passe, mais le provisionneur Admin échoue car la liste Auth REST ne renvoie pas exactement une fixture correspondante. La matrice Storage a été sautée après cet échec. **Aucun PASS E2E Admin HTTP n'est revendiqué.**
- Le succès historique Promoteur/Storage (run `43618611055`, 14 PASS / 1 SKIP Admin) reste valable pour son commit précédent ; il ne prouve pas encore la nouvelle matrice Admin. Le workflow Storage historique séparé (`43682835966`) a passé ses 11 scénarios de base et le nettoyage, puis échoué sur l'ancienne connexion Admin avec HTTP 400.

**Conclusion :** la matrice Admin n'est plus facultative et son exécution HTTP est maintenant validée sur Replay ; voir §35.

**Point exact de reprise :** diagnostiquer le contrat de pagination/énumération Auth Admin qui ne retrouve pas l'identité pourtant confirmée et présente en SQL ; ne pas créer de compte de remplacement. Puis faire passer la matrice Storage complète, en privilégiant le provisionneur secret-safe plutôt que l'ancien secret Admin statique.


## 32. Audit du parcours Livreur et préparation de la fixture E2E Replay (15/11/2026)

**Périmètre : inventaire Replay en lecture seule et préparation de code sur main.** Aucun compte Livreur, invitation, affectation, commande, mission ou paiement n'a été créé pendant cet audit. Production et Vercel exclus.

**État réel des profils Replay :**
- Deux profils seulement : un Admin actif/confirmé et un Promoteur actif/confirmé.
- Aucun profil Client ; aucun compte Pharmacie ou Caisse ; aucune affectation professionnelle.
- `naxa_livreur_invites` : 0 invitation ; `naxa_professional_assignments` : 0 ligne ; affectations Livreur actives : 0.
- Le rôle `livreur` est actif et assignable dans `naxa_roles`. La table `naxa_role_privileges` ne contient actuellement aucune ligne pour `role_key='livreur'` et aucun code correspondant directement à un privilège Livreur n'a été trouvé dans le référentiel `naxa_privileges`. Le catalogue décrit d'ailleurs les privilèges opérationnels du poste comme restant à définir explicitement ; ce point demeure une réserve d'autorisation/UI à examiner, sans ajout arbitraire de droits pendant cette passe.

**Contrat métier établi par inspection des fonctions Replay :**
1. Le Promoteur valide (pharmacie explicitement liée + privilège `ASSIGN_USER_TO_PHARMACY`) ou le compte Pharmacie propre à l'établissement peut créer une invitation Livreur par `naxa_create_livreur_invite`. L'invitation expire après 7 jours ; les invitations en attente précédentes pour le même e-mail et la même pharmacie sont révoquées.
2. Le titulaire doit accepter avec un compte Auth déjà confirmé, dont le profil racine est un Client actif, majeur, complet et consentant. `naxa_accept_livreur_invite` refuse les postes professionnels non-Livreur simultanément actifs, crée l'affectation permanente ordinaire, puis sélectionne le rôle actif Livreur.
3. Un candidat du personnel déjà rattaché à la pharmacie ou au réseau peut, selon le contrôle métier, recevoir une permanence Livreur temporaire ; il n'est pas converti en compte Livreur indépendant.
4. Le Promoteur et la Pharmacie peuvent consulter la liste des livreurs de leur périmètre par `naxa_livreurs_management_list`. Un Promoteur ne peut demander une pharmacie hors réseau. La révocation d'une affectation Livreur est bloquée si une livraison est encore acceptée, retirée ou arrivée.
5. La publication d'une mission est réservée au processus Stock/Magasinier après confirmation physique `prete_au_retrait`, horodatage de confirmation Stock et paiement choisi/vérifié (exception : paiement en espèces à la livraison).
6. Un Livreur avec affectation et rôle actif dans la pharmacie peut accepter une mission disponible, retirer le colis après validation Stock/paiement, signaler l'arrivée et confirmer la remise.
7. Le Client propriétaire de la réservation confirme la réception après l'arrivée. La clôture `livree` n'est finalisée que lorsque le Client ET le Livreur ont confirmé et que le paiement est validé. Le suivi Client est fourni par `naxa_delivery_tracking`; le tableau de bord Livreur par `naxa_delivery_my_missions`.
8. Les RPC sensibles contrôlées sont exécutables par `authenticated` et non par `anon`. Les tables d'invitations et de missions ont RLS activé ; les invitations ne sont pas exposées en accès direct au rôle authenticated et passent par les RPC serveur prévues.

**Points de vigilance métier/technique :**
- Le simple rôle de catalogue `livreur` n'accorde pas de privilèges génériques ; l'accès aux opérations de livraison s'appuie surtout sur profil actif, affectation, rôle actif, pharmacie active et propriété de mission. La matrice de permissions du dashboard reste à examiner avant validation UI.
- Le test d'isolation doit couvrir explicitement un Promoteur qui tente de consulter une pharmacie non rattachée ainsi qu'un Livreur qui tente d'accepter une mission d'une autre pharmacie.
- La recette E2E complète exige un vrai enchaînement réservation → Stock prêt → paiement → mission disponible → acceptation → retrait → arrivée → confirmations Client/Livreur → clôture. Aucun enregistrement métier de cette chaîne n'a encore été créé.

**Précontrôle RPC Promoteur — transaction annulée :**
- Simulation du JWT métier de la fixture Promoteur dans une transaction SQL locale, puis appel de `naxa_livreurs_management_list` sur sa pharmacie Mvan liée : autorisé.
- Même RPC sur la pharmacie Bastos, active mais réellement non rattachée au Promoteur : refus attendu « hors du réseau Promoteur ».
- Appel de `naxa_create_livreur_invite` avec l'adresse synthétique E2E pour la pharmacie Mvan : UUID d'invitation retourné. La transaction entière a ensuite été annulée.
- Contrôle après rollback : **0 invitation persistée** pour l'adresse Livreur E2E. Aucun profil, invitation, affectation ou donnée métier n'a été créé par ce précontrôle.
- Ce contrôle valide les gardes SQL et le chemin serveur de création d'invitation sous claims simulés ; il ne remplace pas l'acceptation Auth réelle ni un test HTTP/Client.

**Harnais Livreur préparé sur main, non exécuté :**
- `scripts/e2e/provision-replay-livreur-safe.cjs` — commit `0ca7a84a357335878454cd876a69b89c910ebcfe`. Le script est limité à Replay, définit une fixture Client synthétique et complète, puis vise le parcours normal création d'invitation Promoteur → acceptation Client → affectation Livreur permanente → sélection du rôle → contrôle de liste Promoteur/isolation → appel du dashboard Livreur. Le profil racine reste `client`; aucune mission ni aucun paiement n'est créé par ce script.
- `scripts/test-replay-livreur-safe.cjs` — commit `0a994333e48138efc0f6c0cd44fca993c12cfc18`. Huit tests unitaires codés pour l'épinglage Replay, les marqueurs de fixture, l'âge/consentement/profil Client et les secrets éphémères. Tests non encore exécutés dans cette étape.
- Les deux scripts ne sont pas encore raccordés au workflow E2E actif ; la fixture et l'affectation Livreur ne sont donc **pas** créées.

**Point exact de reprise :** corriger/compléter le harnais de provisionnement Livreur, en particulier la fermeture locale des sessions Promoteur/Livreur, intégrer les deux fichiers au workflow Replay après le provisionnement Promoteur et avant la matrice Storage, exécuter les tests unitaires, puis contrôler les logs et les lignes Auth/profil/invitation/affectation sur Replay. Ensuite seulement, préparer le parcours réel Stock → mission → Livreur → Client ; ne créer aucune fausse réservation ou paiement sans que les conditions de recette métier soient conçues et nettoyables.


## 33. Consolidation des résultats CI et audit du front Livreur existant (15/11/2026)

**Résultats GitHub Actions consultés après le §31 :**
- Run [43682840616 — Promoteur / Admin / Storage](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43682840616), commit `5f24e339b562704830b9d77043745f14eaa6888b` : **FAIL**. Les 8 tests unitaires de sécurité de la fixture Admin passent ; le provisionnement Promoteur passe ; l'étape de provisionnement Admin échoue avec `Une seule fixture Auth Admin exactement est requise`. L'étape Storage est donc SKIP et le job finit en échec. Les fichiers temporaires Promoteur sont nettoyés par l'étape `always()`.
- Contradiction à investiguer : l'API Auth Admin REST interrogée par le script ne renvoie pas exactement une correspondance, alors que l'inventaire SQL Replay voit seulement 2 lignes Auth et confirme une unique identité `naxa.e2e.20261104.admin@example.invalid`, confirmée et liée à un profil Admin actif avec marqueurs E2E exacts. La cause technique (pagination, forme de réponse ou filtre) n'est **pas encore prouvée**. Ne pas créer une autre identité.
- Run [43682835966 — ancien Storage E2E](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43682835966), commit `90439d0fab52330abfdc062ecccef7529449012d` : **FAIL**. Les 11 scénarios Storage de base passent et les deux utilisateurs temporaires ainsi que les objets sont nettoyés ; le test échoue ensuite à la connexion Admin historique, HTTP 400. Cette matrice consomme encore le secret Admin statique de dépôt, distinct du mot de passe éphémère du workflow secret-safe. Ne pas confondre ce run avec le run Promoteur/Admin ci-dessus.
- Run [43682840610 — NAXA quality](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43682840610), même commit : actionlint **PASS** ; tests **407 PASS / 1 FAIL** sur 408. Unique échec : `scripts/test-security-gateway-agent.cjs`, test « agent événements : empreinte stable et métadonnées bornées », rejet `Date d’événement invalide.`. Le test fixe une date au 08/11/2026 alors que le validateur n'accepte que les sept derniers jours glissants ; le run du 15/11/2026 l'a donc dépassée. Cause d'instabilité temporelle établie ; correction du test non encore appliquée.

**Audit du front-end Livreur sur main — fonctions déjà présentes :**
- `src/app/pharmacie/affectations/page.tsx` : écran commun Promoteur/Pharmacie, filtre les pharmacies dans le périmètre, affiche le formulaire d'invitation, le gestionnaire d'affectations Livreur et la configuration de livraison ; conserve aussi l'attribution de fonctions urgentes temporaires.
- `src/components/pharmacie/InvitationLivreurForm.tsx` : création d'une invitation nominative par RPC, lien à copier et validité 7 jours ; texte explicite : aucun SMS/WhatsApp automatique.
- `src/components/pharmacie/LivreursAssignmentsManager.tsx` : liste des Livreurs du périmètre, statut, compte actif, période, type d'affectation et révocation motivée ; les refus de révocation sur mission active sont rendus visibles à l'utilisateur.
- `src/app/invitation/livreur/page.tsx` et `src/components/AcceptCourierInvitationClient.tsx` : acceptation du lien par le seul compte destinataire connecté ; création du poste Livreur sans remplacer le rôle racine Client ; retour vers le tableau de bord Livreur.
- `src/app/pharmacie/livreur/page.tsx`, `src/components/pharmacie/LivreurWorkspaceClient.tsx` et `LivreurProfileClient.tsx` : espace Livreur et profil ; file de missions, acceptation, navigation vers pharmacie/Client, coordonnées Client après attribution, messagerie, retrait géolocalisé, arrivée, déclaration d'espèces à la livraison, confirmation de remise, GPS manuel/automatique, gestion des affectations multi-pharmacies, performances sur 30 jours, historique CSV, changement sécurisé de mot de passe et déconnexion.
- `src/app/pharmacie/gestionnaire-stock/commandes/page.tsx` et `src/app/pharmacie/gestionnaire-stock/livraison-actions.ts` : confirmation de la demande par Stock, démarrage de la préparation et confirmation « Prête pour livraison ». La page indique que les Livreurs ne sont sollicités qu'après préparation physique et validation du paiement requis.
- `src/components/SuiviLivraison.tsx` et `src/components/SuiviLivraisonPharmacie.tsx` : suivi Client et Pharmacie, rafraîchissement périodique, jalons, état, coordonnées GPS et confirmation de réception Client.
- Ces fichiers démontrent la présence du parcours front et de ses appels RPC, **pas** son fonctionnement complet en exécution réelle. Aucun parcours navigateur Client → Stock → Livreur → Client n'a encore été exécuté dans cette séquence.

**Réserves Livreur restant à fermer :**
1. La matrice de privilèges `role_key='livreur'` demeure vide dans `naxa_role_privileges` ; les opérations sensibles sont actuellement gardées surtout par l'affectation, le rôle actif, la pharmacie et la propriété de mission. Il faut terminer l'audit des autorisations RPC/UI, sans attribuer des droits génériques non validés.
2. Le harnais `scripts/e2e/provision-replay-livreur-safe.cjs` et ses huit tests unitaires sont présents sur main, mais n'ont pas été exécutés ni raccordés au workflow actif. Le harnais doit aussi fermer explicitement les sessions Promoteur et Livreur en local avant de devenir exécutable dans le workflow.
3. Le précontrôle SQL en transaction annulée (§32) couvre l'autorisation Promoteur et le refus hors réseau, pas l'acceptation Auth réelle ni l'activation du rôle Client/Livreur.
4. Il reste à fabriquer une réservation de recette correctement nettoyable et à vérifier les étapes Stock → paiement → publication mission → acceptation → retrait → arrivée → confirmation des deux parties → clôture. Ne pas produire de fausses preuves de paiement.

**État corrigé de la suite :**
- Réserve idempotence RESEAU : **corrigée et testée sur Replay** (§29).
- Admin Storage HTTP : **non validé**, bloque au provisionnement Auth et doit encore réussir.
- Qualité : **échec unique temporel** (date de test dépassée), à corriger.
- Front Livreur : **présent sur main**, recette E2E métier non exécutée.
- Données métier Livreur : **aucune** créée durant cette séquence.
- Production / Vercel : **intacts, non touchés**.

**Point exact de reprise :**
1. Corriger le test de date d'événement avec une date relative au temps d'exécution, puis relancer la qualité.
2. Diagnostiquer le listing Auth Admin REST malgré la fixture SQL unique ; débloquer le provisionneur strictement sans nouvelle identité ni conversion de rôle, puis exécuter la matrice Storage Admin et Promoteur complète.
3. Faire une passe d'audit des garde-fous du rôle Livreur et du cycle de mission, intégrer/assainir le harnais, puis seulement préparer les comptes et données métier de recette sur Replay.


## 34. Corrections ciblées suite aux échecs du 15/11/2026 (15/11/2026)

**Correctif du test temporel :**
- Le test `scripts/test-security-gateway-agent.cjs` utilisait une date fixe au 08/11/2026 ; le validateur impose une fenêtre glissante de sept jours, d'où l'échec au run qualité du 15/11.
- La valeur du test utilise désormais `new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()`, conservant une date passée valide sans réduire la contrainte serveur.
- Commit : `98b8ffd2981545b2cfc28e1ef69f3f6fe29a9f16`.

**Correctif ciblé du provisionneur Admin :**
- La version précédente parcourait `GET /auth/v1/admin/users?page=1&per_page=1000` puis filtrait la liste ; elle ne retrouvait pas la fixture alors que SQL prouve l'existence d'un unique profil Admin actif et son identité Auth confirmée.
- Après diagnostic GoTrue, le provisionneur recherche le profil unique `e2e_admin_261104`, puis parcourt de manière bornée les pages `GET /auth/v1/admin/users?page=N&per_page=50`, avec rapprochement strict de l'ID et de l'e-mail. Il valide la confirmation, les marqueurs E2E, le rôle Admin et le profil actif avant de renouveler le mot de passe éphémère ; il revalide ensuite la même identité.
- Aucun compte créé, supprimé, converti ou réactivé par ce changement ; seule la fixture explicitement désignée pourra voir son mot de passe de test renouvelé.
- Le provisionneur secret-safe a ensuite été corrigé de façon incrémentale jusqu'au commit de recette `820f8cb92e5ea8a4e95e1ae49dcd6c04b22272a6` ; le diagnostic et la correction de données Auth Replay sont tracés au §35.

**Nouveaux runs déclenchés par le push du 15/11 :**
- Run qualité `43683863943` annulé après un push ultérieur ; la qualité finale est le run `43684131922` SUCCESS (§35).
- Run `43683863952` remplacé après correction de la fixture ; la réussite définitive Admin + Promoteur est documentée au §35.
- Ne pas convertir ces runs en PASS tant que leurs conclusions et logs finaux n'ont pas été consultés.

**Point exact de reprise :** la qualité et les deux matrices Storage sont closes au §35. Poursuivre la préparation et la recette fonctionnelle complète du rôle Livreur ; aucune conclusion globale AU VERT ne doit être tirée de la seule matrice Storage.


## 35. Clôture de la matrice Storage Admin + Promoteur et correction de la fixture Auth Replay (15/11/2026)

**Résultat final :**
- [Workflow Promoteur/Admin/Storage 43684131897](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43684131897), commit `820f8cb92e5ea8a4e95e1ae49dcd6c04b22272a6` : **SUCCESS**.
- [Workflow qualité 43684131922](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43684131922), même commit : **SUCCESS**.
- Tests du harnais Admin + Promoteur : **16 PASS / 0 FAIL / 0 SKIP** (8 assertions de la fixture Admin et 8 du provisionneur Promoteur).
- Storage E2E Replay : **17 PASS / 0 FAIL / 0 SKIP**.
- Workflow qualité : tests, TypeScript, ESLint, build Next.js et vérification actionlint : tous les jobs **SUCCESS**.

**Matrice Storage exécutée réellement via HTTP :**
- Base : upload PDF propriétaire, lecture propriétaire, isolation lecture et écriture inter-utilisateurs, refus anonyme du bucket privé, URL signée propriétaire et refus pour un tiers, rejet MIME interdit, refus d'accès client aux buckets réservés, lecture publique d'une vraie image.
- Admin actif : dépôt et lecture d'un document privé ; remplacement et lecture publique d'une photo médicament ; refus de lecture des documents pharmacie par un non-Admin.
- Promoteur actif : dépôt et remplacement dans sa pharmacie liée ; refus d'écriture dans une pharmacie hors réseau.
- Nettoyage : objets temporaires des buckets `pharmacies-photos`, `medicaments`, `pharmacie-documents` supprimés ; sessions Admin et Promoteur fermées localement ; deux utilisateurs Auth techniques temporaires révoqués puis supprimés.
- Conclusion terminale visible dans le job : `Storage E2E Replay : 17 PASS, 0 SKIP.`
- Contrôle SQL post-run : `naxa_storage_e2e` utilisateurs temporaires = **0** ; objets Storage temporaires = **0**.
- Les fichiers contenant les mots de passe temporaires sont supprimés par trap et par l'étape `always()`. Les valeurs ne sont pas présentes dans les logs.

**Cause racine de la visibilité Auth de la fixture Admin :**
1. La ligne `auth.users` Admin existait et était jointe au profil, mais `instance_id` était `NULL`. Les recherches GoTrue Admin filtrent sur l'instance standard `00000000-0000-0000-0000-000000000000` ; l'utilisateur restait donc invisible via les API Auth alors que SQL le voyait. GoTrue source confirme le filtrage par l'instance pour la recherche par ID/e-mail et la liste des utilisateurs.
2. Après correction de `instance_id` sur cette seule fixture, l'API Auth a renvoyé HTTP 500 : son scan Go échouait car quatre champs texte étaient `NULL` : `confirmation_token`, `recovery_token`, `email_change_token_new` et `email_change`. Le Promoteur créé par Auth avait ces champs initialisés à chaîne vide.
3. Le compte Admin Replay avait donc été inséré directement avec une structure incomplète pour GoTrue, ce qui expliquait simultanément les 404 « User not found » et le 500 de lecture de la liste.

**Réparation strictement limitée à la fixture Replay existante :**
- `auth.users.instance_id` de la seule fixture `naxa.e2e.20261104.admin@example.invalid` a été fixé à `00000000-0000-0000-0000-000000000000`.
- Les quatre champs texte Auth précédemment NULL ont été normalisés à `''`.
- Les deux transactions utilisaient un prédicat de garde strict : UUID exact, e-mail exact, marqueurs `NAXA-E2E-20261104/admin`, e-mail confirmé, compte non supprimé, profil lié `username=e2e_admin_261104`, `role=admin`, `actif=true`.
- Contrôle post-réparation : instance standard ; e-mail confirmé ; aucun compte supprimé ; quatre champs non NULL ; hash du mot de passe présent et conservé ; profil toujours Admin actif. Aucun nouveau compte Auth ou profil créé.
- `auth.identities` demeure à 0 ligne pour cette fixture ; la recette démontre que la connexion mot de passe et les opérations Storage Admin fonctionnent malgré cette absence d'identité fédérée. Ne pas présenter ceci comme une preuve de fournisseur OAuth/email identity row.
- La nouvelle provisionneuse reste bornée au Replay, ne crée aucun compte Admin et ne renouvelle que le secret de cette fixture explicitement marquée.

**Code et workflow :**
- `scripts/e2e/provision-replay-admin-safe.cjs` : validation profil puis liste Auth paginée et bornée (20 pages maximum × 50 utilisateurs), rapprochement ID + e-mail ; contrôle des marqueurs et état avant/après rotation.
- `scripts/test-replay-admin-safe.cjs` et `scripts/test-replay-promoteur-safe-v2.cjs` : 16 tests passés.
- `.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml` : matrices obligatoires (`NAXA_STORAGE_E2E_REQUIRE_ROLE_MATRIX=1)); fichiers secrets temporaires supprimés après le job.
- Aucun changement Production, Vercel ou Play Store. Les ajustements `auth.users` ont été effectués sur Replay uniquement.

**État de recette actualisé :**
- Matrice Storage de base : **validée**.
- Matrice Storage Admin : **validée**.
- Matrice Storage Promoteur et isolation inter-pharmacies : **validée**.
- Idempotence des privilèges Promoteur RESEAU : **corrigée et testée** (§29).
- Qualité automatisée / TS / ESLint / build / actionlint : **PASS** au commit testé.
- Recette fonctionnelle Livreur (Client → invitation → affectation → Stock → paiement → mission → livraison → confirmations) : **non exécutée**.
- Matrice de privilèges `role_key='livreur'` : encore à auditer ; ne pas ajouter de droits génériques non validés.
- Recette globale NAXA : **PARTIELLE**. Ne pas déclarer AU VERT.

**Point exact de reprise :**
1. Continuer l'audit des gardes RPC/UI et de la matrice de privilèges Livreur.
2. Finaliser un harnais Livreur avec fermeture locale sûre de session ; exécuter ses tests unitaires sur CI.
3. Construire une réservation Replay correctement contrôlée/nettoyable, puis prouver le flux Stock prêt → paiement réellement validé → mission disponible → acceptation Livreur → retrait → arrivée → confirmation Livreur + Client → clôture.
4. Après cette recette, poursuivre les autres profils professionnels et les validations appareil réel.


## 36. Suppression de toute commission NAXA sur la livraison — Replay (15/11/2026)

**Contradiction métier et cause racine :**
- L'audit de `private.naxa_delivery_finalize_if_confirmed(uuid)` a révélé une retenue fixe de 500 FCFA par livraison finalisée, enregistrée dans `naxa_delivery_commission_ledger`.
- `naxa_delivery_monthly_due(date)` ajoutait les commissions non réglées au montant mensuel de l'abonnement ; un trigger sur `abonnement_paiements` marquait ces commissions comme réglées lors des paiements d'abonnement.
- Les écrans Admin et Promoteur affichaient ces commissions, alors que la règle économique NAXA applicable est **zéro commission marketplace et zéro commission de livraison**. Le document du 07/11 avait une règle historique à 500 FCFA ; elle est explicitement supersédée en §7 de `docs/DECISION_TARIFICATION_LIVRAISON_2026-11-07.md`.
- Contrôle avant migration Replay : le registre contenait **0 ligne et 0 FCFA**. Aucune donnée financière historique n'a donc été réécrite ; la migration échoue volontairement si des lignes non nulles sont présentes dans un environnement futur.

**Décision fonctionnelle retenue :**
- Le devis Client, le barème progressif et les suppléments géographiques restent inchangés.
- La totalité des frais acquittés par le Client est affectée au service de livraison : `commission_naxa=0` et `solde_livraison=frais_livraison_client`.
- Aucun montant de livraison n'est ajouté à l'abonnement mensuel de la pharmacie ; seul l'abonnement de base demeure dû.
- La clôture métier reste bloquée tant que le paiement n'est pas confirmé et que les deux confirmations Client + Livreur ne sont pas présentes.
- Les écrans Admin/Promoteur présentent désormais les frais Clients et le montant intégral affecté au service ; aucune commission n'est affichée.

**Migrations Replay appliquées :**
- `delivery_no_naxa_commission_policy`, version Replay `20261115061637` — migration source `supabase/migrations/20261115130000_delivery_no_naxa_commission_policy.sql`, commit `b5a9bc7aee3ee02d7c48772fc59a2699fc39bf4f`.
- `delivery_fees_report_qualified_pharmacy_alias`, version Replay `20261115062204` — corrige le nom de colonne ambigu `ville` dans le rapport Admin/Promoteur ; migration source `supabase/migrations/20261115133000_delivery_fees_report_qualified_pharmacy_alias.sql`, commit `306963b9a0b132e59bf2a2a80c1dc826554735a3`.
- La première exécution du nouveau rapport a révélé l'ambiguïté entre `l.ville` du registre et `ph.ville` ; le CTE du rapport utilise maintenant des alias explicites pour la pharmacie, tout en gardant les clés JSON `nom` et `ville` attendues par l'interface.

**Correctifs versionnés sur main :**
- `src/lib/delivery-pricing.ts` : `COMMISSION_NAXA_LIVRAISON=0` et répartition `commissionNaxa=0), `soldeLivraison=fraisClient` — commit `f84b3675b6ed5b6a236f9cadeb0b29d1e0b5b4cf`.
- `scripts/test-delivery-pricing.cjs) : tests sur 1 500, 1 750, 3 500, 5 200, 13 200 et 20 000 FCFA ; 100 % affectés au service, 0 retenue — commit `1ed35d52b34ba0b37c089f4e9863341400d3096f`.
- `src/components/DeliveryCommissionReport.tsx` exporte maintenant `DeliveryFeesReport` et utilise `naxa_delivery_fees_report) ; le rapport mensuel affiche uniquement les abonnements de base — commit `e84012f37729e495c8de8d1b1c6fdbc4e3dbf058`.
- Pages Admin et Promoteur raccordées au nouveau composant : commits `f3b77895ba88e4eae3a0102ac7c2fcaf5d28b214`, `185f4decdf98905aa4980eae40eb04c5795fc2f8), puis imports corrigés vers le fichier de composant conservé : `80227a7b4cb0560c8ac4245f54b28775370b6315), `8bb28b26d052ee1539c66cbd3c2d7babb8d43c8a`.
- `scripts/test-delivery-commercial-flow.cjs) : contrats commerciaux révisés (devis, rapport et mensualités sans commission) — commit `0bd07af27db3a5804b754ff6299752725db5bd11`.
- `docs/DECISION_TARIFICATION_LIVRAISON_2026-11-07.md) : §7 rend explicitement caduque la règle historique des 500 FCFA — commit `98c0c420855483d43c0713718ea65b53ac99b799`.
- Test SQL `supabase/tests/20261115130000_delivery_no_naxa_commission_policy.sql) : contraintes, fonction de clôture, ACL, suppression du trigger d'abonnement, rapport Admin réel sous claims simulés et mensualité égale à l'abonnement de base ; dernière version commit `c01849ea861b2ef13f205a9bca3d954f98db0f5a`.

**Preuves Replay après correction :**
- Test SQL exécuté avec succès : sortie `NAXA delivery commission: 0; full client fee allocated to delivery service: PASS`.
- Rapport frais Admin : exécution réussie sous le JWT Admin Replay simulé ; `retenue_naxa=0). Le rapport a aussi confirmé un registre vide cohérent.
- Décompte mensuel Admin : test SQL confirme `commissions_livraison=0), `total_a_payer=abonnements), et pour chaque pharmacie `commission_a_payer=0), `total_mensuel_du=abonnement_mensuel`.
- Intégrité du registre : 0 ligne, 0 frais cumulés, 0 retenue NAXA, 0 montant affecté enregistré (aucune mission financière n'a été créée).
- ACL du nouveau rapport : `anon` interdit, `authenticated` autorisé.
- Trigger `trg_naxa_delivery_commission_monthly_settlement) absent ; fonction `private.naxa_delivery_sync_subscription_commission_settlement()) absente.
- Aucune Production, Vercel, ni donnée Auth/mission/paiement modifiée.

**État qualité :**
- Run qualité du commit de code précédent `43684986683) a été lancé puis remplacé par les mises à jour du rapport et des assertions ; aucun résultat PASS n'est revendiqué sur ce run intermédiaire.
- Dernier run qualité déclenché par le commit test `07be29f79479b302f99f5f240deb6bfce11f3e65) : `43685140386), en cours au moment de cette entrée. Actionlint et tests/TS/lint/build doivent encore être consultés dans les logs finaux.

**Conclusion :** la règle zéro commission et l'absence de cumul sur abonnement sont implémentées et vérifiées par SQL sur Replay. L'E2E HTTP complet Client → Stock → Caisse → Livreur → confirmations reste non exécuté ; la recette NAXA demeure **PARTIELLE**, sans statut global AU VERT.

**Point exact de reprise :**
1. Vérifier la conclusion du run qualité `43685140386) et corriger chaque échec éventuel sans relâcher les contrats métier.
2. Effectuer une revue finale des gardes du rôle Livreur et de son harnais, puis préparer une réservation de recette annulable sur Replay.
3. Exécuter le cycle Stock prêt → paiement réel de test contrôlé → mission → acceptation Livreur → retrait → arrivée → double confirmation → clôture, en vérifiant qu'aucune commission ni retenue ne réapparaît.
4. Ne pas migrer Production ni déployer avant une autorisation spécifique et une validation métier complète.


## 37. Reprise Livreur — durcissement des RPC conversation/GPS et intégration du harnais (15/11/2026)

**Périmètre : Replay uniquement pour les changements SQL.** Projet `pwfftcsjyeibxxqhwysw`. Aucun changement Production, Vercel ou Play Store.

**État de départ repris :**
- La matrice Storage Admin + Promoteur était déjà close au §35 : 17 PASS / 0 FAIL / 0 SKIP ; qualité automatisée PASS sur le commit de recette documenté au §35.
- La réserve d'idempotence des droits Promoteur RESEAU était close au §29.
- Le tableau de bord et les fonctions de livraison existaient, mais aucune mission réelle Client → Stock → Livreur → Client n'avait encore été exécutée.
- Le catalogue `naxa_role_privileges` ne porte aucune ligne `role_key='livreur'`. Aucun privilège générique n'a été ajouté sans définition métier explicite.

**Audit des gardes SQL :**
- Les RPC d'acceptation, de retrait, d'arrivée, d'ajout de position, de signalement, de confirmation de remise et de déclaration espèces utilisent le contrôle serveur `private.naxa_delivery_driver_can_act`, qui vérifie notamment le profil actif, le poste Livreur, l'affectation active à la pharmacie de la mission, le rôle actif sélectionné, la pharmacie active/non archivée, la préparation Stock et le mode/paiement requis.
- Une faiblesse supplémentaire a été trouvée dans la conversation de livraison : les fonctions de liste des messages, d'envoi de message et de partage GPS ne vérifiaient pas toutes de manière suffisante le contexte d'affectation active et de pharmacie.
- Une première version de correction a fermé les lectures Livreur et les branches d'envoi Livreur, mais la relecture contradictoire a révélé que le Client pouvait encore appeler directement les RPC d'envoi même lorsque le contexte Livreur n'était plus valide.
- La correction finale exige donc la validité de l'affectation Livreur et de la pharmacie pour **les deux côtés** avant d'autoriser l'envoi d'un message ou d'une position ; la conversation existante devient en lecture seule lorsque la livraison ou le contexte Livreur/pharmacie est suspendu.

**Migrations Replay appliquées :**
- `delivery_courier_chat_location_active_assignment`, version Replay `20261115064751` — code source `supabase/migrations/20261115160000_delivery_courier_chat_location_active_assignment.sql`, commit `6402d757e6126b9957f212e9be6884a4dadcfccd`.
- `delivery_chat_requires_live_courier_assignment`, version Replay `20261115064839` — code source `supabase/migrations/20261115161000_delivery_chat_requires_live_courier_assignment.sql`, commit `3c4c17d7c0984aee562b46feb9a051478cf2ad83`.
- Les définitions des RPC ont été relues après application. Aucun privilège générique `livreur` n'a été ajouté.

**Tests SQL réellement exécutés sur Replay :**
- `supabase/tests/20261115140000_delivery_driver_active_pharmacy_scope.sql` : **PASS** — confirmation de remise et déclaration espèces limitées au Livreur affecté dans sa pharmacie active.
- `supabase/tests/20261115160000_delivery_courier_chat_location_active_assignment.sql` : **PASS** — lecture conversation et droit d'écriture Livreur contrôlés ; ACL `anon` refusée et `authenticated` autorisée.
- `supabase/tests/20261115161000_delivery_chat_requires_live_courier_assignment.sql` : **PASS** — envoi de message et partage GPS refusés dès que le contexte Livreur/pharmacie active n'est plus valable, y compris lorsque l'appelant est le Client.
- Historique Replay vérifié : les trois versions `20261115062505`, `20261115064751` et `20261115064839` sont présentes.
- Ces tests vérifient les définitions, les gardes et les ACL SQL ; ils ne constituent pas une simulation d'une livraison réelle ni un test navigateur.

**Harnais Client/Livreur raccordé au workflow Replay :**
- `scripts/e2e/provision-replay-livreur-safe.cjs` : pagination Auth bornée à 20 pages de 50, refus des identités multiples, génération d'un mot de passe éphémère, et fermeture locale (`scope=local`) de toutes les sessions Promoteur/Livreur ouvertes. Aucun mot de passe n'est affiché.
- Le script suit le vrai parcours d'invitation : création/reprise de la fixture racine Client majeure et consentante, invitation par le Promoteur, acceptation avec ce compte Client confirmé, affectation Livreur permanente ordinaire, sélection du poste actif et vérification de l'isolation multi-pharmacies. Le rôle racine reste `client`.
- Le script n'émet aucune réservation, mission, déclaration d'espèces ou preuve de paiement. La fixture Livreur, si le job aboutit, est conservée sur Replay pour les prochaines recettes.
- Neuf tests unitaires du fichier `scripts/test-replay-livreur-safe.cjs` sont intégrées à la commande Node `--test` du workflow avec les suites Promoteur et Admin. Le workflow `.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml` crée la fixture Livreur après les fixtures Promoteur et Admin, puis lance la matrice Storage déjà établie. Le nettoyage `always()` supprime également le fichier de mot de passe Livreur.
- Commit du harnais avec pagination/nettoyage final : `f17edafd53a09e9ddf5432465fb17a4e97ff52e8`. Commit d'intégration au workflow : `c60d44084f28b2ae4a82d5f0499445d48b87b646`.

**Preuves post-provisionnement sur Replay après intégration du workflow :**
- Contrôle SQL Auth/profil : **1 identité** Livreur confirmée, instance Auth standard, marqueurs E2E exacts ; profil unique avec rôle racine `client`, actif, majeur vérifié, consentement présent et données de compte complètes.
- Le poste métier est `fonction_interne='livreur'` ; `private.naxa_business_function()` renvoie `livreur` et le rôle actif sélectionné est bien celui de la pharmacie liée.
- L'invitation destinée à l'adresse E2E porte `accepted_at`, `accepted_by` et `assignment_id` ; elle n'est ni révoquée ni expirée au contrôle.
- Une seule affectation Livreur est présente : `statut='active'`, `nature_affectation='ordinaire'`, `expire_at IS NULL`. Le profil racine reste Client ; aucun changement vers un rôle racine professionnel.
- Sessions Auth : **0 session** pour les comptes Promoteur et Livreur au contrôle post-job.
- Test SQL avec claims Promoteur/Livreur simulés dans une transaction annulée : Promoteur voit le Livreur dans sa pharmacie liée ; la demande pour une pharmacie HYBRIDE démo non liée est refusée ; le tableau de bord Livreur renvoie une file vide et les performances sont à zéro — **PASS**.
- Contrôle d'absence d'effets métier : **0 mission**, **0 réservation créée par le Client E2E**, **0 enregistrement de paiement** associé au Livreur. Aucune fausse preuve de paiement.
- La présence Auth + invitation acceptée + affectation et les connexions observées après le commit d'intégration prouvent que le provisionnement métier a été exécuté sur Replay. En revanche, le journal complet du run GitHub Actions n'est pas disponible dans cette passe : le résultat des neuf tests unitaires et le statut terminal global du workflow ne sont donc pas revendiqués.
- Le dernier run qualité consulté précédemment (`43685140386`) avait son job Tests/TypeScript/lint annulé et son job actionlint en succès ; il ne vaut pas qualité complète PASS pour les changements actuels.

**État :** gardes SQL Livraison — **corrigées et testées sur Replay** ; fixture Client/Livreur — **provisionnée et vérifiée sur Replay** ; isolation Promoter / tableau de bord — **SQL PASS sous claims simulés** ; sessions temporaires — **0 ouverte** ; matrice Storage Admin + Promoteur — **validée au §35** ; mission/réservation/paiement — **aucune donnée créée** ; recette métier Livraison complète — **NON EXÉCUTÉE**. La recette globale NAXA demeure **PARTIELLE**, sans statut AU VERT.

**Point exact de reprise :**
1. Récupérer le run GitHub Actions correspondant au commit `c60d44084f28b2ae4a82d5f0499445d48b87b646` pour vérifier les neuf tests unitaires et le statut terminal complet ; ne pas confondre les preuves SQL du provisionnement avec un PASS CI intégral.
2. Auditer les prérequis d'une réservation de recette annulable : Client distinct du Livreur, stock réel disponible dans la pharmacie E2E, poste Gestionnaire Stock et rôle Caisse permettant le rapprochement du paiement. Ne pas insérer de paiement `effectue` directement et ne pas fabriquer de reçu/SMS.
3. Préparer le cycle métier en mode paiement espèces à la livraison, avec une validation effective par la Caisse de test avant clôture ; Stock doit confirmer la préparation physique avant publication de mission.
4. Exécuter ensuite le cycle réel : mission disponible → acceptation Livreur → retrait → suivi GPS/chat → arrivée → confirmations Livreur + Client → encaissement validé par Caisse → clôture `livree`. Vérifier aussi les refus hors pharmacie et après suspension/expiration.
5. Continuer sans modifier Production ni déployer Vercel ; ne pas déclarer AU VERT avant les preuves métier et appareil réel encore manquantes.


## 38. Audit des prérequis réservation → Stock → Caisse → Livreur (15/11/2026)

**Périmètre : Replay uniquement, contrôles SQL en lecture seule.** Les seules données nouvelles conservées sont la fixture Client/Livreur et son affectation documentées au §37. Aucun stock, produit, compte supplémentaire, caisse, réservation, mission ou paiement n'a été créé pendant cet audit.

**État des comptes et affectations sur les deux pharmacies E2E du Promoteur :**
- Comptes Auth E2E présents : Admin, Promoteur et Livreur. Le compte Livreur a un profil racine Client et une affectation métier Livreur ; il ne doit pas être réutilisé comme acheteur séparé.
- Une seule affectation professionnelle active est présente sur les pharmacies liées : `livreur`. Aucune affectation active Gestionnaire Stock ni Caisse.
- Les rôles `gestionnaire_stock` et `caisse` sont déclarés actifs et attribuables à l'échelle PHARMACIE.
- Le Promoteur dispose, sur chacune de ses deux pharmacies E2E, des privilèges actifs `ASSIGN_USER_TO_PHARMACY`, `CREATE_CAISSE` et `MANAGE_LOTS`.
- Les contrôles de la RPC `naxa_grant_professional_assignment` ont été lus : elle vérifie le rôle assignable, le compte cible actif, la pharmacie active, le périmètre Promoteur, les privilèges requis, l'architecture et les chevauchements d'affectation. La sélection du rôle actif passe par `naxa_select_active_role`.
- Fonctions de service disponibles et ACL vérifiées : `gestionnaire_stock_service_ouvrir`, `gestionnaire_stock_reference_initialiser`, `gestionnaire_stock_quantite_ajuster`, `stock_lot_enregistrer`, `caisse_ouvrir`. Elles sont exécutables par `authenticated`, pas par `anon`.
- Les tables `caisses`, `stocks` et `stocks_lots` ne comportent pas de ligne d'ouverture ou de provisionnement pour ces pharmacies ; aucun service Stock ouvert et aucune session Caisse ne sont présents. La policy `caisses_scope` limite les opérations Authenticated à l'Admin ou à un profil pouvant accéder à la pharmacie.

**État de l'inventaire et du catalogue Replay :**
- `produits` contient **20 fiches** au total, dont **0 fiche validée** (`fiche_validee=true`).
- Pour chacune des pharmacies E2E liées, le contrôle trouve **0 référence avec quantité positive vendable**, **0 lot positif non bloqué et non expiré**.
- Synthèse sur les deux pharmacies : **0 ligne de stock positif**, **0 lot valide**, **0 réservation existante**, **0 mission de livraison existante**.
- Il n'existe donc pas de produit vendable actuellement démontrable pour une vraie réservation Client ; ajouter arbitrairement un médicament ou un prix de test risquerait de rendre une fiche non validée visible via la policy publique `produits_read`. Aucun produit n'a été créé ou rendu public.

**Contradictions et conséquences :**
- Le tableau de bord Livreur et son affectation sont prêts sur Replay, mais il ne peut pas recevoir de mission sans réservation de commande préparée par Stock et ayant un mode de paiement sélectionné.
- Une mission ne doit être créée qu'après confirmation Stock `prete_au_retrait` et validation du paiement requis par les règles serveur.
- Le scénario `especes_livraison` peut garder le paiement à encaisser jusqu'à la livraison, mais la finalisation métier exige ensuite une confirmation d'encaissement par une Caisse autorisée. Aucun paiement ne doit être marqué `effectue` directement par SQL et aucun faux reçu/SMS ne doit être généré.
- Aucune RPC dédiée `create_caisse` n'a été trouvée dans l'inventaire public des fonctions ; la policy de table `caisses_scope` autorise les écritures seulement dans un périmètre pharmacie accessible. Il faut donc vérifier le parcours UI/API métier de création de la caisse avant d'ouvrir sa session.

**Conclusion :** la recette des gardes Livreur et la fixture sont avancées, mais la chaîne métier ne peut pas encore démarrer faute de Client acheteur distinct, d'affectations Gestionnaire Stock/Caisse, d'une caisse et d'un catalogue/stock vendable validé. Aucune donnée artificielle n'a été injectée pour masquer ces prérequis. La recette globale reste **PARTIELLE**.

**Point exact de reprise :**
1. Identifier le parcours UI/API autorisé qui crée une caisse pour une affectation Caisse active ; tester sa policy sous session authentifiée, sans ouvrir une session caisse avec des fonds inventés.
2. Préparer, via le flux E2E dédié sur Replay, un Client acheteur distinct du Livreur et un personnel Stock/Caisse ; faire attribuer les rôles par le Promoteur via `naxa_grant_professional_assignment`, puis vérifier l'activation d'un seul rôle à la fois.
3. Obtenir ou importer une fiche médicament réelle et validée dans le catalogue Replay à partir de la source référentielle autorisée ; ne pas créer une fiche factice visible publiquement.
4. Initialiser la référence, faire un mouvement de stock audité et enregistrer le lot correspondant avec quantité identique au stock agrégé, péremption valide et étiquetage explicite E2E. Le tout sur Replay seulement.
5. Créer la réservation par le parcours Client, faire préparer physiquement par Stock, sélectionner le paiement espèces livraison, publier la mission, puis suivre la livraison et encaisser par la Caisse. Garder Production et Vercel intouchés.


## 39. Correction du provisionnement physique Caisse et préparation des profils métier E2E (15/11/2026)

**Périmètre : Replay uniquement.** Ref `pwfftcsjyeibxxqhwysw`. Aucun déploiement Vercel, aucune migration Production.

### Audit → contradiction → cause racine

- L'écran métier existant `/pharmacie/caisses` validait déjà le Promoteur/Responsable, le périmètre, `CREATE_CAISSE`, le compte NAXA cible, sa complétude et son statut Auth.
- L'action serveur `creerCaisse` appelait seulement `naxa_grant_professional_assignment(...,'caisse',...)`. Elle attribuait le poste professionnel, mais n'inscrivait aucune ressource dans `public.caisses`.
- L'écran `/pharmacie/caisse` cherchait une ressource `caisses` active et bloquait si aucune n'existait. La ressource physique manquante, et non l'affectation elle-même, était la cause racine de l'impossibilité de démarrer la Caisse.
- La RPC historique `naxa_provision_caisse(uuid,uuid)` existait déjà, mais n'était qu'un wrapper invoker qui attribuait le poste ; elle ne provisionnait pas le registre physique.

### Corrections appliquées sur Replay et versionnées sur main

1. Migration `provision_pharmacy_cash_register_with_assignment`, version Replay `20261115070734`, source `supabase/migrations/20261115180000_provision_pharmacy_cash_register_with_assignment.sql`, commit `9dce588191cbf6dc31db6b83d597020c7061494d`.
   - RPC `public.naxa_provision_caisse(uuid,uuid)` remplacée par une fonction `SECURITY DEFINER` avec `search_path='' `.
   - Elle appelle le garde canonique `naxa_grant_professional_assignment`, puis sérialise la création par verrou transactionnel pharmacie et crée `Caisse principale` si aucune ressource n'existe.
   - Si une ressource existe déjà et est active, aucune seconde Caisse physique n'est créée ; si elle existe mais est inactive, la RPC bloque explicitement au lieu de la réactiver silencieusement.
   - ACL : `PUBLIC` et `anon` révoqués ; `authenticated` et `service_role` autorisés.
2. Action serveur `src/app/pharmacie/actions.ts` modifiée pour appeler `naxa_provision_caisse` au lieu d'attribuer uniquement le rôle. Commit `b334aab696c91fc9339b6c18ec17db6481232896`.
3. Migration de reprise idempotente `make_cash_register_provisioning_idempotent`, version Replay `20261115071250`, source `supabase/migrations/20261115182000_make_cash_register_provisioning_idempotent.sql`, commit `abe587f7f0ea541ba6df336092c3738632fb74a2`.
   - Si l'affectation Caisse chevauche déjà la période, seule l'erreur exacte du garde d'affectation est tolérée, et uniquement après confirmation qu'il existe une affectation `caisse` active, non expirée, pour ce compte et cette pharmacie active.
   - Les autres exceptions du garde sont relancées ; le contrôle Promoteur/réseau/privilège/quota n'est pas contourné.
   - Le provisionnement de la ressource physique est ensuite rejoué de façon sûre, ce qui permet de réparer le cas « affectation présente / ressource absente ».
4. Le provisionneur E2E appelle maintenant toujours la RPC idempotente pour la fixture Caisse, même si l'affectation existe déjà, afin de réparer une ressource manquante. Commit `f60a06c6b6f0a49cfad781a0abc71b061fb399bf`.

### Tests et preuves

- Le test SQL `supabase/tests/20261115180000_provision_pharmacy_cash_register_with_assignment.sql` a été exécuté sur Replay : **PASS**.
- Le test SQL `supabase/tests/20261115182000_make_cash_register_provisioning_idempotent.sql` a été exécuté sur Replay : **PASS** — seuls le doublon exact d'affectation active et le cas de reprise conforme sont tolérés ; ACL `anon` refusée.
- Contrôle direct Replay après application : migration version `20261115070734` et version `20261115071250` présentes ; `naxa_provision_caisse` est `SECURITY DEFINER`, `search_path='' `, `anon_exec=false`, `authenticated_exec=true`, `service_role_exec=true`.
- La Server Action est raccordée à la nouvelle RPC et protégée par le flux existant de vérification du compte et de `CREATE_CAISSE`. Un test Node dédié `scripts/test-caisse-provisioning-action.cjs` a été ajouté (2 tests), mais son exécution CI n'est pas prouvée.
- Un test Node statique du SQL `scripts/test-caisse-provisioning-sql.cjs` a été ajouté (4 tests) et est inclus dans le workflow. Il n'est pas déclaré PASS tant qu'un journal de run ne le confirme pas.
- Supabase Advisors remonte l'avertissement `authenticated_security_definer_function_executable` pour cette RPC. C'est un avertissement attendu de son mode d'appel : la création physique contourne la RLS de la table via une fonction SECURITY DEFINER, mais la fonction exige `auth.uid()` et délègue l'autorisation à `naxa_grant_professional_assignment`, qui vérifie Promoteur/Responsable, périmètre, `CREATE_CAISSE`, compte actif, pharmacie et quota. Aucun accès `anon` ou `PUBLIC` n'est accordé. Ne pas supprimer le garde pour faire disparaître l'avertissement.

### Préparation de la recette suivante

- Harnais `scripts/e2e/provision-replay-pharmacy-staff-safe.cjs` et six tests unitaires `scripts/test-replay-pharmacy-staff-safe.cjs` ajoutés.
- Il prépare trois identités techniques séparées, toutes avec profil racine Client :
  - Gestionnaire Stock : `naxa.e2e.stock@example.invalid`.
  - Caisse : `naxa.e2e.caisse@example.invalid`.
  - Client acheteur : `naxa.e2e.client-acheteur@example.invalid`, distinct du Livreur déjà enrôlé.
- Le script est limité à Replay ; il vérifie les marqueurs E2E, la majorité, le consentement, les rôles actifs exclusifs, l'accès Caisse via RLS, la lecture Stock via RLS, puis ferme les sessions locales. Il ne crée ni stock, ni lot, ni réservation, ni vente, ni mission, ni paiement, et n'ouvre aucune session de Caisse.
- Le workflow `.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml` inclut les tests Node, la préparation de ces trois profils et le nettoyage des secrets. Commits d'intégration : `c371c24f2e0c44a9a1271b669a2f115b30b99434` et `860eeea798cea7e47082fb704fe987a464084bfb`. Les derniers changements de provisionneur sont également dans `main` (`f60a06c6b6f0a49cfad781a0abc71b061fb399bf`).

### Statut réel d'exécution et réserve

- Le contrôle SQL post-push trouve encore **0** identité parmi les trois nouveaux comptes, **0** affectation Stock/Caisse pour ces profils et **0** Caisse physique active sur les pharmacies du Promoteur.
- Les compteurs restent à **0** session Gestionnaire Stock ouverte, **0** session Caisse ouverte, **0** réservation et **0** mission : aucun effet métier artificiel n'a été créé.
- Les statuts de commit consultables ne retournent aucun contexte de test ; l'action GitHub disponible pour les runs de commit ne liste que les exécutions de PR et ne fournit pas le run push utile ici. L'exécution du workflow de provisionnement n'est donc **pas prouvée**, et les six tests Node staff + tests Node Caisse ne sont pas revendiqués PASS.
- Une tentative de clonage local pour exécuter Node n'a pas abouti (résolution DNS GitHub indisponible dans l'environnement). Cela ne vaut ni échec ni succès des tests.
- La matrice Storage Admin + Promoteur demeure la preuve antérieure du §35 (17 PASS / 0 SKIP) ; elle n'est pas confondue avec cette nouvelle recette.
- Catalogue Replay : 20 lignes `produits`, 0 fiche validée ; référentiel `medicaments_referentiel_sources` toujours vide. Les deux pharmacies E2E n'ont aucun stock positif ni lot disponible. La réservation réelle reste donc bloquée, même après préparation des profils.
- Aucun changement Production ni déploiement Vercel n'a été effectué.

**État :** correction Caisse physique — **appliquée et testée SQL sur Replay** ; reprise idempotente — **appliquée et testée SQL sur Replay** ; raccordement de l'action serveur — **source corrigée, test Node non exécuté** ; fixtures Stock/Caisse/Client acheteur — **workflow intégré, mais non provisionnées** ; recette réservation/Stock/Caisse/Livreur — **NON EXÉCUTÉE** ; NAXA reste **PARTIEL**, pas AU VERT.

**Point exact de reprise :**
1. Obtenir et consulter le run push GitHub Actions déclenché par les derniers commits `main`; confirmer les tests Node, le provisionnement Promoteur/Admin/Livreur/Stock/Caisse/Client acheteur et les nettoyages.
2. Vérifier alors sur Replay les trois profils racine Client, les affectations Stock/Caisse, la Caisse physique unique, les rôles actifs exclusifs, la visibilité RLS et l'absence de sessions ouvertes.
3. Importer seulement le référentiel BDPM dans `medicaments_referentiel_sources` si le flux source et les secrets Replay sont disponibles ; cette donnée française ne vaut pas autorisation Cameroun et ne doit pas être transformée en fiche `produits` validée sans contrôle pharmacien.
4. Initialiser une référence vendable uniquement à partir d'un produit réellement autorisé/validé ; approvisionner le stock par les parcours métier audités, lot et péremption réels. Ne pas injecter de faux produit, quantité, lot, caisse initiale ou paiement.
5. Seulement après ces prérequis : réservation par le Client acheteur, préparation physique confirmée par Stock, mission Livreur, arrivée, confirmation de réception, encaissement réellement rapproché par Caisse et clôture.


## 40. Correction de la lecture RLS de l’espace Gestionnaire Stock (15/11/2026)

**Périmètre : Replay uniquement.** Cette correction complète le §39 ; aucun profil Stock n'a encore été provisionné par le workflow, aucune ligne de stock n'a été créée.

### Audit et cause racine
- La fonction `private.naxa_has_privilege` utilise la matrice `naxa_architecture_privileges` pour les rôles canoniques Promoteur, Responsable, Caisse et Comptable. La matrice HYBRIDE ne contient aucune entrée `gestionnaire_stock` ou `magasinier`.
- Les opérations métier Gestionnaire Stock sont néanmoins conçues autour de l'affectation professionnelle active : plusieurs RPC de préparation, référence, ajustement et lot vérifient `naxa_has_active_professional_assignment`.
- Contradiction : la policy existante `stocks_read` n'autorisait SELECT que par `VIEW_STOCK` (ou Admin). Un profil Stock correctement affecté pouvait appeler les RPC gardées par son affectation, mais sa lecture de la table `stocks` était filtrée par une matrice d'architecture qui ne contient pas ce rôle.
- Il n'est pas correct d'ajouter des privilèges Promoteur/Caisse au rôle Stock, ni d'élargir la matrice d'architecture à un ensemble de droits plus puissant. La séparation d'intention est : droits d'opération via affectation Stock active et RPC contrôlées, lecture inventaire bornée à la pharmacie active.

### Correction appliquée
- Migration `allow_active_stock_assignments_to_read_pharmacy_stock`, version Replay `20261115071723`, source `supabase/migrations/20261115183000_allow_active_stock_assignments_to_read_pharmacy_stock.sql`, commit `ab4273baa13338785d355bfca03d92a0fc9a1d0d`.
- Policy additionnelle `stocks_read_active_stock_assignment` : SELECT seulement pour `authenticated`, via `naxa_has_active_professional_assignment(auth.uid(), pharmacie_id, 'gestionnaire_stock')` ou `magasinier`. Cette fonction contrôle le profil actif, le rôle métier, la pharmacie du rôle sélectionné, l'affectation active/non expirée et la pharmacie active.
- Aucune policy d'écriture n'a été ajoutée ou modifiée ; aucun privilège table `INSERT`, `UPDATE` ou `DELETE` n'a été conféré par cette migration. Les opérations d'écriture restent sur les RPC métier existantes. `anon` ne reçoit pas SELECT.
- Test SQL exécuté sur Replay : **PASS** — RLS reste activée, policy présente pour SELECT/authenticated et rôle strict Stock/Magasinier, aucun SELECT `anon`.
- Contrôle post-migration : policies existantes `stocks_management_insert`, `stocks_import_update`, `stocks_caisse_update`, `stocks_management_delete` restent inchangées ; la nouvelle policy est distincte et lecture seule.
- Le provisionneur E2E appelle désormais `naxa_has_active_professional_assignment` avec le JWT Stock pour prouver le contexte serveur actif avant son GET REST `stocks`. Commit `578c7e3af8ed42f47b405da98a915119fa64ff94`.
- Test Node statique `scripts/test-stock-assignment-read-rls.cjs` ajouté (2 tests) et raccordé à la commande `node --test` du workflow. Commit du test `5da9b8df016c37f4d3621e23444b51d8b8573305`, commit workflow `7ccaa132b6738404a76616fc977594d43550b870`. Son exécution CI n'est pas encore prouvée.

### État et réserve
- Contrôle de données Replay après application : catalogue toujours **20 produits / 0 fiche validée**, **0 ligne de stock positive** ; aucune réservation ni mission créée.
- Les trois identités E2E Stock/Caisse/Client acheteur restent absentes de `auth.users` au dernier contrôle. Aucune affectation Stock/Caisse ni Caisse physique n'est présente. Le workflow reste intégré dans `main`, mais aucun run push terminal consultable n'est disponible pour confirmer le provisionnement.
- Le test RLS SQL vérifie la définition de la policy ; il ne remplace pas le test réel avec un JWT de Gestionnaire Stock. Le prochain run doit confirmer `naxa_has_active_professional_assignment=true` puis la requête REST en tant que Stock.
- Aucun produit, stock, lot, caisse ouverte, montant initial, réservation ou paiement n'a été fabriqué ; Production et Vercel n'ont pas été modifiés.

**État :** policy lecture Stock — **corrigée et testée SQL sur Replay** ; privilèges d'écriture — **inchangés** ; provisionnement des profils — **non exécuté/proof manquante** ; chaîne commande et livraison — **bloquée par catalogue et stock vendable absents** ; recette globale — **PARTIELLE**, non AU VERT.

**Point exact de reprise :**
1. Consulter le prochain run GitHub Actions déclenché par les commits `578c7e3...` et `7ccaa13...`. Vérifier tous les tests Node et le provisionnement des trois profils séparés.
2. Sur Replay, confirmer que le Gestionnaire Stock reçoit bien le rôle actif, que la RPC d'affectation retourne `true`, et que son GET `stocks` retourne HTTP 200 ; confirmer aussi que le rôle Caisse voit une seule ressource physique via RLS.
3. Faire ouvrir puis fermer un service Stock de recette avec note E2E explicite, sans ouvrir de session Caisse ni fonds fictifs.
4. Résoudre séparément le catalogue vendable validé et le stock/lot conforme avant de créer la première réservation Client.


## 41. Protection du catalogue public et diagnostic réel du blocage stock (15/11/2026)

> **Statut historique — approche intermédiaire abandonnée.** Cette section a été écrite avant la clarification métier : NAXA ne valide pas les fiches, ne vérifie pas les AMM à la place des pharmacies et ne conditionne pas leur publication à une approbation. Les règles de ce §41 qui imposaient une validation centrale, une source DPML ou un rôle Admin pour publier sont **obsolètes et remplacées par les §§43–44**. La protection actuelle porte sur le cloisonnement par pharmacie et l'absence d'exposition des pharmacies démo, pas sur le contenu déclaré.

**Périmètre : Replay uniquement.** Ref `pwfftcsjyeibxxqhwysw`. Aucun changement Production/Vercel.

### Audit → contradiction → cause racine

- `public.produits` avait RLS activée, mais la policy `produits_read` était `FOR SELECT TO public USING (true)`. Le rôle PostgreSQL `anon` possédait aussi le privilège SELECT sur la table : un client REST direct pouvait donc lire des fiches non validées, même si l'API de recherche Next.js filtre déjà `fiche_validee=true`.
- La policy d'insertion `produits_write` permettait à un profil ayant un contexte pharmacie d'insérer une fiche sans exiger `fiche_validee=false`. Le garde UPDATE était déjà réservé à Admin, mais INSERT laissait une voie d'auto-publication.
- La cause n'était pas un manque de filtre de recherche uniquement : la règle RLS de la table autorisait explicitement toute lecture et l'INSERT n'imposait pas l'état brouillon.

### Correction appliquée sur Replay et versionnée sur main

- Migration source : `supabase/migrations/20261115190000_secure_public_read_of_unvalidated_products.sql`, commit [`4edcdfb1a1d8662542d13bc4fec4d816845a6e32`](https://github.com/audreymendomo23-netizen/NAXA/commit/4edcdfb1a1d8662542d13bc4fec4d816845a6e32).
- Version enregistrée sur Replay : `20261115073655`, nom `secure_public_read_of_unvalidated_products`.
- La policy large `produits_read` est supprimée et remplacée par deux policies :
  1. `anon` ne lit que les lignes où `fiche_validee IS TRUE`.
  2. `authenticated` ne lit que les fiches validées, ou les fiches internes via Admin et les fonctions pharmacie actives explicitement listées (`pharmacie`, `caisse`, `responsable`, `comptable`, `pharmacien`, `gestionnaire_stock`, `magasinier`) avec contexte pharmacie actif. Le rôle `livreur` est exclu de la lecture des brouillons.
- La policy INSERT `produits_write` ne vise plus que `authenticated`. Admin conserve l'insertion ; les fonctions internes pharmacie autorisées ne peuvent insérer qu'une fiche dont `fiche_validee IS NOT TRUE`. La validation publique ne peut donc pas être auto-déclarée à l'insertion par une pharmacie.
- La policy UPDATE existante (Admin uniquement) n'a pas été élargie. Aucune policy de stock, de lot ou de paiement, aucun grant table, aucune ligne produit/stock et aucun statut de validation n'ont été modifiés par cette migration.

### Test et preuve

- Test SQL versionné : `supabase/tests/20261115190000_secure_public_read_of_unvalidated_products.sql`, commit [`00b1e742e0465bfeb902e4544d31b8dc670ca543`](https://github.com/audreymendomo23-netizen/NAXA/commit/00b1e742e0465bfeb902e4544d31b8dc670ca543).
- Exécution SQL sur Replay : **PASS**. RLS reste activée ; les rôles/predicats des deux policies SELECT et de la policy INSERT sont contrôlés ; sous `SET ROLE anon`, aucune fiche non validée n'est visible ; sous `authenticated` avec l'identité Admin Replay, l'accès complet au catalogue est conservé. Le test est transactionnel et terminé par `ROLLBACK` ; il n'a créé aucune fiche.
- Test statique Node `scripts/test-products-public-rls.cjs` ajouté (4 assertions), commit [`235cefc5597f1f13fdb2a23df684bd45f1e36c0d`](https://github.com/audreymendomo23-netizen/NAXA/commit/235cefc5597f1f13fdb2a23df684bd45f1e36c0d).
- Workflow `.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml` mis à jour pour inclure cette migration, le test SQL et le test Node dans les chemins/commandes CI ; commit [`f68e6fbd9f6df62b8c0dbc9e97f3b35109adf3df`](https://github.com/audreymendomo23-netizen/NAXA/commit/f68e6fbd9f6df62b8c0dbc9e97f3b35109adf3df).
- Les contrôles GitHub consultables ne retournent pas de statut/check sur ce commit ; le connecteur de runs disponible ne retourne que les runs associés aux PR. L'exécution du nouveau test Node dans GitHub Actions reste donc **non démontrée**. Ne pas la revendiquer PASS.
- Supabase Security Advisors relève toujours des alertes globales préexistantes : 70 tables RLS sans policy (niveau INFO), 227 fonctions SECURITY DEFINER exécutables par `authenticated` (WARN) et 1 alerte de protection HIBP des mots de passe (WARN). Cette migration n'ajoute pas de fonction SECURITY DEFINER ; le contrôle ciblé RLS catalogue est PASS, mais l'audit sécurité global reste non vert.

### Inventaire Replay corrigé — périmètre global et périmètre E2E distingués

- Globalement : **20 produits**, tous `fiche_validee=false` et tous identifiés comme test par leur nom ou `source_fiche` ; **100 lignes de stock positives**, quantité agrégée **3 300**, réparties sur 5 pharmacies, toutes rattachées à ces produits non validés ; **0 lot** ; **0 ligne** dans `medicaments_referentiel_sources`.
- Sur les **2 pharmacies actives liées au Promoteur E2E** : **0 ligne de stock**, **0 quantité positive** et **0 lot**. Cela corrige l'ambiguïté du précédent contrôle global : les quantités présentes ailleurs dans Replay ne constituent pas une offre vendable pour les pharmacies de la recette.
- Les trois identités E2E Stock/Caisse/Client acheteur sont toujours absentes de `auth.users` et `profiles` ; aucune affectation n'est présente pour ces trois identités et aucune Caisse physique active n'est provisionnée sur les deux pharmacies du Promoteur E2E.
- Il n'existe donc aucun produit validé, stock/lot conforme ni fixture Client acheteur permettant de démarrer une réservation réelle. Le correctif RLS empêche désormais la fuite de fiches non validées, mais il ne rend pas les produits de test vendables.

### Source réglementaire et blocage restant

- Le référentiel actuellement vide `medicaments_referentiel_sources` est destiné à des références BDPM françaises. Ce flux n'a pas été importé et ne doit pas être utilisé comme preuve d'AMM camerounaise.
- Source locale pertinente : [Répertoire DPML des médicaments homologués](https://dpml.cm/repertoireDesAmm/), qui présente le registre des produits ayant obtenu une AMM au Cameroun ; [présentation DPML du répertoire AMM](https://dpml.cm/index.php/fr/catalogue/produits-pharmaceutiques-amm). La [Liste nationale des médicaments essentiels (édition 2022)](https://dpml.cm/fr/catalogue/liste-nationale-des-medicaments-essentiels) est une source complémentaire de sélection, mais ne remplace pas la preuve d'AMM d'une spécialité donnée.
- La consultation web du répertoire et de sa page de téléchargements a répondu HTTP 403 dans cette session ; aucun export officiel exploitable, fichier structuré ou API documentée n'a pu être vérifié. Aucun médicament n'a donc été importé ou marqué validé sur une supposition.
- **Cause métier du blocage restant :** absence d'une source officielle DPML exploitable avec numéro AMM, statut/validité, titulaire, dénomination, DCI, dosage, forme et présentation, puis absence de validation pharmaceutique et d'approvisionnement réel avec lot/péremption pour les pharmacies E2E.

**État :** exposition anon des fiches non validées — **CORRIGÉE / SQL PASS sur Replay** ; auto-validation à l'insertion pharmacie — **BLOQUÉE par policy / SQL PASS** ; CI Node — **à confirmer** ; catalogue camerounais validé — **BLOQUÉ** ; stock et lots réels sur les pharmacies E2E — **ABSENTS** ; réservation Client → Stock → Livreur → Caisse — **NON EXÉCUTABLE** ; recette globale — **PARTIELLE**, non AU VERT.

**Point exact de reprise :**
1. Obtenir un export DPML officiel des AMM camerounaises (ou une API officiellement autorisée/documentée) avec la preuve de statut et de validité ; ne pas substituer la BDPM française ni la LNME à cette preuve.
2. Importer ces références dans un référentiel séparé, les rapprocher des fiches NAXA puis exiger une validation pharmacien/Admin documentée avant `fiche_validee=true`.
3. Pour au moins un produit réellement homologué et disponible, faire enregistrer par la pharmacie une pièce d'approvisionnement réelle, le lot et la date de péremption via les parcours métier audités ; ne pas injecter quantité ou lot inventés.
4. Relancer/consulter le workflow Replay, prouver le provisionnement Client acheteur/Stock/Caisse et l'accès réel sous JWT ; ouvrir/fermer le service Stock sans fonds Caisse fictifs.
5. Seulement après ces prérequis, exécuter la réservation Client, préparation Stock, affectation Livreur, suivi, livraison et encaissement réel par la Caisse.



## 42. Isolation du helper Marketplace de disponibilité du stock (15/11/2026)

> **Note de succession :** l'isolation ACL du helper interne décrite ici reste applicable. En revanche, l'ancien contrôle `fiche_validee` cité dans l'analyse initiale du helper a été supprimé par le §43 : la visibilité d'une offre ne dépend plus d'une validation NAXA.

**Périmètre : Replay uniquement.** Ref `pwfftcsjyeibxxqhwysw`. Aucun changement Production/Vercel.

### Audit → contradiction → cause racine

- La fonction interne `private.marketplace_offre_stock_disponible_guarded(uuid,uuid)` vérifiait déjà le produit validé, la pharmacie active/publiée/non-démo/non archivée, la fraîcheur du stock (48 h), les lots non bloqués/non périmés lorsqu'ils existent et les réservations actives.
- Mais le schéma `private` accordait `USAGE` à `anon`, et le helper avait `EXECUTE` accordé directement à `anon` et `authenticated`.
- Le wrapper public `public.marketplace_offre_stock_disponible(uuid,uuid)` était `SECURITY INVOKER` et appelait directement ce helper. Il fallait donc conserver l'API Marketplace publique de lecture des offres tout en supprimant la voie d'appel directe du helper privé.
- Les recherches SQL ont également identifié les consommateurs internes connus : fonctions de recherche et opérations POS/débit sous `SECURITY DEFINER` ; elles s'exécutent comme propriétaire PostgreSQL et n'ont pas besoin d'un EXECUTE direct accordé aux rôles API.

### Correction appliquée sur Replay et versionnée sur main

- Migration : `supabase/migrations/20261115191000_guard_marketplace_offer_internal_rpc.sql`, commit [`6a4d958c2a64c6cad8be1fdfb74f1608242c5832`](https://github.com/audreymendomo23-netizen/NAXA/commit/6a4d958c2a64c6cad8be1fdfb74f1608242c5832).
- Version enregistrée sur Replay : `20261115074138`, migration `guard_marketplace_offer_internal_rpc`.
- Le wrapper `public.marketplace_offre_stock_disponible` est maintenant `SECURITY DEFINER`, `STABLE`, avec `search_path=''` et appel qualifié du helper interne. C'est le point d'entrée public filtré uniquement.
- EXECUTE du wrapper public est explicitement limité à `anon`, `authenticated`, `service_role` ; EXECUTE sur le helper `private.marketplace_offre_stock_disponible_guarded` est révoqué à `PUBLIC`, `anon` et `authenticated`. Le propriétaire PostgreSQL conserve ses droits pour les appels internes gardés.
- Le corps du helper n'a pas été modifié ; aucune règle commerciale de disponibilité, quantité, fraîcheur, réservation ou lot n'a été élargie. Aucune ligne produit/stock/lot/réservation/paiement n'a été modifiée.

### Test et preuve

- Test SQL : `supabase/tests/20261115191000_guard_marketplace_offer_internal_rpc.sql`, commit initial [`eb46483fc9f79a8ff6b74a52feff5696d83f21eb`](https://github.com/audreymendomo23-netizen/NAXA/commit/eb46483fc9f79a8ff6b74a52feff5696d83f21eb), puis correction de transaction sur le même fichier commit [`09dd984e6e416595b4a087888617350cee79e192`](https://github.com/audreymendomo23-netizen/NAXA/commit/09dd984e6e416595b4a087888617350cee79e192).
- Exécution SQL sur Replay : **PASS** — sous rôle `anon`, l'appel direct du helper privé lève `insufficient_privilege` ; le wrapper public reste appelable et renvoie zéro ligne pour une fiche non validée avec ligne de stock présente. Contrôles ACL post-migration : wrapper public `SECURITY DEFINER=true`, `anon/authenticated EXECUTE=true`, helper privé `anon/authenticated EXECUTE=false`.
- Test Node statique `scripts/test-marketplace-offer-rpc-security.cjs` ajouté (4 tests), commit [`5c0c1fd9cc69c9315097e4c31ebc367ebbeb03d9`](https://github.com/audreymendomo23-netizen/NAXA/commit/5c0c1fd9cc69c9315097e4c31ebc367ebbeb03d9).
- Workflow mis à jour pour suivre les deux migrations/tests SQL et exécuter les tests Node catalogue + RPC ; commit [`9a95314a55671a6923284a22ead156d285203ca7`](https://github.com/audreymendomo23-netizen/NAXA/commit/9a95314a55671a6923284a22ead156d285203ca7).
- L'exécution Node GitHub Actions n'est pas encore prouvée : les statuts consultables restent sans checks et le connecteur run ne remonte pas les exécutions déclenchées par push. Ne pas revendiquer PASS CI.

### Limites restantes

- Le test de disponibilité réel reste bloqué : Replay a 20 produits de test, 0 fiche validée, 100 lignes de stock positives agrégées sur ces produits non validés et 0 lot global. Dans les deux pharmacies E2E du Promoteur, il reste 0 ligne de stock et 0 lot.
- Les trois fixtures Stock/Caisse/Client acheteur sont absentes ; aucune Caisse physique n'est active pour les pharmacies E2E.
- Le répertoire officiel DPML des médicaments homologués est la source camerounaise de référence ; son portail expose une recherche et une page de téléchargements, mais l'ouverture du portail retourne HTTP 403 dans cette session et aucun export structuré officiel n'a pu être récupéré/vérifié. La DPML indique que son répertoire rend accessible une partie des informations officielles AMM. Sources : [répertoire homologué](https://dpml.cm/repertoireDesAmm/), [téléchargements](https://dpml.cm/repertoireDesAmm/telechargements.php), [présentation des AMM](https://dpml.cm/index.php/fr/catalogue/produits-pharmaceutiques-amm). La LNME est complémentaire et ne remplace pas la preuve AMM de la spécialité.
- Aucun produit n'a été créé ou validé, aucun stock/lot n'a été inventé et aucun paiement ou reçu n'a été simulé. Le blocage métier et documentaire demeure : obtenir un extrait DPML vérifiable, validation pharmaceutique puis approvisionnement réel traçable sur la pharmacie E2E.

**État :** fuite potentielle via helper RPC interne — **CORRIGÉE / SQL PASS Replay** ; exposition publique des fiches non validées — **CORRIGÉE / SQL PASS Replay (§41)** ; source DPML exploitable — **BLOQUÉE** ; validation NAXA du catalogue — **0** ; stock/lot vendable sur les pharmacies E2E — **0** ; profils E2E Stock/Caisse/Client acheteur — **non provisionnés** ; recette réservation → préparation → livraison → encaissement — **NON EXÉCUTABLE** ; état global — **PARTIEL**, non AU VERT.

**Point exact de reprise :**
1. Faire confirmer par la DPML le mécanisme d'accès/export du répertoire AMM et récupérer une extraction officielle datée avec numéro AMM, statut/validité, titulaire et spécialité.
2. Importer cette donnée dans un référentiel réglementaire camerounais distinct ; rapprocher les identités exactes et attendre l'approbation pharmacien/Admin avant publication.
3. Faire approvisionner une pharmacie E2E par un flux réel (réception, mouvement audité, numéro de lot, date de péremption) ; aucun INSERT SQL de stock manuel.
4. Relancer et contrôler le workflow Replay ; provisionner/valider réellement Client acheteur, Gestionnaire Stock et Caisse ; prouver l'accès sous JWT et ouvrir/fermer le service Stock, sans fonds Caisse fictifs.
5. Exécuter le parcours Client → préparation Stock → mission Livreur → livraison → encaissement uniquement après ces prérequis.



## 43. Publication autonome des produits et stocks par les pharmacies — correction métier prioritaire (15 novembre 2026)

### Décision métier

- NAXA ne valide aucune fiche produit. Il n'existe aucune file d'approbation Admin, aucun bouton « valider », aucune certification NAXA et aucune condition DPML/BDPM imposée par NAXA avant qu'une pharmacie puisse déclarer ou proposer un produit.
- La pharmacie est l'émetteur de la déclaration et demeure responsable des noms, présentations, prix, stocks, lots, dates de péremption, disponibilité et informations publiées. NAXA assure la connexion, le rattachement à l'établissement, la diffusion et les calculs techniques de disponibilité.
- Le Promoteur peut effectuer la déclaration pour toute pharmacie active qui lui est explicitement rattachée. Le personnel habilité peut le faire pour sa pharmacie active ; les affectations et les contrôles de périmètre existants demeurent applicables.
- Le catalogue client peut présenter une référence même lorsque sa quantité vendable est nulle, à condition qu'une ligne de stock la rattache à une pharmacie réelle, active, visible et non démo. Le statut d'offre reste alors indisponible. Une offre d'achat n'apparaît que si la quantité réellement vendable est positive.
- L'Admin conserve uniquement une consultation technique en lecture seule du catalogue ; l'écran de validation et les Server Actions d'approbation de fiches ont été retirés. Aucune intervention Admin n'est requise pour publier une déclaration ou un stock pharmacie.

### Correction du code sur main

- Migration `20261115200000_pharmacy_owned_marketplace_product_publication.sql` (commit [`b37717c05a165e6d5f67bd19d28eb9bef5943f3d`](https://github.com/audreymendomo23-netizen/NAXA/commit/b37717c05a165e6d5f67bd19d28eb9bef5943f3d)) : retire les tests `fiche_validee=true` du moteur d'offre et des recherches simples/groupées ; introduit les policies de visibilité publique rattachées à une pharmacie réelle ; rattache les fiches créées à leur créateur et à sa pharmacie ; ne laisse pas la pharmacie modifier une déclaration appartenant à un autre établissement.
- Migration `20261115201000_pharmacy_product_declare_and_stock_reference.sql` (commit [`9a2c81c204660080602c9c2b6f83982fc71a66d0`](https://github.com/audreymendomo23-netizen/NAXA/commit/9a2c81c204660080602c9c2b6f83982fc71a66d0)) : crée la RPC atomique de déclaration/référence stock, initialisée à zéro, sans quantité fictive.
- Migration de périmètre Promoteur `20261115202000_promoter_scope_and_zero_stock_catalogue_visibility.sql`, source corrigée et resynchronisée au commit [`7c4c75c241011136f753e50cb45634ca63b784d5`](https://github.com/audreymendomo23-netizen/NAXA/commit/7c4c75c241011136f753e50cb45634ca63b784d5). Elle fixe la pharmacie cible dans le contexte transactionnel de la RPC, la vérifie par `private.naxa_scope_allows`, autorise le Promoteur uniquement dans son réseau validé et rend le produit découvrable dès qu'une ligne de stock existe sur une pharmacie publique non démo, même à quantité zéro.
- Le formulaire « Déclarer un produit absent du catalogue » est ajouté dans Stock & logistique. Il permet de saisir nom, DCI, dosage/présentation, forme, prix FCFA, code-barres facultatif, statut ordonnance et emplacement facultatif. Il utilise `pharmacie_produit_declarer_et_reference_initialiser` ; cette RPC crée/réutilise la référence, puis initialise la ligne stock à quantité zéro. Le rôle racine `pharmacie` est aussi autorisé dans l'espace Stock.
- La recherche API, le catalogue hors ligne, le résultat de recherche, la fiche produit et la page d'offre ne filtrent plus sur `fiche_validee`. Les libellés précisent que les informations sont déclarées par la pharmacie et que NAXA ne les certifie pas.
- `/admin/produits` est remplacé par une consultation en lecture seule ; `src/app/admin/produits/actions.ts` et ses actions d'approbation ont été supprimées. L'écran reste consultable pour le diagnostic technique sans action sur les fiches.
- Sources UI/API : commits [`3484adeed8d66e3ec9f991cc78d85835dfa87643`](https://github.com/audreymendomo23-netizen/NAXA/commit/3484adeed8d66e3ec9f991cc78d85835dfa87643), [`2e75f3b88714fa406afb2b693c5014e385c8cd3a`](https://github.com/audreymendomo23-netizen/NAXA/commit/2e75f3b88714fa406afb2b693c5014e385c8cd3a), [`3484adeed8d66e3ec9f991cc78d85835dfa87643`](https://github.com/audreymendomo23-netizen/NAXA/commit/3484adeed8d66e3ec9f991cc78d85835dfa87643), [`c31822a58c3f01c645780d0a246d410e68398aef`](https://github.com/audreymendomo23-netizen/NAXA/commit/c31822a58c3f01c645780d0a246d410e68398aef), [`398ba46f926d1a3c0d79a1ed8cbdb3bc35383f11`](https://github.com/audreymendomo23-netizen/NAXA/commit/398ba46f926d1a3c0d79a1ed8cbdb3bc35383f11), [`7ca13a377df73b2affa8f80e27eaef5556df60e5`](https://github.com/audreymendomo23-netizen/NAXA/commit/7ca13a377df73b2affa8f80e27eaef5556df60e5), [`870768913cc864230b473b7b8bd246bea5094f14`](https://github.com/audreymendomo23-netizen/NAXA/commit/870768913cc864230b473b7b8bd246bea5094f14), [`01a03cc4e987928332ce593d98b667a35f75b6d2`](https://github.com/audreymendomo23-netizen/NAXA/commit/01a03cc4e987928332ce593d98b667a35f75b6d2), [`561fdebf9e2a67f4fda4aeff0b8c418d0e2b30ba`](https://github.com/audreymendomo23-netizen/NAXA/commit/561fdebf9e2a67f4fda4aeff0b8c418d0e2b30ba), [`e056e3d0d634496c538bb7f94116471dc0a5f3b0`](https://github.com/audreymendomo23-netizen/NAXA/commit/e056e3d0d634496c538bb7f94116471dc0a5f3b0).
- Les tests statiques catalogue/Admin/flux pharmacie ont été ajustés et inclus dans `.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml` ; le workflow suit aussi la migration de périmètre Promoteur. Dernière mise à jour du workflow au commit [`2272680bb64630575ec475b85dc501e68c3a5913`](https://github.com/audreymendomo23-netizen/NAXA/commit/2272680bb64630575ec475b85dc501e68c3a5913).

### Preuves Replay (15 novembre 2026)

- Migrations appliquées et listées par Replay :
  - `20261115082742` — `pharmacy_owned_marketplace_product_publication`
  - `20261115083317` — `pharmacy_product_declare_and_stock_reference`
  - `20261115083951` — `promoter_scope_and_zero_stock_catalogue_visibility`
- Trois tests SQL contractuels exécutés sur Replay : **PASS**
  1. Policies produits/RLS, visibilité anon rattachée aux pharmacies réelles non démo : PASS.
  2. Contrat RPC, authentification, périmètre, identité créatrice et référence stock initialisée à zéro : PASS. À cette date, ce test vérifiait la définition SQL, pas encore une création sous JWT en situation réelle ; les essais runtime ont été réalisés ensuite au §44.
  3. Promoteur limité à ses pharmacies actives, visibilité catalogue même à stock nul, absence de verrou `fiche_validee` dans offres/recherches : PASS.
- ACL constatées : helper `private.naxa_scope_allows` — authenticated EXECUTE = true, anon = false ; RPC `pharmacie_produit_declarer_et_reference_initialiser` — authenticated EXECUTE = true, anon = false.
- Contrôle des données Replay : 20 produits historiques, 0 avec `fiche_validee=true`, 100 lignes stock positives mais toutes sur une pharmacie démo, 0 lot. Aucune référence de stock n'est rattachée à une pharmacie non démo active/visible. Les pharmacies E2E Promoteur sont à 0 stock. En conséquence, la policy anon retourne toujours 0 produit visible sur ce jeu Replay : aucune fiche de test n'est exposée.
- Aucun produit, stock positif, lot, paiement, réservation ou mission n'a été créé pour simuler un approvisionnement. Les profils de recette Stock/Caisse/Client acheteur ont depuis été provisionnés et vérifiés par le run Replay E2E réussi ci-dessus.
- **Replay E2E réussi** sur le commit [891ac02a824b8ca2aeefe09326f2ee2b035ddfd4](https://github.com/audreymendomo23-netizen/NAXA/commit/891ac02a824b8ca2aeefe09326f2ee2b035ddfd4), run [43695995971](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43695995971) : préflight Replay, Promoteur, Admin, Client/Livreur par invitation, provisionnement Client acheteur + Gestionnaire Stock + Caisse, Storage E2E Admin/Promoteur 17 PASS / 0 SKIP, nettoyage des sessions et secrets temporaires — toutes les étapes PASS.
- Contrôle post-run Replay : 3 identités Auth distinctes Stock/Caisse/Client acheteur ; 3 profils racine Client actifs ; 2 affectations professionnelles Stock/Caisse actives ; 1 Caisse physique active sur le réseau Promoteur ; 0 session Stock ouverte ; 0 session Caisse ouverte ; 0 référence stock, 0 lot et 0 réservation sur le réseau Promoteur. Le run n'a créé ni quantité, ni vente, ni mission, ni paiement.
- La matrice Admin 360 ADM-14 a été réalignée sur le rôle métier autorisé : consultation du catalogue en lecture seule, sans édition/validation de fiche. Les 50 cas ADM-14 et la capacité associée pointent vers la page Admin read-only et le test scripts/test-admin-produits-actions.cjs ; aucune référence à l'ancien fichier d'actions supprimé ne subsiste. Commit [1acd49f4cff33057d253243212396b8f59779963](https://github.com/audreymendomo23-netizen/NAXA/commit/1acd49f4cff33057d253243212396b8f59779963).
- **Qualité générale CI réussie** sur le commit [1acd49f4cff33057d253243212396b8f59779963](https://github.com/audreymendomo23-netizen/NAXA/commit/1acd49f4cff33057d253243212396b8f59779963), run [43696172324](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43696172324) : actionlint/syntaxe workflows PASS ; suite Node **441 tests / 441 PASS / 0 FAIL** ; TypeScript `tsc --noEmit` PASS ; ESLint PASS ; build Next.js PASS ; build Serwist PASS. Le seul échec précédent provenait des 51 références obsolètes ADM-14 à l'action Admin supprimée ; la matrice a été corrigée puis les tests ont été relancés avec succès.

### Point exact de reprise

1. Lire le résultat final du workflow de qualité générale run 43696172324 ; corriger tout échec Node/TypeScript/lint/build avant de considérer le code stabilisé.
2. Utiliser la fixture Stock/Caisse/Client acheteur déjà provisionnée et testée par le run Replay E2E réussi ; ne pas recréer de comptes en dehors du workflow strictement Replay. Aucun poste Caisse ne doit être ouvert et aucun fonds fictif ajouté.
3. **Réalisé au §44 :** exercer la RPC sous JWT Promoteur et Gestionnaire Stock, vérifier la création, l'identité propriétaire et la ligne stock à zéro ; confirmer le refus hors périmètre.
4. Exécuter une vérification anon de visibilité pour une référence créée sur une pharmacie publique réelle (aucun stock positif requis pour la découvrir) et vérifier qu'une pharmacie démo ou masquée n'est jamais exposée.
5. Obtenir une réception fournisseur réelle sur une pharmacie E2E, avec mouvement audité, lot et péremption ; puis exécuter le parcours réservation → préparation → Livreur → livraison → encaissement.

**État au §43 :** publication sans validation NAXA — **CORRIGÉE / SQL PASS Replay** ; déclaration pharmacie/Promoteur — **RPC + UI implémentées / tests structurels SQL PASS, exercice sous JWT dédié restant** ; visibilité catalogue à stock zéro — **fonction/policy implémentées / SQL PASS** ; Replay E2E profils Stock/Caisse/Client acheteur et Storage Admin/Promoteur — **PASS (run 43695995971)** ; stock/lots vendables sur les pharmacies E2E — **0** ; réservation réelle — **BLOQUÉE PAR ABSENCE D'APPROVISIONNEMENT RÉEL** ; CI générale — **PASS : 441/441 tests, TypeScript, ESLint, build Next.js/Serwist, actionlint** ; état global — **PARTIEL**, non AU VERT. Production et Vercel inchangés.


## 44. Déblocage réel de la déclaration pharmacie et du périmètre Promoteur (15/11/2026)

**Périmètre : Replay uniquement.** Ref `pwfftcsjyeibxxqhwysw`. Aucune donnée ni migration Production ; aucun déploiement Vercel.

### Décision métier appliquée

- La pharmacie et son Promoteur peuvent déclarer, modifier et publier leurs propres informations produit et stock, sans validation, approbation, contrôle de fiche ou intervention de l'Administrateur NAXA.
- NAXA relie la déclaration à l'établissement qui l'émet, applique les droits de compte et de périmètre, puis diffuse les informations selon les règles Marketplace. La pharmacie demeure responsable de ses noms, DCI, présentations, prix, quantités, lots, dates et informations publiées.
- Le champ historique `fiche_validee` est conservé pour compatibilité, mais n'est plus utilisé par les recherches, la visibilité catalogue ou les offres Marketplace. Les nouvelles déclarations le laissent à `false` ; ce n'est pas un état d'attente ni un verrou de publication.
- Le catalogue peut présenter une référence déclarée lorsqu'une ligne de stock la rattache à une pharmacie active, visible, non démo et non archivée, même à quantité zéro. Une offre achetable reste conditionnée par une quantité vendable positive et les règles techniques de fraîcheur, de réservation et de lot. Ces règles n'impliquent aucune validation par NAXA.
- L'Admin garde une consultation technique en lecture seule ; il n'approuve ni ne publie les fiches.

### Correction 1 — contrainte de source bloquant chaque nouvelle fiche

**Cause racine reproduite :**
- Le déclencheur `public.produits_garde_fiche()` attribuait correctement `source_fiche='declaration_pharmacie'`.
- L'ancienne contrainte `produits_source_fiche_check` n'acceptait que `aucune`, `bdpm`, `ia`, `admin`, `pharmacien`.
- Une véritable invocation de `pharmacie_produit_declarer_et_reference_initialiser` sous JWT Promoteur a échoué avec SQLSTATE `23514` : `violates check constraint "produits_source_fiche_check"`. La transaction de diagnostic a été annulée ; aucun produit/stock n'a persisté.

**Correction appliquée :**
- Source : `supabase/migrations/20261115203000_allow_pharmacy_declared_products_source.sql`, commit [`d08e78129940840c55dc35a2766074a0a97dd9ec`](https://github.com/audreymendomo23-netizen/NAXA/commit/d08e78129940840c55dc35a2766074a0a97dd9ec).
- Version Replay : `20261115090053`, `allow_pharmacy_declared_products_source`.
- La contrainte conserve les valeurs historiques et ajoute `declaration_pharmacie`, en `NOT VALID` pour ne pas bloquer sur des données historiques non auditées tout en imposant la règle aux nouvelles écritures.
- Test SQL contractuel : `supabase/tests/20261115203000_allow_pharmacy_declared_products_source.sql`, commit [`deb7cb04b340a114c43a8195f8c204fe5432734c`](https://github.com/audreymendomo23-netizen/NAXA/commit/deb7cb04b340a114c43a8195f8c204fe5432734c) — **PASS Replay**.
- Test Node : `scripts/test-pharmacy-product-source-check.cjs`, commit [`0a024b77c00b67e66ea2225ac8da995e0cf9cb90`](https://github.com/audreymendomo23-netizen/NAXA/commit/0a024b77c00b67e66ea2225ac8da995e0cf9cb90).

### Correction 2 — lecture RLS du catalogue par le Promoteur

**Cause racine reproduite :**
- La policy `produits_authenticated_live_offer_read` appelait directement `private.naxa_promoteur_valide(uuid)`.
- Le helper privé est volontairement non exécutable par `authenticated` (`auth_exec=false)). Le contrôle de lecture sous le JWT Promoteur levait SQLSTATE `42501`, `permission denied for function naxa_promoteur_valide`.
- Le helper privé n'a pas été exposé pour contourner le problème : cela aurait élargi son API interne.

**Correction appliquée :**
- Migration : `supabase/migrations/20261115204000_promoter_product_read_policy_uses_public_guard.sql`, commit [`ad531ae5e8c7008071f922854cde9db2105ed201`](https://github.com/audreymendomo23-netizen/NAXA/commit/ad531ae5e8c7008071f922854cde9db2105ed201).
- Version Replay : `20261115090209`, `promoter_product_read_policy_uses_public_guard`.
- La policy utilise désormais `public.naxa_promoteur_valide(auth.uid())`, wrapper public existant, auto-scopé à l'identité connectée. `authenticated` garde EXECUTE sur le wrapper ; le helper privé reste inaccessible directement.
- Test SQL : `supabase/tests/20261115204000_promoter_product_read_policy_uses_public_guard.sql`, commit [`57b8c4d1737583b19de5f72df3868e756c5cc65b`](https://github.com/audreymendomo23-netizen/NAXA/commit/57b8c4d1737583b19de5f72df3868e756c5cc65b) — **PASS Replay**.
- Test Node : `scripts/test-promoter-product-read-policy.cjs`, commit [`c7cbb21655d4fa7ec7bd0dab991f081c2ef9d8bb`](https://github.com/audreymendomo23-netizen/NAXA/commit/c7cbb21655d4fa7ec7bd0dab991f081c2ef9d8bb).

### Test runtime sous JWT — preuve de bout en bout de déclaration

1. **Promoteur authentifié : PASS.** La RPC crée une fiche, attribue `created_by` au Promoteur et `created_by_pharmacie_id` à sa pharmacie cible ; la source est `declaration_pharmacie`, le flag historique reste `false`, et une ligne `stocks` est créée avec le prix fourni et quantité **0**.
2. **Gestionnaire Stock authentifié : PASS.** Le profil racine Client avec affectation Stock active déclare une fiche dans sa pharmacie sélectionnée ; la lecture RLS de la fiche et de la ligne Stock réussit ; la quantité reste **0**.
3. **Hors périmètre : PASS (refus).** Le même Gestionnaire Stock est refusé lorsqu'il tente la déclaration dans une autre pharmacie sans affectation active.
4. Les trois transactions de recette ont été annulées par `ROLLBACK`. Contrôle post-test : **0** produit temporaire et **0** ligne Stock temporaire ; aucun stock réel n'a été créé.

### État et suite

- Le workflow `.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml` inclut les deux nouvelles migrations/tests SQL et les tests Node source + RLS Promoteur ; intégration commit [`008a4984941b422e48f96887ef23f8334c8c4894`](https://github.com/audreymendomo23-netizen/NAXA/commit/008a4984941b422e48f96887ef23f8334c8c4894). Le run CI post-commit n'est pas encore visible dans les vérifications disponibles ; ne pas revendiquer les tests Node CI PASS.
- Inventaire de sécurité métier post-test : 0 fiche legacy `fiche_validee=true` ; 100 lignes de stock positives globales restent exclusivement en pharmacies démo ; 0 lot ; 0 référence BDPM ; 0 stock sur les deux pharmacies E2E non-démo ; aucun test temporaire conservé.
- Les contrôles de périmètre ne sont pas une validation de contenu : ils empêchent seulement un compte d'écrire pour une pharmacie qui ne lui appartient pas. Le contenu, le prix et le stock publiés sont déclarés par la pharmacie, qui en assume la responsabilité. NAXA n'intervient pas dans leur approbation.

**État :** liberté de déclaration pharmacie/Promoteur sans validation NAXA — **RUNTIME PASS Replay** ; écriture du rôle Stock dans sa pharmacie — **PASS** ; écriture hors périmètre — **REFUS PASS** ; lecture RLS Promoteur — **CORRIGÉE** ; tests Node CI — **à confirmer** ; stock réel/lot pour une réservation — **absents** ; recette réservation → Stock → Livreur → Caisse — **non exécutée** ; NAXA global — **PARTIEL**, pas AU VERT.

**Point exact de reprise :**
1. Confirmer le run GitHub Actions déclenché par le commit workflow `008a498...` et relever les résultats Node.
2. Tester la déclaration depuis le véritable espace UI sur navigateur avec les comptes E2E Promoteur et Gestionnaire Stock ; la preuve SQL runtime ne remplace pas la navigation UI.
3. Publier une référence et un prix par la pharmacie de recette ; effectuer ensuite une réception fournisseur réelle et enregistrer les lots/péremptions dans le flux métier, sans stock fictif.
4. Vérifier l'affichage public à quantité zéro et l'absence de fiche d'une pharmacie démo ; vérifier une offre achetable seulement après quantité vendable réelle.
5. Reprendre la recette Client → préparation Stock → mission Livreur → livraison → encaissement.



## 45. Édition autonome des fiches appartenant à la pharmacie (15/11/2026)

**Décision métier :** une pharmacie doit pouvoir corriger les fiches qu'elle a déclarées, sans passer par l'Administrateur. NAXA ne relit pas, ne valide pas et n'approuve ces modifications. Les règles de sécurité limitent uniquement l'auteur et le périmètre pharmacie.

### Correction UI / serveur sur main

- Action serveur ajoutée dans `src/app/pharmacie/gestionnaire-stock/actions.ts` : `modifierFicheProduitPharmacie`, commit [`e19ca6bcc084e5b617c4fc3648db4217118d2187`](https://github.com/audreymendomo23-netizen/NAXA/commit/e19ca6bcc084e5b617c4fc3648db4217118d2187).
- Elle exige une session et une fonction professionnelle autorisée (Promoteur, Pharmacie, Pharmacien, Assistant, Responsable, Gestionnaire Stock ou Magasinier). Elle met à jour uniquement l'identifiant produit fourni avec le filtre supplémentaire `created_by_pharmacie_id = pharmacie_id`. Le filtrage RLS `produits_update` et le trigger de protection conservent l'auteur, la pharmacie propriétaire, la source déclarative et les droits photo ; la valeur legacy `fiche_validee` n'est pas modifiée.
- L'espace `src/components/pharmacie/GestionnaireStockEspace.tsx` affiche désormais « Modifier mes fiches produits », limité aux fiches dont `created_by_pharmacie_id` est dans le réseau actif du Promoteur ou dans la pharmacie active du personnel ; Admin ne voit pas ce formulaire. Champs éditables : nom, DCI, dosage, forme, conditionnement, code-barres, fabricant, description, indications, précautions et statut ordonnance. Commit UI [`b9c74af0a3121090757a6397827db187d9be5029`](https://github.com/audreymendomo23-netizen/NAXA/commit/b9c74af0a3121090757a6397827db187d9be5029).
- Test de contrat étendu dans `scripts/test-pharmacy-led-product-publication.cjs` (propriétaire seulement, filtre serveur `created_by_pharmacie_id`, liste UI par périmètre, absence de mutation `fiche_validee)), commit [`cfa660b0dfd6ff630978a22bb0cb563809354b2c`](https://github.com/audreymendomo23-netizen/NAXA/commit/cfa660b0dfd6ff630978a22bb0cb563809354b2c). Le fichier de test est déjà inclus dans le workflow Replay ; son dernier run CI n'est pas confirmé.

### Tests runtime Replay sous JWT

1. **Édition de sa propre fiche : PASS.** Un Gestionnaire Stock avec affectation active a créé une référence, puis modifié nom, description et fabricant sous le même JWT ; l'écriture a affecté exactement une ligne et la relecture confirme les valeurs. L'auteur, la pharmacie propriétaire et le flag historique sont restés inchangés.
2. **Tentative hors périmètre : PASS (refus).** Une ligne temporaire déclarée pour une autre pharmacie a été préparée dans la même transaction par le rôle de service ; le Gestionnaire Stock n'a modifié aucune ligne (`row_count=0`) en ciblant cette fiche.
3. Les deux transactions ont été annulées par `ROLLBACK`. Aucun produit ou stock temporaire n'a été conservé.

### Limite de modèle à ne pas masquer

- Le schéma conserve une identité de produit catalogue partagée, avec une contrainte unique globale `(nom,dosage,forme)` et une contrainte globale sur le code-barres. La RPC de déclaration réutilise une correspondance exacte déjà existante avant de créer une nouvelle ligne.
- Ainsi, plusieurs pharmacies peuvent gérer leurs prix, stocks et lots séparément sur une même référence catalogue ; toutefois, lorsque cette référence exacte a été créée par une autre pharmacie, la seconde pharmacie réutilise la référence et ne peut pas modifier la fiche descriptive appartenant à la première.
- Si l'exigence attend une copie descriptive indépendante par pharmacie même pour un médicament identique, il faudra séparer proprement la référence commune et la fiche déclarative par pharmacie, puis adapter le regroupement des offres/recherches et des pages produit. Cette évolution n'est pas revendiquée comme réalisée ici. En attendant, l'édition est libre sur les fiches dont la pharmacie est propriétaire et le stock/prix restent propres à chaque pharmacie.

**État :** édition propriétaire dans UI — **implémentée sur main** ; édition propre sous JWT Stock — **RUNTIME PASS Replay** ; modification d'une fiche hors périmètre — **REFUS PASS** ; approbation Admin — **aucune** ; CI Node — **run à confirmer** ; autonomie descriptive complète pour doublons de référence entre pharmacies — **limite d'architecture restante** ; publication et gestion de stock propres à la pharmacie — **implémentées** ; approvisionnement et lots réels — **absents**, chaîne de réservation encore non exécutée.

**Point exact de reprise :**
1. Confirmer le prochain workflow Replay et relever les tests Node du catalogue.
2. Tester l'édition depuis le navigateur réel avec un compte Promoteur et un Gestionnaire Stock, puis vérifier qu'Admin n'offre aucune action sur les fiches.
3. Décider si une référence identique doit être dupliquée en fiche descriptive par pharmacie ou rester une identité commune, avant de modifier la contrainte catalogue et les agrégations de recherche.
4. Exécuter une réception fournisseur réelle avec lot/péremption, puis la chaîne commande → préparation → Livreur → réception Client → encaissement Caisse.



## 45. Rappels automatiques de péremption et exclusion stricte des lots expirés (15/11/2026)

**Périmètre : Replay uniquement.** Ref `pwfftcsjyeibxxqhwysw`. Production et Vercel non touchés.

### Règle opérationnelle

- Un lot dont la date de péremption est antérieure à la date civile du Cameroun ne contribue plus au stock vendable Marketplace.
- Un lot encore valide peut continuer à alimenter l'offre du même produit. Le Marketplace ne compte que les quantités des lots non bloqués et dont la péremption est au moins égale à la date locale `Africa/Douala`.
- Si seuls des lots périmés, bloqués ou à quantité nulle restent, la quantité vendable est zéro : aucune offre achetable n'est affichée.
- La recherche publique des pharmacies ne renvoie plus l'établissement comme offre disponible si aucun lot vendable ne reste. La référence catalogue du produit peut rester visible à quantité nulle selon la règle de découverte §43 ; cela n'expose pas le lot périmé ni une offre achetable.
- La date d'expiration est traitée comme valable jusqu'à la fin de cette date locale ; le lot est exclu à partir de 00:00 le lendemain, heure du Cameroun. Le rappel J0 informe le personnel du lot qui atteint sa date ce jour-là.
- NAXA n'inspecte ni ne valide le produit ou la date déclarée. Les alertes rappellent les informations de stock saisies par la pharmacie et lui laissent la gestion du lot.

### Rappels automatiques créés

Un job planifié toutes les **10 minutes** détecte les lots à quantité positive avec échéance. Il utilise la date civile `Africa/Douala` à chaque passage et traite jusqu'à 1 000 lots par appel :
- J-30 ;
- J-15 ;
- J-7 ;
- J-3 ;
- J0.

Destinataires uniquement :
- Promoteur actif rattaché à la pharmacie par `promoteur_pharmacies` ;
- Responsable ayant une affectation professionnelle active et non expirée sur cette pharmacie ;
- Gestionnaire Stock ayant une affectation professionnelle active et non expirée sur cette pharmacie.

Aucun rappel n'est adressé aux Clients, Caissiers ou Livreurs. Chaque notification donne la pharmacie, le produit, le numéro de lot, la quantité restante, la date de péremption et le seuil d'alerte. Les enregistrements utilisent le type `lot_expiry_reminder` dans `public.notifications`, repris par les mécanismes de notification existants. Aucun SMS ou WhatsApp n'est ajouté.

La déduplication est assurée par une clé unique `(lot_id,date_peremption,jours_avant,destinataire_id)`. Le sélecteur de lots ignore ceux dont tous les destinataires actifs ont déjà reçu le seuil demandé ; le passage suivant progresse vers les lots suivants au lieu de retenter toujours le même premier lot. Si un nouveau Responsable ou Gestionnaire Stock est affecté plus tard, le lot redevient sélectionnable pour le seul nouveau destinataire non servi. Un même lot, pour le même destinataire et le même seuil, ne produit donc pas deux notifications.

### Cause racine et correction de date

L'ancienne règle reposait sur `current_date`, alors que la base Replay est réglée en UTC et que la péremption est une date métier camerounaise. Entre 23:00 UTC et minuit UTC, le jour civil au Cameroun était déjà le lendemain : un lot périmé pouvait donc rester compté jusqu'au changement de date UTC.

La migration ajoute `private.naxa_date_cameroun()`, calculée avec `(now() at time zone 'Africa/Douala')::date`, puis aligne les gardes de péremption des offres Marketplace, du POS, des réservations/crédits, des transferts et des réceptions fournisseur sur cette même date. L'écran « Lots & péremptions » utilise maintenant aussi le calendrier `Africa/Douala` et non le découpage UTC de `toISOString()`.

### Sources et versionnement

- Migration : `supabase/migrations/20261115100000_pharmacy_lot_expiry_reminders_and_cameroon_date_guard.sql`, intégrée sur `main` (source initiale commit [2ce5812bfd8cd9ab2e5a311312600b865d8691ef](https://github.com/audreymendomo23-netizen/NAXA/commit/2ce5812bfd8cd9ab2e5a311312600b865d8691ef), correction du nombre de gardes ciblées commit [a6059be94f9313bdec397b1233e603b796e7503a](https://github.com/audreymendomo23-netizen/NAXA/commit/a6059be94f9313bdec397b1233e603b796e7503a)).
- Version Replay appliquée : `20261115090807`, `pharmacy_lot_expiry_reminders_and_cameroon_date_guard`.
- Test transactionnel : `supabase/tests/20261115100000_pharmacy_lot_expiry_reminders_and_cameroon_date_guard.sql`, commit [83c2736d8514c17c42815ec7fc253d7e5d84a23c](https://github.com/audreymendomo23-netizen/NAXA/commit/83c2736d8514c17c42815ec7fc253d7e5d84a23c).
- Test Node contractuel : `scripts/test-pharmacy-lot-expiry-notifications.cjs`, source initiale commit [83fb2fa99d3e5011d92e7fad0cb69d7c8154d4e7](https://github.com/audreymendomo23-netizen/NAXA/commit/83fb2fa99d3e5011d92e7fad0cb69d7c8154d4e7), assertion UI ajoutée commit [2e86dbb627233e9e472068e873201650ebf28a68](https://github.com/audreymendomo23-netizen/NAXA/commit/2e86dbb627233e9e472068e873201650ebf28a68), expressions d'assertion corrigées commit [d639f140d8dcf8833494c0edd27e3a47a03be052](https://github.com/audreymendomo23-netizen/NAXA/commit/d639f140d8dcf8833494c0edd27e3a47a03be052).
- Écran Stock en date Cameroun : commit [00e07de65dad7dd625ec16e347e4b4f51c025e8a](https://github.com/audreymendomo23-netizen/NAXA/commit/00e07de65dad7dd625ec16e347e4b4f51c025e8a).
- Migration batch : `supabase/migrations/20261115103000_batch_pharmacy_lot_expiry_dispatch.sql`, commit [9d51b3798480ec63572641ae7b7e003439d882e3](https://github.com/audreymendomo23-netizen/NAXA/commit/9d51b3798480ec63572641ae7b7e003439d882e3), appliquée sur Replay après la migration initiale.
- Test SQL adapté au traitement batch (limite d'un lot par appel, six passages), puis étendu à la recherche publique pharmacie et à la visibilité séparée de la référence catalogue : commit [6cfda89052dc93dbe1cb9c3c45f8ee4226583fec](https://github.com/audreymendomo23-netizen/NAXA/commit/6cfda89052dc93dbe1cb9c3c45f8ee4226583fec).
- Test Node couvrant le traitement batch, la recherche Marketplace, la date locale et les liens d'action : commit [c3deca77b9231d398ca24c49ae7cce844e1ab140](https://github.com/audreymendomo23-netizen/NAXA/commit/c3deca77b9231d398ca24c49ae7cce844e1ab140). Correction de deux expressions régulières sur la recherche catalogue : commit [a9a657e3d4e30c4a99caeece55e477ae0549662d](https://github.com/audreymendomo23-netizen/NAXA/commit/a9a657e3d4e30c4a99caeece55e477ae0549662d) ; leurs motifs sont vérifiés sur les sources actuelles.
- Lien d'action depuis la notification vers `/pharmacie/gestionnaire-stock/lots-peremptions` : commit [0b01340e01328a134725aa19c01cbcae9d18d2de](https://github.com/audreymendomo23-netizen/NAXA/commit/0b01340e01328a134725aa19c01cbcae9d18d2de). Le contrat de ce lien est couvert dans le test Node mis à jour [c0180c5d424882dbd03acc6b37ab4bfc2a570a69](https://github.com/audreymendomo23-netizen/NAXA/commit/c0180c5d424882dbd03acc6b37ab4bfc2a570a69).
- Workflow Replay ajoutant les trois fichiers, la migration batch et le test Node : commit initial [42442e7905ff157900720230225644db122910cb](https://github.com/audreymendomo23-netizen/NAXA/commit/42442e7905ff157900720230225644db122910cb), extension batch [f06d2ffc4fa99b00e9e24ff12125c9e2577a17ca](https://github.com/audreymendomo23-netizen/NAXA/commit/f06d2ffc4fa99b00e9e24ff12125c9e2577a17ca). Le workflow suit maintenant aussi l'écran Notifications, commit [d87e8926ebff560b1e51133c9960499c86186887](https://github.com/audreymendomo23-netizen/NAXA/commit/d87e8926ebff560b1e51133c9960499c86186887).

### Preuves d'exécution sur Replay

**Migration appliquée : PASS.** Version `20261115090807` présente dans `supabase_migrations.schema_migrations`.

**Test SQL transactionnel : PASS.** Il crée dans une seule transaction six lots temporaires d'un même produit : cinq échéances (J-30, J-15, J-7, J-3, J0) avec 10 unités chacun, et un lot expiré la veille avec 999 unités. Le dispatcher est appelé avec une limite d'un lot et six passages successifs pour démontrer qu'il progresse après chaque lot notifié. Résultats :
1. Offre Marketplace = **50 unités**, pas 1 049 : les 999 unités périmées ne sont pas comptées.
2. La recherche publique de pharmacie renvoie cette offre avec **50 unités valides seulement**.
3. Cinq seuils déclenchent exactement un rappel par destinataire autorisé, en six passages batch avec une limite d'un lot par appel.
4. Le passage suivant et une relance immédiate = **0 notification supplémentaire**.
5. Aucun rappel pour le lot déjà expiré J+1 ; aucun rappel destiné à Caisse/Livreur.
6. Après mise à zéro des cinq lots encore valides, le lot périmé de 999 unités ne maintient plus l'offre : quantité Marketplace = **0**, et la recherche publique ne renvoie plus la pharmacie comme offre disponible.
7. La référence catalogue reste découvrable à quantité nulle conformément à §43, sans exposition du lot ni offre achetable.
8. Les neuf fonctions de contrôle ciblées ne reposent plus sur `current_date` UTC pour les gardes de péremption.
9. Le cron de dix minutes attendu est présent et actif.

Le test termine par `ROLLBACK`. Contrôle post-test Replay : **0** ligne dans la table de dispatch, **0** notification `lot_expiry_reminder`, **0** lot de test, **0** ligne Stock conservée sur la pharmacie E2E utilisée.

**Planificateur et ACL : PASS.**
- Job `naxa-pharmacy-lot-expiry-notifications` : `*/10 * * * *`, actif, propriétaire `postgres` ; jusqu'à 1 000 lots par passage avec progression batch.
- Routine de dispatch `SECURITY DEFINER`, propriétaire `postgres`, EXECUTE refusé à `anon`, `authenticated` et `service_role` ; seul le scheduler propriétaire l'appelle.
- Helper de date locale non exécutable par les rôles clients.
- La table de dispatch est dans le schéma privé, RLS activée, aucun droit accordé aux rôles clients ; l'avertissement linter « RLS activée sans policy » sur cette table privée correspond à ce choix fermé et n'est pas une exposition publique.
- Les autres avis Supabase préexistants restent ouverts ; ce contrôle ne constitue pas un audit de sécurité global.

**Tests de code :**
- Les huit tests Node sont présents dans `scripts/test-pharmacy-lot-expiry-notifications.cjs` (seuils, rôles, déduplication, date camerounaise, ACL, batch, interface Stock, lien de notification). Vérification statique finale des fichiers versionnés : **10/10 groupes de contrats PASS**. Le lancement réel de `node --test` dans GitHub Actions après le dernier push reste à confirmer.
- Le test Node est branché dans le workflow Replay et le workflow surveille la migration, le test SQL, le script et l'écran Stock.
- **Run GitHub Actions après le dernier commit non confirmé** par les contrôles de session disponibles ; ne pas déclarer le test Node en CI PASS sur la seule présence du workflow.

### Limites de recette et reprise

- Replay contient **0 pharmacie active non-démo visible en recherche**. Le test a donc rendu temporairement une pharmacie démo non-démo uniquement dans sa transaction, puis a annulé cette modification avec le reste des fixtures.
- Le cron est créé et actif, mais aucune notification destinée à une vraie pharmacie n'a été livrée pendant ce test : aucune pharmacie publique réelle avec un lot échéant n'existe sur Replay.
- À la prochaine recette sur une pharmacie réelle de test non-démo, créer/réceptionner un lot réel avec date proche des seuils, vérifier l'arrivée de la notification Promoteur/Responsable/Gestionnaire Stock, la réception push/email selon les préférences et l'absence de notification pour les rôles exclus.
- Vérifier en navigateur que la carte/offre de pharmacie disparaît lorsque le seul stock restant est un lot périmé ; le retour de `public.search_pharmacies` et le calcul d'offre sont déjà testés en SQL. La référence catalogue peut rester accessible sans quantité vendable.
- Le parcours réservation → préparation → Livreur → livraison → encaissement reste séparément bloqué par l'absence d'approvisionnement traçable.

**État au §45 :** rappels configurés / migrations Replay appliquées — **PASS** ; cinq seuils, progression batch et déduplication — **SQL PASS** ; exclusion Marketplace du lot expiré — **SQL PASS** ; calendrier Cameroun dans les gardes et l'écran Stock — **PASS structurel + SQL** ; lien d'action vers les lots — **intégré / test contractuel ajouté** ; cron toutes les dix minutes — **PASS** ; livraison réelle d'une notification à une pharmacie publique — **non démontrée, faute de pharmacie non-démo/lot échu sur Replay** ; CI Node — **en attente de confirmation de run** ; état global — **PARTIEL**, pas AU VERT. Production et Vercel inchangés.

**Point exact de reprise :**
1. Consulter le run GitHub Actions déclenché par l'ajout au workflow du test `test-pharmacy-lot-expiry-notifications.cjs` ; relever les tests Node, TypeScript, lint et build.
2. Exécuter une notification réelle sur une pharmacie non-démo de recette possédant un lot à J-30/J-15/J-7/J-3/J0 ; vérifier les comptes Promoteur, Responsable, Gestionnaire Stock.
3. Vérifier dans un parcours navigateur que l'offre ne propose jamais la quantité d'un lot périmé, y compris lorsque des lots valides et périmés coexistent et lorsque le lot périmé est le seul restant.
4. Reprendre ensuite la réception et le parcours réservation → préparation → Livreur → clôture sans introduire de stock fictif.


## 46. Exécution runtime de la recette péremption sur les comptes et canaux Replay (15/11/2026)

**Périmètre exclusif : NAXA Replay** (pwfftcsjyeibxxqhwysw). Cette recette n'a effectué aucune écriture Production ou Vercel. Il n'existe toujours aucune pharmacie publique non-démo sur Replay ; l'exercice a donc utilisé temporairement la pharmacie de démonstration Mvan et ses comptes E2E déjà existants. Ce n'est pas une preuve sur une pharmacie commerciale réelle.

### Précontrôles

- Pharmacie Mvan initialement active, visible et est_demo=true.
- Un Promoteur actif et rattaché à Mvan ; un Gestionnaire Stock actif et affecté à Mvan ; un Caissier et un Livreur également actifs pour vérifier leur exclusion.
- Les quatre profils avaient un compte Auth associé. Aucun compte ou rôle n'a été créé/modifié.
- Produit de recette existant : Amlodipine NAXA Test, sans ligne Stock, sans lot et sans historique de mouvement préexistant dans Mvan. Aucun produit commercial ou fiche n'a été ajouté.

### Exécution persistée puis observée

Pour faire passer le filtre de distribution réservé aux pharmacies non-démo, est_demo a été mis temporairement à false uniquement sur Replay. La transaction de test a créé une ligne stock et deux lots :
- Lot NAXA-LIVE-EXPIRY-20261115-TEST01-D3, 10 unités, date 18/11/2026 (J-3 depuis le 15/11/2026).
- Lot NAXA-LIVE-EXPIRY-20261115-TEST01-OLD, 22 unités, date 14/11/2026 (déjà périmé).

Le dispatcher privé a été appelé avec la date réelle Africa/Douala. Résultats vérifiés après commit :

| Contrôle runtime | Résultat |
|---|---:|
| Notifications lot_expiry_reminder en base | **2** |
| Notification au Promoteur | **1** |
| Notification au Gestionnaire Stock | **1** |
| Notification au Caissier ou Livreur | **0** |
| File téléphone private.notification_push_outbox | **2 pending** |
| File push NAXA public.naxa_notification_push_outbox | **2 pending** |
| File email | **0** |

Les deux notifications contenaient le nom de pharmacie, le produit, le lot, les 10 unités présentes au moment de l'alerte, la date 18/11/2026 et le seuil J-3.

**Interprétation impérative :** la création des notifications in-app et leur enfilement dans les deux tables push sont prouvés. Les lignes push étaient encore en état pending au contrôle ; aucune preuve d'envoi par le fournisseur push ni de réception visible sur un téléphone n'a été obtenue. Le type de notification de péremption n'est pas dans la liste d'envoi email, ce qui explique le compte email à zéro et ne constitue pas un échec du canal in-app/push.

### Exclusion Marketplace runtime

1. Avec le lot J-3 à 10 unités et le lot périmé à 22 unités, la fonction d'offre a retourné **10 unités** et public.search_pharmacies a affiché l'établissement avec **10** ; les 22 unités expirées n'ont jamais été ajoutées.
2. La quantité du lot valide a ensuite été ramenée à zéro, et la quantité agrégée Stock a été alignée sur 22 (lot expiré uniquement).
3. L'offre a alors retourné **0** et la recherche publique a retourné **0 pharmacie** pour cette référence. Le lot périmé seul ne maintient donc ni disponibilité ni résultat pharmacie achetable.

### Planificateur

Le job naxa-pharmacy-lot-expiry-notifications est actif à */10 * * * *, sous le rôle propriétaire postgres. L'historique cron.job_run_details a fourni un passage réel :
- jobid 12, runid 15848 ;
- départ 15/11/2026 à 09:20:00 UTC ;
- statut succeeded, retour 1 row.

Ce passage démontre que le scheduler lance le job. Il précède la création du lot J-3 de recette ; il ne prouve donc pas que ce passage planifié a envoyé cette alerte précise. L'envoi de l'alerte de recette a été déclenché explicitement par l'appel du même dispatcher privé.

### Nettoyage et restauration

Une première tentative de nettoyage a été annulée intégralement parce que le trigger d'audit cherchait à écrire une ligne journal référençant le lot supprimé. Le second nettoyage a suspendu temporairement et exclusivement les deux triggers trg_journal_stock_manager_stocks et trg_journal_stock_manager_lots le temps de supprimer les fixtures, puis les a réactivés dans la même transaction.

Vérification post-nettoyage :
- pharmacie Mvan restaurée à est_demo=true ;
- 0 ligne Stock pour le produit de recette ;
- 0 lot marqué NAXA-LIVE-EXPIRY-20261115-TEST01 ;
- 0 ligne dans le journal de mouvement pour ce produit/pharmacie ;
- 0 notification de péremption associée à la recette ;
- 0 dispatch lié aux lots temporaires ;
- 0 pharmacie publique non-démo sur Replay.

Aucune quantité, aucun lot, aucune notification ni aucun journal temporaire ne reste.

### Tests applicatifs et limites

- Les tests SQL Replay (§45) restent **PASS** ; le présent test runtime persistant confirme notifications Promoteur/Gestionnaire Stock, exclusion Caisse/Livreur et recherche publique au niveau base.
- Les dix contrôles statiques source/UI de §45 sont PASS.
- Le test Node scripts/test-pharmacy-lot-expiry-notifications.cjs n'a pas été exécuté dans cette session : Node 22 était disponible dans le conteneur mais le réseau ne pouvait pas résoudre github.com. Le connecteur GitHub disponible ne permettait pas de lister/déclencher les runs push du workflow ; il ne retourne que les runs déclenchés par PR et les statuts commit étaient vides. Ne pas présenter CI Node comme PASS.
- La navigation navigateur avec les vrais comptes E2E et la réception push sur appareil Android enregistré restent non démontrées. Aucune pharmacie publique réelle non-démo ni appareil de recette configuré n'existe actuellement sur Replay.

**État au §46 :** dispatcher exécuté et notifications in-app observées — **PASS Replay** ; Promoteur — **PASS (1)** ; Gestionnaire Stock — **PASS (1)** ; Caisse/Livreur exclus — **PASS (0)** ; deux files push — **ENQUEUE PASS (2 + 2), réception téléphone NON PROUVÉE** ; recherche Marketplace mixte — **10 unités valides seulement** ; lot périmé seul — **offre 0 / pharmacie absente de la recherche, PASS** ; cron — **exécution observée succeeded** ; nettoyage/restauration — **PASS** ; Node CI — **non exécuté/non confirmé** ; notification sur vraie pharmacie publique — **à faire** ; état global — **PARTIEL**, pas AU VERT. Production et Vercel inchangés.

**Point exact de reprise :**
1. Obtenir un appareil Android de recette avec le compte Promoteur ou Gestionnaire Stock Replay et un token push valide ; traiter la file, puis prouver sent_at / statut envoyé et la réception sur appareil.
2. Consulter ou déclencher le run GitHub Actions du workflow Replay depuis l'interface GitHub pour exécuter node --test scripts/test-pharmacy-lot-expiry-notifications.cjs, puis relever le résultat complet.
3. Répéter la recette avec une pharmacie non-démo de recette explicitement autorisée, un lot réel de recette et un utilisateur Responsable lorsqu'une telle fixture existera ; ne pas changer le statut démo d'une pharmacie commerciale réelle pour simuler cette preuve.


## 47. Identité descriptive des produits indépendante par pharmacie et absence d'approbation Admin (15/11/2026)

**Décision métier confirmée :** chaque pharmacie doit pouvoir posséder sa propre fiche descriptive pour un même médicament, même si une autre pharmacie ou une ancienne référence commune contient déjà exactement le même nom, DCI, dosage, forme et code-barres. Chaque pharmacie garde ses propres informations, son prix, son stock et ses lots. NAXA ne relit, ne corrige, ne certifie et n'approuve aucune de ces fiches.

### Cause racine

Le modèle précédent imposait une unicité globale sur `(nom,dosage,forme)` et sur le code-barres. La RPC `pharmacie_produit_declarer_et_reference_initialiser` recherchait une fiche dans tout `public.produits`, sans filtrer sa pharmacie propriétaire. Lorsqu'une pharmacie B déclarait un produit déjà saisi par A, la fonction réutilisait l'identifiant de A. Les deux pharmacies pouvaient alors afficher le même descriptif propriétaire : l'indépendance de la fiche n'était pas garantie.

### Correction appliquée

- Suppression de la contrainte unique globale `produits_nom_dosage_forme_key` et de l'index global `produits_code_barre_uq`.
- Création de deux index uniques partiels, limités au propriétaire `created_by_pharmacie_id` : identité descriptive normalisée et code-barres. Deux pharmacies différentes peuvent donc utiliser le même code-barres et les mêmes attributs ; une seule pharmacie ne peut pas créer deux fiches identiques ou réutiliser le même code-barres sur deux fiches différentes.
- La RPC prend désormais un verrou transactionnel sur l'identité et le code-barres dans le périmètre de la pharmacie, puis recherche uniquement `created_by_pharmacie_id = p_pharmacie`. Elle ne réutilise jamais la fiche appartenant à une autre pharmacie. Un nouvel enregistrement passe toujours par le déclencheur d'attribution propriétaire, avec `source_fiche='declaration_pharmacie'` et `fiche_validee=false`.
- Le helper générique d'initialisation de stock accepte une ancienne référence commune sans propriétaire (`created_by_pharmacie_id IS NULL)) ou une fiche qui appartient à la pharmacie cible. Il refuse explicitement l'initialisation du stock d'une fiche appartenant à une autre pharmacie.
- Les anciennes références partagées sans propriétaire et toutes leurs relations historiques restent intactes. Elles restent sélectionnables pour compatibilité. Une pharmacie peut cependant créer sa propre fiche indépendante même lorsque le même médicament existe déjà dans ces références ou chez un concurrent.
- L'interface stock ne liste comme références sélectionnables que les anciennes fiches partagées et les fiches des pharmacies du périmètre actif ; les fiches propriétaires d'autres pharmacies sont masquées. Le formulaire est renommé **« Créer ma fiche produit pour cette pharmacie »** et explique explicitement qu'une fiche indépendante peut être créée même si le produit existe ailleurs.
- Les commandes d'import, d'initialisation et de déclaration de fiches sont cachées à l'Admin dans cet écran. Les policies INSERT/UPDATE et le déclencheur de fiche refusent aussi l'écriture du rôle Admin. L'Admin conserve la lecture technique ; il n'a aucun rôle d'approbation.
- Les fonctions de recherche Marketplace existantes classent déjà les produits par terme et pharmacie (`partition by terme, pharmacie_id`), agrègent une offre par pharmacie et conservent les fiches populaires par `produit_id`. Elles n'ont pas été modifiées : les IDs désormais distincts suffisent à maintenir les offres indépendantes. La page produit est également résolue par ID.

### Sources versionnées sur main

- Migration : `supabase/migrations/20261115110000_pharmacy_product_identity_scoped_by_pharmacy.sql`. Création de la source : [8f8e31862c8457c079055a0bcba8774be7aa3da4](https://github.com/audreymendomo23-netizen/NAXA/commit/8f8e31862c8457c079055a0bcba8774be7aa3da4) ; correction pour conserver le paramètre par défaut du helper : [3f8ddc7221812bf8ee8f0d683c3080a041f38f96](https://github.com/audreymendomo23-netizen/NAXA/commit/3f8ddc7221812bf8ee8f0d683c3080a041f38f96).
- Version réellement appliquée sur Replay : `20261115092414`, nom `pharmacy_product_identity_scoped_by_pharmacy`.
- Test SQL : `supabase/tests/20261115110000_pharmacy_product_identity_scoped_by_pharmacy.sql`, source et correction d'assertion : [f6b068844d0c57bd656de49a3b9e145cbd82cf9f](https://github.com/audreymendomo23-netizen/NAXA/commit/f6b068844d0c57bd656de49a3b9e145cbd82cf9f).
- Espace Stock : filtre par propriété, retrait des commandes Admin et texte de création indépendante ; commits [fb07d03fd46e264c004f22607bb3bd7ed390bdde](https://github.com/audreymendomo23-netizen/NAXA/commit/fb07d03fd46e264c004f22607bb3bd7ed390bdde) et [cd8d9619c7453945f217de1d747c8c4dd29aef33](https://github.com/audreymendomo23-netizen/NAXA/commit/cd8d9619c7453945f217de1d747c8c4dd29aef33).
- Test Node contractuel `scripts/test-pharmacy-led-product-publication.cjs` : assertions ajoutées [5767ab72549e0ceada07c49a1d04b575c148d308](https://github.com/audreymendomo23-netizen/NAXA/commit/5767ab72549e0ceada07c49a1d04b575c148d308), assertion du libellé de création indépendante [d94ed44e4a527799efc64c18a6e8784b62e57c42](https://github.com/audreymendomo23-netizen/NAXA/commit/d94ed44e4a527799efc64c18a6e8784b62e57c42).
- Workflow Replay surveillant la migration et le test SQL : [0605a188331853b04ce7568ee5490a942ea0f952](https://github.com/audreymendomo23-netizen/NAXA/commit/0605a188331853b04ce7568ee5490a942ea0f952).

### Preuves d'exécution sur Replay

**Test SQL de contrat : PASS.** Il vérifie la disparition des contraintes globales, la présence des index scindés par pharmacie, le verrouillage de la déclaration, le garde du helper de stock, l'absence d'écriture Admin et le partitionnement Marketplace par pharmacie.

**Test runtime sous JWT Promoteur : PASS, transaction annulée.** Avec le véritable Promoteur E2E rattaché à deux pharmacies de recette (Mvan et Essos), la même déclaration a été appelée deux fois avec le même nom, DCI, dosage, forme et code-barres `99991111`, mais sur deux pharmacies distinctes :
- deux IDs produit distincts ont été générés ;
- chaque fiche est attribuée à la bonne pharmacie ;
- les deux fiches gardent `source_fiche='declaration_pharmacie'` et `fiche_validee=false` ;
- Mvan conserve son prix de **123 FCFA** et Essos **456 FCFA** ;
- les deux lignes de stock commencent à **0** ;
- la même valeur de code-barres est acceptée dans les deux pharmacies, sans conflit global.

**Isolation et rôle Admin : PASS.**
- Essos ne peut pas initialiser le stock de la fiche appartenant à Mvan : refus explicite du helper.
- Le rôle Admin ne peut pas déclarer une fiche ni initialiser une référence de stock.
- Une tentative UPDATE directe sous le rôle Admin affecte **0 ligne** ; l'accès SELECT technique reste présent.

**Nettoyage : PASS.** Les trois groupes runtime ont été exécutés dans une transaction terminée par `ROLLBACK`. Contrôle après transaction : **0 produit temporaire**, **0 ligne de stock temporaire**, **0 fiche propriétaire persistée**, **0 groupe de doublons propriétaires**. Aucun lot, prix réel, réservation, vente, compte Auth ou donnée métier durable n'a été créé.

### Contrôles sécurité / performance et limites

- Le linter Supabase signale l'exécution par `authenticated` des deux RPC `SECURITY DEFINER` (`pharmacie_produit_declarer_et_reference_initialiser` et `gestionnaire_stock_reference_initialiser`). C'est attendu pour les RPC métier traversant les policies RLS ; elles valident `auth.uid()`, le rôle actif, la pharmacie cible et le propriétaire. Le droit d'exécution anonyme de la RPC de déclaration reste révoqué. Ces avertissements sont documentés, pas masqués.
- Le linter performance conserve des avertissements RLS `auth_rls_initplan`, de policies permissives sur Stocks et une FK `produits_created_by_fkey` sans index couvrant. Ils ne sont pas déclarés corrigés par cette migration.
- Les contrôles de contrat dans le fichier Node sont intégrés au workflow Replay. Le statut du commit contrôlé par GitHub ne renvoie aucun contexte, et le connecteur des runs ne liste que les exécutions déclenchées par PR. **Le lancement réel de `node --test`, TypeScript, lint et build sur le push n'est donc pas confirmé.** La validation SQL Replay et le test runtime ne remplacent pas cette preuve CI.
- La recherche SQL conserve une sélection et agrégation par pharmacie, mais la vérification de deux offres visibles dans une recherche publique HTTP et une navigation navigateur reste à faire : les deux pharmacies utilisées pour le test sont des pharmacies démo et ne sont pas publiquement listées.
- La correction n'ajoute aucun produit commercial, stock positif, lot, réservation, vente ou paiement. Le parcours d'achat reste soumis à une réception réelle et à la traçabilité habituelle des lots.

**État au §47 :** modèle de fiche indépendante par pharmacie — **SQL PASS + runtime JWT PASS** ; même identité/code-barres entre deux pharmacies — **PASS** ; refus d'utilisation de la fiche d'un autre propriétaire — **PASS** ; Admin déclaration/initialisation/modification — **REFUS PASS** ; Admin consultation — **PASS** ; nettoyage des fixtures — **PASS** ; CI Node/TypeScript/lint/build — **non confirmé** ; recherche publique multi-offres HTTP — **à exécuter sur pharmacies non-démo** ; stock réel/lot/réservation — **toujours non prouvé** ; état global — **PARTIEL**, pas AU VERT. Production et Vercel inchangés.

**Point exact de reprise :**
1. Consulter le run GitHub Actions déclenché par le push contenant `d94ed44e4a527799efc64c18a6e8784b62e57c42` et relever Node, TypeScript, lint et build ; ne pas transformer un statut vide en PASS.
2. Sur une pharmacie non-démo de recette explicitement autorisée, créer une fiche identique à celle d'une autre pharmacie, enregistrer une offre réelle traçable et vérifier dans la recherche publique que chaque offre reste rattachée à son propre `produit_id`, son prix et sa pharmacie.
3. Reprendre ensuite une réception réelle avec lots et péremption, puis réservation Client → préparation Gestionnaire Stock → affectation Livreur → livraison. Ne jamais remplacer ces preuves par des quantités fictives.
4. Maintenir Production et Vercel inchangés jusqu'à autorisation expresse.


## 48. Vérification des assertions Node et clôture factuelle des dépendances externes (15/11/2026)

**Périmètre :** vérification des sources main et lecture agrégée de NAXA Replay (pwfftcsjyeibxxqhwysw). Aucune écriture SQL, aucun utilisateur, appareil, lot ou stock temporaire créé. Production et Vercel non touchés.

### Contrat de test — assertions rejouées

Le fichier scripts/test-pharmacy-lot-expiry-notifications.cjs contient huit groupes d'assertions. Leur logique a été réexécutée contre le contenu exact des sources récupérées depuis main dans l'environnement d'audit :

| Groupe | Résultat |
|---|---|
| Seuils J-30/J-15/J-7/J-3/J0, Africa/Douala et cadence cron | **PASS** |
| Ciblage Promoteur, Responsable et Gestionnaire Stock actifs | **PASS** |
| Déduplication par lot/date/seuil/destinataire | **PASS** |
| Date locale Cameroun et exclusion Marketplace des lots périmés | **PASS** |
| Table privée, ACL et fixture SQL annulable | **PASS** |
| Progression batch et absence de rediffusion aux destinataires servis | **PASS** |
| Date civile Africa/Douala dans l'interface Stock | **PASS** |
| Lien direct vers Lots & Péremptions | **PASS** |

**Résultat : 8/8 assertions PASS.** Sources vérifiées par SHA de blob : migration c80433f0e521853084cca4c7490105084a2ed9b7, batch fe1f61399e41d5c363b87b7d5efa6fd5a2b942e3, test SQL fc893546c6b29fca0d5e6075e59dbe1177aff7d5, UI Stock 3d01589e264338069b99bab26a9b43d1d71e35ec, page Notifications 375256b14674b23e7adf1a4a6c69b403610aeddb, script Node 9c6e3693d04a9299c4052c62287dced79b75f46c.

**Limite de preuve :** il s'agit d'une réexécution des huit assertions sur les sources actuelles, pas d'une invocation du runner node --test. Le workflow GitHub inclut workflow_dispatch et un déclenchement push filtré, mais le connecteur de cette session ne fournit pas l'action de dispatch ni la liste des runs push. Le statut combiné du commit consulté 70266ea1cc61136ffbe69bfe70bc070e12fb04b4 est vide. CI Node/TypeScript/lint/build : **NON CONFIRMÉ**, jamais déclaré PASS.

### Réalité du canal push sur Replay

Lecture des tables de souscription et d'appareils :

| Source | Enregistrements actifs |
|---|---:|
| public.naxa_push_subscriptions | **0** |
| public.naxa_payment_notification_devices | **0** |
| public.naxa_partner_payment_devices | **0** |
| public.naxa_promoteur_payment_devices | **0** |

Les deux files contiennent chacune une ancienne ligne pending (état de référence, pas une preuve d'envoi). Aucun terminal Promoteur/Gestionnaire Stock n'est donc appairé avec un abonnement ou jeton push actif dans Replay. Sans appareil réel, consentement et abonnement, l'envoi fournisseur et la réception visuelle ne peuvent pas être démontrés. **Point classé BLOQUÉ — dépendance appareil**, pas défaut de l'algorithme d'alerte. Aucune ligne de file n'a été traitée ni modifiée.

### Réalité du rôle Responsable et de la pharmacie

- Les profils actifs recensés dans Replay couvrent Admin, Client, Caisse, Gestionnaire Stock, Livreur et Promoteur ; **aucun profil Responsable** n'existe.
- Sur la pharmacie E2E Mvan, les affectations actives sont Caisse (1), Gestionnaire Stock (1) et Livreur (1) ; aucune affectation Responsable.
- Replay contient **0 pharmacie non-démo** et **0 pharmacie publique non-démo**. Les deux enregistrements Mvan visibles portent est_demo=true.
- Aucune pharmacie n'a été artificiellement requalifiée en non-démo ; aucun profil Client/Employé n'a été détourné en Responsable.

**Point classé BLOQUÉ — fixture professionnelle réelle** : il faut une pharmacie de recette explicitement autorisée, non-démo par conception, et un compte Auth Responsable créé/affecté par le parcours professionnel normal du Promoteur. Une ligne de profil isolée ou un changement opportuniste de rôle ne constituerait pas une preuve valable.

### État consolidé et continuation exacte

| Point | État |
|---|---|
| Assertions source du test de péremption | **8/8 PASS** |
| Runner GitHub Actions node --test + TypeScript/lint/build | **NON CONFIRMÉ** |
| Enqueue notifications in-app / files push sur la recette précédente (§46) | **PASS** |
| Envoi fournisseur et réception sur téléphone réel | **BLOQUÉ — aucun appareil/abonnement actif** |
| Ciblage runtime d'un Responsable | **BLOQUÉ — aucun compte/affectation Responsable** |
| Recette sur pharmacie non-démo | **BLOQUÉ — aucune pharmacie non-démo sur Replay** |
| Production et Vercel | **INCHANGÉS** |

**État global : PARTIEL, pas AU VERT.** Les contrats techniques vérifiables sont PASS ; les points restants dépendent d'éléments réels non présents dans Replay et ne doivent pas être simulés.

**Point exact de reprise :**
1. Déclencher manuellement le workflow NAXA Replay Promoteur E2E depuis GitHub Actions (workflow_dispatch) et consigner les logs des étapes Node, TypeScript, lint et build.
2. Enregistrer un appareil Android de recette sur un compte Promoteur ou Gestionnaire Stock Replay, accepter explicitement les permissions/notifications, vérifier la création d'un abonnement/token, puis prouver l'état envoyé côté fournisseur et la réception sur le téléphone.
3. Créer ou autoriser une pharmacie de recette non-démo dédiée et un véritable compte Auth Responsable ; lui attribuer l'affectation par le parcours professionnel normal, puis répéter la notification sur un lot de recette au seuil attendu.
4. Garder Production et Vercel inchangés jusqu'à autorisation expresse.


## 49. Contrôle de reprise documentaire après §48 (15/11/2026)

Relecture de `docs/E2E_CONTINUITE.md` sur `main` après le commit `7afded8ab6c0e453c48f38ad82205e2ffb0fe2b9` (correction de mise en forme de la section catalogue). La section §48 est présente et son contenu probatoire est conservé : huit assertions de contrat rejouées PASS, runner Node/GitHub Actions non confirmé, canal push sans appareil/abonnement actif, aucun profil Responsable, aucune pharmacie non-démo sur Replay.

Cette reprise documentaire n'ajoute aucune preuve d'exécution. Aucun workflow n'a été déclenché, aucune file push n'a été traitée, aucun appareil/compte professionnel/pharmacie de recette n'a été créé, et aucune donnée SQL n'a été modifiée. Les points bloqués au §48 restent donc bloqués ; le résultat global demeure **PARTIEL — pas AU VERT**. Production et Vercel restent inchangés.

**Point exact de reprise :** poursuivre uniquement à partir des preuves manquantes énumérées au §48 : run GitHub Actions, appareil Android enregistré et consentant, puis pharmacie non-démo dédiée avec compte Auth Responsable affecté par le parcours professionnel normal.


## 50. Isolation RLS de lecture des fiches descriptives privées par pharmacie (15/11/2026)

### Cause racine complémentaire

La section §47 avait limité le choix des fiches dans l'interface Stock et protégé les écritures ; toutefois, la policy SELECT `produits_authenticated_live_offer_read` conservait une ancienne branche qui autorisait tout compte professionnel ayant une pharmacie active à lire toutes les fiches propriétaires, même celles d'une pharmacie hors de son périmètre. Le masquage dans l'interface ne suffisait donc pas à garantir l'isolation via l'API Supabase directe.

### Correction appliquée

La policy SELECT authentifiée est maintenant composée de quatre chemins distincts :

1. Une offre réellement visible sur le Marketplace reste consultable dans le périmètre public prévu.
2. L'Administrateur conserve la lecture technique de toutes les fiches, sans droit de création, de modification ou d'initialisation de stock.
3. Une fiche avec `created_by_pharmacie_id IS NOT NULL` n'est lisible par un compte professionnel que si `private.naxa_scope_allows(auth.uid(),created_by_pharmacie_id,'PHARMACIE')` confirme son périmètre actif. Les Promoteurs gardent ainsi la visibilité sur leur propre réseau, tandis qu'un Gestionnaire Stock ne lit que la pharmacie de son affectation active.
4. Les anciennes fiches historiques avec propriétaire NULL conservent la règle de lecture partagée déjà en place pour les Promoteurs validés et le personnel professionnel avec pharmacie active.

Aucune restriction réglementaire ou validation NAXA n'est ajoutée : la règle porte uniquement sur l'isolation des données entre pharmacies.

### Sources et déploiement Replay

- Migration : `supabase/migrations/20261115112000_scope_private_product_fiche_reads.sql`, commit [400a7ce43619da0722c8dd0312c331b7e44899b6](https://github.com/audreymendomo23-netizen/NAXA/commit/400a7ce43619da0722c8dd0312c331b7e44899b6).
- Version Replay appliquée : `20261115093145`, nom `scope_private_product_fiche_reads`.
- Test SQL : `supabase/tests/20261115112000_scope_private_product_fiche_reads.sql`, commit [43bafd8a9e034e148eea470ef3018892bfb5bddf](https://github.com/audreymendomo23-netizen/NAXA/commit/43bafd8a9e034e148eea470ef3018892bfb5bddf), exécution SQL Replay **PASS**.
- Workflow Replay surveillant les deux nouveaux fichiers : commit [e3e5288855bc9727dcf63223fdacc93b799bd1ef](https://github.com/audreymendomo23-netizen/NAXA/commit/e3e5288855bc9727dcf63223fdacc93b799bd1ef).
- Test Node `scripts/test-pharmacy-led-product-publication.cjs` étendu pour contrôler la policy SELECT et le test SQL : commit [b6570c2acb61337e13a5ded5bc063abe391652ef](https://github.com/audreymendomo23-netizen/NAXA/commit/b6570c2acb61337e13a5ded5bc063abe391652ef). Le même script est déjà inclus dans la commande `node --test` du workflow.

### Test runtime sous JWT — preuve d'isolation réelle

Dans une transaction Replay annulée :

- Le Promoteur crée une fiche identique pour Mvan et Essos, chacune avec son propre ID produit.
- La session authentifiée est ensuite basculée vers le compte E2E Gestionnaire Stock, dont l'affectation et le scope sont actifs sur Mvan uniquement.
- `private.naxa_scope_allows` retourne Mvan = **true**, Essos = **false**.
- Lecture directe de `public.produits` sous RLS avec les deux IDs : fiche Mvan visible = **1**, fiche Essos visible = **0**.
- Les anciennes fiches historiques partagées sans propriétaire restent visibles = **20**.

**Résultat : PASS.** Le test démontre l'isolation RLS, pas seulement le filtrage de l'interface.

### Contrôle de l'écran d'administration

L'écran `src/app/admin/produits/page.tsx` reste une **consultation technique en lecture seule** : recherche et tableau de fiches, sans formulaire ni action de validation, publication ou modification. Le texte de l'écran explique que NAXA ne vérifie, certifie, approuve ou corrige pas les fiches. Aucun fichier `src/app/admin/produits/actions.ts` n'est présent. Le test contractuel `scripts/test-admin-produits-actions.cjs` vérifie l'absence de commandes d'écriture et reste inclus dans la commande `node --test` du workflow Replay. La preuve d'écriture Admin refusée par RLS et par RPC est également enregistrée au §47.

### Contrôle Supabase après la migration SELECT

- Advisor sécurité : les deux RPC métier `pharmacie_produit_declarer_et_reference_initialiser` et `gestionnaire_stock_reference_initialiser` restent classées `SECURITY DEFINER` exécutables par `authenticated`. Leurs contrôles de rôle, scope et propriétaire sont testés ; la déclaration n'est pas exécutable par `anon`. Les avertissements globaux ne sont pas masqués.
- Advisor performance : avertissements `auth_rls_initplan` résiduels sur les policies produits INSERT/UPDATE/SELECT, FK `produits_created_by_fkey` sans index couvrant et index historiques non utilisés. Ils sont suivis séparément et ne sont pas déclarés résolus par le changement d'isolation.

### Nettoyage et limites

Le test runtime s'est terminé par `ROLLBACK`. Vérification post-test Replay :
- fiche temporaire du test précédent = **0** ;
- fiche temporaire du test de lecture = **0** ;
- lignes Stock temporaires = **0** ;
- fiches propriétaires persistées dans Replay = **0**.

Le workflow surveille les migrations et exécute les assertions Node contractuelles, mais son run déclenché par push n'est pas exposé par le connecteur GitHub de cette session. **Node CI, TypeScript, lint et build restent NON CONFIRMÉS.** Le test des offres Marketplace publiques via HTTP avec deux pharmacies non-démo reste également à faire ; les fixtures utilisées ici sont des pharmacies de démonstration. Aucun stock réel, lot, réservation ou vente n'a été créé.

**État au §50 :** identité propriétaire distincte — **SQL PASS + runtime JWT PASS (§47)** ; lecture RLS du propriétaire uniquement — **SQL PASS + runtime JWT PASS** ; fiche étrangère invisible — **PASS** ; 20 fiches historiques partagées préservées — **PASS** ; Marketplace visible — **policy conservée** ; Admin lecture seule — **PASS (§47)** ; nettoyage — **PASS** ; CI Node/TypeScript/lint/build — **NON CONFIRMÉS** ; recherche publique HTTP multi-pharmacies — **À FAIRE** ; état global — **PARTIEL**, pas AU VERT. Production et Vercel inchangés.

**Point exact de reprise :**
1. Déclencher le workflow NAXA Replay depuis l'interface GitHub Actions et vérifier Node, TypeScript, lint et build.
2. Faire le test de recherche Marketplace publique avec deux pharmacies non-démo autorisées, chacune avec fiche distincte et offre réelle, pour confirmer les deux offres/prix par HTTP et navigateur.
3. Reprendre seulement ensuite la réception traçable, les lots, la réservation Client et le parcours de livraison.
4. Ne pas toucher Production ou Vercel sans autorisation expresse.


## 51. Clôture du parcours Marketplace → Assurance → Caisse → Comptabilité (15/11/2026)

### Audit et causes racines

- La recherche Marketplace avait déjà le filtre Assurance dans `src/app/resultats/page.tsx` : elle consomme les projections `marketplace_assureurs` et `marketplace_assurance_conventions`. L'ancienne limite documentaire qui disait le contraire était périmée. La couverture HTTP/browser multi-pharmacies reste non testée.
- La page Caisse lisait `couvertures_assurance`, dont la policy SELECT ne permet que le client propriétaire, et filtrai(t) les dossiers par `created_by = utilisateur connecté`, alors que le dossier est créé au nom du client. Cette combinaison masquait les dossiers Assurance dans la vue Caisse.
- Le tableau `/pharmacie/assurance` exposait les conventions et KPI, mais aucune action UI pour contrôler les justificatifs, confirmer la prise en charge ni enregistrer les règlements, alors que les RPC sécurisées existaient déjà.
- Le test de clôture Caisse a aussi montré que `vente_annulation_demander` contrôlait le périmètre pharmacie mais ne restreignait pas la demande à la vente créée par le demandeur.

### Corrections effectuées sur `main`

- Commit `8dc029c25617cb1c61f68455c732c34cde438d21` — la page Caisse consomme maintenant `assurance_reservation_snapshots` filtrés par pharmacie, et les dossiers de la pharmacie sans filtre `created_by`. Elle n'affiche pas les numéros d'adhérent/police du registre privé client.
- Commit `368235024af9ffa1af6b5d1382e0d4e2e6ade3f0` — le tableau Assurance charge les snapshots et expose les actions : contrôle conforme/non conforme, confirmation séparée de la prise en charge, saisie du remboursement reçu (montant, date, référence). Les autorisations et contraintes de montant restent contrôlées par les RPC côté base.
- Commit `131b3a125054a8c3a0c96d24399aedb901d53632` — migration additive `20261115100500_caisse_annulation_propre_vente_guard.sql`, appliquée sur Replay seulement (historique : `20261115093423 / caisse_annulation_propre_vente_guard`). La demande d'annulation est désormais restreinte à `ventes.created_by = auth.uid()` ; la décision reste dans le workflow de validation existant.
- Les contrats SQL Assurance ont été actualisés pour refléter les fonctions déployées : taux issu de la règle de la pharmacie (le taux déclaratif client est fixé à 100 %), reconnaissance de la créance à la confirmation, et même clé d'idempotence au rattachement POS.

### Preuves SQL Replay

| Test | Résultat constaté |
|---|---|
| `202611120_assurance_comptabilite_contract.sql` | Exécuté sans exception ; transaction annulée |
| `202611121_assurance_rule_precedence_calculation.sql` | **PASS** — priorité règles, calcul, exclusions/plafonds et frontière comptable |
| `202611121_assurance_compta_worker_positive.sql` | **PASS** — prise en charge synthétique 10 000 FCFA, remboursements partiel 4 000 puis final 6 000, écritures équilibrées, idempotence ; rollback final |
| `187_caisse_parcours_scope_assurances.sql` | **PASS** — RLS snapshots/dossiers, confidentialité des couvertures et garde demande d'annulation |
| `20261114073630_marketplace_assurance_public_projection_acl.sql` | Exécuté sans exception ; ACL/projections conformes ; 0 convention active visible (aucune convention Replay) |
| `049_assurances.sql` | **PASS** |

La vérification post-tests confirme que les fixtures ne persistent pas : Replay contient toujours 5 assureurs et 0 couverture, 0 convention, 0 règle, 0 snapshot, 0 dossier, 0 événement Assurance, 0 règlement ; côté comptabilité, 0 période, 0 événement, 0 écriture et 0 ligne persistante.

### Limites bloquantes

1. **Import assureurs absent** : aucun pipeline de réception, simulation, dédoublonnage et rapprochement des listes d'assurés transmises par les assureurs n'est versionné. Le format de fichier, la provenance, la version/durée d'effet et la clé vérifiée adhérent/bénéficiaire ne sont pas définis ; ne pas rapprocher des personnes sur des identifiants approximatifs.
2. **Négociation de droits absente** : la pharmacie ne peut pas proposer un autre montant au client puis recueillir un nouvel accord traçable. Le snapshot financier reste immuable ; une conception complémentaire est nécessaire sans réécrire un devis accepté.
3. **E2E authentifié absent** : aucun compte Client/Pharmacien/Caisse/Comptable avec pharmacie/convention/règles n'a exécuté le vrai parcours Marketplace, vérification d'assuré, réservation, contrôle, POS fractionné, ticket et remboursement.
4. **Comptabilité réelle absente** : aucun plan, mapping, paramètre ou période n'est configuré dans Replay. Le test worker est une simulation transactionnelle annulée, pas une écriture réelle.
5. **Qualité applicative** : le workflow GitHub `NAXA quality` doit terminer avec Node, TypeScript, lint et build. Au moment de cette mise à jour, aucun run complet n'est encore retenu comme preuve.

**État §51 : PARTIEL — PAS AU VERT.** Les contrats SQL Assurance, la protection de la vue Caisse et les interfaces d'action sont corrigés et les tests structurels Replay passent ; l'import des assurés, la négociation, l'E2E authentifié et le rapprochement comptable réel restent ouverts. Aucune modification Production et aucun déploiement Vercel.

**Point exact de reprise :**
1. Finaliser le contrat de données de l'assureur sur un fichier exemple expurgé, puis construire l'import sécurisé et le rapprochement des bénéficiaires.
2. Concevoir et tester la nouvelle offre de prise en charge et la collecte du nouvel accord client, en préservant les snapshots immuables.
3. Préparer les comptes métier et une pharmacie de recette, puis exécuter tout le chemin Marketplace → Caisse → comptabilité avec preuve de ticket et règlement.
4. Obtenir le résultat final du workflow GitHub qualité Node/TypeScript/lint/build.
5. Garder Production et Vercel inchangés sans autorisation expresse.


## 52. Import des assurés, négociation de droits et raccord POS (15/11/2026)

### Audit → contradiction → cause racine

- La couverture saisie par le Client était traitée comme éligible à un devis alors qu'aucun rapprochement machine avec une liste assureur n'existait. Une saisie de numéro d'adhérent ne prouve pas à elle seule les droits.
- La vérification enregistrée sur la couverture client ne pouvait pas être portée par plusieurs pharmacies indépendamment ; une vérification dans une pharmacie risquait d'écraser celle d'une autre.
- Les propositions versionnées de montant étaient déjà présentes dans le dépôt, mais le POS et le déclencheur de créance continuaient à utiliser les montants du snapshot initial. Le raccord à la dernière proposition acceptée manquait.
- Les contrats comptables et de négociation comportaient une assertion d'idempotence héritée de l'ancienne clé simple ; la fonction active utilise la clé composite `pharmacie_id + cle_idempotence`.

### Corrections versionnées sur `main`

- `7dc701cf65a89e12bfc49cb09cd0c27b7be85686` — tables d'import, simulation et rapprochement exact, vérification obligatoire avant calcul de devis, POS et ticket raccordés aux montants négociés.
- `32c30ec89d1962498e6b8e91d788905efc5b3d7b` — une ligne au statut source invalide est enregistrée comme invalide au lieu de faire échouer toute la simulation.
- `823a20ae168c33bb820711022c8745de29b547e6` — vérifications d'adhésion indépendantes par pharmacie, versions de déclaration, mode import complet/delta, nouvelle liste complète qui remplace les vérifications antérieures de cette pharmacie seulement.
- `6774e199e60e9bce9977b45ae8539f3cd2fc491a` — interface d'import CSV/XLS/XLSX, simulation avant application, SHA-256, limite 10 Mo/5 000 lignes, aperçu des correspondances, anomalies et doublons.
- `48b911a9197cd0d369e88a9c22d6f9d8e1ab6754` — sélection explicite entre liste complète et mise à jour delta.
- `416232615f96020a0b63bea3df59d775e0a5c055` — le reçu Client consulte la vérification effective de sa couverture pour la pharmacie de la réservation et désactive le devis si elle manque, est périmée ou a été invalidée par une correction de la déclaration.
- `15e4fbf3a50c3b9049042fdb439103d0732cd98e` — contrat SQL import/vérification multi-pharmacie/POS négocié.
- `d90bf16801564b0ec8ad6b7185b6da35c78bc9d6` — tests Node du pipeline import et du parcours Client/Pharmacie.
- `67cc8947529a83f05e86d83ea823a688d7e12966` — assertion comptable alignée sur la clé d'idempotence composite réellement utilisée.

### Contrat d'import implémenté

Le fichier doit comporter un numéro adhérent, une date de début et un statut. Les champs numéro de police, nom du bénéficiaire et date de fin sont facultatifs. Les alias d'en-têtes usuels sont normalisés. Le moteur fait un rapprochement exact du numéro d'adhérent et de police ; le nom du bénéficiaire est comparé lorsqu'il est fourni. Une correspondance multiple, répétée, absente ou invalide reste bloquée. Aucun profil Client n'est créé automatiquement.

Le mode **Liste complète** remplace les anciennes vérifications de l'assureur pour cette pharmacie. Le mode **Delta** n'affecte que les lignes du fichier. La vérification est liée au SHA-256 du fichier, à sa référence de transmission, à l'assureur et à la pharmacie. Cette empreinte prouve l'intégrité du fichier traité ; elle ne constitue pas une signature de l'assureur. L'authenticité de la source est attestée par l'opérateur qui reçoit et importe le document.

Une même couverture peut ainsi être vérifiée dans plusieurs pharmacies. Toute correction du numéro d'adhérent, de police ou des dates dans le compte Client rend la vérification précédente caduque.

### Raccord de la négociation

- La pharmacie présente une proposition versionnée avec motif et nouvelle part assureur/client.
- Seul le Client propriétaire accepte ou refuse.
- Le snapshot initial est immuable ; la confirmation de prise en charge et le POS sont bloqués tant qu'une proposition est en attente.
- Le ticket client, le règlement POS et l'événement de créance comptable prennent le dernier partage explicitement accepté.

### Tests SQL exécutés sur Replay

| Test | Résultat |
|---|---|
| `20261115101000_assurance_amount_proposal_workflow.sql` | **PASS** — RLS, ACL, consentement explicite, snapshot immuable |
| `20261115121500_assurance_import_membership_pos_negotiation.sql` | **PASS** — import, vérification par pharmacie, idempotence POS et ticket |
| `202611121_assurance_rule_precedence_calculation.sql` | **PASS** — priorité/calcul et frontière comptable ; assertion idempotence alignée sur la clé composite |
| `202611121_assurance_compta_worker_positive.sql` | **PASS** — fixtures transactionnelles 10 000 FCFA + remboursements 4 000/6 000 FCFA, rollback final |
| `187_caisse_parcours_scope_assurances.sql` | **PASS** — portée RLS et demande d'annulation sur vente propre |
| `202611120_assurance_comptabilite_contract.sql` | Exécuté sans exception |
| `20261114073630_marketplace_assurance_public_projection_acl.sql` | Exécuté sans exception ; 0 convention publique active dans Replay |
| `049_assurances.sql` | **PASS** |

Le test Node `scripts/test-assurance-import-membership.cjs` est versionné et inclus dans le glob `npm test`. Le job Node/TypeScript/lint/build du workflow qualité courant doit encore fournir son résultat final.

### Contrôle de persistance après exécution

Replay contient toujours 5 assureurs, 4 profils Client, 1 profil Promoteur, 1 Admin et 9 pharmacies toutes démo. Il contient 0 couverture, 0 convention, 0 règle, 0 import, 0 ligne import, 0 vérification multi-pharmacie, 0 snapshot, 0 proposition, 0 dossier, 0 événement Assurance et 0 règlement.

La comptabilité Replay contient 0 plan, 0 mapping, 0 paramètre, 0 période, 0 événement, 0 écriture et 0 ligne persistante. Le test positif du worker est rollbacké : il ne constitue pas un rapprochement réel d'une pharmacie.

### Blocages restants — décision de clôture

1. **Fichier source réel** : l'importeur est livré, mais aucun exemple de fichier assureur expurgé n'a été fourni et aucun import métier n'a été réalisé. Les alias et colonnes attendus doivent encore être confirmés sur un fichier réel de l'assureur.
2. **E2E Assurance authentifié** : Replay dispose de 4 profils Client et 1 Promoteur, mais aucun profil Pharmacien, Responsable, Caisse ou Comptable identifié dans le contrôle. Les 9 pharmacies sont toutes démo. Aucun achat Marketplace Assurance complet, validation d'adhésion, vérification de justificatifs, POS/ticket et remboursement n'a donc été prouvé avec les rôles métier requis.
3. **Comptabilité réelle** : aucun plan, mapping, journal, paramètre ou période n'est configuré ; aucune écriture réelle n'a été postée. Ne pas créer des comptes ou périodes fictifs pour obtenir un vert.
4. **Qualité applicative** : le workflow `NAXA quality` associé au commit `67cc8947529a83f05e86d83ea823a688d7e12966` est encore en attente au dernier contrôle ; Node, TypeScript, lint et build ne sont donc pas encore certifiés sur l'ensemble des changements.

**État §52 : PARTIEL — PAS AU VERT.** L'importeur, le rapprochement strict multi-pharmacie, la négociation versionnée et le raccord POS sont implémentés et leurs contrats SQL passent. Restent le fichier assureur réel, les rôles professionnels et la pharmacie de recette autorisée, l'E2E Assurance réel, la configuration comptable réelle et le résultat du workflow qualité.

**Point exact de reprise :**
1. Tester l'import avec un fichier assureur expurgé conforme à son export réel, puis contrôler les lignes valides, ambiguës, suspendues et expirées.
2. Autoriser/créer par les parcours professionnels normaux les profils Pharmacien, Caisse et Comptable ainsi qu'une pharmacie de recette non-démo.
3. Exécuter Client → Marketplace → vérification adhésion → accord initial → contrôle justificatifs → négociation si nécessaire → accord client → POS → ticket → remboursement.
4. Configurer le vrai plan, les mappings, le journal et la période comptable de la pharmacie de recette, puis rapprocher la vente et la créance.
5. Confirmer Node/TypeScript/lint/build sur le dernier commit.

Production et Vercel restent inchangés.


## 53. Raccord du rapprochement assureur au devis Client — correction et runtime responsable (15/11/2026)

### Cause racine et corrections

**Défaut 1 — corrélation de la couverture.** La fonction public.assurance_calculer_devis recherchait la preuve de vérification avec v_c.id dans la même requête qui devait justement remplir le record v_c. Le record n'était pas encore assigné : l'existence de la validation de l'assureur ne pouvait pas être corrélée correctement. La requête utilise maintenant l'alias SQL de la ligne sélectionnée, c.id, pour la couverture et pour les sous-requêtes de vérification.

**Défaut 2 — version de déclaration non monotone dans une transaction.** now() est constant au sein d'une transaction PostgreSQL. Deux modifications successives d'une déclaration pouvaient donc partager le même horodatage transactionnel, alors que la seconde devait invalider la vérification précédente. Le déclencheur private.assurance_stamp_couverture_declaration() utilise désormais clock_timestamp() ; la colonne assurance_couverture_verifications.verification_le utilise également l'horloge réelle. Une correction du numéro d'adhérent, de police, de l'assureur ou des dates rend donc obsolète la vérification antérieure, même dans une transaction unique.

**Garde métier conservée.** Le Promoteur de recette présent dans Replay ne satisfait plus le contrôle de validité abonnement/convention naxa_promoteur_valide. Aucune désactivation de garde, élévation ni affectation artificielle n'a été réalisée. Le test runtime a utilisé le Responsable déjà actif et affecté à une pharmacie de recette non commerciale, avec private.naxa_scope_allows(...,'PHARMACIE')=true.

### Sources versionnées et Replay

- Source de vérification multi-pharmacie corrigée : supabase/migrations/20261115121500_assurance_multipharmacy_coverage_verification.sql, commit [0d738790494f84652a42da37e0d4494c14a3e6d2](https://github.com/audreymendomo23-netizen/NAXA/commit/0d738790494f84652a42da37e0d4494c14a3e6d2). La fonction de devis corrèle les preuves sur c.id et la version déclarative sélectionnée.
- Migration corrective de corrélation appliquée sur Replay : supabase/migrations/20261115123000_fix_assurance_quote_roster_verification_correlation.sql.
- Trigger de déclaration versionné avec clock_timestamp() : modification source commit [9d62a9520458621a9b9d7ba42f08b4cbad3f0ce8](https://github.com/audreymendomo23-netizen/NAXA/commit/9d62a9520458621a9b9d7ba42f08b4cbad3f0ce8), migration corrective supabase/migrations/20261115124000_assurance_declaration_version_uses_clock_timestamp.sql, commit [9090c949828dadba01ea5fc15545cea1cdd45cbc](https://github.com/audreymendomo23-netizen/NAXA/commit/9090c949828dadba01ea5fc15545cea1cdd45cbc).
- L'horodatage du journal de vérification utilise aussi l'horloge réelle, commit [ce6e75c99b1b87d10d2ac24553bd3aa3f07a7441](https://github.com/audreymendomo23-netizen/NAXA/commit/ce6e75c99b1b87d10d2ac24553bd3aa3f07a7441).
- Contrat SQL import/vérification/POS/négociation : supabase/tests/20261115121500_assurance_import_membership_pos_negotiation.sql, commit [76107720dce48ea6af306c6ad075c18c247cf31c](https://github.com/audreymendomo23-netizen/NAXA/commit/76107720dce48ea6af306c6ad075c18c247cf31c), exécution Replay PASS.
- Test runtime versionné : supabase/tests/20261115123000_assurance_import_runtime_multipharmacy.sql, source corrigée et adaptée au Responsable affecté : commits [a3b84e9e710bc2e58dc106d49fa3df12102e4785](https://github.com/audreymendomo23-netizen/NAXA/commit/a3b84e9e710bc2e58dc106d49fa3df12102e4785) et [53a8bffc11097ec17141125e6d87b527e6cef81e](https://github.com/audreymendomo23-netizen/NAXA/commit/53a8bffc11097ec17141125e6d87b527e6cef81e).
- Contrat Node scripts/test-assurance-import-membership.cjs : commit [8834def316809cdc4b167f9c9421dade53d838b2](https://github.com/audreymendomo23-netizen/NAXA/commit/8834def316809cdc4b167f9c9421dade53d838b2), puis assertions alignées avec la fixture Responsable et le devis hors pharmacie.
- Workflow Replay mis à jour pour surveiller le script, le test runtime SQL et les deux migrations correctives, et pour inclure le Node test dans node --test : commit [c17869ab26e3c2853efcb7a209aacb7829b874f9](https://github.com/audreymendomo23-netizen/NAXA/commit/c17869ab26e3c2853efcb7a209aacb7829b874f9).

### Exécution runtime exacte sur Replay

Le fichier 20261115123000_assurance_import_runtime_multipharmacy.sql a été exécuté directement sur Replay et s'est terminé par ROLLBACK.

**Contexte réel de la fixture :** Replay contient 10 pharmacies au contrôle du 15/11/2026 : 9 démo et une pharmacie de recette non commerciale, active mais masquée de la recherche publique. Un Responsable actif est déjà affecté à cette dernière ; aucun nouveau profil ni affectation n'a été créé pour ce test. Le Promoteur E2E ne passe actuellement pas la validation abonnement/convention, raison pour laquelle le test respecte le parcours Responsable au lieu de désactiver le garde. Replay ne contient toujours aucune pharmacie non-démo publiquement visible.

| Contrôle runtime | Résultat |
|---|---|
| Responsable existant, actif et affecté à la pharmacie non commerciale masquée | PASS |
| Couverture déclarée par le Client, état initial non_verifiee | PASS |
| Convention de pharmacie, simulation de liste complète avec 1 correspondance exacte, 0 invalide, 0 ambiguë, 0 doublon | PASS |
| Application de l'import, preuve liée à la pharmacie et statut verifiee | PASS |
| Devis Client dans la pharmacie vérifiée : 10 000 FCFA brut, 6 000 FCFA assureur, 4 000 FCFA Client | PASS |
| Même couverture refusée dans une autre pharmacie sans preuve de vérification locale | PASS |
| Correction du numéro de police : horodatage avancé et ancienne vérification refusée pour un nouveau devis | PASS |

**Résultat : 5 groupes runtime PASS.** L'import est une ligne synthétique représentative transmise à la fonction de simulation SQL ; il ne s'agit pas d'un véritable fichier reçu d'un assureur, ni d'une preuve d'authenticité de l'émetteur. Le test valide le rapprochement exact et les gardes backend. Il n'exerce pas le téléversement navigateur d'un vrai XLS/XLSX/CSV.

### Nettoyage et état durable après rollback

Lecture post-test Replay :
- couvertures, conventions, imports, lignes d'import et vérifications de la fixture : 0 ;
- réservations, snapshots et dossiers de la fixture : 0 ;
- événements Assurance et écritures comptables de la fixture : 0 ;
- réservations ayant décrémenté le stock pendant ce test : 0 ;
- le produit était une référence de test préexistante ; aucune fiche, quantité, lot ou paiement n'a été créé ;
- la pharmacie de recette reste active, non commerciale et invisible dans la recherche publique ; son statut démo, sa visibilité et ses affectations n'ont pas été modifiés.

### Qualité, limites et suite

- Le workflow Replay surveille maintenant les fichiers et inclut scripts/test-assurance-import-membership.cjs dans sa commande node --test. Le test Node est versionné, mais le statut GitHub du dernier push consulté est vide (statuses: []) ; l'exécution CI de ce dernier commit reste NON CONFIRMÉE.
- Un run qualité antérieur, commit 86980a32992e5543fda1ddccc965dc7a5d75935f, est documenté avec 488 tests PASS, TypeScript, ESLint et build PASS. Il précède cependant l'ajout et l'adaptation du nouveau test runtime versionné ; il ne remplace pas la preuve CI sur la tête actuelle.
- Seul le mode Liste complète a été exécuté en runtime. Le mode Delta est présent et contrôlé par le contrat SQL/Node, mais son application réelle avec un fichier source distinct reste à exécuter.
- Aucun vrai fichier assureur expurgé n'a été remis ; le SHA-256 prouve l'intégrité du contenu traité, pas la signature ou l'authenticité de l'assureur. L'origine du fichier doit être attestée par l'opérateur.
- Aucun POS authentifié, ticket de caisse, remboursement ni rapprochement avec un plan comptable réel n'est prouvé par ce test. Le parcours de proposition/acceptation et la création idempotente d'une créance synthétique sont couverts séparément au §52 avec transaction annulée.
- La pharmacie utilisée est non commerciale, masquée de la recherche publique. Il reste à répéter avec un vrai fichier expurgé, une pharmacie de recette expressément autorisée et les rôles Client/Responsable/Pharmacien/Caisse/Comptable pertinents.

**État §53 : PARTIEL — PAS AU VERT.** La corrélation de couverture, l'invalidation temporelle, l'import complet synthétique et le contrôle de devis par pharmacie sont SQL PASS + runtime PASS ; nettoyage PASS. Le vrai fichier assureur, le mode delta runtime, le POS/ticket/remboursement/comptabilité réelle et la CI sur la dernière tête restent ouverts. Production et Vercel inchangés.

**Point exact de reprise :**
1. Obtenir un export assureur expurgé et authentifié par l'opérateur ; exécuter le téléversement navigateur, la simulation, puis l'application du mode complet et du mode delta.
2. Faire confirmer le workflow qualité Node 22, TypeScript, ESLint, build et actionlint sur le commit final (le run 488/488 est antérieur au test runtime révisé).
3. Sur la pharmacie non commerciale autorisée, exécuter Client → réservation → couverture vérifiée → contrôle justificatifs → confirmation de prise en charge → POS/ticket → remboursement → événement comptable, avec comptes métier valides.
4. Garder la pharmacie hors recherche publique tant qu'une recette publique n'est pas expressément autorisée ; conserver Production et Vercel inchangés.


## 54. POS Assurance fractionné, reçu Client et remboursements — runtime transactionnel PASS (15/11/2026)

### Causes racines corrigées

1. `private.set_reservation_status` exigeait qu'une seule ligne de paiement POS soit égale au total brut de la réservation. Cette hypothèse rejetait le tiers payant Assurance, qui enregistre séparément le paiement Client et la créance assureur.
2. `naxa_reservation_receipt_snapshot` prenait la dernière ligne `vente_paiements` sans exclure `ASSURANCE:%`. Lorsque les lignes Client/Assurance partageaient le même horodatage transactionnel, le reçu pouvait sélectionner la créance plutôt que le montant réellement reçu du Client.
3. Le parseur CSV/XLS/XLSX normalisait l'en-tête canonique `beneficiaire_nom` en `beneficiairenom`, mais cet alias n'était pas listé ; un nom de bénéficiaire fourni pouvait donc être ignoré sans rejet de la colonne.

### Corrections versionnées sur `main`

- Migration `supabase/migrations/20261115134500_allow_split_pos_payments_for_reservations.sql` : le garde vérifie maintenant qu'il existe des lignes POS et que **la somme de toutes les lignes** égale le total brut de la vente/réservation. La transition, le périmètre et la vente payée restent obligatoires.
- Migration `supabase/migrations/20261115140000_fix_reservation_receipt_snapshot_split_payments.sql` : le snapshot de reçu sélectionne le paiement Client, exclut `ASSURANCE:%`, conserve le montant réellement perçu et la monnaie rendue. Si l'assureur couvre 100 % et qu'aucun paiement Client n'existe, le reçu marque explicitement `a_convenir` et 0 FCFA reçu ; il ne présente pas la créance comme de l'argent encaissé.
- `src/app/pharmacie/assurance/page.tsx` : l'alias `beneficiairenom` est accepté pour la colonne bénéficiaire ; l'écran propose le modèle CSV d'exemple.
- Modèle fictif : `public/modeles/assureur-liste-assures-exemple.csv`. Il ne contient aucune donnée personnelle réelle ; la ligne d'exemple doit être supprimée avant tout import.
- Guide du format et des limites : `docs/architecture/ASSURANCE_IMPORT_FORMAT_NAXA.md`.
- Régressions Node : `scripts/test-assurance-split-pos-receipt.cjs` et extension de `scripts/test-assurance-import-membership.cjs`. Les deux sont détectés par `npm test` (glob `scripts/test-*.cjs`).

### Runtime transactionnel exécuté sur Replay

Test versionné : `supabase/tests/20261115130000_assurance_marketplace_pos_ticket_reimbursement_runtime.sql`.

**Résultat : `assurance_marketplace_pos_ticket_reimbursement_runtime PASS`.** Le test exécute, sous contextes JWT Auth distincts Client/Responsable/Caisse, les étapes suivantes : déclaration client non vérifiée → convention de pharmacie → simulation et application d'une liste assureur synthétique → devis → acceptation initiale → contrôle documentaire → proposition financière → nouvel accord Client → confirmation de prise en charge → caisse POS → reçu Client → remboursements partiel et final.

| Contrôle | Résultat |
|---|---|
| Réservation Marketplace brute | 10 000 FCFA |
| Part assureur retenue après nouvel accord Client | 5 500 FCFA |
| Part Client encaissée | 4 500 FCFA |
| Espèces remises / monnaie rendue | 5 000 / 500 FCFA |
| Ligne POS de créance Assurance | 5 500 FCFA, marquée `ASSURANCE:%` |
| Ticket Client | partage initial 6 000/4 000 et partage accepté 5 500/4 500 visibles |
| Remboursements assureur | 2 000 puis 3 500 FCFA ; créance soldée |
| Outbox | 1 créance + 2 règlements Assurance ; vente encaissée limitée à la part Client |

Le test réutilise un Client et un compte Caisse Replay existants. Une affectation Responsable temporaire sur la même pharmacie de démonstration visible est créée dans la transaction, le compte bascule via `naxa_select_active_role` vers Responsable puis revient à Caisse via la même RPC. **Ce n'est pas une pharmacie commerciale ni une recette navigateur réelle.** Stock et coût d'achat de test, réservation, import, compte/affectation temporaire, dossier, vente, ticket et règlements sont annulés par `ROLLBACK`.

### Vérification après rollback

Replay confirme :
- 0 couverture, import, ligne d'import, vérification, convention, règle, snapshot, dossier, proposition, événement Assurance et règlement ;
- 0 période, événement, écriture et ligne comptable persistants ;
- 0 stock et 0 coût d'achat de fixture pour le produit/pharmacie utilisés ;
- 0 réservation ou vente de recette ;
- le compte Caisse a retrouvé son rôle actif `caisse`, sans affectation Responsable temporaire persistante.

### Tests Replay rejoués dans cette clôture

- `20261115121500_assurance_import_membership_pos_negotiation.sql` — PASS.
- `20261115123000_assurance_import_runtime_multipharmacy.sql` — 8 contrôles runtime PASS (liste complète, Delta, suspension/réactivation, correction de déclaration, devis par pharmacie).
- `20261115101000_assurance_amount_proposal_workflow.sql` — PASS.
- `20261115103000_assurance_client_refusal_event_visibility.sql` — PASS.
- `20261115104000_assurance_accounting_event_idempotence_scope.sql` — PASS.
- `20261115134500_split_pos_reservation_payment_contract.sql` — PASS.
- `20261115140000_reservation_receipt_snapshot_split_payments.sql` — PASS.
- `20261115130000_assurance_marketplace_pos_ticket_reimbursement_runtime.sql` — PASS.
- `202611121_assurance_compta_worker_positive.sql` — PASS, fixtures/mappings synthétiques et rollback.

### Limites qui empêchent encore AU VERT global

1. Aucun export réel, même expurgé, n'a été fourni par un assureur. Le modèle fixe les noms de colonnes, mais le téléversement navigateur et le rapprochement avec le fichier propriétaire de chaque assureur restent à vérifier sur un exemple authentique reçu par un opérateur habilité. Le SHA-256 prouve l'intégrité du fichier traité, pas l'identité de l'émetteur.
2. Le runtime complet prouve les RPC et triggers PostgreSQL sous JWT simulés avec les rôles Replay ; il ne remplace pas un test navigateur des écrans Client, Assurance, Caisse et ticket sur une pharmacie réelle autorisée. La pharmacie utilisée est une pharmacie de démonstration visible et reste marquée démo.
3. La comptabilité Replay reste vierge : 0 compte, mapping, paramètre et période. Le test worker synthétique valide le moteur et l'idempotence ; il ne produit pas une écriture comptable réelle. Les comptes, journaux, mappings et période doivent être fournis/validés par le Promoteur ou le Comptable de la pharmacie selon le cahier Comptable. Aucun compte OHADA, journal ou mapping n'a été inventé.
4. Le workflow Node/TypeScript/lint/build doit terminer sur la tête finale de `main` ; les résultats SQL ne remplacent pas cette validation applicative.

**État §54 : PARTIEL — PAS AU VERT GLOBAL.** Le flux backend transactionnel Marketplace → Assurance → POS → ticket → remboursements est PASS sur Replay avec rollback complet. L'import du fichier réel, le parcours navigateur sur pharmacie autorisée et la comptabilité réelle restent ouverts. Production et Vercel inchangés.

**Point exact de reprise :** recevoir un export assureur expurgé et un plan/mapping comptable validé par la pharmacie, puis exécuter le téléversement navigateur et la recette UI avec ses rôles autorisés. Aucun changement Production/Vercel sans autorisation expresse.

## 55. Qualité applicative confirmée après corrections Assurance/POS (15/11/2026)

### Cause des échecs CI précédents

Les échecs de la suite Node sur les commits antérieurs au `ab23cdd7ee7ccbe0f5ef11bd1b42d6d9a8e16ea3` concernaient les contrats de test, pas les RPC métier :
- le contrat du runtime POS exigeait encore un Responsable et une Caisse pré-affectés à la même pharmacie non-démo, alors que le scénario validé utilise un compte Caisse existant, une affectation Responsable temporaire dans la transaction et la bascule officielle `naxa_select_active_role` ;
- le test d'import séparait mal les lignes CSV et contrôlait le lien du modèle avec un regex trop échappé ;
- le test split POS contenait un regex invalide pour les apostrophes des appels de sélection de rôle.

Les assertions ont été réalignées sur le scénario effectivement exécuté. Aucune garde métier n'a été supprimée pour faire passer les tests.

### Résultat CI final

- Tête `main` contrôlée : `ab23cdd7ee7ccbe0f5ef11bd1b42d6d9a8e16ea3`.
- Workflow GitHub Actions : [NAXA quality — run 43722220545](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43722220545) — **SUCCESS**.
- Node : **502 tests / 502 PASS / 0 FAIL**.
- TypeScript : **PASS**.
- ESLint : **PASS sans erreur bloquante** ; 106 avertissements non bloquants ont été relevés dans l'ensemble du dépôt (navigation interne via `window.location`, hooks, images et compatibilité React 18 avec Next 16).
- Build Next.js 16.4.6 + Serwist : **PASS**, compilation, génération des routes et worker service terminées.
- Validation `actionlint` de tous les workflows actifs : **PASS**.
- Check Supabase Preview : **CANCELLED** par la limite mensuelle du connecteur Supabase GitHub Preview (1 000 push events atteints). Ce check ne remet pas en cause les migrations Replay appliquées directement via le projet Replay.
- Le build a signalé que Next.js a réécrit les valeurs recommandées de `tsconfig.json` dans le workspace CI ; ce changement local au runner n'est pas un commit source.

### Séparation des preuves Replay

- Le runtime Assurance Marketplace → POS → ticket → remboursements de §54 a PASS avec JWT Auth et rollback.
- État base après vérification : 0 import, ligne d'import, couverture, vérification, convention, règle, snapshot, dossier, proposition, événement ou règlement Assurance.
- Comptabilité : 0 compte, mapping, paramètre, période, événement, écriture ou ligne comptable persistante.
- Un workflow Replay Promoteur E2E distinct, lancé sur l'ancien commit `e48f68d46b013a87a8a28b38eecbf6cbc1af608c`, a préparé des comptes et affectations puis échoué à sa construction avant les étapes Web Push/Storage. Il est antérieur à la correction des tests sur `ab23cdd` ; il ne constitue donc pas une preuve Web Push/Storage réussie.
- Ce workflow E2E distinct a conservé ses propres fixtures de référence : pharmacie technique masquée/non commerciale, compte Responsable et Gestionnaire Stock ; un stock et six lots sont présents sur cette pharmacie. Les profils Caisse/Stock/Livreur de Mvan restent affectés dans leur périmètre. Ces lignes ne sont pas issues du runtime Assurance rollbacké.
- Aucun déploiement Vercel et aucune migration Production.

### Blocages métier restants

1. **Fichier assureur réel** : le modèle CSV est téléchargeable et les colonnes canoniques sont testées, mais aucun export authentique expurgé n'a été fourni. Il faut confirmer les éventuels alias propriétaires et attester le canal de réception ; SHA-256 ne prouve pas l'identité de l'émetteur.
2. **Comptabilité de la pharmacie** : le plan comptable, les mappings, paramètres et périodes Replay sont toujours vides. Aucun compte OHADA, journal ou mapping n'a été inventé. Le Promoteur/Comptable doit fournir et valider les comptes, journaux, sens débit/crédit et période de la pharmacie avant une écriture commerciale réelle.
3. **Recette UI commerciale** : le runtime prouve les RPC, déclencheurs et protections SQL sous JWT de recette ; il ne remplace pas une navigation réelle Client → pharmacie → Caisse → ticket dans le navigateur sur une pharmacie autorisée. La pharmacie utilisée par le runtime POS est une pharmacie de démonstration visible.
4. **Web Push/Storage E2E** : le workflow Promoteur distinct n'a pas atteint ces étapes sur le dernier run observé ; elles restent non confirmées.

**État §55 : CODE ET CONTRATS TECHNIQUES VALIDÉS ; PARCOURS BACKEND ASSURANCE/POS PASS SUR REPLAY ; PAS AU VERT GLOBAL.** La CI applicative est verte sur la tête contrôlée, mais l'import réel, le plan comptable validé par la pharmacie, la recette UI commerciale et Web Push/Storage restent à prouver. Production et Vercel inchangés.

**Point exact de reprise :** recevoir un exemple assureur expurgé et la validation du plan/mappings comptables de la pharmacie ; exécuter ensuite le parcours UI avec les comptes professionnels autorisés. Garder Production et Vercel inchangés sans autorisation expresse.


## 56. Import Assurance, négociation et worker comptable intégré — Replay PASS (15/11/2026)

### Clôture des défauts d'implémentation

Les migrations et pages déjà versionnées dans `main` fournissent maintenant :
- import CSV/XLS/XLSX, simulation avant application, SHA-256 et référence de transmission, contrôles des doublons/ambiguïtés/invalides, modes complet/delta ;
- historique de vérification indépendant par pharmacie, basé sur la dernière liste assureur et la version de déclaration client ;
- propositions financières immuables et versionnées, réponse explicite du Client propriétaire, rejet des réponses par les autres rôles, blocage de la confirmation si une proposition attend ;
- POS fractionné qui reprend le dernier partage accepté, ticket Client qui distingue montant dû et argent effectivement reçu ;
- événements comptables idempotents pour la créance et les remboursements, et vente encaissée limitée à la part Client.

Le modèle CSV d'exemple est fictif et disponible dans `public/modeles/assureur-liste-assures-exemple.csv`. Aucune donnée personnelle réelle n'est incorporée au dépôt.

### Tests Replay de vérification et de runtime

- `supabase/tests/20261115121500_assurance_import_membership_negotiation.sql` — **PASS**.
- `supabase/tests/20261115123000_assurance_import_runtime_multipharmacy.sql` — **8/8 PASS** : import complet/delta, suspension, réactivation, invalidation après correction de déclaration, vérification spécifique à la pharmacie et blocage du devis hors pharmacie.
- `supabase/tests/20261115101000_assurance_amount_proposal_workflow.sql` — **PASS**.
- `supabase/tests/20261115103000_assurance_client_refusal_event_visibility.sql` — **PASS**.
- `supabase/tests/20261115104000_assurance_accounting_event_idempotence_scope.sql` — **PASS**.
- `supabase/tests/20261115130000_assurance_marketplace_pos_ticket_reimbursement_runtime.sql` — **PASS**, seconde exécution après extension au worker comptable.

### Runtime intégré — résultat exact

Le test réutilise un Client Replay et un compte Caisse Replay existants ; une affectation Responsable temporaire est créée dans la transaction et le rôle est activé par la RPC officielle. Le flux sous JWT passe par déclaration de couverture, import synthétique, convention, devis, accord Client, contrôle documentaire, proposition de montant, nouvel accord Client, confirmation de prise en charge, encaissement POS, ticket et deux remboursements.

| Contrôle | Résultat |
|---|---:|
| Total Marketplace brut | 10 000 FCFA |
| Part assureur initiale / part Client initiale | 6 000 / 4 000 FCFA |
| Part assureur acceptée / part Client finale | 5 500 / 4 500 FCFA |
| Espèces remises / monnaie rendue | 5 000 / 500 FCFA |
| Remboursements assureur | 2 000 + 3 500 FCFA |
| Événements passés au worker | 4 |
| Écritures comptables | 4, toutes équilibrées |
| Compte créance assureur | débit 5 500 / crédit 5 500 FCFA |
| Compte espèces Client | débit 4 500 FCFA |
| Compte revenu combiné | crédit 10 000 FCFA |

Le test crée temporairement une période, quatre comptes, six mappings et trois journaux ; il traite réellement les événements d'outbox créés par le parcours et vérifie les quatre écritures du grand livre. Le tout se termine par `ROLLBACK`.

### Nettoyage post-test

Le contrôle Replay après test donne :
- 0 import, ligne d'import, vérification, couverture, convention, snapshot, dossier, proposition ou règlement ;
- 0 réservation et vente de recette ; 0 événement comptable en attente ;
- 0 période, compte, mapping, paramètre, événement comptable, écriture ou ligne ;
- 0 stock/coût/lots de test persistants ;
- rôle Caisse rétabli, affectation Responsable temporaire retirée.

### État des derniers verrous

<badge color="success">Backend métier + worker comptable : PASS Replay</badge>

Restent hors de portée d'une fixture synthétique :
1. réception d'un export réel (expurgé) transmis par un assureur pour confirmer ses en-têtes/alias propriétaires et son canal de provenance ;
2. test navigateur réel Client → Assurance → Caisse/ticket sur une pharmacie non-démo explicitement autorisée et avec comptes métier réels ;
3. plan, mappings, paramètres, journaux et période comptables réellement validés par le Promoteur/Comptable de la pharmacie ;
4. workflow qualité GitHub sur le commit final de cette documentation (actionlint déjà PASS ; Node/TypeScript/lint/build en cours).

**État §56 : PARTIEL — PAS AU VERT GLOBAL.** Les défauts de code du parcours Assurance et l'intégration du worker comptable sont corrigés et testés. Les preuves externes/commerce réel et la validation CI finale restent à obtenir. Production et Vercel inchangés.


## 57. Secrets Replay stricts, Web Push Chromium et qualité applicative — PASS partiel (15/11/2026)

### Cause de sécurité corrigée

Le workflow `.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml` pouvait auparavant se rabattre sur des secrets Supabase génériques si les secrets dédiés Replay n'étaient pas présents. Un contrôle d'URL Replay ne suffisait pas à démontrer que la clé Admin venait du même projet.

**Corrections sur `main` :**
- `ae38fb7aa54c62293081789ea2eafcc6d213b50e` : suppression des replis génériques ; URL, clé anonyme et clé Admin exigent exclusivement `NAXA_STORAGE_E2E_URL`, `NAXA_STORAGE_E2E_ANON_KEY` et `NAXA_STORAGE_E2E_ADMIN_KEY`. Le préflight vérifie les trois valeurs et refuse toute URL autre que `https://pwfftcsjyeibxxqhwysw.supabase.co`. Le serveur local mappe uniquement la clé Admin Replay vers `SUPABASE_SECRET_KEY` et la masque dans les logs.
- `86ac0c92e2a0b61857059fb08dc9f16c0a1f43e3` : le test statique vérifie littéralement l'absence des références aux secrets génériques et protège le contrat de mapping Replay.

Aucune valeur de secret n'est écrite dans Git ou dans ce document.

### Qualité CI sur la tête contrôlée

Run [NAXA quality — 43725341495](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43725341495), commit `86ac0c92e2a0b61857059fb08dc9f16c0a1f43e3` : **SUCCESS**.
- Tests Node : **504 PASS, 0 FAIL, 0 SKIP** ; les tests ont également été rejoués pendant le `prebuild` avec le même résultat.
- TypeScript : PASS ; ESLint : PASS ; build Next.js sous Node 22 : PASS.
- `actionlint` sur tous les workflows actifs : PASS.

Deux avertissements non bloquants restent visibles au build : le module ESM `serwist.config.js` n'a pas de type déclaré dans `package.json`, et Next.js 16 annonce la dépréciation future du support React 18. Ils ne bloquent ni la suite ni le build ; aucune migration React majeure n'est introduite dans cette clôture.

### Recette E2E Replay complémentaire

Run [NAXA Replay Promoteur E2E — 43724897870](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43724897870), commit `6bb4db0d4aa567a921838324aeb64469cce2ff08` : **SUCCESS**.
- Dispatcher J-3 : Promoteur, Gestionnaire Stock et Responsable ; trois souscriptions authentifiées créées par Chromium.
- Worker NAXA : **3 envois Web Push ciblés** et **3 notifications constatées dans le Service Worker Chromium**. Cela prouve une réception navigateur, pas une réception FCM sur un téléphone Android physique.
- Storage E2E : **17 PASS, 0 SKIP**, matrices Admin et Promoteur incluses.
- Nettoyage Storage : objets, sessions de test, comptes temporaires et fichiers de mots de passe éphémères nettoyés avec traces `CLEANUP PASS`.

Le workflow relancé avec les secrets Replay strictement dédiés, run [43725341532](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43725341532) sur `86ac0c9`, est encore en cours au moment de cette mise à jour ; ne pas le compter PASS avant sa conclusion.

### Verrous métier toujours ouverts

1. **Assureur :** recevoir un export authentique expurgé pour confirmer ses en-têtes/alias propriétaires et son canal de provenance. Le SHA-256 prouve l'intégrité, pas l'identité de l'émetteur.
2. **Recette commerciale :** parcourir les écrans Client → Assurance → Caisse/ticket avec les vrais comptes métier et une pharmacie non-démo explicitement autorisée. Les tests backend et les fixtures Replay ne remplacent pas cette validation.
3. **Comptabilité réelle :** le Promoteur ou le Comptable de la pharmacie doit valider son plan, ses mappings, ses paramètres, ses journaux et sa période. Aucun paramétrage comptable réel n'est inventé.

**Verdict : PARTIEL — PAS AU VERT GLOBAL.** Le parcours backend Assurance → Marketplace → Caisse → ticket → remboursements → worker comptable est PASS sur Replay (§56) ; la qualité applicative et la validation de tous les workflows sont PASS sur `86ac0c9`. Le workflow Replay strict est encore en cours et les trois validations métier externes restent ouvertes. Production et Vercel inchangés.


## 58. Audit d'intégration du poste Pharmacien — PASS SQL ciblé, parcours métier partiel (15/11/2026)

### Périmètre et source

- Audit effectué sur le dépôt `main`, HEAD contrôlé : `e660ca84e2cca4505e02ca84fdf9f3dfb50f0357`.
- Base QA utilisée exclusivement : Replay `pwfftcsjyeibxxqhwysw`. Aucune écriture Production et aucun déploiement.
- Sources contrôlées : `src/components/EspaceNaxaSwitcher.tsx`, `src/app/pharmacie/affectations/actions.ts`, `src/app/pharmacie/affectations/page.tsx`, `src/components/pharmacie/PharmacienWorkspace.tsx`, `src/app/pharmacie/pharmacien/service/page.tsx`, `src/components/ScannerShell.tsx`, `src/components/client/ClientOperations.tsx`, migrations et policies Pharmacien, ainsi que `supabase/tests/297_active_role_pharmacien_e2e.sql`.

### Branchement présent et contrôlé

- Le rôle `pharmacien` est déclaré actif et assignable pour le périmètre `PHARMACIE`.
- Le Promoteur peut attribuer le rôle depuis la page Affectations ; le sélecteur global `EspaceNaxaSwitcher` détecte l'affectation active, appelle `naxa_select_active_role` puis ouvre `/pharmacie/pharmacien`.
- Le workspace valide l'utilisateur authentifié, la fonction métier active, la pharmacie sélectionnée et l'état actif de la pharmacie.
- Les RPC Pharmacien vérifient le poste et le périmètre actif pour les consultations, prescriptions, demandes de complément, décisions de validation, préparations, pointages de service et exports audités.
- Le garde `vente_prescription_guard` bloque une vente si la prescription n'est pas validée, est expirée, appartient à une autre pharmacie ou ne correspond pas au Client. Le RPC `ordonnancier_enregistrer` accepte également un poste Pharmacien actif dans la pharmacie de la prescription.
- Les politiques RLS sont présentes sur les tables cliniques, les sessions et les événements d'audit. Plusieurs lectures utilisent encore les alias synchronisés `profiles.fonction_interne` et `profiles.pharmacie_id` ; le sélecteur de poste actif met ces champs en cohérence avec l'affectation choisie.

### Preuve SQL Replay — 8/8 PASS

Le fichier `supabase/tests/297_active_role_pharmacien_e2e.sql` a été exécuté directement sur Replay. Les assertions ont confirmé :
1. création d'une consultation par le compte portant le poste Pharmacien ;
2. création d'une prescription liée à la consultation et validateur cohérent ;
3. export Pharmacien journalisé ;
4. lecture des prescriptions dans le périmètre actif ;
5. ouverture et clôture d'une session de service ;
6. affectation Pharmacien sans convertir l'identité de base, qui reste Client ;
7. refus d'agir dans une autre pharmacie ;
8. blocage des RPC Pharmacien après retour au poste Client.

Le script se termine par `ROLLBACK`. Le contrôle post-test confirme zéro résidu : 0 profil alias Pharmacien, 0 affectation Pharmacien active, 0 entrée de rôle actif Pharmacien, 0 dossier `suivi_professionals` et 0 accréditation hiérarchique. Aucun compte métier permanent n'a donc été provisionné sur Replay.

### Contradictions et blocages de bout en bout

1. **Affectation et agrément Admin non raccordés.** La page Promoteur `/pharmacie/affectations` accorde directement une affectation Pharmacien active via `naxa_grant_professional_assignment`. Le contrôle documentaire Admin existant sur `/admin/suivi-professionnels` gère `suivi_professionals`, table sans `pharmacie_id`, utilisée par le Suivi connecté ; il n'est pas consulté par le moteur d'affectations Pharmacie. Le contrôle « proposition Promoteur → validation Admin → activation Pharmacien » n'est donc pas imposé par le flux ERP observé.
2. **Entrée Client → file Pharmacien non reliée dans les écrans vérifiés.** Le scanner `ScannerShell` réalise une lecture OCR locale, cherche des produits dans le catalogue et conduit à la recherche de pharmacies ; il n'insère pas de ligne dans `prescriptions`. `ClientOperations` charge les réservations et leurs événements, pas les prescriptions. La policy SQL `prescriptions_client_submit` permet une insertion Client encadrée, et le workspace Pharmacien sait lire les prescriptions `source='client'`, mais aucun formulaire/flux de soumission correspondant n'a été trouvé dans les écrans Client examinés. Le transfert réel d'une ordonnance Client vers la file Pharmacien n'est donc pas démontré.
3. **Ancienne route distincte non raccordée à Replay.** `/pharmacien/validations` appelle `naxa_validations_pharmaceutiques`, `naxa_validations_pharmaceutiques_notifications` et trois RPC `naxa_*validation_pharmaceutique` absents du schéma Replay contrôlé. Cette route ne doit pas être confondue avec le workspace opérationnel `/pharmacie/pharmacien`.
4. **Ordonnancier : asymétrie lecture/RPC à conserver sous surveillance.** La policy directe `ordonnancier_staff_read` n'accorde pas le SELECT au rôle `pharmacien`, mais le RPC `ordonnancier_enregistrer` l'autorise explicitement lorsque le poste et la pharmacie actifs correspondent. Le workspace Pharmacien actuel n'effectue pas de lecture directe de cette table ; ce n'est donc pas un échec prouvé du flux actuel, mais toute future interface de consultation directe devra aligner sa policy RLS.
5. **Recette avec identité réelle absente.** Replay ne contient aucun compte, affectation ni rôle actif Pharmacien permanent. Le test 297 est un test transactionnel SQL avec rollback, pas une recette navigateur multi-comptes ; build, TypeScript et navigation UI n'ont pas été exécutés dans cet audit.

### Verdict et point exact de reprise

**PARTIEL — le sélecteur de rôle, les gardes serveur et les RPC Pharmacien essentiels passent le contrat SQL 297 (8/8), mais l'intégration globale n'est pas verte.** Les principaux verrous sont l'agrément Admin avant activation ERP et la soumission effective des ordonnances par le Client. L'ancienne route de validations pharmaceutiques séparée doit également être réconciliée ou retirée.

**Reprise recommandée :** traiter d'abord la machine d'état d'agrément Pharmacien (proposé par Promoteur, vérifié/accepté par Admin, puis activable pour une pharmacie), sans réutiliser comme source d'autorité le module Suivi connecté ; ensuite brancher le dépôt Client d'ordonnance sur la table et les RPC canoniques, puis réaliser une recette navigateur avec deux pharmacies et des comptes métier dédiés.

Aucun code produit n'a été modifié dans cet audit. Aucun changement persistant n'a été effectué dans Replay ; Production et Vercel restent inchangés.



## 58. Audit Crédit / prêt Marketplace, comptoir et profils pharmacie — PARTIEL / NO-GO (15/11/2026)

**Périmètre contrôlé :** commit source e660ca84e2cca4505e02ca84fdf9f3dfb50f0357, branche main ; base naxa-ci-replay-2 (pwfftcsjyeibxxqhwysw) uniquement. Audit en lecture et tests transactionnels annulés. Aucune écriture métier persistante, migration Production, modification de Production ou déploiement Vercel.

### Parcours présent et raccordements prouvés dans le code

- **Client → Marketplace :** DemandeCreditMarketplaceForm transmet le panier, la pharmacie, le téléphone, l'échéance et un justificatif PDF/JPG/PNG/WebP de 10 Mo maximum à client_credit_marketplace_soumettre. Le serveur vérifie le profil Client actif, la pharmacie, le fichier propriétaire et son MIME, les quantités, l'offre/stock disponible, le compte crédit actif et l'absence d'un autre crédit ou d'une demande non consommée en cours.
- **Décision Promoteur / Responsable :** le Promoteur consulte les demandes origine=marketplace. Le Responsable ne voit que ses pharmacies affectées et ne reçoit les boutons de décision que si naxa_can_approve_marketplace_credit confirme son privilège APPROVE_MARKETPLACE_CREDIT sur la pharmacie concernée. La RPC de décision revérifie les droits côté serveur.
- **Approbation → Stock :** l'approbation crée une réservation, contrôle les lots FEFO, écarte les lots bloqués/périmés, débite le stock et marque la réservation stock_decremented=true. Le Gestionnaire Stock retrouve les réservations à préparer dans son espace et peut faire avancer leur préparation.
- **Retrait Marketplace à la pharmacie :** le vrai poste /pharmacie/caisse importe CaisseRetraitsMarketplace. Pour une réservation liée à un crédit approuvé, le caissier doit avoir une session ouverte, retrouver le code/QR, puis appeler vente_reservation_credit_finaliser. Le parcours distingue ce retrait sans encaissement comptant du paiement classique et permet ensuite de confirmer la remise des produits.
- **Remboursement :** l'écran Caisse « Clients & crédits » liste les encours et appelle la signature structurée client_credit_rembourser(uuid,integer,mode_paiement_caisse,text,text). Le serveur limite actuellement ce remboursement aux espèces, contrôle le montant et exige une session de caisse ouverte, active, de la même pharmacie et ouverte par l'utilisateur courant.
- **Sécurité :** RLS est activé sur client_credits, client_credit_requests et client_credit_operations. Les lectures sont limitées au Client propriétaire, à l'Admin ou aux comptes pouvant accéder à la pharmacie ; les écritures métier passent par les RPC SECURITY DEFINER. Les anciennes signatures de remboursement sont neutralisées.

### Contradictions et défauts bloquants

1. **Crédit direct au comptoir absent de l'interface opérationnelle.** Le vrai écran /pharmacie/caisse n'offre qu'un encaissement espèces (vente_encaisser_finaliser). Il ne propose ni sélection d'un Client pour l'achat à crédit, ni choix du mode crédit, ni appel à client_credit_demander / client_credit_enregistrer_vente. L'écran /pharmacie/caisse/clients consulte les encours et encaisse les remboursements ; il ne crée pas un crédit. Les boutons « Crédit client » de caisse/parcours-ui appartiennent à une maquette : leurs actions appellent demoAction et ne modifient aucune donnée métier.
2. **La file de décision ne couvre pas le crédit issu de la Caisse.** Les pages Promoteur et Responsable filtrent explicitement origine=marketplace. Or la RPC client_credit_demander peut créer des demandes origine=caisse quand un achat dépasse le plafond. Ces demandes ne sont donc pas présentées dans les écrans de décision actuels. client_credit_configurer existe côté base, mais aucune interface opérationnelle identifiée ne permet au Promoteur de créer/configurer un compte et son plafond pour un Client.
3. **Retrait Marketplace : double débit physique reproduit.** vente_reservation_credit_finaliser crée la vente POS sans positionner ventes.stock_decremented_at_draft=true, alors que le stock avait déjà été diminué à l'approbation. Lors du passage de la vente à payee, le trigger naxa_pos_debit_before_sale_paid rappelle private.naxa_pos_debit_stock et tente de débiter une seconde fois. Le test transactionnel supabase/tests/259_credit_withdrawal_inverse_order_e2e.sql échoue réellement sur Replay avec « Stock physique insuffisant à la validation de caisse ». Le retrait à crédit Marketplace n'est donc pas AU VERT.
4. **Intégration comptable du crédit incomplète sur Replay.** La fonction active compta_emettre_evenement_metier ne filtre pas explicitement les ventes mode_paiement=credit. L'émetteur compta_emettre_octroi_credit() et son trigger nature=credit sont absents. L'émetteur de remboursement existe, mais le worker actif compta_traiter_evenement n'accepte pas credit_octroi / credit_remboursement. Les tests 249_credit_repayment_accounting.sql et 253_marketplace_credit_accounting.sql échouent sur ces contrats. La migration historique migration_253_marketplace_credit_accounting.sql qui contient une partie de ce raccordement n'apparaît pas dans les migrations appliquées au Replay ; elle ne doit pas être réappliquée telle quelle, car elle remplacerait le worker comptable plus récent et risquerait de retirer les prises en charge Assurance et annulation de vente. Il faut une migration cumulative qui conserve tous les types d'événements actuels et ajoute le crédit.
5. **Comptabilité non paramétrée pour le crédit sur Replay.** Le contrôle des données de configuration retourne zéro mapping credit_octroi, zéro mapping credit_remboursement, zéro journal pour ces deux événements et zéro période comptable. Même après correction du worker, aucun posting réel ne peut être qualifié de validé tant que le Promoteur/Comptable n'a pas configuré et validé les comptes, journaux, mappings et périodes de la pharmacie.

### Résultats des contrôles Replay

**Contrats PASS :**
- 051_client_credit.sql
- 247_credit_marketplace_stock_contract.sql
- 250_caisse_credit_repayment_reconciliation.sql
- 251_credit_hold_no_physical_decrement.sql
- 252_marketplace_credit_withdrawal.sql
- 254_credit_repayment_payment_mode.sql
- 255_credit_repayment_legacy_guard.sql
- 256_credit_withdrawal_reserved_lots.sql

**Échecs à ne pas interpréter comme défauts métier confirmés :**
- 248_credit_repayment_cash_session.sql appelle l'ancienne signature à quatre arguments, désormais interdite. La signature structurée à cinq arguments est celle utilisée par l'interface actuelle et elle vérifie la session personnelle ; le test 248 doit être actualisé.
- 257_credit_withdrawal_five_scenarios.sql vérifie encore des fragments SQL littéraux de l'ancien code (dont current_date) alors que le contrat courant s'appuie notamment sur private.naxa_date_cameroun(). Le test statique doit être réaligné ; son échec isolé ne prouve pas une absence de contrôle de péremption.
- 264_credit_marketplace_debit_on_approval_e2e.sql s'arrête pendant la création des produits de fixture : le JWT est encore celui d'un Responsable sans privilège lorsque le trigger propriétaire de fiche contrôle l'insertion. Le harnais doit repasser sous l'acteur Admin pour préparer les produits ; ce résultat ne valide ni n'invalide encore les assertions E2E de décision et de retrait.

**État des données Replay au contrôle :** aucune demande, aucun compte crédit et aucune opération de crédit persistants. Aucun mapping/journal/période comptable de crédit. Les tests exécutés sont des contrats SQL ou des transactions annulées ; aucune navigation navigateur Client → Promoteur/Responsable → Stock → Caisse → remboursement n'a été validée dans une session métier réelle.

### Verdict et reprise exacte

**VERDICT : PARTIEL — NO-GO / PAS AU VERT.** Le crédit Marketplace dispose d'un parcours Client, d'une validation Promoteur/Responsable déléguée, d'une préparation Stock, d'un retrait Caisse et d'un remboursement. Mais le double débit au retrait est reproduit, l'intégration du worker comptable est incomplète, et le crédit direct au comptoir n'est pas implémenté dans l'interface opérationnelle ni sa file de décision. Il serait incorrect de certifier cette fonctionnalité de bout en bout.

**Correctifs à traiter dans cet ordre :**
1. Corriger le drapeau de stock de la vente créée par vente_reservation_credit_finaliser uniquement lorsque la réservation a déjà été physiquement débitée, puis rejouer les tests 259 et 264.
2. Ajouter une migration comptable cumulative : exclure le crédit des encaissements ventes, émettre l'octroi, conserver l'émission remboursement et étendre le worker sans régression Assurance/annulation ; tester l'outbox et le worker.
3. Brancher le vrai parcours Caisse direct : sélection/identification Client, configuration Promoteur du plafond, choix crédit, validation sous plafond ou demande au-delà du plafond, file de décision Promoteur et mise à jour de l'encours/ticket/session.
4. Mettre à jour les tests 248, 257 et 264 pour vérifier les contrats courants, puis exécuter les scénarios E2E complets avec les profils autorisés et une pharmacie Replay contrôlée.
5. Faire valider les mappings et journaux réels par le Promoteur/Comptable avant toute certification comptable commerciale.

Aucune correction de logique applicative ou migration n'a été appliquée pendant cet audit ; seule cette preuve de reprise est ajoutée. **Production, Vercel et Play Store restent inchangés.**


## 59. Crédit Marketplace + crédit direct Caisse — correctifs intégrés et recette Replay (15/11/2026)

**Tête applicative contrôlée avant cette mise à jour documentaire :** 43b09e5559633fefdc4a8853afdab435035c9fa4 sur main. **Replay uniquement :** pwfftcsjyeibxxqhwysw. Aucune migration Production, aucun déploiement Vercel, aucun déploiement Play Store.

### Correctifs intégrés

1. **Vente à crédit au comptoir :** /pharmacie/caisse charge les comptes de crédit actifs de la pharmacie, permet de choisir le Client avant la création du panier, associe ce Client à la vente POS et expose la finalisation à crédit. vente_credit_finaliser(uuid,text) vérifie la session personnelle, le compte actif, le solde/plafond et l'état du panier. Sous plafond, la vente est finalisée et le débit POS reste dans le déclencheur de vente ; au-delà, une demande origine='caisse' est créée sans paiement ni mouvement de stock, puis le même brouillon peut être repris après approbation.
2. **Configuration Promoteur :** l'espace Promoteur permet de créer/modifier le plafond d'un Client et de configurer le plafond maximal délégué à un Responsable, par pharmacie. Les RPC revérifient le Promoteur valide, le lien réseau, le compte Client/Responsable actif et l'affectation Responsable.
3. **Décision Promoteur / Responsable :** les deux listes couvrent origine='marketplace' et origine='caisse'. Le moteur serveur refuse une approbation Responsable sans privilège actif ou au-delà du plafond délégué ; l'interface Responsable calcule le droit pour chaque demande et son montant.
4. **Retrait Marketplace :** correction de la séquence POS : la vente est marquée stock_decremented_at_draft=true avant le passage à payee, après que le RPC de retrait a géré le débit ou réutilisé le débit d'approbation. Le trigger générique POS ne tente plus de débiter une seconde fois.
- **Suivi Client :** `/achats/credit/suivi` expose désormais les comptes de crédit et leurs soldes/plafonds, toutes les demandes `marketplace` et `caisse`, le journal des opérations d'octroi et de remboursement, et les reçus. Commit `16398379e3b8fb06c2a38e34d26382ffb90ec8f9`.

5. **Comptabilité :** une vente en mode credit n'est pas émise comme encaissement vente_encaissee. Les opérations nature='credit' créent un événement d'outbox credit_octroi idempotent. Le worker conserve ses types Assurance/annulation et accepte aussi credit_octroi et credit_remboursement. L'émetteur de remboursement déjà présent reste lié à l'outbox et au worker.

### Migrations Replay appliquées

- supabase/migrations/20261115220000_credit_marketplace_pos_accounting_integration.sql — commit 228f7f01b17e22928a8c8bfae2f7a303d359d247.
- supabase/migrations/20261115223000_credit_pos_double_debit_and_responsible_assignment_fix.sql — commit f261592877e8e61b3bcf14009d997b68ade78df0.

Les deux migrations ont passé leur dry-run transactionnel avant application ; l'historique Replay confirme leur présence. Les fonctions/RPC, trigger d'octroi et worker ont été relus après application.

### Recette SQL exécutée sur Replay

**PASS :**
- 051_client_credit.sql
- 247_credit_marketplace_stock_contract.sql
- 248_credit_repayment_cash_session.sql (contrat et session personnelle ; aucune erreur, sortie SQL vide)
- 249_credit_repayment_accounting.sql
- 250_caisse_credit_repayment_reconciliation.sql
- 251_credit_hold_no_physical_decrement.sql
- 252_marketplace_credit_withdrawal.sql
- 253_marketplace_credit_accounting.sql
- 254_credit_repayment_payment_mode.sql
- 255_credit_repayment_legacy_guard.sql
- 256_credit_withdrawal_reserved_lots.sql
- 257_credit_withdrawal_five_scenarios.sql
- 259_credit_withdrawal_inverse_order_e2e.sql — **PASS transactionnel**, deux retraits dans l'ordre inverse, sans double débit.
- 264_credit_marketplace_debit_on_approval_e2e.sql — **PASS transactionnel**, Responsable affecté, privilège, plafond, refus hors plafond, approbation, allocation/restauration FEFO, retraits POS sans double débit.
- 20261115220000_credit_marketplace_pos_end_to_end.sql — **PASS transactionnel**, demande caisse au-delà du plafond sans débit, approbation, reprise du même draft, vente à crédit et mise à jour du solde ; crédit sous plafond finalisé directement ; émission credit_octroi sans vente_encaissee.

Tous les scénarios E2E SQL ci-dessus sont annulés par ROLLBACK.

**Contrôle de propreté post-recette Replay :** 0 demande crédit, 0 compte crédit, 0 opération crédit, 0 plafond Responsable, 0 événement comptable crédit et 0 vente E2E-CREDIT-POS persistants. Les fixtures n'ont donc pas été laissées dans le projet.

### GitHub Actions lancées

- [NAXA quality — run 3321](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43760589972), commit e67d066 : **SUCCESS**. Node : **511/511 PASS, 0 FAIL** (tests rejoués aussi pendant le prebuild) ; TypeScript : PASS ; ESLint : PASS ; build Next.js/Serwist : PASS ; actionlint sur les workflows actifs : PASS. Le run 3319 précédent sur c277bff avait détecté le narrowing de panier_items dans les écrans Promoteur/Responsable ; les deux erreurs ont été corrigées avant ce run réussi.
- [NAXA quality — run 3325](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43760955745), commit 43b09e5 : **en cours au contrôle**, après l'ajout du solde/journal au suivi Client. Le job actionlint a déjà PASS ; attendre tests/TypeScript/lint/build avant verdict sur cette tête.
- [NAXA Replay Promoteur E2E — run 124](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43760589933), commit e67d066 : **SUCCESS**. Préparation des comptes et affectations Promoteur/Admin/Client/Livreur/Gestionnaire Stock/Caisse/Responsable : PASS. Web Push : **3 envois ciblés et 3 notifications constatées dans le Service Worker Chromium** (preuve navigateur, pas FCM Android physique). Storage E2E : **17 PASS, 0 SKIP**, y compris matrices Admin et Promoteur. Nettoyage : objets, sessions, comptes temporaires et fichiers secrets éphémères nettoyés avec `CLEANUP PASS`.
- [NAXA Replay Promoteur E2E — run 125](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43760955655), commit 43b09e5 : **en cours au contrôle** pour retester la tête qui contient aussi la nouvelle page Suivi Client. Préflight, profils et affectations jusqu'au Responsable : PASS ; Chromium en cours.
- Le workflow Replay est désormais déclenché par les chemins du chantier crédit/prêt (écrans Caisse/Promoteur/Responsable, migrations et tests crédit) ainsi que par les changements du workflow lui-même.

### Réserves encore ouvertes — pas de feu vert global

1. **Remboursement runtime complet :** l'interface appelle le RPC structuré avec mode espèces, montant borné au solde et session personnelle ; les contrats 248/249/250/254/255 passent. Toutefois, le test transactionnel qui ajoutait un appel réel à client_credit_rembourser a été bloqué par le contrôle de sécurité de l'outil SQL ; le remboursement complet n'est donc pas déclaré PASS runtime dans cette passe.
2. **Comptabilité commerciale :** l'octroi et le remboursement sont maintenant émis et pris en charge par le worker, mais Replay n'a aucun mapping credit_octroi, aucun mapping credit_remboursement, aucun journal pour ces événements et aucune période comptable. Aucun posting au grand livre ne peut être déclaré PASS avant validation du plan, des mappings, journaux et périodes par le Promoteur/Comptable de la pharmacie.
3. **Recette navigateur crédit :** le test direct comptoir couvre les RPC et transactions sous fixtures Admin/Client avec rollback ; le test 264 couvre l'approbation Responsable. Aucune navigation réelle complète dans le navigateur avec une vraie session Caisse, un Promoteur/Responsable connecté et le Client correspondant n'est encore attestée par cette recette.
4. **Actions :** run qualité 3321 : SUCCESS ; Replay E2E 124 : SUCCESS ; run Replay 125 : FAIL Web Push Responsable ; qualité 3332 et Replay 128 restent en cours sur des têtes plus récentes ; Replay 129 est en attente avec diagnostic de compteurs. Leurs conclusions doivent être ajoutées avant tout feu vert global.

**VERDICT : CODE ET BACKEND CRÉDIT CORRIGÉS ; RECETTE SQL CIBLÉE PASS ; PARTIEL / PAS AU VERT GLOBAL.** Les défauts de crédit au comptoir, de file de décision caisse, de plafond Responsable, de double débit Marketplace et d'émission comptable du crédit sont corrigés et testés sur Replay. Les preuves navigateur, remboursement runtime et paramétrage comptable réel restent nécessaires. Production et Vercel inchangés.


## 60. Projection Caisse des identités Client crédit et état des Actions (15/11/2026)

**Tête source au contrôle :** 988ef63b08f8b338bc401a222908faa3be651144 sur main. Replay uniquement.

### Correctif de confidentialité Caisse

Le chargement de /pharmacie/caisse ne lit plus directement public.profiles pour récupérer les noms des Clients crédit, car la politique RLS ne permet pas à un compte Caisse standard de lire les profils Client. Cette limite aurait laissé des références UUID dans le sélecteur.

- Migration supabase/migrations/20261115224500_credit_cashier_client_identity_projection.sql appliquée à Replay après dry-run transactionnel.
- Nouvelle RPC public.caisse_credit_clients_lister(uuid) : SECURITY DEFINER, exécution réservée aux comptes authentifiés, contrôles Admin ou naxa_caisse_actor_for_pharmacy, et projection limitée aux Clients actifs avec un compte crédit actif dans la pharmacie demandée. Seuls ID, solde, plafond, prénom, nom, téléphone et username sont retournés.
- /pharmacie/caisse appelle cette RPC ; aucun droit général de lecture de profiles n'a été accordé au rôle Caisse.
- Test versionné supabase/tests/20261115224500_credit_cashier_client_identity_projection.sql : **PASS** sur Replay.
- Contrôle sous JWT d'un profil Caisse Replay : naxa_caisse_actor_for_pharmacy(pharmacie)=true, RPC autorisée dans sa pharmacie (0 compte crédit existant pour cette fixture) ; tentative de lecture de l'autre pharmacie refusée. Ces vérifications ont été faites dans des transactions annulées et n'ont créé aucune donnée.

Le parcours Client /achats/credit/suivi affiche également comptes, soldes, plafonds, demandes Marketplace et comptoir, journal des octrois/remboursements et reçus.

### État des Actions GitHub après les derniers commits

- [NAXA quality — run 3321](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43760589972) : **SUCCESS** sur e67d066 ; 511/511 tests Node PASS, TypeScript, ESLint, build Next.js/Serwist et actionlint PASS. Ce run est antérieur au dernier ajustement UI Caisse/Client.
- [NAXA Replay Promoteur E2E — run 124](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43760589933) : **SUCCESS** ; 3 notifications Web Push constatées dans Chromium et Storage 17 PASS / 0 SKIP ; nettoyage PASS.
- [NAXA Replay Promoteur E2E — run 125](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43760955655) : **FAIL** à l'étape Web Push ciblée Responsable (réponse HTTP 200 mais assertion des compteurs d'envoi non satisfaite) ; Storage ignoré à cause de cet échec ; étape de nettoyage exécutée. La cause exacte (réclamation, canal ou envoi) n'est pas encore déterminée.
- [NAXA Replay Promoteur E2E — run 128](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43761405941) : en cours au dernier contrôle, build du worker de notifications après préflight et préparation des rôles.
- [NAXA Replay Promoteur E2E — run 129](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43761646776) : en attente ; ajoute au message d'échec les compteurs non sensibles claimed/sent/retried/failed/webPushSent/fcmSent pour diagnostiquer le cas Responsable sans affaiblir l'assertion.
- [NAXA quality — run 3332](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43761646622) : en cours sur la tête 988ef63 ; actionlint PASS, job Node/TypeScript/lint/build en cours.

### Verdict

**Crédit Marketplace / comptoir : BACKEND ET RÈGLES SQL CIBLÉES PASS ; CONFIDENTIALITÉ Caisse PASS ; ENSEMBLE PARTIEL / PAS AU VERT GLOBAL.** Les demandes Marketplace et comptoir, plafonds Promoteur/Responsable, reprise POS, double débit et outbox comptable sont raccordés et testés sur Replay. La dernière projection d'identité Caisse est contrôlée et le refus inter-pharmacies est prouvé.

Restent non validés : remboursement runtime de bout en bout (le test RPC direct avait été bloqué par le garde-fou d'exécution SQL), paramétrage réel des mappings/journaux/périodes de crédit par le Promoteur/Comptable, navigation navigateur crédit complète, et conclusion des Actions 128/129/3332. Le run 125 a révélé un échec Web Push transversal à isoler ; le run 124 précédent était vert. Production, Vercel et Play Store inchangés.



## 61. Reprise crédit après contrôles GitHub — état des recettes (15/11/2026)

**Tête `main` au démarrage de cette reprise :** `11477b90d2e2d7f170e987f3e3731dcdc3fcdc8b`. Les sections §59 et §60 restent le dossier des correctifs applicatifs, migrations Replay et tests SQL du crédit. Cette section ne déclare pas de nouveau correctif code : elle met à jour les preuves Actions et fixe le plan d'achèvement.

### Actions Replay E2E — résultat actualisé

- [Run 128 — 43761405941](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43761405941) : **FAIL** à l'étape de réception Web Push via Chromium pour le Responsable. Préflight, comptes/affectations, installation Chromium et build du worker sont PASS ; Storage a été ignoré à cause de l'échec ; nettoyage des fichiers secrets terminé.
- [Run 129 — 43761646776](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43761646776) : **SUCCESS**. Le même ensemble de préparation passe ; dispatcher péremption J-3 : Promoteur, Gestionnaire Stock et Responsable ; worker : **3 envois Web Push ciblés / 3 notifications reçues dans le Service Worker Chromium**. La mention du log confirme explicitement qu'il ne s'agit pas d'une preuve de réception Android FCM physique.
- Storage lancé ensuite dans le même run : **17 PASS, 0 SKIP**, comprenant les scénarios Admin et Promoteur multi-pharmacies. Objets, sessions métiers, sessions temporaires, comptes temporaires et fichiers secrets ont tous été nettoyés avec `CLEANUP PASS`.

**Interprétation :** l'échec Web Push du run 128 n'est pas reproduit au run 129. La réception Web Push Chromium du scénario de péremption est donc PASS sur ce run. La cause racine du run 128 n'est pas déterminée ; ne pas le réécrire rétroactivement en succès. Aucune preuve FCM sur appareil Android physique n'est ajoutée.

### Actions qualité — état vérifié

- [Run 3332 — 43761646622](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43761646622) : **CANCELLED** pour le job « Tests, TypeScript et lint » ; le job actionlint est PASS. Il ne constitue pas une qualité générale PASS.
- Le statut combiné GitHub du commit documentaire `11477b90d2e2d7f170e987f3e3731dcdc3fcdc8b` n'expose aucun status context dans l'API consultée. Aucun identifiant de run qualité plus récent ni conclusion terminale n'a pu être confirmé dans ce contrôle. La qualité post-dernier code UI reste donc **NON CONFIRMÉE**, pas PASS et pas nécessairement FAIL.
- Le run qualité 3321 (511/511 Node, TypeScript, ESLint, build Next.js/Serwist et actionlint PASS) précède les ajustements ultérieurs Caisse/identité Client et ne suffit pas à valider la tête actuelle.

### Manquements restants à fermer

1. **Remboursement runtime.** Les tests 248/249/250/254/255 valident les signatures, contraintes de session et contrats comptables ; la tentative d'appel runtime depuis le canal SQL a été bloquée par le garde-fou. Il faut faire exécuter le vrai RPC par un compte Caisse authentifié en Replay, sur un compte crédit et une session de caisse contrôlés, via le harnais E2E (ou un test SQL transactionnel si l'appel peut être effectué sans contournement du garde-fou). Vérifier solde avant/après, opération remboursement, mode/caisse_session_id, reçu, événement outbox, et nettoyage final.
2. **Posting comptable.** L'outbox `credit_octroi` / `credit_remboursement` et la prise en charge worker sont câblées (§59), mais aucune preuve n'établit encore un posting réel sur un journal et une période valides. Distinguer deux preuves : (a) un test transactionnel avec comptes/journaux/mapping/période purement temporaires pour vérifier débit/crédit et équilibre, entièrement annulé ; (b) la configuration réelle par le Promoteur/Comptable de chaque pharmacie. Ne jamais fabriquer ou préconfigurer des comptes commerciaux à sa place. Tant que la configuration réelle n'existe pas, le critère comptabilité commerciale reste conditionnel et le go-live global est bloqué.
3. **Parcours navigateur crédit.** Les Actions 124/129 prouvent les rôles, Web Push et Storage, pas le chemin Crédit. Ajouter une recette navigateur dédiée sur Replay : Client (demande Marketplace), décision Promoteur/Responsable avec plafond, préparation Stock, retrait Caisse, demande Caisse au-dessus du plafond et reprise du même brouillon, vente sous plafond, consultation du suivi/reçu et remboursement par une Caisse authentifiée. Les assertions doivent vérifier l'absence de mouvement avant approbation, le débit stock unique, le solde crédit et la session personnelle.
4. **Qualité du code à la tête.** Obtenir un run qualité terminal PASS sur le SHA actuel incluant Node, TypeScript, ESLint, build Next.js/Serwist et actionlint. L'annulation 3332 et un succès antérieur ne peuvent pas être combinés pour annoncer AU VERT.
5. **Web Push / FCM.** Run 129 résout le résultat navigateur Chromium (3/3). La réception Android FCM physique demeure hors de cette preuve et n'est pas un critère du parcours crédit web.

### Ordre de clôture synchronisée

- Priorité A : ajouter au harnais Replay une exécution métier authentifiée du remboursement et des vérifications d'état avant/après, sans exposer ni versionner les secrets.
- Priorité B : étendre la recette transactionnelle comptable pour exécuter le worker sur un jeu de configuration temporaire, vérifier les écritures équilibrées et annuler toute la transaction ; séparer ce contrôle technique du paramétrage comptable réel de la pharmacie.
- Priorité C : créer le scénario Playwright crédit de bout en bout en réutilisant uniquement les utilisateurs/pharmacies de recette préparés par les Actions Replay ; vérifier le nettoyage et l'absence de résidus.
- Priorité D : relancer/obtenir qualité complète sur le dernier SHA et rejouer les workflows Replay concernés sur ce même SHA pour une preuve cohérente.

**Verdict au §61 : PARTIEL / NO-GO GLOBAL.** Web Push Chromium 3/3 et Storage 17/17 sont désormais confirmés au run 129. Les correctifs backend et contrats SQL crédit restent valides selon §59/§60. Remboursement runtime, posting comptable avec paramétrage légitime, parcours navigateur crédit et qualité finale sur le dernier SHA ne sont pas encore prouvés. Aucune migration Production, aucun déploiement Vercel ni Play Store.


## 62. Configuration comptable du crédit et préparation du remboursement runtime (15/11/2026)

**Tête `main` au début du chantier :** `88463ff4ba85f800879e249f85993fa94ee7a015`. Les changements de cette section sont versionnés directement sur `main`. Toutes les applications de migration et recettes DB décrites ci-dessous ciblent Replay `pwfftcsjyeibxxqhwysw`.

### Correction du raccordement de configuration comptable

**Cause racine supplémentaire :** le worker `compta_traiter_evenement` acceptait déjà `credit_octroi` et `credit_remboursement` (§59), mais les fonctions métier de configuration refusaient encore ces deux événements :
- `compta_config_enregistrer_journal` autorisait uniquement les types Vente, Dépense, Annulation et Assurance ;
- `compta_plan_enregistrer_mapping` autorisait uniquement Vente, Dépense et Assurance.

Le Promoteur/Comptable ne pouvait donc pas créer les journaux et mappings des types de crédit au moyen des RPC officielles, même si le worker les prenait en charge.

**Correction intégrée :**
- Migration `supabase/migrations/20261115230000_credit_accounting_configuration_options.sql` — commit [`e7fc4952`](https://github.com/audreymendomo23-netizen/NAXA/commit/e7fc4952ac4f736fc6966dfa0b67575b81d1f6dc).
- Test de contrat `supabase/tests/20261115230000_credit_accounting_configuration_contract.sql` — commit [`de2625a3`](https://github.com/audreymendomo23-netizen/NAXA/commit/de2625a3f0b1503d1d6fe88d3a0e807db595ef56).
- Migration appliquée à Replay et répertoriée version `20261115212217`, nom `20261115230000_credit_accounting_configuration_options`.
- Dry-run transactionnel PASS avant application ; contrat après application **PASS** : les deux RPC acceptent désormais les deux types de crédit et conservent `compta_ecriture_autorisee`.
- Aucun plan comptable, mapping commercial, journal ou période commerciale n'a été créé par la migration.

### Exécution runtime du worker comptable — PASS

Test versionné : `supabase/tests/20261115230500_credit_accounting_worker_runtime.sql`, commit [`8d80a6a0`](https://github.com/audreymendomo23-netizen/NAXA/commit/8d80a6a0d810892f58b9f406218e1644b6a1d15d).

Exécution sur Replay avec une pharmacie technique active mais masquée, un plan et un journal synthétiques, tous insérés dans une transaction annulée :
- Événement `credit_octroi` : worker retourne `traite`.
- Événement `credit_remboursement` : worker retourne `traite`.
- Deux écritures produites, quatre lignes au total : débits cumulés **500 FCFA**, crédits cumulés **500 FCFA**.
- Les deux événements sont marqués `traite` avant rollback.
- `ROLLBACK` exécuté après les assertions.

**Contrôle de propreté post-test :** sur la pharmacie technique Replay, zéro compte de plan `E2E-CR-%`, zéro mapping crédit, zéro journal `journal_code.credit_*`, zéro période technique du jour, zéro événement `E2E-WORKER-%`, zéro écriture `E2E-WORKER-%`. Le contrôle ne laisse donc aucun compte, période, événement ou écriture fictive persistante.

Cette preuve valide le traitement technique et la partie double du worker ; elle ne remplace pas les comptes, journaux, périodes et mappings réels à valider pour chaque pharmacie par son Promoteur/Comptable.

### Nouveau contrôle runtime du remboursement — intégré, exécution CI à confirmer

Fichiers ajoutés :
- `scripts/e2e/verify-credit-refund-runtime.cjs` — commit initial [`2ca9b4f9`](https://github.com/audreymendomo23-netizen/NAXA/commit/2ca9b4f9de9527005c362355280b8decb5c8d665), ajustements secrets et nettoyage dans commits ultérieurs.
- `scripts/test-credit-refund-runtime.cjs` — garde-fous du périmètre Replay, commit [`77d92331`](https://github.com/audreymendomo23-netizen/NAXA/commit/77d923313603f5078bc1a1c06ceef94f6cb60da4).
- Le workflow `.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml` provisionne désormais des fichiers temporaires de mots de passe Caisse et Client avec permissions `0600`, exécute le script remboursement avec le jeton réel du compte Caisse, puis supprime ces fichiers en étape `always()`.
- Le chemin est limité au projet Replay par comparaison stricte de l'URL ; aucune variable de secret ni aucun mot de passe n'est écrit dans les logs ou le dépôt.
- Scénario prévu : configuration du compte Client par le Promoteur ; solde technique initial 500 FCFA préparé via service_role (ce scénario ne prétend pas simuler une vente) ; ouverture d'une session personnelle par le compte Caisse authentifié ; remboursement réel de 250 FCFA par le RPC structuré ; vérification du solde, de la nature, du mode espèces, du créateur, de la session et de l'événement `credit_remboursement` ; refus d'un second remboursement supérieur au solde ; nettoyage des lignes de test puis clôture d'une session vide avec rapprochement 0.
- La session Caisse clôturée est conservée dans l'audit de session ; les comptes, opérations et événements financiers de fixture doivent être supprimés. En cas d'échec de nettoyage, le job doit échouer et signaler le résidu, plutôt que de déclarer PASS.
- Le test a été branché après le provisioning des rôles et après la vérification Web Push dans le workflow Replay. Les Actions déclenchées par les derniers commits n'ont pas encore de conclusion terminale confirmée ici : ce scénario est donc **INTÉGRÉ / EXÉCUTION NON CONFIRMÉE**, pas PASS.

### Ce qui reste ouvert

1. **Recette navigateur complète crédit.** Le SQL transactionnel Marketplace/comptoir et les pages opérationnelles sont corrigés, mais aucun parcours Playwright complet Client → demande Marketplace → décision Promoteur/Responsable → préparation Stock → retrait Caisse → crédit comptoir → remboursement n'est attesté. La pharmacie Mvan utilisée par les profils de recette ne retourne actuellement aucun produit avec stock positif au contrôle, donc le test navigateur de vente nécessite un produit/lot/stock technique temporaire, un parcours métier authentifié et un nettoyage cohérent.
2. **Configuration comptable commerciale.** Les RPC savent maintenant configurer les deux événements de crédit et le worker a prouvé la partie double. Les valeurs comptables de chaque pharmacie ne doivent pas être inventées ni préremplies par NAXA : les comptes, mappings, journaux et périodes doivent être renseignés/validés par le Promoteur/Comptable concerné. En leur absence, la comptabilité commerciale reste CONDITIONNELLE.
3. **Remboursement runtime Auth.** Le nouveau test authentifié est versionné et branché, mais n'est déclaré PASS qu'après un run GitHub Actions terminé SUCCESS avec les assertions et le nettoyage.
4. **Qualité et cohérence SHA.** Il faut un run qualité complet terminal PASS sur le SHA final qui inclut les modifications des scripts E2E et du workflow ; le run 3332 précédemment annulé et le succès plus ancien 3321 ne valident pas cette tête.
5. **Navigateur/Android.** Le succès Chromium Web Push 3/3 du run 129 reste une preuve Web Push navigateur seulement ; FCM Android physique n'a pas été testé ici.

**Verdict §62 : PROGRÈS RÉEL, MAIS PARTIEL / NO-GO GLOBAL.** La configuration des types comptables crédit est rétablie sur Replay ; le worker a passé une vraie exécution transactionnelle octroi + remboursement, équilibrée et annulée. Le test du remboursement avec le véritable JWT Caisse est intégré mais attend sa première exécution CI observée ; le parcours navigateur complet et les paramètres commerciaux restent ouverts. Aucune migration Production, aucun déploiement Vercel ni Play Store.


## 63. Rejeu du worker versionné et durcissement du nettoyage remboursement (15/11/2026)

### Test comptable versionné rejoué

Le fichier `supabase/tests/20261115230500_credit_accounting_worker_runtime.sql` — commit [`8d80a6a0`](https://github.com/audreymendomo23-netizen/NAXA/commit/8d80a6a0d810892f58b9f406218e1644b6a1d15d) — a été relu depuis `main` puis exécuté intégralement sur Replay après sa création : **PASS**.
- `credit_octroi` et `credit_remboursement` traités par `compta_traiter_evenement`.
- Deux écritures comptables et quatre lignes ; débit cumulé = crédit cumulé = **500 FCFA**.
- Les événements passent à `traite` avant la fin du test.
- La transaction est annulée intégralement.
- Contrôle post-run : zéro compte/mapping/journal/période/événement/écriture technique résiduel sur la pharmacie cachée.

### Durcissement du test remboursement Auth

- Le script `scripts/e2e/verify-credit-refund-runtime.cjs` supporte les clés Supabase de type `sb_secret_` sans les placer comme Bearer JWT ; seuls les véritables jetons de session Promoteur/Caisse/Client sont utilisés pour les RPC sous rôle utilisateur.
- Les mots de passe Caisse et Client sont écrits comme fichiers temporaires 0600 dans le runner, les chemins sont transférés via `GITHUB_ENV`, puis les fichiers sont supprimés dans l'étape `always()`.
- Le script vérifie que le payload d'outbox porte le bon montant et la référence source ; il refuse aussi un remboursement supérieur au solde restant.
- Nettoyage ordonné : suppression de l'opération temporaire, retrait de son événement outbox, suppression du compte crédit et de la fiche Client créée par la fixture ; enfin, clôture de la session Caisse **après** suppression des opérations de test, avec total espèces nul. La session fermée est conservée comme trace d'audit et relue pour confirmer statut clôturé, total théorique 0, total compté 0 et écart 0.
- Le script échoue si une opération, un événement, un compte ou une session ouverte subsiste. Le script ne prétend pas simuler une vente : le solde initial de 500 FCFA est préchargé par le service Replay uniquement pour tester le RPC de remboursement.
- Derniers commits de durcissement : [`f7997dac`](https://github.com/audreymendomo23-netizen/NAXA/commit/f7997dac985d7b1c3942d03b3fde52119d59d168), [`f52a0759`](https://github.com/audreymendomo23-netizen/NAXA/commit/f52a07590c9b90532beb24049bdcbea51ce376e2), [`b2c28b01`](https://github.com/audreymendomo23-netizen/NAXA/commit/b2c28b018e13b40c23cf9c2b40fdcba989885680).
- Le chemin reste intégré au workflow Replay ; le statut combiné des commits consultés ne fournit aucun contexte de statut exploitable et les identifiants de runs récents ne sont pas exposés par les outils disponibles dans cette reprise. La recette remboursement runtime reste donc **INTÉGRÉE / EXÉCUTION CI NON CONFIRMÉE**.

**Verdict §63 :** la comptabilité technique crédit est maintenant prouvée sur Replay par le worker, avec rollback et zéro résidu. Le remboursement authentifié bénéficie d'un harnais plus sûr et d'un nettoyage contrôlé, mais n'est pas déclaré PASS avant une conclusion SUCCESS visible du workflow Replay. Le parcours navigateur complet et les paramètres comptables commerciaux légitimes restent ouverts. Production, Vercel et Play Store inchangés.


## 64. Caisse ERP sur pharmacie masquée et recette navigateur du crédit comptoir (15/11/2026)

### Contradiction constatée et correction

Le véritable écran `/pharmacie/caisse` refusait l'accès quand `pharmacies.visible_recherche=false`, alors que cette colonne décrit la publication Marketplace, pas l'accès interne ERP. Une pharmacie active et non archivée doit pouvoir utiliser sa propre Caisse même si elle n'a pas d'offre publique ; la suspension reste bloquante par `actif=false`.

- Correction `src/app/pharmacie/caisse/page.tsx` : lecture `id,nom,actif,archivee_le`, contrôle uniquement actif/non archivé ; aucune ouverture Caisse ne dépend désormais de `visible_recherche`.
- Contrat `scripts/test-caisse-unpublished-pharmacy-access.cjs` : vérifie l'accès ERP interne pour une pharmacie masquée, tout en conservant le blocage inactive/archivée, l'authentification, le rôle Caisse et le périmètre actif.
- Commits : [`56274f44`](https://github.com/audreymendomo23-netizen/NAXA/commit/56274f4472f8e248cbe5e44cb0c519df60e9b23c), [`59a2098c`](https://github.com/audreymendomo23-netizen/NAXA/commit/59a2098c7133474a685933478e52b98d98f4ec01), [`6edbb3e3`](https://github.com/audreymendomo23-netizen/NAXA/commit/6edbb3e3aa2ee62f5faf4cc53c630b997bcc3fc5).

### Fixture technique privée sur Replay

Une pharmacie HYBRIDE technique existante est utilisée : `1a4f1ce5-cccf-477e-9a5b-474c8c9fc713`, active, non archivée, `est_demo=false`, `visible_recherche=false`. Le Promoteur est relié à cette pharmacie et dispose du privilège de création Caisse ; le profil Gestionnaire Stock a déjà son affectation.

- `scripts/e2e/provision-replay-credit-pharmacy-safe.cjs` s'authentifie avec les secrets Replay, puis appelle les RPC officielles Promoteur/Stock : `naxa_provision_caisse`, `naxa_select_active_role`, `pharmacie_produit_declarer_et_reference_initialiser`, `gestionnaire_stock_quantite_ajuster`.
- Le même profil peut recevoir plusieurs fonctions, mais un seul rôle actif à la fois : le harnais passe du Gestionnaire Stock à la Caisse puis vérifie explicitement `naxa_business_function='caisse'` et la pharmacie active.
- La fiche produit technique `NAXA E2E — Produit crédit comptoir` est déclarée comme fiche propriétaire de cette seule pharmacie masquée ; son stock interne est réglé à **4 unités à 1 000 FCFA**, sans lot. Aucun enregistrement d'offre publique, aucune visibilité publique ou validation centrale n'est ajouté.
- Le produit est conservé uniquement dans cette pharmacie non commerciale ; la provisionneuse remet la quantité à 4 avant chaque nouvelle tentative.
- Fichiers : `scripts/e2e/provision-replay-credit-pharmacy-safe.cjs`, `scripts/test-credit-pharmacy-provisioner.cjs`. Commits : [`c31ba6f6`](https://github.com/audreymendomo23-netizen/NAXA/commit/c31ba6f6ae1687aa35ce5a03d92fe03de384ad5a), [`a8859041`](https://github.com/audreymendomo23-netizen/NAXA/commit/a8859041733c5144bea81e244f9c8715f92e6f18), [`637e5d64`](https://github.com/audreymendomo23-netizen/NAXA/commit/637e5d645b92b383fa9386e442a9b29543e6f7cc), [`a4dee238`](https://github.com/audreymendomo23-netizen/NAXA/commit/a4dee2388ccdce23f085397ba04a7e09cdb12cea).

### Scénario Playwright crédit comptoir branché

`scripts/e2e/verify-credit-pos-browser.cjs` couvre le chemin suivant sur Replay, avec les comptes Client, Promoteur et Gestionnaire Stock/Caisse authentifiés :
1. Le Promoteur active un plafond Client à **500 FCFA** sur la pharmacie masquée.
2. Le compte Caisse ouvre sa session, associe le Client au panier et ajoute une unité à **1 000 FCFA**.
3. La finalisation crée une demande `origine='caisse'` au-dessus du plafond ; le harnais vérifie avant décision : quantité physique toujours à 4, aucun paiement POS.
4. Le Promoteur approuve cette demande via la vraie page `/pharmacie/promoteur/credits`.
5. Le même brouillon est repris depuis `/pharmacie/caisse` ; le test vérifie la vente `payee / credit`, la ligne `vente_paiements`, l'opération de crédit rattachée à la session et le stock diminué **une seule fois** (4 → 3).
6. Le Client consulte `/achats/credit/suivi`. Le RPC `client_credit_rembourser` est ensuite appelé avec le JWT réel du compte Caisse, montant 1 000 FCFA, espèces ; le harnais vérifie solde nul, lien session, opération et événement `credit_remboursement`.
7. La session Caisse est clôturée et doit présenter montant théorique 1 000 FCFA, montant compté 1 000 FCFA, écart 0.

**Récupération en cas d'interruption :** s'il existe un panier avec demande encore en attente, le Promoteur technique la refuse puis le Caisse abandonne le brouillon. Si la demande a déjà été approuvée, le harnais reprend et finalise le même brouillon avant de rembourser le solde ; il ne transforme pas une approbation en refus fictif. Toute session laissée ouverte est rapprochée avant la prochaine tentative. Une demande technique résiduelle non résolue bloque le nouveau scénario plutôt que d'être ignorée.

Le scénario garde les ventes, demandes consommées, opérations de crédit/remboursement, événements outbox et sessions clôturées dans la pharmacie masquée pour laisser une trace technique cohérente. Aucun de ces produits/offres n'est public. Les événements d'outbox de cette pharmacie non commerciale ne prouvent pas le posting comptable commercial ; celui-ci reste conditionné à une configuration légitime du Promoteur/Comptable.

**Fichiers et Actions :**
- `scripts/e2e/verify-credit-pos-browser.cjs` — [commit `c34cef57`](https://github.com/audreymendomo23-netizen/NAXA/commit/c34cef5732924ba5b049603c45e6519b23bc6a60), corrigé dans [`427e8149`](https://github.com/audreymendomo23-netizen/NAXA/commit/427e8149c230d8f09bc609df806b365414d36fdc) et durci dans [`22af25ca`](https://github.com/audreymendomo23-netizen/NAXA/commit/22af25ca1b14343867dd1abe4a2560ff090d9fff).
- `scripts/test-credit-pos-browser.cjs` — [commit `c70f85b8`](https://github.com/audreymendomo23-netizen/NAXA/commit/c70f85b8a13196f535014bf63c19810eecaecf39), ajustements pour ne pas dépendre de l'installation tardive de Playwright et aligner les assertions : [`cc06f923`](https://github.com/audreymendomo23-netizen/NAXA/commit/cc06f92314fcbe8e76d629498aacfa88f9e7f61b), [`9af01924`](https://github.com/audreymendomo23-netizen/NAXA/commit/9af019248fcdee489892a3ed79c33446b47b9eb5), [`c2a2bec5`](https://github.com/audreymendomo23-netizen/NAXA/commit/c2a2bec53be687f3c2fb685673959ae3026c2060).
- `.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml` provisionne la caisse/stock privés, installe Chromium, exécute le remboursement runtime JWT Caisse, puis le parcours navigateur crédit et enfin Storage. Les secrets demeurent dans des fichiers runner temporaires 0600 et sont supprimés dans l'étape `always()`. Commit du branchement navigateur : [`5ff7b078`](https://github.com/audreymendomo23-netizen/NAXA/commit/5ff7b0787cfaf69d2a4e90c5688e60c5cf07946f).

### État de preuve au §64

- **Code et contrats statiques : INTÉGRÉS** sur `main`.
- **Provisionnement runtime et parcours Playwright : À EXÉCUTER / NON CONFIRMÉS**. Les commits poussent le workflow par filtres de chemins, mais aucun run terminal associé à cette dernière tête n'est observable via les statuts consultés ici. Aucun PASS navigateur ne doit être déclaré avant le log de succès et le nettoyage.
- **Parcours Marketplace navigateur complet : NON PROUVÉ**. Les scénarios SQL Marketplace 259/264 restent les preuves backend ; le nouveau navigateur couvre le crédit direct Caisse.
- **Qualité générale dernier SHA : NON CONFIRMÉE**. Le run 3332 antérieur avait été annulé ; le run 3321 est antérieur aux corrections de cette séquence.
- **Comptabilité commerciale : CONDITIONNELLE** tant que chaque pharmacie n'a pas ses comptes, mappings, journaux et période validés par son Promoteur/Comptable.

**Verdict §64 : PARTIEL / NO-GO GLOBAL.** La cause racine « publication Marketplace obligatoire pour ouvrir la Caisse interne » est corrigée ; une recette navigateur authentifiée et limitée à une pharmacie masquée est prête et branchée au workflow Replay, mais sa première exécution reste à confirmer. Le worker comptable crédit reste PASS transactionnel selon §62–§63. Aucun déploiement Production, Vercel ou Play Store.


## 65. Alignement final des contrats E2E et état vérifiable des Actions (15/11/2026)

**Tête `main` contrôlée :** `43d55e53aed354bcf9b235fc54db21ccc7ec275a`.

### Durcissements intégrés après §64

- Le provisionneur vérifie maintenant explicitement que la RPC active le rôle Gestionnaire Stock et confirme l'affectation Stock avant de déclarer le produit et d'ajuster la quantité : commit [`a4dee238`](https://github.com/audreymendomo23-netizen/NAXA/commit/a4dee2388ccdce23f085397ba04a7e09cdb12cea).
- Le scénario navigateur vérifie que les sélections de rôle Promoteur et Caisse retournent `true`, que `naxa_business_function` retourne `caisse` et que `naxa_active_role_pharmacy` retourne précisément la pharmacie masquée : commit [`085a4044`](https://github.com/audreymendomo23-netizen/NAXA/commit/085a4044131982149c9615f526f707680ce04526).
- En récupération d'une exécution interrompue, un brouillon avec demande encore approuvée est finalisé sur le même panier avant régularisation du solde ; les demandes en attente sont refusées avant abandon. Un résidu non résolu bloque la tentative suivante : commit [`22af25ca`](https://github.com/audreymendomo23-netizen/NAXA/commit/22af25ca1b14343867dd1abe4a2560ff090d9fff).
- Le test contractuel Playwright reste indépendant de l'installation tardive de la dépendance Playwright ; l'assertion vérifie la structure du parcours, sans lancer de navigateur pendant la phase pré-build : commits [`cc06f923`](https://github.com/audreymendomo23-netizen/NAXA/commit/cc06f92314fcbe8e76e987f3e3731dcdc3fcdc8b) et [`c2a2bec5`](https://github.com/audreymendomo23-netizen/NAXA/commit/c2a2bec53be687f3c2fb685673959ae3026c2060).
- Les filtres de chemins du workflow Replay ont été dédupliqués : commit [`43d55e53`](https://github.com/audreymendomo23-netizen/NAXA/commit/43d55e53aed354bcf9b235fc54db21ccc7ec275a).

### Workflow Replay au SHA contrôlé

Le workflow `.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml` inclut maintenant, dans le même job Replay :
1. tests Node/contrats sans dépendance navigateur ;
2. provisionnement des profils et affectations, Promoteur, Admin, Client, Stock/Responsable ;
3. provisionnement de la Caisse et du produit dans la pharmacie technique non publique ;
4. installation Chromium et vérification Web Push ;
5. remboursement runtime avec le JWT du compte Caisse dédié au test de remboursement ;
6. parcours Playwright crédit comptoir sur la pharmacie masquée ;
7. Storage E2E avec matrices Admin et Promoteur puis nettoyage des secrets temporaires.

Les pushes touchant ces scripts, pages ou workflow satisfont les filtres de déclenchement. Cela confirme le **branchement** et la **demande de lancement par push**, pas la réussite de l'exécution.

### Contrôle des statuts disponibles

- Recherche des commits : tête `43d55e53` bien présente sur `main`.
- Statut combiné demandé pour cette tête : aucune entrée retournée.
- L'action de récupération des runs commit ne retourne que les exécutions associées aux Pull Requests ; elle ne fournit pas la liste des exécutions déclenchées par push sur `main`.
- Aucun ID de run récent ni résultat de job terminal n'est donc vérifiable ici pour le nouveau provisionnement crédit, le remboursement authentifié ou Playwright. Ces étapes restent **INTÉGRÉES / EXÉCUTION NON CONFIRMÉE**. Ne pas interpréter l'absence de status retourné comme un succès ou un échec.

**Verdict §65 : PARTIEL / NO-GO GLOBAL.** Le correctif de disponibilité ERP sur pharmacie masquée, le provisionnement et le parcours crédit comptoir navigateur sont versionnés et les Action paths sont branchés, mais leur premier résultat E2E doit encore être lu. Le parcours Marketplace navigateur complet et la configuration comptable commerciale par pharmacie restent ouverts. Les preuves SQL du worker comptable (§62–§63) ne sont pas substituées à ces validations. Production, Vercel et Play Store restent inchangés.


## 66. Contrat SQL de recherche POS interne sans visibilité Marketplace (15/11/2026)

Relecture des fonctions actives Replay après le correctif Caisse :
- **public.caisse_rechercher_produit(uuid,text,text)** vérifie l'authentification puis **can_operate_pharmacy(p_pharmacie)**. Sa requête joint produits et stocks, puis appelle **private.naxa_pos_stock_vendable**. Elle ne filtre ni **pharmacies.visible_recherche**, ni **produits.fiche_validee**.
- **private.naxa_pos_stock_vendable(uuid,uuid)** exige une pharmacie active et non archivée ; avec lots, elle ne retient que les quantités positives, non bloquées et dont la péremption est nulle ou au moins égale à la date du Cameroun ; sans lots, elle retient le stock agrégé si sa date de péremption est nulle ou valide. Elle ne conditionne pas la vente à la publication Marketplace.
- Cela confirme le contrat attendu : une fiche propre à la pharmacie non publiée peut être recherchée et vendue par sa Caisse autorisée, tandis que le Marketplace reste masqué. Les contrôles de rôle, périmètre, stock vendable et péremption restent actifs.
- La preuve est une relecture des définitions SQL Replay, pas encore une exécution du nouvel écran sur cette fixture : le scénario Playwright §64 doit toujours apporter la preuve runtime.

**Tête du code testée avant l'ajout de cette note :** 43d55e53aed354bcf9b235fc54db21ccc7ec275a. **Commit documentaire courant :** [43b0b1e0](https://github.com/audreymendomo23-netizen/NAXA/commit/43b0b1e0bdc54000b5d7c8a00a2f9c4f5315d099).

**Verdict §66 :** contrat ERP interne sur pharmacie masquée confirmé par lecture SQL ; parcours navigateur Playwright non encore exécuté/confirmé ; aucun PASS de bout en bout ajouté. PARTIEL / NO-GO GLOBAL inchangé. Production, Vercel et Play Store inchangés.


## 67. Recette crédit étendue sur comptes existants Replay (15/11/2026)

### Comptes et pharmacie réutilisés

La recette réutilise les identités Replay déjà provisionnées : Promoteur, Client acheteur, Responsable, Gestionnaire Stock/Caisse et Livreur. Aucun nouveau compte commercial n'est créé pour ce chantier.

La pharmacie technique reste strictement non commerciale :
- ID : `1a4f1ce5-cccf-477e-9a5b-474c8c9fc713`.
- Active, non archivée, `est_demo=false), masquée par `visible_recherche=false).
- Produit interne de recette : `dfd7313c-46a4-455a-b67d-50f0ce2a3686), prix 1 000 FCFA, quantité rétablie à 4 après le run précédent.
- Contrôle post-run du 15/11/2026 : visibilité `false), stock 4, zéro compte crédit, zéro demande, zéro réservation et zéro compte comptable technique résiduel.

### Correctifs et contrats ajoutés

- Le navigateur de recette initialise les deux marqueurs de déclaration d'âge adulte exigés (cookie middleware et déclaration locale), sans désactiver les contrôles d'âge.
- Le formulaire Promoteur de plan comptable expose maintenant `credit_octroi` et `credit_remboursement`, déjà autorisés par les RPC de configuration et le worker.
- Tests navigateur Replay ajoutés :
  - Marketplace : authentification Client, publication temporaire de la seule pharmacie technique Replay, consultation de l'offre, ajout au panier, envoi du justificatif, soumission de la demande et refus Promoteur ; vérification de l'absence de débit de stock et restauration du masquage dans `finally).
  - Comptabilité : connexion Promoteur, sélection de la pharmacie, création/validation de deux comptes techniques, deux journaux crédit et quatre mappings débit/crédit ; nettoyage ciblé des lignes techniques créées, en conservant les événements d'audit.
- Les tests statiques de ces parcours ne lancent pas Playwright pendant la phase de qualité ; les véritables scénarios Chromium sont exécutés dans le workflow Replay dédié.

### Preuves CI au SHA 12cb810

- Qualité complète : run [43769591812](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43769591812) **SUCCESS** sur `12cb81088af77fa57cbdce1d6998e64580200edb) : tests Node, TypeScript, ESLint, build Next.js et contrôles syntaxiques GitHub Actions passés.
- Run Replay antérieur [43768982230](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43768982230) sur `466a1e0` : provisionnements, build, Web Push Chromium 3/3 et remboursement authentifié par JWT Caisse passés ; le parcours navigateur Caisse a ensuite échoué sur un délai de redirection après connexion. L'étape Storage a été sautée à cause de cet échec.
- Après cet échec, vérification SQL Replay : pharmacie masquée, stock 4, aucun compte crédit, aucune demande, aucune réservation et aucun compte de plan comptable résiduel.
- Nouveau run Replay [43769591849](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43769591849) sur le SHA `12cb810` : en cours après le provisionnement des comptes et de la pharmacie technique ; Chromium est en installation. Il inclut le nouveau diagnostic de l'API de connexion, puis les parcours POS, Marketplace et paramétrage comptable. **Aucun résultat navigateur de ce nouveau run n'est encore déclaré PASS.**

### Verdict §67

**PARTIEL / NO-GO global.** La qualité du code est verte au SHA indiqué ; les preuves backend Web Push et remboursement JWT sont vertes ; la configuration comptable backend et worker est déjà vérifiée par SQL transactionnel. Les nouvelles recettes d'interface POS, Marketplace et paramétrage comptable attendent le résultat terminal du run Replay `43769591849`. La réussite du parcours Marketplace d'approbation et de l'interface comptable ne doit pas être extrapolée du seul test SQL.

Aucune migration Production, aucun déploiement Vercel et aucune publication Play Store n'ont été effectués.


## 68. Recette transactionnelle crédit Marketplace, Caisse et comptabilité sur Replay (16/11/2026)

### Environnement et méthode

- Projet exclusivement utilisé : `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`), état `ACTIVE_HEALTHY`, PostgreSQL 17. Les tests ont été lus depuis `main` puis exécutés via SQL sur Replay.
- Les 16 fichiers SQL listés ci-dessous contiennent une transaction de test et un `ROLLBACK` final (le test 248 a également été rejoué avec un SELECT explicite de résultat). Aucun test n'a écrit en Production.
- La pharmacie technique `1a4f1ce5-cccf-477e-9a5b-474c8c9fc713` reste active, non archivée, `est_demo=false` et `visible_recherche=false` : elle demeure masquée et non commerciale.

### Preuves exécutées — 16/16 PASS

1. `supabase/tests/20261115224500_credit_cashier_client_identity_projection.sql` — projection d'identité minimale Caisse/Client et ACL.
2. `supabase/tests/20261115230000_credit_accounting_configuration_contract.sql` — contrat de configuration des journaux et mappings octroi/remboursement.
3. `supabase/tests/20261115230500_credit_accounting_worker_runtime.sql` — exécution du worker pour octroi et remboursement, deux écritures équilibrées, événements traités et rollback.
4. `supabase/tests/20261115220000_credit_marketplace_pos_end_to_end.sql` — crédit Caisse au-dessus du plafond, demande, approbation, reprise de la même vente, débit unique du stock et crédit sous plafond.
5. `supabase/tests/248_credit_repayment_cash_session.sql` — rattachement du remboursement à une session Caisse personnelle ouverte.
6. `supabase/tests/249_credit_repayment_accounting.sql` — trigger, outbox idempotente et worker du remboursement.
7. `supabase/tests/250_caisse_credit_repayment_reconciliation.sql` — remboursement réconcilié dans le théorique de clôture et dans la garde d'écriture de session.
8. `supabase/tests/251_credit_hold_no_physical_decrement.sql` — hold Marketplace sans débit physique, allocation FEFO et refus de l'ancienne finalisation.
9. `supabase/tests/252_marketplace_credit_withdrawal.sql` — contrat de retrait Marketplace à crédit.
10. `supabase/tests/253_marketplace_credit_accounting.sql` — séparation vente à crédit / encaissement et outbox d'octroi idempotente.
11. `supabase/tests/256_credit_withdrawal_reserved_lots.sql` — consommation des lots exacts affectés à la réservation, avec verrouillage.
12. `supabase/tests/257_credit_withdrawal_five_scenarios.sql` — cinq scénarios allocation, lot bloqué, rapprochement et rollback/restauration.
13. `supabase/tests/259_credit_withdrawal_inverse_order_e2e.sql` — deux retraits dans l'ordre inverse des réservations, lots précis, stocks agrégés et soldes Client.
14. `supabase/tests/264_credit_marketplace_debit_on_approval_e2e.sql` — approbation Marketplace, délégation Responsable, périmètre multi-pharmacie, lot et révocation.
15. `supabase/tests/299_active_role_responsable_comptable.sql` — quatre assertions : Responsable délégué, retrait de ses droits, service Comptable autorisé et retrait au changement de rôle.
16. `supabase/tests/20261115130000_assurance_marketplace_pos_ticket_reimbursement_runtime.sql` — parcours runtime Assurance/Marketplace → Caisse POS → ticket → remboursements partiel/final → worker comptable.

### Résultats comportementaux établis

- Worker crédit : octroi et remboursement traités ; total du test **500 FCFA débit / 500 FCFA crédit** ; événements terminés ; rollback intégral.
- Caisse crédit comptoir : demande au-dessus du plafond sans mouvement anticipé ; approbation ; reprise du même brouillon ; vente crédit finalisée ; stock débité une seule fois ; pas d'événement `vente_encaissee` pour l'octroi.
- Marketplace : approbation avec privilège explicite Responsable dans la pharmacie autorisée ; refus hors périmètre ; lots consommés selon les allocations de réservation ; restitution contrôlée ; retrait de droits après révocation ou changement de rôle.
- Comptable : le poste autonome `comptable` et le privilège `MANAGE_ACCOUNTING` ouvrent le service dans le seul scope autorisé ; le retour au rôle Client retire le scope et empêche la clôture du service.
- Runtime Assurance/POS : vente **10 000 FCFA**, part Client **4 500 FCFA**, part assureur **5 500 FCFA**, espèces reçues **5 000 FCFA**, monnaie **500 FCFA**, remboursements **2 000 + 3 500 FCFA** ; quatre écritures ; créance assureur débitée et créditée à **5 500 FCFA** ; statut soldé.

### Contrôle des résidus après exécution

- Profils/Auth : 9 profils et 9 identités Auth conservés ; aucune création permanente de comptes par les tests exécutés.
- Pharmacies : 10 conservées, dont la pharmacie technique toujours cachée et non commerciale ; aucune publication laissée active par la recette.
- Caisses : 2 caisses ; 13 sessions historiques conservées ; **0 session ouverte**.
- Crédit : 1 compte crédit préexistant conservé ; **0 nouvelle demande**, **0 opération de crédit/remboursement**.
- Ventes : 1 vente préexistante conservée ; aucun produit ou vente technique ajouté par les tests transactionnels.
- Comptabilité : **0 paramètre, compte de plan, mapping, période, événement, écriture ou ligne** résiduel ; **0 événement comptable en attente** ; aucune période courante ouverte.
- Assurance : **0 règlement** résiduel ; les remboursements du scénario ont été annulés avec leurs fixtures.
- Les données métier préexistantes (notamment le compte crédit et la vente déjà présents) n'ont pas été supprimées.

### Limites restantes — ne pas surdéclarer le vert

- Les tests backend SQL/runtime sont **VERTS** sur Replay. Ils ne prouvent pas à eux seuls une authentification réelle au navigateur, le rendu UI, ni la navigation entre comptes distincts.
- Les scripts `scripts/e2e/verify-credit-pos-browser.cjs`, `scripts/e2e/verify-credit-marketplace-browser.cjs`, `scripts/e2e/verify-credit-accounting-browser.cjs` et `scripts/e2e/verify-credit-refund-runtime.cjs` n'ont pas été lancés dans cette session : ils requièrent Chromium/Playwright, un serveur Next.js, les secrets Replay et les fichiers temporaires de mots de passe du runner.
- Le workflow GitHub Replay est versionné et contient ces étapes, mais aucun statut terminal vérifiable du run courant n'a été obtenu ici. Le miroir GitLab (`87443849`) reste sur le commit `1b3ec14a481f129cc517ed167d246e9ba9a5a676` du 14/11/2026, antérieur à la tête GitHub contrôlée ; son ancien pipeline vert ne valide donc pas cette version.
- Les comptes, journaux, mappings et période créés dans le test comptable sont synthétiques et annulés. **Aucun paramétrage comptable réel n'a été conservé pour une pharmacie commerciale.** Chaque Promoteur/Comptable doit disposer de son plan, journaux, mappings et période légitimes avant une mise en service comptable réelle.

### Verdict §68

**VERT — backend transactionnel Replay : 16/16 PASS ; contrôle post-run sans résidu de recette.**

**JAUNE — fermeture navigateur/Auth et CI globale : non confirmées.** Ne pas déclarer le parcours complet navigateur vert avant un run terminal SUCCESS de `.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml` ou une preuve Playwright équivalente.

**Périmètre préservé :** aucune écriture, migration ou configuration Supabase Production ; aucun déploiement Vercel ; aucune publication Play Store. Aucun changement du code applicatif n'a été requis par ces tests ; seule la documentation de continuité est actualisée.

## 69. Gouvernance Promoteur, agrément Pharmacien et effectifs multi-postes — 16/11/2026

### Règles métier arrêtées et appliquées

- **NAXA ne valide pas les pharmaciens.** Le Promoteur titulaire qui gère la pharmacie examine le numéro professionnel et le justificatif, puis décide lui-même d'approuver, refuser ou retirer l'agrément. Cette décision est limitée à la pharmacie de son réseau.
- Une proposition Pharmacien reste à l'état pending_promoter. L'affectation et le poste actif ne sont créés qu'après l'appel à naxa_promoteur_decider_accreditation_pharmacien avec la décision approve. Le retrait par le Promoteur révoque l'affectation et neutralise immédiatement les RPC cliniques.
- Le chemin générique naxa_grant_professional_assignment refuse le rôle Pharmacien, afin qu'aucun appel direct ne contourne la décision du Promoteur. L'ancienne RPC d'approbation Admin n'est plus exécutable par authenticated ; la route /admin/pharmaciens redirige vers /admin, sans file de validation NAXA.
- Un Promoteur peut gérer plusieurs pharmacies. Un index unique partiel garantit un seul Promoteur actif responsable par pharmacie.
- Une pharmacie ne peut compter qu'un seul Responsable actif sur une même période. Un verrou transactionnel et un trigger DB empêchent aussi les créations concurrentes ou directes de dépasser cet invariant.
- Plusieurs comptes peuvent porter le même poste Caisse, Gestionnaire de stock, Comptable ou Livreur. Le contrôle d'architecture vérifie toujours que le niveau de fonction existe, mais l'effectif humain n'est plus plafonné par max_caisses.
- max_caisses ne mesure que les ressources physiques. Les Caissiers partagent la caisse physique provisionnée par pharmacie. Un trigger sur public.caisses maintient le plafond physique au niveau de la capacité d'architecture.
- Les droits d'écriture Comptable restent individuels : le Promoteur choisit quels comptes Comptable reçoivent MANAGE_ACCOUNTING. L'affectation d'un Comptable ne crée ni droit financier implicite, ni vente, ni écriture de journal.

### Corrections livrées

- Migrations Replay versionnées :
  - pharmacien_accreditation_and_client_prescription_flow
  - promoter_validates_pharmacists_and_staff_capacity
  - separate_cashier_staff_from_physical_register_capacity
  - one_active_promoter_per_pharmacy
- Promoteur : formulaire de proposition, upload privé du justificatif avec la session Auth du Promoteur (policy Storage appliquée), liste des dossiers, examen du document, approbation, refus et retrait dans /pharmacie/affectations. La clé serveur ne sert qu'à rechercher le compte cible et supprimer un fichier orphelin après refus RPC.
- Client : /client/ordonnances, dépôt privé PDF/JPEG/PNG (10 Mo max), choix de pharmacie, suivi du statut et des motifs de complément/refus.
- Pharmacien : file canonique, ouverture sécurisée du document original, préparation, demande de complément, décision et retour du statut au Client. L'ancienne route /pharmacien/validations redirige vers la file ERP canonique.
- Affectations : formulaire générique sans Pharmacien direct ; libellé réseau précisant la multiplicité des équipes et l'unicité du Responsable.
- Caisse : /pharmacie/caisses distingue les collaborateurs de la ressource physique ; max_caisses ne désactive plus l'ajout d'un autre Caissier lorsqu'une caisse partagée existe déjà.
- Comptabilité : écran de délégation par Comptable et par pharmacie conservé ; aucun droit d'écriture n'est créé automatiquement lors d'une affectation.
- Admin / suivi-professionnels : le suivi Admin restant accessible concerne uniquement les professionnels indépendants « Prestations et soins à domicile » ; son texte exclut explicitement la validation des pharmaciens salariés d'une pharmacie.

### Recette E2E exécutée sur Supabase Replay

**Test Pharmacien/Client — 16/16 PASS**
Fichier : supabase/tests/297_active_role_pharmacien_e2e.sql

- Proposition du Promoteur sans activation prématurée.
- Blocage du sélecteur tant que la proposition n'est pas validée.
- Absence de droit d'exécution de l'ancienne RPC Admin.
- Validation par le Promoteur et création de l'affectation dans sa pharmacie.
- Refus de l'affectation générique directe et refus d'un autre périmètre pharmacie.
- Poste Pharmacien actif sans conversion de l'identité de base Client.
- Consultation, prescription interne, ouverture/clôture de service et export journalisé.
- Dépôt Client d'un document privé, prise en charge Pharmacien, demande de complément visible du Client.
- Deuxième ordonnance préparée et validée, résultat visible côté Client.
- Retrait d'agrément par le Promoteur et blocage des RPC cliniques.

**Test réseau/effectifs/comptabilité — 13/13 PASS**
Fichier : supabase/tests/20261116003000_promoter_validates_pharmacists_and_staff_capacity_e2e.sql

- Un même Promoteur gère deux pharmacies, chacune avec son unique Responsable.
- Un second Promoteur actif ne peut pas se rattacher à une pharmacie déjà détenue.
- Une deuxième affectation Responsable simultanée est refusée.
- 3 Caissières, 3 Gestionnaires de stock, 3 Comptables et 3 Livreurs sont affectés dans une pharmacie.
- Les trois Caissières partagent une caisse physique existante. La création d'une deuxième caisse physique est refusée lorsque max_caisses=1.
- Les quatre fonctions autonomes sont sélectionnables par les comptes temporaires.
- Les trois Comptables sont listés par le Promoteur et reçoivent chacun un droit d'écriture distinct, uniquement après délégation explicite.
- Architecture, max_caisses, max_responsables et nombre de niveaux restent inchangés.
- Affectations et délégations ne créent ni vente, ni ligne de vente, ni événement financier, ni écriture ou ligne comptable.

### Contrôle des résidus après ROLLBACK

État Replay constaté après les deux recettes :

| Contrôle | État |
|---|---:|
| Agréments Pharmacien | 0 |
| Affectations Pharmacien actives | 0 |
| Profils temporaires naxateam% | 0 |
| Identités Auth temporaires naxa-team-% | 0 |
| Droits d'écriture Comptable de test | 0 |
| Caisses physiques | 2 (préexistantes) |
| Affectations professionnelles totales | 6 (préexistantes) |
| Liens Promoteur/pharmacie actifs | 3 (préexistants) |

Les scénarios se terminent par ROLLBACK ; aucune donnée de recette n'est conservée. Les seules modifications persistantes sont les migrations et les objets de schéma correspondants sur Replay.

### CI et limites — ne pas surdéclarer le vert

- GitHub Actions NAXA quality : actionlint avait réussi sur le run 43781080647, ensuite annulé par les pushes suivants. Au moment de cette note, le run 43781283860 sur le commit 71b7fc68677e825f12c367e4c6c271cb75b1ed7d était pending ; le job qualité terminal (npm test, TypeScript, lint et build Next.js) doit être vérifié sur le run déclenché par le présent commit documentaire.
- Les 29 assertions ci-dessus sont des recettes SQL transactionnelles réellement exécutées sur Replay. Les lignes storage.objects y simulent les références de documents et les règles métier/rôles sont exécutées côté Postgres.
- Une recette navigateur Playwright complète avec connexions réelles, upload HTTP Storage, rendu des formulaires et navigation entre comptes distincts n'a pas été exécutée dans cette session. Le statut navigateur reste JAUNE tant qu'un run browser terminal SUCCESS sur Replay n'est pas disponible.
- Aucun changement ni test sur Supabase Production ; aucun déploiement Vercel ; aucune publication Play Store.

### Verdict §69

**VERT — règles métier Postgres/Replay :** Pharmacien sous décision Promoteur, isolation pharmacie, un Responsable par pharmacie, effectifs multipliés, caisse physique protégée et comptabilité sans effet parasite.

**JAUNE — navigateur réel et résultat terminal du job qualité global :** à confirmer. Ne pas annoncer un vert global navigateur/production avant les preuves correspondantes.

**Point de reprise exact :** contrôler le résultat terminal du workflow GitHub NAXA quality après le commit de documentation, puis exécuter la recette navigateur Replay (auth Promoteur, Client, Pharmacien et trois profils de fonctions) avec upload réel sur les deux buckets privés. Production et déploiement demeurent hors périmètre.

## 70. Finalisation POS crédit, récupération Caisse et diagnostic Web Push — 16/11/2026

### Corrections SQL et E2E versionnées

- **Cause POS crédit :** `vente_credit_finaliser` créait le paiement puis tentait une mise à jour des champs de reçu. Le trigger `naxa_guard_pos_payment_write` refuse toute mise à jour directe de `vente_paiements`, même à l'intérieur du finaliseur autorisé.
- **Correction SQL :** `supabase/migrations/20261116010200_credit_pos_payment_insert_fields_fix.sql` écrit `montant_percu` et `monnaie_rendue=0` dès l'INSERT crédit. Le finaliseur vérifie les champs insérés et ne met plus à jour `vente_paiements`. ACL et trigger stricts conservés.
- **Application Replay :** migration appliquée uniquement à `pwfftcsjyeibxxqhwysw`; résultat `success=true`. Test `supabase/tests/20261116010200_credit_pos_payment_insert_fields_fix.sql` exécuté sur Replay : PASS.
- **Récupération POS :** le cleanup reprend un brouillon approuvé via RPC métier ; il repère également une vente crédit déjà passée à `payee` dans la session, seulement si elle appartient au Client et au Caissier E2E et si sa demande Promoteur est approuvée/consommée. Il rembourse le compte, clôture la session, puis restitue exactement les unités consommées via `gestionnaire_stock_quantite_ajuster`. La quantité finale doit être exactement 4.
- **Tests versionnés :** `scripts/test-credit-pos-payment-guard.cjs`, `scripts/test-credit-pos-browser.cjs` et `scripts/test-replay-expiry-push-worker.cjs` couvrent la garde POS, le sélecteur Client non ambigu, le nettoyage des ventes finalisées et la portée de la purge Push.

### Preuves du dernier run navigateur complet observé

- Run GitHub Replay `43785073358`, SHA `bfc2659e53aceab5677e9841cf72e7c0bf17f9c3` : **FAILURE global**, mais le découpage des étapes est précis :
  - Chromium et build Next.js : SUCCESS.
  - Web Push : **3/3 envois ciblés acceptés par Google Push et 3 notifications visibles dans les Service Workers Chromium** (Promoteur, Gestionnaire Stock, Responsable).
  - Remboursement JWT Caisse Replay : SUCCESS ; opération espèces liée à la session, outbox `credit_remboursement` idempotente et dépassement de solde refusé.
  - POS navigateur : échec Playwright au contrôle de la page Client, car `getByText("Achat à crédit")` trouvait trois éléments. La vente crédit avait déjà été finalisée ; il s'agissait d'une ambiguïté du sélecteur de test, pas d'un échec RPC de paiement.
  - Storage E2E : skipped après l'échec POS. Ce run ne prouve donc pas le parcours complet.
- **Correction du sélecteur :** le test utilise maintenant `getByText("Achat à crédit", { exact: false }).first()`, avec une assertion unitaire.
- **Qualité intermédiaire :** un run sur SHA intermédiaire `16f7640ff0d49c185d6cfd2471eeeeab363cb1d1` a échoué à cause d'une expression régulière invalide dans `scripts/test-replay-expiry-push-worker.cjs`. Cette assertion a été remplacée par des vérifications textuelles simples. Ne pas confondre cet échec intermédiaire avec le résultat du SHA courant.
- **Dernier contrôle de source :** `main` pointe vers `e1ff5e3e64e618df11dc5c3d98d6748b49bb8a81`. Runs sur ce SHA au dernier relevé : NAXA quality `43786934881` pending ; Replay E2E `43786934901` pending. Aucun SUCCESS terminal pour le SHA courant n'est encore établi.

### Contrôle de propreté Replay après le dernier run échoué

- Sessions Caisse ouvertes : **0**.
- Solde crédit total de la pharmacie technique : **0 FCFA**.
- Demandes de crédit en attente : **0**.
- Événements comptables en attente/en cours : **0**.
- Produit technique « NAXA E2E — Produit crédit comptoir » : stock revenu à **4 unités** après restitution/ajustement audité via le RPC Gestionnaire Stock.
- Historique des ventes, opérations de crédit, remboursements et mouvements de stock conservé ; aucune suppression des traces d'audit.
- Le nettoyage des ventes déjà finalisées a été renforcé dans le code afin que les prochains échecs UI ne laissent plus une unité consommée.

### Paramètres comptables des pharmacies commerciales

- Le parcours navigateur Promoteur doit créer puis valider les comptes, journaux et mappings de recette, puis supprimer uniquement les lignes synthétiques qu'il a créées.
- **Aucun paramètre comptable réel n'est inventé ni écrit pour une pharmacie commerciale.** Chaque Promoteur/Comptable doit saisir le plan, les journaux, mappings et période réels de sa pharmacie avant une exploitation comptable réelle.

### Verdict §70

**VERT — sous-parties démontrées :** migration POS crédit Replay et test SQL PASS ; Web Push navigateur 3/3 PASS ; remboursement JWT Caisse PASS ; contrôle de propreté Replay 0 session ouverte / 0 solde crédit / stock technique 4.

**JAUNE — chantier global :** le run navigateur s'est terminé en FAILURE sur le sélecteur Client ; le sélecteur et le cleanup ont été corrigés, mais le nouveau workflow au SHA courant est encore pending. Storage et parcours navigateur global restent à confirmer par un run Replay terminal SUCCESS.

**Périmètre préservé :** aucune écriture Supabase Production ; aucun déploiement Vercel ; aucune publication Play Store. La pharmacie technique reste privée/non commerciale.


## 71. Reprise navigateur Replay, isolation des scénarios et Web Push — 16/11/2026

### Corrections versionnées sur `main`

- `bd7f6162758b41f6d2e9d7c1deb6416009d7a057` : retrait de la sonde Web Push directe préalable ; le test n'envoie désormais qu'une notification par souscription, via le worker NAXA.
- `16f7640ff0d49c185d6cfd2471eeeeab363cb1d1` : mise à jour du contrat statique correspondant.
- `e1ff5e3e64e618df11dc5c3d98d6748b49bb8a81` : correction de l'assertion statique invalide.
- `685ae719631ad71467b6eaaa71a97bb38b759644` : rétablissement du contrôle REST des clés `p256dh` et `auth` stockées ; conservation de l'import `web-push` corrigée ensuite.
- `09d4951bbecd3b7269f9d1b9d90ba6a24eebddd9` : restauration de l'import `web-push`, nécessaire à l'initialisation VAPID du worker.
- `22128e97e322d15e6524687cb179d7d9f5dff7ff` : les étapes remboursement JWT, POS navigateur et Storage E2E utilisent maintenant `always() && preflight`. Elles s'exécutent donc même si le contrôle Web Push précédent échoue ; le job conserve néanmoins le statut FAILURE tant qu'une étape échoue. Aucun faux vert n'est introduit.

### Preuves observées

- **Qualité GitHub : SUCCESS** sur `22128e97e322d15e6524687cb179d7d9f5dff7ff`, run `43787918115` : tests, TypeScript, lint, build Next.js et vérifications de syntaxe GitHub Actions.
- **Provisionnement Replay : PASS** sur le run `43787374196` et de nouveau sur `43787918026` : comptes Promoteur/Admin/Client/Livreur/Stock/Caisse, pharmacie technique masquée, affectation Responsable, caisse et stock provisionnés.
- **Web Push : FAILURE confirmé** sur le run `43787374196`, SHA `09d4951bbecd3b7269f9d1b9d90ba6a24eebddd9`. Chromium a créé trois souscriptions distinctes ; chacune a été relue dans Replay avec les mêmes clés. Le worker a toutefois reçu HTTP `410` de Google Push (`jmt17.google.com`) pour le Responsable : `claimed=1, sent=0, retried=1, webPushSent=0, webPushFailures=1`. La purge a supprimé une ancienne souscription E2E, sans toucher d'autres comptes.
- Le retrait de la sonde supplémentaire n'a donc **pas** résolu le HTTP 410. Ne pas classer Web Push vert.
- **Run courant à reprendre :** `43787918026`, SHA `22128e97e322d15e6524687cb179d7d9f5dff7ff`. Au dernier relevé, le build Next.js du worker est en cours ; les étapes remboursement JWT, POS navigateur et Storage E2E sont ensuite prévues avec `always()`. Aucun résultat de ces trois étapes n'est encore disponible sur ce run.

### Verdict §71

**VERT — qualité applicative** sur le SHA courant ; provisionnement Replay validé.

**JAUNE — parcours navigateur complet :** Web Push reste bloqué par HTTP 410 sur l'endpoint Google du Responsable. Les scénarios POS, Marketplace, comptabilité et Storage n'ont pas encore fourni de résultat terminal sur le run courant ; ils ne doivent être déclarés verts qu'après lecture de leurs propres résultats.

**Point de reprise exact :** contrôler le run `43787918026` jusqu'à son état terminal ; relever séparément remboursement JWT, POS navigateur et Storage. Ensuite diagnostiquer le 410 Google Push (endpoint du Responsable) sans supprimer ni modifier les souscriptions d'utilisateurs réels.

**Périmètre préservé :** Replay uniquement ; aucune modification Supabase Production, aucun déploiement Vercel, aucune publication Play Store. Les fichiers de mots de passe éphémères sont nettoyés par le workflow.
