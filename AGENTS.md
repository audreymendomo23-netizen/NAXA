# PROTOCOLE D’EXÉCUTION NAXA — PRIORITÉ OPÉRATIONNELLE

Ce fichier est la consigne de travail à appliquer à chaque intervention sur NAXA. Il remplace les anciennes consignes de workflow contradictoires présentes dans la documentation, notamment toute instruction imposant CircleCI, Netlify, des branches de travail ou des Pull Requests.

## Objectif unique

Construire et corriger NAXA jusqu’à ce que les fonctionnalités prévues soient réellement implémentées, intégrées et testables. Un déploiement en Production n’est jamais automatique : il exige une autorisation explicite et doit être exclu lorsqu’un mandat actif l’interdit. L’assistant exécute le travail autorisé au lieu de le transférer à l’utilisateur.

## Ordres d’exécution

1. **Source de vérité :** travailler sur le dépôt GitHub privé `audreymendomo23-netizen/NAXA`, branche `main`. Ne pas réactiver, rechercher ou reprendre d’anciennes branches. Ne pas créer de branche de travail.
2. **Pas de PR :** ne pas ouvrir, demander ni imposer de Pull Request. Appliquer directement les modifications autorisées à `main`.
3. **CI et outils de validation :** ne pas utiliser CircleCI ni Netlify. Lorsque la campagne CI est requise, la regrouper à la fin du chantier et privilégier les vérifications GitLab disponibles, sans déclencher de job de déploiement. En l’absence de runner adapté, exécuter les contrôles statiques et tests ciblés accessibles et rapporter précisément le contrôle CI manquant.
4. **Exécution de bout en bout :** inspecter le code pertinent, identifier la cause réelle, modifier le code, exécuter les tests pertinents et corriger les échecs. Préparer une version vérifiable. Ne déployer en Production qu’après autorisation explicite et uniquement si le mandat actif ne l’interdit pas. Pour l’audit 360 Administrateur régi par le NAXA-MANDAT CTO, aucun déploiement ni relancement de déploiement n’est autorisé.
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

## Méthode de construction incrémentale et définition de « construction verte »

### Boucle obligatoire pour chaque fonctionnalité
1. **Construire une tranche utilisable**, et non accumuler des audits ou des plans : interface visible, état vide/chargement/erreur utile, action métier principale et résultat observable.
2. **Est-ce branché ?** Vérifier que chaque bouton, formulaire, lien et action annoncés appelle bien le bon gestionnaire et produit une réponse visible. Aucun bouton décoratif présenté comme opérationnel.
3. **Est-ce connecté ?** Vérifier le raccordement réel aux données, à l'identité connectée, au périmètre pharmacie et aux contrôles serveur/RPC/RLS concernés. Ne jamais déduire l'autorisation du seul affichage UI.
4. **Est-ce testable ?** Ajouter ou adapter les vérifications ciblées faisables avec les outils disponibles, puis rendre le parcours atteignable et visible dans l'application ou dans un environnement de test réellement accessible. Fournir le chemin précis pour l'essayer.
5. **Vérifier avant de remettre** tout ce qui peut être contrôlé sans intervention utilisateur : inspection ciblée du code, références/imports, cohérence des types et contrats visibles, logique des états, contrôles d'accès pertinents, tests ciblés et exécution locale/outils lorsqu'ils sont disponibles. Lancer les contrôles plus larges lorsque cela est demandé ou lorsqu'ils sont nécessaires pour lever un risque concret ; ne pas retarder chaque fonctionnalité par une campagne générale.
6. **Passer la main à l'utilisateur pour la recette métier visible.** L'utilisateur teste le parcours réel. S'il remonte un défaut, corriger ce défaut ciblé, refaire les vérifications pertinentes et proposer un nouveau test. Une fois accepté, passer à la fonctionnalité suivante.
7. **Raisonner par contradiction** : comparer résultat attendu, comportement réellement implémenté et preuves disponibles. Traiter seulement le blocage qui empêche le parcours courant, sauf risque sérieux de sécurité ou d'intégrité des données.

### Définition du statut « construction verte »
Une fonctionnalité est **🟢 CONSTRUCTION VERTE — TEST UTILISATEUR POSSIBLE** lorsque l'assistant a réalisé tout ce qui est raisonnablement faisable avec les accès, outils et environnements disponibles pour que la fonctionnalité soit implémentée, branchée, connectée et testable de manière visible. Cela inclut les vérifications ciblées que l'assistant peut effectivement exécuter. Le parcours doit être suffisamment accessible pour que l'utilisateur puisse le tester sans devoir terminer lui-même la construction.

Ce statut signifie que la construction est prête pour la recette utilisateur ; **il ne signifie pas que l'utilisateur a déjà validé le comportement métier**, ni que tous les tests, la CI, le build complet ou la Production sont verts. Indiquer séparément, sans les confondre :
- **Construction** : 🟢 prête à tester / 🟡 partielle ou bloquée / 🔴 non construite.
- **Vérifications exécutées** : nom et résultat réel de chaque contrôle pertinent.
- **Recette utilisateur** : à faire / réussie / défaut signalé.
- **CI/build/lint/typecheck** : exécuté avec résultat / non exécuté / bloqué, avec la raison.
- **Déploiement/Production** : non effectué sauf ordre explicite ; ne jamais le laisser entendre par le statut de construction.

Si un accès, un secret, un environnement ou un outil indisponible empêche une vérification, terminer les autres travaux indépendants, rendre visible ce qui peut l'être, puis préciser le blocage exact. Ne jamais simuler un test, inventer une URL accessible, appeler « vert » un écran non raccordé ou transférer à l'utilisateur une tâche de construction évitable.

### Priorité de livraison
- Priorité à une fonctionnalité concrète et essayable plutôt qu'à un audit général répétitif.
- Ne pas attendre la fin de toutes les fonctionnalités pour remettre une première tranche testable.
- Regrouper CI/build/lint/typecheck en fin de lot; utiliser GitLab lorsque le runner de validation est disponible, sans déclencher de déploiement. Si la CI n’est pas accessible, poursuivre toutes les vérifications statiques et ciblées possibles, puis signaler uniquement la preuve CI manquante. Un mandat actif interdisant le déploiement prévaut même si les changements sont prêts.
- Aucun déploiement sans autorisation explicite. Aucune écriture dans Supabase Production.
- Rapport de fin bref : **Fait / Preuve / Statut de construction / Recette utilisateur / Reste / Suite**.
