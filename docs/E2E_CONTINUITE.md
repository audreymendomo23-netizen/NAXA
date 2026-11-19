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


## Diagnostic TURN / média WebRTC
- La recette Agents 44593655149 est PASS (acceptation, état Client, raccrochage, file centrale, RLS, Livechat, concurrence, suspension accepted et remise en file ringing) ; la qualité 44593655186 est PASS.
- Le run précédent a relevé HTTP 503 sur `/api/support/calls/:id/ice` : le workflow ne fournissait pas `NAXA_TURN_URLS` ni `NAXA_TURN_SHARED_SECRET`. Le routeur ICE refuse volontairement de produire des identifiants TURN lorsque ces valeurs manquent. Ce n'est pas une erreur d'état de l'appel mais un environnement de test incomplet.
- Coturn supporte l'authentification TURN REST par `use-auth-secret` + `static-auth-secret`; l'option `allow-loopback-peers` n'est activée que pour le relais localhost de CI (jamais pour la Production). Références Coturn : https://github.com/coturn/coturn/wiki/turnserver et https://github.com/coturn/coturn/blob/master/README.turnserver.
- Le workflow démarre désormais un relais Coturn éphémère sur loopback, avec secret généré par exécution, ports relay bornés et identifiants éphémères générés par l'API NAXA. Aucun secret réel ou service Production n'est utilisé.
- Le test navigateur force `iceTransportPolicy=relay`, accorde le microphone dans Chromium headless et injecte un signal audio de test 440 Hz dans le flux issu de `getUserMedia`. Il doit prouver pour Client ET Agent : état ICE `connected`, candidat local et distant `relay`, piste audio sortante et entrante vivante, paquets RTP audio envoyés et reçus, flux distant attaché à l'élément audio et lecture non suspendue.
- Les statistiques `getStats()` sont la preuve des paquets/audio RTP ; référence MDN : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getStats.
- Ce test prouve la négociation et le transport audio via TURN sur le runner Replay CI. La configuration d'un TURN public permanent pour des réseaux mobiles/clients réels reste un paramètre d'exploitation distinct ; aucun déploiement Production n'est effectué.


## Contradiction — run 44595716497 (TURN local)
- Build Replay, démarrage serveur, création des Agents, acceptation de l'appel et GET `/ice` HTTP 200 : PASS.
- Le navigateur a attendu `Connecté` 45 s puis a échoué. Le GET ICE renvoyait bien `turn:127.0.0.1:3478` et un identifiant éphémère.
- Les logs Coturn montrent `errno=98 / Address already in use` sur le listener TCP 3478 et plusieurs `Fatal final failure: cannot bind ... 127.0.0.1:3478`. Le script de disponibilité ne testait que la présence d'un socket UDP, ce qui était un faux positif : le paquet Debian avait démarré son service Coturn système, qui occupait le port avant notre instance avec secret généré.
- Cause racine : collision entre le service Coturn post-install et l'instance de test ; le PID lancé par le workflow n'était pas propriétaire du socket que la vérification avait vu. L'API NAXA et le statut d'appel ne sont pas mis en cause par cette preuve.
- Correction : arrêter le service Coturn système et tout processus turnserver post-install avant le démarrage, choisir un port libre, puis exiger que `ss -lunp` attribue le socket UDP au PID exact écrit par le workflow. Plus de vérification basée uniquement sur un numéro de port présent.
- Diagnostic média renforcé : ne pas échouer avant lecture des statistiques si le badge `Connecté` n'apparaît pas. Les états PC/ICE/signaling/gathering, candidats, protocoles, compteurs RTP, pistes et audioContext sont désormais journalisés avant les assertions bloquantes.


# Point de continuité — 20 novembre 2026, 00:27 (Africa/Douala)

## État de référence
- Dépôt : `audreymendomo23-netizen/NAXA`, branche `main`.
- HEAD audité : `90c049c11edf9598e291c071f6848e4dc4deb65d` — `test(support): bind verified ephemeral TURN process and trace ICE state [agents-only]`.
- Environnement autorisé : Supabase Replay uniquement (`pwfftcsjyeibxxqhwysw`) et navigateur CI. Aucun changement de Production, aucune migration Production, aucun déploiement.
- Verdict global : **NON VERT**. Le sous-ensemble fonctionnel Agent/Livechat/cycle de vie est déjà passé dans un run antérieur, mais la preuve du transport audio WebRTC bidirectionnel est toujours en échec. Le contrôle actionlint/ShellCheck du dernier commit est également en échec.

