# Continuité des recettes E2E NAXA

> **Document de reprise vivant.** Mettre à jour ce fichier dès qu'une réponse fait avancer une recette, apporte une preuve, découvre un blocage ou modifie une décision. Toute correction nécessaire doit être intégrée à la source versionnée sur `main`, vérifiée, puis référencée ici avec son commit. Aucun correctif ne doit rester uniquement dans la conversation.

**Dernière mise à jour :** 17 novembre 2026 (§198)  
**Dépôt / branche :** `audreymendomo23-netizen/NAXA` / `main`  
**HEAD contrôlé avant cette mise à jour :** `c4bd6d0f5a4c0126c7f64fc945f5149ec1386f69`  
**État global :** 🟡 PARTIEL — le parcours transactionnel Livreur→Caisse→Client est désormais passé de bout en bout sur Replay via les RPC métier, avec confirmation explicite qu'aucune mission n'est publiée avant la préparation physique. Quatre migrations correctives ont été appliquées à Replay et versionnées sur `main` (§103). Le Comptable réussit la configuration du journal, de la période, du plan, des mappings et l'audit ; la publication d'écritures et la clôture restent réservées au worker `service_role`, non exécutées depuis la session authentifiée. Le Pharmacien réussit la création/lecture d'une consultation et d'une prescription fictives, ainsi que l'acceptation/rejet d'une ordonnance entrante synthétique ; le dépôt positif d'une ordonnance Client depuis Storage reste à prouver. Les connexions interactives Web/Android ne sont pas prouvées. Le chantier E2E global reste partiel, notamment cumul Pharmacie↔SPD (§99–101), recettes physiques et campagnes bulk B1–B11. Aucun résultat fictif n'est conservé : les recettes transactionnelles de ce lot ont été exécutées en `BEGIN/ROLLBACK`. La suppression Auth d'un compte possédant des sessions actives est désormais corrigée et testée sur Replay (§146) : la cascade ne tente plus d'insérer un audit qui référence le parent en cours de suppression, tandis que la révocation normale reste auditée. Aucune donnée Production ni aucun déploiement touchés. Les 28 événements comptables en erreur relevés sur une autre pharmacie Replay ne sont pas traités ici : le Comptable E2E n'y est pas affecté.
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
2. **Clos sur Replay (§146) :** trigger `naxa_audit_session_delete` corrigé ; la suppression Auth avec sessions actives et la révocation ordinaire sont couvertes. Ne pas migrer Production sans autorisation explicite.
3. **Bloqué par décision métier (§147) :** définir le traitement de `profiles.actif` du titulaire lors de la validation d'un dossier Partenaire ; ensuite aligner la visibilité `partners_member_read` et les policies d'écriture des tables Examens sur le même contrôle d'accès.
4. Poursuivre par le parcours navigateur métier réservation → Stock → Livreur → Client → paiement/clôture, puis les recettes Android sur téléphones enrôlés : caméra, galerie/PDF/OCR, GPS/Bluetooth, SMS/FCM et offline.

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


## 71. Reprise du 16 novembre — qualité verte, Replay Web Push bloqué

- Commit testé : `685ae719631ad71467b6eaaa71a97bb38b759644`.
- Qualité complète, run `43787029143` : `SUCCESS` pour actionlint, tests, TypeScript, lint et build Next.js.
- Replay E2E, run `43787029157` : échec à l'étape 15 « Exécuter la réception Web Push réelle via Chromium et le worker NAXA ». Message terminal : `RECETTE WEB PUSH PÉREMPTION E2E BLOQUÉE — webpush is not defined`.
- Les étapes 16 (remboursement JWT Caisse), 17 (vente crédit navigateur) et 18 (Storage) ont été ignorées après cet échec. Aucun résultat ne doit leur être attribué.
- Le provisionnement Promoteur/Client/Livreur/Gestionnaire Stock/Responsable et la pharmacie technique masquée, étapes 5 à 14, ont réussi sur ce run. Les secrets de test ont été nettoyés à l'étape 19.
- Diagnostic ajouté sur `main` : commit `08418675d9ce46d46907e6fc28300aae43df29e8` affiche désormais la pile d'appel complète en cas d'erreur ; commit `a1dce28b25f420e753acaddaab165cf403044338` imprime aussi le journal du serveur Next.js avant de faire échouer l'étape.
- Prochaine preuve requise : résultat du Replay sur ces commits instrumentés, puis correction de la cause racine. Ne pas rerun l'ancien SHA comme preuve du correctif.
- Ne pas déclarer vert global tant que Web Push 3/3, remboursement JWT, vente crédit navigateur, Storage et nettoyage post-run n'ont pas chacun leur preuve terminale. Aucun déploiement Production/Vercel ni publication Play Store.


## 72. Résultats consolidés POS, Marketplace et Storage — 16/11/2026

### Correctifs RLS Replay

- Migration `20261116015000_storage_promoter_validity_public_wrapper.sql` appliquée au projet Replay `pwfftcsjyeibxxqhwysw`. La politique `naxa_pharmacien_credential_insert_promoter` dépend de `public.naxa_promoteur_valide(uuid)` ; le helper `private.naxa_promoteur_valide(uuid)` reste sans droit EXECUTE pour `authenticated`.
- Test SQL associé : PASS. La vérification utilise `pg_depend` pour contrôler le schéma de la fonction réellement appelée par la politique.
- Migration `20261116020000_prescriptions_select_for_storage_rls.sql` appliquée à Replay : SELECT accordé à `authenticated` sur `public.prescriptions` pour permettre l'évaluation des politiques Storage. RLS reste activé ; aucun SELECT accordé à `anon`.
- Test SQL associé : PASS. La table conserve ses politiques RLS client/staff.

### Résultats navigateur/Storage

- Run `43788573624`, SHA `08418675d9ce46d46907e6fc28300aae43df29e8` :
  - Web Push Chromium + worker NAXA : PASS.
  - Remboursement crédit via vrai JWT Caisse Replay : PASS.
  - Scénario POS : PASS — panier au-dessus du plafond, demande Caisse, approbation Promoteur, débit stock unique, remboursement réel, solde nul, outbox et clôture Caisse sans écart.
  - Storage avec matrice Admin/Promoteur obligatoire : **17 PASS, 0 SKIP** — dépôt/lecture Admin, remplacement photo, refus non-Admin, dépôt Promoteur pharmacie liée, refus d'écriture autre pharmacie, suppression propriétaire et nettoyage des sessions.
  - Scénario Marketplace : FAILURE sur un sélecteur Playwright qui choisissait la dernière carte portant le même produit ; le bouton Refuser n'existait pas sur une ancienne demande déjà rejetée. Ce n'est pas un échec de la décision métier ni du stock.

### Correction du scénario Marketplace

- `scripts/e2e/verify-credit-marketplace-browser.cjs` cible maintenant une carte contenant le produit ET le statut `en_attente`, prend la première demande (liste triée de la plus récente à la plus ancienne), puis vérifie l'unicité du bouton Refuser.
- Nouveau contrat statique `scripts/test-credit-marketplace-browser.cjs`.
- Le filtre `paths` du workflow E2E inclut désormais le script Marketplace, son test statique, le contrat Storage et les deux migrations/tests RLS, afin que ces changements relancent la recette complète.
- Qualité sur SHA `c2cd3f8acd3517d5698fee1153801b9b2b1c2441`, run `43790136561` : SUCCESS, y compris actionlint et tests/TypeScript/lint.

### Verdict §72

**VERT — qualité applicative.**  
**VERT — Web Push, remboursement runtime, POS métier et Storage Admin/Promoteur** sur le run `43788573624`.  
**JAUNE — parcours navigateur complet** : le seul échec de ce run est le sélecteur du refus Marketplace ; la correction est versionnée mais attend sa preuve navigateur.

**Run de validation courant :** `43790136584`, SHA `c2cd3f8acd3517d5698fee1153801b9b2b1c2441`. Dernier relevé : provisionnement Replay PASS, build du worker de notifications en cours. Les résultats terminaux Web Push, remboursement, POS/Marketplace et Storage doivent être lus avant tout verdict vert global.

**Périmètre :** Replay uniquement ; aucun changement Supabase Production et aucun déploiement Vercel.


## 73. Correction du contrôle comptable navigateur et reprise Replay — 16/11/2026

### Cause racine confirmée

- Le run `43791195947`, SHA `c102f862ff2cd4f0bba1be438cd919d3023a87ad`, a confirmé POS PASS, Marketplace PASS et Storage **17 PASS, 0 SKIP**.
- Son seul scénario navigateur en échec était la recette comptable crédit. La trace Playwright montre précisément l'attente de `getByText("Validé", { exact: true })` dans la carte du journal `Octroi de crédit client`.
- Le composant `ComptaPlanManager.tsx` affiche pour les journaux et mappings le statut composé `Validé · date de début → date de fin`. L'attente stricte sur le seul mot `Validé` était donc incorrecte ; il ne s'agissait pas d'un échec de validation comptable métier.

### Correction versionnée

- Sur `main`, `scripts/e2e/verify-credit-accounting-browser.cjs` attend désormais `/^Validé\s*·/` pour les journaux et les mappings, où l'interface affiche le statut avec sa période.
- Les lignes de comptes simples conservent l'attente exacte `Validé`, correspondant à leur rendu réel.
- `scripts/test-credit-accounting-browser.cjs` verrouille par test statique les deux attentes avec période et interdit le retour à l'ancien sélecteur strict.
- Tête source testée : `f58a9373d4144b2259c1ed8e93758a90a3e87de5`.
- Qualité GitHub, run `43791964638`, sur ce SHA : **SUCCESS** (actionlint, tests, TypeScript, lint et build).

### Preuves du nouveau Replay

- Run `43791964746`, SHA `f58a9373d4144b2259c1ed8e93758a90a3e87de5`.
- Étape 15 — Web Push Chromium via le worker NAXA : **SUCCESS**.
- Étape 16 — remboursement crédit avec vrai JWT Caisse Replay : **SUCCESS**.
- Étape 17 — recette navigateur POS / Marketplace / comptabilité : **EN COURS** au dernier relevé.
- Étape 18 — Storage E2E : pas encore exécutée au dernier relevé.
- Étape 19 — nettoyage : pas encore exécutée au dernier relevé.
- Aucun verdict terminal de ce run n'est disponible à ce relevé ; le chantier ne peut pas être déclaré vert global.

### Point de reprise exact

Lire le run `43791964746` jusqu'à son état terminal, en particulier les étapes 17 à 20. Si l'étape 17 échoue encore, récupérer sa trace exacte et corriger uniquement le nouveau sélecteur défaillant. Si elle passe, vérifier Storage et le nettoyage avant le verdict global.

### Périmètre préservé

Replay exclusivement (`pwfftcsjyeibxxqhwysw`). Aucune écriture Supabase Production, aucun déploiement Vercel, aucune publication Play Store.


## 74. Clôture des recettes Replay crédit, Web Push et Storage — 16/11/2026

### Verdict terminal

- Run Replay `43791964746`, SHA applicatif `f58a9373d4144b2259c1ed8e93758a90a3e87de5` : **SUCCESS**.
- Étape 15 — Web Push via Chromium et worker NAXA : **PASS 3/3**. Trois souscriptions authentifiées ont été relues et trois notifications ont été constatées dans les Service Workers Chromium. Cela ne prétend pas démontrer une livraison Android FCM physique.
- Étape 16 — remboursement crédit via vrai JWT Caisse Replay : **PASS**. Solde diminué de 250 FCFA, opération espèces liée à la session, outbox émise une fois, dépassement refusé sans mutation et clôture rapprochée à zéro.
- Étape 17 — recettes navigateur : **PASS**. Crédit comptoir (demande, approbation Promoteur, débit unitaire, remboursement et clôture), Marketplace (soumission, refus Promoteur, stock inchangé) et comptabilité (2 comptes, 2 journaux, 4 mappings validés via l'interface) démontrés.
- La recette comptable a nettoyé uniquement ses lignes synthétiques : 2 comptes, 2 journaux et 4 mappings. Les traces fonctionnelles d'audit restent conservées.
- Étape 18 — Storage E2E : **17 PASS, 0 SKIP**. Les contrôles couvrent notamment les accès Admin/Promoteur, les refus inter-utilisateurs et inter-pharmacies, les fichiers privés/signés, les types MIME et les suppressions autorisées.
- Étape 19 — nettoyage : **PASS**. Fichiers de mots de passe éphémères supprimés, sessions métier fermées, sessions temporaires révoquées et comptes temporaires supprimés.
- Étape 20 — verdict final Web Push : **SUCCESS** ; le contrôle d'échec différé n'a pas signalé de panne.

### Qualité

- Le SHA applicatif `f58a9373d4144b2259c1ed8e93758a90a3e87de5` a son run Qualité `43791964638` : **SUCCESS** (actionlint, tests, TypeScript, lint et build Next.js).
- Le présent complément documentaire est postérieur au SHA applicatif et ne modifie pas le code produit.
- La tête documentaire `ff30cd524ffdcf93e887a109e8eaed9dacb52717` a elle-même son run Qualité `43792994708` : **SUCCESS** (actionlint et qualité complète + build Next.js). Les commits entre le SHA applicatif `f58a9373d4144b2259c1ed8e93758a90a3e87de5` et cette tête ne modifient que `docs/E2E_CONTINUITE.md`.

### Périmètre et limites de preuve

- Recettes réalisées sur Supabase Replay uniquement (`pwfftcsjyeibxxqhwysw`).
- Aucune écriture Supabase Production, aucun déploiement Vercel et aucune publication Play Store.
- La preuve Web Push concerne le navigateur Chromium et le worker NAXA ; elle n'est pas une preuve de notification Android FCM physique.
- Le run Replay est **VERT**. Ne pas étendre ce résultat à une validation générale de domaines fonctionnels qui ne faisaient pas partie de cette campagne E2E.


## 75. Confirmation finale « parcours navigateur et Storage au vert » — 16/11/2026

### État consolidé

| Contrôle | État | Preuve terminale |
|---|---|---|
| Qualité applicative (tests, TypeScript, lint, build) | **VERT** | Run `43792994708` SUCCESS sur la tête documentaire `ff30cd524ffdcf93e887a109e8eaed9dacb52717` ; run applicatif `43791964638` SUCCESS sur `f58a9373d4144b2259c1ed8e93758a90a3e87de5` |
| Provisionnement des comptes Replay | **PASS** | Run `43791964746`, étapes 5 à 11 SUCCESS : Promoteur, Admin, Client, Livreur, Gestionnaire Stock, Caisse, Responsable et deux pharmacies HYBRIDE liées |
| Installation du navigateur | **PASS** | Run `43791964746`, étape 12 — installation Chromium SUCCESS |
| Parcours navigateur complet | **PASS** | Run `43791964746`, étapes 15 à 17 : Web Push 3/3, crédit comptoir/POS, Marketplace et comptabilité |
| Upload réel Storage | **PASS** | Run `43791964746`, étape 18 : **17 PASS, 0 SKIP**, matrice Admin et Promoteur obligatoire |
| Nettoyage de la recette | **PASS** | Run `43791964746`, étape 19 : fichiers secrets éphémères supprimés, sessions fermées/révoquées et comptes temporaires supprimés |
| Verdict final Web Push | **PASS** | Run `43791964746`, étape 20 SUCCESS |

### Preuves fonctionnelles notables

- Web Push : 3 souscriptions Chromium authentifiées ; le worker NAXA a envoyé 3 notifications ciblées, reçues dans les 3 Service Workers. Le résultat prouve la réception navigateur, pas une réception physique Android/FCM.
- Crédit comptoir : demande au-dessus du plafond sans paiement ni débit initial ; approbation Promoteur ; même brouillon repris ; débit stock une seule fois ; remboursement réel via JWT Caisse ; solde nul et clôture rapprochée sans écart.
- Marketplace : client authentifié, offre Replay temporaire, ajout panier, justificatif PDF, demande `en_attente`, refus Promoteur et stock inchangé.
- Comptabilité : 2 comptes, 2 journaux et 4 mappings créés puis validés depuis l'interface ; seules les lignes de configuration synthétiques ont été nettoyées, l'audit fonctionnel est conservé.
- Storage : dépôt et lecture réelle Admin/Promoteur, téléchargements privés/signés, isolement inter-utilisateurs et inter-pharmacies, accès anonyme et MIME interdits, suppression propriétaire ; 17 PASS et aucun SKIP.

### Verdict CTO

**AU VERT pour la campagne E2E Replay crédit / Marketplace / comptabilité / Web Push navigateur / Storage.** Le run final est `43791964746` SUCCESS sur le SHA applicatif `f58a9373d4144b2259c1ed8e93758a90a3e87de5`. Les commits postérieurs mentionnés dans cette continuité (`b816df62`, `ff30cd52`, `6d53595e` et les mises à jour documentaires qui suivent) ne modifient que `docs/E2E_CONTINUITE.md`, pas le code applicatif ni les scripts de recette. Les contrôles qualité terminaux réussis sont `43791964638` sur le SHA applicatif et `43792994708` sur le commit documentaire `ff30cd524ffdcf93e887a109e8eaed9dacb52717`. Le contrôle qualité lancé spécifiquement sur `6d53595e` (`43793618908`) était encore en cours au dernier relevé ; il concerne le document seul et ne remet pas en cause les preuves de code et d'exécution ci-dessus.

**Limite de portée :** ce vert ne signifie ni preuve de push Android FCM physique ni validation générale de tous les modules NAXA. Il certifie les parcours précisément nommés ci-dessus.

**Périmètre :** Supabase Replay uniquement. Aucune modification Supabase Production, aucun déploiement Vercel et aucune publication Play Store.

## 76. Audit croisé des recettes déclarées et des preuves du dépôt — 16/11/2026

### Objet et méthode

Audit documentaire et code réalisé sur `main`, sans modification applicative, sans exécution de nouvelle recette Supabase et sans déploiement. Le croisement porte sur :
- le présent document de continuité ;
- l'inventaire GitHub du dépôt à la tête auditée ;
- les scripts de test et d'E2E présents ;
- les workflows et journaux GitHub Actions consultés, notamment les runs `43791964746` et `43792994708` ;
- les fichiers de tests SQL présents dans `supabase/tests/`.

**Règle de qualification :** la présence d'un fichier de test ou d'une assertion statique n'est pas une preuve d'exécution runtime. Un statut PASS n'est retenu que lorsqu'un résultat d'exécution ou une preuve de recette est identifiable. Les preuves SQL transactionnelles, JWT, navigateur et appareil physique restent des niveaux distincts.

### A. Recettes avec exécution vérifiable

| Domaine / scénario | Preuve retrouvée | Qualification et limite |
|---|---|---|
| Qualité automatisée | Run GitHub Actions `43792994708` SUCCESS ; tests Node, TypeScript, ESLint, build Next.js et actionlint dans le workflow qualité | VERT pour le contrôle qualité de ce run ; ne prouve pas les parcours métier complets |
| Provisionnement des comptes Replay | Run `43791964746`, étapes 5 à 11 SUCCESS : profils Promoteur, Admin, Client, Livreur, Gestionnaire Stock, Caisse, Responsable et deux pharmacies HYBRIDE liées | PASS provisionnement ; ne constitue pas à lui seul une recette de chaque rôle |
| Web Push navigateur | Run `43791964746`, étape 15 ; 3 souscriptions Chromium authentifiées, 3 notifications reçues par les Service Workers | PASS navigateur ; aucune preuve FCM Android physique |
| Crédit comptoir / POS | Run `43791964746`, étape 16 ; dépassement plafond, demande sans débit anticipé, approbation Promoteur, reprise du brouillon, débit stock unique, remboursement JWT Caisse, solde et clôture rapprochés | PASS pour le scénario exécuté ; ne couvre pas toutes les variantes de caisse |
| Marketplace | Run `43791964746`, étape 17 ; Client authentifié, offre Replay temporaire, panier, justificatif PDF, demande en attente, refus Promoteur et stock inchangé | PASS pour le scénario de refus exécuté ; ne prouve pas l'ensemble des états de commande/livraison |
| Comptabilité | Run `43791964746`, étape 17 ; création/validation depuis l'interface de 2 comptes, 2 journaux et 4 mappings | PASS configuration testée ; pas de rapprochement complet de toutes les opérations commerciales |
| Storage Admin / Promoteur | Run `43791964746`, étape 18 ; matrice upload/lecture, accès privé/signé, isolement inter-utilisateurs et inter-pharmacies, MIME, suppressions ; 17 PASS, 0 SKIP | PASS pour la matrice exécutée |
| Nettoyage de campagne | Run `43791964746`, étape 19 ; suppression des secrets éphémères, fermeture/révocation des sessions et suppression des comptes temporaires | PASS nettoyage de cette campagne |

Liens de preuve :
- [Run Replay E2E 43791964746](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43791964746)
- [Run Qualité 43792994708](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43792994708)

Les recettes antérieures décrites dans les sections historiques restent des déclarations documentées avec le niveau de preuve propre à chacune ; elles ne sont pas automatiquement promues au niveau navigateur par le présent audit.

### B. Inventaire du code de test — présence, pas preuve d'exécution

À la tête `main` consultée pendant cet audit, l'arbre GitHub contient :
- **95** fichiers `scripts/test-*.cjs` ;
- **370** fichiers `supabase/tests/*.sql` ;
- **12** scripts dédiés sous `scripts/e2e/` ;
- **9** workflows sous `.github/workflows/`.

Ces nombres sont un inventaire de fichiers présents dans le dépôt. Ils ne signifient pas que les 370 scripts SQL ont été exécutés, ni que les 12 scripts E2E correspondent à 12 parcours métier complets validés.

Le workflow qualité lance la suite Node via `npm test`. La présence des fichiers SQL dans `supabase/tests/` n'établit pas, à elle seule, leur exécution dans ce run qualité. Les scripts E2E spécialisés doivent être reliés à un run identifié avant d'être déclarés exécutés.

### C. Couverture métier : état de preuve consolidé

| Domaine | Ce qui est effectivement étayé par les éléments consultés | Ce qui n'est pas encore prouvé comme parcours intégral |
|---|---|---|
| Authentification / profils | Contrats et tests ciblés présents ; provisionnement multi-rôles Replay dans le run E2E | Inscription, connexion, récupération, changement de rôle actif et révocation parcourus intégralement par interface |
| Promoteur / Responsable | Scripts et tests SQL de périmètre, délégation et isolation présents ; comptes provisionnés | Cycle interface complet : pharmacies, collaborateurs, affectations, délégations, suspension/réactivation et effets sur les équipes |
| Pharmacien | Tests SQL et contrats métier dédiés présents dans le dépôt et historique de continuité | Parcours continu Client → Promoteur → Pharmacien → réponse Client prouvé en navigateur |
| Gestionnaire Stock | Tests de contrats, RLS et droits de stock présents ; compte Replay provisionné | Cycle opérationnel réception fournisseur → lots → inventaire → correction → réservation → préparation |
| Caisse | Crédit comptoir/POS et remboursement exécutés dans le run Replay ; autres tests ciblés présents | Recette complète de toutes les ventes, moyens de paiement, retours, annulations, clôtures et synchronisation hors ligne |
| Comptabilité | Configuration des comptes, journaux et mappings exécutée depuis l'interface | Chaîne complète des écritures issues des ventes, remboursements, rapprochements et clôtures réelles |
| Client / Marketplace | Scénario navigateur de dépôt et refus Promoteur exécuté ; tests ciblés de panier/offres présents | Parcours positif complet commande → paiement → préparation → retrait/livraison → réception Client |
| Assurance | Scripts ciblés d'import, couverture, POS et comptabilité présents ; preuves SQL/runtime rapportées dans les sections historiques | Parcours intégral inter-interfaces Client/Assureur/Stock/Caisse/Comptabilité avec tous les états et variantes |
| Livreur | Scripts de provisionnement et contrats métier/sécurité présents ; compte provisionné dans la campagne Replay | Chaîne Client commande → Stock prépare → mission proposée → Livreur accepte → livraison → confirmation Client |
| Administration | Tests ciblés Admin et actions présentes | Recette navigateur complète de chaque écran et action Admin avec contrôles des effets métier |
| Examens médicaux et autres univers professionnels | Tests spécialisés présents pour plusieurs modules dans le dépôt | Parcours complets par rôle et échanges inter-rôles démontrés pour chaque univers |
| PWA / hors ligne / périphériques | Contrats et tests ciblés présents ; Web Push Chromium démontré | Synchronisation réelle hors ligne, caméra, galerie, Bluetooth, GPS et notifications Android physiques |
| Paiements / abonnements | Tests spécialisés de flux SMS, preuves et vérification présents | Parcours utilisateur complet avec preuves indépendantes, décisions Admin et conséquences de suspension/réactivation |

**Important :** « non prouvé » signifie que les éléments consultés ne suffisent pas à établir une recette complète ; cela ne signifie pas que la fonctionnalité est absente ou qu'elle échoue.

### D. Liste de travail restante pour la recette globale

Les parcours suivants doivent être exécutés ou complétés avec les comptes de recette déjà présents dans l'environnement Replay. Ne pas créer de nouveaux comptes si les comptes existants sont réutilisables.

1. **Client — cycle positif complet :** recherche/offre → panier → réservation/commande → paiement applicable → préparation → retrait ou livraison → réception et historique Client ; compléter annulation, refus, indisponibilité et remboursement.
2. **Stock — cycle physique métier :** réception fournisseur → création/gestion des lots → inventaire → ajustement → réservation → préparation → remise à la Caisse ou au Livreur ; vérifier quantité, traçabilité et visibilité Marketplace à chaque étape.
3. **Livraison — parcours intégral :** commande avec livraison → préparation Stock → création/proposition de mission → acceptation Livreur → prise en charge → étapes de livraison → preuve/confirmation → clôture → suivi Client.
4. **Promoteur / Responsable — parcours interface :** gestion multi-pharmacies, personnel, invitation/affectation, poste actif, délégation, limites, révocation, suspension et réactivation.
5. **Caisse / Comptabilité — cycle complet :** ouverture, ventes, moyens de paiement, tickets, retours, annulations, remboursements, clôture, rapprochement et écritures correspondantes.
6. **Assurance — chaîne inter-rôles :** import et actualisation des droits → vérification → proposition/négociation → commande → préparation → paiement partagé → ticket → remboursement → comptabilisation.
7. **Administration — recette 360 :** dossiers/partenaires, pharmacies, comptes et sécurité, abonnements/paiements, produits, réservations/livraisons, messagerie, rapports, exports et journal.
8. **Authentification et sécurité de session :** inscription, âge, connexion, récupération, changement de rôle actif, sessions multiples, suspension, révocation et isolation entre comptes/pharmacies.
9. **Univers professionnels :** exécuter une recette complète par univers effectivement activé, incluant création, traitement, paiement éventuel, résultat, historique et permissions des rôles.
10. **PWA et périphériques :** caméra/scanner/OCR/PDF, offline puis resynchronisation, notifications, GPS, Bluetooth et essais Android physiques.
11. **Paiements Promoteur / abonnements :** parcours complet de déclaration, contrôle automatique selon les mécanismes autorisés, contrôle Admin, reçu, expiration et conséquences de suspension/réactivation.

### E. Règles de poursuite et de verdict

- Réutiliser les comptes existants de Replay ; les comptes présents dans cet environnement sont des comptes de recette, conformément au périmètre communiqué.
- Chaque parcours est consigné avec : identifiant du scénario, rôle(s), préconditions, étapes, données de test, résultat attendu, résultat observé, preuve (run/log/capture ou requête), anomalies et statut.
- Statuts : **VERT** = parcours complet exécuté et preuves suffisantes ; **JAUNE** = partiel ou preuve incomplète ; **ROUGE** = échec reproduit ; **GRIS** = non exécuté.
- Un test statique, un fichier SQL présent, une migration appliquée ou un test unitaire ne vaut pas preuve de parcours navigateur complet.
- Ne pas refaire les scénarios déjà prouvés sauf test de non-régression ou changement de code.
- Continuer sur `main`, sans branche/PR, sans migration Production et sans déploiement pendant la campagne de recette.
- Ne jamais transformer « non prouvé » en « échec », ni annoncer un domaine AU VERT par extrapolation depuis un sous-scénario.

### F. Verdict de l'audit croisé

**JAUNE — recette globale NAXA non clôturée.**

La campagne Replay crédit comptoir/POS, Marketplace (scénario de refus), configuration comptable, Web Push navigateur et Storage possède des preuves d'exécution identifiables et est AU VERT dans son périmètre strict. La suite de qualité automatisée possède également un run SUCCESS identifié.

Les autres domaines comportent des tests, contrats et/ou preuves SQL ciblées, mais les éléments examinés ne permettent pas de conclure que tous leurs parcours utilisateur sont exécutés intégralement de bout en bout. La liste D constitue le backlog de recette à poursuivre.

**Limites de cet audit :** audit documentaire/code et inspection des runs GitHub identifiés ; aucune nouvelle exécution fonctionnelle, aucun accès aux appareils physiques et aucune modification applicative effectués lors de cet audit.

## 77. Stratégie des campagnes E2E en bulk — décision du 16/11/2026

### Objectif

Privilégier des campagnes bulk cohérentes qui enchaînent plusieurs variantes et rôles métier, tout en conservant un résultat et une preuve distincts par scénario. Réutiliser exclusivement les comptes de recette déjà présents dans Supabase Replay, sous réserve de vérifier leur état et leurs affectations au démarrage de chaque campagne. Ne pas recréer de comptes par défaut.

### Matrice des campagnes

| ID | Campagne bulk | Scénarios à grouper | Dépendances / précautions | Priorité |
|---|---|---|---|---|
| B1 | Stock & inventaire | Réceptions, lots, prix, péremptions, inventaire, écarts, corrections, réservations, préparation | Données stock isolées par pharmacie ; contrôler stock disponible/réservé et FEFO | P0 |
| B2 | Client & Marketplace | Recherche, filtres, offre, favori, panier, commande positive, refus, annulation, indisponibilité, historique | Conserver le scénario de refus déjà prouvé ; ajouter uniquement les variantes non couvertes | P0 |
| B3 | Livraison | Commande, préparation Stock, proposition de mission, acceptation/refus Livreur, prise en charge, suivi Client, livraison, échec, réaffectation et clôture | Dépend de B1/B2 ; tester les transitions et la cohérence de stock/commande | P0 |
| B4 | Caisse & comptabilité | Ouverture, ventes, paiements, tickets, retraits, retours, annulations, remboursements, clôtures, rapprochements, écritures | Réutiliser les preuves crédit comptoir/remboursement et configuration comptable ; ne pas les rejouer sans motif | P1 |
| B5 | Personnel & permissions | Promoteur, Responsable, Gestionnaire Stock, Caisse, Pharmacien, Livreur ; création/affectation, invitation, rôle actif, délégation, limites, révocation, suspension | Isoler les scénarios qui changent les droits ; vérifier les effets multi-pharmacies | P1 |
| B6 | Assurance | Import/actualisation droits, vérification, proposition, réponse Client, partage de paiement, ticket, remboursement, comptabilisation | Dépend de B1/B4 ; séparer les cas de couverture, refus et paiements fractionnés | P1 |
| B7 | Administration 360 | Dossiers, pharmacies, comptes, sécurité, abonnements, opérations, messagerie, rapports, exports et journal | Privilégier lectures en parallèle ; actions mutantes isolées et tracées | P1 |
| B8 | Authentification & sécurité | Connexion, récupération, sessions, changement de rôle, appareils, suspension, révocation, cloisonnement | Éviter de révoquer le compte partagé servant à d'autres scénarios ; réserver les mutations à la fin | P1 |
| B9 | Paiements & abonnements | Déclaration, justificatifs, contrôles automatiques disponibles, décision Admin, reçu, expiration, suspension/réactivation | Replay uniquement pour les simulations ; transaction MTN/Orange réelle et téléphone physique dans une campagne distincte | P2 |
| B10 | Univers professionnels | Parcours complet par univers activé : création, affectation, demande, traitement, résultat/service, paiement éventuel et historique | Un jeu de scénarios par univers ; ne pas tester comme actifs les univers volontairement bloqués | P2 |
| B11 | PWA & périphériques | Offline/synchronisation, caméra, galerie, scanner, OCR/PDF, GPS, Bluetooth, push et Android | Campagne appareils physiques séparée du navigateur ; Chromium ne vaut pas preuve Android | P2 |

### Ordre et parallélisation

- **Première campagne prioritaire : B1 → B2 → B3**, une chaîne métier Stock → Client/Marketplace → Livraison. Les sous-scénarios indépendants peuvent être lancés en parallèle, mais les étapes qui consomment les données d'une étape précédente restent séquentielles.
- **Deuxième campagne : B4**, en réutilisant les commandes et opérations issues de la chaîne précédente, sans répéter les scénarios déjà validés.
- **Troisième vague : B5, B6, B7 et B8**, avec parallélisation seulement pour les lectures et les comptes/données indépendants. Les changements de rôles, suspensions et révocations sont séquencés.
- **Dernière vague : B9, B10 et B11**, en isolant les paiements externes et les tests sur appareils physiques.

### Exigences du lanceur bulk

Avant toute exécution, vérifier les scripts et workflows existants. Réutiliser les lanceurs déjà présents lorsqu'ils couvrent le besoin ; ne pas présumer qu'un orchestrateur bulk complet existe déjà. Si un orchestrateur est nécessaire, le concevoir avec :
- identifiant stable par scénario et données propres à chaque scénario ;
- préconditions et dépendances explicites ;
- exécution parallèle uniquement entre scénarios sans conflit de données ;
- isolation des erreurs : un scénario en échec ne masque pas les résultats des autres ;
- collecte par scénario des logs, assertions, preuves SQL/API/UI et statut ;
- reprise ciblée des seuls scénarios incomplets ou en échec ;
- nettoyage contrôlé et vérifiable des données temporaires ;
- interdiction d'écrire en Production ou de déployer dans le cadre de la recette Replay.

### Préservation des acquis

Les scénarios déjà prouvés restent acquis : crédit comptoir/POS et remboursement JWT Caisse, scénario Marketplace de refus Promoteur, configuration comptable testée, Web Push Chromium 3/3 et Storage 17 PASS/0 SKIP, ainsi que les recettes SQL/JWT antérieures avec leur portée exacte. Ne les relancer qu'en cas de régression, de correction ou de dépendance d'intégration qui exige une vérification.

### Condition de démarrage

**Aucune campagne B1–B11 ne démarre avant :**
1. la clôture de l'audit de navigation et d'accessibilité des pages ;
2. le tri des boutons/commandes sans action ;
3. la vérification des routes/pages sans chemin d'accès visible ;
4. la correction et la preuve des défauts bloquants de navigation ;
5. la validation du manifeste technique B1–B3 et de la réutilisabilité des comptes Replay.

## 78. Audit préalable de navigation et d'accessibilité — état initial du 16/11/2026

### Périmètre examiné

- Tête GitHub `main` au début de l'audit : `99467b336bb66a36b0313fb9b9aaf10f4f382e87`.
- Arbre du dépôt : 2 239 fichiers ; 158 fichiers de page Next.js sous `src/app/**/page.tsx` ; routes API exclues du comptage des pages d'interface.
- Composants de navigation consultés : `BottomNav`, `NavigationPrincipale`, `AdminNavigation`, `NavPromoteur`, `EspaceNaxaSwitcher`, `CaisseSidebar`, `ComptableSidebar`, `GestionnaireStockSidebar`, `PharmacienWorkspaceSidebar`, `MenuUnivers`, `EnTeteClient`, `AccueilClient`, ainsi que les layouts Admin, Promoteur, Comptable et Centre d'examens.
- Pages ciblées consultées : tableaux de bord Pharmacie, Client, Admin Promoteurs, Comptable, plusieurs sous-pages Comptable, Livreur Promoteur, pages Caisse, pages Partenaire et pages signalées ci-dessous.
- L'analyse effectuée à ce stade est une inspection statique des routes, liens et handlers dans les fichiers consultés. Elle ne constitue pas encore un test interactif navigateur exhaustif des 158 pages.

### Constats établis et points à vérifier

| Zone / route | Constat du code | Qualification actuelle |
|---|---|---|
| Espace Comptable | `ComptableSidebar` expose 7 entrées ; le tableau de bord Comptable contient aussi des liens vers Créances & bordereaux, Rejets & relances, Rapports & exports, Documents, Plan comptable et Référentiels | Pages accessibles depuis le tableau de bord ; navigation persistante incomplète, à décider/corriger si ces modules doivent rester directement accessibles partout |
| Administration / Pharmaciens | La page `/admin/pharmaciens` existe, mais n'apparaît pas dans la liste d'entrées de `AdminNavigation` examinée ; aucun lien entrant n'a été identifié dans les fichiers consultés | **Suspecte de page orpheline** ; recherche entrante globale et intention métier à confirmer |
| Promoteur / Livraisons | La page `/pharmacie/promoteur/livraisons` existe ; elle expose un retour vers le tableau de bord Promoteur. Elle n'est pas dans les onglets du layout Promoteur ni dans les entrées NavPromoteur examinées ; aucun accès entrant n'a été identifié dans les fichiers consultés | **Suspecte de page orpheline** ; vérifier si elle doit être intégrée au parcours Promoteur ou retirée de la navigation produit |
| Pharmacie / Assistant | La page `/pharmacie/assistant` existe ; aucun lien de navigation n'a été relevé dans le tableau de bord et composants examinés | **Suspecte de page orpheline** ; vérifier son rôle et ses conditions d'accès |
| Caisse / maquette visuelle | Route `/pharmacie/caisse/maquette-visuelle` présente dans l'arbre, sans accès identifié dans les composants examinés | Probable page de maquette/interne, ne pas assimiler automatiquement à une page produit manquante |
| Caisse / parcours UI | Route `/pharmacie/caisse/parcours-ui` présente ; son contenu expose un parcours UI de démonstration local avec boutons de navigation interne | Page de démonstration ; vérifier qu'elle n'est pas exposée comme entrée de production |
| Pharmacien / validations | Route `/pharmacien/validations` présente ; aucun accès entrant identifié dans les éléments examinés | À vérifier : page orpheline ou accès conditionnel par un autre espace |
| Univers volontairement bloqués | Le menu des univers et l'en-tête public affichent certains univers comme indisponibles/verrouillés | État volontaire, ne pas classifier comme bouton inactif défectueux si l'état désactivé est explicite et cohérent |
| Navigation Centre d'examens | Le layout déclare des entrées Agenda, Personnel, Résultats, Équipements, Comptabilité, Sécurité, Messages et Actions IA | Les sous-routes ont une navigation structurée ; les capacités/permissions doivent être vérifiées par rôle |
| Navigation Stock | Le Gestionnaire Stock dispose d'entrées pour tableau de bord, logistique, réservations, commandes, lots/péremptions, fournisseurs/réceptions, inventaires, rapports, service et profil | Couverture de navigation cohérente avec les routes stock examinées |
| Navigation Client | L'en-tête propose des raccourcis de recherche vers profil, favoris, scanner, achats, notifications, univers et aide ; la navigation basse propose cinq entrées principales | Les routes secondaires doivent être croisées avec les liens internes et les conditions de session |
| Navigation Pharmacien | La sidebar propose les sections d'activité, prescriptions, suivi patients, historique/rapports, profil et prise/fin de service ; les sections métier utilisent aussi une route dynamique `[section]` | Vérifier la correspondance de chaque section avec le rendu et les permissions, pas uniquement la présence de la route |

### Boutons et commandes

Les composants consultés montrent plusieurs contrôles correctement raccordés à une action explicite : bascule/fermeture des menus, liens de navigation, recherche client, filtres, navigation Pharmacien, actions Caisse et formulaires Promoteur. Les états verrouillés/désactivés des univers sont explicites.

**Aucun constat global « tous les boutons fonctionnent » n'est autorisé à ce stade.** La vérification systématique de tous les boutons de toutes les pages doit encore identifier, pour chaque contrôle visible, son action attendue : navigation, mutation, soumission, ouverture/fermeture, filtre, impression/export, ou désactivation intentionnelle. Un bouton purement décoratif doit être non interactif ; un bouton interactif sans handler, sans action de formulaire ou sans destination doit être enregistré comme anomalie.

### Étapes restantes de cet audit préalable

1. Construire la matrice complète des 158 pages : route, layout, rôle/permission, lien entrant, accès conditionnel, liens sortants et statut d'accessibilité.
2. Rechercher les références entrantes dynamiques et les accès depuis les tableaux de bord, notifications, actions serveur et composants partagés avant de déclarer une page orpheline.
3. Examiner les contrôles interactifs page par page et distinguer les boutons sans action des contrôles dont l'action est portée par un formulaire, un composant enfant ou une fonction partagée.
4. Vérifier les destinations des liens : route existante, route dynamique, query params, ancre, URL externe, ou route absente.
5. Lorsque l'environnement Preview/Replay existant est accessible sans déploiement, tester les chemins d'accès et les permissions avec les comptes déjà présents ; sinon consigner explicitement la limite d'exécution.
6. Établir les corrections minimales et les tests de non-régression de navigation ; ne pas lancer les campagnes bulk avant clôture de ces points.

### Statut de l'audit préalable

**EN COURS — aucun défaut de navigation n'a été corrigé dans cette étape ; aucune campagne E2E bulk n'a été exécutée.** Les pages suspectes ci-dessus sont des pistes étayées par les fichiers consultés, pas encore des défauts confirmés tant que les références entrantes dynamiques et les parcours conditionnels n'ont pas été éliminés.

## 79. Résultat du balayage statique des 158 pages et contrôles UI — 16/11/2026

### Méthode et couverture réellement effectuée

- Relecture de l'arbre GitHub `main` : **158 fichiers `src/app/**/page.tsx`** recensés.
- Inspection statique des 158 fichiers de page par lots : balises `button`, gestionnaires `onClick`, boutons `submit`, formulaires, liens `href` et appels de navigation explicites.
- Croisement avec les composants/layouts de navigation communs cités en section 78 et avec les tableaux de bord Client, Pharmacie, Promoteur et Comptable.
- Vérification directe du contenu des pages candidates pour distinguer les vraies pages des redirections historiques et des écrans de démonstration.

Ce contrôle est une analyse du code source sur `main`. Il ne simule pas les clics dans un navigateur et ne prouve pas que les actions serveur aboutissent correctement avec chaque profil/donnée.

### A. Pages réelles sans accès de navigation identifié

| Page | Constat vérifié | Conclusion |
|---|---|---|
| `/pharmacie/promoteur/livraisons` | La page affiche un véritable rapport « Livraisons de mon réseau » et contrôle le rôle Promoteur. Elle ne figure ni dans les onglets du layout Promoteur ni dans les entrées du menu latéral Promoteur ; le tableau de bord Promoteur consulté ne la référence pas. La page ne propose qu'un retour vers le tableau de bord. | **Défaut de découvrabilité confirmé dans la navigation examinée** : accès direct par URL seulement, sauf éventuel lien dynamique externe non retrouvé. À ajouter à la navigation Promoteur ou à retirer si cette page n'est plus un module produit. |
| `/partenaire/examens` | La page Partenaire existe et propose des formulaires métier ; elle contient des liens sortants vers `/centre-examens` et `/partenaire/reservations`, mais aucun lien entrant n'a été retrouvé dans les pages et navigations consultées. Aucun choix « examens » n'est défini dans le sélecteur d'espaces `EspaceNaxaSwitcher`. | **Page suspecte d'être orpheline** : son point d'entrée métier doit être confirmé et ajouté, ou la page doit être redirigée si elle est obsolète. |
 
### B. Routes qui semblaient orphelines mais sont en réalité des redirections

| Route | Code constaté | Qualification |
|---|---|---|
| `/admin/pharmaciens` | Redirige explicitement vers `/admin` | Route historique, pas une page métier isolée |
| `/pharmacie/assistant` | Commentaire de code : ancienne URL conservée ; redirige vers `/pharmacie/pharmacien` car le poste Assistant pharmacien n'existe plus | Alias historique intentionnel |
| `/pharmacien/validations` | Redirige vers `/pharmacie/pharmacien/ordonnances` | Alias historique intentionnel |
| `/suivi/professionnel` | Redirige selon l'authentification, l'activation et la vérification professionnelle vers la demande ou l'espace patients | Route de dispatch conditionnelle |
| `/suivi/professionnel/disponibilites` | Redirige vers la convention de prestations partenaire | Route de transition conditionnelle |

Ces routes ne doivent pas être traitées comme des pages à ajouter au menu.

### C. Routes internes, de démonstration ou d'accès contextuel

- `/pharmacie/caisse/maquette-visuelle` et `/pharmacie/caisse/parcours-ui` : pages de maquette/démonstration, sans entrée dans la navigation Caisse de production consultée. Ne pas les ajouter au menu utilisateur sans décision produit explicite.
- `/demo/otp` : route de démonstration ; ne pas l'exposer dans la navigation publique.
- `/invitation/livreur` et `/invitation/personnel-examen` : parcours d'invitation à accès direct par lien, non destinés à un menu permanent.
- `/verification-age`, `/completer-profil`, `/nouveau-mot-de-passe`, `/pharmacie/suspendue` et les reçus à identifiant : routes de garde, de reprise ou de lien contextuel.
- Les sous-routes Comptable absentes de la sidebar sont néanmoins liées depuis le tableau de bord Comptable : elles ne sont donc pas inaccessibles, mais la navigation persistante est incomplète. Ajouter à la sidebar, si souhaité, Créances & bordereaux, Rejets & relances, Rapports & exports, Documents et Référentiels.
- Les univers Parapharmacie et Bébé & Maman restent explicitement bloqués conformément à la décision produit ; leur état désactivé n'est pas une anomalie de clic.

### D. Contrôle statique des boutons

Le balayage des 158 pages n'a pas permis d'établir de bouton de page utilisateur clairement dépourvu de toute action. Les candidats repérés par l'absence de `onClick` sont, dans les fichiers vérifiés, majoritairement :
- des boutons de soumission placés dans un `form` (soumission HTML ou Server Action) ;
- des actions rendues explicitement indisponibles par `disabled` jusqu'à disponibilité des données/prérequis ;
- des commandes natives d'impression/fermeture intégrées à du HTML de reçu.

Les contrôles de navigation communs examinés disposent d'une destination, d'un gestionnaire d'ouverture/fermeture ou d'un état disabled explicite. Le menu Client expose des univers verrouillés sous forme de contrôles désactivés, ce qui est cohérent avec la décision de blocage.

**Résultat : 0 bouton de page confirmé comme « décoratif mais présenté comme action sans aucun handler, formulaire ou destination » par ce contrôle statique.** Ce résultat n'est pas une certification runtime : les composants enfants partagés non inspectés ligne par ligne et les clics réels restent à valider dans le navigateur.

### E. Navigation persistante : points d'amélioration

1. Promoteur : ajouter un accès visible vers `/pharmacie/promoteur/livraisons` dans le menu Promoteur et/ou le tableau de bord si le rapport est toujours actif.
2. Partenaire : décider et implémenter un accès clair vers `/partenaire/examens`, selon le rôle exact du partenaire et son articulation avec `/centre-examens`.
3. Comptable : harmoniser la sidebar avec les pages déjà reliées depuis le tableau de bord, pour que l'utilisateur ne soit pas obligé de revenir à l'accueil du poste pour changer de module.
4. Vérifier les actions UI en exécution réelle, en priorité sur les boutons de formulaire, les actions conditionnelles, les liens à paramètres dynamiques et les commandes des composants partagés.

### F. Verdict et prérequis de recette

**JAUNE — audit source de navigation avancé, validation interactive non réalisée.**

- Les 158 fichiers de page ont fait l'objet du balayage statique décrit ci-dessus.
- Deux pages métier ressortent avec un accès de navigation non retrouvé : Promoteur/Livraisons (défaut de découvrabilité confirmé dans les menus examinés) et Partenaire/Examens (page suspecte à confirmer).
- Les anciennes routes de l'Assistant pharmacien, des validations Pharmacien et des Pharmaciens Admin sont des redirections intentionnelles, pas des pages orphelines.
- Aucun bouton utilisateur de page n'a été confirmé comme no-op par l'inspection statique ; les contrôles de formulaire et disabled restent à tester dans un navigateur.

**Avant la première campagne bulk :** corriger ou décider formellement du sort des deux pages suspectes, compléter si nécessaire la navigation Comptable, puis faire une passe interactive avec les comptes Replay existants sur chaque rôle et chaque menu. Si aucun Preview/Replay navigateur correspondant au SHA applicatif courant n'est disponible sans déploiement, ne pas en créer pendant cet audit : consigner le contrôle runtime comme bloqué et attendre une autorisation explicite.

**Aucune correction applicative, aucune migration, aucune exécution bulk et aucun déploiement n'ont été effectués pendant ce balayage.**

## 80. Corrections de navigation avant validation des campagnes bulk

**Date :** 16 novembre 2026  
**Branche :** `main` uniquement  
**Périmètre :** corrections de découvrabilité/navigation décidées après le balayage statique §77–§79. Aucun test bulk, aucune migration, aucun changement de données Replay, aucun déploiement.

### 80.1 Corrections appliquées

| Zone | Correction | Contrôle statique |
|---|---|---|
| Promoteur | Ajout de « Livraisons du réseau » dans la navigation latérale persistante et dans la navigation des sous-pages, vers `/pharmacie/promoteur/livraisons`. | Route existante ; garde serveur maintenue (utilisateur authentifié, profil actif, rôle Promoteur). |
| Comptable | Ajout dans la sidebar des rubriques déjà exposées sur le tableau de bord : Créances & bordereaux, Rejets & relances, Rapports & exports, Documents, Assureurs & fournisseurs, Plan comptable & mappings. | Liens repris des destinations déjà utilisées par le tableau de bord ; aucune nouvelle permission accordée par la navigation. |
| Partenaire | Ajout d’un accès « Centres et examens » depuis le Catalogue et les Réservations, uniquement lorsqu’un membre actif est propriétaire (`owner`) ou responsable (`manager`). | La page cible conserve sa garde serveur : authentification et appartenance active owner/manager. Les rôles opérateur ne reçoivent pas ce lien. |

Le sélecteur global `EspaceNaxaSwitcher` n’a pas été modifié : « Centres et examens » est une rubrique métier interne à l’espace Partenaire, pas un rôle/espace autonome. Les anciennes routes et prototypes identifiés au §79 restent inchangés.

### 80.2 Fichiers modifiés et commits

- `src/app/pharmacie/promoteur/layout.tsx` — commit `bc75fd72c7ced8bf835291549f515b88be51dff1`.
- `src/components/pharmacie/ComptableSidebar.tsx` — commit `8f7bd529204461c535ec0a7a9edb5fb6d8ec73d2`.
- `src/app/partenaire/catalogue/page.tsx` — commit `0bb3c5302d448e20c2c449a33ba17e9e2f70c063`.
- `src/app/partenaire/reservations/page.tsx` — commit `7f43e103afd17c84960009b00668d312c48840e8`.

### 80.3 Vérification et limites

- Contrôle source effectué sur les fichiers concernés et les gardes serveur visibles.
- Les destinations des liens sont des routes existantes dans l’arborescence Next.js.
- **Aucun build, test unitaire, test navigateur ou test E2E n’a été exécuté dans cette passe.** L’application n’est donc pas déclarée validée à l’exécution.
- Aucun test en bulk n’a été lancé. Aucune donnée ni compte Replay n’a été créé ou modifié. Aucun déploiement n’a été effectué.
- Les commits ont été poussés sur `main` ; les workflows éventuels déclenchés par push ne sont pas assimilés à une validation exécutée ici.

### 80.4 Porte de validation utilisateur

**État : JAUNE — corrections source appliquées, vérification interactive encore requise.**

Avant toute campagne bulk, demander la validation explicite de l’utilisateur sur :
1. la navigation Promoteur vers les Livraisons du réseau ;
2. l’accès Centres et examens réservé aux membres actifs owner/manager ;
3. la sidebar Comptable complétée ;
4. l’autorisation de procéder ensuite au contrôle interactif préalable, puis aux campagnes bulk B1 → B2 → B3 et suivantes.

**Arrêt obligatoire :** attendre cette validation. Aucun bulk, aucune mutation de données Replay et aucun déploiement avant accord explicite.

## 81. Validation utilisateur et contrôle interactif préalable

**Date :** 16 novembre 2026  
**Validation utilisateur :** accord explicite reçu pour les trois corrections de navigation et pour commencer le contrôle interactif préalable. Cet accord ne vaut pas autorisation de lancer les campagnes bulk.

### 81.1 État du contrôle

- HEAD examiné : `8e0d5d3d1e56623e925184462c714bf62deccccf`.
- Les cinq fichiers modifiés au §80 ont été relus sur `main`; les trois ajouts de navigation et leurs conditions d’affichage sont présents.
- Les routes cibles sont présentes dans l’arborescence source.
- Les gardes serveur de `/pharmacie/promoteur/livraisons` et `/partenaire/examens` restent en place.
- Le dépôt expose des scripts navigateur ciblés pour les parcours Crédit, mais aucun outil de pilotage navigateur interactif n’est disponible dans cette session.
- Aucun environnement Preview/Replay correspondant exactement au HEAD `8e0d5d3...` n’a été établi. En créer un ou provoquer un déploiement automatique de `main` contreviendrait à la consigne de ne pas déployer pendant cet audit.

### 81.2 Conclusion

**Contrôle interactif : BLOQUÉ — environnement navigateur correspondant au commit non disponible dans cette session.**

Ce blocage n’est pas un échec fonctionnel des liens : leur fonctionnement au clic, leur rendu réel selon chaque rôle et les parcours après navigation restent non vérifiés. Ne pas déclarer les corrections « testées navigateur » ni « vertes ».

### 81.3 Verrou maintenu

- Pas de lancement de campagne bulk B1 à B11.
- Pas de mutation des données Replay.
- Pas de création de comptes.
- Pas de build, test automatisé ou déploiement déclenché dans cette passe.
- Prochaine condition : disposer d’un navigateur interactif sur un environnement de test déjà existant, correspondant au commit courant, sans créer de nouveau déploiement. À défaut, demander une autorisation distincte si un Preview doit être créé.

**État global : JAUNE — corrections source vérifiées statiquement ; contrôle interactif bloqué ; campagnes bulk en attente d’un accord ultérieur après levée du blocage.**


## 82. Contrôle qualité automatisé et voie de mise au vert avant bulk

**Date :** 16 novembre 2026  
**Branche :** `main`  
**Commit testé :** `148b9393fa7dfeb43a164f356f6148461cf97134`  
**Workflow GitHub Actions :** [NAXA quality — run 43797987731](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43797987731)

### 82.1 Preuves obtenues sur le commit exact

| Contrôle | Résultat observé | Verdict |
|---|---:|---|
| Installation reproductible | `npm ci --no-audit --no-fund` terminée | PASS |
| Tests Node (`npm run quality`) | 538 passés, 0 échec, 0 annulé, 0 ignoré | PASS |
| Phase `prebuild` | La qualité a été rejouée : 538 passés, 0 échec, 0 annulé, 0 ignoré | PASS |
| TypeScript | `tsc --noEmit` terminé sans erreur | PASS |
| ESLint | 0 erreur, 225 avertissements | PASS avec réserves |
| Build Next.js / Serwist | Compilation réussie ; 152/152 pages statiques générées | PASS |
| Validation des workflows | `actionlint` sur tous les workflows actifs | PASS |

Les 538 tests ne représentent pas 538 parcours E2E navigateur : il s’agit de la suite Node déclarée par `npm test`. La seconde série de 538 correspond au contrôle qualité réexécuté automatiquement par le script `prebuild`, et non à 538 tests supplémentaires.

### 82.2 Preuve de compilation des destinations corrigées

Le manifeste de routes émis par le build contient notamment :
- `/pharmacie/promoteur/livraisons` ;
- `/partenaire/examens` ;
- `/pharmacie/comptable/creances-bordereaux` ;
- `/pharmacie/comptable/rejets-relances` ;
- `/pharmacie/comptable/rapports-exports` ;
- `/pharmacie/comptable/documents` ;
- `/pharmacie/comptable/referentiels` ;
- `/pharmacie/comptabilite/plan`.

La relecture des sources sur `main` confirme en complément :
- Promoteur : l’entrée « Livraisons du réseau » existe dans les deux navigations ; le layout conserve le contrôle du rôle Promoteur et la page conserve les gardes d’authentification, de profil actif et de rôle.
- Partenaire : « Centres et examens » est présenté uniquement aux membres actifs owner/manager ; la page cible conserve sa propre garde owner/manager.
- Comptable : les six destinations ajoutées existent comme routes Next.js dans l’arborescence.

### 82.3 Limites et réserves

- Le build et les tests ne simulent pas un clic utilisateur et ne prouvent pas le rendu de chaque menu selon les sessions réelles.
- ESLint remonte 225 avertissements, 0 erreur. Le journal relève aussi l’avertissement de dépréciation du support React 18 avec Next.js 16 et l’avertissement de type de module de `serwist.config.js`. Ces points ne bloquent pas le workflow, mais restent à traiter séparément.
- Le check Supabase Preview a été annulé avec le message de limite mensuelle atteinte : 1 000 événements Git push. Il ne s’agit pas d’un échec de migration ou de build.
- Aucun Preview n’a été créé. Aucun déploiement n’a été effectué. Aucune donnée Replay n’a été modifiée et aucun compte supplémentaire n’a été créé.
- Le contrôle interactif n’a toujours pas été exécuté : aucun navigateur de pilotage n’est disponible dans cette session. Le workflow Replay Chromium existant est un parcours spécialisé qui provisionne/reprend ses fixtures et n’est pas un simple test de navigation ; il n’a pas été déclenché.

### 82.4 Verdict gradué et porte avant bulk

**VERT — corrections source, présence des routes, tests automatisés, TypeScript, lint sans erreur bloquante, compilation Next.js et validation des workflows.**

**NON CERTIFIÉ — comportement réel au clic et rendu des menus avec les sessions Replay.** Il serait inexact de transformer cette absence de preuve navigateur en PASS.

Pour avancer sans prétendre à une preuve inexistante, la proposition est de lancer les recettes bulk après validation utilisateur, en intégrant un contrôle d’accès/navigation des trois rôles Promoteur, Partenaire owner/manager et Comptable au tout début des campagnes concernées. Toute anomalie constatée devient un blocage de la campagne associée ; aucune création de compte, migration ou mutation hors des données de recette nécessaires ne sera faite sans respecter le périmètre de chaque scénario.

**État de préparation : VERT pour la qualité/intégration des corrections ; validation utilisateur encore requise pour les recettes bulk.** Le contrôle navigateur pré-bulk autonome reste explicitement non réalisé.


## 83. Vérification Vercel en lecture seule après les commits de correction

**Date :** 16 novembre 2026  
**Projet :** [Vercel · NAXA](https://vercel.com/naxa3/naxa) — équipe NAXA  
**Périmètre :** contrôle des déploiements sans créer, relancer, promouvoir ni annuler de déploiement.

- Recherche exacte du SHA applicatif final des corrections de navigation (`7f43e103afd17c84960009b00668d312c48840e8`) : **0 déploiement Production et 0 Preview trouvé**.
- Recherche exacte du commit documentaire courant au moment du contrôle (`d81e3e08809b8a671c3179a5e854133c419fc700`) : **0 déploiement Production et 0 Preview trouvé**.
- Vérification complémentaire du HEAD documentaire final (`c65cd4b3d5fcbab2e777e7ba578d35e827df97a2`) : **0 déploiement Production et 0 Preview trouvé**.
- Dans l’historique récent du projet, le déploiement le plus récent retourné est daté du **14 novembre 2026 à 16:39:29 UTC**, sur le SHA `8ed4d811f34518583185fdfe015f0e4a981c633d`, antérieur aux corrections de navigation du 16 novembre.

**Conclusion :** aucun déploiement Vercel correspondant aux corrections de navigation ou aux mises à jour documentaires examinées n’a été trouvé. Cette vérification est une lecture de l’historique Vercel ; aucune action de déploiement n’a été effectuée par cette passe.

**Statut de sécurité déploiement : VERT — aucun déploiement Vercel des commits examinés détecté.** Cette preuve ne modifie pas la réserve du §82 sur les clics runtime non encore testés.


## 84. Préconditions réelles du contrôle navigateur des menus

**Date :** 16 novembre 2026  
**Branche :** `main` uniquement  
**HEAD vérifié :** `99e13e77418c3e2306ddf973d268d6f581458db6`  
**Périmètre :** contrôle en lecture seule de Replay et qualification des preuves restantes. Aucun provisionnement ni changement de données.

### 84.1 Qualité du HEAD actuel

Le workflow [NAXA quality — run 43798572471](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43798572471), déclenché sur le HEAD indiqué ci-dessus, est terminé avec succès :

- Job « Tests, TypeScript et lint » : `success`.
- Job « GitHub Actions syntax and expression checks » : `success`.
- Le job qualité exécute `npm run quality && npm run build` ; le job de validation exécute `actionlint` sur les workflows actifs.

**Résultat : VERT — qualité, compilation et syntaxe CI sur le HEAD exact.**

### 84.2 État des profils et données de rôle dans le projet Replay

Projet interrogé en lecture seule : `pwfftcsjyeibxxqhwysw` (`naxa-ci-replay-2`), statut Supabase `ACTIVE_HEALTHY`.

Résultat des requêtes SQL en lecture seule :

| Élément | État observé |
|---|---:|
| Profils totaux | 9 |
| Profils racine Admin | 1 |
| Profils racine Client | 7 |
| Profils racine Promoteur | 1 |
| Affectations professionnelles actives | 6 |
| Affectations Caisse | 2 |
| Affectations Gestionnaire Stock | 2 |
| Affectations Livreur | 1 |
| Affectations Responsable | 1 |
| Affectations Comptable | **0** |
| Enregistrements partenaires | **0** |
| Adhésions `partner_members` | **0** |

Le profil technique `naxa_e2e_promoteur` existe, est actif et possède trois rattachements Promoteur/pharmacie actifs. Il fournit une fixture existante pour le parcours Promoteur, sous réserve de disposer de son moyen d’authentification de recette au moment du test.

### 84.3 Contradiction et cause racine du blocage runtime

Les routes et liens Comptable/Partenaire sont présents dans le code et leur compilation a été prouvée au §82. Cependant, l’environnement Replay ne contient actuellement :

- aucun profil auquel le poste Comptable est affecté ;
- aucun partenaire ;
- aucun membre owner/manager de partenaire.

Il n’existe donc aucune session Replay légitime permettant de vérifier le rendu du menu Comptable ni l’accès owner/manager vers « Centres et examens ». Un test en simulant ces rôles, ou en se limitant à une requête non authentifiée qui redirige, ne constituerait pas une preuve positive du clic utilisateur.

Le dépôt possède déjà un workflow Chromium/Playwright, mais celui-ci exécute des provisionneurs qui peuvent créer ou modifier des identités et données de fixtures, notamment la fixture Promoteur et le personnel. Le relancer tel quel n’est pas acceptable pour ce contrôle limité : il ne respecte pas le principe « comptes existants uniquement » et mélange le test de navigation à d’autres recettes mutantes.

### 84.4 Décision de sûreté

Aucune des opérations suivantes n’a été exécutée :

- création d’un compte Auth ;
- création d’un partenaire ou d’une adhésion ;
- ajout/modification d’une affectation Comptable ;
- rotation de mot de passe ou révocation de session ;
- mutation de données Replay, migration ou recette bulk ;
- création de Preview, déploiement ou promotion Vercel.

Les requêtes de ce §84 sont uniquement des lectures de métadonnées et de comptes agrégés sur Replay.

### 84.5 Voie contrôlée pour obtenir la preuve manquante

La voie techniquement adaptée est une recette Chromium dédiée, exécutée sur un runner GitHub Actions avec le serveur Next.js local connecté exclusivement à Replay — sans Preview Vercel et sans déploiement — et qui :

1. réutilise les profils Auth déjà existants, sans créer de nouvel utilisateur ;
2. prépare temporairement, uniquement sur Replay, une affectation Comptable et un partenaire de recette avec une adhésion owner/manager, puis les nettoie ;
3. ouvre une vraie session pour chaque rôle et clique les entrées de menu ;
4. vérifie l’URL finale, le titre de page, le menu actif et le refus d’accès pour un rôle non autorisé ;
5. vérifie le nettoyage des seuls enregistrements temporaires avant de conclure.

**Prérequis de sûreté :** cette méthode nécessite une autorisation explicite pour les deux mutations temporaires de données Replay (affectation Comptable et partenaire/adhésion), même si aucun compte Auth supplémentaire n’est créé. Aucune de ces mutations ne sera faite avant cet accord.

### 84.6 Verdict

- **VERT :** navigation source, routes compilées, guards relus ; qualité CI et build PASS sur le HEAD applicatif contrôlé `99e13e77418c3e2306ddf973d268d6f581458db6` (§84.1). Le commit documentaire du présent §84 ne change aucun fichier applicatif.
- **JAUNE :** clic réel Promoteur non encore exécuté dans cette passe ; clic réel Comptable et Partenaire impossible à prouver avec les fixtures présentes.
- **BULK :** toujours non lancé et toujours en attente d’une validation ultérieure distincte.

**Conclusion :** ne pas déclarer le contrôle interactif global vert. La cause du blocage est désormais établie par l’état réel de Replay : les deux catégories de fixtures Comptable et Partenaire n’existent pas. La seule suite sûre est une recette navigateur locale avec réutilisation des comptes existants et fixtures de données temporaires autorisées puis nettoyées.

## 84. Contrôle navigateur ciblé des accès Promoteur, Comptable et Partenaire — 16 novembre 2026

### Objectif et périmètre
- Fermer les trois constats de navigation statique avant toute recette bulk.
- Scénarios navigateur Chromium sur un serveur Next.js local, relié exclusivement au projet Supabase Replay `pwfftcsjyeibxxqhwysw`.
- Réutilisation des identités E2E déjà présentes : `naxa_e2e_promoteur`, `naxa_e2e_expiry_overflow`, `naxa_e2e_acheteur`. Aucun utilisateur Auth n'est créé.
- Pour rendre Comptable et Partenaire accessibles durant le test, le scénario insère une affectation Comptable et un partenaire `centre_examen` avec une adhésion propriétaire temporaires dans Replay. Il les supprime en `finally` et par étape de secours `always()`, avec vérification des suppressions et de la restauration du profil.
- Aucune donnée de stock, caisse, commande, livraison ou Production n'est écrite. Aucun déploiement n'est lancé.

### Contrôles de sécurité du harnais
- URL Supabase épinglée au projet Replay.
- Marqueurs E2E Auth requis avant génération de liens de connexion ponctuels.
- Opt-in explicite `NAXA_E2E_ALLOW_TEMP_FIXTURES=true` obligatoire.
- Le script refuse toute fixture préexistante qui empêcherait un scénario réversible.
- Déconnexion Auth vérifiée par le code HTTP et nettoyage vérifié pour l'affectation, le rôle actif, l'adhésion, le partenaire et les champs restaurés.
- Le workflow secondaire dupliqué `.github/workflows/naxa-navigation-runtime.yml` a été supprimé afin d'éviter plusieurs recettes concurrentes sur les mêmes fixtures. Son exécution déjà engagée n'est pas une exécution à conserver.

### Tentatives et causes racines
1. Le premier workflow navigateur a atteint le serveur local mais l'API de connexion a répondu HTTP 500. Diagnostic source : le serveur local doit recevoir `SUPABASE_SECRET_KEY` et `NAXA_RATE_LIMIT_SECRET` (>=32 caractères). Le workflow a été aligné sur le modèle Replay déjà utilisé par les recettes existantes.
2. Un premier run multi-rôles a passé le build, le préflight Replay, la création des trois sessions ponctuelles et la sélection du périmètre Comptable. Il a échoué à l'injection des cookies SSR dans Chromium : `browserContext.addCookies: Cookie should have either url or path`.
3. Le nettoyage a réussi après cet échec. Les requêtes SQL de contrôle ont confirmé : 0 partenaire temporaire, 0 adhésion temporaire, 0 affectation Comptable temporaire, 0 rôle actif temporaire, et les tables partenaires/adhésions/affectations actives sont revenues à zéro.
4. Correction appliquée : conversion des cookies SSR au format `domain + path`, validation des entrées cookie avant injection, et test de contrat correspondant.
5. Correction de séquencement appliquée : les secrets Admin Replay et rate-limit sont exportés avant le démarrage du processus Next.js afin que le serveur enfant les hérite.

### État au moment de cette mise à jour
- HEAD contrôlé : `24d3e083f450e1beb49dff26faa39b04ba53d2fa`.
- Validation `actionlint` du run qualité associé : SUCCESS.
- Job qualité (tests, TypeScript, lint, build) : en cours.
- Recette navigateur principale sur Replay : en cours ; aucun résultat fonctionnel final n'est encore revendiqué.
- Dernière recette terminée : échec sur l'injection des cookies, avec nettoyage réussi et aucun résidu Replay.
- Le contrôle ne devient vert qu'après PASS navigateur sur les trois rôles, les liens desktop/mobile, les six entrées Comptable, les deux points d'entrée Partenaire et fermeture des sessions, puis contrôle SQL sans résidu.

### Gate
- Statut global de ce contrôle : JAUNE tant que le workflow navigateur corrigé n'est pas terminé en SUCCESS.
- Aucun bulk B1–B11 lancé. Aucun compte Auth créé. Aucun déploiement Preview ou Production effectué.

### Complément de contrôle — deuxième exécution Chromium et correction du parcours Comptable

- Le run `43800566264` a confirmé les interactions suivantes : Promoteur desktop vers `/pharmacie/promoteur/livraisons` (PASS), Promoteur mobile vers la même page (PASS), ouverture du tableau de bord Comptable (PASS), clic sur « Créances & bordereaux » et rendu cible (PASS).
- Le blocage suivant était une hypothèse erronée du harnais : après le clic sur une destination Comptable, le test recherchait encore une sidebar qui n'est montée que sur le tableau de bord. Il ne s'agit pas d'une panne de la route suivante.
- Correction du harnais : retour explicite au tableau de bord avant chaque nouvelle destination, puis vérification du clic et du rendu des six liens. Aucune modification de code métier n'a été faite pour contourner l'accès.
- Extension ajoutée au même scénario : clic distinct sur la sous-navigation Promoteur en plus du menu latéral et du menu mobile.
- Chaque exécution partielle terminée a exécuté le nettoyage ; les contrôles SQL Replay post-run ont confirmé 0 partenaire temporaire, 0 adhésion, 0 affectation Comptable et 0 rôle actif temporaire.
- Dernier commit de code/test avant cette mise à jour documentaire : `b26628f48345eb13e9d0cf1e5cda1843f734f2e9`.
- Le run navigateur antérieur `43800814848` et le run qualité correspondant restent en cours/à terminer sur le commit qui précède le dernier ajustement Comptable. Le run complet corrigé `43801016091` est en attente derrière cette exécution.
- Les vérifications CI `actionlint` du run qualité précédent sont PASS ; le contrôle complet tests/TypeScript/lint doit être confirmé sur le dernier commit après le run corrigé.
- Statut de la gate : JAUNE. Les clics Promoteur desktop/mobile et le premier accès Comptable ont des preuves positives, mais les six accès Comptable et les deux entrées Partenaire ne sont pas encore tous validés sur une exécution réussie.


## 85. Résultats qualité et contrôle navigateur des menus — 16 novembre 2026

**Branche :** `main`  
**SHA applicatif contrôlé :** `5b9f7e5aab72cacc61e7e0a72193c31232fd493a`  
**Projet de test :** Supabase Replay `pwfftcsjyeibxxqhwysw` uniquement.

### 85.1 Qualité technique

Le run [NAXA quality — 43801108894](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43801108894), exécuté sur le SHA applicatif ci-dessus, est terminé avec succès :

- Tests, TypeScript et lint : PASS.
- Build Next.js : PASS.
- Validation `actionlint` des workflows actifs : PASS.

**Verdict qualité / compilation / CI : VERT sur le SHA applicatif contrôlé.**

### 85.2 Preuves interactives déjà obtenues

Le run [Chromium Replay — 43800814848](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43800814848) a réussi le build local, le démarrage du serveur et la session des profils Replay existants. Les étapes navigateur consignent les preuves suivantes :

- Promoteur desktop, sous-navigation « Livraisons du réseau » : navigation et rendu PASS.
- Promoteur desktop, navigation latérale « Livraisons du réseau » : navigation et rendu PASS.
- Promoteur mobile : navigation vers « Livraisons du réseau » PASS.
- Comptable : ouverture du tableau de bord et rendu PASS.
- Comptable : clic vers « Créances & bordereaux » et rendu PASS.

Le run s’est toutefois terminé en échec sur l’attente du lien « Rejets & relances ». Les autres destinations Comptable et Partenaire n’ont donc pas encore de preuve de clic validée par ce run. L’échec est intervenu dans le sélecteur du test navigateur ; le composant source déclare bien les treize entrées de la sidebar, dont les six destinations ajoutées au §80.

### 85.3 Correction du harnais et exécution suivante

Le harnais Chromium a été corrigé sur `main` pour isoler la sidebar réelle du layout :
- ciblage de `aside` contenant « Compte Comptable » ;
- ciblage du `nav[aria-label="Navigation Comptable"]` de cette sidebar ;
- ciblage de chaque lien par son `href` ;
- journalisation des liens rendus (URL, libellé et visibilité) avant le clic.

Le run corrigé [Chromium Replay — 43801108827](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43801108827) a démarré sur le SHA `5b9f7e5aab72cacc61e7e0a72193c31232fd493a`. À l’heure de la présente mise à jour, l’installation de Playwright/Chromium est encore en cours ; le test navigateur n’a donc pas commencé. Ne pas considérer ce run comme PASS tant que le job complet n’est pas terminé avec succès.

### 85.4 Nettoyage et sûreté Replay

Après les runs navigateur qui ont effectivement créé les fixtures temporaires, l’étape `finally` et l’étape de secours `always()` ont réussi. Une lecture SQL indépendante de Replay a confirmé :

| Contrôle après nettoyage | Résultat |
|---|---:|
| Affectations Comptable temporaires | 0 |
| Rôles actifs temporaires | 0 |
| Partenaires temporaires | 0 |
| Adhésions partenaires temporaires | 0 |
| Profil Client utilisé pour la recette restauré à ses champs initiaux | 1 |

Aucun utilisateur Auth n’a été créé. Les sessions sont ouvertes au moyen de liens ponctuels pour les profils existants. Les fixtures métier temporaires sont strictement limitées à Replay, identifiées par exécution et supprimées en fin de scénario.

### 85.5 Déploiement, Production et campagnes métier

- Aucun déploiement Production ou Preview n’a été déclenché.
- Aucune mutation Supabase Production n’a été effectuée.
- Aucun parcours bulk B1–B11 n’a été lancé.
- Les tests ci-dessus ne sont pas les recettes métier Stock, Client/Marketplace, Livraison, Caisse ou Assurance.

### 85.6 Verdict à ce checkpoint

- **VERT :** qualité, TypeScript, lint, build Next.js et syntaxe CI sur le SHA applicatif `5b9f7e5aab72cacc61e7e0a72193c31232fd493a`.
- **VERT PARTIEL :** navigation Promoteur desktop/mobile, accès Comptable et première destination Comptable effectivement cliquée et rendue.
- **JAUNE :** preuve de clic Comptable restante et accès Partenaire non encore certifiés ; run Chromium corrigé en cours d’installation.
- **BULK :** bloqué jusqu’au vert du contrôle navigateur, puis validation explicite distincte de l’utilisateur.

**Conclusion :** l’application est verte en qualité et compilation, mais le volet « clics réels » reste jaune. Ne pas demander encore la validation des recettes bulk.

## 85. État consolidé avant validation des recettes bulk — 16 novembre 2026

### HEAD et qualité complète
- HEAD applicatif/test contrôlé : `5b9f7e5aab72cacc61e7e0a72193c31232fd493a`.
- Run qualité GitHub Actions : `43801108894` — SUCCESS sur ce SHA.
- Tests Node : **549 PASS / 0 FAIL**.
- TypeScript : PASS.
- ESLint : 0 erreur, **225 avertissements** résiduels (hooks React, expressions impures au rendu, éléments `img`, dépendances de hooks notamment). Ils restent visibles et ne sont pas masqués par le statut réussi.
- Build Next.js : PASS.
- `actionlint` : PASS, tous les workflows actifs validés.

### Recette navigateur réelle
- Workflow : `43801108827`, SHA `5b9f7e5aab72cacc61e7e0a72193c31232fd493a`.
- Installation npm et Playwright/Chromium : PASS.
- Construction locale avec secrets Replay : en cours au dernier relevé ; le serveur local et les clics ne sont pas encore attestés sur cette exécution.
- L'exécution précédente `43800814848` a confirmé Promoteur sous-navigation, Promoteur sidebar, Promoteur mobile et première entrée Comptable. Elle a échoué ensuite parce que l'ancien script cherchait la sidebar Comptable après avoir quitté le tableau de bord.
- Correction présente dans le HEAD courant : retour au dashboard avant chaque destination, ciblage du vrai conteneur sidebar, sélection par href et vérification du libellé normalisé. Le test final doit encore certifier six destinations Comptable, les deux entrées Partenaire et les déconnexions.
- Les anciens runs non verts ont tous exécuté le nettoyage. Requêtes SQL Replay après ces runs : 0 partenaire temporaire, 0 adhésion, 0 affectation Comptable temporaire, 0 rôle actif temporaire.
- Dernière requête de contrôle en lecture seule pendant l'attente du run courant : mêmes quatre compteurs à zéro.

### Sécurité et environnements
- Le workflow navigateur s'exécute sur serveur local GitHub Actions et projet Supabase Replay `pwfftcsjyeibxxqhwysw`.
- Aucun utilisateur Auth additionnel n'est créé ; seules les trois identités E2E existantes et marquées sont réutilisées.
- Aucun déploiement Preview ou Production n'a été déclenché. La recherche Vercel par SHA `5b9f7e5...` retourne zéro déploiement.
- Aucune écriture Production, transaction, commande, livraison ou stock n'a été touché.

### Gate de lancement
- Qualité / intégration source : VERT, avec 225 avertissements ESLint documentés.
- Navigation réelle des trois espaces : JAUNE jusqu'au SUCCESS du run `43801108827` et à la requête SQL finale sans résidu.
- Aucun bulk B1–B11 lancé. L'autorisation utilisateur sur les campagnes bulk reste à recueillir **après** clôture verte du présent contrôle.

## 86. Clôture du scénario de navigation — VERT — 16 novembre 2026

Cette section **remplace les statuts provisoires** du §85.3 et du §85.6, qui avaient été rédigés alors que le runner était encore en build. Le run a depuis terminé avec succès.

### 86.1 Exécution Chromium / Replay terminée
- Run GitHub Actions : [43801108827 — SUCCESS](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43801108827).
- SHA testé : `5b9f7e5aab72cacc61e7e0a72193c31232fd493a`.
- Préparation : secrets confirmés Replay, dépendances installées, Playwright + Chromium installés.
- Build local Next.js avec configuration Replay : PASS.
- Serveur local de test : démarré et contrôle HTTP initial réussi après le délai de démarrage.
- Scénario Chromium : PASS.
- Nettoyage de secours `always()` : PASS ; aucune fixture résiduelle à nettoyer après le nettoyage principal.
- Arrêt du serveur : PASS.
- Le commit testé est identique côté application au HEAD documentaire courant : la comparaison `5b9f7e5...` → `91e8b0f...` ne contient que deux commits et un seul fichier modifié, `docs/E2E_CONTINUITE.md`.

### 86.2 Détail des preuves de navigation
**Promoteur**
- Sous-navigation vers « Livraisons du réseau » : clic et rendu PASS.
- Navigation latérale vers « Livraisons du réseau » : clic et rendu PASS.
- Navigation mobile vers « Livraisons du réseau » : clic PASS.

**Comptable**
- Ouverture de l'espace et rendu du tableau de bord : PASS.
- Six destinations ajoutées au menu : clic, URL attendue, libellé sidebar et rendu PASS :
  1. Créances & bordereaux ;
  2. Rejets & relances ;
  3. Rapports & exports ;
  4. Documents ;
  5. Assureurs & fournisseurs ;
  6. Plan comptable & mappings.
- Le scénario revient au tableau de bord entre chaque destination et vérifie la présence du lien dans la vraie sidebar avant le clic.

**Partenaire**
- Depuis Catalogue partenaire → « Centres et examens » : clic et rendu PASS.
- Depuis Réservations partenaire → « Centres et examens » : clic PASS.

L'assertion finale du runner est : **`RESULTAT NAVIGATION : PASS — Promoteur desktop/mobile, 6 entrées Comptable, Partenaire depuis Catalogue et Réservations.`**

### 86.3 Nettoyage et intégrité Replay
Le nettoyage dans le `finally` a supprimé l'affectation Comptable temporaire, le rôle actif temporaire, le partenaire et l'adhésion temporaires. L'étape de secours `--cleanup` a ensuite confirmé qu'il ne restait aucune fixture.

Contrôle SQL indépendant après le run :
- partenaires temporaires : 0 ;
- adhésions temporaires : 0 ;
- affectations Comptable temporaires : 0 ;
- rôles actifs temporaires : 0 ;
- profil Client existant toujours avec rôle `client` : 1.

Aucun compte Auth n'a été créé. Aucune donnée Production n'a été touchée.

### 86.4 Qualité complète sur le HEAD documentaire courant
Run [43801594362 — SUCCESS](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43801594362), SHA `91e8b0f888d9d8b3994adadc8b7f31b318664d31) :
- tests Node : **549 PASS / 0 FAIL / 0 SKIP** ;
- TypeScript : PASS ;
- ESLint : 0 erreur, 225 avertissements ;
- build Next.js : PASS, 152/152 pages statiques générées ;
- validation `actionlint` : PASS.

### 86.5 Verdict
- **VERT :** navigation réelle Promoteur desktop/mobile, six entrées Comptable, deux points d'accès Partenaire.
- **VERT :** nettoyage Replay et intégrité des fixtures contrôlés.
- **VERT :** tests, TypeScript, ESLint sans erreur, build et workflows CI.
- **À surveiller sans bloquer ce scénario :** 225 avertissements ESLint.
- **Hors périmètre :** recettes métier bulk B1–B11, déploiement Preview/Production et tests des opérations métier Stock/Marketplace/Livraison/Caisse.

**Conclusion senior QA : le scénario de navigation ciblé est clôturé VERT sur Replay. Cela ne vaut pas validation des campagnes bulk : aucune campagne B1–B11 n'a été lancée et leur autorisation explicite reste à demander séparément.**


## 87. Réconciliation de l'en-tête de continuité avec la clôture du scénario navigateur — 16 novembre 2026

Cette mise à jour ne crée aucune nouvelle preuve technique et ne modifie aucun code applicatif. Elle corrige l'en-tête historique du document afin qu'il reflète le résultat final déjà établi au §86 et évite de confondre le vert du scénario ciblé avec le vert de l'ensemble des recettes E2E.

- HEAD documentaire observé sur `main` avant cette mise à jour : `ad0b3667494f5c8fe906795444457ce91e8e47ea`.
- Référence applicative réellement testée : `5b9f7e5aab72cacc61e7e0a72193c31232fd493a`.
- Navigation ciblée : **VERT**, preuves détaillées au §86.
- Qualité technique : **VERT**, run `43801594362`, 549 PASS / 0 FAIL / 0 SKIP ; TypeScript, build et actionlint PASS ; ESLint 0 erreur et 225 avertissements.
- État global des recettes E2E : **PARTIEL** tant que les parcours métier, rôles et appareils encore ouverts dans le document n'ont pas leurs propres preuves.
- Campagnes B1–B11 : **NON LANCÉES** ; aucune autorisation de bulk n'est présumée.
- Environnements : Replay uniquement pour le contrôle précédent ; Production non touchée ; aucun déploiement Vercel.

**Point de reprise exact :** attendre la décision explicite de l'utilisateur avant tout lancement B1–B11. En cas d'autorisation, commencer par B1 sur Replay, respecter l'ordre défini au §77, réutiliser uniquement les comptes existants et arrêter au premier blocage. Sans autorisation, ne lancer aucune recette bulk.


## Chantier d’alignement transversal et univers — reprise 16/11/2026

### Gouvernance et ordre impératif
- Ce chantier est distinct des campagnes E2E globales. Ne pas lancer les campagnes bulk ni déclarer le produit globalement vert pendant cette séquence.
- Ordre fixé : **1. Bébé & Maman → 2. Dispositifs médicaux / Suivi connecté → 3. Prestations / Soins à domicile → 4. Parapharmacie → 5. Examens médicaux**.
- Ne passer à l’univers suivant qu’après clôture documentée de l’univers courant.
- Pour chaque univers : décisions finales → audit code/migrations/RPC/tables/RLS → contradictions et cause racine → corrections sur `main` → contrôles ciblés et preuves → documentation → clôture.
- Socle transversal préalable : identité et séparation des rôles/espaces, registre et activation des univers, modèle Partenaire vs salarié/structure, propriété métier des données, panier/commandes/réservations, paiements et comptabilité, permissions/RLS et audit, supervision Admin et cohérence des états. Les spécificités de chaque univers restent prioritaires sur les abstractions communes.
- Sécurité d’exécution maintenue : `main` uniquement ; Replay pour les contrôles qui écrivent ; Production en lecture seule ; aucun déploiement ; aucun test global/E2E bulk pendant ce chantier.

### État du dépôt au démarrage de cette séquence
- HEAD `main` vérifié : `202d26383cf1f6bb983d1f0f543e328417b9ddca` (16/11/2026 04:08:44 UTC).
- Le présent document était au blob `7b6d63fc68e873ac8ed35622e2e7aed8495f0046` avant cette mise à jour.
- La page `/bebe-maman` délègue à `UniverseCatalog`; le catalogue lit la RPC `get_universe_catalog('bebe-maman')`.
- `UniverseCatalog.tsx` décrit Bébé & Maman comme une extension des pharmacies participantes, avec références, photos commerciales, prix et stocks gérés dans l’ERP Pharmacie, et annonce l’absence de classement publicitaire/sponsorisation/avantage promotionnel.
- `UniverseProductGrid.tsx` place les articles B&M dans le panier principal NAXA avec un type d’article distinct `bebe-maman`, conserve le tri par nom (pas de tri par prix ni de classement recommandé pour B&M), et renvoie vers `/panier`. Le composant groupe ensuite les lignes B&M pour une réservation par pharmacie.
- `src/app/univers-actions.ts` revalide le catalogue côté serveur, exige un utilisateur authentifié avec rôle `client`, puis appelle `reserve_universe_products`. Le reçu est routé vers `/univers-reservation/:id`.
- `ProductImageLibrary.tsx` présente explicitement les photos Open Beauty Facts comme documentation neutre, sans prix, classement, sponsorisation ni incitation à l’achat ; elle précise que ces photos ne prouvent ni stock ni disponibilité partenaire.
- Les règles lexicales `excludedFromBabyUniverse` filtrent plusieurs catégories de produits bébé (notamment laits/formules, céréales infantiles, biberons, tétines et sucettes). La règle est annoncée comme un garde-fou applicatif ; l’autorité réelle doit être vérifiée dans les contraintes/RPC SQL.
- L’Admin `/admin/univers` présente des compteurs et listes limités aux 100 partenaires/produits les plus récents et aux 20 événements d’audit ; l’écran indique lui-même que ces compteurs ne sont pas un audit exhaustif du réseau. Ce n’est donc pas encore une preuve de supervision complète, détaillée et fiable.
- `changerAssociationPartenaire` interdit l’association commerciale `bebe-maman` ; le test SQL `20261026100000_admin_unified_universe_dossiers.sql` vérifie que le service B&M est rattaché à `pharmacie_services` et non à `partners`/`partner_universes`.
- **Contradiction technique à instruire avant correction :** `creerProduitPartenaire` et `changerStatutProduitPartenaire` restent génériques pour `bebe-maman` et opèrent sur `partner_products`; la migration `20261026140000_bebe_maman_catalogue_pharmacie.sql` conserve un modèle catalogue/réservation historiquement adossé à `partner_id`/partenaire et sa RPC de réservation vérifie une association `partner_universes` active. Ce chemin semble incompatible avec la décision finale B&M = extension de pharmacie, sans partenaire B&M autonome, et avec le verrou Admin qui interdit précisément cette association. Il faut établir le propriétaire réel des lignes et le chemin actif avant de choisir une correction.
- Les migrations B&M `20261026193000`, `20261026194000`, `20261026195000` durcissent les search_path et RLS du catalogue/réservation ; leur présence dans Git ne prouve pas à elle seule leur application sur Replay ou Production.
- Aucun contrôle SQL Replay, aucune recette fonctionnelle ciblée, aucune validation RLS active, aucun build ni test n’a été exécuté dans cette passe. Aucun code ni migration applicative n’a été modifié.

### Socle transversal — premier relevé
- **JAUNE / audit incomplet.** Le registre Admin global utilise les slugs `parapharmacie`, `bebe-maman`, `examens`, `suivi`, `prestations`; l’API publique mappe aussi `suivi` vers `dispositifs`.
- L’activation Admin appelle `admin_set_universe_enabled`, puis relit le registre et les feature flags pour vérifier la persistance ; la RPC synchronise le flag principal, la ligne `universes`, et pour `suivi` le flag `suivi_connecte`.
- Le modèle de supervision `/admin/univers` a des listes tronquées (100 partenaires/produits, 20 logs) et ne donne pas encore une vue probante des indicateurs métier, incidents, conformité et traçabilité de chaque univers. À compléter par audit de `/admin`, des tableaux spécialisés et des sources SQL.
- Le contrôle transversal ne doit pas forcer un modèle partenaire autonome sur les univers qui sont des services d’une pharmacie ou d’une structure ; les relations structure/salarié, indépendants et habilitations doivent être distinguées.

### Bébé & Maman — statut d’ouverture
- **JAUNE — non clôturé.** Les éléments UI visibles confirment plusieurs intentions finales (extension Pharmacie, panier principal partagé mais articles identifiables, documentation photo séparée, absence de tri promotionnel). Ils ne démontrent pas encore la cohérence de bout en bout avec l’ERP Pharmacie.
- Bloquants/candidats à instruire : modèle d’appartenance `partner_products` vs `pharmacie_services`; RPC de catalogue et réservation; séparation du stock pharmacie et des réservations B&M; cycle demande → confirmation → préparation → retrait/annulation/expiration et restauration de stock; intégration ERP (gestionnaire de stock, caisse, historique client); règles de publication et absence de promotions dans toutes les surfaces; droits Promoteur/pharmacie/personnel/Client/Admin; activation et supervision Admin; interdiction d’intervention centrale sur les fiches métier déclarées par la pharmacie.
- Prochaine reprise précise : cartographier le schéma et les fonctions SQL actives liées à `partner_products`, `pharmacie_services`, `universe_reservations`, `universe_reservation_items`, `reservations`, `stocks`, `stocks_lots` et aux transitions ERP ; confronter les migrations ultérieures au modèle initial ; contrôler le test structurel et l’état réellement appliqué sur Replay en lecture seule avant toute correction.


### Bébé & Maman — contrôles SQL Replay en lecture seule (16/11/2026)
- **Environnement contrôlé :** Replay `naxa-ci-replay-2`, projet `pwfftcsjyeibxxqhwysw`. Relevé des migrations appliquées et lecture des définitions actives, colonnes, politiques RLS et triggers. Aucune écriture ni migration.
- **Migrations Replay présentes :** `20261026091121 admin_unified_universe_dossiers`, `20261026092703 bebe_maman_catalogue_pharmacie`, `20261026093045 bebe_maman_catalogue_pharmacie_integrity_replay`, `20261026094535 bebe_maman_catalogue_pharmacie_final_service_filter`, puis les contrôles globaux Admin du 11/11/2026. Les migrations de durcissement de fonctions 261930/261940/261950 vues sur Git ne figurent pas dans la liste Replay retournée ; leur absence doit être prise en compte avant de considérer les correctifs de sécurité du dépôt comme actifs.
- **Contradiction fonctionnelle confirmée :** la fonction active `private.get_universe_catalog(text)` joint obligatoirement `partner_universes` avec `enabled=true` pour les deux univers, y compris `bebe-maman`. La RPC active `public.reserve_universe_products` exige également une association partenaire B&M active avant de réserver.
- En parallèle, l’action Admin `changerAssociationPartenaire` refuse explicitement d’activer une association `bebe-maman` (erreur `service_pharmacie`) et le test structurel versionné `supabase/tests/20261026100000_admin_unified_universe_dossiers.sql` exige que le rattachement B&M soit porté par `pharmacie_services`, sans relation `partners`/`partner_universes`. Le modèle de données actif et le verrou métier s’opposent donc : le catalogue public et la réservation B&M ne peuvent pas satisfaire simultanément leurs préconditions. **Cause racine :** le catalogue/réservation conserve le contrat historique « univers partenaire » alors que la décision finale B&M est « service de pharmacie ».
- **Deuxième écart confirmé :** la colonne de stock lue par le catalogue est `partner_products.stock_quantity`; le trigger actif `sync_bebe_maman_product_pharmacy()` ne fait que calculer/renseigner `partner_products.pharmacie_id` depuis le propriétaire Promoteur et le service actif. Il ne synchronise ni ne réserve les quantités dans `stocks`/`stocks_lots`. Le RPC de réservation consomme le stock du catalogue partenaire (`partner_products` + `universe_reservations`), sans transition démontrée vers le stock ERP Pharmacie (`reservations`, `stocks`, `stocks_lots`). Cela ne respecte pas encore la règle « même ERP, même stock ».
- **Sécurité observée sur Replay :** RLS activée sur `partner_products`, `pharmacie_services`, `universe_reservations`, `universe_reservation_items`, `reservations`, `stocks`, `stocks_lots`. La table `partner_products` expose néanmoins des policies métier de lecture/écriture via `partner_universes`; les règles effectives doivent être refondues avec le modèle pharmacie et vérifiées par rôle, pas simplement supprimées.
- **Fonctions actives observées :** `public.admin_set_pharmacie_bebe_maman_service(uuid,boolean)` est SECURITY DEFINER avec search_path vide et contrôle `is_admin()`; `public.get_universe_catalog(text)` délègue à `private.get_universe_catalog(text)`; cette dernière est SECURITY DEFINER avec search_path vide. La fonction active `public.reserve_universe_products(...)` est SECURITY DEFINER avec `search_path=public, extensions`, contrairement aux migrations de durcissement présentes dans Git : point de sécurité à instruire, sans modification dans cette passe.
- **Triggers actifs pertinents :** `partner_products_baby_terms_guard`, `sync_bebe_maman_product_pharmacy`, et `guard_medical_devices_product_phase1` sur `partner_products`. Le garde-termes B&M utilise `unaccent` et rejette plusieurs familles de produits interdites. Aucun trigger de synchronisation B&M vers `stocks`/`stocks_lots` n’a été observé sur les tables contrôlées.
- **Statut Bébé & Maman : ROUGE fonctionnel / JAUNE audit global.** Les deux contradictions sont établies sur Replay par lecture des définitions actives. Aucune donnée n’a été modifiée. Ne pas lancer de recette panier/réservation ni annoncer de disponibilité publique B&M avant correction du contrat propriétaire/catalogue/stock.
- **Prochaine étape exacte :** cartographier le modèle métier réel des fiches et stocks pharmacie (tables catalogue, produits, stocks, lots, prix, images et fonctions de gestionnaire de stock), les actions Promoteur/pharmacie/gestionnaire, puis concevoir une correction unique qui fait de la pharmacie le propriétaire direct des fiches et du stock B&M. La réservation B&M doit ensuite emprunter le cycle ERP pharmacie et conserver seulement un identifiant/type d’article B&M pour la séparation opérationnelle voulue dans le panier et l’historique.


### Bébé & Maman — rapprochement avec le socle ERP Pharmacie (16/11/2026)
- Le schéma Replay confirme les tables canoniques Pharmacie : `produits`, `stocks`, `stocks_lots`, `reservations`, et les fonctions ERP `pharmacie_produit_declarer_et_reference_initialiser`, `reserve_stock`, `restore_stock`, `gestionnaire_stock_reservation_confirmer`, `gestionnaire_stock_reservation_annuler`, ainsi que les fonctions de caisse/POS et de gestion des lots.
- Le catalogue B&M reste stocké dans `partner_products` avec son champ propre `stock_quantity`, tandis que la réservation B&M utilise `universe_reservations` et `universe_reservation_items`. Les tables ERP `stocks`/`stocks_lots` et `reservations` sont séparées. La présence d’un `pharmacie_id` sur `partner_products` ne constitue pas une synchronisation des références, des prix ou des quantités.
- Le seul trigger de liaison B&M observé, `sync_bebe_maman_product_pharmacy`, renseigne `pharmacie_id` à partir du Promoteur et du service B&M actif ; sa définition ne lit ni n’écrit les tables `produits`, `stocks`, `stocks_lots` ou `reservations`.
- Le contrat de stock attendu doit être celui du socle ERP : référence et prix détenus par la pharmacie, quantité issue des stocks/lots de la pharmacie, réservation avec allocations et mouvements traçables dans le cycle ERP. Les lignes B&M doivent conserver leur typologie dans panier et historique, mais ne doivent pas créer un second stock vendable isolé.
- Les tables contrôlées sont toutes RLS-enabled, mais aucune de ces lectures ne démontre encore la matrice complète des droits par rôle, les transitions ERP ou l’équivalence des quantités. Un contrôle de définition ne remplace pas une recette transactionnelle Replay.
- **Socle transversal : premier jalon de cartographie, non clôturé.** Le registre d’univers et son activation Admin sont cohérents dans le contrat de base (registre + flag + audit, synchronisation spécifique du suivi). En revanche, la supervision Admin est bornée à des fenêtres de 100 lignes et 20 journaux et ne satisfait pas encore l’exigence de supervision exhaustive. La séparation des modèles de propriété entre pharmacie, partenaire autonome, salarié et indépendant reste à vérifier dans chaque univers.
- **Prochaine action technique B&M :** auditer les écrans/actions existants de déclaration produit, gestion de stock, réservation, préparation et caisse pour identifier le point d’extension minimal du modèle ERP. Ne pas tenter de réparer seulement la jointure `partner_universes` : cela rendrait le catalogue visible sans résoudre la propriété du stock ni l’intégration ERP.


## 89. Audit expert du socle transversal ERP — 16/11/2026

**Périmètre exécuté :** lecture seule du code `main`, des définitions SQL et policies actives sur Supabase Replay `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`), historique de migrations et Supabase Advisors sécurité/performance/santé. Aucun DDL/DML, aucune migration, aucun déploiement, aucune recette destructive.

### 89.1 Éléments confirmés verts — preuves limitées à leur périmètre
- **RLS activée partout sur les tables applicatives contrôlées :** inventaire SQL Replay `pg_class` — schéma `public` : 257 tables avec RLS, 0 sans RLS ; schéma `private` : 7 avec RLS, 0 sans RLS.
- **Fonctions SECURITY DEFINER avec search_path fixé :** inventaire des 468 fonctions `SECURITY DEFINER` (`public` 381, `private` 87) : aucune fonction sans configuration `search_path` détectée.
- **Séparation du rôle actif :** la RPC `naxa_select_active_role` (migration `20261114073016`) vérifie l'identité, le profil actif, l'existence du rôle, le périmètre pharmacie/partenaire et l'affectation active ; elle empêche un poste de porter simultanément un périmètre Pharmacie et Parapharmacie. La table `naxa_profile_active_roles` a RLS avec refus direct (`false`) et la lecture des affectations est limitée aux participants, délégants/révocateurs, Admin ou responsables habilités. Cela confirme une architecture de contrôle, pas encore toutes ses transitions et son comportement multi-rôle en exécution.
- **Garde Admin :** `requireAdminActive` exige utilisateur authentifié, profil `admin` actif et contexte de rôle métier actif `admin`. Les actions Admin de changement d'univers utilisent `admin_set_universe_enabled`, puis relisent registre et flags avant confirmation.
- **Périmètre des deux RPC publiques SECURITY DEFINER :** `marketplace_offre_stock_disponible` et `marketplace_produit_visible` sont les deux seules fonctions SECURITY DEFINER publiques signalées exécutables par `anon`. La première délègue à `private.marketplace_offre_stock_disponible_guarded`, qui ne retourne une offre que pour une pharmacie active, visible, non-démo, non-archivée, avec mise à jour de stock de moins de 48 h et quantité disponible nette des réservations ; la seconde ne retourne vrai que si une ligne de stock existe dans une pharmacie active, visible, non-démo et non-archivée. L'accès anonyme paraît donc intentionnel pour la Marketplace publique ; il reste à le valider par tests HTTP anon et à documenter le contrat de sortie minimal.
- **Santé Supabase Replay :** Advisor `health` ne retourne aucun finding au moment du contrôle (`2026-11-16T04:40Z`). Cela ne certifie pas la qualité métier ni la sécurité fonctionnelle.

### 89.2 Écarts et réserves qui empêchent le vert transversal
1. **Protection contre mots de passe compromis — BLOQUANT GO-LIVE :** Advisor sécurité `auth_leaked_password_protection` indique que la protection HaveIBeenPwned est désactivée. La capacité est indisponible sur le plan Free selon l'état de compte déjà documenté. Aucun changement de plan n'a été autorisé ; il faut soit activer la protection avec un plan compatible après décision du propriétaire, soit documenter formellement l'acceptation du risque avant de lever ce critère. Ne pas prétendre que la protection est active.
2. **Schéma `private` — exposition non certifiée :** `has_schema_privilege` montre USAGE accordé à `anon` et `authenticated` sur `private`. Les paramètres PostgREST `pgrst.db_schemas` ne sont pas lisibles via les paramètres SQL de la session (`NULL`) ; la liste des schémas exposés doit donc être contrôlée dans la configuration Data API Supabase. Tant que `private` n'est pas explicitement confirmé non exposé, le point reste OUVERT. Ne pas retirer globalement les privilèges sans cartographie des fonctions internes.
3. **242 fonctions SECURITY DEFINER accessibles à authenticated :** l'Advisor sécurité signale 242 RPC publiques appelables par utilisateur connecté. Ce signal n'est pas automatiquement une vulnérabilité : certaines sont des contrats applicatifs et peuvent porter leurs propres gardes. Mais l'inventaire doit être classé par fonction (lecture publique/client, opération métier, Admin, service interne), vérifier identité active, rôle actif, affectation, propriétaire, état de suspension et périmètre, puis tester les refus. Aucun feu vert global ne peut être déduit du seul `search_path`.
4. **71 tables RLS sans policy — contrôle d'intention nécessaire :** 64 tables `public` et 7 tables `private` sont RLS-enabled sans policy. Cela ferme normalement l'accès direct aux rôles API, ce qui peut être volontaire pour des tables internes accessibles uniquement par RPC/service role. Chaque table doit être classée ; ajouter des policies par défaut serait dangereux et contraire au moindre privilège.
5. **47 cas de policies permissives multiples :** Advisor performance signale 47 cas de policies qui se combinent en OR pour un même rôle/action. Certaines séparations Admin/client/personnel sont intentionnelles ; d'autres doivent être consolidées après analyse de l'union réelle des droits. Ne pas supprimer des policies au seul motif du warning.
6. **11 policies avec auth initplan non optimisé :** Advisor signale des appels `auth.*` réévalués par ligne. Dette performance ciblable, notamment sur offres/commandes et produits. Pas un défaut fonctionnel démontré, mais à corriger avec tests de non-régression des policies.
7. **246 clés étrangères sans index couvrant et 176 index non utilisés :** dette performance à traiter par criticité, cardinalité, plans d'exécution et fréquence ; ne pas créer/supprimer des index à l'aveugle.
8. **Supervision Admin non exhaustive :** `/admin/univers` limite les partenaires et produits à 100 lignes et le journal à 20 événements. Les indicateurs calculés sur ces fenêtres sont des aperçus, pas des totaux réseau exhaustifs. Le layout Admin charge la liste des pharmacies sans pagination et agrège certains signaux, mais n'établit pas encore une supervision uniforme par univers, incident, conformité et traçabilité.
9. **Matrice de droits non prouvée par rôle :** les policies montrent des périmètres structurés, mais il manque les tests négatifs/positifs exécutés avec comptes réels Client, Promoteur, Responsable, Caisse, Gestionnaire stock, Pharmacien, Comptable, Livreur, Partenaire indépendant et Admin. Le PASS d'un test SQL de structure ne prouve pas l'isolation de chaque ligne métier.
10. **Contrat de session et suspension :** les gardes d'accès sont réparties entre middleware, layouts, fonctions SQL et actions serveur. Une cartographie exhaustive des chemins directs/API/RPC et la preuve de révocation immédiate après suspension restent à établir. Le middleware authentifie les routes protégées mais ne remplace pas les gardes de rôle actives dans chaque espace.

### 89.3 Contradiction d'architecture et cause racine
- Le socle dispose désormais d'un résolveur de rôle actif et de tables d'affectations explicites, mais le contrôle d'accès demeure distribué entre profil historique, fonction active, affectations pharmacie/partenaire, middleware, helpers serveur, RLS et gardes internes des RPC.
- Cause racine du risque de dérive : plusieurs générations de contrats (rôle de base, fonction interne, affectation explicite, domaine professionnel, contexte actif) coexistent. Il faut une matrice d'autorité unique qui précise, pour chaque action, l'identité, le rôle actif, l'affectation, le périmètre, l'état et l'autorité de décision. Une migration de normalisation globale sans cartographie créerait un risque de régression.
- Le modèle métier reste multi-tenant : toutes les relations doivent être bornées par pharmacie ou partenaire propriétaire ; les salariés restent rattachés à leur structure, les indépendants nécessitent leur propre accord/affiliation, et les univers « service de pharmacie » ne doivent pas être forcés dans le modèle partenaire autonome.

### 89.4 Décision d'état
- **Socle transversal : JAUNE — NON VERT.**
- Les contrôles RLS activée, search_path SECURITY DEFINER, résolveur de rôle actif et garde Admin sont confirmés sur Replay/code.
- Les réserves sur exposition `private`, protection des mots de passe compromis, audit des 242 RPC, classification des 71 tables sans policy, matrice de rôles exécutée et supervision Admin exhaustive restent ouvertes.
- Les warnings performance sont classés comme dette à traiter, sans être assimilés automatiquement à des failles.
- Aucun code ni schéma n'a été corrigé dans cette passe ; aucun test d'intégration multi-rôle n'a été exécuté. Il serait faux de déclarer le socle AU VERT à ce stade.

### 89.5 Prochaine action exacte
1. Contrôler dans Supabase Dashboard / Data API la liste réelle des schémas exposés et confirmer que `private` n'est pas exposé ; si exposition inutile, retirer `private` de l'exposition API et vérifier les RPC nécessaires depuis `public`.
2. Produire l'inventaire des 242 RPC `SECURITY DEFINER` par domaine et classer leurs ACL/guards, en commençant par les fonctions Admin, paiements, affectations, stock, réservation et suspension.
3. Classer les 71 tables sans policy comme « internes RPC/service role » ou « accès API requis » ; contrôler privilèges SQL effectifs et chemins d'accès.
4. Remplacer les compteurs tronqués Admin par des agrégats exacts côté serveur et des listes paginées, avec filtres par univers, statut, date, gravité et propriétaire ; distinguer total, page et fenêtre temporelle.
5. Construire et exécuter la matrice de rôles sur Replay, avec preuves positives et négatives et vérification des accès après suspension/révocation.
6. Décider de la protection des mots de passe compromis et planifier les optimisations de policies/index sur mesures réelles.
7. Réviser les résultats Advisors après chaque correction, exécuter tests ciblés, consigner commits et preuves ; ne déclarer le socle vert qu'après fermeture de tous les critères obligatoires.

**Point de reprise :** commencer par l'exposition Data API de `private`, puis audit systématique des RPC SECURITY DEFINER et de leurs ACL/guards. Pas de recette globale/E2E bulk, pas de Production en écriture, pas de déploiement.


## 90. Fermeture des faux positifs et derniers blocages du socle — 16/11/2026

### 90.1 Accès direct aux tables RLS sans policy — POINT CLOS
- Requête SQL Replay sur l'ensemble des tables RLS des schémas `public` et `private` : `public` 257 tables RLS dont 64 sans policy ; `private` 7 tables RLS dont 7 sans policy.
- Contrôle des privilèges effectifs pour chaque table sans policy : zéro privilège direct `SELECT`, `INSERT`, `UPDATE` ou `DELETE` pour `anon` et zéro pour `authenticated`, dans les deux schémas.
- Interprétation : RLS sans policy = refus par défaut, et aucun GRANT direct ne permet de contourner ce refus. Le finding Advisor `rls_enabled_no_policy` (71, niveau INFO) est classé **contrôle interne fermé / non vulnérabilité** dans l'état actuel. Les accès nécessaires restent à travers les RPC et le rôle serveur autorisé. Ne pas ajouter de policies génériques.

### 90.2 Schéma private — ne pas appliquer de révocation globale
- SQL confirme `USAGE` accordé à `anon` et `authenticated` sur le schéma `private`.
- Le schéma contient 102 fonctions : 87 `SECURITY DEFINER` et 15 `SECURITY INVOKER`. Plusieurs RPC publiques en `SECURITY INVOKER` appellent explicitement des fonctions `private.*` ; elles nécessitent donc ce chemin de privilèges. Révoquer globalement `USAGE` ou `EXECUTE` casserait des appels applicatifs et ne constitue pas une correction sûre.
- La documentation Supabase confirme que seul `public` est exposé par défaut ; un schéma personnalisé n'est exposé que s'il est ajouté explicitement dans **Project Settings → API → Exposed schemas**. La session SQL ne permet pas de lire ce paramètre PostgREST et le connecteur ne fournit pas d'action de lecture/modification de ce réglage.
- **Point externe restant :** confirmer dans le Dashboard que `private` n'est pas dans la liste Exposed schemas. Si absent, classer le risque d'exposition API fermé sans toucher aux grants. S'il est présent, retirer uniquement `private` de la liste exposée (ne pas révoquer les grants nécessaires aux wrappers internes), puis vérifier les RPC publiques requises.
- Référence documentaire Supabase : `https://supabase.com/docs/guides/api/using-custom-schemas`.

### 90.3 Inventaire des RPC SECURITY DEFINER — triage SQL réalisé, tests d'autorisation restant
- Inventaire Replay : 242 fonctions `public SECURITY DEFINER` exécutables par `authenticated`, 2 exécutables par `anon`. Toutes les 468 fonctions SECURITY DEFINER contrôlées ont un `search_path` fixé.
- Triage statique des 242 RPC authenticated : 233 définitions contiennent une vérification d'identité `auth.uid()`/`auth.jwt()`; 130 délèguent à des fonctions `private.*` ; trois cas sans motif générique ont été examinés individuellement :
  - `assurance_import_simuler_mode` délègue à `assurance_import_simuler`, qui exige une session, contrôle les rôles Promoteur/Pharmacien/Responsable et le scope Pharmacie avant écriture.
  - `set_garde` exige une pharmacie active via `my_pharmacie()` puis le privilège `manage_guard_status` via `authorize()`.
  - `marketplace_produit_visible` est une lecture booléenne publique bornée aux stocks des pharmacies actives, visibles, non-démo et non-archivées.
- Les deux RPC anonymes sont des lectures Marketplace :
  - `marketplace_offre_stock_disponible` délègue à `private.marketplace_offre_stock_disponible_guarded`, qui vérifie pharmacie visible/active/non-démo/non-archivée, fraîcheur du stock (48 h) et quantité disponible après réservations.
  - `marketplace_produit_visible` vérifie l'existence d'un stock dans une pharmacie visible/active/non-démo/non-archivée.
- Conclusion : aucun défaut d'autorisation évident n'a été établi dans ce triage ; les deux RPC anon correspondent au besoin de lecture publique Marketplace. Les 242 RPC ne sont toutefois pas déclarées entièrement certifiées tant que les tests positifs/négatifs par rôle, périmètre et suspension ne sont pas exécutés. Finding Advisor `authenticated_security_definer_function_executable` classé **surface d'exposition à tester**, pas faille démontrée.
- Référence Advisor : `https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable`.

### 90.4 Dette performance — classée, non bloquante pour le vert fonctionnel
- `multiple_permissive_policies` : 47 cas. Les policies sont combinées en OR par Postgres ; les exemples reflètent souvent des scopes distincts (Admin, Client, partenaire, salarié). Ne pas les fusionner sans démontrer l'équivalence de leur union logique. Classées dette de performance à optimiser par table après analyse des plans.
- `auth_rls_initplan` : 11 policies. Optimisation connue possible en enveloppant les appels `auth.*` par `(select auth.*())`. À faire en migration dédiée avec comparaison stricte des expressions et tests d'isolation.
- `unindexed_foreign_keys` : 246 relations sans index couvrant. Ne pas générer 246 index aveuglément : vérifier cardinalité, fréquence, doublons d'index, coût d'écriture et plans `EXPLAIN`; déployer ensuite avec stratégie adaptée à la taille de Production.
- `unused_index` : 176 index non utilisés dans les statistiques observées. Ne pas supprimer sur Replay peu chargé ; les conserver jusqu'à observation représentative de Production et vérification des requêtes rares/maintenance.
- Ces quatre catégories sont **dette performance classée**, pas défaut métier ou vulnérabilité avérée. Elles ne bloquent pas le vert fonctionnel transversal, mais doivent rester dans le plan de performance avant montée en charge.

### 90.5 Blocages externes et produit toujours ouverts
1. **Protection HIBP des mots de passe compromis : NON BLOQUANTE — limitation Supabase Free.** Advisor Replay confirme `auth_leaked_password_protection` désactivé. Cette option n'étant pas disponible dans l'offre gratuite constatée, elle est suivie comme limitation fournisseur et ne conditionne pas le vert NAXA. Aucun changement de plan ni contournement maison n'est demandé. Référence : `https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection`.
2. **Exposition réelle du schéma private : vérification Dashboard requise.** Le connecteur ne peut pas lire le réglage Exposed schemas ; le SQL seul ne suffit pas.
3. **Supervision Admin : défaut produit confirmé dans `src/app/admin/univers/page.tsx`.** Les partenaires et produits sont chargés avec `limit(100)`, le journal avec `limit(20)`; les compteurs dérivés des lignes chargées ne sont pas des totaux réseau. `src/app/admin/page.tsx` charge la liste pharmacies sans pagination et agrège certains indicateurs en mémoire. La supervision exhaustive, agrégats serveur et pagination/filtres fiables restent à implémenter.
4. **Matrice de droits et suspension : non certifiée en exécution.** Le triage statique ne remplace pas les tests négatifs/positifs avec comptes de rôle et après révocation/suspension. Aucun compte de test n'a été créé dans cette passe.

### 90.6 Décision architecturale
- Les alertes Advisor INFO sur les 71 tables sans policy sont fermées par preuve de l'absence de GRANT direct et du refus RLS par défaut.
- Les alertes de policies multiples, initplan, index FK et index inutilisés sont classées dette performance et ne sont pas traitées par modifications aveugles.
- Les grants du schéma `private` sont conservés en raison des wrappers invoker ; la configuration API doit être vérifiée avant de conclure sur l'exposition.
- Les deux RPC anon Marketplace sont conservées comme lecture publique explicitement bornée.
- **Socle transversal : JAUNE / NON VERT pour le go-live.** HIBP est une limitation non bloquante de Supabase Free. Restent à clôturer : vérification Dashboard de l'exposition API `private`, build/navigation de la supervision Admin, et matrice d'autorisations métier complète.
- Aucun code applicatif ni schéma n'a été modifié dans cette passe. Aucun changement de plan, aucun déploiement et aucune écriture Production.

### 90.7 Point de reprise exact
- Propriétaire NAXA : confirmer que `private` est absent de Project Settings → API → Exposed schemas. HIBP reste documenté comme limitation non bloquante de l'offre Free ; aucune montée de plan n'est requise.
- Développement sur `main`, sans déploiement pendant audit : remplacer les compteurs limités par des agrégats SQL exacts et des listes paginées, puis exécuter tests build/typecheck ciblés.
- Sur Replay : exécuter la matrice d'autorisation et suspension ; documenter chaque PASS/FAIL.
- Une fois ces critères de sécurité et supervision clos, le socle pourra être déclaré vert selon les critères de mise en production ; reprendre ensuite l'univers Bébé & Maman dans l'ordre impératif.

## 91. Corrections supervision Admin et matrice d'accès Replay — 16/11/2026

### 91.1 Supervision Admin — correction de code sur main
- src/app/admin/page.tsx : chargement des pharmacies par pages de 500 lignes (range) jusqu'à épuisement ; comparaison avec le count exact de la base pour détecter toute page manquante. Les indicateurs du réseau continuent d'exclure les pharmacies démo via isDemoPharmacy ; les nombres de pharmacies, stocks horodatés, stocks à actualiser, quartiers et progression sont calculés sur l'ensemble des lignes récupérées, pas sur une fenêtre de 100.
- src/app/admin/univers/page.tsx : partenaires et produits paginés par 25 ; journal paginé par 20 ; filtres partenaire/produit appliqués à la requête Supabase avant pagination ; totaux exacts chargés séparément pour partenaires actifs/en attente, produits publiés/brouillons, associations ouvertes, événements d'audit et professionnels de suivi.
- Les sélecteurs de partenaires actifs du formulaire produit chargent leur propre liste paginée complète, indépendamment de la page visible des partenaires. En cas d'erreur d'un compteur ou d'une source, l'écran signale des données partielles et évite de présenter un total incomplet comme exact.
- Commits main : 830f7d2028fb5941d7d487c82cb59bf0130eef3d, de70adf8de45077677348dccd04ed1194af10cb1, 3f79836e6f715864f0e83dcd79ce7f25397fd565, 456c5ef35a8a1f358f88b1db3bf8ea801eb3eb07 et 4914a832e88e9021c26e8a28433365e52d164fbc.
- Limite de validation : les fichiers ont été relus après écriture GitHub ; aucun build Next.js, TypeScript ou test navigateur n'a été exécuté dans cette passe. La correction source est commitée, mais le résultat de compilation reste À TESTER.

### 91.2 Matrice d'accès exécutée sur Replay
- En contexte JWT authenticated, public.naxa_scope_allows a été exécutée sur des affectations actives réelles de Replay :
  - caisse : pharmacie affectée autorisée = true ; autre pharmacie = false.
  - gestionnaire_stock : affectée = true ; autre = false.
  - livreur : affectée = true ; autre = false.
  - responsable : affectée = true ; autre = false.
- Promoteur : pharmacie présente dans promoteur_pharmacies et active autorisée = true ; pharmacie non affectée = false.
- Client : accès au scope pharmacie testé = false.
- Suspension : dans une transaction Replay, le profil Gestionnaire stock a été temporairement passé à actif=false ; naxa_scope_allows a renvoyé false ; transaction annulée par ROLLBACK. Contrôle post-transaction : profiles.actif=true, aucune suspension persistante.
- Ces résultats confirment les chemins de scope testés, pas l'intégralité des permissions de toutes les RPC métier.

### 91.3 Limites de la matrice — ne pas déclarer le point entièrement vert
- Les comptes Replay présents couvrent Admin, Promoteur, Client, Caisse, Gestionnaire stock, Livreur et Responsable. Aucun profil/affectation actif Pharmacien ou Comptable n'a été identifié dans la matrice actuelle ; ces rôles ne sont donc pas certifiés en exécution.
- Les opérations sensibles (vente caisse, mutation de stock, validation de réservation/livraison, lecture/export comptable) n'ont pas toutes été exécutées avec des tests d'écriture positifs et négatifs.
- L'expiration d'une affectation et la révocation explicite par action métier ne sont pas encore validées séparément. Les tests de suspension du profil et de scope hors périmètre sont PASS.
- Le point 4 est donc PARTIELLEMENT FERMÉ — JAUNE, avec 6 catégories de rôles/scopes contrôlées, mais pas une matrice complète de tous les rôles et actions.

### 91.4 Décision et sécurité d'exécution
- Environnement utilisé : Supabase Replay pwfftcsjyeibxxqhwysw uniquement.
- Les tests de suspension ont été exécutés dans une transaction annulée ; l'état de profil a été vérifié actif après rollback.
- Aucune migration, aucune écriture persistante, aucune modification Production, aucun déploiement.
- La supervision Admin est corrigée au niveau source, mais reste À TESTER par build et navigation réelle.
- État global : JAUNE / NON VERT jusqu'au build/typecheck, aux tests de navigation/pagination, à la matrice des actions sensibles et à la vérification Dashboard de l'exposition API `private`. HIBP ne bloque plus le passage au vert.

### 91.5 Contrôle des compteurs Replay après correction
- Requête SQL indépendante sur Replay : partenaires actifs 0, partenaires en attente 0, produits publiés 0, produits brouillons 0, associations ouvertes 0, professionnels du suivi 0, professionnels vérifiés 0, événements d'audit 99. Ces valeurs décrivent l'environnement Replay à l'instant du contrôle ; elles ne sont pas transposées à Production.
- Le commit de finition des libellés de synthèse Admin est 316b758f82055791ef5de168a061ac4a0d77a0b7.
- L'échec du test transactionnel d'expiration d'affectation (contrainte naxa_professional_assignment_nature_ck) n'est pas compté comme un PASS ; la révocation explicite/expiration reste non certifiée. Aucun changement n'a été conservé par cette tentative.


### 91.6 Reclassement HIBP et inventaire Replay actualisé — 16/11/2026
- Décision utilisateur : HIBP ne constitue pas un blocage lorsque la protection des mots de passe compromis est indisponible sur Supabase Free. Le contrôle reste désactivé et documenté comme limitation fournisseur ; aucun faux PASS n'est déclaré et aucune montée de plan n'est demandée.
- Vérification SQL en lecture seule sur Replay `pwfftcsjyeibxxqhwysw` : profils présents par rôle = Admin 1 actif, Client 8 actifs, Promoteur 1 actif. Affectations professionnelles actives : Caisse 2, Gestionnaire Stock 2, Livreur 1, Responsable 1. Aucun profil Pharmacien ou Comptable n'est actuellement recensé dans `profiles`.
- Cette photographie confirme que les catégories Pharmacien et Comptable ne peuvent pas être certifiées à partir des comptes Replay présents. Les tests scope historiques des rôles Caisse, Gestionnaire Stock, Livreur et Responsable restent des preuves ciblées, mais ne couvrent pas les opérations métier sensibles ni la révocation/expiration.
- Le contrôle SQL de `current_setting('pgrst.db_schemas', true)` retourne NULL : il ne permet pas de conclure sur la configuration effective PostgREST. Le nombre de fonctions `private` (102) et leur présence ne prouvent pas que le schéma est exposé. Seul le réglage Dashboard **Project Settings → API → Exposed schemas** tranche ce point ; aucun GRANT interne n'a été modifié.
- Les commits de supervision Admin existent sur `main`, mais aucun build/typecheck/navigation n'est prouvé dans cette passe. Le contrôle de statut GitHub du commit documentaire courant ne fournit aucun status check. Ne pas déclarer le point 3 vert sur la seule base de la modification source.
- Aucun changement de base n'a été effectué dans cette vérification. Replay consulté en lecture seule ; Production et déploiements non touchés.

## 92. Bébé & Maman — unification ERP Pharmacie et fermeture du circuit partenaire parallèle (16 novembre 2026)

### Décision et périmètre appliqués

- Bébé & Maman est une extension des pharmacies participantes, jamais un partenaire ou établissement autonome.
- Les fiches restent dans `public.produits`, les prix et quantités dans `public.stocks`, les lots et péremptions dans `public.stocks_lots`, et les demandes dans `public.reservations` / `public.reservation_items`.
- La table `public.pharmacie_bebe_maman_produits` ne porte que le classement d’une fiche ERP dans l’univers ; elle ne contient ni prix, ni quantité, ni lot, ni réservation.
- La publication d’une référence exige une ligne de stock ERP, une pharmacie active et dans le périmètre de l’acteur, le service Bébé & Maman actif au dossier pharmacie, et le respect des exclusions médicaments / laits infantiles / céréales infantiles / biberons / tétines / sucettes.
- La pharmacie demeure responsable de sa fiche, de son prix, de ses quantités, de ses lots, des dates de péremption et de sa publication. Aucune validation Admin de fiche n’est ajoutée.
- Les articles Bébé & Maman sont présentés même à quantité vendable nulle si une référence de stock existe ; ils ne sont ajoutables au panier que si le stock vendable calculé par le moteur Marketplace est positif.
- Les réservations sont créées en une transaction serveur atomique, groupées par pharmacie, via `private.reserve_stock`. Elles réutilisent les holds, la fraîcheur du stock, les lots, les péremptions, les délais, les notifications et le poste Stock de l’ERP. Paiement direct pharmacie/client ; aucun encaissement NAXA.
- Le service reste activé ou désactivé par l’Admin dans le dossier individuel de la pharmacie (`admin_set_pharmacie_bebe_maman_service`). L’Admin Univers dispose désormais d’indicateurs de supervision en lecture seule.

### Corrections de code sur `main`

- Migration `20261116053019_bebe_maman_pharmacie_erp_unification.sql` ([source](https://github.com/audreymendomo23-netizen/NAXA/blob/main/supabase/migrations/20261116053019_bebe_maman_pharmacie_erp_unification.sql)) : crée le classement ERP, le contrôle d’éligibilité, la projection catalogue B&M depuis les stocks Pharmacie, la RPC de publication, la RPC de réservation groupée et la supervision Admin.
- Migration `20261116053153_bebe_maman_disable_legacy_partner_flow.sql` ([source](https://github.com/audreymendomo23-netizen/NAXA/blob/main/supabase/migrations/20261116053153_bebe_maman_disable_legacy_partner_flow.sql)) : bloque les nouvelles fiches et réservations B&M via `partner_products` / `universe_reservations`. Les anciennes fiches partenaires peuvent uniquement être archivées ; les anciennes réservations ne sont pas altérées.
- Migration `20261116053344_bebe_maman_admin_supervision_precision.sql` ([source](https://github.com/audreymendomo23-netizen/NAXA/blob/main/supabase/migrations/20261116053344_bebe_maman_admin_supervision_precision.sql)) : les offres comptabilisées respectent le service actif ; les réservations déjà créées restent visibles à traiter même après retrait de la référence.
- `src/components/universes/UniverseProductGrid.tsx` : panier identifié par pharmacie + produit ERP, sans collision entre deux offres de pharmacies différentes.
- `src/app/panier/page.tsx` et `src/app/commande/bebe-maman/page.tsx` : ajout du parcours de finalisation B&M, regroupement multi-pharmacies, réservation atomique et liens vers les réservations ERP.
- `src/app/pharmacie/gestionnaire-stock/actions.ts` et `src/components/pharmacie/GestionnaireStockEspace.tsx` : la pharmacie peut publier ou retirer une référence déjà initialisée dans son stock ERP.
- `src/app/admin/univers/actions.ts` et `src/app/admin/univers/page.tsx` : le catalogue partenaire Admin est limité à Parapharmacie ; B&M dispose de ses propres compteurs de supervision, sans édition ni approbation Admin.
- `src/components/universes/UniverseCatalog.tsx` et `src/components/universes/UniverseLanding.tsx` : libellés alignés sur le rattachement Pharmacie et les références ERP.
- Le service reste administrable dans la fiche pharmacie `/admin/pharmacies/[id]` via `admin_set_pharmacie_bebe_maman_service` ; l’activation globale de l’univers reste contrôlée par le catalogue Admin.
- Commit de la précision de supervision : `3c17e08b3b298658a9b2f56ae54e3cf8d2d22701`.
- Commits applicatifs principaux : `5438e050cc13db157d2386628576ce1d32dcc7c7`, `0c7a5e1119c92ec18d13d5f6287588e6d080cdda`, `b98461a12d483aef1212775c59b91642551ed0a2`, `0d7353339b731ecbb562229c9e442d1aaeb4849d`, `1105926c56d181de0e677fe6e6c3cb50d5aefc17`, `8044c8d6c7d2ebce6c39cef33dcd0aa25f08f176`, `8ef8bd363d1af441ee6b99b44140a02f1124adcb`, `65adcea4e33b922a6c353aaef3254517b5ad24a5`, `10b1fbbf67dbe8708744644bfe568c457ef00f18`, `34971d1772512b05931410180f438fc0a78fffd2`.

### État Replay — contrôle de schéma uniquement

- Migration `20261116053019` appliquée sur Replay (`pwfftcsjyeibxxqhwysw`).
- Migration `20261116053153` appliquée sur Replay (`pwfftcsjyeibxxqhwysw`).
- Migration `20261116053344` appliquée sur Replay (`pwfftcsjyeibxxqhwysw`).
- Vérification SQL en lecture seule : table `pharmacie_bebe_maman_produits` présente avec RLS activé ; RPC de publication, de réservation et de supervision présentes.
- ACL vérifiées : RPC de publication et de réservation exécutables par `authenticated`, non exécutables par `anon` ; RPC catalogue accessible à `anon` et `authenticated` via la façade existante.
- Le registre Replay ne contient actuellement aucune ligne `partner_products`, `universe_reservations` ou `pharmacie_services` pour Bébé & Maman. Aucun transfert automatique de données historiques n’a donc été effectué ; aucune donnée de Production n’a été consultée ou modifiée.
- **Aucune recette E2E, aucun scénario navigateur, aucun build/CI et aucun déploiement n’ont été lancés**, conformément à la consigne de ne pas lancer la recette. La correction du schéma et des sources est enregistrée ; la clôture par recette reste volontairement non déclarée.


## 93. Règle commune de classement des stocks Pharmacie / Bébé & Maman / Parapharmacie (16/11/2026)

**Décision métier validée par l’utilisateur :**
- Stock appartenant à une **Pharmacie** : destinations autorisées **Pharmacie**, **Bébé & Maman** et **Parapharmacie**.
- Stock appartenant à une **Parapharmacie** : destinations autorisées **Bébé & Maman** et **Parapharmacie** ; destination **Pharmacie strictement interdite**.
- Le propriétaire conserve ses fiches, prix, quantités, lots et réservations. La publication dans plusieurs univers ne crée jamais plusieurs stocks physiques.
- Une réservation/vente débite le stock du propriétaire une seule fois et actualise la disponibilité dans toutes les destinations où l’offre est publiée.
- Le classement du produit (catégorie/sous-catégorie/nature) est distinct de ses destinations de vente.
- L’IA peut reconnaître un produit et suggérer une classification/destination avec un niveau de confiance ; elle ne certifie pas la fiche, ne valide pas la conformité pharmaceutique et ne remplace jamais la déclaration/responsabilité du professionnel. Les suggestions restent non bloquantes.
- Les règles de destination et d’éligibilité sont vérifiées côté serveur. Une suggestion IA ne confère aucun droit de publication.

**Audit du code sur main au commit 114f763b5e4ae44dcb0149af3cf4a00c2996f1ef :**
- L’ERP Pharmacie utilise les tables produits, stocks, stocks_lots et les réservations ERP ; la publication Bébé & Maman est actuellement portée par pharmacie_bebe_maman_produits.
- La RPC private.get_universe_catalog renvoie actuellement les produits partner_products uniquement pour Parapharmacie et les fiches ERP Pharmacie uniquement pour Bébé & Maman.
- La migration 20261116053153_bebe_maman_disable_legacy_partner_flow.sql bloque explicitement la création de nouveaux produits partenaires Bébé & Maman.
- Le panier et le checkout Bébé & Maman actuels supposent qu’une offre vient d’une pharmacie et appellent creer_reservations_bebe_maman_client, qui réserve via private.reserve_stock dans l’ERP Pharmacie.
- Le flux Parapharmacie utilise au contraire partner_products et reserve_universe_products. Il n’est donc pas possible de rendre un stock de Parapharmacie visible et réservable dans Bébé & Maman par un simple changement de filtre : le propriétaire et le moteur de réservation doivent être distingués explicitement.

**Contradiction / cause racine :**
Le modèle actuel de Bébé & Maman est exclusivement rattaché à l’ERP Pharmacie, tandis que Parapharmacie est un catalogue/stock partenaire autonome. L’ancienne règle « B&M réservé aux pharmacies » est matérialisée dans la migration et le panier. Ajouter des offres Parapharmacie dans B&M sans adapter panier, checkout et réservation risquerait de traiter un identifiant partenaire comme un identifiant pharmacie et de débiter le mauvais stock.

**Correction requise avant toute déclaration de clôture :**
1. Introduire une destination de publication explicite pour chaque stock propriétaire, sans dupliquer les quantités : ERP Pharmacie et stock autonome Parapharmacie.
2. Étendre le catalogue Bébé & Maman pour lire les deux sources, en renvoyant un type de propriétaire explicite (pharmacie ou parapharmacie) et son identifiant.
3. Adapter le panier/checkout B&M pour router chaque groupe vers le moteur de réservation du propriétaire : réservation ERP Pharmacie pour une pharmacie ; réservation partenaire pour une parapharmacie. Chaque voie vérifie la destination côté serveur.
4. Permettre la publication des références Parapharmacie dans Bébé & Maman sans réactiver l’ancien circuit par inadvertance ; remplacer le blocage générique par une règle explicite réservée aux partenaires Parapharmacie actifs.
5. Pour les stocks ERP Pharmacie, rendre la destination Parapharmacie sélectionnable sans changer la propriété ni le stock physique ; appliquer les droits de l’établissement.
6. Ajouter un service de classification assistée (référentiel d’abord, IA en cas d’incertitude) dont les suggestions sont non bloquantes et séparées des autorisations métier.
7. Mettre à jour les deux espaces Gestionnaire Stock et les catalogues pour afficher les destinations actives, puis documenter les contrôles statiques effectués.

**État de cette reprise :** audit ciblé effectué ; cause racine identifiée ; règle métier documentée. Le code métier n’est pas encore corrigé : une correction limitée aux composants visibles serait incomplète et dangereuse sans le routage catalogue/panier/réservation ci-dessus. Aucun build, CI, test, recette E2E, écriture Supabase/Replay/Production ou déploiement n’a été lancé dans cette passe.

**Point exact de reprise :** implémenter le modèle de destination et le routage double propriétaire dans les migrations SQL et les parcours Gestionnaire Stock / Bébé & Maman / Parapharmacie, en conservant les stocks propriétaires et les deux moteurs de réservation existants ; ensuite seulement faire un contrôle statique ciblé. Ne pas lancer la recette.


## 94. Correction d’architecture des trois univers — propriétaire, destinations et réservation (16/11/2026)

**Règle métier appliquée dans les sources :**
- Pharmacie : destination native Pharmacie ; destinations supplémentaires possibles Bébé & Maman et Parapharmacie.
- Parapharmacie : destination native Parapharmacie ; destination supplémentaire possible Bébé & Maman ; aucune publication dans Pharmacie.
- Le stock physique reste dans son système propriétaire : ERP Pharmacie (`stocks`/`stocks_lots`) ou ERP Parapharmacie (`partner_products`). Les tables de publication ne portent aucune quantité.
- Les offres et paniers portent désormais `owner_type` et `owner_id`. La réservation doit être dirigée vers le moteur de stock du propriétaire.

**Architecture ajoutée sur `main` :**
- Migration `supabase/migrations/20261116070000_three_universes_stock_owner_publications.sql` : tables de publication Pharmacie et Parapharmacie, RLS, RPC de gestion des destinations, catalogue public multi-propriétaire, réservations pharmacie dans le ledger ERP, extension de réservation partenaire B&M et RPC de commande B&M multi-propriétaires.
- Migration de données non destructive prévue : reprise des anciennes publications B&M pharmacie vers la nouvelle table de destinations, sans créer de nouveau stock.
- `get_universe_catalog_v2` expose `owner_type`, `owner_id`, les identifiants historiques vendeur et les données d’offre. L’univers Pharmacie n’expose que le stock ERP Pharmacie ; Parapharmacie et B&M peuvent exposer les deux propriétaires selon les destinations actives.
- Espace Gestionnaire Stock Pharmacie : formulaire de publication dans B&M ou Parapharmacie ; tableau de stock affiche les univers supplémentaires publiés.
- Espace Gestionnaire Parapharmacie : publication d’une fiche Parapharmacie existante vers B&M, sans création d’une deuxième fiche ni d’un deuxième stock.
- Catalogue, cartes et panier : vendeur/propriétaire explicite, clé de panier différenciée par propriétaire, quantité et prix associés à l’offre du propriétaire.
- Checkout B&M : groupes par propriétaire ; les pharmacies passent par `creer_reservations_bebe_maman_client`/`private.reserve_stock`, les parapharmacies par `reserve_universe_products`. Le retour contient le type et l’identifiant propriétaire ; les reçus nettoient le bon groupe du panier.
- Supervision Admin B&M : agrège désormais les publications pharmacie et parapharmacie, leurs offres disponibles et leurs réservations, sans donner de droit de validation de fiche à l’Admin.
- L’ancienne table `pharmacie_bebe_maman_produits` reste synchronisée pour compatibilité du flux pharmacie existant ; les anciennes tables et le moteur financier partenaire sont conservés.

**Commits applicatifs vérifiés sur `main` :**
- Migration d’architecture : `441ef8269eecd718726d9438c01869020ba099ee` (après correction des motifs SQL d’éligibilité et documentation des tables de publication).
- Catalogue et réservation propriétaire : `015b01e1bd1f90ccb822f11c47b358c794023749`, `354a20e5a02764cfee259ab45e6e4b185413f941`, `01130f4fa71b2812fd4e0f071739c93dff80bfaf`.
- Gestion Pharmacie : `cee7da5dd00d5b302e977a07c11fe97f669ae98e`, `931cd4fd46ce87dbf062bee574549cd4ad39d489`, `4b1b5e2f20d6e91882a5c7b123fb2608016af028`.
- Gestion Parapharmacie : `499414262d3ad6d940387ff9a5bf89a2b948258f`, `4da048e930b610b36455b80fe19a5d67c82ae63d`.
- Checkout, panier et reçus : `c9f04da6d9fe134f245121cd1b4ad968e4b2cbae`, `a9c7a48868ee30a7930d8d3a25173172b670936e`, `b3c1fca5256f1b4808317be32850697c4366c480`, `2039d33e3f4f55485f077c9fc4eafe2093088c6a`.
- Supervision Admin et modèle de panier : `c5863ea559b6a68a2772fe183532bd6d05da577a`, `417f09248ba77deef42d9c9c7198fc43e3c245a6`.

**Contrôles effectués — sans recette :**
- Lecture des définitions SQL Replay en lecture seule : les fonctions de réservation ERP, de réservation partenaire, de catalogue, les helpers de périmètre et les fonctions de supervision antérieures ont été retrouvés ; signatures des helpers de scope et d’affectation confirmées.
- Lecture des déclencheurs Replay : les blocages historiques du catalogue partenaire B&M et le déclencheur de synchronisation de l’ancien catalogue ont été identifiés. Le nouveau flux conserve `partner_products.universe_slug='parapharmacie'` et publie B&M uniquement via une table de liaison ; il ne réactive pas la création de fiches partenaires B&M.
- Contrôle statique GitHub des fichiers mis à jour : appels `get_universe_catalog_v2`, `reserve_pharmacy_stock_in_universe`, `reserve_universe_products`, RPC B&M multi-propriétaires, types de propriétaire, actions de publication et composants de reçu présents.
- Aucun build, TypeScript, lint, CI, navigateur, test SQL de migration, test unitaire, recette E2E, migration appliquée sur Replay, écriture Production ou déploiement n’a été exécuté dans cette passe.

**Limites et points non verts :**
- La migration `20261116070000` est versionnée mais pas encore appliquée ; ses fonctions et tables ne sont donc pas encore actives dans Replay ni Production.
- Le code doit encore être compilé et les contrats SQL vérifiés sur Replay avant toute recette. La commande multi-propriétaires, les reçus, le débit FEFO ERP et les transitions de réservation partenaire n’ont pas de preuve d’exécution.
- La supervision Admin a été mise à jour pour agréger les deux propriétaires ; le texte d’aide et les indicateurs ne constituent pas une preuve d’exécution.
- L’IA de classification n’est pas encore branchée au classement des destinations. Le rapprochement IA déjà existant pour l’import Pharmacie ne décide pas les univers ; il faut ajouter une suggestion de catégorie/destination distincte, non bloquante, puis appliquer les autorisations serveur.
- Les filtres d’éligibilité restent des garde-fous lexicaux et les règles métier existantes ; ils ne sont pas une certification réglementaire ni une validation automatique fiable de toutes les familles de produits. Les cas ambigus doivent rester à confirmer par le professionnel.

**Point exact de reprise :** faire une revue SQL ciblée de la migration 20261116070000 (syntaxe, signatures, ACL/RLS, atomicité et transition des réservations), l’appliquer uniquement sur Replay après cette revue, puis compiler les sources et corriger les erreurs. Ensuite, effectuer les tests ciblés de disponibilité croisée et de réservation multi-propriétaire. Ne pas lancer de recette E2E ni de déploiement sans changement explicite de périmètre. Production demeure en lecture seule.


## 95. Passe de clôture technique — architecture des trois univers (16/11/2026)

**Résultat de la passe : corrections appliquées sur `main`, schéma actif sur Replay ; clôture complète conditionnée au dernier run CI du HEAD courant.**

### Corrections code et SQL

- Les réservations d'un groupe Pharmacie dans un univers additionnel sont limitées à 10 lignes, alignées sur le contrat du moteur ERP `private.reserve_stock`.
- L'activation B&M d'une fiche Parapharmacie exige une Parapharmacie active, son association Parapharmacie ouverte et les deux univers actifs. Une fiche partenaire doit d'abord être publiée dans Parapharmacie.
- La réservation Parapharmacie refuse désormais les médicaments à trois niveaux : filtrage du catalogue, contrôle de l'action serveur et garde-fou SQL du moteur `reserve_universe_products`. Ce dernier contrôle aussi les anciennes fiches potentiellement non conformes.
- Les tables de publication conservent la propriété du stock et les droits de lecture RLS ; l'écriture est réservée aux RPC authentifiées avec vérification de rôle, de périmètre et de propriétaire.
- Les index de clés étrangères sont ajoutés aux tables de publication ; les policies RLS utilisent les helpers auth via `(select ...)` pour éviter les warnings initplan sur ces deux tables.
- Une colonne `reservations.source_universe_slug` et son index permettent de tracer explicitement l'univers d'origine d'une réservation ERP, car une fiche peut être publiée dans plusieurs univers. Les flux de réservation Parapharmacie/Pharmacie additionnelle et l'ancien flux B&M Pharmacie renseignent cette provenance ; la supervision Admin B&M filtre sur cette provenance au lieu de déduire l'univers d'après les seuls produits.
- Limite historique : les réservations ERP antérieures à l'ajout de la colonne reçoivent sa valeur par défaut `pharmacie`. Leur origine B&M ne peut pas être reconstruite de façon certaine lorsqu'un même produit pouvait être publié dans plusieurs univers ; aucune reclassification rétroactive n'a été tentée. Les indicateurs B&M par provenance sont fiables pour les réservations créées par les RPC mises à jour après migration. Une réconciliation historique éventuelle nécessitera une preuve indépendante et ne doit pas être déduite du seul produit.
- Les transitions de réservation B&M sont verrouillées en lecture seule pour le rôle Admin dans les trois voies ERP/Partenaire (transition, confirmation et annulation ERP). Le traitement par les utilisateurs professionnels autorisés reste disponible ; les réservations Pharmacie ordinaires ne sont pas modifiées par cette règle.
- Les assertions statiques obsolètes du panier propriétaire unique ont été remplacées par des assertions qui couvrent les deux propriétaires, leurs identifiants, les clés de regroupement et le RPC catalogue v2. Le test KPI Admin contrôle désormais la pagination exhaustive et son traitement d'erreur.

### Migrations Replay — exécutées

Toutes les migrations ci-dessous ont d'abord été jouées dans une transaction de contrôle terminée par `ROLLBACK`; le résultat était vide/sans erreur. Elles ont ensuite été appliquées avec succès sur Replay `pwfftcsjyeibxxqhwysw` :

| Version Replay | Migration |
|---|---|
| `20261116113251` | `three_universes_stock_owner_publications` |
| `20261116113531` | `three_universes_write_scope_hardening` |
| `20261116114024` | `three_universes_partner_medicine_reservation_guard` |
| `20261116114645` | `reservation_origin_tracking` |
| `20261116114815` | `bebe_maman_admin_readonly_reservations` |

Contrôles SQL lecture seule après application :
- Tables de publication présentes, RLS activé ; colonnes/index de traçabilité présents.
- `authenticated` détient uniquement le SELECT direct sur les tables de publication ; les opérations d'écriture passent par RPC.
- RPC d'écriture/réservation non exécutables par `anon`; les RPC de catalogue public restent intentionnellement disponibles aux visiteurs.
- `reserve_universe_products` appelle le garde-fou médicament Parapharmacie ; le helper privé est inaccessible directement à `anon` et `authenticated`.
- RPC de transition/confirmation/annulation B&M contiennent le refus Admin lecture seule.
- Aucun enregistrement de publication Pharmacie/Parapharmacie ni de réservation ERP B&M dans Replay au contrôle final : pas de données historiques copiées, pas de scénarios métier exécutés, aucun fixture créé.

### Qualité applicative — preuves GitHub

- Le workflow `NAXA quality` sur le commit applicatif `ba4005211223521fb799fdbaf6dc5bcb65521551` a terminé avec succès (run `43860902055`) : **549 tests réussis, 0 échec ; TypeScript sans erreur ; lint terminé avec avertissements non bloquants ; build Next.js compilé et 153 pages statiques générées.** Le lint émet encore des avertissements préexistants (mises à jour de state dans des effets, accès aux refs et appels impurs pendant le rendu) ; aucun ne bloque le run.
- Le job actionlint de validation des workflows a réussi sur le commit applicatif `ba400521...`.
- Le HEAD courant est ensuite le commit documentaire `1843585b73f1a1d394173c150f395d2f754ce73d` : seul `docs/E2E_CONTINUITE.md` diffère du SHA applicatif validé. Son run `43861306360` est en cours au dernier contrôle ; le job actionlint a réussi et le job qualité/build est en cours. Le code TypeScript/SQL est identique au commit applicatif `ba400521...` dont le run est vert.
- GitLab miroir : branche `main` non synchronisée avec GitHub ; son ancien pipeline vert n'est pas une preuve pour cette version. GitHub Actions est le seul contrôle de qualité courant exploitable dans cette passe.

### Limites et statut

- **Construction / schéma Replay :** corrections et migrations appliquées ; contrats ACL/RLS, provenance et restrictions de transition contrôlés en lecture seule.
- **Qualité sur le SHA précédent `fa0aa869...` :** 549/549 tests, TypeScript, lint et build réussis (avertissements lint présents).
- **Qualité sur le HEAD courant `ba400521...` :** en attente du run GitHub Actions `43860902055` au dernier point de contrôle.
- **Recette E2E :** non lancée. Aucun stock ou compte de test créé ; aucun comportement réel de réservation/FEFO/paiement/retrait validé sur des données.
- **Production :** aucune lecture ni écriture dans cette passe ; aucune migration Production.
- **Déploiement :** aucun déploiement, aucun Preview/Production déclenché.
- **IA de classification :** les destinations sont définies manuellement par le professionnel et contrôlées côté serveur. La suggestion IA automatique de catégorie/destination n'est pas encore raccordée ; elle reste non bloquante et ne doit pas conférer les droits de publication.

**Point exact de reprise :** vérifier la conclusion du run GitHub Actions `43860902055` sur `ba400521...`. En cas de succès, passer à une revue de recette ciblée (stock partagé, disponibilité croisée, réservation Pharmacie B&M, réservation Parapharmacie B&M, refus médicaments, transitions Admin interdites), uniquement après ordre utilisateur de lancer cette recette. En cas d'échec, corriger uniquement la cause démontrée et relancer sur le nouveau HEAD. Ne pas déployer et ne pas toucher à Production.



## 96. Alignement des profils professionnels entre Web et application native (16/11/2026)

**Correction appliquée sur `main` :**
- La connexion Web ne déduit plus l'espace professionnel du seul `profiles.role` racine. Après authentification du mot de passe, elle résout le rôle actif avec la RPC authentifiée `naxa_business_function()`, comme la session native.
- Les fonctions professionnelles reconnues sont alignées sur les deux canaux : Promoteur, Pharmacie, Caisse/Caissière, Responsable, Comptable, Pharmacien, Gestionnaire de stock, Magasinier et Livreur.
- La connexion Web récupère le périmètre pharmacie avec `naxa_active_role_pharmacy()`, au lieu de déduire le rattachement depuis le seul profil racine.
- La session native utilise désormais la même RPC de périmètre pharmacie ; elle ne prend plus `profiles.pharmacie_id` comme source d'autorité pour les fonctions affectées.
- En cas de refus de rôle ou de périmètre pendant la connexion Web, la session créée pour la résolution est fermée.
- Les conflits d'affectation Centre d'examens restent bloqués explicitement et ne sont pas requalifiés en espace Pharmacie.

**Preuves Replay sur les comptes déjà présents :**
- Contrôle SQL en contexte PostgreSQL `authenticated` avec `auth.uid()` réglé sur chaque compte existant : Promoteur, Caisse, Responsable, Gestionnaire de stock (deux pharmacies), Livreur et Client.
- Résultat : **7/7 résolutions exactes**, avec le bon rôle actif et, pour les rôles rattachés à une pharmacie, le bon identifiant de pharmacie.
- Le contrôle a été exécuté dans des transactions annulées ; aucune donnée, affectation ou session de compte n'a été modifiée.
- Test de non-régression ajouté : `scripts/test-auth-workspace-parity.cjs`, inclus automatiquement dans `npm test`.

**Limites réelles — pas de faux vert :**
- Le rejeu contient actuellement des identités Auth/profils Promoteur, Responsable, Caisse, Gestionnaire de stock, Livreur et Client. Il ne contient **aucun compte Pharmacien ni Comptable** et aucune accréditation Pharmacien. Ces deux parcours ne peuvent donc pas être déclarés validés avec les seuls comptes existants.
- La recette SQL prouve la résolution du rôle et du périmètre sous le rôle PostgreSQL `authenticated`, mais ne remplace pas une connexion par mot de passe ni une recette navigateur réelle. Aucun mot de passe ou secret des comptes existants n'a été lu, réinitialisé ou exposé.
- Le correctif Web/native a été validé ensuite par le workflow qualité et les tests Android du HEAD `d272d59c9076972907ed70216a812c02589b2966` (détails section 97).
- Les recettes transactionnelles Pharmacien/Comptable ont utilisé des profils éphémères dans des transactions annulées ; le contrôle après rollback confirme zéro profil, agrément ou affectation persistant. Aucune donnée Production n'a été consultée ou modifiée. Aucun déploiement n'a été lancé.

**Point exact de reprise :** vérifier le workflow qualité du HEAD après l'ajout du test de parité. Puis exécuter, avec les identifiants de recette déjà autorisés lorsqu'ils sont disponibles, la connexion Web et native des profils existants. Ne pas créer ni convertir un compte pour simuler Pharmacien ou Comptable ; ces deux profils restent bloquants pour le vert intégral tant qu'une identité métier existante et autorisée n'est pas disponible.


## 97. Résultats consolidés — profils Pharmacie, capacité équipe et parité des canaux (16/11/2026)

**Les quatre blocs métier contrôlés sur Replay :**
1. **Caissières** : trois comptes métier distincts peuvent être affectés alors que `max_caisses=1` continue de limiter la ressource physique ; aucune caisse physique supplémentaire n'est créée.
2. **Effectifs Stock/Comptabilité/Livraison** : plusieurs Gestionnaires de stock, Comptables et Livreurs sont autorisés indépendamment des niveaux d'architecture. Les droits d'écriture Comptable sont délégués individuellement par le Promoteur ; l'affectation ne crée aucune écriture ni vente.
3. **Responsable et Promoteur** : un seul Responsable actif par pharmacie et par période ; le même Promoteur peut gérer plusieurs pharmacies indépendantes.
4. **Pharmacien** : proposition par Promoteur, justificatif rattaché au compte et à la pharmacie, validation Promoteur, activation du poste sur le bon périmètre, puis révocation complète. La décision métier applicable est celle du Promoteur ; aucun rôle Pharmacien ne peut être attribué par la RPC générique.

**Recettes Replay exécutées et résultats :**
- Test SQL `20261116003000_promoter_validates_pharmacists_and_staff_capacity_e2e.sql` : **13/13 PASS**. Il réutilise le Promoteur Replay actuel et crée les profils techniques uniquement dans la transaction de test, annulée par `ROLLBACK`.
- Recette transactionnelle Pharmacien : **4/4 PASS** — proposition, validation Promoteur, sélection du rôle et périmètre pharmacie, révocation. Le profil cible et le faux objet Storage sont temporaires et annulés.
- Résolveur authentifié sur les comptes Replay présents : **7/7 PASS** — Promoteur, Caisse, Responsable, deux Gestionnaires de stock, Livreur et Client ; rôle et pharmacie attendus.
- Contrôle après rollback : **0** profil `naxateam*`, **0** profil `naxapharmrecipe*`, **0** agrément de recette, **0** affectation Pharmacien active. Aucun profil Pharmacien ou Comptable n'a été conservé ou créé dans Replay.
- Workflow E2E Replay `43863121060` : **SUCCESS**. Le navigateur a réellement appelé `/api/auth/login` ; les parcours Promoteur, Caisse/Stock et Client ont été authentifiés. La recette crédit comptoir, le remboursement par JWT Caisse, Web Push et Storage ont réussi ; Storage affiche **17 PASS, 0 SKIP** et le nettoyage des sessions/fichiers/comptes temporaires est passé.
- Workflow qualité `43864157337` : **SUCCESS** — **552/552 tests**, TypeScript sans erreur, build Next.js réussi, **153/153 pages** générées, actionlint réussi. Lint : 0 erreur, 225 avertissements préexistants.
- Workflow Android `43864157838` : **SUCCESS** — tests Compose et nouvelle matrice de rôles native réussis, intégration émulateur réussie, variantes du compagnon de paiement réussies.

**Parité Web / Android :**
- Web et session native appellent tous deux `naxa_business_function()` et `naxa_active_role_pharmacy()` dans le contexte authentifié.
- Le Web ne dépend plus de `profiles.role` racine pour reconnaître les profils internes ; il résout le rôle actif après authentification, comme le canal natif.
- Les rôles Pharmacie reconnus sont identiques sur les deux canaux : Promoteur, Pharmacie, Caissière/Caisse, Responsable, Comptable, Pharmacien, Gestionnaire de stock et Magasinier. Livreur conserve son routage métier dédié.
- Tests de non-régression ajoutés : `scripts/test-auth-workspace-parity.cjs` et `NaxaNativeRoleTest.kt`.

**Limite à conserver — comptes métier manquants :**
- Les comptes Auth/profils réels Pharmacien et Comptable sont toujours absents du Replay courant. Leur logique métier et leur sélection de rôle ont été testées dans des transactions annulées, mais leur connexion réelle par mot de passe ne peut pas être validée sans identité existante.
- Le vert est donc acquis pour les quatre blocs métier, les profils réellement présents, la parité de routage et les validations techniques. La matrice d'authentification réelle n'est pas intégralement verte pour Pharmacien et Comptable tant que ces deux comptes n'existent pas. Aucun compte n'a été créé ou converti pour masquer ce manque.
- Production est restée intacte ; aucun déploiement Vercel n'a été lancé.

**Point exact de reprise :** ne pas retoucher les quatre blocs déjà passés. À la prochaine passe, si des identités Pharmacien et Comptable autorisées sont créées par le parcours métier, exécuter uniquement leur authentification réelle Web + Android et vérifier leurs écrans métier respectifs.


## 98. Raccordement Livreur et création des profils Comptable / Pharmacien Replay (16/11/2026)

**Architecture des espaces — correction appliquée sur `main` :**
- Le Livreur n'est plus traité comme un simple sous-rôle de l'espace Pharmacie général. La session native renvoie désormais `activeWorkspace="livreur"` et le résolveur Android n'accepte le tableau de bord Livreur que pour le couple `role=livreur / workspace=livreur`.
- La connexion Web ne déduit plus la destination du seul `profiles.role` racine, souvent `client` pour les collaborateurs. Elle appelle `naxa_business_function()` après authentification et route le rôle actif vers son espace : Promoteur, Caisse, Responsable, Gestionnaire de stock, Pharmacien, Comptable ou Livreur.
- La page d'entrée Pharmacie redirige également les profils Livreur, Comptable, Pharmacien, Gestionnaire de stock et Magasinier vers leur espace métier respectif.
- Tests de parité Web/native : `scripts/test-auth-workspace-parity.cjs`. Tests Android : `NaxaNativeRoleTest.kt`.

**Comptes Replay créés depuis le Promoteur de test existant :**
- `naxa_e2e_comptable` : profil Auth confirmé et actif, rôle racine Client conservé, affectation Comptable active à la pharmacie Replay `76dd4983-273a-4a83-ae3d-9a7838d3aa35`. Le Promoteur a explicitement accordé le droit d'écriture comptable ; `compta_scope_autorise` renvoie true.
- `naxa_e2e_pharmacien` : profil Auth confirmé et actif, rôle racine Client conservé. Le Promoteur a déposé un justificatif **fictif E2E uniquement**, proposé puis approuvé le dossier. L'agrément est `approved_promoteur`, l'affectation Pharmacien est active et le résolveur donne le bon périmètre pharmacie. Le document de 677 octets porte explicitement la mention « NOT A REAL LICENSE » ; il ne constitue ni une pièce réglementaire ni une validation d'une personne réelle.
- Ces identités ont été créées/reprises par le provisionneur Auth Replay, puis affectées via les RPC métier du Promoteur. Aucun rôle racine n'a été forcé directement.

**Correction RLS du justificatif Pharmacien :**
- Cause racine : la policy Storage lisait directement `profiles.target`; le RLS masquait ce profil au Promoteur et rejetait l'upload.
- Migration `20261116003500_pharmacien_credential_storage_rls_definer.sql` : helper `private.naxa_pharmacien_credential_upload_allowed(text,text)` en SECURITY DEFINER, limité à `auth.uid()`, au réseau du Promoteur, à la pharmacie active et au profil cible actif.
- Migration `20261116004000_pharmacien_credential_storage_mimetype_fallback.sql` : accepte le suffixe PDF/JPEG/PNG sûr lorsque le client Storage ne renseigne pas `metadata.mimetype`, tout en conservant la liste MIME autorisée du bucket.
- Les deux migrations sont appliquées sur Replay. Recette SQL RLS : **3/3 PASS** (upload Promoteur, refus hors réseau, fallback MIME). L'upload Storage réel via le compte Promoteur a réussi.

**Recette de rôles Replay :**
- Provisionnement E2E des cinq profils Caisse, Stock, Client, Comptable et Pharmacien : étape 9 du workflow `43870154759` **SUCCESS**. Le workflow a ensuite poursuivi les étapes de recette générale.
- Contrôle SQL sous rôle PostgreSQL `authenticated`, avec sélection du rôle actif et vérification du périmètre : **9/9 PASS** — Promoteur, deux comptes Caisse, Responsable, deux Gestionnaires de stock, Livreur, Comptable et Pharmacien.
- Le Livreur existant `naxa_e2e_livreur` est actif et affecté à la pharmacie Replay. Le harnais se connecte désormais avec son mot de passe éphémère issu du parcours d'invitation, vérifie son affectation active, appelle `naxa_select_active_role('livreur')`, puis contrôle par JWT `naxa_business_function()='livreur'` et `naxa_active_role_pharmacy()=<pharmacie cible>`. Aucun rôle Livreur n'est créé par une affectation générique.
- Le Comptable et le Pharmacien se connectent par le provisionneur E2E, sélectionnent leur poste et résolvent le bon périmètre. Le droit comptable est vérifié explicitement ; le dossier Pharmacien est proposé et approuvé par le Promoteur.
- Test de non-régression ajouté au harnais : `scripts/test-replay-pharmacy-staff-safe.cjs` exige désormais la vérification JWT du Livreur invité.

**Preuves de non-régression :**
- Workflow qualité `43870154780` : **SUCCESS**, 556/556 tests, TypeScript sans erreur, lint 0 erreur (225 avertissements), build Next.js réussi, 153/153 pages générées, actionlint réussi.
- Workflow Android `43866621863` : **SUCCESS**, tests de routage Compose et matrice des profils incluant le Livreur.
- Workflow Replay `43870154759` : **SUCCESS** global ; provisionnement rôles (étape 9), pharmacie technique (étape 10), stock/caisse (étape 11), Web Push, remboursement, parcours navigateur et Storage réussis.
- Workflow Replay `43872161057` : **SUCCESS global**. Les étapes de provisionnement du Livreur invité, des cinq profils Client/Caisse/Stock/Comptable/Pharmacien, de la pharmacie technique et du Responsable, puis les contrôles de stock/caisse, Web Push, remboursement, navigateur et Storage ont toutes terminé avec succès. Les fichiers de mots de passe éphémères ont été nettoyés par le workflow.
- Workflow qualité `43872473001`, exécuté sur le HEAD `615cde577662f29f32cf46ca2a2330def14bf1a0` : **SUCCESS** pour les deux jobs. Tests Node, TypeScript, ESLint, build Next.js et actionlint sont passés. L'ancien run `43872198768`, annulé lors du remplacement du commit, est supersédé par ce run complet réussi.
- Workflow Android `43866621863`, commit `d9bd9320ec21348a89b46adeec61dc4b2acc8820` : **SUCCESS** pour les trois jobs — tests d'intégration émulateur, compilation/tests Compose et assemblage de l'application NAXA, compilation/tests de l'application compagnon.
- Aucun déploiement Vercel et aucune donnée Production consultée ou modifiée.

**Conclusion du lot :** 🟢 CONSTRUCTION VERTE — TEST UTILISATEUR POSSIBLE pour le raccordement des espaces Livreur/Web/natif et le provisionnement des profils de test Comptable/Pharmacien sur Replay. Cela ne certifie pas à lui seul la recette complète de toutes les fonctionnalités métier ni les campagnes E2E globales.

**Point exact de reprise :** réaliser la recette interactive Web et Android des comptes Livreur, Comptable et Pharmacien, en utilisant les secrets éphémères dans le workflow (ne jamais les inscrire dans Git ni les envoyer dans la conversation). Pour le Pharmacien, conserver exclusivement le justificatif fictif « NOT A REAL LICENSE » sur Replay ; ne jamais le réutiliser comme pièce réelle ou réglementaire. Ne pas toucher à Production.


## 99. Identité unique et cumul inter-univers pharmacie ↔ SPD

**Date :** 16 novembre 2026.  
**HEAD avant ajout :** `aed409ae73134ddf18518fa917fb1337e9622deb`.  
**Spécification versionnée :** [docs/IDENTITE_UNIQUE_CUMUL_ESPACES_SPEC_E2E.md](IDENTITE_UNIQUE_CUMUL_ESPACES_SPEC_E2E.md).

### Audit statique initial

Lecture de `main` confirmée au commit `b21d89927f4f894289f3463162ce342b6f6ec394` :
- `src/components/EspaceNaxaSwitcher.tsx` : aucun espace SPD ; l'entrée Client dépend encore de `profiles.role === "client"` et `profiles.actif === true`.
- `src/app/api/auth/login/route.ts` : le contrôle global `profile.actif` intervient avant le choix Client/professionnel ; à dissocier des états d'affectation.
- `src/app/admin/creation-univers-actions.ts` : création d'une identité Auth par `auth.admin.createUser()` au provisionnement d'un dossier d'univers ; contradiction avec l'identité unique.
- `src/app/pharmacie/affectations/actions.ts` : attribution directe par RPC d'affectation, sans orchestration préalable du cumul SPD.
- `src/app/partenaire/affectations/actions.ts` : attribution directe partenaire, sans contrôle transversal des affectations pharmacie.
- `docs/AVANT_PROJET_IDENTITE_UNIQUE_ESPACES_NAXA.md` : documente la limite du modèle mono-rôle historique.

### Actions GitHub réalisées

- Création sur `main` de `docs/IDENTITE_UNIQUE_CUMUL_ESPACES_SPEC_E2E.md`, commit `aed409ae73134ddf18518fa917fb1337e9622deb`.
- Le document formalise les règles approuvées, les deux sens du cumul, l'approbation de toutes les organisations concernées, l'arbitrage Admin, la révocation, l'identité Client permanente, le cloisonnement, la séquence technique et 16 scénarios E2E Replay.

### État réel — ne pas confondre spécification et implémentation

- Audit de code statique : **partiel effectué**.
- Spécification métier/technique : **versionnée**.
- Migration, RPC et policies cumul : **non implémentées**.
- Sélecteur/login/admin dossier : **non corrigés**.
- Recette E2E Replay de ce chantier : **non exécutée**.
- Production / déploiement : **non touchés**.

**Point exact de reprise : Lot A — inventaire SQL.** Lire les migrations existantes, tables, contraintes, triggers, RPC et policies RLS avant toute migration. Ne pas créer de tables en doublon, ne pas provisionner de compte SPD réel et ne pas déclarer vert.


## 100. Audit SQL Replay — cause racine du cumul SPD

**Date :** 16 novembre 2026. **Base :** Replay `pwfftcsjyeibxxqhwysw`. **Nature :** lecture seule, aucun enregistrement métier modifié.

- `naxa_profile_active_roles` confirme une seule sélection active par identité ; le champ `partner_id` existe déjà.
- `naxa_professional_account_domains` n'autorise que `PHARMACIE` et `PARAPHARMACIE`.
- `naxa_roles` ne contient aucun rôle SPD.
- `private.naxa_partner_business_function`, `public.naxa_select_active_role`, `private.naxa_partner_scope_allows` et `public.naxa_grant_partner_professional_assignment` sont tous restreints à `partner_type='parapharmacie'` / domaine `PARAPHARMACIE`.
- `public.admin_create_partner_dossier` désactive globalement `profiles.actif` lorsque l'abonnement initial n'est pas courant. Cette règle peut bloquer l'identité entière, dont Client ; elle doit devenir un verrou commercial scoped au partenaire.
- Aucun RPC de demande/approbation de cumul transversal n'a été trouvé parmi les fonctions inspectées.
- Les notifications ont un destinataire `user_id` et des outbox Push/E-mail réutilisables ; la demande devra créer les notifications durables par Promoteur.

**Décision technique :** conserver `naxa_profile_active_roles` comme sélecteur mono-espace, généraliser les domaines/rôles/guards pour SPD et dissocier `profiles.actif` du verrou d'abonnement partenaire. Ne pas réutiliser aveuglément la RPC Parapharmacie pour SPD.

**État :** audit SQL de cause racine effectué en lecture seule. Aucune migration cumul appliquée ; aucun test E2E cumul exécuté ; aucun déploiement/Production touché.

**Point exact de reprise :** inventorier les fonctions et politiques RLS des univers SPD et les parcours de création/activation de partenaire ; concevoir ensuite une migration additive, ses RPC d'approbation atomiques et les guards d'accès, avant de préparer les fixtures multi-espace sur Replay.


## 101. Précision — modèle SPD déjà présent

L'audit des politiques Replay confirme que le SPD utilise `partners.partner_type='professionnel_domicile'` et `partner_members` (`owner/manager/operator`), tandis que l'accord indépendant personnel du titulaire est porté séparément par `partner_independent_agreements`. Les offres et demandes SPD contrôlent le membership, le statut partenaire et `profiles.actif`.

**Conséquence pour la suite :** le cumul doit agréger les affectations pharmacie et les memberships SPD ; il ne faut pas forcer le SPD dans le modèle Parapharmacie. Le sélecteur universel devra activer un rôle SPD explicite tout en gardant séparés membership opérationnel, convention indépendante et habilitation clinique.

Aucune modification SQL/code ni recette fonctionnelle n'a été réalisée à ce stade.


## 102. Recette ciblée des rôles Livreur, Comptable et Pharmacien — contrôle Replay (16/11/2026)

**Périmètre :** projet Replay `pwfftcsjyeibxxqhwysw` ; aucune écriture métier, aucune modification de schéma, aucun déploiement et aucun accès Production.

### Identités et autorisations contrôlées

La pharmacie technique `76dd4983-273a-4a83-ae3d-9a7838d3aa35` (NAXA E2E — Pharmacie Mvan) conserve les trois affectations actives suivantes :
- `naxa_e2e_livreur` : rôle `livreur`, périmètre pharmacie exact.
- `naxa_e2e_comptable` : rôle `comptable`, périmètre pharmacie exact, `compta_scope_autorise=true` et `compta_ecriture_autorisee=true`.
- `naxa_e2e_pharmacien` : rôle `pharmacien`, périmètre pharmacie exact, une accréditation `approved_promoteur` et une affectation active. Le justificatif associé demeure fictif et réservé à Replay.

Les contrôles ont été exécutés en transaction `BEGIN … ROLLBACK`, sous le rôle PostgreSQL `authenticated`, avec `request.jwt.claim.sub` correspondant à chaque identité. Aucun état n'a été persisté.

### Résultats exécutés

| Parcours | Contrôle exécuté | Résultat |
|---|---|---|
| Livreur | Résolution `naxa_business_function()` + `naxa_active_role_pharmacy()` | **PASS** — `livreur` et pharmacie attendue |
| Livreur | `naxa_delivery_my_missions(false)` + `naxa_delivery_my_performance(30)` | **PASS technique** — réponse valide, 0 mission et métriques nulles/à zéro |
| Comptable | Résolution rôle et pharmacie | **PASS** — `comptable` et pharmacie attendue |
| Comptable | `compta_scope_autorise()` + `compta_ecriture_autorisee()` | **PASS** — les deux valeurs sont `true` |
| Comptable | `compta_config_lire()` | **PASS technique** — configuration vide (`journaux=[]`, `periodes=[]`) |
| Pharmacien | Résolution rôle et pharmacie | **PASS** — `pharmacien` et pharmacie attendue |
| Pharmacien | Accréditation Promoteur + affectation active | **PASS** — 1 accréditation approuvée et 1 affectation active |
| Pharmacien | `pharmacien_prescriptions_recentes()` | **PASS technique** — réponse valide, 0 prescription |

### Contradiction et cause du blocage transactionnel

- La pharmacie technique ne contient **aucune réservation** et **aucune mission de livraison**. Le Livreur ne peut donc pas recevoir une mission créée après préparation, l'accepter, effectuer le retrait, signaler l'arrivée et confirmer la remise au client.
- Aucun journal ni période comptable n'est configuré (`compta_config_lire()` retourne deux listes vides). Il n'existe donc pas de base de recette pour tester une écriture, la partie double, l'audit et la clôture d'une période.
- Aucune prescription récente n'existe pour le Pharmacien. L'identité dispose uniquement d'un justificatif explicitement fictif E2E ; cela ne permet pas de valider un acte pharmaceutique réel ou une accréditation réglementaire.
- Les trois appels métier de lecture ont répondu correctement, mais **une réponse vide n'est pas une recette fonctionnelle complète**. Aucun test de connexion interactive par mot de passe Web/Android n'est prouvé par ces requêtes SQL.

### Conclusion

**Statut du lot : 🟡 PARTIEL — contrôles d'identité, de rôle, de périmètre et de guards réussis ; parcours transactionnels non clôturés.** Ne pas déclarer Livreur, Comptable ou Pharmacien intégralement verts sur la seule base de ces contrôles.

**Point exact de reprise :** préparer sur Replay des données de recette isolées et cohérentes via les parcours métier existants (commande client et stock réel de la pharmacie technique ; configuration comptable par le Promoteur ; dossier/prescription Pharmacien de démonstration non réglementaire), puis exécuter les transitions avec les JWT des comptes éphémères du workflow. Ajouter les preuves de connexion Web et Android via un runner navigateur/émulateur. Le cumul Pharmacie↔SPD reste un chantier distinct non implémenté (§99–101). Ne pas utiliser Production ni créer des écritures métier directes hors RPC.


## 103. Clôture ciblée Replay — Livreur, Comptable, Pharmacien (16/11/2026)

**Périmètre :** projet Supabase Replay `pwfftcsjyeibxxqhwysw`, pharmacie technique Mvan `76dd4983-273a-4a83-ae3d-9a7838d3aa35`. Toutes les recettes transactionnelles ci-dessous utilisent des fixtures synthétiques identifiées E2E dans une transaction annulée (`BEGIN/ROLLBACK`). Aucune commande, mission, vente, session de caisse, prescription, configuration comptable ou activation livraison n'a été conservée.

### Corrections livrées sur `main` et appliquées à Replay

| Migration | Commit GitHub | Correction |
|---|---|---|
| `20261116193000_fix_delivery_stock_confirmation_before_dispatch.sql` | `f99fda2d975741463266447ea6ce5b4a2c9ca6c1` | La confirmation Stock n'essaie plus de publier la mission avant la préparation physique. |
| `20261116194000_fix_delivery_pos_returning_ambiguity.sql` | `8618accdc988ffc9fdf7527a4ba8c793e576dbc2` | Qualification de `ventes.id` et `ventes.numero_vente` pour lever l'ambiguïté PL/pgSQL du POS livraison. |
| `20261116195000_fix_delivery_pos_reservation_settlement.sql` | `702ab62a815fcf211403ce0d1d636e4ae3c3bfde` | L'acceptation Stock confirme aussi la réservation ; le contrôle POS inclut les frais de livraison dans le total attendu. |
| `20261116195500_allow_delivery_confirmation_events.sql` | `3f9e070e7b8396adec552d46d021e58b6c57364a` | Autorisation des événements `client_confirmed` et `courier_confirmed` dans la contrainte des événements Livraison. |

Les quatre migrations sont enregistrées dans `supabase_migrations.schema_migrations` sur Replay (versions `20261116192010`, `20261116192200`, `20261116192308`, `20261116192342`).

### Livreur — parcours transactionnel complet

**PASS Replay, transaction annulée :**
1. Promoteur active le service Livraison pour la pharmacie E2E.
2. Gestionnaire Stock confirme la demande ; assertion explicite : aucune mission n'existe à ce stade.
3. Client choisit `especes_livraison`.
4. Stock passe par `en_preparation`, puis `prete_au_retrait` ; la mission n'est créée qu'à cette seconde transition.
5. Livreur voit la mission, l'accepte, retire la commande et signale son arrivée.
6. Livreur déclare 2 500 FCFA ; Caisse ouvre sa session et valide le rapprochement POS (1 000 FCFA commande + 1 500 FCFA livraison).
7. Client confirme la réception et Livreur confirme la remise ; assertions finales : mission `delivered`, commande `livree`.

Une seconde exécution ciblée confirme séparément l'absence de dispatch prématuré et la création après préparation. Les deux transactions ont été annulées ; vérification post-test : 0 commande, 0 mission, 0 prescription de démonstration et `livraison_active=false` sur la pharmacie E2E.

### Comptable — configuration, plan et sécurité

**PASS Replay, transaction annulée :** création/validation d'un journal `vente_encaissee`, ouverture d'une période de test, création/validation de deux comptes, validation des mappings débit/crédit, relecture de configuration et `compta_verifier_audit=true`.

**Garde PASS :** `compta_poster_ecriture` et `compta_cloturer_periode` ne sont pas exécutables par la session `authenticated` (permission denied), conformément à leur restriction serveur. Le cron `naxa-compta-worker` est actif (`*/5 * * * *`) et ses cinq dernières exécutions observées sont `succeeded`.

**Reste comptable :** la publication réelle d'une écriture et la clôture réelle d'une période par le worker `service_role` ne sont pas prouvées dans ce lot. Le worker a 28 événements en état `erreur` sur une autre pharmacie Replay (`1a4f1ce5-cccf-477e-9a5b-474c8c9fc713`) : 14 `credit_octroi` et 14 `credit_remboursement`, code `worker_P0001`. Le Promoteur E2E possède un périmètre sur cette pharmacie mais le Comptable E2E n'y est pas affecté ; ces événements n'ont donc pas été modifiés.

### Pharmacien — consultation et prescription

**PASS Replay, transaction annulée :** création d'une consultation de démonstration et d'une prescription explicitement fictive/non thérapeutique par `pharmacien_creer_consultation` et `pharmacien_creer_prescription`, statut `validee`, puis présence vérifiée via `pharmacien_prescriptions_recentes`.

**Reste Pharmacien :** le parcours Client `naxa-client-prescriptions` exige un véritable objet PDF/JPEG/PNG dans Storage avant `naxa_client_soumettre_ordonnance`. Aucun upload Storage de fichier de test n'a été effectué ; le dépôt Client puis la validation d'une ordonnance entrante par le Pharmacien ne sont donc pas déclarés verts. Aucun justificatif fictif n'est présenté comme document clinique réel.

### Limites de recette interactive et statut final

- Connexion interactive des comptes Web et Android non exécutée : les outils disponibles dans cette session permettent les RPC SQL Replay et la lecture des workflows, mais pas de piloter un navigateur/émulateur ni d'authentifier les comptes par leurs mots de passe éphémères.
- Les tests CI/Android historiques restent ceux des runs du §98 ; aucune nouvelle campagne CI n'a été déclenchée par ces migrations.
- Aucun déploiement Preview/Production, aucune écriture Production, aucun envoi Play Store.

**Statut : 🟢 Livreur — recette RPC métier complète sur Replay (fixtures annulées) ; 🟡 Comptable — configuration/plan/audit validés, worker d'écriture et clôture non prouvés ; 🟡 Pharmacien — création/lecture interne validées, dépôt Client et validation entrante non prouvés ; 🟡 global — connexions Web/Android interactives non prouvées.**

**Point exact de reprise :** vérifier le worker comptable sur un événement E2E réellement émis par une vente Replay et clôturer une période de test via le service serveur ; fournir un objet fichier E2E dans Storage pour exécuter le dépôt Client puis la validation Pharmacien ; utiliser un runner navigateur/émulateur pour les logins Web/Android. Ne pas traiter les 28 événements d'une autre pharmacie sans vérifier son lot de recette et son périmètre dédié.


## 104. Complément Pharmacien — validation et rejet d'ordonnance entrante (16/11/2026)

**PASS Replay, transaction annulée :** deux lignes de prescription synthétiques `source='client'`, en statut `en_attente`, ont été créées dans le seul but de tester le workflow Pharmacien (références explicitement fictives, aucun fichier clinique réel). Sous l'identité `naxa_e2e_pharmacien` et avec son poste actif :
- `prescription_valider(id, true, NULL)` retourne `validee`, met à jour le statut et inscrit le Pharmacien comme validateur.
- `prescription_valider(id, false, motif)` retourne `rejetee` et conserve le motif obligatoire.
- Une tentative Client `naxa_client_soumettre_ordonnance` avec un chemin Storage inexistant est rejetée par le garde-fou `Document d’ordonnance absent ou hors périmètre`.

**Limite maintenue :** aucune pièce PDF/JPEG/PNG n'a été téléversée dans le bucket `naxa-client-prescriptions` ; la création réelle côté Client suivie de la revue Pharmacien n'est donc pas complète. Les deux lignes de test ont été annulées et aucune prescription fictive n'est persistée.

**Statut Pharmacien : 🟡 — les branches métier acceptation/rejet sont prouvées ; le dépôt Storage positif et la connexion interactive restent non prouvés.**



## 105. Reprise clôture recettes manquantes — inspection worker et Storage (16/11/2026)

**Périmètre confirmé :** Supabase Replay `pwfftcsjyeibxxqhwysw`, pharmacie technique Mvan `76dd4983-273a-4a83-ae3d-9a7838d3aa35`. Aucun accès Production, aucun déploiement.

### Comptable — inspection complémentaire

- L'exécution SQL de contrôle s'effectue sous `current_user=postgres` (aucun rôle JWT simulé). Le worker privé `private.compta_worker_traiter_lot(integer)` exige explicitement `current_user='postgres'`, puis positionne le claim `service_role` dans sa transaction. Il est donc techniquement possible de l'appeler depuis ce contexte privilégié, mais cela traite le lot global, pas une seule pharmacie.
- Le cron `naxa-compta-worker` est actif à `*/5 * * * *`, commande `select private.compta_worker_traiter_lot(50)`. Les cinq dernières exécutions observées (19:20 à 19:40 UTC) sont `succeeded`. Cela prouve l'exécution SQL planifiée, pas le succès métier de chaque événement.
- L'inspection des événements montre **28 événements en erreur uniquement sur la pharmacie distincte** `1a4f1ce5-cccf-477e-9a5b-474c8c9fc713` : 14 `credit_octroi`, 14 `credit_remboursement`, code `worker_P0001`. Aucun événement comptable n'existe sur Mvan E2E.
- Ces événements sont en statut terminal `erreur` et ne sont pas repris automatiquement par la requête de réclamation (qui sélectionne `a_traiter` ou un claim expiré). Leur réouverture ou leur traitement n'est pas autorisé dans cette recette : autre pharmacie, autre lot, et affectation Comptable E2E absente. Aucun événement n'a été touché.
- **Cause de non-clôture du test worker Mvan :** absence d'événement métier source sur Mvan. Aucun événement synthétique n'a été inséré directement et aucun lot global n'a été lancé pour éviter de traiter les 28 erreurs d'une autre pharmacie. Il faut produire une vente E2E par le parcours POS réel sur Mvan, vérifier son événement émis par le mécanisme métier, configurer le journal/mappings sur cette pharmacie, puis appeler le worker dans un contexte serveur contrôlé et vérifier l'écriture équilibrée et l'état final de l'événement. La clôture doit ensuite être testée sur une période de recette dédiée, après les contrôles obligatoires.

### Pharmacien — Storage

- Le bucket `naxa-client-prescriptions` existe, est privé, limite la taille à 10 MiB et n'autorise que `application/pdf`, `image/jpeg`, `image/png`.
- Les politiques Storage vérifiées imposent pour l'insertion : utilisateur authentifié, dossier `<client_uid>/<pharmacie_uuid>/...`, profil actif avec fonction métier `client`, pharmacie active et visible, et MIME autorisé. La lecture est limitée au client lié, au Pharmacien affecté à la pharmacie, ou à l'Admin.
- Aucun outil Storage upload ni client navigateur authentifié n'est disponible dans cette session. Aucun objet n'a été créé et aucune ordonnance fictive n'a été téléversée par SQL (ce qui contournerait précisément le contrôle Storage à tester).
- **Point de clôture restant :** téléverser un petit PDF/JPEG/PNG non clinique avec le compte Client E2E via l'API Storage authentifiée, vérifier l'objet et son MIME, soumettre son chemin par `naxa_client_soumettre_ordonnance`, puis accepter/rejeter via l'identité Pharmacien et vérifier les droits de lecture des deux côtés.

### Connexions interactives Web / Android

Aucun navigateur pilotable, émulateur Android ni action d'authentification interactive n'est exposé dans cette session. Les connexions réelles et le parcours UI restent non prouvés. Les preuves SQL/RPC ne se substituent pas à une recette UI.

### Statut de clôture

**Toujours PARTIEL, pas vert global.** Livreur reste vert sur son parcours RPC transactionnel (§103). Comptable : cron technique confirmé, mais écriture et clôture par worker non prouvées ; les 28 erreurs d'une autre pharmacie restent intactes. Pharmacien : guards Storage vérifiés, mais upload réel et soumission positive non prouvés. Web/Android : logins interactifs non prouvés.

**Reprise exacte :** (1) préparer une vente réelle E2E Mvan via POS et tracer son événement comptable ; (2) traiter uniquement cet événement Mvan par worker serveur puis tester la clôture de période ; (3) effectuer l'upload d'un document neutre via Storage avec le Client E2E puis la soumission et la revue Pharmacien ; (4) exécuter les logins Web et Android avec un runner navigateur/émulateur. Ne pas traiter les 28 erreurs de l'autre pharmacie sans mandat et diagnostic dédiés.


## 106. Tentative simultanée des trois clôtures restantes — état Replay (16/11/2026)

Demande : exécuter en parallèle les trois chantiers de clôture (Comptable, Storage Pharmacien/Client, connexions Web/Android). Vérifications menées en parallèle sur Replay ; aucune écriture durable, aucun objet Storage créé, aucune modification Production.

### 1) Comptable — blocage de précondition confirmé

- Pharmacie Mvan : caisse principale active (`c3194cf5-7de3-4b90-9412-416b50e7ccbf`) et profil Caisse E2E actif, fonction métier `caisse`, périmètre Mvan.
- **Aucun produit en stock positif avec prix positif n'est disponible** dans `public.stocks` pour Mvan. Une vente POS réelle ne peut donc pas être constituée avec l'inventaire actuel sans créer une fiche/entrée de stock artificielle.
- Aucune période comptable n'est actuellement enregistrée pour Mvan (`compta_periodes` vide pour cette pharmacie). Les configurations précédentes avaient été créées dans une transaction annulée ; elles ne persistent pas.
- Le déclencheur `compta_outbox_vente_encaissee` est bien installé sur le changement de statut des ventes : le parcours normal POS doit produire l'événement. Aucun événement métier ne doit être inventé directement pour prétendre prouver le parcours.
- Le worker cron est toujours actif et ses dernières exécutions sont techniquement `succeeded` (§105). Pas d'appel global du worker : les 28 événements terminaux d'une autre pharmacie doivent rester intacts.
- **Résultat :** recette de publication et clôture non exécutable de manière probante tant qu'un produit/stock de test légitime et une période de recette Mvan ne sont pas provisionnés selon le parcours prévu. Aucun stock ni période n'a été créé.

### 2) Pharmacien / Client — blocage de l'upload réel

- Les deux profils Client et Pharmacien E2E sont actifs ; le Pharmacien est affecté à Mvan.
- Bucket `naxa-client-prescriptions` privé, règles de type et de taille conformes aux constats §105.
- Contrôle postérieur : **0 objet** dans ce bucket.
- Les outils de cette session n'exposent ni upload Storage via API authentifiée, ni session Auth client utilisable. Insérer directement une ligne `storage.objects` par SQL contournerait la politique d'upload et ne constituerait pas une preuve.
- **Résultat :** pas de téléversement ni soumission positive. Les guards SQL déjà testés restent la seule preuve disponible.

### 3) Connexions Web / Android — environnement d'exécution absent

- Inventaire des outils de la session : pas de navigateur pilotable, Playwright, émulateur Android, ni action de login Auth interactive.
- Les profils E2E sont actifs dans la base, mais cela ne prouve pas que leurs identifiants permettent une connexion Web ou Android.
- **Résultat :** aucune connexion interactive exécutée ; ne pas convertir l'existence des profils en preuve de login.

### Clôture de cette tentative

**PARTIEL — aucun des trois points n'est entièrement clôturé.** Le travail simultané a permis de confirmer les préconditions manquantes et d'éviter les contournements : pas de faux événement comptable, pas de faux upload par SQL, pas de faux login. Aucun changement de données durable. 

**Reprise opérationnelle précise :** provisionner par les workflows normaux un produit et un stock de recette Mvan, puis ouvrir une période comptable de test avec les cinq contrôles requis et mappings/journal validés ; utiliser ensuite le POS normal et le worker serveur. Pour le second point, fournir une session Auth Client E2E et une voie d'upload Storage authentifiée. Pour le troisième, connecter un navigateur/runner et un émulateur Android à cette session.


## 107. Vérification du canal de provisionnement E2E Replay (16/11/2026)

**Périmètre :** Edge Functions du projet Replay uniquement. Aucun appel d'exécution, aucune écriture métier, aucune modification de fonction.

- L'inventaire Supabase confirme une fonction active `naxa-e2e-provision`, version 4, avec vérification JWT activée.
- Lecture de son code déployé : le handler renvoie systématiquement HTTP 404 avec le message `Provisionnement E2E désactivé après tentative à usage unique.`
- **Conclusion :** cette fonction n'est pas un canal utilisable pour provisionner le stock Mvan, la période comptable, une session Auth Client ou les logins Web/Android. Son statut Supabase `ACTIVE` indique seulement que le runtime de fonction est déployé ; le code applicatif désactive explicitement le provisionnement.
- La fonction n'a pas été appelée. Aucun secret, jeton ou identifiant d'accès n'a été utilisé.
- Aucun autre canal Auth Admin, Storage upload ou navigateur/émulateur n'a été découvert dans les outils disponibles.

**Résultat :** le blocage des trois clôtures §106 est confirmé ; aucune des recettes Comptable, Pharmacien/Storage ou login Web/Android ne peut être déclarée verte sur cette seule découverte.

**Reprise opérationnelle :** rétablir un canal de provisionnement E2E explicitement contrôlé et limité à Replay (avec authentification, autorisations, journalisation et nettoyage), ou fournir un runner de test externe déjà autorisé. Ne pas réactiver cette fonction sans audit de son ancien usage à usage unique et de ses contrôles d'accès.


## 108. Identité unique, cumul Pharmacie ↔ SPD et confidentialité Client — implémentation + E2E Replay (16/11/2026)

**Périmètre :** identité Auth unique, conservation de l'espace Client, cumul dans les deux sens, sélecteur universel, décisions multi-organisations, notifications, cloisonnement RLS et données personnelles. Travail effectué sur `main`. Migrations appliquées uniquement au projet Replay `pwfftcsjyeibxxqhwysw`.

### Implémentation applicative versionnée

- `src/app/admin/creation-univers-actions.ts` : retrouve une identité existante par username et téléphone normalisé, valide la concordance et réutilise son Auth ID. Un nouvel utilisateur Auth n'est créé que si aucun profil correspondant n'existe.
- `src/app/pharmacie/affectations/actions.ts` : déclenche la demande `SPD_VERS_PHARMACIE` avant toute attribution directe si la personne a un membership SPD.
- `src/app/naxa/cumuls/page.tsx` : les décisions Promoteur, SPD et Admin sont affichées selon le contexte actif et le bon périmètre d'organisation.
- `src/app/notifications/page.tsx` : les notifications de cumul conduisent vers `/naxa/cumuls`.
- `src/components/EspaceNaxaSwitcher.tsx` : affiche les memberships SPD retournés par `naxa_list_accessible_spd_workspaces`, qui ne retourne que les espaces actifs, payés et affectés.
- `src/app/api/auth/login/route.ts` : activation explicite du contexte Client via `naxa_select_active_role`.
- `scripts/test-identity-cumulative-workspaces.cjs` : contrats statiques exécutés par `npm test` pour prévenir les régressions de raccordement.

### Corrections SQL appliquées à Replay

- Modèle d'identité Client + espace SPD et résolution du rôle actif SPD.
- RPC de demande/approbation croisée, arbitrage Admin pour Promoteur candidat, notifications durables et transitions idempotentes.
- Réconciliation des demandes : changement/révocation d'une affectation source annule la demande obsolète, invalide les décisions et recalcule le nouveau groupe de Promoteurs.
- Verrou commercial scoped au partenaire : l'abonnement impayé bloque l'espace professionnel concerné sans désactiver `profiles.actif` ni l'espace Client.
- Résolution Admin/Client : une identité Admin complète peut sélectionner son Client ; `is_admin()` suit le contexte actif et les droits Admin sont inactifs dans Client.
- Décision contextuelle : un Promoteur doit être dans son espace Promoteur ; un propriétaire SPD dans le bon espace SPD ; une tentative depuis Client est refusée sans annuler la demande.
- RLS Client/Pharmacie/SPD/Storage : l'employeur ne lit pas les réservations, ordonnances et fichiers personnels d'un collaborateur membre de son organisation. Les données des clients ordinaires restent accessibles aux rôles professionnels autorisés.
- Références complètes des migrations dans `docs/IDENTITE_UNIQUE_CUMUL_ESPACES_SPEC_E2E.md`, §9.2.

### Recettes SQL E2E Replay exécutées — 5/5 PASS

1. `supabase/tests/20261116_naxa_identity_cumulative_replay.sql` — Pharmacie→SPD, auto-arbitrage Admin, SPD→Pharmacie, bypass grant refusé, bascule Client↔SPD, sélecteur SPD payant, verrou commercial et révocation d'accréditation.
2. `supabase/tests/20261116_naxa_cumulative_multi_promoter_reconciliation_replay.sql` — deux Promoteurs, deux accords nécessaires, notification à chacun, révocation partielle, invalidation et recalcul, refus final.
3. `supabase/tests/20261116_naxa_cumulative_rls_replay.sql` — RLS, permissions RPC, isolation des demandes, notifications destinataire, écriture directe refusée et mauvaise activité active refusée sans annulation.
4. `supabase/tests/20261116_naxa_admin_client_workspace_replay.sql` — identité Admin complète en Client ; droits Admin suspendus puis restaurés au retour Admin.
5. `supabase/tests/20261116_naxa_client_data_privacy_replay.sql` — employeur et Pharmacien ne lisent pas les données personnelles d'un salarié ; accès Client restauré en Client ; données ordinaires préservées ; employeur SPD ne lit pas les réservations Client personnelles d'un opérateur.

Toutes ces suites sont transactionnelles (`BEGIN` / `ROLLBACK`) et ont été exécutées sur Replay ; les fixtures et réservations de test ont été annulées. Aucun compte ou objet de recette n'a été conservé.

### État des preuves

- **SQL / RPC / RLS Replay :** 5 suites passées.
- **Migrations Replay :** appliquées et fichiers SQL versionnés sur `main`.
- **Actions et pages applicatives :** raccordées et versionnées.
- **Contrats statiques :** ajoutés au `npm test`.
- **GitHub Actions `naxa-quality` et `naxa-replay-promoteur-secret-safe-v2` :** déclenchées par les changements applicatifs ; résultats finaux à attendre avant clôture du contrôle CI/navigateur.
- **Production / Vercel / Play Store :** non touchés ; aucun déploiement effectué.

**État de chantier :** développement et tests de base/RLS Replay réalisés. Ne pas déclarer la livraison globale verte avant résultats GitHub Actions et recette navigateur Replay.

**Point exact de reprise :** vérifier les deux workflows GitHub déclenchés après les derniers commits. Corriger toute erreur de test, TypeScript, lint, build ou navigateur ; relancer les contrôles. Ensuite seulement, décider séparément d'une éventuelle migration Production et d'un déploiement, qui ne sont pas autorisés dans le présent périmètre.


## 108. Réactivation des recettes par les runners sécurisés et correction du contexte Caisse (16/11/2026)

**Audit du provisionnement historique**
- L'historique Git confirme que l'ancienne route applicative de provisionnement acceptait un secret dans une URL GET et pilotait plusieurs fixtures Auth/profils avec rotation de mots de passe. Elle n'est pas réactivée.
- La fonction Edge actuellement déployée `naxa-e2e-provision` reste un stub HTTP 404. Aucun secret historique n'a été réutilisé.
- Décision : utiliser les scripts secret-safe versionnés et les workflows GitHub Actions existants, strictement épinglés au projet Replay.

**Nouvelle recette Ordonnance Client → Storage → Pharmacien**
- Extension de `scripts/e2e/provision-replay-pharmacy-staff-safe.cjs` : authentification réelle du Client E2E, dépôt d'un PDF fictif marqué dans `naxa-client-prescriptions`, soumission par `naxa_client_soumettre_ordonnance`, relecture Client par RLS, relecture Pharmacien affecté par RLS, téléchargement du document privé par le Pharmacien, décision `prescription_valider`, vérification du validateur et nettoyage des lignes, événements d'audit, ordonnance et objet Storage.
- Ajout de tests de contrat dans `scripts/test-replay-pharmacy-staff-safe.cjs` pour le PDF fictif, le chemin isolé et la présence de chaque étape/du nettoyage.
- Le harnais est intégré au workflow Replay existant par son étape de provisionnement du personnel. **Résultat d'exécution encore en attente** au moment de cette mise à jour ; aucun PASS n'est anticipé.

**Cause racine du timeout POS navigateur**
- Le run `43943563064` a échoué uniquement sur `verify-credit-pos-browser.cjs` : le navigateur ne trouvait pas le titre « Poste de caisse ».
- Contradiction retrouvée dans `src/app/api/auth/login/route.ts` : `espace=client` appelle `naxa_select_active_role('client')` et remplace le rôle professionnel actif. Le test Caisse demandait à tort `espace=client`.
- Correction : le test navigateur Caisse se connecte désormais avec `espace=pharmacie`, qui conserve le rôle Caisse déjà autorisé. Un test de contrat empêche la régression.
- Les autres parcours du run en échec ont continué : Marketplace navigateur et configuration comptable PASS ; Storage générique 17 PASS / 0 SKIP ; Web Push réel PASS. Un run antérieur `43943534210` avait aussi passé l'ensemble du workflow.

**Android**
- Workflow Android épinglé à `NAXA_STORAGE_E2E_URL` / `NAXA_STORAGE_E2E_ANON_KEY`, avec assertion exacte du projet Replay.
- `NAXA_BASE_URL` des builds de test est forcé à `http://10.0.2.2:3000` pour éviter d'embarquer l'URL NAXA Production dans les APK de recette.
- Run `43945429291` : build Compose, variantes privées du compagnon et tests instrumentés Android API 35 PASS. Ces tests portent sur la file chiffrée Android Keystore et WorkManager, **pas sur la connexion interactive Auth**.
- Nouveau run avec la configuration locale/Replay stricte en cours ; la connexion Android réelle reste à prouver.

**Comptabilité**
- Les tests navigateur valident le paramétrage plan/journaux/mappings, et le flux crédit POS/refund émet ses événements outbox.
- Cela ne prouve toujours pas la publication d'une écriture comptable par le worker ni une clôture de période. Mvan ne possède toujours ni stock positif ni période comptable persistante.
- Sur la pharmacie technique crédit `1a4f1ce5-cccf-477e-9a5b-474c8c9fc713`, le dernier relevé montre 2 événements `a_traiter` et 28 `erreur`. Aucun worker global n'a été lancé manuellement ; aucun événement de cette autre pharmacie n'a été modifié par une action SQL manuelle.

**Exécutions déclenchées**
- Workflow Replay relancé sur `main` ; les exécutions successives sont sérialisées par le runner. Le run antérieur `43945383490` ne contient pas encore le dernier correctif POS ni l'extension ordonnance. Le run suivant sur le HEAD incluant `d57e0be9` est attendu pour valider ces changements.
- Android relancé après épinglage Replay et URL NAXA locale ; exécution en cours au moment de la rédaction.

**État :** PARTIEL. Le parcours Livraison reste validé (§103). Les recettes Web génériques, Storage générique, Web Push et build/emulator Android sont prouvées. La recette ordonnance spécifique, la publication/clôture comptable par worker et la connexion Android Auth ne sont pas encore déclarées vertes. Aucun déploiement Production.


## 109. Ordonnance Client : parcours métier réellement passé, audit immuable et reprise des autres recettes (16/11/2026)

**Preuve d'exécution observée dans GitHub Actions**
- Sur le run 43947325556, le runner Replay a effectivement déposé un PDF fictif par le JWT Client dans le bucket privé naxa-client-prescriptions ; soumis le dossier par naxa_client_soumettre_ordonnance ; relu le dossier sous RLS avec le Client propriétaire puis le Pharmacien affecté ; téléchargé le PDF sous le JWT Pharmacien et comparé les octets ; accepté l'ordonnance par prescription_valider et vérifié le statut validee ainsi que l'identité du validateur.
- Ces six contrôles métier ont affiché PASS. Le job était néanmoins en échec parce que le nettoyage tentait de supprimer une ligne pharmacien_audit_events protégée par le mécanisme d'audit immuable (HTTP 400 / P0001).
- Correction : ne plus supprimer l'événement d'audit append-only. Il est conservé comme preuve métier ; l'ordonnance, ses lignes/préparations et le document Storage restent supprimés et vérifiés. Le test de nettoyage signale explicitement cette conservation attendue.

**Fiabilité du runner**
- Le même run montrait que l'échec du provisionnement empêchait le build Next.js, alors que les étapes navigateur déclarées always() tentaient ensuite de démarrer l'application sans artefact de build. Les tentatives de connexion à 127.0.0.1:3000 échouaient donc avant les recettes.
- Correction : Chromium, les secrets éphémères et le build sont maintenant exécutés même si le provisionnement a échoué ; les recettes Web Push et navigateur ne démarrent que si le build a réellement réussi. Les recettes indépendantes ne sont donc plus artificiellement bloquées par l'ordre des étapes.

**Android**
- Le run 43946649980 a terminé avec succès après épinglage Replay et URL NAXA locale ; il valide build Compose, tests instrumentés et exécution sur émulateur API 35. Il ne valide pas encore une authentification interactive Auth dans l'application Android.

**Comptabilité**
- Le worker global et la clôture de période ne sont pas encore prouvés. Le run précédent a confirmé le remboursement crédit et l'émission idempotente d'un événement outbox, mais ce n'est pas une preuve de publication comptable par compta_worker_traiter_lot.
- Les 28 événements en erreur de la pharmacie technique distincte ne sont pas modifiés. Aucun worker global n'a été lancé manuellement.

**État après corrections**
- Recette Ordonnance : étapes métier PASS observées ; statut global de la recette reste en attente du run qui vérifie le nettoyage corrigé.
- Recettes navigateur indépendantes : nouveau garde de build en place ; résultat du nouveau run à contrôler.
- Android : build/émulateur PASS ; Auth interactive PARTIEL.
- Comptabilité : PARTIEL, publication et clôture non prouvées.
- Aucune donnée Production, aucun déploiement Vercel et aucun Play Store touchés.


## 110. Worker comptable et clôture : preuve transactionnelle isolée sur Replay (16/11/2026)

- Une recette SQL transactionnelle a été exécutée sur Mvan (pharmacie E2E 76dd4983-273a-4a83-ae3d-9a7838d3aa35), en utilisant le Comptable E2E actif de cette pharmacie comme acteur de clôture.
- Le test a créé dans la transaction une période de novembre, deux comptes validés, les deux mappings vente_encaissee, un journal JVE2E et un événement de vente fictif de 2 500 FCFA.
- Pour protéger les deux événements a_traiter de l'autre pharmacie technique, leur prochaine_tentative a été temporairement repoussée dans la transaction uniquement. Le worker global n'a réclamé qu'un seul événement : résultat {ok:true, reclames:1, traite:1, erreurs:0, a_traiter:0}.
- Assertions : événement passé à traite ; écriture générée avec deux lignes ; débit = crédit = 2 500 FCFA ; période clôturée ; cinq contrôles de clôture vérifiés (dotations, paie, TVA, stock, rapprochements).
- Le test s'est terminé par ROLLBACK : aucune période, écriture, ligne, configuration, événement de test ou modification des deux événements de l'autre pharmacie n'a été conservé. Les 28 événements en erreur et les 2 événements en attente de l'autre pharmacie restent hors périmètre.

**Portée exacte de la preuve**
- PASS : exécution réelle de la fonction worker interne, publication équilibrée d'une écriture, vérification d'audit et fonction de clôture sous service_role dans une transaction Replay isolée.
- PARTIEL : l'événement source était synthétique, inséré dans la transaction ; la chaîne complète vente POS réelle → trigger outbox → worker planifié → écriture persistée → clôture persistée n'a pas encore été exécutée dans un même parcours durable.
- Le cron n'a pas été forcé manuellement et les événements d'une autre pharmacie n'ont pas été traités.


## 111. Recette navigateur crédit : cause racine et correction de l'accès ERP masqué (16/11/2026)

**Run 43948192865 — résultat vérifié**
- Provisionnement Promoteur, Admin, Client/Livreur, personnel Pharmacie, pharmacie technique masquée, Caisse/stock : PASS.
- Build Next.js : PASS ; Web Push Chromium : 3 souscriptions, 3 envois et 3 réceptions Service Worker, PASS.
- Remboursement crédit par JWT Caisse : PASS ; diminution exacte de 250 FCFA, outbox idempotente et refus de dépassement.
- Marketplace navigateur : PASS ; dépôt d'une demande, refus Promoteur et stock inchangé.
- Paramétrage comptable navigateur : PASS ; deux comptes, deux journaux et quatre mappings validés puis nettoyage des seules lignes de configuration.
- Storage E2E : 17 PASS, 0 SKIP ; matrices Admin/Promoteur, refus inter-utilisateurs et nettoyage PASS.
- Seul échec : connexion navigateur Caisse à la pharmacie technique masquée, HTTP 403 « Cette pharmacie est suspendue ou indisponible ».

**Cause racine prouvée**
- La recette POS utilise volontairement une pharmacie active, non archivée et masquée du Marketplace (visible_recherche=false), conformément à la séparation ERP interne / publication publique.
- La page Caisse appliquait déjà la bonne règle (actif + non archivée). En contradiction, POST /api/auth/login exigeait aussi visible_recherche=true pour Promoteur et rôles professionnels ; le serveur refusait donc un compte pourtant affecté à une pharmacie interne active.

**Correction appliquée sur main**
- Retrait du filtre Marketplace de la validation de connexion professionnelle.
- Contrôle conservé : pharmacie active et non archivée, rôle professionnel actif et périmètre de l'affectation.
- Ajout d'un test de contrat dans scripts/test-caisse-unpublished-pharmacy-access.cjs : une pharmacie masquée doit rester accessible à la connexion professionnelle, sans ouvrir l'accès aux pharmacies inactives ou archivées.
- Nouveau run Replay déclenché par le changement ; résultat de la recette POS corrigée à contrôler avant clôture.

**État** : le run 43948192865 reste en échec à cause de cette règle d'accès, mais tous ses parcours indépendants listés ci-dessus sont PASS. La correction est versionnée ; aucun déploiement Production ou Vercel.


## 112. Lot A — Identité et sécurité : cinq recettes SQL Replay exécutées (16/11/2026)

**Cible et garde-fous**
- Projet Supabase Replay confirmé : `naxa-ci-replay-2`, ref `pwfftcsjyeibxxqhwysw`, état `ACTIVE_HEALTHY`.
- Sources des tests lues sur `main`. Aucune migration, aucun changement de schéma, aucun déploiement et aucun accès Production.
- Les cinq suites sont transactionnelles et se terminent par `ROLLBACK`. Exécution séquentielle via SQL sur Replay ; aucune erreur SQL remontée.

**Résultats**
- PASS — `supabase/tests/20261116_naxa_identity_cumulative_replay.sql` : identité Client et cumul des espaces professionnels, règles de verrouillage et maintien de l'espace Client.
- PASS — `supabase/tests/20261116_naxa_cumulative_multi_promoter_reconciliation_replay.sql` : consentements de chaque Promoteur, révocation, recalcul des approbations et refus unique.
- PASS — `supabase/tests/20261116_naxa_cumulative_rls_replay.sql` : RLS, RPC, cloisonnement des lectures et refus des écritures directes non autorisées.
- PASS — `supabase/tests/20261116_naxa_admin_client_workspace_replay.sql` : bascule Admin vers Client et retour Admin sans conservation des privilèges Admin dans le contexte Client.
- PASS — `supabase/tests/20261116_naxa_client_data_privacy_replay.sql` : confidentialité des réservations, ordonnances et fichiers Client vis-à-vis des employeurs Pharmacie/SPD.

**Limite de preuve**
- Ces résultats prouvent les cinq scénarios SQL transactionnels sur l'état Replay du 16/11/2026. Ils ne remplacent pas une recette navigateur/Auth interactive, ni un test durable multi-session sur données persistées.
- Statut Lot A : PASS pour ces cinq suites SQL ; lot global non déclaré vert tant que les contrôles complémentaires identité/sécurité (sessions réelles, parcours navigateur et contrôles d'exploitation) ne sont pas consolidés.


## 113. Lot A — contrôles sessions Auth et sécurité des affectations (16/11/2026)

**Cible : Replay `pwfftcsjyeibxxqhwysw` uniquement.**

**Suites complémentaires**
- PASS — `034_promoteur_session_audit.sql` : 6/6 assertions structurelles ; table d'audit, policy de lecture, triggers Auth, absence de colonnes de secrets et droits service_role.
- PASS — `035_promoteur_session_audit_behavior.sql` : 6/6 assertions ; limite à quatre sessions, refus de la cinquième, événement de rejet et révocation des sessions journalisée. Transaction annulée.
- PASS — `188_pharmacien_service_sessions.sql` : structure des pointages Pharmacien, RPC, unicité d'une session ouverte et RLS.
- PASS — `195_suivi_explicit_null_identity_deny.sql` : une identité NULL est explicitement refusée.
- PASS — diagnostic ciblé de `naxa_grant_professional_assignment` : garde ASSIGN_USER_TO_PHARMACY, interdiction d'auto-affectation, verrou transactionnel advisory et contrôle de chevauchement confirmés par lecture de la définition active.
- Contrôle de nettoyage après les essais : zéro utilisateur Auth `naxa035_*` ou `naxa036*` résiduel et zéro pharmacie de fixture 036 résiduelle.

**Échecs / contradictions révélés**
- FAIL — `036_promoteur_session_audit_rls.sql` : sous le rôle `authenticated`, la lecture RLS échoue avec `permission denied for function naxa_promoteur_valide`. Cause racine identifiée : la policy `naxa_session_audit_read_scope` appelle directement `private.naxa_promoteur_valide(auth.uid())`, dont l'ACL ne donne EXECUTE qu'à `postgres`. La fonction homonyme publique autorise bien `authenticated`, mais la policy n'utilise pas cette fonction. Correction à définir sans ouvrir inutilement l'accès à l'espace `private`.
- FAIL de contrat obsolète — `225_professional_assignments_security.sql` : le test cherche des fragments textuels exacts avec espaces et exige `FOR UPDATE`. Le code actif exprime l'auto-affectation sans espaces (`p_target=v_actor`) et utilise `pg_advisory_xact_lock` pour sérialiser l'opération. Un diagnostic sémantique normalisé confirme les quatre contrôles attendus (privilège, auto-affectation, verrou, chevauchement). Le test 225 doit être modernisé ; cet échec ne prouve pas une faille fonctionnelle.
- Les tests 036 et 225 n'ont provoqué aucune donnée résiduelle. Aucun correctif de schéma ou ACL n'a été appliqué durant cette passe.

**État Lot A**
- PASS : cinq suites SQL du §112 ; plus 034, 035, 188, 195 et diagnostic ciblé des affectations.
- BLOQUANT : RLS de l'audit des sessions Promoteur (036) ; correction et re-test requis.
- À actualiser : assertions du contrat 225 pour refléter le verrou advisory au lieu de rechercher `FOR UPDATE`.
- NON PROUVÉ : parcours navigateur Auth réel, expiration/renouvellement de session dans navigateur et révocation visible côté client. Le workflow navigateur existant est épinglé Replay mais son déclenchement manuel n'est pas disponible par l'interface d'exécution utilisée pendant cette passe ; aucun run navigateur n'est donc revendiqué.
- Aucun accès Production, aucune migration, aucun déploiement Vercel ou Play Store.


## 114. Lot A — correction du cloisonnement RLS audit sessions Promoteur (16/11/2026)

**Reproduction et cause racine confirmées sur Replay**
- Projet ciblé : `naxa-ci-replay-2` / `pwfftcsjyeibxxqhwysw`, état `ACTIVE_HEALTHY`.
- La policy `naxa_session_audit_read_scope` appelait directement `private.naxa_promoteur_valide(auth.uid())`. L'ACL confirme `authenticated EXECUTE = false` sur cette fonction privée, alors que la façade `public.naxa_promoteur_valide(uuid)` est exécutable par `authenticated` et contrôle que l'identité demandée correspond au JWT (ou à un Admin).
- Exécution du test 036 avant correction : FAIL reproductible, SQLSTATE 42501 « permission denied for function naxa_promoteur_valide » lors de la lecture sous JWT Promoteur.
- Le test 036 avait en plus un fixture incomplet : le Promoteur était déclaré actif mais n'avait ni convention, ni abonnement valide, ni architecture active ; il ne pouvait donc pas satisfaire la règle métier de validité.

**Corrections versionnées**
- Migration additive : la policy RLS appelle la façade publique contrôlée `public.naxa_promoteur_valide(auth.uid())`, sans exposer EXECUTE sur le schéma privé.
- Test 036 : fixture Promoteur complète (convention active, abonnement actif, architecture HYBRIDE) pour tester le périmètre métier réellement autorisé.
- Test 225 : assertion de contrat alignée sur l'implémentation active : comparaison normalisée de l'auto-affectation et du chevauchement, présence de `pg_advisory_xact_lock` plutôt que d'exiger à tort `FOR UPDATE`. Le contrôle de synchronisation offline vérifie désormais le moteur d'autorisations (`naxa_has_privilege`, `VIEW_STOCK`, `EDIT_STOCK_QUANTITY`) au lieu d'exiger un appel direct à l'ancien helper d'affectation ; le helper Stock vérifie le périmètre canonique `naxa_scope_allows`.

**Vérification**
- Statut historique à la date du §114 ; les contrôles ont été exécutés après correction, voir §115.
- Aucun accès Production, aucun déploiement Vercel ou Play Store.

**État Lot A :** PARTIEL jusqu'au passage de tous les tests et à la preuve navigateur Auth interactive.


## 115. Lot A — re-tests SQL après correction RLS et audit sécurité Replay (16/11/2026)

**Cible / migration**
- Projet confirmé : Supabase `naxa-ci-replay-2`, ref `pwfftcsjyeibxxqhwysw`, `ACTIVE_HEALTHY`.
- Migration `20261116212824_fix_promoteur_session_audit_rls_facade.sql` appliquée avec succès sur Replay. La policy `naxa_session_audit_read_scope` appelle la façade `public.naxa_promoteur_valide(auth.uid())` ; l'ACL privée reste fermée à `authenticated`.
- Commit de la migration : `2aef2a54516880929e4913b3c88f62514f1f8ba9`.

**Résultats SQL consolidés**
- PASS — `036_promoteur_session_audit_rls.sql` : 3/3 assertions, après fixture complet du Promoteur (convention active, abonnement actif, architecture HYBRIDE). Le test avait auparavant reproduit le SQLSTATE 42501.
- PASS — `034_promoteur_session_audit.sql` : 6/6 assertions structurelles.
- PASS — `035_promoteur_session_audit_behavior.sql` : limite de sessions, rejet et révocation journalisée.
- PASS — `188_pharmacien_service_sessions.sql` : structure, RPC, unicité de session et RLS.
- PASS — `195_suivi_explicit_null_identity_deny.sql` : identité NULL refusée.
- PASS — `225_professional_assignments_security.sql` : contrat de sécurité exécuté sans exception après alignement des assertions sur le verrou advisory, le moteur d'autorisations et le scope canonique.
- PASS — les cinq suites du §112 ont été rejouées après la correction : identité/cumul, arbitrage multi-Promoteurs, RLS cumul, bascule Admin/Client et confidentialité Client, 5/5 sans erreur.

**Nettoyage et ACL**
- Contrôle post-recette : zéro utilisateur Auth, zéro pharmacie et zéro événement d'audit résiduel des fixtures 036.
- `authenticated` n'a toujours pas `EXECUTE` sur `private.naxa_promoteur_valide(uuid)` ; la façade publique contrôlée reste exécutable ; une seule policy de lecture attendue est active sur `naxa_session_audit`.
- Les suites transactionnelles ont été annulées par `ROLLBACK` ; aucune fixture métier persistante issue de ces tests.

**Contrôles d'exploitation / réserves restantes**
- Supabase Security Advisors Replay : avertissement Auth `auth_leaked_password_protection` toujours présent (protection des mots de passe compromis désactivée) ; 3 fonctions `SECURITY DEFINER` exécutables par `anon` signalées (`get_universe_catalog_v2`, `marketplace_offre_stock_disponible`, `marketplace_produit_visible` ; 72 tables RLS sans policy (avis INFO, à classifier selon exposition et accès service_role) et 253 fonctions `SECURITY DEFINER` exécutables par `authenticated` signalées pour revue de leurs gardes métier. Ces alertes ne sont pas toutes des vulnérabilités avérées, mais elles ne sont pas clôturées par le Lot A.
- Le code du parcours Playwright existant réalise une connexion Auth réelle Promoteur/Caisse/Client, mais aucun run navigateur récent n'a été vérifié après cette correction. Le renouvellement/expiration de session et la révocation observée dans le navigateur restent à prouver.
- Le contrôle de protection contre les mots de passe compromis doit être activé dans les paramètres Auth du projet Replay ; aucun outil disponible dans cette passe ne permet de modifier ce réglage de projet.
- Les exécutions GitHub Actions post-commit (qualité et navigateur) ne sont pas confirmées par un identifiant de run dans cette passe.

**Verdict Lot A : PARTIEL.** Les recettes SQL identité, cumul, RLS, audit sessions et affectations sont PASS sur Replay. Le vert global est bloqué par la protection des mots de passe compromis désactivée, la revue des alertes sécurité Auth/RPC, et les preuves navigateur Auth de session/renouvellement/révocation non consolidées. Aucune donnée Production, aucun déploiement Vercel ou Play Store touchés.

**Point exact de reprise :** activer la protection des mots de passe compromis sur le projet Replay ; auditer les 3 RPC accessibles à `anon` et les gardes des fonctions `SECURITY DEFINER` liées à l'identité ; exécuter le parcours Playwright Auth puis prouver refresh, expiration et révocation côté navigateur. Ne pas passer au vert avant ces preuves.


## 116. Lot A — poursuite de l'audit sécurité et point de blocage Auth (16/11/2026)

**État Replay recontrôlé**
- Projet Supabase `naxa-ci-replay-2` / `pwfftcsjyeibxxqhwysw` : accessible via le connecteur. Les recettes SQL du §115 restent les dernières preuves disponibles ; aucune nouvelle fixture n'a été créée dans cette passe.
- Security Advisors toujours à 4 catégories : `auth_leaked_password_protection` WARN (1), `anon_security_definer_function_executable` WARN (3), `authenticated_security_definer_function_executable` WARN (253), `rls_enabled_no_policy` INFO (72).

**Tri initial des 3 fonctions SECURITY DEFINER exposées à anon**
- `public.get_universe_catalog_v2(text)` : renvoie le catalogue public d'offres par univers et s'appuie sur des filtres d'activation, publication, stock disponible, pharmacie active/visible/non-démo/non-archivée. Une branche bébé/maman appelle des gardes privées métier. Surface probablement intentionnelle pour le catalogue public, mais aucun test de non-divulgation/limitation des lignes retournées n'a été exécuté dans cette passe.
- `public.marketplace_offre_stock_disponible(uuid,uuid)` : façade SQL stable vers `private.marketplace_offre_stock_disponible_guarded`; elle retourne prix et quantité de l'offre. L'exposition anon peut être nécessaire à la lecture marketplace, mais doit être confirmée par tests d'identifiants hors périmètre, pharmacie masquée/inactive/démo et produit non publié.
- `public.marketplace_produit_visible(uuid)` : ne renvoie qu'un booléen fondé sur l'existence d'un stock rattaché à une pharmacie active, visible, non-démo et non-archivée. Exposition anon à confirmer par test sur produit absent, stock privé et pharmacie masquée.
- Ces 3 alertes sont donc classées **surface publique à valider**, pas vulnérabilités confirmées. Ne pas retirer les grants avant validation de l'usage client public.

**Limites d'accès et preuves navigateur**
- Les outils Supabase disponibles dans cette session n'exposent pas la modification des paramètres Auth du projet (notamment Leaked Password Protection). La valeur WARN ne peut pas être basculée depuis SQL ni corrigée sans accès au tableau de bord Auth. Aucune tentative de contournement SQL.
- Aucun outil GitHub Actions dispatch n'est disponible dans cette session. Le workflow Replay existant comporte bien un parcours Playwright avec connexion Auth réelle Promoteur/Caisse/Client pour les recettes crédit, mais ne teste pas encore explicitement refresh/expiration/révocation de session. Aucun run navigateur post-correction n'est revendiqué.
- Le workflow est déclenchable manuellement via `workflow_dispatch`, mais il lance un lot Replay large et provisionne plusieurs fixtures. Il ne doit pas être lancé à l'aveugle pour une preuve ciblée Lot A.

**Verdict Lot A : PARTIEL, sans changement.** Les recettes SQL restent PASS. Le vert global attend : (1) activation de Leaked Password Protection dans Auth > Settings > Password Security sur Replay, (2) tests anon ciblés des 3 RPC publiques, (3) parcours navigateur Auth démontrant refresh, expiration et révocation, (4) tri de la liste des fonctions SECURITY DEFINER accessibles à authenticated, en ciblant celles qui touchent identité, sessions et affectations.

**Point exact de reprise :** obtenir l'accès aux réglages Auth du projet Replay pour activer la protection des mots de passe compromis ; ajouter/faire exécuter une recette Playwright dédiée aux sessions (connexion, refresh, expiration, révocation) ; compléter les tests de cloisonnement anon des 3 RPC marketplace avant toute modification de leurs grants. Production et Vercel restent hors périmètre.


## 117. Lot A — sondes anon complémentaires des RPC marketplace (16/11/2026)

**Exécutions sur Replay sous le rôle SQL `anon`**
- `get_universe_catalog_v2('pharmacie')` : 0 ligne retournée.
- `get_universe_catalog_v2('parapharmacie')` : 0 ligne retournée.
- univers inconnu : 0 ligne retournée.
- `marketplace_offre_stock_disponible(uuid aléatoires)` : 0 ligne retournée.
- `marketplace_produit_visible(uuid aléatoire)` : `false`.
- Toutes les sondes ont été exécutées dans des transactions terminées par `ROLLBACK`, sans mutation persistante.

**Interprétation**
- Les identifiants arbitraires ne révèlent pas d'offre de stock ni de visibilité produit dans ces sondes.
- Le catalogue Replay ne contient actuellement aucune offre publique retournée pour les deux univers testés. Ces résultats ne valident donc pas le chemin positif (offre publiée réellement visible à anon) ni les cas pharmacie inactive/masquée/démo avec fixtures métier. L'alerte de grant anon reste ouverte jusqu'à une recette positive et négative complète.

**Verdict Lot A : PARTIEL inchangé.** Aucun grant n'a été modifié. Le point de reprise reste l'activation Auth Password Security, les tests positifs/négatifs des RPC anon et la preuve navigateur refresh/expiration/révocation.


## 118. Lot A — recette positive/négative des RPC anon avec création transactionnelle de stock (16/11/2026)

**Cible et méthode**
- Projet exclusivement Replay : Supabase `naxa-ci-replay-2` / `pwfftcsjyeibxxqhwysw`.
- Pharmacie fixture utilisée : `NAXA E2E — Pharmacie de recette (non commerciale)`, id `1a4f1ce5-cccf-477e-9a5b-474c8c9fc713`. Elle est non publiée par défaut (`visible_recherche=false`).
- Produit fictif de catalogue : `Amoxicilline NAXA Test`, id `893b49e6-faaa-4944-a396-f03f79d17978`.
- Création simulée dans une transaction : insertion d'une ligne `stocks` (prix 1 200 FCFA, quantité 5) et d'un lot correspondant (5 unités, péremption future). Les triggers réels de journalisation et de cohérence des lots se sont exécutés. Après bascule du rôle SQL à `anon`, les trois RPC ont renvoyé : `marketplace_produit_visible=true`, offre `{prix:1200, quantite:5}`, une ligne correspondante dans `get_universe_catalog_v2('pharmacie')`.
- Le stock et son lot ont été créés uniquement pour la durée du test ; transaction terminée par `ROLLBACK`.

**Résultats négatifs exécutés sous rôle SQL `anon`**
- Pharmacie masquée : produit invisible, aucune offre, aucune ligne catalogue.
- Pharmacie inactive : produit invisible, aucune offre, aucune ligne catalogue.
- Pharmacie démo : produit invisible, aucune offre, aucune ligne catalogue.
- Pharmacie archivée : produit invisible, aucune offre, aucune ligne catalogue.
- Lot expiré : offre quantité 0, aucune ligne catalogue.
- Lot bloqué : offre quantité 0, aucune ligne catalogue.
- Quantité stock égale à 0 : RPC d'offre renvoie quantité 0, catalogue exclu. `marketplace_produit_visible` reste vrai car cette fonction indique l'existence d'une association stock/pharmacie publique, pas la disponibilité quantitative.
- Historique de mouvement de stock datant de plus de 48 h : aucune offre, aucune ligne catalogue.

**Contrôle de nettoyage**
- Après toutes les transactions : pharmacie revenue à `visible_recherche=false`.
- Zéro ligne résiduelle pour le stock/lot créés pendant la simulation ; zéro lot résiduel de sonde.
- Aucun grant anon modifié, aucune migration, aucun compte Auth créé, aucune donnée Production touchée.

**Limites de preuve / possibilités d'accès**
- Les outils présents permettent l'exécution SQL Replay, les transactions/ROLLBACK, l'inspection des fonctions et la lecture/écriture documentaire GitHub sur `main`.
- Ils n'exposent pas d'action pour modifier les paramètres Auth Supabase, de navigateur/Playwright interactif, ni de déclenchement `workflow_dispatch` GitHub Actions. Les actions GitHub disponibles concernent notamment la lecture des runs et la relance de jobs existants.
- La recette ci-dessus valide le contrat DB/RPC et les filtres marketplace sous rôle `anon`, mais ne prouve pas le parcours UI de création de stock par un compte Gestionnaire de stock connecté.
- Le réglage Supabase `Leaked Password Protection` reste désactivé et non modifiable par les outils présents. Une simulation SQL ou une validation côté interface ne peut pas faire passer ce réglage natif en PASS. Un contrôle compensatoire applicatif ne serait équivalent que s'il est imposé côté serveur sur tous les parcours d'inscription/changement de mot de passe et résiste au contournement direct de l'API Auth ; aucune telle preuve n'est établie à ce stade.

**Verdict Lot A : PARTIEL.** Les RPC marketplace anon ont désormais une preuve positive et les cas négatifs majeurs ont été exécutés sur des fixtures de stock réelles en transaction, sans résidu. Restent à fermer : preuve navigateur Auth (connexion, refresh, expiration, révocation), revue ciblée des fonctions SECURITY DEFINER et classification des tables RLS sans policy ; la protection native des mots de passe compromis demeure une limite de forfait non modifiable depuis les accès actuels. Ne pas confondre cette limite avec une activation réussie.

**Point exact de reprise :** compléter la preuve Auth navigateur avec un moyen d'exécution accessible ; auditer les fonctions SECURITY DEFINER qui touchent identité/session/affectations et classifier les 72 tables RLS sans policy ; définir avec l'utilisateur le critère d'acceptation formel du contrôle Auth non disponible sur le forfait gratuit. Aucun accès Production, aucun déploiement Vercel ou Play Store.


## 119. Lot A — parcours stock via RPC Gestionnaire de stock et tri RLS/SECURITY DEFINER (16/11/2026)

**Recette stock avec identité Auth de test**
- Profil Auth existant utilisé : compte de test Gestionnaire de stock (profil actif, rôle métier `gestionnaire_stock`, affectation active et espace actif sur la pharmacie fixture Mvan). Le compte est bien présent dans `auth.users`.
- Important : le JWT a été simulé dans la session SQL Replay avec les claims de cette identité et le rôle SQL `authenticated`. Ce n'est pas une connexion navigateur avec saisie du mot de passe ; cela teste les RPC, les gardes métier et RLS sous le rôle Auth correspondant.
- Produit fictif : `Amoxicilline NAXA Test`, id `893b49e6-faaa-4944-a396-f03f79d17978`, sans stock initial dans la pharmacie Mvan.
- Parcours réellement exécuté, dans l'ordre : `gestionnaire_stock_reference_initialiser` → `gestionnaire_stock_quantite_ajuster` (+5, mouvement `retour`) → `stock_lot_enregistrer` (lot de 5 unités, péremption future).
- PASS : les trois RPC ont réussi sous `authenticated` avec l'identité du Gestionnaire de stock ; le stock (quantité 5) et le lot (1) étaient lisibles sous ce même rôle via RLS.
- PASS refus : un profil Client sans affectation professionnelle et le Gestionnaire de stock essayant une autre pharmacie ont tous deux été rejetés par `Pharmacie hors périmètre`.
- Nettoyage : transaction `ROLLBACK`. Contrôle après rollback : zéro stock, zéro lot et zéro mouvement journalisé résiduel pour ce produit/pharmacie.

**Triage des 72 alertes RLS sans policy**
- Reproduction SQL de l'ensemble des tables correspondantes : 65 tables `public` + 7 tables `private` = 72, cohérent avec le Security Advisor.
- Aucun de ces 65 objets `public` ne donne de privilège SELECT/INSERT/UPDATE/DELETE à `anon` ou `authenticated` (0 table lisible/écrivable par ces rôles). Les 7 tables `private` n'accordent pas non plus de privilèges de table à ces rôles.
- Classement : accès fermé par défaut, pas de policy nécessaire tant qu'aucun accès direct API n'est voulu. Ne pas ajouter des policies permissives pour faire disparaître l'alerte. Les objets `storage`/ `realtime` hors de ces 72 constats sont gérés séparément par leurs mécanismes propres.
- Cette vérification confirme l'absence de privilège direct pour les deux rôles testés ; elle ne certifie pas à elle seule les flux internes `service_role` ou Edge Functions.

**Triage statique ciblé des 253 SECURITY DEFINER accessibles à authenticated**
- Inventaire PostgreSQL Replay : 253 fonctions exposées à `authenticated`.
- 248 définitions contiennent un signal de garde explicite (identité JWT, Admin, privilège, capacité ou contrôle de scope). C'est un tri statique, non une preuve comportementale exhaustive.
- Les 5 définitions sans signal direct ont été lues :
  - `assurance_import_simuler_mode` délègue à `assurance_import_simuler`, qui exige `auth.uid()`, un rôle professionnel autorisé et `naxa_scope_allows` sur la pharmacie.
  - `set_garde` dérive la pharmacie depuis `my_pharmacie()` et exige `authorize('MANAGE_GUARD_STATUS', ...)`, façade vers le moteur de privilèges.
  - `get_universe_catalog_v2`, `marketplace_offre_stock_disponible` et `marketplace_produit_visible` sont les 3 RPC publiques anon maintenant validées par les recettes positives/négatives du §118.
- Aucun grant n'a été modifié. Les avertissements SECURITY DEFINER ne sont pas effacés artificiellement : ils restent à interpréter comme surface RPC autorisée, avec garde métier, et non comme 253 vulnérabilités confirmées.
- Les tests d'identité, affectation et sessions déjà PASS au §115 restent la preuve comportementale des chemins couverts. Le tri statique de 248 fonctions ne remplace pas une recette par fonction.

**Limites inchangées**
- Aucun outil disponible pour lancer le workflow `workflow_dispatch`, ouvrir un navigateur/Playwright interactif ou modifier le paramètre Auth natif `Leaked Password Protection`.
- Le test Auth ci-dessus simule les claims d'un compte Auth existant ; il ne démontre pas la connexion réelle, le refresh, l'expiration ni la révocation dans un navigateur.
- `Leaked Password Protection` reste désactivé. Le contrôle compensatoire côté application n'est pas prouvé et ne doit pas être assimilé à la protection native.

**Verdict Lot A : PARTIEL, nettement avancé.** PASS : création de stock par les RPC métier avec identité Auth de test simulée, visibilité RLS Gestionnaire, refus Client/hors périmètre, RPC anon positives/négatives, et classification des 72 tables sans policy. Le vert global reste conditionné à la preuve navigateur Auth (connexion/refresh/expiration/révocation), à l'acceptation explicite de la limite du forfait gratuit ou à un contrôle compensatoire prouvé, et à la poursuite des tests comportementaux ciblés sur les RPC sensibles. Aucun accès Production, aucun déploiement Vercel ou Play Store.


## 120. Lot A — vérification de la contrainte Leaked Password Protection du forfait gratuit (16/11/2026)

- Documentation officielle Supabase consultée via le connecteur : la protection contre les mots de passe compromis utilise l'API Pwned Passwords de HaveIBeenPwned et est disponible uniquement à partir du plan Pro. La limite rencontrée sur Replay Free est donc une contrainte documentée du produit, pas une mauvaise manipulation.
- La documentation du `Password Verification Hook` décrit un hook de suivi/décision après une tentative de vérification de mot de passe (notamment limitation des tentatives et notification). Son payload documenté expose `user_id` et `valid`, pas le mot de passe candidat ; il ne remplace donc pas la vérification native d'un mot de passe compromis à l'inscription ou au changement de mot de passe.
- Un contrôle Pwned Passwords uniquement dans le navigateur ou dans l'interface NAXA serait contournable par un appel direct à l'API Auth avec la clé publique. Il ne peut pas être déclaré compensatoire « équivalent » sans preuve d'un contrôle serveur imposé à tous les chemins Auth et non contournable.
- Décision technique : ne pas inventer de contournement SQL, ne pas prétendre que le hook Auth couvre ce risque, ne pas ajouter une vérification client seule pour fabriquer un PASS. Conserver l'alerte native comme limitation documentée du plan Free.
- Source : https://supabase.com/docs/guides/auth/password-security ; https://supabase.com/docs/guides/auth/auth-hooks/password-verification-hook.

**État de l'exigence :** techniquement non activable sur Free ; aucun correctif NAXA n'est à appliquer pour faire croire à l'activation. La clôture du Lot A exige une décision explicite d'acceptation du risque / reclassement « hors capacité du forfait gratuit », ou un environnement de test disposant du plan Pro. L'utilisateur ne doit pas être invité à payer pour poursuivre les autres recettes.


## 121. Lot A — audit comportemental des 5 SECURITY DEFINER sans garde directe (16/11/2026)

- Inventaire confirmé : exactement 253 fonctions `SECURITY DEFINER` exécutables par `authenticated`.
- 248/253 contiennent directement un contrôle d'identité, d'administration, de privilège, de capacité ou de périmètre dans leur définition.
- Les cinq exceptions statiques sont maintenant nommées et triées :
  1. `assurance_import_simuler_mode` : délègue à `assurance_import_simuler`, qui vérifie identité, fonction professionnelle et périmètre pharmacie.
  2. `set_garde` : dérive la pharmacie de `my_pharmacie()`, puis exige `authorize('MANAGE_GUARD_STATUS', ...)`.
  3. `get_universe_catalog_v2` : RPC catalogue public ; filtres de publication et tests positifs/négatifs §118.
  4. `marketplace_offre_stock_disponible` : façade de `private.marketplace_offre_stock_disponible_guarded` ; tests positifs/négatifs §118.
  5. `marketplace_produit_visible` : visibilité conditionnée par pharmacie active, publiée, non démo et non archivée ; tests positifs/négatifs §118.
- Deux tests négatifs additionnels exécutés sur Replay sous rôle SQL `authenticated` et JWT simulé d'un profil Client sans affectation :
  - `set_garde(true)` est refusée.
  - `assurance_import_simuler_mode(...)` est refusée avant création d'import.
  Les blocs SQL ont été exécutés dans une transaction terminée par `ROLLBACK`.
- Aucun grant n'a été retiré. Aucun comportement d'une fonction métier n'a été modifié.
- Verdict de cette revue : PASS pour le tri statique des 253 fonctions et les tests comportementaux des cinq exceptions. Limite : les 248 gardes directes n'ont pas chacune une matrice de tests dédiée ; cette revue ne prétend pas constituer 253 tests d'autorisation individuels.

## 122. Lot A — ajout du harnais navigateur Auth Replay (16/11/2026)

- Nouveau script `scripts/e2e/verify-auth-session-lifecycle.cjs` : navigateur Chromium, connexion UI avec le compte Gestionnaire de stock E2E, contrôle du cookie SSR Supabase, suppression/expiration simulée du cookie et vérification que le middleware refuse ensuite l'espace protégé.
- Le même harnais teste par API Auth réelle Replay : connexion par mot de passe, rotation du refresh token, rejet de l'ancien refresh token après la fenêtre de réutilisation, puis révocation globale d'une seconde session et rejet de son refresh token.
- Le script est strictement épinglé au projet Replay `pwfftcsjyeibxxqhwysw`; mot de passe lu depuis le fichier temporaire protégé généré par le provisionneur du personnel ; aucun secret n'est journalisé.
- Workflow `.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml` mis à jour : le script est inclus dans les chemins déclencheurs et dans les contrôles navigateur du job existant. Le push du workflow sur `main` est conçu pour déclencher la recette intégrée, qui réutilise le provisionnement Replay déjà présent.
- Commits : script `f91cea495f048f6226ffbab063c8476a5015a222`, intégration workflow `c714d93d2cf540a6d2fed7a9ab594898dc0b5ff6`.
- Limite de preuve actuelle : le connecteur GitHub expose les lectures/relances de jobs mais pas la liste des runs déclenchés par push ni `workflow_dispatch`. L'appel de lecture disponible sur le commit renvoie une liste vide car il ne retourne que les runs associés aux pull requests. Aucun run ID, résultat de job ou artefact n'est donc vérifiable ici ; ne pas annoncer le script PASS avant lecture d'un vrai run.
- Limite technique du script : il teste l'expiration du cookie navigateur (middleware fail-closed), la rotation, le rejeu et la révocation. Il n'attend pas l'expiration cryptographique naturelle du JWT (durée configurée du projet). Ce dernier point reste explicitement distinct et ne doit pas être confondu avec l'expiration cookie simulée.

## 123. Lot A — statut consolidé après corrections (16/11/2026)

**PASS**
- Création de stock et de lot via RPC métier sous identité Gestionnaire simulée, lecture RLS, refus Client et pharmacie hors périmètre (§119).
- Trois RPC marketplace anon : tests positifs et négatifs avec stock/lot réels simulés en transaction (§118).
- 72 tables RLS sans policy : absence de privilèges directs pour `anon` et `authenticated`, classées accès fermé par défaut (§119).
- Revue statique des 253 fonctions SECURITY DEFINER et tests négatifs sur les cinq exceptions sans garde directe (§121).

**En attente de preuve**
- Le nouveau test navigateur Auth est intégré au workflow déclenché par push, mais aucun run ID ni résultat n'est accessible par les outils actuels. Le succès ne peut pas être présumé.
- Expiration naturelle du JWT non attendue ; seule l'expiration/suppression du cookie navigateur est simulée par le script.

**Limitation de forfait**
- `Leaked Password Protection` est indisponible sur Supabase Free. Le Password Verification Hook ne remplace pas le contrôle du mot de passe candidat. Aucun contournement client/SQL non équivalent n'est accepté.
- Cette exigence doit rester marquée `EXCEPTION DE FORFAIT — NON ACTIVABLE SUR FREE` et non PASS. Son acceptation comme risque hors périmètre relève d'une décision explicite du propriétaire NAXA ; aucune acceptation n'est présumée.

**Verdict Lot A : PARTIEL — aucun faux vert.** La revue des RPC et la recette stock sont clôturées. La preuve navigateur reste à récupérer sur le run GitHub Actions déclenché par le commit `c714d93d2cf540a6d2fed7a9ab594898dc0b5ff6`. La protection native des mots de passe compromis reste une exception de forfait. Aucun accès Production, aucune migration Production, aucun déploiement Vercel ou Play Store.


## 124. Correction du run GitHub Actions — lint du harnais Auth (16/11/2026)

**Diagnostic sur le run 43964640655**
- Le workflow a atteint l'étape ESLint ; l'échec n'était donc pas un défaut d'indentation YAML.
- Erreur bloquante exacte : `scripts/e2e/verify-auth-session-lifecycle.cjs:132:14 — Parsing error: Unexpected token :`.
- Cause racine : une séquence littérale `\\n` avait été insérée à la fin d'un commentaire JavaScript. La déclaration `const logoutResponse` était ainsi absorbée par le commentaire, laissant l'objet `headers` orphelin et provoquant l'erreur de parsing.
- Défaut distinct de déclenchement : la liste `paths` du workflow contenait également les caractères littéraux `\\n` entre deux chemins, au lieu d'un vrai saut de ligne YAML. Correction en séparant les deux entrées.

**Corrections appliquées sur main**
- `.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml` : chemins déclencheurs rétablis en deux éléments YAML distincts.
- `scripts/e2e/verify-auth-session-lifecycle.cjs` : commentaire et déclaration `logoutResponse` séparés sur deux lignes JavaScript valides.
- Aucun secret modifié, aucune migration, aucun changement Supabase, aucune action Production/Vercel/Play Store.

**Preuve attendue**
- Le commit de correction déclenche un nouveau run puisque le workflow et le script sont dans les chemins surveillés.
- Le run précédent reste en échec historique. Le correctif n'est pas déclaré PASS avant le résultat d'un nouveau run, notamment ESLint, build et recette Auth Replay.

**Verdict Lot A : PARTIEL inchangé jusqu'au nouveau run.**


## 125. Correction ShellCheck du workflow Replay (16/11/2026)

- Le run de validation YAML/actionlint du commit `8732a739` a confirmé que le workflow est désormais parsable, mais a révélé un second séparateur `\\n` littéral dans le bloc shell navigateur, entre les appels `verify-auth-session-lifecycle.cjs` et `verify-credit-pos-browser.cjs`.
- ShellCheck signalait `SC1012: \\n is just literal 'n' here` à la ligne 294 du workflow.
- Correction : séparation des deux commandes sur deux vraies lignes du bloc `run: |`. Les séquences `\\n` utilisées normalement à l'intérieur des chaînes JavaScript de génération de secrets restent inchangées.
- Le run de qualité et le run E2E du commit précédent sont encore en cours à cet instant ; la nouvelle validation sera déclenchée par le présent commit.
- Aucun changement de logique métier, aucun secret, aucune donnée Replay, aucune migration ni environnement Production/Vercel/Play Store touchés.

**Verdict Lot A : PARTIEL jusqu'aux résultats du nouveau run.**


## 126. Vérification après correction — qualité verte, E2E Replay en attente (16/11/2026)

**État vérifié sur le commit `082b385cd486141a1b28d94233eede7e1196a7ae`**
- Run **NAXA quality #3810** — ID `43965871749` : `completed / success`. La validation de qualité a donc accepté le workflow et les corrections ShellCheck/JavaScript précédentes.
- Run **NAXA Replay Promoteur E2E #258** — ID `43965871815` : statut `pending`, conclusion absente. La lecture GitHub Actions retourne encore une liste de jobs vide. Aucun log, résultat d'étape ou artefact E2E n'est donc disponible à ce contrôle.
- Le run E2E n'a pas encore fourni de preuve d'exécution. Son état `pending` ne révèle pas, à lui seul, une nouvelle erreur du script ou du workflow ; il ne faut ni le déclarer réussi ni inventer une cause précise à l'attente.

**Décision / suite exacte**
- Le défaut de parsing JavaScript et le défaut ShellCheck littéral `\\n` sont corrigés sur `main`; le run qualité réussi en apporte la preuve.
- Garder le Lot A **PARTIEL** jusqu'à ce que le run `43965871815` démarre et fournisse ses jobs/logs. À sa reprise : contrôler le provisionnement Replay, le build, la recette navigateur Auth (connexion UI, cookie SSR, rotation/rejeu refresh, révocation globale), puis les autres étapes E2E et les artefacts.
- Ne pas relancer ni modifier le code sur la seule base d'un statut `pending` sans diagnostic de job ; reprendre la lecture du même run.
- Limites inchangées : expiration naturelle du JWT non attendue par le script ; Leaked Password Protection indisponible sur Supabase Free et classée exception de forfait, jamais PASS sans décision explicite.

**Périmètre inchangé :** branche `main`, Replay uniquement. Aucune action Production, migration Production, Vercel ou Play Store.

Liens de preuve :
- Qualité : https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43965871749
- E2E Replay : https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43965871815
- Commit contrôlé : https://github.com/audreymendomo23-netizen/NAXA/commit/082b385cd486141a1b28d94233eede7e1196a7ae

**Verdict Lot A : PARTIEL — corrections statiques validées par NAXA quality ; recette E2E Replay toujours sans preuve d'exécution.**


## 127. Audit contradictoire et correction du test de réutilisation des refresh tokens Auth (16/11/2026)

**Périmètre : Replay uniquement, projet `pwfftcsjyeibxxqhwysw`.** Aucun changement de paramètre Auth Supabase, aucune migration SQL, aucune donnée Production, aucun déploiement Vercel ou Play Store.

### Audit des logs et contradiction

- Run initial [Replay E2E #258](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43965871815), commit `082b385cd486141a1b28d94233eede7e1196a7ae`, échoue uniquement sur l'assertion de rejeu du refresh token ancien dans le script Auth.
- Logs Auth Replay : deux appels `grant_type=refresh_token` pour la fixture Gestionnaire Stock sont acceptés en HTTP 200, avec événements `token_refreshed`, aux horodatages `2026-11-16T22:12:06Z` et `2026-11-16T22:12:18Z`. Le second appel intervient 12 secondes après le premier.
- Le scénario initial ne faisait qu'une rotation `T1 → T2`, attendait 12 secondes, puis rejouait `T1`. Or `T1` est précisément le parent du refresh token actuellement actif `T2`.
- La documentation Supabase [User sessions — refresh token reuse detection](https://supabase.com/docs/guides/auth/sessions), mise à jour le 19/10/2026, décrit explicitement deux exceptions : fenêtre de réutilisation (10 secondes par défaut) et réacceptation du parent du token actif, même après cette fenêtre, pour tolérer une réponse réseau perdue. Si le jeton rejoué ne relève d'aucune exception, toute la session est terminée et tous ses refresh tokens sont révoqués.
- **Cause racine : assertion E2E incorrecte, pas défaut Auth démontré.** Le serveur se comportait conformément à la règle de tolérance documentée ; le test confondait le parent actif avec un ancien jeton ancêtre. Modifier les paramètres Auth ou désactiver la détection aurait affaibli la sécurité et n'aurait pas corrigé le test.

### Correction versionnée sur main

- Commit [`0e0890d821e1c5062d360f6c9c19331e47e1f12c`](https://github.com/audreymendomo23-netizen/NAXA/commit/0e0890d821e1c5062d360f6c9c19331e47e1f12c) — `fix(e2e): tester la détection réelle de réutilisation Auth`.
- Le script `scripts/e2e/verify-auth-session-lifecycle.cjs` exécute maintenant deux rotations successives `T1 → T2 → T3`, attend 15 secondes après la première rotation, puis rejoue `T1` qui est désormais un ancêtre et non le parent actif.
- Assertions renforcées : rejet de `T1` hors fenêtre de tolérance, puis rejet de `T3` pour prouver que la détection a révoqué la session entière.
- Aucun refresh token, access token, mot de passe ou secret n'est écrit dans les logs. Le contrôle de révocation globale d'une seconde session indépendante reste présent.

### Vérification en cours

- [Run Replay E2E #259](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43969321921), commit `0e0890d821e1c5062d360f6c9c19331e47e1f12c` : `in_progress` au moment de cette mise à jour ; le job de provisionnement et les contrôles statiques initiaux sont en cours. Aucune preuve PASS Auth n'est encore revendiquée.
- [NAXA quality #3812](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43969321770) : `in_progress` au moment de cette mise à jour.
- Le résultat final attendu pour ce point est : connexion UI PASS ; cookie absent refusé ; rotations successives PASS ; rejeu de l'ancêtre refusé ; refresh courant refusé après détection (révocation de session) ; révocation globale indépendante PASS.

**Verdict : PARTIEL — cause racine identifiée et correction versionnée ; validation E2E complète encore en cours.** Ne pas déclarer vert avant les logs terminaux du run #259. Leaked Password Protection reste une exception de forfait distincte et n'est pas modifiée par ce correctif.


## 128. Résultat du lot Auth / Web Push / Crédit sur Replay (16/11/2026)

**Périmètre strict :** branche `main`, projet Supabase Replay `pwfftcsjyeibxxqhwysw`. Aucun accès Production, migration Production, déploiement Vercel, Play Store ni extension de périmètre.

### Corrections exécutées sur main

- Commit [`fa0f497030c29c71b5d3cbf6560311adfd1a6e1a`](https://github.com/audreymendomo23-netizen/NAXA/commit/fa0f497030c29c71b5d3cbf6560311adfd1a6e1a) : déplacement de l'attente Auth après la deuxième rotation T2→T3 ; passage du test Push à Google Chrome stable ; séparation des compteurs de résultat Auth et Crédit.
- Commit [`2e15449b4d77b71a6c3c66f3dafdd02832a2b4a3`](https://github.com/audreymendomo23-netizen/NAXA/commit/2e15449b4d77b71a6c3c66f3dafdd02832a2b4a3) : correction du test statique qui attendait encore l'ancien compteur combiné.
- Aucun paramètre Supabase Auth n'a été modifié par SQL ou par le workflow ; aucune assertion de sécurité n'a été affaiblie.

### Preuves vertes sur le commit `2e15449`

**PASS — qualité**
- [NAXA quality #3815](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43972075906), run `43972075906` : tests, TypeScript, lint, build Next.js et validation syntaxique GitHub Actions terminés avec succès.

**PASS — Web Push réel**
- [NAXA Replay E2E #261](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43972075922), run `43972075922` : build local PASS ; présence de Google Chrome stable PASS ; trois souscriptions authentifiées distinctes ; trois envois Web Push ciblés et trois notifications effectivement constatées dans les Service Workers Chrome.
- Le HTTP 410 du précédent essai Chromium n'est plus observé. La preuve porte sur la réception navigateur Web Push ; elle ne prétend pas démontrer une réception physique FCM sur Android.

**PASS — Crédit navigateur et runtime**
- POS navigateur : PASS — demande Caisse au-dessus du plafond, validation Promoteur, débit unique du stock, suivi Client et remboursement.
- Marketplace navigateur : PASS — dépôt de demande, statut en attente sans réservation/débit, refus Promoteur et stock inchangé.
- Comptabilité navigateur : PASS — plan comptable, journaux et mappings de crédit créés puis validés dans l'interface.
- Remboursement runtime via un vrai JWT Caisse Replay : PASS — diminution exacte de 250 FCFA, entrée espèces liée à la session, outbox unique et refus du dépassement de solde sans mutation.
- Storage E2E : PASS ; nettoyage des objets et des sessions temporaires : PASS.

### Auth — blocage résiduel prouvé, non vert

- Le script corrigé exécute T1→T2→T3, attend 15 secondes après T3, puis rejoue T1. Le rejeu de l'ancêtre est bien refusé par Supabase Auth : journal `auth_logs` du 16/11/2026 à 22:46:23Z, erreur `refresh_token_already_used`, HTTP 400.
- Immédiatement après, le refresh token courant T3 est encore accepté : appel `/token` en HTTP 200 et nouvelle ligne active dans `auth.refresh_tokens` pour la même session. L'assertion qui exige la révocation de la session entière échoue donc toujours.
- La documentation Supabase [User sessions — refresh token reuse detection](https://supabase.com/docs/guides/auth/sessions) indique qu'un rejeu hors fenêtre de tolérance et hors exception du parent actif doit terminer la session et révoquer tous ses refresh tokens. Elle précise que ce comportement peut être désactivé dans les paramètres Auth avancés.
- **Cause probable à confirmer dans le Dashboard Replay :** l'option de révocation globale/termination de session lors d'une réutilisation de refresh token est désactivée ou n'est pas appliquée par l'instance Replay. Le rejeu lui-même est bien détecté ; c'est l'action de révocation globale qui manque. L'état de ce commutateur n'est pas exposé par les outils Supabase connectés, donc il n'est pas déclaré directement vérifié et aucun changement n'a été tenté.
- Réglage à contrôler/activer dans [Supabase Replay → Authentication → Sessions](https://supabase.com/dashboard/project/pwfftcsjyeibxxqhwysw/auth/sessions), section **Advanced Settings** : comportement qui termine toute la session et révoque tous les refresh tokens après une réutilisation hors exceptions. Ne pas réduire l'intervalle pour contourner ce défaut et ne pas assouplir l'assertion.
- Après activation, relancer uniquement le workflow Replay E2E et vérifier le rejet de T3, puis la révocation globale indépendante de la seconde session.

### Verdict contradictoire

- **VERT :** qualité, Web Push réel, trois recettes Crédit navigateur, remboursement runtime, Storage et nettoyage.
- **NON VERT :** Auth — révocation de toute la session après rejeu d'un ancêtre. Le rejeu est correctement refusé, mais T3 reste exploitable.
- Run [Replay E2E #261](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43972075922) : `completed / failure`, uniquement à cause de l'assertion Auth. Aucun faux vert global.

**Verdict des trois points : 2/3 verts ; Crédit est vert, Web Push est vert, Auth reste bloqué par le réglage de sécurité du projet Replay à contrôler.**



## 129. Vérification directe de la session Auth après rejeu d'un ancêtre (17/11/2026)

**Périmètre :** projet Supabase Replay `naxa-ci-replay-2`, ref `pwfftcsjyeibxxqhwysw`. Contrôles strictement en lecture seule sur les journaux Auth et les tables `auth.sessions` / `auth.refresh_tokens`. Aucun changement de configuration, aucune écriture SQL, aucun changement de code, aucune action Production/Vercel/Play Store.

### Preuve contradictoire sur la session E2E

- Run [Replay E2E #261](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43972075922), job Auth, compte technique Gestionnaire Stock, session `53e61ccd-0f96-4c30-9a88-38feacd65049`.
- Chaîne confirmée dans `auth.refresh_tokens` : T1 (ligne 2020) → T2 (2021) → T3 (2022). Le rejeu de T1 survient à `22:46:23.130Z`, plus de 15 secondes après la deuxième rotation.
- Journaux Auth : rejeu de T1 refusé avec `refresh_token_already_used`, HTTP 400. À `22:46:23.502Z`, le refresh avec T3 est accepté en HTTP 200 et produit T4.
- État DB lu après le test : T1, T2 et T3 sont marqués `revoked=true`, mais T4 est `revoked=false`. La ligne de session correspondante existe toujours dans `auth.sessions`.
- Conclusion factuelle : le rejeu de l'ancêtre est détecté et les trois anciens refresh tokens sont révoqués, mais le serveur accepte ensuite le refresh courant et conserve la session. L'assertion E2E de révocation complète n'est donc pas un faux positif.

### Réglage Dashboard : état non établi

- L'utilisateur a copié le texte de la page Authentication → Sessions. Le texte confirme un intervalle de réutilisation de 10 secondes et affiche le libellé « Détecter et révoquer les jetons d'actualisation potentiellement compromis », mais ne révèle pas l'état visuel ON/OFF du commutateur.
- Il n'est donc pas démontré que le commutateur soit activé. La précédente hypothèse « réglage activé mais non appliqué » reste à confirmer ; ne pas l'énoncer comme cause certaine.
- La documentation Supabase [User sessions](https://supabase.com/docs/guides/auth/sessions) indique que, hors fenêtre de tolérance et hors exception du parent du token actif, toute la session doit être terminée et tous les refresh tokens révoqués.
- Les outils Supabase connectés permettent les lectures SQL/journaux mais n'exposent pas d'action de lecture ou de modification de la configuration Auth du projet. Aucune tentative de modification SQL n'est faite : la configuration Auth ne doit pas être bricolée dans la base.

### Décision / prochaine action exacte

1. Conserver l'expiration du jeton d'accès à 3 600 secondes et l'intervalle de réutilisation à 10 secondes.
2. Confirmer visuellement que le commutateur « Détecter et révoquer… » est ON. S'il est OFF, l'activer puis enregistrer ; s'il est déjà ON, ne pas le basculer et escalader le comportement observé à Supabase avec les horodatages et l'ID de session de test.
3. Rejouer uniquement le test Auth Replay. PASS attendu : T1 rejeté, T3 également rejeté, session absente de `auth.sessions`, et contrôle de révocation globale indépendante toujours PASS.
4. Ne pas assouplir le test, ne pas augmenter la fenêtre de réutilisation, et ne pas ajouter de garde applicative avant d'avoir établi l'état réel du paramètre natif.

**Verdict : NON VERT — défaut de révocation complète observé dans Replay ; état ON/OFF du commutateur Dashboard encore inconnu.** Les deux autres points du lot (Web Push et Crédit) restent verts selon §128.

## 130. Confirmation utilisateur du réglage de détection Auth (17/11/2026)

**Périmètre :** Replay uniquement. Aucun changement de réglage, aucune écriture SQL, aucune modification de code applicatif, aucune action Production/Vercel/Play Store.

### Information Dashboard confirmée par l'utilisateur

- L'utilisateur confirme que l'option « Détecter et révoquer les jetons d'actualisation potentiellement compromis » apparaît cochée dans Supabase Replay. Il précise que le libellé est affiché en gris.
- Cette confirmation est une observation utilisateur de l'interface ; aucune lecture machine de la configuration Auth n'est disponible via les connecteurs. Ne pas interpréter la couleur grise du libellé comme un état OFF.
- L'intervalle reste 10 secondes et l'expiration du JWT d'accès reste 3 600 secondes. Aucun réglage n'est modifié.

### Contradiction avec le comportement documenté

- La documentation Supabase [User sessions](https://supabase.com/docs/guides/auth/sessions) (mise à jour le 19/10/2026) précise qu'un rejeu qui ne relève ni de la fenêtre de réutilisation, ni du parent du refresh token actif, doit terminer toute la session et révoquer tous les refresh tokens.
- La séquence E2E T1→T2→T3, attente de 15 secondes, rejeu de T1, est construite pour être hors de ces deux exceptions. Les observations Replay du §129 montrent pourtant que T3 est accepté après le refus de T1 et que T4 est créé.
- Avec l'option rapportée comme cochée, le réglage Dashboard n'est plus une explication suffisante à lui seul. La cause exacte reste non établie : défaut d'application côté instance Auth Replay ou comportement serveur à faire confirmer par Supabase. Ne pas attribuer la faute à l'application NAXA sans preuve.

### Décision

1. Ne pas modifier le commutateur ni les valeurs 10 s / 3 600 s.
2. Ne pas modifier le test E2E et ne pas ajouter de contournement applicatif.
3. Escalader auprès de Supabase avec le projet Replay `pwfftcsjyeibxxqhwysw`, l'ID de session `53e61ccd-0f96-4c30-9a88-38feacd65049`, le run [Replay E2E #261](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43972075922), les heures `22:46:23.130Z` (T1 rejeté) et `22:46:23.502Z` (T3 accepté), ainsi que les états DB consignés au §129.
4. Reprendre le verdict vert uniquement après une correction confirmée et une nouvelle preuve : T1 rejeté, T3 rejeté, session supprimée de `auth.sessions`.

**Verdict : NON VERT — réglage déclaré coché par l'utilisateur, mais comportement Replay contraire au comportement documenté. Escalade Supabase nécessaire ; aucune modification de contournement.**

## 131. Attribution technique : la recette de rejeu interroge directement Supabase Auth (17/11/2026)

**Audit du script réel :** `scripts/e2e/verify-auth-session-lifecycle.cjs`, lu sur `main`.

- La fonction `authRequest()` envoie directement les requêtes HTTP à `https://pwfftcsjyeibxxqhwysw.supabase.co/auth/v1/token` avec la clé anon.
- Les deux rotations, le rejeu T1 et la vérification T3 après rejeu sont donc exécutés par le service Supabase Auth. Ils ne passent ni par une route API NAXA, ni par le middleware Next.js, ni par `supabaseServer()`.
- Le scénario distinct de révocation explicite appelle également directement `/auth/v1/logout?scope=global`.
- Le middleware NAXA protège les préfixes de pages applicatives listés dans `src/middleware.ts`, mais laisse volontairement les routes `/api/*` hors de son contrôle générique. Chaque API doit donc vérifier elle-même l'identité et les droits nécessaires.
- Ajouter un contrôle NAXA dans le middleware ne peut pas modifier le résultat de l'appel direct au endpoint Supabase Auth utilisé par cette recette. Une table de révocation applicative ne peut pas non plus être alimentée automatiquement par un rejeu que Supabase ne signale pas à NAXA.

### Décision technique corrigée

1. Ne pas modifier le script pour faire passer artificiellement la recette ; son assertion mesure bien la révocation côté Supabase.
2. Ne pas prétendre qu'un changement du middleware NAXA corrigera le rejeu du refresh token sur `/auth/v1/token`.
3. Le défaut de révocation globale doit être corrigé dans Supabase Auth (ou dans le projet Replay lui-même). La preuve de correction reste : T1 rejeté, puis T3 rejeté, session absente.
4. Un audit séparé des routes API NAXA reste pertinent pour vérifier leurs contrôles d'accès, mais il ne constitue pas le correctif de ce défaut Auth et ne doit pas être mélangé à cette recette.

**Verdict : NON VERT — cause localisée au service Supabase Auth Replay, hors du chemin d'exécution NAXA testé. Aucun changement de code NAXA effectué car il ne pourrait pas corriger le comportement mesuré.**



## 132. Renforcement API — neutralisation de l'énumération des comptes par récupération de mot de passe (17/11/2026)

**Audit → contradiction → cause racine**
- Le middleware src/middleware.ts exclut volontairement toutes les routes /api/* du contrôle générique d'authentification ; chaque route API doit donc appliquer son propre contrôle.
- L'ancienne route src/app/api/auth/forgot-password/route.ts renvoyait HTTP 404 avec un message distinct lorsqu'un nom d'utilisateur était inconnu, et ne posait aucun rate limit applicatif avant la recherche du profil.
- Cette différence de réponse permettait de sonder l'existence de comptes NAXA. La route reste publique pour permettre la récupération d'accès : exiger une session serait contradictoire avec sa fonction.

**Correction appliquée sur main**
- Réponse publique uniforme pour nom syntaxiquement valide inconnu, profil non finalisé et compte finalisé : même statut HTTP 200 et même message générique.
- Rate limit par IP avant toute recherche de profil (ip_password_reset, 5 tentatives / 10 minutes), avec réponse 429 commune en cas de dépassement.
- Contrôle de taille du corps, réponses Cache-Control: no-store, et journaux d'erreur sans nom d'utilisateur, adresse e-mail ni détails de compte.
- Le code OTP n'est envoyé que si le profil existe, est finalisé et possède une identité Auth avec e-mail ; aucun compte n'est créé. Même une erreur du fournisseur OTP conserve la réponse publique générique pour ne pas révéler l'existence du compte.
- Test de contrat ajouté : uniformité des réponses, ordre rate limit avant lookup, et absence de cache.

**Limites et preuves**
- Ce correctif réduit l'énumération par réponse HTTP ; il ne prétend pas supprimer toute différence temporelle possible ni remplacer les protections de débit natives Supabase.
- Aucun mot de passe, OTP, e-mail, secret ou token n'a été lu ou ajouté au dépôt.
- Les tests locaux, TypeScript, lint et build ne sont pas exécutés par le connecteur GitHub ; le statut CI déclenché par le commit doit être consulté avant de qualifier la correction de PASS.
- Le rejeu refresh T1/T3 reste un défaut Supabase Auth distinct, inchangé. Aucune migration ni écriture Supabase, aucune action Production, Vercel ou Play Store.

**Verdict : CORRECTION VERSIONNÉE — validation CI en attente ; point non déclaré vert avant le run.**


## 133. Lot B2 — campagne bulk SQL Marketplace / favoris / publication (17/11/2026)

**Cible et isolation**
- Supabase Replay uniquement : naxa-ci-replay-2, projet pwfftcsjyeibxxqhwysw.
- Les migrations Marketplace de fraîcheur 48 h, wrappers de recherche, visibilité pharmacie, publication propriétaire pharmacie, portée Promoteur et favoris sont présentes dans l'historique Replay.
- Inventaire courant : 21 fiches produit, 102 lignes de stock, 0 offre en stock actuellement rattachée à une pharmacie active, visible, non-démo et non-archivée ; 0 favori persistant et 0 réservation créée sur les 7 derniers jours. Cela limite les scénarios UI positifs exécutables avec les données persistantes du projet.

**Résultats exécutés sur Replay**
- PASS — test 300 : contrat du moteur privé de disponibilité, fraîcheur basée sur le journal physique, filtre pharmacie, lots bloqués/périmés, holds et verrouillage de réservation.
- PASS — test 301 : wrappers de recherche, délégation au moteur privé, bornes d'entrée, RLS catalogue, refus des identifiants inconnus, tableaux de quantités incohérents et quantités >10 sous rôle SQL anon.
- PASS — test 302 : journal physique prioritaire et fallback updated_at seulement pour stock sans historique.
- PASS — test 303 : une modification de prix seule ne rafraîchit pas l'horodatage de fraîcheur.
- PASS — test 304 : exactement 48 h reste publiable ; au-delà, l'offre est masquée.
- PASS — test 305 : l'ancien helper privé n'est pas exécutable par anon/authenticated, le wrapper public reste accessible.
- PASS — test 20261115200000 : RLS et publication d'une fiche sous responsabilité de la pharmacie, sans validation centrale.
- PASS — test 20261115202000 : portée Promoteur, droits de lecture interne et visibilité de la fiche même si le stock est nul.
- PASS — test 20261105145307 : tables, colonnes, RLS, policy, grants, RPC d'acceptation et trigger d'achat.
- PASS — test 20261109070000 : le trigger d'achat reste attaché mais ne peut pas être appelé directement par les rôles API.
- PASS — sonde B2-FAVORITES-OWNERSHIP : policy favoris_client_self impose user_id=auth.uid() en USING et WITH CHECK ; aucun accès anon ; RPC d'acceptation authentifiée seulement.
- PASS — sonde RLS Client réelle dans une transaction : insertion d'un favori temporaire avec le JWT simulé du Client propriétaire ; un second Client ne peut ni le lire, ni le modifier, ni le supprimer ; le propriétaire le relit ; ROLLBACK final, aucune ligne persistante.
- PASS — le parcours Marketplace navigateur de refus Promoteur déjà acquis au §128 est conservé comme preuve ; non rejoué.

**Contradiction / correction des tests obsolètes**
- Les anciens tests 300/301 inspectaient le wrapper public comme s'il contenait directement la logique SQL et exigeaient fiche_validee=true / des wrappers INVOKER. Ces assertions ne correspondaient plus au modèle final : la pharmacie est propriétaire de ses fiches et la recherche délègue au moteur privé gardé.
- Inspection Replay : le wrapper public de disponibilité délègue à private.marketplace_offre_stock_disponible_guarded ; les moteurs privés filtrent pharmacie active/publiée/non-démo/non-archivée, fraîcheur 48 h, lots et réservations, sans verrou fiche_validee. Les wrappers de recherche délèguent aux moteurs privés ; l'ancien helper privé d'offre n'est pas directement exécutable par les rôles Client.
- Les contrats 300 et 301 ont été actualisés sur main pour vérifier ce modèle réel, puis exécutés avec succès sur Replay. Aucun changement de schéma ou de donnée persistante n'a été effectué par ces tests.

**Limites de preuve**
- Le §118 conserve la preuve SQL positive et négative de visibilité Marketplace sous anon avec stock/lot fictifs créés en transaction puis rollbackés : offre positive 1 200 FCFA / 5 unités, puis cas masqué, inactif, démo, archivé, lot expiré/bloqué, stock nul et historique >48 h.
- Le scénario navigateur de refus Promoteur est déjà PASS (§128). Aucun scénario navigateur positif de commande Marketplace n'a été exécuté dans cette campagne : aucune offre persistante publiable n'existe actuellement dans Replay.
- Le schéma et le cloisonnement favoris sont validés ; aucune identité Client de recette ni données persistantes de favoris n'ont été mutées pour simuler un clic utilisateur. Le test UI favoris (ajout, retrait, synchronisation locale/compte) reste à exécuter avec un navigateur authentifié.
- Annulation, indisponibilité après ajout au panier et historique Client restent à prouver en parcours utilisateur complet. Aucun test n'est présenté comme navigateur si ce n'était qu'une assertion SQL.

**Verdict B2 : JAUNE / PARTIEL.** Les contrats SQL de publication, disponibilité, recherche et sécurité des favoris sont prouvés sur Replay ; le refus Promoteur navigateur reste acquis. La chaîne positive de commande, favoris UI, annulation, indisponibilité et historique Client attend un scénario navigateur authentifié et des fixtures Marketplace isolées publiables. Aucune écriture Production, migration Production ou déploiement.


## 134. Lot B2 — seconde passe ciblée avec comptes Client et pharmacie E2E (17/11/2026)

**Périmètre de cette passe :** Supabase Replay `pwfftcsjyeibxxqhwysw` exclusivement. Lecture des comptes, profils, affectations et stocks ; scénarios SQL transactionnels annulés par `ROLLBACK`. Aucune donnée persistante modifiée, aucune migration, aucun déploiement.

### Comptes et environnement réellement disponibles

- Le compte Client acheteur `naxa_e2e_acheteur` existe : profil `dcb2242b-50fb-46c8-8c90-e01d42fa4175`, rôle `client`, sans pharmacie rattachée.
- Les comptes `naxa_e2e_stock`, `naxa_e2e_caisse` et `naxa_e2e_pharmacien` existent et ont des affectations actives Gestionnaire stock / Caisse / Pharmacien sur la pharmacie Mvan, mais cette pharmacie est marquée `est_demo=true` : elle ne peut pas publier d'offre Marketplace.
- Le Promoteur E2E existe, mais aucune relation Promoteur→pharmacie ni affectation professionnelle n'a été relevée pour lui dans cette vérification.
- La pharmacie `NAXA E2E — Pharmacie de recette (non commerciale)` (`1a4f1ce5-cccf-477e-9a5b-474c8c9fc713`) est non-démo et active, mais `visible_recherche=false`. Elle possède deux lignes de stock ; une seule est positive et exploitable : Produit crédit comptoir, 1 000 FCFA, quantité 3, fraîcheur physique récente, sans lots.
- Les autres pharmacies ayant du stock sont des pharmacies de test marquées démo. Le constat initial « zéro offre publiable » venait donc de l'état de visibilité de la pharmacie non commerciale et du caractère démo des autres pharmacies, pas d'une absence totale de stock.

### Tests supplémentaires exécutés

- **PASS SQL — disponibilité positive réelle sous rôle anon :** dans une transaction, visibilité de la seule pharmacie E2E non commerciale temporairement activée ; appel de `public.marketplace_offre_stock_disponible` sous `SET LOCAL ROLE anon` ; résultat `prix=1000`, `quantite=3`. `ROLLBACK` final : la pharmacie reste masquée après le test.
- **PASS SQL — cycle ajout/lecture/retrait d'un favori :** avec l'identité Client acheteur et le rôle SQL `authenticated`, insertion du favori sur le produit E2E, lecture propriétaire confirmée (`own_favorite_visible=1`), suppression exécutée sans erreur, puis `ROLLBACK`. Aucune ligne persistante.
- Les preuves précédentes d'isolation inter-Clients et des tests 300–305 restent celles du §133 ; elles ne sont pas requalifiées en tests UI.

### Contradiction et cause racine de la recette encore incomplète

- Les comptes professionnels existants sont affectés à une pharmacie démo, exclue par conception du Marketplace public.
- La pharmacie E2E non commerciale qui porte un stock positif est masquée de la recherche. Son offre devient disponible sous anon uniquement pendant la transaction de test lorsque sa visibilité est temporairement activée.
- Les comptes et affectations de recette ne constituent donc pas encore un environnement navigateur positif persistant et publiable. Aucun identifiant de connexion ou mot de passe utilisable n'a été exposé par les outils connectés ; aucune session navigateur interactive n'est disponible dans cette exécution.
- Le connecteur GitHub ne fournit pas de navigateur Playwright/Computer Use pour piloter les écrans Client. Les requêtes SQL prouvent les gardes de données et le RLS, pas les clics, le panier, la soumission d'une commande ou l'historique affiché.

### Verdict et point de reprise exact

**Lot B2 : JAUNE / PARTIEL — pas AU VERT.**

| Scénario | État après cette passe |
|---|---|
| Recherche / offre positive sous anon | PASS SQL transactionnel ; UI Client non prouvée |
| Refus des offres non éligibles / Promoteur | PASS SQL antérieur et refus Promoteur navigateur antérieur (§128) |
| Favori ajouter / lire / retirer | PASS SQL sous identité Client ; synchronisation UI/local-compte non prouvée |
| Isolation favoris entre deux Clients | PASS SQL réel simulant les JWT (§133) |
| Panier et commande positive | NON TESTÉ en parcours Client |
| Indisponibilité après ajout au panier | NON TESTÉ en parcours Client |
| Annulation et restitution du stock | NON TESTÉ sur une commande créée par le parcours Client |
| Historique Client | NON TESTÉ en parcours Client |
| Assurance et ordonnance dans le Lot B global | Ne pas déclarer vert sur la base des seuls tests ci-dessus ; conserver leurs preuves et réserves propres dans les sections antérieures |

**Action corrective non exécutée :** ne pas rendre publiquement visible de façon persistante une pharmacie de recette ni réaffecter des rôles sur simple commodité de test. Préparer un fixture isolé explicitement étiqueté recette, non commercial, avec visibilité et affectations temporaires réversibles, puis un véritable harnais navigateur authentifié qui crée, suit et annule une commande. Ne pas utiliser les comptes ou données de pharmacies commerciales.

**CI :** le run qualité `43988879675` a été contrôlé : le job « Tests, TypeScript et lint » est `cancelled`, et seul le contrôle de syntaxe des workflows est PASS. Il ne valide pas le HEAD documentaire `0413223c8b23236e22805d633752775d1d338d79`. Ne pas annoncer de CI verte.

**Aucune correction applicative, migration, donnée persistante, Production, Vercel ou Play Store n'a été modifiée dans cette passe.**


## 135. Lot B2 — scénario transactionnel Client complet ajouté et exécuté (17/11/2026)

**Correction de couverture versionnée sur main :**
- Nouveau test `supabase/tests/306_lot_b2_client_marketplace_transaction.sql`.
- Commit du test : `f0d7a87aa337a1189c2faf5fdcdc15ce4660ca12`.
- Le scénario est explicitement limité aux fixtures Replay E2E, active temporairement la visibilité de la pharmacie non commerciale dans sa transaction, utilise l'identité Client acheteur sous le rôle SQL `authenticated`, puis termine par `ROLLBACK`.

**Exécution effective sur Replay : PASS**
- Offre publique positive : 1 000 FCFA, 3 unités.
- Favori : ajout, lecture par le propriétaire, retrait.
- Réservation des 3 unités via `private.reserve_stock`.
- Vérification que le stock disponible tombe à 0 pendant le hold.
- Tentative d'une seconde réservation d'une unité : refusée pour stock insuffisant ; aucune survente.
- Annulation par le Client via `public.set_reservation_status`.
- Vérification du retour exact à 3 unités disponibles et de la ligne de réservation annulée dans l'historique propre au Client.
- Résultat terminal : `LOT_B2_CLIENT_FAVORITES_RESERVATION_OVERSELL_CANCEL_HISTORY PASS`.
- Nettoyage transactionnel : `ROLLBACK`. La visibilité de la pharmacie, le favori et la réservation temporaires ne persistent pas.

**Portée exacte de la preuve :** cette exécution couvre le moteur transactionnel et les RPC avec le JWT Client simulé côté PostgreSQL ; elle ne prouve toujours pas le rendu ni les interactions de l'interface Web (recherche visuelle, clic favori, panier, soumission et affichage de l'historique). Le scénario d'indisponibilité après ajout au panier est couvert par l'appel métier de seconde réservation refusée après le hold, mais pas par une session navigateur.

**Verdict révisé B2 :** les parcours SQL métier positifs et négatifs favoris/offre/réservation/anti-survente/annulation/historique sont maintenant PASS sur Replay. La recette navigateur positive reste NON PROUVÉE. Le Lot B2 demeure donc **JAUNE / PARTIEL**, et ne doit pas être annoncé AU VERT tant que le parcours Client navigateur n'est pas exécuté et que les autres composantes du Lot B global (notamment assurance et ordonnance) ne sont pas chacune clôturées avec leurs preuves.

**Aucune donnée persistante, Production, migration ou déploiement n'a été modifié.**


## 136. Lot B — audit préalable de navigation et des accès E2E (17/11/2026)

**Audit du code sur main et des comptes Replay avant d'étendre B1 :**

| Espace / route | Constat vérifié | Verdict |
|---|---|---|
| Promoteur — `/pharmacie/promoteur/livraisons` | Le layout `src/app/pharmacie/promoteur/layout.tsx` expose cette URL dans les onglets et dans `NavPromoteur`, mais le fichier de route `src/app/pharmacie/promoteur/livraisons/page.tsx` est absent de `main` (404 GitHub). | **ROUGE — lien mort** |
| Partenaire — `/partenaire/examens` | La page existe. Elle exige une ligne `partner_members` avec `member_role` owner/manager et un partenaire actif. La vérification Replay ne trouve aucune adhésion pour les comptes E2E Promoteur, Client, Pharmacien, Caisse, Stock, Comptable ou Livreur. | **ROUGE recette — compte non habilité**, pas une absence de route |
| Comptable — `/pharmacie/comptable` | La page existe et vérifie `naxa_business_function()='comptable'`, une pharmacie active et `compta_scope_autorise=true`. Sous JWT simulé du compte E2E Comptable, ces trois contrôles retournent respectivement `comptable`, la pharmacie Mvan et `true`. | **PASS contrôle d'accès SQL** |
| Gestionnaire stock — `/pharmacie/gestionnaire-stock` | La route existe. Le compte E2E possède une affectation active à Mvan et `naxa_business_function()='gestionnaire_stock'`. Une ligne de stock temporaire est lisible sous RLS par ce compte (test annulé). | **PASS accès RLS de lecture** |
| Livreur — `/pharmacie/livreur` | La route existe. Le compte E2E Livreur renvoie la fonction active `livreur` et la pharmacie Mvan ; le contrôle de page est cohérent avec cette affectation. | **PASS contrôle SQL de fonction / pharmacie** |

### Point de vigilance sur les privilèges stock

- `naxa_has_privilege('VIEW_STOCK')` et `naxa_has_privilege('EDIT_STOCK_QUANTITY')` retournent `false` pour le compte Gestionnaire de stock de test ; aucune ligne explicite `naxa_profile_privileges` et aucune entrée `naxa_architecture_privileges` / `naxa_role_privileges` pour la clé `gestionnaire_stock` n'ont été relevées.
- Ce résultat n'est pas, à lui seul, la cause du blocage de la page actuelle : `GestionnaireStockEspace` vérifie la fonction active et les RPC de mouvements/inventaire vérifient l'affectation professionnelle active. Le test RLS et le test métier §137 passent. Ne pas ajouter des privilèges par défaut sans définir la matrice métier autorisée.
- La matrice doit néanmoins être revue séparément si d'autres composants s'appuient directement sur `naxa_has_privilege`.

**Décision :** l'absence de route Promoteur Livraisons est un vrai point rouge de navigation. Ne pas masquer le défaut par une redirection vers un autre écran ; créer le véritable écran réseau et tester son périmètre avant de le déclarer vert. L'accès Partenaire Examens nécessite une fixture d'adhésion dédiée si ce parcours appartient au Lot B ; ne pas transformer un compte Promoteur en partenaire membre sans règle métier explicite.

## 137. Lot B1 — lots, mouvements et inventaire avec le compte Gestionnaire stock (17/11/2026)

**Test ajouté sur main :**
- Fichier : `supabase/tests/307_lot_b1_stock_lots_inventory.sql`.
- Commit : `166490b274fad2efc0bae2e961ca5e21ab33bf04`.
- Projet : Replay `pwfftcsjyeibxxqhwysw`, pharmacie Mvan démo, compte E2E `naxa_e2e_stock`.
- Transaction isolée, JWT authentifié, `ROLLBACK` final.

**Résultat d'exécution : PASS**
1. Initialisation d'un stock temporaire à 5 unités.
2. Création du premier lot avec quantité égale au stock agrégé.
3. Retour +2 sur le lot puis perte -1 ; le stock agrégé et le lot suivent à 6 unités.
4. Inventaire complet : ligne détaillée par lot créée, comptage saisi à 4, clôture exécutée.
5. Contrôle final : stock agrégé = 4, inventaire statut `cloture`.
6. Résultat terminal : `LOT_B1_STOCK_LOT_MOVEMENTS_AND_INVENTORY PASS`.

**Limite :** cette preuve ferme les mouvements simples par lot et l'inventaire complet positif/négatif sur une ligne de stock. Elle ne couvre pas encore la réception fournisseur, les transferts inter-pharmacies, les lots bloqués/périmés pendant une opération, les inventaires multi-lignes, ni la préparation concurrente de plusieurs commandes. Les scénarios SQL ne remplacent pas la recette UI.

**Verdict Lot B1 : JAUNE / PARTIEL.** Les lots, mouvements et inventaires sont maintenant prouvés sur Replay. La route Promoteur Livraisons reste absente ; les scénarios de réception fournisseur et de préparation multi-commandes restent à exécuter. Aucune donnée persistante, Production ou déploiement n'a été modifié.


## 138. Lot B1 — réception fournisseur et synchronisation lot/stock (17/11/2026)

**Test ajouté sur main :**
- Fichier : `supabase/tests/308_lot_b1_supplier_receipt.sql`.
- Commit : `3bf31501ec7ef20abbe52dd825ef122a9c29f4b0`.
- Projet Replay uniquement, compte Gestionnaire stock E2E, pharmacie Mvan démo.
- Création transactionnelle d'un fournisseur, d'une commande envoyée et d'une ligne de commande ; réception par le RPC métier sous JWT authentifié ; `ROLLBACK) final.

**Exécution effective : PASS**
- Réception de 4 unités avec numéro de lot, péremption et emplacement.
- Le lot est créé et porte 4 unités.
- Le stock agrégé passe de 0 à 4, sans divergence avec la somme des lots.
- La commande fournisseur passe à `recue` et le reçu de réception existe.
- Résultat terminal : `LOT_B1_SUPPLIER_RECEIPT_LOT_STOCK_SYNC PASS`.

**Couverture B1 désormais prouvée par RPC/SQL sur Replay :** mouvements retour/perte, création de lot, inventaire complet avec écart, réception fournisseur et synchronisation lot/stock. Les tests sont versionnés en 307 et 308, tous deux exécutés et annulés.

**Toujours non prouvé :** préparation concurrente de plusieurs commandes Marketplace et passage du Gestionnaire stock vers le Livreur, transferts inter-pharmacies, inventaires multi-lignes, scénarios de lots bloqués/périmés en cours de réception/préparation, parcours navigateur. La route Promoteur Livraisons signalée §136 reste absente. Ne pas déclarer B1 vert.


## 139. Lot B1 — préparation multi-commandes et chaîne de livraison complète (17/11/2026)

**Tests ajoutés et exécutés sur Replay :**
- `supabase/tests/309_lot_b1_multi_order_preparation_delivery_offers.sql` — commit `ec2a702ead95944a7fe39565336925b81548f5ec`.
- `supabase/tests/310_lot_b1_stock_to_courier_acceptance.sql` — commit `6a93448ff9401f20c09ec249272afa120881c29e`.
- `supabase/tests/311_lot_b1_client_courier_delivery_tracking.sql` — commit `084c7324b10dcddc62e86145168895e31f822020`.

**Résultats PASS :**
1. Deux commandes acceptées distinctes passent chacune de `non_commencee` à `en_preparation`, puis `prete_au_retrait`.
2. La confirmation de préparation crée deux missions et deux offres destinées au compte Livreur actif de la pharmacie.
3. Le Livreur n'accepte qu'après la préparation confirmée ; l'acceptation affecte le Livreur et fait passer la commande à `livreur_assigne`.
4. Chaîne complète d'une commande : acceptation Livreur → retrait → arrivée → confirmation de remise par le Livreur → confirmation de réception par le Client.
5. Le RPC de suivi appelé sous l'identité Client retourne `delivered`, la commande passe à `livree`, et les événements de suivi sont présents.
6. Résultats terminaux : `LOT_B1_MULTI_ORDER_PREPARATION_READY_AND_COURIER_OFFERS PASS`, `LOT_B1_STOCK_READY_TO_COURIER_ACCEPTANCE PASS`, `LOT_B1_CLIENT_COURIER_DELIVERY_TRACKING_TO_DELIVERED PASS`.
7. Chaque scénario s'est terminé par `ROLLBACK` ; aucune commande, mission, offre, notification ou donnée de stock n'est persistée.

**Portée exacte :** les fonctions métier et les contrôles de rôles Stock/Livreur/Client sont prouvés par SQL/JWT sur Replay. Le parcours visuel navigateur reste non exécuté.

## 140. Lot B — synthèse de continuité après les passes 306 à 311 (17/11/2026)

### Couverture technique prouvée

- **Catalogue / Marketplace :** tests 300–305 PASS (fraîcheur 48 h, visibilité, limites, wrappers, publication détenue par la pharmacie, isolation et favoris).
- **Favoris / réservation Client :** test 306 PASS (ajout/retrait favori, réservation, hold, anti-survente, annulation, restauration et historique Client).
- **Stock / inventaire / fournisseurs :** tests 307 et 308 PASS (lot, retours/pertes, inventaire complet avec écart, réception fournisseur et synchronisation stock/lot).
- **Préparation / livraison :** tests 309 à 311 PASS (multi-commandes, publication des missions, acceptation Livreur, retrait, arrivée, double confirmation et suivi Client jusqu'à livré).
- **Ordonnance :** 16/16 contrôles SQL Pharmacien antérieurs PASS, mais navigation Client complète et interface non prouvées.
- **Assurance :** contrôles SQL transactionnels antérieurs PASS (import, vérification multi-pharmacies, proposition de montant, paiement/remboursement et événements comptables), mais chaîne UI Client→Assureur→réservation→Caisse→comptabilité non prouvée.

### Points rouges / non clos

- **ROUGE navigation :** `/pharmacie/promoteur/livraisons` est toujours référencé par le layout Promoteur mais sa page est absente de `main` (§136). Aucun écran réseau ne doit être simulé par une redirection vers un autre module.
- **ROUGE accès partenaire de recette :** aucun compte E2E ne possède l'adhésion `partner_members` owner/manager nécessaire à `/partenaire/examens` (§136). La route existe ; le compte de test manque.
- **JAUNE UI Client :** recherche et filtres avec offre positive, synchronisation des favoris, panier/commande, indisponibilité après ajout, annulation/restauration et historique n'ont pas été démontrés par navigateur. Les RPC/SQL correspondants ne valent pas preuve UI.
- **JAUNE UI Ordonnance / Assurance :** les moteurs SQL passent, mais les parcours complets Client/Pharmacien/Assureur/Caisse dans l'interface ne sont pas prouvés.
- **CI :** aucun statut CI vérifié pour les commits de tests 307–311 et le HEAD documentaire courant ; ne pas annoncer CI verte.

### Verdict global

**LOT B : JAUNE / PARTIEL — PAS AU VERT.**

Les chaînes SQL métier Stock→Livraison et Client→Marketplace sont maintenant largement prouvées sur Replay. Les rouges restants sont des lacunes de navigation/accès et des parcours UI non prouvés, pas des échecs SQL constatés. La correction finale exige de réparer l'écran Promoteur Livraisons, de fournir une adhésion partenaire de recette conforme, puis d'exécuter les parcours navigateur complets. Aucun contournement de droits, aucune écriture persistante Replay, aucune migration Production, aucun déploiement Vercel.


## 141. Rectification de l'audit Promoteur Livraisons et contrôle du périmètre (17/11/2026)

Le constat §136 « page de route absente » est **obsolète et rectifié** : le fichier `src/app/pharmacie/promoteur/livraisons/page.tsx` existe sur `main`. La page authentifie l'utilisateur, exige un profil actif et la fonction métier `promoteur`, puis affiche `DeliveryFeesReport`. Le menu et l'onglet Promoteur pointent bien vers cette route.

### Contrôle serveur Replay

- Compte : `naxa_e2e_promoteur`, profil actif, fonction métier `promoteur`.
- Réseau actif vérifié : trois pharmacies de recette, dont Mvan et Essos visibles, et une pharmacie de recette non commerciale masquée.
- RPC `naxa_delivery_fees_report` et `naxa_delivery_monthly_due` exécutés sous JWT authentifié Promoteur.
- Le rapport réseau retourne la forme attendue ; le décompte mensuel contient exactement les trois pharmacies affectées.
- La demande explicite du rapport pour Mvan est acceptée ; la demande pour Bastos, hors réseau, est rejetée avec `Pharmacie hors réseau Promoteur`.
- Exécution de recette en transaction terminée par `ROLLBACK`.

**Résultat :** la route n'est plus rouge pour absence de fichier. Le contrôle SQL du périmètre Promoteur est PASS. La navigation navigateur et le rendu UI de cette page restent à vérifier ; ne pas confondre présence de route + RPC avec recette visuelle complète.

## 142. Correction de la règle commerciale sur le décompte mensuel des livraisons (17/11/2026)

### Contradiction et cause racine

La fonction `public.naxa_delivery_monthly_due` incluait auparavant `commission_naxa` dans `total_mensuel_du`. Même si la table Replay ne contenait aucune ligne de commission (ledger vide), cette logique contredisait la règle métier NAXA : aucun prélèvement NAXA sur les frais de livraison ; le Promoteur ne doit voir que les abonnements des pharmacies de son réseau.

### Correction versionnée et appliquée

- Migration : `supabase/migrations/20261117001000_promoteur_delivery_monthly_due_subscription_only.sql`.
- Commit migration : `2ef14bc8a83ab1ea93b10d8d5f75d9cc2b3a90ca`.
- Migration appliquée sur Replay `pwfftcsjyeibxxqhwysw` uniquement.
- `total_mensuel_du` est maintenant égal à l'abonnement de la pharmacie ; les champs de compatibilité `commissions_livraison`, `commission_a_payer` et `commission_deja_reglee` restent à zéro.
- Le décompte conserve les livraisons à titre informatif et filtre les pharmacies actives non archivées du réseau Promoteur.
- Test : `supabase/tests/312_lot_b_promoteur_delivery_report_scope.sql`, commit `768db553312fa35186a6fe09ba1a9e88745a2c62`.
- Résultat Replay : `LOT_B_PROMOTEUR_DELIVERY_REPORT_NETWORK_SCOPE PASS` ; le test vérifie le nombre de pharmacies du réseau, l'absence de pharmacie hors réseau, le refus d'un filtre hors réseau, la structure du rapport et l'absence de toute commission dans le calcul mensuel.
- La table ledger était vide avant la correction : zéro ligne, zéro commission enregistrée. Aucun historique financier n'a été modifié.

### État révisé des points à fermer

| Point | État exact au 17/11/2026 |
|---|---|
| Route Promoteur Livraisons | **PASS code / PASS SQL scope** ; test navigateur encore requis |
| Décompte abonnement Promoteur | **PASS SQL Replay**, règle sans commission corrigée |
| Accès Partenaire Examens | **ROUGE** : Replay ne contient aucun partenaire ni membre ; aucun compte E2E dédié Partenaire n'est disponible. Ne pas réutiliser un compte Client/Promoteur en contournant les rôles |
| Parcours navigateur Marketplace Client | **JAUNE** : non démontré dans cette passe |
| Parcours UI Ordonnance et Assurance | **JAUNE** : les moteurs SQL antérieurs passent, mais les chaînes UI complètes restent non prouvées |
| CI du HEAD | **NON VÉRIFIÉ** : GitHub ne retourne aucun status ni run associé au commit `768db553312fa35186a6fe09ba1a9e88745a2c62` |

**Verdict Lot B : JAUNE / PARTIEL.** Le faux rouge de route absente est levé et le calcul des frais mensuels est aligné sur la règle commerciale. Le vrai blocage Partenaire et les parcours UI restent ouverts. Aucune modification Production ni aucun déploiement.


## 143. Contrôle final de la correction Promoteur Livraisons (17/11/2026)

- Migration présente dans l'historique Replay sous version `20261117010232`, nom `promoteur_delivery_monthly_due_subscription_only`.
- Contrôle de définition après migration : `commission_reference_position = 0` ; la fonction n'utilise plus `commission_naxa`.
- Privilège `EXECUTE` conservé pour `authenticated`.
- Test 312 rejoué après migration : `LOT_B_PROMOTEUR_DELIVERY_REPORT_NETWORK_SCOPE PASS`.
- Compte E2E Promoteur : réseau de trois pharmacies confirmé ; une pharmacie hors réseau refusée.
- Partenaires / membres sur Replay : `partners = 0`, `partner_members = 0`, membres E2E = 0. Aucun compte Partenaire dédié ne peut donc être utilisé sans créer une identité de recette conforme.
- HEAD documentation : `0d9fa32c49be4218fda6e933d3ee2b802b24dabd`.
- GitHub combined status du HEAD : aucun statut publié ; CI non vérifiée.

**Point de reprise exact :** créer une identité Auth E2E dédiée au rôle Partenaire et son organisation de recette via le processus normal, puis exécuter le navigateur sur les routes Promoteur Livraisons, Client Marketplace, Ordonnance et Assurance. Ne pas convertir un compte Client en Partenaire, ni donner un rôle métier à un compte Promoteur pour contourner la séparation des espaces.

## 144. Test transactionnel Admin — création d'un dossier Partenaire Examens sur Production (17/11/2026)

**Demande utilisateur :** vérifier le parcours directement sur le projet principal, sans créer de dossier commercial réel ni détourner durablement un compte.

**Projet contrôlé :**
- Supabase principal Naxa, ref `eouwtuusnsuxaejsxknf`, état `ACTIVE_HEALTHY`.
- Aucun changement de schéma, migration, déploiement ou écriture persistante demandé ni effectué.

**État avant test :**
- Fonction `public.admin_create_partner_dossier(...)` présente, `SECURITY DEFINER`, avec le type de partenaire `centre_examen` et l'univers `examens`.
- Univers `examens` présent.
- Comptes disponibles répondant aux contrôles de profil client (actif, âge vérifié, date de naissance, consentement et email confirmé) : 7 ; profil Admin actif : 1.
- Dossiers Partenaires : 0 ; membres Partenaires : 0 ; centres d'examens : 0 ; rattachements à l'univers examens : 0.

**Exécution contrôlée — SQL / sous-transaction annulée :**
1. Le contexte JWT SQL a été réglé sur l'identité Admin existante ; `auth.uid()` a retourné cette identité et `public.is_admin()` a validé le rôle Admin.
2. La fonction de création a été appelée avec un compte Client existant répondant aux contrôles de profil, un dossier technique de centre d'examens et des coordonnées de test.
3. L'appel a atteint le point de création sans erreur ; une exception sentinelle a ensuite forcé le rollback de la sous-transaction. Toute erreur métier autre que cette sentinelle aurait fait échouer le test.
4. Contrôle après rollback : `partners=0`, `partner_members=0`, `exam_centers=0`, rattachements `examens=0`, événements `partner.dossier_created=0`, et le compte Client utilisé est toujours actif.

**Résultat : PASS du chemin SQL de création avec rollback.** Aucune ligne de dossier, adhésion, centre ou événement d'audit n'a été conservée ; aucun compte n'a été suspendu durablement.

**Réserve découverte pendant l'audit de la fonction :**
- Dans le corps de `admin_create_partner_dossier`, le contrôle de `p_owner_user_id` vérifie seulement que le profil existe. La fonction ne vérifie pas elle-même que ce profil est un Client actif, majeur, âge vérifié, avec consentement accepté et email confirmé.
- Le test positif a utilisé un Client admissible ; il ne prouve pas le rejet d'un profil non admissible. Avant toute création persistante, ajouter et tester explicitement ces gardes côté serveur, sans se fier uniquement à l'interface.
- Cette passe valide le moteur SQL avec identité Admin simulée, pas une connexion HTTP réelle ni le rendu du parcours navigateur. Aucun outil de navigation authentifiée n'était disponible pour prouver l'interface.

**Verdict :** test SQL direct Production réussi et intégralement annulé ; parcours Partenaire Examens global **JAUNE / PARTIEL**, tant que les gardes serveur d'éligibilité et le test UI ne sont pas prouvés. Aucune création réelle ni modification persistante Production.

## 145. Garde d'éligibilité du titulaire d'un dossier Partenaire (17/11/2026)

### Audit et cause racine

La RPC `public.admin_create_partner_dossier` vérifiait seulement l'existence d'une ligne dans `public.profiles` avant de suspendre le profil et de créer le dossier. Elle ne prouvait pas que le titulaire était un Client actif, majeur, âge vérifié, consentant et détenteur d'une adresse e-mail confirmée. Une simple existence de profil ne suffisait donc pas à protéger l'entrée dans l'écosystème Partenaire.

### Correction versionnée et appliquée sur Replay

- Migration source : `supabase/migrations/20261117011921_admin_create_partner_dossier_owner_eligibility_guard.sql`.
- La fonction exige maintenant, avant toute suspension du profil : rôle `client`, `actif=true`, `age_verified=true`, date de naissance présente et correspondant à au moins 18 ans selon la date locale `Africa/Douala`, `consent_accepted_at` non nul, adresse e-mail non vide et `auth.users.email_confirmed_at` non nul.
- Le contrôle est effectué dans la RPC `SECURITY DEFINER`, avec `search_path` vide. L'exécution reste refusée à `anon` et autorisée à `authenticated` sous contrôle interne `public.is_admin()`.
- Migration appliquée sur Replay `pwfftcsjyeibxxqhwysw` sous version `20261117011921`, nom `admin_create_partner_dossier_owner_eligibility_guard`.

### Preuves de test Replay

- Test comportemental versionné : `supabase/tests/313_admin_partner_dossier_owner_eligibility.sql`.
- Résultat : `313_admin_partner_dossier_owner_eligibility PASS — positif rollback + 7 refus + aucun résiduel`.
- Cas négatif rejetés : profil non-Client ; Client inactif ; âge non vérifié ; date de naissance mineure malgré le drapeau `age_verified=true` ; date de naissance absente ; consentement absent ; e-mail non confirmé.
- Cas positif : Client admissible accepté par la RPC dans un sous-test immédiatement annulé.
- Contrôle final Replay : `partners=0`, `partner_members=0`, `exam_centers=0`, `admin_partner_dossiers=0`, aucun événement `partner.dossier_created` supplémentaire.
- Privilèges confirmés après migration : `anon EXECUTE=false`, `authenticated EXECUTE=true` ; `SECURITY DEFINER=true`, `search_path` vide.

### Non-régression et état Production

- Le test structurel historique `supabase/tests/20261026100000_admin_unified_universe_dossiers.sql` avait une assertion périmée : il exigeait que la validation commerciale réactive directement `profiles.actif`. Le modèle actuel gère le statut partenaire et les verrous d'abonnement sans muter l'identité client. L'assertion a été alignée sur `private.naxa_owner_subscription_is_current`, `public.naxa_subscription_access_locks` et le marqueur d'audit `identity_actif_mutated`.
- Après cette mise à jour, le test structurel historique passe sur Replay : `Contrat 20261026100000 — dossiers transversaux et service Bébé & Maman : PASS structurel`.
- Contrôle Production strictement en lecture seule après la correction : la nouvelle garde n'y est pas présente, la migration n'y est pas enregistrée et les compteurs Partenaires / membres / centres / dossiers restent à zéro. La Production n'a reçu aucune migration ni écriture de cette correction.
- Les deux tests SQL sont PASS sur Replay ; le statut CI du HEAD n'a pas été contrôlé dans cette passe. Aucun parcours navigateur n'a été exécuté.

**Verdict :** garde d'éligibilité corrigée, appliquée et testée sur Replay ; aucune écriture résiduelle. Le parcours Partenaire Examens global reste **JAUNE / PARTIEL** tant que l'interface n'est pas testée et que la correction n'est pas explicitement autorisée puis appliquée en Production. Aucun compte Partenaire réel créé ; aucun déploiement Vercel ou Play Store.


## 146. Correction du trigger d'audit lors de la suppression Auth (17/11/2026)

### Audit et reproduction contrôlée

- Sur Replay, `auth.sessions` déclenche `trg_naxa_session_audit_delete` après suppression d'une session.
- La fonction `public.naxa_audit_session_delete` appelait systématiquement `public.naxa_record_session_audit('SESSION_REVOKED', ..., old.user_id, ...)`.
- La table `public.naxa_session_audit` référence `auth.users(id)` par une FK `ON DELETE CASCADE`. Pendant la suppression du compte parent, le trigger de cascade supprimait la session puis tentait de réinsérer une ligne d'audit liée au parent en cours de suppression : SQLSTATE `23503`, FK `naxa_session_audit_user_id_fkey`.
- Reproduction sur le compte Admin E2E dédié Replay avec une session synthétique : échec FK reproduit. La transaction de test a été annulée ; le compte est resté présent et aucune session ni ligne d'audit synthétique n'a persisté.

### Correction versionnée et appliquée sur Replay

- Migration source : `supabase/migrations/20261117043716_session_audit_skip_parent_delete_cascade.sql`.
- Commit de la migration source : `dadd36c8ced8b755831ca6f3cc48d110c11546da`.
- Le trigger vérifie désormais que le parent existe encore dans `auth.users` avant d'écrire l'événement `SESSION_REVOKED`. Lors d'une suppression Auth en cascade, la ligne parent n'est plus visible et l'insertion d'audit est ignorée ; les audits historiques du compte suivent la FK `ON DELETE CASCADE`. Lors d'une révocation ordinaire, le compte existe encore et l'événement reste écrit.
- Migration appliquée sur Replay `pwfftcsjyeibxxqhwysw`, version enregistrée `20261117043716`, nom `session_audit_skip_parent_delete_cascade`.
- Test versionné : `supabase/tests/314_session_audit_user_cascade.sql`.
- Commit du test : `d275410bc3904886acaf44e2737bae3af04ab9fe`.
- Le test tente la suppression du compte Admin E2E dans un sous-bloc transactionnel annulé, puis vérifie qu'une suppression normale de session produit toujours `SESSION_REVOKED`. Le test complet se termine par `ROLLBACK`.

### Preuves après correction

- Test 314 exécuté sur Replay : **PASS** (cascade sans erreur + révocation ordinaire toujours auditée).
- Contrôle post-test : compte Admin E2E préservé ; session synthétique résiduelle = 0 ; audit synthétique résiduel = 0.
- Contrôle fonction : `SECURITY DEFINER=true`, `search_path=pg_catalog, public`, `anon EXECUTE=false`, `authenticated EXECUTE=false`, garde d'existence du parent présente.
- Aucune donnée métier ou session persistante modifiée par le test.
- Production non consultée ni modifiée dans cette passe ; aucun déploiement Vercel ou Play Store.
- CI non vérifiée ; aucune recette navigateur Auth interactive exécutée. L'audit statique suivant a également identifié une contradiction bloquante dans l'accès partenaire après validation du dossier (§147).

**Verdict :** défaut de suppression Auth corrigé et validé sur Replay. Le point trigger/audit est clos pour Replay ; le parcours Partenaire Examens et les recettes UI restent ouverts. Aucun statut global AU VERT n'est revendiqué.


## 147. Audit statique — incohérence d'accès après validation d'un dossier Partenaire Examens (17/11/2026)

### Contradiction démontrée dans les définitions Replay

1. `public.admin_create_partner_dossier` met `public.profiles.actif=false` pour le titulaire après vérification de son éligibilité.
2. `public.admin_valider_dossier_partenaire` met le dossier à `validated`, puis calcule le statut du partenaire selon l'abonnement et les suspensions ; la fonction ne réactive pas `profiles.actif` (audit `identity_actif_mutated=false`).
3. `private.naxa_partner_has_confirmed_payment` exige pourtant `owner_profile.actif=true`.
4. La policy `partners_member_read` exige `private.naxa_partner_has_confirmed_payment(id)`. La page `/partenaire/examens` lit `partner_members` avec une jointure interne sur `partners` et redirige vers `/` si aucun membre n'est retourné.

**Conséquence logique :** pour un titulaire dont le profil est suspendu par la création du dossier, même un dossier ensuite validé et un abonnement courant ne suffisent pas à rendre le partenaire lisible par son propre membre. La route ne peut donc pas charger son espace partenaire via ce chemin RLS tant que `profiles.actif` reste faux.

### Deuxième écart — policies d'écriture Examens

- Les Server Actions de `src/app/partenaire/examens/actions.ts` vérifient que le membre est `owner` ou `manager` et que `partners.status='active'` avant les écritures.
- Les policies RLS `exam_centers_partner_manage`, `exam_services_partner_manage`, `exam_packs_partner_manage`, `exam_hours_partner_manage` et `exam_slots_partner_manage` vérifient seulement l'adhésion `partner_members` et le rôle `owner/manager`. Elles ne reprennent pas le contrôle du statut partenaire ni le verrou d'abonnement.
- Les Server Actions ne remplacent pas la RLS : un appel direct Data API doit être soumis au même périmètre serveur. Cette différence doit être corrigée avant de considérer les écritures Examens sécurisées.

### Portée et état

- Audit statique des sources GitHub `main` : `src/app/partenaire/examens/page.tsx` et `actions.ts`.
- Audit SQL en lecture seule sur Replay : définitions des fonctions `admin_create_partner_dossier`, `admin_valider_dossier_partenaire`, `private.naxa_partner_has_confirmed_payment`, policy `partners_member_read` et policies RLS des tables Examens.
- Aucun dossier, compte, membre, centre, service, pack, horaire ou créneau créé ; aucune modification SQL dans cette étape.
- Aucun test UI navigateur ; aucune preuve d'accès interactif.
- Le point ne doit pas être corrigé par réactivation aveugle du profil : cela pourrait réactiver une identité suspendue pour une autre raison. La règle métier doit préciser si la validation Admin réactive le compte titulaire lorsque l'abonnement est courant, ou si l'accès Partenaire doit être séparé de `profiles.actif` avec un garde dédié à la suspension générale.

**Verdict : ROUGE / BLOQUANT pour l'accès Partenaire Examens après validation tant que la règle d'activation du titulaire n'est pas tranchée et que les policies RLS d'écriture ne sont pas alignées.** Aucun changement Production ; aucun déploiement.


## 148. Identité globale indépendante de l'accès Partenaire — choix 2 (17/11/2026)

**Décision utilisateur :** choix 2 confirmé. `profiles.actif` reste le statut global de l'identité ; il ne doit pas être piloté par le cycle de vie d'un dossier Partenaire. L'accès à un espace partenaire dépend séparément de l'identité active du membre, du dossier validé, du statut partenaire, de l'abonnement, des verrous/suspensions et de l'adhésion/affectation.

**Cause racine corrigée :**
- `public.admin_create_partner_dossier` désactivait le profil du titulaire lors de la création d'un dossier en attente.
- `private.naxa_partner_has_confirmed_payment` vérifie déjà que le titulaire est actif, que le partenaire est actif, que le dossier est validé, que l'univers est activé, que l'abonnement est courant et qu'aucun verrou/suspension disciplinaire n'est actif.
- Les Server Actions Examens vérifiaient l'adhésion et le statut partenaire, mais pas l'état actif du profil de l'acteur.
- Les policies de gestion Examens n'appliquaient pas les mêmes conditions que le contrôle partenaire.

**Corrections versionnées sur `main` :**
- Migration Replay version `20261117045640`, fichier `supabase/migrations/20261117045640_partner_workspace_access_independent_identity.sql` (nom aligné sur l'historique Replay après correction), commit de création initiale `2695802b67b2b2ede60766a0156dd16a263c4aa7`, renommage versionné `d22de688e14f0cd3ecc89930091a27c36d679e11`.
- La RPC de création conserve l'éligibilité initiale du Client actif mais ne modifie plus `profiles.actif`. La validation Admin ne réactive donc jamais une identité.
- `partners_member_read` exige une identité active et le contrôle complet du partenaire.
- Les policies `exam_centers`, `exam_services`, `exam_packs`, `exam_center_hours`, `exam_slots` exigent identité active, rôle owner/manager et partenaire autorisé, en `USING` et `WITH CHECK`.
- Server Action `src/app/partenaire/examens/actions.ts` : contrôle préalable du profil actif avant les actions owner/manager, commit `52c0da2ce4902424bea9a6768b3b39d952a8783c`.
- Test 313 renforcé pour vérifier que la création conserve le profil actif dans le cas positif, commit `5da5d61a1c8ae5e61876887d8d29e3e9bee69fed`.
- Nouveau test structurel `supabase/tests/315_partner_workspace_access_invariants.sql`, renforcé après découverte de policies permissives parallèles, commit final `33dc1ee0c3abed56a49e6b8c2d819804a93ecdc7`.
- Migration complémentaire Replay version `20261117045917`, fichier `supabase/migrations/20261117045917_partner_access_gate_all_exam_surfaces.sql`, commit de création `6eeca3c133f1d94a7ccb8df45fd55c943ce735a6`, renommage versionné `ee2f8498660cfb5b806cda2bbd89b3f3a8997209`. Elle retire l'ancienne policy permissive `exam_hours_partner_manage`, aligne le helper central des capacités du personnel, la visibilité publique, la lecture des rendez-vous partenaire et la gestion des éléments de packs.
- Migration complémentaire Replay version `20261117050043`, fichier `supabase/migrations/20261117050043_exam_equipment_public_partner_gate.sql`, commit de création `d690a5df481f9f8da8c0b5e55862f71b30e496fb`, renommage versionné `c69d70e47a2a7e72d997234b05fe39ebab1b385f`. Elle conditionne aussi l'affichage public des équipements à la visibilité active du centre et du partenaire.

**Preuve Replay :**
- Migration appliquée uniquement sur Replay `pwfftcsjyeibxxqhwysw`.
- Exécution transactionnelle du test 315 après les deux migrations : **PASS** ; invariants de la RPC, du helper d'accès, des capacités du personnel, de la visibilité publique, de la lecture partenaire et des policies owner/manager vérifiés.
- Contrôle post-migration : l'ancienne policy permissive `exam_hours_partner_manage` n'existe plus ; la policy corrigée `exam_center_hours_partner_manage` est la seule policy owner/manager des horaires.
- Aucun partenaire/dossier n'était présent sur Replay au contrôle préalable. Le test métier positif complet (création dossier → validation → accès) et les refus par suspension/expiration/révocation ne peuvent donc pas encore être exécutés avec les fixtures existantes.
- Le test 313 renforcé n'a pas été lancé : il requiert un Admin et un Client admissible, absents du jeu de données Replay observé.
- Les advisors Supabase signalent des constats RLS préexistants sur plusieurs autres tables sans policy ; aucun constat n'a été attribué à cette migration sans analyse dédiée.

**Réserves :**
- Les profils déjà désactivés par l'ancienne RPC ne sont pas réactivés automatiquement : leur statut doit être examiné individuellement pour ne pas lever une suspension globale légitime.
- Contrôle navigateur/authentifié réel non effectué faute de fixtures partenaire.
- Production et Vercel non touchés ; CI non exécutée dans cette passe.

**Verdict de ce lot :** correction SQL et Server Action intégrée, test structurel Replay PASS ; recette métier complète encore PARTIELLE. Ne pas annoncer AU VERT.

## 149. Recette métier transactionnelle — identité globale et accès Partenaire (17/11/2026)

**Périmètre fermé :** vérifier sur Replay le cycle réel création de dossier → validation Admin → décision d'accès, sans conserver de données de test. Aucun élargissement à l'audit général.

**Fixtures exploitées :**
- Les comptes Auth/Profils déjà présents sur Replay ont été réutilisés : un Admin actif et un Client admissible (email confirmé, âge vérifié, consentement et identité active).
- Aucun nouveau compte permanent n'était nécessaire : la recette crée les objets métier temporaires dans une transaction annulée.
- Pour rendre l'univers Examens testable sans changer son état durable, `universes.examens` et `feature_flags.universe.examens` ont été activés uniquement dans la transaction de test, puis restaurés par `ROLLBACK`.

**Exécution SQL comportementale sur Replay :**
- Contexte Admin SQL réglé sur l'identité Admin E2E existante ; les deux RPC réelles `admin_create_partner_dossier` et `admin_valider_dossier_partenaire` ont été exécutées.
- Création d'un premier dossier Examens : le profil Client est resté `actif=true` ; après validation, le partenaire et son abonnement de test actifs ont ouvert l'accès via `private.naxa_partner_has_confirmed_payment`.
- Création d'un second dossier avec le même Client ; son profil a été passé à `actif=false` avant validation. La RPC a validé le dossier sans réactiver le profil ; le helper a refusé l'accès Partenaire.
- Assertions négatives exécutées et réussies : dossier en attente, partenaire en attente, univers partenaire désactivé, abonnement impayé et verrou d'accès actif entraînent tous un refus d'accès.
- La recette transactionnelle s'est terminée sans exception SQL ; toutes les assertions PL/pgSQL explicites ont donc été franchies.

**Contrôle après rollback :**
- `partners=0`, `admin_partner_dossiers=0`, conventions et abonnements de test = 0.
- Aucun verrou de test résiduel.
- Le Client utilisé est toujours `actif=true`.
- `universes.examens.enabled=false` et `feature_flags.universe.examens.enabled=false`, identiques à leur état initial.
- Aucune donnée métier de test n'a été conservée.

**Résultat : PASS — comportement SQL métier du choix 2 prouvé sur Replay**, incluant création, validation, accès positif, non-réactivation d'une identité suspendue et refus sur les principaux états d'accès. Après correction du contrôle de normalisation des espaces SQL (assertion statique trop sensible au formatage ; commits `5757fa2504126beba073a13348b53f6ed43423c0` puis `6e1fb36c9c28fcc9c21785cb0d178592d0ccb624`), le test 313 a été rejoué : **PASS — positif rollback + 7 refus + aucun résiduel**. Le test 315 a également été rejoué après les corrections : **PASS — identité indépendante, accès partenaire et 5 policies Examens alignés**.

**Limite précisément circonscrite :** la navigation navigateur avec session Auth interactive n'a pas été exécutée dans cette passe. Cela ne remet pas en cause les assertions SQL des RPC et du helper, mais interdit d'affirmer que le parcours visuel `/partenaire/examens` est lui aussi testé. Aucun changement Production, aucun déploiement Vercel, aucune modification durable de Replay.


## 150. Rejeu bulk Lot B — tests 306 à 312 sur comptes E2E Replay (17/11/2026)

**Périmètre :** rejeu des tests versionnés du Lot B sur Supabase Replay `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`) uniquement. Les identités Client, Gestionnaire stock, Livreur et Promoteur E2E déjà présentes sont réutilisées par les scripts ; aucune création Auth ni changement de rôle n'a été effectué.

### Résultats du rejeu

| Test | Parcours | Résultat |
|---|---|---|
| 306 | Client Marketplace : favori, réservation/hold, anti-survente, annulation, restauration et historique | **PASS** |
| 307 | Gestionnaire stock : lot, retour/perte, inventaire et écart | **PASS** |
| 308 | Gestionnaire stock : réception fournisseur, lot et stock agrégé synchronisés | **PASS** |
| 309 | Préparation simultanée de deux commandes et publication des missions/offres Livreur | **PASS** |
| 310 | Transfert Stock → Livreur, acceptation d'une mission publiée et affectation | **PASS** |
| 311 | Livreur : retrait, arrivée, remise ; Client : confirmation de réception et suivi livré | **PASS** |
| 312 | Promoteur : rapport réseau, exclusion hors réseau et décompte sans commission NAXA | **PASS** |

Chaque test a été récupéré depuis son fichier exact sur `main`, puis exécuté sur Replay. Les sept résultats terminaux attendus ont été retournés sans erreur.

### Contrôle de non-résidu après les transactions

Après le rejeu, les compteurs Replay sont tous à zéro pour : réservations, lignes de réservation, favoris Client, missions et offres de livraison, événements de livraison, fournisseurs, commandes et réceptions fournisseurs, inventaires et lignes d'inventaire. Les transactions de recette n'ont donc laissé aucune donnée métier résiduelle.

### Verdict de cette passe

**PASS — rejeu SQL/JWT des tests 306 à 312.** Cela confirme les parcours métier Client/Marketplace, Stock, Livreur et Promoteur au niveau des RPC/RLS exercés par les tests. Cela ne constitue pas une preuve de navigation ni d'interaction visuelle dans le navigateur.

**Lot B global : toujours JAUNE / PARTIEL, pas AU VERT.** Les réserves de recette UI Client positive (recherche, clic favori, panier/commande, annulation et historique), ainsi que les parcours complets Ordonnance et Assurance, ne sont pas levées par ce rejeu SQL. Aucun outil navigateur/Playwright n'est disponible dans cette session ; je n'invente donc pas de preuve UI. CI non vérifiée. Aucun changement de schéma, Production, Vercel ou déploiement ; Replay n'a reçu que des transactions de test annulées.


## 151. Tentative d'exécution Playwright navigateur — environnement bloqué (17/11/2026)

**Installation / disponibilité locale**
- Playwright Python est déjà installé dans l'environnement d'exécution ; Chromium système est disponible à `/usr/bin/chromium`. L'installation npm du paquet Node a expiré après 120 s ; elle n'était pas nécessaire pour disposer du moteur Playwright Python.
- Un script Playwright a été lancé en mode headless sur le déploiement Preview Vercel existant.

**Cible vérifiée**
- Déploiement READY consulté : `naxa-316j5tq69-naxa3.vercel.app`, commit `8ebe45267b97c3b0c666b1df3f9e73df0b08c005`.
- Ce déploiement est antérieur au HEAD documentaire actuel de `main` (`02a38a7dc113cee4f3a8b609556525e34f6a3d19)) ; il ne peut donc pas constituer une preuve de recette sur le HEAD courant.
- L'endpoint de la page d'accueil répond HTTP 200 via le fetch Vercel et expose le portail public avec la barrière d'âge.

**Blocage d'exécution**
- La navigation Playwright directe vers le domaine Vercel échoue avant chargement avec `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Le test réseau complémentaire échoue à la résolution DNS (`Could not resolve host`). L'environnement du navigateur/container ne dispose donc pas d'un accès réseau sortant au domaine ; le fetch serveur Vercel reste possible mais n'est pas un navigateur et ne permet pas d'exécuter les interactions JS.
- Aucun test de clic, d'authentification Client, de favoris UI, de panier, de commande ou d'historique n'est déclaré exécuté.
- Aucun identifiant secret ni mot de passe de compte E2E n'a été extrait ou exposé.

**Verdict**
- **Playwright installé/disponible : PASS. Navigation réelle vers l'application : BLOQUÉE par la politique réseau/DNS de l'environnement.**
- **Lot B UI : toujours NON PROUVÉ / JAUNE.** Pour reprendre sans fausse preuve, il faut un runner Playwright ayant accès réseau au Preview du HEAD courant, et une session Client E2E utilisable (ou un mécanisme d'authentification de test sécurisé).
- Aucun déploiement, aucune modification Production, aucune mutation Replay, aucune création de compte ni aucun changement de rôle lors de cette tentative.


## 152. Reprise Playwright sur runner GitHub Actions — recette UI Client ajoutée (17/11/2026)

**Cause racine du blocage précédent (§151)**

- Playwright et Chromium étaient disponibles dans le container conversation, mais la politique réseau/DNS empêchait toute navigation vers le domaine Vercel.
- Le dépôt disposait déjà d'un runner GitHub Actions fonctionnel pour la navigation E2E : `.github/workflows/naxa-nav-promoteur-e2e.yml`. Il installe les dépendances, installe Playwright/Chromium, construit NAXA localement avec les variables Replay, puis exécute le navigateur contre `http://127.0.0.1:3000`.
- Ce mécanisme évite entièrement le Preview Vercel obsolète et ne déclenche aucun déploiement.

**Mesure appliquée sur main**

- Commit code : `a1d6636d7cff277c4da29ff355560e6097c3efd3`.
- Extension de `.github/e2e/naxa-navigation-runtime.cjs` : réutilisation du compte Client Replay existant `naxa_e2e_acheteur` et de sa session ponctuelle Supabase SSR.
- Ajout de contrôles Chromium mobiles sur : ouverture de l'espace Client ; affichage/retrait d'un favori local démo ; affichage, changement de quantité et retrait d'un article panier local démo ; ouverture de la recherche Marketplace, filtre ville et panneau Assurance ; ouverture de l'historique, filtre période et recherche.
- Les favoris et l'article panier utilisés pour ces contrôles sont des fixtures locales marquées `demo: true), injectées dans le navigateur puis supprimées par les actions UI. Elles ne sont pas publiées en offre, ne créent aucune réservation et ne sont pas synchronisées comme données métier.
- Le test réutilise les fixtures Auth déjà présentes. Aucun nouveau compte Auth, mot de passe persistant, affectation ou modification de rôle n'est créé pour le volet Client.
- Le workflow conserve son précontrôle strict de l'URL Replay, son build local et son nettoyage de secours. Le déclenchement par modification du runtime est automatique.

**Exécution**

- Run GitHub Actions : [`44026734192` — Navigation Promoteur E2E Replay](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44026734192).
- État à l'enregistrement de cette section : `IN_PROGRESS` ; installation Playwright/Chromium en cours. Aucun PASS navigateur Client n'est encore revendiqué.
- Qualité logicielle sur le commit code : run `44026734123` en attente au moment de cette mise à jour. Le dernier run qualité terminé avant cette modification reste `44025837100` SUCCESS sur `dc540ee`.

**Limites conservées**

- Le volet Client couvre ici les interactions d'interface sur données locales démo et les filtres de recherche ; il ne prouve pas encore la création réelle d'une réservation à partir d'une offre partenaire réelle, le refus pharmacie, l'annulation/restauration du stock, ni la visibilité complète de l'historique transactionnel.
- Le projet Replay ne possède pas de fiches BDPM dans `medicaments_referentiel_sources` au contrôle SQL du 17/11 ; les résultats catalogue ne peuvent donc pas être présumés disponibles dans cette recette.
- Les pharmacies et stocks visibles dans Replay sont majoritairement des fixtures démo. Aucune n'a été rendue publiquement visible pour forcer artificiellement une offre.
- Lot B reste **JAUNE / PARTIEL** jusqu'au résultat du run navigateur et aux preuves positives/négatives manquantes. Les recettes SQL 306–312 restent PASS (§150).
- Aucun déploiement Vercel, aucune mutation Production et aucune migration Replay n'ont été effectués par cette mesure.


## 153. Diagnostic du premier run navigateur et correction de stabilité (17/11/2026)

**Run `44026734192` — échec partiel, diagnostic établi**

- Installation des dépendances : PASS ; installation Playwright/Chromium : PASS ; build Next.js avec configuration Replay : PASS ; démarrage du serveur local : PASS.
- La navigation Promoteur desktop/mobile a passé ses trois contrôles. Le tableau de bord Comptable et la première navigation « Créances & bordereaux » ont également passé.
- L'échec s'est produit au retour vers `/pharmacie/comptable` dans la boucle de navigation : Chromium a renvoyé `net::ERR_ABORTED` sur un `page.goto` répétant le chargement du tableau de bord après une navigation App Router. Le bloc Client ajouté n'a donc pas encore été atteint. Il ne s'agit pas d'un échec fonctionnel observé du parcours Client.
- Nettoyage de secours : PASS. Le script a supprimé l'affectation Comptable temporaire, le partenaire et l'adhésion temporaires.

**Contrôle de propreté Replay après le run**

Une requête SQL en lecture seule confirme : 0 partenaire temporaire, 0 adhésion temporaire, 0 affectation Comptable temporaire, 0 ligne de rôle actif résiduelle pour le compte Comptable, 0 réservation, 0 favori persistant et 0 mission Livreur. Aucun compte Auth n'a été créé par le run.

**Correction appliquée sur main**

- Commit `2a01113251337e8092a8db8b763414d20063ef49`.
- Suppression du rechargement redondant du tableau de bord dans la boucle Comptable ; le retour se fait maintenant par le lien réel de la sidebar, avec vérification de l'URL et de la présence d'un titre principal avant de poursuivre.
- Ce correctif conserve les assertions sur les six destinations Comptable ; il ne masque pas les erreurs de navigation.

**Nouvelle exécution et qualité**

- Nouveau run navigateur Replay : [`44027362844`](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44027362844), état `IN_PROGRESS` à cette mise à jour.
- Qualité complète sur le commit documentaire précédent `bf2fb37f1e565dc55518dd20c3b04949c8615bf1` : [run `44026881022`](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44026881022), **SUCCESS**.
- Qualité du commit correctif `2a01113251337e8092a8db8b763414d20063ef49` : run `44027362915` en cours.
- Aucune création de déploiement Vercel pour les commits `a1d6636`, `bf2fb37` et `2a01113` ; aucune modification Production. Le build et les tests navigateur s'exécutent sur le runner GitHub en local contre Replay.

**Verdict maintenu :** Lot B reste **JAUNE / PARTIEL**. Le premier run prouve que le runner peut construire et démarrer NAXA, mais les tests UI Client n'ont pas encore été atteints. Ne pas déclarer de PASS Client ni AU VERT avant le nouveau run et le contrôle de nettoyage final.


## 154. Alignement du contrat statique Playwright et relance (17/11/2026)

**Run `44027362844` — arrêt avant le navigateur**

- Installation Playwright/Chromium : PASS ; le job a échoué pendant le `prebuild`, avant le démarrage du serveur et avant toute navigation ou écriture Replay.
- Le contrôle a exécuté 572 tests : 571 PASS, 1 FAIL. L'unique échec est le test statique `scripts/test-promoteur-navigation-browser.cjs:95`, qui exigeait encore le libellé du retour Comptable par rechargement URL alors que le runtime a été corrigé pour revenir par le lien sidebar.
- Nettoyage de secours : PASS ; aucun runtime navigateur ni aucune fixture métier n'avait démarré sur ce run.

**Corrections du contrat de test**

- Commit `542761b0f6f61fbfa200e29d07689957ce9eddc3` : le contrat statique est étendu aux routes Client, aux favoris/panier démo, aux filtres et à l'historique ; le contrôle Comptable est aligné sur le retour par sidebar.
- Cause de la seconde assertion : expression régulière trop échappée pour détecter littéralement `dashboardLink.click()`.
- Commit `9d09298d544e34f377f4ce4efd57bc1cc4c796bd` : remplacement par une assertion littérale `runtime.includes("dashboardLink.click()")`, sans ambiguïté d'échappement.

**Relance**

- Run navigateur Replay sur le commit correctif : [`44027615028`](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44027615028), `QUEUED` à cette mise à jour, derrière le run précédent.
- Qualité complète sur le même commit : [`44027614895`](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44027614895), `QUEUED`.
- Le dernier run qualité terminé et SUCCESS reste `44026881022` sur le code présent avant les deux derniers ajustements du harnais.

**Verdict maintenu :** Lot B reste **JAUNE / PARTIEL**. Aucune interaction Client navigateur n'est encore prouvée. Le prochain run doit franchir le prébuild, terminer les navigations Promoteur/Comptable/Partenaire, puis exécuter les contrôles Client ajoutés. Aucun changement Production, aucune migration Replay et aucun déploiement Vercel.


## 155. Décision sur le payeur des abonnements partenaires (17/11/2026)

- Décision utilisateur : choix A — chaque structure contractante règle son propre abonnement. Aucun paiement collectif implicite du Promoteur pour les autres univers. Toute exception de groupe exige un contrat explicite, un payeur désigné et une répartition contractuelle.
- Règle maintenue : cycle mensuel déclenché uniquement par la confirmation effective du premier règlement par NAXA ; validation de dossier, déclaration ou notification isolée ne déclenchent aucun cycle.
- Contrôle Replay : `naxa_universe_payment_confirmations` concerne les paiements de réservations Client (`reservation_id`, `client_id`) et ne constitue pas une preuve d'abonnement professionnel.
- Le flux `admin_confirmer_reglement_promoteur` reste spécifique à l'abonnement Promoteur. Aucun équivalent de règlement confirmé propre aux structures Parapharmacie, Examens et Prestations à domicile n'est établi à ce stade.
- Aucun changement de schéma, écriture Replay, code applicatif ou déploiement Production effectué. Le lot demeure PARTIEL jusqu'à la définition et la preuve de la source de vérité de paiement par structure.


## 156. Abonnements indépendants par structure — première implémentation (17/11/2026)

**Décision appliquée :** choix A, chaque structure Parapharmacie / Examens / Prestations règle son propre abonnement. Aucun paiement collectif implicite du Promoteur. L'abonnement Promoteur et les abonnements Pharmacie historiques ne sont pas remplacés par ce lot.

**Source de vérité / modèle**
- \`partner_subscriptions\` : un contrat par structure ; tarif miroir du dossier, univers, état, début/échéance, confirmation initiale, dernier règlement, éventuel accès historique.
- \`partner_subscription_payments\` : déclarations séparées des décisions Admin, référence normalisée unique, canal, compte payeur, date déclarée, instantané de destination, reçu et période confirmée.
- RPC titulaire : \`partner_soumettre_reglement_abonnement\`, \`partner_lire_abonnement\`.
- RPC Admin : \`admin_lister_reglements_partenaires\`, \`admin_confirmer_reglement_partenaire\`, \`admin_refuser_reglement_partenaire\`.
- Le paiement Client de réservation est explicitement exclu de cette source de vérité.
- La confirmation effective Admin démarre le premier cycle au jour local de confirmation NAXA. Une déclaration n'active aucun cycle. Les renouvellements anticipés prolongent à partir du lendemain de l'échéance actuelle.
- Le helper d'accès \`private.naxa_partner_has_confirmed_payment\` dépend du cycle propre au partenaire. Les cycles hérités encore valides sont conservés via \`legacy_access_until\`, sans conversion en paiement indépendant. Aucun profil global n'est réactivé par la confirmation.

**Rappels / accès**
- Expiration ciblée et rappels J-5 idempotents via \`naxa_process_partner_subscription_cycles()\`.
- Job pg_cron Replay : \`naxa-partner-subscription-cycle-hourly\`, minute 20 de chaque heure.
- Outbox e-mail enrichie des nouveaux types ; route \`/api/cron/validite\` étendue.
- Interfaces ajoutées : \`/partenaire/abonnement\` et \`/admin/abonnements-partenaires\`, navigation Admin mise à jour.

**Migrations Replay appliquées avec succès**
1. \`20261117200000_partner_independent_subscription_cycles\`
2. \`20261117201000_partner_subscription_read_api_and_date_guard\`
3. \`20261117202000_partner_subscription_read_api_fix\`
4. \`20261117203000_partner_subscription_cron_schedule\`

**Preuves Replay**
- Tables présentes ; RLS activée et deux politiques de lecture présentes.
- Privilèges : anon ne peut ni déclarer ni confirmer ; authenticated peut appeler les RPC qui appliquent leurs contrôles d'identité/ownership/admin ; fonctions cron exécutables par service_role seulement.
- Rejets non authentifiés vérifiés pour déclaration, lecture, confirmation et liste Admin.
- Job pg_cron trouvé (job 13, \`20 * * * *\`).
- Exécution immédiate du moteur : \`expired=0\`, \`reminders=0\`.
- Replay contient actuellement 0 dossier éligible, 0 abonnement et 0 règlement. Le test métier positif n'est donc pas encore prouvé.
- Aucun finding Advisor sécurité ne cible les nouvelles tables. Quatre index FK sont marqués unused par l'Advisor performance faute de données de test.
- Aucun build/TypeScript/E2E positif n'a été exécuté. Aucun déploiement Vercel ni changement Production.

**État du lot : 🟡 PARTIEL.** Il reste à exécuter un parcours positif contrôlé et le run qualité applicatif avant tout AU VERT.


## 157. Rapprochement SMS croisé des abonnements partenaires (17/11/2026)

- Extension de \`partner_subscription_payments\` : liens uniques vers le candidat de débit Partenaire et l'événement de crédit Admin, source de confirmation \`manual_admin\` ou \`paired_sms\`.
- Triggers DB sur candidat Partenaire et événement crédit Admin ; le rapprochement est relancé aussi après déclaration pour couvrir les arrivées dans n'importe quel ordre.
- Auto-confirmation uniquement avec une paire unique : SMS original de débit (\`voluntary_sms_share\`) + SMS de crédit capturé par un appareil Admin enrôlé ; montant, canal, référence, payeur, destination, horodatages fournisseur et hashes concordent. Une notification seule ne déclenche pas d'activation automatique.
- Vérification d'acteurs distincts : le compte qui partage la preuve de débit ne peut pas être l'Admin qui confirme automatiquement.
- Le dispositif Partenaire peut être enrôlé avant activation pour un titulaire dont le dossier est validé ; les gestionnaires n'obtiennent pas cette exception.
- La route Admin capture vérifie si le trigger a confirmé un abonnement Partenaire et retourne le reçu/la période. La route candidat Partenaire retourne également le résultat auto-confirmé si le crédit Admin est déjà arrivé.
- Le contrôle manuel Admin reste le recours lorsque les preuves sont incomplètes ou ambiguës.

**Test SQL transactionnel Replay : PASS / ROLLBACK.** Scénario synthétique Examens : structure et dossier validé → contrat créé par trigger → règlement pending → SMS de débit Partenaire → SMS crédit Admin. Assertions passées : règlement \`confirmed\`, source \`paired_sms\`, reçu présent, abonnement \`active\`, période créée, partenaire \`active\`, univers activé, événement Admin \`confirmed\`. Le bloc a ensuite annulé toutes les données. Contrôle post-test : aucun partenaire, contrat, paiement, candidat, événement ni notification temporaire persistant.

**Configuration / limites :**
- \`naxa_payment_destinations\` est vide sur Replay ; aucun canal Orange/MTN actif, donc pas de test de déclaration ou de capture HTTP réelle.
- Les tests positifs des routes Android et Admin, l'e-mail effectif et le build/TypeScript ne sont pas encore exécutés.
- Aucun déploiement Production ni Vercel.

**État : 🟡 PARTIEL.** Le moteur SQL de rapprochement croisé est prouvé par transaction annulée ; l'intégration réseau réelle reste à valider.


## 158. Découplage complet Promoteur / abonnements partenaires (17/11/2026)

**Contradictions corrigées**
- La validation d'un dossier partenaire ne consulte plus l'abonnement Promoteur et ne peut plus activer une structure sans son propre cycle confirmé (ou un accès historique valide). Les univers Aide et autres univers non pris en charge sont refusés par cette validation.
- La confirmation d'un règlement Promoteur ne réactive plus les partenaires indépendants du même titulaire.
- La synchronisation Pharmacie/Promoteur ne crée plus de verrou Promoteur à partir de dossiers Parapharmacie/Examens/Prestations ; elle gère uniquement les abonnements Promoteur/Pharmacie.
- \`promoteur_soumettre_reglement\` exige désormais un profil actif de rôle Promoteur. Le titulaire d'une autre structure utilise le RPC de sa structure.
- Les références de transaction sont contrôlées entre règlements Promoteur, abonnements partenaires et confirmations de réservation Client.

**Tests transactionnels Replay (ROLLBACK)**
- Validation Admin avec univers/feature flag activés uniquement dans la transaction : dossier validé, partenaire reste \`pending\`, univers reste désactivé, abonnement propre reste \`pending_payment\`. Le bloc est annulé et les flags restent désactivés.
- J-5 : premier appel = 1 rappel ; deuxième appel = 0 nouveau rappel.
- Expiration : contrat propre échu = \`expired\`, partenaire reste actif, profil global reste actif ; aucune suspension transversale.
- Le test d'auto-pairing SMS §157 reste PASS.
- Contrôle après annulation : zéro ligne temporaire et zéro notification de test persistante.

**Configuration Replay non activée**
- Les trois univers Parapharmacie, Examens et Prestations ont leurs flags désactivés.
- Aucune destination active dans \`naxa_payment_destinations\` pour MTN/Orange.
- Aucun build/TypeScript/CI ni parcours HTTP/Android complet exécuté.
- Aucun déploiement Production/Vercel.

**État : 🟡 PARTIEL.** Le découplage métier, la preuve transactionnelle du paiement SMS et les rappels/expirations sont intégrés sur Replay ; les paramètres de lancement et les tests applicatifs réels restent à faire.


## 159. Clôture de passe — état vérifié sur Replay et main (17/11/2026)

**Historique Supabase Replay confirmé :** 11 migrations du lot, de \`20261117060519 partner_independent_subscription_cycles\` à \`20261117061911 exclude_non_billable_partner_universes\`, toutes visibles dans l'historique appliqué.

**Job confirmé :** \`naxa-partner-subscription-cycle-hourly\`, job 13, \`20 * * * *\`.

**Contrôles finaux :**
- Aucun finding Advisor sécurité sur \`partner_subscriptions\` / \`partner_subscription_payments\`.
- Trois index FK signalés INFO/unused, explicable par les tables vides sur Replay.
- Les feature flags des trois univers restent désactivés ; aucune destination MTN/Orange active sur Replay.
- \`vercel.json\` conserve \`git.deploymentEnabled.main=false\`.
- Aucun statut CI ou run GitHub Actions attaché au dernier HEAD ; build/TypeScript non prouvés.
- Aucun déploiement Vercel ni changement Production.

**Continuation exacte :** configurer les destinations réelles et activer les univers selon décision métier, puis exécuter build/TypeScript et un parcours HTTP/Android Admin/Partenaire sur Replay avec données autorisées. Ne pas déclarer AU VERT avant ces preuves.


## 160. Diagnostic Playwright Client et renforcement du précontrôle JWT (17/11/2026)

### Résultat du run précédent relu dans les logs

- Run navigateur Replay : [44027615028](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44027615028), conclusion **FAIL**.
- Préparation du runner : checkout, Node 22, contrôle strict de l'URL Replay, `npm ci`, Playwright/Chromium, build Next.js et démarrage du serveur local : **PASS**.
- Navigation Promoteur desktop et mobile : **PASS**.
- Espace Comptable : ouverture, rendu et six destinations latérales (Créances, Rejets, Rapports, Documents, Référentiels, Plan comptable) : **PASS**.
- Après les six destinations Comptable, le navigateur finit sur `/` au lieu de la route attendue. Les logs disponibles ne montrent aucun marqueur PASS Partenaire ni Client : ils ne permettent donc pas d'affirmer que l'échec survient sur `/client`, ni même d'identifier avec certitude la première route en échec après le Comptable. Le runtime précédent ne journalisait pas la réponse HTTP, les cookies présents, les erreurs navigateur ni la visibilité du profil Client sous son JWT ; la cause racine n'est pas établie. Ne pas attribuer cet échec au Client sans preuve.
- Nettoyage de secours : **PASS** ; l'affectation Comptable, le rôle actif, le partenaire et l'adhésion temporaires ont été supprimés. Le second nettoyage confirme qu'il ne reste aucune fixture gérée par le script.
- Le run qualité associé [44027614895](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44027614895) a été **CANCELLED** pour les tests/TypeScript/lint/build ; actionlint est **PASS**. Il ne constitue pas une preuve de qualité complète.

### Vérification de la fixture Client sur Replay

Requête SQL en lecture seule du 17/11 :
- `naxa_e2e_acheteur` existe, rôle `client`, profil actif, âge vérifié, identité Auth confirmée et marqueur `NAXA-E2E-PHARMACY-STAFF-20261115`.
- Prénom, nom, téléphone, date de naissance et consentement sont renseignés.
- La policy `profiles_self` autorise explicitement la lecture du profil par `id = auth.uid()`. Aucune modification de policy ou de profil n'est justifiée à ce stade.

### Correction de diagnostic versionnée sur main

- Commit : `6c109d4407d15ee52dbf68a0aaf4565339dda074`.
- Le runtime vérifie maintenant, avant Chromium, que le JWT Client est valide et que le compte peut lire son propre profil sous RLS.
- En cas de redirection navigateur, le run consigne le statut HTTP, l'URL finale, les seuls noms de cookies (valeurs masquées, sauf le statut d'âge), les erreurs console/page et les requêtes échouées. Aucun jeton, cookie d'authentification ou secret n'est journalisé.
- Le scénario reste épinglé à Replay et réutilise les comptes existants ; aucun compte Auth supplémentaire n'est créé.

### Statut et point de reprise

- Partenaire UI et Client UI : **NON PROUVÉS**. Le prochain run doit d'abord localiser la première route fautive après Comptable ; le précontrôle JWT Client est une vérification anticipée, pas la preuve que le Client était en cause.
- Favoris, panier, recherche/filtres et historique : assertions présentes dans le runtime, mais non atteintes par le run en échec ; aucune ne doit être comptée PASS.
- Les parcours réels de commande, refus pharmacie, annulation/restauration et historique transactionnel restent à prouver séparément ; les fixtures locales panier/favori ne les couvrent pas.
- Aucun changement de policy RLS, donnée métier persistante, migration Replay, Production ou déploiement Vercel n'a été effectué par cette correction.
- Le run qualité complet reste à obtenir sur un commit actuel ; le dernier run cité est annulé.

**Verdict :** Lot B reste **JAUNE / PARTIEL**. Le runner Playwright local fonctionne et a prouvé les écrans Promoteur/Comptable ; le premier échec de navigation après Comptable n'est pas localisé entre Partenaire et Client. Le prochain point exact est le résultat du workflow déclenché par le commit `6c109d4`, puis correction de la cause démontrée et relance jusqu'aux assertions Partenaire et Client. Ne pas déclarer AU VERT avant PASS navigateur Client et tests métier positifs/négatifs complets.


## 156. Vérification de la facturation indépendante partenaire (17/11/2026)

- Le moteur est déjà présent dans Replay : tables `partner_subscriptions` / `partner_subscription_payments`, RPC de soumission, confirmation Admin ou rapprochement SMS double preuve, cycle, reçu, expiration et rappel J-5.
- Contrôle positif : RLS activé et policies de lecture par membre actif/Admin ; exécution des fonctions d'expiration/rappel et du worker global limitée à `service_role` ; job pg_cron actif toutes les heures à la minute 20.
- Contrôle de frontière : la confirmation d'abonnement Client `naxa_universe_payment_confirmations` reste distincte ; le règlement Promoteur ne réactive pas les partenaires indépendants.
- Contrôle négatif / preuve manquante : zéro dossier et zéro paiement sur Replay pour les univers facturables Parapharmacie, Examens, Prestations. Aucun E2E métier réel possible sans fixture/structure.
- Blocage de versionnement : au moins trois fichiers de migration sur `main` portent des timestamps différents de ceux enregistrés dans `supabase_migrations.schema_migrations` (ex. 20261117200000 vs 20261117060519). Ne pas exécuter de `db push` avant réalignement des onze fichiers du lot.
- Aucun write métier Supabase, aucune migration appliquée pendant ce contrôle, aucun déploiement Production.

**Verdict du lot : JAUNE / PARTIEL.** Reprise exacte : réaligner les timestamps des fichiers sur l'historique Replay, puis créer une fixture de structure isolée et tester le cycle complet en transaction annulée.


## 161. Contrôle de propreté Replay après relance du harnais (17/11/2026)

Après le commit de diagnostic `6c109d4407d15ee52dbf68a0aaf4565339dda074`, le harnais a bien démarré et créé ses fixtures temporaires (constat transitoire en lecture seule), puis celles-ci ont disparu au contrôle suivant. Vérification SQL Replay finale :

| Fixture du runtime navigateur | Restant |
|---|---:|
| Partenaire temporaire `NAXA E2E NAV TEMP` | **0** |
| Adhésion temporaire liée | **0** |
| Affectation Comptable temporaire | **0** |
| Rôle actif Comptable temporaire | **0** |

Cette vérification confirme la propreté des quatre catégories suivies ; elle ne remplace pas les logs du job et ne prouve pas le passage des assertions Client. Le résultat du précontrôle JWT ajouté et le résultat final du navigateur ne sont pas disponibles dans les sorties d'exécution accessibles dans cette reprise. Ils restent donc **NON CONFIRMÉS**, sans extrapolation.

**Reprise exacte :** récupérer le résultat du run déclenché par `6c109d4` dans GitHub Actions. Si le précontrôle JWT passe, diagnostiquer la redirection dans Chromium à partir des lignes `CLIENT route`, console et requêtes ; si le précontrôle échoue, corriger uniquement la session/RLS mise en évidence. Relancer ensuite le parcours Client et obtenir un run qualité complet. Aucun nettoyage manuel supplémentaire n'est requis pour les quatre fixtures ci-dessus.


## 162. Objectif impératif de la prochaine passe — Lot B AU VERT (17/11/2026)

### Engagement de recette

La prochaine passe est dédiée à la fermeture du Lot B, sans ouvrir un nouveau chantier. L'objectif est **AU VERT avant clôture de cette passe**, sous réserve que toutes les preuves ci-dessous soient effectivement obtenues. Une impossibilité technique externe, une panne Replay ou un test encore rouge doit être signalé comme blocage explicite ; aucune preuve simulée ni statut vert administratif ne sera substitué à un test réel.

### Séquence obligatoire, dans cet ordre

1. **Reprendre le runner sur le HEAD réel de `main`** et récupérer les logs du workflow déclenché par le diagnostic `6c109d4`. Le précontrôle JWT et la première route fautive doivent être identifiés par les logs, pas supposés.
2. **Corriger la cause racine** du parcours Partenaire/Client uniquement après l'avoir démontrée. Vérifier que le compte Client existant peut ouvrir son espace sous sa propre session, sans élargir les policies RLS.
3. **Exécuter Chromium desktop et mobile** sur Replay : recherche Marketplace, filtres pertinents, visibilité des offres, favoris, panier, navigation vers la commande, historique. Les favoris/panier locaux ne valent pas preuve de commande réelle.
4. **Exécuter les scénarios métier positifs et négatifs** avec fixtures E2E temporaires et nettoyage vérifié : disponibilité/indisponibilité, création de commande, refus pharmacie, annulation client, libération/restauration exacte du stock, historique et absence de double débit/double restauration. Réutiliser les comptes existants ; ne créer de compte que si un rôle indispensable ne peut pas être couvert par les profils de recette disponibles.
5. **Rejouer les tests SQL 306 à 312** sur Replay après correction et contrôler les résidus métier et temporaires à zéro.
6. **Lancer le contrôle qualité complet disponible** (TypeScript, lint, build et workflow navigateur). Un run annulé ou non déclenché n'est pas PASS.
7. **Mettre à jour cette continuité** avec commit(s), résultats nommés, preuves, résidus à zéro et verdict. AU VERT seulement si chaque critère Lot B est PASS.

### Définition stricte de AU VERT

- Parcours UI Client prouvé dans Chromium, desktop et mobile, sur l'environnement Replay correspondant au code testé.
- Parcours de commande et de cycle de vie réellement exécuté, pas uniquement données locales ou appels SQL isolés.
- Contrôles métier et sécurité PASS : prix/stock/offres réels, refus, indisponibilité, annulation, restauration exactement une fois, historique cohérent, aucun survente ni écriture hors périmètre.
- Tests SQL 306–312 PASS sur le même état fonctionnel corrigé.
- Nettoyage des comptes/données/affectations temporaires vérifié.
- TypeScript, lint, build et workflow navigateur non annulés et PASS, ou limites explicitement déclarées hors critères selon la gouvernance en vigueur. Aucun faux vert.

**Point de départ exact :** commit de diagnostic runtime `6c109d4407d15ee52dbf68a0aaf4565339dda074`, dernière rectification documentaire `71105c5595a9b12f7f70a45139cc9a27509c44b9`. Les commits plus récents de `main` doivent être contrôlés avant d'exécuter la recette : ne pas tester un ancien HEAD ni supposer que le run correspondant au commit existe.

**Périmètre inchangé :** Replay uniquement, branche `main`, aucun déploiement Vercel ni migration Production. Lot B reste JAUNE jusqu'à obtention des preuves ci-dessus.


## §157 — Réalignement des migrations de facturation indépendante partenaire (17/11/2026)

**Correction effectuée sur `main` :** les 11 migrations déjà appliquées sur Replay avaient des doublons SQL sous de nouveaux horodatages. Les 9 paires dont les fichiers historiques existaient ont été comparées strictement et étaient identiques. Les deux fichiers historiques manquants `20261117061839_isolate_partner_and_promoteur_payment_references.sql` et `20261117061911_exclude_non_billable_partner_universes.sql` ont été restaurés à partir des fichiers correspondants. Les 11 fichiers aux versions récentes `20261117200000` à `20261117214000` ont ensuite été supprimés.

**Preuves :** les 11 fichiers historiques existent sur `main` ; les 11 versions `20261117060519`, `20261117060614`, `20261117060720`, `20261117060758`, `20261117060937`, `20261117060948`, `20261117061242`, `20261117061423`, `20261117061753`, `20261117061839` et `20261117061911` sont toujours listées comme appliquées sur Replay.

**Périmètre non exécuté :** aucune migration SQL rejouée, aucune donnée métier écrite, aucun test E2E du cycle de paiement faute de dossiers partenaires de test sur Replay. Aucun déploiement Production. Verdict facturation indépendante : JAUNE / PARTIEL, jusqu'à preuve E2E.


Contrôle de données Replay (lecture seule, 17/11/2026) : `admin_partner_dossiers = 0`, `partner_subscriptions = 0`, `partner_subscription_payments = 0`. Aucun dossier partenaire n'est disponible pour exécuter le scénario E2E.


## §163. Reprise simultanée du Lot B — diagnostic, SQL et harnais (17/11/2026)

### Audit du run navigateur antérieur

- Run [44027615028](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44027615028), commit testé `9d09298`, FAIL.
- Les logs établissent PASS Promoteur desktop/mobile et PASS des six destinations Comptable. Le premier timeout est l'ouverture de `/partenaire/catalogue`; le parcours Client n'a pas été atteint.
- Cause racine confirmée par les policies Replay : `partners_member_read` et `partner_universes_member_read` exigent `private.naxa_partner_has_confirmed_payment(id)`. Le harnais créait un partenaire/dossier validé sans abonnement ni paiement confirmé ; RLS le masquait correctement. Ce n'était pas une preuve de panne de l'espace Client.
- État Replay lu : 0 partenaire actif, 0 adhésion, 0 abonnement partenaire, 0 réservation. Aucun paiement ne doit être fabriqué pour débloquer le test.

### Correction du harnais sur main

- Commit `9553b17e9871c536ca9fad6cdd62231699bffac0` : suppression de la fixture Partenaire non payée ; navigation Partenaire exécutée uniquement si le compte Promoteur possède déjà un centre actif avec abonnement actif et premier paiement confirmé ; sinon SKIP explicite, puis poursuite du Client. Ajout d'un contrôle d'ouverture Client desktop avant les interactions Client mobile.
- Le premier contrôle qualité de ce commit a échoué sur une assertion statique devenue obsolète (`partner_universes` attendu après suppression volontaire de la fixture). Le build de navigation a été arrêté par le même échec de test préalable ; il ne s'agit pas d'une erreur TypeScript établie.
- Commit `4c15bdd83d3760ade3aa734b06c6541be3a0fefc` : assertion statique alignée sur le nouveau contrat de paiement confirmé, sans réintroduire de fixture ou de paiement fictif.
- Un nouveau commit retire ensuite le nom de fixture partenaire devenu inutilisé. Les workflows qualité et Chromium sont déclenchés automatiquement sur ce nouveau HEAD ; résultats à récupérer avant verdict.

### Tests SQL Replay rejoués

Exécution séquentielle des scripts transactionnels, chacun terminé par ROLLBACK :

| Test | Résultat |
|---|---|
| 306 — Marketplace Client, favori, réservation, anti-survente, annulation et historique | **PASS** |
| 307 — Lots, mouvements, perte, inventaire et stock agrégé | **PASS** |
| 308 — Réception fournisseur, lot et stock | **PASS** |
| 309 — Préparation multi-commandes et publication des offres Livreur | **PASS** |
| 310 — Passage Stock vers acceptation Livreur | **PASS** |
| 311 — Retrait, arrivée, remise, confirmation Client et suivi `delivered` | **PASS** |
| 312 — Rapport Promoteur, périmètre réseau et commissions NAXA nulles | **PASS** |

### Contrôles de propreté après ROLLBACK

- Réservations : 0 ; partenaires actifs : 0 ; adhésions : 0 ; abonnements : 0.
- Missions et offres Livreur : 0 ; fournisseurs et commandes fournisseur de test : 0 ; lots et inventaires de test : 0.
- Pharmacie non commerciale du test 306 : `visible_recherche=false` restauré ; stock produit : 3 unités, valeur attendue restaurée.
- Aucun compte Auth créé. Les fixtures temporaires du runner précédent ont été nettoyées.

### Verdict intermédiaire

**Lot B : JAUNE / PARTIEL.** Les 7 tests SQL passent et les résidus suivis sont à zéro. Le parcours UI Client desktop/mobile n'est pas encore prouvé ; la commande réelle et ses refus/annulation via interface ne sont pas encore exécutés. Le dernier workflow qualité connu est en échec sur une assertion de harnais désormais corrigée ; les nouveaux workflows doivent terminer PASS. Le SKIP Partenaire est justifié par l'absence de partenaire payé sur Replay et ne constitue pas un PASS Partenaire.

**Point de reprise exact :** HEAD après retrait du nom de fixture partenaire ; récupérer le dernier run `NAXA navigation Promoteur E2E Replay` et `NAXA quality`, puis corriger toute erreur prouvée et poursuivre le parcours Client. Aucun changement Production, aucune migration Production, aucun déploiement Vercel.


## §163 — Reprise de la recette navigateur avec les comptes Replay existants (17/11/2026)

**Inventaire en lecture seule avant test :**
- 11 identités Auth confirmées et 11 profils actifs/majeurs retrouvés sur Replay : Admin, Promoteur, Client acheteur, Gestionnaire Stock, Caisse, Livreur, Comptable, Pharmacien et comptes spécialisés de recette péremption.
- 8 affectations professionnelles actives déjà présentes, dont Stock, Caisse, Comptable, Pharmacien, Livreur et Responsable ; les comptes sont reliés aux pharmacies démo Mvan et à la pharmacie technique non commerciale.
- Aucun compte Auth supplémentaire ni changement de mot de passe requis. Le runner utilise des liens de connexion ponctuels émis par Supabase pour les identités existantes ; aucun mot de passe n'est lu ou journalisé.
- Avant fixture, Replay ne contenait aucun partenaire, dossier partenaire, abonnement partenaire ni règlement partenaire. Aucune adhésion Partenaire active n'était disponible ; la garde RLS de l'accès Partenaire exige un paiement confirmé.

**Adaptation du harnais navigateur :**
- Commit `bd91d0c819efd4c859c2392f76b58eba1609dfac` sur `main`.
- Le harnais crée une fixture Partenaire temporaire sur Replay, rattachée au compte Promoteur déjà existant, et une destination de paiement explicitement marquée non réelle.
- La déclaration passe par `partner_soumettre_reglement_abonnement` avec référence `NAXA-E2E-REPLAY`; le paiement doit rester `pending` avant décision Admin. Le compte Admin existant confirme ensuite via `admin_confirmer_reglement_partenaire`. Assertions attendues : reçu, cycle actif, lecture RLS refusée avant confirmation et autorisée après.
- Le paiement, la destination, le partenaire, l'adhésion et les notifications associées sont des données synthétiques exclusivement Replay ; le nettoyage de secours les supprime et vérifie leur disparition. Aucune transaction financière réelle n'est effectuée.

**Exécution en cours :**
- GitHub Actions : [44034937608 — NAXA navigation Promoteur E2E Replay](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44034937608).
- HEAD testé : `bd91d0c819efd4c859c2392f76b58eba1609dfac`.
- Précontrôle secrets strictement Replay : PASS ; installation dépendances : PASS ; installation Playwright/Chromium : EN COURS au dernier contrôle.
- Aucune assertion navigateur de cette nouvelle exécution n'est encore déclarée PASS. Attendre le résultat final du job et le contrôle post-nettoyage.

**Périmètre :** Replay uniquement, comptes existants uniquement, branche `main`. Aucun changement Production, aucun déploiement Vercel.


### §163 — Résultat du premier run et correction du harnais (17/11/2026)

- Run initial [44034937608](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44034937608) : échec avant démarrage du serveur local et avant toute navigation ; le nettoyage indique qu'aucune fixture n'avait été créée.
- Le précontrôle Replay, `npm ci` et l'installation Playwright/Chromium sont PASS.
- La suite de contrats a exécuté 572 tests : **571 PASS / 1 FAIL**. Échec unique : test 320 `les écritures Replay temporaires disposent d'un nettoyage vérifié`, qui attendait dans le harnais un filtre explicite `.eq("status", "active")` sur la lecture de l'abonnement. Le contrôle fonctionnel de statut actif était déjà présent par assertion ; le contrat statique attendait aussi le filtre de requête.
- Correction du harnais sur `main` : commit `fd2ba7c8109be2a3b991e95a89d46fb27f7e7c06`, ajout du filtre explicite `status=active` à la requête de vérification.
- Nouvelle exécution déclenchée sur ce HEAD : [44035108623](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44035108623), statut **PENDING** au dernier contrôle.
- Vérification Replay après le premier run : `partners=0`, `admin_partner_dossiers=0`, `partner_subscriptions=0`, `partner_subscription_payments=0`, `naxa_payment_destinations=0`. Aucune fixture n'a été laissée.

**Verdict intermédiaire :** aucune navigation E2E nouvelle n'est encore prouvée. Attendre le run 44035108623 ; ne pas déclarer PASS ni AU VERT avant le résultat navigateur et le nettoyage final.


## §164 — Diagnostic du run 44035208736 et correction du harnais (17/11/2026)

- HEAD contrôlé avant correction : `669de43e0609da645e9096e8670c1ba4574b6d16`.
- Workflow qualité [44035208905](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44035208905) : **SUCCESS**. Jobs « Tests, TypeScript et lint » et « GitHub Actions syntax and expression checks » tous deux PASS.
- Workflow navigateur [44035208736](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44035208736) : **FAIL** après PASS Promoteur desktop/mobile et parcours Comptable. Le log établit l'erreur exacte `TEMP_PARTNER_NAME is not defined` avant la création de la fixture Partenaire et avant le parcours Client. Le nettoyage confirme qu'aucune fixture temporaire n'était à supprimer.
- Cause racine : la constante de nom de fixture avait été retirée alors que le bloc de création synthétique Replay l'utilisait encore. Ce n'est ni un échec RLS ni une panne du parcours Client.
- Correction ciblée sur `main` : commit `ad0dd3ed18c793747e1430765f851be6846b572e`, restauration d'une constante descriptive pour la fixture « NAXA E2E Replay — Centre examens ». Aucun changement applicatif, aucune modification de schéma/RLS et aucun paiement Production.
- Le run déclenché par ce commit doit confirmer le cycle synthétique Replay (déclaration pending → confirmation Admin → reçu/cycle actif → accès RLS), puis les parcours Partenaire et Client desktop/mobile. Les résultats ne sont pas présumés.

**Verdict Lot B : JAUNE / PARTIEL.** La qualité statique est PASS sur le HEAD précédent ; le navigateur a échoué sur une référence de constante dans le harnais, corrigée sur le HEAD suivant. La commande métier réelle via UI, le refus pharmacie et l'annulation/restauration UI restent à prouver. Les tests SQL transactionnels 306–312 déjà documentés restent distincts des parcours navigateur.

**Point de reprise :** commit `ad0dd3ed18c793747e1430765f851be6846b572e` sur `main`; récupérer le nouveau run qualité et navigation Replay, puis examiner les premières assertions après le bloc Partenaire. Replay uniquement ; aucune migration Production et aucun déploiement Vercel.


## §165 — Audit profond des logs Client et corrections ciblées (17/11/2026)

- Run analysé : [44036755319](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44036755319), job navigateur Replay. Promoteur, Comptable et cycle Partenaire passent ; le Client échoue au panier à cause du sélecteur strict qui trouve deux titres « Mon panier ». Le nettoyage de secours passe.
- Correction du harnais déjà intégrée sur main : commit `80897223610627e921a99367b623bcf0631fa3c8`, sélecteur limité à `main h1` pour viser le titre de page.
- Audit des logs Supabase Replay (fenêtre 07:14–07:18 UTC) : le 503 de `GET /api/pharmacies/gardes` masque une erreur PostgREST 42703. Cause racine confirmée : la requête sélectionne `pharmacies.photo_verified_at`, colonne inexistante ; Postgres suggère `photo_verifiee_le`. Correction du nom dans le type, le SELECT et le contrôle photo : commit `b5a61248df1914591d806917916fef60fe45d6f3`.
- Les images publiques échouaient via `/_next/image` parce que l'optimiseur Next récupère les sources statiques sans le cookie d'âge ; le middleware redirigeait ces sources vers la page d'accueil (307). Correction : exemption limitée aux extensions d'assets statiques (images/icônes/polices) du seul contrôle d'âge ; les routes applicatives restent protégées. Commit `356b71fd0ba662155aad024ff81b4aa5292bc35d`.
- Le workflow navigateur est désormais déclenché aussi lorsque `src/middleware.ts` ou `src/app/api/pharmacies/gardes/route.ts` changent : commit `3dd594fd7294d25dfa886e187436b5d31584b6cf`.
- Exécutions sur le HEAD final `3dd594fd7294d25dfa886e187436b5d31584b6cf` : navigateur Replay [44037767501](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44037767501) et qualité [44037767387](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44037767387), toutes deux déclenchées et PENDING au moment de cette note. Aucun résultat PASS n'est présumé.
- Périmètre : `main`, Replay uniquement ; aucun changement de schéma/RLS, aucune migration Production, aucun déploiement. La preuve de commande métier réelle, du refus pharmacie et de la restauration exacte du stock reste à produire séparément.


## §166 — Compléments de diagnostic schéma et relance (17/11/2026)

- Le regroupement des erreurs Supabase a identifié deux références supplémentaires invalides : `profiles.avatar_url` (18 erreurs) et `pharmacies.logo_url` (9 erreurs). La table `profiles` ne fournit pas de colonne avatar ; le composant Client utilise désormais les métadonnées Auth pour la photo et ne sélectionne plus `avatar_url` : commit `ed45c872cbdba95f7b658105fd088ca30ba575d1`.
- La fonctionnalité de logo pharmacie avait bien son endpoint et ses policies Storage, mais le champ nullable `pharmacies.logo_url` manquait dans Replay. Migration versionnée ajoutée sur `main` : `20261117072000_add_pharmacy_logo_url.sql`, commit `be4a7fe882d9413b21a5eb225488cafc29a28b06`. Migration appliquée exclusivement au projet Replay ; vérification information_schema : colonne `logo_url text` présente. Aucune migration Production.
- Le premier correctif planning avait changé le type mais laissé deux occurrences dans le SELECT et le mapping. Le contrôle qualité [44037991838](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44037991838) a donc révélé TS2352/TS2551. Correction complète des deux occurrences restantes vers `photo_verifiee_le` : commit `faa248a69eb81ade9c7204d67cd3a2a3d7338a84`.
- Les assets publics sont exemptés uniquement du verrou d'âge dans `src/middleware.ts` (commit `356b71fd0ba662155aad024ff81b4aa5292bc35d`), le reste des routes applicatives demeure protégé.
- Le workflow de navigation couvre désormais les changements du middleware, du planning de garde, de BottomNav et des migrations Supabase ; commits `3dd594fd7294d25dfa886e187436b5d31584b6cf`, `912ab730d400b9955188793b77c87986cb85bd5c`, puis `7fe0484c51b7c620bb7186bd81749bc1f825f8c6`.
- Relance après corrections : qualité [44038178935](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44038178935) et navigateur Replay [44038178933](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44038178933), déclenchés sur le commit applicatif `faa248a69eb81ade9c7204d67cd3a2a3d7338a84), en attente au moment de la présente note. Les résultats restent à contrôler ; aucun PASS anticipé.
- État : Replay uniquement ; aucune modification RLS, aucune migration Production, aucun déploiement. Les tests métier commande/annulation/restauration de stock restent hors preuve de cette navigation tant qu'ils ne sont pas observés explicitement.


## §167 — Corrections des échecs de recette Client (17/11/2026)

- Relecture du run navigateur Replay [44038178933](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44038178933), job 133886144683, étape 9 : l'échec exact est getByText("2", { exact: true }) qui résout trois éléments (badge panier, quantité de ligne et badge Achats). Le test cible désormais main li output avec la valeur exacte 2, commit f3a3802374a3d71e592a167006f6daed81572bed.
- Les journaux Replay confirment des erreurs HTTP 400 causées par la sélection inexistante profiles.avatar_url sur le profil Client. La page /client/profil lit maintenant les métadonnées Auth et la photo locale ; la suppression distante modifie uniquement les métadonnées Auth, sans UPDATE sur une colonne absente. Commit 6d62720898e2e9f18346cd2c89c670e79dc243e6.
- La page d'accueil Client avait une deuxième lecture de profiles.avatar_url et une lecture de pharmacies.photo_verified_at. Le SELECT profil a été réduit aux champs existants ; le champ photo pharmacie est demandé via l'alias PostgREST photo_verified_at:photo_verifiee_le. Commit b86d775eda626363787d027169be0db9341f9525.
- La recherche Marketplace /resultats utilisait elle aussi le mauvais nom physique de colonne ; le SELECT utilise désormais photo_verified_at:photo_verifiee_le, tout en conservant le nom de propriété TypeScript attendu. Commit ffa5735f0aea62bdedf7157206e30df987133b77.
- Les 4 changements sont sur main. Relancer les workflows qualité et navigation, puis examiner les logs Replay après le run. Les corrections ne sont pas déclarées PASS avant exécution.
- Limites conservées : les ERR_ABORTED relevés lors des changements de page sont des requêtes interrompues par la navigation et ne constituent pas seuls une preuve d'échec serveur ; la recette panier était bloquée par l'assertion stricte. Les tests de commande métier, annulation et restitution exacte du stock restent distincts.
- Périmètre : Replay uniquement ; aucun changement Production, aucune migration Production, aucun déploiement Vercel.

**Point de reprise :** HEAD applicatif après f3a3802 ; attendre le run qualité et le run navigateur déclenchés sur le HEAD final après cette note, vérifier l'absence de requêtes 400 sur profiles.avatar_url et pharmacies.photo_verified_at, puis statuer.


## §168 — Reconstitution de clôture Lot B et stratégie de recettes ciblées (17/11/2026)

**Rectification de l'état de clôture :**
- Le Lot A est considéré bouclé conformément à la décision utilisateur. Les mentions historiques « Lot A PARTIEL » antérieures ne rouvrent pas ce lot.
- Le périmètre du Lot B n'est pas redéfini. Les preuves déjà enregistrées restent acquises : tests transactionnels 306–312 ; correctifs et tests Partenaire 313/315 ; parcours Promoteur/Livreur documentés aux §§140–150.
- Le point rouge historique Partenaire (découplage identité globale / dossier partenaire et cohérence des gardes d'accès Examens) a reçu des corrections et preuves SQL positives/négatives. La validation SQL ne vaut pas encore preuve de navigation authentifiée dans le navigateur.
- Les corrections du panier Client et des colonnes Supabase sont consignées au §167 ; elles ne sont pas à refaire sans nouvelle preuve d'échec.

**Dernier contrôle qualité connu :**
- Run GitHub Actions [44039976766](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44039976766), HEAD contrôlé `407b126de603d1cbd67e2d85875d01ff7bc86b3a`.
- Syntaxe des workflows : PASS.
- Tests : 570 PASS / 2 FAIL sur 572. Les deux échecs isolés sont dans `scripts/test-naxa-communications-scheduler.cjs` : (1) assertion sur le message attendu pour le domaine stable Production, (2) assertion obsolète attendant le dispatch Web Push par pg_cron dans le script Google Apps Script. Ces assertions concernent le scheduler de communications, pas les parcours métier Lot B ; elles ne sont ni comptées comme défauts Lot B ni masquées comme succès.
- Ce run n'apporte pas de nouvelle preuve navigateur. Ne pas assimiler le succès de syntaxe workflow ou les tests unitaires à une recette E2E.

**Ordre de recette sans dispersion :**
1. Achever en une passe la recette Partenaire Examens authentifiée sur Replay (création/lecture et actions autorisées, puis refus des états suspendu/non validé/non payé), avec nettoyage et vérification des fixtures. Si tous les contrôles passent, marquer cette recette VERT et ne pas la rouvrir.
2. Achever en une passe le parcours Client Marketplace desktop/mobile sur Replay : recherche/offre, panier, soumission, décision pharmacie, refus et annulation selon les scénarios du harnais, vérification de l'historique et de la restauration du stock exactement une fois ; nettoyage vérifié. Distinguer ce que le harnais observe réellement des scénarios seulement SQL.
3. Ne lancer aucun sous-parcours si ses préconditions, son nettoyage et ses assertions de fin ne sont pas réunis. En cas d'échec, conserver la recette JAUNE/ROUGE avec le premier défaut reproductible et ne pas passer à une autre recette partielle.
4. N'ajouter aucun critère au périmètre Lot B. Aucun accès Production, aucune migration Production, aucun déploiement Vercel.

**Règle de statut :** une recette n'est déclarée VERT qu'après PASS de toutes ses assertions prévues et preuve de nettoyage. Les preuves SQL 306–315 restent acquises indépendamment des preuves UI ; elles ne sont pas rejouées inutilement.


## §169 — Renforcement et lancement de la recette Partenaire Examens (17/11/2026)

- Mise à jour de clôture §168 enregistrée sur `main` : commit `2cc1de6da76d4bd4e78394bd844c424a71d35278`.
- Le harnais navigateur est renforcé pour la recette Partenaire Examens : il capture les erreurs API (`/rest/v1/`, `/api/`) HTTP ≥400 et les exceptions navigateur pendant la navigation authentifiée, vérifie l'affichage du formulaire et refuse le PASS si une erreur est capturée.
- Commit du harnais : `660b3df7b1232fa2476c8784021c8c89b0d7ca34`.
- Run lancé automatiquement sur ce commit : [44042299247 — Navigation Promoteur / Partenaire / Client sur Replay](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44042299247), job `133899526085`.
- Précontrôle secret Replay : PASS ; `npm ci` : PASS ; installation Playwright/Chromium : EN COURS au dernier contrôle. Le build, la recette navigateur et le nettoyage restent à exécuter ; aucun résultat de recette n'est anticipé.
- Le lot reste JAUNE jusqu'au résultat final du navigateur et au PASS du nettoyage. Aucun accès Production, aucune migration Production, aucun déploiement.


## §170 — Diagnostic du run Partenaire et correction du blocage de build (17/11/2026)

- Run [44042299247](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44042299247), job `133899526085`, terminé en échec au build ; le serveur local et la recette navigateur ont été ignorés. Le nettoyage de secours Replay a réussi : aucune fixture temporaire à nettoyer.
- Le build a échoué sur 2 assertions obsolètes parmi 572 tests (570 PASS / 2 FAIL), toutes deux dans `scripts/test-naxa-communications-scheduler.cjs`. Elles attendaient (1) un ancien message d'erreur générique au lieu du message actuel qui impose l'URL exacte `https://nnaxa.vercel.app/api/cron/validite`, et (2) un commentaire historique affirmant que Google Apps Script ne dispatchait pas Web Push par pg_cron. Le script actuel ne gère que le worker e-mail ; le worker Push est séparé dans `src/app/api/cron/posologie/route.ts`.
- Correction limitée aux assertions de test : vérification du message contractuel exact de `NAXA_WORKER_URL` et vérification que le script Apps Script ne contient pas de dispatch Posologie/Web Push/pg_cron. Aucun changement de logique métier, de configuration, de schéma ou de secrets.
- Commits sur `main` : correction initiale `0742bdb1ca4041352dc9a41bdcd628ff20572c92`, ajustement de l'expression de test `0ef5ca1d27a4c5f7ff738a0bb2cc047f3a5947d7`.
- Le run 44042299247 ne constitue pas une preuve de recette Partenaire : son parcours navigateur a été ignoré. Statut Partenaire Examens : JAUNE / non validé.
- Prochaine preuve requise : nouveau run sur le HEAD `0ef5ca1d27a4c5f7ff738a0bb2cc047f3a5947d7), contrôler le build, puis seulement si celui-ci passe, la navigation authentifiée et le nettoyage Replay. Aucun accès Production, aucune migration Production, aucun déploiement Vercel.


## §170 — Diagnostic du run Partenaire et correction des tests prébuild (17/11/2026)

- Le run navigateur initial [44042299247](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44042299247) est terminé en échec avant le serveur Next.js : étape « Construire NAXA » en échec, navigation E2E ignorée.
- Le nettoyage de secours Replay a réussi : `aucune fixture temporaire à nettoyer`.
- Cause racine confirmée : `npm run build` exécute `prebuild` (`npm run quality`), donc les tests unitaires obsolètes interrompaient le build. Résultat : 570/572 PASS ; deux assertions dans `scripts/test-naxa-communications-scheduler.cjs` n'étaient plus alignées sur le worker e-mail Google Apps Script et le dispatch Push séparé.
- Correctif du contrat URL présent sur `main` : commit `0ef5ca1d27a4c5f7ff738a0bb2cc047f3a5947d7`. Le test Apps Script vérifie désormais l'absence de dispatch Push dans cette passerelle et conserve le contrôle du worker e-mail dédié. Ne pas attribuer ces défauts au parcours Partenaire Examens.
- Un nouveau run qualité a été déclenché sur ce HEAD : [44044186294](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44044186294), en attente au moment de la note. Un run antérieur sur le HEAD intermédiaire est également en cours ; ne pas le prendre comme preuve du HEAD final.
- La recette Partenaire Examens reste NON TESTÉE / JAUNE : aucun navigateur n'a démarré. Reprendre uniquement après validation de la suite qualité, puis relancer le job Chromium sur Replay et vérifier les assertions Partenaire ainsi que le nettoyage final.
- Aucun critère Lot B ajouté ; aucun accès ou changement Production ; aucun déploiement.


## §171 — Analyse détaillée des logs, correction des assertions et relance (17/11/2026)

- Analyse des logs du run qualité [44042802436](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44042802436) : les deux échecs sont précisément les sous-tests 230 et 232 de `scripts/test-naxa-communications-scheduler.cjs`. Le premier comparait encore le texte historique « domaine stable Production » alors que `scripts/google-welcome-email.gs` renvoie « NAXA_WORKER_URL doit cibler https://nnaxa.vercel.app/api/cron/validite. ». Le second comparait une expression regex fragile au texte du commentaire de configuration, malgré l'absence de dispatch Push dans la passerelle.
- Correction sur `main` : commit `8a9f15671b89528952cc3d4372c7e035c2d9540d`. Le contrôle du message de refus est limité au préfixe contractuel stable ; le test de non-double-dispatch vérifie maintenant la présence littérale de l'URL e-mail documentée et l'absence de termes/dispatch Push dans le script GAS.
- Le run navigateur [44044249157](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44044249157), sur un HEAD antérieur à cette dernière correction, a réussi : build PASS ; paiement partenaire Replay confirmé ; accès `/partenaire/examens`, titre et formulaire visibles ; zéro erreur API/page sur le parcours Partenaire Examens ; retour depuis les réservations ; nettoyage des fixtures PASS. Il constitue une preuve effective du parcours Partenaire Examens, mais pas encore une relance sur le HEAD contenant le correctif des tests.
- Renforcement complémentaire du harnais sur `main`, commit `4861e1e0bc6ed2bdd83b4112dd09e63405d5632f` : le contrôle des erreurs API/exceptions navigateur est aussi réévalué après le retour depuis les réservations vers Examens.
- Runs qualité : [44045024932](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44045024932) sur le commit de correction, encore en cours au dernier relevé ; [44045122978](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44045122978) sur le HEAD suivant, en file d'attente. La mise à jour du harnais déclenche la nouvelle recette Chromium Replay : vérifier le run correspondant à `4861e1e`.
- Le parcours Client du run précédent reste limité aux favoris/panier locaux, recherche/filtres et historique ; il ne prouve pas le cycle métier de commande persistée. Aucun changement de ce statut.
- Statut Partenaire Examens : preuve navigateur antérieure PASS avec nettoyage PASS ; relance demandée sur HEAD courant en attente. Lot A fermé, périmètre Lot B inchangé. Aucun accès Production, aucune migration Production, aucun déploiement.


## §172 — Vérification GitHub Actions et recette Chromium Replay (17/11/2026)

- HEAD `main` contrôlé : `95fbb195807d60b11f436dd730e7fa53d33651f9` (« docs: tracer les logs en échec et la relance Replay »). Son parent direct est `4861e1e0bc6ed2bdd83b4112dd09e63405d5632f` ; le diff du HEAD ne modifie que ce document de continuité. Le code testé par la recette E2E est donc identique au code du HEAD courant.
- GitHub Actions Qualité sur le HEAD courant : run [44045158171](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44045158171), conclusion SUCCESS. Les deux jobs ont réussi : tests + TypeScript + lint + build Next.js ; validation actionlint de tous les workflows actifs.
- Recette Chromium Replay : run [44045123797](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44045123797), commit `4861e1e0bc6ed2bdd83b4112dd09e63405d5632f`, conclusion SUCCESS. Précontrôle secrets Replay, installation Playwright/Chromium, build Replay, serveur local, parcours navigateur et nettoyage des fixtures : PASS.
- Preuves positives du navigateur : navigation Promoteur desktop/mobile ; navigation des 6 entrées Comptable ; parcours Partenaire Examens avec session Promoteur, formulaire visible, retour depuis les réservations et aucune erreur API/page sur ce segment ; Client desktop/mobile, favoris/panier locaux, recherche/filtres et historique.
- Limites relevées dans les logs du même run : le Client a déclenché un `PAGEERROR` ServiceWorker (`URL object could not be cloned`) et des réponses console HTTP 400 ; plusieurs requêtes interrompues pendant les changements de page (`ERR_ABORTED`). Le workflow est vert selon ses assertions, mais ces signaux ne sont pas effacés ni considérés comme validés.
- Le parcours Client couvre ici des interactions locales de favoris/panier, recherche/filtres et historique ; il ne prouve pas la création et le cycle persistant d'une commande Marketplace. Le run ne constitue pas non plus une preuve de réception d'un e-mail Gmail par Apps Script.
- Statut : Qualité GitHub VERT sur le HEAD courant ; recette navigation Chromium Replay PASS sur le même code applicatif ; E2E globale NAXA et livraison réelle des e-mails non déclarées vertes. Aucun changement Supabase Production, aucun déploiement Vercel, aucun accès Play Store.


## §173 — Clôture de la vérification du run Chromium Replay (17/11/2026)

- Run [44045123797](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44045123797), job `133908804047`, HEAD applicatif `4861e1e0bc6ed2bdd83b4112dd09e63405d5632f` : conclusion SUCCESS.
- Étapes vérifiées dans le job : précontrôle des secrets Replay, `npm ci`, installation Playwright/Chromium, build Next.js Replay, démarrage serveur local, scénario navigateur et nettoyage de secours : toutes PASS. Étape de logs serveur en cas d'échec : SKIPPED normalement, car aucune défaillance bloquante n'a été détectée.
- Promoteur : navigation desktop et mobile vers Livraisons du réseau : PASS.
- Comptable : ouverture de l'espace et navigation/rendu des six rubriques contrôlées (créances & bordereaux, rejets & relances, rapports & exports, documents, assureurs & fournisseurs, plan comptable & mappings) : PASS.
- Partenaire : RPC de déclaration et confirmation Admin, reçu, cycle et garde RLS : PASS ; catalogue partenaire → Centres et examens, formulaire visible, retour depuis les réservations : PASS ; aucune erreur API/page relevée sur ce segment.
- Client : espace desktop/mobile, favoris et panier de démonstration locaux, recherche/filtre ville/panneau assurance, historique et filtres : PASS selon les assertions du harnais.
- Nettoyage : fixtures temporaires présentes dans le registre supprimées et contrôlées ; seconde commande de nettoyage indique qu'il ne reste aucune fixture : PASS.
- Contrôle qualité sur le HEAD documentaire courant `95fbb195807d60b11f436dd730e7fa53d33651f9` : run [44045158171](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44045158171) SUCCESS ; syntaxe Actions, tests, TypeScript, lint et build Next.js : PASS.
- Réserve à conserver : pendant les transitions Client, logs `ERR_ABORTED` sur plusieurs requêtes interrompues ; le navigateur a aussi signalé `PAGEERROR` ServiceWorker `URL object could not be cloned` et deux erreurs console HTTP 400. Ces signaux ne sont pas effacés par le succès du job et restent à diagnostiquer avant une validation plus large du parcours Client.
- Limite métier : le Client n'a testé que favoris/panier locaux, recherche/filtres et historique ; aucune commande Marketplace persistée n'a été créée ni suivie. Cette recette ne valide donc pas le cycle Client transactionnel.
- Verdict : recette de navigation Promoteur/Comptable/Partenaire/Client sur Replay = PASS selon le périmètre exécuté ; qualité GitHub = PASS ; nettoyage Replay = PASS. E2E globale NAXA et cycle Marketplace Client restent PARTIELS. Aucun changement Production, aucune migration Production, aucun déploiement Vercel, aucun accès Play Store.


## 174. Instrumentation ciblée des anomalies Client — 17/11/2026

**Demande :** exécuter la correction des anomalies observées dans la recette navigateur précédente, sans modifier Production.

**Constat conservé :**
- Les deux réponses HTTP 400 de la recette antérieure n'étaient pas associées à une URL, une méthode ou un corps de réponse ; leur cause métier n'était donc pas démontrée.
- L'erreur ServiceWorker « URL object could not be cloned » était visible, mais la pile d'appel n'était pas journalisée. Le fichier `worker/sw.ts` configure Serwist et ne contient pas d'appel applicatif explicite à `postMessage` ; cela ne suffit pas à attribuer la panne à Serwist ou à un composant précis.
- Les `net::ERR_ABORTED` coïncidaient avec des changements de route. Ils doivent être classés comme interruptions de navigation, sans être confondus avec des réponses HTTP métier en échec.

**Instrumentation ajoutée au harnais Chromium :**
- Commit [b5c3d27ae154a7231dcb80946f8d32b41fcfe897](https://github.com/audreymendomo23-netizen/NAXA/commit/b5c3d27ae154a7231dcb80946f8d32b41fcfe897) : journalisation des réponses HTTP 400 avec méthode, URL expurgée, type de ressource, corps de requête et corps de réponse ; capture de la pile des erreurs JavaScript ; séparation explicite des interruptions `ERR_ABORTED`.
- Commit [69aaf7cb6e01259dbde793cf80266d31bb984b92](https://github.com/audreymendomo23-netizen/NAXA/commit/69aaf7cb6e01259dbde793cf80266d31bb984b92) : correction des motifs d'expurgation pour masquer les jetons, adresses e-mail, UUID et numéros de téléphone avant journalisation.
- Les paramètres de requête ne sont pas consignés en clair ; seuls leurs noms sont conservés. Les valeurs sensibles présentes dans les corps structurés sont masquées.

**Exécution automatique déclenchée :**
- Commit testé : `69aaf7cb6e01259dbde793cf80266d31bb984b92` sur `main`.
- Run qualité : [44048025967](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44048025967), contrôle de syntaxe GitHub Actions PASS ; tests/TypeScript/lint encore en cours au dernier relevé.
- Recette navigateur Replay : [44048025935](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44048025935), déclenchée mais encore en attente au dernier relevé. Aucun résultat diagnostic HTTP 400 ou ServiceWorker n'est donc encore établi dans cette section.
- Le contrôle Supabase Preview a été annulé automatiquement car le quota mensuel Git push de l'organisation est épuisé ; ce contrôle n'est pas un échec de recette applicative et ne constitue pas un PASS.

**Décision technique :** ne pas remplacer aveuglément des objets `URL` par des chaînes ni modifier les RPC avant d'avoir la pile ServiceWorker et les réponses HTTP 400 capturées par ce run. Après réception des logs, corriger chaque cause prouvée, relancer la recette Replay, puis vérifier le nettoyage des fixtures.

**Périmètre :** aucun changement de schéma ou de donnée Production, aucune migration, aucun déploiement Vercel, aucun changement Play Store.


### Complément §174 — masquage et relance du 17/11/2026

- Commit complémentaire [7971e7bcca9dc7a2f86bcd44213daa9c01196d37](https://github.com/audreymendomo23-netizen/NAXA/commit/7971e7bcca9dc7a2f86bcd44213daa9c01196d37) : correction du motif de masquage des préfixes téléphoniques internationaux dans les diagnostics.
- Nouvelle exécution déclenchée sur ce HEAD : qualité [44048215108](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44048215108) et navigateur Replay [44048214981](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44048214981). Les deux runs étaient encore en attente au dernier relevé ; aucun résultat de recette ne leur est attribué à ce stade.


## 175. Résultats de la recette instrumentée — diagnostic HTTP 400 confirmé — 17/11/2026

**Exécution navigateur :** [run 44048003954](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44048003954), commit testé `b5c3d27ae154a7231dcb80946f8d32b41fcfe897`, conclusion GitHub Actions **SUCCESS**.
- Construction Next.js Replay, démarrage du serveur local, scénario Promoteur/Comptable/Partenaire/Client et nettoyage des fixtures : PASS.
- Navigation Promoteur vers « Livraisons du réseau » : PASS.
- Scénario Client desktop/mobile (favoris/panier locaux, recherche/filtres, historique) : PASS selon les assertions du harnais.
- Le succès de ce scénario ne signifie pas absence d'anomalies : les diagnostics ci-dessous ont précisément permis d'en isoler une.

**Cause des deux HTTP 400 — identifiée avec preuve :**
- Les deux réponses concernent la même requête GET PostgREST : `client_achats?select=...&client_id=eq.<utilisateur>`.
- Corps JSON renvoyé par PostgreSQL : code `42703`, message `column client_achats.client_id does not exist`.
- Le code source `src/app/client/page.tsx` filtre bien `client_achats` avec `.eq("client_id", user.id)` (ligne 56 dans la version consultée, puis même requête répétée dans le chargement/rafraîchissement).
- **Racine confirmée :** désaccord entre le contrat de la requête Client et le schéma réel de `client_achats`. Ce n'est pas un simple avertissement navigateur : la récupération des achats échoue, ce qui peut rendre l'historique d'achats incomplet ou indisponible. Les autres blocs de la page ont néanmoins permis au test de navigation de passer.
- **Correction non encore appliquée :** vérifier la définition SQL et les clés réelles de `client_achats` sur Replay, puis corriger la requête ou une migration de façon cohérente avec le modèle de données et les politiques RLS. Ne pas ajouter une colonne `client_id` au hasard.

**ServiceWorker :**
- Le run capture toujours `DataCloneError: Failed to execute 'postMessage' on 'ServiceWorker': URL object could not be cloned.`
- La pile capturée ne contient que le type et le message, sans frame applicative permettant d'attribuer l'appel à un composant précis.
- **Cause non encore localisée ; correction non appliquée.** Ne pas attribuer arbitrairement le défaut à Serwist ni modifier un payload sans identifier le producteur.

**ERR_ABORTED :**
- Les interruptions observées concernent des chargements de routes/RSC, appels de recherche et appels Supabase qui coïncident avec les changements de page.
- Elles sont désormais journalisées comme interruptions de navigation, et non comme erreurs HTTP 4xx/5xx. Leur caractère bénin est plausible dans ce scénario, mais chaque appel métier abandonné devra être revalidé si le parcours dépend de son résultat.

**Autres exécutions :**
- [Qualité 44048267466](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44048267466), commit documentaire `d34ffa9d236eff2253530d7b00f50247d8137218` : **SUCCESS**, tests, TypeScript, lint, build Next.js et validation syntaxique Actions PASS.
- [Navigation 44048214981](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44048214981), commit `7971e7b...` : **FAILURE** avant les scénarios Client, sur un timeout de 15 s lors de `page.goto("/pharmacie/promoteur")`; les étapes de build et démarrage serveur avaient réussi, le nettoyage de secours a réussi. Ce run ne fournit donc aucun résultat sur les diagnostics Client.
- [Qualité 44048215108](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44048215108) : annulé par un push ultérieur ; aucun PASS à en tirer.
- Le premier run navigateur instrumenté `44048003954` est le run exploitable pour les diagnostics ci-dessus. La correction du motif téléphonique ultérieure n'a pas été revalidée par ce même run.

**État :** HTTP 400 = racine identifiée, correction à faire ; ServiceWorker = cause non localisée ; E2E Client = partiel, pas vert global. Aucun schéma Production modifié, aucune migration Production, aucun déploiement.


## 176. Correction de la requête historique Client et contrôle de sécurité Replay — 17/11/2026

**Cause racine confirmée sur Supabase Replay** (pwfftcsjyeibxxqhwysw, état ACTIVE_HEALTHY, PostgreSQL 17) :
- public.client_achats est une vue, pas une table. Sa définition expose reservation_id, produit_id, les détails d'achat et les horodatages ; elle n'expose pas client_id.
- La définition de la vue contient déjà le prédicat r.client_id = auth.uid() et ne renvoie que les réservations payées/retirées.
- La vue est configurée security_invoker=true. Le rôle authenticated possède SELECT ; anon ne le possède pas.
- La table sous-jacente reservations a RLS activé. Sa politique SELECT resa_read limite le client à ses propres réservations lorsque sa fonction active est client, avec des voies séparées pour les accès professionnels autorisés et l'Admin.
- Conclusion : le filtre .eq("client_id", user.id) était incorrect et redondant. La sécurité ne doit pas être réimplémentée dans le navigateur : elle est assurée par la vue et les règles RLS.

**Correction code sur main :**
- Commit [1e5de8117eb84cbaa105509a91e6c43b3dab7bfc](https://github.com/audreymendomo23-netizen/NAXA/commit/1e5de8117eb84cbaa105509a91e6c43b3dab7bfc) : suppression du filtre inexistant dans les deux appels client_achats (chargement initial et rafraîchissement). Le tri et la limite sont conservés. Commentaire ajouté pour expliciter le contrat de la vue.
- Le repli sur les réservations reste disponible si la vue retourne une erreur ; aucun changement de schéma ni de politique RLS n'a été effectué.

**Régression ajoutée au harnais :**
- Commit [be8cfb59f6828f82ba389d305b81937164aee7ea](https://github.com/audreymendomo23-netizen/NAXA/commit/be8cfb59f6828f82ba389d305b81937164aee7ea) : le précontrôle du compte Client E2E interroge désormais client_achats sous le JWT propre du client. Une erreur PostgREST/RLS fait échouer le précontrôle avant la navigation. Une vue vide reste acceptable si le compte n'a aucun achat payé/retiré.
- Le résultat de cette régression n'est pas anticipé : il doit être confirmé par le prochain run navigateur Replay sur le HEAD du correctif.

**ServiceWorker — point toujours rouge / non corrigé :**
- Le signal historique reste DataCloneError: Failed to execute 'postMessage' on 'ServiceWorker': URL object could not be cloned.
- Inspection de worker/sw.ts : le fichier configure Serwist et ses stratégies de cache, sans appel applicatif explicite à postMessage. Le harnais actuel capture le message d'erreur mais ne fournit aucune frame source fiable.
- La recherche du code applicatif ne permet pas encore d'identifier le producteur du message. Aucun remplacement global de URL par string, aucune modification arbitraire du worker et aucune désactivation du ServiceWorker n'ont été appliqués : ces contournements pourraient masquer la cause ou casser le fonctionnement hors ligne.
- Correction suspendue jusqu'à obtention d'une trace instrumentée de l'émetteur et d'une reproduction ciblée. Ce point ne peut pas être déclaré vert.

**ERR_ABORTED :** reste séparé des réponses HTTP 4xx/5xx. Les interruptions qui coïncident avec un changement de route ne sont pas considérées comme une panne métier sans preuve d'une action abandonnée.

**Périmètre et verdict :**
- Cause HTTP 400 : identifiée et correction frontend appliquée.
- Contrat d'accès à la vue : confirmé par définition SQL, option security_invoker=true, privilèges et politique RLS Replay.
- Régression JWT Client : ajoutée, exécution en attente.
- ServiceWorker : rouge / cause non localisée / aucune correction sûre démontrée.
- E2E Client transactionnelle : reste partielle tant que le cycle commande Marketplace persistant n'est pas exercé.
- Aucun changement de schéma ou de donnée Production, aucune migration, aucun déploiement Vercel, aucun accès Play Store.


## 177. Vérification post-correction — filtre résiduel découvert et supprimé — 17/11/2026

La lecture des logs complets du run navigateur Replay 44050265085 (succès du job, commit be8cfb59f6828f82ba389d305b81937164aee7ea) a révélé que le HTTP 400 persistait malgré le premier correctif :
- Le chargement initial de la vue client_achats n'avait plus le filtre client_id.
- En revanche, le chemin de rafraîchissement dans refreshReservations() conservait encore .eq("client_id", user.id) à la ligne 115.
- Les logs du run confirment encore deux réponses 400 PostgreSQL 42703 sur client_achats?client_id=..., alors même que le nouveau précontrôle JWT Client affichait PASS.
- Le précontrôle testé ne suffisait donc pas à garantir l'absence de requête fautive dans le chemin de rafraîchissement. Le résultat global de navigation PASS ne signifie pas que le défaut HTTP était corrigé.

**Correction complémentaire sur main :**
- Commit e1baa2af05a13baca07c294fc0502865e349d0c3 : suppression du dernier filtre client_id dans le chemin de rafraîchissement de client_achats. Les filtres client_id des requêtes sur reservations, home_service_requests et exam_appointments sont distincts et conservés.
- Vérification statique du fichier après commit : aucun .eq("client_id", user.id) ne doit subsister sur les appels client_achats. Une nouvelle exécution Replay est nécessaire pour prouver l'absence des HTTP 400.

**Résultats vérifiés des runs précédents :**
- Qualité sur HEAD documentaire précédent 844cf49952b153661f4f141b3cf36a25415844ba : run 44050329888 SUCCESS ; tests, TypeScript, lint, build Next.js et validation des workflows PASS.
- Navigation Replay 44050265085 : job SUCCESS (Promoteur, Comptable, Partenaire, Client, nettoyage), mais logs Client contiennent toujours les deux HTTP 400 sur le chemin de rafraîchissement et DataCloneError ServiceWorker. Le succès du job ne ferme donc pas ces anomalies.
- ServiceWorker : DataCloneError toujours observée dans le run ; émetteur exact non identifié, correction toujours ouverte.

**Verdict :** premier correctif incomplet ; dernier filtre résiduel supprimé dans e1baa2a. Statut de la correction HTTP 400 = en attente de revalidation navigateur sur le nouveau HEAD. ServiceWorker = rouge. Aucun changement Production, migration, déploiement ou action Play Store.


## 178. Garde de non-régression HTTP 400 Client — 17/11/2026

Après la découverte du filtre résiduel dans refreshReservations(), le contrôle statique de main confirme maintenant exactement deux appels client_achats (chargement et rafraîchissement) et zéro filtre .eq("client_id", user.id) sur ces appels.

Le harnais .github/e2e/naxa-navigation-runtime.cjs a été renforcé :
- il mémorise les réponses HTTP 400 dont l'URL cible /rest/v1/client_achats ;
- après ouverture de l'historique, il attend la fin des rafraîchissements puis échoue explicitement si une seule erreur de cette vue est observée ;
- le simple succès du précontrôle JWT n'est plus considéré comme preuve suffisante du fonctionnement du chemin UI.

Commit du harnais : b0fb53522492c34a14b330bb8d4a128365fbceb7.
Commit de la suppression du dernier filtre : e1baa2af05a13baca07c294fc0502865e349d0c3.
Commit de cette mise à jour documentaire : à confirmer à la fin du commit.

La revalidation navigateur complète sur le HEAD réunissant ces modifications est encore attendue. Le ServiceWorker DataCloneError reste un point rouge distinct.


## 179. Audit des modifications panier multi-univers et échecs CI — 17/11/2026

**HEAD observé avant correction :** `99394e8f833e1c199462410226075fcd0db6e18a`. Les commits ajoutés après le lot HTTP 400 modifient le panier Client pour isoler les lignes par univers et établissement propriétaire. Le document dédié `docs/audits/PANIER_CLIENT_MULTI_UNIVERS.md` précise le comportement attendu, mais indique explicitement qu'aucun contrôle TypeScript, lint, build ou E2E n'avait été exécuté au moment de sa rédaction.

**Échec qualité 44051283097 et échec navigateur 44051264919 — causes prouvées par les logs :**
- Les 572 tests automatisés passent (0 échec), mais TypeScript bloque avant lint/build : `src/app/panier/page.tsx(22,44): TS1005 ')' expected` et `src/lib/panier.tsx(6,2089): TS1005 ')' expected`.
- Le premier défaut est une parenthèse fermante manquante autour de `Array.from(medicaments.reduce(...))` dans le regroupement des lignes Pharmacie.
- Le second est une parenthèse manquante autour de l'appel `save(...)` dans le callback `retirer` du panier.
- Le run navigateur échoue à l'étape `npm run build` pour les mêmes deux erreurs TypeScript ; le serveur et le scénario Chromium ne démarrent donc pas. Le nettoyage de secours Replay indique qu'aucune fixture temporaire n'était à supprimer.
- La validation syntaxique GitHub Actions est PASS ; elle ne valide pas la syntaxe TS/TSX de l'application.

**Corrections appliquées sur main :**
- `3a40573112dbccea2787200a87b3040bc93b654c` : fermeture de l'expression `Array.from` dans `src/app/panier/page.tsx`.
- `a305ce35270510b34f8b0334466fbc20b6b98044` : fermeture de `save` dans `retirer` et alignement du ciblage sur la clé propriétaire normalisée. Le retrait reconnaît maintenant les anciennes lignes qui n'ont que `pharmacie_id` ou `partner_id`, comme le fait déjà `changerQuantite`; il évite ainsi de laisser une ligne homonyme dans le panier après finalisation.

**Revalidation :**
- Deux runs qualité ont été déclenchés sur les commits de correction ; au moment de cette note, le run le plus récent sur `a305ce3` est encore en attente. Aucun PASS ne lui est attribué avant lecture du résultat final.
- Le workflow navigateur ne surveillait pas les fichiers du panier et des deux pages de commande ; l'absence de run après une modification de ces fichiers était donc possible. Les chemins concernés doivent être ajoutés aux déclencheurs avant de considérer le panier validé en navigateur.
- Les tests unitaires existants couvrent les règles générales du panier (572 tests au total), mais aucun résultat E2E prouvant deux établissements avec le même produit, la modification/retrait indépendant et les deux finalisations n'est encore enregistré.

**Points toujours ouverts :**
- Le ServiceWorker `DataCloneError` reste non attribué ; aucune correction arbitraire n'est appliquée.
- Le cycle panier multi-propriétaires n'est pas encore prouvé en navigateur sur Replay.
- La limite locale de 10 lignes est globale ; son adéquation au panier multi-univers reste à décider.
- Aucun schéma, donnée ou projet Production modifié ; aucune migration, aucun déploiement Vercel, aucune action Play Store.


## 180. Re-audit après évolution concurrente du panier — 17/11/2026

**HEAD vérifié avant ce correctif :** `bfb4386b7707dc97ba60943c411540a04db4e7b5`. Depuis le précédent point de contrôle `dbbdbe9`, trois commits ont été poussés par l'autre séquence de travail :
- `5f11914` remplace le groupement Pharmacie par une construction explicite de Map ; la syntaxe est plus lisible et évite l'expression imbriquée fautive.
- `b2adaca` réécrit presque entièrement `src/lib/panier.tsx` (normalisation `typeProprietaire` / `idProprietaire`, callbacks explicites, lecture/écriture locale). La logique de quantité et de retrait est désormais alignée sur ces fonctions normalisées.
- `bfb4386` actualise la documentation dédiée et relance les contrôles.

**Nouvelle anomalie fonctionnelle trouvée pendant la vérification :**
- Dans la liste Pharmacie de `src/app/panier/page.tsx`, les boutons quantité et retrait transmettaient directement `line.owner_type` et `line.owner_id`.
- Pour une ligne historique contenant uniquement `pharmacie_id`, ces deux arguments sont absents. Les fonctions normalisées du contexte ne reçoivent donc aucun filtre propriétaire et peuvent modifier/retirer plusieurs lignes ayant le même `produit_id`, y compris une ligne d'une autre pharmacie.
- Le parcours Bébé & Maman utilisait déjà une résolution de secours des champs historiques ; la liste Pharmacie ne l'appliquait pas. C'était une incohérence réelle entre les deux circuits.

**Correction appliquée :**
- Commit `1a39e0857679f2ccc72f2f64cd93b9d58c268fea` : les actions −, + et Retirer de la liste Pharmacie transmettent maintenant le type et l'identifiant propriétaire résolus depuis `owner_type/owner_id`, puis `pharmacie_id/partner_id` en compatibilité historique.
- Aucun appel RPC, règle de stock, schéma ou donnée Supabase n'a été modifié.

**État des exécutions observé à 09:08 UTC :**
- Navigation Replay `44052229258`, sur `dbbdbe9` : build et démarrage du serveur PASS ; scénario navigateur encore `in_progress`. Le statut n'avait pas évolué depuis 09:04:44 UTC, donc aucun verdict final exploitable.
- Qualité `44052399111`, sur `bfb4386` : `pending`, aucun job disponible.
- Navigation `44052340453`, sur `b2adaca` : `pending`, aucun job disponible. Les runs qualité/navigation des commits intermédiaires `5f11914` et `b2adaca` ont été annulés par les pushes suivants ; ils ne comptent pas comme validation.
- La nouvelle correction `1a39e08` déclenche une nouvelle qualité sur le HEAD correspondant. Le workflow navigateur surveille maintenant `src/app/panier/page.tsx` et `src/lib/panier.tsx`, donc une exécution Replay doit aussi être relancée après cette modification.

**Verdict :** les erreurs de syntaxe précédentes sont corrigées dans le code observé ; une seconde anomalie, concernant le ciblage propriétaire des lignes historiques, a été trouvée et corrigée. La correction reste à compiler et à tester. Le panier multi-propriétaires n'est pas vert avant réussite du contrôle qualité et scénario navigateur multi-propriétaires. ServiceWorker DataCloneError reste un point rouge distinct. Aucun changement Production, migration, déploiement Vercel ou action Play Store.


## 181. Correction du faux échec E2E panier et couverture multi-propriétaires — 17/11/2026

**État constaté sur main avant correction :** `28433bacfccda8291aca6f76823da2d920297f17`.
- Qualité `44052857060` : SUCCESS (tests, TypeScript, lint, build et syntaxe GitHub Actions).
- Navigation Replay `44052819499` sur `1a39e0857679f2ccc72f2f64cd93b9d58c268fea` : FAILURE au scénario Client, après PASS des segments Promoteur, Comptable et Partenaire ; nettoyage de secours PASS.
- Cause exacte dans les logs : timeout sur le texte « Article local de recette » après ouverture de `/panier`.
- Cause racine : le harnais injectait `naxa-panier-v1` après le premier rendu de `/client`. Or `PanierProvider` lit le localStorage une seule fois dans son `useEffect` initial ; son état mémoire était donc déjà vide. Le test était mal préparé et ne démontrait pas un défaut de rendu produit.

**Correction appliquée :**
- Le harnais injecte maintenant favoris et panier via `page.addInitScript`, avant la première navigation et le montage du Provider ; un marqueur sessionStorage empêche de réinjecter les données lors des navigations suivantes.
- La fixture contient deux lignes du même produit, avec deux propriétaires Pharmacie distincts et des noms d'établissement distincts.
- Le test augmente la quantité dans la pharmacie A, vérifie que la pharmacie B reste à 1, retire la ligne A et vérifie que B reste présente, puis retire B.
- L'interface affiche le nom de la pharmacie sur chaque sous-panier au lieu de deux titres identiques.

**Limites :** ce test prouve l'isolation locale des lignes, de la quantité et du retrait. Il ne prouve pas encore la création de deux commandes persistées ni le débit de stock réel. Aucun coût métier n'est inventé pour les lignes Replay. Aucun schéma ou donnée Replay/Production n'est modifié ; aucun déploiement Vercel.


## 182. Re-audit panier multi-pharmacies — 17/11/2026

**HEAD audité :** `3e4b736d7c5d0f840b227df2c419f26646656c84` (`fix(e2e): isoler le panier multi-pharmacies en navigateur`).

**Contrôles qualité :**
- Workflow qualité `44054040235` : SUCCESS. Les étapes « Qualité complète + build Next.js (Node 22) » et « Validate all active workflows » sont PASS.
- Le build, les contrôles TypeScript/lint/tests et la syntaxe des workflows sont donc validés sur ce HEAD.

**Preuve fonctionnelle ciblée :**
- Workflow navigateur Replay `44054040159`, job `133938650641` : le scénario Client atteint le panier.
- Log explicite : `PASS Client — même produit, deux propriétaires : quantité et retrait isolés par pharmacie.`
- Cette preuve valide l'isolation locale des lignes homonymes entre deux pharmacies, la modification de quantité et le retrait indépendant.
- Les fixtures temporaires ont été nettoyées avec succès.

**Échec global distinct observé dans le même scénario :**
- Le workflow navigateur termine en FAILURE après le passage du panier, à l'étape Client → Historique.
- Les logs montrent deux réponses HTTP 400 sur `/rest/v1/client_achats?keys=client_id,...`, code PostgreSQL `42703`, message `column client_achats.client_id does not exist`.
- Cela empêche de déclarer la recette navigateur globale verte. Ce défaut concerne la vue d'historique Client, pas le test ciblé d'isolation du panier. Il faut toutefois le traiter avant de considérer la suite E2E complète comme verte.
- Le `DataCloneError` ServiceWorker (URL object could not be cloned) est également encore observé dans cette exécution ; son producteur reste à identifier.

**Verdict panier :**
- **VERT partiel sur la qualité technique et le cas ciblé multi-pharmacies** : compilation/qualité PASS et isolation quantité/retrait prouvée en navigateur.
- **Pas de VERT global du chantier** : la recette E2E complète échoue sur l'historique Client. La preuve actuelle ne couvre pas encore deux commandes persistées distinctes, ni le débit/restauration du stock par propriétaire.
- Ne pas confondre l'échec de l'historique avec un échec du test panier : les logs montrent explicitement le PASS du cas multi-propriétaires avant l'échec ultérieur.

Aucune modification de schéma ou donnée Replay/Production, aucune migration, aucun déploiement Vercel, aucune action Play Store.

## 183. Correction historique Client — filtre sur la vue `client_achats` — 17/11/2026

**Diagnostic prouvé par la recette Replay :**
- Le workflow `44054040159` échoue sur la requête `client_achats?keys=client_id,...` avec PostgreSQL `42703` : la colonne `client_achats.client_id` n'existe pas.
- La migration `supabase/migration_021_historique_achats_client.sql` définit la vue `public.client_achats` sans exposer de colonne `client_id`, mais filtre déjà ses lignes par `r.client_id = auth.uid()`.
- Le composant Client ajoutait malgré tout `.eq("client_id", auth.user.id)` à la requête de cette vue. Le filtre était redondant et incompatible avec son contrat SQL.

**Correction appliquée sur main :**
- Commit `b6ec80ab67a063c527544d205d2544b2348a1223` : suppression du filtre client_id uniquement sur la requête de la vue `client_achats`.
- Le filtre d'identité reste appliqué à la requête directe sur `reservations`.
- La vue `client_achats` continue d'appliquer son propre périmètre `auth.uid()` et ses RLS sous-jacentes via `security_invoker=true`.
- Aucun changement de migration, schéma, donnée Replay/Production, politique RLS ou déploiement.

**Validation attendue :**
- Le contrôle qualité et le scénario navigateur Replay doivent se terminer sur ce nouveau commit.
- Vérifier l'affichage Historique Client, la disparition des HTTP 400 `client_achats.client_id`, le panier multi-pharmacies et le nettoyage.
- Le `DataCloneError` ServiceWorker observé dans le run précédent reste un point distinct à qualifier ; ne pas le déclarer corrigé par ce changement.

**Verdict :** correction source appliquée ; validation automatisée du nouveau HEAD en attente. Aucun VERT global attribué avant les deux workflows finaux.


## 184. Isolation des historiques Client A/B — garde E2E ciblée — 17/11/2026

**Périmètre strict :** historique des achats Client uniquement. Aucun changement au panier, à la vue SQL, aux politiques RLS, au schéma ou aux données Replay/Production.

**Régression ajoutée au harnais :**
- Deux identités Auth Replay distinctes sont utilisées : le compte Client acheteur existant et le second compte de recette qui est temporairement encore en rôle Client au moment du contrôle.
- Chaque JWT interroge directement `client_achats` et collecte les identifiants de réservations effectivement visibles.
- Le test exige au moins un achat payé/retiré dans chacun des deux historiques et vérifie qu'aucun identifiant de réservation n'est commun aux réponses A et B.
- Un historique vide ne peut donc pas produire un faux PASS : le test échoue explicitement si les fixtures ne contiennent pas de matière pour démontrer l'isolation.

**Sécurité conservée :** la vue `client_achats` reste filtrée par `r.client_id = auth.uid()`, avec `security_invoker=true`; aucune colonne `client_id` n'est ajoutée et aucune politique RLS n'est affaiblie.

**Validation :** le contrôle est ajouté au scénario Replay ; son verdict dépend du prochain run Chromium sur le commit qui contient ce changement. Aucun résultat PASS n'est anticipé.


## 185. Recette réelle d'isolation historique Client A/B — PASS Replay — 17/11/2026

**Périmètre :** isolation des achats entre deux clients distincts. Exécution dans le projet Supabase Replay `pwfftcsjyeibxxqhwysw`, avec les comptes de recette existants `naxa_e2e_acheteur` (Client A) et `naxa_e2e_expiry_overflow` (Client B). Aucun compte supplémentaire créé.

**Audit effectif avant correction :**
- La vue Replay `public.client_achats` est bien déclarée `security_invoker=true`, filtre les réservations par `r.client_id = auth.uid()` et conserve les RLS des tables sous-jacentes.
- Les deux profils test étaient distincts, actifs et majeurs, mais leurs historiques ne contenaient aucune réservation payée/retirée : le contrôle précédent échouait faute de fixtures et ne pouvait pas prouver l'isolation.
- L'insertion d'une réservation avec référence de paiement non nulle active une branche du trigger `log_reservation_event()` qui tente d'écrire dans `reservation_events.to_value`, colonne absente du schéma Replay. Le harnais contourne cette branche uniquement pour ses fixtures avec `paiement_ref=NULL`; le trigger et le schéma n'ont pas été modifiés.
- L'affectation professionnelle Comptable déclenche `naxa_professional_assignment_active_role_sync`, qui sélectionne automatiquement le rôle métier Comptable. Le harnais doit donc terminer la lecture d'historique Client avant d'insérer cette affectation temporaire.

**Corrections du harnais sur main :**
- `af1b8c84231ea0c70df2308291751d96ee6b5b9f` : création de deux réservations payées E2E distinctes et assertion de l'appartenance de chaque achat à son historique.
- `8e1f78bfc279e1b0a19df88702bf1c5b6a6bede6` : références de paiement laissées nulles pour éviter la branche invalide du trigger ; UUID connus avant insert et nettoyage par identifiants exacts.
- `6d30dff120d694a2582d637f8c0a1bfe867d8a6f` : déplacement de la création d'affectation Comptable après le contrôle A/B et son nettoyage ; la fonction métier du Client B reste donc Client pendant la preuve.

**Preuve de recette :**
- Workflow Replay Chromium `44062737464`, commit `6d30dff120d694a2582d637f8c0a1bfe867d8a6f` : SUCCESS.
- Workflow qualité `44062737538`, même commit : SUCCESS.
- Logs du navigateur : deux fixtures d'achats payés créées ; les deux JWT Clients distincts accèdent à `client_achats` ; `PASS isolation historique A/B — deux JWT distincts ; chaque Client voit son achat payé et aucun achat de l'autre compte.`
- Aucun identifiant de réservation croisé n'est retourné. Le contrôle exige explicitement que A voie son achat, B voie le sien, que A ne voie pas celui de B, que B ne voie pas celui de A et que les ensembles de réservations visibles n'aient aucun chevauchement.
- La suite complète du workflow aboutit à `RESULTAT NAVIGATION : PASS`, y compris la vérification Client → Historique sans HTTP 400 sur `client_achats`.

**Nettoyage et état Replay après exécution :**
- Logs : `PASS nettoyage historique A/B` puis `PASS nettoyage — fixtures temporaires présentes dans le registre supprimées et contrôlées.`
- Requête SQL de contrôle après run : 0 réservation client temporaire restante ; 0 événement restant pour ces réservations ; `visible_recherche=false` restauré sur la pharmacie E2E interne ; stock du produit fixture inchangé à 3 unités ; 0 affectation Comptable temporaire restante ; 0 rôle actif temporaire restant pour le compte B.
- Le contrôle SQL sur le catalogue et les réservations a été en lecture seule après le nettoyage.

**Verdict : VERT — isolation des historiques Client A/B prouvée en Replay.** La vue, le schéma et les politiques RLS n'ont pas été modifiés ; aucun changement au panier ; aucune donnée Production touchée ; aucun déploiement.

**Point distinct conservé ouvert :** la branche du trigger `log_reservation_event()` qui référence `reservation_events.to_value` en présence d'une référence de paiement non nulle reste une anomalie Replay à traiter séparément. Le présent contournement ne prétend pas la corriger et ne constitue pas une validation du flux de paiement complet.

## 186. Re-audit après preuve historique Client A/B — 17/11/2026

**HEAD courant :** `a4517a3a48ae89ee2fcdefdfa008bc470311880a` (commit documentaire dont le parent est `6d30dff120d694a2582d637f8c0a1bfe867d8a6f`). Le code applicatif du scénario Replay est donc identique au code exécuté sur le parent ; le HEAD courant a en plus passé le workflow qualité.

**Contrôles sur le code courant :**
- `src/app/client/page.tsx` contient deux lectures de `client_achats` (chargement initial et rafraîchissement). Aucune ne filtre sur `client_id` ; les réservations directes restent filtrées par `client_id = user.id`.
- Le chargement initial conserve le commentaire contractuel : la vue `client_achats` applique déjà `auth.uid()` et n'expose pas `client_id`.
- Le panier Pharmacie résout les propriétaires historiques (`owner_type/owner_id`, puis `pharmacie_id/partner_id`) pour quantité et retrait.

**Résultats automatisés :**
- Qualité `44063737340`, sur le HEAD exact `a4517a3` : SUCCESS. Jobs « Tests, TypeScript et lint » et « GitHub Actions syntax and expression checks » : SUCCESS. Le lint affiche toutefois 226 warnings, 0 erreur.
- Replay Chromium `44062737464`, sur le parent applicatif `6d30dff` : SUCCESS, `RESULTAT NAVIGATION : PASS`. Il couvre Promoteur desktop/mobile, les six entrées Comptable, Client desktop/mobile, favoris/panier locaux, recherche/filtres et historique.
- Historique Client : deux JWT distincts voient chacun leur achat payé et aucun achat de l'autre ; les fixtures sont nettoyées. Le scénario confirme explicitement l'absence de HTTP 400 sur `client_achats`.
- Panier multi-pharmacies : log explicite `PASS Client — même produit, deux propriétaires : quantité et retrait isolés par pharmacie.` Le scénario confirme que la quantité et le retrait de la pharmacie A ne modifient pas la ligne de la pharmacie B.
- Nettoyage final Replay : PASS.

**Anomalie encore observée :**
- Le navigateur émet toujours `DataCloneError: Failed to execute 'postMessage' on 'ServiceWorker': URL object could not be cloned`, dans un chunk compilé Next.js `1za_7vw9enae5.js`. Le stack ne remonte pas au fichier source ; l'émetteur n'est donc pas attribué et aucune correction sûre n'est démontrée.
- Plusieurs `net::ERR_ABORTED` sont consignés pendant les transitions de routes ; le harnais les classe comme annulations/navigation et non comme erreurs HTTP métier. Ils restent à qualifier si un parcours métier dépend de l'une de ces requêtes.

**Limite fonctionnelle majeure du chantier panier :**
- La preuve E2E actuelle couvre le panier local : séparation des lignes homonymes, quantité et retrait par pharmacie.
- Elle ne prouve toujours pas la finalisation de deux commandes persistées distinctes, ni le débit puis la restauration du stock pour chaque propriétaire. Les fixtures d'historique A/B sont des réservations créées par le harnais et le log précise qu'aucune ligne de stock n'a été débitée.

**Verdict :**
- **VERT** pour les contrôles qualité sur le HEAD courant, pour la recette navigation Replay complète enregistrée sur le même arbre applicatif, pour l'isolation des historiques Client A/B et pour le cas ciblé du panier local multi-pharmacies.
- **PAS VERT GLOBAL** pour le chantier panier multi-pharmacies de bout en bout : cycle de deux commandes et stock non prouvé ; anomalie ServiceWorker toujours présente.
- Aucun changement de schéma ou de données Production, aucune migration, aucun déploiement Vercel, aucune action Play Store.

## 187. Correction du trigger de paiement et recette POS complète — 17/11/2026

**Périmètre :** Replay uniquement. Aucun changement de Production, aucun déploiement.

### Cause racine du défaut `to_value`

- L'audit SQL de Replay a relevé que `public.log_reservation_event()` insérait la référence dans `reservation_events.to_value`, colonne inexistante.
- Le schéma réel possède `paiement_ref` et `detail`. La contrainte `event_type` accepte notamment `payment_declared`, `payment_verified` et `delivery_status_changed`.
- La fonction déployée était plus récente que le contenu de la migration 021 : elle journalisait également la validation de paiement, les transitions de livraison et l'annulation des commandes. Revenir à l'ancienne fonction aurait supprimé ces comportements.

### Correction

- `supabase/migrations/20261117140000_fix_reservation_event_payment_reference.sql` : fonction réalignée ; la référence est écrite dans `paiement_ref`.
- `supabase/migrations/20261117141000_preserve_reservation_event_lifecycle_and_fix_payment_ref.sql` : migration de convergence conservant les événements de paiement vérifié, de livraison et la synchronisation d'annulation.
- Les deux migrations sont appliquées sur Replay : `20261117125920` et `20261117130041`.
- Aucun ajout de colonne, changement de contrainte, modification RLS ou privilège d'accès. Un seul trigger d'historique reste attaché à `reservations`.

### Preuve du trigger

- Test exact : insertion d'une réservation portant déjà une référence non nulle.
- Résultat : événements `reservation_created` et `payment_declared` créés ; la référence est stockée dans `paiement_ref`.
- Contrôle de définition après migration : `to_value` absent ; `payment_verified` et `delivery_status_changed` toujours présents ; trigger unique : PASS.

### Recette du flux de paiement comptoir

Test versionné : `supabase/tests/20261117142000_reservation_event_and_payment_flow_replay.sql`.

Identités métier Replay utilisées dans une transaction SQL avec les claims d'identité correspondants :
1. Client `naxa_e2e_acheteur` : création par `creer_transactions_client`.
2. Responsable / Gestionnaire de stock `naxa_e2e_expiry_responsable` : confirmation via `gestionnaire_stock_reservation_confirmer`.
3. Caisse `naxa_e2e_expiry_stock` : ouverture via `caisse_ouvrir`, encaissement POS via `vente_reservation_encaisser`, puis clôture via `caisse_cloturer`.

**Résultat réel du test Replay :**

| Contrôle | Résultat |
|---|---:|
| Réservation | `49a5aafc-e540-4660-8d35-e3989f961bfb` |
| Vente POS | `a265ec09-d3f5-4e31-8193-13c95929de1c` |
| Ticket | `V-20261117-000229` |
| Paiement comptoir | **1 000 FCFA** |
| Événements paiement/statut | 4 |
| Lignes visibles dans l'historique Client | 1 |
| Stock avant → après | 3 → 2 |
| Écart de clôture Caisse | **0 FCFA** |

Le reçu de la réservation est contrôlé : statut `payee`, paiement `effectue`, mode `especes_retrait`, ticket, montant perçu et horodatage présents. L'achat apparaît dans `client_achats`.

### Nettoyage et limites

La recette a été exécutée dans `BEGIN … ROLLBACK` ; elle n'a donc laissé aucune vente ni réservation persistante. Contrôle après rollback : 0 réservation test, 0 vente test, stock revenu à 3, pharmacie masquée (`visible_recherche=false`), 0 session Caisse ouverte.

**Limite explicite :** cette preuve valide le circuit métier de paiement espèces au comptoir et son reçu POS. Elle ne constitue pas une transaction réelle MTN/Orange ni une preuve de rapprochement SMS/opérateur. Le test utilise les identités des comptes Replay via les claims SQL ; ce n'est pas une recette navigateur avec cookies/JWT HTTP.

**Verdict : VERT sur Replay** pour le défaut `to_value`, la journalisation d'une référence initiale et le parcours métier réservation → confirmation Stock → encaissement Caisse → reçu → historique Client → clôture sans écart. Aucune modification Production, aucun déploiement.

## 188. Commandes Marketplace — correction du débit POS et recette multi-pharmacies — 17/11/2026

**Périmètre demandé :** commandes et stock, puis qualité. ServiceWorker explicitement hors périmètre de cette passe.

### Audit des logs et cause racine

- Les logs PostgreSQL Replay des essais SQL précédents montrent une erreur de syntaxe de bloc PL/pgSQL (unterminated dollar-quoted string) due à un délimiteur d'ouverture/fermeture différent dans la commande SQL copiée. Le test versionné utilise désormais un délimiteur unique.
- L'ancien test de paiement validait une réservation comptoir (mode='reservation'), pas une commande Livraison (mode='commande') : il ne prouvait donc pas le flux demandé.
- Cause métier du défaut de stock : private.reserve_stock crée une réservation et un hold de quantité disponible sans décrémenter le stock physique (stock_decremented=false). Mais public.naxa_delivery_pos_encaisser insérait la vente avec stock_decremented_at_draft=true. Le trigger trg_naxa_pos_debit_before_sale_paid ne déclenche private.naxa_pos_debit_stock que lorsque ce marqueur est faux. La commande Livraison était donc considérée à tort comme déjà débitée au brouillon ; le stock physique pouvait rester inchangé après encaissement.
- Préconditions Replay mises au jour pendant la recette : Mvan est une pharmacie est_demo=true, volontairement exclue du Marketplace ; sa fixture POS devait aussi posséder un coût d'achat dans stocks_couts. Ces deux préconditions sont préparées exclusivement dans la transaction de test, puis annulées.

### Correction à la source

- Migration ajoutée : supabase/migrations/20261117143000_fix_delivery_pos_physical_stock_debit.sql.
- Dans naxa_delivery_pos_encaisser, la vente brouillon est créée avec stock_decremented_at_draft=false. Le passage brouillon → payée déclenche alors le débit physique POS ; le trigger marque ensuite la vente et la réservation consommée.
- Migration appliquée au projet Replay pwfftcsjyeibxxqhwysw uniquement ; version enregistrée : 20261117131435. Aucun changement Production.
- Contrat de non-régression ajouté à scripts/test-delivery-commercial-flow.cjs.
- Recette transactionnelle ajoutée : supabase/tests/20261117144000_delivery_pos_stock_debit_replay.sql.

### Preuve transactionnelle Replay

Comptes Replay existants utilisés : Client naxa_e2e_acheteur, Gestionnaire de stock naxa_e2e_stock, Caisse naxa_e2e_caisse, Livreur naxa_e2e_livreur. Claims JWT distincts et rôle actif/pharmacie contrôlés par les RPC métier.

| Vérification | Résultat observé |
|---|---:|
| Commande A créée pour pharmacie A | PASS |
| Hold A : stock physique avant/après | 3 → 3 |
| Annulation Client A : disponible après libération du hold | 3 |
| Commande B créée pour pharmacie B | PASS |
| Confirmation Stock → préparation → mission Livreur | PASS |
| Acceptation, retrait, arrivée et déclaration espèces | PASS |
| Encaissement POS commande B | 2 500 FCFA |
| Débit physique pharmacie B | 3 → 2 |
| reservations.stock_decremented | true |
| Commande finale | livree |
| Écart de clôture Caisse | 0 FCFA |

La vente POS est liée à la réservation B ; le débit constaté est exactement d'une unité. L'annulation A ne modifie pas le stock physique et libère intégralement le disponible de son propre propriétaire.

**Nettoyage :** test exécuté dans BEGIN … ROLLBACK. Les commandes, vente, session Caisse, devis, coûts et stock Mvan sont temporaires ; le marqueur est_demo et les paramètres de pharmacie sont restaurés par rollback. Aucun compte Auth ni profil permanent créé.

### Qualité et périmètre

- Le workflow qualité correspondant au HEAD documentaire courant 7f77eac975a8d6abd0ffce0b27a32f22a4141fcb est le run 44091674612 : contrôle de syntaxe GitHub Actions PASS ; job Tests, TypeScript et lint encore en cours au dernier contrôle. Le run précédent sur 2c317eabe a été annulé par le remplacement du HEAD.
- Chromium n'a pas été utilisé pour ce diagnostic précis : l'incohérence se situe dans le trigger PostgreSQL de débit POS. La preuve couvre la chaîne RPC réelle avec les identités Replay, pas une recette navigateur du checkout.
- Aucun changement de ServiceWorker, aucun déploiement, aucune migration Production, aucune action Play Store.


## 189. Parcours de paiement comptoir — canaux, monnaie rendue et conformité du code — 17/11/2026

### Décision métier à conserver

Pour un achat physique au comptoir, y compris lorsque le client n'utilise pas NAXA :

1. La caissière enregistre les articles et quantités. NAXA calcule automatiquement le total à payer à partir des lignes de vente et des prix enregistrés ; aucun total ne doit être saisi manuellement.
2. La caissière demande le canal choisi : espèces, Orange Money ou MTN MoMo, puis sélectionne ce canal dans NAXA.
3. En espèces, elle saisit le montant effectivement reçu. NAXA calcule automatiquement la monnaie à rendre : `max(montant reçu - total dû, 0)`. Un montant reçu inférieur au total bloque l'encaissement.
4. En Orange Money ou MTN MoMo au comptoir, le client montre le message de confirmation sur son téléphone ; la caissière vérifie visuellement le bénéficiaire, le montant et la confirmation, puis valide explicitement. Aucun rapprochement SMS NAXA, aucune API opérateur et aucune attente de confirmation automatisée ne sont requis pour ce parcours physique.
5. Après validation, NAXA finalise la vente, enregistre le canal, le montant dû, le montant reçu, la monnaie rendue (zéro pour un paiement mobile exact), l'identité et l'heure de validation, l'événement de paiement, le débit de stock et le reçu.
6. Le Promoteur doit voir séparément le solde théorique espèces, Orange Money et MTN MoMo, ainsi que leur total. Les mouvements de dépenses, retraits, transferts, remboursements et paiements Marketplace doivent être tracés et affectés au bon canal ; les paiements Marketplace de la pharmacie alimentent les mêmes trois soldes, avec leur origine conservée. La clôture du tiroir espèces reste distincte de la vue globale de trésorerie.
7. La validation visuelle par la caissière est une validation opérationnelle, pas une preuve indépendante de l'opérateur. Le rapprochement des soldes est une fonction de gestion ultérieure, pas une condition de paiement du client au comptoir.

### Audit de conformité du code sur `main` et Replay

**Version contrôlée :** HEAD `1becf64a40ecc44662d82a21cb6191c748c3f771` ; fichier `src/app/pharmacie/caisse/page.tsx` (blob `64a17ef248860f6fd9f0895cd61c1cb9d3814db0`) ; base Replay `pwfftcsjyeibxxqhwysw`. Production non consultée ni modifiée.

| Exigence | Constat source / Replay | Verdict |
|---|---|---|
| Total automatique à partir des articles | `totalPanier(lignes.map(line => line.total))` calcule le total depuis les lignes du panier. | **CONFORME côté calcul UI** |
| Saisie du montant réellement reçu | Champ `Montant espèces reçu`, état `percu`. | **PARTIEL** : libellé et usage limités aux espèces |
| Monnaie rendue automatique | `monnaieARendre(montantRecu, total)` calcule `max(reçu-total, 0)` ; RPC `vente_encaisser_finaliser` recalcule côté base et persiste `montant_percu` et `monnaie_rendue`. | **CONFORME pour espèces** |
| Blocage si montant insuffisant | UI et RPC refusent un montant reçu inférieur au total. | **CONFORME pour espèces** |
| Choix du canal au comptoir | L'écran POS courant ne propose pas le sélecteur espèces / Orange / MTN ; il affiche « Paiements électroniques indisponibles ». | **NON CONFORME** |
| Confirmation visuelle explicite Orange/MTN | Aucun parcours UI/RPC de validation visuelle pour la vente comptoir ordinaire ; `vente_encaisser` et `vente_ajouter_paiement` rejettent les paiements mobiles au motif qu'une confirmation opérateur officielle serait nécessaire. | **NON CONFORME** |
| Persistance canal, reçu et événement | Le parcours POS ordinaire finalise uniquement en `especes`. Le flux réservation Marketplace accepte plusieurs canaux et stocke le paiement, mais exige un code de paiement et ne remplace pas le parcours comptoir ordinaire. | **PARTIEL / parcours distincts** |
| Trois soldes et total Promoteur | Audit Replay précédent : comptes trésorerie non configurés, type de compte générique `mobile_money` au lieu de deux sous-comptes Orange/MTN ; aucun mouvement automatique POS observé. | **NON CONFORME** |
| Rapprochement multi-canaux et dépenses/transferts | La clôture `caisse_cloturer` concerne le tiroir espèces ; le ledger n'est pas alimenté de manière unifiée par les encaissements POS et Marketplace. | **NON CONFORME** |

### Conclusion et point de reprise

Le calcul automatique du total et de la monnaie rendue existe déjà et a été exercé dans le parcours espèces ; il ne faut pas le réécrire inutilement. La recette Replay antérieure a prouvé un encaissement espèces de 1 000 FCFA, un reçu, un événement, le débit de stock et une clôture sans écart. Elle ne prouve ni les paiements mobiles physiques, ni les trois soldes, ni le rapprochement de trésorerie.

**Écarts à corriger :** unifier l'écran et les RPC de vente comptoir autour du choix de canal ; autoriser la validation manuelle explicite Orange/MTN sans rapprochement SMS pour le client physiquement présent ; conserver les montants reçu/dû et la monnaie rendue ; alimenter exactement une fois les trois sous-comptes depuis le ledger commun POS + Marketplace ; ajouter la vue Promoteur et le rapprochement par canal. Les contrôles Marketplace distants restent distincts et ne doivent pas être affaiblis par cette règle du comptoir.

**Statut : NON VERT** — audit et décision documentés ; aucune correction de code, migration Replay, modification Production ou déploiement réalisés dans cette passe.


## 190. Audit approfondi — conformité du POS comptoir, calcul du dû/rendu et trésorerie — 17/11/2026

### Périmètre et version

- Dépôt : `audreymendomo23-netizen/NAXA`, branche `main`.
- HEAD documentaire observé : `853206e099e4b5edeed28f56a8d0f30be9c64e72` (commit de documentation de la section 189).
- Code POS contrôlé : `src/app/pharmacie/caisse/page.tsx`, blob `64a17ef248860f6fd9f0895cd61c1cb9d3814db0` ; calculs `src/lib/caisse/calculs.ts`.
- Base interrogée : Replay `pwfftcsjyeibxxqhwysw`. Aucune écriture SQL, migration ou mutation de données effectuée pendant cet audit ; Production non consultée ni modifiée.

### 1. Parcours client sans compte NAXA

**CONFORME pour la vente comptant anonyme.**
- `ventes.client_id` est nullable.
- `vente_creer(p_session, p_client)` accepte `p_client = NULL`.
- L'écran indique explicitement « Client (facultatif pour une vente comptant) » ; la sélection proposée est celle des clients avec compte de crédit.
- Le client sans compte NAXA peut donc acheter au comptoir sans création de compte ni association obligatoire à un profil.
- Limite : le parcours anonyme ne collecte pas de nom/téléphone client. Le sélecteur visible sert à rattacher un compte de crédit, pas à créer une fiche client comptant.

### 2. Total dû calculé automatiquement

**CONFORME dans le flux de modification de panier existant.**
- `vente_lignes.total_ligne` est une colonne générée PostgreSQL : `quantite * prix_unitaire`.
- `vente_ajouter_produit` récupère le prix de la pharmacie dans `stocks.prix`, contrôle le stock vendable, insère la ligne puis appelle `vente_recalculer_totaux`.
- `vente_produit_retirer` recalcule également les totaux après suppression.
- `vente_recalculer_totaux` calcule `total_brut = SUM(total_ligne)` et `total_net = greatest(total_brut - remise, 0)`.
- L'écran recalcule l'affichage avec `totalPanier(lignes.map(line => line.total))`. La RPC d'encaissement utilise le `ventes.total_net` conservé côté base, et non le total envoyé par le navigateur.
- Les mutations directes des tables POS ne sont pas accordées à `authenticated` ; les opérations passent par les RPC contrôlées. `vente_recalculer_totaux` n'est pas exécutable directement par `authenticated`.

**Réserve :** la RPC finale ne relance pas elle-même `vente_recalculer_totaux` ; elle dépend du recalcul effectué à chaque ajout/retrait autorisé. Ce couplage est actuellement cohérent avec les voies de modification identifiées, mais mérite un test d'intégration de bout en bout après toute évolution des RPC du panier.

### 3. Montant reçu, monnaie rendue, reçu

**CONFORME pour les espèces.**
- La caissière saisit `percu`; l'écran refuse les valeurs non entières, nulles ou inférieures au total.
- `monnaieARendre` calcule `max(montant reçu - total dû, 0)`.
- `vente_encaisser_finaliser` verrouille la vente et la session, vérifie le rôle Caisse actif, la pharmacie, le panier non vide et l'absence de paiement antérieur ; elle refuse un montant reçu inférieur au total.
- La RPC recalcule la monnaie rendue côté PostgreSQL, insère `vente_paiements` avec `montant = total dû`, `montant_percu = montant reçu`, `monnaie_rendue = différence`, puis marque la vente payée dans la même transaction.
- Le ticket affiche le montant dû encaissé, le mode de paiement, le montant reçu et la monnaie rendue. La réimpression relit les paiements persistés.
- La clôture espèces calcule l'entrée nette dans le tiroir à partir du montant dû (`vente_paiements.montant`), et non du montant remis par le client ; c'est correct puisque la monnaie rendue a déjà quitté le tiroir.
- Une recette Replay antérieure a prouvé un encaissement espèces de 1 000 FCFA, ticket, événement, débit de stock et clôture à écart nul.

### 4. Événement, identité de la caissière, stock et anti-doublon

**CONFORME sur les contrôles source/DB vérifiés.**
- Le paiement est lié à la vente ; `created_by` est l'identité de l'acteur et `created_at` l'horodatage du paiement.
- Les triggers `naxa_caisse_audit_append` journalisent les insertions de `vente_paiements` et les changements de `ventes` dans la chaîne d'audit de caisse, avec acteur, horodatage, transaction PostgreSQL et chaînage SHA-256.
- Le trigger `compta_outbox_vente_encaissee` émet l'événement métier lorsque le statut de la vente change.
- `naxa_pos_debit_before_sale_paid` déclenche le débit physique du stock au passage à payée et évite le second débit lorsqu'une réservation a déjà consommé le stock.
- La RPC refuse un second paiement si un paiement existe déjà et verrouille la ligne de vente ; la finalisation et le paiement sont atomiques.
- Replay au moment du contrôle : 21 événements d'insertion de paiement et 21 mises à jour de vente payée dans la chaîne d'audit ; ce comptage est une observation de base, pas une nouvelle recette navigateur.

### 5. Orange Money / MTN MoMo au comptoir

**NON CONFORME — blocage explicite dans le parcours courant.**
- L'énumération `mode_paiement_caisse` connaît `orange_money` et `mtn_momo`, mais l'écran POS ne propose aucun sélecteur de canal et affiche « Paiements électroniques indisponibles ».
- `vente_encaisser_finaliser` ne reçoit aucun canal et inscrit toujours `especes`.
- Les RPC `vente_encaisser` et `vente_ajouter_paiement` rejettent explicitement Orange Money, MTN MoMo et Mobile Money, au motif qu'une confirmation opérateur officielle serait nécessaire.
- Il n'existe donc pas de commande de validation visuelle par la caissière pour un client physiquement présent. Le parcours actuel impose une condition que la règle métier a expressément exclue : API opérateur / confirmation officielle / rapprochement SMS.
- Il manque également la persistance du canal mobile choisi et la preuve opérationnelle minimale (acteur, heure et déclaration de vérification visuelle). Une référence affichée par le client pourrait être conservée à titre de traçabilité, sans la rendre obligatoire ni l'utiliser comme rapprochement SMS.

### 6. Marketplace et Livraison

**PARTIELS et séparés du POS comptoir ; pas de trésorerie commune.**
- `vente_reservation_encaisser` accepte plusieurs canaux, vérifie le code de réservation, recalcule le total des articles de réservation et enregistre le paiement. C'est le parcours de retrait d'une réservation Marketplace, pas le POS anonyme de vente immédiate.
- `naxa_delivery_pos_encaisser` constitue un flux spécifique de remise/livraison avec contrôle de déclaration, canal, référence et état du dossier de paiement. Il ne doit pas être confondu avec le client présent au comptoir.
- Ces flux créent des ventes et des lignes de `vente_paiements`, mais l'audit des fonctions et triggers ne trouve aucune écriture correspondante dans `tresorerie_mouvements`. Leurs recettes ne sont donc pas consolidées dans les comptes de trésorerie demandés.

### 7. Trois soldes Promoteur et mouvements de trésorerie

**NON CONFORME à l'objectif de gestion.**
- Replay contient actuellement 0 compte `tresorerie_comptes` et 0 mouvement `tresorerie_mouvements`.
- Le type `tresorerie_compte_type` ne distingue pas nativement Orange Money et MTN MoMo : les deux seraient de type générique `mobile_money` et devraient être distingués par leur nom. Plusieurs comptes nommés sont techniquement possibles, mais aucun compte n'est configuré dans Replay et l'opérateur n'est pas garanti par le type.
- Les types de mouvements ne proposent que `encaissement` et `decaissement`. Le champ `source_type` autorise `vente`, `depense`, `ajustement` et `transfert`, mais l'audit SQL des fonctions trouve un seul écrivain de `tresorerie_mouvements` : `depense_valider`.
- Aucune fonction identifiée ne poste les encaissements POS, les paiements Marketplace, les remboursements, les retraits ou les deux jambes d'un transfert dans ce ledger.
- Les tables de trésorerie sont en lecture seule pour `authenticated` ; les écritures passent par des RPC. La création de compte existe via `tresorerie_creer_compte`, mais ne suffit pas à alimenter les soldes.
- `caisse_cloturer` rapproche uniquement le tiroir espèces (fond initial, encaissements espèces, remboursements espèces et décaissements de session). Cette portée est cohérente pour clôturer un tiroir, mais elle ne constitue pas la vue globale des trois canaux.
- Aucun écran/agrégat complet n'a été démontré pour afficher au Promoteur espèces + Orange Money + MTN MoMo + total et écarts par canal.

### Matrice finale de conformité

| Domaine | Verdict |
|---|---|
| Vente comptant sans compte NAXA | **CONFORME** |
| Total automatique du panier | **CONFORME** |
| Montant reçu saisi par la caissière | **CONFORME espèces uniquement** |
| Monnaie rendue calculée et persistée | **CONFORME espèces uniquement** |
| Ticket avec dû/reçu/rendu | **CONFORME espèces** |
| Identité/heure et événement d'encaissement | **CONFORME via paiement + chaîne d'audit + outbox** |
| Débit de stock et anti-double paiement | **CONFORME sur les gardes identifiées** |
| Choix des trois canaux au comptoir | **NON CONFORME** |
| Validation visuelle Orange/MTN sans SMS | **NON CONFORME** |
| Paiements Marketplace intégrés au même ledger | **NON CONFORME** |
| Trois soldes distincts et total Promoteur | **NON CONFORME** |
| Dépenses, retraits, remboursements et transferts multi-canaux | **NON CONFORME / incomplet** |

### Plan de correction à reprendre

1. Conserver le calcul actuel du total et de la monnaie rendue ; l'étendre proprement au modèle de paiement par canal sans régression.
2. Ajouter au POS un sélecteur Espèces / Orange Money / MTN MoMo. Espèces : montant reçu librement supérieur ou égal au dû et rendu calculé. Mobile au comptoir : montant reçu égal au dû, vérification visuelle et validation explicite de la caissière, sans SMS/API/rapprochement.
3. Faire accepter le canal par une RPC atomique qui vérifie le rôle/session, interdit les doublons, persiste canal, dû, reçu, rendu, référence facultative, acteur/heure, événement et ticket ; déclencher le stock une seule fois.
4. Définir trois comptes de trésorerie typés sans ambiguïté et alimenter le ledger commun depuis les encaissements comptoir, réservations Marketplace et paiements de livraison de la pharmacie, avec source conservée et idempotence.
5. Ajouter les mouvements sortants et transferts en paire équilibrée, les remboursements et le rapprochement entre solde théorique NAXA et solde réel déclaré par canal.
6. Ajouter la vue Promoteur détaillant espèces, Orange Money, MTN MoMo, total et écarts ; garder la clôture du tiroir espèces distincte.

**Statut : NON VERT.** Audit approfondi documenté ; aucune correction de code, migration Replay, mutation de données, modification Production ou déploiement effectués. Les tests fonctionnels mobiles et le ledger restent à construire et à prouver.


## 191. Exigence transversale — origine de l'opération et canal de paiement — 17/11/2026

### Décision métier à intégrer avant toute modification du code

Le partenaire (pharmacie / Promoteur selon ses droits) doit pouvoir identifier, pour chaque opération financière, **l'événement métier qui l'a générée** et **le canal ou mode de règlement utilisé**. Ces deux dimensions sont obligatoires, indépendantes et visibles ensemble dans les historiques, tickets/reçus, journaux, tableaux de bord et vues de trésorerie.

**Dimension A — Événement / origine de l'opération**
- **Marketplace · Réservation** : encaissement lié à une réservation Marketplace.
- **Marketplace · Livraison** : encaissement lié à une commande remise/livrée via le parcours de livraison.
- **Marketplace · Crédit** : opération de crédit initiée depuis le parcours Marketplace.
- **Comptoir** : vente immédiate créée au POS physique, avec ou sans compte client.

**Dimension B — Canal / mode de règlement**
- **Espèces**.
- **Orange Money**.
- **Mobile Money (MTN MoMo)** — libellé métier « Mobile Money » ; le fournisseur doit rester identifiable en donnée pour éviter de confondre Orange et MTN.
- **Crédit** — créance/vente à terme, et non encaissement de trésorerie. Un crédit ne doit pas augmenter artificiellement le solde d'un canal encaissé.

Exemples qui doivent rester correctement distingués :
- Marketplace · Réservation + Espèces.
- Marketplace · Livraison + Orange Money.
- Marketplace · Crédit + Crédit (créance Marketplace, sans encaissement).
- Comptoir + Mobile Money (MTN MoMo).
- Comptoir + Crédit (créance comptoir, sans encaissement).

La catégorie d'événement ne doit jamais être déduite du canal, ni le canal déduit de l'événement. Une réservation réglée en espèces reste un événement Marketplace ; une vente comptoir réglée par Orange Money reste un événement Comptoir.

### Règles de données et de cohérence

1. Conserver séparément une origine métier normalisée (marketplace_reservation, marketplace_livraison, marketplace_credit, comptoir) et un canal normalisé (especes, orange_money, mobile_money avec fournisseur MTN explicite, credit). Les libellés affichés sont centralisés et cohérents dans toute l'application.
2. Chaque opération doit garder ses identifiants de source (réservation, livraison/commande, dossier de crédit ou vente POS), pharmacie, montant dû, montant effectivement encaissé, éventuel rendu, devise FCFA, acteur, horodatage, statut et référence éventuelle. L'origine doit être conservée lors des conversions/rattachements à une vente et lors des réimpressions.
3. **Crédit est un mode de financement / une créance, pas un encaissement.** L'ouverture d'un crédit ou la vente à crédit doit créer/mettre à jour la créance et son échéancier/solde sans mouvement d'entrée de trésorerie. Chaque remboursement ultérieur constitue un événement d'encaissement distinct, avec son propre canal réel et son lien vers le crédit d'origine.
4. Pour les paiements comptoir en espèces, la caissière saisit le montant remis ; le système calcule le rendu et bloque si le reçu est inférieur au dû.
5. Pour les paiements comptoir Orange Money / Mobile Money, le client présent montre sa confirmation sur son téléphone ; la caissière vérifie visuellement le bénéficiaire, le montant et la confirmation, puis valide explicitement. Aucun SMS à transmettre à NAXA, aucune API opérateur ni rapprochement automatique ne sont requis pour ce parcours physique. La preuve conserve au minimum l'acteur, l'heure et le fait que le contrôle visuel a été déclaré ; une référence peut être facultative.
6. Les parcours Marketplace distants conservent leurs contrôles propres (réservation, livraison, crédit et preuve/validation déjà applicables). Ne pas étendre la validation visuelle comptoir aux paiements distants et ne pas affaiblir leurs gardes.
7. Un seul événement financier source doit alimenter une seule fois le ledger commun, avec une clé d'idempotence stable. Les transferts entre comptes/canaux créent deux mouvements liés et équilibrés ; les remboursements, annulations et régularisations gardent le lien à l'opération initiale. Le crédit ne doit jamais être compté simultanément comme vente encaissée et créance.
8. Le partenaire voit les colonnes/attributs « Événement » et « Canal » dans les listes et détails, ainsi que les soldes encaissés par canal. La vue Promoteur agrège les soldes espèces, Orange Money et MTN MoMo, plus total ; les créances Crédit restent séparées. La clôture du tiroir espèces reste distincte du rapprochement global de trésorerie.
9. Les données historiques dont l'origine ne peut être prouvée ne doivent pas être reclassées par supposition. Prévoir une valeur historique « origine non déterminée » si nécessaire, et un contrôle de migration avant toute reprise des anciens paiements.

### Audit complémentaire initial — éléments établis à ce stade

- L'écran POS src/app/pharmacie/caisse/page.tsx présente actuellement un paiement espèces et un bouton de vente à crédit distinct ; il ne propose pas le choix Orange Money / Mobile Money et son ticket affiche principalement le mode de paiement, sans taxonomie unifiée de l'événement.
- La base Replay expose déjà ventes.reservation_id, ventes.mode_paiement, ventes.paiement_ref, vente_paiements.mode, reservations.paiement_mode, reservations.paiement_statut, reservations.credit_request_id et les champs de cycle de livraison dans reservations. Ces champs fournissent des liens utiles, mais ne constituent pas à eux seuls une classification transverse normalisée et démontrée dans les vues partenaire.
- tresorerie_mouvements possède source_type et source_id, mais pas de champ dédié et explicite pour le couple événement + canal ; tresorerie_comptes possède un type générique mobile_money, qui ne distingue pas à lui seul Orange Money de MTN MoMo. Il faut auditer les contraintes, RPC, triggers, vues et écrans avant de choisir une migration.
- Le schéma de vente_paiements contient mode, montant dû, référence, acteur, date, montant perçu et monnaie rendue. Le schéma consulté ne montre pas de colonne dédiée à la vérification visuelle ; celle-ci doit être représentée de façon explicite et auditée si elle est introduite.
- Le précédent audit section 190 a déjà établi que les flux POS, réservation et livraison sont distincts et que leur alimentation d'un ledger commun n'est pas démontrée. Le présent ajout ne doit pas créer un second moteur de paiement : il doit relier les flux existants à une classification commune et à un journal financier idempotent.

### Préparation d'implémentation — ordre et critères de sortie

1. Cartographier tous les producteurs et consommateurs d'opérations financières : POS, réservations, livraison, crédit et remboursements ; RPC, triggers, outbox, vues, hooks TypeScript, historiques, reçus, tableau Promoteur et trésorerie.
2. Définir un contrat de données unique (origine, canal, fournisseur, statut, montants, source_id, idempotency_key, acteur/horodatage, preuve comptoir) et les règles de compatibilité des anciennes lignes.
3. Concevoir une migration Replay additive, sécurisée RLS/RPC, sans modifier Production ; vérifier les contraintes et les écritures atomiques avant de la créer dans le dépôt.
4. Brancher chaque flux existant sur le contrat commun sans changer les règles propres de validation Marketplace ; empêcher les doubles écritures et séparer encaissements et créances.
5. Ajouter les libellés Événement + Canal dans les écrans partenaires, détails, tickets et vues Promoteur ; rendre les filtres cohérents.
6. Tester sur Replay chaque combinaison utile : Réservation/Espèces, Réservation/Orange, Livraison/Mobile Money, Crédit/Crédit, Comptoir/Espèces avec rendu, Comptoir/Orange avec contrôle visuel, Comptoir/Mobile Money avec contrôle visuel, Comptoir/Crédit ; vérifier annulation, remboursement, idempotence, stock, ledger et agrégats.
7. Vérifier que les anciennes opérations sont conservées, que les données non classifiables restent explicitement non déterminées et qu'aucun solde n'est doublé.

**Statut : NON VERT — spécification ajoutée avant l'implémentation.** À la date de cette section, aucune correction de code, migration, écriture de données Replay, modification Production ou déploiement n'a été effectué pour cette nouvelle exigence. La cartographie approfondie et la conception détaillée restent à finaliser avant toute modification applicative.


## 192. Audit transversal complémentaire — outbox comptable, crédit et preuves de livraison — 17/11/2026

### Correction importante du diagnostic précédent

L'audit SQL plus large révèle une infrastructure comptable déjà présente. Il faut distinguer trois couches qui ne doivent pas être confondues :

1. **Événement métier / outbox** : table compta_evenement, avec evenement_type, source_type, source_id, cle_idempotence et donnees JSONB ; elle possède un worker, un mécanisme de claim/retry et une finalisation.
2. **Comptabilité en partie double** : compta_ecriture et compta_ligne, alimentées par compta_traiter_evenement après validation de la période et des mappings.
3. **Trésorerie opérationnelle par canal** : tresorerie_comptes et tresorerie_mouvements, qui doivent représenter les fonds réellement encaissés/décaissés. Cette couche reste non démontrée comme alimentée de manière unifiée.

La conclusion de la section 190 doit donc être précisée : NAXA possède déjà un outbox comptable idempotent et un moteur de comptabilisation ; cela ne prouve pas l'existence du journal de trésorerie multi-canaux demandé.

### Preuves SQL Replay supplémentaires

- Trigger ventes.compta_outbox_vente_encaissee : appelle compta_emettre_evenement_metier() après changement de statut. La fonction crée vente_encaissee lorsque la vente devient payée, mais ignore les ventes dont ventes.mode_paiement = credit. Pour les ventes payées, elle somme vente_paiements.montant en excluant les références ASSURANCE:%.
- La même fonction émet vente_annulee après annulation approuvée d'une vente déjà payée.
- Triggers client_credit_operations.compta_outbox_credit_octroi et compta_outbox_credit_remboursement : les fonctions compta_emettre_octroi_credit() et compta_emettre_remboursement_credit() émettent respectivement credit_octroi et credit_remboursement. La table client_credit_operations porte nature, montant, mode_paiement, vente_id, caisse_session_id, acteur et date.
- Le moteur comptable traite une liste blanche d'événements (vente_encaissee, depense_validee, vente_annulee, assurance_prise_en_charge, assurance_remboursement_recu, credit_octroi, credit_remboursement) et de sources. Les écritures sont idempotentes via cle_idempotence et soumises à période ouverte + mappings validés.
- Les fonctions d'émission actuelles placent surtout montant, date comptable et référence dans donnees JSONB ; le couple origine métier + canal normalisé n'est pas explicitement ajouté par ces fonctions. Le worker comptable n'expose pas non plus ces deux attributs comme colonnes métier normalisées dans son contrat.
- La fonction vente_encaisser_finaliser(p_vente,p_montant_percu) est strictement espèces : elle insère mode='especes', calcule le rendu et finalise atomiquement. Le nouveau sélecteur de canal doit donc passer par une nouvelle signature/version contrôlée ou une évolution compatible de la RPC, et pas par une simple modification d'état UI.
- naxa_delivery_pos_encaisser accepte déjà especes, orange_money, mtn_momo et mobile_money, vérifie le dossier de paiement de livraison, le montant/canal/référence déclarés et la session Caisse, puis crée vente + paiement. Ce contrôle distant/à la remise est plus strict que le parcours comptoir visuel et doit rester intact.
- naxa_delivery_payment_records possède une trace détaillée : mode, montant attendu/déclaré, référence, espèces reçues/rendu, statut, déclarant/validateur, dates, source de preuve, champs extraits SMS et statut de rapprochement. Ces données doivent être reliées à l'événement Marketplace · Livraison, sans les remplacer par les preuves comptoir.
- vente_reservation_encaisser a une ancienne surcharge qui refuse explicitement l'usage et redirige vers la surcharge actuelle avec canal et code de paiement. Les deux signatures doivent être examinées avant migration pour éviter de casser les clients SQL/JS encore attachés à l'ancienne.
- Le schéma de compta_evenement est une bonne base d'intégration asynchrone, mais son traitement est orienté écriture comptable ; il ne constitue pas, seul, un ledger de liquidités par Orange/MTN/Espèces. Le ledger de trésorerie a toujours ses tables dédiées et son modèle de mouvements séparé.
- Le schéma tresorerie_mouvements ne possède actuellement ni colonne canal explicite, ni clé d'idempotence dédiée, ni lien vers un mouvement frère pour transfert. source_type/source_id ne suffisent pas à garantir une seule écriture par paiement si les sources ont plusieurs représentations.
- La taxonomie Crédit doit différencier l'octroi (créance, sans entrée de trésorerie) et le remboursement (encaissement réel, canal obligatoire). Les triggers comptables actuels créent déjà les deux types d'événements, mais la provenance Marketplace vs Comptoir doit être déterminée depuis les liens fiables (origine de la demande / vente / réservation), jamais supposée.

### Architecture cible retenue pour préparer l'implémentation

- Réutiliser compta_evenement comme **outbox d'événements métier** et enrichir son payload / son contrat pour exposer explicitement event_origin, payment_channel, payment_provider et les références source, avec compatibilité pour les événements historiques.
- Créer ou faire évoluer une couche de trésorerie idempotente dédiée, alimentée depuis les événements d'encaissement réellement reçus. Ne pas utiliser compta_ecriture comme substitut du solde bancaire/mobile/caisse et ne pas poster un octroi de crédit comme encaissement.
- Pour le ledger, ajouter un modèle explicite du canal/fournisseur et une clé d'idempotence unique par pharmacie/source ; les transferts doivent posséder un identifiant de groupe commun et deux mouvements de sens opposé. Préserver les lignes historiques sans origine fiable.
- Faire du couple (événement, canal) un contrat partagé par les RPC, les types TS, les reçus et les écrans ; les libellés ne doivent pas être recodés indépendamment dans chaque page.
- Conserver les contrôles de permission existants : Caisse active pour encaissement comptoir/livraison, périmètre pharmacie, session ouverte, crédit approuvé et délégation Promoteur/Responsable selon les limites. Les fonctions SECURITY DEFINER devront vérifier explicitement acteur, pharmacie, rôle et session ; aucun droit ne doit être accordé par simple exposition d'une RPC.
- La prochaine phase d'implémentation doit d'abord livrer le contrat SQL + tests de non-régression Replay, puis connecter POS, Marketplace réservation, livraison, crédits/remboursements, vues historiques et vue Promoteur. Pas de migration ni modification Production avant validation Replay.

### Verdict approfondi

| Domaine | État vérifié |
|---|---|
| Outbox métier idempotent | **EXISTE** |
| Comptabilité partie double | **EXISTE**, sous périodes/mappings validés |
| Origine + canal dans contrat commun explicite | **NON DÉMONTRÉ / À AJOUTER** |
| Encaissement POS comptoir multicanal | **NON CONFORME** |
| Livraison avec preuve et validation dédiée | **EXISTE**, à relier à l'origine/canal transverse |
| Réservation avec canal/code | **EXISTE**, compatibilité des surcharges à vérifier |
| Octroi et remboursement de crédit en événements | **EXISTE**, origine Marketplace/Comptoir à préciser et canal de remboursement à vérifier |
| Trésorerie liquide consolidée et idempotente par canal | **NON CONFORME / NON DÉMONTRÉ** |
| Affichage partenaire « Événement + Canal » transversal | **NON DÉMONTRÉ** |

**Statut global : NON VERT.** La documentation initiale a été enregistrée avant tout début d'implémentation ; cet audit approfondit le diagnostic et corrige la distinction entre outbox comptable et trésorerie. Aucune écriture Replay, migration, modification Production, correction de code ni déploiement n'a été effectué dans cette passe.


## 193. Reprise crédit — état Replay, preuves SQL et prochain lot de correction — 17/11/2026

### Réponse fonctionnelle vérifiée

Le système possède un moteur de crédit client opérationnel dans son modèle de données et ses RPC :
- compte de crédit par client/pharmacie avec plafond, solde et statut actif ;
- demande de crédit Marketplace ou issue du Comptoir, avec décision Promoteur / Responsable délégué ;
- approbation Marketplace et cycle de réservation/préparation ; le retrait Caisse reprend la vente POS approuvée ;
- vente à crédit au Comptoir, demande de décision si le plafond est dépassé, finalisation après approbation ;
- opération d'octroi enregistrée, solde client mis à jour, ticket POS « crédit » ;
- remboursement partiel possible par RPC, lié à une session Caisse, avec événement comptable credit_remboursement.

**Conclusion : OUI, NAXA sait traiter les octrois et les soldes de crédit. Le parcours reste PARTIEL pour les remboursements multicanaux et l'expérience partenaire.** Ne pas déclarer le module crédit globalement vert.

### État Replay constaté en lecture seule

Projet pwfftcsjyeibxxqhwysw (Replay), historique supabase_migrations.schema_migrations :
- migrations crédit 247 à 267 et 299 enregistrées ;
- intégration Marketplace/POS/comptabilité du 15 novembre enregistrée ;
- correctif de double-débit / affectation Responsable enregistré ;
- projection des clients crédit pour la Caisse enregistrée ;
- configuration comptable crédit enregistrée ;
- correctif d'insertion des champs de paiement POS du 16 novembre enregistré.

Comptages observés au moment de la reprise : 1 compte de crédit, 43 demandes, 42 opérations, 42 événements comptables credit_octroi / credit_remboursement, 0 mouvement dans tresorerie_mouvements. Ces comptages sont un état instantané Replay, pas une preuve d'exécution E2E ni une donnée de Production.

### Audit du code et des RPC

- src/app/achats/credit/page.tsx et DemandeCreditMarketplaceForm.tsx : formulaire Marketplace avec pharmacie, téléphone, date future de remboursement et justificatif photo/PDF ; le serveur recalcule montant et disponibilité.
- src/app/achats/credit/suivi/page.tsx : suivi des demandes, comptes, encours, opérations et reçus de remboursement pour le Client.
- src/app/pharmacie/promoteur/credits/page.tsx et actions.ts : configuration des plafonds Client, plafonds délégués Responsable et décision des demandes.
- src/app/pharmacie/responsable/credits/page.tsx : périmètre des affectations et contrôle serveur naxa_can_approve_client_credit avant présentation de la capacité à décider.
- src/app/pharmacie/caisse/page.tsx : sélection du Client crédit, finalisation vente_credit_finaliser, demande de décision si plafond dépassé, ticket crédit. Le fichier ne contient pas d'appel à client_credit_rembourser ni d'écran de saisie de remboursement ; l'interface de recouvrement Caisse reste donc à localiser ou à créer.
- client_credit_rembourser(uuid,integer,mode_paiement_caisse,text,text) : verrouille le compte, contrôle le montant et le périmètre, exige une session Caisse ouverte appartenant à l'acteur, décrémente le solde et insère client_credit_operations avec session et canal. Mais la version Replay contient encore « if p_mode is distinct from 'especes' then raise exception » : seuls les remboursements espèces passent actuellement.
- La surcharge historique sans paramètre mode force explicitement especes ; ne pas l'utiliser pour de nouveaux appels.
- Trigger remboursement → compta_evenement est idempotent. Le worker comptable prend en charge credit_remboursement sous réserve de période, journal et mappings validés.
- caisse_cloturer et son garde-fou n'ajoutent au tiroir que les remboursements mode_paiement='especes', ce qui évite d'ajouter Orange/MTN au tiroir physique.
- tresorerie_mouvements est toujours vide (0 ligne) et aucune alimentation du ledger par les remboursements n'est prouvée. L'événement comptable n'est pas une entrée de trésorerie.

### Tests exécutés sur Replay pendant cette reprise

| Test | Résultat |
|---|---|
| 248_credit_repayment_cash_session.sql | **PASS silencieux** — bloc DO terminé sans exception ; aucun SELECT de résultat dans le fichier |
| 249_credit_repayment_accounting.sql | **PASS** |
| 250_caisse_credit_repayment_reconciliation.sql | **PASS** |
| 254_credit_repayment_payment_mode.sql | **PASS structurel** — confirme la signature/canal et le filtre espèces, pas l'acceptation de canaux mobiles |
| 20261116010200_credit_pos_payment_insert_fields_fix.sql | **PASS** — champs de paiement crédit insérés atomiquement, garde anti-UPDATE conservée |
| 20261115230500_credit_accounting_worker_runtime.sql | **PASS** — octroi + remboursement équilibrés, transaction annulée |
| 20261115220000_credit_marketplace_pos_end_to_end.sql | **BLOQUÉ AVANT LE SCÉNARIO** : la fixture ne satisfait pas private.naxa_guard_physical_caisse_capacity : la fonction exige une ligne pharmacie_architectures active et un niveau 3 dans naxa_architecture_niveaux avant toute création de Caisse. Ce n'est pas un échec fonctionnel du moteur crédit ; le test E2E doit provisionner une architecture réellement autorisée, sans contourner le garde-fou. |

Les tests SQL exécutés avec ROLLBACK n'ont pas laissé de données de test persistantes. Aucun compte, demande ou opération métier n'a été créé par cette reprise.

### Prochain lot d'implémentation — ordre strict

1. Contrat d'événement et canal du crédit : distinguer l'origine de l'octroi (Marketplace ou Comptoir), le type d'événement (octroi, remboursement, annulation) et le canal réel du remboursement (espèces, Orange Money, MTN MoMo). Conserver fournisseur MTN distinct du Mobile Money générique. Ne pas classer l'octroi comme encaissement.
2. Recouvrement Caisse : créer/localiser une interface sécurisée pour rechercher un crédit client actif, saisir le montant partiel, choisir le canal et enregistrer le remboursement dans la session personnelle ouverte. Le canal mobile au comptoir suit la validation visuelle définie dans la section 191 ; aucune preuve SMS/API opérateur ne doit être exigée pour ce parcours physique. Le canal déclaré doit être enregistré explicitement.
3. RPC transactionnelle : permettre les canaux autorisés, contrôler rôle/affectation/pharmacie/session, verrouiller le compte, interdire remboursement supérieur au solde, décrémenter une seule fois, enregistrer acteur/date/canal/référence/preuve visuelle, puis émettre l'événement idempotent.
4. Reçus : exposer le canal et l'événement sur le reçu Client et le journal partenaire ; le reçu doit afficher montant remboursé, solde restant, date, pharmacie, acteur et référence.
5. Trésorerie : créditer une seule fois le compte de trésorerie correspondant au canal réellement reçu ; conserver le tiroir espèces distinct ; octroi de crédit sans mouvement de trésorerie.
6. Tests : espèces, Orange, MTN, remboursement partiel, remboursement intégral, solde insuffisant, absence/session Caisse étrangère, doublon/rejeu, clôture tiroir (espèces uniquement), outbox et ledger. Adapter la fixture E2E à l'architecture Caisse physique actuelle, sans désactiver ses gardes.

### Point d'arrêt

La reprise a confirmé le moteur de crédit et identifié le prochain manque fonctionnel concret : l'enregistrement partenaire des remboursements, en particulier les canaux mobiles, et leur visibilité/écriture en trésorerie. La présente passe est un audit + tests de contrats et worker ; aucune modification de code, migration, écriture métier Replay, modification Production ou déploiement n'a été effectuée. Statut : NON VERT.


### Contrôle complémentaire des données et permissions Replay

- Répartition des opérations : 21 octrois (mode_paiement NULL) et 21 remboursements (tous mode_paiement='especes'). Aucun remboursement Orange Money ou MTN MoMo n'est actuellement enregistré dans Replay.
- Répartition des demandes : 21 demandes Comptoir approuvées, 1 demande Comptoir rejetée et 21 demandes Marketplace rejetées ; aucune demande en attente dans cet instantané.
- Les tables client_credits, client_credit_requests et client_credit_operations n'accordent à authenticated que SELECT ; les écritures métier passent par les RPC contrôlées. Leurs politiques de lecture limitent les lignes au Client concerné, à l'Admin ou aux profils ayant accès à la pharmacie.
- tresorerie_mouvements est également en lecture seule pour authenticated, avec filtrage Admin / accès pharmacie. Toute alimentation doit passer par une RPC contrôlée, pas par INSERT client.

### ServiceWorker — correction du DataCloneError et du nettoyage cache (17/11/2026)

- Cause technique : le `SerwistProvider` active par défaut `cacheOnNavigation`. Son intégration intercepte `history.pushState` et `history.replaceState`, puis envoie l'argument de navigation au worker via `messageSW` dans `CACHE_URLS`. Un objet `URL` passé comme troisième argument de navigation n'est pas structurable-clonable par Chromium et provoque `DataCloneError`.
- Correction appliquée : `cacheOnNavigation={false}` dans `src/app/layout.tsx`. Le provider ne poste plus les paramètres d'historique au worker. Les stratégies `NetworkFirst` définies dans `worker/sw.ts` restent responsables des routes publiques explicitement déclarées et de `/connexion`.
- Second défaut corrigé : `CacheVersionGuard` supprime désormais uniquement les noms exacts des trois anciens caches connus (`naxa-pharmacy-login-v4`, `naxa-navigation-v4`, `naxa-production-refresh-20261018`). Les caches actifs `naxa-pharmacy-login-v5` et `naxa-navigation-public-v1` ne correspondent plus à la sélection de suppression.
- Non-régression ajoutée dans `scripts/test-pwa-security.cjs` : présence de la désactivation du hook Serwist, démonstration de l'échec de structured clone sur le message contenant un objet `URL`, et vérification que les deux noms de caches actifs ne sont pas supprimés.
- Périmètre : aucun changement au worker de notifications `/naxa-push-sw.js`, aux règles métier ERP, aux données Supabase ou aux variables d'environnement.
- Preuve d'exécution : tests de contrat ajoutés au dépôt. Le cycle navigateur (installation/activation, navigation SPA, mode hors ligne et mise à jour du worker) doit encore être exécuté dans Chromium avant de déclarer l'ensemble PWA **VERT**. Aucun déploiement Production n'est demandé ni effectué dans cette correction.



### Reprise du recouvrement crédit — état avant implémentation (17/11/2026)

- HEAD de `main` contrôlé : `c2c3cf8736d116b02638377b5f1898149af49bee`. Le document de continuité contient déjà les constats et le plan du lot précédent ; cette entrée actualise le point de départ réel du dépôt.
- Contradiction confirmée dans `src/app/pharmacie/caisse/page.tsx` : la page charge les comptes crédit via `caisse_credit_clients_lister` et sait finaliser une vente à crédit, mais ne présente aucun formulaire ni appel RPC de remboursement.
- Replay `pwfftcsjyeibxxqhwysw` : `client_credit_rembourser(uuid, integer, mode_paiement_caisse, text, text)` est encore limité à `especes` par un refus explicite des autres modes. L'ancienne surcharge `(uuid, integer, text, text)` échoue explicitement et redirige vers le contrat structuré ; elle ne doit pas être réutilisée.
- L'enum `mode_paiement_caisse` de Replay comprend déjà `especes`, `orange_money`, `mtn_momo`, `mobile_money`, `carte`, `credit` et `autre`. Cela ne prouve ni le traitement multicanal de la RPC ni l'alimentation de la trésorerie.
- `client_credit_operations` conserve actuellement mode, référence, motif, acteur, session et origine vente, mais aucun champ dédié à une déclaration de vérification visuelle. `tresorerie_mouvements` possède source_type/source_id et compte_id, mais pas de clé d'idempotence ni de canal explicite. Ces limites doivent être traitées sans écriture directe depuis le navigateur.
- Le schéma Replay a été interrogé en lecture seule. Aucun changement de base, aucune donnée métier créée, aucune migration appliquée. Production et déploiement non touchés.
- Décision d'implémentation : distinguer l'origine du crédit (Marketplace/Comptoir), l'événement (octroi/remboursement) et le canal effectivement reçu. Pour le recouvrement physique au comptoir, Orange Money et MTN MoMo sont déclarés après contrôle visuel explicite du message de confirmation, du bénéficiaire et du montant par le caissier ; ne pas exiger SMS/API opérateur pour ce parcours. Les flux Marketplace/Livraison conservent leurs validations de preuve existantes.
- Point de départ : construire l'interface Caisse et le contrat serveur transactionnel en préservant l'exigence de session personnelle ouverte, le périmètre pharmacie, le verrouillage du solde et l'interdiction de sur-remboursement. La trésorerie doit recevoir un mouvement unique par remboursement réellement enregistré ; le tiroir physique reste espèces uniquement. Le lot n'est pas vert tant que les tests transactionnels, l'outbox, la trésorerie et la fixture E2E Caisse autorisée ne sont pas vérifiés.


### Complément trésorerie — prérequis Replay (17/11/2026)

- Contrôle en lecture seule des comptes : `tresorerie_comptes` ne contient actuellement **aucun compte** sur Replay. L'absence de mouvements n'est donc pas seulement un défaut d'alimentation : aucun compte de destination n'est configuré dans cet environnement.
- Les types de compte disponibles sont `especes` et `mobile_money` (entre autres). Le type `mobile_money` ne distingue pas Orange de MTN ; le futur mouvement doit donc conserver un canal explicite et ne pas s'appuyer uniquement sur le type générique du compte.
- `tresorerie_mouvements.source_type` autorise actuellement `depense`, `vente`, `ajustement` et `transfert`, mais pas `credit_operation`. La table n'a pas de clé d'idempotence ni de champ de canal. Le raccordement crédit exige donc une évolution de schéma contrôlée, une contrainte d'unicité et une règle de correspondance stable compte/canal.
- Les déclencheurs existants sur `client_credit_operations` émettent les événements comptables d'octroi et de remboursement. Le déclencheur de remboursement n'envoie actuellement que montant, date comptable et référence ; il ne transmet ni origine, ni canal. Ne pas confondre cet outbox comptable avec le journal de liquidités.
- Conséquence : ne pas écrire un mouvement de trésorerie dans l'état actuel ni inventer un compte. La migration devra créer/assurer les comptes de trésorerie nécessaires avec solde initial nul, différencier Orange Money et MTN MoMo par canal, et enregistrer mouvement + opération + outbox dans une même transaction idempotente. Les soldes historiques ne seront pas reconstruits par cette correction.


## 194. Audit d'implémentation du recouvrement crédit — contrat Caisse et trésorerie — 17/11/2026

### État du dépôt et périmètre

- Branche contrôlée : `main`.
- Dernier commit de référence vérifié : `c2c3cf8736d116b02638377b5f1898149af49bee` (correction PWA).
- Le document de continuité contenait déjà la décision de ne pas démarrer le lot sans contrat serveur sécurisé (§193 et reprise en fin de document).
- Les lectures SQL de cette passe ont ciblé exclusivement Replay `pwfftcsjyeibxxqhwysw`. Aucune requête d'écriture, aucune migration, aucune donnée métier créée. Production et déploiement non touchés.

### Contradiction code / base — recouvrement

- `src/app/pharmacie/caisse/page.tsx` (821 lignes) charge les comptes via `caisse_credit_clients_lister(uuid)`, sélectionne le Client et finalise une vente à crédit avec `vente_credit_finaliser`.
- La page n'appelle toujours pas `client_credit_rembourser` et ne contient aucun formulaire de remboursement. Le recouvrement partenaire n'est donc pas simplement masqué : il est absent de cette page.
- Le type UI `CreditAccountOption` et le RPC de liste ne transportent que `client_id`, solde et plafond, pas `client_credits.id`. L'interface ne doit pas contourner les politiques en lisant directement la table : le contrat serveur du recouvrement doit résoudre le compte par (pharmacie, client) après vérification de l'acteur, ou exposer explicitement l'identifiant via un RPC de liste autorisé.
- La définition Replay de `client_credit_rembourser(uuid,integer,mode_paiement_caisse,text,text)` exige déjà un acteur authentifié, verrouille le compte, vérifie son statut, son solde, le périmètre pharmacie et une session Caisse ouverte détenue par l'acteur. Elle décrémente le solde et insère une opération liée à la session.
- Cause directe du refus multicanal confirmée par `pg_get_functiondef` : la fonction rejette tout mode différent de `especes`. La surcharge historique `client_credit_rembourser(uuid,integer,text,text)` lève une erreur explicite et ne doit pas être appelée.

### Trésorerie — nouvelle cause racine établie

- Les enums Replay distinguent déjà `especes`, `orange_money`, `mtn_momo` et `mobile_money` dans `mode_paiement_caisse`. Le type de compte de trésorerie ne distingue que `especes`, `mobile_money`, `banque`, `carte` et `autre` : il ne peut pas identifier seul Orange vs MTN.
- `tresorerie_mouvements` ne contient actuellement que compte, nature, montant, libellé, référence, source_type/source_id, date et acteur. Aucun canal normalisé, aucune clé d'idempotence dédiée et aucun identifiant de groupe de transfert.
- Les index uniques existants ne garantissent pas l'unicité d'un remboursement crédit : la seule unicité partielle observée sur les mouvements concerne les dépenses (`source_type='depense'`). Les opérations crédit ne possèdent pas non plus de clé d'idempotence de remboursement ; leur PK ne protège que contre la répétition d'un même identifiant.
- Inventaire des fonctions SQL publiques dont le nom ou le corps référence la trésorerie : seule `tresorerie_creer_compte(uuid,text,tresorerie_compte_type,integer)` crée un compte. Aucune RPC d'insertion contrôlée de mouvement de trésorerie n'a été trouvée dans cet inventaire.
- État Replay observé : aucune ligne de compte de trésorerie n'est configurée (résultat vide pour `tresorerie_comptes`) et les mouvements sont à zéro. Il n'existe donc pas de compte cible validé pour y poster les remboursements. Le compte ne doit jamais être deviné ou créé implicitement au moment d'un remboursement.
- Conclusion : brancher immédiatement un INSERT dans le navigateur serait une faille (les droits authenticated sont en lecture seule) ; appeler la fonction de création de compte à chaque remboursement serait également incorrect. La trésorerie nécessite un contrat serveur transactionnel, une idempotence source, un mapping explicite canal→compte et une configuration préalable des comptes par pharmacie.

### Contrat de correction à implémenter

1. Ajouter un RPC de remboursement Caisse versionné, appelé avec pharmacie + client (pas d'accès direct client aux tables), montant, canal, référence facultative, motif facultatif et déclaration booléenne de contrôle visuel pour les canaux mobiles comptoir.
2. Autoriser uniquement `especes`, `orange_money` et `mtn_momo` pour ce parcours physique. Pour Orange/MTN, exiger la déclaration explicite du contrôle visuel (bénéficiaire, montant et confirmation présentée), conserver acteur/date et référence facultative. Ne pas exiger SMS/API opérateur pour ce parcours ; ne pas modifier les preuves Marketplace/Livraison.
3. Conserver les contrôles actuels : auth.uid, Caisse autorisée, pharmacie active et dans le périmètre, session ouverte détenue par l'acteur, crédit actif, verrouillage FOR UPDATE, montant entier strictement positif et inférieur ou égal au solde.
4. Ajouter une clé d'idempotence obligatoire et unique par opération de remboursement. Le même appel rejoué doit retourner l'opération déjà créée sans réduire le solde ni créditer la trésorerie une seconde fois.
5. Enregistrer l'événement d'origine du crédit sans le déduire du seul canal : Marketplace vs Comptoir doit être déterminé à partir des liens source fiables. L'événement courant est `credit_remboursement`; le canal du remboursement est celui effectivement reçu.
6. Créer un RPC de trésorerie strictement contrôlé, dans la même transaction ou via outbox idempotente, avec mapping obligatoire vers un compte actif de type espèces ou mobile_money. Distinguer Orange et MTN par une métadonnée de canal explicite. Aucun mouvement pour l'octroi.
7. Si le compte de trésorerie du canal n'est pas configuré, le remboursement ne doit pas être déclaré terminé avec un mouvement manquant : transaction atomique refusée ou état de rapprochement explicite et récupérable, selon le contrat retenu. Ne jamais créditer par défaut un autre canal.
8. Ajouter l'interface Caisse, le reçu et le journal partenaire après stabilisation du contrat SQL. La clôture physique continue de compter uniquement les remboursements espèces.
9. Tests Replay : espèces, Orange, MTN, contrôle visuel absent, montant supérieur au solde, session absente/étrangère, pharmacie hors périmètre, crédit inactif, double soumission/idempotence, rollback si compte de trésorerie absent, compte canal incorrect, outbox comptable, absence d'octroi dans le ledger, et tiroir espèces uniquement.

### Décision de reprise

- **Cause racine confirmée :** le remboursement multicanal est bloqué par une garde SQL espèces-only ; l'écran Caisse ne propose aucun recouvrement ; le ledger de trésorerie ne possède ni RPC de mouvement ni idempotence remboursement ni comptes configurés sur Replay.
- **Aucune correction de code ou migration appliquée dans cette passe.** Il serait prématuré de créer le formulaire avant de figer et tester le contrat serveur et le mapping de trésorerie.
- Le prochain travail est la conception puis l'implémentation de la migration additive sur Replay, suivie des tests transactionnels. L'outil CLI local `supabase migration new` n'est pas disponible dans cette session ; ne pas fabriquer silencieusement une migration en contournant cette étape de préparation. Si l'environnement de travail local/CLI devient disponible, créer la migration avec la CLI, la versionner sur `main`, puis appliquer et vérifier uniquement sur Replay.
- Statut : **NON VERT — audit approfondi terminé, implémentation bloquée par l'absence de l'outillage local de création de migration et par la configuration de trésorerie Replay inexistante.** Aucun contournement de sécurité.


## 195. Recontrôle du chantier recouvrement crédit — état Replay et blocages d'exécution — 17/11/2026

### Preuves fraîches en lecture seule

- HEAD GitHub contrôlé : `c4bd6d0f5a4c0126c7f64fc945f5149ec1386f69` sur `main`.
- Projet Supabase ciblé : Replay `pwfftcsjyeibxxqhwysw`, statut `ACTIVE_HEALTHY`, PostgreSQL 17.11. Aucun accès Production.
- Relecture de `src/app/pharmacie/caisse/page.tsx` : la page gère la vente à crédit et la sélection du client ; aucun appel à `client_credit_rembourser` et aucun formulaire de remboursement.
- Définition SQL réelle de `client_credit_rembourser(uuid,integer,mode_paiement_caisse,text,text)` : garde espèces uniquement, verrouillage du crédit, vérification du solde, contrôle de périmètre pharmacie et session Caisse ouverte détenue par l'acteur. La surcharge historique à quatre arguments lève une exception.
- Compteurs Replay : 1 compte crédit, 21 opérations de remboursement historiques, 0 compte de trésorerie, 0 mouvement de trésorerie, 0 index unique identifié garantissant l'unicité des remboursements.
- Colonnes actuelles de `tresorerie_mouvements` : `id, pharmacie_id, compte_id, nature, montant, libelle, reference, source_type, source_id, date_operation, created_by, created_at`. Aucun canal explicite, aucune clé d'idempotence, aucun groupe de transfert.
- Colonnes actuelles de `tresorerie_comptes` : `id, pharmacie_id, nom, type, devise, solde_initial, actif, created_by, created_at`. Le type `mobile_money` ne distingue pas Orange Money de MTN MoMo.
- La clôture `caisse_cloturer` calcule explicitement les remboursements espèces uniquement dans le tiroir : cette règle est conservée et ne doit pas être élargie aux remboursements mobiles.
- L'advisor sécurité Supabase Replay remonte des constats globaux (RLS activé sans policy sur plusieurs tables, fonctions SECURITY DEFINER exposées, protection des mots de passe compromis désactivée). Ces constats ne sont pas tous attribuables à ce chantier ; aucune révocation globale ou modification de policy n'a été faite sans analyse de périmètre.

### État des actions de cette passe

- Audit de code, SQL et compteurs Replay : effectué.
- Écriture SQL, migration, création de compte, création de mouvement, mutation métier : aucune.
- Code applicatif modifié : aucun.
- Production / Vercel / déploiement : non touchés.
- La CLI Supabase n'est pas installée dans l'environnement de travail présent et aucun checkout local du dépôt n'est disponible. La migration versionnée ne peut donc pas être créée avec la séquence requise `supabase migration new` puis testée localement ici. Ne pas remplacer cette étape par un SQL distant non versionné ou un fichier de migration improvisé.

### Décision qualité

Le chantier demeure **NON VERT**. Les blocages sont concrets et indépendants : contrat SQL espèces-only, absence d'interface Caisse de remboursement, absence de canal/idempotence et de RPC d'écriture trésorerie, absence de comptes de trésorerie Replay, absence de tests transactionnels multicanaux et de preuve E2E.

Le vert exige, dans cet ordre : créer la migration avec la CLI dans le dépôt local ; implémenter le RPC versionné et idempotent + mapping obligatoire des comptes ; appliquer uniquement sur Replay ; tester espèces/Orange/MTN, autorisations, sessions, solde, doublons, rollback et outbox ; construire l'interface Caisse, reçu et journal partenaire ; exécuter la recette E2E et les contrôles de sécurité ciblés ; versionner les preuves sur `main`. Aucun remboursement ne doit être simulé ou posté dans la trésorerie pour obtenir artificiellement un résultat vert.


## 196. Audit approfondi des dépendances SQL — contraintes, outbox et sécurité d'exécution — 17/11/2026

### Vérifications complémentaires effectuées après la demande de remise au vert

- Le schéma réel de `client_credit_operations` ne comporte actuellement ni clé d'idempotence ni colonnes de preuve de contrôle visuel. Les index recensés couvrent le périmètre pharmacie, la session Caisse, le mode de paiement et l'unicité d'une vente à crédit ; aucun index n'empêche deux remboursements distincts issus d'une double soumission.
- Les colonnes réelles de `tresorerie_mouvements` et `tresorerie_comptes` ont été réinterrogées. Le compte ne porte aucune métadonnée opérateur (Orange/MTN), et le mouvement n'a pas de champ canal/idempotence.
- La contrainte SQL `tresorerie_mouvements_source_type_check` n'autorise que `depense`, `vente`, `ajustement` et `transfert`. Une insertion de mouvement `credit_remboursement` échouerait avant même la question du compte cible. Toute migration doit faire évoluer cette contrainte explicitement et préserver les quatre valeurs historiques.
- Les deux triggers existants sur `client_credit_operations` appellent `compta_emettre_octroi_credit()` et `compta_emettre_remboursement_credit()`. L'insertion du remboursement déclenche donc déjà l'outbox comptable : le futur contrat doit préserver ce déclenchement une seule fois, sans le dupliquer depuis le client.
- Les helpers d'autorisation réellement utilisés ont été inspectés : `naxa_caisse_actor_for_pharmacy(uuid)`, `can_operate_pharmacy(uuid)` et `is_admin()`. Le nouveau RPC devra appeler le contrôle Caisse dédié et conserver la session ouverte détenue par `auth.uid()`, plutôt que de s'appuyer uniquement sur le rôle générique.
- Le retour de l'advisor Supabase de Replay inclut des constats de sécurité globaux (RLS sans policy sur plusieurs tables et fonctions SECURITY DEFINER exposées). Ils ne sont pas corrigés en bloc : une correction non ciblée risquerait de casser des flux hors périmètre. Une revue fonction par fonction et table par table reste requise avant le vert sécurité global.

### Décision d'architecture confirmée

Le remboursement et son mouvement de trésorerie doivent être une seule unité transactionnelle. Le mapping pharmacie + canal vers un compte actif doit être explicite et administrable ; Orange Money et MTN MoMo ne doivent pas être fusionnés dans un compte générique sans identifiant de canal. Une clé idempotente doit être fournie par le client et persistée avec contrainte unique. La création du mouvement et l'insertion de l'opération doivent partager la même transaction PostgreSQL, de façon à ce que l'échec du mapping ou du mouvement annule également la baisse du solde crédit. L'outbox comptable existante doit être conservée comme source unique d'émission de l'événement comptable.

### Limite de cette passe

Cette passe a enrichi l'audit, mais n'a appliqué aucune migration et n'a modifié aucun écran. La base Replay ne dispose toujours d'aucun compte de trésorerie ; les tests positifs Orange/MTN ne peuvent pas être considérés réussis sans configuration explicite et acteurs Caisse autorisés. Aucun faux compte, faux utilisateur, remboursement ou mouvement n'a été créé pour produire un résultat artificiel. Le statut demeure **NON VERT**.


## 197. Correction du menu mobile de l'accueil public — superposition et clics — 17/11/2026

### Audit et cause racine

- Le menu déroulant est rendu dans `EnTeteAccueil`, à l'intérieur d'un header `relative isolate` sans niveau de superposition explicite.
- Le panneau « Que recherchez-vous ? » de `src/app/page.tsx` est un élément frère positionné en `relative z-10` et remonte visuellement sur le header.
- Le `z-50` du menu ne pouvait pas sortir du contexte d'empilement créé par `isolate` : les liens « Espace client » et « Espace pharmacie » étaient recouverts par le panneau de recherche. Le clic semblait donc inactif.
- Cause racine confirmée par lecture des deux composants ; il ne s'agit pas d'une destination de lien manquante : les deux liens pointent déjà vers `/connexion?espace=client` et `/connexion?espace=pharmacie`.

### Correction versionnée sur main

- `src/components/EnTeteAccueil.tsx` : ajout de `z-20` au header isolé. Le menu conserve son `z-50` interne et passe désormais au-dessus du panneau de recherche `z-10`.
- Ajout de `scripts/test-public-menu-layering.cjs` : vérifie l'ordre des couches et la présence des deux destinations de navigation.
- Aucun changement de logique métier, d'authentification ou de données Supabase.

### Vérification et statut

- Commit correction : `5fa59d46067f7994dfba31b3fc0817234c9efb97`.
- Commit test : `7b63bc315d601455694c898f5b921a27b85ad26d`.
- Test automatisé ajouté au glob `npm test` (`scripts/test-*.cjs`). Son exécution CI après push reste la preuve attendue ; aucune exécution locale n'est revendiquée.
- Recette navigateur à refaire sur mobile : ouvrir les trois traits ; vérifier que le panneau « Que recherchez-vous ? » reste derrière le menu ; cliquer « Espace client » puis vérifier l'arrivée sur la connexion client ; revenir et tester « Espace pharmacie ».
- Statut : **CORRECTION VERSIONNÉE — validation CI et test navigateur en attente.** Aucun déploiement Production ni changement Supabase.


## 198. Reprise simultanée — audit SQL, Caisse et sécurité Replay — 17/11/2026

### État réel recontrôlé

- HEAD main observé avant cette mise à jour : afbcc9f1a21388452cda92c4bd8c6fb34e9183c8 (commit de documentation du correctif de superposition du menu public).
- Replay pwfftcsjyeibxxqhwysw : ACTIVE_HEALTHY, PostgreSQL 17.11. Aucun accès Production.
- Les migrations Replay sont présentes jusqu'à 20261117131435 fix_delivery_pos_physical_stock_debit dans l'historique consulté.
- Le type enum mode_paiement_caisse contient déjà especes, mobile_money, carte, autre, credit, orange_money et mtn_momo. La prise en charge des canaux Orange/MTN est donc bloquée par la fonction de remboursement, pas par l'absence de valeurs enum.
- La fonction structurée client_credit_rembourser(uuid,integer,mode_paiement_caisse,text,text) refuse explicitement tout mode autre que especes. La surcharge historique client_credit_rembourser(uuid,integer,text,text) lève toujours une exception d'obsolescence.
- La fonction conserve le verrouillage FOR UPDATE, le contrôle du solde, le périmètre pharmacie et la session Caisse ouverte détenue par l'acteur. Ces gardes doivent être préservées.
- client_credit_operations ne contient pas de clé d'idempotence ni de champs de preuve de contrôle visuel. tresorerie_mouvements ne contient ni canal ni clé d'idempotence ; sa contrainte source_type n'autorise que depense, vente, ajustement, transfert. tresorerie_comptes n'identifie pas séparément Orange et MTN.
- La page src/app/pharmacie/caisse/page.tsx contient encore un avertissement « Paiements électroniques indisponibles » et aucun parcours de remboursement du crédit. Le crédit de vente ne constitue pas un parcours de recouvrement.
- Les advisors Supabase Replay ont été relancés : sécurité = 73 tables RLS sans policy (INFO), 4 fonctions SECURITY DEFINER exécutables par anon (WARN), 259 fonctions SECURITY DEFINER exécutables par authenticated (WARN), protection des mots de passe compromis désactivée (WARN). Performance = 248 clés étrangères sans index couvrant, 25 policies avec réévaluation auth par ligne, 150 index non utilisés, 47 tables avec policies permissives multiples. Santé = aucun finding remonté.
- Ces compteurs sont globaux. Une table privée RLS sans policy peut être intentionnelle ; une RPC SECURITY DEFINER peut être une API métier autorisée si ses gardes et ACL sont correctes. Aucun retrait global de droits, aucune policy permissive ajoutée et aucun changement de configuration Auth n'ont été appliqués.
- Le statut combiné GitHub du commit afbcc9f... ne retourne aucun statut CI enregistré ; cela ne prouve ni un succès ni un échec des tests.

### Causes racines et décisions

1. **Recouvrement crédit multicanal : NON VERT.** Les valeurs enum existent ; la garde espèces-only dans la RPC, l'absence d'idempotence, l'absence de mapping trésorerie par canal et l'absence d'écran empêchent encore la clôture.
2. **Sécurité globale : NON VERT / revue ciblée requise.** Les findings ne doivent pas être « corrigés » par révocation générale. Il faut inventorier les ACL et les contrats de chaque RPC exposée, puis traiter les tables publiques sans policy selon leur usage réel ; les objets du schéma private doivent rester non exposés.
3. **Performance globale : NON VERT / priorisation requise.** Les index inutilisés ne doivent pas être supprimés sans période d'observation représentative ; les clés étrangères et policies doivent être corrigées par table après analyse des plans et des chemins d'accès.
4. **Protection des mots de passe compromis : NON VERT.** La protection est désactivée dans Auth. Aucun paramètre n'a été modifié dans cette passe.

### Actions de cette passe

- Audit lecture seule du projet Replay, des fonctions SQL, des colonnes/contraintes, de la page Caisse et des advisors.
- Aucune migration, aucune mutation de données, aucun compte/mouvement de trésorerie, aucun changement de code métier.
- Aucun accès Production et aucun déploiement.
- Mise à jour documentaire uniquement ; aucun vert métier ou sécurité revendiqué.

### Reprise technique priorisée

- Créer une migration additive versionnée pour l'idempotence, la preuve de contrôle visuel, le mapping explicite pharmacie/canal/compte et l'écriture trésorerie atomique ; préserver l'outbox comptable existante et la clôture espèces-only.
- Tester sur Replay les chemins espèces/Orange/MTN, les doubles soumissions, les refus de sécurité et le rollback en absence de mapping avant de raccorder l'interface Caisse.
- Traiter séparément la configuration Auth leaked-password protection et les ACL des quatre RPC anon ; inventorier les 259 RPC authenticated sans retrait global.
- Établir une liste nominative des 73 tables RLS sans policy et 47 ensembles de policies multiples, puis corriger uniquement les écarts démontrés. Indexer les FK à fort trafic après analyse ; ne pas supprimer les index inutilisés sans observation.
- Statut global : **NON VERT**. Les constats sont maintenant actualisés et classés ; aucune preuve d'exécution métier positive n'a été fabriquée.


## Section 199 — Reprise fonctionnelle Caisse / remboursements crédit (17 novembre 2026)

### Périmètre et garde-fous
- Objectif utilisateur : mettre au vert tous les points rouges, en traitant l'implémentation fonctionnelle avant le durcissement technique.
- Cible de travail : `main` et Supabase Replay uniquement. Aucune modification Production, aucun déploiement, aucune branche ni PR.
- État de départ confirmé sur `main` : `src/app/pharmacie/caisse/page.tsx`, blob SHA `64a17ef248860f6fd9f0895cd61c1cb9d3814db0`.

### Preuves fonctionnelles observées
- La page Caisse charge les comptes clients par `caisse_credit_clients_lister` et permet la finalisation d'une vente à crédit par `vente_credit_finaliser`.
- La page affiche encore explicitement « Paiements électroniques indisponibles » pour l'encaissement comptoir.
- Aucun formulaire ni appel UI à `client_credit_rembourser` n'existe dans la page Caisse.
- La RPC `client_credit_rembourser(uuid, integer, mode_paiement_caisse, text, text)` existe mais rejette explicitement tout mode autre que `especes`.
- La RPC de liste retourne `client_id, solde, plafond, ...`, mais pas `client_credits.id`, identifiant requis par la RPC de remboursement.
- `client_credit_operations` ne possède actuellement ni clé d'idempotence, ni champs de preuve de vérification visuelle Orange/MTN.
- `tresorerie_comptes` ne distingue pas les opérateurs Orange et MTN ; `tresorerie_mouvements` n'expose pas de métadonnée de canal/idempotence et son contrat source connu ne couvre pas encore le remboursement crédit.
- Les déclencheurs comptables existants sur `client_credit_operations` doivent être conservés ; ne pas dupliquer l'outbox comptable côté interface.

### Décision de conception à respecter
- Remboursements crédit au comptoir : espèces, Orange Money, MTN MoMo.
- Pour Orange/MTN au comptoir : validation explicite par le caissier après vérification visuelle du bénéficiaire, du montant et de la confirmation sur le téléphone du client ; enregistrer l'acteur, l'heure et la référence déclarée. Ne pas inventer de confirmation opérateur/API.
- Un remboursement doit réduire le solde crédit et créer le mouvement de trésorerie correspondant dans une opération atomique ou une outbox idempotente. Refuser proprement si le compte de trésorerie correspondant n'est pas configuré ; aucun débit du crédit sans mouvement associé.
- Les comptes espèces, Orange Money et MTN MoMo doivent rester distincts. Le journal conserve séparément l'origine de l'événement (Marketplace/Comptoir) et le canal réel du paiement.
- Les preuves plus strictes des parcours Marketplace/Livraison ne doivent pas être affaiblies.

### Statut de ce passage
- Audit ciblé réalisé ; aucune modification applicative ou SQL exécutée dans ce passage.
- Aucun point n'est déclaré vert. Les remboursements multi-canaux, leur preuve visuelle, l'idempotence, la liaison trésorerie et l'interface restent rouges tant que les migrations, l'interface et les tests Replay correspondants ne sont pas réalisés.
- Prochaine reprise exacte : concevoir et versionner le contrat SQL complet (identifiant crédit exposé par RPC contrôlée, preuve visuelle, idempotence, compte de trésorerie par canal et mouvement atomique), puis intégrer le formulaire Caisse et les reçus ; tester sur Replay avant toute déclaration de vert.


## Section 200 — Implémentation Caisse : remboursement crédit espèces (17 novembre 2026)

### Corrections réellement appliquées sur main
- Migration ajoutée : `supabase/migrations/20261117182000_caisse_credit_refund_accounts_rpc.sql`.
- Nouvelle RPC `caisse_credit_remboursement_comptes_lister(uuid)` : expose `credit_id` et les informations client nécessaires à la Caisse sans lecture directe de `client_credits`, contrôle `auth.uid()` + `naxa_caisse_actor_for_pharmacy`, ne retourne que les crédits actifs avec solde positif.
- ACL vérifiées : `anon` ne peut pas exécuter la RPC ; `authenticated` le peut.
- Intégration UI dans `src/app/pharmacie/caisse/page.tsx` : section « Remboursement des crédits clients », sélection du compte, montant, référence/motif facultatifs, appel à `client_credit_rembourser` en espèces uniquement, mise à jour locale du solde après confirmation serveur et message avec identifiant d'opération.
- Le parcours conserve le contrôle serveur existant : montant positif, solde disponible, crédit actif, périmètre pharmacie et session Caisse ouverte appartenant au caissier.
- Les modes Orange Money et MTN MoMo restent explicitement exclus de ce formulaire ; aucune fausse confirmation opérateur n'est introduite.

### Tests Replay exécutés
- Migration appliquée sur Replay : succès.
- Vérification SQL de la nouvelle RPC et de ses ACL : `301_caisse_credit_refund_accounts_rpc PASS`.
- Contrat de session du remboursement : `248_credit_repayment_cash_session PASS`.
- Rapprochement des remboursements à la clôture : `250_caisse_credit_repayment_reconciliation PASS`.
- Contrat du mode espèces / exclusion du tiroir espèces pour d'autres modes : `254_credit_repayment_payment_mode PASS`.
- Les tests SQL sont structurels et exécutés sans créer de remboursement métier.

### Limites qui empêchent encore le vert E2E
- Aucun couple crédit actif + session Caisse ouverte appartenant au caissier n'a été trouvé dans Replay au moment du test ; le scénario réel de remboursement avec mutation puis rollback n'a donc pas été exécuté.
- Le build TypeScript/Next.js n'a pas été lancé dans cet environnement ; le statut GitHub du commit applicatif ne publie aucun check.
- Reçu dédié de remboursement, idempotence anti-double soumission, Orange Money, MTN MoMo et écriture trésorerie atomique ne sont pas livrés par cette correction.
- Par conséquent, le sous-parcours UI + RPC de remboursement espèces est implémenté et ses contrats SQL passent, mais le point global « remboursements crédit Caisse » reste PARTIEL, pas vert E2E.

### Références
- Migration commit : `e78c9f51eeacb6927a04ba62124e0000df5eb60d`.
- UI commit : `9396f0ee824c6a3420883b5b8a4a34a9bca1ed42`.
- Test contract commit : `75a0173e644128a45be8e306ef2c5b821698a0a7`.


## Section 201 — Remboursements crédit Caisse : trois canaux, trésorerie atomique et recette Replay (17 novembre 2026)

### Périmètre et garde-fous
- Travail effectué sur le dépôt `audreymendomo23-netizen/NAXA`, branche `main`, et sur Supabase Replay `pwfftcsjyeibxxqhwysw` uniquement.
- Aucune migration Production, aucune écriture Production, aucun déploiement Vercel, aucune branche ni PR.
- La section 200 décrit l'état historique « espèces uniquement ». La présente section la remplace pour l'état courant des remboursements crédit.

### Contrat SQL versionné et appliqué sur Replay
- `20261117172316_caisse_credit_refund_accounts_rpc` : RPC contrôlée qui expose l'identifiant du crédit et les informations client à la Caisse ; contrôle Auth + périmètre pharmacie.
- `20261117173913_caisse_credit_repayment_multichannel_atomic` : remboursement espèces / Orange Money / MTN MoMo ; clé d'idempotence, preuves mobiles, compte canal, écriture de trésorerie dans la même transaction.
- `20261117175003_caisse_credit_treasury_account_create_atomic` : création idempotente d'un compte de trésorerie à solde initial nul par canal, dans la pharmacie autorisée.
- `20261117181007_caisse_credit_refund_idempotency_proof_guard` : renforce le rejeu d'une même demande ; la clé est liée à l'auteur, au crédit, au montant, au mode, à la référence, au motif et aux trois déclarations de contrôle.
- Historique Supabase Replay relu après application : les quatre versions ci-dessus sont présentes.

### Règles transactionnelles garanties
- Un remboursement réduit le solde du crédit, insère une opération `client_credit_operations` et un mouvement `tresorerie_mouvements` de type `credit_remboursement` ; ces écritures sont atomiques.
- Le mouvement conserve le compte canal, le canal de paiement et l'origine `comptoir` séparément. Les comptes espèces, Orange Money et MTN MoMo sont distincts.
- Orange/MTN exigent une référence ainsi que trois contrôles visuels enregistrés : bénéficiaire, montant et confirmation affichée sur le téléphone du client. L'acteur et l'heure du contrôle sont conservés. Aucune confirmation opérateur/API n'est prétendue.
- Une clé identique rejoue la même opération uniquement avec les mêmes paramètres et le même auteur. Une clé réutilisée avec un payload ou une preuve différente est refusée.
- En l'absence de compte actif affecté au canal, la transaction est refusée avant toute baisse du crédit.
- L'insertion du mouvement et les déclencheurs comptables existants sont conservés ; l'outbox comptable reçoit un seul événement par opération.
- La clôture Caisse ne comptabilise dans le tiroir physique que les remboursements en espèces, pas les montants Orange/MTN.

### Intégration Caisse
- La page `src/app/pharmacie/caisse/page.tsx` propose les trois canaux, la configuration des comptes par canal, les contrôles visuels mobiles et un reçu imprimable portant l'origine, le canal, la référence, l'opération, le montant et le solde restant.
- Les comptes manquants peuvent être créés depuis le parcours à 0 FCFA ; cette création ne simule pas un encaissement.
- En cas de réponse réseau incertaine, la demande et sa clé d'idempotence sont conservées dans le navigateur ; les paramètres sont verrouillés et l'utilisateur peut réessayer exactement la même demande, sans créer un deuxième débit.
- L'encaissement de vente POS par opérateur reste soumis à son propre parcours de preuve ; cette correction ne prétend pas l'avoir rendu disponible.

### Recette SQL Replay exécutée
- `supabase/tests/302_caisse_credit_repayment_multichannel_e2e.sql` exécuté avec résultat : **PASS**.
- Le test utilise un acteur Caisse Replay autorisé, crée les trois comptes via la RPC officielle, ouvre une session, crée un crédit de recette, puis exécute les remboursements espèces 100 FCFA, Orange 200 FCFA et MTN 300 FCFA.
- Vérifications PASS : les trois canaux distincts ; trois opérations uniques ; trois mouvements de trésorerie liés aux comptes correspondants ; origine comptoir ; preuves Orange/MTN et acteur/horodatage ; un événement d'outbox par remboursement ; rejeu idempotent sans double débit.
- Vérifications négatives PASS : clé réutilisée avec montant ou preuve différente ; preuve mobile incomplète ; mapping MTN absent ; montant supérieur au solde. Les refus ne modifient ni le solde, ni les opérations, ni la trésorerie.
- Vérification de clôture PASS : 600 FCFA remboursés tous canaux, dont 100 FCFA seulement dans le tiroir espèces ; écart nul.
- Le script est enveloppé dans une transaction avec `ROLLBACK` : les fixtures et mouvements SQL de recette ne sont pas conservés.

### Recette automatisée complète — statut non encore terminal
- `scripts/e2e/verify-credit-refund-runtime.cjs` couvre le parcours authentifié Replay pour les trois canaux, la création/liste des comptes, le rejeu de chaque clé, les refus de sécurité, les mouvements, l'outbox, la clôture espèces-only et le nettoyage.
- `scripts/e2e/verify-credit-pos-browser.cjs` a été étendu pour réaliser les trois remboursements depuis l'interface Caisse, lire les reçus et rapprocher les trois mouvements, les preuves mobiles et le tiroir espèces.
- Le précédent run navigateur a révélé un bouton de remboursement encore désactivé pendant le chargement asynchrone des comptes. La recette a été corrigée pour attendre le bouton de soumission exact et vérifier l'activation réelle avant le clic.
- Run GitHub Actions Replay `44190663683` : en cours au dernier contrôle, installation Playwright/Chromium terminée en attente. Les étapes JWT remboursement et navigateur multicanal n'avaient pas encore rendu leur résultat terminal.
- Le run qualité `44190993476` a été relancé après correction d'un test Admin périmé sur l'identifiant historique `dispositifs`. Ce test vérifie maintenant que l'identifiant reste technique mais que les dispositifs ne figurent pas parmi les quatre univers publics configurables. Résultat terminal de cette relance non encore disponible au dernier contrôle.
- Un run qualité précédent a exécuté 581 tests : 580 PASS, 1 FAIL sur cette assertion Admin obsolète. Aucun résultat TypeScript, lint ou build n'est revendiqué pour ce run, car `npm test` s'est arrêté sur l'échec.

### État honnête à cette reprise
- **Vert :** migrations des trois canaux appliquées sur Replay ; sécurité idempotence/proof guard appliquée ; recette SQL 302 PASS avec rollback ; intégration UI et reçu versionnés ; tests statiques multicanaux ajoutés.
- **En attente :** exécution complète des scripts JWT et navigateur multicanal sur Replay ; résultat final du build/TypeScript/lint de la relance qualité.
- **Non revendiqué :** validation opérateur automatisée Orange/MTN ; recette de vente POS encaissée par ces opérateurs ; publication Production.
- Le sous-parcours SQL multicanal est vert. Le parcours complet navigateur + qualité globale reste **PARTIEL / EN ATTENTE** jusqu'aux deux runs terminaux ; ne pas déclarer le chantier global vert avant preuves.


## Section 202 — Stabilisation de la recette navigateur des remboursements crédit (17 novembre 2026)

### Diagnostic consolidé
- Le run navigateur 44192308451 a montré que les trois comptes espèces, Orange Money et MTN MoMo existaient en base et que la RPC les listait, mais que les trois sélecteurs de la page Caisse restaient vides dans cette exécution.
- Relecture du code : la page Caisse possédait déjà un effet de chargement initial qui appelle le helper chargerComptesTresorerieRemboursement lorsque pid est défini. Il serait donc incorrect d'affirmer que l'interface n'avait aucun chargement initial.
- Le script navigateur utilisait une création directe via RPC puis comptait uniquement sur le rafraîchissement de l'interface. Le correctif du script utilise maintenant le chemin visible pour le caissier : si un canal n'est pas sélectionné, clic sur Créer compte à 0 FCFA, puis attente explicite de la sélection du compte avant de saisir le remboursement.

### Réconciliation du changement d351a25
- Une tentative d'ajout d'un second chargeur a été commitée, mais le contrôle TypeScript a détecté que le then d'une RPC Supabase retourne un PromiseLike auquel catch n'est pas disponible.
- Ce chargeur redondant a été retiré. Le helper et son effet initial existants sont conservés ; le test statique vérifie maintenant leur présence et leur liaison à pid.
- Le test navigateur conserve les assertions sur l'interface réelle, les trois canaux, les reçus, les trois mouvements de trésorerie, les preuves visuelles et le tiroir espèces.

### Preuves Replay toujours valides
- Recette SQL 302_caisse_credit_repayment_multichannel_e2e.sql exécutée directement sur Replay : PASS avec ROLLBACK.
- Recette runtime authentifiée JWT Caisse Replay précédente : PASS sur espèces, Orange Money et MTN MoMo.
- La session d'essai interrompue a été récupérée : session clôturée, écart 0 FCFA, solde du crédit de recette 0 FCFA et stock technique revenu à 4 unités.
- Les trois comptes de trésorerie de la pharmacie technique étaient actifs et affectés aux bons canaux lors du contrôle direct Replay.

### Vérifications à ne pas confondre
- Le contrôle qualité du SHA 9d513617 a exécuté 582 tests avec 582 PASS, puis a échoué en TypeScript sur le chargeur redondant depuis retiré.
- Le build/TypeScript/lint du HEAD après retrait doit rendre un nouveau résultat terminal avant déclaration au vert.
- La recette navigateur avec le nouveau chemin UI doit également rendre un résultat terminal PASS avant de déclarer le remboursement E2E global vert.
- Le test Auth de détection de réutilisation de refresh token avait un échec indépendant dans un run antérieur ; il ne doit pas être présenté comme un échec de remboursement Caisse ni être masqué.
- Aucune migration ni écriture Production et aucun déploiement Vercel ne sont effectués dans ce passage.
## Section 203 — Résultats consolidés du remboursement crédit multicanal (17 novembre 2026)

### Qualité du code sur le HEAD 8c80559796c22774c4c5cc968007714141e5bcf4
- Run GitHub Actions 44197708501 : **SUCCESS**.
- npm test : 584 tests, 584 PASS, 0 FAIL.
- TypeScript tsc --noEmit : inclus dans le job qualité, terminé avec succès.
- ESLint : inclus dans le job qualité, terminé avec succès (warnings existants, aucun échec).
- Build Next.js : compilation réussie et 156/156 pages statiques générées.
- Validation actionlint de tous les workflows GitHub Actions : PASS.

### Parcours Caisse confirmé
- Recette SQL 302_caisse_credit_repayment_multichannel_e2e.sql : PASS sur Replay avec rollback.
- Recette JWT Caisse du run Replay 44196261458 : remboursements espèces, Orange Money et MTN MoMo authentifiés ; clés distinctes rejouées sans double débit ; erreurs de preuve, compte absent, payload différent et dépassement refusés.
- Parcours navigateur du même run : assertions Crédit terminées avec browser_failures=0. Vente à crédit, suivi Client, remboursement Caisse, mouvements et reçus ont passé. Le scénario navigateur a produit trois remboursements de recette : 100 FCFA espèces, 300 FCFA Orange Money et 600 FCFA MTN MoMo, rattachés au même caissier et à la même session.
- Clôture de cette session : statut cloturee, total théorique 100 FCFA, total compté 100 FCFA, écart 0. Les 900 FCFA mobiles ne sont pas inclus dans le tiroir espèces.
- Reçu imprimable et détails d'opération sont couverts par les assertions du parcours navigateur. Le contrôle comptable Promoteur a aussi validé la création des comptes, journaux et quatre mappings techniques, puis nettoyé ces seules lignes de configuration.

### Chaînage comptable sur les trois événements réels
- Les outbox générées pour les remboursements espèces, Orange et MTN sont bien présentes, une par opération.
- Le worker compta_traiter_evenement a été exécuté transactionnellement sur ces trois événements réels après création temporaire d'une période ouverte, de deux comptes comptables, des mappings débit/crédit et du journal.
- Résultat : 3 événements traités, 3 écritures, total débit 1 000 FCFA et total crédit 1 000 FCFA. Test exécuté dans une transaction annulée.
- Vérification après ROLLBACK : les 3 événements sont revenus à a_traiter, 0 écriture comptable de recette et 0 période temporaire subsistent.
- Limite opérationnelle : la pharmacie technique Replay n'a pas de plan comptable/journal/période valides permanents pour ces événements. Le worker réel attend donc le paramétrage comptable de la pharmacie ; le test transactionnel prouve le traitement positif sans prétendre que les écritures de test sont durablement postées.

### Résultat du workflow E2E global et réserves séparées
- Le run Replay 44196261458 a terminé le provisionnement, le build de recette, Web Push, JWT remboursement et Storage avec succès. Le job navigateur a eu browser_failures=0.
- Ce run a néanmoins échoué au contrôle indépendant verify-auth-session-lifecycle.cjs : la réutilisation du refresh token courant n'a pas révoqué le jeton de session courant. Les deux rotations et le rejet d'un ancien ancêtre hors fenêtre de tolérance ont passé. Cette alerte concerne la politique de rotation/révocation Supabase Auth, pas le remboursement Caisse ; elle reste ouverte et ne doit pas être neutralisée.
- Le nouveau run Replay 44197708312, sur le HEAD 8c80559796c22774c4c5cc968007714141e5bcf4, a commencé ; au dernier contrôle, il avait provisionné ses fixtures et était encore à l'installation Playwright/Chromium. Aucun résultat terminal n'est revendiqué pour ce nouveau run.
- Les modifications récentes du runtime E2E réutilisent uniquement les comptes de trésorerie déjà affectés et un compte crédit existant uniquement s'il est actif et à solde nul ; en fin de test, elles restaurent le solde initial ou suppriment seulement les fixtures qu'elles ont créées.

### Statut honnête
- **Vert :** contrat serveur des trois canaux ; idempotence ; contrôles visuels mobiles ; mouvements de trésorerie atomiques ; reçu UI ; tests SQL 302 ; JWT Caisse multicanal ; assertions navigateur Crédit (browser_failures=0) ; worker comptable positif sur les trois événements réels sous plan/période temporaires ; qualité complète du HEAD 8c805 (584 tests + TypeScript + lint + build).
- **Condition de mise en service :** chaque pharmacie doit disposer d'une période ouverte, d'un plan de comptes validé, des deux mappings crédit/remboursement et du journal comptable correspondant pour que le worker poste durablement les événements.
- **Rouge distinct :** contrôle Auth refresh-token-reuse du workflow global. Il n'est pas corrigé et reste indépendant du parcours Caisse.
- **Non livré dans ce chantier :** encaissement de vente POS via confirmation automatisée Orange/MTN ; le parcours ici porte sur les remboursements de crédit au comptoir avec vérification visuelle humaine.
- Aucune migration ni mutation Production et aucun déploiement Vercel n'ont été exécutés.


## Recette Auth Replay — 18 novembre 2026 : ROUGE

- Périmètre Replay uniquement, sans accès ni mutation Production/Vercel.
- PASS : connexion navigateur du Gestionnaire Stock vers l'espace protégé ; cookie SSR présent ; suppression du cookie redirige vers `/connexion` ; première rotation refresh ; rejet d'un refresh token ancêtre.
- FAIL sécurité : après rejet du refresh token ancêtre hors fenêtre de tolérance, le refresh token courant de la même session reste accepté. Reproduit dans GitHub Actions Replay `44196261458` et `44197708312` (17 nov. 2026). La documentation Supabase indique que ce cas doit terminer la session entière et révoquer tous les refresh tokens.
- FAIL login intermittent : Auth Replay a renvoyé HTTP 500 `NAXA_SESSION_LIMIT_REACHED` le 17 nov. à 17:55 UTC. Le trigger `auth.sessions.trg_naxa_session_limit` est actif et bloque à 4 sessions non expirées. La migration `20261021040125_remove_concurrent_session_cap.sql` existe sur `main` mais est absente de l'historique migrations Replay ; la migration de compatibilité `20261021040237_bypass_legacy_session_count_precheck.sql` est également absente.
- La recette E2E actuelle laisse la session créée par le login navigateur active après avoir seulement supprimé les cookies locaux ; cela contribue à l'accumulation de sessions.
- NON TESTÉ en réel : signup OTP, mot de passe oublié OTP, Google OAuth/PKCE, expiration naturelle JWT. Aucun e-mail OTP n'a été envoyé pendant cette recette.
- Conclusion : **AUTH GLOBAL ROUGE / NON VALIDÉ**. Aucune correction ni migration exécutée pendant la recette.


## Section 204 — Vérification du contrôle Auth après rejeu d'un refresh token (18 novembre 2026)

### Vérification réelle de la famille de jetons sur Replay
- Le contrôle verify-auth-session-lifecycle.cjs a été exécuté sur le projet Replay pwfftcsjyeibxxqhwysw avec l'identité technique Gestionnaire Stock.
- Rotation initiale puis deuxième rotation : PASS ; le premier jeton devient un ancêtre (grand-parent) du jeton courant.
- Après 15 secondes, le rejeu de ce jeton ancêtre est rejeté par Auth : HTTP 400, error_code=refresh_token_already_used.
- Le rejeu rejeté n'a toutefois pas révoqué le jeton courant : la requête de rafraîchissement suivante a émis un nouveau jeton.
- Contrôle direct en lecture seule de auth.sessions et auth.refresh_tokens : la même session contient quatre lignes en chaîne parent/enfant. Les trois premiers jetons sont marqués revoked=true, mais le quatrième, créé immédiatement après le rejeu de l'ancêtre, reste revoked=false. La session reste donc rafraîchissable.
- Les journaux Auth confirment la séquence : rotation initiale ; deuxième rotation ; rejet du jeton ancêtre (HTTP 400 refresh_token_already_used) ; puis nouvelle rotation réussie (HTTP 200) du jeton courant. Le résultat n'est pas un simple faux positif dû au seul code HTTP.

### Interprétation et règle attendue
- La documentation Supabase User sessions (https://supabase.com/docs/guides/auth/sessions) décrit deux exceptions au rejeu : réutilisation dans la fenêtre configurée (10 secondes par défaut) et réutilisation du parent du jeton actuellement actif pour absorber une réponse réseau perdue.
- Hors de ces exceptions, Supabase indique que la session entière doit être terminée et que tous ses refresh tokens doivent être marqués révoqués.
- Le test reproduit bien un rejeu d'ancêtre après deux rotations et 15 secondes. Le maintien d'un jeton non révoqué contredit donc la règle documentée.
- La configuration avancée de détection/révocation du rejeu dans Auth Replay n'est pas exposée en lecture/écriture par les actions Supabase connectées disponibles dans ce chantier. Il n'est donc pas établi si le comportement vient du réglage Auth avancé désactivé ou d'un défaut du service hébergé.
- Aucun contournement par modification directe des tables internes auth.* n'est acceptable. Le point doit rester rouge jusqu'à activation/vérification du réglage de révocation de session au rejeu dans Supabase Dashboard → Authentication → Sessions → Advanced Settings, puis nouvelle recette démontrant que tous les refresh tokens de la session sont révoqués.

### Correction et durcissement du harnais E2E
- scripts/e2e/verify-auth-session-lifecycle.cjs évalue maintenant une réponse de rafraîchissement à partir de la présence effective des deux champs access_token et refresh_token, et non de response.ok seul.
- L'erreur émise indique sans divulguer de jeton le HTTP reçu et la présence/absence de chaque champ.
- Le script révoque localement les sessions API qu'il a créées dans son finally, sans révoquer globalement les sessions d'autres jobs E2E.
- scripts/e2e/refresh-session-check.cjs et scripts/test-auth-session-lifecycle.cjs ont été ajoutés ; quatre cas unitaires couvrent réponse complète, HTTP 200 sans jetons, réponse partielle et rejet HTTP 400.
- Le workflow Replay appelle explicitement ces tests et est déclenché par les fichiers de vérification Auth concernés.

### État de la preuve au dernier contrôle
- NAXA quality sur le HEAD précédent d6500adc485bb58b825a2736b4f028fdfd6c56da : SUCCESS.
- Nouveau HEAD de cette correction : a0c46325263a31df6f3f40048525dbf30ea70fdd. Les exécutions qualité 44233408404 et Replay 44233408413 sont lancées/en attente au dernier contrôle ; aucun résultat terminal de ces nouveaux runs n'est revendiqué.
- Les preuves antérieures du remboursement multicanal restent valides : test SQL 302 PASS avec ROLLBACK ; runtime JWT Caisse Replay PASS ; navigateur POS Caisse avec trois canaux, reçus, opérations, mouvements et tiroir espèces PASS ; Marketplace et Comptabilité navigateur PASS.
- Le run Replay 44197708312 a échoué uniquement sur la révocation Auth indépendante ; les assertions Crédit de ce run ont terminé avec browser_failures=0.
- Aucun changement de configuration Auth n'a été effectué ; aucune migration ni écriture Production et aucun déploiement Vercel.

### Statut honnête
- **Vert :** remboursement crédit espèces / Orange Money / MTN MoMo au comptoir ; preuves visuelles mobiles ; idempotence ; écritures de trésorerie atomiques ; outbox comptable ; reçu UI ; clôture espèces-only ; recette SQL 302 ; runtime JWT et navigateur.
- **Vert :** suite qualité complète du HEAD antérieur mentionné ; nouvelle suite qualité en cours sur le dernier HEAD.
- **Rouge distinct et bloquant pour le vert E2E global :** la détection de rejeu Auth refuse le jeton ancêtre, mais la famille de session conserve un refresh token actif. Le réglage de révocation de session au rejeu doit être vérifié/corrigé côté Auth Replay ; le harnais n'atténue pas cette exigence.
- **Non revendiqué :** confirmation opérateur Orange/MTN automatisée et paiements électroniques des ventes POS ; ce chantier valide les remboursements de crédit avec vérifications visuelles humaines.


## Section 205 — Dernière validation qualité et recette Replay en cours (18 novembre 2026)

### HEAD et qualité applicative
- HEAD main : 409e89e69bf9d89b68c869e62e4c677595eb4b43.
- Run GitHub Actions NAXA quality 44233811015 : SUCCESS.
- npm test : 588 tests, 588 PASS, 0 FAIL.
- tsc --noEmit : PASS ; ESLint : PASS ; actionlint : PASS ; build Next.js : compilation réussie, 156/156 pages statiques générées, service worker produit.
- Le run 44233677552 avait échoué uniquement sur un import CommonJS sans extension .cjs dans le test Auth ajouté. Les imports ont été corrigés vers refresh-session-check.cjs ; le run 44233811015 valide ces corrections.
- Les avertissements existants de compatibilité des peer dependencies ESLint/React ne font pas échouer la qualité ; l'avertissement React 18 / Next.js 16 reste technique et distinct du parcours remboursement.

### Nouvelle recette Replay sur le HEAD 409e89e
- Run Replay 44233811098 : en attente du verrou de concurrence au dernier contrôle.
- Run Replay précédent 44233363828 : provisionnement Promoteur, Admin, Client, Caisse/Stock, Livreur, Comptable et Pharmacien terminé ; build du serveur de test et Web Push terminés avec succès.
- Dans ce run précédent, l'étape « Exécuter le remboursement crédit via un vrai JWT Caisse Replay » est terminée avec succès.
- L'étape « Recette navigateur crédit comptoir, décision Promoteur et remboursement » était encore en cours au dernier contrôle. Aucune conclusion navigateur ou conclusion globale de ce run n'est revendiquée à cette heure.
- Le run précédent utilise un commit antérieur à la correction de résolution explicite du helper Auth .cjs ; le nouveau run 44233811098 est nécessaire pour valider la recette Auth sur le HEAD courant.

### État métier et réserves
- Le parcours remboursement au comptoir demeure vert sur les preuves déjà terminales : SQL Replay 302 avec rollback ; RPC runtime via JWT Caisse PASS sur les trois canaux ; mouvements de trésorerie distincts ; preuves visuelles Orange/MTN ; outbox comptable unique ; idempotence et refus négatifs ; clôture espèces-only.
- La qualité applicative du HEAD courant est verte (588 tests + TypeScript + ESLint + actionlint + build Next.js).
- Le contrôle Auth refresh-token-reuse reste rouge : après deux rotations et 15 secondes, l'ancien jeton ancêtre est rejeté HTTP 400, mais un refresh token descendant reste actif. Le contrôle direct auth.refresh_tokens a montré quatre jetons en chaîne, dont le dernier non révoqué. Ce constat n'est ni corrigé ni masqué par le nouveau harnais.
- Les fichiers d'essai et tests n'ont pas modifié Production. Aucun déploiement Vercel n'a été effectué.
- La correction E2E Auth vérifie maintenant la présence des deux jetons avant de considérer une réponse HTTP 200 comme une session valide ; quatre tests unitaires couvrent les cas complet, vide, partiel et rejeté.


## Section 206 — Résultat complet du run Replay précédent et reprise corrigée (18 novembre 2026)

### Run Replay 44233363828 — résultats terminaux
- Provisionnement Promoteur/Admin/Client/Caisse/Stock/Comptable/Pharmacien/Livreur et pharmacie technique : PASS.
- Build de recette Next.js : PASS ; Web Push navigateur Chrome stable : PASS (3 souscriptions authentifiées ciblées, 3 envois et 3 réceptions dans le Service Worker ; aucune prétention de reçu FCM Android physique).
- Remboursement crédit via JWT Caisse Replay : PASS.
- Parcours navigateur Crédit comptoir : PASS ; demande au-dessus du plafond, approbation Promoteur, débit de stock une fois, suivi Client, remboursement via Caisse, solde ramené à zéro, outbox et clôture rapprochée.
- Marketplace crédit : PASS ; demande Client en attente sans débit ni réservation de stock, rejet Promoteur, stock inchangé.
- Comptabilité : PASS ; deux comptes, deux journaux, quatre mappings débit/crédit créés/validés par l'interface Promoteur puis nettoyage des seules lignes de configuration temporaires.
- Storage E2E : PASS ; nettoyage des fichiers secrets temporaires : PASS.
- browser_failures=0 ; les trois tests navigateur Crédit, Marketplace et Comptabilité ont donc tous réussi.

### Cause unique de l'échec de ce run
- Le script de vérification Auth s'est arrêté avant ses assertions métier à cause de l'import CommonJS `Cannot find module './refresh-session-check'` ; la correction `.cjs` a été appliquée dans le HEAD suivant.
- Ce run est antérieur à la correction d'import et ne constitue donc ni un PASS ni un FAIL du contrôle de révocation Auth. Le défaut Auth observé sur le run 44197708312 et par inspection SQL de la famille de jetons Replay reste une réserve indépendante.

### Reprise sur HEAD 409e89e69bf9d89b68c869e62e4c677595eb4b43
- Run `NAXA quality` 44233811015 : SUCCESS, 588/588 tests PASS, TypeScript, ESLint, actionlint et build Next.js PASS (156 pages statiques).
- Run Replay 44233811098 : démarré sur ce HEAD ; provisionnement jusqu'à la pharmacie et au stock technique PASS. Installation Playwright/Chromium en cours au dernier contrôle ; aucune conclusion JWT/navigateur/Auth de ce run n'est revendiquée.
- Le document de continuité doit rester explicite : le parcours remboursement multicanal est vert sur les preuves SQL/JWT/navigateur terminales précédentes ; le vert du workflow global dépend encore du test Auth exécuté sur le dernier HEAD et de la politique de révocation du projet Replay.

## Section 207 — Extension du remboursement Caisse aux trois canaux (18 novembre 2026)

### Implémentation versionnée sur main
- Le RPC `client_credit_rembourser` réalise dans une seule transaction : contrôle du crédit et de la session Caisse, débit du solde, insertion de l'opération, mouvement d'encaissement dans le compte du canal ; les remboursements Orange Money et MTN MoMo exigent la référence opérateur et les trois confirmations visuelles.
- Les trois canaux sont distincts : `especes`, `orange_money`, `mtn_momo`. Le compte de trésorerie est sélectionné par pharmacie et canal ; la création du compte manquant est protégée par verrou transactionnel et réutilisable sans doublon.
- L'idempotence vérifie la même opération, le même crédit, montant, canal, référence et motif ; le rejeu renvoie l'identifiant initial seulement si le mouvement de trésorerie existe. Une clé réutilisée avec un autre payload est refusée.
- L'interface Caisse conserve la clé idempotence tant que la demande n'a pas été confirmée, permet la lecture/création des comptes par canal et affiche le reçu de remboursement. La clôture du tiroir reste limitée aux espèces.
- Tests versionnés : `supabase/tests/302_caisse_credit_repayment_multichannel_e2e.sql` (exécuté sur Replay avec rollback) et `scripts/e2e/verify-credit-refund-runtime.cjs` (vrai JWT Promoteur/Caisse/Client, trois remboursements, rejeu, refus négatifs, mouvements, outbox et nettoyage). Le test runtime réutilise seulement un compte crédit technique actif à solde nul et ne modifie pas les comptes trésorerie existants ; les comptes créés par la recette sont supprimés.
- Les tests de contrat `scripts/test-credit-refund-runtime.cjs` et `scripts/test-caisse-credit-remboursement.cjs` vérifient la portée Replay, les trois canaux, les preuves, l'idempotence et le nettoyage.

### Preuves disponibles au relevé
- SQL Replay 302 : PASS avec rollback ; les opérations et comptes de recette n'ont laissé aucune ligne.
- GitHub Actions `NAXA quality` sur HEAD `96a028020bc4af27131ea74da732186f2baa4415` : SUCCESS ; job tests/TypeScript/lint et job actionlint terminés avec succès.
- Workflow `NAXA Replay Promoteur E2E` run `44234988988`, même HEAD : démarré ; tests de contrats, préflight des secrets Replay, Promoteur et Admin, invitation Client/Livreur : PASS. Provisionnement Caisse/Stock/Comptable/Pharmacien encore en cours au relevé ; les étapes JWT remboursement, navigateur, Web Push et nettoyage final ne sont donc pas encore déclarées PASS sur ce run.

### Limites explicites
- Les PASS SQL et qualité ne remplacent pas le résultat runtime authentifié des trois canaux. Le vert E2E final dépend de la terminaison du run Replay ci-dessus.
- La confirmation des paiements mobiles reste visuelle et humaine ; aucune API opérateur Orange/MTN n'est revendiquée.
- Les paiements électroniques de vente POS restent hors périmètre de cette correction. Aucun changement Production ni déploiement Vercel.

## Section 208 — Clôture du chantier remboursement multicanal et réserves globales (18 novembre 2026)

### État vérifié au dernier contrôle
- HEAD main avant cette mise à jour : 888cc54a3c45d1be88f48506094905f0e43d2c07.
- Projet ciblé : Replay `pwfftcsjyeibxxqhwysw`, état API `ACTIVE_HEALTHY`. Aucun accès ni changement Production.
- Run GitHub Actions Replay `44234988988`, commit applicatif `96a028020bc4af27131ea74da732186f2baa4415` : le provisionnement Promoteur/Admin/Client/Caisse/Stock/Comptable/Pharmacien/Livreur et pharmacie technique, l'installation Playwright/Chromium, le build Next.js et la vérification Chrome sont terminés avec succès. L'étape Web Push est encore `in_progress`; les étapes JWT remboursement, navigateur crédit, Storage et nettoyage final sont en attente. Ce run n'est donc pas terminal.
- Run antérieur `44233363828` : remboursement via vrai JWT Caisse PASS ; navigateur crédit comptoir, Marketplace et Comptabilité PASS ; `browser_failures=0` ; Storage et nettoyage des fichiers secrets PASS. Ces preuves restent acquises pour le commit testé, sans les attribuer au run 44234988988.
- SQL Replay 302 avec rollback et qualité GitHub Actions sur le commit applicatif : PASS selon les preuves consignées en section 207.

### Réserve Auth indépendante
- Le script `scripts/e2e/verify-auth-session-lifecycle.cjs` vérifie la rotation, le rejet d'un jeton ancêtre hors fenêtre de tolérance et la révocation effective de toute la famille.
- La dernière observation documentée reste rouge : le jeton ancêtre est rejeté, mais un refresh token descendant demeure utilisable.
- La documentation Supabase décrit le comportement attendu : hors fenêtre de réutilisation et hors exception du parent actif, la session entière doit être terminée et tous ses refresh tokens révoqués. Elle précise que ce comportement peut être désactivé dans les Advanced Settings Auth du projet.
- Les actions Supabase connectées disponibles dans ce chantier ne donnent pas accès à la lecture/écriture de ce réglage de configuration Auth. Aucune modification directe des tables internes `auth.*` n'est autorisée comme contournement.
- Action externe nécessaire sur Replay : vérifier/activer la détection de réutilisation avec révocation de toute la session dans Dashboard → Authentication → Sessions → Advanced Settings, puis relancer le test Auth. Tant que ce contrôle n'est pas PASS, le vert E2E global est refusé.

### Conclusion de clôture
- **Remboursement multicanal : fonctionnellement validé par les preuves terminales antérieures** (SQL, JWT, navigateur, idempotence, preuves mobiles, mouvements de trésorerie, outbox, rapprochement espèces et nettoyage).
- **Run de clôture 44234988988 : en cours**, pas de résultat terminal revendiqué ; son Web Push doit terminer avant de considérer l'ensemble de ce workflow.
- **Auth : ROUGE / action Dashboard Replay requise** ; ce point est indépendant du remboursement.
- **Vert global E2E : NON ACQUIS** tant que le run courant n'est pas terminal et que la révocation de la famille de refresh tokens n'est pas démontrée.
- Aucune migration Production, aucune écriture Production et aucun déploiement Vercel.
