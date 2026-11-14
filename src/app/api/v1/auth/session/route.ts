import { NextResponse } from "next/server";
import { authenticateSupabaseBearer } from "@/lib/supabase/bearer-auth";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

const PHARMACY_ROLE_CODES = new Set([
  "pharmacie",
  "caisse",
  "responsable",
  "comptable",
  "pharmacien",
  "gestionnaire_stock",
  "magasinier",
  "livreur",
]);

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Native/API session bootstrap.
 *
 * Uses the same active-business-role resolver as the PWA, called without a
 * profile argument so it resolves the authenticated caller. It never reads
 * naxa_profile_active_roles directly or uses service-role credentials.
 * Production does not yet expose a self-scoped active-partner resolver, so
 * partner memberships are kept out of the Client workspace until resolvable.
 */
export async function GET(request: Request) {
  const auth = await authenticateSupabaseBearer(request);

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code },
      { status: auth.status, headers: NO_STORE_HEADERS }
    );
  }

  const { data: profile, error: profileError } = await auth.supabase
    .from("profiles")
    .select("id,role,actif,age_verified,pharmacie_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { ok: false, code: "PROFILE_LOOKUP_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  if (!profile || profile.actif !== true) {
    return NextResponse.json(
      { ok: false, code: "PROFILE_INACTIVE" },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  // No argument is passed: the database default resolves auth.uid().
  const { data: resolvedRole, error: roleError } =
    await auth.supabase.rpc("naxa_business_function");

  if (roleError) {
    return NextResponse.json(
      { ok: false, code: "PROFILE_CONTEXT_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  let activeRole =
    typeof resolvedRole === "string" && resolvedRole.trim()
      ? resolvedRole.trim()
      : "active_role_unresolved";
  let activePharmacyId: string | null = null;
  let activePartnerId: string | null = null;
  let activePartnerType: string | null = null;

  if (profile.role === "client") {
    // This is a self-read RLS policy. Membership does not itself prove that
    // a partner role is currently selected.
    const { data: memberships, error: membershipError } = await auth.supabase
      .from("partner_members")
      .select("partner_id")
      .eq("user_id", auth.user.id);

    if (membershipError) {
      return NextResponse.json(
        { ok: false, code: "PROFILE_CONTEXT_UNAVAILABLE" },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    if (memberships && memberships.length > 0 && activeRole === "client") {
      // Without the production active-partner resolver, selecting between
      // Client and a partner workspace cannot be proved. Fail closed.
      activeRole = "partner_context_unresolved";
    }
  }

  if (
    PHARMACY_ROLE_CODES.has(activeRole) &&
    typeof profile.pharmacie_id === "string"
  ) {
    activePharmacyId = profile.pharmacie_id;
  }

  return NextResponse.json(
    {
      ok: true,
      apiVersion: "v1",
      user: { id: auth.user.id },
      profile: {
        role: profile.role,
        activeRole,
        activePharmacyId,
        activePartnerId,
        activePartnerType,
        active: true,
        ageVerified: profile.age_verified === true,
      },
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
