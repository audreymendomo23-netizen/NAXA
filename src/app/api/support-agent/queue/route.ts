import { NextResponse } from "next/server";
import { authorizeSupportAgent } from "@/lib/support/agent-auth";

export async function GET() {
  const access = await authorizeSupportAgent("queue_view");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: assignments, error: assignmentError } = await access.db
    .from("support_ticket_assignments")
    .select("ticket_id")
    .is("released_at", null);
  if (assignmentError) {
    return NextResponse.json({ error: "La file centrale est indisponible." }, { status: 500 });
  }

  const assignedIds = (assignments ?? []).map((row) => row.ticket_id);
  let query = access.db.from("tickets_support")
    .select("id,reference_code,sujet,categorie,statut,created_at,last_activity_at")
    .eq("type", "support_naxa")
    .is("pharmacie_id", null)
    .eq("statut", "ouvert")
    .order("created_at", { ascending: true })
    .limit(100);

  if (assignedIds.length) {
    const excluded = "(" + assignedIds.join(",") + ")";
    query = query.not("id", "in", excluded);
  }

  const { data: tickets, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Les demandes en attente sont indisponibles." }, { status: 500 });
  }

  return NextResponse.json({ tickets: tickets ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
