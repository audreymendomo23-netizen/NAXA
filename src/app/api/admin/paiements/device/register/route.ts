import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createDeviceToken, deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    if (!accessToken) return NextResponse.json({ error: "Session Administrateur requise." }, { status: 401 });
    const admin = supabaseAdmin();
    const { data: auth, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session NAXA invalide ou expiree." }, { status: 401 });

    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("id,role,actif").eq("id", auth.user.id).maybeSingle();
    if (profileError || profile?.role !== "admin" || profile.actif !== true) {
      return NextResponse.json({ error: "Un compte Administrateur actif est requis." }, { status: 403 });
    }

    const body = await request.json() as { installationId?: string; deviceName?: string; canal?: string };
    const installationId = String(body.installationId ?? "");
    const deviceName = String(body.deviceName ?? "NAXA Admin Android").trim().slice(0, 100);
    const canal = String(body.canal ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(installationId) || deviceName.length < 2 ||
        !["orange_money", "mtn_momo"].includes(canal)) {
      return NextResponse.json({ error: "Identite du telephone ou canal marchand invalide." }, { status: 400 });
    }

    const { data: destination, error: destinationError } = await admin.from("naxa_payment_destinations")
      .select("canal,beneficiaire,reference_destination,updated_at")
      .eq("canal", canal).eq("actif", true).maybeSingle();
    if (destinationError || !destination?.reference_destination) {
      return NextResponse.json({ error: "Aucune destination marchande active n'est configuree pour ce canal." }, { status: 409 });
    }

    const token = createDeviceToken();
    const { data: device, error } = await admin.from("naxa_admin_payment_devices").upsert({
      admin_id: auth.user.id,
      installation_id: installationId,
      device_name: deviceName,
      canal,
      merchant_reference: destination.reference_destination,
      device_token_hash: hashDeviceToken(token),
      is_active: true,
      paired_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "admin_id,installation_id,canal" })
      .select("id,device_name,canal,merchant_reference").single();

    if (error || !device) {
      console.error("NAXA_ADMIN_PAYMENT_DEVICE_ENROLLMENT_FAILED", error?.message ?? "missing row");
      return NextResponse.json({ error: "Enrolement du telephone Admin impossible." }, { status: 503 });
    }

    return NextResponse.json({
      deviceId: device.id,
      deviceToken: token,
      deviceName: device.device_name,
      canal: device.canal,
      merchantReference: device.merchant_reference,
      serverTime: new Date().toISOString(),
      note: "Le jeton est affiche une seule fois. Conservez-le dans le stockage chiffre Android.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Enrolement du telephone Admin indisponible." }, { status: 503 });
  }
}
