# NAXA Security — registre des lots 12 à 20

Dernière vérification : 9 novembre 2026.
Branche : qa/e2e-stabilisation-20261106.
SHA de validation du code : 1a79b8cc4d7e92b89eb8e79d5cbf5859249f3d8d (GitHub Actions #1389, SUCCESS). Les commits postérieurs 2f8d27262568a9260a59dd59484724a4da27a806 et celui du présent registre sont documentaires uniquement.
Aucun changement sur main, aucune écriture Supabase Production, aucun déploiement Vercel Production.

## État et preuve par lot

| Lot | État | Construit | Pourquoi non terminé |
|---|---|---|---|
| 12 — Direct vidéo / MediaMTX | PARTIEL, matériel bloquant | Config MediaMTX 1.21.3, auth/tickets, publication RTSPS, WHEP/WebRTC, proxy local TLS, CI config validée | Replay : 0 installation, 0 passerelle, 0 caméra, 0 connexion, 0 session live. Aucun flux réel, DNS/TLS/serveur média dédié ou test d'isolation caméra fourni. Déploiement hors périmètre actuel. |
| 13 — Enregistrement / archives | VERT — socle logiciel livré ; PARTIEL — lot complet | Worker FFmpeg local opt-in, indexeur/hash/outbox, migrations 310/311/312, synchronisation signée, protection fail-closed, timeline metadata et API Promoteur | Replay : 0 segment. Pas de lecture/pause/avance/export vidéo, d'enregistrement programmé/événementiel, de supervision disque complète ni de recette caméra/NVR avec coupure WAN/secteur. La timeline affiche les métadonnées, pas la vidéo. |
| 14 — Horodatage / intégrité | VERT — socle logiciel livré ; PARTIEL — lot complet | Client SNTP, offset signature passerelle, migration 313, API, historique et UI. CI #1333 : 283/283 PASS | Aucun serveur NTP configuré sur une passerelle réelle. Horloge caméra/NVR non mesurée. Pas encore d'incrustation vérifiable, de manifeste signé ni de hash vérifié après export. |
| 15 — Google Drive / téléphone | BLOQUÉ par config OAuth et Android absent | Sauvegarde PostgreSQL séparée : dump chiffré quotidien GitHub Actions (artefact 90 jours), S3 facultatif ; migration OAuth Google d'onboarding sans Drive API | Aucun endpoint Drive API/drive.file ni flow OAuth Drive dans le dépôt. Il faut un projet Google Cloud, OAuth Web Client ID/secret, redirect URI autorisé, Drive API/Picker et compte pilote. Aucun projet Android natif pour la copie locale téléphone. |
| 16 — Calendrier haute surveillance | VERT — socle calendrier/politique ; PARTIEL — lot complet | Migration 314, RPC auditée, UI Promoteur, fuseau IANA, exceptions, plage 22:00–08:00, cache chiffré 72 h, trigger priorité événement. CI #1341 : 290/290 PASS | Pas de signature Ed25519 serveur indépendante du TLS, pas de file d'événements offline durable, pas de liaison sensibilité/zone/IA/alertes/sonneries/escalade/clips, pas de délégation Responsable, pas de passerelle réelle. |
| 17 — IA / détection avancée | PARTIEL, moteur IA non livré | Découverte ONVIF et Pull-Point, normalisation événements, déduplication et revue humaine serveur | Aucun runtime/modèle d'inférence, accélérateur edge, vidéos autorisées, métriques de latence/faux positifs/faux négatifs. Les 15 adaptateurs caméra du catalogue Replay sont tous design_only. |
| 18 — Compagnon Android | BLOQUÉ par absence de projet et config Firebase | Aucune base Android native trouvée ; PWA/Web Push ne vaut pas application Android native | Aucun build.gradle, AndroidManifest.xml, APK, projet Firebase/FCM, clé de signature ni téléphone de test. Il faut provisionner l'app, les secrets FCM et les appareils pour Doze/écran verrouillé/processus tué/permissions. |
| 19 — Sirène physique | BLOQUÉ par absence de matériel identifié | Table de commandes sirène et contraintes SQL existent | Aucun driver GPIO/relais/contrôleur, aucune référence matériel/firmware/câblage/retour d'état, aucun endpoint de commande physique validé ni test d'arrêt local/automatique. Il faut identifier le contrôleur réel avant toute commande. |
| 20 — Pilote E2E | BLOQUÉ par absence de site équipé | Tests logiciel/API/SQL disponibles | Aucun site pilote équipé et autorisé. Replay confirme 0 installation/gateway/caméra/session/clip/commande sirène. Il faut une pharmacie, NVR/caméra, gateway, réseau/UPS, mobile Android, compte Drive et autorisations de test. |

## Qualification du statut vert

Le vert attribué aux lots 13, 14 et 16 porte exclusivement sur leur **socle logiciel actuellement livré et couvert par les tests**. Il ne vaut pas clôture E2E ni validation du matériel. Les fonctions encore absentes et les recettes caméra/NVR/passerelle sont conservées dans la dernière colonne ; le statut opérationnel complet de ces lots reste donc PARTIEL.

Preuve CI commune au SHA 2ccbaf673e5b490688096aa2393ccdd7191fc86d :
- GitHub Actions #1388 : SUCCESS — https://github.com/audreymendomo23-netizen/NAXA/actions/runs/42576908998.
- Suite Node.js : 290/290 PASS, 0 échec ; audit des dépendances de production : 0 vulnérabilité.
- TypeScript, ESLint, compilation Next.js et génération 129/129 pages : PASS.
- Sous-tests nommés par lot dans les logs : lot 13 **27/27**, lot 14 **7/7**, lot 16 **7/7** — total **41/41**.
- Ce résultat est une preuve logicielle simulée/contractuelle. Il ne prouve ni un flux vidéo réel, ni une horloge caméra/NVR synchronisée, ni une alerte reçue par une passerelle physique.

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


## Addendum — revalidation CI et audit général (09/11/2026)

### Revalidation du socle de sécurité

- CI GitHub Actions **#1389** : SUCCESS sur le code du SHA `1a79b8cc4d7e92b89eb8e79d5cbf5859249f3d8d`, run [42578412264](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/42578412264).
- Résultats globaux : Gitleaks (refs Git + working tree) PASS ; audit des dépendances de production = 0 vulnérabilité ; 290/290 tests Node PASS ; TypeScript PASS ; ESLint sans erreur bloquante ; build Next.js PASS ; 129/129 pages statiques ; validation officielle MediaMTX 1.21.3 PASS.
- La CI #1389 couvre le code applicatif inchangé depuis le SHA testé. Les commits documentaires suivants ne modifient ni logique applicative ni migrations.
- Les lots 13, 14 et 16 restent **VERT — socle logiciel seulement** avec les sous-tests dédiés déjà consignés (27/27, 7/7, 7/7). La clôture globale de chacun reste PARTIELLE jusqu'aux extensions et validations listées dans le tableau principal.

### Classement des lots différés pour recette Node.js SIL

| Lot | Tests Node/SIL à créer | Ce que la simulation ne prouvera pas |
|---|---|---|
| 12 — Live / MediaMTX | flux RTSP local, tickets, révocation, WHEP, reconnexion, isolation tenant, perte/reprise réseau | caméra/NVR et installation média/réseau réels |
| 15 — Drive / téléphone | faux OAuth/Drive, state/CSRF, scopes, quota, retries, intégrité, restauration et reprise de backup | consentement OAuth Google réel, Drive utilisateur et backup natif téléphone |
| 17 — IA | événements ONVIF simulés, déduplication, contrat d'inférence, latence, file et revue humaine | modèle/runtime/accélérateur, vidéos réelles et métriques terrain |
| 18 — Android | API/FCM factice, tokens, retries, déduplication, révocation et redémarrage worker | APK natif signé, FCM réel, Doze et réception sur téléphone |
| 19 — Sirène | relais mock, signature/nonce, watchdog, durée maximale, ACK, panne et arrêt d'urgence logiciel | relais/GPIO, câblage, alimentation et arrêt matériel |
| 20 — Pilote E2E | composition caméra mock→gateway→API→événement→notification→ACK, coupures et reprises | pharmacie équipée/consentante, matériel et réseau réels |

Toutes les simulations doivent être éphémères, marquées `simulated=true`, exécutées via `node:test`, sans insérer de faux équipements ou de fausses missions persistantes dans Supabase Replay. Un PASS SIL ne vaut pas validation matérielle.

### Résultat de l'audit code général

- Inventaire du HEAD audité : 1 471 fichiers ; 73 routes API ; 132 pages ; 136 composants ; 46 modules `src/lib` ; 148 migrations SQL ; 10 fichiers Security Gateway.
- Avertissements non bloquants à traiter côté code : éléments `<img>` à optimiser, dépendances manquantes/complexes de `useEffect`, `aria-expanded` invalide sur `textbox`, `next lint` déprécié, avertissements Node `url.parse()` et `punycode`.
- `npm audit` de la CI ne couvre que les dépendances de production avec seuil `high` ; ce n'est pas une SAST ni un audit complet des dépendances de développement.
- Les alertes Supabase rapportées le 07/11/2026 sur les fonctions `SECURITY DEFINER`, l'exposition de schéma et la protection contre les mots de passe compromis restent à revérifier en lecture/recette sur Replay. Elles ne sont pas neutralisées par le résultat npm audit.
- Les mentions plus anciennes de ce registre disant que la compilation globale n'a pas été exécutée doivent être lues comme historique ; le résultat courant au SHA de code cité ci-dessus est positif.

Référence détaillée de l'audit général et du plan de reprise : `docs/CONTINUITE_IA_NAXA.md`, section « Audit général du code et état Sécurité (09/11/2026) ».
