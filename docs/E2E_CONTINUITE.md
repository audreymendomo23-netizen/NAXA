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

## Correction de recette en cours
Le contrôle d'état Client est rendu déterministe : appel GET explicite depuis le contexte navigateur authentifié, vérification HTTP 200 + statut accepted, puis vérification distincte du rendu React « Appel en cours » et de la commande « Raccrocher ». Des traces requête/réponse GET sont conservées pour diagnostiquer le polling UI.

## Critères de sortie
Ne déclarer vert que si l'API Client, l'interface Client, le raccrochage, la file centrale, l'expiration/heartbeat et les contrôles d'accès passent sur Replay. La connectivité WebRTC réelle doit être qualifiée séparément avec deux participants et des médias utilisables; le statut SQL accepted ne prouve pas le son bidirectionnel.
