-- NAXA ERP — pointage du service Pharmacien.
-- Migration additive : ne réutilise pas les sessions de caisse et ne touche pas aux données de vente.
begin;

create table if not exists public.pharmacien_service_sessions (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  pharmacien_id uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  start_note text,
  end_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pharmacien_service_session_dates_ck check (ended_at is null or ended_at >= started_at),
  constraint pharmacien_service_session_note_length_ck check (
    (start_note is null or char_length(start_note) <= 1000)
    and (end_note is null or char_length(end_note) <= 1000)
  )
);

create index if not exists pharmacien_service_sessions_scope_date_idx
  on public.pharmacien_service_sessions(pharmacie_id, started_at desc);
create index if not exists pharmacien_service_sessions_user_date_idx
  on public.pharmacien_service_sessions(pharmacien_id, started_at desc);
create unique index if not exists pharmacien_service_one_open_session_per_user_uidx
  on public.pharmacien_service_sessions(pharmacien_id)
  where ended_at is null;

alter table public.pharmacien_service_sessions enable row level security;
drop policy if exists pharmacien_service_sessions_select_self on public.pharmacien_service_sessions;
create policy pharmacien_service_sessions_select_self
  on public.pharmacien_service_sessions for select to authenticated
  using (
    pharmacien_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.actif = true
        and p.fonction_interne = 'pharmacien'
        and p.pharmacie_id = pharmacien_service_sessions.pharmacie_id
    )
  );

revoke all on public.pharmacien_service_sessions from anon, authenticated;
grant select on public.pharmacien_service_sessions to authenticated;

create or replace function public.pharmacien_service_demarrer(p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := (select auth.uid());
  p uuid;
  v_id uuid;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  select pharmacie_id into p
  from public.profiles
  where id = u and actif = true and fonction_interne = 'pharmacien';
  if p is null then raise exception 'Accès réservé à un compte Pharmacien actif'; end if;

  if exists (
    select 1 from public.pharmacien_service_sessions s
    where s.pharmacien_id = u and s.ended_at is null
  ) then raise exception 'Un service est déjà ouvert pour ce compte'; end if;

  insert into public.pharmacien_service_sessions(pharmacie_id, pharmacien_id, start_note)
  values (p, u, nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'Un service est déjà ouvert pour ce compte';
end;
$$;

create or replace function public.pharmacien_service_terminer(p_session uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := (select auth.uid());
begin
  if u is null then raise exception 'Connexion requise'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = u and p.actif = true and p.fonction_interne = 'pharmacien'
  ) then raise exception 'Accès réservé à un compte Pharmacien actif'; end if;

  update public.pharmacien_service_sessions
  set ended_at = now(),
      end_note = nullif(trim(coalesce(p_note, '')), ''),
      updated_at = now()
  where id = p_session
    and pharmacien_id = u
    and ended_at is null;
  if not found then raise exception 'Service ouvert introuvable ou déjà clôturé'; end if;
end;
$$;

revoke all on function public.pharmacien_service_demarrer(text) from public, anon;
revoke all on function public.pharmacien_service_terminer(uuid, text) from public, anon;
grant execute on function public.pharmacien_service_demarrer(text) to authenticated;
grant execute on function public.pharmacien_service_terminer(uuid, text) to authenticated;

comment on table public.pharmacien_service_sessions is
  'Pointage de prise/fin de service Pharmacien. Distinct des sessions de caisse et limité au compte Pharmacien propriétaire.';
commit;
