# NAXA — format d'import des listes d'assurés

## Fichier modèle

Le modèle vierge de référence est servi dans l'espace professionnel à l'adresse :

`/modeles/assureur-liste-assures-exemple.csv`

Le fichier contient une ligne d'exemple explicitement fictive. **Supprimer cette ligne avant d'utiliser le modèle avec un vrai export assureur.** Aucun identifiant ou nom réel n'est inclus.

## Colonnes reconnues

| Colonne canonique | Obligatoire | Usage |
|---|---:|---|
| `numero_adherent` | Oui | Identifiant exact de l'adhérent ; ne pas reformater ni supprimer les zéros initiaux |
| `numero_police` | Non | Identifiant exact de la police/du contrat ; lorsqu'il est fourni, il doit correspondre à la valeur du dossier NAXA |
| `beneficiaire_nom` | Non, mais recommandé | Nom normalisé du bénéficiaire ; utile lorsque plusieurs couvertures utilisent le même numéro d'adhérent et la même police |
| `date_debut` | Oui | Date d'effet au format `AAAA-MM-JJ` ou `JJ/MM/AAAA` |
| `date_fin` | Non | Fin de droit ; même format de date |
| `statut` | Oui | `actif`, `suspendu` ou `expire` (plusieurs libellés usuels de l'assureur sont normalisés) |

Les colonnes peuvent utiliser les alias courants français/anglais acceptés par l'écran. Les dates Excel natives sont prises en charge dans XLS/XLSX. Utiliser de préférence les noms canoniques du modèle pour éviter toute ambiguïté.

## Règles de rapprochement

- L'import est toujours limité à une pharmacie et un assureur choisis.
- Le fichier est simulé avant application. L'empreinte SHA-256 et la référence de transmission sont conservées.
- La correspondance doit être exacte sur le numéro d'adhérent et la police ; si un bénéficiaire est fourni, son nom normalisé est également vérifié.
- Une correspondance nulle, multiple, répétée ou invalide n'est jamais considérée comme une vérification.
- Une liste **complète** remplace les états antérieurs de vérification pour cet assureur et cette pharmacie, après simulation.
- Un **delta** ne modifie que les personnes présentes dans le fichier ; les autres conservent leur dernier état.
- L'import ne crée aucun compte Client et ne remplace pas le contrôle séparé des justificatifs au retrait.

## Provenance et confidentialité

La référence de transmission et le SHA-256 assurent la traçabilité de la pièce reçue et l'intégrité du contenu traité. Ils ne prouvent pas cryptographiquement l'identité de l'assureur émetteur. L'opérateur habilité reste responsable de vérifier le canal de réception et l'origine du fichier avant simulation/application. Les fichiers réels doivent être traités dans le périmètre RLS de la pharmacie et ne doivent pas être envoyés dans des dépôts publics ou des tickets de développement.

## Limite de recette

Les tests Replay exécutent des lignes synthétiques et les contrats de sécurité/rapprochement. Aucun export réel d'assureur n'a été fourni dans cette recette ; la compatibilité avec le format propriétaire d'un assureur doit donc être confirmée à partir d'un exemple expurgé de données personnelles.
