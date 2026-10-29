# Cahier des charges — Audit 360° du parcours Administrateur NAXA

> **Document de vérité fonctionnelle du chantier actif.** À appliquer conjointement avec le MANDAT CTO NAXA, seule autorité de gouvernance technique. Le cahier des charges V3.7 et le Prompt maître ont été supprimés; ils ne constituent plus des références.


> **Document de référence vivant** — audit préliminaire en cours. Ce document sépare les preuves directes, les déclarations historiques, les déductions et les vérifications encore indisponibles. Aucun déploiement n'est autorisé dans ce chantier.

## Clôture ciblée — point 3, configuration visuelle Data API (29 octobre 2026)

**Décision : point d’exposition directe du schéma `private` via la Data API — CLOS / CONFORME.** La clôture est limitée à ce risque précis; elle ne certifie pas l’ensemble des RPC publiques ni les parcours Promoteur 3–6.

- **Preuve visuelle déclarée par l’utilisateur :** dans Supabase > Project Settings > Data API, `graphql_public` et `public` sont cochés; `private` et `bi` ne sont pas cochés.
- **Contrôles SQL complémentaires en lecture seule :** aucun objet relationnel (table/vue/séquence) dans le schéma `private` et aucun ACL par défaut de fonction pour ce schéma n’ont été relevés. `authenticated` a néanmoins `USAGE` sur `private` et `EXECUTE` sur plusieurs helpers.
- **Voies d’accès indirectes examinées :** plusieurs fonctions du schéma `public` sont des façades `invoker` qui délèguent aux helpers privés. Les définitions consultées montrent des contrôles d’identité, de rôle ou de périmètre pour les opérations sensibles (accréditation, délégation/révocation de privilèges, provisioning Caisse, réactivation pharmacie et pilotage). Les ACL privées ne sont donc pas révoquées globalement : cela casserait ces façades sans refactorisation et tests ciblés. La recette exhaustive des RPC publiques reste hors de cette clôture ciblée.
- **Garde-fous respectés :** aucun réglage Supabase modifié; aucune migration ni écriture Production; aucun déploiement.
- **Statut de sortie :** exposition directe de `private` via Data API **CLOS / CONFORME** sur preuves visuelle et SQL. Pas de changement de configuration ou de privilèges Production nécessaire pour ce point. Les validations globales des RPC publiques et des parties Promoteur 3–6 restent distinctement ouvertes.

---

## Guide de construction — prompt NAXA-MANDAT CTO

Ce guide opérationnel consigne les consignes explicites du **NAXA-MANDAT CTO** pour construire et maintenir le présent cahier des charges Audit 360 Administrateur. Il ne réintroduit ni le cahier V3.7 ni le Prompt maître supprimés.

### Prompt d'exécution

> Agis comme CTO senior de NAXA. Le document de vérité fonctionnelle est le cahier des charges Audit 360 du parcours Administrateur, à construire et maintenir selon le NAXA-MANDAT CTO. Compare systématiquement les résultats attendus, le code réel sur GitHub `main`, les schémas/fonctions/RLS de Supabase, les parcours UI/API et les preuves de tests. Raisonner par contradiction et corriger la cause réelle, sans recréer ce qui existe déjà ni ouvrir de chantier parallèle.
>
> Travaille exclusivement dans le dépôt `audreymendomo23-netizen/NAXA`, sur `main` uniquement. Ne crée aucune branche et ne lance aucun déploiement sans autorisation explicite. N'effectue aucune écriture sur Supabase Production sans autorisation et périmètre explicites. N'utilise jamais Production pour simuler un test ou contourner un garde-fou.
>
> Pour chaque contrôle, distingue le code inspecté, le test effectivement exécuté, son environnement, le résultat observé et les réserves. Ne déclare jamais un test réussi sans preuve. Un point ne passe au vert que lorsque les critères correspondants sont démontrés; une absence de données de recette ne doit pas interrompre les vérifications indépendantes et l'avancement du chantier. Réutilise les preuves existantes, documente chaque action utile dans le présent cahier et dans `STATUT.md`, puis poursuis l'étape suivante sans répétition improductive.
>
> Le chantier Promoteur reste ouvert tant que les parties 3 à 6 ne sont pas validées. Les tests 029–031 demeurent une réserve technique tant qu'aucune preuve d'exécution fiable n'est disponible.

### Statut de la source normative — mise à jour du 29/10/2026

Le texte intégral intitulé **« NAXA — MANDAT CTO »** a été fourni explicitement par l'utilisateur dans la conversation le 29 octobre 2026. Il devient la source normative complète pour construire et maintenir ce cahier des charges. La transcription opérationnelle ci-dessus reste un aide-mémoire et **ne remplace pas le texte intégral fourni**. L'ancienne mention selon laquelle le mandat source n'avait pas été retrouvé est désormais obsolète.

Les obligations à appliquer sont celles du texte intégral fourni : gouvernance exclusive de `main`, aucune branche, zéro déploiement intentionnel, aucun changement de Production sans autorisation explicite, étapes préliminaires dans l'ordre, audit détaillé uniquement après autorisation, preuves et analyse contradictoire, critères de statut vert, inventaires quantitatifs traçables, simulation de 1 000 cas et mise à jour continue du registre.

**Limite documentaire à ne pas masquer :** le texte intégral est disponible dans la conversation source; ce commit met à jour le registre pour reconnaître cette source comme reçue et normative. Il ne prétend pas que le contenu complet des 12 sections a été recopié mot pour mot dans ce fichier par cette modification.

---

## Reprise des validations Promoteur — 29/10/2026

- **028 comportemental : VERT / PASS** — `supabase/tests/028_promoteur_responsable_accreditation_behavior.sql` exécuté dans le projet isolé Supabase `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`), résultat retourné : `028_promoteur_responsable_accreditation_behavior PASS`. Le test est transactionnel et se termine par `ROLLBACK`. Aucune écriture Production.
- **Configuration visuelle « Exposed schemas » : CLOS / CONFORME selon confirmation visuelle utilisateur (29/10/2026)** — `graphql_public` et `public` sont cochés; `private` et `bi` ne le sont pas. Cette preuve clôt uniquement le sous-contrôle de configuration visible. **Sécurité globale du schéma `private` : JAUNE / non certifiée** — les contrôles SQL en lecture seule indiquent que `authenticated` a `USAGE` sur `private` et `EXECUTE` sur plusieurs helpers privés, notamment `naxa_has_privilege` et `naxa_scope_allows`. Les privilèges SQL et les autres voies d’accès doivent encore être vérifiés. Aucun réglage Production n'a été modifié.
- **Tests 029–031 : réserve technique** — non exécutés dans cette passe; ils ne sont pas déclarés réussis sans preuve. Leurs scripts modifient `session_replication_role`; ils devront être exécutés seulement dans un environnement isolé dont le statut est confirmé.
- **Progression** — l'absence de données de recette ne bloque pas les contrôles indépendants ni la revue du code. Le sous-contrôle visuel « Exposed schemas » est clos sur preuve fournie; la sécurité globale de `private` reste JAUNE jusqu’à vérification des privilèges SQL et des autres voies d’accès. Les parties 3 à 6 ne doivent pas être présentées comme intégralement validées.

## Parties 5 et 6 Promoteur — revue statique initiale (29/10/2026)

### Partie 5 — scope réseau et pilotage (migration 032 / test 032)

**Revue du code : vérifiée statiquement; test comportemental non exécuté.**
- `private.stats_pilotage_scope(integer)` vérifie l'identité authentifiée et le profil actif; le Promoteur doit avoir `VIEW_NETWORK_PILOTAGE`, et son scope provient exclusivement des liens actifs `promoteur_pharmacies` associés à des pharmacies non démo.
- La façade `public.stats_pilotage_scope(integer)` est invoker et son EXECUTE est accordé à `authenticated`; l'interface Promoteur appelle cette façade et rend les KPI « Indisponible » quand la RPC échoue.
- Le script `supabase/tests/032_promoteur_scope_reseau_7.sql` couvre le scope A+B, l'exclusion de C/non attribué, la révocation du privilège réseau et les KPI attendus.
- **Réserve sécurité à résoudre :** en Production, les ACL observées accordent actuellement EXECUTE à `authenticated` sur `private.stats_pilotage_scope`, `private.naxa_has_privilege` et `private.naxa_scope_allows`. Le rôle `authenticated` a également USAGE sur `private`. La configuration effective « Exposed schemas » de PostgREST n'a pas pu être lue avec les outils disponibles. Ne pas déclarer le contrôle d'exposition vert tant que cette configuration et l'exposition réelle ne sont pas vérifiées. Aucune modification Production effectuée.

### Partie 6 — pilotage hors périmètre (test 033)

**Revue du code : vérifiée statiquement; test comportemental non exécuté.**
- `supabase/tests/033_promoteur_pilotage_hors_scope_8.sql` attend uniquement les pharmacies A+B, et exclut la pharmacie C et les événements non attribués; il vérifie recherches, fiches vues et ajouts panier.
- Le test crée des fixtures en transaction, modifie localement `session_replication_role`, puis exécute `ROLLBACK`. L'exécution via l'outil SQL a été bloquée par un garde-fou; aucun contournement n'a été tenté.
- Les tests 029–031 restent une réserve technique non certifiée. Aucun de ces tests n'est déclaré réussi sans résultat observé.

### Statuts de sortie de cette passe

- **028 comportemental : VERT / PASS**, preuve d'exécution sur l'environnement isolé `naxa-ci-replay-2`.
- **Partie 5 — revue statique : VERT pour l'inspection du code seulement; comportement : JAUNE** (test 032 non exécuté; ACL/exposition API à vérifier).
- **Partie 6 — revue statique : VERT pour l'inspection du script/code seulement; comportement : JAUNE** (test 033 non exécuté).
- **Tests 029–031 : JAUNE / réserve technique**, non exécutés.
- L'absence de données de recette ne bloque pas les vérifications indépendantes ni la poursuite de l'audit. Les parties 3 à 6 ne sont pas globalement closes.

---

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
Les fichiers `naxa_cahier_des_charges_v3_7.md` (environ 204 272 caractères) et `naxa_prompt_maitre_fusion_v2.md` (environ 13 570 caractères) sont présents sur `main`. Le cahier des charges distingue EXISTANT, NOUVEAU et À ARBITRER et décrit l'ERP pharmaceutique comme cœur du produit, la marketplace comme module alimenté par le stock réel. Le Prompt maître supprimé (historique uniquement) demande de distinguer état réel, main, branches, spécifications et documentation. Pour le présent chantier, le mandat utilisateur prévaut sur toute instruction historique de déploiement.

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


## 50. Comparaison des parcours pharmacie et partenaire — création, validation, privilèges

### 50.1 Parcours partenaire unifié : source Git et définition live concordantes

Le dépôt contient `supabase/migrations/20261026100000_admin_unified_universe_dossiers.sql` et la migration complémentaire `20261026143000_admin_partner_dossier_optional_coordinates.sql`. L'historique Supabase live contient les deux sous des noms horodatés distincts (`20261026142636` et `20261026142649`), ce qui confirme que ces migrations de dossiers partenaires ont une trace live, contrairement à certains objets du parcours de pièces pharmacie décrits aux sections 46–48.

La définition live de `admin_create_partner_dossier` correspond au modèle unifié : elle exige un Admin, vérifie le compte Promoteur, laisse le compte inactif en attente, crée le partenaire avec statut `pending`, l'association à l'univers désactivée, le membre propriétaire, le dossier administratif et, pour l'univers Examens, un centre en brouillon. Elle enregistre un événement `partner.dossier_created` dans `audit_log`. La version live accepte des coordonnées toutes deux absentes ou toutes deux renseignées; la migration optionnelle explique cet assouplissement. Les tables `partners` et `admin_partner_dossiers` contiennent actuellement zéro ligne : cela ne prouve pas que le parcours n'a jamais été utilisé, seulement qu'il n'y a pas de dossier/partenaire enregistré dans ces deux tables au moment du contrôle.

### 50.2 Validation partenaire : transaction et conditions

La fonction live `admin_valider_dossier_partenaire(uuid)` est `SECURITY DEFINER`, utilise un `search_path` vide et exige `public.is_admin()`. Elle verrouille le dossier et le partenaire en attente, vérifie que l'univers est activé (avec exception pour `aide`), puis active le partenaire, l'association à l'univers, le dossier et le compte Promoteur, avant d'inscrire `partner.dossier_validated` dans `audit_log`. Ces écritures sont dans une seule fonction transactionnelle : une erreur d'audit doit donc annuler la validation. `anon` n'a pas EXECUTE; `authenticated` a EXECUTE mais reste soumis au contrôle interne Admin.

La page partenaire indique explicitement que les cases documentaires déclarent une réception et ne remplacent pas les fichiers justificatifs authentifiés. Cependant, la fonction de validation ne contrôle ni la présence des clés requises dans `documents_received`, ni leur valeur, ni l'existence d'un dépôt de fichiers. Ce constat n'est pas automatiquement une faille : il devient une contradiction métier si les pièces sont censées être bloquantes avant validation. La règle doit être définie de manière explicite, univers par univers.

### 50.3 Contradictions transversales observées

1. **Deux modèles de dossier parallèles.** Le parcours pharmacie s'appuie sur `profiles`, `pharmacies`, `promoteur_pharmacies`, conventions et abonnements; le parcours partenaire s'appuie sur `profiles`, `partners`, `partner_members`, `partner_universes` et `admin_partner_dossiers`. Ils partagent le vocabulaire Promoteur/dossier/pièces, mais pas les mêmes états ni les mêmes préconditions.
2. **Pièces déclaratives non bloquantes dans les deux RPC.** Le parcours pharmacie ne lit pas les six indicateurs de `pharmacie_documents_recus`; le parcours partenaire ne valide pas `documents_received`. La page partenaire précise que les cases ne prouvent pas l'authenticité, mais aucun contrôle de fichiers ne se trouve dans cette fonction de validation.
3. **Audit transactionnel présent dans le parcours partenaire, absent du RPC pharmacie.** Les RPC partenaires insèrent dans `audit_log` dans la transaction. Le RPC pharmacie met à jour plusieurs objets et provisionne des privilèges, mais son corps n'insère pas d'événement explicite de validation dans `audit_log`; des triggers d'historique couvrent plusieurs tables métier, ce qui n'est pas équivalent à un événement de décision administrative synthétique.
4. **Règle d'activation distincte.** La validation pharmacie réactive le profil, le rattachement, la pharmacie et la visibilité publique, avec une période de 14 jours; la validation partenaire réactive le compte Promoteur et l'association univers, sans mécanisme d'abonnement pharmacie équivalent. Ces différences peuvent être intentionnelles, mais doivent rester explicites afin d'éviter de transposer une règle commerciale à un univers qui ne la porte pas.
5. **Renouvellement manuel à sécuriser par son point d'entrée.** Le RPC de renouvellement manuel reste réservé à `service_role`, tandis que les RPC de validation initiale sont exécutables par `authenticated` avec garde Admin interne. Le renouvellement ne doit être appelé que par un serveur qui authentifie l'Admin réel et ne fait pas confiance à un identifiant `p_admin` fourni librement par le client. Aucun appel applicatif à ce RPC de renouvellement n'a été trouvé dans les actions examinées.

### 50.4 Priorités et décision à demander avant correction

- **P1 — Règle de complétude documentaire :** confirmer si les indicateurs de pièces sont seulement un suivi de réception ou une condition bloquante de validation; préciser les pièces et preuves exigées par univers.
- **P1 — Réactivation contrôlée :** distinguer activation initiale, renouvellement contractuel et levée d'une suspension pour un autre motif; la validation initiale ne doit pas implicitement lever une suspension indépendante sans règle approuvée.
- **P1 — Traçabilité de la décision pharmacie :** décider si l'historique de ligne existant suffit ou si un événement métier explicite de validation doit être enregistré dans la même transaction.
- **P2 — Parcours unifié :** documenter la matrice des états et préconditions par univers, sans fusionner artificiellement les modèles pharmacie et partenaire.
- **P2 — Point d'entrée du renouvellement :** si une interface est prévue, vérifier qu'elle passe par un serveur de confiance et derive l'acteur de la session Admin.

### 50.5 Limites de preuve

Les fonctions live ont été lues via le catalogue PostgreSQL et comparées aux migrations Git; aucune fonction n'a été exécutée. Les valeurs des tables métier n'ont pas été modifiées. Aucun dépôt de fichier, décision, activation, renouvellement, envoi de message, test SQL ou test navigateur n'a été lancé. Les constats de cohérence métier restent à faire valider avant toute correction.


## 51. Privilèges Promoteur, triggers de provisionnement et audit transactionnel

### 51.1 Frontière d'exécution observée dans le catalogue live

Le catalogue PostgreSQL confirme les paramètres de sécurité attendus pour les fonctions examinées :
- `admin_valider_dossier_pharmacie`, `admin_create_partner_dossier` et `admin_valider_dossier_partenaire` sont `SECURITY DEFINER`, ont un `search_path` vide, refusent EXECUTE à `anon` et accordent EXECUTE à `authenticated`. Leurs corps vérifient eux-mêmes le rôle Admin via `public.is_admin()`.
- `naxa_provision_promoteur_pharmacie` est `SECURITY DEFINER`, avec `search_path` vide, sans EXECUTE pour `anon` ni `authenticated`. Cela empêche l'appel direct par un utilisateur de l'application; le RPC de validation peut l'appeler dans son contexte privilégié.
- La fonction privée `naxa_promoteur_valide` existe sous deux signatures/catalogues résolus lors du contrôle : la version privée n'est pas exécutable par `authenticated`, tandis qu'une façade publique de même nom reste exécutable par `authenticated`. La façade est donc la frontière de consultation; les appels internes privilégiés utilisent la fonction privée selon la migration de séparation.
- Les traces de migrations live identifient `promoteur_provisioning_validity_guard_146` et `naxa_admin_validate_pharmacy_154`. Les noms live diffèrent des noms de fichiers Git, mais les définitions et les gardes de sécurité observées sont cohérentes avec ces migrations.

### 51.2 Provisionnement et effets en chaîne

Le RPC de validation pharmacie active la convention et l'abonnement, active l'architecture pharmacie, réactive le profil Promoteur, active le lien Promoteur/pharmacie, puis appelle `naxa_provision_promoteur_pharmacie` avant de rendre la pharmacie visible. Les contrôles de cohérence commerciale sont effectués dans la même transaction. La fonction de provisionnement exige notamment un profil Promoteur actif, une validité commerciale positive, un lien actif et une architecture active; elle n'accorde que les privilèges configurés comme actifs, non-gouvernance et délégables, avec une liste restreinte de privilèges réseau.

Le catalogue live expose également un trigger `trg_naxa_provision_on_architecture` sur insertion/mise à jour de `pharmacie_architectures`. La validation explicite et le trigger peuvent donc tous deux participer au provisionnement pendant le même parcours. L'opération est idempotente sur la clé de conflit des privilèges (réactivation/mise à jour plutôt que doublon), mais le nombre et l'origine exacte des écritures d'historique peuvent être plus complexes qu'un seul appel. Il faut conserver ce point dans la revue du flux et éviter de retirer l'un des deux mécanismes sans confirmer les autres chemins d'activation.

### 51.3 Audit administratif : différence confirmée et lacune de disponibilité

Le catalogue live montre que `audit_log` existe avec RLS activée et un droit INSERT pour `authenticated`; le parcours partenaire ajoute explicitement les événements `partner.dossier_created` et `partner.dossier_validated` dans les transactions de création/validation.

En revanche, la table `admin_pharmacie_audit` attendue par la migration `20261022143000_admin_renouvellement_manuel_audit.sql` n'apparaît pas dans le catalogue live interrogé, et l'historique de migrations ciblé ne contient pas de nom correspondant à cette migration. La fonction de renouvellement manuel n'a pas été trouvée parmi les fonctions live de ce contrôle ciblé. Cette convergence renforce le constat d'écart d'environnement déjà noté aux sections 46–48; elle ne permet pas, à elle seule, d'établir la cause (migration non appliquée, renommage historique ou divergence de synchronisation). Aucun renouvellement n'a été tenté.

Le journal de lignes `pharmacie_donnees_historique` et les triggers `naxa_capture_pharmacie_history` existent sur les profils, pharmacies, conventions, abonnements, architectures et privilèges. Ils constituent une trace de changements de lignes, mais pas nécessairement un événement métier qui exprime explicitement « dossier validé par tel Admin pour tel motif ». La migration de renouvellement manuel, si elle est retenue, doit être alignée avec l'état live avant d'être utilisée.

### 51.4 Conclusion provisoire

- **Pas de contournement direct confirmé** des fonctions de provisionnement par `anon` ou `authenticated` dans le catalogue observé.
- **Point d'attention de conception :** provisionnement potentiellement appelé par la fonction de validation et par trigger, à documenter et couvrir par tests de non-régression avant une modification.
- **Écart d'environnement confirmé à investiguer :** migration/table/fonction de renouvellement manuel présentes dans Git mais non retrouvées sous leurs noms attendus dans le catalogue et l'historique live ciblés.
- **Traçabilité métier inégale :** événements explicites dans le parcours partenaire, historique de lignes dans le parcours pharmacie; l'exigence de journal métier doit être tranchée.

Aucune fonction n'a été exécutée, aucun privilège n'a été modifié, aucune donnée n'a été écrite, aucun test n'a été lancé et aucun déploiement n'a eu lieu.


## 52. États de suspension, expiration et réactivation — garde-fous live

### 52.1 Modèle de statut constaté

Le catalogue live distingue plusieurs axes indépendants :
- `profiles.actif` : activation du compte Promoteur;
- `pharmacies.actif` et `pharmacies.visible_recherche` : activation opérationnelle et publication;
- `promoteur_pharmacies.actif` : activation du rattachement;
- `conventions_promoteurs.statut/date_expiration` : validité conventionnelle;
- `abonnements_promoteurs.statut/echeance/bloque_le` : état d'abonnement.

Les contraintes live limitent les statuts de convention à `active`, `expiree`, `resiliee`, et ceux de l'abonnement à `actif`, `impaye`, `resilie`. Les statuts et les booléens ne forment donc pas un seul état canonique; ils doivent être lus ensemble. Le catalogue comporte aussi des triggers d'historique sur ces tables et un contrôle de cohérence sur l'abonnement.

### 52.2 Garde de création/activation des Caisses

Le trigger `naxa_guard_promoteur_caisse_activation` sur `profiles` autorise la désactivation d'une Caisse, mais encadre l'activation d'une Caisse par un Promoteur authentifié : le Promoteur doit être actif, la Caisse doit être un enfant direct, la pharmacie doit être active et publiée, le rattachement doit être actif et `naxa_promoteur_valide` doit réussir. Un Admin passe par une voie distincte; les opérations sans `auth.uid()` sont traitées comme opérations de maintenance de confiance. Cette garde protège la création/activation des Caisses, mais ne remplace pas une règle globale de transition pour le dossier pharmacie.

### 52.3 Contradiction de transition dans la validation initiale pharmacie

La fonction `admin_valider_dossier_pharmacie` ne vérifie pas que la pharmacie, la convention et l'abonnement sont dans un état initial « en attente » avant de réécrire leurs états. Son unique garde « déjà actif » exige simultanément quatre conditions : pharmacie active, pharmacie visible, lien actif et Promoteur actif. Si l'une de ces conditions est fausse, la fonction peut continuer et réinitialiser la convention en `active`, l'abonnement en `actif`, effacer `bloque_le`, fixer un nouvel essai de 14 jours, réactiver le profil et le rattachement, puis republier la pharmacie. Elle ne vérifie pas que l'inactivité provenait d'un dossier initial non validé plutôt que d'une suspension, d'un impayé ou d'une décision opérationnelle distincte.

C'est une **faiblesse de machine à états confirmée par lecture statique**, mais l'impact opérationnel n'a pas été reproduit. La fonction exige toujours un Admin, un rattachement unique, un Promoteur cohérent, une convention et un abonnement uniques, une architecture active et un WhatsApp renseigné. Ces contrôles ne remplacent toutefois pas une précondition de transition autorisée.

### 52.4 Expiration et renouvellement : cohérence partielle

