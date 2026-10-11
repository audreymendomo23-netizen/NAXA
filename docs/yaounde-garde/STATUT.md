# NAXA — Statut du croisement des pharmacies de garde à Yaoundé

Date : 11 octobre 2026  
Branche : `feat/yaounde-garde-crosscheck`  
Périmètre : comparer les captures Facebook « Pharmacies de Garde (Yaoundé) » et Mfasha pour une période de garde identique.

## Audit effectué

- Les deux sources publient des listes datées, mais les exemples retrouvés ne couvrent pas toujours la même période.
- Facebook/FindGlocal fournit des publications datées et leurs horaires; Mfasha affiche une liste par période de garde.
- Les listes ne doivent pas être fusionnées sur la seule base de noms semblables lorsque les périodes diffèrent.
- La collecte automatique directe depuis Facebook n'est pas encore démontrée; le traitement développé ici compare des captures CSV.

## Modifications sur cette branche isolée

- `scripts/compare_yaounde_garde_sources.py` : comparaison CSV conservatrice, validation des colonnes, dates avec fuseau, période unique par capture, correspondance par nom normalisé puis par numéro commun unique, comparaison des localisations et conservation des deux provenances.
- `scripts/test_compare_yaounde_garde_sources.py` : tests unitaires pour la concordance partielle, les variantes de nom, les conflits de téléphone, les périodes différentes, la source unique et les dates sans fuseau.
- `.circleci/config.yml` : ajout d'une étape exécutant les tests unitaires dans le job `sql_tests`.
- `docs/yaounde-garde/README.md` : règles d'utilisation et limites documentées.

## Règles de sûreté

- Refuser de comparer deux captures dont les périodes exactes diffèrent.
- Ne jamais convertir une concordance de nom/téléphone en confirmation officielle de la garde.
- Conserver les URL de chaque source.
- En cas de conflit de téléphone ou de localisation, marquer la ligne `a_verifier_ne_pas_publier`.
- En cas de présence dans une seule source, garder `source_secondaire_non_confirmee`.
- Aucun enregistrement n'est automatiquement déclaré confirmé.
- Aucun import Supabase ni déploiement Production.

## Tests et état

- [x] Branche de travail isolée créée depuis `feat/yaounde-taxi-estimate`.
- [x] Script de comparaison et tests unitaires ajoutés.
- [x] Étape de tests ajoutée au job CircleCI `sql_tests`.
- [ ] Exécution locale des tests unitaires avec résultat observé.
- [ ] CI du commit courant exécutée et verte.
- [ ] Essai sur deux captures réelles de la même période.
- [ ] Validation de la collecte automatisée et de sa fréquence.
- [ ] Aucun import en base ni publication client avant la preuve de tests et la vérification des données.

**Statut : EN COURS — NON CERTIFIÉ VERT.**  
La fonctionnalité est limitée au croisement de captures CSV. L'automatisation de la collecte web, notamment depuis Facebook, n'est pas encore opérationnelle ni garantie. La branche ne doit pas être fusionnée vers `main` ni déployée en Production avant exécution réussie des tests, contrôle CI et validation des données.
