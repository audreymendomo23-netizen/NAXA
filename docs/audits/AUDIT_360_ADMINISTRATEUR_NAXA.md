# Audit 360° du parcours Administrateur NAXA

> **Document de référence vivant** — audit préliminaire en cours. Ce document sépare les preuves directes, les déclarations historiques, les déductions et les vérifications encore indisponibles. Aucun déploiement n'est autorisé dans ce chantier.

## 1. Résumé exécutif

- **Dépôt confirmé :** `audreymendomo23-netizen/NAXA` (privé).
- **Branche de référence confirmée :** `main` (branche par défaut GitHub).
- **Commit de référence au début de cette session :** `165be5154c8af57999c1c3591829fc251f67b0b5`, daté du 26 octobre 2026 à 19:11:41 UTC.
- **Message du commit :** fusion PR #97, « Intégration du chantier CTO et durcissements Supabase. Audit fonctionnel Admin incomplet; CI CircleCI en échec au moment de la fusion. Aucun déploiement de production autorisé. »
- **Document créé sur main :** ce fichier, par commit dédié. L'état du dépôt de travail local et les modifications non commitées ne sont pas exposés par les vérifications GitHub effectuées à distance.
- **Déploiement :** aucune action de déploiement n'a été déclenchée par cette procédure. Le déploiement en échec n'est pas diagnostiqué ici.
- **Audit détaillé Administrateur :** non commencé; requiert l'autorisation explicite de l'utilisateur après le bilan préliminaire.

### Légende de preuve

- **P — Preuve directe :** contenu ou métadonnée observés dans une ressource accessible.
- **H — Historique / déclaration :** information trouvée dans des notes ou documents antérieurs, non considérée comme une preuve actuelle à elle seule.
- **D — Déduction :** conclusion tirée des éléments observés, à confirmer.
- **NV — Non vérifié :** ressource ou comportement non contrôlé avec les accès disponibles.

## 2. Périmètre et méthodologie

Ordre obligatoire suivi : initialisation, conversations accessibles, GitHub/code, Supabase, documentation, revue systématique de main, erreurs/journaux, variables/configurations. Les étapes 1 à 7 sont des sous-étapes préliminaires; le parcours détaillé Administrateur reste suspendu jusqu'à autorisation.

Aucune branche n'est créée. Aucun changement de branche, pull request, fusion, modification Supabase, changement de variable, déploiement ou relance de workflow n'est réalisé par ce chantier. Le document est créé sur `main` par l'API de contenu GitHub, avec un commit dédié.

Les résultats sont limités aux ressources accessibles via les connecteurs et aux conversations effectivement récupérables. Une absence de preuve n'est pas assimilée à une absence de fonctionnalité.

## 3. État initial de main

| Élément | Résultat | Preuve / limite |
|---|---|---|
| Dépôt | `audreymendomo23-netizen/NAXA`, privé | P — métadonnées GitHub |
| Branche par défaut | `main` | P — métadonnées GitHub |
| HEAD initial | `165be5154c8af57999c1c3591829fc251f67b0b5` | P — API GitHub `branches/main` |
| Arbre Git du HEAD initial | `8e802067668e56f245c2886aafb2e031ce792f6a` | P — métadonnées du commit |
| Commit précédent (parent 1) | `f1a077d276ae4d001490fc9655f3faa6aaeb9b3e` | P |
| Commit précédent (parent 2) | `034ad917063b8426d0e64b58b52d92b601264b32` | P — commit de fusion à deux parents |
| État de modifications locales non commitées | Non observable via les seules API GitHub consultées | NV — aucun dépôt local inspecté |
| Protection de branche | La réponse GitHub indique protection désactivée | P — métadonnée de branche; ne préjuge pas des autres règles |
| Historique de commit | Le HEAD est un commit de fusion de PR #97 | P |
| Déploiement | Aucun déclenchement volontaire dans le cadre du présent audit | P — actions de cette session; les automatisations éventuelles restent à surveiller sans les relancer |

**Point contradictoire :** le mandat impose le travail direct sur `main`; le HEAD observé contient un commit de fusion historique. Cela décrit l'historique déjà présent, et ne constitue pas une fusion effectuée par le présent chantier.

## 4. Étape préliminaire 1 — Conversations du projet

Les informations du contexte conversationnel disponible ont été consultées. Elles couvrent des exigences NAXA et des résumés de conversations antérieures, mais ne constituent pas l'accès intégral à toutes les conversations du compte.

### Exigences métier et UX retrouvées

- Parcours client et pharmacie; rôles Promoteur, Caissier/Caisse, Pharmacien, Magasinier, Gestionnaire de stock, Comptable, Responsable, Administrateur et Client, avec d'autres rôles à confirmer dans le code réel.
- Règles métier signalées : pas de commission NAXA ni de livraison NAXA; réservation/retrait; validation d'un paiement comptant uniquement à partir du ticket de caisse validé; diminution physique du stock lors de la validation de la vente en caisse; réservation temporaire distincte du stock vendu.
- Accès et périmètres par rôle, architecture Promoteur parent/Caisses enfants, cloisonnement par pharmacie et réseau.
- Exigences de cohérence des indicateurs, traçabilité, absence de données de démonstration exposées comme données réelles, sécurité des accès et fonctionnement de bout en bout.
- Préférences de conduite du chantier : exclusivement `main`, pas de branche, pas de déploiement, pas de correction périphérique du déploiement en échec; constats fondés sur preuves et résultats testables.

### Contradictions / éléments historiques à réconcilier

- Des documents plus anciens décrivent des workflows par PR/branche et des déploiements Production antérieurs; ces traces historiques ne remplacent pas le mandat présent, qui interdit explicitement toute branche ou déploiement pour ce chantier.
- Le README contient des notes datées de plusieurs périodes, y compris des états candidats/isolés et des états déclarés consolidés. Elles doivent être comparées au HEAD actuel avant d'être considérées comme vérité technique.
- L'historique conversationnel mentionne des tests SQL, migrations, alertes RLS et résultats CI non uniformes. Ces chiffres historiques ne seront pas reportés comme résultats de tests actuels sans nouvelle preuve.
- Certains points ont été déclarés « consolidés » ou « clos » dans les échanges, sans que le contexte accessible permette toujours de vérifier le code ou le comportement final.

**Limite :** toutes les conversations NAXA ne sont pas garanties accessibles. Les conclusions de cette sous-étape sont donc un inventaire du contexte disponible, pas une certification d'exhaustivité de l'historique complet.

## 5. Étape préliminaire 2 — GitHub et code

### Ressources observées

- `README.md` — récupéré sur `main`; document long contenant les conventions historiques, les fonctionnalités et des états de chantiers.
- `package.json` — récupéré sur `main`.
- `docs/audits/AUDIT_360_ADMINISTRATEUR_NAXA.md` — absent avant la création (réponse 404 au chemin exact).
- `supabase/config.toml` — chemin non trouvé dans le dépôt à ce chemin exact; la présence d'une configuration Supabase ailleurs n'est pas exclue.
- Dépôt privé accessible avec permission de lecture et d'écriture selon les métadonnées GitHub.

### Constats initiaux tirés de package.json

- Projet privé nommé `naxa`, version `0.1.0`.
- Stack déclarée : Next.js `14.2.15`, React `18.3.1`, TypeScript `5.6.2`, Tailwind CSS `3.4.13`, Supabase JS `2.45.4` et Supabase SSR `0.5.2`.
- Scripts présents : `dev`, `build`, `start`, `lint`, tests ciblés pour géolocalisation, catalogue médicaments, suivi interopérabilité, calculs caisse et moteur comptable, ainsi qu'un script d'import BDPM.
- Aucun script générique de suite de tests n'apparaît dans les scripts fournis par ce fichier. Cela ne prouve pas qu'aucune autre suite ou commande de test existe dans le dépôt.
- Le contenu du manifeste seul ne prouve ni la réussite du build, ni le fonctionnement des routes, ni la couverture des tests.

### Revue systématique des fichiers

L'inventaire exhaustif fichier par fichier n'est pas encore achevé. Il sera construit dans les sous-étapes préliminaires et distinguera les fichiers effectivement lus des fichiers seulement recensés. Aucun chiffre d'exhaustivité n'est revendiqué à ce stade.

## 6. Étape préliminaire 3 — Supabase

### Projets visibles

| Nom | Référence | Région | État retourné | Usage présumé / limite |
|---|---|---|---|---|
| `Naxa` | `eouwtuusnsuxaejsxknf` | `eu-west-1` | `ACTIVE_HEALTHY` | Projet principal probable, à confirmer avec les configurations du dépôt |
| `naxa-ci-replay` | `fnlyjlvflgiewrkmnisi` | `eu-west-1` | `INACTIVE` | Environnement de rejeu; ne pas le modifier |
| `naxa-ci-replay-2` | `pwfftcsjyeibxxqhwysw` | `eu-west-1` | `ACTIVE_HEALTHY` | Environnement diagnostique historique présumé; ne pas le modifier |

Le projet `Naxa` expose PostgreSQL 17.11 dans les métadonnées. Aucun secret, clé API ou donnée personnelle n'est consigné dans ce rapport.

### Travaux restant dans cette sous-étape

- Inventorier tables, colonnes, clés et relations.
- Comparer l'historique des migrations appliquées aux fichiers source du dépôt.
- Lire les politiques RLS, fonctions, vues, triggers et configurations Storage.
- Recenser les fonctions Edge et leurs dépendances.
- Vérifier les alertes de sécurité et de performance disponibles.
- Examiner les journaux pertinents en lecture seule, sans action corrective.
- Distinguer explicitement le projet principal des environnements de test/diagnostic.

Aucune migration ni écriture de données n'a été effectuée.

## 7. Étape préliminaire 4 — Audit documentaire

Le README a été consulté et révèle des sections d'état, des exigences d'architecture et de nombreuses notes historiques. L'inventaire des documents n'est pas terminé. Les documents restants à localiser et lire comprennent notamment les spécifications, règles métier, schémas de données, plans de tests, rapports précédents et documents de sécurité.

Les contradictions entre le README, les fichiers d'architecture, les migrations et le code restent à établir par comparaison directe; aucune contradiction documentaire n'est considérée comme résolue sur la seule base de cette première lecture.

## 8. Étape préliminaire 5 — Revue systématique de main

**État : en cours / non exhaustive.**

Un inventaire traçable par fichier doit comprendre : chemin, fonction, dépendances, fonctionnalités associées, défauts, risques, éléments potentiellement inutilisés et statut de lecture. Les répertoires source, routes, composants, scripts, tests, migrations, workflows et configurations doivent être couverts.

À ce stade, seuls `README.md` et `package.json` ont été lus directement parmi les fichiers source/documentaires demandés. Aucun total de fichiers analysés n'est présenté comme complet.

## 9. Étape préliminaire 6 — Erreurs et journaux

- Le message du HEAD signale que CircleCI était en échec au moment de la fusion de la PR #97. C'est un contexte historique direct du message de commit, pas un diagnostic actuel de la CI.
- Les notes antérieures mentionnent des suites SQL et des contrôles CI incomplets ou en échec. Ces résultats doivent être rattachés à leurs commits et dates avant d'être utilisés.
- Les journaux de compilation, tests, base de données, authentification, API et traitements métier n'ont pas encore été collectés systématiquement.
- Aucun journal de déploiement n'est recherché au-delà du nécessaire pour éviter de détourner le périmètre; aucune relance n'est autorisée.

## 10. Étape préliminaire 7 — Variables et configurations

Les noms de variables et leurs usages seront recensés à partir des fichiers d'exemple, des accès au code et des configurations consultables. La présence effective de variables dans les environnements GitHub, Supabase et Vercel ne doit être déclarée que si une ressource autorisée l'établit.

Règles : ne jamais afficher de valeurs secrètes; ne modifier, supprimer ou renouveler aucune variable de production; ne modifier aucune configuration dans le seul but de déclencher un déploiement.

État : comparaison interservices à effectuer. Les valeurs de secrets ne sont ni demandées ni consignées.

## 11. Registre initial des constats

| ID | Constat | Classe de preuve | Gravité provisoire | Statut |
|---|---|---|---|---|
| PRE-001 | HEAD de `main` = `165be5154c8af57999c1c3591829fc251f67b0b5` | P | Information | Confirmé |
| PRE-002 | Le commit de référence décrit l'audit fonctionnel Admin comme incomplet et CI CircleCI en échec au moment de la fusion | P (message de commit) | À qualifier | À recouper avec l'état actuel |
| PRE-003 | Le README agrège plusieurs périodes et chantiers dont certains étaient candidats ou isolés | P | Moyenne — risque de dérive documentaire | À comparer au code |
| PRE-004 | Le manifeste fournit des tests ciblés, mais pas de script générique `test` dans l'extrait actuel | P | Faible / à qualifier | Vérifier runner et CI |
| PRE-005 | `docs/audits/AUDIT_360_ADMINISTRATEUR_NAXA.md` n'existait pas à ce chemin avant l'initialisation | P | Information | Créé sur main par ce chantier |
| PRE-006 | L'état local non commité ne peut pas être établi par les seules API GitHub consultées | NV | Limite de vérification | Ouvert |
| PRE-007 | Le projet Supabase principal probable est `Naxa` (`eouwtuusnsuxaejsxknf`), mais les références de configuration du code doivent le confirmer | P + D | À qualifier | Ouvert |

## 12. Recommandations prioritaires après la phase préliminaire

1. Vérifier le schéma et les politiques d'accès du projet Supabase principal en lecture seule.
2. Réconcilier les migrations sources avec l'historique réellement appliqué, sans appliquer de migration.
3. Établir l'inventaire exhaustif des routes et fichiers, avec une couverture démontrable.
4. Identifier les tests réellement exécutables et les preuves CI du commit courant sans relancer de workflow de déploiement.
5. Comparer les rôles, permissions et indicateurs Administrateur/Promoteur aux règles métier documentées.
6. Réconcilier les documents d'état historiques avec le code de `main`.
7. Terminer la comparaison des configurations en masquant les valeurs sensibles.

## 13. Historique du document

| Événement | Référence |
|---|---|
| État initial du dépôt observé | `main` à `165be5154c8af57999c1c3591829fc251f67b0b5` |
| Création initiale de ce registre | Commit dédié sur `main` — SHA à consigner après confirmation GitHub |
| Déploiement volontaire | Aucun |
| Branche créée pour ce chantier | Aucune |

## 14. Bilan de la phase préliminaire

La phase préliminaire est **en cours**. Le dépôt privé, la branche `main`, le HEAD initial, le README, le manifeste et les projets Supabase visibles ont été identifiés. Le registre central est initialisé. La revue exhaustive des conversations, du code, des migrations, des politiques RLS, des documents, des journaux et des variables n'est pas encore achevée; aucun taux de couverture intégral n'est donc revendiqué.

**L'audit détaillé du parcours Administrateur n'a pas commencé.** Il ne commencera qu'après achèvement de cette phase préliminaire et autorisation explicite de l'utilisateur.


## 15. Complément de preuve — inventaire Git et Supabase (26 octobre 2026)

### Arbre Git de main

