# NAXA — Audit 360° du parcours Promoteur

> Document de travail vivant. Référence active : `main`. Mise à jour : 29 octobre 2026.
> Périmètre conforme à `naxa_prompt_maitre_fusion_v2.md` : clôture du Pilotage 360°, reprise du Promoteur à la partie 3 (à revalider), puis parties 4 à 6. Aucun déploiement manuel n'est autorisé par ce document.

## 1. Mandat et règles

- Parcours cible : Promoteur parent, réseau multi-pharmacie, convention et abonnement uniques au niveau Promoteur, paiements et validation Admin, échéance J-5, blocage/réactivation, caisses/enfants et droits de périmètre.
- Source de vérité : état réel de `main` et de Supabase, puis `README.md`, `STATUT.md`, `docs/CONTRADICTIONS.md`, cahier v3.7 et prompt maître.
- Règles : ne pas créer de branche; ne pas déployer; ne pas modifier une règle métier sans preuve et autorisation; migrations additives seulement si nécessaires et autorisées; mettre à jour le suivi à chaque passe.
- Statuts : **Vérifié** = contrôle direct documenté; **Partiel** = contrôle limité; **À tester** = preuve comportementale manquante; **Bloqué** = dépendance non disponible.

## 2. Rapport de reprise

Le prompt maître prescrit : Promoteur parties 1 et 2 historiquement vertes; partie 3 en pause (migration 028 construite, test structurel PASS, comportemental non clos); parties 4 à 6 à faire. Cette déclaration est un état documentaire historique, pas une preuve de l'état de runtime actuel. La reprise doit d'abord revalider la partie 3 avant d'entrer dans la partie 4.

La passe précédente a consacré des corrections à la sécurité/performance Supabase. Elles ne constituent pas une certification du parcours métier Promoteur. Le présent audit réoriente explicitement la suite sur ce parcours.

## 3. Contrôle direct Supabase — socle commercial Promoteur (29/10/2026)

Projet inspecté : `eouwtuusnsuxaejsxknf`. Requêtes en lecture seule.

### 3.1 Tables et contrat de données

Tables présentes :
- `conventions_promoteurs` : convention rattachée à `promoteur_id`, montant mensuel, échéance/statut et code d'architecture.
- `abonnements_promoteurs` : `promoteur_id`, `convention_id`, montant mensuel, dates début/échéance, statut, blocage/réactivation et état de rappel J-5.
- `abonnement_promoteur_paiements` : paiements liés à l'abonnement, période, montant, référence et date de paiement.
- `abonnement_promoteur_reglements` : déclarations de règlement avec canal, preuve, statut, approbateur, dates de confirmation et période.
- `promoteur_pharmacies` : relation réseau Promoteur-pharmacie avec statut actif.

Un trigger `verifier_abonnement_promoteur_coherence` existe sur INSERT/UPDATE de `abonnements_promoteurs`. Des triggers d'historisation sont présents sur ces tables; `promoteur_pharmacies` possède également un trigger de provisionnement.

**Constat :** le socle de tables existe et expose les champs attendus par le contrat commercial de haut niveau. Cela ne prouve ni l'intégrité des données en place, ni le fonctionnement bout en bout de chaque parcours.

### 3.2 RLS et privilèges directs observés

Les cinq tables ont RLS activée; `anon` n'a aucun privilège SELECT direct sur ces tables. `abonnement_promoteur_reglements` n'accorde aucun privilège direct à `authenticated`, cohérent avec une soumission/validation via fonctions contrôlées.

- `abonnements_promoteurs` et `conventions_promoteurs` : policies de lecture propriétaire par `promoteur_id = auth.uid()`, et policy d'administration via `is_admin()`. Les privilèges INSERT/UPDATE accordés à `authenticated` ne donnent pas à eux seuls accès en écriture : la RLS doit autoriser la ligne.
- `abonnement_promoteur_paiements` : lecture propriétaire via l'abonnement lié; écriture administrateur via `is_admin()`.
- `promoteur_pharmacies` : politiques propriétaire et administrateur, mais plusieurs policies SELECT se recouvrent (`promoteur_pharmacies_owner` et `promoteur_pharmacies_select`) et des policies administrateur distinctes se recouvrent aussi. Ce chevauchement correspond à un candidat de simplification, pas à une preuve d'accès non autorisé. Ne rien supprimer avant comparaison exacte des comportements et tests RLS.

### 3.3 Fonctions commerciales et garde-fous constatés

