# NAXA — STATUT

Mise à jour : 8 octobre 2026 — Architecture N0–N4 / privilèges / convention / Responsable

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


## Premier chantier — Pilotage 360°
- Réconciliation additive dans `main` : socle historique Pilotage 360° conservé et intégré sans reconstruire les fonctionnalités existantes.
- Noyau SQL intégré : événements, CA canonique, scopes hiérarchiques, BI multi-pharmacie et RPC `stats_pilotage_scope`.
- UI intégrée : `/admin/pilotage`, rapports et composants de pilotage existants.
- Aucun changement Production exécuté pendant ce chantier.
- Preuve Supabase NAXA en lecture seule : `evenements`, `v_reservations_ca`, `rapports`, `promoteur_pharmacies` et `stocks_lots` sont présents ; l'historique des migrations confirme le socle Pilotage 360° déployé.
- **État : 🟢 chantier réconcilié dans `main`.**

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

## Deuxième chantier — Architecture N0–N4 / privilèges / convention / Responsable
- Réconciliation additive des travaux historiques 017/019/020/020_authorisation/020c/023/024/025/026/027.
- Responsable = fonction interne/niveau 2 ; aucun `responsable` dans `role_type`.
- Architecture canonique portée par la convention Promoteur ; quatre architectures conservées.
- Moteur RBAC unifié sur `naxa_profile_privileges`; pas de stockage parallèle `profile_privileges`.
- Validité commerciale bloquante dans l'autorisation Promoteur.
- Accréditation via `accrediter_profile` avec parent, scope et quotas.
- Workflow qualité déclenché sur `push main` et replay local + tests architecture.
- Aucun déploiement Production.
- **État : 🟡 intégré dans `main` — preuve d'exécution CI indisponible.**

### Blocage de preuve constaté
- Deux exécutions du workflow qualité sur le commit du chantier ont échoué avant attribution d'un runner (`runner_name` vide), sur `ubuntu-24.04` puis `ubuntu-latest`.
- Le problème est donc actuellement dans l'infrastructure GitHub Actions, pas dans une erreur SQL démontrée.
- Le workflow a été simplifié pour ne conserver que build + replay Supabase local + tests Architecture, et déclenché sur `push main`.
- **Aucun 🟢 n'est déclaré tant que cette preuve d'exécution n'est pas obtenue.**


## Preuve Architecture — clôture de recherche
- Les runs GitHub Actions du chantier Architecture sur `main` se terminent avant exécution des étapes : `runner_name` est vide et aucune étape n'est exécutée.
- Le même comportement est observé sur `ubuntu-24.04` et `ubuntu-latest`, y compris sur plusieurs anciens workflows NAXA.
- Conclusion : aucune preuve CI exploitable n'a été trouvée. Le chantier Architecture reste **🟡 PREUVE MANQUANTE** et ne bloque pas la poursuite opérationnelle demandée.

## Troisième chantier — F040 coûts d'achat / stocks multi-pharmacie
- Réconciliation de `migration_013_stocks_couts.sql` depuis l'implémentation historique.
- Conservation du modèle existant : `stocks` = quantité/prix public ; `stocks_couts` = coût d'achat interne courant.
- RLS alignée sur `can_access_pharmacy()`.
- Aucun calcul de marge transactionnelle ajouté prématurément : le coût historique devra être figé sur chaque ligne de vente avant calcul de marge.
- **État : 🟡 intégré dans `main`, preuve d'exécution à obtenir.**


## Quatrième chantier — F041 rapports / exports / BI
- Audit de l'existant : routes, UI et socles SQL déjà présents ; aucune reconstruction parallèle.
- Correction ciblée de `/api/rapports` : le nom de pharmacie est maintenant chargé depuis la relation existante et exposé à l'UI.
- Preuve Supabase live : `rapports`, `v_reservations_ca`, `v_ventes_journalieres`, `bi.activite_mensuelle` et `bi.stock_pharmacies` présents ; RLS `rapports_lecture` contrôlée.
- Export CSV existant conservé.
- Aucun déploiement Production.
- **État : 🟢 F041 validé dans `main`.**


## Cinquième chantier — ERP-001 catalogue pharmacie avancé
- Audit effectué : DCI/molécule, dosage, forme et fiches produit existaient déjà.
- Extension additive de `produits` : ATC, conditionnement et référence catalogue.
- Relation d'équivalence ajoutée uniquement pour couvrir un besoin absent, sans catalogue concurrent.
- RLS ajoutée sur les équivalences.
- Test structurel ajouté.
- Aucun changement Production exécuté.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


## Sixième chantier — ERP-002 lots / péremptions / alertes
- Audit : `stocks_lots` était référencé historiquement mais absent du `main` courant.
- Correction additive : création du socle canonique `stocks_lots` sans remplacer `stocks`.
- Champs couverts : lot, péremption, quantité, blocage motivé, pharmacie, produit.
- RLS : scope `can_access_pharmacy()` ; Admin réseau autorisé.
- Migration : `supabase/migration_043_stocks_lots.sql`.
- Test : `supabase/tests/043_stocks_lots.sql`.
- Aucun changement Production.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


## Septième chantier — ERP-003 POS / caisse
- Audit terminé : aucun moteur POS/vente concurrent trouvé.
- Socle ajouté : caisses, sessions de caisse, ventes et lignes de vente.
- Ouverture de caisse et création de vente sécurisées par fonctions SQL.
- RLS multi-pharmacie appliquée.
- Migration : `supabase/migration_044_pos_caisse.sql`.
- Test : `supabase/tests/044_pos_caisse.sql`.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


## Huitième chantier — ERP-004 Prescription → vente
- Audit réalisé : aucun modèle persistant de prescription/ordonnance n'existait dans `main`; le scan/import ordonnance existant est conservé.
- Construction additive : `prescriptions` + `prescription_items` + lien `ventes.prescription_id`.
- Sécurité métier : validation serveur par Promoteur ou fonction interne `pharmacien_assistant`, rejet avec motif obligatoire, et blocage serveur d'une vente liée à une ordonnance non validée.
- Séparation des données : le coffre n'est pas exposé au comptable ni à l'admin réseau.
- Fichiers : `supabase/migration_045_prescription_vente.sql`, `supabase/tests/045_prescription_vente.sql`.
- Références Supabase utilisées pour la conception : RLS, grants explicites, fonctions sécurisées et triggers. citeturn0search0turn2search0turn1search0
- Aucun changement Production.
- **État : 🟡 construit — preuve SQL/CI manquante.**
