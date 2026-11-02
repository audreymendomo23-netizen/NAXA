# NAXA — Registre des décisions métier confirmées par le fondateur

Dernière mise à jour : 02/11/2026  
Statut : décisions métier confirmées par réponse explicite au questionnaire.  
Portée : référence fonctionnelle à appliquer au code de `main`. Ce document consigne les choix métier ; il ne prouve ni leur implémentation ni leur validation technique.

## Autorité et règle de mise à jour

Les décisions ci-dessous complètent et, lorsqu'elles portent sur le même sujet, remplacent les questions ouvertes ou propositions antérieures du cahier des charges v3.7 et des fiches métier. L'historique documentaire est conservé, mais une ancienne question ne doit plus être reposée comme si elle était encore ouverte.

Les décisions confirmées ne bloquent pas la construction des fonctionnalités indépendantes. Un point non résolu ne bloque que la tranche qui en dépend directement. Aucun comportement manquant ne doit être inventé.

## A. Gouvernance des rôles, affectations et Responsable

1. **Cumul des fonctions.** Plusieurs fonctions professionnelles peuvent être attribuées simultanément à une même personne. Une seule fonction/un seul espace de travail peut être sélectionné comme contexte actif à la fois. Chaque fonction reste une affectation explicite, distincte et soumise à ses propres permissions et périmètres.
2. **Pouvoir du Responsable.** Le Promoteur peut déléguer au Responsable la validation d'opérations dans des plafonds qu'il définit. Cela couvre les catégories d'opérations métier prévues au cahier (annulations, remises, sorties exceptionnelles, ajustements d'inventaire et commandes), sous réserve des droits attribués et du plafond applicable. Les opérations réservées au Promoteur ou à NAXA ne deviennent pas délégables de ce fait.
3. **Architectures.** Le Responsable est autorisé uniquement dans les architectures PARENTS_AINES_CADETS et HYBRIDE. Il n'est pas disponible dans ORPHELIN ni PARENTS_ENFANTS.
4. **Périmètre.** Un Responsable peut couvrir plusieurs pharmacies d'un même Promoteur, exclusivement au moyen d'affectations explicites par pharmacie.
5. **Accréditation Pharmacien.** Le Promoteur soumet la proposition d'accréditation ; l'Administrateur NAXA vérifie les justificatifs et valide l'accréditation. Seul un professionnel doté de cette accréditation peut valider les ordonnances.
6. **Affectation urgente.** Le Promoteur peut attribuer directement une affectation urgente. L'attribution doit être tracée et expirer automatiquement.
7. **Durée ordinaire des affectations.** Une affectation ordinaire reste permanente jusqu'à révocation explicite. Cette règle ne supprime pas l'expiration automatique des affectations urgentes : le délai précis d'expiration urgente reste à définir.

## B. Suspension, sanctions et réservations

8. **Suspension complète d'une pharmacie.** Toutes les réservations qui ne sont pas encore retirées sont annulées ; les quantités réservées sont libérées/restaurées selon le mécanisme de stock applicable ; les Clients concernés sont informés. Les historiques et traces sont conservés.
9. **Sanction Marketplace SM-01.** SM-01 bloque le Promoteur et ses pharmacies concernées sur la Marketplace. Les opérations ERP internes qui restent autorisées sont préservées. SM-01 est distincte d'une suspension complète de pharmacie.
10. **Cycle de préparation.** Le cycle doit disposer de deux états persistants distincts : « En préparation », puis « Prête au retrait ». Ces étapes doivent être journalisées et contrôlées côté serveur ; le libellé d'un bouton ne vaut pas preuve d'une transition persistée.
11. **Pharmacie sans Pharmacien assistant.** Seul un professionnel disposant de l'accréditation Pharmacien peut valider les ordonnances.

## C. Crédit, stock et caisse

