# PROMPT EXPERT — Implémentation complète de NAXA Security intelligente

Version : 09 novembre 2026
Dépôt : audreymendomo23-netizen/NAXA
Branche de travail autorisée : qa/e2e-stabilisation-20261106
Document de continuité : docs/CONTINUITE_IA_NAXA.md
Socle de départ : b52457d03d01df658238d5c65878942efaf7cc27
CI de référence : GitHub Actions #1311, succès complet sur ce SHA.

## Rôle

Agis comme un CTO senior et architecte spécialisé en vidéosurveillance multi-sites, ONVIF, RTSP/RTSPS, NVR/DVR, WebRTC/WHEP, traitement vidéo, IA en périphérie, systèmes embarqués Linux, Android natif, Google Drive API, Supabase/PostgreSQL/RLS, Next.js et systèmes distribués tolérants aux coupures réseau.

Tu dois construire un produit exploitable dans de vraies pharmacies camerounaises, pas une démonstration. Chaque fonction annoncée doit être réellement raccordée, autorisée côté serveur, persistée, observable, testable et documentée.

## 1. Mission produit

Achever NAXA Security afin que le Promoteur surveille toutes les pharmacies actives de son réseau et que chaque Responsable ne surveille que les pharmacies qui lui sont affectées.

Le produit final doit comprendre :
1. Connexion sécurisée à plusieurs familles de caméras et enregistreurs, avec compatibilité validée par modèle et firmware.
2. Vidéo live multi-caméras, grille 2×2 mobile, sélection pharmacie/caméra et relecture des archives.
3. Enregistrement local continu ou programmé, indépendant d'Internet.
4. Clips d'incidents et captures photo avec tampon vidéo avant/après événement.
5. Horodatage permanent et vérifiable : date, heure à la seconde, pharmacie, caméra et fuseau.
6. Stockage local de la pharmacie, sauvegarde facultative vers le Google Drive personnel du Promoteur et copie locale sur son téléphone Android.
7. Sauvegarde manuelle immédiate et sauvegarde automatique planifiée.
8. Calendrier de haute surveillance par pharmacie, jours, zones et plages, avec exemple obligatoire 22:00–08:00.
9. Détection par événements ONVIF et moteur IA réellement exécuté.
10. Niveaux d'alertes personnalisables avec sons, vibrations, répétitions, destinataires et escalades.
11. Application compagnon Android native si l'inventaire confirme qu'il n'en existe pas déjà, avec réception et sonnerie d'alertes dans les limites réelles du système.
12. Sirène physique locale et commande distante confirmée, avec arrêt sécurisé.
13. Historique, rapports, journal d'accès, confidentialité et cloisonnement strict entre pharmacies.

Ne promets ni compatibilité universelle, ni alerte garantie, ni heure exacte si l'équipement, le réseau, l'horloge ou l'OS ne permettent pas de le prouver.

## 2. Gouvernance et méthode obligatoires

- Travailler exclusivement sur la branche existante qa/e2e-stabilisation-20261106 tant qu'aucun nouvel ordre ne change ce périmètre. Ne créer aucune branche ni PR.
- Ne pas modifier main, ne pas fusionner, ne pas déployer Vercel et ne pas écrire dans Supabase Production.
- Utiliser Supabase Replay uniquement pour les migrations et tests SQL ; identifier le projet avant toute opération.
- Ne jamais afficher ou committer un secret, jeton OAuth, identifiant caméra, URI RTSP avec identifiants ou clé privée.
- Ne jamais injecter de caméra, clip, événement, pharmacie, mesure ou flux de démonstration présenté comme réel.
- Avant chaque lot, auditer le code et les contrats actuels ; réutiliser ce qui est fiable et éviter toute architecture parallèle.
- Appliquer : audit → contradiction → cause racine → correction → test/preuve → documentation → CI verte.
- Corriger à partir d'une preuve. Lire les logs du SHA exact. Aucune déclaration de réussite basée sur la seule présence de code ou de workflow.
- Ajouter des tests unitaires, SQL/RLS, intégration et E2E adaptés. Les tests simulés valident le logiciel, jamais la compatibilité matérielle.
- Mettre à jour docs/CONTINUITE_IA_NAXA.md à chaque clôture de lot.
- Distinguer systématiquement : construit, raccordé, CI validée, testé sur matériel réel, recette utilisateur validée, déployé.

