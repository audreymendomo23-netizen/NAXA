import { NextResponse } from "next/server";
import { authenticateSupabaseBearer } from "@/lib/supabase/bearer-auth";
import { isDemoPharmacy } from "@/lib/admin/is-demo-pharmacy";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PromoterValidity = {
  statut?: string | null;
  jours_restants?: number | string | null;
};

export async function GET(request: Request) {
  const auth = await authenticateSupabaseBearer(request);

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code },
      { status: auth.status, headers: NO_STORE_HEADERS }
    );
  }

  const [{ data: profile, error: profileError }, { data: activeRole, error: roleError }] =
    await Promise.all([
      auth.supabase
        .from("profiles")
        .select("role,actif")
        .eq("id", auth.user.id)
        .maybeSingle(),
      // Match the PWA requireAdminActive guard; no arbitrary profile ID.
      auth.supabase.rpc("naxa_business_function"),
    ]);

  if (profileError || roleError) {
    return NextResponse.json(
      { ok: false, code: "ADMIN_CONTEXT_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  if (!profile || profile.role !== "admin" || profile.actif !== true || activeRole !== "admin") {
    return NextResponse.json(
      { ok: false, code: "ADMIN_REQUIRED" },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const [
    { data: pharmacies, error: pharmaciesError },
    { data: validities, error: validitiesError },
    { data: activity, error: activityError },
  ] = await Promise.all([
    auth.supabase
      .from("pharmacies")
      .select("id,nom,ville,quartier,stock_updated_at,actif,visible_recherche,est_demo")
      .order("created_at", { ascending: false }),
    auth.supabase.rpc("validites_promoteurs_admin"),
    auth.supabase
      .from("audit_log")
      .select("id,action,entity_type,entity_id,created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const operationalPharmacies = (pharmacies ?? []).filter(
    (pharmacy) => !isDemoPharmacy(pharmacy.nom, pharmacy.est_demo)
  );
  const stockTimestamped = operationalPharmacies.filter(
    (pharmacy) => Boolean(pharmacy.stock_updated_at)
  ).length;
  const stockNeedsUpdate = operationalPharmacies.length - stockTimestamped;
  const neighborhoods = new Set(
    operationalPharmacies
      .map((pharmacy) => (pharmacy.quartier ?? "").trim())
      .filter(Boolean)
  );
  const promoterAlerts = ((validities ?? []) as PromoterValidity[]).filter(
    (item) => item.statut === "impaye" || Number(item.jours_restants) < 0
  ).length;
  const inactivePharmacies = operationalPharmacies.filter(
    (pharmacy) => pharmacy.actif === false || pharmacy.visible_recherche === false
  ).length;
  const lastStockUpdate = operationalPharmacies.reduce<string | null>(
    (latest, pharmacy) =>
      pharmacy.stock_updated_at && (!latest || pharmacy.stock_updated_at > latest)
        ? pharmacy.stock_updated_at
        : latest,
    null
  );

  return NextResponse.json(
    {
      ok: true,
      summary: {
        pharmaciesTotal: pharmaciesError ? null : operationalPharmacies.length,
        stockTimestamped: pharmaciesError ? null : stockTimestamped,
        stockNeedsUpdate: pharmaciesError ? null : stockNeedsUpdate,
        neighborhoodsCovered: pharmaciesError ? null : neighborhoods.size,
        stockProgressPercent:
          pharmaciesError || operationalPharmacies.length === 0
            ? null
            : Math.round((stockTimestamped / operationalPharmacies.length) * 100),
        inactivePharmacies: pharmaciesError ? null : inactivePharmacies,
        promoterAlerts: validitiesError ? null : promoterAlerts,
        alertsTotal:
          pharmaciesError || validitiesError
            ? null
            : stockNeedsUpdate + inactivePharmacies + promoterAlerts,
        lastStockUpdate: pharmaciesError ? null : lastStockUpdate,
      },
      recentActivity: (activity ?? []).map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entity_type,
        entityId: item.entity_id,
        createdAt: item.created_at,
      })),
      partial: {
        pharmacies: Boolean(pharmaciesError),
        promoterValidity: Boolean(validitiesError),
        auditLog: Boolean(activityError),
      },
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
