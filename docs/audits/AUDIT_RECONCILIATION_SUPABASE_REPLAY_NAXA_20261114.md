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

## Contrôles structurels

- Les 28 tables du périmètre ciblé sont présentes sur les deux projets.
- RLS est activé sur les tables ciblées.
- Les 18 index ajoutés sont présents sur Naxa.
- `preparation_statut` est non nullable.
- Les fonctions sensibles relues conservent `SECURITY DEFINER` avec `search_path = ''`.
- Les vues de projection sont lisibles en lecture seule par les rôles API.
- Quatre réservations existantes sur Naxa ont toujours `paiement_mode IS NULL`. Elles n'ont pas été réécrites automatiquement ; les nouveaux garde-fous les empêchent de franchir les étapes Livraison concernées.

Ces contrôles structurels ne certifient pas tous les catalogues PostgreSQL ni les parcours fonctionnels de bout en bout.

## Tests et CI GitHub

Sur le HEAD `8b0f694…`, le run qualité observé comptait 358 réussites et 3 échecs :

1. test catalogue attaché à l'ancien fichier supprimé `src/lib/medicaments/photos-externes.ts), alors que l'endpoint actuel ne renvoie que les photos du catalogue local vérifiées ;
2. test USSD pointant vers l'ancien nom de migration, alors que le fichier source présent est `20261113163408_merchant_payment_destinations.sql` ;
3. test Android qui interdisait `RECEIVE_SMS` au manifeste Professionnel, contrairement à la règle validée : Standard Client/Promoteur sans capture ; Professionnel Pharmacie/Partenaire et Admin avec capture après consentement et permission Android.

Les trois assertions ont été réalignées. Un test Node contrôle également les deux migrations SQL versionnées. Le run GitHub Actions déclenché par le commit de correction doit encore fournir la preuve : aucun PASS CI n'est revendiqué avant lecture de son résultat.

## Réserves

- E2E réels Client / Stock / Livreur / Caisse / Promoteur non réalisés.
- Aucun paiement réel ni capture SMS réelle généré pendant cette passe.
- Les quatre réservations à mode de paiement nul restent à traiter opérationnellement.
- Restauration de sauvegarde non testée.
- Les ACL hors périmètre ciblé ne sont pas certifiées globalement.
- La protection de `main` et la visibilité du dépôt restent des sujets de gouvernance séparés.

## État

**EN COURS — PAS ENCORE VERT.** Les deux migrations correctives sont versionnées, les trois tests défaillants sont réalignés et les tests SQL de contrôle sont ajoutés. La CI après correction et les tests fonctionnels E2E restent nécessaires.
