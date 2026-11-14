# Cahier des charges — NAXA-Services

> Conversion fidèle du cahier des charges PDF source.
> Source : `Cahier_des_charges_04_NAXA_Services.pdf` · 8 pages.
> Le texte a été extrait du PDF et structuré en Markdown ; les formulations métier ne sont pas réécrites.

<!-- Page 1 -->

 Cahier des charges — NAXA Services
 Application n° 4 sur 7 de la famille d'applications · Version 1.0 · 31 octobre 2026 · Rang de
 construction : 4
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
 NAXA Services est l'outil de gestion des commerces de prestations : pressing et salon de coiffure. Il
 gère les prestations, les rendez-vous, les dépôts et leur statut, les commissions par prestataire, la
 caisse, les clients et le pilotage, avec mobile money confirmé automatiquement, briefings WhatsApp et
 IA locale, y compris sans connexion. [V]

 1.1 Profils métier
 Profil                              Spécificités

 Pressing                            Dépôt et retrait, étiquettes et numéros de ticket, statut (reçu, en cours, prêt, retiré),
                                     acompte, vêtements non retirés, tarifs par type de vêtement

 Salon de coiffure                   Prestations, rendez-vous, commissions par coiffeur, produits consommés, fidélité,
                                     forfaits de coiffure



## 2. La famille d'applications : sept applications, une
 architecture
 Sept applications distinctes, sept projets de développement, une seule architecture et un seul compte
 client. [V]

 N°     Application         Public                              Modules propres                             Lecture des
                                                                                                            SMS

 1      Kiosko              Agents Orange Money, MTN            M1 : floats, commissions, natures           Obligatoire
                            MoMo, Wave                          d'opérations, abonnements de toute la
                                                                famille

 2      Bootik              Boutique, supérette,                Ventes, stock, ardoise, fournisseurs,       Facultative
                            quincaillerie, articles et          fidélité, compta, multi-boutiques,
                            vêtements, parfumerie,              catalogue
                            poissonnerie, dépôt de gaz,
                            pharmacie informelle restreinte

 3      Zipple              Bar, buvette, restaurant,           Tables et tickets, carte et recettes,       Facultative
                            maquis, braiseur de porc et de      consignes, portions et rendement
                            poulet

 4      NAXA Services       Pressing, salon de coiffure         Prestations, rendez-vous, dépôts et         Facultative
                                                                statuts, commissions par prestataire



Cahier des charges — NAXA Services · v1.0 · 31 octobre 2026                                                               Page 1

---

<!-- Page 2 -->

 N°     Application          Public                              Modules propres                             Lecture des
                                                                                                             SMS

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
       Tontine, 7 Hôtel. Cette application porte le rang n° 4. [P]


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



Cahier des charges — NAXA Services · v1.0 · 31 octobre 2026                                                                Page 2

---

<!-- Page 3 -->

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


Cahier des charges — NAXA Services · v1.0 · 31 octobre 2026                                                Page 3

---

<!-- Page 4 -->

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
 V1. Catalogue de prestations [V]
 - Liste de prestations avec prix, durée, prestataire habilité ; forfaits et formules ; prix par type de
     vêtement (pressing) ; produits vendus au comptoir (shampoings, accessoires).

 V2. Rendez-vous et agenda [V]
 - Agenda par prestataire ou par poste ; prise de rendez-vous en quelques touches ; durée par
     prestation ; créneaux libres.
  - Rappel WhatsApp au client avant le rendez-vous ; acompte ; annulation ; absences non excusées
     suivies ; liste d'attente. [P]
  - Mobile money confirmé automatiquement pour les acomptes et les règlements.

 V3. Dépôts, statuts et retraits (pressing) [V]
 - Dépôt avec numéro de ticket, liste des pièces, tarif, acompte, date de retrait promise ; étiquettes
     imprimables ou à écrire à la main.
  - Statuts : reçu, en cours, prêt, retiré ; message WhatsApp « votre linge est prêt » en un clic.
  - Vêtements non retirés : alerte après un délai réglable, relances, règle de conservation. Reçu par
     WhatsApp.

 V4. Prestataires et commissions [V]
 - Coiffeurs et employés avec leur part de chaque prestation (« c'est Marie qui a fait la coiffure, +500 F
     ») ; commissions par prestataire et par période ; avances, primes, pointage et présences ;
     classement et défis.

 V5. Clients et fidélité [V]
 - Fiche et historique client (prestations, préférences, dernière visite) ; points de fidélité ; carte QR ;
     anniversaires et offres ; parrainage client ; roue de la chance clients ; relance des clients qui ne
     reviennent plus.

 V6. Caisse, consommables et pilotage [V]
 - Ouverture et clôture de caisse, écarts par employé, dépenses (eau, électricité, produits), journal,
     SYSCOHADA et TVA datée, tableau de bord du jour, prestations les plus rentables, heures de pointe,
     taux de remplissage de l'agenda, objectifs.
  - Consommables simples (produits de coiffure, lessive) : stock léger avec alerte de rupture ; pas de
     stock détaillé par code-barres. Multi-salons via compte mère.


