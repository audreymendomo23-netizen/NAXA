-- NAXA — le RPC de géolocalisation service_role appelle le garde interne.
-- Aucun droit n'est accordé à anon ou authenticated.
grant execute on function private.naxa_partner_has_active_independent_agreement(uuid,uuid) to service_role;
