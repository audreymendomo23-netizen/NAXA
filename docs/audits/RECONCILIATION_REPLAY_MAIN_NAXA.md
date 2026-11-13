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


## Journal d'exécution — rattachement des branches historiques à main (2026-11-13)

- Après vérification des arbres de fichiers, quatre commits de réconciliation ont été publiés sur `main`, sans modifier l'arbre fonctionnel courant :
  - `496604a865f9be55ecc558d17dfee36e7d2d1bbf` : rattache `feat/session-audit` (migration 069 identique ; documentation et CircleCI historiques préservés côté main).
  - `03099040729b3e5b44405e45c3dda72fadfd0c98` : rattache `feat/yaounde-pharmacy-geolocation`, `feat/yaounde-garde-crosscheck`, `feat/yaounde-taxi-estimate`, `fix/signup-trigger-production`, `fix/signup-pending-trigger-guard`, `feat/login-session-limit` et `feat/auth-water-bubbles`. Les migrations 070/071/072/073/074 déjà présentes sur main ont été comparées ; les versions de code et documentation plus anciennes n'ont pas remplacé celles de main.
  - `ffe4f01e24b89f1735966cbd011f1fecb1a71b33` : rattache `feat/admin-bento-20261019`, `feat/accueil-client-mobile-20261016` et `fix/signup-phone-validation`. Les pages et composants équivalents existent déjà sur main sous des versions plus récentes ; la migration 072 et 073 sont identiques.
  - `36b5dca1b861bb2531c395b189938a5abf72750a` : rattache `fix/accueil-design-valide-20261013`, `fix/accueil-footer-signature-verte`, `fix/approved-home-login-suspend-pharmacy-offline-20261013`, `fix/auth-restore-otp-flow` et `fix/auth-signup-feedback-otp`. Les routes d'authentification et d'accueil présentes sur main sont plus récentes ; les anciens fichiers n'ont pas été restaurés.
- Vérification GitHub après publication : les têtes des 16 branches citées sont des ancêtres de main (`ahead_by=0`). La comparaison a confirmé la fermeture de leur écart d'historique, sans déployer ni appliquer de migration Supabase Production.
- **Branche volontairement non rattachée à ce stade :** `feat/fee-luciole-interactions-20261019`. Son historique contient des améliorations encore absentes du code courant, notamment la protection des gestes pendant une interaction tactile, la gestion d'états métier durables et le trajet de retour au repos. Ces changements doivent être portés sélectivement dans la version actuelle de `Luciole.tsx`, `Recherche.tsx`, `ScannerShell.tsx` et des constantes avant de rattacher cette tête ; une fusion d'historique seule masquerait ces écarts.
- Les branches `Test` et `Test-claude` restent des archives ZIP et ne sont pas des lots source à fusionner tels quels. Les mises à jour Dependabot majeures et les documents juridiques historiques contenant des informations à ne pas republier restent exclus d'une fusion aveugle.
- HEAD de main à la fin de cette passe : `36b5dca1b861bb2531c395b189938a5abf72750a`. Aucun déploiement Vercel ni aucune migration Production n'a été effectué.


## Journal d'exécution — portage partiel fée Luciole (2026-11-13)

- HEAD de départ observé : `feffbb705232fa3a9ab194977fe9fb165008e3bc`.
- Branche source : `feat/fee-luciole-interactions-20261019`, tête `82a795e2c1ec2ee723859c6cb94f6bf3bc29db48`, 25 commits en avance selon l'API compare (historique divergent ; le nombre ne représente pas 25 changements nets).
- Contradiction vérifiée : le code courant de `main` avait déjà dépassé plusieurs fichiers de cette branche (Recherche, ScannerShell, API catalogue et planning de garde). Les anciennes versions de ces fichiers n'ont pas été copiées.
- Portage ciblé publié directement sur `main` :
  - `2484e8736fa2ce6eebc63bd996ec4756c46b68a4` : activation de la fée en mode nuit sur `/scanner` et suppression de l'inférence d'événements métier à partir du texte des boutons ; seuls les attributs explicites `data-naxa-fairy` déclenchent un geste.
  - `92132440575aac8d855ac05f512e5289c041dfa7` : ajout des constantes de durée compatibles avec le portage.
  - `7480f780d9dd95d0690976772862891464d22c4c` : émission d'un état visuel de recherche sans transmettre le terme.
  - `08ec90a142f291ead46057c4e46304e73e709d99` : émission d'un état visuel du scanner sans transmettre l'ordonnance ni le code-barres.
  - `16d5b2cb6541be2ba96d8111ec989cea1e7bea52` : émission d'un signal de rappel sans transmettre médicament, dose ou unité.
