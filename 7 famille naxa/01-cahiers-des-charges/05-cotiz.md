# Cahier des charges — CotiZ

> Conversion fidèle du cahier des charges PDF source.
> Source : `Cahier_des_charges_05_CotiZ.pdf` · 9 pages.
> Le texte a été extrait du PDF et structuré en Markdown ; les formulations métier ne sont pas réécrites.

<!-- Page 1 -->

 Cahier des charges — CotiZ
 Application n° 5 sur 7 de la famille d'applications · Version 1.0 · 31 octobre 2026 · Rang de
 construction : 6
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
 CotiZ est l'outil de gestion complète des tontines et des groupes d'épargne : cotisations, tours,
 pénalités, présences, épargne avec objectifs, prêts internes avec intérêt, cautions et garanties, rappels
 WhatsApp et paiement par mobile money, selon le modèle des groupes de commerçantes de type
 Bayam Sallam. [V]

 1.1 Principe fondamental
 L'application tient le registre ; elle ne détient ni ne transfère jamais l'argent des membres.
 Les paiements se font entre membres et trésorière, par espèces ou mobile money ; l'application les
 constate et les contrôle. [V]

 1.2 Objectifs
## 1. Supprimer le cahier de la trésorière et les litiges sur « qui a payé ».
## 2. Appliquer les règles du groupe (tours, pénalités) sans contestation.
## 3. Relancer les membres par WhatsApp sans effort.
## 4. Donner à chaque membre une vue claire de ses cotisations, de ses tours et de son épargne.
## 5. Fonctionner hors connexion, y compris pendant les réunions.

## 2. La famille d'applications : sept applications, une
 architecture
 Sept applications distinctes, sept projets de développement, une seule architecture et un seul compte
 client. [V]

 N°     Application         Public                            Modules propres                         Lecture des
                                                                                                      SMS

 1      Kiosko              Agents Orange Money, MTN          M1 : floats, commissions, natures       Obligatoire
                            MoMo, Wave                        d'opérations, abonnements de toute la
                                                              famille

 2      Bootik              Boutique, supérette,              Ventes, stock, ardoise, fournisseurs,   Facultative
                            quincaillerie, articles et        fidélité, compta, multi-boutiques,
                            vêtements, parfumerie,            catalogue
                            poissonnerie, dépôt de gaz,
                            pharmacie informelle restreinte



Cahier des charges — CotiZ · v1.0 · 31 octobre 2026                                                                 Page 1

---

<!-- Page 2 -->

 N°     Application          Public                              Modules propres                             Lecture des
                                                                                                             SMS

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
       Tontine, 7 Hôtel. Cette application porte le rang n° 6. [P]


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



Cahier des charges — CotiZ · v1.0 · 31 octobre 2026                                                                        Page 2

---

<!-- Page 3 -->

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
  - Blocage après échéance : données jamais supprimées, export possible, synchronisation serveur
     refusée sauf écran de paiement ; mêmes règles de prorata, d'offres, de parrainage, de partenaires
     et de roue promotionnelle que la v1.2. [P]

 S10. Sécurité des APK et distribution


Cahier des charges — CotiZ · v1.0 · 31 octobre 2026                                                        Page 3

---

<!-- Page 4 -->

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
 T1. Groupes et membres [V]
 - Groupe avec nom, règlement, périodicité, montant de cotisation, devise et date de départ ;
     membres avec fiche et téléphone ; rôles (présidente, trésorière, secrétaire, membre) ; plusieurs
     tontines par personne ; un même membre peut avoir plusieurs « mains » (parts).

 T2. Cotisations [V]
 - Montant fixe ou variable ; périodicité (hebdomadaire, mensuelle, libre) ; tableau « qui a payé, qui
     doit » par séance ; paiement partiel et rattrapage ; reçu par WhatsApp à chaque cotisation
     enregistrée.

 T3. Tours [V]
 - Ordre fixe ou tirage au sort des tours, au choix du groupe ; bénéficiaire du tour ; historique des
     tours et des sommes remises.
  - Tirage au sort honnête et vérifiable : résultat horodaté et journalisé, visible de tous les membres. [P]
  - Échange de tours entre membres avec accord de la présidente et journal.

 T4. Pénalités [V]
 - Retard, absence, défaut de cotisation ; barème réglable par le groupe ; application automatique,
     modifiable avec raison ; cumul visible par membre ; paiement de la pénalité suivi.

 T5. Séances, présences et absences [V]
 - Fiche de séance : date, lieu, hôte, ordre du jour ; appel des présents et des absents avec motif ;
     procès-verbal court ; statistiques d'assiduité par membre.

 T6. Paiement par mobile money [V]
 - Le membre paie sur le numéro de la trésorière ; le SMS reçu par le téléphone de la trésorière est lu
     (permission SMS facultative) et la cotisation est cochée « payée » après vérification du montant et
     du numéro ; sinon partage du SMS ou saisie manuelle guidée. Un SMS partagé passe par le contrôle
     de cohérence et reste « à vérifier » en cas de doute.

 T7. Épargne avec objectifs [V]
 - Cagnotte par membre ou par groupe ; objectif, montant et date ; progression ; versements réguliers
     ; retrait selon le règlement du groupe.

 T8. Prêts internes avec intérêt [V]
 - Demande de prêt d'un membre, décision prise par le groupe (vote ou décision de la présidente
     selon le règlement) ; taux, durée et échéancier ; remboursements et retards suivis ; intérêt versé
     selon la règle du groupe (cagnotte ou répartition).




