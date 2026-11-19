

## §241 — Support Agents validé et diagnostic Marketplace enrichi — 19/11/2026

### Support Livechat Client / professionnels / Agents

- Run GitHub Actions `44412115231`, commit `052daf8bd7f5fb45ed68ee711a8e64fd97a40032` : **PASS complet**.
- Client ↔ Admin : création du ticket, messages dans les deux sens, pièce jointe PDF privée avec URL signée, résolution, réouverture Client/Admin, notifications et non-régression `/aide` PASS.
- Reconnexion Realtime : après réabonnement, le Client reçoit bien la réponse Admin ; l'ancien échec R09–10 n'est plus reproduit.
- Promoteur, Responsable, Pharmacien, Gestionnaire stock, Client, Comptable, Caisse et Livreur : widgets, création de tickets, réponses Admin, statuts, notifications et suivi `/assistance` PASS.
- Agents A/B : connexions individuelles, présence, prise de dossier, isolation RLS inter-Agent, réponse publique HTTP 201 visible par le Client, note interne invisible au Client, Realtime retour Client→Agent, refus d'accès croisé, double prise refusée, concurrence atomique et suspension/libération du ticket PASS.
- Nettoyage Replay : tickets, messages, notifications, pièces jointes et comptes Auth Agents supprimés ; événements d'audit conservés anonymisés. Les étapes de nettoyage ont PASS.
- Portée : validation de la recette Support sur Replay ; ne valide pas Gmail OAuth, WebRTC/TURN, ni l'ensemble du produit.

### Qualité

- Run `44412611211` sur le commit `0828af5c929cec58fc2918fe843d4b7b3bb70b50` : **SUCCESS** — syntaxe workflows, tests, TypeScript, lint et build.
- Les warnings lint existants restent des avertissements ; aucun échec de qualité sur ce commit.

### Marketplace bulk — résultat navigateur exact

- Run `44411978463`, commit `7306619527f7c39d66e861bc8be8eb3190b94867` : navigation jusqu'à la recherche B2 PASS, mais carte pharmacie absente du DOM après 30 secondes.
- Trace navigateur : le RPC `search_pharmacies_bulk` répond HTTP 200 avec une ligne pour la pharmacie de recette et le produit demandé ; le DOM affiche néanmoins `0 résultat`.
- La trace ne contenait pas les paramètres de requête ni la réponse du SELECT des métadonnées pharmacie. La page filtre les lignes RPC sur les métadonnées `pharmacies` (`est_demo`, `visible_recherche`, `archivee_le`) ; un SELECT de métadonnées en erreur ou une visibilité différente peut donc éliminer la ligne sans rendre d'erreur visible.
- Le script E2E a été instrumenté au commit `9cd3325400d3b712b4a4fee04724d1b7e44c2cec` pour capturer les paramètres RPC (`p_terms`, quantités, coordonnées, rayon), le résumé des lignes retournées et les métadonnées pharmacie effectivement reçues par le navigateur.
- Run de diagnostic `44441919874` sur ce commit : en cours au moment de cette mise à jour ; aucune conclusion supplémentaire avant ses logs.
- Après la recette précédente, la visibilité de la pharmacie de test a été restaurée à `false`, conformément au nettoyage. Aucun changement persistant de visibilité n'est laissé par le test.

### Verdict actualisé

- Support Livechat Client/Admin : **VERT Replay**.
- Assistance professionnelle Promoteur/Livreur et autres rôles : **VERT Replay**.
- Cycle de vie Agents NAXA et RLS inter-Agent : **VERT Replay**.
- Qualité commit `0828af5` : **VERT CI**.
- Marketplace bulk : **NON VERT navigateur** ; le RPC renvoie une ligne, mais le rendu n'est pas encore prouvé.
- ACL trigger-only précédente : **VERT Replay**.
- Gmail OAuth et WebRTC/TURN : **NON IMPLÉMENTÉS**.
- Aucune migration Production, aucune modification Production, aucun déploiement.

### Point exact de reprise

1. Lire le run `44441919874` et sa trace enrichie : confirmer les coordonnées/rayon et le SELECT des métadonnées pharmacie.
2. Si le SELECT des métadonnées échoue, corriger le contrat REST/champs ou faire remonter l'erreur au lieu de convertir silencieusement la recherche en zéro résultat ; si les métadonnées sont absentes/incohérentes, corriger la règle de visibilité à partir de la preuve.
3. Rejouer le Lot B2 complet : affichage offre, favori persistant, réservation, hold de stock, indisponibilité Client B, validation Gestionnaire Stock, annulation et restauration du stock.
4. Mettre à jour ce document avec les preuves du run avant de déclarer le Marketplace vert.
