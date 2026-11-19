import { NextResponse } from "next/server";
import { authorizeSupportAgent } from "@/lib/support/agent-auth";

export async function GET() {
  const access = await authorizeSupportAgent("audio_call");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const now = new Date().toISOString();
  const db = access.db;
  const [queued, assigned, fallback] = await Promise.all([
    db.from("support_calls").select("id,ticket_id,requester_user_id,status,fallback_at,created_at")
      .eq("status", "queued").order("created_at", { ascending: true }).limit(20),
    db.from("support_calls").select("id,ticket_id,requester_user_id,status,fallback_at,created_at")
      .eq("status", "ringing").eq("agent_user_id", access.user.id).order("created_at", { ascending: true }).limit(20),
    db.from("support_calls").select("id,ticket_id,requester_user_id,status,fallback_at,created_at")
      .eq("status", "ringing").lte("fallback_at", now).order("created_at", { ascending: true }).limit(20),
  ]);
  const error = queued.error || assigned.error || fallback.error;
  if (error) return NextResponse.json({ error: "La file d’appels est indisponible." }, { status: 503 });
  const unique = new Map<string, (typeof queued.data)[number]>();
  [...(queued.data ?? []), ...(assigned.data ?? []), ...(fallback.data ?? [])]
    .forEach((call) => unique.set(call.id, call));
  const calls = [...unique.values()];
  const ids = [...new Set(calls.map((call) => call.ticket_id))];
  const { data: tickets, error: ticketError } = ids.length
    ? await db.from("tickets_support").select("id,reference_code,sujet,statut").in("id", ids)
    : { data: [], error: null };
  if (ticketError) return NextResponse.json({ error: "Les dossiers d’appels sont indisponibles." }, { status: 503 });
  const byId = new Map((tickets ?? []).map((ticket) => [ticket.id, ticket]));
  return NextResponse.json({
    calls: calls.filter((call) => byId.has(call.ticket_id))
      .map((call) => ({ ...call, ticket: byId.get(call.ticket_id) })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
