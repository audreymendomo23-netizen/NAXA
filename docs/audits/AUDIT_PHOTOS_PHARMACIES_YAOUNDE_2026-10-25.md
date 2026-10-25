# Audit des photos de pharmacies de Yaoundé — 25 octobre 2026

## Périmètre et conclusion

Cet audit distingue une photo réellement identifiée d'une simple illustration. Les recherches publiques ont trouvé des annuaires et quelques galeries d'établissements, mais n'ont pas permis de valider une photo individuelle pour chacune des pharmacies actuellement listées par Mfasha. Aucune image ne doit être attribuée à une officine sur la seule base d'un nom proche ou d'une image située à côté dans une page.

La liste de garde est une liste évolutive publiée par Mfasha, pas un répertoire exhaustif de toutes les pharmacies de Yaoundé. Le répertoire de production de NAXA ne doit pas être rempli automatiquement avec des établissements d'annuaires externes sans vérification de leur identité, de leur activité et de leur localisation.

## Sources publiques consultées

- Mfasha, source de la liste de garde : https://mfasha.com/
- MboaPHARMA, annuaire non officiel utilisé uniquement comme piste de recherche : https://mboapharma.cm/annuaire-des-pharmacies/
- BusinessList, annuaire commercial (non officiel) : https://fr.businesslist.co.cm/category/pharmacies/city%3Ayaounde
- Mont-Pandi, annuaire local (non officiel) : https://mont-pandi.com/
- Direction de la Pharmacie, du Médicament et des Laboratoires (DPML), portail officiel et accès à la liste des établissements pharmaceutiques agréés : https://dpml.cm/fr/
- Pharmacie Well, galerie publiée par l'établissement : https://www.pharmaciewell.com/
- PlaYce Yaoundé, page boutique et photos de la Pharmacie de la Brique : https://playce-yaounde.cm/boutiques/pharmacie-de-la-brique/

**Précaution importante :** la présence d'une image dans un annuaire ne prouve pas qu'elle représente la bonne officine, qu'elle est récente, ni que sa réutilisation est autorisée. Les galeries de Pharmacie Well et de la Pharmacie de la Brique ne sont pas des photos des pharmacies de garde listées ci-dessous et ne doivent pas leur être attribuées.

## Liste de garde observée sur Mfasha

La page source a été consultée le 25 octobre 2026 et affichait une période de garde du 26 au 27 octobre 2026. La période doit être relue à chaque requête ; elle n'est pas une donnée permanente.

| Nom normalisé à contrôler | Zone affichée par la source | Photo exacte validée pendant cet audit | Fallback prévu |
|---|---:|---|---|
| UNITE | 1 | Non identifiée | Illustration blanche avec icône et nom |
| EMMANUEL | 2 | Non identifiée | Illustration blanche avec icône et nom |
| MVOG-ADA | 3 | Non identifiée | Illustration blanche avec icône et nom |
| Le Crystallis | 4 | Non identifiée | Illustration blanche avec icône et nom |
| Sainte Anne | 4 | Candidate visuelle concordante trouvée sur Ayila'a ; droits/réutilisation non vérifiés et pas encore importée dans Supabase | Illustration blanche tant que la photo candidate n'est pas importée et validée |
| Nsam Efoulan | 5 | Non identifiée | Illustration blanche avec icône et nom |
| Marijova | 6 | Non identifiée | Illustration blanche avec icône et nom |
| Messa | 7 | Non identifiée | Illustration blanche avec icône et nom |
| Jerusalem | 8 | Non identifiée | Illustration blanche avec icône et nom |
| Obili Chapelle | 9 | Non identifiée | Illustration blanche avec icône et nom |
| Hermes | 10 | Non identifiée | Illustration blanche avec icône et nom |
| Santé & Vie | 12 | Non identifiée | Illustration blanche avec icône et nom |
| God's Glory Pharmacy | 13 | Non identifiée | Illustration blanche avec icône et nom |
| Pharmacie de Minkan | 13 | Non identifiée | Illustration blanche avec icône et nom |

Les libellés de cette table sont normalisés pour le suivi de l'audit ; la source de garde demeure la référence pour le nom exact, la zone, les contacts et la période du jour. Une image de façade portant le nom « Pharmacie Sainte Anne » a été repérée sur https://ayilaa.com/fr/secours/11406-pharmacie-sainte-anne-yaounde ; l'image est un candidat concordant, mais sa provenance/droit de réutilisation et son téléversement dans Supabase restent à valider. La fiche publique de la Pharmacie Le Crystallis sur https://mboapharma.cm/directory/pharmacie-le-crystallis/ affiche des images étiquetées au nom de l'établissement, mais la page refuse l'accès automatisé (403), donc aucun fichier image n'a pu être récupéré et vérifié.

## Ordre de priorité appliqué par l'API NAXA

1. Photo vérifiée enregistrée par la pharmacie elle-même (photo_declaree_par_pharmacie = true, photo_verified_at présent, fichier dans le bucket public pharmacies-photos).
2. Autre photo stockée et vérifiée dans Supabase (photo_verified_at présent et URL du bucket autorisé).
3. Photo externe de Mfasha, uniquement si l'URL est HTTPS, hébergée sur le domaine Mfasha et téléchargée dans le bucket avec un type d'image autorisé.
4. Illustration générée à fond blanc avec icône verte, nom de l'officine et la mention explicite « Illustration — photo réelle non identifiée ».

L'API n'accepte plus les images de la page Mfasha par simple proximité HTML : le nom de l'officine doit apparaître dans le nom du fichier, son attribut alt ou son attribut title. Cela privilégie l'absence d'une photo réelle plutôt que l'affichage d'une photo possiblement erronée.

## État de la base Supabase au moment de l'audit

- Bucket pharmacies-photos configuré pour JPEG, PNG, WebP et SVG.
- Colonne photo_declaree_par_pharmacie ajoutée à public.pharmacies, valeur par défaut false.
- Les lignes de pharmacies de démonstration sont inactives et masquées des résultats.
- Le registre contient une pharmacie active non-démo (MAYAKA) et n'est pas un inventaire complet de Yaoundé.
- **Le bucket était vide au dernier contrôle : 0 objet.** Aucune photo réelle ni illustration de garde n'a donc été confirmée comme déjà stockée au moment de cet audit.
- Le code de l'API téléverse les images source autorisées et crée les illustrations au fil des requêtes. Ces téléversements ne peuvent commencer que lorsque le code modifié est exécuté. Aucun déploiement Vercel n'a été déclenché dans le cadre de cet audit.

## Points à ne pas déclarer clos sans preuve

- Vérifier que le code compile et que les contrôles TypeScript/lint passent.
- Après autorisation de mise en service, appeler l'API de garde et vérifier que chaque résultat contient imageUrl et un imageType explicite.
- Contrôler les objets réellement créés dans storage.objects, puis ouvrir les URL publiques des illustrations.
- Obtenir des photos soumises par les pharmacies et vérifier l'identité/autorisation avant de renseigner photo_declaree_par_pharmacie = true et photo_verified_at.
- Pour élargir au répertoire complet de Yaoundé, importer uniquement une liste fiable (priorité à la source officielle DPML) puis dédupliquer et vérifier chaque établissement avant de lui attribuer une image.
