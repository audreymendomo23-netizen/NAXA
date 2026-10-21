# NAXA — Cahier des charges du compte Comptable

**Version consolidée : 1.0 — 21 octobre 2026**  
**Périmètre :** poste de travail Comptable (CPT) de l’ERP NAXA.  
**Dépôt de référence :** `audreymendomo23-netizen/NAXA`, branche `main`.  
**Références métier prioritaires :** `docs/CAHIER_DES_CHARGES.md` v3.7, en particulier §§ 2bis, 4.2–4.3, 7A, 13 et 14.4, ainsi que les fonctionnalités F26, F28–F32, F39–F42, F60, F63–F66 et F70–F75 selon les fiches qui concernent le Comptable.

> Ce document consolide le parcours Comptable à partir des exigences NAXA existantes. Il ne remplace pas le cahier v3.7, ne change pas les rôles hiérarchiques, et ne constitue pas une preuve que les écrans ou tests sont déjà implémentés. Les exigences marquées « à confirmer » ne doivent pas être transformées en règles comptables ou fiscales camerounaises sans validation.

## 1. Objectif du poste

Le compte Comptable permet de consulter, contrôler, rapprocher, préparer et exporter les informations financières autorisées d’une pharmacie : ventes, TVA enregistrée par le système, clôtures de caisse, créances, bordereaux d’assureurs, rejets, dépenses et mouvements de trésorerie, documents justificatifs autorisés, fournisseurs et commandes en lecture, reçus d’abonnement NAXA et journal d’audit en lecture.

Le Comptable est un **poste de consultation, de rapprochement et d’export**, pas un poste d’encaissement ni d’approbation finale. Les écritures opérationnelles restent produites par les parcours métier autorisés. Les actions de soumission ou de suivi d’un bordereau ne donnent pas au Comptable le pouvoir de modifier une vente source, d’annuler un encaissement ou de valider sa propre exception.

## 2. Principes non négociables

1. **Moindre privilège et séparation des tâches.** Le Comptable ne vend pas, n’encaisse pas, ne clôture pas une caisse et ne modifie pas les ventes sources.
2. **Aucune donnée de santé nominative.** Aucune ordonnance, image d’ordonnance, historique patient, donnée clinique nominative ou accès au coffre d’ordonnances. Les exports doivent appliquer la même exclusion que les écrans.
3. **Périmètre limité.** Le compte est rattaché à une seule pharmacie, sauf décision d’architecture et autorisation explicite documentée. Aucune consultation d’une pharmacie hors périmètre.
4. **Lecture seule par défaut.** Les fiches assureurs, fournisseurs, commandes, clôtures, journal d’audit, reçus d’abonnement et paramètres sont consultés sans modification.
5. **Actions métier encadrées.** La préparation/soumission des bordereaux, le suivi des créances, la création d’une tâche de correction et les exports sont les actions principales. Elles ne doivent pas altérer les ventes d’origine.
6. **Traçabilité.** Toute génération ou export de données, création/soumission de bordereau, relance, création de tâche et consultation du journal d’audit est journalisée avec l’utilisateur, l’heure, le périmètre, l’action, le résultat et, lorsque pertinent, le motif.
7. **Source unique.** Les données affichées proviennent des enregistrements NAXA existants ; aucune valeur de vente, taxe, marge, paiement ou créance ne doit être inventée côté interface.
8. **Aucune écriture Supabase Production ni déploiement ne découle de ce cahier des charges.** Les migrations et modules de code restent soumis aux contrôles et autorisations distincts.

## 3. Navigation principale

La navigation doit être cohérente avec les postes ERP NAXA, utilisable sur ordinateur, tablette et téléphone, et chaque entrée doit ouvrir un écran fonctionnel connecté aux données et droits réels.

1. **Tableau de bord**
2. **Journal des ventes**
3. **Créances & bordereaux**
4. **Rejets & relances**
5. **Trésorerie & rapprochements**
6. **Rapports & exports**
7. **Documents**
8. **Journal d’audit**
9. **Profil**
10. **Déconnexion**

Les sous-écrans « Clôtures de caisse », « Assureurs », « Fournisseurs & commandes en lecture », « Reçus d’abonnement NAXA », « Rappels de lots », « Tâches » et « Historique des exports » sont accessibles depuis les entrées pertinentes. La navigation peut être regroupée visuellement sur mobile, mais aucun écran prévu ne doit devenir un lien mort. La déconnexion doit terminer la session Supabase et ramener vers l’écran d’authentification.

