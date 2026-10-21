import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const db = supabaseAdmin();
  const { data: created, error } = await db.rpc("notifier_reservations_expirant_30m");
  if (error) {
    return NextResponse.json({ error: "Rappel de réservation indisponible" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, notificationsCreated: created ?? 0, at: new Date().toISOString() });
}
