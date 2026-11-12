# Relais vidéo NAXA — MediaMTX

## Statut réel du paquet

Ce dossier fournit la configuration versionnée d'un relais MediaMTX autonome. **Il ne déploie ni ne démarre un serveur.** Aucun domaine, certificat, hôte média, DNS, secret runtime ou service de supervision n'est fourni par ce dépôt. Aucun flux caméra physique n'a été validé par la seule présence de ces fichiers.

## Prérequis d'infrastructure

- Hôte Linux dédié avec Docker Engine et Docker Compose récents.
- Domaine HTTPS réservé au relais, par exemple `video.example.com`, et domaine NAXA HTTPS.
- Certificat TLS valide pour le domaine du relais, avec clé privée correspondante.
- Pare-feu et NAT configurés pour les ports nécessaires :
  - TCP 8322 : publication RTSPS depuis les passerelles ;
  - TCP 8889 : handshake WHEP/HTTPS depuis les navigateurs ;
  - UDP 8189 : transport média WebRTC prioritaire ;
  - TCP 8189 : transport média WebRTC de secours lorsque UDP est bloqué.
- Ne pas exposer RTSP non chiffré TCP 8554, API 9997, métriques 9998, PPROF 9999 ou playback.
- L'hôte doit pouvoir appeler par HTTPS l'API NAXA d'authentification.
- DNS, certificat, ports et hôte doivent être contrôlés depuis l'extérieur avant mise en service.

Les domaines ci-dessus sont des exemples ; ils ne sont pas des domaines configurés.

## Configuration NAXA

Sur l'environnement **Preview / QA uniquement** tant qu'un nouveau mandat n'autorise pas davantage :

```dotenv
NAXA_MEDIAMTX_PUBLIC_URL=https://video.example.com:8889
NAXA_MEDIAMTX_RTSPS_URL=rtsps://video.example.com:8322
```

Les valeurs effectives, DNS, certificats et état de disponibilité restent à vérifier sur l'environnement d'exécution ; aucun secret n'est stocké dans le dépôt.

## Installation du relais

1. Remplacer les domaines d'exemple dans `mediamtx.yml`.
2. Créer `secrets/` et y placer `mediamtx.crt` et `mediamtx.key` avec permissions restrictives ; ne jamais committer ces fichiers.
3. Vérifier les montages Docker aux chemins `/run/secrets/mediamtx_tls_cert` et `/run/secrets/mediamtx_tls_key`.
4. Configurer DNS, firewall et NAT pour 8322/TCP, 8889/TCP, 8189/UDP et 8189/TCP.
5. Valider le fichier avec l'image MediaMTX versionnée avant démarrage.
6. Inspecter les logs sans afficher les tickets, URI caméra ou identifiants.

## Contrôle d'accès actuellement codé

La route `/api/security/mediamtx/auth` possède deux chemins distincts :

- `action=publish` + `protocol=rtsp` : contrôle le ticket publisher SHA-256, la passerelle, le chemin média, la caméra, l'installation pilote, les validations juridiques/confidentialité, la pharmacie et la connexion primaire `live_view`. Le ticket expire après 15 minutes et MediaMTX reçoit son `expireAt`.
- `action=read` + `protocol=webrtc` : contrôle le ticket live, le chemin, le compte Promoteur, le lien réseau actif, la pharmacie, la caméra, l'installation et la connexion primaire.

Toute autre action/protocole est refusé. Depuis la phase 9, la publication RTSPS n'est donc plus entièrement bloquée : elle est autorisée uniquement par ticket de courte durée délivré à une passerelle authentifiée et autorisée. Ne contourne jamais cette authentification.

## Contrôles de sécurité inclus

- Image versionnée `bluenviron/mediamtx:1.21.3`.
- RTSPS strict ; listener RTSP non chiffré désactivé.
- WebRTC chiffré et handshake HTTPS/WHEP.
- Authentification HTTP externe NAXA pour toutes les actions (`authHTTPExclude: []`).
- Origine navigateur NAXA unique.
- API de contrôle, métriques, PPROF et playback désactivés.
- Conteneur en lecture seule, privilèges Linux supprimés, `no-new-privileges`, limite PID.
- Publisher existant non remplaçable.
- Enregistrement MediaMTX désactivé (`record: false`). Aucune conservation vidéo n'est activée sans règle de durée, finalité, accès et suppression validée.

## Limite WebRTC / TURN au pilote

La configuration ouvre UDP 8189 (transport prioritaire) et TCP 8189 (transport de secours si UDP est bloqué). Le port TCP doit être routé par le NAT/pare-feu jusqu’au conteneur ; activer ce listener ne prouve pas que le chemin est joignable depuis Internet. Aucun webrtcICEServers2, serveur STUN ni TURN dédié n’est configuré.

Tester le live depuis Wi-Fi et réseau mobile. Si les connexions directes UDP/TCP échouent, provisionner un serveur TURN dédié, créer des identifiants temporaires et limiter leur durée, puis configurer webrtcICEServers2 côté MediaMTX. STUN peut aider à découvrir l’adresse publique et à établir un chemin direct, mais ne remplace pas TURN lorsque le relais est nécessaire. Ne jamais placer des identifiants TURN statiques dans le JavaScript navigateur ni les committer. Aucun STUN/TURN n’est actuellement configuré.
## Validation et limites

- `scripts/test-security-mediamtx-deployment.cjs` vérifie les paramètres versionnés ; il ne démarre pas un serveur.
- La CI valide le code et les contrats statiques ; elle ne prouve ni le démarrage du conteneur, ni DNS/TLS, ni réseau, ni un flux physique.
- MediaMTX n'est pas déclaré déployé. Les variables Preview ne sont pas prouvées configurées.
- Aucun modèle/firmware caméra, passerelle physique, réseau pharmacie, serveur TURN ou lecteur mobile réel n'a été validé dans ce lot.
