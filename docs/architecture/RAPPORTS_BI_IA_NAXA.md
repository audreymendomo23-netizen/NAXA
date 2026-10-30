# Architecture des rapports BI et de J'IA NAXA

## Objectif et contrat d'accès

Les rapports NAXA disposent de deux modes distincts reposant sur les mêmes calculs :
- génération automatique périodique (planifiée côté serveur) ;
- génération à la demande depuis le tableau de bord du poste connecté.

La génération à la demande relit les données à chaque requête, sans attendre la prochaine échéance. Les formats téléchargeables sont PDF et CSV. Aucun rapport à la demande n'est enregistré dans la table historique par défaut : il est calculé et remis à l'utilisateur. L'historique existant reste distinct.

Périmètres :
- Admin : réseau NAXA, avec la RPC de pilotage autorisée à l'Admin actif ;
- Promoteur : réseau lié à son compte, sous réserve du privilège `VIEW_NETWORK_PILOTAGE` contrôlé par la RPC ;
- Responsable : pharmacie de son profil, sous réserve du privilège `VIEW_RESPONSABLE_PILOTAGE` ;
- Caisse : ses seules opérations, via `stats_caisse_scope`.

La route serveur s'appuie sur la session Supabase de l'utilisateur et les RPC qui appliquent les contrôles de rôle et de périmètre. Ne jamais remplacer ces RPC par une requête service-role non filtrée.

## Périodes proposées à la demande

Le sélecteur propose quotidien (1 jour), hebdomadaire (7), mensuel (30), trimestriel (90), semestriel (180) et annuel (365). À ce stade, ce sont des fenêtres glissantes en jours, et non des périodes calendaires exactes. Les libellés doivent rester cohérents avec cette limite tant que le moteur BI ne prend pas en charge des bornes `date_debut/date_fin`.

## Architecture

1. Supabase demeure la source de vérité.
2. Les RPC métier calculent les agrégats et appliquent le périmètre de l'utilisateur.
3. La route `POST /api/rapports` orchestre le calcul à la demande et propose JSON, CSV et PDF.
4. L'adaptateur IA interroge Vercel AI Gateway côté serveur uniquement. Il ne reçoit que les agrégats de la session et ne décide jamais des droits ni des chiffres.
5. L'absence de clé IA ou l'indisponibilité du fournisseur ne bloque pas le calcul ni les exports.
6. Le composant `RapportsALaDemande` est partagé entre les dashboards Admin et Pharmacie/Promoteur/Responsable/Caisse.

## Contrat IA

L'IA doit :
- commenter uniquement les données fournies ;
- distinguer faits, signaux, corrélations et hypothèses ;
- ne jamais fabriquer de comparaison, d'événement ou de causalité ;
- ne jamais modifier un chiffre, une donnée source ou une décision métier ;
- être considérée comme indisponible sans `AI_GATEWAY_API_KEY`.

Variables facultatives :
- `AI_GATEWAY_API_KEY` : secret serveur Vercel AI Gateway ;
- `AI_GATEWAY_MODEL` : identifiant du modèle autorisé, valeur par défaut actuelle `openai/gpt-4.1-mini`.

Aucun secret n'est ajouté par ce changement. Ne jamais utiliser une variable `NEXT_PUBLIC_*` pour une clé IA.

## Limites constatées à la première livraison