Le trigger `verifier_abonnement_promoteur_coherence` refuse un abonnement marqué `actif` lorsque son échéance est passée et vérifie que sa convention appartient au même Promoteur. Cela empêche une incohérence simple à l'écriture, mais ne suffit pas à garantir que toute réactivation soit légitime : la validation initiale réécrit simultanément l'échéance dans le futur avant de finaliser l'état. La fonction de renouvellement manuel, décrite en section 48, a des contrôles plus ciblés de cohérence et une trace métier, mais elle reste liée à une migration/table d'audit non retrouvée dans le catalogue live sous les noms attendus.

Le contrôle de cohérence abonnement ne garantit pas non plus à lui seul la cohérence entre la date d'expiration de convention, la date d'échéance d'abonnement, le motif de blocage et les états d'activation du profil, de la pharmacie et du rattachement. La fonction de validation initiale synchronise les dates; d'autres chemins de mutation doivent être évalués séparément avant de conclure à une invariance globale.

### 52.5 État de la preuve et proposition de correction (non appliquée)

**Proposition minimale à soumettre à validation :**
1. Introduire des transitions autorisées explicites : dossier initial en attente → validation initiale; abonnement échu/impayé → procédure de renouvellement ou régularisation; suspension administrative/opérationnelle → levée de suspension dédiée.
2. Pour la validation initiale, verrouiller et vérifier les états attendus avant toute mutation, plutôt que d'accepter toute combinaison qui n'est pas déjà entièrement active.
3. Réserver la réinitialisation des dates et l'effacement de `bloque_le` au parcours de renouvellement/régularisation autorisé, avec motif et acteur vérifiés.
4. Définir les invariants attendus entre statut de convention, échéance, statut d'abonnement, `bloque_le`, profil actif, pharmacie active/publiée et lien actif; couvrir chaque transition par des tests SQL négatifs et positifs.
5. Vérifier les chemins de désactivation et de blocage existants avant de modifier les RPC, afin de ne pas casser une suspension légitime ou une opération de maintenance.

Cette proposition est documentaire : aucun code SQL n'a été changé et aucun RPC n'a été exécuté. Les comptes de statuts observés n'ont pas été modifiés; ils ne suffisent pas à prouver les transitions possibles pour chaque cas historique.


## 53. Réactivation Promoteur : portée réelle de la RPC et écart entre code et environnement

### 53.1 RPC live `reactiver_promoteur`

La fonction live `public.reactiver_promoteur(uuid,text)` est `SECURITY DEFINER`, avec `search_path` vide, et vérifie `public.is_admin()`. Les privilèges live confirment `EXECUTE` pour `authenticated`, mais pas pour `anon`; l'autorisation métier dépend donc du garde-fou interne Admin, et non de la seule permission SQL. La migration Git `supabase/migration_153_promoteur_admin_rpc_hardening.sql` contient cette même intention de sécurité.

La portée de cette RPC dépasse néanmoins le simple renouvellement d'un abonnement :
- elle met la convention à `active`, enregistre la date de paiement du jour et calcule une nouvelle échéance;
- elle crée ou met à jour l'abonnement en `actif`, efface `bloque_le` et inscrit l'acteur de réactivation;
- elle ajoute une ligne au registre de paiements Promoteur, même si la référence fournie est vide (dans ce cas, la référence devient `NULL`);
- elle réactive toutes les pharmacies rattachées au Promoteur et tous les profils correspondant aux critères de rattachement, sans distinguer leur motif de désactivation;
- elle ne vérifie pas, dans son corps, un état source précis (impayé/échu/suspendu) ni une raison de suspension compatible avec la réactivation.

**Risque fonctionnel confirmé par lecture du corps SQL :** une action nommée « réactiver » peut rétablir des accès désactivés pour une autre raison et crée une trace de paiement sans vérification du paiement dans cette fonction. Le rôle Admin est requis, mais le contrôle d'accès n'est pas une preuve que la transition métier est appropriée. Aucun appel de la RPC n'a été exécuté et aucun paiement n'a été enregistré pendant l'audit.

### 53.2 Contradiction avec le renouvellement manuel documenté

La migration Git `supabase/migrations/20261022143000_admin_renouvellement_manuel_audit.sql` définit un chemin différent : échéance future obligatoire, motif de longueur minimale, vérification de cohérence convention/abonnement/architecture et insertion d'un audit `avant/après`. Elle précise que le renouvellement administratif ne vaut pas preuve de règlement et n'ajoute pas de paiement.

En revanche, les catalogues live consultés ne montrent pas la table `public.admin_pharmacie_audit` ni la fonction `public.admin_renouveler_promoteur` sous ces noms, alors que `public.reactiver_promoteur` est présente et exécutable par les rôles authentifiés sous réserve du garde-fou interne Admin. C'est un écart entre artefact Git et catalogue live à réconcilier; l'audit ne peut pas conclure si la migration est absente, renommée ou remplacée par un autre chemin sans une comparaison plus exhaustive de l'historique de migration.

### 53.3 Automatisation de l'expiration

La lecture du catalogue `cron.job` n'a retourné aucun job dont le nom ou la commande mentionne Promoteur, abonnement ou convention. Cela ne prouve pas l'absence de toute automatisation (un job peut appeler une fonction indirectement ou être orchestré hors de `pg_cron`), mais aucune tâche pg_cron directe d'expiration/régularisation n'a été identifiée par cette recherche. La validité commerciale est également calculée à la demande par `private.naxa_promoteur_valide`, qui vérifie le profil actif, les statuts et les échéances convention/abonnement, ainsi que les rattachements actifs et l'état des pharmacies.

### 53.4 Écarts d'architecture et propositions non appliquées

1. Séparer strictement `renouveler_sans_paiement` (motif, échéance, audit, aucune écriture dans le registre de paiements) de `enregistrer_paiement_confirme` (preuve/référence, acteur, période et unicité anti-doublon).
2. Faire de la réactivation une transition dédiée qui exige un motif d'origine compatible; ne pas réactiver en bloc les profils de Caisses/autres rôles à partir du seul `pharmacie_id`.
3. Contrôler explicitement les effets sur `pharmacies.visible_recherche` : la RPC live réactive `pharmacies.actif` mais ne force pas `visible_recherche`; l'état final peut donc rester actif mais non publié.
4. Vérifier et réconcilier la migration de renouvellement manuel et son audit avec l'environnement live avant d'en faire le chemin d'administration de référence.
5. Ajouter des tests SQL de refus pour une suspension administrative, une résiliation, une cible avec plusieurs pharmacies ou profils, une référence de paiement vide et une tentative de réactivation sans état commercial compatible.

Aucune correction de code, modification de schéma, opération commerciale ou migration n'a été exécutée. Les conclusions ci-dessus sont issues de la définition SQL live, des privilèges catalogués et des fichiers Git consultés.


## 54. Inventaire des autres voies de statut et privilèges — périmètre de l'examen complémentaire

### 54.1 Résultat de l'inventaire du catalogue live

Un inventaire en lecture seule de `pg_proc` a identifié plusieurs fonctions distinctes de `reactiver_promoteur` susceptibles d'influer sur les accès, le statut ou la validité du réseau :

- fonctions du schéma privé : `private.naxa_set_caisse_status`, `private.reactiver_pharmacie`, `private.accrediter_profile`, `private.naxa_grant_privilege` et `private.naxa_revoke_privilege`;
- fonctions publiques : `public.synchroniser_validite_pharmacies`, `public.validites_pharmacies_admin`, `public.validites_promoteurs_admin`, `public.set_garde_for_pharmacy` et `public.reactiver_promoteur`;
- fonctions de validation du dossier : `public.admin_valider_dossier_pharmacie` et `public.admin_valider_dossier_partenaire`.

Le catalogue indique que les fonctions privées listées sont `SECURITY DEFINER`, sans exécution accordée à `anon`, et avec un droit `EXECUTE` observé pour `authenticated` sur plusieurs d'entre elles. Cette observation de privilège SQL ne suffit pas à conclure qu'un utilisateur peut les appeler via l'API PostgREST : l'exposition du schéma privé, les appels indirects et les contrôles internes doivent être vérifiés avant toute conclusion d'exploitabilité.

### 54.2 Garde d'activation des Caisses : portée explicitement documentée

La migration Git `supabase/migration_156_promoteur_caisse_activation_guard.sql` confirme que le trigger `naxa_guard_promoteur_caisse_activation` vise les insertions/mises à jour de profils dont le rôle est `caisse` et dont le statut demandé est actif. Il autorise les désactivations, distingue les opérations sans `auth.uid()` des mutations utilisateur, laisse passer le chemin Admin, puis contrôle pour un Promoteur : statut actif, relation parent-enfant directe, pharmacie active et publiée, lien Promoteur/pharmacie actif et validité commerciale.

Cette garde protège une transition précise — l'activation d'une Caisse — et ne prouve pas à elle seule que toutes les autres transitions de statut, les réactivations de pharmacie ou les révocations de privilèges appliquent les mêmes invariants.

### 54.3 Renouvellement initial et publication : précision apportée par la migration 154

La migration `supabase/migration_154_admin_validate_pharmacy_dossier.sql` montre que la validation initiale du dossier suit une séquence explicite : elle active d'abord la pharmacie tout en gardant `visible_recherche=false`, réactive le lien Promoteur/pharmacie, exécute le provisionnement des privilèges dans la même transaction, puis publie la pharmacie à la dernière étape.

La même fonction refuse seulement le cas où les quatre indicateurs sont déjà simultanément actifs (pharmacie active, visible, lien actif et Promoteur actif). Le message applicatif « dossier déjà actif » ne doit donc pas être interprété comme la preuve qu'aucune autre forme de dossier partiellement désactivé ne peut passer par cette validation. Ce constat complète la section 52 ; il ne constitue pas une reproduction en environnement de la transition.

### 54.4 Limite de vérification et prochaines cibles

Les définitions de plusieurs fonctions privées candidates n'ont pas pu être obtenues dans cette passe par la requête de catalogue utilisée. Aucune fonction métier n'a été appelée. Le présent inventaire sert à définir la suite de l'examen, pas à attribuer un défaut à ces fonctions sans leur corps SQL.

Prochaine vérification ciblée :
1. rapprocher `private.naxa_set_caisse_status` de ses appelants applicatifs et des politiques de mise à jour de `profiles` ;
2. lire le corps et les permissions de `private.reactiver_pharmacie` et `public.synchroniser_validite_pharmacies`, puis vérifier leurs effets sur `actif`, `visible_recherche`, les liens et les privilèges ;
3. déterminer si les tâches d'expiration sont déclenchées par `pg_cron`, un appel externe ou un orchestrateur applicatif ;
4. vérifier les journaux/audits écrits par chaque transition et l'existence d'une trace de motif, d'acteur et d'état avant/après.

Aucune modification fonctionnelle, migration, écriture métier, exécution de test ou opération de déploiement n'a été effectuée.


## 55. Étape suivante — cartographie des pages Administrateur (26 octobre 2026)

Après la consolidation de la passe de corrections, l'étape de cartographie statique a été exécutée directement sur `main`. L'arbre GitHub récursif a retourné `truncated=false` et 18 fichiers `page.tsx` sous `src/app/admin/`. Le composant `src/components/admin/AdminNavigation.tsx` déclare 12 entrées latérales.

Le détail est consigné dans [`docs/audits/CARTOGRAPHIE_PAGES_ADMIN_NAXA_2026-10-26.md`](CARTOGRAPHIE_PAGES_ADMIN_NAXA_2026-10-26.md). Le document cartographie les routes, les accès aux données repérés, la navigation, le layout partagé et les dépendances déléguées. Il met notamment en évidence six pages qui ne sont pas des entrées de premier niveau de la navigation, les pages client-side protégées via le layout parent, la délégation de la page Rappels lots et la coexistence de deux familles de tables documentaires pharmacie.

### Statut
- **Cartographie statique : terminée.**
- **Audit fonctionnel détaillé page par page : étape suivante, non encore terminé.**
- **Tests navigateur, accès direct, autorisations et parcours métier : non exécutés dans cette étape.**
- Aucune branche, PR, migration Supabase, écriture métier ou déploiement n'a été réalisé pendant la cartographie.


## 56. Reprise de l'audit — réconciliation du parcours de paiement Promoteur (27 octobre 2026)

### 56.1 Référence Git vérifiée avant cette mise à jour

