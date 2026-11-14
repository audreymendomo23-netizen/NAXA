# Cahier des charges — Kiosko

> Conversion fidèle du cahier des charges PDF source.
> Source : `Cahier_des_charges_01_Kiosko.pdf` · 29 pages.
> Le texte a été extrait du PDF et structuré en Markdown ; les formulations métier ne sont pas réécrites.

<!-- Page 1 -->

 Cahier des charges — Kiosko
 Application n° 1 sur 7 de la famille d'applications · Version 1.0 · 31 octobre 2026 · Rang de
 construction : 1
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
 1.1 Vision
 Kiosko est l'outil de gestion des points de vente de mobile money (Orange Money, MTN MoMo et, selon
 la disponibilité de SMS exploitables, Wave) : l'application lit les SMS de transaction, met à jour en temps
 réel la caisse, les floats, les ventes et les commissions, alerte le livreur et assiste le gérant par l'IA,
 même sans connexion. [V]

 1.2 Rôle particulier dans la famille
 - C'est l'application d'origine ; son texte intégral est l'annexe B (cahier des charges Kiosko v1.2,
       19 pages), qui reste applicable sauf dispositions listées en annexe A.
     - Elle porte le mode admin : le téléphone de l'administration exécute cette APK pour détecter les
       paiements d'abonnement des sept applications (section 3, S9). C'est pourquoi elle est construite en
       premier. [V]
     - Elle est la seule dont la lecture des SMS est obligatoire.

 1.3 Cibles et contraintes
 Gérants et propriétaires de points de vente mobile money au Cameroun, zones francophones et
 anglophones. Android uniquement ; hors connexion d'abord ; gratuité ; aucun PIN ni OTP lu, stocké ou
 transmis ; l'IA propose, l'humain décide. [V]


## 2. La famille d'applications : sept applications, une
 architecture
 Sept applications distinctes, sept projets de développement, une seule architecture et un seul compte
 client. [V]

 N°      Application        Public                         Modules propres                         Lecture des
                                                                                                   SMS

 1       Kiosko             Agents Orange Money, MTN       M1 : floats, commissions, natures       Obligatoire
                            MoMo, Wave                     d'opérations, abonnements de toute la
                                                           famille




Cahier des charges — Kiosko · v1.0 · 31 octobre 2026                                                             Page 1

---

<!-- Page 2 -->

 N°     Application          Public                              Modules propres                             Lecture des
                                                                                                             SMS

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
       Tontine, 7 Hôtel. Cette application porte le rang n° 1. [P]


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



Cahier des charges — Kiosko · v1.0 · 31 octobre 2026                                                                       Page 2

---

<!-- Page 3 -->

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
     exécute Kiosko en mode admin, lit le SMS et vérifie expéditeur officiel, montant exact et identifiant
     jamais utilisé ; sinon file de validation manuelle. Le téléphone admin détecte les paiements de
     toutes les applications de la famille.
  - Rapprochement sur identifiant unique, montant exact, numéro du payeur et horaire ; deuxième
     téléphone admin de secours ; accès provisoire de 24 h une seule fois par période ; journal complet.


Cahier des charges — Kiosko · v1.0 · 31 octobre 2026                                                       Page 3

---

<!-- Page 4 -->

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
 Tout le contenu fonctionnel de la v1.2 est conservé ; l'annexe B le décrit en détail. Résumé :
  - Réseaux et services : Orange Money et MTN MoMo (socle), Wave et autres réseaux
     paramétrables, Camtel, Canal+ et services complémentaires, bouton « Autre service ». [V]
  - Natures d'opérations : dépôt, retrait, approvisionnement en float, déstockage, C2C, crédit et Good
     Deal (achat et vente) ; cartes SIM, identification, service OTP (prestation seule, jamais le code),
     autres ventes libres. [V]
  - Tableau de bord, caisse et float : soldes par réseau et en espèces, ouverture et clôture de
     journée, commandes de float, seuils, prévision d'épuisement, trous de solde. [V]
  - Transactions, commissions et rentabilité : listing automatique par SMS, étiquettes de source
     (automatique, partagé, import, manuel), commissions, charges et bénéfice net. [V]
  - Alertes livreur et chef secteur : calcul du montant à demander et message WhatsApp prérempli.
     Clients et crédits. [V]
  - Solutions de secours (6.11) : partage de SMS, saisie manuelle guidée, alerte de trou dans la
     chaîne des soldes, tests sur 4 ou 5 téléphones courants. Téléphone de dépannage (puce
     déplacée). [V]
  - Compte mère et multi-points : un propriétaire pilote plusieurs points ; transfert de float entre
     points. [V]
  - Espace admin, commercial et partenaire : validation des paiements, gestion, BI, pilotage,
     géolocalisation du point, parrainage rémunéré, roue de la chance promotionnelle. [V]


## 5. Intelligence artificielle
  - Prévision du float et de l'heure d'épuisement, détection d'anomalies (écart de caisse, doublons, SMS
     suspect ou faux), coach du jour, lecture des SMS par règles puis IA en secours, relances de crédits,
     assistant en langage naturel (palier Complet). [V]


## 6. Notifications et briefings
  - Catalogue de la v1.2 (float bas, écart de caisse, SMS non reconnu, trou de solde, échéances
     d'abonnement…). Briefing du matin : float de chaque réseau, commissions d'hier, livraisons
     attendues ; briefing du soir : bilan de la journée et trous non résolus. [V]


## 7. Paliers et prix


Cahier des charges — Kiosko · v1.0 · 31 octobre 2026                                                       Page 4

---

<!-- Page 5 -->

 Grille de la v1.2 conservée pour cette application : Essentiel 1 000 F, Services 1 500 F, Complet 3
 000 F par mois ; tolérance hors connexion 7 jours (Essentiel et Services) et 14 jours (Complet). Les prix,
 le prorata, les forfaits de 3, 6 et 12 mois et les offres sont ceux de la v1.2 (sections 10.2 à 10.5). [V]

                                                Essentiel               Services                    Complet

 Prix par mois                                  1 000                   1 500                       3 000

 OM, MoMo, caisse, float, commissions,          oui                     oui                         oui
 alertes livreur

 Vente de cartes SIM, identification, service   oui                     oui                         oui
 OTP, ventes libres

 Wave, Camtel, Canal+, services                 non                     oui                         oui
 additionnels, compte mère, crédits clients

 Paiements internationaux, impôts, assistant    non                     non                         oui
 IA, sauvegarde Drive

  - Les trois paliers sont ouverts dès la première version : plus d'ouverture échelonnée V1, V2, V3
     (décision « tout en V1 » du 31 octobre 2026). [P]
  - Le mode admin n'est pas un palier : il est activé par l'administration.

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
  - Relecture juridique unique avant le premier client payant : conditions d'utilisation et confidentialité
     en français et en anglais, consentement à la lecture des SMS conservé comme preuve, conformité à
     la réglementation camerounaise sur les données personnelles, mention que l'IA est une aide et non
     un conseil financier, comptable ou fiscal.
  - Vérification que les contrats d'agent d'Orange et de MTN n'interdisent pas la lecture des SMS ni
     l'usage d'une application tierce.
  - Vérification du cadre des jeux promotionnels (roue de la chance) et des commissions de partenaires.

## 10. Plan de réalisation
 Un prompt autonome à la fois. Le socle commun (jalon 0) est construit une seule fois pour la première
 application, puis réutilisé. Pilote avec quelques commerçants réels avant de généraliser. [P]




Cahier des charges — Kiosko · v1.0 · 31 octobre 2026                                                                 Page 5

---

<!-- Page 6 -->

 Jalon                   Contenu

 J0. Socle commun        Dépôt(s), Supabase partagé, comptes créés par l'administration, rôles, RLS, langues, signature
                         et obfuscation, version minimale, abonnement et blocage serveur, espace admin web de base

 J1. Lecture des SMS     APK, parseur testé sur le corpus réel de SMS, tests sur 4 ou 5 téléphones, solutions de secours
                         6.11, téléphone de dépannage

 J2. Point de vente      Caisse, floats, transactions, commissions, listing, messages WhatsApp, notifications, IA locale de
                         base

 J3. Mode admin          Détection et validation des paiements d'abonnement pour les sept applications, deuxième
                         téléphone admin, validation manuelle web

 J4. Réseau et           Compte mère, services additionnels, Wave, commercial, partenaire, parrainage, roue
 croissance              promotionnelle, BI et pilotage admin, sauvegarde Drive, assistant IA, recette et distribution



## 11. Risques
  - Limites des offres gratuites avec un backend partagé par sept applications.
  - Installation hors Play Store : méfiance des utilisateurs, avertissements Android, paramètres
     restreints.
  - Charge de travail : sept projets en parallèle ; le rang de construction et les jalons servent à la
     maîtriser.
  - Charge de l'administration : tous les accès sont créés à la main ; prévoir des outils de création
     rapide.
  - Faux SMS et fraude ; copie de l'APK (protection dissuasive, non absolue).
  - Formats de SMS d'Orange, de MTN et de Wave : peuvent changer, rarement documentés.
  - Dépendance au téléphone admin pour l'activation automatique de toute la famille : solution de
     secours manuelle et téléphone de secours.
  - Conditions des opérateurs envers les agents.

## 12. Points ouverts
## 1. Corpus de SMS réels et noms exacts des expéditeurs à relever avant construction.
## 2. Disponibilité du nom Kiosko (domaine, WhatsApp Business, OAPI).
## 3. Noms retenus le 31 octobre 2026 : Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA
     Hotel. À vérifier pour chacun : nom de domaine, WhatsApp Business, réseaux sociaux, antériorité
     auprès de l'OAPI ; [O]
## 4. Un abonnement par application : remise de lot pour un client qui en prend plusieurs (proposition :
     −20 % sur la deuxième application et les suivantes) [O].
## 5. Un keystore par application ou commun (section 3, S10).
## 6. Plan de migration quand l'offre gratuite de Supabase devient insuffisante.

## 13. Modèle de données propre à l'application
  - Voir annexe B : tables de la v1.2 (annexe A de la v1.2) ; en plus : applications_autorisees par client,
     app_id sur les abonnements.


## 14. Critères de recette (extraits)
  - Tous les critères de recette de la v1.2 (annexe C de la v1.2), y compris les solutions de secours de la
     section 6.11.
  - Le téléphone admin valide automatiquement un paiement d'abonnement d'une autre application de
     la famille.
  - Un accès créé par l'administration n'ouvre que les applications et les modules du palier choisi ;
     aucune inscription n'est possible depuis l'application.
  - Un même SMS reçu deux fois ne crée qu'une opération ; un SMS contenant un OTP ou un PIN n'est ni
     stocké ni synchronisé ; un SMS partagé n'active jamais un abonnement.




Cahier des charges — Kiosko · v1.0 · 31 octobre 2026                                                                 Page 6

---

