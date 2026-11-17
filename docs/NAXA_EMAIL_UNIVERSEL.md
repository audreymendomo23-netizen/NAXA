# NAXA — système universel de notifications e-mail

## Architecture livrée

Le système repose sur une outbox privée Supabase, un worker Next.js protégé par secret, et une passerelle Google Apps Script / Gmail. Les événements métier sont enregistrés dans Supabase avant tout envoi. Le worker réclame les messages avec verrouillage atomique, envoie, puis confirme ou programme une reprise. L'OTP Supabase et le Web Push restent séparés.

### Fichiers

- `supabase/migrations/20261117120000_naxa_universal_email_outbox.sql` — file universelle, idempotence, verrouillage, reprises et ACL service_role.
- `supabase/migrations/20261117143000_naxa_email_business_events.sql` — activation de compte, invitations Examens/Livreur, acceptation/révocation et rappels d'expiration J-1.
- `supabase/migrations/20261117151000_naxa_email_partner_lifecycle.sql` — décisions de dossiers partenaires, activation de convention Prestations à domicile et rappel J-5.
- `supabase/migrations/20261117160000_naxa_email_subscription_universe_fix.sql` et `20261117161000_naxa_email_prevent_duplicate_subscription_mail.sql` — correctifs de routage et suppression du double envoi potentiel.
- `src/app/api/cron/validite/route.ts` — distribution de l'outbox historique et de l'outbox universelle, synchronisations indépendantes et compteurs.
- `scripts/google-welcome-email.gs` — passerelle Gmail, contrôle du secret, clé d'idempotence, déclencheur périodique et arrêt d'urgence.
- `supabase/tests/263_naxa_universal_email_outbox_contract.sql` — contrat structurel et ACL.
- `supabase/tests/264_naxa_email_business_events_contract.sql` — raccordements métier et ACL.
- `supabase/tests/265_naxa_email_outbox_state_machine.sql` — idempotence, claim, reprise et confirmation d'envoi.
- `docs/NAXA_EMAIL_UNIVERSEL.md` — procédure et périmètre.

## Événements raccordés

| Domaine | Déclenchement | Traitement |
|---|---|---|
| Compte NAXA | Confirmation effective de l'adresse Auth | E-mail d'activation après confirmation ; aucun OTP envoyé par ce système |
| Pharmacie / Promoteur | Notifications historiques d'abonnement | Outbox historique maintenue et traitée par le même worker |
| Parapharmacie | Décision de dossier et notifications d'abonnement indépendant | E-mail de décision et événements de paiement/échéance déjà produits par le métier |
| Examens médicaux | Création, acceptation, révocation d'une invitation | Lien exact `/invitation/personnel-examen?token=...`; rappel J-1 |
| Prestations à domicile | Décision de dossier, activation de convention, échéance | E-mail de décision, activation et rappel J-5 fondé sur `expires_at` |
| Aide | Décision du dossier partenaire | E-mail de décision ; aucun abonnement ni cycle artificiel ajouté |
| Livreur | Création, acceptation, révocation d'une invitation | Lien exact `/invitation/livreur?token=...`; rappel J-1 |
| Client | Confirmation de l'adresse du compte | E-mail d'activation générique après confirmation Auth |

Les invitations gardent leurs jetons, règles d'acceptation, conditions d'identité et pages existantes. Les affectations directes Examens ne sont pas transformées artificiellement en invitations. Bébé & Maman reste hors périmètre conformément au verrouillage métier.

Les abonnements Parapharmacie, Examens et Prestations conservent leur indépendance. Leurs notifications de paiement et de rappel restent envoyées par l'outbox historique déjà raccordée à ces types : le système ne les duplique pas dans la nouvelle file universelle. Aide n'est pas assimilé à un abonnement mensuel. Les conventions Prestations sont rappelées selon leur propre date d'expiration. Les notifications métier existantes restent la source de vérité ; le canal e-mail leur est ajouté sans remplacer le Push ou le centre de notifications.

## Sécurité et fiabilité

