# Étape 2 — Audit détaillé Admin NAXA : dossiers Promoteurs
Date : 26 octobre 2026. Référence : `main`.
Périmètre : liste des dossiers, détail partenaire, actions serveur de création/validation et références de création pharmacie.
Méthode : lecture statique. Aucune validation de dossier, création de compte, activation ou écriture métier n’a été exécutée.

## 1. Liste des dossiers Promoteurs

La page exige le garde `requireAdminActive`, puis utilise le client privilégié pour lire les pharmacies et le registre transversal `admin_partner_dossiers`. Elle affiche des erreurs distinctes lorsque l’une des sources est indisponible et explique que Bébé & Maman est un service rattaché, non un établissement indépendant. Les cartes permettent d’ouvrir le dossier partenaire ou la fiche pharmacie.

- **PROM-01 — liste pharmacies non bornée.** La requête charge toutes les pharmacies sans pagination ni limite ; les dossiers partenaires sont limités à 500. La limite des partenaires est implicite dans le code et aucune pagination n’est fournie. Impact de performance non mesuré. Revoir après mesure du volume.
- **PROM-02 — compteurs de dossiers partiels.** Si la lecture du registre partenaire échoue, le compteur affiche `0 dossier(s)` en même temps qu’un avertissement d’indisponibilité. Le bandeau d’erreur atténue le risque, mais le compteur peut être confondu avec une absence réelle de dossiers. Afficher « Indisponible » dans ce cas.
- **PROM-03 — types non exhaustifs dans les libellés.** La carte traduit certains `universe_slug` et statuts connus, puis retombe sur la valeur brute. Ce fallback est utile pour éviter de cacher un état inconnu, mais les statuts nouveaux doivent être reconnus avant une certification fonctionnelle.

## 2. Détail du dossier partenaire

La page vérifie le format UUID avant la lecture, exige le garde Admin actif, puis récupère le dossier via `supabaseAdmin()`. Elle affiche les coordonnées privées, les données du Promoteur et son e-mail Auth. Le formulaire de validation n’est proposé que si `dossier_status === "pending"`. Les pièces sont clairement présentées comme déclarées reçues et non comme des fichiers justificatifs authentifiés.

- **PROM-DTL-01 — lecture privilégiée protégée par le garde.** Le garde est exécuté avant la lecture administrative. L’utilisation du client privilégié reste dépendante du maintien de ce contrôle ; aucun contournement n’a été observé dans le code de cette page.
- **PROM-DTL-02 — données personnelles visibles.** Date de naissance, téléphone et e-mail sont rendus dans le dossier Admin. C’est cohérent avec un écran de vérification d’identité, mais l’accès doit rester strictement limité aux administrateurs actifs et les captures/exportations doivent être traitées comme des données sensibles. Pas de défaut d’autorisation démontré par lecture seule.
- **PROM-DTL-03 — erreurs de lecture transformées en erreur serveur.** En cas d’erreur Supabase, la page journalise un code/message technique puis lève une exception. L’utilisateur n’obtient pas un état de reprise intégré à la page. Amélioration UX possible ; aucun détail sensible n’est directement rendu dans le message.
- **PROM-DTL-04 — le statut du partenaire et celui du dossier sont distincts.** L’interface affiche les deux, ce qui est utile. La fonction SQL de validation doit maintenir leurs transitions ensemble ; cela exige l’audit du corps RPC et des contraintes live avant de conclure à la cohérence transactionnelle.

## 3. Actions de création et validation

La création d’un partenaire indépendant valide côté serveur l’univers autorisé, les coordonnées, les champs Promoteur, l’âge, le tarif et l’architecture. Elle crée le compte Auth, puis appelle `admin_create_partner_dossier` avec les pièces déclarées. En cas d’échec de la RPC, elle tente de supprimer le compte Auth et journalise l’échec de cette compensation. Le registre relationnel dépend d’une RPC ; il faut examiner son corps et les contraintes live avant de qualifier le flux d’atomique.

La validation d’un partenaire appelle `admin_valider_dossier_partenaire` après garde Admin actif et validation du format UUID. Les erreurs sont traduites en messages utilisateur ; la page revalide ensuite les chemins pertinents. La validation pharmacie appelle séparément `admin_valider_dossier_pharmacie`, après confirmation explicite de vérification des autorisations, et le code décrit la RPC comme une transaction unique. Ces deux parcours ne doivent pas être fusionnés sans comparer leurs invariants.

- **PROM-ACT-01 — compensation Auth non atomique.** La suppression du compte en cas d’échec du dossier est une compensation « best effort ». L’échec est journalisé, mais nécessite une procédure de reprise manuelle. Point de fiabilité confirmé statiquement ; aucun échec n’a été reproduit.
- **PROM-ACT-02 — deux voies de validation distinctes.** Partenaire indépendant et pharmacie utilisent deux RPC différentes. Vérifier les préconditions, transitions de statut, journalisation, activation de l’univers et publication avant de conclure qu’elles sont équivalentes.
- **PROM-ACT-03 — messages d’erreur dépendants du texte SQL.** Les actions classent certaines erreurs en inspectant `error.message`. Un changement de formulation dans une fonction SQL peut faire tomber une erreur dans le message générique. À terme, préférer des codes d’erreur métier stables, si le contrat des RPC peut évoluer sans régression.

