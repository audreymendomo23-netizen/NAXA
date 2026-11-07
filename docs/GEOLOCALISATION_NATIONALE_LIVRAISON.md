# Géolocalisation nationale et livraison NAXA

État de construction sur la branche QA `qa/e2e-stabilisation-20261106`. Les changements Replay sont isolés de Supabase Production et aucun déploiement Vercel n'est effectué.

## Fonctionnement géographique

- Le GPS client est lu dans l'application web/PWA avec l'autorisation du navigateur.
- `GET /api/pharmacies/proches?lat=...&lng=...` interroge le réseau des pharmacies partenaires actives, visibles, non démo, non archivées et dotées de coordonnées GPS.
- La lecture est paginée par lots de 1 000; la recherche n'est pas limitée à Yaoundé ni à un rayon arbitraire de 30 km.
- Les pharmacies candidates sont présélectionnées par distance à vol d'oiseau, puis reclassées par distance routière lorsque le fournisseur d'itinéraire répond.
- Le résultat inclut distance routière, durée estimée, éligibilité de livraison et un lien Google Maps fondé sur l'origine GPS et la destination pharmacie.
- Aucune pharmacie sans coordonnées ne reçoit de position inventée; elle ne peut pas être classée par distance.

## Fournisseurs de route

Ordre :
1. Google Routes API `computeRouteMatrix` si `GOOGLE_MAPS_ROUTES_API_KEY` ou `GOOGLE_MAPS_API_KEY` est configurée côté serveur.
2. OpenStreetMap / OSRM en repli si la clé Google manque ou si le fournisseur Google ne répond pas.
3. Si les deux fournisseurs échouent, aucune distance ou tarification routière fictive n'est fournie.

Configurer `NAXA_ROUTING_URL` pour un service OSRM administré par NAXA; à défaut, le service OSRM public est utilisé comme solution de repli et n'offre aucune garantie de SLA.

Les clés Google restent exclusivement côté serveur. Ne pas utiliser de variable `NEXT_PUBLIC_`.

## Calcul du prix de livraison

`POST /api/livraison/devis` authentifie le client, vérifie la pharmacie et son rayon de livraison, demande un itinéraire routier, puis stocke un devis à usage unique qui expire après 10 minutes.

Règle tarifaire approuvée le 7 novembre 2026 :
- Base de calcul : 1 500 FCFA;
- + 200 FCFA par kilomètre routier;
- minimum facturé au Client : 1 500 FCFA;
- maximum facturé au Client : 3 500 FCFA;
- commission NAXA fixe : 500 FCFA par livraison terminée;
- solde affecté au service de livraison : tarif Client moins 500 FCFA.

Exemple : à 1,5 km par la route, le Client voit 1 800 FCFA; 500 FCFA sont comptabilisés comme commission NAXA et 1 300 FCFA constituent le solde affecté à la livraison. La commission ne doit pas apparaître dans les écrans Client. Les espaces Administration et Promoteur utilisent le rapport dédié pour suivre les commissions acquises, réglées et restant à régler.

Le montant et la distance retournés par le navigateur ne sont pas considérés comme fiables : le trigger SQL vérifie le devis et réécrit le prix/la distance depuis la ligne serveur, puis consomme le devis. Les anciennes écritures du grand livre sont conservées; les nouvelles règles s'appliquent aux nouveaux devis et aux nouvelles commissions.

Les pharmacies continuent à définir leur rayon de livraison. Le GPS national ne promet pas une livraison hors du rayon de chaque pharmacie.

## Google Maps

Les liens `https://www.google.com/maps/dir/?api=1` ouvrent l'itinéraire côté Google Maps ou dans le navigateur selon l'appareil. Cela ne synchronise pas l'historique, les favoris ou le compte Google personnel du client.

## Référentiel de localités

Table Replay : `public.localites_cameroun`.

Import initial depuis la couche `Lieux habités (146)` du service `cmr/open_data_fr` de Forest Atlas du Cameroun :
- 6 149 identifiants de lieux effectivement présents après dédoublonnage par identifiant source;
- 6 001 classés `Village`;
- 90 chefs-lieux d'arrondissement;
- 48 chefs-lieux de département;
- 9 chefs-lieux de région;
- 1 capitale;
- 5 213 noms distincts (certains noms de villages sont homonymes).

La couche source avertit expressément que la liste des localités n'est pas exhaustive, que les données ont été numérisées à partir de cartes au 1:200 000 et que les coordonnées sont approximatives. Les positions ne sont donc pas déclarées « vérifiées terrain ». Le service fournit un copyright MINFOF/WRI/USAID, mais sa fiche consultée ne déclare pas de licence de réutilisation : NAXA enregistre donc « licence non précisée » jusqu'à validation des droits.

