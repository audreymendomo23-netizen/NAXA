import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createDeviceToken, deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    if (!accessToken) return NextResponse.json({ error: "Session NAXA requise." }, { status: 401 });
    const db = supabaseAdmin();
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session NAXA invalide ou expirée." }, { status: 401 });
    const body = await request.json() as {
      workspace?: string; partnerId?: string; installationId?: string; deviceName?: string;
      notificationConsent?: boolean;
    };
    const workspace = String(body.workspace ?? "");
    const partnerId = String(body.partnerId ?? "").trim();
    const installationId = String(body.installationId ?? "");
    const deviceName = String(body.deviceName ?? "NAXA Android").trim().slice(0, 100);
    if (!/^[0-9a-f-]{36}$/i.test(installationId) || deviceName.length < 2 ||
        !["pharmacie", "partner", "admin"].includes(workspace)) {
      return NextResponse.json({ error: "Identité du téléphone ou espace invalide." }, { status: 400 });
    }
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("id,role,actif,pharmacie_id").eq("id", auth.user.id).maybeSingle();
    if (profileError || !profile || profile.actif !== true) return NextResponse.json({ error: "Compte NAXA inactif." }, { status: 403 });
    let workspaceId: string | null = null;
    if (workspace === "admin" && profile.role === "admin") {
      workspaceId = auth.user.id;
    } else if (workspace === "pharmacie" && profile.role === "pharmacie" && profile.pharmacie_id) {
      const { data: pharmacy } = await db.from("pharmacies").select("id,actif").eq("id", profile.pharmacie_id).maybeSingle();
      if (pharmacy?.actif === true) workspaceId = pharmacy.id;
    } else if (workspace === "partner") {
      let query = db.from("partner_members").select("partner_id,partners!inner(id,status)")
        .eq("user_id", auth.user.id).in("member_role", ["owner", "manager"]);
      if (partnerId) query = query.eq("partner_id", partnerId);
      const { data: memberships, error } = await query;
      const active = (memberships ?? []).filter((row: any) => row.partners?.status === "active");
      if (!error && active.length === 1) workspaceId = active[0].partner_id;
    }
    if (!workspaceId) return NextResponse.json({ error: "Ce compte ne peut pas enrôler de lecteur dans cet espace." }, { status: 403 });

    const token = createDeviceToken();
    const now = new Date().toISOString();
    const { data: device, error } = await db.from("naxa_payment_notification_devices").upsert({
      user_id: auth.user.id, workspace_type: workspace, workspace_id: workspaceId,
      installation_id: installationId, device_name: deviceName, device_token_hash: hashDeviceToken(token),
      notification_consent_at: body.notificationConsent === true ? now : null,
      is_active: true, paired_at: now, last_seen_at: now, updated_at: now,
    }, { onConflict: "user_id,installation_id,workspace_type,workspace_id" })
      .select("id,workspace_type,workspace_id,device_name,is_active").single();
    if (error || !device) {
      console.error("[payment.notification.device.register]", { code: error?.code });
      return NextResponse.json({ error: "Enrôlement du téléphone impossible." }, { status: 503 });
    }
    return NextResponse.json({
      deviceId: device.id, deviceToken: token, workspace: device.workspace_type,
      workspaceId: device.workspace_id, deviceName: device.device_name,
      notificationConsent: body.notificationConsent === true,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Enrôlement Android indisponible." }, { status: 503 });
  }
}
