# Audit approfondi — interactions du profil Client NAXA

- Date de l'audit : 18 novembre 2026
- Branche : `main`
- HEAD de référence avant audit : `99027418fa6b817b613bdeaf1d68a4ba14f2a020`
- Périmètre : inventaire statique des routes, composants, actions serveur, API et points de contrôle du parcours Client.
- Modifications fonctionnelles : aucune.
- Tests navigateur/API/SQL exécutés pendant cet audit : aucun. Les constats ci-dessous proviennent de la lecture du code. Une interaction présente dans le code n'est donc pas déclarée « verte ».

## 1. Légende de qualification

- **CODE** : interaction implémentée ou appelée par le parcours, sans preuve de recette UI complète dans cet audit.
- **VERT UI — périmètre limité** : interaction déjà couverte par une recette UI identifiée dans le document de continuité.
- **API/RPC seulement** : preuve technique d'un endpoint, d'une RPC, de RLS ou d'un harnais, pas preuve de clics UI complets.
- **CONDITIONNEL** : disponible seulement si session, profil, permission, feature flag, appareil ou donnée requis.
- **BLOQUÉ MÉTIER** : code présent, mais parcours à ne pas exposer tant que la décision métier de blocage demeure.
- **RISQUE / CONTRADICTION** : code et règles métier, ou deux parties du code, ne concordent pas.

## 2. Inventaire des univers Client

Le référentiel `src/lib/ecosystemes.ts` déclare six identifiants : Pharmacie, Parapharmacie, Examens, Prestations, Bébé & Maman et Dispositifs. En revanche, le tableau `ECOSYSTEMES` ne contient que quatre entrées : Pharmacie, Parapharmacie, Examens et Prestations. `ECOSYSTEME_PAR_ID` est ensuite forcé au type `Record<EcosystemeId, Ecosysteme>`, ce qui masque l'absence réelle des deux entrées.

| Univers | Route Client repérée | Interactions repérées dans le code | Qualification |
|---|---|---|---|
| Pharmacie | `/client`, `/recherche`, `/resultats`, `/produit/[id]`, `/offre/[pharmacieId]/[produitId]`, `/panier`, `/commande/nouvelle`, `/reservation/[id]` | Recherche, comparaison, favoris, panier, réservation/commande, suivi, paiement déclaré, contact pharmacie | CODE ; plusieurs sous-parcours VERT UI limités |
| Parapharmacie | `/parapharmacie`, `/univers-reservation/[id]` | Catalogue, recherche, catégorie, tri, panier local, quantité, retrait par groupe propriétaire, reçu, annulation, déclaration Mobile Money | BLOQUÉ MÉTIER ; implémentation présente |
| Examens médicaux | `/examens`, `/client/examens` | Recherche centres/examens/packs, filtres, distance, créneaux, réservation, ticket, appel, résultats, fichiers, conversation | CODE ; recette UI complète non établie |
| Soins à domicile | `/prestations`, `/prestations/demande/[id]` | Catalogue, recherche, proximité, filtres, demande, adresse, téléphone, date souhaitée, partage GPS facultatif, suivi/annulation | CODE ; recette UI complète non établie |
| Bébé & Maman | `/bebe-maman`, `/univers-reservation/[id]` | Catalogue, recherche, panier principal dédié, quantité, réservation par groupe, reçu, annulation | BLOQUÉ MÉTIER ; implémentation présente |
| Dispositifs médicaux | `/suivi` | Espace privé de suivi connecté, appareils, mesures, Bluetooth, alertes, rappels, consentements et partage professionnel | CONDITIONNEL ; ce n'est pas un catalogue commercial d'appareils |

### 2.1 Contradictions de navigation et de verrouillage