Cahier des charges — CotiZ · v1.0 · 31 octobre 2026                                                     Page 4

---

<!-- Page 5 -->

  - L'application calcule et suit, mais ne verse jamais de fonds. Voir la vigilance juridique de la section 9.
     [V]

 T9. Cautions et garanties entre membres [V]
 - Un membre se porte garant d'un autre pour un tour anticipé ou un prêt interne ; engagement
     enregistré avec accord des deux ; suivi et alerte si le garanti est en retard ; mise en jeu de la
     garantie selon le règlement.

 T10. Caisse de solidarité et clôture de cycle [V]
 - Caisse de solidarité (maladie, deuil, événement) alimentée selon le règlement, si le groupe le
     décide. [P]
  - Clôture de cycle : bilan par membre et par groupe, redistribution, historique, archivage et reprise
     d'un nouveau cycle.

 T11. Rappels WhatsApp [V]
 - Rappel avant l'échéance, après le retard, avant la séance, avant le tour d'un membre ; message
     adapté au ton du groupe ; envoi en un clic par la trésorière ; modèles modifiables en français et en
     English.


## 5. Intelligence artificielle
  - Prévision des retards de cotisation, repérage des membres à risque, suggestion de rappels,
     détection d'incohérences (doublons, montants anormaux), résumé de séance, score de santé du
     groupe, assistant « posez une question » (« combien me doit Marie ? »). L'IA propose, le groupe
     décide. [V]


## 6. Briefings
  - Matin : séances du jour, cotisations attendues, tours à verser, retards. Soir : cotisations encaissées,
     absents, pénalités, prêts à rembourser. Briefing envoyé à la trésorière et à la présidente. [V]


## 7. Paliers et prix
 Grille proposée, à tester : une tontine est un petit budget, donc les prix sont plus bas que pour un
 commerce. Forfaits de 3, 6 et 12 mois comme pour les autres applications. [P]

                                                Essentiel        Pro                    Réseau

 Prix par mois (proposition)                    500              1 500                  3 000

 Groupes                                        1                jusqu'à 5              illimité

 Membres par groupe                             jusqu'à 20       jusqu'à 50             illimité

 Cotisations, tours, pénalités, présences       oui              oui                    oui

 Rappels WhatsApp, paiement mobile money        oui              oui                    oui
 confirmé

 Épargne avec objectifs, caisse de solidarité   non              oui                    oui

 Prêts internes avec intérêt, cautions et       non              oui                    oui
 garanties

 Exports mis en forme, IA avancée, assistant    non              partielle              complète

 Compte mère (fédération de groupes),           non              non                    oui
 Drive

  - Qui paie : la trésorière (ou la présidente), au nom du groupe. [O]
  - Remise de lot avec les autres applications : à décider. [O]

## 8. Solutions gratuites et limites [P]




Cahier des charges — CotiZ · v1.0 · 31 octobre 2026                                                      Page 5

---

