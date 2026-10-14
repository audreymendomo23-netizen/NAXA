-- Une identité reste provisoire tant que le parcours signup n'a pas explicitement retiré le marqueur pending.
-- Ne pas dépendre de la seule présence d'un profil potentiellement incomplet.
begin;
create or replace function public.naxa_session_count(p_user_id uuid)
returns integer language plpgsql security definer set search_path = pg_catalog, auth stable
as $$
begin
 if exists (select 1 from auth.users u where u.id=p_user_id and u.raw_user_meta_data->>'naxa_signup_pending'='true') then return 0; end if;
 return (select count(*)::integer from auth.sessions s where s.user_id=p_user_id and (s.not_after is null or s.not_after>now()));
end;
$$;
create or replace function public.naxa_enforce_session_limit()
returns trigger language plpgsql security definer set search_path = pg_catalog, auth
as $$
declare current_count integer; is_pending_signup boolean;
begin
 select exists (select 1 from auth.users u where u.id=new.user_id and u.raw_user_meta_data->>'naxa_signup_pending'='true') into is_pending_signup;
 if is_pending_signup then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 select count(*)::integer into current_count from auth.sessions s where s.user_id=new.user_id and (s.not_after is null or s.not_after>now());
 if current_count>=4 then raise exception 'NAXA_SESSION_LIMIT_REACHED' using errcode='P0001', detail='Maximum de 4 sessions actives atteint.'; end if;
 return new;
end;
$$;
revoke execute on function public.naxa_session_count(uuid) from public, anon, authenticated;
grant execute on function public.naxa_session_count(uuid) to service_role;
revoke execute on function public.naxa_enforce_session_limit() from public, anon, authenticated, service_role;
commit;
