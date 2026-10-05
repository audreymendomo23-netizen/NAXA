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


## E19 — État documentaire vs état réel de branche
**Statut : 🟠 contradiction documentaire en cours de correction.**

La documentation historique décrivait encore `consolidation` comme branche de référence du pilotage, alors que les travaux 013–018 et les dashboards alignés se trouvent sur `feat/pharmacie-validite-pilotage`.

**Décision :** la branche de travail actuelle et la PR #24 deviennent le périmètre explicite du checking de la Passe 6. Les migrations 013–018 sont localisées sous `supabase/`. Leur présence dans Git ne signifie pas leur application Supabase Production.

**Test d’acceptation documentaire :** README + STATUT + CHANGELOG + CONTRADICTIONS doivent distinguer sans ambiguïté branche, validation transactionnelle, état Supabase réel et Production. Le vert ne sera accordé qu’après checking migration par migration puis audit contradictoire.


## E20 — Coûts d’achat et scope multi-pharmacie
**Statut : 🔴 contradiction d’implémentation détectée.**

La migration 013 protège `stocks_couts` avec `pharmacie_id = my_pharmacie()`. Or 016/017 introduisent le scope Promoteur multi-pharmacie via `my_pharmacies()` / `can_access_pharmacy()`. Le Promoteur autorisé sur A+B ne dispose donc pas, par cette policy, du même périmètre sur les coûts d’achat que sur les autres données internes.

**Décision attendue :** aligner `stocks_couts` sur le moteur de scope canonique, sans exposer les coûts au Client.

**Test d’acceptation :** Promoteur A+B = coûts A+B ; Responsable/Caisse A = A uniquement ; autre pharmacie C = refus ; Client = refus.

## E21 — Accréditation et parent hiérarchique
**Statut : 🔴 garde-fou insuffisant détecté.**

`accrediter_profile()` accepte `p_parent = NULL` puis utilise `auth.uid()` comme parent. Cela permet notamment à un Admin de produire un Responsable/Caisse dont `parent_profile_id` est l’Admin, et permet à un Promoteur de créer un niveau 3 sans parent Responsable explicite. Cela contredit l’arbre canonique N0 Admin → N1 Promoteur → N2 Responsable → N3 Caisse.

**Décision attendue :** le parent effectif doit être compatible avec le niveau et la convention/architecture de la pharmacie ; aucun rattachement implicite à N0 pour N2/N3.

**Test d’acceptation :** N2 → parent Promoteur ; N3 en architecture 3 niveaux → parent Responsable ; aucune auto-élévation ni parent Admin implicite.

## E22 — SECURITY DEFINER avec search_path non vide
**Statut : 🔴 contradiction sécurité détectée sur le lot 014.**

`set_reservation_status()` est `SECURITY DEFINER SET search_path=public`, alors que le durcissement canonique retenu pour les fonctions privilégiées exige un `search_path` vide et des références qualifiées. Supabase recommande explicitement cette posture pour limiter les résolutions d’objets inattendues. citeturn1search0turn1search3

**Décision attendue :** passer la fonction à `search_path=''` et qualifier toutes les références non qualifiées, puis tester les transitions et les droits.

**Test d’acceptation :** transitions métier inchangées ; appel hors scope refusé ; aucune résolution d’objet dépendante du search_path.

## E23 — Test d’acceptation 018 manquant dans le dépôt
**Statut : 🟠 couverture de test incomplète.**

Le PR #24 contient `supabase/tests/017_hierarchie_securite.sql`, mais aucun `supabase/tests/018_pilotage_canonique_scope.sql`. La migration 018 a été contrôlée transactionnellement lors du chantier, mais le contrat d’acceptation du pilotage par rôle/scope n’est pas encore matérialisé dans un test versionné.

**Décision attendue :** ajouter un test rollbackable couvrant Admin, Promoteur A+B/C, Responsable/Caisse A, Client, non-fuite des recherches sans pharmacie et cohérence CA `payee/retiree`.


## T1 — tarif fixe 30 000 FCFA vs convention Promoteur — 🟢 décision + correction branche
**Contradiction :** le modèle précédent traitait implicitement le tarif comme un tarif par pharmacie, avec 30 000 FCFA comme valeur par défaut.
**Décision canonique :** **1 Promoteur = 1 convention = 1 tarif = 1 abonnement**, indépendamment du nombre de pharmacies. Une convention peut exister avant toute pharmacie. À expiration, toutes les pharmacies du Promoteur sont bloquées.
**Source de vérité :** conventions_promoteurs pour le contrat administratif ; abonnements_promoteurs pour l'état opérationnel ; abonnement_promoteur_paiements pour les règlements.
**Correction :** migration additive 019, UI Admin et cron de validité alignés sur le Promoteur.
**Anti-parasite :** aucun fallback 30 000 n'est utilisé par le nouveau chemin canonique. Les occurrences historiques de 30 000 dans les migrations antérieures sont conservées comme historique de compatibilité et ne constituent plus la source de vérité.
**Test :** migration 013→019 exécutée en transaction puis ROLLBACK.
**Statut : 🟢 décision + branche + syntaxe transactionnelle ; validation métier multi-utilisateur encore requise.**

## E20 — stocks_couts vs scope multi-pharmacie — 🟢 correction branche
Les policies de stocks_couts utilisent désormais can_access_pharmacy() après l'introduction du moteur multi-pharmacie.

## E21 — parent implicite dans accrediter_profile() — 🟢 correction branche
Le parent doit être explicitement fourni. N2 doit avoir un Promoteur parent. N3 peut avoir un Responsable parent ou un Promoteur parent dans l'architecture 2 niveaux.

## E22/E24 — set_reservation_status() — 🟢 correction branche
La fonction utilise can_access_pharmacy() et search_path='' tout en conservant la matrice de transitions CA canonique.

## E25 — scope Admin / pharmacies démo — 🟢 correction branche
Les recherches rattachées à une pharmacie démo sont exclues du KPI Admin ; les recherches sans pharmacie restent réseau uniquement et ne sont jamais attribuées à un scope Promoteur/Responsable/Caisse.

### Passe 6 — état après correction
- Moteur canonique stats_pilotage_scope() : 🟢 branche.
- Dashboards Admin + pharmacie : 🟢 raccordés au même moteur.
- Scopes : 🟢 modèle + correction de filtrage.
- Test transactionnel 013→019 : 🟢 PASS puis ROLLBACK.
- Tests multi-utilisateurs/acceptation finale : 🟠 à exécuter.
- Production : inchangée.


### Passe 6 — état de preuve mis à jour
- CI #121 : 🟢 SUCCESS avec TypeScript + build.
- Test 018 013→019 : 🟢 PASS / ROLLBACK.
- Matrice Responsable/Caisse/Client : 🟠 non exécutée transactionnellement, car PostgreSQL interdit l'utilisation d'une nouvelle valeur d'enum dans la même transaction que son `ALTER TYPE ... ADD VALUE`. Aucun contournement n'a été appliqué en Production.
- Dernière CI #125 : 🟠 en cours.
