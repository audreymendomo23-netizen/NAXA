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

## Audit statique des gestionnaires de clic

Le prototype `src/app/pharmacie/caisse/parcours-ui/page.tsx` contient 159 composants `Action` et 14 boutons natifs, soit 173 contrôles cliquables. Le contrôle statique relève zéro composant `Action` sans prop `onClick`, zéro bouton natif sans `onClick`, et zéro cible littérale `go("…")` inconnue du type `Screen`.

Les gestionnaires sont répartis en 92 navigations via `go(...)`, 77 ouvertures de dialogue de démonstration via `demoAction(...)`, 2 changements d’état local (langue/recherche) et 1 fermeture de dialogue. **Les 77 dialogues ne sont pas des actions métier connectées** : ils signalent explicitement qu’aucune écriture réelle n’est faite. Le nombre de contrôles liés à un gestionnaire ne doit pas être confondu avec le nombre de fonctionnalités métier exécutables.

Statut du contrôle : **0 contrôle cliquable sans gestionnaire détecté**. Validation limitée au code source récupéré ; aucune recette navigateur, compilation ou test d’exécution n’est revendiqué.

## Contradictions et risques détectés

1. **Une entrée principale n'est pas la même chose qu'un onglet secondaire.** Les liens secondaires ont été ajoutés sans gonfler les sept entrées principales.
2. **Une session de caisse n'est pas un événement de connexion.** L'interface du profil ne présente pas les sessions de service comme un historique Auth.
3. **Hors-ligne : réseau absent et file en attente sont deux états différents.** Le bouton Déconnexion ne couvre actuellement que le premier. Il faut identifier la file IndexedDB réelle avant d'implémenter un blocage fiable ; deviner son nom ou son schéma serait risqué.
4. **Droits et données.** Les actions de vente, de crédit et d'annulation continuent d'utiliser les opérations existantes. Les onglets de navigation ne constituent pas une autorisation : RLS et contrôles serveur doivent rester la source d'autorité.
5. **Vérification.** Les commits sont poussés sur `main`, mais aucune compilation, suite SQL, recette navigateur ou déploiement n'a été exécuté dans cette intervention. Le statut « codé » ne signifie donc pas « validé en exécution ».

## Mise à jour de l'architecture des onglets

Le tableau de bord possède désormais une barre d'onglets permettant d'accéder à l'encaissement, à la recherche de prix, aux retraits Marketplace, aux décaissements, à l'historique des tickets et à la clôture par navigation vers les sections correspondantes. Les autres entrées conservent leurs sous-onglets contextuels et le Profil conserve ses quatre onglets internes. Il s'agit d'une structuration d'interface : elle ne prétend pas ajouter des intégrations métier absentes.

## Changements enregistrés sur main

- `db8a0e38e7b18a745a5058d0d341d3ad6d4d7214` — composant d'onglets contextuels.
- `ac2c3ecdf63e7526979dd91d760f156b13672772` — intégration des onglets au parcours.
- `ca11b6bacfca73635e8d7297f443d1dfff92cccc` — onglets du profil, changement de mot de passe et préférences locales.
- `bba829dacccd88e61cea271f7549c251bf0a6771` — styles des préférences limités au profil.
- `d7f35d0fc8636ce7050c30034c5ddc0ee6a4e685` — onglets du tableau de bord et ancres des sections.

Aucun déploiement n'a été lancé. Aucune écriture Supabase Production n'a été exécutée.

## Audit visuel complémentaire — maquette statique des sept entrées

### Référence du cahier des charges

- **§ 5.2** : conserver les sept entrées principales : Tableau de bord, Clients et Assurances, Historique des ventes, Prise / fin de service, Rapports & Performances, Profil, Déconnexion.
- **§ 13.0 / F00** : accueil avec cartes personnelles du jour, Nouvelle vente, ordonnances, réservations, paniers en attente, stock, demandes, clôture, alertes produits et dernière sauvegarde.
- **§ 13.1 / C0** : logo, pharmacie, identité/rôle, FR/EN, notifications, aide/verrouillage, état réseau/synchronisation/sauvegarde, cibles tactiles, responsive, mode léger et états chargement/vide/erreur/hors-ligne/accès refusé.
- **F14–F15** : recherche/scan, panier, contrôles visuels, favoris et paniers en attente.
- **F35** : indicateurs personnels, courbe horaire, top produits, produits sans prix et raccourci d’action.

### Résultat codé

Nouvelle route de maquette : `/pharmacie/caisse/maquette-visuelle`, fichier `src/app/pharmacie/caisse/maquette-visuelle/page.tsx`.

