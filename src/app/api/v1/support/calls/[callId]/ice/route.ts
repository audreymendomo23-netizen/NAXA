import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { authenticateNativeSupportUser } from "@/lib/support/native-bearer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: { params: Promise<{ callId: string }> }) {
  const auth = await authenticateNativeSupportUser(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status, headers: NO_STORE });
  }

  const { callId } = await context.params;
  if (!UUID.test(callId)) {
    return NextResponse.json({ ok: false, code: "INVALID_CALL_ID" }, { status: 400, headers: NO_STORE });
  }

  const { data: call, error } = await supabaseAdmin()
    .from("support_calls")
    .select("requester_user_id,status")
    .eq("id", callId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, code: "ICE_SESSION_UNAVAILABLE" }, { status: 503, headers: NO_STORE });
  if (!call || call.requester_user_id !== auth.user.id || call.status !== "accepted") {
    return NextResponse.json({ ok: false, code: "CALL_NOT_ACCEPTED_OR_NOT_OWNED" }, { status: 403, headers: NO_STORE });
  }

  const parseUrls = (value: string | undefined) =>
    (value ?? "").split(",").map((item) => item.trim()).filter((item) => /^(stun|stuns|turn|turns):/i.test(item));
  const turns = parseUrls(process.env.NAXA_TURN_URLS);
  const stuns = parseUrls(process.env.NAXA_STUN_URLS);
  const secret = process.env.NAXA_TURN_SHARED_SECRET;
  const ttlSetting = Number(process.env.NAXA_TURN_CREDENTIAL_TTL_SECONDS ?? 300);
  const ttl = Number.isFinite(ttlSetting) ? Math.min(900, Math.max(60, Math.floor(ttlSetting))) : 300;

  if (!turns.length || !secret || secret.length < 24) {
    return NextResponse.json({ ok: false, code: "TURN_NOT_CONFIGURED" }, { status: 503, headers: NO_STORE });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const username = expiresAt + ":" + auth.user.id;
  const credential = createHmac("sha1", secret).update(username).digest("base64");
  const iceServers = [
    ...(stuns.length ? [{ urls: stuns }] : []),
    { urls: turns, username, credential },
  ];

  return NextResponse.json({ ok: true, iceServers, expiresAt }, { status: 200, headers: NO_STORE });
}
