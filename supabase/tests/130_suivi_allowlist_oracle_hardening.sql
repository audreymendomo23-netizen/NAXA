-- Test NAXA 130 : le contrôle d’autorisation ne doit pas exposer la liste via un oracle UUID.
do $test$
declare def text;
begin
 select pg_get_functiondef('public.is_suivi_test_account(uuid)'::regprocedure) into def;
 if def not like '%p_user_id=auth.uid()%' and def not like '%p_user_id = auth.uid()%' then
   raise exception 'NAXA 130: fonction non limitée au compte courant/admin';
 end if;
 if def not like '%p.role=''admin''%' and def not like '%p.role = ''admin''%' then
   raise exception 'NAXA 130: exception administrateur explicite manquante';
 end if;
 if public.is_suivi_test_account('00000000-0000-0000-0000-000000000000'::uuid) then
   raise exception 'NAXA 130: UUID absent autorisé';
 end if;
end;
$test$;
select true as naxa_130_allowlist_oracle_hardened_pass;
