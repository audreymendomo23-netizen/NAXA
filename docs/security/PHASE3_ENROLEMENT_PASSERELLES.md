# Phase 3 — Enrôlement sécurisé des passerelles locales

Date : 8 novembre 2026  
Branche : `qa/e2e-stabilisation-20261106`  
État : code de jumelage et protocole heartbeat implémentés ; validation CI en cours ; matériel réel non testé.

## 1. Jumelage par le Promoteur

Dans le module latéral **Sécurité**, chaque passerelle dispose d'un bouton **Créer un code de jumelage**. L'API vérifie la session Promoteur, l'état commercial, le rattachement actif et la pharmacie liée à la passerelle.

Un code aléatoire de 256 bits est généré et son SHA-256 seul est stocké. Il expire après 15 minutes, ne peut être utilisé qu'une fois et est affiché uniquement dans la réponse initiale au navigateur. L'émission et la rotation sont journalisées. Une nouvelle demande révoque un ancien code non consommé.

## 2. Identité cryptographique de la passerelle

L'agent local génère une paire Ed25519. La clé privée est conservée localement avec permissions 0600 dans un dossier 0700. La clé publique et son empreinte SHA-256 sont envoyées au serveur avec le code de jumelage.

Le serveur valide le type Ed25519, consomme atomiquement le code et enregistre la clé publique. Le fingerprint de la passerelle sélectionne l'identité active ; les clés précédentes sont révoquées après la bascule. Le endpoint accepte une reprise idempotente avec la même clé après une erreur transitoire. Aucun secret de passerelle ni clé privée n'est conservé dans la base NAXA.

## 3. Heartbeat signé et anti-rejeu

La passerelle initie uniquement des requêtes HTTPS sortantes vers :
- `POST /api/security/gateway/enroll`
- `POST /api/security/gateway/heartbeat`

Le heartbeat signe l'identifiant passerelle, l'horodatage, un nonce aléatoire et le SHA-256 du corps JSON. Le serveur vérifie Ed25519, limite la dérive d'horloge à 120 secondes et stocke le nonce avec une expiration. Un nonce déjà utilisé est refusé. Le statut `connected` signifie seulement qu'un heartbeat signé récent est reçu ; il ne signifie ni flux caméra actif ni pilote opérationnel.

## 4. Installation de l'agent (Node.js 22)

Copier `services/security-gateway/agent.cjs` sur une machine passerelle Linux récente avec Node.js 22.

Créer le code depuis l'espace Promoteur, puis exécuter localement :

```bash
sudo useradd --system --home /var/lib/naxa-security-gateway --shell /usr/sbin/nologin naxa-gateway
sudo install -d -o naxa-gateway -g naxa-gateway -m 0700 /var/lib/naxa-security-gateway
sudo install -d -m 0700 /run/naxa-security-gateway
sudo install -m 0600 /dev/null /run/naxa-security-gateway/enroll.token
sudoedit /run/naxa-security-gateway/enroll.token
sudo node /opt/naxa-security-gateway/agent.cjs enroll \
  --api-url https://<domaine-naxa> \
  --gateway-id <UUID_PASSERELLE> \
  --state-dir /var/lib/naxa-security-gateway \
  --token-stdin < /run/naxa-security-gateway/enroll.token
sudo chown -R naxa-gateway:naxa-gateway /var/lib/naxa-security-gateway
sudo chmod 0700 /var/lib/naxa-security-gateway
sudo chmod 0600 /var/lib/naxa-security-gateway/config.json /var/lib/naxa-security-gateway/gateway-ed25519-private.pem
sudo rm -f /run/naxa-security-gateway/enroll.token
```

Le code est lu uniquement depuis stdin (fichier temporaire accessible à l'utilisateur système, mode 0600) : il n'apparaît ni dans les arguments du processus, ni dans l'historique du shell, ni dans la configuration persistante. Après le jumelage, la clé privée locale et la configuration restent dans le dossier privé de l'utilisateur système, en mode 0600. En cas d'erreur transitoire, relancer la commande avec le même dossier local, la même clé et le même code tant qu'il n'a pas expiré.

Démarrer le heartbeat ponctuel :

```bash
sudo node /opt/naxa-security-gateway/agent.cjs heartbeat \
  --state-dir /var/lib/naxa-security-gateway
```

Exécuter le service en continu :

```bash
sudo node /opt/naxa-security-gateway/agent.cjs run \
  --state-dir /var/lib/naxa-security-gateway --interval 60
```

Un modèle systemd est livré dans `services/security-gateway/naxa-security-gateway.service`. Ajuster son chemin d'installation avant activation.

## 5. Cloisonnement et limites

- Aucun serveur HTTP n'est démarré sur la passerelle ; aucun port entrant n'est demandé.
- Aucun mot de passe caméra ou URI RTSP ne traverse ce premier protocole.
- L'agent ne remonte que la capacité `heartbeat`. Il ne prétend pas découvrir les caméras ni lire la vidéo.
- Le heartbeat ne modifie jamais l'état d'une caméra.
- La vidéo et l'analyse restent fermées tant que le pilote matériel, les drivers, la conservation, la validation juridique et les tests locaux ne sont pas réalisés.

## 6. Durcissement complémentaire des connecteurs

La migration ajoute des contraintes sur les profils caméra : les références d'identifiants doivent être de la forme `vault://...`, les chemins ne peuvent pas contenir des paramètres de secret et les métadonnées rejettent les clés de mot de passe/token/secret.

## 7. Tests

- Test unitaire agent : signature Ed25519, intégrité du corps, URL HTTPS et permissions de fichiers.
- Test de contrat statique : code à durée limitée, contrôle de périmètre, consommation unique, anti-rejeu et absence de serveur entrant.
- Test SQL : RLS forcée, droits service_role seulement, index de code unique, sélection par fingerprint courant et contraintes de secret.
- La CI ne constitue pas un test physique. Une passerelle et un modèle de caméra réels seront requis pour valider la couche réseau et les futurs drivers.