Inventaire de signatures et droits :
- `promoteur_soumettre_reglement(...)` : SECURITY DEFINER, `search_path=''`, non exécutable par `anon` et `authenticated` selon `has_function_privilege`; parcours de soumission à vérifier via la route serveur qui l'appelle.
- `admin_confirmer_reglement_promoteur(uuid,uuid)`, `admin_refuser_reglement_promoteur(...)` et `admin_enregistrer_reglement_promoteur(...)` : SECURITY DEFINER, `search_path=''`, non exécutables directement par `anon`/ `authenticated` selon les privilèges effectifs consultés.
- `generer_rappels_echeance_promoteurs()` : SECURITY DEFINER, `search_path=''`, non exécutable par `anon`/ `authenticated`.
- `naxa_promoteur_valide(uuid)` et `validites_promoteurs_admin()` sont exécutables par `authenticated` selon le contrôle de privilèges. Leur définition, les contrôles d'autorisation internes, les appelants et la surface de données retournée doivent être examinés avant toute modification.
- Les helpers `is_promoteur()` sont exécutables par `anon` et `authenticated`; leur corps et l'usage réel doivent être revus avant de conclure à un risque.
- Plusieurs fonctions de cycle de vie utilisent encore `search_path=public` (`claim_validite_promoteurs_5j`, `initialiser_abonnement_pharmacie`, `marquer_rappel_promoteur`). Leur surface d'appel est restreinte dans le contrôle des privilèges; le durcissement éventuel doit être traité après inspection du corps et des triggers.

**Limite :** les définitions complètes des fonctions, leurs appels depuis les routes/UI et les résultats d'exécution métier n'ont pas encore tous été vérifiés. Aucune conclusion de vulnérabilité n'est tirée uniquement du nom ou du flag SECURITY DEFINER.

## 4. Matrice de validation actuelle

| Domaine | État | Preuve disponible | Prochaine preuve requise |
|---|---|---|---|
| Tables convention/abonnement/règlement/réseau | Vérifié — structure | Tables, colonnes, RLS et privilèges lus sur Supabase | Contraintes, données incohérentes et intégrité multi-pharmacie |
| Soumission du règlement par Promoteur | Partiel | RPC présente et privilèges contrôlés | Route serveur, validations des montants/canal/preuve, test rôle Promoteur |
| Confirmation/refus Admin | Partiel | RPC et privilèges contrôlés; garde métier mentionnée dans le registre | Corps complet, idempotence, audit trail et test multi-rôles |
| Rappel J-5 | Partiel | Fonction active identifiée, `search_path=''`, noms Promoteur/pharmacies documentés | Ordonnanceur, unicité/anti-doublon, fuseau, notifications délivrées |
| Blocage et réactivation du réseau | Partiel | Fonctions et champs de cycle de vie présents | Vérifier toutes les pharmacies liées et absence de réactivation automatique non autorisée |
| Accès au réseau multi-pharmacie | Partiel | RLS propriétaire/admin et relation de réseau présentes | Vérifier chaque route, RPC et policy; clarifier policies SELECT redondantes |
| UI du parcours Promoteur | À tester | Pas encore d'inspection exhaustive des pages et formulaires dans cette passe | Inventaire des pages, actions, états loading/empty/error, liens et validations |
| Parties 3 à 6 du Pilotage Promoteur | À revalider | Statut historique du prompt maître | Lire la migration 028, tests associés et code actuel; exécuter les tests disponibles |
| Build, tests intégrés, recette Production | Non certifié | Aucun run complet de cette passe | Tests disponibles sans relancer CircleCI; aucune livraison sans autorisation |

## 5. Contradictions et risques à ne pas masquer

1. Le prompt maître décrit la partie 3 comme « pause » et les parties 4–6 comme « à faire »; ne pas annoncer une progression fonctionnelle sans relecture des fichiers et tests actuels.
2. L'existence des tables et RPC ne prouve pas que l'interface Promoteur utilise le bon chemin serveur ni que chaque action est disponible uniquement au bon rôle.
3. Les politiques permissives en recouvrement sur `promoteur_pharmacies` sont à analyser, pas à retirer aveuglément.
4. L'état de Production et la recette visuelle restent non certifiés. Aucun déploiement manuel n'a été déclenché.

## 6. Prochaine passe obligatoire