<!-- Page 7 -->

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
 - Logo : kiosque stylisé avec flèche de croissance et coche, mention « Fintech & Mobile Services ».
      Style sobre, bleu nuit et vert.
  - Le logo en tête de ce cahier est le fichier fourni. Usage : sur fond clair (ou sur le fond d'origine pour
      NAXA Services), sans le déformer ni le recolorer ; zone de protection égale à la hauteur d'une lettre ;
      taille minimale à l'écran de 24 pixels de haut. [P]
  - À prévoir à partir du fichier fourni : icône d'application adaptative, écran de démarrage, logo
      monochrome pour l'icône des notifications, logo pour les reçus et documents. Fournir idéalement les
      logos au format vectoriel (SVG) ou en grande taille avec fond transparent. [P]

 15.2 Palette
                                                                                                               Contraste sur
         Couleur                      Code             Usage
                                                                                                               blanc

                                                       Barre supérieure, boutons principaux, titres,
         Bleu nuit — principale       #0D2E57                                                                  13.6 : 1
                                                       logotype

                                                       Pastilles, flèche, états actifs, graphiques ; en fond
         Vert — accent de marque      #89B255                                                                  2.5 : 1
                                                       seulement, texte bleu nuit dessus

         Vert foncé — accent
                                      #5E8A2E          Liens, icônes et petits textes sur fond clair           4.1 : 1
         texte

         Fond clair                   #EEF4E6          Cartes, lignes alternées, zones de saisie               1.1 : 1

         Texte                        #1B2430          Texte courant                                           15.7 : 1

         Mode sombre — fond           #0A1A33          Fond du mode sombre ; surfaces #12294A                  17.4 : 1

                                                       Opération réussie, paiement confirmé (toujours
         Succès                       #197A33                                                                  5.4 : 1
                                                       avec l'icône ✓ et le mot « payé »)

                                                       Erreur, écart, impayé, rupture (toujours avec
         Alerte                       #C62828                                                                  5.6 : 1
                                                       l'icône ! et un libellé)

                                                       À vérifier, échéance proche (toujours avec l'icône
         Avertissement                #8F5400                                                                  6.1 : 1
                                                       et un libellé)

 Les codes de marque sont mesurés sur le fichier du logo ; les couleurs « texte », « foncé » et de fond
 sont des dérivées proposées pour la lisibilité. [P] Règle de lisibilité : texte courant à 4,5 : 1 de contraste
 au minimum, gros texte et icônes à 3 : 1 ; une couleur de marque plus claire que cela n'est utilisée
 qu'en fond, avec un texte foncé dessus.

 15.3 Règles d'application



Cahier des charges — Kiosko · v1.0 · 31 octobre 2026                                                                      Page 7

---

<!-- Page 8 -->

  - Un seul code, un thème par application : l'interface, les écrans et le comportement sont
     identiques d'une application à l'autre ; seuls les couleurs, le logo, la police et le vocabulaire
     changent. La couleur principale sert à la barre supérieure, aux boutons principaux et aux titres ;
     l'accent aux actions secondaires, aux badges et aux graphiques. [P]
  - Police : Montserrat (semi-gras pour les titres, normal pour le texte), police libre à embarquer dans
     l'application pour fonctionner hors connexion. [P]
  - États : succès, alerte et avertissement gardent leurs couleurs de sens, toujours doublées d'une
     icône et d'un libellé, quelle que soit la couleur de marque.
  - Mode clair par défaut, mode sombre en option (sauf NAXA Services) ; contrastes forts pour la
     lecture en plein soleil sur téléphone d'entrée de gamme.
  - Documents émis (reçus, factures, quittances, briefings WhatsApp) : en-tête avec le nom du
     commerce du client et la mention discrète « établi avec Kiosko », aux couleurs de l'application. Le
     client peut ajouter son propre logo à partir du palier Pro. [P]
  - Cohérence de la famille : la page de téléchargement officielle présente les sept applications avec
     leur logo et leur couleur ; un client qui en utilise plusieurs retrouve les mêmes repères.
 Point d'attention. Règle conservée de la v1.2 : l'orange et le jaune servent uniquement aux pastilles
 Orange Money et MTN MoMo, pour distinguer les floats. Le vert de marque n'est pas le vert de succès :
 le succès utilise le vert plus foncé de la ligne « Succès » avec l'icône ✓.


## 16. Glossaire
  - APK : fichier d'installation d'une application Android. FCM : notifications push gratuites de Google.
     RLS : règles de sécurité par ligne dans la base.
  - Famille d'applications : l'ensemble des sept applications partageant la même architecture. Socle
     commun : la partie partagée (section 3). Jalon : étape de construction testable.
  - Compte mère : compte du propriétaire qui regroupe plusieurs points. Parseur : programme qui
     extrait montant, nature et solde d'un SMS. PIN : code secret de l'opérateur. Code d'accès : code
     qui déverrouille l'application.




Cahier des charges — Kiosko · v1.0 · 31 octobre 2026                                                      Page 8

---

<!-- Page 9 -->

 Annexe A. Dispositions de la v1.2 modifiées pour cette
 application
 Référence v1.2                               Règle qui prévaut

 1.2 « Marque Kiosko seule, sans mention      Kiosko devient le nom de l'application mobile money ; la famille compte sept
 »                                            applications aux noms propres (Kiosko, Bootik, Zipple, NAXA Services, CotiZ,
                                              Loyable, NAXA Hotel).

 3 Acteurs ; 4.1 Architecture                 Le téléphone admin lit les paiements des sept applications ; le backend
                                              Supabase est partagé.

 15.2 Identité visuelle : logo de kiosque     Remplacée par la section 15 de ce document : nouveau logo (Kiosko, Fintech
 rayé, palette de bleus                       & Mobile Services), bleu nuit et vert. La règle réservant l'orange et le jaune
                                              aux pastilles Orange Money et MTN MoMo reste valable.

 7.1 Inscription par le gérant ; 10.1 essai   Accès créés uniquement par l'administration ; essai accordé par
 automatique de 14 jours                      l'administration ; l'offre de bienvenue (10.5) s'applique à la fin de la période
                                              accordée.

 10.2 Lancement V1 Essentiel seul ; 17        Trois paliers ouverts dès la première version ; construction en jalons J0 à J4
 Plan, 17.2 Versions                          (section 10).

 10.3 Forfait 3 mois du palier Complet : 8    3 000 × 3 × 0,9 = 8 100 F ; l'arrondi à la centaine inférieure ne change rien
 000 F                                        ici.

 Annexe C Recette « Services ou               Inchangée pour cette application, qui conserve les noms Essentiel, Services
 Complet… »                                   et Complet.




Cahier des charges — Kiosko · v1.0 · 31 octobre 2026                                                                     Page 9

---

<!-- Page 10 -->

 Annexe B. Cahier des charges Kiosko v1.2 — texte intégral
 Les pages suivantes reproduisent sans modification le cahier des charges Kiosko v1.2 (31 octobre 2026,
 19 pages). Leur numérotation (« Page x sur 19 ») est celle de la v1.2 ; l'annexe A de ce document liste
 les dispositions remplacées.




Cahier des charges — Kiosko · v1.0 · 31 octobre 2026                                              Page 10

---

<!-- Page 11 -->

 Cahier des charges — Kiosko
 Version 1.2 · 31 octobre 2026 · Porteuse du projet : Audrey Mendomo Nko'o · Addendum 1 (section 6.11), relecture
 de cohérence et protections (section 14.5) intégrés
 Remplace la version 1.1 du 31 octobre 2026 et la version 1.0 (nom provisoire « NAXA CALL-BOX »).


## 0. Lecture du document
  - [V] validé par la porteuse du projet · [P] proposé, à valider · [O] point ouvert.
  - Cette version intègre toutes les décisions de la revue des 30 et 31 octobre 2026, l'addendum 1 (solutions de
     secours pour la lecture des SMS, section 6.11), les corrections de la relecture de cohérence et les protections
     contre la copie de l'APK et le contournement de l'abonnement (section 14.5). Les 12 points ouverts de la version
     1.0 sont tranchés (section 18).
  - Vocabulaire : dans ce document, « PIN » désigne uniquement le code secret de l'opérateur (Orange Money,
     MTN), qui n'est jamais demandé ni stocké. Le code de l'application s'appelle « code d'accès ».

 Principales évolutions par rapport à la version 1.0
## 1. Nouveau nom : Kiosko, logo en petit kiosque rayé, identité visuelle bleue. [V]
## 2. Distribution par APK direct uniquement, sans Play Store ; lecture des SMS par simples permissions. [V]
## 3. Natures d'opérations détaillées (approvisionnement, déstockage, C2C…). [V]
## 4. Wave prévu comme réseau paramétrable. [V]
## 5. Nouveaux rôles : commercial (avec géolocalisation du point) et partenaire (parrainage rémunéré). [V]
## 6. Roue de la chance promotionnelle à tirage réel. [V]
## 7. Tarification, prorata, blocage après échéance et tolérance hors connexion précisés. [V]
## 8. Données : Supabase en source principale, Drive en sauvegarde. [V]
## 9. Français et anglais dès la V1, choix de la langue sur la première page. [V]
## 10. Cas du téléphone de dépannage (puce déplacée). [V]
## 11. Solutions de secours pour la lecture des SMS : partage de SMS, saisie manuelle guidée, alerte de trou dans la
     chaîne des soldes, tests sur 4 ou 5 téléphones courants (section 6.11). [V]

 Corrections et ajouts de la relecture de cohérence (31 octobre 2026)
 - Lancement en V1 du seul palier Essentiel ; Services arrive en V2 et Complet en V3 (10.2, 17.2). [V]
 - Point supplémentaire (+500 F) réservé aux paliers Services et Complet ; l'Essentiel est limité à un point de vente
     (9.6, 10.2, 10.4, 10.7). [V]
  - Roue de la chance : option retirée du premier tour et de la liste des lots ; l'essai gratuit reste de 14 jours (10.9).
     [V]
  - Exports : export des données pour tous les paliers ; rapports PDF et Excel mis en forme à partir de Services (7.6,
     10.2). [P]
  - Gratuité : le nom de domaine et le dépôt de la marque s'ajoutent à la relecture juridique comme dépenses
     prévues (1.5, 15.2). [P]
  - Forfait 3 mois : prix arrondis à la centaine inférieure (10.3, 10.4). [P]
  - Tolérance hors connexion détaillée pour le palier Complet (8.1). [P]
  - Plan de réalisation : IA locale de base avancée avant l'abonnement (17.1) ; notification « SMS partagé à vérifier
     » définie (6.11.1) ; statut des services du tableau 10.2.1 précisé. [P]
  - Nouvelle section 14.5 : protection contre la copie de l'APK et le contournement de l'abonnement (signature,
     blocage côté serveur, identifiant de transaction unique, filigrane des exports, mise à jour obligatoire). [P]


## 1. Présentation du projet
 1.1 Vision
 Kiosko est l'outil de gestion tout-en-un des points de vente de mobile money (Orange Money, MTN MoMo et, selon
 la disponibilité de SMS exploitables, Wave) et de services associés. L'application lit automatiquement les SMS de
 transaction, met à jour en temps réel la caisse, les floats, les ventes et les commissions, alerte le livreur et assiste
 le gérant grâce à l'IA, même sans connexion. [V]

 1.2 Nature du projet


Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                   Page 1 sur 19

---

<!-- Page 12 -->

  - Projet nouveau et distinct de NAXA pharmacie, construit de zéro : dépôt GitHub, projet Supabase, APK et
     données propres, sans code ni base partagés. [V]
  - Modèle économique : abonnement mensuel avec essai gratuit de 14 jours (section 10). [V]
  - Marque : Kiosko, présentée seule, sans mention « by NAXA ». [V]
 1.3 Objectifs
