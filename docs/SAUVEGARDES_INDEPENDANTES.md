# Sauvegardes indépendantes NAXA

Dernière révision : 13 novembre 2026.

## 1. Périmètre et état réel

La protection des données NAXA est organisée en volets distincts :
- base de données PostgreSQL du projet Supabase Production ;
- fichiers binaires déposés dans Supabase Storage ;
- configuration de la plateforme et éléments nécessaires à la reprise ;
- copies hors site et exercices de restauration.

La présence d'un workflow ou d'une migration dans Git ne prouve pas qu'une sauvegarde a été produite ni qu'elle est restaurable. Chaque volet doit avoir ses propres preuves d'exécution.

## 2. Sauvegarde de la base actuellement codée

Workflow : `.github/workflows/naxa-independent-backup.yml`.

Déclencheurs :
- chaque jour à 02:23 UTC (03:23, heure du Cameroun en novembre) ;
- lancement manuel par `workflow_dispatch` ;
- validation automatique lorsqu'on modifie le fichier du workflow.

Méthode implémentée sur `main` :
1. Validation de l'URI complète Supabase Shared Session Pooler de Production (port 5432) et de la phrase de chiffrement.
2. Export séparé des rôles, du schéma et des données avec `supabase db dump`.
3. Création d'une archive tar.gz.
4. Chiffrement AES-256-CBC avec PBKDF2.
5. Déchiffrement de contrôle et comparaison binaire avec l'archive source ; calcul du SHA-256 du fichier chiffré.
6. Création d'un manifeste qui indique explicitement `restore_tested:false`.
7. Publication de l'archive chiffrée, de son empreinte et du manifeste comme artefact GitHub Actions, avec une rétention de 90 jours.

Aucun dump en clair n'est publié comme artefact. Le workflow n'effectue ni écriture, ni suppression, ni migration sur Production.

### Limite de périmètre importante

La commande Supabase CLI `db dump` exclut les schémas gérés par Supabase, notamment `auth` et `storage`, ainsi que les schémas d'extensions. Le workflow actuel ne doit donc pas être considéré comme une sauvegarde complète du projet : il ne sauvegarde pas les fichiers Storage et ne prouve pas la sauvegarde des comptes Auth ni de leurs données gérées.

Les personnalisations NAXA et les politiques qui sont versionnées dans les migrations Git restent disponibles dans le dépôt, mais cela ne remplace pas l'export des données et objets gérés exclus du dump.

Référence officielle : https://supabase.com/docs/reference/cli/supabase-db-dump

## 3. Secrets requis pour le dump de base

Dans GitHub > Settings > Secrets and variables > Actions :
- `NAXA_DATABASE_URL` : URI exacte du **Shared Session Pooler** de Production, copiée depuis Supabase Dashboard > Connect > Session Pooler. Elle doit viser `*.pooler.supabase.com`, utiliser le port `5432`, la base `postgres` et le nom d'utilisateur `postgres.<project-ref>`, avec le vrai mot de passe Database. Ne jamais la committer ni la publier. Le host direct `db.<project-ref>.supabase.co` est refusé par le workflow car le runner GitHub utilisé ici ne peut pas joindre son adresse IPv6. Le Transaction Pooler (`6543`) est aussi refusé pour cet export.
- `NAXA_BACKUP_ENCRYPTION_KEY` : phrase secrète aléatoire longue, dédiée au chiffrement. Une copie sûre doit être conservée hors de GitHub ; sans elle, l'archive ne peut pas être déchiffrée.

Page des secrets : https://github.com/audreymendomo23-netizen/NAXA/settings/secrets/actions

Ne jamais communiquer l'URI, le mot de passe ni la clé de chiffrement dans un ticket, un commit ou une conversation.

## 4. Copie hors site S3 (facultative, non démontrée comme active)

Le workflow prévoit une copie vers un stockage S3 ou compatible uniquement si `NAXA_BACKUP_S3_BUCKET` est renseigné. Il utilise alors :
- `NAXA_BACKUP_S3_BUCKET`
- `NAXA_BACKUP_AWS_ACCESS_KEY_ID`
- `NAXA_BACKUP_AWS_SECRET_ACCESS_KEY`
- `NAXA_BACKUP_AWS_REGION` (facultatif, défaut `eu-west-1`)
- `NAXA_BACKUP_S3_ENDPOINT_URL` (facultatif, pour un endpoint compatible S3)

Variable facultative : `NAXA_BACKUP_S3_PREFIX` (défaut `naxa/postgres`).

Cette destination doit être distincte du projet Supabase. Les clés doivent appartenir à un compte technique dédié, limité au préfixe de sauvegarde. Le bucket doit avoir une politique de rétention, le versioning et, si disponibles, une protection contre l'effacement. Tant qu'un upload vérifié n'apparaît pas dans un run réussi, la copie hors site reste non confirmée.

## 5. Fichiers Supabase Storage