## 4. Parcours détaillé par écran

### 4.1 Tableau de bord Comptable — F00-CPT

**But :** fournir une vue de travail du mois sans présenter de chiffres fictifs.

Cartes et listes :
- ventes de la période et total de TVA telle qu’enregistrée ;
- créances en cours, regroupées par assureur et statut ;
- bordereaux à préparer, en attente de validation, déposés, payés ou rejetés ;
- rejets à traiter et créances anciennes à relancer ;
- dernières clôtures de caisse à rapprocher ;
- mouvements de trésorerie et dépenses en attente de rapprochement ;
- exports récents et reçus d’abonnement NAXA disponibles ;
- alertes de données manquantes ou d’écarts à investiguer.

Chaque carte ouvre la liste filtrée correspondante. Les montants doivent être calculés depuis les données accessibles, avec période, devise FCFA et date/heure de dernière actualisation. En cas de donnée indisponible, afficher un état explicite plutôt que zéro trompeur.

### 4.2 Journal des ventes, TVA et exports — F60-CPT

Filtres :
- période/date de début et de fin ;
- caisse ;
- mode de paiement ;
- assureur et statut de prise en charge ;
- référence du ticket/vente ;
- statut de rapprochement.

Tableau minimal :
- date/heure, référence du ticket, caisse, montant, remise, TVA enregistrée, mode de paiement, assureur/statut le cas échéant, statut de rapprochement ;
- marges/bénéfices uniquement si les droits et les données autorisent cette lecture dans le cahier v3.7 ;
- aucune identité ni donnée médicale nominative du client.

Actions :
- consulter le détail financier autorisé d’une vente ;
- exporter les résultats filtrés en PDF ou Excel ;
- ouvrir la clôture correspondante en lecture ;
- marquer un rapprochement comme contrôlé seulement si le modèle métier le permet et si cette action est auditée. Le statut de contrôle ne doit pas modifier la vente source.

Les exports sont réservés au Comptable et au Promoteur selon les droits. Ils reprennent les filtres, la période, le périmètre, la date de génération et l’utilisateur générateur.

### 4.3 Créances et bordereaux d’assureurs — F29-CPT

Parcours :
1. Choisir l’assureur et la période.
2. Consulter les ventes/créances éligibles et les totaux.
3. Vérifier les lignes et les anomalies de données.
4. Générer un aperçu de bordereau.
5. Exporter le bordereau en PDF, Excel et, lorsqu’un modèle vérifié est fourni, dans le format imposé par l’assureur.
6. Soumettre au Promoteur pour validation selon le circuit prévu.
7. Après validation, enregistrer le dépôt et son horodatage.
8. Suivre le statut : brouillon, à valider, validé, déposé, payé, rejeté ou à compléter, selon les états réellement pris en charge.
9. Rapprocher les paiements reçus et conserver l’historique des transitions.

Champs/écrans : assureur, période, nombre de lignes, montant total, pièces ou références manquantes sans exposer de données de santé, aperçu, version du modèle d’export, date de dépôt, statut, motif de rejet et historique.

Le modèle exact de chaque assureur doit être obtenu et validé avant de prétendre produire un format officiel. Le Comptable ne peut pas s’auto-accorder une validation réservée au Promoteur.

### 4.4 Rejets, créances anciennes et relances — F30-CPT

- Liste des rejets avec assureur, période, référence du bordereau, date, motif, montant concerné et statut de résolution.
- Consultation de l’historique de chaque créance et des relances.
- Création d’une tâche à destination de la Caisse ou du rôle autorisé afin de compléter une information ou retrouver une pièce autorisée.
- Nouvelle génération/soumission après correction, sans altération de la vente source.
- Relance d’une créance ancienne et suivi de la réponse.
- Historique des actions et des motifs.

La tâche ne doit jamais demander au Comptable d’accéder à une ordonnance ou à un dossier patient. Si une pièce médicale nominative est nécessaire, le parcours doit la faire traiter par un rôle habilité sans la rendre visible au Comptable.

### 4.5 Clôtures de caisse — F26-CPT

Consultation en lecture seule :
- date et poste/caisse ;
- totaux par moyen de paiement ;
- total attendu et total déclaré ;
- écart éventuel ;
- motif et statut de l’écart ;
- rapport de clôture PDF si disponible ;
- état du rapprochement avec le journal des ventes et les mouvements de trésorerie.

