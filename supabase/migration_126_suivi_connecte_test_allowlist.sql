-- NAXA 126 — suivi connecté en expérimentation strictement allowlistée.
-- L'univers commercial "suivi" reste désactivé. Seul le drapeau séparé suivi_connecte
-- ouvre l'espace aux comptes inscrits dans feature_flag_test_accounts.
begin;

insert into public.feature_flags(flag_key, enabled, description, updated_at)
values ('suivi_connecte', true,
        'Expérimentation privée : comptes explicitement autorisés uniquement; consentement requis; aucune urgence médicale.',
        now())
on conflict (flag_key) do update
set description = excluded.description, updated_at = now();
-- Ne pas modifier l'état existant de suivi_connecte en cas de conflit.

create or replace function public.is_suivi_test_account(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null
    and exists (
      select 1 from public.feature_flags f
      where f.flag_key = 'suivi_connecte' and f.enabled = true
    )
    and exists (
      select 1 from public.feature_flag_test_accounts a
      where a.user_id = p_user_id
    );
$$;
revoke all on function public.is_suivi_test_account(uuid) from public, anon;
grant execute on function public.is_suivi_test_account(uuid) to authenticated;

create table if not exists public.suivi_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_name text check (preferred_name is null or length(trim(preferred_name)) between 1 and 100),
  birth_year smallint check (birth_year is null or birth_year between 1900 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suivi_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_key text not null check (family_key in ('constantes','metabolisme','activite','sommeil','bien_etre','traitements')),
  granted boolean not null default false,
  consent_version text not null default '1.0',
  granted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, family_key),
  check ((granted and granted_at is not null and revoked_at is null) or not granted)
);

create table if not exists public.suivi_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measurement_type text not null check (measurement_type in (
    'tension_systolique','tension_diastolique','frequence_cardiaque','temperature',
    'saturation_oxygene','glycemie','poids','taille','imc','frequence_respiratoire',
    'cholesterol_total','sommeil_heures','pas_jour','activite_minutes','hydratation_ml',
    'douleur_score','humeur_score','cycle_jour','medicament_pris','symptome_note'
  )),
  value_numeric numeric(12,3),
  value_text text check (value_text is null or length(value_text) <= 2000),
  unit text check (unit is null or length(unit) <= 30),
  measured_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual','photo_ocr_local','bluetooth')),
  note text check (note is null or length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (value_numeric is not null or nullif(trim(value_text),'') is not null)
);
create index if not exists suivi_measurements_owner_date_idx on public.suivi_measurements(user_id, measured_at desc);
create index if not exists suivi_measurements_type_date_idx on public.suivi_measurements(user_id, measurement_type, measured_at desc);