La recherche manuelle consulte ce référentiel, désambiguïse les homonymes avec des candidats, puis recourt au géocodeur de secours si aucun point local n'est trouvé. Cette base ne constitue pas une garantie que chaque hameau/village du Cameroun y figure. Le GPS du téléphone reste la méthode de positionnement la plus exacte, même lorsqu'une localité n'est pas dans l'annuaire.

Les champs région/département/arrondissement sont prévus, mais ne sont pas encore renseignés par jointure spatiale. Il ne faut pas présenter cette hiérarchie comme complète.

## Limites Android

L'application du dépôt est actuellement une application Next.js/PWA; aucun projet Android natif (`android/`, Capacitor ou React Native) ni APK vérifiable n'est présent dans le dépôt QA. Le GPS au premier plan fonctionne via la permission de localisation d'Android/Chrome lorsque la PWA est ouverte. Le lien Google Maps peut lancer l'application Maps installée.

Le suivi GPS continu d'un livreur lorsque la PWA est minimisée ou fermée n'est pas garanti par le navigateur. Il nécessite une véritable couche Android avec service de localisation au premier plan, notification persistante, permissions adaptées (dont l'accès arrière-plan lorsque requis), et validation de la politique de distribution. Aucune APK n'a été produite dans ce chantier.

## Validation et limites de recette

- Migrations de gazetteer, devis de livraison et RLS appliquées sur Replay uniquement.
- Données Replay : 6 149 localités dans la table au dernier contrôle.
- Les pharmacies présentes sur Replay sont des données de démonstration; il n'y avait aucun partenaire public actif avec GPS/livraison activée. Le calcul routier entre un vrai client et une vraie pharmacie partenaire ne peut donc pas être prouvé sur cet environnement.
- Le dépôt n'a pas été déployé. Aucune clé Google Routes n'a été vérifiée en production et aucun trajet réel n'est certifié.
- La CI GitHub doit terminer avec succès sur le dernier commit avant de déclarer les corrections web prêtes.
- Pas de test E2E avec appareils Android physiques, GPS réel, réseau mobile camerounais ou mode arrière-plan.

## Gestion GPS par établissement — décision de clôture

La position géographique est une propriété de chaque ligne `pharmacies` (`lat`, `lng`). Elle ne dépend pas de la position du compte Promoteur et ne doit jamais être partagée entre plusieurs établissements.

### Modes de saisie

- **Administrateur à la pharmacie :** utilise le GPS du téléphone, avec précision élevée, puis contrôle le repère cartographique.
- **Administrateur à distance :** saisit manuellement la latitude et la longitude exactes obtenues auprès de l'établissement.
- **Promoteur multisites :** depuis « Mon réseau », choisit une pharmacie précise et renseigne ses propres coordonnées, soit par GPS lorsqu'il se trouve à cet établissement, soit manuellement. Le contrôle serveur exige un rattachement Promoteur–pharmacie actif ; une pharmacie hors de son réseau ne peut pas être modifiée.
- **Responsable :** consultation seulement ; pas de modification de coordonnées dans ce parcours.

### Statuts et certification

- `inconnu` : aucune position exploitable/certifiée.
- `a_verifier` : coordonnées enregistrées depuis GPS ou saisie manuelle, en attente de contrôle.
- `source_publique_a_confirmer` : candidat issu d'un référentiel public, à ne pas présenter comme certifié.
- `verifiee_terrain` : position contrôlée explicitement par l'Administration.
- `rejetee` : position rejetée ; elle doit être corrigée avant d'être utilisée pour une découverte fiable.

Les coordonnées nouvelles sont bornées au territoire camerounais. Toute modification repasse à `a_verifier`, efface la certification précédente et crée un événement dans le journal `naxa_pharmacie_geo_audit`. L'Administration peut consulter le point sur une carte, confirmer le contrôle puis certifier la position.

**Séparation de deux GPS :** le GPS du Client donne sa position au moment de la recherche ; le GPS de pharmacie donne la position de l'établissement. La découverte nationale et les itinéraires utilisent les deux points et un réseau routier. Un géorepérage de zone tarifaire n'est ni un enregistrement de pharmacie, ni une condition de découverte.

**Limite terrain maintenue :** une pharmacie sans coordonnées réelles n'est pas placée artificiellement sur la carte et n'obtient pas de distance fictive. Les candidats issus d'OpenStreetMap ou d'un autre répertoire public ne deviennent jamais automatiquement des partenaires NAXA.
