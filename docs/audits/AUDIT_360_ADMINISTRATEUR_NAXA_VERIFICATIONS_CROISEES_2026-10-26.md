# Complément d’audit CTO — clôture des vérifications croisées du 26 octobre 2026

## Périmètre et méthode

Lecture statique de main uniquement : actions serveur Admin, garde partagé, actions de gestion des privilèges des Caisses, page du journal et migrations ciblées. Aucun branchement, déploiement, appel de RPC métier, test d’écriture ni modification Supabase n’a été effectué. Les résultats issus des migrations Git ne prouvent pas que ces définitions sont celles actuellement déployées.

## Résultats consolidés

### 1. Contrôle d’accès Admin

- requireAdminActive exige une session authentifiée, role = 'admin' et actif === true ; toute erreur de lecture entraîne un refus. Il est utilisé par les actions Admin Promoteurs, la validité et le journal.
- L’action de validation du dossier pharmacie passe par ce garde et appelle une RPC transactionnelle unique.
- Écart à traiter dans l’audit global : src/app/admin/pharmacies/[id]/actions.ts possède son propre garde local. Il applique également rôle Admin et actif === true, mais duplique la politique et risque de diverger du garde canonique à l’avenir. Ce n’est pas, à lui seul, une faille d’accès démontrée.

### 2. Suspension/réactivation Caisse

La migration migration_141_promoteur_caisse_management_reconciliation.sql montre une RPC naxa_set_caisse_status avec contrôle de cible Caisse, hiérarchie, périmètre, privilèges SUSPEND_CAISSE/REACTIVATE_CAISSE, architecture et quota avant mise à jour de profiles.actif. La fonction n’accepte pas de motif et ne produit pas elle-même d’événement métier explicite dans le corps consulté. L’existence d’un trigger de journalisation séparé n’a pas été exclue.

### 3. Révocation des privilèges

- L’action applicative retirerPrivilegeCaisse appelle naxa_revoke_privilege après contrôle de session, Promoteur actif, rattachement de la Caisse, visibilité de la pharmacie et autorisation naxa_can.
- Les migrations 134/149 limitent la révocation aux privilèges actifs, délégables et non liés à la gouvernance, vérifient le périmètre hiérarchique et posent active=false avec revoked_at=now().
- Ni l’action ni la signature SQL examinée ne transmettent un motif de révocation ou un identifiant d’incident. L’acteur peut être inféré d’un contexte d’exécution selon la piste d’audit disponible, mais la justification métier n’est pas établie par ces seules écritures.
- La migration 149 déplace la logique dans private et conserve une façade publique SECURITY INVOKER.

### 4. Renouvellement Promoteur et validation de dossier

- L’action de renouvellement Admin exige une échéance au format attendu et un motif d’au moins cinq caractères; elle appelle admin_renouveler_promoteur avec l’identifiant Admin.
- L’action de validation initiale demande la confirmation des autorisations vérifiées et centralise les mutations dans admin_valider_dossier_pharmacie.
- Les sections 52–54 du rapport principal documentent le risque de transitions entre états partiellement actifs et la divergence historique entre renouvellement manuel et reactiver_promoteur. Ces risques restent des constats statiques, non des scénarios reproduits en production.

### 5. Journal d’administration

/admin/journal lit au plus 200 lignes de audit_log et affiche action, entité, identifiant, acteur et metadata. Le code traite l’erreur de lecture et l’état vide séparément. Il n’établit toutefois pas que chaque mutation des différents univers écrit systématiquement dans cette table. L’affichage JSON intégral de metadata crée un risque de divulgation si des producteurs y placent des données personnelles, médicales ou des secrets; aucune exposition effective n’est démontrée par la seule lecture de la page.

### 6. Documents de pharmacie : incohérence de chemin à maintenir en priorité

Le chemin src/app/admin/pharmacies/[id]/actions.ts utilise supabaseAdmin() pour téléverser dans le bucket pharmacie-documents puis écrire dans pharmacie_documents. En cas d’échec de l’insertion, il tente de supprimer l’objet téléversé. Les lectures antérieures du catalogue live ne retrouvaient pas ces noms mais relevaient des objets voisins portant d’autres noms. L’écart Git/environnement doit être confirmé avant toute correction; l’upload et la validation n’ont pas été exécutés.

## Matrice de clôture de cette passe

| Vérification | Résultat de la lecture statique | Preuve runtime |
|---|---|---|
| Garde Admin canonique | Conforme au contrat rôle + actif | Non exécutée |
| Garde local de détail pharmacie | Duplique le garde canonique | Non exécutée |
| Statut Caisse | Autorisations, hiérarchie, architecture et quota présents dans la migration | Définition live non rapprochée |
| Révocation privilège | Garde DB et révocation douce présents dans les migrations | Définition live non rapprochée |
| Motif suspension/révocation | Non transmis par les signatures examinées | Journaux/trigger séparés non exclus |
| Renouvellement Promoteur | Motif requis côté action; RPC appelée | RPC live non confirmée |
| Journal Admin | 200 événements max; métadonnées affichées intégralement | Exhaustivité des événements non prouvée |
| Documents pharmacie | Bucket/table attendus par le code; compensation d’upload prévue | Écart live/Git non résolu |
| Tests, écritures, déploiement | Aucun exécuté | Sans objet |