1. `ECOSYSTEMES` et `ECOSYSTEME_PAR_ID` ne couvrent que quatre univers alors que le type accepte six.
2. `ParcoursClientShell` inclut `/bebe-maman` et `/suivi` et rend `EnTeteClient` pour une session connectée. Sur ces routes, `ecosystemeDepuisChemin` renvoie respectivement `bebe-maman` et `dispositifs`, mais `ECOSYSTEME_PAR_ID[ecosystemeActif]` vaut alors `undefined`. Le composant d'en-tête lit ensuite `.color`, `.tagline`, etc. **Risque élevé de crash de l'en-tête sur ces deux routes authentifiées**, déduit statiquement, non confirmé par un test navigateur.
3. Le menu de changement d'univers d'`EnTeteClient` est construit à partir de `ECOSYSTEMES` : Bébé & Maman et Dispositifs n'y apparaissent pas.
4. La recherche générale d'`EnTeteClient` référence pourtant les six univers. Son contrôle de verrouillage cherche une entrée dans `ECOSYSTEMES`; pour Bébé & Maman et Dispositifs, aucune entrée n'est trouvée, donc le contrôle de disponibilité ne s'applique pas à ces deux suggestions.
5. `/api/universes/status` ne renvoie que `parapharmacie`, `examens` et `prestations` en plus de Pharmacie. Bébé & Maman et Dispositifs ne sont pas gérés par ce registre.
6. Le statut de disponibilité est principalement un contrôle de menu. Les routes Parapharmacie et Bébé & Maman chargent le catalogue sans vérifier le statut d'univers ; `reserverProduit` et `reserverGroupeProduits` acceptent explicitement ces deux univers. Le blocage métier ne doit donc pas être considéré garanti par le seul verrou du menu.
7. La route Examens et la route Prestations ne vérifient pas non plus le registre `universes/status` avant d'afficher leur parcours. La réservation d'examen et la demande de prestation ont leurs propres contrôles, mais pas une vérification uniforme de disponibilité de l'univers.

## 3. Pharmacie — inventaire des interactions Client

### 3.1 Accueil et découverte

- Ouvrir l'accueil Client et consulter les médicaments populaires disponibles.
- Rechercher un médicament par saisie ; utiliser les suggestions locales et celles du catalogue.
- Ouvrir le dictionnaire médical, rechercher un terme, lire le résultat, sa source et les références associées.
- Effacer une recherche et en recommencer une.
- Afficher/masquer les filtres de l'accueil ; filtrer les produits selon la disponibilité ; appliquer ou réinitialiser les filtres.
- Parcourir les cartes de produits et les pharmacies proches.
- Consulter les pharmacies de garde, ouvrir la liste complète et consulter les informations d'une pharmacie.
- Utiliser la carte, demander sa position, ouvrir un itinéraire externe, appeler une pharmacie.
- Ouvrir les pages de recherche, résultats, fiche médicament ou offre d'une pharmacie.
- Les médicaments du référentiel peuvent être recherchés même sans stock ; les prix, stocks et lieux de retrait sont liés aux offres réelles des pharmacies, pas au seul référentiel.

### 3.2 Recherche avancée et résultats

- Rechercher une ou plusieurs références de médicaments.
- Ouvrir la sélection de recherche par saisie, image ou caméra.
- Ajouter/supprimer des lignes de recherche.
- Lancer la recherche de stock des pharmacies partenaires.
- Filtrer par ville/localité ; demander ou actualiser le GPS ; saisir une localité.
- Filtrer par assurance/convention disponible ; effacer la sélection d'assurances.
- Comparer les pharmacies et leurs offres ; consulter disponibilité, prix et distance lorsque les données existent.
- Ouvrir une fiche d'offre ; continuer avec une pharmacie uniquement si la sélection demandée est satisfaite.
- En cas de sélection incomplète, d'absence de stock ou de stock devenu indisponible, le parcours doit empêcher la poursuite ou afficher une erreur ; ne pas supposer qu'une offre affichée garantit le stock au moment de la réservation.

### 3.3 Fiche produit et offre pharmacie

- Consulter nom, DCI, dosage, forme, photo, description, indications, précautions et provenance de la fiche.
- Ouvrir les sources externes et la référence réglementaire affichée.
- Sur une offre pharmacie : consulter pharmacie, disponibilité et prix ; augmenter/diminuer la quantité dans les limites du stock ; ajouter au panier.
- Contacter la pharmacie.
- Activer une alerte « M'alerter dès que disponible » pour un produit local, sous réserve d'être connecté.
- Pour un produit soumis à ordonnance, le raccourci d'accueil peut orienter vers le scanner.

