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

E12 CA et transitions de réservation : résolue ; `v_reservations_ca` fixe le grain à la réservation et le statut qualifiant `payee|retiree`, tandis que `set_reservation_status` interdit les transitions incohérentes. `payee → retiree` reste une seule vente.


E13 rapports hiérarchiques : résolue au niveau modèle ; `rapports` peut désormais représenter les quatre scopes sans perdre l'historique. L'autorisation effective du scope reste déléguée au futur moteur hiérarchique/RLS et ne peut pas être déduite de l'UI.


E14 exports par scope : résolue au niveau architecture/sécurité ; l'export ne possède aucun droit autonome et reprend strictement le périmètre du rapport/API autorisé. L'élargissement multi-pharmacie attend le moteur hiérarchique canonique et ne sera pas simulé par l'export.
\n\nE15 BI/RLS multi-pharmacie : résolue au niveau architecture et migration de branche. Relation Promoteur↔pharmacies, `my_pharmacies()` et `can_access_pharmacy()` deviennent les primitives de périmètre. Les vues BI passent en `security_invoker` et conservent le grain pharmacie. Validation multi-comptes encore requise avant Production.\n

E16 — Hierarchie : resolue. `parent_profile_id` est l'arbre canonique, `promoteur_pharmacies` porte le scope Promoteur et `profile_accreditations` la preuve des accreditations.

E17 — Securite : resolue sur branche. Auto-elevation directe retiree, stock interne non expose a anon, nouvelles fonctions protegees, callback OAuth aligne sur le controle de creation de session.


## E18 — KPI dashboard vs moteur parallèle
**Résolution : 🟢 au niveau architecture et branche, 🔶 tests multi-rôles encore requis.**

Contradiction : le dashboard Admin utilisait stats_admin tandis que le dashboard pharmacie utilisait stats_pharmacie, avec des règles historiques différentes du CA canonique de la Passe 4. Cela pouvait faire diverger les ventes/CA affichés du BI.

Décision : une seule entrée de pilotage, stats_pilotage_scope(p_jours), calcule les KPI selon le scope effectif. Admin voit le réseau ; Promoteur voit uniquement ses pharmacies autorisées ; Responsable/Caisse voient leur pharmacie active. Le CA vient de v_reservations_ca. Les recherches sans pharmacie ne sont jamais attribuées artificiellement à un scope pharmacie.

Test d'acceptation : mêmes faits sources + même période => même KPI quelle que soit la surface dashboard/rapport/BI ; aucun scope non autorisé ne doit apparaître dans une agrégation.