## Décision et suite

Cette passe croisée est documentée; elle ne vaut pas déclaration de clôture de l’audit 360° complet. Les éléments bloquants pour une clôture probante sont regroupés en quatre vérifications au lieu de traiter les symptômes un par un :

1. Rapprocher les corps live et privilèges des RPC sensibles avec les migrations de main.
2. Établir la couverture réelle des événements audit_log pour les transitions Admin, Promoteur, Caisse et privilèges, et la minimisation de metadata.
3. Résoudre l’écart entre les tables/bucket documents du code et ceux visibles dans le catalogue Supabase, sans appliquer de migration.
4. Achever la matrice des 18 routes Admin et de leurs actions serveur/API : garde, erreurs, effets de bord, journaux, liens et états vides.

Jusqu’à ces contrôles, les conclusions concernent le code et les migrations consultés seulement. Aucune correction fonctionnelle, migration, mutation de données ou opération de déploiement n’est autorisée ou réalisée dans ce complément.


## 7. Revue croisée des routes et actions Admin — résultats supplémentaires

### Contrôles d’accès

- Le layout Admin applique le garde partagé. Les pages Alertes, Examens, Produits, Prestations, Univers, Promoteurs, Journal et les vues principales de pilotage consultées appellent également le garde ou se trouvent sous ce layout.
- La page Validité et la page détail pharmacie réimplémentent localement le contrôle session + rôle Admin + actif vrai. Elles refusent les profils inactifs, mais dupliquent la politique.
- La page Profil est un composant client qui lit et modifie le profil de l’utilisateur connecté via le client Supabase. Le layout parent est le contrôle de route ; l’autorisation effective de la mise à jour dépend aussi des politiques RLS. Cette défense doit rester confirmée dans les policies, sans supposer que le contrôle UI suffit.
- La route API OSM vérifie une session puis appelle is_admin. La vérification de l’état actif dépend donc de la définition réellement déployée de is_admin ; cette route ne contrôle pas directement profiles.actif dans son propre code.

### Journalisation des mutations

- Dans src/app/admin/univers/actions.ts, plusieurs changements de statut, d’activation d’univers, d’association partenaire/univers et de compte de test insèrent un événement audit_log après la mutation.
- Les erreurs de ces insertions audit_log ne sont pas contrôlées avant le message de succès. Une mutation peut donc être annoncée comme réussie même si l’écriture d’audit a échoué. Le code ne prouve pas qu’un trigger séparé assure une couverture équivalente. C’est une lacune de fiabilité de traçabilité à vérifier/corriger après autorisation.
- Les actions de statut Centre/Service/Pack d’examens modifient les états dans leurs actions serveur, mais aucune insertion audit_log explicite n’apparaît dans ces fonctions examinées. Cela n’exclut pas un trigger DB ; il faut le confirmer avant de conclure à une absence totale de journalisation.
- Les actions Produits mettent à jour le statut et les champs de fiche ; la page d’action examinée ne montre pas d’écriture audit_log explicite. Là encore, vérifier les triggers et les journaux effectifs.
- Les actions Prestations appellent une RPC, puis vérifient l’état persisté avant de signaler le succès. C’est un bon contrôle de cohérence de l’état, mais l’écriture d’un événement d’audit doit être vérifiée dans la RPC ou un trigger.
- La création de dossier univers et la création de pharmacie ont une compensation applicative et des logs serveur pour certaines erreurs. Ces logs techniques sont utiles au diagnostic mais ne remplacent pas nécessairement un journal métier consultable par l’Administrateur.

### Données sensibles dans les journaux

La page Univers lit les métadonnées des 20 événements récents; la page Journal Admin expose les métadonnées des 200 événements. Les actions d’Univers y insèrent actuellement des objets restreints dans le code consulté (par exemple statut ou activation), mais l’interface affiche le JSON complet et la table est transversale. Une politique de minimisation au niveau producteur et lecteur est préférable à l’hypothèse que toutes les métadonnées futures seront inoffensives.

### Rapports et erreurs de données

- Les pages Alertes, Examens, Produits et Prestations distinguent au moins certains états d’erreur de chargement.
- Le tableau de bord Admin affiche des indicateurs partiels en cas d’erreur de certaines sources et précise que l’absence d’horodatage n’est pas une preuve de rupture de stock.
- Le layout calcule des compteurs d’alertes et signale des compteurs partiels si une source échoue.
- La page Validité calcule ses compteurs à partir de data || [] sans afficher explicitement une erreur de lecture RPC dans l’extrait examiné. Une panne peut donc ressembler à une liste vide et à des compteurs nuls. À vérifier sur la page complète avant correction.
- La page Univers regroupe les erreurs de plusieurs lectures, mais les actions de mutation doivent aussi contrôler les erreurs d’audit indépendamment de la mutation principale.