### 3.4 Scanner et ordonnance — deux parcours différents

**Scanner local d'ordonnance ou de boîte :**
- Choisir le mode Ordonnance ou Boîte de médicament.
- Utiliser la caméra arrière ou importer des images/PDF.
- Sélectionner jusqu'à cinq pages/images ; contrôle du poids total (10 Mo) et des formats.
- Recadrer, zoomer, revenir, réessayer et lancer la lecture OCR locale.
- Traiter les pages successives et fusionner les candidats reconnus.
- Ajouter ou retirer des médicaments détectés ; consulter prix et pharmacies ; revenir à la recherche.
- En mode posologie, transférer les champs reconnus vers le formulaire de posologie.
- Si la lecture échoue, réessayer ou saisir manuellement.
- **Contradiction à éviter :** le scanner OCR local n'est pas la transmission sécurisée de l'ordonnance à une pharmacie.

**Transmission sécurisée dans `/client/ordonnances` :**
- Choisir une pharmacie destinataire.
- Joindre PDF/JPEG/PNG de 10 Mo maximum.
- Ajouter une note facultative.
- Transmettre le document et consulter les dossiers.
- Ouvrir le document via une URL signée.
- Suivre les états : en attente du Pharmacien, validée, refusée, expirée ou complément demandé.
- Le code appelle les RPC `naxa_client_soumettre_ordonnance` et `naxa_client_mes_ordonnances`, avec abonnement Realtime et rafraîchissement périodique.
- Preuve historique connue : recette API/RLS du dépôt de document et du téléchargement, pas une recette UI Client/Pharmacien complète.

### 3.5 Favoris et rappels liés aux achats

- Ajouter un produit aux favoris depuis les parcours qui proposent l'action.
- Synchroniser/relire les favoris du compte et de l'appareil.
- Filtrer la liste des favoris ; ouvrir la fiche ; retirer un favori.
- Recevoir des propositions issues du suivi des achats ; accepter l'ajout aux favoris ou choisir « Pas maintenant ».
- Programmer un rappel de réachat pour un favori ; désactiver un rappel.
- Les favoris et rappels ont des états vides, erreurs de chargement et erreurs de synchronisation à couvrir.

### 3.6 Panier, choix du mode et commande

- Ouvrir le panier ; continuer les achats ; chercher un produit.
- Augmenter/diminuer les quantités ; retirer une ligne ; vider le panier.
- Regrouper les articles par pharmacie/propriétaire ; identifier les lignes sans pharmacie.
- Rechercher une pharmacie capable de fournir tous les articles.
- Choisir entre réservation et commande selon le parcours.
- Choisir une pharmacie de retrait ; contrôler les quantités et le stock au moment de la soumission.
- Pour une commande avec livraison : saisir/obtenir les coordonnées GPS, calculer un devis de livraison, puis confirmer la demande.
- Le checkout appelle `creer_transactions_client`; le devis livraison passe par `/api/livraison/devis`.
- Une commande multi-pharmacies ou un panier sans propriétaire/stock ne doit pas être assimilé à une transaction unique garantie.

### 3.7 Suivi, livraison, annulation et réception

- Consulter les réservations/commandes, rechercher par pharmacie, médicament ou référence.
- Filtrer par statut et par type ; afficher le détail et la chronologie des événements.
- Voir les statuts de réservation : attente, confirmée, payée, retirée/terminée, expirée, annulée.
- Voir les statuts de commande : en attente pharmacie, acceptée, préparation, livreur assigné, en livraison, livrée, annulée.
- Consulter le délai restant/expiration lorsqu'il est disponible.
- Ouvrir le détail de réservation/commande ; contacter la pharmacie ; appeler ou ouvrir WhatsApp selon les coordonnées présentes ; ouvrir les conversations.
- Annuler une réservation/commande lorsque le statut le permet.
- Suivre le livreur, afficher la dernière position et ouvrir l'itinéraire Google Maps.
- Confirmer la réception de la commande via `naxa_delivery_confirm_received`.
- Consulter le reçu.
- Le Client ne dispose pas d'un espace de pilotage Livreur : il voit les états de livraison et confirme la réception.

