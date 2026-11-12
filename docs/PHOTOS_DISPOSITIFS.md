# Photos des 21 catégories de dispositifs — « Mon suivi connecté »

**État : 46 photos intégrées, réparties dans les 21 catégories.** Les 62 originaux restent conservés dans `docs/references/dispositifs-medicaux-connectes/`. Les photos sélectionnées sont servies depuis `public/images/suivi-dispositifs/`.

## Règle de correspondance

Une galerie représente une **catégorie d’appareil**. Il est permis d’y faire alterner plusieurs modèles de cette même catégorie : plusieurs tensiomètres peuvent donc se succéder dans la galerie « Tensiomètre ». En revanche, une galerie ne mélange jamais deux catégories différentes : un oxymètre n’apparaît pas dans la galerie du tensiomètre.

Cette règle ne prétend pas que les photos sont plusieurs vues du même modèle commercial. Elles illustrent plusieurs modèles du même type d’appareil.

## Présentation

- Un seul grand emplacement photo par dispositif.
- Alternance automatique toutes les 4 secondes lorsqu’au moins deux photos de la même catégorie sont disponibles.
- Chaque galerie possède un décalage de départ indépendant pour éviter les changements collectifs synchronisés.
- Fondu de 380 ms, sans flèche, sans petite vignette et sans superposition.
- `object-fit: contain` préserve les proportions et évite le rognage.
- La préférence système « réduire les animations » est respectée.
- Les SVG dédiés demeurent le repli si une galerie ne dispose pas de photo chargée.

## Correspondance validée par catégorie

| Catégorie | Nombre de modèles illustrés | Fichiers source |
|---|---:|---|
| Tensiomètre | 3 | `téléchargement.jfif`, `téléchargement (1).jfif`, `téléchargement (2).jfif` |
| Thermomètre numérique | 2 | `téléchargement (3).jfif`, `téléchargement (5).jfif` |
| Oxymètre | 4 | `téléchargement (6).jfif`, `téléchargement (7).jfif`, `téléchargement (8).jfif`, `téléchargement (48).jfif` |
| Glucomètre | 3 | `téléchargement (10).jfif`, `téléchargement (32).jfif`, `téléchargement (35).jfif` |
| Balance | 3 | `téléchargement (11).jfif`, `téléchargement (12).jfif`, `téléchargement (13).jfif` |
| Capteur cardiaque / cardiofréquencemètre | 3 | `téléchargement (15).jfif`, `téléchargement (16).jfif`, `téléchargement (53).jfif` |
| Podomètre | 1 | `téléchargement (17).jfif` |
| Électrocardiographe portable | 2 | `téléchargement (19).jfif`, `téléchargement (21).jfif` |
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

Les 16 autres originaux restent disponibles dans le dossier de référence ; ils ne sont pas publiés dans une galerie tant que leur catégorie n’est pas établie avec suffisamment de certitude.

## Limites et conformité

- Les photos distinguent des familles et des modèles visuels, pas toujours une référence commerciale exacte.
- Une photo ne constitue pas une preuve de compatibilité Bluetooth.
- La compatibilité reste confirmée uniquement après découverte d’un profil/protocole pris en charge et lecture d’une mesure décodée et validée : voir `docs/suivi-compatibilite-dispositifs.md`.
- Les droits d’utilisation des images doivent être vérifiés avant leur diffusion commerciale publique.
- Cette intégration concerne la bibliothèque privée `/suivi` et n’active pas l’univers commercial des dispositifs médicaux, qui reste séparément verrouillé.

## Composants

- Galerie : `src/components/suivi/DeviceIllustration.tsx`
- Emplacements et dimensions : `src/components/suivi/SuiviConnecte.tsx`
- Médias : `public/images/suivi-dispositifs/<clé-de-catégorie>/`
- Test de correspondance : `scripts/test-suivi-interoperabilite.cjs`
