-- Test structurel NAXA 113–117 ; lecture seule, rollback systématique.
begin;
do $test$
declare
  policy_check text;
  function_config text[];
  function_source text;
  fn regprocedure;
  trigger_count integer;
begin
  if not (select relrowsecurity from pg_class where oid='public.home_service_offers'::regclass) then
    raise exception 'RLS absente home_service_offers';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.home_service_requests'::regclass) then
    raise exception 'RLS absente home_service_requests';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.home_service_request_addresses'::regclass) then
    raise exception 'RLS absente home_service_request_addresses';
  end if;

  if exists(select 1 from pg_policies where schemaname='public' and tablename='home_service_offers' and policyname='home_service_offers_partner_manage') then
    raise exception 'Ancienne politique partenaire trop permissive encore présente';
  end if;

  select with_check into policy_check from pg_policies
  where schemaname='public' and tablename='home_service_offers'
    and policyname='home_service_offers_partner_insert_draft';
  if policy_check is null or policy_check not ilike '%draft%' then
    raise exception 'Insertion partenaire non limitée aux brouillons';
  end if;

  select with_check into policy_check from pg_policies
  where schemaname='public' and tablename='home_service_offers'
    and policyname='home_service_offers_partner_update_unpublished';
  if policy_check is null or policy_check not ilike '%draft%' or policy_check not ilike '%archived%'
    or policy_check ilike '%active%' then
    raise exception 'La politique de modification partenaire permet ou ne documente pas les statuts attendus';
  end if;

  foreach fn in array array[
    to_regprocedure('public.get_home_service_catalog()'),
    to_regprocedure('public.request_home_service(uuid,text,text,text,timestamptz,text)'),
    to_regprocedure('public.get_home_service_request_receipt(uuid)'),
    to_regprocedure('public.transition_home_service_request(uuid,text)'),
    to_regprocedure('public.admin_set_home_service_offer_status(uuid,text)'),
    to_regprocedure('public.notify_home_service_request_created()'),
    to_regprocedure('public.notify_home_service_request_status()'),
    to_regprocedure('public.notify_home_service_offer_created()'),
    to_regprocedure('public.notify_home_service_offer_status()'),
    to_regprocedure('public.mark_user_notification_read(uuid)')
  ] loop
    if fn is null then raise exception 'Fonction attendue absente'; end if;
    select p.prosecdef,p.proconfig,p.prosrc into policy_check,function_config,function_source
      from pg_proc p where p.oid=fn;
    if not coalesce(policy_check::boolean,false) then
      -- Les fonctions catalogue peuvent être STABLE SECURITY DEFINER ; toutes doivent l'être pour ce lot.
      raise exception 'Fonction SECURITY DEFINER attendue: %',fn;
    end if;
    if not coalesce(function_config @> array['search_path=public, pg_temp']::text[],false) then
      raise exception 'search_path insuffisamment fixé pour %: %',fn,function_config;
    end if;
    if fn::text like '%notify_home_service_%' and
       (function_source ilike '%exact_address%' or function_source ilike '%contact_phone%') then
      raise exception 'Une notification ne doit jamais contenir les coordonnées exactes du client: %',fn;
    end if;
  end loop;

  if has_table_privilege('authenticated','public.home_service_requests','INSERT')
    or has_table_privilege('authenticated','public.home_service_requests','UPDATE')
    or has_table_privilege('authenticated','public.home_service_requests','DELETE') then
    raise exception 'Écriture directe sur home_service_requests autorisée';
  end if;
  if has_table_privilege('authenticated','public.home_service_request_addresses','INSERT')
    or has_table_privilege('authenticated','public.home_service_request_addresses','UPDATE')
    or has_table_privilege('authenticated','public.home_service_request_addresses','DELETE') then
    raise exception 'Écriture directe sur home_service_request_addresses autorisée';
  end if;
  if has_function_privilege('anon','public.mark_user_notification_read(uuid)','EXECUTE') then
    raise exception 'Le rôle anon peut marquer une notification comme lue';
  end if;
  if not has_function_privilege('authenticated','public.mark_user_notification_read(uuid)','EXECUTE') then
    raise exception 'Le rôle authenticated ne peut pas marquer sa notification comme lue';
  end if;

  select count(*) into trigger_count from pg_trigger
  where not tgisinternal and tgname in (
    'home_service_request_created_notification',
    'home_service_request_status_notification',
    'home_service_offer_created_notification',
    'home_service_offer_status_notification'
  );
  if trigger_count <> 4 then raise exception 'Déclencheurs de notification manquants : %/4',trigger_count; end if;
end;
$test$;
select true as naxa_113_117_home_services_security_pass;
rollback;
