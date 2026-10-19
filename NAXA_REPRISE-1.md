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


## Mise à jour — audit et durées (19 octobre 2026)

- Le code conserve le déplacement aléatoire, le suivi passif du pointeur, le guidage du curseur de saisie, le guidage vers les boutons, l'arbre lumineux, le sommeil, le réveil et les chatouilles.
- Le retour à l'arbre passe de 20 à 30 secondes via `src/components/luciole-constants.ts`.
- Les durées de guidage, de scintillement, de validation, de déplacement aléatoire et de salut auparavant codées en dur dans `Luciole.tsx` sont centralisées dans le même fichier de constantes.
- Événements confirmés pendant l'audit : `naxa:panier-ajoute`, `naxa:favoris-change` et `naxa-language-updated`. La recherche et le scan ont des états locaux dans leurs composants, sans canal commun actuel vers la fée.
- Le canal générique `naxa:fairy` est écouté par la fée, mais aucun producteur n'a été trouvé dans les composants inspectés. Aucun état métier absent n'est simulé.
- Les réactions spécialisées exigeant un état non exposé (confirmation de paiement, statut réel de livraison, traitement terminé, stock bas, avis envoyé et première ouverture par appareil) ne sont pas déclarées implémentées dans cette étape ; elles nécessitent un raccordement à leur source réelle. La fée ne crée aucune donnée métier ni notification.
- Tests de compilation et tests automatisés : non exécutés dans cette opération GitHub distante ; aucun succès de test n'est revendiqué.


## Compléments de mise en œuvre — 19 octobre 2026

- Les événements de recherche émettent désormais un signal visuel de chargement, de résultats, d'absence de résultats ou d'erreur, sans transmettre le terme recherché.
- Le scanner émet un signal de caméra/lecture, de résultat ou d'erreur sans transmettre l'ordonnance ni le code-barres. La fée peut maintenant apparaître sur la route `/scanner`, uniquement en mode nuit, et son conteneur conserve `pointer-events: none`.
- Un rappel déclenche un signal visuel sans envoyer le médicament, la dose ou les autres données du rappel à la fée.
- Les états durables raccordés (rappel, recherche en chargement, scan actif, paiement/commande lorsqu'ils seront émis, hors connexion) suspendent le sommeil au plus deux minutes. Pendant le suivi du pointeur ou du curseur, l'accompagnement est masqué et reprend seulement après le calme.
- Les facéties aléatoires ciblent désormais un bouton réellement visible et activé lorsqu'une assise est choisie ; si aucun bouton approprié n'existe, la fée choisit un autre comportement. Le bâillement n'est possible qu'à partir de 23 h, heure locale.
- Les accessoires SVG restent simplifiés à l'échelle actuelle. Aucun événement n'intercepte les clics et aucun contenu sensible n'est affiché.
- Les réactions liées aux statuts de livraison, de fin de traitement, de paiement confirmé, de stock bas, d'avis envoyé et de première ouverture par appareil restent non raccordées tant que le projet ne fournit pas un état source observable et stable.
- Les vérifications automatisées doivent être lancées avant de considérer le travail terminé.

- L’anatomie SVG comprend maintenant des jambes/pieds articulés et des expressions simples (yeux ouverts/fermés, sourire). Le protocole visuel accepte également les types `pharmacy`, `stock`, `baby`, `review`, `treatment`, `delivery`, `welcome`, `login` et `logout` via `naxa:fairy`, mais ces types ne sont déclenchés que si une source réelle les émet.

- Les durées restantes de scintillement, d’ailes legacy, de bâillement, de jambes assises et de fondu réduit sont également exposées dans `LUCIOLE_TIMING`; les animations de chatouilles réduisent le battement d’ailes et le scintillement sous `prefers-reduced-motion`.

- Les signaux de recherche et de scan sont publiés après l’installation des écouteurs via une frame d’animation, et la recherche émet explicitement un état de fin lorsqu’on efface le terme. Cela évite qu’un état visuel de recherche reste actif après effacement.

- Les gestes métier ne sont plus déduits des mots présents sur un bouton : ils ne sont déclenchés que par les événements d’état existants ou par un attribut explicite `data-naxa-fairy`. Un clic n’est jamais pris à tort pour une commande validée ou un paiement réussi.

- La durée de pirouette lors du changement de langue est également centralisée dans `LUCIOLE_TIMING`.
