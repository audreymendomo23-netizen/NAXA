# Contradictions

E01 migration 006 concurrente : résolue par migration 009.
E02 caisse comme sous-pharmacie : rejetée, pharmacie_id reste commun.
E03 Patient 360 nominatif : rejeté, BI agrégée.
E04 prix achat dans stocks : rejeté, stocks_couts séparé.
E05 lots dans stocks : rejeté, stocks_lots séparé.
E06 e-mail sans secret : rejeté, serveur + variables d’environnement.
E07 dashboard statique : rejeté, RPC + rafraîchissement/Realtimе.
E08 suivi pilotage découplé des parcours existants : résolu ; `src/lib/evenements.ts` + `EvenementVue` branchent recherche, vue fiche et ajout panier sur `log_evenement` sans supprimer `recherche_events`.
E09 `stocks_couts` documenté mais absent du schéma : résolue par migration additive 013 ; coût d'achat séparé de `stocks.prix`, au grain pharmacie × produit. La marge historique reste explicitement bloquée tant que le coût au moment de la vente n'est pas figé dans la transaction.

E10 devise technique vs affichage humain : résolue ; XAF reste le code technique, FCFA est le libellé affiché au Client et sur les interfaces humaines, sans conversion.
E11 double source recherche : résolue ; `evenements` est la source canonique des KPI/funnel, `recherche_events` reste une source historique de compatibilité « Les plus recherchés » hors KPI ; aucune addition entre les deux.
