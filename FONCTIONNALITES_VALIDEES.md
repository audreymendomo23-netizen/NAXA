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

**Validation fonctionnelle récente déclarée par l’utilisateur : le parcours d’authentification est vert.**

**Statut registre : 🟡 CONSTRUIT — PREUVE MANQUANTE** (la preuve E2E reproductible reste à joindre; ne pas reconstruire l’authentification sans régression démontrée).

---

## NAXA-F002 — Création de compte
Route : `/creation-compte`.

Username unique, OTP, téléphone pays/indicatif/numéro, validation, sélecteur pays compact, UX mobile et absence de scroll.

Branches : `feat/creation-compte`, `docs/creation-compte-consolidation-20261004`, `fix/creation-compte-mobile-ux-20261005`, `fix/creation-phone-forgot-password-20261004`.

**Statut : 🟡 CONSTRUIT — PREUVE MANQUANTE**

---

## NAXA-F003 — Validation d'âge
Route : `/verification-age`.

Trois politiques, contrôles interface + serveur, hardening. Le contrôle d’accueil est également distinct de la vérification d’âge du compte.

Correction du parcours direct constatée le 16/10/2026 : la route protégée est désormais conservée dans `retourAge` et reprise après déclaration adulte. Voir l’audit opérationnel ci-dessous.

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
- Audit : aucune table `ventes`, `vente_lignes`, `caisses` ou `caisses_sessions` dans le `main` ; les réservations restent un flux distinct.
- Correction additive : socle POS relié à `produits`, `pharmacies` et `stocks` existants.
- Couverture initiale : caisse, session, vente, lignes, total/remise, mode de paiement, ouverture de caisse et RLS multi-pharmacie.
- Migration : `supabase/migration_044_pos_caisse.sql`.
- Test structurel : `supabase/tests/044_pos_caisse.sql`.
- **Statut : 🟡 CONSTRUIT — SOCLE EN PLACE / PREUVE D'EXÉCUTION MANQUANTE**.

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


## 21. ERP-003 — POS / caisse — chantier du 08/10/2026
- Audit : aucun moteur de vente concurrent trouvé dans `main`.
- Construction additive : `caisses`, `caisses_sessions`, `ventes`, `vente_lignes`.
- Fonctions sécurisées : ouverture de session et création de vente.
- RLS : périmètre pharmacie via `can_access_pharmacy()`.
- Aucun remplacement du flux réservation.
- Test structurel ajouté.
- Aucun changement Production.
- **État : 🟡 socle construit dans `main` — preuve SQL/CI manquante.**


## Huitième chantier — ERP-004 Prescription → vente
- Audit : aucun modèle/table/RPC de prescription persistant n'a été trouvé dans `main`; le scan/import ordonnance existant reste un parcours amont et ne devait pas être remplacé.
- Réconciliation : raccordement additif au moteur de caisse `ventes`/ERP-003 via `ventes.prescription_id`, sans seconde table de vente.
- Socle ajouté : `prescriptions`, `prescription_items`, statuts en attente/validée/rejetée/expirée, validateur, motif de rejet, échéance.
- Contrôle serveur : une vente portant une ordonnance est bloquée tant que l'ordonnance n'est pas validée, et l'ordonnance doit appartenir à la même pharmacie et au même client lorsqu'un client est renseigné.
- Sécurité : coffre ordonnance non lisible par le comptable ni par l'administration réseau ; lecture limitée au Promoteur et à la fonction interne `pharmacien_assistant`. Le rôle `role_type` n'est pas modifié.
- Validation : RPC `prescription_valider`, motif obligatoire au rejet ; permissions de fonction restreintes.
- Migration : `supabase/migration_045_prescription_vente.sql`.
- Test structurel : `supabase/tests/045_prescription_vente.sql`.
- Aucun changement Production exécuté.
- **État : 🟡 construit dans `main` — preuve SQL/CI d'exécution manquante.**


### Correction ERP-004 — verrouillage du statut
- Relecture post-construction : la première RLS autorisait une mise à jour directe du statut d'ordonnance.
- Correction : suppression de cette capacité ; le statut, le validateur et le motif passent désormais exclusivement par `prescription_valider()`.
- Commit de correction : `c43bd5e842af54912431975c4cb5b2a53e7f51d9`.
- **État inchangé : 🟡 construit — preuve d'exécution manquante.**


### ERP-005 — Fournisseurs / commandes / réception
- Audit : aucun socle fournisseur/achat/réception trouvé dans `main`.
- Construction additive : `fournisseurs`, `commandes_fournisseurs`, lignes de commande, `receptions_fournisseurs` et lignes de réception.
- Les fournisseurs sont mutualisables ; les commandes et réceptions restent strictement scoped par pharmacie.
- Réceptions conçues par lignes pour permettre les réceptions partielles ; aucune réception ne force artificiellement le statut `recue`.
- RLS multi-pharmacie ajoutée.
- Fichiers : `supabase/migration_046_fournisseurs_commandes.sql`, `supabase/tests/046_fournisseurs_commandes.sql`.
- **État : 🟡 construit dans main — preuve d'exécution SQL/CI manquante.**


## ERP-006 — Inventaire / valorisation
- Audit : aucun moteur d'inventaire/valorisation concurrent trouvé dans main ni dans l'historique ciblé.
- Construction additive : inventaires + lignes, comptage physique, écarts et valorisation interne.
- Raccordement à stocks, stocks_lots, stocks_couts, ventes et vente_lignes ; aucun second moteur de stock/vente.
- F67 : coût d'achat figé sur chaque ligne de vente avant calcul de marge.
- Fichiers : supabase/migration_047_inventaire_valorisation.sql, supabase/tests/047_inventaire_valorisation.sql.
- Production non modifiée.
- **État : 🟡 construit dans main — preuve SQL/CI d'exécution manquante.**


## ERP-007 — Ordonnancier / registre sécurisé
- Extension additive du modèle canonique `prescriptions` → `ventes` → ordonnancier.
- Ordonnancier interne lié à la pharmacie, l'ordonnance, la vente et au dispensateur.
- Registre interne séparé pour les substances signalées comme contrôlées, sans imposer de qualification juridique automatique du produit.
- RLS limitée au Promoteur et au pharmacien assistant du même périmètre pharmacie ; aucune lecture Client/Comptable/Admin réseau.
- Écriture uniquement via `ordonnancier_enregistrer()` ; aucune écriture directe accordée aux utilisateurs authentifiés.
- Contrôles serveur : ordonnance validée/non expirée, vente rattachée et payée, même pharmacie, utilisateur autorisé.
- Migrations : `048_ordonnancier.sql`, `049_registre_substances.sql`, `050_ordonnancier_securite.sql`, `051_ordonnancier_rpc.sql`.
- Test structurel : `supabase/tests/048_ordonnancier.sql`.
- Aucun changement Production.
- **État : 🟡 CONSTRUIT — preuve d'exécution CI/Supabase manquante.**


