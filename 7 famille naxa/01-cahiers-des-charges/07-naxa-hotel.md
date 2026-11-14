# Cahier des charges — NAXA-Hotel

> Conversion fidèle du cahier des charges PDF source.
> Source : `Cahier_des_charges_07_NAXA_Hotel.pdf` · 12 pages.
> Le texte a été extrait du PDF et structuré en Markdown ; les formulations métier ne sont pas réécrites.

<!-- Page 1 -->

 Cahier des charges — NAXA Hotel
 Application n° 7 sur 7 de la famille d'applications · Version 1.0 · 31 octobre 2026 · Rang de
 construction : 7
 Issu du cahier des charges Kiosko v1.2 et de la version de référence « Gestion petit commerce »
 v2.1 ; inspiration complémentaire : NAXA.


## 0. Lecture du document
  - [V] validé par vos réponses · [P] proposé, à valider · [O] point ouvert.
  - Ce cahier des charges est autonome : il contient le socle commun de la famille (section 3) et ce qui
     est propre à l'application (sections 4 et suivantes). Les sept cahiers partagent la même architecture
     et les mêmes options (décision du 31 octobre 2026). [V]
  - Vocabulaire : « PIN » = code secret de l'opérateur, jamais demandé ni stocké ; « code d'accès » =
     code de l'application.


## 1. Présentation
 NAXA Hotel est l'outil de gestion à 360° des établissements d'hébergement : chambres et tarifs,
 réservations, accueil (arrivée et départ), compte du séjour, ménage, maintenance, restauration et bar,
 stock, équipe par poste, clients, comptabilité, pilotage et IA, du petit hôtel au groupe de plusieurs
 hôtels, y compris sans connexion. [V]

 1.1 Profils d'établissement
 Profil                              Spécificités

 Auberge, maison d'hôtes             Quelques chambres, un seul réceptionniste ou le propriétaire, tarifs simples,
                                     petit-déjeuner, saisie très rapide

 Hôtel                               Plusieurs types de chambres, réception jour et nuit, ménage organisé, restaurant et
                                     bar, maintenance, équipe par postes

 Résidence meublée, appart-hôtel     Séjours de plusieurs nuits ou semaines, tarifs dégressifs, cuisine et linge, facturation
                                     périodique

 Groupe hôtelier                     Plusieurs hôtels sous un compte mère : consolidation, comparaison, tarifs et règles
                                     communes, direction générale


 1.2 Objectifs
## 1. Savoir à tout instant quelles chambres sont libres, occupées, sales, à préparer ou hors service.
## 2. Ne jamais vendre deux fois la même chambre, même en cas de coupure de réseau.
## 3. Tenir un compte unique par séjour (chambre, restaurant, bar, extras) et un encaissement sans
     oubli.
## 4. Donner à chaque poste exactement les écrans et les droits de son travail.
## 5. Mesurer et améliorer le taux d'occupation et les revenus (prix moyen, revenu par chambre
     disponible).
## 6. Piloter plusieurs hôtels depuis un téléphone, avec le briefing du matin et du soir sur WhatsApp.

## 2. La famille d'applications : sept applications, une
 architecture



Cahier des charges — NAXA Hotel · v1.0 · 31 octobre 2026                                                               Page 1

---

