# Photos des 21 dispositifs — « Mon suivi connecté »

**État : une photo de référence par catégorie est intégrée dans la bibliothèque privée.** Les 62 images originales restent conservées dans `docs/references/dispositifs-medicaux-connectes/`. Une seule photo retenue par catégorie est publiée dans `public/images/suivi-dispositifs/` pour éviter de faire alterner des modèles différents comme s'il s'agissait du même appareil.

## Règles d’affichage

- Un seul grand emplacement photo par dispositif.
- Aucune flèche et aucune petite vignette.
- `object-fit: contain` préserve le cadrage et les proportions.
- Les cartes restent grandes et s'adaptent aux écrans mobiles et ordinateurs.
- **Alternance conditionnelle :** le composant sait faire alterner les photos toutes les 4 secondes avec un fondu indépendant par galerie, uniquement lorsqu'au moins deux photos sont confirmées comme appartenant au même modèle exact. Le lot actuellement reçu montre des modèles différents par catégorie ; aucune alternance multi-photo n'est donc activée à tort.
- Les photos d'un même type mais de modèles différents ne sont jamais regroupées dans une même animation.
- Les SVG demeurent le repli pour une catégorie sans photo retenue.
- Les préférences système de réduction des animations sont respectées.

## Correspondance des photos retenues

| Catégorie | Source retenue |
|---|---|
| Tensiomètre | `téléchargement.jfif` |
| Thermomètre numérique | `téléchargement (3).jfif` |
| Oxymètre de doigt | `téléchargement (7).jfif` |
| Glucomètre | `téléchargement (32).jfif` |
| Balance | `téléchargement (11).jfif` |
| Capteur cardiaque / cardiofréquencemètre | `téléchargement (14).jfif` |
| Podomètre | `téléchargement (17).jfif` |
| Électrocardiographe portable | `téléchargement (19).jfif` |
| Spiromètre | `téléchargement (23).jfif` |
| Débitmètre de pointe | `téléchargement (27).jfif` |
| Balance impédancemètre | `téléchargement (28).jfif` |
| Lecteur de cholestérol | `téléchargement (31).jfif` |
| Lecteur de cétones | `téléchargement (34).jfif` |
| Lecteur d’acide urique | `téléchargement (36).jfif` |
| Montre connectée | `téléchargement (37).jfif` |
| Bracelet d’activité | `téléchargement (42).jfif` |
| Suivi du sommeil | `téléchargement (44).jfif` |
| Thermomètre infrarouge | `téléchargement (50).jfif` |
| Capteur respiratoire | `téléchargement (46).jfif` |
| Pilulier connecté | `téléchargement (57).jfif` |
| Bouteille connectée / hydratation | `téléchargement (59).jfif` |

## Images non publiées

Les autres originaux sont conservés comme références et ne sont pas servis depuis `public` tant qu'ils représentent un autre modèle, une famille ambiguë, un accessoire isolé, un résultat de banque d'images filigrané ou une résolution/coupe insuffisante.

## Limites et conformité

- Une photo illustrative ne confirme ni la marque, ni la référence commerciale exacte, ni une compatibilité Bluetooth.
- Les 21 catégories existantes ne sont pas modifiées par cette sélection.
- La compatibilité reste confirmée uniquement après découverte d'un profil/protocole pris en charge et lecture d'une mesure décodée et validée : voir `docs/suivi-compatibilite-dispositifs.md`.
- Les droits d'utilisation des fichiers d'origine doivent être vérifiés avant diffusion commerciale publique.
- L’espace privé `/suivi` reste distinct de l’univers commercial « Dispositifs médicaux », toujours verrouillé séparément.

## Composants

- Galerie et image de secours : `src/components/suivi/DeviceIllustration.tsx`
- Emplacements et dimensions : `src/components/suivi/SuiviConnecte.tsx`
- Images publiées : `public/images/suivi-dispositifs/<clé>/01.jpg`