## ERP-008 — Socle assurances / tiers payant
- Audit : aucun modèle assurance/assureur/tiers payant existant détecté dans `main`.
- Fondation additive : `assureurs`, `couvertures_assurance`, `dossiers_assurance`.
- Liaison possible avec une vente sans remplacer le moteur de vente existant.
- RLS : client sur sa couverture/dossier ; personnel sur le périmètre pharmacie via `can_access_pharmacy`.
- Aucun opérateur externe, aucun remboursement automatisé et aucun contrat commercial d'assureur n'est imposé.
- **État : 🟡 CONSTRUIT — preuve d'exécution CI/Supabase manquante.**


## ERP-009 — Trésorerie / dépenses (F66)
- Audit : aucune fondation concurrente de trésorerie, dépenses ou journal financier n'a été trouvée dans `main`.
- Construction additive : `tresorerie_comptes`, `categories_depenses`, `depenses`, `tresorerie_mouvements`.
- Contrôle de périmètre : opérations rattachées à une pharmacie et contrôlées par `can_access_pharmacy()` / `can_operate_pharmacy()`.
- Sécurité : RLS active ; aucun INSERT direct utilisateur sur les dépenses ou mouvements ; création/validation via RPC contrôlées.
- Validation d'une dépense : création en brouillon puis validation atomique qui génère le mouvement de décaissement unique.
- Le CA canonique et le moteur de vente restent inchangés ; le raccordement des encaissements de ventes sera traité dans le chantier POS final.
- Migration : `supabase/migration_053_tresorerie_depenses.sql`.
- Correction post-audit : ajout d'une clé unique composite `(id, pharmacie_id)` nécessaire aux clés étrangères de scope.
- Test structurel : `supabase/tests/050_tresorerie_depenses.sql`.
- Aucun changement Production/Supabase live exécuté.
- **État : 🟡 CONSTRUIT — preuve d'exécution CI/Supabase manquante.**


## ERP-010 — Fiche client / crédit (F68)
- Audit : aucune table de fiche client commerciale ni moteur de crédit client concurrent n'a été trouvé dans `main`. L'identité reste portée par `profiles`/auth et n'est pas dupliquée.
- Construction additive : `client_fiches`, `client_credits`, `client_credit_operations`, demandes de dépassement de plafond.
- Le mode de paiement caisse `credit` est raccordé au moteur de vente existant sans créer de second moteur de vente.
- Le crédit reste strictement commercial : aucune donnée d'ordonnance ou de santé n'est stockée dans ces tables.
- Sécurité : RLS, aucune écriture directe ; configuration du plafond et décision d'un dépassement réservées au Promoteur/NAXA ; le caissier peut enregistrer une vente à crédit dans le plafond ou demander une dérogation.
- Dépassement : demande `en_attente`, décision Promoteur/NAXA, puis consommation unique lors de la vente.
- Remboursement du crédit journalisé et plafonné au solde.
- Migration : `supabase/migration_054_client_credit.sql`.
- Test structurel : `supabase/tests/051_client_credit.sql`.
- Aucun changement Production/Supabase live exécuté.
- **État : 🟡 CONSTRUIT — preuve d'exécution CI/Supabase manquante.**

## ERP-011 — Rappel de lot (F64)
- Audit : aucune implémentation concurrente de rappel de lot n'a été trouvée dans `main` ; `stocks_lots` reste le socle canonique des lots.
- Construction additive : `rappels_lots` trace le rappel, son motif, sa référence, son statut et son responsable.
- Sécurité : RLS par pharmacie ; lecture authentifiée uniquement ; création/levée exclusivement via RPC contrôlées.
- `lot_rappeler()` enregistre le rappel actif et bloque le lot existant ; `lot_lever_rappel()` lève le rappel et débloque le lot.
- Aucun second moteur de stock n'est créé.
- Migration : `supabase/migration_055_rappel_lot.sql`.
- Test structurel : `supabase/tests/052_rappel_lot.sql`.
- Limite volontaire : le POS actuel ne porte pas encore de `lot_id` dans `vente_lignes`; l'interdiction de vendre un lot rappelé sera raccordée au chantier de vente/FEFO lotisé, sans inventer un second mécanisme de vente.
- Aucun changement Production/Supabase live exécuté.
- **État : 🟡 CONSTRUIT — preuve d'exécution CI/Supabase manquante.**


## ERP-012 — Offline ERP avancé — chantier du 08/10/2026
- Audit corrigé : le mécanisme offline stock n'était pas absent. Il existe déjà dans `main`, issu du chantier historique `feat/pharmacie-pilotes-offline-20261005` (commit fonctionnel `8b682b403b075c82c82b5f50291ebbd736e7e46b`, puis correction garde `04e1903cc28f78ddf3f948ce53bb42a35ee8e14b`).
- Réconciliation : aucun remplacement du mécanisme IndexedDB existant ; il reste le socle offline canonique du stock.
- Contradiction résolue : le point manquant était l'idempotence serveur et la garantie qu'un replay ne crée pas de double mutation.
- Construction additive : `supabase/migration_056_offline_idempotence.sql` ajoute `offline_operations`, une clé d'opération unique et la RPC `offline_stock_set_quantity()`.
- La synchronisation du stock passe désormais par cette RPC ; les replays déjà appliqués sont reconnus, les changements serveur sont signalés comme conflits et les mutations restent soumises au scope/RLS Supabase.
- Sécurité : RLS sur `offline_operations`, opération liée à `auth.uid()`, RPC `SECURITY INVOKER`, exécution retirée à `anon/public` et accordée à `authenticated` uniquement.
- Client : `src/app/pharmacie/page.tsx` utilise un `operation_id` UUID pour chaque mutation et rejoue la même opération sans double écriture.
- Test structurel : `supabase/tests/053_offline_idempotence.sql`.
- Aucun changement Supabase live/Production exécuté.
- **État : 🟡 CONSTRUIT — preuve d'exécution SQL/CI manquante.**


## ERP-003 — POS étape 1 — lignes de vente + FEFO — 08/10/2026
- Audit : le socle POS ERP-003 existait déjà (migration_044_pos_caisse.sql) ; aucune seconde caisse/vente n'a été créée.
- Correction de fondation : migration_057_pos_lignes_fefo.sql ajoute vente_lignes.lot_id et la RPC atomique vente_ajouter_produit.
- Si le produit est lotisé, allocation FEFO par date de péremption, exclusion des lots expirés ou bloqués (dont rappels actifs), puis décrément du stock agrégé canonique.
- Si aucun lot n'existe pour le produit, le stock agrégé existant reste utilisé afin de préserver la compatibilité avec l'historique non lotisé.
- Les totaux POS sont recalculés après chaque ajout ; une erreur transactionnelle annule l'opération entière.
- Test structurel : supabase/tests/054_pos_lignes_fefo.sql.
- Commit migration : a8b466e6ca83afe111a133d5629f1140f1680888.
- Commit test : 389b24c96bc41d50e3a7273d1af13e160951a469.
- Preuve CI : aucune exécution associée détectée à ce stade.
- Aucun changement Production/Supabase live.
- **État : 🟡 CONSTRUIT — preuve d'exécution SQL/CI manquante.**