1. Inventorier les routes, pages et composants liés au Promoteur, à la convention, aux règlements, aux caisses et au réseau.
2. Lire les définitions complètes des RPC listées ci-dessus et les appels UI/API correspondants.
3. Revalider la partie 3 du Pilotage Promoteur (migration 028 + tests comportementaux disponibles).
4. Construire la matrice de tests par rôle : Promoteur, Admin, pharmacie/caisse et non-propriétaire.
5. Ne corriger que les écarts prouvés; ajouter les tests et mettre à jour ce document, `STATUT.md` et `docs/CONTRADICTIONS.md`.

## 7. Lecture des définitions SQL — passe 2 (29/10/2026)

### 7.1 Contrôle positif : confirmation du règlement
La définition active de `admin_confirmer_reglement_promoteur(uuid,uuid)` vérifie un profil Admin actif, verrouille le règlement et l'abonnement/convention, refuse un règlement qui n'est plus en attente, exige date/compte payeur/preuve, compare le montant déclaré au tarif conventionné et bloque une convention ou un abonnement résilié. La confirmation est idempotente pour un règlement déjà confirmé. Elle renouvelle l'abonnement et la convention, crée le paiement, notifie et journalise l'opération.

Point conforme au garde-fou : cette fonction ne réactive pas directement les profils ou pharmacies; le commentaire SQL explique que la cause d'une inactivation n'est pas suffisamment traçable pour lever automatiquement toute suspension.

### 7.2 Contrôle positif : soumission du règlement
La définition active de `promoteur_soumettre_reglement(...)` valide le Promoteur, le montant, le canal, les informations payeur, la date et le chemin de preuve, vérifie l'abonnement/convention et le tarif, et empêche plusieurs règlements `en_attente` pour le même Promoteur. Elle notifie l'Admin avec le nom du Promoteur et les pharmacies, et le Promoteur de la soumission. Son privilège EXECUTE n'est pas accordé directement à `authenticated` ni à `anon` selon le contrôle précédent : l'autorisation du demandeur doit donc être vérifiée dans la route serveur privilégiée qui l'appelle.

### 7.3 Risque de cohérence à instruire — voie distincte de réactivation
La fonction `reactiver_promoteur(uuid,text)` vérifie `public.is_admin()` et la cible Promoteur, puis réactive l'abonnement/la convention, **toutes les pharmacies liées** et des profils associés. Cette voie est plus large que `admin_confirmer_reglement_promoteur`, qui préserve l'état des profils/pharmacies. Il faut confirmer ses droits EXECUTE effectifs et rechercher tous ses appelants pour établir si elle constitue un ancien chemin manuel encore accessible. Aucune modification n'est faite à ce stade.

### 7.4 Fonctions de lecture et autorisation
- `naxa_promoteur_valide(uuid)` vérifie qu'une session existe et refuse un Promoteur différent de `auth.uid()` sauf Admin; l'appel interne est `private.naxa_promoteur_valide`.
- `validites_promoteurs_admin()` filtre ses résultats avec `public.is_admin()`; elle est néanmoins EXECUTE par `authenticated`, donc le garde interne est déterminant et doit être conservé.
- `is_promoteur()` délègue à `private.is_promoteur()`; son exécution par `anon` n'expose à première vue qu'un booléen, mais son usage doit être évalué dans les politiques et routes.

### 7.5 Limites
Les définitions SQL ont été lues, mais les routes API et composants qui appellent ces fonctions n'ont pas encore été identifiés et inspectés. Les contrôles statiques ne remplacent pas les tests de rôle ni une exécution bout en bout. La priorité suivante est de rechercher les appelants de `reactiver_promoteur` et de `promoteur_soumettre_reglement`, puis d'inspecter les écrans Promoteur/Admin correspondants.


## 8. Clôture d'un point — droits effectifs de `reactiver_promoteur` (29/10/2026)

**Contrôle direct exécuté sur Supabase Production, en lecture seule :** `has_function_privilege` et ACL effectives de la signature `public.reactiver_promoteur(uuid,text)`.

| Rôle | EXECUTE effectif |
|---|---|
| `anon` | Non |
| `authenticated` | Non |
| `service_role` | Non |
| `postgres` (propriétaire) | Oui |

La fonction reste `SECURITY DEFINER` avec `search_path=''` et contient un contrôle `public.is_admin()`. Mais **aucun des rôles de l'application Supabase, y compris `service_role`, ne peut l'exécuter avec les droits actuels**. Le risque précis d'une invocation via la route applicative Supabase standard est donc clos pour l'état ACL observé. La fonction n'a pas été supprimée ni modifiée; aucune donnée métier n'a été écrite. Ne pas rouvrir ce point à moins qu'une modification future de ses grants ou de son propriétaire soit constatée.

