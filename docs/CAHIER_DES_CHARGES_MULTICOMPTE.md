# NAXA — Cahier des charges multicompte

**Version :** 1.0 — 23 octobre 2026  
**Dépôt de référence :** `audreymendomo23-netizen/NAXA`  
**Branche de référence :** `main`  
**SHA de référence avant ce document :** `06fe1a61a4e1329299bfc311bc77ce63d9deabe1`  
**Périmètre :** identité NAXA commune, espace client, affectations professionnelles, autorisations API/RPC/RLS et parcours des comptes métier.  
**Règle de travail :** mettre au vert tout ce qui est faisable avec les accès et outils effectivement disponibles, sans contourner les contrôles de sécurité ni inventer de preuve.

> Ce document est le registre de continuité de ce chantier. Il distingue les travaux déjà présents dans `main`, les éléments audités statiquement, les corrections restant à effectuer et les validations bloquées par l’environnement. « Présent dans le code » ne signifie pas « testé », « appliqué en base » ou « validé en production ».

---

## 1. Règles impératives du chantier

1. **Source de vérité :** dépôt NAXA, branche `main`, sauf preuve explicite contraire.
2. **Aucun déploiement.** Aucun déploiement Vercel/Production ne doit être déclenché dans ce chantier.
3. **Pas de commits de code ni de série de commits.** L’autorisation présente porte sur l’enregistrement de ce document uniquement. Toute modification de code, de configuration, de migration SQL ou de tests nécessite une autorisation explicite distincte. Ne pas créer de branche ni de PR.
4. **Pas de modification de Supabase Production.** Les accès de production restent en lecture seule ; aucune migration ni écriture distante.
5. **Ne jamais affaiblir la sécurité pour obtenir du vert.** Préserver RLS, contrôles serveur, rôles, périmètres pharmacie, quotas, provisionnement métier et journaux d’audit.
6. **Pas de fausse validation.** Distinguer « trouvé dans le dépôt », « inspecté », « corrigé », « test exécuté », « base vérifiée » et « Production vérifiée ». Un fichier de migration n’est pas une preuve d’application.
7. **Validation étape par étape.** Présenter le bilan de l’étape en cours avant de demander le passage à l’étape suivante. Aucune étape n’est déclarée terminée si ses incohérences corrigeables restent en suspens.
8. **Raisonner par contradiction.** Pour chaque exigence, comparer le comportement attendu, le code réel, les droits effectifs et les preuves disponibles. Chercher la cause racine et les effets de bord avant toute correction.
9. **Ne pas refaire les travaux déjà établis.** La section 2 constitue la base de référence à réutiliser. Ne la réauditer que si un changement de code, une preuve contradictoire, une régression ou un nouveau besoin le justifie.
10. **Limites explicites.** Si une vérification est impossible (quota CI/API, outil indisponible, accès base non accordé, absence de runtime local, action interdite), noter la cause observée et poursuivre toutes les vérifications indépendantes encore accessibles. Ne jamais contourner une limite d’accès ou prétendre qu’un contrôle bloqué a réussi.

## 2. Travaux déjà réalisés — base à ne pas recommencer sans contradiction

### 2.1 Premier incrément d’identité commune — présent dans l’historique de main

Référence documentaire : `docs/AVANT_PROJET_IDENTITE_UNIQUE_ESPACES_NAXA.md`.  
Commit de référence : `73fe1b505b9378ed67f2eac61ba12f983ba10684` — `feat(auth): share client identity with pharmacy access [vercel skip]`.

Travaux consignés dans le dépôt :
- Le parcours de connexion distingue l’espace demandé (client ou pharmacie) et transmet ce choix à l’API.
- L’API de connexion vérifie côté serveur le rôle professionnel, l’état actif du profil et les conditions d’activité/périmètre de pharmacie applicables.
- Le parcours Promoteur → Caisse a été changé : il recherche un compte client existant et vérifié par nom d’utilisateur au lieu de créer un nouvel utilisateur Auth avec e-mail et mot de passe provisoire.
- Le provisionnement métier existant `naxa_provision_caisse` et les contrôles `naxa_can` sont conservés.
- Une restauration compensatoire du profil initial est tentée si le provisionnement échoue ; cette séquence multi-étapes n’est pas une transaction atomique.
- Un sélecteur de bascule d’espace a été introduit pour les parcours concernés ; les routes historiques de code pharmacie ont été conservées pour compatibilité.
- Le document d’avant-projet a identifié une limite d’architecture : `profiles.role` reste un rôle principal unique. Le multi-rôle arbitraire et plusieurs affectations simultanées ne sont donc pas réputés livrés.

**Ne pas réimplémenter ces éléments sans preuve d’une régression.** Le fait qu’ils soient dans le dépôt ne prouve pas que leur recette complète a réussi.

### 2.2 Préservation de l’espace client pour les profils historiques

Référence : commit `a697def03a9a3817fff284e5518e2515b811c52f` — `fix(auth): preserve client space for professional identities`.

Travail consigné :
- La page client ne se fonde plus exclusivement sur `profiles.role === "client"`.
- Elle vérifie plutôt la présence des éléments d’identité client attendus (nom d’utilisateur, nom/prénom, téléphone, date de naissance, âge vérifié et consentement).
- Le correctif vise à préserver l’espace client lorsque le rôle professionnel change, sans confondre identité client et affectation professionnelle.

### 2.3 Compatibilité de profils clients historiques

Référence : commit de main `06fe1a61a4e1329299bfc311bc77ce63d9deabe1` — `fix(auth): avoid blocking legacy client profiles`.

- Le commit courant de référence intègre un correctif de compatibilité pour les profils clients historiques.
- Ne pas revenir sur ce correctif ni réintroduire une barrière basée uniquement sur le rôle sans preuve démontrant un défaut.
- Les parcours de bout en bout et l’absence de régression restent à vérifier ; cette note n’équivaut pas à une recette validée.

