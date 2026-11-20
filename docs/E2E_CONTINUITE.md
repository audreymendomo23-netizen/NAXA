# Continuité E2E — NAXA | Qualification transversale Go Live

## PROMPT MAÎTRE — LIGNE DE CONDUITE OBLIGATOIRE DE CHAQUE RÉPONSE ET DE CHAQUE INTERVENTION

**Statut : règle de travail active et prioritaire pour toute reprise, diagnostic, décision, correction, recette et réponse concernant NAXA.** Ce prompt s'applique à chaque réponse, pas uniquement aux audits explicitement demandés.

### Prompt opérationnel à appliquer

> Tu agis comme CTO/auditeur senior de NAXA. Tu ne présumes jamais qu'une correction est évidente et tu ne modifies jamais le produit sur la base d'une intuition isolée. Commence par établir les faits, reproduire ou circonscrire le problème, auditer le code, les données, les contrats, les permissions, l'environnement, les journaux et les preuves disponibles. Distingue strictement faits observés, hypothèses, inconnues et décisions.
>
> Recherche la cause racine avant de corriger. Construis un éventail suffisamment large d'explications concurrentes : défaut applicatif, erreur de configuration, donnée ou fixture invalide, migration/schéma, RLS/autorisation, session/identité, réseau, cache/service worker, plateforme/appareil, dépendance externe, environnement de test, instrumentation ou faux négatif de la recette. Ajoute toute autre piste pertinente au cas réel ; cette liste n'est pas limitative.
>
> Pour chaque hypothèse sérieuse, indique les éléments qui la soutiennent, ceux qui la contredisent, le test discriminant à effectuer et une estimation qualitative ou chiffrée de sa vraisemblance lorsque les éléments le permettent. Les pourcentages éventuels sont des estimations de diagnostic, jamais des probabilités statistiques mesurées : ne fabrique aucun chiffre et ne transforme pas une intuition en certitude. Cherche activement les contradictions, y compris celles qui invalident ta première explication.
>
> Élargis le diagnostic aux sources techniques fiables et, lorsque cela peut améliorer la décision, effectue des recherches Internet ciblées : documentation officielle, spécifications, issues amont, comportements connus des navigateurs/OS/SDK et retours techniques pertinents. Vérifie la version et la date des sources, distingue les recommandations externes des faits propres à NAXA, cite les références utilisées et ne copie jamais une solution externe sans vérifier sa compatibilité avec l'architecture et les règles métier NAXA.
>
> Compare les solutions possibles selon leur capacité à traiter la cause racine, leurs risques de régression, sécurité, cohérence métier, compatibilité Web/PWA/Android, réversibilité, coût et facilité de preuve. Choisis la solution la mieux étayée ; explique pourquoi les alternatives principales sont écartées. Si le diagnostic n'est pas concluant, conçois d'abord un test discriminant plutôt que d'appliquer une correction spéculative.
>
> Applique ensuite, dans cet ordre, le cycle obligatoire :
> **AUDIT → ANALYSE → ANALYSE APPROFONDIE → ANALYSE DES HYPOTHÈSES ET DE LEURS VRAISEMBLANCES → RAISONNEMENT PAR CONTRADICTION → CHOIX JUSTIFIÉ → CORRECTION → TESTS CIBLÉS → INITIALISATION/EXÉCUTION DE LA RECETTE E2E → CONTRÔLE DES PREUVES → DOCUMENTATION → VERDICT.**
>
> Si un test échoue, ne masque pas l'échec, ne baisse pas le critère et ne déclare pas vert. Repars du même cycle à partir des nouvelles preuves : analyse le nouvel écart, confronte à nouveau les hypothèses, isole la cause, corrige si nécessaire, puis relance la même recette et les tests de non-régression. Répète ce cycle jusqu'à ce que tous les critères obligatoires soient démontrés verts. Une correction n'est validée que par une preuve post-correction sur le scénario qui échouait et par les contrôles de non-régression pertinents.
>
> **Objectif de sortie : 100 % VERT sur le périmètre convenu**, sans faux positif, sans critère affaibli et sans preuve inventée. « Vert » signifie que chaque exigence obligatoire est reliée à une preuve actuelle, reproductible, traçable au commit, à l'environnement, aux comptes, à la plateforme et au résultat. Les états PASS, FAIL, BLOCKED, NOT RUN, NOT IMPLEMENTED et NOT APPLICABLE JUSTIFIED restent distincts.
>
> Tu ne clôtures pas un chantier comme terminé tant qu'il n'est pas vert. Si un obstacle externe, un accès absent, une autorisation nécessaire, une limite d'environnement, un appareil indisponible ou une dépendance non maîtrisable empêche de poursuivre, tu ne prétends pas avoir atteint le vert et tu ne contournes pas la limite : tu documentes précisément le blocage, les tentatives et preuves déjà obtenues, l'action concrète qui lèvera le blocage et le point exact de reprise. Tu poursuis les travaux indépendants encore possibles dans le périmètre autorisé. Ne crée pas de boucle infinie ni de changements risqués sans preuve ; chaque itération doit apporter un test discriminant ou une amélioration vérifiable.
>
> À chaque réponse, annonce clairement : **état actuel, faits/preuves, contradiction ou cause établie, action réellement effectuée, résultat des tests, éléments encore bloquants et prochain point de reprise exact**. Distingue toujours le travail proposé du travail exécuté. N'annonce jamais une correction, une recette, une recherche, un commit ou un résultat qui n'a pas réellement été effectué.

### PROTOCOLE DE CONTINUITÉ DES RÉPONSES — AUCUNE PASSE INTERROMPUE OU INUTILE

> **Une réponse NAXA doit produire un résultat vérifié ; elle ne doit pas être un simple bulletin d'avancement.** Ne fractionne pas volontairement un même diagnostic en petites réponses successives, ne t'arrête pas à une durée arbitraire et ne demande pas à l'utilisateur de relancer « continue » lorsque tu peux poursuivre le travail autorisé dans la même intervention.
>
> Avant de répondre, poursuis le cycle de travail aussi loin que les outils, les autorisations et le contexte le permettent : rassemble les preuves, traite les causes établies, exécute les tests pertinents, corrige les échecs justifiés, relance les recettes et vérifie le résultat. Ne publie pas de messages intermédiaires de progression, de promesses ou de listes d'étapes futures à la place du travail. La réponse finale doit être consolidée, autonome et indiquer le résultat réel de la passe.
>
> **Règle de valeur minimale :** toute passe doit apporter au moins un résultat positif vérifié (un critère, scénario, défaut ou sous-ensemble réellement passé au vert), ou faire franchir une étape diagnostique décisive qui débloque concrètement la suite. Une réponse qui ne contient aucun progrès démontré et se limite à « non vert, à continuer » est une passe inutile : ne la présente pas comme un accomplissement. Continue plutôt l'investigation et les travaux indépendants autorisés.
>
> Si un blocage externe ou une limite réelle empêche tout nouveau résultat vert, ne fabrique pas de réussite et ne cache pas le blocage. Présente alors, dans une seule réponse consolidée, les résultats verts déjà acquis et vérifiés, la preuve précise du blocage, les tentatives discriminantes effectuées, ce qui ne peut légalement ou techniquement pas être poursuivi sans intervention, et la reprise exacte. Si aucun critère vert n'existe encore, dis-le explicitement et fournis la preuve du blocage ainsi que la prochaine action concrète qui peut le lever ; ne maquille jamais un diagnostic en résultat vert.
>
> Ne promets pas une exécution autonome illimitée ou une poursuite après la fin de la session : travaille jusqu'à la limite réelle de l'intervention et des outils disponibles, puis rends compte sans donner l'impression que des tâches continuent en arrière-plan. Une nouvelle intervention doit reprendre au point exact documenté, sans recommencer inutilement les étapes déjà prouvées.

### Garde-fous non négociables

- La recherche Internet est un moyen de diagnostic lorsque pertinente, pas un substitut à l'audit de la source NAXA ni une obligation artificielle sur chaque réponse.
- Aucun secret, compte, résultat, log, test, commit ou état d'environnement ne doit être inventé. Ne jamais exposer ou demander des secrets.
- Respecter le périmètre et les autorisations en vigueur : branche `main`, pas de branche/PR, pas de déploiement ni de modification Production pendant les audits ; Replay/local isolé en priorité. Ne jamais contourner une interdiction pour atteindre artificiellement le vert.
- Ne pas confondre build, tests unitaires, SQL, Playwright, émulateur et preuve E2E réelle. Respecter la matrice Web/PWA/Android et les appareils physiques exigés par le catalogue bulk.
- Une preuve historique n'est réutilisable que si commit, environnement, acteurs, scénario et résultat couvrent exactement le segment revendiqué.
- Un blocage externe n'est pas un PASS ; il doit rester visible jusqu'à sa levée et à la recette réussie.
- Le vert global ne peut être prononcé que lorsque tous les critères obligatoires du périmètre Go Live sont satisfaits, avec les preuves et réserves explicitement documentées.

---

## Programme maître actif — 20 novembre 2026

Le catalogue de référence est [docs/recettes/RECETTES_E2E_BULK_TRANSVERSALES_GO_LIVE.md](recettes/RECETTES_E2E_BULK_TRANSVERSALES_GO_LIVE.md).

- **Conception :** 17 lots transversaux B00–B16 ; chaque parcours relie les univers, établissements et rôles concernés.
- **Plateformes obligatoires :** Web, PWA installée et Android natif APK ; aucune réussite d'une version ne vaut pour les deux autres.
- **Univers inclus :** Pharmacie, ERP professionnel Parapharmacie, univers Client verrouillés, Examens médicaux et ses dix rôles, Soins à domicile, Dispositifs connectés, Administration et Support.
- **Hors ligne :** B12 transversal à chaque parcours et aux trois versions, avec preuve technique propre à Web, PWA et Android.
- **Historique :** R01–R09 conservées ; preuves exactes réutilisées comme sous-recettes ; extensions et liaisons nouvelles testées. R09 n'est pas recréée comme backlog séparé.
- **Statut :** CONCEPTION DOCUMENTÉE — B00–B16 NON EXÉCUTÉS comme campagne transversale — NAXA NON CERTIFIÉE GO LIVE.

### Comptes professionnels à créer séparément
- Pharmacie : Promoteur, Responsable, Pharmacien, Gestionnaire stock, Magasinier, Caisse, Comptable, Livreur.
- Parapharmacie : owner/Promoteur, Responsable/manager, Caisse, Gestionnaire stock, Magasinier, Pharmacien, Comptable selon affectations permises.
- Centre d'examens : Directeur, Accueil, Caissier, Comptable, Technicien laboratoire, Biologiste, Manipulateur imagerie, Radiologue, Responsable qualité, Responsable sécurité.
- Soins à domicile : titulaire/indépendant, owner, manager, operator.
- Transverse : Client A/B, Admin, Agents Support et professionnels de suivi autorisés.

### Preuves historiques capitalisées sans extrapolation
- Marketplace B2 R01 : noyau recherche/favoris/réservation/anti-survente/confirmation/annulation/restitution stock/historique ; extensions R01 NON EXÉCUTÉES.
- Identité/cumul : 5/5 suites SQL Replay du 16/11/2026 PASS ; recette UI et parité trois versions ouvertes.
- POS : test 284 Replay PASS et tests 295–299 (36 assertions PASS selon recette pilote) ; UI multi-plateforme et appareils physiques ouverts.
- Livraison : contrats SQL ciblés PASS documentés ; Auth multi-compte, push et appareils à prouver.
- Support Web : run 44681037772 SUCCESS Client + Comptable sur Chromium Desktop.
- Support Android natif : code ajouté ; run 44692082796 EN COURS au contrôle, aucun PASS inscrit.
- R03–R08 : NON EXÉCUTÉES dans leurs périmètres bulk ; R06 reste le test de refus métier.
- R09 : corrections et historique conservés ; contrôles dynamiques encore ouverts dans son document.
- ERP Android/offline : README natif indique que les parcours ERP complets, commandes/livraison et offline métier restent à couvrir.
- CI sur HEAD d050f598fe9731753af4d2f3f4ea9956724cea09 : qualité 44692082721 EN COURS ; build Android 44692087050 EN COURS ; E2E Support Android 44692082796 EN COURS ; secret scan 44692082746 SUCCESS. Ces états se rapportent à ce HEAD et peuvent évoluer.

### Point de reprise exact
Démarrer B00/B01/B02 sur Replay avec les comptes Auth séparés, plusieurs organisations et les trois plateformes. Le premier livrable opérationnel est le registre des identités/affectations et la preuve de routage autorisé/refusé. Ensuite seulement, ouvrir B03. B12 et B13 accompagnent chaque parcours.

Aucun test bulk n'est déclaré exécuté par la rédaction de ce catalogue. Production et déploiement restent hors périmètre. vercel.json confirme deploymentEnabled.main=false.

---

## Historique technique Support — conservé intégralement

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

# Durcissement de la recette de partage écran — après run vert 44668106123

