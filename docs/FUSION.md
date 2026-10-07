# NAXA — Matrice de fusion v3.7

Date : 07/10/2026
Branche : rewrite/naxa-from-main-20261007
Production : Supabase migration 042 ; main inchangé.

## Autorité

La matrice applique le cahier v3.7, le Prompt maître Fusion v2 et l'état réel GitHub/Supabase. Absence de preuve = non fait. Présent sur la branche ne signifie jamais déployé en Production.

## État initial de réconciliation

- Pilotage 360° : parties clôturées au vert, non reconstruites.
- Migrations 043→052 : présentes sur la branche, non persistées en Production.
- Fiches EXISTANT : conservation et non-régression, pas de reconstruction.
- Fiches NOUVEAU : construction future par phase.
- Fiches À ARBITRER : bloquées sans construction avant décision.

## Contradictions isolées

1. docs/CONTRADICTIONS.md est référencé par le Prompt maître mais absent du dépôt courant. Aucun contenu n'est inventé.
2. Des sections historiques de README/STATUT décrivent des états antérieurs ; CP-0009/CP-0010 les supersèdent.
3. Le cahier décrit Responsable comme proposition, tandis que le modèle canonique validé le traite comme N2/fonction interne. L'existant canonique prime et aucun role_type responsable n'est créé.
4. Branche et Production divergent volontairement : Production reste à migration 042.

## Statut

🟢 MATRICE DE RÉCONCILIATION — 100 % du périmètre d'audit documentaire établi.

Aucune fonctionnalité ni migration Production n'est appliquée dans cette étape.

Prochain chantier : Qualité, après clôture documentaire de cette réconciliation.