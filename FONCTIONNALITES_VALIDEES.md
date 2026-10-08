# NAXA — REGISTRE DES FONCTIONNALITÉS / ÉTAT DE VALIDATION

> **Document de pilotage permanent.**
> Ce registre sert à savoir **ce qui est réellement terminé, ce qui est terminé hors `main`, ce qui est seulement construit, ce qui est bloqué par une preuve et ce qui reste à construire**.
>
> **Source de vérité du code intégré : `main`.**
> **Sources de vérité fonctionnelles : Cahier des charges NAXA v3.7 + Prompt maître + historique technique vérifié.**
>
> **Règle cardinale : un point 🟢 réellement validé n'est jamais reconstruit ni retraité, sauf régression prouvée.**

---

## 1. RÈGLE DE TRAVAIL — VERSION COURANTE

Le cycle NAXA est :

**AUDIT → CONTRADICTION → CAUSE RACINE → SOLUTION → CONSTRUCTION/CORRECTION → TEST → PREUVE → CONSIGNATION → COMMIT → MAIN → 🟢 → CONTINUER**

Mais le registre impose désormais une deuxième règle :

### Ne jamais confondre « construit », « validé hors main » et « validé dans main »

| Statut | Signification | Action |
|---|---|---|
| 🟢 **VALIDÉ — MAIN** | Fonctionnalité prouvée et intégrée dans `main` | **Ne plus revenir dessus** sauf régression |
| 🟢 **VALIDÉ — HORS MAIN** | Fonctionnalité réellement validée sur une autre branche/commit, mais non intégrée dans `main` | **Ne pas reconstruire** ; intégrer/réconcilier puis revalider uniquement l'intégration |
| 🟡 **CONSTRUIT — PREUVE MANQUANTE** | Code présent/traité, mais une preuve technique/fonctionnelle manque | Classer par cause puis résoudre en lot |
| 🟡 **CONSTRUIT — INTÉGRATION MANQUANTE** | Fonctionnalité traitée dans une branche historique mais état `main` non démontré | Comparer/réconcilier ; ne pas refaire |
| 🔴 **À CORRIGER** | Contradiction, défaut, régression ou sécurité non conforme | Corriger jusqu'au 🟢 |
| ⚪ **À FAIRE** | Fonctionnalité non construite après audit de l'existant | Construire |

### Règle anti-boucle

**🟢 = verrouillé.**

Une fiche 🟢 contient sa preuve et devient une référence historique.  
On ne la « revalide » pas simplement parce qu'une autre conversation recommence l'audit.

---

# 2. NIVEAUX DE PREUVE

| Niveau | Définition |
|---|---|
| 🟡 Statique | Code/routes/UI présents et contrôlés |
| 🟢 Technique | Build/tests/code/DB/sécurité effectivement prouvés |
| 🟢 Fonctionnelle | Flux métier effectivement vérifié |
| 🟢 Production | Déploiement Production autorisé et comportement Production vérifié |

**Important :** un niveau manquant ne transforme pas automatiquement un travail existant en « non construit ». Il doit être classé selon sa **cause exacte**.

---

# 3. STRATÉGIE DE RÉSOLUTION PAR LOT

Le projet ne doit plus être traité fonctionnalité par fonctionnalité lorsque plusieurs blocages ont la même cause.

Exemple :

- 11 fonctionnalités bloquées uniquement par CI ;
- 4 par preuve Supabase live ;
- 2 par contradiction SQL ;
- 1 réellement non construite.

Alors :

**LOT CI → trouver une voie de vérification alternative → vérifier les 11 en masse**

**LOT SUPABASE → trouver une méthode de preuve commune → vérifier les 4**

**LOT CONTRADICTIONS → corriger les 2**

**LOT CONSTRUCTION → construire la 1**

### Conséquence

Un blocage GitHub/CI ne doit **jamais** entraîner la reconstruction des fonctionnalités concernées.

Nous cherchons d'abord une **solution de preuve commune**, puis nous lançons une vérification massive.

---

# 4. FICHE OBLIGATOIRE

Chaque fonctionnalité doit conserver, quand disponible :

- ID ;
- domaine ;
- description ;
- routes ;
- fichiers ;
- DB : tables/vues/RPC/triggers ;
- migrations ;
- tests + résultats ;
- branche de création ;
- commit de création ;
- branche/commit de validation ;
- SHA d'intégration dans `main` ;
- déploiement ;
- niveaux de validation ;
- preuves ;
- statut ;
- cause du non-vert ;
- solution détectée ;
- correction ;
- prochaine action ;
- dernière vérification ;
- contradictions connues.

