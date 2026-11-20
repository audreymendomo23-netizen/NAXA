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


# Extension du chantier — Support global NAXA (20 novembre 2026)

## Décision de périmètre à intégrer au chantier en cours

Le Support NAXA est un service transversal unique, accessible depuis le **Profil Client** et le **Profil Professionnel**. Il ne s'agit pas de créer deux centres de support indépendants : les deux espaces utilisent une infrastructure commune de conversations, tickets, affectation des agents, appels, permissions et traçabilité. Les parcours, catégories et informations consultables restent adaptés au profil et au dossier concerné.

Cette extension est ajoutée au chantier Support déjà ouvert et doit avancer en parallèle de la résolution des points de recette encore en attente. Elle ne remplace ni le Livechat existant, ni le mécanisme de prise atomique, ni les règles RLS/permissions. Elle ne permet pas de déclarer l'audio opérationnel avant validation de la preuve média.

### Profils et contexte d'assistance

- **Profil Client :** commandes, réservations, pharmacies, paiements, compte et sécurité, utilisation de NAXA.
- **Profil Professionnel :** gestion de pharmacie, stock et caisse, personnel, Marketplace, abonnements et gestion professionnelle.
- **Centre de support commun :** agents, superviseurs, réception et attribution des dossiers, transfert entre services, appels et suivi, historique et comptes rendus.
- Pour chaque dossier, l'agent ne voit que le contexte explicitement autorisé et nécessaire à son intervention. Un dossier Client ne donne pas automatiquement accès aux données professionnelles d'une pharmacie, et inversement. La consultation doit être limitée au dossier, au profil, à l'affectation et aux permissions de l'agent.

### Socle fonctionnel commun attendu

Les deux espaces doivent proposer, selon les droits et le contexte :
- FAQ et aide contextuelle ;
- ouverture et suivi d'une demande, Livechat et historique du support ;
- envoi de captures d'écran et de pièces jointes ;
- appel audio intégré à NAXA ;
- proposition de partage d'écran pendant une assistance, avec acceptation explicite et démarrage volontaire par l'utilisateur ;
- suivi de résolution, compte rendu et évaluation de l'assistance.

Le contenu, les catégories, les libellés, les formulaires et les autorisations sont adaptés au profil Client ou Professionnel. L'utilisateur reste dans NAXA et retrouve le Livechat après la fin de l'appel.

### Partage d'écran — règles fonctionnelles et de sécurité

Le partage d'écran est une extension native du Support NAXA, facultative et déclenchée avec consentement. L'agent peut proposer le partage ; **seul l'utilisateur concerné** (Client ou Professionnel) le démarre depuis son propre appareil et accorde l'autorisation demandée par le navigateur ou le système. L'agent ne peut jamais l'activer à distance ou silencieusement.

Règles obligatoires :
1. Consentement explicite, spécifique à la session et déclenché par l'utilisateur avant toute capture.
2. Avertissement préalable : l'écran peut révéler notifications, messages privés, données de compte ou autres informations sensibles ; inviter l'utilisateur à fermer/masquer ces contenus avant le partage.
3. Commande permanente et visible **« Arrêter le partage »** côté utilisateur ; arrêt immédiat à sa demande.
4. Arrêt automatique lorsque l'appel ou la session de support se termine, est interrompu ou perd ses autorisations.
5. Aucun enregistrement automatique de l'écran, de l'appel audio ou de la vidéo.
6. Accès à la session visuelle réservé à l'agent effectivement affecté au dossier et autorisé ; révocation immédiate à la fin ou au transfert du dossier.
7. Journaliser au minimum le consentement, le démarrage, l'arrêt, l'identité de l'agent et les horodatages, sans enregistrer le contenu visuel.
8. Ne jamais demander à l'utilisateur d'afficher ou de communiquer son mot de passe ; prévenir contre l'affichage de coordonnées bancaires et de données privées.
9. Aucun contrôle à distance du téléphone ou de l'ordinateur, aucune saisie ni action de l'agent sur l'appareil de l'utilisateur.
10. Vérifier côté serveur l'identité, l'affectation, les permissions et l'état de l'appel ; une simple dissimulation du bouton dans l'interface ne constitue pas une protection.

Le partage repose sur une capture consentie (notamment Screen Capture API / `getDisplayMedia()` dans les environnements compatibles) transportée dans la session WebRTC NAXA. La compatibilité doit être progressive : ordinateur comme première cible de validation, puis vérifications séparées sur Android et iOS, en tenant compte des limites du navigateur et du mode d'installation. L'indisponibilité d'une API sur un appareil doit produire une explication et un retour au Livechat, jamais un contournement du consentement.

### Ordre fonctionnel retenu

- **Niveau 1 — socle obligatoire :** Livechat, suivi des demandes et appels audio intégrés à NAXA.
- **Niveau 2 — extension prioritaire du chantier :** partage d'écran volontaire, sécurisé et limité à la session de support. Son cadrage et son intégration doivent être traités dès maintenant avec la correction de la recette audio, sans déclarer son fonctionnement tant que les tests réels ne sont pas passés.
- **Niveau 3 — extension ultérieure :** vidéo avec caméra, à proposer seulement après évaluation de sa valeur et de la compatibilité ; elle n'est pas un prérequis pour la première livraison audio + partage d'écran.
- **Hors périmètre :** contrôle à distance, accès silencieux à l'écran, activation distante du microphone/de la caméra/du partage, enregistrement automatique, dépendance obligatoire à WhatsApp, Google Meet ou Teams.