- Arbre récursif obtenu pour le HEAD initial : **1 245 entrées**, dont **1 015 blobs/fichiers**; la réponse GitHub indique `truncated=false`.
- Répertoires et ressources notables : `src/app/admin/`, `src/components/admin/`, `src/lib/admin/`, `supabase/migrations/`, `supabase/tests/`, `.circleci/config.yml`, `.github/workflows/`, `AGENTS.md`, `FONCTIONNALITES_VALIDEES.md`, cahiers des charges et plusieurs rapports d'audit antérieurs.
- Routes/fichiers Admin identifiés dans l'arbre (liste non exhaustive) : `src/app/admin/page.tsx`, `layout.tsx`, `alertes/page.tsx`, `configuration/page.tsx`, `examens/page.tsx`, `geolocalisation/page.tsx`, `journal/page.tsx`, `messagerie/page.tsx`, `pharmacies/[id]/page.tsx`, `pilotage/page.tsx`, `pilotage/rapports/page.tsx`, `pilotage/validite/page.tsx`, `prestations/page.tsx`, `produits/page.tsx`, `profil/page.tsx`, `promoteurs/page.tsx`, `promoteurs/partenaires/[id]/page.tsx`, `rappels-lots/page.tsx`, `univers/page.tsx`, ainsi que des actions serveur et routes API Admin.
- La liste de chemins ne vaut pas revue ligne par ligne. Les fichiers déjà lus directement dans cette session sont `README.md`, `package.json`, `AGENTS.md`, `.env.example`, `.circleci/config.yml`, `.github/workflows/import-bdpm.yml`, `src/app/admin/layout.tsx` et `src/app/admin/page.tsx`, plus les deux rapports mentionnés ci-dessous partiellement lus en en-tête. Les autres fichiers restent à auditer.

### Documents antérieurs déjà présents

- `docs/AUDIT_PRELIMINAIRE_360_NAXA_ADMIN_2026-10-26.md` (33 535 caractères) : rapport préliminaire déjà présent, qui signale explicitement que l'arbre complet ne signifie pas que toutes les lignes ont été relues et que l'audit des 18 pages Admin reste à conduire.
- `docs/audits/AUDIT_CTO_ADMIN_360_PRELIMINAIRE_2026-10-26.md` (131 340 caractères) : rapport existant qui indique dans son en-tête une branche `audit/admin-360-20261026` et des migrations Supabase déjà appliquées. Ces affirmations historiques entrent en tension avec le présent mandat (travail uniquement sur main, aucune modification Supabase). Elles ne sont pas reprises comme opérations de cette session et devront être réconciliées avec les commits, le diff et l'historique de migrations. Le document n'a pas été modifié.
- L'existence de ces deux rapports est une preuve documentaire importante : le présent fichier est le registre central demandé par le mandat actuel, mais n'est pas le seul document d'audit historique du dépôt. Une revue des recouvrements et divergences documentaires est requise.

### Consigne opérationnelle lue dans AGENTS.md

Le protocole de dépôt confirme que `main` est la source de vérité et interdit la création de branches et PR. Il mentionne cependant des pratiques de build/déploiement plus permissives que le présent mandat. **Le mandat actuel prévaut** : aucun déploiement, aucune relance CI, aucune écriture Supabase et aucune modification de configuration de production ne sont autorisés dans ce chantier.

### Configuration / CI / workflow — lecture statique

- `.env.example` nomme `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` et `IA_MODELE`. Les valeurs sont des placeholders. Ce fichier ne prouve pas la présence des variables dans GitHub, Supabase ou Vercel.
- `.circleci/config.yml` définit notamment un job `quality` (installation, TypeScript, scripts de tests ciblés, ESLint, build Next.js) et un job `sql_tests`. La configuration déclarée ne prouve pas qu'un job a été exécuté ou a réussi sur le HEAD de référence.
- `.github/workflows/import-bdpm.yml` est un workflow manuel (`workflow_dispatch`) qui vérifie la présence de `vars.SUPABASE_URL` et du secret `SUPABASE_SERVICE_ROLE_KEY`, puis exécute l'import. Il n'a pas été déclenché dans le cadre de cet audit. Aucun workflow n'a été lancé.
- `src/app/admin/layout.tsx` appelle `requireAdminActive("/admin")` et agrège des alertes à partir de pharmacies, de la RPC `validites_promoteurs_admin` et des tickets support; le code marque certains compteurs comme partiels en cas d'erreur. Ce constat est limité au fichier lu, pas à une validation d'exécution.
- `src/app/admin/page.tsx` utilise `requireAdminActive`, lit les pharmacies, les validités Promoteur et les dernières entrées `audit_log`. Les erreurs et la cohérence des compteurs nécessitent une analyse de la boucle complète, à réserver à l'audit détaillé après autorisation.

### Supabase — métadonnées observées en lecture seule

- Projet examiné : `Naxa`, ref `eouwtuusnsuxaejsxknf`, région `eu-west-1`, état retourné `ACTIVE_HEALTHY`, PostgreSQL 17.11.
- Inventaire compact du schéma `public` : **135 tables** retournées par l'outil; plusieurs tables exposent RLS activé. Le décompte des tables est celui de la réponse de l'outil à cette date et doit être conservé avec son périmètre (schéma public).
- Historique des migrations retourné par Supabase : **251 entrées**. Les huit dernières versions observées vont de `20261026150907` à `20261026152814`, avec des migrations récentes de durcissement Admin, du catalogue Bébé & Maman et de chemins `search_path`. L'inventaire des migrations source du dépôt et la comparaison complète version par version restent à effectuer.
- Les conseils de sécurité Supabase incluent un constat `rls_enabled_no_policy` avec **5 occurrences** (RLS activé mais aucune politique), et des alertes de politiques permissives multiples sur plusieurs tables. Ces signaux exigent l'examen de chaque table/politique; ils ne démontrent pas automatiquement une exposition, puisque l'absence de politique peut aussi bloquer l'accès.
- Les conseils de performance incluent **113 clés étrangères sans index couvrant** et au moins **1 index dupliqué** signalé sur `public.stocks_lots` (`stocks_lots_id_uidx` et `stocks_lots_id_uq`). Ces compteurs sont des alertes du linter, pas des mesures de latence.
- Les résultats complets du linter comprennent d'autres catégories et détails; le relevé doit être poursuivi et les findings doivent être documentés par table, rôle, action, politique et date.
- Aucune table n'a été modifiée, aucune migration n'a été appliquée et aucun journal n'a été altéré.

### Nouveaux constats

| ID | Constat | Preuve | Gravité provisoire | Statut |
|---|---|---|---|---|
| PRE-008 | Arbre Git du HEAD initial complet au niveau de l'API (1 245 entrées, 1 015 fichiers) | P — arbre récursif, non tronqué | Information | Confirmé |
| PRE-009 | Deux rapports d'audit antérieurs coexistent avec ce registre | P — chemins et contenus lus | Moyenne — risque de divergence | À réconcilier |
| PRE-010 | Projet Supabase public : 135 tables et 251 migrations historisées retournées | P — inventaires en lecture seule | Information | Confirmé à la date du relevé |
| PRE-011 | Linter Supabase signale 5 tables RLS activé sans politique | P — conseil sécurité | À qualifier selon la fonction des tables | Ouvert |
| PRE-012 | Linter signale 113 clés étrangères sans index couvrant | P — conseil performance | À qualifier selon charge et requêtes | Ouvert |
| PRE-013 | Index dupliqué signalé sur `public.stocks_lots` | P — conseil performance | Faible à moyenne | Ouvert |
| PRE-014 | Le dépôt contient un workflow manuel d'import BDPM qui peut écrire dans Supabase | P — lecture statique du workflow | Risque opérationnel si déclenché par erreur | Aucun déclenchement effectué |
| PRE-015 | Le statut des variables d'environnement distantes ne peut pas être déduit de `.env.example` | P/NV | Limite de configuration | Ouvert |

### Prochaine séquence préliminaire

1. Lire les rapports et spécifications de référence en entier, en consignant leur portée et les contradictions.
2. Inventorier routes, composants, actions, API, migrations, tests et workflows à partir de l'arbre Git.
3. Comparer les 251 migrations appliquées avec les fichiers du dépôt sans appliquer de migration.
4. Obtenir les détails de politiques RLS, fonctions SQL, triggers, Edge Functions, Storage et journaux en lecture seule.
5. Examiner les noms de variables dans le code et les configurations accessibles sans révéler de valeur sensible.
6. Collecter les statuts CI existants du commit exact sans lancer ni relancer de workflow.
7. Actualiser ce registre, puis présenter uniquement le bilan de phase préliminaire et demander l'autorisation d'entamer l'audit détaillé.



## 16. Relevé complémentaire des alertes et contrôles existants

### CI du commit de mise à jour du registre

- Commit du registre : `6ab20ffe711c257f10043f9d90d464150668dae0`.
- Le statut GitHub observé pour ce commit indique `failure` sur `ci/circleci: quality`, description « Your tests failed on CircleCI », avec une cible CircleCI associée.
- Conformément au mandat, aucun journal détaillé n'a été ouvert pour ce statut, aucun workflow n'a été relancé et aucune action n'a été prise pour tenter de rétablir le déploiement. Ce statut ne doit pas être interprété comme la preuve d'un déploiement en échec; il concerne le contrôle qualité CircleCI.
- La présence de ce statut après la mise à jour documentaire est consignée comme signal de contexte. Les tests locaux et la cause exacte ne sont pas vérifiés dans cette session.

### Inventaire du code — décompte par motifs de chemin

À partir de l'arbre Git récursif du HEAD initial (donc avant les deux commits du présent registre) :

- **18 fichiers `page.tsx`** détectés sous `src/app/admin/`; ce chiffre représente des fichiers de page, pas nécessairement 18 écrans métier uniques.
- **37 fichiers SQL** sous `supabase/migrations/` correspondant au motif exact `supabase/migrations/*.sql` (les sous-répertoires sont inclus par le préfixe de chemin).
- **290 fichiers SQL** correspondant au motif historique `supabase/migration_NNN_*.sql` à la racine de `supabase/`.
- **186 fichiers SQL de test** sous `supabase/tests/`.
- Ces comptes de fichiers sont des comptes de chemins Git selon des motifs précis; ils ne doivent pas être confondus avec le nombre de migrations effectivement appliquées dans Supabase (251 entrées), ni avec le nombre de tests exécutés.

### Alertes du linter Supabase — détails agrégés

Les conseils en lecture seule retournés pour le projet principal comprennent :

| Catégorie | Nombre retourné | Interprétation prudente |
|---|---:|---|
| RLS activé sans politique | 5 | Peut bloquer tout accès; examiner l'intention et les rôles avant toute conclusion de sécurité |
| Fonction `SECURITY DEFINER` exécutable par `anon` | 5 | Vérifier si l'exposition publique est intentionnelle et si le contrôle d'accès est interne à la fonction |
| Fonction `SECURITY DEFINER` exécutable par `authenticated` | 120 | Vérifier les privilèges EXECUTE, la validation du rôle et du périmètre à l'intérieur de chaque fonction |
| Protection des mots de passe compromis désactivée | 1 | Paramètre Auth à évaluer; aucune modification effectuée |
| Clés étrangères sans index couvrant | 113 | Risque potentiel de performance, dépendant des requêtes et de la charge |
| Index signalés inutilisés | 92 | Observation dépendante de la fenêtre d'usage et des statistiques; ne pas supprimer sans preuves |
| Politiques permissives multiples | 59 | Examiner la logique OR effective, les rôles et les opérations concernées |
| Index dupliqué | 1 | Doublon signalé sur `public.stocks_lots`; suppression non autorisée et non effectuée |

Ces alertes sont issues du linter et nécessitent une revue contradictoire. En particulier, « fonction exécutable » ne prouve pas à elle seule qu'une action non autorisée est possible : il faut lire la définition SQL, ses privilèges, les contrôles internes et ses tests. Aucune correction n'a été apportée à Supabase.

### Fonctions Edge

L'inventaire du projet principal a retourné **0 fonction Edge** via l'outil Supabase. Cette valeur signifie « aucune fonction listée par cette API à cet instant »; elle doit être confirmée avec les autres configurations du dépôt avant de conclure qu'aucune fonction Edge n'existe dans l'architecture.

### Constats complémentaires

| ID | Constat | Preuve | Gravité provisoire | Statut |
|---|---|---|---|---|
| PRE-016 | Le statut GitHub `ci/circleci: quality` est en échec pour le commit de mise à jour du registre | P — statut du commit | À qualifier | Consigné, sans relance |
| PRE-017 | 18 fichiers de page Admin sont détectés par le motif `src/app/admin/**/page.tsx` | P — arbre Git | Information | Inventaire de routes à approfondir |
| PRE-018 | Le linter signale 120 fonctions `SECURITY DEFINER` exécutables par `authenticated` et 5 par `anon` | P — conseils Supabase | Élevée à qualifier | Revue SQL ciblée nécessaire |
| PRE-019 | Le linter signale 59 groupes de politiques permissives multiples | P — conseils Supabase | Moyenne à qualifier | Revue politique par politique |
| PRE-020 | Le linter signale 92 index inutilisés | P — conseils Supabase | Faible à moyenne | Aucun retrait sans preuve |
| PRE-021 | L'API Supabase liste 0 fonction Edge sur le projet principal | P — résultat d'inventaire | Information | À comparer au dépôt et à la configuration |

## 17. Statut réel de la phase préliminaire après ce relevé

L'initialisation GitHub et le registre versionné sont en place, et plusieurs inventaires initiaux ont été obtenus. Toutefois, la phase préliminaire **n'est pas encore exhaustive** : l'intégralité des rapports antérieurs, des spécifications, du code source, des définitions SQL, des politiques RLS, des journaux et des variables de configuration n'a pas encore été examinée. Le bilan présenté à l'utilisateur devra conserver cette limite et ne pas prétendre que l'étape préliminaire est bouclée.


## 18. Suite de la revue documentaire et du périmètre technique

### Sources documentaires localisées

L'arbre de `main` contient notamment les sources suivantes, désormais identifiées pour lecture et comparaison :

- `naxa_cahier_des_charges_v3_7.md`
- `naxa_prompt_maitre_fusion_v2.md`
- `NAXA_Cahier_des_charges-1.md`
- `docs/CAHIER_DES_CHARGES.md`
- `docs/ARCHITECTURE.md`
- `docs/AUDIT_PRELIMINAIRE_360_NAXA_ADMIN_2026-10-26.md`
- `docs/audits/AUDIT_CTO_ADMIN_360_PRELIMINAIRE_2026-10-26.md`
- `docs/AUDIT_FUSION_CATALOGUE_DOSSIER_PROMOTEUR_2026-10-26.md`
- `docs/audits/VERIFICATION_RPC_SUPABASE_2026-10-26.md`
- `FONCTIONNALITES_VALIDEES.md`

Le registre `FONCTIONNALITES_VALIDEES.md` mesure plus de 111 000 caractères. Son principe explicite est de distinguer les fonctionnalités validées sur main, celles validées hors main, les fonctionnalités construites mais sans preuve, et celles à corriger. Ce principe est cohérent avec le présent mandat, mais chaque statut doit être confronté aux preuves du HEAD courant. La lecture complète de ces documents de référence reste à achever; leur simple localisation ne vaut pas analyse intégrale.

### Protocole d'exécution du dépôt

`AGENTS.md` confirme le travail direct sur `main` et l'absence de branche de travail/PR. Il contient aussi des instructions historiques invitant à déployer en production lorsque le travail est prêt. Pour le présent chantier, ces clauses sont explicitement neutralisées par le mandat de l'utilisateur : **aucun déploiement ni relance de CI n'est autorisé**, et la vérification doit rester hors déploiement.