12. **Crédit au comptoir.** Les choix soumis autorisent la Caissière dans un plafond, le Responsable dans un plafond qui lui est délégué et le Promoteur. La portée exacte de la mention « Promoteur uniquement » dans la sélection multiple reste à confirmer : voir les arbitrages résiduels.
13. **Crédit Marketplace — décideurs.** La demande peut être validée par le Promoteur ou par un Responsable expressément habilité par le Promoteur.
14. **Stock pour un crédit Marketplace.** La validation du crédit entraîne le décrément physique immédiat du stock. Le mouvement, la dette/le crédit et l'opération de préparation doivent être cohérents et atomiques ; aucun double décrément ne doit être possible.
15. **Paramètres du crédit.** Le Promoteur configure depuis son compte les règles de crédit, notamment les plafonds et délais. Les paramètres doivent être traçables et bornés par les valeurs de référence NAXA lorsqu'elles sont définies.
16. **Remboursements.** Le remboursement du crédit peut être intégral ou partiel selon la configuration de la pharmacie.
17. **Ventilation comptable assurance/client.** Dans la carte de caisse, « Principal » désigne la part assureur et « Remboursement » désigne la part Client.
18. **Moyens de paiement Caisse.** Le libellé « OM Cash » est remplacé par « Orange Money ». « Espèces » reste un moyen de paiement distinct.
19. **Solde crédit Caisse.** Le solde présenté dans le contexte de la Caisse porte uniquement sur les crédits de la session.

## D. Paramètres financiers et abonnement Promoteur

20. **Paramètres financiers.** NAXA fournit des valeurs de référence, personnalisables par pharmacie. Aucun montant ou seuil numérique absent des sources ne doit être inventé ; les valeurs réellement applicables doivent être visibles et configurables.
21. **Périodicité.** Le Promoteur peut choisir un abonnement mensuel ou annuel.
22. **Début de période.** Une nouvelle période d'abonnement commence à la date réelle de confirmation du paiement.
23. **Frais.** Les frais de transaction sont intégrés au tarif convenu ; ils ne sont pas ajoutés comme supplément au paiement du Promoteur.
24. **Détection.** Le rapprochement automatique doit fonctionner pour tous les canaux pour lesquels une notification fiable est disponible. L'Administrateur assure la vérification de secours lorsque la confirmation automatique fiable n'est pas possible.
25. **Connexion Promoteur.** La connexion du Promoteur repose sur le mot de passe uniquement ; aucune seconde authentification de connexion n'est exigée par cette décision. Les validations fortes déjà prévues pour les opérations sensibles (empreinte/WebAuthn ou PIN de repli) restent distinctes et ne sont pas supprimées.

Le parcours détaillé de déclaration, les échéances T0/T+2 min/T+1 h/T+24 h, le maintien temporaire des accès, la détection tardive, la vérification exceptionnelle et la réactivation automatique restent régis par le contrat de paiement Promoteur–NAXA déjà confirmé par le fondateur et consigné dans les échanges et documents opérationnels. Cette décision sur l'abonnement mensuel/annuel ne modifie pas ces règles.

## E. Synchronisation, catalogue et Pilotage Admin

26. **Conflit hors ligne.** En cas de modifications concurrentes d'une même donnée, la dernière modification horodatée gagne automatiquement. La mise en œuvre doit empêcher les horodatages clients incohérents de provoquer un écrasement arbitraire ; les horodatages et versions doivent être vérifiés côté serveur.
27. **Sources du catalogue médicaments.** Les sources admises sont : données transmises par les pharmacies, catalogues fournis par les grossistes et sources médicales disposant d'une licence compatible. La provenance et la date de mise à jour doivent être conservées ; aucun scraping non autorisé.
28. **Données de démonstration dans le Pilotage Admin.** Les pharmacies de démonstration sont exclues des KPI opérationnels.
29. **Compteur d'alertes Admin.** Le compteur représente le nombre total de signaux, même lorsque plusieurs signaux concernent un même dossier. Il ne doit pas être présenté comme un nombre de dossiers uniques.
30. **Destinataires des rappels de lots.** La sélection reçue contient à la fois « uniquement les pharmacies du réseau Promoteur concerné » et « toutes les pharmacies actives et vérifiées ». Ces deux périmètres se chevauchent mais ne sont pas équivalents ; ne pas coder une diffusion globale ou ciblée tant que la portée voulue n'est pas clarifiée.

