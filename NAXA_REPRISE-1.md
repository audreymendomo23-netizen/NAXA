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
### État de livraison vérifié
- Commit d’implémentation sur `main` : `6be8b99415271b9aa80fd4cfbd54b9fa1c00698d`.
- Fichiers relus sur `main` après écriture : `src/components/Luciole.tsx` et `src/app/globals.css`.
- Déploiement : **bloqué**. Vercel a refusé la création du déploiement avec HTTP 402 `api-deployments-free-per-day` : plus de 100 déploiements API sur la période, réessai indiqué dans 24 heures. Les déploiements récents consultés sont `CANCELED`; aucun déploiement de ce commit n’est confirmé.
- Build/TypeScript : non exécutés dans cette session, donc aucune réussite de compilation n’est revendiquée.

Le code est enregistré sur `main`, mais la publication en Production reste à reprendre lorsque la limite de déploiement Vercel sera levée.