- Dépôt : `audreymendomo23-netizen/NAXA`.
- Branche consultée : `main`.
- HEAD observé avant la mise à jour documentaire : `8bf52cd7480662304a67e4021d7092336fc4d043`.
- Arbre GitHub récursif : réponse non tronquée, 1 278 entrées, dont 1 043 blobs; 52 fichiers de migration sous `supabase/migrations/`; 19 fichiers `page.tsx` sous `src/app/admin/` (le relevé précédent de 18 pages est donc à réconcilier avec l'arbre courant).
- État des modifications locales non commitées : non observable par l'API GitHub utilisée.
- Aucune branche, PR, fusion, écriture métier Supabase, exécution de migration ou opération de déploiement n'a été effectuée pendant cette passe.

### 56.2 Changements récents du parcours financier observés dans l'historique

Les commits ci-dessous sont présents dans l'historique consulté de `main`; leur présence confirme l'enregistrement du code, mais ne prouve pas que les migrations correspondantes sont appliquées à Supabase ni que le parcours a été testé de bout en bout.

| Commit | Périmètre constaté |
|---|---|
| `e899c578a98da89323949a36fb69c36c696e3cab` | Soumission d'un règlement par le Promoteur, notifications aux administrateurs et rappels d'échéance J−5 dans une migration. |
| `2aa445cd6e7442bf073c34ffbd7650f63e5c87fe` | Ajout du contrôle serveur exigeant l'attestation de vérification avant confirmation. |
| `d81233ed98efb66258d7a6aa06539c411763a51e` | Ajout de l'attestation visible dans l'interface de confirmation. |
| `1c22c4ca7db307115a7303544d6ff1abea799bd2` | Affichage du nom du Promoteur et des noms des pharmacies rattachées sur le reçu. |
| `8bf52cd7480662304a67e4021d7092336fc4d043` | Révocation des privilèges de l'ancienne RPC de saisie de paiement par l'Administrateur. |

### 56.3 Preuves statiques confirmées dans le code versionné

**Déclaration par le Promoteur.** `src/app/promoteur/paiements/actions.ts` vérifie la session et le rôle Promoteur, le montant entier positif, le canal, le compte payeur, la date non future, le fichier et sa taille maximale de 25 Mio. Les formats codés acceptent PDF, JPEG, PNG, WebP, MP4, WebM et QuickTime/MOV. Le fichier est envoyé dans le bucket privé `preuves-reglements-promoteurs`, puis la RPC `promoteur_soumettre_reglement` est appelée via le client serveur privilégié. En cas d'échec RPC, le code tente de supprimer le fichier envoyé et renvoie une erreur à l'interface.

**Acceptation vidéo.** Les migrations `20261027003000_promoteur_echeance_reminders.sql`, `20261027010000_promoteur_soumet_paiement_manuel.sql` et `20261027012000_include_promoter_in_payment_notifications.sql` contiennent des validations de chemin autorisant explicitement les extensions `mp4`, `webm` et `mov`. La migration `20261027010000_promoteur_soumet_paiement_manuel.sql` configure également des types MIME vidéo autorisés pour le bucket. Le code Admin `src/app/admin/pilotage/reglements/page.tsx` détecte ces extensions et rend une balise vidéo contrôlable ainsi qu'un lien privé temporaire. **Conclusion corrigée :** le code versionné contient une prise en charge explicite des vidéos; le défaut de format SQL évoqué dans les notes précédentes n'est pas confirmé par ces migrations récentes. L'application effective de ces migrations et un test réel d'affichage restent non vérifiés.

**Confirmation administrative.** `src/app/admin/pilotage/reglements/actions.ts` exige un identifiant UUID valide, l'attestation `preuve_verifiee`, un règlement existant au statut `en_attente` et une URL signée de preuve accessible avant d'appeler `admin_confirmer_reglement_promoteur`. L'action de contestation exige un motif de 5 à 500 caractères. Les erreurs sont renvoyées vers des états d'interface dédiés. Ces contrôles statiques ne remplacent pas la vérification de la transaction SQL ni un test des courses concurrentes/doubles soumissions.

**Reçu.** Le commit `1c22c4ca7db307115a7303544d6ff1abea799bd2` ajoute les noms des pharmacies liées au Promoteur dans le reçu, avec un libellé explicite si aucun lien n'est trouvé. La page du reçu n'a pas été retrouvée sous le chemin présumé `src/app/promoteur/paiements/recu/[id]/page.tsx`; son emplacement réel et son comportement complet restent à localiser dans l'inventaire de routes.

**Saisie de paiement par l'Administrateur.** La migration `20261027080000_disable_admin_manual_promoter_payment_entry.sql` révoque les privilèges de `public.admin_enregistrer_reglement_promoteur(...)` pour `public`, `anon`, `authenticated` et `service_role`. C'est une mesure de code versionnée; l'état effectif des privilèges dans la base distante n'a pas été vérifié pendant cette passe.

### 56.4 Rappels à J−5 : code prévu, exécution non démontrée

La migration `20261027003000_promoteur_echeance_reminders.sql` définit `public.generer_rappels_echeance_promoteurs()`, qui cible les abonnements actifs dont l'échéance tombe dans cinq jours et pour lesquels `rappel_5j_envoye_at` est nul. Elle crée une notification pour le Promoteur et une pour chaque Administrateur actif, puis renseigne l'horodatage d'envoi. Elle programme le job `naxa-promoteur-echeance-5j` avec `cron.schedule` à `0 6 * * *`.

- **Preuve directe :** fonction et programmation déclarées dans une migration Git.
- **Non vérifié :** application de la migration en base distante, existence et dernier résultat du job dans `cron.job`, envoi réel des notifications, unicité en cas de concurrence, et affichage sur les deux comptes.
- Le job calcule la date cible à partir de `Africa/Douala`; le calendrier effectif dépend néanmoins de la configuration et de l'état de `pg_cron` dans la base concernée.

### 56.5 Contradiction à préserver : renouvellement administratif vs confirmation d'un paiement

La migration `20261022143000_admin_renouvellement_manuel_audit.sql` définit un renouvellement manuel distinct, qui met à jour convention/abonnement et écrit une trace avant/après sans enregistrer de règlement. Les migrations plus récentes définissent un autre parcours, dans lequel le Promoteur déclare un règlement, puis l'Administrateur confirme après vérification. Il faut conserver cette séparation métier : ne pas substituer `reactiver_promoteur` au renouvellement manuel et ne pas traiter une simple déclaration comme un encaissement vérifié.

Le code applicatif de la page `/admin/pilotage/validite` et l'état live de `admin_renouveler_promoteur` n'ont pas été réconciliés dans cette passe. Une tentative de lecture de `src/app/admin/pilotage/validite/actions.ts` retourne 404 dans le dépôt courant; le chemin réel de l'action reste à retrouver. L'absence de ce chemin exact ne prouve pas que l'action n'existe pas ailleurs.

### 56.6 Registre des points ouverts mis à jour

| ID | Constat / question | Statut | Vérification suivante |
|---|---|---|---|
| PRE-PAY-01 | Application réelle des migrations de soumission, confirmation, vidéo et notifications | Non vérifié côté Supabase | Lire le catalogue distant et comparer signatures, définitions, privilèges et stockage, sans écriture métier. |
| PRE-PAY-02 | Rappels J−5 vers Promoteur et Administrateur | Code prévu; fonctionnement bout en bout non vérifié | Contrôler `cron.job`, exécution et types de notification en lecture seule si l'accès autorisé le permet. |
| PRE-PAY-03 | Confirmation : atomicité, anti-double validation, échéance et reçu | Partiellement vérifié par lecture statique | Lire intégralement la RPC de confirmation et les contraintes/index, puis construire des tests sans données de production. |
| PRE-PAY-04 | Localisation et cohérence de l'action de renouvellement manuel | Ouvert | Rechercher les appelants, routes et RPC réellement référencés dans `main`; comparer avec les migrations et le catalogue live. |
| PRE-PAY-05 | Reçu avec nom du Promoteur et de ses pharmacies | Modification versionnée; test visuel et données non vérifiés | Retrouver la route réelle du reçu et vérifier les états avec et sans pharmacies liées. |
| PRE-PAY-06 | Révocation de l'ancienne RPC de saisie de paiement Admin | Migration versionnée; privilèges live non vérifiés | Inspecter les privilèges effectifs et les appelants restants sans invoquer la RPC. |
| PRE-PAY-07 | Rapport d'audit périmé sur le nombre de pages Admin | Écart d'inventaire à réconcilier | Recalculer le nombre de routes à partir de l'arbre complet et examiner la différence par rapport à la cartographie datée du 26 octobre. |

### 56.7 Limites de cette passe

- Les constats de cette section proviennent du code et des migrations Git consultés; aucune fonction SQL métier n'a été exécutée.
- L'accès au connecteur Supabase n'a pas été disponible dans cette session : la tentative de lister les projets a échoué faute de compte lié admissible. Aucun accès live n'est donc revendiqué.
- Aucun test unitaire, compilation, test navigateur, test de notification ou test de stockage n'a été exécuté.
- Le rapport préliminaire reste ouvert. L'audit détaillé Administrateur n'est pas déclaré commencé sur la seule base de cette réconciliation.


## 57. Réconciliation Supabase distante en lecture seule — 27 octobre 2026

Cette section complète et remplace les limites d'accès Supabase décrites en 56.7 : le connecteur est maintenant accessible en lecture seule. Aucune migration n'a été appliquée et aucune donnée métier n'a été modifiée. Projet consulté : Naxa (eouwtuusnsuxaejsxknf, région eu-west-1, état ACTIVE_HEALTHY). Les projets naxa-ci-replay ne sont pas utilisés pour cette vérification.

### 57.1 Migrations, stockage et privilèges effectifs

- Le registre distant contient 267 migrations. Les dernières migrations recensées incluent promoteur_soumet_paiement_manuel (20261026235235), include_promoter_in_payment_notifications (20261026235759), disable_legacy_admin_payment_entry (20261026235944), promoteur_echeance_reminders (20261027013703) et disable_admin_manual_promoter_payment_entry (20261027063825).
- Le bucket preuves-reglements-promoteurs existe, est privé, limité à 26 214 400 octets et autorise PDF, JPEG, PNG, WebP, MP4, WebM et QuickTime. La configuration distante confirme donc les formats vidéo/image.
- La RPC historique admin_enregistrer_reglement_promoteur(...) existe encore dans le catalogue, mais son exécution est révoquée pour anon, authenticated et service_role.
- La RPC reactiver_promoteur(uuid,text) existe aussi, mais son exécution est révoquée pour anon, authenticated et service_role. La définition live historique reste dangereuse : elle prend la date du jour comme date de paiement, crée une ligne de paiement et réactive le Promoteur ainsi que les pharmacies/profils associés sans exiger de preuve d'encaissement. Ne pas rétablir ses privilèges.

### 57.2 Rappels J−5 : job actif et exécution observée

- Le job naxa-promoteur-echeance-5j existe, est actif et planifié à 0 6 * * *.
- Sa dernière exécution consultée est réussie, le 27 octobre 2026 à 06:00:00 UTC (07:00 à Douala), pour environ 70 ms; le retour indique « 1 row ».
- Cela prouve que le job cron a terminé sans erreur signalée, mais ne prouve pas qu'une notification a été créée pour un Promoteur donné ni qu'elle s'est affichée dans l'interface : la fonction peut avoir traité zéro échéance éligible. Aucun compte ni contenu de notification n'a été modifié pour provoquer un test.

### 57.3 Renouvellement manuel : fonction absente de la base distante

- La fonction public.admin_renouveler_promoteur(uuid,date,text,uuid) est absente du catalogue distant.
- La page src/app/admin/pilotage/validite/page.tsx appelle validites_promoteurs_admin et propose le suivi des règlements, mais ne contient pas de formulaire de renouvellement manuel.
- Le fichier Git supabase/migrations/20261022143000_admin_renouvellement_manuel_audit.sql définit pourtant cette fonction. La migration correspondante n'apparaît pas dans le registre distant consulté : le fichier présent dans Git ne rend donc pas la RPC disponible en base.
- Décision nécessaire avant correction : définir si le renouvellement administratif distinct doit être restauré comme action explicitement auditée, ou si tous les renouvellements doivent exclusivement passer par une déclaration Promoteur puis une confirmation de règlement. Aucune RPC n'a été rétablie.

### 57.4 Risque de périmètre dans la confirmation de paiement

La définition live de admin_confirmer_reglement_promoteur(uuid,uuid) est présente, SECURITY DEFINER, avec search_path vide et exécution accordée à service_role seulement. Elle verrouille le règlement et refuse les statuts autres que en_attente, protégeant contre une double confirmation concurrente sur la même ligne.

Après confirmation, elle met cependant actif=true sur le profil Promoteur, tous ses liens promoteur_pharmacies, toutes les pharmacies liées et les profils rattachés à ces pharmacies. Elle ne distingue pas une désactivation due à l'échéance d'une suspension administrative indépendante. Risque confirmé dans le code live. Correction recommandée : réactiver uniquement les entités explicitement bloquées pour échéance, sans lever une suspension indépendante ni réactiver tous les comptes d'une pharmacie par effet de bord. La portée métier doit être validée avant modification.

L'identifiant de paiement et le reçu sont générés à partir de la date de validation, tandis que date_paiement de la convention est calculée depuis r.paye_le. Le reçu conserve la date déclarée, mais la nouvelle période démarre à la validation. Ce choix doit rester explicite dans le contrat métier.

### 57.5 Reçu et validité : chemins retrouvés, tests absents

- La route réelle du reçu est src/app/promoteur/paiements/[id]/recu/page.tsx. Elle vérifie la session, le rôle Promoteur, l'appartenance du règlement à l'utilisateur et le statut confirmé; elle affiche le nom du Promoteur et les noms des pharmacies rattachées. Le chemin présumé cité en 56.3 était erroné.
- La page de validité marque comme « VALIDE » toute ligne qui n'est pas considérée « à régulariser », ce qui peut inclure une échéance absente ou un statut non actif. Les compteurs distinguent partiellement les échéances configurées, mais le badge de dossier peut être trompeur. Correction UI recommandée : séparer au minimum VALIDE, À RÉGULARISER, NON CONFIGURÉ et SUSPENDU / INACTIF selon les statuts réellement renvoyés par la RPC.
- Le reçu et la page de validité n'ont pas été exécutés dans un navigateur; aucune recette visuelle n'est revendiquée.

### 57.6 Registre actualisé des actions

| ID | Constat | Suite recommandée | Autorisation |
|---|---|---|---|
| PRE-PAY-01 | Migrations de paiement/rappels présentes; bucket privé et types confirmés | Compléter le rapprochement des signatures, contraintes et privilèges sans rejouer les migrations | Lecture seule |
| PRE-PAY-02 | Cron J−5 actif et dernière exécution réussie | Vérifier types de notifications et affichage sans déclencher d'envoi | Lecture seule |
| PRE-PAY-03 | Confirmation de paiement réactive un périmètre trop large | Préparer une migration corrective et des tests SQL qui préservent les suspensions indépendantes | Validation explicite du comportement métier |
| PRE-PAY-04 | RPC de renouvellement manuel absente live et sans formulaire sur la page | Décider entre renouvellement administratif audité et paiement exclusivement vérifié | Validation explicite |
| PRE-PAY-05 | Route du reçu retrouvée, noms Promoteur/pharmacies inclus dans le code | Ajouter/compléter tests de route et cas sans pharmacie | Pas de changement métier |
| PRE-PAY-06 | RPC historique de saisie Admin non exécutable; reactiver_promoteur également non exécutable | Maintenir les privilèges révoqués; inventorier les appelants avant retrait de code mort | Ne pas réactiver |
| PRE-PAY-07 | Badge de validité potentiellement trompeur | Corriger le mapping UI après confirmation des valeurs de statut de la RPC | Validation du mapping métier |

### 57.7 Limites

- Requêtes Supabase limitées à la lecture du catalogue, du registre des migrations, du bucket, des privilèges et des exécutions cron. Aucun paiement, abonnement, profil, lien pharmacie ou notification n'a été créé ou modifié.
- Aucune migration n'a été appliquée, aucune fonction métier n'a été invoquée et aucune notification n'a été forcée.
- Aucun déploiement Vercel n'a été lancé. L'inspection de configuration Vercel ne remplace pas une recette applicative.
- Le préliminaire reste ouvert. Avant l'audit Administrateur page par page, il faut résoudre les décisions PRE-PAY-03, PRE-PAY-04 et PRE-PAY-07, puis publier un bilan de phase préliminaire vérifiable.


## 58. Règle validée et corrections ciblées — confirmation des règlements Promoteur

**Validation métier reçue le 27 octobre 2026 :**
1. Le Promoteur déclare son paiement avec le canal, les références et une preuve.
2. L'Administrateur vérifie l'encaissement réel auprès du canal concerné avant confirmation.
3. La confirmation renouvelle l'abonnement/la convention, mais ne réactive jamais automatiquement une suspension indépendante.
4. Un renouvellement administratif sans paiement vérifié reste une opération distincte et ne doit jamais créer une ligne de paiement ni simuler une date d'encaissement.

### Modifications enregistrées sur `main`

- Migration ajoutée : `supabase/migrations/20261027090000_safe_promoter_payment_reactivation_scope.sql`.
  - Garde les contrôles de rôle administrateur actif, règlement en attente, montant conforme, références de paiement et preuve.
  - Refuse de traiter un abonnement résilié ou une convention résiliée par le flux de confirmation d'un paiement.
  - Renouvelle l'abonnement et la convention, et conserve la trace du paiement vérifié.
  - **Ne réactive plus** `profiles`, `promoteur_pharmacies`, `pharmacies` ni les profils enfants : le schéma observé ne fournit pas de provenance fiable prouvant que leur inactivation résulte exclusivement de l'échéance.
  - Cette migration est une modification versionnée dans Git uniquement. Elle **n'a pas été appliquée** à Supabase Production.
- `src/app/admin/pilotage/validite/page.tsx` : les cartes distinguent désormais « VALIDE », « À RÉGULARISER », « NON CONFIGURÉ », « SUSPENDU / INACTIF » et « À VÉRIFIER ». Un dossier n'est plus affiché comme valide si son abonnement, sa convention, son tarif ou son échéance manque, si le Promoteur est inactif, ou si le statut/échéance ne le justifie pas.

### Preuves et limites

- La définition de la fonction live `admin_confirmer_reglement_promoteur(uuid,uuid)` a été lue en lecture seule. Elle contenait des mises à jour globales d'activité sur le Promoteur, ses liens, les pharmacies liées et les profils enfants. C'est le risque que corrige la migration source.
- Les statuts et contraintes de base consultés autorisent `actif/impaye/resilie` pour l'abonnement et `active/expiree/resiliee` pour la convention. Aucune colonne de provenance d'une suspension administrative indépendante n'a été trouvée sur les profils, pharmacies ou liens Promoteur-pharmacie.
- L'état des données observé par agrégats au moment du contrôle était : 1 abonnement `actif`, 1 convention `active`, 1 profil Promoteur `actif=true`. Aucun dossier métier individuel n'a été modifié.
- Aucun paiement, profil, lien, pharmacie, notification ou abonnement n'a été modifié en production. Aucune migration n'a été appliquée, aucun test navigateur/build/E2E n'a été exécuté et aucun déploiement n'a été déclenché volontairement.
- La confirmation de paiement dans le runtime de production n'est donc **pas encore corrigée** tant que la migration n'est pas appliquée après validation technique et opérationnelle. Les commits sur `main` peuvent déclencher les automatisations configurées par le dépôt; aucune action Vercel n'a été lancée manuellement.

### Point restant avant de déclarer le flux vert

Définir et tester un mécanisme explicite de provenance de blocage si NAXA doit réactiver automatiquement certains profils/pharmacies à l'expiration. Jusqu'à cette preuve, le choix conservateur est de ne pas réactiver leur état par effet de bord. Le renouvellement administratif manuel reste à traiter séparément; sa migration source existante n'est pas présente dans l'historique distant des migrations et la fonction correspondante n'a pas été trouvée dans le catalogue live.


## 59. Renouvellement administratif : même séparation des responsabilités

La migration source `supabase/migrations/20261022143000_admin_renouvellement_manuel_audit.sql` a également été corrigée sur `main` :
- le renouvellement administratif refuse désormais un abonnement `resilie` ou une convention `resiliee`;
- il met à jour uniquement l'échéance et le statut de l'abonnement/convention, sans toucher au registre des paiements ni à `date_paiement`;
- il ne réactive plus le profil Promoteur, les liens Promoteur-pharmacie ou les pharmacies; l'audit conserve l'état réel du profil avant/après.

La page Validité a aussi reçu une correction de synthèse : elle affiche séparément les dossiers valides et actifs, les dossiers non configurés et les profils inactifs/résiliés.

**Important :** cette fonction de renouvellement administratif reste une migration source non constatée dans le registre de migrations live, et aucune interface de renouvellement manuel n'a été ajoutée dans cette étape. Ni cette migration ni celle de confirmation de paiement n'ont été appliquées à Supabase Production. La correction du code source est commise sur `main`, mais le comportement de production reste non vérifié et ne peut pas être déclaré vert avant application contrôlée et tests.

## 60. Audit statique de la règle métier SM-01 — suspension disciplinaire Promoteur (27 octobre 2026)

**Périmètre autorisé :** lecture du code source de `main` et documentation des écarts. Aucun code applicatif, aucune migration SQL et aucune donnée métier n'ont été modifiés. Aucun test, build, appel RPC métier ou déploiement n'a été lancé dans cette passe.

### 60.1 Conclusion exécutive

La règle métier SM-01 est validée par l'utilisateur : motif « faute », périmètre Promoteur et pharmacies rattachées, durée indéterminée, observations non renseignées, blocage des pharmacies sur la marketplace, notification au Promoteur, journal d'audit avant/après, annulation automatique des réservations en attente ou en préparation, exclusion des réservations déjà prêtes au retrait, et levée uniquement sur décision explicite d'un Administrateur habilité.

**État technique constaté : la règle SM-01 n'est pas implémentée dans les surfaces Administrateur examinées.** Aucun bouton/action dédié de suspension disciplinaire du Promoteur n'a été trouvé dans les pages et actions Admin parcourues. Les statuts commerciaux et les booléens d'activité existants ne suffisent pas à distinguer une suspension pour faute d'un blocage dû à l'échéance.

### 60.2 Surfaces Administrateur examinées

- `src/app/admin/promoteurs/actions.ts` : expose `mettreAJourPiecesRecues` et `validerDossierPharmacie`. Ces actions gèrent les pièces et la validation de dossier; aucune action de suspension ou de levée disciplinaire n'y apparaît.
- `src/app/admin/promoteurs/page.tsx` : liste les dossiers de pharmacies et de partenaires, affiche des statuts de dossier et permet d'ouvrir les dossiers; aucun contrôle SM-01 n'y a été trouvé.
- `src/app/admin/actions.ts` : l'action de création de pharmacie a été recensée, sans action de suspension du Promoteur identifiée.
- `src/app/admin/pharmacies/[id]/actions.ts` et `src/app/admin/pharmacies/[id]/page.tsx` : gèrent le dépôt/la consultation/la décision documentaire et l'activation du service Bébé & Maman. La fiche lit `profiles.actif`, `promoteur_pharmacies.actif`, `pharmacies.actif` et `pharmacies.visible_recherche`, mais ne présente pas de décision disciplinaire Promoteur.
- `src/app/admin/page.tsx` : lit les pharmacies, les indicateurs de validité et les dernières entrées de `audit_log`; aucun parcours de suspension SM-01 n'y apparaît.

Cette conclusion porte sur les surfaces lues et les chemins retrouvés, pas sur une preuve absolue concernant chaque ligne de l'ensemble du dépôt ou le schéma distant complet.

### 60.3 États existants et séparation manquante

- Le code Promoteur consulte `profiles.actif`, l'état des rattachements `promoteur_pharmacies.actif`, l'état et la visibilité marketplace de `pharmacies`, ainsi que les états commerciaux de `abonnements_promoteurs` et `conventions_promoteurs`.
- `src/lib/promoteur-access.ts` calcule notamment un blocage commercial à partir de `abonnements_promoteurs.bloque_le`, des statuts d'abonnement/convention et des échéances. Le contrôle d'accès ne constitue pas à lui seul un état disciplinaire séparé.
- La migration source `supabase/migrations/20261027090000_safe_promoter_payment_reactivation_scope.sql` conserve la mise à jour de l'abonnement et de la convention et les traces de paiement/notification/audit, mais ne réactive pas les profils, liens Promoteur-pharmacie ni pharmacies. Cela limite un effet de bord de réactivation commerciale, sans fournir encore un workflow de suspension pour faute.
- Les fonctions de paiement et de renouvellement auditées précédemment utilisent `notifications` et/ou `journal_admin`; le tableau de bord Admin lit `audit_log`. Ces mécanismes génériques existants ne prouvent pas qu'un événement SM-01 spécifique, son périmètre et ses conséquences sont enregistrés.

**Écart SM01-01 — critique :** aucun statut disciplinaire autonome, aucune action Admin dédiée et aucune levée explicite SM-01 n'ont été identifiés dans les surfaces examinées. Réutiliser uniquement `profiles.actif=false` ou `pharmacies.actif=false` risquerait de confondre discipline, validité commerciale et état propre de la pharmacie.

### 60.4 États réels des réservations et ambiguïté de correspondance

Deux cycles distincts existent dans le code et ne doivent pas être confondus :

1. **Réservations de pharmacies — table `reservations`** :
   - `src/app/reservation/[id]/page.tsx` affiche les statuts `en_attente`, `confirmee`, `payee`, `retiree`, `expiree` et `annulee`.
   - `src/app/pharmacie/gestionnaire-stock/reservations/page.tsx` traduit `en_attente` en « À confirmer », `confirmee` en « Confirmée · à préparer », `payee` en « Payée · retrait à confirmer », et `retiree` en « Retirée ».
   - Les migrations `supabase/migration_160_reservation_transition_guard.sql` et `supabase/migrations/20261024203000_marketplace_hold_reservation_alignment.sql` encadrent les transitions et la réservation du stock. Le cycle de réservation standard n'expose pas, dans les mappings lus, un statut explicite `en_preparation` ou `prete_au_retrait`.

2. **Réservations d'autres univers — table `universe_reservations`** :
   - `src/app/partenaire/reservations/actions.ts` utilise les statuts `requested`, `confirmed`, `ready` et `picked_up`.
   - Le statut `ready` existe dans ce cycle partenaire distinct. Il ne doit pas être appliqué par analogie aux réservations de pharmacies sans vérification du périmètre fonctionnel.

**Écart SM01-02 — bloquant avant implémentation :** la règle validée demande d'annuler les réservations « en attente ou en préparation » et d'exclure celles « prêtes au retrait », mais le cycle standard des pharmacies n'a pas de correspondance explicite pour ces deux derniers états dans les mappings examinés. `confirmee` est libellé « à préparer » (pas « en préparation »), et `payee` est libellé « retrait à confirmer » (pas explicitement « prête au retrait »). Il ne faut donc pas assimiler automatiquement ces états sans décision métier complémentaire fondée sur les transitions et le fonctionnement de la caisse.

### 60.5 Annulation, stock, notification et audit

- `src/app/pharmacie/gestionnaire-stock/actions.ts` appelle la RPC `gestionnaire_stock_reservation_annuler` et vérifie le résultat serveur avant d'afficher le succès. Le commentaire indique que la RPC vérifie le périmètre pharmacie, verrouille la réservation, contrôle la transition et restaure le stock selon les règles existantes.
- `supabase/migration_160_reservation_transition_guard.sql` prévoit une restitution du stock lors d'une annulation/expiration et interdit notamment le retrait avant paiement. Les migrations de cycle `20261024193000_reservation_cycle_dependencies.sql` et `20261024201000_reservation_cycle_dependencies_240.sql` gèrent l'expiration et les rappels d'expiration à 30 minutes; ce ne sont pas des notifications de suspension disciplinaire.
- `src/app/reservation/[id]/page.tsx` lit `reservation_statut_historique` pour la chronologie client, tandis que `src/app/admin/page.tsx` lit `audit_log` pour les dernières activités. Leur lecture ne prouve pas qu'une annulation massive déclenchée par SM-01 serait journalisée avec l'identité de l'administrateur, le motif disciplinaire, les états avant/après et la liste des réservations touchées.
- Aucun flux de notification de suspension du Promoteur ni de notification client spécifique à l'annulation en cascade SM-01 n'a été trouvé dans les actions Admin examinées.

### 60.6 Points à résoudre avant toute implémentation

| ID | Point | État | Critère avant développement |
|---|---|---|---|
| SM01-01 | Suspension disciplinaire indépendante de l'état commercial | Écart confirmé dans les surfaces examinées | Définir un état/action disciplinaire explicite et sa séparation des statuts compte, pharmacie, abonnement et convention. |
| SM01-02 | Correspondance des statuts de réservation | Bloquant | Confirmer comment le cycle pharmacie représente « en préparation » et « prête au retrait »; ne pas confondre avec `universe_reservations.ready`. |
| SM01-03 | Blocage marketplace des pharmacies liées | Non implémenté dans les actions Admin examinées | Définir comment bloquer la visibilité sans écraser l'état antérieur ni compromettre une réactivation commerciale future. |
| SM01-04 | Annulation automatique en lot et stock | Non implémenté pour SM-01 | Définir l'atomicité, l'idempotence, la restitution exacte du stock, le traitement des erreurs partielles et la reprise. |
| SM01-05 | Notification Promoteur et information des clients | Non implémenté pour SM-01 dans les surfaces examinées | Définir les destinataires, le contenu, l'état d'envoi et le comportement en cas d'échec. |
| SM01-06 | Audit avant/après | Non démontré pour SM-01 | Tracer l'admin auteur, le motif « faute », le périmètre, la durée indéterminée, les états avant/après, les réservations annulées, les erreurs et la levée. |
| SM01-07 | Réactivation explicite et sans réactivation en bloc | Règle métier validée, action non identifiée | Réactiver uniquement après décision habilitée, sans restaurer les pharmacies bloquées pour un autre motif ni créer de réservation annulée. |

### 60.7 Limites et état de la vérification

- Audit statique du code source de `main` sur les fichiers indiqués; les contenus et mappings ci-dessus ont été lus directement.
- Aucun test unitaire/SQL, build, test navigateur, appel RPC métier ou test de notification n'a été exécuté.
- Aucune migration n'a été appliquée et aucune donnée de production n'a été modifiée.
- Aucun déploiement n'a été lancé volontairement. Les commits documentaires sur `main` peuvent toutefois être soumis aux automatisations déjà configurées dans le dépôt.
- **Conclusion : SM-01 est validée métier, mais non implémentée et non testée.** Le blocage technique prioritaire est la correspondance des états du cycle de réservation pharmacie avant de traduire la règle en opérations automatiques.


### 60.8 Vérification complémentaire des gardes SQL et du stock — 27 octobre 2026

Les définitions SQL source suivantes ont été relues sur `main` : `supabase/migration_160_reservation_transition_guard.sql`, `supabase/migration_195_gestionnaire_stock_reservation_confirmer.sql`, `supabase/migration_201_stock_reservation_confirmation_allocation.sql`, `supabase/migration_203_stock_reservation_cancel_role_guard.sql`, `supabase/migration_209_reservation_expiry_stock_restore.sql`, `supabase/migrations/20261024203000_marketplace_hold_reservation_alignment.sql`, `supabase/migrations/20261024210000_reservation_ticket_rpc_unified_cron.sql` et `supabase/migrations/20261024180000_marketplace_ticket_lifecycle_orchestrator.sql`.

**Transition réelle et risque métier**
- `private.set_reservation_status` autorise actuellement `en_attente → confirmee/payee/annulee/expiree`, `confirmee → payee/annulee/expiree`, puis `payee → retiree`. Il n'existe pas de transition dédiée « en préparation » ou « prête au retrait » dans cette garde.
- La RPC `gestionnaire_stock_reservation_annuler` verrouille la réservation (`FOR UPDATE`), vérifie le mode `reservation`, le périmètre pharmacie et le rôle autorisé, puis n'accepte que `en_attente` ou `confirmee`. C'est une garde individuelle, pas un mécanisme SM-01 de suspension/annulation en lot.
- La RPC de confirmation stock n'accepte que `en_attente`; elle ne crée donc pas, à elle seule, un état supplémentaire de préparation.
- Le cycle standard marque `payee` avant `retiree`. Les contrôles du ticket POS vérifient notamment le lien à une vente payée. **Il serait dangereux de traiter automatiquement tout statut `payee` comme une réservation à annuler**, car ce statut correspond au paiement enregistré et le parcours prévoit ensuite le retrait.

**Stock : nuance importante entre holds récents et anciennes réservations**
- La migration de hold récente crée des réservations sans débit physique immédiat (`stock_decremented=false`, `stock_restored=false`) et réserve virtuellement les quantités pour le contrôle de disponibilité.
- La fonction `restore_stock` vérifiée dans la migration d'orchestration retourne sans mouvement si la réservation a déjà été consommée par une vente, si le stock n'a pas été décrémenté, ou si la restitution a déjà été effectuée. Pour les réservations historiques ayant réellement décrémenté le stock, elle vérifie les lignes, verrouille le stock et restitue les allocations de lots avant de marquer le stock restauré.
- La restitution est appelée depuis la transition vers `annulee`/`expiree`; la migration d'expiration encadre aussi chaque réservation dans un bloc d'exception afin qu'un dossier incohérent n'annule pas tout le lot cron et soit signalé pour reprise.
- Il ne faut donc ni faire un `UPDATE statut='annulee'` en masse ni ajouter une seconde restauration manuelle du stock. Le futur traitement SM-01 devra réutiliser une opération serveur transactionnelle compatible avec ces gardes, et journaliser explicitement les dossiers réussis/échoués.

**Décision technique tirée de ces preuves**
1. Le cycle standard ne contient pas de statut explicite « en préparation » ni « prête au retrait »; l'interface appelle `confirmee` « Confirmée · à préparer » et `payee` « Payée · retrait à confirmer ». Ce libellé ne prouve pas une correspondance métier plus précise.
2. La règle métier validée (« annuler en attente/en préparation, préserver prêt au retrait/exécuté ») ne peut pas encore être traduite sans risque en simple liste de statuts existants. Le point à résoudre n'est plus seulement une absence de libellé UI : la garde SQL et le parcours POS doivent être cohérents avec la définition de ces états.
3. Avant d'implémenter SM-01, il faut définir explicitement si `confirmee` est l'état qui doit être annulé (ou s'il existe une sous-étape réelle de préparation ailleurs dans le parcours pharmacie), et identifier l'état serveur exact qui signifie « prêt au retrait ». Il faut préserver `payee` et `retiree` jusqu'à décision documentée contraire, car les éléments consultés lient `payee` à une vente/ticket POS payé.
4. L'opération en lot doit être conçue transactionnellement/idempotemment, avec verrouillage par réservation, filtre de périmètre Promoteur-pharmacies, décompte des statuts ciblés, journal des états avant/après et erreurs, notifications séparées avec reprise, et aucune modification de réservation déjà consommée.

### 60.9 Statut après vérification complémentaire

- **Avancée obtenue :** les gardes SQL et les règles de restitution stock du cycle pharmacie ont été vérifiées dans les fichiers source de `main`; les risques d'une annulation massive naïve sont maintenant explicités.
- **Toujours bloquant :** correspondance métier/technique de « en préparation » et « prête au retrait » dans le cycle pharmacie. Aucune décision de mapping n'a été inventée.
- **Modifications de ce passage :** documentation seulement, si ce complément est commité. Aucun code applicatif, migration SQL ni donnée de production n'est modifié par cet audit.
- **Vérifications non effectuées :** aucun SQL exécuté contre Supabase, aucune migration appliquée, aucun test automatisé, build, navigateur ou appel RPC métier; l'analyse porte sur les définitions source lues.


### 60.10 Parcours de caisse Marketplace vérifié — état du paiement et du retrait

Lecture complémentaire de `src/components/pharmacie/CaisseRetraitsMarketplace.tsx` et de `src/app/pharmacie/caisse/page.tsx` sur `main`.

Le parcours de caisse donne une preuve plus précise du sens des statuts que le seul libellé de la page de réservation :

- La liste de caisse charge les réservations Marketplace pharmacie aux statuts `en_attente`, `confirmee` et `payee`.
- L'encaissement Marketplace n'accepte que `confirmee` avec paiement non encore effectué, réservation non expirée et code de paiement vérifié. L'opération appelle la RPC `vente_reservation_encaisser`; la caisse saisit un paiement effectivement reçu par la pharmacie.
- Après paiement, le parcours affiche `payee` comme « Payée · retrait à confirmer ». La confirmation du retrait n'accepte que `payee` avec `paiement_statut='effectue'` et effectue la transition serveur vers `retiree`.
- Le ticket client et le parcours POS relient donc `payee` à une vente/payement enregistré; `retiree` représente le retrait confirmé.

**Correspondance opérationnelle démontrée par le code consulté :**
- `en_attente` : en attente de confirmation par la pharmacie.
- `confirmee` : réservation confirmée, admissible à l'encaissement; la caisse ne la considère pas encore payée.
- `payee` : paiement POS enregistré, retrait physique pas encore confirmé.
- `retiree` : retrait confirmé.

Le code ne démontre toujours pas un sous-état serveur autonome « en préparation » ni un sous-état « prête au retrait » distinct de `payee`. La règle SM-01 parle de l'état de préparation opérationnelle, mais le système actuel expose principalement l'étape de paiement puis la confirmation du retrait. Il ne faut pas prétendre que `confirmee` signifie littéralement « préparation commencée » : le libellé indique « paiement à constater » dans la caisse.

**Conséquence de sécurité pour SM-01 :** les réservations `payee` doivent être préservées par défaut, puisqu'un paiement POS est enregistré et que le parcours attend ensuite la confirmation du retrait. Les `retiree` sont terminales et doivent également être préservées. `en_attente` est clairement annulable selon la règle SM-01. `confirmee` reste le cas à arbitrer avant l'automatisation : c'est l'état confirmé et non encore encaissé, mais aucune trace examinée ne prouve qu'il correspond à une préparation déjà commencée plutôt qu'à une réservation simplement confirmée et en attente de paiement.

Le chemin sûr à implémenter ensuite est de conserver les statuts POS actuels, de cibler avec certitude `en_attente`, et de ne pas inclure `confirmee` dans l'annulation automatique tant que son équivalence avec « en préparation » n'est pas explicitement établie. Si la règle métier exige d'annuler aussi les réservations en préparation, il faudra définir une condition serveur observable (état, horodatage ou événement de préparation) plutôt que de déduire cet état d'un statut ambigu.

### 60.11 État d'avancement après lecture de la caisse

- La signification de `payee` et `retiree` est désormais appuyée par le parcours de caisse réel dans le code source.
- Le blocage est réduit à une question précise : le système dispose-t-il d'un signal fiable indiquant qu'une réservation `confirmee` est effectivement « en préparation », ou ce statut signifie-t-il seulement confirmée/en attente de paiement ?
- Aucune règle de suspension, annulation, notification ni restauration du stock n'a été implémentée dans cette passe. Aucun test, build, appel RPC ou requête SQL en production n'a été exécuté.


### 60.12 Signal de préparation : contrôle du poste Gestionnaire de stock — 27 octobre 2026

Fichiers relus sur `main` : `src/app/pharmacie/gestionnaire-stock/reservations/page.tsx`, `src/app/pharmacie/gestionnaire-stock/actions.ts`, `supabase/migration_195_gestionnaire_stock_reservation_confirmer.sql`, `supabase/migration_201_stock_reservation_confirmation_allocation.sql` et `supabase/migration_203_stock_reservation_cancel_role_guard.sql`.

**Nouveau constat : le bouton métier ne constitue pas un état de préparation persistant.**
- Le poste Gestionnaire de stock affiche `en_attente` comme « À confirmer » et `confirmee` comme « Confirmée · à préparer ».
- Le bouton affiché pour `en_attente` est « Confirmer disponibilité et préparer ». Son action appelle `gestionnaire_stock_reservation_confirmer`.
- Cette RPC contrôle le périmètre, les droits, l'expiration, les lignes et les allocations de stock/lots, puis effectue uniquement la transition `en_attente → confirmee` via `private.set_reservation_status`.
- La RPC ne crée pas de statut de préparation, d'horodatage de début de préparation, ni d'événement spécifique permettant de prouver qu'une préparation physique a effectivement commencé.
- Le libellé de succès « le dossier est transmis au parcours de préparation et de retrait » confirme un passage de workflow, mais pas l'existence d'une étape métier distincte et persistée « en préparation ».

**Conséquence pour le mapping SM-01 :**
1. Le système a bien une action utilisateur orientée vers la préparation, mais le modèle persistant fusionne confirmation de disponibilité et étape « à préparer » dans `confirmee`.
2. Il n'est donc pas prouvé qu'une réservation `confirmee` ait commencé à être préparée. La traiter comme « en préparation » serait une hypothèse, pas un fait démontré par le modèle.
3. Aucune preuve d'un état serveur explicite « prête au retrait » n'a été trouvée dans le cycle pharmacie. `payee` signifie paiement POS enregistré et retrait encore à confirmer; il doit rester protégé. `retiree` est terminal et protégé.
4. Pour appliquer la règle validée sans ambiguïté, il faudra soit une décision métier explicite sur la correspondance de `confirmee`, soit introduire une étape persistée et auditée de préparation (avec une transition serveur autorisée, un horodatage/événement fiable et une distinction nette avec « prête au retrait »). Ce choix relève du modèle métier et ne doit pas être improvisé pendant l'automatisation disciplinaire.
5. L'action SM-01 devra s'appuyer sur une RPC serveur sécurisée, avec verrouillage, idempotence, contrôle du périmètre Promoteur/pharmacies, restitution de stock via le mécanisme existant, journal avant/après et suivi des notifications. Pas d'UPDATE direct en masse.

**État de vérification :** lecture statique des fichiers source uniquement. Aucun test, build, appel RPC, SQL de production, migration ou déploiement n'a été lancé. Aucun code métier n'a été modifié dans cette étape.


### 60.13 Historique des statuts et distinction avec le cycle de livraison

La lecture de `supabase/migration_189_reservation_history_expiry_alert.sql` et de `src/app/reservation/[id]/page.tsx` apporte deux précisions :

- La table `reservation_statut_historique` conserve `ancien_statut`, `nouveau_statut`, `acteur_id` et `cree_le`. Le trigger journalise la création et chaque changement de `reservations.statut`; il ne journalise pas à lui seul le motif disciplinaire, le périmètre de suspension, les décisions SM-01 ou la liste des résultats d'une opération de suspension.
- Le journal existant peut aider à reconstituer la chronologie d'une réservation, mais il ne prouve pas qu'une préparation physique ait commencé : il journalise le changement de statut global, pas une action dédiée « début de préparation ».
- La page de détail contient aussi un dictionnaire `DELIVERY` avec un statut `preparation`, mais celui-ci est associé au cycle de commande/livraison (`commande_statut`), distinct de `reservations.statut` pour les réservations avec retrait. Il serait incorrect d'utiliser ce libellé de livraison comme preuve que le cycle Marketplace avec retrait dispose d'un état « en préparation ».

**Conclusion consolidée :** aucun signal fiable et dédié de préparation physique n'a été établi dans le cycle de réservation pharmacie avec retrait. Le bouton « Confirmer disponibilité et préparer » fait passer `en_attente` à `confirmee`; le journal général trace cette transition, mais pas le début effectif d'une préparation. Les états de livraison ne peuvent pas être transposés au cycle retrait. Le mapping SM-01 reste bloqué jusqu'à une décision métier explicite ou à l'ajout ultérieur d'un état de préparation persistant, sans implémenter ce changement dans le cadre de cet audit.

**Limites :** analyse statique de fichiers source. Aucun SQL, RPC, test automatisé, build, déploiement ou accès aux données de production n'a été exécuté.


### 60.14 Séparation obligatoire entre suspension disciplinaire et blocage commercial de l’abonnement — 27 octobre 2026

Fichiers relus sur `main` :
- `src/lib/promoteur-access.ts`
- `src/app/pharmacie/suspendue/page.tsx`
- `supabase/migration_133_promoteur_validite_canonique.sql`
- `supabase/migration_144_promoteur_subscription_coherence.sql`
- `supabase/migrations/20261026224500_promoteur_reglement_manuel_confirmation_reactivation.sql`
- `supabase/migrations/20261027010000_promoteur_soumet_paiement_manuel.sql`

**Constat de sécurité important : le mécanisme commercial existant n'est pas un mécanisme de suspension disciplinaire réutilisable tel quel.**

1. L'accès Promoteur distingue déjà la validité de l'abonnement, la cohérence convention/abonnement, l'état actif du profil et l'existence d'un réseau de pharmacies opérationnel. La page « Pharmacie temporairement suspendue » explique actuellement un blocage lié à la validité mensuelle.
2. La confirmation d'un règlement commercial remet l'abonnement et la convention à l'état actif, efface `bloque_le`, renseigne `reactive_le`/`reactive_par`, réactive le profil Promoteur et peut réactiver les rattachements et pharmacies associés.
3. Si une suspension disciplinaire SM-01 était encodée uniquement au moyen de `profiles.actif`, `pharmacies.actif`, `promoteur_pharmacies.actif` ou du blocage commercial de l'abonnement, le chemin de renouvellement pourrait la lever involontairement lors d'une confirmation de paiement. Cela contredirait la règle validée selon laquelle paiement/renouvellement ne lève jamais une sanction disciplinaire.
4. Il faut donc modéliser et vérifier un état disciplinaire distinct du cycle commercial, avec motif, périmètre, acteur, date, journal avant/après et décision explicite de levée par un Administrateur habilité. Les contrôles d'accès et la visibilité marketplace doivent appliquer les deux dimensions de façon cumulative : l'abonnement valide ne doit pas neutraliser une sanction disciplinaire.
5. La réactivation commerciale devra préserver toute suspension disciplinaire encore active. Inversement, la levée disciplinaire ne devra pas rendre opérationnel un Promoteur dont l'abonnement reste bloqué ou expiré.
6. La portée disciplinaire confirmée inclut le Promoteur et toutes ses pharmacies rattachées; elle bloque l'accès marketplace de ces pharmacies. Les réservations doivent être traitées via le workflow serveur audité défini dans les sections précédentes, sans supprimer données, stocks, historiques ni preuves financières.

**Conséquence sur l'ordre d'implémentation :** avant de coder l'action disciplinaire, cartographier chaque point de contrôle d'accès qui autorise Promoteur, pharmacie et visibilité marketplace, puis définir le prédicat commun qui combine validité commerciale et suspension disciplinaire. Ajouter ensuite le chemin d'administration et le journal d'audit. Enfin, traiter les réservations par transitions atomiques et notifications idempotentes. Ne pas utiliser la réactivation commerciale comme procédure de levée disciplinaire.

**État de vérification :** lecture statique des fichiers source et migrations du dépôt. Aucun code métier ou SQL n'a été modifié; aucune migration, requête de production, test automatisé, build ou déploiement n'a été exécuté. Cette conclusion est une analyse de risque du code versionné, pas une validation d'environnement déployé.


## 60.15 — Cartographie initiale des contrôles d’accès et de visibilité Marketplace

**Référence examinée :** commit `cb7f0fbe8a9c1b602bbbba7171c550e17597b2e5` sur `main`. Lecture statique des fichiers versionnés; aucune donnée de production interrogée.

### A. Middleware Next.js — authentification, mais pas de suspension disciplinaire
Fichier : `src/middleware.ts`.

Le middleware protège les préfixes applicatifs, vérifie la session Supabase, puis lit le rôle et quelques attributs de profil. La requête du profil ne sélectionne pas `actif`, `pharmacie_id`, ni un éventuel état disciplinaire. Après les vérifications de profil incomplet et d’âge, il retourne la réponse sans garde générale sur l’état actif du compte.

**Constat borné :** le middleware n’applique pas, à lui seul, de garde disciplinaire commune. Cela ne prouve pas qu’aucune page ou RPC ne fait une vérification complémentaire; celles-ci doivent être cartographiées séparément.

### B. Accès Promoteur — contrôles commerciaux et état opérationnel
Fichier : `src/lib/promoteur-access.ts`.

Le chargeur vérifie le rôle Promoteur, récupère le profil avec `actif`, les rattachements `promoteur_pharmacies.actif`, les pharmacies avec `actif` et `visible_recherche`, ainsi que convention et abonnement. Il calcule notamment le blocage commercial, la cohérence contractuelle et l’existence d’un réseau opérationnel. Aucun champ de suspension disciplinaire n’est lu dans cette fonction.

Le layout `src/app/pharmacie/promoteur/layout.tsx` masque la navigation standard lorsque `shouldShowAccessStatus` est vrai. Cette porte d’entrée est donc principalement fondée sur l’état commercial/opérationnel existant; elle ne démontre pas un verrou disciplinaire indépendant.

**Risque à vérifier avant implémentation :** si une suspension disciplinaire est ajoutée uniquement au profil ou aux indicateurs actifs existants, le renouvellement commercial déjà observé peut rétablir ces indicateurs sans décision disciplinaire de levée.

### C. Espace opérationnel pharmacie — vérifications côté client
Fichier : `src/app/pharmacie/page.tsx`.

Le composant charge le profil courant et contrôle `profiles.actif) et le rôle. Pour un Promoteur, il vérifie aussi le rattachement actif à la pharmacie demandée, puis `pharmacies.actif` et `pharmacies.visible_recherche`. Il ne consulte pas d’état disciplinaire distinct dans ce parcours.

**Limite de sécurité :** ces contrôles sont exécutés dans le client et ne remplacent pas une autorisation côté serveur. Les appels RPC et politiques RLS qui protègent les mutations doivent porter les gardes autoritatives; une simple redirection ou désactivation d’interface ne suffit pas.

### D. Recherche publique et disponibilité partenaires
Fichiers : `src/app/recherche/page.tsx`, `src/components/Recherche.tsx`, `src/app/api/medicaments/recherche/route.ts`.

La page de recherche appelle une API de catalogue. Dans `realPartnerAvailability`, la disponibilité agrégée est filtrée sur `pharmacies.actif = true`, `pharmacies.visible_recherche = true`, absence d’archivage, quantité positive et péremption admissible. Les conditions explicites visibles dans cette requête n’incluent pas de suspension disciplinaire Promoteur ni d’état disciplinaire de la pharmacie.

**Constat borné :** le filtre de disponibilité montré dans cette fonction s’appuie sur les indicateurs de publication et de stock. Il reste à examiner les autres sources de données et les politiques SQL/RLS pour déterminer si une autre garde s’applique en amont.

### E. SQL — distinguer accès opérationnel et publication Marketplace
Migration : `supabase/migration_193_pharmacien_operational_access_independent_marketplace.sql`.

Cette migration documente explicitement que le service Pharmacien interne dépend du profil actif et de la pharmacie active, mais pas de `visible_recherche`. C’est une séparation fonctionnelle voulue : masquer une pharmacie de la Marketplace ne doit pas automatiquement supprimer son accès interne aux opérations autorisées.

**Conséquence métier :** une sanction SM-01 ne doit pas être assimilée à un simple retrait de publication Marketplace ni à une désactivation générale indifférenciée. Il faut traduire précisément le périmètre validé : Promoteur et pharmacies rattachées bloqués sur la Marketplace, tout en préservant les données, historiques et preuves. Les accès internes qui ne sont pas inclus dans le périmètre de la sanction ne doivent pas être coupés par effet de bord sans décision métier explicite.

### F. Points à poursuivre dans la cartographie
1. Examiner les fonctions SQL/RPC qui listent ou servent les offres Marketplace et les policies RLS de `pharmacies`, `stocks`, `promoteur_pharmacies` et réservations.
2. Examiner les procédures de règlement/réactivation et confirmer toutes les tables et champs qu’elles modifient.
3. Inventorier les opérations sensibles accessibles directement par RPC afin qu’une garde serveur soit appliquée même en contournant l’interface.
4. Concevoir ultérieurement un prédicat disciplinaire indépendant et partagé par les contrôles pertinents; ne pas l’implémenter avant instruction distincte.
5. Maintenir les règles réservation déjà établies : ne pas annuler `payee` ni `retiree`; toute annulation autorisée doit passer par les transitions/RPC existantes avec traitement atomique, stock et audit.

**Statut :** analyse statique uniquement. Aucun code métier ou SQL applicatif modifié; aucune migration exécutée, aucune requête de production, aucun test/build ni déploiement effectué.


## 60.16 — Synthèse de clôture de l’audit SM-01 : couverture 360° et décision de sortie

Cette section clôt la **phase d’audit statique et de cadrage technique** SM-01. Elle ne signifie pas que la suspension disciplinaire est implémentée ou prête à être déclarée « verte ».

### 1. Chaîne d’accès couverte

| Couche | Preuve versionnée examinée | Conclusion pour SM-01 |
|---|---|---|
| Middleware Next.js | `src/middleware.ts` | Authentifie les routes protégées mais n’applique pas de garde disciplinaire commune. |
| Espace Promoteur | `src/lib/promoteur-access.ts`, `src/app/pharmacie/promoteur/layout.tsx` | L’état exposé est fondé sur le contrat, l’abonnement, le profil et le réseau opérationnel; aucun état disciplinaire indépendant n’est consulté. |
| Opérations pharmacie | `src/app/pharmacie/page.tsx` | Vérifications de profil/rattachement/activité-publication côté client; elles ne suffisent pas comme barrière serveur. |
| Recherche publique | `src/app/api/medicaments/recherche/route.ts` | Disponibilités filtrées par activité, visibilité, archivage, stock et péremption; pas de garde disciplinaire explicite dans la requête examinée. |
| Disponibilité SQL | `supabase/migration_210_marketplace_sellable_stock.sql` | La fonction publique `marketplace_offre_stock_disponible` vérifie activité et visibilité Marketplace, mais aucun état disciplinaire Promoteur n’est évalué. |
| Création de réservation | `supabase/migrations/20261024203000_marketplace_hold_reservation_alignment.sql`, `supabase/migrations/20261026210000_harden_payment_reactivation_reservation_search_paths.sql` | Le contrôle observé vérifie notamment que la pharmacie est active; l’extrait n’intègre pas de sanction disciplinaire distincte. |
| Transition réservation | `supabase/migration_160_reservation_transition_guard.sql` | Transitions métier explicites, verrouillage de réservation, contrôle de périmètre et restitution pour annulation/expiration. Pas de contrôle disciplinaire dédié dans cette fonction. |
| Annulation par le gestionnaire | `supabase/migration_203_stock_reservation_cancel_role_guard.sql` | Autorise seulement `en_attente` ou `confirmee`, puis délègue à la transition métier; préserve les états payés/retirés. |
| Consommation et lots | `supabase/migration_211_pos_marketplace_sellable_stock.sql`, migrations de cycle Marketplace 239/242/243 | Les mouvements de stock et le cycle de réservation disposent de gardes spécialisées; ils ne constituent pas, en eux-mêmes, une barrière disciplinaire générale. |
| Paiement abonnement Promoteur | `supabase/migrations/20261026224500_promoteur_reglement_manuel_confirmation_reactivation.sql`, `supabase/migrations/20261027010000_promoteur_soumet_paiement_manuel.sql` | La confirmation du paiement réactive l’abonnement/la convention et met des profils/pharmacies à l’état actif. Cette réactivation doit être rendue orthogonale à la sanction disciplinaire avant de mettre SM-01 en production. |
| Données et audit | Tables de réservation, tickets, journaux et notifications visibles dans les migrations examinées | Les données métier doivent être conservées. L’audit commercial existant n’est pas équivalent au journal disciplinaire avant/après requis par SM-01. |

### 2. Règles de réservation retenues

- `en_attente` : annulation automatique prévue par la règle SM-01, par le chemin serveur sécurisé.
- `confirmee` : le code actuel ne prouve pas qu’une préparation physique a commencé. L’interface Gestionnaire stock l’affiche « Confirmée · à préparer » et la RPC de confirmation ne crée pas d’état de préparation distinct. **Le métier doit donc décider explicitement si `confirmee` correspond au statut à annuler**, ou définir ultérieurement un état persistant distinct. Ne pas inventer cette équivalence.
- `payee` : préserver, car le paiement POS a été enregistré; aucune annulation disciplinaire automatique.
- `retiree` : préserver comme retrait confirmé et état terminal.
- Holds modernes : `stock_decremented=false` et `stock_restored=false`; ne pas restituer une quantité physique qui n’a pas été débitée. Pour les réservations historiques, passer par la restitution existante, ses allocations de lots et ses verrous; toute allocation incohérente doit conduire à une erreur de réconciliation, pas à une correction improvisée.
- Une exécution partielle ne doit pas laisser des réservations incohérentes : verrouillage, idempotence, gestion des erreurs, journalisation et notifications doivent être traités dans une même orchestration serveur transactionnelle ou avec un mécanisme de reprise durable.

### 3. Architecture cible à considérer avant tout changement applicatif

1. **État disciplinaire indépendant** du statut du profil, du contrat, de l’abonnement et de la publication Marketplace. Enregistrer l’identité du Promoteur sanctionné, le périmètre des pharmacies rattachées, motif « faute », durée indéterminée, acteur administratif, horodatages, état actif/levé et référence de levée.
2. **Action d’administration autorisée côté serveur**, qui vérifie rôle et habilitation dans la base; ne pas faire confiance à un identifiant d’administrateur envoyé par le client sans vérifier qu’il correspond à `auth.uid()` et à un administrateur actif autorisé.
3. **Journal disciplinaire append-only** contenant les valeurs avant/après, acteur, horodatage, cible et décision; la levée exige une décision explicite d’un Administrateur habilité. Les journaux administratifs existants peuvent être complémentaires mais ne doivent pas remplacer un événement disciplinaire structuré.
4. **Prédicat serveur partagé** appliqué à la visibilité des offres et à la création de nouvelles réservations, y compris les fonctions SQL `marketplace_offre_stock_disponible` et `private.reserve_stock`, plus tout chemin de recherche/offre trouvé lors de l’inventaire final. Une garde d’interface ou de middleware seule est insuffisante.
5. **Réactivation orthogonale** : la confirmation d’un paiement peut mettre à jour le volet commercial, mais ne peut ni supprimer ni lever la sanction. À l’inverse, la levée disciplinaire ne doit pas contourner un abonnement expiré ou un contrat incohérent.
6. **Orchestration des réservations** par transitions/RPC autorisées, avec conservation des paiements et retraits confirmés, restauration de stock idempotente, notification obligatoire au Promoteur, suivi des échecs et possibilité de reprise.
7. **RLS et privilèges minimaux** : vérifier lecture/écriture directe des tables et exécution des fonctions SECURITY DEFINER; révoquer les accès non nécessaires et utiliser un `search_path` sécurisé. Une fonction exposée à `anon`/ `authenticated` doit être évaluée selon son effet réel, pas seulement son nom.
8. **Tests hors production obligatoires** : Promoteur sanctionné/non sanctionné; plusieurs pharmacies rattachées; paiement confirmé pendant sanction; levée avec abonnement expiré; rôle admin inactif/non habilité; accès direct RPC/API; recherches et offres; deux requêtes concurrentes; erreurs au milieu de la liste; holds sans débit; réservations historiques avec lots; réservations `payee` et `retiree`; doublons de notification et reprise après échec.

### 4. Risques résiduels identifiés

- **Bloquant critique — contournement possible par indicateurs commerciaux :** le code actuel de confirmation de paiement réactive des profils et pharmacies; tant que les gardes disciplinaires ne sont pas indépendantes et appliquées dans les fonctions serveur, la règle « payer ne lève pas la sanction » n’est pas démontrée.
- **Bloquant critique — couverture incomplète des accès directs :** l’audit a identifié des points précis de contrôle, mais l’inventaire exhaustif de toutes les politiques RLS, fonctions RPC, vues, requêtes de recherche/offres et jobs planifiés reste à exécuter dans un environnement de code/test.
- **Bloquant métier — sémantique de `confirmee` :** l’application ne prouve pas qu’il s’agit d’une réservation « en préparation »; la règle d’annulation doit être explicitement décidée avant implémentation.
- **Bloquant de validation — absence de preuve d’exécution :** aucun test automatisé, build, test de concurrence, migration locale/hors production ni vérification de comportement runtime n’a été exécuté pendant cet audit.
- **Risque de données — réactivation trop large :** la procédure de paiement active toutes les pharmacies rattachées trouvées et certains profils liés. L’effet sur les liens inactifs, archives et rattachements historiques doit être couvert par des tests ciblés pour éviter de réactiver des entités qui ne devraient pas l’être.

### 5. Critères objectifs de clôture

| Critère | État |
|---|---|
| Règles métier SM-01 recueillies et consignées | **Fait** |
| Parcours réservation/caisse/stock cartographié statiquement | **Fait, limites documentées** |
| Dépendance avec le renouvellement commercial identifiée | **Fait** |
| Points d’entrée d’accès et visibilité Marketplace examinés | **Fait, cartographie initiale; couverture RLS/RPC exhaustive à confirmer** |
| Décision métier sur `confirmee` vs « en préparation » | **Bloqué — décision explicite nécessaire** |
| Implémentation de la sanction et des gardes serveur | **Non réalisée — autorisation distincte requise** |
| Tests automatisés et tests adversariaux hors production | **Non exécutés** |
| Validation finale de bout en bout sur environnement de test | **Non exécutée** |
| Déploiement / modification de production | **Non autorisé et non effectué** |

### Conclusion de clôture

**L’audit statique SM-01 et son cadrage technique sont documentés sur `main`. Le chantier fonctionnel SM-01 n’est pas clos au sens « implémenté et validé de bout en bout »** : le contrôle disciplinaire n’existe pas encore dans le code examiné, la couverture RLS/RPC doit être testée exhaustivement et l’équivalence métier `confirmee`/« en préparation » n’est pas établie.

Cette distinction est impérative pour ne pas annoncer une sécurité qui n’a pas été construite ni testée. Aucune règle métier n’est déduite par défaut et aucune modification applicative n’est engagée sans instruction distincte.

**État d’exécution de cette clôture :** lecture statique de sources versionnées et mise à jour documentaire uniquement. Aucune base Supabase interrogée ou modifiée, aucune migration exécutée, aucun test/build exécuté, aucun déploiement déclenché.


## 60.17 — Implémentation SM-01 / point 1 : état disciplinaire indépendant et garde Marketplace

**État :** implémentation versionnée directement sur `main`; migration non exécutée et validation runtime non effectuée.

### Éléments implémentés dans le dépôt

1. **État disciplinaire autonome** — migration `supabase/migrations/20261027020000_promoteur_suspension_disciplinaire.sql` :
   - tables `promoteur_suspensions_disciplinaires` et `promoteur_suspensions_disciplinaires_audit`;
   - motif imposé à `faute`, durée indéterminée tant que le statut reste `active`, observations non renseignées;
   - photographie du Promoteur, des rattachements et des pharmacies au moment de la sanction;
   - index unique empêchant deux suspensions actives pour un même Promoteur;
   - historique des événements de suspension et de levée avec acteur, date, avant/après.
2. **Action administrative serveur** — RPC `admin_suspendre_promoteur_disciplinaire` et `admin_lever_suspension_promoteur` :
   - l’acteur est dérivé de `auth.uid()`, et non d’un identifiant transmis par le client;
   - les deux actions exigent un profil administrateur actif;
   - la levée exige une suspension active et une décision explicite; la mise à jour est verrouillée;
   - notification au Promoteur et entrée dans `journal_admin` lors de chaque décision.
3. **Périmètre figé** — la garde utilise la liste des pharmacies enregistrée dans la photographie disciplinaire, y compris les liens historiques connus au moment de la sanction. Une modification ultérieure des rattachements ne doit pas retirer silencieusement une pharmacie du périmètre de la sanction.
4. **Blocage Marketplace côté serveur** :
   - `marketplace_offre_stock_disponible` ne retourne pas d’offre pour une pharmacie couverte par une suspension active;
   - `private.reserve_stock` refuse les nouvelles réservations, y compris par appel direct à la RPC;
   - `marketplace_pharmacies_disciplinairement_autorisees` expose à la recherche publique uniquement les identifiants autorisés, sans divulguer l’identité du Promoteur sanctionné;
   - `src/app/api/medicaments/recherche/route.ts` applique ce filtre. Si la RPC de filtrage échoue, la disponibilité n’est pas annoncée comme vérifiée.
5. **Séparation Marketplace / opérations internes** :
   - le point de vente utilise désormais `private.stock_vendable_interne` pour la recherche caisse, afin que le filtre disciplinaire Marketplace ne masque pas les produits du POS interne;
   - aucune désactivation générale du profil, de la pharmacie ou des rattachements n’est utilisée pour matérialiser la sanction;
   - les données, le stock, les ventes, les tickets et l’historique restent conservés.
6. **Interface d’administration** — `src/app/admin/promoteurs/page.tsx` et `src/app/admin/promoteurs/actions.ts` :
   - affichage des Promoteurs et de leur suspension active;
   - action de suspension pour faute;
   - action explicite de levée;
   - retours d’erreur sans afficher de succès si la RPC échoue.

### Règle paiement / renouvellement

Les RPC commerciales de confirmation et de réactivation n’écrivent pas dans le registre disciplinaire. Un renouvellement peut remettre les indicateurs commerciaux à l’état actif, mais le prédicat disciplinaire reste indépendant et continue de bloquer la visibilité et la création de réservations Marketplace. La levée disciplinaire ne modifie pas l’abonnement : un compte commercialement expiré reste soumis aux gardes commerciales existantes.

### Test ajouté

Fichier : `supabase/tests/20261027020000_promoteur_suspension_disciplinaire.sql`.

Le test vérifie structurellement :
- existence des deux tables et des RPC administratives;
- contrôles d’administrateur actif, audit et notification;
- filtrage de disponibilité et blocage de création de réservation;
- stabilité du périmètre disciplinaire figé;
- absence d’exécution des RPC de suspension/levée par `anon`;
- séparation de la recherche caisse interne par rapport à la fonction Marketplace.

**Ce test n’a pas été exécuté** : il doit être lancé dans une base de test après application de la migration dans cet environnement.

### Limites restantes avant une clôture de sécurité validée

- La migration n’a été appliquée à aucune base dans ce travail; l’interface de gestion ne pourra fonctionner qu’après son application dans l’environnement autorisé.
- Aucun test SQL, test de concurrence, build TypeScript ou test navigateur n’a été exécuté. Les fonctions SECURITY DEFINER et leurs signatures doivent être validées par PostgreSQL dans l’environnement de test.
- La recherche publique identifiée dans `src/app/api/medicaments/recherche/route.ts`, la fonction de disponibilité et la création de réservation sont couvertes par le code modifié. Un test d’intégration doit encore confirmer les autres parcours Marketplace/ panier et l’absence de voie alternative de réservation non couverte.
- Les réservations existantes et leur éventuelle annulation disciplinaire relèvent du point suivant du chantier SM-01; aucune annulation, restitution de stock ni changement de statut de réservation n’est inclus dans cette implémentation du point 1.
- Aucun changement de données de production et aucun déploiement ne sont effectués.

### Critère de clôture du point 1

**Code et interface préparés sur `main`; clôture fonctionnelle préparée, mais pas clôture de sécurité runtime.** Le point ne peut être déclaré entièrement validé tant que la migration et les tests ne sont pas exécutés dans un environnement de test autorisé. Le déploiement reste hors périmètre et non autorisé.

## 60.18 — SM-01 / point 2 : annulation des réservations lors d’une suspension disciplinaire

**État : cartographie du cycle terminée; automatisation de l’annulation non engagée, car le schéma versionné ne permet pas encore de distinguer sûrement tous les états métier demandés.** Aucun statut n’a été inventé et aucune réservation n’a été modifiée.

### Parcours confirmé dans les migrations versionnées

- Les réservations modernes sont des holds : `stock_decremented=false` et `stock_restored=false`. Leur annulation ne doit donc pas incrémenter le stock physique.
- Pour les réservations historiques ayant réellement débité le stock, `public.restore_stock(uuid)` est la routine de restitution. Elle verrouille la réservation, refuse les dossiers consommés, restaure les lots d’origine et le stock agrégé dans la même transaction, et lève une erreur si les allocations sont incohérentes ou manquantes.
- Le cycle d’expiration actuel traite `mode='reservation'` et les statuts `en_attente` / `confirmee`, puis passe le dossier à `expiree`. Ce traitement est un mécanisme d’expiration, pas une annulation disciplinaire, et ne doit pas être détourné pour simuler celle-ci.
- Les états `payee` et `retiree` sont protégés par le parcours ticket/caisse : paiement enregistré et retrait confirmé doivent rester conservés; une vente consommée ne doit jamais être restituée au stock par une annulation automatique.
- Le code versionné ne fournit pas de preuve qu’un statut autonome `en_preparation` existe, ni que `confirmee` signifie que la préparation physique a commencé. Les recherches statiques dans les migrations Marketplace/réservation n’ont pas trouvé de transition qui établisse cette équivalence.

### Décision de sécurité appliquée

La suspension disciplinaire bloque déjà la visibilité Marketplace et les nouvelles réservations via le point 1. En revanche, il serait incorrect de coder maintenant une annulation automatique en traitant toutes les réservations `confirmee` comme « en préparation », ou en réutilisant `expiree` pour signifier « annulée pour motif disciplinaire ». Cela pourrait annuler une commande déjà préparée ou effacer la distinction entre expiration et sanction.

Aucune annulation automatique n’est donc ajoutée tant que le modèle ne porte pas une distinction fiable entre :
1. `en_attente` (annulable);
2. préparation physique commencée (à annuler selon la règle SM-01, mais état actuel non démontré);
3. prête au retrait (à préserver);
4. paiement caisse validé / `payee` (à préserver);
5. retrait confirmé / `retiree` (état terminal à préserver).

### Ce qui reste requis pour fermer le point 2 de bout en bout

- Identifier dans le schéma réel le type et les contraintes de `reservations.statut`, ainsi que tous les producteurs de transitions, afin de confirmer si un état « préparation » existe hors des migrations consultées.
- Introduire un statut de sanction distinct et auditable si le modèle actuel n’en possède pas; ne pas détourner `expiree`.
- Orchestrer la suspension et l’annulation dans une transaction serveur idempotente, en appelant `restore_stock` uniquement pour les réservations historiques dont le débit physique est prouvé; un échec de restitution doit être journalisé et réconciliable, jamais ignoré.
- Journaliser avant/après par réservation, notifier le client affecté et le Promoteur, couvrir les accès concurrents et tester les cas `en_attente`, préparation réelle, prête au retrait, `payee`, `retiree`, hold moderne et réservation historique avec lots.
- Exécuter les tests uniquement dans un environnement hors production autorisé.

**Vérifications réalisées pour cette étape :** lecture des migrations versionnées `20261024180000_marketplace_ticket_lifecycle_orchestrator.sql`, `20261024193000_reservation_cycle_dependencies.sql`, `20261024203000_marketplace_hold_reservation_alignment.sql`, `20261024210000_reservation_ticket_rpc_unified_cron.sql` et de la migration de suspension disciplinaire du point 1. Il s’agit d’une revue statique; aucune requête PostgreSQL, aucun test SQL, build ou test navigateur n’a été exécuté.

**Production et déploiement :** aucune base de production modifiée, aucune migration exécutée, aucun déploiement déclenché. Le point 2 est **cartographié mais non clos fonctionnellement**; le déclarer clos maintenant reviendrait à prétendre que l’annulation automatique protège des états que le schéma actuel ne distingue pas.

## 60.19 — SM-01 / point 2 : implémentation de l’annulation disciplinaire des réservations

**État : code et parcours de préparation ajoutés sur `main`; tests PostgreSQL et validation runtime non exécutés.** Cette section remplace le constat « automatisation non engagée » de 60.18 pour l’état actuel du dépôt.

### Implémentation versionnée

- Migration : `supabase/migrations/20261027030000_sm01_reservations_disciplinaire_et_garde_rpc.sql`.
- État physique explicite ajouté à `public.reservations.preparation_statut`, avec horodatages de démarrage et de disponibilité au retrait.
- RPC `gestionnaire_stock_reservation_preparation(uuid,text)`, limitée à un utilisateur authentifié, actif, autorisé dans le périmètre pharmacie et à un rôle pharmacie admissible. Elle permet le parcours `non_commencee → en_preparation → prete_au_retrait`; la transition inverse depuis « prête » est interdite.
- Interface `src/app/pharmacie/gestionnaire-stock/reservations/page.tsx) mise à jour avec les actions « Démarrer la préparation » et « Marquer prête au retrait », et affichage de la phase réelle.
- Lors de la création d’une suspension active, le déclencheur transactionnel `naxa_suspension_disciplinaire_annuler_reservations` traite les réservations du périmètre figé :
  - `en_attente) : annulée;
  - `confirmee) dont la phase persistée est `non_commencee) ou `en_preparation) : annulée;
  - `prete_au_retrait), `payee) et `retiree) : préservées;
  - phase historique inconnue : aucune annulation automatique; événement `echec_annulation` journalisé pour réconciliation.
- Les annulations utilisent `public.restore_stock(uuid)` dans la même sous-transaction que la transition vers `annulee). Les holds modernes ne recréent pas de stock; les réservations historiques ne sont restituées que si les garde-fous d’allocation et de consommation l’autorisent.
- Chaque réservation traitée reçoit un journal avant/après; le client est notifié après annulation et le Promoteur reçoit un résumé des succès/échecs. Une erreur de restitution annule les mutations de cette réservation et produit un événement d’échec, sans être ignorée.
- Le chemin manuel `gestionnaire_stock_reservation_annuler(uuid)` refuse désormais l’annulation d’une réservation prête au retrait et refuse de trancher automatiquement les phases historiques inconnues.

