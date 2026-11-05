-- NAXA — contrat de schéma et de sécurité des favoris/rappels.
do $test$
declare
  favoris_ok boolean;
  propositions_ok boolean;
  rappels_ok boolean;
  rls_ok boolean;
  policy_ok boolean;
  grants_ok boolean;
  rpc_ok boolean;
  trigger_ok boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='favoris_client'
  ) into favoris_ok;
  if not favoris_ok then raise exception 'favoris_client table missing'; end if;

  select exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='naxa_achat_suivi_propositions'
  ) into propositions_ok;
  if not propositions_ok then raise exception 'naxa_achat_suivi_propositions table missing'; end if;

  select
    (select count(*)=11 from information_schema.columns
      where table_schema='public' and table_name='naxa_favoris_rappels'
        and column_name in ('id','user_id','produit_ref','produit_nom','reservation_id','reminder_date','mode','source','actif','consent_at','notified_at'))
    and exists (select 1 from information_schema.tables
      where table_schema='public' and table_name='naxa_favoris_rappels')
  into rappels_ok;
  if not rappels_ok then raise exception 'naxa_favoris_rappels table/columns incomplete'; end if;

  select
    (select relrowsecurity from pg_class where oid='public.favoris_client'::regclass)
    and (select relrowsecurity from pg_class where oid='public.naxa_achat_suivi_propositions'::regclass)
    and (select relrowsecurity from pg_class where oid='public.naxa_favoris_rappels'::regclass)
  into rls_ok;
  if not rls_ok then raise exception 'RLS must be enabled on all favorites/reminder tables'; end if;

  select exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='naxa_favoris_rappels'
      and policyname='naxa_favoris_rappels_self'
      and 'authenticated'=any(roles)
      and cmd='ALL'
  ) into policy_ok;
  if not policy_ok then raise exception 'Per-user reminder RLS policy missing'; end if;

  select
    has_table_privilege('authenticated','public.favoris_client','SELECT')
    and has_table_privilege('authenticated','public.naxa_achat_suivi_propositions','SELECT')
    and has_table_privilege('authenticated','public.naxa_favoris_rappels','SELECT')
    and has_table_privilege('authenticated','public.naxa_favoris_rappels','INSERT')
    and has_table_privilege('authenticated','public.naxa_favoris_rappels','UPDATE')
    and has_table_privilege('authenticated','public.naxa_favoris_rappels','DELETE')
    and has_table_privilege('service_role','public.naxa_favoris_rappels','SELECT')
  into grants_ok;
  if not grants_ok then raise exception 'Favorites/reminder table grants incomplete'; end if;

  select to_regprocedure('public.accepter_proposition_favori(uuid,date)') is not null
    and has_function_privilege('authenticated','public.accepter_proposition_favori(uuid,date)','EXECUTE')
    and not has_function_privilege('anon','public.accepter_proposition_favori(uuid,date)','EXECUTE')
  into rpc_ok;
  if not rpc_ok then raise exception 'Favorite acceptance RPC missing or privileges too broad'; end if;

  select exists (
    select 1 from pg_trigger
    where tgname='naxa_reservation_achat_favoris'
      and tgrelid='public.reservations'::regclass
      and not tgisinternal
  ) into trigger_ok;
  if not trigger_ok then raise exception 'Paid reservation favorite trigger missing'; end if;
end
$test$;

select 'naxa_favoris_reminders_schema_alignment_pass' as test, true as passed;