## Derniers runs observés
| Run | Résultat | Portée et preuve |
|---|---|---|
| [44597102023 — Replay Support Livechat Browser E2E](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44597102023) | **FAIL** | Build Replay, serveur local et démarrage TURN PASS ; suite Agents échoue à l'authentification du canal privé de signalisation Realtime, avant les échanges SDP/ICE/RTP. Nettoyages PASS. |
| [44597102291 — NAXA quality](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44597102291) | **FAIL partiel** | Job tests/TypeScript/lint/build PASS ; job actionlint FAIL uniquement sur ShellCheck `SC2009` dans le script du workflow. |
| [44593655149 — Replay ciblé Agents](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44593655149) | **SUCCESS** | Parcours Agent, droits, RLS, Livechat, concurrence, appels acceptés/ringing, suspension et réactivation PASS. Ce run ne prouve pas le média WebRTC bidirectionnel. |
| [44593655186 — NAXA quality](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44593655186) | **SUCCESS** | Qualité complète sur le commit de ce run. |

## Faits positifs encore valides
- Le défaut de conservation de l'état React a été corrigé dans `ParcoursClientShell` : le wrapper du parcours Client conserve une position stable dans l'arbre React.
- Les tests précédents démontrent le rendu Client de `Agent appelé`, puis `Appel en cours` et `Raccrocher`, le raccrochage, les heartbeats persistés, la file centrale, le RLS inter-Agent, les notes internes/réponses publiques, Realtime du Livechat écrit, la concurrence atomique et les deux branches de suspension/réactivation.
- Le scénario de suspension a été corrigé : il crée désormais un nouvel appel réellement `accepted` avant la suspension et exige `failed` avec `agent_status_suspended`. Un autre scénario vérifie qu'un appel `ringing` retourne `queued` lors de la suspension. Il ne réutilise plus un ancien appel déjà terminé.
- Le faux négatif Playwright sur les heartbeats a été corrigé : le test vérifie les timestamps persistés dans `support_calls` plutôt qu'une attente fragile de réponse réseau.
- Le bootstrap TURN de CI a été corrigé après collision avec le service Coturn système : arrêt du service post-install, port libre, puis vérification que le PID exact du processus lancé possède le socket UDP. Sur le run 44597102023, cette étape est PASS et les credentials ICE sont délivrés par l'API avec HTTP 200.

## Diagnostic détaillé du blocage WebRTC — run 44597102023

### Chronologie et preuves
- L'appel Client est créé en `ringing`, puis accepté par l'Agent ; la base Replay contient `status=accepted`, `accepted_at` renseigné, ainsi que les deux heartbeats. L'API Client GET retourne HTTP 200 et `accepted`.
- L'interface Client affiche `Appel en cours` et `Raccrocher`. La régression UI précédente n'est donc pas réapparue.
- `GET /api/support/calls/:callId/ice` retourne HTTP 200 et un tableau `iceServers` contenant le TURN local, avec username et credential éphémères. Le problème de configuration TURN 503 est levé pour cet environnement CI.
- Le log Supabase Realtime du 19 novembre 2026 à `19:23:52.507 UTC` contient : `Unauthorized: You do not have permissions to read from this Channel topic: naxa-support-call:41f69974-e241-4e38-844f-8d4e0b981b89`.
- Au moment de l'échec, le navigateur Client rapporte un `RTCPeerConnection` à l'état `new`, ICE `new`, signaling `stable`, gathering `new`, zéro sender, zéro receiver, zéro candidat, zéro paquet RTP et aucun AudioContext. Ce constat est cohérent avec un échec de souscription/signaling avant le démarrage de `getUserMedia`, pas avec un échec TURN/RTP après négociation.
- Le nettoyage a ensuite terminé l'appel avec `participant_ended`. Cet état final est une conséquence du `finally` E2E ; il ne doit pas être pris pour la cause racine du refus Realtime.

### État de la politique et de la fonction d'autorisation observées sur Replay
- La fonction déployée `private.naxa_support_call_realtime_access(text,uuid)` existe, est `SECURITY DEFINER`, appartient à `postgres`, et EXECUTE est accordé à `authenticated` et `service_role`.
- La fonction vérifie notamment : acteur fourni égal à `auth.uid()`, format exact du topic, appel `accepted`, ticket non résolu/fermé, profil demandeur actif ; pour l'Agent, compte actif, activation initiale terminée, consentement accepté et permissions `audio_call` + `ticket_view_assigned`.
- Les politiques `realtime.messages` existent pour SELECT et INSERT du rôle `authenticated`, limitées à `extension='broadcast'` et à cette fonction d'autorisation.
- Ces constats prouvent l'existence de la fonction et des politiques, **pas** que la fonction renvoie `true` pour chaque participant avec le JWT réellement utilisé par le WebSocket. Les causes encore ouvertes sont : JWT utilisateur non synchronisé dans le client Realtime au moment du `subscribe()`, `auth.uid()` absent/différent dans le contexte Realtime, ou un prédicat métier de la fonction qui renvoie false. Aucune de ces trois causes ne doit être déclarée certaine sans test discriminant.

