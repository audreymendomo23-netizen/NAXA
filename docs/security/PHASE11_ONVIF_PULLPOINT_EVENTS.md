# Phase 11 — Collecteur d’événements ONVIF Pull-Point

Date : 8 novembre 2026
Branche : qa/e2e-stabilisation-20261106

## Fonctionnement

Le diagnostic ONVIF récupère l'endpoint Events annoncé par GetCapabilities, seulement si son XAddr vise l'adresse IPv4 privée exacte de la caméra. Le collecteur local crée une souscription Pull-Point, récupère les notifications avec PullMessages et tente Unsubscribe à l'arrêt. Toutes les requêtes sont initiées par la passerelle, sans port entrant. Le point de collecte recrée la souscription après huit minutes afin de ne pas dépendre de sa durée maximale annoncée.

Les réponses SOAP sont lues en streaming et plafonnées à 32 Ko avant accumulation en mémoire ; les DTD/entités XML sont refusées.

## Identifiants

Configurer l'utilisateur caméra par stdin, jamais dans les arguments :

    printf '%s' '{"cameraId":"<uuid>","sourceAddress":"192.168.1.20","endpoint":"http://192.168.1.20/onvif/events","username":"utilisateur","password":"mot-de-passe"}' | node agent.cjs configure-onvif-events --credentials-stdin

Les paramètres sont chiffrés AES-256-GCM dans onvif-events.enc ; la clé locale est partagée avec le magasin caméra chiffré, séparée et mode 0600. Les identifiants ne sont jamais envoyés à NAXA. Les appels utilisent WS-Security UsernameToken PasswordDigest, nonce aléatoire et horodatage ; privilégier HTTPS caméra quand disponible, le digest ne remplace pas le chiffrement du transport.

Le SubscriptionReference doit viser la même adresse IPv4 privée que la caméra. Toute redirection ou destination externe est refusée.

## Normalisation

Les topics ONVIF de mouvement, intrusion, franchissement, sabotage, obstruction et perte de signal sont normalisés puis signés par la passerelle et transmis à l'API d'événements NAXA. Les notifications de mouvement déclarant IsMotion=false sont ignorées. Les topics inconnus sont classés other, sans supposer qu'il s'agit d'une intrusion.

La gravité est attribuée côté serveur. La qualification finale demeure une revue humaine Promoteur. Ce collecteur transporte les événements générés par la caméra ; il n'ajoute pas de modèle IA.

## Limites

Un service Events annoncé par GetCapabilities ne garantit pas que chaque caméra implémente Pull-Point ni les mêmes topics. Chaque modèle et firmware exige un essai local. Aucun abonnement ni événement physique n'a encore été validé sur matériel réel dans cet environnement.

Les notifications Android, l'enregistrement, les clips et la commande physique de sirène restent à construire.
