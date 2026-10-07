# NAXA — FONCTIONNALITÉS VALIDÉES

> Registre opérationnel permanent des fonctionnalités/pages/blocs NAXA.
> **Source de suivi :** toute fonctionnalité créée ou reprise doit être consignée ici avec son état réel.
> **Source de vérité du code :** `main`.
> Les anciennes branches restent des sources historiques et de récupération ; elles ne sont jamais assimilées à une intégration dans `main` sans preuve.

## 1. Règle de fonctionnement

**Construire → contrôler → consigner → statut → commit → main → continuer.**

Un bloc bloqué par une preuve externe ne doit pas immobiliser les blocs indépendants. Le blocage, sa cause et la prochaine action sont consignés ici.

## 2. Niveaux de validation

| Niveau | Signification |
|---|---|
| 🟡 Statique | Code/page/route présente et inspectée. |
| 🟢 Technique | Compilation, tests, DB, sécurité et contrôles techniques effectivement prouvés. |
| 🟢 Fonctionnelle | Flux métier effectivement vérifié. |
| 🟢 Production | Déploiement Production autorisé et comportement réellement vérifié en Production. |

### Statuts globaux

- 🟢 **VALIDÉ** : le niveau annoncé est prouvé.
- 🟡 **VALIDÉ — À COMPLÉTER** : bloc construit et état connu, mais preuve/niveau supérieur manquant.
- 🔴 **À CORRIGER** : contradiction, régression ou défaut identifié.
- ⚪ **À FAIRE** : fonctionnalité non construite.

> « Validé » dans ce registre signifie que le bloc a été traité et consigné avec son statut réel. Cela ne signifie pas automatiquement « Production validée ».

## 3. Fiche obligatoire

Chaque entrée doit contenir, quand l'information existe :

- ID
- fonctionnalité/page
- domaine
- description
- routes
- fichiers créés/modifiés
- tables/vues/fonctions/triggers DB
- migrations
- tests et résultats
- branche de création
- commit de création
- intégration dans main + SHA
- déploiement éventuel
- validation statique/technique/fonctionnelle/Production
- preuves
- blocage
- cause
- correction
- prochaine action
- dernière vérification
- notes/contradictions.

---

# 4. INVENTAIRE RETRACÉ — FONCTIONNALITÉS DÉJÀ TRAITÉES

> **Important :** les statuts ci-dessous distinguent ce qui est réellement documenté/présent sur `main` de ce qui a été traité sur des branches historiques. Une fonctionnalité historique n'est pas déclarée intégrée à `main` sans preuve.

## NAXA-F001 — Authentification / connexion

**Domaine :** Auth  
**Routes principales :** `/connexion`, `/nouveau-mot-de-passe`, `/mot-de-passe-oublie`, `/verification-age`  
**État retracé :** construite et consolidée.  
**Travaux :**
- connexion username/mot de passe ;
- récupération de compte ;
- OTP e-mail ;
- changement de mot de passe ;
- session Supabase ;
- Google OAuth et callback ;
- conservation de la destination de retour ;
- conteneur d'authentification sans scroll parasite ;
- contrôle serveur avant envoi OTP ;
- compte inexistant = aucune étape OTP.

**Branches historiques retracées :**
- `feat/auth-flow-age-gate`
- `fix/auth-reset-google-ux`
- `fix/auth-no-scroll-final-20261004`
- `reconcile/auth-homepage-20261004`
- `reconcile/naxa-final-auth-home-20261004`
- `feat/final-auth-legal-ux-20261004`

**Main / preuve récente :**
- PR #17 documentée par le commit `d69bec6742bc475e6aadac317fa4317edd894567`.
- README/STATUT de `main` indiquent la consolidation et un build Production réussi.
- Production documentée comme READY dans l'état historique du dépôt.

**Validation :**
- Statique : 🟢
- Technique : 🟢 selon les preuves documentées
- Fonctionnelle : 🟢 selon le périmètre contrôlé
- Production : 🟢 selon le dernier état documenté

**Statut global :** 🟢 VALIDÉ — historique/main documenté.  
**À surveiller :** ne pas confondre cette validation historique avec une nouvelle preuve Production si l'environnement a changé.

---

## NAXA-F002 — Création de compte

**Domaine :** Auth  
**Route :** `/creation-compte`  
**Travaux retracés :**
- création en étapes informations → OTP → mot de passe ;
- username unique ;
- téléphone pays/indicatif/numéro ;
- contrôle de longueur ;
- coche jaune de validation ;
- sélecteur pays compact ;
- suppression du bandeau « Les plus recherchés » sur cet écran ;
- recentrage/compactage mobile ;
- suppression du scroll volontaire.