La page présente en une seule vue, pour revue visuelle :
1. Tableau de bord et poste de caisse (indicateurs, courbe, raccourcis, alertes, recherche, scan, panier, récapitulatif de paiement).
2. Clients et Assurances (compteurs, recherche, tableau clients, crédits et états tiers payant).
3. Historique des ventes (filtres, table tickets, duplicata et demande d’annulation).
4. Prise / fin de service (fond initial, statut, rapprochement, écart et historique de sessions).
5. Rapports & Performances (KPI, courbe, répartition des paiements, top produits, produits sans prix et exports illustrés).
6. Profil (avatar, identité, sécurité, messages de succès/erreur et préférences).
7. Déconnexion (carte de sortie et variantes de message en ligne/hors ligne/erreur).
8. Cadre commun C0 (squelettes de chargement, état vide, erreur, hors ligne, accès refusé, mode léger et checklist responsive/accessibilité).

### Limites intentionnelles et constats

- Cette route est **strictement visuelle** : boutons, champs, filtres, cartes et commandes sont des éléments de présentation non interactifs. Aucun appel Supabase, Auth, RPC, paiement, export, notification ou écriture métier n’est effectué.
- Les montants, noms, tickets et statuts sont explicitement présentés comme exemples/valeurs non connectées ; ils ne doivent pas être interprétés comme des données réelles.
- La recherche de code n’a pas identifié de fichier logo image NAXA réutilisable. La maquette emploie donc un monogramme « N » stylisé, à remplacer par l’actif officiel lorsqu’il sera identifié. Les vignettes produits sont des placeholders graphiques, pas des photos de médicaments.
- Le tableau de bord opérationnel existant `/pharmacie/caisse` et les écrans connectés ne sont pas remplacés par cette maquette. La nouvelle route permet de valider l’inventaire visuel sans débrancher les fonctions existantes.
- La présence de ces éléments visuels ne valide pas les comportements métier. La compilation TypeScript, les tests, la revue navigateur et la recette responsive restent à exécuter ; aucun déploiement n’a été lancé.

## Commit de maquette visuelle

- `97b5bb5f81f60e19dd4d23d24adbf836553cf550` — maquette statique des sept entrées et états communs.

## Audit de couverture des parcours interactifs — cahier § 5.2 et § 13

Date : 20 octobre 2026. Travail de code directement sur `main`. Aucun déploiement demandé ni exécuté.

### Les 7 entrées principales (règle § 5.2)

1. **Tableau de bord** : cartes personnelles du jour, activité horaire, alertes, raccourcis, Nouvelle vente, ordonnances, réservations, stock, demandes, paniers en attente, clôture, statut de garde si autorisé, notifications, réseau/synchronisation, aide et verrouillage.
2. **Clients et Assurances** : répertoire, recherche/filtres, fiche client, crédits et encaissement de créance (parcours existant), assurances/couvertures, tiers payant, vente assurée, créances/bordereaux/rejets en consultation, notifications liées.
3. **Historique des ventes** : recherche, filtre de statut, détail/ticket, duplicata/impression/PDF/partage, demande d’annulation, suivi du motif/statut et synthèse.
4. **Prise / fin de service** : prise de poste, fond initial, sessions, poste de caisse, rapprochement, montants comptés, écarts/motifs, clôture Z et aperçu du rapport.
5. **Rapports & Performances** : KPI personnels, ventes horaires, répartition des paiements, top produits, produits sans prix, alertes, exports PDF/Excel et rapport de fin de journée.
6. **Profil** : identité/rattachement, préférences d’affichage, texte agrandi/compact/mode léger, activité récente, sécurité/mot de passe/PIN.
7. **Déconnexion** : écran de confirmation, annuler/retour, variantes de message en ligne/hors ligne/erreur. La navigation de démonstration ne déconnecte personne.

### Matrice des fiches du cahier § 13

