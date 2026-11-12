-- NAXA Comptabilité — contrat RBAC Promoteur / Comptable.
do $$
declare
  v_privilege text;
  v_manage text;
  v_read text;
  v_list text;
  v_toggle text;
begin
  if to_regclass('public.compta_droits_ecriture') is null then
    raise exception 'Table de délégation comptable absente';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.compta_droits_ecriture'::regclass) then
    raise exception 'RLS désactivée sur compta_droits_ecriture';
  end if;
  if exists(select 1 from information_schema.role_table_grants
    where table_schema='public' and table_name='compta_droits_ecriture'
      and grantee in ('anon','authenticated')) then
    raise exception 'Accès direct API non révoqué sur compta_droits_ecriture';
  end if;
  if not exists(select 1 from public.naxa_role_privileges
    where role_key='promoteur' and privilege_code='MANAGE_ACCOUNTING') then
    raise exception 'Privilège Promoteur absent';
  end if;
  if (select count(*) from public.naxa_architecture_privileges
    where role_key='promoteur' and privilege_code='MANAGE_ACCOUNTING')<>4 then
    raise exception 'Matrice Promoteur incomplète';
  end if;
  v_privilege:=pg_get_functiondef('private.naxa_has_privilege(text,uuid,text)'::regprocedure);
  v_manage:=pg_get_functiondef('public.compta_ecriture_autorisee(uuid)'::regprocedure);
  v_read:=pg_get_functiondef('public.compta_scope_autorise(uuid)'::regprocedure);
  v_list:=pg_get_functiondef('public.compta_promoteur_lister_comptables(uuid)'::regprocedure);
  v_toggle:=pg_get_functiondef('public.compta_promoteur_configurer_ecriture(uuid,uuid,boolean)'::regprocedure);
  if position('fn=''promoteur''' in v_privilege)=0
    or position('compta_droits_ecriture' in v_privilege)=0 then
    raise exception 'Règle d’accès Promoteur / Comptable absente du RBAC';
  end if;
  if position('naxa_promoteur_valide' in v_list)=0
    or position('naxa_scope_allows' in v_list)=0 then
    raise exception 'Listing non borné au réseau Promoteur';
  end if;
  if position('naxa_promoteur_valide' in v_toggle)=0
    or position('naxa_professional_assignments' in v_toggle)=0
    or position('compta_auditer' in v_toggle)=0 then
    raise exception 'Délégation non sécurisée ou non auditée';
  end if;
  if position('naxa_has_privilege' in v_manage)=0 then
    raise exception 'Contrôle du droit d’écriture absent';
  end if;
  if position('naxa_business_function(auth.uid())=''comptable''' in v_read)=0
    or position('naxa_scope_allows' in v_read)=0
    or position('naxa_has_privilege' in v_read)>0 then
    raise exception 'Lecture Comptable dépend encore du droit d’écriture';
  end if;
  raise notice 'PASS RBAC comptabilité : Promoteur permanent, Comptable délégué, lecture conservée, délégation auditée';
end $$;
select '202611121_compta_droits_ecriture_contract PASS' as resultat;