**Branches :**
- `feat/creation-compte`
- `docs/creation-compte-consolidation-20261004`
- `fix/creation-compte-mobile-ux-20261005`
- `fix/creation-phone-forgot-password-20261004`

**Main :** fusionnée dans les consolidations historiques documentées.  
**Production :** état historique documenté READY.

**Validation :** Statique 🟢 / Technique 🟢 / Fonctionnelle 🟢 / Production 🟢 selon le dernier périmètre documenté.  
**Statut :** 🟢 VALIDÉ.

---

## NAXA-F003 — Validation d'âge

**Domaine :** Sécurité/Auth  
**Route :** `/verification-age`  
**Travaux :**
- validation obligatoire ;
- trois politiques ;
- contrôle interface + serveur ;
- hardening de la validation.

**Branche retracée :** `fix/age-gate-production-hardening`.  
**Statut :** 🟢 VALIDÉ dans le périmètre historique contrôlé.  
**Production :** 🟢 documentée dans la consolidation auth.

---

## NAXA-F004 — Accueil / marketplace de recherche

**Domaine :** Client  
**Routes :** accueil, recherche/résultats, fiches produits  
**Travaux retracés :**
- recherche de médicaments ;
- classement prix/distance/temps ;
- circulation ;
- bandeau « Les plus recherchés » ;
- traduction des noms du bandeau ;
- CTA pharmacie isolé ;
- disclaimer médical repositionné ;
- numéros 1510 / 119 / 1511 ;
- accès protégé pour les actions opérationnelles.

**Statut :** 🟢 VALIDÉ — historique/main documenté pour le périmètre existant.  
**Attention :** extensions marketplace futures restent à traiter.

---

## NAXA-F005 — Catalogue / fiche produit

**Domaine :** Client / Catalogue  
**Travaux :**
- catalogue ;
- fiches produits ;
- contrôle des écritures administratives ;
- panier relié au catalogue.

**DB retracée :** migrations catalogue/panier historiques 002+, contrôles sécurité 003/004.  
**Statut :** 🟢 VALIDÉ pour le périmètre existant.  
**Reste :** enrichissements ERP/catalogue à venir.

---

## NAXA-F006 — Panier

**Domaine :** Client  
**Travaux :**
- ajout/gestion panier ;
- contrôles serveur renforcés ;
- actions opérationnelles protégées.

**DB :** migration catalogue/panier + hardening sécurité.  
**Statut :** 🟢 VALIDÉ pour le périmètre existant.

---

## NAXA-F007 — Réservation / retrait

**Domaine :** Client / Pharmacie  
**Travaux retracés :**
- réservation ;
- durée de réservation 3 h ;
- expiration planifiée ;
- reçu ;
- parcours de retrait ;
- paiement guidé facultatif.

**DB :** mécanisme d'expiration + RPC historiques.  
**Statut :** 🟢 VALIDÉ pour le périmètre existant.  
**À compléter ultérieurement :** ERP vente/retrait complet.

---

## NAXA-F008 — Paiement guidé

**Domaine :** Client / Réservation  
**Travaux :**
- paiement guidé par code marchand ;
- statut de réservation ;
- reçu imprimable.

**Statut :** 🟢 VALIDÉ pour le flux existant.  
**Reste :** intégrations de paiement en ligne/Mobile Money selon cahier.

---

## NAXA-F009 — WhatsApp

**Domaine :** Client  
**Travaux :** contact/interaction dans le parcours existant.  
**Règle métier conservée :** aucun numéro WhatsApp pharmacie exposé côté client dans la règle actuelle.  
**Statut :** 🟢 VALIDÉ pour le périmètre actuel.

---

## NAXA-F010 — Scan/import ordonnance

**Domaine :** Client / Ordonnance  
**Travaux :**
- import téléphone ;
- caméra ;
- OCR ;
- parcours protégé.

**Statut :** 🟢 VALIDÉ pour le périmètre existant.  
**Reste ERP :** ordonnance/ordonnancier complet, prescription → vente et règles réglementaires.

---

## NAXA-F011 — Suivi / historique client

**Domaine :** Client  
**Travaux retracés :**
- suivi ;
- historique ;
- achats ;
- isolation des achats client par `auth.uid()`.

**Statut :** 🟢 VALIDÉ pour le périmètre contrôlé.  
**Reste :** extensions fidélité/communication client éventuelles.

---

## NAXA-F012 — Pharmacie / espace équipe

