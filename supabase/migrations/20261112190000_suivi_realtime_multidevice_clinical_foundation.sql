-- NAXA — Extension du suivi santé : multi-instances, flux temps réel, programmations et accès professionnels.
begin;

-- Plusieurs modèles physiques d'une même catégorie pour un patient.
drop index if exists public.suivi_user_devices_owner_key_uidx;
alter table public.suivi_user_devices
  add column if not exists platform_device_id text,
  add column if not exists hardware_id text,
  add column if not exists firmware_version text,
  add column if not exists connection_state text not null default 'unpaired',
  add column if not exists auto_reconnect boolean not null default false,
  add column if not exists background_supported boolean not null default false,
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_measurement_at timestamptz,
  add column if not exists decoder_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.suivi_user_devices
  add constraint suivi_user_devices_connection_state_check
  check (connection_state in ('unpaired','connecting','connected','disconnected','error','unsupported')) not valid;
alter table public.suivi_user_devices validate constraint suivi_user_devices_connection_state_check;
create unique index if not exists suivi_user_devices_owner_platform_uidx
  on public.suivi_user_devices(user_id, platform_device_id)
  where platform_device_id is not null and length(platform_device_id) > 0;
create index if not exists suivi_user_devices_owner_category_idx
  on public.suivi_user_devices(user_id, device_key, active);

-- Provenance appareil et idempotence des mesures.
alter table public.suivi_measurements
  add column if not exists device_id uuid references public.suivi_user_devices(id) on delete set null,
  add column if not exists received_at timestamptz not null default now(),
  add column if not exists device_event_id text,
  add column if not exists sync_origin text not null default 'app',
  add column if not exists device_model_snapshot text,
  add column if not exists device_brand_snapshot text;
alter table public.suivi_measurements
  add constraint suivi_measurements_sync_origin_check
  check (sync_origin in ('app','android_native','ios_native','pwa','manual_import')) not valid;
alter table public.suivi_measurements validate constraint suivi_measurements_sync_origin_check;
create unique index if not exists suivi_measurements_device_event_uidx
  on public.suivi_measurements(user_id, device_id, device_event_id)
  where device_id is not null and device_event_id is not null;
create index if not exists suivi_measurements_device_time_idx
  on public.suivi_measurements(user_id, device_id, measured_at desc);

-- Consentements séparés : historique, nouvelles mesures en temps réel et alertes.
alter table public.suivi_shares
  add column if not exists allow_history boolean not null default true,
  add column if not exists allow_realtime boolean not null default false,
  add column if not exists allow_alerts boolean not null default false;
create index if not exists suivi_shares_recipient_realtime_idx
  on public.suivi_shares(recipient_user_id, owner_user_id)
  where active and revoked_at is null and allow_realtime;
create index if not exists suivi_shares_recipient_alerts_idx
  on public.suivi_shares(recipient_user_id, owner_user_id)
  where active and revoked_at is null and allow_alerts;

-- Calendrier récurrent par type de mesure/appareil : heure locale + fuseau explicite.
create table if not exists public.suivi_measurement_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measurement_type text not null,
  device_id uuid references public.suivi_user_devices(id) on delete set null,
  local_time time not null,
  timezone text not null default 'Africa/Douala',
  days_of_week smallint[] not null default array[0,1,2,3,4,5,6]::smallint[],
  lead_minutes smallint not null default 5 check (lead_minutes between 1 and 30),
  freshness_window_minutes smallint not null default 5 check (freshness_window_minutes between 1 and 1440),
  enabled boolean not null default true,
  last_prealert_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(days_of_week) between 1 and 7),
  check (days_of_week <@ array[0,1,2,3,4,5,6]::smallint[])
);
create index if not exists suivi_measurement_schedules_due_idx
  on public.suivi_measurement_schedules(enabled, local_time) where enabled;
alter table public.suivi_measurement_schedules enable row level security;
drop policy if exists suivi_measurement_schedules_owner_all on public.suivi_measurement_schedules;
create policy suivi_measurement_schedules_owner_all on public.suivi_measurement_schedules
  for all to authenticated
  using (user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
  with check (
    user_id = (select auth.uid())
    and public.suivi_is_enabled_user((select auth.uid()))
    and public.suivi_has_consent(user_id, public.suivi_measurement_family(measurement_type))
    and (device_id is null or exists (
      select 1 from public.suivi_user_devices d
      where d.id = device_id and d.user_id = user_id and d.active = true
    ))
  );
grant select, insert, update, delete on public.suivi_measurement_schedules to authenticated;

-- Dossier de suivi médical et historique versionné du diagnostic.
create table if not exists public.suivi_care_links (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  history_access boolean not null default true,
  realtime_access boolean not null default false,
  alerts_access boolean not null default false,
  clinical_notes_access boolean not null default false,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(patient_user_id, professional_user_id),
  check(patient_user_id <> professional_user_id),
  check((active and revoked_at is null) or not active)
);
insert into public.suivi_care_links(patient_user_id,professional_user_id,active,history_access,realtime_access,alerts_access,accepted_at)
select owner_user_id, recipient_user_id, bool_or(active and revoked_at is null), true, false, false, min(granted_at)
from public.suivi_shares
group by owner_user_id,recipient_user_id
on conflict(patient_user_id,professional_user_id) do nothing;
alter table public.suivi_care_links enable row level security;
drop policy if exists suivi_care_links_patient_all on public.suivi_care_links;
create policy suivi_care_links_patient_all on public.suivi_care_links
  for all to authenticated
  using(patient_user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
  with check(patient_user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())));
