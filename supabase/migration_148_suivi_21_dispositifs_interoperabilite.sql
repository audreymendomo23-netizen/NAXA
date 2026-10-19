-- NAXA 148 — catalogue étendu à 21 dispositifs et modes d'acquisition polyvalents.
begin;

alter table public.suivi_user_devices
  drop constraint if exists suivi_user_devices_device_key_check,
  drop constraint if exists suivi_user_devices_connection_mode_check,
  drop constraint if exists suivi_user_devices_check;

alter table public.suivi_user_devices
  add constraint suivi_user_devices_device_key_check check (device_key in (
    'tensiometre','thermometre','oxymetre','glucometre','balance',
    'capteur_cardiaque_bluetooth','podometre','ecg','spirometre','peak_flow',
    'balance_impedance','cholesterolometre','cetonemetre','uricometre',
    'montre_connectee','bracelet_activite','tracker_sommeil',
    'thermometre_infrarouge','capteur_respiration','pilulier_connecte',
    'bouteille_hydratation'
  )),
  add constraint suivi_user_devices_connection_mode_check
    check (connection_mode in ('manual','bluetooth','scan','hybrid'));

alter table public.suivi_user_devices
  add column if not exists device_brand text,
  add column if not exists device_model text,
  add column if not exists protocol text,
  add column if not exists last_sync_at timestamptz,
  add column if not exists last_error text,
  add column if not exists capabilities jsonb not null default '["manual","bluetooth","scan"]'::jsonb;

alter table public.suivi_user_devices
  add constraint suivi_user_devices_brand_length check (device_brand is null or length(device_brand) <= 120),
  add constraint suivi_user_devices_model_length check (device_model is null or length(device_model) <= 120),
  add constraint suivi_user_devices_protocol_length check (protocol is null or length(protocol) <= 80),
  add constraint suivi_user_devices_last_error_length check (last_error is null or length(last_error) <= 500),
  add constraint suivi_user_devices_capabilities_array check (jsonb_typeof(capabilities) = 'array');

create or replace function public.suivi_device_family(p_device_key text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_device_key in ('tensiometre','thermometre','oxymetre','capteur_cardiaque_bluetooth','ecg','thermometre_infrarouge','capteur_respiration') then 'constantes'
    when p_device_key in ('glucometre','balance','balance_impedance','cholesterolometre','cetonemetre','uricometre') then 'metabolisme'
    when p_device_key in ('podometre','montre_connectee','bracelet_activite') then 'activite'
    when p_device_key in ('tracker_sommeil') then 'sommeil'
    when p_device_key in ('spirometre','peak_flow') then 'constantes'
    when p_device_key in ('pilulier_connecte') then 'traitements'
    when p_device_key in ('bouteille_hydratation') then 'activite'
    else null
  end;
$$;
revoke all on function public.suivi_device_family(text) from public, anon;
grant execute on function public.suivi_device_family(text) to authenticated;

comment on table public.suivi_user_devices is
  'Catalogue personnel de 21 dispositifs. Les capacités déclarées ne garantissent pas la compatibilité d’un modèle; chaque connexion doit être détectée et vérifiée.';
comment on column public.suivi_user_devices.capabilities is
  'Modes possibles parmi manual, bluetooth et scan; métadonnées non fiables tant que le protocole du modèle n’a pas été vérifié.';

commit;