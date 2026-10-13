# PROTOCOLE D’EXÉCUTION NAXA — PRIORITÉ OPÉRATIONNELLE

Ce fichier est la consigne de travail à appliquer à chaque intervention sur NAXA. Il remplace les anciennes consignes de workflow contradictoires présentes dans la documentation, notamment toute instruction imposant CircleCI, Netlify, des branches de travail ou des Pull Requests.

## Objectif unique

Construire, corriger et livrer NAXA jusqu’à ce que toutes les fonctionnalités prévues soient réellement implémentées et fonctionnelles en Production. L’assistant est là pour exécuter le travail, pas pour transférer la charge à l’utilisateur.

## Ordres d’exécution

1. **Source de vérité :** travailler sur le dépôt GitHub privé `audreymendomo23-netizen/NAXA`, branche `main`. Ne pas réactiver, rechercher ou reprendre d’anciennes branches. Ne pas créer de branche de travail.
2. **Pas de PR :** ne pas ouvrir, demander ni imposer de Pull Request. Appliquer directement les modifications autorisées à `main`.
3. **Pas de CircleCI ni de Netlify :** ne pas lancer, recommander ni attendre de validation via CircleCI ou Netlify. Utiliser les moyens disponibles et gratuits pour compiler, tester et déployer, notamment les outils du dépôt et Vercel si le projet y est connecté.
4. **Exécution de bout en bout :** inspecter le code pertinent, identifier la cause réelle, modifier le code, exécuter les tests pertinents, corriger les échecs, puis déployer en Production lorsque le changement est prêt. Ne pas s’arrêter à une proposition, une liste de tâches ou un correctif non appliqué.
5. **Aucune vérification déléguée à l’utilisateur :** effectuer soi-même toutes les vérifications accessibles. Ne pas demander à l’utilisateur de cliquer, copier des logs ou tester manuellement ce que les outils permettent de contrôler. Si un test utilisateur reste nécessaire (appareil physique, compte ou secret indisponible), le signaler seulement après avoir terminé tout le travail automatisable.
6. **Aucune confirmation redondante :** lorsque l’utilisateur a ordonné une modification, une fusion, une correction ou un déploiement, exécuter cet ordre sans exiger une formule de confirmation supplémentaire. Ne pas ajouter d’étape d’approbation inventée.
7. **Production et données :** ne jamais exposer de secrets. Ne jamais écrire dans la base Supabase Production ni exécuter une migration destructive sans disposer d’une autorisation et d’un périmètre explicites pour cette opération. Préserver les données et les contrôles de sécurité. Pour le reste, agir directement dans le périmètre demandé.
8. **Pas de faux résultat :** ne jamais déclarer une fonctionnalité terminée, un test réussi ou un déploiement effectué sans preuve provenant d’une commande, d’un outil ou d’un endpoint réellement exécuté. Distinguer clairement : modifié, testé, déployé, vérifié en Production.
9. **Pas de répétition improductive :** ne pas relancer indéfiniment un outil qui échoue pour la même raison. Identifier la limite, choisir une solution de remplacement réellement disponible et gratuite, puis continuer.
10. **Audit utile seulement :** ne pas recommencer un audit général à chaque tour. Lire les fichiers et l’historique uniquement dans la mesure nécessaire à l’objectif courant. Réutiliser le travail déjà présent sur `main`; raisonner par contradiction entre le résultat attendu, le code réel et les preuves.
11. **Priorité unique :** traiter le blocage qui empêche le plus directement l’objectif courant. Finir le chantier demandé avant de passer à un autre, sauf blocage démontré ou urgence.
12. **Documentation :** mettre à jour les documents racine qui prescrivent encore un workflow interdit par ce protocole, lorsqu’ils sont touchés ou manifestement contradictoires. Ne pas supprimer l’historique métier utile.
13. **Rapport bref obligatoire :** après exécution, indiquer uniquement :
   - **Fait :** changements réellement appliqués ;
   - **Preuve :** tests, commit SHA, URL et état du déploiement effectivement observés ;
   - **Reste :** uniquement les blocages non résolus, avec leur cause exacte ;
   - **Suite :** prochaine action concrète prise en charge par l’assistant.

## Interdictions de comportement

- Ne pas opposer le workflow historique à un ordre explicite plus récent de l’utilisateur.
- Ne pas répondre par une recommandation quand l’opération est accessible et autorisée.
- Ne pas affirmer qu’un dépôt privé empêche les déploiements ; vérifier les limites techniques réelles du fournisseur.
- Ne pas confondre un déploiement réussi avec une fonctionnalité complète : poursuivre les corrections jusqu’à ce que les parcours métier prévus soient implémentés et testables.
- Ne pas toucher à un autre projet que NAXA pendant une mission NAXA.

## Règle de décision

Pour chaque demande, commencer par l’action concrète la plus utile, exécuter tout ce qui est accessible dans le périmètre demandé, prouver le résultat, puis continuer. Une limite réelle d’accès, d’outil ou de sécurité doit être décrite précisément ; elle ne doit jamais servir de prétexte à une réponse théorique ou à une demande de travail manuel évitable.
