# NAXA — Audit CTO 360° du parcours Administrateur
**Document de travail unique — étape préliminaire obligatoire**

- Date d'ouverture : 26 octobre 2026
- Branche de travail unique : `audit/admin-360-20261026`
- Branche de référence : `main`
- Commit de référence `main` à l'ouverture : `cfca68442c4f7475451bcfcd70048b3ad56ffec4`
- Objet : établir les preuves de l'étape préliminaire avant tout audit page par page et avant toute correction fonctionnelle.
- Règle d'environnement : aucune migration appliquée à Supabase Production, aucune modification de variables secrètes, aucun déploiement demandé ou lancé dans cette étape.
- État : **préliminaire en cours — constats initiaux consignés; les inventaires approfondis et la lecture exhaustive du code restent à compléter dans cette même branche.**

## 1. Périmètre et limites de preuve

Ce rapport rassemble les éléments issus :
1. des consignes et décisions antérieures disponibles dans le contexte de conversation et les synthèses récupérables;
2. de l'arbre GitHub et des fichiers de référence de `main`;
3. des documents de gouvernance, cahiers des charges et audits existants;
4. des métadonnées Vercel, des noms/cibles des variables (sans lecture ni publication des secrets);
5. de requêtes SQL strictement en lecture seule sur le projet Supabase Naxa et des outils de conseil Supabase;
6. de la configuration CircleCI présente dans le dépôt.

**Limites explicites :** je n'ai pas accès à une archive brute garantie de toutes les conversations depuis la création du compte, ni à toutes les données de tous les services externes. Les synthèses antérieures sont utiles mais ne valent pas transcription complète. L'API Vercel n'autorise pas la lecture des secrets en clair dans le cadre de ce rapport; aucune valeur secrète ne sera copiée ici. Les journaux de CircleCI n'ont pas été récupérés par les outils accessibles. L'étape « ligne 1 à la dernière ligne de tout le code » ne peut pas être déclarée accomplie à partir d'un inventaire d'arbre : elle sera menée par lots traçables, fichier par fichier, dans les phases d'audit suivantes. Aucun résultat non vérifié ne sera qualifié de vert.

## 2. Création de branche et gouvernance

- Branche créée depuis le `main` connu : `audit/admin-360-20261026`.
- Aucune deuxième branche ne sera créée pour ce chantier.
- Aucun fichier de ce chantier n'est écrit sur `main`.
- Les changements de ce chantier resteront sur cette branche jusqu'à l'autorisation de fusion.
- Contradiction de gouvernance détectée : `AGENTS.md` prescrit de travailler sur `main` et interdit les branches de travail, alors que l'ordre explicite du présent chantier exige une branche unique et interdit d'en créer une seconde. Pour ce chantier, l'instruction actuelle de l'utilisateur prime sur cette ancienne règle locale; aucune fusion n'est implicite.

## 3. État GitHub au point de départ

### 3.1 Dépôt et structure
- Dépôt privé : `audreymendomo23-netizen/NAXA`.
- Branche par défaut : `main`.
- Stack déclarée : Next.js 14 App Router, React 18, TypeScript, Tailwind, Supabase/PostgreSQL, PWA.
- Arbre Git à la référence de départ : **1 228 entrées**.
- Pages sous `src/app/admin` identifiées par l'arbre : **18 fichiers page** :
  1. `/admin`
  2. `/admin/alertes`
  3. `/admin/configuration`
  4. `/admin/examens`
  5. `/admin/geolocalisation`
  6. `/admin/journal`
  7. `/admin/messagerie`
  8. `/admin/pharmacies/[id]`
  9. `/admin/pilotage`
  10. `/admin/pilotage/rapports`
  11. `/admin/pilotage/validite`
  12. `/admin/prestations`
  13. `/admin/produits`
  14. `/admin/profil`
  15. `/admin/promoteurs`
  16. `/admin/promoteurs/partenaires/[id]`
  17. `/admin/rappels-lots`
  18. `/admin/univers`
- Routes API identifiées : **42 fichiers `route.*`**.
- Documents Markdown/MDX/TXT sous `docs/` : **69**.
- Migrations SQL historiques à la racine de `supabase/` correspondant à `migration_*.sql` : **290**.
- Migrations versionnées sous `supabase/migrations/` : **25**.
- Tests SQL sous `supabase/tests/` : **186**.

Ces chiffres sont un inventaire de l'arbre Git à la référence de départ, pas encore le décompte d'éléments UI ni une certification de complétude fonctionnelle.

### 3.2 Contradiction CI importante — cause statique identifiée
Le fichier `.circleci/config.yml` contient un préflight qui :
- collecte les fichiers avec `Path("supabase").glob("migration_*.sql")`;
- impose exactement **96** migrations sources;
- interrompt le job si le nombre diffère de 96.

Or l'arbre actuel de `main` contient **290** fichiers correspondant à ce motif. Le contrôle attend 96 mais en trouve 290 : **la condition de sortie en échec est déterministement satisfaite**, avant le rejeu des migrations SQL. C'est une cause statique démontrée qui peut expliquer le rouge de CircleCI, sans nécessiter d'accéder aux logs. Elle ne prouve pas qu'il n'existe pas d'autres erreurs après ce contrôle.

