-- NAXA 225-227 — assertions de contrat de sécurité des affectations professionnelles.
-- Test de catalogue sans données métier ni écriture sur les comptes utilisateurs.
do $test$
declare
  v_rls boolean;
  v_helper text;
  v_grant text;
  v_revoke text;
  v_policy_count integer;
  v_lot text;
begin
  if to_regclass('public.naxa_professional_assignments') is null then
    raise exception 'FAIL: table naxa_professional_assignments absente';
  end if;

  select c.relrowsecurity into v_rls
  from pg_class c where c.oid = 'public.naxa_professional_assignments'::regclass;
  if v_rls is distinct from true then
    raise exception 'FAIL: RLS doit être activé';
  end if;

  if has_table_privilege('authenticated','public.naxa_professional_assignments','INSERT')
     or has_table_privilege('authenticated','public.naxa_professional_assignments','UPDATE')
     or has_table_privilege('authenticated','public.naxa_professional_assignments','DELETE') then
    raise exception 'FAIL: authenticated possède un droit d’écriture direct';
  end if;
  if not has_table_privilege('authenticated','public.naxa_professional_assignments','SELECT') then
    raise exception 'FAIL: lecture affectations non accordée au rôle authenticated';
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname='public'
    and tablename='naxa_professional_assignments'
    and policyname='naxa_professional_assignments_participant_read'
    and cmd='SELECT';
  if v_policy_count <> 1 then
    raise exception 'FAIL: politique de lecture des participants absente';
  end if;

  select pg_get_functiondef('public.naxa_has_active_professional_assignment(uuid,uuid,text)'::regprocedure)
    into v_helper;
  if position('auth.uid()' in v_helper)=0 or position('is_admin' in v_helper)=0 then
    raise exception 'FAIL: helper sans restriction profil courant/Admin';
  end if;

  select pg_get_functiondef('public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text)'::regprocedure)
    into v_grant;
  if position('ASSIGN_USER_TO_PHARMACY' in v_grant)=0
     or position('expire_at' in v_grant)=0
     or position('p_target = v_actor' in v_grant)=0
     or position('for update' in lower(v_grant))=0
     or position('a.commence_at < p_expire_at' in v_grant)=0 then
    raise exception 'FAIL: garde de grant incomplète';
  end if;

  select pg_get_functiondef('public.naxa_revoke_professional_assignment(uuid,text)'::regprocedure)
    into v_revoke;
  if position('motif_revocation' in v_revoke)=0
     or position('revoque_par' in v_revoke)=0
     or position('revoque_at' in v_revoke)=0 then
    raise exception 'FAIL: révocation non auditée';
  end if;

  if not has_function_privilege('authenticated',
      'public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text)','EXECUTE')
     or not has_function_privilege('authenticated',
      'public.naxa_revoke_professional_assignment(uuid,text)','EXECUTE') then
    raise exception 'FAIL: RPC grant/révocation inaccessible à authenticated';
  end if;

  if has_function_privilege('anon',
      'public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text)','EXECUTE')
     or has_function_privilege('anon',
      'public.naxa_revoke_professional_assignment(uuid,text)','EXECUTE') then
    raise exception 'FAIL: RPC grant/révocation accessible à anon';
  end if;

  select pg_get_functiondef('public.stock_lot_enregistrer(uuid,uuid,text,date,integer,uuid)'::regprocedure)
    into v_lot;
  if position('naxa_has_active_professional_assignment' in v_lot)=0
     or position('v_assigned' in v_lot)=0
     or position('v_source.bloque' in v_lot)=0
     or position('v_source.quantite<p_quantite' in v_lot)=0
     or position('v_total_lots<>v_stock.quantite' in v_lot)=0 then
    raise exception 'FAIL: garde affectation ou contrôles métier de création de lot absents';
  end if;

  raise notice '225_professional_assignments_security PASS';
end
$test$;
