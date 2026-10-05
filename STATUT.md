# NAXA — STATUT

Mise à jour : 5 octobre 2026 — architecture Promoteur / Caisses

## État global
**AUTHENTIFICATION VALIDÉE. ARCHITECTURE PHARMACIE PROMOTEUR / CAISSES CONSOLIDÉE. PRODUCTION VALIDÉE. MISE EN SERVICE TERRAIN À EXÉCUTER.**

### Consolidation finale
- PR #11 fusionnée dans main par squash.
- PR #12 documentation précédente fusionnée.
- PR #13 fusionnée dans main : correction du dernier écran d'authentification qui conservait min-h-screen.
- PR #15 fusionnée dans main : correction UX finale de /creation-compte.
- /creation-compte : bandeau « Les plus recherchés » masqué.
- /creation-compte : titre et introduction recentrés et compactés.
- /creation-compte : scroll de page interdit via auth-ecran.
- /creation-compte : téléphone corrigé avec sélecteur compact drapeau + indicatif ; les noms de pays apparaissent uniquement dans le sélecteur ouvert.
- /creation-compte : numéro national séparé, longueur contrôlée selon le pays et coches jaunes de validation pour les informations correctement renseignées.
- /mot-de-passe-oublie : vérification serveur de l’existence du compte avant envoi d’OTP ; compte inexistant = erreur, aucune étape OTP proposée.
- PR #17 fusionnée dans main.
- Les cinq écrans principaux contrôlés sont sans défilement de page : /connexion, /creation-compte, /mot-de-passe-oublie, /verification-age, /nouveau-mot-de-passe.
- auth-ecran impose 100vh/100dvh, overflow:hidden et overscroll-behavior:none.
- Google OAuth : parcours direct sans OTP ; le callback finalise la session Supabase avant redirection.
- Mot de passe oublié : OTP e-mail séparé, puis changement du mot de passe avec session conservée.
- Création de compte : informations → OTP → mot de passe.
- Validation d'âge : acceptation obligatoire des trois politiques côté interface et serveur.
- Accueil : CTA pharmacie isolé, disclaimer médical repositionné, numéros 1510 / 119 / 1511.
- Aucun nouveau modèle DB, aucune nouvelle dépendance, aucune réécriture destructive.

## Évaluation finale du périmètre contrôlé — consolidation PR #21
- Architecture Promoteur/Caisses : OK
- Séparation pharmacie unique / comptes enfants : OK
- Création du Promoteur depuis `/admin` : OK
- Gestion des Caisses par le Promoteur : OK
- Blocage/réactivation d'une Caisse : OK
- Contrôle d'accès des comptes désactivés : OK
- Schéma Supabase correspondant : OK
- Migrations 007/008 présentes et appliquées sur Naxa : OK
- Production Vercel issue de `main` : READY
- Contrôle post-déploiement : aucun log runtime error/fatal trouvé sur 30 min
- **Score de consolidation : 100 %**

## Évaluation finale du périmètre contrôlé — historique
- Architecture existante conservée : OK
- Correction du dernier scroll parasite : OK
- Cohérence des cinq écrans d'authentification : OK
- Fonctionnement métier modifié par la correction : aucun
- PR #15 fusionnée : OK
- Build Production : compilation Next.js réussie ; contrôle TypeScript lancé sans erreur bloquante : OK
- Déploiement Production sur projet Vercel existant : READY : OK
- URL /creation-compte en Production : HTTP 200 : OK
- Aucun Preview volontaire : OK
- Secrets serveur non exposés : OK
- Score final : 100 %

## Production
- Projet Vercel : `naxa` existant, aucun nouveau projet créé.
- Déploiement Production courant : `dpl_CcFGneLjZjBSLQ32Mccww6vjwAD6` — **READY**.
- Commit Production : `5ad95ce30dd43b3c140e0048606c81dd5143e490`.
- Alias : `naxa-opal.vercel.app`, `naxa-naxa3.vercel.app`.
- Déploiement issu de `main` après fusion PR #21.
- Statut GitHub Vercel : SUCCESS.
- Aucun nouveau projet Vercel et aucun Preview volontaire.

## Architecture comptes pharmacie — validée comme évolution métier
- Le prompt maître impose une pharmacie créée par NAXA puis autonome ; cette évolution précise cette autonomie sans créer de sous-pharmacies.
- **Promoteur** : compte parent de la pharmacie, gère les comptes enfants.
- **Caisse** : compte enfant, opérationnel, partage exactement le stock et les réservations de la pharmacie.
- Côté client : une seule pharmacie visible, indépendamment du nombre de caisses.
- Le Promoteur peut créer, bloquer et réactiver ses caisses ; un blocage ne désactive pas la pharmacie.
- Formation terrain : utiliser les comptes Caisse pour l'apprentissage de l'import et de la gestion de stock.
- PR #21 fusionnée dans `main` par squash : architecture Promoteur parent / Caisses enfants.
- Migrations 007/008 préparées et appliquées au projet Supabase NAXA ; aucun compte réel n'est créé automatiquement par ce chantier.
- Le schéma Supabase contient désormais les rôles `promoteur` et `caisse`, `parent_profile_id` et `actif` sur `profiles`.
- Le compte créé par `/admin` est désormais destiné au Promoteur ; le Promoteur dispose d'un espace de gestion de ses Caisses.
- Évaluation finale du périmètre PR #21 : **100 %**.
- Déploiement Production PR #21 : **READY** sur le projet Vercel existant `naxa`.
- Commit Production : `5ad95ce30dd43b3c140e0048606c81dd5143e490`.
- Déploiement : `dpl_CcFGneLjZjBSLQ32Mccww6vjwAD6`.
- Statut GitHub Vercel : SUCCESS.
- Contrôle runtime post-déploiement : aucun log `error`/`fatal` trouvé sur les 30 premières minutes contrôlées.

