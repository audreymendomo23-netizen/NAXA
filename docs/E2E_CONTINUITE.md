# Continuité E2E — Service client NAXA

## Périmètre actif
Recette ciblée Agents NAXA sur Supabase Replay uniquement. Les parcours déjà verts Client/Admin et Promoteur/Livreur restent exclus du rerun ciblé. Aucun changement ni déploiement Production.

## État au 19 novembre 2026
- Build Next.js : PASS.
- Authentification et activation des Agents A/B : PASS.
- Disponibilité et prise des dossiers attribués : PASS.
- Demande Client vers Agent affecté : PASS.
- Acceptation atomique et rejet d'un autre Agent : PASS.
- Heartbeats Client et Agent : PASS.
- Lecture de l'état de l'appel côté Client : NON CONCLUANTE dans le run 44579310221. Le test attendait passivement une réponse GET qui n'a pas été capturée; cela ne démontre pas à lui seul une panne de l'API.
- Nettoyage Replay : PASS.
- WebRTC audio réel, média/micro, négociation ICE/TURN, reconnexion et expiration : non prouvés par les assertions précédentes.

## Diagnostic du run 44582345266
L'API Client GET explicite retourne HTTP 200 et `call.status=accepted`, mais l'assertion du rendu React « Appel en cours » échoue après 15 s. Le test prouve donc l'état serveur, pas sa propagation dans l'interface. Les parcours de connexion, affectation, acceptation et heartbeats passent. Nettoyage Replay PASS.

## Correction de recette en cours
Le test conserve l'exigence fonctionnelle d'un rendu UI `Appel en cours` et de la commande `Raccrocher`, sans assouplir le critère. L'instrumentation journalise désormais le corps du GET de polling et le DOM de la section en cas d'échec, afin de distinguer réponse serveur obsolète, composant non actualisé ou divergence du rendu.

## Critères de sortie
Ne déclarer vert que si l'API Client, l'interface Client, le raccrochage, la file centrale, l'expiration/heartbeat et les contrôles d'accès passent sur Replay. La connectivité WebRTC réelle doit être qualifiée séparément avec deux participants et des médias utilisables; le statut SQL accepted ne prouve pas le son bidirectionnel.


## Contradiction du run 44585020010
- Build Replay : PASS ; parcours Client/Admin et Promoteur/Livreur exclus par `[agents-only]` ; recette Agents : FAIL ; nettoyages : PASS.
- L’attente Playwright `page.waitForResponse` du heartbeat Client expire après 20 s.
- Preuve contradictoire en base Replay : la ligne `support_calls` créée le 19 novembre à 18:14:15.723 UTC a `requester_heartbeat_at=18:14:17.426 UTC`, puis a été annulée par le nettoyage à 18:14:35.196 UTC. Le heartbeat Client a donc bien été exécuté et persisté malgré le timeout Playwright.
- Cause racine de ce run : faux négatif de l’observateur Playwright sur l’événement de réponse, pas absence du heartbeat serveur. Aucun changement produit ne se justifie sur cette preuve.
- Correction du test : les quatre heartbeats (Client/Agent sur appel affecté et file centrale) sont désormais vérifiés par attente bornée de leur timestamp réellement persisté dans `support_calls`. Les assertions fonctionnelles, d’autorisation, d’acceptation et de rendu UI restent inchangées.

## Relance ciblée
La nouvelle recette Agents est relancée sur `main` avec `[agents-only]`. Les parcours Client/Admin et Promoteur/Livreur restent exclus, Production reste intouchée. Le rendu Client « Appel en cours » + bouton « Raccrocher » demeure un critère bloquant distinct. WebRTC média bidirectionnel n’est toujours pas déclaré prouvé.


