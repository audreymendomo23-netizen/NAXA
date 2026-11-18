-- The function is invoked exclusively by the admin_partner_dossiers trigger.
-- Trigger execution does not require callers to hold EXECUTE on the trigger function.
revoke all on function public.naxa_sync_partner_subscription_dossier()
  from public, anon, authenticated;
