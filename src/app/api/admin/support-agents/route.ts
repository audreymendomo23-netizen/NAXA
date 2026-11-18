import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_PERMISSIONS = new Set([
  "queue_view","ticket_view_assigned","ticket_reply","ticket_internal_note","attachments_read",
]);

async function requireActiveAdmin() {
  const session = supabaseServer();
  const { data: auth, error: authError } = await session.auth.getUser();
  if (authError || !auth.user) {
    return { ok: false as const, response: NextResponse.json({ error: "Connexion requise." }, { status: 401 }) };
  }

  const [{ data: profile, error: profileError }, { data: role, error: roleError }] = await Promise.all([
    session.from("profiles").select("role,actif").eq("id", auth.user.id).maybeSingle(),
    session.rpc("naxa_business_function"),
  ]);

  if (profileError || roleError || profile?.role !== "admin" || profile.actif !== true || role !== "admin") {
    return { ok: false as const, response: NextResponse.json({ error: "Action réservée à l’Administrateur NAXA actif." }, { status: 403 }) };
  }

  return { ok: true as const, user: auth.user, db: supabaseAdmin() };
}

export async function GET() {
  const admin = await requireActiveAdmin();
  if (!admin.ok) return admin.response;

  const { data: agents, error } = await admin.db.from("support_agents")
    .select("user_id,username,first_name,last_name,display_name,status,presence,must_change_password,created_at,last_seen_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "La liste des Agents est indisponible." }, { status: 500 });

  const ids = (agents ?? []).map((agent) => agent.user_id);
  const { data: permissions, error: permissionError } = ids.length
    ? await admin.db.from("support_agent_permissions")
        .select("agent_user_id,permission_code,granted_at")
        .in("agent_user_id", ids)
        .is("revoked_at", null)
    : { data: [], error: null };

  if (permissionError) return NextResponse.json({ error: "Les permissions Agent sont indisponibles." }, { status: 500 });

  const grants = new Map<string, string[]>();
  (permissions ?? []).forEach((permission) => {
    const list = grants.get(permission.agent_user_id) ?? [];
    list.push(permission.permission_code);
    grants.set(permission.agent_user_id, list);
  });

  return NextResponse.json({
    agents: (agents ?? []).map((agent) => ({
      ...agent,
      permissions: grants.get(agent.user_id) ?? [],
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const admin = await requireActiveAdmin();
  if (!admin.ok) return admin.response;

  let body: {
    username?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    permissions?: string[];
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Données Agent invalides." }, { status: 400 });
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  const email = String(body.email ?? "").trim().toLowerCase();
  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const requestedPermissions = Array.isArray(body.permissions) ? [...new Set(body.permissions)] : [
    "queue_view","ticket_view_assigned","ticket_reply",
  ];

  if (!USERNAME.test(username) || !EMAIL.test(email)
    || firstName.length < 2 || firstName.length > 80
    || lastName.length < 2 || lastName.length > 80
    || requestedPermissions.some((permission) => typeof permission !== "string" || !ALLOWED_PERMISSIONS.has(permission))
    || !requestedPermissions.includes("ticket_view_assigned")) {
    return NextResponse.json({ error: "Identité, email ou permissions invalides." }, { status: 400 });
  }

  const [{ data: existingProfile, error: profileError }, { data: existingAgent, error: agentError }] = await Promise.all([
    admin.db.from("profiles").select("id").eq("username", username).maybeSingle(),
    admin.db.from("support_agents").select("user_id").eq("username", username).maybeSingle(),
  ]);
  if (profileError || agentError) return NextResponse.json({ error: "Vérification d’unicité impossible." }, { status: 503 });
  if (existingProfile || existingAgent) return NextResponse.json({ error: "Ce nom d’utilisateur existe déjà." }, { status: 409 });

  const temporaryPassword = randomBytes(24).toString("base64url") + "Aa1";
  const { data: created, error: authCreateError } = await admin.db.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { naxa_signup_pending: true, username },
  });
  if (authCreateError || !created.user) {
    return NextResponse.json({ error: "Le compte Auth Agent n’a pas pu être créé." }, { status: 400 });
  }

  const userId = created.user.id;
  const { error: insertError } = await admin.db.from("support_agents").insert({
    user_id: userId,
    username,
    first_name: firstName,
    last_name: lastName,
    status: "active",
    presence: "unavailable",
    must_change_password: true,
    created_by: admin.user.id,
    updated_by: admin.user.id,
  });

  if (insertError) {
    await admin.db.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Le profil Agent n’a pas pu être enregistré." }, { status: 500 });
  }

  if (requestedPermissions.length) {
    const { error: permissionInsertError } = await admin.db.from("support_agent_permissions").insert(
      requestedPermissions.map((permission_code) => ({
        agent_user_id: userId,
        permission_code,
        granted_by: admin.user.id,
      })),
    );
    if (permissionInsertError) {
      await admin.db.from("support_agents").delete().eq("user_id", userId);
      await admin.db.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Les permissions initiales n’ont pas pu être attribuées." }, { status: 500 });
    }
  }

  const { error: eventError } = await admin.db.from("support_agent_events").insert({
    actor_user_id: admin.user.id,
    agent_user_id: userId,
    event_code: "agent_created",
    details: { username, permissions: requestedPermissions },
  });
  if (eventError) {
    await admin.db.from("support_agent_permissions").delete().eq("agent_user_id", userId);
    await admin.db.from("support_agents").delete().eq("user_id", userId);
    await admin.db.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Le journal de création Agent n’a pas été enregistré." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    agent: { user_id: userId, username, first_name: firstName, last_name: lastName, status: "active" },
    temporary_password: temporaryPassword,
    must_share_password_securely: true,
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}


export async function PATCH(request: Request) {
  const admin = await requireActiveAdmin();
  if (!admin.ok) return admin.response;

  let body: {
    user_id?: string;
    status?: string;
    presence?: string;
    permissions?: string[];
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Données de mise à jour invalides." }, { status: 400 });
  }

  const userId = String(body.user_id ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: "Identifiant Agent invalide." }, { status: 400 });
  }

  const { data: current, error: currentError } = await admin.db.from("support_agents")
    .select("status,presence")
    .eq("user_id", userId)
    .maybeSingle();
  if (currentError || !current) return NextResponse.json({ error: "Agent introuvable." }, { status: 404 });

  const status = body.status ?? current.status;
  const presence = body.presence ?? current.presence;
  const permissions = body.permissions === undefined ? null : [...new Set(body.permissions)];

  if (!["active","suspended","revoked"].includes(status)
    || !["available","unavailable"].includes(presence)
    || (permissions && permissions.some((permission) => !ALLOWED_PERMISSIONS.has(permission)))) {
    return NextResponse.json({ error: "Statut, présence ou permissions invalides." }, { status: 400 });
  }

  const { error } = await admin.db.rpc("support_agent_admin_update", {
    p_agent_user_id: userId,
    p_actor_user_id: admin.user.id,
    p_status: status,
    p_presence: presence,
    p_permissions: permissions,
  });

  if (error) {
    const statusCode = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
    return NextResponse.json({ error: "La mise à jour Agent a été refusée : " + error.message }, { status: statusCode });
  }

  return NextResponse.json({ success: true, user_id: userId, status, presence: status === "active" ? presence : "unavailable" });
}
