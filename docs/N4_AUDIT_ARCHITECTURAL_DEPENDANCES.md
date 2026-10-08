# N4 — Audit architectural des dépendances SQL

Date : 08/10/2026
Branche : rewrite/naxa-from-main-20261007

## Objectif
Sortir du dépannage séquentiel « une erreur → une relance » et contrôler la chaîne complète de construction PostgreSQL/Supabase avant de consommer un nouveau run CircleCI.

## Contradiction principale
La migration 013 créait les policies de stocks_couts avec public.can_access_pharmacy(uuid), alors que la première définition canonique de cette fonction se trouvait en migration 016. Un replay depuis zéro ne peut pas satisfaire cette dépendance.

## Correction
La migration 013 contient maintenant un bootstrap minimal de même signature, basé sur my_pharmacie(). La migration 016 remplace ensuite ce bootstrap par la logique canonique multi-pharmacie basée sur my_pharmacies() et promoteur_pharmacies.

Cette stratégie ne crée pas un second moteur d'autorisation : elle établit le contrat minimal nécessaire au replay, puis laisse le moteur multi-pharmacie canonique prendre le relais.

## Contradiction secondaire
La migration 033 utilisait public.profile_privileges, alors que l'architecture canonique 020 utilise public.naxa_profile_privileges. La référence a été alignée sur le modèle canonique.

## Garde CI
Le préflight vérifie :
- présence du bootstrap can_access_pharmacy avant sa première utilisation en 013 ;
- absence de référence à l'ancien public.profile_privileges dans les migrations ;
- contrôles historiques de duplication et d'ordre déjà présents.

## Test de régression
supabase/tests/013_stocks_couts_dependencies.sql vérifie la présence de can_access_pharmacy(uuid), naxa_profile_privileges, stocks_couts et de la policy de lecture stocks_couts_lecture après replay.

## Règle de validation
Ces corrections sont construites et statiquement contrôlées, mais N4 n'est pas vert. Le vert exige un replay complet du schéma, de toutes les migrations et l'exécution de tous les tests SQL au même HEAD, avec preuve exploitable.

Aucun merge vers main et aucun déploiement Production n'est effectué par cet audit.