## Points de recette à reprendre en parallèle — ne pas confondre cadrage et validation

### A. Audio WebRTC bidirectionnel — toujours NON PROUVÉ

L'état précis est celui du diagnostic ci-dessus (run `44597102023`) : refus d'autorisation du canal privé Realtime, `RTCPeerConnection` encore `new`, aucun sender/receiver, aucun candidat ICE et aucun paquet RTP. Le démarrage TURN local et le GET ICE HTTP 200 ne prouvent pas le transport média.

La correction doit donc établir l'authentification Realtime correcte pour le Client et l'Agent, préserver l'isolation stricte du canal, puis prouver la négociation WebRTC et les flux audio RTP entrants/sortants des deux côtés via TURN. Ne pas neutraliser les assertions ni élargir les politiques.

### B. Bouton « Raccrocher » — délai de 15 secondes à revalider

Le document source de cette extension signale un timeout de 15 secondes sur le bouton « Raccrocher ». Ce point n'est pas couvert par les preuves du dernier run et ne doit pas être considéré comme corrigé par le simple fait que l'interface affiche le bouton ou que le nettoyage E2E termine l'appel.

À la reprise :
- reproduire séparément le délai à partir du clic utilisateur, pour le Client et pour l'Agent ;
- tracer le temps jusqu'à la confirmation visible, la réponse HTTP et l'état persistant du call ;
- distinguer un retard de l'interface, de l'API, de Realtime ou de la fermeture des transports ;
- vérifier qu'un double clic / retry ne termine pas deux fois l'appel et que l'appel, les ressources média et la session sont effectivement clôturés ;
- ne conclure à PASS qu'après une mesure horodatée et une assertion E2E stable.

État documentaire de ce point : **À REVALIDER** — signalement source pris en compte, nouvelle preuve de reproduction/correction non encore enregistrée dans ce checkpoint.

## Critères de recette additionnels pour le Support global et le partage d'écran

La fonctionnalité ne sera déclarée prête qu'après des tests distincts :
- disponibilité des mêmes fonctions de base depuis un compte Client et depuis un compte Professionnel autorisé ;
- séparation des catégories, du contexte et des données accessibles selon le profil et le dossier ;
- refus d'accès d'un agent non affecté, d'un agent sans permission, d'un autre professionnel et d'un utilisateur tiers ;
- proposition de partage par l'agent, mais démarrage impossible tant que l'utilisateur n'a pas lui-même accepté et lancé le partage ;
- réception du flux écran uniquement par l'agent affecté ; absence de flux pour les autres sessions ;
- arrêt utilisateur, arrêt à la fin de l'appel, révocation d'accès et transfert de dossier ;
- absence d'enregistrement automatique et absence de contrôle distant ;
- journalisation des événements/consentements sans stockage du contenu partagé ;
- scénarios de refus de permission, périphérique non compatible, perte réseau et retour au Livechat ;
- essais de compatibilité distincts ordinateur, Android et iOS, sans extrapoler le résultat d'un navigateur desktop à tous les appareils.

## Statut consolidé après cette décision

| Élément | État à ce checkpoint |
|---|---|
| Livechat, RLS et permissions agents | PASS dans les runs antérieurs référencés ; à préserver lors de l'extension |
| Cycle de vie Agent / appels acceptés et ringing | PASS dans le run ciblé `44593655149` |
| Appel audio bidirectionnel réel | **BLOQUÉ / NON PROUVÉ** — autorisation Realtime et RTP |
| Timeout 15 s du bouton « Raccrocher » | **À REVALIDER** — aucune nouvelle preuve dans ce checkpoint |
| Support unifié Client + Professionnel | **PÉRIMÈTRE VALIDÉ, IMPLÉMENTATION / E2E À AUDITER** |
| Partage d'écran volontaire et sécurisé | **DÉCISION / EXIGENCES VALIDÉES, IMPLÉMENTATION / E2E NON PROUVÉES** |
| Appel vidéo caméra | **EXTENSION ULTÉRIEURE, NON PRIORITAIRE** |
| Actionlint / ShellCheck | **ÉCHEC À CORRIGER** — `SC2009` du run `44597102291` |

## Reprise opératoire actualisée

1. Corriger `SC2009` sans toucher au comportement TURN et faire repasser actionlint.
2. Reprendre la cause Realtime avec les sessions Client et Agent réelles ; prouver les autorisations du même JWT, puis seulement appliquer le correctif justifié.
3. Relancer l'audio bidirectionnel avec contrôle ICE relay, pistes et RTP dans les deux sens.
4. Reproduire et mesurer séparément le timeout de 15 secondes sur « Raccrocher » ; corriger la cause démontrée et tester les deux participants.
5. Auditer le code actuel du Support afin d'identifier les composants, routes, tables, politiques, API et composants partagés Client/Professionnel ; réutiliser l'infrastructure existante plutôt que créer un deuxième système.
6. Implémenter le partage d'écran dans le même service de session, avec consentement utilisateur, permissions côté serveur, réception par l'agent affecté, arrêt et traçabilité. Faire progresser en parallèle la conception et l'intégration sans marquer la fonction active avant les preuves.
7. Ajouter les scénarios E2E d'isolation, consentement, arrêt, fin d'appel, transfert et non-enregistrement, puis valider la compatibilité par type d'appareil.
8. Mettre à jour ce document après chaque preuve ; ne déclarer le Support global vert qu'après validation de la portée retenue, sans assimiler une décision de périmètre à une fonctionnalité livrée.