Le Comptable peut signaler un écart ou créer une tâche de vérification, mais ne modifie pas la clôture ni ne rouvre une caisse. Toute correction relève du parcours autorisé et doit conserver la piste d’audit.

### 4.6 Trésorerie, dépenses et rapprochement — F66-CPT

Vue en lecture des mouvements financiers autorisés :
- entrées/sorties, date, catégorie, montant FCFA, moyen de paiement, référence, statut et justificatif non médical ;
- dépenses de petite caisse et dépenses récurrentes enregistrées par les rôles autorisés ;
- rapprochement avec clôtures Z, paiements et relevés bancaires importés lorsqu’une source fiable est disponible ;
- écarts, doublons potentiels et mouvements non rapprochés ;
- export PDF/Excel par période et catégorie.

Le Comptable ne crée pas une dépense au nom d’un autre rôle, ne valide pas une dépense qu’il aurait initiée et ne modifie pas les écritures d’origine. Les règles de comptabilisation, catégories, taxes et rapprochement doivent correspondre aux champs réellement existants. Aucun calcul fiscal réglementaire non validé n’est à inventer.

### 4.7 Assureurs, fournisseurs et commandes — F28/F31/F32-CPT

- Assureurs : nom, taux/plafonds enregistrés, conditions et créances, en lecture.
- Fournisseurs : identité professionnelle et conditions commerciales autorisées, en lecture.
- Commandes : référence, statut, montants, facture et état de rapprochement, en lecture.
- Prix d’achat visibles en lecture au Comptable conformément à la matrice v3.7.
- Aucun bouton de création/modification d’assureur, de fournisseur, de commande ou de prix d’achat.

### 4.8 Rapports & exports planifiés — F39-CPT

- Liste des rapports disponibles par période, type et date de génération.
- Téléchargement PDF/Excel pour les rapports autorisés.
- Génération à la demande ou demande de génération selon les tâches planifiées réellement disponibles.
- Historique des exports, filtres utilisés, utilisateur, statut de génération et lien de téléchargement.
- Gestion des erreurs et des exports expirés sans afficher de données interdites.

Les rapports mensuels destinés à l’expert-comptable doivent distinguer ventes, TVA enregistrée, encaissements, créances, rejets, dépenses et rapprochements, uniquement si les données sources sont disponibles. Un rapport n’est pas déclaré officiel ou conforme à la fiscalité camerounaise sans validation appropriée.

### 4.9 Documents, tâches et reçus d’abonnement — F40/F41/F63-CPT

Documents autorisés : factures fournisseurs, bordereaux, rapports de clôture, exports comptables et reçus d’abonnement NAXA, selon les droits.

Reçus d’abonnement :
- filtre par période ;
- date, montant, devise, référence et statut ;
- téléchargement PDF ;
- intégration possible dans l’export comptable.

**Ne jamais exposer le numéro de téléphone Mobile Money, les secrets de paiement ou des informations personnelles non nécessaires.** L’accès en lecture au reçu ne confère pas le droit de gérer l’abonnement.

Tâches : le Comptable peut consulter et créer des tâches liées aux bordereaux, rejets, créances et rapprochements, dans les limites de ses privilèges. Les tâches ont un responsable, une échéance, un statut et un historique.

### 4.10 Rappels de lots et avoirs — F64-CPT

Vue en lecture des rappels ayant une conséquence financière :
- référence du rappel et du lot ;
- valeur de stock retirée lorsqu’elle est fournie par le système ;
- avoir attendu/reçu, fournisseur, statut et référence de rapprochement ;
- export et historique.

Aucun accès aux dossiers de santé, aucune décision de rappel et aucune modification de stock par le Comptable.

### 4.11 Journal d’audit — F42-CPT

Lecture seule et filtrage par date, acteur, type d’action, objet et résultat. Afficher qui a fait quoi, quand et, si renseigné, pourquoi. Exporter uniquement les événements autorisés et sans donnée de santé nominative. Le journal est non modifiable depuis ce poste.

### 4.12 Profil et déconnexion

Profil : identité du compte, pharmacie rattachée, rôle/fonction, état du compte, préférences d’affichage, changement de mot de passe via le mécanisme d’authentification sécurisé, dernières connexions si disponibles. Le Comptable ne peut pas changer son rôle, sa pharmacie, ses privilèges ni le périmètre d’accès.