**Solution proposée pour une étape de correction ultérieure :** réconcilier le contrat CI avec l'architecture de migration réellement utilisée. Avant toute modification, comparer la liste exacte des 290 fichiers, les préfixes historiques, le schéma de base et les consignes de rejeu; ne pas simplement remplacer 96 par 290 sans confirmer l'ordre, la compatibilité et l'intention du script. Les fichiers historiques racine et le répertoire versionné ne doivent pas être confondus.

### 3.3 Derniers commits
Le HEAD de `main` au début de ce chantier est `cfca68442c4f7475451bcfcd70048b3ad56ffec4` (`fix(admin): remove unused report page import`). Les commits précédents du lot admin portent notamment sur les pièces KYC, le rapport de pilotage, le journal, le profil et la configuration. Les commits historiques récents ne prouvent pas à eux seuls que la version visible en production les contient.

## 4. Décisions et contraintes de conversations antérieures récupérées

Les thèmes récurrents disponibles dans le contexte sont :
- le projet doit rester une extension de l'ERP existant; pas de reconstruction globale ni de régression des rôles déjà opérationnels;
- les parcours Marketplace et ERP pharmacie doivent partager une source de vérité cohérente pour stock, réservations, ventes et états;
- les rôles métier incluent notamment Promoteur, Caisse/Caissière, Pharmacien, Gestionnaire de stock, Comptable, Responsable, Administrateur NAXA et Client; l'ancien rôle Assistant pharmacien a été supprimé au profit d'un parcours Pharmacien unifié;
- les dashboards et rapports doivent respecter le rôle, les privilèges, l'architecture et le périmètre autorisé côté serveur, sans filtrage de sécurité uniquement côté client;
- la logique BI documentée utilise `stats_pilotage_scope` comme moteur canonique; recherches via `public.evenements`; CA à grain réservation avec statuts qualifiants `payee` ou `retiree`; pas de marge historique tant que le coût n'est pas figé à la transaction;
- le périmètre Promoteur doit être basé sur ses liens de pharmacies actifs et autorisés, pas sur une seule pharmacie choisie comme substitut;
- le compte administrateur doit donner une visibilité transversale mais sans contourner les règles RLS ni créer une voie d'accès parallèle aux données sensibles;
- pour le chantier courant, le travail doit se faire sur une branche unique, étape par étape, avec raisonnement par contradiction, résultats chiffrés, proposition ponctuelle et validation avant les corrections fonctionnelles suivantes;
- aucune fusion vers `main` n'est autorisée avant la fin de ce chantier et l'ordre explicite de fusion; aucun déploiement n'est demandé dans cette étape.

Les synthèses antérieures montrent des travaux BI non complètement certifiés (objectifs/historique, rétention/capillarité, projections/diagnostics, drill-down et exports filtrés, couverture de tests multi-rôles) et un risque historique de divergences entre anciennes fonctions de pilotage et moteur canonique. Ces points sont à retester contre le code courant; ils ne sont pas déclarés défaillances actuelles sans preuve actualisée.

## 5. Documentation du dépôt — premières lectures

### 5.1 `AGENTS.md`
Le protocole local impose historiquement main direct, pas de branche, pas de PR, ne pas attendre CircleCI, ne jamais écrire en Production sans autorisation, et ne jamais déclarer un résultat sans preuve. Il entre en contradiction avec l'ordre actuel sur la branche : la présente mission suit la demande actuelle de branche unique. Les garde-fous de non-exposition des secrets, d'absence d'écritures Production et de transparence restent cohérents.

### 5.2 Cahier des charges principal
`docs/CAHIER_DES_CHARGES.md` est un document v3.7 très volumineux (ERP pharmacie comme produit principal, Marketplace comme module; stock ERP comme source de vérité; rôles et scopes; pilotage 360°). Il indique lui-même que les exigences sont classées EXISTANT, NOUVEAU ou À ARBITRER. Chaque écran/fonction audité devra être confronté à cette classification, plutôt que d'assimiler une exigence décrite à une fonctionnalité réellement opérationnelle.

### 5.3 BI
`docs/BI.md` documente les règles de grain, scope, CA, recherche, coûts et export. Risque de contradiction à examiner : les cartes de rapports du code courant lisent une structure `stats_pilotage_scope` et des champs `obj.ca` / `obj.alertes`, tandis que le modèle documenté exige des KPI canoniques et des scopes explicites. Le code actuel de `src/app/api/rapports/route.ts` n'est pas encore démontré aligné sur tous les champs et scopes documentés; ce point est à traiter dans l'audit technique de rapports.

### 5.4 Gouvernance et audits existants
`docs/REGISTRE_GOUVERNANCE.md` protège les documents maîtres et exige un intégrateur unique pour les modifier. Les audits préexistants incluent notamment `docs/AUDIT_FUSION_CATALOGUE_DOSSIER_PROMOTEUR_2026-10-26.md`, `docs/AUDIT_PARCOURS_CAISSE_ONGLETS.md`, `docs/AUDIT_CYCLE_RESERVATION_TICKET_CAISSE.md`, `docs/AUDIT_SYNCHRONISATION_STOCK_CAISSE_MARKETPLACE_2026-10-21.md`, `docs/SECURITE_PROMOTEUR.md`, `docs/ETAT_GESTIONNAIRE_STOCK_2026-10-20.md` et `docs/ETAT_PARCOURS_PHARMACIEN_UNIFIE_2026-10-20.md`. Ils seront lus et confrontés au code lorsqu'on passera à l'audit fonctionnel par domaine.

