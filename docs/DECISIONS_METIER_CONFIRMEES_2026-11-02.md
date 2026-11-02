# NAXA — Décisions métier confirmées au 02/11/2026

Date de consignation : 02/11/2026  
Source : arbitrages explicites transmis par le fondateur à la suite du questionnaire métier.  
Statut : décisions métier confirmées, sous réserve des contradictions explicitement isolées dans la section 4.  
Portée : référence fonctionnelle complémentaire au cahier des charges v3.7. En cas de contradiction avec une question ancienne marquée « À ARBITRER », le présent addendum, daté du 02/11/2026, prévaut pour le sujet concerné.

## 1. Règles d'interprétation

- Les réponses ci-dessous sont des décisions métier, pas des preuves que le code est déjà conforme.
- Les changements applicatifs doivent être additifs, audités, testés et sans régression.
- Les choix qui présentent une contradiction interne ou une conséquence financière non définie sont consignés comme décidés dans leur principe, mais leur sous-règle technique reste ouverte.
- Une question non résolue ne bloque que la fonctionnalité qui en dépend directement. Les autres corrections indépendantes continuent.
- Travail sur la branche main uniquement. Aucun déploiement. Aucune écriture ni migration Supabase Production sans autorisation explicite.

## 2. Décisions confirmées

### 2.1 Identité, fonctions et responsabilités

1. **Cumul des fonctions :** une même personne peut recevoir plusieurs affectations professionnelles dans une pharmacie, mais un seul espace/fonction de travail est sélectionné comme actif à un instant donné.
2. **Responsable — délégation :** le Promoteur peut déléguer au Responsable la validation d'opérations dans des plafonds qu'il définit.
3. **Architectures :** le Responsable est disponible uniquement dans PARENTS_AINES_CADETS et HYBRIDE.
4. **Périmètre :** un Responsable peut couvrir plusieurs pharmacies appartenant au même Promoteur, au moyen d'affectations explicites par pharmacie.
5. **Accréditation Pharmacien :** le Promoteur propose l'accréditation ; l'Administrateur NAXA vérifie les justificatifs et la valide.
6. **Affectation urgente :** le Promoteur peut attribuer directement une fonction d'urgence ; l'affectation est tracée et doit expirer automatiquement.
7. **Affectation ordinaire :** elle reste permanente jusqu'à révocation explicite.

La séparation des tâches, le périmètre pharmacie, les privilèges serveur et les contrôles d'approbation restent obligatoires. Le cumul de fonctions n'accorde aucun privilège implicite.

### 2.2 Suspension, discipline et réservations

8. **Suspension complète d'une pharmacie :** toutes les réservations non retirées sont annulées ; les quantités encore réservées sont libérées/restaurées de façon exacte et idempotente ; les Clients sont informés.
9. **SM-01 — sanction disciplinaire Promoteur :** la sanction bloque le Promoteur et les pharmacies rattachées sur la Marketplace, mais conserve les opérations ERP internes qui demeurent autorisées. Elle reste distincte de la suspension complète d'une pharmacie.
10. **Cycle de préparation :** les réservations doivent avoir des états persistants distincts « En préparation » et « Prête au retrait ». Le système doit enregistrer les horodatages et l'acteur des transitions.
11. **Validation d'ordonnance :** seul un professionnel disposant de l'accréditation Pharmacien validée peut valider une ordonnance, y compris lorsqu'une pharmacie ne dispose pas de Pharmacien assistant.

La suspension complète et le SM-01 ne doivent pas partager un simple booléen d'activité. Ils exigent des périmètres, motifs, historiques et conséquences distincts.

### 2.3 Crédit Client et Marketplace

12. **Crédit au comptoir :** les acteurs retenus sont la Caissière dans une limite autorisée, le Responsable dans une limite qui lui est déléguée et le Promoteur. La mention sélectionnée « Promoteur uniquement » est toutefois contradictoire avec les deux autres acteurs cochés ; voir section 4.
13. **Validation d'un crédit Marketplace :** le Promoteur ou le Responsable expressément habilité par le Promoteur peut valider la demande.
14. **Stock au crédit Marketplace :** le stock physique doit être décrémenté dès la validation du crédit.
15. **Paramètres de crédit :** le Promoteur configure depuis son compte les paramètres du crédit, notamment le montant limite et le délai de remboursement. Ne pas inventer de plafond ni de durée codés en dur.
16. **Remboursement :** paiement intégral ou partiel selon la configuration de la pharmacie.
17. **Indicateurs de remboursement :** « Principal » désigne la part assureur ; « Remboursement » désigne la part Client.
18. **Modes Caisse :** remplacer le libellé « OM Cash » par « Orange Money » et conserver « Espèces » comme moyen distinct.
19. **Solde crédit affiché à la Caisse :** limiter l'indicateur au crédit de la session courante.
20. **Paramètres financiers :** NAXA fournit des valeurs de référence ; chaque pharmacie peut les personnaliser selon ses autorisations.