### 3.8 Paiement et crédit

- Enregistrer une préférence de paiement et des numéros MTN/Orange dans les paramètres du profil.
- Sur le suivi d'une commande livrée, choisir MTN Mobile Money, Orange Money ou espèces à la livraison (cette dernière option est conditionnée à la PWA installée).
- Ouvrir le composeur et préparer le paiement marchand.
- Déclarer manuellement le paiement ; saisir/corriger référence, numéro payeur, montant et date lorsque le parcours le permet.
- Partager volontairement le SMS de transaction ; les champs extraits peuvent remplacer les valeurs générées, qui restent distinctes d'une confirmation financière indépendante.
- Consulter l'état d'attente, de vérification ou de confirmation ; le composant interroge périodiquement l'état serveur.
- Pour une demande de crédit Marketplace : choisir pharmacie, saisir téléphone et date future de remboursement, joindre un justificatif photo/PDF, soumettre et suivre le statut.
- Consulter comptes de crédit, plafond, solde, disponible, demandes et remboursements enregistrés.
- Les remboursements sont affichés comme événements enregistrés par la pharmacie ; le Client n'effectue pas de remboursement financier dans l'application.
- **Limite métier :** le paiement est exécuté auprès du marchand/de la pharmacie ; NAXA ne doit pas être présenté comme un portefeuille ou un encaisseur de fonds.

### 3.9 Pharmacies de garde

- Consulter les pharmacies de garde, filtrer/choisir une ville et parcourir les résultats.
- Ouvrir les détails, appeler, afficher la localisation ou l'itinéraire, consulter la source du planning et l'annuaire externe.
- Cette fonction renseigne et oriente ; elle ne constitue pas une réservation de médicament.

## 4. Examens médicaux

### Catalogue `/examens`
- Rechercher un centre, un examen ou un pack.
- Filtrer par catégorie, ville et proximité ; utiliser la position GPS lorsqu'elle est disponible.
- Trier les résultats ; consulter centres, services, packs, tarifs et créneaux ouverts.
- Réserver un examen ou un pack sur un créneau disponible.
- En cas d'absence de créneau, de capacité atteinte ou d'erreur catalogue, la réservation doit être bloquée/retentée selon l'état affiché.
- Appeler le centre.
- Le règlement est effectué directement auprès du centre ; NAXA ne collecte pas le paiement.

### Espace `/client/examens`
- Retrouver rendez-vous et tickets, code du ticket, centre, horaire, tarif et statut.
- Consulter les résultats publiés.
- Ouvrir/télécharger les fichiers de résultats exposés au Client.
- Lire les notifications d'examen.
- Ouvrir une conversation liée à un rendez-vous, contacter le centre et envoyer des messages.
- États repérés : réservé, confirmé, réalisé, annulé, expiré ; résultats brouillon/validé/publié/retiré selon le modèle.
- Recette UI complète de réservation, résultat et messagerie : non établie dans les preuves vertes consultées.

## 5. Soins à domicile / Prestations

- Parcourir le catalogue public des prestations publiées.
- Rechercher par texte et utiliser les suggestions ; filtrer/réinitialiser.
- Consulter catégorie, spécialité, zone desservie, tarif éventuel et disponibilité.
- Demander la proximité avec GPS et un rayon ; comparer les distances indicatives.
- Envoyer une demande avec zone, adresse exacte, téléphone, date/heure souhaitée et note.
- Partager la position GPS exacte uniquement si le Client choisit cette option.
- Consulter la demande créée et son état ; annuler si la transition serveur l'autorise.
- Depuis Dispositifs connectés, ouvrir une demande d'assistance à domicile avec l'origine « dispositifs connectés ».
- Aucun paiement en ligne n'est proposé dans ce parcours.
- Le code de l'action vérifie la session, mais ne vérifie pas explicitement `profiles.actif` ni `profiles.role === "client"` avant l'appel Admin RPC : garde à harmoniser/valider côté serveur et RPC.
- Recette UI complète non établie.

