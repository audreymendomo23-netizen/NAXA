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

## Paiements et réservations Marketplace (retrait en pharmacie)

**Règle métier : NAXA connecte, la pharmacie reçoit l'argent. NAXA n'encaisse pas, ne détient pas les fonds et n'appelle aucune API de paiement client.** Les API Mobile Money d'abonnement pharmacie sont un flux séparé et ne font pas partie du paiement Marketplace client.

- À la création d'une réservation, la base génère un code de paiement unique. La page de suivi client affiche le code, le délai restant et un QR généré localement dans le navigateur. Le QR contient la référence NAXA uniquement : il ne lance aucun paiement. La lecture par caméra dépend du support BarcodeDetector du navigateur ; un lecteur QR clavier ou la saisie manuelle restent les solutions de repli.
- À l'arrivée du client, la pharmacienne scanne le QR avec un lecteur qui saisit son contenu dans le champ code, ou saisit le code manuellement. La recherche est limitée à la pharmacie active de la session.
- La caisse refuse une réservation expirée, non confirmée par la pharmacie, déjà payée, annulée ou liée à une vente POS existante. Le code est revérifié en base dans la transaction SQL.
- La pharmacienne sélectionne le canal déclaré par le client. Pour les espèces, elle saisit le montant réellement reçu et NAXA calcule la monnaie. Pour un canal non espèces, elle saisit le montant exact et ne confirme qu'après avoir constaté la réception effective des fonds par la pharmacie. Aucune référence saisie ne vaut preuve opérateur, et aucune requête de paiement n'est envoyée par NAXA.
- La validation crée un ticket POS unique lié à la réservation, enregistre le canal choisi, passe la vente et la réservation à « payée » dans la même transaction, et conserve la référence Marketplace dans les écritures. Les événements de réservation existants gardent l'historique de transition.
- Le reçu présente la transaction, le code de paiement, le numéro de ticket, la date/heure, les lignes, le total, le canal, le montant reçu et la monnaie à rendre. Il peut être imprimé. Le bouton de remise des produits n'apparaît qu'après validation du paiement.
- Le stock n'est pas débité une seconde fois : la réservation a déjà réservé les quantités.
- Le paiement en ligne côté client, les API opérateur, la collecte des fonds par NAXA et le parcours de livraison sont hors de ce flux. Les commandes « commande » ne doivent pas être requalifiées silencieusement en retrait.
## Décaissements de caisse
- Le volet **Décaissements de caisse** est distinct du retrait des produits Marketplace. Il enregistre une sortie d’espèces avec montant positif, catégorie, motif obligatoire et référence de justificatif facultative.
- Chaque décaissement est lié à la session active, à la pharmacie et au compte qui l’a enregistré. La base refuse les montants nuls/négatifs, les motifs trop courts, les sessions clôturées et les sessions ouvertes par un autre compte.
- Les mouvements sont en lecture seule après enregistrement, consignés dans la chaîne d’audit SHA-256 et visibles dans l’historique de la session.
- La clôture calcule désormais le solde théorique comme : fond initial + encaissements espèces − décaissements. Un solde théorique négatif bloque la clôture.
- Le PIN et la biométrie protègent le décaissement de caisse, qui est distinct du règlement Marketplace au retrait.

## Décaissements, PIN et biométrie
- Le Promoteur actif configure un PIN de 6 à 8 chiffres pour chaque compte Caisse de son équipe depuis son tableau de bord. Le PIN est dérivé avec scrypt et n’est jamais stocké en clair. Après cinq échecs, le PIN est bloqué pendant 15 minutes.
- La caissière peut aussi enregistrer une authentification biométrique WebAuthn depuis sa propre session et son propre appareil. Le système ne reçoit ni ne stocke l’image de l’empreinte : le capteur local valide l’utilisateur et le serveur vérifie cryptographiquement l’assertion. Un Promoteur ne peut pas enrôler à distance l’empreinte d’une autre personne.
- Chaque décaissement exige un PIN vérifié ou une assertion biométrique fraîche. L’API émet une autorisation temporaire de 90 secondes, liée à l’utilisateur et à la session, consommée une seule fois par la transaction SQL. L’ancienne RPC sans autorisation est neutralisée.
- L’enregistrement reste lié au titulaire de la session ouverte, au montant, au motif, à la catégorie et au justificatif facultatif. Les migrations 167 et 170 ajoutent les secrets protégés, les défis WebAuthn, les autorisations à usage unique et le verrouillage du PIN.
- Les bibliothèques WebAuthn (@simplewebauthn/server et @simplewebauthn/browser) sont déclarées dans package.json. L’origine de vérification WebAuthn est liée à NEXT_PUBLIC_APP_URL lorsqu’elle est configurée. La compilation et l’enrôlement réel restent à vérifier sur un navigateur/appareil compatible avec une origine HTTPS correctement configurée.

## Écart de caisse
- À la clôture, NAXA calcule le théorique : fond initial + encaissements espèces confirmés − décaissements enregistrés. Les paiements électroniques non confirmés ne sont pas assimilés à des espèces.
- La caissière saisit le comptage réel. L’écart est compté moins théorique : négatif = manquant, positif = excédent, zéro = caisse équilibrée.
- Si l’écart n’est pas nul, une justification de 5 à 500 caractères est obligatoire avant la clôture. Sans justification, la session reste ouverte. La valeur, le motif et le statut a_verifier sont conservés dans la session auditée ; aucun écart initial n’est effacé. Le tableau de bord Promoteur affiche les 20 derniers écarts du réseau actif en lecture seule.
- La garde SQL de clôture vérifie également le calcul en intégrant les décaissements. Un ajustement comptable ultérieur devra être une opération séparée, autorisée et auditée ; il ne faut pas convertir automatiquement un écart en décaissement.
- PIN, biométrie et écarts sont ajoutés au projet de test uniquement ; Supabase Production n’a pas été modifié.
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
Les migrations additives 157–171 et les composants du parcours caisse sont enregistrés sur `main`. La migration 171 a été appliquée uniquement au projet Supabase de test « naxa-ci-replay-2 » ; aucune migration n'a été appliquée à Supabase Production.

Les tests SQL 044, 055, 159, 160, 163, 164, 166, 167 et 168 ont renvoyé PASS sur le projet de test. Le test 161 a été adapté puis exécuté avec succès après la migration 171 ; il couvre le code erroné, l’encaissement espèces, un canal non espèces saisi manuellement, l’anti-double encaissement et l’absence de double débit du stock. Le test 164 a été rejoué après correction du périmètre de pharmacie de sa fixture. Le test 166 vérifie qu’un autre compte Caisse ne peut pas clôturer la session d’un collègue et que le titulaire peut clôturer sa propre session. Le test 164 couvre le motif et le montant, la trace d’audit, le rejet des montants/motifs invalides, la prise en compte du décaissement dans le solde de clôture et le rejet après clôture. Les tests 157 et 158 se sont exécutés sans erreur SQL. Le test 161 vérifie notamment le montant insuffisant, l'encaissement atomique, le ticket POS lié, le paiement de la réservation, le rejet d'un deuxième encaissement et l'absence de second débit du stock.

Le projet de test ne contient pas les migrations 133–156 ; la validation SQL reste donc partielle par rapport à l'ensemble du schéma de Production. Build TypeScript, lint et tests E2E non confirmés. Aucun déploiement Vercel n'est autorisé dans le chantier en cours. La compilation TypeScript, lint, tests E2E, QR sur appareils réels et authentification WebAuthn réelle restent à vérifier. Aucun déploiement Vercel n'est autorisé dans le chantier en cours.
