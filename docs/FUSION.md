# NAXA — Matrice de fusion

Mise à jour: 7 octobre 2026.

## Sources et ordre de priorité
1. État réel du dépôt / branche / Supabase / Vercel.
2. Cahier des charges v3.7.
3. Prompt maître Fusion v2.
4. README / STATUT / CONTRADICTIONS comme documentation historique et de traçabilité, réconciliée avec l'état réel.

## Reprise PA1
- Branche active: `feat/promoteur-partie3-responsable-accreditation-20261006`.
- HEAD observé: `d89b6e0b7ae3dfa1c5fba622d4945459f336f192`.
- Main observé: `c171b5465b423d3c576d22ef48c99af5d59ba5f7`.
- Aucun merge vers main dans cette reprise.
- Aucun déploiement Production demandé ou effectué.
- Production et branche de travail restent strictement séparées.

## Étape 0 — Pilotage 360°
| Bloc | État | Preuve / verrou |
|---|---|---|
| Promoteur parties 1–4 | 🟢 documenté | état courant dans STATUT; partie 4 historiquement déclarée verte après preuves transactionnelles |
| Promoteur parties 5–6 | 🟢 documenté | preuves PostgreSQL réelles consignées dans STATUT |
| Moteur canonique | 🟢 branche | `stats_pilotage_scope`, `naxa_has_privilege`, `naxa_can`, scope `promoteur_pharmacies` |
| CA canonique | 🟢 branche | `v_reservations_ca` |
| Tests 032/033 | 🟡 preuve CI non observable | tests présents; plusieurs exécutions GitHub échouent avant tout step |
| Façade RPC 042 | 🟢 code de branche | SECURITY DEFINER, search_path vide, EXECUTE authenticated uniquement |
| Passe Admin | 🟡 à clôturer | UI raccordée au RPC canonique; preuve multi-scope Admin à matérialiser |
| Étape 0 globale | 🟡 | CI/réconciliation finale encore non clôturées |

## Contradictions principales encore ouvertes
1. GitHub Actions: jobs créés puis échec avant runner/steps/logs. Cause applicative non démontrée; preuve CI impossible à obtenir avec l'infrastructure exposée.
2. Supabase MCP: le connecteur courant retourne `link_id must identify an eligible linked account`; revalidation live impossible dans cette session.
3. Documentation historique: README/STATUT contiennent des sections anciennes qui décrivent encore des états antérieurs. Les sections datées les plus récentes priment, mais une réconciliation documentaire finale reste à effectuer.

## Acceptance Step 0
Le vert final exige: Admin + Promoteur + Responsable + Caisse + Client, scope sans fuite, CA sans double comptage, privilèges, sécurité RPC, tests exécutés et preuve CI observable, puis documentation réconciliée. Tant que ces éléments ne sont pas tous prouvés, l'Étape 0 reste 🟡.


## Audit transversal exhaustif des branches — 7 octobre 2026

Inventaire et comparaison exécutés sur les **31 branches actuellement retournées par GitHub**. Méthode : inventaire exhaustif → comparaison de chaque branche à main → classification des fichiers divergents → croisement des branches structurantes → contrôle main/Production.

### Référentiel observé
- main = c171b5465b423d3c576d22ef48c99af5d59ba5f7 (Add files via upload).
- Production Vercel = READY, dpl_HxzyGDhYhiLLeagQBeYNPrMrCjv4, source main, même SHA c171b5465b423d3c576d22ef48c99af5d59ba5f7.
- Cahier v3.7 = naxa_cahier_des_charges_v3_7.md ; Prompt maître fusion v2 = naxa_prompt_maitre_fusion_v2.md.
- Supabase MCP : lecture live indisponible pendant cet audit (link_id must identify an eligible linked account). Aucune validation live Supabase n'est donc déclarée.

### Matrice exhaustive
| Branche | Écart vs main | Domaine dominant |
|---|---:|---|
| audit/mise-au-vert-20261007 | +2/-0 | docs |
| consolidation | +56/-3 | pilotage/docs/UI |
| docs/auth-consolidation-20261004 | +2/-10 | docs/auth |
| docs/creation-compte-consolidation-20261004 | +2/-12 | docs/auth |
| docs/final-consolidation-20261004 | +2/-14 | docs |
| docs/final-production-status-20261004 | +0/-18 | docs |
| docs/final-status-20261004 | +2/-16 | docs |
| docs/pharmacie-pilotes-statut-20261005 | +4/-8 | docs/pharmacie |
| docs/production-validation-20261004 | +0/-13 | docs |
| feat/auth-flow-age-gate | +16/-50 | auth/âge |
| feat/creation-compte | +6/-51 | création compte |
| feat/final-auth-legal-ux-20261004 | +15/-17 | auth/legal/UX |
| feat/homepage-lower-visual-reorg | +27/-61 | homepage/UX |
| feat/pharmacie-pilotes-offline-20261005 | +2/-9 | pharmacie/offline |
| feat/pharmacie-promoteur-caisses-20261005 | +24/-7 | pharmacie/promoteur/caisse |
| feat/pharmacie-validite-pilotage | +358/-3 | pilotage/validité/privileges |
| feat/pilotage-equipes-bi-20261005 | +1/-3 | CI/BI |
| feat/promoteur-partie3-responsable-accreditation-20261006 | +625/-3 | Promoteur/Pilotage |
| fix/age-gate-production-hardening | +4/-60 | auth/âge |
| fix/auth-no-scroll-final-20261004 | +1/-15 | auth UX |
| fix/auth-reset-google-ux | +0/-32 | auth |
| fix/build-politique-securite-20261004 | +0/-21 | sécurité/docs |
| fix/creation-compte-mobile-ux-20261005 | +2/-13 | création compte UX |
| fix/creation-phone-forgot-password-20261004 | +6/-11 | auth |
| fix/homepage-copy-cta-emergency | +4/-62 | homepage UX |
| fix/033-caisse-reactivation-schema-aligned | +47/-1 | Caisse/Promoteur/Pilotage |
| main | 0/0 | Production actuelle |
| naxa-dev | +13/-135 | ancien app shell |
| naxa-v2 | +0/-72 | ancien app |
| reconcile/auth-homepage-20261004 | +0/-49 | auth/home |
| reconcile/naxa-final-auth-home-20261004 | +0/-23 | auth/home |

### Contradictions décisives
1. Production ≠ branche Pilotage : Production suit main/c171b..., tandis que le chantier Pilotage/Promoteur vit sur des branches divergentes.
2. Les README/STATUT historiques affichent encore des verts/100 %, mais ces branches sont parfois derrière ou divergentes de main : ces déclarations ne valent pas preuve actuelle.
3. Les plus gros deltas fonctionnels sont la branche Promoteur actuelle (+625 vs main) puis feat/pharmacie-validite-pilotage (+358). Ce sont des sources de travail, pas Production.
4. La migration 042 et les tests 032/033 sont présents sur la branche Promoteur actuelle ; la façade stats_pilotage_scope est SECURITY DEFINER, search_path vide, EXECUTE authenticated uniquement.
5. La CI reste non probante : les exécutions observées échouaient avant les steps/runner, donc pas de preuve d'exécution SQL/app.

### Résultat
- Couverture branches : 31/31 = 100 %.
- Comparaison vs main : 31/31 = 100 %.
- Classification fonctionnelle : 31/31 = 100 %.
- Vert global Pilotage : NON. CI et validation live Supabase restent bloquantes ; le Pilotage/Promoteur n'est pas intégré à main/Production.
- Aucune fusion, migration Production ou déploiement n'a été effectué.
