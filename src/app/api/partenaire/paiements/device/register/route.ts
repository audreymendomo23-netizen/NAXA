import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createDeviceToken, deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    if (!accessToken) return NextResponse.json({ error: "Session Partenaire requise." }, { status: 401 });
    const db = supabaseAdmin();
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session NAXA invalide ou expirée." }, { status: 401 });
    const { data: profile } = await db.from("profiles").select("id,actif").eq("id", auth.user.id).maybeSingle();
    if (profile?.actif !== true) return NextResponse.json({ error: "Compte actif requis." }, { status: 403 });

    const body = await request.json() as { installationId?: string; deviceName?: string };
    const installationId = String(body.installationId ?? "");
    const deviceName = String(body.deviceName ?? "NAXA Partenaire Android").trim().slice(0, 100);
    if (!/^[0-9a-f-]{36}$/i.test(installationId) || deviceName.length < 2) {
      return NextResponse.json({ error: "Identité de l'installation Android invalide." }, { status: 400 });
    }

    const { data: memberships, error } = await db.from("partner_members")
      .select("partner_id,member_role,partners!inner(id,name,status)")
      .eq("user_id", auth.user.id).in("member_role", ["owner", "manager"]);
    if (error) return NextResponse.json({ error: "Accès aux partenaires indisponible." }, { status: 503 });
    const active = (memberships ?? []).filter((item: any) => item.partners?.status === "active");
    if (!active.length) return NextResponse.json({ error: "Un rôle propriétaire ou gestionnaire d'un partenaire actif est requis." }, { status: 403 });

    const devices = [];
    for (const membership of active) {
      const token = createDeviceToken();
      const { data: device, error: saveError } = await db.from("naxa_partner_payment_devices").upsert({
        partner_id: membership.partner_id,
        user_id: auth.user.id,
        installation_id: installationId,
        device_name: deviceName,
        device_token_hash: hashDeviceToken(token),
        is_active: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "partner_id,user_id,installation_id" }).select("id,partner_id").single();
      if (saveError || !device) return NextResponse.json({ error: "Enrôlement du partenaire impossible." }, { status: 503 });
      devices.push({ partnerId: device.partner_id, partnerName: membership.partners.name, deviceId: device.id, deviceToken: token });
    }
    return NextResponse.json({ devices }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Enrôlement Partenaire indisponible." }, { status: 500 });
  }
}
