-- NAXA 130 — empêcher l’énumération de la liste des comptes autorisés au suivi.
begin;
create or replace function public.is_suivi_test_account(p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path=public,pg_temp
as $$
 select p_user_id is not null
   and (
     p_user_id=auth.uid()
     or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
   )
   and exists(select 1 from public.feature_flags f where f.flag_key='suivi_connecte' and f.enabled=true)
   and exists(select 1 from public.feature_flag_test_accounts a where a.user_id=p_user_id);
$$;
revoke all on function public.is_suivi_test_account(uuid) from public,anon;
grant execute on function public.is_suivi_test_account(uuid) to authenticated;
commit;
