# NAXA ERP — Compte Caissière
## Partie 1 : Cahier des charges + Design

Version de travail du 20/10/2026. Document autonome : il ne suppose aucun accès à la maquette ni aux anciens textes.

---

## 0. Principes non négociables

1. **Aucun chiffre en dur.** Tout montant, taux, plafond, seuil ou nom vient de la base de données ou des paramètres de la pharmacie. Les chiffres de la maquette (125.500, 45.000, 5.200, 12.000, Paracetamol, Amoxi…) sont des exemples visuels : ils ne doivent apparaître nulle part dans le code, sauf dans les tests, clairement marqués « valeurs de test ».
2. **Les calculs sont codés dès le départ**, en fonctions pures et testées (voir Partie 2). Les écrans les appellent ; ils ne recalculent jamais à leur façon. Le serveur recalcule toujours tout avant d'enregistrer (le client n'est jamais cru sur ses totaux).
3. **FCFA = nombres entiers.** Pas de décimales, pas de flottants pour l'argent. Taux en points de base (1925 = 19,25 %).
4. **Un état vide est un état normal.** Compte neuf = écrans propres avec message d'aide, pas de faux contenu.
5. **Réservation et retrait en boutique uniquement.** Aucune livraison.
6. **Ce qui est supprimé par rapport aux anciens textes** : cotisation CNPS de la caissière (la CNPS n'apparaît ici que comme assureur du client), prime de performance inventée, comparaisons « 50x Phénix », « blockchain » (on parle de journal d'audit chaîné), seuils figés (5000, 200k, 350k, 80 %).

---

## 1. Contexte et périmètre

NAXA est une plateforme santé (Marketplace client + ERP pour pharmacies). Le **compte Caissière** est l'espace de l'ERP utilisé au comptoir : vendre, encaisser, gérer les clients assurés, ouvrir/fermer la caisse. Il est branché au Marketplace (réservations retirées en boutique) et au stock de la pharmacie. Il alimente la comptabilité (module Comptable) sans jamais y écrire directement.

**Hors périmètre caissière** (réservé aux autres rôles) : créer/modifier produits et prix, paramétrer assureurs/taux/plafonds, générer et envoyer les bordereaux aux assureurs, valider annulations et gros écarts, comptabilité, paie.

**Un compte caissier existe déjà partiellement** dans l'ERP. Avant d'écrire du code, auditer l'existant, réutiliser ce qui est bon, mapper les noms de tables et de composants, ne rien dupliquer.

---

## 2. Rôles et permissions

| Action | Caissière | Pharmacien / Responsable | Promoteur / Admin |
|---|---|---|---|
| Vendre, encaisser, imprimer | Oui | Oui | Oui |
| Modifier un prix ou un taux | Non | Non (fiche produit) | Selon droits |
| Remise de ligne | Seulement si le paramètre l'autorise, plafonnée par un paramètre | Oui | Oui |
| Créer client / assuré | Oui | Oui | Oui |
| Créer/modifier un assureur, taux, plafond, exclusions | Non | Oui | Oui |
| Vente à crédit | Seulement si autorisé par paramètre et client identifié | Oui | Oui |
| Demander une annulation / un retour | Oui (demande) | Valide | Valide |
| Voir ses ventes et sessions | Oui | Toutes | Toutes |
| Voir les ventes des autres caissiers | Non | Oui | Oui |
| Clôturer avec écart au-dessus du seuil | Demande + justificatif | Valide | Valide |

Toutes les permissions sont appliquées **côté base (RLS) et côté serveur**, jamais seulement dans l'interface.

---

## 3. Paramètres de la pharmacie (aucun en dur)

Table de paramètres lue par tous les calculs. Chaque paramètre a une valeur par défaut « non défini » : tant qu'il manque, la fonctionnalité concernée est désactivée ou demande une configuration.

- **Identité reçu** : nom, adresse, téléphone, identifiants fiscaux et commerciaux, message de bas de reçu.
- **Modes de paiement actifs** : liste (code, libellé, type : espèces / mobile money / autre).
- **Écarts de caisse** : seuil au-dessus duquel un justificatif est obligatoire ; photo obligatoire oui/non ; seuil au-dessus duquel une validation du responsable est requise ; écart d'ouverture bloquant oui/non.
- **Remises** : autorisées à la caissière oui/non, plafond en %.
- **Crédit client** : autorisé oui/non, plafond de crédit par client, client identifié obligatoire.
- **Péremption** : nombre de jours avant péremption pour l'alerte ; vente interdite si périmé (toujours).
- **Assurance** : photo de carte obligatoire oui/non ; ordonnance obligatoire oui/non ; mode d'arrondi de la part assureur.
- **Sécurité poste** : délai de verrouillage d'écran, longueur du code PIN.
- **Reçu** : largeur du papier (58 mm / 80 mm), nombre d'exemplaires.
- **Comparaisons de performance** : activées oui/non, nombre minimal de caissiers pour afficher une moyenne.
- **Grille de coupures** du comptage (billets et pièces en circulation) : configurable.

---

## 4. Règles de calcul (les formules à coder)

Toutes en entiers FCFA. Arrondi défini par paramètre, au plus proche par défaut.

1. **Total de ligne** = quantité × prix unitaire TTC − remise de ligne.
2. **Total de la vente (TTC)** = somme des totaux de ligne.
3. **TVA par taux** : regrouper les lignes par taux ; HT du groupe = TTC du groupe ÷ (1 + taux) arrondi ; TVA du groupe = TTC du groupe − HT. Le taux vient de la fiche produit (0 pour un produit exonéré). Le reçu affiche la ventilation par taux.
4. **Prise en charge assureur** :
   - base remboursable = somme des lignes remboursables (les produits exclus chez cet assureur sont payés à 100 % par le client) ;
   - part assureur brute = base remboursable × taux de prise en charge de l'assureur ;
   - plafond restant = plafond de l'assuré − consommation de la période (mensuelle, annuelle ou aucune selon l'assureur), calculé depuis les ventes enregistrées ;
   - part assureur = min(part brute, plafond restant) ;
   - part client (ticket modérateur) = total TTC − part assureur ;
   - dépassement = part brute − part assureur (si > 0 : alerte « plafond atteint », le client paie la différence après confirmation explicite).
   La caissière ne peut pas modifier le taux : il est fixé par l'assureur.