### 2.4 Abonnement Promoteur et sécurité

21. **Périodicité :** abonnement mensuel ou annuel, au choix du Promoteur.
22. **Début de période après paiement tardif :** la nouvelle période commence à la date réelle de confirmation du paiement.
23. **Frais de transaction :** les frais éventuels sont intégrés au tarif convenu ; ils ne sont pas ajoutés comme une ligne surprise au paiement du Promoteur.
24. **Détection automatique :** tous les canaux (MTN Mobile Money, Orange Money, virement bancaire) peuvent être détectés automatiquement lorsqu'une notification fiable et suffisamment probante est disponible ; l'Administrateur assure le contrôle exceptionnel en secours.
25. **Application compagnon de détection :** l'application Android dédiée au téléphone Admin pour détecter les notifications de paiement est distribuée depuis le site NAXA, sans hébergement Play Store. Elle est distincte de l'application Android du Promoteur, reportée et hors critères du présent chantier.
26. **Connexion Promoteur :** mot de passe uniquement ; aucune double authentification de connexion supplémentaire n'est imposée par cette décision. Les confirmations sensibles déjà définies pour les opérations métiers ne sont pas supprimées par ce choix.

Les règles de paiement Promoteur–NAXA déjà confirmées séparément restent inchangées : déclaration à T0, passage à « NON CONFIRMÉ » à T+2 minutes sans arrêt de la détection, alerte Admin à T+1 heure, accès maintenus 24 heures à partir de T0, blocage après T+24 heures sans décision, détection poursuivie au-delà et confirmation tardive avec activation/rétablissement automatique, pièce jointe non suffisante à elle seule, reçu après confirmation seulement, anti-doublon transactionnel et snapshot des coordonnées bénéficiaires.

### 2.5 Mode hors ligne et données de référence

27. **Conflit hors ligne :** la dernière modification horodatée gagne automatiquement. Cette règle doit être appliquée avec une chronologie fiable et déterministe, sans permettre à un appareil de transférer ses opérations à une autre identité ou pharmacie.
28. **Catalogue médicaments :** sources autorisées retenues :
   - données transmises par les pharmacies ;
   - catalogues fournis par les grossistes ;
   - source médicale disposant d'une licence compatible.
   
   Chaque donnée importée doit conserver sa provenance et sa date de mise à jour. Aucun scraping non autorisé.

### 2.6 Pilotage et administration

29. **Pharmacies de démonstration :** elles sont exclues des KPI opérationnels. Elles peuvent rester consultables dans un périmètre explicitement identifié comme démonstration, mais ne doivent pas fausser les indicateurs du réseau réel.
30. **Compteur d'alertes Admin :** il compte le nombre total de signaux ; plusieurs signaux peuvent concerner un même dossier.
31. **Rappels de lots :** les destinataires sont les pharmacies du réseau Promoteur concerné et les pharmacies actives et vérifiées. La portée doit être contextualisée selon la nature du rappel, voir section 4.
32. **Pièces reçues des dossiers pharmacie :** les cases « documents reçus » sont informatives ; elles ne constituent pas à elles seules une preuve d'authenticité ou une condition bloquante. Les véritables fichiers justificatifs, leur validation et l'attestation Admin restent soumis aux contrôles documentaires déjà prévus.

## 3. Règles de mise en œuvre qui ne changent pas les décisions

- Pour les crédits Marketplace, le débit physique au moment de l'approbation ne doit jamais être répété lors de la préparation, de l'encaissement ultérieur ou du retrait. La réservation/commande doit porter une trace d'allocation et de consommation unique.
- Pour les remboursements de crédit, les encaissements partiels doivent diminuer le solde restant dû sans rétablir le stock.
- Pour les opérations hors ligne, les journaux financiers et les mouvements de stock doivent rester traçables et non destructifs. Le « dernier horodatage gagnant » s'applique au conflit de valeur d'un même enregistrement ; il ne doit pas supprimer ou réécrire les événements de mouvement.
- Les dates urgentes doivent être calculées côté serveur et auditées ; une affectation ordinaire permanente ne doit pas devenir une affectation urgente sans expiration.
- La suspension complète doit distinguer annulation de réservation, libération/restauration de stock et éventuel remboursement d'un paiement déjà encaissé.
- Les rappels de lots doivent être distingués entre rappel ciblé sur un réseau et rappel général/national.
- Les cases informatives de réception de documents ne remplacent pas la vérification des documents réels.
- Les indicateurs de l'Admin ne doivent pas dédupliquer les signaux lorsque la décision exige un total de signaux.

