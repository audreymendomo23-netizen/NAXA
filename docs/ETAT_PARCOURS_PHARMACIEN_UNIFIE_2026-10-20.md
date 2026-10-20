# État du parcours Pharmacien unifié — 20 octobre 2026

## Décision métier
- Un seul poste interne : **Pharmacien**.
- Le poste Assistant pharmacien est supprimé comme fonction distincte.
- Une interface opérationnelle unique : `/pharmacie/pharmacien`.
- L'ancienne URL `/pharmacie/assistant` redirige vers l'espace Pharmacien pour conserver les anciens liens.
- Les comptes qui portaient `fonction_interne='pharmacien_assistant'` sont convertis vers `pharmacien` par la migration 127.

## Les 8 entrées du panneau latéral
1. Tableau de bord
2. Consultations
3. Prescriptions
4. Ordonnances
5. Préparations
6. Suivi des dispositifs Patient — ouvre le parcours existant `/suivi`
7. Profil
8. Déconnexion

Les entrées 1 à 5 et 7 restent dans l'espace Pharmacien. L'entrée 6 ouvre la page de suivi des dispositifs existante et requiert une connexion ; la déconnexion est une action du panneau latéral.

## Fichiers modifiés
- `src/app/pharmacie/pharmacien/page.tsx` : interface commune avec consultation, prescription, préparations et décisions d'ordonnance.
- `src/components/pharmacie/PharmacienWorkspaceSidebar.tsx` : panneau latéral responsive à huit entrées, dont le lien vers `/suivi`.
- `src/app/pharmacie/assistant/page.tsx` : redirection de compatibilité vers l'interface commune.
- `src/app/pharmacie/page.tsx` : retrait du lien séparé Assistant pharmacien.
- `supabase/migration_127_unified_pharmacien_role.sql` : conversion des profils, contrainte sans fonction Assistant, renommage de la colonne d'acteur de préparation et RPC Pharmacien pour préparation et décision.

## Limites de vérification
- Les changements sont enregistrés sur `main`.
- La migration 127 n'a pas été appliquée à Supabase.
- Aucun build, lint, typecheck, test automatisé ou test SQL n'a été exécuté dans cette passe.
- Aucun déploiement n'a été lancé.
- Le code est donc modifié, mais le parcours n'est pas encore prouvé en exécution. La migration doit être testée/appliquée avant que les profils convertis et la nouvelle RPC fonctionnent sur la base.