### Préservation des dossiers historiques

La migration **ne remplit pas arbitrairement** la phase de préparation des réservations déjà confirmées. Les réservations historiques `confirmee) sans preuve de phase sont auditées comme nécessitant une réconciliation et restent intactes. Cela évite d’annuler silencieusement une commande qui pourrait déjà être prête au retrait. Les réservations `en_attente) peuvent être classées comme non commencées, et les nouvelles réservations reçoivent ce défaut.

### Test ajouté et limites

- Test structurel : `supabase/tests/20261027030000_sm01_reservations_disciplinaire_et_garde_rpc.sql`.
- Le test vérifie l’existence de la phase de préparation, du déclencheur, de l’audit, des contrôles d’accès et de l’appel à la restitution.
- **Non exécuté** : la migration, le test SQL, les tests de concurrence, le build et le test navigateur restent à exécuter dans un environnement hors production. La clôture de l’implémentation dans le dépôt ne doit pas être confondue avec une validation runtime.
- Aucun changement de données de production, aucune migration de production et aucun déploiement.

## 60.20 — SM-01 / point 3 : inventaire des RPC sensibles et lancement des gardes serveur

**État : point 3 lancé; inventaire initial consigné et premières protections RPC ajoutées avec le point 2. L’inventaire exhaustif et la validation adversariale restent ouverts.**