## 6. Dispositifs médicaux — suivi connecté privé

**Accès conditionnel :** `/suivi` requiert une session et `suivi_is_enabled_user` doit renvoyer `true`. Si non activé ou service indisponible, l'écran affiche « Suivi connecté indisponible ». Le texte de la page précise que l'univers commercial des dispositifs médicaux est distinct de ce suivi personnel.

Interactions visibles dans `SuiviConnecte` :
- Explorer les appareils et filtrer la liste.
- Activer/désactiver un dispositif.
- Connecter un appareil Bluetooth ; ajouter un autre appareil ; reconnecter ou retirer une instance.
- Synchroniser un capteur cardiaque Bluetooth.
- Ajouter une mesure manuelle ; préremplir une mesure si une seule valeur est détectée ; confirmer/enregistrer une mesure Bluetooth.
- Consulter l'historique, les courbes et les familles de mesures.
- Enregistrer un profil de suivi et choisir un thème/accent.
- Définir des limites personnelles/alertes ; modifier, activer/désactiver, supprimer une règle ; marquer une alerte comme lue.
- Créer/modifier/supprimer des rappels ; activer/désactiver les rappels et leurs notifications.
- Programmer les jours/heures de mesure ; modifier, désactiver/réactiver ou supprimer une programmation.
- Gérer les consentements par famille de données ; accepter ou retirer un consentement.
- Rechercher des professionnels vérifiés ; partager un type de données ; révoquer un partage, l'accès aux notes cliniques ou déconnecter un professionnel.
- Consulter le dossier/historique clinique et exporter un PDF.
- Synchroniser des mesures en attente lorsque le réseau revient.
- Demander une assistance à domicile.
- Ces fonctions sont soumises à autorisations navigateur/Bluetooth, consentements, disponibilité du périphérique et activation du service.
- Aucune preuve de recette UI Android/physique complète n'est établie par le seul code.

## 7. Parapharmacie et Bébé & Maman — code présent, activation interdite par la décision métier

Le code de `UniverseCatalog` et `UniverseProductGrid` permet :
- charger le catalogue via `get_universe_catalog_v2` ;
- rechercher par nom, marque, catégorie, description ou établissement ;
- filtrer les catégories et trier par prix croissant/décroissant, nom ou ordre recommandé ;
- ajouter des produits, modifier les quantités, retirer des lignes ;
- regrouper par propriétaire/partenaire ;
- réserver un groupe de produits pour retrait ;
- obtenir un reçu de réservation, consulter le statut et annuler ;
- utiliser le panneau de paiement Mobile Money sur la réservation partenaire.

Différences de panier :
- Parapharmacie : panier propre au composant et conservé dans `localStorage`.
- Bébé & Maman : lignes ajoutées au panier principal avec le type d'article dédié et une finalisation séparée.

**Décision NAXA connue : Parapharmacie et Bébé & Maman sont bloqués pour activation ultérieure.** Ces interactions sont donc inventoriées comme code dormant/à verrouiller, pas comme fonctionnalités Client autorisées ni comme recette verte.

## 8. Navigation, profil et compte Client

### Navigation et recherche générale
- En-tête immersif sur les routes du parcours Client authentifié.
- Ouvrir/fermer la recherche générale ; saisir une fonction ; afficher jusqu'à quatre suggestions ; choisir une action.
- Ouvrir/fermer le menu de changement d'écosystème ; les univers verrouillés apparaissent désactivés dans le menu qui utilise le registre.
- Ouvrir notifications ; ouvrir le panier dans l'écosystème Pharmacie.
- Barre basse : Accueil, Favoris, Scanner, Achats/Réservations/Commandes (libellé animé), Profil.
- Sur mobile, geste horizontal de navigation entre les destinations reconnues.
- Le composant de navigation ne s'affiche pas sur toutes les routes : les routes fiche produit, offre et pharmacies de garde ne font pas partie de la liste de visibilité de la barre basse.

