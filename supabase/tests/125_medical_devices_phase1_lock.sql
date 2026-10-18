-- Test structurel NAXA 125 : verrouillage DB de l’univers Dispositifs médicaux.
-- Lecture seule ; ne modifie aucune donnée métier.
do $test$
declare
  trigger_count integer;
  guard_def text;
  universe_enabled boolean;
  flag_enabled boolean;
  enabled_associations integer;
  universe_name text;
begin
  select count(*) into trigger_count
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and not t.tgisinternal
    and t.tgname in (
      'guard_medical_devices_universe_phase1',
      'guard_medical_devices_flag_phase1',
      'guard_medical_devices_partner_universe_phase1',
      'guard_medical_devices_product_phase1'
    );
  if trigger_count <> 4 then
    raise exception 'NAXA 125 : quatre déclencheurs de verrouillage attendus, trouvés %', trigger_count;
  end if;

  select pg_get_functiondef('public.guard_medical_devices_phase1()'::regprocedure)
  into guard_def;
  if guard_def not like '%Dispositifs médicaux reste désactivé en phase 1%'
     or guard_def not like '%Association partenaire Dispositifs médicaux interdite en phase 1%'
     or guard_def not like '%Publication de dispositifs médicaux interdite en phase 1%' then
    raise exception 'NAXA 125 : règles de verrouillage incomplètes';
  end if;

  select enabled, name into universe_enabled, universe_name
  from public.universes where slug = 'suivi';
  if not found or universe_enabled is distinct from false or universe_name <> 'Dispositifs médicaux' then
    raise exception 'NAXA 125 : univers absent, mal nommé ou activé';
  end if;

  select enabled into flag_enabled
  from public.feature_flags where flag_key = 'universe.suivi';
  if not found or flag_enabled is distinct from false then
    raise exception 'NAXA 125 : indicateur universe.suivi absent ou activé';
  end if;

  select count(*) into enabled_associations
  from public.partner_universes where universe_slug = 'suivi' and enabled = true;
  if enabled_associations <> 0 then
    raise exception 'NAXA 125 : % associations partenaires encore activées', enabled_associations;
  end if;
end;
$test$;

select true as naxa_125_medical_devices_phase1_lock_pass;
