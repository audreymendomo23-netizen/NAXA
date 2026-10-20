# Guide Caisse NAXA

## Accès et ouverture
1. Connectez-vous avec un compte Caisse actif, rattaché à une pharmacie active et publiée.
2. Sélectionnez le poste de caisse si plusieurs sont configurés.
3. Si aucune session n'est ouverte, saisissez explicitement le fond initial réel en FCFA puis ouvrez la session. La page ne crée plus de session ni de vente automatiquement au chargement. Si la vérification de session échoue, l’ouverture est bloquée jusqu’à une nouvelle vérification. Une session ouverte appartient au compte qui l'a ouverte ; un autre compte ne peut pas la reprendre ni la clôturer.

## Vente
1. Cliquez sur **Nouvelle vente**.
2. Scannez les codes-barres ou recherchez le produit par nom/référence. La base contrôle le stock disponible et débite le stock au moment de l'ajout au panier. Après chaque ajout, les quantités et les prix affichés sont relus depuis la base, pas estimés côté navigateur.
3. Un panier brouillon est repris après rechargement. N'ouvrez pas un deuxième panier pour contourner un panier existant.
4. Si un produit a été ajouté par erreur, utilisez **Retirer** sur sa ligne : la base restitue les quantités au stock agrégé et aux lots d'origine, puis recalcule le total dans la même transaction.
5. Pour abandonner un panier, utilisez **Abandonner le panier et restituer le stock**. La RPC verrouille la vente, restitue le stock agrégé et les lots d'origine puis marque le brouillon annulé dans la même transaction.
6. Encaissez en espèces : saisissez le montant reçu, vérifiez la monnaie à rendre et validez. Le paiement et le passage de la vente à « payée » sont atomiques en base. Les anciennes RPC de paiement espèces partiel/non finalisé sont bloquées pour éviter un paiement orphelin.
7. Si une requête échoue ou que la connexion coupe, attendez la relecture du panier depuis la base et vérifiez l'historique avant de retenter l'encaissement.

## Paiements électroniques
Orange Money, MTN MoMo et l'ancien mode Mobile Money ne doivent pas être déclarés payés sur la seule base d'une référence saisie. Ces modes sont bloqués côté base tant qu'une intégration marchande officielle ne permet pas de confirmer la transaction. Aucun paiement électronique n'est simulé.

## Retraits Marketplace
- La Caisse affiche les réservations Pharmacie en attente, confirmées ou déjà payées, limitées à la pharmacie du compte connecté.
- Le bouton « Confirmer le retrait » n'est disponible que si la réservation est déjà au statut « payée » et que son paiement est marqué « effectué ». La transition est vérifiée par la RPC et la réservation ne peut pas être retirée deux fois.
- Une réservation confirmée, non expirée et dont le mode est « espèces au retrait » ou « à convenir » peut être encaissée en espèces depuis la Caisse. L'opération crée un ticket POS unique lié à la réservation, enregistre le paiement dans la session active, marque la réservation payée dans la même transaction et calcule la monnaie à rendre. Un montant insuffisant, une session hors périmètre, un paiement déjà effectué ou une seconde tentative sont refusés. Le stock n'est pas débité une seconde fois : il a déjà été réservé par le parcours Marketplace. Les modes Mobile Money restent bloqués tant qu'une confirmation opérateur officielle n'est pas intégrée.

## Tickets, historique et clôture
- Le ticket est construit à partir de la RPC vente_ticket, affiche le numéro de vente, les lignes, les montants, le mode de paiement, le montant reçu et la monnaie rendue lorsque ces données sont disponibles, puis peut être imprimé.
- L'historique affiche les 20 dernières ventes payées créées par le compte connecté ; chaque ticket peut être réimprimé.
- Avant la clôture, finalisez ou abandonnez tout panier brouillon.
- Comptez les espèces présentes dans le tiroir, fond initial compris, puis utilisez **Clôturer et rapprocher**. Le résultat indique le total théorique, le total compté et l'écart.
- Les lots et dates de péremption restent gérés par le moteur de stock ; la Caisse ne contourne pas les contrôles de disponibilité.

## État de validation
La page, les migrations additives 157–158 et les tests structurels correspondants sont enregistrés sur main. Les révisions de test des migrations 157 et 158 et les tests structurels correspondants ont été exécutés sur le projet Supabase de test « naxa-ci-replay-2 » ; la migration n'est pas appliquée à Supabase Production. Les tests POS 044, 054, 055, 056, 057, 058, 059 et 060 ont aussi été exécutés sans erreur. Le projet de test ne contient pas les migrations 133–156, donc cette validation SQL reste partielle. Build TypeScript, lint et E2E non confirmés. Aucun déploiement Vercel n'est autorisé dans le chantier en cours.
