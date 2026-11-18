import { NextResponse } from "next/server";
import { authorizeSupportAgent } from "@/lib/support/agent-auth";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: { password?: string; confirmation?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  }

  const password = String(body.password ?? "");
  const confirmation = String(body.confirmation ?? "");
  if (password.length < 12 || password.length > 128
    || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)
    || password !== confirmation) {
    return NextResponse.json({
      error: "Choisissez un mot de passe de 12 caractères minimum avec minuscules, majuscules et chiffres ; les deux saisies doivent correspondre.",
    }, { status: 400 });
  }

  const access = await authorizeSupportAgent(undefined, true);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!access.agent.must_change_password) {
    return NextResponse.json({ error: "Aucun remplacement initial n’est requis." }, { status: 409 });
  }

  const session = supabaseServer();
  const { error: passwordError } = await session.auth.updateUser({ password });
  if (passwordError) {
    return NextResponse.json({ error: "Le mot de passe n’a pas pu être remplacé." }, { status: 400 });
  }

  const { error: profileError } = await access.db.from("support_agents")
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq("user_id", access.user.id)
    .eq("status", "active");

  if (profileError) {
    return NextResponse.json({ error: "Mot de passe changé ; finalisation du compte à réessayer." }, { status: 503 });
  }

  await access.db.from("support_agent_events").insert({
    actor_user_id: access.user.id,
    agent_user_id: access.user.id,
    event_code: "initial_password_rotated",
    details: { method: "authenticated_self_service" },
  });

  return NextResponse.json({ success: true });
}
