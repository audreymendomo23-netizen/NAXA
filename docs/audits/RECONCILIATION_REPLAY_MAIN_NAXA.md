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


## Journal d'exécution — lot Paiements Promoteur (2026-11-12, 20:01 UTC)

- Lot candidat préparé : 41 chemins Replay, dont routes API, pages/actions, OCR, compagnon Android, tests et migrations SQL.
- Adaptations préparées avant intégration : contrats `searchParams` ramenés au modèle Next.js 14 de main ; migration `20261111013000` ajustée pour préserver les anciennes destinations bancaires (`virement`) dans l'historique, tout en laissant les RPC/UI limiter les nouvelles déclarations à MTN/Orange ; migration dupliquée `20261111024000` exclue.
- Commit candidat créé : `c931781e610fbd949f5365507e69eebfd05d2acb`, parent `6e44fb7cb2a0a18c166b349cb1ca77987f93e7c5`. Il n'a pas été attaché à une branche.
- Entre la préparation et la mise à jour protégée de `main`, la branche a avancé de `6e44fb7` à `f072e3331b8b2adb896b57cf0d86f470d3324aec`. L'opération `update_ref` a retourné une erreur GraphQL ; aucune mise à jour forcée ni aucun contournement n'a été tenté.
- **Résultat :** aucun fichier du lot Paiements n'a été intégré à main ; aucune migration n'a été appliquée ; aucun déploiement n'a été déclenché par cette tentative.
- **Reprise obligatoire :** repartir du HEAD actuel `f072e3331b8b2adb896b57cf0d86f470d3324aec`, refaire l'inventaire des changements intervenus depuis `6e44fb7`, puis recréer le commit candidat sur le nouvel arbre. Ne jamais rattacher le commit candidat à l'ancien parent.
- **Blocage Android restant :** la documentation Replay indique que `RECEIVE_SMS` est hard-restricted et que l'installation directe depuis le site peut être bloquée par Play Protect ; APK et test sur téléphone/SIM non disponibles. La capture Android ne peut pas être déclarée verte.


## Journal d'exécution — fusion de l'historique Replay vers main (2026-11-12, 20:10 UTC)

- Dernier déploiement Production READY vérifié dans Vercel : commit `8ebe45267b97c3b0c666b1df3f9e73df0b08c005`, URL `https://naxa-ko30zjkga-naxa3.vercel.app` (alias de production également présents).
- Tête Replay intégrée : `f4edd8579971347aa090bf810e4357eca1ea26f8`.
- Commit de fusion publié sur `main` : `626e67e7029bcce2b74cb646f505945506ebd7e3`. Ses deux parents sont l'ancien HEAD de main et la tête Replay. La comparaison GitHub `f4edd857...main` confirme `behind_by=0` et l'ancêtre commun égal à la tête Replay : l'historique Replay est donc entièrement accessible depuis main.
- Réconciliation de l'arbre : 362 changements de fichiers non conflictuels intégrés depuis Replay. 41 fichiers ayant divergé des deux côtés ont conservé la version main afin de ne pas écraser des évolutions main plus récentes ; ils restent à examiner pour fusion sémantique si des éléments Replay uniques y subsistent.
- Fichiers volontairement préservés côté main pour compatibilité Next 14 / PWA : `AGENTS.md`, `next.config.mjs`, `package-lock.json`. Replay utilise Next 15 / React 19 / Serwist, tandis que main conserve Next 14 / React 18 / next-pwa ; aucune copie globale de ces fichiers n'a été faite.
- CI GitHub Actions `NAXA quality` déclenchée sur le commit de fusion : run `43297547242`, en attente au dernier relevé.
- Aucun déploiement Vercel ni aucune migration Supabase Production n'a été exécuté.


## Réconciliation des branches post-déploiement — 2026-11-13

- Dernier déploiement Production de référence : `8ebe45267b97c3b0c666b1df3f9e73df0b08c005`, daté du 2026-11-05 14:04:59 UTC.
- Les branches de fonctionnalités examinées correspondent à des PR historiques déjà fusionnées avant ce déploiement (souvent par squash). Leur code est présent sous des versions plus récentes dans `main`; leurs anciens commits ne doivent pas être recopiés en bloc ni leurs anciens fichiers restaurés.
- La tête Replay `f4edd8579971347aa090bf810e4357eca1ea26f8`, ainsi que `test/e2e-naxa` et `main-2`, est déjà ancêtre de `main`.
- Les seules PR ouvertes postérieures au déploiement repérées sont #98 à #106 (Dependabot). Cinq mises à jour non majeures/CI ont été intégrées directement à `main` : actions/checkout v7, actions/setup-node v7, actions/upload-artifact v7, aws-actions/configure-aws-credentials v6 et PostCSS 8.5.32.
- Commit d'intégration : `a0909abdd8b6b8957116a736254594b636eff420`. Il conserve l'arbre de code courant, applique les changements sur 8 workflows et `package.json`, et référence comme parents supplémentaires les cinq commits source des PR #98, #99, #100, #101 et #103. Les comparaisons GitHub confirment que ces cinq têtes sont désormais ancêtres de `main` (`ahead_by=0`).
- Quatre mises à jour restent volontairement non intégrées : #102 `@simplewebauthn/server 14.1.0` (majeure, compatibilité API à vérifier), #104 `next 16.4.5` et #106 `eslint-config-next 16.4.5` (incompatibles en l'état avec le socle Next 14 / React 18 / next-pwa), #105 `tesseract.js 7.0.0` (majeure, contrat OCR à vérifier).
- Les checks des PR Dependabot étaient en échec sur les tests. Le run du commit #103 a exécuté 376 tests : 357 réussis et 19 échoués, dont le test d'interopérabilité du suivi BLE. Le nouveau commit d'intégration a lancé `Tests, TypeScript et lint` (en attente au relevé) ; `Supabase Preview` a été annulé. Aucun déploiement Vercel ni aucune migration Supabase Production n'a été effectué.
- Prochaine étape : relever le résultat du run sur `a0909ab`, traiter les 19 échecs de tests séparément des mises à jour Dependabot, puis réévaluer les quatre mises à jour majeures sans les intégrer à l'aveugle.
