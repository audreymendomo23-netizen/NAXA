# Phase 13 — Enregistrement local, index et relecture

**Branche :** `qa/e2e-stabilisation-20261106`  
**État actuel : PARTIEL — fondation SQL de l'index réalisée ; aucun enregistrement vidéo activé.**

## 1. Audit initial et contradiction

L'audit de l'arbre Git n'a trouvé aucun service d'enregistrement, NVR local, lecteur d'archives, timeline ou route de lecture/export de segments. La table historique `naxa_security_clips` ne représentait que les métadonnées de clips associés à des événements ; elle ne pouvait pas indexer les segments d'un enregistrement continu.

Il serait incorrect d'activer `record: true` dans MediaMTX pour remplacer un enregistreur local. MediaMTX demeure le relais live ; l'enregistrement principal doit être géré sur la passerelle/NVR du site pour continuer sans Internet.

## 2. Correction réalisée — migration 310

Fichier : `supabase/migrations/20261109010000_security_local_recording_segments.sql`

La migration ajoute `naxa_security_recording_segments`, index privé des métadonnées des segments locaux :
- pharmacie, passerelle et caméra liées par clés étrangères composites ;
- mode continu / programmé / événementiel ;
- état du segment, début/fin UTC et durée ;
- codec, conteneur, taille, SHA-256 ;
- chemin local relatif, sans chemin absolu, traversal `..`, URI ou caractères de contrôle ;
- date de rétention, verrou de protection et motif ;
- audio interdit par contrainte SQL.

Un segment ne peut devenir `ready` ou `protected` sans durée, codec, taille et hash. Un segment protégé exige date et justification. Les index servent les recherches par pharmacie/caméra/date et le balayage de rétention.

La table est sous RLS + FORCE RLS, sans accès direct `anon`/`authenticated`, et réservée à `service_role`. Les actions et ressources d'accès aux segments sont ajoutées aux contraintes du journal append-only.

## 3. Preuves Replay

- Projet : `naxa-ci-replay-2` — `pwfftcsjyeibxxqhwysw`.
- Migration appliquée sur Replay : `security_local_recording_segments_lot13` — succès.
- Test SQL `supabase/tests/310_security_recording_segments.sql` : **17/17 assertions vraies**.
- Vérifications : RLS forcée, permissions backend-only, liens même pharmacie, unicité caméra/chemin, audio interdit, chemin relatif, machine d'état, hash/durée/codec/taille requis, segments protégés justifiés, audit et index de timeline/rétention.
- Aucun segment ni fausse caméra n'a été inséré.

## 4. Ce qui n'est pas encore livré

- Worker FFmpeg local qui découpe une source caméra réelle en segments récupérables.
- Activation opt-in par caméra, enregistrement réellement indépendant du WAN et reprise après panne secteur.
- Indexeur local qui calcule durée, codec, taille et SHA-256 et synchronise ses métadonnées lorsque le réseau revient.
- Limitation de capacité disque, rétention/rotation et protection physique des segments protégés.
- API serveur de timeline/recherche, autorisation Promoteur/Responsable, audit des consultations/exports/suppressions.
- Lecteur d'archives, pause/avance, téléchargement/export signé.
- Essai caméra/NVR physique, coupure Internet/secteur et recherche/lecture d'une séquence réelle.

La table SQL ne contient pas les octets vidéo et ne prouve donc aucun enregistrement.

## 5. Critère de sortie inchangé

**Le lot 13 reste PARTIEL et ne peut pas être vert** avant qu'une caméra physique enregistre localement, qu'une coupure Internet ne stoppe pas l'enregistrement, et qu'une séquence réelle soit indexée, retrouvée et lue avec les permissions et audits correspondants.

L'enregistrement ne doit pas être activé par défaut ni sur un site sans consentement/validation juridique. Le lot 12 matériel demeure lui aussi une réserve sur le chemin live réel.
