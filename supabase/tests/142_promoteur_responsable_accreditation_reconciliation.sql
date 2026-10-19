-- NAXA 142 — contrats RPC d’accréditation Responsable/Caisse.
do $test$
begin
 if to_regprocedure('public.accrediter_profile(uuid,uuid,smallint,uuid)') is null then raise exception '142.1 accréditer_profile absente'; end if;
 if to_regprocedure('public.accrediter_responsable(uuid,uuid)') is null then raise exception '142.2 accréditer_responsable absente'; end if;
 if has_function_privilege('anon','public.accrediter_profile(uuid,uuid,smallint,uuid)','EXECUTE') then raise exception '142.3 anon ne doit pas accréditer un profil'; end if;
 if not has_function_privilege('authenticated','public.accrediter_profile(uuid,uuid,smallint,uuid)','EXECUTE') then raise exception '142.4 authenticated doit appeler la façade contrôlée'; end if;
end
$test$;
select 'Vérification 142 — accréditation hiérarchique : PASS' as resultat;
