> **AVERTISSEMENT DE CONTINUITÉ — 9 octobre 2026**
>
> Les instructions historiques ci-dessous ne constituent pas une procédure d'installation complète de la version actuelle. Elles ne doivent pas être utilisées pour reconstruire ou modifier la Production. La référence candidate contient des évolutions absentes de `main`, et le schéma Production observé ne correspond pas entièrement au code actuellement déployé. Toute intégration se fait sur la branche `integration/naxa-360-20261009` et toute validation SQL sur l'environnement de test. Aucun déploiement ni aucune écriture Supabase Production sans autorisation explicite.

# NAXA : base de l'application

Votre médicament, à 2 minutes. Next.js 14 + Supabase + Tailwind, PWA, 100 % offre gratuite.

## Démarrage
1. npm install
2. Créer un projet Supabase (gratuit). Dans Database > Extensions, activer pg_cron.
3. **Ne pas appliquer manuellement cette ancienne liste de migrations à une base existante.** Elle est conservée comme historique, mais ne représente pas la chaîne actuelle complète. Pour toute base de test, utiliser la chaîne canonique réconciliée de migrations après contrôle des dépendances et de l'historique. Ne jamais rejouer cette liste sur Production.
4. Planifier l'expiration des réservations avec le job naxa-expire toutes les 5 minutes.
5. Copier .env.example vers .env.local et renseigner les clés. La clé service_role ne doit jamais être exposée.
6. npm run dev, puis ouvrir /admin après avoir configuré un compte administrateur.

## Fonctionnalités
Recherche et scan d'ordonnance (OCR avec choix import téléphone/caméra), accès protégé par connexion pour les actions opérationnelles, traduction des noms de médicaments du bandeau « Les plus recherchés », classement prix/distance/temps, circulation, réservation 3 h, WhatsApp, paiement guidé par code marchand, reçu imprimable, panneau pharmacie, espace admin, fiches produits, panier et PWA.

