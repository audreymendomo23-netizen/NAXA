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
- Le seuil de retour à l'arbre passe à 30 secondes. À l'arrivée, la fée prend une pose de sommeil avec bras repliés, halo atténué et trois « z » dessinés en SVG.
- Un double toucher dans la zone de la fée en moins de 400 ms déclenche une courte animation de chatouilles uniquement si la cible n'est pas un élément interactif. Les événements d'origine ne sont ni annulés ni stoppés.
- Les animations de sommeil et de chatouilles respectent `prefers-reduced-motion`.
- Les comportements métier du point 11 ne sont pas raccordés : aucun contrat d'événement métier explicite n'a été identifié dans le composant de la luciole. Ils ne sont pas simulés et aucune donnée métier n'est créée. Les comportements aléatoires d'assise/téléportation/bâillement ne sont pas encore implémentés dans ce changement.
- Aucune compilation ni suite de tests n'a été lancée, conformément à la consigne. Aucun déploiement n'a été déclenché.


## Complément — facéties et signaux NAXA (19 octobre 2026)
- Le retour au petit arbre et le début du sommeil sont réglés à 20 secondes d'inactivité, conformément à la consigne de référence.
- Pendant la flânerie nocturne, la fée choisit aléatoirement de s'asseoir, de bâiller ou de se téléporter vers un point aléatoire de la zone visible. Les durées et intervalles restent centralisés dans `luciole-constants.ts`.
- Les interactions sur les commandes et liens reconnaissent les libellés/attributs correspondant aux rappels de posologie, recherche, scan/ordonnance, panier, commande/réservation et paiement, et déclenchent un geste lumineux bref. Les composants peuvent également émettre `new CustomEvent("naxa:fairy", { detail: { type: "reminder" } })` (types admis : `reminder`, `search`, `scan`, `cart`, `order`, `reservation`, `payment`). Ce signal ne modifie aucune donnée métier et ne remplace pas le traitement de l'action d'origine.
- Nettoyage des temporisateurs à la désinstallation du composant et prise en compte de `prefers-reduced-motion`.
- La validation automatisée sera lancée via GitLab Beta après synchronisation de la version à tester.