Les règles de gouvernance de la continuité restent inchangées : branche `main` uniquement, environnement Replay pour la recette, aucune modification Production et aucun déploiement pendant ces travaux.


# Reprise d'implémentation — diagnostic ciblé audio / accès Support professionnel (20 novembre 2026)

## Contradiction et causes comparées

Le refus Realtime observé le 19 novembre (« Unauthorized … Channel topic ») ne prouvait pas à lui seul que la politique SQL était fautive. Les possibilités examinées étaient :
- **JWT absent ou pas encore restauré dans le client navigateur au moment du subscribe** : probabilité élevée, car le composant souscrivait immédiatement après l'état `accepted`, sans attendre `auth.getSession()` ni définir explicitement le JWT Realtime.
- **Prédicat SQL / rôle / participant incorrect** : possible, mais aucune preuve ne permettait de l'affirmer ; fonction et politiques existaient et vérifiaient rigoureusement l'identité et les permissions.
- **Topic mal formé / extraction UUID erronée** : contredit par le format du topic émis et la longueur du préfixe (18 caractères, UUID à partir du caractère 19).
- **Ticket déjà clôturé / profil inactif / agent non autorisé** : non établi pour l'instant de l'erreur ; l'appel était accepté et les deux heartbeats persistés.
- **TURN ou RTP** : contredit comme cause première, car aucun peer media ni candidat n'était encore créé au moment du refus ; l'API ICE délivrait une configuration HTTP 200.

La documentation Supabase confirme que le JWT transmis à Realtime est utilisé pour l'autorisation des canaux privés et les politiques RLS ; `realtime.setAuth(token)` définit ce JWT. Références officielles consultées : https://supabase.com/docs/reference/javascript/setauth et https://supabase.com/docs/guides/realtime/authorization. Le schéma `realtime` est protégé contre les DDL personnalisés : seules les politiques sur `realtime.messages` doivent être gérées dans le schéma public/privé approprié (changelog Supabase du 14 juillet 2026).

## Correctifs de code préparés dans ce checkpoint

- Attendre la session Supabase navigateur, vérifier que son `user.id` correspond au demandeur ou à l'Agent de l'appel via l'API d'état, puis exécuter `supabase.realtime.setAuth(session.access_token)` avant la souscription privée.
- Réactualiser le JWT Realtime lors des événements de renouvellement de session, sans jamais journaliser le jeton.
- Afficher l'état de souscription Realtime séparément de l'état ICE/audio ; permettre de recréer le canal et le peer après une erreur plutôt que de garder un `channel.current` obsolète.
- Le raccrochage attend désormais la transition PATCH serveur en premier ; l'ACK Broadcast n'est plus un verrou avant la clôture. Le pair distant détecte la transition par le polling d'état existant.
- Le test E2E Agent vérifie la souscription privée des deux participants et mesure le temps clic→réponse HTTP du raccrochage avec seuil de 5 secondes.
- L'alerte ShellCheck `SC2009` est corrigée uniquement dans le diagnostic du processus Coturn (`pgrep -a -x turnserver`), sans changer le bootstrap/port/secrets TURN.
- Les pages d'aide Pharmacie et Promoteur disposent maintenant d'un accès direct vers `/assistance`, tout en conservant le chat Client↔Pharmacie distinct. Le service /assistance partagé n'est pas dupliqué.

## Limites de compatibilité partage écran à respecter

La fonction web `getDisplayMedia()` exige un contexte sécurisé et un geste explicite de l'utilisateur ; MDN la classe à disponibilité limitée et documente la compatibilité navigateur. La cible initiale est l'ordinateur, avec repli clair vers Livechat/audio lorsque l'API est absente. Aucune promesse Android/iOS n'est admise sans recette sur appareils réels. Références : https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia et https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API/Using_Screen_Capture.

## Résultat à établir par les prochains runs

À ce stade, ces modifications sont des corrections candidates fondées sur le code et la documentation, pas encore un résultat vert. Le run ciblé devra confirmer :
1. Client ET Agent affichent `Canal sécurisé connecté`.
2. Les deux côtés échangent offer/answer/candidates et ICE passe à connected.
3. Les deux côtés ont un candidat local et distant `relay`, des pistes vivantes et paquets RTP dans les deux sens, lecture distante effective.
4. Le clic « Raccrocher » produit une transition serveur persistée en moins de 5 secondes.
5. `actionlint` valide tous les workflows.
6. Les nouvelles entrées Client/Professionnel accèdent au même Support NAXA sans exposer le chat Client↔Pharmacie.

Le Support global et le partage d'écran restent NON VERT tant que l'extension de partage écran, son audit serveur et ses E2E dédiés n'ont pas été livrés et validés.


## Itération de recette 1 — résultat et cause confirmée (20 novembre 2026)

