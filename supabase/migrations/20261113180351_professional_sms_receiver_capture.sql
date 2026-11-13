begin;

alter table public.naxa_payment_notification_devices
  add column if not exists sms_consent_at timestamptz;

alter table public.naxa_payment_evidence_intake
  add column if not exists source_sender text;

alter table public.naxa_payment_evidence_intake
  drop constraint if exists naxa_payment_evidence_intake_source_type_check;

alter table public.naxa_payment_evidence_intake
  add constraint naxa_payment_evidence_intake_source_type_check
  check (source_type in ('notification', 'voluntary_sms_share', 'sms_receiver'));

alter table public.naxa_payment_evidence_intake
  drop constraint if exists naxa_payment_evidence_source_package_check;

alter table public.naxa_payment_evidence_intake
  add constraint naxa_payment_evidence_source_package_check check (
    (source_type = 'notification' and source_package is not null and source_sender is null)
    or (source_type = 'voluntary_sms_share' and source_package is null and source_sender is null)
    or (source_type = 'sms_receiver' and source_package is null and source_sender in ('OrangeMoney', 'MobileMoney'))
  );

create index if not exists naxa_payment_evidence_reference_match_idx
  on public.naxa_payment_evidence_intake
  (canal, transaction_reference, direction, workspace_type, workspace_id, received_at desc)
  where transaction_reference is not null;

comment on column public.naxa_payment_notification_devices.sms_consent_at is
  'Consentement explicite et révocable à la collecte des SMS entrants ; distinct du consentement de lecture des notifications.';
comment on column public.naxa_payment_evidence_intake.source_sender is
  'Libellé brut utilisé uniquement pour filtrer le flux SMS entrant ; ce champ ne constitue jamais une preuve de paiement.';
comment on table public.naxa_payment_evidence_intake is
  'Éléments structurés pour rapprochement ; le SMS brut n''est pas conservé et un événement isolé ne confirme jamais un paiement.';

commit;
