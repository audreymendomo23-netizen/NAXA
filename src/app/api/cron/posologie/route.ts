import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Schedule = { id: string; user_id: string; heures: string[]; timezone: string; last_notified_key: string | null };
function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { date: `${v.year}-${v.month}-${v.day}`, time: `${v.hour}:${v.minute}` };
}
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NAXA_VAPID_PUBLIC_KEY;
  const privateKey = process.env.NAXA_VAPID_PRIVATE_KEY;
  if (!url || !serviceKey || !publicKey || !privateKey) return NextResponse.json({ error: "Configuration serveur incomplète" }, { status: 503 });
  webpush.setVapidDetails("mailto:naxa.home@gmail.com", publicKey, privateKey);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("naxa_posologie_schedules").select("id,user_id,heures,timezone,last_notified_key").eq("rappels", true).limit(5000);
  if (error) return NextResponse.json({ error: "Lecture des rappels impossible" }, { status: 500 });
  const now = new Date(); let due = 0, sent = 0, failed = 0;
  for (const s of (data ?? []) as Schedule[]) {
    if (!Array.isArray(s.heures)) continue;
    const local = zonedParts(now, s.timezone || "Africa/Douala");
    if (!s.heures.includes(local.time)) continue;
    const key = `${local.date}T${local.time}`;
    if (s.last_notified_key === key) continue;
    due++;
    const { data: claimed, error: claimError } = await db.from("naxa_posologie_schedules").update({ last_notified_key: key, updated_at: now.toISOString() }).eq("id", s.id).neq("last_notified_key", key).select("id").maybeSingle();
    if (claimError || !claimed) continue;
    const { data: subs, error: subError } = await db.from("naxa_push_subscriptions").select("endpoint,subscription").eq("user_id", s.user_id);
    if (subError) { failed++; continue; }
    const payload = JSON.stringify({ title: "Rappel NAXA", body: "Une prise prévue vous attend. Ouvrez NAXA pour consulter votre planning.", url: "/client/posologie", tag: `naxa-${s.id}-${key}` });
    for (const sub of subs ?? []) {
      try { await webpush.sendNotification(sub.subscription, payload, { TTL: 300, urgency: "normal" }); sent++; }
      catch (e) { const status = (e as { statusCode?: number }).statusCode; if (status === 404 || status === 410) await db.from("naxa_push_subscriptions").delete().eq("endpoint", sub.endpoint); else failed++; }
    }
  }
  return NextResponse.json({ ok: true, checked: data?.length ?? 0, due, sent, failed, at: now.toISOString() });
}
