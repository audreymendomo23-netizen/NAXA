# NAXA — Recette pilote pharmacies et utilisateurs

**Date :** 5 novembre 2026  
**Référence de départ :** `main` — `feb221e79714e6034f3ac303acde4ff9da1700ad`  
**État documentaire courant :** `main` — correction POS privée préparée à partir du HEAD `86ac0c92e2a0b61857059fb08dc9f16c0a1f43e3`  
**Décision :** 🟡 recette technique Replay réussie sur le périmètre couvert ; recette terrain avec de vraies pharmacies et des utilisateurs externes non réalisée et non certifiable à cette date.

## 1. Environnements et preuves observés

- Le dépôt privé `audreymendomo23-netizen/NAXA` est sur la branche `main`.
- Vercel a fourni un déploiement `READY` pour le HEAD initial `feb221e79714e6034f3ac303acde4ff9da1700ad` : [Preview NAXA](https://naxa-3tdvwkezq-naxa3.vercel.app). Ce déploiement précédait les commits documentaires et de test de cette recette ; aucun nouveau déploiement n'a été déclenché.
- Supabase Replay est actif. Les vérifications en lecture seule de ses données ont trouvé **9 pharmacies, toutes marquées démo** (`est_demo=true` : 8 visibles dans la recherche, 1 non visible), **un seul profil Admin actif**, aucune affectation professionnelle et aucune réservation.
- Ce jeu de données ne contient donc pas de pharmacie partenaire réelle ni de comptes Client, Pharmacien, Caisse, Responsable, Gestionnaire de stock ou Livreur permettant une recette représentative.

## 2. Scénarios techniques exécutés

Tous les tests ci-dessous ont été exécutés sur Supabase Replay, jamais sur Supabase Production.

| Test | Couverture | Assertions | Résultat |
|---|---|---:|---|
| `295_active_role_strict_scope.sql` | Poste actif, séparation des pharmacies, retour Client, droits Livreur | 11 | PASS |
| `296_active_role_stock_caisse_and_pilotage.sql` | Stock, Caisse et suspension des droits Admin hors poste Admin | 6 | PASS |
| `297_active_role_pharmacien_e2e.sql` | Consultation, prescription, export audité et scope Pharmacien | 8 | PASS |
| `298_active_role_stock_inventory_and_admin_metrics.sql` | Service Stock, inventaire et garde Admin | 7 | PASS |
| `299_active_role_responsable_comptable.sql` | Délégation Responsable et service Comptable | 4 | PASS |
| `284_offline_pos_sales_e2e_replay.sql` | Vente hors ligne, idempotence, conflit prix/stock et clôture | — | PASS après correction du fixture |

**Total : 36 assertions PASS** sur les tests 295 à 299.

### Résultat E2E POS hors ligne — test 284

La recette a révélé une cause racine métier : le POS réutilisait `marketplace_offre_stock_disponible`, qui applique les filtres de publication publique (pharmacie visible, non-démo et stock actualisé depuis moins de 48 h). Ces filtres sont légitimes pour le Marketplace mais ne doivent pas bloquer les ventes internes d'une pharmacie active non publiée.

Le correctif proposé ajoute le helper privé `private.naxa_pos_stock_vendable` et rebranche quatre consommateurs POS (recherche simple/code-barres, ajout au panier et débit à l'encaissement). Le helper conserve les garde-fous pharmacie active/non archivée, lots bloqués/périmés et réservations actives. Le test 284 est réaligné pour garder `est_demo=true` et `visible_recherche=false`, sans modifier `fiche_validee`.

**Résultat du test corrigé :**
- Vente appliquée : **4 700 FCFA**.
- Montant reçu : **5 000 FCFA** ; monnaie rendue : **300 FCFA**.
- Stock : **52 → 51** ; une seule vente payée.
- Clôture : **14 700 FCFA théoriques / 14 700 FCFA comptés**, écart **0 FCFA**.

**Contrôle post-rollback :** `est_demo=true` restauré ; zéro ligne de vente offline, zéro caisse F07, zéro appareil F07 et zéro session ouverte F07. Aucune donnée de test persistante.

## 3. Défauts et réserves résiduels

| Priorité | Constat | Conséquence / traitement |
|---|---|---|
| Bloquant terrain | Aucune pharmacie réelle ni cohorte d'utilisateurs représentatifs dans Replay ; uniquement des fixtures démo et un profil Admin. | Impossible de signer une acceptation métier terrain. Il faut des comptes volontaires rattachés à au moins une pharmacie réelle. |
| P1 — correction en validation | Les quatre consommateurs POS doivent utiliser la disponibilité interne, pas le filtre Marketplace public. | Migration `20261115205000` et tests Replay 284/`20261115205000_pos_internal_stock_scope.sql` à exécuter avant la clôture. La recette terrain avec une vraie pharmacie demeure indépendante. |
| P1 si livraison au lancement | Le poste Livreur est attribuable/sélectionnable mais reste informatif, sans workflow opérationnel ni action de livraison. | Ne pas inclure la livraison réelle dans le périmètre accepté tant que l'affectation, la prise en charge, les transitions, la preuve de remise et les droits ne sont pas livrés et testés. |
| À certifier | Recette UI mobile/navigateur, caméra, galerie, PDF, scanner, réservation et parcours de caisse avec JWT réels non exécutés dans cette passe. | Aucun résultat de test physique ou d'acceptation utilisateur ne peut être revendiqué. |
| À certifier | `npm test`, typecheck global, lint et build Next.js non exécutés sur le HEAD courant. | La qualité globale du commit n'est pas certifiée par cette recette ciblée. |

Le déploiement Preview était `READY`, mais le lecteur Web n'a pas pu ouvrir la Preview et l'environnement d'exécution ne disposait ni de `vercel`/`vc` ni de `agent-browser`. Aucun test de navigateur authentifié n'est donc déclaré.

## 4. Matrice de recette terrain à clôturer

À exécuter avec des comptes volontaires et des données métier de test autorisées, sur Preview et sans toucher à la Production :

| Profil représentatif | Parcours à accepter |
|---|---|
| Promoteur / Responsable de pharmacie | Activation, équipe, affectations et séparation stricte des pharmacies |
| Pharmacien | Consultation, prescription, disponibilité, traçabilité |
| Caisse | Ouverture, vente, paiement, reçu, clôture et reprise offline |
| Gestionnaire de stock | Réception, inventaire, lot, péremption et correction autorisée |
| Client adulte | Inscription/OTP, recherche, comparaison, favoris, scanner et réservation |
| Livreur (si livraison au lancement) | Prise en charge, statut, remise et preuve de livraison — parcours non livré à ce jour |

Pour chaque scénario, conserver : profil et pharmacie de test (sans publier de donnée personnelle), appareil/navigateur, étapes, résultat attendu/réel, horodatage, capture ou identifiant de trace, sévérité, reproduction, correctif et re-test. Critères de sortie : aucun défaut bloquant, aucun accès inter-pharmacies, stock et paiements cohérents, consentements respectés, et validation explicite des représentants concernés.

## 5. Limites de cette clôture

- **Fait :** 36 assertions SQL réussies ; test 284 réparé et rejoué avec succès ; fixture Replay restaurée après rollback ; rapport ajouté au dépôt.
- **Non fait :** aucune pharmacie réelle ni aucun utilisateur externe n'a participé ; aucune acceptation terrain, aucun test navigateur/appareil, aucune CI/build global ni certification Production.
- **Production :** aucune écriture Supabase Production et aucun déploiement/promotion Vercel déclenché.

**Statut final de cette passe :** 🟢 contrôles SQL ciblés couverts ci-dessus ; 🟡 recette terrain, UI et qualité globale encore ouvertes. Le projet n'est pas déclaré « pilote terrain validé ».