- Run `44645869735` : `actionlint` PASS ; suite de tests Node PASS, 618/618 ; étape TypeScript/build FAIL sur une incompatibilité de type connue : dans la version verrouillée `@supabase/supabase-js`, `supabase.realtime.setAuth(token)` retourne `void`, et non une Promise. L'appel au `.catch()` était donc invalide.
- Run `44645869710` : la recette s'arrête à la construction Next.js sur cette même erreur de type, avant l'exécution de la recette browser Agents ; ce run ne fournit donc aucune nouvelle preuve Realtime/WebRTC.
- L'étape « Démarrer TURN éphémère » est marquée PASS. Le message SQLite `/var/lib/turn/turndb` apparaît dans la sortie Coturn, mais n'a pas provoqué l'échec du step ; ne pas modifier le bootstrap TURN sur cette seule base. Le contrôle du socket UDP a bien passé.
- Correctif ciblé : traiter `setAuth()` comme un appel synchrone et intercepter uniquement une exception synchrone dans le listener de renouvellement du JWT. Ne pas changer le flux de souscription initiale déjà précédé de `getSession()` et de `setAuth()`.
- Reprise : relancer qualité + build + E2E Agents ciblé ; seulement après obtention des logs Realtime des deux participants décider si la cause JWT est confirmée ou si l'investigation doit se déplacer vers la configuration Realtime ou le prédicat SQL.


# Reprise partage écran — checkpoint Replay (20 novembre 2026)

## Audio déjà confirmé vert
Parent conservé `df7f105212efbba32db1e492b86888ae9ee76985`. Les runs `44646612311` (Replay E2E) et `44646612255` (qualité) ont validé le canal privé authentifié, l’audio WebRTC bidirectionnel via TURN relay, des paquets RTP dans les deux sens, le raccrochage en 668 ms, 618 tests et qualité PASS.

## Partage écran
- Le demandeur (Client ou professionnel) seul capture sa propre source ; l’Agent reçoit et affiche, sans contrôle distant.
- Double étape : case d’accord explicite NAXA, puis sélection native du navigateur. `getDisplayMedia()` est appelé dans le geste du clic, avant tout réseau.
- Transceiver vidéo pré-négocié dans le SDP audio initial ; piste activée par `replaceTrack`, sans renégociation.
- Arrêt explicite, fin de piste, démontage du composant et fermeture automatique de session à la fin de l’appel.
- Aucun enregistrement, image/frame, vidéo, SDP ou candidat ICE stocké. Audit append-only : code, identifiant de session aléatoire, motif allowlisté.

## Migration Replay
Migration `20261120005321_naxa_support_screen_share_audit` appliquée au seul projet Replay. Codes consented/started/stopped/denied, index idempotent, RPC réservé à `service_role`, trigger de fermeture. Vérification : service_role=true ; authenticated=false ; anon=false ; trigger présent.

## Accès commun Client et professionnel
Le widget NAXA, déjà partagé dans les deux profils, fournit `Mes dossiers → /assistance`. La page Support commune porte le composant appel audio/partage écran. La messagerie Client↔Pharmacie reste indépendante.

## Recette ciblée
Le marqueur `[support-team-only]` saute seulement le scénario autonome Client↔Admin ; la recette professionnelle existante et la recette Agents s’exécutent. La recette Agents doit prouver l’interdiction côté Agent, le consentement côté demandeur, la réception de paquets vidéo RTP, l’arrêt et l’ordre d’audit.
CI utilise une capture canvas synthétique : elle valide le transport WebRTC et l’audit applicatif, pas le sélecteur natif sur un véritable écran ni les essais physiques Android/iOS. Verdict global NON VERT jusqu’au succès des runs qualité et Replay ciblés.


# Correctif RPC PostgREST partage écran — 20 novembre 2026

## Contradiction trouvée après le premier commit
- La route serveur utilise `supabaseAdmin().rpc("naxa_support_call_screen_share_event", ...)`.
- Le factory `supabaseAdmin()` crée le client Supabase sans `.schema("private")` : le RPC PostgREST est donc résolu dans le schéma exposé `public`, pas directement dans `private`.
- Le premier déploiement SQL avait créé le RPC domaine dans `private` uniquement. Le journal et les permissions étaient corrects, mais la route API ne pouvait pas résoudre ce nom via son client par défaut.

## Correction appliquée à Replay
- Migration Replay `20261120013251_naxa_support_screen_share_public_rpc`.
- Création de `public.naxa_support_call_screen_share_event(...)`, wrapper `SECURITY DEFINER` avec `search_path=''` qui délègue au RPC privé.
- `EXECUTE` accordé uniquement à `service_role`; privilèges révoqués à `public`, `anon` et `authenticated`.
- Vérification SQL après application : service_role=true ; authenticated=false ; anon=false ; définition du wrapper appelle la fonction privée.
- Cette migration et son test SQL sont maintenant versionnés dans le dépôt. Aucun accès direct au schéma privé n’est exposé aux utilisateurs.

Le chantier reste NON VERT tant que la recette Agents n’a pas prouvé la séquence navigateur consentement → vidéo RTP bidirectionnelle unidirectionnelle demandeur→Agent → arrêt → audit serveur, et que le scénario professionnel Replay n’a pas terminé.


# Ajustement délai navigation Promoteur mobile — 20 novembre 2026

La recette navigation indépendante `44653637307` a validé le Promoteur desktop et le périmètre Comptable, puis a échoué au chargement initial de `/pharmacie/promoteur` dans un nouveau contexte mobile : `page.goto` a expiré à 15 s, avant l'ouverture du menu. Le serveur Next.js était prêt et aucun défaut serveur explicite n'a été rapporté. Correctif du harnais uniquement : délai de navigation spécifique à cette ouverture mobile porté à 30 s ; les délais d'interaction/assertion restent 15 s. Aucun contrôle métier n'est supprimé ni assoupli. Le run Promoteur relancé sur le commit suivant doit confirmer ce point.


