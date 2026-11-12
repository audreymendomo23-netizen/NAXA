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
 * This endpoint validates a Supabase access token supplied as a Bearer token,
 * then reads only the caller's own profile through that user's RLS-scoped client.
 * It does not create a session cookie or use the service-role key.
 */
export async function GET(request: Request) {
  const auth = await authenticateSupabaseBearer(request);

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code },
      { status: auth.status, headers: NO_STORE_HEADERS }
    );
  }

  const { data: profile, error } = await auth.supabase
    .from("profiles")
    .select("id,role,actif,age_verified")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) {
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

  return NextResponse.json(
    {
      ok: true,
      apiVersion: "v1",
      user: { id: auth.user.id },
      profile: {
        role: profile.role,
        active: true,
        ageVerified: profile.age_verified === true,
      },
    },
    { status: 200, headers: NO_STORE_HEADERS }
  );
}