---

# 5. ALIGNEMENT AVEC LE CAHIER DES CHARGES v3.7

Le registre est désormais organisé autour des axes confirmés par la v3.7 :

1. socle Client/Auth ;
2. pharmacie et exploitation ;
3. Promoteur / Caisses ;
4. **Pilotage 360° (§2bis)** ;
5. hiérarchie N0 → N4 ;
6. architectures ;
7. privilèges et délégation ;
8. convention Promoteur / tarif / abonnement / validité ;
9. Responsable N2 ;
10. multi-pharmacie et scopes ;
11. CA canonique ;
12. sécurité/réseau/sessions ;
13. rapports/BI/exports ;
14. ERP pharmacie ;
15. mise en service terrain et extensions prévues.

**Point important v3.7 : ERP est bien un axe du produit.**  
Le fait que certaines briques stock/vente existent déjà ne signifie pas que tout l'ERP est construit.

---

# 6. ALIGNEMENT AVEC LE PROMPT MAÎTRE

Le registre applique les règles suivantes du prompt maître :

- `main` = source de vérité de l'intégration ;
- historique des branches conservé ;
- ne jamais déclarer 🟢 sans preuve ;
- ne pas refaire une fonctionnalité déjà traitée ;
- audit avant codage ;
- correction des contradictions avant poursuite ;
- Production uniquement avec autorisation explicite ;
- aucune dépendance à un service payant ;
- documentation après chaque chantier ;
- les blocages externes sont isolés et regroupés ;
- une preuve manquante est traitée comme un problème de **validation**, pas comme une raison de déclarer le développement inexistant.

---

# 7. INVENTAIRE ACTUEL — 🟢 VALIDÉ DANS MAIN

> Ces éléments ne doivent plus être retraités sauf régression prouvée.

## NAXA-F001 — Authentification / connexion
Routes principales : `/connexion`, `/nouveau-mot-de-passe`, `/mot-de-passe-oublie`, `/verification-age`.

Travaux consolidés : username/mot de passe, récupération, OTP, reset, session Supabase, Google OAuth/callback, destination de retour, conteneur auth sans scroll, précontrôle serveur OTP, compte inexistant sans OTP.

Branches historiques : `feat/auth-flow-age-gate`, `fix/auth-reset-google-ux`, `fix/auth-no-scroll-final-20261004`, `reconcile/auth-homepage-20261004`, `reconcile/naxa-final-auth-home-20261004`, `feat/final-auth-legal-ux-20261004`.

Preuve de consolidation : commit `d69bec6742bc475e6aadac317fa4317edd894567`.

**Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE**

---

## NAXA-F002 — Création de compte
Route : `/creation-compte`.

Username unique, OTP, téléphone pays/indicatif/numéro, validation, sélecteur pays compact, UX mobile et absence de scroll.

Branches : `feat/creation-compte`, `docs/creation-compte-consolidation-20261004`, `fix/creation-compte-mobile-ux-20261005`, `fix/creation-phone-forgot-password-20261004`.

**Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE**

---

## NAXA-F003 — Validation d'âge
Route : `/verification-age`.

Trois politiques, contrôles interface + serveur, hardening.

Branche historique : `fix/age-gate-production-hardening`.

**Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE**

---

## NAXA-F004 — Accueil / marketplace de recherche
Recherche, classement prix/distance/temps, circulation, « Les plus recherchés », traductions, CTA pharmacie, disclaimer, numéros d'urgence et actions protégées.

**Statut : 🟢 VALIDÉ — MAIN — périmètre existant**

---

## NAXA-F005 — Catalogue / fiches produits
Catalogue, fiches, contrôles administratifs, relation panier, migrations catalogue/panier et hardening.

**Statut : 🟢 VALIDÉ — MAIN — périmètre existant**

---

## NAXA-F006 — Panier
Gestion panier + contrôles serveur + protection des opérations.

**Statut : 🟢 VALIDÉ — MAIN — périmètre existant**

---

## NAXA-F007 — Réservation / retrait
Réservation 3 h, expiration, reçu, retrait, paiement guidé facultatif.

**Statut : 🟢 VALIDÉ — MAIN — périmètre existant**

---

## NAXA-F008 — Paiement guidé
Code marchand, statut réservation, reçu imprimable.

**Statut : 🟢 VALIDÉ — MAIN — périmètre existant**

---

## NAXA-F009 — WhatsApp
Interaction existante ; règle actuelle : pas de numéro WhatsApp pharmacie exposé au client.