5. **Règlement** : reçu total = somme des paiements. Reste à payer = max(0, part client − reçu). Surplus = max(0, reçu − part client). Monnaie à rendre = min(surplus, espèces reçues). Un surplus qui ne peut pas être rendu en espèces (mobile money en trop) invalide le paiement.
6. **Crédit généré** = reste à payer, seulement si le crédit est autorisé et le client identifié. Sinon la vente ne peut pas être validée.
7. **Solde théorique des espèces** = fond d'ouverture + espèces encaissées nettes de monnaie rendue + encaissements de crédits en espèces + entrées manuelles − sorties − remboursements en espèces.
8. **Écart de caisse** = espèces comptées − solde théorique (négatif = manque). Justificatif obligatoire si |écart| > seuil paramétré.
9. **Écart mobile money** par opérateur = total confirmé par la caissière sur le relevé de l'opérateur − total enregistré. Suivi séparément des espèces.
10. **Les 4 cartes du tableau de bord** (session ouverte) :
    - *Solde du compte* = solde théorique des espèces (règle 7) ;
    - *Encaissement* = total encaissé de la session, tous modes, net de monnaie rendue ;
    - *Montant remboursé* = deux lignes : part assureur cumulée des ventes assurées de la session (« Principal ») et part client cumulée de ces mêmes ventes (« Remboursement » dans la maquette, à confirmer, voir §13) ;
    - *Solde crédit* = somme des crédits clients restant à recouvrer (voir §6.6 pour le périmètre).
11. **Indicateurs de rapport** : nombre de ventes, chiffre d'affaires, panier moyen, répartition par mode de paiement, part de ventes assurées, nombre et montant des annulations, historique des écarts. Tous calculés depuis les ventes réelles.

---

## 5. Inventaire de la maquette (élément par élément) et améliorations

### 5.1 En-tête (bande verte)
- À gauche : logo NAXA (gélule jaune inclinée + mot NAXA blanc, gras) puis texte blanc « Pharmacy ERP • Tableau de bord ».
- À droite : pastille ronde jaune avec initiales (« AD »), nom (« Admin Pharma »), cloche avec point jaune de notification.
- **Amélioration** : afficher le nom réel de la caissière et son rôle ; initiales calculées ; la cloche ouvre un panneau de notifications avec compteur (voir §8) ; indicateur discret **En ligne / Hors ligne / Synchronisation en cours** à côté de la cloche.

### 5.2 Barre latérale (verte, fixe)
- Logo NAXA répété avec petit pictogramme au-dessus (oiseau/plume), puis 7 entrées : **Tableau de bord** (actif : fond jaune canari, texte vert foncé, petite flèche), **Clients et Assurances**, **Historique des ventes**, **Prise / fin de service**, **Rapports & Performances**, **Profil**, **Déconnexion**.
- Bas : « v2.4.1 • 2024 ».
- **Améliorations** : le numéro de version est lu depuis la configuration de build, jamais écrit en dur ; badge sur « Prise / fin de service » quand la session n'est pas ouverte ; badge de compteur sur « Clients et Assurances » pour les crédits à recouvrer ; replie en icônes seules sur tablette ; devient un tiroir (menu burger) sur mobile ; un seul logo visible sur mobile.

### 5.3 Les 4 cartes KPI (blanches, coins arrondis, ombre douce, qui chevauchent la bande verte)
1. **Solde du compte** : montant très gros et gras, « FCFA » plus petit, mini-courbe verte à droite.
2. **Encaissement** : montant + icône billet jaune.
3. **Montant remboursé** : deux montants empilés + sous-texte « Principal + Remboursement » sur surlignage jaune pâle.
4. **Solde crédit** : montant + petit signe jaune ondulé.
- **Améliorations** : séparateur de milliers fr-FR uniforme (« 125 500 FCFA », la maquette mélange points et espaces) ; chaque carte est cliquable (détail de la session) ; état de chargement (squelette) et état « session non ouverte » (« Ouvrez votre service pour commencer ») ; la mini-courbe n'apparaît que s'il y a au moins deux points réels.

