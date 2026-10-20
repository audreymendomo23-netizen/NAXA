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
