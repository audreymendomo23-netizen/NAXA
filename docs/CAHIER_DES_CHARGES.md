# NAXA : Cahier des charges v3.7 + prompt associé

Mise à jour du 06/10/2026 (**v3.7** : v3.6 + alignement sur l'existant réel du 06/10/2026 (§ 2bis : Pilotage 360°, hiérarchie N0 à N3, privilèges, convention Promoteur, réseau multi-pharmacie, CA canonique) + profil **Responsable (RES)** complet (§ 4.4, § 14.7, droits § 4.2, circuits § 7A, questions 21 et 22 du § 12) ; **v3.6** : v3.5 + douze fonctionnalités F64 à F75 décrites pour tous les profils concernés (rappel de lot, ordonnancier, trésorerie et dépenses, valeur du stock et coût d'achat, fiche client et crédit, équipe, plusieurs sites, fournisseurs avancés, hors-médicaments, qualité et sécurité, communication client, prévision saisonnière) ; v3.5 : v3.3 + paiement de l'abonnement par l'API Mobile Money (F63), scan code-barres, parcours ordonnance + vente, coffre ordonnances, registre des stupéfiants, validation par empreinte, sauvegardes, mode dégradé, et un atlas § 13 qui décrit chaque fonctionnalité par un cas de figure, le parcours de la caissière et les éléments de chaque écran), construite à partir du README et du STATUT du 5 octobre 2026 et des décisions du fondateur.

**Registre des décisions métier postérieures :** les arbitrages explicites du fondateur consignés dans [docs/DECISIONS_METIER_FONDATEUR.md](DECISIONS_METIER_FONDATEUR.md) priment sur les questions ouvertes, propositions ou hypothèses antérieures du présent cahier lorsqu'ils traitent du même sujet. Le cahier v3.7 reste la description fonctionnelle de référence pour les exigences non contredites. Une décision métier confirmée ne vaut pas preuve d'implémentation ou de test.

**Légende**
- **[EXISTANT]** : en production ou décidé, conservé tel quel. Ne pas modifier, ne pas réécrire.
- **[NOUVEAU]** : à ajouter, en migrations et modules additifs.
- **[À ARBITRER]** : entre en conflit avec l'existant. Aucune construction avant décision explicite du fondateur.

---

## 1. Vision [NOUVEAU]

NAXA devient d'abord un **logiciel de gestion et de caisse pour pharmacies (ERP)**. La **marketplace** reste un module : elle lit le stock réel de l'ERP pour que le client trouve un médicament près de lui, avec prix et disponibilité fiables, y compris en garde.

- **Produit principal** : l'ERP pharmacie. **Module** : la marketplace.
- **Client final** : gratuit. **Revenu** : abonnement des pharmacies.
- **Source de vérité unique** : le stock saisi en pharmacie alimente la marketplace, sans double saisie.
- **Pilotage 360°** : chaque donnée collectée doit servir une décision (promoteur, réseau NAXA).
- **Ordre de travail décidé** : 1) terminer le chantier **Qualité** en cours, 2) construire l'**ERP**, 3) **mise en service terrain**, 4) **paiement en ligne du client**, 5) **extensions de l'officine (phase K)**. Le **paiement de l'abonnement des pharmacies par l'API Mobile Money** est décidé et intégré à la phase H (F63).

---

## 2. Socle existant [EXISTANT, conservé]

**Stack** : Next.js 14, Supabase, Tailwind, PWA, offre gratuite ; Vercel, projet `naxa` (alias `naxa-opal.vercel.app`, `naxa-naxa3.vercel.app`).

**Fonctionnalités en place** : recherche et scan d'ordonnance (OCR, import ou caméra), accès protégé par connexion pour les actions opérationnelles, bandeau « Les plus recherchés » (noms traduits), classement prix/distance/temps, circulation, réservation 3 h, WhatsApp, paiement guidé par code marchand, reçu imprimable, panneau pharmacie, espace admin, fiches produits, panier, PWA.

**Comptes et sécurité** : connexion username/mot de passe, récupération par OTP e-mail, création en 3 étapes, Google OAuth, validation d'âge avec 3 politiques obligatoires, RLS sur les tables publiques, contrôles serveur du panier, écriture des fiches produits réservée à l'administration, documents juridiques (Conditions, Confidentialité, Sécurité), numéros d'urgence 1510 / 119 / 1511.

**Pharmacies** : création par l'équipe NAXA via `/admin`. **Promoteur** = compte parent (rôles `promoteur` et `caisse`, `parent_profile_id`, `actif` sur `profiles`) ; il crée, bloque et réactive ses **Caisses**. Une pharmacie = un stock, une identité, les mêmes réservations. Un blocage de caisse ne désactive pas la pharmacie. Statut « De garde » via la RPC `set_garde`.

**Stock** : quantité modifiable depuis `/pharmacie`, import Excel/CSV (nom/désignation, prix, quantité, dosage/conditionnement, péremption), file locale IndexedDB hors connexion avec badge, synchronisation au retour réseau et résolution de conflit sur `updated_at`.