## 8. Priorités consolidées — sans correction fonctionnelle

| Priorité | Point | Justification | Action future nécessaire |
|---|---|---|---|
| P1 | Définition live de is_admin et RPC sensibles | Une garde de route et une autorisation SQL doivent être cohérentes | Lecture seule des définitions et ACL live |
| P1 | Exhaustivité du journal d’audit | Des actions réussies peuvent ne pas avoir d’événement confirmé | Vérifier triggers/RPC, puis rendre l’audit transactionnel ou vérifier explicitement son résultat |
| P1 | Écart tables/bucket documents | Le code dépend de noms non confirmés dans le catalogue précédent | Rapprocher migrations, catalogue et stockage sans appliquer de DDL |
| P2 | Motif de suspension/révocation | Les signatures examinées ne portent pas de justification métier | Décider du contrat d’audit attendu avant toute modification |
| P2 | Erreurs sur la page Validité | Une réponse sans data peut être confondue avec zéro dossier | Contrôler et afficher l’erreur sans masquer les états inconnus |
| P2 | Défense RLS du Profil | Le composant client n’est pas une frontière d’autorisation | Confirmer les policies UPDATE/SELECT de profiles |
| P3 | Garde Admin dupliqué | Risque de divergence de politique entre actions | Centraliser seulement après décision et tests ciblés |

## 9. État de progression

Cette lecture statique supplémentaire couvre les actions clés d’Univers, Produits, Prestations et Examens, les vues principales du tableau de bord, Alertes, Validité, Journal, Profil, les dossiers Promoteurs/pharmacies et la route API OSM. Elle n’équivaut pas encore à une validation exhaustive de toutes les 18 pages, des politiques RLS et de tous les corps SQL live. Les accès au catalogue Supabase qui avaient échoué ne sont pas requalifiés en preuves d’absence.

Aucune correction fonctionnelle, mutation de données, migration ou opération de déploiement n’a été réalisée. Le prochain lot doit fermer ensemble les quatre contrôles prioritaires, puis statuer sur les corrections à autoriser, sans bloquer l’audit sur une vérification runtime indisponible.


## 10. Vérification du catalogue Supabase en lecture seule — RPC, droits et RLS

**Périmètre réellement interrogé :** définitions de fonctions et privilèges effectifs du catalogue PostgreSQL, puis politiques RLS actuellement présentes sur `profiles` et `audit_log`. Ces résultats décrivent la base interrogée au moment de la vérification ; ils ne prouvent pas le comportement de chaque écran dans un navigateur.

### 10.1 Fonctions sensibles confirmées dans le catalogue

- `private.is_admin()` est `SECURITY DEFINER`, avec `search_path` vide, et vérifie explicitement `auth.uid()`, `role='admin'` et `actif=true`. Le wrapper `public.is_admin()` appelle cette fonction privée.
- Les fonctions privées `naxa_set_caisse_status` et `naxa_revoke_privilege` sont `SECURITY DEFINER` avec `search_path` vide. Les façades publiques sont des fonctions SQL `SECURITY INVOKER`; l'autorisation métier est vérifiée dans la fonction privée.
- `admin_valider_dossier_pharmacie` est bien présent dans le catalogue interrogé. La définition lue verrouille les lignes concernées, vérifie le rattachement Promoteur/pharmacie, l'unicité convention/abonnement, la cohérence d'architecture et la vérification explicite des autorisations. La validation s'exécute dans une fonction transactionnelle : une erreur annule les écritures. La visibilité publique est activée à la fin, après provisionnement des privilèges. Cela corrige l'incertitude précédente sur une éventuelle publication intermédiaire ; aucun scénario de concurrence n'a été exécuté.
- `admin_set_home_service_offer_status` vérifie l'administrateur via `public.is_admin()`, limite les statuts acceptés, contrôle l'activation du partenaire et de l'univers, puis écrit dans `audit_log` dans la même fonction.
- La fonction de renouvellement présente dans le catalogue est `public.reactiver_promoteur(uuid,text)`. Elle est `SECURITY DEFINER`, vérifie `public.is_admin()`, met à jour la date de paiement, prolonge la convention jusqu'à la fin du mois courant et insère un enregistrement de paiement avec référence éventuellement vide. **Cet acte administratif peut donc produire une trace de paiement sans référence ; il ne prouve pas à lui seul qu'un paiement a été encaissé.** Elle réactive aussi des profils liés selon les relations de pharmacie. La portée exacte de cette réactivation doit rester une priorité de revue métier.
- `public.admin_renouveler_promoteur(uuid,date,text,uuid)` et la table `admin_pharmacie_audit` n'ont pas été retournées par cette interrogation ciblée, alors que leur migration existe dans le dépôt. Ce constat établit une différence entre source Git et catalogue interrogé, pas sa cause : migration non appliquée, autre environnement ou dérive restent possibles.

### 10.2 Droits effectifs observés

