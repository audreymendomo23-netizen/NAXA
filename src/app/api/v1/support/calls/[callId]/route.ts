import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { authenticateNativeSupportUser } from "@/lib/support/native-bearer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ callId: string }> };

export async function GET(request: Request, context: Context) {
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
    .select("id,ticket_id,requester_user_id,agent_user_id,status,fallback_at,accepted_at,ended_at,end_reason,created_at")
    .eq("id", callId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, code: "CALL_STATE_UNAVAILABLE" }, { status: 503, headers: NO_STORE });
  if (!call || call.requester_user_id !== auth.user.id) {
    return NextResponse.json({ ok: false, code: "CALL_NOT_FOUND" }, { status: 404, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true, call }, { status: 200, headers: NO_STORE });
}

export async function PATCH(request: Request, context: Context) {
  const auth = await authenticateNativeSupportUser(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status, headers: NO_STORE });
  }

  const { callId } = await context.params;
  if (!UUID.test(callId)) {
    return NextResponse.json({ ok: false, code: "INVALID_CALL_ID" }, { status: 400, headers: NO_STORE });
  }

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_TRANSITION" }, { status: 400, headers: NO_STORE });
  }

  const action = String(body.action ?? "");
  if (action !== "cancel" && action !== "end") {
    return NextResponse.json({ ok: false, code: "TRANSITION_NOT_ALLOWED" }, { status: 400, headers: NO_STORE });
  }

  const admin = supabaseAdmin();
  const { data: call, error: readError } = await admin
    .from("support_calls")
    .select("requester_user_id,status")
    .eq("id", callId)
    .maybeSingle();

  if (readError) return NextResponse.json({ ok: false, code: "CALL_STATE_UNAVAILABLE" }, { status: 503, headers: NO_STORE });
  if (!call || call.requester_user_id !== auth.user.id) {
    return NextResponse.json({ ok: false, code: "CALL_NOT_FOUND" }, { status: 404, headers: NO_STORE });
  }

  if ((action === "cancel" && !["queued", "ringing"].includes(call.status))
    || (action === "end" && call.status !== "accepted")) {
    return NextResponse.json({ ok: false, code: "TRANSITION_NOT_ALLOWED" }, { status: 409, headers: NO_STORE });
  }

  const { data: updated, error } = await admin.rpc("naxa_support_call_transition", {
    p_actor_user_id: auth.user.id,
    p_call_id: callId,
    p_action: action,
  });

  if (error || !updated) {
    return NextResponse.json({ ok: false, code: "TRANSITION_REJECTED" }, { status: 409, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true, call: updated }, { status: 200, headers: NO_STORE });
}
