-- NAXA Comptable — étape 10 : garde-fous de recette avant E2E.
-- Test structurel transactionnel : aucun seed métier ou utilisateur persistant.
begin;

do $test$
declare
  v_table text;
  v_trigger_count integer;
  v_proc oid;
  v_def text;
begin
  -- Les écritures et leurs lignes doivent être immuables : correction par contrepassation.
  foreach v_table in array array['compta_ecriture','compta_ligne','compta_audit'] loop
    select count(*) into v_trigger_count
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname=v_table
      and not t.tgisinternal
      and t.tgname in ('compta_ecriture_immutable','compta_ligne_immutable','compta_audit_immutable');
    if v_trigger_count < 1 then
      raise exception 'FAIL: garde d''immutabilité absente pour %', v_table;
    end if;
  end loop;

  -- L'équilibre de la partie double est contrôlé en contrainte différée.
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('compta_ecriture','compta_ligne')
      and not t.tgisinternal and t.tgname='compta_ecriture_balance_deferred'
  ) or not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='compta_ligne'
      and not t.tgisinternal and t.tgname='compta_ligne_balance_deferred'
  ) then
    raise exception 'FAIL: garde différée de partie double absente';
  end if;

  -- Les tables sensibles ne doivent pas autoriser l'écriture directe authentifiée.
  foreach v_table in array array['compta_ecriture','compta_ligne','compta_audit','compta_evenement','compta_periodes','compta_controles_cloture'] loop
    if has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') then
      raise exception 'FAIL: écriture directe authenticated sur %', v_table;
    end if;
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table and c.relrowsecurity
    ) then
      raise exception 'FAIL: RLS désactivée sur %', v_table;
    end if;
  end loop;

  -- La clôture et l'ouverture restent des opérations serveur, pas des actions du poste Comptable.
  select p.oid into v_proc
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='compta_cloturer_periode'
    and pg_get_function_identity_arguments(p.oid)='p_pharmacie uuid, p_periode uuid, p_acteur uuid';
  if v_proc is null or has_function_privilege('authenticated',v_proc,'EXECUTE')
     or not has_function_privilege('service_role',v_proc,'EXECUTE') then
    raise exception 'FAIL: séparation de privilèges clôture';
  end if;

  select p.oid into v_proc
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='compta_ouvrir_periode'
    and pg_get_function_identity_arguments(p.oid)='p_pharmacie uuid, p_date_debut date, p_date_fin date, p_acteur uuid';
  if v_proc is null or has_function_privilege('authenticated',v_proc,'EXECUTE')
     or not has_function_privilege('service_role',v_proc,'EXECUTE') then
    raise exception 'FAIL: séparation de privilèges ouverture';
  end if;

  -- Aucune source métier confirmée de paie ou d'immobilisations n'est inventée pour certifier une clôture.
  if exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE'
      and (table_name ilike '%immobilis%' or table_name ilike '%amortiss%')
  ) then
    raise notice 'INFO: table immobilisation/amortissement détectée ; vérifier son mapping avant clôture';
  else
    raise notice 'BLOCKED: source immobilisations/amortissements absente ; la recette positive de clôture complète reste bloquée';
  end if;
  if exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE'
      and (table_name ilike '%bulletin_paie%' or table_name ilike '%paie_salar%' or table_name ilike '%payroll%')
  ) then
    raise notice 'INFO: source paie détectée ; vérifier son mapping avant clôture';
  else
    raise notice 'BLOCKED: source de paie absente ; la recette positive de clôture complète reste bloquée';
  end if;
end
$test$;

select 'PASS 171_compta_recette_etape10_hardening' as result;
rollback;