## ERP-003 — POS étape 2 — paiements + finalisation — 08/10/2026
- Audit : aucune fonction de finalisation/paiement POS concurrente trouvée ; extension du moteur `ventes` existant.
- Ajout : `vente_paiements` pour paiements simples ou mixtes.
- `vente_ajouter_paiement()` refuse les montants invalides, les dépassements du total et exige une référence pour Mobile Money.
- `vente_finaliser()` exige une vente non vide et un paiement exactement égal au total net avant passage à `payee`.
- Sécurité : RLS de lecture par pharmacie + RPC d'écriture réservées à `authenticated`.
- Tests : `supabase/tests/055_pos_paiements.sql`.
- Aucun changement Production/Supabase live.
- **État : 🟡 CONSTRUIT — preuve SQL/CI manquante.**


## ERP-003 — POS étape 3 — ticket/reçu + numérotation unique — 08/10/2026
- Audit historique : aucun moteur concurrent de ticket POS, numéro de vente ou réimpression n'a été trouvé ; le reçu de réservation existant reste distinct et n'est pas remplacé.
- Réconciliation : extension additive de `ventes`, sans second moteur de vente.
- Ajout : `ventes.numero_vente` avec index unique et séquence PostgreSQL pour les nouvelles ventes ; les ventes historiques sont numérotées avant contrainte `NOT NULL`.
- Ajout : RPC de lecture `vente_ticket(uuid)`, `SECURITY INVOKER`, réutilisant les RLS existantes de `ventes`/`vente_lignes` et réservée à `authenticated`.
- Le ticket expose numéro, statut, dates, totaux, mode/référence de paiement et lignes produit ; il est donc réimprimable sans mutation de la vente.
- Migration : `supabase/migration_059_pos_ticket.sql`.
- Test structurel : `supabase/tests/056_pos_ticket.sql`.
- Aucun changement Production/Supabase live.
- **État : 🟡 CONSTRUIT — preuve SQL/CI manquante.**


## ERP-003 — POS étapes 4/5/6 — annulation contrôlée, approbation sensible et clôture Z — 08/10/2026
- Audit : aucune implémentation concurrente d'annulation POS ou de clôture Z n'a été trouvée ; extension additive du moteur `ventes`/`caisses_sessions` existant.
- Étape 4 : `vente_annulation_demander()` crée une demande tracée ; `vente_annuler()` restitue atomiquement les quantités dans `stocks` et, lorsqu'un `lot_id` existe, dans `stocks_lots` avant de passer la vente à `annulee`.
- Étape 5 : la décision est séparée de la demande ; Promoteur/NAXA décide via `vente_annulation_decider()`, et le demandeur ne peut pas approuver sa propre demande.
- Étape 6 : `caisse_cloturer()` calcule le théorique de caisse sur le fond initial + encaissements espèces, accepte les paiements mixtes, refuse les ventes brouillon ouvertes et enregistre comptage/écart.
- Correction d'architecture : remplacement de l'unicité historique `caisse_id` par une unicité partielle sur les sessions `ouvertes`, permettant plusieurs clôtures historiques pour une même caisse.
- RLS/grants : table de demandes en lecture scoped ; RPC réservées à `authenticated`.
- Migration : `supabase/migration_060_pos_annulation_z.sql`.
- Test structurel : `supabase/tests/057_pos_annulation_z.sql`.
- Aucun changement Supabase live/Production.
- **État : 🟡 CONSTRUIT — preuve SQL/CI manquante.**


## ERP-003 — POS étapes 7/8/9 — paiements avancés, caisse rapide, remises/promotions — 08/10/2026
- Étape 7 : extension additive des paiements mixtes existants avec voucher et tiers payant assurance ; le crédit existant est réconcilié avec `vente_paiements` afin que la finalisation reste unique. Les références `VOUCHER:` et `ASSURANCE:` distinguent temporairement ces usages via le mode existant `autre`, sans migration enum non validée.
- Étape 7 : création/consommation de vouchers contrôlée, validation expiration/solde, rattachement assurance au dossier existant et plafond crédit conservé.
- Étape 8 : favoris par utilisateur/pharmacie, paniers de ventes POS en attente/reprise et affichage client rattaché à la session caisse ; aucun second moteur de vente.
- Étape 9 : promotions par pharmacie, remises bornées par pourcentage/plafond, demande d'approbation et interdiction d'auto-approbation ; seule une décision autorisée modifie la remise de la vente.
- Migrations : `supabase/migration_061_pos_avance_rapide_remises.sql` + `supabase/migration_062_pos_creation_vouchers_promotions.sql`.
- Test structurel : `supabase/tests/058_pos_avance_rapide_remises.sql`.
- Aucun changement Supabase live/Production.
- **État : 🟡 CONSTRUIT — preuve SQL/CI manquante.**

## ERP-010/011/012 — Vérification finale du bloc ERP avancé — 08/10/2026
- ERP-010 ré-audité : le crédit client reste sur le moteur POS unique via la version finale de `client_credit_enregistrer_vente()` dans la chaîne de migrations ; le test structurel vérifie désormais ce raccordement.
- ERP-011 ré-audité : les RPC de rappel sont durcies avec `search_path=''` ; le rappel reste une extension du lot canonique et non un second stock.
- ERP-012 ré-audité : l'état serveur `offline_operations` n'est plus modifiable directement par l'utilisateur authentifié ; la RPC serveur porte l'état, avec contrôle explicite du périmètre pharmacie. Le test vérifie l'absence de privilège UPDATE direct.
- Correction transversale POS étape 7 : le voucher n'est plus débité lors de l'ajout au brouillon ; sa consommation est différée à `vente_finaliser()`, dans la même transaction que la clôture de vente.
- Correction transversale étape 7 : la syntaxe du paiement assurance a été corrigée dans `migration_061_pos_avance_rapide_remises.sql`.
- Tests renforcés : `051_client_credit.sql`, `052_rappel_lot.sql`, `053_offline_idempotence.sql`, `058_pos_avance_rapide_remises.sql`.
- Vérification GitHub : commits et fichiers présents dans `main`. Vérification Supabase live impossible à ce stade : la liaison MCP renvoie `link_id must identify an eligible linked account`.
- Vérification CI : aucun run associé au dernier commit ; la preuve d'exécution CI reste indisponible.
- **État final ERP-010/011/012 : 🟡 CONSTRUIT — preuve d'exécution SQL/CI manquante.**


## Classement par problème bloquant le vert — ajouts Pharmacien / Caisse — 08/10/2026

Les fonctionnalités sont maintenant classées selon le problème qui empêche leur passage au vert, afin de traiter d'abord les causes communes.