Le contrôle confirme aussi les ACL déjà documentées pour les deux fonctions de règlement : `promoteur_soumettre_reglement(...)` et `admin_confirmer_reglement_promoteur(uuid,uuid)` sont exécutables par `service_role` uniquement, pas par `anon` ni `authenticated`. Leur **autorisation de route** demeure donc le prochain contrôle métier prioritaire : l'identité authentifiée doit être liée au Promoteur demandé, et l'identité Admin active ne doit pas provenir d'un UUID librement fourni par le client.

### Point de reprise unique — ne pas recommencer l'audit général

1. Rechercher dans le code réel l'appel serveur à `promoteur_soumettre_reglement` et vérifier l'égalité entre l'utilisateur authentifié et `p_promoteur`; vérifier également le chemin d'appel de `admin_confirmer_reglement_promoteur` et la source de `p_admin`.
2. Fermer cette tranche avec une preuve de code ou corriger le contrôle manquant, puis tests ciblés. Ne pas reprendre le contrôle ACL de `reactiver_promoteur` sans changement de grants.
3. Ensuite seulement, reprendre la validation comportementale de la partie 3 du Pilotage Promoteur et avancer vers la partie 4 selon le mandat.

**Limite de cette passe :** la recherche de code GitHub n'a renvoyé aucun résultat exploitable pour les noms des fonctions; les appelants applicatifs ne sont donc pas déclarés vérifiés. Aucun déploiement, aucune relance CI et aucune écriture Supabase n'ont été effectués.



## 9. Clôture des appelants applicatifs de règlement et reprise partie 3 (29/10/2026)

### 9.1 Routes de règlement — vérifiées dans le code réel de `main`
- `src/app/promoteur/paiements/actions.ts` (blob `80176eacaa463229e63764d62865c1162918f817`) : appelle `auth.getUser()`, exige un profil `role='promoteur'`, transmet `p_promoteur=user.id` (pas un champ libre), valide les champs, téléverse la preuve sous un chemin préfixé par l'UUID connecté, puis appelle `promoteur_soumettre_reglement` via le client serveur privilégié. En cas d'échec RPC, retire le fichier envoyé. **Contrôle d'identité de la soumission : conforme au code inspecté.**
- `src/app/admin/pilotage/reglements/actions.ts` (blob `fa92c6126fbe836d5ddee5ab3f698d6213a1be18`) : les actions de confirmation et de contestation passent par `requireAdminActive`; la confirmation passe `p_admin=user.id`, exige une UUID de règlement, l'état `en_attente`, une preuve signée accessible et une case de confirmation. **Contrôle de rôle et origine de l'identité Admin : conforme au code inspecté.**
- `src/lib/admin/require-admin-active.ts` (blob `f9f7591e8beb7e93872d92b7ec832a91e4840d85`) vérifie l'utilisateur par `auth.getUser()` et le profil `role='admin'` + `actif=true` côté serveur.
- Les ACL Supabase observées confirment que les deux RPC de règlement ne sont exécutables que par `service_role`; les actions serveur sont les appelants identifiés. La fonction `reactiver_promoteur` demeure non exécutable par les rôles applicatifs et n'est pas utilisée par ces deux actions.

**Résultat de la tranche : clôturée sur inspection de code et ACL.** Les tests d'intégration/runtime n'ont pas été exécutés; ce statut ne les prétend pas réussis.

### 9.2 Partie 3 — état réel et limite des preuves
- Le dépôt contient `supabase/migration_028_promoteur_responsable_accreditation.sql` et `supabase/tests/028_promoteur_responsable_accreditation_behavior.sql`. Le test comportemental décrit une fixture transactionnelle pour l'architecture, le scope, l'accréditation Responsable, l'expiration commerciale et le refus en architecture ORPHELIN.
- La base de Production expose actuellement des façades publiques `accrediter_profile`, `accrediter_responsable`, `naxa_has_privilege`, `naxa_can`, `naxa_promoteur_valide`, `naxa_provision_caisse`, `naxa_set_caisse_status`, avec `search_path=''`; les wrappers délèguent plusieurs traitements au schéma `private`. EXECUTE est refusé à `anon` et accordé à `authenticated` pour les RPC métier observées.
- L'historique `supabase_migrations.schema_migrations` ne contient pas de version littérale `028` : le fichier `migration_028...` est à la racine de `supabase/`, hors du répertoire `supabase/migrations/`. Cela **ne prouve pas** à lui seul que la fonctionnalité est absente : des migrations ultérieures de réconciliation sont enregistrées en Production. La version effective est celle des définitions SQL lues, pas le seul nom de fichier.
- Les scripts `supabase/tests/028...` et suivants existent dans le dépôt mais leur présence n'est pas une preuve d'exécution réussie. Ils n'ont pas été lancés sur Production, afin d'éviter les écritures de fixtures même temporaires sur la base de production.

