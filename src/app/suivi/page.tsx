import { supabaseServer } from "@/lib/supabase/server";
import { UniverseLanding } from "@/components/universes/UniverseLanding";
import { SuiviConnecte } from "@/components/suivi/SuiviConnecte";

export default async function SuiviPage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return <UniverseLanding universe="suivi" comingSoon />;
  return <SuiviConnecte />;
}
