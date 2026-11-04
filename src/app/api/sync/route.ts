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
    const deviceRecord = device as unknown as Record<string, any> | null;
    if (error) {
      console.error("NAXA_SYNC_DEVICE_LOOKUP_FAILED", { message: error.message });
      return NextResponse.json({ error: "Service de synchronisation indisponible. Réessayez plus tard." }, { status: 503 });
    }
    if (!deviceRecord || !deviceRecord[S.deviceActiveColumn]) return NextResponse.json({ error: "Appareil désactivé ou inconnu." }, { status: 401 });
    if (Date.now() - new Date(deviceRecord[S.deviceLastSyncColumn] || deviceRecord[S.deviceCreatedColumn]).getTime() > 7 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "Appareil expiré après 7 jours sans synchronisation. Reconnectez-vous en ligne.", code: "DEVICE_EXPIRED" }, { status: 401 });
    }
    const {data:permissionData,error:permissionError}=await supabaseAdmin().rpc("naxa_device_permissions_v1",{
      p_device_id:deviceRecord[S.deviceIdColumn]
    });
    if(permissionError||!permissionData||typeof permissionData!=="object"){
      console.error("NAXA_SYNC_PERMISSION_LOOKUP_FAILED",permissionError?.message);
      return NextResponse.json({error:"Vérification des droits du poste indisponible."},{status:503});
    }
    const permissions=permissionData as Record<string,unknown>;

    const body = await req.json();
    const operations = Array.isArray(body.operations) ? body.operations.slice(0, 100) : [];
    operations.sort((a: any, b: any) => Number(a.modifiedAt || 0) - Number(b.modifiedAt || 0) || Number(a.deviceSequence || 0) - Number(b.deviceSequence || 0) || String(a.id).localeCompare(String(b.id)));
    const results: Array<{ id: string; status: string; detail?: unknown }> = [];
    for (const op of operations) {
      if (!op || typeof op.id !== "string" || !/^[0-9a-f-]{36}$/i.test(op.id) || typeof op.type !== "string") {
        results.push({ id: String(op?.id || ""), status: "rejected" }); continue;
      }
      const modifiedAt = Number(op.modifiedAt);
      const deviceSequence = Number(op.deviceSequence);
      if (!Number.isSafeInteger(modifiedAt) || modifiedAt <= 0 || !Number.isSafeInteger(deviceSequence) || deviceSequence <= 0) {
        results.push({ id: op.id, status: "rejected", detail: { reason: "trusted_chronology_required", message: "L'opération ne possède pas d'horodatage serveur ancré et de séquence appareil fiables." } });
        continue;
      }
      const rawPayload = op.payload && typeof op.payload === "object" && !Array.isArray(op.payload) ? op.payload : {};
      const payload = { ...rawPayload, naxa_device_sequence: deviceSequence };
      const saleOperation = op.type === "caisse_sale";
      const rpcName = saleOperation ? "naxa_apply_offline_sale_v1" : "naxa_apply_offline_operation_v1";
      const rpcArgs = saleOperation
        ? { p_device_id: deviceRecord[S.deviceIdColumn], p_operation_id: op.id, p_payload: payload, p_created_at_ms: modifiedAt }
        : { p_device_id: deviceRecord[S.deviceIdColumn], p_operation_id: op.id, p_type: op.type, p_payload: payload, p_created_at_ms: modifiedAt };
      const { data: result, error: applyError } = await supabaseAdmin().rpc(rpcName, rpcArgs);
      if (applyError) {
        console.error("NAXA_SYNC_OPERATION_FAILED", { operationId: op.id, message: applyError.message });
        results.push({ id: op.id, status: "retry", detail: "Synchronisation indisponible. Réessayez lorsque la connexion sera rétablie." }); continue;
      }
      const operationStatus = typeof result?.status === "string" ? result.status : "";
      if (["applied", "conflict", "failed", "rejected"].includes(operationStatus)) {
        results.push({ id: op.id, status: operationStatus, detail: result });
      } else {
        // Never acknowledge an operation as applied when the RPC response is missing or malformed.
        console.error("NAXA_SYNC_OPERATION_INVALID_RESULT", { operationId: op.id });
        results.push({ id: op.id, status: "retry", detail: "Réponse de synchronisation invalide. L'opération est conservée pour une nouvelle tentative." });
      }
    }
    const pharmacyId = deviceRecord[S.devicePharmacyIdColumn];
    let reference: Record<string, unknown> | null = null;
    if(permissions.canViewStock===true){
      const [{data:pharmacy,error:pharmacyError},{data:stocks,error:stocksError},{data:lots,error:lotsError}]=await Promise.all([
        supabaseAdmin().from(S.pharmaciesTable)
          .select([S.pharmacyIdColumn,S.pharmacyNameColumn].join(","))
          .eq(S.pharmacyIdColumn,pharmacyId).maybeSingle(),
        supabaseAdmin().from(S.stocksTable)
          .select("produit_id,quantite,updated_at,prix,emplacement,date_peremption,produits(nom,dosage)")
          .eq(S.pharmacyIdColumn,pharmacyId),
        supabaseAdmin().from(S.stockLotsTable).select("produit_id").eq(S.pharmacyIdColumn,pharmacyId)
      ]);
      if(pharmacyError||stocksError||lotsError) throw new Error("NAXA stock reference snapshot unavailable");
      const lotizedProductIds=[...new Set((lots??[]).map((lot:Record<string,unknown>)=>String(lot.produit_id??"")).filter(Boolean))];
      reference=pharmacy?{pharmacie:pharmacy,stock:stocks??[],lotized_product_ids:lotizedProductIds}:null;
    }
    const serverTimeMs = Date.now();
    const syncedAt = new Date(serverTimeMs).toISOString();
    if(permissions.authorized===true){
      const {error:deviceUpdateError}=await supabaseAdmin().from(S.devicesTable)
        .update({[S.deviceLastSyncColumn]:syncedAt}).eq(S.deviceIdColumn,deviceRecord[S.deviceIdColumn]);
      if(deviceUpdateError)throw new Error("NAXA device sync timestamp update failed");
    }
    return NextResponse.json({ ok: true, results, reference, permissions, syncedAt, ...(permissions.authorized===true?{serverTimeMs}:{}) });
  } catch (error) {
    console.error("NAXA_SYNC_FAILED", error);
    return NextResponse.json({ error: "Synchronisation indisponible." }, { status: 503 });
  }
}
