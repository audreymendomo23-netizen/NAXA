-- NAXA 188 — vérifie la structure, la concurrence et les droits du pointage Pharmacien.
do $test$
begin
  if to_regclass('public.pharmacien_service_sessions') is null then
    raise exception 'NAXA 188: table pharmacien_service_sessions absente';
  end if;
  if to_regprocedure('public.pharmacien_service_demarrer(text)') is null then
    raise exception 'NAXA 188: RPC de prise de service absente';
  end if;
  if to_regprocedure('public.pharmacien_service_terminer(uuid,text)') is null then
    raise exception 'NAXA 188: RPC de fin de service absente';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='pharmacien_service_sessions'
      and indexname='pharmacien_service_one_open_session_per_user_uidx'
  ) then raise exception 'NAXA 188: unicité du service ouvert par utilisateur absente'; end if;
  if not exists (
    select 1 from pg_tables
    where schemaname='public' and tablename='pharmacien_service_sessions' and rowsecurity
  ) then raise exception 'NAXA 188: RLS non activée sur les pointages'; end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pharmacien_service_sessions'
      and policyname='pharmacien_service_sessions_select_self'
  ) then raise exception 'NAXA 188: politique de lecture personnelle absente'; end if;
end;
$test$;
select true as naxa_188_pharmacien_service_sessions_pass;