Pour les fonctions ciblées, les wrappers publics de révocation et de statut Caisse sont exécutables par `authenticated`, pas par `anon`. Les fonctions privées correspondantes sont également exécutables par `authenticated`, mais elles contrôlent l'acteur et son périmètre dans leur corps. Le wrapper `public.is_admin()` a un droit EXECUTE accordé à `anon`, mais il ne retourne le statut d'administrateur actif que par l'intermédiaire de `private.is_admin()` et de `auth.uid()`. Ce droit seul ne donne donc pas le pouvoir d'administration. À conserver comme surface d'exposition à surveiller, sans le qualifier de contournement démontré.

### 10.3 Politiques RLS — constat important sur l'inactivation

Les politiques actuellement lues pour `audit_log` (`audit_log_admin_read` et `audit_log_admin_insert`) testent `profiles.role='admin'`, mais ne testent pas explicitement `profiles.actif=true`. En conséquence, **la politique RLS seule ne révoque pas l'accès au journal d'un compte qui reste rôle admin mais devient inactif**. Le comportement réel dépend aussi des gardes applicatives et de l'éventuelle révocation de session ; aucune session d'un administrateur inactif n'a été testée. Recommandation prioritaire : aligner les politiques RLS du journal sur le prédicat administrateur actif ou documenter et tester un contrôle équivalent obligatoire côté base.

Pour `profiles`, la politique SELECT autorise la lecture de son profil, des enfants hiérarchiques ou par l'administrateur privé. La politique UPDATE permet l'administrateur privé ou le parent Promoteur sous conditions sur la cible (rôle Caisse et pharmacie). L'INSERT/DELETE admin utilise également `private.is_admin()`. L'évaluation complète exige toutefois de lire toutes les politiques applicables et les éventuelles fonctions/triggers complémentaires ; cette passe ne certifie pas l'ensemble des opérations de chaque rôle.

### 10.4 Écran Validité Promoteurs

La page `src/app/admin/pilotage/validite/page.tsx` affiche bien le message de l'erreur retournée par `validites_promoteurs_admin`, mais construit malgré tout les indicateurs et la liste à partir de `data || []`. En cas d'échec RPC, un écran d'erreur peut donc être accompagné d'indicateurs à zéro ou d'une liste vide, ambiguïté de lecture pour l'opérateur. Il faut distinguer explicitement « données indisponibles » de « aucun promoteur à suivre ». Le garde local vérifie le rôle et l'activité, mais la page ne centralise pas ici la garde partagée.

### 10.5 Documents de pharmacie — historique automatique et réserve

La migration présente dans Git crée le bucket privé `pharmacie-documents`, limite les types MIME et la taille à 10 Mio, restreint les opérations Storage aux administrateurs via `public.is_admin()`, et crée un trigger qui inscrit automatiquement les changements de document dans `pharmacie_document_historique`. La table d'historique n'accorde aux utilisateurs authentifiés que SELECT ; l'écriture vient du trigger `SECURITY DEFINER`. Le catalogue de la base interrogée n'a pas confirmé la présence de ces objets dans cette passe ciblée : leur fonctionnement en environnement actif reste **à confirmer** avant de déclarer le parcours documentaire opérationnel.

### 10.6 Décisions de priorité mises à jour

1. **P1 — accès au journal :** RLS de `audit_log` basée sur le rôle sans vérification explicite d'activité ; vérifier le parcours de révocation et tester un compte inactif.
2. **P1 — renouvellement Promoteur :** distinguer renouvellement administratif, date de paiement et preuve de règlement ; auditer la portée des réactivations de profils/pharmacies et les références de paiement vides.
3. **P1 — divergence migration/catalogue :** établir l'environnement Supabase cible et la correspondance des migrations/objets de documents et de renouvellement manuel, sans supposer que l'absence dans cette interrogation prouve une migration non appliquée.
4. **P2 — qualité opérateur :** afficher un état indisponible dédié sur Validité Promoteurs lorsque le RPC échoue, au lieu de présenter simultanément des compteurs calculés sur un tableau vide.
5. **P2 — audit des mutations :** poursuivre la couverture des actions qui écrivent directement dans `audit_log` sans contrôler l'erreur d'insertion, et confirmer les triggers existants.

**Limites de cette passe :** lecture statique du dépôt et interrogations SQL en lecture seule ; pas de modification fonctionnelle, pas de migration appliquée, pas de test de session réel, pas de test navigateur, pas de build ni de déploiement.


## 11. Inventaire des routes et actions Admin — deuxième passe groupée

### 11.1 Périmètre effectivement inventorié

L'arbre Git de `main` contient **28 fichiers d'écran/action** sous `src/app/admin/` correspondant aux motifs `page.tsx` / `actions.ts` consultés, et **2 routes API Admin** sous `src/app/api/admin/`. Ce décompte est limité à ces types de fichiers ; il ne représente pas le nombre total de routes Next.js, car les layouts, composants, autres route handlers et pages non inclus par ce filtre ne sont pas comptés comme des entrées distinctes.

Pages/actions revues dans cette passe : alertes, configuration, géolocalisation, messagerie, pilotage, rapports, promoteurs, dossiers partenaires, rappels de lots, fiche pharmacie et ses actions, création d'univers et création de pharmacie. Les autres fichiers de l'inventaire sont conservés dans le périmètre de l'audit, mais ne sont pas déclarés individuellement validés par cette passe.