### Routes et composants Admin confirmés par l'arbre

- Les fichiers de page sous `src/app/admin/**/page.tsx` sont au nombre de **18**.
- Les routes API Admin explicitement localisées sont `src/app/api/admin/geolocalisation-osm/route.ts` et `src/app/api/admin/messagerie/route.ts`.
- La bibliothèque dédiée `src/lib/admin/` contient au moins `require-admin-active.ts`.
- Les composants de navigation incluent `src/components/admin/AdminNavigation` (importé par le layout).
- Les nombres ci-dessus décrivent des chemins détectés, pas une validation du comportement ni la totalité des entrées de navigation.

### Lecture du garde d'accès et des deux pages centrales

Le layout `src/app/admin/layout.tsx` appelle `requireAdminActive("/admin")`, puis lit en parallèle les pharmacies, la RPC `validites_promoteurs_admin` et le nombre de tickets support ouverts. Les erreurs partielles activent un message d'avertissement. Les alertes de pharmacies sont calculées sur l'absence de `stock_updated_at` et sur les états inactif / non visible; les validités en impayé ou échues ajoutent aussi des signaux.

La page `src/app/admin/page.tsx` appelle le même garde, lit les pharmacies, les validités Promoteur et les dernières lignes de `audit_log`, puis calcule notamment le nombre de pharmacies, la couverture des dates de stock, les quartiers renseignés et la dernière date de stock.

**Points à confirmer à l'étape détaillée, sans conclure prématurément à un défaut :**

1. Le périmètre exact de `requireAdminActive` : session, rôle, état actif, erreurs et redirections.
2. Si les compteurs du layout et du tableau de bord partagent une définition métier stable, et si les erreurs RPC sont toujours visibles à l'utilisateur.
3. Si l'absence d'une date `stock_updated_at` est bien le critère métier voulu pour signaler un stock à actualiser, plutôt qu'un statut de stock plus explicite.
4. Si la consultation du journal Admin est correctement limitée et si les échecs de lecture restent distingués des listes vides.
5. Si la fonction RPC `validites_promoteurs_admin` applique le bon périmètre d'accès et si son résultat correspond à la source de vérité métier.

Ces observations sont des pistes d'audit issues du code lu; aucun test fonctionnel de bout en bout n'a été exécuté et aucune correction n'est proposée à ce stade.

## 19. Écart à réconcilier : migrations sources et historique Supabase

L'arbre Git courant contient plusieurs familles de fichiers SQL :
- 37 fichiers sous le préfixe `supabase/migrations/` (selon le décompte par chemins effectué précédemment).
- 290 fichiers historiques correspondant au motif `supabase/migration_NNN*.sql` à la racine de `supabase/`.
- 186 fichiers SQL sous `supabase/tests/`.

L'historique Supabase retourne 251 migrations appliquées. Les trois décomptes ne sont pas directement comparables : ils utilisent des emplacements et des conventions de nommage distincts. Néanmoins, cette coexistence est un risque de traçabilité jusqu'à ce que chaque version appliquée puisse être reliée à un fichier source versionné ou documentée comme migration historique absente/renommée.

**Travail restant :** comparer les versions exactes et les noms, relever les migrations appliquées sans source identifiable, les fichiers présents non appliqués et les divergences de contenu. Cette comparaison doit rester en lecture seule : aucune migration ne sera appliquée, réparée ou réécrite dans Supabase pendant la phase préliminaire.

## 20. État d'avancement préliminaire — actualisé

| Sous-étape | Couverture vérifiée à ce stade | État |
|---|---|---|
| 0 — Initialisation | Dépôt, main, HEAD initial, document et commits documentaires identifiés | Réalisée |
| 1 — Conversations | Contexte et résumés disponibles consultés; exhaustivité de toutes les conversations non garantie | Partielle |
| 2 — GitHub/code | Arbre complet obtenu (non tronqué), manifeste, README, AGENTS, workflow, layout et page Admin lus; reste du code non relu | Partielle |
| 3 — Supabase | Projet, tables, migrations et conseils linter identifiés; politiques/définitions/journaux pas encore revus individuellement | Partielle |
| 4 — Documentation | Plusieurs documents localisés et registre de fonctionnalités lu en partie; lecture exhaustive et rapprochement à achever | Partielle |
| 5 — Revue systématique de main | Inventaire de chemins disponible; revue ligne par ligne non effectuée | En cours |
| 6 — Erreurs et journaux | Statut qualité CircleCI observé; logs détaillés et erreurs métier non collectés systématiquement | Partielle |
| 7 — Variables/configurations | Noms dans `.env.example` et workflow BDPM identifiés; présence distante non vérifiée | Partielle |

Aucun pourcentage global de couverture n'est calculé : les dénominateurs de l'inventaire détaillé et le volume de ressources entièrement lues ne sont pas encore stabilisés. Le document reste le registre de travail et doit être enrichi au fur et à mesure de la phase préliminaire.


## 21. Spécifications, garde Admin et configurations — complément

### Documents de référence
Les fichiers `naxa_cahier_des_charges_v3_7.md` (environ 204 272 caractères) et `naxa_prompt_maitre_fusion_v2.md` (environ 13 570 caractères) sont présents sur `main`. Le cahier des charges distingue EXISTANT, NOUVEAU et À ARBITRER et décrit l'ERP pharmaceutique comme cœur du produit, la marketplace comme module alimenté par le stock réel. Le prompt maître demande de distinguer état réel, main, branches, spécifications et documentation. Pour le présent chantier, le mandat utilisateur prévaut sur toute instruction historique de déploiement.

### Contradiction documentaire
`docs/audits/VERIFICATION_RPC_SUPABASE_2026-10-26.md` mentionne la branche historique `audit/admin-360-20261026` et déclare des contrôles RPC « validés », ainsi qu'une migration appliquée à Supabase. Un fichier de migration correspondant existe dans le répertoire courant `supabase/migrations/`. Ces déclarations sont historiques et ne prouvent pas qu'une opération a été faite dans le cadre du présent mandat. Elles devront être rapprochées de l'historique Git et de l'état live; aucune migration n'a été réappliquée.

### Garde d'accès Admin — preuve statique
`src/lib/admin/require-admin-active.ts` appelle `auth.getUser()`, redirige les utilisateurs sans session valide vers la connexion, puis lit `profiles.role` et `profiles.actif`. La suite n'est accessible que si `role === "admin"` et `actif === true`; une erreur de lecture du profil provoque une redirection vers `/`. Cela confirme la logique de ce garde, mais pas que toutes les actions serveur, API, RPC et politiques RLS appliquent une protection équivalente.

### Variables et secrets — noms seulement

| Nom repéré | Emplacement / usage | Présence distante |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.example`, workflows d'import | Non vérifiée |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.example` | Non vérifiée |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.example`, workflows d'import | Non vérifiée |
| `GEMINI_API_KEY`, `IA_MODELE` | `.env.example` | Non vérifiée |
| `NAXA_DATABASE_URL` | Workflow de sauvegarde indépendante | Non vérifiée |
| `NAXA_BACKUP_ENCRYPTION_KEY` | Workflow de sauvegarde indépendante | Non vérifiée |
| `NAXA_BACKUP_S3_BUCKET` | Workflow de sauvegarde indépendante | Non vérifiée |

Les valeurs réelles n'ont pas été consultées ni consignées. Les fichiers versionnés ne prouvent pas la présence des variables dans GitHub, Supabase ou Vercel.

### Workflows repérés
- `.github/workflows/import-bdpm.yml` : import manuel de données vers Supabase.
- `.github/workflows/import-medicament-images-cameroun.yml` : manuel ou push ciblé sur ses propres fichiers/script; le présent document d'audit n'est pas dans les chemins de déclenchement décrits.
- `.github/workflows/naxa-independent-backup.yml` : sauvegarde manuelle ou planifiée.
- `.circleci/config.yml` : contrôles qualité et tests SQL.

Aucun workflow n'a été déclenché volontairement. Aucune configuration distante n'a été modifiée.

| ID | Constat | Preuve | Statut |
|---|---|---|---|
| PRE-022 | Spécifications principales présentes sur main | Fichiers versionnés | À rapprocher du code |
| PRE-023 | Rapport RPC antérieur mentionnant une branche historique et des migrations appliquées | Rapport versionné | Traçabilité à réconcilier |
| PRE-024 | Garde Admin exige session, rôle admin et compte actif | Code statique | Garde confirmé; couverture globale inconnue |
| PRE-025 | Workflows dépendants de secrets et certains capables d'écrire dans Supabase | Configuration statique | Aucun workflow lancé |
| PRE-026 | Présence réelle des variables distantes non établie | Limite des ressources | Ouvert |

## 22. État de la phase préliminaire

La phase préliminaire avance mais n'est pas achevée. Restent notamment la comparaison des migrations sources avec les versions live, l'examen détaillé des politiques RLS et fonctions sensibles, la lecture exhaustive des documents pertinents et l'inventaire fichier par fichier. L'audit détaillé Administrateur demeure suspendu jusqu'à l'autorisation explicite de l'utilisateur.


## 23. Comparaison migrations
Le détail du rapprochement est consigné dans [AUDIT_360_ADMINISTRATEUR_NAXA_MIGRATIONS.md](./AUDIT_360_ADMINISTRATEUR_NAXA_MIGRATIONS.md). Les versions de migration live ne correspondent pas toujours aux préfixes des fichiers sources; cela doit être rapproché par nom et contenu. Aucun SQL n'a été modifié.


## 24. Contrôles Supabase actualisés et journaux — 26 octobre 2026

Lecture seule du projet Supabase principal, relevé vers 19:39 UTC. Ces avertissements sont des signaux du linter et doivent être examinés au niveau des objets et des règles métier; ils ne prouvent pas tous, isolément, une vulnérabilité exploitable.

### Sécurité — constats du linter

- **PRE-030 — Signal à examiner :** 5 tables ont RLS activé sans politique déclarée : `caisse_audit_chain_heads`, `caisse_decaissement_auth_grants`, `caisse_security_challenges`, `caisse_security_credentials`, `pharmacie_donnees_historique`. L'absence de politique peut signifier refus d'accès voulu; confirmer l'intention et les usages applicatifs.
- **PRE-031 — Signal à examiner :** 5 fonctions `SECURITY DEFINER` exécutables par `anon` sont signalées par le linter. Revue requise fonction par fonction : exposition voulue, vérification des paramètres, privilèges minimaux, `search_path` et données retournées.
- **PRE-032 — Signal à examiner :** 120 fonctions `SECURITY DEFINER` exécutables par `authenticated` sont signalées. Ce nombre ne signifie pas 120 failles; il impose une classification par rôle, contrat d'appel et contrôles internes.
- **PRE-033 — Configuration Auth :** la protection contre les mots de passe compromis est désactivée selon l'advisor Supabase. Aucun réglage n'a été changé.
- Références de remédiation du linter : [RLS activé sans politique](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [SECURITY DEFINER accessible à anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [SECURITY DEFINER accessible à authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [protection des mots de passe](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

### Performance — constats du linter

- **PRE-034 — Signal :** 113 clés étrangères sans index couvrant signalées.
- **PRE-035 — Signal :** 92 index signalés comme inutilisés; l'absence d'utilisation observée ne suffit pas à justifier leur suppression.
- **PRE-036 — Signal :** 59 groupes de politiques permissives multiples signalés; vérifier si le chevauchement est intentionnel et si les prédicats cumulés respectent le cloisonnement pharmacie/rôle.
- **PRE-037 — Signal concret :** index identiques `stocks_lots_id_uidx` et `stocks_lots_id_uq` signalés sur `public.stocks_lots`. Ne pas supprimer sans vérifier contraintes, dépendances et plan de migration.
- Références : [clés étrangères non indexées](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [index dupliqué](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index).

### Journaux — observation bornée

- Les sources présentes dans le flux de journaux sur la fenêtre par défaut (24 heures) incluent `pgbouncer_logs`, `postgres_logs`, `edge_logs`, `auth_logs`, `postgrest_logs`, `storage_logs`, `realtime_logs` et `auth_audit_logs`.
- Une recherche large par mots-clés `error/failed/exception/timeout` a trouvé 21 événements `pgbouncer_logs`, 8 `postgres_logs` et 6 `realtime_logs`. **Ce décompte n'est pas un décompte confirmé d'incidents** : le filtrage textuel attrape aussi des fragments de requêtes SQL contenant le mot `exception` et des fermetures TLS. Un tri par format de niveau/erreur doit précéder toute conclusion.
- Exemples visibles : messages de fermeture TLS inattendue côté PgBouncer; tâches cron de réservation et d'expiration indiquées comme démarrant/terminant. Aucun incident applicatif n'est déclaré confirmé sur la seule base de ces extraits.
- Les fonctions Edge déployées retournées par l'API Supabase : 0. À rapprocher des répertoires du dépôt et des autres mécanismes d'exécution; cela ne signifie pas qu'aucun cron ou endpoint applicatif n'existe.
- Le statut combiné GitHub du commit documentaire `5eca09f4601383b12e67e90d1d46da7628b65298` rapporte `ci/circleci: quality` en échec. Aucun workflow n'a été relancé; conformément au mandat, ce relevé n'est pas une investigation du déploiement en échec.

### Suites de la phase préliminaire

1. Examiner les définitions complètes des fonctions sensibles et les politiques associées, sans exécuter de mutation.
2. Refaire une recherche des erreurs de journaux avec les champs de niveau appropriés et des messages d'erreur explicites; séparer requêtes SQL journalisées des erreurs réelles.
3. Comparer les objets SQL live avec les fichiers sources et la documentation de migration, sans conclure à une absence de migration par simple différence de version.
4. Compléter l'inventaire traçable des fichiers et le rapprochement des spécifications avec les routes, API, RPC, politiques et tests présents.
5. Maintenir l'audit détaillé Admin en attente d'une autorisation explicite après clôture documentée du préliminaire.

Aucune donnée Supabase, politique, fonction, variable, configuration ni workflow n'a été modifié pendant ces vérifications.


## 25. Échantillon statique des gardes d'accès Admin — 26 octobre 2026

Contrôle limité aux fichiers suivants sur `main` : `src/lib/admin/require-admin-active.ts`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/api/admin/geolocalisation-osm/route.ts`, `src/app/api/admin/messagerie/route.ts`, `src/middleware.ts` et `package.json`. Il ne remplace pas la revue de toutes les routes et actions.

