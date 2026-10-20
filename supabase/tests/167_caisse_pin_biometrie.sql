begin;
do $test$
declare
 v_legacy text; v_current text;
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
end
$test$;
select '167_caisse_security_guard PASS' as resultat;
rollback;
