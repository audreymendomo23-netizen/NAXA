# Audit — synchronisation caisse, stock et Marketplace

Date : 21 octobre 2026  
Branche : `main`  
Déploiement : **aucun**  
Migrations appliquées : **aucune pendant cet audit**  
Build, lint, typecheck et tests SQL : **non exécutés**

## Résultat confirmé dans le code source

### Vente en boutique

La migration `057_pos_lignes_fefo.sql` définit `vente_ajouter_produit`. Elle verrouille la vente et la ligne de stock, puis :
- pour un produit lotisé, réserve les lots FEFO utilisables (non bloqués et non périmés), débite les lots et le stock agrégé dans la même transaction, et insère les lignes POS avec leur `lot_id`;
- pour un produit non lotisé, débite `stocks.quantite`;
- recalcule les totaux de la vente;
- laisse PostgreSQL annuler toute la transaction si une opération échoue.

Le parcours caisse appelle cette RPC dans `src/app/pharmacie/caisse/page.tsx`. Les réservations Marketplace encaissées au comptoir ne doivent pas débiter le stock une deuxième fois : cette règle est documentée dans `migration_161_caisse_reservation_atomic_payment.sql`.

### Écart trouvé

La recherche Caisse de la migration `063_caisse_pharmacien_barcode.sql` renvoyait la quantité agrégée de `stocks`, même quand une partie de cette quantité était bloquée ou périmée dans les lots. Le débit POS pouvait refuser ensuite la vente, mais la quantité affichée à la caisse n’était pas nécessairement vendable. Le débit POS historique ne refusait pas non plus explicitement un stock non lotisé dont `stocks.date_peremption` était passée.

La fiche Marketplace `src/app/offre/[pharmacieId]/[produitId]/page.tsx` lisait également directement `stocks.quantite`, sans calculer la somme des lots vendables ni se rafraîchir systématiquement quand le stock changeait.

## Correctifs préparés sur main

- `supabase/migration_210_marketplace_sellable_stock.sql` : ajoute `marketplace_offre_stock_disponible`, qui calcule la quantité utilisable à partir des lots non bloqués et non périmés, ou du stock agrégé non périmé si la référence n’est pas lotisée.
- `supabase/migration_211_pos_marketplace_sellable_stock.sql` : aligne la recherche Caisse (y compris codes-barres) sur cette disponibilité, et refuse la vente d’un stock non lotisé périmé.
- `src/app/offre/[pharmacieId]/[produitId]/page.tsx` : consomme la nouvelle RPC, s’abonne aux changements de stock et relit la disponibilité au retour sur la page.
- Tests structurels ajoutés : `supabase/tests/210_marketplace_sellable_stock.sql` et `supabase/tests/211_pos_marketplace_sellable_stock.sql`.

## Vérification en lecture seule de la base Supabase active

La base active a été interrogée sans écriture. Résultats :
- dernière migration enregistrée : `20261019161435`;
- les RPC publiques `vente_ajouter_produit`, `caisse_rechercher_produit` et `vente_encaisser_finaliser` ne sont pas présentes dans le schéma actif au moment de la lecture;
- `stocks_lots` ne contient actuellement que les colonnes historiques `pharmacie_id, produit_id, lot, peremption, quantite, updated_at`;
- `stocks` possède `date_peremption`.

Cela signifie que la chaîne ERP POS/stock préparée dans le dépôt n’est **pas encore déployée dans cette base**. La migration 210 dépend de la migration fondation `174_z_gestionnaire_stock_foundation.sql` et des migrations de lots qui ajoutent notamment `id`, `bloque` et `date_peremption`. Il ne faut donc pas appliquer 210 ou 211 isolément, ni déployer le frontend avant d’avoir appliqué et validé toute la chaîne de dépendances.

## Limites restantes

- Aucun test d’intégration n’a créé un stock de test pour prouver vente boutique → diminution du stock → disponibilité Marketplace.
- Aucune course concurrente caisse/réservation n’a été exécutée contre la base.
- La publication Realtime de `stocks` n’a pas été vérifiée; le rafraîchissement au focus/retour de visibilité constitue un repli, mais n’est pas une preuve de diffusion instantanée.
- Les tests SQL sont écrits mais n’ont pas été exécutés.

## Conclusion

**Le code POS existant prévoit bien le débit atomique du même stock que lit le Marketplace.** Des incohérences d’affichage sur les lots et un contrôle manquant sur le stock non lotisé périmé ont été corrigés dans les migrations 210–211 et dans la fiche d’offre.

Le statut opérationnel reste **non validé** tant que la chaîne de migrations n’est pas appliquée dans l’ordre, que les RPC sont présentes dans la base et que le scénario de bout en bout n’a pas été exécuté. Aucun déploiement n’a été lancé.
