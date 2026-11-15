#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { randomBytes } = require("node:crypto");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const PHARMACY_SLUG = "naxa-e2e-expiry-replay-20261115";
const PHARMACY_NAME = "NAXA E2E — Pharmacie de recette (non commerciale)";
const FIXTURE_MARKER = "NAXA-E2E-EXPIRY-REPLAY-20261115";
const PROMOTER_EMAIL = "naxa.e2e.promoteur@example.invalid";
const PERSONAS = [
  {
    key: "expiry_stock",
    email: "naxa.e2e.expiry-stock@example.invalid",
    username: "naxa_e2e_expiry_stock",
    phone: "+237600000091",
    firstName: "Compte",
    lastName: "Gestionnaire Stock Péremption E2E",
    role: "gestionnaire_stock",
    assigned: true,
  },
  {
    key: "expiry_responsable",
    email: "naxa.e2e.expiry-responsable@example.invalid",
    username: "naxa_e2e_expiry_responsable",
    phone: "+237600000092",
    firstName: "Compte",
    lastName: "Responsable Péremption E2E",
    role: "responsable",
    assigned: true,
  },
  {
    key: "expiry_responsable_overflow",
    email: "naxa.e2e.expiry-responsable-overflow@example.invalid",
    username: "naxa_e2e_expiry_overflow",
    phone: "+237600000093",
    firstName: "Compte",
    lastName: "Responsable Dépassement E2E",
    role: "responsable",
    assigned: false,
  },
];

function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (url.protocol !== "https:" || url.hostname !== PROJECT_REF + ".supabase.co" || !["", "/"].includes(url.pathname)) {
    throw new Error("Sécurité : les fixtures expirations sont limitées au projet Replay " + PROJECT_REF + ".");
  }
  return url.origin;
}

function buildPharmacyPayload() {
  return {
    nom: PHARMACY_NAME,
    slug: PHARMACY_SLUG,
    ville: "Yaoundé",
    quartier: "Environnement de recette technique",
    adresse: "Fixture interne NAXA — non commerciale et non publiée",
    lat: 3.848,
    lng: 11.502,
    de_garde: false,
    actif: true,
    est_demo: false,
    visible_recherche: false,
    livraison_active: false,
    rayon_livraison_km: 1,
    geo_statut: "inconnu",
  };
}

function assertPrivatePharmacy(pharmacy) {
  if (!pharmacy || pharmacy.slug !== PHARMACY_SLUG || pharmacy.nom !== PHARMACY_NAME
    || pharmacy.est_demo !== false || pharmacy.visible_recherche !== false || pharmacy.actif !== true
    || pharmacy.archivee_le != null) {
    throw new Error("La pharmacie de recette doit être non-démo, active, non archivée et invisible en recherche.");
  }
  return true;
}

function buildMetadata(persona) {
  return {
    username: persona.username,
    first_name: persona.firstName,
    last_name: persona.lastName,
    phone: persona.phone,
    phone_country: "CM",
    date_of_birth: "1990-01-01",
    consent_accepted: true,
    naxa_signup_completed: true,
    naxa_signup_pending: false,
    naxa_e2e_fixture: FIXTURE_MARKER,
    naxa_e2e_persona: persona.key,
  };
}