# Correctif assertions navigation — 20 novembre 2026

Le run `44654715657` a dépassé le blocage initial du chargement mobile Promoteur (délai de navigation spécifique 30 s). Le parcours Comptable a validé ses vues, le cycle Partenaire/Examens a passé ses assertions, et le parcours Client a validé Favoris, Panier et Recherche Marketplace. Le harnais s'est ensuite arrêté sur `ReferenceError: expect is not defined` dans deux assertions du filtre ville B2 (lignes 1268–1269) : ce script CommonJS utilise `node:assert/strict` et Playwright mais n'importe pas `expect`. Correction : remplacer ces deux appels par `locator.inputValue()` + `assert.equal`, avec les mêmes valeurs attendues. Aucun contrôle métier n'est supprimé ou assoupli ; aucune modification applicative.


# Diagnostic contradictoire partage écran — 20 novembre 2026

## Faits établis avant correction
- Le run Agents `44653637342` (commit fonctionnalité initiale, avant le wrapper RPC) avait validé l'audio WebRTC bidirectionnel via TURN, puis avait attendu 15 s sur `Écran partagé par le demandeur`. Le DOM montrait encore `<video class="hidden">` : aucun `track` vidéo distant n'avait activé l'affichage.
- Le correctif RPC PostgREST a été appliqué à Replay (migration `20261120013251_naxa_support_screen_share_public_rpc`) et les ACL vérifiées par SQL : service_role autorisé, authenticated/anon refusés. Le run suivant `44654715600` a échoué plus tôt dans le test Promoteur/Livreur et a donc sauté le scénario Agents ; il ne prouvait pas le correctif RPC.
- L'ancien test ne capturait pas de diagnostics sur les transceivers SDP au moment du remplacement de piste. Il ne permettait donc pas de distinguer une capture absente, un sender non négocié, un signalement perdu ou un rendu vidéo bloqué.

## Raisonnement par contradiction / cause racine
- La capture E2E synthétique est disponible dans Chromium, la case NAXA est cochée et le bouton déclenche `getDisplayMedia()` dans le geste utilisateur. Une absence de capture n'expliquait donc pas à elle seule le fait que l'Agent ne recevait aucun track.
- Le RPC public manquant explique une erreur d'audit après capture, mais n'explique pas pourquoi le `<video>` distant reste caché avant le contrôle d'audit ; le wrapper RPC était en outre appliqué ensuite à Replay.
- Le code créait un transceiver vidéo via `addTransceiver()` sur les deux pairs. Or WebRTC ne réassocie pas au m-line distant un transceiver disassocié créé par `addTransceiver()` lors de `setRemoteDescription(offer)` ; il crée un transceiver négocié distinct. Le demandeur conservait le sender de l'instance disassociée et y appelait `replaceTrack()` : le sender n'était pas celui du m-line vidéo de l'offre. Cette contradiction correspond au symptôme observé : audio fonctionnel, SDP stable, mais aucun RTP vidéo entrant.
- Référence normative : W3C WebRTC, section de traitement d'une offer distante ; les transceivers disassociés issus de `addTrack()` peuvent être associés, contrairement à ceux créés par `addTransceiver()` : https://www.w3.org/TR/webrtc/ . La méthode `replaceTrack()` ne dispense pas d'un sender correctement associé au m-line négocié : https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack.

## Corrections appliquées au code
- Seul l'Agent, qui crée l'offre, ajoute le transceiver `video/recvonly`.
- Le demandeur ne crée plus de transceiver vidéo parasite : après réception de l'offre et création de la réponse, il retrouve le transceiver vidéo réellement associé à un `mid`, vérifie sa direction négociée sortante, puis conserve son `RTCRtpSender`.
- Avant tout `replaceTrack()`, le code vérifie à nouveau que le sender appartient au transceiver vidéo associé au SDP.
- Le rendu distant appelle explicitement `play()` sur le lecteur vidéo muet et remonte une erreur si le navigateur bloque la lecture.
- Le diagnostic a également révélé un défaut UI indépendant : l'aperçu local était attaché avant le montage conditionnel de l'élément vidéo ; un effet le relie maintenant après le rendu de l'élément.

## Périmètre de recette renforcé
- Le scénario Chromium vérifie le transceiver vidéo SDP avant capture, l'absence de partage sans consentement, le refus Agent (403), le sender/receiver, les paquets et octets RTP vidéo, le rendu 640×360 et l'arrêt manuel.
- Un scénario distinct avec le compte professionnel Replay Comptable doit prouver le même parcours professionnel→Agent et l'arrêt serveur automatique à la fin de l'appel, via l'événement append-only `screen_share_stopped` avec `actor_user_id IS NULL` et `reason=call_ended`.
- Le sélecteur natif de l'ordinateur et les essais physiques Android/iOS restent hors de la capture canvas CI ; aucune compatibilité mobile physique n'est déclarée sans essai matériel.
- Aucun déploiement ni changement Production. Verdict reste NON VERT jusqu'aux nouvelles preuves qualité et Replay.