- La logique avancée de la branche (états métier durables, gestion des gestes tactiles et trajet de retour au repos) n'est pas encore portée ; la tête de la branche n'est donc pas encore rattachée à l'historique de `main`.
- CI GitHub Actions `NAXA quality` déclenchée sur le HEAD final `16d5b2c`, run `43344913433`. État relevé : jobs non disponibles.
- Aucun déploiement Vercel ni aucune migration Supabase Production exécuté.


## Journal d'exécution — poursuite des fusions historiques et RPC POS (2026-11-13)

- Trois nouveaux commits de rattachement d'historiques ont été publiés sur `main`, en conservant exactement l'arbre courant de main à chaque fusion :
  - `feffbb705232fa3a9ab194977fe9fb165008e3bc` : rattache `fix/connexion-duplicate-bulle-erreur`, `fix/google-oauth-session-redirect-20261013`, `fix/header-client-unifie`, `fix/login-page-layout-20261012` et `fix/parcours-rpc-permissions-align-20261011`.
  - `c7f61f3c3fe090161b6898c7c4532e348a886185` : rattache `fix/sql-test-032`, `fix/sql-tests-green`, `fix/unify-signup-otp`, `fix/vercel-build-errors-2026-10-25`, `fix/profile-onboarding-public-access-design-20261013` et `fix/public-home-client-nav-20261024`.
  - `0b555c643d352723a09b2af95d3d2eeda8c23ebe` : rattache `feat/catalogue-medicaments-api-prototype`, `feat/accueil-entete` et `feat/accueil-etape-a`.
  - `f873e72e57dd400456c13c1fdfd8e6ba6d6b18f5` : rattache `feat/logo-navigation-role`, `feat/naxa-fonctions-validation-distance`, `feat/naxa-messagerie-profil-yaounde`, `fix/build-client-use-search-params` et `fix/ci-main`.
- Les comparaisons GitHub après publication confirment `ahead_by=0` pour les branches de ces lots. Avec les lots précédents, 41 têtes de branches historiques ont ainsi été rattachées à l'ascendance de main sans restaurer leurs anciens arbres de fichiers.
- Lot RPC caisse issu de `fix/parcours-rpc-permissions-align-20261011` : l'interface actuelle appelle `vente_encaisser_finaliser` avec seulement `p_vente` et `p_montant_percu`, alors que la fonction historique à quatre paramètres exigeait aussi `p_mode`. La migration `supabase/migration_071d_vente_encaisser_finaliser_atomique.sql` a donc été portée avec la RPC complète à quatre paramètres et un wrapper deux paramètres qui fixe explicitement le mode `especes` pour le parcours actuel. Le fichier de contrôle statique correspondant est `supabase/tests/071d_vente_encaisser_finaliser_atomique.sql`.
- La migration 071d et son test ont été ajoutés respectivement par les commits `9684111b2bcfe5f58a8b0519c74083e80121ff54` et `3dbae10ca363faaeee1ea19f664b75977b256ee7`. Ils sont présents sur main. **Le test SQL n'a pas été exécuté sur une base dans cette passe** ; aucune migration n'a été appliquée à Supabase Production.
- Les migrations historiques 071b, 071c et 071e du lot source n'ont pas été recopiées : 071b n'a pas de consommateur UI actuel identifié ; 071c est remplacée par le parcours pharmacien plus récent ; 071e utilise un contrôle de privilège ancien qui ne doit pas remplacer l'architecture actuelle des rôles actifs et affectations professionnelles. Ces écarts restent explicitement documentés, sans prétendre que leurs anciennes implémentations sont réactivées.
- Branches qui restent à examiner sélectivement car elles portent des changements encore absents ou une variante de conception non validée : `feat/fee-luciole-interactions-20261019` (états tactiles/durables et retour au repos), `fix/luciole-compagne-realiste` (variante visuelle de la luciole), `fix/pharmacy-login-pwa-network-20261013` (contexte de parcours Auth, fond animé et détection de disponibilité backend), `design/mission-visuelle-compilee-preview-20261013` et les variantes d'interface `feat/auth-visual-identity` / `feat/main-ui-water-ambulance-20261013`. Ces branches ne sont pas déclarées fusionnées fonctionnellement.
- Les branches d'archives ZIP (`Test`, `Test-claude`, `Photos`, `work/assets-integration-20261025`, `audreymendomo23-netizen-patch-1h`) ne sont pas des lots de commits source fusionnables directement. Les mises à jour Dependabot majeures et les anciens brouillons juridiques ne sont pas intégrés à l'aveugle.
- HEAD de main au dernier relevé : `f873e72e57dd400456c13c1fdfd8e6ba6d6b18f5`. Aucun déploiement Vercel ni aucune migration Supabase Production n'a été effectué.


