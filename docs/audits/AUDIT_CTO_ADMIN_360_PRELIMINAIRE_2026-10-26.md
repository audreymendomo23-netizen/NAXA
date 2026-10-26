# NAXA — Audit CTO 360° du parcours Administrateur
**Document de travail unique — étape préliminaire obligatoire**

- Date d'ouverture : 26 octobre 2026
- Branche de travail unique : `audit/admin-360-20261026`
- Branche de référence : `main`
- Commit de référence `main` à l'ouverture : `cfca68442c4f7475451bcfcd70048b3ad56ffec4`
- Objet : établir les preuves de l'étape préliminaire avant tout audit page par page et avant toute correction fonctionnelle.
- Règle d'environnement actualisée au 26 octobre 2026 : l'utilisateur a explicitement autorisé les migrations Supabase nécessaires. Huit migrations de ce chantier sont désormais appliquées au projet NAXA; aucun secret n'a été lu/modifié, aucun merge dans main et aucun déploiement n'ont été effectués.
- État : **audit de sécurité ciblé en cours sur la même branche; les quatre contrôles séquentiels demandés (garde admin, RPC ciblées, catalogue Bébé & Maman, prédicat interne `private.is_admin`) sont clôturés sur leurs périmètres documentés. L'audit global admin 360° et la revue exhaustive du dépôt restent ouverts.**

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


## 21. Variables et workflows — inventaire sans secrets

### 21.1 Vercel — inventaire des 27 entrées visibles
Les valeurs sensibles n'ont pas été déchiffrées. Les clés et cibles retournées sont :
- `NEXT_PUBLIC_NAXA_ROUTING_URL` — Production/Preview/Development;
- `NEXT_PUBLIC_SITE_URL` — Production/Preview/Development;
- `NAXA_VAPID_SUBJECT` — Production/Preview/Development;
- `NAXA_VAPID_PUBLIC_KEY` — Production/Preview/Development;
- `NAXA_VAPID_PRIVATE_KEY` — Production/Preview/Development (sensitive);
- `CRON_SECRET` — Production;
- `GOOGLE_APPS_SCRIPT_SECRET` — une entrée par environnement;
- `GOOGLE_APPS_SCRIPT_URL` — Production;
- `SMTP_PASSWORD` — une entrée par environnement;
- `SMTP_USER`, `SMTP_FROM`, `SMTP_HOST`, `SMTP_PORT` — Production/Preview/Development;
- `SUPABASE_SERVICE_ROLE_KEY` — Production, Preview, Development et une entrée Preview dédiée à la branche `fix/login-page-layout-20261012`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Production/Preview/Development et une entrée Preview dédiée à cette branche;
- `NEXT_PUBLIC_SUPABASE_URL` — Production/Preview/Development et une entrée Preview dédiée à cette branche;
- `NAXA_RATE_LIMIT_SECRET` et `NAXA_PHARMACY_COOKIE_SECRET` — Preview sur la branche de test.

Les entrées par environnement expliquent certains noms répétés; la répétition n'est pas, à elle seule, une erreur. Risques à confirmer :
1. la valeur de `NEXT_PUBLIC_SITE_URL` est documentée dans Vercel comme URL canonique, tandis que les domaines associés au projet sont `naxa-naxa3.vercel.app` et `naxa-git-main-naxa3.vercel.app`; cette différence doit être vérifiée dans les redirections OAuth et les e-mails;
2. une clé `SUPABASE_SERVICE_ROLE_KEY` est définie globalement sur Preview en plus d'une clé Preview spécifique à une branche. Sans lire/déchiffrer les valeurs, il est impossible de prouver que toutes les Preview utilisent un projet de test plutôt que la base Production. Il faut vérifier la cible de chaque environnement dans l'interface de configuration, sans révéler la valeur des clés;
3. le routage OSRM est explicitement documenté comme service public de démonstration sans trafic temps réel : ne pas présenter les ETA comme trafic réel.

### 21.2 GitHub Actions — variables et secrets référencés par le code
Les workflows actifs sous `.github/workflows/` référencent les noms suivants :
- import BDPM : `vars.SUPABASE_URL`, `secrets.SUPABASE_SERVICE_ROLE_KEY`;
- import d'images médicaments : `secrets.NEXT_PUBLIC_SUPABASE_URL`, `secrets.SUPABASE_SERVICE_ROLE_KEY`;
- sauvegarde indépendante : `secrets.NAXA_BACKUP_S3_BUCKET`, `secrets.NAXA_DATABASE_URL`, `secrets.NAXA_BACKUP_ENCRYPTION_KEY`, `secrets.NAXA_BACKUP_AWS_ACCESS_KEY_ID`, `secrets.NAXA_BACKUP_AWS_SECRET_ACCESS_KEY`, `secrets.NAXA_BACKUP_AWS_REGION`, `secrets.NAXA_BACKUP_S3_ENDPOINT_URL`, `vars.NAXA_BACKUP_S3_PREFIX`.

Les workflows `naxa-quality.yml.disabled` et `naxa-registry-guard.yml.disabled` sont explicitement désactivés par leur extension. L'outil GitHub disponible ne permet pas de lire la présence/valeur des secrets d'Actions; leur présence n'est donc pas certifiée. Les workflows actifs utilisent des contrôles `test -n` pour les secrets de leurs propres jobs, mais cela ne prouve pas que les workflows ont été exécutés avec succès.

### 21.3 Secrets Supabase
Les outils connectés exposent les projets, migrations, tables, routines, avis et logs, mais aucun inventaire de secrets de projet Supabase n'est disponible dans les outils accessibles pour ce chantier. Aucun secret Supabase n'a été lu ni modifié. Les valeurs de clés API, service role, JWT, SMTP et backup ne doivent pas être copiées dans le rapport.

## 22. Résumé de risques documentaires et opérationnels consolidés

Les constats les plus importants à porter dans la suite :
1. **CI rouge probable et cause déterministe dans le script** : le contrôle exige 96 migrations racine alors que le dépôt en contient 290.
2. **Vercel non synchronisé avec le HEAD GitHub actuel** : l'ancien déploiement analysé a échoué sur une clé d'objet dupliquée qui a été supprimée ensuite; aucun déploiement n'est enregistré pour le SHA actuel `cfca684...`.
3. **Dossiers partenaires non fonctionnels sur la base inspectée** : quatre migrations du 26 octobre sont dans le dépôt mais absentes de l'historique DB; table `admin_partner_dossiers` et RPC `admin_create_partner_dossier` non trouvées.
4. **Contrôles admin incohérents** : certaines pages vérifient seulement le rôle; d'autres vérifient aussi `actif`, avec des sémantiques différentes pour `false` et `null`.
5. **Sécurité et performance Supabase** : 5 tables RLS sans policy, 5 fonctions SECURITY DEFINER exécutables par anon, 117 exécutables par authenticated, 59 cas de politiques permissives multiples, 113 FK sans index couvrant, 86 index signalés inutilisés, 1 index dupliqué et protection des mots de passe compromis désactivée. Les avis nécessitent un tri métier, pas une suppression aveugle.
6. **BI et design** : documents canoniques plus stricts que certaines pages actuellement visibles; scopes, source de CA, états d'erreur et palette doivent être vérifiés dans le code et la base.
7. **Historique et secrets** : anciens documents comportent des branches/SHA/consignes dépassés; les secrets GitHub et Supabase ne peuvent pas être vérifiés par les connecteurs accessibles.

## 23. Critère de clôture de l'étape préliminaire
L'étape préliminaire ne sera déclarée terminée que lorsque le rapport comprendra :
- les documents métier critiques et leurs contradictions réconciliées;
- les preuves techniques de base/dépôt et le statut des migrations;
- l'état des logs Vercel/Supabase exploitable sans secrets;
- l'inventaire du code admin et de ses dépendances;
- les limites non levables clairement listées.

L'audit page par page demandé constitue l'étape suivante distincte; il ne doit pas être commencé comme chantier de correction avant présentation du présent état préliminaire et autorisation de l'utilisateur.


