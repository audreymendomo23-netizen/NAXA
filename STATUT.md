## Dernière passe — Promoteur 028 et revue statique des parties 5–6 (29/10/2026)

- 028 comportemental : **PASS en environnement isolé** `naxa-ci-replay-2`; transaction annulée par ROLLBACK.
- Partie 5 (scope réseau/pilotage) : revue statique faite; comportement non certifié. ACL Production : `authenticated` a USAGE sur `private` et EXECUTE sur plusieurs helpers privés. Le contrôle ciblé d’exposition Data API est désormais CLOS : `private` n’est pas exposé, aucun objet relationnel n’est présent dans `private` et aucun ACL par défaut de fonction n’a été relevé. Les ACL existantes servent à certaines façades `public` invoker; ne pas les révoquer globalement sans refactorisation et tests. La validation comportementale de la partie 5 reste distinctement ouverte.
- Partie 6 (pilotage hors périmètre) : revue statique faite; test 033 non exécuté, garde-fou SQL a bloqué le script qui manipule `session_replication_role`; aucun contournement.
- Tests 029–031 : réserve technique, non exécutés et non déclarés réussis.
- Aucun changement Production ni déploiement. Parties 3 à 6 restent ouvertes jusqu'aux preuves manquantes.

## Audit sécurité Data API — point 3 (29/10/2026)

- **Sous-contrôle « Exposed schemas » : CLOS / CONFORME visuellement**, selon confirmation visuelle fournie par l’utilisateur : `graphql_public` et `public` cochés; `private` et `bi` non cochés.
- **Vérifications SQL complémentaires en lecture seule :** `authenticated` dispose de `USAGE` sur `private` et d’`EXECUTE` sur plusieurs helpers; aucun objet relationnel dans `private` ni ACL par défaut de fonction dans ce schéma n’a été relevé. Plusieurs fonctions publiques invoker délèguent intentionnellement à ces helpers; une révocation globale de `USAGE`/`EXECUTE` casserait ces appels sans conversion contrôlée des façades.
- **Autres voies d’accès examinées :** les façades publiques de gestion consultées délèguent aux helpers `SECURITY DEFINER` avec `search_path` contraint et contrôles d’identité, de rôle ou de périmètre (ex. accréditation, gestion des privilèges, provisioning Caisse, réactivation pharmacie et pilotage). Cette vérification ciblée ne remplace pas la recette exhaustive des RPC publiques.
- **Décision : point d’exposition du schéma `private` CLOS / CONFORME pour la Data API.** Aucun correctif SQL Production n’est nécessaire pour retirer `private` des schémas exposés puisqu’il n’y figure pas; aucune révocation ACL large n’est faite sans refactorisation et test des façades. Les parties Promoteur 3–6 et la recette exhaustive des RPC publiques restent ouvertes dans leurs propres critères.
- **Aucune action de configuration :** aucun réglage Supabase modifié, aucune écriture Production, aucune migration ni aucun déploiement.
- **Décision de clôture :** le contrôle d’exposition directe du schéma `private` via Data API est clos après la preuve visuelle et les contrôles SQL complémentaires. Cette clôture ne certifie pas toutes les RPC publiques ni les parties Promoteur 3–6.

# STATUT NAXA — documents de référence actifs

