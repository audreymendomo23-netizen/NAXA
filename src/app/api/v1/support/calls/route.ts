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

export async function POST(request: Request) {
  const auth = await authenticateNativeSupportUser(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status, headers: NO_STORE });
  }

  let body: { ticket_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_BODY" }, { status: 400, headers: NO_STORE });
  }

  const ticketId = String(body.ticket_id ?? "").trim();
  if (!UUID.test(ticketId)) {
    return NextResponse.json({ ok: false, code: "INVALID_TICKET_ID" }, { status: 400, headers: NO_STORE });
  }

  // The actor ID always comes from the verified Bearer token, never the body.
  // The RPC verifies ticket ownership, active profile and open Support scope.
  const { data: call, error } = await supabaseAdmin().rpc("naxa_support_call_request", {
    p_actor_user_id: auth.user.id,
    p_ticket_id: ticketId,
  });

  if (error || !call) {
    return NextResponse.json(
      { ok: false, code: "CALL_REQUEST_REJECTED" },
      { status: 409, headers: NO_STORE }
    );
  }

  return NextResponse.json({ ok: true, call }, { status: 201, headers: NO_STORE });
}
