# Audit de réconciliation Supabase Replay / Naxa — 14 novembre 2026

## Périmètre

- Replay : `pwfftcsjyeibxxqhwysw`
- Naxa : `eouwtuusnsuxaejsxknf`
- Dépôt : `audreymendomo23-netizen/NAXA`, branche `main`
- HEAD au début de la passe : `8b0f694f200946e18b59ad6df88f29d5a67f1132`
- Un commit GrillaD `ea2d3b787b24708a17bc4f26ebde6c777fcc653e` est arrivé pendant la préparation ; il est conservé comme parent du lot de corrections.

## Corrections SQL appliquées sur Naxa et maintenant versionnées

### `20261114003452_naxa_delivery_null_safe_payment_guards_20261114.sql`

- `reservations.preparation_statut` est rendu `NOT NULL`, après vérification préalable de l'absence de valeur nulle.
- 18 index complémentaires Livreur / paiements sont créés.
- Les fonctions Stock, dispatch, acceptation, liste des missions, retrait, déclaration espèces, Caisse et finalisation rejettent un mode de paiement nul.
- La publication d'une mission exige une préparation physique confirmée par Stock.
- Le helper de dispatch demeure exécutable uniquement par `service_role`.
- Le calcul de clôture conserve les frais client entre 1 500 et 3 500 FCFA et la commission fixe de 500 FCFA.
- Les définitions SQL utilisées pour cette migration ont été extraites des fonctions effectivement installées sur Naxa.

### `20261114003821_naxa_security_public_projection_readonly_acl_20261114.sql`

- Les vues `marketplace_assureurs`, `marketplace_assurance_conventions` et `medicaments_cima_photos_public` restent consultables, mais leurs mutations directes sont retirées aux rôles API.
- Les droits directs `anon` sont retirés sur `suivi_professional_weekly_availability` et `suivi_professionals`.
- Les policies RLS existantes ne sont pas remplacées.

Deux tests SQL en lecture seule sont ajoutés dans `supabase/tests` pour vérifier ces garde-fous et les ACL après exécution des migrations.

## Écarts avec Replay à préserver

Les bases ne doivent pas être forcées à l'identique si cela détruit les règles métier NAXA :

- Les contraintes tarifaires Naxa imposent 1 500–3 500 FCFA, contrairement à la borne historique plus haute observée sur Replay.
- Les destinations de paiement Naxa conservent le canal `virement` en plus des canaux mobile money.
- Les policies de lecture des missions et événements sont plus restrictives sur Naxa pour interdire la visibilité prématurée avant préparation/paiement.
- La notification spécifique de l'équipe pharmacie est une extension Naxa.
- Les divergences de fonctions sont conservées lorsqu'elles portent un garde-fou de périmètre, préparation, paiement ou notification.

## Contrôles structurels et SQL vérifiés

- Les 28 tables du périmètre de réconciliation précédemment comparées sont présentes sur les deux projets. Le contrôle ciblé complémentaire de cette clôture confirme les mêmes 14 tables Livraison / Partenaire indépendant sur Replay et NAXA.
- Les 12 tables de Livraison identifiées par le préfixe `naxa_delivery_*` / `naxa_livreur_*` ont RLS activé sur les deux projets ; aucune de ces 12 tables ne présente RLS désactivé.
- Les 18 index ajoutés sont présents sur NAXA (`18/18`).
- `reservations.preparation_statut` est `NOT NULL` et aucune ligne n'a cette colonne à NULL.
- Les neuf fonctions métier relues conservent `SECURITY DEFINER` et `search_path = ''`.
- Le helper `naxa_delivery_make_available_before_preparation_gate(uuid)` est exécutable par `service_role` uniquement ; l'exécution par `anon` et `authenticated` est refusée.
- Les vues `marketplace_assureurs`, `marketplace_assurance_conventions` et `medicaments_cima_photos_public` autorisent SELECT aux rôles API, sans INSERT, UPDATE ni DELETE pour `anon`, `authenticated` ou `service_role`.
- Les droits directs `anon` sur `suivi_professional_weekly_availability` et `suivi_professionals` sont retirés.
- La contrainte active NAXA de frais de livraison est bien `1 500–3 500 FCFA`. Replay conserve la contrainte historique `1 500–20 000 FCFA NOT VALID` : cette divergence est intentionnelle et ne doit pas être copiée vers NAXA.
- Quatre réservations NAXA ont toujours `paiement_mode IS NULL` : le relevé SQL confirme `1` statut `annulée` et `3` statuts `expirée`. Aucune n'est une commande active ; aucune donnée n'a été corrigée artificiellement. Leurs transitions Livraison restent bloquées par les garde-fous.

## Tests et CI GitHub — preuve finale

Sur le commit applicatif `09d194b56b3c93624cff6ee83e4d2a581457d0bb`, le workflow GitHub Actions `43538536989` est terminé avec `conclusion=success`.

- Tests Node : `392/392` réussis, `0` échec, `0` ignoré.
- TypeScript : `npx tsc --noEmit` réussi.
- ESLint : `0` erreur et `225` avertissements ; le job ne présente aucun échec de lint.
- Build Next.js : compilation réussie et `150/150` pages statiques générées.
- Serwist : `public/sw.js` généré avec `216` URL pré-cachées, total `6,44 Mo`.
- Le script de contrat contrôle les deux migrations versionnées, les 18 index attendus, les points d'entrée du flux Livraison, les bornes tarifaires et les ACL de projection.

Le run est consultable ici : https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43538536989

## Hors périmètre de cette réconciliation

Les éléments ci-dessous restent non certifiés et ne sont pas déclarés réalisés : E2E terrain Client / Stock / Livreur / Caisse / Promoteur, paiement et capture SMS réels, répétition de restauration de sauvegarde, audit de toutes les ACL hors périmètre ciblé, protection de `main` et visibilité du dépôt. Ils restent nécessaires à une éventuelle certification globale du produit, mais ne constituent pas des écarts ouverts dans le périmètre SQL/structurel de ce rapport.

## État

**VERT — RÉCONCILIATION SUPABASE REPLAY / NAXA, PÉRIMÈTRE CIBLÉ.** Les migrations correctives sont versionnées et enregistrées sur NAXA ; les contrôles structurels, les ACL ciblées, les règles de sécurité Livraison, les écarts métier assumés et la CI sont vérifiés. Aucun déploiement n'a été effectué. Ce statut ne vaut pas déclaration de go-live global NAXA.