import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LegacyOutboxItem = {
  outbox_id: string;
  email: string | null;
  title: string;
  body: string;
  attempt_count: number;
};

type UniversalOutboxItem = {
  outbox_id: string;
  event_key: string;
  event_type: string;
  universe: string;
  recipient_email: string;
  subject: string;
  text_body: string;
  attempt_count: number;
};

type DeliveryResult = "sent" | "retried" | "dead";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderEmailHtml = (value: string) => {
  const escaped = escapeHtml(value);
  const linked = escaped.replace(
    /(https:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#176b45;text-decoration:underline">$1</a>'
  );
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
    <h2 style="color:#176b45">NAXA</h2>
    <p>${linked.replace(/\n/g, "<br>")}</p>
  </div>`;
};

async function deliverEmail(
  googleUrl: string,
  googleSecret: string,
  item: {
    outboxId: string;
    idempotencyKey: string;
    email: string | null;
    subject: string;
    text: string;
  }
): Promise<{ success: boolean; error: string }> {
  try {
    if (!item.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) {
      throw new Error("Adresse e-mail destinataire absente ou invalide.");
    }

    const safeSubject = item.subject.slice(0, 180);
    const safeText = item.text.slice(0, 10000);
    const response = await fetch(googleUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: googleSecret,
        idempotencyKey: item.idempotencyKey,
        to: item.email,
        subject: safeSubject,
        text: safeText,
        html: renderEmailHtml(safeText),
      }),
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.sent !== true || typeof payload?.alreadySent !== "boolean") {
      throw new Error(`Google Apps Script HTTP ${response.status}: réponse invalide ou envoi non confirmé.`);
    }
    return { success: true, error: "" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue de délivrance Google.",
    };
  }
}

async function finishLegacy(
  sb: ReturnType<typeof supabaseAdmin>,
  item: LegacyOutboxItem,
  success: boolean,
  error: string
): Promise<DeliveryResult | null> {
  const { data, error: finishError } = await sb.rpc("finish_notification_email_outbox", {
    p_outbox_id: item.outbox_id,
    p_success: success,
    p_provider_message_id: null,
    p_error: error || null,
  });
  if (finishError || data !== true) return null;
  if (success) return "sent";
  return item.attempt_count >= 5 ? "dead" : "retried";
}

async function finishUniversal(
  sb: ReturnType<typeof supabaseAdmin>,
  item: UniversalOutboxItem,
  success: boolean,
  error: string
): Promise<DeliveryResult | null> {
  const { data, error: finishError } = await sb.rpc("finish_naxa_email_event", {
    p_outbox_id: item.outbox_id,
    p_success: success,
    p_provider_message_id: null,
    p_error: error || null,
  });
  if (finishError || data !== true) return null;
  if (success) return "sent";
  return item.attempt_count >= 5 ? "dead" : "retried";
}

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
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "script.google.com" ||
      !/^\/macros\/s\/[^/]+\/exec$/.test(parsedUrl.pathname)) {
    return NextResponse.json({ error: "L'URL doit être une URL HTTPS Google Apps Script officielle." }, { status: 503 });
  }

  const sb = supabaseAdmin();
  const syncErrors: string[] = [];
  let partnerExpired = 0;
  let partnerReminders = 0;
  let invitationReminders = 0;
  let agreementReminders = 0;

  // Les synchronisations métier sont indépendantes : une panne d'un univers
  // ne doit pas empêcher la distribution des e-mails déjà mis en file.
  const syncJobs = [
    "synchroniser_validite_pharmacies",
    "synchroniser_validite_abonnements_partenaires",
    "emettre_rappels_abonnements_partenaires_5j",
    "emettre_rappels_invitations_email",
    "emettre_rappels_conventions_prestations_email",
  ] as const;

  for (const jobName of syncJobs) {
    const { data, error } = await sb.rpc(jobName);
    if (error) {
      syncErrors.push(jobName);
      continue;
    }
    if (jobName === "synchroniser_validite_abonnements_partenaires") {
      partnerExpired = Number(data ?? 0);
    } else if (jobName === "emettre_rappels_abonnements_partenaires_5j") {
      partnerReminders = Number(data ?? 0);
    } else if (jobName === "emettre_rappels_invitations_email") {
      invitationReminders = Number(data ?? 0);
    } else if (jobName === "emettre_rappels_conventions_prestations_email") {
      agreementReminders = Number(data ?? 0);
    }
  }

  let claimed = 0;
  let sent = 0;
  let retried = 0;
  let dead = 0;
  const deliveryErrors: string[] = [];

  // Compatibilité : l'outbox historique Promoteur/Admin continue d'être vidée.
  const { data: legacyData, error: legacyClaimError } = await sb.rpc(
    "claim_notification_email_outbox", { p_limit: 25 }
  );
  if (legacyClaimError) {
    deliveryErrors.push("legacy_outbox_claim");
  } else {
    const legacyItems = (legacyData ?? []) as LegacyOutboxItem[];
    claimed += legacyItems.length;
    for (const item of legacyItems) {
      const result = await deliverEmail(googleUrl, googleSecret, {
        outboxId: item.outbox_id,
        idempotencyKey: `naxa-notification-${item.outbox_id}`,
        email: item.email,
        subject: `NAXA — ${item.title}`,
        text: item.body,
      });
      const final = await finishLegacy(sb, item, result.success, result.error);
      if (final === "sent") sent++;
      else if (final === "dead") dead++;
      else retried++;
    }
  }

  // Nouvelle outbox : destinataires avec ou sans compte NAXA.
  const { data: universalData, error: universalClaimError } = await sb.rpc(
    "claim_naxa_email_events", { p_limit: 25 }
  );
  if (universalClaimError) {
    deliveryErrors.push("universal_outbox_claim");
  } else {
    const universalItems = (universalData ?? []) as UniversalOutboxItem[];
    claimed += universalItems.length;
    for (const item of universalItems) {
      const result = await deliverEmail(googleUrl, googleSecret, {
        outboxId: item.outbox_id,
        idempotencyKey: `naxa-email-event-${item.outbox_id}`,
        email: item.recipient_email,
        subject: item.subject,
        text: item.text_body,
      });
      const final = await finishUniversal(sb, item, result.success, result.error);
      if (final === "sent") sent++;
      else if (final === "dead") dead++;
      else retried++;
    }
  }

  const hasErrors = syncErrors.length > 0 || deliveryErrors.length > 0;
  return NextResponse.json({
    partnerExpired,
    partnerReminders,
    invitationReminders,
    agreementReminders,
    claimed,
    sent,
    retried,
    dead,
    syncErrors,
    deliveryErrors,
  }, { status: hasErrors ? 207 : 200 });
}
