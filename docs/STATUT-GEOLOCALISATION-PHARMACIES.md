# NAXA — géolocalisation des pharmacies de Yaoundé

Date de collecte initiale : 11 octobre 2026  
Branche : `main` (intégration du référentiel et du GPS navigateur)  
Migration candidate : `supabase/migration_071_geolocalisation_pharmacies_yaounde.sql`

## Implémenté sur la branche

- Référentiel séparé `pharmacies_geolocalisation_referentiel`, avec nom publié, quartier, latitude, longitude, catégorie, URL de source, année de source et statut de vérification.
- 12 entrées de départ : 11 pharmacies humaines/vétérinaires référencées dans le tableau municipal de Yaoundé III et 1 fiche cartographique OpenStreetMap/Mapcarta.
- Ajout des métadonnées `geo_source_url`, `geo_statut` et `geo_mise_a_jour` à `public.pharmacies`.
- Rapprochement automatique limité au nom exact normalisé et à la ville Yaoundé. Aucune pharmacie n'est créée et aucune correspondance floue n'est autorisée.
- Les établissements vétérinaires ne sont pas rapprochés comme pharmacies humaines.
- Les coordonnées appliquées à une pharmacie existante sont marquées `source_publique_a_confirmer`; elles ne sont pas présentées comme vérifiées sur le terrain.
- RLS : lecture et modification du référentiel réservées à l'administrateur NAXA.
- Test statique : `npm run test:geolocalisation` (GPS, migration et API de synchronisation OSM). Aucun contrôle CircleCI/Netlify n'est requis.

## Sources initiales

1. Commune de Yaoundé III, Plan communal de développement, tableau 19 « Pharmacie et laboratoire d'analyse », données attribuées au District de Santé de Yaoundé III (2022) : https://yaounde3.communes-du-cameroun.cm/wp-content/uploads/2023/06/PCD-CAY3.pdf
2. Pharmacie Camerounaise, fiche Mapcarta fondée sur OpenStreetMap, avenue Monseigneur Vogt : https://mapcarta.com/fr/W410241002

Les valeurs X/Y du document municipal sont interprétées comme longitude/latitude, puis stockées dans l'ordre attendu par NAXA : latitude puis longitude. Les coordonnées sont converties à partir des valeurs publiées, pas calculées depuis une adresse.

## Synchronisation OSM ajoutée sur `main`

- Endpoint administratif `POST /api/admin/geolocalisation-osm` : interroge Overpass pour les pharmacies cartographiées dans Yaoundé et enregistre les candidats dans le référentiel, sans créer de partenaires.
- `GET /api/admin/geolocalisation-osm` : retourne l'état de la dernière synchronisation, le nombre de candidats à confirmer et le nombre de partenaires de Yaoundé sans coordonnées.
- Protection par session Supabase et `public.is_admin()`; la clé `SUPABASE_SERVICE_ROLE_KEY` reste exclusivement côté serveur.
- Une seule synchronisation par 24 heures grâce à un état persistant Supabase; la collecte n'est pas déclenchée à chaque recherche client.
- Rapprochement par nom complet normalisé (accents/ponctuation), uniquement pour les partenaires de Yaoundé dont latitude ET longitude sont absentes. Les coordonnées déjà présentes, même partielles, sont préservées.
- Les annonces vétérinaires sont exclues. Les candidats OSM ne deviennent jamais des partenaires.
- Les coordonnées importées restent `source_publique_a_confirmer`; attribution : © OpenStreetMap contributors — ODbL.

## Limites et mise en service

1. Appliquer `supabase/migration_072_geolocalisation_osm.sql` dans l'environnement Supabase ciblé avant d'appeler l'endpoint.
2. La synchronisation couvre seulement les objets OSM présents dans la zone cartographique ciblée; elle n'est pas exhaustive.
3. La synchronisation Overpass ne se lance que sur action administrative, au plus une fois toutes les 24 heures. Aucun géocodage Nominatim répétitif ni collecte lors d'une recherche client.
4. Les correspondances exactes restent à confirmer sur carte et sur le terrain avant tout passage à `verifiee_terrain`.
5. La migration n'a pas été exécutée en Production et aucun déploiement n'a été lancé.

## Carte interactive du tableau de bord — correction

- Le bloc illustratif du tableau de bord a été remplacé par `CartePharmaciesProches`, une carte Leaflet alimentée par les tuiles OpenStreetMap.
- Les marqueurs et la liste utilisent le même identifiant partenaire Supabase. Sélectionner une ligne centre la carte et ouvre la fiche du marqueur correspondant; la carte ajuste son cadrage aux coordonnées présentes.
- Le GPS est demandé uniquement après action du client. En cas de refus, d'indisponibilité ou d'échec, un message explicite est présenté et la liste reste accessible.
- Les partenaires sans coordonnées restent identifiables dans la liste avec « GPS indisponible »; aucune coordonnée n'est inventée. Les candidats OSM ne sont jamais affichés comme partenaires.
- Attribution cartographique affichée : © OpenStreetMap contributors. La carte ne prouve pas la disponibilité des médicaments.
- Migrations `migration_072_geolocalisation_osm` et `migration_073_geolocalisation_rls_policy_scope` appliquées au projet Supabase Naxa actif. Les politiques RLS du référentiel sont limitées à `authenticated` avec `public.is_admin()`.
- Contrôle SQL direct après migration : tables du référentiel présentes; colonnes géographiques de `pharmacies` présentes; une ligne de contrôle de synchronisation; quatre politiques administrateur authentifié. Au moment du contrôle, 3 partenaires visibles, tous les 3 avec latitude et longitude; aucun candidat OSM importé.
- Vérification statique de la liaison carte/liste et du nettoyage des marqueurs effectuée. Le build TypeScript/Next.js et le test Node complet n'ont pas pu être exécutés dans cet environnement. Le statut CircleCI reste en échec sur une vérification préexistante de comptage des migrations (le script attend 96 fichiers, tandis que le répertoire en contient 265); ce statut n'est pas présenté comme vert.
- Aucun déploiement effectué.
