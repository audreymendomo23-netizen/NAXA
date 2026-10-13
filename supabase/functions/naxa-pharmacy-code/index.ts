import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const json = (body: Record<string, unknown>, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });

function trustedClientIp(request: Request): string {
  // Cloudflare overwrites cf-connecting-ip; if unavailable, use the last proxy-appended XFF value.
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp && cfIp.length <= 64) return cfIp;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((value) => value.trim()).filter(Boolean);
  const lastForwarded = forwarded?.at(-1);
  return lastForwarded && lastForwarded.length <= 64 ? lastForwarded : "unknown";
}

async function hashKey(pepper: string, value: string): Promise<string> {
  const bytes = new TextEncoder().encode(pepper + "\0" + value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405, { Allow: "POST" });

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Code invalide." }, 400);
  }

  const code = typeof body.code === "string" ? body.code : "";
  if (!/^\d{4}$/.test(code)) return json({ error: "Code invalide." }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("NAXA_PHARMACY_CODE_CONFIG_MISSING");
    return json({ error: "Vérification indisponible." }, 503);
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const [ipHash, codeHash] = await Promise.all([
      hashKey(serviceRoleKey, trustedClientIp(request)),
      hashKey(serviceRoleKey, code),
    ]);
    const { data, error } = await admin.rpc("naxa_validate_pharmacy_code_v1", {
      p_code: code,
      p_ip_hash: ipHash,
      p_code_hash: codeHash,
    });
    if (error) {
      console.error("NAXA_PHARMACY_CODE_RPC_FAILED", error.message);
      return json({ error: "Vérification indisponible." }, 503);
    }

    const result = Array.isArray(data) ? data[0] : null;
    if (result?.status === "rate_limited") {
      const retryAfter = Math.max(1, Number(result.retry_after || 1));
      return json({ error: "Trop d'essais, réessayez plus tard.", retry_after: retryAfter }, 429, { "Retry-After": String(retryAfter) });
    }
    if (result?.status === "not_found") return json({ error: "Code pharmacie introuvable." }, 404);
    if (result?.status !== "ok" || typeof result.pharmacy_id !== "string" || typeof result.pharmacy_name !== "string") {
      console.error("NAXA_PHARMACY_CODE_RPC_INVALID_RESPONSE");
      return json({ error: "Vérification indisponible." }, 503);
    }
    return json({ nom: result.pharmacy_name, pharmacy_id: result.pharmacy_id });
  } catch (error) {
    console.error("NAXA_PHARMACY_CODE_UNEXPECTED", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Vérification indisponible." }, 503);
  }
});