## 6. État Supabase — lecture seule

### 6.1 Projets visibles dans la connexion NAXA
- `Naxa`, ref `eouwtuusnsuxaejsxknf`, région `eu-west-1`, PostgreSQL 17, statut **ACTIVE_HEALTHY**.
- `naxa-ci-replay`, ref `fnlyjlvflgiewrkmnisi`, statut **INACTIVE**.
- `naxa-ci-replay-2`, ref `pwfftcsjyeibxxqhwysw`, statut **ACTIVE_HEALTHY**.

Le projet `Naxa` est traité comme l'environnement principal d'après son nom et le contexte, mais l'identité Production doit toujours être confirmée par les métadonnées d'environnement avant une action d'écriture. Aucune écriture n'a été exécutée.

### 6.2 Compteurs de schéma observés par SQL en lecture seule
Sur le projet `Naxa` :
- tables de base `public` : **133**;
- vues recensées dans les schémas `public` et `bi` : **5**;
- routines/fonctions `public` : **222**;
- politiques RLS recensées sur `public` : **212**;
- tables `public` avec RLS activé : **133**.

Ces compteurs sont des instantanés techniques; ils ne prouvent pas que chaque politique est correcte, ni que chaque route utilise le bon scope.

### 6.3 Migrations appliquées
L'outil Supabase retourne une longue liste de migrations réellement enregistrées dans l'historique de la base. Les versions incluent notamment les fondations de sécurité, le pilotage, les univers partenaires, les dispositifs, les rôles Caisse/Pharmacien/Gestionnaire de stock, les lots, les réservations, la provenance des photos et les dernières migrations d'illustration pharmacie. Il existe une différence d'organisation entre les historiques SQL à la racine du dépôt et les migrations timestampées. Une comparaison précise dépôt ↔ historique de base sera nécessaire avant de qualifier une migration manquante ou en dérive.

### 6.4 Avis de sécurité/performance
L'outil d'avis Supabase signale des catégories à examiner, dont :
- tables avec RLS activé mais aucune politique (niveau INFO);
- plusieurs politiques permissives pour un même rôle/action sur diverses tables;
- un index dupliqué sur `public.stocks_lots` (`stocks_lots_id_uidx` et `stocks_lots_id_uq`).

Ces avis ne sont pas tous automatiquement des vulnérabilités : une politique permissive peut être voulue si les expressions se combinent correctement, mais la multiplicité augmente le risque d'erreur de portée et de performance. L'index dupliqué est un signal de maintenance/performance. Les détails par table, expression et privilège devront être triés dans l'audit de sécurité; aucune modification SQL n'a été faite.

## 7. État Vercel — lecture seule

- Équipe visible : `NAXA`, slug `naxa3`, plan **Hobby**.
- Projet : `naxa`, framework Next.js, Node configuré `24.x`.
- Domaines associés : `naxa-naxa3.vercel.app` et `naxa-git-main-naxa3.vercel.app`.
- SSO activé pour tous les déploiements; protection par mot de passe désactivée; restriction IP désactivée.
- Le projet rapporte `live: false` et le dernier déploiement connu en cible production a l'état **ERROR** : `dpl_DbAaBdHoEYrSoiu1J1BnKndn5CSQ`, commit `af7230b2cf63e2ef6f024e525bf5a9159a2eed2b`. Les 10 déploiements les plus récents renvoyés par l'API sont en état **ERROR**; ils sont liés à des commits de main du lot de refonte admin. Aucun nouveau déploiement n'a été déclenché par ce chantier.
- Les domaines d'alias indiquent un projet configuré, mais ne suffisent pas à conclure que la version attendue est actuellement servie en Production.

### 7.1 Variables Vercel
Les variables ont été listées sans déchiffrement intentionnel. Les clés visibles couvrent notamment :
- configuration publique de routage OSRM et URL canonique du site;
- configuration Supabase (URL, clé publique et service role, dont certaines entrées sont scindées par environnement/branche);
- Web Push VAPID (clé publique/privée), secret de cron;
- e-mails SMTP;
- intégration Google Apps Script;
- secrets de limitation de débit et de session;
- plusieurs entrées Preview limitées à une branche de test.

**Aucune valeur secrète n'est consignée ici.** Les points à vérifier sont la cohérence de l'URL canonique avec les domaines Vercel réellement associés, la séparation Production/Preview, les clés Supabase de test dédiées aux previews et les doublons d'entrées par environnement. Les variables présentes ne prouvent pas que les intégrations correspondantes fonctionnent.

## 8. État des journaux et erreurs

- CircleCI : les outils disponibles n'ont pas livré le détail de l'exécution échouée. La configuration statique révèle toutefois la contradiction de comptage des migrations (290 trouvées contre 96 attendues).
- Vercel : le statut des déploiements est observable et montre des erreurs récentes; les logs détaillés de build n'ont pas encore été extraits.
- Supabase : compteurs de schéma et avis de lint accessibles en lecture seule; les logs runtime/Postgres et les détails complets de chaque avis restent à corréler aux parcours admin.
- Aucun journal de données sensibles ni aucune valeur secrète n'est reproduit dans ce document.