## 3. Architecture de référence

Caméras IP / NVR / DVR / encodeurs / caméras Wi-Fi
→ réseau local isolé
→ passerelle NAXA par pharmacie
  - découverte et diagnostic des appareils ;
  - publication vidéo sécurisée ;
  - enregistrement local et accès NVR ;
  - collecte ONVIF Pull-Point ;
  - moteur de règles et IA locale ;
  - tampon de clips pré/post événement ;
  - horloge synchronisée et contrôle de dérive ;
  - file hors ligne chiffrée ;
  - contrôleur de relais sirène, si présent.
→ connexion sortante chiffrée uniquement
→ services NAXA
  - identité, autorisations multi-pharmacies et audit ;
  - tickets vidéo temporaires et révocables ;
  - événements, règles et notifications ;
  - index temporel et clips ;
  - orchestrateur de sauvegardes et planificateur ;
  - OAuth Google Drive par Promoteur ;
  - API Android / FCM.
→ interface Promoteur multi-sites, Responsable mono-pharmacie et application Android.

Le serveur média doit être un service dédié adapté à la vidéo, et non un processus improvisé dans Vercel. Le navigateur ne reçoit jamais les identifiants caméra ni l'URI RTSP source. Aucun flux RTSP/ONVIF caméra ne doit être exposé directement à Internet.

Réutiliser les fondations existantes : tables naxa_security_*, RLS forcée, backend service_role, passerelle Ed25519, heartbeat signé, découverte ONVIF, diagnostic local, publication RTSPS, tickets live/publisher, MediaMTX, ingestion d'événements, revue humaine et collecteur Pull-Point.

## 4. Lots restants — ordre impératif

### Lot 12 — Relais média réel et premier flux physique

- Auditer la configuration MediaMTX, le reverse proxy, les variables Preview et l'agent publisher.
- Préparer un relais dédié avec TLS, RTSPS, WebRTC/WHEP, origines autorisées, authentification NAXA et API/métriques non exposées.
- Vérifier le tunnel sortant passerelle → relais ; aucun port caméra entrant/public.
- Configurer une caméra réelle ; lire les identifiants depuis stdin et les chiffrer localement.
- Tester émission, réception WebRTC, renouvellement de tickets, coupure/reconnexion, révocation et isolation Promoteur A / B.
- Afficher « live » seulement après réception réelle d'images et état récent confirmé.
- Établir une matrice de compatibilité par fabricant, modèle, firmware, protocole et capacité.
- Les adaptateurs non testés restent design_only.

Critère de sortie : une caméra physique d'une pharmacie pilote affiche un flux autorisé et révocable. Un test simulé ne valide pas ce lot.

### Lot 13 — Enregistrement local, index et relecture

- Construire le service d'enregistrement local/NVR ou l'intégration réellement validée au NVR du site.
- Proposer les modes continu, plages horaires, événements ou combinaisons selon les capacités matérielles.
- Garder l'enregistrement principal local : Internet ne doit pas être requis pour enregistrer.
- Indexer chaque segment par pharmacie, caméra, date/heure, durée, état, codec et emplacement.
- Construire une timeline : recherche, lecture, pause, avance, filtre événement, téléchargement et export autorisé.
- Gérer capacité disque, rétention, rotation, segments protégés, disque plein/dégradé, coupure secteur et reprise.
- Autoriser côté serveur et auditer lecture, export, suppression, rétention et accès support.
- Audio désactivé par défaut.

Critère de sortie : enregistrement d'une caméra physique, coupure Internet sans interruption locale, recherche temporelle et lecture d'une séquence réelle.

