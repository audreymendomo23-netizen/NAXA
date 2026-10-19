-- NAXA 133 — ouverture générale du suivi gratuit et catalogue personnel des dispositifs.
-- Le verrou commercial de l’univers "suivi" (migration 125) reste intact :
-- les dispositifs ci-dessous sont un carnet de suivi personnel, pas un catalogue vendeur.
begin;

insert into public.feature_flags(flag_key, enabled, description, updated_at)
values ('suivi_connecte', true,
        'Suivi personnel gratuit ouvert aux comptes connectés; consentement explicite et RLS conservés.',
        now())
on conflict (flag_key) do update
set enabled = true,
    description = excluded.description,
    updated_at = now();

create or replace function public.is_suivi_test_account(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null
    and (
      p_user_id = auth.uid()
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    )
    and exists (
      select 1 from public.feature_flags f
      where f.flag_key = 'suivi_connecte' and f.enabled = true
    );
$$;
revoke all on function public.is_suivi_test_account(uuid) from public, anon;
grant execute on function public.is_suivi_test_account(uuid) to authenticated;

create or replace function public.suivi_device_family(p_device_key text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_device_key in ('tensiometre','thermometre','oxymetre','capteur_cardiaque_bluetooth') then 'constantes'
    when p_device_key in ('glucometre','balance') then 'metabolisme'
    when p_device_key = 'podometre' then 'activite'
    else null
  end;
$$;
revoke all on function public.suivi_device_family(text) from public, anon;
grant execute on function public.suivi_device_family(text) to authenticated;

create table if not exists public.suivi_user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key text not null check (device_key in (
    'tensiometre','thermometre','oxymetre','glucometre','balance',
    'capteur_cardiaque_bluetooth','podometre'
  )),
  device_name text not null check (length(trim(device_name)) between 2 and 120),
  connection_mode text not null check (connection_mode in ('manual','bluetooth')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, device_key),
  check (
    (device_key = 'capteur_cardiaque_bluetooth' and connection_mode = 'bluetooth')
    or (device_key <> 'capteur_cardiaque_bluetooth' and connection_mode = 'manual')
  )
);
create index if not exists suivi_user_devices_owner_idx
  on public.suivi_user_devices(user_id, active);

alter table public.suivi_user_devices enable row level security;
drop policy if exists suivi_user_devices_select_self on public.suivi_user_devices;
create policy suivi_user_devices_select_self on public.suivi_user_devices
for select to authenticated
using (user_id = auth.uid() and public.is_suivi_test_account(auth.uid()));

drop policy if exists suivi_user_devices_insert_self on public.suivi_user_devices;
create policy suivi_user_devices_insert_self on public.suivi_user_devices
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_suivi_test_account(auth.uid())
  and public.suivi_has_consent(auth.uid(), public.suivi_device_family(device_key))
);

drop policy if exists suivi_user_devices_update_self on public.suivi_user_devices;
create policy suivi_user_devices_update_self on public.suivi_user_devices
for update to authenticated
using (user_id = auth.uid() and public.is_suivi_test_account(auth.uid()))
with check (
  user_id = auth.uid()
  and public.is_suivi_test_account(auth.uid())
  and (active = false or public.suivi_has_consent(auth.uid(), public.suivi_device_family(device_key)))
);

drop policy if exists suivi_user_devices_delete_self on public.suivi_user_devices;
create policy suivi_user_devices_delete_self on public.suivi_user_devices
for delete to authenticated
using (user_id = auth.uid() and public.is_suivi_test_account(auth.uid()));

grant select, insert, update, delete on public.suivi_user_devices to authenticated;
comment on table public.suivi_user_devices is
  'Préférences privées de dispositifs du carnet de suivi gratuit; aucune association partenaire ni vente.';
commit;
