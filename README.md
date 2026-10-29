> **ÉTAT OPÉRATIONNEL — actualisé le 29 octobre 2026**

> **Audit 360° du parcours Promoteur — 29/10/2026 :** reprise active conformément au prompt maître. Le contrôle Supabase confirme la présence du socle convention/abonnement/règlement/réseau avec RLS; le parcours métier, les routes UI/API et les parties 3–6 du Pilotage Promoteur ne sont pas encore certifiés. Rapport et preuves : [Audit 360° du parcours Promoteur](docs/audits/AUDIT_360_PARCOURS_PROMOTEUR_NAXA.md). Aucun déploiement manuel n'a été lancé.

>
> La branche GitHub `main` est la seule source de vérité du code NAXA. Le protocole canonique est défini dans `AGENTS.md` : corrections ciblées sur `main`, sans nouvelle branche. Aucun déploiement manuel n'est lancé sans autorisation explicite. Les écritures Supabase Production restent interdites sans autorisation et périmètre explicites; pour la présente passe, l'utilisateur a explicitement autorisé six migrations additives ciblées, appliquées et vérifiées le 29 octobre. Voir `docs/CONTRADICTIONS.md` pour les preuves, les statuts et les limites restantes. Les derniers correctifs vérifiés concernent la suppression d'un index strictement dupliqué sur `stocks_lots` et le durcissement du `search_path` de quatre fonctions SECURITY DEFINER (deux fonctions de catalogue et deux helpers RLS); aucun déploiement manuel n'a été lancé.

> **Crédit Marketplace / stock — état au 29 octobre 2026 :** la passe d'implémentation est documentée comme clôturée **avec réserve de validation runtime** ; le sous-chantier n'est pas certifié vert. L'audit détaillé et la condition précise de réouverture figurent dans [docs/audits/AUDIT_360_ADMINISTRATEUR_NAXA.md, § 60.42](docs/audits/AUDIT_360_ADMINISTRATEUR_NAXA.md). Les contrôles Supabase en lecture seule confirment que le contrat de migration 247 et la RPC de retrait 252/256 ne sont pas présents dans les schémas inspectés. La validation conjointe des tests 247, 256 et 257 nécessite un runner PostgreSQL isolé. **Aucune migration, modification de données ni déploiement n'a été réalisé dans cette passe.**

> **Administration — validation initiale d’un dossier pharmacie (29 octobre 2026) :** le formulaire est relié à la fiche `/admin/pharmacies/[id]` et limité aux ouvertures encore en attente. Une garde applicative et une migration SQL additive empêchent la réinitialisation de la période d’essai d’un Promoteur déjà exploité. La validation initiale exige aussi les sept déclarations reçues et la dernière version validée de chacun des six fichiers requis. Le code et les assertions sont sur `main`; la migration `admin_validate_dossier_pending_only` a été appliquée et vérifiée dans l’historique Supabase le 29 octobre. Le build et la recette visuelle restent non exécutés ; aucun déploiement n’a été lancé.

> **Validité Promoteur — noms et pharmacies dans les alertes (29 octobre 2026) :** les rappels J-5, alertes de paiement et écrans Admin affichent désormais le nom complet du Promoteur et ses pharmacies rattachées. Le code est sur `main`; la migration `promoteur_notifications_include_pharmacies` a été appliquée et vérifiée dans l’historique Supabase le 29 octobre. La recette métier et le déploiement restent non effectués.

# NAXA : base de l'application

## Authentification et introduction (état du 14 octobre 2026)

- Le flux Google utilise une route serveur OAuth et un callback qui échange le code contre une session. Les comptes ayant une identité Google liée sont traités comme des accès clients ; les gardes de route conservent le contrôle du profil incomplet.
- L'OTP d'inscription est natif Supabase : émission par `signInWithOtp`, validation par `verifyOtp` de type `email`, code conservé comme texte, verrou anti-double vérification et contrôle du délai de renvoi. Les erreurs de session (plafond de quatre appareils), de code expiré et de limitation d'envoi sont des cas distincts.
- L'introduction animée `IntroNaxa` est une animation React/CSS pilotée par `requestAnimationFrame`, sans fichier vidéo ni ressource externe. L'ambulance globale est opt-in et n'est activée que par les boutons autorisés.

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


## Chantier fonctions métier et validation pharmaceutique à distance

