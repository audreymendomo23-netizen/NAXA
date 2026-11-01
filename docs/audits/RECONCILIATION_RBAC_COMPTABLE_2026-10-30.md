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


## Complément — correction du contrôle d'accès Comptable (01/11/2026)

Une contradiction supplémentaire a été reproduite sur le rejeu : `public.naxa_can` renvoie `false` pour un privilège d'action appelé avec `p_target = NULL`, cette forme étant réservée aux privilèges `VIEW_*`. Or les pages Comptable et `compta_scope_autorise` demandaient `MANAGE_ACCOUNTING` avec une cible nulle. Le contrôle pouvait donc refuser un Comptable pourtant correctement attribué.

- Migration additive `20261101090000_comptable_scope_privilege_fix.sql` : `compta_scope_autorise` vérifie maintenant la fonction professionnelle, le scope pharmacie et `private.naxa_has_privilege('MANAGE_ACCOUNTING', ..., 'PHARMACIE')` directement. Le contrat générique de `naxa_can` n'est pas modifié.
- Pages Comptable, actions serveur, layout commun et API Rapports utilisent désormais ce contrôle dédié.
- Le layout commun fournit la navigation persistante sur toutes les pages Comptable; le composant identifie la route active.
- Rapport Promoteur : le périmètre inclut désormais toutes les pharmacies actives du réseau, sans condition supplémentaire de visibilité publique dans la recherche.
- Tests structurels 264, 265 et 266 exécutés après application de la migration au rejeu `pwfftcsjyeibxxqhwysw` : PASS (aucune exception SQL).
- Aucun profil Comptable de test n'existe dans ce rejeu au moment du contrôle (0 profil identifié par fonction ou par `naxa_business_function`). Les tests authentifiés réels, refus inter-pharmacies, build Next/TypeScript et recette navigateur restent donc ouverts.
- Production et Vercel inchangés; aucune migration Production ni aucun déploiement.


## Preuve transactionnelle d'isolation inter-pharmacies — 01/11/2026

- Test ajouté : supabase/tests/267_comptable_cross_pharmacy_isolation.sql.
- Fixture synthétique avec deux pharmacies du même réseau, Comptable rattaché à A et privilège nominatif MANAGE_ACCOUNTING accordé uniquement sur A.
- Assertions exécutées : compta_scope_autorise(A)=true, compta_scope_autorise(B)=false; RPC de démarrage écrit sur A; RPC de clôture refuse une session B appartenant pourtant au même compte; la session A peut être clôturée.
- Résultat : PASS transactionnel. Le test se termine par ROLLBACK; aucune fixture ne persiste dans Replay.
- Les tests 264–266 restent les preuves de contrat RBAC/RLS/ACL. Cette preuve ajoute le test comportemental du helper et des RPC, mais ne remplace pas une recette navigateur avec un compte connecté.
