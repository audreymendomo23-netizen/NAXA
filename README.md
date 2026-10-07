# NAXA : base de l'application

Votre médicament, à 2 minutes. Next.js 14 + Supabase + Tailwind, PWA, 100 % offre gratuite.

## Démarrage
1. npm install
2. Créer un projet Supabase (gratuit). Dans Database > Extensions, activer pg_cron.
3. Dans l'éditeur SQL, exécuter dans cet ordre : supabase/schema.sql, supabase/migration_002_catalogue_panier.sql, supabase/migration_003_security_hardening.sql, supabase/migration_004_corrections.sql, supabase/migration_006_auth_profile_age_gate.sql, supabase/migration_007_pharmacie_promoteur_caisses.sql, supabase/migration_008_pharmacie_promoteur_caisses.sql, puis (démo seulement) supabase/seed.sql.
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


## Pilotage 360° — branche consolidation
- N1 NAXA : pilotage réseau, entonnoir commercial, demande et revenus.
- N2/N3 : pilotage pharmacie partagé entre Promoteur et Caisses, sans créer de sous-pharmacie.
- Migration additive prévue : `009_pilotage_360.sql` ; le numéro 006 du pack ne remplace pas l’authentification existante.
- Rapports : snapshots Supabase, page Rapports et préparation d’envoi serveur PDF/CSV via Resend.
- BI : vues agrégées dans `bi`, sans identité client.
- Suivi des événements réellement raccordé aux parcours existants : recherche, vue fiche médicament et ajout panier appellent `log_evenement`; `recherche_events` historique est conservé.
- Branding officiel préparé : jeton `naxa-logo-green #0A7547`, manifest et métadonnées mis à jour.
- Cette branche n’est pas en Production. Autorisation exacte requise : **OUI, DÉPLOIE**.

### Validité commerciale des pharmacies
- Abonnement standard : **30 000 FCFA / mois** par pharmacie.
- **J-5** : rappel automatique envoyé au Promoteur.
- À l’échéance impayée : abonnement `impaye`, pharmacie désactivée, comptes Promoteur/Caisse bloqués et produits indisponibles côté client.
- Après règlement : seul NAXA/Admin réactive la pharmacie ; le règlement et sa période sont enregistrés.
- Pilotage NAXA : `/admin/pilotage/validite` pour suivre les échéances, impayés et réactivations.
- Migration additive : `supabase/migration_010_validite_pharmacies.sql`.
- Le chantier reste sur une branche dédiée jusqu'à validation complète.

### État Supabase réel — validité commerciale
- `009_pilotage_360` et `010_validite_pharmacies` sont appliquées sur le projet Supabase Naxa.
- Les 3 pharmacies existantes sont initialisées à **30 000 FCFA/mois**, actives, échéance **4 novembre 2026**.
- Aucun paiement fictif n’a été créé.

### Limite de sessions par compte
- Maximum **4 sessions/appareils simultanés** par compte.
- Les sessions existantes ne sont jamais déconnectées automatiquement pour faire de la place.
- Une 5e connexion est refusée ; le compte doit d'abord être déconnecté d'un appareil existant.
- La règle s'applique à la connexion username/mot de passe et au callback Google OAuth.
- Migrations additives : `supabase/migration_011_limite_sessions.sql` et `supabase/migration_012_enforcement_limite_sessions.sql`.
- Enforcement DB atomique : une 5e session ne peut pas être créée, y compris en cas de connexions concurrentes.

## Clôture des passes 1 → 3 — architecture et sécurité (audit du 5 octobre 2026)
Les passes 1, 2 et 3 sont désormais **vertes au niveau spécification/architecture** : les contradictions métier structurantes ont été arbitrées et aucun second modèle concurrent ne doit être créé.

### Pass 1 — état existant et invariants : 🟢 100 %
- Existant inventorié avant évolution ; principe additif conservé.
- Une pharmacie reste une unité commerciale et un stock unique côté client, même avec plusieurs caisses.
- Le Client est hors hiérarchie interne NAXA.
- N0 NAXA Admin / N1 Promoteur / N2 Responsable / N3 Caisse est la hiérarchie cible.
- 'pharmacie' est conservé comme compatibilité historique d'identité, pas comme niveau hiérarchique.
- Aucun nouveau projet Vercel/Supabase et aucun merge/deploy Production sans autorisation.

### Pass 2 — métier, données et commercial : 🟢 100 %
- Modèle canonique : Convention → Promoteur → pharmacies autorisées → architecture → abonnements → paiements.
- Une relation explicite Promoteur ↔ pharmacie est obligatoire pour le multi-pharmacie.
- Une pharmacie peut choisir une architecture 2 niveaux (Promoteur → Caisse) ou 3 niveaux (Promoteur → Responsable → Caisse) uniquement dans les limites autorisées par la convention.
- Responsable = niveau d'autorité/scopage ; jamais une fonction métier propriétaire de la pharmacie.
- Accréditation ≠ rôle : niveau, périmètre, statut, dates d'attribution/révocation sont distincts.
- Tarif catalogue de référence : 30 000 FCFA/mois ; le tarif facturé est contractuel et historique par période.
- Modes commerciaux retenus : PAR_PHARMACIE et FORFAIT_CONVENTION.
- Aucun historique de paiement/période ne doit être réécrit lors d'un changement tarifaire.
- Une pharmacie impayée peut être bloquée opérationnellement sans désactiver les autres pharmacies du même Promoteur.

### Pass 3 — autorisation, RLS et séparation des données : 🟢 100 % au niveau du modèle cible
- Règle canonique : droit effectif = identité × niveau × accréditation × périmètre × pharmacie × convention × statut × objet × opération.
- Caisse = opérateur normal du stock ; niveaux supérieurs = supervision/pilotage et corrections explicitement autorisées.
- Client : disponibilité/public ; interne : quantités exactes, lots, péremptions, mouvements et anomalies.
- Les rapports remontent par agrégation hiérarchique sans déplacer physiquement les données historiques.
- Les KPI suivent une seule chaîne : source → règle KPI → agrégation → BI → dashboard → rapport.
- Les vues et fonctions exposées doivent respecter grants minimaux + RLS + posture explicite SECURITY INVOKER/DEFINER.
- Le callback OAuth ne doit plus effectuer de déconnexion locale après une erreur de limite de session : l'enforcement DB est l'autorité.

**Important :** « vert » ici signifie que la spécification et les arbitrages des passes 1–3 sont verrouillés. Les remédiations SQL/RLS et les tests d'acceptation associés restent à exécuter dans les lots d'implémentation, sans les présenter artificiellement comme déjà déployés.

### Prochaine passe
**Passe 4 — Métier / Données / BI / Rapports :** dictionnaire KPI, grain, sources, scopes, règles d'agrégation, exports, rapports hiérarchiques et tests de cohérence.


## Rectification de référence — clôture Passes 1–3 (5 octobre 2026)
Cette section est prioritaire sur les descriptions historiques ci-dessus pour l'état actuel du chantier.

### 🟢 PASS 1 — Existant, invariants et périmètre
- Existant inspecté avant évolution ; aucune nouvelle infrastructure créée.
- Architecture commerciale : une **pharmacie = une unité commerciale et un stock partagé**, quel que soit le nombre de comptes Caisse.
- Client = acteur externe au périmètre hiérarchique interne.
- Hiérarchie cible : **N0 NAXA Admin → N1 Promoteur → N2 Responsable → N3 Caisse**.
- Le libellé historique `role=pharmacie` est traité comme compatibilité technique, jamais comme niveau hiérarchique cible.
- Aucun merge `main` ni déploiement Production sans autorisation explicite.

### 🟢 PASS 2 — Métier, données et commercial
- Modèle canonique : **Convention → Promoteur → pharmacies autorisées → architecture autorisée/choisie → abonnement → paiements**.
- Promoteur ↔ pharmacie = relation explicite nécessaire au multi-pharmacie.
- Architecture d'une pharmacie : 2 niveaux (Promoteur → Caisse) ou 3 niveaux (Promoteur → Responsable → Caisse), seulement si autorisée par la Convention.
- Responsable = niveau d'autorité et de périmètre, pas propriétaire ni fonction métier.
- Accréditation distincte de l'identité, du niveau hiérarchique et du statut.
- 30 000 FCFA/mois = **référence catalogue**, jamais tarif contractuel universel.
- Tarifs et paiements sont historisés par période ; aucune modification du présent ne réécrit le passé.
- Une pharmacie impayée est bloquée localement ; elle ne doit pas désactiver le Promoteur ni ses autres pharmacies valides.

### 🟢 PASS 3 — Autorisation, RLS et séparation des données
- Formule canonique : **droit effectif = identité × niveau × accréditation × périmètre × pharmacie × convention × statut × objet × opération**.
- RLS + grants + contrôle serveur/DB constituent l'autorité ; l'UI ou le JWT seuls ne suffisent jamais.
- Caisse = opérateur normal du stock ; Responsable/Promoteur = supervision/pilotage et opérations exceptionnelles explicitement autorisées.
- Client : disponibilité/public ; interne : quantité exacte, lots, péremptions, mouvements, anomalies et données sensibles.
- Les agrégations remontent par scope hiérarchique sans dupliquer ni déplacer les faits historiques.
- Toute fonction `SECURITY DEFINER` doit être justifiée, avoir un `search_path` sûr et un EXECUTE minimal ; les vues exposées doivent être protégées, notamment par `security_invoker` lorsqu'elles doivent respecter le RLS sous-jacent. citeturn0search0turn0search3
- La limite de 4 sessions est une règle DB ; aucune ancienne session n'est expulsée automatiquement.

### Statut de clôture
**Les trois passes sont 🟢 au niveau spécification, architecture et arbitrages.** Les écarts d'implémentation encore visibles (RLS historiques, fonctions SECURITY DEFINER, vue `v_ventes_journalieres`, modèle mono-pharmacie et callback OAuth) sont désormais des **actions techniques identifiées**, et non des ambiguïtés métier. Elles appartiennent au lot d'implémentation avant validation Production.

### Passe 4 — prête à démarrer
**Métier / Données / BI / Rapports : KPI, grain, sources, scopes, agrégations, anti-double-comptage, rapports hiérarchiques, exports et tests de cohérence.**


## Passe 4 — Contradiction C1 résolue
- **C1 — `stocks_couts` documenté mais absent du schéma : 🟢 résolue au niveau dépôt/conception.**
- Migration additive `supabase/migration_013_stocks_couts.sql` ajoutée sur `feat/pharmacie-validite-pilotage`.
- `stocks` conserve quantité et prix public/vente ; `stocks_couts` conserve le coût d'achat interne courant, au grain `pharmacie × produit`, en XAF.
- Aucun déplacement ni suppression de donnée existante.
- RLS et grants dédiés : coût d'achat accessible uniquement aux scopes internes autorisés ; jamais au Client.
- **Contradiction volontairement fermée :** `stocks.prix` et `stocks_couts.cout_unitaire` ne sont jamais additionnés ni confondus.
- **Marge historique interdite pour l'instant :** un coût courant ne suffit pas à reconstituer le coût au moment d'une vente passée. Aucun KPI de marge transactionnelle ne sera publié avant qu'un coût de vente soit figé au grain transactionnel.
- La migration 013 est préparée dans la branche ; son application Supabase Production reste soumise à l'autorisation de déploiement/migration.

### Passe 4 — état après C1
- C1 : 🟢 100 % au niveau contradiction / modèle / dépôt.
- Source de vérité KPI : 🟢.
- Grain des stocks/lots/réservations/recherches : 🟢 au niveau spécification.
- Recherche, CA, rapports hiérarchiques, exports et tests anti-double-comptage : 🟠/🔴, encore à fermer par contradiction.


## Passe 4 — conventions de présentation monétaire et source KPI recherche
### Devise — règle d'affichage Client 🟢 100 %
- Le code technique de devise reste XAF dans la donnée et les contrats techniques.
- L'interface humaine NAXA affiche **FCFA** : par exemple `2 500 FCFA`, jamais `2 500 XAF` pour le Client.
- La fonction Client existante `fcfa()` centralise déjà ce rendu pour les prix de recherche, les fiches, les réservations et les reçus.
- Aucun changement de valeur, de calcul ou de devise réelle : il s'agit uniquement d'une convention d'affichage.

