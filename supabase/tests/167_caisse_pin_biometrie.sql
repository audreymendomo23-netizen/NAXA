begin;
do $test$
declare
 v_legacy text; v_current text; v_user uuid; v_attempt integer; v_locked timestamptz; v_i integer;
begin
 if to_regclass('public.caisse_security_credentials') is null or to_regclass('public.caisse_security_challenges') is null or to_regclass('public.caisse_decaissement_auth_grants') is null then
  raise exception 'Tables de sécurité PIN/biométrie/autorisation manquantes';
 end if;
 select pg_get_functiondef(p.oid) into v_current from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='caisse_decaisser' and p.pronargs=6;
 select pg_get_functiondef(p.oid) into v_legacy from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='caisse_decaisser' and p.pronargs=5;
 if v_current is null or position('p_auth_grant' in lower(v_current))=0 or position('consumed_at' in lower(v_current))=0 then raise exception 'RPC sécurisée sans contrôle du grant à usage unique'; end if;
 if v_legacy is null or position('autorisation pin ou biométrique obligatoire' in lower(v_legacy))=0 then raise exception 'Ancienne RPC de décaissement non neutralisée'; end if;
 if has_function_privilege('authenticated','public.caisse_decaisser(uuid,integer,text,text,text)','EXECUTE') then raise exception 'Ancienne RPC encore exécutable'; end if;
 if not has_function_privilege('authenticated','public.caisse_decaisser(uuid,integer,text,text,text,uuid)','EXECUTE') then raise exception 'RPC avec autorisation inaccessible au compte authentifié'; end if;
 if has_table_privilege('authenticated','public.caisse_security_credentials','SELECT') or has_table_privilege('anon','public.caisse_security_credentials','SELECT') then raise exception 'Les identifiants de sécurité sont lisibles directement'; end if;
 if to_regprocedure('public.caisse_pin_register_failure(uuid)') is null or to_regprocedure('public.caisse_pin_reset_failures(uuid)') is null then
  raise exception 'RPC atomiques de verrouillage PIN manquantes';
 end if;
 if has_function_privilege('authenticated','public.caisse_pin_register_failure(uuid)','EXECUTE')
    or has_function_privilege('anon','public.caisse_pin_register_failure(uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.caisse_pin_register_failure(uuid)','EXECUTE') then
  raise exception 'Les compteurs PIN atomiques ne sont pas réservés au serveur';
 end if;
 select id into v_user from auth.users limit 1;
 if v_user is null then raise exception 'Utilisateur de test absent pour le verrouillage PIN'; end if;
 insert into public.caisse_security_credentials(user_id,pin_failed_attempts,pin_locked_until)
 values(v_user,0,null)
 on conflict(user_id) do update set pin_failed_attempts=0,pin_locked_until=null;
 for v_i in 1..5 loop
  select attempts,locked_until into v_attempt,v_locked
  from public.caisse_pin_register_failure(v_user);
  if v_attempt <> v_i then raise exception 'Compteur PIN non atomique à la tentative %',v_i; end if;
 end loop;
 if v_locked is null or v_locked <= now() then raise exception 'Le verrouillage 15 minutes n’est pas appliqué à la 5e tentative'; end if;
 perform public.caisse_pin_reset_failures(v_user);
 if exists(select 1 from public.caisse_security_credentials where user_id=v_user and (pin_failed_attempts<>0 or pin_locked_until is not null)) then
  raise exception 'La remise à zéro du compteur PIN a échoué';
 end if;
end
$test$;
select '167_caisse_security_guard PASS' as resultat;
rollback;
