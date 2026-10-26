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