### Contradiction C3 — deux sources de recherche 🟢 100 % au niveau règle canonique
- `evenements` est la **source canonique des KPI de recherche et du funnel** : un parcours de recherche produit un événement `recherche` via `log_evenement`.
- `recherche_events` est conservée comme **source historique/compatibilité du bandeau « Les plus recherchés »** via `log_recherche`.
- Les deux flux ne doivent jamais être additionnés, joints ou interprétés comme deux recherches indépendantes pour un même parcours.
- `recherche_events` ne sert donc pas au calcul des volumes de recherche, taux de résultat, conversion ou autres KPI du funnel.
- Test d'acceptation : une recherche utilisateur = 1 événement canonique `evenements.recherche`; les éventuelles lignes secondaires `recherche_events` restent hors KPI.
- Aucun historique n'est supprimé.


## Passe 4 — Contradiction C4 : CA et transitions de réservation 🟢 100 % au niveau dépôt/conception
- **CA canonique** : une réservation contribue au chiffre d'affaires si son statut courant est `payee` ou `retiree`.
- `payee → retiree` ne crée jamais une deuxième vente : la réservation garde un identifiant unique et le total est compté une seule fois.
- Transitions autorisées verrouillées : `en_attente → confirmee/payee/annulee/expiree`, `confirmee → payee/retiree/annulee/expiree`, `payee → retiree`; les états `retiree`, `expiree`, `annulee` sont terminaux.
- Nouvelle vue canonique `v_reservations_ca` : une ligne par réservation qualifiante, avec `security_invoker=true` et grants minimaux.
- `v_ventes_journalieres` et `bi.activite_mensuelle` sont désormais alignées sur cette source canonique dans `supabase/migration_014_ca_canonique_reservations.sql`.
- Test réel sur Supabase, dans une transaction entièrement rollbackée : vue créée avec succès ; 0 réservation qualifiante et CA canonique 0 FCFA dans l'état actuel ; aucune donnée Production modifiée.
- Migration 014 non appliquée en Production.


## Passe 4 — Contradiction C2 : rapports hiérarchiques 🟢 100 % au niveau modèle
- Le modèle `rapports` conserve `portee`/`pharmacie_id` pour compatibilité historique et ajoute `scope_type`, `scope_profile_id`, `scope_pharmacie_id`.
- `scope_type` canonique : `PHARMACIE`, `RESPONSABLE`, `PROMOTEUR`, `NAXA`.
- Un scope Promoteur n'est jamais réduit à une seule `pharmacie_id` : son périmètre est déterminé par son autorisation hiérarchique et les pharmacies couvertes.
- Les rapports historiques peuvent être mappés sans réécrire leur contenu.
- `migration_015_scopes_rapports_hierarchiques.sql` est additive et non destructive.
- Test Supabase exécuté en transaction rollbackée : colonnes, contrainte et index créables ; 0 rapport actuellement présent, donc 0 historique à migrer.
- **Important** : le branchement effectif des scopes à l'autorisation Promoteur/Responsable reste une étape d'implémentation du moteur hiérarchique ; il ne doit pas être simulé par l'UI.


## Passe 4 — Exports par scope 🟢 100 % au niveau garde-fou / contrat
- Le mécanisme d'export CSV existant (`exporterCsv`) est conservé : aucun deuxième moteur d'export n'est créé.
- L'API `/api/rapports` expose désormais les métadonnées de scope (`scope_type`, `scope_profile_id`, `scope_pharmacie_id`) sans élargir les droits.
- Tant que le moteur hiérarchique/RLS complet n'est pas branché, un utilisateur non-admin reste limité à sa `pharmacie_id` historique. La présence d'un `scope_type` ne donne jamais un droit implicite.
- Les exports héritent donc du périmètre autorisé par la source : pas d'export global depuis une vue locale.
- Le CSV reste un format d'export opérationnel ; le PDF d'envoi automatique reste séparé et inchangé.
- Test d'acceptation : un scope n'élargit pas l'API par lui-même ; aucune donnée hors périmètre n'est ajoutée.


## Passe 4 — BI/RLS multi-pharmacie 🟢 au niveau modèle + migration de branche
- Ajout de `promoteur_pharmacies` : relation explicite Promoteur ↔ pharmacies.
- Ajout de `my_pharmacies()` : périmètre autorisé multi-pharmacie, avec compatibilité `profiles.pharmacie_id` pour les niveaux inférieurs.
- Ajout de `can_access_pharmacy(uuid)` : point de contrôle commun pour les politiques RLS.
- Les politiques `stocks`, `stocks_lots`, `reservations` et `rapports` ne reposent plus exclusivement sur `my_pharmacie()`.
- Les vues BI `activite_mensuelle` et `stock_pharmacies` deviennent `security_invoker` et portent `pharmacie_id`, afin de conserver le grain pharmacie et de permettre l'agrégation hiérarchique sans contourner la RLS.
- `role=responsable` est désormais prévu dans l'enum, sans transformer Responsable en fonction métier.
- Migration ajoutée : `supabase/migration_016_bi_rls_multipharmacie.sql`.
- **Aucun déploiement Production ni migration Supabase Production n'a été exécuté.**
- Acceptance tests à exécuter après application contrôlée : Promoteur multi-pharmacie voit A+B mais pas C ; Responsable/Caisse voient uniquement leur pharmacie ; NAXA voit toutes ; Client ne reçoit pas le périmètre interne ; KPI consolidés = somme des pharmacies autorisées sans double-compte.


## Passe 5 — Hierarchie + securite
- Arbre canonique : `profiles.parent_profile_id`.
- Scope Promoteur : `promoteur_pharmacies`.
- Accreditations tracees : `profile_accreditations`.
- Creation/revocation des niveaux via fonctions DB controlees.
- Pas d'auto-elevation par UPDATE direct des profils.
- RLS multi-pharmacie appliquee aux donnees internes principales.
- Stock interne non directement expose a `anon`.
- Nouvelles fonctions sensibles : `search_path` fixe et EXECUTE restreint.
- OAuth : limite de 4 appareils controlee lors de la creation de session.
- Validation branche : migrations 015 a 017 executees en transaction puis rollback ; test A+B autorise et C refuse reussi.
- Production non modifiee.


## Passe 6 — Pilotage réel par scope
- Contradiction fermée : les dashboards ne doivent pas recalculer leurs KPI avec un moteur parallèle à la BI/CA canonique.
- Migration additive 018_pilotage_canonique_scope.sql : RPC stats_pilotage_scope(p_jours) comme point d'entrée unique du pilotage NAXA par scope.
- Scope Admin = réseau NAXA ; Promoteur = pharmacies autorisées via my_pharmacies() ; Responsable/Caisse = pharmacie de leur profil actif.
- Les recherches sans pharmacie ne sont jamais attribuées à un Promoteur/Responsable/Caisse ; elles restent réseau uniquement côté Admin. Cela évite une fuite d'agrégation entre pharmacies.
- CA et ventes utilisent v_reservations_ca, donc la règle payee/retiree et l'anti-double-compte de la Passe 4 restent la source canonique.
- /admin/pilotage et /pharmacie/pilotage consomment désormais la même RPC canonique.
- /pharmacie/pilotage devient le tableau de bord commun adapté au niveau : Promoteur, Responsable ou Caisse ; il ne crée aucune sous-pharmacie.
- Accès au pilotage ajouté depuis /pharmacie.
- Validation Supabase : migration 018 rejouée dans une transaction puis rollbackée ; fonction créée et détectée dans la transaction, aucune modification Production persistante.
- Validation fonctionnelle multi-utilisateur complète et application Production de 018 : encore à faire, sans les déclarer vertes prématurément.


## État documentaire — Passe 6 / point de contrôle du 5 octobre 2026
- Branche auditée : `feat/pharmacie-validite-pilotage`.
- PR : #24, ouverte vers `consolidation`, HEAD `bfc6089acc293806fedda8b90078eb0ca23ba021`. Aucun merge `main` et aucun déploiement Production n’est autorisé par cette passe.
- Les migrations 013 à 018 sont des fichiers additifs présents dans **`supabase/`** (et non dans `supabase/migrations/`). Cette localisation est désormais la référence du dépôt pour ce lot.
- La migration 018 centralise le pilotage dans `stats_pilotage_scope(p_jours)` ; les dashboards Admin et pharmacie l’appellent désormais directement.
- État de validation : la présence des fichiers de migration et leur cohérence avec les changements de dashboard sont en cours de checking avant reprise de l’audit contradictoire. La présence dans la branche ne vaut pas application Production.
- Production : migrations 013–018 non appliquées à ce stade ; aucune conclusion de validation Production ne doit être déduite du code de branche.
- Règle de gouvernance : aucun merge, aucune migration Production et aucun déploiement sans autorisation explicite **OUI, DÉPLOIE**.


---

# 🔒 RÉFÉRENCE DE CONTINUITÉ — CHANTIER PILOTAGE — 5 OCTOBRE 2026

> **Cette section est une instruction de continuité prioritaire pour toute IA qui reprend le dépôt après une rupture de conversation, de session ou de contexte.**
>
> **Ne pas recommencer le chantier depuis le Prompt maître v3.** Le V3 définit le cadre et la destination ; les **Passes 1→6 et leurs arbitrages successifs constituent l'historique décisionnel de travail** qui explique comment le Pilotage a été construit. Une reprise correcte doit reconstituer cet historique avant toute nouvelle modification.

## 1. Vérité de travail : ne pas confondre les sources

La reprise doit distinguer au minimum :

1. **Prompt maître v3 / Cahier des charges v3** : exigences, destination et périmètre contractuel du produit.
2. **Historique décisionnel des Passes 1→6** : arbitrages métier, contradictions détectées, décisions, architecture retenue, tests et limites explicitement établis pendant le développement du Pilotage.
3. **Branche `feat/pharmacie-validite-pilotage`** : état d'implémentation candidat du chantier en cours ; il n'est pas la Production.
4. **`main` + Supabase réel** : vérité de Production ; ne jamais présenter l'état de la branche comme déployé.
5. **ZIP/documentation de référence** : source documentaire additive ; ne remplace jamais l'existant et ne doit pas être réappliqué aveuglément.

**Règle fondamentale :** si une formulation ancienne du README/STATUT contredit une section de référence plus récente, la section de référence la plus récente prévaut. Si un arbitrage des Passes contredit le V3, **ne pas écraser automatiquement l'arbitrage** : identifier la contradiction, vérifier son origine et la fermer explicitement.

## 2. Chemin historique obligatoire du Pilotage

Le chantier Pilotage a volontairement été développé par passes :

- **Passes 1→3** : existant, invariants, modèle métier, hiérarchie, autorisation, RLS, séparation Client/interne.
- **Passe 4** : coûts, CA canonique, recherche/funnel, rapports hiérarchiques, exports, BI et multi-pharmacie.
- **Passe 5** : hiérarchie opérationnelle, accréditations, scopes, sécurité et garde-fous.
- **Passe 6** : moteur KPI canonique de Pilotage et raccordement des dashboards à ce moteur unique.

**Important :** le fait de ne pas avoir fusionné `main` ni déployé Production pendant ces passes était **volontaire**. Le but était de concevoir, consolider et corriger le Pilotage avant livraison. Ne pas interpréter cette absence de déploiement comme un abandon, un échec ou une invitation à créer un nouveau chantier.

## 3. Règles métier/architecture verrouillées pendant les Passes

- Une **pharmacie = une unité commerciale et un stock partagé** ; plusieurs caisses ne créent jamais plusieurs pharmacies.
- Client = acteur externe, hors hiérarchie interne.
- Hiérarchie cible : **N0 NAXA Admin → N1 Promoteur → N2 Responsable → N3 Caisse**.
- Relation Promoteur ↔ pharmacie explicite pour le multi-pharmacie.
- Le scope autorisé est une composante du droit ; l'UI/JWT seuls ne constituent jamais l'autorité.
- Formule de droit effectif : **identité × niveau × accréditation × périmètre × pharmacie × convention × statut × objet × opération**.
- `stocks` = quantité/prix de vente ; `stocks_couts` = coût d'achat interne courant. Ne jamais les confondre.
- Technique monétaire : **XAF** ; affichage humain : **FCFA**.
- `evenements` = source canonique des KPI de recherche/funnel ; `recherche_events` reste historique/compatibilité et ne doit pas être additionné aux KPI.
- CA canonique = `v_reservations_ca`, au grain réservation ; statuts éligibles = `payee` ou `retiree` ; `payee → retiree` reste une seule vente.
- Les agrégations Promoteur doivent sommer uniquement les pharmacies autorisées, sans double comptage.
- Les données de coût, lots, péremptions, mouvements et autres données internes ne sont jamais exposées au Client.
- Les fonctions `SECURITY DEFINER` doivent avoir une justification, un `search_path` sûr et des EXECUTE minimaux ; les vues doivent avoir une posture de sécurité explicite.
- Limite de sessions : 4 simultanées ; aucune ancienne session n'est expulsée automatiquement.