### PROBLÈME A — Preuve d'exécution CI/SQL absente

Concerne : **NAXA-CAISSE-001, NAXA-CAISSE-002, NAXA-PHARMACIEN-001**.

Les migrations, UI et tests sont présents, mais l'exécution CI exploitable n'est pas encore prouvée. Le traitement prioritaire est donc le gate Qualité : exécution réelle, replay Supabase, succès des assertions et conservation des logs.

**Statut commun : 🟡 CONSTRUIT — preuve CI/SQL manquante.**

### PROBLÈME B — Couverture de test dédiée à consolider

Concerne : **NAXA-PRODUIT-001 — Emplacement physique par pharmacie**.

La présence de `stocks.emplacement` et son usage Caisse sont établis, mais la couverture de test dédiée doit être isolée/confirmée puis exécutée dans le gate Qualité.

**Statut : 🟡 CONSTRUIT — preuve dédiée à consolider.**

### PROBLÈME C — Intégration `main` non démontrée

Ce n'est pas le blocage technique actuel : c'est une condition de validation finale. Les quatre éléments restent sur `rewrite/naxa-from-main-20261007`. Aucun SHA `main` ne doit être inventé et aucune intégration ne doit être faite avant le vert technique et l'autorisation prévue.

**Statut : ⚪ À FAIRE après le vert technique.**

### ORDRE DE RÉSOLUTION

**A → B → C** : mettre d'abord le workflow Qualité au vert, consolider ensuite le test Emplacement, puis seulement traiter l'intégration `main`.

## NAXA-CAISSE-001 — Parcours Caisse scan / recherche / encaissement — 08/10/2026

- **ID :** NAXA-CAISSE-001
- **Domaine :** ERP pharmacie / POS / Caisse
- **Description :** Parcours Caisse de recherche produit, scan, constitution du panier, calcul du total, encaissement, calcul de monnaie, paiement opérateur, finalisation et ticket.
- **Routes/pages :** `/pharmacie/caisse`
- **Fichiers UI :** `src/app/pharmacie/caisse/page.tsx`
- **DB / objets :** moteur canonique `ventes`, `vente_lignes`, `vente_paiements`, RPC `vente_ajouter_produit()`, `vente_ajouter_paiement()`, `vente_finaliser()`, `vente_ticket()`
- **Migrations :** `supabase/migration_063_caisse_pharmacien_barcode.sql`, compléments `supabase/migration_064_caisse_modes_operateurs.sql`
- **Tests :** `supabase/tests/059_caisse_pharmacien_barcode.sql`, `supabase/tests/060_caisse_modes_operateurs.sql`
- **Résultats des tests :** présents dans le dépôt ; exécution CI réelle non encore démontrée.
- **Branche de création :** historique exact à consolider ; les fichiers sont actuellement présents sur `rewrite/naxa-from-main-20261007`.
- **Commit(s) de création :** `023b3535449838d13d5c18e50553f580878160fe` pour le complément opérateurs ; socle barcode documenté avant ce complément.
- **Branche/commit de validation :** `rewrite/naxa-from-main-20261007` / validation CI à obtenir.
- **SHA d’intégration dans `main` :** non démontré pour ces derniers compléments ; ne pas déclarer intégré.
- **Déploiement :** aucun déploiement Production exécuté pour ce complément.
- **Niveaux de validation :** 🟡 statique ; 🟡 technique ; fonctionnelle/Production non déclarées.
- **Preuves :** fichiers UI, migrations et tests présents ; absence de run CI associé au dernier chantier.
- **Statut :** 🟡 **CONSTRUIT — PREUVE SQL/CI MANQUANTE**
- **Cause du non-vert :** preuve d’exécution automatisée SQL/CI non obtenue.
- **Solution détectée :** mettre au vert le workflow qualité et exécuter le replay Supabase local prévu par le CI.
- **Correction :** ajout/raccordement au moteur POS existant, sans second moteur de vente.
- **Prochaine action :** exécuter et prouver le gate qualité ; corriger toute erreur avant validation.
- **Dernière vérification :** 08/10/2026.
- **Contradictions connues :** aucune nouvelle seconde caisse/vente ; les moyens de paiement opérateurs doivent rester distingués par leur type.







## NAXA-CAISSE-002 — Paiements opérateurs Orange Money / MTN MoMo — 08/10/2026

- **ID :** NAXA-CAISSE-002
- **Domaine :** ERP pharmacie / POS / Paiements
- **Description :** Distinction native des paiements Orange Money et MTN MoMo dans le moteur de paiement Caisse, avec référence opérateur obligatoire selon le flux existant.
- **Routes/pages :** `/pharmacie/caisse`
- **Fichiers UI :** `src/app/pharmacie/caisse/page.tsx`
- **DB / objets :** enum `public.mode_paiement_caisse`, `vente_paiements`, RPC de paiement/finalisation existantes.
- **Migrations :** `supabase/migration_064_caisse_modes_operateurs.sql`
- **Tests :** `supabase/tests/060_caisse_modes_operateurs.sql`
- **Résultats des tests :** test structurel présent ; exécution CI réelle non encore démontrée.
- **Branche de création :** historique exact à consolider ; présence actuelle sur `rewrite/naxa-from-main-20261007`.
- **Commit de création :** `023b3535449838d13d5c18e50553f580878160fe` — `feat(caisse): distinguer Orange Money et MTN MoMo`.
- **Branche/commit de validation :** `rewrite/naxa-from-main-20261007` / preuve CI à obtenir.
- **SHA d’intégration dans `main` :** non démontré pour ce dernier complément.
- **Déploiement :** aucun changement Production exécuté.
- **Niveaux de validation :** 🟡 statique ; 🟡 technique non exécuté ; fonctionnelle/Production non déclarées.
- **Preuves :** migration et test présents ; valeurs `orange_money` et `mtn_momo` présentes dans l’enum.
- **Statut :** 🟡 **CONSTRUIT — PREUVE SQL/CI MANQUANTE**
- **Cause du non-vert :** le test existe mais son exécution CI réelle n’est pas encore prouvée.
- **Solution détectée :** gate qualité local/CI gratuit avec replay complet des migrations.
- **Correction :** séparation explicite des deux opérateurs dans le type de paiement existant ; aucune simulation de transfert et aucun nouveau moteur de paiement.
- **Prochaine action :** exécuter le test `060_caisse_modes_operateurs.sql` via le gate qualité et contrôler le parcours Caisse.
- **Dernière vérification :** 08/10/2026.
- **Contradictions connues :** aucune transaction Mobile Money réelle n’est simulée ; l’intégration opérateur réelle reste distincte de l’enregistrement comptable de la référence.

## NAXA-PHARMACIEN-001 — Fonction Pharmacien / consultation / prescription — 08/10/2026

