# NAXA Sécurité Intelligente — audit de faisabilité 360°

**Date :** 7 novembre 2026  
**Périmètre :** conception, faisabilité technique, sécurité, exploitation, conformité, modèle économique et critères de recette.  
**Branche :** `qa/e2e-stabilisation-20261106`  
**Décision :** **GO conditionnel pour un pilote dans une pharmacie ; NO-GO pour une mise en production généralisée avant validation matérielle, réseau, juridique et E2E.**

## 1. Résultat de l'audit du dépôt

L'analyse de l'arbre du dépôt QA (1 353 fichiers au dernier relevé) n'a trouvé aucun composant caméra, endpoint vidéo, intégration NVR/ONVIF, service de streaming, modèle d'analyse vidéo ou projet Android natif. Le chemin Promoteur `/pharmacie/promoteur/securite` réutilise le tableau de bord et `CaisseSecurityManager` pour le contrôle des Caisses/comptes ; ce n'est pas une vidéosurveillance.

Le socle actuel est une application Next.js/PWA. Il peut héberger les écrans, les droits, le journal d'événements et les API de contrôle, mais ne peut pas à lui seul fournir une caméra, un enregistrement local résilient ni une sirène physique. Aucun matériel de pharmacie pilote, modèle de caméra, NVR ou relais d'alarme n'a été fourni ou validé. Aucun flux live n'est donc aujourd'hui démontré.

**Conclusion factuelle :** le module est une nouvelle capacité à construire, pas une fonctionnalité déjà présente que l'on pourrait simplement activer.

## 2. Périmètre fonctionnel à figer

| Fonction | Promoteur | Responsable | NAXA Admin |
|---|---|---|---|
| Voir les caméras en direct | Toutes les pharmacies de son réseau actif | Sa pharmacie autorisée uniquement | Diagnostic technique ; pas d'accès vidéo libre par défaut |
| Revoir les enregistrements | Toutes les pharmacies de son réseau actif | Sa pharmacie uniquement | Accès exceptionnel, temporaire, autorisé et journalisé |
| Voir les événements IA | Réseau, filtre par pharmacie | Sa pharmacie | Santé des équipements et métriques, pas les images sans motif |
| Accuser réception / classer un événement | Oui, dans son périmètre | Oui, dans sa pharmacie | Oui, avec motif et journal |
| Recevoir une alerte sonore mobile | Oui, pour ses pharmacies | Oui, pour sa pharmacie | Alertes techniques selon droits |
| Déclencher une sirène distante | Oui, dans les pharmacies de son réseau, avec confirmation | Oui, dans sa pharmacie, avec confirmation | Intervention support seulement si autorisée |
| Configurer caméras / zones IA | Lecture et préférences du réseau ; pas de contournement des règles physiques | Préférences de sa pharmacie selon délégation | Configuration matérielle et politiques globales |

Les droits sont déterminés côté serveur à partir des liens actifs `promoteur_pharmacies` et des affectations du Responsable. Un identifiant de pharmacie envoyé par le navigateur ne constitue jamais une autorisation. Les URLs de flux sont signées, liées à la pharmacie et de courte durée. Toute consultation, exportation, modification ou sirène crée un audit.

## 3. Architecture de référence

```text
Caméras IP ONVIF par pharmacie
        │ réseau local PoE / VLAN caméras
        ▼
NVR / passerelle IA locale + disques + UPS
  ├─ enregistrement continu local
  ├─ détection mouvement / sabotage / zones
  ├─ tampon vidéo pré/post événement
  └─ sortie relais vers sirène physique
        │ connexion sortante chiffrée uniquement
        ▼
Relais sécurisé NAXA / API événements / stockage privé
  ├─ registre des appareils et pharmacies
  ├─ autorisation multi-tenant et audit
  ├─ sessions live temporaires
  ├─ clips d'événements chiffrés
  └─ notification Push
        │
        ├─ Dashboard Promoteur : réseau autorisé
        ├─ Dashboard Responsable : une pharmacie autorisée
        └─ Companion Android NAXA : alertes sonores renforcées
```