La spécification de référence du chantier est `docs/naxa-fonctions-validation-distance.md`. Le travail est isolé sur `feat/naxa-fonctions-validation-distance`; il ne modifie pas `main` ni Production. Les fonctions métier restent distinctes de `role_type` et des niveaux N0–N4. La migration candidate `supabase/migration_072_fonctions_validation_distance.sql` ajoute le catalogue des fonctions, les privilèges de validation, un dossier de validation et un stockage privé pour les documents. La page candidate est `/pharmacien/validations`.

**État : candidat non validé.** Ne pas appliquer la migration à Production. La migration SQL, le stockage privé, le parcours navigateur, le rejeu SQL complet et les contrôles CI doivent réussir sur le HEAD exact avant toute demande de validation métier ou fusion.

Correctif de compatibilité du schéma Production (11 octobre 2026) : l'inspection de Supabase Production a confirmé que `public.naxa_privileges` expose `code`, `family`, `description`, `niveau_min`, `niveau_max`, `delegable`, `governance`, `active` et `created_at`, sans `famille`, `libelle` ni `governance_only`. La migration 072 insère maintenant uniquement les colonnes présentes, en synchronisant les alias facultatifs quand ils existent sur une base de test. Le test SQL vérifie les huit privilèges et la cohérence du schéma sans référencer directement les colonnes facultatives. Correctif source uniquement : ne pas fusionner ni appliquer à Production avant un rejeu SQL complet et la vérification des dépendances 043–070 absentes de l'historique Production.

### Correction du moteur de privilèges — 11 octobre 2026
La migration candidate 072 étend désormais `private.naxa_business_function()` et `private.naxa_has_privilege()` aux fonctions internes Pharmacien, Préparateur, Agent d'accueil, Comptable, Gestionnaire de stock et Magasinier. Les droits restent bornés par l'architecture active, le scope de la pharmacie et la délégation effective dans `naxa_profile_privileges`; aucune élévation de `role_type` et aucun droit implicite ne sont ajoutés. Le test 072 vérifie la présence de ces garde-fous. **Validation en attente :** le nouveau HEAD doit obtenir un rejeu SQL complet et les statuts CI finaux avant toute fusion. Aucune écriture Production.


Correctif de périmètre réseau (11 octobre 2026) : `private.naxa_has_privilege(..., p_pharmacie, 'RESEAU')` vérifie maintenant explicitement `public.naxa_scope_allows(uid, p_pharmacie, 'RESEAU')` lorsqu'une pharmacie cible est fournie. Un droit réseau sans cible reste valable pour le réseau du Promoteur, tandis qu'une pharmacie hors réseau est refusée. Correctif source sur la branche isolée; tests SQL/CI finaux encore requis, aucune écriture Production.


## Correctif inscription — validation pays/téléphone (11 octobre 2026)

La migration additive `supabase/migration_073_signup_phone_validation.sql` corrige le défaut de branchement de `handle_new_user()` : un numéro conforme dans un pays pris en charge est accepté; un numéro mal formé ou un pays inconnu est rejeté. La migration historique 006 n'est pas modifiée. Le test `supabase/tests/073_signup_phone_validation.sql` couvre les 11 pays pris en charge, les longueurs invalides, le pays inconnu et le téléphone absent.

**État : correctif source isolé sur `fix/signup-phone-validation`; CI et rejeu SQL restent à vérifier. Aucun changement Supabase Production, aucune fusion et aucun déploiement.**


## Sélecteur de pays téléphone — fermeture au clic extérieur (11 octobre 2026)

- Le sélecteur de pays de `/creation-compte` se ferme désormais lorsqu’un pointeur est pressé n’importe où hors du composant, y compris sur mobile (événement `pointerdown`).
- La flèche continue d’ouvrir/fermer la liste; choisir un pays met à jour le pays et l’indicatif, vide l’ancien numéro et ferme la liste.
- La touche Échap ferme également la liste. Les écouteurs globaux ne sont installés que pendant l’ouverture et sont retirés à la fermeture/démontage.
- Correctif source uniquement sur `fix/signup-phone-validation`. Aucun changement `main`, aucune écriture Supabase Production et aucun déploiement. Les contrôles CI/build restent à confirmer.


## Messagerie et préférences client (branche de travail)

Les migrations additives `075_messagerie_notifications_preferences.sql` et `076_produits_ordonnance_fabricant.sql` ajoutent les fondations de messagerie sécurisée, les préférences client et les métadonnées produit. Tests structurels associés : `supabase/tests/075_messagerie_notifications_preferences.sql` et `supabase/tests/076_produits_ordonnance_fabricant.sql`. Voir `docs/MESSAGERIE-CLIENT-PHARMACIE.md` pour les limites et la configuration OAuth. Ces changements sont en cours de revue sur une branche et ne sont pas déclarés validés ni déployés.

