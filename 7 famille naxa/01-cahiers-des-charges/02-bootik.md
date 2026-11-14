# Cahier des charges — Bootik

> Conversion fidèle du cahier des charges PDF source.
> Source : `Cahier_des_charges_02_Bootik.pdf` · 9 pages.
> Le texte a été extrait du PDF et structuré en Markdown ; les formulations métier ne sont pas réécrites.

<!-- Page 1 -->

 Cahier des charges — Bootik
 Application n° 2 sur 7 de la famille d'applications · Version 1.0 · 31 octobre 2026 · Rang de
 construction : 2
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
 Bootik est l'outil de gestion de la boutique à stock : caisse, ventes, ardoise, stock, fournisseurs, clients,
 équipe, comptabilité et pilotage, avec confirmation automatique des paiements mobile money, briefing
 WhatsApp et IA locale, y compris sans connexion. [V]

 1.1 Profils métier
 Profil                              Spécificités

 Boutique générale, supérette        Scan code-barres, prix détail et gros, lots et péremption, ardoise, fournisseurs

 Quincaillerie                       Milliers d'articles, unités et conversions (mètre, sac, kilo), prix gros, devis et factures

 Commerçant articles et              Variantes taille et couleur, retours et avoirs, catalogue WhatsApp, soldes
 vêtements

 Parfumerie                          Variantes, lots, produits de valeur, coût moyen, fidélité forte

 Poissonnerie                        Stock frais à écoulement rapide, prix du jour, poids, glace et pertes, péremption en
                                     heures

 Dépôt de gaz                        Échange bouteille vide contre pleine par marque et par taille, consigne ou caution
                                     par client, stock de pleines et de vides, vides à retourner au fournisseur, livraison à
                                     domicile, relance des consignes non rendues

 Petite pharmacie informelle         Produits non réglementés seulement (section 9) ; pour une vraie officine, voir le
                                     système NAXA pharmacie


 1.2 Objectifs
## 1. Vue exacte de la caisse, du stock, des dettes et du vrai bénéfice.
## 2. Remplacer le cahier papier et le tableur.
## 3. Prévenir ruptures, pertes, impayés et fraudes.
## 4. Confirmer les paiements mobile money par SMS.
## 5. Piloter plusieurs boutiques depuis un compte mère.
## 6. Tout faire hors connexion, en français et en anglais.

## 2. La famille d'applications : sept applications, une
 architecture

Cahier des charges — Bootik · v1.0 · 31 octobre 2026                                                                      Page 1

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
       Tontine, 7 Hôtel. Cette application porte le rang n° 2. [P]


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



Cahier des charges — Bootik · v1.0 · 31 octobre 2026                                                                       Page 2

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


