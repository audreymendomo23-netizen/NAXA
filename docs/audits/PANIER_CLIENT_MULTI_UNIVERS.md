# Panier Client multi-univers — correction propriétaire Pharmacie

Date : 17 novembre 2026

## Décision implémentée

Le Client conserve un seul accès panier. Les lignes et les finalisations restent toutefois isolées par univers et par établissement propriétaire. Pour le circuit Pharmacie, chaque établissement possède son propre sous-panier et sa propre finalisation.

## Changements appliqués

- `src/lib/panier.tsx` : la clé de fusion d'une ligne tient compte du produit, de l'univers métier et du propriétaire. Les opérations de quantité et de retrait acceptent le propriétaire et reconnaissent les anciennes lignes qui ne renseignaient que `pharmacie_id` ou `partner_id`.
- `src/app/panier/page.tsx` : les articles Pharmacie sont regroupés par pharmacie propriétaire. Chaque groupe possède son accès « Finaliser avec cette pharmacie ». Les articles sans propriétaire confirmé ne sont pas envoyés à une pharmacie arbitraire. Les lignes d'autres propriétaires restent séparées.
- `src/app/commande/nouvelle/page.tsx` : le paramètre `pharmacie` sélectionne un seul sous-panier. La page ne transmet à `creer_transactions_client` que les lignes rattachées à cette pharmacie et vérifie à nouveau le propriétaire avant l'appel RPC. Après succès, seules ces lignes sont retirées.
- `src/app/commande/bebe-maman/page.tsx` : le retrait après réservation cible le propriétaire de chaque ligne, pour ne pas effacer une ligne homonyme d'un autre établissement.

## Garanties préservées

- La RPC `creer_transactions_client` reste le moteur serveur de création des transactions Pharmacie.
- Les prix, disponibilités, modes réservation/commande, devis de livraison, paiement direct au professionnel et contrôles serveur existants ne sont pas remplacés par un mécanisme de panier global.
- Les protections SQL de stock physique, de publication par univers et de traçabilité d'origine ne sont pas modifiées.
- Aucun paiement n'est centralisé par NAXA.
- Les chartes graphiques définies dans `src/lib/ecosystemes.ts` ne sont pas modifiées.

## Vérifications

Modifications poussées directement sur `main`. Les fichiers ont été relus après écriture via GitHub. Aucun test TypeScript, ESLint, test automatisé, build ou parcours E2E n'a été exécuté dans cet environnement pendant cette intervention.

## Limites restantes

- Les lignes Pharmacie sans identifiant propriétaire confirmé restent bloquées à la finalisation jusqu'à leur rattachement par le parcours de recherche/sélection de pharmacie.
- La limite de 10 lignes reste une limite du panier local global ; le périmètre historique de cette limite doit être clarifié avant de la modifier.
- La preuve E2E doit couvrir deux pharmacies avec le même produit, des propriétaires différents, les retraits/quantités indépendants, et la création séparée de transactions.
