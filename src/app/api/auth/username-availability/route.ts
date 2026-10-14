import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
      return NextResponse.json({ valid: false, available: false });
    }

    const admin = supabaseAdmin();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, username")
      .ilike("username", username)
      .maybeSingle();

    if (error) {
      console.error("username availability lookup:", error.message);
      return NextResponse.json({ valid: true, available: false }, { status: 500 });
    }
    if (!profile) return NextResponse.json({ valid: true, available: true });

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
    if (userError) {
      console.error("username availability auth lookup:", userError.message);
      return NextResponse.json({ valid: true, available: false }, { status: 503 });
    }

    // Les profils provisoires générés par le trigger Auth ne réservent pas le nom.
    if (userData.user && !isFinalizedNaxaProfile(profile, userData.user)) {
      return NextResponse.json({ valid: true, available: true, pendingSignup: true });
    }

    return NextResponse.json({ valid: true, available: false });
  } catch {
    return NextResponse.json({ valid: false, available: false }, { status: 400 });
  }
}