### 11.2 Contrôles d'accès et gestion d'erreurs

- Les pages Alertes, Messagerie, Pilotage, Promoteurs, Dossiers partenaires, Journal et les actions de création consultées appellent le garde partagé `requireAdminActive`.
- La route API `/api/admin/messagerie` vérifie la session, le rôle admin et l'activité avant de lire le ticket ou d'écrire un message ; elle refuse les tickets absents/inaccessibles et les tickets fermés, puis contrôle l'erreur d'insertion avant de retourner succès.
- La route OSM appelle `is_admin()` avant toute opération privilégiée. La définition actuellement observée dans le catalogue contrôle aussi l'activité du compte administrateur. Les erreurs de lecture d'état sont remontées par l'interface.
- La page Alertes signale les sources d'alerte indisponibles. La page détail pharmacie affiche un avertissement si certaines données liées échouent, au lieu de les présenter toutes comme absentes.
- Le garde local de la fiche pharmacie répète le contrôle rôle + actif au lieu de réutiliser le garde partagé : duplication à réduire pour éviter une divergence future, mais aucune faille exploitable n'est démontrée par cette seule duplication.

### 11.3 Nouveaux risques ou réserves confirmés dans le code

**P1 — synchronisation OSM, persistance de l'état de synchronisation.** Dans `src/app/api/admin/geolocalisation-osm/route.ts`, l'erreur de mise à jour du registre `pharmacies_geo_osm_sync` à la fin du parcours de succès (vers la ligne 170) n'est pas contrôlée avant de retourner le résultat. Le chemin de gestion d'erreur tente lui aussi d'écrire le statut d'échec sans vérifier le résultat de cette écriture. Il est donc possible que l'interface annonce une synchronisation terminée alors que l'état de suivi n'a pas été enregistré ; l'impact sur les coordonnées déjà écrites dépend du point d'échec. Aucun scénario n'a été exécuté.

**P1 — fiche pharmacie, deux registres documentaires.** La page lit à la fois `pharmacie_documents` / `pharmacie_document_historique` et `pharmacie_documents_recus` / `pharmacie_donnees_historique`. Ce peut être intentionnel (documents téléchargés vs pièces déclaratives), mais la page et les actions utilisent deux modèles distincts. Il faut expliciter la différence métier et l'état attendu de chaque source ; en cas de dérive de migration, l'écran peut présenter un dossier partiellement renseigné. La page affiche un avertissement pour certaines lectures liées, mais la lecture initiale de `documents` n'expose pas explicitement son erreur dans le tableau des erreurs affichées.

**P2 — création pharmacie et création dossier d'univers.** Les deux parcours sont multi-écritures avec compensations en cas d'échec, non une transaction unique visible côté application. Les échecs de compensation sont consignés dans les logs serveur, ce qui est préférable au silence, mais ne garantit pas le nettoyage complet. Prévoir une file de réconciliation/état d'échec réconciliable et une clé d'idempotence serait plus robuste pour les dossiers partiellement créés. Aucun dossier orphelin réel n'a été recherché dans les données.

**P2 — journal d'audit.** La page affiche le contenu brut de `metadata` sous forme JSON. Cela permet l'inspection mais rend le contenu dépendant de la discipline des producteurs : éviter d'y écrire secrets, jetons, pièces d'identité complètes ou données personnelles inutiles. Le risque est préventif ; aucun secret exposé n'a été identifié par cette lecture.

**P2 — rappels de lots.** Le fichier `src/app/admin/rappels-lots/page.tsx` est un wrapper de six lignes. Cette inspection ne suffit pas à valider le chargement, les permissions ou les calculs de péremption du composant qu'il délègue ; la validation métier de cet écran reste ouverte.

### 11.4 État consolidé après cette passe

- Inventaire du dépôt obtenu sans troncature : 1 248 chemins ; 28 fichiers Admin page/actions correspondant au filtre et 2 routes API Admin.
- Plusieurs parcours et routes ont été lus statiquement, mais **il ne faut pas interpréter cet inventaire comme 100 % des routes fonctionnellement testées**.
- Priorités à garder en tête : RLS du journal pour compte admin inactif ; sémantique renouvellement/paiement ; correspondance migrations/catalogue des documents ; contrôle des erreurs de synchronisation OSM ; cohérence des deux registres documentaires ; réconciliation des créations multi-étapes.

**Limites :** lecture Git et catalogue SQL uniquement. Pas de test navigateur, pas de requête destructive, pas d'exécution des actions métier, pas de build, pas de migration appliquée et pas de déploiement.


## 12. Passe consolidée finale — routes restantes, politiques RLS et audit SQL

### 12.1 Routes Admin restantes : protections et retours d'erreur

Lecture statique complémentaire des actions/pages Examens, Prestations, Produits, Univers, Promoteurs et du tableau de bord :