## Prochain chantier — feuille de route du prompt maître
**Mise en service terrain des pharmacies pilotes — prochain jalon réel.**
- Identifier 3 à 5 pharmacies pilotes réelles.
- Créer leurs comptes Promoteur via `/admin`.
- Faire créer/activer par chaque Promoteur les comptes Caisses de son équipe.
- Migrer leurs stocks réels via l'import existant.
- Vérifier prix, quantités, péremptions, formats et fraîcheur.
- Former les équipes sur réservations, stock, garde et mode hors connexion.
- Tester le parcours complet sur données réelles.
- Passer ensuite au chantier Qualité.
- Règles inchangées : pas d'auto-inscription pharmacie, pas de livraison, réservation et paiement facultatifs.

## Gouvernance
- Dépôt existant conservé.
- Aucun secret serveur exposé.
- Aucune livraison.
- Le prompt maître et le cahier des charges sont les sources de vérité.


## Chantier consolidation — Pilotage 360°
- Branche : `consolidation`, PR #23.
- Architecture N1 NAXA / N2 Promoteur / N3 Caisse implémentée.
- Migration additive `009_pilotage_360.sql` syntaxiquement validée dans une transaction annulée ; aucune migration de production appliquée.
- Dashboards, rapports, BI, lots/péremptions et préparation e-mail ajoutés.
- Contradiction E08 corrigée : les parcours recherche → fiche → panier alimentent maintenant réellement `evenements` via `log_evenement`, sans supprimer `recherche_events`.
- Aucun merge `main`, aucun déploiement Production.
- Les tests réels mobile, Realtime et e-mail restent à prouver par le fondateur.
- Prochaine autorisation de déploiement : phrase exacte **OUI, DÉPLOIE**.

## Chantier — validité commerciale des pharmacies
- Branche : `feat/pharmacie-validite-pilotage`, basée sur la consolidation PR #23.
- Audit : le pilotage 360 possédait déjà `abonnements` et le MRR, mais pas le cycle complet échéance → rappel J-5 → blocage → règlement → réactivation.
- Ajout additif : migration `010_validite_pharmacies.sql`, historique des règlements, échéance mensuelle standard 30 000 FCFA, statut impayé, blocage pharmacie + comptes Promoteur/Caisse, réactivation administrative.
- Côté client : stocks des pharmacies inactives masqués ; recherche et réservation restent protégées par `pharmacies.actif`.
- N1 Admin : `/admin/pilotage/validite` connecté au Pilotage 360.
- Notification : endpoint `/api/cron/validite`, protégé par `CRON_SECRET`, rappel J-5 au Promoteur via Resend ; claim atomique anti-doublon concurrent (`rappel_5j_en_cours_at`).
- Orchestration quotidienne : workflow GitHub Actions `.github/workflows/naxa-validite.yml` à 06:00 UTC, avec `NAXA_CRON_URL` et `CRON_SECRET` fournis par secrets ; aucun secret n’est commité.
- CI qualité étendue aux PR ciblant `main` et `consolidation`.
- Écran de suspension ajouté pour les comptes pharmacie bloqués.
- Aucun merge `main`, aucune migration Production et aucun déploiement Production.

## Verrou Supabase — validité exécuté
- Prérequis `009_pilotage_360` détecté absent de Supabase malgré sa présence dans le dépôt ; appliqué avant `010`.
- `010_validite_pharmacies` a d’abord révélé une erreur de quoting dans `reserve_stock`; le fichier de branche a été corrigé puis la migration appliquée avec succès.
- Vérification réelle : migrations `009` et `010`, tables, fonctions et trigger d’initialisation présents.
- État réel : 3/3 pharmacies ont un abonnement actif à 30 000 FCFA/mois, échéance 4 novembre 2026 ; aucun paiement fictif enregistré.
- Aucun merge `main` et aucun déploiement applicatif effectué.

## Chantier — limite de sessions par compte
- Règle métier validée : maximum 4 sessions/appareils simultanés par compte.
- Les 4 sessions existantes restent actives ; aucune déconnexion automatique des anciennes sessions.
- Une 5e tentative de connexion par mot de passe est refusée avec un message explicite.
- Le parcours Google OAuth applique la même limite ; si la 5e session est créée pendant le callback, elle est immédiatement révoquée, sans toucher aux 4 précédentes.
- Migrations additives 011_limite_sessions.sql et 012_enforcement_limite_sessions.sql appliquées à Supabase.
- Enforcement DB atomique sur auth.sessions avec verrou transactionnel par utilisateur : une 5e session ne peut pas être créée, y compris sous connexions concurrentes.
- La vérification applicative reste présente uniquement pour fournir un message UX explicite.
- État de sécurité vérifié : anon et authenticated n'ont pas EXECUTE sur la fonction ; service_role uniquement.
- Aucun changement de mot de passe, de rôle, de profil ou de donnée métier ; aucun merge main et aucun déploiement applicatif effectué.

## Clôture des passes 1 → 3 — verrouillage
**Date : 5 octobre 2026**

### Passe 1 — état existant / invariants : 🟢 100 %
- Inventaire et contraintes existantes pris comme base.
- Principe additif/non destructif maintenu.
- Client séparé de la hiérarchie interne.
- Hiérarchie cible verrouillée : N0 Admin / N1 Promoteur / N2 Responsable / N3 Caisse.
- Pharmacie = unité commerciale et stock partagé ; plusieurs caisses ne créent jamais plusieurs pharmacies.

### Passe 2 — métier / données / commercial : 🟢 100 %
- Convention comme niveau contractuel supérieur.
- Relation Promoteur ↔ pharmacies explicite.
- Architecture autorisée par convention, choisie par Promoteur dans la limite contractuelle.
- Responsable = autorité hiérarchique, non fonction métier.
- Accréditation distincte du rôle.
- Tarification : 30 000 FCFA = référence catalogue ; prix réellement facturé contractuel et historisé.
- Modes PAR_PHARMACIE / FORFAIT_CONVENTION.
- Une pharmacie impayée ne doit pas désactiver globalement le Promoteur si d'autres pharmacies restent valides.

