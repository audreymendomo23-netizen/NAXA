#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { randomBytes } = require("node:crypto");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const EMAIL = "naxa.e2e.livreur@example.invalid";
const USERNAME = "naxa_e2e_livreur";
const PHONE = "+237600000099";
const FIXTURE_MARKER = "NAXA-E2E-LIVREUR-20261115";
const PERSONA = "livreur";

function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (
    url.protocol !== "https:"
    || url.hostname !== PROJECT_REF + ".supabase.co"
    || !["", "/"].includes(url.pathname)
  ) {
    throw new Error("Sécurité : provisionnement Livreur limité au projet Replay " + PROJECT_REF + ".");
  }
  return url.origin;
}

function buildCourierMetadata() {
  return {
    username: USERNAME,
    first_name: "Compte",
    last_name: "Livreur E2E",
    phone: PHONE,
    phone_country: "CM",
    date_of_birth: "1990-01-01",
    consent_accepted: true,
    naxa_signup_completed: true,
    naxa_signup_pending: false,
    naxa_e2e_fixture: FIXTURE_MARKER,
    naxa_e2e_persona: PERSONA,
  };
}

function assertCourierFixture(user, profile) {
  if (!user || !profile) throw new Error("Fixture Auth Client/Livreur introuvable.");
  if (String(user.email || "").trim().toLowerCase() !== EMAIL) {
    throw new Error("L'adresse ne correspond pas à la fixture Livreur attendue.");
  }
  if (!user.id || profile.id !== user.id) {
    throw new Error("Le profil Client n'est pas lié à l'identité Auth attendue.");
  }
  if (!user.email_confirmed_at) {
    throw new Error("La fixture Livreur doit déjà être confirmée.");
  }
  const metadata = user.user_metadata || user.raw_user_meta_data || {};
  if (
    metadata.naxa_e2e_fixture !== FIXTURE_MARKER
    || metadata.naxa_e2e_persona !== PERSONA
    || metadata.username !== USERNAME
  ) {
    throw new Error("L'identité ne porte pas les marqueurs exacts de fixture Livreur.");
  }
  if (
    profile.role !== "client"
    || profile.actif !== true
    || profile.age_verified !== true
    || !profile.consent_accepted_at
    || profile.username !== USERNAME
    || !profile.first_name
    || !profile.last_name
    || !profile.phone
    || !profile.date_of_birth
  ) {
    throw new Error("Le profil Client doit rester complet, majeur, consentant et actif avant l'invitation.");
  }
  return true;
}

function generateEphemeralPassword() {
  return randomBytes(32).toString("base64url") + "Aa!9";
}