### 2.4 Cartographie initiale déjà effectuée

Une première lecture statique a été réalisée sur le commit de référence. Elle a recensé notamment :
- `profiles.role` pour les rôles publics (`client`, `pharmacie`, `admin`, `promoteur`, `caisse`) et `profiles.fonction_interne` pour les fonctions internes, notamment `pharmacien`, `pharmacien_assistant`, `gestionnaire_stock`, `magasinier`, `responsable`, `comptable`.
- Les points d’entrée de connexion, d’inscription, de finalisation de profil, de vérification d’âge, de suppression de compte, de bascule d’espace et de middleware.
- Des mécanismes RPC de privilèges et de périmètre (`naxa_can`, `naxa_has_privilege`, `naxa_scope_allows`), de provisionnement Caisse et de session Gestionnaire de stock.
- Des migrations et tests SQL pertinents. Leur présence n’a pas été utilisée comme preuve que la base distante les a appliqués ou que les tests ont réussi.

Cette cartographie est un point de départ déjà acquis. La suite doit la compléter de façon ciblée, pas recommencer l’inventaire général.

---

## 3. Architecture actuelle et limite à résoudre

Le modèle observé combine :
- l’identité d’authentification Supabase Auth ;
- un profil `profiles` ;
- un rôle public principal (`profiles.role`) ;
- une fonction interne (`profiles.fonction_interne`) ;
- un périmètre d’établissement et des relations hiérarchiques (`pharmacie_id`, `parent_profile_id`, état actif) ;
- des gardes API, des RPC de privilèges/périmètre et des politiques RLS.

**Contradiction structurante :** l’objectif multicompte est qu’une personne garde une identité client durable et puisse recevoir, perdre ou changer un accès professionnel sans effacer l’identité client ni conférer de droits implicites. Un rôle principal unique peut empêcher de représenter proprement plusieurs affectations simultanées. Le chantier doit déterminer si l’architecture actuelle suffit au besoin effectivement demandé ou si une table d’affectations professionnelles est nécessaire. Ne pas créer cette table automatiquement : établir d’abord l’inventaire des consommateurs de `role`, `fonction_interne`, `pharmacie_id`, des RPC et de RLS, puis proposer la migration minimale après autorisation.

Le nom d’utilisateur est un identifiant de recherche, **jamais une preuve d’identité ou une autorisation**. Toutes les décisions d’accès doivent être confirmées côté serveur et/ou par la base, avec périmètre explicite.

---



## 3 bis. Évolution métier — remplacements, cumul de postes et espaces Admin

### Besoin métier à intégrer

Une même personne peut devoir remplacer temporairement un collègue absent (ex. Gestionnaire de stock remplaçant une Caissière), ou être autorisée à exercer plusieurs fonctions (ex. Caisse + Stock, Pharmacien + Responsable). L'accès à une fonction supplémentaire ne doit jamais être obtenu en modifiant manuellement le rôle principal du profil ni en faisant confiance au seul affichage de l'interface.

Le modèle cible à étudier est celui d'**affectations professionnelles explicites et traçables**, distinctes de l'identité client durable et du rôle public historique :
- identité Auth et données de l'espace client conservées ;
- affectation rattachée à une personne, une pharmacie/un périmètre, une fonction, un état et une période ;
- demande de remplacement/cumul avec fonction source, fonction demandée, motif et période prévue ;
- approbation du Promoteur avant activation, avec identité de l'approbateur et horodatage ;
- historique append-only des demandes, approbations, activations, refus, révocations, expirations et opérations sensibles effectuées sous l'affectation ;
- révocation/expiration qui bloque côté serveur les nouveaux actes de la fonction sans retirer les droits client valides ;
- vérification du rôle/fonction effective, de l'état actif et du périmètre par chaque API, RPC et règle RLS pertinente. Le sélecteur d'espace est une aide UX, pas une barrière de sécurité.

### Règles de sécurité à concevoir

1. Le remplacement temporaire ne modifie pas l'historique et l'identité du poste permanent de la personne.
2. Les droits sont minimaux et limités à la fonction, à la pharmacie et à la période approuvées ; aucune permission implicite ne découle du fait d'être Promoteur, Responsable ou administrateur d'interface.
3. Une demande expirée, révoquée, refusée ou non approuvée ne donne aucun droit métier.
4. Les opérations effectuées pendant une affectation sont attribuées à l'identité réelle de l'employé et à l'affectation effective, avec date/heure et périmètre.
5. Les opérations financières, de stock, de clôture et d'accès aux données sensibles conservent leurs contrôles et leur séparation des tâches. Le cumul de postes ne doit pas permettre d'approuver sa propre demande ni de contourner les règles de double contrôle.
6. Toute évolution de schéma doit être additive, précédée d'un inventaire des lecteurs de `profiles.role`, `fonction_interne`, `pharmacie_id`, des gardes applicatives, RPC, EXECUTE et RLS. Ne pas créer de table ou de migration avant cette analyse et une autorisation explicite.

### Décisions encore ouvertes — ne pas inventer de décision validée

- **Cumul simultané — DÉCIDÉ le 23/10/2026 :** le Promoteur peut autoriser plusieurs fonctions actives simultanément pour une même personne, dans une même pharmacie. Chaque fonction reste une affectation explicite, distincte, approuvée, limitée au périmètre et à sa période ; aucun droit implicite ne découle du cumul. Le cumul inter-pharmacies doit être représenté par des affectations séparées pour chaque pharmacie. Cette décision métier ne prouve pas que le code la prend déjà en charge et n'autorise pas à modifier le schéma ou le code sans autorisation distincte.
- **Urgence :** à confirmer si le Promoteur peut créer directement une affectation d'urgence ou s'il doit toujours créer une demande approuvée par un autre responsable autorisé. Aucun auto-approuvage ne doit être supposé.
- **Durée et prolongation :** les dates de début/fin, renouvellement et révocation anticipée doivent être définis ; une affectation ne doit jamais rester active indéfiniment par défaut.

