# Illustrations et photographies des 21 dispositifs — « Mon suivi connecté »

**État : photos de référence intégrées à la bibliothèque privée de suivi.** Les fichiers originaux restent conservés dans `docs/references/dispositifs-medicaux-connectes/`. Les photos sélectionnées sont servies depuis `public/images/suivi-dispositifs/`.

## Règles d’affichage

- Un seul grand emplacement photo par catégorie.
- Les images d’une même catégorie alternent automatiquement toutes les 4 secondes lorsqu’au moins deux photos sont disponibles.
- Chaque instance de galerie possède un décalage de départ indépendant : les appareils ne changent pas tous d’image au même instant.
- Fondu de 380 ms, sans flèches, sans petites vignettes et sans superposition d’images.
- Les photos utilisent `object-fit: contain` pour éviter le rognage et la déformation.
- Les utilisateurs ayant activé la préférence système « réduire les animations » voient une image fixe.
- Les catégories sans photo suffisamment fiable conservent leur illustration vectorielle de secours.

## Correspondance des photos vers les catégories

Les images sont des exemples visuels de familles d’appareils. Elles ne sont pas présentées comme plusieurs vues d’un même SKU, ni comme une preuve de compatibilité fabricant.

| Catégorie | Nombre de photos | Sources |
|---|---:|---|
| Tensiomètre | 3 | `téléchargement.jfif`, `téléchargement (1).jfif`, `téléchargement (2).jfif` |
| Thermomètre numérique | 2 | `téléchargement (3).jfif`, `téléchargement (5).jfif` |
| Oxymètre | 4 | `téléchargement (6).jfif`, `téléchargement (7).jfif`, `téléchargement (8).jfif`, `téléchargement (48).jfif` |
| Glucomètre | 3 | `téléchargement (10).jfif`, `téléchargement (32).jfif`, `téléchargement (35).jfif` |
| Balance | 3 | `téléchargement (11).jfif`, `téléchargement (12).jfif`, `téléchargement (13).jfif` |
| Capteur cardiaque | 3 | `téléchargement (15).jfif`, `téléchargement (16).jfif`, `téléchargement (53).jfif` |
| Podomètre | 1 | `téléchargement (17).jfif` |
| ECG portable | 2 | `téléchargement (19).jfif`, `téléchargement (21).jfif` |
| Spiromètre | 3 | `téléchargement (22).jfif`, `téléchargement (23).jfif`, `téléchargement (24).jfif` |
| Débitmètre de pointe | 1 | `téléchargement (27).jfif` |
| Balance impédancemètre | 2 | `téléchargement (28).jfif`, `téléchargement (29).jfif` |
| Lecteur de cholestérol | 2 | `téléchargement (30).jfif`, `téléchargement (31).jfif` |
| Lecteur de cétones | 1 | `téléchargement (34).jfif` |
| Lecteur d’acide urique | 1 | `téléchargement (36).jfif` |
| Montre connectée | 1 | `téléchargement (40).jfif` |
| Bracelet d’activité | 3 | `téléchargement (41).jfif`, `téléchargement (42).jfif`, `téléchargement (45).jfif` |
| Suivi du sommeil | 1 | `téléchargement (44).jfif` |
| Thermomètre infrarouge | 3 | `téléchargement (49).jfif`, `téléchargement (50).jfif`, `téléchargement (51).jfif` |
| Capteur respiratoire | 3 | `téléchargement (46).jfif`, `téléchargement (52).jfif`, `téléchargement (54).jfif` |
| Pilulier connecté | 1 | `téléchargement (57).jfif` |
| Bouteille connectée / hydratation | 3 | `téléchargement (58).jfif`, `téléchargement (59).jfif`, `téléchargement (60).jfif` |

## Images volontairement non publiées dans les galeries

Les originaux restent dans le dossier de référence, mais ne sont pas copiés dans `public` lorsqu’une correspondance est insuffisante, lorsqu’un filigrane ou un arrière-plan de damier est visible, ou lorsqu’aucune des 21 clés du catalogue ne convient. Cela concerne notamment le nébuliseur, l’inhalateur suivi, quelques objets ambigus et les images portant des filigranes de banques d’images.

## Limites et conformité

- Une photo de catégorie n’identifie pas forcément la marque ou le modèle exact.
- Le nombre de photos ne représente pas le nombre de modèles vérifiés.
- La compatibilité Bluetooth n’est confirmée que par la découverte d’un profil/protocole pris en charge et la lecture d’une mesure décodée et validée. Voir `docs/suivi-compatibilite-dispositifs.md`.
- Les visuels ne sont pas des photos d’identité réglementaire ni des certificats médicaux.
- Les droits d’utilisation/publication des images d’origine doivent être vérifiés avant leur diffusion commerciale publique.
- L’univers commercial « Dispositifs médicaux » reste distinct de l’espace personnel privé `/suivi`. Cette intégration concerne uniquement les visuels de la bibliothèque privée de suivi et n’active pas l’univers commercial verrouillé en phase 1.

## Composant

- Galerie : `src/components/suivi/DeviceIllustration.tsx`
- Emplacements et dimensions : `src/components/suivi/SuiviConnecte.tsx`
- Médias servis : `public/images/suivi-dispositifs/<clé>/`
- Les SVG restent le repli pour une catégorie sans photo retenue.
