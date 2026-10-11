# NAXA — Fonctions métier et validation pharmaceutique à distance

## État et règles

Cette spécification est une cible de conception sur la branche isolée `feat/naxa-fonctions-validation-distance`. Elle ne vaut pas preuve d'application SQL, de réussite CI ou de conformité réglementaire. La hiérarchie NAXA reste N0 Admin Réseau, N1 Promoteur, N2 Responsable, N3 Caisse, N4 Client. Les postes ci-dessous sont des fonctions internes, jamais de nouveaux niveaux hiérarchiques ni des valeurs de `role_type`.

Décisions verrouillées :
- cumul flexible de fonctions, sous contrôle de l'architecture, des privilèges et des conflits de séparation des tâches ;
- articulation Pharmacien / Responsable déterminée par la structure et les responsabilités légales applicables ;
- comptabilité complète dans le périmètre autorisé, avec audit et contrôles ;
- prescription, ordonnance et consultation nécessitant une validation pharmaceutique lorsque l'acte ou le processus applicable l'exige ;
- validation à distance par un pharmacien habilité, même hors site, sans validation automatique ni délégation de son identité ;
- aucun déploiement Production sans autorisation distincte.

## Fonctions, menus, parcours, privilèges

| Fonction interne | Menu / tableau de bord | Boucles et interactions | Privilèges cibles |
|---|---|---|---|
| Pharmacien | À valider, dossiers en attente, compléments demandés, historique et audit | Ouvrir dossier → consulter document privé → valider / refuser / demander complément → notifier l'équipe → journaliser | `VIEW_PHARMACEUTICAL_VALIDATIONS`, `VALIDATE_PHARMACEUTICAL_DOCUMENT`, `REQUEST_PHARMACEUTICAL_INFO`, `VIEW_PHARMACEUTICAL_AUDIT` |
| Préparateur / assistant | Accueil, commandes, dossiers à transmettre, demandes de complément | Accueillir → saisir le type et le contexte minimum → joindre document → soumettre → suivre la décision | `SUBMIT_PHARMACEUTICAL_VALIDATION`, accès aux seules demandes permises |
| Agent d'accueil et de dispensation | Accueil, commandes à traiter, suivi des demandes | Enregistrer la demande et joindre les pièces sans effectuer d'acte réservé ; transmettre au pharmacien | `SUBMIT_PHARMACEUTICAL_VALIDATION`, suivi borné par le périmètre |
| Responsable | Activité pharmacie, demandes bloquées, supervision et exceptions | Affecter les tâches → vérifier les délais → escalader ; ne peut pas remplacer la validation pharmaceutique | `VIEW_PHARMACEUTICAL_VALIDATIONS` et privilèges opérationnels déjà autorisés |
| Caisse | Encaissements, retraits, clôture et écarts | Traiter les étapes commerciales autorisées après les contrôles requis ; ne peut pas approuver une ordonnance | Privilèges de caisse existants ; aucun privilège de validation pharmaceutique par défaut |
| Comptable | Recettes, dépenses, rapprochements, écarts, pistes d'audit | Saisir / rapprocher → justifier → faire approuver les opérations sensibles par la personne désignée | Privilèges financiers explicites ; pas de validation pharmaceutique automatique |
| Gestionnaire de stock | Quantités, lots, mouvements, ruptures, péremptions | Vérifier → enregistrer les mouvements autorisés → signaler les écarts → demander une approbation si sensible | Privilèges de stock explicites ; pas d'effacement d'historique |
| Magasinier | Réceptions, rangement, mouvements à exécuter | Réceptionner → enregistrer → signaler les différences → attendre approbation selon le risque | Réception / mouvement autorisé ; pas d'approbation indépendante automatique |
| Promoteur | Réseau, équipes, délégations, performance | Affecter les fonctions autorisées → suivre l'activité de son réseau → traiter les alertes non réservées à NAXA | Délégation dans la convention et le scope ; aucune modification autonome de convention / tarif / architecture |
| Admin Réseau NAXA | Gouvernance, conventions, architectures, tarifs, sécurité réseau | Configurer → auditer → attribuer l'architecture → contrôler les délégations | Privilèges de gouvernance non délégables |
| Client | Recherche, disponibilités, réservations, suivi personnel | Rechercher → demander / réserver → recevoir le statut autorisé | Accès à ses propres données uniquement |

