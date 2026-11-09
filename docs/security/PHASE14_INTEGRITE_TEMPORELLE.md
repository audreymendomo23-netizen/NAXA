# Lot 14 — Horodatage et intégrité temporelle

**État : PARTIEL — fondations logicielles en cours de validation.**  
**Branche :** `qa/e2e-stabilisation-20261106`.

## Fondations construites
- `services/security-gateway/time-integrity.cjs` : client SNTP UDP sans dépendance tierce ; contrôle mode/version/stratum, leap indicator, originate timestamp, horodatages receive/transmit, calcul offset/RTT et bornes.
- Le serveur NTP doit être configuré explicitement via `NAXA_NTP_SERVER` sur la passerelle. Aucun serveur public n'est sélectionné silencieusement.
- L'agent corrige ses timestamps de signature Ed25519 avec l'offset mesuré. Si l'horloge locale est dans la fenêtre d'acceptation, le heartbeat HTTPS peut affiner l'offset à partir de l'heure renvoyée par le serveur.
- Migration `20261109040000_security_gateway_time_integrity.sql` : table privée `naxa_security_gateway_time_samples`, RLS + FORCE RLS, service_role uniquement, historique et RPC transactionnelle journalisée.
- Routes d'ingestion passerelle signée et lecture Promoteur scoppée aux pharmacies actives.
- UI : décalage, RTT, stratum, serveur NTP et âge. Seuil d'affichage : offset ≤1 000 ms, RTT ≤1 500 ms, mesure <10 min.

## Limites / preuve restante
- SNTP seul n'est pas authentifié (NTS non implémenté) ; il s'agit d'une télémétrie, pas d'une preuve cryptographique de l'heure.
- NAXA ne modifie pas l'horloge OS et ne prétend pas synchroniser les caméras/NVR. Seuls les timestamps de signature HTTP de la passerelle sont corrigés.
- FFmpeg peut encore nommer les fichiers selon une horloge système incorrecte.
- Non livré : incrustation vidéo, fuseau IANA par pharmacie, PTS/DTS, manifeste signé SHA-256, vérification hash après export et comparaison physique des 4 horloges.
- Les tests simulés ne prouvent pas une connexion NTP réelle.

Lot 14 reste PARTIEL jusqu'à la synchronisation OS/NTP réelle, l'intégrité des archives et la recette caméra/NVR physique.