# Diagnostic ICE avant partage écran — run 44658725782 (20 novembre 2026)
- Le build, TURN bootstrap et démarrage serveur Replay sont PASS. La recette Agents échoue avant le partage écran, dans la preuve audio Client : `connectionState=failed`, `iceConnectionState=disconnected`, `iceGatheringState=complete`, `signalingState=stable`, zéro paquet RTP entrant/sortant, aucun couple sélectionné ; un candidat local relay est visible, aucun candidat distant.
- Les deux participants étaient authentifiés sur le canal privé Realtime ; le client reçoit l'état d'appel accepted et l'endpoint ICE répond 200. Cela exclut uniquement l'authentification initiale et l'absence de credentials TURN ; cela ne prouve pas la livraison de l'offre/réponse ni des candidats.
- Le journal Coturn affiche un défaut SQLite sur `/var/lib/turn/turndb`, mais le serveur initialise ses relais et Chromium recueille un candidat relay local. Ce message n'est donc pas encore une cause établie.
- Aucun refus Realtime n'apparaît dans le journal consulté pour cette fenêtre. On ne peut pas conclure que le canal transporte chaque candidat ICE.
- Causes encore discriminantes : réponse SDP non envoyée (y compris erreur du contrôle `currentDirection`), candidat ICE non émis par l'Agent, candidat perdu/non reçu via Broadcast, ou erreur `addIceCandidate` liée au MID/m-line/ufrag. Aucune correction réseau ou RLS n'est appliquée avant ces traces.
- Le harnais est instrumenté pour la prochaine exécution : événements locaux ICE, erreurs `icecandidateerror`, appels et rejets `setRemoteDescription`/`setLocalDescription`/`addIceCandidate`, états ICE/signaling des deux pairs, m-lines et message UI. La preuve des deux pairs utilise désormais `Promise.allSettled` afin que l'erreur du premier ne masque pas l'état du second.
- Partage vidéo non testé dans ce run. Chantier toujours NON VERT ; aucune modification Production ni déploiement.


# Cause racine ICE/SDP confirmée — run 44660599940 (20 novembre 2026)

## Preuves navigateur
- Les deux pairs ont reçu les signaux initiaux : côté demandeur `setRemoteDescription(offer)` et `setLocalDescription(answer)` ont réussi ; deux candidats relay distants ont été acceptés par `addIceCandidate` sur les m-lines 0 et 1.
- L'Agent est resté en `signalingState=have-local-offer`, avec `currentDirection=null` sur le transceiver vidéo ; sa réponse distante n'est jamais arrivée.
- Le demandeur a affiché l'erreur `Le SDP de l’appel ne contient pas de transceiver vidéo sortant associé`. Son transceiver vidéo avait `mid=0`, `direction=recvonly`, `currentDirection=inactive`, sans piste sender. Le test n'a donc jamais envoyé l'answer à l'Agent.
- L'Agent avait émis des candidats relay pour les deux m-lines ; le pair distant a aussi observé des candidats prflx. Le diagnostic ne soutient donc pas une panne du serveur TURN ni une perte globale de Broadcast. Le défaut est la direction du m-line dans l'answer.

## Cause
Après `setRemoteDescription(offer)`, le navigateur crée/associe le transceiver vidéo correspondant au m-line distant. Sa direction locale préférée est `recvonly` par défaut. Comme aucun flux écran n'existe encore (sélection autorisée uniquement après consentement utilisateur), `createAnswer()` a produit une direction vidéo `inactive`. Le garde-fou `currentDirection.includes("send")` a alors correctement refusé d'envoyer une answer qui ne pourrait jamais transmettre la vidéo. La vérification était correcte ; il manquait la configuration du sens d'émission avant la création de la réponse.

## Correction
- Après réception de l'offre, le Client retrouve le transceiver vidéo associé (MID non nul) et définit `direction = "sendonly"` avant `createAnswer()`.
- Le navigateur négocie donc à l'avance un m-line vidéo sortant sans démarrer de capture. Le flux n'est attaché qu'après consentement et choix natif de la source, via `RTCRtpSender.replaceTrack()`.
- Après `setLocalDescription(answer)`, le code exige toujours `currentDirection` contenant `send`, puis lie ce sender négocié. L'answer est transmise seulement après ce contrôle.
- L'instrumentation du harnais corrige aussi le découpage des lignes SDP afin de conserver les traces `m=`, `a=mid`, directions et ICE ufrag dans les prochains diagnostics.
- Recherche documentaire vérifiée : MDN indique que `direction` exprime la direction préférée et sert à générer offer/answer, tandis que `currentDirection` ne reflète la direction négociée qu'après la fin de la négociation ; W3C définit `currentDirection` comme direction effectivement négociée. Références : https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpTransceiver/direction ; https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpTransceiver/currentDirection ; https://www.w3.org/TR/webrtc/.
- Verdict reste NON VERT avant le nouveau run : audio bidirectionnel via ICE, émission RTP vidéo, réception/affichage Agent, audit des événements, arrêt local, arrêt à clôture, puis scénario professionnel.