### 9.3 Étape de reprise unique
La tranche des routes de règlement est terminée. Continuer sur la **partie 3 du Pilotage Promoteur** en comparant les fonctions `private.accrediter_profile`, `private.naxa_has_privilege`, `private.naxa_can`, `private.naxa_promoteur_valide` et les migrations de réconciliation 137/142/146/147/153, puis déterminer un environnement de test non-Production disponible pour exécuter le test comportemental. Ne pas recommencer la vérification des routes de paiement ni déclarer la partie 3 verte avant preuve comportementale.


## 10. Contradiction concrète découverte — validité commerciale active (29/10/2026)

La définition actuelle de Production de `private.naxa_promoteur_valide(uuid)`, lue directement dans `pg_get_functiondef`, vérifie le profil Promoteur actif, la convention active/non expirée et l'abonnement actif/non expiré. Elle **ne contient pas** les gardes présentes dans `supabase/migration_147_promoteur_validity_internal_facade_split.sql` et attendues par `supabase/tests/147_promoteur_validity_internal_facade_split.sql` : architecture de convention non nulle, au moins une pharmacie réseau active, et cohérence de chaque pharmacie active avec une pharmacie active et une architecture active de même code.

L'historique Supabase contient bien la migration `promoteur_validity_internal_facade_split_147` (version `20261019122137`), mais le corps actif ne correspond pas au corps de ce fichier. C'est un **écart code Git / fonction Production prouvé**, pas seulement une hypothèse. Les causes possibles (migration ultérieure, dérive manuelle ou autre fichier qui redéfinit le helper) restent à établir avant de corriger.

Contrôle d'impact en lecture seule : 1 Promoteur en base; il satisfait à la fois l'ancienne et la règle stricte actuellement écrite dans le dépôt. Aucun impact utilisateur actuel n'a été détecté par ce comptage, mais le contrôle est un instantané, pas un test fonctionnel.

**Décision de cette passe :** ne pas écraser le helper par une migration corrective tant que la source du remplacement divergent n'a pas été localisée. Étape ciblée suivante : comparer toutes les définitions/migrations postérieures du helper et les règles canoniques de validité. Le test 147 doit ensuite être exécuté dans un environnement non-Production; sa présence dans le dépôt n'est pas une preuve de PASS en Production.


## 11. Action corrective préparée — helper de validité Promoteur (29/10/2026)

### Constat confirmé
La lecture directe de `pg_get_functiondef` confirme que `private.naxa_promoteur_valide(uuid)` en Production ne contrôle que le rôle Promoteur, l'état actif du profil, le statut et l'échéance de la convention et de l'abonnement. Elle omet trois gardes du contrat de la migration 147 : architecture de convention renseignée, existence d'au moins un rattachement réseau actif et cohérence de chaque rattachement actif avec une pharmacie active et une architecture active de même code.

Les migrations 149, 151, 152 et 153 inspectées ne redéfinissent pas directement ce helper. L'origine exacte de la dérive reste **non identifiée**; l'historique prouve que la migration 147 a été enregistrée, mais son corps actif n'est plus celui attendu. Le seul Promoteur présent au moment du comptage passe les règles strictes, ce qui ne prouve pas le comportement sur les cas limites.

### Travail réalisé sur `main` — non appliqué en Production
- Migration additive préparée : [`supabase/migration_20261029_promoteur_validity_helper_reconciliation.sql`](../../supabase/migration_20261029_promoteur_validity_helper_reconciliation.sql), commit `7b6191fddc7ded1aa7222d53fc82e19155011327`. Elle rétablit le corps attendu et réaffirme l'absence d'EXECUTE pour les rôles API. Elle ne modifie aucune donnée métier.
- Test ciblé ajouté : [`supabase/tests/promoteur_validity_helper_reconciliation.sql`](../../supabase/tests/promoteur_validity_helper_reconciliation.sql), commit `fac003d8220b9490efaf90ff605e99693eac8901`. Il contrôle les gardes de définition, la façade publique et les ACL du helper.
- Les ACL actuelles du helper ont été contrôlées en lecture seule : `anon=false`, `authenticated=false`, `service_role=false`, propriétaire `postgres=true`.

