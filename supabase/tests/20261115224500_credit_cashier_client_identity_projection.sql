-- Vérifie la projection d'identité minimale des clients crédit par pharmacie.
begin;

do $test$
declare
  v_definition text;
  v_security_definer boolean;
begin
  if to_regprocedure('public.caisse_credit_clients_lister(uuid)') is null then
    raise exception 'RPC Caisse de projection Client crédit absente';
  end if;

  select pg_get_functiondef(p.oid),p.prosecdef
    into v_definition,v_security_definer
  from pg_proc p
  where p.oid='public.caisse_credit_clients_lister(uuid)'::regprocedure;

  if v_security_definer is not true then
    raise exception 'La projection Caisse doit utiliser une fonction SECURITY DEFINER contrôlée';
  end if;
  if position('naxa_caisse_actor_for_pharmacy' in v_definition)=0
    or position('p_pharmacie' in v_definition)=0
    or position('client_credits' in v_definition)=0
    or position('profiles' in v_definition)=0
    or position('p.role::text=''client''' in v_definition)=0
    or position('c.actif=true' in lower(regexp_replace(v_definition,'[[:space:]]+','','g')))=0
    or position('p.actif=true' in lower(regexp_replace(v_definition,'[[:space:]]+','','g')))=0 then
    raise exception 'La projection n'est pas bornée à la pharmacie, aux Clients et aux crédits actifs';
  end if;
  if has_function_privilege('anon','public.caisse_credit_clients_lister(uuid)'::regprocedure,'EXECUTE') then
    raise exception 'La projection identité Client est exécutable anonymement';
  end if;
  if not has_function_privilege('authenticated','public.caisse_credit_clients_lister(uuid)'::regprocedure,'EXECUTE') then
    raise exception 'La Caisse authentifiée ne peut pas appeler la projection Client';
  end if;
end
$test$;

rollback;
select '20261115224500_credit_cashier_client_identity_projection PASS' as resultat;
