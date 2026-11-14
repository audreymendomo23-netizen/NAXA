# Audit de capacité de mise au vert — Android NAXA

Date : 14 novembre 2026  
Branche : `main`  
Base source : commit `065081b107faeef7f0bae32fa240f2fc26b44365`  
Référence technique : `docs/audits/AUDIT_APPLICATION_ANDROID_NAXA.md`

## 1. Objet

Ce document ne déclare aucun point corrigé. Il évalue, pour chaque priorité source de l'audit Android, ce que l'assistant peut effectivement corriger et prouver par le dépôt et la CI, ce qui dépend d'une configuration ou d'un accès externe, et ce qui ne peut pas être homologué sans intervention terrain.

Trois classes sont utilisées :

- **A — Vert technique réalisable ici** : correction du code/configuration et preuve possible par compilation, tests unitaires, tests instrumentés ou CI.
- **B — Vert conditionnel** : une partie du code et des tests peut être produite ici, mais la clôture exige un secret, une migration autorisée, un environnement, des données de test ou une validation externe.
- **C — Non homologable ici seul** : je peux préparer le code et les tests, mais je ne peux pas fournir ou certifier le matériel, l'approbation, le secret, la signature ou l'opération externe indispensable.

Les points ne sont pas AU VERT tant que la correction correspondante n'a pas été faite et que ses critères de preuve n'ont pas passé.

## 2. Capacité réelle des outils

| Capacité | Disponible | Limite |
|---|---|---|
| Lire les fichiers, arborescences et commits GitHub | Oui | Dépend des permissions de connexion |
| Créer/modifier un fichier sur `main` | Oui | Écrit directement sur `main` ; chaque commit déclenche les workflows configurés selon leurs filtres |
| Déclencher la CI Android par modification d'un fichier Android ou du workflow | Oui, indirectement par push | Pas d'action de dispatch manuel exposée |
| Lire les jobs, étapes, logs et artefacts GitHub Actions | Oui | Les artefacts ont une durée de conservation configurée |
| Exécuter Gradle/Android SDK dans un runner local depuis cette session | Non | Le checkout local, Gradle et Android SDK ne sont pas disponibles dans cet environnement |
| Lire ou créer les secrets GitHub | Non | Aucun outil Secrets GitHub exposé |
| Lire/modifier les variables et secrets Vercel | Non | Aucun outil adapté dans cette session |
| Appliquer une migration Supabase à Production | Non autorisé dans cette mission | Écriture Production exige une autorisation distincte |
| Installer et manipuler un téléphone Android physique | Non | Aucun appareil physique connecté |
| Connecter un capteur BLE physique | Non | Aucun périphérique BLE de laboratoire connecté |
| Installer l'APK depuis le site NAXA sur un appareil réel | Non | Nécessite artefact signé, site accessible et téléphone de recette |
| Tester le push FCM de bout en bout sur un téléphone | Non | Nécessite secret serveur valide et appareil enrôlé |

Conséquence : je peux fermer des points par commits et CI Android, mais je ne peux ni inventer les secrets absents, ni certifier une installation matérielle que je n'ai pas effectuée.

## 3. Priorités P0

| ID | Point | Classe | Ce que je peux faire | Ce qui empêche le vert complet |
|---|---|---|---|---|
| P0-01 | Configuration Supabase du build CI | **B** | Modifier le workflow et Gradle ; imposer un échec immédiat si les variables sont absentes ; ajouter contrôle de configuration compilée et test d'authentification automatisé | Je ne peux ni lire ni créer les secrets GitHub. Le vert exige que les secrets corrects existent, que la CI les injecte et qu'une vraie authentification réussisse |
| P0-02 | Espaces natifs Promoteur, Pharmacie, Partenaire, Responsable, Comptable, Pharmacien, Stock et Livreur | **B** | Construire les écrans, navigation, clients API, guards, états et tests unitaires/instrumentés, progressivement par rôle | La clôture exige tous les parcours métier et les mutations serveur réellement autorisés, des comptes/structures de recette et des E2E qui prouvent l'isolation des rôles. Je ne peux pas déclarer les espaces complets après une simple compilation |
| P0-03 | Cycle Client panier → commande/réservation → paiement → livraison | **B** | Développer les écrans natifs et raccorder les API existantes ou compléter les adaptateurs manquants ; tests du calcul, des états et des transitions | Le vert complet nécessite E2E avec backend, pharmacie, stock réel de recette, paiement en mode contrôlé et livraison. Le code seul ne prouve pas la bonne exécution métier de bout en bout |

