# Réconciliation RBAC Comptable — 30 octobre 2026

## Cause racine
La migration historique 072 déclare le privilège `MANAGE_ACCOUNTING`, l'inscrit pour la fonction `comptable` et l'ajoute aux matrices d'architecture. Cette migration n'était toutefois pas présente dans l'historique appliqué de la base de rejeu contrôlée : le catalogue et la matrice y étaient vides pour Comptable.

Un second défaut indépendant se trouvait dans `private.naxa_has_privilege(text,uuid,text)` : le moteur ne traitait comme rôles de matrice que `promoteur`, `responsable` et `caisse`. Les fonctions professionnelles étaient envoyées dans la branche des rôles personnalisés. Ainsi, même avec un privilège déclaré, Comptable ne pouvait pas passer la garde canonique.

## Correction sur main
- Migration additive : `supabase/migrations/20261030100000_comptable_professional_privilege_reconciliation.sql`.
- Test de contrat : `supabase/tests/264_comptable_professional_privilege_reconciliation.sql`.
- Le catalogue `MANAGE_ACCOUNTING`, la matrice de fonction et les quatre architectures sont réconciliés.
- La résolution de rôle inclut explicitement les fonctions professionnelles canoniques, dont `comptable`.
- Les gardes de scope et d'attribution nominative dans `naxa_profile_privileges` sont conservées.
- Aucun privilège individuel n'est attribué automatiquement.
- Aucun rôle technique `profiles.role` nouveau n'est créé.

## Vérification
- Migration appliquée au projet de rejeu `pwfftcsjyeibxxqhwysw` uniquement : succès.
- Assertions SQL structurelles exécutées après migration : PASS (catalogue actif, mapping fonction, quatre architectures, présence des contrôles de scope et d'attribution, absence d'EXECUTE pour anon).
- Tests comportementaux avec de vrais comptes Comptable, tests croisés inter-pharmacies et build Next/TypeScript : non exécutés.
- Production : aucune migration, aucune donnée modifiée, aucun réglage ni secret modifié.
- Vercel : aucun déploiement.