| Surface sensible | Garde constatée ou ajoutée | Contrôle restant |
|---|---|---|
| Suspension / levée disciplinaire | RPC d’administration basées sur `auth.uid()`, profil admin actif, verrouillage de la suspension, audit et notification | Tester les privilèges réels PostgreSQL, les rôles inactifs et les appels directs |
| Recherche et création de réservations Marketplace | Filtre disciplinaire sur la recherche et la disponibilité; contrôle de suspension dans `private.reserve_stock` | Recenser toutes les autres routes API, vues, fonctions SQL et chemins de panier |
| Annulation / préparation réservation | Garde serveur de rôle et périmètre; protection du statut prêt au retrait; phase physique persistée | Tester les appels RPC directs, la concurrence avec suspension, les erreurs de restitution et les dossiers historiques |
| Règlement d’abonnement Promoteur | Fonctions de règlement réservées à `service_role`; réactivation commerciale séparée du registre disciplinaire | Vérifier toutes les actions serveur appelantes et prouver qu’aucun identifiant admin client ne peut être usurpé dans un chemin accessible |
| POS / vente | RPC de caisse avec authentification et contrôle du périmètre pharmacie; le POS interne n’est pas masqué par le filtre Marketplace | Vérifier l’ensemble des RPC de vente, de validation de paiement, de consommation et de retrait; ne pas confondre suspension Marketplace et arrêt du POS |
| Validation de dossier et activation pharmacie | Actions d’administration protégées côté serveur; contrôles métier délégués aux RPC transactionnelles | Auditer chaque RPC d’activation/rattachement, les paramètres d’acteur et les effets sur les pharmacies historiques/inactives |

### Méthode de poursuite du point 3

1. Recenser chaque appel `supabase.rpc(...)` et chaque fonction `SECURITY DEFINER) dans le code et les migrations.
2. Pour chaque opération, noter l’identité attendue, le rôle, le périmètre pharmacie, les privilèges EXECUTE, les écritures sensibles et l’idempotence.
3. Corriger côté SQL toute confiance excessive dans un identifiant ou un rôle fourni par le client; conserver les contrôles d’interface uniquement comme ergonomie.
4. Ajouter des tests de contournement direct, utilisateur hors périmètre, acteur inactif, requêtes concurrentes et absence de privilèges `anon`.
5. Exécuter les tests sur une base hors production; ne pas déduire la sécurité effective de la seule présence du code.

**État des vérifications :** lecture statique des sources versionnées et contrôles de présence de contenu uniquement. Aucun test SQL, build, test navigateur ou appel à une base de données n’a été exécuté. Aucune modification de production ni aucun déploiement.


## 60.21 — SM-01 / point 3 : revue statique ciblée des RPC et des appelants

**État : revue ciblée ajoutée; inventaire global encore ouvert. Aucun test SQL n’a été exécuté.**

### Fonctions et protections confirmées dans le code versionné

| RPC / surface | Exposition SQL observée | Garde ou appelant vérifié statiquement | Risque résiduel / preuve manquante |
|---|---|---|---|
| `public.gestionnaire_stock_reservation_preparation(uuid,text)` | `authenticated`; `anon` et `public` révoqués | `auth.uid()`, profil actif, `naxa_scope_allows(..., 'PHARMACIE')`, rôle/fonction interne ou privilège; transition physique monotone | Vérifier en base les ACL effectives, les privilèges hérités et les cas adversariaux |
| `public.gestionnaire_stock_reservation_annuler(uuid)` | `authenticated`; `anon` et `public` révoqués | Identité, portée pharmacie, rôle autorisé, phase historique inconnue refusée, état prêt protégé, restitution de stock | Tester concurrence annulation/suspension et toutes les formes de stock historique |
| `public.admin_suspendre_promoteur_disciplinaire(uuid,text)` et `public.admin_lever_suspension_promoteur(uuid,text)` | `authenticated`; `anon` et `public` révoqués | Les deux fonctions utilisent `auth.uid()` et exigent un profil `admin` actif; audit et journal administratif | Tester les privilèges effectifs, la course entre deux suspensions et les comptes inactifs |
| `public.promoteur_soumettre_reglement(...)` | Exécution réservée à `service_role` par la migration de flux de paiement | L’action `src/app/promoteur/paiements/actions.ts` récupère la session via `supabaseServer().auth.getUser()`, vérifie le rôle Promoteur, puis transmet `user.id` comme `p_promoteur` via `supabaseAdmin()` | Le garde d’identité dépend du maintien strict de cette frontière serveur; vérifier les autres appelants et l’absence de nouvelles attributions EXECUTE |
| `public.admin_confirmer_reglement_promoteur(uuid,uuid)` | Exécution réservée à `service_role` | L’action `src/app/admin/pilotage/reglements/actions.ts` appelle `requireAdminActive()`, contrôle l’ID et l’état du règlement, exige l’action explicite de vérification de preuve, puis transmet l’ID authentifié comme `p_admin` | La fonction SQL fait confiance à `p_admin`; cela reste acceptable uniquement tant que l’EXECUTE est réellement limité à `service_role` et que tous les appelants vérifient l’admin côté serveur |
| `public.admin_valider_dossier_pharmacie(...)` | À confirmer à partir de l’état effectif des ACL et de la définition SQL déployée | L’action `src/app/admin/promoteurs/actions.ts` utilise `requireAdminActive()`; validation métier transactionnelle déléguée à la RPC | Poursuivre l’inspection de la définition complète, des grants et des paramètres d’acteur; ne pas déclarer la garde SQL validée sur la seule protection de l’action |
| POS : `public.caisse_rechercher_produit` et `public.caisse_rechercher_codes` | `authenticated`; accès `anon`/public révoqué dans la migration disciplinaire | Authentification et contrôle `is_admin()` ou `can_operate_pharmacy(p_pharmacie)`; stock interne séparé du filtre Marketplace | Inventorier les RPC de finalisation, paiement, consommation, retrait et synchronisation hors ligne, puis vérifier leur périmètre de façon uniforme |

### Corrections apportées à la couverture de test

Le test structurel `supabase/tests/20261027030000_sm01_reservations_disciplinaire_et_garde_rpc.sql` inclut désormais des assertions sur l’existence des RPC de règlement, les privilèges `EXECUTE` attendus pour `service_role`, l’absence d’accès `anon/authenticated` à ces deux fonctions, et les gardes d’identité/admin actif de la RPC de suspension disciplinaire.

**Limite importante :** ces assertions sont du code de test ajouté, pas un résultat de test. Elles doivent être exécutées après application des migrations dans un environnement de test non-production. Les ACL effectives de la base ne sont pas connues tant que le test n’a pas été exécuté.

### Décision de sécurité à ce stade

Aucune preuve ne justifie de modifier maintenant les RPC de paiement pour les rendre directement accessibles à `authenticated` : leur contrat actuel est service-role-only et les actions serveur contrôlent la session/role avant l’appel. Il faut conserver cette séparation. La suite prioritaire est l’inventaire complet des appels RPC et des fonctions `SECURITY DEFINER`, notamment validation/activation de dossier, stock/lots, ventes POS, clôture de caisse, retraits et synchronisation hors ligne. Chaque correction doit s’appuyer sur la signature réelle et ses ACL, pas sur une supposition.

**Périmètre d’exécution :** modifications de code et de documentation sur `main) uniquement. Aucun branchement, aucune migration exécutée, aucune écriture en base de production et aucun déploiement.


## 60.22 — SM-01 / point 3 : couverture structurelle stock et synchronisation hors ligne

**État : nouvelle suite structurelle versionnée; elle n’a pas été exécutée.**

Fichier ajouté : `supabase/tests/20261027040000_sm01_stock_rpc_guard_inventory.sql`.

La suite vérifie statiquement en base de test :
- l’existence et la garde identité/périmètre/compte actif de `gestionnaire_stock_quantite_ajuster`;
- l’autorisation sur les deux pharmacies, l’état actif et les privilèges d’exécution de `gestionnaire_stock_transfert_atomique`;
- l’identité, l’appartenance de l’opération, l’affectation professionnelle et la détection de conflit de `offline_stock_set_quantity`;
- l’exposition exclusivement `service_role` de l’ancienne API `naxa_apply_offline_operation_v1`;
- la garde identité/profil actif/périmètre de `stock_service_open`.

### Constats de la revue statique

- Les fonctions d’ajustement et de transfert du stock ont des contrôles SQL explicites de rôle actif et de périmètre; leurs opérations sont transactionnelles dans la fonction PostgreSQL.
- Le chemin offline récent `offline_stock_set_quantity` vérifie l’identité appelante, l’autorisation sur la pharmacie ou une affectation professionnelle active, l’identité du propriétaire de l’opération et la cohérence du contenu réutilisant un identifiant. Il compare aussi l’horodatage de base avant la mutation et refuse le stock lotisé.
- L’ancienne API `naxa_apply_offline_operation_v1` reçoit un identifiant d’appareil et ne doit pas être exposée directement aux utilisateurs : la migration versionnée la réserve à `service_role`.
- L’ouverture du service de stock vérifie le profil actif, le rôle admis et le périmètre pharmacie.

### Limites et prochaine vérification

Ces points sont des constats de lecture du code source versionné, pas des preuves des droits effectifs d’une base distante. La nouvelle suite doit être exécutée hors production après application des migrations dans leur ordre réel. Il reste à couvrir dynamiquement les tentatives d’appel direct par un utilisateur non autorisé, une affectation expirée/révoquée, un profil inactif, une pharmacie hors périmètre, les collisions d’identifiants offline et les appels concurrents. La clôture de service et l’enregistrement du comptage sont aujourd’hui deux appels distincts côté action serveur; il faut vérifier si le comportement métier attendu exige une RPC unique atomique ou si l’enregistrement intermédiaire est volontaire et récupérable.

**Exécution :** aucune migration appliquée, aucun test SQL exécuté, aucune base de production modifiée et aucun déploiement.


## 60.23 — SM-01 / point 3 : POS, paiements, annulations et clôture de caisse

**État : inventaire statique poursuivi; nouvelle suite structurelle ajoutée, non exécutée.**

Fichier ajouté : `supabase/tests/20261027050000_sm01_pos_caisse_guard_inventory.sql`.

### Contrôles vérifiés dans le code versionné