## 9. Contradictions préliminaires à traiter

| ID | Contradiction / risque | Preuve initiale | Statut |
|---|---|---|---|
| P-01 | CI attend 96 migrations racine, dépôt en trouve 290 | `.circleci/config.yml` + arbre Git | **Rouge confirmé statiquement** |
| P-02 | Déploiements Vercel récents en ERROR malgré les changements de code admin | API Vercel, 10 dernières entrées | **Rouge observé; cause de build à extraire** |
| P-03 | `AGENTS.md` interdit les branches, instruction actuelle en exige une | `AGENTS.md` + ordre utilisateur | **Arbitrage appliqué : branche unique du chantier** |
| P-04 | BI documentée avec scopes canoniques vs champs de rapport actuels à confirmer | `docs/BI.md` et route API | **À auditer** |
| P-05 | Avis Supabase de politiques multiples et tables RLS sans politique | Advisor Supabase | **À classifier table par table** |
| P-06 | Index dupliqué sur `stocks_lots` | Advisor Supabase | **Signal de maintenance confirmé** |
| P-07 | La présence d'une route/page ne prouve pas son accessibilité ni le fonctionnement de bout en bout | 18 pages admin recensées | **Audit de navigation à faire** |
| P-08 | L'inventaire des fichiers n'est pas une revue ligne par ligne du code | Arbre Git uniquement à ce stade | **Travail restant explicitement ouvert** |

## 10. Plan des phases suivantes (même branche)

1. **Audit documentaire complet** : lire les documents de référence admin, Promoteur, BI, sécurité, états de parcours et audits déjà réalisés; extraire exigences, décisions, conflits et critères d'acceptation.
2. **Inventaire de routes/navigation** : dresser une matrice de chaque page admin, accès entrant, liens sortants, contrôles d'accès, composants, actions serveur/API/RPC/tables, états vides et erreurs.
3. **Audit page par page et éléments UI** : compter onglets, titres, sous-titres, textes, badges, boutons, champs, menus, messages, états de chargement/erreur/vide; les décomptes seront basés sur le code inspecté et étiquetés comme statiques si non confirmés par rendu réel.
4. **Audit des boucles d'interaction** : pour chaque action, suivre UI → handler → serveur → autorisation/scope → DB/RPC → retour UI/notification → rechargement/état final; relever chemins morts, effets non connectés, doubles actions et états impossibles.
5. **Audit Promoteur et communication** : contrôler toutes les interactions et les boucles métier de bout en bout, incluant les liens pharmacie, messagerie, tickets, réservations et notifications.
6. **Analyse contradictoire cross-rôles** : Admin vs Promoteur vs Responsable vs Caisse vs Pharmacien vs Gestionnaire de stock vs autres partenaires/univers vs Client; vérifier que les agrégats réseau concordent avec les périmètres autorisés et les rapports.
7. **1000 cas d'usage synthétiques** : générer en interne 1000 cas répartis entre marketplace, pharmacie, parapharmacie, examens, prestations, bébé-maman, dispositifs, comptes, stock, réservation, paiement, support, incidents et sécurité; ne pas les afficher individuellement, mais publier la couverture, les familles, les taux de cohérence et les cas bloquants réellement vérifiables.
8. **Code mort/design/animation** : repérer imports et composants inutilisés, liens/handlers inertes, textes de démonstration, états inaccessibles, animations masquant/dégradant l'action, contrastes et accessibilité.
9. **Bilan chiffré** : nombre de pages découvertes/auditées, onglets découverts/audités, éléments par page, fonctionnalités, parcours testés, boucles complètes/incomplètes, pages mortes, défauts classés par gravité et preuves.

## 11. Barème de statut

- 🟢 **Vert** : problème résolu et vérifications disponibles exécutées avec preuves; limites externes éventuelles clairement séparées.
- 🟠 **Orange** : code/document inspecté, mais validation bout en bout incomplète.
- 🔴 **Rouge** : défaut ou contradiction démontrée.
- ⚪ **Non audité** : pas encore de preuve suffisante.

Un simple fichier présent, un test non lancé, un résultat supposé ou un contrôle indisponible ne justifie jamais le vert.

## 12. État actuel de l'étape préliminaire

**Déjà effectué :**
- branche unique créée;
- arbre Git et nombres initiaux établis;
- 18 pages admin et 42 routes API recensées;
- principaux documents de gouvernance et BI lus;
- connexion Supabase Naxa identifiée, compteurs en lecture seule obtenus;
- environnement Vercel identifié, statut de projet, domaines, dernières erreurs et noms de variables examinés sans déchiffrer les secrets;
- cause statique très probable du préflight CI isolée : compte de migrations obsolète dans la configuration.

**Encore nécessaire avant de déclarer l'étape préliminaire achevée :**
- inventorier toutes les ressources et documents pertinents de façon systématique;
- comparer les migrations dépôt/base et lire les détails des avis Supabase;
- extraire les logs de build Vercel disponibles;
- analyser les documents d'état et les historiques de conversations récupérables supplémentaires;
- lire le code des pages, composants, actions, API, règles RLS et fonctions liées à l'admin, par lots avec preuve de couverture;
- enrichir ce document avec les décomptes et constats détaillés avant de demander l'autorisation pour le chantier de correction suivant.

