import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

export function hashRateKey(value: string) {
  const pepper = process.env.NAXA_RATE_LIMIT_SECRET;
  if (!pepper || pepper.length < 32) throw new Error("NAXA_RATE_LIMIT_SECRET must contain at least 32 characters");
  return createHash("sha256").update(pepper).update("\0").update(value).digest("hex");
}
export function trustedRequestIp(request: Request): string {
  // L'en-tête est lu côté serveur uniquement. Le proxy de déploiement doit écraser ce header.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip && ip.length <= 64 ? ip : "unknown";
}
export async function rateLimit(scope: string, key: string, action: "check"|"attempt"|"fail"|"success", limit: number, windowSeconds: number, baseBlockSeconds=30, maxBlockSeconds=900) {
  const { data, error } = await supabaseAdmin().rpc("naxa_rate_limit_v1", {
    p_scope: scope, p_key_hash: hashRateKey(key), p_action: action,
    p_limit: limit, p_window_seconds: windowSeconds,
    p_base_block_seconds: baseBlockSeconds, p_max_block_seconds: maxBlockSeconds,
  });
  if (error || !data?.[0]) {
    console.error("NAXA_RATE_LIMIT_UNAVAILABLE", error);
    throw new Error("NAXA_RATE_LIMIT_UNAVAILABLE");
  }
  return { allowed: Boolean(data[0].allowed), retryAfter: Number(data[0].retry_after || 0), failures: Number(data[0].failures || 0) };
}
export function tooManyAttempts(retryAfter: number) {
  return Response.json({ error: `Trop d'essais, réessayez dans ${Math.max(1,retryAfter)} secondes` }, { status: 429, headers: { "Retry-After": String(Math.max(1,retryAfter)) } });
}
