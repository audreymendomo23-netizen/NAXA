-- NAXA Comptable — journal nominatif de prise / fin de service.
begin;

create table if not exists public.comptable_service_sessions (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  comptable_id uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  start_note text,
  end_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comptable_service_session_dates_ck check (ended_at is null or ended_at >= started_at),
  constraint comptable_service_session_note_length_ck check (
    (start_note is null or char_length(start_note) <= 1000)
    and (end_note is null or char_length(end_note) <= 1000)
  )
);

create index if not exists comptable_service_sessions_scope_date_idx
  on public.comptable_service_sessions(pharmacie_id,started_at desc);
create index if not exists comptable_service_sessions_user_date_idx
  on public.comptable_service_sessions(comptable_id,started_at desc);
create unique index if not exists comptable_service_one_open_session_per_user_uidx
  on public.comptable_service_sessions(comptable_id) where ended_at is null;

alter table public.comptable_service_sessions enable row level security;
drop policy if exists comptable_service_sessions_select_self on public.comptable_service_sessions;
create policy comptable_service_sessions_select_self
  on public.comptable_service_sessions for select to authenticated
  using (
    comptable_id=(select auth.uid())
    and public.compta_scope_autorise(pharmacie_id)
  );

revoke all on public.comptable_service_sessions from anon,authenticated;
grant select on public.comptable_service_sessions to authenticated;

create or replace function public.comptable_service_demarrer(p_note text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare u uuid := (select auth.uid()); p uuid; v_id uuid;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  select pharmacie_id into p from public.profiles where id=u and actif=true;
  if p is null or not public.compta_scope_autorise(p) then
    raise exception 'Accès réservé à un Comptable actif autorisé sur cette pharmacie';
  end if;
  if not exists(select 1 from public.pharmacies f where f.id=p and f.actif=true) then
    raise exception 'La pharmacie est inactive';
  end if;
  insert into public.comptable_service_sessions(pharmacie_id,comptable_id,start_note)
  values(p,u,nullif(trim(coalesce(p_note,'')),'')) returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Un service Comptable est déjà ouvert pour ce compte';
end;
$$;

create or replace function public.comptable_service_terminer(p_session uuid,p_note text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare u uuid := (select auth.uid());
begin
  if u is null then raise exception 'Connexion requise'; end if;
  update public.comptable_service_sessions s
    set ended_at=now(),end_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now()
  where s.id=p_session and s.comptable_id=u and s.ended_at is null
    and public.compta_scope_autorise(s.pharmacie_id);
  if not found then raise exception 'Service ouvert introuvable, clôturé ou hors périmètre autorisé'; end if;
end;
$$;

revoke all on function public.comptable_service_demarrer(text) from public,anon;
revoke all on function public.comptable_service_terminer(uuid,text) from public,anon;
grant execute on function public.comptable_service_demarrer(text) to authenticated;
grant execute on function public.comptable_service_terminer(uuid,text) to authenticated;

comment on table public.comptable_service_sessions is
  'Pointage individuel Comptable, horodatage serveur, lié à une pharmacie autorisée et distinct des sessions de caisse.';
commit;