## 4. Rapprochement avec la création pharmacie

La création pharmacie, contrairement à `creerDossierUnivers`, n’inclut pas la clé `kyc` dans l’insertion de `pharmacie_documents_recus`, alors que le formulaire commun affiche cette case. Pour les dossiers partenaires indépendants, la clé `kyc` est bien incluse dans l’objet `documents_received` transmis à la RPC. Le défaut est donc circonscrit au parcours de création pharmacie examiné. Vérifier le schéma et les migrations avant correction ; ne pas inventer une colonne ni déplacer la donnée entre les deux modèles documentaires.

## 5. Registre

| ID | Point | Statut |
|---|---|---|
| PROM-01 | Liste pharmacies sans pagination | Confirmé statiquement, impact non mesuré |
| PROM-02 | Compteur partenaire à zéro si source indisponible | Confirmé statiquement, avertissement présent |
| PROM-03 | Fallback de libellés pour valeurs inconnues | À maintenir et vérifier |
| PROM-DTL-01 | Client privilégié après garde | Garde présente ; tests directs non réalisés |
| PROM-DTL-02 | Données personnelles sur le dossier | Justifiées par le besoin possible, accès à tester |
| PROM-DTL-03 | Erreur de lecture lève une exception | Amélioration UX possible |
| PROM-DTL-04 | Statuts dossier/partenaire distincts | RPC et contraintes à vérifier |
| PROM-ACT-01 | Compensation Auth best effort | Confirmé statiquement, aucun échec reproduit |
| PROM-ACT-02 | RPC de validation différentes | Confirmé statiquement, invariants à comparer |
| PROM-ACT-03 | Classification d’erreurs par texte | Fragilité de maintenance |
| CAT-01 | KYC non enregistré par création pharmacie | Défaut statique confirmé, schéma à vérifier |

## Suite
Continuer par les pages de pilotage, validité et rapports, puis auditer les définitions SQL live des RPC de création/validation avant toute modification. Aucun code, schéma, statut ou dossier métier n’a été modifié dans cette passe.


## Suivi d’exécution — 29 octobre 2026 : validation initiale du dossier pharmacie

### Constat revalidé sur `main`
- `src/app/admin/promoteurs/actions.ts` contenait déjà `validerDossierPharmacie` et l’appel à la RPC transactionnelle `admin_valider_dossier_pharmacie`, mais aucun formulaire ne déclenchait cette action depuis la fiche individuelle `/admin/pharmacies/[id]`. Le parcours d’ouverture était donc visible, tandis que la validation administrative globale manquait dans l’interface.
- La définition de la RPC en Supabase, consultée en lecture seule, est `SECURITY DEFINER`, avec `search_path` vide, contrôle interne `is_admin()`, attestation explicite, verrous et contrôles du rattachement, de la convention, de l’abonnement et de l’architecture. Le rôle `anon` n’a pas EXECUTE ; `authenticated` l’a sous le contrôle interne de la RPC.
- La fonction de synchronisation de validité bloque les pharmacies et profils impayés mais conserve actif le lien Promoteur–pharmacie. Les états pharmacie, visibilité, rattachement et profil permettent de distinguer une création encore en attente d’un dossier déjà exploité.

### Correctifs préparés sur `main`
- La fiche pharmacie présente un formulaire global de validation avec attestation obligatoire que l’administrateur a vérifié les autorisations et pièces.
- L’action serveur vérifie avant l’appel RPC que la pharmacie est inactive et masquée, qu’elle possède un unique lien Promoteur inactif et que le profil correspondant est inactif et correctement rattaché.
- Migration additive `supabase/migrations/20261029110000_admin_validate_dossier_pending_only.sql` : les mêmes gardes sont ajoutées dans la RPC verrouillée avant toute réinitialisation des dates d’abonnement. Un appel direct à la RPC ne peut donc pas réinitialiser l’essai d’une pharmacie déjà exploitée.
- Test structurel ajouté : `supabase/tests/20261029110000_admin_validate_dossier_pending_only.sql`, couvrant les gardes d’état, leur ordre, SECURITY DEFINER et les privilèges.
- Le constat historique CAT-01 concernant KYC est supersédé : le code courant de création pharmacie transmet `kyc` et le schéma lu confirme que la colonne existe. Aucune colonne concurrente n’a été créée.

### État des preuves
- Contrôle Supabase exécuté en lecture seule : définition de la RPC, droits EXECUTE et fonction de synchronisation de validité consultés.
- **Le nouveau contrat SQL n’a pas été exécuté** : la migration n’a pas été appliquée à une base de test dans cette passe. Build, typecheck, lint et navigateur non exécutés.
- Aucune migration appliquée à Supabase, aucune donnée métier modifiée, aucun déploiement déclenché.
- Suite : rejouer la migration et le contrat sur un PostgreSQL de test isolé, puis demander séparément l’autorisation de déployer avant recette visuelle.
