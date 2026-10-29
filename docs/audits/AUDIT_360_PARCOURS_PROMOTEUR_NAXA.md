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