async function provision(env = process.env) {
  const baseUrl = assertReplayUrl(env.SUPABASE_URL || env.NAXA_STORAGE_E2E_URL || "");
  const adminKey = String(env.SUPABASE_SERVICE_ROLE_KEY || env.NAXA_STORAGE_E2E_ADMIN_KEY || "").trim();
  const anonKey = String(env.NAXA_STORAGE_E2E_ANON_KEY || "").trim();
  const pharmacyId = String(env.NAXA_STORAGE_E2E_PROMOTEUR_PHARMACY_ID || "").trim();
  const otherPharmacyId = String(env.NAXA_STORAGE_E2E_OTHER_PHARMACY_ID || "").trim();
  const promoterEmail = String(env.NAXA_STORAGE_E2E_PROMOTEUR_EMAIL || "").trim();
  const promoterPasswordFile = String(env.NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD_FILE || "").trim();

  if (!adminKey || !anonKey) throw new Error("Clés Replay Admin et anon requises.");
  if (!pharmacyId || !otherPharmacyId || !promoterEmail || !promoterPasswordFile) {
    throw new Error("Le Promoteur, ses deux pharmacies et le fichier secret Promoteur doivent être préparés avant le test Livreur.");
  }
  if (!env.GITHUB_ENV || !env.RUNNER_TEMP) {
    throw new Error("Provisionnement autorisé uniquement dans un job GitHub Actions avec stockage temporaire.");
  }

  if (!fs.existsSync(promoterPasswordFile)) {
    throw new Error("Le fichier de mot de passe Promoteur est introuvable.");
  }

  const promoterPassword = fs.readFileSync(promoterPasswordFile, "utf8");
  if (!promoterPassword) throw new Error("Le fichier de mot de passe Promoteur est vide.");

  async function request(path, options = {}) {
    const apiKey = options.apiKey || anonKey;
    const headers = { apikey: apiKey, "Content-Type": "application/json" };
    if (options.accessToken) headers.Authorization = "Bearer " + options.accessToken;
    else if (!apiKey.startsWith("sb_secret_") && !apiKey.startsWith("sb_publishable_")) {
      headers.Authorization = "Bearer " + apiKey;
    }
    const response = await fetch(baseUrl + path, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* corps Auth jamais journalisé */ }
    return { ok: response.ok, status: response.status, data };
  }

  async function adminRequest(path, method = "GET", body) {
    const result = await request(path, {
      method,
      apiKey: adminKey,
      body,
    });
    if (!result.ok) {
      const code = result.data && typeof result.data.code === "string" ? " (" + result.data.code + ")" : "";
      throw new Error("Supabase a refusé le provisionnement Livreur (HTTP " + result.status + code + ").");
    }
    return result.data;
  }

  async function restAdmin(path) {
    return adminRequest("/rest/v1/" + path);
  }

  async function rpc(path, accessToken, args) {
    return request("/rest/v1/rpc/" + path, {
      method: "POST",
      accessToken,
      body: args,
    });
  }

  async function login(email, password, label) {
    const result = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password },
    });
    if (!result.ok || !result.data?.access_token || !result.data?.user?.id) {
      throw new Error("Connexion du compte " + label + " impossible (HTTP " + result.status + ").");
    }
    roleSessions.push(result.data.access_token);
    return { id: result.data.user.id, token: result.data.access_token };
  }

  async function logoutRoleSession(accessToken) {
    const result = await request("/auth/v1/logout?scope=local", {
      method: "POST",
      accessToken,
    });
    if (!result.ok && result.status !== 401 && result.status !== 404) {
      throw new Error("Fermeture locale d'une session E2E Livreur/Promoteur impossible (HTTP " + result.status + ").");
    }
  }

  async function findAuthFixtureUsers() {
    const matches = [];
    let inspected = 0;
    for (let page = 1; page <= 20; page += 1) {
      const listed = await adminRequest("/auth/v1/admin/users?page=" + page + "&per_page=50");
      const users = Array.isArray(listed?.users)
        ? listed.users
        : Array.isArray(listed?.data?.users)
          ? listed.data.users
          : Array.isArray(listed)
            ? listed
            : [];
      inspected += users.length;
      matches.push(...users.filter(x => String(x.email || "").trim().toLowerCase() === EMAIL));
      if (users.length < 50) break;
    }
    if (matches.length > 1) {
      throw new Error("Plusieurs identités Auth portent l'e-mail de la fixture Livreur ; aucune modification.");
    }
    return { matches, inspected };
  }

  let matches = [];
  let inspected = 0;
  let passwordFile = null;
  let failed = false;
  const roleSessions = [];
  try {
    const authFixtures = await findAuthFixtureUsers();
    matches = authFixtures.matches;
    inspected = authFixtures.inspected;

  const password = generateEphemeralPassword();
  passwordFile = env.RUNNER_TEMP + "/naxa-e2e-livreur-" + randomBytes(8).toString("hex") + ".secret";
  fs.writeFileSync(passwordFile, password, { encoding: "utf8", flag: "wx", mode: 0o600 });
  fs.appendFileSync(
    env.GITHUB_ENV,
    "NAXA_STORAGE_E2E_LIVREUR_EMAIL=" + EMAIL + "\n"
      + "NAXA_STORAGE_E2E_LIVREUR_PASSWORD_FILE=" + passwordFile + "\n",
    { encoding: "utf8", mode: 0o600 }
  );

  let user = matches[0] || null;
  if (!user) {
    const created = await adminRequest("/auth/v1/admin/users", "POST", {
      email: EMAIL,
      password,
      email_confirm: true,
      user_metadata: buildCourierMetadata(),
    });
    user = created?.user || created;
    if (!user?.id) throw new Error("Supabase Auth n'a pas retourné l'identité Livreur.");
  } else {
    const existingProfile = await restAdmin(
      "profiles?select=id,role,actif,age_verified,consent_accepted_at,username,first_name,last_name,phone,date_of_birth&id=eq."
        + encodeURIComponent(user.id) + "&limit=2"
    );
    if (!Array.isArray(existingProfile) || existingProfile.length !== 1) {
      throw new Error("Le profil de la fixture Livreur doit exister exactement une fois.");
    }
    assertCourierFixture(user, existingProfile[0]);
    // Fixture dédiée : seul le mot de passe de test est renouvelé.
    await adminRequest("/auth/v1/admin/users/" + encodeURIComponent(user.id), "PUT", { password });
  }

  const verifiedFixtures = await findAuthFixtureUsers();
  if (verifiedFixtures.matches.length !== 1) {
    throw new Error("L'identité Livreur n'est plus unique après provisionnement.");
  }
  user = verifiedFixtures.matches[0];

  const profiles = await restAdmin(
    "profiles?select=id,role,actif,age_verified,consent_accepted_at,username,first_name,last_name,phone,date_of_birth,fonction_interne&id=eq."
      + encodeURIComponent(user.id) + "&limit=2"
  );
  if (!Array.isArray(profiles) || profiles.length !== 1) {
    throw new Error("Le profil Client créé par handle_new_user() est absent.");
  }
  assertCourierFixture(user, profiles[0]);

  const promoter = await login(promoterEmail, promoterPassword, "Promoteur E2E");
  const existingAssignments = await restAdmin(
    "naxa_professional_assignments?select=id,pharmacie_id,role_code,statut,expire_at"
      + "&profile_id=eq." + encodeURIComponent(user.id)
      + "&statut=eq.active&limit=100"
  );
  if (existingAssignments.some(a => a.role_code !== "livreur")) {
    throw new Error("La fixture Livreur possède déjà un autre poste professionnel actif.");
  }
  if (existingAssignments.some(a => a.pharmacie_id !== pharmacyId)) {
    throw new Error("La fixture Livreur est déjà affectée à une autre pharmacie ; aucun multi-rattachement implicite.");
  }

  let assignment = existingAssignments.find(
    a => a.role_code === "livreur" && a.pharmacie_id === pharmacyId
      && (!a.expire_at || new Date(a.expire_at).getTime() > Date.now())
  );

  if (!assignment) {
    const invite = await rpc("naxa_create_livreur_invite", promoter.token, {
      p_pharmacie: pharmacyId,
      p_email: EMAIL,
    });
    if (!invite.ok || typeof invite.data !== "string" || !invite.data) {
      throw new Error("Création de l'invitation Livreur refusée (HTTP " + invite.status + ").");
    }

    const courier = await login(EMAIL, password, "Client Livreur E2E");
    if (courier.id !== user.id) throw new Error("La session Livreur ne correspond pas à la fixture Auth.");

    const accepted = await rpc("naxa_accept_livreur_invite", courier.token, { p_token: invite.data });
    if (!accepted.ok || accepted.data?.accepted !== true || accepted.data?.role !== "livreur") {
      throw new Error("Acceptation de l'invitation Livreur refusée (HTTP " + accepted.status + ").");
    }

    const rows = await restAdmin(
      "naxa_professional_assignments?select=id,pharmacie_id,role_code,statut,nature_affectation,expire_at"
        + "&profile_id=eq." + encodeURIComponent(user.id)
        + "&pharmacie_id=eq." + encodeURIComponent(pharmacyId)
        + "&role_code=eq.livreur&statut=eq.active&limit=2"
    );
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error("Une unique affectation Livreur active devait être créée après acceptation.");
    }
    assignment = rows[0];
    if (assignment.nature_affectation !== "ordinaire" || assignment.expire_at !== null) {
      throw new Error("Le compte Livreur indépendant doit recevoir une affectation permanente ordinaire.");
    }

    const acceptedInvites = await restAdmin(
      "naxa_livreur_invites?select=token,assignment_id,accepted_by,accepted_at"
        + "&pharmacie_id=eq." + encodeURIComponent(pharmacyId)
        + "&accepted_by=eq." + encodeURIComponent(user.id)
        + "&assignment_id=eq." + encodeURIComponent(assignment.id)
        + "&accepted_at=not.is.null&revoked_at=is.null&limit=2"
    );
    if (!Array.isArray(acceptedInvites) || acceptedInvites.length !== 1) {
      throw new Error("L'invitation acceptée et l'affectation ne sont pas reliées.");
    }
  } else {
    const acceptedInvites = await restAdmin(
      "naxa_livreur_invites?select=token,assignment_id,accepted_by,accepted_at"
        + "&pharmacie_id=eq." + encodeURIComponent(pharmacyId)
        + "&accepted_by=eq." + encodeURIComponent(user.id)
        + "&assignment_id=eq." + encodeURIComponent(assignment.id)
        + "&accepted_at=not.is.null&revoked_at=is.null&limit=2"
    );
    if (!Array.isArray(acceptedInvites) || acceptedInvites.length !== 1) {
      throw new Error("L'affectation existante ne provient pas de l'invitation E2E acceptée attendue.");
    }
  }

  const courier = await login(EMAIL, password, "Client Livreur E2E");
  const selected = await rpc("naxa_select_active_role", courier.token, {
    p_role_code: "livreur",
    p_pharmacie_id: pharmacyId,
  });
  if (!selected.ok || selected.data !== true) {
    throw new Error("Sélection du rôle actif Livreur refusée (HTTP " + selected.status + ").");
  }

  const activeRoles = await restAdmin(
    "naxa_profile_active_roles?select=role_code,pharmacie_id&profile_id=eq."
      + encodeURIComponent(user.id) + "&limit=2"
  );
  if (
    !Array.isArray(activeRoles) || activeRoles.length !== 1
    || activeRoles[0].role_code !== "livreur"
    || activeRoles[0].pharmacie_id !== pharmacyId
  ) {
    throw new Error("Le rôle actif Livreur n'est pas cohérent avec son affectation.");
  }

  const profileAfter = await restAdmin(
    "profiles?select=id,role,actif,fonction_interne&id=eq." + encodeURIComponent(user.id) + "&limit=1"
  );
  if (
    profileAfter?.[0]?.role !== "client"
    || profileAfter?.[0]?.actif !== true
    || profileAfter?.[0]?.fonction_interne !== "livreur"
  ) {
    throw new Error("Le compte autonome doit conserver son rôle racine Client et son poste actif Livreur.");
  }

  const managed = await rpc("naxa_livreurs_management_list", promoter.token, {
    p_pharmacies: [pharmacyId],
  });
  if (!managed.ok || !Array.isArray(managed.data)
      || !managed.data.some(x => x.profile_id === user.id && x.assignment_id === assignment.id)) {
    throw new Error("Le Promoteur ne voit pas son Livreur dans la gestion d'équipe.");
  }

  const isolated = await rpc("naxa_livreurs_management_list", promoter.token, {
    p_pharmacies: [otherPharmacyId],
  });
  if (isolated.ok) {
    throw new Error("ÉCHEC isolation : le Promoteur a consulté une pharmacie hors réseau.");
  }

  const missions = await rpc("naxa_delivery_my_missions", courier.token, {
    p_include_history: false,
  });
  if (!missions.ok || !Array.isArray(missions.data)) {
    throw new Error("Le tableau de bord Livreur ne répond pas pour le rôle actif.");
  }

  process.stdout.write("PASS — fixture Client E2E créée/reprise avec identité, majorité et consentement vérifiés.\n");
  process.stdout.write("PASS — invitation Promoteur créée puis acceptée ; affectation Livreur permanente et rôle actif confirmés.\n");
  process.stdout.write("PASS — gestion Promoteur : Livreur visible sur sa pharmacie ; consultation hors réseau refusée.\n");
  process.stdout.write("PASS — RPC tableau de bord Livreur accessible ; missions actuelles : " + missions.data.length + ".\n");
  process.stdout.write("INFO — fixture Courier conservée sur Replay pour les prochaines recettes ; aucun ordre ou paiement créé.\n");
  process.stdout.write("INFO — " + inspected + " identité(s) Auth consultée(s) par pages bornées.\n");
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    const cleanupErrors = [];
    for (const token of [...new Set(roleSessions)].reverse()) {
      try {
        await logoutRoleSession(token);
      } catch (error) {
        cleanupErrors.push(error?.message || "erreur inconnue");
      }
    }
    if (failed && passwordFile && fs.existsSync(passwordFile)) {
      try { fs.unlinkSync(passwordFile); } catch { /* nettoyage final du workflow en second recours */ }
    }
    if (cleanupErrors.length) {
      const message = "CLEANUP sessions Livreur/Promoteur : " + cleanupErrors.join(" ; ");
      if (failed) process.stderr.write(message + "\n");
      else throw new Error(message);
    }
  }
}

if (require.main === module) {
  provision().catch(error => {
    process.stderr.write("PROVISIONNEMENT LIVREUR E2E BLOQUÉ — " + (error?.message || "erreur inconnue") + "\n");
    process.exitCode = 1;
  });
}

module.exports = { assertReplayUrl, buildCourierMetadata, assertCourierFixture, generateEphemeralPassword };
