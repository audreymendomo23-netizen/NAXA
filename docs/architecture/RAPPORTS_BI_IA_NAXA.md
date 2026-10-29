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