- **PRE-038 — Garde des pages Admin observée :** `requireAdminActive` exige une session valide, `profiles.role === "admin"` et `profiles.actif === true`; une erreur de lecture ou une valeur active absente entraîne le refus d'accès. Cette conclusion concerne les appels qui utilisent effectivement ce helper.
- **PRE-039 — Divergence potentielle à vérifier :** la route `POST /api/admin/messagerie` contrôle `role === "admin"` mais ne refuse que `profiles.actif === false`; contrairement au garde canonique, elle ne requiert pas explicitement `actif === true`. Si `actif` peut être nul ou absent, le comportement diffère. Vérifier le schéma réel, les contraintes et le contrat attendu avant de qualifier l'impact. **Aucune correction n'a été appliquée.**
- **PRE-040 — Contrôle de la route OSM observé :** `POST /api/admin/geolocalisation-osm` vérifie l'identité, puis appelle le RPC `is_admin` et exige le résultat booléen `true` avant d'utiliser le client privilégié. Les protections internes du RPC et les droits effectifs restent à examiner.
- **PRE-041 — Indicateurs Admin :** la mise en page charge les pharmacies, le RPC `validites_promoteurs_admin` et le nombre de tickets ouverts. Le code prévoit un état d'indicateurs partiels si certaines requêtes échouent; le tableau de bord affiche donc des compteurs qui peuvent être incomplets, plutôt que de garantir une vue exhaustive.
- **PRE-042 — Scripts de tests déclarés :** `package.json` expose des scripts ciblés (géolocalisation, catalogue médicaments, calculs caisse, moteur comptable, interopérabilité suivi, etc.), mais aucun script générique `test` n'est défini dans le manifeste observé. La présence des scripts ne prouve pas leur exécution ni leur réussite. Aucun test n'a été lancé dans cette étape.
- **Limite de couverture :** seuls deux fichiers de route `src/app/api/admin/` ont été confirmés dans l'inventaire initial; cela n'établit pas que les contrôles sont uniformes dans les autres API, Server Actions, RPC SQL, politiques RLS ou tâches planifiées. La revue complète reste ouverte.

Aucune route, règle d'accès, fonction SQL ou configuration n'a été modifiée.


## 26. Corroboration SQL en lecture seule — politiques et privilèges

Une requête directe au catalogue PostgreSQL confirme les cinq tables signalées par l'advisor : RLS activé, zéro politique déclarée et `FORCE ROW LEVEL SECURITY = false`. Les cinq objets restent à qualifier selon leur mode d'accès prévu et leurs privilèges de table; l'absence de politique RLS ne signifie pas à elle seule qu'un utilisateur authentifié peut les lire.

La même vérification confirme que `profiles.actif` et `profiles.role` sont `NOT NULL`, avec `actif` par défaut à `true`. **Précision sur PRE-039 :** la différence de condition entre le helper Admin et la route messagerie ne crée pas de voie d'accès via une valeur NULL dans le schéma live actuel; l'écart est une incohérence de contrat/code à traiter lors de l'audit détaillé, pas une vulnérabilité démontrée.

### Fonctions exposées — échantillon du catalogue PostgreSQL

- `public.get_home_service_catalog()` : `SECURITY DEFINER`, exécution accordée à `anon` et `authenticated`, paramètre `search_path=public, pg_temp`.
- `public.get_universe_catalog(text)` : `SECURITY DEFINER`, exécution accordée à `anon` et `authenticated`, `search_path` vide.
- `public.marketplace_offre_stock_disponible(uuid, uuid)` : `SECURITY DEFINER`, exécution accordée à `anon` et `authenticated`, `search_path` vide.
- `public.produits_populaires(integer, integer)` : `SECURITY DEFINER`, exécution accordée à `anon` et `authenticated`, `search_path` vide.
- `public.universe_partner_is_public(uuid, text)` : `SECURITY DEFINER`, exécution accordée à `anon` et `authenticated`, `search_path=public`.
- `private.is_admin()` : `SECURITY DEFINER`, exécution refusée à `anon`, accordée à `authenticated`, `search_path` vide.
- `public.validites_promoteurs_admin()` : `SECURITY DEFINER`, exécution refusée à `anon`, accordée à `authenticated`, `search_path` vide.

Ces résultats sont des privilèges effectifs et réglages observés dans le catalogue au moment de la requête. Ils ne prouvent pas à eux seuls qu'une donnée privée est divulguée : il faut examiner le corps complet, les filtres, les rôles propriétaires, les droits sur les tables sous-jacentes et les règles d'exposition API. Le `search_path` explicite `public` (ou `public, pg_temp`) sur deux fonctions exposées mérite une revue prioritaire et une comparaison avec les migrations versionnées. **Aucun privilège ni réglage n'a été changé.**


## 27. Couverture globale des fonctions SECURITY DEFINER — catalogue live

Le comptage direct des fonctions PostgreSQL du schéma `public` et `private` donne :

| Schéma | Fonctions SECURITY DEFINER | Exécutables par anon | Exécutables par authenticated | Sans réglage explicite de search_path |
|---|---:|---:|---:|---:|
| `public` | 189 | 5 | 120 | 0 |
| `private` | 36 | 0 | 27 | 0 |

- **Précision importante :** aucune fonction de ces deux schémas n'est ressortie sans réglage explicite `search_path` dans cette requête. Cela nuance le signal historique « search_path à revoir » : la revue porte maintenant sur la sûreté du chemin défini et les objets réellement appelés, pas sur une absence générale de réglage.
- Le schéma `public` ne permet pas `CREATE` aux rôles `anon` ni `authenticated` selon `has_schema_privilege`. Le schéma `private` refuse `USAGE` à `anon`, mais l'accorde à `authenticated`. Ces droits doivent être considérés avec les privilèges d'exécution des fonctions, les propriétaires et les politiques sous-jacentes.
- Le fait qu'une fonction `SECURITY DEFINER` soit exécutable par un rôle n'établit pas à lui seul une faille. Pour chaque fonction exposée, l'audit détaillé devra confirmer l'intention d'exposition, l'authentification métier interne, la validation des paramètres, les données renvoyées et le moindre privilège.
- Les fonctions `get_home_service_catalog` et `universe_partner_is_public` utilisent respectivement `search_path=public, pg_temp` et `search_path=public`; les objets de leurs corps doivent être qualifiés et le risque lié à `pg_temp` revu. Aucune modification n'a été appliquée.

Ce relevé provient du catalogue SQL live, en lecture seule. Il n'inclut pas une revue manuelle exhaustive des 225 corps de fonctions ni un test d'exploitation.


## 28. Storage Supabase — buckets et politiques observées

### Buckets live

| Bucket | Public | Limite fichier | MIME autorisés |
|---|---|---:|---|
| `dispositifs` | Oui | 30 000 octets | `image/webp` |
| `medicaments` | Oui | 5 242 880 octets | JPEG, PNG, WebP |
| `pharmacies-photos` | Oui | 524 288 octets | JPEG, PNG, SVG, WebP |
| `produits-photos` | Oui | 524 288 octets | WebP, JPEG, PNG |

Ces paramètres sont ceux de la base live. La limite particulièrement faible du bucket `dispositifs` est un point de compatibilité fonctionnelle à vérifier, pas une faille établie. Les buckets publics rendent les objets lisibles publiquement par conception; il faut confirmer que seules des images destinées à être publiques y sont stockées.

### Politiques Storage — écarts à examiner

- **PRE-043 — Divergence de garde potentielle :** les politiques `medicaments_admin_insert/update/delete` vérifient le bucket et `profiles.role = 'admin'`, mais ne vérifient pas `profiles.actif = true`. Le garde canonique des pages Admin et le RPC `private.is_admin()` exigent au contraire le compte actif. Une session admin dont le profil a été désactivé pourrait donc conserver des droits Storage sur le bucket `medicaments`, selon les politiques et les privilèges effectifs. À confirmer avec un test d'autorisation contrôlé avant toute correction; aucun test d'écriture n'a été tenté.
- Les politiques `photos_admin_ajout/maj/suppr` sur `produits-photos` appellent `private.is_admin()`, dont le corps live vérifie rôle admin **et** compte actif. Elles sont déclarées pour le rôle `public`, mais la fonction privée n'accorde pas `USAGE` à `anon`; l'accès effectif doit être validé sans supposer qu'une policy permissive autorise à elle seule l'opération.
- Les politiques de logos pharmacie contrôlent le rôle promoteur, le compte actif, l'affectation active à la pharmacie et un préfixe de chemin `logos/{pharmacie_id}/...`. Les expressions sont cohérentes avec le cloisonnement attendu sur les opérations listées; les cas de renommage/déplacement et les politiques non couvertes restent à vérifier.
- La lecture publique est explicitement autorisée sur les buckets `medicaments` et `produits-photos`; les buckets `pharmacies-photos` et `dispositifs` sont aussi configurés publics. Le contenu réel et les autres chemins de lecture restent à inventorier.

Aucune policy Storage, aucun bucket et aucun objet n'a été modifié.


## 29. Contrôle des politiques Admin par comparaison avec le garde actif

Requête de lecture seule sur `pg_policies`, ciblant les politiques qui testent directement `profiles.role = 'admin'` sans tester explicitement `profiles.actif`. Ce contrôle est un tri statique, pas une preuve d'accès exploitable; les policies peuvent coexister avec d'autres restrictions, les droits de table et les contrôles RPC.

### Écarts potentiels à prioriser

Les politiques suivantes ne contrôlent que le rôle Admin dans leur expression, sans vérifier directement `actif` :

- `audit_log_admin_insert` et `audit_log_admin_read` — journal d'audit.
- `exam_appointments_admin_read` — rendez-vous.
- `feature_flag_test_accounts_admin_all` et `feature_flags_admin_all` — comptes de test et indicateurs de fonctionnalité.
- `home_service_offers_admin_manage` et `home_service_requests_admin_read` — offres et demandes de services à domicile.
- `partner_members_admin_all`, `partner_universes_admin_all`, `partners_admin_all` — membres, univers et partenaires.
- `stock_movements_admin_all` — mouvements de stock.
- `suivi_professionals_admin_manage` — professionnels de l'espace de suivi.

**Qualification : PRE-044, cohérence de révocation Admin.** Ces politiques directes diffèrent du garde applicatif `requireAdminActive` et de `private.is_admin()`, qui vérifient aussi le statut actif. Si le contrat voulu est la révocation globale immédiate d'un compte Admin désactivé, ces expressions sont à harmoniser. Les profils actuellement observés dans la base ne comprennent qu'un compte admin actif; aucun compte Admin désactivé n'a été utilisé pour un test. Aucun test d'accès n'a été exécuté et aucune politique n'a été modifiée.

### État opérationnel observé (comptages, sans données nominatives)

- `public.pharmacies` : 4 enregistrements, dont 1 actif et 3 marqués `est_demo`.
- `public.tickets_support` : 0 ticket au moment du relevé.
- `public.admin_partner_dossiers` : 0 dossier au moment du relevé.
- `public.profiles` : 1 profil admin actif, 1 promoteur actif et 8 clients actifs dans le regroupement effectué.

Ces valeurs sont un instantané de la base live, pas une validation métier de l'interface. Les trois pharmacies marquées démo sont un point à comparer aux exigences NAXA sur l'interdiction d'afficher des données de test; leur présence en base ne démontre pas qu'elles sont visibles sur l'application.

## 30. Concordance des indicateurs de la page d'accueil Admin

Lecture du code actuel sur `main` : `src/app/admin/page.tsx` et `src/app/admin/layout.tsx`.

- La page d'accueil charge la liste des pharmacies, la RPC `validites_promoteurs_admin` et les huit entrées les plus récentes de `audit_log`. Elle calcule ses indicateurs à partir de ces résultats et signale explicitement les données partielles lorsqu'une requête échoue.
- La mise en page compte les tickets de support au statut `ouvert`, et additionne les pharmacies sans date de stock, les pharmacies inactives/masquées et les conventions impayées ou en retard. Le compteur est donc un **nombre de signaux calculés par règles spécifiques**, pas un total de dossiers distincts; un même dossier peut contribuer à plusieurs catégories.
- Les métriques de stock utilisent `stock_updated_at` comme proxy de fraîcheur. Une date présente ne prouve pas que le stock réel est exact, et une date absente ne prouve pas une rupture. Le code le précise déjà dans l'interface.
- Les comptes de démonstration doivent être vérifiés dans les filtres de toutes les vues Admin et pas uniquement sur le tableau de bord. Cette inspection statique n'a pas établi leur visibilité dans chaque écran.
- Les scripts de tests présents dans le dépôt n'ont pas été exécutés; les résultats ci-dessus restent un contrôle statique du code et un instantané SQL en lecture seule.

Aucune donnée de pharmacie, aucun ticket, profil, dossier partenaire ni indicateur n'a été modifié.


## 31. Inventaire de surface Admin sur l'arbre GitHub main

L'arbre GitHub récursif a été relu après les derniers commits documentaires : 1 247 entrées, `truncated=false`. Ce nombre représente les entrées de l'arbre Git et non 1 247 fichiers source.

### Routes de page Admin identifiées

18 fichiers `page.tsx` :
- `/admin`, `/admin/alertes`, `/admin/configuration`, `/admin/examens`, `/admin/geolocalisation`, `/admin/journal`, `/admin/messagerie`, `/admin/pharmacies/[id]`, `/admin/pilotage`, `/admin/pilotage/rapports`, `/admin/pilotage/validite`, `/admin/prestations`, `/admin/produits`, `/admin/profil`, `/admin/promoteurs`, `/admin/promoteurs/partenaires/[id]`, `/admin/rappels-lots`, `/admin/univers`.

### Actions serveur et API

- Dix modules d'actions Admin identifiés dans l'arbre : actions générales, création d'univers, examens, documents/pharmacies, validité, prestations, produits, promoteurs, partenaires et univers.
- Deux routes API Admin identifiées : `/api/admin/geolocalisation-osm` et `/api/admin/messagerie`.
- La vérification statique des actions lues a retrouvé le contrôle `requireAdminActive` dans la majorité des modules inspectés. Le module `src/app/admin/pharmacies/[id]/actions.ts` applique son propre garde : session, rôle admin et `actif === true`, avant les opérations utilisant le client privilégié. La route OSM utilise `is_admin`; la route messagerie emploie un contrôle distinct qui accepte toute valeur `actif` autre que `false`, divergence documentée en PRE-039.
- Le module `supabaseAdmin()` utilise la clé de service, mais cette observation ne signifie pas que les valeurs de secrets ont été lues : elles ne l'ont pas été. Toute action utilisant ce client exige un contrôle serveur robuste avant chaque mutation.

### Couverture des tests et limites

- L'arbre ne contient aucun fichier reconnu par le motif strict `*.test.ts(x)` / `*.spec.ts(x)` dans les dossiers conventionnels `tests` ou `__tests__`. Des scripts ciblés, tests SQL ou tests avec d'autres conventions existent dans le dépôt; ils ne sont pas couverts par ce seul motif.
- Les tests n'ont pas été lancés et aucun test utilisateur de l'interface n'a été effectué. La revue reste statique et n'établit ni l'accessibilité réelle de chaque écran, ni le comportement en session, ni la correction de chaque transition métier.
- Les tentatives d'inspection massive simultanée ont dépassé la limite d'appels disponible dans une seule exécution d'outils; elles n'ont apporté aucun résultat de test et n'ont provoqué aucune mutation. Les constats sont donc explicitement limités aux fichiers effectivement lus.

Aucune route, action serveur, règle SQL, branche, workflow ou donnée n'a été modifié par cet inventaire.


## 32. Vérification ciblée des actions serveur Admin

Relecture individuelle de dix modules d'actions serveur sur `main`, en contrôlant les gardes visibles et les opérations sensibles. Il s'agit d'une revue statique; aucune action n'a été exécutée dans l'application.

### Résultat de l'échantillon