## Authentification et introduction animée — 14 octobre 2026

- OAuth Google conserve le callback serveur et force les utilisateurs Google vers le parcours client ; un profil Google incomplet passe par `/completer-profil` avec `/client` comme destination finale.
- L'inscription utilise l'OTP natif Supabase (`signInWithOtp` puis `verifyOtp(type: "email")`). Le composant OTP bloque les doubles vérifications et journalise le code d'erreur Supabase sans exposer le code OTP ni l'adresse e-mail.
- Le sélecteur de pays a une couche d'affichage supérieure et une hauteur plafonnée.
- `IntroNaxa` est une animation React/CSS/SVG sans fichier vidéo ni dépendance externe, ouverte depuis le logo quand sa destination est l'accueil public.
- URI Google Cloud autorisée : `https://eouwtuusnsuxaejsxknf.supabase.co/auth/v1/callback`. Les Redirect URLs Supabase doivent inclure le domaine de production et les previews Vercel.


## Corrections authentification et animation — 14 octobre 2026

- Sélecteur de pays de l’inscription : menu rendu en portail fixe, au-dessus du contenu, avec fermeture au clic extérieur, repositionnement sur redimensionnement/défilement et hauteur défilante adaptée au viewport mobile.
- OTP : type d’inscription confirmé (`signInWithOtp` puis `verifyOtp(type: "email")`), délai de renvoi porté à 60 secondes, texte d’aide en double supprimé et dimensions des cases stabilisées.
- Diagnostic Production : les journaux Auth montrent des refus `500 unexpected_failure` associés à `NAXA_SESSION_LIMIT_REACHED` (plafond de quatre sessions actives), distincts des `403 otp_expired`. Le plafond métier reste intact et aucune écriture Production n’a été faite.
- Ambulance : le composant global est désormais opt-in via `data-naxa-ambulance="true"`; seules les actions « Connexion » et « Chercher » portent cet attribut.
- Introduction : correction du calque de l’ancienne phrase pendant le balayage du pendule ; l’animation reste codée en React/CSS/SVG, sans fichier vidéo ni dépendance externe.
- OAuth Google : la route serveur construit déjà le callback depuis l’origine de la requête et conserve `next` dans `/auth/callback`. La liste des URL autorisées Supabase et l’URI Google Cloud doivent être vérifiées côté fournisseur ; cette configuration externe n’est pas modifiable via les outils de dépôt.

- Reprise d’inscription après rafraîchissement : les champs `signup.*` sont conservés uniquement dans `sessionStorage` pour 30 minutes, jamais envoyés comme profil applicatif avant confirmation OTP et finalisation; ils sont effacés après création complète du profil.


## Correctif OTP inscription — 14 octobre 2026
- La validation de l’OTP d’inscription passe par `/api/auth/signup-otp/verify`, qui contrôle le plafond de 4 sessions avant d’appeler `verifyOtp(type: "email")`.
- Si le compteur de sessions est indisponible ou si le plafond est atteint, le code n’est pas consommé par l’étape de vérification ; le serveur renvoie une erreur explicite.
- Le parcours continue d’utiliser l’OTP natif Supabase. Le modèle d’e-mail, l’expiration OTP et les Redirect URLs restent des réglages Supabase distincts du code applicatif.

## Configuration OAuth Google — contrôle externe requis (14 octobre 2026)
Le code utilise une URL de retour dynamique (`window.location.origin` via la route serveur `/api/auth/google`) et `/auth/callback` échange le code OAuth contre une session en conservant les cookies. Si Google revient sur l’accueil public, contrôler l’autorisation du domaine de prévisualisation dans Supabase : une URL non autorisée peut empêcher le retour vers le domaine demandé.

Dans **Supabase → Authentication → URL Configuration** :
- **Site URL (production)** : `https://naxa-naxa3.vercel.app`
- **Redirect URLs** : `https://naxa-naxa3.vercel.app/auth/callback`
- **Redirect URLs (prévisualisations Vercel)** : `https://naxa-*-naxa3.vercel.app/auth/callback`
- Si un domaine de production personnalisé est utilisé, ajouter également `https://VOTRE-DOMAINE/auth/callback` et le définir comme Site URL canonique.

Dans **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs**, l’URI doit pointer vers le callback Supabase du projet, et non vers Vercel :
`https://eouwtuusnsuxaejsxknf.supabase.co/auth/v1/callback`

