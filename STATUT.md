# NAXA — Statut opérationnel consolidé

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

## ERP-011 — Rappel de lot (F64)
- Audit sans doublon : aucune implémentation concurrente de rappel de lot trouvée dans `main`.
- Construction : table `rappels_lots`, traçabilité du motif/référence/statut et RPC de rappel/levée.
- Le rappel actif bloque le lot canonique `stocks_lots`.
- RLS et exécution RPC limitées au périmètre pharmacie.
- Le POS n'étant pas encore lotisé, le blocage de vente au niveau d'un lot précis reste une dépendance du futur raccordement vente/FEFO.
- Migration : `supabase/migration_055_rappel_lot.sql`.
- Test structurel : `supabase/tests/052_rappel_lot.sql`.
- Aucun changement Production.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


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
