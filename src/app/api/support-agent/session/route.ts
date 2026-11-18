import { NextResponse } from "next/server";
import { authorizeSupportAgent } from "@/lib/support/agent-auth";

export async function GET() {
  const access = await authorizeSupportAgent();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: permissions, error } = await access.db
    .from("support_agent_permissions")
    .select("permission_code,granted_at")
    .eq("agent_user_id", access.user.id)
    .is("revoked_at", null)
    .order("permission_code", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Les droits Agent sont indisponibles." }, { status: 500 });
  }

  await access.db.from("support_agents")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", access.user.id)
    .eq("status", "active");

  return NextResponse.json({
    agent: access.agent,
    permissions: (permissions ?? []).map((permission) => permission.permission_code),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
