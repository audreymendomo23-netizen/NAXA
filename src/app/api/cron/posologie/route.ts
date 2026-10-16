import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Schedule = {
  id: string;
  user_id: string;
  heures: string[];
  timezone: string;
  last_notified_key: string | null;
};

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Africa/Douala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NAXA_VAPID_PUBLIC_KEY;
  const privateKey = process.env.NAXA_VAPID_PRIVATE_KEY;
  if (!url || !serviceKey || !publicKey || !privateKey) {
    return NextResponse.json({ error: "Configuration serveur incomplète" }, { status: 503 });
  }

  webpush.setVapidDetails(
    process.env.NAXA_VAPID_SUBJECT || "mailto:naxa.home@gmail.com",
    publicKey,
    privateKey,
  );

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db
    .from("naxa_posologie_schedules")
    .select("id,user_id,heures,timezone,last_notified_key")
    .eq("rappels", true)
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: "Lecture des rappels impossible" }, { status: 500 });
  }

  const now = new Date();
  let due = 0;
  let sent = 0;
  let failed = 0;

  for (const schedule of (data ?? []) as Schedule[]) {
    if (!Array.isArray(schedule.heures) || schedule.heures.length === 0) continue;

    // Le déclencheur gratuit peut s'exécuter toutes les 5 minutes :
    // inspecter les 6 dernières minutes et dédupliquer sur l'heure prévue.
    const candidates = Array.from({ length: 6 }, (_, index) =>
      zonedParts(new Date(now.getTime() - index * 60_000), schedule.timezone || "Africa/Douala"),
    );
    const matched = candidates.find(candidate => schedule.heures.includes(candidate.time));
    if (!matched) continue;

    const key = `${matched.date}T${matched.time}`;
    if (schedule.last_notified_key === key) continue;
    due++;

    // Le filtre inclut explicitement NULL : neq(key) seul ne sélectionne pas les NULL.
    const { data: claimed, error: claimError } = await db
      .from("naxa_posologie_schedules")
      .update({ last_notified_key: key, updated_at: now.toISOString() })
      .eq("id", schedule.id)
      .or(`last_notified_key.is.null,last_notified_key.neq.${key}`)
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) continue;

    const { data: subscriptions, error: subscriptionError } = await db
      .from("naxa_push_subscriptions")
      .select("endpoint,subscription")
      .eq("user_id", schedule.user_id);

    if (subscriptionError || !subscriptions?.length) {
      // Permet une nouvelle tentative si la lecture échoue ou si aucun appareil n'est inscrit.
      await db.from("naxa_posologie_schedules")
        .update({ last_notified_key: null, updated_at: new Date().toISOString() })
        .eq("id", schedule.id)
        .eq("last_notified_key", key);
      if (subscriptionError) failed++;
      continue;
    }

    let sentForSchedule = 0;
    const payload = JSON.stringify({
      title: "Rappel NAXA",
      body: "Une prise prévue vous attend. Ouvrez NAXA pour consulter votre planning.",
      url: "/client/posologie",
      tag: `naxa-${schedule.id}-${key}`,
    });

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(subscription.subscription, payload, {
          TTL: 300,
          urgency: "normal",
        });
        sent++;
        sentForSchedule++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.from("naxa_push_subscriptions")
            .delete()
            .eq("endpoint", subscription.endpoint)
            .eq("user_id", schedule.user_id);
        } else {
          failed++;
        }
      }
    }

    // Si tous les envois ont échoué, libérer la clé pour retenter au prochain passage.
    if (sentForSchedule === 0) {
      await db.from("naxa_posologie_schedules")
        .update({ last_notified_key: null, updated_at: new Date().toISOString() })
        .eq("id", schedule.id)
        .eq("last_notified_key", key);
    }
  }

  return NextResponse.json({
    ok: true,
    checked: data?.length ?? 0,
    due,
    sent,
    failed,
    at: now.toISOString(),
  });
}
