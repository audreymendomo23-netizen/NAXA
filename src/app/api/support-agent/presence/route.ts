import { NextResponse } from "next/server";
import { authorizeSupportAgent } from "@/lib/support/agent-auth";

export async function PATCH(request: Request) {
  const access = await authorizeSupportAgent();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  let body: { presence?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  }
  if (body.presence !== "available" && body.presence !== "unavailable") {
    return NextResponse.json({ error: "Présence invalide." }, { status: 400 });
  }

  const { error } = await access.db.from("support_agents")
    .update({ presence: body.presence, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", access.user.id)
    .eq("status", "active");
  if (error) return NextResponse.json({ error: "Votre présence n’a pas pu être modifiée." }, { status: 500 });

  await access.db.from("support_agent_events").insert({
    actor_user_id: access.user.id,
    agent_user_id: access.user.id,
    event_code: body.presence === "available" ? "agent_became_available" : "agent_became_unavailable",
    details: { presence: body.presence },
  });

  return NextResponse.json({ success: true, presence: body.presence });
}
