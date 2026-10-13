# RÈGLE PRIORITAIRE NAXA — Vérifications à la fin, déploiements sans blocage CI

**Priorité : maximale pour le processus de livraison du projet.**

À compter du 13 octobre 2026, les vérifications globales (CI, tests automatisés et contrôles de validation de fin de projet) sont regroupées à la fin du projet. Une vérification CI en échec, en attente, absente ou indisponible ne doit donc plus, à elle seule, bloquer une fusion ou un déploiement demandé explicitement par le responsable du projet.

## Application obligatoire

1. Ne pas présenter la CI comme un feu vert obligatoire avant chaque déploiement.
2. En cas de CI rouge ou sans résultat, consigner honnêtement l'état connu et poursuivre le processus de livraison autorisé, sans inventer de succès.
3. Regrouper la campagne complète de vérifications à la fin du projet et documenter les résultats réels, y compris les échecs restant à corriger.
4. Respecter le périmètre exact de l'autorisation de déploiement, les protections de secrets, la sécurité des données et les restrictions explicites sur les environnements de production.
5. Cette règle ne transforme jamais un échec CI en réussite et n'autorise ni à masquer des résultats, ni à contourner les protections de sécurité, ni à effectuer des écritures de données de production non autorisées.
6. Si la plateforme de déploiement elle-même échoue (par exemple compilation impossible ou déploiement rejeté), rapporter l'erreur réelle et ne pas prétendre que la livraison a réussi.

## Formulation courte à appliquer par tous les intervenants

> **Les vérifications globales se font à la fin du projet. Ne jamais bloquer une fusion ou un déploiement uniquement parce que la CI n'est pas verte, si le responsable a explicitement autorisé la livraison. Consigner l'état CI avec transparence et poursuivre dans le périmètre autorisé.**

Cette règle gouverne le calendrier de validation du projet. Elle ne remplace pas les exigences de sécurité, l'autorisation explicite de déploiement ou la preuve factuelle du résultat de livraison.
