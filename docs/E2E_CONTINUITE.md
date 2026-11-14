# Continuité des recettes E2E NAXA

> **Document de reprise vivant.** Mettre à jour ce fichier dès qu'une réponse fait avancer une recette, apporte une preuve, découvre un blocage ou modifie une décision. Toute correction de code nécessaire doit être intégrée à la source versionnée sur `main`, puis reliée ici à son commit et à sa preuve. Ne jamais conserver un correctif uniquement dans la conversation.

**Dernière mise à jour :** 14 novembre 2026  
**Dépôt / branche de référence :** `audreymendomo23-netizen/NAXA` / `main`  
**État général E2E :** 🟡 PARTIEL — aucune validation E2E globale déclarée.

## 1. Règles de recette et périmètre sûr

- Travailler directement sur `main` ; aucune branche de travail ni PR.
- Distinguer systématiquement code modifié, test statique, exécution E2E, nettoyage vérifié et recette métier réelle.
- **Supabase Replay de recette :** `naxa-ci-replay-2`, projet `pwfftcsjyeibxxqhwysw`, URL `https://pwfftcsjyeibxxqhwysw.supabase.co`.
- **Supabase Production NAXA :** projet `Naxa`, référence observée `eouwtuusnsuxaejsxknf`. Aucun test Storage destructif, création de compte de test ou nettoyage automatisé sur Production.
- Les clés et mots de passe ne doivent jamais être copiés dans le dépôt, la documentation ou la conversation.
- `vercel.json` désactive les déploiements Git de `main` (`git.deploymentEnabled.main = false`). Les commits de cette passe ne déclenchent donc pas de déploiement Vercel Production. Aucun déploiement ni migration Production n'a été exécuté dans cette passe.
- Aucun APK n'est publié sur Play Store.

## 2. État de référence au 14/11/2026

Le HEAD avant cette passe était `2c596bf548589f8c6750f3b8d07e8284db3ce5de`. La comparaison GitHub confirme que `main` est maintenant en avance de deux commits, sans retard par rapport à cette base :

| Commit sur `main` | Changement | Preuve |
|---|---|---|
| `47738ab30842ac041c7ead08d3038dede96bcd46` | Durcit le nettoyage du harnais Storage E2E : les erreurs de suppression ne sont plus ignorées. | Source `scripts/storage-e2e.cjs` relue ; analyse syntaxique V8 PASS. |
| `440d987dd377d335b416add01ef81685c146b146` | Déclenche la recette Storage quand le workflow, le script ou ses dépendances changent. | Diff GitHub : workflow modifié, +3 lignes ; `main` avancé de 2 commits. |

