# Guide Caisse NAXA

## Accès et ouverture
1. Connectez-vous avec un compte Caisse actif, rattaché à une pharmacie active et publiée.
2. Sélectionnez le poste de caisse si plusieurs sont configurés.
3. Si aucune session n'est ouverte, saisissez explicitement le fond initial réel en FCFA puis ouvrez la session. La page ne crée plus de session ni de vente automatiquement au chargement. Une session ouverte appartient au compte qui l'a ouverte ; un autre compte ne peut pas la reprendre ni la clôturer.

## Vente
1. Cliquez sur **Nouvelle vente**.
2. Scannez les codes-barres ou recherchez le produit par nom/référence. La base contrôle le stock disponible et débite le stock au moment de l'ajout au panier.
3. Un panier brouillon est repris après rechargement. N'ouvrez pas un deuxième panier pour contourner un panier existant.
4. Pour abandonner un panier, utilisez **Abandonner le panier et restituer le stock**. La RPC verrouille la vente, restitue le stock agrégé et les lots d'origine puis marque le brouillon annulé dans la même transaction.
5. Encaissez en espèces : saisissez le montant reçu, vérifiez la monnaie à rendre et validez. Le paiement et le passage de la vente à « payée » sont atomiques en base.

## Paiements électroniques
Orange Money, MTN MoMo et l'ancien mode Mobile Money ne doivent pas être déclarés payés sur la seule base d'une référence saisie. Ces modes sont bloqués côté base tant qu'une intégration marchande officielle ne permet pas de confirmer la transaction. Aucun paiement électronique n'est simulé.

## Tickets, historique et clôture
- Le ticket est construit à partir de la RPC vente_ticket, affiche le numéro de vente, les lignes, les montants et le total, puis peut être imprimé.
- L'historique affiche les 20 dernières ventes payées créées par le compte connecté ; chaque ticket peut être réimprimé.
- Avant la clôture, finalisez ou abandonnez tout panier brouillon.
- Comptez les espèces présentes dans le tiroir, fond initial compris, puis utilisez **Clôturer et rapprocher**. Le résultat indique le total théorique, le total compté et l'écart.
- Les lots et dates de péremption restent gérés par le moteur de stock ; la Caisse ne contourne pas les contrôles de disponibilité.

## État de validation
La page, la migration additive 157 et le test structurel 157 sont enregistrés sur main. La migration 157 n'est pas appliquée à Supabase Production ; compilation, tests SQL et parcours E2E de cette révision restent à exécuter dans un environnement de test. Aucun déploiement Vercel n'est autorisé dans le chantier en cours.