## Interactions de validation à distance

1. Un membre habilité de l'équipe crée un dossier brouillon dans le scope d'une pharmacie.
2. Le document est téléversé dans un stockage privé ; le chemin contient pharmacie et dossier, jamais un lien public.
3. La soumission vérifie que le document existe avant de passer à « en attente ».
4. Le pharmacien habilité ouvre le dossier depuis son tableau de bord, même hors site, avec authentification et contrôle du scope.
5. Il peut approuver, refuser ou demander un complément. L'absence de réponse ne vaut jamais approbation.
6. Toute décision enregistre l'auteur, l'heure, le statut, le commentaire et les transitions ; les pièces restent privées.
7. Les règles légales de dispensation, d'identité, de prescription et de consultation restent applicables. La fonctionnalité logicielle ne se substitue pas à une autorisation professionnelle.

## Partage des validations et séparation des tâches

Une action peut avoir plusieurs approbateurs possibles, mais le moteur doit préciser si la règle est « une approbation parmi les personnes habilitées » ou « approbations successives ». Pour les opérations sensibles, l'exécutant ne peut pas approuver sa propre demande lorsque la séparation des tâches est exigée. Les rôles qui ne sont pas pharmaciens ne peuvent pas décider d'une validation pharmaceutique.

## Compatibilité avec les architectures

- ORPHELIN : Promoteur + une Caisse ; fonctions internes cumulables sous garde-fous.
- PARENTS_ENFANTS : Promoteur + limites de Caisses configurées ; cumul autorisé par privilèges.
- PARENTS_AINES_CADETS : Responsables et Caisses selon les limites NAXA ; hiérarchie obligatoire.
- HYBRIDE : composition personnalisée sous contrôle NAXA.

Les fonctions internes ne créent pas de niveaux hiérarchiques supplémentaires. Le scope reste celui de la pharmacie ou du réseau autorisé. Une architecture ne confère jamais, à elle seule, un privilège professionnel.

## Contradictions à fermer avant fusion

1. Le catalogue `fonction_interne` de la migration 020 est plus restreint que les fonctions métier demandées.
2. Les clés de `naxa_role_privileges` et `naxa_architecture_privileges` sont contraintes ; l'extension doit rester distincte de `role_type`.
3. Correction candidate dans la migration 072 : `naxa_business_function()` et `naxa_has_privilege()` reconnaissent les nouvelles fonctions métier en maintenant les garde-fous d'architecture, de scope et de délégation. Le rejeu SQL complet doit encore prouver ce contrat.
4. Les documents médicaux ne doivent pas être accessibles via des URL publiques ou par tous les employés de la pharmacie sans nécessité.
5. Les fonctions de soumission et de décision doivent refuser l'auto-validation lorsque la séparation des tâches s'applique, ainsi que les dossiers hors scope.
6. Les tests doivent couvrir les quatre architectures, les profils sans privilège, le pharmacien hors site, les refus, les compléments, les documents absents et les tentatives de lecture inter-pharmacies.
7. Le README et le STATUT rappellent que `main` ne constitue pas la preuve canonique de l'intégration candidate et que les tests SQL/CI doivent être observés sur un rejeu propre.

## Gate de validation

Ne déclarer vert que si : audit des fichiers réels achevé, migration additive rejouée sur une base de test propre, tests SQL complets réussis, build/lint/TypeScript réussis, contrôle CI attaché au HEAD exact, RLS/Storage testés avec profils autorisés et non autorisés, README/STATUT actualisés. Aucun merge ni déploiement Production avant validation explicite de l'utilisateur.


## Correctif de sécurité du scope réseau — 11 octobre 2026
Un appel `private.naxa_has_privilege(privilege, pharmacie, 'RESEAU')` avec pharmacie explicite doit vérifier que cette pharmacie appartient au réseau actif du Promoteur via `public.naxa_scope_allows(uid, pharmacie, 'RESEAU')`. Sans pharmacie explicite, le droit `RESEAU` reste évalué sur le réseau du Promoteur et nécessite toujours une délégation active. Le test structurel 041b impose la présence de ce garde-fou; le test comportemental 024 vérifie le refus d'une pharmacie extérieure. Validation complète encore requise avant fusion.
