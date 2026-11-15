#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { randomBytes } = require("node:crypto");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const EMAIL = "naxa.e2e.20261104.admin@example.invalid";
const FIXTURE_MARKER = "NAXA-E2E-20261104";
const PERSONA = "admin";

function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (
    url.protocol !== "https:"
    || url.hostname !== PROJECT_REF + ".supabase.co"
    || !["", "/"].includes(url.pathname)
  ) {
    throw new Error("Sécurité : provisionnement Admin limité au projet Replay " + PROJECT_REF + ".");
  }
  return url.origin;
}

function assertAdminFixture(user, profile) {
  if (!user || !profile) throw new Error("Fixture Admin Auth/profil introuvable.");
  if (String(user.email || "").trim().toLowerCase() !== EMAIL) {
    throw new Error("L'adresse Admin ne correspond pas à la fixture E2E attendue.");
  }
  if (!user.id || profile.id !== user.id) {
    throw new Error("Le profil Admin n'est pas lié à l'identité Auth attendue.");
  }
  if (!user.email_confirmed_at) {
    throw new Error("La fixture Admin doit déjà être confirmée ; aucune confirmation automatique.");
  }

  const metadata = user.user_metadata || user.raw_user_meta_data || {};
  if (metadata.naxa_e2e_fixture !== FIXTURE_MARKER || metadata.naxa_e2e_persona !== PERSONA) {
    throw new Error("L'identité Admin ne porte pas les marqueurs de fixture attendus ; aucune modification.");
  }
  if (profile.role !== "admin" || profile.actif !== true) {
    throw new Error("Le profil doit déjà être Admin actif ; aucune conversion ni réactivation.");
  }
  return true;
}

function generateEphemeralPassword() {
  return randomBytes(32).toString("base64url") + "Aa!9";
}

async function provision(env = process.env) {
  const baseUrl = assertReplayUrl(env.SUPABASE_URL || env.NAXA_STORAGE_E2E_URL || "");
  const adminKey = String(env.SUPABASE_SERVICE_ROLE_KEY || env.NAXA_STORAGE_E2E_ADMIN_KEY || "").trim();
  if (!adminKey) throw new Error("Clé de service Replay absente des secrets du job.");
  if (!env.GITHUB_ENV || !env.RUNNER_TEMP) {
    throw new Error("Provisionnement autorisé uniquement dans un job GitHub Actions avec stockage temporaire.");
  }

  const headers = {
    apikey: adminKey,
    Authorization: "Bearer " + adminKey,
    "Content-Type": "application/json",
  };

  async function api(path, method = "GET", body, operation = "lecture Supabase") {
    const response = await fetch(baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* ne pas journaliser les corps Auth */ }
    if (!response.ok) {
      const code = data && typeof data.code === "string" ? " (" + data.code + ")" : "";
      throw new Error("Supabase a refusé " + operation + " (HTTP " + response.status + code + ").");
    }
    return data;
  }

  // Locate the unique, already-active fixture profile first, then fetch its
  // Auth identity directly by ID. Avoid relying on paginated Auth user listing.
  const profiles = await api(
    "/rest/v1/profiles?select=id,username,role,actif"
      + "&username=eq.e2e_admin_261104&role=eq.admin&actif=eq.true&limit=2",
    "GET", undefined, "lecture REST du profil Admin"
  );
  if (!Array.isArray(profiles) || profiles.length !== 1 || !profiles[0].id) {
    throw new Error("Le profil unique de la fixture Admin active est introuvable ; aucune création automatique.");
  }
  const profile = profiles[0];
  const authResult = await api(
    "/auth/v1/admin/users/" + encodeURIComponent(profile.id),
    "GET", undefined, "lecture Auth Admin par ID"
  );
  const user = authResult && authResult.user ? authResult.user : authResult;
  assertAdminFixture(user, profile);

  const password = generateEphemeralPassword();
  const passwordFile = env.RUNNER_TEMP + "/naxa-e2e-admin-" + randomBytes(8).toString("hex") + ".secret";
  fs.writeFileSync(passwordFile, password, { encoding: "utf8", flag: "wx", mode: 0o600 });
  fs.appendFileSync(
    env.GITHUB_ENV,
    "NAXA_STORAGE_E2E_ADMIN_EMAIL=" + EMAIL + "\n"
      + "NAXA_STORAGE_E2E_ADMIN_PASSWORD_FILE=" + passwordFile + "\n",
    { encoding: "utf8", mode: 0o600 }
  );

  // Update ONLY the password of the exact, already validated test fixture.
  await api(
    "/auth/v1/admin/users/" + encodeURIComponent(user.id),
    "PUT", { password }, "rotation du mot de passe de la fixture Admin"
  );

  // Re-read the same Auth identity and profile after the password rotation.
  const verifiedAuthResult = await api(
    "/auth/v1/admin/users/" + encodeURIComponent(user.id),
    "GET", undefined, "relecture Auth Admin après rotation"
  );
  const verifiedUser = verifiedAuthResult && verifiedAuthResult.user
    ? verifiedAuthResult.user
    : verifiedAuthResult;
  const verifiedProfiles = await api(
    "/rest/v1/profiles?select=id,username,role,actif"
      + "&username=eq.e2e_admin_261104&role=eq.admin&actif=eq.true&limit=2",
    "GET", undefined, "relecture REST du profil Admin après rotation"
  );
  if (
    !Array.isArray(verifiedProfiles) || verifiedProfiles.length !== 1
    || verifiedProfiles[0].id !== user.id
  ) {
    throw new Error("Le profil Admin n'est plus unique après la rotation du secret.");
  }
  assertAdminFixture(verifiedUser, verifiedProfiles[0]);

  process.stdout.write("PASS — fixture Admin E2E existante validée sur Replay ; seul son mot de passe de test est renouvelé.\n");
  process.stdout.write("PASS — profil Admin actif, confirmé et inchangé. Mot de passe éphémère conservé hors logs.\n");
}

if (require.main === module) {
  provision().catch(error => {
    process.stderr.write("PROVISIONNEMENT ADMIN E2E BLOQUÉ — " + (error?.message || "erreur inconnue") + "\n");
    process.exitCode = 1;
  });
}

module.exports = { assertReplayUrl, assertAdminFixture, generateEphemeralPassword };
