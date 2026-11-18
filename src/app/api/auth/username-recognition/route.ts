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
      .eq("username", username)
      .limit(2);

    if (profileError) {
      console.error("username recognition lookup:", profileError.message);
      return NextResponse.json({ recognized: false }, { status: 503 });
    }
    if (profiles && profiles.length === 1) {
      const profile = profiles[0];
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
      if (userError || !userData.user || !isFinalizedNaxaProfile(profile, userData.user)) {
        return NextResponse.json({ recognized: false });
      }
      return NextResponse.json({ recognized: true });
    }
    if (profiles && profiles.length > 1) return NextResponse.json({ recognized: false });

    // Identité Agent dédiée : aucun profil métier n'est attendu.
    const { data: agents, error: agentError } = await admin
      .from("support_agents")
      .select("user_id,status")
      .eq("username", username)
      .limit(2);
    if (agentError || !agents || agents.length !== 1 || agents[0].status !== "active") {
      return NextResponse.json({ recognized: false });
    }

    const { data: agentAuth, error: agentAuthError } = await admin.auth.admin.getUserById(agents[0].user_id);
    if (agentAuthError || !agentAuth.user?.email_confirmed_at) {
      return NextResponse.json({ recognized: false });
    }

    return NextResponse.json({ recognized: true });
  } catch {
    return NextResponse.json({ recognized: false }, { status: 400 });
  }
}
