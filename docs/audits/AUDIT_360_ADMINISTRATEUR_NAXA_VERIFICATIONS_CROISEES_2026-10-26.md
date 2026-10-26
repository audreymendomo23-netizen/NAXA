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
