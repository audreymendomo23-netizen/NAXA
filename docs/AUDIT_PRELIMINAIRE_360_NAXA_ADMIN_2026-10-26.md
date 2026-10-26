# NAXA — Rapport préliminaire de continuité et d’audit technique 360°
Date du relevé : 26 octobre 2026
Dépôt : `audreymendomo23-netizen/NAXA`
Branche de référence : `main` (aucune branche créée)
Commit de référence observé avant ce document : `cfca68442c4f7475451bcfcd70048b3ad56ffec4`
Périmètre : préparation obligatoire à l’audit exhaustif du parcours Administrateur.

> **Statut et honnêteté de couverture.** Ce document rassemble les preuves directement récupérées dans GitHub, Supabase et Vercel, les règles de continuité, les documents métier déjà présents et les premiers constats contradictoires. L’inventaire du dépôt est complet au niveau de l’arbre Git (1 228 entrées), mais cela ne signifie pas que chaque ligne de chacun des 1 228 fichiers a déjà été relue. La revue ligne par ligne de tout le dépôt, la lecture intégrale de chaque document historique et l’analyse exhaustive de tous les éléments interactifs des 18 pages Admin restent des travaux à conduire en lots traçables. Aucun résultat non observé n’est déclaré « vert ».

## 1. Contraintes impératives appliquées
- Travailler uniquement sur `main`; aucune nouvelle branche, aucune PR.
- Pas de modification de données Supabase Production et pas de migration appliquée pendant cette phase.
- Aucun secret ou valeur sensible d’environnement reproduit dans ce rapport.
- Aucun déploiement manuel déclenché par cette phase.
- Les statuts CI, build, données et fonctions sont distingués des vérifications visuelles réelles de l’application.
- Toute correction fonctionnelle ultérieure devra être précédée de la preuve de cause racine et de tests ciblés.

## 2. Historique des conversations et décisions de continuité

### Règles persistantes et décisions récurrentes
- NAXA est un ERP médical/multivers Next.js 14 App Router + TypeScript strict + Tailwind + Supabase/Postgres/RLS + PWA + Vercel.
- La source de code demandée est `main`; l’utilisateur interdit de créer une seconde branche.
- L’utilisateur a plusieurs fois interdit les déploiements sans autorisation explicite et a demandé de ne jamais présenter une fonctionnalité comme terminée sans preuve réelle.
- « Vert » signifie que le code, les données/configurations nécessaires et un chemin testable sont préparés et vérifiés par les moyens disponibles; cela ne prouve pas une recette métier visuelle que les outils ne peuvent pas exécuter.
- Méthode demandée : analyse contradictoire, travail séquentiel, résultat mesurable, cause racine, solution ciblée, vérifications puis point suivant.
- Le modèle métier NAXA interdit les stocks/prix fictifs et les données de démonstration visibles; réservation/retrait, pas de livraison NAXA ni de commission NAXA. Le stock physique ne doit pas être décrémenté avant validation de caisse.
- Les règles d’interface transversales, rôles et limites métier décrites dans les conversations antérieures doivent être traitées comme contraintes d’audit, pas comme preuve que le code actuel les respecte.

### Historique récent pertinent au parcours Admin
- Le chantier actuel concerne la consolidation du catalogue et du dossier Promoteur, le parcours de création/validation, les univers, les rapports, le journal, le profil et les préférences de configuration Admin.
- Les derniers commits observés sur `main` au moment du relevé sont des correctifs Admin (suppression d’un import de page de rapport inutilisé, suppression d’une clé d’erreur dupliquée et ordre des pièces KYC, contrôle d’administrateur actif pour créer un rapport, alignement des cartes de rapport sur les métriques sauvegardées, dossier partenaire sans coordonnées GPS obligatoires).
- Le document `docs/AUDIT_FUSION_CATALOGUE_DOSSIER_PROMOTEUR_2026-10-26.md` contient déjà une analyse métier antérieure du flux unifié. Il doit être confronté au code et à l’état actuel de la base, pas considéré comme preuve finale.
- Des conversations antérieures signalent des déploiements Vercel en échec, des limites de quota et des divergences entre résultat attendu et interface observée. Ces signalements sont des éléments historiques; leur résolution doit être vérifiée indépendamment.

