-- NAXA 141 — contrats des RPC Caisse utilisés par les Server Actions.
do $test$
begin
 if to_regprocedure('public.naxa_provision_caisse(uuid,uuid)') is null then raise exception '141.1 naxa_provision_caisse absente'; end if;
 if to_regprocedure('public.naxa_set_caisse_status(uuid,boolean)') is null then raise exception '141.2 naxa_set_caisse_status absente'; end if;
 if to_regprocedure('public.naxa_can_manage_team_member(uuid,uuid)') is null then raise exception '141.3 naxa_can_manage_team_member absente'; end if;
 if not has_function_privilege('authenticated','public.naxa_provision_caisse(uuid,uuid)','EXECUTE') then raise exception '141.4 authenticated ne peut pas appeler la façade protégée'; end if;
 if has_function_privilege('anon','public.naxa_provision_caisse(uuid,uuid)','EXECUTE') then raise exception '141.5 anon ne peut pas provisionner une Caisse'; end if;
 if not has_function_privilege('authenticated','public.naxa_set_caisse_status(uuid,boolean)','EXECUTE') then raise exception '141.6 authenticated ne peut pas appeler la façade protégée'; end if;
 if has_function_privilege('anon','public.naxa_set_caisse_status(uuid,boolean)','EXECUTE') then raise exception '141.7 anon ne peut pas modifier le statut d’une Caisse'; end if;
end
$test$;
select 'Vérification 141 — RPC gestion Caisse : PASS' as resultat;