## État précédent objectivement vérifié
- Commit `846a6a82d86dbf8fcaf32f19d40116f62f744e8b` : pipeline qualité PASS et scénario Agents Replay PASS.
- Le parcours Comptable→Agent C avait prouvé TURN relay, pistes audio vivantes, lecteurs distants actifs et vidéo 640×360 reçue (25 paquets / 10 781 octets dans le relevé vidéo final).
- Contradiction de robustesse : la preuve audio Comptable s'arrêtait dès le premier paquet : Agent C avait 1 paquet sortant et 2 entrants, tandis que le Comptable avait 2 sortants et 1 entrant au snapshot de 03:34:51Z. Cela confirme un démarrage RTP, mais ne prouve pas un flux audio soutenu.
- Contradiction de bout en bout : l'arrêt Comptable était déclenché par un PATCH API Playwright direct, pas par le bouton visible « Raccrocher ». Le trigger SQL avait bien été prouvé, mais pas l'interaction utilisateur qui déclenche cette clôture.

## Renforcement appliqué dans la recette
- La preuve audio attend maintenant au moins 10 paquets RTP sortants et 10 entrants supplémentaires pendant une fenêtre observée de 1,5 seconde, de chaque côté, en plus de l'état ICE/DTLS connecté, des pistes vivantes, du flux distant et du couple TURN relay. Aucun seuil n'est abaissé.
- Le sélecteur écran simulé peut refuser une seule tentative avec `NotAllowedError`. La recette exige alors : aucun aperçu, consentement redemandé, événement `screen_share_denied`, acteur demandeur et `reason=browser_permission_denied`.
- Le même appel Client repartage ensuite une seconde fois sur le transceiver négocié déjà existant. La recette exige de nouveaux paquets RTP vidéo et un deuxième événement d'arrêt manuel. Cela vérifie le cycle de vie après `replaceTrack(null)`, et non uniquement la première négociation.
- Le Comptable termine l'appel en cliquant sur le véritable bouton « Raccrocher » dans son interface. La recette attend la réponse HTTP, l'état terminal Agent, la disparition de l'aperçu, puis l'ordre d'audit `consented → started → stopped(actor_user_id NULL, reason=call_ended)`.

## Synchronisation de migration Replay
- Supabase Replay enregistre réellement la migration d'arrêt système sous la version `20261120032107`.
- Le fichier du dépôt portait initialement le préfixe `20261120040000`, ce qui pouvait faire diverger `supabase migration list` et `supabase db push`.
- Le fichier versionné est renommé `20261120032107_naxa_support_screen_share_auto_stop_system_actor.sql` pour correspondre exactement à l'historique Replay. Aucun SQL métier supplémentaire n'est appliqué lors de ce renommage.

## Limites de plateforme constatées
- La recette E2E utilise Chromium desktop avec un canvas synthétique. Elle vérifie le transport WebRTC/RTP et le protocole de consentement, pas le vrai sélecteur du système d'exploitation ni un téléphone physique.
- Le dépôt Android est un client Kotlin/Jetpack Compose autonome ; son manifeste et ses dépendances actuels ne comprennent ni WebRTC, ni MediaProjection, ni service de projection, ni permission `FOREGROUND_SERVICE_MEDIA_PROJECTION`. Le README Android décrit les parcours Support natifs comme non encore intégrés.
- Le navigateur Chrome Android ne prend pas actuellement en charge `getDisplayMedia()`; Safari iOS 27 a ajouté le support selon les données de compatibilité et tests publiés. L'application Android native ne peut donc pas être déclarée compatible partage écran sur la base de la recette web.
- Une vraie intégration Android native exigerait un parcours MediaProjection avec consentement OS à chaque session, foreground service de type `mediaProjection`, jeton à usage unique par session, transport WebRTC et signalisation/identité Bearer adaptés. Ce n'est pas couvert par le correctif de recette web et ne doit pas être simulé par une simple permission ajoutée au manifeste.

## Référence des preuves
- Android MediaProjection : documentation Android officielle, consentement par session et exigences foreground service Android 14+.
- Web Screen Capture : `getDisplayMedia()` exige un contexte sécurisé et une sélection explicite de surface par l'utilisateur.
- Safari iOS 27 : compatibilité corrigée dans MDN Browser Compat Data après tests sur appareil iOS 27.0.

Verdict fonctionnel web reste conditionné au nouveau pipeline de recette : refus OS, deux partages successifs dans le même appel, audio RTP soutenu et raccrochage UI réel. La compatibilité Android native reste une portée distincte, non encore implémentée.


## Ajustement préalable du contrat d'audit — 20 novembre 2026
- Revue de cohérence après ajout du scénario de refus et de partage répété : l'assertion E2E du refus doit vérifier `actor_user_id`, mais la requête de lecture de l'audit Client ne sélectionnait que `event_code,details`.
- Correction avant exécution du test : la sélection inclut maintenant `actor_user_id`. L'assertion reste inchangée : le refus OS doit être attribué au demandeur authentifié.


# Correction du second partage dans le même appel — 20 novembre 2026

## Diagnostic par contradiction — run E2E `44677756807` / commit `bd3bc53`
- Transport non défaillant : après arrêt manuel, le demandeur a envoyé 21 paquets RTP vidéo supplémentaires et l'Agent a reçu les mêmes 21 paquets.
- SDP non défaillant : le même transceiver vidéo reste `mid=0`, `currentDirection=sendonly` côté demandeur ; aucune renégociation n'est nécessaire.
- Piste non défaillante : receiver track côté Agent `readyState=live`, `muted=false`.
- UI en défaut : l'élément vidéo Agent restait `paused=true` et masqué. Le signal `screen-share-stopped` l'avait mis en pause. Au second partage, le receiver étant resté live/unmuted, aucun nouvel événement `unmute` n'arrivait ; le chemin de réactivation était absent.
- Les données excluent TURN, SDP, codec et capture locale : les nouvelles images arrivaient ; l'état de lecture/rendu côté Agent ne reprenait pas.

## Correction
- Le protocole privé inclut maintenant `screen-share-started` et `screen-share-stopped` avec l'identifiant de session.
- Après `replaceTrack(track)` et l'audit `screen_share_started`, le demandeur envoie le signal de démarrage. En cas d'échec de livraison, la capture est arrêtée et l'audit se clôt comme `unexpected_track_end`, sans faux événement de refus OS.
- L'Agent reprend le même élément/transceiver sans renégociation. Le lecteur reste transparent mais décodant jusqu'à ce que `requestVideoFrameCallback` prouve une nouvelle image (avance de `mediaTime` par rapport au dernier frame).
- L'arrêt invalide les callbacks en attente, met le lecteur en pause et masque l'aperçu. L'identifiant de session écarte un signal d'arrêt retardé visant une session plus récente.
- Le fallback sans `requestVideoFrameCallback` attend l'avancement réel de `currentTime`.
- L'E2E compare désormais `currentTime` avant/après le second partage, en plus des nouveaux compteurs RTP. Les anciennes dimensions vidéo ne suffisent plus.


## Ajustement du contrat de lecture distante — 20 novembre 2026
- Le contrat qualité statique attendait encore l'ancien callback `mute` réduit à `setRemoteScreenActive(false)`.
- Le composant remplace désormais ce handler par une annulation du frame callback, la sortie de l'état de décodage transparent et la désactivation de l'aperçu. Le contrat est aligné sur ces trois obligations de cycle de vie, sans supprimer de vérification.
- L'écouteur `ended` de la capture locale est installé après l'acquittement du signal de démarrage ; si le signal échoue, le rollback ne peut pas déclencher un deuxième arrêt utilisateur.


## Correction du typage du lecteur distant — 20 novembre 2026
- Le premier build après reprise du lecteur a signalé TS2339 : `HTMLVideoElement.srcObject` est de type `MediaProvider`, pas uniquement `MediaStream`.
- Le helper de reprise vérifie maintenant `srcObject instanceof MediaStream` avant d'accéder aux pistes vidéo. Il n'ajoute aucune hypothèse sur une source de type Blob ou MediaSource.


## Correction d'une assertion d'indices du journal — run E2E 44680310622
- Le parcours Client a prouvé l'audio soutenu (75–76 paquets RTP supplémentaires par sens et par pair), le refus du sélecteur, le premier partage/arrêt et le second partage sur le même transceiver avec de nouvelles images et paquets RTP.
- Replay a confirmé 7 événements ordonnés : refus OS (session A), puis consentement/démarrage/arrêt (session B), puis consentement/démarrage/arrêt (session C). Les trois identifiants étaient conformes et distincts.
- Le run a échoué uniquement parce que l'assertion comparait l'identifiant de la session B (index 1) à celui de la session C (index 4) tout en prétendant vérifier la cohérence interne de la première session.
- Correction : la recette compare désormais B aux événements 1/2/3, C aux événements 4/5/6, et B différent de C. Les raisons `user_stopped`, le refus `browser_permission_denied` et l'acteur demandeur restent exigés.
- Le contrat statique protège les correspondances d'indices correctes.
- Le scénario Comptable n'a pas encore été exécuté dans ce run, car l'assertion client a arrêté la recette avant la file centrale et le parcours professionnel.


# Vérification finale navigateur Client + Professionnel — 20 novembre 2026

## État de la branche et exécutions
- Branche : `main`.
- HEAD vérifié : `6f372bcfd0dda7d615bfaad4bfc1a724b741d959`.
- Run qualité : [44681037392](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44681037392) — SUCCESS, TypeScript, lint, tests et build Next.js ; actionlint SUCCESS.
- Run Support Replay : [44681037772](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/44681037772) — SUCCESS ; build Replay, scénario Agents, tous les contrôles et nettoyages ont terminé sans échec.
- Migration d'arrêt automatique confirmée dans l'historique Supabase Replay sous `20261120032107_naxa_support_screen_share_auto_stop_system_actor`. Aucun changement Production et aucun déploiement.

## Preuves du run Support Replay 44681037772
- Audio Client ↔ Agent : 76 paquets RTP sortants et 75–76 entrants supplémentaires par pair pendant 1,5 s ; ICE/DTLS `connected`, candidat sélectionné `relay`, pistes live et lecteur audio actif.
- Refus du sélecteur OS : `NotAllowedError` simulé ; aucun aperçu actif, consentement re-demandé et audit `screen_share_denied` attribué au demandeur, motif `browser_permission_denied`.
- Première capture : 22 paquets RTP / 7 916 octets sortants et entrants, réception Agent 640×360.
- Deuxième capture sans nouvel appel ni renégociation : le même transceiver reçoit de nouvelles frames ; progression RTP confirmée. L'audit append-only contient exactement le refus puis deux séquences `consented → started → stopped`, avec un identifiant distinct par session et une raison `user_stopped` pour chaque arrêt.
- Raccrochage Client déclenché depuis le vrai bouton d'interface et confirmé côté serveur en 716 ms ; transition terminale et libération de l'appel actif vérifiées.
- Profil Professionnel Comptable ↔ Agent C : audio RTP soutenu (76 paquets par sens/pair sur 1,5 s), TURN relay ; vidéo 640×360, 25 paquets / 11 076 octets reçus par l'Agent.
- Le Comptable termine par le bouton réel « Raccrocher » en laissant la capture active. La clôture SQL déclenche l'arrêt automatique ; le test confirme l'événement `screen_share_stopped`, `actor_user_id IS NULL` et `reason=call_ended`, ainsi que la disparition de l'aperçu Agent.
- Les tests de file centrale, autorisations Agent, séparation RLS inter-Agent, suspension/révocation, Livechat et cycle de vie Agents passent.
- Les nettoyages Replay retirent les comptes et données temporaires de test ; les événements d'audit restent conservés sans contenu média.

## Cause racine du second partage et preuve de résolution
- Le run `44677756807` a isolé l'écart : le transceiver SDP et TURN étaient sains ; le receiver distant restait `live` et `muted=false`, mais le lecteur Agent était en pause. Le deuxième flux ne déclenchait donc pas un nouvel événement `unmute`.
- Le signal privé `screen-share-started` porte désormais l'identifiant de session. L'Agent reprend le même lecteur et le garde transparent pendant le décodage ; il ne réaffiche qu'après une nouvelle frame prouvée par `requestVideoFrameCallback` (avec fallback sur l'avancement réel de `currentTime`). Le signal d'arrêt annule les attentes en cours, et un identifiant ancien ne peut pas fermer une session plus récente.
- La preuve du run `44681037772` montre que la capture locale, le sender WebRTC et le transport n'étaient pas la cause : la correction ciblait le rendu distant et la reprise du lecteur.