**Domaine :** Pharmacie  
**Route :** `/pharmacie`  
**Travaux :**
- panneau pharmacie ;
- gestion du stock ;
- statut « De garde » via RPC sécurisée ;
- réservations ;
- travail hors connexion ;
- IndexedDB ;
- badge hors connexion ;
- synchronisation au retour réseau ;
- résolution des conflits via `updated_at`.

**Branches retracées :**
- `feat/pharmacie-pilotes-offline-20261005`
- `feat/pharmacie-promoteur-caisses-20261005`
- `feat/pharmacie-validite-pilotage`

**Statut :** 🟢 VALIDÉ dans le périmètre Production historique documenté.

---

## NAXA-F013 — Import de stock

**Domaine :** Pharmacie / Stock  
**Travaux :**
- import Excel/CSV ;
- reconnaissance nom/désignation/produit ;
- prix ;
- quantité ;
- dosage/conditionnement ;
- péremption ;
- modifications manuelles ;
- persistance ;
- mode hors connexion.

**Statut :** 🟢 VALIDÉ pour le mécanisme existant.  
**Reste ERP :** lots, inventaires, réapprovisionnement, valorisation, rappels, etc.

---

## NAXA-F014 — Promoteur / Caisses

**Domaine :** Architecture pharmacie  
**Hiérarchie concernée :** Promoteur parent → Caisses enfants.  
**Travaux :**
- création du Promoteur via `/admin` ;
- gestion des Caisses ;
- blocage/réactivation d'une Caisse ;
- Caisse = utilisateur opérationnel de la même pharmacie ;
- stock/réservations/statut de garde partagés ;
- blocage d'une Caisse sans désactiver la pharmacie ;
- schéma Supabase correspondant ;
- rôles `promoteur` et `caisse` ;
- `parent_profile_id` et `actif`.

**Branche :** `feat/pharmacie-promoteur-caisses-20261005`.  
**Commit main de consolidation :** `5ad95ce30dd43b3c140e0048606c81dd5143e490`.  
**Production :** déploiement documenté READY `dpl_CcFGneLjZjBSLQ32Mccww6vjwAD6`.  
**Statut :** 🟢 VALIDÉ — périmètre consolidé 100 % selon STATUT/README.

---

# 5. PILOTAGE / PROMOTEUR — TRAVAUX DÉJÀ RETRACÉS, À NE PAS RECONSTRUIRE COMME S'ILS N'EXISTAIENT PAS

> Ces blocs ont été développés/traités dans les travaux historiques. Leur présence hors de la version actuelle de `main` doit être distinguée de leur existence fonctionnelle. Ils doivent être **réconciliés/intégrés et revalidés**, pas recommencés aveuglément.

## NAXA-F020 — Pilotage commercial

**Travaux retracés :**
- pilotage commercial ;
- CA ;
- indicateurs de ventes ;
- périmètre réseau/pharmacie ;
- vues et rapports associés.

**Branches historiques associées :**
- `feat/pilotage-equipes-bi-20261005`
- `feat/pharmacie-validite-pilotage`
- travaux de réconciliation du 07/10/2026.

**Statut :** 🟡 VALIDÉ — À COMPLÉTER / RÉCONCILIER.  
**Raison :** fonctionnalité déjà traitée historiquement, mais l'intégration complète et la preuve actuelle dans `main` doivent être distinguées de l'ancien état.

---

## NAXA-F021 — Pilotage performance

**Travaux retracés :**
- pilotage performance ;
- indicateurs de performance ;
- BI ;
- rapports ;
- périmètres Promoteur/Responsable/Caisse.

**Statut :** 🟡 VALIDÉ — À COMPLÉTER / RÉCONCILIER.  
**Règle :** ne pas repartir de zéro.

---

## NAXA-F022 — Pilotage sécurité / réseau

**Travaux retracés :**
- visibilité réseau ;
- sécurité ;
- sessions/audit ;
- périmètres de consultation ;
- traces sans exposition de tokens/cookies.

**Statut :** 🟡 VALIDÉ — À COMPLÉTER / RÉCONCILIER.

---

## NAXA-F023 — Direction 360°

**Travaux retracés :**
- vue Direction 360° ;
- consolidation du pilotage ;
- réseau ;
- performance ;
- sécurité ;
- BI/rapports.

**Branches historiques :**
- travaux de réconciliation/pilotage du 07/10/2026 ;
- `reconciliation/final-integration-20261007` et générations associées.

**Statut :** 🟡 VALIDÉ — À COMPLÉTER / RÉCONCILIER.

---

# 6. HIÉRARCHIE / PRIVILÈGES / ARCHITECTURE

## NAXA-F030 — Hiérarchie N0 → N4