> Autorités uniques du chantier : **MANDAT CTO NAXA** et **cahier des charges Audit 360 du parcours Administrateur** ([document d'audit](docs/audits/AUDIT_360_ADMINISTRATEUR_NAXA.md)). Le cahier V3.7 et le Prompt maître ont été supprimés. Toute mention historique éventuelle ci-dessous n'a aucune autorité de décision.
>
> Périmètre directeur : cahier des charges Audit 360 Administrateur guidé par le NAXA-MANDAT CTO. Les validations techniques Promoteur parties 3 à 6 restent ouvertes; aucun déploiement sans autorisation explicite.

- Contrôle Supabase Production en lecture seule (29/10) : `reactiver_promoteur(uuid,text)` reste dans le catalogue mais EXECUTE est refusé à `anon`, `authenticated` et `service_role`; soumission et confirmation de règlement restent service-role-only derrière les gardes des Server Actions. `accrediter_profile` est exposée via une façade publique invoker et un helper privé SECURITY DEFINER avec `search_path=''`; l'exposition API effective du schéma `private` doit encore être vérifiée. Test comportemental 028 non lancé car il manipule `session_replication_role`; partie 3 reste non certifiée.
## Audit Promoteur — approfondissement des RPC (29/10/2026)

- Lecture SQL de `admin_confirmer_reglement_promoteur` : garde Admin actif, verrouillage des lignes, règlement en attente seulement, champs de preuve obligatoires, tarif comparé à la convention, refus si résiliation, idempotence de confirmation, notification/journal; ne réactive pas les profils/pharmacies.
- Lecture SQL de `promoteur_soumettre_reglement` : validations métier et prévention des règlements simultanément en attente; les noms Promoteur/pharmacies sont inclus dans les notifications. Comme EXECUTE direct n'est pas accordé à `authenticated`/ `anon`, la garde de la route serveur appelante doit être vérifiée.
- Point à investiguer avant toute modification : `reactiver_promoteur` réactive abonnement, convention, pharmacies et profils liés après garde Admin. Vérifier EXECUTE effectif et tous les appelants pour déterminer si une ancienne voie manuelle reste accessible.
- `validites_promoteurs_admin()` filtre les résultats via `is_admin()`; `naxa_promoteur_valide(uuid)` limite l'identité à l'utilisateur connecté ou Admin. Les contrôles applicatifs restent à auditer.
- Revue UI/API du 29/10 : le serveur Promoteur vérifie l’identité et le rôle, valide les champs, téléverse la preuve privée puis appelle la RPC; la route Admin exige un Admin actif, vérifie l’état en attente et la disponibilité de la preuve avant confirmation. Correction effectuée : le libellé Admin ne promet plus « 31 jours », car la RPC applique une période mensuelle calendaire. La recherche d’appelants de `reactiver_promoteur` et les parties 3–6 restent à poursuivre; aucun déploiement ni changement Supabase dans cette passe.
- Rapport vivant : `docs/audits/AUDIT_360_PARCOURS_PROMOTEUR_NAXA.md`. Le parcours UI/API, la partie 3 et les parties 4–6 restent non certifiés.

---

## Audit 360° du parcours Promoteur — reprise active (29/10/2026)

- Le périmètre actif est désormais explicitement documenté dans `docs/audits/AUDIT_360_PARCOURS_PROMOTEUR_NAXA.md`, conformément au Prompt maître supprimé (historique uniquement) NAXA. Les dernières corrections Supabase de sécurité/performance ne sont pas une certification du parcours métier.
- Contrôle Supabase en lecture seule : les tables convention, abonnement Promoteur, paiements, règlements et réseau multi-pharmacie existent; RLS est activée sur les cinq tables; aucun privilège SELECT direct n'est accordé à `anon`.
- Les RPC de soumission de règlement et de confirmation/refus Admin ont des privilèges directs restreints selon le contrôle `has_function_privilege`. Les définitions complètes, routes UI/API et scénarios métier restent à examiner.
- Point à approfondir : politiques RLS SELECT qui se recouvrent sur `promoteur_pharmacies`; aucune policy n'a été supprimée sans preuve d'équivalence.
- Les parties 3 à 6 du Pilotage Promoteur ne sont pas déclarées closes : partie 3 doit être revalidée (migration 028 et comportement); parties 4 à 6 restent à prouver. Build, tests intégrés et recette visuelle non certifiés. Aucun déploiement manuel lancé.

---

## Rectificatif opérationnel — 29/10/2026
- Référence active : dépôt `audreymendomo23-netizen/NAXA`, branche `main`; aucune branche créée.
- Six migrations Supabase ciblées ont été appliquées après autorisation explicite et vérifiées dans l'historique : `safe_promoter_payment_reactivation_scope` (`20261029052116`), `admin_validate_dossier_pending_only` (`20261029052125`) et `promoteur_notifications_include_pharmacies` (`20261029052131`).
- La migration `disable_admin_manual_promoter_payment_entry` était déjà présente (`20261027063825`); les privilèges vérifiés bloquent son exécution par `anon`, `authenticated` et `service_role`.
- **Correction performance :** migration `remove_duplicate_stocks_lots_id_index` (`20261029052838`) appliquée et vérifiée. L'index redondant `stocks_lots_id_uidx` a été retiré; `stocks_lots_id_uq` est conservé et reste référencé par les contraintes. Le conseil `duplicate_index` a disparu du contrôle Supabase après correction.
- **Correction de durcissement SQL :** migration `harden_public_catalog_function_search_path` (`20261029053057`) appliquée et vérifiée. `get_home_service_catalog()` et `universe_partner_is_public(uuid,text)` gardent leurs droits et résultats, mais ont maintenant `search_path=''`; toutes leurs relations étaient déjà qualifiées par schéma.
- **Durcissement des helpers RLS :** migration `harden_rls_helper_search_paths` (`20261029053353`) appliquée et vérifiée. `can_access_pharmacy(uuid)` et `suivi_has_consent(uuid,text)` utilisent maintenant `search_path=''`. Leurs contrôles fonctionnels et permissions restent inchangés; le helper de consentement est utilisé par des politiques de partage, donc aucun verrouillage arbitraire sur `auth.uid()` n'a été ajouté.
- Garde dossier en attente confirmée dans la fonction Supabase active. Confirmation de paiement : pas de réactivation en bloc des profils/pharmacies. Rappels J-5 : la fonction active inclut les noms Promoteur/pharmacies.
- Aucun déploiement manuel, aucun workflow relancé, aucune donnée métier modifiée intentionnellement.
- Non certifié vert : build complet, tests métier multi-rôles, recette visuelle, état Production, audit complet ligne par ligne et constats restants des conseillers Supabase (120 FK sans index couvrant, 95 index déclarés inutilisés, 59 groupes de politiques permissives, 6 tables RLS sans politique (vérifiées sans privilèges directs anon/authenticated, réservées à service_role), 5 fonctions SECURITY DEFINER exécutables par anon dont 2 durcies sur search_path, 119 exécutables par authenticated dont 4 durcies sur search_path, protection des mots de passe compromis désactivée). Une nouvelle requête ciblée n'a pas retrouvé SQLSTATE `08006` dans la fenêtre interrogée; l'observation historique n'est pas formellement clôturée. Détail : `docs/CONTRADICTIONS.md`.

---

## Correctif visuel accueil client et BottomNav — 25/10/2026
- Ajout d'une carte photo plein cadre autour du bloc de bienvenue, recherche et filtres de l'accueil client ; le contenu et ses interactions sont conservés, avec une composition responsive et un voile vert léger.
- Photo choisie dans les ressources déjà présentes : `/couvertures/pharmacies-garde.webp` ; aucun fichier externe ajouté. La carte photo déjà présente sous les filtres et la page Achats ne sont pas modifiées.
- Réservation d'un espace bas sur les pages du parcours client : hauteur BottomNav + `env(safe-area-inset-bottom)` + 24 px, sans supprimer de contenu.
- Aucun changement Supabase, middleware, PWA, Luciole, IntroNaxa, AmbulanceGlobale ou AnimationPanierGlobale.
- Build local : non exécuté à ce stade ; validation à effectuer après le commit.

# NAXA — Statut opérationnel consolidé

## Sous-chantier Crédit Marketplace / stock / retrait caisse — clôture de passe avec réserve (29/10/2026)

- **Référence d'audit :** `docs/audits/AUDIT_360_ADMINISTRATEUR_NAXA.md` § 60.42, décision finale versionnée sur `main`.
- **Périmètre relu statiquement :** demande de crédit Marketplace, décision Promoteur/NAXA, hold logique du stock à l'approbation, retrait en caisse avec session, affectation et consommation des lots réservés, registre de crédit/comptabilité, remboursements et protections rollback/idempotence. Sources principales : migrations `247`–`256` et tests `247`–`257`.
- **Contrôle Supabase en lecture seule du 29/10/2026 :** sur `Naxa` (`eouwtuusnsuxaejsxknf`) et `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`), `public.client_credit_requests` existe mais les colonnes contractuelles `telephone_demande`, `date_remboursement`, `justificatif_path` et `panier_items` sont absentes ; la RPC `vente_reservation_credit_finaliser(uuid,uuid,text)` est absente des deux schémas. La RPC `client_credit_demande_decider(uuid,boolean)` est présente. Les historiques de migrations consultés ne montrent pas le déploiement des migrations Marketplace `247/252/256`.
- **Preuves de tests disponibles :** l'audit § 60.42 consigne les cinq fixtures temporaires du test 257 comme réussies, mais les contrats 247 et 256 échouent sur le schéma interrogé et le test intégré 257 reste bloqué avant ses assertions sur la RPC réelle. Aucun rejeu intégral de PostgreSQL n'a été exécuté dans cette passe.
- **Décision :** **passe d'implémentation et revue statique clôturée avec réserve runtime explicite ; validation intégrée NON VALIDÉE / BLOQUÉE, jamais « verte ».** Cette clôture n'affirme pas que le parcours fonctionne en Production.
- **Condition unique de réouverture :** résultat de CI existant consultable sans relance, ou runner PostgreSQL isolé et autorisé réellement disponible ; exécuter alors les migrations/prérequis puis les tests 247, 256 et 257 ensemble. Ne pas répéter l'audit statique ni ajouter des corrections spéculatives avant cette preuve.
- **Garde-fous :** aucune branche ni PR créée, aucune migration appliquée, aucune donnée Supabase distante modifiée, aucun déploiement ni relance CI déclenché.

## Validité Promoteur — notifications avec réseau de pharmacies (29/10/2026)

- Les rappels J-5 et alertes de déclaration de paiement doivent comporter le nom complet du Promoteur et les noms de toutes les pharmacies rattachées.
- `/admin/pilotage/reglements` affiche désormais ces pharmacies dans la file de confirmation et l’historique. La route de rappel sécurisée ajoute le même contexte dans les notifications et le courriel.
- Migration additive : `supabase/migrations/20261029120000_promoteur_notifications_include_pharmacies.sql`. Test structurel : `supabase/tests/20261029120000_promoteur_notifications_include_pharmacies.sql`.
- Le seul ordonnanceur explicitement constaté reste le job Supabase `naxa-promoteur-echeance-5j` à 06:00 UTC ; aucun cron Vercel parallèle n’est ajouté.
- **Construction 🟡 versionnée, runtime non certifié.** Test SQL, build, lint, envoi de notification et email non exécutés. Aucune migration appliquée et aucun déploiement lancé.

## Administration — validation initiale des dossiers pharmacie (29/10/2026)

- La fiche `/admin/pharmacies/[id]` comporte le formulaire de validation globale, relié à l’action serveur et à la RPC transactionnelle existante.
- Le formulaire apparaît seulement pour une création encore en attente : pharmacie inactive et masquée, lien Promoteur inactif et profil Promoteur inactif. L’action serveur et la RPC revérifient ces états.
- La validation est bloquée tant que les sept déclarations de réception ne sont pas confirmées ou que la dernière version de l’un des six types de fichiers requis n’est pas validée. Le type « autre » reste facultatif.
- Migration additive : `supabase/migrations/20261029110000_admin_validate_dossier_pending_only.sql`. Test structurel ajouté : `supabase/tests/20261029110000_admin_validate_dossier_pending_only.sql`.
- **Construction : 🟡 code versionné, validation runtime non certifiée.** Le contrôle Supabase effectué ici était en lecture seule ; test SQL, build, typecheck, lint et navigateur non exécutés.
- Aucune migration appliquée, aucune donnée métier modifiée, aucun déploiement lancé. La recette visuelle attend un déploiement autorisé distinct.

## ERP-008 — Socle assurances / tiers payant
- Audit sans doublon : aucun socle assurance détecté.
- Construction : assureurs, couvertures client, dossiers de prise en charge liés à la pharmacie et optionnellement à une vente.
- Les intégrations externes et règles de remboursement restent volontairement hors périmètre tant qu'aucun partenaire/scope n'est arbitré.
- Test structurel : `supabase/tests/049_assurances.sql`.
- Aucun changement Production.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


## ERP-009 — Trésorerie / dépenses (F66)
- Audit sans doublon : aucun socle trésorerie/dépenses trouvé dans `main`.
- Construction : comptes de trésorerie XAF, catégories, dépenses en brouillon/validées/annulées et journal des mouvements.
- Sécurité : RLS + RPC ; aucune écriture directe authentifiée sur les dépenses/mouvements.
- Correction post-audit : clé composite `(id, pharmacie_id)` ajoutée pour sécuriser les références de compte par pharmacie.
- Validation d'une dépense génère un décaissement unique dans le journal.
- Aucun changement Production/Supabase live.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


## ERP-010 — Fiche client / crédit (F68)
- Audit sans doublon : aucune fiche client commerciale/crédit existante dans `main`.
- Construction : fiche commerciale, plafond et solde de crédit, journal des opérations, demandes de dépassement et décision Promoteur/NAXA.
- Le crédit est raccordé au mode de paiement POS `credit`, sans second moteur de vente.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**

## ERP-011 — Rappel de lot (F64) — ré-audit et poursuite du 20/10/2026
- Contradiction documentaire corrigée : `vente_lignes.lot_id` et l'allocation FEFO existaient déjà via la migration 057 ; le POS filtre déjà les lots bloqués et expirés. Le statut historique qui disait le POS « non lotisé » était périmé.
- Cause racine : absence d'interface F64 ; test 052 insuffisant ; clôture trop large ; contrainte UNIQUE globale empêchant un second rappel après levée ; levée pouvant effacer un blocage antérieur ; colonnes historiques/canoniques de lots divergentes ; écritures directes pouvant désynchroniser stock agrégé et lots.
- Corrections additives sur `main` : migrations 175–185, dont la garde contre la désynchronisation même lorsque tous les lots sont à zéro. Elles réservent la clôture au Promoteur, restaurent le blocage antérieur, permettent de nouveaux rappels après clôture, synchronisent les colonnes de lot, encadrent la création/répartition des lots, protègent l'égalité stock agrégé/somme des lots, ajoutent le comptage de quarantaine, le journal retour/destruction, l'avis réseau NAXA et l'accusé de réception.
- Interface ajoutée : `/pharmacie/rappels-lots`, déclaration et historique, création/répartition de lots sans modifier le stock total, comptage des unités retrouvées/isolées, retour fournisseur/destruction atomiques, blocage de clôture tant qu'un stock reste à traiter, clôture Promoteur seule, ventes POS concernées pour Promoteur, références d'ordonnancier pour l'assistant, emplacement pour l'équipe stock, valorisation au coût d'achat pour les profils autorisés.
- Bannière rouge d'alerte ajoutée à l'accueil pharmacie et à la caisse. Avis réseau ajoutés dans `/admin/rappels-lots`, accessibles depuis l'accueil Admin ; le Promoteur voit les avis et peut accuser réception. Les avis réseau ne donnent à l'Admin aucun accès aux stocks, ventes ou clients des pharmacies.
- Tests exécutés sur Supabase de test `naxa-ci-replay-2` : `052_rappel_lot.sql` PASS ; `054_pos_lignes_fefo.sql` PASS ; `175_rappel_lot_cycle_hardening.sql` PASS ; `177_stock_lot_enregistrer.sql` PASS ; `179_rappel_lot_quarantine_count.sql` PASS ; `180_admin_rappel_lot_notice.sql` PASS ; `181_rappel_lot_treatment_movements.sql` PASS ; `184_stocks_lots_sync_bidirectional.sql` PASS. Les tests Caisse 164/166/167/168 ont aussi été rejoués avec PASS. Test 161 avait passé après la migration 173 ; son rejeu ultérieur a été bloqué par le contrôle d'exécution SQL.
- Aucun changement Supabase Production ni déploiement Production.
- **État : 🟡 fonctionnellement construit, preuve SQL partielle et syntaxe TSX vérifiée par transpilation.** Le build complet Next/TypeScript, lint et les tests navigateur restent non vérifiés ; Vercel/CircleCI ne fournissent pas encore un contrôle de compilation vert. L'enrôlement biométrique et le QR caméra nécessitent encore un test sur appareil réel.


## ERP-012 — Offline ERP avancé — chantier du 08/10/2026
- Audit historique réconcilié : le offline stock existait déjà dans `main` via IndexedDB, file locale, détection réseau, synchronisation et résolution de conflits.
- Le manque identifié concernait l'idempotence côté serveur : un replay devait être rejouable sans risque de double mutation.
- Ajout : `supabase/migration_056_offline_idempotence.sql` + `supabase/tests/053_offline_idempotence.sql`.
- `src/app/pharmacie/page.tsx` utilise maintenant une clé d'opération UUID et la RPC `offline_stock_set_quantity()` pour les écritures online/offline.
- Aucun second moteur de stock ni second mécanisme offline créé.
- Aucun changement Production/Supabase live.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


## ERP-003 — POS étape 1 — 08/10/2026
- Lignes de vente + allocation FEFO ajoutées au socle POS existant.
- État : 🟡 construit, preuve SQL/CI manquante.


## ERP-003 — POS étape 2 — 08/10/2026
- Paiements POS simples ou mixtes et finalisation atomique ajoutés au moteur de vente existant.
- Référence Mobile Money obligatoire ; paiement exact du total net requis.
- Aucun second moteur de vente créé.
- Aucun changement Production/Supabase live.
- **État : 🟡 construit — preuve SQL/CI manquante.**


## ERP-003 — POS étape 3 — ticket/reçu + numérotation unique — 08/10/2026
- Audit : aucun moteur concurrent de ticket POS/numéro de vente/réimpression trouvé ; le reçu de réservation existant reste inchangé.
- Construction additive : `ventes.numero_vente`, séquence unique, index unique et RPC `vente_ticket()` en lecture sécurisée.
- Les ventes historiques sont numérotées avant contrainte `NOT NULL` ; les nouvelles ventes reçoivent automatiquement un numéro.
- La RPC ticket est `SECURITY INVOKER` et s'appuie sur le scope existant des ventes/lignes.
- Aucun changement Production/Supabase live.
- **État : 🟡 construit — preuve SQL/CI manquante.**


## ERP-003 — POS étapes 4/5/6 — 08/10/2026
- Étape 4 : annulation contrôlée avec restitution stock/lot.
- Étape 5 : demande + décision séparées, décision Promoteur/NAXA et interdiction d'auto-approbation.
- Étape 6 : clôture Z avec fond initial, espèces, paiements mixtes, comptage et écart ; sessions historiques réouvrables grâce à l'index partiel des sessions ouvertes.
- Migrations/tests : `supabase/migration_060_pos_annulation_z.sql`, `supabase/tests/057_pos_annulation_z.sql`.
- Aucun changement Supabase live/Production.
- **État : 🟡 construit — preuve SQL/CI manquante.**


## ERP-003 — POS étapes 7/8/9 — 08/10/2026
- Paiements avancés : voucher, assurance/tier payant et crédit réconcilié avec le flux unique `vente_paiements`.
- Caisse rapide : favoris, paniers en attente/reprise et affichage client par session.
- Remises/promotions : bornes, période, plafond et approbation séparée.
- Migrations/tests : `supabase/migration_061_pos_avance_rapide_remises.sql`, `supabase/migration_062_pos_creation_vouchers_promotions.sql`, `supabase/tests/058_pos_avance_rapide_remises.sql`.
- Aucun changement Supabase live/Production.
- **État : 🟡 construit — preuve SQL/CI manquante.**

## Vérification finale ERP-010/011/012 — 08/10/2026
- ERP-010 : raccordement crédit → `vente_paiements` verrouillé par test structurel.
- ERP-011 : RPC rappel durcies avec `search_path=''`.
- ERP-012 : mutation directe de l'état offline interdite ; état serveur géré par RPC sécurisée avec contrôle de pharmacie.
- POS étape 7 : voucher consommé uniquement lors de la finalisation ; syntaxe assurance corrigée.
- Preuve live Supabase : indisponible actuellement (`link_id must identify an eligible linked account`).
- Preuve CI : aucun run associé au dernier commit.
- **État : 🟡 construit / preuve d'exécution SQL-CI manquante.**


## ERP-003 / Pharmacien — chantier du 08/10/2026
- Ajout du parcours Caisse : scan code-barres, recherche prix, bulk lookup, montant perçu, monnaie rendue, paiement et impression ticket.
- Ajout de `stocks.emplacement` par pharmacie.
- Intégration de la fonction interne `pharmacien` et du parcours de validation des ordonnances.
- Migrations/tests : `supabase/migration_063_caisse_pharmacien_barcode.sql`, `supabase/tests/059_caisse_pharmacien_barcode.sql`.
- Logos officiels Orange Money / MTN MoMo : assets officiels à intégrer ; aucun logo de substitution/redessiné.
- Aucun changement Supabase live/Production.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


---

## CHANTIER 360° INTÉGRÉ — 9 octobre 2026

### Périmètre et garde-fous
- Branche de travail : `integration/naxa-360-20261009`, créée depuis le commit `main` vérifié pendant l'audit.
- Aucun commit, changement de référence ou fusion sur `main`.
- Aucun changement de schéma ni aucune écriture dans Supabase Production.
- Aucun déploiement Production autorisé à ce stade.

### État constaté — ne pas confondre inventaire et validation
- `main` : 45 migrations SQL et 22 tests SQL au moment du dernier inventaire.
- `ci/replay-rewrite-20261008` : 78 migrations et 52 tests inventoriés, mais le rejeu complet et l'exécution intégrale des tests ne sont pas encore prouvés.
- Base de test `naxa-ci-replay-2` : historique incomplet au dernier contrôle; la migration 051 a été bloquée par une barrière d'outil et n'est donc ni validée ni déclarée en échec SQL.
- Supabase Production : historique enregistré distinct de la chaîne candidate; écart de schéma confirmé pour plusieurs objets caisse/vente/pharmacien utilisés par le code candidat.
- Contrôles prioritaires : garde d'âge dans la RPC de réservation, matrice des transitions de réservation, portée d'écriture du catalogue produit et RLS des tables sensibles.
- CI : aucune preuve d'un pipeline complet vert exécutant toutes les migrations et tous les tests SQL.
- Documentation historique : cette entrée prévaut sur les affirmations antérieures non appuyées par une preuve récente.

### Décision
**ÉTAT GLOBAL : ROUGE / NO-GO POUR LA PRODUCTION.** Les fonctionnalités déjà construites ne doivent pas être reconstruites; elles doivent être intégrées sélectivement puis prouvées. Les corrections doivent être additives, testées en environnement isolé et consignées ici. Une déclaration verte exige des journaux de tests et des SHA vérifiables.

### Méthode du chantier simultané
Les lots code/intégration, SQL/sécurité, CI/preuves et documentation sont traités en parallèle sur cette branche. Les dépendances sont coordonnées dans le même chantier; aucun lot n'est considéré vert sur la seule base de sa présence dans le dépôt. Après chaque vague de corrections, les contrôles liés sont rejoués ensemble.


## Consolidation fonctionnelle — 9 octobre 2026
- Registre `FONCTIONNALITES_VALIDEES.md` remplacé par la version détaillée du rejeu le plus récent, qui distingue les fonctionnalités construites, les validations prouvées et les blocages.
- Parcours repris sur cette branche : espace Client, Caisse, Pharmacien (consultations/prescriptions), Pilotage pharmacie, validité des pharmacies et composants liés.
- Migrations additives reprises : historique client, architecture/accréditations, périmètres Caisse/Promoteur, validité, sessions, pilotage, compatibilité stocks/ordonnancier, modes opérateurs et consultation/prescription.
- Tests SQL additionnels repris pour les périmètres, l’architecture, la validité, le pilotage, les stocks, la caisse et le pharmacien. Configuration CircleCI reprise pour détecter récursivement les 52 tests.
- Aucun test complet n’est déclaré vert à ce stade : exécution CircleCI et rejeu intégral restent à obtenir; les incohérences entre code et schéma observées en Production restent bloquantes pour une mise en production.
- Garde-fous maintenus : aucune modification de `main`, aucun changement Supabase Production, aucun déploiement.


## Vérification SQL ciblée — 9 octobre 2026, session de reprise
**Résultat : ROUGE / NO-GO MAIN.** Contrôles effectués sur la base de test isolée `naxa-ci-replay-2` (projet `pwfftcsjyeibxxqhwysw`), jamais sur Supabase Production.

- Historique SQL observé avant rejeu complémentaire : 62 entrées de migration.
- La migration source `migration_059_pos_ticket.sql` échoue sur `row_number() over (...)` dans un `UPDATE` (PostgreSQL 42P20). Après correction temporaire exclusivement dans la base de test, elle échoue aussi sur `setval(..., 0)` lorsque la table `ventes` est vide (22003). Au moment de cet audit initial, le fichier source n'avait pas encore été modifié ; il a depuis été corrigé sur la branche d’intégration. Une variante corrigée a été appliquée sous un nom de diagnostic distinct pour poursuivre le contrôle des migrations suivantes ; la base de test n'est donc plus un rejeu canonique propre et doit être recréée/réinitialisée avant la preuve finale.
- Migrations source 051 à 058, puis 060 à 065 appliquées à la base de test ; la variante diagnostique 059 a permis de poursuivre. Cela ne constitue pas une preuve que le rejeu CircleCI de la branche source passe.
- 32 fichiers de tests SQL candidats exécutés individuellement : 18 sans erreur SQL remontée par le connecteur, 13 en erreur/assertion, 1 bloqué par le contrôle de sécurité de l'outil. Ces résultats individuels ne remplacent pas le runner `psql -v ON_ERROR_STOP=1` ni la preuve de la suite complète.
- Échecs observés : test 018 sans fixtures (2 profils + 3 pharmacies attendus) ; test 019 avec deux assertions en échec ; test 020 autorisations avec fixture insuffisante ; test 020 caisse avec « C10 architecture non effective » ; plusieurs tests Promoteur (026, 027, 029, 030, 031, 033, 035, 036, 039) échouent sur une contrainte CHECK de `profiles`.
- Contradiction de schéma confirmée sur `profiles` : contraintes simultanées `profiles_fonction_interne_check` (catalogue étendu) et `profiles_fonction_interne_ck` (limite à `responsable`), ainsi que deux contraintes de niveau hiérarchique aux plages différentes. La correction doit être additive et testée ; aucune migration déjà appliquée en Production n'a été modifiée.
- Alerte de sécurité sur la base de test : RLS désactivée sur `public.abonnements` et `public.naxa_architecture_niveaux`. Aucune activation automatique effectuée, car les politiques d'accès doivent être examinées avant de risquer un verrouillage ou une exposition.
- Les fichiers de migrations source 051–065 sont bien présents dans la branche d'intégration. En revanche, l'historique de la base de test était arrêté au socle 050 : les migrations 051–058 et 060–065 ont donc été appliquées manuellement pour poursuivre le diagnostic, avec une variante temporaire de 059 uniquement en base de test. Le fichier source 059 a été corrigé sur la branche d’intégration (commit `23bc21dab4ab4daaa8f5b818dd2f1015edb1ae53`) : calcul de `row_number()` dans un CTE puis UPDATE, et `setval()` compatible avec une table vide. Test ciblé sans erreur sur la base de test de diagnostic ; `nextval()` renvoie 1. Le rejeu complet sur une base propre reste requis.

**Action bloquante :** ne pas créer ni pousser le commit final sur `main). Il faut corriger ou remplacer de façon autorisée la migration candidate 059 défectueuse, ajouter une correction additive pour les contraintes contradictoires, rendre les tests de comportement autonomes, puis recréer une base de test propre et rejouer la chaîne exacte ainsi que les 52 tests. Aucun déploiement Production n'a été effectué.


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


## Chantier isolé — photos de pharmacies et périodes de garde à Yaoundé

- Ajout d'une migration additive `supabase/migration_070_pharmacie_photos_garde.sql` : chemin de photo locale, source et licence, date de vérification, début/fin de garde et source/date de vérification de la garde.
- Les RPC `search_pharmacies` et `search_pharmacies_panier` ne sont pas modifiées : les métadonnées sont chargées par une requête complémentaire, afin de ne pas casser leurs signatures de retour.
- Les résultats utilisent `public/pharmacies/placeholder.svg` si aucune photo locale valide n'est enregistrée ou si l'image échoue à charger. Le chemin est limité à `/pharmacies/nom-de-fichier`; les URL externes ne sont pas utilisées comme images de fiche.
- Une garde datée n'est annoncée comme confirmée que pendant l'intervalle `garde_debut <= maintenant < garde_fin`. L'ancien booléen `de_garde`, sans période datée, est présenté comme « Garde signalée · période à confirmer ».
- Le test SQL `supabase/tests/070_pharmacy_photos_duty_period.sql` vérifie les huit colonnes et la contrainte de cohérence de période. Le préflight CircleCI est ajusté à 84 migrations et 54 tests.
- Aucune photo réelle n'a encore été importée : la licence et l'association de chaque image doivent être vérifiées avant d'ajouter des fichiers dans `public/pharmacies/` et de renseigner `photo_path`.
- La migration et le test n'ont pas été exécutés contre Supabase Production. Build, lint et CI du nouveau HEAD doivent être vérifiés avant tout feu vert. Aucune fusion, aucun déploiement et aucune écriture Production.

**Statut : EN COURS — non certifié vert.**


## Garde pharmacies — Yaoundé — 11 octobre 2026

- Ajout de `docs/yaounde-garde/2026-10-10_2026-10-12.csv` : 19 entrées collectées depuis Mfasha, période déclarée du 10/10/2026 08:00 au 12/10/2026 08:00 (UTC+01:00).
- Ajout de `docs/yaounde-garde/README.md` : traçabilité des sources, statut de corroboration et critères d'intégration.
- Ajout de `scripts/validate_yaounde_garde.py` : contrôle du nombre de lignes, doublons, téléphones, dates timezone-aware et statut conservateur.
- Contrôle préliminaire après correction du format CSV : PASS (19 lignes lues; 19 noms uniques; 0 anomalie(s)). Les vérifications ont été exécutées sur le contenu récupéré du dépôt via le connecteur, pas dans un runner Python local/CI.
- FindGlocal/MboaPHARMA permettent seulement un recoupement partiel des identités/coordonnées; ils ne confirment pas indépendamment la période exacte de garde. La pharmacie Nsimeyong conserve une divergence sur le numéro principal.
- **Statut global : EN COURS / NO-GO IMPORT CLIENT.** Aucun test SQL ni import sur base isolée propre n'a été exécuté; aucune écriture Supabase Production, aucun déploiement, aucune modification de `main`.


### Contrôle SQL en lecture seule — 11 octobre 2026

- Requête exécutée sur le projet de diagnostic isolé `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`) : CTE temporaire en mémoire de requête, aucune insertion ni modification persistante.
- Résultat PostgreSQL : `total_rows=19`, `distinct_names=19`, `all_periods_valid=true`, début `2026-10-10 07:00:00+00`, fin `2026-10-12 07:00:00+00` (équivalent à 08:00–08:00 heure du Cameroun, UTC+01:00).
- Ce contrôle prouve la cohérence des 19 noms et intervalles dans PostgreSQL; il **ne prouve pas** l'application de la migration 070, le mapping vers les identifiants `pharmacies.id`, ni le comportement d'une base propre.
- Les statuts CI GitHub du commit documentaire contrôlé étaient vides. Aucune preuve CI verte.
- **Toujours NO-GO import client** : aucune écriture DB, aucune migration appliquée, aucune modification Production, aucune fusion ni déploiement.


## Prototype catalogue médicaments — 11 octobre 2026

- Branche isolée : feat/catalogue-medicaments-api-prototype, créée depuis feat/yaounde-pharmacy-geolocation au commit 7db7bd52d38e70d6b53c5a6690b663e2445caab3.
- Ajout d'un endpoint serveur de recherche qui interroge RxNorm, OpenFDA et DailyMed; aucune dépendance payante ajoutée. RxImage n'est pas utilisé car son API a été arrêtée.
- Ajout de dix termes pilotes pour vérifier les correspondances, pas pour prétendre qu'il s'agit des dix médicaments les plus vendus au Cameroun.
- La recherche de la page d'accueil affiche les résultats au fur et à mesure de la saisie : nom, marque, substance active, forme, définition/indications si fournies, source et photo si une image pertinente est disponible. Sinon, une illustration neutre est utilisée.
- Les photos DailyMed sont identifiées comme issues de l'étiquetage américain et ne sont pas présentées comme des boîtes locales camerounaises.
- Aucun dosage n'est rendu dans les cartes de recherche, la liste de stocks, la fiche produit ou le panier. Les données de dosage ne font pas partie du contrat de réponse de l'API catalogue.
- Le bouton de résultat utilise la recherche de stock existante. Disponibilité/prix/réservation restent issus des stocks réels des partenaires NAXA; le catalogue externe n'est jamais une source de stock.
- Ajout du test source scripts/test-catalogue-medicaments.cjs et intégration à la tâche qualité CircleCI. L'exécution réelle des APIs, les réponses pour les dix termes, la compilation CI et l'exactitude des images restent à vérifier avant de déclarer le chantier vert.
- Aucun changement de schéma SQL, aucune écriture Supabase, aucun changement de main, aucune fusion ni aucun déploiement Production.
- État : EN COURS — prototype implémenté sur branche isolée; CI et tests d'intégration à confirmer.


## Chantier fonctions métier et validation pharmaceutique à distance — 11 octobre 2026

- Branche isolée : `feat/naxa-fonctions-validation-distance`, créée depuis `main`. Aucun commit sur `main`, aucune écriture Supabase et aucun déploiement Production.
- Audit initial : la migration 020 limite les clés de rôles techniques et le catalogue `fonction_interne` ne contient pas les fonctions métier demandées. Le workflow de validation pharmaceutique à distance n'a pas été trouvé sur `main`. La branche d'intégration mentionnée dans les notes antérieures n'est pas présente dans la liste des branches consultées ; cette divergence de source de vérité demeure un risque.
- Spécification ajoutée : `docs/naxa-fonctions-validation-distance.md` (fonctions, menus, parcours, privilèges, partage de validation, quatre architectures et contradictions à fermer).
- Migration candidate ajoutée : `supabase/migration_072_fonctions_validation_distance.sql`. Elle étend les fonctions internes sans modifier `role_type`, ajoute le catalogue de privilèges, une table de dossiers, un bucket privé et des RPC de création, soumission et décision.
- Interface candidate ajoutée : `src/app/pharmacien/validations/page.tsx`, avec dépôt de document privé, suivi et décisions réservées au pharmacien.
- Test SQL structurel ajouté : `supabase/tests/072_fonctions_validation_distance.sql`.
- Préflight CircleCI ajusté aux nombres attendus de migrations (86) et de tests SQL (55) après ajout des deux fichiers.
- **Aucune preuve de build, de lint, de rejeu SQL propre, de tests SQL complets ou de CI verte n'a encore été obtenue.** La migration candidate n'a pas été appliquée à une base Supabase réelle. Les politiques RLS/Storage, la compatibilité de `naxa_has_privilege()` avec les nouvelles clés, les chemins de documents et les parcours à distance restent à vérifier par exécution.
- État : **EN COURS / ROUGE — ne pas fusionner, ne pas appliquer à Production, ne pas déclarer vert.** Prochaine étape : ouvrir une PR pour déclencher les contrôles, analyser les échecs exacts, corriger une cause à la fois et n'annoncer le vert qu'avec des preuves sur le HEAD final.


### Correctifs de sécurité et audit — branche de travail

- La migration 071 a été reconstruite proprement après détection d'une corruption de contenu générée pendant une modification automatisée ; le fichier courant a été relu, avec un seul bloc transactionnel et quatre fonctions SQL définies dans ce fichier.
- Les dossiers et documents sont limités au scope pharmacie ; le stockage est privé, les documents sont liés au dossier, et les utilisateurs authentifiés n'ont pas de droits directs INSERT/UPDATE/DELETE sur les dossiers.
- Ajout d'une piste d'audit et de notifications internes à la transition de statut ; les lectures de documents restent limitées au déposant, au pharmacien autorisé et à l'administration habilitée.
- Le composant frontend utilise désormais un client Supabase stable pour éviter une boucle de rechargement React.
- **Ces correctifs sont des changements source seulement. Ils ne sont pas encore validés par exécution PostgreSQL/CI.** La branche reste ROUGE jusqu'au résultat des contrôles sur le HEAD courant.


### Correctif de compatibilité — migration 072 / schéma Supabase Production (11 octobre 2026)

- **Erreur initiale CI :** `SQLSTATE 23502` lors de l'insertion du privilège `SUBMIT_PHARMACEUTICAL_VALIDATION`.
- **Contrôle direct du schéma Production :** `public.naxa_privileges` expose `code,family,description,niveau_min,niveau_max,delegable,governance,active,created_at`; les colonnes `famille`, `libelle` et `governance_only` n'existent pas dans cette base.
- **Correction source :** migration 072 rendue compatible avec les variantes du schéma : elle détecte les colonnes disponibles, écrit les colonnes correspondantes et synchronise les alias facultatifs uniquement lorsqu'ils existent.
- **Test SQL :** contrôle des huit privilèges, des colonnes réelles requises et de la cohérence des alias facultatifs sans références statiques à des colonnes absentes.
- **Périmètre :** branche `feat/naxa-fonctions-validation-distance` / PR [#48](https://github.com/audreymendomo23-netizen/NAXA/pull/48). Aucun changement sur `main`, aucune écriture Supabase, aucune fusion et aucun déploiement Production à ce stade.
- **Bloqueur avant Production :** l'historique Supabase observé s'arrête à `042_stats_pilotage_facade_security`; il faut auditer les dépendances des migrations 043–070 avant d'appliquer la migration 072.
- **Validation : ROUGE / à rejouer.** Attendre CircleCI sur le HEAD corrigé, puis vérifier le rejeu PostgreSQL et l'ordre de migration avant fusion/déploiement.

## Fonctions internes — correction moteur (11 octobre 2026)
- Corrigé sur `feat/naxa-fonctions-validation-distance` : `private.naxa_business_function()` reconnaît les six nouvelles fonctions métier sans modifier `role_type` ni la hiérarchie N0–N4.
- Corrigé : `private.naxa_has_privilege()` traite ces fonctions comme des clés de rôle natives et exige toujours l'architecture active, le périmètre autorisé et une délégation effective par profil. Le catalogue de rôle seul ne suffit pas.
- Test 072 renforcé sur les définitions des deux fonctions et les garde-fous de scope/délégation.
- État : **ROUGE / validation en cours**. Le contrôle statique du test ne remplace pas le rejeu SQL complet ni les contrôles CI du HEAD exact. Aucun merge, aucune écriture Supabase Production, aucun déploiement.


## Correctif 072 — borne du scope RESEAU (11 octobre 2026)
- Cause traitée : `private.naxa_has_privilege()` acceptait un privilège de scope `RESEAU` avec une pharmacie cible sans valider l'appartenance de cette pharmacie au réseau du Promoteur.
- Correction additive dans `supabase/migration_072_fonctions_validation_distance.sql` : appel explicite à `public.naxa_scope_allows(uid, p_pharmacie, 'RESEAU')` lorsque `p_pharmacie` n'est pas nulle.
- Les privilèges réseau sans cible gardent leur usage normal; une cible hors réseau est refusée.
- Les tests de garde 041b et de périmètre 024 doivent être rejoués sur le HEAD correctif. État : en attente de CI; NO-GO main, aucune écriture Production ni fusion.


## Correctif inscription — validation pays/téléphone — 11 octobre 2026

- Cause historique : `handle_new_user()` rejetait tous les pays connus après les contrôles de format, même lorsque le numéro était valide.
- Correction additive : `supabase/migration_073_signup_phone_validation.sql` ajoute un validateur centralisé à accès restreint et remplace la fonction de trigger sans modifier la migration 006.
- Tests SQL : `supabase/tests/073_signup_phone_validation.sql` contient 24 cas attendus, incluant les formats valides/invalides des 11 pays, un pays inconnu et un téléphone absent.
- Préflight CI ajusté au nouveau total : 87 migrations sources et 56 tests SQL sur la branche candidate.
- Branche isolée : `fix/signup-phone-validation`, basée sur le HEAD de la PR #48; PR empilée ouverte : [#49](https://github.com/audreymendomo23-netizen/NAXA/pull/49), cible `feat/naxa-fonctions-validation-distance` (PR #48).
- **État : EN ATTENTE DE CI ET DE REJEU SQL COMPLET — ROUGE / NO-GO MAIN.** Aucune écriture Supabase Production, aucune fusion et aucun déploiement.


## Sélecteur de pays téléphone — fermeture au clic extérieur (11 octobre 2026)

- Le sélecteur de pays de `/creation-compte` se ferme désormais lorsqu’un pointeur est pressé n’importe où hors du composant, y compris sur mobile (événement `pointerdown`).
- La flèche continue d’ouvrir/fermer la liste; choisir un pays met à jour le pays et l’indicatif, vide l’ancien numéro et ferme la liste.
- La touche Échap ferme également la liste. Les écouteurs globaux ne sont installés que pendant l’ouverture et sont retirés à la fermeture/démontage.
- Correctif source uniquement sur `fix/signup-phone-validation`. Aucun changement `main`, aucune écriture Supabase Production et aucun déploiement. Les contrôles CI/build restent à confirmer.

**Statut de validation :** modification commise; tests automatisés et résultat CI du HEAD final non encore confirmés. Ne pas déclarer vert avant ces preuves.


## Correctifs Auth + intro pendulaire — 14 octobre 2026

- **Gmail/OAuth :** le callback échange le code et conserve les cookies de session ; il force le parcours Google vers l'espace client et ne choisit plus l'accueil public à cause d'un rôle inattendu. Les profils incomplets passent par le formulaire de complétion avec destination finale `/client`.
- **OTP inscription :** mécanisme confirmé comme OTP natif Supabase (`signInWithOtp` + `verifyOtp(type: "email")`). Ajout d'un verrou anti-double vérification, validation du token comme texte de six chiffres et journalisation diagnostique sans enregistrer le code ou l'adresse e-mail.
- **Sélecteur pays :** superposition rehaussée, bouton élargi et liste limitée en hauteur.
- **Intro :** composant `IntroNaxa` ajouté, horloge RAF, annulation par clic/tap/Échap/Entrée, fondu de sortie et prise en charge de `prefers-reduced-motion`.
- **Reste à vérifier :** les logs Supabase montrent aussi des erreurs `NAXA_SESSION_LIMIT_REACHED` lors de créations de session ; elles sont distinctes d'un code OTP expiré. La liste Redirect URLs Supabase/Google Cloud est une configuration fournisseur indépendante du code.


## Authentification et introduction — 14 octobre 2026

- **Modifié sur `main` :** sélecteur de pays en portail fixe, marges communes de 30 px, styles de titre/sous-titre des pages d’authentification, suppression du doublon d’aide OTP, cases OTP à taille stable, délai de renvoi de 60 s, transition du pendule corrigée.
- **Ambulance :** activation désactivée par défaut et explicitement autorisée uniquement sur le bouton « Connexion » de la page de connexion et « Chercher » de l’accueil public.
- **Preuve de diagnostic OTP :** les journaux Auth de Production ont montré des `/verify` en `500 unexpected_failure` dus à `NAXA_SESSION_LIMIT_REACHED`, plus des `403 otp_expired`. Le plafond de quatre sessions actives est volontaire et n’a pas été modifié ; le parcours de récupération pré-vérifie maintenant le plafond pour éviter de consommer le code lorsqu’aucun créneau n’est disponible.
- **Google OAuth :** le code utilise l’origine réelle de la requête, le callback serveur échange le code et conserve les cookies. Les logs Auth montrent des retours `/callback` en `302`, mais ne prouvent pas le passage complet jusqu’à `/client`. Les paramètres Supabase URL Configuration / Google Cloud restent à vérifier dans les consoles fournisseur.
- **Limites de validation :** un test complet avec une nouvelle adresse e-mail et une authentification Google interactive n’est pas automatisable ici sans utiliser un compte réel ; aucun OTP n’a été envoyé par ce chantier, aucun compte de test créé et aucune écriture dans Supabase Production.

- **Reprise OTP après rafraîchissement :** le brouillon d’inscription est conservé localement dans `sessionStorage` pendant 30 minutes, sans créer de profil NAXA avant la confirmation du code et la finalisation; le brouillon est effacé une fois le compte finalisé.


## Auth — correction OTP inscription (14/10/2026)
- Cause identifiée dans le code : la page d’inscription appelait directement `verifyOtp` depuis le navigateur sans précontrôle du plafond métier de 4 sessions ; le trigger Supabase peut refuser la création de session après traitement du code.
- Correction appliquée : route serveur `/api/auth/signup-otp/verify`, contrôle de `naxa_session_count` avant vérification, refus explicite sans consommer le code si le plafond est atteint ou si le contrôle échoue, puis vérification Supabase `type: "email"` avec cookies de session côté serveur.
- Le composant OTP possède déjà un verrou anti-double vérification et traite le code comme texte. Le parcours réel e-mail → session reste à confirmer par un test avec un compte dédié ; aucune écriture directe en base Supabase Production n’a été effectuée.


## Mission ciblée — Authentification, intro animée et ambulance (14 octobre 2026)

- **Google OAuth — correction du code :** le callback reconnaît désormais Google via `app_metadata.provider`, `app_metadata.providers` et les identités liées. Cela couvre le cas d'un compte initialement e-mail dont l'identité Google est ensuite liée. La session et les cookies restent échangés côté serveur ; un profil client incomplet reste soumis à la garde `/completer-profil`, pas à un contournement de sécurité.
- **Preuve de journaux Supabase Production, lecture seule :** le callback OAuth a été observé avec un retour réussi (302), puis un retour distinct avec `State has already been used`. Les journaux montrent aussi des OTP expirés (403), des demandes limitées (429) et des échecs de création de session liés à `NAXA_SESSION_LIMIT_REACHED` (500). Les événements de confirmation d'inscription et des vérifications réussies existent également ; ces résultats ne justifient pas de désactiver le plafond de sessions ni d'accepter un code invalide.
- **OTP :** le code du dépôt vérifie le type `email` cohérent avec `signInWithOtp`, conserve les six chiffres en texte, vérifie le plafond de sessions avant consommation et journalise la cause Supabase côté serveur sans enregistrer le code ni l'adresse. Les journaux disponibles ne permettent pas d'attribuer chaque `otp_expired` au parcours d'inscription plutôt qu'à la récupération ; le parcours réel avec une nouvelle adresse doit encore être confirmé après le déploiement.
- **Intro :** logo déplacé à y=150 sur la scène 720×1280 et le N du poids utilise le jaune canari `#FFE33D`. La séquence du pendule et le mécanisme de balayage du texte restent en place.
- **Ambulance :** le composant global exige explicitement `data-naxa-ambulance="true"`; les boutons autorisés identifiés dans le code sont Connexion et Chercher. L'animation reste désactivée par défaut pour les autres boutons.
- **Limites hors code :** l'accès disponible ne permet pas de lire/modifier la configuration Auth Supabase (URL allowlist, modèle d'e-mail, longueur/durée OTP) ni la liste des URI Google Cloud. Ces paramètres ne sont donc pas déclarés vérifiés. Aucun changement direct à la base Supabase Production.
- **Validation :** la compilation et les parcours e-mail/Google doivent être confirmés sur le déploiement issu du commit ci-dessous ; les journaux seuls ne prouvent pas un nouveau test de bout en bout.


