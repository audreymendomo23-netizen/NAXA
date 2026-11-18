import { NextResponse } from "next/server";
import { authorizeSupportAgent } from "@/lib/support/agent-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const access = await authorizeSupportAgent("queue_view");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let body: { ticket_id?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  }

  const ticketId = String(body.ticket_id ?? "").trim();
  if (!UUID.test(ticketId)) {
    return NextResponse.json({ error: "Identifiant de ticket invalide." }, { status: 400 });
  }

  const { data, error } = await access.db.rpc("support_agent_claim_ticket", {
    p_agent_user_id: access.user.id,
    p_ticket_id: ticketId,
  });

  if (error) {
    const status = error.code === "23505" ? 409 : error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: "La prise en charge a été refusée : " + error.message }, { status });
  }

  return NextResponse.json({ success: true, assignment: Array.isArray(data) ? data[0] : data }, {
    status: 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