- **Examens — cohérence correcte à confirmer en test :** les trois actions passent par `requireAdminActive`, valident l'UUID et la liste des statuts avant d'appeler les RPC. Les erreurs RPC conduisent à un retour explicite. La page signale un catalogue indisponible et précise qu'aucune action n'a été faite. Cela ne prouve pas que les RPC et migrations sont présents dans tous les environnements.
- **Prestations — garde-fous explicites :** la page et l'action utilisent `requireAdminActive`; l'action contrôle l'erreur RPC et le statut relu après mutation. La page différencie le catalogue indisponible. La validation réelle des justificatifs du professionnel reste une vérification humaine distincte.
- **Produits — risque de succès trompeur (P1/P2 à confirmer) :** l'action de mise à jour de la fiche vérifie et affiche l'erreur d'écriture, mais la génération de brouillon IA appelle ensuite `update` sans contrôler le résultat Supabase avant de rediriger avec `ok=ia`. Le message de succès peut donc être affiché alors que l'enregistrement du brouillon a échoué. Aucun échec n'a été reproduit.
- **Univers — audit secondaire non bloquant (P2) :** après la mise à jour d'un partenaire, l'action insère une entrée dans `audit_log` mais n'examine pas le résultat de cet insert dans le code lu. Une mutation peut donc réussir sans que cette trace applicative soit confirmée. Vérifier si un autre mécanisme DB couvre ce cas avant correction.
- **Promoteurs / pièces reçues :** la validation passe par la RPC `admin_valider_dossier_pharmacie`; les pièces reçues utilisent `pharmacie_documents_recus`. Les erreurs de validation sont traduites en retours explicites. Ce parcours ne résout pas l'écart de catalogue signalé plus haut pour `pharmacie_documents` et son historique.
- **Tableau de bord Admin :** la page affiche explicitement des indicateurs partiels si les pharmacies, validités ou le journal sont indisponibles ; elle évite donc de présenter ces totaux comme complets. Les métriques restent des indicateurs de suivi, pas une preuve de disponibilité réelle des stocks.

### 12.2 Contrôle RLS et déclencheurs en lecture seule

Le catalogue SQL courant confirme RLS activé sur les tables examinées : `profiles`, `audit_log`, `abonnements`, `abonnements_promoteurs`, `abonnement_paiements`, `abonnement_promoteur_paiements`, `conventions_promoteurs`, `promoteur_pharmacies`, `pharmacie_documents_recus`, `naxa_custom_roles`, `naxa_custom_role_privileges`, `naxa_profile_privileges` et les tables d'audit de caisse. Cela ne signifie pas que chaque politique est parfaite ; les expressions et rôles doivent être examinés table par table.

- **Point P1 maintenu — `audit_log` :** les politiques de lecture/insertion examinées testent `profiles.role = 'admin'` sans exiger explicitement `profiles.actif = true`. Le prédicat central `private.is_admin()` vérifie au contraire le rôle et l'activité. La divergence peut laisser un compte portant encore le rôle admin mais désactivé accéder au journal directement par RLS. Vérifier les autres couches et aligner les politiques avec le prédicat admin actif.
- **Table d'en-tête de chaîne d'audit de caisse :** `caisse_audit_chain_heads` a RLS activé mais aucune politique n'est exposée dans le catalogue interrogé. L'accès direct des rôles applicatifs devrait donc être refusé par défaut ; confirmer que les écritures/lectures nécessaires passent uniquement par des fonctions privilégiées prévues, et que le fonctionnement n'en dépend pas côté client.
- **Privilèges :** les catalogues de rôles et privilèges possèdent des politiques de lecture, dont certaines exposent les référentiels à tout utilisateur authentifié. Les affectations personnalisées ont une politique de lecture limitée au profil lui-même, à l'admin ou au gestionnaire autorisé. La lecture seule ne permet pas de conclure sur chaque voie d'écriture ni sur les privilèges effectifs de toutes les RPC.
- **Déclencheurs :** le catalogue courant montre des déclencheurs actifs de capture d'historique sur de nombreuses tables métier, notamment profils, relations promoteur-pharmacie, conventions, abonnements et affectations de privilèges ; il montre aussi des garde-fous de cohérence sur l'activation des caisses et abonnements. Cette présence ne prouve pas à elle seule la complétude, l'immutabilité ni l'absence de contournement de chaque journal.
- **Documents :** `pharmacie_documents_recus` est présent avec quatre politiques admin dans le catalogue courant. En revanche, la requête ciblée n'a pas retourné `pharmacie_documents` ni les tables d'historique évoquées par la migration versionnée dans Git. Il s'agit d'un **écart dépôt/catalogue à résoudre**, pas d'une preuve suffisante que la migration n'a jamais été appliquée : environnement, schéma ou dérive restent possibles.

### 12.3 Décision de clôture de cette passe

**Passe de vérifications statiques et SQL en lecture seule terminée pour le périmètre consultable dans cette session.** Le rapport distingue les faits observés, les risques à confirmer et les limites. Cela ne constitue pas une certification fonctionnelle de tout le parcours Administrateur.