**Statut : 🟢 VALIDÉ — MAIN — périmètre existant**

---

## NAXA-F010 — Scan/import ordonnance
Import téléphone, caméra, OCR et parcours protégé.

**Statut : 🟢 VALIDÉ — MAIN — périmètre existant**

---

## NAXA-F011 — Suivi / historique client
Suivi, historique, achats, isolation par `auth.uid()`.

**Statut : 🟢 VALIDÉ — MAIN — périmètre contrôlé**

---

## NAXA-F012 — Pharmacie / espace équipe
Route : `/pharmacie`.

Stock, garde via RPC sécurisée, réservations, IndexedDB, offline, badge, synchronisation et résolution par `updated_at`.

Branches historiques : `feat/pharmacie-pilotes-offline-20261005`, `feat/pharmacie-promoteur-caisses-20261005`, `feat/pharmacie-validite-pilotage`.

**Statut : 🟢 VALIDÉ — MAIN — périmètre consolidé**

---

## NAXA-F013 — Import de stock
Excel/CSV, désignation/produit, prix, quantité, dosage/conditionnement, péremption, modification manuelle et persistance.

**Statut : 🟢 VALIDÉ — MAIN — mécanisme existant**

---

## NAXA-F014 — Promoteur / Caisses
Promoteur parent, Caisses enfants, création/gestion/blocage/réactivation, stock/réservations/garde partagés, `parent_profile_id`, `actif`.

Branche historique : `feat/pharmacie-promoteur-caisses-20261005`.

Commit de consolidation : `5ad95ce30dd43b3c140e0048606c81dd5143e490`.

Déploiement historique documenté : `dpl_CcFGneLjZjBSLQ32Mccww6vjwAD6`.

**Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE**

---

## NAXA-F050 — Administration NAXA
Dashboard admin, produits, pilotage, rapports, validité, actions et gestion Promoteur dans le périmètre existant.

**Statut : 🟢 VALIDÉ — MAIN — périmètre historique documenté**

---

## NAXA-F060 — APIs existantes
Login, username availability, forgot password, forgot password verify, age verify, pay, réservation, reports, cron reports, cron validity.

**Statut : 🟢 VALIDÉ — MAIN — périmètre existant**

---

# 8. 🟢 VALIDÉ HORS MAIN — À INTÉGRER, PAS À RECONSTRUIRE

> Cette catégorie est volontairement stricte. Un bloc n'y entre que lorsqu'un commit/branche fournit une preuve suffisante de validation. Une simple présence de code n'est pas suffisante.

### NAXA-HM-001 — Travaux historiques de Responsable

Branche : `feat/promoteur-partie3-responsable-accreditation-20261006`.

Commit de test retracé : `7dbfd643c9b5b8d0df0907aab04737bcce7827ec`.

**État actuel : 🟡 INTÉGRATION/PROUVE À RÉCONCILIER**

> Le travail est réel et le test de scope est tracé, mais nous ne déclarons pas encore « 🟢 validé hors main » sans preuve consolidée suffisante de l'ensemble du bloc. **Ne pas reconstruire.**

### Règle pour toute future entrée hors-main

Pour passer en 🟢 HORS MAIN, il faudra au minimum :
**branche + SHA + périmètre + test/preuve + statut explicite**, puis l'intégration sera un chantier distinct.

---

# 9. 🟡 CONSTRUIT / À RÉCONCILIER — PILOTAGE 360°

Ces blocs ont déjà été travaillés historiquement. Ils ne doivent **pas** être recréés comme des fonctionnalités neuves.

## NAXA-F020 — Pilotage commercial
CA, ventes, indicateurs, scopes réseau/pharmacie, vues/rapports.

Branches : `feat/pilotage-equipes-bi-20261005`, `feat/pharmacie-validite-pilotage`, réconciliations du 07/10/2026.

**Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE**

**Preuve du chantier :** noyau Pilotage 360° réconcilié depuis l'implémentation historique déployée, sans reprise des 🟢 ; migrations 009/014/015/016/018 + UI réseau + API rapports intégrées dans `main`. Contrôle Supabase NAXA en lecture seule : objets `evenements`, `v_reservations_ca`, `rapports`, `promoteur_pharmacies`, `stocks_lots` présents ; historique Supabase confirme le déploiement du socle Pilotage 360° et des corrections de scope.

**Solution cible :** comparer les générations historiques à `main`, conserver la meilleure implémentation, intégrer sans écraser le socle vert, puis effectuer une vérification commune du pilotage.