## 5. Intelligence artificielle
  - Prévision de l'affluence (jours et heures de pointe, fêtes), suggestion de créneaux, détection
     d'anomalies (prestation non encaissée, remises répétées), conseil de tarifs, relance des clients
     inactifs, score de santé, assistant « posez une question » sur mes chiffres. [V]


## 6. Briefings


Cahier des charges — NAXA Services · v1.0 · 31 octobre 2026                                                 Page 4

---

<!-- Page 5 -->

  - Matin : rendez-vous du jour, dépôts à rendre, acomptes attendus, échéances. Soir : recette,
     commissions du jour par prestataire, caisse attendue contre réelle, rendez-vous de demain. [V]


## 7. Paliers et prix
 Prix mensuels en francs CFA. Forfaits : 3 mois −10 % arrondi à la centaine inférieure ; 6 mois = 5 payés
 ; 12 mois = 10 payés ; aucun remboursement. Points supplémentaires : +500 F par mois au palier Pro.
 [P] Prix à tester auprès de 5 ou 6 commerçants avant de les figer.

                                                 Essentiel              Pro                         Réseau

 Prix par mois                                   1 000                  3 000                       6 000

 Points de vente                                 1                      1 + 500 F par point         Multi-points, compte
                                                                                                    mère

 Utilisateurs par point                          1                      jusqu'à 5                   illimité

 Caisse, prestations, dépôts, ticket, briefing   oui                    oui                         oui
 du soir

 Agenda, rappels de rendez-vous, acomptes        non                    oui                         oui

 Commissions par prestataire, pointage,          non                    oui                         oui
 défis

 Fidélité, QR, roue, relances, compta            non                    oui                         oui
 SYSCOHADA, exports mis en forme

 IA avancée (affluence, tarifs, score,           non                    partielle                   complète
 assistant)

 Compte mère, validation patron à distance,      non                    non                         oui
 Drive

 Tolérance hors connexion                        7 jours                7 jours                     14 jours

  - Forfaits : Essentiel 2 700 / 5 000 / 10 000 F ; Pro 8 100 / 15 000 / 30 000 F ; Réseau 16 200 / 30 000 /
     60 000 F (3, 6, 12 mois).
  - Remise de lot si le client prend plusieurs applications : à décider (section 12). [O]

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


## 9. Conformité et vigilance [P]


Cahier des charges — NAXA Services · v1.0 · 31 octobre 2026                                                           Page 5

---

<!-- Page 6 -->

  - Relecture juridique unique avant le premier client payant : conditions d'utilisation et confidentialité
     en français et en anglais, consentement à la lecture des SMS conservé comme preuve, conformité à
     la réglementation camerounaise sur les données personnelles, mention que l'IA est une aide et non
     un conseil financier, comptable ou fiscal.
  - Photos et fiches clients : consentement et conservation limitée ; aucune photo de client n'est
     partagée sans accord.
  - Pressing : règles de responsabilité et de conservation des vêtements à afficher dans les conditions
     du commerçant (hors responsabilité de l'application).
  - Comptabilité : SYSCOHADA et TVA, taux à vérifier ; roue de la chance : cadre des jeux
     promotionnels.


## 10. Plan de réalisation
 Un prompt autonome à la fois. Le socle commun (jalon 0) est construit une seule fois pour la première
 application, puis réutilisé. Pilote avec quelques commerçants réels avant de généraliser. [P]

 Jalon                       Contenu

 J0. Socle commun            Réutilisé depuis Kiosko

 J1. Cœur Services           Catalogue de prestations, caisse, clients, dépôts et statuts, mobile money confirmé, briefing du
                             soir

 J2. Agenda et équipe        Rendez-vous, rappels WhatsApp, acomptes, prestataires et commissions, consommables

 J3. Fidélité, pilotage et   Fidélité, compta, multi-salons, IA avancée, assistant vocal, recette et distribution
 IA



## 11. Risques
  - Limites des offres gratuites avec un backend partagé par sept applications.
  - Installation hors Play Store : méfiance des utilisateurs, avertissements Android, paramètres
     restreints.
  - Charge de travail : sept projets en parallèle ; le rang de construction et les jalons servent à la
     maîtriser.
  - Charge de l'administration : tous les accès sont créés à la main ; prévoir des outils de création
     rapide.
  - Faux SMS et fraude ; copie de l'APK (protection dissuasive, non absolue).
  - Fiabilité des rappels de rendez-vous (WhatsApp préparé, donc un clic du commerçant).
  - Usage par des coiffeurs peu familiers du numérique : écrans très simples.

## 12. Points ouverts
## 1. Barème de commissions types (pourcentage ou montant fixe).
## 2. Délai de conservation des vêtements non retirés.
## 3. Noms retenus le 31 octobre 2026 : Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA
     Hotel. À vérifier pour chacun : nom de domaine, WhatsApp Business, réseaux sociaux, antériorité
     auprès de l'OAPI ; [O]
## 4. Un abonnement par application : remise de lot pour un client qui en prend plusieurs (proposition :
     −20 % sur la deuxième application et les suivantes) [O].