Cahier des charges — Bootik · v1.0 · 31 octobre 2026                                                       Page 3

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
 B1. Ventes et caisse [V]
 - Vente en espèces, mobile money, ardoise ou paiement mixte ; mobile money confirmé
     automatiquement (le SMS reçu est rapproché de la vente en attente, qui passe à « payée »).
  - Prix détail et gros ; remises avec validation du patron au-delà d'un seuil ; remise automatique par
     client fidèle (« Paullette est une bonne cliente, −5 % »).
  - Ardoise avec plafond, acompte, retours et avoirs, devis et factures, reçu par WhatsApp, impression
     Bluetooth, scan code-barres.
  - Ouverture et clôture de caisse avec écart signalé ; deux caisses : espèces et mobile money
     marchand. [P]

 B2. Stock [V]
 - Stock en temps réel ; alerte et prévision de rupture ; réassort suggéré ; inventaire par scan ; pertes
     et casse ; transferts entre points.
  - Lots et péremption (« ton lait périt dans 10 jours, fais une promo ») ; variantes ; unités et
     conversions ; coût moyen pondéré ; valeur du stock ; rappel de lot (inspiré de NAXA). [P]

 B3. Clients, ardoise et fidélité [V]
 - Fiche et historique client, meilleurs clients ; relance d'ardoise par WhatsApp (« Maman Paullette, tu
     dois 15 000 F depuis 10 jours »).
  - Points de fidélité (1 000 F d'achat = 10 points), parrainage client, carte client avec code QR,
     anniversaires et offres, roue de la chance clients (tirage réel, lots et stocks plafonnés, journal).
  - Écran unique « Dettes et crédits ».

 B4. Fournisseurs et achats [V]
 - Fiche fournisseur, dette fournisseur (« tu dois 200 000 F à Fokou »), échéances et paiements
     partiels, comparaison des prix.
  - Commande par WhatsApp déclenchée sous le seuil de stock, confirmée en un clic ; facture
     fournisseur lue par photo (OCR local) pour pré-remplir l'achat.



Cahier des charges — Bootik · v1.0 · 31 octobre 2026                                                        Page 4

---

<!-- Page 5 -->

 B5. Équipe [V]
 - Droits par rôle, écart de caisse par employé, alertes de fraude, commissions vendeurs, salaire,
     avance et prime, pointage et présences, défis et classement des vendeurs.

 B6. Comptabilité et pilotage [V]
 - Journal, compte de résultat simple, bénéfice réel du jour (« tu as vendu 500 000 F, tu as gagné 75
     000 F »), trésorerie et prévisions, rapprochement mobile money, plan SYSCOHADA, TVA datée et
     paramétrable, accès comptable par lien temporaire.
  - Tableau de bord du jour, marge par produit, top et flop produits, comparatif mensuel, heures de
     pointe, objectifs et suivi.

 B7. Multi-boutiques et catalogue [V]
 - Compte mère : vue consolidée, stock par boutique et total, transferts confirmés par le receveur («
     envoie 10 sacs de Mokolo à Biyem »), comparatif entre points, règles communes.
  - Mini-catalogue partageable sur WhatsApp : page web statique générée à partir des produits choisis.

 B8. Profil Dépôt de gaz [V]
 - Stock en bouteilles par marque et par taille (par exemple 6 kg, 12,5 kg, 35 kg) avec deux
     colonnes : pleines et vides ; achat de bouteilles neuves, recharge, bouteilles défectueuses ou
     fuyantes mises de côté.
  - Échange : le client rend une vide et reçoit une pleine ; une touche met à jour le stock (vide +1,
     pleine −1) et la caisse ; si le client n'a pas de vide, vente avec consigne (prix du gaz + consigne
     de la bouteille) encaissée en espèces ou par mobile money confirmé.
  - Consignes et cautions par client : bouteilles prêtées, consignes versées, rendues ou perdues ;
     solde de consigne par client ; relance WhatsApp des bouteilles non rendues.
  - Livraison à domicile : commande, livreur, frais de livraison, statut (en route, livré), encaissement à
     la livraison, tournée du jour, bouteilles vides ramenées.
  - Retours au fournisseur : liste des vides à rendre par marque, bordereau, échanges avec le
     grossiste ; dette ou avoir fournisseur en bouteilles et en argent ; commande de pleines par
     WhatsApp sous le seuil.
  - Inventaire : comptage pleines et vides par marque ; écart entre stock théorique et comptage
     signalé ; marge par taille et par marque ; clients réguliers (restaurants, maquis, ménages) avec
     livraison récurrente. [P]


## 5. Intelligence artificielle
  - Prévision de la demande (saisons, fêtes, rentrée), pilotage des stocks (surstock, produits dormants,
     rotation), conseil de prix et de marge, détection de fraude employé et de vol de stock (stock
     théorique contre réel), score de santé du commerce, assistant « posez une question » sur mes
     chiffres, facture lue par photo. Pour le dépôt de gaz : prévision de la demande de bouteilles (saison
     des pluies, fêtes, fins de mois), alerte de rupture de pleines par taille, repérage des écarts entre
     bouteilles attendues et comptées, relance des clients dont la consigne traîne. [V]


