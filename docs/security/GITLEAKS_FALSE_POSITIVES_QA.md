# Registre des résultats Gitleaks — branche QA

Dernier scan complet du 06/11/2026 : Gitleaks v8.30.1, 5 211 commits analysés, environ 31,46 MB examinés, profondeur d'archives 2.

## Résultats classés

Les quatre alertes `generic-api-key` émises lors du scan historique ont été ouvertes au commit d'origine et vérifiées dans le code :

| Empreinte | Valeur publique dans le code | Nature vérifiée | Décision |
|---|---|---|---|
| `c71d9fea…:NAXA-main.zip!…/ActionProtegee.tsx:7` | `naxa-age-declaration-v1` | Nom fixe de clé localStorage du contrôle d'âge | Faux positif étroitement ignoré |
| `8085f778…:NAXA-main.zip!…/ActionProtegee.tsx:7` | `naxa-age-declaration-v1` | Même nom de clé dans l'archive historique | Faux positif étroitement ignoré |
| `c345ce93…:src/components/ActionProtegee.tsx:7` | `naxa-age-declaration-v1` | Nom fixe de clé localStorage du contrôle d'âge | Faux positif étroitement ignoré |
| `040344ef…:src/components/AccueilClient.tsx:66` | `naxa-recherche-navigation-recente-v1` | Nom fixe de clé localStorage pour historique de recherche | Faux positif étroitement ignoré |

Ces chaînes ne sont ni des secrets d'authentification, ni des clés d'API, ni des mots de passe, ni des jetons. Elles sont lues/écrites par `window.localStorage`.

Les quatre empreintes exactes sont consignées dans `.gitleaksignore`. Aucune règle Gitleaks globale, aucun motif `generic-api-key` entier et aucun répertoire complet n'ont été désactivés.

## État de la certification

- Le scan historique complet a correctement détecté ces quatre chaînes et a échoué, ce qui montre que le scanner parcourt bien l'historique et les ZIP.
- Un nouveau scan avec la liste d'exclusion très ciblée doit réussir avant que le contrôle Secret Scan puisse être déclaré vert.
- Le scan du répertoire courant (y compris les ZIP) doit aussi être exécuté et réussi.
- Une alerte nouvelle, avec une empreinte différente, continue de bloquer le contrôle.
- Cette disposition n'autorise pas à rendre le dépôt public tant que les autres fichiers binaires, contenus internes et workflows de sauvegarde n'ont pas été examinés.

## Sécurité des données

Ne jamais inscrire les valeurs de secrets dans ce registre. En cas de véritable jeton ou mot de passe trouvé dans l'historique, le considérer compromis, le révoquer/rotater puis documenter son remplacement ; l'effacement du commit n'annule pas l'exposition historique.