- **Encaissement d’une réservation au comptoir** (`vente_reservation_encaisser`) : verrouillage de la réservation, état confirmé/non expiré, acteur Caisse autorisé pour la pharmacie, session ouverte détenue par l’utilisateur, contrôle du total des articles, prévention du double encaissement et finalisation dans la transaction.
- **Panier POS** (`vente_ajouter_produit`, `vente_produit_retirer`, `vente_brouillon_abandonner`) : contrôle d’identité, du périmètre Caisse, du statut brouillon, du propriétaire du panier et de la session ouverte.
- **Débit de stock à la finalisation** : la primitive interne vérifie la session et le rôle Caisse, verrouille le stock et les lots, prend en compte les réservations/paniers concurrents, puis débite les lots FEFO et le stock agrégé dans la transaction. Les migrations 216/218/219 traitent la réentrance du trigger et préservent le coût unitaire figé.
- **Décaissements et clôture Z** : le décaissement exige une session ouverte détenue par le compte, un profil Caisse actif dans la pharmacie, un montant positif et un motif; le mouvement est historisé dans la chaîne d’audit. La clôture verrouille la session, vérifie le titulaire actif (hors administration), refuse les brouillons ouverts et calcule le solde théorique en intégrant les décaissements.
- **Annulation de vente payée** : séparation demande/décision/exécution, interdiction au demandeur d’approuver sa propre demande, vérification du rôle Promoteur ou Admin et du périmètre, puis restitution du stock sous transaction après approbation.
- **Tests existants repérés** : `supabase/tests/164_caisse_decaissements.sql`, `166_caisse_cloture_owner_guard.sql`, `161_caisse_reservation_atomic_payment.sql`, `215_pos_debit_at_finalization.sql` et `219_pos_fefo_lot_stock_sync.sql`. Ils fournissent des scénarios structurels et/ou comportementaux à exécuter en environnement de test.

### Vérifications ajoutées

La nouvelle suite `supabase/tests/20261027050000_sm01_pos_caisse_guard_inventory.sql` vérifie l’existence des RPC sensibles et la présence des garde-fous dans leur définition, notamment l’identité, le périmètre, le propriétaire de session, la séparation des tâches pour les annulations et l’absence d’exécution par `anon`.

### Réserves non clôturées

1. Les tests SQL existants et les deux nouvelles suites SM-01 n’ont pas été exécutés dans cette étape; leur présence dans Git ne vaut pas preuve de réussite.
2. Les contrôles de source ne prouvent pas les ACL effectives d’une base distante, l’ordre d’application réel des migrations ni le comportement sous concurrence.
3. Le chemin d’annulation d’une vente restaure les quantités et passe la vente à `annulee`; la revue suivante doit confirmer que les écritures de remboursement/avoir, le traitement des paiements non espèces et les conséquences comptables sont complets et cohérents avec les règles SYSCOHADA, sans modifier le code avant vérification de l’ensemble du flux.
4. Il faut confronter les contrats des actions serveur aux signatures finales des RPC après toutes les migrations, en particulier les opérations de décaissement autorisées et les flux PIN, pour éviter qu’un ancien appelant ou une surcharge obsolète ne demeure utilisable.

**Exécution :** aucun test SQL exécuté, aucune migration appliquée, aucune base de production modifiée et aucun déploiement.


## 60.24 — SM-01 / point 3 : rapprochement actions serveur/RPC et événement comptable d’annulation

**État : rapprochement statique effectué sur les sources versionnées; anomalie fonctionnelle comptable identifiée, non corrigée à ce stade.**

### Contrats d’actions serveur et RPC examinés

- L’action Promoteur src/app/promoteur/paiements/actions.ts appelle promoteur_soumettre_reglement avec les huit paramètres nommés attendus par la migration finale : p_promoteur, p_montant, p_canal, p_canal_autre, p_compte_payeur, p_reference, p_paye_le, p_preuve_path. Les formats, la date déclarée, le canal, la preuve et le montant sont validés côté action puis à nouveau côté RPC.
- L’action Admin src/app/admin/pilotage/reglements/actions.ts appelle admin_confirmer_reglement_promoteur(p_reglement,p_admin) et admin_refuser_reglement_promoteur(p_reglement,p_admin,p_motif), signatures conformes aux définitions retrouvées dans les migrations finales consultées. Le contrôle de rôle actif est effectué par requireAdminActive et répété dans les RPC.
- La RPC de soumission du paiement manuel est révoquée à public, anon et authenticated, puis accordée à service_role; le chemin d’action utilise le client administrateur après authentification et contrôle du rôle Promoteur. Ce contrôle est une lecture du code, pas une preuve des privilèges effectifs dans la base distante.
- La migration 20261027012000_include_promoter_in_payment_notifications.sql ajoute le libellé du Promoteur aux notifications Admin. Dans cette définition, les pharmacies liées ne sont pas ajoutées au corps de notification : si le besoin opérationnel exige le nom du Promoteur et celui de sa/ses pharmacie(s) dans l’alerte, ce dernier élément reste à vérifier/corriger dans le périmètre du parcours de paiement.

### Anomalie comptable prioritaire — vente annulée sans événement compensatoire visible

**Preuves statiques croisées :**
1. migration_20261021_compta_outbox.sql ne crée un événement que lorsqu’une vente entre dans l’état payee; le type émis est vente_encaissee.
2. migration_20261022_compta_worker.sql n’accepte que les types vente_encaissee et depense_validee pour la génération des écritures.
3. migration_060_pos_annulation_z.sql réalise l’annulation approuvée en restituant le stock, puis en faisant passer la vente à annulee. Le chemin lu ne crée ni paiement inverse, ni avoir, ni événement comptable de contrepassation.
4. La table compta_ecriture possède une colonne contrepassation_de, mais la présence de cette colonne ne prouve pas qu’une écriture de contrepassation est générée pour une vente annulée.

**Conclusion :** dans les migrations consultées, une vente initialement comptabilisée peut être annulée opérationnellement et son stock restitué sans chemin de compensation comptable visible. Les paiements espèces, Mobile Money et paiements mixtes sont enregistrés dans vente_paiements, mais aucun remboursement correspondant n’a été trouvé dans le chemin d’annulation examiné. Il s’agit d’un **risque de cohérence comptable et de trésorerie à traiter avant de déclarer le flux d’annulation complet**, pas d’une preuve de déséquilibre dans une base réelle.

### Suite de travail requise dans le périmètre

- Concevoir un événement d’annulation/avoir idempotent, lié à la vente d’origine, avec une écriture de contrepassation dans la même pharmacie et une période comptable ouverte ou un mécanisme d’ajustement explicitement approuvé.
- Définir le remboursement par mode de paiement d’origine, avec référence/preuve lorsque nécessaire; ne pas assimiler une restitution de stock à un remboursement financier.
- Protéger la séquence contre double exécution, annulation répétée, concurrence et clôture comptable, puis ajouter des tests SQL transactionnels couvrant paiements espèces, Mobile Money, mixtes, refus de remboursement et contrepassation équilibrée.
- Vérifier les contrats finaux des RPC de décaissement et des flux PIN à partir de toutes les migrations ultérieures avant de déclarer ces sous-points clos.
- Compléter, si le besoin métier est confirmé, la notification de paiement Promoteur afin d’y inclure le nom de chaque pharmacie liée sans exposer d’informations inutiles.

**Exécution :** revue de code uniquement. Aucun test SQL exécuté, aucune migration appliquée, aucune donnée de base modifiée et aucun déploiement déclenché. Aucune correction métier n’a été introduite sans définir le contrat complet de remboursement et de contrepassation.


## 60.25 — SM-01 / point 3 : correction du contrôle structurel de décaissement

Le rapprochement des migrations 164/165/167/169 et du composant src/components/pharmacie/CaisseDecaissements.tsx précise le contrat réel :
- La surcharge à cinq paramètres de caisse_decaisser est volontairement remplacée par une fonction qui lève l’exception « Autorisation PIN ou biométrique obligatoire ».
- Le composant client appelle la surcharge à six paramètres, en transmettant p_auth_grant. La migration 167 vérifie que le grant est lié au même utilisateur et à la même session, non consommé et non expiré; elle le consomme avant l’insertion du décaissement.
- Le test structurel précédent examinait à tort le corps de l’ancienne surcharge à cinq paramètres comme s’il s’agissait du chemin valide. Il aurait donc signalé à tort l’absence des contrôles d’identité/session. Le test a été corrigé pour exiger le rejet de la surcharge legacy, contrôler explicitement la signature à six paramètres et vérifier les contrôles du grant. Le contrôle des privilèges anon couvre désormais les deux signatures.

**Limite :** le test corrigé n’a pas été exécuté sur PostgreSQL. Cette modification corrige l’assertion de test d’après les sources lues; elle ne prouve pas que l’ensemble des migrations s’applique sans erreur ni que les ACL de la base distante correspondent au dépôt.

**Exécution :** un fichier de test et le présent rapport ont été modifiés sur main. Aucune migration appliquée, aucune base modifiée et aucun déploiement déclenché.


## 60.26 — SM-01 / point 3 : contrôle d’enrôlement biométrique et libellé de l’autorisation PIN

**État : divergence fonctionnelle relevée entre le libellé UI et le contrôle serveur; correction différée car le contrat d’autorisation Promoteur doit être explicite.**

### Constat de source
- Dans src/components/pharmacie/CaisseDecaissements.tsx, le champ d’enrôlement est libellé « PIN Promoteur requis pour enregistrer la biométrie ».
- Dans src/app/api/caisse/security/route.ts, l’action registration-options authentifie l’utilisateur courant comme titulaire de la session Caisse, puis lit caisse_security_credentials avec user_id = user.id et vérifie le PIN enregistré pour ce même utilisateur.
- La route configure-pin enregistre justement le hash sous l’identifiant du compte Caisse cible. Le code de registration-options ne vérifie donc pas un secret distinct appartenant au Promoteur; il vérifie le PIN de la Caisse configuré par le Promoteur.
- Le mécanisme peut être techniquement cohérent si le PIN Caisse sert aussi à autoriser l’enrôlement, mais il ne correspond pas au libellé ni à l’intention explicite « autorisation du Promoteur ». Il ne faut pas présenter cette vérification comme une approbation directe du Promoteur.

### Décision d’audit
Ne pas modifier seulement le texte pour masquer la différence, et ne pas ajouter une validation ad hoc. Il faut choisir et implémenter un contrat sûr : soit assumer explicitement que le PIN Caisse autorise son propre enrôlement, soit exiger une approbation Promoteur distincte, liée au compte Promoteur, à la Caisse cible et à une session courte/à usage unique. Pour la seconde option, prévoir la preuve d’approbation, son expiration, son usage unique, les contrôles de périmètre actif et les tests d’accès croisé entre Promoteurs/pharmacies.

### Vérifications complémentaires nécessaires
- Aligner sessionOK() et la RPC caisse_decaisser sur la même définition du rôle Caisse : la route API vérifie profiles.role='caisse', tandis que la RPC accepte aussi fonction_interne='caisse'. Confirmer si cette divergence est voulue ou si elle peut bloquer un compte légitime.
- Vérifier la gestion du compteur WebAuthn et les scénarios concurrents/rejeu sur une base isolée; aucune validation runtime n’a été exécutée dans cette étape.

**Exécution :** constat statique ajouté au rapport. Aucune modification du comportement d’authentification, aucune migration appliquée, aucune donnée modifiée et aucun déploiement déclenché.


## 60.27 — SM-01 / point 3 : contrat final de clôture Z et correction du test structurel

Le rapprochement de src/app/pharmacie/caisse/page.tsx avec les migrations 166/168/169 a révélé une seconde divergence dans le test structurel POS/caisse : l’application appelle caisse_cloturer(p_session,p_total_compte,p_ecart_justification), tandis que le test n’inspectait que la surcharge de compatibilité à deux paramètres.
La migration 168 définit la RPC à trois paramètres comme chemin principal : elle vérifie le titulaire de session, le verrouillage, les décaissements et exige une justification de 5 à 500 caractères lorsque l’écart n’est pas nul. La surcharge à deux paramètres délègue à cette RPC avec une justification nulle; elle ne doit donc pas être considérée comme le chemin UI normal et un écart non nul y est refusé.
Le test structurel a été corrigé pour vérifier séparément : (1) la définition à trois paramètres et ses gardes, (2) la délégation de l’ancienne surcharge, et (3) l’absence de privilège EXECUTE pour anon sur les deux signatures. Il reste à exécuter cette suite sur une base isolée; la correction est fondée sur la lecture des migrations et du contrat client.

**Exécution :** test structurel et rapport mis à jour sur main. Aucun test SQL exécuté, aucune migration appliquée, aucune donnée distante modifiée et aucun déploiement déclenché.


## 60.28 — SM-01 / point 3 : encaissement d’une créance client et traçabilité de caisse

**État : revue statique du contrat client/RPC effectuée; risque de rapprochement financier documenté, non corrigé sans contrat métier complet.**

### Contrat observé
- L’interface de caisse dans `src/app/pharmacie/caisse/[section]/page.tsx` appelle `client_credit_rembourser(p_credit,p_montant,p_reference,p_motif)` depuis l’action `collectCredit`. Le libellé UI indique qu’il s’agit d’un **encaissement du crédit client** (remboursement de la dette par le client), et non d’un remboursement d’une vente annulée.
- La migration `supabase/migration_054_client_credit.sql` définit cette RPC avec verrouillage `FOR UPDATE`, vérification de connexion, contrôle de périmètre via `is_admin()` ou `can_operate_pharmacy(pharmacie_id)`, montant strictement positif et plafond limité au solde dû. Elle diminue le solde puis insère une opération `nature='remboursement'` dans `client_credit_operations`.
- La RPC est accordée à `authenticated`; les écritures directes dans les tables sont révoquées pour ce rôle. La fonction ne vérifie cependant pas explicitement un profil Caisse actif, une session de caisse ouverte et détenue par l’appelant, ni un paiement enregistré dans le journal d’encaissements POS.
- L’interface accepte une référence facultative et un motif/mode de règlement libre, puis annonce que le règlement est enregistré après le seul succès de la RPC. Dans la définition examinée, aucune ligne correspondante n’est créée dans `vente_paiements`, aucun mouvement de caisse/session n’est enregistré et aucun événement comptable/outbox dédié à ce recouvrement n’est émis.

### Risque et limites
Le verrouillage empêche notamment deux opérations concurrentes de consommer le même solde au-delà du montant restant; il ne prouve pas que l’argent a été reçu, ni que l’encaissement rejoint le total espèces/les autres moyens de paiement de la clôture Z. Un utilisateur authentifié disposant du périmètre métier peut donc appeler directement cette RPC et réduire la créance sans que ce chemin versionné exige une session de caisse ouverte ou une preuve de paiement structurée. C’est un **risque de traçabilité et de rapprochement**, pas la preuve qu’une opération frauduleuse ou un écart réel s’est produit.

### Correction à spécifier avant modification
1. Décider si le recouvrement d’une créance doit obligatoirement passer par la session POS active du caissier ou s’il existe des modes de recouvrement hors caisse autorisés.
2. Pour le chemin POS, enregistrer atomiquement le paiement et le mouvement de créance avec moyen de paiement normalisé, session, acteur, date, référence externe idempotente si disponible et audit trail; empêcher le double emploi d’une référence/opération.
3. Inclure le recouvrement dans le calcul de clôture Z par moyen de paiement, sans le compter deux fois avec une vente POS; émettre l’événement comptable idempotent correspondant et définir le traitement des périodes clôturées.
4. Ajouter des tests transactionnels sur appel direct hors session, profil inactif/hors pharmacie, solde concurrent, répétition de référence, paiements espèces et Mobile Money, annulation/échec partiel et rapprochement comptable.

**Exécution :** inspection des sources versionnées uniquement. Aucun code métier modifié, aucun test SQL exécuté, aucune migration appliquée, aucune donnée distante modifiée et aucun déploiement déclenché.


## 60.29 — SM-01 / point 3 : qualification comptable des ventes à crédit client

**État : incohérence de qualification identifiée entre la finalisation d’une vente à crédit et l’outbox comptable; correction différée jusqu’à définition des écritures de créances.**

### Preuves statiques croisées
1. Dans `supabase/migration_054_client_credit.sql`, `client_credit_enregistrer_vente` finalise la vente en mettant `ventes.statut='payee'` et `ventes.mode_paiement='credit'`, puis augmente le solde de la créance client et crée une opération `client_credit_operations.nature='credit'`.
2. Dans `supabase/migration_20261021_compta_outbox.sql`, le trigger `compta_emettre_evenement_metier` émet un événement `vente_encaissee` à chaque transition vers `payee`; le chemin consulté ne distingue pas `mode_paiement='credit'` des encaissements effectivement reçus et ne transmet pas le mode de paiement dans `donnees`.
3. Dans `supabase/migration_20261022_compta_worker.sql`, le worker accepte `vente_encaissee` et produit l’écriture à partir des mappings génériques de ce type. Il n’a pas de traitement dédié au mouvement de créance client dans le chemin inspecté.

### Risque
La vente à crédit est finalisée opérationnellement et le solde client augmente, mais l’événement comptable créé est qualifié d’« encaissée ». Selon les mappings configurés pour `vente_encaissee`, cela peut comptabiliser à tort une entrée de trésorerie au lieu de constater une créance client, ou créer une divergence entre la comptabilité et le sous-grand-livre `client_credits`. Le risque dépend des mappings réellement validés par pharmacie; aucune écriture réelle ni configuration distante n’a été vérifiée ici.

### Contrat correctif requis
- Distinguer au niveau métier la vente payée immédiatement de la vente finalisée à crédit : événement et clé d’idempotence dédiés, sans réutiliser `vente_encaissee` pour une créance non recouvrée.
- Définir les écritures validées par la comptabilité : constatation de la créance client à la finalisation, puis diminution de la créance et débit du compte de trésorerie approprié lors de chaque recouvrement.
- Rendre les événements de constatation et de recouvrement idempotents, rattachés à la pharmacie, à la vente/créance et à la source de paiement; empêcher le double comptage entre vente, recouvrement et clôture Z.
- Ajouter des tests transactionnels démontrant que la vente à crédit n’augmente pas la trésorerie, que le recouvrement la rapproche par moyen de paiement, que le solde auxiliaire rejoint les écritures comptables et que les reprises concurrentes/doublons ne génèrent pas d’écritures supplémentaires.

**Exécution :** revue statique des migrations versionnées uniquement. Aucun code métier modifié, aucun test SQL exécuté, aucune migration appliquée, aucune donnée distante modifiée et aucun déploiement déclenché.


## 60.30 — SM-01 / point 3 : correction versionnée de l’outbox pour l’octroi de crédit

**État : correctif ajouté sur `main`; validation transactionnelle et qualification comptable par pharmacie encore ouvertes.** Cette section actualise le constat historique de 60.29 : l’incohérence statique identifiée a reçu une correction dans le code versionné, mais ne doit pas être déclarée validée en base ni en comptabilité réelle.

### Preuves statiques croisées sur le HEAD de référence

HEAD vérifié avant mise à jour documentaire : `0e3fbeff0aa83c21584babb9726d519cab4a5ce6` — `fix(compta): distinguer octroi de crédit et encaissement`.

1. `supabase/migration_253_marketplace_credit_accounting.sql` remplace `compta_emettre_evenement_metier()` et ignore explicitement la transition vers `payee` lorsque `mode_paiement='credit'`. Les événements `vente_encaissee` ne sont donc plus émis par ce chemin pour les ventes identifiées comme crédit.
2. La migration ajoute le trigger `compta_outbox_credit_octroi` sur insertion de `client_credit_operations` de nature `credit`. Il émet `credit_octroi`, source `credit_operation`, avec montant FCFA, date comptable Africa/Douala, référence source et clé d’idempotence dédiée.
3. La migration remplace `compta_traiter_evenement(uuid,uuid)` à partir du worker déjà présent dans la migration 249 et ajoute `credit_octroi` à la liste des types acceptés. Les contrôles existants de période ouverte, de mappings débit/crédit, de journal, de rôle `service_role` et de finalisation de l’événement sont conservés dans le texte examiné.
4. `supabase/tests/253_marketplace_credit_accounting.sql` définit des assertions structurelles sur le filtre de vente à crédit, le trigger d’octroi et l’acceptation par le worker. Le fichier termine par `rollback` et un résultat de contrat attendu; cela décrit le test, pas une exécution observée.
5. Le retrait Marketplace à crédit décrit dans `supabase/migration_252_marketplace_credit_withdrawal.sql` lie l’opération d’octroi à la session de caisse et finalise vente, stock et crédit dans une transaction. La migration 253 ne remplace pas ce parcours opérationnel.

### Résultat et limites

- **Correction présente dans le code versionné :** le chemin d’octroi de crédit est séparé de l’événement d’encaissement et possède une clé d’idempotence distincte.
- **Non démontré :** aucune preuve d’exécution de la migration 253 ni du test 253 n’a été obtenue dans cette étape. Aucun rejeu SQL, aucune migration distante, aucune écriture de données et aucun déploiement n’ont été effectués.
- **Configuration comptable encore requise :** chaque pharmacie doit disposer d’un mapping débit/crédit valide pour `credit_octroi`, d’une période ouverte et d’un paramètre de journal `journal_code.credit_octroi`. Le code refuse de traiter l’événement si ces éléments sont absents ou ambigus. La pertinence des comptes retenus doit être validée par la comptabilité; le code générique ne prouve pas à lui seul que les comptes représentent correctement la créance client.
- **Risque restant à tester :** démontrer sur une base de test que l’octroi ne produit aucune entrée de trésorerie, que l’écriture représente bien la créance, qu’un retrait ne crée qu’une seule opération de crédit et qu’une reprise/rejouabilité ne génère pas de doublon comptable.
- **Périmètre distinct :** le rapprochement des remboursements, des sessions de caisse et de la clôture reste à examiner au point 60.28; cette correction ne le clôt pas.

### Conditions de clôture de SM-01 / point 3

1. Exécuter le test 253 sur une base de test reconstruite avec les migrations prérequises et conserver la sortie réelle.
2. Ajouter ou confirmer des assertions transactionnelles : aucun `vente_encaissee` pour une vente à crédit; un seul `credit_octroi`; rollback atomique si l’octroi échoue; absence de double écriture après rejeu.
3. Vérifier les comptes et journaux `credit_octroi` pour chaque pharmacie concernée, sans présumer de mappings existants.
4. Réconcilier la vente, `client_credit_operations`, le solde `client_credits`, l’événement outbox et l’écriture comptable dans les tests.
5. Puis reprendre séparément le point 60.28 sur les remboursements, la caisse et le rapprochement de clôture.

**Exécution de cette étape :** lecture statique des fichiers versionnés et mise à jour documentaire uniquement. Aucun test exécuté, aucune migration appliquée, aucune base distante modifiée et aucun déploiement déclenché.


## 60.31 — SM-01 / point 60.28 : cohérence entre clôture de caisse et garde de session

**État : défaut de cohérence identifié puis corrigé dans les fichiers versionnés; test structurel ajouté, exécution toujours non démontrée.**

### Défaut établi par comparaison des fonctions

1. `supabase/migration_250_caisse_credit_repayment_reconciliation.sql` calcule le solde théorique de clôture en ajoutant les remboursements de crédit rattachés à la session : fond initial + espèces des ventes + remboursements crédit − décaissements.
2. La garde `public.naxa_guard_caisse_session_write()` définie par `supabase/migration_169_caisse_guard_decaissements.sql` recalcule le même solde lors de la mise à jour de `caisses_sessions`, mais sa formule d’origine n’incluait pas les remboursements de crédit.
3. Conséquence : lors d’une clôture comportant un remboursement, la RPC pouvait calculer le nouveau total théorique, puis la garde déclencher une exception car elle recalculait un total différent. La transaction de clôture pouvait donc être rejetée malgré une formule correcte dans la RPC.

### Correction versionnée

- La migration 250 redéfinit maintenant aussi `naxa_guard_caisse_session_write()`, en conservant ses contrôles d’ouverture/clôture, d’identité du titulaire, d’immutabilité des paramètres d’ouverture et de cohérence du rapprochement.
- La garde inclut les opérations `client_credit_operations` de nature `remboursement` rattachées à `caisse_session_id` dans le même calcul que `caisse_cloturer`.
- Le test `supabase/tests/250_caisse_credit_repayment_reconciliation.sql` vérifie désormais structurellement la formule de la RPC **et** celle de la garde.

### Limites et suite