### Bascule Espace client ↔ Espace professionnel ↔ Espace administrateur

- L'identité client demeure distincte des autorisations professionnelles et administratives.
- Le bouton « Espace administrateur » ne s'affiche que si le compte authentifié possède une autorisation Admin valide ; toutefois, masquer le bouton ne suffit pas : chaque route/API/RPC sensible doit revérifier l'autorisation côté serveur/base.
- Si la personne est connectée dans son espace client et dispose aussi d'une autorisation Admin, privilégier une bascule d'espace sur la même identité Auth si l'architecture existante le permet, sans créer de second compte ni de session privilégiée implicite.
- Les actions d'administration sensibles doivent être journalisées (acteur, action, cible, horodatage, résultat et contexte minimal nécessaire). Toute élévation de privilège doit être explicite, vérifiable et révocable.
- Ne jamais accorder les droits Admin parce que le profil est client, Promoteur ou professionnel ; le statut Admin doit être établi par une source d'autorité dédiée et contrôlée côté serveur.

### Critères de recette à ajouter

| Scénario | Résultat attendu |
|---|---|
| Remplacement demandé mais non approuvé | Aucun droit supplémentaire |
| Remplacement approuvé, dans sa période et sa pharmacie | Seuls les droits explicitement autorisés sont actifs |
| Affectation expirée/révoquée avec ancienne session ouverte | Opérations métier refusées côté serveur/base |
| Employé tentant d'approuver sa propre demande | Refus, sauf règle explicite de séparation des tâches préalablement validée — par défaut refus |
| Cumul de postes | Plusieurs fonctions peuvent être actives simultanément dans une même pharmacie si chacune a été explicitement approuvée ; aucun droit implicite |
| Opération caisse/stock réalisée sous remplacement | Journal attribuant l'action à l'employé et à l'affectation effective |
| Client avec autorisation Admin explicite | Bascule vers l'espace Admin possible ; les API Admin restent protégées côté serveur/base |
| Client sans autorisation Admin tentant une URL/API Admin directe | Refus même si l'interface est manipulée |
| Révocation Admin avec session existante | Nouveaux actes Admin refusés côté serveur/base |

## 4. Registre des incohérences et travaux restants

Les constats ci-dessous proviennent de l’audit statique initial. Ils sont des hypothèses prioritaires à confirmer par lecture précise avant de modifier le code. Le statut « à vérifier » n’affirme pas à lui seul que la vulnérabilité existe en production.

### MC-01 — Activation des appareils : autorisation de rôle et périmètre

**Point inspecté :** `src/app/api/appareils/activate/route.ts`  
**Constat initial :** le parcours vérifie un profil actif et un `pharmacie_id`, mais l’audit initial n’a pas trouvé de contrôle explicite et complet du rôle public/fonction interne autorisée.  
**À faire :**
- établir les rôles autorisés par la règle métier ;
- vérifier identité authentifiée, état actif, affectation et pharmacie ciblée ;
- comparer l’API aux RPC/RLS sur les mêmes données ;
- corriger uniquement si le contrôle est effectivement insuffisant ;
- ajouter/compléter les tests de refus pour rôle non autorisé, pharmacie hors périmètre, profil inactif et requête non authentifiée.

### MC-02 — Route CRON des rapports : secret et exécution sans configuration

**Point inspecté :** `src/app/api/cron/rapports/route.ts`  
**Constat initial :** la vérification du secret semblait conditionnée à la présence de `CRON_SECRET`. Si confirmé, une variable absente pourrait laisser la route poursuivre sans authentification attendue.  
**À faire :**
- examiner le flux complet et le comportement en cas de secret absent, vide ou incorrect ;
- imposer un refus fermé lorsque la configuration obligatoire manque ;
- examiner les autorisations et le périmètre des données des rapports ;
- vérifier les appels planifiés et les tests de refus. Ne jamais afficher ni consigner la valeur du secret.

### MC-03 — Synchronisation hors ligne : RPC appelée et invariants de stock

**Points inspectés :** `src/app/api/sync/route.ts`, `supabase/migration_082_offline_foundation_draft.sql`, `supabase/migration_186_offline_operation_server_owned.sql`.  
**Constat initial :** la route semblait appeler `naxa_apply_offline_operation_v1`, alors qu’une fonction plus récente, `offline_stock_set_quantity`, introduit des contrôles plus stricts. L’état effectif de la base est inconnu.  
**À faire :**
- comparer signature, définition, privilèges EXECUTE, identité de l’appelant et contrôle de pharmacie pour chaque fonction ;
- déterminer quelle RPC est appelée par le code actuel et quelle définition est attendue par la chaîne de migrations ;
- vérifier le refus des quantités négatives, les opérations rejouées, les doublons, les conflits et l’autorité serveur sur le stock ;
- traiter les migrations « draft » comme telles : ne pas supposer qu’elles ont été appliquées ;
- proposer une correction compatible et additive si le décalage est confirmé.

### MC-04 — Identité client et affectation professionnelle

**Points inspectés :** `src/app/api/auth/login/route.ts`, `src/app/api/auth/complete-signup/route.ts`, `src/components/EspaceNaxaSwitcher.tsx`, `src/middleware.ts`, `src/app/client/page.tsx`, `src/app/pharmacie/actions.ts`.  
**Constat initial :** le modèle conserve un rôle public unique ; la finalisation d’inscription et la bascule d’espace peuvent avoir des comportements différents selon l’historique du profil et la fonction interne.  
**À faire :**
- établir une matrice explicite identité client × affectation professionnelle × état actif/inactif ;
- vérifier inscription, connexion, bascule client/professionnel, révocation, réactivation, profil historique et URL de retour ;
- vérifier que la révocation professionnelle bloque immédiatement les API/RPC métier tout en préservant l’accès client valide ;
- contrôler les comptes incomplets, les profils ambigus et les échecs de provisionnement/restauration ;
- cartographier tous les usages de `profiles.role`, `fonction_interne`, `actif`, `pharmacie_id` et `parent_profile_id` avant de décider d’un modèle d’affectations.

