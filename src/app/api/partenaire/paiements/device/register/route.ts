import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createDeviceToken, deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticatedUser(request: Request) {
  const accessToken = deviceTokenFromRequest(request);
  if (!accessToken) return { error: NextResponse.json({ error: "Session Partenaire requise." }, { status: 401 }) };
  const db = supabaseAdmin();
  const { data: auth, error: authError } = await db.auth.getUser(accessToken);
  if (authError || !auth.user) {
    return { error: NextResponse.json({ error: "Session NAXA invalide ou expirée." }, { status: 401 }) };
  }
  const { data: profile } = await db.from("profiles").select("id,actif").eq("id", auth.user.id).maybeSingle();
  if (profile?.actif !== true) {
    return { error: NextResponse.json({ error: "Compte actif requis." }, { status: 403 }) };
  }
  return { db, userId: auth.user.id };
}

async function activePartnerMemberships(db: ReturnType<typeof supabaseAdmin>, userId: string) {
  const { data: memberships, error } = await db.from("partner_members")
    .select("partner_id,member_role,partners!inner(id,name,status)")
    .eq("user_id", userId).in("member_role", ["owner", "manager"]);
  if (error) throw new Error("Accès aux espaces Partenaire indisponible.");
  type PartnerInfo = { id: string; name: string; status: string };
  const rows = (memberships ?? []) as unknown as Array<{
    partner_id: string;
    partners: PartnerInfo | PartnerInfo[] | null;
  }>;
  return rows
    .map((row) => ({
      partnerId: row.partner_id,
      partner: Array.isArray(row.partners) ? row.partners[0] ?? null : row.partners,
    }))
    .filter((row) => row.partner?.status === "active" && row.partner.id === row.partnerId)
    .map((row) => ({ id: row.partnerId, name: row.partner!.name }));
}

export async function GET(request: Request) {
  try {
    const auth = await authenticatedUser(request);
    if ("error" in auth) return auth.error;
    const partners = await activePartnerMemberships(auth.db, auth.userId);
    return NextResponse.json({ partners }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Liste des espaces Partenaire indisponible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatedUser(request);
    if ("error" in auth) return auth.error;
    const body = await request.json() as {
      installationId?: string; deviceName?: string; partnerId?: string;
    };
    const installationId = String(body.installationId ?? "");
    const deviceName = String(body.deviceName ?? "NAXA Partenaire Android").trim().slice(0, 100);
    const partnerId = String(body.partnerId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(installationId) || deviceName.length < 2 || !partnerId) {
      return NextResponse.json({ error: "Identité du téléphone ou espace Partenaire invalide." }, { status: 400 });
    }

    const partners = await activePartnerMemberships(auth.db, auth.userId);
    const selected = partners.filter((partner) => partner.id === partnerId);
    if (selected.length !== 1) {
      return NextResponse.json({ error: "Espace Partenaire non autorisé, inactif ou affectation révoquée." }, { status: 403 });
    }

    const token = createDeviceToken();
    const now = new Date().toISOString();
    const { data: device, error: saveError } = await auth.db.from("naxa_partner_payment_devices").upsert({
      partner_id: partnerId,
      user_id: auth.userId,
      installation_id: installationId,
      device_name: deviceName,
      device_token_hash: hashDeviceToken(token),
      is_active: true,
      last_seen_at: now,
      updated_at: now,
    }, { onConflict: "partner_id,user_id,installation_id" }).select("id,partner_id").single();
    if (saveError || !device) {
      return NextResponse.json({ error: "Enrôlement du partenaire impossible." }, { status: 503 });
    }
    return NextResponse.json({
      devices: [{
        partnerId: device.partner_id,
        partnerName: selected[0].name,
        deviceId: device.id,
        deviceToken: token,
      }],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Enrôlement Partenaire indisponible." }, { status: 503 });
  }
}
