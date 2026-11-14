-- NAXA — le helper partenaire est interne : aucun droit hérité de PUBLIC/anon.
begin;
revoke all on function private.naxa_partner_business_function(uuid) from public,anon;
grant execute on function private.naxa_partner_business_function(uuid) to authenticated,service_role;
commit;