### MC-05 — Comptable : audit complet requis

**Document métier déjà disponible :** `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md`. Ce cahier est une spécification, pas une preuve d’implémentation.

**RPC déjà repérées :**
- `public.compta_ouvrir_periode(...)` ;
- `public.compta_enregistrer_controle_cloture(...)`.

**À faire :**
- cartographier chaque entrée de navigation du Comptable, page, formulaire, action, API, RPC, table et test ;
- vérifier le moindre privilège, la séparation des tâches, le périmètre d’une seule pharmacie, les exports et le journal d’audit ;
- confirmer qu’il ne peut pas encaisser, modifier une vente source, clôturer/réouvrir une caisse, approuver sa propre exception ou accéder à des données de santé nominatives ;
- comparer les gardes TypeScript/API aux contrôles SQL/RPC/RLS et aux droits EXECUTE ;
- identifier les écrans sans action métier, liens morts, boutons provisoires, données simulées et tests absents ;
- ne pas inventer de règle fiscale ou comptable camerounaise. Les points réglementaires non spécifiés doivent être signalés séparément.

### MC-06 — Cohérence complète API ↔ RPC ↔ RLS ↔ privilèges

**À faire :** produire un registre ciblé des fonctions sensibles, incluant au minimum :
- appelant API/serveur et mécanisme d’authentification ;
- rôle/fonction interne requis ;
- état actif requis ;
- périmètre pharmacie/ressource ;
- contrôles serveur avant appel ;
- définition exacte de la RPC et de ses éventuelles variantes public/private ;
- privilèges `EXECUTE` pour PUBLIC/anon/authenticated/service role ;
- tables touchées, politiques RLS et contrôle des opérations d’écriture ;
- test positif et test négatif associés ;
- preuve disponible et statut de validation.

Les noms similaires ne prouvent pas que les fonctions sont équivalentes. Comparer les corps SQL, signatures, droits et usages réels.

### MC-07 — Autres parcours d’authentification et cycle de vie du compte

**Points à couvrir :** inscription, OTP, Google/OAuth, finalisation du profil, vérification d’âge et consentements, récupération/réinitialisation du mot de passe, changement de mot de passe, reconnaissance du nom d’utilisateur, suppression de compte, déconnexion et sessions déjà ouvertes.

**À faire :**
- tracer les transitions d’état et les invariants d’identité ;
- vérifier qu’un profil professionnel ne contourne pas les contrôles d’identité client et qu’un profil client ne reçoit pas de droits professionnels ;
- vérifier le traitement des sessions déjà ouvertes après révocation ;
- confirmer les journaux, limitations de débit, messages d’erreur et compensations ;
- préserver les parcours historiques valides et vérifier les effets sur les autres rôles.

### MC-08 — Registre de tests et preuves

**À faire :**
- relier chaque risque confirmé à un test automatisé pertinent ;
- compléter les tests SQL/RLS pour les cas d’autorisation et de refus ;
- préparer une matrice de recette de bout en bout par type de compte ;
- exécuter tous les contrôles locaux/outils réellement accessibles ;
- noter précisément les contrôles non exécutés et la cause technique réelle ;
- ne pas confondre test présent, test exécuté et test réussi.

---

## 5. Matrice minimale de recette multicompte

Les scénarios suivants sont requis. Ils doivent être automatisés autant que l’environnement le permet.

| Scénario | Résultat attendu |
|---|---|
| Client valide sans affectation professionnelle | Espace client accessible ; aucun droit professionnel |
| Client attribué à un poste professionnel | Même identité Auth ; affectation professionnelle explicitement autorisée |
| Identifiant inconnu, ambigu ou profil incomplet | Refus sans mutation partielle |
| Affectation refusée par quota, réseau, pharmacie ou RPC métier | Refus sûr ; profil initial conservé/restauré et incident journalisé |
| Accès professionnel révoqué | API/RPC métier refusées, même si une ancienne session existe ; espace client valide préservé |
| Pharmacie inactive ou hors périmètre | Refus de l’accès aux ressources de cette pharmacie |
| Fonction interne non autorisée | Refus serveur et base, même si l’interface affiche un lien |
| Accès anonyme à une RPC privée | Refus EXECUTE et aucune fuite de données |
| Accès authentifié à une autre pharmacie | Refus par contrôle serveur/RPC/RLS |
| Profil client historique valide | Connexion et espace client conservés sans exiger artificiellement un rôle public `client` si le modèle retenu autorise cette coexistence |
| Déconnexion | Session invalidée et redirection cohérente ; aucun faux succès si signOut échoue |
| Suppression de compte | Confirmation d’identité requise, périmètre limité et comportement cohérent avec les obligations de conservation |
| Comptable | Lecture/exports autorisés uniquement dans son périmètre ; aucune mutation opérationnelle interdite |
| Synchronisation hors ligne | Rejeu idempotent, quantité négative refusée et stock sous autorité serveur |
| Activation appareil / route CRON | Refus fermé pour absence d’identité, rôle, périmètre ou secret requis |

Les tests positifs ne suffisent pas : chaque scénario de privilège doit inclure au moins un test négatif de dépassement de rôle ou de périmètre.

---

## 6. Définition opérationnelle de « mettre au vert »

« Mettre au vert » signifie **terminer toutes les tâches que les outils, accès et autorisations disponibles permettent réellement d’accomplir**, et non déclarer tout le chantier vert malgré les blocages.

### Vert — confirmé par une preuve