### Passe 3 — sécurité / autorisation : 🟢 100 % du modèle cible
- Formule d'autorisation canonique verrouillée.
- RLS et grants comme source d'autorité, UI/JWT jamais suffisants seuls.
- Stock public limité à la disponibilité ; données opérationnelles internes séparées.
- Caisse = opérateur normal ; Responsable/Promoteur = supervision/pilotage avec droits explicites.
- Vues/fonctions SECURITY DEFINER classées par exposition et durcies selon leur finalité.
- OAuth/session : enforcement DB ; pas de déconnexion locale des sessions existantes.

### Preuve / limite actuelle
Le verrouillage ci-dessus est **un verrouillage de conception**, pas une déclaration de déploiement. Le Security Advisor Supabase comporte encore des findings réels (notamment v_ventes_journalieres, tables RLS sans policy et fonctions SECURITY DEFINER exposées) qui devront être traités et testés dans l'implémentation. Supabase recommande d'associer grants minimaux, RLS et tests d'autorisation, et de rendre les vues security_invoker lorsqu'elles doivent respecter le RLS sous-jacent.

**Conclusion : passes 1–3 vertes côté spécification, sans faux-positif sur l'état de production.**

## Passe suivante
**Passe 4 — Métier / Données / BI / Rapports.**
Objectif : fermer le dictionnaire KPI, le grain, les sources, les scopes, les agrégations anti-double-compte, les rapports hiérarchiques, les exports et les tests de cohérence.


## 🔒 Référence prioritaire — clôture Passes 1–3 — 5 octobre 2026
Cette section prime sur les formulations historiques antérieures.

### 🟢 PASS 1 — Existant & invariants
- Existant vérifié avant évolution ; principe additif/non destructif maintenu.
- Une pharmacie reste une unité commerciale et un stock partagé, même avec plusieurs caisses.
- Client hors hiérarchie interne.
- Hiérarchie cible : N0 Admin → N1 Promoteur → N2 Responsable → N3 Caisse.
- `role=pharmacie` reste une compatibilité historique et n'est pas un niveau hiérarchique.
- Aucun merge main ni déploiement Production sans accord explicite.

### 🟢 PASS 2 — Métier / Données / Commercial
- Convention → Promoteur → pharmacies autorisées → architecture → abonnements → paiements.
- Relation Promoteur ↔ pharmacies obligatoire pour le multi-pharmacie.
- Architecture 2 ou 3 niveaux choisie dans les limites de la Convention.
- Responsable = autorité/scopage ; accréditation distincte du niveau et du statut.
- 30 000 FCFA/mois = référence catalogue ; le prix facturé est contractuel et historisé.
- PAR_PHARMACIE et FORFAIT_CONVENTION sont les deux modes commerciaux retenus.
- Une pharmacie impayée ne bloque pas les autres pharmacies valides du Promoteur.

### 🟢 PASS 3 — Sécurité / Autorisation
- Droit effectif = identité × niveau × accréditation × périmètre × pharmacie × convention × statut × objet × opération.
- RLS + grants + contrôles DB/serveur = autorité.
- Caisse = opérateur normal ; Responsable/Promoteur = supervision/pilotage avec droits explicites.
- Public/client limité aux données de disponibilité ; données opérationnelles internes séparées.
- Vues/fonctions doivent avoir une posture de sécurité explicite, grants minimaux et tests allow/deny. Supabase recommande RLS + grants par opération et des tests de base de données ; les vues doivent utiliser `security_invoker` lorsqu'elles doivent respecter le RLS sous-jacent. citeturn0search0turn0search1
- SECURITY DEFINER uniquement lorsqu'il est nécessaire, avec `search_path` sécurisé et EXECUTE minimal. citeturn0search3
- Limite sessions : 4 maximum, aucune déconnexion automatique des 4 précédentes.

### État de clôture
**Passes 1–3 : 🟢 vertes côté conception, arbitrage et spécification.** Les corrections techniques identifiées (RLS historiques, fonctions/vues privilégiées, compatibilité mono-pharmacie, callback OAuth) sont désormais des tâches d'implémentation déterministes ; elles ne constituent plus des ambiguïtés de conception.

## Passe 4 — prochaine passe
Métier / Données / BI / Rapports : dictionnaire KPI, grain, sources, scopes, agrégation, anti-double-compte, rapports hiérarchiques, exports et tests de cohérence.


## Passe 4 — Contradiction C1 : `stocks_couts`
**Mise à jour : 5 octobre 2026**

### Contradiction C1 — 🟢 résolue au niveau dépôt / conception
- La documentation historique faisait référence à `stocks_couts`, mais la table n'existait pas dans le schéma Supabase inspecté.
- Décision : conserver la séparation métier voulue par le cahier : `stocks` = quantité + prix public/vente ; `stocks_couts` = coût d'achat interne courant.
- Migration additive créée : `supabase/migration_013_stocks_couts.sql`.
- Grain verrouillé : `pharmacie × produit`.
- Devise verrouillée : XAF.
- RLS/grants dédiés : accès interne uniquement, dans le périmètre pharmacie autorisé ; Client exclu.
- Aucune donnée existante supprimée ou réécrite.
- Aucun KPI ne doit additionner prix public et coût d'achat.
- **Marge historique interdite tant qu'un coût au moment de la vente n'est pas figé dans la donnée transactionnelle.**

### Test de contradiction C1
**Question :** peut-on avoir une source `stocks_couts` sans créer un second stock ?

**Réponse : oui.** `stocks` reste l'unique quantité opérationnelle ; `stocks_couts` est une table de référence du coût interne. Elle ne possède ni quantité de stock ni lot et ne remplace pas `stocks`.