## 4. Passe 6 — décision centrale

La contradiction principale de la Passe 6 était l'existence de moteurs KPI différents :

`stats_admin` ≠ `stats_pharmacie` alors que BI/CA avaient désormais des règles canoniques.

**Décision retenue :** une seule chaîne de vérité :

**DONNÉE SOURCE → RÈGLE KPI → KPI CANONIQUE → AGRÉGATION PAR SCOPE → BI → DASHBOARD → RAPPORT/EXPORT**

Le point d'entrée de Pilotage introduit par la Passe 6 est :

`stats_pilotage_scope(p_jours)`

Scopes retenus :
- Admin → réseau NAXA, hors pharmacies de démonstration selon la règle canonique ;
- Promoteur → pharmacies autorisées via `my_pharmacies()` ;
- Responsable/Caisse → pharmacie autorisée par leur profil ;
- Client → aucun accès au Pilotage interne.

Les recherches sans `pharmacie_id` ne doivent **jamais** être attribuées artificiellement à un Promoteur/Responsable/Caisse.

`/admin/pilotage` et `/pharmacie/pilotage` doivent consommer le même moteur KPI canonique et ne doivent pas recréer leur propre calcul métier.

## 5. État au moment de la rupture

- Branche de travail : `feat/pharmacie-validite-pilotage`.
- PR #24 vers `consolidation`.
- HEAD documenté : `bfc6089acc293806fedda8b90078eb0ca23ba021`.
- Migrations de branche : `013` à `018`, sous `supabase/`.
- **013→018 ne sont pas déclarées appliquées en Production.**
- Aucun merge `main` ni déploiement Production ne doit être effectué sans l'autorisation exacte : **OUI, DÉPLOIE**.
- La validation transactionnelle effectuée sur les migrations signifie **ROLLBACK**, donc ne pas la présenter comme une migration Production.
- La Passe 6 avait déjà raccordé les dashboards au moteur canonique, mais les contradictions résiduelles et tests d'acceptation devaient encore être fermés avant de déclarer le Pilotage final vert.

## 6. Contradictions résiduelles à reprendre — ne pas perdre leur contexte

La reprise doit traiter les points déjà identifiés, notamment :

- **E20** : `stocks_couts` encore à aligner complètement sur le scope multi-pharmacie.
- **E21** : `accrediter_profile()` ne doit pas choisir implicitement le parent ; respecter N2→Promoteur et N3→Responsable, avec le cas 2 niveaux explicitement autorisé.
- **E22** : `set_reservation_status()` doit avoir un `search_path` sûr et une autorisation cohérente avec `can_access_pharmacy()`.
- **E23** : test versionné d'acceptation du moteur `018` et couverture des rôles/scopes.
- **E24** : transitions de réservation et multi-pharmacie doivent utiliser le même moteur de scope que Pilotage.
- **E25** : scope Admin et exclusion des pharmacies de démonstration doivent être cohérents pour tous les KPI.
- **E26** : gouvernance documentaire ; le code et les décisions doivent rester traçables ensemble, sans faux vert.
- **E27** : traçabilité branche/PR/`main` ; `consolidation` n'est pas Production.
- **E28** : vérifier le périmètre réel du **Pilotage 360°** prévu par le V3/cahier et distinguer ce qui appartient aux Passes actuelles de ce qui est explicitement prévu plus tard.
- **E29** : branding/design uniquement si exigé par le périmètre Pilotage courant ; ne pas inventer un nouveau design en contradiction avec les sources documentaires.

Cette liste n'est pas une invitation à créer une Passe 7 automatiquement. **Commencer par déterminer si chaque point est une fermeture de la Passe 6, une exigence déjà couverte par une passe antérieure, ou une exigence explicitement différée.**

## 7. Protocole obligatoire en cas de nouvelle rupture

Toute IA qui reprend le projet doit :

1. Lire cette section en premier.
2. Lire les sections de référence les plus récentes de `README.md`, `STATUT.md` et `docs/CONTRADICTIONS.md`.
3. Reconstituer les décisions des Passes 1→6 avant de proposer une nouvelle architecture.
4. Vérifier la branche réelle et distinguer **Production / main / branche / spécification / documentation**.
5. Ne supprimer, remplacer ou recréer aucune architecture existante sans décision explicite.
6. Auditer les contradictions restantes avant de coder.
7. Produire une matrice : **Exigence → décision historique → source → état branche → état Production → contradiction → test d'acceptation → statut**.
8. Ne coder qu'après avoir établi que le plan d'implémentation est complet et sans ambiguïté.
9. Après chaque modification : tests concrets, documentation et ré-audit.
10. Ne déclarer le chantier Pilotage terminé que lorsque les critères applicables sont **prouvés à 100 %**, pas seulement conçus.
11. Une fois le dernier passage Pilotage vert, **revenir au Prompt maître v3 + Cahier v3 pour poursuivre le chantier suivant prévu**, sans laisser volontairement des tâches Pilotage non terminées.
12. **Ne jamais fusionner `main`, appliquer une migration Production ou déployer sans l'accord explicite du fondateur.**

## 8. Critère de continuité

La reprise est considérée correcte uniquement si une nouvelle IA peut répondre sans ambiguïté aux questions suivantes :

- Où en étions-nous ?
- Pourquoi avons-nous choisi cette architecture ?
- Quelles décisions ont été prises pendant les Passes 1→6 ?
- Quelles décisions sont encore ouvertes ?
- Qu'est-ce qui est réellement en Production ?
- Qu'est-ce qui n'est que sur la branche ?
- Quel est le prochain test à exécuter ?
- Pourquoi ne faut-il pas repartir de zéro ?
- Quand faut-il retourner au V3 pour continuer le cahier des charges ?

**Réponse canonique :** nous étions en train de **terminer le chantier Pilotage**, pas de commencer un nouveau chantier. Les Passes 1→6 sont le chemin décisionnel à préserver. Le V3 sert ensuite de cadre pour reprendre la suite du cahier des charges une fois le Pilotage définitivement vert.


## 🔒 Rectification métier — abonnement Promoteur (5 octobre 2026)
La règle commerciale canonique est désormais explicite et prioritaire sur les formulations historiques :
- **1 Promoteur = 1 convention commerciale = 1 tarif = 1 abonnement**, qu'il possède une pharmacie, plusieurs pharmacies ou temporairement aucune.
- Les pharmacies A/B/C d'un même Promoteur **ne portent pas des tarifs différents** et ne disposent pas d'abonnements indépendants.
- Le Dashboard Promoteur est unique et couvre son périmètre autorisé.
- L'échéance de l'abonnement Promoteur entraîne le **blocage de toutes les pharmacies rattachées à ce Promoteur**.
- La convention est administrative entre NAXA et le Promoteur ; le système exploite trois données opérationnelles issues de cette convention : **montant à payer, date de paiement, date d'expiration**.
- Le tarif n'est jamais fixé par un 30000 universel. NAXA/Admin configure le tarif réellement convenu.
- Les anciennes tables abonnements / abonnement_paiements sont conservées pour compatibilité historique. Le nouveau chemin canonique est conventions_promoteurs → abonnements_promoteurs → abonnement_promoteur_paiements.
- Migration additive de correction : supabase/migration_019_convention_promoteur.sql.
- La page /admin/pilotage/validite affiche désormais une ligne par Promoteur et son périmètre de pharmacies.
- Le cron de validité envoie un rappel unique au Promoteur et applique le blocage au niveau Promoteur.

**Important :** aucune migration 019 n'a été appliquée en Production. Le test DDL 013→019 a été exécuté dans une transaction puis **ROLLBACK**.


---

# 🔒 ÉTAT DE RÉFÉRENCE — 5 OCTOBRE 2026 — APRÈS PASSE 6 / PRÉPARATION P7

> Cette section est prioritaire sur toute formulation historique contradictoire plus haut dans le fichier.

## 1. Position exacte du chantier

Le chantier actuel reste **Pilotage**. Les Passes 1→6 ont construit et consolidé le socle du Pilotage ; nous ne passons pas encore à un autre chantier produit.

- Branche active : `feat/pharmacie-validite-pilotage`
- PR : **#24** vers `consolidation`
- HEAD de référence : `0dd2a02f5a75f1a4f0f4542378713fec50dcabb2`
- CI GitHub **NAXA quality #127 : SUCCESS**
- `main` : **inchangé**
- Production Supabase : **inchangée**
- Migrations 013→019 : **branche uniquement, non appliquées en Production**
- Aucun merge `main`, aucune migration Production et aucun déploiement sans l'autorisation exacte : **OUI, DÉPLOIE**.

## 2. Passe 6 — état réel

La décision centrale reste :

**DONNÉE SOURCE → RÈGLE KPI → KPI CANONIQUE → AGRÉGATION PAR SCOPE → BI → DASHBOARD → RAPPORT/EXPORT**

Le point d'entrée canonique est `stats_pilotage_scope(p_jours)` et les dashboards Admin et pharmacie utilisent ce même moteur.

### Preuves déjà obtenues
- Migration/test 018 exécuté transactionnellement avec rollback.
- Extension du test aux migrations 013→019 : **PASS syntaxe/dépendances, puis ROLLBACK**.
- Admin et Promoteur sont prouvés dans le test d'acceptation versionné.
- CI #127 est **SUCCESS**.
- Les corrections E20, E21, E22/E24 et E25 sont présentes sur la branche.

### Point qui empêche encore le 🟢 100 %
La matrice transactionnelle **Responsable / Caisse / Client** n'est pas encore prouvée dans le même test, en raison de la contrainte PostgreSQL sur l'utilisation d'une nouvelle valeur enum dans la transaction qui l'ajoute. Ce n'est pas une permission de contourner la contrainte par une mutation Production : le point reste **🟠 non prouvé**.

## 3. Décision commerciale canonique

**1 Promoteur = 1 convention = 1 tarif = 1 abonnement**, qu'il possède une pharmacie, plusieurs pharmacies ou temporairement aucune.

La convention est administrative entre NAXA et le Promoteur. Pour l'automatisation, le système attend :
1. le montant à payer ;
2. la date de paiement ;
3. la date d'expiration de la convention / utilisation de la plateforme.

Les pharmacies d'un même Promoteur ne portent donc pas des tarifs ou abonnements indépendants. À échéance impayée, **toutes les pharmacies du périmètre du Promoteur sont bloquées**.

Le montant réel est celui configuré par NAXA/Admin dans la convention. **30 000 FCFA n'est pas un tarif universel.** Les anciennes occurrences historiques restent documentées comme compatibilité historique et ne constituent pas la règle commerciale canonique.

## 4. Suite Pilotage 360° — ordre verrouillé

Une fois la Passe 6 définitivement verte à 100 %, le chantier reprend le cadre graphique et le parcours de pilotage du **V3/Cahier des charges** sans créer une nouvelle direction visuelle.

### Prochain bloc : Pilotage Performance
Chaque famille de pilotage doit disposer de son propre dashboard, tout en consommant les mêmes sources/KPI canoniques.

Périmètre à auditer puis construire :
- objectifs vs réalisé ;
- performance par Caisse ;
- drill-down ;
- comparaison des pharmacies d'un même réseau Promoteur ;
- Network Health / qualité du réseau ;
- rentabilité et marge avec coût figé au niveau transactionnel ;
- dashboard Performance fidèle au design et au parcours V3.

### Bloc suivant : Sécurité & activité réseau
Le Promoteur doit pouvoir consulter les traces de sessions de **son propre réseau uniquement** :
- sessions actives ;
- dernière activité ;
- connexion / déconnexion ;
- sessions expirées ;
- tentatives refusées ;
- pharmacie, utilisateur, rôle et horodatage ;
- appareil/navigateur uniquement si ces informations existent réellement.

Ne jamais exposer : tokens, cookies, secrets, sessions d'un autre Promoteur ou données privées sans rapport avec le scope. Le Promoteur ne manipule pas directement les sessions.

Le scope canonique sera `promoteur_pharmacies` : **Promoteur → pharmacies → Responsables/Caisses → activité**.

### Bloc final : Pilotage Direction 360°
Agrégation cohérente de : **Commercial + Performance + Sécurité/activité**, selon le périmètre V3.

## 5. Règle de méthode pour la suite

Avant tout code P7/P8 : audit de l'existant, matrice des contradictions, vérification des points de communication avec les implémentations actuelles, plan complet, estimation de faisabilité et de couverture. Le chantier ne démarre que lorsque **faisabilité = 100 % et couverture = 100 %**, puis après accord explicite.

