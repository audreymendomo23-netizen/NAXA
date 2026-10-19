-- NAXA 143 — schéma et confidentialité du journal d’accréditation.
do $test$
begin
 if to_regclass('public.profile_accreditations') is null then raise exception '143.1 journal absent'; end if;
 if not (select relrowsecurity from pg_class where oid='public.profile_accreditations'::regclass) then raise exception '143.2 RLS absente'; end if;
 if not has_table_privilege('authenticated','public.profile_accreditations','SELECT') then raise exception '143.3 lecture contrôlée absente'; end if;
 if has_table_privilege('anon','public.profile_accreditations','SELECT') then raise exception '143.4 anon ne doit pas lire le journal'; end if;
end
$test$;
select 'Vérification 143 — journal accréditation : PASS' as resultat;
