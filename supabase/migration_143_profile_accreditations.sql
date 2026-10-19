-- NAXA 143 — restaurer le journal des accréditations hiérarchiques.
-- La RPC accréditer_profile consigne chaque affectation dans cette table.
create table if not exists public.profile_accreditations (
  id uuid primary key default gen_random_uuid(),
  grantor_profile_id uuid not null references public.profiles(id) on delete restrict,
  target_profile_id uuid not null references public.profiles(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  niveau smallint not null check (niveau in (2,3)),
  created_at timestamptz not null default now(),
  constraint profile_accreditations_no_self_ck check (grantor_profile_id <> target_profile_id)
);

create index if not exists profile_accreditations_target_created_idx
  on public.profile_accreditations(target_profile_id,created_at desc);
create index if not exists profile_accreditations_pharmacy_created_idx
  on public.profile_accreditations(pharmacie_id,created_at desc);

alter table public.profile_accreditations enable row level security;
drop policy if exists profile_accreditations_participant_read on public.profile_accreditations;
create policy profile_accreditations_participant_read on public.profile_accreditations
  for select to authenticated
  using (
    grantor_profile_id=(select auth.uid())
    or target_profile_id=(select auth.uid())
    or (select public.is_admin())
  );
revoke all on public.profile_accreditations from anon,authenticated;
grant select on public.profile_accreditations to authenticated;
