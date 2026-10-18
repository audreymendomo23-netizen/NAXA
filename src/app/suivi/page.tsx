import { supabaseServer } from "@/lib/supabase/server";
import { UniverseLanding } from "@/components/universes/UniverseLanding";
import { SuiviConnecte } from "@/components/suivi/SuiviConnecte";

export default async function SuiviPage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return <UniverseLanding universe="suivi" comingSoon />;
  const { data: allowed, error } = await sb.rpc("is_suivi_test_account", { p_user_id: auth.user.id });
  if (error || allowed !== true) return <UniverseLanding universe="suivi" comingSoon />;
  return <SuiviConnecte />;
}