Un élément peut être marqué vert uniquement si :
- le comportement attendu est explicite ;
- la correction nécessaire est appliquée dans le périmètre autorisé ;
- le contrôle correspondant a réellement été exécuté ;
- le résultat est rattaché au commit/fichier/version concerné ;
- aucun contrôle essentiel connu n’est dissimulé ou remplacé par un contrôle moins strict.

Pour les travaux documentaires ou la cartographie, utiliser le statut **« documenté/inspecté »**, distinct du vert fonctionnel.

### Bloqué par une limite externe ou une interdiction

Un contrôle doit être marqué **BLOQUÉ**, avec preuve et cause, s’il ne peut pas être exécuté en raison notamment :
- d’une limite GitHub/API/CI réellement atteinte ;
- d’un accès ou d’un outil indisponible ;
- d’une base distante dont l’accès en écriture est interdit ;
- de l’interdiction de déployer ;
- de l’interdiction de créer des commits de code multiples ;
- d’un service ou secret requis qui n’est pas accessible.

Pour chaque blocage :
1. conserver les résultats statiques et les tests indépendants déjà accessibles ;
2. ne pas relancer en boucle le même outil sans changement de conditions ;
3. chercher une alternative non destructive, gratuite et réellement accessible ;
4. noter ce que l’alternative prouve et ce qu’elle ne prouve pas ;
5. garder le statut bloqué pour le contrôle indisponible. Un test local ne remplace pas une preuve de CI ; une migration présente ne prouve pas son application distante.

### Pas de faux vert

- Ne pas désactiver ESLint, TypeScript, les tests, RLS ou des contrôles de sécurité pour faire passer une validation.
- Ne pas réduire artificiellement le périmètre des tests.
- Ne pas annoncer une CI réussie sans statut/logs observables pour le SHA exact.
- Ne pas prétendre que l’état de la base ou de la Production est connu quand l’accès ne le permet pas.
- Ne pas créer de commit de code ni déployer pour contourner une interdiction.
- L’absence d’erreur visible dans le connecteur n’est pas une preuve de réussite.

---

## 7. Plan d’action séquencé

### Phase A — Terminer le diagnostic statique ciblé

1. Vérifier l’état courant de `main` et utiliser ce cahier comme registre.
2. Pour MC-01 à MC-08, relire les fichiers et les définitions SQL nécessaires, puis confirmer, invalider ou préciser chaque constat.
3. Compléter le registre API ↔ RPC ↔ RLS, y compris le Comptable.
4. Repérer les causes communes pour éviter des corrections redondantes.
5. Présenter le tableau des constats confirmés, des constats réfutés, des corrections proposées et des preuves manquantes.

**Sortie attendue :** diagnostic documenté ; aucun défaut supposé présenté comme certain.

### Phase B — Corrections ciblées, après autorisation explicite

1. Grouper les corrections par cause racine et dépendances.
2. Préserver le comportement existant hors du périmètre de correction.
3. Maintenir les vérifications serveur, SQL, RLS et les journaux.
4. Ajouter ou corriger les tests qui prouvent le cas nominal et les refus.
5. Respecter la restriction de commits : pas de commit de code tant qu’une autorisation spécifique ne lève pas cette restriction. Ne pas accumuler des modifications non autorisées sous couvert d’audit.

**Sortie attendue :** lot minimal de corrections et tests prêt, avec périmètre et risques explicités.

### Phase C — Vérifications accessibles

1. Exécuter toutes les vérifications locales disponibles sans toucher à Production.
2. Vérifier les statuts CI par les outils autorisés si disponibles, sur le SHA exact.
3. Si un outil est bloqué, relever le message réel et arrêter les répétitions inutiles.
4. Faire une revue contradictoire des droits, du périmètre et des régressions possibles.
5. Distinguer vert confirmé, inspecté sans exécution, bloqué et restant à faire.

**Sortie attendue :** bilan vérifiable, sans statut inventé.

### Phase D — Validation de l’étape 1

L’étape 1 ne peut être proposée comme terminée que lorsque :
- tous les constats sont confirmés, réfutés ou expliqués par une preuve ;
- tous les défauts corrigeables et autorisés sont traités ;
- les contrôles accessibles ont été exécutés ;
- les blocages non résolus sont listés avec leur cause et leur impact ;
- le parcours Comptable est inclus ;
- aucune régression connue n’est passée sous silence.

Si une correction est interdite par les contraintes actuelles, le point reste **non vert / bloqué**, même si tout le reste est vert. Présenter le bilan à l’utilisateur et attendre sa validation avant l’étape suivante.

---

## 8. Prompt maître — plan d’action de mise au vert

Copier ce prompt pour reprendre le chantier sans perdre le contexte :