**Question :** le Client peut-il accéder au coût d'achat ?

**Réponse : non.** RLS/grants excluent l'accès public et la BI n'expose le coût qu'aux scopes internes autorisés.

**Question :** peut-on calculer une marge historique avec cette table seule ?

**Réponse : non, volontairement.** La contradiction est levée sans fabriquer une fausse marge historique.

**Résultat C1 : 🟢 100 % au niveau contradiction, modèle et dépôt.**

### Passe 4 — état de progression
- C1 : 🟢 100 %.
- Source de vérité KPI : 🟢.
- Grain stock/lot/réservation/événement : 🟢 au niveau spécification.
- Recherche et double source `recherche_events` / `evenements` : 🟠, règle canonique à formaliser/tester.
- CA et transitions de réservation : 🟠, règle anti-double-compte à formaliser/tester.
- Rapports hiérarchiques : 🔴, schéma historique encore `pharmacie/admin`.
- Exports par scope : 🟠.
- Tests BI/RLS multi-pharmacie : 🔴.

**Règle de progression : aucun passage au vert global tant qu'une contradiction résiduelle n'a pas une réponse explicite, une source de vérité et un test d'acceptation.**


## Passe 4 — clôture C3 et convention monétaire
### Devise Client — 🟢 100 %
- **Technique : XAF. Affichage humain : FCFA.**
- Le Client voit les prix sous la forme `1 500 FCFA`, et non `1 500 XAF`.
- La fonction existante `fcfa()` est utilisée sur les vues Client de résultats, fiche produit, réservation et reçu.
- Aucun changement de devise en base ni de calcul monétaire.

### Contradiction C3 — double source recherche — 🟢 100 %
- `evenements` = source unique des KPI analytiques de recherche/funnel.
- `recherche_events` = compatibilité historique du mécanisme « Les plus recherchés », hors KPI.
- Une recherche ne compte qu'une fois dans les KPI, via `evenements.recherche`.
- Les lignes `recherche_events` ne sont jamais additionnées aux événements et ne servent pas à reconstituer les volumes du funnel.
- Test d'acceptation verrouillé : recherche → exactement un événement canonique `recherche`; présence éventuelle de lignes secondaires sans impact sur les KPI.

### Passe 4 — progression après C3
- C1 `stocks_couts` : 🟢 100 %.
- C3 sources de recherche : 🟢 100 %.
- C4 CA / transitions de réservation : 🟠.
- Rapports hiérarchiques : 🔴.
- Exports par scope : 🟠.
- Tests BI/RLS multi-pharmacie : 🔴.

**Règle maintenue : on ne passe pas au vert global sans réponse explicite + source de vérité + test d'acceptation.**


## Passe 4 — C4 CA / transitions — 🟢 100 % au niveau contradiction + dépôt
- Source de vérité : `v_reservations_ca`.
- Éligibilité CA : `payee` ou `retiree`.
- Un passage `payee → retiree` reste une seule vente.
- Matrice de transitions ajoutée à `set_reservation_status` pour empêcher les retours ou sauts incohérents.
- `v_ventes_journalieres` et `bi.activite_mensuelle` utilisent la règle canonique.
- Test SQL de la migration 014 exécuté dans une transaction puis **ROLLBACK** : syntaxe et dépendances validées ; état actuel = 0 ligne qualifiante / 0 FCFA.
- **Aucune modification persistante de Supabase Production.**

### Passe 4 — progression
- C1 `stocks_couts` : 🟢 100 %.
- C3 sources de recherche : 🟢 100 %.
- C4 CA / transitions : 🟢 100 % au niveau contradiction + dépôt.
- Rapports hiérarchiques : 🔴.
- Exports par scope : 🟠.
- Tests BI/RLS multi-pharmacie : 🔴.


## Passe 4 — C2 Rapports hiérarchiques — 🟢 100 % au niveau modèle
- Source de vérité du scope : `rapports.scope_type + scope_profile_id + scope_pharmacie_id`.
- Valeurs autorisées : `PHARMACIE`, `RESPONSABLE`, `PROMOTEUR`, `NAXA`.
- Compatibilité historique préservée via `portee` et `pharmacie_id`.
- Aucun rapport historique supprimé ou réécrit.
- Migration 015 préparée et testée dans une transaction rollbackée.
- 0 rapport réel actuellement, donc aucun historique à transformer.
- Le contrôle effectif d'accès restera soumis au moteur hiérarchique/RLS ; aucune élévation n'est donnée par ces colonnes seules.

### Passe 4 — progression
- C1 `stocks_couts` : 🟢 100 %.
- C2 rapports hiérarchiques : 🟢 100 % modèle.
- C3 sources de recherche : 🟢 100 %.
- C4 CA / transitions : 🟢 100 %.
- Exports par scope : 🟠.
- Tests BI/RLS multi-pharmacie : 🔴.


## Passe 4 — Exports par scope — 🟢 100 % au niveau contrat de sécurité
- Un export ne possède pas sa propre logique d'autorisation : il exporte uniquement les rapports déjà autorisés par l'API/source.
- Le scope est visible dans la donnée (`scope_type`, `scope_profile_id`, `scope_pharmacie_id`) mais n'accorde aucun droit à lui seul.
- Compatibilité maintenue avec l'export CSV existant.
- Tant que l'autorisation hiérarchique multi-pharmacie n'est pas implémentée, le périmètre non-admin reste limité à `pharmacie_id`.
- **Contradiction exports : 🟢 100 % comme règle de sécurité et d'architecture ; implémentation multi-pharmacie complète attend le moteur hiérarchique.**


