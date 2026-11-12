import { NextResponse } from "next/server";
import { authenticateSupabaseBearer } from "@/lib/supabase/bearer-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { token?: string };
function validToken(value: unknown): value is string {
  return typeof value === "string" && value.length >= 100 && value.length <= 4096
    && /^[A-Za-z0-9:_-]+$/.test(value);
}

export async function POST(request: Request) {
  const auth = await authenticateSupabaseBearer(request);
  if (!auth.ok) return NextResponse.json({ error: "Authentification requise." }, { status: auth.status });
  let body: Body;
  try { body = await request.json() as Body; }
  catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 }); }
  if (!validToken(body.token)) return NextResponse.json({ error: "Jeton FCM invalide." }, { status: 400 });
  let admin: ReturnType<typeof supabaseAdmin>;
  try { admin = supabaseAdmin(); } catch { return NextResponse.json({ error: "Service de notification indisponible." }, { status: 503 }); }
  const { error } = await admin.from("naxa_fcm_tokens").upsert({
    token: body.token, user_id: auth.user.id, platform: "android", updated_at: new Date().toISOString()
  }, { onConflict: "token" });
  if (error) return NextResponse.json({ error: "Enregistrement du téléphone impossible." }, { status: 503 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await authenticateSupabaseBearer(request);
  if (!auth.ok) return NextResponse.json({ error: "Authentification requise." }, { status: auth.status });
  let body: Body;
  try { body = await request.json() as Body; }
  catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 }); }
  if (!validToken(body.token)) return NextResponse.json({ error: "Jeton FCM invalide." }, { status: 400 });
  let admin: ReturnType<typeof supabaseAdmin>;
  try { admin = supabaseAdmin(); } catch { return NextResponse.json({ error: "Service de notification indisponible." }, { status: 503 }); }
  const { error } = await admin.from("naxa_fcm_tokens").delete()
    .eq("token", body.token).eq("user_id", auth.user.id);
  if (error) return NextResponse.json({ error: "Désinscription impossible." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
