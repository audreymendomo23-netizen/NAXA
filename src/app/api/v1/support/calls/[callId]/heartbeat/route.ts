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

export async function POST(request: Request, context: { params: Promise<{ callId: string }> }) {
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

  if (error) return NextResponse.json({ ok: false, code: "CALL_STATE_UNAVAILABLE" }, { status: 503, headers: NO_STORE });
  if (!call || call.requester_user_id !== auth.user.id) {
    return NextResponse.json({ ok: false, code: "CALL_NOT_FOUND" }, { status: 404, headers: NO_STORE });
  }

  const { data: updated, error: heartbeatError } = await supabaseAdmin().rpc("naxa_support_call_heartbeat", {
    p_actor_user_id: auth.user.id,
    p_call_id: callId,
  });

  if (heartbeatError || !updated) {
    return NextResponse.json({ ok: false, code: "HEARTBEAT_REJECTED" }, { status: 409, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true, call: updated }, { status: 200, headers: NO_STORE });
}
