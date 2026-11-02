import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

async function activeAdmin() {
  const sb = supabaseServer();
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (authError || !auth.user) {
    return { ok: false as const, response: NextResponse.json({ error: "Connexion requise." }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("role,actif").eq("id", auth.user.id).maybeSingle();
  if (profileError || profile?.role !== "admin" || profile.actif !== true) {
    return { ok: false as const, response: NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 }) };
  }

  return { ok: true as const, user: auth.user };
}

export async function GET(request: Request) {
  const admin = await activeAdmin();
  if (!admin.ok) return admin.response;

  const ticketId = new URL(request.url).searchParams.get("ticket_id")?.trim() ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId)) {
    return NextResponse.json({ error: "Identifiant de ticket invalide." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: ticket, error: ticketError } = await db.from("tickets_support")
    .select("id").eq("id", ticketId).maybeSingle();
  if (ticketError) {
    return NextResponse.json({ error: "Le ticket n’a pas pu être vérifié." }, { status: 500 });
  }
  if (!ticket) {
    return NextResponse.json({ error: "Ticket introuvable ou inaccessible." }, { status: 404 });
  }

  const { data: messages, error: messagesError } = await db.from("messages_support")
    .select("id,ticket_id,auteur_profile_id,contenu,interne,created_at")
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });
  if (messagesError) {
    return NextResponse.json({ error: "L’historique de ce ticket est indisponible." }, { status: 500 });
  }

  return NextResponse.json(
    { messages: messages ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const admin = await activeAdmin();
  if (!admin.ok) return admin.response;

  let body: { ticket_id?: string; contenu?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  }
  const ticketId = String(body.ticket_id ?? "").trim();
  const contenu = String(body.contenu ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId)
    || contenu.length < 1 || contenu.length > 2000) {
    return NextResponse.json({ error: "Le ticket et un message de 1 à 2 000 caractères sont requis." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: ticket, error: ticketError } = await db.from("tickets_support")
    .select("id,statut").eq("id", ticketId).maybeSingle();
  if (ticketError || !ticket) return NextResponse.json({ error: "Ticket introuvable ou inaccessible." }, { status: 404 });
  if (ticket.statut !== "ouvert") return NextResponse.json({ error: "Ce ticket n’est plus ouvert. Aucune réponse n’a été envoyée." }, { status: 409 });

  const { error: insertError } = await db.from("messages_support").insert({
    ticket_id: ticket.id, auteur_profile_id: admin.user.id, contenu, interne: false,
  });
  if (insertError) return NextResponse.json({ error: "L’envoi a échoué. Le message n’a pas été enregistré." }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}
