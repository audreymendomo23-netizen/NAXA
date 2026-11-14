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
 * Reads only the caller's own profile and RLS-protected partner membership.
 * The active-role table is intentionally not queried: authenticated users are
 * denied direct access to it. Partner context remains fail-closed until the
 * production API has a self-scoped resolver for the selected partner ID.
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
    .select("id,role,actif,age_verified,fonction_interne,pharmacie_id")
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

  const internalRole =
    typeof profile.fonction_interne === "string" ? profile.fonction_interne.trim() : "";
  let activeRole = profile.role === "admin"
    ? "admin"
    : internalRole || profile.role;
  let activePharmacyId: string | null = null;
  let activePartnerId: string | null = null;
  let activePartnerType: string | null = null;

  if (profile.role === "client") {
    // partner_members exposes only the signed-in user's memberships.
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

    if (memberships && memberships.length > 0) {
      // profile.fonction_interne is populated for selected professional roles.
      // When it is blank, the selected partner role cannot be distinguished
      // from a user who merely owns/is a member of a partner account.
      if (!profile.fonction_interne) {
        activeRole = "partner_role_unresolved";
      } else if (profile.pharmacie_id) {
        // A partner selection preserves a pre-existing pharmacie_id. Without
        // the protected active-role row, the two scopes cannot be separated.
        activeRole = "partner_or_pharmacy_scope_ambiguous";
      } else {
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

        if (activePartners.length === 1) {
          activePartnerId = activePartners[0].id;
          activePartnerType = activePartners[0].partner_type;
        } else {
          activeRole = activePartners.length > 1
            ? "partner_scope_ambiguous"
            : "partner_scope_unavailable";
        }
      }
    }
  }

  // A pharmacy scope is taken only from the caller's own profile, and only
  // when no partner membership makes that field ambiguous.
  if (
    profile.role !== "client" ||
    activeRole === profile.fonction_interne
  ) {
    if (PHARMACY_ROLE_CODES.has(activeRole) && typeof profile.pharmacie_id === "string") {
      activePharmacyId = profile.pharmacie_id;
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
