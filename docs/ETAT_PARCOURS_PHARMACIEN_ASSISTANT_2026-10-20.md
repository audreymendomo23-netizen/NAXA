> **Document remplacé le 20 octobre 2026.** Le poste Assistant pharmacien a été supprimé comme fonction distincte. Se référer à [l’état du parcours Pharmacien unifié](./ETAT_PARCOURS_PHARMACIEN_UNIFIE_2026-10-20.md) et à la migration 127. Les éléments ci-dessous décrivent l’état historique avant unification et ne constituent plus la cible actuelle.

# État de construction — Pharmacien et Assistant pharmacien
Date : 20 octobre 2026

## Référence
- Dépôt : `audreymendomo23-netizen/NAXA`
- Branche : `main`
- Cahier de référence métier : `docs/CAHIER_DES_CHARGES.md` et les migrations ERP ordonnances existantes.

## Faits vérifiés dans le code avant cette passe
- `/pharmacie/pharmacien` existait, avec consultation, émission de prescription et contrôle des ordonnances.
- `/pharmacie/assistant` n'existait pas dans l'arborescence de `main`.
- La page Pharmacien exigeait `fonction_interne='pharmacien'`.
- La migration historique `045_prescription_vente.sql` autorisait `pharmacien_assistant` à appeler la validation d'ordonnance, sans contrôle du privilège individuel.
- La contrainte de `fonction_interne` de la migration 045 n'autorisait pas la valeur `pharmacien` attendue par la page.
- La politique RLS historique de lecture des prescriptions et lignes ne donnait pas explicitement l'accès en lecture à `pharmacien`.

## Changements ajoutés sur main
- Ajout de `src/app/pharmacie/assistant/page.tsx` : consultation des dossiers reçus, notes de préparation, transmission au Pharmacien, suivi des demandes de complément et historique récent des décisions.
- Ajout d'un lien vers l'espace Assistant pharmacien depuis le panneau pharmacie.
- Extension de `src/app/pharmacie/pharmacien/page.tsx` : affichage des notes de préparation et demande de complément depuis le dossier.
- Ajout de `supabase/migration_125_pharmacien_assistant_workflow.sql` :
  - harmonise la contrainte des fonctions internes ;
  - ajoute une table de suivi de préparation distincte du statut pharmaceutique ;
  - ajoute une RPC de soumission Assistant ;
  - réserve la décision au Pharmacien, ou à un Assistant dont le privilège `VALIDATE_PRESCRIPTION` est réellement accordé via `naxa_has_privilege`.
- Ajout de `supabase/migration_126_pharmacien_prescription_read_rls.sql` : ouvre la lecture nécessaire au Pharmacien en RLS sans lui accorder l'édition directe des lignes de prescription.

## Contrôles non exécutés
- Aucun build, lint, typecheck, test automatisé ou test SQL exécuté dans cette passe.
- Aucune migration Supabase appliquée à la production.
- Aucun déploiement déclenché.

## Statut honnête
- Code et migrations : ajoutés à `main`.
- Parcours : construit au niveau interface + contrat SQL proposé, mais non validé en exécution.
- Dépendance bloquante avant usage réel : les migrations 125 et 126 doivent être appliquées dans un environnement de test autorisé et les privilèges de validation doivent être attribués explicitement si l'on veut déléguer la décision à un Assistant. Sans ce privilège, l'Assistant prépare et transmet mais ne valide pas.
- Ne pas considérer le parcours comme complet en production tant que compilation, tests RLS/RPC et recette des deux profils ne sont pas prouvés.
