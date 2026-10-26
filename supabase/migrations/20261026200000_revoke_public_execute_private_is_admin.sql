begin;

-- Keep the internal SECURITY DEFINER helper callable only by trusted application
-- roles. RLS and RPC callers run as authenticated; backend maintenance may use service_role.
revoke all on function private.is_admin() from public;
revoke all on function private.is_admin() from anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_admin() to service_role;

commit;
