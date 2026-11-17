# NAXA — passerelle e-mail commune

## État de cette livraison

Cette première tranche ajoute une outbox e-mail générique et son traitement côté worker, tout en conservant l'outbox historique Promoteur/Admin. Elle ne raccorde pas encore automatiquement chaque parcours d'invitation ni chaque source d'échéance : ces raccordements exigent des événements métier explicites et des liens d'acceptation propres à chaque univers.

Aucun secret n'est versionné. Cette livraison ne déploie ni migration Supabase, ni Web App Google, ni Vercel.

## Contrat de l'outbox universelle

Migration : `supabase/migrations/20261117120000_naxa_universal_email_outbox.sql`.

Table privée : `private.email_delivery_outbox`.

RPC réservé à `service_role` :

- `enqueue_naxa_email_event(...)` : crée un événement avec clé idempotente, univers, type, adresse destinataire et contenu texte. L'adresse n'a pas besoin d'exister dans `auth.users`.
- `claim_naxa_email_events(p_limit)` : réclame atomiquement les événements en attente ou les verrous expirés.
- `finish_naxa_email_event(...)` : confirme l'envoi ou programme une reprise exponentielle; après cinq tentatives, l'événement passe en `dead`.

La clé `event_key` rend la création idempotente. Une répétition de la même clé retourne le même identifiant sans créer un second envoi.

## Compatibilité

- L'ancienne table `private.notification_email_outbox` et ses RPC restent inchangées.
- Le worker `/api/cron/validite` vide les deux files.
- Les synchronisations de validité sont traitées indépendamment de la distribution : une erreur de synchronisation est rapportée mais ne bloque pas les messages déjà en file.
- Le Web Push et l'OTP Supabase restent séparés.
- Le script Google Apps Script conserve le contrat `{sent, alreadySent}` et accepte les clés `naxa-email-event-<uuid>`.

## Exemple d'enqueue serveur

Appeler exclusivement depuis un contexte serveur disposant du client Supabase admin :

```ts
const { data: outboxId, error } = await supabaseAdmin.rpc(
  "enqueue_naxa_email_event",
  {
    p_event_key: "exam-staff-invite:" + inviteId,
    p_event_type: "partner.invitation.created",
    p_universe: "examens",
    p_recipient_email: inviteEmail.toLowerCase(),
    p_subject: "NAXA — invitation à rejoindre un centre d'examens",
    p_text_body: "Une structure vous invite à rejoindre son espace professionnel NAXA.",
    p_recipient_user_id: null,
    p_metadata: { invite_id: inviteId }
  }
);
```

Ne pas appeler cette RPC depuis le navigateur. L'événement d'invitation ne doit être mis en file qu'après la création effective de l'invitation. Le lien d'acceptation doit être ajouté par le service métier concerné après vérification de sa route et de son jeton; ne pas inventer de route générique.

## Configuration Apps Script

Copier le contenu de `scripts/google-welcome-email.gs` dans le projet Apps Script existant, puis publier une nouvelle version Web App après validation humaine. Les Script Properties requises :

- `NAXA_WELCOME_SECRET` : correspond à `GOOGLE_APPS_SCRIPT_SECRET` dans Vercel.
- `NAXA_WELCOME_FROM_NAME` : facultatif, `NAXA`.
- `NAXA_WORKER_URL` : `https://nnaxa.vercel.app/api/cron/validite`.
- `NAXA_CRON_SECRET` : correspond à `CRON_SECRET` dans Vercel.
- `NAXA_VERCEL_BYPASS_SECRET` : secret Protection Bypass, distinct des autres secrets.

Exécuter `installNaxaNotificationTrigger` une seule fois après configuration. Pour arrêter le worker planifié : `removeNaxaNotificationTrigger`.

## Tests et limites de certification

Test structurel : `supabase/tests/263_naxa_universal_email_outbox_contract.sql`.

À exécuter sur Replay avant toute Production :

1. appliquer la migration sur Replay après vérification de l'alignement des migrations;
2. exécuter les tests 262 et 263;
3. tester enqueue répété avec la même clé;
4. tester claim concurrent, reprise après verrou expiré, échec et statut dead;
5. tester un destinataire sans compte NAXA;
6. vérifier réception réelle dans une boîte de recette;
7. raccorder séparément les invitations Examens/Livreur et les échéances Prestations/Parapharmacie/Aide.

La présence de cette migration dans Git ne signifie pas qu'elle est appliquée à Supabase. La présence du script dans Git ne met pas à jour le déploiement Apps Script.
