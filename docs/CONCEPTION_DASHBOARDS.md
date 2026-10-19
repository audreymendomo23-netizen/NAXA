# Système de design NAXA — tableaux de bord Bento

## Source de vérité visuelle

Palette obligatoire : vert profond `#064B2A` pour les cartes héros et la navigation active ; vert `#0A6B3A` pour les actions et graphiques ; vert pâle `#F2FAF5` pour les surfaces actives ; jaune canari `#FFE33D` pour les actions principales ponctuelles ; gris très clair verdâtre pour le fond ; rouge réservé aux alertes critiques et orange aux avertissements. Les anciens codes bleu vif, orange de titre et fond ACDC76 ne sont plus la référence des nouveaux écrans Bento.

## Grammaire commune

- Desktop : navigation latérale fixe d'environ 240 px, réductible ; barre supérieure fine avec titre, recherche globale, notifications, aide et avatar.
- Mobile : navigation principale en barre basse ; grille à une colonne ; commandes essentielles accessibles au pouce.
- Grille desktop de 12 colonnes, gouttières de 16–20 px. Cartes blanches, rayon 20–24 px, bordure discrète et ombre diffuse.
- Une carte = une information ou un outil. Carte héros vert profond pour le KPI principal du poste ; cartes KPI secondaires, graphiques, tâches, alertes et raccourcis selon le métier.
- Typographie sans-serif lisible ; montants FCFA en chiffres tabulaires ; dates au format français ; libellés en français.
- Pas de valeur chiffrée sans source de données identifiable ; pas de tendance ou de pourcentage calculé sur une période incomplète.

## Bibliothèque partagée attendue

Composants communs : `BentoShell`, `BentoCard`, `KpiCard`, `StatusBadge`, `EmptyState`, `LoadingSkeleton`, `ErrorState`, `PeriodFilter`, `DataTable`, `ConfirmDialog`, `SidePanel`, `FormField`, `HelpLink`. Avant d'ajouter un composant, rechercher l'équivalent existant et le consolider plutôt que créer une variante visuelle concurrente. Les noms ci-dessus décrivent les responsabilités attendues et ne prouvent pas à eux seuls que chaque composant existe déjà.

## Contrat d'interaction

- Les actions courantes passent par des modales ou panneaux latéraux sans navigation inutile ; toute mutation doit rester autorisée et validée côté serveur.
- Filtres de période synchronisés entre les cartes d'un même tableau de bord.
- Chaque écran gère explicitement chargement, vide, erreur avec reprise et succès ; aucun bouton décoratif sans action.
- Temps réel uniquement lorsque la source et le canal sont effectivement configurés ; sinon afficher la fraîcheur réelle des données plutôt que promettre une mise à jour live.
- Animations en cascade sobres, transitions de 150–250 ms, respect de `prefers-reduced-motion`; aucune animation ne doit retarder l'encaissement, le scan ou une validation répétitive.
- Apparence clair/sombre et accent personnalisable uniquement après connexion du réglage au profil persistant ; ne pas afficher un réglage qui n'est pas appliqué ou mémorisé.

## Cartes par poste

- Promoteur : CA du jour (héros), marge, ventes par heure, performance par caisse, demandes à valider, clôtures Z, lots proches de péremption, créances, alertes de stock.
- Responsable : supervision des caisses, clôtures, commandes, inventaires et demandes dans son périmètre délégué.
- Caissier : session en cours, ventes du jour, modes de paiement, paniers en attente et accès direct à la caisse.
- Pharmacien : ordonnances à valider, consultations et dossiers incomplets.
- Assistant pharmacien : dossiers à compléter et commandes à préparer ; aucune validation pharmaceutique.
- Magasinier : réceptions attendues, bons de livraison, inventaire et écarts à soumettre.
- Gestionnaire de stock : ruptures, péremptions, stocks dormants et réapprovisionnement.
- Comptable : ventes, clôtures en lecture, rapprochements, créances, bordereaux et trésorerie ; aucune donnée de santé nominative.
- Administrateur NAXA : pharmacies actives, CA réseau, entonnoir commercial, conventions à échéance et comptes à surveiller.
- Client : recherche, panier, réservation, suivi, profil et confidentialité ; l'ERP demeure la source du stock et de la disponibilité.

## Fiche client/patient centralisée

Point d'entrée commun depuis la caisse, le poste pharmacien et le suivi des réservations. En-tête identité et statut ; chronologie des achats, réservations, ordonnances, délivrances, paiements et notes ; actions rapides adaptées au poste. Le serveur applique les droits à chaque lecture et écriture, et journalise les consultations de santé. Le Comptable n'accède ni aux ordonnances ni aux données de santé nominatives. Ne pas exposer ces données dans les journaux généraux ou les rapports comptables.

## Critères d'acceptation visuels et fonctionnels

1. Une seule bibliothèque de composants partagée, sans style de tableau de bord divergent.
2. Toutes les cartes chiffrées sont reliées à une source vérifiable et au périmètre du rôle.
3. Les états vide, chargement, erreur et reprise sont présents.
4. Les mutations ont une action serveur et une autorisation serveur ; les boutons sans effet sont supprimés.
5. Mobile utilisable sans débordement horizontal et avec navigation adaptée.
6. Contrôle des permissions API/RLS indépendant de la visibilité de l'interface.
7. Accessibilité clavier, focus visible, contrastes et réduction des animations vérifiés.
8. La présence d'une animation, d'un graphique ou d'un canal Realtime n'est pas considérée comme preuve de fonctionnement métier.
