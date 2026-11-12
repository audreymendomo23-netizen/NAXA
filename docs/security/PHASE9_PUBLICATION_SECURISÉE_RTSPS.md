# Phase 9 — Publication sécurisée des flux caméra

Date : 8 novembre 2026
Branche : qa/e2e-stabilisation-20261106

## Publication authentifiée

La passerelle enrôlée demande un ticket temporaire à NAXA avec une requête Ed25519 signée et anti-rejeu. Le ticket aléatoire de 256 bits est limité à une passerelle, une caméra, une pharmacie et un chemin MediaMTX déterministe ; seul son hash SHA-256 est conservé dans Supabase. MediaMTX revalide le ticket au handshake RTSPS.

La demande exige une passerelle connectée, enrôlée par clé Ed25519 active, avec heartbeat de moins de 120 secondes ; une installation pilote avec validations juridique et notice approuvées ; une pharmacie active/publiée ; et une connexion caméra primaire connectée avec capacité live_view testée dans les 15 dernières minutes.

## Configuration locale de la caméra

Après enrôlement, la source RTSP/RTSPS est fournie sur stdin, jamais comme argument de commande :

    printf '%s' 'rtsp://utilisateur:mot-de-passe@192.168.1.20:554/Streaming/Channels/101' | node agent.cjs configure-stream --camera-id <uuid> --source-stdin

Les sources sont limitées aux IP privées RFC1918/link-local ou DNS local (.local, .lan, .home.arpa ou hôte local simple). L'URI source est chiffrée AES-256-GCM dans camera-streams.enc, avec clé séparée mode 0600 et dossier mode 0700. FFmpeg doit être installé par l'administrateur système.

Le service publie chaque source configurée vers le relais par RTSPS, en copie vidéo sans audio ni transcodage, sans shell, et renouvelle le ticket à chaque reconnexion. Le codec source doit être compatible avec la lecture navigateur ; H.264 est la cible initiale, H.265 n'est pas déclaré compatible.

## État et confidentialité

La passerelle signale online après observation d'au moins une frame FFmpeg puis offline à la sortie du processus. Les deux transitions passent par une requête Ed25519 signée et un RPC SQL atomique avec audit.

Le service systemd ajoute ProtectProc=invisible et ProcSubset=pid. Les URI caméra et tickets sont requis dans les arguments du processus FFmpeg ; ils ne sont jamais journalisés. Root et le compte de service restent de confiance et peuvent inspecter leurs propres processus. Aucun secret caméra n'est envoyé à Supabase ou au navigateur. Audio et enregistrement restent désactivés.

## Variable Preview

    NAXA_MEDIAMTX_RTSPS_URL=rtsps://video.example.com:8322

Cette variable est attendue côté NAXA Preview uniquement. Le serveur MediaMTX n'est pas déployé par ce commit. DNS, certificat TLS, ports réseau et installation FFmpeg restent des opérations d'installation sur les hôtes ciblés.

## Limites de validation

Cette phase construit le publisher et le contrôle de statut, mais aucun matériel caméra réel, aucune passerelle pilote configurée, aucun flux physique ni serveur MediaMTX opérationnel n'étaient disponibles pour un test d'intégration. Elle ne valide pas tous les modèles ni firmwares.
