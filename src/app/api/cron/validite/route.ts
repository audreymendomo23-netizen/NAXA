import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type OutboxItem = {
  outbox_id: string;
  notification_id: string;
  user_id: string;
  email: string | null;
  title: string;
  body: string;
  attempt_count: number;
};

// Endpoint appelé par un ordonnanceur externe. Le job pg_cron existant continue
// uniquement à créer les notifications; le trigger les place dans l'outbox.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_FROM_EMAIL;
  if (!apiKey || !from) {
    return NextResponse.json(
      { error: "RESEND_API_KEY et REPORT_FROM_EMAIL doivent être configurés." },
      { status: 503 }
    );
  }

  const sb = supabaseAdmin();
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
      if (!item.email) {
        throw new Error("Aucune adresse e-mail associée au compte destinataire.");
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [item.email],
          subject: `NAXA — ${item.title}`,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>NAXA</h2><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body).replace(/\n/g, "<br>")}</p><p>Connectez-vous à votre espace NAXA pour consulter les détails.</p></div>`,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`Resend HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 500)}`);
      }
      success = true;
      providerMessageId = typeof payload?.id === "string" ? payload.id : null;
    } catch (error) {
      failure = error instanceof Error ? error.message : "Erreur inconnue de délivrance.";
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
      // Le verrou expirera après 15 minutes; la tentative sera récupérée sans
      // marquer faussement le message comme délivré.
      retried++;
      continue;
    }

    if (success) sent++;
    else if (item.attempt_count >= 5) dead++;
    else retried++;
  }

  return NextResponse.json({
    claimed: items.length,
    sent,
    retried,
    dead,
    remaining: "La file conserve les messages en attente et ceux dont le délai de reprise n'est pas écoulé.",
  });
}