Ces valeurs sont documentées à partir des domaines actuellement connus. Les paramètres Supabase et Google Cloud ne peuvent pas être prouvés par le seul build du dépôt ; aucun secret ni aucune configuration fournisseur n’a été modifié par ce correctif.


## Espace Promoteur — refonte visuelle (22 octobre 2026)

- Navigation dédiée dans `src/components/pharmacie/NavPromoteur.tsx` : barre fixe de 240 px sur grand écran, rail persistant de 56 px sur téléphone/tablette, panneau étendu, fermeture par clic extérieur ou Échap, et suivi de la section visible.
- Tableau de bord Promoteur en cartes bento, KPI, contrastes renforcés et animations CSS sobres respectant `prefers-reduced-motion`. Les compteurs ne s'animent que pour les valeurs constituées d'entiers purs.
- L'écran d'accès restreint conserve ses textes, conditions et liens ; seul son habillage est harmonisé.
- Le contenu métier, les requêtes, les calculs, les routes et les composants `AvisRappelsLotsPromoteur` / `CaisseSecurityManager` restent inchangés. Les entrées « Marketplace & réservations » et « ERP & opérations » gardent la même URL existante ; elles ne reçoivent donc pas d'état actif distinct.
- Changements directs sur `main`, sans branche ni pull request. Aucun déploiement manuel lancé. Le push sur `main` peut toutefois déclencher un pipeline automatique selon la configuration du dépôt.


## Promoteur — restructuration ciblée (22 octobre 2026)

- Les entrées Marketplace et ERP transmettent `module=marketplace` et `module=erp` à l'espace opérationnel existant. Le moteur reste `/pharmacie?vue=operation` ; sans `module`, le parcours reste inchangé.
- Le Centre d'aide accepte un Promoteur actif et limite les conversations aux pharmacies reliées via `promoteur_pharmacies`. L'envoi de réponse vérifie le périmètre du ticket côté serveur.
- Pilotage et Rapports adoptent le fond vert NAXA, l'en-tête vert foncé et un lien de retour à l'espace Promoteur.
- La séparation complète en sous-pages et la barre d'onglets ne sont pas incluses : le chargement monolithique doit être déplacé dans une fonction serveur partagée avant d'extraire les sections sans dupliquer les requêtes.


## Promoteur — sécurisation de l’aide et préparation du logo (22 octobre 2026)
- `/pharmacie/aide` et `envoyerMessageChat` sont réservés au rôle pharmacie pour protéger les conversations client.
- Le Centre d’aide Promoteur est séparé sur `/pharmacie/promoteur/aide`, avec FAQ et contacts NAXA.
- La colonne `pharmacies.logo_url` a été ajoutée en Production. L’upload et l’impression restent désactivés tant que les politiques Storage dédiées ne sont pas confirmées.
- Le mode Marketplace masque les raccourcis ERP et les blocs communs du tableau opérationnel ; le mode sans paramètre conserve son affichage habituel.


## Espace Promoteur — sous-pages

Chargeur serveur mutualisé avec `React cache()`, layout commun, rail de navigation et huit onglets de sous-pages. La supervision Pharmacien est agrégée et n’expose aucune donnée patient. Le profil affiche les informations disponibles et dates de rattachement. Le formulaire de changement de mot de passe vérifie le mot de passe actuel, impose huit caractères minimum et applique la limitation des tentatives. L’upload et l’impression du logo restent exclus jusqu’à validation d’une politique Storage strictement limitée.


### Logo de pharmacie sur les tickets

Les logos sont stockés dans `pharmacies-photos/logos/<pharmacie_id>/`. Les politiques d'écriture Storage sont limitées au Promoteur actif lié à une pharmacie active. L'API serveur vérifie le rôle et le lien avant toute modification de `pharmacies.logo_url`.


### Audit 360° du parcours Promoteur — mise à jour ciblée (29/10/2026)
Le contrôle SQL direct ferme le point d'accès applicatif de `reactiver_promoteur(uuid,text)` : EXECUTE est refusé à `anon`, `authenticated` et `service_role`. Les deux RPC de règlement sont, elles, réservées à `service_role`; la vérification suivante porte donc sur leurs routes appelantes et l'identité qu'elles transmettent. Le suivi de reprise et les preuves sont consignés dans [le rapport d'audit Promoteur](docs/audits/AUDIT_360_PARCOURS_PROMOTEUR_NAXA.md). Aucun déploiement ni aucune écriture métier n'ont été réalisés.