## Portée de compatibilité et réserve appareils
- Le parcours Support navigateur Client + Professionnel est vert sur Chromium Desktop/Replay.
- `getDisplayMedia()` est une API de capture contrôlée par l'utilisateur ; la recette CI remplace le sélecteur système par une capture Canvas synthétique. Le refus `NotAllowedError`, la négociation WebRTC, les RTP, les cycles arrêt/reprise et le journal sont prouvés ; le sélecteur OS réel et les performances sur appareils physiques ne le sont pas.
- Safari sur iOS 27.0+ annonce le support de `getDisplayMedia()` dans les données de compatibilité mises à jour en octobre 2026 ; cela reste à valider sur un appareil NAXA réel.
- Chrome Android 157 est indiqué sans support de `getDisplayMedia()`. Le client Kotlin/Jetpack Compose NAXA n'intègre pas actuellement les appels Support ni une capture native MediaProjection/WebRTC. L'APK et l'émulateur Android compilent et passent leurs tests existants, mais ce n'est pas une preuve de partage écran Android.
- Pour Android natif, le futur chantier est distinct : assistance audio + signalisation native WebRTC + `ScreenCapturerAndroid`/MediaProjection, service foreground `mediaProjection`, consentement système à chaque session, arrêt sur callback `onStop`, verrouillage et raccrochage. Android 14+ interdit de réutiliser une même permission MediaProjection ou de créer plusieurs VirtualDisplay sur un même jeton.

## Verdict
- **VERT — parcours navigateur Web Support Client + Professionnel sur Chromium Desktop, incluant les cycles refus, partage répété, arrêt, clôture serveur et audit.**
- **NON VERT — compatibilité universelle tous appareils : Android natif reste non implémenté ; iOS réel et sélecteur OS réel restent sans recette physique.**
- Ne pas présenter le chantier complet multi-plateforme comme 100 % Vert tant que ces validations/implémentations ne sont pas clôturées.

# Programme maître E2E bulk transversal — Web / PWA / Android — 20 novembre 2026

## Décision de gouvernance et référence canonique

- Le catalogue exécutable de conception est désormais le document docs/recettes/RECETTES_E2E_BULK_TRANSVERSALES_GO_LIVE.md.
- Il comprend **17 lots B00 à B16**. Il remplace le découpage provisoire évoqué dans les échanges (B00–B22 / 23 lots) : ne pas maintenir deux nomenclatures concurrentes.
- Les recettes Client historiques R01–R09, les tests SQL, les scripts Browser/Replay et les tests Android existants sont des **preuves/sous-recettes réutilisables**. Ils ne sont ni exclus, ni réputés suffisants pour un parcours transversal. Toute nouvelle liaison entre espaces, rôles ou plateformes doit être rejouée.
- Une recette déjà exécutée est réutilisée comme preuve uniquement si son commit, son environnement, ses acteurs, son scénario et son résultat couvrent exactement le segment concerné. Une recette plus large doit rejouer les préconditions et les transitions inter-espaces qui la relient ; elle n'a pas à répéter aveuglément chaque test unitaire déjà valide.
- Périmètre d'exécution : Replay/CI/local isolé uniquement. Production inchangée. Aucun déploiement. Android distribué par APK depuis le site NAXA, jamais via Play Store.

## Couverture transversale obligatoire des univers

Les recettes bulk ne sont pas une collection de tests indépendants par espace. Chaque lot doit suivre un parcours métier de bout en bout entre les acteurs qui produisent, valident, consomment ou contrôlent la même donnée.

1. **Pharmacie** : Client → catalogue/offre → réservation/ordonnance → pharmacie → Promoteur/Responsable → Pharmacien → Gestionnaire stock/Magasinier → Caisse → Comptable → Livreur → Client → Administration NAXA si escalade.
2. **Parapharmacie** : ERP professionnel Parapharmacie, titulaire/Promoteur, Responsable et collaborateurs affectés. Le catalogue Client Parapharmacie demeure verrouillé tant que la décision métier ne change pas ; tester l'ERP professionnel ne déverrouille jamais l'univers Client.
3. **Bébé & Maman** : vérifier le verrou Client et l'absence d'effet métier ; tester seulement les fonctions professionnelles expressément autorisées. Aucun accès commercial implicite.
4. **Examens médicaux** : Client → centre → accueil → caisse → technicien laboratoire / biologiste / manipulateur imagerie / radiologue → responsable qualité / responsable sécurité → publication contrôlée des résultats → Client. Tester également agenda, équipements, dossiers, personnel, sécurité, comptabilité et messages du centre.
5. **Soins et prestations à domicile** : Client → catalogue/demande → titulaire indépendant / owner → manager → operator → disponibilité, affectation, exécution, suivi et clôture.
6. **Dispositifs médicaux connectés** : Client, appareil, mesures et alertes privées ; partage éventuel avec un professionnel explicitement habilité et consenti. Tester collecte, révocation du consentement et séparation des comptes.
7. **Services communs** : identité et cumul d'espaces, invitations/affectations, profil, notifications, messagerie, assistance, support agents, audit, administration, sécurité, fichiers, paiements et comptabilité selon les règles propres à chaque écosystème.

**Contradiction à lever dans B01 :** R06 affirme que le catalogue Client Parapharmacie et Bébé & Maman restent bloqués ; la route source /parapharmacie rend pourtant un composant UniverseCatalog. Le test doit prouver le verrou au niveau registre, middleware, Server Actions, API/RPC et RLS, et l'absence d'effets métier. L'ERP professionnel Parapharmacie est une qualification distincte : le tester ne déverrouille pas l'univers Client.

**Dispositifs connectés :** suivi privé, soumis à consentement ; ce n'est pas un catalogue commercial autonome.

**Examens :** les règlements sont directs auprès du centre ; NAXA ne collecte pas le prix de l'examen.

## Comptes professionnels à provisionner — aucun rôle générique

- **Pharmacie / ERP** : Promoteur/propriétaire, Responsable, Pharmacien, Gestionnaire stock, Magasinier si distinct dans la configuration, Caisse/Caissier, Comptable, Livreur. Prévoir au moins deux pharmacies, deux utilisateurs par rôle critique lorsque l'isolation ou la concurrence est testée, et deux Livreurs pour les affectations concurrentes.
- **Parapharmacie / ERP** : propriétaire/titulaire, Responsable et chaque fonction de personnel réellement disponible dans le modèle d'affectation Parapharmacie. Ne pas déduire la parité des rôles Pharmacie : dresser l'inventaire exact des rôles à partir du schéma, des politiques et des écrans Parapharmacie avant génération des comptes.
- **Centre d'examens** : comptes séparés pour les dix rôles : Responsable du centre, Accueil, Caissier, Comptable, Technicien laboratoire, Biologiste, Manipulateur imagerie, Radiologue, Responsable qualité, Responsable sécurité. Aucun compte partagé ne peut représenter plusieurs postes lors des tests de séparation des droits.
- **Soins à domicile** : titulaire indépendant/owner, manager, operator, plus Client distinct.
- **NAXA central** : Administrateur, Agent Support A et Agent Support B (pour vérifier les frontières de file et de dossiers), et comptes de supervision uniquement si le code expose ces fonctions.
- **Clients** : au moins Client A et Client B actifs, un profil incomplet, une session expirée, un profil global suspendu, un visiteur majeur et un cas de refus de déclaration d'âge.
- Comptes distincts et données isolées par écosystème ; aucune identité de démonstration ou donnée de test ne doit apparaître dans l'espace public.

## Matrice de plateformes : règle 3/3

Pour chaque parcours annoncé disponible sur les trois versions, exécuter séparément :
- **Web** : desktop et viewport mobile, navigation navigateur, rechargement, stockage, permissions, perte/retour réseau.
- **PWA installée** : installation réelle, lancement autonome, Service Worker, cache/version, mise à jour, notifications push, stockage, perte/retour réseau et redémarrage.
- **Android natif APK** : installation APK, parcours Kotlin/Compose, authentification, permissions système, stockage chiffré, tâches d'arrière-plan, redémarrage, notifications, caméra, Bluetooth et synchronisation.

Résultat par fonctionnalité : Web PASS + PWA PASS + Android PASS = 3/3. Si une plateforme ne propose pas la fonction, inscrire **NON IMPLÉMENTÉ / NON PARITAIRE** et ouvrir un blocage Go Live si la fonction est essentielle ou annoncée. Un build Android, un test de catalogue de rôles ou un E2E Chromium ne prouve pas la parité fonctionnelle native.

Les capacités intrinsèquement différentes (ex. partage écran système, Bluetooth, notifications, caméra, tâches en arrière-plan) ont une sous-recette technique spécifique à la plateforme et une preuve sur appareil réel. Le résultat d'un émulateur ou d'une capture synthétique est explicitement limité à ce qu'il démontre.

## Hors ligne — axe transversal à chacun des 17 lots B00–B16

- Ne pas limiter le hors ligne à la Caisse : injecter perte réseau, réseau instable, fermeture forcée, redémarrage, session expirée, changement de compte, suspension/révocation, retour réseau et conflit dans chaque espace qui autorise une opération locale.
- Classer chaque action : consultation cache (avec fraîcheur affichée), brouillon local, opération différée à revalider serveur, ou action exigeant une connexion. Une écriture locale n'est pas une validation métier.
- Prouver persistance locale, file durable, idempotence, ordre/sequence, absence de doublon, reprise partielle, isolation inter-compte, arbitrage de conflits, rejet des opérations devenues interdites, statut de synchronisation et audit serveur.
- **Web** : IndexedDB/storage et reprise après reload/fermeture du navigateur.
- **PWA** : Service Worker, cache, stockage durable, lancement offline, update du cache et reprise de Background Sync/fallback.
- **Android** : base locale sécurisée, file persistante, WorkManager/contraintes réseau, redémarrage appareil/processus, restrictions batterie, permission et reprise des transferts.
- Les opérations sensibles (paiement confirmé, approbation, suspension, validation clinique, publication de résultat, clôture comptable, acceptation/attribution de mission selon la règle métier) ne deviennent définitives qu'après décision serveur. Une session expirée ou un profil suspendu ne peut pas rejouer une commande locale pour contourner les droits.

## Contrat commun d'une recette bulk

Chaque scénario contient : identifiant stable ; lot ; univers ; plateforme et appareil/version ; rôles/comptes ; préconditions et fixtures ; action visible UI ; requête/API/RPC attendue ; tables/événements et RLS attendus ; notifications/fichiers ; variations offline ; assertions d'isolation/sécurité ; résultat après reconnexion/redémarrage ; nettoyage ; liens vers preuves antérieures réutilisées ; verdict et commit.

États autorisés : **PASS**, **FAIL**, **BLOCKED**, **NOT RUN**, **NOT IMPLEMENTED**, **NOT APPLICABLE JUSTIFIED**. Aucun statut vide ne vaut PASS. SQL seul ne prouve pas l'UI ; Playwright seul ne prouve pas l'intégrité transactionnelle ; build ne prouve pas l'E2E ; notification créée ne prouve pas sa réception ; simulateur ne prouve pas appareil réel.

## État historique vérifié avant la campagne — 20 novembre 2026 (REMPLACÉ PAR LES SNAPSHOTS DÉTAILLÉS CI-DESSOUS)

- Branche main, HEAD observé avant cette mise à jour : 7d88f8f72e8800f8c420a60f555fa250973c16eb.
- Catalogue bulk : 17 lots B00–B16, conception documentée. À cette date, la campagne n'avait pas encore démarré ; voir les résultats d'exécution ajoutés ci-dessous, qui prévalent. Le catalogue précise les scénarios et les dépendances ; il ne transforme pas les anciennes preuves en couverture globale.
- Ancien snapshot Replay (remplacé par le snapshot de la passe B00 ci-dessous) : 1 Admin, 9 Clients, 1 Promoteur et 10 pharmacies. Ne pas utiliser cet inventaire historique comme état courant.
- Le premier relevé ne fournissait pas de preuve d'affectations/invitations Centre. Le snapshot actualisé ci-dessous confirme 0 centre, 0 affectation et 0 invitation.
- Le même relevé n'a pas établi de couverture de comptes Parapharmacie professionnels. Leur inventaire et leur provisionnement sont à faire avant les recettes de rôle correspondantes.
- Support navigateur : run Replay 44681037772 et qualité 44681037392 documentés verts pour le parcours Chromium Client + Comptable/Agent, y compris audio RTP soutenu, refus du sélecteur simulé, partage répété, arrêt UI et audit. Portée strictement navigateur/Chromium ; sélecteur système réel et appareils physiques non prouvés.
- Android : le build natif ne suffit pas à valider les parcours. Le support natif Android (audio/partage écran) est documenté comme non implémenté ; l'E2E Support Android échoue sur le run de la campagne en cours. Ne pas déclarer la fonction Android paritaire.
- Des tests offline/POS et contrats SQL préexistants sont réutilisables comme sous-recettes, notamment les preuves ciblées 281/283/284. Elles ne remplacent pas le passage transversal Web/PWA/Android.
- Production : aucune requête d'écriture, migration ou déploiement effectué dans cette mise à jour.

## Point de reprise exact