### Piste de diagnostic prioritaire, non encore validée
- `src/lib/supabase/client.ts` utilise `createBrowserClient` de `@supabase/ssr`.
- `SupportAudioCall.tsx` crée un canal avec `config.private=true`, puis appelle `subscribe()` sans synchronisation explicite préalable via `supabase.realtime.setAuth(accessToken)`.
- La documentation Supabase Realtime recommande de fixer le JWT avant la souscription pour l'autorisation des canaux privés. Cette absence est une hypothèse prioritaire, mais le comportement exact du client SSR installé (`@supabase/supabase-js 2.45.4`, `@supabase/ssr 0.5.2`) doit être vérifié avant de modifier le produit.
- Ne pas élargir la politique à `authenticated` sans contrôle de topic/participant ; ne pas rendre le topic public ; ne pas contourner `naxa_support_call_realtime_access`. Le correctif doit préserver l'isolation stricte entre demandeur, Agent assigné et tiers.

## Échec actionlint / ShellCheck
- Run `44597102291` : `.github/workflows/naxa-support-livechat-e2e.yml:81:9`, ShellCheck `SC2009` sur `ps aux | grep '[t]urnserver'` dans le bloc diagnostic de l'étape TURN.
- Correction ciblée attendue : remplacer ce diagnostic par `pgrep -a -x turnserver || true` (ou équivalent compatible ShellCheck), sans modifier la logique TURN déjà validée. Puis relancer le contrôle actionlint.
- La qualité principale (tests, TypeScript, lint et build) a passé dans ce run ; seul le job actionlint a donné l'échec reporté.

## Ordre de reprise obligatoire
1. Corriger la seule alerte `SC2009` ; vérifier actionlint sur tous les workflows.
2. Auditer le client Realtime et son JWT effectif : obtenir via le navigateur la session courante et l'identité (sans jamais journaliser access token/refresh token), observer l'état de souscription et l'erreur exacte pour chacun des deux participants.
3. Ajouter une preuve discriminante avec le même JWT utilisateur : évaluer les prédicats de `naxa_support_call_realtime_access` en contexte authentifié ; enregistrer seulement le résultat booléen, le sujet utilisateur et les prédicats non sensibles, jamais le JWT.
4. Vérifier si `setAuth(session.access_token)` doit être appelé avant `channel(...).subscribe()` avec les versions installées ; tester d'abord sur Replay et dans le navigateur. Ne modifier la fonction SQL ni ses politiques que si le résultat authentifié prouve une erreur de prédicat.
5. Après acceptation Realtime pour Client ET Agent, exiger l'échange `ready → offer → answer → candidate`, puis ICE connecté, candidat local et distant `relay`, piste audio live et paquets RTP entrants/sortants des deux côtés, flux distant attaché et lecture active.
6. Corriger ShellCheck, puis relancer la recette Agents ciblée et la qualité complète. Si un contrôle échoue, reprendre audit → contradiction → cause prouvée → correction minimale → test → preuve → doc.
7. Ne déclarer vert qu'après succès de tous les critères de la portée retenue. Le son bidirectionnel doit être prouvé séparément ; `accepted`, HTTP 200 ou l'existence de credentials TURN ne sont pas une preuve audio.
8. Le test média via TURN localhost prouve le chemin CI seulement. Un relais TURN public permanent pour appareils/réseaux mobiles réels est un point d'exploitation distinct à documenter avant une éventuelle mise en service.

## Règles inchangées
- Travailler sur `main` seulement ; préserver l'historique de ce document et ajouter un nouveau point de continuité à chaque changement d'état.
- Recette exclusivement Replay ; aucun accès Production pour ces corrections ; pas de déploiement.
- Ne jamais neutraliser les assertions, assouplir les politiques RLS/Realtime, ni confondre un statut de base avec une preuve média.
- Le chantier reste **NON VERT** tant que la souscription privée Realtime et l'audio bidirectionnel réel n'ont pas passé, et que actionlint n'est pas vert.
