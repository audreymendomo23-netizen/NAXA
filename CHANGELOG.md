# Changelog

## 2026-10-05 — Pilotage 360
Dashboards N1/N2/N3, entonnoir commercial, rapports, BI, lots/péremptions et préparation e-mail ajoutés sur consolidation. Aucun merge main ni déploiement sans OUI, DÉPLOIE.


## 2026-10-05 — Validité commerciale pharmacies
- Cycle 30 000 FCFA/mois : échéance, rappel J-5, blocage, masquage client et réactivation Admin.
- Historique des règlements et claim anti-doublon pour les rappels concurrents.
- Endpoint de validité protégé obligatoirement par CRON_SECRET.
- Orchestration quotidienne GitHub Actions et CI étendue aux PR ciblant consolidation.
- Aucun merge main, aucune migration Supabase Production et aucun déploiement Production.


## 2026-10-05 — Verrou Supabase validité exécuté
- `009_pilotage_360` puis `010_validite_pharmacies` appliquées sur Supabase Naxa.
- Défaut de quoting `reserve_stock` corrigé sur la branche avant application de `010`.
- 3 pharmacies existantes initialisées à 30 000 FCFA/mois, actives jusqu’au 4 novembre 2026.
- Aucun paiement fictif, aucun merge `main`, aucun déploiement applicatif.