1. Lire le catalogue maître B00–B16 et l'utiliser comme source canonique de la campagne.
2. Établir le manifeste de fixtures Replay avec identifiants Auth réellement provisionnés pour tous les rôles Pharmacie, Parapharmacie, Centre d'examens, Soins à domicile, Client, Admin et Support ; commencer par les dix postes du Centre d'examens et les rôles Parapharmacie manquants.
3. Faire l'inventaire exact des fonctions/affectations Parapharmacie depuis les tables, politiques RLS, Server Actions et routes ; ne pas copier la liste Pharmacie par supposition.
4. Construire la matrice de traçabilité scénario → UI → API/RPC → table/RLS → test existant → preuve manquante pour chaque lot.
5. Exécuter d'abord B00 (identité, cumul, session, affectation, révocation), puis les parcours transversaux dans l'ordre de dépendance défini par le catalogue. Pour chaque scénario, Web, PWA installée et APK sont trois exécutions distinctes.
6. Intégrer les injections hors ligne dans chaque lot, puis rejouer la campagne de résilience sur les trois versions et appareils physiques.
7. Maintenir Production intacte, aucun déploiement et aucun Play Store. Ne prononcer AU VERT global qu'après clôture des critères obligatoires, preuves 3/3, sécurité, pilote terrain et absence de blocage critique.

---

## Campagne bulk — première exécution B00 sur Replay — 20 novembre 2026

**Environnement contrôlé :** Supabase Replay `pwfftcsjyeibxxqhwysw`, statut `ACTIVE_HEALTHY`, PostgreSQL 17.11. Aucun accès ni aucune écriture Production. Aucun déploiement demandé ou effectué. Le code applicatif de référence observé par le catalogue est `d050f598fe9731753af4d2f3f4ea9956724cea09` ; les commits de continuité postérieurs sont documentaires/CI.

### Résultat réellement exécuté — sous-contrat B00-IDENTITY-01

Contrôles SQL en lecture seule, directement sur Replay :

| Assertion | Résultat |
|---|---:|
| Profils sans utilisateur Auth correspondant | 0 |
| Utilisateurs Auth sans profil correspondant | 0 |
| IDs de profils dupliqués | 0 |
| IDs Auth dupliqués | 0 |

**Verdict : PASS — cohérence référentielle Auth ↔ profiles (4/4 assertions).** Cela prouve la correspondance des identités présentes, pas le parcours complet B00, ni la capacité de connexion, le changement d'espace, l'invitation ou les permissions UI/API.

### Inventaire Replay constaté pendant cette passe

- 11 profils et 11 utilisateurs Auth correspondants : 9 profils `client`, 1 `promoteur`, 1 `admin`.
- 10 lignes `pharmacies`, 3 liens `promoteur_pharmacies`.
- 7 profils Client portent une `fonction_interne` métier (Livreur, Gestionnaire stock, Caisse, Responsable, Comptable, Pharmacien) ; ce champ seul ne prouve aucune affectation organisationnelle ni aucun espace opérationnel.
- 0 ligne `partners`, 0 `exam_centers`, 0 `exam_staff_assignments`, 0 `exam_staff_invites`.

**Contradiction importante avec l'ancien snapshot de continuité :** les données Replay actuelles ne contiennent pas les centres/affectations qui avaient été évoqués comme fixtures antérieures. Le snapshot exécuté ici prévaut ; ne pas réutiliser un ancien décompte pour déclarer B00/B02 prêts.

### Audit structurel B02 — personnel des centres

- Les dix valeurs de rôle sont contraintes dans `exam_staff_assignments`; la valeur `directeur` est exclue de `exam_staff_invites` et de `exam_assign_existing_staff`. Le provisionnement du Directeur est donc un chemin distinct à identifier/tester, pas une invitation ordinaire.
- L'ajout direct `exam_assign_existing_staff` exige un acteur `staff_manage`, un compte Client actif, complet, majeur et e-mail confirmé ; l'identifiant doit correspondre sans ambiguïté au username ou téléphone. L'auto-affectation est refusée. L'affectation est journalisée.
- L'invitation exige `staff_manage`, normalise l'e-mail et refuse les rôles hors des neuf rôles du personnel. L'acceptation exige une session du destinataire, un e-mail confirmé identique à l'invitation, un profil Client actif/complet/majeur, une invitation non expirée/non révoquée/non déjà utilisée et un centre non suspendu. L'affectation et l'acceptation sont journalisées.
- RLS est activé sur `exam_centers`, `exam_staff_assignments` et `exam_staff_invites`. `exam_staff_invites` n'a aucune policy directe ; les opérations prévues passent par les RPC publiques et leurs implémentations privées `SECURITY DEFINER`. L'audit des grants EXECUTE et les tests négatifs en contexte Auth restent à exécuter avant toute conclusion de sécurité.
- Le trigger de mise à jour des affectations interdit à un membre de modifier son centre, son utilisateur, son poste, son activation, sa révocation ou son auteur ; la gestion par un responsable exige `staff_manage`. Ce contrôle de code/DB n'est pas encore une preuve E2E de non-élévation.

### Verdict et blocage opérationnel

- **PASS partiel :** B00-IDENTITY-01, cohérence référentielle des 11 identités Auth/Profiles.
- **NON EXÉCUTÉ :** B00 cycle de session/changement d'espace/révocation multi-organisation ; B01 ; B02 ; toutes les variantes Web/PWA/Android.
- **BLOCKED pour les parcours Centre :** aucun partenaire ni centre ni affectation ni invitation n'existe dans Replay ; aucun compte Auth séparé pour les dix rôles Centre n'est provisionné. Les seules données observées ne permettent pas de tester l'accès métier du Directeur ou des neuf collaborateurs.
- **Aucune fixture n'a été créée** : les fonctions de provisionnement Auth disponibles, les identifiants de test utilisables et le parcours d'initialisation du Directeur doivent être établis avant les écritures. Ne pas fabriquer des profils SQL sans Auth, ni des affectations sans utilisateur authentifié. Les tests sont restés en lecture seule.
- **Aucune correction produit n'a été appliquée** : les éléments observés ne démontrent pas un défaut applicatif. Les politiques et fonctions nécessitent des tests Auth discriminants, pas une modification spéculative.

### Point de reprise exact

1. Identifier dans le dépôt le chemin supporté de création/confirmation des utilisateurs Auth de test et le bootstrap du Directeur de centre ; ne pas écrire directement des profils orphelins.
2. Résoudre les fixtures Replay multi-organisations (deux Promoteurs, Pharmacies, Parapharmacies, centres, Clients et deux Livreurs) en s'appuyant sur les parcours réels.
3. Provisionner les dix comptes Centre distincts ; tester séparément l'ajout direct et l'invitation acceptée pour les neuf rôles éligibles, et le bootstrap Directeur.
4. Exécuter les refus (auto-affectation, mauvais e-mail, invitation expirée/révoquée/consommée, compte incomplet/suspendu, doublon, accès inter-centre), puis les parcours positifs UI/RPC/RLS.
5. Rattacher chaque scénario aux preuves Web, PWA installée et Android natif ; ne pas passer à B03 tant que les gardes B00–B02 bloquantes ne sont pas démontrées.

---

## Campagne bulk — deuxième passe diagnostic B02 / Parapharmacie — 20 novembre 2026

**Périmètre :** audit SQL structurel complémentaire en lecture seule sur Supabase Replay `pwfftcsjyeibxxqhwysw`. Aucun enregistrement métier créé, aucune écriture Production, aucun déploiement.

### Résultat positif — chemin réel du Directeur Centre identifié

Le rôle `directeur` n'est pas une affectation ordinaire via formulaire/RPC. Le mécanisme réel est déclenché par les liens de direction du partenaire :

- À l'insertion d'un `exam_center`, le trigger `exam_centers_sync_partner_directors` appelle `private.exam_sync_partner_directors()`.
- Cette fonction récupère les membres du partenaire dont `member_role` est `owner` ou `manager`, et crée pour chacun une affectation `directeur` active si son profil est actif.
- À l'ajout ou changement d'un membre owner/manager, `private.exam_sync_new_partner_director()` synchronise l'affectation Directeur sur les centres du partenaire ; la suppression ou perte du rôle révoque les affectations Directeur correspondantes.
- La révocation du rôle Directeur par `exam_revoke_staff_assignment` est explicitement refusée : elle passe par le rattachement owner/manager du partenaire.

**Conclusion de diagnostic :** le chemin de bootstrap Directeur est maintenant identifié. La recette doit créer le partenaire, son membership owner/manager, puis le centre ; elle doit vérifier l'affectation automatique, sa non-duplication et sa révocation à la perte du rôle. Cela ne prouve pas encore son exécution en E2E, car Replay ne contient actuellement aucun partenaire ni centre.

### Résultat positif — modèle Parapharmacie identifié

Le RPC `naxa_grant_partner_professional_assignment` confirme les contrôles serveur suivants :

- Refus explicite du rôle `livreur` : circuit dédié exigé, conformément au périmètre du catalogue.
- Cible obligatoirement active, majeure, complète, consentante et avec e-mail Auth confirmé.
- Partenaire obligatoirement de type `parapharmacie`, actif et doté d'une architecture active.
- Responsable limité aux architectures `PARENTS_AINES_CADETS` et `HYBRIDE`, avec quota contrôlé sous verrou transactionnel.
- Le Promoteur doit être owner ; le Responsable ne peut affecter que la Caisse et doit posséder le privilège correspondant.
- Les limites de Caisse, les privilèges, les chevauchements de périodes, l'auto-affectation et le propriétaire lui-même sont contrôlés côté serveur.
- Une affectation crée/assure le membership partenaire puis écrit une ligne dans `naxa_partner_professional_assignments`.

Le RPC de révocation vérifie également le périmètre du partenaire, les privilèges, et limite le Responsable à la révocation des Caisses autorisées.

**Verdict : PASS structurel** pour l'identification des règles serveur Parapharmacie et l'interdiction Livreur. Ce n'est pas un PASS fonctionnel : aucune ligne partenaire/affectation n'existe sur Replay, et les parcours Auth/UI/RLS restent à exécuter.

### Point de sécurité à qualifier — schéma privé et fonctions SECURITY DEFINER

Les contrôles SQL montrent :
- `USAGE` du schéma `private` accordé aux rôles PostgreSQL `authenticated` et `anon`.
- `EXECUTE` accordé à `authenticated` sur plusieurs implémentations privées `exam_*_impl` définies `SECURITY DEFINER`, y compris création/acceptation d'invitation, liste, obtention du token et révocation.
- Les fonctions auditées contrôlent individuellement `auth.uid()` et `private.exam_has_capability(...,'staff_manage')` avant les opérations sensibles ; l'obtention du token est également bornée au centre, à l'invitation en attente et non expirée.
- Le réglage PostgREST `pgrst.db_schemas` n'est pas lisible depuis le contexte SQL utilisé ; on ne peut donc pas conclure ici que le schéma `private` est effectivement exposé à l'API REST.

**Verdict : BLOCKED / risque de configuration non tranché, pas vulnérabilité confirmée.** Il faut vérifier la liste des schémas exposés dans la configuration Supabase/API et tester les appels directs des fonctions privées avec un JWT utilisateur autorisé puis non autorisé. Si `private` est exposé, retirer `USAGE` et les `EXECUTE` directs non nécessaires aux rôles clients, puis conserver l'accès via les RPC publiques contrôlées ; faire ensuite les tests de non-régression. Ne pas modifier les ACL à l'aveugle.

### État actualisé

- **PASS :** B00-IDENTITY-01 (4/4 contrôles de cohérence Auth/Profiles).
- **PASS structurel :** mécanisme de synchronisation Directeur identifié ; règles serveur Parapharmacie et refus Livreur identifiés.
- **BLOCKED :** B00/B02 E2E, faute de partenaires, centres et affectations Replay ; aucune création de comptes Auth de test ni bootstrap exécuté.
- **BLOCKED sécurité :** exposition effective du schéma `private` et test des appels directs non établis.
- **NON EXÉCUTÉ :** parcours UI/RPC avec JWT de test, tests négatifs, Web/PWA/Android, lots B01 et suivants.

### Point de reprise exact

1. Trouver le chemin applicatif documenté de provisionnement Auth et du dossier partenaire sur Replay ; ne pas créer directement des lignes Auth/Profiles artificielles.
2. Provisionner via le parcours supporté un propriétaire Centre et son membership `owner`, puis créer un centre : vérifier le trigger et l'affectation Directeur.
3. Provisionner les neuf comptes distincts du personnel Centre ; exécuter ajout direct et invitation acceptée, refuss, révocations et isolation inter-centre.
4. Créer un partenaire Parapharmacie Replay par le flux métier ; tester toutes les fonctions autorisées, quotas, privilèges, expirations, chevauchements et refus Livreur.
5. Vérifier la configuration réelle des schémas API exposés et les ACL depuis la console/configuration Supabase ; tester l'accès privé direct avec JWT.
6. Mettre à jour le manifeste de fixtures et la matrice scénario → UI → RPC → tables/RLS → preuve avant d'ouvrir les lots suivants.


---

## Campagne bulk — troisième passe : chemins de provisionnement et sécurité API — 20 novembre 2026

**Périmètre :** inspection du code main et contrôles SQL en lecture seule sur Replay pwfftcsjyeibxxqhwysw. Aucun compte, partenaire, centre, invitation ou affectation créé. Aucune écriture Production et aucun déploiement.

### 1. Provisionnement Auth du personnel Centre — chemin applicatif confirmé

