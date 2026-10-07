# NAXA — Pilotage 360° — Partie 1 : audit canonique

Date : 07/10/2026  
Branche : `rewrite/naxa-from-main-20261007`  
Base : `main` SHA `82d2145cea6d6d162405c3e74d3f21400ba5b763`  
Clôture Promoteur : `4d8fb7c43ebc8642e644e96aeec4f37969c93a82`

## 1. Méthode

Audit sans codage métier :
1. Cahier V3.7 comme cible produit ;
2. GitHub comme réalité technique ;
3. migrations/tests canoniques 043→048 comme socle de gouvernance Promoteur ;
4. documentation comme position de reprise ;
5. séparation stricte entre **source de donnée**, **KPI**, **scope**, **rôle**, **action corrective**.

Aucune migration Production n'est autorisée par cette partie.

## 2. Périmètres canoniques du Pilotage 360°

Le Pilotage 360° est organisé en quatre couches, sans multiplier les moteurs de calcul :

| Couche | Finalité | Sources canoniques déjà identifiées | État audit |
|---|---|---|---|
| Commercial | activité, réservations, CA, réseau, offre | `reservations`, `reservation_items`, `v_reservations_ca`, pharmacies/réseau | SOCLE EXISTANT |
| Performance | stock, disponibilité, activité opérationnelle, qualité de service | `stocks`, `pharmacies`, réservations, données temporelles | SOCLE PARTIEL |
| Sécurité / réseau | validité Promoteur, périmètre réseau, privilèges, sessions et événements de sécurité | gouvernance 043→048, `promoteur_pharmacies`, privilèges | SOCLE GOUVERNANCE EXISTANT |
| Direction 360° | vue consolidée NAXA, sans nouveau moteur métier | agrégation des trois couches précédentes | À CONSTRUIRE |

## 3. Matrice KPI canonique

| KPI / famille | Définition de référence | Source de vérité | Scope | Rôles |
|---|---|---|---|---|
| CA | somme du CA canonique, sans double comptage | `v_reservations_ca` | réseau autorisé | N0/N1/N2/N3 selon privilège |
| Réservations | événements de réservation selon statut/période | `reservations` | réseau/pharmacie | selon scope |
| Pharmacies actives | pharmacies actives et rattachées au réseau autorisé | `pharmacies` + `promoteur_pharmacies` | réseau | N0/N1 |
| Stock disponible | stock positif exploitable | `stocks` | pharmacie/réseau | selon scope |
| Fraîcheur stock | `stock_updated_at` / `stocks.updated_at` selon définition retenue | stock/pharmacie | pharmacie/réseau | selon privilège |
| Validité Promoteur | convention + abonnement Promoteur + réseau actif selon moteur canonique | `private.naxa_promoteur_valide_canonique()` | Promoteur | N0/N1 |
| Privilèges effectifs | privilège actif, architecture, niveau et scope | `naxa_profile_privileges` + moteur `naxa_can()` | utilisateur/réseau/pharmacie/poste | N0/N1/N2/N3 |
| Sécurité / sessions | événements de sécurité autorisés et traces sans exposition de secrets | modèle sécurité/session à confirmer dans la DB réelle | scope autorisé | N0/N1 selon privilège |
| Direction 360° | consolidation des KPI précédents, jamais recalcul parallèle | vues/fonctions KPI canoniques | N0 | N0 |

## 4. Contradictions recherchées

### C1 — Double moteur CA
**Résultat : corrigé avant ce chantier.**  
Le CA Promoteur doit rester basé sur `v_reservations_ca`. Aucun second calcul concurrent ne doit être créé.

### C2 — Scope réseau
**Résultat : corrigé en Partie 5.**  
Le scope `RESEAU` conserve `pharmacie_id = NULL`.

### C3 — Expiration Promoteur
**Résultat : corrigé en Partie 6.**  
La validité utilisée par le moteur de privilèges dépend du canonique Promoteur, et non de l'ancien abonnement par pharmacie.

### C4 — Responsable comme rôle
**Résultat : corrigé en Partie 2.**  
Responsable est une fonction interne N2, pas une nouvelle valeur de `role_type`.

### C5 — Pilotage hors périmètre
**Résultat : règle verrouillée.**  
Un KPI réseau ne peut jamais lire une pharmacie inactive ou hors du réseau autorisé du Promoteur.

### C6 — KPI sans source de vérité
**Résultat : BLOQUANT LE CODAGE, mais pas l'audit.**  
Tout nouveau KPI doit être ajouté avec définition, source, formule, scope, rôle, période et test contradictoire. Cette matrice devient le contrat préalable aux Parties suivantes.

## 5. Gaps fonctionnels identifiés — à traiter dans les prochaines parties

Les éléments suivants sont des **travaux à construire**, pas des contradictions à masquer :
- KPI de performance détaillés ;
- couche sécurité/réseau exploitable en pilotage ;
- agrégateur Direction 360° ;
- tests contradictoires par rôle et par scope ;
- exposition UI des KPI selon les privilèges.

Aucun de ces gaps ne justifie de réintroduire un second moteur CA ou un contournement du moteur `naxa_can()`.

## 6. Critère de sortie de la Partie 1

La Partie 1 est considérée verte lorsque :
- le périmètre est découpé sans chevauchement ;
- chaque KPI existant possède une source canonique identifiée ;
- les contradictions connues des Parties 2→6 sont réconciliées ;
- les gaps futurs sont explicitement séparés des blocages ;
- aucune implémentation n'est lancée prématurément ;
- la prochaine partie peut être construite sans ambiguïté de source ou de scope.

**Résultat : 🟢 VERT — 100 %.**

## 7. Prochaine étape

**Partie 2 — Audit/correction du socle Performance**, avec inventaire exact des données disponibles, définition des KPI de performance, tests contradictoires et validation transactionnelle avant toute persistance.

`main` et Production restent inchangés.