## Passe 4 — BI/RLS multi-pharmacie — 🟢 modèle et migration de branche
Le dernier bloc structurel de la Passe 4 est désormais traité dans `migration_016_bi_rls_multipharmacie.sql` : relation Promoteur↔pharmacies, périmètre `my_pharmacies()`, garde `can_access_pharmacy()`, politiques RLS multi-pharmacie et vues BI `security_invoker` avec `pharmacie_id`.

### Tests d'acceptation obligatoires avant Production
1. Promoteur autorisé sur A+B : A+B visibles, C invisible.
2. Responsable/Caisse de A : A visible, B/C invisibles.
3. NAXA Admin : A+B+C visibles.
4. Client : aucune donnée interne de coût, lots ou utilisateurs.
5. BI : consolidation = somme des pharmacies autorisées, sans doublon.
6. Rapport/export : même scope que la source, jamais plus large.

**État réel : 🟢 contradiction architecturale résolue ; 🔶 validation d'exécution multi-utilisateur encore à effectuer sur environnement de test avant toute mise en Production.**


## Passe 5 — Hierarchie + securite
**Branche : 🟢 100 % sur le modele et les migrations.**

Le modele hierarchique, le scope multi-pharmacie, les accreditations, la revocation, les garde-fous RLS et le controle OAuth sont maintenant traites. Les migrations 015→017 ont ete rejouees dans une transaction Supabase puis rollbackees. Le test de scope Promoteur A+B avec refus C a reussi. **Production reste volontairement inchangee.**


## Passe 6 — Pilotage réel par scope
- Contradiction fermée : les dashboards ne doivent pas recalculer leurs KPI avec un moteur parallèle à la BI/CA canonique.
- Migration additive 018_pilotage_canonique_scope.sql : RPC stats_pilotage_scope(p_jours) comme point d'entrée unique du pilotage NAXA par scope.
- Scope Admin = réseau NAXA ; Promoteur = pharmacies autorisées via my_pharmacies() ; Responsable/Caisse = pharmacie de leur profil actif.
- Les recherches sans pharmacie ne sont jamais attribuées à un Promoteur/Responsable/Caisse ; elles restent réseau uniquement côté Admin. Cela évite une fuite d'agrégation entre pharmacies.
- CA et ventes utilisent v_reservations_ca, donc la règle payee/retiree et l'anti-double-compte de la Passe 4 restent la source canonique.
- /admin/pilotage et /pharmacie/pilotage consomment désormais la même RPC canonique.
- /pharmacie/pilotage devient le tableau de bord commun adapté au niveau : Promoteur, Responsable ou Caisse ; il ne crée aucune sous-pharmacie.
- Accès au pilotage ajouté depuis /pharmacie.
- Validation Supabase : migration 018 rejouée dans une transaction puis rollbackée ; fonction créée et détectée dans la transaction, aucune modification Production persistante.
- Validation fonctionnelle multi-utilisateur complète et application Production de 018 : encore à faire, sans les déclarer vertes prématurément.


## Point de contrôle documentaire — Passe 6 — 5 octobre 2026
- Branche de travail : `feat/pharmacie-validite-pilotage`.
- PR #24 ouverte vers `consolidation`, HEAD `bfc6089acc293806fedda8b90078eb0ca23ba021` ; PR non fusionnée.
- Migrations 013–018 vérifiées comme fichiers de branche sous `supabase/` ; elles ne résident pas sous `supabase/migrations/`.
- 018 = point d’entrée canonique du pilotage par scope : `stats_pilotage_scope(p_jours)`.
- Dashboards Admin et pharmacie consomment cette même RPC ; aucune application Production de 013–018 n’est déclarée.
- **Statut documentaire : 🟠 en contrôle.** La prochaine étape est le checking migration par migration (dépendances, idempotence/additivité, RLS/grants, sécurité DEFINER/INVOKER, cohérence BI/CA, tests), puis seulement la reprise de l’audit contradictoire.
- Aucun merge `main`, aucune migration Production, aucun déploiement sans **OUI, DÉPLOIE**.


---

# 🔒 RÉFÉRENCE DE CONTINUITÉ — CHANTIER PILOTAGE — 5 OCTOBRE 2026

> **Cette section est une instruction de continuité prioritaire pour toute IA qui reprend le dépôt après une rupture de conversation, de session ou de contexte.**
>
> **Ne pas recommencer le chantier depuis le Prompt maître v3.** Le V3 définit le cadre et la destination ; les **Passes 1→6 et leurs arbitrages successifs constituent l'historique décisionnel de travail** qui explique comment le Pilotage a été construit. Une reprise correcte doit reconstituer cet historique avant toute nouvelle modification.

## 1. Vérité de travail : ne pas confondre les sources

La reprise doit distinguer au minimum :

1. **Prompt maître v3 / Cahier des charges v3** : exigences, destination et périmètre contractuel du produit.
2. **Historique décisionnel des Passes 1→6** : arbitrages métier, contradictions détectées, décisions, architecture retenue, tests et limites explicitement établis pendant le développement du Pilotage.
3. **Branche `feat/pharmacie-validite-pilotage`** : état d'implémentation candidat du chantier en cours ; il n'est pas la Production.
4. **`main` + Supabase réel** : vérité de Production ; ne jamais présenter l'état de la branche comme déployé.
5. **ZIP/documentation de référence** : source documentaire additive ; ne remplace jamais l'existant et ne doit pas être réappliqué aveuglément.

**Règle fondamentale :** si une formulation ancienne du README/STATUT contredit une section de référence plus récente, la section de référence la plus récente prévaut. Si un arbitrage des Passes contredit le V3, **ne pas écraser automatiquement l'arbitrage** : identifier la contradiction, vérifier son origine et la fermer explicitement.

## 2. Chemin historique obligatoire du Pilotage

Le chantier Pilotage a volontairement été développé par passes :