**Conclusion P0 :** je peux produire le code et les tests de ces trois sujets, mais aucun ne peut être déclaré vert immédiatement. P0-01 est le plus petit et le plus directement corrigeable ; P0-02 et P0-03 sont des lots fonctionnels majeurs.

## 4. Priorités P1

| ID | Point | Classe | Ce que je peux faire | Ce qui empêche le vert complet |
|---|---|---|---|---|
| P1-01 | Tableau de bord Admin natif limité | **B** | Porter les actions Admin disponibles en API, ajouter formulaires, confirmations, erreurs et contrôles de permission | Il faut vérifier chaque mutation serveur, chaque périmètre et chaque opération Admin 360. Les opérations sans API/contrat métier ne peuvent être déclarées vertes sur la seule UI |
| P1-02 | Isolation de la file BLE par utilisateur | **A** | Partitionner la file par compte ou définir un cycle sûr à la déconnexion ; écrire tests unitaires et instrumentés changement de compte A → B | La recette BLE radio n'est pas incluse dans ce point ; elle demeure séparée |
| P1-03 | Worker BLE lorsque la session est absente | **A** | Corriger le résultat du Worker et la planification de reprise après authentification ; ajouter tests de session absente, restaurée et révoquée | Les tests automatisés prouvent la logique ; la reprise durable sur plusieurs constructeurs Android doit encore être observée sur appareils cibles |
| P1-04 | Accumulation des événements d'état BLE lorsque l'écran est fermé | **A** | Séparer les événements d'interface de la file de mesures ou ajouter un consommateur de fond sûr ; tests instrumentés de longue file et ACK | La stabilité prolongée sous contraintes OEM reste à éprouver sur appareil |
| P1-05 | Enrôlement FCM après connexion pour tous les rôles autorisés | **B** | Déclencher l'enrôlement après chaque session validée, traiter la rotation du jeton, exposer les erreurs et tester le contrat d'inscription | Le push réel exige le secret `FIREBASE_SERVICE_ACCOUNT_JSON` côté serveur, un jeton enregistré et un téléphone Android connecté. Je ne peux ni lire ni configurer ce secret |
| P1-06 | File durable de reprise SMS et notifications dans le compagnon | **A** pour la logique locale ; **B** pour l'E2E opérateur | Construire une file locale chiffrée/idempotente avec WorkManager, ACK serveur et tests de reprise réseau/duplication | La réception effective des SMS/notifications des applications opérateur et les restrictions du système Android exigent des téléphones réels |
| P1-07 | Consentement SMS Admin synchronisé côté serveur | **B** | Ajouter un contrat API Admin distinct, enregistrer/revoquer le consentement et compléter les tests serveur/Android | Le endpoint actuel `/api/paiements/android-device/sms-consent` ne couvre que Pharmacie et Partenaire. L'extension Admin demande schéma/API et migration ; application en Production non autorisée ici |
| P1-08 | Chaîne APK Release signée | **B** | Configurer `signingConfig`, builds Release, contrôles certificat/package/version, SHA-256 et jobs CI conditionnés aux secrets | Je ne peux pas lire/créer le secret keystore GitHub ni garantir la propriété et la conservation de la clé de signature. Le propriétaire doit fournir et enregistrer la clé de production |
| P1-09 | Installation/mise à jour APK depuis le site NAXA | **C** pour la livraison finale | Préparer endpoint, page de téléchargement, métadonnées de version, empreinte et documentation | Le vert exige APK Release signé, hébergement du binaire, déploiement du site et installation/mise à jour réelles. Aucun déploiement n'est autorisé dans cet audit |
| P1-10 | Homologation BLE modèle par modèle | **C** | Ajouter adaptateurs, profils GATT et tests de décodeur lorsque les spécifications et trames sont fournies | Impossible de certifier les scans, caractéristiques, unités, reconnexions et mesures sans les capteurs physiques des modèles annoncés |
| P1-11 | Homologation capture SMS/Notification du compagnon | **C** pour la preuve finale | Durcir les gates, traiter les erreurs, créer tests de logique et contrôler les manifestes | Il faut tester installation, allowlist des permissions restreintes, consentements, révocation, SMS et packages opérateur sur les téléphones cibles |

## 5. Priorités P2

