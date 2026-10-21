# Catalogue médicaments NAXA — sources, droits et disponibilité

## Objectif

Le catalogue informatif est distinct des offres et stocks. Une fiche externe ne crée jamais de stock, de prix, de disponibilité, ni d'autorisation de commercialisation au Cameroun.

## Sources et limites

- **Catalogue partenaire NAXA / Supabase** : source prioritaire pour les références déjà enregistrées, les photos locales validées et le statut de stock.
- **RxNorm / RxNav (NLM)** : normalisation des noms et substances. Le contenu est centré sur les États-Unis et contient peu de médicaments non américains. La licence de certains vocabulaires sources peut imposer des conditions supplémentaires. Documentation : https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html et https://www.nlm.nih.gov/research/umls/rxnorm/faq.html
- **openFDA** : données de notices, noms génériques et marques. La plupart des données FDA sont CC0, mais certains éléments transmis par des tiers peuvent être soumis à des droits distincts. Ne pas interpréter ces informations comme une validation camerounaise. https://open.fda.gov/license/
- **DailyMed** : notices d'étiquetage américaines. La présence d'un média dans une notice ne vaut pas preuve de droit de réutilisation commerciale de son image. Les images tierces ne sont donc pas hotlinkées ni copiées par l'API de recherche sans vérification.
- **DPML / MINSANTE Cameroun** : répertoire officiel des médicaments homologués, référence de vérification réglementaire manuelle : https://dpml.cm/repertoireDesAmm/index.php. Aucun endpoint API public documenté n'a été confirmé ; NAXA ne prétend donc pas synchroniser automatiquement le répertoire.

## Photos

Les images importées dans le bucket public Supabase Storage `medicaments` sont limitées à JPEG, PNG ou WebP, 5 Mio maximum. L'écriture, la modification et la suppression sont réservées au rôle `admin`.

Avant d'afficher une copie Storage, NAXA exige :
- `produits.photo_source_url` : URL d'origine ;
- `produits.photo_licence` : licence ou autorisation documentée permettant l'usage commercial ;
- `produits.photo_verifiee_le` : date de vérification de la licence et de la correspondance avec le médicament.

Si ces champs ne sont pas renseignés, l'image externe n'est pas réutilisée et l'interface affiche le placeholder. Les anciennes valeurs `photo_url` sont conservées mais masquées dans la recherche tant que la provenance et les droits ne sont pas validés.

## Disponibilité partenaire

La recherche ne déclare « disponible » que si le produit local est rapproché et qu'une lecture des stocks réussit, avec quantité strictement positive, pharmacie active et lot non expiré. « Indisponible » signifie que la lecture des stocks a réussi et n'a trouvé aucun stock positif admissible. En cas d'erreur de lecture ou de correspondance incertaine, le statut reste « stock non vérifié ».

Le prix éventuel vient exclusivement des lignes de stock locales. La quantité agrégée n'est pas exposée au public. Une réservation doit refaire une vérification atomique du stock côté NAXA.

## Vérifications

- Test statique applicatif : `npm run test:catalogue-medicaments`
- Test SQL : `supabase/tests/221_medicament_photo_provenance_storage.sql`
- La migration est additive et doit être appliquée avant le déploiement du code qui lit les nouvelles colonnes. Aucun déploiement ni changement de base de production n'est inclus dans ce chantier.