| Fiche | Écrans / éléments du parcours caisse recensés | État dans la nouvelle maquette |
|---|---|---|
| F00 | Accueil, cartes, actions rapides, alertes, sauvegarde | Présent |
| F01 | Connexion, OTP/mot de passe oublié, verrouillage, erreurs génériques | Connexion réelle hors maquette ; écran de reprise/verrouillage représenté, sans Auth |
| F02 | Première connexion et compte bloqué | Acteur principal promoteur ; états de blocage non connectés dans la maquette |
| F03 | Réservations reçues, détail, échéance, prête/remise/annulation | Écran Réservations et commandes illustratives |
| F04 | Statut De garde, confirmation et horodatage | Écran Statut de garde |
| F05 | Stock, recherche/scan, statut, lot/péremption | Écran Mon stock et Lots |
| F06 | Import Excel/CSV, modèle, association colonnes, contrôles/rapport | Assistant d’import |
| F07 | État réseau, file, conflits, synchronisation | Écran Synchronisation et mode hors ligne |
| F08 | Catalogue par molécule/DCI/ATC, marque/générique, prix et stock | Catalogue par molécule |
| F09 | Entrée stock par lot, fournisseur, BL, quantité, péremption | Formulaire Réception et contrôle |
| F10–F11 | Statuts d’alerte, seuils, lots proches de péremption, actions prévues | Mon stock, alertes et Lots |
| F12 | Sortie exceptionnelle, motif, note, pièce et suivi | Formulaire Sortie exceptionnelle + Mes demandes |
| F13 | Registre réglementé, lot, entrées/sorties/solde, ordonnance/validateur | Registre réglementé en consultation visuelle |
| F14 | Recherche, scan, panier, quantités, contrôles, générique, remise/attente/payer/vider | Écran Nouvelle vente |
| F15 | Favoris, raccourcis clavier, paniers en attente, reprise/suppression, écran client | Favoris, Paniers en attente, écran client |
| F16 | Remise %, montant, plafond, motif, validation | Écran Remise et promotions |
| F17–F19 | Ajout/aperçu ordonnance, statut, validateur, coffre, hors ligne/transfert | Ordonnances, Coffre et Mode dégradé |
| F20 | Modes de paiement, montant remis, rendu, référence, paiement mixte | Écran Paiement, champs et messages d’état |
| F21 | Ticket imprimable, PDF, WhatsApp, nouvelle vente | Aperçu ticket et commandes visuelles |
| F22 | Historique et demande d’annulation avec motif/statut | Écran Demande d’annulation |
| F23 | Demandes, filtres, objet, statut, décideur et cloche | Mes demandes et Centre de notifications |
| F24 | PIN, validation par rôle habilité, refus/motif et verrouillage | Écran PIN / sécurité ; aucune vérification réelle |
| F25 | Assureur, matricule, droits, plafond, part client/assureur | Vente assurée / Assurances |
| F26 | Clôture Z, totaux théoriques/comptés, écart/motif, ventes différées, rapport | Écran Clôture |
| F27 | Saisie différée et carnet papier | Écran Mode dégradé |
| F28–F30 | Fiches assureurs, créances/bordereaux, rejets et rappels | Consultation illustrative des assurances et créances ; actions externes désactivées |
| F31–F33 | Fournisseurs/dettes, réapprovisionnement, commande, réception et BL | Écrans Fournisseurs, Commande et Réception |
| F34 | Inventaire, comptage et soumission | Refus d’accès explicite côté caisse ; le cahier attribue l’action au magasinier et la validation au promoteur |
| F35 | Tableau de bord personnel, courbe, top produits et prix manquants | Présent au tableau de bord et rapports |
| F38 | Centre d’alertes, gravité/date/objet et accès à l’objet | Centre d’alertes et liens vers les écrans correspondants |

### Audit contradictoire du code

- **Navigation vs opération** : le prototype ouvre les écrans et dialogues locaux, mais n’effectue aucun paiement, aucune écriture de stock, aucune demande réelle, aucun export, aucune notification, aucune mutation Auth/Supabase.
- **Données** : références, tickets, profils et valeurs de démonstration sont explicitement fictifs. Aucun indicateur fictif n’est présenté comme résultat réel de la pharmacie.
- **Rôles** : le prototype expose un état « accès réservé » pour l’inventaire, qui reste une fonction du magasinier/promoteur. Les ordonnances affichent un rappel qu’une caissière ne valide pas elle-même.
- **Risque de confusion** : la nouvelle route est une maquette navigable et indépendante ; elle ne remplace pas les pages opérationnelles déjà présentes sous `/pharmacie/caisse`. Les contrôles sont des simulations, non une preuve de permission ou de sécurité serveur.
- **Écarts encore à traiter dans la maquette** : certaines opérations du cahier (création de comptes/OTP, verrouillage temporisé, biométrie, vraie caméra/scanner, impression et PDF réels, partage WhatsApp, synchronisation effective, intégrations assureurs) restent représentées par des états et dialogues, pas par des intégrations.
- **Validation** : le fichier est enregistré sur `main`, mais aucun environnement de build/test n’a été exécuté ici. La validation TypeScript, lint, build, test responsive et revue des liens restent donc **non vérifiés**. Aucun déploiement n’a été lancé.

### Nouveau parcours de démonstration

- Route : `/pharmacie/caisse/parcours-ui`
- Fichier : `src/app/pharmacie/caisse/parcours-ui/page.tsx`
- Commits : `928816bd64897834b3e43e7867826d3206086da5` (première version), `cc924d6e185dbaddc3ed311fb86738c7bbfd7d9e` (écrans complémentaires), `f3ba621218b67e6ead57673559bef8a99ab54885` (correction des titres/syntaxe), `f0336a78a1eba57644233c950a507202fe30154a` (nettoyage types/états).

### Complément de couverture après revue des liens