- Le test est ajouté au dépôt, mais **n’a pas été exécuté**. Aucune migration n’a été appliquée à une base distante et aucun parcours réel de clôture n’a été testé.
- La vérification de clôture doit couvrir une session sans remboursement, une session avec un remboursement, un écart justifié et non justifié, ainsi que la concurrence entre clôture et remboursement.
- Le contrat actuel traite les remboursements enregistrés par la RPC comme des entrées d’espèces de la session de caisse. Toute extension future à un remboursement par virement ou portefeuille mobile devra distinguer le moyen d’encaissement afin de ne pas l’ajouter au tiroir espèces.
- Le rapprochement comptable de l’événement `credit_remboursement` reste distinct du comptage physique : l’écriture comptable et le sous-grand-livre doivent être rapprochés séparément.

**Exécution :** comparaison statique des migrations 169 et 250, correction du code versionné et extension du test structurel. Aucun test SQL exécuté, aucune migration appliquée, aucune donnée distante modifiée et aucun déploiement déclenché.


## 60.32 — SM-01 / point 60.28 : moyen de paiement structuré pour les remboursements

**État : correctif versionné ajouté; contrat de test présent; exécution SQL et parcours de caisse non validés.**

### Constat statique

L’interface de caisse utilisait un champ libre « Motif / mode de règlement » pour appeler `client_credit_rembourser`, alors que la clôture ajoutait chaque remboursement lié à la session au tiroir espèces. Le texte libre n’était pas un moyen de paiement fiable et pouvait faire compter un remboursement non liquide comme des espèces. En parallèle, les RPC de vente interdisent actuellement les paiements électroniques faute de confirmation opérateur officielle.

### Correctif versionné

1. `supabase/migration_254_credit_repayment_payment_mode.sql` ajoute `client_credit_operations.mode_paiement` avec le type existant `public.mode_paiement_caisse`.
2. La nouvelle signature de `client_credit_rembourser` reçoit un mode explicite et refuse tout mode autre que `especes` tant que les paiements électroniques ne sont pas confirmés par un opérateur. L’ancienne signature est conservée comme wrapper de compatibilité et transmet explicitement `especes`.
3. Les nouvelles opérations stockent le mode structuré. La clôture et la garde de session ne comptent désormais que les remboursements dont `mode_paiement='especes'`.
4. La reprise des opérations historiques est volontairement limitée aux libellés explicites exacts `Espèces`/`especes`. Les autres anciennes opérations conservent un mode NULL plutôt que de supposer leur moyen de paiement.
5. `src/app/pharmacie/caisse/[section]/page.tsx` envoie maintenant `p_mode: "especes"` et demande un motif facultatif, en précisant que seul l’encaissement espèces est disponible.
6. `supabase/tests/254_credit_repayment_payment_mode.sql` vérifie structurellement la colonne, la signature typée et le filtre espèces de la clôture et de sa garde.

### Points de contrôle encore ouverts

- Les opérations historiques dont le mode reste NULL ne sont pas ajoutées au tiroir espèces. Toute session encore ouverte qui contient de telles opérations doit être réconciliée sur preuves de caisse avant clôture; ne pas convertir automatiquement ces lignes en espèces.
- Le mode espèces est le seul mode pris en charge par ce parcours. Orange Money, MTN MoMo et les autres moyens électroniques ne doivent pas être déclarés encaissés avant intégration d’une confirmation opérateur officielle.
- Les événements comptables `credit_remboursement` doivent continuer à être rapprochés du sous-grand-livre et des écritures; le total espèces de caisse n’est pas, à lui seul, une preuve de bonne qualification comptable.
- Le test 254 est une assertion structurelle versionnée; il n’a pas été exécuté. La migration n’a pas été appliquée à une base distante et aucun test de clôture réel n’a été mené.

**Exécution :** lecture statique, migration 254 ajoutée, appel UI mis à jour, test structurel ajouté et document central actualisé. Aucun test exécuté, aucune migration appliquée, aucune donnée distante modifiée et aucun déploiement déclenché.


## 60.33 — SM-01 / point 60.28 : sécurisation du contrat historique de remboursement

**État : durcissement ajouté sur `main`; validation SQL non exécutée.**

### Constat

La migration 254 conserve la signature historique `client_credit_rembourser(uuid,integer,text,text)` pour compatibilité et la fait déléguer à la nouvelle RPC typée en lui attribuant le mode espèces. Or l’ancien écran utilisait le champ libre « Motif / mode de règlement ». Une application ancienne pouvait donc envoyer un libellé tel que « Orange Money » via cette signature, qui aurait été enregistré à tort comme espèces malgré la nouvelle colonne structurée.

### Correctif

- `supabase/migration_255_credit_repayment_legacy_guard.sql` remplace le wrapper historique : il n’accepte que le motif vide ou une mention explicite d’espèces. Tout autre texte est rejeté avec une instruction d’utiliser le contrat typé.
- Le parcours actuel reste sur la signature structurée `p_mode='especes'` et ne change pas.
- `supabase/tests/255_credit_repayment_legacy_guard.sql` ajoute des assertions structurelles sur les deux signatures et sur le rejet du contrat historique ambigu.

### Limites et suites

- Le test 255 n’a pas été exécuté et la migration n’a pas été appliquée à une base. Le rejet en production n’est donc pas encore vérifié.
- Les intégrations qui appelleraient encore la signature historique avec un motif libre non vide devront migrer vers la signature typée; cette rupture ciblée est intentionnelle pour éviter une qualification financière implicite.
- Le prochain contrôle doit confirmer que le trigger comptable `credit_remboursement` reste attaché après insertion et qu’une opération ne crée qu’un seul événement outbox avec sa clé d’idempotence. Il faut également vérifier le contrat du worker et l’écriture comptable sur une base de test, sans inférer la validité des comptes à partir du seul code.

**Exécution :** revue statique des migrations 249/254, sécurisation du wrapper historique, ajout d’un test structurel et mise à jour documentaire. Aucun test exécuté, aucune migration appliquée, aucune base distante modifiée et aucun déploiement déclenché.

## 60.34 — SM-01 / point 60.28 : contrôle statique de l’idempotence outbox → écriture comptable

**État : invariants d’idempotence présents dans le code versionné; preuve d’exécution et rapprochement transactionnel encore ouverts.**

### Éléments vérifiés sur `main`

1. **Émission d’un remboursement.** `migration_249_credit_repayment_accounting.sql` crée l’événement après insertion d’une opération de nature `remboursement`. La clé est déterministe (`credit_operation:<id>:credit_remboursement`) et l’insertion utilise `ON CONFLICT (pharmacie_id,cle_idempotence) DO NOTHING`.
2. **Émission de l’octroi.** `migration_253_marketplace_credit_accounting.sql` applique le même principe à `credit_octroi`, avec une clé distincte (`credit_operation:<id>:credit_octroi`). Le filtre de l’événement de vente ignore explicitement les ventes dont `mode_paiement='credit'`; les deux événements ne partagent donc pas la même clé ni le même type métier.
3. **Contrainte de l’outbox.** Le socle `migration_20261020_compta_socle.sql` définit une unicité sur `(pharmacie_id, cle_idempotence)` pour `compta_evenement`. L’outbox et les écritures ont chacune leur propre contrainte d’unicité par pharmacie et clé d’idempotence.
4. **Réclamation concurrente.** `migration_20261021_compta_outbox.sql` réclame les événements avec `FOR UPDATE SKIP LOCKED`, augmente le compteur de tentatives et attribue un `claim_token`. Le worker exige l’événement `en_cours` avec le jeton correspondant.
5. **Rejeu de l’écriture.** `compta_poster_ecriture` recherche une écriture existante pour la même pharmacie et la même clé. Si elle existe, il compare période, date, journal, source, référence, libellé et lignes; un contenu différent est rejeté au lieu d’être silencieusement accepté.
6. **Finalisation.** `compta_evenement_terminer` ne permet le succès que si une écriture correspondante existe avec la même pharmacie, source et clé. Le worker appelle cette finalisation après le postage. Le bloc de gestion d’erreur du worker remet l’événement en attente (ou en erreur après le seuil de tentatives) si le traitement échoue.

### Conclusion limitée

- **Présence statique confirmée :** les protections de base contre la duplication sont conçues à plusieurs niveaux — clé d’événement unique, réclamation avec verrou, jeton de traitement, clé d’écriture unique, comparaison du contenu lors d’un rejeu et contrôle de l’écriture avant finalisation.
- **Non démontré :** cette lecture ne prouve pas le comportement sous concurrence réelle, ni l’atomicité effective sur le schéma reconstruit, ni l’absence de doublons dans des données existantes. Les tests 249, 253, 254 et 255 sont présents dans le dépôt mais n’ont pas été exécutés ici.
- **Rapprochement encore nécessaire :** pour chaque opération testée, vérifier exactement une opération source, un événement outbox par type attendu, au plus une écriture comptable par clé, deux lignes équilibrées, et l’absence d’un événement `vente_encaissee` pour l’octroi crédit. Le total du solde client, l’écriture de créance, les remboursements et le tiroir espèces doivent être rapprochés séparément.
- **Configuration comptable :** aucun compte ni journal n’est présumé correct. Les mappings de `credit_octroi` et `credit_remboursement` restent à valider par pharmacie et par un responsable comptable; la validation de présence/unicité du mapping par le worker n’en certifie pas la pertinence SYSCOHADA.
- **Limite de test :** les fichiers 249 et 253 vérifient principalement la structure des fonctions et triggers; ils ne constituent pas à eux seuls une preuve transactionnelle de rejeu ou de concurrence.

### Suite immédiate

1. Exécuter les tests 249, 250, 253, 254 et 255 sur une base de test reconstruite avec toutes les migrations prérequises et conserver les sorties réelles.
2. Ajouter/compléter un scénario transactionnel de remboursement : insertion unique, émission outbox unique, traitement du même événement rejoué, puis vérification de l’unicité de l’écriture et de l’équilibre débit/crédit.
3. Tester un échec de mapping ou de période, puis corriger la configuration de test et rejouer : l’événement doit rester retraitable sans générer une seconde écriture.
4. Tester deux workers concurrents et la perte/expiration d’un `claim_token`; un worker périmé ne doit pas finaliser l’événement.
5. Réconcilier les remboursements historiques à mode `NULL` avec les tickets avant toute clôture de session concernée.

**Exécution :** lecture statique des migrations 249, 253 et du socle/worker comptables versionnés. Aucun test SQL exécuté, aucune migration appliquée, aucune donnée distante modifiée, aucune branche créée et aucun déploiement déclenché.


## 60.35 — Correction du backfill historique du mode de remboursement

**Constat corrigé sur `main` :** la migration 254 ne doit jamais inférer un paiement espèces à partir de `motif`, champ libre historiquement saisi par l’utilisateur. Même un libellé exact « Espèces » ne constitue pas une preuve du paiement réellement encaissé.

**Modification appliquée :** suppression du bloc `UPDATE` qui affectait `mode_paiement='especes'` aux remboursements historiques en fonction de `motif`. La migration précise désormais que les opérations historiques restent à `NULL` jusqu’à une réconciliation fondée sur une preuve fiable. La clôture de caisse et sa garde continuent à ne comptabiliser que les remboursements dont le mode structuré est explicitement `especes`.

**Vérification statique après écriture :** relecture de la migration 254 depuis `main`; le prédicat d’inférence par `motif` et l’affectation historique correspondante sont absents. Le test SQL 254 existant contrôle la présence du champ typé, le contrat de la RPC, et le filtrage espèces de la clôture et de sa garde; il ne prouve pas à lui seul le comportement d’une migration rejouée sur des données historiques.

**État de validation :** aucun test SQL exécuté, aucune migration appliquée sur une base distante, aucune donnée distante modifiée et aucun déploiement déclenché. La correction du fichier versionné est confirmée; le comportement sur une base reconstruite et la réconciliation des remboursements historiques restent à tester.


## 60.36 — SM-01 / point 60.28 : rejet complet du contrat legacy de remboursement

**État : durcissement versionné sur `main`; exécution SQL et compatibilité applicative non vérifiées.**

### Constat statique

La migration 255 précédente refusait les motifs ambigus, mais acceptait encore un motif libre égal à « Espèces » et le transformait en mode structuré `especes`. Cela supprimait les valeurs manifestement non espèces, mais ne prouvait toujours pas qu’un encaissement physique avait eu lieu. Le champ historique reste une donnée fournie par l’appelant, pas une preuve de caisse.

### Correction versionnée

1. `supabase/migration_255_credit_repayment_legacy_guard.sql` remplace désormais le wrapper historique par un rejet systématique. La signature legacy ne peut plus créer de remboursement ni déduire un moyen de paiement à partir de `p_motif`.
2. Les appels doivent utiliser la signature typée de la migration 254, qui reçoit `p_mode` séparément et n’autorise actuellement que `especes`.
3. `supabase/tests/255_credit_repayment_legacy_guard.sql` vérifie structurellement que le wrapper legacy lève une exception et ne lit plus `v_motif`, tout en conservant l’assertion sur la contrainte espèces de la RPC typée.

### Compatibilité et limites

- Tout client encore lié à la signature historique recevra une erreur et devra migrer vers la signature typée. Le callsite de caisse actuellement observé utilise déjà `p_mode: "especes"`, mais l’ensemble des consommateurs n’a pas été recherché exhaustivement.
- Le test 255 n’a pas été exécuté. Il ne s’agit donc pas d’une validation SQL runtime ni d’une preuve de compatibilité de tous les consommateurs.
- La migration 254 reste versionnée uniquement : aucun test SQL exécuté, aucune migration appliquée à une base distante, aucune donnée distante modifiée et aucun déploiement déclenché.

**Suite immédiate :** inventorier les callsites SQL/RPC de l’ancienne signature, vérifier les migrations 249/253/254/255 ensemble sur une base de test reconstruite, puis exécuter le parcours de remboursement et clôture avec tickets de caisse de test. Les opérations historiques à mode `NULL` doivent être réconciliées sur preuves, jamais reclassées à partir de leur motif.


## 60.37 — SM-01 / points 60.29–60.30 : cohérence entre lots affectés et retrait Marketplace à crédit

**État : correctif versionné sur `main`; validation SQL et transactionnelle non exécutée.**

### Constat statique

La migration 247 affecte logiquement des lots FEFO à une réservation Marketplace via `reservation_item_lots`, sans débit physique à l'approbation. En revanche, la fonction de retrait `vente_reservation_credit_finaliser` (migration 252) parcourait les lots vendables du produit dans l'ordre FEFO global, sans cibler les affectations de la réservation courante. Le retrait pouvait donc consommer un lot affecté à un autre hold et ne pas respecter l'allocation préparée.

### Correctif ajouté

1. Nouvelle migration `supabase/migration_256_credit_withdrawal_reserved_lots.sql` : le retrait exige que la somme des affectations non restaurées de chaque produit corresponde exactement à la quantité de la réservation.
2. Le retrait verrouille les lignes des lots et leurs affectations, consomme uniquement les lots liés à la réservation et au produit courants, puis crée les lignes de vente avec les identifiants des lots réellement débités.
3. Si l'affectation est absente, incohérente, restaurée, expirée, bloquée ou insuffisante, la transaction échoue au lieu de consommer silencieusement un autre lot.
4. Le débit physique demeure au retrait : la migration 251 continue à créer le hold sans décrémenter le stock. La fonction de retrait conserve le contrôle de session de caisse, la liaison à la demande approuvée et la consommation atomique de la demande.
5. Nouveau test structurel `supabase/tests/256_credit_withdrawal_reserved_lots.sql` : vérifie le ciblage de l'affectation par réservation/produit, l'égalité des quantités, le verrouillage des lots et affectations, et l'absence de l'ancien parcours FEFO global.

### Limites de validation

- Le test 256 n'a pas été exécuté; il vérifie le contrat statique de la fonction après application des migrations sur une base de test.
- Il reste à exécuter un scénario transactionnel avec deux réservations partageant plusieurs lots, à retirer la seconde avant la première et à vérifier que chaque vente consomme ses lots affectés, que les quantités de lots et de stock agrégé concordent et qu'un échec restaure toute la transaction.
- Aucune migration n'a été appliquée à une base distante, aucune donnée distante n'a été modifiée et aucun déploiement n'a été déclenché.

**Suite immédiate :** vérifier les migrations 247, 251, 252 et 256 ensemble sur une base reconstruite; tester concurrence, lots périmés/bloqués, annulation/expiration et rollback avant de considérer le parcours validé.


## 60.38 — Vérification croisée simultanée des cinq scénarios de retrait crédit Marketplace

**État : 5/5 contrats cohérents à la lecture statique; aucune validation transactionnelle exécutée.** Revue croisée des migrations 247, 203, 209, 212 et 256, sans changement de données ni appel de RPC sur une base distante.

| Scénario | Résultat statique | Justification / limite |
|---|---|---|
| 1. Retraits dans l'ordre inverse | Cohérent | La migration 256 ne parcourt plus les lots FEFO globaux : elle cible `reservation_item_lots` par réservation et produit, puis verrouille `l` et `a`. L'allocation faite à l'approbation 247 permet d'isoler les quantités. Le scénario à deux réservations n'a pas été exécuté. |
| 2. Stock agrégé et lots | Cohérent sous le contrat des garde-fous | Le retrait diminue les lots affectés et le stock agrégé dans la même fonction/transaction; la mise à jour agrégée est conditionnée par `quantite >= quantité demandée`. La garde de cohérence lot/agrégé doit rester active. Aucun jeu de données n'a été rapproché en exécution. |
| 3. Lot périmé, bloqué ou insuffisant | Refus prévu | La sélection du retrait exclut les lots bloqués/périmés et lève une exception si la quantité restante ne peut pas être servie par les allocations valides. L'exception doit faire annuler l'opération entière; pas de test d'injection exécuté. |
| 4. Rollback intégral | Garanti par la frontière transactionnelle SQL, à confirmer en test | La fonction ne capture pas ses erreurs métier et propage les exceptions. PostgreSQL annule alors les écritures de l'appel; le cron d'expiration capture séparément les erreurs par dossier. Aucun échec provoqué après création de vente n'a été injecté. |
| 5. Annulation et expiration | Cohérent pour les holds modernes | Les réservations crédit modernes sont créées avec `stock_decremented=false`. `restore_stock` ne réajoute donc pas artificiellement du stock physique; l'annulation passe par `set_reservation_status` et l'expiration appelle `restore_stock` avant de marquer `expiree`. Les allocations restent en historique, mais cessent d'être actives car les requêtes de réservation filtrent sur les statuts actifs. Pas de test chronologique exécuté. |

### Conclusion opérationnelle

Aucun défaut statique supplémentaire n'a été démontré dans ces cinq points; ajouter une migration sans preuve créerait du bruit. La suite pertinente est un test d'intégration transactionnel unique qui exécute les cinq scénarios dans une base de test reconstruite, avec assertions sur les quantités avant/après et sur l'absence de vente/crédit/consommation résiduelle après échec.

**Limite explicite :** ce contrôle est une revue de code, pas une preuve d'exécution SQL. Les tests structurels 247, 252 et 256 et les tests d'expiration/restauration ne sont pas déclarés réussis tant qu'ils n'ont pas été exécutés. Aucune migration distante, donnée distante ou déploiement n'a été touché.


## 60.39 — Test regroupé des cinq scénarios crédit Marketplace

Le test `supabase/tests/257_credit_withdrawal_five_scenarios.sql` regroupe :
1. retrait selon l'allocation propre à chaque réservation et verrouillage lot/allocation ;
2. contrat de décrément conjoint des lots et du stock agrégé ;
3. refus des lots bloqués/périmés et des allocations insuffisantes ;
4. propagation d'erreur et rollback ;
5. restauration idempotente, annulation et expiration.

**Exécution réelle effectuée :** les cinq fixtures SQL temporaires ont été exécutées sur le projet Supabase de replay CI `naxa-ci-replay-2`. Résultat retourné par PostgreSQL : `257 fixture scenarios 1-5 PASS (temporary tables only; transaction rolled back)`. Les tables de test étaient temporaires et la transaction a été annulée ; aucune donnée métier persistante n'a été modifiée.

**Limite importante : le test intégré complet n'est pas encore PASS.** La vérification préalable en lecture seule a montré que le schéma de ce replay ne contient pas encore `public.vente_reservation_credit_finaliser(uuid,uuid,text)`. Le script complet s'arrêterait donc au contrôle du contrat avant les fixtures. Le projet Naxa principal ne contient pas non plus cette fonction ; aucune migration n'y a été appliquée. Il n'est pas acceptable de présenter le succès des fixtures isolées comme une validation d'exécution du retrait réel.

Le contrat de statut a été corrigé dans le script pour référencer `private.set_reservation_status(uuid,public.resa_statut)`. Pour fermer la validation intégrée, il faut un environnement de test reconstruit avec les migrations 247, 252 et 256 et leurs prérequis, puis exécuter le script complet. Aucun déploiement ni changement de schéma distant n'a été effectué.

## 60.40 — Résultats des contrôles structurels 247/256 sur le replay CI

**Exécution réelle en lecture seule sur le replay CI `naxa-ci-replay-2` :**

- `supabase/tests/247_credit_marketplace_stock_contract.sql` : **ÉCHEC** — PostgreSQL retourne `P0001: Champs du contrat Marketplace incomplets`.
- `supabase/tests/256_credit_withdrawal_reserved_lots.sql` : **ÉCHEC** — PostgreSQL retourne `P0001: RPC retrait crédit absente`.
- Les contrôles de schéma avaient également établi que `public.vente_reservation_credit_finaliser(uuid,uuid,text)` est absente du replay CI et du projet NAXA principal.

**Interprétation :** ces échecs indiquent que le schéma interrogé ne correspond pas à l'état attendu après application des migrations versionnées. Ils ne prouvent pas à eux seuls que les migrations 247/256 sont défectueuses. Le test 257 intégré ne peut pas être déclaré PASS tant que le contrat réel n'est pas présent dans un environnement reconstruit.

**Suite retenue :** reconstruire un PostgreSQL local/éphémère avec les migrations et prérequis du dépôt, puis exécuter les tests 247, 256 et 257 dans cet ordre. À défaut d'un moteur local disponible, rechercher un runner isolé sans écrire dans les projets Supabase distants. Les projets distants restent en lecture seule : aucune migration appliquée, aucun dossier métier créé, aucune donnée persistante modifiée, aucun déploiement.


## 60.41 — Bilan de clôture du sous-chantier crédit Marketplace / stock / retrait caisse

**Décision d’audit au 28 octobre 2026 : implémentation versionnée et revue statiquement ; clôture technique complète non démontrée, car le test intégré du chemin réel ne peut pas être exécuté avec les environnements accessibles sans écrire dans une base distante.** Ce bilan clôt la passe de travail et évite de relancer les mêmes vérifications sans nouvel environnement ou nouvelle preuve.

### Périmètre couvert dans cette passe

- Soumission d’une demande de crédit Marketplace et champs du contrat : migration 247 et test structurel 247.
- Approbation/refus et hold logique du stock, allocation des lots sans débit physique à l’approbation.
- Retrait en caisse par la RPC `vente_reservation_credit_finaliser(uuid,uuid,text)`, avec contrôle de session/pharmacie, lien à la demande approuvée, création atomique de la vente et de l’opération de crédit.
- Correctif migration 256 : consommation des lots affectés à la réservation et au produit concernés, verrouillage des lignes, vérification de quantité, exclusion des lots bloqués/périmés et débit agrégé cohérent selon le modèle de hold.
- Remboursement de crédit et garde-fous des migrations 248–255 examinés dans les entrées d’audit précédentes ; leurs parcours d’intégration ne sont pas réputés validés en exécution ici.
- Annulation/expiration/restauration, rollback, idempotence et retrait dans l’ordre inverse couverts par revue statique et par les fixtures temporaires du test 257.

### Résultats d’exécution observés

| Contrôle | Résultat |
|---|---|
| Fixtures temporaires des cinq scénarios 257 | **PASS**, tables temporaires uniquement, transaction annulée |
| Test structurel 247 sur le replay CI | **ÉCHEC** : champs du contrat Marketplace absents du schéma interrogé |
| Test structurel 256 sur le replay CI | **ÉCHEC** : RPC de retrait absente du schéma interrogé |
| Contrôle préalable de la RPC sur le projet NAXA principal | **ABSENTE** ; vérification en lecture seule |
| Test intégré complet 257 | **BLOQUÉ** : contrat RPC requis absent dans le replay |
| Reconstruction PostgreSQL locale isolée | **INDISPONIBLE** : aucun binaire `psql`, `postgres`, `docker`, `podman` ou `supabase` accessible dans l’environnement de travail inspecté |

