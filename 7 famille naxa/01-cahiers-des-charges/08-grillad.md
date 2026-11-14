# Cahier des charges — GrillaD

> Document de référence fonctionnelle de l'application GrillaD.
> Version 1.0 · 14 novembre 2026 · Application n° 10 de la Famille NAXA.
> Statut : périmètre métier principal confirmé ; certains paramètres d'exploitation restent à arbitrer.

## 0. Lecture du document

- [V] Décision explicitement validée par le porteur du projet.
- [P] Proposition structurante à confirmer avant implémentation définitive.
- [O] Point ouvert qui ne doit pas être transformé en règle métier sans validation.
- Ce cahier est autonome pour le périmètre GrillaD. Il s'appuie sur le socle technique et les services transversaux de la Famille NAXA, sans recopier ni créer une infrastructure parallèle.
- GrillaD est un ERP spécialisé, et non un logiciel généraliste de restaurant.
- Les montants sont exprimés en francs CFA (FCFA). Les calculs financiers doivent être exacts au franc près.

## 1. Présentation

GrillaD est une application de gestion destinée aux vendeurs de grillades exerçant principalement en soirée. Elle permet de suivre le cycle complet de l'activité : achats, préparation, cuisson, rendement, stock, commandes, ventes, encaissements, dépenses, caisse, personnel et résultat de la soirée.

### 1.1 Périmètre produit strict [V]

GrillaD gère exclusivement les familles suivantes :

1. Porc braisé.
2. Poulet braisé.
3. Poisson braisé.
4. Brochettes.
5. Omelettes.

Aucune autre famille de produits ne doit être ajoutée au catalogue métier de GrillaD. Les boissons, accompagnements, repas complets, desserts et articles de restauration générale sont hors périmètre. Une évolution de périmètre nécessitera une décision explicite.

### 1.2 Objectifs

1. Connaître les quantités achetées, préparées, cuites, vendues et perdues.
2. Calculer le coût réel et la marge par produit, portion ou unité de vente.
3. Éviter les confusions entre stock cru, préparations en cours et produits prêts à vendre.
4. Enregistrer rapidement les ventes pendant les périodes d'affluence.
5. Contrôler les encaissements, les dépenses et les écarts de caisse.
6. Mesurer le résultat réel d'une soirée, sans confondre chiffre d'affaires et bénéfice.
7. Attribuer les opérations aux membres du personnel et conserver une piste d'audit.
8. Continuer à vendre hors connexion et synchroniser sans doublons.

## 2. Utilisateurs et organisation

### 2.1 Profils métier

| Profil | Responsabilités principales |
|---|---|
| Propriétaire / Promoteur | Paramètres, points d'activité, tarifs, plafonds, accès, rapports et validations sensibles |
| Responsable | Supervision quotidienne, achats autorisés, affectations, contrôle de caisse et clôture selon délégation |
| Gestionnaire de stock | Réception, inventaire, préparation, mouvements, pertes et disponibilité |
| Braiseur / Cuisinier | Préparation, cuisson, quantités produites, rendement et pertes de cuisson |
| Vendeur | Saisie des commandes, ventes, remises autorisées et remise des produits |
| Caissier | Encaissements, dépenses autorisées, ouverture et clôture de caisse |
| Comptable | Consultation et export des écritures et rapports autorisés |

Les rôles sont des permissions métier, pas des comptes partagés. Chaque collaborateur utilise son propre accès. Un même utilisateur peut recevoir plusieurs fonctions, mais les droits effectifs doivent être calculés explicitement et journalisés. [P]

### 2.2 Point de vente et mobilité

GrillaD doit pouvoir représenter un ou plusieurs points d'activité rattachés à une même organisation. Les stocks, caisses, équipes, prix et rapports sont isolés par point, avec une consolidation réservée aux personnes autorisées.

- Le modèle doit pouvoir couvrir un emplacement fixe, un emplacement temporaire ou une activité itinérante.
- Une soirée est une session d'exploitation datée, rattachée à un point d'activité.
- Les transferts de stock entre points sont des mouvements explicites, jamais une simple modification de quantité.

[O] Le mode d'exploitation principal (emplacement fixe, itinérance ou les deux) reste à confirmer. Le modèle de données doit rester compatible avec les trois sans imposer un parcours non validé.

## 3. Socle Famille NAXA applicable

