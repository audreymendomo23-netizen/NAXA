# Phase 13 — Enregistrement local, index et relecture

**Branche :** `qa/e2e-stabilisation-20261106`  
**Référence CI :** `cd77624e764f435be956f1c798d145e9c2bcfb39` — GitHub Actions #1327 SUCCESS  
**Socle logiciel : VERT (tests dédiés et CI #1388). Lot 13 complet : PARTIEL.** La timeline metadata/protection est livrée ; la lecture/export vidéo, les modes programmé/événementiel, la supervision disque et la recette NVR restent ouverts.

## 1. Audit → contradiction → cause racine

La table historique `naxa_security_clips` ne représentait que des clips d'événements. Elle ne pouvait pas indexer des segments de surveillance continue. Le relais MediaMTX est destiné au direct et reste configuré sans enregistrement serveur (`record: false`) : il ne remplace pas un enregistreur local indépendant du WAN.

Le modèle SQL et le worker local ont maintenant été ajoutés. La fiche ne doit toutefois pas confondre l'index de métadonnées avec les octets vidéo, ni les tests logiciels avec un enregistrement sur vraie caméra.

## 2. Architecture et implémentation

### 2.1 Index serveur — migration 310

Fichier : `supabase/migrations/20261109010000_security_local_recording_segments.sql`

La table `public.naxa_security_recording_segments` conserve pharmacie, passerelle, caméra, mode, état, début/fin UTC, durée, codec, format, chemin relatif, taille, SHA-256, audio, rétention et informations de protection.

Garde-fous :
- clés étrangères composites empêchant les mélanges de pharmacies ;
- audio obligatoirement désactivé ;
- aucun chemin absolu, traversal, URI ou caractère de contrôle ;
- états `ready`/`protected` avec durée, codec, taille et hash ;
- état protégé avec horodatage et justification ;
- RLS + FORCE RLS, aucun droit direct navigateur, service_role uniquement ;
- journal d'accès prévu pour lecture/export/suppression et changements de politique.

### 2.2 Worker d'enregistrement local

Fichiers : `services/security-gateway/recording.cjs`, `services/security-gateway/agent.cjs`.

- Aucune écriture avant politique explicite ; défaut désactivé.
- Seules les caméras déjà configurées localement peuvent être activées.
- Segments continus MP4 de 30 à 900 secondes, horodatés UTC.
- Copie de la vidéo, audio supprimé par `-an`.
- `-n` bloque l'écrasement d'un segment existant.
- FFmpeg ne reçoit pas les identifiants RTSP en arguments ; un manifeste temporaire privé (0600) est supprimé après l'exécution.
- Répertoires d'état/enregistrement privés (0700), validation RTSP/RTSPS vers réseau local, pas de shell.
- Un signal d'arrêt préexistant interdit le spawn ; arrêt du worker par AbortController.

Le mode effectivement raccordé à la politique locale est continu. Le support réel des plages programmées et du déclenchement événementiel reste à implémenter.

### 2.3 Indexeur local et outbox hors ligne

Fichier : `services/security-gateway/recording-indexer.cjs`.

- Attend la fermeture/stabilité du MP4, vérifie inode/taille/mtime.
- `ffprobe` est lancé sans shell, avec timeout et sortie bornée.
- Codec vidéo requis ; une piste audio invalide le segment.
- SHA-256 calculé sur un fichier régulier, sans suivre de lien symbolique.
- Index et outbox persistés avec AES-256-GCM ; reprise après redémarrage et réémission idempotente par lot.
- Un échec réseau conserve les éléments en attente ; ceux-ci ne sont pas purgés par la rétention.
- La synchronisation ne transporte que les métadonnées ; les octets vidéo restent localement sur la passerelle/NVR.

**Limite cryptographique :** la clé AES est stockée en fichier privé sur le même appareil que les fichiers chiffrés. Ce mécanisme évite le contenu en clair dans l'index/outbox, mais ne protège pas contre la compromission ou le vol de l'appareil complet. TPM/keystore système non intégrés.

### 2.4 Synchronisation signée — migration 311 et API

Fichiers :
- `supabase/migrations/20261109020000_security_recording_segment_sync.sql`
- `src/app/api/security/gateway/recording-segments/route.ts`
- `src/lib/security/gateway-request.ts`

La passerelle transmet un lot de 1 à 10 métadonnées par HTTPS, signature Ed25519 du corps brut et nonce anti-rejeu. Le serveur contrôle l'installation pilote, les validations légale/confidentialité, le rattachement caméra/passerelle/pharmacie, le format, le chemin, le hash, la durée, la taille et l'absence audio. La RPC est réservée au backend et idempotente.

Ni identifiants vidéo, ni données binaires, ni URL publiques ne sont acceptés.

## 3. Preuves
- Revalidation finale de branche : CI #1388 SUCCESS sur SHA 2ccbaf673e5b490688096aa2393ccdd7191fc86d, avec **290/290 tests PASS** et **27/27 sous-tests lot 13 PASS** dans les logs.
- Audit des dépendances de production : 0 vulnérabilité ; TypeScript, ESLint, build Next.js et 129/129 pages statiques PASS.

### Replay
Projet : `naxa-ci-replay-2` — `pwfftcsjyeibxxqhwysw`.
- Migration 310 appliquée ; test SQL `supabase/tests/310_security_recording_segments.sql` : **17/17 assertions PASS**.
- Migration 311 / RPC de synchronisation testée sur Replay ; contrôles de fonction, verrouillage backend, validation du chemin, audit, lot vide et idempotence réussis.
- Aucun segment, fichier média, appareil ou flux fictif injecté.

### CI
GitHub Actions #1327 : https://github.com/audreymendomo23-netizen/NAXA/actions/runs/42548972061
- SHA exact : `cd77624e764f435be956f1c798d145e9c2bcfb39`.
- **271/271 tests PASS, 0 échec**.
- Audit des dépendances : **0 vulnérabilité**.
- Validation officielle de la configuration MediaMTX 1.21.3 : succès.
- Next.js : compilation réussie et **129/129 pages statiques** générées.
- TypeScript, ESLint et build de production : succès.

## 4. Restes — explicitement non verts

1. **Timeline métier :** API de recherche temporelle, pagination, filtres caméra/événement/état et permissions Promoteur/Responsable.
2. **Protection de preuve :** API protect/unprotect, journalisation complète, synchronisation descendante des segments protégés vers le worker local et preuve que la rétention ne peut les supprimer.
3. **Relecture/export :** canal sécurisé sortant-only depuis la passerelle/NVR, jetons courts, pause/avance/positionnement, export et hash vérifié. Aucun chemin local ne doit être exposé au navigateur.
4. **Résilience disque :** monitoring de capacité, seuils d'alerte, disque plein, reprise après coupure secteur et contrôle des segments incomplets.
5. **Modes et politiques :** planification continue/par plages/événementielle réellement appliquée au worker, et non simplement présente dans le schéma.
6. **Recette physique :** caméra/NVR réelle, enregistrement WAN coupé, coupure secteur/redémarrage, index, recherche, lecture et export réels.

## 5. Verdict

**Fondations logicielles CI + Replay : PASS. Construction du worker/indexeur : prête pour intégration de la timeline. Lot 13 complet : PARTIEL, non vert.**  
Le lot 12 vidéo live matériel reste PARTIEL également. Aucune installation pilote, caméra ou image réelle n'a été présentée comme connectée.

Ne pas activer l'enregistrement automatiquement. Le consentement, l'approbation légale et l'avis de confidentialité demeurent obligatoires. Ne pas déclarer le lot terminé avant les points 1–6 et la preuve sur matériel réel.


## Complément — protection et timeline des métadonnées (09/11/2026)

### Migration 312 / RPC
- Migration locale QA : `supabase/migrations/20261109030000_security_recording_protection.sql`.
- Migration appliquée sur Replay sous le nom `security_recording_protection_lot13`.
- RPC `naxa_security_set_recording_protection` : verrouille la ligne `FOR UPDATE`, autorise ready/protected, exige une justification 8–500 caractères, protège ou libère et ajoute un audit dans la même transaction.
- Test Replay : existence/type de signature PASS ; SECURITY INVOKER et search_path vide PASS ; service_role autorisé, anon/authenticated refusés PASS ; verrou et audit PASS ; justification trop courte rejetée PASS.

### Parcours Promoteur et passerelle
- `POST /api/security/recording-segments/protection` : Promoteur actif, pharmacie rattachée/active, motif obligatoire, aucun chemin local exposé.
- `POST /api/security/gateway/recording-protection` : requête Ed25519 signée et anti-rejeu ; la passerelle ne reçoit que les noms de fichiers protégés des caméras de son gateway. Si le résultat est trop volumineux ou incomplet, le serveur ne prétend pas que la liste est complète.
- Worker local : les noms protégés sont normalisés/validés strictement ; un snapshot serveur inconnu ou incomplet suspend la purge locale ; outbox toujours protégé.
- Aucun flux entrant vers la passerelle n'est ouvert.

### Timeline
- `GET /api/security/recording-segments` : bornes 31 jours, 100 lignes, périmètre Promoteur et pharmacies actives, journalise chaque segment affiché ; aucun `storage_path` renvoyé.
- `SecurityRecordingTimeline` branché dans le tableau Sécurité : dates, codec, taille, SHA-256, statut, motif, protection/libération avec justification.
- Pas de faux lecteur : la lecture et l'export restent explicitement indisponibles à ce stade.

### CI
- Première CI sur `6624fc2d` : **275 PASS / 1 FAIL sur 276**. Cause racine prouvée : l'ancien test de rétention utilisait `protected.mp4`, non conforme au nouveau validateur par caméra. Le test est corrigé pour employer le nom réel `{camera_uuid}_YYYYMMDDTHHMMSS.mp4`.
- Nouvelle CI du SHA de correction attendue ; aucun statut vert avant son résultat.