**Modèle retenu :**
- N0 Admin Réseau NAXA
- N1 Promoteur
- N2 Responsable
- N3 Caisse
- N4 Client

**Point important :** Responsable n'est pas un nouveau `role_type` ; c'est une fonction interne/niveau conforme au modèle retenu.

**Statut :** 🟡 VALIDÉ — À COMPLÉTER / RÉCONCILIER dans la génération actuelle.

---

## NAXA-F031 — Architectures ORPHELIN / PARENTS-ENFANTS / PARENTS-AÎNÉS-CADETS / HYBRIDE

**Travaux retracés :**
- ORPHELIN ;
- PARENTS_ENFANTS ;
- PARENTS_AINES_CADETS ;
- HYBRIDE ;
- limites configurables par NAXA ;
- pas de création arbitraire de nouveaux `role_type` pour l'HYBRIDE.

**Statut :** 🟡 VALIDÉ — À COMPLÉTER / RÉCONCILIER.

---

## NAXA-F032 — Moteur de privilèges / délégation

**Travaux retracés :**
- `naxa_can()` ;
- privilèges par domaine ;
- niveau minimal ;
- architecture autorisée ;
- scope maximal ;
- délégabilité ;
- privilèges de gouvernance non délégables ;
- Promoteur ne reçoit pas automatiquement « tous les droits ».

**Statut :** 🟡 VALIDÉ — À COMPLÉTER / RÉCONCILIER.

**Contradictions historiques connues :**
- `parent_profile_id` ;
- `promoteur_pharmacies` ;
- `profile_accreditations` ;
- `can_manage_profile()` ;
- `accrediter_profile()` ;
- `can_operate_pharmacy()`.
Ces éléments doivent être réconciliés avec le moteur canonique, pas ignorés.

---

## NAXA-F033 — Convention Promoteur / tarif / abonnement / validité

**Modèle retenu :**
- Promoteur = 1 convention + 1 tarif + 1 abonnement ;
- montant payé ;
- date de paiement ;
- date d'expiration ;
- expiration = blocage du réseau concerné ;
- tarif négocié par NAXA ;
- 30 000 FCFA non considéré comme tarif fixe ;
- remise multi-pharmacies possible.

**Statut :** 🟡 VALIDÉ — À COMPLÉTER / RÉCONCILIER.

---

## NAXA-F034 — Responsable N2 / accréditation

**Travaux retracés :**
- Responsable comme fonction interne ;
- périmètre d'une pharmacie ;
- accréditation ;
- tests de scope Responsable.

**Branche :** `feat/promoteur-partie3-responsable-accreditation-20261006`.  
**Commit de test retracé :** `7dbfd643c9b5b8d0df0907aab04737bcce7827ec`.  
**Statut :** 🟡 VALIDÉ — À COMPLÉTER / RÉCONCILIER.

---

# 7. STOCK / COÛTS / CA / RAPPORTS

## NAXA-F040 — Coûts / marges / stocks multi-pharmacies

**Travaux retracés :**
- coûts ;
- marges ;
- scope multi-pharmacie ;
- accès via moteur de scope ;
- CA canonique ;
- vues/rapports.

**Contradictions historiques :**
- E20 stocks_couts vs scope multi-pharmacie corrigée historiquement ;
- E22 `set_reservation_status()` / `search_path='' ` corrigée historiquement ;
- E25 scope Admin/demo corrigée ;
- E30 multi-rôle Pilotage : validation partielle historique.

**Statut :** 🟡 VALIDÉ — À COMPLÉTER / RÉCONCILIER.

---

## NAXA-F041 — Rapports / exports / BI

**Travaux retracés :**
- rapports ;
- exports ;
- BI ;
- pilotage réseau ;
- indicateurs commerciaux/performance.

**Statut :** 🟡 VALIDÉ — À COMPLÉTER / RÉCONCILIER.

---

# 8. ADMINISTRATION

## NAXA-F050 — Administration NAXA

**Travaux retracés :**
- dashboard admin ;
- produits ;
- pilotage ;
- rapports ;
- validité ;
- actions ;
- création/gestion du Promoteur dans le modèle consolidé.

**Statut :** 🟢 VALIDÉ pour le périmètre historique documenté ; 🟡 pour les extensions de gouvernance futures.

---

# 9. API / AUTOMATISATION RETRACÉES

## NAXA-F060 — APIs auth / âge / réservation / paiement

**Routes/API retracées :**
- login ;
- username availability ;
- forgot password ;
- forgot password verify ;
- age verify ;
- pay ;
- go/réservation ;
- reports ;
- cron reports ;
- cron validity.

