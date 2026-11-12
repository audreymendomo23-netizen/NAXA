import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createDeviceToken, deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    if (!accessToken) return NextResponse.json({ error: "Jeton de session Promoteur requis." }, { status: 401 });
    const admin = supabaseAdmin();
    const { data: auth, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session NAXA invalide ou expirée." }, { status: 401 });

    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("id,role,actif").eq("id", auth.user.id).maybeSingle();
    if (profileError || profile?.role !== "promoteur" || profile.actif !== true) {
      return NextResponse.json({ error: "Un compte Promoteur actif est requis." }, { status: 403 });
    }

    const body = await request.json() as { installationId?: string; deviceName?: string };
    const installationId = String(body.installationId ?? "");
    const deviceName = String(body.deviceName ?? "NAXA Android").trim().slice(0, 100);
    if (!/^[0-9a-f-]{36}$/i.test(installationId) || deviceName.length < 2) {
      return NextResponse.json({ error: "Identité de l'installation Android invalide." }, { status: 400 });
    }

    const token = createDeviceToken();
    const { data: device, error } = await admin.from("naxa_promoteur_payment_devices").upsert({
      promoteur_id: auth.user.id,
      installation_id: installationId,
      device_name: deviceName,
      platform: "android",
      device_token_hash: hashDeviceToken(token),
      is_active: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "promoteur_id,installation_id" }).select("id,device_name").single();
    if (error || !device) {
      console.error("NAXA_PAYMENT_DEVICE_ENROLLMENT_FAILED", error);
      return NextResponse.json({ error: "Enrôlement du téléphone impossible." }, { status: 503 });
    }
    return NextResponse.json({
      deviceId: device.id,
      deviceToken: token,
      deviceName: device.device_name,
      serverTime: new Date().toISOString(),
      note: "Conservez ce jeton dans le stockage sécurisé Android. Il ne sera plus renvoyé.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Enrôlement Android indisponible." }, { status: 500 });
  }
}