## Inventaire de clôture de cette passe — branches restantes (2026-11-13)

Comparaison effectuée contre le HEAD `c988c1552bcea2256fd7d24b7805b8aab914df37` :

- Déjà ancêtres de main : `Photos`, `audit/admin-360-20261026`, `feature/client-immersive-marketplace`, `feat/header-client-unifie`, `fix/auth-otp-google-recovery-20261013`, `fix/auth-session-limit-oauth-otp`, `fix/home-steps-i18n-type-20261013`, `fix/offline-fallback-refresh-loop`, `main-2`, `qa/e2e-stabilisation-20261106` et `test/e2e-naxa`.
- Archives non fusionnables comme code source : `Test` et `Test-claude` ajoutent chacune un ZIP ; `audreymendomo23-netizen-patch-1h` ajoute `NAXA-main.zip`. `Photos` / `work/assets-integration-20261025` pointent sur le même commit d'archive `Naxa photo.zip` ; la tête `Photos` est déjà ancêtre de main.
- Dépendances majeures non intégrées : `next 16.4.5`, `eslint-config-next 16.4.5`, `@simplewebauthn/server 14.1.0` et `tesseract.js 7.0.0`. Elles nécessitent une migration/compatibilité dédiée et ne doivent pas être ajoutées au socle Next 14 / React 18 par fusion automatique.
- Historiques encore divergents à porter sélectivement : `design/mission-visuelle-compilee-preview-20261013` (100 commits), `fix/pharmacy-login-pwa-network-20261013` (43), `feat/fee-luciole-interactions-20261019` (25), `feat/main-ui-water-ambulance-20261013` (8), `feat/auth-visual-identity` (7), `fix/luciole-compagne-realiste` (2), `docs/juridique-cgu-confidentialite-20261012` (6), `docs/regle-prioritaire-ci-fin-projet-20261013` (1), `feat/code-otp-animation-demo-20261013` (7) et `feat/legal-docs-client-account-deletion` (1).
- Motifs d'exclusion temporaire : ces branches contiennent des éléments qui ne sont pas de simples versions obsolètes — variantes d'interface, logique d'animation et d'état Luciole encore absente, parcours Auth/PWA alternatifs, route de démonstration OTP ou brouillons juridiques historiques. Les fusionner en parent uniquement ferait croire que leurs changements ont été intégrés alors que ce n'est pas le cas. Les brouillons juridiques historiques ne sont pas republiés ; les règles NAXA actuelles interdisent l'identité personnelle dans les documents juridiques.
- Aucune branche divergente restante n'a été fusionnée à l'aveugle pendant cette passe. Les têtes Replay/QA post-déploiement citées plus haut sont déjà ancêtres de main. Aucun déploiement ni aucune écriture Supabase Production n'a été effectué.