Déconnexion : terminer la session, effacer l’état de session local non nécessaire et rediriger vers la connexion. En cas d’échec, afficher une erreur claire sans laisser croire que la session est fermée.

## 5. Matrice synthétique des permissions

| Domaine | Comptable | Limite impérative |
|---|---|---|
| Journal des ventes et TVA enregistrée | Lecture + export | Pas de modification des ventes |
| Marges/bénéfices | Lecture si les droits v3.7 le permettent | Ne pas élargir automatiquement |
| Créances et bordereaux | Préparer, suivre, exporter et soumettre au Promoteur | Pas d’auto-validation |
| Rejets et relances | Lire, relancer, créer des tâches autorisées | Pas d’accès aux ordonnances |
| Clôtures de caisse | Lecture et rapprochement | Pas de modification/réouverture |
| Trésorerie/dépenses | Lecture et exports | Pas d’écriture ou d’approbation implicite |
| Assureurs/fournisseurs/commandes | Lecture | Pas de gestion des référentiels |
| Prix d’achat | Lecture | Pas de modification |
| Documents et reçus | Lecture/téléchargement autorisés | Aucun numéro de téléphone Mobile Money |
| Journal d’audit | Lecture | Jamais de modification |
| Données de santé nominatives | **Interdit** | Écrans, API, exports, fichiers et journaux |
| Pharmacie hors périmètre | **Interdit** | Contrôle côté serveur/RLS |
| Vendre/encaisser/annuler | **Interdit** | Aucun contournement par appel direct |

La matrice du cahier v3.7 et les privilèges serveur font foi. L’existence d’un code de privilège dans le catalogue ne prouve ni que la fonctionnalité est construite ni que le droit est attribué à un compte.

## 6. Exigences techniques et intégration

- Réutiliser la stack et les composants NAXA existants (Next.js App Router, TypeScript strict, Tailwind, Supabase/Postgres, PWA) ; ne pas reconstruire l’application.
- Fonction métier interne `comptable`, jamais une nouvelle valeur de `profiles.role_type`. Le compte reste borné par la pharmacie, l’architecture, les privilèges actifs et le statut commercial.
- Appliquer les droits dans les contrôles serveur, les politiques RLS et les RPC ; masquer un bouton côté client ne constitue pas une protection.
- Toute requête et tout export doivent appliquer le même filtre de périmètre et l’exclusion des données de santé.
- Réutiliser les tables, RPC et modèles existants après inspection du schéma réel. Les migrations éventuelles doivent être additives, idempotentes autant que possible et accompagnées de tests SQL.
- Les opérations de bordereau doivent conserver la vente et la créance sources, utiliser des statuts explicites, éviter les doublons et garder un historique des transitions.
- Prévoir les états chargement, vide, erreur, accès refusé, absence de réseau, export en cours et export échoué. Ne pas afficher de données simulées comme des données réelles.
- Interface en français et anglais selon les conventions NAXA, responsive ordinateur/tablette/mobile, cibles tactiles d’au moins 44 px et accessibilité clavier.
- Les secrets, clés privées et identifiants de prestataires restent côté serveur. Les reçus ne divulguent pas les numéros Mobile Money.
- Les migrations ou modules fournis dans les parties techniques de la conversation doivent être audités par rapport au schéma réel avant exécution. Aucun test ciblé isolé ne vaut preuve de réussite de toute la suite.

## 7. Contradiction à traiter explicitement : portée de MANAGE_ACCOUNTING

La migration `supabase/migration_072_fonctions_validation_distance.sql` du dépôt attribue un privilège atomique `MANAGE_ACCOUNTING` au rôle interne `comptable`. Le cahier v3.7 décrit cependant le Comptable comme **lecture seule et exports**, avec actions limitées sur les créances/bordereaux et tâches de suivi.

En conséquence :
- ne pas interpréter `MANAGE_ACCOUNTING` comme une autorisation générale d’écrire dans les ventes, la trésorerie, les dépenses ou les clôtures ;
- toute écriture métier doit avoir un privilège atomique, une action précise, une validation conforme à la matrice et une piste d’audit ;
- avant d’étendre ce privilège, vérifier les usages réels dans les RPC, RLS, contrôles TypeScript et tests SQL ;
- documenter séparément la préparation/soumission des bordereaux et la validation finale du Promoteur ;
- si le code actuel contredit ces limites, le cahier v3.7 et la séparation des tâches priment jusqu’à arbitrage explicite.