- La RPC `stats_pilotage_scope(p_jours)` accepte une fenêtre glissante bornée à 365 jours et ne fournit pas de bornes arbitraires. La comparaison N vs N-1, les périodes calendaires et la décomposition historique des variations restent à construire dans une migration SQL additive puis à valider avant application.
- Le rapport contient uniquement les indicateurs renvoyés par les RPC existantes. Il ne doit pas inventer des KPI absents (marge historique, coût d'achat historique, attribution causale).
- Le PDF initial de cette livraison est un PDF texte multipage téléchargeable. La mise en page graphique BI (cartes KPI, graphiques et tableaux comparatifs) reste une amélioration à réaliser.
- Le planificateur automatique existant n'est pas encore aligné sur les six périodicités et la passerelle Google Apps Script. Cette livraison n'envoie aucun courriel et ne modifie aucune configuration d'envoi.
- Les rapports promoteur générés à la demande ne sont pas persistés dans l'historique partagé existant, dont le schéma historique ne couvre pas proprement ce scope.
- Le rôle Caisse peut générer un rapport uniquement si la RPC `stats_caisse_scope` est disponible et l'autorise.

## Sécurité et exploitation

- Toujours appeler `auth.getUser()` et lire le profil actif côté serveur.
- Toujours utiliser les RPC scoping métier pour le calcul.
- Ne pas transmettre d'identifiants patients, données nominatives ou données médicales à l'IA.
- Ajouter des tests d'accès croisés Admin/Promoteur/Responsable/Caisse avant toute certification.
- Aucune migration ni écriture Supabase Production n'est exécutée par la livraison applicative.


## Intégration UI par poste — 30/10/2026
Le composant `RapportsALaDemande` est monté directement sur les dashboards Admin (accueil et pilotage), Promoteur, Responsable, Caisse, Comptable, Gestionnaire de stock et Pharmacien. Chaque intégration conserve le layout et les couleurs de l'espace existant; le composant applique une variante de surface et d'accent adaptée.

L'API serveur expose des indicateurs propres aux postes internes :
- Pharmacien : volumes de consultations, prescriptions, prescriptions en attente, préparations et événements d'audit. Aucune identité ni donnée clinique patient n'est incluse.
- Comptable : ventes payées, chiffre d'affaires, dépenses, mouvements de trésorerie, dossiers assurance et contrôles à traiter; accès conditionné au privilège `MANAGE_ACCOUNTING` sur la pharmacie du profil.
- Gestionnaire de stock / Magasinier : références en stock, stocks bas, lots à contrôler, réservations à traiter et inventaires ouverts; périmètre issu de `my_pharmacies` et des affectations actives du compte.
- Admin / Promoteur / Responsable / Caisse : RPC de pilotage déjà en place, avec contrôles d'accès existants.

**État de validation :** revue statique des fichiers et branchements UI/API effectuée. Les tests d'exécution avec comptes de recette pour chacun des postes, le build TypeScript et la recette visuelle navigateur restent à réaliser. Ne pas déclarer la fonctionnalité certifiée en production sur la seule base de cette intégration source.


## Corrections de cohérence et de recette statique — 30/10/2026
La revue du code a corrigé deux séquences de retour à la ligne échappées qui s'étaient glissées dans les fichiers TSX Admin Pilotage et Gestionnaire Stock. Le composant est aussi monté sur la branche Promoteur/Responsable de `/pharmacie/pilotage` (en plus du cas Caisse) et ses couleurs d'accent/bouton suivent la variante du dashboard.

Le dernier statut CircleCI disponible reste `ci/circleci: quality = failure` (build 8291). Les logs ne sont pas accessibles avec la connexion actuelle; aucun diagnostic de cause ne doit être inventé. Tant que le build, les appels API authentifiés par rôle et les téléchargements PDF/CSV ne sont pas validés, le chantier demeure non certifié.

## Fiabilité des agrégats par poste — correction du 30/10/2026

- **Comptable :** les lectures de ventes, dépenses, mouvements de trésorerie, dossiers assurance et contrôles sont paginées par plages ordonnées de 1 000 lignes jusqu'à épuisement des résultats. Les totaux et volumes ne sont donc plus calculés sur une seule page plafonnée à 5 000 lignes. Toute erreur de page interrompt le rapport complet.
- **Pharmacien :** le nombre de prescriptions et le nombre de prescriptions en attente utilisent chacun un comptage exact Supabase (`count: exact`, sans charger les lignes). Les autres volumes restent des comptages serveur exacts.
- **Gestionnaire de stock :** les références, stocks bas, lots à contrôler, réservations en attente et inventaires ouverts sont explicitement libellés comme **états actuels**. La période choisie ne prétend plus mesurer leur évolution historique. L'aperçu, le CSV et le PDF portent cette réserve temporelle.
- **Limite :** les indicateurs stock historiques (mouvements, variations de quantité, entrées/sorties par période) ne sont pas ajoutés faute de contrat de journal de mouvements confirmé dans cette passe. Ils nécessitent une définition métier et un schéma vérifiés avant implémentation.
- **Validation :** correction vérifiée statiquement sur `main`; aucun test runtime avec comptes Comptable/Pharmacien/Stock ni build Next/TypeScript n'a été exécuté. Aucune écriture Supabase Production, aucun secret ni déploiement.


## Evolution du PDF BI — 30/10/2026

Le PDF à la demande a été enrichi sans changer le contrat de génération des données ni les périmètres d'accès :
- page de synthèse avec période, périmètre et cartes KPI;
- indicateurs regroupés en tableaux thématiques (finance/ventes, activité métier, stock/approvisionnement, pilotage/performance, réseau/périmètre);
- note temporelle Stock conservée et mise en évidence;
- analyse J'IA, statut de disponibilité, limites de comparaison et pied de page paginé;
- pagination automatique des tableaux et du contenu long.

Un graphique d'évolution n'est rendu que si `stats.serie` contient au moins deux points avec un libellé et une valeur numérique exploitables. En l'absence d'une série valide, aucun graphique artificiel n'est dessiné. Les indicateurs isolés ne sont pas comparés visuellement entre eux, car leurs unités et significations peuvent différer. Les annexes exhaustives ne sont pas ajoutées par défaut : le rapport reste synthétique et n'expose pas de lignes transactionnelles nominatives.

**Validation :** amélioration du générateur PDF contrôlée statiquement. Le PDF binaire doit encore être téléchargé et ouvert en navigateur avec des comptes de recette pour chaque rôle; le build TypeScript/Next et les appels API authentifiés restent à tester. Certification opérationnelle toujours ouverte. Aucun déploiement, aucune écriture Supabase Production et aucun secret modifié.


## Extension — permutations, présence et gardes du personnel (30/10/2026)

### Constat du modèle existant

La table `public.naxa_professional_assignments` (migration `supabase/migration_225_professional_assignments.sql`) constitue la source existante des affectations professionnelles temporaires/multiples. Elle conserve le membre (`profile_id`), la pharmacie, la fonction, le motif, les bornes `commence_at/expire_at`, l'auteur (`accorde_par/accorde_at`) et la révocation (`revoque_par/revoque_at/motif_revocation`). Les statuts actuellement admis sont `active` et `revoked`; l'état temporel effectif doit aussi vérifier `commence_at <= instant < expire_at`.

La politique RLS de lecture limite les lignes au membre affecté, à l'auteur de l'affectation, à l'auteur de la révocation ou à l'Admin. La fonction de création exige notamment le privilège `ASSIGN_USER_TO_PHARMACY`, une pharmacie active du réseau du Promoteur, une cible active et une période valide. Les rapports doivent réutiliser ces règles et ne pas élargir les accès par une lecture service-role non filtrée.

### Intégration BI attendue

- **Rapport individuel staff :** affectations/permutations sur la période, pharmacie, fonction temporaire, motif, dates, auteur, statut temporel et révocation; distinguer affectation active à la date de génération et événement historique intervenu pendant la période.
- **Rapport Promoteur :** agrégats par pharmacie et par staff des affectations accordées dans son périmètre, fonctions couvertes, périodes, remplacements et révocations. Une ligne d'affectation ne vaut pas preuve de présence.
- Les fonctions multiples simultanées autorisées restent distinctes : ne pas écraser la fonction permanente ni fusionner des affectations différentes. Les chevauchements et la couverture de poste doivent être présentés comme signaux de planning, pas comme présence constatée.
- Conserver le même moteur, les mêmes formats JSON/PDF/CSV et les mêmes contrôles serveur; aucun export nominatif hors périmètre autorisé. La visibilité des noms doit être vérifiée avec les règles RLS de `profiles` avant intégration.

### Limite de données vérifiée

Correction après audit des tableaux de bord : des pointages individuels horodatés existent déjà pour le Pharmacien (`pharmacien_service_sessions`, migration 188), le Gestionnaire de stock (`stock_service_sessions`, migration 212) et la Caisse (`caisses_sessions`, migration 044). Les sessions Pharmacien et Stock enregistrent début et fin de service; la session Caisse enregistre l'ouverture et la clôture du tiroir et ne vaut pas preuve de présence générale. En revanche, `pharmacies.garde_debut/garde_fin` (migration 070) décrivent une période de garde publiée pour la pharmacie, pas une garde individuelle effectivement réalisée.

Avant d'afficher arrivée, départ, durée travaillée, retard, absence ou garde effectuée, il faut identifier ou concevoir une source métier explicite de planning et de pointage : acteur, pharmacie, horodatages, fuseau `Africa/Douala`, méthode de pointage, corrections auditées, statut de validation et règles de pause/chevauchement. Les horaires planifiés, les pointages bruts et les heures validées doivent rester trois notions distinctes.

**État corrigé :** les pointages existants sont désormais raccordés aux rapports BI et aux exports. Les heures sont calculées depuis les horodatages serveur `started_at/ended_at` (Pharmacien), `opened_at/closed_at` (Stock) et `ouvert_at/cloture_at` (Caisse). Une session encore ouverte est calculée jusqu'à la génération et marquée provisoire. Aucun horaire planifié, retard, absence ou garde individuelle n'est déduit. Aucun changement Supabase Production, aucune migration appliquée, aucun secret modifié, aucun déploiement.


## Clôture technique bornée — affectations, présences et recette (30/10/2026)

- L'API `POST /api/rapports` lit les affectations du membre connecté sous RLS et, pour un Promoteur, celles dont il est l'auteur. Les détails nominaux Promoteur sont résolus côté serveur uniquement à partir de ces lignes autorisées; aucun accès client élargi aux profils n'est accordé.
- Le tableau Promoteur affiche les affectations qu'il a accordées dans ses pharmacies actives : membre, pharmacie, fonction, période, statut et révocation. Les exports PDF/CSV reprennent les détails nominaux accessibles.
- Les rapports personnels exploitent les sessions horodatées Pharmacien (`pharmacien_service_sessions`) et Stock (`stock_service_sessions`); le poste Caisse exploite ses sessions de tiroir (`caisses_sessions`). Le rapport Promoteur agrège ces trois sources sur ses pharmacies actives, avec identité, heure de début, heure de fin et durée.
- Une session ouverte est calculée jusqu'à l'heure de génération et reste provisoire. Les affectations ne prouvent pas une présence. Les sessions de caisse ne prouvent pas une présence générale; aucun pointage Responsable/Comptable, retard, absence ou horaire théorique n'est calculé. Les périodes de garde publiées restent distinctes d'une garde individuelle effectuée.
- Certification : tests authentifiés par rôle, vérification des refus d'accès croisés, téléchargement/ouverture PDF et CSV et build Next/TypeScript non exécutés dans cette passe. Ils restent ouverts; aucune certification opérationnelle n'est déclarée.
- Travail sur `main` uniquement. Aucun déploiement, aucune écriture Supabase Production, aucune migration appliquée, aucun secret modifié.