### Limite de restitution historique
Le contexte de conversation disponible ici ne constitue pas une exportation brute de toutes les conversations passées. Les décisions persistantes et les conversations récentes disponibles ont été synthétisées ci-dessus; je ne prétends pas avoir relu intégralement chaque message historique de toutes les conversations. Une exportation complète n’a pas été disponible via les sources inspectées dans cette phase.

## 3. GitHub — état réel du dépôt et du code

### Métadonnées vérifiées
- Dépôt : privé (`visibility: private`), non archivé.
- Branche par défaut : `main`.
- Accès du compte connecté : admin/maintain/push observé.
- Dernier commit observé avant le présent rapport : `cfca68442c4f7475451bcfcd70048b3ad56ffec4`, message `fix(admin): remove unused report page import`, daté du 26 octobre 2026 à 12:59:02 UTC.
- Arbre Git récursif : **1 228 entrées**.
- Pages App Router `page.tsx` identifiées dans `src/app` : **113**.
- Fichiers de migration SQL dans `supabase/migrations/` : **25**.
- Fichiers SQL de test dans `supabase/tests/` : **186**.
- Le dépôt contient plusieurs documents de cadrage, d’état et d’audit; liste partielle en section 5.

### Architecture confirmée par les fichiers racine
- `package.json` : Next.js `14.2.15`, React `18.3.1`, TypeScript `5.6.2`, Supabase JS `2.45.4`, `@supabase/ssr` `0.5.2`, Tailwind `3.4.13`, PWA, Tesseract.js, Web Push, WebAuthn et QR code.
- Scripts de test déclarés : trajets/taxi, géolocalisation pharmacies, catalogue médicaments, interopérabilité suivi, calculs caisse et moteur comptable; import BDPM.
- Le dépôt comporte simultanément des fichiers historiques `supabase/migration_*.sql` et des migrations versionnées sous `supabase/migrations/`. Leur ordre et leur statut doivent être rapprochés des migrations effectivement appliquées; ne pas rejouer les fichiers historiques par supposition.
- `AGENTS.md` est la règle opérationnelle de référence et supplante les anciennes instructions de workflow contradictoires présentes dans des documents plus anciens.

### CI
- Le statut combiné du commit `cfca684...` renvoie un check `ci/circleci: quality` en échec, avec lien CircleCI 7289.
- Cela ne prouve pas à lui seul que le code du dernier commit est la cause; le job et ses logs détaillés restent à corréler au SHA.
- Aucune déclaration de CI verte n’est justifiée par les preuves disponibles.

## 4. Audit préliminaire des routes Admin

### Pages routées Admin détectées dans l’arbre Git
**18 pages identifiées, 18 inventoriées :**
1. `/admin` — `src/app/admin/page.tsx`
2. `/admin/alertes` — `src/app/admin/alertes/page.tsx`
3. `/admin/configuration` — `src/app/admin/configuration/page.tsx`
4. `/admin/examens` — `src/app/admin/examens/page.tsx`
5. `/admin/geolocalisation` — `src/app/admin/geolocalisation/page.tsx`
6. `/admin/journal` — `src/app/admin/journal/page.tsx`
7. `/admin/messagerie` — `src/app/admin/messagerie/page.tsx`
8. `/admin/pharmacies/[id]` — `src/app/admin/pharmacies/[id]/page.tsx`
9. `/admin/pilotage` — `src/app/admin/pilotage/page.tsx`
10. `/admin/pilotage/rapports` — `src/app/admin/pilotage/rapports/page.tsx`
11. `/admin/pilotage/validite` — `src/app/admin/pilotage/validite/page.tsx`
12. `/admin/prestations` — `src/app/admin/prestations/page.tsx`
13. `/admin/produits` — `src/app/admin/produits/page.tsx`
14. `/admin/profil` — `src/app/admin/profil/page.tsx`
15. `/admin/promoteurs` — `src/app/admin/promoteurs/page.tsx`
16. `/admin/promoteurs/partenaires/[id]` — `src/app/admin/promoteurs/partenaires/[id]/page.tsx`
17. `/admin/rappels-lots` — `src/app/admin/rappels-lots/page.tsx`
18. `/admin/univers` — `src/app/admin/univers/page.tsx`

