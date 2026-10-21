# Audit — synchronisation caisse, réservations et Marketplace

Date : 21 octobre 2026  
Branche : `main`  
Déploiement : **aucun**  
Migrations appliquées à la base active pendant cette intervention : `naxa_reservation_holds_stock_service_inventory_212`, `naxa_reservation_consumption_privileges_213` et `naxa_stock_service_role_guard_214`.

## Règle métier cible

- Une réservation crée un **hold temporaire**. Elle ne modifie pas la quantité physique dans `stocks` ni dans les lots.
- La quantité Marketplace vendable est le stock physique vendable moins les réservations actives non expirées.
- L’annulation et l’expiration libèrent le hold ; elles ne réajoutent pas de stock pour les nouvelles réservations.
- Une vente ne devient un mouvement physique qu’à sa validation par la caisse.
- Une réservation consommée doit être reliée à une vente et ne peut être consommée deux fois.
- L’inventaire de prise et de fin de service doit être horodaté par gestionnaire. Les écarts sont tracés et ne modifient pas silencieusement le stock.

## Migrations appliquées sur la base active

### Migration 212 — holds de réservation et inventaire de service

Fichier : `supabase/migration_212_reservation_holds_stock_service_inventory.sql`.

- Ajoute des marqueurs de compatibilité pour les réservations historiques qui ont déjà décrémenté physiquement le stock.
- Remplace `private.reserve_stock` : verrouille les références en ordre déterministe, calcule le stock disponible après holds actifs, crée une réservation sans décrémenter la quantité physique.
- Remplace `public.restore_stock` : ne restaure que les anciennes réservations physiquement débitées, une seule fois, et jamais une réservation déjà consommée.
- Remplace `marketplace_offre_stock_disponible` : soustrait les réservations actives non expirées du stock physique vendable.
- Crée `stock_service_sessions` et `stock_service_inventory_counts`, avec les RPC d’ouverture, de comptage et de clôture de service.

### Migration 213 — garde de privilèges

Fichier : `supabase/migration_213_reservation_consumption_privileges.sql`.

- Retire aux rôles clients l’exécution directe de `consume_reservation_for_sale`. Cette fonction ne doit être appelée que depuis une transaction de caisse de confiance.

### Migration 214 — restriction du poste de service

Fichier : `supabase/migration_214_stock_service_role_guard.sql`.

- Restreint l’ouverture d’un service aux comptes admin/promoteur autorisés ou aux fonctions internes `gestionnaire_stock` et `magasinier`, avec vérification du périmètre pharmacie.

## Vérification réelle exécutée sur la base active

Un scénario transactionnel a utilisé une pharmacie, un produit et un compte existants. La transaction a ensuite été annulée pour ne conserver aucune donnée de test.

Résultat : **PASS** pour les assertions suivantes :

1. La création d’une réservation laisse la quantité physique inchangée.
2. La disponibilité Marketplace diminue d’une unité réservée.
3. L’annulation libère la réservation sans augmenter la quantité physique.
4. L’ouverture de service, le comptage d’ouverture, le comptage de fermeture et la clôture fonctionnent.
5. Les tests structurels `supabase/tests/212_reservation_holds_stock_service_inventory.sql` passent sur le schéma actif.

Le compte actif ne possède actuellement pas de tables `public.ventes`, `public.caisses_sessions` ou des RPC de caisse attendues (`vente_encaisser_finaliser`, `vente_reservation_encaisser`). Elles ont été vérifiées via le catalogue PostgreSQL et sont absentes. Il est donc impossible d’exécuter honnêtement un scénario de bout en bout caisse → vente validée → stock → Marketplace sur cette base, tant que la chaîne POS manquante n’a pas été appliquée.

## Inventaire de prise et fin de service — interface

La page `/pharmacie/gestionnaire-stock/service` a été raccordée aux nouvelles RPC :

- ouverture horodatée par gestionnaire et pharmacie ;
- comptage physique initial obligatoire ;
- comptage physique final obligatoire ;
- clôture refusée tant que les quantités requises ne sont pas saisies ;
- écarts affichés/tracés, sans ajustement physique automatique ;
- historique des services clôturés.

Les routes de navigation existantes contiennent déjà « Prise / fin de service » et « Inventaires ».

## Correctif de caisse Marketplace préparé mais non appliqué

Le fichier source `supabase/migration_161_caisse_reservation_atomic_payment.sql` a été corrigé pour que l’encaissement d’une réservation récente débite le stock physique pendant la transaction de caisse, en respectant les lots FEFO et en liant la réservation à une seule vente. Il conserve une branche de compatibilité pour les réservations historiques déjà débitées.

Cette migration n’a **pas** été appliquée à la base active : ses tables POS dépendantes n’existent pas encore dans cette base.

## Blocages et vérifications restantes

- **La chaîne complète des migrations POS/ERP n’a pas été appliquée.** La base active est en dérive par rapport au dépôt et ne contient pas le socle POS. Appliquer 161, 174, 210 ou 211 isolément n’est pas sûr.
- Le scénario caisse complet n’a pas pu être lancé, car la vente, la session de caisse et la fonction d’encaissement sont absentes.
- Le parcours POS ordinaire doit encore être aligné pour que l’ajout d’un produit au brouillon ne soit pas un débit physique anticipé : le débit doit se produire à la validation finale de la vente, dans la même transaction que le paiement et la consommation d’un éventuel hold.
- Aucun build, lint ou typecheck du frontend n’a été exécuté dans cet environnement.
- Aucun déploiement n’a été lancé.

## Conclusion

Les nouvelles règles de réservation et l’inventaire par service sont **appliqués et testés sur la base active**. La synchronisation de bout en bout avec la caisse ne peut pas être déclarée verte : le socle POS manque dans la base active, et le débit des ventes POS ordinaires doit encore être déplacé de l’ajout au panier vers la validation finale avant que la règle métier soit intégralement respectée.