- `src/app/admin/actions.ts` : utilise `requireAdminActive` avant la création et la gestion d'objets administratifs; plusieurs écritures utilisent ensuite `supabaseAdmin()`. Le contrôle doit être conservé avant chaque chemin de mutation et les validations d'entrées restent à examiner action par action.
- `src/app/admin/creation-univers-actions.ts` : utilise `requireAdminActive` et appelle une RPC pour la création d'univers; la sécurité effective dépend aussi des droits et contrôles internes de la RPC.
- `src/app/admin/examens/actions.ts` : les trois actions de statut passent par un wrapper qui appelle `requireAdminActive`; les identifiants UUID et valeurs de statut sont validés avant RPC. Les garanties transactionnelles et les règles d'état sont à contrôler dans le SQL.
- `src/app/admin/pilotage/validite/actions.ts` : utilise `requireAdminActive` avant l'appel RPC avec le client privilégié.
- `src/app/admin/prestations/actions.ts`, `src/app/admin/promoteurs/partenaires/actions.ts`, `src/app/admin/produits/actions.ts`, `src/app/admin/promoteurs/actions.ts` et `src/app/admin/univers/actions.ts` : les extraits examinés montrent l'utilisation du garde actif canonique ou d'un wrapper qui l'appelle. Les actions de modification passent ensuite par Supabase/RPC; cela ne prouve pas que tous les cas métier ou toutes les autorisations objet sont correctement contrôlés.
- `src/app/admin/pharmacies/[id]/actions.ts` : implémente un garde local distinct qui vérifie l'utilisateur, puis `profiles.role === 'admin'` et `profiles.actif === true`, avant les opérations avec le client de service.

### Limites et points de contrôle restants

- Les gardes sont observés dans les dix fichiers examinés; cela ne couvre pas toutes les Server Actions du dépôt, les routes non Admin, les RPC, ni les politiques RLS.
- La validation syntaxique d'un UUID ou d'une valeur d'énumération n'assure pas à elle seule que la transition métier est permise. Pour chaque RPC, vérifier l'état courant, la portée de l'objet, l'idempotence, les effets secondaires et les traces d'audit.
- La duplication du garde local dans `pharmacies/[id]/actions.ts` est une divergence de maintenance, pas une vulnérabilité démontrée : le contrôle actif est bien présent dans le code lu.
- Aucun test de rôle, de compte désactivé, de requête forgée, d'accès inter-pharmacie ou de rejeu n'a été réalisé. Aucun fichier applicatif n'a été modifié.

## 33. Plan de clôture du préliminaire

Avant de déclarer la phase préliminaire terminée, il reste à :
1. contrôler les modules de page et les Server Actions restantes, ainsi que les routes API hors du dossier Admin qui touchent aux données administratives;
2. rapprocher les RPC critiques de leurs migrations sources et examiner les permissions réelles sur leurs tables dépendantes;
3. vérifier les conventions de tests, les scripts de validation disponibles et les éléments réellement exécutables sans toucher aux données de production;
4. finaliser la liste des risques par preuve, impact possible, niveau de confiance et action proposée;
5. relire le rapport complet et vérifier le commit sur `main`.

La phase reste préliminaire. Aucun audit détaillé Admin n'est lancé et aucune correction de code ou de base n'est autorisée par cette étape.


## 34. Revue ciblée des deux routes API Admin

### `POST /api/admin/messagerie`

- Contrôle d'authentification via `auth.getUser()`, puis lecture du profil. Le garde rejette les erreurs de lecture et les rôles différents d'Admin, mais utilise `profile.actif === false` plutôt que `profile.actif !== true`. Le schéma live indique que `actif` est `NOT NULL`; l'écart ne constitue donc pas une voie de contournement par valeur NULL dans le schéma observé, mais reste une divergence à harmoniser.
- Le contenu est borné à 2 000 caractères et le ticket est relu via le client privilégié. La route refuse les tickets absents et les tickets dont le statut n'est pas `ouvert`, puis insère le message en précisant le profil auteur et `interne: false`.
- Points à vérifier ensuite : format UUID de `ticket_id`, contrôle explicite de la portée du ticket et de l'auteur dans la même opération, protection contre les envois répétés, cohérence transactionnelle entre la vérification du statut et l'insertion, et audit de l'action. Le contrôle « ticket ouvert » suivi d'une insertion séparée peut présenter une course concurrente si deux opérations changent le statut simultanément; aucune concurrence n'a été testée.
- **Qualification : PRE-045 — durcissement et cohérence de contrat à vérifier**, pas une faille démontrée.

### `/api/admin/geolocalisation-osm`

- Les méthodes `POST` et `GET` existent. La fonction de garde vérifie une session et appelle la RPC `is_admin`, qui doit renvoyer exactement `true`, avant l'utilisation du client privilégié.
- La synchronisation POST contacte le service externe Overpass d'OpenStreetMap, plafonne le lot initial à 500 candidats, compare les pharmacies existantes et met à jour des coordonnées et les traces de synchronisation. Une erreur de service externe est renvoyée comme échec explicite; une réservation de créneau de synchronisation est aussi contrôlée.
- Points à confirmer par tests non destructifs : idempotence lors de répétitions, limite de débit et délai maximal du service externe, contrôle des coordonnées et du périmètre géographique, prévention de mises à jour ambiguës lorsque plusieurs pharmacies ont des noms proches, et comportement en cas d'échec partiel. Le code contient une limite de résultats de lecture à 5 000; vérifier qu'elle ne tronque pas silencieusement le rapprochement.
- Aucun appel à Overpass, aucune synchronisation OSM et aucune mutation de pharmacie n'a été déclenché pendant l'audit.

## 35. État des preuves à ce stade

Les constats documentés se répartissent en trois niveaux :
1. **Confirmé par lecture de code ou catalogue** : garde utilisé dans les fichiers examinés, méthodes HTTP déclarées, réglages SQL et politiques exposées, comptages de tables et de profils.
2. **Écart de contrat / risque plausible** : garde d'activité non uniforme, politiques Admin sans test direct du statut actif, course potentielle sur la messagerie, risque de rapprochement ambigu OSM.
3. **Non démontré faute de test contrôlé** : contournement d'accès effectif, fuite de données, impact réel sur une pharmacie, échec métier reproductible ou exposition d'un contenu de stockage non prévu.

Le préliminaire reste ouvert. Toute vérification impliquant des comptes désactivés, des mutations de Storage, des appels externes ou des changements de données doit être conçue comme un test contrôlé et autorisée séparément; aucun de ces tests n'a été exécuté.


## 36. Rapprochement d'une migration de durcissement RPC avec l'état live

Le contrôle croisé du fichier source, de l'historique de migration Supabase et du catalogue PostgreSQL permet de préciser un point qui restait ambigu :

- Le fichier `supabase/migrations/20261026190000_admin_rpc_empty_search_path_hardening.sql` est présent sur `main`.
- La table live `supabase_migrations.schema_migrations` contient la version `20261026150907`, nommée `admin_rpc_empty_search_path_hardening_20261026190000`. Le décalage entre le préfixe du fichier et la version enregistrée est donc réel, mais la migration n'est pas absente de l'historique live.
- Les huit fonctions ciblées par ce fichier ont été relues directement dans `pg_proc`. Pour chacune, le catalogue montre `search_path=""`, exécution refusée à `anon` et autorisée à `authenticated`. Cela corrobore l'état de durcissement déclaré pour ces huit fonctions.
- Le document historique `docs/audits/VERIFICATION_RPC_SUPABASE_2026-10-26.md` décrit également des tests transactionnels avec annulation, exécutés pendant un chantier antérieur sur la branche `audit/admin-360-20261026`. Cette preuve historique est consignée comme telle; elle n'a pas été rejouée dans la présente phase, conformément à l'absence de mutations et de relance de tests.
- Le même document mentionne douze RPC ciblées dans son contrôle antérieur. Le présent contrôle live a confirmé les huit fonctions de la migration nommée ci-dessus; il ne prétend pas avoir relu de nouveau les douze fonctions ni répété les tests transactionnels historiques.

**Conclusion de rapprochement :** ce point précis est corroboré par le code de `main`, l'historique live et les réglages SQL actuels. Il ne doit pas être traité comme une migration manquante sur la seule base de son numéro différent. Aucune migration n'a été appliquée et aucun privilège n'a été changé pendant cette vérification.


## 37. Rapprochement avec le registre de fonctionnalités NAXA

Le registre `FONCTIONNALITES_VALIDEES.md` distingue le périmètre historique Admin, marqué « VALIDÉ — MAIN », des preuves récentes encore manquantes. Le périmètre historique F050 décrit le dashboard, les produits, le pilotage, les rapports, la validité et la gestion Promoteur; cette mention ne doit pas être interprétée comme une preuve actuelle de validation de tous les écrans, permissions, métriques et parcours couverts par le présent audit 360°.

Le même registre indique explicitement que plusieurs travaux récents restent au niveau statique : build Next.js non exécuté, tests SQL ajoutés mais non exécutés, tests navigateur/E2E non réalisés, et preuves de Production non revendiquées. Le chantier Promoteur N1 est notamment marqué « CONSTRUIT — PREUVE MANQUANTE ». L'audit préliminaire doit donc conserver la distinction entre fonctionnalité historiquement intégrée et preuve technique/fonctionnelle actuelle.

### Vérification complémentaire des données de démonstration

Le regroupement live par `est_demo`, `actif`, `visible_recherche` et `de_garde` confirme :
- 1 pharmacie non-démo, active et visible dans la recherche;
- 3 pharmacies marquées démo, inactives, invisibles dans la recherche et non de garde.

Cela réduit le risque immédiat de présentation dans la recherche publique selon ces indicateurs de base, mais ne prouve pas que tous les écrans Admin, rapports, suggestions ou API excluent systématiquement les données démo. Aucun nom de pharmacie ni aucune donnée individuelle n'est reproduit dans ce rapport.

### Migration 120 — rapprochement live

L'historique Supabase live contient également `120_harden_universe_reservation_search_paths` sous la version `20261018220811`. Le décalage entre le numéro historique du fichier et la version live doit être interprété avec les conventions de versionnement existantes, pas comme une absence de migration. Le test SQL associé demeure non exécuté selon le registre; la présence d'une entrée d'historique ne remplace pas un résultat de test.

Aucune donnée n'a été modifiée et aucun test ni build n'a été lancé dans ce rapprochement.


## 38. Complément de revue des écrans et rapports

Une revue supplémentaire des pages Admin sur `main` a couvert Alertes, Configuration, Examens, Géolocalisation, Journal, Messagerie, Pilotage, Rapports, Validité, Prestations, Produits, Promoteurs, détail partenaire, Rappels lots et Univers.

- Les pages serveur relues utilisent majoritairement `requireAdminActive`; la page Validité contrôle directement session, rôle Admin et compte actif.
- Configuration ne manipule que les préférences locales de thème et de langue dans le fichier examiné.
- La page Rappels lots délègue au composant client `AdminRappelLotNotice`. Ce composant vérifie le rôle et le statut actif côté navigateur avant de charger les avis et d'appeler `admin_avis_rappel_lot_diffuser`. Cette vérification côté navigateur n'est pas, à elle seule, une preuve d'autorisation serveur; la RPC et les politiques des tables doivent assurer le contrôle effectif.
- `/api/rapports` applique des contrôles distincts : GET autorise plusieurs rôles actifs avec périmètre adapté au compte; POST exige un Admin actif et n'accepte que 7, 30 ou 90 jours avant d'enregistrer un rapport.
- Le tableau de bord Pilotage appelle directement `stats_pilotage_scope` depuis le navigateur. L'autorisation effective de cette RPC reste à corroborer à partir de sa définition et de ses privilèges live; elle n'est pas déduite du seul écran Admin.
- Le compteur « Promoteurs actifs » du rapport POST utilise `role='promoteur'` et `actif=true`. Il reste à rapprocher de la validité contractuelle pour confirmer la définition exacte de cet indicateur.

Ces constats sont issus d'une lecture statique. Aucun test de rôle, appel de diffusion de rappel, calcul de rapport ni mutation n'a été lancé.


## 39. Métadonnées live — Pilotage et rappels de lots

Le catalogue PostgreSQL live a été consulté en lecture seule pour trois fonctions utilisées par l'administration :

- `stats_pilotage_scope` : fonction invoker, exécution accordée à `authenticated`, refusée à `anon`, `search_path` vide.
- `admin_avis_rappel_lot_diffuser` : fonction definer, exécution accordée à `authenticated`, refusée à `anon`, `search_path` vide.
- `validites_promoteurs_admin` : fonction definer, exécution accordée à `authenticated`, refusée à `anon`, `search_path` vide.

L'exécution accordée à un rôle SQL authentifié ne prouve pas à elle seule que le rôle métier est autorisé : les contrôles internes des fonctions doivent être relus.

Les politiques de lecture live des deux tables de rappels de lots bornent la lecture aux comptes Admin actifs, ou aux Promoteurs actifs pour les pharmacies effectivement liées à leur réseau. Cette preuve concerne les politiques SELECT observées; elle ne confirme pas tous les contrôles internes de diffusion ni les droits d'écriture.

Le `search_path` vide est un réglage de sécurité, mais ne remplace pas la revue du corps SQL. Les définitions complètes et le périmètre des indicateurs de pilotage restent à rapprocher des migrations sources. Aucun rappel n'a été diffusé et aucune donnée n'a été modifiée.


## 40. Revue du corps des RPC Pilotage, Validité et diffusion des rappels

La définition SQL live a été lue directement depuis le catalogue PostgreSQL, sans appel de fonction ni mutation.

### `private.stats_pilotage_scope(integer)`

- Fonction `SECURITY DEFINER`, `STABLE`, `search_path` vide; exécution refusée à `anon`, accordée à `authenticated`. Le wrapper public délègue à cette fonction privée.
- La fonction exige `auth.uid()`, puis charge le rôle et la fonction interne depuis `profiles` avec `actif=true`; si aucun profil actif n'est trouvé, elle refuse l'accès.
- Les portées observées sont différenciées : Admin = pharmacies non démo; Promoteur = pharmacies actives liées à son réseau et non démo, avec privilège `VIEW_NETWORK_PILOTAGE`; Responsable et Caisse = pharmacie du profil avec leurs privilèges respectifs; les autres rôles sont refusés.
- Les requêtes des indicateurs filtrent les pharmacies par l'ensemble calculé. Les recherches de l'Admin incluent aussi les événements sans `pharmacie_id`, tandis que les fiches vues et ajouts panier utilisent uniquement `pharmacie_id = ANY(v_pharmacies)`. Cette différence de périmètre peut créer un entonnoir dont les étapes ne sont pas strictement comparables; à confirmer avec la définition métier attendue.
- Le taux nommé `taux_conversion_vente` divise `v_ventes` par le nombre de réservations. La vue source définit `v_ventes`; il reste à vérifier que son unité correspond bien à une conversion de réservation, plutôt qu'à un nombre de lignes/ventes. Le KPI ne doit pas être considéré comme validé fonctionnellement sur la seule base du SQL.
- Le calcul des séries journalières est borné à 30 jours même lorsque la période demandée peut atteindre 365 jours; ce choix paraît cohérent pour une série graphique compacte, mais doit être confronté au contrat d'affichage.

### `public.admin_avis_rappel_lot_diffuser(...)`

- La fonction vérifie en interne `auth.uid()` et exige un profil `admin` avec `actif=true` avant toute insertion. Elle valide les longueurs du nom du produit, du lot, du motif et de la consigne.
- Elle insère un avis de rappel, puis crée les destinataires pour toutes les pharmacies `actif=true`; elle annule l'opération si aucun destinataire n'est créé.
- Point métier à confirmer : la diffusion inclut toutes les pharmacies actives, sans filtrer explicitement `est_demo` ni vérifier l'état d'une relation promoteur-pharmacie. Ce comportement peut être intentionnel pour un rappel national, mais doit être explicité; aucun rappel n'a été diffusé.
- Le contrôle Admin actif est réalisé dans la fonction elle-même. L'exécution SQL accordée à `authenticated` ne suffit donc pas, isolément, à permettre à un utilisateur non Admin d'insérer un rappel via cette RPC.

