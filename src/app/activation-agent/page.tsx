import { redirect } from "next/navigation";
import { SupportAgentPasswordRotation } from "@/components/support/SupportAgentPasswordRotation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function SupportAgentActivationPage() {
  const sb = supabaseServer();
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (authError || !auth.user) redirect("/connexion");

  const { data: agent, error } = await sb.from("support_agents")
    .select("status,must_change_password,consent_accepted_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error || !agent || agent.status !== "active") redirect("/connexion");
  if (!agent.must_change_password && agent.consent_accepted_at) redirect("/equipe-support");

  return <SupportAgentPasswordRotation />;
}
