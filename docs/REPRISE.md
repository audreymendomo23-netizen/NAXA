# NAXA — Reprise opérationnelle consolidée

Dernière mise à jour : 9 octobre 2026.

## Source de vérité et garde-fous
- Dépôt : `audreymendomo23-netizen/NAXA`.
- Référence Production actuelle : `main`, commit `219b8c1711a8e3781bde4ed43c23815a3998e8be`.
- Branche de chantier : `integration/naxa-360-20261009`.
- Ne jamais modifier ou fusionner dans `main` sans autorisation explicite.
- Aucun changement Supabase Production ni déploiement avant autorisation explicite « OUI, DÉPLOIE ».
- Ne jamais afficher de secret, demander de capture, ni reconstruire une fonctionnalité simplement parce que sa preuve manque.

## Diagnostic consolidé
1. La branche de rejeu inventorie 78 migrations et 52 tests, mais l'exécution complète n'est pas prouvée.
2. Le rejeu sur `naxa-ci-replay-2` est incomplet; l'arrêt de l'outil sur la migration 051 ne prouve ni succès ni échec SQL.
3. Le schéma Production observé ne contient pas plusieurs objets caisse/vente/consultation/prescription appelés par le code candidat.
4. La RPC de réservation doit imposer le contrôle d'âge indépendamment de l'interface.
5. La fonction de transition de réservation doit préserver l'intégrité statut/paiement/stock.
6. La portée d'écriture du catalogue produit doit respecter la règle d'administration confirmée.
7. Les configurations CI existantes ne prouvent pas l'exécution complète des migrations et des tests.
8. Le README et le STATUT historiques contiennent des instructions et déclarations incohérentes; voir la mise à jour du chantier.

## Exécution simultanée
Traiter dans un seul chantier coordonné :
- Réconciliation sélective des meilleures versions à partir de `main`, sans fusion aveugle des branches divergentes.
- Corrections SQL additives et tests de sécurité en base de test.
- Rejeu complet de la chaîne candidate et exécution de l'intégralité des tests.
- Réparation de CI et preuves rattachées au SHA de la branche de chantier.
- Tests des parcours client, pharmacie, caisse, pharmacien, promoteur et administration.
- Mise à jour continue de `README.md`, `STATUT.md`, de ce document et du registre fonctionnel.

## Critères de vert
- Aucun test ignoré ou prétendu exécuté sans résultat.
- Toutes les migrations attendues appliquées dans le bon ordre sur l'environnement de test.
- Suite SQL complète réussie, plus tests négatifs de sécurité.
- Build, lint et TypeScript réussis sans interaction manuelle.
- Contradictions code ↔ schéma identifiées et résolues pour les parcours livrés.
- Aucun blocage critique/majeur non résolu.
- Les preuves mentionnent branche, commit, commande/contrôle et résultat.

## État actuel
**ROUGE / NO-GO Production.** Les corrections et validations se poursuivent en parallèle sur la branche de chantier. Aucune modification de Production n'a été faite par ce chantier.