<!-- Page 6 -->

 Besoin                          Solution gratuite                               Limite à surveiller

 Base, authentification,         Un Supabase partagé par les sept                Deux projets actifs par organisation ; 500 Mo
 temps réel                      applications                                    de base partagés ; pause d'un projet gratuit
                                                                                 après une semaine d'inactivité

 Notifications push              Firebase Cloud Messaging                        Aucune notable

 Code-barres, texte sur          Bibliothèques du téléphone (ML Kit ou           Qualité sur téléphones d'entrée de gamme
 photo                           équivalent)

 Voix                            Service vocal d'Android                         Hors connexion variable

 Impression                      Bluetooth, imprimante thermique du client       Matériel du client

 Catalogue partageable           Page web statique (GitHub Pages)                Pas de paiement en ligne

 Sauvegarde                      Google Drive API                                Compte Google du client

 Code et APK                     GitHub, Actions, Releases                       Quotas de construction multipliés par sept

 IA en ligne                     API gratuite d'un fournisseur                   Quotas à vérifier

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
  - Registre, pas de fonds : l'application ne détient, ne collecte ni ne transfère l'argent des membres.
     [V]
  - Prêts avec intérêt et collecte d'épargne : peuvent relever de la réglementation de la
     microfinance et de l'usure ; à faire examiner par un juriste avant d'ouvrir les modules T7 et T8.
  - Données des membres : consentement de chaque membre, visibilité limitée aux membres du
     groupe, aucune donnée revendue.


## 10. Plan de réalisation
 Un prompt autonome à la fois. Le socle commun (jalon 0) est construit une seule fois pour la première
 application, puis réutilisé. Pilote avec quelques commerçants réels avant de généraliser. [P]

 Jalon                     Contenu

 J0. Socle commun          Réutilisé depuis Kiosko

 J1. Cœur tontine          Groupes, membres, cotisations, tours (ordre fixe et tirage au sort), pénalités, présences, rappels
                           WhatsApp

 J2. Paiements et          Paiement mobile money confirmé, épargne avec objectifs, caisse de solidarité, clôture de cycle
 épargne

 J3. Prêts et garanties    Prêts internes avec intérêt, cautions et garanties, IA, assistant vocal, recette et distribution
                           (après avis juridique)



## 11. Risques
  - Limites des offres gratuites avec un backend partagé par sept applications.
  - Installation hors Play Store : méfiance des utilisateurs, avertissements Android, paramètres
     restreints.
  - Charge de travail : sept projets en parallèle ; le rang de construction et les jalons servent à la
     maîtriser.




Cahier des charges — CotiZ · v1.0 · 31 octobre 2026                                                                       Page 6

---

<!-- Page 7 -->

  - Charge de l'administration : tous les accès sont créés à la main ; prévoir des outils de création
      rapide.
  - Faux SMS et fraude ; copie de l'APK (protection dissuasive, non absolue).
  - Litiges entre membres : le journal d'audit et le règlement visible sont les seules preuves de
      l'application.
  - Cadre juridique des prêts et de l'épargne.
  - Adoption : groupes peu à l'aise avec le numérique, formation de la trésorière indispensable.

## 12. Points ouverts
  1. Règles exactes de votre modèle de tontine de référence (taille des groupes, périodicité type,
      barème de pénalités, usage de l'intérêt).
## 2. Qui valide un prêt : vote ou décision de la présidente.
## 3. Noms retenus le 31 octobre 2026 : Kiosko, Bootik, Zipple, NAXA Services, CotiZ, Loyable, NAXA
      Hotel. À vérifier pour chacun : nom de domaine, WhatsApp Business, réseaux sociaux, antériorité
      auprès de l'OAPI ; [O]
## 4. Un abonnement par application : remise de lot pour un client qui en prend plusieurs (proposition :
      −20 % sur la deuxième application et les suivantes) [O].
## 5. Un keystore par application ou commun (section 3, S10).
## 6. Plan de migration quand l'offre gratuite de Supabase devient insuffisante.

## 13. Modèle de données propre à l'application
  - tontine_groups, tontine_members, tontine_cycles, tontine_contributions, tontine_turns,
      tontine_draws (tirages journalisés), tontine_penalties, tontine_meetings, tontine_attendance,
      tontine_savings, tontine_loans, tontine_loan_payments, tontine_guarantees, tontine_solidarity.


## 14. Critères de recette (extraits)
  - L'ordre des tours est fixe ou tiré au sort selon le choix du groupe ; le tirage est journalisé.
  - Une cotisation payée par mobile money est cochée automatiquement ; une absence génère la
      pénalité prévue.
  - Un prêt interne produit un échéancier avec intérêt ; un retard déclenche un rappel WhatsApp
      préparé.
  - L'application ne détient aucun fonds ; elle ne fait que tenir le registre.
  - Une garantie est enregistrée avec l'accord des deux membres et alerte en cas de retard du garanti.
  - La clôture de cycle produit un bilan par membre.
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