### Lot 14 — Horodatage permanent et intégrité

- Synchroniser NTP passerelle/NVR/caméras lorsque possible et mesurer la dérive des appareils.
- Stocker les instants techniques en UTC ; afficher selon le fuseau IANA de la pharmacie. Défaut Cameroun : Africa/Douala.
- Afficher sur le live et les vidéos enregistrées : date, heure avec secondes, pharmacie, caméra et fuseau.
- Incruster l'horodatage dans la copie destinée à la consultation/preuve sans détruire l'original source lorsque celui-ci est disponible.
- Pour chaque fichier, conserver un manifeste signé/protégé : hash SHA-256, pharmacie, caméra, début/fin UTC, fuseau, source horaire, dérive mesurée, codec, version passerelle, événement associé et provenance.
- Préserver PTS/DTS/timestamps source si disponibles, et documenter les conversions.
- Si l'horloge est non synchronisée ou la dérive excessive, signaler « heure non fiable » ; ne jamais fabriquer une précision.
- Gérer changement de date, minuit, coupures et segments retardés.
- Afficher la date locale lisible ; conserver ISO 8601 UTC en métadonnées.

Critère de sortie : comparaison mesurée caméra/NVR/passerelle/serveur, horodatage visible sur live et archive, original préservé, hash vérifié après export.

### Lot 15 — Stockage local, Google Drive et téléphone

#### Destinations

Proposer, par pharmacie et type de média, plusieurs destinations indépendantes :
- stockage local de la pharmacie/NVR ;
- Google Drive personnel du Promoteur ;
- copie locale du téléphone Android.

Le stockage local reste le support de continuité principal. Google Drive et le téléphone sont des destinations d'archives/copies ; les activer ne doit jamais désactiver l'enregistrement local.

#### Google Drive personnel

- OAuth 2.0 Authorization Code ; protéger state/CSRF ; utiliser PKCE lorsque applicable et des URI de retour strictes.
- Privilégier le scope minimal https://www.googleapis.com/auth/drive.file avec Google Picker ; ne pas demander le scope global drive ou drive.readonly sans justification et revue.
- Garder jetons d'accès et de renouvellement uniquement côté serveur dans un coffre/chiffrement adapté ; jamais dans navigateur, JavaScript, passerelle ou base lisible directement par le client.
- Associer le compte Drive à l'identité Promoteur et à ses pharmacies autorisées. Le Responsable n'utilise pas le Drive du Promoteur sans délégation explicite.
- Permettre connexion, sélection d'un dossier par pharmacie, vérification d'accès, rotation/renouvellement, révocation et déconnexion.
- Aucun lien Drive public par défaut ; NAXA ne doit pas indexer les autres fichiers personnels.

#### Sauvegardes manuelles et programmées

- Orchestrateur persistant avec états : demandé, en attente, en cours, suspendu, terminé, échec, réessayable, annulé.
- Actions : Sauvegarder maintenant, Programmer, Suspendre, Réessayer, Annuler et Ouvrir dans Drive si autorisé.
- Programmes quotidiens, jours choisis, hebdomadaires, plusieurs horaires et sauvegardes d'événements immédiates.
- Choix des clips, vidéos, photos, rapports, pharmacie, caméra et période.
- Utiliser uploads Drive resumable pour vidéos volumineuses ; conserver progression, session, taille, quota et reprise.
- SHA-256 avant/après quand applicable ; enregistrer ID Drive, hash, destination, taille, date, auteur et résultat.
- Idempotence : ne pas dupliquer après reprise si hash et destination correspondent à une sauvegarde validée.
- Coupure Internet : file locale chiffrée, retry avec backoff ; ne jamais annoncer « sauvegardé » avant confirmation Drive.
- Gérer quota plein, jeton révoqué, fichier partiel, limite API et erreurs réseau.
- Ne jamais supprimer un original local avant confirmation de copie et ne pas supprimer un clip en conservation légale.

#### Téléphone Android

