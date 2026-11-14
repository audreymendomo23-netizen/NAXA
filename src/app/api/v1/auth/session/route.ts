import { NextResponse } from "next/server";
import { authenticateSupabaseBearer } from "@/lib/supabase/bearer-auth";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Native/API session bootstrap.
 *
 * Reads only the caller's own profile and resolves the current workspace
 * through RLS-protected membership reads and self-scoped public RPCs.
 * It never reads naxa_profile_active_roles directly or uses service-role
 * credentials to bypass RLS.
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
    .select("id,role,actif,age_verified,fonction_interne")
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

  const { data: activePharmacyId, error: pharmacyContextError } =
    await auth.supabase.rpc("naxa_active_role_pharmacy");

  if (pharmacyContextError) {
    return NextResponse.json(
      { ok: false, code: "PROFILE_CONTEXT_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  // partner_members has a self-read RLS policy. The hidden active-role table
  // is deliberately not queried from this endpoint.
  const { data: memberships, error: membershipError } = await auth.supabase
    .from("partner_members")
    .select("partner_id,member_role")
    .eq("user_id", auth.user.id);

  if (membershipError) {
    return NextResponse.json(
      { ok: false, code: "PROFILE_CONTEXT_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  let activePartnerId: string | null = null;
  let activePartnerType: string | null = null;
  let activeRole =
    typeof profile.fonction_interne === "string" && profile.fonction_interne.trim()
      ? profile.fonction_interne.trim()
      : profile.role;

  if (memberships && memberships.length > 0) {
    const partnerIds = [...new Set(memberships.map((membership) => membership.partner_id))];
    const { data: partners, error: partnersError } = await auth.supabase
      .from("partners")
      .select("id,partner_type,status")
      .in("id", partnerIds);

    if (partnersError) {
      return NextResponse.json(
        { ok: false, code: "PROFILE_CONTEXT_UNAVAILABLE" },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    const activePartners = (partners ?? []).filter((partner) => partner.status === "active");

    // More than one active partner is ambiguous because the production API
    // does not yet expose the partner_id in naxa_profile_active_roles.
    if (activePartners.length > 1) {
      activeRole = "partner_scope_ambiguous";
    } else if (activePartners.length === 1) {
      const partner = activePartners[0];
      const membership = memberships.find((item) => item.partner_id === partner.id);

      activePartnerId = partner.id;
      activePartnerType = partner.partner_type;

      if (
        !activeRole &&
        profile.role === "client" &&
        membership?.member_role === "owner"
      ) {
        activeRole = "promoteur";
      } else if (!profile.fonction_interne && profile.role === "client") {
        // A partner member without a resolvable selected role must not fall
        // through into the Client workspace.
        activeRole = membership?.member_role === "owner"
          ? "promoteur"
          : "partner_role_unresolved";
      }
    } else if (profile.role === "client") {
      // Membership exists but no active partner is readable (for example,
      // a suspended partner); fail closed rather than exposing Client pages.
      activeRole = "partner_scope_unavailable";
    }
  }

  return NextResponse.json(
    {
      ok: true,
      apiVersion: "v1",
      user: { id: auth.user.id },
      profile: {
        role: profile.role,
        activeRole,
        activePharmacyId: typeof activePharmacyId === "string" ? activePharmacyId : null,
        activePartnerId,
        activePartnerType,
        active: true,
        ageVerified: profile.age_verified === true,
      },
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