# Affichage du partage conditionné aux vraies trames — 20 novembre 2026
- L'offre/answer pré-négociant maintenant un transceiver vidéo, le navigateur Agent peut créer son `RTCRtpReceiver.track` avant que le demandeur choisisse une source. Le simple événement `track` prouve l'existence du récepteur négocié, pas que les images de l'écran sont déjà transmises.
- Correction UI : l'Agent attache le flux au lecteur mais garde l'état « aucun écran partagé » tant que la piste distante est muette. Il n'affiche l'écran actif qu'au premier événement `unmute`, et revient à l'état inactif sur `mute` ou `ended`. La propriété `muted` n'est utilisée pour l'affichage immédiat que lorsqu'elle existe explicitement et indique `false`.
- Recette E2E renforcée : après négociation audio et avant consentement, elle exige que le texte « Aucun écran partagé par le demandeur » soit visible et que la vidéo distante reste cachée. Après consentement, elle vérifiera les trames 640×360 et les octets/paquets RTP.
- Référence : MDN décrit `track` comme l'ajout d'une piste au receiver, tandis que `mute`/`unmute` signalent le début et l'interruption de disponibilité des données média : https://developer.mozilla.org/en-US/docs/Web/API/RTCTrackEvent ; https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/mute_event ; https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/unmute_event.
- Le verdict final attend toujours la recette complète Client puis Comptable et l'essai matériel mobile séparé.


# Signal d'arrêt explicite vers l'Agent — 20 novembre 2026
- Nouvelle preuve : avec `mute`/ `unmute`, l'Agent affichait correctement « aucun écran » avant consentement, mais le run `44662151666` échouait encore après l'arrêt manuel : le navigateur ne signalait pas la mutation du receiver dans le délai du test alors que l'API avait persisté `screen_share_stopped`.
- Cause fonctionnelle : `replaceTrack(null)` peut laisser le transceiver et son `RTCRtpReceiver.track` négociés et vivants. Le receiver peut donc ne pas émettre immédiatement `mute`/ `ended`; le seul signal média n'est pas suffisant pour synchroniser l'état UI distant.
- Correction : le demandeur émet maintenant un signal privé `screen-share-stopped` après avoir retiré la piste, en complément du journal serveur. L'Agent met en pause et masque son aperçu, mais conserve `srcObject` pour permettre le redémarrage du partage sur le même m-line sans renégociation. Les événements `mute`/`unmute`/`ended` restent des mécanismes de secours.
- Un verrou `screenShareBusy` couvre toute l'opération d'arrêt afin d'empêcher un nouveau démarrage avant la fin du signal et de l'audit. Le contrôle serveur reste la source de vérité de l'audit `screen_share_stopped`.
- La recette doit confirmer : arrêt manuel → signal reçu → aperçu distant masqué ; redémarrage éventuel sur même appel ; fin d'appel avec arrêt trigger `call_ended`.
- Aucune migration ni aucun changement Production.


# Correctif attente du transport agrégé — run 44663200455 (20 novembre 2026)

## Faits de la recette
- Le parcours Client est maintenant PASS jusqu'au bout : audio TURN bidirectionnel, offre vidéo `recvonly` et réponse `sendonly`, RTP vidéo Client→Agent, dimensions reçues 640×360, consentement/démarrage/arrêt dans le journal SQL, signal privé `screen-share-stopped` reçu et aperçu Agent masqué, raccrochage serveur en 902 ms.
- Le scénario file centrale est également PASS : appel queued, acceptation Agent B, heartbeats, clôture.
- Le scénario professionnel Comptable a créé un dossier caisse, a lancé un appel et a bien échangé les réponses SDP ; sur l'Agent C, l'état observé au premier instant était `iceConnectionState=connected`, `connectionState=connecting`, `signalingState=stable`, couple TURN `succeeded`, mais zéro paquet RTP à cet instant. Le harnais s'est arrêté immédiatement sur l'assertion `connectionState === "connected"`.

## Diagnostic contradictoire
- L'ICE connecté prouve qu'un couple de candidats utilisable est trouvé ; il ne suffit pas à conclure que toute la connexion WebRTC est opérationnelle.
- MDN précise que `RTCPeerConnection.connectionState` agrège l'état de tous les transports ICE et DTLS. L'état `connecting` est compatible avec un `iceConnectionState` déjà `connected`, car un des transports est encore en cours d'établissement.
- Le helper `rtcAudioProof` quittait son attente dès que `iceConnectionState` devenait connected, puis exigeait sans délai `connectionState=connected`. Il existait donc une course de synchronisation dans le harnais : l'assertion pouvait s'exécuter entre l'ICE réussi et la transition agrégée/DTLS. Les logs ne démontrent pas à ce stade une panne audio ou TURN du profil Comptable.
- Référence vérifiée : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState ; la propriété `iceConnectionState` porte uniquement sur l'agent ICE/STUN/TURN : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/iceConnectionState.

## Correction du harnais
- `rtcAudioProof` attend maintenant uniquement un état terminal de `pc.connectionState` (`connected`, `failed` ou `closed`) ; ICE connecté ne débloque plus prématurément l'assertion.
- Si le transport agrégé ne devient pas terminal dans la limite de 30 s, les états SDP/ICE, candidates, pistes et stats RTP restent inclus dans l'erreur détaillée.
- La preuve exige ensuite les pistes audio vivantes et les paquets RTP dans les deux sens ; aucun seuil métier n'est assoupli.
- Le contrat statique vérifie que le helper ne court-circuite plus l'attente sur le seul ICE.
- Verdict reste NON VERT jusqu'à la nouvelle recette professionnelle complète : audio stable, consentement, vidéo RTP, arrêt/clôture auto, audit `call_ended`, nettoyage ; et pipeline qualité vert.


# Correctif assertion de fin d'appel dans l'UI Agent — 20 novembre 2026