- **ID :** NAXA-PHARMACIEN-001
- **Domaine :** ERP pharmacie / Pharmacien / Ordonnance
- **Description :** Fonction interne Pharmacien permettant la consultation pharmaceutique et la création/validation d’une prescription dans le parcours ordonnance existant.
- **Routes/pages :** `/pharmacie/pharmacien`
- **Fichiers UI :** `src/app/pharmacie/pharmacien/page.tsx`
- **DB / objets :** `consultations_pharmaceutiques`, `prescriptions`, `prescription_items`, RPC `prescription_valider()` et raccordement à `ventes.prescription_id`.
- **Migrations :** `supabase/migration_065_pharmacien_consultation_prescription.sql`
- **Tests :** `supabase/tests/061_pharmacien_consultation_prescription.sql`
- **Résultats des tests :** test structurel présent ; exécution CI réelle non encore démontrée.
- **Branche de création :** historique exact à consolider ; fichier actuellement présent sur `rewrite/naxa-from-main-20261007`.
- **Commit de création :** `b1a5ed3edba21a3ce072368999ace76d1d507b9b` — `feat(pharmacien): ajouter consultation et prescription`.
- **Branche/commit de validation :** `rewrite/naxa-from-main-20261007` / preuve CI à obtenir.
- **SHA d’intégration dans `main` :** non démontré pour ce dernier complément.
- **Déploiement :** aucun changement Production exécuté.
- **Niveaux de validation :** 🟡 statique ; 🟡 technique non exécuté ; fonctionnelle/Production non déclarées.
- **Preuves :** UI, migration et test présents ; fonction Pharmacien traitée comme fonction interne et non comme nouveau `role_type`.
- **Statut :** 🟡 **CONSTRUIT — PREUVE SQL/CI MANQUANTE**
- **Cause du non-vert :** preuve d’exécution SQL/CI manquante.
- **Solution détectée :** exécuter le test structurel via le gate qualité puis compléter la preuve fonctionnelle.
- **Correction :** extension additive du modèle `prescriptions` existant ; aucun nouveau niveau hiérarchique N5.
- **Prochaine action :** valider consultation/prescription, contrôler les scopes et la règle de blocage de vente avant ordonnance validée.
- **Dernière vérification :** 08/10/2026.
- **Contradictions connues :** `pharmacien` reste une fonction interne ; `pharmacien_assistant` est conservé pour compatibilité historique ; aucun `role_type` supplémentaire.

## NAXA-PRODUIT-001 — Emplacement physique par pharmacie — 08/10/2026

- **ID :** NAXA-PRODUIT-001
- **Domaine :** ERP pharmacie / Stock / Caisse
- **Description :** Emplacement physique du produit porté par le stock de chaque pharmacie et réutilisé par la recherche Caisse.
- **Routes/pages :** `/pharmacie`, `/pharmacie/caisse`
- **Fichiers UI :** `src/app/pharmacie/page.tsx`, `src/app/pharmacie/caisse/page.tsx`
- **DB / objets :** colonne `stocks.emplacement`
- **Migrations :** raccordement au socle stock existant ; migration spécifique à reconstituer uniquement si absente après audit.
- **Tests :** couvertures de stock/Caisse existantes ; preuve spécifique à consolider.
- **Résultats des tests :** présence UI/DB contrôlée ; exécution CI spécifique non démontrée.
- **Branche de création :** historique exact à consolider ; présence actuelle sur `rewrite/naxa-from-main-20261007`.
- **Commit de création :** non isolé avec certitude lors de cet audit ; ne pas inventer de SHA.
- **Branche/commit de validation :** `rewrite/naxa-from-main-20261007` / preuve à obtenir.
- **SHA d’intégration dans `main` :** non démontré pour le dernier complément.
- **Déploiement :** aucun changement Production exécuté.
- **Niveaux de validation :** 🟡 statique ; 🟡 technique ; fonctionnelle/Production non déclarées.
- **Preuves :** champ affiché dans le stock et réutilisé dans la recherche Caisse.
- **Statut :** 🟡 **CONSTRUIT — PREUVE MANQUANTE**
- **Cause du non-vert :** couverture de test dédiée et preuve CI non consolidées.
- **Solution détectée :** rattacher la vérification au gate stock/Caisse sans créer un second modèle.
- **Correction :** conserver `stocks.emplacement` comme source canonique par pharmacie.
- **Prochaine action :** ajouter/identifier le test ciblé puis le faire passer dans le gate qualité.
- **Dernière vérification :** 08/10/2026.
- **Contradictions connues :** aucune table concurrente d’emplacement ne doit être créée.

### Règle de classement de ces quatre fiches

Ces fiches suivent désormais exactement la fiche obligatoire du registre : **ID → domaine → description → routes → fichiers → DB → migrations → tests/résultats → branche → commit → validation → main → déploiement → niveaux → preuves → statut → cause → solution → correction → prochaine action → dernière vérification → contradictions**.

**Important :** aucune de ces fiches n’est passée artificiellement au vert. La preuve CI/SQL reste le chantier Qualité actif.

# 9. NIVEAU 1 — DOCUMENTATION / TRAÇABILITÉ — 08/10/2026

## Audit par raisonnement par contradiction
**Problème commun traité :** documentation de référence incomplète ou devenue ambiguë par accumulation d'historique.

**Cas traités l'un après l'autre :**
1. **Documents prescrits absents** → création de `docs/CONTINUITE_NAXA.md`, `docs/FUSION.md`, `CONTRADICTIONS.md`, `docs/CAHIER_DES_CHARGES.md`.
2. **Références de positionnement obsolètes** → ajout d'une couche de référence courante datée dans `docs/TRACABILITE.md` et `README.md`.
3. **Confusion historique / état courant** → `STATUT.md` et ce registre précisent désormais que l'historique est conservé mais que la section datée la plus récente prévaut pour la position courante.
4. **SHA / intégration non démontrés** → aucun SHA n'est inventé ; branche de travail, HEAD contrôlé, `main` contrôlé et PR #30 sont consignés explicitement.
5. **Statut fonctionnel artificiellement vert** → les fonctionnalités sans preuve CI/SQL restent 🟡 ; le vert du niveau 1 ne modifie pas leur statut technique.

## Références vérifiées
- Branche : `rewrite/naxa-from-main-20261007`.
- HEAD contrôlé avant la présente série documentaire : `b2fc8b793cbac1d11a089c88d736386faf0af658`.
- `main` contrôlé : `2e96930c5d8fb0de4ad22cf4f3dd8dd95b4fd471`.
- PR #30 : fermée, non fusionnée (validation CI remplacée par le gate CircleCI).
- Production : aucune modification par ce chantier documentaire.

**Statut du niveau 1 : 🟢 VALIDÉ — DOCUMENTATION / TRAÇABILITÉ.**

**Règle :** ce 🟢 ne valide ni SQL, ni CI, ni sécurité, ni fonctionnalité métier. Il verrouille uniquement la qualité documentaire et la traçabilité du chantier.


# 10. NIVEAU 2 — GIT / STRUCTURE / HISTORIQUE — 08/10/2026

