import { NextResponse } from "next/server";
import { authorizeSupportAgent } from "@/lib/support/agent-auth";

export async function GET() {
  const access = await authorizeSupportAgent("ticket_view_assigned");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: assignments, error: assignmentError } = await access.db
    .from("support_ticket_assignments")
    .select("id,ticket_id,assigned_at,assignment_source")
    .eq("agent_user_id", access.user.id)
    .is("released_at", null)
    .order("assigned_at", { ascending: false });

  if (assignmentError) {
    return NextResponse.json({ error: "Vos dossiers attribués sont indisponibles." }, { status: 500 });
  }

  const ids = (assignments ?? []).map((row) => row.ticket_id);
  if (!ids.length) return NextResponse.json({ tickets: [] });

  const { data: tickets, error } = await access.db
    .from("tickets_support")
    .select("id,reference_code,sujet,categorie,statut,created_at,last_activity_at")
    .in("id", ids)
    .eq("type", "support_naxa")
    .is("pharmacie_id", null)
    .order("last_activity_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Vos dossiers attribués sont indisponibles." }, { status: 500 });
  }

  return NextResponse.json({ tickets: tickets ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