### Profil
- Consulter nom, téléphone, e-mail, adresse par défaut, photo et indicateur de profil vérifié.
- Modifier nom, téléphone et e-mail ; l'e-mail peut nécessiter une confirmation.
- Choisir/importer une photo, utiliser la caméra, recadrer, zoomer/déplacer, enregistrer ou supprimer la photo.
- Gérer plusieurs adresses : Maison/Travail/Autre, saisie manuelle, GPS, repère, adresse par défaut, modifier, supprimer.
- Choisir une préférence MTN MoMo, Orange Money ou espèces ; enregistrer les numéros Mobile Money.
- Choisir Français ou English.
- Changer l'apparence jour/nuit.
- Se déconnecter avec confirmation.
- Basculer vers les autres espaces professionnels si le compte est actif et dispose des affectations/adhésions requises ; l'espace Client est proposé si l'identité Client est complète (username, prénom, nom, téléphone, date de naissance, âge vérifié et consentement).

### Historique, reçus, aide et paramètres
- Filtrer l'historique par période et type ; rechercher un médicament ; ouvrir le suivi.
- Imprimer, enregistrer en PDF ou télécharger les tickets/reçus selon les données disponibles.
- Consulter les factures/reçus, afficher un aperçu, imprimer en PDF, partager.
- Rechercher dans les FAQ et filtrer par commande, paiement, livraison, ordonnance ou compte.
- Contacter NAXA via WhatsApp, téléphone, e-mail ou formulaire de message.
- Noter l'application et envoyer un avis.
- Gérer les préférences de notification : réponses pharmacie, statuts, promotions, rappels ; canaux push/SMS/e-mail selon les permissions et coordonnées.
- Activer le Push ; modifier le mot de passe.
- Consulter/enregistrer les préférences de confidentialité ; exporter les données après confirmation ; ouvrir les documents légaux.
- Demander la suppression du compte après vérification du mot de passe.
- Les préférences de paiement et plusieurs paramètres d'adresse sont stockés localement ; ne pas les confondre avec un instrument de paiement ou un carnet d'adresses synchronisé intégralement côté serveur.

### Messages et notifications
- Consulter les conversations avec les pharmacies ; rechercher par pharmacie/message ; basculer entre conversations et archivées.
- Ouvrir un fil, lire/répondre, activer/désactiver l'anonymat selon le fil, marquer comme lu, archiver/restaurer.
- Les conversations apparaissent à partir d'un contexte existant (ex. réservation/pharmacie) ; le code de la liste n'expose pas un bouton universel « nouvelle conversation » sans contexte.
- Consulter les notifications, marquer une notification comme lue, ouvrir le fil lié, répondre, activer les notifications Push.
- Les notifications peuvent diriger vers suivi de commande/réservation, conversation, examens ou autre espace selon le type d'événement.

### Posologie et rappels
- Créer un schéma de prise avec médicament, dose, unité et nombre de prises.
- Choisir des heures fixes ou un intervalle ; vérifier les heures distinctes ; enregistrer.
- Préremplir depuis le scanner, puis corriger les champs reconnus avant sauvegarde.
- Activer les rappels avec permission de notification ; synchroniser les schémas au compte.
- Supprimer un schéma ; recevoir les rappels locaux quand l'écran est ouvert et Push selon l'abonnement disponible.
- Ce module organise des informations saisies/reconnues ; il ne fournit pas de diagnostic ni de conseil médical.

## 9. Contradictions et risques à traiter

