# NAXA — Statut chantier taxi Yaoundé

Date : 11 octobre 2026  
Branche : `feat/yaounde-taxi-estimate`  
Périmètre : affichage d'une estimation indicative de coût de taxi sur la page de résultats existante.

## Réalisé
- [x] Branche isolée créée depuis `main`.
- [x] Fonction pure `estimerTaxiFcfa(distanceKm)` ajoutée dans `src/lib/taxi.ts`.
- [x] Fourchette indicative affichée sur `/resultats`, calculée avec la distance routière déjà disponible.
- [x] Mention visible indiquant que le barème est provisoire, non validé sur le terrain, et que le prix reste à négocier.
- [x] README mis à jour.
- [x] Aucune migration ni écriture Supabase Production.

## Hypothèses et limites
- Le barème de départ (base et coût au kilomètre) est une hypothèse logicielle, pas un tarif officiel. Il faut le calibrer avec des trajets réels et des chauffeurs à Yaoundé avant de présenter cette estimation comme fiable.
- Le code de circulation existant estime les heures de pointe à partir de l'heure et du jour ; il ne fournit pas de trafic temps réel.
- Si OSRM échoue, le trajet retombe sur une distance/durée approximative ; le coût taxi est alors également approximatif.
- L'estimation concerne une course individuelle négociée. Elle ne réserve pas un taxi et ne garantit pas la disponibilité du chauffeur.

## À vérifier avant tout feu vert
- [ ] Installer les dépendances et exécuter le build Next.js.
- [ ] Exécuter ESLint/lint et corriger toute régression.
- [ ] Tester plusieurs distances (valeur nulle, distance courte, distance longue et valeur non finie).
- [ ] Tester la page sur mobile, avec et sans GPS, et avec OSRM disponible/indisponible.
- [ ] Recueillir des prix observés à Yaoundé, documenter le barème et ajuster les paramètres.
- [ ] Déterminer si une source de trafic temps réel fiable et utilisable gratuitement couvre Yaoundé.

## Statut actuel
**EN COURS — non certifié vert.** Les fichiers ont été modifiés sur cette branche distante, mais le build, le lint et les tests d'intégration n'ont pas été exécutés dans cet environnement. Aucune PR, fusion ni livraison Production n'a été effectuée.