## 4. Contradictions et sous-règles encore à clarifier

Ces sujets ne remettent pas en cause les décisions générales consignées ci-dessus, mais doivent être isolés avant d'activer le sous-parcours correspondant.

### DEC-01 — Expiration d'une affectation urgente vs affectation permanente

- Réponse confirmée : affectation urgente attribuable directement et avec expiration automatique ; affectation ordinaire permanente jusqu'à révocation.
- Sous-règle manquante : durée par défaut d'une affectation urgente (par exemple durée saisie à la création, avec maximum configurable).
- Traitement : les affectations ordinaires peuvent avancer avec révocation explicite ; le sous-parcours urgent exige une durée serveur obligatoire, à faire préciser sans présumer une valeur.

### DEC-02 — Crédit au comptoir : « Promoteur uniquement » coché avec deux autres acteurs

- Réponses cochées : Caissière dans sa limite, Responsable dans son plafond délégué, et « Promoteur uniquement ».
- Interprétation provisoire la plus cohérente : les trois profils sont autorisés, le Promoteur étant également autorisé ; le terme « uniquement » est traité comme une contradiction de libellé, pas comme une restriction globale.
- Traitement : ne pas réduire les droits à la Caissière/Responsable/Promoteur avant clarification du sens de « Promoteur uniquement ». L'implémentation des plafonds et délégations peut être construite indépendamment.

### DEC-03 — Suspension complète et réservations déjà payées mais non retirées

- Réponse confirmée : toutes les réservations non retirées sont annulées.
- Risque concret : le statut existant « payee » signifie qu'un paiement a été encaissé par la pharmacie ; NAXA ne collecte pas le paiement des médicaments.
- Sous-règle manquante : mécanisme de remboursement au Client et traitement comptable/stock d'une réservation « payee » annulée.
- Garde obligatoire : aucune fausse annulation de paiement ; aucun remboursement fictif ; aucune double restitution de stock. La pharmacie reste responsable du remboursement monétaire direct au Client, sauf décision explicite contraire. Le traitement logiciel doit journaliser le remboursement dû/effectué.
- Traitement : annulation automatique des dossiers non payés selon les transitions sécurisées ; le sous-parcours de clôture des réservations payées exige une règle de remboursement et de rapprochement.

### DEC-04 — Deux portées de rappel de lots sélectionnées

- Réponses cochées : pharmacies du réseau Promoteur concerné ET toutes les pharmacies actives et vérifiées.
- Interprétation de travail proposée : rappel ciblé = réseau concerné ; rappel général/national = toutes les pharmacies actives et vérifiées.
- Traitement : construire les deux portées explicites et tracer le type de rappel. Ne pas fusionner les destinataires des deux portées par défaut.

### DEC-05 — Tarif annuel

- La périodicité mensuelle ou annuelle est confirmée ; les frais de transaction sont intégrés au tarif.
- Le montant annuel précis et un éventuel avantage de prix ne sont pas définis.
- Traitement : permettre à l'Administrateur de configurer un tarif mensuel et un tarif annuel explicites par convention. Ne pas calculer automatiquement un prix annuel à partir du prix mensuel et ne pas inventer de remise.

### DEC-06 — Dernière modification horodatée gagnante

- La règle métier est confirmée, mais le contrat offline actuel utilise un contrôle de concurrence par base_updated_at et retourne conflict.
- Une comparaison naïve de l'heure du téléphone avec stocks.updated_at est insuffisante : horloges décalées, synchronisations reçues dans un ordre différent et écrasements successifs peuvent produire un mauvais gagnant.
- Traitement : concevoir une version/timestamp de mutation persistant, cohérent pour les écritures en ligne et hors ligne, un départage déterministe et un journal des valeurs perdantes. Les mouvements de stock/financiers restent des événements append-only ; ne pas les écraser par LWW.

### DEC-07 — Paramètres financiers de référence

- Les valeurs de référence NAXA sont personnalisables par pharmacie, mais les valeurs numériques des plafonds, seuils d'écart et limites de remise ne sont pas fournies ici.
- Traitement : rendre les paramètres configurables et refuser/désactiver l'opération concernée tant qu'une valeur obligatoire n'est pas définie. Ne pas introduire de montant par défaut arbitraire.