## Problème 1 — Branches et PR concurrentes
- Inventaire des branches effectué.
- Branche courante : `rewrite/naxa-from-main-20261007`.
- Source de vérité : `main`.
- Base historique CI : `consolidation`.
- PR #30 conservée comme PR technique active du gate Qualité.
- PR #7, #22, #23, #24, #25, #33 et #34 fermées car historiques/supersédées.
- Les commits et branches historiques restent conservés.
- **Statut : 🟢.**

## Problème 2 — Collision de numérotation des fichiers SQL de migration/test
- Avant correction : deux migrations `064`, deux tests `060`.
- Correction : Pharmacien → migration `065`, test `061`.
- Contenu SQL inchangé ; références documentaires mises à jour.
- Contrôle de l'arbre courant : chaque numéro concerné est désormais unique.
- **Statut : 🟢.**

## Problème 3 — Traçabilité de l'intégration
- Aucun merge `main` effectué.
- Aucun SHA `main` inventé.
- Aucun déploiement Production effectué.
- Les PR fermées conservent leur historique Git.
- **Statut : 🟢.**

**STATUT GLOBAL NIVEAU 2 : 🟢 VALIDÉ — GIT / STRUCTURE / HISTORIQUE.**


# 11. NIVEAU 3 — QUALITÉ TECHNIQUE ÉLÉMENTAIRE — 08/10/2026

## Périmètre
Lint / TypeScript / compilation-build / dépendances et configuration.

## Corrections
- Ajout de `.eslintrc.json` avec `next/core-web-vitals`.
- Ajout des dépendances ESLint compatibles Next 14.2.15.
- Versions des dépendances de `package.json` figées.
- Workflow qualité étendu à `npm run lint` et au déclenchement sur la branche de chantier.

## Preuves disponibles
- Fichiers corrigés présents sur `rewrite/naxa-from-main-20261007`.
- Aucune exécution GitHub Actions associée aux commits du chantier n'est actuellement retournée par le connecteur ; aucune preuve TypeScript/lint/build ne peut donc être considérée comme passée.
- `package-lock.json` absent du dépôt ; une génération locale a été bloquée par l'absence d'accès réseau/cache npm.

**Statut Niveau 3 : 🔴 À CORRIGER / À PROUVER — ne pas confondre correction statique et validation exécutée.**


## Mise à jour Niveau 3 — 08/10/2026
Preuve CI réelle obtenue sur `rewrite/naxa-from-main-20261007` : commit `f1fcd801f37989bdd17e667a0e88c17dd3e5f4e6`, contexte CircleCI `ci/circleci: quality` = **success**, pipeline #167. Installation npm, TypeScript, ESLint et build Next.js sont tous passés. Le niveau 3 est donc **🟢 VERT**. `main` et Production n'ont pas été modifiés.


## Niveau 4 — TESTS — chantier ouvert
- Suite de tests SQL existante recensée jusqu'à supabase/tests/061_pharmacien_consultation_prescription.sql.
- Infrastructure CircleCI sql_tests ajoutée au commit dfc58961fc2f55d501ac7c52ef95b44327258e6a.
- Objectif du job : environnement Supabase local → replay complet → exécution de tous les tests SQL.
- Preuve d'exécution : absente à ce stade.
- Supabase distant : accès bloqué par « link_id must identify an eligible linked account ».
- Docker local : indisponible dans l'environnement courant.
- Contradiction supplémentaire : plusieurs tests exposent pass par SELECT sans mécanisme universel d'échec du processus.
- Statut : 🔴 À CORRIGER.


## AUDIT BULK N4–N15 — 08/10/2026

Les niveaux 4 à 15 sont désormais traités simultanément par cause commune, et non comme quinze chantiers indépendants.

**Cause commune retenue :** absence d'un environnement de validation reproductible aligné exactement sur le HEAD de la branche, permettant de rejouer le schéma + toutes les migrations + tous les tests et de produire une preuve exploitable.

**Correction déjà engagée :** CircleCI `sql_tests` avec Supabase local et replay complet ; assertions SQL rendues bloquantes ; aucun changement de `main` ni de Production.

**Important :** l'accès Supabase distant fonctionne désormais. Le problème actuel est la divergence entre son état live et les migrations de la branche, et non un problème de connexion.

### Matrice bulk
- N4 Tests → preuve SQL reproductible
- N5 CI → exécution du gate et logs
- N6 DB → replay schéma/migrations/RLS/RPC
- N7 Métier → assertions métier sur le même replay
- N8 Intégrations → contrats/flux sur le même artefact
- N9 Sécurité/architecture → contrôles positifs et négatifs
- N10 Auth/sessions → tests identité/session
- N11 UI/UX → artefact + recette
- N12 Services externes → configuration/contrats sans souscription payante
- N13 Déploiement → validation avant autorisation Production
- N14 Robustesse → régression/performance
- N15 Conformité → croisement cahier v3.7 et preuves cumulées

**Statut bulk N4–N15 : 🔴 un seul problème commun résiduel — preuve d'exécution reproductible au HEAD manquante.**


## NAXA-CI-001 — Replay SQL Supabase reproductible — 08/10/2026
- Cause racine corrigée : le harnais CircleCI fabriquait des noms de migrations incompatibles avec Supabase (timestamp-migration.sql au lieu de timestamp_migration.sql) et le schéma de base contenait des délimiteurs PL/pgSQL invalides (as $declare / end$;).
- Correction : génération en timestamp 14 chiffres + underscore ; nettoyage des exclusions Supabase obsolètes ; délimiteurs PL/pgSQL restaurés dans le schéma existant.
- Commits de correction : cf18a3d794b684dcf06401ebb88201a878942a65, 1f736303bcf13936e420ec84b25fc6f456728eaa.
- Preuve finale : CircleCI run 192, statut `success` (« Your tests passed on CircleCI! »), commit `7c5155ce5fd3417e882be2523dfd0ce29f2ed0d6`.
- Aucun merge main, aucun déploiement Production.
- État : 🟢 VALIDÉ — CI/replay corrigé et prouvé.


## RECTIFICATION DE CONTINUITÉ — 08/10/2026

### Référence Git courante
- Branche de validation : `rewrite/naxa-from-main-20261007`
- HEAD courant : `5b24b96098ed240ddb9ade154e22f66969faa2df`
- `main` courant : `2e96930c5d8fb0de4ad22cf4f3dd8dd95b4fd471`
- Branche : **behind = 0**, ahead de `main`, merge-base = `main` HEAD.
- PR #30 : ouverte / draft / non fusionnée.
- Aucun merge `main`, aucun déploiement Production.

### Règle de preuve
Les preuves CircleCI antérieures, notamment run 192 sur `7c5155ce...`, restent historiques. Elles ne sont pas attribuées au HEAD `5b24b960...`.

Les fonctionnalités actuellement 🟡 pour cause de preuve SQL/CI restent 🟡 jusqu'à l'exécution reproductible du replay Supabase + tests au HEAD courant.

