import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    if (!accessToken) return NextResponse.json({ error: "Session NAXA requise." }, { status: 401 });
    const body = await request.json() as { deviceId?: string; deviceToken?: string; enabled?: boolean };
    const deviceId = String(body.deviceId ?? "");
    const token = String(body.deviceToken ?? "");
    if (!deviceId || token.length < 32 || typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "Choix de consentement incomplet." }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session NAXA invalide." }, { status: 401 });
    const { data: device, error: deviceError } = await db.from("naxa_payment_notification_devices")
      .select("id,user_id,workspace_type,workspace_id,device_token_hash,is_active")
      .eq("id", deviceId).eq("user_id", auth.user.id).maybeSingle();
    if (deviceError || !device || !device.is_active || device.device_token_hash !== hashDeviceToken(token)) {
      return NextResponse.json({ error: "Appareil non enrôlé ou jeton invalide." }, { status: 403 });
    }
    const { data: profile } = await db.from("profiles").select("role,actif,pharmacie_id")
      .eq("id", auth.user.id).maybeSingle();
    if (profile?.actif !== true) return NextResponse.json({ error: "Compte NAXA inactif." }, { status: 403 });
    let scopeValid = false;
    if (device.workspace_type === "admin") scopeValid = profile.role === "admin" && device.workspace_id === auth.user.id;
    else if (device.workspace_type === "pharmacie") scopeValid = profile.role === "pharmacie" && profile.pharmacie_id === device.workspace_id;
    else if (device.workspace_type === "partner") {
      const { data: membership } = await db.from("partner_members")
        .select("partner_id").eq("partner_id", device.workspace_id)
        .eq("user_id", auth.user.id).in("member_role", ["owner", "manager"]).maybeSingle();
      const { data: partner } = await db.from("partners").select("id,status")
        .eq("id", device.workspace_id).maybeSingle();
      scopeValid = Boolean(membership && partner?.status === "active");
    }
    if (!scopeValid) return NextResponse.json({ error: "Périmètre du téléphone non autorisé." }, { status: 403 });
    const { error } = await db.from("naxa_payment_notification_devices").update({
      notification_consent_at: body.enabled ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", device.id);
    if (error) return NextResponse.json({ error: "Consentement non enregistré." }, { status: 503 });
    return NextResponse.json({ saved: true, enabled: body.enabled });
  } catch {
    return NextResponse.json({ error: "Service de consentement indisponible." }, { status: 503 });
  }
}
