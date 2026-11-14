import { NextResponse } from "next/server";
import { authenticateSupabaseBearer } from "@/lib/supabase/bearer-auth";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

const PHARMACY_ROLE_CODES = new Set([
  "promoteur",
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
 * Uses the canonical active-business-role resolver plus self-scoped reads for
 * medical-centre staff and partner membership. No direct read of protected
 * active-role tables and no service-role bypass are used.
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
  let activeWorkspace = "unresolved";
  let activePharmacyId: string | null = null;
  let activePartnerId: string | null = null;
  let activePartnerType: string | null = null;
  let activeCenterId: string | null = null;

  if (profile.role === "admin" && activeRole === "admin") {
    activeWorkspace = "admin";
  } else if (profile.role === "client") {
    // exam_staff_assignments has an explicit self-read policy. Query only the
    // caller's own active assignments; the table is separate from pharmacy
    // staff assignments and its role keys must remain scoped to this domain.
    const [{ data: examAssignments, error: examError }, { data: memberships, error: membershipError }] =
      await Promise.all([
        auth.supabase
          .from("exam_staff_assignments")
          .select("id,center_id,role_key,active_role")
          .eq("user_id", auth.user.id)
          .eq("is_active", true)
          .is("revoked_at", null),
        auth.supabase
          .from("partner_members")
          .select("partner_id")
          .eq("user_id", auth.user.id),
      ]);

    if (examError || membershipError) {
      return NextResponse.json(
        { ok: false, code: "PROFILE_CONTEXT_UNAVAILABLE" },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    const activeExamAssignments = (examAssignments ?? []).filter(
      (assignment) => assignment.active_role === true
    );

    if (activeExamAssignments.length > 1) {
      // More than one active centre role conflicts with NAXA's single active
      // workspace rule. Do not pick the first database row arbitrarily.
      activeRole = "exam_scope_ambiguous";
    } else if (activeExamAssignments.length === 1) {
      if (activeRole !== "client" && activeRole !== "active_role_unresolved") {
        activeRole = "active_role_conflict";
      } else {
        const assignment = activeExamAssignments[0];
        activeRole = assignment.role_key;
        activeCenterId = assignment.center_id;
        activeWorkspace = "medical_exams";
      }
    } else if (memberships && memberships.length > 0 && activeRole === "client") {
      // Membership alone does not prove an active Partner role. Production
      // currently lacks the partner-scope resolver, so do not route as Client.
      activeRole = "partner_context_unresolved";
    }
  }

  if (activeWorkspace === "unresolved") {
    if (activeRole === "client" && profile.role === "client") {
      activeWorkspace = "client";
    } else if (PHARMACY_ROLE_CODES.has(activeRole)) {
      activeWorkspace = "pharmacy";
    }
  }

  if (
    activeWorkspace === "pharmacy" &&
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
        activeWorkspace,
        activePharmacyId,
        activePartnerId,
        activePartnerType,
        activeCenterId,
        active: true,
        ageVerified: profile.age_verified === true,
      },
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