drop policy if exists suivi_care_links_professional_select on public.suivi_care_links;
create policy suivi_care_links_professional_select on public.suivi_care_links
  for select to authenticated
  using(professional_user_id = (select auth.uid()) and active and revoked_at is null
    and public.suivi_is_enabled_user((select auth.uid()))
    and public.suivi_is_verified_professional((select auth.uid())));
grant select, insert, update on public.suivi_care_links to authenticated;

create table if not exists public.suivi_patient_cases (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  initial_diagnosis text not null check(length(trim(initial_diagnosis)) between 3 and 4000),
  monitoring_reason text,
  status text not null default 'active' check(status in ('active','paused','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(patient_user_id,professional_user_id)
);
create table if not exists public.suivi_clinical_entries (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.suivi_patient_cases(id) on delete cascade,
  professional_user_id uuid not null references auth.users(id) on delete restrict,
  entry_type text not null check(entry_type in ('diagnosis','observation','follow_up')),
  content text not null check(length(trim(content)) between 3 and 6000),
  created_at timestamptz not null default now()
);
create index if not exists suivi_patient_cases_professional_idx
  on public.suivi_patient_cases(professional_user_id,status,updated_at desc);
create index if not exists suivi_clinical_entries_case_idx
  on public.suivi_clinical_entries(case_id,created_at desc);
alter table public.suivi_patient_cases enable row level security;
alter table public.suivi_clinical_entries enable row level security;
drop policy if exists suivi_patient_cases_professional_all on public.suivi_patient_cases;
create policy suivi_patient_cases_professional_all on public.suivi_patient_cases
  for all to authenticated
  using(professional_user_id=(select auth.uid()) and public.suivi_is_enabled_user((select auth.uid()))
    and public.suivi_is_verified_professional((select auth.uid()))
    and exists(select 1 from public.suivi_care_links l where l.patient_user_id=suivi_patient_cases.patient_user_id
      and l.professional_user_id=(select auth.uid()) and l.active and l.clinical_notes_access))
  with check(professional_user_id=(select auth.uid()) and public.suivi_is_enabled_user((select auth.uid()))
    and public.suivi_is_verified_professional((select auth.uid()))
    and exists(select 1 from public.suivi_care_links l where l.patient_user_id=suivi_patient_cases.patient_user_id
      and l.professional_user_id=(select auth.uid()) and l.active and l.clinical_notes_access));
drop policy if exists suivi_clinical_entries_professional_all on public.suivi_clinical_entries;
create policy suivi_clinical_entries_professional_all on public.suivi_clinical_entries
  for all to authenticated
  using(professional_user_id=(select auth.uid()) and public.suivi_is_verified_professional((select auth.uid()))
    and exists(select 1 from public.suivi_patient_cases c join public.suivi_care_links l
      on l.patient_user_id=c.patient_user_id and l.professional_user_id=c.professional_user_id
      where c.id=suivi_clinical_entries.case_id and c.professional_user_id=(select auth.uid())
        and l.active and l.clinical_notes_access))
  with check(professional_user_id=(select auth.uid()) and public.suivi_is_verified_professional((select auth.uid()))
    and exists(select 1 from public.suivi_patient_cases c join public.suivi_care_links l
      on l.patient_user_id=c.patient_user_id and l.professional_user_id=c.professional_user_id
      where c.id=suivi_clinical_entries.case_id and c.professional_user_id=(select auth.uid())
        and l.active and l.clinical_notes_access));
grant select, insert, update, delete on public.suivi_patient_cases,public.suivi_clinical_entries to authenticated;

-- Registre des justificatifs d'agrément : verified reste le verrou d'accès historique.
alter table public.suivi_professionals
  add column if not exists registration_number text,
  add column if not exists issuing_authority text,
  add column if not exists specialty text,
  add column if not exists credential_storage_path text,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_expires_at timestamptz,
  add column if not exists verification_status text not null default 'pending';
alter table public.suivi_professionals
  add constraint suivi_professionals_verification_status_check
  check(verification_status in ('pending','verified','rejected','expired')) not valid;
update public.suivi_professionals set verification_status='verified' where verified=true and verification_status='pending';
alter table public.suivi_professionals validate constraint suivi_professionals_verification_status_check;
create index if not exists suivi_professionals_directory_idx
  on public.suivi_professionals(verified,professional_role,display_name);

commit;
