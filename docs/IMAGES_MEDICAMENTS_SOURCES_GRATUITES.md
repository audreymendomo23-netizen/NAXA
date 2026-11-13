# Images des médicaments — sources gratuites

## Objectif

Alimenter le catalogue public NAXA avec des images réellement rattachées à une référence, sans abonnement, achat de quota ni intégration d'images dont les droits de réutilisation ne sont pas établis.

## Ordre de résolution en production

1. **Catalogue local NAXA vérifié** : priorité aux fichiers déjà enregistrés avec source HTTPS, licence et date de vérification.
2. **CIMA / AEMPS (Espagne)** : API REST publique gratuite, sans clé. Les champs `fotos` distinguent `materialas` (conditionnement secondaire) et `formafarmac` (forme pharmaceutique) ; chaque photo expose `fecha`, sa date de mise à jour. L'AEMPS classe explicitement les services REST CIMA dans ses données ouvertes réutilisables avec attribution. Le code affiche les images depuis l'hôte officiel CIMA, sans les télécharger ni les modifier, en conservant l'URL source, le titulaire de l'AMM et la date de mise à jour dans les informations de provenance. Toute restriction explicite NC/ND, non-commerciale ou droits réservés est rejetée. Si la date de mise à jour manque, la photo est écartée. Les résultats restent des présentations espagnoles : jamais les présenter comme l'emballage camerounais.
3. **Wikimedia Commons** : recherche complémentaire uniquement pour les types encore absents. Seules les licences CC0, domaine public, CC BY et CC BY-SA sont acceptées ; les licences NC/ND sont rejetées. L'URL de la page du fichier, la licence et l'attribution sont conservées. Les recherches sont mises en cache 7 jours et les appels simultanés limités à deux par médicament.
4. **Open Products Facts** : utilisé uniquement lorsqu'un GTIN/EAN exact est fourni à l'endpoint photo. La fiche doit renvoyer le même code-barres et une catégorie médicament/pharmaceutique. La photo est affichée depuis la source, sans copie locale, sous CC BY-SA ; l'attribution et la fiche source sont conservées. Ne pas fusionner les données de cette base dans le référentiel maître NAXA sans traiter les obligations ODbL et share-alike.

## Raccordement des correspondances CIMA déjà calculées

La table de travail CIMA `private.medicaments_cima_bdpm_jobs` n'est jamais lue directement par les rôles publics ni par le navigateur. La migration `310_cima_photo_public_projection.sql` crée une vue de lecture seule à colonnes limitées. Elle ne retient que les lignes `correspondance_forte`, avec `dose_concordante = true`, score d'au moins 0,78, une même famille de forme pharmaceutique français/espagnol (comprimé, gélule, perfusion, injectable, solution/suspension orale, sirop, topique, collyre, poudre ou spray), URL officielle CIMA validée et correspondance de l'URL avec le média `fotos[].url` ainsi que sa date `fotos[].fecha`. Les formes inconnues ou incompatibles sont exclues plutôt que rapprochées par défaut.

L'API de recherche rapproche cette projection par CIS BDPM exact. Les boîtes CIMA sont explicitement présentées comme références visuelles étrangères indicatives ; elles ne garantissent ni la marque, ni le conditionnement camerounais. Les images de forme pharmaceutique restent également indicatives et ne certifient pas l'aspect exact du produit local. Si la date de la photo ou la correspondance technique manque, l'image est écartée et le catalogue conserve son fallback actuel.

## Sources volontairement exclues

- **MEDIPIM** : service professionnel/payant ; hors périmètre gratuit.
- **DailyMed / SPL** : les médias peuvent être soumis à des droits de tiers. L'ouverture des notices ou métadonnées FDA ne prouve pas la licence de chaque photographie ; aucun média n'est affiché sans licence propre vérifiable.
- **RxImage** : API arrêtée.
- **Google Images / scraping de sites marchands** : pas de droits d'usage commercial fiables et pas de liaison suffisamment sûre avec la présentation exacte.
- **Images générées artificiellement** : interdites comme représentation d'un médicament réel ou de son emballage.

