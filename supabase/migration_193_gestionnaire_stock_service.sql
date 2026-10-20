-- NAXA 193 — prise et fin de service du poste Gestionnaire de stock.
begin;
create table if not exists public.gestionnaire_stock_sessions(
 id uuid primary key default gen_random_uuid(),
 pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 started_at timestamptz not null default now(),
 ended_at timestamptz,
 note_fin text check(note_fin is null or char_length(note_fin)<=500),
 created_at timestamptz not null default now(),
 check(ended_at is null or ended_at>=started_at)
);
create unique index if not exists gestionnaire_stock_session_ouverte_uq
 on public.gestionnaire_stock_sessions(pharmacie_id,user_id) where ended_at is null;
create index if not exists gestionnaire_stock_sessions_history_idx
 on public.gestionnaire_stock_sessions(pharmacie_id,started_at desc);
alter table public.gestionnaire_stock_sessions enable row level security;
drop policy if exists gestionnaire_stock_sessions_read on public.gestionnaire_stock_sessions;
create policy gestionnaire_stock_sessions_read on public.gestionnaire_stock_sessions
 for select to authenticated using(user_id=(select auth.uid()) or public.is_admin() or public.can_access_pharmacy(pharmacie_id));
revoke all on public.gestionnaire_stock_sessions from anon,public;
grant select on public.gestionnaire_stock_sessions to authenticated;

create or replace function public.gestionnaire_stock_service_ouvrir(p_pharmacie uuid)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_profile public.profiles%rowtype; v_id uuid;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if not public.can_access_pharmacy(p_pharmacie) then raise exception 'Pharmacie hors périmètre'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur') or coalesce(v_profile.fonction_interne,'') in ('gestionnaire_stock','magasinier','pharmacien','pharmacien_assistant','responsable')) then raise exception 'Rôle Gestionnaire de stock requis'; end if;
 if exists(select 1 from public.gestionnaire_stock_sessions where pharmacie_id=p_pharmacie and user_id=v_user and ended_at is null) then raise exception 'Un service est déjà ouvert pour ce compte'; end if;
 insert into public.gestionnaire_stock_sessions(pharmacie_id,user_id) values(p_pharmacie,v_user) returning id into v_id;
 return v_id;
end;
$function$;

create or replace function public.gestionnaire_stock_service_fermer(p_session uuid,p_note text default null)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_note is not null and char_length(trim(p_note))>500 then raise exception 'Note limitée à 500 caractères'; end if;
 update public.gestionnaire_stock_sessions set ended_at=now(),note_fin=nullif(trim(coalesce(p_note,'')),'')
 where id=p_session and user_id=v_user and ended_at is null;
 if not found then raise exception 'Service ouvert introuvable pour ce compte'; end if;
 return true;
end;
$function$;
revoke all on function public.gestionnaire_stock_service_ouvrir(uuid) from public,anon;
revoke all on function public.gestionnaire_stock_service_fermer(uuid,text) from public,anon;
grant execute on function public.gestionnaire_stock_service_ouvrir(uuid) to authenticated;
grant execute on function public.gestionnaire_stock_service_fermer(uuid,text) to authenticated;
commit;
