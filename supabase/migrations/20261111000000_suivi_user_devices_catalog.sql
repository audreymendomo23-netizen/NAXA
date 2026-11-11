-- NAXA — canonical schema for the private connected-device notebook.
-- Legacy 133/148 SQL files live outside supabase/migrations. This migration
-- makes the user-owned device table part of the normal migration history.
begin;

create or replace function public.suivi_device_family(p_device_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_device_key in ('tensiometre','thermometre','oxymetre','capteur_cardiaque_bluetooth','ecg','thermometre_infrarouge','capteur_respiration','spirometre','peak_flow') then 'constantes'
    when p_device_key in ('glucometre','balance','balance_impedance','cholesterolometre','cetonemetre','uricometre') then 'metabolisme'
    when p_device_key in ('podometre','montre_connectee','bracelet_activite','bouteille_hydratation') then 'activite'
    when p_device_key = 'tracker_sommeil' then 'sommeil'
    when p_device_key = 'pilulier_connecte' then 'traitements'
    else null
  end;
$$;
revoke all on function public.suivi_device_family(text) from public, anon;
grant execute on function public.suivi_device_family(text) to authenticated;

create table if not exists public.suivi_user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key text not null,
  device_name text not null,
  connection_mode text not null default 'hybrid',
  active boolean not null default true,
  device_brand text,
  device_model text,
  protocol text,
  last_sync_at timestamptz,
  last_error text,
  capabilities jsonb not null default '["manual","bluetooth","scan"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.suivi_user_devices
  add column if not exists device_brand text,
  add column if not exists device_model text,
  add column if not exists protocol text,
  add column if not exists last_sync_at timestamptz,
  add column if not exists last_error text,
  add column if not exists capabilities jsonb not null default '["manual","bluetooth","scan"]'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.suivi_user_devices
  drop constraint if exists suivi_user_devices_check,
  drop constraint if exists suivi_user_devices_device_key_check,
  drop constraint if exists suivi_user_devices_connection_mode_check,
  drop constraint if exists suivi_user_devices_device_name_check,
  drop constraint if exists suivi_user_devices_capabilities_array,
  drop constraint if exists suivi_user_devices_brand_length,
  drop constraint if exists suivi_user_devices_model_length,
  drop constraint if exists suivi_user_devices_protocol_length,
  drop constraint if exists suivi_user_devices_last_error_length;

alter table public.suivi_user_devices
  add constraint suivi_user_devices_device_key_check check (device_key in (
    'tensiometre','thermometre','oxymetre','glucometre','balance',
    'capteur_cardiaque_bluetooth','podometre','ecg','spirometre','peak_flow',
    'balance_impedance','cholesterolometre','cetonemetre','uricometre',
    'montre_connectee','bracelet_activite','tracker_sommeil',
    'thermometre_infrarouge','capteur_respiration','pilulier_connecte',
    'bouteille_hydratation'
  )),
  add constraint suivi_user_devices_connection_mode_check check (connection_mode in ('manual','bluetooth','scan','hybrid')),
  add constraint suivi_user_devices_device_name_check check (length(trim(device_name)) between 2 and 120),
  add constraint suivi_user_devices_capabilities_array check (jsonb_typeof(capabilities) = 'array'),
  add constraint suivi_user_devices_brand_length check (device_brand is null or length(device_brand) <= 120),
  add constraint suivi_user_devices_model_length check (device_model is null or length(device_model) <= 120),
  add constraint suivi_user_devices_protocol_length check (protocol is null or length(protocol) <= 80),
  add constraint suivi_user_devices_last_error_length check (last_error is null or length(last_error) <= 500);

create unique index if not exists suivi_user_devices_owner_key_uidx on public.suivi_user_devices(user_id, device_key);
create index if not exists suivi_user_devices_owner_active_idx on public.suivi_user_devices(user_id, active);
alter table public.suivi_user_devices enable row level security;

drop policy if exists suivi_user_devices_select_self on public.suivi_user_devices;
create policy suivi_user_devices_select_self on public.suivi_user_devices for select to authenticated
using (user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())));

drop policy if exists suivi_user_devices_insert_self on public.suivi_user_devices;
create policy suivi_user_devices_insert_self on public.suivi_user_devices for insert to authenticated
with check (
  user_id = (select auth.uid()) and active = true
  and public.suivi_is_enabled_user((select auth.uid()))
  and public.suivi_has_consent(user_id, public.suivi_device_family(device_key))
);

drop policy if exists suivi_user_devices_update_self on public.suivi_user_devices;
create policy suivi_user_devices_update_self on public.suivi_user_devices for update to authenticated
using (user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
with check (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and (active = false or public.suivi_has_consent(user_id, public.suivi_device_family(device_key)))
);

drop policy if exists suivi_user_devices_delete_self on public.suivi_user_devices;
create policy suivi_user_devices_delete_self on public.suivi_user_devices for delete to authenticated
using (user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())));
grant select, insert, update, delete on public.suivi_user_devices to authenticated;

create or replace function public.suivi_deactivate_devices_on_consent_revocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.granted is true and new.granted is false then
    update public.suivi_user_devices
       set active = false, updated_at = now()
     where user_id = new.user_id and active = true
       and public.suivi_device_family(device_key) = new.family_key;
  end if;
  return new;
end;
$$;
revoke all on function public.suivi_deactivate_devices_on_consent_revocation() from public, anon, authenticated;
drop trigger if exists suivi_deactivate_devices_on_consent_revocation on public.suivi_consents;
create trigger suivi_deactivate_devices_on_consent_revocation
after update of granted on public.suivi_consents
for each row
when (old.granted is true and new.granted is false)
execute function public.suivi_deactivate_devices_on_consent_revocation();

comment on table public.suivi_user_devices is 'Appareils personnels du carnet de suivi gratuit; aucune association partenaire ni vente.';
commit;