### `public.validites_promoteurs_admin()` et `is_admin()`

- `validites_promoteurs_admin()` utilise `public.is_admin()` dans son filtre et retourne les Promoteurs, leurs liens pharmacies et les données d'abonnement/convention associées.
- `public.is_admin()` délègue à `private.is_admin()`, qui exige `auth.uid()`, `role='admin'` et `actif=true`. Le garde de la RPC de validité est donc présent dans la définition live.
- Les métadonnées de privilèges confirment que `anon` peut exécuter le wrapper booléen `public.is_admin()`, mais pas `private.is_admin()`. La fonction publique ne retourne qu'un booléen et ne divulgue pas les données de validité; l'exposition est néanmoins à garder en cohérence avec la politique de moindre privilège.

### Qualification

Les contrôles d'identité/activité des fonctions examinées sont confirmés par le corps SQL live. Les divergences de métriques et le périmètre de diffusion des rappels sont des questions de définition métier à clarifier, pas des vulnérabilités confirmées. Aucun appel métier, test de rôle ou changement SQL n'a été exécuté.


## 41. Clôture formelle de l’étape préliminaire obligatoire

**Statut : ÉTAPE PRÉLIMINAIRE CLÔTURÉE — 26 octobre 2026.** Cette clôture autorise le passage au jalon suivant du canevas; elle ne vaut ni validation fonctionnelle globale, ni certification de sécurité, ni clôture des risques individuels consignés dans ce rapport.

### Périmètre préliminaire accompli

- Les exigences de travail et les contraintes d’exécution issues du contexte NAXA ont été consolidées : intervention documentaire directement sur `main`, aucune branche créée, aucun déploiement, aucune modification fonctionnelle sans autorisation.
- Le dépôt et les documents d’audit ont été inventoriés; les pages Admin, plusieurs modules d’actions serveur, routes API et appels RPC ont fait l’objet d’une lecture statique ciblée.
- Le schéma Supabase live, les métadonnées de fonctions et privilèges, les politiques RLS/Storage, l’historique de migrations, les volumes agrégés non identifiants et les extraits de journaux disponibles ont été examinés en lecture seule.
- Les constats ont été consignés avec distinction entre faits confirmés, signaux à investiguer et questions métier; les éléments de preuve manquants et les limites des vérifications sont explicités.
- Les définitions live des RPC de pilotage, de validité Promoteurs et de diffusion des rappels de lots ont été lues sans les exécuter. Leurs contrôles internes d’accès ont été documentés, avec les points métier à clarifier.

### Limites conservées au registre

1. Le rapprochement exhaustif et sémantique des 251 migrations live avec les fichiers modernes et historiques n’est pas démontré comme achevé; les écarts de nommage ne sont pas assimilés à des migrations manquantes.
2. Les constats de linter, de politiques, de privilèges et d’index sont des signaux d’audit; aucune exploitation ni test négatif authentifié n’a été tenté.
3. Les parcours UI, les tests navigateur par rôle, les tests SQL automatisés, les calculs de KPI et les comportements d’écriture n’ont pas été validés de bout en bout dans cette étape.
4. Les données d’environnement n’ont pas été exposées; la présence et la validité des secrets distants n’ont pas été établies.
5. Le statut CI observé sur le commit documentaire est en échec (`ci/circleci: quality`). Il est consigné comme état observé, sans relance de workflow ni déploiement; il ne constitue pas une preuve de défaut fonctionnel de l’application.

### Décision de passage

Le préliminaire a atteint son objectif : établir une base documentaire, un inventaire de surface et un registre explicite des preuves et incertitudes avant l’audit détaillé. Les incertitudes listées restent ouvertes comme points de contrôle, mais ne bloquent pas la clôture de cette phase préparatoire. Le jalon suivant est **l’audit détaillé de l’Administrateur NAXA**, à commencer uniquement après autorisation explicite de l’utilisateur.

**Traçabilité d’exécution :** documentation seulement, directement sur `main`; aucune branche créée, aucun déploiement déclenché, aucun code applicatif/SQL/configuration/donnée modifié, aucune RPC métier ni opération d’écriture exécutée.


## 42. Audit détaillé — Lot 1 : navigation Admin, layout partagé et tableau de bord

**Périmètre examiné :** `src/components/admin/AdminNavigation.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/admin-bento.css`, `src/lib/admin/require-admin-active.ts`. Lecture statique de la version `main`; aucune interaction authentifiée ni mutation n’a été exécutée.

### Constat A — Garde d’accès partagée

Le layout et la page d’accueil utilisent `requireAdminActive`, qui exige un utilisateur authentifié, un profil présent, `role='admin'` et `actif=true`; une erreur de lecture du profil entraîne le refus. **Résultat : conforme sur le code examiné.** Cette conclusion porte sur le garde serveur, pas sur des essais de session navigateur.

### Constat B — Navigation et routes imbriquées

La navigation comporte 12 entrées, avec libellés et notes explicites, et compare le `pathname` à chaque `href` à l’identique pour `aria-current="page"`. Les pages imbriquées non déclarées dans la liste (par exemple une fiche pharmacie `/admin/pharmacies/[id]` ou le détail partenaire `/admin/promoteurs/partenaires/[id]`) ne correspondent à aucune entrée et ne mettent donc en évidence aucun parent actif. C’est un défaut UX/accessibilité probable, sans impact d’autorisation établi. Les pages Prestations et Examens sont accessibles via Univers & catalogue, pas directement depuis la navigation principale; à valider contre le plan de navigation attendu.

### Constat C — Cohérence du compteur d’alertes

Le layout calcule le badge en additionnant les dates de stock manquantes, les pharmacies inactives/masquées et les conventions impayées/en retard. Une même pharmacie peut compter dans plusieurs catégories; le badge représente donc des signaux cumulés et non nécessairement des dossiers distincts. Le libellé accessible « signaux à examiner » est compatible avec cette méthode, mais la page d’accueil reprend la somme dans un compteur « Alertes réseau » sans expliciter la règle. Recommandation d’audit : décider si le produit attend un nombre de signaux ou un nombre de dossiers uniques, puis harmoniser les libellés et calculs.

### Constat D — Pharmacies de démonstration incluses dans les compteurs

La page d’accueil et le layout chargent les pharmacies sans filtrer `est_demo`. Les indicateurs « Pharmacies du réseau », « Stocks horodatés », « À actualiser », quartiers, progression et alertes peuvent donc inclure des données de démonstration. Le pilotage SQL examiné précédemment exclut explicitement les pharmacies démo de sa portée Admin. Il existe ainsi une divergence de périmètre entre l’accueil Admin et le Pilotage. Le snapshot live antérieur indiquait 4 pharmacies, dont 3 démo inactives; il ne faut donc pas interpréter les KPI d’accueil comme des métriques du réseau opérationnel sans clarification. Constat confirmé dans le code; la règle métier d’inclusion reste à confirmer.

### Constat E — Horodatage de stock utilisé comme proxy

La page indique clairement qu’elle compte les pharmacies ayant `stock_updated_at` et précise qu’une date manquante ne prouve pas une rupture. La progression reste toutefois une mesure de fraîcheur de la donnée, pas un taux de stock réel ou de disponibilité produit. Le libellé secondaire doit rester explicite si ces chiffres sont réutilisés ailleurs.

### Constat F — État partiel des données

La page d’accueil détecte les erreurs des trois sources (pharmacies, validités, journal) et signale des indicateurs partiels. Le layout détecte aussi les erreurs de ses trois sources et affiche un avertissement global. C’est un garde-fou utile. Le tableau d’accueil remplace les jeux en erreur par des tableaux vides via `data ?? []`, avec avertissement visible, ce qui évite de présenter silencieusement un résultat complet mais peut faire apparaître des zéros; à surveiller en test d’interface.

### Décision du lot 1

- **Conforme dans le code :** garde serveur partagé Admin actif; états d’erreur partielle explicitement signalés; indication que l’horodatage ne prouve pas une rupture.
- **Écarts/points à arbitrer :** (1) parent de navigation actif sur les routes imbriquées; (2) périmètre des pharmacies démo sur les KPI/alertes; (3) définition du compteur d’alertes comme signaux ou dossiers; (4) accès direct aux sous-sections Prestations/Examens.
- **Suite méthodologique :** poursuivre l’audit détaillé page par page et rapprocher chaque constat des règles métier avant de proposer une correction. Aucune correction n’a été appliquée dans ce lot; aucune validation navigateur, compilation ou test automatisé n’est revendiqué.


## 43. Audit détaillé — Lot 2 : Alertes, Journal, Configuration et Messagerie

**Périmètre examiné :** pages `/admin/alertes`, `/admin/journal`, `/admin/configuration`, `/admin/messagerie`, composant `AdminInbox` et route `POST /api/admin/messagerie`. Lecture statique uniquement; aucune réponse n’a été envoyée, aucune préférence locale n’a été modifiée et aucun test d’écriture n’a été effectué.

### Alertes réseau

- Le garde serveur `requireAdminActive` est présent.
- Les alertes de stock manquant, pharmacie inactive/masquée et convention en retard sont affichées séparément; le texte précise correctement qu’une date de stock manquante ne prouve pas une rupture.
- Comme sur le tableau de bord, la requête des pharmacies ne filtre pas `est_demo`. Les pharmacies de démonstration peuvent donc apparaître dans les alertes et gonfler les nombres; à harmoniser avec le périmètre du Pilotage qui exclut les démos.
- En cas d’erreur de source, un avertissement visible est rendu. Les valeurs de la source défaillante sont néanmoins traitées comme des listes vides; l’avertissement atténue le risque d’interprétation, mais les KPI partiels restent visibles.

### Journal d’administration

- Le garde serveur Admin actif est présent; lecture limitée aux 200 événements les plus récents.
- L’écran affiche acteur, identifiant d’entité et `metadata` JSON intégral. C’est utile pour l’investigation, mais la sûreté dépend de ce qui est inscrit dans `audit_log` : il faudra vérifier le contrat de rédaction des métadonnées afin de ne pas exposer de secrets, tokens ou données personnelles superflues dans la console. Aucun élément observé ici ne prouve qu’un secret est effectivement présent.
- Le tri et le rendu du JSON sont statiques; aucun filtre ni pagination n’est visible dans le fichier examiné. À arbitrer selon le volume et le besoin d’investigation.

### Configuration

- Les préférences sont stockées dans `localStorage` sur l’appareil, pas dans le profil serveur. Le mode nuit met à jour les attributs/classes du document et la couleur de thème; la langue met à jour `document.documentElement.lang` et émet `naxa-language-updated`.
- L’écran annonce explicitement que les écrans non traduits restent dans leur langue d’origine. Le choix anglais n’est donc pas une traduction complète de l’interface. Le `try/finally` de l’initialisation rétablit `ready` même si la lecture locale échoue; les écritures sont silencieusement ignorées si le stockage est inaccessible.
- L’écran est protégé par le layout Admin partagé. Aucune modification de préférence n’a été exécutée pendant l’audit.

### Messagerie — décalage de validation de longueur

- Le composant `AdminInbox` autorise une réponse jusqu’à **5 000 caractères** (`maxLength={5000}`), mais l’API refuse tout message de plus de **2 000 caractères**. Pour les réponses de 2 001 à 5 000 caractères, l’interface laisse saisir un contenu que le serveur rejettera. **Écart fonctionnel confirmé dans le code**; aligner la limite affichée sur la règle serveur ou décider explicitement d’augmenter la limite côté serveur après validation du schéma et des règles métier.
- Le garde de la route API vérifie `role='admin'`, mais utilise `profile.actif === false` plutôt que `profile.actif !== true`. Le schéma live examiné précédemment rend `profiles.actif` NOT NULL avec valeur par défaut true : un `NULL` ne peut donc pas contourner le garde dans l’état actuel du schéma. La différence reste une incohérence de défense en profondeur à harmoniser avec `requireAdminActive`.
- La route valide la présence et la longueur du ticket/message, vérifie que le ticket existe et qu’il est ouvert, puis insère avec le client privilégié en fixant `interne=false`. Le contrôle de statut et l’insertion sont deux opérations distinctes : une fermeture concurrente entre ces opérations pourrait laisser passer une réponse sur un ticket devenu fermé. C’est un risque de concurrence à vérifier, pas un scénario reproduit.
- Le contrôle actuel ne valide pas explicitement le format UUID du ticket, mais l’absence d’un UUID valide doit encore être confrontée au comportement PostgREST et à la gestion d’erreur; aucune conclusion d’exploitation n’est tirée.
- L’interface confirme l’envoi après réponse HTTP réussie puis appelle `router.refresh()`. Elle n’affiche pas de note interne dans l’action d’envoi; les messages internes existants sont étiquetés à l’affichage.

### Décision du lot 2

- **Conforme dans le code examiné :** garde Admin actif sur les pages, limite de 200 événements dans le journal, avertissements en cas de sources indisponibles, validation serveur de l’état ouvert avant réponse, insertion des réponses publiques avec `interne=false`.
- **Écarts confirmés ou à clarifier :** (1) limites UI/API de messagerie incompatibles (5 000 contre 2 000); (2) divergence de formulation du contrôle `actif` dans l’API; (3) inclusion des pharmacies démo dans les alertes; (4) contrat de sensibilité des métadonnées du journal; (5) atomicité entre vérification du ticket ouvert et insertion.
- **Aucune correction appliquée** : les constats seront rapprochés des règles métier avant le lot de solution/validation. Compilation, tests automatisés et tests navigateur non exécutés dans cette étape.


## 44. Audit détaillé — Lot 3 : Examens, Prestations, Produits, Univers et Géolocalisation

**Périmètre examiné :** pages et actions Admin pour examens, prestations, produits, univers/partenaires, géolocalisation OSM et rappels de lots. Les actions d’écriture et l’appel externe OSM n’ont pas été exécutés.

### Examens — publication via RPC

- La page utilise `requireAdminActive`; les actions valident les UUID et les états autorisés puis délèguent les transitions à `admin_set_exam_center_status`, `admin_set_exam_service_status` et `admin_set_exam_pack_status`.
- La publication des services/packs est désactivée dans l’interface si le centre n’est pas actif. Le garde d’interface n’est pas la seule barrière : les RPC SQL doivent conserver les vérifications d’état du partenaire, de son association, de l’univers et des feature flags, comme le contrat affiché le promet. Les définitions SQL de ces trois RPC restent un point de rapprochement avant validation complète.
- La page charge jusqu’à 300 réservations et groupe les dates selon `Africa/Douala`; le nombre affiché correspond au jeu chargé, pas nécessairement à l’ensemble historique si le volume dépasse la limite.

### Prestations — confirmation après RPC

- L’action vérifie l’UUID et le statut, appelle `admin_set_home_service_offer_status`, relit le statut persistant et ne confirme l’action que si la valeur correspond à la demande. C’est une vérification après écriture utile.
- La page décrit correctement la validation administrative comme distincte de la vérification réelle des justificatifs. La validation de publication doit rester conditionnée côté SQL aux règles partenaire/association/univers/feature flags.

### Produits — succès d’interface potentiellement trompeur