GrillaD réutilise les composants transversaux communs lorsqu'ils sont compatibles :

- comptes, organisations, points d'activité, collaborateurs, rôles et appareils ;
- authentification et gestion des sessions ;
- abonnements et droits d'accès ;
- notifications locales et push ;
- journal d'audit ;
- synchronisation hors connexion ;
- exports et sauvegardes selon le socle ;
- paramètres de langue et préférences ;
- mécanismes de sécurité et politiques RLS.

GrillaD reste une application autonome : identité visuelle, navigation, écrans, permissions métier et APK propres. L'utilisation d'un socle partagé ne doit jamais donner accès aux données d'une autre application.

### 3.1 Contraintes communes

- Application Android autonome, installable par APK depuis le site officiel NAXA ; aucune dépendance au Play Store.
- Interface Web responsive/PWA si prévue par le socle Famille NAXA.
- Fonctionnement hors connexion d'abord : opérations locales avec identifiants uniques, file de synchronisation, reprise et dédoublonnage.
- Français et anglais ; aucun texte utilisateur codé en dur.
- Interface mobile prioritaire, lisible en plein soleil, boutons adaptés à l'usage rapide.
- Montants en FCFA, calculs exacts, dates et heures explicites.
- Aucun secret, PIN ou OTP ne doit être lu, stocké, affiché ou transmis.
- Aucune clé privilégiée Supabase dans l'application cliente.
- RLS et contrôles serveur obligatoires ; ne pas considérer le masquage d'un écran comme une autorisation.
- L'IA peut analyser et suggérer ; elle ne valide jamais seule une dépense, un paiement, une remise sensible ou un mouvement de stock.
- WhatsApp : messages préparés et liens wa.me ; pas d'envoi automatique non autorisé.
- Pas de déploiement, de publication APK ou d'application de migration sans accord explicite.

## 4. Modules fonctionnels GrillaD

### G1. Tableau de bord de soirée

Vue synthétique de la session en cours :

- chiffre d'affaires brut et net ;
- nombre de commandes et quantités vendues par famille autorisée ;
- encaissements par mode de paiement ;
- dépenses enregistrées ;
- coût estimé des produits vendus ;
- marge brute et résultat provisoire clairement distingués ;
- quantités disponibles, alertes de rupture et produits bientôt épuisés ;
- pertes et écarts à examiner ;
- état de la caisse et progression de la clôture.

Les chiffres sont calculés à partir des écritures sources. Un indicateur estimé doit être libellé comme tel ; aucun bénéfice définitif ne doit être affiché avant rapprochement et clôture.

### G2. Catalogue des grillades et tarifs

Chaque fiche produit appartient obligatoirement à l'une des cinq familles autorisées.

Champs fonctionnels proposés :

- nom commercial et famille ;
- unité de préparation et unité de vente ;
- modes de vente : pièce, portion ou poids lorsque pertinent ;
- variantes de taille ou de grammage ;
- prix de vente actif, date d'effet et historique ;
- recette ou nomenclature de matières premières ;
- statut disponible / indisponible ;
- photo facultative.

Les variantes ne doivent pas créer de nouvelles familles. Les prix historiques d'une vente restent inchangés après une modification tarifaire.

### G3. Approvisionnement et achats

- Fiche fournisseur facultative : identité, contacts, produits fournis et historique.
- Saisie d'un achat : date, fournisseur, articles, quantité, unité, prix unitaire, frais annexes et montant total.
- Réception partielle ou complète.
- Justificatif photo facultatif.
- Distinction entre achat commandé, reçu et payé.
- Dette fournisseur et règlement, si le mode de gestion est activé.
- Historique des prix d'achat et comparaison des coûts.
- Aucun achat ne doit augmenter le stock avant confirmation de réception.

### G4. Matières premières et stock

Le stock distingue au minimum :

1. matières premières reçues ;
2. matières préparées ;
3. produits en cours de cuisson ;
4. produits prêts à vendre ;
5. produits réservés à une commande ;
6. pertes, rebuts et sorties justifiées.

Chaque mouvement contient : point d'activité, session, article, quantité, unité, sens, motif, auteur, date locale et horodatage serveur, référence source et statut de synchronisation.

