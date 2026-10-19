-- NAXA 148 — tests SQL structurels du catalogue polyvalent.
do $$
declare
  n integer;
  modes_ok boolean;
  metadata_ok boolean;
  family_ok boolean;
begin
  select cardinality(array[
    'tensiometre','thermometre','oxymetre','glucometre','balance',
    'capteur_cardiaque_bluetooth','podometre','ecg','spirometre','peak_flow',
    'balance_impedance','cholesterolometre','cetonemetre','uricometre',
    'montre_connectee','bracelet_activite','tracker_sommeil',
    'thermometre_infrarouge','capteur_respiration','pilulier_connecte',
    'bouteille_hydratation'
  ]) into n;
  if n <> 21 then raise exception 'Expected 21 device definitions, got %', n; end if;

  select exists (
    select 1 from pg_constraint
    where conrelid='public.suivi_user_devices'::regclass
      and conname='suivi_user_devices_connection_mode_check'
      and pg_get_constraintdef(oid) like '%manual%'
      and pg_get_constraintdef(oid) like '%bluetooth%'
      and pg_get_constraintdef(oid) like '%scan%'
      and pg_get_constraintdef(oid) like '%hybrid%'
  ) into modes_ok;
  if not modes_ok then raise exception 'Device connection modes not fully enabled'; end if;

  select count(*) = 5 from information_schema.columns
   where table_schema='public' and table_name='suivi_user_devices'
     and column_name in ('device_brand','device_model','protocol','last_sync_at','capabilities')
  into metadata_ok;
  if not metadata_ok then raise exception 'Device interoperability metadata missing'; end if;

  select public.suivi_device_family('pilulier_connecte')='traitements'
     and public.suivi_device_family('bouteille_hydratation')='activite'
     and public.suivi_device_family('ecg')='constantes'
  into family_ok;
  if not family_ok then raise exception 'Device family mapping incorrect'; end if;
end $$;
select 'naxa_148_device_interoperability_pass' as test, true as passed;