- `enregistrerFiche` effectue l’UPDATE puis redirige vers `ok=1` dès que la requête ne renvoie pas d’erreur, sans relire les valeurs ni vérifier qu’une ligne a effectivement été modifiée. Un identifiant inexistant ou une mise à jour sans ligne correspondante pourrait donc être présenté comme un succès si PostgREST ne renvoie pas d’erreur.
- `brouillonIA` vérifie que le produit existe, génère une fiche puis exécute un UPDATE dont le résultat (`error` et nombre de lignes) est ignoré; l’action peut rediriger avec `ok=ia` alors que la persistance a échoué. **Écart de fiabilité confirmé par le code** : vérifier le résultat de l’UPDATE et confirmer la persistance avant le message de succès.
- Le chemin de fiche générée par IA fixe `source_fiche='ia'` et `fiche_validee=false`, ce qui empêche de présenter le brouillon comme validé. Les champs textuels sont bornés côté serveur; le format/validité de l’identifiant produit mérite une validation explicite et cohérente avec le type SQL.

### Univers et partenaires — cohérence et traçabilité

- Les actions utilisent le garde Admin actif. La création directe d’un partenaire est explicitement refusée et renvoyée vers le canal unique du dossier Promoteur.
- L’activation d’un partenaire ayant un dossier administratif est redirigée vers la validation du dossier; l’association Bébé & Maman est également empêchée dans le catalogue, conformément à la règle de rattachement à la pharmacie.
- L’activation d’univers et l’association partenaire/univers vérifient l’état persistant après RPC avant d’afficher un succès. En revanche, plusieurs insertions `audit_log` sont attendues après la mutation, mais leurs erreurs sont ignorées. L’état métier peut donc être modifié sans que l’événement de journal soit garanti; il faut décider si la traçabilité est best-effort ou obligatoire/transactionnelle.
- Certaines validations de forme utilisent une regex UUID permissive (`[0-9a-f-]{36}`) plutôt que le validateur strict. Cela ne suffit pas à prouver une faille, car la base conserve ses contraintes, mais une validation stricte uniforme est préférable.

### Dossier pharmacie — garde et documents

- La page détail possède son propre garde : authentification, rôle `admin` et `actif === true`. Les actions serveur répètent le contrôle. Les UUID de la fiche et des documents sont validés avant les opérations sensibles.
- L’envoi de justificatif est limité à 10 Mo et aux types PDF/JPEG/PNG/WebP; le fichier est stocké dans le bucket `pharmacie-documents` et la ligne de registre créée ensuite. En cas d’échec du registre, le code tente de supprimer le fichier temporaire. L’accès au fichier est signé pour 60 secondes.
- La décision de document utilise une mise à jour conditionnelle sur `statut_validation='en_attente'`, ce qui protège contre une seconde décision concurrente mieux qu’un simple contrôle préalable.
- Point à vérifier côté stockage : l’audit doit confirmer que le bucket `pharmacie-documents` est privé et que les permissions de service/accès correspondent à la confidentialité des justificatifs. Aucun fichier réel n’a été ouvert ni téléchargé.
- Le changement de statut Bébé & Maman relit l’état actif/visible de la pharmacie avant la RPC; la fonction SQL doit aussi vérifier les mêmes invariants, pour éviter de reposer uniquement sur la vérification applicative.

### Géolocalisation OSM — risque de concurrence à valider

- La route authentifie l’utilisateur et appelle `is_admin()` avant d’utiliser le client privilégié. Elle borne les coordonnées géographiques, exclut les entrées vétérinaires, conserve l’attribution OSM, ne crée pas de partenaire et évite d’écraser les coordonnées déjà présentes grâce à un filtre d’UPDATE conditionnel.
- Le quota de 24 heures est géré par une lecture du dernier démarrage, suivie d’un UPSERT séparé. Deux requêtes concurrentes peuvent théoriquement lire le même ancien état avant que l’une ou l’autre réserve le créneau; l’atomicité du verrou n’est donc pas garantie par ce seul enchaînement. Risque de concurrence à confirmer et à corriger au besoin par une opération SQL atomique, sans tester l’endpoint en production.
- Le bouton lance une vraie synchronisation externe et des écritures. Elle n’a pas été utilisée pendant l’audit.

### Décision du lot 3

- **Garde-fous présents :** gardes Admin actifs, transitions de statut encadrées, confirmation après persistance pour prestations et associations d’univers, validation conditionnelle des documents, conservation des coordonnées déjà renseignées.
- **Écarts confirmés :** succès de fiche produit potentiellement affiché malgré l’absence de confirmation de persistance; erreurs de journal ignorées après certaines mutations.
- **Points techniques à valider :** garde métier des RPC Examens et Bébé & Maman; atomicité du quota OSM; confidentialité du bucket documents; limites des listes chargées; uniformité UUID.
- **Aucune correction appliquée et aucun test de mutation effectué.**


## 45. Audit détaillé — Lot 4 : Promoteurs, dossiers pharmacie, rappels de lots et concordance du schéma live

**Périmètre examiné :** registre Promoteurs, fiche partenaire, fiche pharmacie, actions de gestion des documents, composant des rappels de lots et métadonnées Supabase live. Les fichiers justificatifs n’ont pas été chargés et aucune action de validation/diffusion n’a été déclenchée.

### Dossiers Promoteurs et fiche partenaire

- Les pages et actions concernées contrôlent l’authentification et le rôle Admin actif. La fiche partenaire valide strictement l’UUID avant la lecture privilégiée; la validation est présentée comme une transaction qui active ensemble le compte Promoteur, le partenaire et son association, tandis que la publication catalogue reste distincte.
- Le registre affiche des informations d’identité et de contact issues des profils/partenaires et les liens vers les dossiers; l’accès privilégié est placé après le garde Admin. La revue des politiques et du périmètre de données reste nécessaire pour s’assurer que le rôle Admin est le seul à pouvoir lire ces données privées.
- La liste des pharmacies du registre est sans filtre explicite `est_demo`; les dossiers de démonstration peuvent apparaître dans le registre. Ce n’est pas nécessairement incorrect pour une vue de conformité, mais l’interface doit clairement distinguer dossier de test et dossier réel.
- Les indicateurs et listes des partenaires indépendants sont limités à 500 dossiers; la page ne présente pas de pagination dans le code examiné. Au-delà du plafond, les résultats affichés ne représentent pas tout le registre.

### Fiche pharmacie — blocage de cohérence confirmé dans l’environnement live

Le code de la fiche pharmacie et ses actions utilise les objets `public.pharmacie_documents`, `public.pharmacie_document_historique` et le bucket Storage `pharmacie-documents` pour lister, déposer, statuer et consulter des justificatifs. Une requête catalogue en lecture seule sur Supabase live a renvoyé :

- `public.pharmacie_documents` : absent du catalogue live;
- `public.pharmacie_document_historique` : absent du catalogue live;
- bucket Storage `pharmacie-documents` : absent des buckets live;
- `public.pharmacie_documents_recus` et `public.pharmacie_donnees_historique` : présents.

Les buckets live recensés sont `dispositifs`, `medicaments`, `pharmacies-photos` et `produits-photos`; aucun ne porte le nom `pharmacie-documents`. **Écart de concordance code–environnement confirmé** : les opérations de justificatifs de la fiche pharmacie ne peuvent pas fonctionner correctement dans cet environnement tant que les objets attendus ne sont pas créés ou que le code n’est pas aligné sur le schéma cible. Le point ne doit pas être corrigé à l’aveugle : comparer les migrations historiques, l’intention de stockage privé et les objets réellement attendus avant de choisir une correction. Aucune création de table/bucket ni migration n’a été effectuée.

La fiche pharmacie charge également `pharmacie_document_historique`; son absence signifie que cette partie de la lecture peut échouer ou être incomplète. L’écran exécute plusieurs lectures parallèles et ne présente pas un traitement uniforme des erreurs de chaque source : l’expérience réelle doit être vérifiée après rétablissement du schéma.

### Rappels de lots — interface et volume

- Le composant vérifie dans le navigateur la session, le rôle Admin et `actif=true`, et la RPC de diffusion possède également son propre contrôle Admin actif. Le contrôle navigateur ne constitue donc pas l’unique barrière.
- Le bouton exige un nom de produit, un lot, un motif et une consigne de longueur minimale; les champs sont bornés. La confirmation indique explicitement que l’avis est envoyé aux pharmacies actives.
- La page charge jusqu’à 100 avis, mais récupère les destinataires sans limite ni pagination, puis regroupe les accusés en mémoire. À mesure que l’historique augmente, le chargement peut devenir coûteux ou incomplet selon les limites API; prévoir pagination/filtrage et index adaptés après analyse des volumes.
- La fonction live inclut toutes les pharmacies actives comme destinataires. Le choix de ne pas exclure les démos doit être explicité dans la règle métier de rappel national; aucune diffusion n’a été lancée.

### Décision du lot 4

- **Garde-fous confirmés :** contrôle Admin actif sur les pages/actions; validation stricte d’UUID sur la fiche partenaire; RPC de rappel protégée en interne; pièces déclarées reçues distinctes de la preuve que les documents ont été authentifiés.
- **Blocage confirmé :** absence dans Supabase live de la table `pharmacie_documents`, de l’historique associé et du bucket privé attendu `pharmacie-documents`, alors que le code les référence.
- **Autres points à arbitrer :** exposition des dossiers de démo dans le registre, pagination au-delà de 500 dossiers/100 avis, volume non borné des destinataires, périmètre des destinataires de rappel.
- **Aucune correction appliquée.** Les résultats catalogue sont des constats de métadonnées; aucune écriture SQL, migration ou opération Storage n’a été exécutée.


## 46. Rapprochement contradictoire — migration des pièces jointes de dossiers pharmacie

### 46.1 Sources comparées en lecture seule

- Dépôt `main` : `supabase/migrations/20261022150000_pharmacie_documents_fichiers_validation_historique.sql` existe (blob `91f1d82a07c31cda6e6fcd91b77e26211e04c998`).
- Cette migration crée `public.pharmacie_documents`, `public.pharmacie_document_historique`, le bucket Storage `pharmacie-documents` en privé (10 MiB, PDF/JPEG/PNG/WebP), quatre politiques Storage Admin et un trigger de journalisation.
- L'historique live `supabase_migrations.schema_migrations`, filtré sur les noms liés aux documents/dossiers pharmacie, renvoie les entrées `pharmacie_donnees_historique_append_only`, `pharmacie_historique_append_only_privileges`, `pharmacie_historique_couverture_tables_enfants` et `pharmacie_documents_recus`; aucune entrée correspondant à `pharmacie_documents_fichiers_validation_historique` n'a été retournée.
- Le catalogue live confirme que `pharmacie_documents`, `pharmacie_document_historique` et le bucket `pharmacie-documents` sont absents. En revanche, `pharmacie_documents_recus` et `pharmacie_donnees_historique` existent.
- La migration antérieure `20261022120000_pharmacie_documents_recus.sql` existe dans le dépôt et la table `pharmacie_documents_recus` existe en live sous une entrée d'historique nommée `pharmacie_documents_recus`, version `20261022073904`. Le préfixe du fichier et la version live diffèrent; cela ne prouve pas, à lui seul, une dérive du contenu.
- La migration de fichiers contient des politiques fondées sur `public.is_admin()`; la fonction `public.is_admin()` applique le rôle Admin et l'état actif via sa logique sous-jacente examinée précédemment. Le bucket est explicitement privé dans le SQL source, contrairement aux quatre buckets d'images actuellement observés en public.

### 46.2 Contradiction et conclusion corrigée

Le constat d'absence des tables et du bucket live est confirmé, mais il faut distinguer **objet absent en production** et **migration absente du dépôt** : la migration source est bien présente dans `main`. Le signal le plus précis est donc : **migration présente dans Git, sans entrée correspondante retrouvée dans l'historique live, et objets qu'elle doit créer absents du catalogue live**. La cause exacte (migration non appliquée, entrée historique renommée/non standard, ou autre écart de synchronisation) n'est pas démontrée par ces seuls éléments.

Le parcours d'envoi, de liste et de validation de fichiers qui dépend de ces objets est donc susceptible d'échouer dans l'environnement live actuel. Ce constat ne doit pas être confondu avec le parcours séparé de cases de réception déclarée, qui repose sur `pharmacie_documents_recus` et existe bien en live. Une case cochée signifie réception déclarée, pas preuve documentaire ni authentification.

### 46.3 Revue SQL statique — points à vérifier avant toute correction

- La migration de fichiers ne contient pas de bloc explicite `begin/commit`; son atomicité doit être appréciée selon le mécanisme d'exécution réel, sans supposer qu'un échec partiel est impossible.
- Les politiques de table permettent à un Admin d'insérer et de modifier les lignes documentaires; l'historique est alimenté par un trigger `AFTER INSERT OR UPDATE`. Il faut vérifier le parcours applicatif de remplacement/suppression pour garantir cohérence du fichier Storage, de la ligne documentaire et du journal.
- Le trigger journalise également les mises à jour où le statut ne change pas comme `remplacement`; cette sémantique peut produire des entrées d'historique pour des changements de métadonnées et doit être confirmée comme intentionnelle.
- La table d'historique n'expose dans cette migration qu'une politique de lecture Admin et un privilège SQL `SELECT`; les écritures sont attendues via le trigger SECURITY DEFINER. Le propriétaire effectif, les privilèges d'exécution de la fonction trigger et les protections contre les modifications directes doivent être vérifiés avant de conclure à une garantie append-only.
- Le nom du bucket et les contrôles de format/taille sont cohérents entre la migration source et les constats précédents du code, mais les droits de lecture sont limités à Admin. Toute URL signée doit être produite côté serveur après contrôle d'accès, et sa durée de vie doit rester courte.

### Décision du lot 5

- **Confirmé :** le fichier de migration est présent dans `main`; les deux tables documentaires et le bucket privé qu'il prévoit sont absents du catalogue live; aucune entrée live portant le nom de cette migration n'a été trouvée dans le filtre d'historique exécuté.
- **Distinction confirmée :** le registre de réception déclarative `pharmacie_documents_recus` existe et est distinct du stockage de fichiers et de l'historique de validation.
- **À instruire ensuite :** retrouver tous les appels applicatifs aux tables/bucket, vérifier le flux d'upload/compensation, les privilèges et le statut exact des migrations historiques avant de proposer une correction.
- **Aucune correction appliquée :** aucune migration, requête d'écriture, opération Storage, test d'envoi, branche ni déploiement n'a été lancé.


## 47. Flux documentaire — erreurs de lecture, compensation et dépendances de migration

### 47.1 Contrôle des dépendances amont

La revue du contrat SQL `supabase/tests/155_pharmacie_documents_and_manual_renewal_contract.sql` indique qu'il attend aussi la table `public.admin_pharmacie_audit` et la migration `20261022143000_admin_renouvellement_manuel_audit.sql`. Le fichier de migration existe dans `main`, mais la requête en lecture seule de l'historique live ne retourne aucune entrée correspondante et le catalogue ne retourne pas `public.admin_pharmacie_audit`. Cela élargit le constat : le problème n'est pas limité à la migration documentaire de 15:00; le lot de renouvellement manuel/audit associé semble lui aussi présent dans Git sans ses objets attendus en live. Cette requête est un contrôle ciblé, pas une preuve exhaustive de toutes les migrations non appliquées.

### 47.2 Contradictions observées dans le code applicatif