## 1. Donner au gérant une vue exacte et instantanée de sa caisse, de ses floats et de ses commissions.
## 2. Supprimer la saisie manuelle : le SMS de transaction met tout à jour automatiquement.
## 3. Prévenir les ruptures de float en alertant le livreur au bon moment.
## 4. Gérer l'ensemble des services (OM, MoMo, Wave, Camtel, Canal+, factures, transferts…).
## 5. Permettre aux propriétaires de plusieurs points de vente de tout piloter depuis un compte mère.
## 6. Intégrer l'IA : prévoir, détecter les anomalies, conseiller, répondre aux questions.
## 7. Fonctionner hors connexion et sauvegarder dès le retour du réseau.
## 8. Encaisser et piloter l'activité grâce à un espace admin complet (validation, gestion, BI, pilotage).
## 9. Développer le réseau grâce aux commerciaux, aux partenaires parrains et aux offres promotionnelles.
 1.4 Cibles
 Gérants et propriétaires de points de vente mobile money au Cameroun, du petit kiosque au réseau multi-points,
 dans les zones francophones et anglophones. Administratrice : la porteuse du projet.

 1.5 Contraintes et principes directeurs
 - Gratuité : construction et exploitation de départ sans frais d'outils, d'hébergement, de notifications ni de
     sauvegardes. Seules dépenses prévues : la relecture juridique ponctuelle (section 14.3), le nom de domaine de
     la page de téléchargement et le dépôt éventuel de la marque (section 15.2). [V]
  - Android uniquement : la lecture des SMS est impossible sur iPhone et dans une PWA. [V]
  - Hors connexion d'abord. [V]
  - Alerte WhatsApp par message préparé (lien wa.me, un clic), car un envoi automatique gratuit n'est pas possible.
     [V]
  - L'IA propose, l'humain décide : jamais de validation de paiement ni de modification de solde par l'IA seule. [V]
  - Sécurité : aucun code PIN ni OTP n'est lu, stocké ou transmis. [V]
  - Simplicité : pensé pour des utilisateurs non techniciens sur téléphones d'entrée de gamme. [P]
  - Réalisation par prompts successifs adressés à ChatGPT, un prompt autonome à la fois. [P]

## 2. Périmètre : réseaux, services et natures d'opérations
 2.1 Socle [V]
 - Orange Money : crédit de communication, dépôt/retrait, Good Deal.
 - MTN MoMo : crédit de communication, dépôt/retrait, Good Deal.
 2.2 Wave et réseaux paramétrables [V]
 Les réseaux sont paramétrables (nom, expéditeur officiel, règles d'analyse, float, couleur de pastille). Wave est
 ajouté comme réseau dès qu'un corpus de SMS réels exploitables est collecté ; sinon, saisie manuelle guidée. Un
 nouveau réseau s'ajoute sans refonte. Wave est inclus à partir du palier Services (1 500 F), et non dans l'Essentiel ;
 il arrive donc avec le palier Services (V2).

 2.3 Services complémentaires
 - Validés : Camtel, réabonnement Canal+. [V]
 - Palier « Complet » : paiements internationaux, impôts et autres paiements administratifs. [V]
 - Proposés : Eneo, Camwater, StarTimes et DStv, forfaits internet Orange et MTN, crédit Nexttel (et Yoomee),
     transferts (Express Union, Western Union, MoneyGram, OM vers MoMo), frais scolaires et de concours, billets de
     transport, assurances. [P]

 2.4 Natures d'opérations [V]
 Chaque opération porte une nature et un effet précis sur les soldes. Définitions à confirmer par la porteuse du
 projet [P].




Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés               Page 2 sur 19

---

<!-- Page 13 -->

Nature                                                         Float du réseau           Espèces           Autres soldes
Dépôt (le client dépose, le gérant envoie la monnaie           −                         +                 —
électronique)
Retrait                                                        +                         −                 —
Approvisionnement en float (achat auprès du livreur, du        +                         −                 —
superviseur ou d'un agent)
Déstockage (retour ou revente de float)                        −                         +                 —
C2C (échange de float de call box à call box)                  + ou − selon le sens      contrepartie      —
                                                                                         éventuelle
Crédit et Good Deal : approvisionnement                        −                         —                 stock de crédit +
Crédit et Good Deal : vente                                    —                         +                 stock de crédit −,
                                                                                                           marge =
                                                                                                           commission

 Chaque ligne indique si elle provient d'un SMS ou d'une saisie manuelle.

 2.4.1 Cartes SIM, prestations et ventes diverses [V]
 Inclus dès le palier Essentiel (1 000 F) :
  - Vente de cartes SIM : stock de cartes par réseau, vente (espèces +, stock −) et bénéfice par carte.
  - Services d'identification : identification d'une ligne, mise à jour d'identification et reconduction. Chaque
     prestation est enregistrée avec son montant et sa commission ; aucune pièce d'identité n'est conservée.
  - Service OTP : la prestation et son montant sont enregistrés ; le code lui-même n'est jamais lu, affiché, stocké ni
     transmis (règle de sécurité de la section 1.5).
  - Autres ventes et petits services libres : le point de vente crée ses propres articles et prestations (nom, prix,
     bénéfice facultatif), par exemple biscuits, accessoires ou photocopies, encaissés en espèces et comptés dans la
     caisse, sans effet sur les floats. La gestion d'un stock détaillé d'articles reste facultative et simple ; les fonctions
     avancées arrivent avec les paliers supérieurs.

 2.5 Règles communes à tous les services
 - Chaque service a son propre solde (float OM, float MoMo, unités Camtel…), son taux de commission réglable et
     son historique. [P]
  - Services sans SMS exploitable (Canal+, Camtel peut-être) : saisie manuelle guidée (section 6.11.2). [P]
  - Bouton « Autre service » : le point de vente crée un service (nom, solde, commission) pour ne jamais être
     bloqué. [P]
  - Services actifs selon le palier d'abonnement (section 10). [V]

## 3. Acteurs et rôles
  - Propriétaire (compte mère) : voit et pilote tous ses points de vente. [V]
  - Gérant : gère un point de vente (caisse, ventes, réglages). [P]
  - Caissier ou employé : opérations du quotidien, sans accès aux réglages sensibles ni aux autres points. [P]
  - Administratrice Kiosko : espace admin complet et téléphone admin (APK en mode admin) qui détecte les
     paiements d'abonnement. [V]
  - Commercial : prospecte et accompagne les points de vente d'une zone. Il reçoit les données nécessaires à son
     action (point de vente, gérant, téléphone, quartier, géolocalisation précise, statut, échéance, notes) avec
     boutons Itinéraire et WhatsApp. Il n'a jamais accès aux transactions détaillées. [V]
  - Partenaire : parrain externe, avec visibilité à 360° sur ses points parrainés et commission de parrainage (section
     10.8). [V]
  - Contacts externes (non utilisateurs) : livreur de float, chef secteur Orange Money, support. [V]
  - Droits : le propriétaire fixe ce que chaque rôle du point de vente peut faire (annuler une opération, modifier un
     taux…). [P]
 Géolocalisation du point de vente [V] : enregistrée à l'inscription avec le consentement du gérant (bouton «
 Enregistrer la position de mon point »), puis confirmée sur place par le commercial. Elle sert uniquement à la visite
 commerciale et à la zone.


## 4. Architecture technique


Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                      Page 3 sur 19

---

<!-- Page 14 -->

 4.1 Vue d'ensemble [P]
 Trois briques, toutes gratuites :
## 1. Une APK Android unique avec trois modes : point de vente, propriétaire (compte mère), admin.
  2. Un backend Supabase : base PostgreSQL, authentification, règles de sécurité par ligne (RLS), temps réel,
     fonctions serveur, stockage. Source de vérité des données.
## 3. Une application web responsive (PWA) branchée sur le même Supabase, pour l'administratrice (indispensable
     en V1), puis le propriétaire, le commercial et le partenaire (V2). Pas de version web pour le gérant et le caissier,
     qui gardent l'APK. [V]

 4.2 Pile recommandée [P]
 - Android natif (Kotlin : Room/SQLite, WorkManager, récepteur de SMS) ou Flutter/Capacitor avec plugin SMS.
     Critère décisif : fiabilité de la lecture des SMS en arrière-plan ; ChatGPT justifie son choix.
  - Supabase (offre gratuite), Firebase Cloud Messaging (push, gratuit), Google Drive API (sauvegardes), GitHub et
     GitHub Actions (construction et signature de l'APK), GitHub Releases (distribution).
  - IA : calculs sur le téléphone (statistiques, règles) et API d'IA gratuite pour l'assistant (quotas à vérifier au
     moment de construire).
  - Application construite pour plusieurs langues : aucun texte écrit en dur dans le code.
 4.3 Distribution [V]
 - APK direct uniquement, pas de Play Store. Pas de déclaration Google, pas de messagerie par défaut.
 - Une page de téléchargement officielle unique (un seul lien à donner aux clients), avec l'empreinte de l'APK
     affichée.
  - Guide illustré d'installation : « sources inconnues » puis autorisation des « paramètres restreints » d'Android
     avant la permission SMS, avec étapes par marque de téléphone.
  - Mise à jour : vérification de version au démarrage, lien de téléchargement, mise à jour obligatoire possible. [P]
 4.4 Dépôt et qualité [P]
 Nouveau dépôt GitHub dédié, branche principale protégée, intégration continue, tests automatiques (surtout le
 parseur de SMS), environnements test et production.


## 5. Architecture de notifications
 5.1 Objectif [V]
 Informer en temps réel, même application fermée ou téléphone hors connexion, en communiquant directement
 avec le téléphone du gérant, du propriétaire et de l'administratrice.

 5.2 Les quatre canaux (gratuits)
## 1. Notifications locales : créées par l'APK sans Internet (SMS détecté, seuil de float, écart de caisse, rappels
     d'échéance).
## 2. Notifications push FCM : du serveur vers le téléphone, en messages de données à haute priorité (paiement
     validé, compte réactivé, alerte compte mère, relance admin, mise à jour).
## 3. Messages WhatsApp préparés : l'action d'une notification ouvre WhatsApp avec le message prérempli ; envoi
     en un clic.
## 4. Centre de notifications dans l'application : boîte persistante, lu/non lu, historique, actions rejouables.
 Aucun SMS sortant payant.

 5.3 Mécanique
 - Canaux Android distincts : Critique, Opérations, Abonnement, Compte mère, Information, Coaching IA.
 - Boutons d'action : Envoyer au livreur, Voir, Plus tard, Marquer résolu.
 - Jeton FCM enregistré par appareil (table devices), rafraîchi automatiquement, supprimé à la déconnexion.
 - Une fonction serveur (Edge Function) crée et envoie les notifications ; file avec statuts : créée, envoyée, reçue,
     lue, action effectuée ; nouvelles tentatives avec délais croissants.
  - Hors connexion : les notifications locales continuent ; les push en attente sont livrés au retour du réseau.
  - Anti-doublon : clé unique par événement ; une alerte par seuil, réarmée quand le niveau est rétabli puis franchi
     à nouveau.
  - Heures calmes et préférences par type, sauf alertes critiques.


Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                     Page 4 sur 19

