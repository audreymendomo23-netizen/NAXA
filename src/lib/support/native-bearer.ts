import { authenticateSupabaseBearer } from "@/lib/supabase/bearer-auth";
import type { User } from "@supabase/supabase-js";

export type NativeSupportAuthResult =
  | { ok: true; user: User }
  | {
      ok: false;
      status: 401 | 403 | 503;
      code: string;
    };

/**
 * Native support endpoints accept only a verified Supabase Bearer session.
 * Account activity and age verification are checked on the server for every
 * request; a native UI state is never treated as authorization.
 */
export async function authenticateNativeSupportUser(
  request: Request
): Promise<NativeSupportAuthResult> {
  const auth = await authenticateSupabaseBearer(request);
  if (!auth.ok) return { ok: false, status: auth.status, code: auth.code };

  const { data: profile, error } = await auth.supabase
    .from("profiles")
    .select("actif,age_verified")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) return { ok: false, status: 503, code: "PROFILE_LOOKUP_UNAVAILABLE" };
  if (!profile || profile.actif !== true) {
    return { ok: false, status: 403, code: "PROFILE_INACTIVE" };
  }
  if (profile.age_verified !== true) {
    return { ok: false, status: 403, code: "AGE_VERIFICATION_REQUIRED" };
  }

  return { ok: true, user: auth.user };
}