## Audit approfondi — run 44587118730
### Faits observés
- Le build Replay, le démarrage serveur, les logins Agents A/B, leur présence et leurs affectations passent.
- Le heartbeat Client est persisté ; l'acceptation atomique et les deux heartbeats passent.
- Le GET Client renvoie HTTP 200 avec `call.status=accepted`.
- Après l'échec UI, le DOM montre de nouveau le bouton initial `Demander un appel audio`, pas seulement l'absence du libellé accepté. La page n'a pas crashé ; aucun échec réseau client ni erreur console n'a été consigné.
- Les journaux Replay indiquent l'appel SQL `naxa_support_call_request` à 18:26:21.842 UTC, puis les lectures profil/rôle côté navigateur à 18:26:22.116–18:26:22.470 UTC. Cette séquence place la synchronisation du shell global immédiatement après la création de l'appel.
### Hypothèses et vraisemblance diagnostique
- **Très élevée (~95 %) — déplacement du sous-arbre Client lors de l'initialisation du shell.** `ParcoursClientShell` ne rendait `children` dans un wrapper `div key={pathname}` qu'après `sessionReady && clientConnecte`. Avant cette condition, les mêmes enfants étaient rendus directement. À la fin de la synchronisation asynchrone, React voit les enfants changer de position/parent ; l'état local `useState` de `SupportAudioCall` est alors réinitialisé. Le retour au bouton initial correspond exactement à ce mécanisme.
- **Faible (~3 %) — navigation/rechargement de document ou intervention du service worker.** Aucune navigation n'était instrumentée dans le run précédent ; instrumentation `framenavigated` ajoutée au test suivant pour éliminer cette possibilité.
- **Très faible (~1 %) — défaut interne de polling ou de setState dans `SupportAudioCall`.** Le composant ne remet pas `callId` ou `status` à null après succès ; l'API et le GET sont confirmés. L'hypothèse n'explique pas naturellement le retour exact au bouton initial.
- **Très faible (~1 %) — problème API/SQL ou assertion Playwright.** Contradictoire avec HTTP 201/200, statut `accepted` et ligne de call vérifiée.
Ces pourcentages sont des estimations de diagnostic, pas des fréquences statistiques.
### Correction appliquée
Le wrapper du parcours Client est maintenant présent dès le premier rendu pour toute route Client ; avant authentification confirmée, il est en `display: contents`. Après authentification, seules ses classes immersives changent. L'élément, sa clé `pathname` et la position React de `children` restent stables : l'initialisation du shell ne doit plus démonter/remonter `SupportAudioCall`. Les routes hors parcours Client conservent le rendu précédent.
Le test vérifie aussi le libellé initial `Agent appelé` juste après le POST, trace les navigations du document Client et lit correctement le corps de la réponse de polling (Playwright `Response.json()`, sans API `clone()` inexistante).
### Validation requise
Le run ciblé doit démontrer successivement `Agent appelé`, puis `Appel en cours` et `Raccrocher`, puis le raccrochage HTTP 200 et état DB `completed`. Si un document navigation apparaît ou si un autre échec survient, le diagnostic repart des traces exactes. WebRTC média bidirectionnel reste un critère distinct non encore prouvé.


## Audit contradiction — run 44590621583
### Faits prouvés
- La correction de position React a réussi : l'interface Client rend `Agent appelé`, puis `Appel en cours` et le bouton `Raccrocher`; raccrochage Client et file centrale PASS.
- RLS inter-Agent, notes internes, réponses publiques, Realtime et concurrence atomique PASS.
- Le run échoue uniquement lors du contrôle de suspension. Les deux appels du run sont en base `completed`, motif `participant_ended`, `agent_user_id=null`.
- Contradiction dans le test : `callId` est créé au premier appel, puis cet appel est explicitement raccroché par le Client avant la suite ; le second appel de file centrale est aussi explicitement terminé. La suspension ultérieure vérifie par erreur le premier `callId`, déjà terminé. Le test ne prépare donc aucun appel actif au moment de suspendre l'Agent.
### Vérification du mécanisme Replay
- Replay confirme que `trg_naxa_support_agent_end_calls` est installé et attaché aux mises à jour de `support_agents.status`, `must_change_password`, `consent_accepted_at`.
- La fonction DB déployée `private.naxa_support_agent_end_calls` appelle `private.naxa_support_call_requeue_or_finish` sur les appels `ringing` et `accepted`.
- La fonction déployée `naxa_support_call_requeue_or_finish` réattribue une sonnerie en file centrale (`queued`, agent null, délai d'expiration 60 secondes) ; pour un appel `accepted`, elle utilise `naxa_support_call_finish_active`, qui marque l'appel `failed`.
- Aucune preuve ne justifie une modification du SQL produit à ce stade.
### Correction E2E (sans assouplissement)
- Le test crée désormais un dossier dédié, l'affecte à Agent A, crée un nouvel appel, le fait accepter par l'API avec la session Auth réelle d'Agent A, confirme `status=accepted`, l'identité de l'Agent, `accepted_at` et `ended_at IS NULL`, puis suspend Agent A. Il exige exactement `failed` + `agent_status_suspended` + `ended_at`.
- Un second scénario distinct vérifie la branche `ringing` : suspension d'Agent B, retour de l'appel à `queued`, suppression de l'Agent affecté, échéance centrale présente, révocation de session et réactivation.
- Les vérifications de libération des affectations sont explicites. Les tests précédents ne sont ni retirés ni édulcorés.
- Le HTTP 503 sur l'endpoint ICE confirme séparément que TURN n'est pas configuré sur Replay. Ce blocage empêche de déclarer le son WebRTC bidirectionnel vert ; l'état `accepted` SQL ne vaut pas preuve de média.


## Ajustement du contrat statique — run 44593259110
- La recette Replay n'a pas démarré : le build exécute `prebuild -> npm run quality`, et le test statique audio échouait avant compilation.
- Assertion devenue obsolète : `scripts/test-support-audio.cjs` cherchait `agent_permission_revoked_audio_call` dans le script navigateur, alors que le test de suspension désormais vérifie le motif métier exact `agent_status_suspended`.
- Mise à jour du contrat : contrôle de la branche SQL de révocation permission dans la migration, et du nouveau scénario E2E de suspension d'un appel accepted ainsi que du scénario ringing renvoyé à la file centrale. Aucun contrôle n'est supprimé.
- Les runs 44593259134 / 44593259110 sont donc des échecs pré-recette, pas des verdicts sur le comportement applicatif. Le nouveau commit déclenche la nouvelle vérification.
