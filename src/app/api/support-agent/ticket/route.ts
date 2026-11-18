import { NextResponse } from "next/server";
import { authorizeSupportAgent } from "@/lib/support/agent-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function hasPermission(db: ReturnType<typeof Object>, userId: string, permission: string) {
  const client = db as any;
  const { data, error } = await client.from("support_agent_permissions")
    .select("id")
    .eq("agent_user_id", userId)
    .eq("permission_code", permission)
    .is("revoked_at", null)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function GET(request: Request) {
  const access = await authorizeSupportAgent("ticket_view_assigned");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const ticketId = new URL(request.url).searchParams.get("ticket_id")?.trim() ?? "";
  if (!UUID.test(ticketId)) return NextResponse.json({ error: "Identifiant de ticket invalide." }, { status: 400 });

  const { data: assignment, error: assignmentError } = await access.db
    .from("support_ticket_assignments")
    .select("id")
    .eq("ticket_id", ticketId)
    .eq("agent_user_id", access.user.id)
    .is("released_at", null)
    .maybeSingle();
  if (assignmentError || !assignment) return NextResponse.json({ error: "Dossier non attribué à cet Agent." }, { status: 404 });

  const { data: ticket, error: ticketError } = await access.db
    .from("tickets_support")
    .select("id,reference_code,sujet,categorie,statut,created_at,last_activity_at,auteur_profile_id")
    .eq("id", ticketId)
    .eq("type", "support_naxa")
    .is("pharmacie_id", null)
    .maybeSingle();
  if (ticketError || !ticket) return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });

  const canReadInternal = await hasPermission(access.db, access.user.id, "ticket_internal_note");
  const canReadAttachments = await hasPermission(access.db, access.user.id, "attachments_read");
  let messagesQuery = access.db.from("messages_support")
    .select("id,ticket_id,auteur_profile_id,auteur_support_agent_id,contenu,interne,created_at,piece_jointe_path,piece_jointe_nom,piece_jointe_mime,piece_jointe_taille")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (!canReadInternal) messagesQuery = messagesQuery.eq("interne", false);
  const { data: messages, error: messagesError } = await messagesQuery;
  if (messagesError) return NextResponse.json({ error: "Historique du dossier indisponible." }, { status: 500 });

  const profileIds = [...new Set((messages ?? []).map((message) => message.auteur_profile_id).filter((id): id is string => Boolean(id)))];
  const agentIds = [...new Set((messages ?? []).map((message) => message.auteur_support_agent_id).filter((id): id is string => Boolean(id)))];
  const [{ data: profiles }, { data: agents }] = await Promise.all([
    profileIds.length
      ? access.db.from("profiles").select("id,first_name,last_name,role").in("id", profileIds)
      : Promise.resolve({ data: [] }),
    agentIds.length
      ? access.db.from("support_agents").select("user_id,display_name").in("user_id", agentIds)
      : Promise.resolve({ data: [] }),
  ]);
  const authorLabels = new Map<string, string>();
  (profiles ?? []).forEach((profile) => authorLabels.set(profile.id, [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Demandeur"));
  (agents ?? []).forEach((agent) => authorLabels.set(agent.user_id, agent.display_name || "Équipe NAXA"));

  const thread = await Promise.all((messages ?? []).map(async (message) => {
    let attachmentUrl: string | null = null;
    if (canReadAttachments && message.piece_jointe_path) {
      const { data } = await access.db.storage.from("naxa-support-attachments")
        .createSignedUrl(message.piece_jointe_path, 300);
      attachmentUrl = data?.signedUrl ?? null;
    }
    const authorId = message.auteur_support_agent_id || message.auteur_profile_id || "";
    return { ...message, authorLabel: authorLabels.get(authorId) || "Équipe NAXA", attachmentUrl };
  }));

  return NextResponse.json({ ticket, messages: thread }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  let body: { ticket_id?: string; contenu?: string; interne?: boolean };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  }

  const ticketId = String(body.ticket_id ?? "").trim();
  const contenu = String(body.contenu ?? "").trim();
  const interne = body.interne === true;
  if (!UUID.test(ticketId) || contenu.length < 1 || contenu.length > 2000) {
    return NextResponse.json({ error: "Le ticket et un message de 1 à 2 000 caractères sont requis." }, { status: 400 });
  }

  const access = await authorizeSupportAgent(interne ? "ticket_internal_note" : "ticket_reply");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { data: assignment, error: assignmentError } = await access.db
    .from("support_ticket_assignments")
    .select("id")
    .eq("ticket_id", ticketId)
    .eq("agent_user_id", access.user.id)
    .is("released_at", null)
    .maybeSingle();
  if (assignmentError || !assignment) return NextResponse.json({ error: "Dossier non attribué à cet Agent." }, { status: 404 });

  const { data: ticket, error: ticketError } = await access.db
    .from("tickets_support")
    .select("id,statut,type")
    .eq("id", ticketId)
    .eq("type", "support_naxa")
    .is("pharmacie_id", null)
    .maybeSingle();
  if (ticketError || !ticket) return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
  if (ticket.statut === "resolu" || ticket.statut === "ferme") {
    return NextResponse.json({ error: "Ce dossier est résolu ou clôturé." }, { status: 409 });
  }

  const { data: message, error: insertError } = await access.db
    .from("messages_support")
    .insert({
      ticket_id: ticketId,
      auteur_profile_id: null,
      auteur_support_agent_id: access.user.id,
      contenu,
      interne,
    })
    .select("id,created_at")
    .single();

  if (insertError || !message) {
    return NextResponse.json({ error: "Le message n’a pas été enregistré." }, { status: 500 });
  }

  await access.db.from("support_agent_events").insert({
    actor_user_id: access.user.id,
    agent_user_id: access.user.id,
    ticket_id: ticketId,
    event_code: interne ? "ticket_internal_note_added" : "ticket_reply_sent",
    details: { message_id: message.id },
  });

  return NextResponse.json({ success: true, message }, { status: 201 },);
}