**Référence courante du registre : HEAD `5b24b960...`.**


## NAXA-CI-001 — Correction replay migration_034 — 08/10/2026
- **ID :** NAXA-CI-001
- **Domaine :** Qualité / SQL / CI
- **Description :** Correction du délimiteur PL/pgSQL invalide de `naxa_audit_session_delete()` dans `migration_034_promoteur_session_audit.sql`.
- **Correction :** `end; $;` → `end; $$;`.
- **Garde :** préflight CircleCI bloquant sur tout `$;` isolé dans le schéma ou les migrations.
- **Commits :** `fa2854d6b123be34c9c5853c2f68e62bb4895594`, `6cfbd89302e509eea50fa03293483abe4a437ac0`.
- **Validation :** correction statique vérifiée ; nouveau replay CI requis.
- **Main / Production :** aucun changement.
- **Statut :** 🟡 **CORRIGÉ — PREUVE D'EXÉCUTION MANQUANTE**.

## RECTIFICATION NAXA-CI-001 — 08/10/2026
La correction effective du replay est portée par `0a13542b4e2917086f2f5264c139c645c79bc380`. Les commits intermédiaires de correction de documentation/harnais restent historiques. **Statut : 🟡 corrigé statiquement, preuve CI/replay encore requise.**



---

## Audit SQL du 9 octobre 2026 — état non vert

- Base de test : `naxa-ci-replay-2`; aucune écriture Production.
- Rejeu exact non validé : `migration_059_pos_ticket.sql` a été corrigée sur la branche d’intégration au commit `23bc21dab4ab4daaa8f5b818dd2f1015edb1ae53`. `row_number()` est calculé dans un CTE avant UPDATE ; le recalage `setval()` utilise `greatest(max_numero, 1)` et `is_called = max_numero > 0`, donc une table vide est prise en charge. Le test ciblé sur la base de diagnostic passe et `nextval()` renvoie 1. Cette base reste non canonique et doit être recréée pour le rejeu complet.
- Tests SQL candidats exécutés individuellement : 18 sans erreur remontée, 13 en erreur/assertion, 1 bloqué par le contrôle de sécurité de l'outil. Cela ne vaut pas validation de la suite complète de 52 tests.
- Contradictions de contraintes sur `profiles` confirmées ; plusieurs tests Promoteur échouent sur CHECK. Des tests comportementaux manquent aussi de fixtures autonomes.
- RLS désactivée sur deux tables de la base de test (`abonnements`, `naxa_architecture_niveaux`) : politiques à auditer avant toute correction.
- Les migrations candidates 051–065 sont présentes dans la branche d'intégration ; c'est le rejeu exact sur une base de test propre qui reste à valider.

**Décision : ROUGE / NO-GO MAIN.** Aucun commit final sur `main` et aucun déploiement Production tant que ces blocages ne sont pas corrigés et que le rejeu exact + la suite complète n'ont pas fourni de preuves vertes.


## Reprise du chantier SQL — 10 octobre 2026 (validation toujours bloquée)

- Corrections de tests poussées sur la branche d'intégration uniquement : test 018 réordonné et rendu exécutable sur la base de diagnostic ; test 033 utilise désormais des assertions explicites au lieu d'une division par zéro ; tests 035 et 036 émettent un marqueur PASS explicite.
- Exécution ciblée confirmée sur la base de diagnostic : 018_pilotage_canonique_scope, 033_promoteur_pilotage_hors_scope_8, 035_promoteur_session_audit_behavior, 036_promoteur_session_audit_rls et 066_profiles_constraints_rls_hardening ont renvoyé leurs marqueurs PASS. Le test 019 doit encore être relu assertion par assertion ; un retour sans erreur SQL n'est pas une preuve suffisante.
- La migration candidate 067 a été ajoutée à la branche pour corriger les vérifications de capacités de lecture sans profil cible et faire appliquer la validité canonique du Promoteur (convention + abonnement réseau). Le test 066 vérifie désormais ces deux contrats et passe sur la base de diagnostic.
- Les tests 026/027/031/033/039 ont fait l'objet de corrections de fixtures ou d'assertions. Ils ne sont pas tous démontrés verts après les dernières modifications ; ne pas extrapoler les succès ciblés à toute la suite.
- Le dernier contrôle GitHub du commit testé ne retourne aucun statut CI ni workflow run. La branche d'intégration reste en avance sur main (comparaison courante : 165 commits, 103 fichiers) ; aucun commit de synthèse n'a été poussé sur main.
- La base naxa-ci-replay-2 reste une base de diagnostic modifiée manuellement : elle n'est pas une preuve de rejeu exact. Il faut recréer une base de test propre, appliquer les migrations de la branche dans l'ordre exact, puis exécuter la suite complète de 52 tests et obtenir un résultat CI traçable.
- Les contradictions de contraintes profiles et l'alerte RLS sur public.abonnements / public.naxa_architecture_niveaux restent à résoudre et à vérifier sur le rejeu propre.
- État : ROUGE / NO-GO MAIN. Production n'a pas été modifiée ni redéployée. Garder le verrou main jusqu'à la preuve CI + SQL complète.


## Reprise simultanée — corrections de causes racines — 10 octobre 2026

- **Cause racine trouvée dans le bootstrap SQL :** `supabase/schema.sql` contenait 101 784 caractères, 13 définitions de plusieurs fonctions de base et 13 déclarations du trigger d'inscription, ainsi que des blocs PL/pgSQL mal délimités. Il a été restauré depuis la version canonique initiale (`bbf55b6c30395b9593d52eb774be136e13050a5a`) : 10 032 caractères, une seule définition de `my_pharmacie()`, `restore_stock()`, `expire_reservations()` et du trigger attendu. Cela corrige le bootstrap candidat, **sans écriture Production**.
- **Migration POS 059 reconstruite sur la branche d'intégration :** suppression des fragments dupliqués/coupés, numérotation historique via CTE, index unique, séquence recalée sans échec lorsque `ventes` est vide, et une seule définition de `vente_ticket(uuid)`. L'application diagnostique de cette version à `naxa-ci-replay-2` a réussi. La migration déjà appliquée en Production n'a pas été rejouée sur Production.
- **Migration candidate 067 :** appliquée à l'environnement diagnostique sous un nom de migration explicite pour valider les fonctions de capacités de lecture et la validité commerciale réseau. L'historique de cet environnement contient aussi des patches diagnostiques; il n'est donc toujours **pas une base propre de preuve**.
- **Comptages du harnais confirmés dans l'arbre Git courant :** 79 migrations source et 53 tests SQL, conformes aux nombres attendus dans `.circleci/config.yml`.
- **Tests ciblés réexécutés sur la base diagnostique :** 018 (marqueur PASS), 019 (16/16 assertions vraies), 026 (13 assertions), 027 (11 assertions), 031 (pass=true), 033 (PASS transactionnel), 036 (marqueur PASS), 039 (PASS transactionnel) et 066 (marqueur PASS). Le test 035 a été bloqué lors de la tentative courante par le contrôle de sécurité de l'outil; son marqueur PASS antérieur n'est pas remplacé par cette tentative bloquée.
- **CI toujours non prouvée :** pour le HEAD contrôlé après les corrections (`9ec8f523e37dbdc25cea41b9616a7e7335b43f13`), GitHub ne retourne aucun statut de contrôle ni workflow run. La présence du harnais CircleCI ne prouve pas qu'il a été exécuté.
- **Limite restante obligatoire :** effectuer le rejeu exact sur une base locale/CI propre, puis obtenir la réussite de tous les 53 tests SQL et du job qualité. Les succès ciblés sur la base diagnostique ne remplacent pas cette preuve.