## Faits établis — run `44664163641` sur `db62a34`
- Les deux parcours Client et Comptable ont prouvé audio RTP bidirectionnel via TURN relay et vidéo RTP 640×360 reçue par l'Agent.
- Le parcours Client a prouvé l'arrêt manuel et le signal distant `screen-share-stopped`.
- Le parcours Comptable a prouvé le trigger de fin d'appel : événements `screen_share_consented`, `screen_share_started`, puis `screen_share_stopped` avec `actor_user_id IS NULL` et `reason=call_ended`, au même instant que `call_completed`.
- La seule panne de ce run était une attente Playwright sur le texte `Aucun écran partagé par le demandeur` après la fin d'appel. Le composant affiche la prévisualisation Agent uniquement lorsque `status === "accepted"` ; dès que le polling reçoit `completed`, ce bloc est volontairement démonté. Le test attendait donc un libellé qui ne doit plus exister en état terminal. Ce n'est pas une vidéo encore visible ni un trigger absent.

## Correction du contrat E2E
- Après la clôture serveur, la recette attend maintenant le message terminal réel `L’appel est terminé : completed.`.
- Elle vérifie ensuite qu'aucun élément `video[aria-label="Écran partagé par le demandeur"]` visible ne subsiste et que le libellé actif « Écran partagé par le demandeur » a disparu.
- Elle conserve la vérification d'audit SQL `consented → started → stopped`, l'acteur SQL nul et le motif `call_ended`. Aucun contrôle média ou de sécurité n'est supprimé ou abaissé.
- Le contrat statique protège la nouvelle assertion pour éviter de réintroduire l'attente d'un bloc UI qui doit être démonté après clôture.
- Verdict reste NON VERT jusqu'à un run complet vert, incluant nettoyages et build.


# Ajustement du contrat statique — run qualité `44665514319` (20 novembre 2026)
- Le premier run après la correction d'assertion UI a exécuté 618 tests ; 617 PASS et un test de contrat a échoué avant build.
- Cause exacte : casse dans le motif statique seulement. Le texte E2E utilise `L’état de partage actif doit disparaître avec la clôture de l’appel.` (minuscule après l'apostrophe), alors que le contrat recherchait `État` majuscule. Le parcours fonctionnel et son assertion n'ont pas échoué.
- Correction : le contrat recherche maintenant le fragment exact en minuscule `état de partage actif doit disparaître`. Aucun seuil ni contrôle n'est modifié.
- Le run Replay correspondant est toujours en cours à l'étape de build ; aucune donnée de recette n'a été déclarée verte sur la base du test statique seul.

# Audio Comptable : émission RTP et trigger d'arrêt système — 20 novembre 2026

## Run Replay 44665713515 sur d3a89e4
- Client audio/vidéo et file centrale : PASS.
- Comptable : les deux pairs atteignent connectionState=connected, iceConnectionState=connected, SDP stable et couple TURN relay réussi ; pistes audio distantes vivantes et lecteur non suspendu, mais compteurs RTP audio nuls pendant 15 secondes. Le run échoue avant l'autorisation de partage d'écran.
- Le contrôle n'est pas assoupli. Le harnais ajoute la journalisation du sender/receiver audio, de l'état de l'oscillateur, du nœud MediaStreamDestination, de ses pistes et des lignes RTP détaillées. La destination et son stream sont conservés fortement référencés afin d'éliminer la collecte du nœud de sortie synthétique comme variable d'exécution.

## Écart du trigger Replay
- La définition installée de private.naxa_support_call_close_screen_shares() utilisait new.requester_user_id pour actor_user_id, contrairement à la migration d'origine, qui attend NULL pour un arrêt automatique.
- Nouvelle migration additive 20261120040000_naxa_support_screen_share_auto_stop_system_actor.sql : remplace la fonction avec actor_user_id=NULL, conserve SECURITY DEFINER, search_path='', révoque l'exécution directe des rôles JWT et recrée le trigger.
- Le contrat SQL inspecte la définition installée et rejette l'attribution de l'arrêt automatique au demandeur. Le scénario Comptable conserve l'assertion actor_user_id IS NULL et reason=call_ended.
- Cette migration s'applique uniquement à Supabase Replay. Production reste inchangée.

# Contrat de priorité d'appel vérifié sans franchir la fenêtre — run 44667093303
- L'E2E s'arrêtait avant le Comptable : l'assertion d'acceptation anticipée par Agent B recevait 200 au lieu de 409.
- L'appel avait pourtant été créé 45 secondes plus tôt. Le harnais attendait l'affichage Client puis le heartbeat (qui peut durer jusqu'à 15 s) avant de tester l'acceptation non prioritaire. Cette séquence peut franchir la fenêtre de priorité de 20 s.
- Le RPC public naxa_support_call_accept vérifie fallback_at > clock_timestamp() avant de refuser un Agent autre que celui affecté. Après l'expiration, un Agent disposant de queue_view peut légitimement reprendre l'appel ; le 200 et l'événement call_reassigned étaient donc conformes à la fenêtre expirée, pas la preuve que l'API la contournait.
- Correction du harnais : la tentative Agent B est faite immédiatement après la réponse POST de création de l'appel, avant UI et heartbeat. L'assertion 409 vérifie maintenant le vrai cas pré-fallback ; le contrôle du heartbeat 403 est conservé.
- La recette doit ensuite confirmer que l'Agent A prend l'appel, puis dérouler les parcours Client et Comptable.