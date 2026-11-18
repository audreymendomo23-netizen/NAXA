import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export type SupportAgentPermission =
  | "queue_view"
  | "ticket_view_assigned"
  | "ticket_reply"
  | "ticket_internal_note"
  | "ticket_assign"
  | "ticket_escalate"
  | "claims_handle"
  | "attachments_read"
  | "audio_call"
  | "gmail_read"
  | "gmail_reply"
  | "reports_view";

export async function authorizeSupportAgent(permission?: SupportAgentPermission, allowPasswordRotation = false) {
  const session = supabaseServer();
  const { data: auth, error: authError } = await session.auth.getUser();
  if (authError || !auth.user) {
    return { ok: false as const, status: 401, error: "Connexion Agent requise." };
  }

  const db = supabaseAdmin();
  const { data: agent, error: agentError } = await db
    .from("support_agents")
     .select("user_id,username,first_name,last_name,display_name,status,presence,last_seen_at,must_change_password")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (agentError) {
    return { ok: false as const, status: 503, error: "Profil Agent indisponible." };
  }
  if (!agent || agent.status !== "active") {
    return { ok: false as const, status: 403, error: "Compte Agent suspendu ou non autorisé." };
  }
  if (agent.must_change_password && !allowPasswordRotation) {
    return { ok: false as const, status: 403, error: "Remplacement du mot de passe provisoire obligatoire." };
  }

  if (permission) {
    const { data: grant, error: grantError } = await db
      .from("support_agent_permissions")
      .select("id")
      .eq("agent_user_id", auth.user.id)
      .eq("permission_code", permission)
      .is("revoked_at", null)
      .maybeSingle();
    if (grantError) {
      return { ok: false as const, status: 503, error: "Permissions Agent indisponibles." };
    }
    if (!grant) {
      return { ok: false as const, status: 403, error: "Permission Agent insuffisante." };
    }
  }

  return { ok: true as const, user: auth.user, agent, db };
}
