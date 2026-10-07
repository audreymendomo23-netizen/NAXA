# NAXA — Reprise contrôlée depuis main — baseline du 07/10/2026

## Règle de reprise
La branche `rewrite/naxa-from-main-20261007` est isolée de `main`. Aucun changement Production n'est effectué par ce chantier tant que la reconstruction complète n'est pas auditée et explicitement autorisée.

Source de vérité fonctionnelle : dernière fonctionnalité validée par le fondateur, croisée avec le cahier des charges v3.7, le prompt maître, le code existant et l'état réel Supabase.

## Partie 1 — audit du socle : VERT

### Contrôles exécutés
- Projet Supabase NAXA accessible et requêtes SQL réelles exécutées.
- Historique distant Supabase vérifié : migrations jusqu'à `042_stats_pilotage_facade_security`.
- Branch rewrite GitHub vérifiée et isolée de `main`.
- README/STATUT historiques inspectés : ils décrivent encore un état antérieur à la consolidation Pilotage 360 / privilèges / convention.
- Modèle réel des tables de gouvernance inspecté : profiles, pharmacies, promoteur_pharmacies, architectures, abonnements, privilèges et rôles personnalisés.
- Conseillers Supabase exécutés après audit.

### État réel mesuré
- profiles : 2
- pharmacies : 3
- privilèges catalogue : 104
- privilèges effectivement attribués : 0
- relations Promoteur → pharmacie : 0
- abonnements : 3
- réservations : 4
- stocks : 9
- lots de stock : 0

### Contradictions isolées
1. La documentation historique annonce une architecture Promoteur/Caisses consolidée, alors que le modèle réel distant est désormais beaucoup plus avancé et comprend architectures, privilèges et pilotage 360.
2. Le catalogue de 104 privilèges existe, mais aucune attribution effective n'est présente dans les données actuelles : le moteur d'autorisation ne peut donc pas être déclaré opérationnel par simple présence du catalogue.
3. Aucune relation Promoteur → pharmacie n'est présente dans les données actuelles : le scope réseau Promoteur ne peut pas être déclaré opérationnel sur données réelles.
4. Le dépôt de la branche de reprise ne contient pas actuellement le répertoire de migrations Supabase historique attendu : la reconstruction doit donc produire une source de migration canonique sans recopier aveuglément l'historique distant.
5. L'advisor sécurité signale une seule alerte actuelle : protection contre les mots de passe compromis désactivée. Elle est conservée comme chantier sécurité séparé et non masquée par la reconstruction.
6. Les 25 index signalés inutilisés sont des informations de performance, pas des suppressions à effectuer sans preuve d'usage.

## Décision
Le socle fonctionnel à reconstruire est confirmé. Aucun objet métier existant n'est supprimé à cette étape. La prochaine partie doit traiter le **socle DB canonique : profils + hiérarchie N0→N4 + architectures**, avec tests contradictoires et vérification transactionnelle avant tout changement persistant.

## Critère de sortie de la Partie 1
- périmètre isolé : OK
- état réel vérifié : OK
- contradictions documentées : OK
- Production inchangée : OK
- décision de reconstruction : OK

**Partie 1 : VERT — 100 % de son objectif d'audit.**
