# Réconciliation Replay ↔ main — NAXA

Date du relevé : 2026-11-12 (UTC)
Dépôt : `audreymendomo23-netizen/NAXA`
Branche de référence : `main`
Branche source analysée : `qa/e2e-stabilisation-20261106`

## État Git vérifié

- `main` au relevé : `8595350263c69725a8443fa8f027a13bc93de55d`
- Replay au relevé : `f4edd8579971347aa090bf810e4357eca1ea26f8`
- Ancêtre commun : `2374348e416d4745e19546da1151ea1ad8fefa11`
- Comparaison GitHub : Replay en avance de 557 commits et `main` en avance de 691 commits.
- Arbres récursifs : 1 776 entrées pour main, 1 865 pour Replay ; 331 chemins propres à Replay et 242 chemins propres à main.
- L'API de comparaison renvoie au maximum 300 fichiers dans ce relevé ; elle ne constitue donc pas à elle seule l'inventaire exhaustif des changements.

Les deux historiques sont divergents. Une fusion globale ou un remplacement de main par Replay est exclu.

## Fonctionnalités Replay absentes de main repérées

- Vérification Promoteur en trois niveaux : SMS du payeur, SMS de crédit sur téléphone Admin, puis contrôle manuel.
- Capture SMS, enrôlement des appareils, intents de paiement et compagnon Android.
- OCR local des justificatifs et analyse assistée du SMS.
- Import intelligent des stocks et ses RPC/tests.
- Tarification et routage national des livraisons, outils de mission et rapports.
- Géolocalisation réseau des pharmacies.
- Passerelle de sécurité intelligente, découverte ONVIF et enregistrement local.

Cette liste est un premier inventaire de domaines, pas une déclaration de complétude fonctionnelle.

## Fonctionnalités main à préserver

L'arbre main contient des chemins absents de Replay concernant notamment :
- ERP Examens médicaux et invitations du personnel ;
- Parapharmacie autonome et contrôles RBAC ;
- Comptabilité et droits Promoteur/Comptable ;
- Assurance et parcours transactionnels ;
- Suivi médical, appareils BLE et cycle de vie clinique ;
- panier client unifié et contrôles de fraîcheur du stock.

Ces domaines sont plus récents dans main et doivent rester intacts.

## Incompatibilités techniques bloquant une copie globale

- Main utilise Next.js 14.2.35 et React 18.3.1 ; Replay utilise Next.js 15.5.29 et React 19.3.1.
- Main utilise `@ducanh2912/next-pwa` ; Replay utilise Serwist. Les fichiers `package.json`, lockfile et `next.config.mjs` ne doivent pas être copiés globalement.
- Certaines pages Replay utilisent le contrat Next 15 `searchParams: Promise<...>`, incompatible avec le contrat actuellement utilisé par main ; adaptation nécessaire avant portage.
- Les migrations de paiement Replay dépendent d'une migration de base d'enrôlement absente de main. Les migrations doivent être ordonnées et relues ensemble.
- Les fichiers `20261111022500_promoteur_payment_admin_sms_auto_confirm_rpc.sql` et `20261111024000_promoteur_payment_admin_sms_time_guard.sql` ont le même blob SHA `dda221f6a5f45b9930e47c5e049949845720dcfe` : le second est un doublon exact et ne doit pas être exécuté comme migration supplémentaire.
- Le README Android Replay signale que `RECEIVE_SMS` est une permission Android hard-restricted, que l'installation directe depuis un navigateur peut être bloquée par Play Protect, et qu'aucun APK/appareil/SIM n'a été testé. Le mode de distribution demandé par NAXA doit donc être vérifié avant de qualifier la capture automatique de prête.

## Sécurité de livraison

- Le fichier `vercel.json` sur main désactive le déploiement Git automatique pour la branche main.
- Le workflow GitHub Actions `.github/workflows/naxa-quality.yml` se déclenche sur push main et exécute tests, TypeScript, lint et build avec variables Supabase factices.
- Aucun déploiement Vercel ni aucune migration Supabase n'a été exécuté pendant ce relevé.
- Aucune fusion de branches n'a été effectuée.

## Ordre de réconciliation retenu

1. Paiements Promoteur : intégrer le contrat serveur, les contrôles de sécurité, l'interface et les tests en adaptant les pages au Next.js de main ; exclure le doublon SQL ; préserver la validation manuelle comme recours.
2. Livraison et tarification : comparer avec les règles NAXA validées, puis intégrer les éléments cohérents.
3. Import intelligent de stock et géolocalisation : vérifier les RPC, RLS et dépendances avant portage.
4. Sécurité intelligente : revue de faisabilité, secrets, surface réseau et tests avant toute intégration opérationnelle.
5. Réconcilier les tests et la documentation sans écraser les domaines plus récents de main.

Pour chaque lot : audit → contradiction → cause racine → correction → tests/preuves → documentation → statut exact. Les migrations seront ajoutées au dépôt mais ne seront pas appliquées à Supabase Production sans autorisation distincte.

## Prochain point concret

Commencer le lot Paiements Promoteur en portant les fonctions et migrations requises sur main, après adaptation Next 14 et vérification des dépendances. Le compagnon Android restera explicitement non vert tant que son mode de distribution et un test sur appareil réel ne seront pas établis.