Le dossier contient également `layout.tsx`, `actions.ts`, des actions spécialisées, le CSS Admin et des routes API Admin. Une route dynamique comptée ici représente un modèle de page, pas un nombre d’instances de dossiers.

### Fichiers d’action détectés
10 fichiers `actions.ts` sous `src/app/admin` ont été recensés :
- `src/app/admin/actions.ts`
- `src/app/admin/creation-univers-actions.ts`
- `src/app/admin/examens/actions.ts`
- `src/app/admin/pharmacies/[id]/actions.ts`
- `src/app/admin/pilotage/validite/actions.ts`
- `src/app/admin/prestations/actions.ts`
- `src/app/admin/produits/actions.ts`
- `src/app/admin/promoteurs/actions.ts`
- `src/app/admin/promoteurs/partenaires/actions.ts`
- `src/app/admin/univers/actions.ts`

### Premier constat contradictoire
L’inventaire prouve qu’il existe 18 modèles de pages Admin, mais ne prouve pas encore que chacune est accessible depuis la navigation, que tous les contrôles déclenchent une action valide, que toutes les actions aboutissent ou que les autorisations serveur couvrent chaque opération. Le décompte exhaustif des onglets, libellés, boutons, champs, états vides, messages et boucles interactives est réservé à la phase d’audit détaillé page par page et devra être livré avec un tableau de comptage par page.

## 5. Documents du dépôt recensés

Documents de cadrage et d’état directement identifiés dans l’arbre Git :
- `AGENTS.md`, `README.md`, `STATUT.md`, `FONCTIONNALITES_VALIDEES.md`
- `NAXA_Cahier_des_charges-1.md`, `naxa_cahier_des_charges_v3_7.md`, `NAXA_REPRISE-1.md`, `PROMPT_CHATGPT_NAXA-1.md`, `naxa_prompt_maitre_fusion_v2.md`
- `docs/ARCHITECTURE.md`, `docs/CAHIER_DES_CHARGES.md`, `docs/DICTIONNAIRE_DONNEES.md`, `docs/MATRICE_DONNEES.md`, `docs/BI.md`
- `docs/CONTINUITE_IA_NAXA.md`, `docs/REPRISE.md`, `docs/FUSION.md`, `docs/REGISTRE_GOUVERNANCE.md`, `docs/TRACABILITE.md`
- `docs/AUDIT_FUSION_CATALOGUE_DOSSIER_PROMOTEUR_2026-10-26.md`, `docs/AUDIT-BULK-UNIVERS-2026-10-18.md`, `docs/AUDIT_CYCLE_RESERVATION_TICKET_CAISSE.md`, `docs/AUDIT_SYNCHRONISATION_STOCK_CAISSE_MARKETPLACE_2026-10-21.md`, `docs/AUDIT_CONTROLE_PROMOTEUR_POSTES.md`
- `docs/BOOTSTRAP-PREMIER-ADMIN.md`, `docs/SECURITE_PROMOTEUR.md`, `docs/CONCEPTION_DASHBOARDS.md`, `docs/ROADMAP-CANONIQUE-6-ETAPES-2026-10-19.md`
- Les cahiers des charges spécialisés Caisse, Comptable, Multicompte, les guides Promoteur/Caisse/NAXA, les rapports comptables `docs/compta/RAPPORT_*`, et les dossiers de suivi des univers et dispositifs médicaux.

**Contrôle de cohérence documentaire requis :** plusieurs générations de documents et de migrations coexistent. Il faut classer chaque règle en vigueur, règle historique, résultat vérifié et hypothèse, puis signaler les contradictions plutôt que fusionner silencieusement les versions. Le présent relevé est un inventaire, pas une lecture intégrale de chacun des documents ci-dessus.

## 6. Supabase — état de Production observé en lecture seule

