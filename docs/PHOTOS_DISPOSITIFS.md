# Illustrations des 21 dispositifs — « Mon suivi connecté »

**État : illustrations vectorielles intégrées au code.** Les 21 catégories disposent chacune d'une représentation SVG locale dans `src/components/suivi/DeviceIllustration.tsx`. Aucun fichier image externe ni bucket Storage n'est requis pour afficher les visuels.

## Couverture

| # | Catégorie | Clé du catalogue | Visuel |
|---:|---|---|---|
| 1 | Tensiomètre de bras | `tensiometre` | SVG local |
| 2 | Thermomètre numérique | `thermometre` | SVG local |
| 3 | Oxymètre de doigt | `oxymetre` | SVG local |
| 4 | Glucomètre | `glucometre` | SVG local |
| 5 | Balance | `balance` | SVG local |
| 6 | Capteur cardiaque / cardiofréquencemètre | `capteur_cardiaque_bluetooth` | SVG local |
| 7 | Podomètre | `podometre` | SVG local |
| 8 | Électrocardiographe portable | `ecg` | SVG local |
| 9 | Spiromètre | `spirometre` | SVG local |
| 10 | Débitmètre de pointe | `peak_flow` | SVG local |
| 11 | Balance impédancemètre | `balance_impedance` | SVG local |
| 12 | Lecteur de cholestérol | `cholesterolometre` | SVG local |
| 13 | Lecteur de cétones | `cetonemetre` | SVG local |
| 14 | Lecteur d’acide urique | `uricometre` | SVG local |
| 15 | Montre connectée | `montre_connectee` | SVG local |
| 16 | Bracelet d’activité | `bracelet_activite` | SVG local |
| 17 | Capteur de suivi du sommeil | `tracker_sommeil` | SVG local |
| 18 | Thermomètre infrarouge | `thermometre_infrarouge` | SVG local |
| 19 | Capteur respiratoire | `capteur_respiration` | SVG local |
| 20 | Pilulier connecté | `pilulier_connecte` | SVG local |
| 21 | Bouteille connectée / hydratation | `bouteille_hydratation` | SVG local |

## Intégration

- Composant : `src/components/suivi/DeviceIllustration.tsx`.
- Utilisation dans le bandeau d'accueil, la grille des appareils et la fiche détaillée.
- Illustrations vectorielles responsives, fond clair, sans marque, logo, prix ni texte fabricant.
- Aucun téléchargement réseau et aucune dépendance à Supabase Storage.
- Les dessins sont des représentations schématiques illustratives, pas des photos de produits ni une preuve de compatibilité Bluetooth.

## Limites à conserver

Les illustrations n'ajoutent aucune intégration matérielle. La compatibilité Bluetooth reste conditionnée à la découverte d'un profil/protocole pris en charge et à la lecture effective d'une mesure valide. Le nombre de catégories illustrées ne doit jamais être présenté comme le nombre d'appareils Bluetooth compatibles.