## 6. Briefings
  - Matin (7 h) : « Hier : ventes 850 000 F, bénéfice 120 000 F, 3 produits en rupture, Paullette doit 15
     000 F, loyer à payer dans 2 jours ». Soir : ventes du jour, caisse attendue contre réelle, écarts,
     tâches du lendemain. [V]


## 7. Paliers et prix
 Prix mensuels en francs CFA. Forfaits : 3 mois −10 % arrondi à la centaine inférieure ; 6 mois = 5 payés
 ; 12 mois = 10 payés ; aucun remboursement. Points supplémentaires : +500 F par mois au palier Pro.
 [P] Prix à tester auprès de 5 ou 6 commerçants avant de les figer.

                                               Essentiel         Pro                   Réseau

 Prix par mois                                 1 000             3 000                 6 000



Cahier des charges — Bootik · v1.0 · 31 octobre 2026                                                      Page 5

---

<!-- Page 6 -->

                                                Essentiel               Pro                         Réseau

 Points de vente                                1                       1 + 500 F par point         Multi-points, compte
                                                                                                    mère

 Utilisateurs par point                         1                       jusqu'à 5                   illimité

 Caisse, ventes, ardoise, stock simple,         oui                     oui                         oui
 briefing du soir

 Profil Dépôt de gaz : échanges, consignes,     oui                     oui                         oui
 stock de pleines et de vides

 Dépôt de gaz avancé : livraisons et            non                     oui                         oui
 tournées, retours fournisseur, relances de
 consignes

 Stock avancé (lots, variantes, scan),          non                     oui                         oui
 fournisseurs, OCR facture

 Compta SYSCOHADA, TVA, exports mis en          non                     oui                         oui
 forme

 Fidélité, QR, roue, anniversaires, catalogue   non                     oui                         oui
 WhatsApp

 Équipe : pointage, commissions, défis          non                     oui                         oui

 IA avancée (prix, fraude, score, assistant)    non                     partielle                   complète

 Compte mère, transferts, validation patron     non                     non                         oui
 à distance, Drive

 Tolérance hors connexion                       7 jours                 7 jours                     14 jours

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
  - Relecture juridique unique avant le premier client payant : conditions d'utilisation et confidentialité
     en français et en anglais, consentement à la lecture des SMS conservé comme preuve, conformité à
     la réglementation camerounaise sur les données personnelles, mention que l'IA est une aide et non
     un conseil financier, comptable ou fiscal.



Cahier des charges — Bootik · v1.0 · 31 octobre 2026                                                                  Page 6

---

<!-- Page 7 -->

  - Petite pharmacie informelle : la vente de médicaments est réservée aux officines. Le profil est
     limité aux produits non réglementés (hygiène, parapharmacie, compléments) et affiche un
     avertissement ; aucune fonction d'ordonnance ni de médicament soumis à prescription. Une officine
     utilise le système NAXA pharmacie. À faire valider par un juriste.
  - Dépôt de gaz : la revente de gaz domestique, le stockage de bouteilles (distance de sécurité,
     extincteur, ventilation), le prix de vente et la consigne peuvent être encadrés ; autorisations et
     règles de sécurité à vérifier auprès des autorités et du fournisseur avant l'ouverture du profil.
     L'application suit le stock et les consignes mais ne remplace aucune obligation de sécurité. [O]
  - Comptabilité : SYSCOHADA et TVA, taux et seuils à vérifier auprès de l'administration fiscale à la
     construction.
  - Roue de la chance clients : cadre des jeux promotionnels à vérifier ; consentement pour les
     données de clients finaux.


