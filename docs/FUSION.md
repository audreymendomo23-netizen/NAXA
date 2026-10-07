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
