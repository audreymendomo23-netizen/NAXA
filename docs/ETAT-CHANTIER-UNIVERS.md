# État du chantier — Parapharmacie, Bébé & Maman

**Mis à jour : 18 octobre 2026**  
**Branche de référence :** `main`  
**Dernier commit documenté avant cette mise à jour :** `8f28004138a2c3ceee137125d98994b120b919fe`

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
- `c112b41a298c23e66bfda9ee05ec55d9996862d2` et `a7c70029c3dd41766d5808512c6146bfef74ca3a` — socle SQL des prestations à domicile : offres, demandes, coordonnées séparées et adresse exacte masquée jusqu’à confirmation ; accès direct aux écritures de demandes bloqué.
- `19c1b593fb9f28cc6db32b5615336e276804fdd7` — actions serveur pour envoyer une demande et l’annuler.
- `fce1aa9094c93896e055f38e18fb1011effccb40` — intégration des demandes à domicile dans l’espace client unique « Achats / Réservations / Commandes », sans bloquer le suivi Pharmacie si les tables de prestations ne sont pas encore installées.
- `d2baaa27e694abe4f5b003078bc6d386fc78a8ff` — cloche de notifications visible dans l’espace partenaire Prestations.
- `e2fc6bf4ca98dd7fe09b9b70ec07de361d834d0a` — migration 114 : notification in-app aux responsables du partenaire à la création d’une demande, et au client/partenaire lors des changements de statut, sans inclure l’adresse exacte dans le message.
- `c54c2f34621364bfbcf3932b97448b5fc893f307` et `39155462805398339504a477be706e8e78973f95` — migration 115 et interface de notifications : le destinataire peut marquer les notifications de prestations comme lues, et le badge est mis à jour sans toucher aux notifications historiques de la Pharmacie.
- `8963e5e77636a91808632b80f85573e284104106` — migration 113 : le partenaire ne peut plus publier directement une offre en contournant la validation administrative.
- `cf231cc6ab8140fc12dba0738901e769833d3d84` et `9e3645a0503d36906b3cd443e254e238380748a1` — catalogue public, formulaire de demande et reçu privé client.
- `6d3c94700fdeb29b1cf75667262428e0479928f6`, `18dcc1652223f33df35603f7b7bd19a1671ff78d`, `f8d83c18ad8833e8b14726af57cfa181c8954570`, `09950f9fcdd1c145441448a6e983dfcfe21703e6`, `8f28004138a2c3ceee137125d98994b120b919fe` — espace partenaire, validation administrative, navigation conditionnelle et verrouillage du type de partenaire.

## Migrations SQL à valider

- Les migrations 098 à 109 constituent les dépendances des univers, catalogues, réservations et créneaux d'examens.
- Migration 110 : `supabase/migration_110_universe_reservation_expiry_cron.sql`.
- Migration 111 : `supabase/migration_111_partner_catalogue_alerts.sql`.
- Migration 112 : `supabase/migration_112_home_services_requests.sql`.
- Migration 113 : `supabase/migration_113_home_service_offer_publish_guard.sql`.
- Migration 114 : `supabase/migration_114_home_service_notifications.sql`.
- Migration 115 : `supabase/migration_115_mark_user_notification_read.sql`.
- La migration 110 exige l'extension `pg_cron` et programme le job `naxa-expire-universe-reservations`.
- La migration 111 dépend de la colonne `low_stock_threshold` ajoutée en migration 105.
- La migration 112 ajoute le socle des prestations à domicile ; elle dépend du socle partenaires/universes, notamment de la fonction `universe_partner_is_public` (migration 100).
- La migration 113 remplace la politique trop large d’écriture partenaire sur les offres : création en brouillon uniquement, modification/archivage possible, publication réservée à la fonction administrative.
- La migration 114 réutilise les notifications de la migration 075 ; les notifications ne contiennent jamais l’adresse exacte ni le téléphone du client.
- La migration 115 n’autorise le marquage que pour une notification dont l’utilisateur est le destinataire ; l’interface limite cette action aux notifications `home_service_request`.
- Ces fichiers sont du code source uniquement : aucune de ces migrations n'a été appliquée à Production dans ce chantier.

## Vérifications et déploiement

- Tests ciblés du parseur CSV exécutés sur des exemples avec séparateur cité, guillemets échappés, retour à la ligne cité et guillemet non fermé : réussis.
- Compilation complète, lint et suite SQL : **à exécuter à la fin du codage**, conformément au canevas.
- Aucun déploiement manuel n'a été lancé pour ce chantier. Un push antérieur sur `main` a déclenché un déploiement Vercel automatique au commit `b27b18b23787582943916673df01cbd0497bf541`. Le projet Vercel a ensuite reçu un réglage d'étape ignorée pour empêcher les nouvelles publications automatiques pendant le codage ; vérifier/restaurer ce réglage avant le prochain déploiement autorisé.
- Ne pas annoncer le chantier comme validé en Production tant que les migrations n'ont pas été vérifiées sur un environnement de test, que la compilation/suite de tests n'a pas été exécutée et que le déploiement final n'a pas été explicitement autorisé.

## Prochaine étape

Terminer le codage du périmètre actuel (prestations à domicile : parcours partenaire/client, notifications de demande et publication), puis lancer en fin de chantier les vérifications de compilation, les tests SQL ciblés sur un environnement isolé et les contrôles des parcours. Aucun test ou migration ne doit écrire dans Supabase Production.