Les fichiers binaires (photos, logos, justificatifs et autres documents) ne sont pas contenus dans le dump SQL de la base. Le workflow `.github/workflows/naxa-storage-e2e.yml` est un test fonctionnel sur Replay : il teste upload/téléchargement, isolation et nettoyage. Ce n'est pas un workflow de sauvegarde de Production.

Un premier exporteur binaire en lecture seule a été ajouté dans `scripts/backup-storage.cjs`. Le workflow manuel `.github/workflows/naxa-storage-backup-replay.yml` l'exécute uniquement contre le projet Replay `pwfftcsjyeibxxqhwysw`, puis archive et chiffre le résultat. Il ne contient aucun déclencheur quotidien et ne peut pas viser Production. Il doit d'abord réussir sur Replay ; son artefact doit ensuite faire l'objet d'un exercice de restauration isolé.

Cette répétition utilise les secrets Replay déjà prévus pour les tests (`NAXA_STORAGE_E2E_URL`, `NAXA_STORAGE_E2E_ADMIN_KEY`) et `NAXA_BACKUP_ENCRYPTION_KEY`. L'exporteur énumère les buckets, télécharge récursivement les objets et produit un inventaire avec tailles et empreintes SHA-256. Il n'écrit ni ne supprime aucun objet distant. Une cible Production, ses secrets dédiés, la copie externe et une restauration testée restent à mettre en place. Aucune sauvegarde binaire Production n'est actuellement démontrée.

## 6. Validation obligatoire de restauration

La réussite du dump et du chiffrement ne prouve pas qu'une restauration est possible. Le manifeste du workflow indique volontairement `restore_tested:false`.

Avant de déclarer la sauvegarde opérationnelle :
1. obtenir un run complet en succès et vérifier la présence de l'artefact ;
2. vérifier son SHA-256, le déchiffrer avec la clé conservée hors site et extraire les fichiers SQL ;
3. restaurer dans un environnement isolé non-production, sans écraser Replay ni Production ;
4. comparer schéma, fonctions, contraintes, politiques, données métier et historiques de migrations ;
5. tester séparément les comptes Auth et les fichiers Storage après mise en place de leurs exports ;
6. documenter la date, le commit, les contrôles, les écarts et le résultat de restauration.

Aucune restauration destructive ne doit être lancée sans autorisation explicite et cible isolée confirmée.

## 7. État de preuve au 13 novembre 2026

Dernier run réussi : [GitHub Actions run 43424354502](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43424354502), commit `d28e93e8a761a5321bcf2300b95b095a29233d84`.

- Secrets requis : PASS.
- Validation de l'URI Shared Session Pooler (port 5432) : PASS.
- Export des rôles, du schéma et des données : PASS.
- Archive tar.gz : créée.
- Chiffrement AES-256-CBC/PBKDF2 : PASS ; le déchiffrement de contrôle et la comparaison binaire ont réussi.
- Artefact GitHub : PASS — `naxa-db-backup-43424354502-1`, ID `14036745506`, taille 2 267 677 octets, empreinte SHA-256 de l'artefact ZIP `3382bc7b03fb13826177f83e869ac69cbebe11069c4929368fdb013fe5874059`, rétention jusqu'au 11 février 2027.
- Copie S3 externe : SKIPPED ; `NAXA_BACKUP_S3_BUCKET` n'est pas configuré.
- Restauration : NON TESTÉE ; le manifeste confirme `restore_tested:false`.

**Avertissement de restauration :** pendant l'export des données, PostgreSQL a signalé des contraintes de clés étrangères circulaires dans `profiles` et `compta_ecriture`. L'archive a bien été produite, mais une restauration directe du fichier data-only n'est pas certifiée. Le protocole de restauration doit traiter ces dépendances (désactivation temporaire des triggers ou méthode équivalente, avec contrôle de réactivation et intégrité), puis être exécuté sur une base isolée non-production.

Le validateur du workflow exige désormais le Shared Session Pooler du projet sur port `5432` et refuse l'hôte direct ainsi que le Transaction Pooler. La validation réelle a réussi dans le run ci-dessus ; aucun secret ni mot de passe n'est affiché dans le dépôt.

L'organisation Supabase NAXA est sur le plan Free. Les sauvegardes GitHub ci-dessus ne remplacent pas une copie S3 indépendante, une sauvegarde séparée de Supabase Storage ni l'export des comptes Auth et objets gérés exclus du dump. Références : https://supabase.com/docs/guides/platform/backups

## 8. Critère de clôture

La protection des données NAXA ne peut être déclarée « AU VERT » que lorsque :
- la sauvegarde régulière de la base est produite et copiée hors site ;
- les fichiers Storage sont sauvegardés séparément ;
- les éléments Auth/configuration nécessaires à la reprise sont couverts ;
- les clés sont conservées indépendamment ;
- une restauration complète a été exécutée sur une cible isolée et comparée ;
- les preuves et limites sont consignées dans ce document.

Une simple exécution réussie du workflow ou la présence d'un fichier chiffré ne suffit pas.
