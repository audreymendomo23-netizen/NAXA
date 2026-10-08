# NAXA — Traçabilité

Mise à jour: 7 octobre 2026.

## Exécution Prompt maître Fusion v2
### 1. Reprise
- Cahier v3.7 relu depuis `naxa_cahier_des_charges_v3_7.md`.
- Prompt maître Fusion v2 relu depuis `naxa_prompt_maitre_fusion_v2.md`.
- État du dépôt relu sur la branche de travail et sur main.
- Les documents historiques ne sont pas traités comme preuve lorsqu'ils contredisent l'état réel.

### 2. Vérifications techniques
- HEAD branche: `d89b6e0b7ae3dfa1c5fba622d4945459f336f192`.
- Workflow Pilotage: `runs-on: ubuntu-latest`.
- Jobs récents observés: `build` et `pilotage-step1` créés puis échoués avec `steps=[]`, sans logs exploitables.
- Requêtes de logs: BlobNotFound, cohérent avec absence d'exécution des steps.
- Workflow de diagnostic runner temporaire: supprimé après absence de preuve de succès.
- Tests versionnés: `032_promoteur_scope_reseau_7.sql`, `033_promoteur_pilotage_hors_scope_8.sql`.
- Correction RPC: migration `042_stats_pilotage_facade_security.sql` présente dans la branche.

### 3. Règle de preuve
Aucun 🟢 CI n'est déclaré sans exécution réelle. Les preuves transactionnelles historiques sont distinguées des preuves CI et des preuves Production.

### 4. Prochain lot
Clôturer la Passe Admin du Pilotage 360° et matérialiser son test d'acceptation, puis reprendre la preuve Step 1 dès que le runner GitHub est exécutable ou qu'un environnement de test autorisé est disponible.

### 5. Sécurité de déploiement
Aucun merge main, aucune migration Production et aucun déploiement Vercel ne sont déclenchés par cette reprise.


## Audit transversal exhaustif des branches — 07/10/2026
- GitHub a retourné 31 branches ; 31/31 ont été comparées à main.
- La branche main de référence est c171b5465b423d3c576d22ef48c99af5d59ba5f7.
- Production Vercel est READY sur dpl_HxzyGDhYhiLLeagQBeYNPrMrCjv4, source main, même SHA.
- Les deltas majeurs sont : feat/promoteur-partie3-responsable-accreditation-20261006 +625/-3 ; feat/pharmacie-validite-pilotage +358/-3 ; consolidation +56/-3 ; fix/033-caisse-reactivation-schema-aligned +47/-1.
- Les branches historiques auth/docs sont classées comme divergentes ou derrière main selon leur comparaison réelle ; aucun ancien score documentaire n'est repris comme preuve.
- Supabase MCP a refusé les lectures live avec « link_id must identify an eligible linked account » ; aucune validation live Supabase n'est déclarée.
- Le vert global Pilotage reste refusé : preuve CI et validation live Supabase non acquises, et le chantier n'est pas dans main/Production.


## Référence courante supersédant les anciennes reprises — 08/10/2026
Les lignes historiques précédentes sont conservées comme historique et ne constituent plus seules la référence de positionnement courant.

- Branche de travail : `rewrite/naxa-from-main-20261007`.
- HEAD au début de la correction documentaire : `b2fc8b793cbac1d11a089c88d736386faf0af658`.
- `main` vérifié : `2e96930c5d8fb0de4ad22cf4f3dd8dd95b4fd471`.
- PR #30 : ouverte, draft, non fusionnée.
- Niveau 1 Documentation/Traçabilité : 🟢 corrigé.
- Niveau Qualité/CI : 🟡 non vert ; aucune preuve CI n'est déclarée sans exécution réelle.
- Production : inchangée par cette correction documentaire.

Les documents de référence courants sont `FONCTIONNALITES_VALIDEES.md`, `STATUT.md`, `README.md`, `docs/CONTINUITE_NAXA.md`, `docs/FUSION.md`, `CONTRADICTIONS.md` et `docs/CAHIER_DES_CHARGES.md`, avec le cahier v3.7 et le prompt maître comme sources prioritaires.