### Projet
- Projet principal : `Naxa`, ref `eouwtuusnsuxaejsxknf`, région `eu-west-1`, statut `ACTIVE_HEALTHY`, PostgreSQL 17.
- Deux projets nommés `naxa-ci-replay` et `naxa-ci-replay-2) ont également été listés; l’un est inactif et l’autre actif. Ils ne doivent pas être confondus avec Production.

### Schéma
- Tables `public` : **135**.
- Tables avec RLS activée : **135/135**.
- Fonctions dans le schéma `public` : **227**.
- Exemple de données observé : `public.pharmacies` contient 4 lignes; ce chiffre seul ne suffit pas à conclure sur le nombre réel de partenaires ni sur la qualité métier des données.
- Extensions installées/présentes : `pg_net` est observée installée dans `extensions`; plusieurs autres extensions sont listées disponibles sans version installée. L’inventaire complet doit distinguer disponibilité et installation effective.

### Conseils de sécurité — alertes concrètes
Le conseiller Supabase a remonté, au relevé du 26 octobre 2026 :
- **5 tables avec RLS activée mais aucune policy** : `caisse_audit_chain_heads`, `caisse_decaissement_auth_grants`, `caisse_security_challenges`, `caisse_security_credentials`, `pharmacie_donnees_historique`. Cela peut être intentionnel si toutes les opérations passent par des fonctions privilégiées; à vérifier dans les fonctions, privilèges et usages. Ne pas ajouter des policies permissives par réflexe.
- **5 fonctions SECURITY DEFINER exécutables par anon** signalées par le linter : `get_home_service_catalog()`, `get_universe_catalog(text)`, `marketplace_offre_stock_disponible(uuid, uuid)`, `produits_populaires(integer, integer)`, `universe_partner_is_public(uuid, text)`. Il faut lire leur définition et confirmer si l’exposition publique est volontaire, avec validation des paramètres, `search_path` fixé et données strictement publiques avant de corriger.
- Le conseiller performance signale **113 clés étrangères sans index couvrant**. Priorité à classer par volume, fréquence des jointures, requêtes de support et coût; ne pas créer automatiquement 113 index sans analyse.
- Les résultats sont des alertes d’audit, pas la preuve d’une fuite de données. Aucune écriture de correction n’a été faite.

### Logs Supabase observés
- Sources disponibles : `pgbouncer_logs`, `postgres_logs`, `auth_audit_logs`, `edge_logs`, `auth_logs`, `postgrest_logs`, `realtime_logs`, `storage_logs`.
- Sur la fenêtre de 24 heures interrogée, volumes par source : pgbouncer 10 931; postgres 3 239; edge 2 128; auth 708; postgrest 296; storage 195; realtime 112; auth audit 18. Ce sont des lignes de log, pas nécessairement des erreurs ou des requêtes uniques.
- Événements correspondant au filtre de texte erreur/échec : une erreur TLS « unexpected eof while reading » dans pgbouncer et un événement `GUARD_TEST_FAILED` où une opération `expire` a retourné SQLSTATE `P0001` (« Action réservée à l’administration ou au service »). Le second doit être classé comme test de garde ou incident applicatif après lecture du contexte; ne pas l’assimiler automatiquement à un défaut de Production.
- Une tentative de comptage via `supabase_migrations.schema_migrations` a échoué car cette relation n’existe pas dans le schéma exposé. Le nombre de migrations appliquées doit être récupéré par l’outil de migrations Supabase et comparé aux fichiers Git, pas déduit d’une table supposée.

## 7. Vercel — projet, environnements et déploiements

### Projet observé
- Projet `naxa`, ID `prj_WtDcnR5OvRWKCt2xXgBPvpzzRYVH`, framework Next.js.
- Dernier déploiement connu dans la réponse du projet : état **ERROR**, cible Production.
- Domaines attachés rapportés : `naxa-naxa3.vercel.app` et `naxa-git-main-naxa3.vercel.app`.
- Protection SSO activée pour les déploiements (`deploymentType: all)); protection par mot de passe désactivée. Cette configuration doit être comprise comme contrôle d’accès aux déploiements, distincte de la confidentialité GitHub et des droits applicatifs.
- Version Node configurée par Vercel : `24.x`. À comparer à la version attendue/testée par le projet et aux outils de build; aucun changement n’est fait pendant l’audit.