- **Passes 1→3** : existant, invariants, modèle métier, hiérarchie, autorisation, RLS, séparation Client/interne.
- **Passe 4** : coûts, CA canonique, recherche/funnel, rapports hiérarchiques, exports, BI et multi-pharmacie.
- **Passe 5** : hiérarchie opérationnelle, accréditations, scopes, sécurité et garde-fous.
- **Passe 6** : moteur KPI canonique de Pilotage et raccordement des dashboards à ce moteur unique.

**Important :** le fait de ne pas avoir fusionné `main` ni déployé Production pendant ces passes était **volontaire**. Le but était de concevoir, consolider et corriger le Pilotage avant livraison. Ne pas interpréter cette absence de déploiement comme un abandon, un échec ou une invitation à créer un nouveau chantier.

## 3. Règles métier/architecture verrouillées pendant les Passes

- Une **pharmacie = une unité commerciale et un stock partagé** ; plusieurs caisses ne créent jamais plusieurs pharmacies.
- Client = acteur externe, hors hiérarchie interne.
- Hiérarchie cible : **N0 NAXA Admin → N1 Promoteur → N2 Responsable → N3 Caisse**.
- Relation Promoteur ↔ pharmacie explicite pour le multi-pharmacie.
- Le scope autorisé est une composante du droit ; l'UI/JWT seuls ne constituent jamais l'autorité.
- Formule de droit effectif : **identité × niveau × accréditation × périmètre × pharmacie × convention × statut × objet × opération**.
- `stocks` = quantité/prix de vente ; `stocks_couts` = coût d'achat interne courant. Ne jamais les confondre.
- Technique monétaire : **XAF** ; affichage humain : **FCFA**.
- `evenements` = source canonique des KPI de recherche/funnel ; `recherche_events` reste historique/compatibilité et ne doit pas être additionné aux KPI.
- CA canonique = `v_reservations_ca`, au grain réservation ; statuts éligibles = `payee` ou `retiree` ; `payee → retiree` reste une seule vente.
- Les agrégations Promoteur doivent sommer uniquement les pharmacies autorisées, sans double comptage.
- Les données de coût, lots, péremptions, mouvements et autres données internes ne sont jamais exposées au Client.
- Les fonctions `SECURITY DEFINER` doivent avoir une justification, un `search_path` sûr et des EXECUTE minimaux ; les vues doivent avoir une posture de sécurité explicite.
- Limite de sessions : 4 simultanées ; aucune ancienne session n'est expulsée automatiquement.

## 4. Passe 6 — décision centrale

La contradiction principale de la Passe 6 était l'existence de moteurs KPI différents :

`stats_admin` ≠ `stats_pharmacie` alors que BI/CA avaient désormais des règles canoniques.

**Décision retenue :** une seule chaîne de vérité :

**DONNÉE SOURCE → RÈGLE KPI → KPI CANONIQUE → AGRÉGATION PAR SCOPE → BI → DASHBOARD → RAPPORT/EXPORT**

Le point d'entrée de Pilotage introduit par la Passe 6 est :

`stats_pilotage_scope(p_jours)`

Scopes retenus :
- Admin → réseau NAXA, hors pharmacies de démonstration selon la règle canonique ;
- Promoteur → pharmacies autorisées via `my_pharmacies()` ;
- Responsable/Caisse → pharmacie autorisée par leur profil ;
- Client → aucun accès au Pilotage interne.

Les recherches sans `pharmacie_id` ne doivent **jamais** être attribuées artificiellement à un Promoteur/Responsable/Caisse.

`/admin/pilotage` et `/pharmacie/pilotage` doivent consommer le même moteur KPI canonique et ne doivent pas recréer leur propre calcul métier.

## 5. État au moment de la rupture

- Branche de travail : `feat/pharmacie-validite-pilotage`.
- PR #24 vers `consolidation`.
- HEAD documenté : `bfc6089acc293806fedda8b90078eb0ca23ba021`.
- Migrations de branche : `013` à `018`, sous `supabase/`.
- **013→018 ne sont pas déclarées appliquées en Production.**
- Aucun merge `main` ni déploiement Production ne doit être effectué sans l'autorisation exacte : **OUI, DÉPLOIE**.
- La validation transactionnelle effectuée sur les migrations signifie **ROLLBACK**, donc ne pas la présenter comme une migration Production.
- La Passe 6 avait déjà raccordé les dashboards au moteur canonique, mais les contradictions résiduelles et tests d'acceptation devaient encore être fermés avant de déclarer le Pilotage final vert.

## 6. Contradictions résiduelles à reprendre — ne pas perdre leur contexte

La reprise doit traiter les points déjà identifiés, notamment :

- **E20** : `stocks_couts` encore à aligner complètement sur le scope multi-pharmacie.
- **E21** : `accrediter_profile()` ne doit pas choisir implicitement le parent ; respecter N2→Promoteur et N3→Responsable, avec le cas 2 niveaux explicitement autorisé.
- **E22** : `set_reservation_status()` doit avoir un `search_path` sûr et une autorisation cohérente avec `can_access_pharmacy()`.
- **E23** : test versionné d'acceptation du moteur `018` et couverture des rôles/scopes.
- **E24** : transitions de réservation et multi-pharmacie doivent utiliser le même moteur de scope que Pilotage.
- **E25** : scope Admin et exclusion des pharmacies de démonstration doivent être cohérents pour tous les KPI.
- **E26** : gouvernance documentaire ; le code et les décisions doivent rester traçables ensemble, sans faux vert.
- **E27** : traçabilité branche/PR/`main` ; `consolidation` n'est pas Production.
- **E28** : vérifier le périmètre réel du **Pilotage 360°** prévu par le V3/cahier et distinguer ce qui appartient aux Passes actuelles de ce qui est explicitement prévu plus tard.
- **E29** : branding/design uniquement si exigé par le périmètre Pilotage courant ; ne pas inventer un nouveau design en contradiction avec les sources documentaires.

