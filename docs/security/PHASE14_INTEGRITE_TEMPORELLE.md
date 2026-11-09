# Lot 14 — horodatage et intégrité temporelle

**Statut : PARTIEL — fondations logicielles CI validées, intégrité caméra/NVR non recettée.**

## Implémenté
- Client SNTP UDP local : validation mode/version/stratum/originate timestamp, calcul offset et RTT.
- Configuration explicite NAXA_NTP_SERVER ; aucune modification automatique de l'horloge système.
- Offset de passerelle appliqué aux timestamps des requêtes Ed25519 ; heartbeat HTTPS utilisé comme ajustement complémentaire si le premier appel est accepté.
- Migration 313 : naxa_security_gateway_time_samples, RLS + FORCE RLS, RPC SECURITY INVOKER, search_path vide, service_role seulement, verrou et audit.
- API passerelle signée, API de consultation Promoteur scoppée au réseau actif et composant UI affichant source/stratum/offset/RTT/âge.
- Seuil d'affichage : offset ≤1 000 ms, RTT ≤1 500 ms, mesure de moins de 10 minutes.

## Preuves
- Replay pwfftcsjyeibxxqhwysw : table/RLS, fonction, grants backend-only et audit/transaction vérifiés.
- CI #1333 SUCCESS sur SHA e78cacf5cdf894b9df2a32d70418ee4eb362219e : 283/283 tests PASS, 0 échec, audit npm 0 vulnérabilité, TS/ESLint/build PASS, 129/129 pages.
- Test NTP UDP simulé : calcul et rejet d'une origine incohérente ; ne prouve pas la disponibilité d'un serveur NTP du pilote.

## Restes obligatoires
1. Configurer un serveur NTP de confiance sur la passerelle physique et mesurer dérive/RTT réels.
2. Synchroniser l'horloge OS de la passerelle par le service d'administration Linux ; NAXA ne change pas l'heure OS.
3. Vérifier l'horloge caméra/NVR ; SNTP passerelle ne garantit pas leur horloge.
4. Ajouter l'incrustation date/heure seconde/pharmacie/caméra/fuseau à l'export, sans écraser l'original.
5. Préserver PTS/DTS, créer un manifeste d'archive SHA-256 signé et vérifier le hash après export.
6. Tester le franchissement de minuit, redémarrage, coupure réseau et comparaison physique serveur/passerelle/NVR/caméra.

**Blocage matériel :** aucun gateway, caméra ou NVR n'est enregistré sur Replay ; aucune mesure réelle n'a été transmise. Le lot 14 global reste PARTIEL.