### État des déploiements et logs
- Les 20 derniers déploiements interrogés incluent une série d’états `ERROR` associés à des commits de `main`; les derniers messages recensés concernent profil Admin, préférences, journal, rapports, KYC et catalogue.
- Les logs du déploiement `dpl_DbAaBdHoEYrSoiu1J1BnKndn5CSQ` indiquent que le build a cloné `main) au commit `af7230b2cf63e2ef6f024e525bf5a9159a2eed2b`, puis `npm run build` a échoué sur `src/components/admin/CatalogueCreation.tsx:53` : erreur TypeScript « An object literal cannot have multiple properties with the same name. ».
- Cette preuve est liée au commit déployé `af7230b...`, pas au commit de référence actuel `cfca684...`. L’historique Git contient ensuite un commit `6c7fed8...` intitulé « remove duplicate error key and order KYC documents »; il faut donc relancer une vérification contrôlée du SHA courant avant de conclure que l’erreur persiste. Aucun nouveau build n’a été lancé par ce rapport.
- Un avertissement npm signale une configuration `cache-dir` inconnue et des scripts d’installation pas encore couverts par `allowScripts` pour deux dépendances. Ces avertissements ne sont pas la cause rapportée de l’échec TypeScript.
- Les logs runtime sur une fenêtre de 24 h n’ont pas pu être récupérés : l’API Vercel a indiqué que la rétention du plan ne couvre pas cette fenêtre. Il s’agit d’une limite de consultation, pas d’une preuve d’absence d’erreurs runtime.

### Variables d’environnement — inventaire sans secrets
- **27 entrées** remontées par Vercel, sans déchiffrement des secrets.
- Familles présentes : URL publique de routage OSRM, URL canonique du site, clés publiques/privées VAPID, secrets Cron et Apps Script, URL Apps Script, paramètres SMTP, clés Supabase service-role et anon, secrets de limitation de débit et cookie pharmacie.
- Certaines variables sensibles sont ciblées par environnement; `SUPABASE_SERVICE_ROLE_KEY` est listée en Production, Preview et Development. Les valeurs secrètes n’ont pas été consultées ni reproduites.
- L’URL observée dans `NEXT_PUBLIC_SITE_URL` est `https://nnaxa.vercel.app`; elle semble suspecte (double « n ») au regard des domaines de projet listés. Il faut comparer les domaines canoniques réellement souhaités, OAuth callbacks, e-mails et redirections avant toute modification.
- La variable `NEXT_PUBLIC_NAXA_ROUTING_URL` pointe vers le service public OSRM de démonstration; son commentaire précise qu’il ne fournit pas de trafic en temps réel. Toute présentation d’ETA ou de circulation doit donc éviter de prétendre à du trafic réel sur cette base.
- Aucune variable n’a été modifiée.

## 8. Contradictions et risques préliminaires priorisés

| ID | Constat observé | Risque/contradiction à vérifier | Action d’audit recommandée |
|---|---|---|---|
| P0-01 | Plusieurs déploiements Production en `ERROR` | Le code sur `main` et le dernier déploiement ne sont pas alignés dans les preuves récupérées | Vérifier le build du SHA actuel sans déclencher de déploiement manuel |
| P0-02 | Linter : 5 fonctions `SECURITY DEFINER` exécutables par anon | API publique potentiellement trop large si les données/paramètres ne sont pas strictement contrôlés | Lire les définitions SQL et tester le comportement anonyme sur données synthétiques/non sensibles |
| P0-03 | 5 tables RLS sans policies | Surface inaccessible par API directe, mais possiblement intentionnelle via RPC privilégiée | Cartographier tous les consommateurs et privilèges avant toute modification |
| P1-01 | 113 clés étrangères sans index couvrant | Risque de latence et de contention selon fréquence et volume | Prioriser selon requêtes, cardinalité et chemins métier critiques |
| P1-02 | `NEXT_PUBLIC_SITE_URL` paraît contenir un « n » en trop | Redirections OAuth, liens e-mail ou URL générées potentiellement incorrects | Comparer config Vercel, callbacks Auth et code de construction des URL |
| P1-03 | OSRM public de démonstration configuré | Risque de présenter une estimation routière comme trafic temps réel | Vérifier les libellés et contrats UI/API de trajet |
| P1-04 | 25 migrations versionnées dans Git, coexistence de fichiers SQL historiques, historique DB non encore réconcilié en total | Risque de dérive entre schéma versionné et Production | Comparer migration par migration avec l’outil Supabase et les tests SQL |
| P1-05 | 18 pages Admin et 10 fichiers d’actions détectés | L’existence des routes ne prouve ni l’accessibilité ni l’achèvement des boucles métier | Audit de chaque page, contrôle et action serveur |
| P1-06 | 113 pages App Router au total et 1 228 entrées dans l’arbre | Revue complète ligne par ligne très volumineuse | Faire une couverture traçable par sous-système, avec inventaire des fichiers et preuve de lecture |
| P1-07 | Plusieurs documents historiques et cahiers des charges coexistent | Règles contradictoires ou obsolètes possibles | Établir une matrice de source de vérité datée, sans effacer l’historique utile |