**Statut :** 🟢 VALIDÉ pour le périmètre historique existant ; extensions ERP/API à venir.

---

# 10. ERP PHARMACIE — PROGRAMME RESTANT À CONSTRUIRE

> **Ce n'est pas à considérer comme déjà construit simplement parce que certains éléments du stock/vente existent.**

Les blocs ERP restant à construire ou à compléter comprennent notamment :

## NAXA-ERP-001 — Catalogue pharmacie avancé
- molécules / ATC ;
- conditionnements ;
- références avancées ;
- équivalences.

**Statut :** ⚪ À FAIRE / à auditer précisément.

## NAXA-ERP-002 — Lots / péremptions / alertes
- gestion des lots ;
- dates d'expiration ;
- alertes ;
- blocages ;
- rappels.

**Statut :** ⚪ À FAIRE / à auditer précisément.

## NAXA-ERP-003 — Caisse / POS complet
- vente rapide ;
- scan code-barres ;
- panier caisse ;
- encaissement ;
- clôture/Z ;
- remises/promotions.

**Statut :** ⚪ À FAIRE.

## NAXA-ERP-004 — Vente / prescription
- prescription → vente ;
- ordonnance/ordonnancier ;
- règles spécifiques ;
- stupéfiants selon périmètre réglementaire.

**Statut :** ⚪ À FAIRE / à cadrer précisément.

## NAXA-ERP-005 — Fournisseurs / commandes / réception
- fournisseurs ;
- commandes ;
- réception ;
- rapprochement ;
- réapprovisionnement.

**Statut :** ⚪ À FAIRE.

## NAXA-ERP-006 — Inventaire / valorisation
- inventaire ;
- valorisation ;
- coût historique ;
- écarts ;
- mouvements.

**Statut :** ⚪ À FAIRE.

## NAXA-ERP-007 — Assurance / crédit / bordereaux
**Statut :** ⚪ À FAIRE.

## NAXA-ERP-008 — Trésorerie / dépenses
**Statut :** ⚪ À FAIRE.

## NAXA-ERP-009 — Hors connexion ERP avancé
Le mode hors connexion stock existe déjà ; le mode offline complet de vente/ERP reste à construire si confirmé par le cahier des charges.

**Statut :** ⚪ À FAIRE.

---

# 11. ROADMAP DES EXTENSIONS RESTANTES

À auditer dans le cahier des charges avant construction :

- mise en service terrain réelle ;
- qualité ;
- marketplace avancée ;
- Mobile Money / abonnement ;
- paiement en ligne ;
- équipes/multi-sites ;
- fournisseurs ;
- non-médicaments ;
- sécurité avancée ;
- communication client ;
- prévision saisonnière ;
- autres fonctions métier du cahier des charges.

---

# 12. ÉTAT ACTUEL EXACT

## Ce qui est acquis

Le socle Client/Auth/Pharmacie existe largement sur `main`, avec une consolidation historique documentée jusqu'au modèle Promoteur/Caisses.

## Ce qui a déjà été travaillé mais doit être réconcilié

Les chantiers **Pilotage commercial, Pilotage performance, Pilotage sécurité/réseau, Direction 360°, hiérarchie N0-N4, privilèges, architectures, Responsable, convention Promoteur, coûts/marges, BI/rapports** ont déjà été traités dans les générations historiques.

**Ils ne doivent PAS être reconstruits comme s'ils n'avaient jamais existé.**

Ils doivent être repris via une **réconciliation/intégration contrôlée dans main**, avec conservation des meilleures versions et preuves.

## Chantier fonctionnel de construction restant

Après réconciliation des travaux déjà effectués, le prochain grand programme fonctionnel est :

**ERP PHARMACIE**

Premier bloc à traiter : **NAXA-ERP-001 — Catalogue pharmacie avancé**, après vérification précise du cahier des charges et de l'existant afin de ne pas recréer une fonction déjà présente.

---

# 13. HISTORIQUE DU REGISTRE

| Date | Action | Commit |
|---|---|---|
| 2026-10-08 | Création du registre | `9741736cc6ff00a309d34547faf3b0300a274252` |
| 2026-10-08 | Premier inventaire enrichi à partir des travaux retracés | à renseigner après commit |

---

# 14. RÈGLE ABSOLUE POUR LES PROCHAINES FONCTIONNALITÉS

À chaque fonctionnalité :

**AUDIT → CONSTRUCTION → TEST → CORRECTION → CONSIGNATION COMPLÈTE → COMMIT → MAIN → STATUT → CONTINUATION.**

Aucune fonctionnalité créée ne doit être perdue du registre.