### Statut et point de sortie
**La correction est préparée, mais non exécutée.** Aucun test SQL n'a été lancé sur Production; aucun environnement non-Production n'est actuellement confirmé dans les accès disponibles. Ne pas qualifier la migration de validée ou la partie 3 de verte. Avant application, exécuter le test dans un environnement isolé; puis comparer les résultats fonctionnels sur cas valides, sans architecture, sans réseau actif et avec incohérence pharmacie/architecture. Aucun déploiement ni aucune migration Production n'ont été lancés.

### Prochaine action unique
Identifier ou obtenir un environnement Supabase non-Production réellement accessible, exécuter le test ciblé et le scénario comportemental 028/147, corriger les échecs puis fermer la partie 3 sur preuves. Ne pas recommencer l'audit des routes de règlement ni le contrôle ACL déjà clos.


## 12. Reprise comportementale partie 3 — environnement isolé trouvé (29/10/2026)

### Environnement et opérations réalisées
Le projet Supabase `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`) est accessible, actif et distinct de Production (`eouwtuusnsuxaejsxknf`). Il sert désormais d'environnement de test non-Production pour cette tranche.

Sur cet environnement de test uniquement, les migrations sources `supabase/migration_147_promoteur_validity_internal_facade_split.sql` et `supabase/migration_20261029_promoteur_validity_helper_reconciliation.sql` ont été appliquées sous des noms de replay de test. **Aucune de ces opérations n'a été appliquée à Production.**

### Résultats exécutés
- `supabase/tests/028_promoteur_responsable_accreditation_behavior.sql` : **PASS**, fixture transactionnelle terminée par `ROLLBACK`; aucun profil/pharmacie de test ne persiste.
- Test ciblé du helper privé après application de la réconciliation en test : **PASS** sur les gardes architecture obligatoire, réseau actif, cohérence pharmacie/architecture et absence d'EXECUTE pour `anon`, `authenticated`, `service_role`.
- Test complet `supabase/tests/147_promoteur_validity_internal_facade_split.sql` : **ÉCHEC** sur assertion 147.3, car la façade publique de l'environnement de test est encore l'ancien wrapper `select private.naxa_promoteur_valide($1)`, sans garde d'identité/Admin. Le test de réconciliation complet échoue de même sur PVH.4 pour cette même raison. Ce résultat indique un **environnement de replay incomplet/désaligné**, pas un échec des gardes du helper privé après correction.
- Tentative d'appliquer la migration 040 de sécurisation de la façade au projet de test : bloquée par le contrôle de sécurité de l'outil; pas de nouvelle tentative équivalente. La limite est circonscrite à l'alignement de la façade de ce replay.

### Comparaison Production / dépôt / replay
- Production : `public.naxa_promoteur_valide(uuid)` contient bien les gardes `auth.uid()` et `public.is_admin()`; `private.naxa_promoteur_valide(uuid)` omet toutefois les gardes architecture/réseau/cohérence attendues par la migration 147.
- Dépôt : migration 147 et migration additive de réconciliation présentes; le helper cible contient les gardes attendues.
- Replay : après application de la migration 147 et de la réconciliation, le helper privé est conforme, mais la façade publique reste obsolète et empêche le test 147 complet de passer.

### Statut exact de la partie 3
**🟡 PARTIELLE — pas verte.** Le scénario métier 028 passe dans l'environnement de test et le helper corrigé passe son test ciblé. La recette complète 147 reste bloquée par la façade obsolète du replay. Le défaut Production du helper privé reste corrigé dans le dépôt mais **non appliqué en Production**. Aucune migration Production, aucun déploiement, aucune relance CI et aucune modification des données Production n'ont été effectués.

### Prochaine action unique
Rétablir un replay non-Production cohérent pour la façade publique à partir des migrations canoniques déjà présentes, puis relancer sans modification les tests 147 et PVH complets. Une fois ces tests verts, exécuter le scénario comportemental élargi des cas valides, architecture absente, réseau absent et pharmacie/architecture incohérente. Ne pas reprendre les routes de règlement ni les ACL déjà clôturées.
