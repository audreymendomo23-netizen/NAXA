# NAXA — sécurité et cohérence du parcours Promoteur

## Invariants métier

- Un Promoteur dispose d'une convention et d'un abonnement canoniques ; chaque pharmacie liée doit être active et porter la même architecture que la convention.
- Un abonnement Promoteur ne peut référencer que la convention du même Promoteur. Un abonnement marqué actif ne peut pas avoir une échéance passée.
- Les privilèges effectifs sont vérifiés en base. Un privilège doit être actif, délégable et non gouvernance (`governance=false` et `governance_only` différent de true).
- Le scope `RESEAU` ne donne accès qu'aux pharmacies liées activement au Promoteur. Les lignes de privilèges réseau utilisent `pharmacie_id IS NULL`.
- L'architecture `PARENTS_ENFANTS` n'autorise pas `CREATE_RESPONSABLE`; `PARENTS_AINES_CADETS` l'autorise.
- Le Promoteur peut lire sa convention, son abonnement et ses paiements ; les écritures commerciales restent réservées à l'administration.
- Les façades RPC exposées sont `SECURITY INVOKER` lorsque la logique peut être isolée dans le schéma privé. Les mutations sensibles restent dans des fonctions privées `SECURITY DEFINER`, avec validations d'acteur, de cible, de scope et d'architecture.

## Réconciliation Production

Les migrations additives 134–153 restaurent le schéma contrat/architecture manquant, les RPC d'accréditation et de gestion Caisse, les gardes de validité commerciale, la cohérence convention/abonnement, la séparation entre validité interne et façade publique, les politiques RLS de lecture commerciale propre et les façades invoker.

Les migrations historiques 019/020 ne doivent pas être rejouées en bloc sur Production : le catalogue réel comporte des différences de colonnes et certaines définitions RPC de ces fichiers sont anciennes. La migration 137 est donc une réconciliation ciblée qui évite d'écraser les fonctions de sécurité installées.

## Preuves de régression SQL

Exécutés sur le projet Supabase NAXA Production :

- Parcours métier : tests 024, 026, 027, 029, 030, 031, 032 et 039 — PASS transactionnel.
- Pilotage hors périmètre : test 033 — PASS observé après adaptation du test pour utiliser les claims JWT ; un nouvel appel a ensuite été bloqué par les contrôles de sécurité de l'outil, sans erreur SQL retournée.
- Gardes de révocation/attribution : tests 134, 135, 140, 146, 147 et 149 — PASS.
- Façades invoker et helpers hiérarchiques : tests 151, 152 — PASS ; RPC admin-only : test 153 — PASS.
- Schéma, quotas, cohérence et ACL : tests 137, 139, 141, 142, 143, 144, 145, 148 et 150 — PASS.
- Le test transactionnel 154 de réactivation administrative a été ajouté, mais son exécution via l'outil SQL a été bloquée par les contrôles de sécurité ; il n'est donc pas compté comme PASS.

Les tests comportementaux créent des fixtures transactionnelles et se terminent par `ROLLBACK`. Le contrôle SQL Production a confirmé qu'aucun compte ou abonnement de test n'a persisté.

## Limites de vérification restantes

- Production contient actuellement **0 Promoteur**, **0 convention Promoteur** et **0 abonnement Promoteur**. Les scénarios ont donc été validés par fixtures transactionnelles ; aucun parcours réel avec un compte Promoteur existant n'était disponible.
- La compilation/déploiement Vercel de la tête actuelle de `main` est bloquée par l'API Vercel : HTTP 402 `api-deployments-free-per-day`, limite quotidienne dépassée (réessayer après 24 h ou résoudre la limite du plan). Aucun déploiement de la tête actuelle n'est confirmé.
- L'advisor Supabase signale encore des avertissements génériques sur des RPC `SECURITY DEFINER` d'autres domaines et la protection contre les mots de passe compromis désactivée. Ces éléments n'ont pas été modifiés sans une surface de configuration/validation adaptée.
