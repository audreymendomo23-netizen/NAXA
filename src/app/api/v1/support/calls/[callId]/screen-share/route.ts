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
const ACTIONS = new Set(["consented", "started", "stopped", "denied"]);
const REASONS = new Set([
  "browser_permission_denied",
  "browser_unsupported",
  "user_cancelled",
  "user_stopped",
  "call_ended",
  "requester_disconnected",
  "unexpected_track_end",
]);
type Context = { params: Promise<{ callId: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await authenticateNativeSupportUser(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status, headers: NO_STORE });
  }

  const { callId } = await context.params;
  if (!UUID.test(callId)) {
    return NextResponse.json({ ok: false, code: "INVALID_CALL_ID" }, { status: 400, headers: NO_STORE });
  }

  let body: { action?: string; share_session_id?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_BODY" }, { status: 400, headers: NO_STORE });
  }

  const action = String(body.action ?? "");
  const shareSessionId = String(body.share_session_id ?? "");
  const reason = body.reason === undefined ? null : String(body.reason);
  if (!ACTIONS.has(action) || !UUID.test(shareSessionId) || (reason !== null && !REASONS.has(reason))) {
    return NextResponse.json({ ok: false, code: "INVALID_SHARE_EVENT" }, { status: 400, headers: NO_STORE });
  }
  if ((action === "consented" || action === "started") && reason !== null) {
    return NextResponse.json({ ok: false, code: "UNEXPECTED_SHARE_REASON" }, { status: 400, headers: NO_STORE });
  }
  if (action === "denied" && reason === null) {
    return NextResponse.json({ ok: false, code: "SHARE_DENIAL_REASON_REQUIRED" }, { status: 400, headers: NO_STORE });
  }

  const { data: call, error: callError } = await supabaseAdmin()
    .from("support_calls")
    .select("requester_user_id,status")
    .eq("id", callId)
    .maybeSingle();

  if (callError) return NextResponse.json({ ok: false, code: "CALL_STATE_UNAVAILABLE" }, { status: 503, headers: NO_STORE });
  if (!call || call.requester_user_id !== auth.user.id || call.status !== "accepted") {
    return NextResponse.json({ ok: false, code: "REQUESTER_ONLY_ACTIVE_CALL" }, { status: 403, headers: NO_STORE });
  }

  const { error } = await supabaseAdmin().rpc("naxa_support_call_screen_share_event", {
    p_call_id: callId,
    p_actor_user_id: auth.user.id,
    p_share_session_id: shareSessionId,
    p_action: action,
    p_reason: reason,
  });

  if (error) return NextResponse.json({ ok: false, code: "SHARE_EVENT_REJECTED" }, { status: 409, headers: NO_STORE });
  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
