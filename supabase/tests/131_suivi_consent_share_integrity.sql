-- Test NAXA 131 : pas de partage sans consentement et pas d’alertes forgées côté client.
do $test$
declare insert_policy text; update_policy text; privs text;
begin
 select with_check into insert_policy from pg_policies where schemaname='public' and tablename='suivi_shares' and policyname='suivi_shares_owner_insert';
 select with_check into update_policy from pg_policies where schemaname='public' and tablename='suivi_shares' and policyname='suivi_shares_owner_update';
 if insert_policy is null or insert_policy not like '%suivi_has_consent%' then raise exception 'NAXA 131: partage sans consentement possible'; end if;
 if update_policy is null or update_policy not like '%suivi_has_consent%' then raise exception 'NAXA 131: réactivation de partage sans consentement possible'; end if;
 select string_agg(privilege_type,',') into privs from information_schema.role_table_grants where table_schema='public' and table_name='suivi_alerts' and grantee='authenticated';
 if privs like '%INSERT%' or privs like '%DELETE%' then raise exception 'NAXA 131: alertes modifiables par écriture arbitraire'; end if;
end;
$test$;
select true as naxa_131_consent_share_integrity_pass;
