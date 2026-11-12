# Phase 7 — Diagnostic ONVIF local des capacités caméra

Date : 8 novembre 2026
Branche : qa/e2e-stabilisation-20261106

## But

Qualifier un appareil réseau identifié avant de l'annoncer comme compatible vidéo. La découverte WS-Discovery ne prouve que la présence d'une annonce réseau ; elle ne prouve pas que le service ONVIF, le service média ou le flux vidéo fonctionne.

## Commande locale

Depuis la passerelle installée dans le même réseau que la caméra :

    sudo node /opt/naxa-security-gateway/agent.cjs inspect --endpoint http://192.168.1.20/onvif/device_service --source-address 192.168.1.20 --confirm-local-network --timeout-ms 4000

Remplacer l'adresse d'exemple par l'endpoint réellement annoncé lors de la découverte. Le diagnostic exige que l'hôte de l'endpoint corresponde exactement à l'IPv4 privée source. Les hôtes publics, redirections, identifiants dans l'URL, paramètres et fragments sont refusés.

## Vérifications

- GetDeviceInformation : fabricant, modèle et version du firmware ;
- GetCapabilities : présence des services média, événements, PTZ, imagerie, E/S et analytics ;
- réponses SOAP plafonnées à 32 Kio ;
- délai maximum configurable entre 1 et 10 secondes.

Aucun identifiant n'est envoyé ou demandé. La commande ne récupère ni profils vidéo, ni URI RTSP, ni image, ni flux. Elle n'envoie aucun rapport à NAXA et ne modifie pas le registre caméra.

## Interprétation stricte

- inspected : le service média ONVIF est annoncé ; ce n'est pas une preuve qu'un flux live fonctionne.
- onvif_without_media : appareil ONVIF mais aucun service média détecté.
- requires_credentials : l'appareil exige un compte ; aucune tentative de contournement.
- not_onvif : la réponse ne correspond pas au service ONVIF attendu.
- unavailable : délai, réseau ou réponse invalide.

## Tests automatisés

Le test scripts/test-security-onvif-inspection.cjs couvre la réponse fabricant/modèle/firmware, les capacités, l'exigence d'identifiants, le refus des endpoints non locaux, les réponses volumineuses et la commande explicite de la passerelle.

Ces tests utilisent des réponses SOAP simulées uniquement pour valider le protocole logiciel. Ils ne sont pas présentés comme des tests de caméras physiques.

## Limites non levées

Cette phase ne réalise pas l'authentification Digest/WS-Security, GetProfiles, GetStreamUri, le test RTSP/RTSPS, le relais WebRTC/HLS, l'enregistrement NVR, les événements IA, l'application compagnon Android ou la sirène. Ils restent des lots distincts et requièrent une pharmacie pilote, les modèles/firmwares réels, une passerelle enrôlée et une infrastructure de média sécurisée.

Aucun secret n'est créé, aucune migration Supabase n'est requise, aucune donnée de production n'est modifiée et aucun déploiement n'est effectué.