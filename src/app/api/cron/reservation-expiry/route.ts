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
  const { data: lifecycle, error: lifecycleError } = await db.rpc("reservation_lifecycle_cron");

  if (!lifecycleError) {
    const result = lifecycle as {
      ok?: boolean;
      expiration?: unknown;
      notificationsCreated?: number;
      errors?: unknown[];
      at?: string;
    } | null;

    if (!result || result.ok !== true) {
      return NextResponse.json(
        { error: "Le cycle de réservation est incomplet; une étape a échoué." },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      expiration: result.expiration,
      notificationsCreated: result.notificationsCreated ?? 0,
      at: result.at ?? new Date().toISOString(),
    });
  }

  // Compatibilité transitoire avant application de la migration 239 uniquement.
  // Ne pas rejouer les étapes si la routine existe mais signale une erreur métier.
  if (lifecycleError.code !== "PGRST202") {
    return NextResponse.json(
      { error: "Cycle de réservation indisponible; vérifier l'ordonnanceur et les fonctions SQL." },
      { status: 500 },
    );
  }

  const { data: expiry, error: expiryError } = await db.rpc("expirer_reservations_cron", { p_limit: 500 });
  if (expiryError) {
    return NextResponse.json({ error: "Expiration et restitution de stock indisponibles" }, { status: 500 });
  }
  const { data: created, error: notificationError } = await db.rpc("notifier_reservations_expirant_30m");
  if (notificationError) {
    return NextResponse.json({ error: "Rappel de réservation indisponible" }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    mode: "compatibilite_pre_migration_239",
    expiration: expiry,
    notificationsCreated: created ?? 0,
    at: new Date().toISOString(),
  });
}
