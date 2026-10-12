import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PHARMACIE_SCHEMA as S } from "@/lib/pharmacie-schema";
import { deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";

export async function POST(req: NextRequest) {
  const token = deviceTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Jeton appareil requis." }, { status: 401 });
  try {
    const { data: device, error } = await supabaseAdmin().from(S.devicesTable)
      .select([S.deviceIdColumn,S.devicePharmacyIdColumn,S.deviceUserIdColumn,S.deviceActiveColumn,S.deviceLastSyncColumn,S.deviceCreatedColumn].join(","))
      .eq(S.deviceTokenHashColumn, hashDeviceToken(token)).maybeSingle();
    if (error || !device || !device[S.deviceActiveColumn]) return NextResponse.json({ error: "Appareil désactivé ou inconnu." }, { status: 401 });
    if (Date.now() - new Date(device[S.deviceLastSyncColumn] || device[S.deviceCreatedColumn]).getTime() > 7 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "Appareil expiré après 7 jours sans synchronisation. Reconnectez-vous en ligne.", code: "DEVICE_EXPIRED" }, { status: 401 });
    }
    const body = await req.json();
    const operations = Array.isArray(body.operations) ? body.operations.slice(0, 100) : [];
    operations.sort((a: any, b: any) => Number(a.createdAt || 0) - Number(b.createdAt || 0) || String(a.id).localeCompare(String(b.id)));
    const results: Array<{ id: string; status: string; detail?: unknown }> = [];
    for (const op of operations) {
      if (!op || typeof op.id !== "string" || !/^[0-9a-f-]{36}$/i.test(op.id) || typeof op.type !== "string") {
        results.push({ id: String(op?.id || ""), status: "rejected" }); continue;
      }
      const payload = op.payload && typeof op.payload === "object" ? op.payload : {};
      const { data: result, error: applyError } = await supabaseAdmin().rpc("naxa_apply_offline_operation_v1", {
        p_device_id: device[S.deviceIdColumn], p_operation_id: op.id, p_type: op.type, p_payload: payload,
        p_created_at_ms: Number.isFinite(Number(op.createdAt)) ? Number(op.createdAt) : Date.now(),
      });
      if (applyError) {
        console.error("NAXA_SYNC_OPERATION_FAILED", { operationId: op.id, message: applyError.message });
        results.push({ id: op.id, status: "retry", detail: applyError.message }); continue;
      }
      results.push({ id: op.id, status: result?.status || "applied", detail: result });
    }
    const now = new Date().toISOString();
    await supabaseAdmin().from(S.devicesTable).update({ [S.deviceLastSyncColumn]: now }).eq(S.deviceIdColumn, device[S.deviceIdColumn]);
    const { data: reference } = await supabaseAdmin().from(S.pharmaciesTable).select([S.pharmacyIdColumn,S.pharmacyNameColumn,S.pharmacyStockUpdatedColumn].join(",")).eq(S.pharmacyIdColumn, device[S.devicePharmacyIdColumn]).maybeSingle();
    return NextResponse.json({ ok: true, results, reference: reference ? { pharmacie: reference } : null, syncedAt: now });
  } catch (error) {
    console.error("NAXA_SYNC_FAILED", error);
    return NextResponse.json({ error: "Synchronisation indisponible." }, { status: 503 });
  }
}