---

## NAXA-F021 — Pilotage performance
BI, indicateurs de performance, rapports et scopes Promoteur/Responsable/Caisse.

**Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE**

**Preuve du chantier :** noyau Pilotage 360° réconcilié depuis l'implémentation historique déployée, sans reprise des 🟢 ; migrations 009/014/015/016/018 + UI réseau + API rapports intégrées dans `main`. Contrôle Supabase NAXA en lecture seule : objets `evenements`, `v_reservations_ca`, `rapports`, `promoteur_pharmacies`, `stocks_lots` présents ; historique Supabase confirme le déploiement du socle Pilotage 360° et des corrections de scope.

---

## NAXA-F022 — Pilotage sécurité / réseau
Visibilité réseau, sessions/audit, scopes, absence d'exposition de tokens/cookies.

**Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE**

**Preuve du chantier :** noyau Pilotage 360° réconcilié depuis l'implémentation historique déployée, sans reprise des 🟢 ; migrations 009/014/015/016/018 + UI réseau + API rapports intégrées dans `main`. Contrôle Supabase NAXA en lecture seule : objets `evenements`, `v_reservations_ca`, `rapports`, `promoteur_pharmacies`, `stocks_lots` présents ; historique Supabase confirme le déploiement du socle Pilotage 360° et des corrections de scope.

---

## NAXA-F023 — Direction 360°
Consolidation pilotage commercial + performance + sécurité/réseau + BI/rapports.

Branches de réconciliation : `reconciliation/final-integration-20261007`, `reconciliation/integration-20261007`, `reconciliation/integration-20261007-v2`.

**Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE**

**Preuve du chantier :** noyau Pilotage 360° réconcilié depuis l'implémentation historique déployée, sans reprise des 🟢 ; migrations 009/014/015/016/018 + UI réseau + API rapports intégrées dans `main`. Contrôle Supabase NAXA en lecture seule : objets `evenements`, `v_reservations_ca`, `rapports`, `promoteur_pharmacies`, `stocks_lots` présents ; historique Supabase confirme le déploiement du socle Pilotage 360° et des corrections de scope.

---

# 10. 🟡 CONSTRUIT / À RÉCONCILIER — ARCHITECTURE NAXA

## NAXA-F030 — Hiérarchie N0 → N4
- N0 Admin Réseau NAXA
- N1 Promoteur
- N2 Responsable
- N3 Caisse
- N4 Client

**Règle :** Responsable = fonction interne, pas nouveau `role_type`.

**Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE**

---

## NAXA-F031 — Architectures
- ORPHELIN ;
- PARENTS_ENFANTS ;
- PARENTS_AINES_CADETS ;
- HYBRIDE ;
- limites configurables par NAXA.

**Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE**

---

## NAXA-F032 — Moteur de privilèges / délégation
`naxa_can()`, domaine, niveau minimal, architecture autorisée, scope maximal, délégabilité et gouvernance non délégable.

Anciens éléments à réconcilier :
`parent_profile_id`, `promoteur_pharmacies`, `profile_accreditations`, `can_manage_profile()`, `accrediter_profile()`, `can_operate_pharmacy()`.

**Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE**

**Solution cible :** moteur canonique unique + conservation des compatibilités nécessaires sans doubler les modèles.

---

## NAXA-F033 — Convention Promoteur / tarif / abonnement / validité
Promoteur = 1 convention + 1 tarif + 1 abonnement ; montant payé ; date de paiement ; expiration ; blocage du réseau à expiration ; tarif négocié NAXA ; 30 000 FCFA non fixe ; remise multi-pharmacies possible.

**Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE**

---

## NAXA-F034 — Responsable N2 / accréditation
Responsable = fonction interne ; scope une pharmacie ; accréditation ; tests de scope.

Branche : `feat/promoteur-partie3-responsable-accreditation-20261006`.

Commit test : `7dbfd643c9b5b8d0df0907aab04737bcce7827ec`.

**Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE**

---

# 11. 🟡 CONSTRUIT / PREUVES À REGROUPER — STOCK / COÛTS / CA / BI

## NAXA-F040 — Coûts d'achat / stocks multi-pharmacie

- Travail historique identifié : `supabase/migration_013_stocks_couts.sql` sur `feat/pharmacie-validite-pilotage`.
- Réconciliation additive : `stocks` = quantité/prix public ; `stocks_couts` = coût d'achat interne, sans modèle concurrent.
- RLS alignée sur le scope multi-pharmacie canonique `can_access_pharmacy()`.
- La marge transactionnelle n'est pas calculée prématurément : le coût doit être figé au niveau de chaque ligne de vente avant calcul de marge.
- **Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE** (CI GitHub Actions indisponible : aucun runner attribué).

