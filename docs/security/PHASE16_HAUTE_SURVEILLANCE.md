# Lot 16 — calendrier de haute surveillance

**Statut : PARTIEL — fondations logicielles validées par CI #1341 ; recette passerelle et fonctionnalités aval ouvertes.**

## Socle implémenté
- Migration 314 : politique par pharmacie, fuseau IANA, fenêtres hebdomadaires, exceptions datées, version croissante et expiration hors ligne 72 h.
- RLS + FORCE RLS, table privée, accès service_role uniquement.
- RPC transactionnelle naxa_security_save_high_surveillance_policy, SECURITY INVOKER, search_path vide, backend-only, audit Promoteur.
- UI Promoteur pour plusieurs plages/jours, heures de début/fin, fuseau et exceptions armées/désarmées.
- Synchronisation passerelle par requête Ed25519 authentifiée sur HTTPS, SHA-256 du contenu et cache local AES-256-GCM ; renouvellement chaque 5 minutes.
- Évaluateur local traite minuit et expiration. Exemple 22:00–08:00 sous Africa/Douala.
- Trigger serveur : mouvements/intrusions/franchissements/présences hors horaires dans une plage active reçoivent une priorité high.

## Preuves
- Migration 314 appliquée sur Supabase Replay pwfftcsjyeibxxqhwysw.
- Table présente, RLS forcée, RPC invoker verrouillée, exécution service_role seulement, trigger et évaluateur SQL présents.
- CI #1341 SUCCESS, SHA exact 909727b13bdd8872baba0450955206c3ed04d252 :
  - 290/290 tests PASS, 0 échec ;
  - audit npm : 0 vulnérabilité ;
  - validation officielle MediaMTX 1.21.3 ;
  - TypeScript, ESLint, compilation Next.js et 129/129 pages PASS.

## Limites
1. La réponse est protégée par TLS et empreinte SHA-256, pas une signature Ed25519 serveur indépendante ; une clé centrale sécurisée manque.
2. Le snapshot local est chiffré AES-GCM, mais la clé fichier reste sur le même appareil ; TPM/keystore non intégrés.
3. Les événements ONVIF ne sont pas persistés dans une file locale durable pendant une perte d'Internet.
4. Sensibilité par zone/modèle, IA, sonneries, destinataires, répétitions, escalades et sauvegardes immédiates de clips non raccordés.
5. UI Promoteur uniquement ; délégation Responsable mono-pharmacie non implémentée.
6. Aucun gateway/caméra réel pour prouver la réception et l'exécution hors ligne ; aucun appareil pilote n'est présent dans Replay.

**Verdict :** logiciels/tests PASS ; lot 16 global PARTIEL en attente d'intégration aval et de recette physique.