**Décision : aucune correction fonctionnelle ni fusion n'est commencée tant que cette étape préliminaire n'est pas terminée et présentée.**


## 13. Complément après extraction des journaux disponibles

### 13.1 Logs de build Vercel — erreur exacte obtenue
L'extraction des événements du déploiement `dpl_DbAaBdHoEYrSoiu1J1BnKndn5CSQ` a finalement révélé :
- `npm run build` a échoué pendant la vérification TypeScript;
- fichier rapporté : `src/components/admin/CatalogueCreation.tsx`, ligne 53;
- erreur : **`Type error: An object literal cannot have multiple properties with the same name.`**;
- propriété en cause : `canal_unique` dupliquée dans l'objet d'erreurs;
- commande terminée par `BUILD_UTILS_SPAWN_1` / code 1.

Le code de la référence `main` actuelle `cfca684...` a déjà retiré la clé `canal_unique` en double dans un commit plus récent. Le log Vercel consulté correspond toutefois au commit `af7230b2cf63e2ef6f024e525bf5a9159a2eed2b`, qui **ne correspond pas au HEAD actuel de GitHub main**. En outre, la recherche Vercel par SHA `cfca684...` ne retourne aucun déploiement. Conclusion : la cause du build échoué consulté est certaine et la correction existe dans le code courant, mais il n'y a pas encore de preuve que le HEAD actuel a été compilé par Vercel. Aucun nouveau déploiement n'a été lancé.

Le build de l'ancien commit avait déjà atteint « Compiled successfully » avant de s'arrêter sur la vérification des types. Plusieurs avertissements React/ESLint apparaissent aussi (usage de `<img>`, dépendances de `useEffect`, attribut ARIA sur rôle textbox), mais le log disponible ne les identifie pas comme cause de l'échec TypeScript.

### 13.2 Journaux runtime Vercel
L'agrégat des erreurs runtime sur les dernières 24 heures retourne **aucune erreur runtime regroupée**. Cela ne contredit pas les échecs de build : les builds rejetés n'ont pas nécessairement de runtime associé, et la fenêtre de l'outil ne couvre pas toute l'historique.

### 13.3 Journaux Supabase
La source de logs en lecture seule retourne les volumes suivants pour la fenêtre fournie par l'outil :
- `pgbouncer_logs` : 13 424 événements;
- `edge_logs` : 6 136;
- `postgres_logs` : 3 603;
- `storage_logs` : 1 923;
- `auth_logs` : 1 544;
- `postgrest_logs` : 273;
- `realtime_logs` : 150;
- `auth_audit_logs` : 26.

La première requête visant à agréger les erreurs utilisait un champ `log_level` absent du schéma exposé et a été rejetée sans effet sur la base. La requête suivante n'a lu que la source et le volume; **aucune conclusion sur le taux d'erreur n'est tirée de ces volumes**. Une requête d'erreurs devra d'abord découvrir les champs réels du flux avant d'extraire les événements pertinents.

### 13.4 Conseillers Supabase — compteurs consolidés
Les avis actuellement retournés sont :
- Sécurité :
  - 5 tables avec RLS activé sans politique (niveau INFO);
  - 5 fonctions `SECURITY DEFINER` exécutables par `anon` (WARN);
  - 117 fonctions `SECURITY DEFINER` exécutables par `authenticated` (WARN);
  - protection contre les mots de passe compromis désactivée (1 avis WARN).
- Performance :
  - 113 clés étrangères sans index couvrant (INFO);
  - 86 index marqués inutilisés (INFO);
  - 59 cas de politiques permissives multiples (WARN);
  - 1 index dupliqué (WARN).

**Interprétation CTO :** ces résultats constituent une liste de contrôle, pas une instruction de suppression automatique. Pour les fonctions SECURITY DEFINER, il faut vérifier l'intention, les GRANT EXECUTE, les vérifications internes et les scopes; certaines fonctions sont destinées au public ou à l'administration. Pour les index inutilisés, la fenêtre d'observation et les workloads réels doivent être connus avant suppression. Les migrations de correction éventuelles devront être additives, testées hors Production et regroupées par risque.

## 14. État de complétude de l'étape préliminaire — révisé

- GitHub : inventaire d'arbre, branche de référence et documents principaux inspectés.
- Vercel : projet, domaines, variables (noms/cibles sans valeurs secrètes), dix derniers déploiements et erreur de build détaillée inspectés.
- Supabase : projet principal et projets de replay identifiés; schéma compté en lecture seule; historique de migrations, avis de sécurité/performance et sources de logs consultés.
- CI : contradiction de compte des migrations démontrée par le code de configuration et le nombre de fichiers.
- Conversations : décisions antérieures récupérées via les synthèses disponibles; pas d'archive exhaustive des transcriptions garantie.
- Code : lecture ciblée des fichiers de rapports/catalogue et inventaire de 18 pages admin / 42 routes API; revue ligne par ligne de l'intégralité du dépôt non encore terminée.

**Statut de la phase préliminaire : 🟠 avancée, mais pas encore close.** Il reste à compléter l'inventaire documentaire systématique, la comparaison migrations dépôt/base, les logs Supabase correctement filtrés, et la lecture de code et des ressources restantes. Le rapport sera encore enrichi sur cette même branche avant de demander l'autorisation de commencer le chantier d'audit page par page et d'implémentation.