---

## NAXA-F041 — Rapports / exports / BI
Rapports, exports CSV et socles BI du pilotage réseau.

- Routes/UI existantes : `/admin/pilotage/rapports` et `/api/rapports`.
- Socles DB présents : `rapports`, `v_reservations_ca`, `v_ventes_journalieres`, `bi.activite_mensuelle`, `bi.stock_pharmacies`.
- RLS live contrôlée sur `rapports` : lecture Admin ou périmètre pharmacie autorisé.
- Correction appliquée dans `/api/rapports` : récupération du nom de pharmacie via la relation existante, sans nouveau modèle.
- Preuve Supabase live du 08/10/2026 : objets présents et consultables ; aucun changement Production exécuté par ce chantier.
- Export CSV déjà présent dans l'UI ; aucun moteur d'export concurrent créé.

**Statut : 🟢 VALIDÉ — MAIN**

---

# 12. CLASSIFICATION DES BLOCAGES — POUR VÉRIFICATION MASSIVE

Cette section devient le point d'entrée des prochains audits.

### LOT A — CI / preuve automatisée
Toutes les fonctionnalités dont **le seul manque** est la preuve CI doivent être regroupées ici.

**Action :**
1. identifier une voie gratuite et fiable de vérification hors dépendance au connecteur GitHub si nécessaire ;
2. définir une preuve reproductible ;
3. lancer une vérification massive ;
4. mettre à jour chaque fiche en une seule passe.

**Ne pas recoder.**

### LOT B — Supabase live
Fonctionnalités dont le code est traité mais dont la preuve live Supabase manque.

Blocage connu historiquement : connecteur Supabase ayant renvoyé `link_id must identify an eligible linked account`.

**Action :**
chercher une voie de preuve alternative ; ne pas déclarer 🟢 sans preuve ; ne pas refaire le développement.

### LOT C — Intégration `main`
Fonctionnalités prouvées sur des branches historiques mais non démontrées dans `main`.

**Action :**
comparaison → sélection → intégration → tests de non-régression → documentation.

### LOT D — Contradictions SQL / architecture
Contradictions de modèle, RLS, scope, RPC, migrations ou conventions.

**Action :**
isoler la contradiction → corriger → test ciblé → test de régression → 🟢.

### LOT E — Fonctionnalités réellement absentes
Uniquement après audit du cahier v3.7 + code + historique.

**Action :**
construction normale.

---



# 12 BIS. AUDIT MASSIF DES NON-VERTS — ÉTAT AU 08/10/2026

## Résultat de l'audit de cause

L'audit historique a été exécuté sur les branches et commits connus du chantier Pilotage/Promoteur.

### Constat 1 — Le problème CI est identifiable

La branche `main` contient actuellement `.github/workflows/naxa-quality.yml`.

Le workflow prévoit déjà une voie de validation locale et gratuite :
- `npm install`
- `npx tsc --noEmit`
- `npm run build`
- Supabase local via `supabase start`
- `supabase db reset`
- tests SQL structurels/comportementaux.

Le workflow contient également un déclenchement manuel `workflow_dispatch`.

**Mais : aucune exécution CI exploitable n'a été retrouvée pour les commits historiques contrôlés.**

Les statuts GitHub contrôlés sur plusieurs commits historiques sont des statuts **Vercel = success**, pas une preuve CI GitHub complète.

**Conclusion : LOT A confirmé comme problème de PREUVE CI, pas comme problème de développement.**

### Constat 2 — Plusieurs corrections CI ont déjà été tentées

Historique retrouvé :
- `4eebb068a47337812c3a6f01d8a38d7f0af833c0` — restauration du workflow qualité ;
- `7f7b44ec089d6610b476cb890311f2cb6e6bdcff` — réparation du workflow de vérification Pilotage ;
- `b2788ae1fb89ba9b00910460b76cba7926e5a6ba` — activation d'un workflow qualité de remplacement ;
- `b9f5ff620ffffec3bf5879e8516a93756e6604a9` — isolation du runner ;
- `86a6e0d7d48d4b91b6d6782d412d4206dbb38fca` et `eaad6300d6c0ffecfc6979333bd45f24d99f1ca2` — suppression de fragments dupliqués ;
- `82d2145cea6d6d162405c3e74d3f21400ba5b763` — retrait d'un probe runner.