- Inventaire par comptage manuel et, si disponible, scan d'un code.
- Alertes de seuil paramétrable.
- Lots et dates limites lorsque la matière le nécessite.
- Transferts entre zones ou points via mouvement validé.
- Interdiction des corrections silencieuses : toute correction crée une écriture compensatrice avec motif.

### G5. Préparation, cuisson et rendement

Pour chaque lot de production :

- famille et produit préparé ;
- matières premières consommées et quantités ;
- poids ou quantité avant préparation ;
- quantité après préparation ;
- quantité mise en cuisson ;
- poids ou nombre obtenu après cuisson ;
- portions ou unités commercialisables produites ;
- pertes de parage, cuisson, détérioration ou autre motif ;
- opérateur responsable et horaires ;
- coût de production calculé selon la méthode de valorisation retenue.

Le rendement est mesuré et historisé. Les rendements réels ne doivent pas être remplacés par une valeur théorique. Les écarts entre rendement attendu et constaté déclenchent une alerte explicable, pas une correction automatique.

### G6. Commandes et ventes rapides

- Écran de vente adapté à l'affluence : accès direct aux cinq familles et à leurs produits disponibles.
- Ajout, modification et suppression d'une ligne avant validation.
- Quantité, poids ou portion selon la fiche produit.
- Remise uniquement dans les limites de permission ; validation supérieure si le seuil est dépassé.
- Commande à emporter ou remise directe ; les tables et la restauration en salle ne sont pas un besoin obligatoire.
- Statuts simples : brouillon, confirmée, en préparation, prête, remise, annulée.
- Une vente validée est immuable ; correction par annulation/avoir et écriture compensatrice.
- Reçu consultable et partageable par WhatsApp ; impression Bluetooth si supportée.
- Numéro de commande unique, y compris hors connexion.

### G7. Paiements et encaissements

Modes à prévoir : espèces, Mobile Money, paiement mixte et paiement différé si ce dernier est autorisé par le propriétaire.

- Un encaissement est rattaché à une vente et à une caisse.
- Le statut « payé » doit être distinct de « déclaré payé » ou « à vérifier ».
- Un SMS partagé peut servir de justificatif à examiner, mais ne constitue pas à lui seul une preuve indépendante de crédit reçu.
- Ne jamais inventer de confirmation Mobile Money si le mécanisme de vérification du socle ne l'a pas établie.
- Prévenir les doubles encaissements par identifiant unique et contrôle de cohérence.
- Les remboursements et annulations sont tracés.

### G8. Caisse et dépenses

- Ouverture de caisse avec fonds initial et responsable.
- Entrées et sorties liées à une pièce ou à un motif.
- Dépenses de soirée : achats urgents, transport, combustible de cuisson, consommables strictement liés à l'activité et autres frais autorisés.
- Une dépense ne doit pas être confondue avec une perte de stock.
- Retraits personnels éventuels enregistrés séparément comme prélèvements, jamais comme achats de matières.
- Comptage réel à la clôture.
- Solde théorique, solde compté, écart et justification.
- Validation selon les délégations ; historique non effaçable.

### G9. Pertes, invendus et écarts

Catégories paramétrables avec motifs obligatoires :

- perte de préparation ;
- perte de cuisson ;
- produit détérioré ;
- invendu en fin de session ;
- produit offert ou dégustation autorisée ;
- erreur de saisie ;
- écart d'inventaire.

Les invendus ne sont pas automatiquement reportés à la session suivante : leur conservation, leur destruction ou leur transfert doit être enregistré selon une règle définie et les exigences sanitaires applicables. [P]

### G10. Personnel et contrôle interne

- Création et désactivation des profils par un responsable autorisé.
- Affectation à un ou plusieurs points d'activité.
- Rôles et permissions granulaires : vente, remise, achat, réception, inventaire, dépense, ouverture/fermeture de caisse, consultation des rapports.
- Affectation à une session et suivi des opérations par utilisateur.
- Demande d'autorisation à distance pour les actions dépassant les plafonds.
- Journal d'audit avec avant/après, auteur, date, motif et appareil.
- Aucun partage de PIN ou de compte.

### G11. Rapports et comptabilité de gestion

Rapports par soirée, jour, période, produit, famille, point et utilisateur :

- ventes et quantités ;
- achats et coût d'approvisionnement ;
- coût des matières consommées ;
- rendement de cuisson ;
- pertes et invendus ;
- dépenses ;
- encaissements et remboursements ;
- marge brute par produit ;
- résultat estimé et résultat clôturé ;
- écarts de caisse et d'inventaire.