## 15. Inventaire technique élargi du dépôt

### 15.1 Répartition des fichiers (arbre Git de référence)
- TypeScript React `.tsx` : **222** fichiers;
- TypeScript `.ts` : **114**;
- SQL `.sql` : **503**;
- Markdown `.md` : **78** dans tout le dépôt;
- JavaScript `.js` : **3**;
- `.mjs` : **3**;
- `.cjs` : **7**;
- fichiers image WebP : **19**, PNG : **15**, SVG : **3**, JPG : **4**;
- autres types : configurations, fichiers PWA, scripts Python, CSV, archives et ressources.

L'arbre comporte des archives ZIP et des ressources médias au niveau racine. Il faudra distinguer les documents de référence actifs des copies d'archives afin de ne pas les traiter comme des instructions équivalentes.

### 15.2 Première métrique statique des pages admin
Un comptage lexical initial des 18 fichiers `page.tsx` a relevé les lignes et marqueurs JSX/HTML suivants. **Ce n'est pas encore le décompte final des éléments visibles** : les composants importés, les layouts, les composants clients, les formulaires server actions et les états conditionnels doivent être inclus avant de publier le bilan définitif.

| Page | Lignes | `button` statiques | `onClick` | liens/`href` | formulaires | champs input/select/textarea | alertes/aria-live |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/admin/alertes` | 33 | 0 | 0 | 6 | 0 | 0 | 1 |
| `/admin/configuration` | 55 | 0 | 0 | 2 | 0 | 2 | 0 |
| `/admin/examens` | 26 | 5 | 0 | 2 | 5 | 10 | 1 |
| `/admin/geolocalisation` | 145 | 2 | 2 | 2 | 0 | 0 | 2 |
| `/admin/journal` | 24 | 0 | 0 | 2 | 0 | 0 | 1 |
| `/admin/messagerie` | 25 | 0 | 0 | 2 | 0 | 0 | 1 |
| `/admin` | 2 | 0 | 0 | 8 | 0 | 0 | 1 |
| `/admin/pharmacies/[id]` | 84 | 6 | 0 | 2 | 4 | 11 | 2 |
| `/admin/pilotage` | 182 | 2 | 2 | 6 | 0 | 0 | 1 |
| `/admin/pilotage/rapports` | 179 | 4 | 4 | 3 | 0 | 2 | 1 |
| `/admin/pilotage/validite` | 31 | 1 | 0 | 0 | 1 | 3 | 1 |
| `/admin/prestations` | 50 | 4 | 0 | 4 | 4 | 8 | 1 |
| `/admin/produits` | 123 | 3 | 0 | 4 | 2 | 10 | 2 |
| `/admin/profil` | 68 | 1 | 0 | 2 | 1 | 5 | 1 |
| `/admin/promoteurs` | 129 | 0 | 0 | 4 | 0 | 0 | 3 |
| `/admin/promoteurs/partenaires/[id]` | 54 | 1 | 0 | 2 | 1 | 1 | 1 |
| `/admin/rappels-lots` | 6 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/admin/univers` | 82 | 15 | 0 | 28 | 15 | 40 | 1 |

**Attention à l'interprétation :** le zéro dans un fichier de page ne signifie pas nécessairement l'absence d'interaction; certaines pages délèguent à des composants importés ou utilisent les actions natives de formulaire. Inversement, un nombre de liens ou boutons ne garantit pas que la cible existe ou que l'action fonctionne.

### 15.3 Hypothèses d'audit immédiates
- `/admin` fait seulement 2 lignes : c'est probablement un point d'entrée qui délègue à un composant; il faudra suivre l'import réel avant de conclure à une page vide.
- `/admin/rappels-lots` fait 6 lignes et ne contient aucun marqueur de contrôle dans ce fichier : il faut vérifier s'il délègue à un composant ou constitue une page morte.
- `/admin/univers` concentre le plus grand nombre de formulaires/champs/liens dans le fichier de page; il est prioritaire pour l'inventaire élément par élément.
- `/admin/journal`, `/admin/messagerie`, `/admin/configuration` et `/admin/profil` sont présents, mais leur accès, leurs dépendances et leurs états d'erreur doivent être contrôlés avec le layout/navigation.
- Ces hypothèses restent ⚪/🟠 jusqu'à l'inspection des imports, actions et conditions d'affichage.

## 16. État révisé de la preuve

La phase préliminaire a maintenant des preuves plus concrètes :
1. cause CI statique identifiée (compteur de migrations);
2. cause exacte d'un build Vercel ancien identifiée (clé objet dupliquée), avec constat que le correctif existe dans un commit GitHub plus récent mais sans déploiement correspondant au HEAD courant;
3. inventaire chiffré du dépôt et métriques statiques initiales des 18 pages;
4. compteurs Supabase et avis classés par catégories;
5. contraintes de sécurité et limites d'accès consignées.

Cela ne signifie pas encore que l'étape préliminaire est close : le parcours demandé exige aussi la lecture et la synthèse des documents métier pertinents restants, la comparaison de l'historique de migrations, l'examen ciblé des logs Supabase avec les champs disponibles et la lecture détaillée des dépendances de code. Le statut reste 🟠 tant que ces preuves ne sont pas complétées.


## 17. Contradictions additionnelles repérées dans le code admin

