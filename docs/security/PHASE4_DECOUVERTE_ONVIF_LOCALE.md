# Phase 4 — Découverte ONVIF locale contrôlée

Date : 8 novembre 2026  
Branche : `qa/e2e-stabilisation-20261106`  
État : sonde WS-Discovery et filtre local implémentés ; tests de parsing ajoutés ; aucun matériel réel disponible pour validation terrain.

## Objectif et périmètre

La passerelle locale peut émettre une sonde ONVIF WS-Discovery pour découvrir les caméras IP et enregistreurs qui annoncent un service ONVIF sur le même segment IPv4. Cette étape n'ouvre aucun flux vidéo et n'essaie pas d'authentification.

Commande explicite sur la passerelle :

```bash
# Découverte locale uniquement (aucune transmission à NAXA)
sudo node /opt/naxa-security-gateway/agent.cjs discover \\
  --confirm-local-network --timeout-ms 3500

# Après enrôlement de la passerelle : découverte puis rapport signé à NAXA
sudo node /opt/naxa-security-gateway/agent.cjs discover \\
  --confirm-local-network --submit --timeout-ms 3500 \\
  --state-dir /var/lib/naxa-security-gateway
```

La commande est désactivée sans `--confirm-local-network`. Elle envoie une seule sonde multicast vers `239.255.255.250:3702`, avec TTL 1, attend entre 1 et 8 secondes, puis affiche au maximum 64 réponses reconnues.

## Contrôles de sécurité

- Le socket est IPv4 UDP et la sonde ne traverse pas les routeurs grâce au TTL 1.
- Les paquets entrants supérieurs à 16 Kio sont rejetés.
- Les réponses provenant d'une adresse IP publique sont rejetées.
- Les XAddrs doivent être HTTP(S), sans identifiant, mot de passe, query string ni fragment, et viser une adresse privée ou un nom local.
- Aucun GET/POST n'est envoyé vers les XAddrs annoncés.
- Aucun flux RTSP, snapshot, login caméra, mot de passe, clé API ou jeton n'est demandé.
- Sans `--submit`, aucune information découverte n'est envoyée à NAXA ; les résultats restent dans la sortie locale.
- Avec `--submit`, l'agent enrôlé transmet uniquement les métadonnées reconnues dans un rapport HTTPS signé Ed25519, avec horodatage et nonce anti-rejeu. Le serveur vérifie aussi le périmètre pharmacie et le statut de la passerelle.
- Les appareils reçus sont enregistrés dans une file de candidats privée. Ils ne sont pas créés comme caméras actives avant revue humaine du Promoteur.
- La découverte n'est pas appelée par le heartbeat ou le service continu ; elle exige une commande manuelle explicite.

## Limites

Cette fonction détecte les appareils qui répondent à ONVIF WS-Discovery sur le segment local. Elle ne garantit pas la découverte d'un appareil dont le multicast est désactivé, d'un équipement isolé dans un autre VLAN, d'une caméra uniquement cloud, d'une caméra analogique sans encodeur IP ou d'un modèle propriétaire n'exposant pas ONVIF.

La compatibilité RTSP, NVR/DVR, encodeurs analogiques et API constructeur reste traitée par des adaptateurs distincts. Les 15 familles d'adaptateurs précédemment répertoriées restent au stade de conception tant que leurs protocoles exacts et firmwares ne sont pas validés.

## Validation

Les tests automatisés vérifient le parsing des ProbeMatch, le filtrage des sources et endpoints, les limites de taille et le caractère explicitement opt-in de la commande. Ils ne remplacent pas un essai sur un réseau local équipé d'une vraie caméra ONVIF.

**Non validé à ce stade :** découverte sur matériel réel, compatibilité de chaque constructeur/firmware, authentification ONVIF, RTSP et affichage vidéo. Le transport signé et la revue Promoteur sont construits, mais ils n'ont pas encore été exercés avec une passerelle et une caméra physiques.
