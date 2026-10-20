# Audit du parcours Caisse — onglets par entrée principale

Date de l'audit : 20 octobre 2026  
Branche ciblée : `main`  
Périmètre : `src/app/pharmacie/caisse/page.tsx`, `src/app/pharmacie/caisse/[section]/page.tsx`, `src/components/pharmacie/CaisseSidebar.tsx`, `src/components/pharmacie/CaisseSectionTabs.tsx`.

## Règle de navigation

Les sept entrées principales restent celles du § 5.2 du cahier : Tableau de bord, Clients et Assurances, Historique des ventes, Prise / fin de service, Rapports & Performances, Profil et Déconnexion. Les sous-onglets sont secondaires et ne deviennent pas de nouvelles entrées principales.

## Matrice d'audit

| Entrée principale | Onglets / vues trouvés dans le code | État après les changements | Écarts restants |
|---|---|---|---|
| Tableau de bord | Caisse, recherche de produit, historique récent, retrait Marketplace, décaissements et alertes de lots | Les vues et composants existants sont conservés ; l'entrée du menu ouvre le poste de caisse | Vérifier par test de bout en bout les ouvertures/clôtures, le scan, les retraits et décaissements ; aucun test d'exécution n'a été lancé dans cette intervention |
| Clients et Assurances | Répertoire clients, crédits à recouvrer, couvertures d'assurance, dossiers de tiers payant | Vues existantes conservées ; onglets contextuels ajoutés vers clients/crédits, assurances/tiers payant, demandes d'annulation et notifications | Les écritures restent limitées aux actions déjà autorisées par les RPC/RLS ; aucun contrôle externe d'assureur n'est présent |
| Historique des ventes | Recherche, filtre de statut, détail/duplicata imprimable, demande d'annulation | Onglets de navigation vers historique, annulations et synthèse ajoutés ; les actions de ticket et de demande restent dans la page historique | Le rejet/approbation d'une annulation n'est pas une action caisse, et doit rester réservé au rôle habilité |
| Prise / fin de service | Historique des sessions du compte ; le poste principal porte les opérations d'ouverture et de clôture | Onglets ajoutés vers les sessions, le poste de caisse et les rapports | L'ouverture et la clôture sont liées à l'écran principal plutôt qu'à deux écrans autonomes ; recette de journée complète à exécuter |
| Rapports & Performances | Nombre de ventes chargées/payées, montant payé calculé, sessions récentes | Onglets ajoutés vers la synthèse, les ventes détaillées et les sessions | Ce n'est pas encore le rapport complet de fin de journée/export PDF-Excel ni le moteur BI complet du cahier ; aucune donnée simulée n'est affichée comme réelle |
| Profil | Informations du compte, changement du mot de passe via Supabase Auth, vérification du PIN, préférences d'affichage locales, activité de service | Quatre onglets codés : Mon compte, Mot de passe & PIN, Affichage, Activité récente | L'historique de connexions Auth n'est pas exposé par les tables/API vérifiées. L'onglet affiche les sessions de caisse réelles et indique explicitement cette limite ; il ne fabrique pas de journal de connexion |
| Déconnexion | Action de déconnexion Supabase et redirection vers `/connexion` | Bouton présent dans la barre latérale | Le blocage détecte l'absence de réseau, mais ne vérifie pas encore l'existence d'une file de synchronisation hors-ligne non vide. Ne pas considérer cette règle comme complète |

## Contradictions et risques détectés

1. **Une entrée principale n'est pas la même chose qu'un onglet secondaire.** Les liens secondaires ont été ajoutés sans gonfler les sept entrées principales.
2. **Une session de caisse n'est pas un événement de connexion.** L'interface du profil ne présente pas les sessions de service comme un historique Auth.
3. **Hors-ligne : réseau absent et file en attente sont deux états différents.** Le bouton Déconnexion ne couvre actuellement que le premier. Il faut identifier la file IndexedDB réelle avant d'implémenter un blocage fiable ; deviner son nom ou son schéma serait risqué.
4. **Droits et données.** Les actions de vente, de crédit et d'annulation continuent d'utiliser les opérations existantes. Les onglets de navigation ne constituent pas une autorisation : RLS et contrôles serveur doivent rester la source d'autorité.
5. **Vérification.** Les commits sont poussés sur `main`, mais aucune compilation, suite SQL, recette navigateur ou déploiement n'a été exécuté dans cette intervention. Le statut « codé » ne signifie donc pas « validé en exécution ».

## Changements enregistrés sur main

- `db8a0e38e7b18a745a5058d0d341d3ad6d4d7214` — composant d'onglets contextuels.
- `ac2c3ecdf63e7526979dd91d760f156b13672772` — intégration des onglets au parcours.
- `ca11b6bacfca73635e8d7297f443d1dfff92cccc` — onglets du profil, changement de mot de passe et préférences locales.
- `bba829dacccd88e61cea271f7549c251bf0a6771` — styles des préférences limités au profil.

Aucun déploiement n'a été lancé. Aucune écriture Supabase Production n'a été exécutée.
