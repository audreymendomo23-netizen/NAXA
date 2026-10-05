# Contradictions

E01 migration 006 concurrente : résolue par migration 009.
E02 caisse comme sous-pharmacie : rejetée, pharmacie_id reste commun.
E03 Patient 360 nominatif : rejeté, BI agrégée.
E04 prix achat dans stocks : rejeté, stocks_couts séparé.
E05 lots dans stocks : rejeté, stocks_lots séparé.
E06 e-mail sans secret : rejeté, serveur + variables d’environnement.
E07 dashboard statique : rejeté, RPC + rafraîchissement/Realtimе.
E08 suivi pilotage découplé des parcours existants : résolu ; `src/lib/evenements.ts` + `EvenementVue` branchent recherche, vue fiche et ajout panier sur `log_evenement` sans supprimer `recherche_events`.