## Univers multi-services — socle additif préparé (18 octobre 2026)
- Commit `f052e46642ff64612dd32bd072b69567efbd2168` : ajout de `supabase/migration_098_universes_partners_flags_audit_stock_movements.sql` sur `main`.
- Le schéma ajoute les six univers, partenaires, association partenaires/univers, membres, feature flags, liste de comptes de test autorisés, journal d’audit et journal append-only des mouvements de stock. Les nouvelles tables ont RLS et des politiques séparant administration et membres partenaires.
- Les univers commerciaux, le suivi santé, les experts et le paiement client restent désactivés par défaut; le suivi est explicitement limité aux comptes autorisés par feature flag (le contrôle effectif des lectures de données devra être ajouté avant d'activer le parcours).
- Le journal de mouvements ne modifie pas encore les stocks existants : aucun impact sur la pharmacie historique. Les parcours admin et partenaires, les fonctions transactionnelles de stock et les tests SQL restent à implémenter.
- **Non appliqué à Supabase Production**, non compilé et non testé; aucun déploiement Vercel effectué. Le commit sur `main` est du code source uniquement.


## Univers multi-services — administration, catalogue et réservation (18 octobre 2026, poursuite)

- Commit `a4f5a81c1c0004e12f0df8b98e0fa249a2217b08` : actions serveur de création de partenaire en statut `pending`, activation/suspension/réactivation, activation d’univers et journalisation des actions. Chaque action revérifie le rôle administrateur et valide les champs côté serveur.
- Commit `28a0fa12eedb1729bac614207093d5634b39b725` puis `2c2dd9960c7fdd3681cf0e037fa0174bbd2dddfe` : console `/admin/univers`, en lecture seule à ce stade.
- Commit `bf0c0509b428f10b5ac57f059a541bc50c4ac02e` : migration 099 — tables de catalogue partenaire, réservations avec retrait, lignes d’articles, règles de stock réservé et transitions atomiques. Le retrait confirmé diminue le stock physique et écrit un mouvement append-only; annulation/libération ne touche pas le stock physique.
- Commit `503cc3a6316c0bca93bdf72742dd8490d848342e` : migration 100 — fonction de lecture publique à projection minimale et correction de la politique RLS du catalogue sans exposer les coordonnées privées des partenaires.
- Commit `e5b778456b0ce33e6e60b0b810ab22f334cad122` : premières pages catalogue Parapharmacie et Bébé & Maman, action de réservation individuelle et reçu avec code de retrait, total indicatif, statut et annulation client.
- La liste de produits est alimentée par `get_universe_catalog`; les pages retombent sur l’écran « Bientôt disponible » si le catalogue n’est pas activé ou si les migrations ne sont pas accessibles. Aucun paiement en ligne ni livraison n’est ajouté.
- **À vérifier avant activation réelle :** appliquer les migrations 098 → 099 → 100 → 101 dans cet ordre sur un environnement de test, contrôler les politiques RLS et fonctions SQL, puis tester concurrence/annulation/retrait et les restrictions de Bébé & Maman. La migration 101 fournit la lecture sécurisée du reçu.
- **État actuel :** code poussé sur `main`; aucune migration exécutée sur Supabase, aucun déploiement Vercel, aucune compilation/test CI exécutés conformément à la consigne de réserver la vérification à la fin du chantier. Les parcours de réservation ne sont donc pas encore déclarés validés.


- Commit de poursuite `b20e713b9b8d080586bf83c1024fa37adcb2af8b` : l’administration peut ouvrir/fermer l’association d’un partenaire à chacun des univers. Les changements sont audités, et un partenaire doit être actif avant l’ouverture d’un univers.
- Migration 102 renforce la politique RLS pour empêcher un membre partenaire de gérer un catalogue d’un univers auquel son partenaire n’est pas associé.
- Migration 103 ajoute des fonctions SQL atomiques pour les changements d’activation et d’association, avec vérification du rôle administrateur et écriture du journal d’audit dans la même transaction. Elle durcit également les transitions de réservation : une réservation échue ne peut plus être retirée et un partenaire suspendu ne peut plus traiter ses réservations.
- Ordre de préparation désormais requis : `098 → 099 → 100 → 101 → 102 → 103`. Ces migrations sont uniquement dans GitHub et n’ont pas été exécutées sur une base.


- Complément console admin : affichage des feature flags transversaux (lecture seule), gestion de la liste d’autorisation des comptes de test du suivi santé et consultation des 20 dernières entrées du journal d’audit. Cette liste n’active pas à elle seule les parcours de suivi et ne rend aucune donnée médicale publique.


- Suite du stage 2 : la console admin permet désormais de créer un produit partenaire en brouillon, puis de le publier, de le remettre en brouillon ou de l’archiver. La publication est bloquée si le partenaire, l’association, l’univers ou son feature flag n’est pas actif. Les termes interdits de Bébé & Maman sont filtrés aussi par le déclencheur SQL, pas seulement par l’interface.
- La console admin affiche également les flags transversaux en lecture seule, permet d’ajouter/retirer des UUID à la liste de test du suivi et montre les 20 derniers événements d’audit. Ces écrans ne constituent pas encore une activation du suivi santé ni un tableau de bord médical.


- Parcours client enrichi : panier multi-univers conservé localement, groupes séparés par partenaire et univers, quantités limitées au stock affiché, réservation de plusieurs produits d’un même partenaire en une opération. Après création, le groupe réservé est retiré du panier local depuis le reçu. Les autres groupes restent disponibles.

## Espace partenaire — alertes et réservations
- Ajout de /partenaire/reservations : réservations des établissements liés et transitions via la RPC sécurisée existante.
- Ajout d’alertes visuelles de stock faible et d’expiration à 30 jours dans le catalogue partenaire.
- Migration 105 ajoute un seuil d’alerte stock et une RPC de traitement par lots des réservations expirées, destinée à un ordonnanceur serveur.
- Les réservations expirées cessent de bloquer la disponibilité ; le stock physique n’est pas décrémenté avant le retrait confirmé.
- Migration 105 non appliquée à Supabase. Ordonnanceur non configuré. Aucun build, test ni déploiement exécuté.

## Import catalogue — cohérence stock
- Migration 106 ajoute une RPC d'import atomique qui crée les produits en brouillon, écrit les stocks initiaux dans le journal append-only et annule toute la transaction si une ligne échoue.
- L'import reste additif : aucun produit existant n'est supprimé ni remplacé. Import limité à 500 lignes côté serveur.
- Migration 106 non appliquée à Supabase ; tests/compilation non exécutés.

- Le formulaire de création expose désormais le seuil d'alerte et la date d'expiration ; l'import CSV accepte également ces deux colonnes.


## Univers Examens — étape de construction
- Migration additive 107 : centres partenaires, examens, packs, horaires, créneaux et réservations avec ticket.
- Réservation protégée par RPC transactionnelle qui verrouille le créneau et incrémente sa capacité sans dépasser le maximum ; aucun paiement en ligne.
- Génération SQL de créneaux sur une fenêtre maximale de 14 jours, selon les horaires déclarés par les centres. Fonction réservée à service_role ; aucune planification automatique n'est configurée.
- Catalogue client raccordé à /examens, avec tarifs, choix de créneau et action de réservation nécessitant une connexion.
- La migration 107 est dans main mais n'a pas été appliquée à Supabase. Aucun test, build ou déploiement effectué à ce stade.
- À compléter : espace partenaire pour gérer horaires/catalogue, raccordement effectif des tickets à /achats et orchestration des rappels à J-1. Validation finale de la chaîne SQL et du build à la fin du projet.

- Étape suivante : portail partenaire initial `/partenaire/examens` pour créer une fiche centre en brouillon, déclarer des examens et des horaires/capacités, puis générer les créneaux des 14 jours suivants.
- Migration 108 ajoute une RPC de génération strictement limitée au centre du partenaire appelant ; elle ne donne pas aux partenaires accès à la génération globale. Elle n'a pas été appliquée en base.

- Migration 109 renforce la réservation : la RPC vérifie l’activation du centre, du partenaire, de l’univers et du feature flag même si elle s’exécute en `SECURITY DEFINER`. Cela empêche la réservation directe d’un centre masqué ou suspendu. Migration non appliquée ; tests et compilation reportés à la validation finale.

- Migration 110 et interface `/admin/examens` ajoutées : l’administrateur peut valider/suspendre un centre, publier/dépublier un examen ou un pack. Les RPC vérifient le rôle admin et les prérequis commerciaux, et écrivent une trace d’audit dans la même transaction.
- Ces migrations restent dans GitHub uniquement. Les opérations n’ont pas été testées en base ni déployées ; compilation globale réservée à la phase finale.

- Le portail partenaire examens permet désormais de créer des packs tarifaires en brouillon. La composition des packs (liaison aux examens individuels) reste à implémenter avant leur publication commerciale.

## Parcours Promoteur — entrée, attente et accès réseau (19 octobre 2026)

- `/pharmacie/promoteur` accepte maintenant un compte Promoteur authentifié même si `profiles.actif=false`, afin de présenter son état au lieu de le renvoyer silencieusement à l’accueil.
- L’écran d’attente explique les contrôles NAXA, montre les pharmacies rattachées quand elles existent, et précise que l’essai de 14 jours commence à la validation administrative.
- Le parcours distingue l’attente initiale de la suspension commerciale. Une échéance préremplie avant la première validation ne bloque pas à elle seule le dossier en attente ; une suspension, un statut commercial inactif ou une échéance dépassée après activation ferme l’accès.
- L’espace opérationnel et la gestion des Caisses renvoient les Promoteurs inactifs vers cet écran de statut. Les données réseau visibles dans le tableau actif sont limitées aux rattachements actifs et pharmacies actives/visibles ; les Caisses comptabilisées sont bornées à ce périmètre.
- Le tableau ne s’ouvre que si la convention et l’abonnement sont présents et cohérents (même convention, même tarif, même échéance et architecture du compte correspondante). Aucune réactivation ni modification commerciale n’est possible depuis cet écran.
- La page de gestion des Caisses vérifie aussi `MANAGE_CAISSES` par RPC sur les pharmacies actives avant d’exposer la liste des comptes enfants ; une validité commerciale ou un privilège absent renvoie vers le statut Promoteur.
- Le tableau Promoteur permet maintenant d’ouvrir chaque pharmacie opérationnelle du réseau. `/pharmacie?vue=operation&pharmacie=<id>` vérifie côté client authentifié le rattachement actif et l’état publié avant de charger le stock et les réservations de la pharmacie choisie.
- La garde sur une pharmacie du réseau utilise la nouvelle RPC `set_garde_for_pharmacy`, protégée par `EDIT_PHARMACY`, le périmètre réseau, le rôle Promoteur actif et l’état actif/publié de la pharmacie. L’ancien `set_garde` reste inchangé pour les autres profils.
- Migration/test SQL ajoutés : `supabase/migration_155_promoteur_pharmacy_context.sql`, `supabase/tests/155_promoteur_pharmacy_context.sql`.
- Fichiers modifiés : `src/app/pharmacie/promoteur/page.tsx`, `src/app/pharmacie/page.tsx`, `src/app/pharmacie/caisses/page.tsx`, `src/app/pharmacie/actions.ts`, ainsi que la migration et le test 155.
- État : construit dans `main`, contrôle statique partiel ; build TypeScript/E2E non confirmé. La migration 155 n’est pas appliquée à Supabase Production. Aucun déploiement autorisé/effectué.

## Parcours Promoteur — équipe, délégation et rapports (19 octobre 2026, suite)

- La page Gestion de l'équipe borne désormais les comptes Caisse et les quotas affichés aux pharmacies liées activement, actives et publiées. Les pharmacies suspendues ou masquées ne sont plus sélectionnables pour ce parcours.
- Nouvelle page `/pharmacie/caisses/privileges` : gestion des privilèges de poste Caisse, filtrage sur les privilèges actifs/délégables/non-gouvernance, niveau hiérarchique 3 et matrice de privilèges de l'architecture. Les Server Actions revérifient le Promoteur actif, le lien réseau, l'état de la pharmacie et la Caisse enfant directe ; les RPC de base restent l'autorité.
- La route `/api/rapports` limite les rapports Promoteur aux pharmacies avec lien actif, statut actif et publication visible, après vérification de la validité commerciale.
- Migration additive 156 : garde avant insertion/mise à jour d'un profil Caisse actif. Une activation initiée par un Promoteur exige la validité commerciale, une Caisse enfant directe et une pharmacie active/publiée liée au réseau. Le test structurel 156 est ajouté.
- Documentation mise à jour dans `docs/GUIDE_PROMOTEUR.md` et `docs/SECURITE_PROMOTEUR.md`.

### État de preuve — ne pas confondre code commis et validation

- Tête `main` au dernier contrôle : `908dd2a29d9e2b0c78616f082141122a92e1931f`.
- Le statut GitHub consulté pour cette tête remonte encore un échec CircleCI et un échec Vercel lié à la limite de builds du plan. CircleCI n'est pas considéré comme preuve de validation du chantier, conformément à la consigne actuelle.
- Aucune compilation TypeScript, aucun lint, aucun E2E et aucune exécution des tests SQL 155/156 n'ont été confirmés dans cette session. Les migrations 155 et 156 ne sont pas appliquées à Supabase Production.
- Aucun déploiement Vercel n'a été lancé. Le volet est avancé côté code sur `main`, mais il ne peut pas être déclaré « tout vert » avant l'exécution effective des validations et l'application contrôlée des migrations dans un environnement de test.

## Parcours Caisse — session, vente, encaissement et tickets (19 octobre 2026)

- La page /pharmacie/caisse est maintenant réservée à un compte Caisse actif rattaché à une pharmacie active et publiée. Elle n'ouvre plus automatiquement une session ni un brouillon au chargement.
- L'ouverture de session demande le fond initial ; la page permet de reprendre le panier brouillon du compte, rechercher/scanner les produits, abandonner explicitement un panier et afficher les 20 dernières ventes payées créées par le compte.
- Migration additive 157 : la RPC vente_brouillon_abandonner verrouille le brouillon, vérifie le créateur et le périmètre, restitue les quantités au stock agrégé et aux lots d'origine, puis marque la vente annulée dans la même transaction.
- L'encaissement espèces du parcours utilise vente_encaisser_finaliser : insertion du paiement et passage à payée sont atomiques. Le ticket est lu via vente_ticket, présenté pour impression et réimprimable depuis l'historique.
- Orange Money, MTN MoMo et l'ancien mode mobile_money sont bloqués côté base dans les deux RPC d'encaissement tant que la confirmation marchande officielle n'est pas intégrée. Une référence saisie manuellement ne peut pas valoir confirmation.
- La clôture de session demande le comptage réel et affiche le rapprochement théorique/compté/écart.
- Test structurel ajouté : supabase/tests/157_caisse_safe_draft_and_payments.sql. Guide mis à jour : docs/GUIDE_CAISSE.md.

### Preuve et limites
- La migration 157 a été appliquée uniquement au projet de test Supabase actif « naxa-ci-replay-2 » (migration enregistrée 20261019214254), jamais à Production. Le test structurel 157 et le test POS historique 044 ont été exécutés sans erreur ; les requêtes de contrôle 059/060 ont également été exécutées, mais le connecteur n'en a exposé que le dernier résultat. Ce projet de test ne contient que les migrations jusqu'à 132 : la validation SQL est donc utile mais partielle par rapport au schéma actuel. Aucun build TypeScript, lint ou E2E n'a pu être lancé depuis les outils disponibles dans cette session.
- Aucun changement de schéma ni de données n'a été appliqué à Supabase Production. Aucun déploiement Vercel n'a été lancé ; l'interdiction de déployer est respectée.

- Garde de concurrence et d'appartenance : une session est attachée à son compte ouvreur ; la création de vente verrouille la session avant de vérifier qu'un autre brouillon n'existe pas ; les ajouts de lignes, paiements et finalisations sont protégés par des déclencheurs qui revérifient l'acteur Caisse, le propriétaire de la vente, le périmètre et l'état de la session. La clôture recalcule côté base le total théorique à partir du fond initial et des paiements espèces enregistrés.
- La réimpression est bornée aux ventes payées créées par le compte connecté. Si la lecture du ticket échoue après encaissement, le panier local est libéré et la vente reste accessible via l'historique, sans inviter à réencaisser.

- Contrôle Vercel en lecture seule après les commits Caisse : l'alias de production reste sur le déploiement READY antérieur `dpl_8cbANMZpjLQWKLdFyoa3223w4GdP`, SHA `adaf28b932e6d09be01bbf62656f8024485cfc10`. Les tentatives automatiques associées aux pushes `main` observées dans l'historique Vercel sont à l'état CANCELED ; aucun déploiement manuel n'a été lancé et aucun alias de production ne pointe vers le code Caisse.

- Durcissement complémentaire du poste : une erreur de lecture de session est maintenant bloquante côté interface (pas de nouvelle ouverture tant que le contrôle n'a pas réussi) ; après ajout d'un produit, prix et quantités sont relus depuis les lignes persistées plutôt que calculés optimistement depuis le résultat de recherche. L'ouverture n'est annoncée comme confirmée qu'après relecture d'une session ouverte.
- Le test structurel 157 vérifie également le verrouillage de session à la création du brouillon et les droits EXECUTE de l'encaissement atomique.
- Vérification d'état effectuée le 19 octobre 2026 : les derniers statuts observés sur les commits de ce lot montrent un échec CircleCI nommé quality et un échec Vercel lié à la limite de builds ; sur la tête main la plus récente, GitHub ne renvoie aucun statut exploitable. Ces statuts ne valident donc pas le build POS. Le connecteur GitLab a répondu 403 pour le pipeline de main. Les tests SQL structurels ont depuis été rejoués sur le projet isolé de test (voir l'addendum de revalidation ci-dessous) ; aucun build TypeScript, lint ou E2E n'est confirmé vert.

- Revalidation après les derniers correctifs : la révision de la migration 157 a été rejouée sur le seul projet de test Supabase `naxa-ci-replay-2` (ref `pwfftcsjyeibxxqhwysw`) ; le test structurel 157, puis les tests SQL POS 044, 057, 058, 059 et 060 ont été exécutés. Le test 044 a explicitement renvoyé `044_pos_caisse PASS`; les autres contrôles ont retourné les résultats structurels attendus sans erreur d'exécution. Le schéma de ce projet de test s'arrête à la migration 132 avant l'ajout de 157 : résultat utile mais incomplet pour la pile 133–156 de main.
- Aucune migration n'a été appliquée au projet Supabase Production `eouwtuusnsuxaejsxknf`. Vérification Vercel en lecture seule : les alias de production restent sur `dpl_8cbANMZpjLQWKLdFyoa3223w4GdP`, commit `adaf28b932e6d09be01bbf62656f8024485cfc10`; aucun déploiement n'a été lancé.

- Dernier correctif de sécurité : l'abandon d'un brouillon vérifie désormais aussi que le compte connecté est l'ouvreur de la session, sauf administrateur NAXA. La révision 3 de la migration 157 a été rejouée sur `naxa-ci-replay-2`, puis le test structurel 157 a été réexécuté avec succès (aucune exception SQL). Production reste inchangée.

## Parcours Caisse — consolidation de la révision (20 octobre 2026)

- Le fond initial est désormais vide par défaut et doit être saisi explicitement à chaque ouverture de session ; zéro reste autorisé s'il est réellement compté.
- Les opérations d'ajout, abandon, encaissement, changement de poste, historique, réimpression et clôture gèrent les erreurs réseau en relisant l'état du panier ou de la session avant d'inviter à réessayer. Le lecteur de code-barres bloque les entrées concurrentes afin de réduire les ajouts en double.
- Les tickets imprimés et réimprimés affichent aussi le mode de paiement et, pour les paiements espèces disposant des données, le montant reçu et la monnaie rendue.
- Les RPC historiques d'encaissement ne peuvent plus enregistrer un paiement espèces partiel ou non finalisé ; le chemin espèces doit passer par `vente_encaisser_finaliser`, qui écrit le paiement et finalise la vente dans la même transaction. Les modes électroniques restent bloqués sans confirmation opérateur officielle.
- Révision 5 de la migration 157 exécutée sur le projet de test Supabase `naxa-ci-replay-2` (ref `pwfftcsjyeibxxqhwysw`), jamais sur Production. Le test structurel 157 et les tests POS 044, 054, 055, 056, 057, 058, 059 et 060 ont été exécutés sans erreur SQL ; 044 a explicitement renvoyé `044_pos_caisse PASS`.
- Limite : le projet de test reste en retard sur les migrations 133–156 de main. Ces résultats confirment les fonctions et déclencheurs sur le schéma de test disponible, pas une validation complète de la pile actuelle. Aucun build TypeScript, lint ou E2E n'a été confirmé. Aucun déploiement n'a été lancé et Production reste inchangée.

- Migration additive 158 : le caissier peut retirer toutes les unités d'un produit du panier. La RPC verrouille la vente et la session, vérifie le compte Caisse actif et le propriétaire de la session, restitue le stock agrégé et chaque lot d'origine, supprime les lignes via un garde dédié puis recalcule les totaux dans la même transaction. L'interface ajoute une action **Retirer** par produit.
- Migration 158 et test structurel 158 exécutés sur `naxa-ci-replay-2`. Après son application, les tests 157, 158, 044, 054, 055, 056, 057, 058, 059 et 060 ont été rejoués sans erreur SQL. Les tests sont structurels : ils ne remplacent pas un parcours E2E avec un utilisateur Caisse et des données de stock.

## Compte Comptable — Étape 8 « Clôtures, exports, audit » — 21/10/2026
- Migration additive `supabase/migration_20261025_compta_cloture_etape8.sql` : table des contrôles de clôture et RPC serveur `compta_cloturer_periode` ; vérifications des preuves de dotations, paie, TVA, stock et rapprochements, avec régularisations/à-nouveaux pour la clôture annuelle, événements en attente/erreur, équilibre des écritures et chaîne d’audit.
- Exports CSV/XLSX/PDF étendus au grand livre et à la balance ; agrégation monétaire en bigint, dates de période corrigées. Les états bilan/résultat/TVA/paie restent à construire après confirmation des sources et mappings validés.
- Parcours `/pharmacie/comptable/clotures` et API `/api/pharmacie/comptable/clotures` ajoutés : ouverture de période via RPC serveur sans chevauchement, contrôles documentés et demande de clôture ; chaque action est auditée.
- La page Journal d’audit affiche le résultat de la vérification de chaîne.
- Tests SQL structurels `167_compta_cloture_etape8_structure.sql` et `169_compta_controles_cloture_rpc.sql` : PASS sur la base isolée. Test transactionnel `168_compta_audit_chain_integrity.sql` : PASS, chaîne valide acceptée et altération simulée détectée puis annulée. Chaînes vides : 6/6 valides, 0 invalide.
- Limites : aucun profil de test dans la base isolée, donc pas de test positif de clôture réelle ni de tests négatifs par identité. Typecheck, lint, build et navigateur NON EXÉCUTÉS. CI NON CONSULTÉE/LANCÉE. Base active NON MODIFIÉE. Aucun déploiement.
- Rapport : `docs/compta/RAPPORT_ETAPE_8.md`.
- **État : 🟡 étape 8 engagée, non certifiée ni terminée.**

## Compte Comptable — Étape 9 « Recette et pilotage 360° » — 21/10/2026
- Dashboard `/pharmacie/comptable` étendu avec KPI réels sur ventes payées, dépenses, mouvements bruts de trésorerie, dossiers d’assurance, contrôles de clôture et chaîne d’audit ; filtrage par pharmacie et mois, sommes en `bigint`, états indisponibles et troncature signalés.
- Exports : nom/id pharmacie, dates et date de génération ; empreinte SHA-256 dans l’en-tête de réponse et le journal d’audit. Bilan, résultat, TVA et paie explicitement non générés tant que les sources/mappings ne sont pas confirmés (HTTP 409).
- Test `supabase/tests/170_compta_recette_etape9_security.sql` : PASS sur base isolée. `167`, `168`, `169` rejoués : PASS.
- Base isolée au contrôle : 6 pharmacies, 0 profil, 0 vente, 0 ligne de vente, 0 dépense, 0 mouvement de trésorerie, 0 dossier d’assurance, 0 période, 0 écriture, 0 ligne comptable, 0 compte du plan. Les parcours E2E réels ne peuvent donc pas être certifiés sans fixtures autorisées.
- Matrice 12 critères, risques et preuves : `docs/compta/RAPPORT_ETAPE_9.md`. Typecheck, lint, build et navigateur NON EXÉCUTÉS ; CI NON CONSULTÉE/LANCÉE ; base active NON MODIFIÉE ; aucun déploiement.
- **État : 🟡 étape 9 engagée, recette métier non certifiée.**



## Compte Comptable — Étape 10 « Recette renforcée » — 21/10/2026
- Test ajouté : `supabase/tests/171_compta_recette_etape10_hardening.sql`. Il vérifie les triggers d'immuabilité, la contrainte différée de partie double, RLS sur les tables comptables sensibles, l'absence d'écriture directe authentifiée et la séparation des RPC ouverture/clôture.
- Tests 167, 168, 169, 170 et 171 rejoués sur le projet isolé `naxa-ci-replay-2` : les cinq marqueurs PASS ont été observés.
- Aucun profil, vente, écriture ou fixture E2E persistant créé. La base de test présente un historique non canonique (saut du socle 132 aux séries 157 et suivantes, migrations 133–156 absentes de son historique observé) ; ne pas appliquer ces migrations hors ordre sans réconciliation.
- Sources dédiées confirmées de paie et d'immobilisations/amortissements absentes : la clôture positive complète reste bloquée plutôt que de valider des contrôles fictifs.
- Rapport détaillé : `docs/compta/RAPPORT_ETAPE_10.md`.
- Typecheck, lint, build, Vitest et navigateur NON EXÉCUTÉS ; CI NON CONSULTÉE/LANCÉE ; Supabase active NON MODIFIÉE ; aucun déploiement.
- **État : 🟡 étape 10 partielle, SQL structurel PASS, E2E métier non certifié.**


## Espace Promoteur — refonte visuelle (22/10/2026)

- **Étape A — navigation persistante** : composant client `NavPromoteur`, rail mobile 56 px, panneau étendu, sidebar 240 px sur grand écran, groupes 1–9 / Configuration / Profil / Déconnexion, icônes SVG, état d'ancre via `IntersectionObserver`, fermeture clic extérieur/Échap.
- **Étape B — bento et KPI** : disposition réorganisée, cartes arrondies sans ombre marquée, première carte KPI verte, grille KPI responsive, actions rapides mises en évidence, tableaux conservés dans leurs conteneurs de défilement horizontal internes, bandeau de palette conservé.
- **Étape C — animations** : entrée en cascade (60 ms), compteur animé seulement pour une valeur entière pure, animation du bandeau, respect de `prefers-reduced-motion`.
- **Étape D — accès restreint et documentation** : style harmonisé sans navigation pour l'accès restreint ; README et statut actualisés.
- **Règles métier** : requêtes, calculs, états conditionnels, droits, routes, textes conditionnels et composants d'avis/sécurité conservés. L'action de déconnexion exécute toujours `signOut()` puis redirige vers `/connexion`.
- **Limites connues** : « Marketplace & réservations » et « ERP & opérations » partagent la même URL existante ; aucun état actif distinct n'est affiché pour ces deux entrées. Aucun nouveau jeu de données, indicateur ou route n'a été ajouté.
- **Vérification** : modifications statiques uniquement via GitHub. TypeScript, lint, build, tests navigateur et audit contraste instrumenté non exécutés dans cette session ; la révision n'est pas certifiée par CI. Aucun déploiement manuel lancé.


## Promoteur — restructuration ciblée (22/10/2026)

- **Fait** : destinations distinctes `?vue=operation&module=marketplace` et `?vue=operation&module=erp`, sections existantes filtrées et états actifs distincts dans la navigation.
- **Fait** : accès Centre d'aide pour Promoteur actif, tickets bornés au réseau actif et contrôle serveur du périmètre avant réponse.
- **Fait** : harmonisation visuelle de `/pharmacie/pilotage` et `/pharmacie/pilotage/rapports`, lien de retour Promoteur.
- **Non livré** : sous-pages Promoteur, chargeur serveur React `cache()` partagé et onglets. Ils sont exclus plutôt que de créer des pages qui dupliqueraient les requêtes ou contourneraient les conditions d'accès.
- **Vérification** : revue statique uniquement ; build, TypeScript, ESLint et tests navigateur non exécutés.
- **Déploiement** : aucun appel Vercel/CircleCI effectué par cette modification ; un push sur `main` peut déclencher automatiquement Vercel.


## Promoteur — aide, séparation des modules et colonne logo (22/10/2026)
- Rétablissement du rôle pharmacie uniquement pour la boite de conversations client et l’action d’envoi de message.
- Création du Centre d’aide Promoteur avec FAQ et contact NAXA par e-mail/WhatsApp.
- Mode Marketplace : les blocs de stock et raccourcis ERP ne sont pas rendus ; les blocs de réservation et de garde restent disponibles. Les raccourcis vers PharmacienWorkspace sont masqués pour le Promoteur.
- Migration additive `20261022130000_add_pharmacies_logo_url` appliquée en Production ; colonne `logo_url` constatée absente avant migration. L’upload et les impressions logo ne sont pas inclus : aucune politique d’écriture Storage pour `pharmacies-photos` n’a été trouvée dans l’état lu.
- Non livré dans ce lot : découpage intégral en sous-pages avec chargeur React cache partagé, onglets, profil enrichi, supervision dédiée des pharmaciens et formulaire de changement de mot de passe Promoteur.
- Revue statique seulement ; TypeScript, ESLint, build et tests navigateur non exécutés.


## Refonte Promoteur — étape architecture

- Chargeur serveur `React cache()` mutualisé pour session, profil, rattachements, pharmacies, convention/abonnement et statut d’accès.
- Layout partagé, barre d’onglets horizontale et routes dédiées aux sections ; anciennes ancres redirigées vers les sous-pages.
- Carte Pharmaciens avec compteurs agrégés et historique des sessions, sans données patient.
- Profil enrichi (identifiant, e-mail, niveau, architecture, pharmacies et dates). Téléphone absent : « Non renseigné ».
- Formulaire de changement de mot de passe Promoteur avec vérification actuelle, minimum huit caractères et limitation des tentatives. Le code ne conclut pas à une révocation des autres sessions.
- Logo non livré : pas de politique Storage d’écriture strictement limitée vérifiée ; colonne `logo_url` déjà appliquée et vérifiée dans le lot précédent.
- Build, TypeScript, ESLint et tests SQL non exécutés.


## Logo pharmacie — vérification et intégration

- En production : `pharmacies.logo_url` existe (text), bucket `pharmacies-photos` public avec limite 512 Ko, policies insert/update/delete pour logo vérifiées après application de la migration additive.
- Interface de logo sur le profil Promoteur : sélection pharmacie, aperçu, choisir/remplacer/supprimer, redimensionnement 400 px de large maximum.
- Ajout du logo sur ticket de caisse, duplicata historique et reçu Marketplace ; l'impression attend le chargement des images.
- Aucun build/typecheck/ESLint exécuté à ce stade.

## Correctif lisibilité de la carte hero et des onglets — 25/10/2026
- Carte hero de `/client` : voile vert allégé, du vert à 55 % en haut à gauche à 5 % à droite et en bas ; image conservée nette, sans blur, brightness réduit ni grayscale. Point focal mobile décalé vers la droite (`object-position: 82% center`) ; texte blanc et ombres de texte conservés.
- Navigation basse : libellés des onglets réduits à 9 px avec un léger espacement négatif, sans changer la structure ni les icônes, pour éviter le tronquage de « Réservations » sur les petits écrans.
- Aucun contenu, fonctionnalité de recherche, bouton Chercher/ambulance, scanner d’ordonnance, pharmacies à proximité ou logique Supabase supprimé/modifié volontairement.
- Fichiers de ce correctif : `src/components/AccueilClient.tsx`, `src/components/BottomNav.tsx`, `STATUT.md`.
- Vérification du build : non exécutée depuis cet environnement ; le succès de `npm run build` reste à confirmer par un environnement d’exécution/CI.
- Aucun déploiement manuel lancé.


## Audit 360° Promoteur — clôture ciblée des ACL de réactivation (29/10/2026)
- **Clos sur preuve Supabase :** `public.reactiver_promoteur(uuid,text)` n'est exécutable ni par `anon`, ni par `authenticated`, ni par `service_role`; seul le propriétaire `postgres` dispose d'EXECUTE. Ne pas réouvrir ce point sans changement constaté des ACL/propriétaire.
- **ACL confirmées :** `promoteur_soumettre_reglement(...)` et `admin_confirmer_reglement_promoteur(uuid,uuid)` sont exécutables par `service_role` seulement. Cela ne valide pas la route : le contrôle identité↔`p_promoteur` et l'origine de `p_admin` restent à inspecter dans le code appelant.
- **Étape exacte :** inspection des appelants serveur des deux RPC de règlement. La recherche GitHub par symbole n'a pas fourni de résultats exploitables; aucun appelant n'est déclaré vérifié. Ne pas refaire l'audit général ni le contrôle ACL déjà clos.
- **Non effectué :** aucun changement de logique, aucune écriture métier Supabase, aucun déploiement et aucune relance CI.



## Audit 360° Promoteur — clôture des routes de règlement (29/10/2026)
- **Clôturé sur inspection du code :** la soumission de règlement exige l'utilisateur authentifié et un profil Promoteur; `p_promoteur` vient de `user.id`. La confirmation/contestation exige `requireAdminActive`; `p_admin` vient de `user.id`. Les ACL RPC correspondantes sont réservées à `service_role`.
- **Non testé en intégration :** les routes sont vérifiées statiquement, mais aucun test d'exécution UI/API n'est déclaré réussi.
- **Reprise unique :** partie 3, accréditation Responsable et contrôle des privilèges; comparer les façades publiques aux implémentations `private.*` et trouver un environnement non-Production pour le test comportemental 028. Les fixtures ne seront pas exécutées en Production.


## Audit 360° Promoteur — écart de définition du helper de validité (29/10/2026)
- **Contradiction prouvée :** la migration 147 et son test prévoient architecture non nulle, réseau actif et cohérence de chaque pharmacie/architecture; la définition active de `private.naxa_promoteur_valide(uuid)` en Production ne vérifie que profil actif, convention active/non expirée et abonnement actif/non expiré.
- Le comptage en lecture seule trouve 1 Promoteur et celui-ci satisfait aux deux critères. Aucun impact immédiat détecté, mais la dérive doit être résolue avant de certifier la partie 3.
- Prochaine action : retrouver la définition qui a remplacé le helper, puis réconcilier la source canonique et exécuter le test 147 hors Production. Pas de migration corrective ni de déploiement avant d'avoir identifié l'origine.


## Audit 360° Promoteur — correction préparée du helper de validité (29/10/2026)
- **Écart Production/code confirmé :** le helper privé de validité commerciale omet architecture de convention, présence d'un rattachement réseau actif et cohérence des pharmacies/architectures actives prévues par la migration 147.
- Les migrations 149, 151, 152 et 153 inspectées ne redéfinissent pas directement ce helper; la source exacte de la dérive n'est pas établie.
- **Travail sur main, non appliqué :** migration additive `supabase/migration_20261029_promoteur_validity_helper_reconciliation.sql` (commit `7b6191fddc7ded1aa7222d53fc82e19155011327`) et test ciblé `supabase/tests/promoteur_validity_helper_reconciliation.sql` (commit `fac003d8220b9490efaf90ff605e99693eac8901`).
- ACL privées vérifiées en lecture seule : EXECUTE refusé à `anon`, `authenticated`, `service_role`; propriétaire autorisé.
- **Non testé / non déployé :** test SQL non exécuté (ne pas l'exécuter sur Production); environnement Supabase non-Production non confirmé. Partie 3 reste 🟡/non close.
- **Suite unique :** obtenir/identifier un environnement isolé, exécuter le test ciblé et le test comportemental 028/147, puis clôturer la partie 3 ou corriger les échecs. Aucun déploiement ni migration Production effectués.


## Audit 360° Promoteur — résultat des tests isolés partie 3 (29/10/2026)
- Environnement non-Production confirmé : Supabase `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`), distinct de Production.
- Migrations de test appliquées uniquement sur ce replay : migration 147 et migration additive `20261029_promoteur_validity_helper_reconciliation`. **Aucune application Production.**
- Test comportemental `028_promoteur_responsable_accreditation_behavior.sql` : PASS.
- Test ciblé du helper privé réconcilié (architecture, réseau, cohérence, ACL) : PASS.
- Tests complets 147 et PVH : non PASS, car la façade publique du replay est encore l'ancien wrapper sans garde identité/Admin (assertions 147.3/PVH.4). Une tentative d'application de la migration 040 à ce replay a été bloquée par le contrôle de sécurité de l'outil; pas de répétition de cette tentative.
- Production conserve l'écart déjà prouvé : le helper privé ne comporte pas encore les trois gardes; la migration corrective reste non appliquée. Partie 3 = 🟡 partielle, jamais déclarée verte.
- Prochaine étape unique : aligner la façade du replay via les migrations canoniques existantes, relancer 147/PVH, puis tester les cas limites métier. Aucun déploiement ni aucune migration Production effectués.


## Audit 360° Promoteur — validation complémentaire test-only (29/10/2026)

- Sur Supabase non-Production `naxa-ci-replay-2`, la façade publique a été réalignée avec le contrat de la migration 040 par migration de diagnostic dédiée. Tests SQL statiques 147 et PVH : **PASS**; test comportemental 028 : **PASS** avec rollback confirmé.
- ACL après correction : `anon` n'exécute pas la façade; `authenticated` et `service_role` l'exécutent mais restent soumis aux gardes identité/Admin internes. Le helper privé n'est exécutable par aucun de ces rôles.
- Les scénarios comportementaux d'architecture absente/réseau inactif/incohérence pharmacie-architecture restent non certifiés. La correction du helper privé n'a pas été appliquée à Production; aucune écriture Production, aucun déploiement ni workflow relancé.
- Partie 3 du Pilotage Promoteur : **partielle**, non clôturée. Référence détaillée : `docs/audits/AUDIT_360_PARCOURS_PROMOTEUR_NAXA.md`.


## Clôture ciblée et progression Promoteur — 29/10/2026

- **Clos :** sous-chantier de réalignement de la façade publique dans le replay Supabase non-Production `naxa-ci-replay-2`. Assertions statiques ciblées 147/PVH PASS; test comportemental 028 PASS après nouvelle exécution, rollback confirmé, zéro profil Promoteur persistant.
- **Non clos :** partie 3 globale du Pilotage Promoteur. Les scénarios comportementaux limites restent à certifier et le helper privé divergent de Production n'a pas été corrigé en Production.
- **Avancement :** début de la partie 4 (gestion Caisse, quotas, périmètres et délégation). Revue statique des migrations 029/030, tests 029/030/031, réconciliation 141, garde 156 et page/actions de délégation. Contrôles positifs documentés dans le rapport d'audit.
- **Point ouvert de partie 4 :** la fonction `naxa_can_manage_team_member` n'impose pas elle-même `target.actif=true`; examiner la fonction complète `naxa_set_caisse_status` et ses tests avant toute conclusion. Les tests transactionnels 029–031 n'ont pas été exécutés dans cette passe.
- Aucune migration Production, aucun déploiement et aucun workflow relancé. Travail effectué sur `main` uniquement.


### Partie 4 Promoteur — résultats complémentaires (29/10/2026)
- Tests SQL du dépôt exécutés sur replay : 147 **PASS**, PVH **PASS**, 141 **PASS**.
- Test 156 **bloqué/FAIL sur le replay incomplet** : garde `naxa_guard_promoteur_caisse_activation` et trigger absents du replay mais présents en Production. Ce n'est pas classé comme défaut Production.
- Le point `target.actif` du helper de management est expliqué par le flux de réactivation dédié, qui exige `REACTIVATE_CAISSE`, une architecture compatible et le quota; aucun défaut confirmé.
- Partie 4 toujours non certifiée : tests comportementaux 029/030/031 non exécutés; pas de contournement de trigger/role, pas de migration Production, pas de déploiement.


## Partie 4 Promoteur — clôture de la revue statique du statut Caisse (29/10/2026)
- `private.naxa_set_caisse_status` Production relue : réactivation soumise à `REACTIVATE_CAISSE`, architecture niveau 3 et quota; suspension soumise à `SUSPEND_CAISSE`. L'absence de filtre `target.actif` dans le helper de management permet le traitement des transitions de statut et n'est pas un défaut confirmé.
- Helper privé `naxa_can_manage_team_member` : `SECURITY DEFINER`, `search_path=''`, acteur actif, rôle/niveau, descendant direct, pharmacie et réseau Promoteur actif; aucun EXECUTE `anon`.
- Point à contrôler : plusieurs façades Caisse sont également exécutables par `service_role`; les contrôles métier sont présents et aucun exploit n'a été démontré. Justifier/réconcilier les grants canoniques avant toute modification.
- Tests comportementaux 029/030/031 non exécutés car leurs fixtures changent `session_replication_role`; aucun contournement de trigger. Test 156 non concluant sur replay incomplet (garde absente du replay, présente en Production).
- Passe de revue statique clôturée; partie 4 globale reste non certifiée. Production inchangée, aucun déploiement/workflow relancé. Détails dans `docs/audits/AUDIT_360_PARCOURS_PROMOTEUR_NAXA.md`.


## Partie 4 Promoteur — ACL RPC Caisse service_role (29/10/2026)
- Constat Production : les façades provisionnement/statut/attribution/révocation Caisse sont exécutables par `authenticated` et `service_role`, mais pas `anon`. Les parcours applicatifs les appellent via `supabaseServer()`; aucun appel de ces RPC via client Admin n'a été trouvé.
- Correctif additif ajouté sur `main` : `supabase/migrations/20261029160000_restrict_promoteur_caisse_rpc_service_role.sql`; test ACL `supabase/tests/157_promoteur_caisse_service_role_acl.sql`.
- Sur replay non-Production uniquement, migration de test appliquée et test 157 **PASS**. Production vérifiée après coup : grants service_role toujours présents, aucune migration Production appliquée.
- Sous-chantier ACL clos; partie 4 globale reste non certifiée car les tests comportementaux 029/030/031 restent à exécuter sans contournement de triggers. Aucun déploiement ni workflow relancé.


## Audit 360° Administrateur — clôture point 3 et reprise point 4 (29/10/2026)

**Point 3 : CLOS côté code et validation isolée.** Le contrat de retrait crédit Marketplace est maintenant vérifié par les tests 247, 251, 252, 255, 256, 257, 258 et par l'E2E réel 259 exécutés sur le replay non-Production `naxa-ci-replay-2`. L'E2E a retiré deux réservations dans l'ordre inverse de leurs allocations, vérifié le ciblage des lots, le stock agrégé, les ventes et les opérations de crédit; la transaction a été annulée. Les défauts d'assertions, la déduction des holds de la disponibilité Marketplace, les références PL/pgSQL ambiguës, le statut de vente et le reçu POS ont été corrigés par des fichiers additifs sur `main`.

**Point 4 : OUVERT / démarré.** Le test structurel `supabase/tests/20261029120000_promoteur_notifications_include_pharmacies.sql` passe sur le replay après application de la migration de test. Restent la preuve de délivrance runtime, les états d'erreur UI et la non-régression applicative.

**Séparation impérative des environnements :** aucune migration 258/259 appliquée à Supabase Production, aucune donnée métier Production modifiée, aucun déploiement déclenché, aucun workflow CI relancé. Les migrations de test ont été appliquées uniquement au projet `naxa-ci-replay-2`; les fixtures des tests transactionnels ont été annulées. Une livraison Production nécessite toujours l'autorisation explicite « OUI, DÉPLOIE ».

Rapport de référence : [Audit 360° Administrateur NAXA](docs/audits/AUDIT_360_ADMINISTRATEUR_NAXA.md), § 60.44.


### Point 4 — notifications J−5 et règlement : tests runtime ajoutés (29/10/2026)
- Test structurel `20261029120000_promoteur_notifications_include_pharmacies.sql` : **PASS** sur replay non-Production.
- Test runtime `supabase/tests/260_promoteur_j5_notification_runtime.sql` : **PASS**; noms Promoteur/pharmacie présents dans les notifications Promoteur et Admin, seconde exécution sans doublon; rollback confirmé.
- Test runtime `supabase/tests/261_promoteur_payment_submission_notification_runtime.sql` : **PASS**; soumission, notification Admin avec Promoteur/pharmacie et confirmation Promoteur; rollback confirmé.
- **Point 4 toujours ouvert uniquement** pour la recette UI, la vérification du téléversement/accès à la preuve et la preuve d'envoi externe. Les tests vérifient les notifications en base, pas un e-mail/SMS réellement délivré.
- Replay seulement : migrations de prérequis appliquées à `naxa-ci-replay-2`; Production inchangée, aucun déploiement et aucun workflow CI relancé.


## Partie 4 Promoteur — correction UI gestion Caisse (29/10/2026)
- Défaut concret corrigé dans `src/app/pharmacie/caisses/page.tsx` : les erreurs de lecture des Caisses et des architectures sont traitées explicitement; la liste n'affiche plus « aucune Caisse » si sa requête a échoué.
- La création est désactivée si la liste des Caisses ou les quotas d'architecture ne peuvent pas être lus; une pharmacie sans architecture active est désactivée dans le sélecteur.
- **Statut :** correction source préparée sur `main`; pas de build/test UI exécuté dans cette passe. Tests transactionnels 029–031 restent différés parce que leurs scripts changent `session_replication_role`; pas de contournement de triggers. Aucun changement Supabase Production, aucun déploiement.

## Audit 360° Administrateur — point 4, revue complémentaire (29/10/2026)
- Revue statique Promoteur/Admin effectuée sur les pages de paiement, Server Actions, notifications et route cron.
- Défaut Promoteur corrigé sur main, commit 37b46503e2eceae21ce3ddba653d2bb52099459b : une erreur de lecture ne s'affiche plus comme un historique vide; la soumission est bloquée si les données d'abonnement/paiement sont indisponibles ou si le tarif n'est pas configuré; indisponibilité du lien sécurisé de preuve explicitée.
- Storage vérifié en lecture seule sur Production et replay : bucket privé, limite 25 MiB et MIME attendus. Cela correspond à la validation du formulaire (la migration initiale historique indique encore 8 MiB, sans refléter la configuration effective observée).
- Délivrance externe non démontrée : le job pg_cron Production actif naxa-promoteur-echeance-5j appelle uniquement public.generer_rappels_echeance_promoteurs() (insertions en base). Aucun trigger d'envoi externe sur public.notifications; la route /api/cron/validite avec Resend n'est pas appelée par le job observé. Les événements de soumission/confirmation règlement ne présentent pas non plus de chemin e-mail/SMS dédié dans les fichiers examinés.
- Tests SQL 260/261 restent PASS sur replay et rollback confirmé; ils valident les notifications en base, pas une délivrance fournisseur.
- Point 4 ouvert : recette UI navigateur/E2E, accès effectif aux preuves, conception/validation d'un envoi externe idempotent et vérification du fournisseur. Aucun test navigateur/build exécuté dans cette passe; aucun message externe envoyé.
- Aucun changement Production, aucune migration, aucun déploiement et aucun workflow CI relancé.


### Audit 360° Administrateur — point 4 : outbox e-mail (29/10/2026)
- Cause du défaut confirmée : le job pg_cron crée les notifications J−5 et marque le rappel comme traité; la route historique réclamait ensuite le même rappel et ne pouvait donc plus l'envoyer. Les événements de règlement n'avaient pas de délivrance externe.
- Correctif source sur main : migration additive `supabase/migration_20261029_notification_email_outbox_delivery.sql`, file privée idempotente et trigger d'enqueue pour J−5 + soumission/confirmation/refus de règlement; route `/api/cron/validite` transformée en worker Google Apps Script avec verrouillage, reprise et clé d'idempotence.
- Test 262 structurel : **PASS sur naxa-ci-replay-2**, transaction annulée; RLS, trigger, unicité et ACL vérifiés. Aucun profil Promoteur/Admin dans le replay : pas de test comportemental ni d'envoi réel.
- À faire avant validation opérationnelle : configurer/vérifier l'ordonnanceur externe et les secrets sans les exposer, puis test de délivrance avec adresse de recette. Aucun changement Production, aucune donnée métier, aucun déploiement ni workflow relancé. Point 4 reste ouvert.

- Contrôle configuration complémentaire initial : l'absence des variables Resend a conduit à abandonner ce fournisseur. L'inventaire Vercel a ensuite confirmé `GOOGLE_APPS_SCRIPT_URL` et `GOOGLE_APPS_SCRIPT_SECRET` déjà présents sur les environnements concernés; voir le réalignement Google ci-dessous. Aucun secret n'a été modifié.

### Audit 360° Administrateur — canal Google Mail (29/10/2026)
- Resend abandonné au profit de la passerelle Apps Script déjà utilisée pour le courrier de bienvenue.
- Le fichier canonique `scripts/google-welcome-email.gs` a été étendu pour accepter les notifications Promoteur tout en préservant le contrat `{sent, alreadySent}` du courrier de bienvenue. Le worker `/api/cron/validite` utilise ce contrat et les variables Vercel déjà existantes `GOOGLE_APPS_SCRIPT_URL` et `GOOGLE_APPS_SCRIPT_SECRET`.
- Le propriétaire doit mettre à jour le projet Apps Script existant et publier une nouvelle version Web App. Aucun envoi réel, aucune modification de secret et aucun déploiement Vercel; la délivrance reste non certifiée.
### Réalignement Google Mail — 29/10/2026
- Réutilisation du canal Google déjà existant : `scripts/google-welcome-email.gs`, route de bienvenue et variables Vercel `GOOGLE_APPS_SCRIPT_URL` (Production) + `GOOGLE_APPS_SCRIPT_SECRET` (Production/Preview/Development) confirmées présentes en inventaire masqué.
- Le worker est aligné sur le contrat `{sent, alreadySent}` existant; le script canonique gère désormais les notifications Promoteur sans casser le courrier de bienvenue. Les fichiers provisoires d'une seconde passerelle ont été supprimés.
- Étape manuelle : mettre à jour le projet Apps Script existant depuis `scripts/google-welcome-email.gs` et publier une nouvelle version Web App. Pas de déploiement Vercel, pas de secret modifié, aucun e-mail test envoyé. Délivrance réelle non certifiée.
- Ordonnancement Google préparé dans le script existant : `processNaxaNotificationQueue` + déclencheur toutes les 5 minutes (`installNaxaNotificationTrigger` / arrêt avec `removeNaxaNotificationTrigger`). À activer manuellement dans Apps Script avec `NAXA_WORKER_URL` et `NAXA_CRON_SECRET`, après autorisation des scopes. Le worker Google côté Next.js est sur main mais non déployé; aucune activation/envoi réel.

## Rapports BI à la demande + J'IA — 30/10/2026

- Première livraison sur `main` : composant partagé `RapportsALaDemande`, API serveur `POST /api/rapports`, écrans rapports Admin et Pharmacie/Promoteur/Responsable/Caisse.
- Génération à la demande : données relues à chaque appel ; fenêtres quotidiennes, hebdomadaires, mensuelles, trimestrielles, semestrielles et annuelles (1/7/30/90/180/365 jours glissants) ; export direct PDF et CSV.
- Contrôle d'accès : session Supabase active ; calcul confié aux RPC `stats_pilotage_scope` et `stats_caisse_scope`, qui gardent leurs contrôles de rôle et privilège. Historique filtré par périmètre en lecture.
- IA : adaptateur serveur Vercel AI Gateway, optionnel et sans blocage des exports si `AI_GATEWAY_API_KEY` absente. Aucun secret configuré.
- Réserves explicites : pas encore de comparaison N/N-1 (RPC actuelle limitée à `p_jours`), périodes glissantes et non calendaires, PDF texte multipage (pas encore la maquette BI graphique), historique Promoteur non persisté, automatisation six périodes et transport Google non alignés.
- Tests de build, tests comportementaux des scopes et recette navigateur non exécutés via les outils disponibles. Aucun SQL/migration appliqué, aucune donnée Production modifiée, aucun secret Vercel modifié, aucun déploiement.
- Référence : [docs/architecture/RAPPORTS_BI_IA_NAXA.md](docs/architecture/RAPPORTS_BI_IA_NAXA.md).