- Table dans le schéma privé, RLS activée, aucun accès direct anon/authenticated/service_role à la table.
- Enqueue, claim, finish et jobs de rappel exécutables par le worker service_role uniquement.
- Clé événement unique ; claim concurrent via `FOR UPDATE SKIP LOCKED`.
- Verrous expirés récupérables après 15 minutes ; maximum cinq tentatives et backoff exponentiel.
- Les destinataires sans compte Auth sont acceptés pour les invitations.
- Le lien d'invitation n'est pas réémis sur un chemin générique : le token et la route du flux existant sont utilisés.
- Aucun secret n'est versionné. Le worker refuse une URL qui n'est pas une URL HTTPS Apps Script officielle.
- Le script Gmail utilise un verrou global et une clé anti-doublon ; les réponses sont dirigées vers `naxa.home@gmail.com`. Cette garantie est best-effort : une interruption exactement entre l'acceptation de l'envoi par Gmail et l'écriture de la propriété Apps Script ne peut pas être rendue strictement exactly-once par MailApp.
- Le worker transforme les URL HTTPS des contenus en liens HTML cliquables après échappement du texte. Les échecs d'accusé de réception Supabase sont comptés comme erreurs et propagés au déclencheur Apps Script.

## Configuration d'exploitation

Variables Vercel requises pour le worker :
- `CRON_SECRET`
- `GOOGLE_APPS_SCRIPT_URL` (URL Web App `/exec`)
- `GOOGLE_APPS_SCRIPT_SECRET`

Script Properties Apps Script :
- `NAXA_WELCOME_SECRET` — même valeur que `GOOGLE_APPS_SCRIPT_SECRET`.
- `NAXA_WELCOME_FROM_NAME` — facultatif, recommandé : `NAXA`.
- `NAXA_WORKER_URL` — `https://nnaxa.vercel.app/api/cron/validite`.
- `NAXA_CRON_SECRET` — même valeur que `CRON_SECRET`.
- `NAXA_VERCEL_BYPASS_SECRET` — secret Vercel Protection Bypass distinct.

Après configuration, publier une nouvelle version Web App Apps Script, puis exécuter une fois `installNaxaNotificationTrigger`. Le déclencheur appelle le worker toutes les cinq minutes. `removeNaxaNotificationTrigger` permet l'arrêt d'urgence.

## Vérifications exécutées sur Replay

Projet : `pwfftcsjyeibxxqhwysw`.

- Migration outbox universelle : appliquée avec succès.
- Migration événements comptes/invitations : appliquée avec succès.
- Migration événements partenaires/conventions : appliquée avec succès.
- Test SQL 263 : `263 universal email outbox contract PASS`.
- Test SQL 264 : `264 business email events contract PASS` (inclut la vérification anti-double-envoi des abonnements).
- Test SQL 265 : `265 email outbox state machine PASS`.
- Test transactionnel réel du déclencheur Livreur : création d'une invitation de contrôle → événement outbox avec le bon lien `/invitation/livreur?token=...` ; PASS ; transaction annulée ensuite.
- Test transactionnel réel d'une notification de rappel d'abonnement : insertion d'une notification métier → événement outbox ciblant le titulaire ; PASS ; transaction annulée ensuite.
- RPC de rappel invitations et conventions : exécutées sur Replay, retour 0 sans erreur (aucune échéance à rappeler au moment du test).
- Test transactionnel de l'outbox : même clé → même identifiant ; claim ; échec simulé → retour à pending ; aucune livraison Gmail ; transaction annulée.

## État de certification

**Code métier et base Replay : tests structurels PASS, test réel du déclencheur Livreur PASS.**

Le système n'est pas encore certifié vert en exploitation : le script Apps Script n'a pas été publié, les Script Properties et variables Vercel ne sont pas vérifiées ici, le déclencheur périodique n'a pas été installé et aucun e-mail réel n'a été envoyé/réceptionné. Le worker Next.js n'a pas encore de preuve de build/deploiement associée à cette livraison. Ces points exigent l'accès et l'autorisation de publication/configuration ; les déclarer verts sans eux serait une fausse preuve.

Aucune migration n'a été appliquée à Production et aucun déploiement Vercel Production n'a été effectué.
