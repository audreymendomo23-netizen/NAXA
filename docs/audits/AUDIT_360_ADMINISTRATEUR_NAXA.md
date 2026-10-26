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
