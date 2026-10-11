# NAXA — Données de contrôle des pharmacies de garde à Yaoundé

**Date de collecte :** 11 octobre 2026 (heure locale du Cameroun, UTC+01:00)  
**Période publiée par la source principale :** 10 octobre 2026 à 08:00 → 12 octobre 2026 à 08:00.  
**Statut :** jeu de données de recherche, NON validé pour publication client et NON importé en base.

## Sources

1. **Mfasha — source principale de collecte** : https://mfasha.com/  
   La page indexée le 11 octobre présente 19 pharmacies et la période 10/10/2026 08:00–12/10/2026 08:00.
2. **FindGlocal — « Pharmacies de Garde (Yaoundé) »** : https://www.findglocal.com/CM/Yaound%C3%A9/379020058785305/Pharmacies-de-Garde-%28Yaound%C3%A9%29  
   Fournit des listes datées et permet de recouper certains noms, quartiers et téléphones, mais les exemples visibles couvrent d'autres jours (notamment 2–8 octobre). Ce n'est donc pas une confirmation indépendante de la garde du 10–12 octobre.
3. **MboaPHARMA — annuaire de pharmacies de Yaoundé** : https://mboapharma.cm/single-location-3/yaounde/?directory_type=pharmacie&view=list  
   Annuaire utile pour l'identité et les coordonnées de certaines pharmacies; ne confirme pas les tours de garde.
4. **DPML — liste des établissements pharmaceutiques agréés** : https://dpml.cm/index.php/fr/catalogue/liste-des-etablissements-pharmaceutiques-agrees  
   Répertoire institutionnel; la liste est indiquée comme mise à jour le 15 juillet 2026. Il reste à vérifier individuellement les 19 établissements dans le fichier officiel.

## Résultat du croisement

- 19 lignes copiées de la liste Mfasha pour la période indiquée.
- Plusieurs noms/quartiers/téléphones apparaissent dans des publications secondaires de dates différentes.
- Aucune seconde source récupérée ne confirme indépendamment la même liste complète pour la période exacte 10–12 octobre.
- Écart à examiner : **Pharmacie Nsimeyong** — Mfasha présente 692 22 83 19 comme numéro principal, alors qu'une publication FindGlocal antérieure reprend 694 01 12 46 et 620 26 36 89. Les deux numéros alternatifs concordent; le numéro principal demande confirmation.
- Les données du CSV sont marquées `source_secondaire_non_confirmee`. Ne pas transformer le booléen historique `de_garde` en confirmation datée sur la seule base de cette liste.
- Les sources de garde sont dynamiques : ce fichier est une photographie de recherche du 11 octobre, pas une liste réutilisable pour d'autres dates.

## Critères de validation avant import

1. Confirmer l'identité et l'agrément de chaque établissement auprès de la DPML et/ou d'une source institutionnelle.
2. Obtenir une seconde source pour la période exacte, ou une confirmation directe de la pharmacie/autorité compétente.
3. Normaliser les téléphones sans supprimer les variantes; résoudre les divergences et conserver les preuves.
4. Associer les lignes aux identifiants de pharmacie NAXA seulement après concordance nom + quartier + adresse/téléphone. Ne pas créer de doublons automatiquement.
5. Importer dans une base de test propre, vérifier contraintes de période, fuseau horaire, statut avant/durant/après la garde, doublons et absence de publication des lignes non confirmées.
6. Toute photo doit être traitée séparément : identité exacte, URL source et droits de réutilisation établis.

## État des tests

- Contrôle de structure du CSV : à exécuter sur ce fichier.
- Rejeu SQL : NON exécuté; aucune base propre de test identifiée et prouvée pour ce jeu de données dans cette étape.
- Production : aucune écriture, aucune migration appliquée, aucun déploiement.
- Décision : **NO-GO pour l'import client**, jeu de données utilisable pour le travail de vérification uniquement.
