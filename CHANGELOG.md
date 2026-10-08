# Changelog

## 2026-10-05 — Pilotage 360
Dashboards N1/N2/N3, entonnoir commercial, rapports, BI, lots/péremptions et préparation e-mail ajoutés sur consolidation. Aucun merge main ni déploiement sans OUI, DÉPLOIE.


## 2026-10-05 — Validité commerciale pharmacies
- Cycle 30 000 FCFA/mois : échéance, rappel J-5, blocage, masquage client et réactivation Admin.
- Historique des règlements et claim anti-doublon pour les rappels concurrents.
- Endpoint de validité protégé obligatoirement par CRON_SECRET.
- Orchestration quotidienne GitHub Actions et CI étendue aux PR ciblant consolidation.
- Aucun merge `main` et aucun déploiement applicatif Production.


## 2026-10-05 — Verrou Supabase validité exécuté
- `009_pilotage_360` puis `010_validite_pharmacies` appliquées sur Supabase Naxa.
- Défaut de quoting `reserve_stock` corrigé sur la branche avant application de `010`.
- 3 pharmacies existantes initialisées à 30 000 FCFA/mois, actives jusqu’au 4 novembre 2026.
- Aucun paiement fictif, aucun merge `main`, aucun déploiement applicatif.


## 2026-10-05 — Limite de sessions par compte
- Maximum 4 sessions/appareils simultanés par compte.
- Aucune déconnexion automatique des sessions existantes.
- 5e connexion refusée pour mot de passe et Google OAuth ; les 4 sessions précédentes restent intactes.
- Migrations additives `011_limite_sessions.sql` et `012_enforcement_limite_sessions.sql` appliquées sur Supabase.
- Enforcement DB atomique ajouté pour empêcher tout dépassement concurrent de la limite.
- Aucun merge `main` et aucun déploiement applicatif.

## 2026-10-05 — Passe 4 : devise et recherche
- Affichage humain verrouillé en **FCFA** ; XAF reste le code technique, sans conversion.
- C3 résolue : `evenements` devient la source canonique des KPI de recherche/funnel ; `recherche_events` reste compatible avec « Les plus recherchés » et est exclue des KPI.
- Aucun historique supprimé et aucun merge `main` / déploiement Production.


## 2026-10-05 — Passe 4 : C4 CA canonique
- Migration additive 014 préparée : source `v_reservations_ca`, transitions de réservation verrouillées et vues de ventes alignées.
- Test SQL de la migration effectué en transaction rollbackée ; aucune modification Production persistante.


## 2026-10-05 — Passe 4 : C2 rapports hiérarchiques
- Migration additive 015 préparée pour représenter les scopes PHARMACIE / RESPONSABLE / PROMOTEUR / NAXA sans supprimer l'ancien modèle.
- Test Supabase rollbacké : structure validée, 0 rapport existant actuellement.
- Aucun merge main ni déploiement Production.


## 2026-10-05 — Passe 4 : exports par scope
- API rapports enrichie avec les métadonnées de scope sans élargissement de droits.
- Export CSV existant conservé ; aucun second moteur créé.
- Garde-fou : hors admin, le filtre historique `pharmacie_id` reste obligatoire tant que le moteur hiérarchique multi-pharmacie n'est pas branché.
\n\n2026-10-05 — Passe 4 BI/RLS multi-pharmacie : relation Promoteur↔pharmacies, primitives de périmètre, RLS multi-pharmacie et vues BI `security_invoker`. Aucun changement Production.\n

## 2026-10-05 — Passe 5
- Hierarchie, accreditations et RLS multi-pharmacie durcies.
- Callback OAuth aligne sur la limite de sessions.
- Validation transactionnelle des migrations 015 a 017 avec rollback.
- Production non modifiee.


## 2026-10-05 — Passe 6 / Pilotage par scope
- Ajout de la RPC canonique stats_pilotage_scope pour éviter les KPI divergents entre dashboards et BI.
- CA/ventes branchés sur v_reservations_ca ; périmètres Promoteur/Responsable/Caisse protégés par scope.
- Dashboards Admin et pharmacie alignés sur la même source de pilotage.
- Aucun changement Production et aucune migration Supabase appliquée.


## 2026-10-05 — Documentation de contrôle avant reprise d’audit
- Documentation synchronisée avec l’état réel de la branche `feat/pharmacie-validite-pilotage` et de la PR #24.
- Clarification : les migrations 013–018 sont sous `supabase/`, pas sous `supabase/migrations/`.
- Clarification : 018 est le point d’entrée canonique du pilotage par scope ; sa présence en branche ne constitue pas une application Production.
- Séquence de contrôle verrouillée : documentation → checking migrations → audit contradictoire → tests/fermetures → décision de déploiement.
- Aucun merge `main`, aucune migration Production et aucun déploiement applicatif.
