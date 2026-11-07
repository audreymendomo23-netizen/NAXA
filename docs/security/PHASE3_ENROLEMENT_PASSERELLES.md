# Phase 3 — Enrôlement sécurisé des passerelles locales

Date : 8 novembre 2026  
Branche : `qa/e2e-stabilisation-20261106`  
État : code de jumelage et protocole heartbeat implémentés ; validation CI en cours ; matériel réel non testé.

## 1. Jumelage par le Promoteur

Dans le module latéral **Sécurité**, chaque passerelle dispose d'un bouton **Créer un code de jumelage**. L'API vérifie la session Promoteur, l'état commercial, le rattachement actif et la pharmacie liée à la passerelle.

Un code aléatoire de 256 bits est généré et son SHA-256 seul est stocké. Il expire après 15 minutes, ne peut être utilisé qu'une fois et est affiché uniquement dans la réponse initiale au navigateur. L'émission et la rotation sont journalisées. Une nouvelle demande révoque un ancien code non consommé.

## 2. Identité cryptographique de la passerelle

L'agent local génère une paire Ed25519. La clé privée est conservée localement avec permissions 0600 dans un dossier 0700. La clé publique et son empreinte SHA-256 sont envoyées au serveur avec le code de jumelage.

Le serveur valide le type Ed25519, consomme atomiquement le code et enregistre la clé publique. Les anciennes clés actives sont révoquées lors du remplacement. Aucun secret de passerelle ni clé privée n'est conservé dans la base NAXA.

## 3. Heartbeat signé et anti-rejeu

La passerelle initie uniquement des requêtes HTTPS sortantes vers :
- `POST /api/security/gateway/enroll`
- `POST /api/security/gateway/heartbeat`

Le heartbeat signe l'identifiant passerelle, l'horodatage, un nonce aléatoire et le SHA-256 du corps JSON. Le serveur vérifie Ed25519, limite la dérive d'horloge à 120 secondes et stocke le nonce avec une expiration. Un nonce déjà utilisé est refusé. Le statut `connected` signifie seulement qu'un heartbeat signé récent est reçu ; il ne signifie ni flux caméra actif ni pilote opérationnel.

## 4. Installation de l'agent (Node.js 22)

Copier `services/security-gateway/agent.cjs` sur une machine passerelle Linux récente avec Node.js 22.

Créer le code depuis l'espace Promoteur, puis exécuter localement :

```bash
sudo install -d -m 0700 /var/lib/naxa-security-gateway
sudo node /opt/naxa-security-gateway/agent.cjs enroll \
  --api-url https://<domaine-naxa> \
  --gateway-id <UUID_PASSERELLE> \
  --token <CODE_A_USAGE_UNIQUE> \
  --state-dir /var/lib/naxa-security-gateway
```

Ne placez pas le code dans l'historique d'un script ou dans un fichier partagé. L'agent ne l'enregistre pas. Après le jumelage, la clé privée locale et la configuration sont écrites en mode 0600.

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
- Test SQL : RLS forcée, droits service_role seulement, index de code unique/clé active et contraintes de secret.
- La CI ne constitue pas un test physique. Une passerelle et un modèle de caméra réels seront requis pour valider la couche réseau et les futurs drivers.