**Décision : ROUGE / NO-GO MAIN maintenu.** Aucun commit sur `main`, aucune PR/fusion vers `main`, aucune écriture Supabase Production et aucun déploiement. La branche de travail reste `integration/naxa-360-20261009`.


## Suite du chantier simultané — portée hiérarchique et gates CI — 10 octobre 2026

- **Migration additive 068 ajoutée** : `supabase/migration_068_hierarchical_pharmacy_scope.sql` corrige le défaut commun qui empêchait les Responsables/Caisses d'accéder au scope de leur pharmacie via l'ancien `my_pharmacies()`, limité au Promoteur. Le scope individuel est borné à la pharmacie du profil et à un Promoteur parent présent dans le réseau avec convention + abonnement valides. Les scopes RESEAU et POSTE_CAISSE restent contrôlés. La migration 068 a été appliquée et testée sur l'environnement diagnostique, pas en Production.
- **Contradiction corrigée dans le test 027** : l'expiration commerciale doit fermer le scope pharmacie du Promoteur, pas laisser le scope ouvert. Après alignement, le test 027 a renvoyé `GREEN` avec 11 assertions.
- **Test 018b reconstruit comme scénario autonome** : trois comptes de test, Promoteur et abonnement réseau valides, architecture A3, privilège Responsable, puis vérification du périmètre. Il a renvoyé `018b Responsable — PASS transactionnel` après la migration 068.
- **Harnais CI synchronisé** : l'arbre Git contient désormais exactement 80 migrations source et 53 tests SQL ; `.circleci/config.yml` attend 80 et 53. Les tests structurels 017, 020_architecture_privileges, 020_caisse_perimetre (20 assertions), 023b et 034 (6/6 assertions) ont reçu des marqueurs de sortie exploitables par le runner ; 041b a également un marqueur PASS.
- **Autres résultats ciblés après correction** : 000, 018, 019 (16/16 assertions), 026 (13 assertions), 029, 031, 033, 036, 039, 040 et 066 ont renvoyé un résultat positif sur la base diagnostique. Le test 024 a été réordonné pour créer convention et abonnement avant le lien réseau, mais la dernière tentative de réexécution a été bloquée par les contrôles de l'outil. Les tests 013, 023, 028 et 032 n'ont pas pu être réexécutés par ce connecteur; le scénario 020_authorisation a été rendu autonome mais sa tentative d'exécution a également été bloquée. Ces cas ne sont pas déclarés verts.
- **RLS de diagnostic revérifiée** : `abonnements` RLS=true avec une politique; `naxa_architecture_niveaux` RLS=true avec deux politiques. Cela ne remplace pas une vérification issue d'un rejeu propre.
- **État CI du HEAD `07562da8b6b375297be0b319d5b1bf975dbb23d3`** : aucun statut GitHub ni workflow run retourné. La CI reste sans preuve d'exécution concluante. La branche est en avance sur `main`, sans retard; `main` n'a pas été modifiée.

**Décision : ROUGE / NO-GO MAIN maintenu.** Les corrections de causes racines et plusieurs tests ciblés sont positifs, mais le rejeu exact sur base propre et la réussite de toute la suite SQL/qualité restent obligatoires. Aucun changement Supabase Production, aucune fusion et aucun déploiement.


## 2026-10-12 — Ajouts en cours, non validés

- Branche `feat/naxa-messagerie-profil-yaounde` : fondations SQL additives 075 (préférences, fils, messages, notifications) et 076 (sur ordonnance/fabricant), composants de messagerie et pages de notifications/boîte pharmacie.
- Tests ajoutés : `supabase/tests/075_messagerie_notifications_preferences.sql` et `supabase/tests/076_produits_ordonnance_fabricant.sql`.
- Statut : **en cours — non validé**. Le build, ESLint, replay SQL, tests en navigateur, les droits réels des rôles pharmacie et le parcours OAuth doivent encore être exécutés/vérifiés. Aucun déploiement Production effectué.

---

## Audit opérationnel du parcours client — 16/10/2026

**Périmètre :** routes et transitions du client, sans reconstruction des modules déjà présents.

- **Retour après contrôle d’âge :** une demande directe vers une page protégée redirigeait vers l’accueil sans conserver la destination. Correction sur `main` : `src/middleware.ts` ajoute `retourAge`; `src/app/page.tsx` reprend la destination interne après déclaration adulte, y compris si la déclaration avait déjà été enregistrée.
- **Résultats sans requête :** `/resultats` sans terme `q` ni élément `p` affichait indéfiniment « Recherche des pharmacies en cours… ». Correction sur `main` : état vide explicite et retour à la recherche.
- **Fiche produit :** le compteur de disponibilité ne filtrait ni les stocks expirés ni les pharmacies inactives. Correction sur `main` : seules les lignes avec quantité positive, date de péremption absente ou non dépassée, et pharmacie active sont comptées.
- **Vérification Supabase en lecture seule :** 9 lignes de stock avec quantité positive, 0 déjà expirée et 9 sans date de péremption au moment du contrôle. Aucune donnée n’a été modifiée.
- **RPC de recherche :** migration additive `supabase/migration_091_exclude_expired_stocks_search.sql` créée sur `main` (commit `74f36fb87a0afd925bff33c979ddb8b5788eea0a`) puis appliquée à Supabase Production avec succès, version `20261016023027` / `exclude_expired_stocks_search`. Les deux RPC filtrent désormais `date_peremption IS NULL OR date_peremption >= CURRENT_DATE`; aucun stock ni aucune autre donnée n’a été modifié.
- **Preuve SQL après migration :** `pg_get_functiondef` confirme le filtre dans les deux fonctions. Les deux RPC ont été exécutées avec des entrées vides sans erreur (0 ligne retournée chacune). Le stock de production reste à 9 lignes positives, 0 expirée et 9 sans date de péremption; l’absence de lignes déjà expirées ne permet pas de prouver par données réelles le cas d’exclusion.
- **État de preuve restant :** la compilation et le déploiement Production du dernier commit documentaire doivent être confirmés. Le parcours mobile complet avec session réelle n’est pas déclaré validé tant qu’un test de bout en bout ne l’a pas démontré.