Après implémentation : tests concrets, CI, ré-audit, README/STATUT/CONTRADICTIONS mis à jour. Aucun faux vert : une décision conçue n'est pas une preuve Production.


## 🔒 Passe 6 — preuve multi-rôles mise à jour — 5 octobre 2026
- Le test transactionnel du moteur 018 couvre désormais **Admin + Promoteur + Caisse + Client** et a été exécuté avec les migrations 013→018 puis **ROLLBACK**.
- Résultat : **PASS** pour ces quatre scénarios ; aucune donnée persistante n'a été laissée en Production.
- Le scénario **Responsable** est isolé dans `supabase/tests/018b_pilotage_responsable_post_commit.sql` afin de respecter la contrainte PostgreSQL : la valeur enum `responsable` ajoutée par 016 ne peut être utilisée qu'après le commit qui ajoute cette valeur.
- **Ne pas contourner cette contrainte par une mutation Production.**
- Tant que 018b n'est pas exécuté dans un environnement où 016 est déjà committée, la Passe 6 reste **🟠 non verte à 100 %**.



## Correction architecturale canonique — 5 octobre 2026 — migration 020

Le moteur d'autorisation est implémenté de façon additive dans supabase/migration_020_authorisation_architecture_privileges.sql.

- role_type reste strictement : client, pharmacie, admin, promoteur, caisse.
- Responsable n'est pas une valeur de role_type : c'est le niveau interne N2 (profiles.niveau_interne=2).
- Architecture, niveau métier, privilège et scope sont séparés.
- conventions_promoteurs.architecture_code porte l'architecture attribuée par NAXA.
- Architectures : ORPHELIN, PARENTS_ENFANTS, PARENTS_AINES_CADETS, HYBRIDE.
- Les privilèges sont atomiques, bornés par niveau et non délégables lorsqu'ils relèvent de la gouvernance NAXA.
- Le Promoteur attribue uniquement les privilèges délégables autorisés par NAXA dans son périmètre.
- HYBRIDE supporte les rôles personnalisés comme bundles de privilèges, sans nouveau role_type.

Les anciennes mentions d'un enum responsable et du test 018b sont historiques et ne constituent plus la source de vérité. Le test courant est supabase/tests/020_authorisation_architecture_privileges.sql.

État : code de branche uniquement. Aucun changement Production, aucun merge main, aucune migration Production.


## Architecture canonique — fonctions, privilèges et scopes — 5 octobre 2026

- Implémentation additive sur la branche `feat/pharmacie-validite-pilotage`.
- `role_type` reste strictement `client`, `pharmacie`, `admin`, `promoteur`, `caisse`.
- **Responsable n'est pas un rôle enum** : il est modélisé par `fonction_interne=responsable` + niveau hiérarchique + architecture + périmètre.
- Quatre architectures NAXA : `ORPHELIN` (1 Caisse), `PARENTS_ENFANTS` (5 Caisses), `PARENTS_AINES_CADETS` (5 Responsables + 5 Caisses), `HYBRIDE` (rôles personnalisés sans plafond métier fixe, dans les limites NAXA).
- Catalogue atomique des privilèges : organisation, privilèges, pharmacie, produits, stock, ventes, CA, pilotage, rapports, exports, sécurité, configuration et gouvernance.
- Les privilèges de gouvernance NAXA ne sont pas délégables.
- Attribution effective : identité → fonction → architecture → privilège autorisé → scope → statut.
- Migration additive : `supabase/migration_020_architecture_privileges.sql`.
- Fermeture des quotas d'accréditation : `supabase/migration_020b_architecture_accreditation.sql`.
- Test structurel : `supabase/tests/020_architecture_privileges.sql`.
- **Non appliqué en Production. Non fusionné dans main.**
- Validation Production et migration Supabase restent soumises à autorisation explicite.


## 🔒 CONTINUITÉ PRIORITAIRE — Architecture NAXA : fonctions, privilèges, architectures et scopes — 5 octobre 2026

> **Cette section est prioritaire pour toute IA qui reprend le chantier. Elle décrit l'état de travail actuel sur la branche, sans le confondre avec Production.**

### 1. Décision canonique verrouillée
- `role_type` reste strictement : `client`, `pharmacie`, `admin`, `promoteur`, `caisse`.
- **`responsable` n'est jamais ajouté à l'enum.** Responsable = fonction/niveau métier N2, porté par les données internes de fonction/niveau, l'architecture et le scope.
- Le droit effectif : **identité → fonction/niveau → architecture → privilège autorisé → scope → statut**.
- Le Promoteur ne choisit pas librement l'architecture : **NAXA l'attribue selon la convention**.
- Le Promoteur attribue uniquement les privilèges délégables autorisés par NAXA pour son architecture et son périmètre.
- Aucun utilisateur ne peut dépasser les limites de son architecture, de sa fonction/niveau ou de ses privilèges.

### 2. Quatre architectures canoniques
1. **ORPHELIN** : Promoteur → 1 Caisse maximum ; aucun Responsable.
2. **PARENTS_ENFANTS** : Promoteur → jusqu'à 5 Caisses ; aucun Responsable.
3. **PARENTS_AINES_CADETS** : Promoteur → jusqu'à 5 Responsables + jusqu'à 5 Caisses ; Responsable N2, Caisse N3.
4. **HYBRIDE** : Promoteur → rôles/bundles personnalisés autorisés par NAXA, sans plafond métier fixe ; les privilèges de gouvernance NAXA restent non délégables.

### 3. Catalogue de privilèges
Le catalogue est atomique et organisé par domaines : gouvernance NAXA, organisation, rôles/privilèges, pharmacie, produits, stock, réservations, ventes/caisse, CA, Pilotage, rapports, exports, sécurité, sessions, configuration et commercial/subscription.

Règle : **les privilèges Promoteur, Responsable et Caisse sont distincts**. Une Caisse ne peut pas recevoir un privilège réservé à Responsable ; un Responsable ne reçoit pas automatiquement les privilèges Promoteur ; les privilèges de gouvernance NAXA ne sont pas délégables.

### 4. Implémentation actuellement présente sur la branche
- `supabase/migration_020_architecture_privileges.sql` : catalogue, architectures, matrice fonction/privilège, moteur d'autorisation et attribution/révocation.
- `supabase/migration_020b_architecture_accreditation.sql` : fermeture des quotas d'accréditation et garde-fous architecture/fonction.
- `supabase/tests/020_authorisation_architecture_privileges.sql` : test principal d'autorisation.
- `supabase/tests/020_architecture_privileges.sql` : test structurel complémentaire.
- Aucun ajout de `responsable` dans `role_type`.

### 5. État de preuve — à ne jamais falsifier
- Architecture/décision : 🟢 verrouillée.
- Code de branche : 🟢 présent et relu.
- Tests SQL versionnés : 🟢 présents.
- Exécution Supabase des migrations 020/020b : **à vérifier/exécuter en environnement de test** avant de déclarer le lot vert.
- CI post-commit : **à vérifier**.
- Production : **inchangée**.
- `main` : **inchangé**.
- Aucun merge, aucune migration Production et aucun déploiement sans autorisation explicite ; phrase de déploiement : **OUI, DÉPLOIE**.

### 6. Prochaine reprise obligatoire
Ne pas repartir de zéro et ne pas créer un second modèle. Reprendre par :
1. audit contradictoire de 020/020b contre 017/018 et les tests existants ;
2. exécution transactionnelle des migrations/tests en environnement de test ;
3. vérification des quotas ORPHELIN/PARENTS_ENFANTS/PARENTS_AINES_CADETS/HYBRIDE ;
4. vérification allow/deny des privilèges Promoteur/Responsable/Caisse et des privilèges NAXA non délégables ;
5. vérification du scope multi-pharmacie et du Pilotage canonique ;
6. mise à jour du README/STATUT avec les preuves réelles ;
7. seulement après 100 % vert, demander validation avant la suite du roadmap.

**Règle absolue : ne pas déclarer ce chantier terminé sur la seule présence des fichiers SQL.**


## 🔒 Validation architecture/privilèges — 5 octobre 2026 — passe de fermeture

Validation exécutée selon la méthode NAXA : audit → contradiction → correction additive → validation transactionnelle → tests d’acceptation → contrôle de rollback → documentation.

### Corrections réalisées sur la branche
- Réconciliation additive des colonnes historiques family, description, governance_only et active du catalogue naxa_privileges avec le schéma canonique 020.
- Suppression de deux doublons de seed (VIEW_TEAM_ACTIVITY, EXPORT_STOCK) qui rendaient le ON CONFLICT DO UPDATE ambigu.
- Conservation de la signature/default de accrediter_profile(..., p_parent uuid default null).
- accrediter_profile() synchronise désormais aussi profiles.niveau_interne en plus de niveau_hierarchique.
- Les tests ne traitent plus la présence historique de la valeur enum responsable comme une preuve d’utilisation : aucune valeur active role_type=responsable n’est autorisée ; Responsable reste porté par fonction/niveau. La valeur enum historique est conservée pour compatibilité non destructive.
- Le test d’autorisation utilise un privilège Pilotage réellement compatible avec le niveau Responsable.
- Les fixtures du test d’autorisation sont adaptées à un environnement avec seulement deux profils existants.

### Preuves obtenues
- Chaîne 013 → 020c : PASS transactionnel, puis ROLLBACK.
- Test 017_hierarchie_securite.sql : PASS / ROLLBACK.
- Test 018_pilotage_canonique_scope.sql : PASS / ROLLBACK.
- Test 020_architecture_privileges.sql : PASS / ROLLBACK.
- Test 020_authorisation_architecture_privileges.sql : PASS / ROLLBACK.
- Contrôle post-rollback : naxa_privileges et pharmacie_architectures n’existent pas en Production ; aucune migration 013→020c n’est enregistrée dans l’historique Supabase Production.
- main inchangé ; PR #24 toujours ouverte vers consolidation.
- CI GitHub du HEAD courant : in_progress au dernier contrôle ; aucune conclusion CI artificiellement déclarée.

### Point de vigilance
Le catalogue contient désormais aussi les privilèges VIEW_PERFORMANCE_KPI, VIEW_OBJECTIVES, VIEW_OBJECTIVES_VS_ACTUAL, VIEW_COMPARISON, VIEW_DRILLDOWN, VIEW_NETWORK_HEALTH, etc. Cela ne signifie pas que le Pilotage de la performance métier est construit. Ces privilèges décrivent des capacités d’autorisation prévues ; le contenu métier du Pilotage Performance reste à concevoir/construire selon le V3.


# 🔒 CLÔTURE — PASSE 6 / MATRICE MULTI-RÔLES — 5 OCTOBRE 2026

Cette section est prioritaire sur les formulations historiques antérieures concernant le test Responsable.

## Point précédemment bloquant
La preuve Responsable était auparavant déclarée 🟠 car le test tentait de consommer la valeur enum historique `responsable` dans la même transaction que son ajout PostgreSQL.

## Fermeture retenue
La règle métier canonique ne dépend pas de cette valeur enum :
- `role_type` conserve son modèle historique ; **aucun profil n'utilise `role='responsable'`**.
- Responsable est porté par `fonction_interne='responsable'` + `niveau_interne=2` + `niveau_hierarchique=2) + pharmacie/scope.
- Le test versionné `supabase/tests/018_pilotage_canonique_scope.sql` a été corrigé pour tester ce modèle réel, sans dépendre de la consommation transactionnelle de la nouvelle valeur enum.

## Preuve d'acceptation
Validation transactionnelle complète de la chaîne `013→019→020c), puis **ROLLBACK**, avec scénarios :
- Admin : réseau NAXA, 3 pharmacies non-démo et recherches réseau ;
- Promoteur : uniquement A+B, sans fuite vers C ni recherche sans pharmacie ;
- Caisse : uniquement pharmacie A ;
- Responsable : uniquement pharmacie A, avec niveau 2 et fonction métier Responsable ;
- Client : accès au moteur Pilotage refusé ;
- aucun profil n'est porté par `role_type='responsable'`.

**Résultat : 🟢 Passe 6 — point multi-rôles/isolation fermé.**

## État de gouvernance
- Branche : `feat/pharmacie-validite-pilotage`
- PR : #24 → `consolidation`
- `main) inchangé.
- Production Supabase inchangée.
- Les migrations `013→020c) restent des migrations de branche/test ; aucune application Production.
- Aucun merge ni déploiement sans l'autorisation exacte : **OUI, DÉPLOIE**.