| ID | Point | Classe | Ce que je peux faire | Ce qui empêche le vert complet |
|---|---|---|---|---|
| P2-01 | Statut Admin de capture par canal | **A** | Distinguer l'enrôlement Orange et MTN, contrôler les identifiants de chaque canal, refléter l'état réel plutôt que la seule permission locale ; tests unitaires | Le contrôle final nécessite la configuration réelle des destinations marchandes et un enrôlement Admin de recette |
| P2-02 | Vérification complète du compagnon sur plusieurs versions Android/OEM | **C** | Ajouter une matrice de tests et des assertions automatisées | Nécessite téléphones physiques avec versions Android et constructeurs réellement ciblés |
| P2-03 | Reprise FCM sur rotation du jeton et réinstallation | **B/C** | Écrire le cycle d'enrôlement/désinscription et tests de contrat | La validation finale nécessite Firebase opérationnel et appareils réels |

## 6. Liste synthétique

### A — Points que je peux mettre au vert technique par code + CI

1. P1-02 — Isolation de la file BLE par compte.
2. P1-03 — Reprise du Worker BLE lorsque la session est absente.
3. P1-04 — Nettoyage/séparation des événements BLE d'état.
4. P1-06 — File locale durable du compagnon, pour la logique de persistance et de reprise testée en CI.
5. P2-01 — État exact de capture Admin par canal.

Ces points n'exigent pas de secret de production ni de périphérique radio pour prouver la correction logicielle. Le vert restera limité au comportement logiciel automatisé.

### B — Points sur lesquels je peux faire le code, mais pas garantir seul le vert complet

1. P0-01 — Configuration Supabase CI : dépend des secrets GitHub et d'une authentification réelle.
2. P0-02 — Espaces professionnels : dépend de tous les parcours métier, API, rôles et E2E.
3. P0-03 — Parcours Client : dépend du cycle de commande/paiement/livraison en environnement de recette.
4. P1-01 — Admin 360 natif : dépend de l'ensemble des API/actions et permissions.
5. P1-05 — FCM : dépend du secret de service et d'un appareil pour le push réel.
6. P1-07 — Consentement SMS Admin : dépend d'un contrat serveur et d'une migration de base.
7. P1-08 — Release signée : dépend de la clé de signature conservée par le propriétaire.

### C — Points que je ne peux pas homologuer seul

1. P1-09 — Installation et mise à jour depuis le site, sans publication/déploiement et téléphone de recette.
2. P1-10 — Compatibilité BLE de chaque modèle de capteur sans matériel réel.
3. P1-11 — Capture SMS et notifications sur Android réel et permissions effectives.
4. P2-02 — Matrice de téléphones/constructeurs.
5. P2-03 — Push FCM réel après rotation/réinstallation, sans service configuré et appareil physique.

## 7. Ordre recommandé de fermeture

Ordre de travail qui maximise les preuves obtenables avant de demander les interventions externes :

1. **P0-01** : corriger la configuration Supabase CI et obtenir une authentification réussie sur l'APK CI.
2. **P1-02, P1-03, P1-04** : fermer les défauts logiciels de file et de reprise BLE par tests instrumentés sur l'émulateur API 35 déjà présent dans le workflow.
3. **P2-01, P1-07** : fiabiliser l'enrôlement et les consentements Admin par canal ; la partie P1-07 restera conditionnée à la migration serveur autorisée.
4. **P1-05, P1-06** : finaliser enrôlement FCM et stockage durable de capture ; séparer leurs preuves CI de la recette appareil.
5. **P1-08** : préparer le pipeline Release puis demander la configuration sécurisée de la clé de signature.
6. **P0-02, P0-03, P1-01** : compléter les lots fonctionnels natifs avec tests de parcours et de permissions par rôle.
7. **P1-09, P1-10, P1-11, P2-02, P2-03** : organiser la recette sur téléphones, capteurs, services et hébergement réels.

## 8. Règle de décision

Un point n'est pas déclaré AU VERT parce que son code est écrit, compile ou possède un test unitaire. Il passe au vert uniquement lorsque :

- la correction est intégrée sur `main` ;
- les tests correspondant au risque passent ;
- le parcours réel pertinent est prouvé lorsque le point implique un service externe, un rôle métier ou un appareil ;
- les preuves sont liées au commit et le périmètre restant est explicite.

**Verdict de capacité :** je peux fermer plusieurs défauts logiciels Android sans attendre un téléphone physique, et je peux préparer la majorité des autres corrections. Je ne peux pas certifier seul la configuration des secrets, la signature de production, les parcours métier réels complets, le téléchargement installé depuis le site, les notifications/paiements en conditions réelles ni la compatibilité BLE matérielle.
