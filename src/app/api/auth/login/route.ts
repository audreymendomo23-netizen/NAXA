import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";
import { rateLimit, tooManyAttempts, trustedRequestIp } from "@/lib/pharmacie-rate-limit";

const PROFESSIONAL_ROLES = ["pharmacie", "promoteur", "caisse"] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const requestedSpace = body.espace === "pharmacie" || body.espace === "client" ? body.espace : "auto";

    if (!username || !password) {
      return NextResponse.json({ error: "Nom d'utilisateur et mot de passe requis." }, { status: 400 });
    }

    const loginIp = trustedRequestIp(request);
    const loginKey = "login:" + username;
    const ipGate = await rateLimit("ip_login", loginIp, "attempt", 5, 600, 30, 900);
    if (!ipGate.allowed) return tooManyAttempts(ipGate.retryAfter);
    const userGate = await rateLimit("login_user", loginKey, "attempt", 20, 3600, 900, 900);
    if (!userGate.allowed) return tooManyAttempts(userGate.retryAfter);

    const admin = supabaseAdmin();
    const { data: matchingProfiles, error: profileLookupError } = await admin
      .from("profiles")
      .select("id,username,actif,role,pharmacie_id,first_name,last_name,phone,date_of_birth,age_verified,consent_accepted_at")
      .ilike("username", username)
      .limit(2);
    if (profileLookupError || !matchingProfiles || matchingProfiles.length !== 1) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    const profile = matchingProfiles[0] as Record<string, unknown>;
    const role = String(profile.role ?? "");
    const active = profile.actif === true;
    const espacePharmacie = requestedSpace === "pharmacie"
      || (requestedSpace === "auto" && active && PROFESSIONAL_ROLES.includes(role as (typeof PROFESSIONAL_ROLES)[number]));
    const espaceClient = requestedSpace === "client" || (requestedSpace === "auto" && role === "client");
    const hasClientIdentity = Boolean(
      profile.username && profile.first_name && profile.last_name && profile.phone
      && profile.date_of_birth && profile.age_verified === true && profile.consent_accepted_at,
    );

    if (espacePharmacie) {
      if (!active || !PROFESSIONAL_ROLES.includes(role as (typeof PROFESSIONAL_ROLES)[number])) {
        return NextResponse.json({ error: "Accès professionnel suspendu ou non attribué." }, { status: 403 });
      }

      if (role === "promoteur") {
        const { data: links, error: linksError } = await admin
          .from("promoteur_pharmacies")
          .select("pharmacie_id")
          .eq("promoteur_id", String(profile.id))
          .eq("actif", true);
        const pharmacyIds = [...new Set((links ?? []).map((link) => link.pharmacie_id).filter(Boolean))];
        if (linksError || pharmacyIds.length === 0) {
          return NextResponse.json({ error: "Aucune pharmacie active n'est rattachée à ce compte." }, { status: 403 });
        }
        const { data: pharmacies, error: pharmaciesError } = await admin
          .from("pharmacies")
          .select("id")
          .in("id", pharmacyIds)
          .eq("actif", true)
          .eq("visible_recherche", true);
        if (pharmaciesError || !pharmacies?.length) {
          return NextResponse.json({ error: "Aucune pharmacie active n'est accessible à ce compte." }, { status: 403 });
        }
      } else {
        const pharmacyId = String(profile.pharmacie_id ?? "");
        if (!pharmacyId) {
          return NextResponse.json({ error: "Ce compte n'est lié à aucune pharmacie." }, { status: 403 });
        }
        const { data: pharmacy, error: pharmacyError } = await admin
          .from("pharmacies")
          .select("id")
          .eq("id", pharmacyId)
          .eq("actif", true)
          .eq("visible_recherche", true)
          .maybeSingle();
        if (pharmacyError || !pharmacy) {
          return NextResponse.json({ error: "Cette pharmacie est suspendue ou indisponible." }, { status: 403 });
        }
      }
    } else if (espaceClient) {
      // La révocation professionnelle ne désactive pas l'identité client d'un employé.
      // Un compte client désactivé reste toutefois bloqué.
      if (role === "client" && !active) {
        return NextResponse.json({ error: "Ce compte utilisateur est désactivé." }, { status: 403 });
      }
      if (role !== "client" && !hasClientIdentity) {
        return NextResponse.json({ error: "Cet identifiant ne dispose pas d'un espace client activé." }, { status: 403 });
      }
    } else if (!(requestedSpace === "auto" && role === "admin" && active)) {
      return NextResponse.json({ error: "Aucun espace autorisé n'est associé à ce compte." }, { status: 403 });
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(String(profile.id));
    const email = userData.user?.email;
    if (userError || !email || !userData.user
      || !isFinalizedNaxaProfile({ id: String(profile.id), username: String(profile.username ?? "") }, userData.user)) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    const { error: signInError } = await supabaseServer().auth.signInWithPassword({ email, password });
    if (signInError) return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });

    await rateLimit("ip_login", loginIp, "success", 5, 600, 30, 900);
    await rateLimit("login_user", loginKey, "success", 20, 3600, 900, 900);
    return NextResponse.json({ ok: true, espace: espacePharmacie ? "pharmacie" : espaceClient ? "client" : "admin" });
  } catch {
    return NextResponse.json({ error: "Connexion momentanément indisponible." }, { status: 500 });
  }
}