Priorités avant de déclarer le chantier Admin complètement clos :
1. Aligner les politiques RLS de `audit_log` avec le contrôle admin actif et vérifier les voies d'accès au journal.
2. Réconcilier le catalogue réel avec les migrations des documents et historiques.
3. Corriger/valider le retour de succès du brouillon IA et la confirmation d'écriture de l'audit Univers.
4. Revoir la sémantique de renouvellement et la preuve de paiement déjà signalées en section 10.
5. Tester, avec comptes de rôles autorisés et refusés, les parcours critiques en environnement de test : validation dossier, activation/suspension partenaire, publication examens/prestations, renouvellement, révocation de privilèges et lecture du journal.
6. Exécuter les tests automatisés ciblés et les contrôles de build dans une passe autorisée ; ils ne sont pas exécutés ni revendiqués ici.

**Limites confirmées :** aucun changement de logique métier, SQL, configuration ou données ; aucune migration appliquée ; aucun test navigateur ou scénario métier exécuté ; aucun build revendiqué ; aucun déploiement. Le rapport documentaire seul est modifié sur `main`.


## 13. Corrections ciblées préparées sur `main` après la passe consolidée

Corrections de code appliquées dans ce commit :

1. **Brouillon IA des produits :** l'échec de la requête Supabase d'enregistrement est maintenant vérifié séparément de la génération IA. L'interface ne doit plus annoncer un brouillon enregistré si l'UPDATE a renvoyé une erreur.
2. **Journalisation des actions Univers :** les neuf insertions applicatives vers `audit_log` vérifient maintenant l'erreur retournée et affichent une erreur dédiée au lieu de poursuivre silencieusement comme si la trace était confirmée. Une défaillance de journalisation après mutation peut toujours laisser une opération métier déjà effectuée ; une transaction SQL atomique reste la solution robuste à examiner.
3. **Validité des Promoteurs :** la page utilise désormais le garde partagé `requireAdminActive`. Si la RPC de validité échoue, elle n'utilise plus une liste vide pour calculer des compteurs apparemment réels ; l'écran indique explicitement que les données et les indicateurs sont indisponibles. Le champ d'échéance ne propose plus la date du jour alors que la validation serveur exige une date future.
4. **Synchronisation OSM :** la route vérifie maintenant l'écriture de l'état final. Elle ne renvoie plus un succès complet si la synchronisation a traité les données mais que l'enregistrement de son statut échoue ; l'échec de persistance du statut d'erreur est également signalé.

Une migration additive a été ajoutée dans le dépôt pour remplacer les politiques `audit_log_admin_read` et `audit_log_admin_insert` par le prédicat `public.is_admin()`, qui dans le catalogue contrôlé exige un rôle admin et un compte actif. **Cette migration est uniquement versionnée dans Git : elle n'a pas été appliquée à Supabase.** Le résultat effectif en base reste donc à confirmer après procédure autorisée.

### Éléments encore non corrigés faute de preuve suffisante ou de modification de base autorisée