## 24. Clôture de livraison du document préliminaire

- Branche de travail : `audit/admin-360-20261026`.
- HEAD de la branche avant ce dernier commit de clôture documentaire : `4bf2bb69d5fec582f3dc81a2b1a1b1cd0bb654d5`. Le SHA final est celui du commit qui ajoute cette section.
- HEAD de `main) inchangé : `cfca68442c4f7475451bcfcd70048b3ad56ffec4`.
- Comparaison GitHub : branche d'audit en avance de 9 commits documentaires, en retard de 0 commit; **un seul fichier ajouté/modifié par le lot** : ce rapport.
- Aucun code applicatif modifié; aucune migration appliquée; aucun secret modifié; aucun déploiement déclenché.
- Aucune CI, compilation ou suite de tests n'a été relancée manuellement.
- L'analyse de toutes les lignes de tous les fichiers du dépôt n'est pas certifiée : le dépôt contient 1 228 entrées, 336 fichiers TS/TSX et 503 fichiers SQL. Le présent document est un rapport préliminaire fondé sur inventaire, lectures ciblées, documents prioritaires et preuves directes des outils. Le véritable audit détaillé des pages et de leurs dépendances devra compléter cette couverture, avec une matrice explicite des fichiers effectivement lus.
- L'archive brute de toutes les conversations n'est pas accessible dans son intégralité; les décisions historiques reprises ici viennent des synthèses et documents de continuité disponibles.

**Conclusion de la phase 0 :** le dossier préliminaire est créé, les sources principales sont identifiées et plusieurs contradictions prioritaires sont prouvées. Le niveau de confiance est suffisant pour lancer l'audit page par page, mais ne doit pas être présenté comme une certification ligne par ligne de l'intégralité du dépôt.


---

## 14. Audit détaillé — lot 1 : navigation, layout et tableau de bord

**Référence analysée :** branche `audit/admin-360-20261026`, code lu dans `src/app/admin/layout.tsx`, `src/components/admin/AdminNavigation.tsx`, `src/app/admin/page.tsx`, `src/components/admin/CatalogueCreation.tsx` et `src/app/admin/admin-bento.css`. Les constats ci-dessous sont une revue statique du code source, pas une validation visuelle en navigateur ni un test d'intégration. Aucun code applicatif n'a été modifié dans ce lot.

### 14.1 Navigation latérale — inventaire et comportements

**12 entrées de navigation** détectées, dans l'ordre du code :

1. Tableau de bord — `/admin`
2. Alertes réseau — `/admin/alertes`
3. Journal d’administration — `/admin/journal`
4. Messagerie — `/admin/messagerie`
5. Dossiers Promoteurs — `/admin/promoteurs`
6. Pilotage réseau — `/admin/pilotage`
7. Validité — `/admin/pilotage/validite`
8. Rapports — `/admin/pilotage/rapports`
9. Configuration — `/admin/configuration`
10. Profil — `/admin/profil`
11. Produits — `/admin/produits`
12. Univers & catalogue — `/admin/univers`

Chaque entrée comporte un index numéroté, un libellé, une note descriptive et une flèche décorative. Le conteneur expose `aria-label="Pages d’administration"`; l'élément actif utilise `aria-current="page"`. Le layout ajoute un lien-logo vers `/admin`, la légende « ESPACE DE TRAVAIL », puis le pied « Console NAXA / Interface d’administration ».

**Constat N1 — navigation active sur les routes imbriquées (à confirmer visuellement).** Le calcul est strictement `pathname === section.href`. Sur `/admin/pilotage/rapports`, l'entrée « Rapports » est active, mais sur `/admin/promoteurs/partenaires/[id]`, aucune entrée ne correspond exactement; « Dossiers Promoteurs » n'est donc pas marquée active. Même risque pour `/admin/pharmacies/[id]`, `/admin/examens`, `/admin/prestations`, `/admin/geolocalisation` et `/admin/rappels-lots`, dont les routes ne sont pas directement dans la liste. Ces routes peuvent rester accessibles par liens contextuels, mais la navigation perd le repère de section.

- **Solution proposée :** définir une règle de parent actif explicite pour les routes filles, sans faire correspondre abusivement `/admin` à toutes les routes; décider aussi si les pages métier contextuelles doivent apparaître dans le menu ou uniquement sous leurs pages parentes.
- **État :** 🔴 incohérence statique confirmée pour les routes imbriquées; correction non appliquée, validation utilisateur requise.

**Constat N2 — l'entrée « Journal d’administration » n'est pas prioritaire.** Elle occupe la 3e position de la navigation. Le tableau de bord affiche aussi les « Activités récentes » avec un lien vers le journal. Si la priorité demandée est de mettre le journal en première position du parcours, l'ordre actuel ne la respecte pas.

- **Solution proposée :** placer « Journal d’administration » immédiatement après « Tableau de bord » (ou en première position si l'instruction désigne littéralement la première entrée); à arbitrer avant correction.
- **État :** 🟠 décision d'ordre à confirmer avant toute modification.

**Constat N3 — accessibilité clavier et mobile non prouvée.** Le CSS utilise une barre latérale sticky de 272 px, hauteur `100dvh`, défilement interne et transitions. Le code CSS contient des adaptations responsive, mais aucun parcours clavier, lecteur d'écran ou petit écran n'a été exécuté dans ce lot.

- **Solution proposée :** contrôler focus visible, ordre de tabulation, débordement de la barre latérale et atteignabilité des liens à 320–390 px dans un test navigateur.
- **État :** 🟡 non vérifié, pas qualifié de défaut fonctionnel sans test.

### 14.2 Layout partagé et contrôle d'accès

Le layout lit l'utilisateur via `auth.getUser()`, puis le profil `role,actif`. Les compteurs de badges sont calculés uniquement si `profile?.role === "admin" && profile.actif !== false`. Il interroge en parallèle les pharmacies, `validites_promoteurs_admin()` et le nombre de tickets `statut = "ouvert"`. Le layout affiche le badge d'alertes et celui de messagerie, puis le sélecteur d'espace.

**Constat L1 — les règles « compte actif » divergent entre pages.** Le layout et plusieurs pages acceptent `actif = null` car ils ne rejettent que `actif === false`; la page d'accueil `/admin` vérifie seulement `role === "admin"`; l'API POST des rapports exige `actif === true`. Un même compte peut donc voir certaines pages mais se voir refuser une action de rapport, selon la valeur exacte de `profiles.actif`.

- **Solution proposée :** définir une fonction/garde serveur canonique et appliquer la même politique à toutes les pages et routes API; avant d'imposer `actif === true`, vérifier les données historiques où `actif` est NULL.
- **État :** 🔴 contradiction de contrôle d'accès confirmée dans le code; correction non appliquée.

**Constat L2 — les erreurs de lecture des badges sont partiellement silencieuses.** Le code évite d'ajouter les badges si une requête retourne une erreur, mais ne rend aucun indicateur signalant que le total est incomplet. Le zéro visuel peut ainsi signifier « aucun élément » ou « source indisponible ».

- **Solution proposée :** distinguer « zéro » de « compteur indisponible » (journalisation serveur et/ou état discret), sans bloquer l'accès à la page.
- **État :** 🟠 amélioration proposée; impact exact à confirmer par logs source-spécifiques.

### 14.3 Tableau de bord `/admin` — inventaire fonctionnel

Le fichier de page contient 2 lignes physiques, dont la seconde porte presque toute la logique et le JSX. Il faut donc éviter d'utiliser le nombre de lignes comme indicateur de simplicité ou de complétude.

Éléments statiques repérés :

- 1 en-tête supérieur avec logo et sélecteur d'espace;
- 1 titre « Tableau de bord », 1 surtitre « CENTRE DE CONTRÔLE » et 1 sous-titre;
- 4 cartes KPI : « Pharmacies du réseau », « Stocks horodatés », « À actualiser », « Quartiers renseignés »;
- 1 panneau de progression « Actualisation des stocks » avec barre ARIA de 0 à 100 et date de dernière mise à jour;
- 1 panneau d'état conditionnel (« Stocks à contrôler » / « État des stocks »);
- 1 section « Alertes réseau », compteur agrégé, messages conditionnels sur dates de stock manquantes, pharmacies inactives/masquées et conventions/échéances;
- liens vers Dossiers Promoteurs, Alertes réseau et Validité;
- 1 composant de création/configuration de catalogue;
- 1 section « Journal d’administration / Activités récentes » listant au plus 8 événements et un lien vers le journal complet.

Les valeurs des KPI sont dérivées des lignes de `pharmacies`; le compteur « quartiers » est le nombre de valeurs de quartier distinctes non vides, pas un indicateur de couverture géographique validée. Le taux de stock horodaté est `stocksHorodates / pharmacies.length`, arrondi à l'entier. Quand il n'y a aucune pharmacie, la progression vaut 0 et le texte de rappel indique qu'aucune pharmacie n'est enregistrée.

**Constat D1 — erreurs de données non remontées au tableau de bord.** Les lectures `pharmacies`, `validites_promoteurs_admin()` et `audit_log` n'exposent pas leur champ `error` à l'interface. Si une source échoue, le tableau de bord peut afficher des KPI à zéro, masquer des alertes ou présenter un journal vide comme s'il n'y avait aucune donnée.

- **Solution proposée :** récupérer et traiter chaque erreur explicitement; afficher un état « données indisponibles / indicateurs partiels » et éviter les messages d'absence de données lorsque la requête a échoué.
- **État :** 🔴 défaut de robustesse statique confirmé.

**Constat D2 — compteur agrégé potentiellement double.** Le total du bloc « Alertes réseau » additionne séparément les pharmacies sans date de stock, les pharmacies inactives/masquées et les échéances en alerte. Une même pharmacie peut contribuer à plusieurs catégories; le nombre présenté est donc un nombre de signaux/catégories, pas nécessairement un nombre de dossiers uniques. Le libellé actuel « alertes » n'explicite pas ce grain.

- **Solution proposée :** soit libeller le total « signaux à examiner », soit compter les entités uniques et garder séparément le nombre de signaux par catégorie.
- **État :** 🟠 incohérence sémantique confirmée; choix métier à valider.

**Constat D3 — indicateur de date non équivalent à la santé du stock.** Le code et le texte avertissent correctement qu'une date manquante ne prouve pas une rupture. Cependant, le KPI « Stocks horodatés » mesure la présence de `stock_updated_at`, pas la fraîcheur réelle, la disponibilité des quantités, ni la cohérence stock physique/Marketplace.

- **Solution proposée :** conserver ce KPI avec un nom explicitement temporel et, dans un lot ultérieur, auditer les indicateurs réels de quantité et de fraîcheur par rapport à la source de vérité ERP.
- **État :** 🟡 limite de portée documentée, pas un bug démontré.

**Constat D4 — données récentes potentiellement sensibles dans le journal.** Le dashboard lit `metadata` depuis `audit_log` même si l'aperçu actuel n'affiche que l'action, l'entité, un fragment d'identifiant et la date. La sélection récupère donc plus de données que nécessaire.

- **Solution proposée :** retirer `metadata` de la requête de l'aperçu si elle n'est pas utilisée, puis examiner la minimisation des données et les permissions dans la page Journal.
- **État :** 🟠 minimisation à améliorer; aucun secret n'a été exposé dans le rapport.

**Constat D5 — autorisation moins stricte sur la page racine.** `/admin` vérifie le rôle mais ne vérifie pas explicitement `actif`; il charge ensuite des données de réseau. La règle diffère du POST de rapport et peut diverger de l'intention d'un compte désactivé.

- **Solution proposée :** appliquer la garde d'accès canonique après vérification des valeurs historiques `actif`.
- **État :** 🔴 contradiction de contrôle d'accès confirmée.

### 14.4 Création/configuration d'univers — composant visible sur le tableau de bord

Le composant `CatalogueCreation` expose cinq univers dans le sélecteur : Pharmacie, Parapharmacie, Bébé & Maman, Examens médicaux, Prestations à domicile. Le parcours « Dispositifs médicaux » est explicitement exclu de la création d'établissement. L'utilisateur choisit un univers puis doit cliquer sur « VALIDER » pour afficher le formulaire. Le formulaire d'établissement indépendant comprend notamment nom, ville, quartier, adresse, champs de géolocalisation, WhatsApp, sept cases de pièces documentaires, tarif mensuel, architecture lorsque applicable et identification du Promoteur. Bébé & Maman suit un parcours séparé de rattachement à une pharmacie de parrainage.

Les pièces sont ordonnées ainsi dans le code : KYC, Registre de commerce, NIU, Attestation de non-redevance, Plan de localisation, CNI du Promoteur, Pièce d’existence légale. **La demande de placer KYC et Registre de commerce en tête est respectée dans cette liste.** L'entrée « Aide NAXA » n'est pas présente dans le sélecteur actuel; elle apparaît toutefois dans un dictionnaire de libellés des univers sur la page Dossiers Promoteurs, à confronter au modèle réel des univers lors de l'audit de cette page.

**Constat C1 — l'autocomplete de parrainage n'établit pas à lui seul l'éligibilité.** Le texte indique « pharmacie partenaire active et visible », et les suggestions transmises par la page sont filtrées sur `actif === true && visible_recherche === true`. Le composant de formulaire transmet l'ID sélectionné; la sécurité finale dépend donc de la validation côté serveur de `rattacherServiceBebeMaman`, à auditer avant de déclarer le parcours sûr.

- **Solution proposée :** vérifier l'action serveur et la contrainte DB; ne pas se fier à la seule liste client.
- **État :** 🟡 validation serveur en attente.

**Constat C2 — le formulaire ne rend pas tous les champs de géolocalisation visibles dans ce composant.** `GeolocalisationChamps` est encapsulé dans un composant séparé; le nombre exact de champs, leur validation, leur accessibilité et leur gestion d'erreur doivent être comptés dans son propre audit.

- **Solution proposée :** auditer le composant et l'action serveur ensemble.
- **État :** 🟡 en attente de la fiche de dépendance.

### 14.5 Premier bilan chiffré et décision de suite

| Périmètre du lot 1 | Inventaire statique | Audité dans ce lot |
|---|---:|---:|
| Entrées de navigation latérale | 12 | 12 |
| Pages examinées en détail | 1 page racine + layout partagé | 1 page racine + layout partagé |
| Composants applicatifs de dépendance examinés | 1 composant principal (`CatalogueCreation`) | 1, lecture statique |
| Pages d'administration couvertes dans l'audit approfondi | 18 au total dans le périmètre | 1/18 page en profondeur |
| Tests navigateur / interactions réelles | non comptabilisés comme exécutés | 0 |
| Tests SQL / migrations appliquées | aucun dans ce lot | 0 |

**Limite de décompte :** les « éléments UI » ne sont pas encore un total global exact : des contrôles et textes sont conditionnels selon les données, le rôle et l'univers sélectionné; `GeolocalisationChamps`, `IdentificationPromoteur`, les actions serveur et le sélecteur d'espace ajoutent des éléments dépendants. Les nombres ci-dessus sont des comptes de structure statique, pas une mesure de tout ce qui serait visible dans un état runtime donné.

**Ordre de traitement proposé pour le prochain lot :**
1. valider les problèmes de garde d'accès et d'erreurs silencieuses (D1/D5/L1);
2. examiner les actions serveur de création/rattachement et leurs contraintes SQL (C1/C2);
3. poursuivre la page « Dossiers Promoteurs » et le journal de bout en bout;
4. revenir ensuite à la priorité du Journal dans la navigation et au comportement des routes imbriquées.

Aucune correction applicative, écriture Supabase, migration ou déploiement n'a été exécuté. Les constats rouges sont des défauts statiques identifiés; ils ne sont pas déclarés corrigés.


---

## 15. Lot 2 — corrections A/B et audit Promoteurs

### Vérification avant durcissement
Requête SQL en lecture seule sur Supabase NAXA : 1 profil `role='admin'` avec `actif=true`; aucune ligne admin avec `actif=NULL` ou `actif=false` dans le résultat groupé.

### Corrections de code consignées
- Ajout de `src/lib/admin/require-admin-active.ts`, garde serveur commun : utilisateur authentifié, profil lisible, rôle admin et `actif===true`; refus par défaut en cas d'erreur.
- `src/app/admin/layout.tsx` utilise le garde partagé; les compteurs montrent un avertissement si une source échoue.
- `src/app/admin/page.tsx` utilise le garde, détecte les erreurs pharmacies/validités/journal, signale les indicateurs partiels et ne sélectionne plus `metadata` pour le journal aperçu.
- Le garde est également utilisé par `src/app/admin/promoteurs/page.tsx`, `src/app/admin/journal/page.tsx`, `src/app/admin/creation-univers-actions.ts` et `src/app/admin/promoteurs/partenaires/actions.ts`.
- **Correction appliquée après approbation utilisateur :** `src/app/admin/actions.ts` (`creerPharmacie`) appelle désormais `requireAdminActive("/admin")`. Le fichier a été relu sur la branche et l'ancien contrôle isolé du rôle a disparu. Commit `14d9ed1b96f3f0b9cd0629ad50a5e6e216cb1b99`.

**Statut A/B :** 🟢 corrections statiques consignées et revues; 🟡 build, lint, tests et test navigateur non exécutés. Les KPI peuvent encore afficher leurs valeurs de repli, mais la bannière signale maintenant qu'ils sont incomplets.

### Divergence du parcours Dossiers Promoteurs
La page `/admin/promoteurs` et la fiche `/admin/promoteurs/partenaires/[id]` dépendent de `admin_partner_dossiers`; la création dépend de `admin_create_partner_dossier`; Bébé & Maman dépend de `pharmacie_services` et `admin_set_pharmacie_bebe_maman_service`. Le code SQL existe dans les migrations de la branche, mais ces objets étaient absents de la base Supabase NAXA examinée et les migrations correspondantes n'étaient pas dans l'historique appliqué. Aucune migration n'a été appliquée. **Le parcours transversal reste rouge jusqu'à validation explicite et traitement du décalage code/base.**

Solution : examiner l'ordre et le contenu des migrations, comparer au schéma/historique de l'environnement approuvé, puis n'appliquer que sur autorisation explicite. Vérifier ensuite RLS, grants, RPC et cas d'échec/compensation.

### Contradictions UI / métier
- **KYC :** corrigé après approbation. La fiche détail affiche maintenant `Know Your Customer (KYC)` en première position. Commit `b21c76dbbdbdeb5fec391eae9349ea654b90043f`.
- **Erreur transformée en 404 :** corrigé statiquement après approbation. Une erreur de lecture est journalisée (code/message) puis déclenche une erreur technique générique; seul un résultat sans dossier déclenche `notFound()`. Commit `b21c76dbbdbdeb5fec391eae9349ea654b90043f`. Le rendu de la page d'erreur et les logs n'ont pas été testés en runtime.
- **« Aide NAXA » :** absente du sélecteur courant, mais encore dans les dictionnaires de libellés Promoteurs et dans le SQL qui accepte le slug `aide`. 🟠 Vérifier le référentiel et les dossiers existants avant toute suppression.
- **Justificatifs :** la fiche précise que les cases ne remplacent pas des fichiers authentifiés. Conserver cette distinction; l'upload et l'accès aux pièces restent à auditer. 🟡
- **Bébé & Maman :** l'action valide UUID et pharmacie active/visible, puis appelle une RPC qui recontrôle l'autorisation et l'éligibilité; cohérent statiquement, mais runtime bloqué par la migration absente. 🟡

| Sujet | Statut |
|---|---|
| Garde Admin commun sur layout et pages ciblées | 🟢 statique; tests non exécutés |
| Erreurs de données du dashboard | 🟢 statique; test de panne non exécuté |
| Garde `actif` de création pharmacie | 🟢 code corrigé; tests non exécutés |
| Migrations dossiers partenaires / RPC | 🔴 absentes de la base vérifiée; aucune migration appliquée |
| Affichage KYC en fiche partenaire | 🟢 code corrigé; tests non exécutés |
| 404 indistinguable d'une erreur technique | 🟢 distinction statique corrigée; runtime non testé |
| Référentiel « Aide NAXA » | 🟠 à arbitrer |

Aucune modification de données, migration, fusion ou mise en production n'a été exécutée.


## 16. Lot 3 — suite de l'audit des actions serveur Promoteurs

### Périmètre examiné
Lecture statique de `src/app/admin/creation-univers-actions.ts`, `src/app/admin/promoteurs/partenaires/actions.ts` et des dépendances SQL de création/validation des dossiers. Aucun test runtime ni écriture de données n'a été effectué.

### Contradictions et risques à confirmer
- **Création d'un compte Auth avant la RPC métier :** `creerDossierUnivers` crée l'utilisateur via `supabaseAdmin().auth.admin.createUser`, puis appelle `admin_create_partner_dossier` via le client de session. Si la RPC échoue, le code supprime l'utilisateur, mais ne vérifie pas le résultat de la compensation. Il faut contrôler les effets éventuels de trigger (profil, audit ou lignes liées) et la cohérence avec le contrat SQL.
- **Échec de création peu observable :** les erreurs de création Auth et RPC redirigent vers un message générique sans journalisation structurée de l'étape/code; les détails ne doivent pas être exposés à l'utilisateur, mais doivent permettre le diagnostic serveur.
- **Contrôle de rôle :** les actions nouvellement examinées doivent toutes utiliser le garde actif partagé, et les RPC doivent également faire leur propre contrôle de rôle et d'autorisation. Une garde TypeScript ne remplace pas une vérification SQL.
- **Dépendance non déployée :** `admin_create_partner_dossier` et la table `admin_partner_dossiers` demeurent absentes de l'environnement Supabase vérifié. En conséquence, le parcours de création/consultation n'est pas déclaré opérationnel, même si le code client est cohérent statiquement.
- **Données KYC :** le formulaire envoie `kyc` dans `documents_received`; la persistance effective dépend du schéma/RPC non présent dans la base vérifiée. La correction d'affichage n'atteste donc pas que le KYC est réellement persisté en production.

### État du lot
- Garde d'accès dans `creerPharmacie`, affichage KYC et distinction erreur/404 : 🟢 corrections statiques revues.
- Cohérence des actions serveur, compensation Auth et garanties SQL : 🟠 audit statique en cours.
- Parcours transversal dossiers partenaires en base : 🔴 bloqué par la divergence schéma/migrations; aucune migration appliquée.
- Build, lint, tests automatisés et test navigateur : non exécutés.

### Prochaine décision
Avant toute nouvelle correction métier, terminer l'inspection des fonctions SQL et du cycle de compensation, documenter chaque anomalie avec preuve et correction proposée, puis demander validation de l'utilisateur. Aucune migration, fusion dans `main` ou mise en production n'est autorisée par ce lot.


### 16.1 Anomalie confirmée — anciennes gardes dans les actions du dossier pharmacie

Fichier : `src/app/admin/promoteurs/actions.ts`.

La fonction locale `exigerAdmin()` vérifie l'authentification et `profiles.role === 'admin'`, mais ne demande pas `profiles.actif === true`. Elle est appelée par `mettreAJourPiecesRecues` et `validerDossierPharmacie`. Cela crée une incohérence avec le garde partagé `requireAdminActive` adopté dans le layout, la création de pharmacie et les actions de dossier partenaire.

**Contradiction métier/sécurité :** un profil dont le rôle reste `admin` mais dont le compte est désactivé peut passer ce contrôle de code pour modifier les pièces reçues ou appeler la RPC de validation. L'effet final dépend aussi de la politique/RPC SQL; il n'est pas déclaré exploitable sans test runtime. La garde côté serveur doit être cohérente partout, et la RPC doit conserver son contrôle d'autorisation autonome.

**Correction proposée :** remplacer le contrôle local par `requireAdminActive("/admin/promoteurs")`, conserver la récupération de l'identité authentifiée pour `mis_a_jour_par`, puis auditer la fonction SQL `admin_valider_dossier_pharmacie` et `public.is_admin()` afin de confirmer que le refus d'un administrateur inactif est appliqué côté base. Aucun changement SQL n'est inclus dans cette proposition.

**État :** 🔴 anomalie statique confirmée; correction en attente d'approbation. Pas de test ni de mutation Supabase.

### Mise à jour de la décision
Le lot suivant proposé porte uniquement sur cette garde dans `src/app/admin/promoteurs/actions.ts`. Après validation, le code sera modifié sur cette même branche et le présent document sera mis à jour immédiatement avec le commit, la relecture et les tests réellement exécutés. Aucune fusion ni aucun déploiement.


### 16.2 Correction appliquée — garde active des actions Promoteurs

- Commit : `85451fccfd0432bf2dedcf3edfc0e88705071444`
- Fichier : `src/app/admin/promoteurs/actions.ts`
- Changement : remplacement de la garde locale qui vérifiait seulement le rôle par l'appel au garde partagé `requireAdminActive("/admin/promoteurs")`.
- Contradiction vérifiée : les deux actions `mettreAJourPiecesRecues` et `validerDossierPharmacie` passent désormais par la garde commune. L'identifiant authentifié reste utilisé pour renseigner `mis_a_jour_par`.
- Limite : correction relue statiquement, non exécutée en test; le refus côté SQL doit être confirmé indépendamment. Aucune mutation Supabase.

### 16.3 Anomalie suivante — compensation Auth/RPC

Le parcours de création Promoteur crée un utilisateur Auth avant l'appel RPC `admin_create_partner_dossier`. En cas d'échec de RPC, le code tente de supprimer l'utilisateur mais ne vérifie pas explicitement le résultat de cette suppression. Le schéma/RPC attendu étant absent de la base Supabase inspectée, les effets éventuels de triggers ne peuvent pas être confirmés.

**Correction proposée pour la suite :** rendre l'échec traçable côté serveur (étape et code, sans divulguer les détails au navigateur), vérifier la réponse de la suppression compensatoire, et éviter toute suppression aveugle en cas d'incertitude sur la création du compte. Couvrir les scénarios succès RPC, échec RPC, échec suppression et effets de triggers. Cette anomalie n'est pas corrigée dans ce commit.

### État de progression actualisé
- Garde active dans les actions Promoteurs : 🟢 correction statique appliquée et relue; tests non exécutés.
- Compensation Auth/RPC : 🟢 journalisation serveur et vérification de la compensation ajoutées, relecture statique effectuée; tests runtime non exécutés.
- Divergence schéma/migrations Supabase : 🔴 bloquante; aucune migration appliquée.
- Aucun merge dans `main`, aucun déploiement.
- Build, lint, typecheck, tests et navigateur : non exécutés.


### 16.4 Journal des corrections appliquées dans cette progression

1. `src/app/admin/promoteurs/actions.ts` — commit `85451fccfd0432bf2dedcf3edfc0e88705071444`: garde locale remplacée par `requireAdminActive("/admin/promoteurs")`.
2. `src/app/admin/creation-univers-actions.ts` — commit `7bd02f1cdba184dbe6367069e8f545b899072e5f`: ajout de journaux serveur pour échec Auth/RPC et vérification/journalisation de la suppression compensatoire.

Relecture statique de ces deux fichiers confirmée après écriture. Aucun test automatisé, lint, typecheck, build ou test navigateur exécuté. Aucune écriture Supabase, migration, fusion dans `main` ou mise en production.


### 16.5 Contrôle SQL d'autorisation — anomalie confirmée et migration préparée

Une lecture SQL strictement en lecture seule de la base Supabase a confirmé :
- `public.admin_valider_dossier_pharmacie` est une fonction `SECURITY DEFINER` qui appelle `public.is_admin()`.
- `public.is_admin()` délègue à `private.is_admin()`.
- La définition live de `private.is_admin()` vérifie uniquement `profiles.id = auth.uid()` et `role = 'admin'`; elle ne vérifie pas `actif`.

**Contradiction confirmée :** la garde TypeScript partagée exige un administrateur actif, mais plusieurs RPC/politiques qui s'appuient sur `public.is_admin()` peuvent encore considérer comme administrateur un profil inactif. Le contrôle côté base n'est donc pas aligné avec la règle métier.

**Correction préparée sur la branche :** migration additive `supabase/migrations/20261026150000_require_active_admin_for_is_admin.sql`, commit `c3ed68a69891254bcb8bc17ae344d20ac9f121c2`. Elle remplace `private.is_admin()` pour exiger également `actif IS TRUE`. Cela durcit tous les usages qui délèguent à cette fonction, pas seulement la RPC pharmacie; cette portée est intentionnelle mais nécessite une revue des flux administratifs avant application.

**Limite critique :** migration ajoutée au dépôt uniquement; elle n'a pas été appliquée à Supabase. Aucune donnée ni fonction live n'a été modifiée. Il reste à vérifier l'impact sur les usages RLS/RPC, écrire des tests SQL (admin actif/inactif/non-admin/non-authentifié), puis exécuter la suite automatisée lorsque l'environnement le permet.

### 16.6 Résumé de cette progression

- Garde active des actions Promoteurs : 🟢 code corrigé, commit `85451fccfd0432bf2dedcf3edfc0e88705071444`.
- Journalisation et vérification de la compensation Auth/RPC : 🟢 code corrigé, commit `7bd02f1cdba184dbe6367069e8f545b899072e5f`.
- Garde SQL `private.is_admin()` : 🟠 migration préparée, commit `c3ed68a69891254bcb8bc17ae344d20ac9f121c2`; non appliquée.
- Rapport mis à jour dans ce commit.
- Tests, lint, typecheck, build et tests navigateur : non exécutés.
- Aucun merge dans `main`, aucun déploiement, aucune migration appliquée à la base.


### 16.7 Migrations Supabase appliquées — 2026-10-26

Suite à l'autorisation explicite de l'utilisateur d'écrire dans Supabase lorsque nécessaire, quatre migrations ont été appliquées avec succès au projet NAXA `eouwtuusnsuxaejsxknf` via l'outil de migration, dans l'ordre suivant :

1. `admin_unified_universe_dossiers_20261026100000` — version enregistrée `20261026142636`.
2. `harden_unified_dossier_relations_20261026113000` — version enregistrée `20261026142640`.
3. `admin_partner_dossier_optional_coordinates_20261026143000` — version enregistrée `20261026142649`.
4. `require_active_admin_for_is_admin_20261026150000` — version enregistrée `20261026142652`.

**Vérifications après application (lecture seule) :**
- Les tables `public.admin_partner_dossiers` et `public.pharmacie_services` existent désormais et ont RLS activé.
- `public.admin_create_partner_dossier`, `public.admin_valider_dossier_partenaire` et `public.admin_set_pharmacie_bebe_maman_service` existent avec leurs définitions attendues.
- `private.is_admin()` exige désormais `role = 'admin'` et `actif IS TRUE`.
- Le décompte confirme 1 profil administrateur actif, 0 profil administrateur inactif ou avec état actif NULL, 0 dossier partenaire et 0 service pharmacie. Aucune donnée métier existante n'a été créée ou modifiée par ces vérifications.
- Le suivi des migrations Supabase confirme les quatre migrations comme appliquées.

**Limites restantes :** aucun test de parcours applicatif n'a été exécuté avec une session réelle. Les scénarios de création/compensation Auth-RPC, validation métier, RLS et refus d'un administrateur inactif restent à couvrir par tests. La migration `20261026140000_bebe_maman_catalogue_pharmacie.sql` n'a pas été appliquée dans ce lot; elle modifie le catalogue et les réservations et nécessite une revue distincte, notamment parce qu'une branche de sa fonction de reçu vérifie encore le rôle admin directement au lieu de réutiliser `public.is_admin()`.

### État actualisé
- Garde applicative Promoteurs : 🟢 code corrigé, tests runtime non exécutés.
- Compensation Auth/RPC : 🟢 journalisation et contrôle du résultat ajoutés, scénarios d'échec non testés.
- Schéma dossiers partenaires/services et garde SQL administrateur actif : 🟢 migrations appliquées et objets vérifiés.
- Parcours métier complet : 🟠 à tester en session réelle et à contrôler contre le schéma live.
- Migrations de catalogue Bébé & Maman : 🟠 non appliquée, revue distincte requise.
- Aucun merge dans `main`, aucun déploiement. Aucun lint, typecheck, build ou test automatisé exécuté.


## 16.8 Vérification SQL après durcissement — résultats reproductibles

Les vérifications ont été exécutées après application des migrations, dans des transactions annulées (ROLLBACK) pour les scénarios qui modifient temporairement le profil. Aucun dossier, produit ou réservation métier n'a été créé.

| Scénario SQL | Résultat observé | Verdict |
|---|---|---|
| Administrateur actif | private.is_admin() = true | 🟢 |
| Administrateur temporairement désactivé dans une transaction puis rollback | private.is_admin() = false | 🟢 |
| Profil non administrateur | false | 🟢 |
| UUID inconnu | false | 🟢 |
| Identité non authentifiée | false | 🟢 |
| Reçu de réservation | la fonction utilise public.is_admin(); l'ancien contrôle direct role='admin' a disparu | 🟢 |
| Tables concernées | RLS activé sur admin_partner_dossiers, pharmacie_services, partner_products, universe_reservations; politiques présentes | 🟢 |
| Données Bébé & Maman | 0 produit, 0 réservation; 0 produit actif sans pharmacie et 0 réservation sans pharmacie | 🟢 |

La migration 20261026140000_bebe_maman_catalogue_pharmacie.sql a été corrigée avant application : le reçu de réservation réutilise désormais le garde partagé public.is_admin(), qui exige un profil administrateur actif. Elle a ensuite été appliquée avec succès; version enregistrée par Supabase : 20261026143135, nom bebe_maman_catalogue_pharmacie_20261026140000. Le code du catalogue, des réservations et des reçus a été relu côté base après application.

## 17. Lot 4 — harmonisation des gardes de l'espace Administrateur

### Anomalie confirmée par contradiction

Plusieurs pages et Server Actions vérifiaient seulement role = 'admin', ou rejetaient uniquement actif = false. Cette dernière condition laissait passer un profil dont actif est NULL, contrairement à la règle métier canonique (actif === true) et à la garde SQL durcie. Le contrôle de page ne suffisait pas : les Server Actions doivent répéter le contrôle côté serveur.

### Corrections appliquées sur la branche de travail

Les pages et actions suivantes passent désormais par requireAdminActive :

- src/app/admin/univers/page.tsx et src/app/admin/univers/actions.ts;
- src/app/admin/examens/page.tsx et src/app/admin/examens/actions.ts;
- src/app/admin/prestations/page.tsx et src/app/admin/prestations/actions.ts;
- src/app/admin/produits/page.tsx et src/app/admin/produits/actions.ts;
- src/app/admin/alertes/page.tsx;
- src/app/admin/messagerie/page.tsx.

Chaque fichier modifié a été relu après écriture sur audit/admin-360-20261026. Le contrôle statique post-écriture confirme la présence de la garde partagée et l'absence des anciens contrôles de rôle dans ces dix fichiers. Ces corrections ne sont pas fusionnées dans main.

### Vérifications globales encore nécessaires

- Le lint, le typecheck, le build Next.js, les tests automatisés et le navigateur n'ont pas pu être exécutés via les connecteurs disponibles; ils ne sont donc pas déclarés verts.
- Les fonctions SQL SECURITY DEFINER doivent continuer à être examinées par groupes métier. L'advisor Supabase signale des droits EXECUTE sur 5 fonctions exposées à anon et 120 à authenticated; cet avertissement est générique et ne prouve pas à lui seul une faille, car certaines fonctions appliquent des contrôles internes. Aucun retrait global de droits n'a été fait sans examen des contrats applicatifs.
- L'advisor signale aussi 5 tables RLS sans politique (caisse_audit_chain_heads, caisse_decaissement_auth_grants, caisse_security_challenges, caisse_security_credentials, pharmacie_donnees_historique) et la protection des mots de passe compromis désactivée. Ces constats restent ouverts; ils ne sont pas masqués par les corrections du parcours Administrateur.
- Le parcours de création Auth/RPC nécessite toujours un test runtime des scénarios d'échec Auth, RPC et suppression compensatoire avec un compte de test isolé.

### État courant au 26 octobre 2026

- Garde SQL administrateur actif et tests SQL actif/inactif/non-admin/inconnu/non-authentifié : 🟢.
- Migrations dossiers, services et catalogue Bébé & Maman : 🟢 appliquées et objets vérifiés.
- Gardes de 10 fichiers Administrateur : 🟢 correction statique appliquée et relue.
- Suite automatisée et test navigateur : 🟠 non exécutés, aucune affirmation de succès.
- Advisor sécurité Supabase global : 🟠 plusieurs constats existants restent à traiter par lots métier.
- Merge main : non effectué. Déploiement : non effectué.


## 17.1 Durcissement SQL complémentaire — RPC exposées

L'inspection des définitions live a révélé une deuxième classe de contournement : certaines fonctions SECURITY DEFINER contrôlaient encore directement profiles.role = 'admin'. Une action directe via RPC pouvait donc contourner le garde des pages, et certains contrôles acceptaient les administrateurs désactivés.

### Corrections appliquées

Deux migrations additives supplémentaires sont appliquées et présentes dans le dépôt :

- 20261026160000_admin_rpc_active_guard.sql — remplace les gardes rôle-seul dans les RPC de statut des centres/examens, prestations, associations partenaire-univers et activation d'univers.
- 20261026170000_harden_remaining_admin_rpc_guards.sql — harmonise aussi l'expiration des réservations, la génération des créneaux pour un centre, le reçu de prestation à domicile, le contrôle des comptes de test Suivi, l'ajustement du stock partenaire et l'import CSV catalogue.

Les contrôles de périmètre partenaire (owner/manager/operator) sont conservés; seul le chemin de privilège administrateur passe par public.is_admin(). Pour le traitement des réservations expirées, l'accès service_role reste autorisé; la branche administrateur exige désormais un administrateur actif.

Versions Supabase confirmées :
- 20261026143839 — admin_rpc_active_guard_20261026160000.
- 20261026144128 — harden_remaining_admin_rpc_guards_20261026170000.

### Tests SQL après application

- Les six RPC d'administration modifiées dans la première migration refusent un administrateur temporairement désactivé : test transactionnel avec SQLSTATE 42501.
- Expiration des réservations, génération de créneaux et import catalogue refusent également le profil admin temporairement désactivé; le contrôle Suivi refuse la consultation du compte de test d'un autre utilisateur. Toutes les modifications de test ont été annulées.
- Une relecture SQL des 12 fonctions ciblées confirme qu'elles appellent public.is_admin() et qu'aucune ne conserve de contrôle direct role='admin'.
- Le scan des fonctions SECURITY DEFINER restantes qui contiennent une comparaison directe role='admin' ne trouve plus que des fonctions non exécutables par anon/authenticated : generate_exam_slots, naxa_bootstrap_first_admin, notify_home_service_offer_created et rapports_non_envoyes. Elles restent à examiner dans leur contexte de tâche/trigger, mais ne sont pas appelables directement par les deux rôles.
- Les cinq tables signalées par l'advisor RLS sans politique ne donnent aucun privilège SELECT/INSERT/UPDATE/DELETE à anon ou authenticated. La politique « aucune » est donc un refus d'accès effectif pour ces rôles, pas une exposition directe de table.

### Limites de test à conserver visibles

La base ne contient actuellement aucun produit partenaire, aucune demande de prestation à domicile, aucune réservation universelle et aucun centre d'examen. Il n'était donc pas possible de tester les branches de reçu ou d'ajustement stock avec un enregistrement métier réel sans créer des données de test dépendantes. Ces branches ont été vérifiées statiquement dans leurs définitions; les tests runtime négatifs exécutés ont ciblé les chemins de garde qui précèdent toute mutation.

## 18. Prochaine étape — lot 5 : permissions des RPC et validation applicative

Le contrôle du garde administrateur actif est maintenant cohérent entre les pages/Server Actions corrigées et les RPC ciblées. La prochaine passe doit vérifier les contrats et permissions des RPC SECURITY DEFINER restantes par famille métier, puis exécuter lint, typecheck, build et tests navigateur depuis un environnement de développement. Les connecteurs utilisés ici ne permettent pas d'affirmer que ces commandes ont réussi. Aucun déploiement ne sera lancé pour les exécuter.


## 18.1 Lot 5 — garde SQL interne et premiers contrôles des RPC exposées

La relecture a identifié que private.is_admin() utilisait encore search_path = public malgré la qualification explicite de ses objets. Une migration additive a fixé search_path à la chaîne vide afin de réduire le risque de résolution d'objets dans cette fonction SECURITY DEFINER :

- Migration : 20261026180000_harden_private_is_admin_search_path.sql.
- Version Supabase confirmée : 20261026144414.
- Contrôle après application : la définition live confirme search_path vide; tests transactionnels confirment administrateur actif = true et administrateur temporairement désactivé = false. Les transactions ont été annulées.

Un scan SQL des fonctions SECURITY DEFINER avec comparaison directe role='admin' ne trouve plus de raccourci de ce type dans les fonctions RPC métier accessibles à anon/authenticated. Les fonctions restantes identifiées par le scan sont non exécutables par ces rôles : generate_exam_slots, naxa_bootstrap_first_admin, notify_home_service_offer_created et rapports_non_envoyes. Les deux fonctions de génération/bootstrap et les chemins trigger/service restent dans le lot de revue de leur famille respective.

Les cinq tables RLS sans politique remontées par l'advisor ont également été contrôlées : anon et authenticated ne disposent d'aucun privilège SELECT, INSERT, UPDATE ou DELETE sur ces tables. Aucune modification de politique n'a donc été appliquée sans preuve d'un besoin métier.

### État du lot 5

- Garde SQL active sur les RPC ciblées et helper sécurisé par search_path vide : 🟢.
- Accès direct aux cinq tables RLS sans politique : 🟢 refusé par les privilèges, confirmation SQL.
- Audit exhaustif des 120 avertissements SECURITY DEFINER : 🟠 encore nécessaire par familles; l'advisor seul ne suffit pas à déclarer une vulnérabilité ni à justifier un retrait global de droits.
- Protection Supabase contre les mots de passe compromis : 🟠 réglage de sécurité non activé; non modifié dans ce lot.
- Tests de bout en bout UI, lint, typecheck et build : 🟠 non exécutés faute d'environnement d'exécution connecté au dépôt. Aucun déploiement n'a été créé pour lancer ces tests.


## 19. Vérification ciblée n°1 — garde administrateur unifiée (26/10/2026)

### Contrôles réalisés

- Relecture du helper `src/lib/admin/require-admin-active.ts` : il appelle `auth.getUser()`, lit `profiles.role, actif`, refuse toute erreur de lecture, exige `role === "admin"` et `actif === true`. Une valeur `NULL` n'est donc pas considérée active. Le helper redirige une session absente vers la connexion avec un paramètre de retour, et un profil non autorisé vers l'accueil.
- Relecture du layout `src/app/admin/layout.tsx` : le garde s'exécute avant le rendu des pages de l'espace Admin, ce qui couvre aussi les pages Pilotage et Rapports côté navigation serveur.
- Relecture des pages et actions touchées : les pages Admin modifiées et les actions métier utilisent le helper partagé, dont le dossier Promoteur/partenaire, Univers, Examens, Prestations, Produits, Alertes, Messagerie, Journal et la création de dossier.
- Contradiction détectée : `src/app/admin/pilotage/validite/actions.ts` conservait sa propre implémentation de contrôle, au lieu du helper partagé. Elle a été corrigée dans le commit `6207585531a8a2abbdcc3f74360a1277848648c8`; la relecture post-écriture confirme désormais l'appel à `requireAdminActive("/admin/pilotage/validite")`.
- `src/app/api/rapports/route.ts` reste une frontière HTTP distincte : son POST vérifie aussi explicitement rôle administrateur et `actif === true`, mais renvoie des statuts JSON 401/403 plutôt que d'utiliser la redirection d'une page. Le GET conserve le périmètre multi-rôle et ses contrôles de portée; il n'est pas une action d'administration réservée exclusivement à l'admin.

### Verdict de cette vérification

- Cohérence statique du garde pour les pages et Server Actions examinées : 🟢.
- Réutilisation du helper après correction de l'action Validité : 🟢.
- Test runtime des redirections avec sessions authentifiées/non authentifiées : 🟠 non exécuté.
- Typecheck/build et test navigateur : 🟠 non exécutés.
- Aucun merge dans `main`, aucun déploiement et aucune modification métier Supabase effectués pendant cette vérification.

**Périmètre respecté :** seul le point n°1 « Garde administrateur unifiée » a été vérifié et corrigé. Le point n°2 « RPC Supabase sécurisées » n'est pas encore réaudité dans cette étape.


## 22. Clôture validée des quatre contrôles de sécurité ciblés — 26 octobre 2026

L'utilisateur a validé la clôture des quatre contrôles séquentiels. Cette clôture concerne les périmètres explicitement examinés ci-dessous; elle ne constitue pas une certification globale de toutes les pages, RPC, fonctions `SECURITY DEFINER` ou parcours de production.

### 22.1 Garde administrateur unifiée

- Le helper serveur `src/lib/admin/require-admin-active.ts` appelle `supabase.auth.getUser()`, puis vérifie le profil `role = 'admin'` et `actif = true`; les erreurs et valeurs nulles échouent en refus.
- Le layout admin et l'action `src/app/admin/pilotage/validite/actions.ts` utilisent cette garde.
- Commit de correction déjà documenté : `6207585531a8a2abbdcc3f74360a1277848648c8`.
- Limite : pas de tests de redirection avec sessions réelles, lint, typecheck, build ni test navigateur dans cette passe.

### 22.2 RPC Supabase ciblées

- Les 12 RPC du périmètre documenté ont été contrôlées pour leur usage du prédicat central `public.is_admin()`, leur `search_path` vide et les privilèges d'exécution : `anon` n'a pas EXECUTE; `authenticated` conserve EXECUTE afin que chaque fonction applique son autorisation interne.
- Huit fonctions additionnelles du même périmètre ont reçu un durcissement du `search_path` vide via la migration `20261026190000_admin_rpc_empty_search_path_hardening`, enregistrée en base sous la version `20261026150907`.
- Rapport de vérification : `docs/audits/VERIFICATION_RPC_SUPABASE_2026-10-26.md`, commit `f047bbf7d35792cc196ec7e0628d6e73f44c82d8`.
- Limite : cette conclusion s'applique aux RPC ciblées, pas à l'ensemble des fonctions SECURITY DEFINER de la base.

### 22.3 Catalogue Bébé & Maman

- Migration initiale présente dans l'historique Supabase : `bebe_maman_catalogue_pharmacie_20261026140000`, version `20261026143135`.
- Les trois RPC `get_universe_catalog`, `reserve_universe_products` et `get_universe_reservation_receipt` ont des chemins de résolution restreints; la consultation a confirmé l'absence d'EXECUTE pour `anon` sur les deux RPC privées de réservation/reçu, tandis que le catalogue reste consultable.
- Les politiques RLS ciblées ont été réalignées : administration via `public.is_admin()`; lecture publique des produits conditionnée à l'état actif/non expiré et, pour Bébé & Maman, à une pharmacie active, visible et au service activé.
- Vérifications de données : aucun produit, service actif ou réservation Bébé & Maman n'a été trouvé au moment du contrôle; la RPC catalogue renvoyait zéro résultat. Aucun jeu de données fictif n'a été créé.
- Limite : pas de parcours réel produit → réservation → reçu dans l'interface, faute de données réelles disponibles.

### 22.4 Prédicat interne `private.is_admin()`

- Définition vérifiée en base : fonction SQL `STABLE SECURITY DEFINER`, `search_path = ''`, accès à `public.profiles` qualifié explicitement, identité liée à `auth.uid()`, rôle `admin` et `actif IS TRUE`.
- Correctif de permissions appliqué directement en base et enregistré dans l'historique sous `revoke_public_execute_private_is_admin_20261026200000`, version `20261026152116`.
- Après correction : `anon EXECUTE = false`, `authenticated EXECUTE = true`, `service_role EXECUTE = true`; `anon USAGE` sur le schéma `private` est faux.
- Commit de la migration correspondante dans la branche : `236b007cf8bcece393029e9f9574f897440899f5`.

### 22.5 Environnement et limites communes

- Branche de travail : `audit/admin-360-20261026`; aucun merge vers `main`, aucun déploiement.
- Les changements SQL exécutés ont été limités aux migrations/permissions documentées; aucune donnée métier de test n'a été ajoutée.
- Les validations statiques et SQL ci-dessus ne remplacent pas lint, TypeScript, build, tests navigateur ou essais avec sessions réelles. Aucun de ces tests n'est déclaré exécuté dans cette passe.
- Le chantier général d'audit admin 360° reste ouvert. En particulier, l'inventaire live a fait apparaître d'autres fonctions `private` `SECURITY DEFINER` dont le `search_path` ou l'exposition à `anon` diffère; elles constituent le lot suivant d'analyse, sans présumer qu'elles sont vulnérables avant lecture de leur définition et de leurs appelants.



## 23. Suite de l'audit — autres fonctions SECURITY DEFINER internes (26 octobre 2026)

Après la clôture validée des quatre contrôles ciblés, l'inventaire des fonctions du schéma `private` a révélé d'autres cas où les chemins de résolution ou les privilèges n'étaient pas alignés. Ils sont traités séparément afin de ne pas confondre la clôture du contrôle `private.is_admin()` avec une certification globale de toutes les fonctions internes.

### 23.1 Correction additive appliquée et vérifiée

Migration : `harden_remaining_private_security_definer_paths_20261026203000`, enregistrée dans Supabase et versionnée dans la branche.

- Commit GitHub : `f4bcd7c9cf40edfe9b627c01fa8c484ff283c72a`.
- Fonctions dont le chemin a été restreint : `private.is_promoteur()`, `private.my_pharmacie()`, `private.stats_admin(integer)`, `private.stats_pharmacie(uuid, integer)`, `private.set_reservation_status(uuid, resa_statut)`, `private.validites_pharmacies_admin()`.
- `private.set_garde(boolean)` a été réécrite pour appeler explicitement `private.my_pharmacie()`, avec `search_path = 'auth'`.
- Les droits EXECUTE `PUBLIC/anon` ont été révoqués pour six helpers privés qui avaient un grant `anon` superflu : `is_promoteur`, `log_evenement`, `log_recherche`, `my_pharmacie`, `produits_populaires` et `search_pharmacies_panier`.
- Vérification SQL après application : les fonctions modifiées ont les chemins attendus; `anon EXECUTE = false` pour les six fonctions ciblées; les droits `authenticated`/absence de droit de `set_reservation_status` ont été préservés selon l'ACL existante. Le schéma `private` ne donne pas USAGE à `anon`, et la révocation ajoute une défense en profondeur.

### 23.2 État après le premier lot

Le premier lot a supprimé les grants `anon` inutiles sur les helpers privés identifiés et restreint les chemins des fonctions dont le corps était déjà qualifié. Une seconde migration a ensuite durci les chemins des fonctions de paiement, de réactivation, de réservation de stock et de recherche panier. Une troisième migration a qualifié les références aux extensions et les relations du journal de recherche et du catalogue populaire.

### 23.3 Résultat consolidé de l'inventaire du schéma `private`

Après les trois lots, la requête live sur Supabase retourne :

- **36 fonctions `SECURITY DEFINER`** dans `private`;
- **0 fonction de ce périmètre exécutable par `anon`**;
- **0 fonction avec un `search_path` autre que vide ou limité à `auth`**;
- les six helpers utilisant `search_path = auth` sont ceux qui ont besoin de résoudre `auth.uid()` non qualifié; les références aux objets applicatifs sont qualifiées par `public` ou `private`;
- les autres fonctions utilisent `search_path = ''`, avec les objets applicatifs et les fonctions/extensions qualifiés explicitement.

Les permissions `authenticated` ne sont pas uniformisées en bloc : elles sont conservées selon les ACL existantes et les besoins des appelants; `private.set_reservation_status` demeure non exécutable directement par `authenticated`, comme avant. La présence d'une fonction dans ce comptage ne prouve pas à elle seule que tous ses contrôles métier sont parfaits.

### 23.4 Limites et suite du chantier

Ce résultat clôt le lot de durcissement des chemins de résolution et des droits `anon` pour les fonctions `SECURITY DEFINER` du schéma `private`. Il ne clôt pas l'audit global : il reste à inspecter les façades publiques qui appellent ces helpers, les permissions et définitions des fonctions `SECURITY DEFINER` dans `public`, les contrôles métier et les parcours réels, puis exécuter les tests disponibles. Aucun merge vers `main`, aucun déploiement et aucun jeu de données métier fictif.


### 23.4 Deuxième lot de durcissement appliqué

Migration : `harden_payment_reactivation_reservation_search_paths_20261026210000`.

- Commit de branche : `20569210711fe32878a8962744781698d7dbcdf7`.
- `private.declare_payment(uuid, text)` : table de réservation explicitement qualifiée; chemin vide.
- `private.reactiver_pharmacie(uuid, text)` : relations abonnements, paiements, pharmacies et profils explicitement qualifiées; le contrôle `public.is_admin()` et l'écriture de l'acteur `auth.uid()` sont conservés; chemin vide.
- `private.reserve_stock(uuid, jsonb)` : tables de stock, réservation et lignes explicitement qualifiées; contrôles de connexion, quantité, péremption et réservations concurrentes conservés; chemin vide.
- `private.search_pharmacies_panier(...)` : toutes les relations étaient déjà qualifiées et les fonctions utilisées sont natives; chemin vide.
- Contrôle SQL après application : les quatre fonctions ont `search_path = ''`; `anon EXECUTE = false` et les droits `authenticated` restent tels qu'attendus d'après les ACL lues.

### 23.5 Résidu immédiat

La revue des chemins non vides se concentre désormais sur `private.log_evenement`, `private.log_recherche` et `private.produits_populaires`, qui dépendent de fonctions/opérateurs de l'extension `extensions` (`unaccent`, `pg_trgm`) et de tables de catalogue. Il faut qualifier ces références sans modifier le comportement de recherche ni la collecte d'événements. La revue plus large des autres schémas/fonctions et des façades publiques reste ouverte.


### 23.6 Troisième lot de durcissement appliqué

Migration : `harden_search_logging_popular_products_paths_20261026220000`.

- Commit de branche : `ce7c8004178d4daf36296ca7b6be1462d3742b7e`.
- `private.log_evenement` et `private.log_recherche` utilisent maintenant `search_path = ''`, les fonctions `extensions.unaccent` / `extensions.similarity` et l'opérateur `OPERATOR(extensions.%)` sont explicitement qualifiés.
- `private.produits_populaires` qualifie les tables catalogue/stock/événements et utilise `search_path = ''`.
- Contrôle SQL après application : ces trois fonctions ont un chemin vide, `anon EXECUTE = false`; les droits `authenticated` sont conservés.

