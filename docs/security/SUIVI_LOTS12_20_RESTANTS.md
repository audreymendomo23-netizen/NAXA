# NAXA Security — registre des lots 12 à 20

Dernière vérification : 9 novembre 2026.
Branche : qa/e2e-stabilisation-20261106.
SHA testé : 909727b13bdd8872baba0450955206c3ed04d252.
Aucun changement sur main, aucune écriture Supabase Production, aucun déploiement Vercel Production.

## État et preuve par lot

| Lot | État | Construit | Pourquoi non terminé |
|---|---|---|---|
| 12 — Direct vidéo / MediaMTX | PARTIEL, matériel bloquant | Config MediaMTX 1.21.3, auth/tickets, publication RTSPS, WHEP/WebRTC, proxy local TLS, CI config validée | Replay : 0 installation, 0 passerelle, 0 caméra, 0 connexion, 0 session live. Aucun flux réel, DNS/TLS/serveur média dédié ou test d'isolation caméra fourni. Déploiement hors périmètre actuel. |
| 13 — Enregistrement / archives | PARTIEL, logiciel et matériel | Worker FFmpeg local opt-in, indexeur/hash/outbox, migrations 310/311/312, synchronisation signée, protection fail-closed, timeline metadata et API Promoteur | Replay : 0 segment. Pas de lecture/pause/avance/export vidéo, d'enregistrement programmé/événementiel, de supervision disque complète ni de recette caméra/NVR avec coupure WAN/secteur. La timeline affiche les métadonnées, pas la vidéo. |
| 14 — Horodatage / intégrité | PARTIEL, fondations CI vertes | Client SNTP, offset signature passerelle, migration 313, API, historique et UI. CI #1333 : 283/283 PASS | Aucun serveur NTP configuré sur une passerelle réelle. Horloge caméra/NVR non mesurée. Pas encore d'incrustation vérifiable, de manifeste signé ni de hash vérifié après export. |
| 15 — Google Drive / téléphone | BLOQUÉ par config OAuth et Android absent | Sauvegarde PostgreSQL séparée : dump chiffré quotidien GitHub Actions (artefact 90 jours), S3 facultatif ; migration OAuth Google d'onboarding sans Drive API | Aucun endpoint Drive API/drive.file ni flow OAuth Drive dans le dépôt. Il faut un projet Google Cloud, OAuth Web Client ID/secret, redirect URI autorisé, Drive API/Picker et compte pilote. Aucun projet Android natif pour la copie locale téléphone. |
| 16 — Calendrier haute surveillance | FONDATIONS LOGICIELLES + CI VERTES ; intégration aval/matériel partielle | Migration 314, RPC auditée, UI Promoteur, fuseau IANA, exceptions, plage 22:00–08:00, cache chiffré 72 h, trigger priorité événement. CI #1341 : 290/290 PASS | Pas de signature Ed25519 serveur indépendante du TLS, pas de file d'événements offline durable, pas de liaison sensibilité/zone/IA/alertes/sonneries/escalade/clips, pas de délégation Responsable, pas de passerelle réelle. |
| 17 — IA / détection avancée | PARTIEL, moteur IA non livré | Découverte ONVIF et Pull-Point, normalisation événements, déduplication et revue humaine serveur | Aucun runtime/modèle d'inférence, accélérateur edge, vidéos autorisées, métriques de latence/faux positifs/faux négatifs. Les 15 adaptateurs caméra du catalogue Replay sont tous design_only. |
| 18 — Compagnon Android | BLOQUÉ par absence de projet et config Firebase | Aucune base Android native trouvée ; PWA/Web Push ne vaut pas application Android native | Aucun build.gradle, AndroidManifest.xml, APK, projet Firebase/FCM, clé de signature ni téléphone de test. Il faut provisionner l'app, les secrets FCM et les appareils pour Doze/écran verrouillé/processus tué/permissions. |
| 19 — Sirène physique | BLOQUÉ par absence de matériel identifié | Table de commandes sirène et contraintes SQL existent | Aucun driver GPIO/relais/contrôleur, aucune référence matériel/firmware/câblage/retour d'état, aucun endpoint de commande physique validé ni test d'arrêt local/automatique. Il faut identifier le contrôleur réel avant toute commande. |
| 20 — Pilote E2E | BLOQUÉ par absence de site équipé | Tests logiciel/API/SQL disponibles | Aucun site pilote équipé et autorisé. Replay confirme 0 installation/gateway/caméra/session/clip/commande sirène. Il faut une pharmacie, NVR/caméra, gateway, réseau/UPS, mobile Android, compte Drive et autorisations de test. |

## Mesure vérifiée sur Replay — ne pas confondre avec Production

Lecture seule du projet de test naxa-ci-replay-2 / pwfftcsjyeibxxqhwysw :
- installations 0 ; gateways 0 ; cameras 0 ; camera connections 0 ;
- live sessions 0 ; clips 0 ; recording segments 0 ; siren commands 0 ; recording policies 0.
- naxa_security_camera_adapters : 15/15 design_only.

Ce relevé décrit Replay seulement. Il ne donne pas l'inventaire de Production.

## Pré-requis pour fermer les lots physiques/externe

1. Lots 12/13/14/17 : fournir et installer une caméra/NVR pilote, passerelle Linux, réseau local, NTP et hôte média dédié avec DNS/TLS/firewall ; autoriser un essai physique encadré.
2. Lot 15 : créer/provisionner un projet Google Cloud OAuth avec Drive API/Picker, ID/secret client et URI de redirection, puis compte Drive pilote. Ajouter les secrets uniquement aux variables d'environnement chiffrées ; jamais au dépôt ni au chat.
3. Lot 18 : créer le projet Firebase Android/FCM, fournir la configuration d'application adaptée et les secrets d'envoi côté serveur, définir le processus de signature APK et appareils de recette.
4. Lot 19 : choisir un modèle exact de contrôleur relais/sirène, alimentation/UPS, câblage et retour de contact ; faire valider l'arrêt local et la sûreté avant commande distante.
5. Lot 20 : désigner une pharmacie pilote, obtenir les autorisations et fournir l'ensemble caméra/NVR/gateway/mobile/Drive.

**Conclusion :** fondations logicielles et CI des lots 13, 14 et 16 validées à leurs SHA respectifs. Aucun lot 12 à 20 ne doit être annoncé entièrement opérationnel avant les preuves physiques/externe requises.