### DEC-08 — Catalogue médical licencié

- Les trois familles de sources sont confirmées.
- Les fournisseurs exacts, licences, modalités d'accès et éventuels coûts restent à vérifier.
- Traitement : préparer les connecteurs et le modèle de provenance ; ne pas importer une source non autorisée ou souscrire un service payant sans accord.

## 5. État initial de conformité du code observé au 02/11/2026

Les éléments suivants ont été vérifiés par lecture des fichiers de main, sans exécution de build, tests ou base distante dans cette passe :

| Sujet | Constat source | Suite |
|---|---|---|
| Exclusion des démos des KPI Admin | src/app/admin/page.tsx et src/app/admin/layout.tsx filtrent déjà les pharmacies avec isDemoPharmacy; la fonction s'appuie sur un motif de nom cohérent avec supabase/migration_244_hide_demo_pharmacies.sql. | Décision déjà partiellement appliquée au code. Vérifier si la détection par nom couvre tous les enregistrements de démo. |
| Compteur d'alertes | La page et le layout additionnent les signaux de stock, d'inactivité/visibilité et d'échéance. | Conforme à la décision « total de signaux », sans dédoublonnage. |
| États de préparation | reservations.preparation_statut, preparation_demarre_le et prete_au_retrait_le sont utilisés par src/app/pharmacie/gestionnaire-stock/reservations/page.tsx; la migration 20261027030000_sm01_reservations_disciplinaire_et_garde_rpc.sql définit les transitions serveur. | Construction source déjà présente ; validation SQL/runtime à faire hors Production. |
| SM-01 | Les migrations 20261027020000_promoteur_suspension_disciplinaire.sql et 20261027030000_sm01_reservations_disciplinaire_et_garde_rpc.sql séparent la sanction Marketplace et les RPC ERP internes. | Revoir l'exhaustivité de la règle avec la nouvelle suspension complète distincte. |
| Cases « documents reçus » | src/app/admin/promoteurs/actions.ts commente les cases comme informatives ; la validation vérifie séparément les six vrais types de documents et leur statut valide. | Conforme à la décision ; conserver la distinction cases déclaratives / pièces vérifiées. |
| Crédit Marketplace | supabase/migration_251_credit_hold_no_physical_decrement.sql confirme explicitement un hold sans débit physique ; le test 247 vérifie l'absence de décrément lors de l'approbation. | Contradiction directe à corriger pour respecter la nouvelle décision de débit physique à l'approbation. |
| Synchronisation hors ligne | supabase/migration_220_offline_device_sync_contract.sql compare stocks.updated_at à base_updated_at et retourne conflict en cas de différence. | Contradiction directe à corriger pour respecter le gagnant horodaté, sans écraser les événements. |
| Paiement caisse | src/app/pharmacie/caisse/page.tsx propose Espèces et explique que les confirmations Mobile Money ne doivent pas être déclarées payées sur simple référence. | Remplacer le libellé demandé « OM Cash » partout où il existe ; conserver les contrôles de confirmation réelle. |

Cette cartographie est une inspection source, pas une preuve de runtime ni de Production.

## 6. Ordre de correction après consignation

1. Préserver le socle et corriger la contradiction du crédit Marketplace (débit physique à l'approbation, sans double débit ultérieur).
2. Corriger le contrat de synchronisation hors ligne selon LWW horodaté, après conception et tests d'ordre/concurrence.
3. Réconcilier le parcours de suspension complète avec les réservations non retirées, en séparant le remboursement des paiements déjà encaissés.
4. Harmoniser les affectations ordinaires et urgentes ; la durée urgente reste à préciser.
5. Vérifier l'accès Caisse, les libellés Orange Money/Espèces, les plafonds et le périmètre de solde.
6. Finaliser les tarifs mensuel/annuel et les rappels de lots avec leurs deux portées.
7. Continuer les autres parcours et corrections indépendantes dans l'ordre du mandat de mise au vert.

## 7. Gouvernance de validation et de preuve

Pour chaque correction, fournir : état initial, fichiers modifiés, commit SHA sur main, tests réellement exécutés, résultat, contrôles de sécurité, preuve de non-régression et mise à jour de FONCTIONNALITES_VALIDEES.md.

Ne pas déclarer vert un changement uniquement parce qu'une migration ou un composant existe. Aucune branche, aucune PR, aucun déploiement et aucune écriture Supabase Production ne sont autorisés par cette consignation.