### Audit 360° Promoteur — étape au 29/10/2026
La revue statique des deux routes de règlement est clôturée : l'identité Promoteur et Admin est déterminée côté serveur, et les RPC sont réservées à `service_role`. Les tests d'intégration restent non exécutés. La reprise est maintenant centrée sur la partie 3 (accréditation Responsable et privilèges) avec comparaison des façades SQL de Production aux migrations de réconciliation. Aucun test fixture ni déploiement n'a été lancé en Production.


### Audit 360° Promoteur — point de vigilance actif
La revue des fonctions de validité a révélé une différence entre la définition du helper `private.naxa_promoteur_valide` dans la migration 147 et celle réellement active en Production. L'écart est documenté dans le rapport d'audit; aucun impact immédiat n'est détecté sur l'unique Promoteur actuellement en base. La correction est suspendue jusqu'à l'identification de la migration ou de l'action qui a redéfini la fonction.


### Audit 360° Promoteur — correction préparée, non appliquée (29/10/2026)
Le helper privé de validité active en Production ne correspond pas au contrat de la migration 147. Une migration additive et un test ciblé sont préparés sur `main`, mais ils ne sont ni appliqués ni exécutés. La partie 3 reste non certifiée jusqu'à une validation dans un environnement Supabase non-Production. Détails et preuves : [rapport d'audit Promoteur](docs/audits/AUDIT_360_PARCOURS_PROMOTEUR_NAXA.md).


### Audit Promoteur — validation test-only actualisée (29/10/2026)
La façade publique de validité a été réalignée sur l'environnement Supabase non-Production `naxa-ci-replay-2`. Les tests SQL statiques 147 et PVH sont PASS, ainsi que le test comportemental 028 avec rollback confirmé. Les scénarios comportementaux d'architecture absente, réseau inactif et incohérence pharmacie/architecture restent à certifier. Le helper privé de Production n'a pas été corrigé; aucune migration Production, aucun déploiement et aucun workflow relancé. La partie 3 demeure partielle. Voir [rapport d'audit Promoteur](docs/audits/AUDIT_360_PARCOURS_PROMOTEUR_NAXA.md).


### Audit Promoteur — progression contrôlée (29/10/2026)
Le sous-chantier de réconciliation de la façade dans l'environnement de test non-Production est clos. Les assertions SQL ciblées 147/PVH et le test comportemental 028 sont PASS, avec rollback confirmé. La partie 3 globale reste partielle : scénarios limites à certifier et helper privé Production non corrigé. L'audit statique de la partie 4 (gestion Caisse, quotas et délégation) a commencé; un point relatif aux transitions de statut des Caisses reste à qualifier. Aucun déploiement ni changement Production. Détails : [rapport d'audit Promoteur](docs/audits/AUDIT_360_PARCOURS_PROMOTEUR_NAXA.md).


Mise à jour de l'audit Promoteur : les scripts SQL exacts 147, PVH et 141 passent sur le replay non-Production. Le test 156 révèle un replay incomplet (garde d'activation et trigger absents du replay, présents en Production). Les tests comportementaux 029–031 restent à exécuter dans un environnement adapté; la partie 4 n'est pas certifiée. Aucun changement Production ni déploiement.


### Audit Promoteur / gestion Caisse — contrôle ACL (29/10/2026)
Un écart d'ACL a été identifié sur les RPC de provisionnement, statut, attribution et révocation Caisse : `service_role` pouvait les exécuter en Production, alors que les appels UI recensés utilisent le client authentifié. Un correctif additif et son test ACL 157 sont présents sur `main`; test PASS sur le replay non-Production uniquement. **Aucune migration Production ni aucun déploiement n'ont été effectués.** La partie 4 reste en audit tant que les tests comportementaux 029/030/031 ne sont pas validés sans désactivation de triggers.


### Audit 360° Administrateur — état au 29 octobre 2026
Le point 3 du sous-chantier crédit Marketplace est clos côté code et validation technique isolée. Les tests SQL 247, 251, 252, 255, 256, 257, 258 et l'E2E réel 259 passent sur `naxa-ci-replay-2`; les fixtures transactionnelles sont annulées. Les correctifs couvrent la déduction des holds actifs dans la disponibilité Marketplace, la consommation des lots affectés à la réservation, la finalisation cohérente de la vente POS crédit et la complétude du reçu. Aucun changement de schéma ou de données Production et aucun déploiement n'ont été réalisés. Le point 4 est engagé : le test structurel des notifications J−5/règlements avec noms des pharmacies passe sur le replay; preuve de délivrance runtime et recette UI restent à faire. Détails : [audit Administrateur § 60.44](docs/audits/AUDIT_360_ADMINISTRATEUR_NAXA.md).
