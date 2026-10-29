import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OutboxItem = {
  outbox_id: string;
  notification_id: string;
  user_id: string;
  email: string | null;
  title: string;
  body: string;
  attempt_count: number;
};

// Le job pg_cron crée les notifications; le trigger les place dans l'outbox.
// Cette route ne fait que synchroniser les validités et déléguer l'e-mail à Google.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const googleUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const googleSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (!googleUrl || !googleSecret) {
    return NextResponse.json(
      { error: "GOOGLE_APPS_SCRIPT_URL et GOOGLE_APPS_SCRIPT_SECRET doivent être configurés." },
      { status: 503 }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(googleUrl);
  } catch {
    return NextResponse.json({ error: "URL Google Apps Script invalide." }, { status: 503 });
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "script.google.com") {
    return NextResponse.json({ error: "L'URL doit être une URL HTTPS Google Apps Script officielle." }, { status: 503 });
  }

  const sb = supabaseAdmin();
  const { error: syncError } = await sb.rpc("synchroniser_validite_pharmacies");
  if (syncError) {
    return NextResponse.json({ error: "Échec de synchronisation des validités." }, { status: 500 });
  }

  const { data, error } = await sb.rpc("claim_notification_email_outbox", { p_limit: 25 });
  if (error) {
    return NextResponse.json({ error: "Impossible de réclamer la file e-mail." }, { status: 500 });
  }

  const items = (data ?? []) as OutboxItem[];
  let sent = 0;
  let retried = 0;
  let dead = 0;

  for (const item of items) {
    let success = false;
    let providerMessageId: string | null = null;
    let failure = "";

    try {
      if (!item.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) {
        throw new Error("Adresse e-mail destinataire absente ou invalide.");
      }

      const response = await fetch(googleUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: googleSecret,
          idempotencyKey: item.outbox_id,
          to: item.email,
          subject: `NAXA — ${item.title}`,
          text: item.body,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>NAXA</h2><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body).replace(/\n/g, "<br>")}</p><p>Connectez-vous à votre espace NAXA pour consulter les détails.</p></div>`,
        }),
        redirect: "follow",
        signal: AbortSignal.timeout(25000),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok !== true || payload?.idempotent !== true) {
        throw new Error(`Google Apps Script HTTP ${response.status}: réponse invalide ou envoi non confirmé.`);
      }
      success = true;
      providerMessageId = typeof payload.messageId === "string" ? payload.messageId : item.outbox_id;
    } catch (error) {
      failure = error instanceof Error ? error.message : "Erreur inconnue de délivrance Google.";
    }

    const { data: finished, error: finishError } = await sb.rpc(
      "finish_notification_email_outbox",
      {
        p_outbox_id: item.outbox_id,
        p_success: success,
        p_provider_message_id: providerMessageId,
        p_error: failure || null,
      }
    );

    if (finishError || finished !== true) {
      retried++;
      continue;
    }

    if (success) sent++;
    else if (item.attempt_count >= 5) dead++;
    else retried++;
  }

  return NextResponse.json({ claimed: items.length, sent, retried, dead });
}

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