Cahier des charges — CotiZ · v1.0 · 31 octobre 2026                                                       Page 7

---

<!-- Page 8 -->

## 15. Identité visuelle et charte graphique [V]
 Chaque application suit la charte graphique de son logo : mêmes couleurs, même style. Le logo et
 le nom ont été fournis le 31 octobre 2026. [V]

 15.1 Logo
 - Logo : deux flèches circulaires vert, jaune et rouge autour d'une pièce dorée à motif africain, mot «
     CotiZ » en bleu nuit. Couleurs aux teintes du drapeau camerounais.
  - Le logo en tête de ce cahier est le fichier fourni. Usage : sur fond clair (ou sur le fond d'origine pour
     NAXA Services), sans le déformer ni le recolorer ; zone de protection égale à la hauteur d'une lettre ;
     taille minimale à l'écran de 24 pixels de haut. [P]
  - À prévoir à partir du fichier fourni : icône d'application adaptative, écran de démarrage, logo
     monochrome pour l'icône des notifications, logo pour les reçus et documents. Fournir idéalement les
     logos au format vectoriel (SVG) ou en grande taille avec fond transparent. [P]

 15.2 Palette
                                                                                                               Contraste sur
        Couleur                       Code            Usage
                                                                                                               blanc

                                                      Barre supérieure, titres, logotype, boutons
        Bleu nuit — principale        #012952                                                                  14.6 : 1
                                                      principaux

                                                      Flèche, états actifs, cotisations à jour ; texte blanc
        Vert — accent de marque       #018A44                                                                  4.4 : 1
                                                      dessus

        Rouge — accent de                             Flèche, retards et pénalités (toujours avec icône
                                      #D81224                                                                  5.2 : 1
        marque                                        et libellé)

        Jaune — accent de                             Pièce, mises en avant, épargne ; en fond
                                      #FDCC1D                                                                  1.5 : 1
        marque                                        seulement, texte bleu nuit dessus

        Or — détail                   #B4840C         Motif de la pièce, filets, médailles de fidélité         3.4 : 1

        Fond clair                    #E8F5EC         Cartes, lignes alternées                                 1.1 : 1

        Mode sombre — fond            #08203F         Fond du mode sombre ; surfaces #12335C                   16.3 : 1

                                                      Opération réussie, paiement confirmé (toujours
        Succès                        #197A33                                                                  5.4 : 1
                                                      avec l'icône ✓ et le mot « payé »)

                                                      Erreur, écart, impayé, rupture (toujours avec
        Alerte                        #C62828                                                                  5.6 : 1
                                                      l'icône ! et un libellé)

                                                      À vérifier, échéance proche (toujours avec l'icône
        Avertissement                 #8F5400                                                                  6.1 : 1
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
     commerce du client et la mention discrète « établi avec CotiZ », aux couleurs de l'application. Le



Cahier des charges — CotiZ · v1.0 · 31 octobre 2026                                                                       Page 8

---

<!-- Page 9 -->

     client peut ajouter son propre logo à partir du palier Pro. [P]
  - Cohérence de la famille : la page de téléchargement officielle présente les sept applications avec
     leur logo et leur couleur ; un client qui en utilise plusieurs retrouve les mêmes repères.
 Point d'attention. Le vert et le rouge sont à la fois des couleurs de marque et des couleurs de sens
 (payé, retard) : ils ne doivent jamais porter seuls l'information. Chaque état a une icône et un mot (✓
 payé, ! en retard), ce qui aide aussi les utilisateurs qui distinguent mal ces deux couleurs.


## 16. Glossaire
  - APK : fichier d'installation d'une application Android. FCM : notifications push gratuites de Google.
     RLS : règles de sécurité par ligne dans la base.
  - Famille d'applications : l'ensemble des sept applications partageant la même architecture. Socle
     commun : la partie partagée (section 3). Jalon : étape de construction testable.
  - Compte mère : compte du propriétaire qui regroupe plusieurs points. Parseur : programme qui
     extrait montant, nature et solde d'un SMS. PIN : code secret de l'opérateur. Code d'accès : code
     qui déverrouille l'application.




Cahier des charges — CotiZ · v1.0 · 31 octobre 2026                                                   Page 9