> **Mission : NAXA — mise au vert du chantier multicompte**
>
> Agis comme ingénieur senior en architecture applicative, sécurité Supabase/Postgres, Next.js/TypeScript et audit métier. Le dépôt de référence est `audreymendomo23-netizen/NAXA`, branche `main`. Commence par lire `AGENTS.md` et `docs/CAHIER_DES_CHARGES_MULTICOMPTE.md`. Le commit de référence avant ce cahier est `06fe1a61a4e1329299bfc311bc77ce63d9deabe1` ; vérifie l’état courant de `main` avant d’agir.
>
> **Objectif :** mettre au vert chaque élément qui peut être réellement traité et vérifié avec les outils, accès et autorisations disponibles. « Vert » exige une preuve ; il ne signifie pas seulement « le code semble correct ».
>
> **Travaux acquis à ne pas refaire sans contradiction :** premier incrément d’identité client/professionnel, connexion avec choix d’espace, attribution Caisse à un compte client existant, conservation de `naxa_provision_caisse`/`naxa_can`, sélecteur d’espace, préservation de l’espace client pour profils professionnels/historiques. Réutilise `docs/AVANT_PROJET_IDENTITE_UNIQUE_ESPACES_NAXA.md` et les commits documentés dans le cahier. Ne réimplémente pas ces éléments sauf régression ou preuve contradictoire.
>
> **Registre obligatoire :** traiter MC-01 appareils, MC-02 route CRON rapports, MC-03 synchronisation hors ligne/RPC/stock, MC-04 identité/affectations, MC-05 Comptable, MC-06 API↔RPC↔RLS/privilèges, MC-07 cycle de vie d’authentification, MC-08 tests et preuves. Examiner les écrans, actions, API, RPC, SQL, privilèges EXECUTE, RLS, tests positifs et négatifs. Ne pas supposer qu’une migration a été appliquée parce que le fichier existe.
>
> **Méthode obligatoire :**  
> 1. Inspecter le code exact et les références pertinentes.  
> 2. Raisonner par contradiction : attente vs code vs autorisations effectives vs preuve.  
> 3. Confirmer ou réfuter chaque constat avant de le classer comme défaut.  
> 4. Chercher les causes communes et regrouper les corrections pour éviter les doublons.  
> 5. Préserver toutes les fonctionnalités et tous les contrôles de sécurité. Ne désactive aucune règle, aucun test ni aucune politique pour obtenir du vert.  
> 6. Exécuter toutes les vérifications accessibles et rattacher leurs résultats au SHA exact.  
> 7. Pour une limite d’outil/CI/quota, relever la cause observée, ne pas répéter inutilement la même tentative, utiliser seulement une alternative réellement disponible, et conserver le contrôle bloqué comme non vert.  
> 8. Maintenir un registre cumulatif : confirmé, réfuté, corrigé, testé/réussi, inspecté seulement, bloqué, reste à faire.
> 9. Traiter les remplacements/cumuls de postes et la bascule Admin selon la section 3 bis. Le cumul simultané reste à décider : poser cette seule question métier avant de figer les règles ; ne pas l'inférer. Ne jamais muter `profiles.role` comme substitut à une affectation temporaire.
>
> **Contraintes absolues actuelles :** aucun déploiement ; aucune écriture/migration Supabase Production ; aucune branche ni PR ; aucun commit de code ou série de commits. Le seul commit autorisé dans ce périmètre est celui qui crée/met à jour le document demandé, sauf autorisation ultérieure explicite. N’effectue pas d’action qui pourrait déclencher un déploiement. Ne contourne aucun refus d’accès ou de sécurité.
>
> **Règle d’étape :** l’étape 1 reste ouverte tant que chaque constat n’est pas confirmé/réfuté, que les éléments corrigeables autorisés ne sont pas traités, que les vérifications accessibles ne sont pas faites et que le Comptable n’est pas inclus. Présente le bilan contradictoire avant de demander la validation de l’étape suivante. Ne prétends jamais que tout est vert si une vérification essentielle reste bloquée.
>
> **Format de chaque compte rendu :**  
> - Fait : modifications réellement effectuées (ou aucune).  
> - Preuve : chemins, RPC, tests, commit SHA et statuts réellement observés.  
> - Vert confirmé : uniquement les contrôles exécutés avec succès.  
> - Bloqué : contrôle, cause observée, impact et alternative tentée si pertinente.  
> - Reste : seulement les éléments non résolus.  
> - Suite : prochaine action concrète autorisée.
>
> Ne demande pas à l’utilisateur de refaire l’audit ou les vérifications que tu peux effectuer avec les outils disponibles. Ne passe pas à une nouvelle phase avant d’avoir présenté le bilan de la phase en cours et obtenu la validation demandée.

---

## 9. Journal de suivi

| Date | Événement | Résultat |
|---|---|---|
| 22/10/2026 | Avant-projet identité unique et espaces client/pharmacie | Premier incrément consigné ; recette de bout en bout non prouvée dans ce document |
| 23/10/2026 | Audit statique ciblé et consolidation du chantier | MC-01 à MC-08 inscrits ; état réel Supabase/CI à vérifier séparément |
| 23/10/2026 | Création du présent cahier des charges | Document de référence ; ne prouve ni correction applicative ni CI verte |
| 23/10/2026 | Ajout du besoin de remplacement/cumul de postes et bascule Admin | Spécification métier ajoutée ; simultanéité désormais décidée : cumul autorisé par personne et par pharmacie ; urgence/durée/prolongation/révocation anticipée encore à confirmer ; aucune modification applicative |

**État global à l’ouverture du registre :** chantier multicompte partiellement construit, audit statique initial réalisé, validations automatisées/de base non confirmées. L’étape 1 reste **OUVERTE**. Aucun déploiement n’est autorisé.


### Décision métier complémentaire — 23/10/2026

Le Promoteur peut autoriser plusieurs postes simultanément pour une même personne et une même pharmacie. Les autorisations restent séparées par fonction, pharmacie et période ; les contrôles d'approbation, de périmètre, de séparation des tâches et d'audit demeurent obligatoires. Cette décision ne constitue pas une preuve d'implémentation.

---

## 10. Exécution de l'étape 1 — bilan contradictoire du 23/10/2026

**Périmètre exécuté :** lecture du dépôt `main`, inspection ciblée des API/RPC/migrations, requêtes SQL strictement en lecture sur la base NAXA active, et exécution de tests SQL transactionnels sur la base isolée `naxa-ci-replay-2`. Aucun code applicatif, test ou schéma n'a été modifié. Aucune migration distante ni aucun déploiement n'a été lancé.

### 10.1 Constats confirmés