**Conclusion : il est inutile de reconstruire les fonctionnalités pour résoudre ce problème. Le problème est maintenant celui de la voie de preuve.**

### Constat 3 — Responsable possède une preuve SQL historique partielle

Commit :
`7dbfd643c9b5b8d0df0907aab04737bcce7827ec`

Le test couvre notamment :
- rôle Responsable ;
- scope à une seule pharmacie ;
- exclusion d'une seconde pharmacie ;
- statistiques de recherche limitées au scope.

Le commit possède également un statut Vercel success.

**Mais cela ne suffit pas à déclarer le bloc complet 🟢 hors-main**, car l'exécution SQL effective du test n'est pas démontrée par cette seule trace.

**Classement : LOT C + LOT A.**

### Constat 4 — Pilotage 360° et architecture ne doivent pas être reconstruits

Les branches historiques suivantes sont toujours présentes :
- `feat/pilotage-equipes-bi-20261005`
- `feat/pharmacie-validite-pilotage`
- `feat/promoteur-partie3-responsable-accreditation-20261006`
- `reconciliation/final-integration-20261007`
- `reconciliation/integration-20261007`
- `reconciliation/integration-20261007-v2`

**Classement : LOT C — intégration/réconciliation**, avec sous-classement LOT A lorsque la seule preuve manquante est la CI.

### Matrice de traitement

| Bloc | Cause principale | Traitement | Reconstruction ? |
|---|---|---|---|
| F020 Pilotage commercial | intégration + preuve | LOT C puis LOT A | ❌ |
| F021 Pilotage performance | intégration + preuve | LOT C puis LOT A | ❌ |
| F022 Sécurité/réseau | intégration + preuve | LOT C puis LOT A | ❌ |
| F023 Direction 360° | intégration + preuve | LOT C puis LOT A | ❌ |
| F030 Hiérarchie | intégration/preuve | LOT C + LOT A | ❌ |
| F031 Architectures | intégration/preuve | LOT C + LOT A | ❌ |
| F032 Privilèges | intégration + contradictions possibles | LOT D puis LOT A/C | ❌ |
| F033 Convention | intégration/preuve | LOT C + LOT A | ❌ |
| F034 Responsable | test historique + intégration/preuve | LOT C + LOT A | ❌ |
| F040 Coûts/marges/scopes/CA | intégration + preuve | LOT C + LOT A | ❌ |
| F041 Rapports/BI/exports | intégration + preuve | LOT C + LOT A | ❌ |

### Décision de méthode

**Le prochain chantier n'est donc pas de recoder F020–F041.**

Le prochain chantier est :

**LOT A — établir une voie de preuve reproductible et gratuite, puis vérifier massivement les blocs concernés.**

La voie déjà présente dans `naxa-quality.yml` — build TypeScript + build Next.js + replay Supabase local + tests SQL — est la première candidate.

Si cette voie échoue, nous corrigerons **la voie de vérification**, pas les fonctionnalités elles-mêmes, sauf erreur réelle démontrée.


# 13. ERP PHARMACIE — À CONSTRUIRE APRÈS RÉCONCILIATION

## NAXA-ERP-001 — Catalogue pharmacie avancé
- Audit : `produits.dci` porte déjà la molécule/DCI ; `dosage` et `forme` existent déjà.
- Extension additive : `atc_code`, `conditionnement`, `reference_catalogue` sur `produits`.
- Équivalences : `produit_equivalences` référence les produits existants ; aucun second catalogue.
- RLS : lecture des équivalences actives ; écriture Admin.
- Migration : `supabase/migration_042_catalogue_avance.sql`.
- Test structurel : `supabase/tests/042_catalogue_avance.sql`.
- **Statut : 🟡 CONSTRUIT — PREUVE D'EXÉCUTION MANQUANTE**.

## NAXA-ERP-002 — Lots / péremptions / alertes
- Audit : aucune définition `stocks_lots` n'est présente dans le `main` courant ; les mentions historiques ne constituaient pas une preuve d'intégration.
- Solution : restauration additive d'une table canonique `stocks_lots`, rattachée à `pharmacies` et `produits`, sans remplacer `stocks`.
- Péremption : `date_peremption` + index dédié pour préparer les alertes.
- Blocage : `bloque` + `motif_blocage`, avec contrainte de cohérence.
- Scope : RLS alignée sur `can_access_pharmacy()`.
- Migration : `supabase/migration_043_stocks_lots.sql`.
- Test structurel : `supabase/tests/043_stocks_lots.sql`.
- **Statut : 🟡 CONSTRUIT — PREUVE D'EXÉCUTION MANQUANTE**.