create table if not exists public.suivi_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measurement_type text not null check (measurement_type in (
    'tension_systolique','tension_diastolique','frequence_cardiaque','temperature',
    'saturation_oxygene','glycemie','poids','taille','imc','frequence_respiratoire',
    'cholesterol_total','sommeil_heures','pas_jour','activite_minutes','hydratation_ml',
    'douleur_score','humeur_score','cycle_jour','medicament_pris','symptome_note'
  )),
  title text not null check (length(trim(title)) between 2 and 160),
  due_at timestamptz not null,
  repeat_rule text not null default 'none' check (repeat_rule in ('none','daily','weekly')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists suivi_reminders_owner_due_idx on public.suivi_reminders(user_id, due_at) where enabled;

create table if not exists public.suivi_professionals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  professional_role text not null check (professional_role in ('pharmacien','medecin')),
  display_name text not null check (length(trim(display_name)) between 2 and 160),
  verified boolean not null default false,
  verified_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.suivi_shares (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  measurement_type text not null check (measurement_type in (
    'tension_systolique','tension_diastolique','frequence_cardiaque','temperature',
    'saturation_oxygene','glycemie','poids','taille','imc','frequence_respiratoire',
    'cholesterol_total','sommeil_heures','pas_jour','activite_minutes','hydratation_ml',
    'douleur_score','humeur_score','cycle_jour','medicament_pris','symptome_note'
  )),
  active boolean not null default true,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(owner_user_id, recipient_user_id, measurement_type),
  check (owner_user_id <> recipient_user_id)
);
create index if not exists suivi_shares_recipient_idx on public.suivi_shares(recipient_user_id, measurement_type) where active;

create or replace function public.suivi_measurement_family(p_type text)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select case
    when p_type in ('tension_systolique','tension_diastolique','frequence_cardiaque','temperature','saturation_oxygene','frequence_respiratoire') then 'constantes'
    when p_type in ('glycemie','poids','taille','imc','cholesterol_total') then 'metabolisme'
    when p_type in ('pas_jour','activite_minutes','hydratation_ml') then 'activite'
    when p_type = 'sommeil_heures' then 'sommeil'
    when p_type in ('douleur_score','humeur_score','cycle_jour','symptome_note') then 'bien_etre'
    when p_type = 'medicament_pris' then 'traitements'
    else null end;
$$;

create or replace function public.suivi_has_consent(p_user_id uuid, p_family text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.suivi_consents c
    where c.user_id = p_user_id and c.family_key = p_family
      and c.granted = true and c.granted_at is not null and c.revoked_at is null
  );
$$;
revoke all on function public.suivi_has_consent(uuid,text) from public, anon;
grant execute on function public.suivi_has_consent(uuid,text) to authenticated;

create or replace function public.suivi_is_verified_professional(p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists(select 1 from public.suivi_professionals p where p.user_id=p_user_id and p.verified=true);
$$;
revoke all on function public.suivi_is_verified_professional(uuid) from public, anon;
grant execute on function public.suivi_is_verified_professional(uuid) to authenticated;

alter table public.suivi_profiles enable row level security;
alter table public.suivi_consents enable row level security;
alter table public.suivi_measurements enable row level security;
alter table public.suivi_reminders enable row level security;
alter table public.suivi_professionals enable row level security;
alter table public.suivi_shares enable row level security;

drop policy if exists suivi_profiles_self on public.suivi_profiles;
create policy suivi_profiles_self on public.suivi_profiles for all to authenticated
using (user_id=auth.uid() and public.is_suivi_test_account(auth.uid()))
with check (user_id=auth.uid() and public.is_suivi_test_account(auth.uid()));

drop policy if exists suivi_consents_self on public.suivi_consents;
create policy suivi_consents_self on public.suivi_consents for all to authenticated
using (user_id=auth.uid() and public.is_suivi_test_account(auth.uid()))
with check (user_id=auth.uid() and public.is_suivi_test_account(auth.uid()));

drop policy if exists suivi_measurements_owner_select on public.suivi_measurements;
create policy suivi_measurements_owner_select on public.suivi_measurements for select to authenticated
using (public.is_suivi_test_account(auth.uid()) and (
  user_id=auth.uid() or exists (
    select 1 from public.suivi_shares s
    where s.owner_user_id=suivi_measurements.user_id
      and s.recipient_user_id=auth.uid()
      and s.measurement_type=suivi_measurements.measurement_type
      and s.active=true and s.revoked_at is null
      and public.suivi_is_verified_professional(auth.uid())
  )
));
drop policy if exists suivi_measurements_owner_insert on public.suivi_measurements;
create policy suivi_measurements_owner_insert on public.suivi_measurements for insert to authenticated
with check (
  user_id=auth.uid() and public.is_suivi_test_account(auth.uid())
  and public.suivi_has_consent(auth.uid(), public.suivi_measurement_family(measurement_type))
);
drop policy if exists suivi_measurements_owner_update on public.suivi_measurements;
create policy suivi_measurements_owner_update on public.suivi_measurements for update to authenticated
using (user_id=auth.uid() and public.is_suivi_test_account(auth.uid()))
with check (user_id=auth.uid() and public.is_suivi_test_account(auth.uid())
  and public.suivi_has_consent(auth.uid(), public.suivi_measurement_family(measurement_type)));
drop policy if exists suivi_measurements_owner_delete on public.suivi_measurements;
create policy suivi_measurements_owner_delete on public.suivi_measurements for delete to authenticated
using (user_id=auth.uid() and public.is_suivi_test_account(auth.uid()));

drop policy if exists suivi_reminders_self on public.suivi_reminders;
create policy suivi_reminders_self on public.suivi_reminders for all to authenticated
using (user_id=auth.uid() and public.is_suivi_test_account(auth.uid()))
with check (user_id=auth.uid() and public.is_suivi_test_account(auth.uid())
  and public.suivi_has_consent(auth.uid(), public.suivi_measurement_family(measurement_type)));

drop policy if exists suivi_shares_owner_select on public.suivi_shares;
create policy suivi_shares_owner_select on public.suivi_shares for select to authenticated
using (owner_user_id=auth.uid() and public.is_suivi_test_account(auth.uid()));
drop policy if exists suivi_shares_owner_insert on public.suivi_shares;
create policy suivi_shares_owner_insert on public.suivi_shares for insert to authenticated
with check (
  owner_user_id=auth.uid() and public.is_suivi_test_account(auth.uid())
  and public.suivi_is_verified_professional(recipient_user_id)
  and exists(select 1 from public.suivi_measurements m where m.user_id=auth.uid() and m.measurement_type=suivi_shares.measurement_type)
);
drop policy if exists suivi_shares_owner_update on public.suivi_shares;
create policy suivi_shares_owner_update on public.suivi_shares for update to authenticated
using (owner_user_id=auth.uid() and public.is_suivi_test_account(auth.uid()))
with check (owner_user_id=auth.uid() and public.is_suivi_test_account(auth.uid())
  and public.suivi_is_verified_professional(recipient_user_id));

drop policy if exists suivi_professional_self_select on public.suivi_professionals;
create policy suivi_professional_self_select on public.suivi_professionals for select to authenticated
using (user_id=auth.uid() and verified=true and public.is_suivi_test_account(auth.uid()));

grant select, insert, update, delete on public.suivi_profiles, public.suivi_consents, public.suivi_measurements, public.suivi_reminders, public.suivi_shares to authenticated;
grant select on public.suivi_professionals to authenticated;

-- Aucun compte n'est autorisé automatiquement. La liste existante reste la seule source d'autorisation.
commit;
