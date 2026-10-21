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
  const { data: expiry, error: expiryError } = await db.rpc("expirer_reservations_cron", { p_limit: 500 });
  if (expiryError) {
    return NextResponse.json({ error: "Expiration et restitution de stock indisponibles" }, { status: 500 });
  }
  const { data: created, error } = await db.rpc("notifier_reservations_expirant_30m");
  if (error) {
    return NextResponse.json({ error: "Rappel de réservation indisponible" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, expiration: expiry, notificationsCreated: created ?? 0, at: new Date().toISOString() });
}