## 10. Plan de réalisation
 Un prompt autonome à la fois. Le socle commun (jalon 0) est construit une seule fois pour la première
 application, puis réutilisé. Pilote avec quelques commerçants réels avant de généraliser. [P]

 Jalon                   Contenu

 J0. Socle commun        Réutilisé depuis Kiosko (comptes, synchronisation, notifications, abonnement, signature)

 J1. Cœur boutique       Produits, caisse, ventes, ardoise, stock simple, scan, mobile money confirmé, briefing du soir ;
                         profil Dépôt de gaz de base (échanges, consignes, stock de pleines et de vides)

 J2. Gestion             Fournisseurs, OCR facture, équipe, compta et TVA datée, clients et fidélité, Dépôt de gaz avancé
                         (livraisons, retours fournisseur, relances de consignes)

 J3. Réseau et IA        Multi-boutiques, compte mère, catalogue WhatsApp, IA avancée, assistant vocal, accès
                         comptable par lien, Drive, recette et distribution



## 11. Risques
  - Limites des offres gratuites avec un backend partagé par sept applications.
  - Installation hors Play Store : méfiance des utilisateurs, avertissements Android, paramètres
     restreints.
  - Charge de travail : sept projets en parallèle ; le rang de construction et les jalons servent à la
     maîtriser.
  - Charge de l'administration : tous les accès sont créés à la main ; prévoir des outils de création
     rapide.
  - Faux SMS et fraude ; copie de l'APK (protection dissuasive, non absolue).
  - Catalogues très volumineux (quincaillerie) sur téléphones d'entrée de gamme : pagination et
     recherche locale à tester.
  - Dépôt de gaz : règles de sécurité et d'autorisation de revente, prix réglementés éventuels.
  - Qualité de la lecture de texte sur photo.
  - Cadre juridique de la pharmacie informelle.

## 12. Points ouverts
## 1. Catalogues types par profil à préparer (liste de produits courants).
## 2. Règles de TVA par catégorie à confirmer.
## 3. Marques et tailles de bouteilles de gaz courantes à préparer pour le catalogue type ; règle de
     consigne par marque (montant, bouteille d'une autre marque acceptée ou non).
## 4. Noms retenus le 31 octobre 2026 : Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA
     Hotel. À vérifier pour chacun : nom de domaine, WhatsApp Business, réseaux sociaux, antériorité
     auprès de l'OAPI ; [O]
## 5. Un abonnement par application : remise de lot pour un client qui en prend plusieurs (proposition :
     −20 % sur la deuxième application et les suivantes) [O].
## 6. Un keystore par application ou commun (section 3, S10).


Cahier des charges — Bootik · v1.0 · 31 octobre 2026                                                                 Page 7

---

<!-- Page 8 -->

## 7. Plan de migration quand l'offre gratuite de Supabase devient insuffisante.

## 13. Modèle de données propre à l'application
  - products, product_variants, units, stock_lots, stock_movements, inventories, price_lists, sales,
      sale_items, payments, tabs (ardoises), returns, quotes, invoices, customers, loyalty_points,
      suppliers, purchases, supplier_debts, staff, attendance, commissions, journal_entries, tax_rates
      (datées), catalog_pages, gas_brands, gas_sizes, gas_cylinder_stock (pleines, vides, défectueuses),
      gas_exchanges, gas_deposits (consignes par client), gas_deliveries, gas_supplier_returns.


## 14. Critères de recette (extraits)
  - Le scan d'un code-barres retire l'article du stock, y compris hors connexion.
  - Un paiement mobile money reçu par SMS marque la vente en attente comme payée, sans doublon.
  - Une vente à l'ardoise au-delà du plafond demande la validation du patron.
  - Une alerte de rupture se déclenche une seule fois par seuil.
  - La facture lue par photo propose les lignes, corrigées par le gérant avant enregistrement.
  - Un transfert de stock entre deux points est confirmé par le receveur et tracé des deux côtés.
  - Le profil pharmacie informelle ne propose aucune fonction d'ordonnance.
  - Un échange de bouteille diminue le stock de pleines et augmente celui de vides de la même marque
      et de la même taille.
  - Une vente avec consigne enregistre la consigne au nom du client ; le retour de la bouteille la solde.
  - Une livraison de gaz suit les statuts en route et livré et encaisse à la livraison.
  - Le comptage des bouteilles signale tout écart entre pleines et vides attendues et comptées.
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
 - Logo : carnet bleu nuit avec lignes orange et coche orange, mot « BootiK » avec K orange.
 - Le logo en tête de ce cahier est le fichier fourni. Usage : sur fond clair (ou sur le fond d'origine pour
      NAXA Services), sans le déformer ni le recolorer ; zone de protection égale à la hauteur d'une lettre ;
      taille minimale à l'écran de 24 pixels de haut. [P]
  - À prévoir à partir du fichier fourni : icône d'application adaptative, écran de démarrage, logo
      monochrome pour l'icône des notifications, logo pour les reçus et documents. Fournir idéalement les
      logos au format vectoriel (SVG) ou en grande taille avec fond transparent. [P]