### 17.1 Garde d'accès non homogène
La lecture ciblée de `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/promoteurs/page.tsx`, `src/app/admin/journal/page.tsx` et `src/app/admin/messagerie/page.tsx` montre des règles différentes :
- layout : `afficherAlertes = profile?.role === "admin" && profile.actif !== false`, donc une valeur `actif = null` n'est pas explicitement refusée;
- tableau de bord `/admin` : vérifie le rôle mais ne sélectionne ni ne vérifie `actif`;
- liste Promoteurs : vérifie le rôle mais pas explicitement l'état actif;
- journal et messagerie : vérifient le rôle et refusent `actif === false`, ce qui autorise également `null` si la colonne le permet;
- API de création des rapports : exige explicitement `profile.actif === true`.

**Contradiction métier/sécurité à vérifier :** le même compte peut rencontrer des décisions d'accès différentes selon la page/API et les valeurs nulles de la colonne `actif`. Le contrôle canonique devrait être établi, puis appliqué côté serveur à toutes les pages/actions/routes API pertinentes. Aucune correction n'a été faite durant l'étape préliminaire.

### 17.2 Contradiction entre navigation et pages
La navigation admin expose 12 entrées : Tableau de bord, Alertes réseau, Journal d’administration, Messagerie, Dossiers Promoteurs, Pilotage réseau, Validité, Rapports, Configuration, Profil, Produits, Univers & catalogue. Le routage recense 18 pages admin, dont Géolocalisation, Examens, Prestations, Rappels de lots, fiche pharmacie et fiche partenaire, qui ne sont pas des entrées directes dans la barre latérale. Cela peut être intentionnel si elles sont atteignables par des liens contextuels; il faut donc contrôler les chemins entrants avant de les qualifier de pages mortes.

### 17.3 Journal d’administration
`/admin/journal` lit les 200 événements les plus récents dans `audit_log` et affiche action, entité, identifiant, acteur et métadonnées. Limites à vérifier dans l'audit complet :
- la limite à 200 ne permet pas une recherche/pagination historique;
- l'erreur de lecture est affichée comme un message général d'autorisation, même si une autre cause DB est possible;
- le JSON de `metadata` est affiché tel quel : il faudra vérifier qu'aucune donnée personnelle, donnée de santé, secret ou contenu sensible ne soit journalisé puis exposé;
- l'existence d'une entrée dans `audit_log` ne prouve pas que toutes les mutations de tous les univers écrivent systématiquement une entrée.

### 17.4 Messagerie
`/admin/messagerie` charge jusqu'à 100 tickets et les messages associés, puis délègue l'interface à `AdminInbox`. Le layout compte les tickets dont le statut est exactement `ouvert`. À vérifier : pagination, nouveaux statuts, ticket sans message, réponses concurrentes, clôture/réouverture, notifications Promoteur/Client, politiques RLS et gestion des erreurs de réponse.

### 17.5 Configuration et profil
- La configuration langue/nuit est conservée dans `localStorage`; le libellé précise que les écrans sans traduction restent dans leur langue d'origine. Le changement de langue ne constitue donc pas une traduction complète de l'interface.
- Le profil met à jour directement les champs de `profiles` via le client Supabase. Il faut vérifier les contraintes RLS et l'unicité/validation du nom d'utilisateur, ainsi que la gestion de collision de valeur et la cohérence avec les autres interfaces de profil.
- Le sélecteur de navigation utilise `usePathname` et compare exactement le chemin avec le `href`; les pages imbriquées peuvent ne pas afficher la section parent comme active si la logique exacte n'est pas adaptée.

## 18. Historique Supabase et logs — précisions
- La table d'historique Supabase rapporte **235 migrations appliquées**, de la version `20261004030744` à `20261025121150`.
- Ce nombre ne doit pas être comparé naïvement aux 290 fichiers racine ou aux 25 fichiers `supabase/migrations/` : le dépôt contient des noms historiques, des migrations timestampées et potentiellement des versions réconciliées/renommées. Il faut produire un diff exact version ↔ nom ↔ contenu avant de déclarer une migration absente.
- La première tentative d'agrégation des logs par `log_level` a échoué car ce champ n'existe pas à la racine. La découverte des clés de `log_attributes` a révélé des clés variables selon le type de log, notamment `level`, `status`, `response.status_code`, `parsed.error_severity` et `parsed.sql_state_code`.
- Une première agrégation avec les clés génériques `level`/`status` a donné zéro erreur, mais ce résultat est **non probant** car ces champs ne sont pas présents ou renseignés de manière uniforme selon la source. Il ne sera pas interprété comme l'absence d'erreurs. Une agrégation par source spécifique et par clés réellement présentes est nécessaire avant toute conclusion.


## 19. Contrôle croisé dépôt ↔ Supabase : migrations admin du 26 octobre

### 19.1 Historique réellement appliqué
La base principale `Naxa` rapporte 235 migrations appliquées, avec dernière version `20261025121150`. Le dépôt `main` contient en plus les migrations suivantes, postérieures à cette version :
- `20261026100000_admin_unified_universe_dossiers.sql`;
- `20261026113000_harden_unified_dossier_relations.sql`;
- `20261026140000_bebe_maman_catalogue_pharmacie.sql`;
- `20261026143000_admin_partner_dossier_optional_coordinates.sql`.

