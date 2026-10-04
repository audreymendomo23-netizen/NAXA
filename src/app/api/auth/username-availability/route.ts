import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
      return NextResponse.json({ valid: false, available: false });
    }

    const { data, error } = await supabaseAdmin()
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .limit(1);

    if (error) {
      return NextResponse.json({ valid: true, available: false }, { status: 500 });
    }

    return NextResponse.json({ valid: true, available: !data?.length });
  } catch {
    return NextResponse.json({ valid: false, available: false }, { status: 400 });
  }
}