Cahier des charges — Bootik · v1.0 · 31 octobre 2026                                                      Page 8

---

<!-- Page 9 -->

 15.2 Palette
                                                                                                            Contraste sur
        Couleur                       Code             Usage
                                                                                                            blanc

        Bleu nuit — principale        #052163          Barre supérieure, boutons principaux, titres         15.0 : 1

                                                       Coche, lignes, bouton d'action secondaire, K du
        Orange — accent de
                                      #FC7820          logotype ; en fond seulement, texte bleu nuit        2.7 : 1
        marque
                                                       dessus

        Orange foncé — accent
                                      #C25A0C          Liens, icônes et petits textes sur fond clair        4.4 : 1
        texte

        Fond clair                    #FFF1E5          Cartes, lignes alternées                             1.1 : 1

        Texte                         #16203A          Texte courant                                        16.1 : 1

        Mode sombre — fond            #0A1432          Fond du mode sombre ; surfaces #14224F               18.1 : 1

                                                       Opération réussie, paiement confirmé (toujours
        Succès                        #197A33                                                               5.4 : 1
                                                       avec l'icône ✓ et le mot « payé »)

                                                       Erreur, écart, impayé, rupture (toujours avec
        Alerte                        #C62828                                                               5.6 : 1
                                                       l'icône ! et un libellé)

                                                       À vérifier, échéance proche (toujours avec l'icône
        Avertissement                 #8F5400                                                               6.1 : 1
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
  - Police : Poppins (semi-gras pour les titres, normal pour le texte), police libre à embarquer dans
     l'application pour fonctionner hors connexion. [P]
  - États : succès, alerte et avertissement gardent leurs couleurs de sens, toujours doublées d'une
     icône et d'un libellé, quelle que soit la couleur de marque.
  - Mode clair par défaut, mode sombre en option (sauf NAXA Services) ; contrastes forts pour la
     lecture en plein soleil sur téléphone d'entrée de gamme.
  - Documents émis (reçus, factures, quittances, briefings WhatsApp) : en-tête avec le nom du
     commerce du client et la mention discrète « établi avec Bootik », aux couleurs de l'application. Le
     client peut ajouter son propre logo à partir du palier Pro. [P]
  - Cohérence de la famille : la page de téléchargement officielle présente les sept applications avec
     leur logo et leur couleur ; un client qui en utilise plusieurs retrouve les mêmes repères.
 Point d'attention. L'orange de marque est proche de l'alerte : l'alerte utilise le rouge de la ligne «
 Alerte » avec l'icône !, jamais l'orange.


## 16. Glossaire
  - APK : fichier d'installation d'une application Android. FCM : notifications push gratuites de Google.
     RLS : règles de sécurité par ligne dans la base.
  - Famille d'applications : l'ensemble des sept applications partageant la même architecture. Socle
     commun : la partie partagée (section 3). Jalon : étape de construction testable.
  - Compte mère : compte du propriétaire qui regroupe plusieurs points. Parseur : programme qui
     extrait montant, nature et solde d'un SMS. PIN : code secret de l'opérateur. Code d'accès : code
     qui déverrouille l'application.




Cahier des charges — Bootik · v1.0 · 31 octobre 2026                                                                   Page 9