Aucune de ces quatre versions n'apparaît dans l'historique Supabase consulté. Cette constatation ne signifie pas qu'elles sont inutiles; elle indique qu'elles sont dans le dépôt mais pas appliquées sur la base interrogée. Aucune migration n'a été exécutée.

### 19.2 Vérification des objets nécessaires au parcours Promoteur
Une requête en lecture seule a confirmé l'existence de `partners`, `partner_universes`, `pharmacies`, `audit_log`, `tickets_support`, `messages_support` et `pharmacie_documents_recus`. En revanche, elle n'a pas trouvé `admin_partner_dossiers`, `pharmacie_document_historique` ni `pharmacie_documents` dans `public` au moment du contrôle.
Une autre requête sur `pg_proc` a confirmé les routines `stats_pilotage_scope`, `validites_promoteurs_admin`, `naxa_promoteur_valide` et `admin_valider_dossier_pharmacie`, mais n'a pas trouvé `admin_create_partner_dossier`.

### 19.3 Impact fonctionnel probable et preuve
Le code de `src/app/admin/promoteurs/page.tsx` interroge `admin_partner_dossiers` pour afficher les dossiers des partenaires indépendants et affiche explicitement un état d'erreur si cette lecture échoue. Le code de `src/app/admin/creation-univers-actions.ts` dépend de la RPC `admin_create_partner_dossier`. Comme la table et la RPC n'ont pas été trouvées dans la base consultée, **la création et l'affichage des dossiers transversaux des autres univers ne peuvent pas être considérés comme opérationnels sur cet environnement**. La UI peut s'afficher, mais la boucle de données échoue probablement jusqu'à ce que le schéma correspondant soit disponible.
Ce point est prioritaire et classé 🔴 côté cohérence dépôt/base, mais la correction (application de migrations) est hors de cette étape et ne sera pas exécutée sans autorisation explicite de l'environnement et de l'opération.

### 19.4 Contradiction métier
Les écrans et documents annoncent un dossier Promoteur transversal couvrant les pharmacies et partenaires d'autres univers. L'état actuel du dépôt contient la logique correspondante, mais la base interrogée n'a pas encore les objets nécessaires. Le statut doit donc être présenté comme « implémenté dans le code, non opérationnel sur la base vérifiée » plutôt que « terminé ».

## 20. Synthèse documentaire des sources prioritaires lues

Les documents suivants ont été relus en plus du cahier des charges principal, du registre de gouvernance et de `docs/BI.md` :
- `docs/ARCHITECTURE.md` : décrit le flux client → réservation → pharmacie → retrait/paiement → indicateurs et les scopes N1/N2/N3.
- `docs/AUDIT_CONTROLE_PROMOTEUR_POSTES.md` : confirme que le scope Promoteur est issu des liens actifs et que les indicateurs doivent rester agrégés sans données patient nominatives; comporte des vérifications restantes.
- `docs/AUDIT_PARCOURS_CAISSE_ONGLETS.md` : formalise les sept entrées principales de Caisse et les risques/contrôles d'interactions; sert de modèle méthodologique, sans être une preuve de couverture équivalente du parcours Admin.
- `docs/AUDIT_CYCLE_RESERVATION_TICKET_CAISSE.md` : qualifie le cycle de réservation/ticket comme non validé de bout en bout faute de preuve suffisante d'atomicité, d'idempotence et de persistance du ticket.
- `docs/CAHIER_DES_CHARGES_MULTICOMPTE.md` : rappelle la nécessité de préserver l'identité commune, les rôles et les scopes autorisés.
- `docs/CONCEPTION_DASHBOARDS.md` : définit la palette Bento (vert profond, vert d'action, fond vert pâle, jaune canari pour actions principales) et la grammaire commune; le pilotage actuel contient encore des écrans utilisant fond `#ACDC76` et titres orange, ce qui semble diverger du système de design canonique.
- `docs/DICTIONNAIRE_DONNEES.md` et `docs/MATRICE_DONNEES.md` : fixent les sources canoniques de recherche, CA et stock ainsi que les périmètres de données par rôle.
- `docs/SECURITE_PROMOTEUR.md` : fixe les invariants de convention, abonnement, architecture, privilèges et scope réseau.
- `docs/REPRISE.md` et `docs/CONTINUITE_IA_NAXA.md` : conservent des états historiques, parfois avec d'anciennes branches/SHA et règles de workflow; les appliquer seulement après réconciliation avec `AGENTS.md` et l'ordre utilisateur actuel.
- `docs/ETAT-CHANTIER-UNIVERS.md` : trace l'évolution des univers et la nécessité de garder les nouveaux produits en brouillon jusqu'à ce que les règles de publication soient remplies.

### Conséquences pour le futur audit
1. Chaque affirmation « terminé » sera confrontée au code, aux objets Supabase et à une preuve de boucle fonctionnelle.
2. Les écrans admin des univers doivent être testés contre l'environnement réel de base, pas uniquement par présence de composants.
3. Les KPI doivent être comparés aux sources canoniques et à plusieurs scopes (NAXA, Promoteur, pharmacie, caisse), sans additionner des sources redondantes.
4. Le design sera évalué comme contrat fonctionnel (visibilité des états, erreurs, focus, feedback et absence de blocage), pas seulement comme couleur ou animation.
