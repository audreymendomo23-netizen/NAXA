# Phase 5 — Transmission signée et revue des appareils ONVIF

Date : 8 novembre 2026  
Branche : `qa/e2e-stabilisation-20261106`  
État : transmission signée, registre privé et revue Promoteur implémentés. GitHub Actions #1281 a validé les tests, TypeScript, ESLint, audit dépendances et build sur le commit 8c92be6. La revue transactionnelle de phase 6 est suivie séparément ; aucun matériel réel testé.

## Parcours opérationnel

1. La passerelle enrôlée exécute une découverte ONVIF locale explicitement confirmée.
2. Avec l'option `--submit`, l'agent transmet le rapport par HTTPS à `POST /api/security/gateway/discoveries`.
3. Le serveur valide l'identité Ed25519 courante de la passerelle, la signature du corps, la fenêtre temporelle de 120 secondes et le nonce anti-rejeu.
4. Le serveur vérifie que la passerelle n'est pas révoquée, que la pharmacie est active/publiée et que l'installation n'est ni suspendue ni retirée.
5. Les métadonnées sont normalisées puis stockées comme candidats dans `naxa_security_camera_discovery_candidates`. L'identité est dédupliquée par passerelle et clé de découverte.
6. Le Promoteur voit les candidats des seules pharmacies de son réseau actif. Il peut les valider après vérification ou les ignorer.

## Commande

La passerelle doit d'abord être enrôlée en phase 3. Exécuter ensuite :

```bash
sudo node /opt/naxa-security-gateway/agent.cjs discover \
  --confirm-local-network --submit --timeout-ms 3500 \
  --state-dir /var/lib/naxa-security-gateway
```

Sans `--submit`, le résultat reste local. La transmission est explicite et n'est jamais déclenchée par le heartbeat ni par le service systemd continu.

## Données reçues

Le rapport contient uniquement :
- identifiant ONVIF annoncé par le périphérique, s'il existe ;
- adresse IPv4 privée de la réponse ;
- types et scopes de découverte ;
- au maximum quatre endpoints HTTP(S) privés ou locaux sans identifiants, paramètres ni fragments ;
- version de l'agent et date de rapport.

Le serveur plafonne le corps à 64 Kio et le nombre d'appareils à 64. Les endpoints sont conservés comme métadonnées : le serveur ne les contacte jamais. Aucun mot de passe, token caméra, URI RTSP, image ou contenu vidéo n'est transmis.

## Revue Promoteur

La file n'est visible que dans le module latéral **Sécurité**, et seulement pour les pharmacies actives autorisées. Une validation explicite :
- re-vérifie le périmètre Promoteur, la pharmacie, la passerelle et l'état de l'installation ;
- crée une caméra au statut `registered` avec une clé de canal déterministe ;
- crée un connecteur `generic.onvif` au statut `discovered`, jamais `connected` ;
- journalise la décision dans le journal append-only ;
- lie le candidat à la caméra créée.

Le Promoteur peut également ignorer un candidat ; la décision est journalisée. Une nouvelle découverte met à jour les dates et métadonnées d'un candidat déjà connu sans réactiver un candidat ignoré ou validé.

## Sécurité et limites

- La table de candidats impose RLS forcée et ne donne aucun droit direct à `anon` ou `authenticated` ; les opérations passent par le backend.
- La paire Ed25519 privée reste sur la passerelle ; le serveur ne conserve que la clé publique et son empreinte.
- Les rapports utilisent le même canonical signé, la même fenêtre temporelle et le même registre anti-rejeu que le heartbeat.
- Les endpoints ne sont pas testés depuis le serveur ; la connexion marquée `discovered` n'est pas une preuve de connectivité/authentification.
- L'acceptation ne met pas la caméra en ligne, n'ouvre aucun flux, ne déclenche aucune capture et n'active aucune analyse IA/sirène.
- La compatibilité exacte par constructeur, modèle et firmware, ainsi que RTSP/NVR/DVR/encodeurs et les API propriétaires, doivent toujours être validés séparément.

## Tests attendus

- Tests unitaires de signature du rapport et de séparation des options CLI.
- Tests de contrat statique : clé publique Ed25519, anti-rejeu, bornes de payload, filtrage d'adresses privées, absence de requête sortante vers les XAddrs et absence de création automatique de caméra.
- Tests SQL de RLS, privilèges, unicité de découverte, correspondance pharmacie/gateway et revue humaine obligatoire.
- La CI ne prouve pas le fonctionnement sur matériel. Un essai local avec une vraie passerelle et une caméra ONVIF reste requis.
