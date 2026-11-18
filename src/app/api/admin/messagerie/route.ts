import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUPPORT_STATUSES = new Set(["ouvert", "en_cours", "en_attente_client", "resolu", "ferme"]);

const SUPPORT_DIAGNOSTICS = process.env.NAXA_E2E_WEB_BASE_URL === "http://127.0.0.1:3000";
function supportTrace(requestId: string, stage: string, startedAt: number) {
  if (SUPPORT_DIAGNOSTICS) console.info("[support-admin]", requestId, stage, Date.now() - startedAt + "ms");
}

async function activeAdmin(requestId = "request") {
  const startedAt = Date.now();
  supportTrace(requestId, "auth:start", startedAt);
  const sb = supabaseServer();
  const { data: auth, error: authError } = await sb.auth.getUser();
  supportTrace(requestId, "auth:done", startedAt);
  if (authError || !auth.user) {
    return { ok: false as const, response: NextResponse.json({ error: "Connexion requise." }, { status: 401 }) };
  }

  supportTrace(requestId, "admin-check:start", startedAt);
  const [{ data: profile, error: profileError }, { data: activeRole, error: activeRoleError }] = await Promise.all([
    sb.from("profiles").select("role,actif").eq("id", auth.user.id).maybeSingle(),
    sb.rpc("naxa_business_function"),
  ]);
  supportTrace(requestId, "admin-check:done", startedAt);
  if (profileError || activeRoleError || profile?.role !== "admin"
    || profile.actif !== true || activeRole !== "admin") {
    return { ok: false as const, response: NextResponse.json({ error: "Accès réservé à l’espace administrateur actif." }, { status: 403 }) };
  }

  return { ok: true as const, user: auth.user };
}