| ID | Constat vérifié | Preuve et conséquence | Statut |
|---|---|---|---|
| MC-01 | L'API d'activation d'appareil ne sélectionne ni ne vérifie le rôle ou la fonction interne. Elle vérifie la session, l'activité du profil et l'égalité entre pharmacie du profil et cookie. | `src/app/api/appareils/activate/route.ts`, lignes 7–12. En outre, la table `public.appareils` est absente de la base active alors que l'API l'utilise via `PHARMACIE_SCHEMA.devicesTable`. L'activation n'est donc pas démontrée fonctionnelle sur la base active et le garde métier est insuffisant dans le code inspecté. | **DÉFAUT STATIQUE CONFIRMÉ** ; pas de test HTTP |
| MC-02 | La route CRON n'exige le secret que si `CRON_SECRET` existe. | `src/app/api/cron/rapports/route.ts`, ligne 3 : si la variable est absente, le contrôle d'autorisation est sauté. La valeur et la présence de la variable ne sont pas consultables via l'audit effectué. | **DÉFAUT DE REFUS FERMÉ CONFIRMÉ** ; configuration runtime inconnue |
| MC-03 | La route de synchronisation appelle une RPC absente de la base active. | `src/app/api/sync/route.ts`, lignes 27–30, appelle `naxa_apply_offline_operation_v1`. L'inspection SQL de `public` trouve `offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)`, mais pas `naxa_apply_offline_operation_v1`. La table `appareils` est également absente. La migration 082 est un brouillon non enregistré dans l'historique actif ; la migration 186 est enregistrée, mais elle ne fournit pas la RPC appelée par la route. | **INCOMPATIBILITÉ DÉPÔT/BASE ACTIVE CONFIRMÉE** |
| MC-04 | Le modèle de données actif ne représente pas les affectations multi-fonctions temporaires exigées. | `profiles` possède un rôle principal et une fonction interne. `profile_accreditations` conserve un grantor, une cible, une pharmacie, un niveau et une date de création, mais pas une fonction affectée, une période, un état d'approbation, une expiration ni une révocation. Aucun tableau d'affectations correspondant n'a été trouvé dans le schéma public actif. Le sélecteur d'espace dépend également du rôle principal (`src/components/EspaceNaxaSwitcher.tsx`). | **ÉCART D'ARCHITECTURE CONFIRMÉ** |
| MC-05 | Les pages/API Comptable sont présentes dans le dépôt, mais le socle SQL comptable n'est pas installé sur la base NAXA active examinée. | Les API appellent `compta_ouvrir_periode`, `compta_enregistrer_controle_cloture`, `compta_auditer` et lisent `compta_ecriture`/tables connexes. La lecture de l'historique des migrations et du catalogue SQL actif ne trouve ni les migrations comptables ni les tables/RPC comptables attendues. La base de test, elle, contient le socle comptable. | **DÉPÔT/PRODUCTION DÉSALIGNÉS** ; parcours actif non validé |
| MC-06 | Un garde d'autorisation commun existe, mais la couverture API/RPC/RLS n'est pas exhaustive. | Sur la base active, `naxa_can` exige un utilisateur authentifié, un périmètre pharmacie et un privilège actif ; `naxa_scope_allows` contrôle le périmètre. Les politiques de `offline_operations` ne donnent qu'une lecture personnelle directe. Cela ne valide pas tous les points d'entrée et ne compense pas les écarts MC-01/MC-03. | **PARTIELLEMENT INSPECTÉ** |
| MC-07 | Le flux d'authentification conserve encore des branches fondées sur le rôle principal. | `src/app/api/auth/login/route.ts`, `src/app/api/auth/complete-signup/route.ts`, `src/middleware.ts` et `EspaceNaxaSwitcher.tsx` ont été inspectés statiquement. Le flux de bout en bout, la révocation en session ouverte et la bascule Admin n'ont pas été exercés avec des comptes de test. | **INSPECTION STATIQUE PARTIELLE** |
| MC-08 | Des tests SQL ont été exécutés sur la base isolée ; un test historique hors ligne échoue. | `160_compta_socle.sql`, `170_compta_recette_etape9_security.sql` et `171_compta_recette_etape10_hardening.sql` ont retourné leurs marqueurs PASS lors d'exécutions séquentielles. `053_offline_idempotence.sql` échoue sur « RLS insertion scope absente » : il attend encore les politiques directes `offline_operations_insert_scope` et `offline_operations_update_own`, que la migration 186 retire au profit d'une RPC contrôlée. Le test est donc incompatible avec le modèle de sécurité actuel et doit être réconcilié, pas contourné. | **3 PASS sur la base isolée ; 1 FAIL confirmé** |

### 10.2 État des bases et limites de preuve

- **Base NAXA active** : requêtes catalogue et historique de migrations en lecture seule uniquement. Les migrations comptables et la table `appareils` ne sont pas présentes dans les résultats consultés. Aucun compte utilisateur ni aucune donnée nominative n'a été interrogé.
- **Base isolée `naxa-ci-replay-2`** : les tables `appareils`, `offline_operations`, `naxa_offline_operations` et les tables du socle comptable existent. Les tests ci-dessus ont été lancés contre cette base ; cela ne prouve pas que le schéma actif est identique.
- **CI** : le statut GitHub consulté sur le SHA `a75fb6972061c539739244ee46a7a20d4e64dd19` indique `ci/circleci: quality = failure`. Aucun pipeline n'a été lancé. La cause détaillée de cet échec n'a pas été investiguée dans cette étape.
- **Lint, typecheck, build, tests navigateur/E2E** : non exécutés ; aucun checkout local reproductible n'a été utilisé.
- **Secrets d'environnement** : aucune valeur de secret n'a été lue ni consignée.

### 10.3 Actions correctives identifiées — non appliquées