Exports PDF/CSV/XLSX selon capacités du socle et permissions. Les règles de calcul doivent être documentées. La comptabilité légale complète n'est pas présumée incluse : le périmètre initial est le pilotage de gestion, avec export vers un comptable.

### G12. Assistant et analyses intelligentes

Fonctions proposées :

- estimation des quantités à préparer selon l'historique ;
- alerte de risque de rupture ;
- comparaison des rendements ;
- détection d'écarts atypiques ;
- estimation du coût et de la marge ;
- synthèse de fin de soirée.

Chaque recommandation affiche les données et hypothèses utilisées. L'utilisateur décide et confirme. En l'absence de données fiables, l'assistant le dit et ne fabrique pas de prévision.

## 5. Parcours principaux

### 5.1 Préparer une soirée

1. Ouvrir une session sur un point d'activité.
2. Vérifier le stock et les achats reçus.
3. Enregistrer les préparations et les lots de cuisson.
4. Déclarer les quantités prêtes à vendre.
5. Affecter les membres de l'équipe et ouvrir la caisse.

### 5.2 Réaliser une vente

1. Sélectionner un produit autorisé et sa variante.
2. Saisir quantité, poids ou portion.
3. Confirmer la commande.
4. Enregistrer le paiement ou son statut de vérification.
5. Déduire le stock selon la règle de consommation définie.
6. Produire un reçu et conserver la trace de l'opération.

### 5.3 Clôturer une soirée

1. Arrêter les nouvelles ventes ou basculer la session en clôture.
2. Terminer les commandes en cours.
3. Enregistrer les pertes et invendus.
4. Compter le stock restant.
5. Compter les espèces et rapprocher les autres paiements.
6. Saisir les dépenses manquantes.
7. Examiner les écarts.
8. Faire valider la clôture par la personne habilitée.
9. Générer le rapport de soirée.

## 6. Règles de gestion non négociables

1. Le catalogue ne contient que porc braisé, poulet braisé, poisson braisé, brochettes et omelettes.
2. Aucun produit hors périmètre ne doit être ajouté par défaut ou par import.
3. Une vente confirmée ne peut pas être supprimée ni réécrite.
4. Chaque mouvement de stock a une origine, un auteur, une date et un motif.
5. La quantité disponible ne peut pas devenir négative par simple concurrence de ventes ; réserver/verrouiller les quantités côté serveur lors de la synchronisation.
6. Une opération hors connexion reçoit un identifiant stable et est dédoublonnée à la synchronisation.
7. Les montants sont calculés en unités monétaires entières ; pas de flottants binaires pour les montants.
8. CA, encaissement, marge et bénéfice sont des notions séparées.
9. Les coûts et prix historiques sont conservés pour expliquer les rapports passés.
10. Toute action sensible est autorisée côté serveur et auditée.
11. Les données d'un point d'activité ne sont pas visibles depuis un autre point sans permission explicite.
12. L'IA ne valide ni paiement, ni dépense, ni stock, ni clôture.

## 7. Données et architecture

Le schéma doit être conçu après inspection du socle Famille NAXA et des tables déjà existantes. Réutiliser les entités communes compatibles. Créer uniquement les entités métier manquantes, avec préfixe ou convention de nommage cohérente.

Entités métier indicatives à étudier, sans imposer leur création si un équivalent existe :

- grillad_products, grillad_product_variants ;
- grillad_suppliers, grillad_purchases, grillad_purchase_lines ;
- grillad_stock_items, grillad_stock_lots, grillad_stock_movements ;
- grillad_sessions, grillad_production_batches, grillad_production_inputs ;
- grillad_orders, grillad_order_lines, grillad_sales ;
- grillad_payments, grillad_cash_registers, grillad_cash_movements ;
- grillad_expenses, grillad_losses, grillad_inventory_counts ;
- grillad_reports ou vues de reporting.

Exigences :

- clés étrangères, contraintes, index et horodatages ;
- montants en BIGINT/NUMERIC exact, jamais FLOAT/REAL ;
- quantités et poids avec précision décimale adaptée ;
- suppression logique si nécessaire, sans effacer les écritures financières ;
- RLS activée et testée sur chaque table exposée ;
- fonctions SECURITY DEFINER limitées, auditées et avec search_path fixé ;
- aucun accès direct non contrôlé depuis le client ;
- migrations additives, réversibles autant que possible, non appliquées sans accord ;
- tests d'isolation multi-organisations, multi-points et multi-rôles.

