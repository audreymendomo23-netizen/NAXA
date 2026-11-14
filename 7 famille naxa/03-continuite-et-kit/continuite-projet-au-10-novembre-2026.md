# Fichier de continuité — famille d'applications, Campus237, NAXA Security (10 novembre 2026)

## Règles de travail (à mettre dans chaque conversation de construction)
Travailler uniquement sur main ; aucune branche parallèle, aucune PR, aucune vérification CI, aucun déploiement, sans accord explicite et écrit de Bienvenu.

## Produits (9) et statut
- Famille de 7 applications Android : Kiosko (mobile money, mode admin), Bootik (boutiques, dépôt de gaz), Zipple (bar et restaurant), NAXA Services (pressing, coiffure), CotiZ (tontine), Loyable (bailleur), NAXA Hotel. Cahiers 01 à 07 livrés ; logos et chartes intégrés.
- Campus237 (ERP scolaire) : cahier 08 v2.0 (13 pages) ; modèle : école gratuite, parents : base gratuite + abonnement 600 F par mois sur 9 mois (annuel 4 200 F), répartition 80 % plateforme / 20 % fonds école via APE, calcul sur le net ; messages et appels dans l'application ; projet direct sans pilote.
- NAXA Security (sécurité des biens et des personnes par surveillance à distance et IA) : cahier 09 v1.0 et prompts série 13 livrés ; fonctions exclues : IMSI, enregistrement vocal discret, blocage automatique de portes, appel automatique à la police, reconnaissance faciale.

## Dossiers de prompts (ordre d'exécution)
Série 0 (socle) puis séries 1 à 7 (une application à la fois) ; série 12 (Campus237, après 0 et 1.1 à 1.4) ; série 8 (refonte du design) ; série 9 (module Caméras, avec 9.7 vision de nuit et alertes IA) ; série 13 (NAXA Security, après la série 9) ; série 10 (nouveautés Zipple, QR, import photo, attestation, étude vocale CotiZ) ; série 11 (6 options : trésorerie unifiée, prévision 30 jours, copilote pourquoi, briefing audio, écran cuisine, addition partagée). Version texte dans Prompts_version_texte_TXT.zip.

## Où en est ChatGPT
Au prompt 01 de Kiosko (8 novembre). Le prompt 0.1 (pile technique et structure) n'a pas été confirmé comme validé : ne pas le valider avant l'étude d'architecture du dépôt NAXA décidée avec Claude.

## Prochaines étapes décidées
1. Bienvenu renvoie le zip du dépôt NAXA (sans node_modules, .git, build) ; Claude en fait une lecture statique : rapport d'architecture de référence, écarts avec le plan, prompt d'alignement de la série 0 et amendements ciblés.
2. Kit de construction (logique testée, SQL non exécuté, prototype admin) déjà livré pour la famille ; un kit équivalent pour Campus237 est possible.

## Ce que Bienvenu doit fournir ou décider
Corpus de SMS réels (Orange Money, MTN MoMo, banques) ; barèmes de frais et codes USSD marchands ; paramètres de paie et CNPS validés par un expert-comptable ; avis juridiques (mineurs, reversement au fonds, contenus de la bibliothèque, transfert de dossier, caméras, télésurveillance) ; prix par enfant ou par famille (Campus237) ; matériel inclus ou non dans les packs NAXA Security ; nom, logo et charte de NAXA Security.

## Limites connues
Aucun prompt n'a été testé avec ChatGPT ; aucune APK compilée ; SQL non exécuté sur PostgreSQL ; estimations commerciales à confirmer sur le terrain.
