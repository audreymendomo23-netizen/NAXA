# Relais vidéo NAXA — MediaMTX

## Ce paquet ne lance rien à lui seul

Il contient la configuration cible pour un relais MediaMTX autonome. Aucun serveur, DNS, certificat ou service Vercel n'est créé par le dépôt.

## Prérequis de l'hôte

- Docker Engine et Docker Compose récents.
- Un nom DNS public réservé au relais, par exemple video.example.com.
- Un nom DNS HTTPS pour NAXA, par exemple app.example.com.
- Un certificat TLS public valide pour le relais, avec clé privée correspondante.
- Ports entrants limités au besoin : TCP 8322 (RTSPS), TCP 8889 (WHEP/HTTPS), UDP 8189 (ICE/WebRTC).
- Pare-feu : ne pas exposer 8554 non chiffré, 9997 API, 9998 métriques ou 9999 PPROF.

## Préparation

1. Remplacer app.example.com et video.example.com dans mediamtx.yml.
2. Créer secrets/ avec permissions restrictives et y placer mediamtx.crt et mediamtx.key ; ne jamais committer ces fichiers.
3. Configurer le DNS, le reverse DNS si nécessaire et les règles réseau.
4. Valider le certificat et les ports depuis un poste extérieur.
5. Configurer côté NAXA Preview uniquement NAXA_MEDIAMTX_PUBLIC_URL=https://video.example.com:8889.
6. Démarrer uniquement après validation des endpoints HTTPS NAXA et MediaMTX.

## Contrôles de sécurité inclus

- Image Docker versionnée bluenviron/mediamtx:1.21.3.
- RTSPS strict ; le listener RTSP non chiffré reste désactivé.
- WebRTC avec HTTPS pour le handshake et médias WebRTC chiffrés.
- Authentification HTTP NAXA pour toutes les actions, sans exclusion.
- Origine navigateur unique.
- API de contrôle, métriques, PPROF et lecture d'enregistrements désactivés.
- Système de fichiers en lecture seule, privilèges Linux supprimés, pas de privilèges supplémentaires.
- Publication de contenu seulement par publisher ; remplacement d'un publisher existant désactivé.
- Enregistrement vidéo désactivé par défaut. Aucune conservation vidéo n'est activée sans règle de durée, finalité, accès et suppression validée.

## Blocage volontaire en phase 8

L'endpoint d'authentification NAXA livré à la phase 8 autorise uniquement action=read et protocol=webrtc. Les publications entrantes RTSPS sont donc refusées jusqu'à l'implémentation de la phase 9 : jeton de publication court lié à une passerelle/caméra et agent sortant local. Ne pas modifier le serveur pour contourner ce refus.