Cette liste n'est pas une invitation à créer une Passe 7 automatiquement. **Commencer par déterminer si chaque point est une fermeture de la Passe 6, une exigence déjà couverte par une passe antérieure, ou une exigence explicitement différée.**

## 7. Protocole obligatoire en cas de nouvelle rupture

Toute IA qui reprend le projet doit :

1. Lire cette section en premier.
2. Lire les sections de référence les plus récentes de `README.md`, `STATUT.md` et `docs/CONTRADICTIONS.md`.
3. Reconstituer les décisions des Passes 1→6 avant de proposer une nouvelle architecture.
4. Vérifier la branche réelle et distinguer **Production / main / branche / spécification / documentation**.
5. Ne supprimer, remplacer ou recréer aucune architecture existante sans décision explicite.
6. Auditer les contradictions restantes avant de coder.
7. Produire une matrice : **Exigence → décision historique → source → état branche → état Production → contradiction → test d'acceptation → statut**.
8. Ne coder qu'après avoir établi que le plan d'implémentation est complet et sans ambiguïté.
9. Après chaque modification : tests concrets, documentation et ré-audit.
10. Ne déclarer le chantier Pilotage terminé que lorsque les critères applicables sont **prouvés à 100 %**, pas seulement conçus.
11. Une fois le dernier passage Pilotage vert, **revenir au Prompt maître v3 + Cahier v3 pour poursuivre le chantier suivant prévu**, sans laisser volontairement des tâches Pilotage non terminées.
12. **Ne jamais fusionner `main`, appliquer une migration Production ou déployer sans l'accord explicite du fondateur.**

## 8. Critère de continuité

La reprise est considérée correcte uniquement si une nouvelle IA peut répondre sans ambiguïté aux questions suivantes :

- Où en étions-nous ?
- Pourquoi avons-nous choisi cette architecture ?
- Quelles décisions ont été prises pendant les Passes 1→6 ?
- Quelles décisions sont encore ouvertes ?
- Qu'est-ce qui est réellement en Production ?
- Qu'est-ce qui n'est que sur la branche ?
- Quel est le prochain test à exécuter ?
- Pourquoi ne faut-il pas repartir de zéro ?
- Quand faut-il retourner au V3 pour continuer le cahier des charges ?

**Réponse canonique :** nous étions en train de **terminer le chantier Pilotage**, pas de commencer un nouveau chantier. Les Passes 1→6 sont le chemin décisionnel à préserver. Le V3 sert ensuite de cadre pour reprendre la suite du cahier des charges une fois le Pilotage définitivement vert.


## 🔒 Correction commerciale verrouillée — 5 octobre 2026
**Décision : 1 Promoteur = 1 convention = 1 tarif = 1 abonnement.**

Cette décision corrige définitivement l'ancien raisonnement « un tarif / abonnement par pharmacie » :
- plusieurs pharmacies du même Promoteur partagent le même tarif conventionné ;
- l'abonnement appartient au Promoteur ;
- une échéance impayée bloque toutes les pharmacies de son périmètre ;
- un Promoteur peut exister sans pharmacie et recevoir sa convention ;
- le tarif réel est celui configuré par NAXA/Admin dans la convention ; aucun 30 000 FCFA universel n'est une source de vérité.

### Implémentation branche
- migration additive supabase/migration_019_convention_promoteur.sql ;
- tables canoniques conventions_promoteurs, abonnements_promoteurs, abonnement_promoteur_paiements ;
- /admin/pilotage/validite basculé sur un scope Promoteur ;
- cron /api/cron/validite basculé sur un rappel Promoteur unique ;
- validité globale et blocage calculés à partir de l'abonnement Promoteur ;
- E20, E21, E22, E24 et E25 ont reçu une correction dans les migrations de branche ;
- test transactionnel complet 013→019 : PASS syntaxe/dépendances, ROLLBACK, aucune persistance Production.

### État Passe 6
La Passe 6 continue. Le moteur stats_pilotage_scope(p_jours) reste le point d'entrée canonique. Le scope Admin exclut désormais les événements rattachés aux pharmacies démo tout en conservant les recherches réellement sans pharmacie au niveau réseau. Les tests multi-rôles réels et la matrice finale d'acceptation restent à fermer avant le vert 100 %.


### Mise à jour Passe 6 — test d'acceptation 018 exécuté
- Test versionné ajouté : supabase/tests/018_pilotage_canonique_scope.sql.
- Test exécuté avec les migrations 013→018 dans une transaction unique puis ROLLBACK.
- Scénarios prouvés dans cette transaction : Admin voit 3 pharmacies non-démo et compte les recherches réseau (y compris une recherche sans pharmacie) ; Promoteur voit uniquement A+B et ne récupère ni la recherche sans pharmacie ni celle de C.
- Aucun changement persistant en Production.
- CI GitHub sur le dernier commit de test : encore **in_progress** au moment du contrôle ; build/typecheck non déclarés verts avant conclusion du run.


### Passe 6 — validation supplémentaire
- CI précédente `NAXA quality #121` : **SUCCESS** (`tsc --noEmit` + `npm run build`).
- Test d'acceptation `018_pilotage_canonique_scope.sql` corrigé puis rejoué avec les migrations 013→019 dans une transaction : **PASS**, puis **ROLLBACK**.
- Le test prouve Admin (scope réseau non-démo) et Promoteur (scope A+B, sans fuite de recherche sans pharmacie ni de C).
- Le test multi-rôle Responsable/Caisse/Client n'est pas exécuté dans cette transaction : l'ajout de la valeur enum `responsable` ne peut pas être consommé avant commit PostgreSQL. Aucune mutation Production n'a été faite pour contourner cette contrainte. Ce point reste donc explicitement **🟠 non prouvé transactionnellement**.
- CI du dernier commit (`NAXA quality #125`) : **in_progress** au moment de ce contrôle.


---

