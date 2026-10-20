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

## Réservations Marketplace (retrait des produits par le client)
- La Caisse affiche les réservations Pharmacie en attente, confirmées ou déjà payées, limitées à la pharmacie du compte connecté.
- Le bouton « Confirmer le retrait » n'est disponible que si la réservation est déjà au statut « payée » et que son paiement est marqué « effectué ». La transition est vérifiée par la RPC et la réservation ne peut pas être retirée deux fois.
- Une réservation confirmée, non expirée et dont le mode est « espèces au retrait » ou « à convenir » peut être encaissée en espèces depuis la Caisse. L'opération crée un ticket POS unique lié à la réservation, enregistre le paiement dans la session active, marque la réservation payée dans la même transaction et calcule la monnaie à rendre. Un montant insuffisant, une session hors périmètre, un paiement déjà effectué ou une seconde tentative sont refusés. Le stock n'est pas débité une seconde fois : il a déjà été réservé par le parcours Marketplace. Les modes Mobile Money restent bloqués tant qu'une confirmation opérateur officielle n'est pas intégrée.

## Décaissements de caisse
- Le volet **Décaissements de caisse** est distinct du retrait des produits Marketplace. Il enregistre une sortie d’espèces avec montant positif, catégorie, motif obligatoire et référence de justificatif facultative.
- Chaque décaissement est lié à la session active, à la pharmacie et au compte qui l’a enregistré. La base refuse les montants nuls/négatifs, les motifs trop courts, les sessions clôturées et les sessions ouvertes par un autre compte.
- Les mouvements sont en lecture seule après enregistrement, consignés dans la chaîne d’audit SHA-256 et visibles dans l’historique de la session.
- La clôture calcule désormais le solde théorique comme : fond initial + encaissements espèces − décaissements. Un solde théorique négatif bloque la clôture.
- Le PIN et la biométrie ne sont pas implémentés ici : ils sont réservés au chantier Promoteur, comme convenu. Pour le moment, le décaissement est réservé à un compte Caisse actif titulaire de la session (ou à l’administration selon les gardes serveur).

## Tickets, historique et clôture
- Le ticket est construit à partir de la RPC vente_ticket, affiche le numéro de vente, les lignes, les montants, le mode de paiement, le montant reçu et la monnaie rendue lorsque ces données sont disponibles, puis peut être imprimé.
- L'historique affiche les 20 dernières ventes payées créées par le compte connecté ; chaque ticket peut être réimprimé.
- Avant la clôture, finalisez ou abandonnez tout panier brouillon.
- Comptez les espèces présentes dans le tiroir, fond initial compris, puis utilisez **Clôturer et rapprocher**. Le résultat indique le total théorique, le total compté et l'écart.
- Les lots et dates de péremption restent gérés par le moteur de stock ; la Caisse ne contourne pas les contrôles de disponibilité.

## Sécurité du paiement Marketplace
- Le statut « payé » ne peut plus être activé par une simple transition RPC : il exige un ticket POS finalisé, un paiement lié et un total identique à celui de la réservation.
- Le suivi Pharmacie des commandes ne propose plus de bouton manuel « Confirmer paiement effectué » ; il affiche un avertissement et la RPC refuse la confirmation sans preuve POS liée.
- **Limite restante :** le flux de commande (`mode=commande`) n’est pas encore encaissé depuis la Caisse. Jusqu’à l’intégration complète de ce flux POS, il est volontairement impossible de confirmer son paiement par ce suivi. Ne pas contourner cette protection en modifiant directement le statut en base.

## État de validation
Les migrations additives 157–163 et les composants du parcours caisse sont enregistrés sur `main`. Les migrations 159–161 ont été appliquées uniquement au projet Supabase de test « naxa-ci-replay-2 » ; aucune migration n'a été appliquée à Supabase Production.

Les tests SQL 044, 055, 159, 160, 161, 163 et 164 ont renvoyé PASS sur le projet de test. Le test 164 couvre le motif et le montant, la trace d’audit, le rejet des montants/motifs invalides, la prise en compte du décaissement dans le solde de clôture et le rejet après clôture. Les tests 157 et 158 se sont exécutés sans erreur SQL. Le test 161 vérifie notamment le montant insuffisant, l'encaissement atomique, le ticket POS lié, le paiement de la réservation, le rejet d'un deuxième encaissement et l'absence de second débit du stock.

Le projet de test ne contient pas les migrations 133–156 ; la validation SQL reste donc partielle par rapport à l'ensemble du schéma de Production. Build TypeScript, lint et tests E2E non confirmés. Aucun déploiement Vercel n'est autorisé dans le chantier en cours. Le PIN et la biométrie de validation d’un décaissement restent à traiter lors du chantier Promoteur.
