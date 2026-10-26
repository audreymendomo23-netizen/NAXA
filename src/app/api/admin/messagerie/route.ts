import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("role,actif").eq("id", auth.user.id).maybeSingle();
  if (profileError || profile?.role !== "admin" || profile.actif === false) {
    return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  }
  let body: { ticket_id?: string; contenu?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  }
  const ticketId = String(body.ticket_id ?? "").trim();
  const contenu = String(body.contenu ?? "").trim();
  if (!ticketId || contenu.length < 1 || contenu.length > 2000) {
    return NextResponse.json({ error: "Le ticket et un message de 1 à 2 000 caractères sont requis." }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { data: ticket, error: ticketError } = await db.from("tickets_support")
    .select("id,statut").eq("id", ticketId).maybeSingle();
  if (ticketError || !ticket) return NextResponse.json({ error: "Ticket introuvable ou inaccessible." }, { status: 404 });
  if (ticket.statut !== "ouvert") return NextResponse.json({ error: "Ce ticket n’est plus ouvert. Aucune réponse n’a été envoyée." }, { status: 409 });
  const { error: insertError } = await db.from("messages_support").insert({
    ticket_id: ticket.id, auteur_profile_id: auth.user.id, contenu, interne: false,
  });
  if (insertError) return NextResponse.json({ error: "L’envoi a échoué. Le message n’a pas été enregistré." }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}
