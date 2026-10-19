import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { SuiviConnecte } from "@/components/suivi/SuiviConnecte";

export default async function SuiviPage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?next=%2Fsuivi");
  return <SuiviConnecte />;
}
