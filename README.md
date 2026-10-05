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