| Priorité | Constat | Effet probable |
|---|---|---|
| P1 | Entrées Bébé & Maman et Dispositifs absentes de `ECOSYSTEMES` mais acceptées par le type et les routes | En-tête potentiellement cassé sur `/bebe-maman` et `/suivi` ; navigation incomplète |
| P1 | Verrouillage d'univers contrôlé dans les menus mais pas uniformément sur routes/actions serveur | Accès direct possible à des univers métier bloqués ; contournement du menu |
| P1 | Sélecteur d'espace propose Client sur identité complète, mais plusieurs actions exigent le rôle racine `client` | Compte multi-espace pouvant voir un parcours puis être rejeté à la soumission |
| P1 | Demande de prestation exige une session mais ne vérifie pas explicitement rôle/actif dans l'action | Garde serveur à confirmer/harmoniser avec la règle d'identité active |
| P2 | Barre basse alterne trois libellés sur une même URL | Ambiguïté UX ; Achats/Réservations/Commandes ne sont pas trois onglets autonomes |
| P2 | Routes fiche produit/offre/gardes non couvertes par toutes les enveloppes de navigation | Perte de navigation persistante selon la route |
| P2 | Plusieurs préférences sont locales (paiement, numéros, adresses secondaires, notifications) | Non-synchronisation possible entre appareils ; ne pas annoncer une persistance compte globale |
| P2 | Catalogue commercial de dispositifs absent des routes identifiées ; `/suivi` est privé et feature-gated | Le nom de l'univers peut laisser croire à un catalogue d'achat qui n'est pas implémenté ici |
| P2 | Recettes UI antérieures limitées à quelques parcours | Ne pas déclarer vert par extrapolation les examens, soins à domicile, BLE, ordonnances UI, profils et paramètres |

Les contrôles d'accès portés par les RPC/RLS peuvent renforcer certains points. Leur conformité n'est pas déduite du seul composant ; elle doit être vérifiée à la source SQL et avec des sessions/identités contrastées avant de conclure à une vulnérabilité.

## 10. Interactions Client déjà couvertes par une recette UI connue

D'après le registre de continuité antérieur :
- **Lot B2 — VERT UI Replay :** recherche Marketplace et offre positive ; ajout/persistance/retrait d'un favori ; réservation de deux unités ; second Client bloqué pendant la retenue de stock ; confirmation par le Gestionnaire de stock ; statut Client « Confirmée par la pharmacie » ; annulation ; restitution exacte des trois unités attendues ; affichage dans l'historique ; nettoyage des données temporaires.
- **Recette Client desktop/mobile antérieure :** navigation et affichage de recherche, ville, assurance, panneau de filtres et historique ; cette preuve ne vaut pas validation de toutes les transitions de commande.
- **Isolation historique Client :** deux JWT distincts voient leurs propres achats et aucune donnée croisée ; preuve navigateur/JWT, pas validation de tous les écrans.
- **Crédit Marketplace :** scénario navigateur positif d'approbation, débit stock et suivi Client dans le périmètre documenté ; ne vaut pas validation de toutes les fonctions de crédit.
- **Ordonnance :** preuve API/RLS de dépôt, lecture et téléchargement ; pas recette UI complète du parcours Client/Pharmacien.
- **Examens, soins à domicile, dispositifs connectés, Bluetooth, paramètres de profil, export/suppression, notifications de chaque canal, paiement SMS et livraison physique :** aucune recette UI complète ne doit être déduite du seul code ou des preuves API/RPC recensées.

## 11. Règle de reprise

- Ne pas rejouer les interactions B2 déjà vertes sans preuve contradictoire ou demande explicite.
- Les univers bloqués restent bloqués, même si leurs routes et actions sont présentes.
- Ne pas déclarer un univers vert sur la base d'une page, d'une RPC ou d'un seul chemin nominal.
- Pour une recette future, couvrir les branches : connecté/non connecté, identité Client complète/incomplète, actif/suspendu, rôle racine Client/professionnel, univers activé/verrouillé, catalogue vide/erreur, stock suffisant/insuffisant, GPS autorisé/refusé, PWA installée/non installée, paiement déclaré/en attente/vérifié, réservation confirmée/expirée/annulée, permissions Push/Bluetooth accordées/refusées.
- Aucun changement Production, aucune migration, aucun déploiement Vercel et aucune publication Play Store n'ont été réalisés dans cet audit.