## 8. Écrans attendus

1. Connexion / verrouillage local.
2. Tableau de bord de soirée.
3. Sélecteur de point et session.
4. Catalogue des cinq familles.
5. Vente rapide / commande.
6. Détail et suivi d'une commande.
7. Achats et fournisseurs.
8. Réception d'achat.
9. Stock et inventaire.
10. Préparation et cuisson.
11. Détail d'un lot et rendement.
12. Pertes et invendus.
13. Caisse et dépenses.
14. Équipe et permissions.
15. Rapports et exports.
16. Paramètres, synchronisation et aide.

La navigation doit rester courte, adaptée au téléphone et utilisable d'une seule main lorsque possible.

## 9. Exigences non fonctionnelles

- Réactivité sur téléphone Android d'entrée de gamme.
- Mode hors connexion visible avec date de dernière synchronisation.
- Synchronisation idempotente et reprise après fermeture brutale.
- Conflits signalés ; aucune écriture financière ou de stock écrasée silencieusement.
- Sauvegarde et restauration documentées.
- Protection des données personnelles des clients et employés.
- Journalisation sans secrets ni données sensibles inutiles.
- Accessibilité : contrastes suffisants, libellés et icônes, tailles tactiles adaptées.
- Tests unitaires, tests SQL/RLS et tests de parcours de vente/clôture.

## 10. Critères de recette

GrillaD ne peut être déclaré prêt que si les preuves suivantes existent :

- [ ] Le catalogue rejette toute famille autre que les cinq familles autorisées.
- [ ] Un achat commandé mais non reçu n'augmente pas le stock.
- [ ] Une réception augmente le stock une seule fois.
- [ ] Un lot de cuisson consomme les intrants et calcule le rendement sans inventer les quantités.
- [ ] Une vente confirmée est immuable et consomme le stock une seule fois.
- [ ] Deux ventes concurrentes ne peuvent pas vendre la même quantité disponible.
- [ ] Un paiement déclaré non vérifié n'est pas présenté comme confirmé.
- [ ] Une dépense est distinguée d'une perte de stock.
- [ ] La clôture rapproche caisse théorique et caisse comptée.
- [ ] Une session clôturée conserve son historique et ses coûts.
- [ ] Les opérations hors connexion sont synchronisées sans doublon.
- [ ] Les rôles et RLS empêchent l'accès entre organisations et points non autorisés.
- [ ] Les exports respectent les permissions et indiquent période et point.
- [ ] Les cinq parcours principaux sont testés sur Android.

## 11. Points ouverts à arbitrer

Ces éléments ne bloquent pas la conception initiale, mais doivent être confirmés avant de figer les règles concernées :

1. [O] Exploitation : emplacement fixe, itinérance ou les deux.
2. [O] Unités de vente exactes par famille : pièce, portion, poids, brochette à l'unité, omelette à l'unité ou variantes.
3. [O] Méthode de valorisation des stocks : coût moyen pondéré ou FIFO, selon les contraintes opérationnelles.
4. [O] Gestion des avances, ardoises et paiements différés : activée ou non.
5. [O] Conservation, transfert ou destruction des invendus en fin de soirée.
6. [O] Plafonds de remise, dépenses et achats selon les rôles.
7. [O] Tarification de l'abonnement GrillaD : à définir dans le socle commun, sans inventer de montant.

## 12. Hors périmètre

- Gestion générale de restaurant, tables de salle et carte de repas.
- Boissons, accompagnements, desserts et autres marchandises.
- Livraison à domicile comme module obligatoire.
- Comptabilité légale complète et déclarations fiscales automatisées.
- Paiement intégré ou portefeuille financier NAXA.
- Publication Play Store.
- Décisions automatiques de l'IA sur l'argent ou les stocks.

## 13. Statut

Le périmètre strict des cinq familles de grillades est [V]. La structure fonctionnelle décrite dans les sections 4 à 10 constitue la base de spécification à auditer et valider au fil de la construction. Les points listés en section 11 restent [O] et ne doivent pas être présentés comme des décisions déjà prises.