function assertFixture(user, profile, persona) {
  if (!user || !profile || String(user.email || "").trim().toLowerCase() !== persona.email
    || !user.id || profile.id !== user.id || !user.email_confirmed_at) {
    throw new Error("Identité Auth absente, non confirmée ou non liée pour " + persona.key + ".");
  }
  const metadata = user.user_metadata || user.raw_user_meta_data || {};
  if (metadata.naxa_e2e_fixture !== FIXTURE_MARKER
    || metadata.naxa_e2e_persona !== persona.key
    || metadata.username !== persona.username
    || metadata.naxa_signup_completed !== true) {
    throw new Error("Marqueurs E2E incompatibles pour " + persona.key + " ; aucune conversion de compte.");
  }
  if (profile.role !== "client" || profile.actif !== true || profile.age_verified !== true
    || !profile.consent_accepted_at || profile.username !== persona.username
    || profile.first_name !== persona.firstName || profile.last_name !== persona.lastName
    || profile.phone !== persona.phone || !profile.date_of_birth) {
    throw new Error("Profil racine Client incomplet ou non conforme pour " + persona.key + ".");
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
  const promoterEmail = String(env.NAXA_STORAGE_E2E_PROMOTEUR_EMAIL || PROMOTER_EMAIL).trim();
  const promoterPasswordFile = String(env.NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD_FILE || "").trim();
  if (!adminKey || !anonKey || !promoterPasswordFile || !fs.existsSync(promoterPasswordFile)) {
    throw new Error("Clés Replay et fichier secret Promoteur requis.");
  }
  const promoterPassword = fs.readFileSync(promoterPasswordFile, "utf8");
  if (!promoterPassword) throw new Error("Fichier secret Promoteur vide.");

  async function request(path, options = {}) {
    const apiKey = options.apiKey || anonKey;
    const headers = { apikey: apiKey, "Content-Type": "application/json" };
    if (options.accessToken) headers.Authorization = "Bearer " + options.accessToken;
    else if (!apiKey.startsWith("sb_secret_") && !apiKey.startsWith("sb_publishable_")) headers.Authorization = "Bearer " + apiKey;
    if (options.prefer) headers.Prefer = options.prefer;
    const response = await fetch(baseUrl + path, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* never log Auth response bodies */ }
    return { ok: response.ok, status: response.status, data };
  }

  async function adminRequest(path, method = "GET", body, prefer) {
    const result = await request(path, { method, apiKey: adminKey, body, prefer });
    if (!result.ok) {
      const code = result.data && typeof result.data.code === "string" ? " (" + result.data.code + ")" : "";
      throw new Error("Supabase a refusé une opération de fixture Replay (HTTP " + result.status + code + ").");
    }
    return result.data;
  }

  async function login(email, password, label) {
    const result = await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
    if (!result.ok || !result.data?.access_token || !result.data?.user?.id) {
      throw new Error("Connexion du compte " + label + " impossible (HTTP " + result.status + ").");
    }
    return { id: result.data.user.id, token: result.data.access_token };
  }

  async function rpc(name, accessToken, args) {
    return request("/rest/v1/rpc/" + name, { method: "POST", accessToken, body: args || {} });
  }

  async function listAuthUser(email) {
    for (let page = 1; page <= 20; page += 1) {
      const result = await adminRequest("/auth/v1/admin/users?page=" + page + "&per_page=50");
      const users = Array.isArray(result?.users) ? result.users : [];
      const found = users.find(row => String(row.email || "").trim().toLowerCase() === email);
      if (found) return found;
      if (users.length < 50) return null;
    }
    throw new Error("Recherche Auth incomplète pour " + email + ".");
  }

  async function profileFor(id) {
    const rows = await adminRequest("/rest/v1/profiles?select=id,role,actif,age_verified,consent_accepted_at,username,first_name,last_name,phone,date_of_birth&id=eq."
      + encodeURIComponent(id) + "&limit=2");
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("Profil attendu absent.");
    return rows[0];
  }

  async function provisionIdentity(persona) {
    const usernameRows = await adminRequest("/rest/v1/profiles?select=id&username=eq."
      + encodeURIComponent(persona.username) + "&limit=2");
    const phoneRows = await adminRequest("/rest/v1/profiles?select=id&phone=eq."
      + encodeURIComponent(persona.phone) + "&limit=2");
    if (!Array.isArray(usernameRows) || !Array.isArray(phoneRows)) throw new Error("Contrôle unicité incomplet.");

    let user = await listAuthUser(persona.email);
    const password = generateEphemeralPassword();
    if (user) {
      if (usernameRows.some(row => row.id !== user.id) || phoneRows.some(row => row.id !== user.id)) {
        throw new Error("Nom technique ou téléphone déjà utilisé par un autre profil.");
      }
      const existingProfile = await profileFor(user.id);
      assertFixture(user, existingProfile, persona);
      await adminRequest("/auth/v1/admin/users/" + encodeURIComponent(user.id), "PUT", { password });
    } else {
      if (usernameRows.length || phoneRows.length) throw new Error("Identifiant ou téléphone déjà utilisé ; création refusée.");
      const created = await adminRequest("/auth/v1/admin/users", "POST", {
        email: persona.email,
        password,
        email_confirm: true,
        user_metadata: buildMetadata(persona),
      });
      user = created?.user || created;
      if (!user?.id) throw new Error("Supabase Auth n'a pas retourné l'identité.");
    }
    const verified = await listAuthUser(persona.email);
    const profile = await profileFor(user.id);
    assertFixture(verified, profile, persona);
    return { id: user.id, password };
  }

  const promoter = await login(promoterEmail, promoterPassword, "Promoteur E2E");
  const sessions = [promoter];
  try {
  const selectedPromoter = await rpc("naxa_select_active_role", promoter.token, {
    p_role_code: "promoteur",
    p_pharmacie_id: null,
  });
  if (!selectedPromoter.ok || selectedPromoter.data !== true) {
    throw new Error("Le Promoteur E2E ne peut pas sélectionner son rôle métier actif.");
  }
  const pharmacyRows = await adminRequest("/rest/v1/pharmacies?select=id,nom,slug,est_demo,visible_recherche,actif,archivee_le&slug=eq."
    + encodeURIComponent(PHARMACY_SLUG) + "&limit=2");
  if (!Array.isArray(pharmacyRows) || pharmacyRows.length > 1) throw new Error("Pharmacie E2E dupliquée ou lecture invalide.");

  let pharmacy;
  if (pharmacyRows.length === 1) {
    pharmacy = pharmacyRows[0];
    assertPrivatePharmacy(pharmacy);
  } else {
    const created = await adminRequest("/rest/v1/pharmacies", "POST", buildPharmacyPayload(), "return=representation");
    if (!Array.isArray(created) || created.length !== 1) throw new Error("Création de la pharmacie de recette incomplète.");
    pharmacy = created[0];
    assertPrivatePharmacy(pharmacy);
  }

  const architecture = await adminRequest("/rest/v1/pharmacie_architectures?on_conflict=pharmacie_id", "POST", {
    pharmacie_id: pharmacy.id,
    architecture_code: "HYBRIDE",
    assigned_by: promoter.id,
    active: true,
    max_responsables: 1,
    max_caisses: 1,
  }, "resolution=merge-duplicates,return=representation");
  const architectureRows = await adminRequest("/rest/v1/pharmacie_architectures?select=pharmacie_id,architecture_code,active,max_responsables&pharmacie_id=eq."
    + encodeURIComponent(pharmacy.id) + "&limit=2");
  if (!Array.isArray(architectureRows) || architectureRows.length !== 1
    || architectureRows[0].architecture_code !== "HYBRIDE" || architectureRows[0].active !== true
    || architectureRows[0].max_responsables !== 1) {
    throw new Error("La pharmacie E2E doit rester HYBRIDE avec un plafond Responsable égal à un.");
  }

  await adminRequest("/rest/v1/promoteur_pharmacies?on_conflict=promoteur_id,pharmacie_id", "POST", {
    promoteur_id: promoter.id,
    pharmacie_id: pharmacy.id,
    actif: true,
  }, "resolution=merge-duplicates,return=minimal");

  const privileges = await adminRequest("/rest/v1/naxa_profile_privileges?select=privilege_code,active,revoked_at,pharmacie_id"
    + "&profile_id=eq." + encodeURIComponent(promoter.id)
    + "&pharmacie_id=eq." + encodeURIComponent(pharmacy.id)
    + "&active=eq.true");
  const activePrivileges = new Set((privileges || []).filter(row => row.revoked_at == null).map(row => row.privilege_code));
  for (const required of ["CREATE_RESPONSABLE", "ASSIGN_USER_TO_PHARMACY"]) {
    if (!activePrivileges.has(required)) throw new Error("Le Promoteur n'a pas le privilège " + required + " sur la pharmacie technique.");
  }

  const fixtures = {};
  for (const persona of PERSONAS) fixtures[persona.key] = await provisionIdentity(persona);

  for (const persona of PERSONAS.filter(row => row.assigned)) {
    const current = await adminRequest("/rest/v1/naxa_professional_assignments?select=id,statut,commence_at,expire_at,role_code,pharmacie_id"
      + "&profile_id=eq." + encodeURIComponent(fixtures[persona.key].id)
      + "&pharmacie_id=eq." + encodeURIComponent(pharmacy.id)
      + "&role_code=eq." + encodeURIComponent(persona.role)
      + "&statut=eq.active&commence_at=lte." + encodeURIComponent(new Date().toISOString())
      + "&limit=10");
    const existing = (current || []).find(row => !row.expire_at || new Date(row.expire_at).getTime() > Date.now());
    if (!existing) {
      const granted = await rpc("naxa_grant_professional_assignment", promoter.token, {
        p_target: fixtures[persona.key].id,
        p_pharmacie: pharmacy.id,
        p_fonction: persona.role,
        p_commence_at: new Date().toISOString(),
        p_expire_at: null,
        p_motif: "Affectation de recette E2E pour le contrôle des rappels de péremption.",
      });
      if (!granted.ok || !granted.data) {
        throw new Error("Affectation Promoteur " + persona.role + " refusée (HTTP " + granted.status + ").");
      }
    }
  }

  const overflow = await rpc("naxa_grant_professional_assignment", promoter.token, {
    p_target: fixtures.expiry_responsable_overflow.id,
    p_pharmacie: pharmacy.id,
    p_fonction: "responsable",
    p_commence_at: new Date().toISOString(),
    p_expire_at: null,
    p_motif: "Test du plafond Responsable sur la pharmacie technique E2E.",
  });
  const overflowMessage = String(overflow.data?.message || overflow.data?.details || "");
  if (overflow.ok || !/Quota Responsables atteint/i.test(overflowMessage)) {
    throw new Error("Le second Responsable aurait dû être refusé par le plafond configuré à un.");
  }

  const assignedIds = {};
  for (const persona of PERSONAS.filter(row => row.assigned)) {
    const session = await login(persona.email, fixtures[persona.key].password, persona.key);
    sessions.push(session);
    const selected = await rpc("naxa_select_active_role", session.token, {
      p_role_code: persona.role,
      p_pharmacie_id: pharmacy.id,
    });
    const businessFunction = await rpc("naxa_business_function", session.token, {});
    const activePharmacy = await rpc("naxa_active_role_pharmacy", session.token, {});
    if (!selected.ok || selected.data !== true || !businessFunction.ok || businessFunction.data !== persona.role
      || !activePharmacy.ok || activePharmacy.data !== pharmacy.id) {
      throw new Error("Sélection du poste et contexte pharmacie invalides pour " + persona.key + ".");
    }
    assignedIds[persona.key] = session.id;
  }

  if (env.GITHUB_ENV) {
    const lines = ["NAXA_STORAGE_E2E_EXPIRY_PHARMACY_ID=" + pharmacy.id];
    for (const persona of PERSONAS.filter(row => row.assigned)) {
      const passwordFile = (env.RUNNER_TEMP || "/tmp") + "/naxa-e2e-" + persona.key + "-" + randomBytes(8).toString("hex") + ".secret";
      fs.writeFileSync(passwordFile, fixtures[persona.key].password, { encoding: "utf8", flag: "wx", mode: 0o600 });
      lines.push("NAXA_STORAGE_E2E_" + persona.key.toUpperCase() + "_EMAIL=" + persona.email);
      lines.push("NAXA_STORAGE_E2E_" + persona.key.toUpperCase() + "_PASSWORD_FILE=" + passwordFile);
    }
    lines.push("NAXA_STORAGE_E2E_EXPIRY_STOCK_ID=" + assignedIds.expiry_stock);
    lines.push("NAXA_STORAGE_E2E_EXPIRY_RESPONSABLE_ID=" + assignedIds.expiry_responsable);
    fs.appendFileSync(env.GITHUB_ENV, lines.join("\n") + "\n", { encoding: "utf8", mode: 0o600 });
  }

  process.stdout.write("PASS — pharmacie de recette créée/reprise : non-démo, active, invisible en recherche publique, non commerciale.\n");
  process.stdout.write("PASS — promoteur rattaché par le parcours métier ; CREATE_RESPONSABLE et ASSIGN_USER_TO_PHARMACY actifs.\n");
  process.stdout.write("PASS — comptes racine Client séparés, Gestionnaire Stock et Responsable affectés par RPC Promoteur.\n");
  process.stdout.write("PASS — dépassement du plafond max_responsables=1 refusé pour le second candidat.\n");
  process.stdout.write("INFO — identités E2E conservées sur Replay ; aucun mot de passe journalisé.\n");
  process.stdout.write("EXPIRY_PHARMACY_ID=" + pharmacy.id + "\n");
  } finally {
    for (const session of [...sessions].reverse()) {
      await request("/auth/v1/logout?scope=local", { method: "POST", accessToken: session.token }).catch(() => null);
    }
  }
}

if (require.main === module) {
  provision().catch(error => {
    process.stderr.write("PROVISIONNEMENT PHARMACIE/RÔLES PÉREMPTION E2E BLOQUÉ — " + (error?.message || "erreur inconnue") + "\n");
    process.exitCode = 1;
  });
}

module.exports = {
  assertReplayUrl,
  buildPharmacyPayload,
  assertPrivatePharmacy,
  buildMetadata,
  assertFixture,
  generateEphemeralPassword,
  PERSONAS,
  PHARMACY_SLUG,
  PHARMACY_NAME,
};