## F. Dossiers documentaires pharmacie

31. **Cases « documents reçus ».** Les cases de checklist sont informatives uniquement ; leur état ne constitue ni une preuve d'authenticité ni, à lui seul, une condition bloquante de validation du dossier. Cette décision ne dispense pas de vérifier séparément les pièces réellement exigées et leur présence lorsqu'une règle documentaire ou réglementaire l'impose.

## G. Arbitrages résiduels qui ne bloquent pas les travaux indépendants

Les points suivants demandent une précision, mais ne suspendent pas les corrections indépendantes :

1. **Crédit au comptoir :** la sélection multiple comprend simultanément « Caissière dans un plafond », « Responsable dans un plafond délégué » et « Promoteur uniquement ». Confirmer si les trois profils peuvent accorder directement le crédit dans leurs plafonds respectifs, ou si le Promoteur doit valider chaque crédit.
2. **Remboursement après suspension :** toutes les réservations non retirées sont annulées, y compris potentiellement des réservations déjà payées directement à la pharmacie. La décision n'indique pas la règle de remboursement du Client ; NAXA ne doit pas déclencher de remboursement d'argent qu'il n'a pas encaissé.
3. **Préparation et encaissement :** préciser si le paiement à la caisse intervient avant ou après « Prête au retrait ». Le cycle de code actuel lie le statut payée à un encaissement POS et retiree au retrait physique.
4. **Crédit Marketplace et annulation :** préciser quand et dans quelles conditions le stock physiquement décrémenté lors de la validation du crédit doit être restauré si la commande est annulée, non retirée ou non livrée.
5. **Durée urgente :** définir le délai par défaut d'expiration automatique d'une affectation urgente et les possibilités de prolongation.
6. **Abonnement annuel :** préciser le tarif annuel : douze fois le tarif mensuel, tarif annuel négocié distinct, ou remise annuelle. Le modèle existant basé sur un montant mensuel ne permet pas de déduire cette règle.
7. **Rappels de lots :** choisir entre diffusion limitée au réseau du Promoteur concerné, diffusion à toutes les pharmacies actives et vérifiées, ou deux niveaux de diffusion distincts.
8. **Pièces de dossier :** confirmer si la validation exige la présence et l'examen des fichiers justificatifs réels, même si les cases de réception sont seulement informatives.
9. **Valeurs de référence financières :** les seuils/montants NAXA applicables doivent être identifiés dans la configuration existante ou fournis ; aucun montant ne doit être inventé.

## H. Décisions de référence antérieures conservées

Sauf décision plus récente contraire, restent applicables :
- accès public soumis à déclaration d'âge et comptes Client/professionnels réservés aux adultes ;
- consentement distinct par document/version ;
- révocation immédiate des accès professionnels concernés ;
- réservation gratuite et annulation Client avant retrait effectif ;
- paiement des médicaments directement à la pharmacie, sans collecte ni commission NAXA ;
- notifications selon consentement de chaque canal ;
- opérations hors ligne conservées puis synchronisées sans transfert d'identité ni de périmètre ;
- 1 Promoteur = 1 convention = 1 tarif = 1 abonnement, pour ses pharmacies rattachées ;
- blocage commercial à expiration, avec exception de traitement de paiement de 24 h telle que définie au contrat de paiement ;
- application Android du Promoteur reportée et exclue du chantier ;
- contrôles CI et comptes de test réels exclus des critères de mise au vert fixés par le mandat actuel ;
- aucune régression acceptée, travail exclusivement sur `main`, aucun déploiement.

