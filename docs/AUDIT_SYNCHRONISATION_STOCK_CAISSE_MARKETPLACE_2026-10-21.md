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

## Corrections POS/ERP appliquées sur la base active

La dérive POS a été corrigée par restauration des fondations POS, puis réconciliation des migrations dépendantes. Les tables `caisses`, `caisses_sessions`, `ventes`, `vente_lignes`, `vente_paiements` et les RPC d'encaissement existent désormais sur la base active. Les migrations de caisse Marketplace 161–173, le parcours caisse 154–170, les correctifs lots 175–185, le périmètre caisse/assurance 187, les notifications et historiques 188–189, puis la disponibilité vendable 211 ont été appliqués après restauration de leurs dépendances manquantes. Les écarts de schéma ont été traités par des migrations de compatibilité additives, sans supprimer de données. Le socle des lots a aussi été réconcilié avec les migrations 042b/043, et la valorisation/inventaire avec la migration de compatibilité 217 plutôt que de rejouer la migration 047 non idempotente sur les tables déjà créées.

### Règle POS corrigée

- Un nouveau panier est un brouillon : `vente_ajouter_produit` ne décrémente ni `stocks.quantite` ni les lots.
- Un trigger transactionnel intercepte uniquement la transition `brouillon → payee` et déclenche le débit physique FEFO.
- La transaction de finalisation comprend le paiement, le débit des lots et du stock agrégé, puis le passage à `payee`. Toute erreur annule l'ensemble.
- Les anciens brouillons sont marqués comme historiquement débités pour éviter un double débit ; ils sont régularisés lors de leur retrait/abandon et ne peuvent pas recevoir de nouvelles lignes.
- Les lignes de vente conservent leur coût unitaire historique quand il est renseigné ; un coût inconnu reste NULL plutôt que de fabriquer une marge.
- La réservation Marketplace reste un hold temporaire : la disponibilité baisse à la réservation sans débit physique. Lors de l'encaissement, le hold est consommé et le stock physique est débité une seule fois. Une garde unique relie la réservation à sa vente payée.
- La disponibilité Marketplace exclut désormais les lots bloqués et expirés.
- Le texte de la caisse a été aligné : l'ajout au panier n'est plus présenté comme un débit physique.

### Migrations/correctifs de compatibilité ajoutés sur `main`

- `migration_215_pos_debit_at_finalization.sql` — déplacement du débit des ventes ordinaires à la validation finale et règles d'abandon/retrait compatibles.
- `migration_216_pos_debit_trigger_reentrancy_fix.sql` — évite la réécriture récursive de la vente dans le trigger de finalisation.
- `migration_217_inventory_valuation_compat.sql` — réconciliation de l'inventaire/valorisation avec les tables déjà créées ; coûts inconnus conservés comme inconnus.
- `migration_218_pos_preserve_frozen_cost.sql` et `migration_219_pos_preserve_frozen_cost_fix.sql` — préservation du coût figé lors de l'allocation FEFO.
- `migration_068_hierarchical_pharmacy_scope.sql` a été corrigée sur `main` pour conserver le nom et la valeur par défaut des paramètres de fonction déjà utilisés par la base active.

## Preuves de test exécutées sur la base active

Les scénarios ont été exécutés dans des transactions annulées ensuite : aucun panier, session, vente ou réservation de test n'a été conservé.

**PASS — vente ordinaire :**
1. Création d'une session et d'un brouillon POS.
2. Ajout d'un produit : stock physique et disponibilité Marketplace inchangés.
3. Encaissement final : vente passée à `payee`, stock physique diminué d'une unité, disponibilité Marketplace diminuée d'une unité.
4. Les assertions ont été rejouées après correction du trigger et après la réconciliation de valorisation.

**PASS — réservation Marketplace :**
1. Création du hold : stock physique inchangé et disponibilité Marketplace diminuée d'une unité.
2. Encaissement dans une session de caisse : stock physique diminué d'une unité.
3. La disponibilité Marketplace reste au niveau du hold précédent, sans double décrément.
4. La réservation passe à `payee` et son `consumed_by_vente_id` correspond à la vente créée.

**PASS —** le test `supabase/tests/215_pos_debit_at_finalization.sql` a été rejoué après les dernières réconciliations de lots, sans erreur. Le test existant `supabase/tests/212_reservation_holds_stock_service_inventory.sql` a également été rejoué après la restauration POS/ERP, sans erreur. Le comptage post-test confirme qu’aucune caisse de test n’a été conservée.

## Reste vérifiable

- Aucun déploiement n'a été lancé, conformément à la consigne.
- Le build, le lint et le typecheck frontend n'ont pas été exécutés dans cet environnement ; les modifications de texte de la page caisse ne sont donc pas présentées comme compilées.
- Le scénario SQL réel de vente ordinaire et de réservation a passé ses assertions, mais le parcours navigateur complet n'a pas été testé.
