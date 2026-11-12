import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type RequestWithHeaders = Pick<Request, "headers">;

export type SupabaseBearerAuthResult =
  | { ok: true; supabase: SupabaseClient; user: User }
  | {
      ok: false;
      status: 401 | 503;
      code: "AUTH_REQUIRED" | "AUTH_INVALID" | "AUTH_UNAVAILABLE" | "SUPABASE_NOT_CONFIGURED";
    };

/**
 * Read one Authorization: Bearer <access_token> header.
 * The token is never accepted from query parameters, request bodies or cookies.
 */
export function readSupabaseBearerToken(request: RequestWithHeaders): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

/**
 * Authenticate a native/API request with Supabase Auth and return an anon-key
 * client whose PostgREST requests carry the verified user's JWT, so RLS remains
 * in force. This helper deliberately has no service-role or cookie fallback.
 */
export async function authenticateSupabaseBearer(
  request: RequestWithHeaders
): Promise<SupabaseBearerAuthResult> {
  const token = readSupabaseBearerToken(request);
  if (!token) return { ok: false, status: 401, code: "AUTH_REQUIRED" };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 503, code: "SUPABASE_NOT_CONFIGURED" };
  }

  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    // Do not trust decoded JWT claims alone. Supabase Auth validates the token.
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return { ok: false, status: 401, code: "AUTH_INVALID" };
    }

    return { ok: true, supabase, user: data.user };
  } catch {
    return { ok: false, status: 503, code: "AUTH_UNAVAILABLE" };
  }
}