## 8. Plan de tests et critères d’acceptation

### 8.1 Tests d’accès positifs
- Le Comptable accède uniquement au périmètre de sa pharmacie.
- Il consulte les ventes, TVA enregistrée, clôtures, créances, bordereaux, rejets, documents autorisés, reçus, fournisseurs/commandes en lecture et journal d’audit.
- Les filtres et exports correspondent aux lignes visibles et à la période demandée.
- Il peut préparer/suivre les bordereaux et créer des tâches dans les limites définies.
- Les états vides, erreurs, pagination et export volumineux sont gérés sans fuite de données.

### 8.2 Tests négatifs obligatoires
- Tentative d’accès à une autre pharmacie refusée côté serveur.
- Accès aux ordonnances, coffre d’ordonnances, historique patient et données de santé nominatives refusé dans les écrans, requêtes directes, RPC, exports et téléchargements.
- Modification/annulation d’une vente, encaissement, clôture, prix d’achat, fiche assureur/fournisseur, stock ou paramètres refusée.
- Validation de son propre bordereau refusée lorsque l’approbation appartient au Promoteur.
- Consultation du numéro de téléphone Mobile Money et des secrets refusée.
- Appel direct d’une RPC sans privilège refusé, même si un bouton est contourné.
- Export de données interdites bloqué côté serveur et couvert par un test de non-régression.

### 8.3 Tests métier de bout en bout
1. Vente source → créance créée → bordereau préparé → validation Promoteur → dépôt enregistré → paiement rapproché.
2. Bordereau rejeté → motif consulté → tâche créée → correction par rôle autorisé → nouveau dépôt → historique conservé.
3. Clôture de caisse → journal des ventes → rapprochement → écart signalé sans modifier la clôture source.
4. Mouvement de trésorerie/dépense existant → rapprochement → export de période.
5. Reçu d’abonnement disponible → export comptable sans numéro Mobile Money.
6. Export PDF/Excel → contrôle des colonnes, totaux, filtres, périmètre et absence de données de santé.
7. Toute action sensible → événement d’audit lisible par les rôles autorisés.

### 8.4 Qualité de livraison
- tests unitaires et tests frontend des écrans et interactions ;
- tests SQL des politiques RLS/RPC et des limites de rôle ;
- lint, typecheck et build sur le HEAD exact ;
- test de non-régression des parcours Caisse, Promoteur, Magasinier et Pharmacien ;
- résultat de chaque test consigné comme PASS, FAIL ou NON EXÉCUTÉ, sans assimiler un test non exécuté à un succès.

Le parcours est accepté seulement lorsque chaque entrée de navigation est connectée, chaque action a un résultat réel, les contrôles négatifs sont prouvés et les scénarios de bout en bout passent sur un environnement de test propre.

## 9. Dépendances et points à confirmer avant d’affirmer la conformité

- Les modèles et champs exacts des bordereaux de chaque assureur.
- Les règles fiscales, catégories, taux et formats déclaratifs applicables au Cameroun, à valider avec un professionnel compétent.
- Les sources de rapprochement bancaire et les formats de relevés réellement disponibles.
- Le schéma exact des tables de vente, créances, clôtures, trésorerie, documents et reçus sur l’environnement cible.
- Le comportement exact des modules TypeScript/tests fournis dans les parties de spécification : les exécuter et vérifier leurs références réelles avant de déclarer le parcours terminé.
- La portée effective de `MANAGE_ACCOUNTING`, à restreindre aux actions explicites compatibles avec la matrice v3.7.

## 10. Définition de « terminé »

Le compte Comptable n’est pas complet parce que les pages existent ou parce que le menu s’affiche. Il est terminé lorsque :
- toutes les entrées et sous-fonctionnalités ci-dessus sont reliées aux vraies données ;
- les permissions sont appliquées et testées côté serveur ;
- les exports et bordereaux sont corrects et traçables ;
- aucune donnée de santé nominative ne fuit par écran, API, export ou journal ;
- les parcours de bout en bout et les tests négatifs passent ;
- lint, typecheck, build et tests SQL pertinents sont exécutés sur le commit vérifié ;
- les limites non résolues sont explicitement listées, sans revendiquer une conformité non prouvée.