export async function GET(request: Request) {
  const admin = await activeAdmin();
  if (!admin.ok) return admin.response;

  const ticketId = new URL(request.url).searchParams.get("ticket_id")?.trim() ?? "";
  if (!UUID.test(ticketId)) {
    return NextResponse.json({ error: "Identifiant de ticket invalide." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: ticket, error: ticketError } = await db.from("tickets_support")
    .select("id,type").eq("id", ticketId).maybeSingle();
  if (ticketError) {
    return NextResponse.json({ error: "Le ticket n’a pas pu être vérifié." }, { status: 500 });
  }
  if (!ticket) {
    return NextResponse.json({ error: "Ticket introuvable ou inaccessible." }, { status: 404 });
  }

  const { data: messages, error: messagesError } = await db.from("messages_support")
    .select("id,ticket_id,auteur_profile_id,contenu,interne,created_at,piece_jointe_path,piece_jointe_nom,piece_jointe_mime,piece_jointe_taille")
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });
  if (messagesError) {
    return NextResponse.json({ error: "L’historique de ce ticket est indisponible." }, { status: 500 });
  }

  const withAttachments = await Promise.all((messages ?? []).map(async (message) => {
    if (message.interne || !message.piece_jointe_path || ticket.type !== "support_naxa") {
      return { ...message, attachmentUrl: null };
    }
    const { data } = await db.storage.from("naxa-support-attachments")
      .createSignedUrl(message.piece_jointe_path, 600);
    return { ...message, attachmentUrl: data?.signedUrl ?? null };
  }));

  return NextResponse.json(
    { messages: withAttachments },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).slice(2, 10);
  const startedAt = Date.now();
  supportTrace(requestId, "post:start", startedAt);
  const admin = await activeAdmin(requestId);
  if (!admin.ok) return admin.response;

  let body: { ticket_id?: string; contenu?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  }
  const ticketId = String(body.ticket_id ?? "").trim();
  const contenu = String(body.contenu ?? "").trim();
  if (!UUID.test(ticketId) || contenu.length < 1 || contenu.length > 2000) {
    return NextResponse.json({ error: "Le ticket et un message de 1 à 2 000 caractères sont requis." }, { status: 400 });
  }

  const db = supabaseAdmin();
  supportTrace(requestId, "ticket-read:start", startedAt);
  const { data: ticket, error: ticketError } = await db.from("tickets_support")
    .select("id,statut,type,auteur_profile_id,reference_code").eq("id", ticketId).maybeSingle();
  supportTrace(requestId, "ticket-read:done", startedAt);
  if (ticketError || !ticket) return NextResponse.json({ error: "Ticket introuvable ou inaccessible." }, { status: 404 });

  if (ticket.type === "support_naxa") {
    if (!SUPPORT_STATUSES.has(ticket.statut) || ticket.statut === "ferme") {
      return NextResponse.json({ error: "Ce dossier est clôturé. Réouvrez-le avant de répondre." }, { status: 409 });
    }
  } else if (ticket.statut !== "ouvert") {
    return NextResponse.json({ error: "Ce ticket n’est plus ouvert. Aucune réponse n’a été envoyée." }, { status: 409 });
  }

  supportTrace(requestId, "message-insert:start", startedAt);
  const { error: insertError } = await db.from("messages_support").insert({
    ticket_id: ticket.id, auteur_profile_id: admin.user.id, contenu, interne: false,
  });
  supportTrace(requestId, "message-insert:done", startedAt);
  if (insertError) return NextResponse.json({ error: "L’envoi a échoué. Le message n’a pas été enregistré." }, { status: 500 });

  if (ticket.type === "support_naxa" && ticket.auteur_profile_id) {
    supportTrace(requestId, "notification-insert:start", startedAt);
    const { error: notificationError } = await db.from("notifications").insert({
      user_id: ticket.auteur_profile_id,
      type: "support_naxa_reponse",
      titre: "L’équipe NAXA vous a répondu",
      corps: "Une réponse est disponible pour votre demande " + ticket.reference_code + ".",
      related_entity_id: ticket.id,
    });
    supportTrace(requestId, "notification-insert:done", startedAt);
    if (notificationError) {
      // La réponse est déjà persistée : une panne de notification ne l'annule pas.
      console.error("support_naxa_notification_failed", notificationError.message);
    }
  }

  supportTrace(requestId, "post:done", startedAt);
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await activeAdmin();
  if (!admin.ok) return admin.response;

  let body: { ticket_id?: string; statut?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Mise à jour invalide." }, { status: 400 });
  }

  const ticketId = String(body.ticket_id ?? "").trim();
  const statut = String(body.statut ?? "").trim();
  if (!UUID.test(ticketId) || !["en_cours", "en_attente_client", "resolu", "ferme"].includes(statut)) {
    return NextResponse.json({ error: "Identifiant ou statut invalide." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: ticket, error: ticketError } = await db.from("tickets_support")
    .select("id,type,auteur_profile_id,reference_code").eq("id", ticketId).maybeSingle();
  if (ticketError || !ticket || ticket.type !== "support_naxa") {
    return NextResponse.json({ error: "Cette action est réservée aux dossiers d’assistance NAXA." }, { status: 404 });
  }

  const resolvedAt = statut === "resolu" || statut === "ferme" ? new Date().toISOString() : null;
  const { error: updateError } = await db.from("tickets_support")
    .update({ statut, resolved_at: resolvedAt, last_activity_at: new Date().toISOString() })
    .eq("id", ticket.id);
  if (updateError) {
    return NextResponse.json({ error: "Le statut n’a pas pu être modifié." }, { status: 500 });
  }

  const statusNotes: Record<string, string> = {
    en_cours: "Le dossier a été pris en charge par l’équipe NAXA.",
    en_attente_client: "L’équipe NAXA attend un complément du demandeur.",
    resolu: "L’équipe NAXA a marqué le dossier comme résolu.",
    ferme: "L’équipe NAXA a clôturé le dossier.",
  };
  const statusNote = statusNotes[statut];
  const { error: auditError } = await db.from("messages_support").insert({
    ticket_id: ticket.id,
    auteur_profile_id: admin.user.id,
    contenu: "Historique interne : " + statusNote,
    interne: true,
  });
  if (auditError) console.error("support_naxa_status_audit_failed", auditError.message);

  if (ticket.auteur_profile_id) {
    const labels: Record<string, string> = {
      en_cours: "Votre demande est prise en charge par l’équipe NAXA.",
      en_attente_client: "L’équipe NAXA attend un complément de votre part.",
      resolu: "L’équipe NAXA a marqué votre demande comme résolue.",
      ferme: "Votre demande NAXA a été clôturée.",
    };
    const { error: notificationError } = await db.from("notifications").insert({
      user_id: ticket.auteur_profile_id,
      type: "support_naxa_statut",
      titre: "Mise à jour de votre demande NAXA",
      corps: labels[statut] + " Référence : " + ticket.reference_code + ".",
      related_entity_id: ticket.id,
    });
    if (notificationError) console.error("support_naxa_status_notification_failed", notificationError.message);
  }

  return NextResponse.json({ success: true, statut }, { status: 200 });
}
