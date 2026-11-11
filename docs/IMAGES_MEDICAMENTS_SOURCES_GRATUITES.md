# Images des médicaments — sources gratuites

## Objectif

Alimenter le catalogue public NAXA avec des images réellement rattachées à une référence, sans abonnement, achat de quota ni intégration d'images dont les droits de réutilisation ne sont pas établis.

## Ordre de résolution en production

1. **Catalogue local NAXA vérifié** : priorité aux fichiers déjà enregistrés avec source HTTPS, licence et date de vérification.
2. **CIMA / AEMPS (Espagne)** : API REST publique gratuite. La recherche s'effectue sur le nom, puis sur la fiche de détail si nécessaire. Les champs fotos distinguent :
   - materialas : image du conditionnement ;
   - formafarmac : image de la forme pharmaceutique.
   Les données ouvertes AEMPS sont réutilisables gratuitement avec attribution de la source. L'attribution est conservée dans l'objet photo. Les résultats CIMA restent des présentations espagnoles : ne jamais les décrire comme l'emballage camerounais.
3. **Wikimedia Commons** : recherche complémentaire uniquement pour les types encore absents. Seules les licences CC0, domaine public, CC BY et CC BY-SA sont acceptées ; les licences NC/ND sont rejetées. L'URL de la page du fichier, la licence et l'attribution sont conservées. Les recherches sont mises en cache 7 jours et les appels simultanés limités à deux par médicament.
4. **Open Products Facts** : utilisé uniquement lorsqu'un GTIN/EAN exact est fourni à l'endpoint photo. La fiche doit renvoyer le même code-barres et une catégorie médicament/pharmaceutique. La photo est affichée depuis la source, sans copie locale, sous CC BY-SA ; l'attribution et la fiche source sont conservées. Ne pas fusionner les données de cette base dans le référentiel maître NAXA sans traiter les obligations ODbL et share-alike.

## Sources volontairement exclues

- **MEDIPIM** : service professionnel/payant ; hors périmètre gratuit.
- **DailyMed / SPL** : les médias peuvent être soumis à des droits de tiers. L'ouverture des notices ou métadonnées FDA ne prouve pas la licence de chaque photographie ; aucun média n'est affiché sans licence propre vérifiable.
- **RxImage** : API arrêtée.
- **Google Images / scraping de sites marchands** : pas de droits d'usage commercial fiables et pas de liaison suffisamment sûre avec la présentation exacte.
- **Images générées artificiellement** : interdites comme représentation d'un médicament réel ou de son emballage.

## Garde-fous

- CIMA : HTTPS et hôte officiel strict, type de photo explicite, correspondance du nom requise.
- Open Products Facts : code-barres exact, catégorie médicament et licence CC BY-SA ; aucun rapprochement flou par nom.
- Wikimedia : correspondance textuelle, type boîte/comprimé, détection de combinaisons et licence vérifiée.
- Une photo absente ou incertaine reste un placeholder ; une image de principe actif ne remplace pas une photo de produit commercial.
- Les photos étrangères sont des références visuelles, pas une preuve de disponibilité, d'autorisation de commercialisation au Cameroun, de stock ou d'équivalence d'emballage.
- Les URLs, licences, sources et attributions doivent accompagner toute photo affichée.

## Quotas et cache

- CIMA : API publique sans clé ni quota payant annoncé ; ne pas lancer de synchronisation massive inutile. Cache serveur 7 jours.
- Wikimedia Commons : respecter les règles de l'API et son User-Agent descriptif. Le service peut appliquer des limites adaptatives ; limiter les appels simultanés, utiliser le cache 7 jours et ne pas relancer immédiatement après HTTP 429.
- Open Products Facts : endpoint public par code-barres ; aucun quota garanti n'est supposé par NAXA. Utiliser un appel à la demande et un cache 7 jours.
- Aucun secret ni clé API payante n'est nécessaire pour ces trois sources.

## Vérifications à effectuer après intégration

- npm run test:catalogue-medicaments
- npx tsc --noEmit
- Recette visuelle sur plusieurs marques et DCI, avec vérification séparée des images de boîte et de forme pharmaceutique.
- Vérification de disponibilité des sources depuis le runtime de l'application. Une source gratuite peut être indisponible temporairement ; le fallback placeholder doit rester opérationnel.

## Limite de couverture

CIMA décrit le marché espagnol. Wikimedia et Open Products Facts sont collaboratifs. Aucun de ces catalogues ne garantit la couverture des emballages commercialisés au Cameroun. Ne pas afficher une photo distante comme « emballage exact au Cameroun » sans preuve de correspondance locale.
