import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";
import { rateLimit, tooManyAttempts, trustedRequestIp } from "@/lib/pharmacie-rate-limit";

const PHARMACY_ROLE_CODES = new Set([
  "pharmacie",
  "promoteur",
  "caisse",
  "responsable",
  "comptable",
  "pharmacien",
  "gestionnaire_stock",
  "magasinier",
  "livreur",
]);

export async function POST(request: NextRequest) {
  let phase = "request_body";
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const remember = body.remember !== false;
    const requestedSpace = body.espace === "pharmacie" || body.espace === "client" ? body.espace : "auto";

    if (!username || !password) {
      return NextResponse.json({ error: "Nom d'utilisateur et mot de passe requis." }, { status: 400 });
    }

    const loginIp = trustedRequestIp(request);
    const loginKey = "login:" + username;
    phase = "rate_limit_ip";
    const ipGate = await rateLimit("ip_login", loginIp, "attempt", 5, 600, 30, 900);
    if (!ipGate.allowed) return tooManyAttempts(ipGate.retryAfter);
    phase = "rate_limit_user";
    const userGate = await rateLimit("login_user", loginKey, "attempt", 20, 3600, 900, 900);
    if (!userGate.allowed) return tooManyAttempts(userGate.retryAfter);

    phase = "profile_lookup";
    const admin = supabaseAdmin();
    const { data: matchingProfiles, error: profileLookupError } = await admin
      .from("profiles")
      .select("id,username,actif,role,pharmacie_id,first_name,last_name,phone,date_of_birth,age_verified,consent_accepted_at")
      .eq("username", username)
      .limit(2);
    if (profileLookupError || !matchingProfiles) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    // Les Agents du service client ont une identité Auth dédiée, sans ligne profiles
    // et sans rôle métier. Leur authentification reste strictement séparée.
    if (matchingProfiles.length === 0) {
      phase = "support_agent_lookup";
      const { data: agents, error: agentLookupError } = await admin
        .from("support_agents")
        .select("user_id,username,status,must_change_password,consent_accepted_at")
        .eq("username", username)
        .limit(2);
      if (agentLookupError || !agents || agents.length !== 1) {
        return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
      }

      const agent = agents[0];
      if (agent.status !== "active") {
        return NextResponse.json({ error: "Compte Agent suspendu ou inactif." }, { status: 403 });
      }

      phase = "support_agent_auth_lookup";
      const { data: agentAuth, error: agentAuthError } = await admin.auth.admin.getUserById(agent.user_id);
      const agentEmail = agentAuth.user?.email;
      if (agentAuthError || !agentAuth.user || !agentEmail || !agentAuth.user.email_confirmed_at) {
        return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
      }

      phase = "support_agent_password_sign_in";
      const supabase = supabaseServer(undefined, { remember });
      const { error: agentSignInError } = await supabase.auth.signInWithPassword({
        email: agentEmail,
        password,
      });
      if (agentSignInError) {
        return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
      }

      phase = "support_agent_rate_limit_success";
      await rateLimit("ip_login", loginIp, "success", 5, 600, 30, 900);
      await rateLimit("login_user", loginKey, "success", 20, 3600, 900, 900);
      return NextResponse.json({ ok: true, espace: "support_agent", must_change_password: agent.must_change_password === true || !agent.consent_accepted_at });
    }

    if (matchingProfiles.length !== 1) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    const profile = matchingProfiles[0] as Record<string, unknown>;
    const rootRole = String(profile.role ?? "");
    const active = profile.actif === true;
    const hasClientIdentity = Boolean(
      profile.username && profile.first_name && profile.last_name && profile.phone
      && profile.date_of_birth && profile.age_verified === true && profile.consent_accepted_at,
    );

    if (!active) {
      return NextResponse.json({ error: "Compte professionnel ou client suspendu." }, { status: 403 });
    }

    phase = "auth_user_lookup";
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(String(profile.id));
    const email = userData.user?.email;
    if (userError || !email || !userData.user
      || !isFinalizedNaxaProfile({ id: String(profile.id), username: String(profile.username ?? "") }, userData.user)) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    // Resolve the active business function only after password authentication.
    // This is the same auth.uid()-scoped resolver used by the native session API.
    phase = "password_sign_in";
    const supabase = supabaseServer(undefined, { remember });
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });

    phase = "active_role_resolution";
    const { data: resolvedRole, error: roleError } = await supabase.rpc("naxa_business_function");
    if (roleError) {
      await supabase.auth.signOut({ scope: "local" });
      return NextResponse.json({ error: "Contexte professionnel momentanément indisponible." }, { status: 503 });
    }
    const activeRole = typeof resolvedRole === "string" ? resolvedRole.trim() : "";
    const espacePharmacie = requestedSpace === "pharmacie"
      || (requestedSpace === "auto" && PHARMACY_ROLE_CODES.has(activeRole));
    // A user whose last selected professional context is SPD must still be able
    // to authenticate into the permanent Client space. The workspace switcher
    // can then activate the already-authorized SPD membership without a second Auth identity.
    const espaceClient = requestedSpace === "client"
      || (requestedSpace === "auto" && (
        activeRole === "client"
        || (activeRole !== "admin" && !PHARMACY_ROLE_CODES.has(activeRole) && hasClientIdentity)
      ));

    if (espacePharmacie) {
      if (!PHARMACY_ROLE_CODES.has(activeRole)) {
        await supabase.auth.signOut({ scope: "local" });
        return NextResponse.json({ error: "Accès professionnel suspendu ou non attribué." }, { status: 403 });
      }

      if (activeRole === "promoteur") {
        const { data: links, error: linksError } = await admin
          .from("promoteur_pharmacies")
          .select("pharmacie_id")
          .eq("promoteur_id", String(profile.id))
          .eq("actif", true);
        const pharmacyIds = [...new Set((links ?? []).map((link) => link.pharmacie_id).filter(Boolean))];
        if (linksError || pharmacyIds.length === 0) {
          await supabase.auth.signOut({ scope: "local" });
          return NextResponse.json({ error: "Aucune pharmacie active n'est rattachée à ce compte." }, { status: 403 });
        }
        const { data: pharmacies, error: pharmaciesError } = await admin
          .from("pharmacies")
          .select("id,actif,archivee_le")
          .in("id", pharmacyIds)
          .eq("actif", true)
          .is("archivee_le", null);
        if (pharmaciesError || !pharmacies?.length) {
          await supabase.auth.signOut({ scope: "local" });
          return NextResponse.json({ error: "Aucune pharmacie active n'est accessible à ce compte." }, { status: 403 });
        }
      } else {
        const { data: pharmacyId, error: pharmacyScopeError } = await supabase.rpc("naxa_active_role_pharmacy");
        if (pharmacyScopeError || typeof pharmacyId !== "string" || !pharmacyId) {
          await supabase.auth.signOut({ scope: "local" });
          return NextResponse.json({ error: "Aucune pharmacie active n'est liée à ce rôle." }, { status: 403 });
        }
        const { data: pharmacy, error: pharmacyError } = await admin
          .from("pharmacies")
          .select("id,actif,archivee_le")
          .eq("id", pharmacyId)
          .eq("actif", true)
          .is("archivee_le", null)
          .maybeSingle();
        if (pharmacyError || !pharmacy) {
          await supabase.auth.signOut({ scope: "local" });
          return NextResponse.json({ error: "Cette pharmacie est suspendue ou indisponible." }, { status: 403 });
        }
      }
    } else if (espaceClient) {
      // La révocation professionnelle ne désactive pas l'identité client d'un employé.
      // Un compte client désactivé reste toutefois bloqué.
      if (rootRole === "client" && !active) {
        await supabase.auth.signOut({ scope: "local" });
        return NextResponse.json({ error: "Ce compte utilisateur est désactivé." }, { status: 403 });
      }
      if (rootRole !== "client" && !hasClientIdentity) {
        await supabase.auth.signOut({ scope: "local" });
        return NextResponse.json({ error: "Cet identifiant ne dispose pas d'un espace client activé." }, { status: 403 });
      }
      // Do not only redirect to Client: activate its independent workspace context
      // so server guards and RLS no longer inherit the previously selected SPD/pharmacy role.
      const { error: clientContextError } = await supabase.rpc("naxa_select_active_role", {
        p_role_code: "client",
        p_pharmacie_id: null,
        p_partner_id: null,
      });
      if (clientContextError) {
        await supabase.auth.signOut({ scope: "local" });
        return NextResponse.json({ error: "Espace Client momentanément indisponible." }, { status: 503 });
      }
    } else if (!(requestedSpace === "auto" && activeRole === "admin" && rootRole === "admin")) {
      await supabase.auth.signOut({ scope: "local" });
      return NextResponse.json({ error: "Aucun espace autorisé n'est associé à ce compte." }, { status: 403 });
    }

    phase = "rate_limit_success_ip";
    await rateLimit("ip_login", loginIp, "success", 5, 600, 30, 900);
    phase = "rate_limit_success_user";
    await rateLimit("login_user", loginKey, "success", 20, 3600, 900, 900);
    return NextResponse.json({ ok: true, espace: espacePharmacie ? "pharmacie" : espaceClient ? "client" : "admin" });
  } catch (error) {
    const errorCode = typeof error === "object" && error !== null
      && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;
    console.error("NAXA_AUTH_LOGIN_FAILURE", {
      phase,
      errorName: error instanceof Error ? error.name : "UnknownError",
      ...(errorCode ? { errorCode } : {}),
    });
    return NextResponse.json({ error: "Connexion momentanément indisponible." }, { status: 500 });
  }
}
