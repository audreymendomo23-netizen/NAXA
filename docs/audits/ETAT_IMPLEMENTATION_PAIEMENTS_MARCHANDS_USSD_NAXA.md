# NAXA — État d’implémentation des paiements marchands et USSD

Date : 13 novembre 2026  
Périmètre : premier lot de développement sur `main`.

## Implémenté dans ce lot

- Table dédiée `naxa_merchant_payment_destinations`, avec une configuration distincte par pharmacie/partenaire et par canal MTN/Orange.
- Code marchand strictement limité à six chiffres, nom du bénéficiaire et téléphone marchand contrôlés.
- Journal append-only `naxa_merchant_payment_destination_audit` pour les créations et mises à jour.
- RPC d’écriture réservé à `service_role`; aucune lecture directe des tables de configuration ou d’audit par `anon` ou `authenticated`.
- Écran Promoteur pour gérer les coordonnées des pharmacies du réseau actif.
- Écran Partenaire pour les propriétaires et gestionnaires de partenaires actifs.
- API de paiement Client limitée à la réservation du Client connecté, utilisant le canal choisi et la configuration active de la pharmacie concernée.
- Génération MTN : `*126*4*<code marchand 6 chiffres>*<montant FCFA>#`.
- Préparation Orange : `#150*47#`.
- Ouverture du composeur natif Android via URI `tel:`, sans permission `CALL_PHONE` et sans déclenchement automatique de l’appel.
- Affichage au Client du bénéficiaire, téléphone, code marchand et montant avant paiement.
- Test de cohérence source `scripts/test-merchant-payment-ussd.cjs`.

## Limites explicitement non clôturées

- La migration doit être appliquée et vérifiée sur Replay avant tout usage d’environnement partagé. Aucune migration Production n’est autorisée par ce lot.
- Le parcours USSD doit être validé sur des appareils Android physiques et des SIM MTN/Orange. L’ouverture du composeur ne prouve pas que l’opérateur accepte toutes les étapes.
- MTN est généré avec code marchand et montant préremplis. Orange utilise le point d’entrée `#150*47#`; le préremplissage du bénéficiaire et du montant n’est pas revendiqué.
- Les coordonnées partenaires sont enregistrées, mais le paiement de prestations partenaires n’a pas encore d’intention de paiement reliée à cette configuration.
- Le lecteur Android de notifications pour Pharmacie, Partenaire et Admin n’est pas implémenté dans ce lot.
- La séparation de la variante Android Client (aucun lecteur) et des variantes Pharmacie/Partenaire/Admin reste à réaliser et à tester.
- Les flux d’abonnement Pharmacie/Partenaire, le rapprochement notifications + SMS et les tests de confirmation des paiements restent ouverts.
- Le Client conserve exclusivement le partage volontaire de SMS ; l’origine réelle de l’expéditeur ne peut être considérée authentifiée que si une source Android fiable fournit cette métadonnée.

## Critère de statut

Statut : **PARTIEL — développement initial intégré au dépôt, non déclaré AU VERT**.

Aucun paiement ne doit être marqué confirmé sur la seule base de la génération USSD, de l’ouverture du composeur, d’une déclaration manuelle ou d’une notification non rapprochée.