Liens directs :
- [Commit correctif du harnais](https://github.com/audreymendomo23-netizen/NAXA/commit/47738ab30842ac041c7ead08d3038dede96bcd46)
- [Commit déclenchement automatique](https://github.com/audreymendomo23-netizen/NAXA/commit/440d987dd377d335b416add01ef81685c146b146)
- [Workflow Storage E2E](https://github.com/audreymendomo23-netizen/NAXA/blob/main/.github/workflows/naxa-storage-e2e.yml)
- [Script Storage E2E](https://github.com/audreymendomo23-netizen/NAXA/blob/main/scripts/storage-e2e.cjs)

## 3. Recette Supabase Storage E2E

### 3.1 Exécution automatisée

Fichiers concernés :
- Workflow : `.github/workflows/naxa-storage-e2e.yml`
- Script : `scripts/storage-e2e.cjs`
- Commande : `npm run test:storage:e2e`

Le workflow est épinglé au projet Replay `pwfftcsjyeibxxqhwysw`. Son préflight refuse toute autre URL avant l'exécution du script. Les déclencheurs `push` couvrent maintenant :
- le fichier du workflow ;
- `scripts/storage-e2e.cjs` ;
- `package.json` ;
- `package-lock.json`.

Le déclencheur manuel `workflow_dispatch` reste disponible. La matrice de rôles est désactivée par défaut (`require_role_matrix = false)).

### 3.2 Secrets GitHub Actions

L'utilisateur a confirmé l'ajout des trois secrets obligatoires :
- `NAXA_STORAGE_E2E_URL`
- `NAXA_STORAGE_E2E_ANON_KEY`
- `NAXA_STORAGE_E2E_ADMIN_KEY`

La valeur d'URL attendue est celle du Replay 2 ci-dessus. Les valeurs des clés restent masquées et ne sont ni lues ni reproduites dans ce document.

Secrets facultatifs pour la matrice de rôles :
- `NAXA_STORAGE_E2E_ADMIN_EMAIL`
- `NAXA_STORAGE_E2E_ADMIN_PASSWORD`
- `NAXA_STORAGE_E2E_PROMOTEUR_EMAIL`
- `NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD`
- `NAXA_STORAGE_E2E_PROMOTEUR_PHARMACY_ID`
- `NAXA_STORAGE_E2E_OTHER_PHARMACY_ID`

Ne pas activer `require_role_matrix` tant que ces comptes et affectations Replay ne sont pas de vrais comptes de recette correctement liés. Ne pas simuler un paiement, une convention ou un lien Promoteur pour faire passer artificiellement le test.

### 3.3 Scénarios présents dans le script

Scénarios de base :
1. création de deux utilisateurs Auth temporaires ;
2. dépôt d'un vrai PDF par son propriétaire ;
3. téléchargement authentifié du PDF par ce propriétaire ;
4. refus de lecture et d'écriture inter-utilisateurs ;
5. refus de lecture anonyme du bucket privé ;
6. création puis consommation d'une URL signée par le propriétaire ;
7. refus de création d'URL signée par un autre utilisateur ;
8. refus d'un type MIME interdit ;
9. refus d'écriture client dans les buckets réservés aux services et à l'administration ;
10. dépôt de service et lecture HTTP publique d'une vraie image ;
11. suppression du fichier privé par son propriétaire.

Matrice facultative Admin : dépôt/lecture de document privé, remplacement/lecture publique d'une image médicament, refus d'accès à ce document par un non-Admin.

Matrice facultative Promoteur : dépôt dans sa pharmacie liée, remplacement du logo, refus d'écriture dans une autre pharmacie.

### 3.4 Correction de fiabilité et nettoyage

**Cause racine corrigée dans le commit `47738ab` :** l'ancien bloc `finally` avalait les erreurs de nettoyage avec `.catch(() => undefined)`. Un run pouvait ainsi échouer pour une assertion tout en masquant un objet ou un compte temporaire non supprimé.

**Correction appliquée :**
- chaque ID Auth est enregistré dès la création de l'utilisateur, avant la tentative de connexion ;
- les objets dont l'écriture interdite serait acceptée sont ajoutés à la liste de nettoyage avant de faire échouer le test ;
- les objets et comptes temporaires sont supprimés dans le bloc final ;
- chaque suppression réussie est journalisée `CLEANUP PASS` ;
- chaque suppression en échec est journalisée `CLEANUP FAIL` ; si la recette n'a pas déjà échoué, une erreur de nettoyage fait échouer le processus au lieu de laisser le run vert.

**Contrôle réellement exécuté :** analyse syntaxique du script par le moteur JavaScript V8 : PASS (shebang retiré uniquement pour l'analyse).  
**Contrôle non encore prouvé :** exécution réelle contre Storage Replay, assertions HTTP/RLS et nettoyage final. Une analyse syntaxique n'est pas un PASS E2E.

### 3.5 Statut d'exécution

Les trois secrets ont franchi le préflight dans les deux derniers runs. La recette s'est arrêtée dans le script avant le premier scénario Storage :

| Run | Événement / SHA | Résultat | Étape en échec |
|---|---|---|---|
| [43595339170 — run 2](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43595339170) | `workflow_dispatch`, SHA `2c596bf548589f8c6750f3b8d07e8284db3ce5de` | **FAIL** | `Execute binary Storage E2E and cleanup` |
| [43595620015 — run 3](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43595620015) | `push`, SHA `440d987dd377d335b416add01ef81685c146b146` | **FAIL** | `Execute binary Storage E2E and cleanup` |

Le préflight Replay et `npm ci` sont PASS dans ces deux runs. Le run 3 est le premier déclenché par l'élargissement du filtre `paths`. Le diagnostic et le correctif sont détaillés en §3.6.

**Après le correctif `c026fb9` :** le script a été relu sur `main` et le marqueur de signup provisoire est présent. Le changement de `scripts/storage-e2e.cjs` déclenche un nouveau run par le workflow. Son résultat d'exécution reste à récupérer ; aucune assertion Storage n'est encore déclarée PASS.

Page de suivi : [GitHub Actions — NAXA Storage E2E](https://github.com/audreymendomo23-netizen/NAXA/actions/workflows/naxa-storage-e2e.yml).

### 3.6 Audit de la panne Auth et correction

**Cause racine confirmée par les logs Supabase Replay :**

- Runs `43595339170` et `43595620015` : le préflight accepte les trois secrets, puis `npm run test:storage:e2e` échoue sur `Création du compte temporaire refusée (HTTP 500)`.
- Les logs `auth_logs` pour les deux heures exactes identifient `POST /admin/users`, `status=500`, `error_code=unexpected_failure`.
- Les logs PostgreSQL associés au même `request_id` montrent `Nom d'utilisateur invalide`, SQLSTATE `P0001`, dans `public.handle_new_user()`, ligne 27 au `RAISE`.
- La fonction lit `raw_user_meta_data->>'username'` et refuse une valeur nulle ou hors motif `^[a-z0-9][a-z0-9._-]{2,29}# Continuité des recettes E2E NAXA

> **Document de reprise vivant.** Mettre à jour ce fichier dès qu'une réponse fait avancer une recette, apporte une preuve, découvre un blocage ou modifie une décision. Toute correction de code nécessaire doit être intégrée à la source versionnée sur `main`, puis reliée ici à son commit et à sa preuve. Ne jamais conserver un correctif uniquement dans la conversation.

**Dernière mise à jour :** 14 novembre 2026  
**Dépôt / branche de référence :** `audreymendomo23-netizen/NAXA` / `main`  
**État général E2E :** 🟡 PARTIEL — aucune validation E2E globale déclarée.

## 1. Règles de recette et périmètre sûr

- Travailler directement sur `main` ; aucune branche de travail ni PR.
- Distinguer systématiquement code modifié, test statique, exécution E2E, nettoyage vérifié et recette métier réelle.
- **Supabase Replay de recette :** `naxa-ci-replay-2`, projet `pwfftcsjyeibxxqhwysw`, URL `https://pwfftcsjyeibxxqhwysw.supabase.co`.
- **Supabase Production NAXA :** projet `Naxa`, référence observée `eouwtuusnsuxaejsxknf`. Aucun test Storage destructif, création de compte de test ou nettoyage automatisé sur Production.
- Les clés et mots de passe ne doivent jamais être copiés dans le dépôt, la documentation ou la conversation.
- `vercel.json` désactive les déploiements Git de `main` (`git.deploymentEnabled.main = false`). Les commits de cette passe ne déclenchent donc pas de déploiement Vercel Production. Aucun déploiement ni migration Production n'a été exécuté dans cette passe.
- Aucun APK n'est publié sur Play Store.

## 2. État de référence au 14/11/2026

Le HEAD avant cette passe était `2c596bf548589f8c6750f3b8d07e8284db3ce5de`. La comparaison GitHub confirme que `main` est maintenant en avance de deux commits, sans retard par rapport à cette base :

| Commit sur `main` | Changement | Preuve |
|---|---|---|
| `47738ab30842ac041c7ead08d3038dede96bcd46` | Durcit le nettoyage du harnais Storage E2E : les erreurs de suppression ne sont plus ignorées. | Source `scripts/storage-e2e.cjs` relue ; analyse syntaxique V8 PASS. |
| `440d987dd377d335b416add01ef81685c146b146` | Déclenche la recette Storage quand le workflow, le script ou ses dépendances changent. | Diff GitHub : workflow modifié, +3 lignes ; `main` avancé de 2 commits. |

Liens directs :
- [Commit correctif du harnais](https://github.com/audreymendomo23-netizen/NAXA/commit/47738ab30842ac041c7ead08d3038dede96bcd46)
- [Commit déclenchement automatique](https://github.com/audreymendomo23-netizen/NAXA/commit/440d987dd377d335b416add01ef81685c146b146)
- [Workflow Storage E2E](https://github.com/audreymendomo23-netizen/NAXA/blob/main/.github/workflows/naxa-storage-e2e.yml)
- [Script Storage E2E](https://github.com/audreymendomo23-netizen/NAXA/blob/main/scripts/storage-e2e.cjs)

## 3. Recette Supabase Storage E2E

### 3.1 Exécution automatisée

Fichiers concernés :
- Workflow : `.github/workflows/naxa-storage-e2e.yml`
- Script : `scripts/storage-e2e.cjs`
- Commande : `npm run test:storage:e2e`

Le workflow est épinglé au projet Replay `pwfftcsjyeibxxqhwysw`. Son préflight refuse toute autre URL avant l'exécution du script. Les déclencheurs `push` couvrent maintenant :
- le fichier du workflow ;
- `scripts/storage-e2e.cjs` ;
- `package.json` ;
- `package-lock.json`.

Le déclencheur manuel `workflow_dispatch` reste disponible. La matrice de rôles est désactivée par défaut (`require_role_matrix = false)).

### 3.2 Secrets GitHub Actions

L'utilisateur a confirmé l'ajout des trois secrets obligatoires :
- `NAXA_STORAGE_E2E_URL`
- `NAXA_STORAGE_E2E_ANON_KEY`
- `NAXA_STORAGE_E2E_ADMIN_KEY`

La valeur d'URL attendue est celle du Replay 2 ci-dessus. Les valeurs des clés restent masquées et ne sont ni lues ni reproduites dans ce document.

Secrets facultatifs pour la matrice de rôles :
- `NAXA_STORAGE_E2E_ADMIN_EMAIL`
- `NAXA_STORAGE_E2E_ADMIN_PASSWORD`
- `NAXA_STORAGE_E2E_PROMOTEUR_EMAIL`
- `NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD`
- `NAXA_STORAGE_E2E_PROMOTEUR_PHARMACY_ID`
- `NAXA_STORAGE_E2E_OTHER_PHARMACY_ID`

Ne pas activer `require_role_matrix` tant que ces comptes et affectations Replay ne sont pas de vrais comptes de recette correctement liés. Ne pas simuler un paiement, une convention ou un lien Promoteur pour faire passer artificiellement le test.

### 3.3 Scénarios présents dans le script

Scénarios de base :
1. création de deux utilisateurs Auth temporaires ;
2. dépôt d'un vrai PDF par son propriétaire ;
3. téléchargement authentifié du PDF par ce propriétaire ;
4. refus de lecture et d'écriture inter-utilisateurs ;
5. refus de lecture anonyme du bucket privé ;
6. création puis consommation d'une URL signée par le propriétaire ;
7. refus de création d'URL signée par un autre utilisateur ;
8. refus d'un type MIME interdit ;
9. refus d'écriture client dans les buckets réservés aux services et à l'administration ;
10. dépôt de service et lecture HTTP publique d'une vraie image ;
11. suppression du fichier privé par son propriétaire.

Matrice facultative Admin : dépôt/lecture de document privé, remplacement/lecture publique d'une image médicament, refus d'accès à ce document par un non-Admin.

Matrice facultative Promoteur : dépôt dans sa pharmacie liée, remplacement du logo, refus d'écriture dans une autre pharmacie.

### 3.4 Correction de fiabilité et nettoyage

**Cause racine corrigée dans le commit `47738ab` :** l'ancien bloc `finally` avalait les erreurs de nettoyage avec `.catch(() => undefined)`. Un run pouvait ainsi échouer pour une assertion tout en masquant un objet ou un compte temporaire non supprimé.

**Correction appliquée :**
- chaque ID Auth est enregistré dès la création de l'utilisateur, avant la tentative de connexion ;
- les objets dont l'écriture interdite serait acceptée sont ajoutés à la liste de nettoyage avant de faire échouer le test ;
- les objets et comptes temporaires sont supprimés dans le bloc final ;
- chaque suppression réussie est journalisée `CLEANUP PASS` ;
- chaque suppression en échec est journalisée `CLEANUP FAIL` ; si la recette n'a pas déjà échoué, une erreur de nettoyage fait échouer le processus au lieu de laisser le run vert.

**Contrôle réellement exécuté :** analyse syntaxique du script par le moteur JavaScript V8 : PASS (shebang retiré uniquement pour l'analyse).  
**Contrôle non encore prouvé :** exécution réelle contre Storage Replay, assertions HTTP/RLS et nettoyage final. Une analyse syntaxique n'est pas un PASS E2E.

### 3.5 Statut d'exécution

Les trois secrets ont franchi le préflight dans les deux derniers runs. La recette s'est arrêtée dans le script avant le premier scénario Storage :

| Run | Événement / SHA | Résultat | Étape en échec |
|---|---|---|---|
| [43595339170 — run 2](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43595339170) | `workflow_dispatch`, SHA `2c596bf548589f8c6750f3b8d07e8284db3ce5de` | **FAIL** | `Execute binary Storage E2E and cleanup` |
| [43595620015 — run 3](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43595620015) | `push`, SHA `440d987dd377d335b416add01ef81685c146b146` | **FAIL** | `Execute binary Storage E2E and cleanup` |

Le préflight Replay et `npm ci` sont PASS dans ces deux runs. Le run 3 est le premier déclenché par l'élargissement du filtre `paths`. Le diagnostic et le correctif sont détaillés en §3.6.

**Après le correctif `c026fb9` :** le script a été relu sur `main` et le marqueur de signup provisoire est présent. Le changement de `scripts/storage-e2e.cjs` déclenche un nouveau run par le workflow. Son résultat d'exécution reste à récupérer ; aucune assertion Storage n'est encore déclarée PASS.

Page de suivi : [GitHub Actions — NAXA Storage E2E](https://github.com/audreymendomo23-netizen/NAXA/actions/workflows/naxa-storage-e2e.yml).

. Le harnais envoyait seulement `{ naxa_storage_e2e: true }` : aucun champ `username` n'était fourni.
- Le trigger dispose déjà d'une voie officielle pour l'identité Auth provisoire : lorsque `raw_user_meta_data->>'naxa_signup_pending' = 'true'`, il retourne l'identité Auth sans créer de profil NAXA ni exécuter les validations métier du profil. C'est précisément le comportement attendu pour ces comptes techniques éphémères, uniquement utilisés pour les tests Storage.
- Le SQLSTATE `25P02` « current transaction is aborted » et l'échec du `DEALLOCATE` observés ensuite sont secondaires : ils surviennent après le `RAISE` initial et ne constituent pas la cause racine.

**Correction appliquée au code :**

- Commit [`c026fb9d3737a66c8a67be150a36d994e1f5e47b`](https://github.com/audreymendomo23-netizen/NAXA/commit/c026fb9d3737a66c8a67be150a36d994e1f5e47b) sur `main`.
- Le harnais envoie désormais `user_metadata: { naxa_storage_e2e: true, naxa_signup_pending: true }` lors de la création de ses comptes temporaires.
- Aucun assouplissement du trigger, aucune modification SQL ou de policy RLS et aucun utilisateur métier factice ne sont introduits. La modification est limitée au client E2E et suit le contrat d'onboarding déjà implémenté.
- Contrôle de source après commit : le marqueur est présent dans `scripts/storage-e2e.cjs` sur `main`.
- Contrôle de résidus Replay : `SELECT count(*) FROM auth.users WHERE raw_user_meta_data->>'naxa_storage_e2e' = 'true'` retourne **0** après les deux tentatives en échec. L'INSERT Auth ayant été annulé avec la transaction, aucun compte temporaire de ces runs n'est resté.
- Les runs précédents n'ont atteint aucun upload, lecture, contrôle d'isolation ou nettoyage Storage. Ces tests restent non exécutés et ne doivent pas être marqués PASS.
- La prochaine exécution automatique doit confirmer le correctif runtime. Si elle échoue encore, utiliser son nouveau message Auth/Postgres plutôt que de masquer l'erreur derrière le seul HTTP 500.

Périmètre de correction : Supabase Replay `pwfftcsjyeibxxqhwysw` et code GitHub `main` uniquement ; aucune action sur Production ni aucun déploiement.
## 4. Autres chantiers E2E — état connu

| Parcours | État prouvé | Réserve restante |
|---|---|---|
| Storage HTTP / isolation client / nettoyage | Harnais versionné ; syntaxe V8 PASS | Run Replay complet non confirmé ; pas de PASS runtime revendiqué. |
| Matrice Auth Admin / Promoteur / multi-pharmacies | Scénarios optionnels présents dans le script | Comptes et affectations de recette à confirmer ; matrice non exigée par défaut. |
| Réservation → préparation Gestionnaire Stock → proposition Livreur → acceptation → suivi Client → livraison → paiement → clôture/reporting | Parcours métier défini dans le périmètre NAXA | Aucune preuve E2E intégrale de bout en bout enregistrée ici. |
| Caméra, galerie, PDF, scanner/OCR sur appareils réels | Fonctions concernées identifiées | Recette réelle Android à exécuter ; pas de preuve appareil. |
| GPS, Bluetooth, SMS, notifications FCM et mode hors ligne | Contrats et structures partiellement vérifiés dans les travaux antérieurs | Réception et comportement sur téléphones enrôlés non prouvés. |
| Sécurité Supabase Replay | Les tests de rôles 287, 295, 296, 297, 298 et 299 totalisent 45 assertions PASS selon `STATUT.md` | La revue ciblée ne remplace pas une recette complète de toutes les RPC et policies. |
| Exposition API du schéma `private` | Privilèges SQL inventoriés | Confirmer le réglage Supabase « Exposed schemas » ; ne pas révoquer globalement USAGE/EXECUTE sans analyse. |
| Protection HIBP des mots de passe compromis | Blocage de plan documenté | Projet/organisation sur Free ; fonctionnalité réservée à Pro ou supérieur, aucune montée de plan autorisée dans cette passe. |

Les éléments détaillés de sécurité et les autres historiques techniques restent documentés dans `STATUT.md` et `docs/audits/AUDIT_360_ADMINISTRATEUR_NAXA.md`. Ne pas convertir des contrôles SQL isolés en validation E2E métier.

## 5. Prochain point de reprise

1. Récupérer le run créé par le changement de workflow et examiner le résumé, chaque étape et les logs.
2. Vérifier les assertions et les lignes `CLEANUP PASS` ; toute ligne `CLEANUP FAIL`, compte résiduel ou objet résiduel maintient le chantier en PARTIEL et entraîne une correction du script.
3. Une fois le scénario de base stabilisé, préparer la matrice Admin/Promoteur avec des identités et affectations Replay réelles, sans données ni secrets Production.
4. Continuer ensuite par les recettes navigateur métier puis par les appareils Android réels.

## 6. Journal de continuité

| Date | Commit / preuve | Avancement |
|---|---|---|
| 14/11/2026 | Base `2c596bf548589f8c6750f3b8d07e8284db3ce5de` | État antérieur à la passe. |
| 14/11/2026 | `47738ab30842ac041c7ead08d3038dede96bcd46` | Correction de suivi et de remontée des échecs de nettoyage Storage. Analyse syntaxique V8 PASS. |
| 14/11/2026 | `440d987dd377d335b416add01ef81685c146b146` | Le workflow se déclenche sur les changements du harnais et de ses dépendances. Runs 2 et 3 retrouvés : échec Auth HTTP 500. |
| 14/11/2026 | `c026fb9d3737a66c8a67be150a36d994e1f5e47b` | Cause racine Auth `Nom d'utilisateur invalide` identifiée ; ajout du marqueur `naxa_signup_pending=true` aux utilisateurs temporaires. Nouvelle exécution runtime attendue. |

---

**Règle de mise à jour à chaque reprise :** commencer par le dernier commit et le dernier run disponibles ; consigner les preuves nouvelles, les corrections sources et les SHA ; ne jamais écraser les réserves encore ouvertes ni déclarer AU VERT sans preuve d'exécution réelle.