# 🔒 ÉTAT DE RÉFÉRENCE — 5 OCTOBRE 2026 — APRÈS PASSE 6 / PRÉPARATION P7

> Cette section est prioritaire sur toute formulation historique contradictoire plus haut dans le fichier.

## 1. Position exacte du chantier

Le chantier actuel reste **Pilotage**. Les Passes 1→6 ont construit et consolidé le socle du Pilotage ; nous ne passons pas encore à un autre chantier produit.

- Branche active : `feat/pharmacie-validite-pilotage`
- PR : **#24** vers `consolidation`
- HEAD de référence : `0dd2a02f5a75f1a4f0f4542378713fec50dcabb2`
- CI GitHub **NAXA quality #127 : SUCCESS**
- `main` : **inchangé**
- Production Supabase : **inchangée**
- Migrations 013→019 : **branche uniquement, non appliquées en Production**
- Aucun merge `main`, aucune migration Production et aucun déploiement sans l'autorisation exacte : **OUI, DÉPLOIE**.

## 2. Passe 6 — état réel

La décision centrale reste :

**DONNÉE SOURCE → RÈGLE KPI → KPI CANONIQUE → AGRÉGATION PAR SCOPE → BI → DASHBOARD → RAPPORT/EXPORT**

Le point d'entrée canonique est `stats_pilotage_scope(p_jours)` et les dashboards Admin et pharmacie utilisent ce même moteur.

### Preuves déjà obtenues
- Migration/test 018 exécuté transactionnellement avec rollback.
- Extension du test aux migrations 013→019 : **PASS syntaxe/dépendances, puis ROLLBACK**.
- Admin et Promoteur sont prouvés dans le test d'acceptation versionné.
- CI #127 est **SUCCESS**.
- Les corrections E20, E21, E22/E24 et E25 sont présentes sur la branche.

### Point qui empêche encore le 🟢 100 %
La matrice transactionnelle **Responsable / Caisse / Client** n'est pas encore prouvée dans le même test, en raison de la contrainte PostgreSQL sur l'utilisation d'une nouvelle valeur enum dans la transaction qui l'ajoute. Ce n'est pas une permission de contourner la contrainte par une mutation Production : le point reste **🟠 non prouvé**.

## 3. Décision commerciale canonique

**1 Promoteur = 1 convention = 1 tarif = 1 abonnement**, qu'il possède une pharmacie, plusieurs pharmacies ou temporairement aucune.

La convention est administrative entre NAXA et le Promoteur. Pour l'automatisation, le système attend :
1. le montant à payer ;
2. la date de paiement ;
3. la date d'expiration de la convention / utilisation de la plateforme.

Les pharmacies d'un même Promoteur ne portent donc pas des tarifs ou abonnements indépendants. À échéance impayée, **toutes les pharmacies du périmètre du Promoteur sont bloquées**.

Le montant réel est celui configuré par NAXA/Admin dans la convention. **30 000 FCFA n'est pas un tarif universel.** Les anciennes occurrences historiques restent documentées comme compatibilité historique et ne constituent pas la règle commerciale canonique.

## 4. Suite Pilotage 360° — ordre verrouillé

Une fois la Passe 6 définitivement verte à 100 %, le chantier reprend le cadre graphique et le parcours de pilotage du **V3/Cahier des charges** sans créer une nouvelle direction visuelle.

### Prochain bloc : Pilotage Performance
Chaque famille de pilotage doit disposer de son propre dashboard, tout en consommant les mêmes sources/KPI canoniques.

Périmètre à auditer puis construire :
- objectifs vs réalisé ;
- performance par Caisse ;
- drill-down ;
- comparaison des pharmacies d'un même réseau Promoteur ;
- Network Health / qualité du réseau ;
- rentabilité et marge avec coût figé au niveau transactionnel ;
- dashboard Performance fidèle au design et au parcours V3.

### Bloc suivant : Sécurité & activité réseau
Le Promoteur doit pouvoir consulter les traces de sessions de **son propre réseau uniquement** :
- sessions actives ;
- dernière activité ;
- connexion / déconnexion ;
- sessions expirées ;
- tentatives refusées ;
- pharmacie, utilisateur, rôle et horodatage ;
- appareil/navigateur uniquement si ces informations existent réellement.

Ne jamais exposer : tokens, cookies, secrets, sessions d'un autre Promoteur ou données privées sans rapport avec le scope. Le Promoteur ne manipule pas directement les sessions.

Le scope canonique sera `promoteur_pharmacies` : **Promoteur → pharmacies → Responsables/Caisses → activité**.

### Bloc final : Pilotage Direction 360°
Agrégation cohérente de : **Commercial + Performance + Sécurité/activité**, selon le périmètre V3.

## 5. Règle de méthode pour la suite

Avant tout code P7/P8 : audit de l'existant, matrice des contradictions, vérification des points de communication avec les implémentations actuelles, plan complet, estimation de faisabilité et de couverture. Le chantier ne démarre que lorsque **faisabilité = 100 % et couverture = 100 %**, puis après accord explicite.

Après implémentation : tests concrets, CI, ré-audit, README/STATUT/CONTRADICTIONS mis à jour. Aucun faux vert : une décision conçue n'est pas une preuve Production.


## 🔒 Passe 6 — preuve multi-rôles mise à jour — 5 octobre 2026
- Test transactionnel 013→018 + test 018 : **PASS / ROLLBACK** pour **Admin, Promoteur, Caisse et Client**.
- Test Responsable séparé : `supabase/tests/018b_pilotage_responsable_post_commit.sql`.
- Cause du découpage : PostgreSQL interdit l'utilisation d'une nouvelle valeur enum dans la même transaction que `ALTER TYPE ... ADD VALUE`; le test Responsable doit donc être exécuté après commit contrôlé de 016. citeturn0search0
- Production reste inchangée.
- **Passe 6 : 🟠 tant que Responsable n'est pas transactionnellement prouvé.**