---

<!-- Page 15 -->

  - Textes courts, dans la langue choisie, montants formatés (45 000 F).
 5.4 Fiabilité sur téléphones d'entrée de gamme
 - Service de premier plan avec notification discrète « Kiosko actif ».
 - Assistant de configuration au premier lancement : paramètres restreints d'Android, optimisation de batterie,
     démarrage automatique, verrouillage de l'application en mémoire (étapes selon la marque).
  - Écran « Santé de l'appli » : permission SMS, paramètres restreints, batterie, notifications, dernière
     synchronisation, dernier SMS lu ; alerte si un élément est retiré.

 5.5 Catalogue des notifications
 - Opérations : float bas, solde de caisse bas, demande de float prête, écart de caisse, SMS non reconnu, écart de
     solde détecté (section 6.11.3), SMS partagé à vérifier (section 6.11.1), opération en double, activité inhabituelle,
     crédit client en retard, float reçu à confirmer, résumé du jour.
  - Abonnement : fin d'essai (J-3, J-1, jour J), offre de bienvenue (48 h), échéance (J-7, J-3, J-1, jour J), compte
     bloqué, paiement reçu et compte réactivé, mois offerts accordés.
  - Compte mère : alertes de tous les points, point inactif, transfert de float.
  - Administratrice : paiement à valider ou non reconnu, nouvelle inscription, essais qui se terminent, clients à
     risque, SMS non reconnus par format, erreur de synchronisation.
  - Commercial et partenaire : nouveau point à visiter, point à relancer, commission acquise ou payée.
  - Sécurité : nouvelle connexion ou nouvel appareil, changement de code d'accès, permission SMS retirée.
  - Système : synchronisation terminée ou échouée, nouvelle version de l'APK.
  - IA : prévision d'épuisement de float, conseils, résumé quotidien.
 Taux de réception, d'ouverture et d'action par type, visibles dans le BI admin. [P]


## 6. Lecture des SMS
 6.1 Principe [V]
 Dès qu'un SMS de transaction arrive, l'application le lit, l'analyse et met à jour automatiquement soldes, ventes,
 commissions, listing et alertes.

 6.2 Mode d'accès [V]
 Simples permissions de réception et de lecture des SMS, sur APK distribué directement. L'application n'est pas la
 messagerie par défaut et ne gère pas la messagerie du gérant.

 6.3 Identification du réseau [V]
 Le réseau est identifié par l'expéditeur officiel du SMS (MoMo = MTN, OrangeMoney = Orange, Wave = Wave).
 Aucune gestion spécifique de la double SIM : peu importe la SIM qui reçoit le message. Deux numéros du même
 réseau alimentent le même float. Les noms exacts d'expéditeur sont à relever sur de vrais téléphones. [O]

 6.4 Chaîne de traitement
## 1. Réception du SMS.
## 2. Filtre sur l'expéditeur officiel.
## 3. Les SMS contenant un code OTP ou PIN sont ignorés : jamais lus, stockés, transmis ni affichés. [V]
## 4. Analyse par règles versionnées, par réseau et par type de message.
## 5. Extraction : nature de l'opération, montant, frais ou commission, solde après opération, ID de transaction, date
     et heure, contrepartie (numéro masqué).
## 6. Contrôle de cohérence : ancien solde ± montant = nouveau solde, sinon marquage « à vérifier ».
## 7. Dédoublonnage par ID de transaction.
## 8. Enregistrement local, mise à jour des soldes et commissions, notifications, file de synchronisation.
 6.5 Événements à reconnaître
 Dépôt, retrait, transfert, approvisionnement et déstockage de float, C2C, achat et vente de crédit, Good Deal,
 paiement de facture ou de service, commission reçue, opération échouée ou annulée et, côté admin, paiement
 d'abonnement reçu sur le code marchand.

 6.6 Règles à jour sans nouvelle APK [P]




Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                  Page 5 sur 19

---

<!-- Page 16 -->

 Les règles d'analyse sont stockées dans Supabase (table parser_rules, versionnées) et téléchargées à la
 synchronisation : si un opérateur change ses formats, on corrige sans republier l'APK.

 6.7 SMS non reconnus [P]
 File « À classer » : le gérant classe manuellement, l'IA propose un classement. L'admin voit des statistiques par
 format pour corriger les règles.

 6.8 Confidentialité des SMS [P]
 Le texte brut reste chiffré sur le téléphone ; seuls les champs extraits sont synchronisés.

 6.9 Téléphone de dépannage (puce déplacée) [V]
 Les SMS arrivent sur le téléphone qui porte la puce. Si le téléphone du point est éteint et la puce mise ailleurs :
  - Le gérant se connecte avec son compte sur le téléphone de dépannage ; le propriétaire est notifié du nouvel
     appareil.
  - À l'activation, l'application importe les SMS de transaction de la boîte de réception depuis la dernière
     synchronisation, sans doublon (ID de transaction).
  - Jusqu'à 2 appareils actifs par point de vente, avec fermeture automatique du plus ancien au-delà.
  - Un bouton « Importer les SMS manquants » est aussi disponible après une réinstallation.
  - Au retour de la puce, le premier téléphone récupère tout par synchronisation.
 6.10 Corpus de SMS à collecter avant construction [O]
 Exemples réels, numéros masqués, pour Orange Money, MoMo et Wave : dépôt, retrait, approvisionnement,
 déstockage, C2C, vente de crédit, Good Deal, paiement reçu sur code marchand, échec ou annulation, et Camtel,
 Canal+, factures s'il existe des SMS. Inclure des exemples des zones anglophones. Le parseur est testé sur ce
 corpus.

 6.11 Solutions de secours pour la lecture des SMS [V]
 Objectif : ne jamais perdre une opération, même si la lecture automatique échoue (permission refusée ou retirée,
 téléphone qui coupe l'application en arrière-plan, SMS manquant, réseau sans SMS exploitable). Les quatre
 solutions ci-dessous s'ajoutent à la lecture automatique (6.4) et au téléphone de dépannage (6.9).

 6.11.1 Partager un SMS vers Kiosko
 - Kiosko apparaît dans le menu Partager du téléphone. Le gérant ouvre le SMS dans sa messagerie, appuie sur
     Partager, choisit Kiosko : deux touches.
  - Bouton de repli « Coller un SMS » dans l'écran Transactions, pour les messageries qui n'offrent que Copier. Le
     gérant peut coller plusieurs SMS d'un coup : Kiosko les sépare et les analyse un par un.
  - Le texte passe par la même chaîne de traitement que les SMS lus automatiquement (6.4), sans demander la
     permission SMS : analyse par règles, extraction, contrôle de cohérence des soldes, dédoublonnage par ID de
     transaction.
  - Le réseau est reconnu par le format du message ; en cas de doute, Kiosko demande au gérant de le choisir.
  - Un SMS partagé ne peut pas être vérifié comme venant de l'expéditeur officiel. La ligne est donc marquée «
     partagé » et passe le contrôle de cohérence des soldes. Un SMS partagé ne sert jamais à activer un abonnement
     : seul le téléphone admin, qui lit les vrais SMS, le fait (10.6).
  - Notification « SMS partagé à vérifier » : envoyée lorsqu'un SMS partagé échoue au contrôle de cohérence des
     soldes ou que son réseau n'a pas pu être reconnu. La ligne reste « à vérifier » jusqu'à ce que le gérant la
     confirme, la corrige ou l'annule. [P]
  - Un message contenant un code OTP ou un PIN n'est ni analysé ni enregistré ; Kiosko l'indique au gérant (règle
     de sécurité de la section 1.5).
  - Fonctionne hors connexion.
 6.11.2 Saisie manuelle guidée
 - Formulaire par nature d'opération (section 2.4) : réseau, nature, montant, ID de transaction (facultatif mais
     recommandé), heure automatique, commission calculée d'après le taux réglé, solde après opération (facultatif).
  - Avant de valider, Kiosko affiche l'effet sur le float, les espèces et le stock (par exemple : float MoMo − 20 000 F,
     espèces + 20 000 F).
  - Montants fréquents mémorisés en gros boutons pour une saisie rapide.




Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                  Page 6 sur 19

---