## NAXA-ERP-003 — POS / caisse complet
Vente rapide, scan, encaissement, clôture, remises/promotions.

**Statut : ⚪ À FAIRE**

## NAXA-ERP-004 — Prescription → vente
Ordonnance, prescription, vente et règles métier/réglementaires.

**Statut : ⚪ À FAIRE / cadrage obligatoire**

## NAXA-ERP-005 — Fournisseurs / commandes / réception
**Statut : ⚪ À FAIRE**

## NAXA-ERP-006 — Inventaire / valorisation
**Statut : ⚪ À FAIRE**

## NAXA-ERP-007 — Assurance / crédit / bordereaux
**Statut : ⚪ À FAIRE**

## NAXA-ERP-008 — Trésorerie / dépenses
**Statut : ⚪ À FAIRE**

## NAXA-ERP-009 — Offline ERP avancé
Le offline stock existe déjà ; le offline vente/ERP complet reste à construire si confirmé par le périmètre v3.7.

**Statut : ⚪ À FAIRE**

---

# 14. MISE EN SERVICE TERRAIN

Le socle technique ne doit pas être confondu avec le déploiement opérationnel terrain.

À faire lorsque le chantier sera ouvert :
1. sélectionner 3–5 pharmacies pilotes réelles ;
2. créer les Promoteurs via NAXA ;
3. faire créer les Caisses par les Promoteurs ;
4. importer les stocks réels ;
5. contrôler prix, quantités, péremptions et formats ;
6. former les équipes ;
7. tester le parcours complet sur données réelles.

**Statut : ⚪ À FAIRE**

---

# 15. ÉTAT DE DÉPART APRÈS RÉÉCRITURE

### 🟢 Verrouillés — ne plus revenir dessus
**F001 à F014, F050, F060**, dans leur périmètre actuellement validé et intégré à `main`.

### 🟡 À résoudre par réconciliation / preuve
**F020 à F041**, sans reconstruire les travaux historiques.

### 🟢 Hors-main
Aucun bloc supplémentaire n'est artificiellement déclaré 🟢 hors-main à ce stade : les preuves historiques doivent être suffisamment explicites avant cette classification.

**C'est volontaire.** Une fonctionnalité réellement validée hors-main sera promue dans cette catégorie dès que son SHA + périmètre + preuve seront établis.

### ⚪ À construire
Programme ERP + mise en service terrain + extensions réellement absentes après audit.

---

# 16. PROCHAIN CHANTIER — MÉTHODE

### Traitement maître — étapes 1 à 4 exécutées

**1. Lecture / audit des sources disponibles**
- `main` contrôlé sur le SHA courant ;
- registre des fonctionnalités contrôlé ;
- historique récent des commits contrôlé ;
- branches historiques de Pilotage / Promoteur / Responsable / réconciliation comparées à `main` ;
- les travaux existants sont considérés comme matière à réconcilier, jamais comme fonctionnalités à reconstruire par défaut.

**2. Comparaison cible ↔ existant**
- les 🟢 intégrés restent verrouillés ;
- les travaux historiques identifiés sur les blocs F020–F041 sont confirmés comme existants hors de `main` ou partiellement intégrés ;
- les briques ERP réellement absentes restent dans le périmètre de construction, après audit de l'existant.

**3. Préservation de l'historique**
- aucune reconstruction des travaux historiques détectés ;
- les branches divergentes sont traitées comme sources de code/preuves à comparer ;
- une intégration future devra sélectionner la meilleure combinaison sans dégrader les 🟢.

**4. Traitement par chantier**
La prochaine action porte sur la **réconciliation/construction additive**, pas sur une reconstruction globale :
- intégrer les éléments historiques compatibles ;
- résoudre les contradictions réelles ;
- construire uniquement les éléments absents ;
- conserver les éléments compatibles des deux côtés ;
- différer la vérification massive finale jusqu'à stabilisation du périmètre construit/réconcilié.

### Blocage atteint

Le blocage actuellement démontré est **l'intégration/preuve des travaux historiques dans `main`**, et non l'absence de ces travaux.

Les comparaisons GitHub montrent notamment que plusieurs branches historiques sont fortement divergentes de `main`. Cela interdit une fusion aveugle : il faut sélectionner les deltas utiles et les réconcilier avec l'état actuel.

