import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendFcmToUser } from "@/lib/firebase/fcm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type OutboxItem = {
  outbox_id: string;
  notification_id: string;
  user_id: string;
  title: string;
  body: string;
  notification_type: string;
  attempt_count: number;
};

function pushTitle(item: OutboxItem): string {
  if (item.notification_type === "message") return "NAXA · Nouveau message";
  if (item.notification_type.startsWith("delivery_")) return "NAXA · Livraison";
  return "NAXA · " + item.title;
}

function pushBody(item: OutboxItem): string {
  switch (item.notification_type) {
    case "product_availability":
      return item.body.slice(0, 180);
    case "message":
      return "Vous avez reçu un nouveau message. Ouvrez NAXA pour le consulter.";
    case "delivery_mission":
      return "Une commande préparée attend un livreur. Ouvrez NAXA pour voir la mission.";
    case "delivery_status":
    case "delivery_update":
    case "delivery_arrived":
    case "delivery_issue":
      return "Le suivi d'une livraison a été mis à jour. Ouvrez NAXA pour consulter les détails.";
    case "reservation":
    case "reservation_status":
    case "reservation_expiry_30m":
      return "Le statut de votre réservation a changé. Ouvrez NAXA pour consulter les détails.";
    default:
      return "Une opération NAXA nécessite votre attention. Ouvrez l'application pour consulter les détails.";
  }
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const candidate = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!candidate) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  let db: ReturnType<typeof supabaseAdmin>;
  try { db = supabaseAdmin(); }
  catch { return NextResponse.json({ error: "Supabase indisponible" }, { status: 503 }); }

  if (process.env.VERCEL_ENV === "production") {
    const { data, error } = await db.rpc("naxa_verify_posology_cron_secret", { p_candidate: candidate });
    if (error || data !== true) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  } else if (!process.env.CRON_SECRET || candidate !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const publicKey = process.env.NAXA_VAPID_PUBLIC_KEY;
  const privateKey = process.env.NAXA_VAPID_PRIVATE_KEY;
  const webPushReady = Boolean(publicKey && privateKey);
  if (webPushReady) {
    webpush.setVapidDetails(
      process.env.NAXA_VAPID_SUBJECT || "mailto:naxa.home@gmail.com",
      publicKey!,
      privateKey!,
    );
  }

  const { data, error } = await db.rpc("claim_notification_push_outbox", { p_limit: 50 });
  if (error) return NextResponse.json({ error: "File de notifications indisponible" }, { status: 500 });

  const items = (data ?? []) as OutboxItem[];
  let sent = 0, noDevice = 0, retried = 0, failed = 0, fcmSent = 0, webPushSent = 0;

  for (const item of items) {
    let hasDevice = false;
    let delivered = false;
    let retry = false;

    const { data: subscriptions, error: subscriptionsError } = await db
      .from("naxa_push_subscriptions")
      .select("endpoint,subscription")
      .eq("user_id", item.user_id);

    const { data: tokens, error: tokensError } = await db
      .from("naxa_fcm_tokens")
      .select("token")
      .eq("user_id", item.user_id);

    if (subscriptionsError || tokensError) {
      retry = true;
      failed++;
    } else {
      hasDevice = Boolean((subscriptions?.length ?? 0) + (tokens?.length ?? 0));
      let fcmDelivered = false;
      if ((tokens?.length ?? 0) > 0) {
        const result = await sendFcmToUser(db, item.user_id, {
          title: pushTitle(item),
          body: pushBody(item),
          url: "/notifications",
          tag: "naxa-notification-" + item.notification_id,
        });
        fcmSent += result.sent;
        if (result.sent > 0) {
          delivered = true;
          fcmDelivered = true;
        }
        if (!result.configured || (result.failed > 0 && result.sent === 0)) retry = true;
      }

      // FCM est prioritaire sur un téléphone Android enregistré. Le Web Push
      // ne sert de repli que si aucun envoi FCM n'a abouti, pour éviter le doublon.
      if (!fcmDelivered && webPushReady) {
        for (const sub of subscriptions ?? []) {
          try {
            await webpush.sendNotification(
              sub.subscription,
              JSON.stringify({
                title: pushTitle(item),
                body: pushBody(item),
                url: "/notifications",
                tag: "naxa-notification-" + item.notification_id,
                type: item.notification_type,
              }),
              { TTL: 300, urgency: "high" },
            );
            delivered = true;
            webPushSent++;
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await db.from("naxa_push_subscriptions").delete()
                .eq("endpoint", sub.endpoint).eq("user_id", item.user_id);
            } else {
              retry = true;
            }
          }
        }
      } else if (!fcmDelivered && (subscriptions?.length ?? 0) > 0 && !webPushReady) {
        retry = true;
      }

    }

    const outcome = delivered ? "sent" : retry || hasDevice ? "retry" : "no_device";
    const { data: finished, error: finishError } = await db.rpc("finish_notification_push_outbox", {
      p_outbox_id: item.outbox_id,
      p_result: outcome,
      p_error: outcome === "retry" ? "Aucun canal push n'a confirmé la réception." : null,
    });
    if (finishError || finished !== true) { failed++; continue; }
    if (outcome === "sent") sent++;
    else if (outcome === "no_device") noDevice++;
    else retried++;
  }

  return NextResponse.json({
    ok: true, claimed: items.length, sent, noDevice, retried, failed, webPushSent, fcmSent,
    at: new Date().toISOString(),
  });
}