<!-- Page 17 -->

  - Usages : réseaux ou services sans SMS exploitable (Wave tant que son corpus n'est pas collecté, Canal+,
     Camtel), opérations sans SMS, panne de lecture.
  - Chaque ligne porte sa source : SMS automatique, partagé, import ou manuel.
  - Rapprochement : si le SMS réel arrive ensuite avec le même montant et un horaire proche, Kiosko fusionne les
     deux lignes pour ne pas compter l'opération deux fois ; en cas de doute, le gérant tranche.

 6.11.3 Alerte de trou dans la chaîne des soldes
 - Chaque SMS indique le solde après opération. Kiosko calcule le solde attendu (solde après l'opération
     précédente ± montant de l'opération reçue) et le compare au solde du SMS, réseau par réseau.
  - Si l'écart n'est pas nul, notification : « Il manque des opérations d'environ X F sur [réseau], entre [heure] et
     [heure]. » Le signe de l'écart aide à deviner la nature (float qui baisse : dépôt ou déstockage probable ; float qui
     monte : retrait ou approvisionnement probable).
  - Pour limiter les fausses alertes : Kiosko tient compte de tous les SMS du réseau qui portent un solde, y compris
     les messages non reconnus (file « À classer ») ; il remet les SMS arrivés dans le désordre dans l'ordre de l'heure
     et de l'ID ; il attend quelques minutes avant d'alerter ; il n'alerte qu'une fois par trou.
  - Actions proposées sur l'alerte : Importer les SMS manquants (6.9), Partager un SMS (6.11.1), Ajouter une
     opération manuelle (6.11.2), ou Marquer comme écart justifié avec une raison (par exemple opération
     personnelle sur la même ligne).
  - Un trou non résolu reste visible dans le tableau de bord et dans le bilan de clôture de journée.
  - Les soldes de départ saisis à la configuration servent de premier repère.
  - L'admin voit en BI le nombre de trous par réseau et par modèle de téléphone, indicateur de qualité de la lecture
     (13.3). [P]

 6.11.4 Tests sur 4 ou 5 téléphones courants au Cameroun
 - Choix des modèles : les téléphones les plus utilisés par les points de vente du pilote (à relever auprès d'eux),
     dont au moins un modèle d'entrée de gamme avec peu de mémoire, une version récente d'Android avec
     paramètres restreints, un téléphone à double SIM.
 Scénarios à passer sur chaque téléphone :
## 1. Installation de l'APK, autorisation des paramètres restreints, permission SMS.
## 2. Réception de SMS écran éteint pendant une heure.
## 3. Application balayée de la mémoire récente, puis réception de SMS.
## 4. Économie de batterie activée.
## 5. Redémarrage du téléphone : traitement des SMS reçus depuis le dernier traitement.
## 6. Double SIM : SMS reçus sur chaque carte.
## 7. Perte de réseau puis retour : synchronisation sans doublon.
## 8. Rafale de 50 SMS : aucun perdu, aucun doublon.
## 9. Mise à jour de l'APK par-dessus la version installée.
## 10. Test continu de 72 heures avec mesure de la consommation de batterie.
  - Objectifs à mesurer [P] : 0 SMS perdu sur 200 messages de test ; opération visible quelques secondes après le
     SMS ; consommation de batterie faible (cible à fixer, par exemple moins de 5 % par jour).
  - Livrables : fiche de compatibilité par modèle (fonctionne, fonctionne avec réglages, ne fonctionne pas), guide de
     réglages par marque qui alimente le guide illustré d'installation (4.3) et l'assistant de configuration (5.4), liste
     des modèles recommandés pour le pilote.
  - Moment : à l'étape 3 de la construction (APK), puis de nouveau avant le pilote (17.1).

## 7. Application du point de vente
 7.1 Inscription et prise en main
 - Première page : choix de la langue (Français ou English), présélectionnée selon la langue du téléphone. [V]
 - Inscription : nom du point de vente, ville et quartier, position GPS (avec consentement), réseaux et services
     proposés, téléphone ; l'essai gratuit de 14 jours démarre. [V]
  - Configuration guidée : paramètres restreints, permissions SMS, batterie et notifications, soldes de départ, seuils,
     contacts (livreur, chef secteur). [P]
  - Code d'accès local (code à 4 chiffres ou empreinte) à chaque ouverture. [P]




Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                    Page 7 sur 19

---

<!-- Page 18 -->

 7.2 Tableau de bord [V]
 Soldes par réseau et en espèces ; ventes et commissions du jour ; alertes ; prévision d'épuisement de float (IA) ;
 état de synchronisation ; trous de solde non résolus (6.11.3).

 7.3 Caisse et float [V]
 - Ouverture de journée (fond de caisse en espèces et floats), clôture avec écart signalé, solde attendu et solde
     réel.
  - Enregistrement de chaque opération selon sa nature (section 2.4), avec le solde disponible après opération.
  - Suivi des commandes de float (demandée, en route, reçue) et des livraisons.
  - Seuil minimum par réseau et montant à demander, réglables.
 7.4 Transactions et ventes [V]
 - Liste alimentée automatiquement par les SMS, classée par nature et par service.
 - Bouton « + Vente » pour les opérations sans SMS.
 - Boutons « Partager ou coller un SMS » (6.11.1) et « Saisie manuelle » (6.11.2).
 - Étiquette de source sur chaque ligne : SMS automatique, partagé, import ou manuel.
 - Écran « Trous à résoudre » (6.11.3).
 - Correction ou annulation avec raison obligatoire et journal (qui, quand, avant et après).
 - Détection des doublons ; recherche et filtres.
 7.5 Commissions et rentabilité [V]
 Commissions par opération, service, jour, semaine et mois ; opérations les plus rentables ; charges (transport,
 forfait, loyer, salaires) puis bénéfice net.

 7.6 Listing et rapports [V]
 Listing filtrable (date, nature, montant, service, employé) ; bilans jour, semaine, mois ; export des données (listing
 et historique, en PDF simple et Excel) pour tous les paliers ; rapports PDF et Excel mis en forme à partir du palier
 Services (section 10.2) ; historique utilisable comme preuve d'activité.

 7.7 Alertes livreur et chef secteur [V]
 - Contacts enregistrés : livreur, chef secteur Orange Money (et MTN), support.
 - Quand le solde atteint le seuil, l'application calcule le montant à demander et prépare le message ; l'action
     ouvre WhatsApp (lien wa.me) avec le texte prérempli ; envoi en un clic.
  - Modèles par besoin, modifiables (annexe B).
  - Règle de sécurité : aucun message ne contient jamais de code PIN ou OTP.
 7.8 Clients et crédits [V]
 Carnet de clients réguliers, dettes et créances, rappels avec message WhatsApp préparé, historique.

 7.9 Employés [P]
 Plusieurs utilisateurs par point de vente selon le palier, droits par rôle, journal et écarts par employé.

 7.10 Aide, langue et paramètres
 Aide intégrée avec exemples [V]. Paramètres : seuils, taux, contacts, modèles de messages, notifications, sécurité,
 sauvegarde Drive, langue (Français, English), modifiable à tout moment dans les options du compte. [V]


## 8. Fonctionnement hors connexion [V]
  - Principe : tout fonctionne d'abord sur le téléphone (base locale SQLite) ; la synchronisation se fait au retour du
     réseau.
  - Sans Internet : lecture des SMS, partage de SMS et saisie manuelle, caisse, ventes, commissions, listing, IA
     locale (prévisions, anomalies, coach, résumés), notifications locales, préparation des messages WhatsApp.
  - Avec Internet seulement : synchronisation Supabase, sauvegarde Drive, assistant en langage naturel (hors
     connexion : questions prédéfinies comme « Ma caisse du jour »), vérification d'abonnement, compte mère,
     espace admin, envoi effectif des messages WhatsApp.
  - Synchronisation : file d'attente par lots, reprise automatique après coupure, ID de transaction pour éviter les
     doublons. Une transaction issue d'un SMS est immuable ; les corrections s'ajoutent comme écritures nouvelles.
     [P]


Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                 Page 8 sur 19

---

<!-- Page 19 -->

  - Compte mère : les données d'un point apparaissent après sa synchronisation, avec un indicateur « dernière
     mise à jour ». [P]
  - Téléphone admin : la détection des paiements fonctionne hors connexion ; l'activation du compte attend le
     retour du réseau.

 8.1 Tolérance hors connexion
 - Tolérance de 7 jours pour Essentiel et Services, 14 jours pour Complet.
 - L'heure du serveur est mémorisée à chaque synchronisation ; un recul d'horloge du téléphone est détecté et
     restreint l'accès.
  - La tolérance s'applique aussi aux clients qui ont payé un forfait long.
Essentiel et Services (7 jours)        Complet (14 jours)               Comportement
Jours 1 à 3                            Jours 1 à 3                      Tout fonctionne ; petit témoin « non synchronisé »
Jours 4 à 6                            Jours 4 à 13 [P]                 Message « Connectez-vous à Internet avant le [date] »,
                                                                        rappel quotidien
Jour 7 et après                        Jour 14 et après                 Accès restreint ; les SMS restent enregistrés sur le téléphone
                                                                        ; dashboard bloqué jusqu'à la prochaine connexion



## 9. Compte mère et architecture mère-fille [V]
 9.1 Principe
 Un compte mère (le propriétaire) coiffe plusieurs points de vente (comptes fille). Le compte mère est disponible à
 partir du palier Services (V2). Le palier Essentiel est limité à un seul point de vente.

 9.2 Compte mère
 - Tableau de bord consolidé : soldes, floats, commissions et ventes du jour de tous les points.
 - Comparaison entre points : meilleur, moins actif, écarts de caisse.
 - Alertes de tous les points (float bas, écart, inactivité).
 - Création, activation et désactivation d'un point de vente.
 - Règles communes : seuils, taux de commission, services proposés.
 - Bilan global ou par point, exportable.
 9.3 Point de vente
 Il ne voit que sa propre caisse et ses propres opérations, jamais celles des autres points. Le propriétaire choisit ce
 qu'il peut modifier.

 9.4 Fonctions associées [P]
 - Transfert de float entre points de vente, tracé des deux côtés et confirmé par le receveur.
 - Rôles propriétaire, gérant, caissier.
 - Rapport comparatif entre points.
 - Un téléphone par point de vente (avec téléphone de dépannage, section 6.9) : chaque APK lit les SMS de son
     téléphone et synchronise vers le compte mère.

 9.5 Technique [P]
 Tables organizations (comptes mère) et outlets (points de vente rattachés) ; règles RLS pour que chacun ne voie
 que ses lignes ; consolidation après synchronisation, avec indicateur de fraîcheur. Cette structure est prévue dès la
 V1, même si l'écran du compte mère arrive en V2, pour éviter de reconstruire les données.

 9.6 Tarification [V]
 - Le 1er point de vente est inclus dans le palier ; +500 F par mois à partir du 2e point, uniquement dans les
     paliers Services et Complet. Le palier Essentiel est limité à un seul point de vente.
  - Palier unique pour tous les points d'un même propriétaire.
  - Désactiver un point arrête le 500 F à l'échéance suivante, sans remboursement.
  - Ajouter un point en cours de période : 500 F au prorata des jours restants (section 10.7).

## 10. Abonnement, facturation et paiements


Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                             Page 9 sur 19

---

<!-- Page 20 -->

 10.1 Cycle de vie [V]
## 1. Inscription : essai gratuit de 14 jours.
## 2. Fin d'essai : à la connexion, un écran de paiement s'affiche. Sans paiement, le dashboard est bloqué ; restent
     visibles les informations du compte, la formule, le montant à payer et le code marchand de l'administratrice.
## 3. Paiement : chaque paiement active ou prolonge l'accès ; renouvellement mensuel (ou selon le forfait choisi).
## 4. Réactivation : l'application de l'administratrice détecte le SMS de paiement et réactive le compte.
 10.2 Paliers mensuels [V]
 Lancement V1 : palier Essentiel seul. Le palier Services s'ouvre en V2, avec ses fonctions ; le palier Complet s'ouvre
 en V3, quand ses fonctions sont prêtes. [V] Chaque point supplémentaire (à partir du 2e) : +500 F par mois, dans
 les paliers Services et Complet uniquement.
                                                      Essentiel               Services                     Complet
Prix par mois                                         1 000 F                 1 500 F                      3 000 F
Points de vente                                       1 seul                  1 + points                   1 + points
                                                                              supplémentaires à 500 F      supplémentaires à 500 F
OM, MoMo, caisse, float, commissions                  oui                     oui                          oui
Alertes de float et livreur WhatsApp                  oui                     oui                          oui
Utilisateurs par point                                1                       jusqu'à 3                    illimité
Services additionnels (Canal+, Camtel, Eneo…)         non                     oui                          oui
Crédits clients et relances                           non                     oui                          oui
Export des données (listing, historique)              oui                     oui                          oui
Rapports PDF et Excel mis en forme (bilans)           non                     oui                          oui
Compte mère (multi-points)                            non                     oui                          oui
IA locale (prévision du float, coach du jour)         de base                 oui                          oui
Assistant IA en langage naturel                       non                     non                          oui
Sauvegarde automatique sur le Drive                   non                     non                          oui
Paiements internationaux, impôts                      non                     non                          oui
Tolérance hors connexion                              7 jours                 7 jours                      14 jours


 10.2.1 Services inclus par palier [V]
 Le palier Services comprend tout l'Essentiel ; le palier Complet comprend tout Services. Wave fait partie du palier
 Services (1 500 F). La répartition par palier est validée ; le contenu exact des services marqués [P] en 2.3 reste à
 confirmer.
Service                                                                      Essentiel          Services              Complet
Orange Money et MTN MoMo : dépôt, retrait, approvisionnement,                oui                oui                   oui
déstockage, C2C
Vente de crédit et Good Deal (Orange et MTN)                                 oui                oui                   oui
Vente de cartes SIM                                                          oui                oui                   oui
Identification, mise à jour d'identification, reconduction                   oui                oui                   oui
Service OTP (prestation et montant seulement, jamais le code)                oui                oui                   oui
Autres ventes et petits services libres (biscuits, accessoires…)             oui                oui                   oui
Wave (dès que ses SMS sont exploitables)                                     non                oui                   oui
Camtel, réabonnement Canal+, StarTimes et DStv                               non                oui                   oui
Eneo (électricité), Camwater (eau)                                           non                oui                   oui
Forfaits internet Orange et MTN, crédit Nexttel (et Yoomee)                  non                oui                   oui
Transferts nationaux : Express Union, OM vers MoMo                           non                oui                   oui
Frais scolaires et de concours, billets de transport, assurances             non                oui                   oui
Bouton « Autre service » (service avec solde et commission propres)          non                oui                   oui
Western Union, MoneyGram et autres paiements internationaux                  non                non                   oui
Impôts et paiements administratifs                                           non                non                   oui


 10.3 Forfaits [V]


Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                               Page 10 sur 19

---

<!-- Page 21 -->

 1 mois : prix normal. 3 mois : 10 % de réduction, prix arrondi à la centaine de francs inférieure [P]. 6 mois : 1 mois
 offert (5 mois payés). 12 mois : 2 mois offerts (10 mois payés). Accroche : « payez 10, recevez 12 ».

 10.4 Prix en francs CFA [V]
 Les prix sont à tester auprès de 5 ou 6 points de vente avant d'être figés. [P]
                                                         1 mois              3 mois             6 mois   12 mois
Essentiel                                                1 000               2 700              5 000    10 000
Services                                                 1 500               4 000              7 500    15 000
Complet                                                  3 000               8 000              15 000   30 000
Point supplémentaire (Services et Complet)               500                 1 300              2 500    5 000

 Forfaits de 3 mois : 10 % de réduction arrondis à la centaine inférieure (4 050 F donne 4 000 F ; 8 100 F donne 8
 000 F ; 1 350 F donne 1 300 F). [P]

 10.5 Offres et règles commerciales
 - Offre de bienvenue : paiement dans les 48 h après la fin de l'essai = 1 mois offert en plus. [V]
 - Parrainage entre points de vente : 1 mois offert pour le parrain et pour le nouveau point. [V]
 - Les mois offerts s'ajoutent à la date d'échéance. [V]
 - Cumul : bienvenue et parrainage cumulables ; réductions de forfait toujours appliquées ; code promo non
     cumulable avec la bienvenue ; mois de parrainage accordé après le premier paiement réel du filleul ; plafond de
     3 mois offerts par an (hors mois inclus dans les forfaits 6 et 12 mois). [P]
  - Aucun remboursement après paiement, écrit clairement dans les conditions. [V]
  - Codes promo et réductions paramétrables dans l'espace admin. [P]
 10.6 Parcours de paiement et détection
## 1. Le client choisit palier, durée et, pour Services et Complet, nombre de points ; l'application affiche le montant
     exact et une référence unique. [V]
## 2. Il paie par OM ou MoMo sur le code marchand de l'administratrice (renseigné dans les paramètres admin).
## 3. Il saisit l'ID de transaction dans l'application (bouton « J'ai payé »).
  4. Le téléphone admin (APK en mode admin) lit le SMS de paiement et vérifie : expéditeur officiel, montant exact,
     ID jamais utilisé.
## 5. Tout concorde : activation automatique et notification push au client. Sinon : file de validation manuelle de
     l'admin. [V]
## 6. Rapprochement sur ID unique + montant exact + numéro du payeur + horaire postérieur à l'affichage du
     montant, jamais sur le montant seul ; la référence est un contrôle bonus quand le réseau permet un message.
     [P]
## 7. Journal complet : qui a validé, quand, avec quel SMS.
## 8. Protection contre les faux SMS : expéditeur officiel, ID unique et, en cas de doute, vérification manuelle du
     solde du code marchand. [P]
## 9. Dépendance au téléphone admin : un deuxième téléphone admin de secours (dédoublonnage par ID), alerte si
     le téléphone n'a pas synchronisé depuis plus de 2 h, accès provisoire de 24 h (une seule fois par période) après
     « J'ai payé » ; objectif d'activation sous 5 minutes si le téléphone est en ligne, sinon sous 24 h ; validation
     manuelle possible depuis l'espace web admin. [P]
 Un SMS partagé par un client ou un gérant (section 6.11.1) n'est jamais utilisé pour activer un abonnement : seul le
 téléphone admin, qui lit les vrais SMS, le fait.

 10.7 Changement de formule [V]
 - Montée de palier : immédiate, avec complément = différence de prix mensuel × jours restants ÷ 30, calculé sur
     la valeur mensuelle du palier (pas sur le prix réduit du forfait), minimum 100 F. L'échéance ne change pas.
  - Descente de palier : à l'échéance, sans remboursement. Vers l'Essentiel, elle suppose un seul point de vente
     actif ; les points supplémentaires doivent être désactivés au préalable. [P]
  - Ajout d'un point en cours de période (Services et Complet) : 500 F au prorata des jours restants.
  - Exemple : 15 jours restants, Essentiel vers Services : (1 500 − 1 000) × 15 ÷ 30 = 250 F.
 10.8 Compte partenaire et parrainage rémunéré [V]




Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                Page 11 sur 19

---

<!-- Page 22 -->

  - Chaque partenaire dispose d'un code de parrainage unique et d'un espace avec visibilité à 360° sur ses points
     parrainés : nom du point, ville, statut (essai, actif, en retard), palier, échéance, dates, commissions gagnées et
     payées. Jamais de transactions détaillées.
  - Commission de 100 F par point de vente qui s'abonne, valable uniquement pour le premier abonnement du
     point : déclenchée au premier paiement validé, jamais à l'inscription ni pendant l'essai, une seule fois par point,
     jamais sur un mois offert.
  - Paiement mensuel par OM ou MoMo, validé par l'admin, avec seuil minimum de retrait. [P]
  - Anti-fraude : pas d'auto-parrainage (même téléphone ou même appareil), journal complet. [P]
  - Distinct du parrainage entre points de vente (1 mois offert, section 10.5).
 10.9 Roue de la chance [V]
 - Système promotionnel présenté comme un tirage réel, jamais comme un jeu truqué.
 - Tirage avec probabilités et stocks de lots réglés par l'admin : parasol, chasuble, table, chaise, T-shirt, casquette,
     sac bandoulière, SIM blanche, 5 000 F (très rare), et « 0 F, réessayez le mois prochain » assumé. [P]
  - Stock limité par lot, budget plafonné, règlement visible, journal de chaque tirage.
  - Un tour par période, conditions d'éligibilité affichées.
  - Vérification du cadre légal des jeux promotionnels avant le lancement (section 14.3).
 10.10 Rappels [P]
 Notifications d'échéance à J-7, J-3, J-1 et jour J ; de fin d'essai à J-3, J-1 et jour J.

 10.11 Blocage après échéance [V]
 - Les données ne sont jamais supprimées : l'accès est bloqué, l'export reste possible.
 - L'enregistrement des SMS continue en arrière-plan sur le téléphone seulement (pas de synchronisation serveur),
     sans notification, sans alerte de float et sans accès au dashboard.
  - Un compteur sur l'écran de paiement : « 47 opérations enregistrées pendant votre absence, elles seront
     récupérées dès le paiement ».
  - Au paiement, synchronisation et recalcul du dashboard.
  - Au bout de 60 jours de blocage, l'enregistrement s'arrête et le client est informé.
  - Côté serveur, un point dont l'abonnement est échu ne peut plus synchroniser, sauf pour l'écran de paiement ;
     ses données restent conservées et exportables (section 14.5). [P]


## 11. Données, stockage et sauvegarde [V]
 11.1 Principe
 Les données appartiennent au client. Elles sont conservées sur un serveur sécurisé pour faire fonctionner
 l'application. Le client peut à tout moment exporter l'intégralité de ses données (PDF, Excel, partage par WhatsApp
 ou e-mail) et, avec le palier Complet, recevoir une sauvegarde automatique quotidienne sur son propre Drive.

 11.2 Architecture
 - Supabase = source principale (rapidité, temps réel, compte mère, abonnement) ; base locale sur le téléphone.
 - Sauvegarde Drive (palier Complet) : API Google Drive gratuite, autorisation une seule fois, dossier créé par
     l'application, accès limité à ce dossier, restauration en un clic sur un nouveau téléphone.
  - Client sans compte Google : export manuel.
 11.3 Confidentialité et accès admin
 L'administratrice travaille sur des chiffres agrégés et des informations d'abonnement ; elle n'a pas besoin des
 transactions détaillées des clients. Le commercial et le partenaire n'y ont pas accès non plus. Cette règle est
 inscrite dans les conditions d'utilisation.

 11.4 Conservation
 Pas de suppression après échéance ; suppression complète sur demande du client, avec confirmation. [P]


## 12. Fonctions d'intelligence artificielle (IA)
 12.1 Principes [V]
 - L'IA propose, l'humain décide.


Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                Page 12 sur 19

---

<!-- Page 23 -->

  - Gratuite : la plupart des fonctions sont calculées sur le téléphone avec des statistiques et des règles.
  - Confidentialité : jamais de numéros de téléphone ni de SMS bruts envoyés à un service externe, seulement des
     données anonymisées.
  - Hors connexion d'abord ; transparence : chaque suggestion indique pourquoi.
 12.2 Pour le point de vente
 - Prévision du float : estimation de l'heure d'épuisement ; déclenche l'alerte et le message livreur. (Locale)
 - Détection d'anomalies : écart de caisse inhabituel, doublons, activité étrange d'un employé, SMS suspect ou
     faux. (Locale)
  - Coach du jour : résumé quotidien, heures de pointe, conseils de float et de services. (Locale)
  - Lecture des SMS : règles d'abord, IA en secours pour les formats inconnus.
  - Carnet de crédits : relances personnalisées avec message WhatsApp prêt. (Locale)
  - Assistant en langage naturel, écrit ou vocal (palier Complet) : en ligne ; hors connexion, questions prédéfinies.
     [P]
  - Aide intégrée : réponses aux questions d'utilisation. [P]
 12.3 Pour l'administratrice
 Prévision des départs, résumé matinal, aide à la validation des paiements non reconnus (l'admin valide), assistant
 de support, analyse des SMS non reconnus.

 12.4 Mise en œuvre [P]
 Priorité V1 : prévision du float, anomalies, coach du jour, parseur avec secours IA. API d'IA gratuite : quotas à
 vérifier ; mode dégradé sans IA en ligne. Piste d'avenir hors V1 : score d'activité pour l'accès à un financement
 (cadre juridique et partenaires requis). [O]


## 13. Espace admin, commercial et partenaire
 13.1 Validation [V]
 - File des paiements : reconnus, non reconnus, ambigus ; pour chacun, SMS, montant, ID et client concerné.
 - Boutons Valider et Rejeter, avec journal (qui, quand, pourquoi).
 - Alertes d'anomalies : même ID utilisé deux fois, montant ne correspondant à aucune formule.
 - Revue des comptes activés automatiquement.
 13.2 Gestion [V]
 - Fiche client : point de vente, formule, échéance, historique de paiements, compte mère et points rattachés,
     position GPS.
  - Actions : prolonger, offrir des mois, suspendre, réactiver.
  - Réglages : prix, durées, réductions, codes promo, offre de bienvenue, tolérance hors connexion, lots et
     probabilités de la roue de la chance.
  - Parrainage : qui a parrainé qui, mois offerts accordés ; commissions des partenaires à payer.
  - Support : demandes des clients et suivi.
  - Messages ciblés : push et modèles WhatsApp de relance.
  - Gestion des règles de lecture des SMS (parser_rules), des réseaux (dont Wave) et des versions d'APK.
  - Comptes administrateurs, commerciaux et partenaires, avec droits. [P]
 13.3 BI [V]
 - Revenus : revenu mensuel récurrent, par palier, par durée de forfait.
 - Acquisition : nouveaux inscrits, conversion de l'essai vers le payant, performance par commercial et par
     partenaire.
  - Fidélité : renouvellements, départs, cohortes par mois d'inscription.
  - Usage : services les plus utilisés, heures de pointe, villes et quartiers.
  - Qualité : SMS non reconnus par réseau, nombre de trous de solde par réseau et par modèle de téléphone
     (section 6.11.3), version d'APK, notifications reçues et lues.

 13.4 Pilotage [V]




Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés              Page 13 sur 19

---

<!-- Page 24 -->

  - Écran d'accueil à 6 chiffres : clients actifs, revenu du mois, essais en cours, échéances sous 7 jours, paiements à
     valider, départs du mois.
  - Objectifs mensuels et suivi ; alertes (essais qui se terminent, clients à relancer avec message WhatsApp
     préparé, clients inactifs) ; prévision du revenu ; résumé IA quotidien.

 13.5 Espace commercial [V]
 Liste des points de la zone avec statut, échéance, contact, quartier, position GPS, notes et historique des visites ;
 boutons Itinéraire et WhatsApp ; alertes de relance. Aucun accès aux transactions détaillées.

 13.6 Support technique [P]
 Espace web responsive et APK en mode admin ; la validation manuelle est possible dans les deux.


## 14. Sécurité et conformité
 14.1 Accès
 - Gérant et propriétaire [V] : identifiant = numéro de téléphone ; mot de passe choisi à l'inscription (6 caractères
     minimum), e-mail facultatif pour le récupérer ; à chaque ouverture, code d'accès à 4 chiffres ou empreinte, sur
     le téléphone seulement. Mot de passe oublié : par e-mail s'il existe, sinon demande de réinitialisation sur
     WhatsApp traitée par l'admin après contrôle d'identité.
  - Caissier et employé [V] : créé par le gérant ou le propriétaire, avec son propre code d'accès à 4 chiffres ;
     changement d'utilisateur sur un téléphone partagé sans déconnexion, avec le nom de l'employé sur chaque
     opération.
  - Appareils [V] : jusqu'à 2 appareils actifs par point (section 6.9) ; notification au propriétaire pour tout nouvel
     appareil ; déconnexion à distance d'un téléphone perdu ou volé.
  - Admin, commercial et partenaire [V] : e-mail et mot de passe ; double vérification de l'admin avec une
     application d'authentification gratuite.
  - Protection [V] : blocage temporaire après 5 tentatives échouées ; aucun PIN ni code d'opérateur n'est demandé
     ni stocké. Aucun envoi de code par SMS (payant) pour vérifier un numéro.

 14.2 Données
 - Règles RLS : chaque utilisateur ne voit que ses lignes ; séparation stricte par point de vente et compte mère. [V]
 - Base locale et SMS bruts chiffrés sur le téléphone ; jamais de PIN ni d'OTP. [V]
 - Position GPS du point de vente : recueillie avec consentement, visible uniquement du propriétaire, de l'admin et
     du commercial de la zone. [V]
  - Journal d'audit : corrections, annulations, validations de paiement, changements de réglages, tirages de la roue,
     paiements de commissions. [P]
  - Sauvegardes et exports protégés. [P]
 14.3 Conformité et validation juridique [V]
 Pas de blocage pour le pilote ; contrôle avant le premier client payant :
## 1. Conditions d'utilisation et politique de confidentialité en français et en anglais, rédigées puis relues une seule
     fois par un juriste (seule dépense de service prévue, avec le nom de domaine et le dépôt de la marque, section
     1.5).
## 2. Écran de consentement à la lecture des SMS au premier lancement, conservé comme preuve.
## 3. Vérification que les contrats d'agent d'Orange et de MTN n'interdisent pas la lecture des SMS ni l'usage d'une
     application tierce.
## 4. Vérification du cadre des jeux promotionnels (roue de la chance) et des commissions de partenaires.
## 5. Conformité à la réglementation camerounaise sur les données personnelles.
## 6. Mention : l'IA est une aide, pas un conseil financier.
 14.4 Anti-fraude [P]
 Faux SMS (expéditeur, cohérence du solde, ID unique), écarts de caisse, activité des employés, paiements
 d'abonnement (section 10.6), auto-parrainage et abus de la roue de la chance.

 14.5 Protection contre la copie de l'APK et le contournement de l'abonnement [P]
 Principe. Un fichier APK peut toujours être copié ; il est impossible de l'empêcher totalement. Kiosko protège donc
 surtout l'accès au serveur : un APK copié, sans abonnement actif, ne se synchronise pas et reste soumis aux limites



Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                 Page 14 sur 19

---

<!-- Page 25 -->

 de la tolérance hors connexion (section 8.1). Les mesures ci-dessous dissuadent la copie sans prétendre l'interdire
 absolument.
## 1. Signature de l'APK. L'APK est signé avec la clé privée de Kiosko (le fichier de signature, ou keystore). Ce
     fichier est sauvegardé en plusieurs endroits sûrs, jamais dans un dépôt public, et sa perte empêcherait toute
     mise à jour : c'est une règle de conservation stricte. À chaque synchronisation, l'application envoie l'empreinte
     de sa signature ; si elle est inconnue du serveur (APK modifié et recompilé), la synchronisation est refusée et
     l'admin est alertée.
## 2. Code rendu illisible (obfuscation). La version publiée est compilée avec R8/ProGuard, qui rend le code
     difficile à lire et à modifier.
## 3. Appareils. À la première connexion, l'application enregistre l'identifiant de l'appareil (table devices). Règle de
     la section 6.9 : 2 appareils actifs au maximum par point ; un troisième ferme automatiquement le plus ancien, et
     le propriétaire est notifié.
  4. L'abonnement est décidé par le serveur, jamais par le téléphone seul. L'état du point (essai, actif,
     échu) est tenu par Supabase. Pour un point dont l'abonnement est échu au-delà de la tolérance, une règle de
     sécurité (RLS) refuse toute synchronisation, en lecture comme en écriture, sauf l'écran de paiement et le bouton
     « J'ai payé ». Les données restent conservées, les SMS continuent d'être enregistrés sur le téléphone et l'export
     reste possible (section 10.11). La tolérance hors connexion (section 8.1) continue de s'appliquer sur le
     téléphone, avec l'heure du serveur mémorisée. Le compteur « opérations enregistrées pendant votre absence »
     est conservé.
  5. Identifiant de transaction unique. La table payment_matches impose un identifiant de transaction unique,
     y compris en cas de demandes simultanées : un même ID de paiement ne sert qu'une fois. Le numéro du payeur
     doit correspondre au numéro du compte ; sinon le paiement part en validation manuelle de l'admin, sans rejet
     automatique (un proche peut payer à la place du gérant).
## 6. Filigrane des exports. Le nom du point de vente et la date d'export figurent en pied de page de chaque
     export PDF et Excel. Il n'y a pas de filigrane dans l'APK lui-même, qui reste un fichier unique à empreinte
     publique (section 4.3).
## 7. Mise à jour obligatoire. La table app_versions contient une version minimale exigée. Une version plus
     ancienne est bloquée à la connexion suivante, avec renvoi vers la page de téléchargement officielle (section
     4.3). Un vieil APK copié cesse ainsi de fonctionner.
 Ces mesures s'ajoutent au contrôle des faux SMS et à la validation manuelle de la section 10.6.


## 15. Expérience utilisateur et identité visuelle
 15.1 Expérience
 - Mobile d'abord, gros boutons, écrans clés atteints en 3 touches au plus. [P]
 - Langues : français et English dès la V1 ; choix sur la première page et dans les options du compte ; notifications,
     aide, messages WhatsApp préparés et conditions suivent la langue choisie. L'espace admin peut rester en
     français. [V]
  - Textes courts, aide contextuelle, lisible en plein soleil (contrastes forts), mode sombre en option. [P]
  - Léger et rapide sur téléphones d'entrée de gamme, faible consommation de données. [P]
  - Retours clairs : indicateur de synchronisation, confirmation avant annulation ou clôture. [P]
 15.2 Identité visuelle [V]
 - Nom : Kiosko (mot seul, orthographe avec un k). Disponibilité à vérifier : nom de domaine, WhatsApp Business,
     réseaux sociaux, antériorité auprès de l'OAPI ; le nom de domaine et le dépôt de la marque sont des dépenses
     prévues (section 1.5). [O]
  - Logo : petit kiosque rayé (auvent rayé bleu et bleu clair, corps bleu nuit, guichet clair, comptoir bleu ciel), suivi
     du mot Kiosko.
  - Ambiance : sérieuse et rassurante ; couleur dominante : bleu.
  - Palette : bleu nuit #0B2A5B, bleu franc #1F5FBF, bleu moyen #4C8DE0, bleu très clair #E8F0FC, bleu ciel
     #38BDF8.
  - Couleurs fonctionnelles : vert pour un succès, rouge pour une alerte. L'orange et le jaune servent uniquement
     aux pastilles Orange Money et MoMo, pour distinguer les floats.
  - Palette claire à fort contraste par défaut ; mode sombre en option.

## 16. Exigences non fonctionnelles

Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                  Page 15 sur 19

---

<!-- Page 26 -->

  - Fiabilité : aucun SMS de transaction perdu (mesuré sur le corpus de test, sur les téléphones testés en 6.11.4,
     puis sur le terrain), calculs exacts au franc près.
  - Performance : ouverture rapide, liste de milliers de transactions fluide, application et base légères.
  - Batterie et données : consommation minimale, synchronisation par lots.
  - Disponibilité : fonctionne sans réseau, tolérance aux coupures.
  - Capacité gratuite : surveiller les limites des offres gratuites (Supabase, FCM, Drive API, API d'IA) et prévoir alerte
     et plan de migration. [P]
  - Maintenabilité : règles de SMS à jour à distance, mise à jour d'APK, code testé, journaux d'erreurs.
  - Évolutivité : réseaux et services ajoutables sans refonte (Wave, nouveaux services).
  - Documentation : guide d'installation illustré (paramètres restreints, permissions, batterie), guide utilisateur,
     guide admin, en français et en anglais.


## 17. Plan de réalisation
 17.1 Étapes de construction (un prompt autonome à la fois) [P]
## 1. Cadrage et schéma de données.
## 2. Socle : dépôt, Supabase, comptes, rôles, RLS, structure mère-fille, langues.
 3. APK : lecture des SMS et parseur, testé sur le corpus réel ; test sur 4 ou 5 téléphones courants (section 6.11.4),
     repris avant le pilote ; signature et obfuscation de l'APK (14.5).
## 4. Application du point de vente : caisse, floats, transactions, commissions, listing, messages WhatsApp.
## 5. Notifications : locales, FCM, centre de notifications.
## 6. IA locale de base (V1) : prévision du float, anomalies, coach du jour.
## 7. Abonnement : essai, blocage (y compris côté serveur), forfaits, prorata, détection et validation des paiements.
## 8. Espace admin web : validation et gestion, puis pilotage, puis BI.
  9. Compte mère, clients et crédits, rapports, sauvegarde Drive, commercial, partenaire, roue de la chance (V2,
     avec le palier Services).
## 10. IA avancée : assistant en langage naturel, prévisions admin (V3).
## 11. Recette, tests terrain, distribution.
 17.2 Versions [P]
 - V1 (version test) : application du point de vente (caisse, float, natures d'opérations, transactions,
     commissions, alertes WhatsApp, code d'accès), français et anglais, hors connexion, téléphone de dépannage,
     notifications de base, IA locale de base, abonnement avec validation admin, espace admin web de base ; palier
     Essentiel seul. [V]
  - V2 : ouverture du palier Services (1 500 F), avec compte mère, points supplémentaires, espaces propriétaire,
     commercial et partenaire, parrainage rémunéré, roue de la chance, clients et crédits, rapports exportables,
     sauvegarde Drive, services additionnels, Wave (selon corpus), notifications complètes, employés.
  - V3 : IA avancée (assistant, prévisions admin), BI complète, pilotage complet, palier Complet (paiements
     internationaux, impôts).

 17.3 Tests terrain [P]
 Pilote avec quelques points de vente réels (en zones francophone et anglophone) avant de généraliser ; test des
 prix auprès de 5 ou 6 points de vente ; relecture juridique avant le premier client payant (section 14.3).


## 18. Risques et décisions
 18.1 Risques
 - Formats des SMS d'Orange, de MTN et de Wave : peuvent changer, rarement documentés.
 - Installation hors Play Store : méfiance des utilisateurs, avertissements Android, blocage des permissions
     sensibles (paramètres restreints).
  - Faux SMS et fraude ; abus de la roue de la chance et du parrainage.
  - Dépendance au téléphone admin pour l'activation automatique ; solution de secours manuelle et téléphone de
     secours.
  - Téléphones d'entrée de gamme qui coupent les applications en arrière-plan (réponse : section 6.11).
  - Autorisation Google (OAuth) pour le Drive ; limites des offres gratuites.


Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                 Page 16 sur 19

---

<!-- Page 27 -->

    - Conditions des opérateurs envers les agents ; cadre légal des données personnelles, du mobile money et des
      jeux promotionnels.
    - WhatsApp : pas d'envoi automatique gratuit.
    - Copie de l'APK et contournement de l'abonnement : protection dissuasive, non absolue (section 14.5).
 18.2 Points ouverts de la version 1.0 : tous tranchés [V]
N°       Point                                       Décision
1        Mode d'accès aux SMS                        Simples permissions, APK direct, pas de messagerie par défaut
2        Règle du +500 F                             1er point inclus, +500 F à partir du 2e, dans les paliers Services et Complet
                                                     seulement ; Essentiel limité à 1 point
3        Différenciation des paliers                 Tableau de la section 10.2 ; V1 = Essentiel seul, Services en V2, Complet en
                                                     V3
4        Changement de formule                       Montée immédiate au prorata, descente à l'échéance
5        Blocage après échéance                      SMS enregistrés sur le téléphone, jusqu'à 60 jours
6        Données                                     Supabase principal, Drive en sauvegarde (palier Complet), export pour tous
7        Charte graphique                            Identité propre : Kiosko, kiosque rayé, bleu
8        Play Store                                  Abandonné, APK direct uniquement
9        Tableau de bord web                         Oui, pour admin, propriétaire, commercial, partenaire
10       Tolérance hors connexion                    7 jours (14 jours en Complet)
11       Langues                                     Français et English dès la V1, choix sur la première page
12       Validation juridique                        Avant le premier client payant


 18.3 Éléments proposés, à confirmer [P]
## 1. Éléments de confiance de l'APK : page de téléchargement officielle, empreinte affichée, guide d'installation
      illustré (section 4.3).
## 2. Définitions exactes du déstockage et du C2C (section 2.4).
## 3. Règle de rapprochement des paiements d'abonnement (section 10.6, points 6 et 9).
## 4. Règles de cumul des offres et plafond de mois offerts (section 10.5).
## 5. Deuxième téléphone admin, alerte de 2 h et accès provisoire de 24 h (section 10.6).
## 6. Répartition des fonctions entre V1, V2 et V3 (section 17.2).
## 7. Prix à tester auprès de 5 ou 6 points de vente ; corpus de SMS et noms d'expéditeurs à relever ; disponibilité du
      nom Kiosko.
## 8. Mesures de protection de la section 14.5 (signature, blocage côté serveur, filigrane des exports, mise à jour
      obligatoire).


 Annexe A. Modèle de données (tables principales) [P]
    - Comptes : organizations, outlets (avec position GPS et langue), users, roles, devices (jetons FCM, identifiant de
      l'appareil, empreinte de signature de l'APK), sales_reps, partners.
    - Opérations : networks, services, wallets (soldes par réseau et service), transactions (avec nature et source :
      sms_auto, sms_partage, import, manuel), sms_inbox (local), parser_rules, commission_rules, expenses,
      cash_sessions, float_orders, balance_gaps (trous de solde), device_compat (compatibilité par modèle de
      téléphone).
    - Relations : contacts, message_templates, customers, credits.
    - Notifications : notifications, notification_preferences.
    - Abonnement : plans, subscriptions, payments, payment_matches (identifiant de transaction unique),
      promo_codes, referrals, partner_commissions.
    - Promotion : wheel_prizes (lots, probabilités, stocks), wheel_spins.
    - Pilotage : support_tickets, audit_log, ai_insights, backups, app_versions (version minimale exigée), visits
      (visites commerciales).
    - Locale au téléphone : sync_queue.

 Annexe B. Modèles de messages WhatsApp [V]
 Disponibles en français et en English.



Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés                           Page 17 sur 19

---

<!-- Page 28 -->

  - Demande de float : « Bonjour [livreur], solde OM : [solde] F. J'ai besoin de [montant] F de float. Merci de passer.
     »
  - Réinitialisation ou déblocage : « Bonjour, mon compte agent est bloqué, merci de le réinitialiser. Mon numéro :
     [numéro]. » (sans jamais écrire de code)
  - Transaction en échec : « Problème sur la transaction [ID] de [montant] F du [date]. Merci de vérifier. »
  - Commission : « Je souhaite vérifier ma commission du [période]. »
  - Relance crédit client : « Bonjour [client], rappel : [montant] F restent à régler. Merci. » [P]
  - Relance d'abonnement (admin vers client) : « Bonjour, votre abonnement Kiosko arrive à échéance le [date]. »
     [P]


 Annexe C. Critères de recette (extraits) [P]
  - Un SMS de dépôt reçu hors connexion met à jour le solde, la commission et le listing, et crée la notification.
  - Un même SMS reçu deux fois ne crée qu'une transaction.
  - Un SMS contenant un OTP ou un PIN n'est ni stocké ni synchronisé.
  - Le franchissement du seuil de float déclenche une seule notification et un message WhatsApp prérempli.
  - Après 14 jours, le dashboard est bloqué ; un paiement reconnu le réactive ; un paiement non reconnu arrive
     dans la file de validation.
  - Le même ID de transaction ne peut pas servir deux fois.
  - Hors connexion au-delà de la tolérance : accès restreint ; au retour du réseau, synchronisation sans doublon.
  - Pendant le blocage, les SMS sont enregistrés sur le téléphone et récupérés au paiement.
  - Un point de vente ne voit jamais les données d'un autre point ; le compte mère voit tous les siens.
  - Une puce déplacée dans un autre téléphone : le téléphone de dépannage importe les SMS manquants sans
     doublon.
  - Une montée de palier en cours de période calcule le complément au prorata (minimum 100 F).
  - Un client Essentiel ne peut pas ajouter de point supplémentaire ; un client Services ou Complet le peut, à 500 F
     par mois.
  - La commission de partenaire n'est créditée qu'une fois, au premier paiement validé du point.
  - Un tirage de la roue respecte les probabilités et les stocks paramétrés, et chaque tirage est journalisé.
  - La langue choisie sur la première page s'applique à tout l'écran et se change dans les options du compte.
  - La sauvegarde Drive quotidienne (palier Complet) se restaure sur un nouveau téléphone.
  - Les fonctions IA locales fonctionnent sans réseau.
  - Un APK modifié et signé avec une autre clé ne peut pas se synchroniser, et l'admin est alertée.
  - Un troisième appareil ferme le plus ancien et notifie le propriétaire.
  - Un point dont l'abonnement est échu ne peut ni lire ni écrire sur le serveur, hors écran de paiement ; ses
     données et son export restent disponibles.
  - Deux demandes simultanées avec le même ID de transaction ne créent qu'un seul paiement.
  - Un paiement dont le numéro du payeur diffère du numéro du compte arrive en validation manuelle.
  - Chaque export PDF et Excel porte le nom du point de vente et la date.
  - Une version de l'APK inférieure à la version minimale est bloquée jusqu'à la mise à jour.
 Solutions de secours pour la lecture des SMS (section 6.11)
 - Un SMS partagé vers Kiosko crée une opération marquée « partagé », sans permission SMS.
 - Un SMS partagé deux fois ne crée qu'une opération.
 - Un message partagé contenant un OTP ou un PIN n'est pas enregistré.
 - Un SMS partagé n'active jamais un abonnement.
 - Un SMS partagé qui échoue au contrôle de cohérence des soldes déclenche la notification « SMS partagé à
     vérifier ».
  - Une saisie manuelle fusionne avec le SMS réel arrivé ensuite, sans doublon.
  - Un SMS manquant déclenche une alerte de trou avec le montant net estimé ; l'alerte disparaît après import,
     partage ou saisie du message manquant.
  - Les SMS arrivés dans le désordre ne déclenchent pas de fausse alerte.
  - Sur chaque téléphone testé, 0 SMS perdu sur 200 messages de test.



Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés               Page 18 sur 19

---

<!-- Page 29 -->

 Annexe D. Glossaire
  - Float : solde électronique du point de vente pour un réseau.
  - OM, MoMo : Orange Money, MTN Mobile Money.
  - C2C : échange de float de call box à call box.
  - Compte mère : compte du propriétaire qui regroupe plusieurs points de vente.
  - Partenaire : parrain externe rémunéré par commission.
  - APK : fichier d'installation d'une application Android.
  - FCM : service gratuit de notifications push de Google.
  - RLS : règles de sécurité par ligne dans la base de données.
  - Parseur : programme qui extrait montant, nature et solde d'un SMS.
  - PWA : application web installable, légère.
  - Signature de l'APK : sceau numérique de Kiosko qui prouve que l'application n'a pas été modifiée.
  - Obfuscation (R8) : transformation du code pour le rendre difficile à lire.
  - wa.me : lien qui ouvre WhatsApp avec un message prérempli.
  - PIN : code secret de l'opérateur, jamais demandé ni stocké par Kiosko.
  - Code d'accès : code à 4 chiffres (ou empreinte) qui déverrouille l'application Kiosko sur le téléphone.




Cahier des charges — Kiosko v1.2 · addendum 1, relecture de cohérence et protections intégrés             Page 19 sur 19