### 5.4 Zone Encaissement (colonne centrale)
- Titre « Encaissement », sous-titre « Vente comptoir • Scanner le produit ».
- **Cadre de scan** (bordure jaune en pointillés, fond gris très clair) : pictogramme pistolet scanner jaune, titre « Scanner de code-barres », texte « Scanner ou saisir le code produit », bouton vert « Activer le scanner » (liseré jaune).
- **Liste des médicaments** : carte blanche, une ligne par produit : nom à gauche, « x quantité • montant » à droite, icône corbeille ; ligne **Total** en gros caractères gras.
- **Modes de paiement** : boutons selon les paramètres, dont **MoMo**, **OM Cash** et **Paiement en 2 parties** dans la maquette.
- **Bouton large vert « Imprimer le reçu »** avec icône imprimante.
- **Améliorations** :
  - Un scanner USB se comporte comme un clavier : le champ de saisie reste toujours actif (focus automatique, Entrée valide). Le bouton « Activer le scanner » active la caméra du téléphone ou de la tablette quand il n'y a pas de pistolet.
  - Recherche manuelle par nom ou code avec suggestions (stock réel affiché).
  - Quantité modifiable par + / −, corbeille avec annulation possible (toast « Annuler »).
  - Ajout du mode **Espèces** (absent de la maquette, indispensable pour la monnaie rendue et l'écart de caisse). Libellé « OM Cash » conservé tel quel dans la maquette ; à confirmer (§13).
  - Choix du client et de l'assuré **au-dessus** de la liste (client anonyme par défaut). Dès qu'un assuré est choisi, le panneau affiche la ventilation part assureur / part client en direct.
  - Le bouton « Imprimer le reçu » est désactivé tant que la vente n'est pas **validée et payée** ; le vrai flux est : Valider la vente → paiement → reçu imprimé automatiquement (et réimpression possible).
  - Lignes en alerte : produit sur ordonnance (exige les champs ordonnance), lot proche de la péremption (badge orange), produit périmé (ajout refusé, modale rouge), rupture (refus).

### 5.5 Colonne Réservation
- Titre « Réservation », texte « Scanner QR pour récupérer la commande réservée ».
- Carte blanche avec grand QR, pastille jaune « • QR Scanner actif », texte « En attente de scan… ».
- Encart jaune pâle avec ampoule : « Astuce : présenter le QR client pour charger la réservation ».
- **Améliorations** : le QR affiché dans la maquette est une illustration : la zone devient la **vue caméra de lecture**. Au scan : la réservation du Marketplace est chargée dans le panier (lignes, quantités, prix à jour), avec contrôle du stock et de la péremption. Cas gérés : QR inconnu, réservation déjà retirée, expirée, annulée, produit devenu indisponible (la ligne est signalée, jamais supprimée en silence). Statut passé à « Retirée » seulement après paiement validé. Saisie manuelle du code de réservation en secours.

---

## 6. Parcours détaillés

### 6.1 Connexion et ouverture de service (Prise de service)
1. Connexion via la page de connexion NAXA existante (aucune modification de son design).
2. Si aucune session n'est ouverte, le tableau de bord montre un grand bouton « Ouvrir mon service » ; les actions de vente sont verrouillées.
3. Écran d'ouverture : choix du poste de caisse, comptage du fond d'ouverture (grille de coupures ou montant total), affichage du **fond laissé à la clôture précédente** pour ce poste.
4. Si le fond compté ≠ fond laissé : afficher l'écart, demander un justificatif ; bloquant ou non selon paramètre ; le responsable est notifié.
5. Création de la session (horodatage serveur). Une seule session ouverte par poste et par caissière.

### 6.2 Vente comptoir simple
Scanner / chercher → panier → (client optionnel) → Valider → choisir le mode → saisir le montant reçu (espèces : monnaie à rendre affichée en grand) → confirmer → stock décrémenté (lot qui expire en premier) → reçu imprimé → panier vidé, focus revenu sur le scanner.
Le tout doit être faisable **au clavier / au scanner sans toucher la souris**.

### 6.3 Vente assurée (tiers payant)
1. Sélection de l'assuré (recherche par nom, téléphone ou numéro de carte). S'il n'existe pas : « Créer l'assuré » (assureur, numéro de carte, nom, téléphone, photo de la carte).
2. Aucune vérification en ligne n'existe auprès des assureurs : la vérification se fait dans la base de la pharmacie (assuré actif, carte non expirée si une date est saisie, plafond restant calculé).
3. Champs de preuve selon paramètres : **photo de la carte**, **numéro d'ordonnance**, **médecin prescripteur**. Tant qu'un champ obligatoire manque, « Valider la vente assurée » reste grisé avec la raison affichée.
4. Ventilation affichée en direct (règle 4). Produits exclus marqués « non remboursé ».
5. Plafond atteint : bandeau rouge, le client paie la différence après confirmation explicite ; événement journalisé.
6. Plafond bientôt atteint (seuil de pourcentage paramétrable) : bandeau orange.
7. Seule la part client est encaissée au comptoir. La part assureur reste « à facturer » et rejoint le bordereau préparé par le pharmacien.
8. La caissière voit le statut de ses ventes assurées (à facturer, facturée, remboursée, rejetée) en lecture seule ; en cas de rejet, une tâche de relance du client apparaît dans « Crédits à recouvrer ».

### 6.4 Paiement en 2 parties
Deux lignes de paiement maximum : mode + montant chacune. La seconde est préremplie avec le reste. Chaque ligne mobile money demande la référence de transaction de l'opérateur (saisie ou collée) et le numéro payeur. Si le total ne couvre pas la part client : « Mettre le reste en crédit » (soumis aux règles de crédit) ou continuer à saisir. Ne pas confondre avec le tiers payant, géré automatiquement dès qu'un assuré est sélectionné.

### 6.5 Réservation par QR
Voir §5.5. Après chargement, le parcours est identique à une vente normale (assurance et paiement compris).

### 6.6 Crédit client
- Un crédit est une créance liée à une vente, jamais un montant libre.
- Écran « Crédits à recouvrer » (dans Clients et Assurances) : liste par client, âge de la dette, bouton « Encaisser » (montant, mode, référence) qui crée un encaissement rattaché au crédit et met à jour le solde ; reçu d'encaissement.
- Le périmètre de la carte « Solde crédit » (crédits de la session, de la caissière ou de toute la pharmacie) est un point à confirmer (§13). Par défaut : tous les crédits ouverts de la pharmacie visibles par la caissière.
- Relance : bouton « Rappeler par WhatsApp » qui ouvre un message prérempli (le client n'a qu'à l'envoyer), aucune relance automatique sans accord de la pharmacie.

### 6.7 Cas bloquants et exceptions
- **Produit périmé** : modale rouge, ajout impossible, événement journalisé.
- **Lot proche de la péremption** : avertissement orange, vente possible.
- **Rupture / stock insuffisant** : refus avec stock disponible affiché.
- **Produit sur ordonnance** : champs ordonnance obligatoires.
- **Prix absent ou taux de TVA absent sur la fiche** : vente du produit refusée, message pour prévenir le pharmacien.
- **Paiement mobile money en échec** : la vente reste « en attente de paiement » (récupérable), pas d'impression de reçu.
- **Annulation / retour** : la caissière envoie une demande avec motif ; le pharmacien valide ; une fois la session clôturée, la correction passe par un **avoir** (jamais par modification).

### 6.8 Sorties et entrées de caisse
Mouvements manuels hors vente (petite dépense, remise au coffre, appoint de monnaie) : motif obligatoire, montant, validation selon paramètre. Ils entrent dans le solde théorique (règle 7).

### 6.9 Fin de service
1. Bouton « Fin de service » : les nouvelles ventes sont verrouillées.
2. Contrôles : aucune vente en attente de paiement, **file hors ligne vide** (sinon clôture refusée avec la liste).
3. Comptage des espèces (grille de coupures), montant du **fond laissé en caisse**, montant **remis au coffre** (enregistré comme sortie).
4. Affichage : solde théorique, espèces comptées, écart, détail par mode de paiement, total des ventes, ventes assurées (part assureur / part client), crédits créés, annulations.
5. Mobile money : par opérateur, la caissière confirme le total constaté sur le relevé ; écart distinct.
6. Si |écart| > seuil : justificatif obligatoire (texte, photo selon paramètre) ; au-dessus du seuil de validation : le responsable doit valider.
7. Clôture : la session est **verrouillée** (plus aucune modification), rapport de fin de service généré (impression et PDF), notification au responsable, entrée au journal d'audit.

### 6.10 Historique des ventes
Liste paginée des ventes de la caissière, filtres (date, statut, mode, client, assurance), recherche par numéro. Détail d'une vente : lignes, paiements, ventilation TVA, assurance, statut. Réimpression marquée « DUPLICATA ». Bouton « Demander une annulation ». États vide / chargement / erreur.

### 6.11 Rapports & Performances
Période au choix (session, jour, semaine, mois). Cartes et graphiques depuis les données réelles (règle 11). Comparaison à la moyenne de la pharmacie seulement si le paramètre l'autorise et si le nombre de caissiers atteint le minimum paramétré. Aucune prime, aucun classement humiliant.

### 6.12 Profil
Informations de la caissière, poste habituel, changement de mot de passe, code PIN de verrouillage rapide, préférences d'affichage (taille du texte), journal de ses dernières connexions. **Aucune donnée de paie ou de cotisation.**

### 6.13 Verrouillage et Déconnexion
Verrouillage automatique après inactivité (code PIN pour reprendre). Déconnexion refusée tant qu'il reste une file hors ligne non synchronisée (avertissement clair).

---

## 7. Fonctionnement hors ligne
- Détection de la connexion avec indicateur permanent.
- Hors ligne : consultation du catalogue en cache (instantané du stock horodaté), ventes en **espèces** et à crédit autorisé uniquement. Le mobile money n'est pas vérifiable hors ligne : il est refusé, ou accepté en « à rapprocher » avec référence saisie, selon paramètre.
- Chaque vente porte une **clé d'idempotence** (UUID) générée à la création ; rejouer la synchronisation ne crée jamais de doublon.
- Numérotation hors ligne : numéros provisoires par poste, numéro définitif attribué par le serveur à la synchronisation.
- Synchronisation automatique au retour du réseau, en ordre, avec reprise après échec ; conflits (stock insuffisant à la synchro, lot périmé entre-temps) listés pour décision du pharmacien, jamais effacés.

---

## 8. Notifications et alertes
Panneau de la cloche, regroupées et marquées lues : réservation à retirer, plafond d'un assuré atteint ou proche, lot proche de la péremption sur un produit du panier, synchronisation échouée, demande d'annulation traitée, écart d'ouverture, rappel de clôture. Aucune notification promotionnelle.

---

## 9. Sécurité, audit, conformité
- Authentification existante (Supabase) ; politiques RLS par pharmacie et par rôle ; la caissière n'écrit que dans sa session ouverte.
- **Journal d'audit en ajout seul**, chaîné par empreinte SHA-256 : ouverture/clôture, ventes, annulations, remises, écarts, accès refusés, créations d'assurés, impressions de duplicata. Aucune modification ni suppression possible.
- Ventes et paiements **immuables** après clôture de la session.
- Validation des entrées côté serveur (zod), contrôle d'idempotence, limitation de débit.
- Les photos de cartes et d'ordonnances sont des données personnelles de santé : stockage privé, accès limité aux rôles autorisés, durée de conservation paramétrable, jamais dans les URL publiques.
- Écritures comptables : générées de façon asynchrone vers le module Comptable (ventes de marchandises, clients, caisse, TVA collectée). **Comptes exacts à faire valider par le comptable** ; la caissière n'y a aucun accès.

---

## 10. Critères d'acceptation
1. Aucune valeur monétaire ou de paramètre en dur dans le code (hors fichiers de test).
2. Les fonctions de calcul ont des tests unitaires qui passent (voir Partie 2).
3. Un compte neuf affiche des écrans vides propres, sans chiffre fictif.
4. Vente simple, vente assurée, paiement en 2 parties, réservation QR, crédit, fin de service : chaque parcours terminé de bout en bout avec des données réelles de test saisies par l'équipe.
5. Rejouer deux fois la même vente (même clé) ne crée qu'une vente.
6. Après clôture, toute tentative de modification est refusée et journalisée.
7. Aucun accès aux données d'une autre pharmacie (test RLS).
8. Rendu correct sur mobile (360 px), tablette (768 px) et poste fixe (≥ 1280 px).

---

## 11. Design (reprise fidèle de la maquette)

**Répartition visuelle visée** : environ 50 % vert, 30 % blanc et gris très clair, 20 % jaune canari.

### Couleurs
Valeurs **approximatives relevées sur la maquette**, à confirmer à la pipette. Si le projet possède déjà des jetons de couleur (ex. `naxa-green`, `btn-canari`), **les réutiliser** et ne rien recréer.
- Vert NAXA principal (barre latérale, boutons) : ≈ `#16803C`
- Vert profond (bande d'en-tête) : ≈ `#14532D`
- Jaune canari (actif, accents, pointillés) : ≈ `#FFE01B`
- Jaune pâle (encarts, surlignages) : ≈ `#FFF8C9`
- Fond de page : ≈ `#F3F4F2` ; cartes : blanc
- Texte principal : ≈ `#111827` ; secondaire : ≈ `#6B7280`
- Succès `#16A34A`, avertissement `#F59E0B`, danger `#DC2626` (états uniquement)
- Règle de contraste : jamais de texte jaune sur fond blanc ; texte vert foncé sur jaune ; texte blanc sur vert.

### Typographie
Sans-serif géométrique, très grasse pour les montants (reprendre la police NAXA existante, sinon Inter ou Poppins). Échelle fluide : montants KPI ≈ 28 à 40 px, « FCFA » à ≈ 60 % de la taille du montant, titres de section 24 à 28 px, texte 14 à 16 px, minimum 12 px.

### Formes et espacements
Cartes : fond blanc, rayon ≈ 16 px, ombre douce (≈ 0 4px 12px, opacité 8 %). Boutons : rayon 8 à 12 px, hauteur tactile minimale 44 px. Boutons de paiement : contour fin, actif = fond jaune + contour vert 2 px. Bouton principal « Imprimer le reçu » : pleine largeur, vert, liseré jaune. Cadre du scanner : bordure pointillée jaune 2 px, rayon 12 px, fond gris très clair. Espacement de base 8 px (multiples de 8).

### Gabarit poste fixe (≥ 1280 px)
- Barre latérale 280 px (vert), en-tête 64 à 80 px (vert profond) sur laquelle la rangée de 4 cartes chevauche, 4 colonnes égales, écart 24 px.
- Sous les cartes : colonne principale (≈ 2/3) = Encaissement → Liste → Modes de paiement → bouton ; colonne droite (≈ 1/3) = Réservation + astuce. Le panier reste visible (sticky).

### Tablette (≈ 768 px)
Barre latérale repliée en icônes (80 px), cartes en 2 × 2, colonne Réservation sous l'encaissement ou dans un panneau coulissant.

### Mobile (≈ 360 px)
Menu burger, cartes en défilement horizontal ou 2 × 2 compactes, Encaissement plein écran, **barre d'action fixe en bas** (Total + « Valider »), scanner par caméra, Réservation dans un onglet. Zones tactiles ≥ 44 px, pas de défilement horizontal de la page.

### États à dessiner pour chaque écran
Chargement (squelettes), vide, erreur (message + action « Réessayer »), hors ligne, session non ouverte, succès (toast), confirmation destructive (modale).

### Accessibilité
Contrastes AA, focus visible, tout faisable au clavier, libellés explicites, annonces d'erreurs pour lecteurs d'écran, tailles de texte ajustables, montants lus avec « francs CFA ».

### Reçu (thermique 58/80 mm)
En-tête pharmacie, numéro, date/heure, caissière, lignes, ventilation TVA, total, part assureur / part client si assuré, modes de paiement, monnaie rendue, pied de page paramétrable, mention « DUPLICATA » si réimpression. Mise en page prévue pour l'impression CSS, évolutive vers ESC/POS.

---

## 12. Livrables attendus de la part du développeur
Migrations SQL, politiques RLS, fonctions de calcul testées, routes serveur, écrans (tableau de bord, encaissement, clients et assurances, historique, prise/fin de service, rapports, profil), file hors ligne, impression du reçu, tests, rapport final listant ce qui est fait, partiel ou non fait, sans embellir.

---

## 13. Points à confirmer par le promoteur
1. Carte « Montant remboursé » : lignes « Principal » et « Remboursement » = part assureur / part client ? (hypothèse retenue)
2. « OM Cash » = Orange Money ? Faut-il en plus un bouton Espèces (ajouté par défaut) ?
3. Périmètre de « Solde crédit » : session, caissière ou pharmacie entière ?
4. Seuil d'écart, validation du responsable, crédit autorisé à la caissière, remises : valeurs à saisir par la pharmacie.
5. Largeur d'imprimante des pharmacies pilotes (58 ou 80 mm).

---

## Statut de référence

Ce document est la référence fonctionnelle et visuelle de travail pour le compte Caissière NAXA ERP. Il ne constitue pas une preuve que les fonctionnalités sont déjà implémentées ou validées. Les points du §13 restent à confirmer. Toute implémentation doit d'abord être confrontée à l'existant et respecter les règles de sécurité, les paramètres de la pharmacie et l'interdiction de livraison.


---

# PARTIE 2B — CODE DE BASE : API, HORS LIGNE, JETONS ET COMPOSANTS

Version reçue le 20/10/2026. Cette partie complète la Partie 2A dans le même cahier des charges. Elle décrit le code de référence transmis et ses contrats ; les extraits restent une base à adapter après audit du dépôt, pas une affirmation d'implémentation existante. Les tables, helpers, composants, jetons et règles déjà présents dans NAXA priment. Ne pas créer de doublons. Montants en entiers FCFA ; aucun montant métier en dur.

## 14. Fichiers concernés

- \`app/api/caisse/ventes/route.ts\` — API de vente avec recalcul et contrôles côté serveur.
- \`lib/caisse/hors-ligne.ts\` — file locale IndexedDB fondée sur \`idb-keyval\`.
- \`tailwind.config.ts\` — ajout non destructif des jetons de design.
- \`app/(erp)/caisse/page.tsx\` — tableau de bord serveur.
- \`components/caisse/CarteKpi.tsx\` — carte KPI et format d'affichage.
- \`components/caisse/Encaissement.tsx\` — panier, scan et règlement.
- \`components/caisse/ReservationQr.tsx\` — lecture du QR de réservation.

## 15. Contrat de l'API de vente

La route \`POST /api/caisse/ventes\` doit suivre ce parcours, sans faire confiance aux prix, taux de TVA, totaux, montants de prise en charge ou droits envoyés par le navigateur.

1. Authentifier l'utilisateur avec le helper Supabase serveur existant. Répondre 401 \`NON_AUTHENTIFIE\` si absent.
2. Valider le corps avec Zod : clé d'idempotence UUID, session UUID, lignes non vides, quantités entières positives, remises entières non négatives, paiements positifs (maximum deux), identifiants et champs facultatifs valides. Répondre 422 \`DONNEES_INVALIDES\` si invalide.
3. Vérifier que la session appartient au caissier authentifié et est ouverte. Sinon, 409 \`SESSION_NON_OUVERTE\`.
4. Lire les paramètres de la pharmacie, les produits, prix TTC, taux de TVA et exigences d'ordonnance depuis la base. Rejeter les produits inconnus, les prix/TVA absents et les ordonnances obligatoires manquantes.
5. Refuser les remises si les paramètres de pharmacie ne les autorisent pas. Toute limite de remise doit être vérifiée côté serveur selon la configuration effective.
6. Pour l'assurance, vérifier l'assuré et l'assureur actifs, la validité de la carte, les exigences de photo et d'ordonnance, les exclusions de produits, le taux applicable et le plafond restant. Calculer la prise en charge côté serveur ; demander une confirmation explicite en cas de dépassement du plafond.
7. Charger les modes de paiement actifs de la pharmacie. Déduire le type du mode en base, jamais du client. Vérifier les règles de surplus et de monnaie rendue ; le surplus non remboursable doit être rejeté.
8. Si un reste à payer subsiste, vérifier l'autorisation de crédit, l'identification du client et le plafond configuré, en tenant compte du crédit déjà ouvert.
9. Appeler la RPC transactionnelle \`enregistrer_vente\` pour persister la vente, ses lignes, ses paiements, son éventuel crédit et l'audit. Les contrôles de stock, de session, d'idempotence, de pharmacie et de droits doivent être exécutés dans la transaction côté base, pas uniquement avant la RPC.
10. Traduire les erreurs métier en codes stables : notamment \`STOCK_INSUFFISANT\`, \`SESSION_CLOTUREE\`, \`PLAFOND_ATTEINT\`, \`CREDIT_REFUSE\`, \`MODE_INCONNU\`. Ne pas exposer les messages SQL internes dans les réponses 500.
11. Si la vente vient du Marketplace, vérifier l'éligibilité de la réservation et son appartenance à la pharmacie, puis faire évoluer son état de façon atomique selon le workflow Marketplace existant. Le retrait est en pharmacie uniquement ; aucune livraison.

Le corps de référence comporte notamment : \`cleIdempotence\`, \`sessionId\`, \`clientId\`, \`assureId\`, \`ordonnanceNumero\`, \`prescripteur\`, \`photoCartePath\`, \`reservationId\`, \`horsLigne\`, \`confirmerDepassementPlafond\`, les lignes (\`produitId\`, \`lotId\`, \`quantite\`, \`remiseTtc\`) et les paiements (\`modeCode\`, \`montant\`, références opérateur/payeur et indicateur de rapprochement).

## 16. File de ventes hors ligne

Le module \`lib/caisse/hors-ligne.ts\` utilise \`idb-keyval\` pour enregistrer une vente avec une clé d'idempotence UUID et les champs \`essais\`, \`statut\` (\`en_attente\` ou \`rejetee\`) et \`erreur\` facultatif.

- \`nouvelleCle()\` crée une clé d'idempotence.
- \`empiler(payload)\` enregistre une vente dans la file locale.
- \`tailleFile()\` compte les entrées dont la clé commence par \`file-vente:\`.
- \`synchroniser()\` transmet les ventes en attente à \`/api/caisse/ventes\` avec \`horsLigne: true\`.
- Une réponse réussie retire l'entrée locale ; un rejet 4xx conserve la vente marquée \`rejetee\` pour résolution manuelle ; une réponse 5xx incrémente les essais et interrompt la boucle pour réessayer plus tard ; une erreur réseau interrompt la synchronisation.
- Déclencher la synchronisation sur l'événement \`online\` et périodiquement lorsque la file n'est pas vide, avec une fréquence définie par la configuration et sans boucle agressive.
- Les ventes hors ligne ne doivent pas contourner les contrôles serveur, les prix actuels, les droits, la disponibilité du stock ou l'idempotence. Les conflits de prix/stock à la reconnexion doivent être signalés à l'utilisateur plutôt que transformés silencieusement.
- En mode hors ligne, limiter les moyens aux modes expressément autorisés par la pharmacie. Le Mobile Money reste bloqué ou en rapprochement uniquement si une politique officiellement validée l'autorise. Ne jamais déclarer un paiement électronique réussi sur la seule base d'une saisie locale.
- Ne pas vider le panier avant que la vente soit durablement enregistrée ou que sa mise en file locale ait réussi. Signaler clairement les ventes en attente et rejetées.

## 17. Jetons Tailwind — extension non destructive

Les jetons proposés dans la base de référence, à comparer à ceux déjà existants et à confirmer sur la maquette, sont :

- \`naxa.green\`: \`#16803C\`
- \`naxa.deep\`: \`#14532D\`
- \`naxa.canari\`: \`#FFE01B\`
- \`naxa.canariSoft\`: \`#FFF8C9\`
- \`naxa.page\`: \`#F3F4F2\`
- rayon \`carte\`: \`16px\`
- ombre \`carte\`: \`0 4px 12px rgba(0,0,0,0.08)\`

Ces valeurs sont approximatives. Fusionner dans \`theme.extend\` sans écraser la configuration existante ni modifier les jetons NAXA déjà utilisés ailleurs.

## 18. Tableau de bord caissière

Le composant serveur \`app/(erp)/caisse/page.tsx\` authentifie l'utilisateur, recherche sa session ouverte, puis lit \`v_kpi_session\` et \`v_credit_restant\`. Sans session, afficher un état vide clair et une action pour ouvrir le service ; ne pas simuler de session ni de chiffres.

Les quatre cartes de référence sont :
1. Solde du compte / solde théorique espèces.
2. Encaissement.
3. Montant remboursé, avec les sous-montants « Principal » et « Remboursement » à confirmer par le promoteur avant de leur attribuer une signification comptable.
4. Solde crédit, dont le périmètre (session, caissière ou pharmacie) reste à confirmer.

Le tableau de bord affiche ensuite l'encaissement comptoir et le module de scan QR de réservation lorsque la session est ouverte. Protéger la page contre l'absence d'utilisateur et contre une session inexistante ; ne pas utiliser d'assertion non vérifiée \`user!.id\`.

## 19. Carte KPI et montant

\`components/caisse/CarteKpi.tsx\` expose une carte accessible avec titre, contenu, pied de carte facultatif, icône facultative et état de chargement. L'état de chargement utilise un squelette visuel. Le composant \`Montant\` affiche un montant entier avec le séparateur français et l'unité FCFA. Pour une cohérence globale, privilégier le helper partagé \`formaterFcfa\` de la Partie 2A plutôt qu'un formatage divergent.

## 20. Encaissement comptoir

\`components/caisse/Encaissement.tsx\` est un composant client utilisant les fonctions pures de \`lib/caisse/calculs.ts\` pour l'aperçu du panier, la TVA, la prise en charge et le règlement.

- Le panier est piloté par un reducer : ajouter un produit, modifier la quantité, retirer une ligne, vider le panier.
- Le champ de scan interroge \`/api/caisse/produits?code=...\`. Cette API reste à construire et doit retourner les informations du produit, un lot admissible selon FEFO, le stock et l'alerte de péremption configurée.
- Les prix, la TVA, les remises autorisées, les plafonds et les totaux affichés par le client ne remplacent jamais le recalcul serveur.
- Charger les modes de paiement actifs depuis la base ; la structure vide fournie est seulement un emplacement à implémenter, pas une interface terminée.
- Afficher le total, la ventilation TVA, les parts assureur/client, la monnaie à rendre et les erreurs de règlement.
- La validation envoie une clé d'idempotence, la session, les lignes et les paiements à l'API de vente.
- Après un échec réseau, ne mettre en file que si le navigateur est réellement hors ligne et si l'écriture locale réussit ; en cas d'erreur serveur ou métier, conserver le panier et afficher l'erreur au lieu de le vider.
- Le contrôle du plafond, la sélection de l'assuré, les confirmations, les modes de paiement, les messages d'erreur, les notifications et l'impression du reçu restent à intégrer proprement au parcours complet.

## 21. Lecture du QR de réservation

\`components/caisse/ReservationQr.tsx\` utilise la caméra arrière et \`BarcodeDetector\` lorsqu'il est disponible, avec un repli obligatoire par bibliothèque compatible (par exemple \`@zxing/browser\`) et saisie manuelle du code si la caméra n'est pas disponible. Le flux caméra doit être arrêté au démontage et les refus d'autorisation / erreurs de périphérique doivent être gérés.

Le code lu appelle \`/api/caisse/reservations?code=...&session=...\`. Cette API reste à construire. Elle doit vérifier côté serveur l'identité, la pharmacie et la session, l'état de la réservation, son expiration et son éligibilité. La réponse doit charger les articles dans le parcours d'encaissement existant, pas afficher simplement « Réservation chargée » sans effet. Le passage à « Retirée » doit être atomique et ne doit intervenir qu'au moment prévu par le workflow validé, après paiement et remise effective au client. Aucune livraison.

## 22. Travail restant identifié dans la Partie 2B

- Construire/adopter \`/api/caisse/produits\` : recherche produit, lot FEFO, stock réel, péremption et contrôles de pharmacie.
- Construire/adopter \`/api/caisse/reservations\` : consultation Marketplace et transition atomique après paiement/retrait.
- Compléter ouverture et clôture de service avec RPC transactionnelles, réconciliation, justificatifs configurés, file hors ligne vide et ventes en attente.
- Compléter les parcours Clients et Assurances, Historique, Rapports, Profil, reçus et duplicatas.
- Ajouter les tests API, fonctions pures, idempotence, concurrence, permissions/RLS, session clôturée, stock, assurance, crédit, hors ligne et réservation.
- Vérifier l'accessibilité, le rendu mobile, l'impression thermique 58/80 mm et les états vides/chargement/erreur.

## 23. Audit de contradiction obligatoire avant implémentation

Le code fourni est une base de travail, non un code prêt à appliquer tel quel. L'audit doit notamment résoudre les contradictions suivantes avant de le déployer :

1. **Idempotence et sécurité RPC :** \`enregistrer_vente(p jsonb)\` ne doit pas accepter sans contrôle des identifiants de pharmacie, de session ou de caissier fournis dans le JSON. Vérifier l'utilisateur et les permissions dans la base, et ne retourner un doublon qu'après avoir contrôlé que la vente appartient au périmètre autorisé.
2. **Paiements et crédit :** le code de référence transmet \`reg.resteAPayer\` comme crédit généré dès qu'un reste existe. Cela n'est acceptable que si le crédit est autorisé et explicitement choisi/accepté ; un paiement partiel ne doit pas créer automatiquement un crédit sans consentement.
3. **Validation du règlement :** les modes de paiement et leur type doivent être reliés à la pharmacie et validés dans la transaction. Le montant total reçu, la monnaie rendue, la somme des paiements et le reste à payer doivent respecter une seule règle comptable cohérente, y compris pour une vente assurée.
4. **Remises :** contrôler le maximum configuré \`remise_caissiere_max_bp\` et le périmètre de la remise, pas seulement le booléen d'autorisation.
5. **Stock et lots :** les contrôles FEFO, lot non périmé, quantité disponible et décrément atomique doivent être réellement exécutés ; les commentaires d'adaptation ne protègent pas le stock.
6. **Assurance :** vérifier que l'assuré, son client, l'assureur, les produits et la pharmacie sont liés entre eux. Le plafond doit être réservé/consommé sans course concurrente ; la vue seule ne suffit pas à garantir le plafond sous concurrence.
7. **RLS et écriture serveur :** les politiques doivent être complètes pour toutes les tables concernées. Toute élévation de privilèges doit rester côté serveur avec contrôles explicites et aucun accès direct client non autorisé.
8. **Journal d'audit :** vérifier les droits d'insertion, la concurrence du chaînage et les protections contre les modifications/suppressions, y compris par les rôles privilégiés opérationnels.
9. **Ventes annulées et remboursement :** les vues de KPI, les paiements, la monnaie rendue et les mouvements de caisse doivent refléter correctement les annulations et remboursements sans supprimer l'historique comptable.
10. **Hors ligne :** une vente stockée localement ne garantit ni le prix ni le stock au moment de la synchronisation. L'interface doit conserver les rejets et éviter les pertes de panier ; idempotence et réconciliation sont obligatoires.
11. **Réservations Marketplace :** réutiliser le workflow et les RPC existants pour éviter une seconde déduction de stock ou un double paiement. Le paiement d'une réservation déjà payé ne doit pas être reproduit.
12. **Schéma existant :** la migration de la Partie 2A ne doit pas être appliquée avant comparaison avec les tables, vues, RPC, index, contraintes, triggers et helpers existants. Toute évolution éventuelle doit être additive et adaptée à la base réelle.

## 24. Statut de cette partie

La Partie 2B est reçue comme référence fonctionnelle et technique. La présence de cette annexe dans le cahier des charges ne signifie pas que les fichiers cités sont créés, que les tests sont verts, que la migration est appliquée ou que Supabase Production est modifiée. Les règles de la Partie 1 et les décisions à confirmer restent prioritaires. Aucun déploiement n'est autorisé par cette intégration documentaire.


---

# PARTIE 3 — PROMPT D'EXÉCUTION : CONSTRUCTION DU COMPTE CAISSIÈRE

Version reçue le 20/10/2026. Cette partie définit la méthode d'audit, l'ordre de construction, les points de contrôle et les conditions d'acceptation. Elle complète les Parties 1 et 2B ; la Partie 2A (migration SQL, calculs purs et formatage) fait également partie des annexes de référence. Le prompt ci-dessous est conservé comme consigne de travail. Il ne constitue pas une preuve que les étapes ont été exécutées.

## 25. Prompt maître à appliquer

**Mode d'emploi :** joindre ou fournir à la suite les trois documents : (1) cahier des charges et design, (2) code de base de données et calculs (Partie 2A), (3) code API et composants (Partie 2B). Si une annexe est absente ou illisible, le signaler immédiatement et ne pas commencer le chantier.

### Rôle

Tu es l'ingénieur full-stack senior chargé de construire le COMPTE CAISSIÈRE de l'ERP pharmacie NAXA (Cameroun). Stack : Next.js (App Router), Supabase (Postgres + RLS), Tailwind, TypeScript. Tu travailles dans le dépôt NAXA existant.

### Documents faisant foi

- **Annexe 1 :** cahier des charges + design (parcours, règles de calcul, écrans, états, sécurité, questions ouvertes).
- **Annexe 2A :** code de base de données et calculs (migration SQL, fonctions de calcul pures et tests).
- **Annexe 2B :** code API et interface (route serveur, file hors ligne, jetons, composants).

Ces annexes font foi. Si une annexe est illisible ou absente, ARRÊTE-TOI et dis-le avant toute autre action.

### Maquette décrite — écran « Tableau de bord »

La maquette n'est pas directement accessible ; sa description fait référence. Poste fixe, ratio 3:2 :

- Barre latérale gauche verte, logo NAXA (gélule jaune inclinée + mot NAXA blanc), sept entrées à icônes contour blanches : Tableau de bord (actif, fond jaune canari et texte vert foncé), Clients et Assurances, Historique des ventes, Prise / fin de service, Rapports & Performances, Profil, Déconnexion. Numéro de version en bas.
- Bande d'en-tête vert profond : logo NAXA, « Pharmacy ERP • Tableau de bord », puis pastille jaune avec initiales, nom utilisateur et cloche avec point jaune.
- Quatre cartes blanches arrondies avec ombre douce chevauchant la bande verte : « Solde du compte » (montant et mini-courbe verte), « Encaissement » (montant et icône billet jaune), « Montant remboursé » (deux montants empilés, sous-texte « Principal + Remboursement » sur jaune pâle), « Solde crédit » (montant et petit signe ondulé jaune). Montants grands et gras, FCFA en plus petit.
- Colonne centrale : « Encaissement », sous-titre « Vente comptoir • Scanner le produit » ; cadre jaune pointillé avec icône scanner, « Scanner de code-barres », « Scanner ou saisir le code produit », bouton vert « Activer le scanner » ; carte « Liste des médicaments » avec lignes produit/quantité/montant et corbeille ; total en gros ; modes de paiement issus de la configuration (maquette : MoMo, OM Cash, paiement en deux parties) ; grand bouton vert pour valider et imprimer le reçu.
- Colonne droite : « Réservation », « Scanner QR pour récupérer la commande réservée », vue caméra, pastille jaune « QR Scanner actif », état « En attente de scan… », encart jaune pâle avec l'astuce de présenter le QR client.
- Répartition visuelle indicative : environ 50 % vert, 30 % blanc/gris très clair, 20 % jaune canari.

Tous chiffres et noms de produits de la maquette sont des exemples : ils ne doivent pas être ajoutés au code de production, sauf dans des tests explicitement marqués « valeurs de test ».

### Règles absolues

1. Aucun montant, taux, plafond, seuil, nom de produit ou donnée de démonstration en dur. Tout vient de la base ou des paramètres. Une option non configurée reste désactivée ou demande une configuration explicite.
2. L'argent est stocké et calculé en entiers FCFA, les taux en points de base. Tous les calculs passent par lib/caisse/calculs.ts (fonctions pures + tests). Les écrans n'ont pas de logique de calcul métier. Le serveur recalcule tout avant l'enregistrement.
3. Ne pas inventer de règle métier, taux de TVA, taux d'assurance ou compte comptable. Inscrire les informations manquantes dans « Questions ouvertes » et continuer avec une option configurable désactivée par défaut.
4. La CNPS n'est pas une cotisation salariale dans ce compte. Elle peut apparaître uniquement comme assureur d'un client, comme tout assureur configuré. Aucune donnée de paie.
5. Aucune vérification en ligne auprès des assureurs : vérification dans la base locale de la pharmacie, avec preuve (photo de carte, ordonnance) selon les paramètres.
6. Réservation et retrait en boutique uniquement ; aucune livraison.
7. Ne réduire aucune fonctionnalité des annexes. Améliorer est permis ; supprimer une exigence ne l'est pas.
8. Ne jamais simuler un résultat ni annoncer « terminé » sans vérification. Distinguer systématiquement : **FAIT et vérifié / FAIT non vérifié / NON FAIT**.

### Avant tout code : audit obligatoire

Le compte caissier existe déjà partiellement. Commencer par :

a. Lister les pages, composants, tables, politiques RLS, API et helpers déjà présents pour la caisse, les produits, le stock, les ventes et les clients.  
b. Pour chacun, indiquer : **à réutiliser / à adapter / à remplacer**, avec justification.  
c. Mapper les noms des annexes 2A et 2B sur les noms réels du dépôt ; ne créer aucun doublon de table.  
d. Vérifier les jetons de design existants (couleurs, police, composants) et les réutiliser.  
e. Remettre ce rapport et **attendre mon accord avant de continuer**.

### Ordre de construction — une étape à la fois

1. Migration SQL + RLS + journal d'audit chaîné + verrou après clôture. Tester l'isolation RLS : un utilisateur d'une pharmacie ne voit aucune donnée d'une autre.
2. lib/caisse : calculs, formatage et tests unitaires. Tous les tests doivent passer.
3. API : produits (lot admissible le plus proche de la péremption, stock), ventes (annexe 2B), réservations (lecture Marketplace et statut « retirée » après paiement).
4. Ouverture et fin de service : comptage par coupures, fond laissé, remise au coffre, écart, justificatif, validation du responsable, verrouillage et rapport imprimable.
5. Tableau de bord + Encaissement + Réservation QR + modes de paiement + paiement en deux parties + reçu 58/80 mm.
6. Clients et Assurances : clients, assurés avec photo de carte, plafond calculé, crédits à recouvrer, encaissement de crédit.
7. Historique des ventes : filtres, duplicata, demande d'annulation ; Rapports & Performances avec indicateursRapport.
8. Profil, verrouillage par PIN, notifications.
9. Hors ligne : file IndexedDB, idempotence, synchronisation et liste des conflits.
10. Finition responsive (360 / 768 / ≥1280 px), accessibilité, états vide / chargement / erreur / hors ligne.

### Protocole obligatoire pour chaque étape

- Présenter un plan bref avant de coder.
- Fournir le code complet des fichiers modifiés, sans extraits incomplets.
- Lancer build, lint, typecheck et tests ; rapporter uniquement les résultats réellement obtenus.
- Terminer par un rapport : fait et vérifié / fait non vérifié / non fait / questions ouvertes.
- Attendre mon « OK » avant de passer à l'étape suivante.

### Méthode de travail et garde-fous

- Deux branches maximum ; un commit par étape ; pas de pull request selon ce prompt.
- Lancer la CI une seule fois à la fin d'un bloc d'étapes cohérent, pas à chaque commit.
- Aucune fusion vers la branche principale et aucun déploiement, sauf accord explicite de l'utilisateur formulé exactement ainsi : **« OUI, DÉPLOIE »**.
- Aucun secret ni aucune clé dans le code, les logs ou les réponses.
- L'intégration documentaire dans main n'autorise ni déploiement, ni migration en production. Les consignes opérationnelles les plus récentes de l'utilisateur prévalent lorsqu'elles sont plus restrictives ; ici, le travail doit rester sans déploiement.

### Critères d'acceptation

1. Zéro valeur métier codée en dur hors tests explicitement marqués comme tels.
2. Tests de calcul verts.
3. Compte neuf : écrans vides propres, sans faux chiffres.
4. Parcours complets avec données réelles saisies par l'équipe : vente simple, vente assurée, paiement en deux parties, réservation QR, crédit et fin de service.
5. Rejouer une vente avec la même clé d'idempotence ne crée qu'une vente.
6. Après clôture, toute modification est refusée et journalisée.
7. Isolation entre pharmacies démontrée par un test.
8. Rendu correct sur mobile, tablette et poste fixe.

### Questions ouvertes à poser au promoteur — ne pas trancher seul

1. Carte « Montant remboursé » : « Principal » et « Remboursement » signifient-ils part assureur et part client ?
2. « OM Cash » signifie-t-il Orange Money ? Faut-il conserver aussi le bouton Espèces ?
3. « Solde crédit » concerne-t-il la session, la caissière ou toute la pharmacie ?
4. Quels seuils d'écart, règles de validation du responsable, autorisations de crédit et limites de remise doivent être configurés par la pharmacie ?
5. Quelle largeur d'imprimante utilisent les pharmacies pilotes : 58 ou 80 mm ?

### Instruction de démarrage

Commencer par confirmer que les trois annexes ont été lues, en résumant en dix lignes ce qui sera construit, puis lancer l'audit décrit ci-dessus. **Ne pas coder avant d'avoir remis le rapport d'audit et reçu l'accord.**

## 26. Statut de la Partie 3

Cette partie est intégrée comme prompt de référence dans le document. Son intégration ne signifie pas que l'audit a été exécuté, que les étapes de développement sont achevées ou que les tests sont verts. Les questions ouvertes restent ouvertes jusqu'à décision explicite du promoteur. Aucun déploiement ni changement de Supabase Production n'est autorisé par ce document.


---

## Mise à jour métier — arbitrages du fondateur du 02/11/2026

Les décisions ci-dessous remplacent les points correspondants du §13 et priment sur les hypothèses antérieures. Référence complète : docs/DECISIONS_METIER_FONDATEUR.md.

1. **Montant remboursé :** « Principal » = part assureur ; « Remboursement » = part Client.
2. **Moyens de paiement :** remplacer « OM Cash » par « Orange Money » ; conserver « Espèces » comme moyen distinct.
3. **Solde crédit :** afficher uniquement les crédits de la session.
4. **Paramètres financiers :** NAXA fournit les valeurs de référence ; elles sont personnalisables par pharmacie. Les plafonds et délais de crédit sont configurés par le Promoteur depuis son compte. Aucun montant absent de la configuration ne doit être inventé.
5. **Imprimante :** largeur 58 mm ou 80 mm demeure à confirmer pour les pharmacies concernées.

**Crédit au comptoir :** les rôles autorisés et les limites sont consignés dans le registre fondateur. La portée de la mention « Promoteur uniquement » dans la réponse multiple reste à clarifier avant d'appliquer une règle d'approbation ambiguë.