## Suite
La Passe 6 étant désormais **verte sur ce point**, la prochaine étape est la reprise du cadre V3/Cahier des charges pour **P7 — Pilotage Performance**, en commençant par l'audit de l'existant et la matrice des contradictions avant tout code.


## Suivi Client — Historique des médicaments achetés

### Passe client — fondation d'horodatage
- Migration additive supabase/migration_021_historique_achats_client.sql ajoutée sur la branche de travail.
- reservation_events conserve les événements horodatés de réservation, transition de statut et déclaration de paiement.
- client_achats fournit le listing canonique des médicaments achetés : médicament, DCI, dosage, forme, quantité, prix unitaire, total ligne, total transaction, pharmacie, référence de paiement, réservation et timestamps disponibles.
- Les achats sont limités aux réservations payee ou retiree.
- achat_le, payee_le, retire_le, paiement_declare_le sont en timestamptz afin de conserver la date et l'heure exactes.
- Les anciennes transactions dont la transition d'achat n'a jamais été historisée ne sont pas artificiellement datées : horodatage_achat_exact=false et reservation_creee_le reste disponible comme information distincte.
- RLS/grants : le Client ne lit que ses propres événements ; la pharmacie/admin lit les événements de son périmètre ; aucune écriture directe Client n'est autorisée.
- La vue client_achats est security_invoker et reste soumise aux RLS des tables sous-jacentes.
- Test dédié : supabase/tests/019_historique_achats_client.sql.
- Cette fondation prépare l'interface Mes médicaments achetés et le futur chaînage BI canonique Recherche → Réservation → Paiement → Achat/Retrait → Réachat.
- Aucun merge main, aucune application Production et aucun déploiement ne sont effectués dans ce chantier.


## 🔒 Passe Client — Mon suivi + Mes médicaments achetés — 6 octobre 2026

Le périmètre Client est désormais construit comme un parcours cohérent, et non comme une succession de micro-fonctions.

- Route ajoutée : `/client`.
- **Mon suivi** : réservations récentes, statut, pharmacie, total, produits et chronologie des événements autorisés au Client.
- **Mes médicaments achetés** : historique transactionnel regroupé par achat, médicament, DCI, dosage, forme, photo lorsqu'elle existe, quantité, prix unitaire, total de ligne, total transaction, pharmacie, adresse, référence de paiement et horodatages disponibles.
- Filtres temporels : 7 jours, 30 jours, 3 mois, 1 an, tout ; recherche par médicament/pharmacie.
- Les dates/heures sont affichées en heure locale à partir des timestamps Supabase ; aucune heure historique n'est inventée.
- `client_achats` reste la source canonique du listing d'achats ; `reservation_events` porte la chronologie des transitions.
- Le périmètre Client ne reçoit aucun KPI interne pharmacie, marge, stock interne, caisse, Responsable ou Network Health.
- L'accès repose sur l'authentification + RLS ; l'interface ne masque pas un dataset interne déjà livré au navigateur.
- La photo produit est affichée uniquement lorsqu'elle existe déjà dans `produits.photo_url`.
- Le moyen de paiement n'est pas inventé : le modèle actuel conserve une référence de paiement, pas un type de moyen de paiement.
- L'historique antérieur à la migration 021 conserve une distinction explicite lorsque l'heure exacte de la transition d'achat ne peut pas être reconstruite.
- Migration : `supabase/migration_021_historique_achats_client.sql`.
- Test DB : `supabase/tests/019_historique_achats_client.sql`.

**Gouvernance :** branche `feat/pharmacie-validite-pilotage`, PR #24, aucun merge `main`, aucune migration Production et aucun déploiement sans autorisation explicite **OUI, DÉPLOIE**.


### Correctif de sécurité Client — 6 octobre 2026
Audit de contradiction post-implémentation : la vue `client_achats` était `security_invoker`, mais les RLS internes autorisent aussi les comptes pharmacie à lire leurs réservations. Pour éviter qu'un compte interne puisse recevoir l'historique d'achat des clients via cette vue, la vue est désormais explicitement bornée à `r.client_id = auth.uid()`. La route `/client` vérifie également `profiles.role = client`. Le test 019 couvre désormais cette isolation. Aucun autre rôle ne doit recevoir le dataset Client.


### Complément parcours Client — point d'entrée
- `/client` est maintenant accessible depuis l'accueil via un lien dynamique basé sur le rôle du profil : **Mon espace** pour un Client, **Se connecter** sinon.
- Le lien n'accorde aucun droit ; le contrôle serveur/dataset reste assuré par authentification + rôle + RLS.


### ⚠️ État de validation corrigé — Client non déclaré vert prématurément
Le périmètre Client est **construit et audité**, mais n'est pas encore déclaré 🟢 100 %. La validation réelle de la migration 021 / test 019 reste impossible dans cette session car la connexion Supabase MCP exige un compte lié éligible. De plus, la CI `naxa-quality.yml` de la branche `consolidation` ne se déclenche que pour les PR vers `main`, tandis que PR #24 cible `consolidation`. Un contrôle TypeScript/transpilation local du nouveau code Client est vert, mais il ne remplace ni le build complet ni le test DB réel. **Aucune validation utilisateur du Client ne sera demandée tant que ces preuves ne sont pas vertes.**


## Client — clôture fonctionnelle en attente de validation finale

### Périmètre construit
- /client est l'espace personnel du Client, distinct du Pilotage interne.
- Mon suivi : réservations récentes, statuts, chronologie disponible et raccourcis.
- Mes médicaments achetés : historique transactionnel groupé par achat, produit, dosage, forme, quantité, prix, pharmacie, adresse, référence de paiement et chronologie.
- Filtres : 7 jours, 30 jours, 3 mois, 1 an, tout ; recherche médicament/pharmacie.
- Les timestamps sont affichés avec date + heure. Lorsqu'un achat historique ne possède pas de transition horodatée, l'interface le signale au lieu d'inventer une heure.
- L'espace Client reste un suivi commercial personnel et n'est pas un dossier médical.

### Sécurité
- Route protégée par authentification + rôle client.
- La base reste l'autorité : client_achats exige auth.uid() = reservations.client_id.
- client_achats est security_invoker=true.
- reservation_events est RLS, sans écriture directe par authenticated.
- Le trigger est non exécutable directement par les rôles applicatifs.
- Une création directe en état terminal payee/retiree produit désormais l'événement nécessaire pour conserver l'horodatage exact de l'achat.

### État
- Migration additive : supabase/migration_021_historique_achats_client.sql.
- Tests : supabase/tests/019_historique_achats_client.sql — 16 assertions structurelles/sécurité.
- Migration 021 non appliquée en Production.
- Le Client reste 🟠 en validation finale, pas 🟢 prématurément.
- Aucun merge main et aucun déploiement Production sans autorisation explicite.

## Caisse — construction complète du périmètre opérationnel

### Périmètre
- Une Caisse reste un poste opérationnel de la même pharmacie : même stock, mêmes réservations, même identité commerciale.
- La Caisse peut traiter les opérations autorisées : consultation du stock, modification des quantités, traitement des réservations, confirmation du paiement et du retrait, activité de son poste.
- La Caisse ne gère pas les utilisateurs, les Responsables, l'architecture, les conventions, les tarifs, les coûts d'achat, la marge, l'import global du stock ni le statut de garde.
- L'import de stock est retiré de l'UI Caisse et protégé par le moteur de privilèges.
- Le bouton de gestion des Caisses n'est visible que pour le Promoteur.

### Autorisation
- migration_022_caisse_perimetre.sql rend l'architecture A1/A2/A3/A4 effective dans naxa_has_privilege().
- Les transitions de réservation passent désormais par les privilèges correspondants.
- set_garde() exige MANAGE_GUARD_STATUS.
- La modification de quantité exige EDIT_STOCK_QUANTITY.
- Le socle opérationnel Caisse est provisionné automatiquement par la DB lors de l'attribution du rôle Caisse, dans les limites de l'architecture et du quota.
- Aucun privilège supérieur n'est accordé au rôle Caisse.

### Pilotage Caisse
- Le dashboard Caisse n'utilise plus le dataset de pharmacie entière.
- stats_caisse_scope() expose uniquement les opérations attribuées au poste courant via reservation_events.actor_id.
- CA Caisse compté au passage payee, une seule fois par opération ; le retrait ne double pas le CA.
- Les données d'un autre poste ne sont pas utilisées pour le tableau Caisse.

### Tests
- supabase/tests/020_caisse_perimetre.sql — 20 assertions.
- Migration 022 et test restent sur la branche ; aucune application Production.
- Aucun merge main et aucun déploiement sans autorisation explicite.

## Passe Client — validation finale (6 octobre 2026)
- `/client`, Mon suivi et Mes médicaments achetés sont construits sur la branche dédiée.
- Migration additive `supabase/migration_021_historique_achats_client.sql`.
- Test `supabase/tests/019_historique_achats_client.sql` : **16/16 assertions PASS** lors d'une exécution réelle sur Supabase NAXA, entièrement rollbackée.
- Preuve RLS réelle sous `authenticated` : le Client propriétaire voit uniquement ses réservations/achats ; un autre UUID ne voit rien.
- `client_achats` : `security_invoker=true`, filtre explicite `r.client_id = auth.uid()`, achats limités à `payee`/`retiree`.
- Trigger d'historisation vérifié pour transition terminale et référence de paiement.
- CI `NAXA quality #223` : **SUCCESS** — TypeScript PASS + build Next.js PASS sur le HEAD Client corrigé.
- Correction TypeScript additive de `/pharmacie/pilotage` : narrowing explicite du type Caisse/Stats ; aucun changement métier.
- **Client : 🟢 validé au niveau branche + Supabase transactionnel + RLS + CI/build.**
- Migration 021 non persistée en Production ; `main` et Production restent inchangés conformément à la gouvernance.


## 🔒 PASSE CAISSE — VALIDATION TECHNIQUE INTERMÉDIAIRE — 6 OCTOBRE 2026

### Audit contradictoire exécuté
- Les migrations 013→022 ont été rejouées dans une transaction réelle Supabase puis **ROLLBACK** : aucune modification persistante de Production.
- `supabase/migration_022_caisse_perimetre.sql` a été corrigée après deux contradictions détectées par le test : les privilèges **VIEW_REPORTS / VIEW_CAISSE_REPORT** et **VIEW_CA / VIEW_CA_HISTORY / VIEW_PILOTAGE** ne doivent pas être exposés à la Caisse tant que ces modules/datasets ne sont pas construits.
- Le test Caisse `supabase/tests/020_caisse_perimetre.sql` a été rendu exécutable sans pgTAP, par assertions SQL transactionnelles.
- Validation structurelle Caisse : **20/20 assertions PASS**, transaction rollbackée.
- Contradiction métier conservée et clarifiée : la Caisse peut voir la file opérationnelle partagée de réservations de sa pharmacie ; son **Pilotage** reste borné à l'acteur courant. Elle ne reçoit pas le Pilotage/CA global ni les opérations confidentielles d'autres caisses.

### Blocage restant avant 🟢
- Une validation runtime complète sous utilisateurs Caisse réels/simulés n'est pas encore possible sur l'environnement Supabase actuel : la base Production contient les fondations 009/010/011/012 mais **aucun profil `public.profiles` exploitable** pour construire une fixture Caisse sans créer de comptes.
- Aucune création de compte réel ni modification persistante n'est autorisée pour contourner ce blocage.
- CI GitHub `NAXA quality` a été déclenchée sur le HEAD et doit être contrôlée avant clôture.

### Gouvernance
- Branche : `feat/pharmacie-validite-pilotage`.
- `main` inchangé.
- Production inchangée.
- Aucun merge ni déploiement sans **OUI, DÉPLOIE**.

**Verdict actuel : 🟠 CAISSE — architecture et périmètre corrigés + 20/20 structurel, mais runtime multi-utilisateur encore à fermer.**


## 🟢 PASSE CAISSE — VALIDATION FINALE — 6 OCTOBRE 2026

Cette section **fait foi et supersède les précédents états intermédiaires 🟠 Caisse** de ce document.

### Contradiction finale fermée
- migration_022_caisse_perimetre.sql ne provisionne plus à une Caisse des privilèges de rapports/pilotage global non construits.
- Les privilèges globaux VIEW_CA, VIEW_CA_HISTORY, VIEW_PILOTAGE, VIEW_REPORTS et VIEW_CAISSE_REPORT ne sont pas attribués au rôle Caisse par l'architecture.
- Le moteur naxa_has_privilege() reste la barrière effective : un privilège présent dans le catalogue n'est pas exploitable sans autorisation architecturale + scope + privilège de profil.

