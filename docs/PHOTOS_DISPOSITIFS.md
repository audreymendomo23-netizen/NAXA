# Photos des 21 dispositifs — catalogue « Mon suivi connecté »

**État : 21 visuels générés et intégrés.** Les 21 fichiers sont stockés dans le bucket public Supabase Storage `dispositifs`, au format WebP carré 400 × 400 px, chacun inférieur à 30 Ko. Le fond blanc est conservé conformément au repli prévu, le détourage transparent n’ayant pas été disponible lors de cette exécution. Les visuels sont génériques et illustratifs; ils ne garantissent aucune compatibilité Bluetooth.

| # | Appareil | Fichier attendu | État |
|---:|---|---|---|
| 1 | Tensiomètre de bras avec brassard et écran neutre | `tensiometre.webp` | OK — fond blanc |
| 2 | Thermomètre médical numérique | `thermometre.webp` | repli |
| 3 | Oxymètre de doigt à écran neutre | `oxymetre.webp` | repli |
| 4 | Glucomètre avec bandelette séparée | `glucometre.webp` | repli |
| 5 | Pèse-personne classique en verre | `balance.webp` | repli |
| 6 | Ceinture ou bracelet cardiofréquencemètre | `capteur-cardiaque.webp` | repli |
| 7 | Podomètre compact à clip | `podometre.webp` | repli |
| 8 | Électrocardiographe portable | `ecg.webp` | repli |
| 9 | Spiromètre portable avec embout | `spirometre.webp` | repli |
| 10 | Débitmètre de pointe tubulaire | `debitmetre-pointe.webp` | repli |
| 11 | Balance impédancemètre en verre | `balance-impedancemetre.webp` | repli |
| 12 | Lecteur de cholestérol avec bandelette | `lecteur-cholesterol.webp` | repli |
| 13 | Lecteur de cétones avec bandelette | `lecteur-cetones.webp` | repli |
| 14 | Lecteur d’acide urique avec bandelette | `lecteur-acide-urique.webp` | repli |
| 15 | Montre connectée à écran neutre | `montre-connectee.webp` | repli |
| 16 | Bracelet d’activité générique | `bracelet-activite.webp` | repli |
| 17 | Capteur compact de suivi du sommeil | `suivi-sommeil.webp` | repli |
| 18 | Thermomètre infrarouge frontal | `thermometre-infrarouge.webp` | repli |
| 19 | Capteur respiratoire portable | `capteur-respiratoire.webp` | repli |
| 20 | Pilulier hebdomadaire connecté | `pilulier-connecte.webp` | repli |
| 21 | Bouteille connectée avec bouchon capteur | `bouteille-connectee.webp` | repli |

## Prompt prêt à coller

Photo de produit réaliste type packshot d’un **[APPAREIL PRÉCIS]**, générique sans marque ni logo, trois quarts de face et légèrement du dessus, appareil entier et centré occupant environ 80 % du cadre, fond blanc pur uni, éclairage doux de studio identique à toute la série, ombre de contact très légère, haute netteté, carré 1:1, aucun texte ni chiffre lisible, aucune main, aucune personne, aucun symbole médical ni croix de pharmacie, couleurs sobres blanc/gris clair/noir mat avec éventuellement un petit détail vert. Forme réelle fidèle, pas de perspective déformée, aucun accessoire non mentionné.

Remplacer `[APPAREIL PRÉCIS]` par chaque description de la table ci-dessus.

## Pipeline avant publication

1. Vérifier la forme réelle, le cadrage, la cohérence de lumière et l’absence de logos/texte parasite.
2. Le détourage transparent n’était pas disponible; le fond blanc est conservé sans altérer les contours.
3. Exporter en 400 × 400 px et moins de 30 Ko — effectué pour les 21 fichiers.
4. Téléverser les fichiers dans le bucket public Supabase Storage `dispositifs` — effectué.
5. Relier chaque fichier à sa clé de catalogue existante sans changer le schéma métier — effectué dans `SuiviConnecte.tsx`.
6. Dans l’interface, utiliser Next Image, `loading="lazy"`, dimensions réservées, `object-fit: contain` et environ 8 % de marge.
7. Afficher la mention **« visuel illustratif »**. Ne pas laisser entendre que les images représentent une marque ou garantissent la compatibilité Bluetooth.