## Garde-fous

- CIMA : HTTPS et hôte officiel strict, chemin et numéro d'enregistrement exacts, type de photo explicite, date `fotos[].fecha` obligatoire, attribution AEMPS/CIMA et titulaire AMM ; réutilisation sous la politique officielle de données ouvertes, avec date de mise à jour visible ; toute restriction explicite est rejetée. Le moteur examine toutes les photos d'un type, puis complète depuis la fiche détaillée du même numéro d'enregistrement avant de passer à un autre candidat.
- Open Products Facts : code-barres exact, catégorie médicament et licence CC BY-SA ; aucun rapprochement flou par nom.
- Wikimedia : correspondance textuelle, type boîte/comprimé, détection de combinaisons et licence vérifiée.
- Une photo absente ou incertaine reste un placeholder ; une image de principe actif ne remplace pas une photo de produit commercial.
- Les photos étrangères sont des références visuelles, pas une preuve de disponibilité, d'autorisation de commercialisation au Cameroun, de stock ou d'équivalence d'emballage.
- Les URLs, licences, sources et attributions doivent accompagner toute photo affichée.

## Quotas et cache

- CIMA : API publique sans clé ni quota payant annoncé ; ne pas lancer de synchronisation massive inutile. Cache serveur 7 jours.
- Wikimedia Commons : respecter les règles de l'API et son User-Agent descriptif. Le service peut appliquer des limites adaptatives ; limiter les appels simultanés, utiliser le cache 7 jours et ne pas relancer immédiatement après HTTP 429.
- Open Products Facts : endpoint public par code-barres ; sa documentation indique que son API est largement compatible avec Open Food Facts. Par prudence, NAXA applique le plafond de lecture produit documenté par Open Food Facts (15 lectures/minute/IP) comme limite conservative, sans présumer qu'il s'agit d'un quota contractuel OPF. Aucun endpoint de recherche texte n'est utilisé ; uniquement un GET par GTIN exact et cache 7 jours.
- Aucun secret ni clé API payante n'est nécessaire pour ces trois sources.

## Vérifications à effectuer après intégration

- La saisie d'un EAN/GTIN exact dans les deux interfaces de recherche déclenche une lecture OPF uniquement lorsque la recherche catalogue ne renvoie aucun résultat ; un code sans fiche médicament revient sans image et ne déclenche aucune recherche textuelle de secours.
- Une recherche BDPM utilise le CIS exact pour récupérer les photos pré-calculées via la projection publique CIMA ; aucun accès public direct à la table privée n'est autorisé.
- Les photos CIMA nécessitent un champ `fotos[].fecha` valide et une URL exacte rattachée au numéro d'enregistrement CIMA.

- Migration `supabase/migration_310_cima_photo_public_projection.sql` : appliquée à Supabase Production le 13/11/2026. Dernier contrôle en base : 453 références éligibles (453 photos de boîte, 450 photos de forme pharmaceutique) ; ce compteur évolue avec le traitement CIMA. Lecture accordée à `anon`, `authenticated` et `service_role`, sans accès `anon` à la table privée. L’advisor Supabase signale la vue comme *security definer* : point de sécurité documenté à traiter avant clôture complète. Le code d’application est sur `main`, mais aucun déploiement Vercel n’a été effectué dans ce chantier.
- `npm run test:catalogue-medicaments`
- npx tsc --noEmit
- Recette visuelle sur plusieurs marques et DCI, avec vérification séparée des images de boîte et de forme pharmaceutique.
- Vérification de disponibilité des sources depuis le runtime de l'application. Une source gratuite peut être indisponible temporairement ; le fallback placeholder doit rester opérationnel.

## Limite de couverture

CIMA décrit le marché espagnol. Wikimedia et Open Products Facts sont collaboratifs. Aucun de ces catalogues ne garantit la couverture des emballages commercialisés au Cameroun. Ne pas afficher une photo distante comme « emballage exact au Cameroun » sans preuve de correspondance locale.