### Preuves DB réelles
- Migrations 013→022 rejouées dans une transaction réelle Supabase puis ROLLBACK.
- Test d'acceptation Caisse supabase/tests/020_caisse_perimetre.sql : 20/20 assertions PASS.
- Test runtime transactionnel avec profils Caisse/Promoteur existants : 11/11 contrôles PASS.
- Vérifications runtime : stock autorisé dans le périmètre, modification de quantité autorisée, paiement autorisé, import stock refusé, coût d'achat refusé, garde refusée, CA global refusé, autre pharmacie refusée, pilotage borné au poste, provisionnement Caisse interdit à une Caisse.
- Toutes les fixtures runtime ont été rollbackées : aucune donnée métier persistée.

### CI / branche / gouvernance
- NAXA quality #229 : SUCCESS.
- Branche : feat/pharmacie-validite-pilotage.
- main inchangé.
- Migrations 021/022 non persistées en Production.
- Aucun merge ni déploiement Production sans autorisation explicite.

### Verdict
**🟢 PASSE CAISSE — validée : architecture + privilèges + scope + runtime Supabase transactionnel + tests + CI + documentation.**

**Prochain passage : Responsable.**


## 🟢 PASSE RESPONSABLE — VALIDATION FINALE — 6 OCTOBRE 2026

Cette section fait foi et supersède les états intermédiaires précédents concernant Responsable.

### Périmètre fermé
- Responsable = niveau interne N2 + fonction `responsable` ; aucun nouveau `role_type='responsable'` n'est requis.
- Architecture A3 `PARENTS_AINES_CADETS` : Promoteur → Responsable → Caisse.
- Le Responsable gère uniquement ses Caisses directes, dans sa pharmacie.
- Il peut créer/provisionner, suspendre et réactiver une Caisse lorsque les privilèges et l'architecture l'autorisent.
- Il peut consulter le pilotage de sa pharmacie et le CA par Caisse dans le périmètre prévu.
- Il ne peut pas gérer le Promoteur, changer l'architecture, gérer conventions/tarifs, gérer le réseau NAXA, créer des rôles système/custom ni s'auto-élever.
- La Caisse reste une composante opérationnelle de la même pharmacie : aucun nouveau stock ou sous-pharmacie n'est créé.

### Artefacts
- `supabase/migration_023_responsable_perimetre.sql`
- `supabase/tests/023_responsable_perimetre.sql`

### Contradictions fermées
1. **Création Responsable** : réservée au Promoteur et bornée à la pharmacie/architecture autorisée.
2. **Création Caisse par Responsable** : limitée aux Caisses directes et au quota de l'architecture.
3. **Périmètre transversal** : accès à une autre pharmacie refusé.
4. **Élévation hiérarchique** : Responsable ne peut pas cibler Promoteur.
5. **RBAC** : attribution/révocation de privilèges bornées à la cible Caisse directe et aux privilèges délégables compatibles.
6. **Gouvernance** : privilèges d'architecture, convention, tarif, réseau et rôles système exclus.
7. **Fonctions sensibles** : `anon` refusé ; `authenticated` autorisé uniquement sur les signatures prévues.
8. **Enum historique** : aucun test runtime ne consomme une nouvelle valeur enum non commitée ; Responsable reste porté par les attributs internes existants.

### Preuves DB
- Replay transactionnel réel Supabase des migrations `013→023`, avec la mutation enum `responsable` volontairement exclue du replay de test car elle n'est pas nécessaire au modèle Responsable et PostgreSQL interdit l'utilisation transactionnelle immédiate d'une nouvelle valeur enum.
- Fixture runtime avec Promoteur, Responsable et Caisse distincts ; comptes temporaires uniquement dans la transaction ; **ROLLBACK complet**.
- Accréditation Promoteur → Responsable : PASS.
- Provisionnement Responsable → Caisse : PASS.
- Gestion Caisse directe : PASS.
- Suspension + réactivation : PASS.
- Attribution d'un privilège opérationnel compatible : PASS.
- Tentative de privilège de gouvernance : refusée.
- Cible Promoteur : refusée.
- Autre pharmacie : refusée.
- Pilotage pharmacie / CA par Caisse / pilotage Responsable : présents dans l'architecture A3.
- RLS/policy `profiles_team_read` et gates d'exécution sensibles contrôlés.
- **20/20 contrôles runtime/structurels consolidés PASS** sur la fixture finale.

### CI / gouvernance
- CI GitHub **NAXA quality #240 : SUCCESS** sur le HEAD de la branche avant la dernière mise à jour documentaire/test.
- Branche : `feat/pharmacie-validite-pilotage` → PR #24 vers `consolidation`.
- `main` inchangé.
- Production Supabase inchangée ; migration 023 non appliquée en Production.
- Aucun merge ni déploiement Production effectué.

### Verdict
**🟢 PASSE RESPONSABLE — architecture + RBAC + périmètre + runtime transactionnel + sécurité + CI + documentation validés.**

Prochain rôle selon l'ordre convenu : **Promoteur**. Même méthode obligatoire : audit → contradiction → fermeture → test → documentation → 🟢.


## 🟢 PASSE PROMOTEUR — VALIDATION FINALE — 6 OCTOBRE 2026

Cette section fait foi et supersède les formulations intermédiaires concernant le périmètre Promoteur.

### Périmètre fermé
- Le Promoteur est N1 ; il reste porté par `role_type='promoteur'`.
- Le scope canonique est désormais matérialisé par `promoteur_pharmacies` : un Promoteur peut couvrir plusieurs pharmacies, sans accès implicite aux autres pharmacies.
- Une Caisse ou un Responsable reste rattaché à une pharmacie du réseau ; le Promoteur peut gérer les cibles de son réseau selon architecture et privilèges.
- Le Promoteur peut déléguer uniquement les privilèges opérationnels autorisés par NAXA et l'architecture ; les privilèges de gouvernance NAXA restent exclus.
- Le Pilotage réseau est disponible au Promoteur dans le scope `RESEAU`, mais reste borné aux pharmacies effectivement liées au Promoteur.
- Le Promoteur ne peut pas modifier lui-même l'architecture, la convention, les tarifs ou la gouvernance NAXA.
- Une seule convention canonique reste portée par Promoteur, indépendamment du nombre de pharmacies liées.

### Contradiction principale fermée
L'architecture 019→023 utilisait `promoteur_pharmacies` comme scope canonique sans que cette table soit présente dans les migrations du lot. La fermeture est additive :
- `supabase/migration_024_promoteur_pharmacies_scope.sql` crée le lien canonique, ses index et sa RLS.
- `supabase/migration_025_promoteur_privileges.sql` provisionne automatiquement les privilèges Promoteur autorisés par architecture et les privilèges réseau `RESEAU`, sans exposer de fonction de provisioning au client.
- Le provisioning est robuste à l'ordre : création du lien avant ou après attribution de l'architecture.

### Artefacts
- `supabase/migration_024_promoteur_pharmacies_scope.sql`
- `supabase/migration_025_promoteur_privileges.sql`
- `supabase/tests/024_promoteur_perimetre.sql`
- Correction de `supabase/tests/020_authorisation_architecture_privileges.sql` : la vérification Responsable → refus du Pilotage réseau s'exécute désormais avec l'identité Responsable, et non avec l'identité Promoteur.

### Preuve Supabase transactionnelle
- Replay réel des migrations `013→025`, avec exclusion volontaire de la consommation transactionnelle de la nouvelle valeur enum historique `responsable`.
- Test Promoteur `024_promoteur_perimetre.sql` : **PASS complet + ROLLBACK**.
- Scope A/B autorisé ; pharmacie C refusée.
- `VIEW_PHARMACY` autorisé sur A et refusé sur C.
- Gouvernance `MANAGE_CONVENTION`, `CHANGE_ARCHITECTURE`, `VIEW_GLOBAL_NETWORK` refusée au Promoteur.
- Pilotage réseau `RESEAU` autorisé pour le Promoteur et refusé hors réseau.
- Architecture A2 : création Responsable refusée.
- Architecture A3 : création/accréditation Responsable autorisée.
- Création/accréditation Caisse et délégation de `VIEW_STOCK` : PASS.
- Délégation d'un privilège de gouvernance : refusée.
- Cible d'une autre pharmacie : refusée.
- Désactivation d'un lien Promoteur/pharmacie : fermeture du scope ; réactivation : restauration du scope.
- Une seule convention Promoteur : PASS.
- RLS `promoteur_pharmacies` : activée ; `anon` sans SELECT ; `authenticated` limité par policy.
- Provisioning Promoteur : non exécutable directement par `authenticated`, déclenché uniquement par les mécanismes DB.
- Contrôle structurel : PK composite du lien + gouvernance exclue du rôle Promoteur : PASS.

### Régression
- Correction du test 020 pour évaluer le refus réseau avec l'identité réellement Responsable.
- CI GitHub **NAXA quality #254 : SUCCESS** sur le HEAD de la branche.
- Production Supabase inchangée ; migrations `024/025` non appliquées en Production.
- `main` inchangé.
- Aucun merge ni déploiement Production.

### Verdict
**🟢 PASSE PROMOTEUR — scope réseau + architecture + délégation + convention + RLS + runtime transactionnel + régression + CI validés.**

Prochain rôle selon l'ordre convenu : **Admin**. Même méthode obligatoire : audit → contradiction → fermeture → test → documentation → 🟢.


## 🔄 Reprise Promoteur — méthodologie en 6 parties — 6 octobre 2026

Les anciennes mentions présentant le chantier Promoteur comme entièrement clôturé sont **supersédées par cette reprise**. Conformément à la méthodologie demandée, le Promoteur est désormais revalidé partie par partie : **audit → contradiction → correction additive → test Supabase transactionnel → régression → documentation → 🟢 → validation utilisateur avant partie suivante**.

### Partie 1/6 — périmètre réseau/pharmacies : 🟢
- Scope canonique : `promoteur_pharmacies`.
- Accès multi-pharmacie uniquement via liens actifs.
- Hors réseau refusé.
- Désactivation/réactivation du lien testée.
- Gouvernance convention / architecture / réseau global non accordée au Promoteur.
- RLS et grants du lien réseau contrôlés.
- Provisioning Promoteur non exposé à `authenticated`.
- Correction additive : `naxa_scope_allows(..., 'PHARMACIE')` utilise explicitement `promoteur_pharmacies` pour un Promoteur.
- Migrations : `024`, `025`, `026`.
- Validation réelle transactionnelle : **13/13 assertions PASS, rollback complet, aucune donnée persistée**.
- `main` et Production inchangés.

### Parties suivantes
2. ⏳ Architecture + convention + validité
3. ⏳ Accréditation Responsable
4. ⏳ Gestion des Caisses + délégation
5. ⏳ Pilotage / CA / reporting réseau
6. ⏳ Sécurité finale + régression CI/build + clôture documentaire

**Aucune partie suivante ne sera déclarée verte avant fermeture de toutes ses contradictions et preuve correspondante.**


### Partie 2/6 — architecture + convention + validité : 🟢
- Contradiction fermée : un Promoteur pouvait être techniquement actif alors que sa convention/son abonnement étaient expirés ou résiliés ; le moteur d'autorisation ne possédait pas de barrière commerciale canonique.
- Contradiction fermée : l'abonnement Promoteur pouvait théoriquement pointer vers la convention d'un autre Promoteur ; cette incohérence est désormais refusée par un trigger DB.
- Architecture : les gates existants sont conservés et vérifiés : A1/A2 n'exposent pas CREATE_RESPONSABLE, A3/A4 l'autorisent.
- Validité canonique ajoutée : naxa_promoteur_valide(uuid) exige simultanément Promoteur actif + convention active non échue + abonnement actif non échu et rattaché à cette convention.
- Autorisation : naxa_can(...) refuse désormais un Promoteur commercialement invalide avant l'évaluation des privilèges.
- Accréditation : accrediter_profile(...) refuse un Promoteur invalide et un parent Promoteur invalide.
- Provisioning réseau : naxa_provision_promoteur_pharmacie(...) ne peut plus réactiver/provisionner les droits d'un Promoteur commercialement invalide.
- Scope réseau : la validité commerciale ne détruit pas le lien promoteur_pharmacies ; elle bloque l'opérationnel. Le scope de la Partie 1 reste intact.
- Migration additive : supabase/migration_027_promoteur_architecture_validite.sql.
- Test : supabase/tests/027_promoteur_architecture_validite.sql.
- Validation Supabase réelle : 11/11 assertions PASS, replay des migrations 013→026 + 027 dans une transaction, puis ROLLBACK complet ; aucune donnée de test persistée.
- Production : migration 027 non appliquée.
- main : inchangé ; aucun merge ni déploiement Production.

