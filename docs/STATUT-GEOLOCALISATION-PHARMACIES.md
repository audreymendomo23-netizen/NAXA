# NAXA — géolocalisation des pharmacies de Yaoundé

Date de collecte initiale : 11 octobre 2026  
Branche : `feat/yaounde-pharmacy-geolocation`  
Migration candidate : `supabase/migration_071_geolocalisation_pharmacies_yaounde.sql`

## Implémenté sur la branche

- Référentiel séparé `pharmacies_geolocalisation_referentiel`, avec nom publié, quartier, latitude, longitude, catégorie, URL de source, année de source et statut de vérification.
- 12 entrées de départ : 11 pharmacies humaines/vétérinaires référencées dans le tableau municipal de Yaoundé III et 1 fiche cartographique OpenStreetMap/Mapcarta.
- Ajout des métadonnées `geo_source_url`, `geo_statut` et `geo_mise_a_jour` à `public.pharmacies`.
- Rapprochement automatique limité au nom exact normalisé et à la ville Yaoundé. Aucune pharmacie n'est créée et aucune correspondance floue n'est autorisée.
- Les établissements vétérinaires ne sont pas rapprochés comme pharmacies humaines.
- Les coordonnées appliquées à une pharmacie existante sont marquées `source_publique_a_confirmer`; elles ne sont pas présentées comme vérifiées sur le terrain.
- RLS : lecture et modification du référentiel réservées à l'administrateur NAXA.
- Test statique ajouté : `npm run test:geolocalisation`; branchement dans CircleCI.

## Sources initiales

1. Commune de Yaoundé III, Plan communal de développement, tableau 19 « Pharmacie et laboratoire d'analyse », données attribuées au District de Santé de Yaoundé III (2022) : https://yaounde3.communes-du-cameroun.cm/wp-content/uploads/2023/06/PCD-CAY3.pdf
2. Pharmacie Camerounaise, fiche Mapcarta fondée sur OpenStreetMap, avenue Monseigneur Vogt : https://mapcarta.com/fr/W410241002

Les valeurs X/Y du document municipal sont interprétées comme longitude/latitude, puis stockées dans l'ordre attendu par NAXA : latitude puis longitude. Les coordonnées sont converties à partir des valeurs publiées, pas calculées depuis une adresse.

## Limites et critères de feu vert

- Les données municipales datent de 2022; la présence, le nom et la position doivent être reconfirmés.
- Une fiche cartographique peut être déplacée ou mal associée à une enseigne.
- Les résultats de cette recherche ne couvrent pas encore toutes les pharmacies de Yaoundé.
- Les pharmacies du référentiel ne deviennent pas automatiquement des partenaires, n'apparaissent pas dans la recherche de produits et ne reçoivent aucun stock.
- La migration n'a pas été appliquée à Supabase Production. Aucun déploiement ni changement de `main`.
- Le SQL replay local et les tests CircleCI doivent passer avant de considérer le code vert; une validation terrain reste obligatoire.

## Prochaines étapes

1. Vérifier les tests de qualité et SQL sur le dernier commit de cette branche.
2. Enrichir le référentiel avec des coordonnées numériques supplémentaires obtenues de sources cartographiques traçables.
3. Dédupliquer les alias et confirmer chaque position sur carte / par téléphone / sur le terrain.
4. Appliquer la migration uniquement à l'environnement de test après revue du schéma.
5. Faire valider chaque point avant de changer son statut vers `verifiee_terrain`.