Les échecs 247/256 démontrent un écart entre le schéma des bases interrogées et les migrations attendues ; ils ne démontrent pas, à eux seuls, que les migrations versionnées sont incorrectes. Les fixtures PASS ne constituent pas une preuve de fonctionnement de la RPC réelle.

### Sécurité et périmètre respectés

- Travail limité au dépôt et à la lecture des schémas distants.
- Aucune branche créée, aucune pull request ouverte.
- Aucune migration appliquée au projet NAXA principal ni au replay CI.
- Aucune donnée métier persistante modifiée.
- Aucun déploiement ni relance de déploiement déclenché.

### Décision de passage

Le code versionné a reçu une revue statique ciblée et les scénarios de fixture isolés passent. **Le critère strict « chantier validé / vert » n’est pas atteint** tant que les migrations 247, 252 et 256 avec leurs prérequis ne sont pas rejouées dans un PostgreSQL de test isolé, puis que les tests 247, 256 et 257 ne passent pas ensemble. Cette étape est une validation bloquée par l’environnement, pas une invitation à modifier les bases distantes ni à répéter les mêmes essais.

Pour reprendre ultérieurement, la seule action utile est de fournir/ouvrir un runner PostgreSQL isolé avec les migrations et prérequis du dépôt. À ce moment-là, exécuter les tests dans l’ordre 247 → 256 → 257, puis ajouter la preuve de résultat à cet audit. Aucun autre correctif de code n’est justifié par les éléments observés dans cette passe.

## 60.42 — Passe finale et décision de sortie du sous-chantier crédit Marketplace

**Date : 29 octobre 2026 — périmètre de la passe finale : dépôt `main`, migrations versionnées, tests SQL, audit administrateur et environnements Supabase consultables en lecture seule.**

### Vérifications finales consolidées

- Relecture des contrats sources 247, 252 et 256, des tests 247, 255, 256 et 257, du job SQL CircleCI et des sections 60.37 à 60.41 de cet audit.
- Le job SQL CircleCI prévoit déjà un Supabase local éphémère, un rejeu complet des migrations et l'exécution des tests SQL. Cette voie est la bonne pour la preuve d'intégration; elle n'a pas été déclenchée dans cette passe, conformément à l'interdiction de relancer la CI.
- Les cinq fixtures temporaires du test 257 restent le seul succès d'exécution confirmé pour les invariants simulés. Elles ne prouvent pas le fonctionnement de la RPC de retrait réelle.
- Les échecs 247 et 256 observés sur le replay distant sont expliqués par l'absence des colonnes/fonctions attendues dans le schéma interrogé; le test intégré 257 est donc bloqué avant ses assertions de contrat. Ces résultats ne justifient ni une correction spéculative des migrations ni une écriture sur un projet distant.
- Le dépôt contient le correctif d'allocation des lots et le test intégré regroupé. Aucun défaut statique nouveau justifiant une autre migration n'a été établi pendant cette passe.
- Aucun binaire/runtime PostgreSQL local exploitable n'est disponible dans l'environnement de travail inspecté. Les seules bases accessibles restent strictement en lecture seule.

### Décision sans ambiguïté

**Implémentation et revue statique : terminées pour ce sous-chantier. Validation runtime intégrée : NON VALIDÉE / BLOQUÉE par l'absence d'un rejeu isolé exécutable dans cette session.**

En conséquence, ce sous-chantier peut être fermé comme **passe d'implémentation terminée avec réserve de validation documentée**, mais il ne peut pas recevoir honnêtement le statut « vert / chantier techniquement validé » défini par cet audit. Marquer « vert » sans preuve des tests 247, 256 et 257 exécutés ensemble serait contraire au critère de validation et aux preuves consignées.

Pour éviter toute boucle de travail, aucune nouvelle analyse ni correction n'est à entreprendre sur ce sous-chantier dans le cadre de cette passe. La réserve est explicitement transférée au registre des validations bloquées : elle ne sera réouverte que si un résultat de CI existant est consultable sans relance, ou si un runner PostgreSQL isolé devient effectivement disponible et autorisé. Dans ce cas seulement, la preuve attendue est l'exécution conjointe des tests 247, 256 et 257 après rejeu des migrations/prérequis.

### Garde-fous confirmés

- Aucun branchement, aucune PR, aucune fusion distincte de ce commit documentaire.
- Aucune migration ni écriture de données sur Supabase principal ou replay distant.
- Aucun déploiement, aucune relance CI ou de workflow.
- Aucun succès de test intégré ou de validation production revendiqué.

**Sortie de passe :** le dossier d'audit contient désormais la décision finale, les limites probatoires et le déclencheur précis d'une éventuelle réouverture. Le chantier principal peut continuer sur un autre sous-chantier sans réitérer les mêmes tentatives.


## 60.43 — Identité complète dans les notifications J-5 et règlements Promoteur (29 octobre 2026)

### Constat croisé
- Le job Supabase actif `naxa-promoteur-echeance-5j` exécute `public.generer_rappels_echeance_promoteurs()` chaque jour à 06:00 UTC. Le corps du rappel J-5 comportait le nom du Promoteur côté administration mais pas ses pharmacies rattachées; le rappel envoyé au Promoteur ne donnait ni son nom complet ni son réseau de pharmacies.
- La RPC `public.promoteur_soumettre_reglement` envoyait à l’administrateur le nom du Promoteur, le montant, le canal, le compte payeur, la référence et la date, mais pas les pharmacies concernées.
- La page `/admin/pilotage/reglements` montrait le Promoteur et la preuve de paiement, sans nommer sa ou ses pharmacies. Une autre route `/api/cron/validite` existe dans le code mais aucun `vercel.json` ne la planifie; le seul ordonnanceur explicite dans le dépôt et le schéma lu est le job Supabase. Aucun second schedule n’a été ajouté.

### Correctifs versionnés
- Le rappel J-5 indique maintenant le nom complet du Promoteur et les noms de toutes ses pharmacies liées, pour les notifications Promoteur et Admin.
- L’alerte de déclaration de paiement contient le nom du Promoteur et les noms de ses pharmacies; le message de confirmation interne au Promoteur contient aussi ce contexte.
- La file d’approbation Admin affiche la liste de pharmacies pour les règlements en attente et dans l’historique. Si le chargement des liaisons échoue, la page l’indique explicitement au lieu d’afficher une liste vide trompeuse.
- La route protégée `/api/cron/validite` utilise le même contexte de réseau et échappe les noms avant insertion dans le HTML e-mail. Elle reste non planifiée par Vercel dans le dépôt afin de conserver une seule source de planification, le cron Supabase existant.
- Le générateur J-5 respecte désormais aussi le marqueur de rappel « en cours » pour éviter de concurrencer une exécution revendiquant déjà le même rappel.

### Preuves et limites
- En lecture seule, la base NAXA a confirmé un seul job actif `naxa-promoteur-echeance-5j` à `0 6 * * *`, et les colonnes relationnelles `promoteur_pharmacies.promoteur_id/pharmacie_id` ainsi que `pharmacies.id/nom`.
- Test structurel ajouté : `supabase/tests/20261029120000_promoteur_notifications_include_pharmacies.sql`. Il vérifie le texte des fonctions, leur sécurité et leurs droits, mais n’a pas été exécuté.
- Migration additive préparée : `supabase/migrations/20261029120000_promoteur_notifications_include_pharmacies.sql`.
- Aucun test runtime, build/typecheck/lint ou envoi de notification réelle exécuté. Aucune migration appliquée, aucune donnée métier modifiée et aucun déploiement déclenché.


## 60.44 — Clôture du point 3 : retrait crédit Marketplace, lots et cohérence du stock (29 octobre 2026)

### Décision de clôture
**Point 3 clos côté code et validation technique isolée.** La clôture porte sur le contrat du retrait crédit Marketplace, les allocations de lots, le stock physique/agrégé, la traçabilité vente-crédit et la disponibilité Marketplace. Elle ne signifie ni application en Production ni autorisation de déploiement.

### Contradictions résolues par preuve
1. **Tests 247/251 : faux négatifs de test.** Des assertions supprimaient les espaces de la fonction contrôlée mais recherchaient encore des chaînes avec espaces; une autre assertion 251 attendait que l'ancienne RPC générique d'encaissement consomme le hold alors que cette voie est volontairement rejetée. Les assertions ont été corrigées pour tester le contrat canonique réel.
2. **Disponibilité Marketplace : défaut fonctionnel confirmé.** La fonction `marketplace_offre_stock_disponible` comptait les lots vendables/le stock agrégé sans retrancher les holds modernes encore actifs. Or la réservation moderne ne débite pas physiquement le stock. La migration additive `supabase/migration_258_marketplace_availability_subtract_holds.sql` retranche désormais les réservations actives non expirées, non consommées, non restaurées et non déjà débitées; le stock physique reste inchangé lors du hold.
3. **Retrait crédit réel : défauts révélés par E2E.** Le premier parcours réel a révélé des références ambiguës à `vente_id` dans la fonction qui retourne elle-même une colonne `vente_id`, un CHECK qui refusait `paiement_mode='credit'`, une vente restée en brouillon avant la transition de réservation à `payee`, et un reçu POS incomplet faute de `montant_percu`/`monnaie_rendue`. La migration additive `supabase/migration_259_credit_withdrawal_qualify_request_columns.sql` qualifie les mises à jour, autorise le mode crédit, finalise la vente POS après création de l'opération de crédit et renseigne les champs requis par le snapshot du reçu.
4. **Pas de contournement de la preuve.** Les défauts ont été reproduits dans le replay non-Production, corrigés dans des migrations additives versionnées sur `main`, puis retestés. Les essais E2E sont des transactions annulées; aucune fixture métier ne persiste.

### Preuves d'exécution — replay non-Production `naxa-ci-replay-2`
Les migrations nécessaires au schéma de test ont été rejouées dans ce projet isolé uniquement. Résultats confirmés au 29 octobre 2026 :

| Test | Résultat | Portée |
|---|---|---|
| `247_credit_marketplace_stock_contract.sql` | **PASS** | Contrat demande, hold et allocation |
| `251_credit_hold_no_physical_decrement.sql` | **PASS** | Hold sans débit physique; retrait canonique traçable |
| `252_marketplace_credit_withdrawal.sql` | **PASS** | Contrat de la RPC de retrait |
| `255_credit_repayment_legacy_guard.sql` | **PASS** | Refus de la signature legacy et garde du mode typé |
| `256_credit_withdrawal_reserved_lots.sql` | **PASS** | Allocation propre à la réservation, verrous et quantités |
| `257_credit_withdrawal_five_scenarios.sql` | **PASS** | Contrats des cinq scénarios et fixtures rollback |
| `258_marketplace_availability_subtract_holds.sql` | **PASS** | Test comportemental : un hold de 4 sur 10 rend 6 disponibles, stock physique inchangé; consommation et legacy sans double-déduction |
| `259_credit_withdrawal_inverse_order_e2e.sql` | **PASS** | E2E de la RPC réelle : deux réservations partageant le produit, retrait de la seconde avant la première, bons lots, quantités de stock, deux ventes et deux opérations de crédit; rollback confirmé |

### État exact de clôture
- Implémentation additive et tests sources : présents sur `main`.
- Tests SQL structurels et comportementaux ci-dessus : exécutés et PASS dans le replay non-Production.
- Les tests E2E confirment la consommation des allocations propres aux réservations dans l'ordre inverse, la concordance stock-lots/agrégé et la création cohérente vente/crédit.
- **Production NAXA (`eouwtuusnsuxaejsxknf`) : non modifiée par cette passe.** Aucune migration 258/259 appliquée à Production, aucune donnée métier Production modifiée, aucun déploiement Preview/Production déclenché, aucun workflow CI relancé.
- Le déploiement et l'application Production restent soumis au point d'arrêt explicite « OUI, DÉPLOIE » du mandat; ce point d'arrêt de livraison n'est pas une tâche de test laissée ouverte dans le point 3.

### Enchaînement direct — point 4 ouvert
Le point 3 n'est pas à reprendre. Le prochain contrôle ouvert de l'audit Administrateur est la validation du parcours de notification de validité/règlement J−5 et de la présence du réseau de pharmacies dans les messages et la file Admin. Le test structurel `supabase/tests/20261029120000_promoteur_notifications_include_pharmacies.sql` a été exécuté sur le même replay après application de la migration de test correspondante : **PASS (structurel)**. Le point 4 reste actif pour la preuve runtime de notification délivrée, les états d'erreur UI et la non-régression applicative; aucun message réel n'a été envoyé.


## 60.45 — Point 4 engagé : preuves runtime des notifications J−5 et de soumission du règlement (29 octobre 2026)

### Résultats obtenus dans le replay non-Production
- Le test structurel `supabase/tests/20261029120000_promoteur_notifications_include_pharmacies.sql` reste **PASS** après application de la migration correspondante au replay.
- Nouveau test transactionnel `supabase/tests/260_promoteur_j5_notification_runtime.sql` : **PASS**. Il crée des fixtures Admin/Promoteur/pharmacie, appelle le générateur J−5, vérifie que les notifications Promoteur et Admin contiennent le nom du Promoteur et le nom de la pharmacie, puis appelle une seconde fois le générateur et confirme qu'aucun rappel doublon n'est produit. La transaction est annulée.
- Nouveau test transactionnel `supabase/tests/261_promoteur_payment_submission_notification_runtime.sql` : **PASS**. Il soumet un règlement de test, vérifie la création de la déclaration et la notification Admin contenant le Promoteur et sa pharmacie, puis confirme la notification de soumission au Promoteur. La transaction est annulée.
- Les prérequis historiques du règlement ont été rejoués dans le replay uniquement, car ce replay ne possédait pas la table `abonnement_promoteur_reglements`; la chaîne de migrations de test a été réalignée avant l'exécution.

### Contradiction et limites
- L'exécution SQL confirme les insertions de notifications en base, pas l'envoi d'un e-mail ou d'un SMS externe. Aucun message réel n'a été expédié.
- Les tests transactionnels ne remplacent pas la recette UI des états loading/empty/error, l'accès à la preuve téléversée ni une vérification de livraison du fournisseur de notification.
- Point 4 : **validation SQL structurelle et métier des deux déclencheurs PASS; recette applicative/UI et livraison externe encore ouvertes.** Aucun déploiement, aucun workflow CI relancé et aucune migration appliquée à Supabase Production.

## 60.46 — Point 4 : revue UI, stockage des preuves et chaîne de notification externe (29 octobre 2026)

### Revue statique du parcours Promoteur/Admin
- Fichiers examinés sur main : src/app/promoteur/paiements/page.tsx, src/app/promoteur/paiements/actions.ts, src/app/admin/pilotage/reglements/page.tsx, src/app/admin/pilotage/reglements/actions.ts, src/app/notifications/page.tsx, src/app/api/cron/validite/route.ts et les migrations de règlement/notification.
- Défaut UI confirmé côté Promoteur : une erreur de lecture des règlements pouvait être rendue comme « Aucun paiement déclaré »; l'erreur de lecture de l'abonnement n'était pas affichée et n'empêchait pas la soumission.
- Correction additive de la page Promoteur enregistrée sur main, commit 37b46503e2eceae21ce3ddba653d2bb52099459b : erreurs de lecture explicites, pas de faux état vide, formulaire désactivé si les données de paiement sont indisponibles ou si le tarif n'est pas configuré, signalement d'un lien de preuve non généré.
- La page Admin interdit déjà la confirmation lorsque le lien signé de la preuve est indisponible; l'action serveur revalide le statut « en_attente », vérifie l'existence d'un lien signé et exige la confirmation explicite de l'encaissement réel.

### Vérification Storage en lecture seule
- Bucket preuves-reglements-promoteurs observé privé sur Production et replay.
- Limite effective observée : 25 165 824 octets (25 MiB), avec PDF, JPEG, PNG, WebP, MP4, WebM et QuickTime autorisés.
- Cette configuration effective correspond à la limite annoncée par le formulaire et à la validation serveur (25 MiB). La migration historique initiale à 8 MiB ne correspond donc pas à l'état courant du bucket; aucune modification Storage n'a été faite.

### Découverte bloquante — délivrance externe non démontrée
- Production : le seul job pg_cron pertinent observé est naxa-promoteur-echeance-5j, actif à 0 6 * * *, dont la commande appelle uniquement public.generer_rappels_echeance_promoteurs().
- La fonction SQL insère les notifications en base. La table public.notifications ne présente aucun trigger d'envoi externe; le seul trigger non interne observé est le trigger d'historisation pharmacie.
- Une route Next.js /api/cron/validite contient un appel Resend, mais aucun déclencheur planifié observé ne l'appelle. Le job pg_cron actif n'invoque pas cette route. L'existence de cette route ne prouve donc pas l'envoi des rappels J−5 par e-mail.
- Pour la soumission et la confirmation des règlements, les fonctions SQL créent des notifications en base; aucun appel e-mail/SMS/push spécifique à ces événements n'a été trouvé dans les chemins applicatifs examinés. Les notifications in-app sont établies par les tests 260/261; la délivrance externe ne l'est pas.
- La présence/validité des secrets fournisseur et les journaux d'une délivrance réelle n'ont pas été vérifiés. Aucun e-mail/SMS réel n'a été envoyé.

### État et critères restant à satisfaire
- Tests SQL 260/261 : PASS sur replay non-Production, rollback confirmé (voir § 60.45).
- Revue UI : source examinée et correction d'états d'erreur Promoteur enregistrée; aucune exécution navigateur, aucun build et aucun test E2E UI n'ont été exécutés dans cette passe. La recette UI reste ouverte.
- Preuve : configuration Storage conforme observée en lecture seule; accès effectif par navigateur et téléchargement de fichiers réels non certifiés.
- Livraison externe : non démontrée; le planificateur actif ne déclenche que la fonction SQL d'insertion en base. Il faut définir et tester un chemin d'envoi idempotent pour J−5 et les événements de règlement, sans double planification ni exposition des secrets.
- Point 4 reste OUVERT. Aucune migration, écriture ou modification de configuration Supabase Production; aucun déploiement Vercel; aucun workflow CI relancé. Le commit source est documentaire/UI sur main uniquement.


## §60.47 — File de délivrance e-mail idempotente (29 octobre 2026)

**Correctif source sur `main`; validation isolée structurelle PASS; aucune délivrance réelle ni activation Production.**

- Cause confirmée : le job `pg_cron` `naxa-promoteur-echeance-5j` exécute `generer_rappels_echeance_promoteurs()`, qui crée les notifications et marque le rappel J−5 comme envoyé. La route historique réclamait ensuite les mêmes échéances via `claim_validite_promoteurs_5j()`; elle arrivait donc trop tard. Le rappel DB et la délivrance externe étaient couplés de façon contradictoire.
- Migration source additive `supabase/migration_20261029_notification_email_outbox_delivery.sql` : création d'une file privée `private.notification_email_outbox`, RLS activée, accès direct révoqué, contrainte unique notification/canal, trigger d'enqueue sur les notifications J−5 et règlements, RPC de réservation avec `FOR UPDATE SKIP LOCKED`, bail de 15 minutes et RPC de clôture avec reprises exponentielles plafonnées à cinq tentatives.
- Types pris en charge : `abonnement_echeance_5j`, `abonnement_echeance_5j_admin`, `abonnement_reglement_a_verifier`, `abonnement_reglement_soumis`, `abonnement_reglement_confirme`, `abonnement_reglement_refuse`.
- Route `/api/cron/validite` convertie en worker de file. Elle conserve la synchronisation des validités, exige `CRON_SECRET`, `RESEND_API_KEY` et `REPORT_FROM_EMAIL`, réclame uniquement la file, récupère l'adresse du compte côté serveur, envoie via Resend avec clé d'idempotence stable par message et confirme/réessaie l'état en base. Elle ne consomme plus le claim J−5 séparé.
- Test structurel `supabase/tests/262_notification_email_outbox_contract.sql` exécuté sur `naxa-ci-replay-2` avec transaction/ROLLBACK : PASS (table privée, trigger, unicité, RLS, droits service_role et refus anon/authenticated). Le replay ne contenait aucun profil Promoteur/Admin; aucun test comportemental de notification, appel Resend ou livraison réelle n'a donc été effectué.
- **Reste à faire avant clôture :** vérifier les secrets sans afficher leurs valeurs; définir un ordonnanceur externe autorisé pour appeler la route (aucun ordonnanceur de cette route n'est actuellement prouvé); exécuter un scénario de test avec destinataire de test et confirmer le reçu Resend; tester les événements de soumission/confirmation/refus et les reprises après erreur.
- Aucune modification Supabase Production, aucune écriture métier, aucun changement de secrets, aucun envoi réel, aucun déploiement Vercel et aucun workflow CI relancé. La migration est présente sur `main` mais n'est pas appliquée en Production.


### Complément de configuration — ordonnanceur et fournisseur (29/10/2026)
- Inventaire Vercel en lecture seule du projet `naxa` : `CRON_SECRET` est présent en Production. Les variables `RESEND_API_KEY` et `REPORT_FROM_EMAIL` attendues par le worker sont absentes des variables retournées. Aucune valeur secrète n'a été déchiffrée ni affichée.
- Le compte Vercel retourné est sur le plan Hobby. Aucun `vercel.json` n'est présent à la racine du dépôt et aucun cron Vercel n'est déclaré dans le code contrôlé. Le déclenchement périodique du worker n'est donc pas établi.
- Supabase Production expose `pg_cron`, `pg_net` et Vault; seul le secret Vault `naxa_posology_cron_secret` a été trouvé dans l'inventaire ciblé. Il est réservé au déclencheur de posologie et n'est pas réutilisé ni présumé équivalent au `CRON_SECRET` du worker.
- Des variables SMTP et Google Apps Script existent, mais leur contrat d'envoi et leur compatibilité avec cette file n'ont pas été vérifiés; aucune substitution de fournisseur n'est faite sur supposition.
- Décision : ne pas configurer de cron Production ni modifier les secrets sans autorisation explicite. Le code worker est prêt côté dépôt, mais la chaîne opérationnelle reste BLOQUÉE par la configuration du fournisseur et de l'ordonnanceur.

### §60.48 — Remplacement de Resend par Google Apps Script (29/10/2026)

- Décision : Resend abandonné. Le canal d'e-mail cible est Google Apps Script `MailApp`, exécuté sous le compte Google propriétaire du script. MailApp sert uniquement à envoyer et ne donne pas à NAXA l'accès à la boîte Gmail.
- Worker `src/app/api/cron/validite/route.ts` modifié sur `main` : suppression de la dépendance Resend; transmission des messages de l'outbox vers l'URL Apps Script HTTPS `/macros/s/.../exec`; authentification du worker par `CRON_SECRET`; authentification de la passerelle par secret partagé distinct `GOOGLE_APPS_SCRIPT_SECRET`; validation du format d'URL, de l'adresse destinataire et de la réponse positive du script.
- Source Google ajoutée : `google-apps-script/naxa-mail-gateway/Code.gs`, manifeste `appsscript.json` (scope d'envoi mail seulement) et guide `DEPLOYMENT.md`. Le script valide le secret, sérialise les envois par verrou, conserve les clés d'idempotence 30 jours, vérifie le quota journalier et inclut un test manuel vers `NAXA_TEST_EMAIL`.
- Variables attendues côté Vercel : `GOOGLE_APPS_SCRIPT_URL` et `GOOGLE_APPS_SCRIPT_SECRET`; côté Script Properties : `NAXA_MAIL_SECRET` et `NAXA_TEST_EMAIL`. Le secret Apps Script et le secret NAXA doivent être identiques; `CRON_SECRET` reste distinct.
- Référence technique Google : Web Apps Apps Script `doPost`, exécution en tant que propriétaire et publication; MailApp et ses quotas.
- **Non exécuté / non certifié :** création du projet Google, consentement OAuth, déploiement du Web App, configuration des propriétés et variables Vercel, test de réception. Aucun e-mail réel n'a été envoyé. Le worker ne pourra délivrer que lorsque les paramètres seront configurés et qu'un ordonnanceur autorisé l'appellera. La chaîne reste ouverte jusqu'à preuve de réception.
- Aucun secret n'a été lu ou écrit, aucune modification Supabase Production, aucun déploiement Vercel et aucun changement d'ordonnanceur Production.