La caméra ne doit jamais exposer son port RTSP/ONVIF directement à Internet. Aucun port entrant de caméra ne doit être ouvert sur la box publique. La passerelle établit un tunnel sortant authentifié vers NAXA. Le navigateur reçoit un flux relayé (par exemple WebRTC) au travers d'une session signée et expirante ; le serveur vérifie le périmètre à chaque ouverture.

### Compatibilité matérielle exigée

- **ONVIF Profile T** : flux vidéo avancés H.264/H.265, réglages d'image, événements de mouvement/sabotage, métadonnées et fonctions associées.
- **ONVIF Profile G** : configuration, recherche, récupération et lecture d'enregistrements sur dispositif ou stockage local.
- **ONVIF Profile M** : métadonnées et événements normalisés pour analytics, classification et interopérabilité.
- PoE/VLAN pour isoler les caméras ; NVR avec disques dimensionnés ; UPS pour caméra/NVR/routeur/sirène ; relais de sortie ou contrôleur d'alarme explicitement compatible.
- Les profils ONVIF ne garantissent pas que tous les modèles implémentent toutes les fonctions optionnelles. Le modèle exact, firmware, fonctions ONVIF et relay I/O doivent être testés avant achat en volume.

Références techniques : [ONVIF Profile T](https://www.onvif.org/profiles/profile-t/), [ONVIF Profile G](https://www.onvif.org/profiles/profile-g/), [ONVIF Profile M](https://www.onvif.org/profiles/profile-m/).

## 4. Analyse fonctionnelle et faisabilité

| Capacité demandée | Faisabilité | Dépendances / limites | Décision |
|---|---|---|---|
| Live temps réel | Élevée | Caméras compatibles, passerelle, tunnel sortant, relais vidéo, débit montant | MVP |
| Accès Promoteur multi-pharmacies | Élevée | Règles serveur réseau actif + URLs courtes | MVP |
| Accès Responsable mono-pharmacie | Élevée | Affectation active et tests anti-IDOR | MVP |
| Mouvement / intrusion / franchissement de ligne | Élevée à moyenne | Analytics NVR/edge, zones configurées, calibration et faux positifs | Phase 2 |
| Obstruction / sabotage caméra | Élevée si matériel compatible | Événements ONVIF / analyse de perte de signal | Phase 2 |
| Veille horaires inhabituels | Élevée | Calendrier d'ouverture fiable et exceptions de garde | Phase 2 |
| Sauvegarde automatique d'événement | Élevée | NVR tampon pré/post, stockage objet privé, quotas et règles de rétention | MVP+ |
| Interprétation descriptive IA | Moyenne à élevée | Clip suffisamment clair, modèle d'analyse, coûts IA, supervision humaine | Phase 3 |
| Sonnerie téléphone app fermée | Moyenne, conditionnelle | Companion Android natif, FCM, permissions, paramètres son/Do Not Disturb/OEM | Phase 3 |
| Sirène locale automatique sur événement confirmé | Élevée techniquement | NVR/relais, politique anti-faux positifs, installation physique | Phase 4 |
| Sirène déclenchée à distance | Élevée techniquement, dépendante du réseau | Passerelle en ligne, relais, authentification forte, confirmation et anti-rejeu | Phase 4 |
| Assistance IA pendant incident | Moyenne | Résumé factuel, procédures préparées, connectivité et supervision | Phase 3 |

### Interprétation IA : limites impératives

L'IA décrit des observations vérifiables : « présence détectée dans la réserve après fermeture », « caméra obstruée », « mouvement près de la caisse ». Elle fournit l'heure, la caméra, la zone, un score de confiance, des vignettes et le clip.

Elle ne doit pas conclure qu'un employé vole, qu'une personne est dangereuse ou qu'un délit a été commis. Aucun rapprochement facial, identification biométrique, analyse d'émotion ou détection de mensonge n'est inclus dans le périmètre. Un humain examine et qualifie chaque incident. L'IA ne déclenche pas à elle seule une sirène forte au lancement.

## 5. Continuité d'activité, réseau et stockage

- L'enregistrement principal reste local : Internet coupé ne doit pas interrompre l'écriture sur les disques du NVR.
- Les événements, métadonnées et clips sélectionnés sont synchronisés lorsque le réseau revient. Les clips critiques sont protégés contre l'effacement par rotation tant qu'ils sont dans leur période de rétention.
- Le live utilise un sous-flux adaptatif lorsque la connexion est faible. Le cloud ne reçoit pas 24/7 tous les flux HD.
- UPS pour NVR, PoE, routeur et sirène ; test réel de coupure secteur et de coupure Internet. Une seconde liaison 4G peut servir à envoyer alertes et commandes si le site le justifie.
- L'alarme locale doit pouvoir fonctionner sans Internet. Une sirène distante ne peut être commandée que lorsque le chemin réseau vers la passerelle est disponible.

### Dimensionnement indicatif du stockage

Formule simplifiée en unités décimales : **Go/jour ≈ débit vidéo en Mbps × 10,8**.

Exemple de dimensionnement, non devis : 4 caméras à 2 Mbps chacune pendant 30 jours en continu représentent environ **2,59 To** de vidéo brute (avant marge disque, redondance, audio éventuel, métadonnées et overhead). Le réglage réel dépend du codec, du nombre d'images, de la qualité et du mode continu/mouvement. Chaque pharmacie doit avoir une estimation sur ses modèles réels.

Le débit WAN ne doit pas être confondu avec le débit local du système : quatre flux live HD à 2 Mbps simultanés peuvent demander environ 8 Mbps montants au site, alors qu'un NVR local peut enregistrer sans transférer ces flux en permanence.

## 6. Alertes Android et commande de sirène

La PWA NAXA actuelle ne peut pas promettre une sonnerie fiable quand le navigateur est fermé, le téléphone en veille ou l'économie d'énergie active. Un companion Android natif est requis pour des canaux de notification sonores dédiés, FCM, le traitement de l'accusé de réception et des tests sur modèles de téléphones réels.

Android limite les notifications plein écran aux usages éligibles d'appel et d'alarme pour les applications ciblant Android 14 ou plus ; l'autorisation peut être refusée par l'utilisateur ou le magasin. Le produit ne doit donc pas promettre un réveil plein écran garanti sur tous les téléphones. Les canaux de notification et le mode Ne pas déranger restent sous contrôle du système et de l'utilisateur.

### Contrôle distant sûr

1. Autorisation serveur vérifiée sur l'utilisateur, la pharmacie et le rôle actif.
2. Écran de confirmation avec nom de la pharmacie, sirène cible et motif ; seconde confirmation pour une activation forte.
3. Commande signée, avec expiration courte, nonce anti-rejeu, identifiant idempotent et accusé de réception du boîtier.
4. Journal immuable : qui, où, quand, motif, demande, accusé matériel, durée et arrêt.
5. Arrêt local manuel possible. La sirène doit aussi pouvoir être neutralisée localement par la personne autorisée.
6. En cas de perte WAN, la commande distante est indisponible mais la détection et les règles locales de sécurité restent autonomes.

Le NVR/passerelle ne doit accepter aucune commande non authentifiée. Le déclenchement à distance ne doit jamais être exécuté par simple clic non confirmé ni par une prédiction IA.

## 7. Sécurité, vie privée et conformité Cameroun

La vidéosurveillance traite des images de salariés, clients, livreurs et visiteurs. Avant activation : analyse de base légale et finalité, information visible des personnes, information du personnel, registre du traitement, politique de conservation, procédures d'accès/effacement et gestion des incidents, contrôle des sous-traitants, localisation du stockage et transferts hors du Cameroun. Un conseil juridique local doit confirmer les formalités applicables au dispositif envisagé.

La référence normative est la [loi camerounaise n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel](https://www.prc.cm/files/9b/df/2c/e818fedc7d5568778f884ea2886bea7d.pdf). La durée de conservation doit être justifiée par la finalité et validée juridiquement ; aucune durée arbitraire n'est imposée ici.

Règles de conception :
- pas de caméra dans toilettes, vestiaires, zones de repos privées ni zones de consultation confidentielle ;
- audio désactivé par défaut et distinctement justifié s'il devait un jour être demandé ;
- accès en lecture, export et téléchargement soumis à permissions et journalisation ;
- flux et archives chiffrés en transit et au repos ; liens signés temporaires ; clés gérées côté serveur ;
- séparation stricte des pharmacies ; accès support NAXA exceptionnel, nominatif, temporaire et audité ;
- procédure de réponse aux violations de données et de retrait rapide des accès perdus/volés.

## 8. Modèle de coûts et modèle commercial

NAXA ne peut pas fixer un prix fiable sans audit matériel et devis fournisseurs. La grille commerciale devra séparer :
- installation initiale : caméras, switch/PoE, NVR/passerelle IA, disques, UPS, sirène/relais, câblage et main-d'œuvre ;
- abonnement mensuel par pharmacie : supervision, accès live, stockage événementiel distant, IA, notifications et support ;
- options de capacité : nombre de caméras, durée de conservation, niveau d'analytics, liaison secondaire ;
- maintenance : remplacement disque/caméra, mises à jour firmware, test batterie et support.

Je recommande une **option payante par pharmacie**, distincte de la licence ERP. Les coûts récurrents doivent être plafonnés par quotas et règles de rétention ; le flux vidéo HD continu ne doit pas être gratuit ou illimité.

## 9. Plan de réalisation et critères de recette

### Étape 0 — étude du site pilote (bloquante)
Inventorier fabricant, modèles, firmware et profils ONVIF ; nombre/position des caméras ; PoE et câblage ; NVR/disques ; débit Internet montant réel et stabilité ; secteur/UPS ; relais sirène ; zones filmées ; durée de conservation et notices. Choisir une pharmacie volontaire et un responsable de traitement contractuellement identifié.

### Étape 1 — socle vidéo sécurisé
Registre des dispositifs, rattachement obligatoire à une pharmacie, tunnel sortant, santé NVR/caméras, live relayé, lecture locale ou clip exportable, accès serveur multi-tenant et audit. Pas d'IA ni de déclenchement distant à ce stade.

### Étape 2 — événements et veille IA locale
Mouvement, intrusion de zone, franchissement, présence après fermeture, sabotage/obstruction, tampon pré/post événement, classement et acquittement. Mesurer les faux positifs sur plusieurs semaines avant activation d'alertes fortes.

### Étape 3 — assistance IA et alertes mobiles
Résumé descriptif des clips, notification sonore, accusé de réception, procédures d'escalade et companion Android. Tester avec écran verrouillé, application fermée, Doze, batterie basse, permission refusée, téléphone hors réseau et redémarrage.

### Étape 4 — sirène et extension
Relais sirène, commandes distantes signées, confirmations, anti-rejeu, arrêt local, audit et reprise après coupure ; pilote prolongé avant extension aux autres pharmacies.

### Critères d'acceptation pilote
- L'enregistrement local continue durant une coupure Internet et le système reprend sa synchronisation sans perdre les événements retenus.
- Aucun flux RTSP/ONVIF n'est accessible publiquement ; aucun port caméra n'est redirigé sur Internet.
- Un Promoteur A ne peut pas voir une pharmacie du Promoteur B ; un Responsable ne peut pas consulter une autre pharmacie.
- Un lien vidéo expiré ou révoqué ne donne plus accès au flux.
- Chaque lecture/export/événement/commande de sirène est traçable.
- Les clips événementiels incluent le tampon pré/post configuré et sont protégés de la rotation jusqu'à expiration de leur conservation.
- Une sirène locale de test fonctionne sans Internet ; une commande distante hors ligne retourne un état explicite « non transmise », jamais « activée ».
- L'alerte Android est mesurée sur le parc de téléphones pilote ; les cas non garantis sont affichés comme indisponibles, pas comme réussis.
- Les faux positifs sont mesurés et revus ; aucune accusation automatique n'est présentée.
- La conformité, la signalétique, la durée et les droits d'accès sont validés avant l'ouverture au public/personnel.

## 10. Risques majeurs et parades

| Risque | Gravité | Parade / condition de sortie |
|---|---|---|
| Caméras propriétaires/non compatibles | Élevée | Achat conditionné à un essai ONVIF sur les modèles exacts |
| Panne Internet / coupure secteur | Élevée | NVR local, UPS, alarme locale, synchronisation différée |
| Exposition d'un flux vidéo | Critique | Pas de RTSP public, relais sécurisé, jetons temporaires, test d'intrusion |
| Accès inter-pharmacies | Critique | Contrôle serveur à chaque action, tests Promoteur/Responsable croisés |
| Faux positifs IA | Élevée | Zones calibrées, score de confiance, seuils, validation humaine |
| Alerte mobile silencieuse | Élevée | Companion Android, canaux dédiés, test constructeur/Doze, sirène locale de secours |
| Déclenchement intempestif sirène | Élevée | Confirmation explicite, contrôle RBAC, anti-rejeu, journal, arrêt local |
| Fuite ou conservation excessive des images | Critique | Chiffrement, rétention validée, accès audité, revue juridique locale |
| Coût data/stockage non maîtrisé | Élevée | Edge-first, sous-flux, quotas, calcul par modèle et par pharmacie |

## 11. Arbitrage final

**GO** pour une phase de conception détaillée et un pilote matériel dans une pharmacie.  
**NO-GO** pour promettre dès maintenant le live/IA/sonnerie/sirène dans les tableaux de bord en production, car le dépôt ne dispose encore d'aucune intégration caméra ni companion Android, et aucun matériel pilote n'a été testé.

Périmètre fonctionnel retenu : live et lecture sécurisés, droits Promoteur/Responsable, événements locaux et clips, IA descriptive avec contrôle humain, alerte mobile par application Android compagnon, sirène physique autonome et commande distante explicitement confirmée. La reconnaissance faciale et les accusations automatiques sont exclues.

**Dépendances avant le premier pilote :** pharmacie volontaire, inventaire caméra/NVR, test ONVIF, réseau/UPS, validation juridique, devis matériel et définition de conservation. Aucun coût ni délai de déploiement n'est déclaré avant ces éléments.


## 12. Contrôles transversaux constatés sur Supabase Replay

Le contrôle de sécurité du projet Replay après la migration géographique a relevé des avertissements préexistants au module Sécurité Intelligente :

- Des fonctions `SECURITY DEFINER` exposées par le schéma API peuvent être appelées par `anon`, notamment `log_evenement` et `log_recherche`.
- Plusieurs fonctions `SECURITY DEFINER` sont exécutables par `authenticated`, notamment des fonctions d'accréditation (`accrediter_profile`, `accrediter_responsable`), de rappel de lots, d'indicateurs Admin et de création/gestion d'objets Admin. Le contrôle doit vérifier pour chacune que l'autorisation interne, les arguments, le `search_path` et les privilèges d'exécution correspondent exactement au contrat.
- La protection Supabase Auth contre les mots de passe compromis est signalée désactivée dans Replay.

Ces observations ne proviennent pas du code caméra (qui n'existe pas encore) et ne sont pas corrigées par ce chantier GPS. Elles constituent des réserves de sécurité transversales pour le feu vert global de NAXA et devront être auditées fonction par fonction ; le présent chantier ne révoque aucune fonction métier sans analyse de son usage.

### Contrôle du nouveau journal géographique

Vérification sur Replay : `public.naxa_pharmacie_geo_audit` existe, avec RLS activée et forcée ; `anon` et `authenticated` n'ont pas le privilège `SELECT`, tandis que `service_role` possède le privilège `INSERT`. Le Security Advisor peut afficher « RLS enabled, no policy » pour cette table : ce choix est intentionnel, car aucune lecture ou écriture cliente n'est autorisée ; les écritures et consultations passent par le serveur privilégié NAXA. Cette information est distincte des avertissements `SECURITY DEFINER` ci-dessus.


## 13. Démarrage de la Phase 1 — socle sécurisé (QA)

Le chantier passe de l'audit à une première fondation technique sur la branche qa/e2e-stabilisation-20261106, sans activation Production.

### Registre de données ajouté

Sept tables dédiées, toutes rattachées à une pharmacie et accessibles au backend privilégié uniquement :

- naxa_security_installations : état du site, inventaire, validation juridique et information des personnes ; le passage à pilot_ready / pilot_active est bloqué tant que les deux validations et l'approbateur ne sont pas présents.
- naxa_security_gateways : passerelle affectée à l'installation, avec mode réseau imposé à outbound_tunnel et référence de secret, jamais mot de passe en clair.
- naxa_security_cameras : inventaire ONVIF (profils T/G/M) attaché à une passerelle et à la même pharmacie.
- naxa_security_events : type, gravité, source IA/ONVIF/opérateur, score de confiance et revue humaine obligatoire pour toute qualification finale.
- naxa_security_clips : métadonnées de clips et chemin d'objet privé futur ; aucun lien public et aucun endpoint d'upload vidéo n'est fourni dans cette phase.
- naxa_security_siren_commands : registre de demandes et confirmations, avec nonce et idempotence ; aucun worker ni commande vers un relais matériel n'est installé.
- naxa_security_access_audit : journal append-only des accès, consultations, exports, revues et commandes.

### Contrôles d'accès

RLS est activée et forcée sur les sept tables. Les droits de table sont retirés à PUBLIC, anon et authenticated, puis accordés à service_role uniquement. Les contrôles de périmètre Promoteur/Responsable doivent donc être appliqués côté serveur avant chaque lecture ou mutation. La fonction du trigger d'immuabilité du journal n'est pas exposée comme RPC publique.

Le tableau Promoteur affiche désormais, sur la route Sécurité et uniquement pour les pharmacies actives du réseau courant, les installations et événements enregistrés. Il s'agit d'un panneau de registre, pas d'un lecteur vidéo. Un défaut de lecture du registre est présenté comme indisponibilité, jamais comme absence d'équipement.

### État fonctionnel de cette phase

- Construit : schéma privé, contraintes multi-pharmacies, audit append-only, garde juridique du pilote, écran Promoteur en lecture seule.
- Non activé : création d'installation depuis l'interface, enrôlement passerelle/caméra, stockage vidéo, flux live, détection IA, notifications Android en arrière-plan et commande physique de sirène.
- Aucune donnée matérielle de démonstration n'est injectée. Le registre vide signifie qu'aucun équipement n'a été déclaré dans NAXA, et ne prouve pas qu'un site réel n'en possède pas.

### Contrôle technique initial

Le DDL a été exécuté dans une transaction de validation sur Supabase Replay puis annulé : les sept tables, RLS forcée, absence de privilèges anon/authenticated, droits service_role, trigger append-only, revue humaine des événements, confirmation sirène et absence de colonnes d'URL/secret vidéo ont tous été retournés true. La migration persistante Replay et le résultat CI sont suivis séparément avant tout feu vert.


## 14. Compatibilité caméra multi-marques et multi-générations

Le cahier des charges NAXA ne doit pas être limité à ONVIF. Le connecteur repose sur une passerelle locale extensible et un catalogue d'adaptateurs :

- **ONVIF** : découverte et fonctions normalisées lorsque le modèle/firmware les implémente ; profils T/G/M et profil S historique selon génération.
- **RTSP / RTSPS** : réception du flux vidéo documenté, indépendamment de l'API de contrôle constructeur ; un flux RTSP seul ne fournit pas automatiquement événements, PTZ, lecture NVR ou relais I/O.
- **API / SDK officiels constructeur** : adaptateurs dédiés prévus pour Hikvision ISAPI, Dahua CGI/SDK, Axis VAPIX, Hanwha SUNAPI, Uniview LAPI, Vivotek API, FLIR ISOM et autres fabricants documentant une interface autorisée.
- **NVR/DVR** : connexion au recorder et exposition des canaux ; prise en charge des systèmes multi-canaux qui ne donnent pas un endpoint indépendant à chaque caméra.
- **Analogique** : anciennes caméras analogiques connectées à un DVR ou à un encodeur vidéo IP ; l'adaptateur s'attache alors au canal du recorder/encodeur.
- **Caméras Wi-Fi / Cloud** : flux local ou API Cloud officielle lorsqu'elle existe et que le fabricant autorise l'intégration. Pas de contournement d'application, chiffrement ou authentification propriétaire.

### Registre d'adaptateurs introduit sur QA

Le catalogue `naxa_security_camera_adapters` identifie chaque famille de connecteur, son protocole et son niveau d'implémentation. Les connexions multiples d'une même caméra sont enregistrées dans `naxa_security_camera_connections`, rattachées à la même pharmacie et à une passerelle locale. L'authentification pointe vers un secret conservé hors base ; aucun mot de passe ni URI contenant des identifiants n'est stocké dans ces tables.

Le registre initial référence les connecteurs génériques ONVIF, RTSP, RTSPS, NVR/DVR, encodeur analogique, capture HTTPS et API/SDK de plusieurs fabricants. **Tous sont initialement `design_only`** : leur présence au catalogue n'est pas une affirmation que le driver est déjà codé ou validé. Le statut `validated` sera réservé aux essais réussis sur les références exactes et leurs versions de firmware.

### Ce que « tous les modèles possibles » veut dire dans le produit

NAXA vise la compatibilité la plus large possible, et non une promesse absolue pour tout matériel existant. Une caméra propriétaire sans interface réseau documentée, API officielle, flux local accessible ou enregistreur/encodeur intermédiaire ne peut pas être intégrée proprement. Elle sera signalée `unsupported` ou `requires_credentials`, sans prétendre être connectée. Les capacités (live, lecture, enregistrement, PTZ, audio, événements, analytics, I/O) sont détectées et affichées séparément : une connexion vidéo ne signifie pas que toutes ces fonctions sont prises en charge.

### Vérification à l'installation

1. Identifier constructeur, modèle, firmware, type IP/Wi-Fi/analogique et recorder éventuel.
2. Découvrir ONVIF dans le réseau local ; en l'absence d'ONVIF, vérifier RTSP/RTSPS ou l'API/SDK officiel.
3. Si caméra analogique, identifier le modèle du DVR/encodeur et le canal.
4. Tester le flux et chaque capacité séparément ; chiffrer les secrets hors base et refuser les ports entrants exposés sur Internet.
5. Enregistrer le résultat par modèle et firmware, avec connecteur principal et solutions de repli.

Références de compatibilité : la base officielle ONVIF est la source de vérité du statut conformant, lequel est lié à la version logicielle enregistrée ; ONVIF rappelle aussi que les fonctions conditionnelles peuvent varier d'un appareil à l'autre. Voir [produits conformes](https://www.onvif.org/conformant-products/), [profils ONVIF](https://www.onvif.org/profiles/) et [FAQ conformité](https://www.onvif.org/conformance-faq/).
