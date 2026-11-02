# NAXA — Audit du ticket de caisse et du cycle de réservation

Date : 2026-10-24  
Périmètre : sources de `main` consultées, sans exécution contre Supabase Production.

## Décision provisoire

**ROUGE / non validé de bout en bout.** Les sources montrent des garde-fous côté interface et un endpoint d'ordonnancement, mais elles ne prouvent pas à elles seules que le ticket imprimé est conservé durablement, que les fonctions SQL sont atomiques/idempotentes, ni que le cycle complet s'exécute en environnement réel.

## Preuves observées dans le code

- `src/components/pharmacie/CaisseRetraitsMarketplace.tsx` appelle `vente_reservation_encaisser` pour le règlement au comptoir et `set_reservation_status` pour confirmer le retrait après paiement. Le reçu visible immédiatement après encaissement est construit dans l'état React local (`setReceipt`) ; il contient le numéro de vente retourné, mais l'interface ne relit pas ensuite le ticket serveur. L'état local peut donc disparaître au rechargement.
- Le ticket POS classique utilise `sb.rpc("vente_ticket", { p_vente: venteId })` dans `src/app/pharmacie/caisse/page.tsx`. Le chemin de l'historique client, lui, lit `client_achats` et reconstruit un document à partir des lignes d'achat ; ces lignes ne contiennent pas d'identifiant de vente/ticket dans les champs actuellement sélectionnés.
- `src/app/client/historique/page.tsx` ne possède pas de liaison vérifiée entre `reservation_id` et l'identifiant accepté par `vente_ticket(p_vente)`. Passer l'identifiant de réservation à cette RPC sans preuve de correspondance serait incorrect. L'interface a donc été renommée pour appeler le document existant un **récapitulatif numérique**, et non un duplicata du ticket de caisse.
- `src/app/api/cron/reservation-expiry/route.ts` appelle successivement `expirer_reservations_cron(p_limit := 500)` puis `notifier_reservations_expirant_30m()`, et renvoie une erreur 500 si l'une des RPC échoue.
- `supabase/migration_209_reservation_expiry_scheduler.sql` planifie, si `pg_cron` est disponible, uniquement `expirer_reservations_cron(p_limit := 500)` toutes les cinq minutes. Elle ne planifie pas `notifier_reservations_expirant_30m()`. Si l'ordonnanceur configuré est seulement ce job pg_cron, la génération des rappels de 30 minutes n'est pas démontrée et doit être planifiée séparément ou incluse dans une routine orchestratrice.
- L'historique client lit les réservations, `client_achats` et `reservation_events`. Le fait que l'interface les interroge ne prouve pas qu'une écriture d'achat et un événement d'historique sont enregistrés atomiquement au paiement/retrait.

## Points critiques encore sans preuve suffisante

1. **Ticket de caisse durable** — identifier la relation SQL exacte entre réservation Marketplace, vente POS et résultat de `vente_ticket`; conserver côté serveur le numéro de vente et les éléments du ticket; appliquer les règles RLS pour que le client ne consulte que son propre ticket. Ne pas fabriquer un ticket en recomposant les achats.
2. **Expiration serveur** — lire la définition effective de `expirer_reservations_cron` et prouver le verrouillage/concurrence, le filtre de date, la transition d'état et l'idempotence.
3. **Restitution du stock** — prouver que chaque unité réservée est restituée exactement une fois, sans restituer le stock d'une réservation déjà payée/retirée, et que la transition et le mouvement de stock sont transactionnels.
4. **Notification unique** — vérifier la contrainte d'unicité et le mécanisme anti-doublon de `notifier_reservations_expirant_30m`; prouver que les appels répétés et concurrents ne créent pas plusieurs rappels.
5. **Ordonnancement réel** — vérifier dans l'environnement cible que pg_cron est installé et que le job est actif, ou qu'un ordonnanceur externe appelle la route avec `CRON_SECRET`. Le code source ne prouve pas la configuration active.
6. **Paiement à la caisse** — inspecter la définition effective de `vente_reservation_encaisser` pour garantir une seule vente/ticket, une seule écriture de paiement, la validation de session et de pharmacie, l'absence de double paiement et l'absence de double décrément de stock.
7. **Retrait** — vérifier que `set_reservation_status` refuse les statuts autres que payée, vérifie la pharmacie/session et journalise la transition sans répétition.
8. **Historique client** — vérifier les politiques RLS, les événements créés aux transitions, les dates et références exactes, ainsi que la visibilité après rechargement sur une nouvelle session client.

## Tests nécessaires avant de déclarer le parcours vert

- Rejouer les tests SQL sur une base de test propre et ajouter des scénarios comportementaux pour expiration, concurrence, stock avant/après, notification unique, paiement répété, retrait avant/après paiement et accès inter-clients au ticket.
- Tester une réservation avec expiration dépassée, appeler l'expiration deux fois et confirmer que le stock ne bouge qu'une fois.
- Appeler le générateur de rappel plusieurs fois et confirmer qu'une seule notification de 30 minutes existe pour la réservation et le destinataire.
- Payer une réservation en caisse, recharger la caisse, puis ouvrir l'historique avec le compte client et télécharger le même ticket serveur : numéro, lignes, quantités, prix, total, canal, montant reçu, monnaie rendue et horodatages doivent correspondre au ticket conservé.
- Confirmer le retrait seulement après paiement, le répéter pour vérifier le rejet idempotent, puis vérifier l'historique et le stock.
- Tester les permissions avec deux clients et deux pharmacies distincts.

## Limites de cette passe

Aucun build, lint, test TypeScript, replay SQL, test navigateur, ni appel à Supabase n'a été exécuté. Aucune migration n'a été appliquée à Supabase Production et aucun déploiement n'a été lancé. La prochaine correction SQL doit être fondée sur les définitions complètes et effectives des RPC et leurs tests existants; elles ne doivent pas être remplacées à l'aveugle.


---

## Mise à jour des décisions métier — 02/11/2026

Le fondateur a tranché les points suivants (référence : docs/DECISIONS_METIER_FONDATEUR.md) :

1. Le cycle doit comporter deux états persistés et journalisés : « En préparation », puis « Prête au retrait ». Le statut UI ne suffit pas ; chaque transition doit être protégée côté serveur.
2. Lors d'une suspension complète de pharmacie, toutes les réservations non retirées sont annulées, le stock réservé est libéré/restauré selon le mécanisme approprié et les Clients sont informés.
3. La sanction Marketplace SM-01 est distincte : elle bloque le Promoteur et ses pharmacies sur la Marketplace, en préservant les opérations ERP internes encore autorisées.

**Questions de séquencement restant à préciser avant le changement de machine d'état :**
- Le parcours POS actuel lie le statut « payée » à l'encaissement en caisse et « retirée » au retrait physique confirmé. Le fondateur a validé « En préparation » puis « Prête au retrait », mais n'a pas encore indiqué si l'encaissement intervient avant ou après « Prête au retrait ». Ne pas réordonner les transitions POS à l'aveugle.
- La règle de suspension annule toutes les réservations non retirées, ce qui peut inclure une réservation déjà payée. Le paiement des médicaments étant directement reçu par la pharmacie et non par NAXA, la procédure de remboursement/avoir reste à préciser ; NAXA ne doit pas prétendre rembourser un paiement qu'il n'a pas encaissé.
- Le crédit Marketplace décrémente physiquement le stock à sa validation. La règle de restauration si ce crédit validé est ensuite annulé ou non retiré reste à préciser.

Les corrections indépendantes de ticket durable, idempotence, sécurité de transition et historique doivent continuer sans attendre ces précisions.