Aucune photo de médicament n'est fournie : à ajouter par l'équipe NAXA (droits d'usage à vérifier).

## État

### Phase 0 — terminée et validée
- Cahier des charges et prompt maître lus et pris comme sources de vérité.
- Code existant conservé ; aucune réécriture de l'application.

### Phase 1 — fondations — consolidée
- Projet Supabase NAXA connecté et sain.
- Schéma initial + migrations catalogue/panier, sécurité et âge appliqués.
- RLS activé sur les tables publiques concernées.
- Données de démonstration chargées.
- pg_cron activé et expiration des réservations planifiée toutes les 5 minutes.
- Parcours compte : connexion username/mot de passe, récupération username → OTP e-mail → changement de mot de passe, création en 3 étapes, unicité username, téléphone avec indicatif/pays et date de naissance.
- Google OAuth : connexion directe sans OTP, callback finalisant correctement la session Supabase et conservation de la destination retour.
- Validation d'âge : 3 politiques obligatoires côté interface et serveur.
- Contrôles serveur du panier renforcés ; écriture des fiches produits limitée à l'administration.
- Import de stock conservé.
- Accueil : CTA pharmacie isolé, disclaimer repositionné, numéros 1510 / 119 / 1511.
- Documents juridiques : Conditions, Confidentialité et Sécurité enrichis selon le comportement réel.
- Authentification : tous les écrans principaux utilisent désormais le conteneur sans défilement auth-ecran, y compris /nouveau-mot-de-passe.
- Création de compte : bandeau « Les plus recherchés » masqué, interface mobile recentrée/compactée et téléphone séparé en pays, indicatif et numéro avec longueur contrôlée.
- Création de compte : sélecteur pays compact affichant uniquement drapeau + indicatif au repos ; le nom du pays apparaît uniquement à l’ouverture du sélecteur.
- Création de compte : coche jaune de validation ajoutée aux informations correctement renseignées.
- Mot de passe oublié : le serveur vérifie désormais l’existence réelle du compte avant tout envoi d’OTP ; un compte inexistant reçoit une erreur et n’accède pas à l’étape OTP.
- PR #17 : ces deux corrections sont fusionnées dans main, sans migration DB ni réécriture destructive.
- Build Production PR #17 : compilation Next.js réussie, contrôle TypeScript sans erreur bloquante, déploiement Production READY.

### Consolidation finale — 4 octobre 2026
- PR #11 : consolidation authentification, âge, accueil et politiques, fusionnée.
- PR #12 : documentation de consolidation, fusionnée.
- PR #13 : suppression du dernier scroll parasite de /nouveau-mot-de-passe, fusionnée dans main.
- PR #15 : correction finale UX de /creation-compte, fusionnée dans main.
- PR #15 : aucun changement métier, aucune migration DB et aucune réécriture destructive.
- Build Production : compilation Next.js réussie et vérification TypeScript sans erreur bloquante.
- Déploiement Production final issu de main : READY sur le projet Vercel existant naxa.
- Correction PR #13 strictement ciblée : min-h-screen remplacé par le conteneur d'authentification existant auth-ecran (100dvh + overflow:hidden), sans changement fonctionnel.
- Contrôle statique des cinq écrans principaux : /connexion, /creation-compte, /mot-de-passe-oublie, /verification-age, /nouveau-mot-de-passe : aucun conteneur de page ne conserve de scroll volontaire.

### Phase 3 — pharmacies pilotes — infrastructure consolidée
- PR #19 : panneau pharmacie renforcé, fusionnée dans main.
- Stock : quantité réellement modifiable depuis `/pharmacie` ; persistance dans `stocks` conservée avec le mécanisme `updated_at` existant.
- Garde : bouton « De garde » branché sur la RPC sécurisée `set_garde` existante.
- Hors connexion : file locale IndexedDB pour les modifications manuelles de quantité, badge « Hors connexion », synchronisation au retour réseau.
- Conflits : comparaison de `updated_at` avant écriture distante ; l'équipe pharmacie peut garder la valeur serveur ou réappliquer sa modification locale.
- Import existant conservé : Excel/CSV, reconnaissance des colonnes nom/désignation/produit, prix, quantité, dosage/conditionnement et péremption.
- Vérification Supabase du 5 octobre 2026 : 3 pharmacies de démonstration actives existent déjà à Yaoundé, avec 3 lignes de stock chacune. Elles ne sont pas considérées comme des pharmacies pilotes réelles tant que les données/équipes réelles n'ont pas été fournies.
- Aucune nouvelle table, migration ou dépendance ajoutée pour ce chantier.

### Architecture des comptes pharmacie — consolidée en Production
- Une pharmacie reste une seule entité côté client : un seul stock, une seule identité et les mêmes réservations pour toute l'équipe.
- Le compte principal de la pharmacie est le **Promoteur**. L'équipe NAXA crée la pharmacie et son compte Promoteur ; la pharmacie devient ensuite autonome.
- Le Promoteur est le compte parent : il crée, bloque et réactive les comptes **Caisses** enfants.
- Les Caisses sont des utilisateurs opérationnels de la même pharmacie, pas des sous-pharmacies. Elles partagent le stock, les réservations et le statut de garde de leur pharmacie.
- Un compte Caisse bloqué perd son accès opérationnel sans désactiver la pharmacie ni les autres caisses.
- La formation terrain doit utiliser les comptes Caisse pour apprendre l'import et la gestion quotidienne du stock, afin que l'équipe pharmacie prenne elle-même la main.

### Règles de gouvernance
- PR #21 : architecture Promoteur parent / Caisses enfants, fusionnée dans `main` par squash après évaluation complète.
- Déploiement Production issu de la consolidation PR #21 : READY sur le projet Vercel existant `naxa`.
- Contrôle post-déploiement : commit `5ad95ce30dd43b3c140e0048606c81dd5143e490`, Vercel READY, aucun log runtime `error/fatal` sur les 30 premières minutes contrôlées.
- Aucun déploiement Preview volontaire.
- Production uniquement après évaluation complète et autorisation explicite.
- Aucune suppression ou réécriture destructive.
- Le prompt maître et le cahier des charges restent prioritaires.

## Production
- Projet Vercel existant : `naxa`.
- Déploiement Production courant : `dpl_CcFGneLjZjBSLQ32Mccww6vjwAD6`, commit `5ad95ce30dd43b3c140e0048606c81dd5143e490`, état **READY**.
- Alias Production : `naxa-opal.vercel.app` et `naxa-naxa3.vercel.app`.
- Le déploiement provient de `main` après fusion de PR #21.
- Contrôle post-déploiement : état Vercel READY ; statut GitHub Vercel SUCCESS ; aucun log runtime error/fatal trouvé sur la fenêtre de contrôle de 30 minutes.
- Aucun nouveau projet Vercel et aucun Preview volontaire.

## Prochain point du cahier des charges
La consolidation technique est terminée et la fonctionnalité Promoteur/Caisses est en Production. Il reste la **mise en service terrain réelle** :
1. identifier 3 à 5 pharmacies pilotes réelles ;
2. créer leurs comptes Promoteur via l'accès NAXA `/admin` ;
3. faire créer/activer par chaque Promoteur les comptes Caisses de son équipe ;
4. importer leurs stocks réels via le mécanisme existant ;
5. vérifier fraîcheur, prix, quantités, péremptions et formats ;
6. former les équipes à `/pharmacie` (réservations, stock, statut de garde, hors connexion) ;
7. valider le parcours complet sur données réelles avant de passer au chantier Qualité.
Le chantier suivant devra préserver les règles : aucune auto-inscription pharmacie, aucun numéro WhatsApp côté client, aucune livraison, réservation/paiement facultatifs.


## État de consolidation (9 octobre 2026)
Une branche isolée `integration/naxa-360-20261009` rassemble les versions candidates les plus récentes du registre fonctionnel, des parcours Client/Caisse/Pharmacien/Pilotage, des composants partagés, des documents métier, des migrations additives et des tests SQL. La configuration CircleCI de contrôle des migrations et de la suite SQL a été reprise depuis la branche de rejeu.

**Important :** cette consolidation n’est pas encore certifiée verte. Le rejeu et la suite de 52 tests doivent fournir des résultats vérifiables; aucun changement Production ni déploiement n’a été effectué. Ne pas appliquer manuellement les migrations de cette branche à Production.


## Vérification SQL ciblée — 9 octobre 2026, session de reprise
**Résultat : ROUGE / NO-GO MAIN.** Contrôles effectués sur la base de test isolée `naxa-ci-replay-2` (projet `pwfftcsjyeibxxqhwysw`), jamais sur Supabase Production.

- Historique SQL observé avant rejeu complémentaire : 62 entrées de migration.
- La migration source `migration_059_pos_ticket.sql` échoue sur `row_number() over (...)` dans un `UPDATE` (PostgreSQL 42P20). Après correction temporaire exclusivement dans la base de test, elle échoue aussi sur `setval(..., 0)` lorsque la table `ventes` est vide (22003). Au moment de cet audit initial, le fichier source n'avait pas encore été modifié ; il a depuis été corrigé sur la branche d’intégration. Une variante corrigée a été appliquée sous un nom de diagnostic distinct pour poursuivre le contrôle des migrations suivantes ; la base de test n'est donc plus un rejeu canonique propre et doit être recréée/réinitialisée avant la preuve finale.
- Migrations source 051 à 058, puis 060 à 065 appliquées à la base de test ; la variante diagnostique 059 a permis de poursuivre. Cela ne constitue pas une preuve que le rejeu CircleCI de la branche source passe.
- 32 fichiers de tests SQL candidats exécutés individuellement : 18 sans erreur SQL remontée par le connecteur, 13 en erreur/assertion, 1 bloqué par le contrôle de sécurité de l'outil. Ces résultats individuels ne remplacent pas le runner `psql -v ON_ERROR_STOP=1` ni la preuve de la suite complète.
- Échecs observés : test 018 sans fixtures (2 profils + 3 pharmacies attendus) ; test 019 avec deux assertions en échec ; test 020 autorisations avec fixture insuffisante ; test 020 caisse avec « C10 architecture non effective » ; plusieurs tests Promoteur (026, 027, 029, 030, 031, 033, 035, 036, 039) échouent sur une contrainte CHECK de `profiles`.
- Contradiction de schéma confirmée sur `profiles` : contraintes simultanées `profiles_fonction_interne_check` (catalogue étendu) et `profiles_fonction_interne_ck` (limite à `responsable`), ainsi que deux contraintes de niveau hiérarchique aux plages différentes. La correction doit être additive et testée ; aucune migration déjà appliquée en Production n'a été modifiée.
- Alerte de sécurité sur la base de test : RLS désactivée sur `public.abonnements` et `public.naxa_architecture_niveaux`. Aucune activation automatique effectuée, car les politiques d'accès doivent être examinées avant de risquer un verrouillage ou une exposition.
- Les fichiers de migrations source 051–065 sont bien présents dans la branche d'intégration. En revanche, l'historique de la base de test était arrêté au socle 050 : les migrations 051–058 et 060–065 ont donc été appliquées manuellement pour poursuivre le diagnostic, avec une variante temporaire de 059 uniquement en base de test. Le fichier source 059 a maintenant été corrigé sur la branche d’intégration (commit `23bc21dab4ab4daaa8f5b818dd2f1015edb1ae53`) : la fenêtre est calculée dans un CTE avant UPDATE et le recalage de séquence accepte une table vide. Les deux clauses ont été exécutées sans erreur sur la base de test déjà utilisée pour le diagnostic, et `nextval()` a renvoyé 1. Ce contrôle ciblé ne remplace pas un rejeu complet sur une base propre.

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

## Chantier isolé — estimation taxi à Yaoundé (branche `feat/yaounde-taxi-estimate`)

- Ajout de `src/lib/taxi.ts` : estimation en FCFA à partir de la distance routière calculée par le module de trajet existant.
- La page `/resultats` affiche une fourchette de prix indicative et précise que le barème reste provisoire, non validé sur le terrain.
- Aucun changement de schéma, aucune migration SQL, aucune clé/API payante, aucune écriture Supabase Production.
- Limite connue : le facteur de circulation existant est une estimation par horaires, pas une mesure du trafic en temps réel. Le coût taxi n'est pas un tarif officiel et doit être calibré à partir de courses réelles à Yaoundé.
- Validation encore requise : installation/build/lint et tests manuels sur mobile avec plusieurs distances, absence GPS et itinéraire OSRM indisponible. Ne pas fusionner ni déployer en Production avant validation explicite.


## Chantier isolé — photos de pharmacies et périodes de garde à Yaoundé

- Ajout d'une migration additive `supabase/migration_070_pharmacie_photos_garde.sql` : chemin de photo locale, source et licence, date de vérification, début/fin de garde et source/date de vérification de la garde.
- Les RPC `search_pharmacies` et `search_pharmacies_panier` ne sont pas modifiées : les métadonnées sont chargées par une requête complémentaire, afin de ne pas casser leurs signatures de retour.
- Les résultats utilisent `public/pharmacies/placeholder.svg` si aucune photo locale valide n'est enregistrée ou si l'image échoue à charger. Le chemin est limité à `/pharmacies/nom-de-fichier`; les URL externes ne sont pas utilisées comme images de fiche.
- Une garde datée n'est annoncée comme confirmée que pendant l'intervalle `garde_debut <= maintenant < garde_fin`. L'ancien booléen `de_garde`, sans période datée, est présenté comme « Garde signalée · période à confirmer ».
- Le test SQL `supabase/tests/070_pharmacy_photos_duty_period.sql` vérifie les huit colonnes et la contrainte de cohérence de période. Le préflight CircleCI est ajusté à 84 migrations et 54 tests.
- Aucune photo réelle n'a encore été importée : la licence et l'association de chaque image doivent être vérifiées avant d'ajouter des fichiers dans `public/pharmacies/` et de renseigner `photo_path`.
- La migration et le test n'ont pas été exécutés contre Supabase Production. Build, lint et CI du nouveau HEAD doivent être vérifiés avant tout feu vert. Aucune fusion, aucun déploiement et aucune écriture Production.


## Données de garde — Yaoundé (11 octobre 2026)

- Jeu de collecte daté : `docs/yaounde-garde/2026-10-10_2026-10-12.csv` (19 lignes publiées par Mfasha pour le 10 octobre 08:00 au 12 octobre 08:00, heure du Cameroun).
- Méthode, sources et divergences : `docs/yaounde-garde/README.md`.
- Contrôle structurel reproductible : `python scripts/validate_yaounde_garde.py`.
- **Ces données sont non confirmées pour publication client** : les sources secondaires disponibles concernent principalement d'autres dates. Elles servent à la vérification seulement; aucun import DB n'a été fait.


## Géolocalisation des pharmacies — pilote Yaoundé

Le référentiel initial est décrit dans [docs/STATUT-GEOLOCALISATION-PHARMACIES.md](docs/STATUT-GEOLOCALISATION-PHARMACIES.md). La migration candidate `supabase/migration_071_geolocalisation_pharmacies_yaounde.sql` stocke les coordonnées sourcées dans un référentiel distinct et ne crée aucune pharmacie partenaire. Seules les correspondances exactes avec des pharmacies déjà présentes peuvent recevoir ces coordonnées, avec le statut explicite `source_publique_a_confirmer`. Les positions publiées ne sont pas certifiées sur le terrain. Le contrôle statique se lance avec `npm run test:geolocalisation`. Aucun changement Production ni fusion dans `main` n'est autorisé par ce chantier.


## Prototype de recherche catalogue médicaments — 11 octobre 2026

La branche feat/catalogue-medicaments-api-prototype ajoute une recherche de catalogue informative en direct via RxNorm, OpenFDA et DailyMed. Le pilote contient dix termes de recherche : paracétamol, amoxicilline, artéméther/luméfantrine, ibuprofène, métronidazole, cétirizine, oméprazole, ciprofloxacine, diclofénac et azithromycine. Cette liste sert à tester les correspondances; ce n'est pas un classement des ventes au Cameroun.

Les cartes affichent nom, marque si disponible, substance active, forme, définition et indications générales uniquement si les sources les renvoient. Aucun dosage n'est rendu dans les résultats, la fiche produit ou le panier. Les photos ne sont montrées que si DailyMed fournit une image d'un document correspondant à la recherche; sinon un visuel neutre signale l'absence de photo. Une image DailyMed peut représenter un produit américain, pas le conditionnement vendu au Cameroun.

Le bouton de chaque résultat ouvre la recherche de stock existante. Disponibilité, prix et réservation restent exclusivement issus des données des pharmacies partenaires NAXA. Aucun stock n'est inféré des API externes. Les appels externes sont limités par délai et les réponses sont mises en cache une heure.

Contrôle source : npm run test:catalogue-medicaments. Le test source et la compilation CI ne prouvent pas encore que les API répondent en production ni que les dix recherches renvoient toutes une photo. Aucune migration, écriture Supabase, modification de main ou déploiement Production n'est réalisée par ce prototype.


## Alignement parcours/RPC — 11 octobre 2026

Branche isolée : `fix/parcours-rpc-permissions-align-20261011` (base `main` `d9ce9e3af6f3818f4e059542cbc429dfe2df6b02`). Aucun changement sur `main`, aucune écriture Supabase Production et aucune migration existante modifiée.

- Récupération des comportements de référence depuis les diffs historiques des PR #39 et #47 : ticket POS et numérotation (059), paiement opérateur (064), consultation/prescription Pharmacien (065), métadonnées de garde (070) et géolocalisation (071).
- Caisse : la page utilise maintenant les lignes renvoyées par `vente_ticket` pour produire un ticket imprimable dédié ; le paiement électronique est refusé côté interface si la référence opérateur est vide ; le poste est choisi explicitement s'il existe plusieurs caisses.
- POS : le nouveau RPC additif `vente_encaisser_finaliser` regroupe l'encaissement et la finalisation dans une seule transaction, et reprend un paiement complet déjà enregistré sans le dupliquer ; test structurel ajouté.
- Garde : ajout additif de `migration_071b_periode_garde_rpc.sql` et de son test structurel ; le panneau pharmacie permet de saisir début/fin/source et d'enregistrer ou retirer une période par RPC, sans modifier la migration 070 ni le RPC historique `set_garde`.
- Le compteur CircleCI de la branche est ajusté à 89 migrations et 58 tests SQL.
- CI : un précédent `sql_tests` a échoué sur le commit `eefb2218db500a64fad1ef363f159dcb73ee06a0`. Les nouveaux tests SQL ont été corrigés pour émettre une assertion positive, exigée par le runner ; ce correctif reste à confirmer par une exécution finale. Aucun feu vert n'est déclaré.
- Rectification d'audit : la version de `migration_059_pos_ticket.sql` présente dans `main` utilise déjà un CTE pour calculer `row_number()` avant l'UPDATE et un `setval(..., greatest(max_numero, 1), max_numero > 0)`. La précédente conclusion affirmant que ces deux constructions problématiques restaient présentes dans `main` était erronée ; l'historique README décrit un diagnostic antérieur.


## Correctif CI SQL — 11 octobre 2026

- Cause confirmée dans `.circleci/config.yml` : les contrôles comparaient le nombre de migrations à `85` et le nombre de tests SQL à `54`, alors que les messages et le dépôt indiquent respectivement `89` et `58`. Le préflight affichait donc `89 trouvé / 89 attendu` tout en quittant avec le code 1.
- Les deux seuils ont été alignés sur `89` migrations et `58` tests dans le correctif `6c747312fc48534511023be2428f534ea75436d8`.
- État : correctif poussé uniquement sur `fix/parcours-rpc-permissions-align-20261011`. Le nouveau résultat CI doit encore confirmer la correction; aucun feu vert SQL n'est déclaré. Aucun changement sur `main` ni en Production.