## 9. Ce qui est et n’est pas validé à ce stade

### Vérifié avec preuve outil
- Dépôt privé, branche par défaut `main), SHA de référence.
- Inventaire de l’arbre Git et décompte des routes Admin.
- Métadonnées du projet Supabase, volumes de tables/fonctions/RLS et alertes linter.
- Sources et volumes de logs Supabase sur la fenêtre interrogée.
- Projet Vercel, domaines, protections, inventaire des clés d’environnement sans déchiffrement.
- Échec de build d’un déploiement précis, avec fichier, ligne et erreur TypeScript.

### Non encore vérifié / ne pas déclarer vert
- Relecture intégrale ligne par ligne de tous les fichiers source du dépôt.
- Lecture intégrale de tous les documents listés et résolution de leurs contradictions.
- Liste exhaustive des migrations réellement appliquées, comparée aux fichiers Git.
- Définition et tests de chacune des 227 fonctions Supabase.
- Audit exhaustif de chaque policy RLS, privilège, fonction Edge et flux de données.
- Build reproductible du SHA `cfca684...` dans un environnement contrôlé.
- Audit page par page des 18 pages Admin : comptage exact des onglets, titres, textes, champs, boutons, couleurs, animations, messages d’erreur, liens et actions.
- Audit de bout en bout des interactions, routes mortes, code mort et support de 1 000 cas pratiques.
- Réconciliation chiffrée des indicateurs globaux Admin avec les comptes Promoteur, Pharmacie, Caisse, Stock, Comptable, Pharmacien, Client et autres univers.
- Recette visuelle réelle en session connectée et non connectée.

## 10. Plan de couverture traçable pour la suite (non exécuté dans ce rapport)
1. Stabiliser la photographie de référence : SHA `main`, config Vercel, migrations appliquées, versions des documents.
2. Lire le code Admin et ses dépendances : layout/navigation, pages, composants, actions serveur, API routes, helpers d’autorisation, SQL/RPC, RLS.
3. Construire un registre par page et sous-composant avec décomptes reproductibles.
4. Cartographier chaque action de l’UI jusqu’à la persistance et au message de résultat, y compris erreurs et retours arrière.
5. Construire les matrices d’accès Admin ↔ Promoteur ↔ Pharmacie ↔ marketplace ↔ univers indépendants, avec cas de refus.
6. Exécuter les 1 000 scénarios métier demandés sous forme de matrice de tests; ne pas les afficher individuellement, mais rapporter les taux de couverture, résultats et catégories de défauts.
7. Comparer les agrégats Admin aux sources de vérité métier de chaque compte et vérifier les filtres de portée.
8. Prioriser les défauts avec preuve, proposer une correction précise par point, puis attendre la validation de l’utilisateur avant toute correction métier selon la méthode demandée.
9. Mettre à jour ce document après chaque lot et produire un bilan final : corrigé, non corrigé, risque résiduel, tests, limites et points à arbitrer.

## 11. Décision de clôture de l’étape préliminaire
Le relevé des ressources et des constats techniques majeurs est consigné. **La couverture exhaustive ligne par ligne n’est pas certifiée** : les limites et travaux non encore vérifiés sont explicitement listés à la section 9. Aucun correctif métier, changement de variable, changement de schéma ou déploiement manuel n’a été exécuté pendant cette étape.