**Décision appliquée :**
- si une branche fournit ultérieurement une preuve complète de validation hors-main (SHA + périmètre + preuve), classement immédiat **🟢 VALIDÉ — HORS MAIN** et intégration sans reconstruction ;
- si seule l'intégration manque, classement **🟡 CONSTRUIT — INTÉGRATION MANQUANTE** ;
- si seule une preuve automatisée manque, classement **🟡 CONSTRUIT — PREUVE MANQUANTE** ;
- une fonctionnalité ne sera jamais artificiellement déclarée 🟢 sans preuve suffisante.

**La vérification massive LOT A reste volontairement différée**, conformément à la décision de chantier : elle sera exécutée après la stabilisation des constructions/réconciliations à venir, afin d'éviter de refaire plusieurs fois le même lot.

### Règle opérationnelle désormais active

**EXISTANT + PLANIFIÉ → FUSION ADDITIVE**

- sans conflit → conserver/intégrer les deux ;
- conflit réel → choisir la meilleure option ;
- partiel → compléter ;
- absent → construire ;
- validé ailleurs → intégrer, pas reconstruire ;
- 🟢 MAIN → verrouillé sauf régression prouvée.

**F030–F034 sont intégrés dans `main`, mais restent 🟡 jusqu'à obtention d'une preuve d'exécution. Aucun vert n'est déclaré sans preuve.**

---

# 17. HISTORIQUE DU REGISTRE

| Date | Action | Commit |
|---|---|---|
| 2026-10-08 | Création du registre | `9741736cc6ff00a309d34547faf3b0300a274252` |
| 2026-10-08 | Inventaire enrichi | `59e84c65bb5e3a8e1c75fb753b28a9162e912cfc` |
| 2026-10-08 | Réécriture : distinction MAIN / HORS-MAIN / PREUVE / INTÉGRATION / CORRECTION / À FAIRE + stratégie de vérification massive | `a1ee85cc7b99950361e6b243daf217ed5eac1a0b` |
| 2026-10-08 | Architecture N0–N4 / privilèges / convention / Responsable intégrés ; preuve CI indisponible | **présent commit** |

---

# 18. RÈGLE ABSOLUE

> **Un point vert est terminé.**
>
> **On ne le refait pas.**
>
> **On travaille uniquement sur les non-verts, en les regroupant selon leur cause et la solution disponible.**
>
> **Quand plusieurs non-verts ont le même blocage, on résout le blocage une seule fois puis on vérifie massivement tous les concernés.**
>
> **Aucune fonctionnalité ne passe au vert sans preuve.**


# 19. GOUVERNANCE MULTI-IA — REGISTRE UNIQUE

> **Une seule source documentaire, un seul processus d'intégration.**
>
> Plusieurs IA peuvent travailler en parallèle, mais elles ne doivent pas chacune créer une copie concurrente de `FONCTIONNALITES_VALIDEES.md`.

## Règle opérationnelle

- Les IA de chantier produisent code, audits, preuves et deltas.
- Le document maître est relu depuis `main` avant toute édition.
- Les deltas documentaires compatibles sont regroupés par le processus d'intégration.
- Une modification d'un document maître utilise le préfixe de commit `docs(registry-integrator):`.
- Si `main` a changé depuis la lecture initiale, l'ancienne copie ne peut pas être réinjectée : **STOP → relire → réappliquer le delta → vérifier**.
- Un 🟢 existant ne peut pas être rétrogradé sans régression prouvée.

## Protection automatisée

Le dépôt contient désormais :

- `.github/CODEOWNERS` pour identifier les documents maîtres ;
- `.github/workflows/naxa-registry-guard.yml` pour contrôler les commits qui modifient ces documents ;
- `docs/REGISTRE_GOUVERNANCE.md` comme procédure détaillée.

**Limite explicite :** cette protection automatise le contrôle et la détection ; elle ne remplace pas une règle GitHub de branche obligatoire tant que celle-ci n'est pas activée côté dépôt.


## 20. ERP-002 — Lots / péremptions / alertes — chantier du 08/10/2026
- Contradiction détectée : les documents historiques citaient `stocks_lots`, mais la branche `main` courante n'en contenait aucune définition.
- Correction additive : `stocks_lots` devient le socle canonique des lots, sans table concurrente et sans remplacement de `stocks`.
- Règles intégrées : pharmacie + produit + numéro de lot, date de péremption, quantité, blocage motivé, scope multi-pharmacie et index de péremption.
- Test ajouté : `supabase/tests/043_stocks_lots.sql`.
- Production non modifiée ; preuve Supabase live indisponible (`link_id` non éligible).
- **État : 🟡 construit dans `main` — preuve d'exécution à obtenir.**
