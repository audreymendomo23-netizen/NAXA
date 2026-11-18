#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { chromium } = require("playwright");
const { hasUsableRefreshTokenPair } = require("./refresh-session-check");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const USERNAME = "naxa_e2e_stock";
const EMAIL = "naxa.e2e.stock@example.invalid";
const ROLE_PATH = "/pharmacie/gestionnaire-stock";

function required(value, label) {
  const result = String(value || "").trim();
  if (!result) throw new Error("Configuration manquante : " + label + ".");
  return result;
}

function readSecret(path, label) {
  const file = required(path, label);
  if (!fs.existsSync(file)) throw new Error("Fichier secret absent : " + label + ".");
  const value = fs.readFileSync(file, "utf8");
  if (!value) throw new Error("Fichier secret vide : " + label + ".");
  return value;
}

function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (url.protocol !== "https:" || url.hostname !== PROJECT_REF + ".supabase.co"
    || !["", "/"].includes(url.pathname)) {
    throw new Error("Sécurité : recette Auth limitée au projet Replay.");
  }
  return url.origin;
}

async function run(env = process.env) {
  const supabaseUrl = assertReplayUrl(required(env.NAXA_STORAGE_E2E_URL || env.SUPABASE_URL, "URL Replay"));
  const anonKey = required(env.NAXA_STORAGE_E2E_ANON_KEY, "clé anon Replay");
  const password = readSecret(env.NAXA_STORAGE_E2E_STOCK_PASSWORD_FILE, "mot de passe Gestionnaire Stock");
  const webBase = String(env.NAXA_E2E_WEB_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const authTokens = [];

  async function authRequest(path, body, label) {
    const response = await fetch(supabaseUrl + path, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: "Bearer " + anonKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* no auth body in logs */ }
    return { ok: response.ok, status: response.status, data, label };
  }

  async function passwordLogin() {
    const result = await authRequest("/auth/v1/token?grant_type=password", { email: EMAIL, password }, "password login");
    if (!result.ok || !result.data?.access_token || !result.data?.refresh_token) {
      throw new Error("Connexion Auth réelle refusée (HTTP " + result.status + ").");
    }
    authTokens.push(result.data.access_token);
    return result.data;
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await context.addCookies([{
      name: "naxa-age-status-v2", value: "adult", url: webBase + "/", sameSite: "Lax",
    }]);
    const response = await page.goto(webBase + "/connexion?espace=pharmacie&retour="
      + encodeURIComponent(ROLE_PATH), { waitUntil: "domcontentloaded" });
    await page.locator("#username").waitFor({ state: "visible", timeout: 30000 });
    await page.locator("#username").fill(USERNAME);
    await page.locator("#password").fill(password);
    const loginResponsePromise = page.waitForResponse(r =>
      new URL(r.url()).pathname === "/api/auth/login" && r.request().method() === "POST",
    { timeout: 60000 });
    await page.getByRole("button", { name: "Connexion", exact: true }).click();
    const loginResponse = await loginResponsePromise;
    if (!loginResponse.ok()) {
      throw new Error("Connexion navigateur refusée (HTTP " + loginResponse.status() + ").");
    }
    await page.waitForURL(url => url.pathname === ROLE_PATH, {
      timeout: 60000, waitUntil: "domcontentloaded",
    });
    const cookies = await context.cookies();
    const authCookies = cookies.filter(cookie => /^sb-.*-auth-token/.test(cookie.name));
    if (authCookies.length === 0) {
      throw new Error("Connexion UI acceptée mais cookie de session Supabase SSR absent.");
    }
    process.stdout.write("PASS — connexion réelle via navigateur et accès à l'espace Gestionnaire de stock.\n");

    // Simulate browser cookie expiration (not a forged JWT and not a change to project Auth settings).
    await context.clearCookies({ name: /^sb-.*-auth-token/ });
    const afterCookieExpiry = await page.goto(webBase + ROLE_PATH, { waitUntil: "domcontentloaded" });
    const redirected = new URL(page.url()).pathname === "/connexion";
    if (!redirected) {
      throw new Error("Une session navigateur sans cookie Auth n'a pas été renvoyée vers la connexion (HTTP "
        + (afterCookieExpiry?.status() ?? "inconnu") + ").");
    }
    process.stdout.write("PASS — cookie de session expiré/supprimé : middleware refuse l'espace protégé et redirige vers la connexion.\n");
    await context.close();

    // Test real Supabase refresh-token rotation and reuse protection.
    const first = await passwordLogin();
    const rotated = await authRequest("/auth/v1/token?grant_type=refresh_token", {
      refresh_token: first.refresh_token,
    }, "refresh rotation");
    if (!rotated.ok || !rotated.data?.access_token || !rotated.data?.refresh_token
      || rotated.data.refresh_token === first.refresh_token) {
      throw new Error("Rotation du refresh token non démontrée (HTTP " + rotated.status + ").");
    }
    authTokens.push(rotated.data.access_token);
    process.stdout.write("PASS — renouvellement Auth : refresh token remplacé et nouveau jeton d'accès émis.\n");

    // Supabase intentionally accepts the parent of the currently active refresh token,
    // even outside the reuse interval, to tolerate a lost response during rotation.
    // Rotate again so T1 becomes a grandparent. The replay must happen more than
    // 10 seconds after this second rotation, not merely after the first one.
    const current = await authRequest("/auth/v1/token?grant_type=refresh_token", {
      refresh_token: rotated.data.refresh_token,
    }, "second refresh rotation");
    if (!current.ok || !current.data?.access_token || !current.data?.refresh_token
      || current.data.refresh_token === rotated.data.refresh_token) {
      throw new Error("Deuxième rotation Auth non démontrée (HTTP " + current.status + ").");
    }
    authTokens.push(current.data.access_token);
    process.stdout.write("PASS — deuxième rotation : le premier refresh token n'est plus le parent actif.\\n");

    // T1 must be replayed outside the general reuse interval after the latest rotation.
    await new Promise(resolve => setTimeout(resolve, 15000));
    process.stdout.write("INFO — fenêtre de réutilisation expirée après la deuxième rotation.\\n");

    const replay = await authRequest("/auth/v1/token?grant_type=refresh_token", {
      refresh_token: first.refresh_token,
    }, "ancestor refresh token replay");
    if (replay.ok) {
      throw new Error("Un refresh token ancêtre (deux rotations précédentes) reste accepté après 15 secondes.");
    }
    process.stdout.write("PASS — ancien refresh token ancêtre rejeté hors fenêtre de tolérance.\\n");

    // Reuse detection must revoke the whole session, not merely reject the replay request.
    const afterReuseDetection = await authRequest("/auth/v1/token?grant_type=refresh_token", {
      refresh_token: current.data.refresh_token,
    }, "current refresh token after ancestor reuse detection");
    if (hasUsableRefreshTokenPair(afterReuseDetection)) {
      throw new Error(
        "La détection de réutilisation n'a pas révoqué le refresh token courant : "
        + "HTTP " + afterReuseDetection.status
        + ", access_token=" + Boolean(afterReuseDetection.data?.access_token)
        + ", refresh_token=" + Boolean(afterReuseDetection.data?.refresh_token) + "."
      );
    }
    process.stdout.write("PASS — détection de réutilisation : aucun nouveau couple access/refresh utilisable n'est émis pour la session.\\n");

    // Independent session for explicit server-side revocation.
    const second = await passwordLogin();
    // Global signout revokes every refresh token for this isolated test identity.
    const logoutResponse = await fetch(supabaseUrl + "/auth/v1/logout?scope=global", {
      method: "POST",
      headers: { apikey: anonKey, Authorization: "Bearer " + second.access_token },
    });
    if (!logoutResponse.ok && logoutResponse.status !== 204) {
      throw new Error("Révocation globale Auth refusée (HTTP " + logoutResponse.status + ").");
    }
    const afterRevoke = await authRequest("/auth/v1/token?grant_type=refresh_token", {
      refresh_token: second.refresh_token,
    }, "refresh after global revoke");
    if (hasUsableRefreshTokenPair(afterRevoke)) {
      throw new Error("Le refresh token reste utilisable après révocation globale.");
    }
    process.stdout.write("PASS — révocation globale : refresh token de la session révoquée refusé.\n");
    process.stdout.write("NOTE — l'expiration naturelle du JWT (durée configurée du projet) n'a pas été attendue ; le test d'expiration ci-dessus porte sur le cookie navigateur et non sur l'expiration cryptographique du JWT.\n");
  } finally {
    // Clean only sessions created through this runtime test. Avoid global sign-out
    // here because the dedicated E2E account may be used by another isolated job.
    for (const accessToken of [...new Set(authTokens)].reverse()) {
      try {
        await fetch(supabaseUrl + "/auth/v1/logout?scope=local", {
          method: "POST",
          headers: { apikey: anonKey, Authorization: "Bearer " + accessToken },
        });
      } catch { /* best-effort cleanup; never hide the original assertion */ }
    }
    if (browser) await browser.close().catch(() => {});
  }
}

if (require.main === module) {
  run().catch(error => {
    process.stderr.write("RECETTE AUTH E2E BLOQUÉE — " + (error?.message || "erreur inconnue") + "\n");
    process.exitCode = 1;
  });
}

module.exports = { assertReplayUrl };
