import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";

export async function POST(request: Request) {
  try {
    const { username, token } = await request.json();
    const normalized = String(username ?? "").trim().toLowerCase();
    const code = String(token ?? "").trim();

    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(normalized) || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Code incorrect ou expiré." }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin()
      .from("profiles")
      .select("id, username")
      .ilike("username", normalized)
      .maybeSingle();

    if (!profile) return NextResponse.json({ error: "Code incorrect ou expiré." }, { status: 400 });

    const { data: userData } = await supabaseAdmin().auth.admin.getUserById(profile.id);
    const email = userData.user?.email;
    if (!email || !isFinalizedNaxaProfile(profile, userData.user)) {
      return NextResponse.json({ error: "Code incorrect ou expiré." }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true });
    const supabase = supabaseServer(response);
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });

    if (error || !data.session) {
      return NextResponse.json({ error: "Code incorrect ou expiré." }, { status: 400 });
    }

    return response;
  } catch {
    return NextResponse.json({ error: "Code incorrect ou expiré." }, { status: 400 });
  }
}