**Données** : 3 pharmacies de démonstration à Yaoundé (3 lignes de stock chacune). Aucune photo de médicament fournie (droits d'usage à vérifier).

**Production** : commit `5ad95ce30dd43b3c140e0048606c81dd5143e490`, déploiement `dpl_CcFGneLjZjBSLQ32Mccww6vjwAD6`, READY. Score de consolidation PR #21 : 100 %.

---

## 2bis. Alignement sur l'existant réel (README et STATUT du 06/10/2026) [EXISTANT, PRIME sur les fiches]

Depuis la v3.5, un chantier **Pilotage 360°** a été construit sur la branche `feat/pharmacie-validite-pilotage` (PR #24 vers `consolidation`). **En cas de contradiction entre une fiche (§ 13, § 14) et ce paragraphe, ce paragraphe prime ; en cas de doute, le dépôt prime.** Production : `main` inchangé depuis la PR #21 ; migrations Supabase 009 à 012 appliquées ; 013 et suivantes présentes sur la branche, non appliquées.

1. **Hiérarchie et rôles.** N0 Admin NAXA, N1 Promoteur, N2 Responsable, N3 Caisse. `role_type` reste `client`, `pharmacie`, `admin`, `promoteur`, `caisse` ; **Responsable est une fonction interne + un niveau, jamais une valeur de `role_type`**. Les rôles du cahier **assistant, magasinier, comptable** n'existent pas dans les architectures actuelles : ils seront des **fonctions internes portées par des bundles de privilèges**, jamais de nouvelles valeurs `role_type`. Décision fondateur du 02/11/2026 : le Responsable est autorisé uniquement dans PARENTS_AINES_CADETS et HYBRIDE ; les fonctions peuvent être attribuées simultanément, mais un seul espace est le contexte actif à la fois. Le périmètre peut couvrir plusieurs pharmacies du même Promoteur par affectations explicites. Les validations déléguées sont possibles dans les plafonds fixés par le Promoteur. Voir docs/DECISIONS_METIER_FONDATEUR.md.
2. **Droits.** La matrice du § 4.2 devient des bundles de privilèges ajoutés au catalogue `naxa_privileges` et appliqués par `naxa_has_privilege` / `naxa_can` (droit effectif = identité × niveau × accréditation × périmètre × pharmacie × convention × statut × objet × opération). Un privilège au catalogue n'est pas une fonctionnalité construite.
3. **Architectures.** ORPHELIN (1 Caisse), PARENTS_ENFANTS (jusqu'à 5 Caisses), PARENTS_AINES_CADETS (jusqu'à 5 Responsables + 5 Caisses), HYBRIDE (bundles personnalisés). Elles sont **attribuées par NAXA** selon la convention ; le Promoteur délègue seulement les privilèges délégables.
4. **Abonnement.** **1 Promoteur = 1 convention = 1 tarif = 1 abonnement**, valable pour toutes ses pharmacies (tables `conventions_promoteurs`, `abonnements_promoteurs`, `abonnement_promoteur_paiements`). Rappel J-5 ; **impayé = blocage de toutes les pharmacies du Promoteur** ; réactivation par NAXA après règlement. 30 000 FCFA n'est qu'une référence catalogue. Les fiches F44, F45, F63 et leurs profils s'entendent **au niveau du Promoteur**. Reste à décider (phase H) : réactivation automatique ou non après paiement par API.
5. **Réseau multi-pharmacie.** `promoteur_pharmacies` existe déjà. F70 se limite à ce qui manque : transferts entre pharmacies, vue groupe, centrale d'achat, sur ce socle. Une pharmacie = un stock, plusieurs Caisses = une seule pharmacie.
6. **Une seule chaîne KPI.** Donnée source → règle KPI → `stats_pilotage_scope(p_jours)` → BI → dashboard → rapport/export. Les fiches F35 à F39 s'y appuient et ne créent aucun second moteur. **CA canonique** : `v_reservations_ca` (réservation `payee` ou `retiree`, une seule vente). Les ventes de caisse (F14) s'y raccordent par une vue canonique unique avec lien vente-réservation et test anti-double-comptage.
7. **Lots et coûts.** `stocks_lots` existe : F09 l'étend, sans table concurrente. `stocks` = quantité et prix de vente ; `stocks_couts` = coût d'achat interne courant (jamais visible du client). F67 fige le coût sur chaque ligne de vente, ce qui rendra possible la marge historique, **interdite tant que ce coût n'est pas figé**.
8. **Sessions et audit.** 4 sessions simultanées par compte, 5e refusée, aucune expulsion automatique ; un journal d'audit des sessions existe : F42 l'étend, ne le remplace pas.
9. **Espace Client.** `/client` (Mon suivi, Mes médicaments achetés, vues `client_achats`, `reservation_events`) existe : F50 et F52 l'étendent sans le dupliquer. Le client ne reçoit aucune donnée interne.
10. **Devise.** Technique XAF ; affichage FCFA.
11. **Migrations.** Numéroter à la suite de la plus haute migration réelle du dépôt, sans renuméroter ni combler. Les validations SQL actuelles sont des transactions suivies de ROLLBACK, pas des applications Production.
12. **Ordre fusionné.** Terminer le Pilotage (Promoteur, Admin, Performance, Sécurité et activité réseau, Direction 360°), puis Qualité, puis les phases B à H adaptées (la phase E est réduite : le pilotage 360° est déjà couvert), puis I, J, K.

---

## 3. Gouvernance et conflits

**[EXISTANT] Règles conservées**
- Aucune suppression ni réécriture destructive ; migrations **additives** uniquement.
- Aucun secret serveur exposé ; aucune auto-inscription pharmacie ; aucun numéro WhatsApp côté client.
- Aucun déploiement Preview volontaire.
- Production seulement après évaluation complète (100 %) et autorisation explicite du fondateur.
- Le prompt maître et le cahier des charges font foi.

**Décisions prises sur les conflits (06/10/2026)**

| Sujet | Existant | Décision |
|---|---|---|
| Ordre des chantiers | Prochain jalon : mise en service terrain, puis Qualité | **Qualité d'abord**, puis ERP, puis mise en service terrain |
| Livraison | « Aucune livraison » | Fonction **créée et configurable**, **désactivée par défaut**, activée pharmacie par pharmacie selon sa situation (livreur propre, responsabilité à la pharmacie). Là où elle n'est pas activée, la règle « aucune livraison » continue de s'appliquer |
| Durée de réservation | 3 h | **Réglable par pharmacie de 1 à 3 h**, défaut 3 h conservé |
| Infrastructure | 100 % offre gratuite | **Rester 100 % gratuit tant que possible.** Chercher des solutions dans les limites gratuites (sauvegardes, rapports, e-mails, tâches planifiées). Si une limite bloque, proposer une solution gratuite, signaler le risque, ne rien souscrire de payant sans accord du fondateur |
| Rôles | Promoteur, Caisse | Cinq rôles : Promoteur = titulaire, Caisse = caissier, + assistant, magasinier, comptable ; **+ Responsable (niveau N2, § 2bis, § 4.4)** |
| Test avant terrain | Pharmacies pilotes réelles | Recette sur données simulées dans chaque phase ERP, avant la mise en service terrain |
| Paiement de l'abonnement | Prix saisi à la main, paiements notés à la main | **Paiement par l'API Mobile Money** (décision du fondateur, 06/10/2026), intégré à la phase H (F63). Opérateur, compte marchand et frais à confirmer ; saisie manuelle conservée en secours |
| Extensions de l'officine (phase K) | Non prévues | Phase K **après le paiement en ligne (J)**, décision du fondateur (06/10/2026) |
| Plusieurs sites | Une pharmacie = un stock | **Réseau multi-pharmacie déjà existant** (`promoteur_pharmacies`) : F70 ajoute transferts, vue groupe et centrale d'achat sur ce socle, en phase K. Une pharmacie seule reste inchangée |

**[À ARBITRER] Encore ouvert**
- **Paiement en ligne du client (Mobile Money)** : **dernier chantier de l'ERP** (phase J, avant les extensions K). Partenaire et périmètre à demander au fondateur à la fin ; rien n'est choisi ni construit avant. D'ici là : espèces et paiement guidé par code marchand (existant). *Le paiement de l'**abonnement** des pharmacies est, lui, décidé : voir § 3 (décisions) et F63.*
- **MVP pilote** : envoyer sur le terrain après les phases B et C seulement (fondations + caisse + ordonnances), puis D à H. Modifie l'ordre décidé le 06/10 ; rien n'est changé avant décision du fondateur.
- **Fidélisation et rappels de renouvellement de traitement** : aucune construction tant que le cadre légal sur les données de santé n'est pas vérifié.
- **Communication client (F74) et suivi des traitements chroniques (F68)** : conservés au cahier et **mis en attente du cadre légal** par décision du fondateur (06/10/2026). F74 est en conflit avec « aucun numéro WhatsApp côté client ». Aucune construction avant la levée de cette attente.
- **Obligations légales et fiscales camerounaises** (ordonnancier, conservation, pharmacovigilance, facturation, taxes, prix réglementés) : rien n'est affirmé sans source ; chaque point est marqué « à vérifier ».

---

## 4. Rôles, droits et données

### 4.1 Rôles

| Rôle | Statut | Mission |
|---|---|---|
| Administrateur NAXA | EXISTANT | Crée la pharmacie et son Promoteur ; retire une pharmacie des recherches (seul habilité) ; support, suppression ; BI réseau ; fixe le prix de l'abonnement ; ne pilote pas les stocks |
| Promoteur (titulaire) | EXISTANT | Compte parent : gère ses comptes (créer, bloquer, réactiver), prix, validations, assurances, pilotage 360° |
| Caisse (caissier) | EXISTANT, étendu | Existant : stock, import, réservations, garde ; nouveau : vente et clôture de ses encaissements |
| Responsable | NOUVEAU (niveau N2 existant, § 2bis) | Adjoint du Promoteur : supervise l'exploitation quotidienne de sa pharmacie (Caisses, stock, demandes de premier niveau) avec des privilèges délégués |
| Pharmacien assistant | NOUVEAU | Dispensation sécurisée, validation des ordonnances |
| Magasinier | NOUVEAU | Approvisionnement, réceptions, inventaire |
| Comptable | NOUVEAU | Lecture seule et exports |
| Client | EXISTANT, enrichi | Recherche, panier, réservation, historique |

### 4.2 Matrice des droits (définie selon les bonnes pratiques)

Principes : **moindre privilège**, **séparation des tâches** (celui qui encaisse ne corrige pas seul ses opérations), **traçabilité** de toute action sensible.
Légende : ✓ autorisé · — interdit · P plafonné (plafond fixé par le promoteur) · D demande, validée par le promoteur · L lecture seule · Dé délégable : désactivé par défaut, activé par le Promoteur (§ 4.4).

| Action | Caissier | Assistant | Magasinier | Comptable | Responsable | Promoteur |
|---|---|---|---|---|---|---|
| Vendre et encaisser | ✓ | ✓ | — | — | ✓ | ✓ |
| Appliquer une remise | P | P | — | — | P | ✓ |
| Annuler une vente | D | D | — | — | D | ✓ |
| Modifier un prix de vente | — | — | — | — | D | ✓ |
| Voir les prix d'achat | — | — | ✓ | L | Dé (L) | ✓ |
| Voir marges et bénéfices | — | — | — | L | — | ✓ |
| Consulter le stock | ✓ | L | ✓ | L | ✓ | ✓ |
| Entrées de stock et import (existant) | ✓ | — | ✓ | — | ✓ | ✓ |
| Sortie exceptionnelle (casse, périmé), motif obligatoire | D | — | D | — | D | ✓ |
| Valider une ordonnance | — | ✓ | — | — | — (sauf accréditation pharmacien) | ✓ |
| Vente assurée et vérification des droits | ✓ | ✓ | — | — | ✓ | ✓ |
| Fiches assureurs, taux, plafonds | — | — | — | L | L | ✓ |
| Bordereaux et créances | — | — | — | ✓ | L | ✓ |
| Commandes fournisseurs | — | — | ✓ | L | ✓ (prépare) | ✓ (valide) |
| Inventaire | — | — | ✓ (comptage) | — | ✓ (comptage) | ✓ (valide) |
| Clôture de caisse | ✓ (la sienne) | — | — | L | ✓ (la sienne) ; L (autres Caisses) | ✓ (toutes) |
| Réservations et statut de garde (existant) | ✓ | ✓ | — | — | ✓ | ✓ |
| Exports | — | — | — | ✓ | Dé | ✓ |
| Journal d'audit | — | — | — | L | Dé (L) | ✓ |
| Gérer les comptes de la pharmacie | — | — | — | — | Dé (Caisses seulement) | ✓ |
| Déclarer un rappel de lot (clôture : promoteur seul) | D | ✓ | ✓ | — | ✓ | ✓ |
| Consulter l'ordonnancier | — | ✓ | — | — | — | ✓ |
| Dépense de petite caisse (motif et justificatif) | D | — | D | — | D | ✓ |
| Trésorerie : lecture et exports | — | — | — | L | — | ✓ |
| Fiche client et crédit (au-delà du plafond : demande) | P | P | — | L (soldes seuls) | P | ✓ |
| Planning, gardes, présences | L (le sien) | L (le sien) | L (le sien) | L | Dé (gère) | ✓ |
| Donner un avis sur une demande d'une Caisse (le Promoteur décide) | — | — | — | — | ✓ | ✓ |

Chaque ligne est testée écran par écran et appliquée côté serveur (RLS), pas seulement dans l'interface. Tout compte enfant appartient à une seule pharmacie.

### 4.3 Données visibles par rôle

| Rôle | Voit | Ne voit pas |
|---|---|---|
| Caissier | Ses ventes et clôtures, stock (quantités, prix de vente), assureurs pour la vente | Prix d'achat, marges, ventes des autres caisses |
| Assistant | Ordonnances à valider, stock en lecture, alertes de sécurité | Finances, marges |
| Magasinier | Fournisseurs, commandes, lots, prix d'achat, valeur du stock | Ventes détaillées, clients, ordonnances |
| Comptable | Journal des ventes, créances, TVA, bordereaux (lecture) | **Données de santé nominatives** (ordonnances, historique patients) |
| Responsable | Ventes et clôtures de toutes les Caisses de **son périmètre**, stock, lots et péremptions, commandes et réceptions, alertes, tâches ; prix d'achat si délégué | Abonnement et prix négocié, marges et bénéfices, trésorerie, coffre ordonnances, données de santé nominatives, pharmacies hors périmètre, modification des réglages |
| Promoteur | Toutes les données de **sa** pharmacie | Les autres pharmacies |
| Administrateur NAXA | Données agrégées et anonymisées du réseau, fiche et abonnement des pharmacies ; accès support tracé et limité | Données de santé nominatives, pilotage des stocks |
| Client | Ses propres données, son historique | Toute donnée interne d'une pharmacie |

### 4.4 Le Responsable (N2) : cadre et délégation [NOUVEAU, DÉCISIONS FONDATEUR 02/11/2026]

Construit à partir du § 2bis (niveau N2, bundles de privilèges, architectures) et des circuits du § 7A. Les points [À ARBITRER] sont aux questions 21 et 22 (§ 12).

- **Place** : N0 Admin NAXA, N1 Promoteur, N2 Responsable, N3 Caisse. Fonction interne + niveau, jamais une valeur de `role_type`. Disponible uniquement dans PARENTS_AINES_CADETS (jusqu'à 5 Responsables + 5 Caisses) et HYBRIDE.
- **Création** : par le Promoteur (F02-PRO), dans la limite de l'architecture attribuée par NAXA. Le Promoteur peut définir un périmètre couvrant plusieurs de ses pharmacies, par affectations explicites et séparées, et active les privilèges délégables.
- **Droit effectif** : identité × niveau N2 × accréditation × périmètre × pharmacie × convention × statut × objet × opération (§ 2bis, point 2), appliqué côté serveur.
- **Délégable (Dé)** : désactivé par défaut, activé par le Promoteur : voir les prix d'achat (lecture), exports, journal d'audit (lecture), créer ou bloquer des Caisses, gérer le planning.
- **Jamais délégable** : abonnement, convention et paiement ; création, blocage ou modification d'un autre Responsable ou du Promoteur ; réglages sensibles (plafonds, conservation, délai de verrouillage) ; modification d'un prix de vente sans demande ; clôture d'un rappel de lot ; coffre ordonnances et ordonnancier ; marges, bénéfices et trésorerie.
- **Séparation des tâches** : il ne valide jamais ses propres demandes et ne donne pas d'avis dessus : elles vont au Promoteur. Il ne clôture que sa propre caisse.
- **Décision déléguée** : le Promoteur peut autoriser le Responsable à valider les annulations, remises, sorties exceptionnelles, ajustements d'inventaire et commandes dans des plafonds définis par le Promoteur. Hors délégation ou au-delà du plafond, la décision revient au Promoteur. La séparation des tâches et l'interdiction d'approuver ses propres demandes restent applicables.
- **Ordonnances** : il ne valide que s'il porte l'accréditation Pharmacien ; le Promoteur propose l'accréditation, puis l'Administrateur NAXA vérifie les justificatifs et la valide. Sans accréditation, accès refusé côté serveur au contenu des ordonnances et au registre des stupéfiants.
- **Sessions** : 4 simultanées par compte (§ 2bis, point 8).

---

## 5. ERP pharmacie [NOUVEAU]

### 5.1 Catalogue par molécule
- Hiérarchie : **molécule (DCI + code ATC)** → présentation (dosage, forme) → marque ou générique → produit de la pharmacie → lot.
- Recherche par molécule d'abord, marques du moins cher au plus cher ; équivalents génériques en cas de rupture.
- Alimentation : export Excel d'une pharmacie ou d'un grossiste, import progressif. Chaque fiche porte sa source et sa date de mise à jour.
- Fiche client : photo, description, prix comparés entre pharmacies. **Pas de posologie** publique. Photos et textes : droits d'usage à vérifier.
- Les fiches produits existantes sont rattachées au catalogue, sans être supprimées.

### 5.2 Stock avec lots
- Entrées : fournisseur, n° de bon de livraison, date, quantité, prix d'achat, **péremption obligatoire**.
- Sorties : vente, casse, périmé, sortie exceptionnelle avec motif obligatoire ; sortie du lot qui expire en premier.
- Statuts : OK, alerte, rupture, proche de péremption (**seuil réglable par pharmacie**), périmé.
- L'import et la file hors connexion existants sont conservés et étendus aux lots.
- Les lots et péremptions ne sont jamais visibles du client.
- **Suggestion de réapprovisionnement** : calculée d'après les ventes réelles (quantité suggérée dans l'alerte de rupture).
- **Lot proche de péremption** : alerte au promoteur et au magasinier avec trois options : promotion, retour fournisseur, sortie exceptionnelle (motif, validée par le promoteur).
- **Registre des stupéfiants et psychotropes** : entrées, sorties, solde, ordonnance liée, validateur ; contrôle du solde à l'inventaire. Exigences légales camerounaises à vérifier avant la mise en service terrain.

### 5.3 Caisse
- Recherche par nom, molécule ou **code-barres** (lecteur ou caméra), panier, **remises et promotions**.
- Contrôles : stock, péremption, ordonnance requise ; générique proposé si rupture.
- Paiements : espèces (rendu de monnaie), Mobile Money (saisie manuelle de la confirmation en première étape), assurance, crédit client ou bon.
- **Ticket imprimable** ; matériel cible : ordinateur + imprimante de tickets.
- Annulation : **validée par le promoteur uniquement** (demande initiée par la caisse ou l'assistant), tracée. Retours et échanges : non retenus pour l'instant.
- **Scan de code-barres par la caméra** (sans matériel dédié), **lecteur USB accepté**, saisie manuelle en secours.
- **Caisse rapide** : raccourcis clavier, produits favoris, recherche tolérante aux fautes de frappe, **panier en attente**, écran client optionnel (total affiché).
- **Matériel mixte** : une seule application web (PWA) qui sert ordinateur + imprimante de tickets, tablette ou téléphone ; ticket en impression directe, PDF ou partage WhatsApp côté pharmacie.

### 5.4 Hors-ligne complet (indispensable dès la première version)
- Ventes, mouvements de stock et clôture enregistrés localement (IndexedDB), synchronisés au retour du réseau ; extension de la file existante.
- Aucune perte, aucun doublon (identifiants uniques générés côté appareil) ; pas de stock négatif : conflits signalés et résolus par règle (la vente est conservée, l'écart est enregistré et alerté).
- Indicateur d'état visible, horodatage fiable, reprise après coupure.
- Conception **avant** les modules de caisse : elle conditionne le schéma de données.

### 5.5 Assurances (dès la première version)
- Payeurs : **CNPS**, assurances privées (Chanas, SAAR, etc.), **crédit client / bons**.
- Fiche par assureur : taux de prise en charge, plafond, produits remboursables (import Excel), pièces à fournir, délai de dépôt, contact, créance en cours.
- **Vérification des droits** : bouton qui ouvre le portail officiel de l'assureur dans un nouvel onglet ; la caissière saisit elle-même le matricule et note le résultat (actif / inactif / non vérifié) avec date, heure et nom. **Aucun scraping, aucun contournement de captcha.** Convention d'accès officiel avec la CNPS à envisager plus tard.
- Vente assurée : part client et part assureur calculées ; la part assureur devient une **créance**.
- **Bordereaux** : PDF et Excel générés par NAXA **et** au format imposé par chaque assureur (modèle à récupérer auprès de chacun).
- Suivi : rejets de bordereau, rappels de créances anciennes, plafonds par assuré, historique des ventes par assuré.
- Données minimales conservées : matricule, statut, historique de vérification.

### 5.6 Fournisseurs, commandes, inventaire
Fiche fournisseur et dette ; commande à partir des alertes ; envoi par WhatsApp (côté pharmacie) ; statuts brouillon, envoyée, livrée partielle, livrée ; contrôle du bon de livraison. Inventaire : liste théorique, comptage, écarts, périmés, ajustement validé par le promoteur.

### 5.7 Clôture de caisse (Z)
Totaux théoriques par mode de paiement, montant compté, écart et motif obligatoire, rapport PDF au promoteur. Journée clôturée non modifiable.

### 5.8 Ordonnances
Le scan d'ordonnance côté client existe déjà et est conservé.

- **Parcours unique ordonnance + vente** : l'ordonnance est liée à la vente par un identifiant ; la vente est bloquée tant que l'ordonnance n'est pas validée. Validation par le pharmacien assistant ; **sans assistant, par le promoteur** ; rejet avec motif obligatoire.
- **Coffre ordonnances, séparé de l'espace documents (§ 7B)** : accès limité au promoteur et à l'assistant, chaque consultation tracée, durée de conservation définie (alerte avant suppression), jamais accessible au comptable ni à l'administrateur NAXA.
- **Sur appareil** : photos d'ordonnances chiffrées localement, mises en file hors-ligne, effacées après synchronisation.
- **Validation manuelle d'abord** ; aide de lecture (OCR) plus tard (phase G), toujours avec contrôle humain obligatoire.
- **Contrôle d'interactions uniquement avec une base médicale fiable sous licence.**

---

### 5.9 Compléments v3.6 [NOUVEAU]

Pans de la vie d'une officine non couverts jusque-là, décrits aux § 13 (F64 à F75) et § 14 :
- **Avant la mise en service terrain** : rappel de lot (F64), ordonnancier (F65), trésorerie et dépenses (F66), valeur du stock, coût d'achat et pertes (F67), fiche client et crédit (F68).
- **Extensions (phase K, après le paiement en ligne)** : équipe (F69), plusieurs sites (F70, pharmacie seule ou groupe), fournisseurs avancés (F71), hors-médicaments (F72), qualité et sécurité (F73), communication client (F74, en attente du cadre légal), prévision saisonnière (F75).
- Tout ce qui touche la loi ou la fiscalité camerounaises est marqué « à vérifier » ; rien n'est affirmé sans source.

---

## 6. Marketplace [EXISTANT + NOUVEAU]

- **Conservé** : recherche, classement prix/distance/temps, garde, bandeau, panier, réservation, reçu, PWA.
- **Nouveau** : recherche par molécule ou marque ; **prix comparés entre pharmacies** ; fiche produit enrichie ; **compte client et historique** ; disponibilité alimentée par le stock réel de l'ERP, avec la mention **« stock mis à jour il y a X min »** sur chaque pharmacie.
- **Réservation** : blocage du stock avec expiration automatique ; durée **réglable par pharmacie de 1 à 3 h** (défaut 3 h conservé).
- **Retrait en pharmacie** (existant) **et livraison par la pharmacie** : livraison créée et configurable, **désactivée par défaut**, activée par pharmacie ; la pharmacie assume son livreur et la responsabilité.
- **Paiement** : espèces à la remise et paiement guidé par code marchand (existant), toujours facultatif. **Mobile Money en ligne pour le client : dernier chantier de l'ERP (avant les extensions K)**, décision demandée au fondateur à la fin.
- **Bandeau « Les plus recherchés »** : automatique, **exclut les médicaments sur ordonnance** ; réglementation sur la publicité des médicaments à vérifier.
- **Assistant d'orientation (IA)** : propose des familles de produits à partir d'un symptôme, **sans diagnostic, sans posologie**, avec renvoi vers le pharmacien.

---

## 7. Pilotage 360° [NOUVEAU]

| Niveau | Contenu |
|---|---|
| Caisse | Ventes du jour, tickets, panier moyen, top produits, produits sans prix |
| Promoteur | CA jour/semaine/mois et comparaison au mois précédent, marge, bénéfice, produits rentables et dormants, performance par caisse, ventes par heure, répartition des paiements, créances assureurs, ruptures et péremptions, fidélité et rétention des clients, comparaison de prix |
| Réseau NAXA | Vue agrégée, pharmacies actives ou inactives, revenus des abonnements et impayés, couverture de stock, recherches sans résultat (demande non servie), BI et big data, Power BI en option, **indicateurs de succès produit** (ventes par jour et par pharmacie, temps moyen d'une vente, erreurs de synchronisation, adoption par caissier) |

- **Alertes** (promoteur) : ruptures et péremptions proches, écart de caisse, créance assureur ancienne, baisse inhabituelle des ventes.
- **Rapports automatiques** : notification dans l'application et e-mail en **PDF et Excel** ; fréquence **hebdomadaire, mensuelle ou au choix du promoteur**.
- Interface moderne, vivante, responsive ; tableaux de bord hiérarchisés (réseau, pharmacie, caisse).
- Chaque indicateur est relié à une action possible (commander, déstocker, relancer, former).
- Contenu des tableaux de bord par niveau : validé par le fondateur (06/10/2026).

---

## 7A. Parcours et interactions [NOUVEAU]

Le détail écran par écran de chaque fonctionnalité est dans l'atlas du **§ 13** (parcours de la caissière) et du **§ 14** (parcours du promoteur, du Responsable, de l'assistant, du magasinier, du comptable, de l'administrateur NAXA et du client).

### Parcours par rôle

| Rôle | Parcours type |
|---|---|
| **Caissier** | Connexion → rappel des réservations et du statut de garde → **vente** : recherche ou scan → contrôles (stock, péremption, ordonnance) → panier et remise (dans son plafond) → paiement (espèces, Mobile Money saisi, assurance, crédit) → ticket → stock décrémenté. **Fin de journée** : clôture de ses encaissements → écart et motif → rapport au promoteur. Une erreur de vente : **demande d'annulation** (statut « en attente ») |
| **Pharmacien assistant** | File des ordonnances → ouverture → vérification → **valider**, **rejeter** (motif) ou signaler au promoteur → la vente se débloque. Vend, demande une annulation si besoin |
| **Magasinier** | Alerte de rupture → commande en brouillon → validation du promoteur → envoi au fournisseur (WhatsApp, côté pharmacie) → **réception** : contrôle du bon de livraison contre la commande, lots et péremptions obligatoires → entrée de stock. **Inventaire** : lancer → compter → écarts → soumission au promoteur |
| **Comptable** | Journal des ventes → filtres → exports → bordereaux d'assureurs → suivi des créances et rejets → consultation du journal d'audit |
| **Responsable** | Connexion → alertes et clôtures de la veille → **demandes des Caisses** : lecture et avis → supervision des ventes et du stock → réceptions et comptage → vente ou clôture de sa propre caisse. Une erreur de sa part : **demande** au Promoteur (jamais d'auto-validation) |
| **Promoteur** | Matin : tableau de bord, alertes, clôture de la veille → **file des demandes à valider** → assurances et bordereaux → rapports → gestion des comptes et des réglages (plafond de remise, seuil de péremption, durée de réservation, livraison) |
| **Administrateur NAXA** | Création de la pharmacie et du Promoteur → prix négocié et fin d'essai → suivi de la mise en route → support (accès tracé) → BI réseau, impayés |
| **Client** | Recherche (molécule ou marque) → comparaison prix et distance → fiche produit → **réservation** → la pharmacie est prévenue → retrait (ou livraison si activée pour cette pharmacie) → paiement → reçu → historique |
| **Mise en route d'une pharmacie** | NAXA crée la pharmacie → le Promoteur crée caisses et rôles → import du catalogue et du stock → formation sur place via les comptes Caisse → essai de 14 jours |

### Circuits de validation entre rôles

| Déclencheur | Initiateur | Valide | Résultat tracé |
|---|---|---|---|
| Annulation de vente | Caissier, assistant | Promoteur | Vente annulée, stock rétabli, audit |
| Sortie exceptionnelle (casse, périmé) | Caisse, magasinier | Promoteur | Sortie enregistrée avec motif |
| Remise au-dessus du plafond | Caissier, assistant | Promoteur | Remise appliquée ou refusée |
| Ajustement d'inventaire | Magasinier | Promoteur | Stock ajusté, écarts historisés |
| Commande fournisseur | Magasinier | Promoteur | Commande envoyée |
| Demande d'une Caisse (annulation, remise, sortie) | Caissier | Responsable (avis facultatif), puis Promoteur (décision) | Avis et décision dans l'audit |
| Demande du Responsable (annulation, prix de vente, sortie, dépense, commande) | Responsable | Promoteur | Décision dans l'audit |
| Ordonnance | Caissier | Pharmacien assistant | Vente débloquée ou rejetée |
| Écart de caisse | Clôture (automatique) | Promoteur (prend connaissance) | Alerte et rapport |

- **Notification** : e-mail **et** notification dans l'application dès qu'une demande attend une validation.
- **Validation par le Promoteur** : **depuis l'application sur son téléphone, confirmée par empreinte ou visage (WebAuthn, aucune donnée biométrique stockée par NAXA)**, ou **sur place par son code personnel (PIN) à la caisse** en repli. Le PIN est propre au promoteur, journalisé, verrouillé après plusieurs essais ratés, jamais partagé.
- **Avis du Responsable** : facultatif et non bloquant, jamais sur ses propres demandes ; sans Responsable en poste, la demande va directement au Promoteur (§ 4.4).
- **Statuts** : en attente, avis donné, validée, refusée (motif obligatoire), expirée. Relance automatique d'une demande restée sans réponse.
- Toute demande et toute décision est écrite dans le journal d'audit (qui, quand, pourquoi).

---

## 7B. Documents et collaboration (équivalent « SharePoint », intégré à NAXA) [NOUVEAU]

Pas d'intégration avec Microsoft SharePoint : ces fonctions sont construites dans NAXA.

- **Espace documents par pharmacie** : rapports PDF/Excel générés, bordereaux d'assureurs, **bons de livraison** (photo ou scan), factures fournisseurs, rapports de clôture. Classement par type, date, fournisseur ou assureur ; recherche ; versions ; partage selon la matrice des droits (§ 4) ; liens internes uniquement, jamais publics ; accès tracés.
- **Collaboration** : **tâches** (assignées à un rôle ou à une personne, échéance, statut), **commentaires** sur un objet (commande, inventaire, bordereau, écart de caisse), **validations** (circuits ci-dessus), mentions, notifications app et e-mail.
- **Santé** : aucune ordonnance ni donnée patient nominative dans l'espace partagé.
- **Limites gratuites** : stockage borné ; compression des fichiers, durée de conservation définie, alerte avant saturation.

---

## 8. Offre et abonnement [NOUVEAU]

- **Prix négocié par Promoteur** (une convention, un tarif, un abonnement, valable pour toutes ses pharmacies, § 2bis), fixé **manuellement par l'administrateur NAXA dans `/admin`**. Pas de tarif unique imposé. Devise à confirmer.
- **Essai gratuit de 14 jours** pour une nouvelle pharmacie (à articuler avec la convention du Promoteur, § 2bis).
- **Suivi d'abonnement** (côté NAXA) : prix convenu, date de début, fin d'essai, échéances, paiements reçus, impayés, historique des changements de prix (tracé).
- **Paiement de l'abonnement par l'API Mobile Money [NOUVEAU, décidé]** : le promoteur paie depuis l'application (demande de paiement envoyée à son téléphone, confirmation chez l'opérateur) ; la confirmation de l'opérateur (notification signée) marque l'échéance payée, génère le reçu et calcule l'échéance suivante ; rappels avant échéance ; rapprochement quotidien ; **saisie manuelle de secours** par l'administrateur. En cas d'impayé, la règle existante s'applique : blocage de toutes les pharmacies du Promoteur ; la réactivation après paiement par API reste à décider (question 13, § 2bis). Voir F63.
- **Services négociés** par pharmacie et listés sur sa fiche : formation sur place par NAXA, support WhatsApp, reprise des données de l'ancien logiciel, site WordPress gratuit, conception de visibilité (1 flyer par semaine + flyers des jours spéciaux, créés par l'équipe NAXA).
- **Risque à piloter** : ces services sont du travail humain récurrent pour un revenu fixe. Prévoir des modèles de flyers réutilisables, un plafond de retouches et un suivi du temps passé par pharmacie.
- Flyers : vérifier les règles sur la publicité des médicaments avant production en série.
- Benchmark des logiciels d'officine à faire pour guider la négociation.

---

## 9. Données, conformité, sécurité

- **Données de santé** : l'historique d'achats de médicaments est sensible. Consentement explicite, accès limité au client, durée de conservation, minimisation ; cadre légal camerounais à vérifier. Documents juridiques existants à mettre à jour selon le comportement réel.
- **Sauvegardes automatiques** et **verrouillage automatique de la session** : indispensables. Sauvegarde : export quotidien chiffré envoyé au promoteur, export manuel à tout moment, test de restauration trimestriel, dans les limites gratuites.
- **Mode dégradé en cas de panne** : carnet papier puis saisie rétroactive marquée « saisie différée » (heure réelle), contrôlée par le promoteur à la clôture.
- **Journal d'audit** interne conservé même s'il n'est pas exposé : tout mouvement de stock, prix, annulation et accès sensible y est tracé (qui, quand, pourquoi).
- **Validation sensible du promoteur par empreinte ou visage (WebAuthn)** sur son téléphone, PIN en repli. **Double authentification de connexion** : toujours non retenue pour l'instant (question ouverte 6).
- RLS sur toutes les nouvelles tables ; isolation par pharmacie ; secrets jamais exposés côté client.
- Sources de données (catalogue, photos, base médicale) : licences vérifiées ; pas de scraping de sites tiers.

---

## 10. Modèle de données : delta additif [NOUVEAU]

Migrations numérotées à la suite des existantes, sans modification destructive des tables en place (`stocks`, `profiles`, réservations, fiches produits).

- **Catalogue** : molécules, présentations, produits catalogue (lien avec les fiches existantes).
- **Stock** : lots, mouvements de stock.
- **Ventes** : ventes, lignes, paiements, clôtures de caisse, remises.
- **Assurances** : assureurs, règles de prise en charge, produits remboursables, créances, bordereaux, rejets, vérifications de droits.
- **Achats** : fournisseurs, commandes, réceptions, inventaires.
- **Pilotage** : alertes, rapports planifiés, indicateurs agrégés.
- **Transverse** : journal d'audit, file de synchronisation, rôles supplémentaires, comptes clients enrichis, paramètres par pharmacie (durée de réservation, seuil de péremption), abonnements (prix négocié, début, fin d'essai, paiements, impayés, services inclus).
- **Options** : livraisons (configurables, désactivées par défaut), flyers et visibilité.
- **Ajouts v3.4** : ordonnances (coffre, liens vente-ordonnance, validations), registre des stupéfiants, paniers en attente, demandes de validation (statuts, décisions), clés d'authentification WebAuthn, sauvegardes (journal des exports), réglages de la pharmacie (délai de verrouillage, durée de conservation des ordonnances, plafond de remise).
- **Paiement d'abonnement** : demandes de paiement, transactions Mobile Money (référence opérateur, statut, montant), notifications reçues de l'opérateur (avec signature vérifiée), reçus, relances, rapprochements quotidiens.
- **Ajouts v3.6** : rappels de lot (avis, lots mis en quarantaine, ventes concernées, clôture), ordonnancier (numéro d'ordre continu), mouvements de trésorerie et dépenses (justificatifs), coût moyen pondéré, historique des prix d'achat, pertes, fiches clients et crédit client (plafonds, règlements), planning, gardes, présences, transferts entre sites et groupes de pharmacies (facultatifs), retours, avoirs et litiges fournisseurs, catégories et services hors médicaments, déclarations qualité, relevés de température, consentements de communication, saisonnalité des ventes.

---

## 11. Feuille de route

Ordre décidé : **Qualité → ERP (phases A à H) → mise en service terrain → paiement en ligne → extensions de l'officine (K)**. Chaque phase : évaluation complète avant Production, autorisation explicite du fondateur.

| Phase | Contenu | Critère de réussite |
|---|---|---|
| **Q. Chantier Qualité (en cours)** | Terminer le chantier Qualité de la feuille de route du prompt maître ; périmètre exact établi par l'état des lieux de l'autre IA | Évaluation 100 % ; autorisation du fondateur |
| **A. Audit ERP** | État des lieux en lecture seule : fait et testé / fait non testé / absent ; limites de l'offre gratuite ; jeu de données simulées | Rapport validé |
| **B. Fondations ERP** | Catalogue molécule/ATC, lots, journal d'audit, rôles supplémentaires, **architecture hors-ligne**, sauvegardes quotidiennes, FR/EN et mode léger, réglages de la pharmacie, cadre commun d'écran, **notion facultative de groupe de pharmacies (migration additive)** | Stock et droits cohérents ; migrations additives appliquées |
| **C. Caisse** | Vente, scan code-barres, caisse rapide, remises, ticket, clôture Z, ventes hors-ligne, circuits de validation (demande, empreinte WebAuthn, PIN, notifications), parcours ordonnance + vente, coffre ordonnances, **ordonnancier (F65)**, registre des stupéfiants, mode dégradé | Journée simulée complète, hors-ligne puis synchronisée, écart nul |
| **D. Assurances** | Fiches, calcul des parts, créances, bordereaux (génériques et formats assureurs), suivi des rejets, **fiche client et crédit (F68)** | Bordereau correct sur cas types (plafond, produit non remboursé) |
| **E. Pilotage 360° et achats** | Achats (fournisseurs, commandes, réceptions, inventaire, suggestion de réapprovisionnement), alertes de péremption, tableaux de bord, alertes, rapports e-mail PDF/Excel, **rappel de lot (F64), trésorerie et dépenses (F66), valeur du stock et coût d'achat (F67)**, indicateurs de succès, espace documents et collaboration (tâches, commentaires), dans les limites gratuites | Alertes déclenchées sur données simulées ; rapports reçus |
| **F. Marketplace enrichie** | Comparaison de prix, compte client et historique, stock réel, durée de réservation par pharmacie, livraison configurable (désactivée par défaut) | Disponibilité affichée = stock de caisse |
| **G. IA** | Scan de bons de livraison, prédiction de rupture, assistant d'orientation | Précision mesurée, garde-fous médicaux validés |
| **H. Offre et visibilité** | Site WordPress, flyers modèles, essai de 14 jours, onboarding, **paiement de l'abonnement par l'API Mobile Money (F63)** | Pharmacie opérationnelle en un temps défini ; abonnement payable et rapproché automatiquement (essai sandbox complet, puis opérateur réel) |
| **I. Mise en service terrain** *(existant)* | 3 à 5 pharmacies pilotes, comptes, import de stocks réels, formation, validation sur données réelles | Parcours complet validé sur données réelles |
| **J. Paiement en ligne du client** | **Dernier chantier de l'ERP (avant K).** Décision à demander au fondateur (partenaire, périmètre) avant toute construction | Décision prise, puis évaluation 100 % |
| **K. Extensions de l'officine** (après J) | Équipe (F69), plusieurs sites (F70 : pharmacie seule ou groupe), fournisseurs avancés (F71), hors-médicaments (F72), qualité et sécurité (F73), communication client (F74, en attente du cadre légal), prévision saisonnière (F75) | Évaluation 100 % de chaque fiche ; autorisation du fondateur |

**Correction v3.4** : les achats (§ 5.6) n'avaient pas de phase ; ils sont rattachés à la phase E. **[À ARBITRER] MVP pilote** : voir § 3.

---

## 12. Questions ouvertes

**État des arbitrages au 02/11/2026 :** les questions historiques relatives au Responsable (Q21–Q22), à la double authentification de connexion Promoteur (Q6), à l'accréditation Pharmacien (Q8), aux architectures/périmètres et à la délégation, au crédit, aux règles de caisse, aux sources du catalogue et au paiement d'abonnement sont désormais traitées dans le registre du fondateur. Ne pas les redemander comme questions ouvertes. Seuls les résiduels de la section G du registre restent à préciser, en plus des sujets réglementaires, de conservation et de déploiement terrain non tranchés.

1. **Paiement en ligne du client** : partenaire et périmètre, à demander au fondateur à la fin (phase J).
2. Périmètre exact du chantier Qualité restant, à confirmer par l'autre IA.
3. Source du catalogue médical, licences et photos.
4. Devise de l'abonnement ; services inclus négociés pharmacie par pharmacie (flyers, WordPress) : qui les produit à l'échelle ?
5. Stockage des documents dans les limites gratuites : taille maximale et durée de conservation.
6. Double authentification de **connexion** du promoteur : oui ou non ? (la validation sensible par empreinte WebAuthn est déjà prévue.)
7. Cadre légal camerounais : stupéfiants et psychotropes (registre), conservation des ordonnances, données de santé.
8. Pharmacie sans pharmacien assistant : le promoteur valide les ordonnances (proposition retenue ; à confirmer).
9. MVP pilote : terrain après les phases B et C, oui ou non ?
10. Fidélisation et rappels de traitement : à lancer après vérification du cadre légal ?
11. **Abonnement Mobile Money** : quel(s) opérateur(s) (MTN MoMo, Orange Money ou agrégateur) ? compte marchand NAXA, accès à l'API et **frais de transaction** (qui les supporte, compatible avec le 100 % gratuit ?).
12. Échéance et mode de paiement : mensuel, trimestriel, payé d'avance ? devise (voir aussi 4) ?
13. **Règle d'impayé** : délai de grâce, relances, conséquences éventuelles (retrait des recherches, lecture seule). Règle existante (05/10/2026) : à l'échéance impayée, toutes les pharmacies du Promoteur sont bloquées ; seule la réactivation automatique après paiement par API reste à décider (§ 2bis).
14. **Plusieurs sites** : décidé (06/10/2026) ; le réseau existe (`promoteur_pharmacies`). Reste à préciser avant la phase K : centrale d'achat et facturation d'un réseau.
15. **Ordonnancier** : contenu exigé, numérotation et durée de conservation au Cameroun (à vérifier, avec Q7).
16. **Fiscalité et facturation** : taxes, mentions obligatoires, déclarations locales, prix réglementés et coefficients de marge des produits hors médicaments (à vérifier).
17. **Pharmacovigilance** : obligations de déclaration et filière de retour des médicaments non utilisés (à vérifier).
18. **Rappel de lot** : source officielle des avis de retrait à suivre (autorité, fabricant, grossiste) et délai attendu.
19. **Crédit client** : plafond par défaut, durée maximale, relances ; suivi des traitements chroniques seulement après le cadre légal.
20. **Phase K** : décidée après J (06/10/2026).
21. **Responsable : validation déléguée — RÉSOLUE le 02/11/2026.** Le Promoteur peut déléguer au Responsable la validation des opérations autorisées dans des plafonds qu'il définit. Voir docs/DECISIONS_METIER_FONDATEUR.md.
22. **Responsable : architectures, périmètre et accréditation — RÉSOLUE le 02/11/2026.** PARENTS_AINES_CADETS et HYBRIDE uniquement ; plusieurs pharmacies du même Promoteur par affectations explicites ; accréditation proposée par le Promoteur, vérifiée et validée par l'Administrateur NAXA. Voir docs/DECISIONS_METIER_FONDATEUR.md.

---

## 13. Atlas des fonctionnalités : cas de figure, parcours de la caissière et éléments d'écran [NOUVEAU]

Cet atlas décrit **chaque fonctionnalité** du cahier des charges de la même façon : un **cas de figure**, le **parcours de la caissière** de bout en bout, les **éléments de chaque écran**, puis les **règles**. Quand la caissière n'est pas l'acteur principal, la fiche précise **qui agit**, **ce que la caissière voit** et **où elle revient** ; le parcours complet des autres profils est au **§ 14**. Chaque fiche porte un identifiant **Fxx** (utilisé pour la traçabilité, les tests et le score), son statut et sa phase (§ 11).

**Personnages des cas de figure** : Mme Ngo (caissière), M. Fouda (promoteur), M. Essomba (Responsable), Mlle Biya (pharmacien assistant), M. Eto (magasinier), Mme Kamga (comptable), M. Talla (client), l'administrateur NAXA.

**Une fonctionnalité est terminée seulement si** : tous les éléments d'écran listés existent ; les états chargement, vide, erreur, hors-ligne et accès refusé sont gérés ; les droits du § 4 sont appliqués côté serveur (RLS) ; l'action est tracée dans le journal d'audit ; le **cas de figure se rejoue de bout en bout en test** (données simulées) sans erreur.

### 13.0 La boucle de la caissière

Ouverture de session → **Accueil** → une action (Vente · Ordonnance · Réservation · Stock · Demande · Réception) → **retour à l'Accueil** → action suivante … → **Clôture de caisse (Z)** → verrouillage ou déconnexion → ouverture de session du lendemain. Chaque parcours ci-dessous commence à l'Accueil et s'achève par un retour à l'Accueil : la boucle recommence.

### 13.1 Cadre commun à tous les écrans (C0)

- **Barre supérieure** : logo NAXA ; nom de la pharmacie ; nom et rôle de l'utilisateur ; sélecteur de langue FR/EN ; cloche de notifications (compteur, liste, lien vers l'objet concerné) ; bouton d'aide ; bouton Verrouiller.
- **Indicateur d'état réseau** : vert « en ligne », orange « hors-ligne » (avec le nombre d'éléments en attente), bleu « synchronisation en cours », rouge « conflit à traiter » ; heure de la dernière synchronisation ; indicateur « dernière sauvegarde ».
- **Navigation** : Accueil, Vente, Ordonnances, Réservations, Stock, Mes demandes, Clôture. Les entrées interdites au rôle sont **absentes**, pas grisées.
- **États obligatoires** de chaque écran : chargement (squelette), vide (message et action proposée), erreur (message clair et bouton Réessayer), hors-ligne (ce qui reste possible), accès refusé.
- **Verrouillage automatique** après inactivité (délai réglé par le promoteur) ; reprise sans perte du panier en cours.
- **Usage** : cibles tactiles d'au moins 44 px, contrastes lisibles, usage au clavier sur ordinateur, affichage adapté ordinateur / tablette / téléphone, **mode léger** (sans images, peu de données).
- **Messages** : texte simple, sans jargon, identique en français et en anglais.

### 13.2 Fiches

#### F00. Accueil de la caissière [EXISTANT, étendu · B]
**Cas de figure.** 8 h 00, Mme Ngo vient de se connecter et prend son poste.
**Parcours de la caissière.**
1. Elle arrive sur l'Accueil.
2. Elle lit le rappel : réservations en cours, statut de garde, produits en alerte.
3. Elle choisit une action (vente, ordonnance, réservation, stock, demande, clôture).
4. À la fin de chaque action, elle revient ici.

**Éléments de l'écran.** Carte « Aujourd'hui » (ses ventes, nombre de tickets, panier moyen, **uniquement les siens**) ; bouton principal **Nouvelle vente** ; **Ordonnances en attente** (compteur) ; **Réservations** (compteur et échéance la plus proche) ; **Paniers en attente** (compteur) ; **Mon stock** ; **Mes demandes** (en attente / validées / refusées) ; **Clôturer ma caisse** ; interrupteur **De garde** (si droit) ; liste « produits en alerte » ; indicateur de dernière sauvegarde.
**Règles.** Aucune donnée d'autres caisses ; aucun prix d'achat ni marge.

#### F01. Connexion et session [EXISTANT, étendu · B]
**Cas de figure.** Mme Ngo ouvre la pharmacie ; la veille, M. Eto s'est servi du même téléphone.
**Parcours de la caissière.**
1. Elle ouvre l'application (PWA) : écran de connexion.
2. Elle saisit identifiant et mot de passe, puis appuie sur Se connecter.
3. Elle voit le rappel des réservations en cours et le statut de garde, puis arrive à l'Accueil.
4. Mot de passe oublié : lien → saisie de l'e-mail → code OTP reçu → nouveau mot de passe → retour à la connexion.
5. Après inactivité : écran de verrouillage → elle ressaisit son mot de passe → son panier est intact.
6. En fin de poste : Verrouiller ou Se déconnecter.

**Éléments de l'écran.** Logo ; champ identifiant ; champ mot de passe avec œil d'affichage ; bouton Se connecter ; lien Mot de passe oublié ; choix FR/EN ; message d'erreur générique (ne dit pas lequel est faux) ; compteur d'essais ; indicateur réseau ; liens Conditions, Confidentialité, Sécurité ; numéros d'urgence 1510 / 119 / 1511 en pied. Compte bloqué : message « compte bloqué par le promoteur » et contact.
**Règles.** Un compte enfant appartient à une seule pharmacie ; un blocage de caisse ne désactive pas la pharmacie ; chaque connexion est tracée ; délai de verrouillage réglable par le promoteur (F58).

#### F02. Gestion des comptes de la pharmacie [EXISTANT, étendu · B]
**Cas de figure.** M. Fouda recrute Mme Ngo et M. Eto et doit leur créer un compte.
**Acteur principal** : le promoteur. **Parcours de la caissière.**
1. Elle reçoit son identifiant et un mot de passe provisoire.
2. À sa première connexion, un écran lui impose de choisir son mot de passe.
3. Si M. Fouda la bloque, elle voit « compte bloqué » ; s'il la réactive, elle se reconnecte normalement.
4. Retour à l'Accueil.

**Éléments (écran du promoteur).** Liste des comptes (nom, rôle, état actif/bloqué, dernière connexion) ; bouton Créer un compte (nom, rôle parmi Responsable / caissier / assistant / magasinier / comptable, identifiant, mot de passe provisoire) ; boutons Bloquer et Réactiver ; **plafond de remise** par compte ; historique des changements.
**Règles.** Création, blocage et réactivation réservés au promoteur ; tout est tracé.

#### F03. Réservations reçues (côté pharmacie) [EXISTANT · conservé, testé en B-C]
**Cas de figure.** M. Talla réserve du paracétamol depuis la marketplace à 15 h 10.
**Parcours de la caissière.**
1. Une notification arrive ; elle ouvre l'écran Réservations.
2. Elle ouvre la réservation : produits, quantités, heure limite avec compte à rebours.
3. Elle prépare les produits et vérifie le stock réservé.
4. Elle appuie sur Prête ; le client est prévenu.
5. M. Talla arrive : elle appuie sur Remise au client, encaisse (F20) et imprime le ticket (F21).
6. Retour à l'Accueil.

**Éléments de l'écran.** Liste (prénom du client, produits, heure limite, statut : nouvelle / prête / remise / expirée) ; détail avec lignes et prix ; boutons Prête, Remise au client, Annuler la réservation (motif) ; compte à rebours ; compteur sur l'Accueil.
**Règles.** Durée réglable de 1 à 3 h par pharmacie (défaut 3 h) ; à l'expiration, le stock bloqué est libéré automatiquement ; aucun numéro WhatsApp côté client.

#### F04. Statut « De garde » [EXISTANT · conservé]
**Cas de figure.** Samedi soir, la pharmacie est de garde.
**Parcours de la caissière.**
1. Depuis l'Accueil, elle bascule l'interrupteur De garde.
2. Elle confirme.
3. La pharmacie apparaît « De garde » dans les recherches des clients.
4. Le lendemain, elle remet l'interrupteur sur arrêt.

**Éléments de l'écran.** Interrupteur ; fenêtre de confirmation ; bandeau « De garde » visible ; horodatage du changement.
**Règles.** Passe par la RPC `set_garde` ; tracé.

#### F05. Consultation et modification du stock [EXISTANT, étendu · B]
**Cas de figure.** Un client demande un sirop ; Mme Ngo vérifie s'il en reste et corrige une quantité après un comptage rapide.
**Parcours de la caissière.**
1. Depuis l'Accueil, Mon stock.
2. Recherche par nom, molécule ou scan.
3. Elle voit la ligne : quantité, prix de vente, statut.
4. Elle modifie la quantité (entrée simple) ou ouvre la ligne pour voir les lots.
5. Elle enregistre ; hors-ligne, la modification part en file (F07).
6. Retour à l'Accueil.

**Éléments de l'écran.** Barre de recherche et bouton scan ; liste (produit, dosage, forme, prix de vente, quantité, pastille de statut OK / alerte / rupture / proche de péremption / périmé) ; détail avec **lots et péremptions** (jamais visibles du client) ; bouton Modifier la quantité ; filtres par statut ; badge de file hors-ligne.
**Règles.** Elle ne voit **pas** les prix d'achat ; une sortie non liée à une vente passe par F12.

#### F06. Import Excel/CSV et assistant d'import [EXISTANT, étendu · B, H]
**Cas de figure.** À l'ouverture, M. Eto importe le catalogue Excel du grossiste (800 lignes).
**Acteur principal** : magasinier ou promoteur (la caisse a le droit d'import). **Parcours.**
1. Importer un fichier → choix du fichier.
2. Association des colonnes (nom/désignation, prix, quantité, dosage/conditionnement, péremption, lot).
3. Contrôle ligne par ligne : erreurs en rouge, avertissements en orange.
4. Rapport avant import ; correction du fichier ou des lignes ; confirmation.
5. Import ; rapport final (créées, mises à jour, rejetées).
6. La caissière voit le nouveau stock dans F05.

**Éléments de l'écran.** Zone de dépôt ; modèle de fichier téléchargeable ; tableau d'association des colonnes ; tableau de contrôle ; compteurs ; boutons Corriger, Importer, Annuler ; rapport téléchargeable.
**Règles.** Aucune écriture avant confirmation ; péremption obligatoire pour une entrée en lot ; opération tracée.

#### F07. Fonctionnement hors-ligne et synchronisation [EXISTANT, étendu · B]
**Cas de figure.** La connexion tombe 40 minutes en pleine matinée ; Mme Ngo continue de vendre.
**Parcours de la caissière.**
1. L'indicateur passe à « hors-ligne » avec un compteur.
2. Elle poursuit ventes, mouvements de stock et clôture ; chaque élément reçoit un identifiant unique créé sur l'appareil.
3. Au retour du réseau, la synchronisation démarre seule (indicateur bleu).
4. Un conflit éventuel (stock devenu négatif ailleurs) est signalé en rouge : la **vente est conservée**, l'écart est enregistré et une alerte part au promoteur.
5. L'indicateur repasse au vert ; retour à l'Accueil.

**Éléments de l'écran.** Pastille réseau ; compteur d'éléments en attente ; liste de la file (type, heure, statut) ; bouton Forcer la synchronisation ; liste des conflits avec règle appliquée ; heure fiable de chaque enregistrement.
**Règles.** Aucune perte, aucun doublon ; pas de stock négatif ; reprise après coupure ; conception **avant** les modules de caisse.

#### F08. Catalogue par molécule [NOUVEAU · B]
**Cas de figure.** Un client veut de l'amoxicilline 500 mg ; la marque habituelle est en rupture.
**Parcours de la caissière.**
1. Dans Vente ou Mon stock, elle tape « amoxicilline ».
2. La recherche affiche d'abord la molécule (DCI) et sa présentation (500 mg, gélule).
3. Elle voit les marques et génériques du moins cher au plus cher, avec leur stock.
4. Elle choisit l'équivalent disponible et l'ajoute au panier.

**Éléments de l'écran.** Résultat groupé par molécule (DCI, code ATC) → présentation (dosage, forme) → marque ou générique → produit de la pharmacie → lots ; tri par prix ; pastilles de stock ; badge « générique » ; source et date de mise à jour de la fiche.
**Règles.** Pas de posologie publique ; les fiches existantes sont rattachées, jamais supprimées ; droits des photos et textes vérifiés.

#### F09. Entrée de stock par lot [NOUVEAU · B]
**Cas de figure.** Le grossiste livre 20 cartons ; M. Eto saisit à la main une petite livraison d'urgence.
**Parcours de la caissière** (elle a le droit d'entrée de stock).
1. Mon stock → Entrée de stock.
2. Elle choisit le produit (recherche ou scan).
3. Elle saisit fournisseur, numéro de bon de livraison, date, quantité, **numéro de lot, date de péremption (obligatoire)**.
4. Elle enregistre ; le stock augmente, le lot est créé.
5. Retour à l'Accueil.

**Éléments de l'écran.** Champs fournisseur, n° de BL, date, produit, quantité, lot, péremption ; bouton Ajouter une ligne ; récapitulatif ; bouton Enregistrer.
**Règles.** Péremption manquante = refus ; le prix d'achat n'est pas affiché à la caisse ; tout mouvement est tracé.

#### F10. Statuts et alertes de stock [NOUVEAU · B]
**Cas de figure.** Il reste 4 boîtes d'un produit dont le seuil d'alerte est 10.
**Parcours de la caissière.**
1. À l'Accueil, la liste « produits en alerte » montre le produit.
2. Elle l'ouvre : statut « alerte », quantité, lots.
3. Elle prévient le magasinier (commentaire F41) ou continue de vendre.
4. En rupture, la vente propose un générique (F08).

**Éléments de l'écran.** Pastilles de statut (OK, alerte, rupture, proche de péremption, périmé) ; seuils par produit ; liste filtrable ; lien vers le commentaire.
**Règles.** Le seuil de péremption est réglable par pharmacie (F58) ; un lot périmé ne peut pas être vendu.

#### F11. Lots proches de péremption [NOUVEAU · E]
**Cas de figure.** Un sirop expire dans 45 jours ; le seuil de la pharmacie est de 60 jours.
**Acteur principal** : promoteur et magasinier. **Parcours de la caissière.**
1. L'Accueil signale le lot proche de péremption.
2. M. Fouda choisit : promotion, retour fournisseur ou sortie exceptionnelle.
3. Si promotion : au scan, le prix remisé s'applique seul, sans calcul de sa part.
4. Le lot est vendu en priorité (premier expiré, premier sorti).
5. Si retiré : sortie exceptionnelle (F12).

**Éléments de l'écran.** Liste des lots (produit, lot, péremption, quantité, jours restants) ; boutons Promotion, Retour fournisseur, Sortie ; pastille « promo » en caisse.
**Règles.** Décision du promoteur, tracée.

#### F12. Sortie exceptionnelle (casse, périmé) [NOUVEAU · C]
**Cas de figure.** Mme Ngo fait tomber une boîte de gouttes oculaires.
**Parcours de la caissière.**
1. Mon stock → produit → Sortie exceptionnelle.
2. Elle saisit la quantité et choisit le motif (casse, périmé, autre) avec une note.
3. Elle envoie la demande : statut « en attente ».
4. Le promoteur valide (F24) ; elle voit « validée » et le stock diminue.
5. Refus : elle voit le motif du refus.

**Éléments de l'écran.** Produit, lot, quantité, motif (liste), note, photo facultative ; bouton Envoyer ; statut visible dans Mes demandes.
**Règles.** Motif obligatoire ; le stock ne bouge qu'après validation ; tracé.

#### F13. Registre des stupéfiants et psychotropes [NOUVEAU · C]
**Cas de figure.** Un client présente une ordonnance pour un produit classé stupéfiant.
**Parcours de la caissière.**
1. Elle scanne le produit : message « produit réglementé, ordonnance validée obligatoire ».
2. Elle photographie l'ordonnance (F17) et demande la validation.
3. Le pharmacien valide et confirme sa responsabilité.
4. Elle encaisse ; la sortie s'inscrit au registre (date, produit, quantité, ordonnance, validateur) et le solde baisse.
5. À l'inventaire (F34), le produit est compté à part et le promoteur valide les écarts.

**Éléments de l'écran.** Bandeau « produit réglementé » ; registre (date, produit, lot, entrée, sortie, solde, ordonnance liée, validateur) ; export du registre ; alerte d'écart.
**Règles.** Pas de vente sans validation ; registre non modifiable ; exigences légales camerounaises à vérifier avant la mise en service terrain.

#### F14. Vente : recherche et scan de code-barres [NOUVEAU · C]
**Cas de figure.** À 18 h, six clients attendent ; l'un d'eux dépose quatre boîtes.
**Parcours de la caissière.**
1. Depuis l'Accueil, Nouvelle vente.
2. Elle appuie sur Scanner (caméra) ou utilise le lecteur USB.
3. Elle présente la 1re boîte : un bip confirme, le produit s'ajoute au panier avec son prix.
4. Elle répète pour les autres boîtes.
5. Pour chaque produit, le système contrôle stock, péremption et ordonnance requise ; en rupture, un générique est proposé.
6. Code illisible : elle saisit le nom ; code inconnu : elle cherche par nom et signale le produit au promoteur.
7. Elle passe au paiement (F20).

**Éléments de l'écran.** Zone caméra avec cadre de visée ; champ de recherche (nom, molécule, code) ; liste du panier (produit, quantité modifiable, prix, total de ligne) ; total ; pastilles de contrôle (stock, péremption, ordonnance) ; bouton Générique ; boutons Remise, Mettre en attente, Payer, Vider le panier ; saisie manuelle du code.
**Règles.** Le lot sorti est celui qui expire en premier ; aucune vente d'un lot périmé ; la caméra est lente sur certains vieux téléphones, d'où la saisie manuelle.

#### F15. Caisse rapide : favoris, panier en attente, écran client [NOUVEAU · C]
**Cas de figure.** Un client a trois produits au panier puis découvre qu'il a oublié sa carte d'assurance dans la voiture.
**Parcours de la caissière.**
1. Elle appuie sur Mettre en attente et donne un nom (« Client M. Talla »).
2. Elle sert le suivant avec un favori (paracétamol) d'un seul appui.
3. M. Talla revient : Paniers en attente → elle reprend son panier, intact.
4. L'écran client, s'il est branché, affiche le total pendant qu'elle scanne.
5. Elle poursuit vers le paiement.

**Éléments de l'écran.** Grille de favoris ; raccourcis clavier (ex. F2 recherche, F4 payer) ; liste des paniers en attente (nom, heure, total) ; bouton Reprendre, Supprimer ; écran client (lignes et total).
**Règles.** Un panier en attente expire en fin de journée et ne bloque pas le stock.

#### F16. Remises et promotions [NOUVEAU · C]
**Cas de figure.** Un client fidèle demande 10 % ; le plafond de Mme Ngo est 5 %.
**Parcours de la caissière.**
1. Dans le panier, elle appuie sur Remise.
2. Elle saisit 5 % : accepté, dans son plafond.
3. Pour 10 %, le système indique « au-dessus du plafond » : bouton Demander au promoteur.
4. M. Fouda valide (F24) : la remise s'applique ; refus : le prix reste inchangé.
5. Une promotion active (F11) s'applique seule au scan.

**Éléments de l'écran.** Bouton Remise ; saisie en % ou en montant ; rappel du plafond ; motif ; ligne « remise » sur le ticket ; pastille « promo ».
**Règles.** Plafond par compte réglé par le promoteur ; toute remise est tracée.

#### F17. Ordonnance + vente (parcours unique) [NOUVEAU · C]
**Cas de figure.** Un client arrive avec une ordonnance de trois médicaments dont un antibiotique.
**Parcours de la caissière.**
1. Elle scanne les produits ; l'antibiotique affiche « ordonnance requise » et **bloque l'encaissement**.
2. Elle photographie l'ordonnance avec la caméra et l'attache à la vente ; statut « en attente de validation ».
3. Le pharmacien assistant (ou le promoteur si pas d'assistant) vérifie et valide.
4. Elle reçoit « validée » ; le blocage saute.
5. Elle encaisse (F20), le ticket s'imprime, le stock baisse par lot.
6. Si l'ordonnance est rejetée, elle lit le motif et l'explique au client ; elle peut vendre le reste du panier.
7. Retour à l'Accueil.

**Éléments (côté caissière).** Bouton Ajouter une ordonnance (photo / import) ; aperçu ; statut ; lien vers la vente ; compteur « Ordonnances en attente ». **Éléments (côté validateur)** : file des ordonnances (heure, client, produits concernés) ; visionneuse zoomable ; liste des lignes avec coche ; boutons Valider, Rejeter (motif obligatoire), Signaler au promoteur ; historique.
**Règles.** Le comptable n'y accède jamais ; l'ordonnance n'est pas copiée dans l'espace documents (F40) ; aide OCR plus tard (F56), toujours avec contrôle humain ; contrôle d'interactions seulement avec une base sous licence.

#### F18. Coffre ordonnances [NOUVEAU · B-C]
**Cas de figure.** Trois mois plus tard, un client conteste une dispensation ; M. Fouda doit retrouver l'ordonnance.
**Parcours de la caissière.**
1. Sur la vente, elle voit seulement « ordonnance liée » et un identifiant, sans pouvoir ouvrir l'image.
2. M. Fouda ouvre la vente et clique l'identifiant : l'image s'affiche, la consultation est enregistrée (qui, quand).
3. Mme Kamga (comptable) voit la vente mais jamais l'ordonnance.
4. À l'échéance de conservation, l'image est supprimée automatiquement après alerte ; la vente reste dans le journal sans l'image.

**Éléments de l'écran.** Liste du coffre (date, vente liée, validateur, échéance) ; visionneuse ; journal des consultations ; alerte de suppression à venir ; réglage de la durée (F58).
**Règles.** Accès promoteur et assistant uniquement ; consultations tracées ; chiffrement ; durée définie.

#### F19. Ordonnance sans réseau [NOUVEAU · C]
**Cas de figure.** Coupure de connexion en pleine matinée ; une ordonnance arrive.
**Parcours de la caissière.**
1. L'indicateur passe à « hors-ligne ».
2. Elle photographie l'ordonnance ; elle est stockée **chiffrée** sur l'appareil.
3. Si le pharmacien est sur place, il valide directement sur le même appareil ; sinon, elle met la vente en attente (F15).
4. Au retour du réseau, la photo passe au coffre, la copie locale est effacée, l'indicateur repasse au vert.

**Éléments de l'écran.** Pastille hors-ligne ; mention « en attente de transfert » sur l'ordonnance ; confirmation « transférée et effacée de l'appareil ».
**Règles.** Aucune ordonnance en clair sur l'appareil ; effacement après synchronisation.

#### F20. Paiements [EXISTANT étendu · C]
**Cas de figure.** Un client paie 7 500 FCFA : 10 000 en espèces et il faut rendre la monnaie ; un autre paie par Mobile Money ; un troisième est assuré.
**Parcours de la caissière.**
1. Depuis le panier, Payer.
2. Elle choisit le mode : espèces, Mobile Money, assurance (F25), crédit client ou bon.
3. Espèces : elle saisit le montant remis ; le **rendu de monnaie** s'affiche.
4. Mobile Money : elle consulte la confirmation sur le téléphone de la pharmacie et saisit la référence à la main (première étape ; le paiement en ligne automatique est F57).
5. Crédit ou bon : elle choisit le client ou le bon, le montant s'inscrit à son solde.
6. Paiement mixte possible. Elle valide ; ticket (F21).

**Éléments de l'écran.** Total à payer ; boutons de mode ; saisie du montant remis ; rendu ; champ référence Mobile Money ; sélecteur client/bon ; récapitulatif de paiement mixte ; bouton Valider le paiement.
**Règles.** Paiement guidé par code marchand conservé ; aucune vente sans paiement enregistré ; tout est tracé.

#### F21. Ticket imprimable [EXISTANT étendu · C]
**Cas de figure.** Le client veut son ticket ; l'imprimante est en panne ce matin.
**Parcours de la caissière.**
1. Après le paiement, le ticket s'affiche.
2. Elle appuie sur Imprimer (imprimante de tickets) ; si pas d'imprimante : PDF ou partage WhatsApp côté pharmacie.
3. Le ticket peut être réimprimé depuis l'historique de ses ventes.
4. Retour à l'Accueil.

**Éléments de l'écran.** Aperçu du ticket (pharmacie, date, numéro, lignes, remises, total, mode de paiement, rendu, caissière) ; boutons Imprimer, PDF, WhatsApp, Nouvelle vente.
**Règles.** Pas de lot ni de péremption sur le ticket ; numéro unique créé sur l'appareil.

#### F22. Annulation de vente [NOUVEAU · C]
**Cas de figure.** Mme Ngo a encaissé deux fois le même produit.
**Parcours de la caissière.**
1. Elle ouvre la vente dans son historique et appuie sur Demander l'annulation.
2. Elle écrit le motif ; statut « en attente ».
3. M. Fouda valide (F24).
4. Elle voit « annulation validée » : la vente est annulée, le stock rétabli.
5. S'il refuse, elle lit le motif du refus.

**Éléments de l'écran.** Historique de ses ventes (date, ticket, total) ; bouton Demander l'annulation ; champ motif ; statut.
**Règles.** Elle ne peut jamais annuler seule ; tout est tracé ; retours et échanges non retenus.

#### F23. Demandes de validation et notifications [NOUVEAU · C]
**Cas de figure.** Trois demandes sont en cours : une remise, une sortie exceptionnelle, une annulation.
**Parcours de la caissière.**
1. Elle ouvre Mes demandes depuis l'Accueil.
2. Elle voit chaque demande avec son statut : en attente, validée, refusée (motif), expirée.
3. Une demande sans réponse déclenche une relance automatique au promoteur.
4. À la décision, elle reçoit une notification dans l'application.

**Éléments de l'écran.** Liste (type, date, objet, statut, décideur) ; filtres par statut ; détail avec motif ; cloche de notification.
**Règles.** Notification **e-mail et application** dès qu'une demande attend ; toute demande et décision est dans le journal d'audit.

#### F24. Validation par empreinte ou PIN [NOUVEAU · C]
**Cas de figure.** M. Fouda est dans l'arrière-boutique quand Mme Ngo demande une annulation.
**Acteur principal** : le promoteur. **Parcours de la caissière.**
1. Elle envoie la demande (F22).
2. M. Fouda reçoit la notification sur son téléphone, l'ouvre et confirme par empreinte ou visage.
3. Elle voit « validée » à l'écran.
4. Si son téléphone est indisponible, il vient à la caisse et saisit son PIN personnel.
5. Plusieurs PIN erronés : le PIN est verrouillé et il doit valider sur son téléphone.

**Éléments de l'écran.** Côté promoteur : détail de la demande, boutons Valider (empreinte) et Refuser (motif obligatoire) ; écran PIN à la caisse ; messages de verrouillage ; enregistrement de son appareil (clé d'accès).
**Règles.** Aucune donnée biométrique stockée par NAXA ; PIN propre au promoteur, journalisé, jamais partagé ; HTTPS obligatoire.

#### F25. Vente assurée et vérification des droits [NOUVEAU · D]
**Cas de figure.** Un assuré CNPS présente sa carte pour 12 000 FCFA de médicaments.
**Parcours de la caissière.**
1. Dans le paiement, elle choisit Assurance et l'assureur.
2. Elle appuie sur Vérifier les droits : le **portail officiel** s'ouvre dans un nouvel onglet.
3. Elle saisit elle-même le matricule sur le portail et note le résultat (actif / inactif / non vérifié) ; date, heure et son nom sont enregistrés.
4. Elle contrôle les produits remboursables et le plafond de l'assuré.
5. Le système calcule **part client** et **part assureur** ; elle encaisse la part client.
6. La part assureur devient une créance (F29).

**Éléments de l'écran.** Choix de l'assureur ; bouton Vérifier les droits ; champs matricule et résultat de vérification ; pièces à fournir (rappel) ; lignes remboursables marquées ; part client / part assureur ; plafond restant ; bouton Valider.
**Règles.** **Aucun scraping, aucun contournement de captcha** ; données minimales conservées (matricule, statut, historique) ; convention CNPS à étudier plus tard.

#### F26. Clôture de caisse (Z) [NOUVEAU · C]
**Cas de figure.** 19 h 00, fin de journée ; la caisse annonce 184 500 FCFA en espèces, Mme Ngo en compte 183 000.
**Parcours de la caissière.**
1. Depuis l'Accueil, Clôturer ma caisse.
2. Elle voit les totaux théoriques par mode de paiement.
3. Elle saisit le montant compté pour chaque mode.
4. Un écart de 1 500 FCFA apparaît : elle saisit le **motif obligatoire**.
5. Elle valide ; un rapport PDF part au promoteur ; la journée est verrouillée.
6. Déconnexion ; le lendemain, la boucle recommence.

**Éléments de l'écran.** Totaux théoriques (espèces, Mobile Money, assurance, crédit) ; champs « compté » ; écart calculé ; champ motif ; liste de ses ventes du jour (y compris « saisie différée ») ; bouton Clôturer ; rapport PDF.
**Règles.** Elle clôture **sa** caisse seulement ; journée clôturée non modifiable ; alerte d'écart au promoteur.

#### F27. Mode dégradé en cas de panne [NOUVEAU · C]
**Cas de figure.** L'ordinateur de caisse tombe en panne à 11 h, des clients attendent.
**Parcours de la caissière.**
1. Elle passe sur le **carnet papier** (date, heure, produit, quantité, prix, mode de paiement).
2. Elle continue de servir : aucune vente n'est perdue.
3. Dès qu'un appareil fonctionne, elle saisit les ventes avec le statut « saisie différée » et l'heure réelle.
4. M. Fouda contrôle ces ventes à la clôture.
5. L'écart éventuel apparaît à la clôture avec motif obligatoire.

**Éléments de l'écran.** Mode « saisie différée » (date et heure à saisir) ; mention « saisie différée » sur la vente ; liste de contrôle pour le promoteur ; modèle de carnet papier imprimable.
**Règles.** Procédure documentée et affichée ; la saisie différée est tracée et visible à la clôture.

#### F28. Fiches assureurs [NOUVEAU · D]
**Cas de figure.** M. Fouda signe avec une nouvelle assurance privée et doit configurer ses règles.
**Acteur principal** : le promoteur. **Parcours de la caissière.**
1. Elle ne modifie rien ; à la vente assurée (F25), elle voit la liste des assureurs configurés.
2. Elle consulte au besoin la fiche : taux, plafond, pièces à fournir, produits remboursables.
3. Retour à la vente.

**Éléments (écran du promoteur).** Liste des assureurs (CNPS, privés, crédit client/bons) ; fiche : nom, taux de prise en charge, plafond, produits remboursables (import Excel), pièces à fournir, délai de dépôt, contact, créance en cours ; boutons Créer, Modifier, Importer.
**Règles.** Caissière en lecture ; comptable en lecture ; modifications réservées au promoteur et tracées.

#### F29. Créances et bordereaux [NOUVEAU · D]
**Cas de figure.** Fin de mois : 140 ventes assurées CNPS sont à facturer.
**Acteur principal** : comptable et promoteur. **Parcours de la caissière.**
1. Elle n'intervient pas ; chaque vente assurée (F25) a déjà créé une créance.
2. Mme Kamga sélectionne l'assureur et la période, génère le bordereau (PDF, Excel, et format imposé par l'assureur).
3. Elle contrôle les lignes et dépose le bordereau.
4. La caissière peut retrouver, dans l'historique d'une vente, son statut de créance (en attente, déposée, payée, rejetée).

**Éléments de l'écran.** Filtres assureur et période ; liste des créances ; bouton Générer le bordereau ; aperçu ; export PDF et Excel ; suivi de dépôt (date) ; total par assureur.
**Règles.** Modèle de chaque assureur à récupérer auprès de lui ; le comptable ne voit aucune donnée de santé nominative.

#### F30. Rejets et rappels de créances [NOUVEAU · D]
**Cas de figure.** Un bordereau est rejeté pour une pièce manquante.
**Acteur principal** : comptable. **Parcours de la caissière.**
1. Elle reçoit, si on le lui demande (F41), une tâche « retrouver la pièce de la vente n° X ».
2. Elle complète l'information.
3. Mme Kamga redépose le bordereau.
4. Retour à l'Accueil.

**Éléments de l'écran.** Liste des rejets (assureur, motif, date) ; alerte « créance ancienne » ; plafond par assuré ; historique des ventes par assuré ; bouton Relancer.
**Règles.** Alerte automatique au promoteur sur créance ancienne.

#### F31. Fournisseurs et dettes [NOUVEAU · E]
**Cas de figure.** La pharmacie doit 450 000 FCFA à un grossiste.
**Acteur principal** : magasinier et promoteur. **Rôle de la caissière** : aucun accès à la dette ni aux prix d'achat.
**Parcours.**
1. M. Eto ouvre Fournisseurs, crée ou ouvre une fiche.
2. Il voit commandes, livraisons, factures, solde dû.
3. M. Fouda suit la dette ; Mme Kamga en lecture.

**Éléments de l'écran.** Fiche (nom, contact, conditions) ; liste des commandes ; solde dû ; documents liés (F40).
**Règles.** Les prix d'achat sont visibles du magasinier, du comptable (lecture) et du promoteur.

#### F32. Commande fournisseur et suggestion de réapprovisionnement [NOUVEAU · E]
**Cas de figure.** Le paracétamol se vend 40 boîtes par semaine et il en reste 25.
**Parcours de la caissière.**
1. Elle voit « stock bas » à la vente et peut commenter le produit (F41).
2. M. Eto ouvre l'alerte, voit la **quantité suggérée** d'après les ventes réelles.
3. Il crée la commande en brouillon.
4. M. Fouda la valide (F24).
5. La commande part au fournisseur par WhatsApp, côté pharmacie.
6. À la livraison, F33 ; la caissière retrouve le stock à jour.

**Éléments de l'écran.** Liste des alertes avec quantité suggérée ; commande (lignes, quantités, fournisseur) ; statuts : brouillon, envoyée, livrée partielle, livrée ; bouton Envoyer par WhatsApp.
**Règles.** Commande validée par le promoteur avant envoi ; pas de numéro WhatsApp côté client.

#### F33. Réception et contrôle du bon de livraison [NOUVEAU · E]
**Cas de figure.** Une livraison arrive avec 3 lignes en moins que la commande.
**Parcours de la caissière** (si elle réceptionne en l'absence du magasinier).
1. Elle ouvre Réceptions et choisit la commande attendue.
2. Elle contrôle le bon contre la commande, ligne par ligne.
3. Elle saisit lots et péremptions (obligatoires).
4. Elle valide : statut « livrée partielle » ; le stock monte.
5. Elle photographie le bon et le classe (F40).

**Éléments de l'écran.** Commande attendue ; colonnes commandé / reçu ; écart ; lot ; péremption ; photo du bon ; bouton Valider la réception.
**Règles.** Pas d'entrée sans lot ni péremption ; écarts signalés au promoteur.

#### F34. Inventaire [NOUVEAU · E]
**Cas de figure.** Inventaire trimestriel, y compris le registre des stupéfiants.
**Acteur principal** : magasinier. **Rôle de la caissière** : aucun accès ; elle voit seulement le stock ajusté.
**Parcours.**
1. M. Eto lance l'inventaire : liste théorique.
2. Il compte et saisit les quantités.
3. Les écarts et les périmés apparaissent.
4. Il soumet ; M. Fouda valide l'ajustement.
5. Les écarts sont historisés.

**Éléments de l'écran.** Liste théorique ; champ compté ; écart ; périmés ; solde du registre des stupéfiants (F13) ; bouton Soumettre.
**Règles.** Ajustement validé par le promoteur ; tracé.

#### F35. Tableau de bord de la caisse [NOUVEAU · E]
**Cas de figure.** Mme Ngo veut voir où elle en est à 15 h.
**Parcours de la caissière.**
1. Elle ouvre Aujourd'hui depuis l'Accueil.
2. Elle lit ses ventes du jour, tickets, panier moyen, top produits, produits sans prix.
3. Elle clique un produit sans prix : demande au promoteur de fixer le prix (F23).
4. Retour à l'Accueil.

**Éléments de l'écran.** Cartes chiffrées ; courbe par heure ; top produits ; liste « produits sans prix » ; lien d'action.
**Règles.** **Uniquement ses propres ventes** ; aucune marge.

#### F36. Tableau de bord du promoteur [NOUVEAU · E]
**Cas de figure.** Lundi matin, M. Fouda veut comprendre la semaine.
**Acteur principal** : promoteur. **Rôle de la caissière** : ses ventes y sont comparées aux autres caisses.
**Parcours.**
1. Matin : tableau de bord, alertes, clôture de la veille.
2. File des demandes à valider (F23).
3. Lecture des indicateurs, clic sur l'action possible (commander, déstocker, relancer, former).

**Éléments de l'écran.** CA jour / semaine / mois et comparaison au mois précédent ; marge ; bénéfice ; produits rentables et dormants ; performance par caisse ; ventes par heure ; répartition des paiements ; créances assureurs ; ruptures et péremptions ; fidélité et rétention des clients ; comparaison de prix.
**Règles.** Chaque indicateur est relié à une action ; données de sa pharmacie uniquement.

#### F37. Tableau de bord réseau NAXA [NOUVEAU · E]
**Cas de figure.** L'administrateur repère trois pharmacies qui n'ont rien vendu depuis une semaine.
**Acteur principal** : administrateur NAXA. **Rôle de la caissière** : aucun.
**Parcours.**
1. L'administrateur ouvre la vue agrégée du réseau.
2. Il filtre les pharmacies inactives et lit les indicateurs de succès (ventes/jour, temps moyen d'une vente, erreurs de synchronisation, adoption par caissier).
3. Il déclenche un appel de support ou une formation.

**Éléments de l'écran.** Pharmacies actives/inactives ; revenus des abonnements et impayés ; couverture de stock ; recherches sans résultat ; carte de santé de synchronisation ; filtres.
**Règles.** Données agrégées et anonymisées ; aucune donnée de santé nominative ; accès support tracé et limité.

#### F38. Alertes [NOUVEAU · E]
**Cas de figure.** Les ventes baissent de 40 % un mardi.
**Parcours de la caissière.**
1. Elle voit sur l'Accueil les alertes qui la concernent (stock bas, lot proche de péremption).
2. Le promoteur reçoit en plus : écart de caisse, créance assureur ancienne, baisse inhabituelle des ventes.
3. Chaque alerte ouvre l'objet concerné.

**Éléments de l'écran.** Centre d'alertes (type, gravité, date, objet) ; bouton Traité ; réglage des seuils par le promoteur.
**Règles.** Alertes dans l'application et par e-mail ; tracées.

#### F39. Rapports automatiques [NOUVEAU · E]
**Cas de figure.** Chaque lundi, M. Fouda reçoit le rapport de la semaine.
**Acteur principal** : promoteur. **Rôle de la caissière** : son rapport de clôture (F26) y est inclus.
**Parcours.**
1. M. Fouda choisit la fréquence (hebdomadaire, mensuelle ou à sa convenance) et le format (PDF, Excel).
2. Le rapport arrive par e-mail et par notification.
3. Il l'ouvre et agit.

**Éléments de l'écran.** Réglage de fréquence ; liste des rapports envoyés ; téléchargement PDF et Excel.
**Règles.** Envoi dans les limites gratuites ; contenu sans donnée de santé.

#### F40. Espace documents [NOUVEAU · E]
**Cas de figure.** Mme Ngo veut classer le bon de livraison reçu ce matin.
**Parcours de la caissière.**
1. Elle ouvre Documents depuis la navigation.
2. Elle ajoute la photo du bon et choisit type, fournisseur et date.
3. Elle retrouve les rapports de clôture et les bons déjà classés ; elle recherche par type, date, fournisseur.
4. Retour à l'Accueil.

**Éléments de l'écran.** Dossiers par type ; recherche ; liste (nom, type, date, version) ; bouton Ajouter ; aperçu ; historique des versions ; journal d'accès.
**Règles.** Partage selon la matrice des droits ; **liens internes uniquement, jamais publics** ; **aucune ordonnance ni donnée patient nominative** ; stockage borné, compression, durée de conservation, alerte avant saturation.

#### F41. Tâches, commentaires et mentions [NOUVEAU · E]
**Cas de figure.** Un écart de caisse apparaît ; M. Fouda veut une explication.
**Parcours de la caissière.**
1. Elle reçoit une notification de mention (« @Ngo, explique l'écart de jeudi »).
2. Elle ouvre l'objet (clôture, commande, inventaire, bordereau) et répond dans le commentaire.
3. Elle marque sa tâche comme faite.
4. Retour à l'Accueil.

**Éléments de l'écran.** Liste de ses tâches (titre, échéance, statut, assignation à un rôle ou à une personne) ; fil de commentaires sur un objet ; zone de saisie avec mention ; notifications app et e-mail.
**Règles.** Commentaires tracés ; aucune donnée de santé nominative.

#### F42. Journal d'audit [NOUVEAU · B]
**Cas de figure.** Un prix a changé et personne ne sait qui l'a modifié.
**Acteur principal** : promoteur (écriture automatique, lecture promoteur et comptable). **Rôle de la caissière** : ses actions y sont écrites ; elle ne le consulte pas.
**Parcours.**
1. Toute action sensible s'écrit seule : mouvement de stock, prix, annulation, accès sensible, validation, consultation d'ordonnance.
2. M. Fouda ouvre le journal, filtre par date, personne ou type.
3. Il ouvre la ligne et lit qui, quand, pourquoi.

**Éléments de l'écran.** Table (date, heure, personne, rôle, action, objet, motif) ; filtres ; export (comptable, lecture) ; lien vers l'objet.
**Règles.** Non modifiable ; conservé même s'il n'est pas exposé aux autres rôles.

#### F43. Sauvegardes [NOUVEAU · B]
**Cas de figure.** Une base de données est corrompue après une mise à jour.
**Parcours de la caissière.**
1. Chaque nuit, un export chiffré est envoyé au promoteur ; elle ne fait rien.
2. Elle voit seulement « dernière sauvegarde : aujourd'hui ».
3. En cas de restauration, la dernière copie est rechargée ; elle ressaisit les ventes du jour en saisie différée (F27).

**Éléments de l'écran.** Indicateur de dernière sauvegarde ; côté promoteur : bouton Exporter maintenant, liste des exports, journal de restauration.
**Règles.** Dans les limites gratuites ; test de restauration trimestriel ; aucun secret exposé.

#### F44. Abonnement et prix négocié [NOUVEAU · H]
**Cas de figure.** Une pharmacie négocie un prix mensuel particulier avec deux services inclus.
**Acteur principal** : administrateur NAXA. **Rôle de la caissière** : aucun ; si l'abonnement est impayé, elle voit un message d'information.
**Parcours.**
1. L'administrateur ouvre la fiche de la pharmacie dans `/admin`.
2. Il saisit **à la main** le prix convenu, la date de début, la fin d'essai, les échéances.
3. Les paiements arrivent automatiquement par Mobile Money (F63) ; il enregistre à la main seulement ceux faits hors API (secours) et suit les impayés.
4. Chaque changement de prix s'ajoute à l'historique.

**Éléments de l'écran.** Prix convenu ; devise (à confirmer) ; début ; fin d'essai ; échéances ; paiements reçus ; impayés ; services inclus ; historique tracé.
**Règles.** Pas de tarif unique imposé ; seul l'administrateur modifie ; devise à confirmer (§ 12).

#### F45. Essai de 14 jours et mise en route d'une pharmacie [NOUVEAU · H]
**Cas de figure.** Une nouvelle pharmacie commence lundi.
**Parcours de la caissière.**
1. NAXA crée la pharmacie et le promoteur (aucune auto-inscription).
2. M. Fouda crée les caisses et les rôles (F02).
3. Import du catalogue et du stock (F06).
4. **Formation sur place** avec les comptes Caisse ; Mme Ngo s'exerce sur le jeu de démonstration (F59).
5. L'essai de 14 jours démarre ; à la fin, l'abonnement est confirmé par NAXA.

**Éléments de l'écran.** Liste de contrôle de mise en route (comptes, import, formation, premier ticket, première clôture) ; compte à rebours de l'essai ; contact support WhatsApp.
**Règles.** Pas d'auto-inscription ; suivi côté NAXA.

#### F46. Services négociés, flyers et site WordPress [NOUVEAU · H]
**Cas de figure.** Une pharmacie a négocié un flyer par semaine et un site WordPress.
**Acteur principal** : équipe NAXA. **Rôle de la caissière** : elle peut afficher le flyer en caisse.
**Parcours.**
1. La fiche de la pharmacie liste ses services négociés.
2. L'équipe NAXA produit les flyers à partir de modèles réutilisables, dans un plafond de retouches.
3. Le temps passé par pharmacie est suivi.
4. La caissière reçoit le flyer dans Documents (F40) pour l'imprimer.

**Éléments de l'écran.** Liste des services ; modèles de flyers ; compteur de retouches ; suivi du temps ; calendrier des jours spéciaux.
**Règles.** Règles de publicité des médicaments à vérifier avant production en série.

#### F47. Retrait d'une pharmacie des recherches [EXISTANT · conservé]
**Cas de figure.** Une pharmacie ne respecte plus ses engagements.
**Acteur principal** : administrateur NAXA (seul habilité). **Rôle de la caissière** : elle voit un message « pharmacie retirée des recherches ».
**Parcours.**
1. L'administrateur ouvre la fiche de la pharmacie.
2. Il choisit Retirer des recherches ; il saisit un motif.
3. La pharmacie disparaît de la marketplace ; son ERP reste utilisable.
4. Il peut la remettre.

**Éléments de l'écran.** Interrupteur avec fenêtre de confirmation ; motif ; journal.
**Règles.** Tracé ; sans effet sur le stock.

#### F48. Client : recherche, classement et bandeau [EXISTANT, étendu · F]
**Cas de figure.** M. Talla cherche du paracétamol près de chez lui à 20 h.
**Parcours de la caissière.** Elle n'intervient pas ; elle voit seulement la réservation qui en résulte (F03). **Parcours du client.**
1. Il tape un nom, une molécule ou une marque.
2. Il voit les pharmacies classées par prix, distance ou temps, avec circulation et statut de garde.
3. Le bandeau « Les plus recherchés » (noms traduits, **sans médicaments sur ordonnance**) l'oriente.
4. Il ouvre une fiche.

**Éléments de l'écran.** Barre de recherche ; filtres et tri ; carte de résultats (pharmacie, distance, temps, prix, disponibilité, fraîcheur du stock) ; bandeau ; badge De garde.
**Règles.** Disponibilité = stock réel de la caisse ; réglementation de la publicité à vérifier.

#### F49. Client : scan d'ordonnance [EXISTANT · conservé]
**Cas de figure.** M. Talla photographie son ordonnance chez lui.
**Parcours de la caissière.**
1. L'ordonnance du client arrive, après son envoi, dans la file de validation de la pharmacie (F17).
2. Elle voit la demande liée à la réservation.
3. Elle prépare les produits une fois l'ordonnance validée.

**Éléments de l'écran (client).** Choix import ou caméra ; aperçu ; lecture OCR ; liste des produits trouvés ; bouton Réserver.
**Règles.** Aucune posologie publique ; aucun diagnostic.

#### F50. Client : panier, réservation, reçu et paiement guidé [EXISTANT · conservé, étendu en F]
**Cas de figure.** M. Talla réserve trois produits et paiera sur place.
**Parcours de la caissière.**
1. Elle reçoit la réservation (F03).
2. À son arrivée, elle encaisse (F20), imprime le ticket (F21).
3. Le **reçu imprimable** est disponible côté client.

**Éléments de l'écran (client).** Panier ; durée de réservation ; bouton Réserver ; reçu ; code marchand (paiement guidé, facultatif) ; bouton WhatsApp côté pharmacie.
**Règles.** Contrôles serveur du panier ; aucun numéro WhatsApp côté client.

#### F51. Client : fiche produit et comparaison des prix [NOUVEAU · F]
**Cas de figure.** M. Talla compare le même produit dans trois pharmacies.
**Parcours de la caissière.** Elle n'intervient pas ; ses prix de vente (fixés par le promoteur) alimentent la comparaison.
**Parcours du client.**
1. Il ouvre la fiche : photo, description, prix comparés.
2. Il choisit une pharmacie et réserve.

**Éléments de l'écran.** Photo (droits vérifiés) ; description ; prix par pharmacie ; disponibilité ; fraîcheur du stock ; bouton Réserver.
**Règles.** Pas de posologie publique ; lots et péremptions jamais visibles.

#### F52. Client : compte, historique et sécurité d'accès [EXISTANT, enrichi · F]
**Cas de figure.** M. Talla crée son compte puis retrouve son historique.
**Parcours de la caissière.** Elle n'intervient pas ; elle voit le prénom du client sur la réservation.
**Parcours du client.**
1. Création en 3 étapes (ou Google OAuth) ; validation d'âge avec trois politiques obligatoires.
2. Récupération par OTP e-mail si besoin.
3. Il consulte son historique de réservations et d'achats.

**Éléments de l'écran.** Formulaire en 3 étapes ; cases de consentement ; bouton Google ; historique ; suppression du compte.
**Règles.** Historique d'achats de médicaments = donnée de santé : consentement explicite, accès limité au client, durée de conservation, minimisation ; cadre légal à vérifier.

#### F53. Fraîcheur du stock affichée [NOUVEAU · F]
**Cas de figure.** À 20 h, trois pharmacies affichent « il y a 3 min », « il y a 2 h », « il y a 3 jours ».
**Parcours de la caissière.**
1. En vendant et en réceptionnant, elle met le stock à jour sans saisie supplémentaire.
2. La mention de fraîcheur se met à jour seule.
3. Une pharmacie à jour remonte dans le classement.

**Éléments de l'écran (client).** Mention « mis à jour il y a X min » sur chaque pharmacie.
**Règles.** Calculée depuis le dernier mouvement synchronisé.

#### F54. Livraison configurable [NOUVEAU · F]
**Cas de figure.** Une pharmacie a son propre livreur et veut livrer en ville.
**Acteur principal** : promoteur. **Parcours de la caissière.**
1. M. Fouda active la livraison dans les réglages (F58) ; **désactivée par défaut**.
2. Elle voit apparaître sur une réservation « livraison » avec adresse et frais.
3. Elle prépare la commande, la remet au livreur et marque Remise au livreur.
4. Là où la livraison n'est pas activée, la règle « aucune livraison » s'applique.

**Éléments de l'écran.** Interrupteur (promoteur) ; zone et frais ; mention de responsabilité de la pharmacie ; statut : à préparer / remise au livreur / livrée.
**Règles.** La pharmacie assume son livreur et la responsabilité ; conditions à mettre à jour avant activation.

#### F55. Assistant d'orientation (IA) [NOUVEAU · G]
**Cas de figure.** Un client écrit « j'ai mal à la gorge ».
**Parcours de la caissière.** Elle n'intervient pas ; il l'oriente vers la pharmacie.
**Parcours du client.**
1. Il décrit un symptôme.
2. L'assistant propose des **familles de produits**, sans diagnostic ni posologie.
3. Il renvoie vers le pharmacien et propose une recherche en pharmacie.

**Éléments de l'écran.** Zone de saisie ; réponse avec avertissement ; bouton « Parler à un pharmacien » ; numéros d'urgence.
**Règles.** Garde-fous médicaux validés avant mise en service ; précision mesurée.

#### F56. IA : scan de bons de livraison, lecture d'ordonnance, prédiction de rupture [NOUVEAU · G]
**Cas de figure.** Un bon de livraison de 40 lignes arrive à 17 h.
**Parcours de la caissière.**
1. Elle photographie le bon dans Réceptions (F33).
2. L'IA propose les lignes ; elle corrige.
3. Elle valide : **un contrôle humain est toujours obligatoire**.
4. Pour les ordonnances, l'aide de lecture est proposée au validateur, jamais décisive.

**Éléments de l'écran.** Photo ; lignes proposées avec indice de confiance ; boutons Corriger, Valider ; alerte de rupture prévue.
**Règles.** Aucune validation automatique ; précision mesurée.

#### F57. Paiement en ligne du client (Mobile Money) [À ARBITRER · J]
**Cas de figure.** Un client veut payer sa réservation depuis chez lui.
**Parcours de la caissière.** **Aucune construction** avant décision du fondateur (partenaire et périmètre). D'ici là : espèces, paiement guidé par code marchand et Mobile Money saisi à la main (F20).
**Éléments de l'écran.** Aucun à ce stade.
**Règles.** Dernier chantier de l'ERP (avant K) ; décision à demander au fondateur.

#### F58. Réglages de la pharmacie [NOUVEAU · B]
**Cas de figure.** M. Fouda veut raccourcir les réservations à 2 h et fixer un plafond de remise de 5 %.
**Acteur principal** : promoteur. **Rôle de la caissière** : elle subit ces réglages (ex. plafond de remise).
**Parcours.**
1. M. Fouda ouvre Réglages.
2. Il modifie un paramètre et enregistre.
3. Le changement s'applique à toutes les caisses ; il est tracé.

**Éléments de l'écran.** Durée de réservation (1 à 3 h, défaut 3 h) ; seuil de proche péremption ; plafond de remise par compte ; délai de verrouillage automatique ; durée de conservation des ordonnances ; activation de la livraison ; fréquence des rapports.
**Règles.** Tout changement journalisé ; valeurs bornées.

#### F59. Jeu de démonstration et formation [NOUVEAU · H]
**Cas de figure.** Mme Ngo s'entraîne avant sa première vente réelle.
**Parcours de la caissière.**
1. Elle ouvre le mode Formation (pharmacie fictive).
2. Elle suit un scénario : scan, ordonnance, remise, paiement, clôture.
3. Aucun mouvement ne touche le vrai stock.
4. Elle quitte le mode Formation et revient à l'Accueil réel.

**Éléments de l'écran.** Bandeau « MODE FORMATION » permanent ; scénarios guidés ; bouton Réinitialiser ; données fictives.
**Règles.** Données simulées strictement séparées des données réelles.


#### F63. Paiement de l'abonnement par Mobile Money (API) [NOUVEAU · H]
**Cas de figure.** L'abonnement de la pharmacie arrive à échéance vendredi ; M. Fouda paiera depuis son téléphone.
**Acteur principal** : le promoteur (F63-PRO). **Parcours de la caissière.**
1. Elle ne paie rien et ne voit **aucun montant**.
2. Avant l'échéance, un bandeau d'information « abonnement à renouveler » peut s'afficher à l'Accueil.
3. Si l'échéance est dépassée, le bandeau change de couleur ; si l'impayé entraîne le blocage prévu par la règle existante (toutes les pharmacies du Promoteur), elle voit l'écran de suspension existant (§ 2bis).
4. Le paiement confirmé, le bandeau disparaît.
5. Elle continue sa boucle depuis l'Accueil.

**Éléments de l'écran.** Bandeau d'état (à jour / à renouveler / en retard) sans montant ni détail ; bouton « Prévenir le promoteur » (notification).
**Règles techniques de la fonctionnalité (tous profils).** Clés API et secrets **uniquement côté serveur** ; notifications de l'opérateur acceptées seulement si leur **signature est valide** ; **un paiement ne peut être compté qu'une fois** (aucun double débit, aucun doublon) ; aucun code secret Mobile Money ni donnée de carte stocké ; numéros de téléphone masqués après saisie ; **essai complet en sandbox avant tout paiement réel** ; rapprochement quotidien avec l'opérateur par une tâche planifiée gratuite ; frais de transaction à vérifier avant de continuer (PA4) ; toute transaction tracée dans le journal d'audit.

#### F64. Rappel de lot [NOUVEAU · E]
**Cas de figure.** Un fabricant retire le lot B1234 d'un sirop. M. Fouda doit savoir en un geste ce qu'il en reste en rayon et dans quelles ventes il est passé.
**Acteur principal** : promoteur, assistant, magasinier. **Parcours de la caissière.**
1. Une bannière rouge « Rappel de lot : ne pas vendre » s'affiche à l'Accueil et à l'écran de vente.
2. Si elle scanne une boîte du lot, la vente de cette ligne est **bloquée** avec le message de rappel ; elle met la boîte de côté.
3. Elle compte les boîtes retrouvées en rayon et saisit la quantité (comptage, sans prix d'achat).
4. Elle voit l'état du rappel : « en quarantaine » puis « clôturé » quand le promoteur ferme le dossier.
5. Retour à l'Accueil. Si elle suspecte un lot, elle utilise « Signaler un lot suspect » (demande, F23).

**Éléments de l'écran.** Bannière de rappel ; message de blocage au scan ; champ quantité retrouvée ; bouton Signaler un lot suspect ; état du rappel.
**Règles.** Blocage appliqué côté serveur ; lot identifié par produit + numéro de lot ; la caissière ne voit ni les clients concernés ni les prix d'achat ; lots jamais visibles du client ; tracé.

#### F65. Ordonnancier [NOUVEAU · C]
**Cas de figure.** En fin de journée, Mlle Biya doit retrouver l'ordonnance n° 0412 dispensée il y a trois semaines.
**Acteur principal** : assistant et promoteur. **Rôle de la caissière** : elle ne consulte pas l'ordonnancier ; elle voit seulement le **numéro d'ordre** attribué à la vente d'ordonnance (F17).
**Parcours.**
1. Une vente avec ordonnance est validée (F17) : un numéro d'ordre est attribué automatiquement.
2. Le numéro figure sur le ticket (F21) ; la caissière revient à l'Accueil.
3. Mlle Biya ouvre Ordonnancier et cherche par numéro, date ou produit.
4. Elle lit la ligne : date, numéro d'ordre, produits dispensés, quantités, validateur, lien vers le coffre (F18).
5. M. Fouda exporte le registre en PDF.

**Éléments de l'écran.** Liste, recherche, filtres (date, produit, validateur), détail d'une ligne, bouton Exporter, mention de conservation.
**Règles.** Registre **distinct** du registre des stupéfiants (F13) ; numéro d'ordre sans trou, non modifiable ; obligations exactes (contenu, durée de conservation) **à vérifier** pour le Cameroun (§ 12, Q7) ; comptable, magasinier, administrateur : accès refusé ; tracé.

#### F66. Trésorerie et dépenses [NOUVEAU · E]
**Cas de figure.** Mme Ngo achète du savon pour la pharmacie avec la petite caisse (3 500 FCFA) ; le loyer du mois est payé par virement.
**Acteur principal** : promoteur et comptable. **Parcours de la caissière.**
1. Mes demandes → Dépense de petite caisse.
2. Elle saisit le montant, choisit le motif et photographie le justificatif.
3. Elle envoie : statut « en attente ».
4. M. Fouda valide (F24) ; la sortie est inscrite et prise en compte dans sa clôture (F26).
5. En cas de refus, elle voit le motif.

**Éléments de l'écran (caisse).** Montant, catégorie (liste), note, photo du justificatif, bouton Envoyer, statut dans Mes demandes. Les écrans trésorerie sont aux § 14.
**Règles.** Aucune dépense sans motif ni justificatif ; la sortie de petite caisse apparaît dans le Z ; la caissière ne voit ni le solde de trésorerie, ni la banque, ni les salaires ; Mobile Money et banque saisis à la main (aucune connexion bancaire) ; tracé.

#### F67. Valeur du stock, coût d'achat et pertes [NOUVEAU · E]
**Cas de figure.** M. Fouda s'aperçoit que sa marge affichée est trop belle : le grossiste a augmenté ses prix de 6 % en deux mois.
**Acteur principal** : magasinier et promoteur. **Rôle de la caissière** : aucun accès aux prix d'achat, à la valeur du stock ni aux marges ; elle voit seulement le prix de vente mis à jour par le promoteur.
**Parcours.**
1. À chaque réception (F33), le **coût moyen pondéré** du produit est recalculé.
2. L'historique des prix d'achat par fournisseur s'enrichit.
3. Les sorties exceptionnelles (F12) sont valorisées en pertes : casse, vol, périmé.
4. M. Fouda lit la valeur du stock et la marge réelle ; une alerte signale « prix d'achat en hausse, prix de vente à revoir ».

**Éléments de l'écran.** Valeur du stock (totale, par famille) ; coût moyen pondéré par produit ; courbe de l'historique des prix d'achat ; pertes par motif ; alerte de marge.
**Règles.** Marge calculée à partir du coût moyen pondéré, jamais d'un prix saisi à la main ; lots existants sans coût marqués « coût inconnu », aucune réécriture de l'existant ; tracé.

#### F68. Fiche client et crédit client [NOUVEAU · D ; suivi des traitements chroniques À ARBITRER]
**Cas de figure.** M. Talla, client régulier, prend 15 000 FCFA de médicaments à crédit jusqu'à la fin du mois.
**Acteur principal** : caissière et promoteur. **Parcours de la caissière.**
1. À la vente (F14), elle touche Client, cherche par nom ou téléphone, ou crée une fiche minimale.
2. Elle choisit le paiement « Crédit client » (F20) ; l'écran montre le plafond et le solde.
3. Dans le plafond, la vente est enregistrée ; au-delà, elle envoie une demande au promoteur (F23).
4. Plus tard, M. Talla règle : Encaisser un règlement, reçu imprimable.
5. Retour à l'Accueil.

**Éléments de l'écran.** Recherche client ; fiche minimale (nom, téléphone, consentement) ; plafond et solde ; historique des achats à crédit et des règlements (montants et dates) ; bouton Encaisser un règlement.
**Règles.** La caissière ne voit **aucune donnée de santé** du client ; plafond fixé par le promoteur ; téléphone masqué après saisie ; **le suivi des traitements chroniques et les rappels restent [À ARBITRER]**, conservés au cahier par décision du fondateur (06/10/2026) en attente du cadre légal (cadre légal des données de santé, voir fidélisation, § 3) ; tracé.

#### F69. Équipe : planning, gardes, présences [NOUVEAU · K]
**Cas de figure.** Mme Ngo veut échanger sa journée de samedi avec un collègue ; la pharmacie est de garde le week-end suivant.
**Acteur principal** : promoteur ; **tous les employés** (caissière, assistant, magasinier) utilisent le même écran « Mon planning ». **Parcours de la caissière.**
1. Elle ouvre Mon planning : ses jours, ses gardes, ses heures du mois.
2. Elle demande un échange avec un collègue (F23).
3. M. Fouda valide (F24) ; le planning est mis à jour.
4. À l'arrivée, l'ouverture de session vaut présence.
5. Retour à l'Accueil.

**Éléments de l'écran.** Calendrier de l'équipe ; gardes ; bouton Demander un échange ; présence du jour ; heures cumulées ; formations suivies.
**Règles.** Le planning de garde n'active pas seul le statut « De garde » (F04) ; commissions éventuelles visibles du seul employé concerné, du promoteur et du comptable (lecture) ; aucune donnée de santé de l'employé ; attestations de formation dans l'espace documents (F40) ; tracé.

#### F70. Plusieurs sites : transferts, vue groupe, centrale d'achat [NOUVEAU · K]
**Décision du fondateur (06/10/2026), alignée sur l'existant (§ 2bis).** Certaines pharmacies cibles ont un site, d'autres plusieurs : le réseau multi-pharmacie existe déjà (`promoteur_pharmacies`). Une pharmacie seule fonctionne comme aujourd'hui (« une pharmacie = un stock », comptes rattachés à une seule pharmacie, isolation stricte). F70 construit seulement ce qui manque : transferts entre pharmacies du même Promoteur, vue groupe consolidée, centrale d'achat. Écrans en phase K.
**Cas de figure.** M. Fouda a deux pharmacies : l'une manque d'amoxicilline, l'autre en a 40 boîtes.
**Parcours de la caissière.**
1. Elle voit une « demande de transfert reçue » dans Mes demandes.
2. Elle prépare et compte les boîtes, puis confirme l'envoi (sortie de stock de type « transfert »).
3. La pharmacie destinataire confirme la réception (entrée par lot, F09).
4. Retour à l'Accueil.

**Éléments de l'écran.** Liste des transferts (demandé, préparé, expédié, reçu) ; produit, lot, quantité ; bouton Confirmer l'envoi ou la réception.
**Règles.** Un **groupe** rattache plusieurs pharmacies à un même promoteur ; chaque pharmacie garde son stock et ses données isolés, la vue consolidée est réservée au promoteur du groupe ; un transfert n'est pas une vente ; tracé des deux côtés.

#### F71. Fournisseurs avancés : prix, retours, avoirs, litiges, échéances [NOUVEAU · K]
**Cas de figure.** Le grossiste A livre 12 boîtes cassées ; le grossiste B propose le même produit 8 % moins cher.
**Acteur principal** : magasinier et promoteur. **Rôle de la caissière** : aucun accès.
**Parcours.**
1. M. Eto compare les prix d'un produit entre grossistes (historique, F67).
2. Il crée un retour fournisseur depuis la réception (F33), avec motif et photo.
3. L'avoir attendu est enregistré ; un litige est ouvert si le fournisseur conteste.
4. Les échéances de facture s'affichent ; M. Fouda décide des paiements, Mme Kamga lit.

**Éléments de l'écran.** Tableau comparatif des prix ; retours ; avoirs ; litiges (statut, pièces) ; échéancier.
**Règles.** Aucun paiement fournisseur dans NAXA (suivi seulement) ; un retour sort le stock et valorise la perte ou l'avoir ; tracé.

#### F72. Produits et services hors médicaments [NOUVEAU · K]
**Cas de figure.** Mme Ngo prend la tension d'une cliente (service à 1 000 FCFA) et vend une crème de parapharmacie.
**Parcours de la caissière.**
1. À la vente, elle scanne ou cherche : médicament, parapharmacie, matériel médical ou service.
2. Elle ajoute la ligne au prix fixé par le promoteur.
3. Le prix réglementé ou la taxe applicable s'appliquent selon la fiche.
4. Paiement et ticket comme d'habitude, retour à l'Accueil.

**Éléments de l'écran.** Catégorie du produit ; fiche service (nom, prix) ; pastille « prix réglementé ».
**Règles.** Prix réglementés, coefficients de marge et taxes **à vérifier** (§ 12) ; un service n'a ni stock ni lot ; les exports comptables (F60) distinguent les catégories ; remises soumises aux plafonds (F16) ; tracé.

#### F73. Qualité et sécurité [NOUVEAU · K]
**Cas de figure.** Mme Ngo s'aperçoit à temps qu'elle allait délivrer 500 mg au lieu de 1 g ; une cliente conteste un reçu.
**Acteur principal** : assistant (analyse) et promoteur (clôture). **Parcours de la caissière.**
1. Qualité → Déclarer : erreur évitée, incident ou réclamation client.
2. Elle choisit le type, le produit, décrit en une phrase, **sans nom de patient**.
3. Elle envoie : statut « ouvert ».
4. Mlle Biya analyse, M. Fouda clôture ; elle voit « pris en compte ».

**Éléments de l'écran.** Formulaire de déclaration ; liste de mes déclarations avec statut. Côté autres profils : relevés de chaîne du froid, retours de médicaments non utilisés (§ 14).
**Règles.** Déclaration non punitive par défaut ; visible seulement des personnes habilitées ; aucune donnée nominative de patient ; relevés de température saisis à la main (aucun capteur supposé) ; la **pharmacovigilance officielle** reste à vérifier et NAXA ne remplace pas la déclaration réglementaire ; tracé.

#### F74. Communication client : rappels, avis, réclamations [À ARBITRER · K]
**Conflit avec l'existant.** Règle « aucun numéro WhatsApp côté client » ; fidélisation et rappels en attente du cadre légal (§ 3). **En attente du cadre légal : décision du fondateur (06/10/2026), aucune construction avant sa levée.**
**Cas de figure.** M. Talla accepte d'être prévenu quand sa réservation est prête.
**Parcours de la caissière.**
1. Dans la fiche client (F68), elle enregistre le **consentement** (canal, date).
2. Si le client refuse, aucun message ne part.
3. Les messages suivent les modèles choisis par le promoteur ; l'avis ou la réclamation reçu arrive chez lui (F73).
4. Retour à l'Accueil.

**Éléments de l'écran.** Case de consentement avec canal et date ; retrait du consentement en un geste ; liste des messages envoyés.
**Règles.** Aucun message sans consentement ; aucun contenu de santé dans les messages ; coût des SMS ou WhatsApp : limites gratuites (PA4) ; tracé.

#### F75. Prévision saisonnière de la demande [NOUVEAU · K, prolonge F56]
**Cas de figure.** À l'approche de la saison des pluies, M. Eto veut commander avant la hausse des cas de paludisme.
**Acteur principal** : magasinier et promoteur. **Rôle de la caissière** : aucun écran ; elle voit seulement « stock bas » (F10).
**Parcours.**
1. La suggestion de commande (F32) tient compte de la saison apprise des ventes passées.
2. M. Eto voit les mois forts d'un produit et ajuste la quantité.
3. M. Fouda valide la commande (F24).

**Éléments de l'écran.** Courbe saisonnière ; quantité suggérée avec explication ; indicateur de fiabilité (nombre de mois de données).
**Règles.** Suggestion seulement, jamais décisive ; message clair tant que l'historique est trop court ; aucune donnée de santé individuelle ; précision mesurée comme en phase G ; tracé.

---

### 13.3 Correspondance fiches et phases

| Phase | Fiches |
|---|---|
| **B** Fondations | F00, F01, F02, F05, F06, F07, F08, F09, F10, F18 (socle), F42, F43, F58, cadre commun C0 |
| **C** Caisse | F03, F04, F12, F13, F14, F15, F16, F17, F18, F19, F20, F21, F22, F23, F24, F26, F27, F65 |
| **D** Assurances | F25, F28, F29, F30, F68 |
| **E** Pilotage et achats | F11, F31, F32, F33, F34, F35, F36, F37, F38, F39, F40, F41, F64, F66, F67 |
| **F** Marketplace | F48, F49, F50, F51, F52, F53, F54 |
| **G** IA | F55, F56 |
| **H** Offre | F44, F45, F46, F59, F63 |
| **I** Terrain | Toutes les fiches, de tous les profils (§ 13 et § 14), sur données réelles |
| **J** Paiement en ligne du client | F57 (à arbitrer) |
| **K** Extensions de l'officine (après J) | F69, F70, F71, F72, F73, F74 (en attente), F75 |
| **Existant conservé** | F47 |

Les fiches des autres profils (F00-PRO … F75-CLI) et les nouvelles fonctionnalités F60 à F62 sont rattachées aux phases dans le § 14.8.

---

## 14. Atlas par profil : parcours de tous les autres rôles [NOUVEAU]

Même méthode que le § 13, pour les sept autres profils : **Promoteur (PRO), Responsable (RES), Pharmacien assistant (ASS), Magasinier (MAG), Comptable (CPT), Administrateur NAXA (ADM), Client (CLI)**. Chaque fiche porte l'identifiant de la fonctionnalité suivi du profil (ex. **F22-PRO**). Quand le profil utilise le **même écran** que la caissière, la fiche renvoie au § 13 et ne décrit que les **différences** (droits, boutons en plus ou en moins). Le cadre commun C0 (§ 13.1) s'applique à tous, avec la navigation propre au rôle. Les droits restent ceux du § 4, appliqués côté serveur.

**Une fiche profil est terminée** selon la même définition que le § 13, et en plus : le profil ne voit **que** ce que le § 4.3 lui accorde, et un test vérifie qu'il ne peut pas accéder au reste (accès refusé côté serveur).

**Nouvelles fonctionnalités révélées par les parcours des profils** : **F60** Journal des ventes, TVA et exports (comptable) ; **F61** Création de la pharmacie et du promoteur (administrateur) ; **F62** Support avec accès tracé et limité (administrateur). **F63** Paiement de l'abonnement par l'API Mobile Money vient d'une décision du fondateur (06/10/2026).

### 14.1 Promoteur (PRO)

**Boucle du promoteur.** Connexion le matin → Accueil promoteur → alertes et clôtures de la veille → file des demandes (décisions par empreinte ou PIN) → tableau de bord → assurances et bordereaux → achats → rapports → réglages et comptes → fin de journée : prise de connaissance des clôtures → verrouillage → le lendemain, la boucle recommence.

**Fiches où le promoteur utilise les mêmes écrans que la caissière** (§ 13) : F03 réservations, F04 statut de garde, F14 vente et scan, F15 caisse rapide, F20 paiements, F21 ticket, F25 vente assurée. Différences : il vend sans plafond de remise ; il est **le seul** à modifier un prix de vente (F05-PRO) ; il annule directement une vente (F22-PRO) ; il voit les ventes de **toutes** les caisses.

#### F00-PRO. Accueil du promoteur [NOUVEAU · B]
**Cas de figure.** Lundi 7 h 30, M. Fouda ouvre l'application avant l'arrivée de l'équipe.
**Parcours.**
1. Il arrive sur l'Accueil et voit le compteur « À valider ».
2. Il lit les clôtures de la veille et les alertes.
3. Il ouvre la file des demandes (F23-PRO) et décide.
4. Il ouvre le tableau de bord (F36) puis le sujet qui l'inquiète.
5. À chaque fin d'action, il revient à l'Accueil.

**Éléments de l'écran.** Compteur **À valider** ; cartes « CA du jour » et comparaison à hier ; **clôtures de la veille** par caisse (écart, motif) ; alertes (ruptures, péremptions proches, écart de caisse, créance ancienne, baisse inhabituelle) ; raccourcis (Tableau de bord, Demandes, Assurances, Achats, Rapports, Comptes, Réglages) ; état de la dernière sauvegarde ; jours restants d'essai ou état de l'abonnement.
**Règles.** Données de **sa** pharmacie uniquement.

#### F01-PRO. Connexion, appareil de validation et PIN [NOUVEAU · C]
**Cas de figure.** M. Fouda change de téléphone et doit pouvoir valider par empreinte.
**Parcours.**
1. Il se connecte, ouvre Réglages → Sécurité.
2. Il appuie sur Enregistrer cet appareil ; le téléphone demande son empreinte ou son visage.
3. Il teste une validation fictive ; l'appareil apparaît dans la liste.
4. Il révoque l'ancien téléphone.
5. Il crée ou change son **PIN personnel** (saisie et confirmation).

**Éléments de l'écran.** Liste des appareils (nom, date d'ajout, dernière utilisation) ; boutons Ajouter, Révoquer ; champs PIN et confirmation ; messages de verrouillage ; délai de verrouillage de session.
**Règles.** HTTPS obligatoire ; aucune donnée biométrique stockée par NAXA ; PIN journalisé, verrouillé après plusieurs essais ratés, jamais partagé.

#### F02-PRO. Comptes de la pharmacie [EXISTANT, étendu · B]
**Cas de figure.** M. Fouda recrute un magasinier et bloque un compte caisse après un incident.
**Parcours.**
1. Comptes → Créer un compte : nom, rôle (Responsable, caissier, assistant, magasinier, comptable), identifiant, mot de passe provisoire.
2. Il fixe le **plafond de remise** pour les caissiers et assistants.
3. Pour un incident : Bloquer ; le compte est refusé à la connexion ; la pharmacie reste active.
4. Plus tard : Réactiver.

**Éléments de l'écran.** Liste (nom, rôle, état, dernière connexion) ; formulaire de création ; boutons Bloquer, Réactiver ; plafond de remise ; historique.
**Règles.** Un compte enfant appartient à une seule pharmacie ; tout est tracé.

#### F05-PRO. Stock et prix de vente [NOUVEAU · B]
**Cas de figure.** Le grossiste augmente un produit ; M. Fouda met à jour le prix.
**Parcours.**
1. Stock → produit.
2. Il lit prix d'achat, prix de vente, marge, lots.
3. Il appuie sur Modifier le prix de vente, saisit le nouveau prix, enregistre.
4. L'ancien prix reste dans l'historique ; la caisse et la marketplace affichent le nouveau prix.
5. Il consulte « produits sans prix » et les complète.

**Éléments de l'écran.** Prix d'achat ; prix de vente ; marge ; historique des prix ; liste « produits sans prix » ; lots et péremptions.
**Règles.** **Seul** le promoteur modifie un prix de vente ; tracé.

#### F11-PRO. Décision sur un lot proche de péremption [NOUVEAU · E]
**Cas de figure.** Un sirop expire dans 45 jours ; seuil à 60 jours.
**Parcours.**
1. Alerte sur l'Accueil → liste des lots proches de péremption.
2. Il ouvre le lot (quantité, jours restants, coût d'achat).
3. Il choisit : Promotion (prix remisé), Retour fournisseur ou Sortie exceptionnelle.
4. La décision part au magasinier et à la caisse (le prix remisé s'applique au scan).

**Éléments de l'écran.** Liste des lots ; détail ; boutons des trois options ; champ prix promotionnel et dates.
**Règles.** Décision tracée ; sortie = motif obligatoire.

#### F12-PRO. Validation d'une sortie exceptionnelle [NOUVEAU · C]
**Cas de figure.** Mme Ngo déclare une boîte cassée.
**Parcours.**
1. Notification ; il ouvre la demande dans la file (F23-PRO).
2. Il lit produit, quantité, motif, photo éventuelle.
3. Il valide par empreinte (F24) ou refuse avec motif.
4. Le stock baisse après validation.

**Éléments de l'écran.** Détail de la demande ; boutons Valider et Refuser ; champ motif de refus.
**Règles.** Motif obligatoire ; tracé.

#### F13-PRO. Registre des stupéfiants : contrôle [NOUVEAU · C]
**Cas de figure.** Contrôle trimestriel du registre.
**Parcours.**
1. Registre → filtre par produit et période.
2. Il compare solde du registre et stock compté (inventaire F34).
3. Il valide ou demande une explication (tâche F41).
4. Il exporte le registre.

**Éléments de l'écran.** Registre (date, produit, lot, entrée, sortie, solde, ordonnance liée, validateur) ; alerte d'écart ; export.
**Règles.** Registre non modifiable ; exigences légales à vérifier.

#### F16-PRO. Remises : plafonds et validation [NOUVEAU · C]
**Cas de figure.** Un caissier demande 10 % alors que son plafond est 5 %.
**Parcours.**
1. Notification de demande de remise.
2. Il ouvre : panier, client, montant, motif.
3. Il valide (la remise s'applique) ou refuse.
4. Il ajuste au besoin le plafond de ce compte (F02-PRO).

**Éléments de l'écran.** Détail du panier ; boutons Valider, Refuser ; rappel du plafond.
**Règles.** Tout est tracé.

#### F17-PRO. Ordonnances : validation en l'absence d'assistant [NOUVEAU · C]
**Cas de figure.** Pas d'assistant ce jour-là ; une ordonnance attend.
**Parcours.**
1. File des ordonnances → il ouvre la première.
2. Il vérifie la lisibilité, les produits, les quantités.
3. Il valide, rejette (motif) ou demande un complément.
4. La vente se débloque à la caisse.

**Éléments de l'écran.** Mêmes que la file de validation du § 13 F17 (visionneuse, lignes cochables, boutons Valider, Rejeter, Signaler).
**Règles.** Le promoteur valide **seulement** si aucun assistant n'est disponible ou s'il le souhaite ; tracé.

#### F18-PRO. Coffre ordonnances [NOUVEAU · B-C]
**Cas de figure.** Un client conteste une dispensation.
**Parcours.**
1. Il retrouve la vente dans le journal, ouvre l'ordonnance liée.
2. La consultation est enregistrée (qui, quand).
3. Il règle la durée de conservation (F58-PRO) et lit l'alerte avant suppression.

**Éléments de l'écran.** Liste du coffre ; visionneuse ; journal des consultations ; alerte de suppression à venir.
**Règles.** Accès promoteur et assistant seulement.

#### F22-PRO. Annulation de vente [NOUVEAU · C]
**Cas de figure.** Double encaissement signalé par la caisse.
**Parcours.**
1. Demande dans la file ; il ouvre la vente.
2. Il valide par empreinte : la vente est annulée, le stock rétabli.
3. S'il constate lui-même une erreur, il annule directement avec motif.

**Éléments de l'écran.** Détail de la vente ; boutons Valider l'annulation, Refuser, Annuler directement ; champ motif.
**Règles.** Tracé ; retours et échanges non retenus.

#### F23-PRO. File des demandes à valider [NOUVEAU · C]
**Cas de figure.** Quatre demandes l'attendent : remise, sortie, annulation, commande.
**Parcours.**
1. Notification (application et e-mail) ; il ouvre la file.
2. Il trie par ancienneté ou type.
3. Pour chaque demande : lire, valider (empreinte ou PIN) ou refuser avec motif obligatoire.
4. Une demande sans réponse est relancée automatiquement, puis expire.

**Éléments de l'écran.** Liste (type, demandeur, date, objet, statut) ; filtres ; détail ; boutons Valider, Refuser ; statuts : en attente, validée, refusée, expirée.
**Règles.** Tout est écrit dans le journal d'audit.

#### F24-PRO. Validation par empreinte ou PIN [NOUVEAU · C]
**Cas de figure.** Il est dans l'arrière-boutique quand la caisse demande une annulation.
**Parcours.**
1. Notification sur son téléphone.
2. Il ouvre la demande et confirme par empreinte ou visage.
3. Si le téléphone est indisponible, il saisit son PIN à la caisse.
4. Trop d'essais ratés : le PIN se verrouille, il valide sur son téléphone.

**Éléments de l'écran.** Détail de la demande ; bouton Confirmer ; invite biométrique du téléphone ; écran PIN ; message de verrouillage.
**Règles.** Journalisé ; aucune biométrie stockée.

#### F26-PRO. Clôtures de caisse : prise de connaissance [NOUVEAU · C]
**Cas de figure.** Écart de 1 500 FCFA sur la caisse de Mme Ngo.
**Parcours.**
1. Accueil → clôtures de la veille.
2. Il ouvre la clôture : totaux, compté, écart, motif.
3. Il prend connaissance, ouvre un commentaire (F41) ou crée une tâche.
4. Il télécharge le rapport PDF.

**Éléments de l'écran.** Clôtures par caisse ; écart ; motif ; rapport PDF ; bouton Prendre connaissance.
**Règles.** Il voit **toutes** les caisses ; une journée clôturée ne se modifie pas.

#### F27-PRO. Contrôle des saisies différées [NOUVEAU · C]
**Cas de figure.** Panne de 11 h ; ventes ressaisies l'après-midi.
**Parcours.**
1. Clôture → liste « saisies différées ».
2. Il compare avec le carnet papier photographié (F40).
3. Il valide ou conteste chaque ligne.

**Éléments de l'écran.** Liste des saisies différées (heure réelle, produit, montant) ; photo du carnet ; boutons Valider, Contester.
**Règles.** Tracé.

#### F28-PRO. Fiches assureurs [NOUVEAU · D]
**Cas de figure.** Nouvelle assurance privée.
**Parcours.**
1. Assurances → Créer : nom, taux de prise en charge, plafond, délai de dépôt, contact, pièces à fournir.
2. Il importe la liste des produits remboursables (Excel).
3. Il enregistre ; l'assureur apparaît à la caisse.

**Éléments de l'écran.** Formulaire ; import Excel ; liste des assureurs ; créance en cours.
**Règles.** Seul le promoteur écrit ; tracé.

#### F29-PRO. Créances et bordereaux : validation [NOUVEAU · D]
**Cas de figure.** Bordereau CNPS du mois généré par la comptable.
**Parcours.**
1. Bordereaux → il ouvre celui du mois.
2. Il contrôle total, lignes, plafonds.
3. Il valide l'envoi ; le suivi passe à « déposé ».

**Éléments de l'écran.** Bordereau (lignes, total) ; boutons Valider, Renvoyer à la comptable ; statut.
**Règles.** Tracé.

#### F31-PRO. Fournisseurs et dettes [NOUVEAU · E]
**Cas de figure.** Dette de 450 000 FCFA envers un grossiste.
**Parcours.**
1. Fournisseurs → fiche → solde dû, commandes, factures.
2. Il décide des paiements et les note.

**Éléments de l'écran.** Fiche ; solde ; commandes ; documents.
**Règles.** Prix d'achat visibles du promoteur.

#### F32-PRO. Commandes fournisseurs : validation [NOUVEAU · E]
**Cas de figure.** M. Eto a préparé une commande en brouillon.
**Parcours.**
1. Notification ; il ouvre le brouillon.
2. Il contrôle quantités et prix.
3. Il valide ; la commande est envoyée par WhatsApp côté pharmacie.

**Éléments de l'écran.** Lignes, quantités suggérées, prix, total ; boutons Valider, Refuser, Modifier.
**Règles.** Pas d'envoi sans validation.

#### F34-PRO. Inventaire : validation de l'ajustement [NOUVEAU · E]
**Cas de figure.** Inventaire trimestriel soumis par le magasinier.
**Parcours.**
1. Notification ; il ouvre l'inventaire soumis.
2. Il lit les écarts et les périmés.
3. Il valide l'ajustement : le stock est corrigé et les écarts historisés.

**Éléments de l'écran.** Écarts par produit ; valeur de l'écart ; périmés ; boutons Valider, Refuser, Demander un recomptage.
**Règles.** Tracé.

#### F36-PRO. Tableau de bord du promoteur [NOUVEAU · E]
Voir § 13 F36 : c'est son écran. **Parcours.** Il ouvre le tableau, lit CA, marge, bénéfice, produits rentables et dormants, performance par caisse, ventes par heure, paiements, créances, ruptures, fidélité, comparaison de prix ; il clique l'action liée à chaque indicateur (commander, déstocker, relancer, former).

#### F38-PRO. Alertes [NOUVEAU · E]
**Cas de figure.** Baisse de 40 % des ventes un mardi.
**Parcours.**
1. Il ouvre le centre d'alertes.
2. Il filtre par type et gravité.
3. Il ouvre l'objet concerné, traite, marque Traité.
4. Il règle les seuils.

**Éléments de l'écran.** Centre d'alertes ; seuils ; boutons Traité, Ignorer 24 h.
**Règles.** Alertes aussi par e-mail.

#### F39-PRO. Rapports automatiques [NOUVEAU · E]
**Cas de figure.** Rapport hebdomadaire le lundi.
**Parcours.**
1. Réglages → Rapports : fréquence, format PDF et Excel, destinataires.
2. Il reçoit le rapport par e-mail et notification.
3. Il l'ouvre et agit.

**Éléments de l'écran.** Réglage de fréquence ; liste des envois ; téléchargement.
**Règles.** Dans les limites gratuites.

#### F40-PRO. Espace documents [NOUVEAU · E]
**Cas de figure.** Retrouver la facture d'un fournisseur.
**Parcours.**
1. Documents → recherche par type, fournisseur, date.
2. Il ouvre, voit les versions, règle le partage selon les rôles.
3. Il ajoute un document.

**Éléments de l'écran.** Dossiers ; recherche ; aperçu ; versions ; partage par rôle ; journal d'accès.
**Règles.** Liens internes uniquement ; aucune ordonnance ni donnée patient.

#### F41-PRO. Tâches et commentaires [NOUVEAU · E]
**Cas de figure.** Demander une explication d'un écart de caisse.
**Parcours.**
1. Sur la clôture, il écrit un commentaire avec mention (@Ngo).
2. Il crée une tâche (rôle ou personne, échéance).
3. Il suit le statut.

**Éléments de l'écran.** Fil de commentaires ; création de tâche ; liste des tâches ; notifications.
**Règles.** Aucune donnée de santé nominative.

#### F42-PRO. Journal d'audit [NOUVEAU · B]
**Cas de figure.** Qui a modifié un prix ?
**Parcours.**
1. Journal → filtre par date, personne, type.
2. Il ouvre la ligne : qui, quand, pourquoi.
3. Il exporte si besoin.

**Éléments de l'écran.** Table ; filtres ; lien vers l'objet ; export.
**Règles.** Non modifiable.

#### F43-PRO. Sauvegardes [NOUVEAU · B]
**Cas de figure.** Avant une mise à jour, il veut une copie.
**Parcours.**
1. Sauvegardes → Exporter maintenant.
2. Il télécharge l'export chiffré.
3. Il lit la liste des exports quotidiens et le journal de restauration.

**Éléments de l'écran.** Bouton Exporter ; liste des exports ; journal.
**Règles.** Test de restauration trimestriel.

#### F54-PRO. Livraison : activation [NOUVEAU · F]
**Cas de figure.** La pharmacie embauche un livreur.
**Parcours.**
1. Réglages → Livraison (désactivée par défaut).
2. Il lit la mention de responsabilité, définit zone et frais, active.
3. La caisse voit les réservations « livraison ».

**Éléments de l'écran.** Interrupteur ; zone ; frais ; mention de responsabilité.
**Règles.** La pharmacie assume son livreur ; tracé.

#### F58-PRO. Réglages de la pharmacie [NOUVEAU · B]
Voir § 13 F58 : c'est son écran. **Parcours.** Réglages → il modifie durée de réservation (1 à 3 h), seuil de péremption, plafond de remise, délai de verrouillage, durée de conservation des ordonnances, livraison, fréquence des rapports → il enregistre → le changement s'applique à toutes les caisses et est tracé.


#### F63-PRO. Payer l'abonnement par Mobile Money [NOUVEAU · H]
**Cas de figure.** M. Fouda reçoit le rappel « échéance dans 3 jours ».
**Parcours.**
1. Rappels par notification et e-mail à J-7, J-3 et J-1.
2. Abonnement → écran d'état : formule négociée, montant convenu, échéance, historique, reçus.
3. Il appuie sur **Payer maintenant**, choisit l'opérateur et saisit son numéro Mobile Money.
4. NAXA envoie la demande de paiement par l'API ; l'écran passe à « en attente de confirmation ».
5. Il confirme sur son téléphone, avec son code secret saisi **chez l'opérateur** (jamais dans NAXA).
6. L'opérateur notifie NAXA : statut « payé », échéance suivante calculée, **reçu PDF** généré.
7. Refus, solde insuffisant ou délai dépassé : message clair et bouton Réessayer ; aucun double débit possible.

**Éléments de l'écran.** État (essai, à jour, échéance, en retard) ; montant ; bouton Payer maintenant ; choix de l'opérateur ; champ numéro (masqué ensuite) ; statut de la transaction (en attente, payé, échoué, expiré) ; historique ; reçus téléchargeables ; contact support.
**Règles.** Voir les règles techniques de F63 ; le promoteur est le seul à payer ; tout est tracé.

#### F64-PRO. Rappel de lot : déclenchement et clôture [NOUVEAU · E]
**Cas de figure.** Lundi, M. Fouda reçoit un avis de retrait du lot B1234.
**Parcours.**
1. Il ouvre Rappels de lot → Déclarer ; il choisit le produit et le lot, saisit le motif et la source de l'avis.
2. Le système affiche le stock restant du lot et les ventes concernées (date, quantité) ; le lot passe en quarantaine, la vente en est bloquée.
3. Il décide pour chaque quantité : retour fournisseur ou destruction (sortie F12).
4. Il clôture le rappel quand tout est traité ; état et preuve conservés.

**Éléments de l'écran.** Formulaire de déclaration ; stock restant du lot ; liste des ventes concernées (sans donnée de santé nominative) ; boutons Quarantaine, Retour fournisseur, Destruction, Clôturer ; historique des rappels.
**Règles.** Seul le promoteur clôture ; l'assistant et le magasinier peuvent déclarer ; les ordonnances concernées sont consultables seulement par l'assistant et le promoteur (F65) ; tracé.

#### F65-PRO. Ordonnancier : contrôle et export [NOUVEAU · C]
**Cas de figure.** M. Fouda prépare un contrôle de l'inspection pharmaceutique.
**Parcours.** 1. Il ouvre l'Ordonnancier, filtre la période. 2. Il vérifie l'absence de trou dans la numérotation. 3. Il exporte le registre en PDF. 4. Il ouvre une ordonnance au coffre (F18) si besoin.
**Éléments de l'écran.** Même écran que F65 (assistant), plus : indicateur de continuité de la numérotation, bouton Exporter, durée de conservation réglée en F58.
**Règles.** Accès à toutes les lignes de **sa** pharmacie ; aucune modification possible ; tracé.

#### F66-PRO. Trésorerie et dépenses [NOUVEAU · E]
**Cas de figure.** M. Fouda veut savoir s'il peut payer les salaires et le grossiste en fin de mois.
**Parcours.**
1. Il valide ou refuse les demandes de petite caisse (F23, F24).
2. Il saisit les charges (loyer, salaires, électricité, eau, internet) avec justificatif ; il note les entrées et sorties de banque et de Mobile Money.
3. Il lit le solde de trésorerie par jour et par mois, avec les échéances à venir (fournisseurs F31, abonnement F63).

**Éléments de l'écran.** Journal des mouvements (caisse, banque, Mobile Money) ; saisie d'une charge ; solde ; échéances ; écarts avec les clôtures Z ; export.
**Règles.** Tout mouvement a un motif et, si possible, un justificatif (F40) ; une charge saisie ne se supprime pas, elle s'annule par contre-écriture ; tracé.

#### F67-PRO. Marges, coût moyen et pertes [NOUVEAU · E]
**Cas de figure.** Une alerte indique que le prix d'achat de l'amoxicilline a augmenté de 9 %.
**Parcours.** 1. Il ouvre la marge du produit. 2. Il compare coût moyen pondéré et prix de vente. 3. Il modifie le prix de vente (F05-PRO) s'il le décide. 4. Il lit les pertes du mois par motif.
**Éléments de l'écran.** Marge par produit et par famille ; historique des prix d'achat ; pertes (valeur) par motif ; valeur du stock ; alertes de marge.
**Règles.** Le promoteur est seul à modifier un prix de vente ; aucun changement de prix automatique ; tracé.

#### F68-PRO. Fiche client : plafonds et crédit [NOUVEAU · D]
**Cas de figure.** M. Talla dépasse son plafond de crédit.
**Parcours.** 1. La demande arrive dans sa file (F23). 2. Il voit solde, plafond, ancienneté de la dette. 3. Il accepte ou refuse par empreinte ou PIN (F24). 4. Il modifie le plafond d'un client si nécessaire.
**Éléments de l'écran.** Liste des clients à crédit ; solde et âge des dettes ; plafond par client et plafond par défaut (F58) ; relances à faire.
**Règles.** Aucune donnée de santé dans la fiche affichée ici ; tracé.

#### F69-PRO. Planning, gardes et présences [NOUVEAU · K]
**Cas de figure.** M. Fouda construit le planning du mois et la garde du week-end.
**Parcours.** 1. Il crée les postes et gardes. 2. Il valide les échanges demandés (F23). 3. Il lit les présences et heures. 4. Il définit les commissions éventuelles.
**Éléments de l'écran.** Calendrier équipe ; conflits de planning ; présences ; heures ; commissions ; formations.
**Règles.** Données de **sa** pharmacie ; tracé.

#### F70-PRO. Vue groupe et transferts [NOUVEAU · K]
**Cas de figure.** M. Fouda suit deux pharmacies depuis un seul compte.
**Parcours.** 1. Il bascule d'une pharmacie à l'autre ou ouvre la vue groupe. 2. Il valide un transfert. 3. Il lit le stock et le chiffre d'affaires consolidés.
**Éléments de l'écran.** Sélecteur de pharmacie ; vue consolidée ; transferts ; centrale d'achat (commandes groupées, si décidée).
**Règles.** Isolation des données conservée entre pharmacies ; aucune donnée d'un autre promoteur ; tracé.

#### F71-PRO. Fournisseurs avancés : arbitrage et paiements [NOUVEAU · K]
**Cas de figure.** Le grossiste B est moins cher mais livre plus tard.
**Parcours.** 1. Il lit la comparaison de prix et les délais. 2. Il valide un retour fournisseur ou un avoir. 3. Il décide les paiements selon l'échéancier, hors application.
**Éléments de l'écran.** Comparatif ; litiges ; échéancier ; avoirs attendus.
**Règles.** Aucun paiement exécuté dans NAXA ; tracé.

#### F72-PRO. Produits et services hors médicaments : prix [NOUVEAU · K]
**Cas de figure.** M. Fouda crée le service « prise de tension » et fixe son prix.
**Parcours.** 1. Il crée une catégorie ou un service. 2. Il fixe le prix et la taxe applicable. 3. Il marque un prix réglementé si c'est le cas. 4. Il lit les ventes par catégorie.
**Éléments de l'écran.** Catalogue hors médicaments ; fiche service ; prix, taxe, coefficient ; ventes par catégorie.
**Règles.** Prix et coefficients réglementaires **à vérifier** ; tracé.

#### F73-PRO. Qualité : analyse et clôture [NOUVEAU · K]
**Cas de figure.** M. Fouda reçoit trois réclamations sur un même produit.
**Parcours.** 1. Il lit les déclarations (erreur évitée, incident, réclamation). 2. Il affecte une analyse à l'assistant. 3. Il décide l'action corrective et clôture. 4. Il lit les indicateurs (nombre, délai de traitement).
**Éléments de l'écran.** Liste filtrable ; fiche de déclaration ; actions correctives ; indicateurs ; chaîne du froid (écarts) ; retours de médicaments non utilisés.
**Règles.** Pas de donnée nominative de patient ; tracé.

#### F74-PRO. Communication client : modèles et consentements [À ARBITRER · K]
**Cas de figure.** M. Fouda veut prévenir les clients quand une réservation est prête. En attente du cadre légal (décision du fondateur, 06/10/2026).
**Parcours.** 1. Il choisit les modèles de messages. 2. Il active les canaux autorisés. 3. Il lit les consentements et les avis reçus.
**Éléments de l'écran.** Modèles ; canaux ; consentements (nombre, date) ; messages envoyés ; avis et réclamations.
**Règles.** Aucun message sans consentement ; aucun contenu de santé ; tracé.

#### F75-PRO. Prévision : validation des commandes [NOUVEAU · K]
**Cas de figure.** La suggestion saisonnière propose de doubler la commande d'antipaludéens.
**Parcours.** 1. Il lit la suggestion et sa fiabilité. 2. Il valide, modifie ou refuse par empreinte ou PIN (F24).
**Éléments de l'écran.** Même écran que F32-PRO, plus la courbe saisonnière.
**Règles.** Suggestion jamais décisive ; tracé.

### 14.2 Pharmacien assistant (ASS)

**Boucle de l'assistant.** Connexion → Accueil assistant → file des ordonnances → validation ou rejet → ventes → demandes → retour à l'Accueil → fin de poste : verrouillage → lendemain.

**Fiches où l'assistant utilise les mêmes écrans que la caissière** (§ 13) : F03 réservations, F04 statut de garde, F14 vente et scan, F15 caisse rapide, F20 paiements, F21 ticket, F22 demande d'annulation, F23 Mes demandes. Différences : il valide les ordonnances ; **il ne fait pas la clôture** (réservée à la caisse et au promoteur) ; il ne voit ni finances ni marges.

#### F00-ASS. Accueil de l'assistant [NOUVEAU · B]
**Cas de figure.** 8 h 15, Mlle Biya prend son poste ; trois ordonnances attendent.
**Parcours.**
1. Elle arrive sur l'Accueil.
2. Elle lit le compteur « Ordonnances à valider » et les alertes de sécurité.
3. Elle ouvre la file ou démarre une vente.
4. Elle revient à l'Accueil après chaque action.

**Éléments de l'écran.** Compteur d'ordonnances (avec la plus ancienne en attente) ; Nouvelle vente ; Réservations ; Mes demandes ; stock en lecture ; alertes de sécurité ; indicateur réseau.
**Règles.** Aucune donnée financière.

#### F05-ASS. Stock en lecture [NOUVEAU · B]
**Cas de figure.** Elle cherche un équivalent générique pendant une validation.
**Parcours.**
1. Stock → recherche par nom ou molécule (F08).
2. Elle lit quantités, prix de vente, statut.
3. Elle revient à l'ordonnance.

**Éléments de l'écran.** Liste du stock sans bouton de modification ; pastilles de statut.
**Règles.** Lecture seule ; aucun prix d'achat.

#### F13-ASS. Produit réglementé : validation [NOUVEAU · C]
**Cas de figure.** Ordonnance contenant un stupéfiant.
**Parcours.**
1. Dans la file, le produit porte « réglementé ».
2. Elle vérifie les mentions de l'ordonnance.
3. Elle valide et **confirme sa responsabilité**.
4. La sortie s'inscrit au registre.

**Éléments de l'écran.** Bandeau « produit réglementé » ; case de confirmation de responsabilité ; boutons Valider, Rejeter.
**Règles.** Pas de vente sans sa validation ; registre non modifiable.

#### F16-ASS. Remise dans son plafond [NOUVEAU · C]
Même écran que F16 (§ 13). Plafond fixé par le promoteur ; au-delà, demande au promoteur ; tracé.

#### F17-ASS. File de validation des ordonnances [NOUVEAU · C]
**Cas de figure.** Ordonnance de trois médicaments dont un antibiotique, déposée par Mme Ngo.
**Parcours.**
1. File des ordonnances → elle ouvre la plus ancienne.
2. Visionneuse : elle zoome, vérifie date, prescripteur, produits, quantités.
3. Elle coche chaque ligne conforme ; les **alertes de sécurité** s'affichent (contrôle d'interactions seulement si une base sous licence est branchée).
4. Elle choisit : **Valider**, **Rejeter** (motif obligatoire) ou **Signaler au promoteur**.
5. La vente se débloque à la caisse, ou la caisse lit le motif du rejet.

**Éléments de l'écran.** File (heure, caisse, produits concernés, ancienneté) ; visionneuse zoomable ; lignes cochables ; alertes de sécurité ; boutons Valider, Rejeter, Signaler ; champ motif ; historique.
**Règles.** Comptable sans accès ; chaque ouverture est tracée dans le coffre (F18) ; aide de lecture (OCR) plus tard, jamais décisive.

#### F18-ASS. Coffre ordonnances [NOUVEAU · B-C]
**Cas de figure.** Elle doit relire une ordonnance validée hier.
**Parcours.**
1. Coffre → recherche par date ou vente.
2. Elle ouvre l'ordonnance ; la consultation est tracée.
3. Retour à l'Accueil.

**Éléments de l'écran.** Liste ; visionneuse ; échéance de conservation.
**Règles.** Accès assistant et promoteur seulement.

#### F25-ASS. Vente assurée [NOUVEAU · D]
Même écran que F25 (§ 13) : elle vérifie les droits sur le portail officiel, note le résultat, calcule les parts ; la part assureur devient une créance.

#### F41-ASS. Tâches et commentaires [NOUVEAU · E]
Même écran que F41 (§ 13) : elle reçoit les mentions et répond, sans accès aux données hors de son périmètre.

#### F64-ASS. Rappel de lot : ordonnances concernées [NOUVEAU · E]
**Cas de figure.** Le lot B1234 a été dispensé sur ordonnance à cinq patients.
**Parcours.** 1. Elle peut déclarer un rappel (même écran que F64-PRO, sans clôture). 2. Elle ouvre la liste des ordonnances concernées (numéros d'ordre F65). 3. Elle consulte le coffre (F18) si besoin. 4. Elle prévient le promoteur de la suite à donner.
**Éléments de l'écran.** Déclaration ; liste des ordonnances concernées ; état du rappel.
**Règles.** Elle ne clôture pas ; aucune donnée financière ; tracé.

#### F65-ASS. Ordonnancier [NOUVEAU · C]
**Cas de figure.** Mlle Biya doit retrouver l'ordonnance n° 0412.
**Parcours.** Voir F65. 1. Recherche par numéro, date ou produit. 2. Lecture de la ligne et du lien vers le coffre (F18). 3. Retour à l'Accueil.
**Éléments de l'écran.** Écran F65, sans export ni réglage de conservation.
**Règles.** Lecture seule ; tracé de chaque consultation.

#### F68-ASS. Suivi des traitements chroniques [À ARBITRER · K]
**Cas de figure.** Mlle Biya voudrait voir les patients à traitement régulier. Aucune construction avant vérification du cadre légal des données de santé.
**Parcours.** Non défini tant que le cadre n'est pas validé. Vérification d'accès refusé pour tous les autres profils.
**Éléments de l'écran.** Aucun.
**Règles.** Même condition que la fidélisation (§ 3).

#### F69-ASS / F69-MAG. Planning, gardes et présences [NOUVEAU · K]
**Cas de figure.** Mlle Biya ou M. Eto consulte son planning et demande un échange.
**Parcours.** Même écran que F69 (caissière). Différence : aucune. Chacun ne voit que **son** planning et le planning général de l'équipe, pas les commissions des autres.
**Règles.** Tracé.

#### F73-ASS. Qualité : analyse [NOUVEAU · K]
**Cas de figure.** Une erreur évitée de justesse est déclarée par la caisse.
**Parcours.** 1. Elle ouvre la déclaration. 2. Elle note l'analyse (cause, risque). 3. Elle propose une action. 4. Elle transmet au promoteur.
**Éléments de l'écran.** Liste filtrable ; fiche ; champ analyse ; bouton Transmettre.
**Règles.** Pas de donnée nominative de patient ; elle ne clôture pas ; tracé.

### 14.3 Magasinier (MAG)

**Boucle du magasinier.** Connexion → Accueil magasinier → alertes de rupture → commande en brouillon → (validation du promoteur) → réception → entrée en lots → péremptions → inventaire → retour à l'Accueil → fin de poste.

**Fiches où le magasinier utilise les mêmes écrans que la caissière** (§ 13) : F05 stock (avec prix d'achat), F06 import, F09 entrée de stock. Différences : il voit les **prix d'achat** et la valeur du stock ; il **ne vend pas** ; il ne voit ni ventes détaillées, ni clients, ni ordonnances.

#### F00-MAG. Accueil du magasinier [NOUVEAU · B]
**Cas de figure.** 8 h 00, M. Eto prépare la journée d'approvisionnement.
**Parcours.**
1. Il arrive sur l'Accueil.
2. Il lit ruptures, péremptions proches, commandes en cours.
3. Il ouvre l'alerte la plus urgente.
4. Il revient à l'Accueil après chaque action.

**Éléments de l'écran.** Alertes de rupture ; lots proches de péremption ; commandes (brouillon, envoyée, livrée partielle, livrée) ; réceptions attendues ; inventaire en cours ; mes tâches.
**Règles.** Aucune donnée de vente.

#### F05-MAG. Stock, prix d'achat et valeur du stock [NOUVEAU · B]
**Cas de figure.** Il veut connaître la valeur du stock.
**Parcours.**
1. Stock → il affiche prix d'achat et valeur par ligne.
2. Il filtre par fournisseur, statut, péremption.
3. Il exporte la liste si besoin.

**Éléments de l'écran.** Colonnes prix d'achat, prix de vente (lecture), quantité, valeur ; filtres ; lots.
**Règles.** Pas de marges ; pas de modification de prix.

#### F06-MAG. Import du catalogue et du stock [EXISTANT, étendu · B]
Même écran que F06 (§ 13), il en est l'acteur principal : fichier → association des colonnes → contrôle ligne par ligne → rapport → confirmation → rapport final.

#### F09-MAG. Entrée de stock par lot [NOUVEAU · B]
Même écran que F09 (§ 13). Différence : il voit le **prix d'achat** et peut le saisir.

#### F10-MAG. Alertes de stock [NOUVEAU · B]
**Cas de figure.** Un produit passe en alerte.
**Parcours.**
1. Alerte → il ouvre la fiche.
2. Il lit quantité, lots, ventes récentes.
3. Il crée la commande (F32-MAG) ou commente (F41).

**Éléments de l'écran.** Liste filtrable ; seuil ; lien vers commande.
**Règles.** Seuils réglés par le promoteur.

#### F11-MAG. Lots proches de péremption [NOUVEAU · E]
**Cas de figure.** Lot de sirop à 45 jours.
**Parcours.**
1. Liste des lots proches de péremption.
2. Il prépare le retour fournisseur si le promoteur le décide (F11-PRO).
3. Il enregistre la sortie.

**Éléments de l'écran.** Liste ; bouton Préparer le retour ; sortie exceptionnelle.
**Règles.** Décision du promoteur ; tracé.

#### F12-MAG. Sortie exceptionnelle (demande) [NOUVEAU · C]
Même écran que F12 (§ 13) : demande avec motif, validée par le promoteur.

#### F13-MAG. Registre des stupéfiants : comptage [NOUVEAU · C]
**Cas de figure.** Inventaire des produits réglementés.
**Parcours.**
1. Inventaire → section « réglementés » comptée à part.
2. Il compare avec le solde du registre.
3. Il soumet les écarts au promoteur.

**Éléments de l'écran.** Solde théorique ; champ compté ; écart.
**Règles.** Il ne modifie jamais le registre.

#### F31-MAG. Fournisseurs [NOUVEAU · E]
**Cas de figure.** Nouveau grossiste.
**Parcours.**
1. Fournisseurs → Créer : nom, contact, conditions.
2. Il consulte commandes et solde (lecture de la dette).

**Éléments de l'écran.** Fiche fournisseur ; liste des commandes ; documents liés.
**Règles.** Modification des paiements réservée au promoteur.

#### F32-MAG. Commande fournisseur [NOUVEAU · E]
**Cas de figure.** Paracétamol : 40 boîtes vendues par semaine, 25 en stock.
**Parcours.**
1. Alerte de rupture → quantité suggérée d'après les ventes.
2. Il crée la commande en **brouillon** et l'enrichit.
3. Il la soumet ; le promoteur la valide (F32-PRO).
4. Une fois validée, envoi au fournisseur par WhatsApp côté pharmacie.
5. Il suit le statut : envoyée, livrée partielle, livrée.

**Éléments de l'écran.** Alertes ; lignes (produit, quantité suggérée, quantité commandée, prix d'achat) ; fournisseur ; statuts ; boutons Soumettre, Envoyer par WhatsApp.
**Règles.** Pas d'envoi sans validation du promoteur.

#### F33-MAG. Réception et contrôle du bon de livraison [NOUVEAU · E]
**Cas de figure.** Livraison avec trois lignes en moins.
**Parcours.**
1. Réceptions → il choisit la commande.
2. Il contrôle le bon contre la commande, ligne par ligne.
3. Il saisit lots et péremptions (obligatoires).
4. Il valide : statut « livrée partielle » ou « livrée » ; le stock monte.
5. Il photographie le bon et le classe (F40).

**Éléments de l'écran.** Colonnes commandé / reçu / écart ; lot ; péremption ; photo du bon ; bouton Valider la réception.
**Règles.** Pas d'entrée sans lot ni péremption ; écarts signalés au promoteur.

#### F34-MAG. Inventaire [NOUVEAU · E]
**Cas de figure.** Inventaire trimestriel.
**Parcours.**
1. Inventaire → Lancer : liste théorique.
2. Il compte et saisit les quantités.
3. Les écarts et les périmés apparaissent.
4. Il soumet au promoteur.

**Éléments de l'écran.** Liste théorique ; champ compté ; écart ; périmés ; réglementés à part ; bouton Soumettre.
**Règles.** L'ajustement n'est appliqué qu'après validation du promoteur.

#### F40-MAG. Documents : bons de livraison et factures [NOUVEAU · E]
Même écran que F40 (§ 13) : il classe bons de livraison et factures fournisseurs ; accès limité à son périmètre.

#### F41-MAG. Tâches et commentaires [NOUVEAU · E]
Même écran que F41 (§ 13) : commentaires sur commande, réception, inventaire.

#### F56-MAG. Scan de bon de livraison (IA) [NOUVEAU · G]
Même écran que F56 (§ 13) : l'IA propose les lignes, il corrige et valide ; contrôle humain obligatoire.

#### F64-MAG. Rappel de lot : quarantaine et retour fournisseur [NOUVEAU · E]
**Cas de figure.** M. Eto doit isoler les boîtes du lot B1234.
**Parcours.** 1. Il déclare ou ouvre le rappel. 2. Il lit le stock restant du lot et l'emplacement. 3. Il compte, isole et saisit les quantités. 4. Il prépare le retour fournisseur (F71).
**Éléments de l'écran.** Stock restant du lot ; saisie des quantités isolées ; bouton Préparer le retour.
**Règles.** Il ne voit ni les ventes détaillées ni les clients ; il ne clôture pas ; tracé.

#### F66-MAG. Dépense liée aux achats [NOUVEAU · E]
**Cas de figure.** M. Eto paie un transport de marchandises avec la petite caisse.
**Parcours.** Mêmes étapes que F66 (demande, motif, justificatif, validation du promoteur). Il ne voit ni solde de trésorerie ni banque.
**Règles.** Tracé.

#### F67-MAG. Coût d'achat, historique et pertes [NOUVEAU · E]
**Cas de figure.** M. Eto contrôle le prix d'achat d'un produit avant de commander.
**Parcours.** 1. Il ouvre la fiche produit. 2. Il lit le coût moyen pondéré et l'historique par fournisseur. 3. Il lit la valeur du stock et les pertes par motif.
**Éléments de l'écran.** Coût moyen pondéré ; courbe historique ; valeur du stock ; pertes.
**Règles.** Il ne voit **pas** les marges ni les ventes ; tracé.

#### F70-MAG. Transferts entre sites [NOUVEAU · K]
**Cas de figure.** M. Eto prépare un envoi vers l'autre pharmacie.
**Parcours.** Même écran que F70 (caissière), avec en plus la préparation par lot. 
**Règles.** Pas de vente ; tracé.

#### F71-MAG. Fournisseurs avancés [NOUVEAU · K]
**Cas de figure.** Le grossiste A livre des boîtes cassées.
**Parcours.** 1. Il compare les prix. 2. Il crée un retour avec motif et photo. 3. Il suit avoir et litige. 4. Il lit les échéances.
**Éléments de l'écran.** Écran F71 complet, sauf décision de paiement.
**Règles.** Aucun paiement ; tracé.

#### F72-MAG. Catalogue hors médicaments [NOUVEAU · K]
**Cas de figure.** M. Eto crée la fiche d'un tensiomètre.
**Parcours.** 1. Il crée la fiche (catégorie, fournisseur, prix d'achat). 2. Il entre le stock par lot ou par quantité. 3. Il suit les alertes de stock.
**Règles.** Le prix de vente reste décidé par le promoteur ; tracé.

#### F73-MAG. Chaîne du froid et médicaments non utilisés [NOUVEAU · K]
**Cas de figure.** Le réfrigérateur d'insuline affiche une température hors limite.
**Parcours.** 1. Il saisit le relevé de température du jour. 2. En cas d'écart, une alerte part au promoteur. 3. Il isole les produits concernés (sortie F12 sur validation). 4. Il enregistre les médicaments non utilisés rapportés par des clients, à retourner selon la filière prévue.
**Éléments de l'écran.** Relevés par date ; seuils ; alerte ; liste des médicaments non utilisés.
**Règles.** Relevés manuels, aucun capteur supposé ; filière de retour **à vérifier** ; tracé.

#### F75-MAG. Prévision saisonnière [NOUVEAU · K]
**Cas de figure.** M. Eto prépare la commande de la saison des pluies.
**Parcours.** Même écran que F32-MAG, plus la courbe saisonnière et la fiabilité de la prévision ; le promoteur valide.
**Règles.** Suggestion seulement ; tracé.

### 14.4 Comptable (CPT)

**Boucle du comptable.** Connexion → Accueil comptable → journal des ventes → filtres → exports → bordereaux d'assureurs → créances et rejets → journal d'audit en lecture → retour à l'Accueil → fin de poste. Il ne voit jamais de donnée de santé nominative.

#### F00-CPT. Accueil du comptable [NOUVEAU · E]
**Cas de figure.** Début de mois, Mme Kamga prépare les bordereaux.
**Parcours.**
1. Elle arrive sur l'Accueil.
2. Elle lit créances en cours, bordereaux à préparer, rejets.
3. Elle ouvre le sujet utile.
4. Retour à l'Accueil.

**Éléments de l'écran.** Cartes : ventes du mois, TVA à déclarer, créances par assureur ; bordereaux à générer ; rejets ; exports récents ; journal d'audit (lecture).
**Règles.** Lecture seule sur tout, sauf bordereaux et créances ; aucune donnée de santé.

#### F60-CPT. Journal des ventes, TVA et exports [NOUVEAU · E]
**Cas de figure.** Fin de trimestre : elle prépare la déclaration.
**Parcours.**
1. Journal des ventes → filtres : période, caisse, mode de paiement, assureur.
2. Elle lit lignes, TVA, remises, marges et bénéfices (**en lecture**).
3. Elle exporte en Excel ou PDF.
4. Elle consulte les clôtures de caisse (lecture) pour rapprocher les encaissements.

**Éléments de l'écran.** Filtres ; tableau (date, ticket, montant, TVA, remise, mode de paiement, caisse) ; marges (lecture) ; boutons Export Excel, Export PDF ; rapprochement avec les clôtures.
**Règles.** **Aucune donnée nominative de santé** (pas d'ordonnance, pas d'historique patient) ; exports tracés ; les exports sont réservés au comptable et au promoteur.

#### F29-CPT. Créances et bordereaux [NOUVEAU · D]
**Cas de figure.** 140 ventes CNPS à facturer.
**Parcours.**
1. Bordereaux → assureur et période.
2. Elle contrôle les lignes et génère le bordereau (PDF, Excel, **format imposé par l'assureur**).
3. Elle le soumet au promoteur (F29-PRO) puis le dépose.
4. Elle suit le statut : en attente, déposé, payé, rejeté.

**Éléments de l'écran.** Filtres ; liste des créances ; aperçu ; export ; total par assureur ; suivi de dépôt.
**Règles.** Modèles à récupérer auprès de chaque assureur.

#### F30-CPT. Rejets et rappels de créances [NOUVEAU · D]
**Cas de figure.** Bordereau rejeté pour pièce manquante.
**Parcours.**
1. Liste des rejets → elle ouvre le motif.
2. Elle crée une tâche pour la caisse (F41) afin de retrouver la pièce.
3. Elle redépose le bordereau.
4. Elle relance les créances anciennes.

**Éléments de l'écran.** Rejets (assureur, motif, date) ; plafond par assuré ; historique par assuré ; bouton Relancer.
**Règles.** Alerte de créance ancienne.

#### F28-CPT / F31-CPT / F32-CPT. Assureurs, fournisseurs, commandes (lecture) [NOUVEAU · D-E]
**Cas de figure.** Elle vérifie le taux d'un assureur et le montant d'une facture fournisseur avant un rapprochement.
**Parcours.** Elle consulte les fiches assureurs (taux, plafonds), les fournisseurs et leurs commandes **sans pouvoir modifier** ; elle voit les prix d'achat en lecture.

#### F26-CPT. Clôtures de caisse (lecture) [NOUVEAU · C]
**Cas de figure.** Elle rapproche les encaissements du mois des clôtures.
**Parcours.** Clôtures → elle lit totaux, écart, motif, rapport PDF ; elle ne modifie rien.

#### F39-CPT. Rapports et exports planifiés [NOUVEAU · E]
**Cas de figure.** Elle a besoin du rapport mensuel pour l'expert-comptable.
**Parcours.** Elle reçoit les rapports du promoteur ou en demande ; elle les télécharge en PDF et Excel.

#### F40-CPT et F41-CPT. Documents et tâches [NOUVEAU · E]
**Cas de figure.** Elle cherche la facture d'un fournisseur et assigne une tâche à la caisse.
**Parcours.** Documents : elle consulte et exporte factures, bordereaux, rapports de clôture selon ses droits ; jamais d'ordonnance. Tâches : elle reçoit et crée des tâches liées aux bordereaux et créances.

#### F42-CPT. Journal d'audit (lecture) [NOUVEAU · B]
**Cas de figure.** Elle vérifie qui a validé une remise exceptionnelle.
**Parcours.**
1. Journal → filtre.
2. Elle lit qui, quand, pourquoi.
3. Elle exporte la ligne.

**Éléments de l'écran.** Table ; filtres ; export.
**Règles.** Lecture seule.


#### F63-CPT. Reçus d'abonnement [NOUVEAU · H]
**Cas de figure.** Mme Kamga cherche le reçu de l'abonnement NAXA pour sa comptabilité.
**Parcours.**
1. Documents → Reçus d'abonnement.
2. Elle filtre par période.
3. Elle télécharge le reçu PDF ou l'exporte avec le journal.

**Éléments de l'écran.** Liste des reçus (date, montant, référence) ; filtre ; téléchargement.
**Règles.** Lecture seule ; aucun numéro de téléphone Mobile Money visible.

#### F64-CPT. Rappel de lot : valeur et avoirs [NOUVEAU · E]
**Cas de figure.** Mme Kamga doit comptabiliser l'avoir du fournisseur après le retrait du lot B1234.
**Parcours.** 1. Elle ouvre le rappel en lecture. 2. Elle lit la valeur du stock retiré et l'avoir attendu. 3. Elle rapproche l'avoir reçu.
**Règles.** Lecture seule ; aucune donnée de santé ; aucune ordonnance ; tracé.

#### F66-CPT. Trésorerie : rapprochement et exports [NOUVEAU · E]
**Cas de figure.** Mme Kamga prépare le bilan du mois.
**Parcours.** 1. Elle ouvre le journal des mouvements. 2. Elle filtre par catégorie et période. 3. Elle compare avec les clôtures Z et la banque. 4. Elle exporte en Excel ou PDF.
**Éléments de l'écran.** Journal, filtres, solde, écarts, bouton Exporter.
**Règles.** Lecture et export seulement ; tracé.

#### F67-CPT. Valeur du stock et pertes (lecture) [NOUVEAU · E]
**Cas de figure.** Mme Kamga valorise le stock à la date de clôture.
**Parcours.** 1. Elle lit la valeur à une date. 2. Elle lit les pertes par motif. 3. Elle exporte.
**Règles.** Lecture seule ; tracé.

#### F68-CPT. Créances clients [NOUVEAU · D]
**Cas de figure.** Mme Kamga suit les crédits clients du mois.
**Parcours.** 1. Elle ouvre la liste des soldes. 2. Elle lit l'âge des dettes et les règlements. 3. Elle exporte.
**Éléments de l'écran.** Soldes par client (nom, montant, ancienneté) ; règlements.
**Règles.** Aucune donnée de santé ni historique d'achats détaillé ; tracé.

#### F69-CPT. Présences et commissions (lecture) [NOUVEAU · K]
**Cas de figure.** Mme Kamga prépare les salaires.
**Parcours.** 1. Elle lit présences, heures et commissions par employé. 2. Elle exporte.
**Règles.** Lecture et export ; tracé.

#### F70-CPT. Vue groupe consolidée (lecture) [NOUVEAU · K]
**Cas de figure.** Mme Kamga consolide deux pharmacies.
**Parcours.** Même écran que le journal des ventes (F60) avec sélecteur de site ; lecture et export.
**Règles.** Isolation conservée ; tracé.

#### F71-CPT. Avoirs, litiges et échéances (lecture) [NOUVEAU · K]
**Cas de figure.** Mme Kamga prépare les paiements du mois.
**Parcours.** Elle lit l'échéancier, les avoirs et les litiges ouverts, puis exporte.
**Règles.** Lecture seule ; tracé.

#### F72-CPT. TVA et ventes par catégorie [NOUVEAU · K]
**Cas de figure.** Mme Kamga sépare médicaments, parapharmacie et services.
**Parcours.** Elle filtre le journal des ventes (F60) par catégorie et exporte avec la taxe applicable.
**Règles.** Taux et règles fiscales **à vérifier** ; tracé.

#### F65-CPT / F73-CPT / F74-CPT / F75-CPT. Accès refusé [NOUVEAU]
**Cas de figure.** Mme Kamga tente d'ouvrir l'ordonnancier, les déclarations qualité, les messages clients ou les prévisions de commande.
**Règles.** Accès **refusé côté serveur** (ordonnancier et qualité contiennent des données de santé ou de personnel) ; un test le vérifie.

### 14.5 Administrateur NAXA (ADM)

**Boucle de l'administrateur.** Connexion → Accueil administrateur → création ou suivi d'une pharmacie → prix négocié et fin d'essai → suivi de la mise en route → support (accès tracé) → tableau réseau, impayés → retour à l'Accueil → fin de journée. Il ne pilote pas les stocks et ne voit aucune donnée de santé nominative.

#### F00-ADM. Accueil de l'administrateur (`/admin`) [EXISTANT, étendu · H]
**Cas de figure.** Lundi matin, l'administrateur prépare sa semaine.
**Parcours.**
1. Il arrive sur `/admin`.
2. Il lit les pharmacies en essai, les échéances, les impayés, les demandes de support.
3. Il ouvre l'élément prioritaire.
4. Retour à l'Accueil après chaque action.

**Éléments de l'écran.** Liste des pharmacies (statut : essai, active, impayée, retirée) ; compteurs d'essais qui finissent ; impayés ; demandes de support ; raccourci Créer une pharmacie ; vue réseau.
**Règles.** Données agrégées et anonymisées ; accès aux données d'une pharmacie limité au support, tracé.

#### F61-ADM. Création de la pharmacie et du promoteur [EXISTANT · conservé, étendu en H]
**Cas de figure.** Une nouvelle pharmacie signe à Yaoundé.
**Parcours.**
1. `/admin` → Créer une pharmacie.
2. Il saisit nom, adresse, coordonnées, horaires, statut de garde initial.
3. Il crée le compte **Promoteur** avec mot de passe provisoire.
4. Il enregistre ; la pharmacie existe avec son stock vide.
5. Il envoie les identifiants au promoteur, qui crée ses caisses (F02-PRO).

**Éléments de l'écran.** Formulaire pharmacie ; formulaire promoteur ; confirmation ; fiche créée.
**Règles.** **Aucune auto-inscription** ; tracé.

#### F44-ADM. Abonnement et prix négocié [NOUVEAU · H]
**Cas de figure.** Prix négocié avec deux services inclus.
**Parcours.**
1. Fiche de la pharmacie → Abonnement.
2. Il saisit **à la main** : prix convenu, date de début, fin d'essai de 14 jours, échéances.
3. Les paiements arrivent automatiquement par Mobile Money (F63) ; il saisit à la main seulement ceux faits hors API (secours) et suit les impayés.
4. Chaque changement de prix s'ajoute à l'historique.

**Éléments de l'écran.** Prix convenu ; devise (à confirmer) ; début ; fin d'essai ; échéances ; paiements ; impayés ; services inclus ; historique.
**Règles.** Pas de tarif unique ; seul l'administrateur modifie.

#### F45-ADM. Essai de 14 jours et suivi de la mise en route [NOUVEAU · H]
**Cas de figure.** Une pharmacie en essai depuis 10 jours n'a encore fait aucune vente.
**Parcours.**
1. Suivi de mise en route → liste de contrôle (comptes, import, formation, première vente, première clôture).
2. Il repère l'étape manquante.
3. Il déclenche un appel de support ou une formation.
4. À la fin de l'essai, il confirme l'abonnement.

**Éléments de l'écran.** Liste de contrôle ; compte à rebours ; notes ; bouton Planifier une formation.
**Règles.** Tracé.

#### F46-ADM. Services négociés, flyers et WordPress [NOUVEAU · H]
**Cas de figure.** Un flyer par semaine pour une pharmacie.
**Parcours.**
1. Fiche → Services : liste des services convenus.
2. Il prend un modèle de flyer, l'adapte, le dépose dans les documents de la pharmacie.
3. Il note le temps passé ; le plafond de retouches s'affiche.

**Éléments de l'écran.** Services ; modèles ; compteur de retouches ; temps passé.
**Règles.** Règles de publicité des médicaments à vérifier avant production en série.

#### F47-ADM. Retrait d'une pharmacie des recherches [EXISTANT · conservé]
**Cas de figure.** Pharmacie qui ne respecte plus ses engagements.
**Parcours.**
1. Fiche → Retirer des recherches.
2. Il saisit un motif et confirme.
3. La pharmacie disparaît de la marketplace ; son ERP reste utilisable.
4. Il peut la remettre.

**Éléments de l'écran.** Interrupteur ; motif ; journal.
**Règles.** Seul l'administrateur y est habilité ; tracé.

#### F37-ADM. Tableau de bord réseau [NOUVEAU · E]
**Cas de figure.** Trois pharmacies n'ont rien vendu depuis une semaine.
**Parcours.**
1. Vue réseau → filtre « inactives ».
2. Il lit : revenus des abonnements, impayés, couverture de stock, recherches sans résultat, indicateurs de succès (ventes par jour, temps moyen d'une vente, erreurs de synchronisation, adoption par caissier).
3. Il déclenche un support ou une formation.

**Éléments de l'écran.** Cartes agrégées ; carte des pharmacies ; filtres ; indicateurs de succès ; export.
**Règles.** Agrégé et anonymisé.

#### F62-ADM. Support avec accès tracé et limité [NOUVEAU · H]
**Cas de figure.** Un promoteur signale qu'un import échoue.
**Parcours.**
1. Support → il ouvre la demande.
2. Il demande l'accès à la pharmacie pour une durée limitée ; le promoteur est informé.
3. Il consulte **seulement** ce qui est nécessaire (journal d'import, paramètres) ; aucune donnée de santé.
4. Il résout, clôt la demande ; l'accès expire.

**Éléments de l'écran.** Liste des demandes ; bouton Demander l'accès ; minuteur d'accès ; journal des consultations ; clôture.
**Règles.** Accès limité, borné dans le temps, tracé ; jamais d'accès aux ordonnances ni aux stocks pilotés.

#### F43-ADM. Sauvegardes et restauration (support) [NOUVEAU · B]
**Cas de figure.** Base corrompue chez une pharmacie.
**Parcours.**
1. Support → sauvegardes de la pharmacie.
2. Il restaure la dernière copie avec l'accord du promoteur.
3. Il note l'incident et prévient la caisse (saisie différée des ventes du jour).

**Éléments de l'écran.** Liste des exports ; bouton Restaurer ; journal.
**Règles.** Tracé ; accord du promoteur.

#### F59-ADM. Jeu de démonstration et formation [NOUVEAU · H]
**Cas de figure.** Formation d'une équipe sur place.
**Parcours.**
1. Il active le mode Formation sur les comptes Caisse de la pharmacie.
2. Il anime un scénario (scan, ordonnance, remise, paiement, clôture).
3. Il réinitialise les données fictives.

**Éléments de l'écran.** Interrupteur Mode formation ; scénarios ; bouton Réinitialiser.
**Règles.** Données fictives séparées des données réelles.


#### F63-ADM. Suivi et rapprochement des paiements d'abonnement [NOUVEAU · H]
**Cas de figure.** Une pharmacie dit avoir payé, mais son abonnement apparaît impayé.
**Parcours.**
1. Abonnements → Transactions Mobile Money ; filtre par statut.
2. Il ouvre la transaction : référence opérateur, montant, date, statut, réponse de l'opérateur.
3. Si elle est « payée » mais non rapprochée, il appuie sur **Revérifier** auprès de l'opérateur.
4. Pour un paiement hors API (espèces, virement), il utilise la **saisie manuelle de secours** : motif et justificatif obligatoires.
5. Il envoie une relance manuelle si besoin.
6. Il consulte le tableau des impayés.

**Éléments de l'écran.** Liste des transactions ; filtres ; détail ; boutons Revérifier, Saisir un paiement manuel, Relancer ; alertes d'échec de notification ; export ; journal.
**Règles.** Numéro de téléphone masqué ; saisie manuelle tracée ; rapprochement quotidien ; blocage et réactivation selon la règle existante (§ 2bis).

#### F57-ADM. Paiement en ligne du client (Mobile Money) [À ARBITRER · J]
**Parcours.** Aucune construction avant décision du fondateur (partenaire et périmètre). D'ici là : espèces, paiement guidé par code marchand, Mobile Money saisi à la main.

#### F64-ADM. Avis de rappel pour le réseau [NOUVEAU · E]
**Cas de figure.** Une autorité retire un lot : l'administrateur veut prévenir toutes les pharmacies.
**Parcours.** 1. Il saisit l'avis (produit, lot, source, consigne). 2. Il le diffuse à toutes les pharmacies du réseau. 3. Il suit le nombre de pharmacies qui ont accusé réception.
**Éléments de l'écran.** Formulaire d'avis ; liste de diffusion ; accusés de réception (nombre).
**Règles.** Il ne voit ni stock ni ventes ni clients d'une pharmacie ; chaque promoteur déclenche lui-même son rappel (F64-PRO) ; tracé.

#### F70-ADM. Création d'un groupe de pharmacies [NOUVEAU · K]
**Cas de figure.** M. Fouda ouvre une deuxième pharmacie.
**Parcours.** 1. L'administrateur crée la pharmacie (F61-ADM). 2. Il rattache les deux pharmacies au Promoteur dans `promoteur_pharmacies`. 3. Il prépare l'abonnement du groupe (F44-ADM).
**Règles.** Aucune lecture des stocks ; tracé.

#### F73-ADM. Indicateurs qualité du réseau [NOUVEAU · K]
**Cas de figure.** L'administrateur lit le nombre de déclarations par type et par mois.
**Parcours.** Il ouvre le tableau réseau (F37) et filtre.
**Éléments de l'écran.** Indicateurs agrégés et anonymisés.
**Règles.** Aucune déclaration individuelle ni donnée nominative ; tracé.

#### F75-ADM. Prévision saisonnière du réseau [NOUVEAU · K]
**Cas de figure.** L'administrateur observe la hausse saisonnière de la demande d'antipaludéens.
**Parcours.** Il lit la courbe agrégée du réseau.
**Règles.** Données agrégées et anonymisées ; aucun accès au détail d'une pharmacie ; tracé.

### 14.6 Client (CLI)

**Boucle du client.** Ouverture de la PWA → Accueil client → recherche → comparaison → fiche produit → réservation → retrait en pharmacie (ou livraison si activée) → paiement → reçu → historique → retour à l'Accueil. Le client est gratuit.

#### F00-CLI. Accueil du client [EXISTANT, étendu · F]
**Cas de figure.** M. Talla ouvre l'application à 19 h 30.
**Parcours.**
1. Il arrive sur l'Accueil.
2. Il voit la barre de recherche, le bandeau « Les plus recherchés », les pharmacies de garde.
3. Il lance une recherche ou ouvre une réservation en cours.
4. Il revient ici après chaque action.

**Éléments de l'écran.** Barre de recherche ; bouton scan d'ordonnance ; bandeau « Les plus recherchés » (**sans médicaments sur ordonnance**) ; pharmacies de garde ; mes réservations ; numéros d'urgence 1510 / 119 / 1511 ; accès au compte ; liens Conditions, Confidentialité, Sécurité.
**Règles.** Aucune donnée interne d'une pharmacie.

#### F52-CLI. Compte : création, connexion, historique [EXISTANT, enrichi · F]
**Cas de figure.** M. Talla crée son compte pour réserver.
**Parcours.**
1. Mon compte → Créer un compte, en **3 étapes** (ou Google OAuth).
2. Il confirme son âge et accepte les **trois politiques obligatoires**.
3. Mot de passe oublié : code OTP par e-mail → nouveau mot de passe.
4. Il consulte son historique de réservations et d'achats.
5. Il peut supprimer son compte.

**Éléments de l'écran.** Formulaire en 3 étapes ; cases de consentement ; bouton Google ; connexion ; récupération OTP ; historique ; suppression.
**Règles.** Historique d'achats = donnée de santé : consentement explicite, accès limité au client, durée de conservation, minimisation ; cadre légal à vérifier.

#### F48-CLI. Recherche, classement et circulation [EXISTANT, étendu · F]
**Cas de figure.** Il cherche de l'amoxicilline près de chez lui à 20 h.
**Parcours.**
1. Il tape un nom, une molécule ou une marque (F08).
2. Il voit les pharmacies classées par prix, distance ou temps, avec la circulation et le statut de garde.
3. Il filtre (de garde, ouvert, disponible).
4. Il ouvre une fiche.

**Éléments de l'écran.** Barre de recherche ; filtres et tri ; résultats (pharmacie, distance, temps, prix, disponibilité, fraîcheur du stock) ; carte ; badge De garde.
**Règles.** Disponibilité = stock réel de la caisse ; lots et péremptions invisibles.

#### F49-CLI. Scan d'ordonnance [EXISTANT · conservé]
**Cas de figure.** Il photographie son ordonnance chez lui.
**Parcours.**
1. Scanner une ordonnance → import ou caméra.
2. L'OCR lit les produits ; il corrige.
3. Il choisit une pharmacie et réserve.
4. L'ordonnance part dans la file de validation de la pharmacie (F17).
5. Il suit le statut : en attente, validée, rejetée (motif).

**Éléments de l'écran.** Choix import ou caméra ; aperçu ; lignes lues ; consentement ; bouton Réserver ; statut.
**Règles.** Aucune posologie ni diagnostic ; ordonnance jamais visible d'un autre client.

#### F51-CLI. Fiche produit et comparaison des prix [NOUVEAU · F]
**Cas de figure.** Il compare le même produit dans trois pharmacies.
**Parcours.**
1. Il ouvre la fiche : photo, description.
2. Il compare les prix par pharmacie.
3. Il choisit et réserve.

**Éléments de l'écran.** Photo (droits vérifiés) ; description ; prix par pharmacie ; disponibilité ; fraîcheur ; bouton Réserver.
**Règles.** Pas de posologie publique.

#### F53-CLI. Fraîcheur du stock [NOUVEAU · F]
**Parcours.** Sur chaque pharmacie il lit « mis à jour il y a X min » ; il préfère la plus récente ; les pharmacies à jour remontent dans le classement.

#### F50-CLI. Panier, réservation, retrait, paiement et reçu [EXISTANT, étendu · F]
**Cas de figure.** Il réserve trois produits et paiera sur place.
**Parcours.**
1. Il ajoute au panier ; les contrôles serveur vérifient stock et prix.
2. Il appuie sur Réserver ; la durée (1 à 3 h, selon la pharmacie) s'affiche avec un compte à rebours.
3. La pharmacie est prévenue ; il reçoit « prête ».
4. Il se rend en pharmacie, retire, paie (espèces ou **paiement guidé par code marchand**).
5. Il obtient son **reçu imprimable** et le retrouve dans son historique.
6. Passé le délai, la réservation expire et le stock est libéré.

**Éléments de l'écran.** Panier ; bouton Réserver ; compte à rebours ; statuts (envoyée, prête, retirée, expirée) ; bouton WhatsApp de la pharmacie (**jamais le numéro côté client**) ; code marchand guidé ; reçu.
**Règles.** Paiement facultatif ; contrôle serveur du panier.

#### F54-CLI. Livraison (si activée par la pharmacie) [NOUVEAU · F]
**Cas de figure.** La pharmacie a activé la livraison.
**Parcours.**
1. À la réservation, il voit l'option **Livraison** (absente sinon).
2. Il saisit l'adresse ; il voit frais et délai.
3. Il suit : à préparer, remise au livreur, livrée.
4. Il paie à la remise.

**Éléments de l'écran.** Choix Retrait / Livraison ; adresse ; frais ; mention de responsabilité de la pharmacie ; suivi.
**Règles.** Désactivée par défaut ; là où elle ne l'est pas, « aucune livraison ».

#### F55-CLI. Assistant d'orientation (IA) [NOUVEAU · G]
**Cas de figure.** Il écrit « j'ai mal à la gorge ».
**Parcours.**
1. Il ouvre l'assistant et décrit son symptôme.
2. L'assistant propose des **familles de produits**, sans diagnostic ni posologie.
3. Il lit l'avertissement et choisit « Parler à un pharmacien » ou lance une recherche.
4. Signe grave : numéros d'urgence affichés.

**Éléments de l'écran.** Zone de saisie ; réponse avec avertissement ; bouton Parler à un pharmacien ; numéros d'urgence.
**Règles.** Garde-fous médicaux validés avant mise en service.

#### F57-CLI. Paiement en ligne du client (Mobile Money) [À ARBITRER · J]
**Parcours.** Aucune construction avant décision du fondateur. D'ici là : espèces et paiement guidé par code marchand.

#### F68-CLI. Mon crédit et mes règlements [NOUVEAU · D]
**Cas de figure.** M. Talla veut savoir combien il doit à sa pharmacie.
**Parcours.** 1. Il ouvre Mon compte → Mes crédits. 2. Il lit le solde par pharmacie et les règlements. 3. Il revient à l'Accueil.
**Éléments de l'écran.** Solde, plafond, dates, reçus de règlement.
**Règles.** Il ne voit que **ses** données ; tracé.

#### F73-CLI. Réclamation et avis [NOUVEAU · K]
**Cas de figure.** Mme Ndzana veut signaler un problème sur sa réservation.
**Parcours.** 1. Elle ouvre sa réservation ou son reçu. 2. Elle choisit Signaler un problème, écrit un message. 3. Elle voit le statut « reçu » puis « traité ».
**Éléments de l'écran.** Formulaire court ; statut.
**Règles.** Message reçu par la pharmacie (F73-PRO) ; aucune donnée de santé demandée ; tracé.

#### F74-CLI. Consentement aux messages [À ARBITRER · K]
**Cas de figure.** M. Talla choisit de recevoir ou non des messages. En attente du cadre légal (décision du fondateur, 06/10/2026).
**Parcours.** 1. Il ouvre Mon compte → Mes messages. 2. Il accepte ou retire son consentement, par canal. 3. Il voit la date de son choix.
**Règles.** Retrait en un geste ; aucun message sans consentement ; tracé.

#### F64-CLI / F65-CLI / F66-CLI / F67-CLI / F69-CLI / F70-CLI / F71-CLI / F72-CLI / F75-CLI. Sans écran client [NOUVEAU]
**Cas de figure.** M. Talla cherche un rappel de lot ou une dépense de la pharmacie dans son compte : rien ne s'affiche, ces écrans n'existent pas côté client.
**Règles.** Aucun accès client ; **lots et péremptions jamais visibles du client** ; un test vérifie l'accès refusé côté serveur. Les produits hors médicaments (F72) n'apparaissent dans la marketplace qu'après décision séparée.

### 14.7 Responsable (RES) [NOUVEAU, PROPOSITION À VALIDER]

**Cadre.** Le Responsable est le niveau N2 de la hiérarchie (§ 2bis, § 4.4) : l'adjoint du Promoteur pour l'exploitation quotidienne d'une pharmacie. Ce n'est pas une valeur de `role_type` : c'est une fonction interne portée par un bundle de privilèges que le Promoteur délègue. Personnage des cas de figure : **M. Essomba (Responsable)**. Il ne voit que les pharmacies de son périmètre. Les points [À ARBITRER] renvoient aux questions 21 et 22 (§ 12).

**Boucle du Responsable.** Connexion → Accueil Responsable → alertes et clôtures des Caisses → demandes des Caisses (avis) → supervision des ventes et du stock → réceptions et comptage → vente ou clôture de sa propre caisse → verrouillage → lendemain.

**Fiches où le Responsable utilise les mêmes écrans que la caissière** (§ 13) : F01 connexion, F03 réservations, F04 statut de garde, F06 import, F07 hors-ligne, F14 vente et scan, F15 caisse rapide, F20 paiements, F21 ticket, F22 demande d'annulation (pour ses propres ventes), F23 Mes demandes, F25 vente assurée. Différences : plafond de remise propre, plus élevé que celui des Caisses ; il voit les ventes de **toutes** les Caisses de son périmètre ; il ne modifie jamais seul un prix de vente (demande au Promoteur) ; il ne voit ni abonnement, ni marges, ni trésorerie.

#### F00-RES. Accueil du Responsable [NOUVEAU · B]
**Cas de figure.** Lundi 7 h 45, M. Essomba ouvre l'application avant l'ouverture au public.
**Parcours.**
1. Il arrive sur l'Accueil et voit le compteur « Demandes de l'équipe » (avis attendu).
2. Il lit les alertes (ruptures, péremptions, écarts de caisse) et les clôtures de la veille.
3. Il ouvre la file des demandes ou démarre une vente.
4. Il revient à l'Accueil après chaque action.

**Éléments de l'écran.** Compteur de demandes ; alertes ; clôtures de la veille par Caisse ; Nouvelle vente ; Réservations ; Stock ; Mes demandes ; Équipe ; indicateur réseau.
**Règles.** Aucune donnée d'abonnement ni de marge ; périmètre limité à ses pharmacies.

#### F02-RES. Comptes de l'équipe (Caisses) [EXISTANT, étendu · B]
**Cas de figure.** Une Caisse enchaîne les erreurs ; M. Essomba la bloque en urgence en attendant M. Fouda.
**Parcours.**
1. Comptes → liste des Caisses de son périmètre.
2. Il appuie sur Bloquer : le compte est refusé à la connexion, la pharmacie reste active, le Promoteur est notifié.
3. Si le privilège est délégué et le quota de l'architecture non atteint : Créer une Caisse.
4. Il réactive une Caisse qu'il a lui-même bloquée ; une Caisse bloquée par le Promoteur ne se réactive que par le Promoteur.

**Éléments de l'écran.** Liste des Caisses (nom, état, dernière connexion) ; boutons Bloquer, Réactiver, Créer (si délégué) ; quota restant (ex. 3 sur 5) ; historique.
**Règles.** Il ne gère jamais un autre Responsable ni le Promoteur ; il ne fixe pas le plafond de remise ; la création est limitée par l'architecture attribuée par NAXA (§ 2bis) ; tout est tracé.

#### F05-RES. Stock et demande de prix [NOUVEAU · B]
**Cas de figure.** Le prix de vente d'un produit est erroné.
**Parcours.**
1. Stock → recherche par nom ou molécule (F08).
2. Il lit quantités, lots, prix de vente, statut ; il saisit une entrée ou un import comme la caissière.
3. Pour corriger un prix : Demander une correction de prix → demande au Promoteur (F23).

**Éléments de l'écran.** Liste du stock ; pastilles de statut ; bouton Demander un prix ; prix d'achat affiché seulement si le privilège est délégué.
**Règles.** Modifier un prix de vente reste réservé au Promoteur ; tracé.

#### F11-RES. Lot proche de péremption : proposition [NOUVEAU · E]
**Cas de figure.** Douze boîtes périment dans 45 jours.
**Parcours.**
1. Alerte → il ouvre le lot.
2. Il choisit une proposition : promotion, retour fournisseur ou sortie exceptionnelle.
3. Il l'envoie au Promoteur, qui décide (F11-PRO).

**Éléments de l'écran.** Lots par échéance ; boutons de proposition ; champ motif.
**Règles.** La décision appartient au Promoteur ; tracé.

#### F12-RES. Sortie exceptionnelle : demande [NOUVEAU · C]
Même écran que F12 (§ 13) : produit, lot, quantité, motif obligatoire ; la demande part au Promoteur (F23-PRO) ; le stock diminue après validation.

#### F13-RES. Produit réglementé et registre des stupéfiants [NOUVEAU · C]
**Cas de figure.** Une ordonnance contient un stupéfiant.
**Parcours.** 1. Il voit la mention « réglementé » et le statut « en attente de validation ». 2. Il ne valide pas : il renvoie vers l'assistant ou le Promoteur. 3. Le registre ne lui est pas accessible.
**Éléments de l'écran.** Bandeau « produit réglementé » ; bouton Signaler.
**Règles.** Accès refusé côté serveur au registre, sauf accréditation pharmacien (§ 4.4) ; test d'accès refusé obligatoire.

#### F16-RES. Remises : son plafond et avis [NOUVEAU · C]
**Cas de figure.** M. Essomba applique 8 % à un client sur sa propre vente (son plafond est de 10 %) ; une Caisse demande 10 % alors que son plafond est de 5 %.
**Parcours.**
1. En vente, une remise dans son plafond s'applique directement.
2. Au-delà : Demander au Promoteur.
3. Pour la demande d'une Caisse : avis favorable ou défavorable avec motif, puis la demande passe au Promoteur.

**Éléments de l'écran.** Champ remise ; indicateur de plafond ; bouton Demander ; zone Avis.
**Règles.** Plafonds fixés par le Promoteur ; tout est tracé.

#### F17-RES. Ordonnances : accès limité [NOUVEAU · C]
**Cas de figure.** Une ordonnance attend et l'assistant est absent.
**Parcours.** 1. Il voit le compteur et l'ancienneté, sans le contenu. 2. Il signale au Promoteur, qui valide en l'absence d'assistant (question 8).
**Éléments de l'écran.** Compteur ; ancienneté ; bouton Signaler au Promoteur.
**Règles.** Contenu inaccessible sans accréditation pharmacien ; refus côté serveur.

#### F18-RES. Coffre ordonnances : accès refusé [NOUVEAU · B-C]
**Cas de figure.** M. Essomba tente d'ouvrir le coffre.
**Parcours.** L'accès est refusé avec un message clair ; la tentative est tracée.
**Règles.** Accès limité au Promoteur et à l'assistant (§ 5.8) ; test d'accès refusé obligatoire.

#### F22-RES. Annulation : demande et avis [NOUVEAU · C]
**Cas de figure.** Mme Ngo a vendu le mauvais produit et demande l'annulation.
**Parcours.**
1. La demande apparaît dans « Demandes de l'équipe ».
2. Il ouvre la vente et lit le motif.
3. Il donne son avis (favorable ou défavorable) avec un commentaire.
4. La demande passe au Promoteur (F23-PRO), statut « avis donné ».
5. Pour sa propre erreur : même écran que F22 (§ 13), la demande va directement au Promoteur.

**Éléments de l'écran.** Détail de la vente ; boutons Avis favorable, Avis défavorable ; champ commentaire ; statut.
**Règles.** Il ne valide jamais une annulation ; il ne donne jamais d'avis sur sa propre demande ; tracé.

#### F23-RES. File des demandes de l'équipe [NOUVEAU · C]
**Cas de figure.** Trois demandes de Caisses attendent un avis : remise, sortie, annulation.
**Parcours.**
1. Notification (application et e-mail) ; il ouvre la file.
2. Il trie par ancienneté ou type et lit chaque demande.
3. Il donne son avis ; sans avis dans le délai prévu, la demande part au Promoteur avec une relance.

**Éléments de l'écran.** Liste (type, demandeur, date, objet, statut) ; filtres ; boutons d'avis ; statuts : en attente, avis donné, validée, refusée, expirée.
**Règles.** L'avis est facultatif et non bloquant ; sans Responsable en poste, la demande va directement au Promoteur ; tout est écrit dans le journal d'audit.

#### F26-RES. Clôtures : la sienne et celles des Caisses [NOUVEAU · C]
**Cas de figure.** Écart de 1 500 FCFA sur la caisse de Mme Ngo.
**Parcours.**
1. Sa propre clôture : même écran que F26 (§ 13).
2. Accueil → clôtures des Caisses : totaux, compté, écart, motif.
3. Il commente (F41) ou crée une tâche, et télécharge le rapport PDF.
4. La prise de connaissance reste au Promoteur (F26-PRO).

**Éléments de l'écran.** Clôtures par Caisse ; écart ; motif ; rapport PDF ; bouton Commenter.
**Règles.** Lecture seule des autres Caisses ; une journée clôturée ne se modifie pas.

#### F27-RES. Saisies différées : contrôle de premier niveau [NOUVEAU · C]
**Cas de figure.** Après une panne, trois ventes sont saisies a posteriori.
**Parcours.** 1. Il ouvre la liste des saisies différées de l'équipe. 2. Il les compare au carnet papier. 3. Il marque « contrôlé » ou signale un écart ; le Promoteur fait le contrôle final (F27-PRO).
**Éléments de l'écran.** Liste ; heure réelle ; boutons Contrôlé, Signaler.
**Règles.** Tracé ; il ne contrôle pas ses propres saisies.

#### F32-RES. Commandes fournisseurs : préparation [NOUVEAU · E]
**Cas de figure.** L'amoxicilline est en rupture.
**Parcours.**
1. Alerte de rupture → suggestion de réapprovisionnement.
2. Il prépare la commande en brouillon.
3. Il la soumet au Promoteur (F32-PRO) ; après validation, envoi par WhatsApp côté pharmacie.

**Éléments de l'écran.** Suggestions ; brouillon ; bouton Soumettre ; prix d'achat visibles seulement si délégué.
**Règles.** Validation du Promoteur avant tout envoi ; tracé.

#### F33-RES. Réception et contrôle du bon de livraison [NOUVEAU · E]
Même écran que F33 (§ 13) : contrôle du bon de livraison contre la commande, lots et péremptions obligatoires, entrée de stock ; les écarts sont signalés au Promoteur.

#### F34-RES. Inventaire : lancement et comptage [NOUVEAU · E]
**Cas de figure.** Inventaire du rayon des antalgiques.
**Parcours.** 1. Il lance l'inventaire. 2. Il compte et saisit. 3. Il consulte les écarts. 4. Il soumet au Promoteur, qui valide l'ajustement (F34-PRO).
**Éléments de l'écran.** Liste théorique ; champ de comptage ; écarts ; bouton Soumettre.
**Règles.** Il ne valide pas l'ajustement (question 21) ; tracé.

#### F36-RES. Tableau de bord du Responsable [NOUVEAU · E]
Voir § 13 F36 : version limitée. **Parcours.** Il ouvre le tableau, lit CA du jour et de la semaine, ventes par heure, performance par Caisse, ruptures, péremptions, écarts de caisse et demandes en attente ; il clique l'action liée (commander, former, signaler).
**Règles.** Pas de marge, bénéfice, trésorerie ni créances ; données de son périmètre seulement ; une seule chaîne KPI (§ 2bis, point 6), aucun second moteur.

#### F38-RES. Alertes [NOUVEAU · E]
**Cas de figure.** Alerte de rupture et d'écart de caisse.
**Parcours.** 1. Centre d'alertes → il ouvre l'alerte. 2. Il agit (commande, commentaire, tâche). 3. Il marque Traité.
**Éléments de l'écran.** Centre d'alertes ; bouton Traité.
**Règles.** Ruptures, péremptions et écarts de son périmètre ; seuils non modifiables (réglés par le Promoteur).

#### F39-RES. Rapport d'exploitation reçu [NOUVEAU · E]
**Parcours.** Il reçoit le rapport d'exploitation de sa pharmacie (notification et e-mail) ; il l'ouvre et le télécharge.
**Règles.** Il ne configure ni la fréquence ni les destinataires ; export Excel seulement si le privilège est délégué.

#### F40-RES / F41-RES. Documents, tâches et commentaires [NOUVEAU · E]
Même écran que F40 et F41 (§ 13) : il crée et assigne des tâches aux Caisses, commente les clôtures, lit les documents de son périmètre.

#### F42-RES. Journal d'audit [NOUVEAU · B]
**Parcours.** Si le privilège est délégué : lecture du journal de son périmètre ; sinon, accès refusé. Ses propres actions s'y écrivent toujours.
**Règles.** Lecture seule ; aucune modification possible.

#### F58-RES. Réglages : lecture seule [NOUVEAU · B]
Voir § 13 F58. **Parcours.** Il consulte plafond de remise, seuil de péremption, durée de réservation ; aucun champ n'est modifiable.
**Règles.** Les réglages sont réservés au Promoteur.

#### F64-RES. Rappel de lot : déclaration [NOUVEAU · E]
**Cas de figure.** Un avis de retrait du lot B1234 arrive pendant l'absence du Promoteur.
**Parcours.** 1. Même écran que F64-PRO : il déclare le rappel ; le lot passe en quarantaine. 2. Il propose retour fournisseur ou destruction. 3. Il prévient le Promoteur, qui clôture.
**Règles.** Il ne clôture pas ; aucune donnée de santé nominative ; tracé.

#### F65-RES. Ordonnancier : accès refusé [NOUVEAU · C]
Test d'accès refusé : l'ordonnancier est réservé au Promoteur et à l'assistant (§ 4.2).

#### F66-RES. Dépense de petite caisse : demande [NOUVEAU · E]
**Cas de figure.** Achat urgent de consommables à 3 500 FCFA.
**Parcours.** 1. Il saisit motif, montant et justificatif (photo). 2. La demande part au Promoteur. 3. Il voit le statut ; la dépense s'inscrit après validation.
**Règles.** Pas de trésorerie en lecture ; tracé.

#### F67-RES. Marges et coûts : accès limité [NOUVEAU · E]
**Parcours.** Marges, bénéfices et coût moyen : accès refusé. Les prix d'achat sont en lecture seule si le privilège est délégué.
**Règles.** Test d'accès refusé obligatoire.

#### F68-RES. Fiche client et crédit [NOUVEAU · D]
Même écran que F68 (§ 13), dans son plafond ; au-delà, demande au Promoteur. Il ne voit aucune donnée de santé.

#### F69-RES. Planning, gardes et présences [NOUVEAU · K]
**Cas de figure.** Deux Caisses veulent échanger leur poste du samedi.
**Parcours.** 1. Il ouvre le planning de sa pharmacie. 2. Il place les gardes et valide un échange entre deux Caisses. 3. Il publie le planning.
**Règles.** Privilège délégable ; aucune donnée de rémunération ; tracé.

#### F70-RES. Vue groupe : périmètre limité [NOUVEAU · K]
Même écran que F70 (§ 13), limité aux pharmacies de son périmètre : il propose un transfert entre pharmacies, le Promoteur valide.

#### F73-RES. Qualité : déclaration et analyse [NOUVEAU · K]
Même écran que F73-ASS : il déclare ou analyse une erreur évitée (cause, risque, action proposée) et transmet au Promoteur. Pas de donnée nominative de patient ; il ne clôture pas.

#### F44-RES / F63-RES. Abonnement et paiement : accès refusé [NOUVEAU · H]
Test d'accès refusé : l'abonnement, la convention et le paiement sont réservés au Promoteur et à l'administrateur NAXA.

### 14.8 Correspondance fiches-profils et phases

| Phase | Fiches profils (en plus du § 13.3) |
|---|---|
| **B** Fondations | F00-PRO, F01-PRO, F02-PRO, F05-PRO, F42-PRO, F43-PRO, F58-PRO, F00-ASS, F05-ASS, F00-MAG, F05-MAG, F06-MAG, F09-MAG, F10-MAG, F00-ADM (étendu), F43-ADM, F42-CPT, F00-RES, F02-RES, F05-RES, F18-RES (accès refusé), F42-RES, F58-RES |
| **C** Caisse | F12-PRO, F13-PRO, F16-PRO, F17-PRO, F18-PRO, F22-PRO, F23-PRO, F24-PRO, F26-PRO, F27-PRO, F13-ASS, F16-ASS, F17-ASS, F18-ASS, F12-MAG, F13-MAG, F26-CPT, **F65-PRO, F65-ASS, F65-CPT (accès refusé)**, F12-RES, F13-RES (accès refusé), F16-RES, F17-RES, F22-RES, F23-RES, F26-RES, F27-RES, F65-RES (accès refusé) |
| **D** Assurances | F28-PRO, F29-PRO, F25-ASS, F29-CPT, F30-CPT, F28-CPT, **F68-PRO, F68-CPT, F68-CLI**, F68-RES |
| **E** Pilotage et achats | F11-PRO, F31-PRO, F32-PRO, F34-PRO, F36-PRO, F38-PRO, F39-PRO, F40-PRO, F41-PRO, F11-MAG, F31-MAG, F32-MAG, F33-MAG, F34-MAG, F40-MAG, F41-MAG, F41-ASS, F00-CPT, **F60-CPT**, F31-CPT, F32-CPT, F39-CPT, F40-CPT, F41-CPT, F37-ADM, **F64-PRO, F64-ASS, F64-MAG, F64-CPT, F64-ADM, F66-PRO, F66-MAG, F66-CPT, F67-PRO, F67-MAG, F67-CPT**, F11-RES, F32-RES, F33-RES, F34-RES, F36-RES, F38-RES, F39-RES, F40-RES, F41-RES, F64-RES, F66-RES, F67-RES (accès refusé) |
| **F** Marketplace | F00-CLI, F48-CLI, F49-CLI, F50-CLI, F51-CLI, F52-CLI, F53-CLI, F54-CLI, F54-PRO |
| **G** IA | F55-CLI, F56-MAG |
| **H** Offre | F44-ADM, F45-ADM, F46-ADM, F59-ADM, **F61-ADM**, **F62-ADM**, **F63-PRO**, **F63-ADM**, **F63-CPT**, F44-RES et F63-RES (accès refusé) |
| **J** Paiement en ligne | F57-ADM, F57-CLI (à arbitrer) |
| **K** Extensions (après J) | F69-PRO, F69-ASS/MAG, F69-CPT, F70-PRO, F70-MAG, F70-CPT, F70-ADM, F71-PRO, F71-MAG, F71-CPT, F72-PRO, F72-MAG, F72-CPT, F73-PRO, F73-ASS, F73-MAG, F73-ADM, F73-CLI, F74-PRO, F74-CLI (en attente), F68-ASS (en attente), F75-PRO, F75-MAG, F75-ADM ; accès refusés : F65/F73/F74/F75-CPT, F64-CLI à F72-CLI hors F68, et F75-CLI (écran client inexistant, accès refusé testé), F69-RES, F70-RES, F73-RES |
| **Existant conservé** | F47-ADM |

---
---

# PARTIE B : Prompt associé (historique ; l'ordre de travail et la fusion avec l'existant sont régis par le prompt de fusion v2, qui prime)

Joindre le cahier des charges v3.7 (partie A) à ce prompt.

```
RÔLE
Tu es l'ingénieur logiciel principal du projet NAXA (Next.js 14, Supabase, Tailwind, PWA, déploiement Vercel, projet existant "naxa"). NAXA devient d'abord un ERP/caisse pour pharmacies (produit principal) ; la marketplace client est un module qui lit le stock réel. Client gratuit ; revenu = abonnement des pharmacies. Tu construis, tu testes, tu corriges et tu documentes sans t'arrêter, jusqu'à ce que chaque fonctionnalité de la phase en cours soit complète, conforme au cahier des charges et prouvée par des tests.

SOURCES DE VÉRITÉ (par ordre)
1. Le cahier des charges v3.7 ci-joint. Son § 13 (atlas de la caissière, fiches F00 à F59 et F63 à F75) et son § 14 (atlas des sept autres profils : promoteur PRO, responsable RES, assistant ASS, magasinier MAG, comptable CPT, administrateur NAXA ADM, client CLI, fiches F00-PRO à F57-CLI, fiches du Responsable F00-RES à F73-RES, plus F60, F61, F62) font foi pour chaque écran, chaque parcours, chaque élément d'écran et chaque règle, **pour tous les profils**. Légende : EXISTANT = ne pas modifier ; NOUVEAU = migrations et modules additifs ; À ARBITRER = rien construire avant ma décision.
2. Le prompt maître, le README et le STATUT du 5 octobre 2026, conservés tels quels.
En cas de contradiction entre sources, tu la signales et tu attends ma décision. Un oubli ou un risque que tu constates est signalé dans ton rapport, jamais construit de ta propre initiative.

POINTS D'ARRÊT : TU NE T'ARRÊTES QUE POUR CES CINQ CAS
PA1. Après le plan du chantier Qualité (voir DÉMARRAGE).
PA2. À la fin de chaque phase (Q, A, B, C, D, E, F, G, H, I, J, K), avec le rapport de fin de phase, pour obtenir ma validation puis ma phrase « OUI, DÉPLOIE » avant toute Production.
PA3. Un élément [À ARBITRER] ou une question ouverte du § 12 qui bloque réellement la phase en cours. Tu regroupes toutes tes questions en un seul message, au début de la phase, puis tu continues tout ce qui n'est pas bloqué.
PA4. Une limite gratuite bloquante sans solution gratuite : tu proposes la solution gratuite, tu signales le risque, tu ne souscris rien de payant sans mon accord.
PA5. Une contradiction entre les sources de vérité.
PARTOUT AILLEURS TU CONTINUES, SANS DEMANDER. Tu n'écris jamais « souhaitez-vous que je continue ? », « dites-moi si... », « voici les prochaines étapes possibles ». Tu n'envoies pas de rapport intermédiaire pour obtenir une approbation. Tu enchaînes les lots d'une phase jusqu'à son 100 %. Si une limite technique de ta réponse t'interrompt, tu enregistres l'état exact dans le STATUT (lot terminé, lot suivant, décisions) et tu reprends au même endroit dès mon prochain message, sans rien redemander.

EXIGENCE DE COMPLÉTUDE
Tu construis chaque fonctionnalité de la phase **entièrement, pour tous les profils concernés**, fiche par fiche (§ 13 pour la caissière, § 14 pour les autres). Une fonctionnalité n'est pas terminée tant qu'un seul de ses profils manque. Sont interdits dans le code livré : TODO, stub, écran vide « à venir », donnée fictive en dur, console.log de débogage, fonctionnalité simulée, bouton sans action, secret exposé. Une fiche (Fxx ou Fxx-PROFIL) n'est « terminée » que si TOUT ce qui suit est vrai :
1. Migration additive numérotée à la suite, avec RLS testée : accès autorisé ET accès refusé pour chaque rôle, isolation entre pharmacies.
2. Tous les éléments d'écran listés dans la fiche existent, un par un (tu coches la liste), avec les états chargement, vide, erreur, hors-ligne, accès refusé et le cadre commun C0 (§ 13.1).
3. Les droits du § 4 sont appliqués côté serveur (RLS), pas seulement dans l'interface.
4. Si la fiche le dit : fonctionnement hors-ligne, file locale, synchronisation sans doublon ni perte.
5. Chaque action sensible est écrite dans le journal d'audit (qui, quand, pourquoi).
6. Le **cas de figure de la fiche est rejoué de bout en bout par un test automatisé** (données simulées réalistes), plus les cas limites : refus, erreur, hors-ligne, doublon, droit insuffisant.
7. Français et anglais, mode léger, affichage ordinateur / tablette / téléphone, cibles tactiles de 44 px minimum.
8. Les fiches voisines (celles qui l'appellent ou qu'elle appelle) fonctionnent toujours : test de non-régression.
9. Le profil ne voit QUE ce que le § 4.3 lui accorde : un test vérifie qu'il est refusé côté serveur sur tout le reste (ex. le comptable ne voit aucune donnée de santé, la caissière ne voit aucun prix d'achat, le magasinier ne voit aucune vente détaillée).
10. Quand une fiche profil dit « même écran que Fxx », tu réutilises l'écran et tu ne codes que les différences de droits.

TRAÇABILITÉ ET SCORE
Tu tiens à jour `/docs/TRACABILITE.md` : une ligne par fiche et par profil (Fxx, Fxx-PRO, Fxx-RES, Fxx-ASS, Fxx-MAG, Fxx-CPT, Fxx-ADM, Fxx-CLI) avec éléments d'écran (n/n), tests (identifiants), statut parmi {absent, en cours, fait non testé, fait et testé}, preuve (extrait de la sortie des tests). Score d'une phase = fiches (tous profils confondus) « fait et testé » / fiches de la phase. Tu n'annonces **100 %** que si chaque fiche de la phase est « fait et testé » et que tous les éléments d'écran sont cochés. Un élément non vérifié compte comme non fait. Tu n'arrondis jamais vers le haut. Tu n'affirmes jamais « les tests passent » sans les avoir exécutés ; si tu ne peux pas exécuter, tu écris « non vérifié ».

ORDRE ET PHASES
Qualité (Q) → ERP phases A à H → I mise en service terrain → J paiement en ligne → K extensions de l'officine. Fiches de la caissière par phase (les fiches des autres profils de chaque phase sont listées au § 14.8 du cahier des charges et sont obligatoires dans le même score) :
- B : F00, F01, F02, F05, F06, F07, F08, F09, F10, F18 (socle), F42, F43, F58, cadre commun C0.
- C : F03, F04, F12, F13, F14, F15, F16, F17, F18, F19, F20, F21, F22, F23, F24, F26, F27, F65.
- D : F25, F28, F29, F30, F68.
- E : F11, F31 à F41, F60, F64, F66, F67 (achats, inventaire, pilotage, espace documents, collaboration, journal des ventes et exports).
- F : F48 à F54.
- G : F55, F56.
- H : F44, F45, F46, F59, F61, F62, F63.
- K : F69 à F75 (équipe, plusieurs sites, fournisseurs avancés, hors-médicaments, qualité, communication client, prévision), **après J** (décision du fondateur, 06/10/2026). F74 reste en attente du cadre légal. F70 s'appuie sur `promoteur_pharmacies` (§ 2bis).
- I : toutes les fiches, sur données réelles. J : F57 (paiement en ligne du client), seulement après ma décision.
- F47 et F47-ADM : existant conservé, à ne pas toucher.
La phase A est un audit en lecture seule : tu classes chaque fiche en fait et testé / fait non testé / absent, tu chiffres les limites de l'offre gratuite, tu prépares le jeu de données simulées. Elle s'arrête sur PA2.

DÉCISIONS DU FONDATEUR (06/10/2026)
- Livraison : créée et configurable, DÉSACTIVÉE par défaut, activée pharmacie par pharmacie. Là où elle n'est pas activée, la règle « aucune livraison » s'applique.
- Réservation : durée réglable par pharmacie de 1 à 3 h, défaut 3 h.
- Infrastructure : 100 % gratuit tant que possible (sauvegardes, rapports, e-mails, tâches planifiées, stockage de documents).
- **Paiement de l'abonnement par l'API Mobile Money (F63, F63-PRO, F63-ADM, F63-CPT) : DÉCIDÉ, à construire en phase H.** Le promoteur paie depuis l'application, l'opérateur confirme par notification signée, le reçu est généré, l'échéance suivante est calculée, la saisie manuelle de l'administrateur reste en secours. Tu conçois l'intégration derrière une couche d'accès isolée (un fournisseur remplaçable), et tu l'essaies d'abord en **sandbox**. Au début de la phase H, tu me poses en un seul message (PA3) : l'opérateur, le compte marchand, les accès à l'API, les frais, l'échéance, la règle d'impayé. Aucun paiement réel avant mon accord. Secrets uniquement côté serveur ; signature des notifications vérifiée ; un paiement n'est compté qu'une fois ; rapprochement quotidien gratuit ; en cas d'impayé, la règle existante s'applique (blocage de toutes les pharmacies du Promoteur) et tu ne la modifies pas sans ma décision.
- **Paiement en ligne du client (F57)** : ni choix ni construction avant que je te le demande. Garde espèces, paiement guidé par code marchand et Mobile Money saisi à la main.
- Rôles : Promoteur (titulaire), Caisse (caissier), pharmacien assistant, magasinier, comptable. Applique la matrice des droits du § 4.2 et le tableau du § 4.3 (moindre privilège, séparation des tâches ; annulations, remises au-dessus du plafond, sorties exceptionnelles, ajustements d'inventaire et commandes validés par le promoteur ; comptable sans donnée de santé nominative).
- Validation par le promoteur : par empreinte ou visage sur son téléphone (WebAuthn, aucune donnée biométrique stockée), ou par son PIN personnel à la caisse en repli ; notifications par e-mail et dans l'application ; tout est journalisé.
- Ordonnances : parcours unique ordonnance + vente, coffre séparé de l'espace documents, validation par l'assistant ou, sans assistant, par le promoteur, aucune ordonnance dans l'espace partagé.
- Abonnement : un Promoteur = une convention = un tarif = un abonnement (valable pour toutes ses pharmacies), tarif saisi par l'administrateur dans /admin ; essai de 14 jours à articuler avec la convention ; suivi complet (prix, début, fin d'essai, paiements, impayés, services, historique). Impayé : blocage de toutes les pharmacies du Promoteur (règle existante).
- « SharePoint » = espace documents et collaboration intégrés à NAXA (§ 7B), sans intégration Microsoft.
- Matériel mixte : une seule PWA pour ordinateur + imprimante de tickets, tablette et téléphone.
- Ajouts v3.6 (06/10/2026) : F64 à F68 sont ajoutées avant le terrain, dans les phases C, D et E. F69 à F75 forment la phase K, **après J**. Plusieurs sites : réseau déjà existant, F70 ajoute transferts, vue groupe et centrale d'achat. F74 et le suivi des traitements chroniques (F68) : en attente du cadre légal, rien n'est construit.

RÈGLES NON NÉGOCIABLES
- Ne modifie, ne réécris et ne supprime rien de l'existant. Migrations additives uniquement.
- Aucune auto-inscription pharmacie, aucun numéro WhatsApp côté client, aucun secret serveur exposé.
- RLS sur toute nouvelle table, isolation stricte par pharmacie.
- Aucun déploiement Preview volontaire. Production uniquement après évaluation complète à 100 % ET ma phrase « OUI, DÉPLOIE ». Quand je l'ai donnée, fusionne toutes les mises à jour attendues dans main et déploie jusqu'à l'état READY sans t'arrêter avant.
- Aucun scraping de sites tiers ni du portail d'un assureur ; aucun contournement de captcha : la vérification des droits ouvre le portail officiel dans un nouvel onglet et la caissière saisit le résultat.
- Médical : pas de posologie publique, pas de diagnostic ; l'assistant IA oriente et renvoie vers le pharmacien ; contrôle d'interactions seulement avec une base sous licence ; l'IA n'est jamais décisive (contrôle humain obligatoire).
- Licences vérifiées pour catalogue, photos et base médicale.
- Lots et péremptions jamais visibles du client.
- Obligations légales et fiscales camerounaises (ordonnancier, conservation, pharmacovigilance, facturation, taxes, prix réglementés) : tu n'affirmes rien sans source ; tu écris « à vérifier » et tu me le signales.

MÉTHODE POUR CHAQUE PHASE
1. Plan court : fiches traitées, ce que tu ajoutes, ce que tu ne touches pas.
2. Lots de code et migrations enchaînés sans pause, du socle (données, RLS) vers les écrans.
3. Tests sur données simulées réalistes : un scénario par fiche (son cas de figure), par rôle, hors-ligne puis synchronisation, cas limites.
4. Relecture de conformité : tu relis le § 13 ET le § 14 fiche par fiche, profil par profil, et tu vérifies, élément par élément, que tout existe. Tu corriges les écarts avant de continuer.
5. Évaluation chiffrée (score en %) : fait et testé / fait non testé / absent, avec la preuve.
6. Mise à jour du README, du STATUT et de TRACABILITE.md en conservant l'historique.
7. Rapport de fin de phase puis PA2. Le rapport contient : score, liste des fiches, preuves, écarts connus, risques, décisions attendues de ma part.

DÉMARRAGE : CHANTIER QUALITÉ, SANS AUCUNE MODIFICATION
1. Relis le prompt maître, le cahier des charges v3.7 et le STATUT. Mon dernier état annonçait environ 96 % : recalcule le score réel avec preuves, ne reprends pas ce chiffre tel quel.
2. Liste précisément ce qui reste dans le chantier Qualité (fait / reste / bloqué), avec le score actuel.
3. Propose un plan en lots courts.
Livre uniquement cette liste et ce plan, puis arrête-toi (PA1). Après ma validation, tu réalises le chantier Qualité jusqu'à 100 % sans t'arrêter, puis PA2. Ne commence aucune phase ERP avant que Qualité soit validé à 100 % et autorisé en Production.
```