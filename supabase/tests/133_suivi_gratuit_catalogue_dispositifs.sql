-- Test NAXA 133 : suivi ouvert hors allowlist, données toujours cloisonnées, activation soumise au consentement.
do $test$
declare fn text; sel text; ins text; upd text; del text; table_exists boolean;
begin
  select pg_get_functiondef('public.is_suivi_test_account(uuid)'::regprocedure) into fn;
  if fn like '%feature_flag_test_accounts%' then
    raise exception 'NAXA 133: l’allowlist expérimentale bloque encore le suivi';
  end if;
  if fn not like '%suivi_connecte%' then
    raise exception 'NAXA 133: le drapeau de disponibilité n’est pas contrôlé';
  end if;
  select exists(select 1 from information_schema.tables where table_schema='public' and table_name='suivi_user_devices') into table_exists;
  if not table_exists then raise exception 'NAXA 133: catalogue personnel absent'; end if;
  select qual into sel from pg_policies where schemaname='public' and tablename='suivi_user_devices' and policyname='suivi_user_devices_select_self';
  select with_check into ins from pg_policies where schemaname='public' and tablename='suivi_user_devices' and policyname='suivi_user_devices_insert_self';
  select with_check into upd from pg_policies where schemaname='public' and tablename='suivi_user_devices' and policyname='suivi_user_devices_update_self';
  select qual into del from pg_policies where schemaname='public' and tablename='suivi_user_devices' and policyname='suivi_user_devices_delete_self';
  if sel is null or sel not like '%auth.uid()%' then raise exception 'NAXA 133: lecture non cloisonnée par propriétaire'; end if;
  if ins is null or ins not like '%suivi_has_consent%' then raise exception 'NAXA 133: activation sans consentement possible'; end if;
  if upd is null or upd not like '%suivi_has_consent%' then raise exception 'NAXA 133: réactivation sans consentement possible'; end if;
  if del is null or del not like '%auth.uid()%' then raise exception 'NAXA 133: suppression non cloisonnée par propriétaire'; end if;
end;
$test$;
select true as naxa_133_free_tracking_catalog_pass;