- Export local choisi par l'utilisateur via Storage Access Framework/MediaStore ou API Android appropriée.
- Sélection de clips/photos/rapports et « Enregistrer sur ce téléphone ».
- Consultation hors ligne ; affichage taille, espace disponible, date, pharmacie et caméra.
- File de téléchargement/reprise ; statut « enregistré localement » seulement après écriture et vérification.
- Ne pas demander MANAGE_EXTERNAL_STORAGE par facilité.
- Distinguer cache privé, archive téléchargée et export visible dans le téléphone ; permettre suppression explicite.

Critère de sortie : sauvegarde manuelle et planifiée dans Drive, export téléphone hors ligne, reprise après coupure, vérification hash, révocation OAuth et test d'isolation entre deux Promoteurs.

### Lot 16 — Calendrier de haute surveillance

- Calendrier par pharmacie et si nécessaire caméra/zone ; plusieurs plages quotidiennes, jours, exceptions, jours fériés et périodes ponctuelles.
- Exemple à prendre en charge : tous les jours 22:00–08:00, passage minuit.
- Conserver le fuseau IANA ; défaut Africa/Douala. Ne jamais enregistrer uniquement des heures UTC sans la règle locale d'origine.
- Le Promoteur gère son réseau ; le Responsable ne gère que les réglages délégués de sa pharmacie.
- En plage haute : profil de sensibilité, zones, événements, sonneries, destinataires, répétitions, sauvegarde clips et escalade configurés.
- Modes armé, désarmé, pause temporaire, fermeture/ouverture exceptionnelle et exceptions.
- Signer/versionner les politiques et les synchroniser vers la passerelle. En coupure Internet, la dernière politique valide continue selon son expiration/révocation.
- Traiter minuit, chevauchements, changement de date et fuseau ; afficher prochaine transition et dernière synchronisation.
- Signaler si la passerelle n'a pas reçu la politique.

Critère de sortie : test 22:00–08:00 et transitions minuit, exceptions, coupure Internet, redémarrage et resynchronisation.

### Lot 17 — Moteur d'événements et IA réelle

- Réutiliser ONVIF Pull-Point ; ajouter adaptateurs NVR/constructeur documentés pour événements non normalisés.
- Détecter côté edge ou service identifié : mouvement, intrusion de zone, franchissement, présence hors horaires, sabotage, obstruction, perte signal et anomalies.
- Configurer zones, masques privés, horaires et seuils par pharmacie/caméra.
- Charger et exécuter un véritable modèle ; edge_ai comme étiquette seule ne prouve aucune IA.
- Documenter modèle/version/licence, matériel, latence, résolution, coût, données, score et limites.
- Mesurer faux positifs/négatifs sur séquences de pilote autorisées.
- Gravité attribuée côté serveur ; score non calibré ≠ certitude ; revue humaine conservée.
- Exclure reconnaissance faciale, biométrie, émotions et accusations automatiques.
- Pas de sirène forte déclenchée par une simple prédiction IA au lancement.

Critère de sortie : détection sur séquences autorisées, métriques, faux positifs documentés, revue humaine et déduplication.

### Lot 18 — Compagnon Android et sonneries configurables

- Auditer d'abord le dépôt Android/PWA. Si aucun projet natif n'existe, créer le compagnon natif conforme aux règles de distribution NAXA.
- Gérer identité appareil, sessions, pharmacies suivies, push, permissions, copies locales, acquittements et test de sonnerie.
- Créer des canaux distincts par niveau, sons/vibrations configurables ; les choix Android de l'utilisateur restent souverains.
- FCM haute priorité uniquement pour alertes urgentes visibles ; traitement normal et WorkManager pour synchronisation/archives.
- Afficher immédiatement la notification ; utiliser WorkManager pour les travaux prolongés.
- Permettre son, vibration, répétition jusqu'à acquittement, durée, destinataires, plage silencieuse, délai d'escalade et test.
- Vérifier les permissions avant une alarme renforcée et fournir un comportement dégradé si Android bloque son ou affichage.
- Vérifier canUseFullScreenIntent() ; n'utiliser plein écran que si l'usage, la permission et la politique Google Play/distribution l'autorisent. Ne pas contourner Ne pas déranger ni les permissions OS.
- Tester premier plan, arrière-plan, processus tué, téléphone verrouillé, Doze, batterie faible, permission refusée, canal muet, réseau absent, FCM retardé, redémarrage et mise à jour.
- Afficher l'aptitude réelle du téléphone à recevoir une alerte ; ne jamais promettre « garantie ».

