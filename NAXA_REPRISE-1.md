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


## Compléments — sommeil et chatouilles
- Les nouvelles durées et intervalles sont centralisés dans `src/components/luciole-constants.ts`.
- Le seuil de retour à l'arbre et de début du sommeil est fixé à 20 secondes d'inactivité. À l'arrivée, la fée prend une pose de sommeil avec bras repliés, halo atténué et trois « z » dessinés en SVG.
- Un double toucher dans la zone de la fée en moins de 400 ms déclenche une courte animation de chatouilles uniquement si la cible n'est pas un élément interactif. Les événements d'origine ne sont ni annulés ni stoppés.
- Les animations de sommeil et de chatouilles respectent `prefers-reduced-motion`.
- Les facéties aléatoires d'assise, de téléportation et de bâillement sont implémentées pendant la flânerie. Les interactions de recherche, scan/ordonnance, panier, commande/réservation, paiement et rappel de posologie peuvent déclencher un geste lumineux par libellé/attribut ou par l'événement personnalisé `naxa:fairy`. Ces réactions sont purement visuelles et ne modifient aucune donnée métier.
- Validation GitLab Beta réussie sur le code de la fée (commit de test `94deba815f25683e8afe45e1b39d155a8d6f1f2a`, pipeline [#73](https://gitlab.com/audreymendomo23-netizen/NAXA/-/pipelines/2961186191)) : `npx tsc --noEmit`, `npm run lint`, `npm run build` et `full_migration_replay` sont passés. Le lint/build ont émis des avertissements non bloquants sur des fichiers existants hors de ce chantier. Le pipeline ne contient pas de suite de tests unitaires (rapport de tests vide). Aucun déploiement n'a été déclenché.


## Système d'animation scroll — 25 octobre 2026

### Architecture ajoutée
- \`src/lib/scroll-motion.ts\` : classification des routes, calcul de progression \`--p\`, lissage lerp, écouteur scroll passif unique, RAF à la demande, IntersectionObserver, cache de mesures, mise à jour de route et nettoyage.
- \`src/components/ScrollMotionProvider.tsx\` : provider global sans rendu DOM, monté une fois dans \`src/app/layout.tsx\` à côté de Luciole.
- \`src/components/ScrollMotion.tsx\` : API \`ScrollScene\`, \`ScrollItem\` et \`ScrollStagger\`; \`Reveal.tsx\` conserve l'API historique et est exclu de la cascade automatique sur les routes d'authentification.
- \`src/app/globals.css\` : styles transform/opacity/filter, paliers mobile-first, thème nuit, hover réservé aux appareils à pointeur, unités svh/vh, reduced-motion et paysage court.
- \`README.md\` et \`STATUT.md\` documentent l'architecture et les limites de validation.

### Routage des intensités
- Cinématique : \`/\`, \`/client/**\`, \`/resultats\`, \`/produit/**\`, \`/offre/**\`, \`/panier\`, \`/suivi\`, \`/parapharmacie\`, \`/aide\`.
- Authentification : \`/connexion\`, \`/creation-compte\`, \`/mot-de-passe-oublie\`, \`/nouveau-mot-de-passe\`, \`/verification-code\` : aucune cascade automatique ajoutée.
- Allégée : toutes les autres routes, y compris pharmacie, admin, partenaire et pages légales/système.
- Les scènes sticky ne sont activées que sur les sections explicitement structurées avec \`ScrollScene\`, afin de ne pas immobiliser formulaires, tableaux, caisse, impressions ou pages existantes. Le moteur automatique n'injecte pas de composition de cinq actes ni de nouveaux assets.

### Validation
- Le code sera publié par un seul commit sur \`main\`.
- **Build, TypeScript et vérification visuelle sur iOS/Android/ordinateurs non exécutés dans cet environnement** : le dépôt distant n'est pas clonable depuis le runtime de travail. Ne pas considérer ces contrôles comme passés.