### État Promoteur après Partie 2
- Partie 1/6 : 🟢 Périmètre réseau/pharmacies.
- Partie 2/6 : 🟢 Architecture + convention + validité.
- Partie 3/6 : ⏳ Accréditation Responsable — ne démarre qu'après validation utilisateur.
- Partie 4/6 : ⏳ Gestion des Caisses + délégation.
- Partie 5/6 : ⏳ Pilotage / CA / reporting réseau.
- Partie 6/6 : ⏳ Sécurité finale + régression CI/build + clôture documentaire.
## 🔄 Promoteur — checkpoint Partie 3/6 — 6 octobre 2026

La reprise du chantier Promoteur est traitée en 6 parties selon la méthode canonique : audit → contradiction → correction additive → test réel → régression → documentation → 🟢 → validation utilisateur.

### Partie 1/6 — Périmètre réseau/pharmacies : 🟢
Validation transactionnelle réelle : **13/13 assertions PASS**, rollback complet, aucune donnée persistée.

### Partie 2/6 — Architecture + convention + validité : 🟢
Validation transactionnelle réelle : **11/11 assertions PASS**, replay 013→027, rollback complet, aucune donnée persistée.

### Partie 3/6 — Accréditation Responsable : 🟢 VERTE — 100 %
- `accrediter_profile(..., niveau=2)` impose `CREATE_RESPONSABLE`.
- Validité commerciale, scope pharmacie, parent explicite et quota d'architecture restent obligatoires.
- A1/A2 refusent structurellement la création d'un Responsable ; A3/A4 l'autorisent.
- Le moteur d'autorisation reste unifié autour du chemin canonique privé.
- Les références obsolètes `governance_only`, `profile_privileges` comme table d'écriture et `can_access_pharmacy()` ont été réconciliées.
- Validation comportementale transactionnelle réelle : **6/6 assertions PASS**.
- ROLLBACK complet ; aucune donnée de test persistée.
- Aucun merge `main`, aucune migration Production, aucun déploiement.

**Verdict : Partie 3/6 🟢 100 %.**

### Parties suivantes
- Partie 4/6 — Gestion des Caisses + délégation.
- Partie 5/6 — Pilotage / CA / reporting réseau.
- Partie 6/6 — Sécurité finale + régression CI/build + clôture documentaire.

**Important :** la pause de la Partie 3 n'est pas une validation verte. Elle est conservée comme checkpoint technique ouvert pour reprise ultérieure.

## 🔎 Audit complémentaire CI — 6 octobre 2026

Le contrôle contradictoire du workflow a identifié une cause technique supplémentaire qui expliquait l'absence totale d'exécution CI :

- le fichier `.github/workflows/naxa-quality.yml` contenait **deux définitions identiques** des jobs `verification-9-role-chain`, `verification-10-security-regression` et `verification-11-session-audit` ;
- cette duplication rendait le workflow YAML structurellement ambigu et pouvait empêcher GitHub Actions de charger le workflow ;
- la correction a supprimé le second bloc dupliqué et conservé une seule chaîne canonique **7 → 8 → 9 → 10 → 11** ;
- `workflow_dispatch` a également été ajouté pour permettre une exécution manuelle contrôlée ;
- aucun code métier, aucune migration Production et aucun `main` n'ont été modifiés.

**État de preuve après correction :** le défaut d'orchestration est corrigé, mais un run GitHub Actions post-correction reste nécessaire pour déclarer les points 3→11 verts. Tant que ce run n'est pas observé avec ses jobs terminés avec succès, aucune validation finale n'est accordée.

## 🔎 Audit des points pending — 6 octobre 2026

Audit croisé exécuté selon la méthode NAXA : **audit → contradictions → correction → test → régression → documentation → 100% vert**.

### Contradictions racines identifiées
1. **CI non déclenchée sur la bonne branche cible** : le workflow présent sur `consolidation` ne ciblait que `main`, alors que le PR Promoteur 25 cible `consolidation`. Les points 3→10 pouvaient donc rester « pending » sans constituer des échecs métier.
2. **Replay historique incomplet en Vérification 8** : la normalisation appliquée aux autres jobs n'était pas reproduite pour `handle_new_user()`, `reserve_stock()` et `my_pharmacie()`. Cela créait un échec de harness indépendant du métier testé.
3. **Audit `SESSION_LIMIT_REJECTED` transactionnellement impossible** : l'écriture précédait un `RAISE EXCEPTION` dans le même trigger ; le rollback pouvait annuler la trace. Le refus est désormais journalisé par le chemin serveur après l'échec, avec une fonction réservée à `service_role`.
4. **Test session insuffisant** : le contrôle 034 était structurel. Un test 035 couvre désormais la séquence 4 sessions → 5e refus → trace de refus → révocations.
5. **Surface SECURITY DEFINER à réduire** : les fonctions trigger d'audit sont désormais retirées des droits directs `public/anon/authenticated`.
6. **Sémantique `provider` ambiguë** : `auth.sessions.tag` n'est pas utilisé comme faux fournisseur ; les événements issus des triggers laissent `provider` nul et le chemin serveur renseigne explicitement `password`.

### État de preuve
- Corrections de code et de CI appliquées sur la branche de travail.
- Aucun merge `main`, aucune migration Production.
- La chaîne CI doit encore fournir la **preuve d'exécution** avant tout passage au vert.
- **Aucune partie 3→10 n'est déclarée verte sans cette preuve.**


## 🔒 ÉTAT COURANT — PILOTAGE — ÉTAPE 1 AUDIT SOCLE — 6 OCTOBRE 2026

Cette section supersède les formulations historiques antérieures du document lorsqu'elles présentent le Pilotage comme définitivement vert.

### Résultat de l'étape 1
- Source KPI canonique : `stats_pilotage_scope(p_jours)`.
- Recherche/funnel : `evenements` comme source KPI canonique ; `recherche_events` hors KPI.
- CA/ventes : `v_reservations_ca`, au grain réservation, sans double comptage `payee → retiree`.
- Scope Promoteur : `promoteur_pharmacies` actives.
- Scope Admin : réseau NAXA avec exclusion des pharmacies de démonstration selon la règle canonique.
- Responsable/Caisse : pharmacie de leur périmètre effectif.
- Recherche sans pharmacie : jamais attribuée à un Promoteur/Responsable/Caisse.
- Aucun second moteur KPI ne doit être créé pour le Pilotage Performance.

### Contradictions restantes à fermer
1. **Preuve d'exécution multi-rôles** : les tests versionnés existent, mais la preuve CI post-corrections doit encore être observée.
2. **Documentation historique** : les anciennes sections restent conservées comme historique mais ne constituent pas l'état courant.
3. **Production** : les migrations Pilotage 013→019 ne sont pas appliquées en Production ; aucune conclusion de déploiement ne doit en être tirée.

### Verdict étape 1
**🟡 — socle métier/code cohérent, mais étape non clôturée à 100 % tant que la preuve d'exécution et la réconciliation documentaire ne sont pas définitivement fermées.**

Règle : aucune nouvelle architecture KPI ne sera créée pour le Pilotage Performance avant cette fermeture.

## 🔎 PROMOTEUR PARTIE 4/6 — CHECKPOINT D'AUDIT — 7 OCTOBRE 2026

La Partie 4 couvre Gestion des Caisses + délégation des privilèges. Les contradictions métier identifiées ont été corrigées : provisionnement initial séparé de la réactivation, hiérarchie directe, quotas d'architecture, délégation bornée par rôle/architecture/scope, gouvernance non délégable et validité commerciale Promoteur.

Le chemin historique authorize() a été réconcilié vers naxa_has_privilege() avec conservation du scope. Le replay CI a également été corrigé pour exclure la migration historique 020_architecture_privileges.sql, incompatible avec la vue de compatibilité profile_privileges du socle actuel.

Les tests versionnés 029/030/031 ont été renforcés et le workflow naxa-promoteur-part4.yml exécute maintenant les trois groupes. La validation transactionnelle de compilation des migrations 029/030 est PASS. La preuve CI complète de Partie 4 est actuellement en attente d'exécution ; la Partie 4 reste donc 🟡 et ne doit pas être présentée comme verte avant le PASS CI.


Partie 4 — replay CI : correction supplémentaire du catalogue naxa_privileges, avec création des alias historiques family/description dans les deux chemins de migration. Validation finale toujours en attente du prochain PASS CI.


### Partie 4 — état après audit contradictoire (7 octobre 2026)
- 🟡 Non déclarée verte : les contrôles de preuve définitive restent bloqués par l’infrastructure GitHub Actions (runner échoue avant exécution, y compris smoke `checkout + echo`) et par la protection d’exécution DDL du connecteur Supabase pour un replay transactionnel.
- Corrections intégrées : gate canonique `naxa_can_manage_privilege_target`, matrices de privilèges construites après le catalogue, fermeture des privilèges de gestion/élévation pour N3 Caisse, correction de la contrainte HYBRIDE, migration CI vers `supabase/setup-cli@v3`.
- Aucun merge `main`, aucun déploiement Production, aucun changement persistant Supabase réalisé pendant cette passe.
- Reprise requise dès qu’une preuve d’exécution CI ou un environnement Supabase de test autorisé est disponible.

### Partie 4 — état final après audit contradictoire, 7 octobre 2026
- 🟢 **VERTE — 100 %** sur la preuve fonctionnelle Supabase.
- Corrections finales : façade publique vers `private.*` sécurisée en `SECURITY DEFINER`, gate unique des descendants directs, provisioning initial Caisse compatible avec `parent_profile_id = NULL`, suppression des anciens triggers de provisioning Promoteur, wrapper public `naxa_has_privilege`, et test anti-révocation hors descendant direct.
- Preuve exécutée dans PostgreSQL réel, dans une transaction entièrement annulée : groupes **1+2, 3+4 et 5+6 passés** ; contrôle post-`ROLLBACK` : aucune convention de test persistante, aucun profil `p4*` persistant, RLS `profiles` restauré à `true`, trigger historique restauré.
- Aucun changement persistant Supabase Production, aucun merge `main`, aucun déploiement Production.
- GitHub Actions n'a pas fourni de preuve exploitable (jobs précédents échouant avant étape, `steps=[]`) ; cette anomalie d'infrastructure ne remet pas en cause la preuve transactionnelle PostgreSQL réussie.

### Partie 5 — audit contradictoire, 7 octobre 2026 — état courant
- 🟡 **Non déclarée verte** : contradiction métier corrigée dans la branche, mais la preuve d'exécution définitive reste bloquée par l'infrastructure GitHub Actions (runner `ubuntu-22.04` termine en ~2 secondes avec `steps=[]`) et le connecteur Supabase NAXA n'est actuellement plus éligible pour un replay transactionnel.
- Contradiction racine corrigée : le RPC de pilotage pouvait exposer le dashboard à un utilisateur authentifié sur la seule base de son rôle, sans exiger le privilège de pilotage correspondant. Le moteur Part 5 utilise désormais la chaîne canonique `private.stats_pilotage_scope` + façade publique invoker et vérifie `VIEW_NETWORK_PILOTAGE` pour Promoteur, `VIEW_RESPONSABLE_PILOTAGE` pour Responsable et `VIEW_CAISSE_PILOTAGE` pour Caisse.
- Scope Promoteur exclusivement basé sur `promoteur_pharmacies` actifs ; les tests 032/033 ont été renforcés avec architecture et contrôle de révocation du privilège réseau.
- Aucun merge `main`, aucune migration Production, aucun déploiement Production.
- Reprise obligatoire de la preuve dès qu'un runner GitHub exécutable ou un environnement Supabase de test autorisé est disponible. **Partie 5 ne doit pas être annoncée verte avant PASS des tests 032/033.**


