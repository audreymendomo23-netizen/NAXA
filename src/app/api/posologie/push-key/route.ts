import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const publicKey = process.env.NAXA_VAPID_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: "Notifications Push non configurées." }, { status: 503 });
  return NextResponse.json({ publicKey }, { headers: { "Cache-Control": "no-store" } });
}
