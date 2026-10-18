# État du chantier — Parapharmacie, Bébé & Maman

**Mis à jour : 18 octobre 2026**  
**Branche de référence :** `main`  
**Dernier commit documenté avant cette mise à jour :** `a9061861c8a5ba7fda1e374c0532f14eaad31e90`

## Périmètre et règles

- Univers concernés : `parapharmacie` et `bebe-maman`.
- Les nouveaux produits restent en brouillon. La publication dépend du partenaire, de l'association partenaire-univers et de l'activation de l'univers.
- Le panier est local à l'appareil et les réservations sont regroupées par partenaire et univers.
- Le stock physique est décrémenté au retrait confirmé ; les mouvements restent journalisés et le stock ne peut pas devenir négatif.
- Aucun paiement en ligne ni service de livraison n'est ajouté à ces parcours.
- Préserver intégralement les tables et parcours historiques de la Pharmacie.
- Ne pas appliquer les migrations de ce chantier à Supabase Production sans autorisation explicite.

## Changements de code sur `main`

- `283ba8808aaa2a06ee84ead615915bc5420ed370` — suppression de séquences `\\n` littérales qui cassaient le JSX de la page du catalogue partenaire.
- `b27b18b23787582943916673df01cbd0497bf541` — aperçu CSV compatible avec les champs cités, séparateurs et retours à la ligne ; validation des quantités, seuils et dates ; messages d'import explicites.
- `493f989a74e3fe94b58786d8bb05dbd103de626f` — protection de l'export CSV contre les formules de tableur précédées d'espaces ou de caractères de contrôle.
- `3dec154143894a5382e8c73daff19c8f5481a40b` — migration additive 110 : expiration périodique des réservations multi-univers toutes les cinq minutes, sans toucher aux réservations Pharmacie.
- `d8be61d7934c5c9d9c6ada02d1c939422bad9de4` — migration additive 111 et RPC de lecture sécurisée des alertes stock/expiration ; les alertes ne sont plus limitées aux 200 produits récents affichés dans la liste.
- `a9061861c8a5ba7fda1e374c0532f14eaad31e90` — le panneau partenaire traite une réservation arrivée à expiration comme expirée et vérifie l'état réellement écrit après une transition pour ne pas afficher un faux succès.

## Migrations SQL à valider

- Les migrations 098 à 109 constituent les dépendances des univers, catalogues, réservations et créneaux d'examens.
- Migration 110 : `supabase/migration_110_universe_reservation_expiry_cron.sql`.
- Migration 111 : `supabase/migration_111_partner_catalogue_alerts.sql`.
- La migration 110 exige l'extension `pg_cron` et programme le job `naxa-expire-universe-reservations`.
- La migration 111 dépend de la colonne `low_stock_threshold` ajoutée en migration 105.
- Ces fichiers sont du code source uniquement : aucune de ces migrations n'a été appliquée à Production dans ce chantier.

## Vérifications et déploiement

- Tests ciblés du parseur CSV exécutés sur des exemples avec séparateur cité, guillemets échappés, retour à la ligne cité et guillemet non fermé : réussis.
- Compilation complète, lint et suite SQL : **à exécuter à la fin du codage**, conformément au canevas.
- Aucun déploiement manuel n'a été lancé pour ce chantier. Un push antérieur sur `main` a déclenché un déploiement Vercel automatique au commit `b27b18b23787582943916673df01cbd0497bf541`. Le projet Vercel a ensuite reçu un réglage d'étape ignorée pour empêcher les nouvelles publications automatiques pendant le codage ; vérifier/restaurer ce réglage avant le prochain déploiement autorisé.
- Ne pas annoncer le chantier comme validé en Production tant que les migrations n'ont pas été vérifiées sur un environnement de test, que la compilation/suite de tests n'a pas été exécutée et que le déploiement final n'a pas été explicitement autorisé.

## Prochaine étape

Terminer le codage du périmètre actuel, puis lancer en fin de chantier les vérifications de compilation, les tests SQL ciblés sur un environnement isolé et les contrôles des parcours. Aucun test ou migration ne doit écrire dans Supabase Production.
