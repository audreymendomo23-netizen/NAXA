import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
      return NextResponse.json({ recognized: false });
    }

    const admin = supabaseAdmin();
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id, username")
      .ilike("username", username)
      .limit(2);

    if (profileError) {
      console.error("username recognition lookup:", profileError.message);
      return NextResponse.json({ recognized: false }, { status: 503 });
    }
    if (!profiles || profiles.length !== 1) {
      return NextResponse.json({ recognized: false });
    }

    const profile = profiles[0];
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
    if (userError || !userData.user || !isFinalizedNaxaProfile(profile, userData.user)) {
      return NextResponse.json({ recognized: false });
    }

    return NextResponse.json({ recognized: true });
  } catch {
    return NextResponse.json({ recognized: false }, { status: 400 });
  }
}
