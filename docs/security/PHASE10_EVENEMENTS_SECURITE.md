# Phase 10 — Ingestion et revue humaine des événements de sécurité

Date : 8 novembre 2026
Branche : qa/e2e-stabilisation-20261106

## Socle livré

- Route d'ingestion signée Ed25519 et anti-rejeu, réservée à une passerelle enrôlée et active.
- Scope strict : pharmacie de la passerelle et caméra qui lui appartient.
- Empreinte SHA-256 stable par passerelle pour dédupliquer les retransmissions.
- Gravité calculée côté serveur ; un agent ne peut pas imposer une gravité critique.
- Métadonnées limitées à huit champs techniques autorisés ; aucun flux, image, URI ou secret caméra n'est accepté.
- Audit append-only à la réception et lors des décisions humaines.
- Actions Promoteur atomiques : prise en charge, confirmation après vérification, faux positif et clôture.

## Envoi depuis un collecteur local

Un collecteur ONVIF ou un moteur d'analyse local peut envoyer un objet JSON borné par stdin :

    printf '%s' '{"cameraId":"<uuid>","eventType":"motion","sourceType":"onvif","summary":"Mouvement signalé par le périphérique","detectedAt":"2026-11-08T04:30:00.000Z","confidence":null,"metadata":{"event_code":"Rule-1"}}' | node agent.cjs report-event --event-stdin

L'agent produit une empreinte stable, signe la requête Ed25519 et transmet l'événement à NAXA. Une retransmission identique est dédupliquée.

## Gravité et interprétation

Le serveur attribue high aux intrusions, franchissements de ligne et sabotages caméra ; warning aux pertes de signal, obstructions, présences hors horaires et arrêts système ; info aux autres événements. Aucun événement reçu n'est automatiquement marqué critical.

La source edge_ai est acceptée par le contrat d'ingestion, mais cette phase ne livre pas de modèle IA exécuté, d'entraînement ni de seuil de détection validé. Une étiquette de source ne prouve pas une détection IA. La confiance éventuellement affichée est une valeur déclarée par le collecteur, non une probabilité calibrée indépendamment.

## Revue Promoteur

Un Promoteur actif ne voit et ne révise que les événements de pharmacies actives et liées à son compte. Chaque décision passe par un RPC transactionnel qui verrouille l'événement et écrit la qualification avec son audit. Une confirmation humaine ne déclenche pas de sirène.

## Limites restantes

La passerelle émet désormais automatiquement un événement signal_lost lorsqu'un publisher ayant déjà reçu des images s'arrête de façon inattendue. La même interruption réutilise la même empreinte et ne génère pas d'alertes répétées ; le retour des images réarme la détection.

Aucun collecteur ONVIF Events (abonnement/pull), moteur IA local, notification Android, clip ou sirène physique n'est livré ici. Le canal stdin fournit le point d'intégration pour ces collecteurs ; il ne constitue pas une détection automatique en soi. Aucun matériel réel n'a été testé dans cette phase.