- Dans `src/app/admin/pharmacies/[id]/page.tsx`, la lecture de `pharmacie_documents` récupère `data` mais ne conserve pas `error`. Si la table est absente ou la lecture échoue, `documents` peut être nul et le rendu affiche le même état que lorsqu'il n'existe réellement aucun fichier (« Aucun fichier documentaire enregistré »). L'interface ne distingue donc pas absence de documents et indisponibilité du registre.
- La lecture de `pharmacie_document_historique` ne conserve pas non plus l'erreur. Un registre d'historique indisponible peut être présenté comme « Aucun événement d’historique disponible », ce qui est trompeur en situation de dérive du schéma.
- L'action `deposerDocumentPharmacie` contrôle l'utilisateur et le rôle Admin actif, valide le type MIME déclaré, la taille (1 octet à 10 Mio) et l'UUID de pharmacie, puis téléverse avant d'insérer la ligne en base. Si l'insertion échoue, elle tente de supprimer le fichier Storage, ce qui est une compensation utile. Toutefois, l'erreur de suppression est ignorée : une suppression échouée peut laisser un objet orphelin sans signal visible.
- La décision de validation/rejet utilise un UPDATE conditionnel sur l'identifiant, la pharmacie et le statut `en_attente`, puis vérifie qu'une ligne a été retournée. Cela protège raisonnablement contre une double décision concurrente; aucune décision réelle n'a été déclenchée.
- Le contrôle de consultation vérifie le rattachement du document à la pharmacie et impose le bucket attendu avant de produire une URL signée valable 60 secondes. Le contrôle applicatif est présent, mais le parcours ne peut pas fonctionner tant que les objets et le bucket n'existent pas en live.
- La migration documentaire journalise chaque INSERT et UPDATE, même si le statut ne change pas. Elle n'a pas de chemin explicite de suppression de fichier documentaire ni de suppression de ligne documentée dans l'interface examinée. Le cycle de vie des pièces remplacées et la politique de conservation doivent être définis avant correction.

### 47.3 Classement et prochaine vérification

- **Priorité haute — cohérence d'environnement :** deux migrations sources liées au dossier Promoteur/pharmacie et leurs objets attendus ne sont pas retrouvés dans l'historique/catalogue live. Ne pas appliquer automatiquement ces migrations pendant l'audit; comparer d'abord leur intégralité, leurs prérequis, leurs politiques et l'état de la base.
- **Priorité haute — exactitude du diagnostic UI :** les erreurs de lecture du registre documentaire et de son historique sont absorbées comme listes vides, ce qui peut masquer la panne réelle.
- **Priorité moyenne — compensation :** la suppression compensatoire après échec d'insertion n'est pas vérifiée ni journalisée; risque d'objet Storage orphelin.
- **Non exécuté :** le contrat SQL 155 n'a pas été lancé; aucun upload, validation/rejet, suppression Storage, écriture SQL, migration, branche ou déploiement n'a été réalisé.

La suite de l'audit doit examiner le SQL complet des deux migrations et les autres dépendances de `admin_pharmacie_audit`, puis vérifier les gardes, contraintes, politiques et parcours de renouvellement manuel sans effectuer de mutation.


## 48. Revue statique complète des migrations de renouvellement manuel et de pièces documentaires

### 48.1 Renouvellement manuel — garanties et écarts

La migration `20261022143000_admin_renouvellement_manuel_audit.sql` définit `public.admin_renouveler_promoteur(uuid,date,text,uuid)` en `SECURITY DEFINER`, avec `search_path=''`, et retire EXECUTE à `PUBLIC`, `anon` et `authenticated` pour ne l'accorder qu'à `service_role`. Le corps de la fonction :
- exige un profil Admin actif correspondant à `p_admin`, une échéance future et un motif d'au moins cinq caractères;
- exige un profil Promoteur, une seule convention, un seul abonnement et un seul rattachement pharmacie;
- verrouille convention, abonnement et rattachement par `FOR UPDATE`, puis vérifie l'alignement de l'architecture et du montant convention/abonnement;
- synchronise les échéances et statuts, réactive le profil Promoteur, le rattachement et la pharmacie;
- ne modifie pas la date de paiement et écrit un événement `renouvellement_manuel` dans `admin_pharmacie_audit`.

**Contradiction métier à valider :** la fonction réactive systématiquement le profil Promoteur et la pharmacie, même si leur inactivation avait une autre cause qu'une échéance dépassée. Elle ne vérifie pas explicitement que l'inactivation est imputable au blocage contractuel, ni que la pharmacie était active avant l'incident. Cela peut convertir un renouvellement administratif en réactivation générale. Aucune exécution n'a été effectuée; c'est une conséquence du SQL statique.

**Traçabilité de l'acteur :** la fonction accepte `p_admin` comme argument et vérifie qu'il s'agit d'un Admin actif, mais n'en dérive pas l'identité depuis une session utilisateur. Cette fonction est réservée à `service_role`, ce qui réduit l'exposition directe; néanmoins, tout futur endpoint serveur devra impérativement dériver l'acteur de la session Admin authentifiée et ne jamais accepter un identifiant d'acteur libre depuis le formulaire. Le dépôt consulté ne contient pas de référence applicative trouvée à `admin_renouveler_promoteur` : le flux semble actuellement être une capacité SQL préparée, sans parcours UI relié dans les fichiers recherchés.

**Audit et atomicité :** la mutation métier et l'insertion dans `admin_pharmacie_audit` sont dans la même fonction PostgreSQL; si l'insertion échoue, la transaction de la fonction échoue également. La table d'audit a RLS activée, aucun accès `anon/authenticated`, et des droits `service_role` SELECT/INSERT. Aucune politique de lecture Admin directe n'est définie dans cette migration; un écran d'audit ne pourra donc pas se contenter d'une lecture client standard. Les colonnes `avant` et `apres` sont JSONB libres sans contrainte de validation de schéma, ce qui rend la qualité de la piste dépendante du code de la fonction.

### 48.2 Documents pharmacie — modèle et garanties

La migration `20261022150000_pharmacie_documents_fichiers_validation_historique.sql` sépare correctement :
1. `pharmacie_documents_recus`, registre de réception déclarée;
2. `pharmacie_documents`, registre des fichiers réellement téléversés;
3. `pharmacie_document_historique`, journal des actions documentaires.

Le bucket `pharmacie-documents` est conçu privé, limité à 10 MiB et aux types PDF/JPEG/PNG/WebP. Les politiques Storage limitent les opérations aux utilisateurs pour lesquels `public.is_admin()` est vraie. La table documentaire possède une contrainte de type, de statut, de taille non négative et d'unicité du couple bucket/chemin.

**Points restant à corriger ou à trancher après autorisation :**
- Le déclencheur journalise toute mise à jour, y compris une mise à jour sans changement de statut, comme `remplacement`. Une modification de note ou de métadonnées peut donc produire un événement sémantiquement trompeur.
- La table d'historique ne dispose que d'une politique SELECT Admin; les écritures doivent passer par le trigger SECURITY DEFINER. La migration ne révoque pas explicitement les privilèges d'exécution du trigger-function `journaliser_pharmacie_document()` aux rôles applicatifs, même si une fonction trigger n'est pas normalement appelée comme une fonction ordinaire. Vérifier les ACL effectives lors du rapprochement, sans supposer que RLS seule rend l'historique immuable.
- Le trigger journalise `new.note_validation` comme détail pour chaque insertion/mise à jour; ce champ doit rester une note administrative non sensible, sans copie de pièces ou données personnelles inutiles.
- La compensation après échec d'insertion ignore l'erreur de suppression Storage; l'interface indique que le fichier temporaire a été supprimé sans preuve que cette suppression a réussi. Le message doit être rendu conditionnel à la réussite de la compensation ou prévoir une alerte de nettoyage.
- Les suppressions en cascade de la ligne documentaire suppriment aussi l'historique SQL, mais ne suppriment pas automatiquement l'objet Storage. Aucun parcours de suppression n'a été trouvé dans l'interface examinée; la politique de rétention et de remplacement doit être documentée avant d'ajouter ce parcours.

### 48.3 Résultat des vérifications ciblées

- Les deux migrations sont présentes dans le dépôt `main`.
- L'historique live interrogé ne retourne aucune entrée dont le nom corresponde aux deux migrations, et les tables attendues `admin_pharmacie_audit`, `pharmacie_documents`, `pharmacie_document_historique` ne sont pas présentes dans le catalogue live interrogé.
- La fonction de renouvellement manuel n'a pas été retrouvée dans les fichiers d'actions UI recherchés; les actions Promoteur existantes appellent plutôt `admin_valider_dossier_pharmacie` et mettent à jour séparément le registre `pharmacie_documents_recus`.
- Le contrat SQL `155_pharmacie_documents_and_manual_renewal_contract.sql` attend explicitement l'application des deux migrations. Il n'a pas été exécuté.
- Les contrôles restent des lectures de dépôt et de catalogue. Aucun appel RPC, changement de statut, renouvellement, envoi de document, écriture SQL, migration, création de branche ou déploiement n'a eu lieu.

### 48.4 Ordre recommandé pour la suite de l'audit

1. Cartographier les migrations et dépendances qui créent `admin_valider_dossier_pharmacie`, les tables de convention/abonnement et les objets documentaires; comparer leurs versions live sans déduire l'absence d'une migration de son seul nom.
2. Examiner la fonction `admin_valider_dossier_pharmacie` et ses droits, notamment l'acteur réel, les contraintes du dossier, les effets sur les profils/pharmacies et la piste d'audit.
3. Comparer les préconditions de validation initiale et de renouvellement manuel afin d'éviter qu'un parcours ne contourne l'autre.
4. Après autorisation distincte seulement, proposer un lot de correction minimal; ne pas appliquer les migrations pendant l'audit.


## 49. Validation initiale du dossier pharmacie — contrôle du SQL live et rapprochement métier

### 49.1 Fonction live et permissions effectives

La définition PostgreSQL live de `public.admin_valider_dossier_pharmacie(uuid,boolean)` a été lue en mode catalogue, sans exécution. Elle est `SECURITY DEFINER`, fixe `search_path=''`, dérive l'acteur de `auth.uid()` et refuse l'appel si `public.is_admin()` est faux. Le contrôle `public.is_admin()` délègue à `private.is_admin()`, dont les vérifications Admin actif ont été examinées dans les lots précédents.

ACL live ciblées :
- `anon` : pas d'EXECUTE sur `admin_valider_dossier_pharmacie`;
- `authenticated` : EXECUTE accordé, mais le corps de la fonction impose l'identité authentifiée et le contrôle Admin;
- `authenticated` : pas d'EXECUTE sur `naxa_provision_promoteur_pharmacie`, appelée depuis la fonction de validation;
- `service_role` : EXECUTE sur les deux fonctions.
Cette configuration ne constitue pas à elle seule une faille d'autorisation : la RPC de validation porte un contrôle Admin interne. Il reste néanmoins nécessaire de maintenir la garde interne même si l'interface et les Server Actions contrôlent déjà le rôle.

### 49.2 Préconditions vérifiées par la validation initiale

Le SQL live impose les contrôles suivants avant publication :
- confirmation explicite `p_autorisations_verifiees=true`;
- existence de la pharmacie et verrouillage de sa ligne;
- exactement un rattachement Promoteur/pharmacie;
- compte Promoteur, architecture non nulle et cohérence du champ `profiles.pharmacie_id`;
- présence d'un WhatsApp non vide dans `pharmacie_privee`;
- exactement une convention et un abonnement, avec cohérence architecture, convention liée et montant;
- architecture existante et active;
- refus du dossier déjà actif dans les quatre dimensions examinées;
- mise à jour transactionnelle de convention, abonnement, architecture affectée, profil et rattachement, provisionnement des privilèges, puis activation de la visibilité publique à la fin.

Les mises à jour et le provisionnement sont dans la même fonction PostgreSQL; une exception annule la transaction. La date de fin initiale est calculée à `current_date + 14` au moment de la validation, et non au moment de la création.

### 49.3 Contradiction entre registre de réception et validation

La fonction live ne lit pas `pharmacie_documents_recus` et ne vérifie pas les six indicateurs de pièces (existence légale, registre de commerce, NIU, attestation de non-redevance, plan de localisation, CNI Promoteur). Elle vérifie à la place la présence d'un WhatsApp dans `pharmacie_privee` et reçoit un booléen global `p_autorisations_verifiees`.

L'action applicative `mettreAJourPiecesRecues` écrit ces six indicateurs séparément; l'action `validerDossierPharmacie` ne transmet au RPC que l'identifiant pharmacie et le booléen global de vérification. **Il n'est donc pas démontré que les six pièces déclarées reçues soient une précondition technique de la validation.** Cela peut être une séparation intentionnelle entre checklist de réception et décision administrative, mais la règle métier doit être explicite : soit les indicateurs sont informatifs, soit le SQL doit contrôler les pièces requises. Le booléen global ne constitue pas à lui seul une preuve documentaire.

### 49.4 Écarts et risques à classer

- **Priorité haute — preuve documentaire :** le workflow permet potentiellement la validation sans contrôler les six indicateurs du registre déclaratif. Il faut confirmer si la validation exige leur présence; aucune validation n'a été lancée.
- **Priorité haute — réactivation et visibilité :** le RPC active le profil Promoteur, le rattachement et la pharmacie, puis rend la pharmacie visible à la fin. La condition « déjà actif » empêche seulement le cas où les quatre états examinés sont déjà vrais ensemble. Si la pharmacie était désactivée pour un motif indépendant du dossier initial, la validation pourrait la réactiver. Il faut distinguer création/activation initiale, réactivation contractuelle et levée d'une suspension pour un autre motif.
- **Priorité moyenne — visibilité métier :** la fonction rend `visible_recherche=true` après provisionnement, sans contrôle documentaire explicite dans son corps. Si la politique exige des pièces administratives vérifiées avant la publication publique, le garde-fou est incomplet; si la vérification humaine globale est la règle, il faut l'énoncer et la tracer clairement.
- **Priorité moyenne — cohérence des sources :** `promoteur_pharmacies` est une table de rattachement à plusieurs Promoteurs/pharmacies avec clé primaire composée; le RPC impose exactement un rattachement pour la pharmacie lors de sa validation. Cette contrainte métier est plus stricte que la seule forme du schéma et doit rester appliquée dans tout autre chemin de création/rattachement.
- **Migration d'origine non attribuée :** la définition live et ses ACL sont confirmées, mais le filtrage de l'historique de migration par nom ne retrouve pas d'entrée explicite pour cette RPC. Les recherches de fichiers du dépôt n'ont pas permis d'attribuer avec certitude sa définition à un fichier source précis. Ne pas conclure que le SQL n'existe pas dans Git ou qu'il est non versionné avant un rapprochement exhaustif du corpus historique.

### 49.5 Conclusion de l'étape

La validation est protégée par une RPC transactionnelle et une garde Admin interne. Le point métier le plus important n'est pas l'accès à la RPC, mais la **définition de ce qui constitue un dossier administrativement complet** : six pièces déclarées reçues, vérification humaine globale, ou pièces réellement téléversées. Ces trois notions sont distinctes dans le modèle actuel et ne doivent pas être confondues.

Aucune RPC n'a été exécutée. Aucune ligne, pièce, échéance, visibilité, permission ou migration n'a été modifiée. Aucun test automatisé ou navigateur n'a été lancé.