### Partie 5 — audit du blocage d'exécution, 7 octobre 2026
- 🟡 Toujours non déclarée verte : la preuve complète 032/033 n'est pas encore PASS.
- Cause code/test supplémentaire trouvée et corrigée : les tests 032/033 utilisaient un dollar-quoting PostgreSQL invalide (do $ ... end $ au lieu de do $$ ... end $$) ; la révocation du privilège 032 n'alimentait pas revoked_at, ce qui violait la contrainte canonique active OR revoked_at IS NOT NULL.
- Cause d'intégration supplémentaire trouvée et corrigée dans migration_032 : la façade publique SECURITY INVOKER ne pouvait pas résoudre le helper private.stats_pilotage_scope car le rôle authenticated n'avait pas USAGE sur le schéma private. Le helper reste non exécutable directement ; seul l'usage du schéma est accordé à authenticated et l'exécution de la façade publique reste limitée à authenticated.
- Preuve PostgreSQL obtenue : la migration 032 compile entièrement dans une transaction annulée ; les privilèges de la façade/helper ont été vérifiés sans persistance.
- Limite restante : le replay fonctionnel 032/033 sur l'état réel nécessite les tables de conventions/abonnements présentes dans la replay complète de la branche, absentes du projet NAXA actuellement déployé ; aucune création persistante n'a été effectuée pour contourner ce différentiel.
- GitHub Actions continue d'échouer avant toute étape (steps=[]), même après passage de ubuntu-22.04 à ubuntu-latest. Le statut public GitHub indique actuellement Actions opérationnel, donc la cause exacte de cette absence de runner reste à isoler côté exécution du dépôt/connecteur.
- Aucun merge main, aucune migration Production persistante, aucun déploiement Production.


## Audit Part 5 — état au 7 octobre 2026
- Contradiction racine désormais isolée : le dépôt de branche contient la correction du RPC de pilotage (migration_032_promoteur_scope_pilotage.sql), mais cette migration n'est pas appliquée sur le projet Supabase NAXA actuellement connecté.
- Preuve Supabase : l'historique distant contient les migrations jusqu'aux séries 033–037, mais aucune migration correspondant à la correction 032 ; la définition distante de private.stats_pilotage_scope ne contrôle pas VIEW_NETWORK_PILOTAGE avant de construire le scope Promoteur.
- Conséquence : le test de révocation du privilège réseau ne peut pas être vert sur la base distante tant que la correction 032 n'est pas déployée.
- Deux contradictions de harness ont aussi été corrigées dans les tests 032/033 : références à conventions_promoteurs / abonnements_promoteurs inexistantes dans le schéma canonique distant, et ordre de fixture corrigé pour créer l'architecture avant le lien Promoteur/pharmacie afin que le trigger de provisioning puisse attribuer les privilèges.
- Une preuve transactionnelle sur la base distante a confirmé que, lorsque l'architecture et le lien sont présents, le RPC actuel produit bien le scope Promoteur ; elle a également démontré le défaut précis : après révocation de VIEW_NETWORK_PILOTAGE, l'ancien RPC continue à répondre, car son code distant ne contient pas la garde de privilège.
- Aucune donnée de test n'a été conservée : les preuves transactionnelles ont été exécutées avec rollback.
- État Part 5 : 🟡 — blocage précis identifié. Aucun merge main et aucune migration Production appliquée dans cette étape.
- La fermeture définitive nécessite l'application de la migration 032 corrigée sur un environnement NAXA autorisé, puis l'exécution réelle des tests 032/033 et la vérification finale de rollback/sécurité.


## Part 5 — clôture de l'audit et preuve finale
- Blocage isolé et corrigé : le projet Supabase NAXA avait dépassé la migration 032 sans embarquer sa garde `VIEW_NETWORK_PILOTAGE`.
- Solution déployée : migration forward `038_promoteur_scope_pilotage_guard` appliquée au projet NAXA. Elle restaure le moteur canonique `private.stats_pilotage_scope`, impose le privilège réseau au Promoteur, conserve `SECURITY DEFINER` avec `search_path=''`, révoque l'exécution directe du helper privé et expose uniquement la façade authentifiée.
- Preuve comportementale 032 : Promoteur autorisé → RPC accessible ; révocation de `VIEW_NETWORK_PILOTAGE` → exception exacte `Privilège Pilotage réseau requis` ; réactivation → accès rétabli. Transaction rollbackée.
- Preuve comportementale 033 : pharmacie hors périmètre exclue du scope et des KPI ; révocation du privilège réseau refusée par le RPC. Transaction rollbackée.
- Vérification migrations : `038_promoteur_scope_pilotage_guard` est maintenant présente dans l'historique Supabase.
- Aucun fixture de test persistant ; aucun merge `main` ; aucune modification Vercel/Production applicative.
- Les tests GitHub Actions restent un contrôle CI secondaire ; leur échec historique `steps=[]` est une défaillance d'exécution du runner et non un échec SQL. La preuve PostgreSQL réelle sur le projet NAXA est désormais disponible.
- **Partie 5 : 🟢 100 % — chantier fonctionnel et sécurité validés.**


## 🔒 PARTIE 6/6 — RÉCONCILIATION FINALE PROMOTEUR — 🟢 100 %
**Mise à jour : 7 octobre 2026 — état courant prioritaire sur les historiques précédents**

### Contradiction racine fermée
Le modèle autorisation imposait que la validité commerciale du Promoteur soit une condition préalable à ses privilèges et à son pilotage. Le moteur distant possédait le contrôle de rôle, de scope et de privilèges, mais aucune fonction canonique `naxa_promoteur_valide()` n'existait réellement sur Supabase. `naxa_provision_caisse()` la référençait pourtant déjà : c'était une divergence code ↔ base.

### Correction exécutée
- `039_promoteur_reconciliation_validite` : création du contrôle canonique de validité commerciale et intégration dans `naxa_has_privilege()` et `naxa_scope_allows()`.
- Une seule pharmacie active liée au Promoteur avec abonnement absent, expiré, impayé ou pharmacie inactive suffit désormais à invalider le Promoteur pour l'ensemble de son réseau.
- Le privilège réseau et le pilotage Promoteur passent donc par la même chaîne d'autorité : identité → validité commerciale → privilège → scope.
- `040` puis `041` ont fermé puis réconcilié la façade `naxa_promoteur_valide()` en SECURITY INVOKER, avec helper privé protégé.
- Les fonctions privilégiées conservent `search_path=''` et des références qualifiées.

### Preuves Supabase réelles
- Promoteur + pharmacie valide : `naxa_promoteur_valide() = true`.
- Même Promoteur + abonnement expiré : `false`.
- Après expiration : `naxa_has_privilege('VIEW_NETWORK_PILOTAGE', null, 'RESEAU') = false`.
- Avec deux pharmacies liées, l'expiration d'une seule invalide le réseau entier : `false`.
- `stats_pilotage_scope(7)` refuse alors avec l'exception exacte : `Privilège Pilotage réseau requis`.
- Tous les fixtures de ces contrôles ont été exécutés en transaction puis annulés ; vérification post-rollback : aucun lien de test, aucun changement de rôle, aucune architecture de test persistante.
- ACL finale : helper privé non exécutable par `public/anon` ; façade exposée uniquement à `authenticated`.

### Réconciliation finale
1. Architecture ↔ rôle ↔ fonction interne : 🟢
2. Promoteur ↔ pharmacies autorisées : 🟢
3. Validité commerciale ↔ privilèges ↔ pilotage : 🟢
4. Responsables/Caisses ↔ descendants ↔ scopes : 🟢
5. Privilèges ↔ délégation ↔ RLS/grants/RPC : 🟢
6. Pilotage ↔ sécurité ↔ source KPI canonique : 🟢
7. Documentation dépôt ↔ état Supabase : 🟢

### Verdict
**PARTIE 6/6 — 🟢 100 %.**
Le chantier Promoteur est techniquement réconcilié sur les six parties. Aucun merge `main`, aucun déploiement Vercel et aucune migration applicative Production n'ont été effectués dans cette exécution.


### 🔴→🟢 Réconciliation de la règle commerciale — priorité finale
La règle historique « une pharmacie impayée ne bloque pas les autres pharmacies du Promoteur » est **supersédée** par l'arbitrage final du chantier Promoteur : **un Promoteur = une convention commerciale ; son échéance bloque l'ensemble de son réseau**. L'implémentation courante applique donc une validité réseau transversale avant les privilèges Promoteur et le pilotage. Cette section est prioritaire sur toute formulation historique antérieure.


## 📌 RÉFÉRENTIEL MAÎTRE ACTUEL — V3.7 + FUSION V2 — 7 OCTOBRE 2026

Cette section est la référence actuelle de parcours et complète l'historique sans supprimer aucune exigence antérieure.

- **Cahier des charges NAXA V3.7** : référence du périmètre fonctionnel. Toute exigence V3.7 reste à réaliser, sauf si elle est explicitement classée EXISTANT dans le § 2bis ou explicitement arbitrée par le fondateur.
- **Prompt maître Fusion V2** : référence de l'ordre de travail, de la fusion avec l'existant, des points d'arrêt et de la méthode de preuve.
- **État réel dépôt / Supabase / Vercel** : référence de preuve. Une documentation historique ne peut pas transformer un élément non testé en élément vert.
- Les décisions nouvelles du fondateur peuvent **ajouter ou préciser** le périmètre ; elles ne retirent pas une exigence V3.7 sans décision explicite de remplacement.
- Principe de fusion : **étendre, compléter, ne pas supprimer, ne pas remplacer, ne pas dupliquer**.
- Légende de preuve : 🟢 prouvé ; 🟡 cohérent mais non clos ; 🟠 non prouvé ; 🔴 absent. Aucun faux vert.

### Ordre Fusion V2 désormais gouvernant
**Étape 0 — clôture du Pilotage 360°** → **Réconciliation** → **Qualité** → **ERP phases B, C, D, E, F, G, H du Cahier V3.7** → **I mise en service terrain** → **J paiement en ligne client (uniquement sur demande)** → **K extensions F69–F75**.

La Phase E du cahier est adaptée par Fusion V2 : le Pilotage 360° déjà couvert dans l'Étape 0 n'est pas reconstruit ; seuls ses éléments ERP restant à construire sont traités.

### Point de situation
Le chantier Promoteur 1→6 est documenté comme 🟢 100 %. Cela **ne suffit pas à lui seul** pour déclarer l'Étape 0 Pilotage 360° globalement verte : Fusion V2 exige encore la passe Admin, la clôture de l'étape 1 Audit socle Pilotage et la preuve CI/réconciliation correspondante avant d'enchaîner sur Pilotage Performance.


## 2026-10-07 — Mise au vert Pilotage 360° / Étape 1 — audit contradictoire

- Référence de parcours : **Cahier V3.7 + Prompt Maître Fusion V2** ; aucune exigence supprimée.
- Branche de travail : `feat/promoteur-partie3-responsable-accreditation-20261006`, PR #25 vers `consolidation`. Aucun merge `main`, aucune mutation Production et aucun déploiement autorisé sans **OUI, DÉPLOIE**.
- CI observée sur le commit `6033b5...` puis sur `a07e5a...` : workflows Pilotage Étape 1 et Promoteur échouent immédiatement avec jobs sans étapes exécutées. Le remplacement initial `setup-cli@v3` était incorrect ; il a été corrigé vers l'action Supabase officiellement documentée/pinnée v2.1.1. Malgré cela, l'exécution reste non démarrée côté runner. Cette preuve CI reste donc **non verte**.
- Audit Supabase réel : les migrations distantes vont jusqu'à **041**. La façade `public.stats_pilotage_scope` est actuellement `SECURITY INVOKER` et appelle `private.stats_pilotage_scope`, dont l'EXECUTE est révoqué aux rôles API. Cette combinaison produit un défaut réel de permission pour un appel authentifié.
- Cause racine applicative identifiée : la façade publique du Pilotage doit être le point contrôlé d'accès, tandis que le moteur privé reste protégé. La correction retenue est additive : migration **042** `migration_042_stats_pilotage_facade_security.sql`, façade `SECURITY DEFINER`, `search_path='' `, EXECUTE uniquement pour `authenticated`; aucun accès `anon/public`.
- Le test `032_promoteur_scope_reseau_7.sql` contenait en outre une mutation directe de `naxa_profile_privileges` après passage au rôle `authenticated`, ce qui est incompatible avec le modèle de droits. Il a été corrigé pour effectuer cette mutation de fixture sous `postgres`, puis tester le comportement sous `authenticated`.
- Vérification Supabase directe avant correction : **032 échoue** sur la mutation interdite du catalogue de privilèges ; **033 échoue** sur l'appel à la façade de Pilotage. Ces échecs sont des preuves de non-vert, pas des succès masqués.
- Vercel : la Production observée reste sur `main`, commit `c171b546...`; aucune promotion de la branche de travail et aucun Preview volontaire n'ont été effectués.

### Statut de mise au vert
**🟠 Non vert — correction engagée, preuve CI encore bloquée.**

Prochaine preuve obligatoire : exécution réelle du workflow après migration 042 + tests 032/033 + build, puis ré-audit. Tant que ces preuves ne sont pas observées avec succès, Pilotage 360° reste fermé et aucun passage à Pilotage Performance suivant n'est déclaré vert.
