import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
      return NextResponse.json({ valid: false, available: false });
    }

    const admin = supabaseAdmin();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (error) {
      console.error("username availability lookup:", error.message);
      return NextResponse.json({ valid: true, available: false }, { status: 500 });
    }
    if (!profile) return NextResponse.json({ valid: true, available: true });

    // Autoriser uniquement la reprise du même nom sur le même compte non confirmé.
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
      if (!userError && userData.user
        && userData.user.email?.trim().toLowerCase() === email
        && !userData.user.email_confirmed_at) {
        return NextResponse.json({ valid: true, available: true, pendingSignup: true });
      }
    }

    return NextResponse.json({ valid: true, available: false });
  } catch {
    return NextResponse.json({ valid: false, available: false }, { status: 400 });
  }
}
