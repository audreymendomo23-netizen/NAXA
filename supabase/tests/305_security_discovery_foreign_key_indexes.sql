-- NAXA — contrat SQL des index de clés étrangères de découverte ONVIF.
begin;
select
  exists (select 1 from pg_indexes where schemaname='public'
    and indexname='naxa_security_discovery_reviewed_by_idx')
    as reviewed_by_foreign_key_is_indexed,
  exists (select 1 from pg_indexes where schemaname='public'
    and indexname='naxa_security_discovery_camera_fk_idx')
    as camera_pharmacy_foreign_key_is_indexed,
  exists (select 1 from pg_indexes where schemaname='public'
    and indexname='naxa_security_discovery_gateway_fk_idx')
    as gateway_pharmacy_foreign_key_is_indexed;
rollback;