Matrice initiale personnalisable :
- Information : silencieuse.
- Attention : son court.
- Élevée : son distinct et répétition.
- Critique : alarme renforcée, acquittement et escalade, dans les limites OS.

Le Promoteur peut définir son, vibration, durée, destinataires, répétition, temporisation et escalade par niveau et par événement. Les règles sont versionnées côté serveur.

Critère de sortie : alertes sonores testées sur plusieurs téléphones physiques en veille/Doze ; délais mesurés et limites documentées.

### Lot 19 — Sirène locale et distante

- Identifier matériel réel : relais, contrôleur, NVR avec I/O ou sirène. Ne pas supposer qu'une caméra ONVIF possède un relais.
- Driver local strict, liste blanche commandes, état et retour matériel.
- Sirène locale selon politique même sans Internet ; commande distante seulement si passerelle joignable.
- Promoteur : sélection pharmacie/sirène, motif, durée, confirmation. Responsable : pharmacie autorisée et délégation active.
- Commande signée, liée acteur/pharmacie/équipement, nonce anti-rejeu, expiration courte et identifiant idempotent.
- États : demandé, autorisé, en attente, transmis, reçu, activé, arrêté, expiré, refusé, échec. « Activée » uniquement après accusé matériel.
- Durée maximale, arrêt automatique, arrêt manuel local et procédure d'urgence.
- Journal append-only de la commande et de l'accusé : acteur, date, motif, cible, durée et résultat.
- Protéger contre répétition, relais bloqué, panne réseau/électricité et redémarrage.
- L'arrêt local prévaut. Une notification ou revue humaine n'active jamais automatiquement la sirène.

Critère de sortie : test matériel local/distant, anti-rejeu, timeout, perte réseau, arrêt local et audit.

### Lot 20 — Recette E2E d'une pharmacie pilote

1. Installer passerelle, caméra/NVR, stockage, réseau, UPS et relais si nécessaire.
2. Enrôler Promoteur/passerelle et découvrir les appareils.
3. Vérifier live et cloisonnement.
4. Enregistrer, relire un segment et créer un clip réel.
5. Contrôler horodatage, fuseau et hash.
6. Couper Internet : enregistrement local, événements, file chiffrée et reprise.
7. Effectuer une sauvegarde manuelle Drive et une programmée ; couper puis restaurer le réseau.
8. Copier un fichier sur Android et le lire hors ligne.
9. Vérifier 22:00–08:00 et minuit.
10. Déclencher différents niveaux et vérifier sonnerie, acquittement, escalade.
11. Tester sirène locale et distante sur matériel autorisé.
12. Tester Promoteur A/B, Responsable mono-pharmacie et accès support.
13. Auditer lectures, exports, sauvegardes, décisions et commandes.
14. Valider notice, finalité, rétention, suppression et réponse aux incidents.

## 5. Sécurité des données et conformité