- Écart entre migrations du dépôt et catalogue live pour `pharmacie_documents`, son historique et `admin_pharmacie_audit` / `admin_renouveler_promoteur`. Il faut rapprocher les versions et contenus de migration avant de choisir une réparation, plutôt que créer des objets potentiellement dupliqués.
- Les risques de transition sur `admin_valider_dossier_pharmacie` et `reactiver_promoteur` sont documentés mais ne sont pas réécrits sans contrat métier validé et tests SQL de non-régression : une modification hasardeuse pourrait réactiver une suspension légitime ou confondre renouvellement et preuve de paiement.
- Les politiques RLS sans politique identifiées dans le premier inventaire doivent être qualifiées table par table (refus par défaut vs voie d'accès attendue) ; aucune politique ne doit être ajoutée par supposition.
- Le rapport préliminaire signalait aussi le rapprochement des migrations, les buckets publics et les fonctions privilégiées. Ces points nécessitent une vérification dédiée avant de déclarer la sécurité globale close.

### Validation réellement effectuée

Vérification statique des substitutions et des contenus avant création du commit uniquement. Aucun build, lint, test automatisé, scénario navigateur ou appel de RPC métier n'est revendiqué. Aucune écriture de données, aucune migration Supabase appliquée, aucun déploiement lancé.


## 14. Migration RLS du journal appliquée et vérification post-application — 2026-10-26

### Résultat vérifié
- La migration a été appliquée au projet Supabase **Naxa** (eouwtuusnsuxaejsxknf) ; l'outil de migration a retourné success: true.
- La relecture immédiate du catalogue pg_policies confirme que audit_log_admin_read utilise désormais is_admin() comme USING, et que audit_log_admin_insert utilise is_admin() comme WITH CHECK. Les deux politiques ciblent le rôle authenticated.
- L'historique Supabase a enregistré la migration sous la version **20261026211221**, nom **admin_audit_log_active_admin_rls_20261026220000**. Le fichier de migration a ensuite été renommé sur main pour utiliser ce préfixe exact : supabase/migrations/20261026211221_admin_audit_log_active_admin_rls_20261026220000.sql. L'ancien fichier au préfixe 20261026220000 a été supprimé afin d'éviter qu'une seconde migration soit détectée comme en attente. Ne pas réappliquer manuellement cette migration.
- Le contrôle Security Advisor post-application conserve des alertes indépendantes : 5 tables RLS sans politique et des fonctions SECURITY DEFINER exécutables par anon ou authenticated. Ces alertes ne sont pas automatiquement des vulnérabilités exploitables : chaque fonction doit être évaluée selon sa finalité, ses contrôles internes et ses privilèges. Aucune révocation globale ne doit être faite sans analyse des contrats RPC.

### Limites restantes
- La vérification confirme les définitions de politiques, pas un test de connexion réel avec un compte Admin inactif. Aucun changement de données métier n'a été exécuté.
- La migration ne règle pas à elle seule la cohérence atomique entre une mutation métier et son entrée de journal. Les actions Univers vérifient maintenant l'erreur d'insertion mais peuvent déjà avoir effectué la mutation lorsque le journal échoue.
- Le renouvellement Promoteur, la preuve de paiement, la divergence des modèles documentaires, l'inventaire des fonctions privilégiées et la couverture des tests de rôle restent à résoudre ou à qualifier. Ils ne sont pas déclarés clos par cette migration.

### Statut de cette passe
La correction RLS du journal est **appliquée et vérifiée dans le catalogue Supabase**. La clôture complète du chantier Administrateur n'est pas encore justifiée tant que les contrôles ci-dessus et les validations automatisées n'ont pas été menés. Aucun déploiement applicatif n'a été lancé.


## 15. Écart bloquant du registre de fichiers documentaires — correction de l'écran et décision de base

### Fait établi
- Le catalogue Supabase du projet Naxa liste la table pharmacie_documents_recus, mais ne liste ni pharmacie_documents ni pharmacie_document_historique. L'historique de migrations live ne contient pas la migration Git 20261022150000_pharmacie_documents_fichiers_validation_historique.sql.
- L'écran src/app/admin/pharmacies/[id]/page.tsx et ses actions de serveur dépendent pourtant de ces deux tables ainsi que du bucket privé pharmacie-documents. Avant correction, l'échec de lecture du registre des fichiers était ignoré et l'écran pouvait afficher un compteur zéro / « aucun fichier » à tort.

### Correction de code appliquée sur main
- La page récupère désormais explicitement l'erreur de lecture de pharmacie_documents et affiche un avertissement « registre documentaire indisponible » au lieu d'affirmer que le dossier est vide.
- Le compteur du dossier indique « Indisponible » et le formulaire de dépôt est masqué lorsque la table ne peut pas être lue ; le panneau d'historique documentaire signale lui aussi l'indisponibilité. Cela empêche de présenter une panne de schéma comme une absence de pièces.
- Cette correction est une protection d'interface et non le rétablissement du service documentaire.

### Point restant pour la clôture réelle
La migration documentaire n'a pas été appliquée à Supabase dans cette passe : l'autorisation d'application reçue portait sur la migration du journal Admin. Le dépôt contient le SQL de cette migration, mais l'application du parcours de dépôt de fichiers demeure bloquée tant que le schéma/bucket n'est pas réconcilié et installé de manière autorisée. Ne pas déclarer le dépôt, la consultation ou la validation des fichiers opérationnels avant cette étape et un test de bout en bout.

### Validation
La présence/absence des tables a été contrôlée via l'inventaire du schéma ; la correction a été écrite sur main. Aucun fichier n'a été déposé, aucun document métier modifié, aucune migration documentaire appliquée, aucun test navigateur/build/lint lancé, aucun déploiement lancé.


## 16. Statut CI avant clôture — vérification des commits précédents

Le statut GitHub rapporte toujours le contrôle CircleCI « ci/circleci: quality » en échec. Ce résultat est également présent sur les commits antérieurs aux dernières corrections (fb59e0b0715ac3c1dd8981175941c0c6127e7af1 et e2b0492f69b864d273e442ec3cfcf649a6ff6d4f), puis sur le commit de correction de la page documentaire (41f5ff8234006a09917ba7f0fe9ddafc1779667e) et le commit documentaire (aa60abcda9a8fae3f7dd8fdaab8ceae89756a231). Il ne s'agit donc pas d'une régression démontrée par la seule dernière modification, mais le contrôle n'est pas vert.

Le lien CircleCI de ce dépôt n'est pas accessible via les intégrations disponibles dans cette session ; le statut ne révèle pas l'étape fautive (TypeScript, tests ciblés, ESLint ou build). Sans le journal du job, il serait incorrect d'inventer la cause ou de déclarer le contrôle corrigé. Les tests automatisés, le lint, TypeScript et le build ne sont pas revendiqués comme exécutés avec succès.

**Critère de clôture non satisfait :** la migration RLS du journal est appliquée et vérifiée, mais le chantier Administrateur ne peut pas être certifié complètement clos tant que le parcours de fichiers documentaires n'est pas rétabli par une migration autorisée, le renouvellement/paiement n'est pas validé, et le job CircleCI quality n'est pas diagnostiqué puis passé.