Fichier inspecté : src/app/centre-examens/actions.ts (blob a37c0761f709b305d7000c1e809d129613ecd644).

- createExamStaffAccount exige un acteur ayant la capacité staff_manage sur le centre.
- Pour un nouvel e-mail, la Server Action crée une invitation par exam_create_staff_invite, puis un utilisateur Auth via supabaseAdmin().auth.admin.createUser avec email_confirm:false, naxa_signup_pending:true et exam_staff_direct_pending:true.
- Le lien d'activation est transmis par e-mail. Le code réserve cet envoi automatique à Production ; hors Production, il demande une transmission manuelle du lien. Le flux Replay doit donc être testé avec un canal d'activation maîtrisé, sans prétendre qu'un e-mail Replay est envoyé.
- Pour un utilisateur existant, l'affectation directe n'est autorisée que si son profil Client est complet, actif et si l'e-mail Auth est confirmé ; sinon le flux invitation est utilisé.
- assignExamStaff appelle exam_assign_existing_staff. La liste des neuf rôles autorisés exclut directeur.

Fichiers complémentaires inspectés :
- src/app/api/auth/complete-signup/route.ts : finalisation du compte à partir d'un jeton Bearer Auth valide ; contrôle e-mail confirmé, profil Client, âge majeur, consentement, identifiant et téléphone.
- src/app/api/auth/signup-otp/verify/route.ts : vérification OTP et ouverture de session.
- src/app/(auth)/creation-compte/page.tsx : parcours d'inscription public ; ce parcours doit être exercé réellement pour valider l'activation, pas remplacé par une insertion SQL dans profiles.

**Conclusion :** le code de provisionnement et les préconditions sont identifiés. Le compte invité, l'e-mail d'activation, la finalisation du profil et l'acceptation d'invitation n'ont pas encore été exécutés sur Replay.

### 2. Création du partenaire Centre et du centre — contrat DB confirmé

Fonction Replay inspectée : public.admin_create_partner_dossier(uuid,text,text,text,text,text,text,numeric,numeric,text,bigint,text,jsonb).

Cette fonction SECURITY DEFINER :
- exige public.is_admin() pour l'acteur courant ;
- exige un titulaire existant dans auth.users et profiles, de rôle Client, actif, majeur selon la date camerounaise, âge vérifié, consentement accepté et e-mail confirmé ;
- crée le partenaire en statut pending, son univers désactivé, le membership owner du titulaire, le dossier administratif en attente ;
- lorsque p_universe_slug='examens', crée aussi automatiquement le exam_center en statut draft ;
- journalise l'événement dans audit_log sans modifier le statut global d'identité du titulaire.

Le flux applicatif de gestion du centre, dans src/app/partenaire/examens/actions.ts (blob 9184b771b79a0f4b991561196c1ba0b5f14f7532), permet ensuite au propriétaire/manager actif de créer un centre en brouillon. Ce flux alternatif ne remplace pas le bootstrap du dossier initial et son trigger Directeur doit être vérifié sur données réelles.

**Conséquence de recette :** pour le scénario initial le plus déterministe, utiliser un Client Replay existant, complet et confirmé comme titulaire, faire exécuter la fonction par un administrateur authentifié, puis vérifier le membership owner, le centre brouillon et l'affectation Directeur automatique. Aucun de ces actes n'a encore été exécuté.

### 3. Nouvelle photographie Replay — état toujours sans fixtures métier

Contrôle SQL séparé, 20 novembre 2026 : Auth users 11 ; profiles 11 ; partners 0 ; exam_centers 0 ; exam_staff_assignments 0 ; exam_staff_invites 0.

La cohérence Auth/Profiles reste à 11/11. L'absence de partenaires et centres confirme que le blocage E2E métier demeure ; aucune fixture ne doit être créée en contournant les flux Auth et Admin.

### 4. Qualification des droits du schéma privé — avancée, mais exposition API non résolue

Contrôle des fonctions private.exam_*_impl sur Replay : sept implémentations examinées sont SECURITY DEFINER ; EXECUTE est accordé à authenticated sur les sept ; EXECUTE n'est pas accordé à anon sur ces sept ; USAGE sur le schéma private est accordé à anon, authenticated et service_role.

Le réglage PostgREST n'est pas exposé dans les paramètres SQL consultables (pg_settings ne retourne aucun paramètre pgrst / db_schema dans ce contexte). La liste effective des schémas exposés à l'API ne peut donc pas être déduite de ces résultats. Les grants SQL seuls ne prouvent ni l'exposition REST ni l'inaccessibilité HTTP.

**Verdict sécurité : BLOCKED / configuration API non vérifiée.** Aucune vulnérabilité confirmée et aucune correction ACL appliquée. Il faut obtenir la configuration effective « Exposed schemas » du projet Replay, puis tenter des appels REST directs avec un JWT utilisateur de test autorisé et un JWT non autorisé. Si private est exposé, revoir les grants USAGE et EXECUTE en conservant les RPC publiques contrôlées, puis rejouer les tests positifs et négatifs.

### 5. État de la passe

- **PASS maintenu :** B00-IDENTITY-01, 4/4 contrôles référentiels lors de la première exécution ; état actuel Auth/Profiles 11/11.
- **PASS structurel ajouté :** chemin Auth d'invitation Centre identifié ; contrat de création du dossier partenaire et du centre identifié ; contrat d'acceptation et finalisation Auth identifié.
- **BLOCKED :** exécution réelle de ces flux, faute de session Admin/Responsable de centre contrôlée et de canal d'activation Replay confirmé.
- **BLOCKED sécurité :** liste des schémas API exposés et essais HTTP avec JWT non disponibles depuis les outils connectés présents.
- **NON EXÉCUTÉ :** toute recette métier B00/B01/B02 UI/RPC, tests négatifs avec JWT, PWA installée, Android natif et lots B03–B16.

### Point de reprise exact

1. Obtenir une session Admin de test et un Client Replay complet, actif, majeur et e-mail confirmé ; ne pas réutiliser un profil Promoteur comme titulaire.
2. Exécuter admin_create_partner_dossier dans le contexte d'une session Admin authentifiée, avec univers examens, puis contrôler le partenaire, le membership owner, le centre brouillon et le Directeur auto-affecté.
3. Exécuter le cycle complet de création/activation d'un compte invité Centre, finalisation de profil et acceptation d'invitation ; vérifier ensuite les neuf rôles, leurs refus et révocations.
4. Obtenir la configuration Exposed schemas de Replay et exécuter les appels REST privés avec JWT autorisé/non autorisé. Ne pas modifier les ACL avant cette preuve.
5. Documenter les identifiants de fixtures non sensibles, les préconditions et les preuves ; poursuivre B00–B02 jusqu'aux PASS requis avant B03.


### Complément de diagnostic — titulaires Replay éligibles — 20 novembre 2026

Contrôle SQL agrégé, sans exposer d'adresses ni d'identifiants personnels : sur les 9 profils Client Replay, **9/9 satisfont les préconditions SQL du titulaire partenaire** (profil actif, âge majeur vérifié, consentement présent, e-mail Auth confirmé). Aucun profil Client actif correspondant n'a d'e-mail non confirmé dans ce jeu de données. Cela lève le doute sur l'existence d'un titulaire technique pour le futur test Centre/Parapharmacie ; cela ne fournit pas de session Admin authentifiée et n'autorise pas à exécuter la fonction en contexte postgres, car son contrôle public.is_admin() dépend de l'identité JWT de l'appelant.

**Point de reprise affiné :** les données de titulaire sont disponibles. Le blocage restant pour initialiser le dossier Centre est l'obtention d'une session Admin de test et d'un appel authentifié de la Server Action/RPC. Ne pas contourner cette barrière par SQL direct.


---

## Campagne bulk — quatrième passe : advisory sécurité/performance et contrôle du rôle anon — 20 novembre 2026

**Périmètre :** Supabase Replay `pwfftcsjyeibxxqhwysw` (ACTIVE_HEALTHY, PostgreSQL 17.11), appels advisors et SQL en lecture seule. Aucune modification SQL/ACL, aucun fixture ajouté, aucune écriture Production, aucun déploiement.

### 1. Supabase Security Advisor — état observé

Résultats de l'advisor sécurité à 08:10:55Z :
- `rls_enabled_no_policy` : 73 tables RLS activé sans policy (niveau INFO). Cela bloque normalement l'accès direct via RLS, mais il faut confirmer pour chaque table que l'absence de policy est intentionnelle et que les flux nécessaires passent par des RPC contrôlées. Les tables privées/outbox et plusieurs tables sensibles sont concernées ; ce résultat n'est pas à lui seul une vulnérabilité.
- `anon_security_definer_function_executable` : 3 fonctions publiques SECURITY DEFINER accessibles à `anon` : `get_universe_catalog_v2`, `marketplace_offre_stock_disponible`, `marketplace_produit_visible`. Leurs définitions ont été lues. Elles exposent un catalogue/offre de marketplace et délèguent le calcul de stock à la fonction privée guarded ; elles ne réalisent pas d'écriture. Leur accessibilité anonyme paraît cohérente avec la consultation publique du Marketplace, mais reste à valider par contrat métier et test REST HTTP. Ne pas révoquer automatiquement l'accès anonyme sans vérifier le parcours public.
- `authenticated_security_definer_function_executable` : 262 fonctions publiques SECURITY DEFINER accessibles aux utilisateurs authentifiés (WARN). C'est un signal de revue de surface RPC, pas la preuve que 262 fonctions sont vulnérables. La revue doit prioriser les fonctions d'administration, paiements, rôles, stock, invitations et sécurité ; chaque fonction doit démontrer un contrôle serveur de rôle/périmètre.
- `auth_leaked_password_protection` : protection des mots de passe compromis via HaveIBeenPwned désactivée (WARN). Le réglage est au niveau Auth Dashboard et n'est pas modifiable/vérifiable par les outils Supabase connectés disponibles dans cette session. Il demeure un critère bloquant de sécurité tant que la preuve d'activation n'est pas fournie.

### 2. Contrôles SQL du catalogue public et des univers bloqués

