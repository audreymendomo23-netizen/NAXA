# NAXA Payment — architecture pilote validée

**Décision métier validée le 13 novembre 2026.** Cette architecture remplace toute proposition de capture SMS automatique obligatoire pour les pharmacies pendant le pilote.

## Principes non négociables

1. Ne jamais demander aux clients ou Promoteurs d'autoriser NAXA à lire tous leurs SMS. Le SMS de débit est transmis volontairement via le partage Android vers le parcours NAXA prévu.
2. Ne pas imposer à la pharmacie le transfert de son SMS de crédit pendant le pilote. La pharmacie confirme la réception du paiement depuis son espace NAXA, après contrôle de son portefeuille marchand.
3. Automatiser la confirmation uniquement lorsqu'une confrontation fiable des deux preuves est possible : SMS de débit partagé par le payeur et SMS de crédit authentifié reçu chez le bénéficiaire.
4. Si une preuve manque, est incomplète, ambiguë ou contradictoire, le paiement reste en attente et suit la voie de confirmation manuelle autorisée. Aucun statut « payé » ne doit être déduit du seul SMS de débit partagé.
5. Ne jamais bloquer une commande ou dégrader le parcours client à cause d'une permission Android sensible non accordée.

## A. Paiement d'un achat Client → Pharmacie — phase pilote

### Côté Client
- Le Client paie la pharmacie par le canal Mobile Money retenu.
- Il peut partager volontairement le SMS de débit depuis sa messagerie vers NAXA.
- NAXA rattache la preuve à l'intention de paiement / commande lorsque les informations permettent une correspondance sûre.
- Aucun droit RECEIVE_SMS n'est demandé au Client.
- Le parcours doit rester simple : partage du message en quelques gestes, association à la commande, retour visible dans le suivi de commande.

### Côté Pharmacie
- La Pharmacie reçoit la preuve partagée et voit la commande passer en « paiement à confirmer » (ou état métier équivalent).
- Elle vérifie l'arrivée réelle des fonds sur son compte marchand et confirme depuis son espace NAXA.
- Elle ne doit pas transférer son SMS de crédit, ni installer un lecteur SMS, pour chaque commande.
- Cette confirmation manuelle est le mode normal du pilote. NAXA journalise l'identité de l'auteur, l'heure, la commande et la décision.
- Si le SMS de débit n'a pas été partagé ou ne permet pas d'identifier la commande, le parcours manuel de vérification disponible reste utilisable ; ne pas fabriquer de correspondance.

### Automatisation future — après la phase de confiance
- La capture RECEIVE_SMS côté Pharmacie n'est pas requise au lancement.
- Après au moins cinq mois d'utilisation pilote et de confiance acquise avec les pharmacies, réévaluer puis construire l'option de capture automatique sur un téléphone marchand enrôlé, uniquement avec consentement explicite et autorisation Android valide.
- Quand NAXA possède les deux SMS et que les champs de rapprochement concordent de manière univoque, la confirmation peut être automatique.
- Si la capture est absente, refusée ou non fiable, conserver la confirmation manuelle. Ne jamais rendre l'automatisme obligatoire.
- L'hypothèse opérationnelle acceptée est de 5 à 10 livraisons quotidiennes environ par pharmacie durant le pilote : 5 à 10 partages volontaires du SMS par jour sont considérés comme un compromis acceptable le temps que NAXA évolue. Réexaminer cette charge avec les retours réels avant de la généraliser.

## B. Abonnement Promoteur → NAXA

### Côté Promoteur
- Le Promoteur partage volontairement son SMS de débit vers NAXA Paiement / le parcours Android NAXA prévu.
- L'application et le serveur déterminent le canal et rattachent le texte partagé à l'intention d'abonnement active.
- Le Promoteur ne donne pas à NAXA la permission générale de lire ses SMS ; aucune permission RECEIVE_SMS n'est nécessaire à ce rôle.
- Le SMS partagé constitue une preuve du débit déclaré et non, à lui seul, la preuve de crédit chez NAXA.

### Côté Administrateur
- Le téléphone Admin conserve le mode de réception automatique RECEIVE_SMS, avec consentement explicite, permission Android effectivement accordée et filtrage des expéditeurs attendus.
- Le serveur confronte le SMS de débit partagé par le Promoteur et le SMS de crédit reçu chez NAXA : canal, montant, référence, numéro payeur, destination marchande, date/heure et unicité.
- Si les deux preuves concordent sans ambiguïté et que la procédure métier l'autorise, NAXA confirme automatiquement le règlement et active/renouvelle l'abonnement.
- En cas de SMS Admin non reçu, incomplet ou non rapproché, l'Administrateur peut vérifier le crédit et confirmer manuellement depuis le cockpit, ou partager volontairement le SMS de crédit à NAXA comme solution de secours.
- Une anomalie, un doublon ou plusieurs paiements candidats bloque l'automatisme et déclenche une revue Admin.

