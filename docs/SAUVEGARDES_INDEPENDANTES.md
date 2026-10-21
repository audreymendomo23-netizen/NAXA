# Sauvegardes indépendantes NAXA

## Fonctionnement
Le workflow `.github/workflows/naxa-independent-backup.yml` se déclenche chaque jour à 02:23 UTC et peut être lancé manuellement dans GitHub Actions. Il réalise un `pg_dump` PostgreSQL 17, vérifie que l'archive est lisible par `pg_restore --list`, chiffre l'archive AES-256 avant stockage, puis publie un artefact GitHub Actions conservé 90 jours. Aucun dump en clair n'est envoyé comme artefact.

Le stockage S3 compatible est optionnel et permet une copie indépendante à plus long terme. L'artefact GitHub est un filet de sécurité, pas une politique de rétention permanente. Configurez une règle de cycle de vie/rétention sur le bucket et activez le versioning/Object Lock si le fournisseur le prend en charge.

## Secrets GitHub requis
Dans **Settings → Secrets and variables → Actions** du dépôt :
- `NAXA_DATABASE_URL` : URI PostgreSQL de l'environnement Supabase NAXA, idéalement la chaîne **Session pooler** compatible avec `pg_dump`. Ne jamais la committer ni la publier.
- `NAXA_BACKUP_ENCRYPTION_KEY` : phrase secrète aléatoire longue dédiée au chiffrement. Conservez-en une copie sûre hors de GitHub; sans elle, les archives chiffrées ne pourront pas être restaurées.

URL directe des secrets : https://github.com/audreymendomo23-netizen/NAXA/settings/secrets/actions

## Copie hors site S3 (recommandée)
Ajouter les secrets :
- `NAXA_BACKUP_S3_BUCKET`
- `NAXA_BACKUP_AWS_ACCESS_KEY_ID`
- `NAXA_BACKUP_AWS_SECRET_ACCESS_KEY`
- `NAXA_BACKUP_AWS_REGION` (facultatif, défaut `eu-west-1`)
- `NAXA_BACKUP_S3_ENDPOINT_URL` (facultatif, pour S3 compatible/R2)

Variable de dépôt facultative : `NAXA_BACKUP_S3_PREFIX` (défaut `naxa/postgres`).

Utiliser un compte dédié limité à l'écriture dans le préfixe de sauvegarde; ne pas réutiliser des clés d'administration. Le bucket doit être distinct du projet Supabase, chiffré au repos et protégé par une rétention/versioning appropriés.

## Validation de restauration obligatoire
1. Lancer le workflow manuellement et vérifier son statut **success**.
2. Télécharger un artefact, vérifier le SHA-256, déchiffrer avec la clé conservée hors site et exécuter `pg_restore --list`.
3. Pour prouver la restauration de bout en bout, restaurer dans une base de test isolée, jamais sur la production, puis comparer tables, contraintes, fonctions, migrations et données métier.
4. Répéter ce test régulièrement. La réussite du dump et du catalogue ne prouve pas à elle seule qu'une restauration complète fonctionne.

Le workflow ne supprime ni ne modifie les données de production. Aucun déploiement de l'application n'est déclenché par cette sauvegarde.