Les deux conditions de verrouillage sont vérifiées pour Parapharmacie et Bébé & Maman :
- `universe.parapharmacie.enabled = false` ; `universes.parapharmacie.enabled = true`.
- `universe.bebe-maman.enabled = false` ; `universes.bebe-maman.enabled = false`.
- `universe.examens.enabled = false` (la ligne univers `examens` reste enabled, mais le feature flag bloque l'accès fonctionnel).

La fonction `get_universe_catalog_v2` vérifie le flag et l'état de l'univers avant d'émettre les lignes correspondantes. Sous `SET LOCAL ROLE anon`, l'appel de cette fonction a retourné 0 ligne pour `pharmacie`, `parapharmacie` et `bebe-maman` dans le Replay actuel ; `marketplace_produit_visible` a retourné `false` pour un UUID inexistant. L'inventaire Replay de ce test est vide en offres partenaires/pharmacies publiques (0 produit partenaire actif, 0 pharmacie publique éligible) ; 101 lignes de stock positif ne constituent pas une preuve d'offres publiables.

**Conclusion : PASS limité** pour le maintien du verrou fonctionnel par feature flags dans l'état courant ; **NON PROUVÉ** pour le test de non-contournement sur l'ensemble des couches (registry, middleware, Server Actions, API/RPC, RLS) et pour des offres réelles de test. La Parapharmacie professionnelle ERP doit rester testée séparément du verrou du catalogue Client.

### 3. Lecture directe des tables sensibles par anon

Une tentative réelle de SELECT sous `SET LOCAL ROLE anon` sur `public.naxa_payment_evidence_intake` a été rejetée par PostgreSQL avec `42501 permission denied for table`. Cela confirme que le rôle anon n'a pas le privilège SELECT sur cette table. La requête groupée sur d'autres tables sensibles a été interrompue dès cette première erreur ; aucune conclusion n'est donc tirée pour les autres tables à partir de cet essai. Le contrôle direct de `exam_staff_invites`, `naxa_livreur_invites`, `pharmacie_bebe_maman_produits` et des tables sécurité reste à faire individuellement avec vérification des ACL et du comportement RLS sous JWT.

### 4. Supabase Performance Advisor — dette technique observée

- 249 clés étrangères sans index couvrant (INFO).
- 25 policies RLS utilisant `auth.*` / `current_setting()` sans sous-select (WARN `auth_rls_initplan`).
- 48 cas de policies permissives multiples sur une même table/rôle/action (WARN) ; vérifier si les unions sont voulues ou si elles élargissent trop les accès.
- 143 index non utilisés (INFO, à interpréter avec prudence sur un environnement Replay peu sollicité).

Aucun index ni policy n'a été modifié. Il faut analyser la cardinalité, les requêtes, les règles d'accès et les plans avant toute correction ; ne pas supprimer des index sur la seule base de l'usage Replay.

### 5. Verdict de cette passe

- **PASS limité :** les flags Parapharmacie et Bébé & Maman sont désactivés ; le catalogue anonyme ne retourne aucune offre dans l'état Replay courant ; une table sensible testée refuse SELECT à anon.
- **BLOCKED :** protection des mots de passe compromis non activée/non vérifiée ; exposition réelle PostgREST et tests REST JWT toujours indisponibles ; audit des 262 RPC SECURITY DEFINER et des 48 cas de policies permissives incomplet.
- **À QUALIFIER :** 73 tables sans policy (souvent un refus par défaut attendu, à confirmer table par table) ; 249 index FK manquants ; 25 RLS initplan ; 143 index inutilisés.
- **NON EXÉCUTÉ :** parcours authentifiés de bout en bout, test HTTP de chaque RPC anonyme, matrice de non-contournement du verrou par univers, recettes E2E métiers, PWA et APK physique.

### Point de reprise exact

1. Depuis le Dashboard Supabase Replay, fournir la preuve de l'activation de la protection des mots de passe compromis et la liste exacte des schémas API exposés ; aucun outil connecté actuel ne donne ces réglages Auth/API.
2. Exécuter des appels REST HTTP avec anon key et JWT de test pour les trois RPC publiques ; vérifier qu'aucune donnée privée, pharmacie démo, stock non publié ou univers verrouillé n'est retourné.
3. Auditer prioritairement les RPC SECURITY DEFINER d'administration, paiement, staff/invitations, rôles, stock et sécurité, en reliant chaque fonction à son contrôle `auth.uid()`, rôle et périmètre ; tester les refus avec JWT non autorisé.
4. Vérifier individuellement les ACL et refus RLS des tables sensibles sans policy ; ne créer aucune policy générique pour faire disparaître l'advisor.
5. Continuer B00–B02 sur Replay avec les sessions de test authentifiées ; le provisionnement initial partenaire/centre reste bloqué tant qu'aucune session Admin test n'est disponible.


---

## Campagne bulk — cinquième passe : audit structurel du circuit Livreur — 20 novembre 2026

**Périmètre :** inspection des fonctions SQL Replay et de leurs privilèges EXECUTE. Aucune donnée métier modifiée ; aucun test d'écriture métier ; aucune écriture Production ; aucun déploiement.

### 1. Invitation et affectation Livreur — contrats serveur inspectés

Les fonctions suivantes sont `SECURITY DEFINER`, accessibles à `authenticated` et non à `anon` : `naxa_create_livreur_invite`, `naxa_accept_livreur_invite`, `naxa_revoke_livreur_invite`, `naxa_grant_livreur_assignment`, `naxa_livreurs_management_list`.

- Création d'invitation : exige une pharmacie active ; l'acteur doit être Promoteur valide avec pharmacie dans son réseau et privilège `ASSIGN_USER_TO_PHARMACY`, ou compte Pharmacie sur son établissement actif.
- Acceptation : exige session Auth, e-mail confirmé, profil Client actif/majeur/complet/consentant, invitation non expirée/non révoquée/non consommée et adresse e-mail identique ; l'invitant doit encore être autorisé ; un autre poste professionnel actif rend le compte inéligible ; crée l'affectation Livreur et sélectionne le rôle actif.
- Affectation directe : valide le candidat, l'âge, le consentement, l'e-mail, l'autorité Promoteur/Pharmacie, la portée de la pharmacie, le privilège, les périodes et les chevauchements. Le poste Livreur est exclu de la RPC générique d'affectation Parapharmacie.
- Le code prévoit une affectation dédiée permanente pour un profil Client autonome et une affectation temporaire de permanence pour certains membres du personnel déjà rattachés au périmètre autorisé. Les règles exactes de multi-pharmacie restent à confirmer par tests de sessions et de changement de rôle actif.

### 2. Mise à disposition de la mission — gate Stock confirmé dans le code

`naxa_delivery_make_available` exige une session, une pharmacie dans le périmètre de l'acteur, une commande valide, `livraison_confirmee_stock_at` renseigné, `preparation_statut='prete_au_retrait'`, un mode de paiement choisi et un paiement électronique vérifié (sauf espèces à la livraison). Elle délègue à une fonction interne non exécutable directement par `anon` ou `authenticated`.

La fonction interne contrôle en plus le rôle Gestionnaire de stock/Magasinier (ou Admin), la demande de livraison, le statut de commande, la préparation physique confirmée et le paiement ; elle crée la mission une seule fois, génère les offres aux Livreurs actifs de cette pharmacie et les notifications. Cela respecte structurellement la règle : le Livreur ne reçoit la mission qu'après préparation confirmée par Stock.

### 3. Acceptation, retrait et suivi — contrôles serveur inspectés

- `naxa_delivery_accept` exige le poste Livreur actif, la pharmacie active, la mission disponible dans cette pharmacie, une affectation Livreur active/non expirée, la préparation prête et le paiement sélectionné/vérifié.
- `naxa_delivery_pickup` exige le Livreur affecté, le statut accepté, la commande déclarée prête par Stock et le paiement vérifié ; la transition passe à `picked_up` et met à jour le suivi de livraison.
- Les actions GPS/arrivée/remise vérifient la mission et le Livreur actif ; la confirmation finale combine la confirmation du Livreur et celle du Client via `naxa_delivery_finalize_if_confirmed`.
- `naxa_delivery_tracking` filtre explicitement sur `client_id=auth.uid()` ; `naxa_delivery_my_missions` exige le rôle Livreur et l'affectation active ; `naxa_delivery_my_performance` agrège les offres du Livreur connecté.
- Les RPC du circuit Livreur examinées ne sont pas exécutables par `anon`. Les fonctions de rapprochement SMS et d'auto-confirmation paiement sont réservées au `service_role`.

### 4. Verdict du circuit Livreur

- **PASS structurel :** contrôle de l'autorité d'invitation/affectation, séparation du rôle Livreur, gate préparation Stock, gate paiement, acceptation liée à la pharmacie, restriction de consultation des missions, et suivi Client limité à sa propre commande.
- **NON PROUVÉ / BLOQUANT E2E :** aucune invitation réelle, acceptation, affectation multi-pharmacie, notification reçue, mission préparée, acceptée, retirée, suivie ou terminée n'a été exécutée sur Replay ; aucune preuve UI Web/PWA/APK n'a été obtenue. La présence des fonctions SQL ne suffit pas à certifier la fonctionnalité complète.
- **À vérifier :** idempotence et concurrence sur acceptation simultanée ; comportement quand un Livreur change d'espace actif ou perd son affectation pendant une mission ; révocation/suspension pharmacie en cours de livraison ; confidentialité des coordonnées/adresse/téléphone ; notifications push réelles ; synchronisation offline et redémarrage Android.

### Point de reprise exact

1. Dès qu'une session Promoteur/Pharmacie et un compte Client de test contrôlés sont disponibles, exécuter le cycle d'invitation Livreur et son acceptation ; vérifier l'affectation et l'exclusivité du rôle.
2. Préparer une commande via le Gestionnaire Stock, puis tenter la publication avant/après préparation et avant/après paiement : seuls les cas conformes doivent réussir.
3. Tester deux Livreurs en acceptation concurrente, refus, expiration, révocation, suspension pharmacie, changement de rôle actif et affectation multi-pharmacie.
4. Terminer le trajet avec les deux confirmations, vérifier la clôture, le stock, les paiements, les notifications et le suivi Client ; rejouer sur Web, PWA installée et APK Android physique.
5. Joindre les preuves UI, RPC, tables/events, notifications reçues, JWT et plateformes au manifeste E2E ; aucun statut fonctionnel Livreur ne doit être déclaré vert avant ces preuves.

---

## 10. Itération sécurité Replay — droits SQL par défaut et contrôles d'affectation (20/11/2026)

### 10.1 Constat initial et cause racine

- Inventaire SQL : **276 relations publiques** (tables, partitions, vues et relations assimilées) actuellement détenues par le rôle PostgreSQL `postgres`.
- Les ACL par défaut du propriétaire `postgres` accordaient à `anon` et `authenticated` un ensemble trop large de privilèges sur les nouvelles tables : notamment DML, `TRUNCATE`, `REFERENCES`, `TRIGGER` et `MAINTAIN`.
- Avant correction, les tables sensibles échantillonnées (`profiles`, `exam_staff_assignments`, `exam_results`, `reservations`) portaient effectivement ces droits pour `anon` et `authenticated`. Les politiques RLS de lecture examinées ciblaient `authenticated`, pas `anon`; les lectures anonymes de l'échantillon sensible avaient retourné zéro ligne. Cela ne neutralisait toutefois pas le privilège `TRUNCATE`, qui n'est pas filtré par RLS.
- Aucun chemin PostgREST d'exécution SQL arbitraire n'a été démontré : le constat est un **sur-privilège de rôle à supprimer**, pas la preuve d'une exploitation à distance.
- Aucune politique RLS `INSERT/UPDATE/DELETE/ALL` destinée à `anon` n'existe dans le schéma `public` au moment du contrôle. Les écritures anonymes directes ne sont donc pas un besoin produit identifié.

### 10.2 Correction source + Replay

- Migration versionnée ajoutée sur `main` : `supabase/migrations/20261120093000_harden_public_table_grants.sql`.
- Commit source : `30337fbf8aed3d939d777070a012b1a923460390`.
- Migration appliquée avec succès sur Replay sous le nom `harden_public_table_grants`, version enregistrée : `20261120083929`.
- La première tentative incluant les ACL par défaut du rôle `supabase_admin` a échoué avec `42501 permission denied to change default privileges`. La transaction a été abandonnée ; aucun changement partiel n'a été conservé. Le contrôle des propriétaires a établi que les 276 relations publiques courantes appartiennent à `postgres`. La migration source a donc été corrigée pour ne modifier que les ACL de `postgres`, propriétaire effectif des objets actuels. Les ACL futures de `supabase_admin` ne sont pas modifiées ; aucun objet public courant ne lui appartient.
- Aucun schéma métier, aucune ligne métier, aucune politique RLS et aucune donnée Replay n'ont été modifiés par cette migration.

### 10.3 Tests post-correction — Replay

| Contrôle | Résultat observé | Verdict |
|---|---|---|
| Tables publiques inspectées | 276 | PASS inventaire |
| Tables où `anon` garde INSERT/UPDATE/DELETE/TRUNCATE | 0 | PASS |
| Tables où `authenticated` garde TRUNCATE/REFERENCES/TRIGGER/MAINTAIN | 0 | PASS |
| SELECT anonyme sur l'échantillon de tables publiques | Privilège SELECT conservé ; zéro ligne sensible retournée | PASS limité Replay |
| Défauts futurs du rôle `postgres` | `anon`: SELECT seul ; `authenticated`: SELECT + DML, sans privilèges de maintenance | PASS |
| Table-sonde créée puis annulée dans une transaction | ACL attendues constatées ; transaction ROLLBACK | PASS |
| Migration enregistrée dans l'historique Replay | `20261120083929` | PASS |
| Contrôle des lectures anonymes avant/après | 0 ligne sur profils, résultats/contenus d'examens, affectations, réservations et produits partenaires | PASS limité aux données Replay présentes |

### 10.4 Contrôles d'affectation et de livraison

- `exam_staff_assignments` possède un trigger `exam_staff_assignment_guard`. Le membre ne peut pas modifier lui-même `user_id`, `center_id`, `role_key`, `is_active`, `revoked_at`, `assigned_by` ou `note`; les modifications de gestion exigent la capacité `staff_manage`. Cela protège structurellement la politique de mise à jour personnelle, mais ne remplace pas un test sous session Auth réelle.
- Les RPC Livreur vérifiées contrôlent le rôle actif, l'affectation et le périmètre pharmacie. `naxa_delivery_make_available` exige la préparation physique confirmée (`prete_au_retrait`) et un mode de paiement sélectionné/vérifié avant de publier une mission. `naxa_delivery_accept` revalide pharmacie active, mission disponible, préparation, paiement et affectation active. Ces éléments restent une **revue de code SQL**, pas un E2E fonctionnel.
- Les politiques SELECT multiples sur examens, profils et réservations sont des politiques séparées par persona. Leur nombre seul ne prouve pas une fuite ; les expressions RLS doivent être validées avec des JWT Client, personnel, Admin et inter-tenant.

### 10.5 État des alertes et blocages restants

Contrôle Supabase Security Advisor après migration :

| Alerte | Niveau / volume | État |
|---|---:|---|
| RLS activé sans policy | INFO / 73 | À justifier table par table ; ne pas ajouter de policy permissive par réflexe |
| Fonctions SECURITY DEFINER exécutables par anon | WARN / 3 | Revue individuelle des trois fonctions publiques de catalogue à achever |
| Fonctions SECURITY DEFINER exécutables par authenticated | WARN / 262 | Revue ciblée des RPC sensibles et des façades exposées à poursuivre ; l'alerte globale ne signifie pas 262 failles |
| Protection des mots de passe compromis désactivée | WARN / 1 | **BLOQUANT** jusqu'à preuve d'activation dans les paramètres Auth Supabase |

Autres limites non levées :
- Les ACL par défaut du rôle `supabase_admin` ne sont pas modifiables avec le rôle SQL de cette connexion (`postgres` non-superuser et non membre de `supabase_admin`). Aucun objet public courant n'en dépend ; si la plateforme crée ultérieurement des objets publics sous ce propriétaire, il faudra revoir leur ACL.
- Les tests SQL `SET ROLE anon` ne remplacent pas des requêtes REST PostgREST avec la vraie clé publique et des JWT représentatifs. Les tests Client/Personnel/Admin et les refus inter-tenant sous sessions réelles restent BLOQUÉS faute de sessions de test disponibles.
- L'interface Supabase Auth ne peut pas être réglée/vérifiée par les outils SQL utilisés ici : la protection contre les mots de passe compromis reste à confirmer dans le Dashboard.
- Les 73 tables RLS sans policy ne sont pas réputées vulnérables par défaut : l'accès direct est normalement fermé ; il faut confirmer leurs privilèges, leurs usages via fonctions SECURITY DEFINER et leur caractère interne.
- Les builds/tests Web, PWA installée, APK natif et appareils physiques restent distincts. Aucun résultat SQL ne vaut PASS de parité 3/3.

### 10.6 Gouvernance et reprise exacte

- Travail effectué sur `main` ; aucun nouveau branchement/PR.
- `vercel.json` relu : `git.deploymentEnabled.main=false`. Aucun déploiement n'a été lancé.
- Environnement modifié : Replay uniquement (`pwfftcsjyeibxxqhwysw`). Production non touchée.
- **Verdict :** correction ACL Replay **PASS** et migration source versionnée ; audit sécurité global toujours **PARTIEL / NON VERT**, pas de certification Go Live.

**Point exact de reprise :**
1. Examiner les 3 fonctions SECURITY DEFINER exécutables par `anon` (définition complète, grants, exposition REST et absence de fuite).
2. Poursuivre la revue des RPC SECURITY DEFINER sensibles (Admin, paiements, affectations, rôles, stock, livraison), en séparant les façades authentifiées des helpers internes.
3. Classer les 73 tables RLS sans policy par grants, propriétaire, exposition PostgREST et appels indirects.
4. Vérifier la protection des mots de passe compromis dans Supabase Auth Dashboard.
5. Obtenir des sessions Auth de test distinctes (Client A/B, Promoteur, Pharmacie, personnel, Admin) pour les tests REST/UI négatifs et positifs.
6. Reprendre les E2E Web/PWA/APK et les essais sur appareils physiques ; ne certifier aucun lot sans preuve du même commit candidat.

### 10.7 Revue des trois fonctions SECURITY DEFINER exécutables par anon

- `get_universe_catalog_v2(text)` : fonction SQL `STABLE SECURITY DEFINER`, `search_path` vide. Elle renvoie des champs de catalogue/offre destinés à l'affichage public (nom, marque, catégorie, description, photo, prix, quantité disponible, établissement), avec filtres d'état actif, publication, établissement visible/non-démo, disponibilité, dates et feature flags. Les univers Parapharmacie et Bébé & Maman sont conditionnés par leurs flags et publications ; les lignes pharmaceutiques sont filtrées par pharmacie active/visible/non-démo et offre de stock disponible. Aucun champ de compte, identité Client, paiement ou résultat médical n'est retourné dans la signature observée.
- `marketplace_offre_stock_disponible(uuid,uuid)` : façade SQL `STABLE SECURITY DEFINER`, `search_path` vide, délègue au helper privé `marketplace_offre_stock_disponible_guarded`. Celui-ci exige une pharmacie active, visible, non-démo et non archivée ; exclut les stocks sans mise à jour de quantité récente (48 h), les lots bloqués/expirés et les quantités réservées. Il ne renvoie que prix et quantité disponibles.
- `marketplace_produit_visible(uuid)` : fonction SQL `STABLE SECURITY DEFINER`, `search_path` vide ; retourne un booléen indiquant l'existence d'un stock lié à une pharmacie active, visible, non-démo et non archivée. Pas de donnée personnelle ou financière retournée. Ce booléen révèle uniquement une présence catalogue/stock agrégée, à conserver comme surface publique intentionnelle et à revalider si sa consommation applicative change.
- Test sous `SET LOCAL ROLE anon` : les trois fonctions ont été appelées avec identifiants inconnus ; `marketplace_offre_stock_disponible` n'a renvoyé aucune ligne et `marketplace_produit_visible` a renvoyé `false`. `get_universe_catalog_v2` a renvoyé 0 ligne pour Pharmacie, Parapharmacie, Bébé & Maman et Examens sur Replay.
- **Limite de preuve :** Replay ne contient actuellement aucune offre publique éligible ni produit partenaire actif ; ces résultats vides prouvent l'absence de fuite sur l'échantillon vide, pas le bon fonctionnement d'une offre publique réelle. Les scénarios positifs doivent être exécutés avec une fixture publique autorisée et les flags verrouillés.
- Verdict : **revue statique favorable / test négatif limité PASS / test positif BLOQUÉ par absence de fixtures**. L'alerte Advisor de 3 fonctions reste à justifier ou à faire disparaître par une configuration de grants explicitement validée ; ne pas révoquer EXECUTE sans vérifier les appels publics attendus côté Client.

### 10.8 Contrôle des 65 tables RLS sans policy et des vues publiques

- Requête indépendante sur `pg_class` + `pg_policies` : **65 tables/partitions publiques** ont RLS activé et aucune policy. Le chiffre 73 rapporté par un ancien passage Advisor n'est donc pas reproduit par l'inventaire SQL actuel ; conserver l'écart comme différence de périmètre/version du lint, et ne pas présenter 73 comme nombre actuel de tables.
- Pour les 65 tables sans policy, contrôle ACL individuel : aucun privilège direct `SELECT`, `INSERT`, `UPDATE` ou `DELETE` pour `anon` ou `authenticated`. Les tables concernées couvrent notamment les preuves de paiement, appareils, permissions caisse, invites, journaux de sécurité, données caméra, missions/livraisons, opérations offline et outbox notifications.
- Verdict : **PASS de fermeture de l'accès direct Data API** sur les 65 tables inspectées. Les accès indirects via fonctions `SECURITY DEFINER` restent à examiner selon leur fonction appelante et leurs contrôles ; absence de policy ne signifie pas que les helpers privilégiés sont automatiquement sûrs.
- Inventaire des vues publiques : 5 vues examinées, toutes avec option `security_invoker=true` ; les vues Marketplace exposées à `anon` ont également `security_barrier=true` lorsqu'observé. Cela évite le bypass RLS par privilège du propriétaire de vue.
- Test sous rôle `anon` : `exam_accounting_trial_balance` échoue avec `42501 permission denied for table exam_chart_accounts`, preuve que la vue ne contourne pas les privilèges/RLS des tables sous-jacentes. `marketplace_assurance_conventions` retourne 0 ligne sur les données Replay présentes. Les vues `client_achats` et `v_reservations_ca` ne sont pas accordées à anon.
- Limite : les résultats vides sur Replay ne prouvent pas le comportement avec données réelles. Les vues doivent être testées avec sessions JWT Client A/B, pharmacie A/B, comptable et Admin, en particulier les agrégats financiers par tenant.

### 10.9 Analyse ciblée des 262 fonctions SECURITY DEFINER exposées à authenticated

- Inventaire courant : **262** fonctions publiques `SECURITY DEFINER` avec exécution autorisée à `authenticated`, correspondant au volume de l'alerte Advisor examinée.
- Filtre statique des fonctions dont le corps ne contient pas directement `auth.uid()` : 10 fonctions. Ce filtre est un détecteur de revue, pas un verdict de vulnérabilité : plusieurs délèguent leur contrôle à des helpers qui lisent explicitement `auth.uid()`.
- Revue des 10 cas :
  - `assurance_import_simuler_mode` délègue à `assurance_import_simuler`, qui refuse si `auth.uid()` est nul, exige une fonction professionnelle admissible et vérifie le périmètre pharmacie.
  - `naxa_revoke_privilege` s'appuie sur `naxa_has_privilege` et `naxa_can_manage_privilege_target`. Le helper privé vérifie `auth.uid()`, profil actif, cible différente de l'acteur, affectation active, hiérarchie Promoteur/Responsable et périmètre pharmacie.
  - `naxa_set_caisse_status` délègue à `naxa_can_manage_team_member` et `naxa_can`; les deux contrôlent l'identité via `auth.uid()`, l'état actif, le périmètre pharmacie, la cible Caisse et le privilège de suspension/réactivation.
  - `pos_affichage_client_update` délègue à `can_operate_pharmacy`, qui vérifie la fonction métier issue de `auth.uid()`, le périmètre d'affectation et la pharmacie active.
  - `set_garde` passe par `my_pharmacie()` et `authorize()`; `my_pharmacie` dérive le rôle actif à partir de `auth.uid()`, et `naxa_has_privilege` refuse lorsque l'identité est absente.
  - `validites_pharmacies_admin` et `validites_promoteurs_admin` sont limitées par `is_admin()`, qui appelle le helper privé vérifiant le rôle métier du `auth.uid()`.
  - Les trois fonctions catalogue anonymes ont été examinées dans la section 10.7 ; elles sont des lectures publiques intentionnelles, limitées aux offres/établissements publiables.
- Les fonctions `_stats_admin` et `_stats_pharmacie` n'ont pas de grant EXECUTE à `anon`, `authenticated` ou PUBLIC dans l'ACL observée ; elles ne font pas partie des façades directement exposées identifiées par cette requête.
- Sur les fonctions examinées : aucune faille d'autorisation directe n'a été démontrée dans les corps/helpers lus. La revue ne couvre pas encore les 262 corps un par un, les chemins d'appel applicatifs, ni les essais négatifs sous JWT réels. **Verdict : revue ciblée favorable, audit global des RPC toujours PARTIEL.**

### 10.10 État consolidé après cette itération

| Contrôle | État |
|---|---|
| ACL directes des tables publiques après migration | PASS — 276 relations inspectées |
| 65 tables RLS sans policy | PASS — aucun accès direct anon/authenticated |
| Vues publiques examinées | PASS structurel — security_invoker ; un test anon refusé comme attendu |
| 3 RPC catalogue anon | PASS négatif limité ; positif bloqué faute d'offres Replay |
| 10 fonctions exposées sans auth.uid() direct | PASS de revue des helpers examinés ; pas encore E2E JWT |
| Revue exhaustive des 262 fonctions SECURITY DEFINER | PARTIEL |
| Protection Auth contre mots de passe compromis | BLOQUANT — réglage Dashboard non vérifié |
| Exposition réelle des schémas PostgREST | NON PROUVÉE par la connexion SQL seule |
| Tests JWT Client/Personnel/Admin et isolation inter-tenant | BLOQUÉS faute de sessions de test |
| E2E Web/PWA/APK + appareils physiques | NON TERMINÉS |

**Reprise exacte suivante :**
1. Examiner les fonctions SECURITY DEFINER restantes par lots métier (paiement, suspension/réactivation, profil/roles, réservation/stock, examen médical, livraison), en lisant les corps complets et helpers privés.
2. Vérifier les vues et fonctions exposées par PostgREST avec les vrais paramètres Dashboard, puis tester les réponses HTTP avec clé publique et JWT réels.
3. Faire activer et prouver la protection des mots de passe compromis dans Auth.
4. Provisionner les sessions de test par rôle sans inventer de comptes ni contourner les contrôles de création.
5. Exécuter les scénarios positifs/négatifs et inter-tenant sur Web, PWA installée et APK physique.

### 10.11 Réconciliation du lint RLS sans policy — 73 confirmés

- L'écart apparent entre les 65 tables publiques et l'alerte Advisor (73) est résolu : inventaire complet par schéma = **65 tables public + 8 tables private = 73**. Le contrôle précédent ne comptait que `public`.
- Les 8 tables `private` concernées sont des états/outbox internes : `client_product_availability_deliveries`, `client_product_availability_state`, `email_delivery_outbox`, `naxa_delivery_event_notification_dedup`, `naxa_offline_lww_config`, `notification_email_outbox`, `notification_push_outbox`, `pharmacy_lot_expiry_notification_dispatches`.
- ACL individuelles des 8 tables `private` : aucun privilège direct `SELECT/INSERT/UPDATE/DELETE` pour `anon` ou `authenticated`.
- ACL individuelles des 65 tables `public` : aucun privilège direct `SELECT/INSERT/UPDATE/DELETE` pour `anon` ou `authenticated`.
- Réconciliation : **73/73 tables RLS sans policy sont fermées en accès direct pour les rôles API contrôlés**. Cela justifie le lint INFO dans ce périmètre, sous réserve de vérifier les appels indirects privilégiés et la liste réelle des schémas exposés PostgREST.
- Le lint n'est donc pas une faille directe démontrée et aucune policy permissive ne doit être ajoutée pour faire disparaître l'alerte. L'action correcte est de conserver les tables internes fermées et d'auditer les fonctions SECURITY DEFINER qui les utilisent.


### 10.12 Revue ciblée des RPC sensibles — paiements, rôles, stock, examens et livraison (20/11/2026)

#### Périmètre et ACL observées sur Replay
- Projet contrôlé : Replay `pwfftcsjyeibxxqhwysw`, état `ACTIVE_HEALTHY`, PostgreSQL 17.11. Production non interrogée ni modifiée.
- Inventaire ciblé des fonctions `SECURITY DEFINER` publiques de paiement, abonnement, affectation/rôle et stock/examens/livraison : les façades utilisateur contrôlées ne sont pas exécutables par `anon`.
- Les façades métier prévues pour les utilisateurs sont exécutables par `authenticated` et portent des contrôles d'identité, de rôle, d'affectation ou de périmètre ; les fonctions d'ingestion/rapprochement/confirmation automatiques examinées sont réservées à `service_role` (non exécutables par `anon` ni `authenticated`).
- Cette séparation ACL ne prouve pas à elle seule que le serveur appelant une RPC `service_role` authentifie correctement l'utilisateur final : les call-sites serveur restent à relier et auditer.

#### Contrôles statiques ciblés
- **Paiement Client / livraison :** `naxa_client_set_delivery_payment_mode` exige `auth.uid()`, réservation du Client connecté, confirmation préalable de la livraison et état admissible ; `naxa_client_declarer_paiement_livraison` vérifie le propriétaire Client, le mode, l'état de commande, la référence et l'unicité dans la pharmacie. La variante `naxa_client_declarer_paiement_livraison_v2` est `service_role` uniquement.
- **Liste et confirmation de paiement :** `naxa_delivery_pending_payment_list` et sa variante v2 exigent l'acteur Caisse autorisé pour la pharmacie. `admin_confirmer_reglement_partenaire` exige que `p_admin = auth.uid()`, `is_admin()` et un profil Admin actif ; les façades Admin de liste/refus contrôlent également `is_admin()` et l'activité du profil. `partner_soumettre_reglement_abonnement` exige un profil actif et l'appartenance titulaire (`owner`) au partenaire concerné.
- **Frontière serveur paiement :** les fonctions de création/déclaration d'intention de paiement univers/commande, rapprochement SMS, capture et confirmation automatique sont ACL `service_role` uniquement dans l'inventaire consulté. Leur appelant serveur et l'association stricte entre JWT entrant, réservation/partenaire et paramètre Client restent à vérifier dans les routes/Edge Functions.
- **Rôles et affectations :** `naxa_select_active_role` exige une session Auth et un profil actif ; le corps vérifie les droits de sélection selon l'affectation, le membre titulaire, l'état du partenaire, l'univers et le paiement confirmé. `naxa_grant_livreur_assignment` exige une session, une cible active/majeure/complète/consentante avec e-mail confirmé, une pharmacie active et une autorité Promoteur/Pharmacie/Admin conforme au périmètre. `naxa_revoke_professional_assignment` exige une session, une affectation active et une autorité hiérarchique ou Admin. `naxa_set_professional_assignment_status` passe par les privilèges serveur de suspension/réactivation Caisse.
- **Stock :** les façades inspectées (`gestionnaire_stock_commande_preparation`, `gestionnaire_stock_confirmer_demande_livraison`, `offline_stock_set_quantity`, gestion des lots et sessions de stock) contrôlent session, pharmacie cible, affectation/privilège Stock et état de l'objet ; le chemin de livraison reste conditionné à la préparation et au paiement requis.
- **Examens :** `book_exam_appointment` exige un Client actif connecté, un créneau ouvert/non expiré et disponible, un seul choix service/pack ; les RPC de gestion des statuts de centre/pack/service exigent un Admin actif et le respect des flags/états de publication. Les fonctions de dispatch de rappels sans grant utilisateur sont réservées au traitement serveur.
- **Caisse POS :** `vente_ajouter_paiement` exige une session, une vente brouillon et `is_admin()` ou `can_operate_pharmacy()`; les modes électroniques sans confirmation opérateur intégrée sont explicitement refusés.

#### Test négatif sans JWT — rôle PostgreSQL authenticated
Transaction de test annulée par ROLLBACK ; `current_user=authenticated`, `auth.uid()=NULL`. Résultats observés :
| RPC appelée sans session | Réponse observée | Verdict |
|---|---|---|
| `naxa_select_active_role('client',NULL,NULL)` | `Connexion requise` | PASS refus sans identité |
| `naxa_grant_livreur_assignment(...)` | `Connexion requise` | PASS refus sans identité |
| `naxa_client_set_delivery_payment_mode(...)` | `Connexion requise` | PASS refus sans identité |
| `naxa_delivery_pending_payment_list(...)` | `La liste des paiements est réservée à la Caisse active de cette pharmacie` | PASS refus sans acteur Caisse |

Aucune mutation n'a été conservée. Ce test ne remplace pas un appel PostgREST avec JWT signé, ni les tests positifs/negatifs multi-tenant avec comptes Client/Promoteur/Pharmacie/Caisse/Admin.

#### Contradictions, limites et verdict
- Aucune vulnérabilité exploitable n'est démontrée par cette passe sur les façades et chemins explicitement inspectés ; les contrôles de rôle et de périmètre sont présents dans les définitions SQL examinées.
- Le filtre de nom et les extraits SQL ne constituent **pas** une revue exhaustive des 262 fonctions `SECURITY DEFINER`. Les dépendances de helpers, fonctions appelantes, vues, routes serveur et appels service_role ne sont pas tous cartographiés.
- Le Security Advisor relancé après les contrôles conserve les mêmes constats : 73 RLS sans policy (INFO), 3 fonctions catalogue `SECURITY DEFINER` exécutables par anon (WARN), 262 fonctions `SECURITY DEFINER` exécutables par authenticated (WARN) et protection des mots de passe compromis désactivée (WARN). Ces volumes sont des alertes de surface, pas 265 failles prouvées.
- **Verdict : PASS limité de revue statique et des refus sans JWT ; revue exhaustive des RPC = EN COURS ; tests avec JWT réel = BLOQUÉS ; sécurité globale = NON VERTE.**
- Aucune correction ACL supplémentaire n'est justifiée sur les RPC inspectées à ce stade ; ne pas révoquer globalement les grants `authenticated` ni déplacer les façades métier sans cartographie des usages.

#### Point exact de reprise
1. Auditer les routes API/Server Actions/Edge Functions qui appellent les RPC `service_role` de paiement : vérifier l'identité JWT entrante, le lien Client/commande/partenaire, les paramètres acceptés et l'absence d'IDOR.
2. Poursuivre la revue des autres fonctions `SECURITY DEFINER` par domaines (POS/comptabilité, résultats d'examens, données Client/santé, stockage et notifications), en remontant chaque helper.
3. Obtenir des sessions Auth de test distinctes et exécuter les cas positifs/négatifs/inter-tenant via PostgREST.
4. Faire activer et vérifier dans Auth Dashboard la protection contre les mots de passe compromis.
5. Reprendre les recettes UI Web/PWA/APK et appareils physiques ; aucun PASS SQL ne certifie la parité utilisateur.


### 10.13 Correction d'un contrôle de suspension dans les transitions de réservation universelle (20/11/2026)

#### Contradiction et cause racine
- La revue de `public.transition_universe_reservation(uuid,text)` a révélé que le booléen Admin était calculé avec `profiles.role='admin'` sans condition `profiles.actif=true`.
- Le contrôle des membres partenaire vérifiait le lien et le rôle (`owner/manager/operator`) mais ne vérifiait pas explicitement `partners.status='active'`.
- La fonction ne refusait pas en amont un profil globalement suspendu. Cela contredisait la règle NAXA selon laquelle `profiles.actif` est indépendant des rôles/adhésions et prévaut sur l'accès aux espaces.
- Aucun accès non autorisé n'a été démontré sur des données métier réelles ; il s'agissait d'une faiblesse de contrôle statique, corrigée avant de déclarer le parcours conforme.

#### Correction appliquée
- Migration source créée sur `main` : `supabase/migrations/20261120103000_guard_active_profile_universe_reservation.sql`.
- Migration appliquée sur Replay uniquement : `guard_active_profile_universe_reservation`.
- La fonction vérifie désormais, avant lecture/transition, que `auth.uid()` existe et que le profil global est actif.
- Le rôle Admin est reconnu uniquement si le profil correspondant est actif.
- La gestion partenaire exige une adhésion autorisée et un partenaire dont `status='active'`.
- `search_path` de la fonction `SECURITY DEFINER` est désormais vide ; les objets utilisés sont qualifiés par schéma.
- Les grants ont été réaffirmés explicitement : `authenticated` et `service_role`, sans accès `anon`/PUBLIC.

#### Tests Replay
Tests exécutés dans une transaction annulée par `ROLLBACK`, en simulant la revendication JWT PostgreSQL `request.jwt.claim.sub` sous le rôle `authenticated` (ceci n'est pas un JWT signé ni un appel HTTP PostgREST) :
| Cas | Résultat observé | Verdict |
|---|---|---|
| Profil Admin actif, réservation inexistante | `Réservation introuvable` — le contrôle d'activité laisse passer l'identité active jusqu'au contrôle de ressource | PASS limité |
| Même profil temporairement passé à `actif=false` dans la transaction | `Profil inactif ou suspendu` avant recherche de la réservation | PASS |
| ACL `anon` | `EXECUTE=false` | PASS |
| ACL `authenticated` | `EXECUTE=true` | PASS attendu |
| Configuration fonction | `search_path=""` | PASS |

La transaction a été annulée ; le profil Admin n'a pas été suspendu durablement et aucune réservation/stock n'a été modifié.

#### Vérifications complémentaires et limites
- Le Security Advisor Replay relancé après migration conserve les mêmes catégories/volumes globaux : 73 tables RLS sans policy (INFO), 3 fonctions catalogue SECURITY DEFINER accessibles à anon, fonctions SECURITY DEFINER accessibles à authenticated et protection des mots de passe compromis désactivée. La correction ne vise qu'une fonction et ne peut pas faire disparaître les alertes générales.
- Aucun test positif complet de réservation/confirmation/préparation/retrait n'est possible sur Replay dans cette passe : aucun jeu de réservation/produit partenaire admissible n'a été créé et aucun JWT signé de rôle métier n'est disponible.
- **Verdict : correction SQL appliquée et vérifiée sur Replay ; garde de suspension PASS sur test simulé ; E2E métier signé/non simulé = NON EXÉCUTÉ ; sécurité globale = NON VERTE.**

#### Point exact de reprise
1. Continuer l'audit des RPC restantes en priorité sur les fonctions de transition d'état et les chemins de données sensibles.
2. Vérifier les call-sites serveur et l'authentification des appels `service_role` de paiement.
3. Obtenir des identités Auth de test réelles pour les scénarios multi-tenant.
4. Fermer la configuration Auth de protection des mots de passe compromis et refaire les tests Web/PWA/APK.


### 10.14 Correction du contrôle de suspension dans les transitions de prestations à domicile (20/11/2026)

#### Contradiction et cause racine
- La revue de `public.transition_home_service_request(uuid,text)` a montré que la fonction exigeait une identité Auth, mais ne vérifiait pas directement l'activité globale du profil avant de traiter la demande.
- La branche d'annulation par le Client (`client_id = auth.uid()`) pouvait donc être atteinte sans contrôle `profiles.actif`, même si le contrôle de l'adhésion partenaire vérifiait déjà un profil actif.
- Une suspension globale doit bloquer également les actions Client de cette fonction.

#### Correction appliquée
- Migration source créée sur `main` : `supabase/migrations/20261120104500_guard_active_profile_home_service_transition.sql`.
- Migration appliquée sur Replay uniquement : `guard_active_profile_home_service_transition`.
- Ajout d'un contrôle global `profiles.id=auth.uid() AND profiles.actif IS TRUE` avant la lecture et toute transition.
- `search_path` reste vide et les références d'objets sont qualifiées.
- ACL confirmées : aucun `EXECUTE` pour `anon`, `authenticated` conserve l'exécution attendue.

#### Test Replay
Transaction annulée par `ROLLBACK`, rôle PostgreSQL `authenticated`, revendication `request.jwt.claim.sub` simulée (pas de JWT signé/PostgREST) :
| Cas | Résultat | Verdict |
|---|---|---|
| Profil actif, demande inexistante | `Demande introuvable` | PASS limité : identité active acceptée jusqu'au contrôle de ressource |
| Profil temporairement suspendu dans la transaction | `Profil inactif ou suspendu` | PASS : refus avant lecture métier |
| ACL `anon` / `authenticated` | `false / true` | PASS attendu |
| `search_path` | vide | PASS |

Aucune modification de profil n'a persisté et aucune demande n'a été modifiée.

#### Verdict
**Correction appliquée et testée sur Replay ; garde de suspension PASS sur test de revendication simulée ; E2E métier avec JWT signé = NON EXÉCUTÉ ; sécurité globale = NON VERTE.**

#### Point exact de reprise
Poursuivre l'examen des fonctions de transition Client/Partenaire et des fonctions qui acceptent un identifiant d'utilisateur en paramètre, en vérifiant systématiquement le statut global du profil et le statut du partenaire avant toute mutation.