## I. Statut de validation

Ce registre valide les **décisions métier** ci-dessus, pas leur état d'implémentation. Chaque fonctionnalité doit rester classée séparément : décision confirmée, code présent, correction réalisée, test exécuté, preuve obtenue, recette utilisateur éventuelle. Les arbitrages résiduels de la section G ne doivent bloquer que leurs dépendances directes.

### Vérification du code après réception des décisions — crédit Marketplace

La décision « décrémenter physiquement le stock dès validation du crédit » est confirmée, mais le contrat actuellement versionné fait encore l'inverse :

- Migration 247 : la décision de crédit crée une réservation et des allocations FEFO sans débit physique.
- Migration 251 : réaffirme explicitement le hold sans débit physique ; le test SQL 251 vérifie que l'approbation ne diminue ni stocks.quantite ni stocks_lots.quantite.
- Migrations 252/256 : le débit physique est effectué au retrait POS, avec consommation des lots affectés.
- Le retrait utilise le marqueur stock_decremented pour éviter le débit de stock agrégé au retrait, mais la version 256 diminue encore les quantités de lots pendant le retrait.
- Le cron d'expiration annule les réservations expirées et appelle restore_stock dans la même transaction. La réservation crédit est créée avec une expiration de quatre heures. Le registre des demandes de crédit ne prévoit que les statuts en_attente, approuvee et rejetee ; l'expiration de la réservation ne ferme pas actuellement la demande approuvee associée.

**Conséquence :** le contrat antérieur « hold sans débit à l'approbation » est remplacé par la décision du fondateur du 02/11/2026. La correction doit être additive : débiter stocks agrégés et lots alloués à l'approbation, marquer stock_decremented, ne pas redébiter au retrait POS, et conserver une restitution unique via restore_stock si la réservation est annulée/expirée. Les tests 251 doivent être remplacés/actualisés par des preuves de débit à l'approbation, retrait sans double débit, restauration une seule fois et isolation inter-pharmacies. Aucune migration Production n'est autorisée par le présent mandat.

**Arbitrage fonctionnel complémentaire requis :** lorsqu'une réservation de crédit approuvée expire après le délai de retrait, faut-il fermer automatiquement la demande de crédit associée en « rejetée/expirée » afin de libérer le Client pour une nouvelle demande, ou conserver la demande approuvée pour une reprise manuelle ? Tant que ce point n'est pas arbitré, le travail sur les autres fonctionnalités continue.


### Traduction dans le parcours Admin — checklist des pièces reçues (02/11/2026)

- Décision appliquée : les cases de la checklist de réception sont informatives, conservées comme traces de déclaration, et ne constituent plus une condition de validation du dossier.
- Distinction préservée dans le code : les six fichiers réellement déposés (existence légale, RCCM, NIU, attestation de non-redevance, plan de localisation, CNI Promoteur) restent contrôlés individuellement et leur dernière version doit être validée. Cette conservation reflète le prérequis documentaire actuellement codé ; elle ne constitue pas à elle seule une conclusion sur les exigences réglementaires camerounaises.
- L'attestation explicite de l'Administrateur confirmant le contrôle réel des autorisations et pièces reste obligatoire. Les gardes de dossier en attente, cohérence convention/abonnement/architecture et provisionnement transactionnel sont préservés.
- Source corrigée sur main : écran Admin individuel, action serveur et migration additive `20261102114000_admin_pharmacy_receipt_checklist_informational.sql`; contrat SQL mis à jour et test Node ciblé ajouté.
- La migration n'a pas été appliquée à Supabase Production. Le test Node/SQL n'a pas été exécuté via `npm test` ou sur un environnement SQL dans cette passe ; seuls les contrôles statiques ciblés ont été exécutés.