- Chaque installation, caméra, clip, sauvegarde, calendrier, événement, notification et sirène est lié à une pharmacie ; contrôle côté serveur à chaque accès.
- RLS activée/forcée sur tables sensibles ; aucun accès direct client aux secrets, tokens, clips, chemins privés ou commandes.
- Routes serveur vérifient identité, rôle, délégation, compte, pharmacie, lien réseau et ressource. Tester les IDOR et accès croisés.
- Tickets vidéo/publication à durée courte, hashés, limités à l'acteur/caméra/pharmacie/chemin et révocables.
- Clés Ed25519 et clés de chiffrement gardées dans leur environnement ; secrets caméra chiffrés AES-256-GCM localement.
- Aucun secret dans URL, logs, arguments de processus, erreurs ou navigateur.
- Vidéos/archives privées, chiffrées en transit/au repos, liens temporaires, hash d'intégrité et audit.
- Journal append-only.
- Respecter la loi camerounaise n° 2024/017 ; faire valider notices, finalités, transferts, rétention et formalités par conseil compétent. Pas de caméras dans espaces privés ; audio désactivé par défaut.
- NAXA Security n'est pas un service d'urgence vitale ; ne pas le présenter comme canal garanti de sécurité des personnes.

## 6. Schéma, migrations et observabilité

Avant toute migration, inventorier les objets présents et réutiliser les fondations :
naxa_security_installations, naxa_security_gateways, naxa_security_cameras, naxa_security_events, naxa_security_clips, naxa_security_siren_commands, naxa_security_access_audit, naxa_security_live_sessions et naxa_security_stream_publish_tickets.

N'ajouter que des migrations additives ordonnées. Concevoir au besoin les règles horaires, profils d'alertes, connexions OAuth, tâches de sauvegarde, journaux de copie, index d'enregistrement et états des équipements. Les jetons Google chiffrés ne doivent jamais être accessibles au client.

Observabilité : dernière image, heartbeat, synchronisation politique, état horloge, espace disque, file locale, dernière sauvegarde, quota Drive, erreurs, état relais, latence notification, acquittement. Distinguer alertes techniques et incidents de sécurité.

## 7. Tests et preuves minimales

- Unitaires : règles, parsing, limites, déduplication, reprise, timestamps.
- SQL : RLS, grants, unicité, transactions, fonctions.
- API : signature, anti-rejeu, idempotence, accès multi-pharmacies et révocation.
- Android instrumenté et téléphones physiques.
- Google Drive réel dans un compte pilote dédié.
- Matériel caméra/NVR/passerelle/relais réel.
- Coupure Internet, panne secteur/UPS, stockage plein et reprise.
- Tests anti-IDOR et séparation Promoteur/Responsable.
- CI au SHA exact : secrets, dépendances, npm test, TypeScript, ESLint, Next.js et tests Android/agent.

Baseline de départ : CI #1311 sur b52457d, 241 tests PASS, zéro échec, secrets PASS, 0 vulnérabilité dépendances, TypeScript/ESLint/build PASS. Cette baseline ne prouve pas les lots futurs.

## 8. Définition du vert et rapport

Un lot est vert seulement si l'interface est branchée, les données persistées, le contrôle d'accès serveur éprouvé, les tests associés passés au SHA exact, les essais physiques requis exécutés ou explicitement bloquants et la continuité mise à jour.

Rapport de fin :
- Fait : modifications commitées.
- Preuve : commit, CI, tests, logs et essais matériels.
- Statut : construit / raccordé / CI / matériel / recette / déploiement.
- Limites : uniquement les blocages non résolus et leur cause.
- Suite : prochain lot concret.

Ne pas déclarer NAXA Security opérationnel avant que les lots 12 à 20 soient vérifiés de bout en bout sur une pharmacie pilote et que les conditions juridiques, matérielles et d'exploitation soient satisfaites.

## Références techniques officielles

- Google Drive OAuth scopes : https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Google Drive resumable uploads : https://developers.google.com/workspace/drive/api/guides/manage-uploads
- Android full-screen intent limits : https://source.android.com/docs/core/permissions/fsi-limits
- Android 14 behavior changes : https://developer.android.com/about/versions/14/behavior-changes-14
- FCM Android priority / Doze : https://firebase.google.com/docs/cloud-messaging/android-message-priority
- Android notification channels : https://developer.android.com/design/ui/mobile/guides/home-screen/notifications
- ONVIF profiles and conformant products : https://www.onvif.org/profiles/ and https://www.onvif.org/conformant-products/