La route `/pharmacie/caisse/parcours-ui` a été étendue pour rendre navigables les interfaces qui manquaient à la première passe : Connexion, Première connexion, Mot de passe oublié/OTP, Statut de garde, Coffre ordonnances, Ordonnance hors ligne/mode dégradé, PIN, Créances/bordereaux/rejets, Fournisseurs/dettes, alertes et état d’accès refusé à l’inventaire.

Contrôle statique de la version relue :
- 45 identifiants d’écran déclarés dans l’union TypeScript ;
- 45 titres définis ;
- 45 écrans couverts par un rendu conditionnel ;
- 171 gestionnaires locaux `onClick` recensés ;
- aucune référence Supabase/Auth dans ce fichier ;
- les actions non disponibles ouvrent un dialogue d’information plutôt que de lancer une opération métier.

Ce contrôle confirme la cohérence de l’inventaire des écrans, pas la compilation. L’installation/build n’a pas pu être exécutée dans l’environnement de travail utilisé pour cette intervention (accès réseau au dépôt indisponible). Le statut TypeScript/build reste donc non vérifié.

Dernier commit du prototype : `97a946e964e4568627e52ff89853128e35a30157` — écrans de connexion et récupération de mot de passe.


---

## Rectificatif — contrôle statique de l’architecture sur main (20/10/2026)

Ce contrôle remplace les anciens décomptes statiques ci-dessus lorsqu’ils divergent du fichier source actuel. La référence fonctionnelle reste exclusivement `docs/CAHIER_DES_CHARGES_CAISSE_CAISSIERE.md`.

Fichier contrôlé : `src/app/pharmacie/caisse/parcours-ui/page.tsx`.

| Vérification | Résultat observé sur la version contrôlée |
|---|---:|
| Identifiants de l’union TypeScript `Screen` | 45 |
| Titres définis | 45 |
| Identifiants avec condition de rendu détectée | 45/45 |
| Identifiants sans titre | 0 |
| Identifiants sans rendu détecté | 0 |
| Cibles `go("…")` inconnues | 0 |
| Gestionnaires `onClick` | 173 |
| Appels Supabase/Auth/RPC/`fetch`/stockage local dans le prototype | 0 détecté |

Les écrans `assurances` et `assurance-vente` sont couverts par une même condition de rendu à deux branches. L’écran `cloture` possède un rendu dédié. Ils ne sont donc pas des écrans sans rendu dans la version contrôlée.

Ces chiffres constituent un contrôle statique du code récupéré, pas un résultat de compilation, de test navigateur ou de recette fonctionnelle. La route prototype reste non connectée ; elle ne doit pas être utilisée comme preuve d’une opération métier.

La navigation latérale correspond à sept entrées du cahier § 5.2 : six liens principaux et un bouton Déconnexion distinct. Le parcours opérationnel séparé se trouve sous `/pharmacie/caisse` et `/pharmacie/caisse/[section]`. La présence de requêtes/RPC dans ces fichiers ne prouve pas, à elle seule, la sécurité ou la validation des traitements en base.

Rapport de preuve détaillé et matrice des éléments restant à tester : [`docs/PREUVE_ARCHITECTURE_COMPTE_CAISSE.md`](PREUVE_ARCHITECTURE_COMPTE_CAISSE.md).

Aucun test de build/lint/SQL/navigateur n’est déclaré réussi par ce rectificatif. Aucun déploiement n’a été demandé ni lancé dans le cadre de cette mise à jour documentaire.


## Mise à jour — boucles interactives pour les 77 actions provisoires (20/10/2026)

**Fichier modifié sur `main` :** `src/app/pharmacie/caisse/parcours-ui/page.tsx`

- Les 77 appels `demoAction(...)` ouvrent maintenant un centre de scénarios de notification au lieu de l'ancien dialogue passif.
- Le catalogue produit **1 000 cas de test déterministes** : 10 rôles × 10 domaines fonctionnels × 10 états.
- Les cas proposent un rôle et un domaine, une priorité illustrative, un message contextualisé, la navigation précédent/suivant en boucle et le marquage local « lu ».
- Le rôle et le domaine initiaux sont déduits du libellé de l'action, puis restent modifiables dans la fenêtre.
- Les scénarios sont générés en mémoire ; aucun message n'est envoyé et aucune vente, session, autorisation, donnée métier ou écriture Supabase n'est modifiée. Ce travail reste un **prototype d'architecture**, pas une intégration de notifications métier.
- L'inférence du rôle est une règle de démonstration fondée sur les libellés, pas un contrôle d'autorisation. Elle ne doit jamais servir à accorder des droits.
- Vérification statique du fichier après écriture : les 77 appels sont toujours présents et la génération annonce 1 000 combinaisons. **Typecheck, lint, build et tests navigateur non exécutés** dans cette passe ; compilation et fonctionnement navigateur restent donc non vérifiés.
- Aucun déploiement lancé.

Commit code : `95427c9cf217138d95bb09f479341c14f0343747`.
