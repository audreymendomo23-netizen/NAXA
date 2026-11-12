# Phase 8 — Autorisation de lecture vidéo WebRTC

Date : 8 novembre 2026
Branche : qa/e2e-stabilisation-20261106

## Périmètre livré

Cette phase ajoute le plan de contrôle NAXA pour une lecture WHEP/WebRTC via MediaMTX :
- émission d'un ticket aléatoire 256 bits, valable 15 minutes ;
- seul le hash SHA-256 du ticket est stocké ;
- ticket lié à une caméra, une pharmacie, une passerelle, un compte Promoteur et un chemin média déterministe ;
- quatre sessions actives maximum par Promoteur, avec verrou transactionnel ;
- audit camera_live_view créé dans la même transaction ;
- autorisation MediaMTX limitée à action=read, protocol=webrtc et au chemin exact ;
- nouvel examen de l'installation, de la pharmacie, du compte, de la passerelle et de la capacité live_view lors du handshake ;
- lecteur navigateur WHEP avec fermeture de ressource et renouvellement avant expiration.

Le navigateur ne reçoit ni endpoint caméra, ni URI RTSP, ni identifiant de caméra. Le lecteur ne reçoit qu'un ticket média temporaire du serveur NAXA. À la fermeture, il supprime la ressource WHEP puis demande la révocation du ticket ; même si cette requête échoue, l'expiration MediaMTX reste la limite de durée.

## Variables Preview nécessaires

Définir uniquement dans l'environnement Preview lié à Supabase Replay :

    NAXA_MEDIAMTX_PUBLIC_URL=https://video.example.invalid

La valeur doit être une origine HTTPS seule, sans chemin, identifiant, query ou fragment. Aucun secret MediaMTX n'est placé dans le navigateur.

## Configuration MediaMTX à adapter sur le serveur média

Activer le contrôle d'accès HTTP externe et le lecteur WebRTC :

    authMethod: http
    authHTTPAddress: https://<domaine-naxa>/api/security/mediamtx/auth
    authHTTPExclude: []

    webrtc: true
    webrtcAddress: :8889
    webrtcEncryption: true
    webrtcAllowOrigins:
      - https://<domaine-naxa>

Le reverse proxy doit exposer le port WebRTC HTTPS, autoriser les méthodes POST, DELETE et OPTIONS WHEP, les en-têtes Authorization et Content-Type, exposer l'en-tête Location au navigateur, et appliquer CORS uniquement depuis le domaine NAXA. Ne jamais activer l'API de contrôle MediaMTX publiquement. Un paquet de configuration versionné est fourni dans infra/security/mediamtx/. Il impose TLS RTSPS/WebRTC, l'authentification HTTP, désactive l'API/les métriques et laisse l'enregistrement désactivé.

Le chemin logique de chaque caméra est :

    naxa/<pharmacie_uuid>/<camera_uuid>

MediaMTX transmet ses demandes d'authentification à l'endpoint NAXA. Le service n'autorise que read en webrtc, vérifie le ticket hashé, son chemin exact et sa date d'expiration, puis renvoie expireAt. Les autres actions/protocoles sont refusés.

## Préconditions d'ouverture

Le ticket n'est émis que si :
- le compte est un Promoteur actif et son accès commercial est valide ;
- la pharmacie est active, publiée, non archivée et dans son réseau autorisé ;
- l'installation est pilot_active, avec validations juridique et information des personnes approuvées ;
- la passerelle est connectée et son heartbeat date de moins de 120 secondes ;
- la caméra est online ;
- le connecteur primaire est connected, récemment testé, avec capacité live_view.

Une absence de configuration MediaMTX ou un état non confirmé ferme l'accès. Aucun état inconnu n'est transformé en succès.

## Limite majeure non levée

Ce lot livre le contrôle d'accès et le lecteur WebRTC, pas le transport de la caméra jusqu'au serveur média. Il manque encore l'ingestion sortante de chaque flux depuis la passerelle de pharmacie vers MediaMTX, avec stockage local sécurisé des identifiants caméra et une politique de reconnexion. Les flux ne pourront donc s'afficher qu'après déploiement et configuration du MediaMTX, puis activation d'un publisher passerelle sur le chemin correspondant.

Aucune caméra physique, aucun flux RTSP et aucun réseau réel n'ont été testés à cette phase. Le paquet MediaMTX n'a pas été déployé et le publish RTSP reste volontairement refusé tant que le jeton de publication dédié et l'agent passerelle sortant de la phase 9 ne sont pas livrés. Le serveur média n'a pas été déployé, aucune variable Vercel n'a été créée et aucun déploiement n'a été lancé.

## Contrôles automatisés

Le test scripts/test-security-live-stream-auth.cjs vérifie les garde-fous du schéma, l'émission du ticket, le filtrage des actions/protocoles, le rattachement au chemin et le lecteur WHEP. Ces assertions de structure ne remplacent pas le test d'intégration MediaMTX et les essais caméra réels.