## 5. Un keystore par application ou commun (section 3, S10).
## 6. Plan de migration quand l'offre gratuite de Supabase devient insuffisante.

## 13. Modèle de données propre à l'application
  - services_catalog, appointments, resources (prestataires, postes), deposits_laundry, deposit_items,
     status_history, commissions_by_staff, consumables, waitlist, plus les tables communes de vente,
     clients et équipe.




Cahier des charges — NAXA Services · v1.0 · 31 octobre 2026                                                             Page 6

---

<!-- Page 7 -->

## 14. Critères de recette (extraits)
  - Un rendez-vous déclenche un rappel WhatsApp préparé avant l'heure.
  - Un dépôt de pressing reçoit un numéro de ticket et un statut ; le passage à « prêt » prépare le
      message « votre linge est prêt ».
  - Une prestation attribuée à un coiffeur crée sa commission.
  - Un acompte payé par mobile money est coché automatiquement.
  - Un vêtement non retiré après le délai réglable déclenche une alerte.
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

 15.1 Logo
 - Logo : monogramme N rouge, mot « NAXA » blanc, mention « SERVICES », sur fond noir. Identité
      sombre à l'origine.
  - Le logo en tête de ce cahier est le fichier fourni. Usage : sur fond clair (ou sur le fond d'origine pour
      NAXA Services), sans le déformer ni le recolorer ; zone de protection égale à la hauteur d'une lettre ;
      taille minimale à l'écran de 24 pixels de haut. [P]
  - À prévoir à partir du fichier fourni : icône d'application adaptative, écran de démarrage, logo
      monochrome pour l'icône des notifications, logo pour les reçus et documents. Fournir idéalement les
      logos au format vectoriel (SVG) ou en grande taille avec fond transparent. [P]

 15.2 Palette
                                                                                                       Contraste sur
         Couleur                     Code          Usage
                                                                                                       blanc

                                                   Fond du mode sombre (mode par défaut), barre
         Noir — principale           #111111                                                           18.9 : 1
                                                   supérieure, logotype

         Rouge — accent de                         Monogramme, boutons d'action principaux, états
                                     #DD3A33                                                           4.4 : 1
         marque                                    actifs ; texte blanc dessus pour les gros boutons

         Rouge foncé — accent
                                     #C42F29       Liens et petits textes sur fond clair               5.5 : 1
         texte

         Blanc                       #FFFFFF       Texte sur fond sombre, fond du mode clair           1.0 : 1

         Fond clair                  #FDECEA       Cartes du mode clair, lignes alternées              1.1 : 1

         Gris de surface             #1E1E1E       Cartes et surfaces du mode sombre                   16.7 : 1




Cahier des charges — NAXA Services · v1.0 · 31 octobre 2026                                                       Page 7

---

<!-- Page 8 -->

                                                                                                        Contraste sur
        Couleur                      Code          Usage
                                                                                                        blanc

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
     commerce du client et la mention discrète « établi avec NAXA Services », aux couleurs de
     l'application. Le client peut ajouter son propre logo à partir du palier Pro. [P]
  - Cohérence de la famille : la page de téléchargement officielle présente les sept applications avec
     leur logo et leur couleur ; un client qui en utilise plusieurs retrouve les mêmes repères.
 Point d'attention. Le rouge est la couleur de marque : il ne doit pas servir seul à signaler une erreur.
 L'alerte utilise un rouge plus profond (#8E0000) avec l'icône ! et un libellé, et un test d'utilisateurs est
 prévu. Le mode sombre est le mode par défaut ; le mode clair est proposé en option.


## 16. Glossaire
  - APK : fichier d'installation d'une application Android. FCM : notifications push gratuites de Google.
     RLS : règles de sécurité par ligne dans la base.
  - Famille d'applications : l'ensemble des sept applications partageant la même architecture. Socle
     commun : la partie partagée (section 3). Jalon : étape de construction testable.
  - Compte mère : compte du propriétaire qui regroupe plusieurs points. Parseur : programme qui
     extrait montant, nature et solde d'un SMS. PIN : code secret de l'opérateur. Code d'accès : code
     qui déverrouille l'application.




Cahier des charges — NAXA Services · v1.0 · 31 octobre 2026                                                       Page 8
