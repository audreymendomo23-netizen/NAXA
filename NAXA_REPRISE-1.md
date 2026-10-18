# NAXA — Reprise-1 : Fée luciole nocturne

Mise à jour : 19 octobre 2026

## Chantier livré sur `main`

Objectif : remplacer uniquement l’illustration de la luciole en mode nuit par une fée SVG stylisée, sans changer son empreinte visuelle (48 × 48 px), son point de déplacement, sa zone de toucher (pointer-events désactivés), son arbre lumineux ni la logique de navigation et de déplacement.

### Changements
- Remplacement de l’insecte par une fée de forêt : quatre ailes nacrées, nervures simplifiées, tête et chignon, robe de tulle bleu-blanc, bras SVG séparés et lumière dorée sous la robe.
- Huit particules au maximum, réparties autour de la silhouette.
- Gestes CSS pilotés par les états existants : salut à l’apparition, danse pendant le mouvement, bras tendu vers le curseur de saisie ou le bouton, bras repliés au repos.
- Animations basées sur transform et opacity ; aucune ressource image externe, aucun moteur 3D, aucun filtre de flou ajouté à la nouvelle silhouette.
- Prise en compte de `prefers-reduced-motion`.
- Le mode jour conserve le masquage déjà en place ; la pharmacie, les migrations, le déplacement aléatoire, le suivi du pointeur et le positionnement de l’arbre ne sont pas modifiés.

### Contradiction vérifiée
La demande mentionne 12 secondes dans le résumé des déplacements et 20 secondes dans la section détaillée de repos. Pour préserver le comportement existant, le seuil du code reste inchangé à 20 secondes. Le reste du mouvement est conservé.

### Fichiers
- `src/components/Luciole.tsx`
- `src/app/globals.css`

### Preuves
Le SHA de commit et l’état du déploiement Vercel seront ajoutés après confirmation du commit et du déploiement par les outils. Aucun résultat de test ou de production n’est affirmé sans preuve.
