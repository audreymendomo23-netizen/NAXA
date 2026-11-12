import { createSign } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type FcmPayload = { title: string; body: string; url: string; tag: string; };
type ServiceAccount = { project_id?: string; client_email?: string; private_key?: string; token_uri?: string; };
let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch { return null; }
}

async function accessToken(account: ServiceAccount): Promise<string | null> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: account.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = header + "." + claims;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = unsigned + "." + signer.sign(account.private_key!).toString("base64url");
  const response = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  cachedAccessToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

export async function sendFcmToUser(db: SupabaseClient, userId: string, payload: FcmPayload) {
  const account = serviceAccount();
  if (!account) return { sent: 0, configured: false, failed: 0 };
  const { data: tokens, error } = await db.from("naxa_fcm_tokens").select("token").eq("user_id", userId);
  if (error) return { sent: 0, configured: true, failed: 1 };
  if (!tokens?.length) return { sent: 0, configured: true, failed: 0 };
  const bearer = await accessToken(account);
  if (!bearer) return { sent: 0, configured: true, failed: tokens.length };
  const projectId = process.env.FIREBASE_PROJECT_ID || account.project_id!;
  let sent = 0, failed = 0;
  await Promise.all(tokens.map(async (row: { token: string }) => {
    try {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: {
          token: row.token,
          data: { title: payload.title, body: payload.body, url: payload.url, tag: payload.tag },
          android: { priority: "HIGH", ttl: "300s" },
        } }),
        cache: "no-store",
      });
      if (response.ok) { sent++; return; }
      const detail = await response.text();
      if (response.status === 404 || detail.includes("UNREGISTERED") || detail.includes("INVALID_ARGUMENT")) {
        await db.from("naxa_fcm_tokens").delete().eq("token", row.token);
      }
      failed++;
    } catch { failed++; }
  }));
  return { sent, configured: true, failed };
}