## C. Rôles et permissions Android

| Rôle | Transmission / capture pendant le pilote | Permission RECEIVE_SMS |
|---|---|---|
| Client | Partage volontaire du SMS de débit | Non |
| Pharmacie | Confirmation manuelle dans l'espace Pharmacie ; pas de transfert de son SMS | Non |
| Promoteur | Partage volontaire du SMS de débit | Non |
| Administrateur NAXA | Capture automatique du SMS de crédit ; partage manuel possible en secours | Oui, seulement avec consentement et autorisation Android |

Le rôle est déterminé par l'identité et les autorisations métier validées côté serveur, jamais par la simple présence d'une permission Android. Un compte ne doit pas gagner des capacités parce que l'utilisateur a installé l'APK ou coché une permission.

## D. Règles de sécurité et d'expérience

- L'intention de paiement doit exister avant le rapprochement : identifiant de commande/règlement, montant, devise FCFA, canal, bénéficiaire, référence de destination, payeur attendu et fenêtre de validité.
- Le partage d'un SMS est une entrée utilisateur non fiable : contrôler le contenu et ne jamais considérer son expéditeur déclaré par l'utilisateur comme authentifié.
- Le SMS de crédit est une seconde preuve indépendante seulement s'il provient de la capture Android autorisée du téléphone bénéficiaire ou d'un processus de validation manuelle explicite.
- Exiger une correspondance non ambiguë ; gérer idempotence, référence déjà consommée, montants différents, mauvaise destination, mauvais payeur, date hors fenêtre et messages incomplets.
- Les états doivent être explicites : preuve de débit reçue, crédit à confirmer, rapprochement en cours, confirmé, refusé, doublon, ambigu ou revue manuelle.
- La confirmation manuelle Pharmacie autorise la suite du flux métier mais doit rester auditée et pouvoir être révoquée/contestée selon les règles du paiement. Elle ne doit jamais être confondue avec une capture automatique du SMS.
- Le statut paiement confirmé déclenche les actions aval prévues, sans sauter la préparation du stock : la demande de livraison ne devient disponible qu'après les étapes normales de préparation / prêt au retrait.

## E. Plan de livraison

1. **Pilote immédiat** : partage volontaire du SMS Client et Promoteur ; confirmation manuelle par la Pharmacie ; capture automatique du crédit Admin ; secours par confirmation Admin manuelle ou partage volontaire de son SMS.
2. **Raccordements et preuves** : créer les intentions, entrées de preuve et associations aux commandes/règlements ; assurer les statuts visibles, les contrôles serveur, les traces d'audit, les tests doublons/ambiguïtés et la recette Android réelle.
3. **Évolution Pharmacie** : après au moins cinq mois de pilote, recueillir la confiance et les retours des pharmacies, puis implémenter la capture de SMS de crédit en option, appareil marchand enrôlé, sans imposer cette fonction.
4. **Confrontation automatique** : activer seulement lorsque les deux SMS sont authentifiés/fiables et que les tests opérateur/appareil montrent une correspondance déterministe.

## F. Écart constaté dans le code au moment de la décision

HEAD main inspecté : 1f12c17bc29537a43f77dbab2f3b8486821c9f92.

- L'API Promoteur actuelle /api/promoteur/paiements/capture est prévue pour une capture par compagnon enrôlé et exige notamment l'identifiant brut d'expéditeur ; elle n'est pas encore le parcours de partage volontaire non fiable décrit ci-dessus.
- Le compagnon Android actuel demande RECEIVE_SMS selon le consentement sans réserver cette permission au seul rôle Admin, et son récepteur accepte encore Promoteur et Admin.
- Le parcours de partage entrant Android (ACTION_SEND) n'est pas encore raccordé.
- L'API Admin possède déjà une capture crédit authentifiée et un rapprochement avec les règlements Promoteur, ainsi qu'un chemin de confirmation automatique ; le rapprochement doit être renforcé pour exiger la preuve Promoteur partagée selon la présente décision.
- Le parcours de paiement Client/Pharmacie doit être raccordé à cette décision et testé ; le présent document n'affirme pas qu'il est déjà implémenté.

**Statut : décision métier validée pour le pilote ; intégration code non certifiée.** Aucun déploiement Production, aucune migration Production et aucune activation de capture SMS Pharmacie ne sont autorisés par cette décision.