<!-- Page 2 -->

 Sept applications distinctes, sept projets de développement, une seule architecture et un seul compte
 client. [V]

 N°     Application          Public                              Modules propres                             Lecture des
                                                                                                             SMS

 1      Kiosko               Agents Orange Money, MTN            M1 : floats, commissions, natures           Obligatoire
                             MoMo, Wave                          d'opérations, abonnements de toute la
                                                                 famille

 2      Bootik               Boutique, supérette,                Ventes, stock, ardoise, fournisseurs,       Facultative
                             quincaillerie, articles et          fidélité, compta, multi-boutiques,
                             vêtements, parfumerie,              catalogue
                             poissonnerie, dépôt de gaz,
                             pharmacie informelle restreinte

 3      Zipple               Bar, buvette, restaurant,           Tables et tickets, carte et recettes,       Facultative
                             maquis, braiseur de porc et de      consignes, portions et rendement
                             poulet

 4      NAXA Services        Pressing, salon de coiffure         Prestations, rendez-vous, dépôts et         Facultative
                                                                 statuts, commissions par prestataire

 5      CotiZ                Groupes de tontine, trésorières,    Cotisations, tours, pénalités, présences,   Facultative,
                             membres                             épargne, prêts, garanties                   désactivée par
                                                                                                             défaut

 6      Loyable              Propriétaires et gestionnaires de   Biens, locataires, loyers, quittances,      Facultative,
                             biens locatifs                      relances, charges, états des lieux          désactivée par
                                                                                                             défaut

 7      NAXA Hotel           Hôtels, auberges, résidences        Chambres, réservations, accueil, folio      Facultative
                             meublées, maisons d'hôtes,          du séjour, ménage, maintenance,
                             groupes hôteliers                   postes, multi-hôtels

     - Un code partagé, sept APK : un noyau commun (comptes, synchronisation, notifications,
       WhatsApp, IA locale, abonnement, sécurité) et, par application, uniquement ses modules. Chaque
       APK reste légère sur les téléphones d'entrée de gamme. [P]
     - Sept projets : sept dépôts GitHub (un par application) plus un dépôt du noyau commun, ou un seul
       dépôt à sept dossiers. Chaque projet a son propre cahier des charges, ses jalons et sa recette. [P]
     - Un seul backend Supabase partagé pour les sept (plus un projet de test) : l'offre gratuite
       n'autorise que deux projets actifs par organisation, donc sept backends séparés ne sont pas
       possibles gratuitement. Cela permet aussi un compte unique et un compte mère qui consolide
       plusieurs applications. [P]
     - Un compte pour toutes les applications : le client garde les mêmes identifiants ; l'administration
       choisit à la création de l'accès quelles applications il peut utiliser. [V]
     - Marques : NAXA est une marque distincte (système de pharmacie, NAXA Services, NAXA Hotel) ;
       Kiosko, Bootik, Zipple, CotiZ et Loyable portent leurs noms propres. Toutes les applications
       partagent la même architecture et le même compte client, quelle que soit leur marque. [V]
     - Rang de construction proposé : 1 Mobile Money (il porte le téléphone admin qui détecte les
       paiements d'abonnement de toute la famille), 2 Boutique, 3 Resto-Bar, 4 Services, 5 Bailleur, 6
       Tontine, 7 Hôtel. Cette application porte le rang n° 7. [P]


## 3. Socle commun à toutes les applications [V]
 S1. Comptes et accès
 - Accès créés uniquement par l'administration : fiche client, applications autorisées, palier,
       durée, remise ou essai éventuel ; identifiants et lien de téléchargement remis au client, mot de
       passe changé à la première connexion. Pas d'inscription libre. [V]
     - Connexion par numéro de téléphone et mot de passe (6 caractères minimum) ; à chaque ouverture,
       code d'accès à 4 chiffres ou empreinte, sur le téléphone seulement. Mot de passe oublié : par e-mail
       s'il existe, sinon demande par WhatsApp traitée par l'administration après contrôle d'identité.
     - Employés créés par le gérant ou le propriétaire, avec leur propre code d'accès ; changement
       d'utilisateur sans déconnexion ; jusqu'à 2 appareils actifs par point, notification au propriétaire pour
       tout nouvel appareil, déconnexion à distance. Blocage temporaire après 5 tentatives. Aucun code



Cahier des charges — NAXA Hotel · v1.0 · 31 octobre 2026                                                                   Page 2

---

<!-- Page 3 -->

     envoyé par SMS payant.

 S2. Hors connexion et synchronisation
 - Tout fonctionne d'abord sur la base locale du téléphone ; synchronisation par lots au retour du
     réseau, reprise automatique, identifiant unique par opération contre les doublons. Une opération
     issue d'un SMS est immuable ; les corrections s'ajoutent comme écritures nouvelles.
  - Tolérance hors connexion : 7 jours (Essentiel et Pro), 14 jours (Réseau) ; l'heure du serveur est
     mémorisée et un recul d'horloge est détecté. [P]
  - Chaque APK ne crée que les tables locales dont elle a besoin et ne synchronise que celles-ci. [P]

 S3. Lecture des SMS et solutions de secours
 - Chaîne de traitement de la v1.2 (6.4) : filtre sur l'expéditeur officiel, SMS contenant un OTP ou un
     PIN ignorés (jamais lus, stockés, transmis ni affichés), analyse par règles versionnées (table
     parser_rules mise à jour sans nouvelle APK), contrôle de cohérence des soldes, dédoublonnage, file «
     À classer ».
  - Permission SMS : obligatoire dans Kiosko, facultative dans les autres applications (confirmation
     automatique des paiements reçus) ; désactivée par défaut dans Tontine et Bailleur. [P]
  - Solutions de secours dans toutes les applications : partage d'un SMS vers l'application (sans
     permission SMS), saisie manuelle guidée, rapprochement avec le SMS réel arrivé ensuite, alerte de
     trou dans la chaîne des soldes (Mobile Money). Un SMS partagé n'active jamais un abonnement.

 S4. Notifications
 - Quatre canaux gratuits : notifications locales, push FCM, messages WhatsApp préparés, centre de
     notifications dans l'application. Aucun SMS sortant payant.
  - Canaux Android distincts (Critique, Opérations, Abonnement, Information, Coaching IA), anti-doublon
     par événement, heures calmes, textes courts dans la langue choisie, montants formatés (45 000 F).
  - Santé de l'appli : permission, paramètres restreints, batterie, dernière synchronisation ; assistant de
     configuration au premier lancement, selon la marque du téléphone.

 S5. WhatsApp et briefings
 - Messages préparés (lien wa.me) en un clic, modèles modifiables en français et en English ; aucun
     message ne contient jamais de PIN ou d'OTP. L'envoi automatique gratuit est impossible.
  - Briefing du matin (7 h) et du soir, adaptés à l'application : chiffres clés, alertes, tâches,
     échéances.

 S6. Équipe, droits et audit
 - Droits par rôle fixés par le propriétaire ; validation du patron à distance pour les actions sensibles ;
     journal d'audit (qui, quand, avant, après) ; correction ou annulation avec raison obligatoire.

 S7. Comptabilité de base et exports
 - Export des données (listing, historique en PDF simple et Excel) pour tous les paliers ; rapports PDF et
     Excel mis en forme à partir du palier Pro ; nom du point de vente et date d'export en pied de page.
  - Pour les applications de gestion : journal, compte de résultat simple, trésorerie, plan SYSCOHADA,
     TVA paramétrable, datée et par catégorie, accès comptable par lien temporaire en lecture seule
     limité à un point (inspiré de NAXA). [P]

 S8. Intelligence artificielle locale
 - L'IA propose, l'humain décide ; calculs d'abord sur le téléphone ; aucun numéro ni SMS brut envoyé
     à un service externe ; chaque suggestion explique pourquoi ; mode dégradé sans IA en ligne.
  - Fonctions communes : prévision (rupture, épuisement, échéance selon l'application), détection
     d'anomalies, coach du jour, score de santé de l'activité, relances personnalisées. Assistant « posez
     une question » écrit et vocal (français et anglais) au palier Réseau, en ligne.

 S9. Abonnement et paiements
 - Un abonnement par application (section 7). Paiement par OM ou MoMo sur le code marchand de
     l'administration ; le client saisit l'identifiant de transaction (« J'ai payé ») ; le téléphone admin, qui


Cahier des charges — NAXA Hotel · v1.0 · 31 octobre 2026                                                   Page 3

---

<!-- Page 4 -->

     exécute Kiosko en mode admin, lit le SMS et vérifie expéditeur officiel, montant exact et identifiant
     jamais utilisé ; sinon file de validation manuelle. Le téléphone admin détecte les paiements de
     toutes les applications de la famille.
  - Rapprochement sur identifiant unique, montant exact, numéro du payeur et horaire ; deuxième
     téléphone admin de secours ; accès provisoire de 24 h une seule fois par période ; journal complet.
  - Blocage après échéance : données jamais supprimées, export possible, synchronisation serveur
     refusée sauf écran de paiement ; mêmes règles de prorata, d'offres, de parrainage, de partenaires
     et de roue promotionnelle que la v1.2. [P]

 S10. Sécurité des APK et distribution
 - Signature de l'APK (keystore sauvegardé en plusieurs lieux sûrs, jamais dans un dépôt public),
     obfuscation R8, empreinte de signature vérifiée par le serveur, version minimale exigée (table
     app_versions), abonnement décidé par le serveur (RLS), identifiant de transaction unique, filigrane
     des exports (protections 14.5 de la v1.2).
  - APK direct, sans Play Store ; une page de téléchargement officielle listant les sept applications,
     avec l'empreinte de chaque APK et un guide illustré d'installation (sources inconnues, paramètres
     restreints). [P]
  - Un keystore par application ou un keystore commun : à décider avant la première publication, car sa
     perte empêche toute mise à jour. [O]

 S11. Langues et ergonomie
 - Français et English dès la première version, choix sur la première page ; mobile d'abord, gros
     boutons, écrans clés en 3 touches au plus, lisible en plein soleil, mode sombre en option, léger et
     faible consommation de données.


## 4. Modules propres à l'application
 H1. Chambres, types et tarifs [V]
 - Fiche chambre : numéro, étage, type, capacité, lits, équipements, état ; types de chambre (simple,
     double, suite, familiale…) avec photos.
  - Tarifs par type, par saison, par jour de la semaine, par durée de séjour (nuit, semaine, mois), tarif
     entreprise ou agence, tarif à l'heure ou de passage si le profil l'autorise. [P]
  - Taxes et frais paramétrables et datés : TVA, taxe de séjour, service ; petit-déjeuner inclus ou en
     option ; suppléments (lit d'appoint, climatisation, parking).

 H2. Réservations et plan d'occupation [V]
 - Calendrier d'occupation en grille chambres × jours, avec couleurs par statut ; réservation en
     quelques touches, par téléphone, WhatsApp, agence ou sur place (client sans réservation).
  - Acompte et garantie, avec paiement par mobile money confirmé automatiquement ; politique
     d'annulation réglable ; liste d'attente ; suivi des absences non annoncées (no-show).
  - Blocs de chambres pour groupes (séminaires, mariages, délégations) avec liste des participants
     ; réservation de plusieurs chambres pour un même client ; prolongation et changement de chambre.
  - Confirmation de réservation par message WhatsApp préparé (dates, tarif, acompte, conditions) en
     un clic.
  - Hors connexion : deux réceptionnistes peuvent réserver la même chambre sans réseau ; à la
     synchronisation, la première réservation enregistrée gagne, l'autre devient « à replacer » avec
     alerte au manager. Pour limiter ce risque, une réservation hors connexion est marquée « provisoire
     » jusqu'à synchronisation. [P]

 H3. Accueil : arrivée et départ [V]
 - Arrivée (check-in) : fiche d'arrivée du client, attribution de la chambre, tarif confirmé, caution ou
     avance, remise de la clé ou du badge (suivi des clés), numéro de séjour ; arrivées sans réservation
     prises en charge.
  - Pièce d'identité et registre des voyageurs : saisie des informations exigées pour la fiche ou le
     registre ; la photo de la pièce est facultative, chiffrée, à durée de conservation limitée et soumise au



Cahier des charges — NAXA Hotel · v1.0 · 31 octobre 2026                                                 Page 4

---

<!-- Page 5 -->

     consentement (section 9). [P]
  - Départ (check-out) : solde du compte en quelques touches, restitution de la clé et de la caution,
     facture finale ou reçu PDF envoyé par WhatsApp, départ tardif facturable, chambre aussitôt
     marquée « à nettoyer ».
  - Changement de chambre, prolongation, départ anticipé, client qui part sans payer (dossier d'impayé
     avec relance).

 H4. Compte du séjour (folio) et facturation [V]
 - Un compte par séjour regroupe : nuitées, petit-déjeuner, restaurant, bar, minibar, blanchisserie,
     transport, Wi‑Fi, téléphone, extras ; chaque ligne porte son poste et son auteur.
  - Imputation sur la chambre : un ticket de Zipple peut être mis sur le compte de la chambre («
     mettre sur la chambre 12 »), grâce au compte unique de la famille. [P]
  - Paiements partiels, mixtes (espèces, mobile money confirmé par SMS), avances et acomptes ;
     partage de la note entre plusieurs payeurs ; remises validées par le manager.
  - Comptes entreprise : facturation différée à une société ou une agence, relevé mensuel, relances ;
     devis, proforma et facture avec numérotation continue ; avoirs.

 H5. Ménage et gouvernante [V]
 - Statuts de chambre : libre propre, libre sale, occupée, départ prévu, hors service, contrôlée ; mise à
     jour en une touche par la femme de chambre.
  - Répartition des chambres par femme de chambre ; liste des chambres à préparer en priorité (arrivée
     proche) ; contrôle par la gouvernante ; temps de nettoyage et productivité.
  - Minibar et consommables à réapprovisionner ; objets trouvés et rendus (journal) ; suivi du linge :
     propre, sale, en blanchisserie, perdu, usé.

 H6. Maintenance [V]
 - Signalement d'une panne par chambre ou par zone (plomberie, climatisation, électricité, serrure,
     télévision, Wi‑Fi) avec photo ; priorité ; affectation à un technicien ; suivi jusqu'à la clôture.
  - Chambre mise hors service avec dates, qui la retire automatiquement de la vente ; coût des
     réparations par chambre ; maintenance préventive (groupe électrogène, citerne, climatiseurs) avec
     rappels.

 H7. Restauration et bar de l'hôtel [V]
 - Module léger intégré : petit-déjeuner, room service, minibar, boissons ; pour une carte complète, des
     recettes et des tables, l'hôtel utilise Zipple avec les mêmes identifiants, et les tickets s'imputent
     aux chambres.
  - Petit-déjeuner inclus : liste du jour des convives par chambre ; room service avec statut de
     commande.

 H8. Stock, économat et achats [V]
 - Consommables (savon, draps, serviettes, eau, boissons du minibar), lots et péremption, inventaire,
     pertes et casse, transferts entre hôtels, fournisseurs et dettes, commande par WhatsApp sous le
     seuil, facture lue par photo, valeur du stock, responsable des achats.

 H9. Postes, équipes et droits [V]
 Le propriétaire ou la direction fixe, pour chaque poste, les écrans et les actions autorisés. Postes
 prédéfinis, modifiables :

 Poste                               Écrans et droits principaux

 Propriétaire, directeur général     Tout voir, tous les hôtels, finances, objectifs, droits des postes, rapports du groupe

 Manager d'hôtel (directeur ou       Tout son hôtel : tarifs, remises, annulations, validation à distance, rapports,
 gérant)                             planning, clôture, incidents

 Chef de réception                   Réservations, arrivées et départs, planning de la réception, remises limitées, litiges,
                                     remise de poste

 Réceptionniste de jour              Réserver, enregistrer l'arrivée et le départ, encaisser, imprimer ou envoyer la
                                     facture ; pas de modification des tarifs



Cahier des charges — NAXA Hotel · v1.0 · 31 octobre 2026                                                               Page 5

---

<!-- Page 6 -->

 Poste                               Écrans et droits principaux

 Réceptionniste de nuit (audit de    Même droits que le jour, plus la clôture de nuit : contrôle des soldes et de la
 nuit)                               caisse, report du jour, rapport du matin

 Caissier, comptable                 Encaissements, comptes entreprise, dépenses, journal, TVA et taxe de séjour,
                                     exports, accès comptable ; pas de réservation

 Gouvernante générale                Statuts et contrôle des chambres, répartition du ménage, linge, minibar, objets
                                     trouvés

 Femme de chambre, valet             Ses chambres du jour, statut en une touche, signalement de panne, consommables
                                     utilisés

 Responsable maintenance,            Tickets de panne, chambres hors service, maintenance préventive, coûts
 technicien

 Responsable restauration,           Commandes, imputation sur chambre, stock de la cuisine et du bar (via module
 serveur, barman, cuisinier          léger ou Resto-Bar)

 Économe, responsable des achats     Stock, fournisseurs, commandes, réceptions, inventaire, dettes fournisseurs

 Agent de sécurité, portier,         Liste des arrivées et départs, registre des visiteurs, incidents, clés ; pas d'accès aux
 bagagiste                           finances

 Commercial, réservations de         Devis, blocs de chambres, comptes entreprise, suivi des prospects ; pas
 groupes                             d'encaissement

  - Planning et équipes : équipes de jour, de nuit et de week-end ; planning des postes ; pointage et
     présences ; remplacements.
  - Passation de poste : à chaque changement d'équipe, remise de caisse, de clés et de consignes
     avec écart signalé ; journal par réceptionniste ; écarts de caisse par employé.
  - Primes, commissions et avances ; alertes de fraude ; journal d'audit de toute remise, annulation,
     changement de tarif ou de chambre.

 H10. Clients et fidélité [V]
 - Fiche client : historique des séjours, préférences, dépenses, entreprise ; clients fidèles et VIP ; points
     de fidélité, parrainage, anniversaires et offres, roue de la chance clients (tirage réel, lots plafonnés).
  - Demande d'avis après le séjour par message WhatsApp préparé ; suivi des plaintes et des
     incidents par client.
  - Liste de clients à surveiller (impayés, dégradations), limitée au personnel habilité, motif factuel et
     durée de conservation limitée. [P]

 H11. Canaux et distribution [V]
 - Page de réservation en ligne gratuite (page statique) qui envoie une demande de réservation à
     l'hôtel ; disponibilités et tarifs partageables par WhatsApp et réseaux sociaux ; catalogue de
     chambres avec photos.
  - Synchronisation de calendriers par lien iCal avec les plateformes de réservation qui l'acceptent
     : importer leurs réservations et exporter celles de l'hôtel pour éviter les doubles ventes. Les mises à
     jour se font à intervalles réguliers, pas en temps réel ; un véritable gestionnaire de canaux temps
     réel est payant et hors périmètre gratuit. [P]
  - Origine de chaque réservation (direct, agence, plateforme, entreprise) pour mesurer la rentabilité de
     chaque canal.

 H12. Comptabilité et indicateurs hôteliers [V]
 - Journal, compte de résultat par département (hébergement, restauration, bar, services),
     trésorerie, plan SYSCOHADA, TVA et taxe de séjour datées et paramétrables, accès comptable par
     lien temporaire en lecture seule, exports mis en forme.
  - Indicateurs : taux d'occupation, prix moyen de la chambre vendue, revenu par chambre disponible,
     durée moyenne de séjour, taux d'annulation et de no-show, marge d'exploitation simple, coût par
     chambre occupée.

 H13. Multi-hôtels et groupe [V]
 - Compte mère de la direction générale : tableau de bord consolidé (occupation, revenus, caisse,
     incidents) de tous les hôtels ; comparatif entre hôtels et classement ; objectifs par hôtel.


Cahier des charges — NAXA Hotel · v1.0 · 31 octobre 2026                                                                Page 6

---

<!-- Page 7 -->

  - Tarifs, politiques et catalogues communs ou propres à chaque hôtel ; clients et fidélité partagés
     entre les hôtels du groupe ; transferts de stock et de linge entre hôtels, confirmés par le receveur ;
     personnel affectable à plusieurs hôtels.
  - Droits par hôtel : un manager ne voit que son hôtel ; la direction voit le groupe ; rapport mensuel du
     groupe prêt à envoyer.

 H14. Pilotage [V]
 - Tableau de bord du jour : arrivées, départs, chambres à préparer, occupation, encaissements,
     impayés, incidents ; prévision d'occupation à 30 jours ; revenus par canal et par département ; jours
     et saisons les plus rentables ; objectifs mensuels ; comparatif mois contre mois et année contre
     année ; hors connexion avec indicateur de fraîcheur.

 H15. Sécurité de l'établissement [V]
 - Registre des incidents, objets de valeur déposés (coffre), clés et badges, accès restreints par poste,
     journal d'audit, déconnexion à distance d'un téléphone perdu.


## 5. Intelligence artificielle
 Fonction                               Rôle

 Prévision d'occupation et de           Saisons, fêtes, événements, jours de la semaine, historique des réservations
 demande

 Suggestion de prix dynamique           Propose un tarif par chambre et par date selon l'occupation prévue ; le manager
                                        valide

 Prévision de no-show et d'annulation   Repère les réservations à risque et suggère un acompte ou un rappel

 Détection de fraude                    Remises anormales, notes annulées, chambres occupées sans encaissement,
                                        ménage fictif, écarts répétés par employé

 Vente additionnelle                    Suggère surclassement, petit-déjeuner, transfert ou services au bon moment

 Pilotage du stock et du linge          Minibar, consommables, linge usé ou manquant, réassort

 Maintenance prédictive                 Pannes qui se répètent par chambre ou équipement, appareils à remplacer

 Analyse des avis et des plaintes       Regroupe les retours par thème (propreté, bruit, accueil) et suggère des actions

 Score de santé de l'hôtel              Note sur 100 : occupation, marge, propreté, impayés, avis, maintenance

 Assistant « posez une question »       Écrit et vocal, français et English : « combien de chambres libres vendredi ? », «
                                        quel hôtel du groupe rapporte le moins ? »

 Résumé de la nuit et du jour           Texte court prêt à lire par le manager et à envoyer au propriétaire

 L'IA propose, l'humain décide : aucune chambre vendue, aucun tarif changé, aucune note modifiée par
 l'IA seule. Calculs d'abord sur le téléphone ; mode dégradé sans IA en ligne. [V]


## 6. Briefings
  - Matin (7 h) : « Aujourd'hui : 9 arrivées, 7 départs, 22 chambres occupées sur 30, 3 chambres à
     préparer en priorité, 2 pannes ouvertes, impayés 85 000 F ». Soir : recette par département,
     occupation du jour, écarts de caisse, incidents, arrivées de demain. Clôture de nuit : rapport
     envoyé au manager et au propriétaire. Pour un groupe : briefing consolidé de tous les hôtels. [V]


## 7. Paliers et prix
 Prix mensuels en francs CFA par hôtel, selon le nombre de chambres, plus élevés que pour un
 commerce car le revenu d'un hôtel est plus élevé. Forfaits de 3, 6 et 12 mois comme pour les autres
 applications. [P] Prix à tester auprès de 5 ou 6 hôteliers avant de les figer.

                                               Essentiel               Pro                        Réseau

 Prix par mois (proposition)                   3 000                   8 000                      20 000

 Chambres par hôtel                            jusqu'à 10              jusqu'à 40                 illimité

 Hôtels                                        1                       1 + 2 000 F par hôtel      Multi-hôtels, compte
                                                                       supplémentaire             mère



Cahier des charges — NAXA Hotel · v1.0 · 31 octobre 2026                                                             Page 7

---

<!-- Page 8 -->

                                                  Essentiel             Pro                         Réseau

 Utilisateurs                                     3                     15                          illimité

 Chambres, réservations, arrivée et départ,       oui                   oui                         oui
 compte du séjour, caisse, mobile money
 confirmé

 Ménage, maintenance, postes et droits,           non                   oui                         oui
 passation de poste, audit de nuit

 Stock et économat, restauration légère,          non                   oui                         oui
 comptes entreprise, compta SYSCOHADA

 Fidélité, avis, page de réservation,             non                   oui                         oui
 calendriers iCal, groupes et blocs

 IA avancée (prix dynamique, fraude,              non                   partielle                   complète
 maintenance, assistant vocal)

 Multi-hôtels, consolidation, transferts, accès   non                   non                         oui
 comptable, Drive

 Tolérance hors connexion                         7 jours               7 jours                     14 jours

  - Prix des hôtels supplémentaires, remise de lot avec les autres applications (par exemple un hôtel et
     son restaurant avec Resto-Bar) : à décider. [O]
  - Forfaits : Essentiel 8 100 / 15 000 / 30 000 F ; Pro 21 600 / 40 000 / 80 000 F ; Réseau 54 000 / 100
     000 / 200 000 F (3, 6, 12 mois). [P]


## 8. Solutions gratuites et limites [P]
 Besoin                         Solution gratuite                             Limite à surveiller

 Base, authentification,        Un Supabase partagé par les sept              Deux projets actifs par organisation ; 500 Mo
 temps réel                     applications                                  de base partagés ; pause d'un projet gratuit
                                                                              après une semaine d'inactivité

 Notifications push             Firebase Cloud Messaging                      Aucune notable

 Code-barres, texte sur         Bibliothèques du téléphone (ML Kit ou         Qualité sur téléphones d'entrée de gamme
 photo                          équivalent)

 Voix                           Service vocal d'Android                       Hors connexion variable

 Impression                     Bluetooth, imprimante thermique du client     Matériel du client

 Catalogue partageable          Page web statique (GitHub Pages)              Pas de paiement en ligne

 Sauvegarde                     Google Drive API                              Compte Google du client

 Code et APK                    GitHub, Actions, Releases                     Quotas de construction multipliés par sept

 IA en ligne                    API gratuite d'un fournisseur                 Quotas à vérifier

 Sept applications sur un seul backend gratuit multiplient les données : l'offre gratuite de Supabase (500
 Mo de base) peut devenir insuffisante avant d'avoir beaucoup de clients, et un projet gratuit sans trafic
 pendant une semaine est mis en pause. Prévoir une alerte de capacité, l'archivage des anciennes
 données, un plan de migration payant financé par les abonnements et une activité de maintien en
 ligne. [O]
  - Les photos de chambres et de pièces d'identité pèsent lourd : compression avant envoi, stockage
     séparé de la base, durée de conservation limitée.
  - Un calendrier de réservations plus lourd et partagé entre plusieurs téléphones augmente le trafic de
     synchronisation : surveiller le quota de bande passante gratuit.


## 9. Conformité et vigilance [P]
  - Relecture juridique unique avant le premier client payant : conditions d'utilisation et confidentialité
     en français et en anglais, consentement à la lecture des SMS conservé comme preuve, conformité à
     la réglementation camerounaise sur les données personnelles, mention que l'IA est une aide et non
     un conseil financier, comptable ou fiscal.




Cahier des charges — NAXA Hotel · v1.0 · 31 octobre 2026                                                             Page 8

---

<!-- Page 9 -->

  - Registre des voyageurs et fiche de police : les hébergeurs sont généralement tenus
     d'enregistrer leurs clients ; les informations exigées, la durée de conservation et la transmission aux
     autorités sont à faire confirmer par un juriste avant la mise en service. [O]
  - Pièces d'identité : stockage chiffré, accès limité aux postes habilités, consentement, suppression
     après la durée légale ; aucune photo de pièce n'est partagée par WhatsApp.
  - Taxe de séjour, TVA et facturation : taux et mentions obligatoires à vérifier à la construction ;
     numérotation continue des factures.
  - Classement et normes hôtelières : l'application aide, sans valoir attestation de conformité.
     Alcool : règles de licence du bar à vérifier. Objets de valeur : responsabilité de l'hôtel à afficher
     dans ses conditions.
  - Données des clients : consentement, visibilité limitée par poste, aucune revente, durée de
     conservation limitée de la liste de clients à surveiller.


## 10. Plan de réalisation
 Un prompt autonome à la fois. Le socle commun (jalon 0) est construit une seule fois pour la première
 application, puis réutilisé. Pilote avec quelques commerçants réels avant de généraliser. [P]

 Jalon                   Contenu

 J0. Socle commun        Réutilisé depuis Kiosko

 J1. Cœur hôtel          Chambres et tarifs, calendrier d'occupation, réservations, arrivée et départ, compte du séjour,
                         caisse, mobile money confirmé, briefing du soir

 J2. Opérations et       Ménage et statuts, maintenance, postes et droits, planning, passation de poste, clôture de nuit,
 postes                  stock et économat

 J3. Clients et          Fiche client et fidélité, avis, comptes entreprise, blocs de groupes, page de réservation,
 distribution            calendriers iCal, compta SYSCOHADA et indicateurs hôteliers

 J4. Réseau et IA        Multi-hôtels, consolidation, transferts, prix dynamique, fraude, maintenance prédictive,
                         assistant vocal, accès comptable, Drive, recette, tests terrain et distribution



## 11. Risques
  - Limites des offres gratuites avec un backend partagé par sept applications.
  - Installation hors Play Store : méfiance des utilisateurs, avertissements Android, paramètres
     restreints.
  - Charge de travail : sept projets en parallèle ; le rang de construction et les jalons servent à la
     maîtriser.
  - Charge de l'administration : tous les accès sont créés à la main ; prévoir des outils de création
     rapide.
  - Faux SMS et fraude ; copie de l'APK (protection dissuasive, non absolue).
  - Conflits de réservation hors connexion : deux réceptionnistes peuvent vendre la même
     chambre ; règle « première enregistrée gagne », réservations provisoires et alerte au manager.
  - Un calendrier iCal n'est pas un gestionnaire de canaux temps réel : risque résiduel de double vente
     avec les plateformes.
  - Sensibilité des données (pièces d'identité) : risque juridique et de sécurité plus élevé que dans les
     autres applications.
  - Périmètre très large : un hôtel utilise presque tous les modules ; recette à faire avec un hôtel pilote
     réel.


## 12. Points ouverts
## 1. Obligations légales exactes du registre des voyageurs au Cameroun.
## 2. Tarifs d'abonnement par nombre de chambres, à tester.
## 3. Fonctionnement de l'hôtel pilote : taille, postes réels, canaux de réservation utilisés.
## 4. Imprimante de reçus et de factures (Bluetooth, A4) à prévoir.
## 5. Lien précis entre NAXA Hotel et Zipple pour l'imputation sur chambre.


Cahier des charges — NAXA Hotel · v1.0 · 31 octobre 2026                                                              Page 9

---

<!-- Page 10 -->

## 6. Noms retenus le 31 octobre 2026 : Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA
      Hotel. À vérifier pour chacun : nom de domaine, WhatsApp Business, réseaux sociaux, antériorité
      auprès de l'OAPI ; [O]
## 7. Un abonnement par application : remise de lot pour un client qui en prend plusieurs (proposition :
      −20 % sur la deuxième application et les suivantes) [O].
## 8. Un keystore par application ou commun (section 3, S10).
## 9. Plan de migration quand l'offre gratuite de Supabase devient insuffisante.

## 13. Modèle de données propre à l'application
  - rooms, room_types, room_photos, rate_plans, seasons, taxes_dated, reservations,
      reservation_rooms, group_blocks, stays, folios, folio_items, payments, guests, guest_documents
      (chiffrés), guest_flags, companies (comptes entreprise), keys_log, housekeeping_tasks,
      room_status_log, linen_stock, lost_found, maintenance_tickets, maintenance_plans, shifts,
      handovers, night_audits, staff_planning, ical_links, booking_requests, reviews, hotel_groups,
      hotel_group_members, plus les tables communes de caisse, stock, fournisseurs, équipe, compta et
      notifications.


## 14. Critères de recette (extraits)
  - Une chambre ne peut pas être vendue deux fois pour les mêmes dates ; une réservation hors
      connexion en conflit devient « à replacer » avec alerte au manager.
  - Un check-out solde le compte du séjour, restitue la caution et passe la chambre à « libre sale ».
  - Un ticket de Zipple mis sur la chambre apparaît dans son compte de séjour.
  - Une femme de chambre ne voit que ses chambres ; un réceptionniste de jour ne peut pas modifier
      un tarif ; un agent de sécurité n'accède à aucune donnée financière.
  - La clôture de nuit signale tout écart de caisse et produit le rapport du matin.
  - Une chambre « hors service » disparaît des disponibilités à la vente aux dates indiquées.
  - Un manager ne voit que son hôtel ; la direction voit tous les hôtels du groupe ; le client fidèle d'un
      hôtel est reconnu dans un autre hôtel du groupe.
  - Un calendrier iCal importé crée des blocs d'indisponibilité ; l'export reflète les réservations de l'hôtel.
  - La photo d'une pièce d'identité est chiffrée, n'est visible que des postes habilités et est supprimée
      après la durée réglée.
  - L'IA propose un prix pour une date mais ne le change jamais sans validation du manager.
  - Un accès créé par l'administration n'ouvre que les applications et les modules du palier choisi ;
      aucune inscription n'est possible depuis l'application.
  - Un même SMS reçu deux fois ne crée qu'une opération ; un SMS contenant un OTP ou un PIN n'est ni
      stocké ni synchronisé ; un SMS partagé n'active jamais un abonnement.
  - Hors connexion : toutes les fonctions locales marchent ; au retour du réseau, synchronisation sans
      doublon ; au-delà de la tolérance, accès restreint.
  - Un point dont l'abonnement est échu ne peut ni lire ni écrire sur le serveur hors écran de paiement ;
      ses données et son export restent disponibles.
  - Un APK modifié et signé avec une autre clé ne peut pas se synchroniser et l'administration est
      alertée ; une version inférieure à la version minimale est bloquée.
  - Un troisième appareil ferme le plus ancien et notifie le propriétaire.
  - Chaque export PDF et Excel porte le nom du point et la date.
  - Le briefing du matin et celui du soir contiennent les chiffres clés de l'application.
  - Les couleurs, le logo et la police de l'application correspondent à la charte de la section 15 ; chaque
      état de couleur (succès, alerte, avertissement) a une icône et un libellé ; le texte courant atteint un
      contraste de 4,5 : 1.


## 15. Identité visuelle et charte graphique [V]
 Chaque application suit la charte graphique de son logo : mêmes couleurs, même style. Le logo et
 le nom ont été fournis le 31 octobre 2026. [V]


Cahier des charges — NAXA Hotel · v1.0 · 31 octobre 2026                                                 Page 10

---

<!-- Page 11 -->

 15.1 Logo
 - Logo : monogramme N jaune-orangé, mot « NAXA » en bleu vif, mention « HOTEL » en lettres
     espacées. Style lumineux.
  - Le logo en tête de ce cahier est le fichier fourni. Usage : sur fond clair (ou sur le fond d'origine pour
     NAXA Services), sans le déformer ni le recolorer ; zone de protection égale à la hauteur d'une lettre ;
     taille minimale à l'écran de 24 pixels de haut. [P]
  - À prévoir à partir du fichier fourni : icône d'application adaptative, écran de démarrage, logo
     monochrome pour l'icône des notifications, logo pour les reçus et documents. Fournir idéalement les
     logos au format vectoriel (SVG) ou en grande taille avec fond transparent. [P]

 15.2 Palette
                                                                                                        Contraste sur
        Couleur                      Code          Usage
                                                                                                        blanc

                                                   Barre supérieure, boutons principaux, titres,
        Bleu vif — principale        #2058F4                                                            5.6 : 1
                                                   logotype ; texte blanc dessus

        Jaune-orangé — accent                      Monogramme, indicateurs, états actifs ; en fond
                                     #FDA601                                                            2.0 : 1
        de marque                                  seulement, texte noir dessus

        Ambre foncé — accent
                                     #B36F00       Liens et petits textes sur fond clair                4.0 : 1
        texte

        Bleu profond                 #153AA8       Titres et textes importants sur fond clair           9.5 : 1

        Fond clair                   #FFF4DC       Cartes, lignes alternées                             1.1 : 1

        Texte                        #111111       Texte courant                                        18.9 : 1

        Mode sombre — fond           #0B1B4D       Fond du mode sombre ; surfaces #15296E               16.4 : 1

                                                   Opération réussie, paiement confirmé (toujours
        Succès                       #197A33                                                            5.4 : 1
                                                   avec l'icône ✓ et le mot « payé »)

                                                   Erreur, écart, impayé, rupture (toujours avec
        Alerte                       #C62828                                                            5.6 : 1
                                                   l'icône ! et un libellé)

                                                   À vérifier, échéance proche (toujours avec l'icône
        Avertissement                #8F5400                                                            6.1 : 1
                                                   et un libellé)

 Les codes de marque sont mesurés sur le fichier du logo ; les couleurs « texte », « foncé » et de fond
 sont des dérivées proposées pour la lisibilité. [P] Règle de lisibilité : texte courant à 4,5 : 1 de contraste
 au minimum, gros texte et icônes à 3 : 1 ; une couleur de marque plus claire que cela n'est utilisée
 qu'en fond, avec un texte foncé dessus.

 15.3 Règles d'application
 - Un seul code, un thème par application : l'interface, les écrans et le comportement sont
     identiques d'une application à l'autre ; seuls les couleurs, le logo, la police et le vocabulaire
     changent. La couleur principale sert à la barre supérieure, aux boutons principaux et aux titres ;
     l'accent aux actions secondaires, aux badges et aux graphiques. [P]
  - Police : Montserrat (gras pour les titres, normal pour le texte), police libre à embarquer dans
     l'application pour fonctionner hors connexion. [P]
  - États : succès, alerte et avertissement gardent leurs couleurs de sens, toujours doublées d'une
     icône et d'un libellé, quelle que soit la couleur de marque.
  - Mode clair par défaut, mode sombre en option (sauf NAXA Services) ; contrastes forts pour la
     lecture en plein soleil sur téléphone d'entrée de gamme.
  - Documents émis (reçus, factures, quittances, briefings WhatsApp) : en-tête avec le nom du
     commerce du client et la mention discrète « établi avec NAXA Hotel », aux couleurs de l'application.
     Le client peut ajouter son propre logo à partir du palier Pro. [P]
  - Cohérence de la famille : la page de téléchargement officielle présente les sept applications avec
     leur logo et leur couleur ; un client qui en utilise plusieurs retrouve les mêmes repères.
 Point d'attention. Le planning des chambres utilise des couleurs de statut (libre, occupée, à nettoyer,
 hors service) distinctes des couleurs de marque, chacune avec une icône et une lettre pour rester lisible


Cahier des charges — NAXA Hotel · v1.0 · 31 octobre 2026                                                           Page 11

---

<!-- Page 12 -->

 sans couleur.


## 16. Glossaire
  - APK : fichier d'installation d'une application Android. FCM : notifications push gratuites de Google.
     RLS : règles de sécurité par ligne dans la base.
  - Famille d'applications : l'ensemble des sept applications partageant la même architecture. Socle
     commun : la partie partagée (section 3). Jalon : étape de construction testable.
  - Compte mère : compte du propriétaire qui regroupe plusieurs points. Parseur : programme qui
     extrait montant, nature et solde d'un SMS. PIN : code secret de l'opérateur. Code d'accès : code
     qui déverrouille l'application.




Cahier des charges — NAXA Hotel · v1.0 · 31 octobre 2026                                             Page 12