1. Ajouter un contrôle serveur explicite de rôle/fonction autorisée et de périmètre pour l'activation d'appareil ; rétablir ensuite une migration compatible pour la table attendue, après comparaison du schéma cible.
2. Faire échouer la route CRON en mode fermé si `CRON_SECRET` est absent, vide ou incorrect, puis tester les trois cas sans divulguer le secret.
3. Réconcilier `src/app/api/sync/route.ts`, la RPC canonique `offline_stock_set_quantity`, les tables actives et le modèle de jeton d'appareil. Ne pas simplement remplacer le nom de RPC sans adapter l'identité et le contrat d'opération.
4. Concevoir le modèle minimal additif d'affectations explicites (fonction, pharmacie, période, état, demandeur, approbateur, activation, expiration, révocation et journal) après inventaire complet des consommateurs. La décision de cumul simultané est validée ; urgence, durée maximale et prolongation restent ouvertes.
5. Réconcilier l'historique de migrations comptables entre dépôt, base isolée et base active avant toute application. Aucune migration n'est autorisée dans la base active par ce compte rendu.
6. Aligner le test 053 sur la stratégie RPC de la migration 186 et ajouter des tests négatifs qui prouvent l'impossibilité d'écrire directement dans `offline_operations`.
7. Compléter l'audit MC-06 à MC-08 et obtenir une exécution vérifiable du lint/typecheck/build et des scénarios E2E dans un environnement autorisé.

### 10.4 Verdict de l'étape 1

**ÉTAPE 1 : NON TERMINÉE — défauts confirmés et validations manquantes.** Les points MC-01, MC-02 et MC-03 présentent des écarts concrets ; MC-04 confirme que le modèle multicompte n'est pas implémenté dans le schéma actif ; MC-05 n'est pas déployé dans la base active examinée. Les contrôles positifs de la base isolée ne rendent pas la base active conforme.

Aucune correction applicative n'a été effectuée car le cahier interdit les commits de code et les migrations Production sans autorisation distincte. Le prochain jalon doit être une autorisation explicite de corriger le code et les tests sur `main`, sans déploiement, après validation de ce bilan.


---

## 11. Corrections après autorisation — 23/10/2026

**Autorisation reçue :** corrections applicatives et tests sur `main`, sans déploiement et sans écriture/migration sur Supabase Production. La liaison Git de Vercel consultée pendant cette session ne retourne aucun projet lié ; aucun déploiement n'a été déclenché. Les commits ci-dessous utilisent `[skip ci]` et aucun pipeline n'a été lancé volontairement.

### 11.1 Modifications appliquées

| Élément | Correction | Commit | Niveau de preuve |
|---|---|---|---|
| MC-02 — CRON rapports | Le secret devient obligatoire : absent, vide ou différent, la route retourne 401. Le contrôle ne saute plus l'authentification si `CRON_SECRET` n'est pas configuré. | `893a2fceb81e0c7a48b242ccdc635e6815a083cd` | Code relu sur `main` ; test HTTP non exécuté |
| MC-01 — activation appareil | La route exige maintenant un profil strictement actif, une pharmacie identique au cookie et une fonction professionnelle autorisée par le rôle `caisse` ou par un rôle `pharmacie` avec `fonction_interne` non vide. | `4fbb0240a6c8e9ec1c1f56f99386b81fb436af54` | Code relu sur `main` ; test HTTP non exécuté |
| MC-03 — erreur de synchronisation | La réponse publique ne révèle plus le message SQL brut de l'échec RPC ; le détail technique reste dans les logs serveur. | `fe33b5576acb72b05118c8b8845bace06bb2d5b2` | Code relu sur `main` |
| MC-08 — test offline | Le test 053 ne réclame plus les anciennes politiques INSERT/UPDATE directes ; il vérifie qu'elles restent absentes et que l'INSERT direct est interdit, conformément au modèle de mutations contrôlées par RPC. Le doublon du marqueur PASS a été retiré. | `bea188f2abf0a91cadd68bc4a41d80b06ec7231a` | Test SQL exécuté séquentiellement sur la base isolée : **PASS** |

### 11.2 Résultat de la vérification

- **Vert confirmé :** le contrôle statique de refus fermé MC-02 est présent ; le garde professionnel MC-01 est présent ; les erreurs SQL brutes ne sont plus renvoyées au client ; le test 053 retourne `053_offline_idempotence PASS` sur la base isolée.
- **Non vert — MC-01 :** la table `public.appareils` reste absente de la base NAXA active consultée. Le garde de code est renforcé, mais le parcours ne peut pas être déclaré fonctionnel en Production.
- **Non vert — MC-03 :** `src/app/api/sync/route.ts` appelle toujours `naxa_apply_offline_operation_v1`, absente de la base active consultée. La RPC existante `offline_stock_set_quantity` a un contrat différent (authentification utilisateur, mise à jour d'une quantité avec horodatage de base) ; la substituer directement à la RPC appareil serait incorrect et pourrait casser l'idempotence, le contrôle de périmètre et le modèle de synchronisation. La table `appareils` et les objets offline attendus sont également absents de la base active. Aucun changement de nom de RPC n'a donc été effectué sans migration de compatibilité vérifiée.
- **Non vert — validations d'exécution :** lint, typecheck, build, HTTP/E2E et CI n'ont pas été lancés conformément au périmètre actuel. Aucun secret d'environnement n'a été lu.
- **Supabase Production :** lecture seule maintenue ; aucune écriture ni migration exécutée.

### 11.3 Prochaine correction sûre

Créer et revoir une migration additive de réconciliation pour les objets appareils/synchronisation et la RPC serveur, en comparant la définition exacte de la base de test à l'historique du dépôt. Ajouter des tests positifs/négatifs pour activation, jeton d'appareil, idempotence, conflit de stock et refus des opérations non autorisées. La migration restera un fichier versionné non appliqué à Production tant qu'aucune autorisation distincte de migration ne sera donnée.

**Verdict après ce lot :** progrès vérifiés, mais l'étape 1 reste **OUVERTE**. MC-02 et le défaut du test 053 sont corrigés au niveau du code/test ; MC-01 est partiellement corrigé ; MC-03 reste bloqué par la divergence dépôt/base active.
