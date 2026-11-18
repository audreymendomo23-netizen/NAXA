#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { chromium } = require("playwright");
const { hasUsableRefreshTokenPair } = require("./refresh-session-check.cjs");
const { readAccessTokenFromCookies } = require("./read-ssr-access-token.cjs");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const USERNAME = "naxa_e2e_stock";
const EMAIL = "naxa.e2e.stock@example.invalid";
const ROLE_PATH = "/pharmacie/gestionnaire-stock";

function required(value, label) {
  const result = String(value || "").trim();
  if (!result) throw new Error("Configuration manquante : " + label + ".");
  return result;
}

function readAccessTokenClaims(token, label) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new Error("Jeton d'accès JWT invalide après " + label + ".");
  }
  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("Claims JWT illisibles après " + label + ".");
  }
  const userId = String(claims.sub || "");
  const sessionId = String(claims.session_id || "");
  if (!userId || !sessionId) {
    throw new Error("Claims sub/session_id absents après " + label + ".");
  }
  return { userId, sessionId };
}

function assertSameAuthSession(expected, actual, label) {
  if (actual.userId !== expected.userId || actual.sessionId !== expected.sessionId) {
    throw new Error(
      "La rotation Auth a changé l'identité ou le session_id (" + label + "). "
      + "La recette ne peut pas conclure à la révocation d'une même famille."
    );
  }
}

function readAuthErrorCode(data) {
  if (!data || typeof data !== "object") return "non fourni";
  // Supabase Auth can return a numeric HTTP-like `code` alongside the semantic
  // `error_code`. Prefer the stable semantic code and ignore numeric transport codes.
  const candidates = [data.error_code, data.code, data.error, data.error_description];
  const value = candidates.find(candidate => typeof candidate === "string" && candidate.trim());
  return value ? value.trim() : "non fourni";
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
    const diagnostics = {
      rotated: response.headers.get("sb-auth-refresh-token-rotated"),
      reuse: response.headers.get("sb-auth-refresh-token-reuse"),
      reuseCause: response.headers.get("sb-auth-refresh-token-reuse-cause"),
      counter: response.headers.get("sb-auth-refresh-token-counter"),
    };
    return { ok: response.ok, status: response.status, data, label, diagnostics };
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
    // Revoke the browser-created session in the finally block, not just its local cookies.
    authTokens.push(readAccessTokenFromCookies(authCookies));
    process.stdout.write("PASS — connexion réelle via navigateur et accès à l'espace Gestionnaire de stock.\n");

    // Simulate browser cookie expiration (not a forged JWT and not a change to project Auth settings).
    for (const cookie of authCookies) {
      await context.clearCookies({
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
      });
    }
    const remainingAuthCookies = (await context.cookies()).filter(cookie => /^sb-.*-auth-token/.test(cookie.name));
    if (remainingAuthCookies.length > 0) {
      throw new Error("Le harnais n'a pas supprimé tous les cookies Auth SSR (" + remainingAuthCookies.length + " restant(s)).");
    }
    process.stdout.write("INFO — cookies Auth SSR supprimés explicitement avant le contrôle middleware.\\n");
    const afterCookieExpiry = await page.goto(webBase + ROLE_PATH, { waitUntil: "domcontentloaded" });
    const redirected = new URL(page.url()).pathname === "/connexion";
    if (!redirected) {
      throw new Error("Une session navigateur sans cookie Auth n'a pas été renvoyée vers la connexion (HTTP "
        + (afterCookieExpiry?.status() ?? "inconnu") + ", chemin=" + new URL(page.url()).pathname + ").");
    }
    process.stdout.write("PASS — cookie de session expiré/supprimé : middleware refuse l'espace protégé et redirige vers la connexion.\n");
    await context.close();

    process.stdout.write("PASS — contrôle navigateur terminé ; démarrage du test REST isolé de rotation refresh.\\n");
    // Test real Supabase refresh-token rotation and reuse protection.
    const first = await passwordLogin();
    const firstClaims = readAccessTokenClaims(first.access_token, "connexion initiale");
    const rotated = await authRequest("/auth/v1/token?grant_type=refresh_token", {
      refresh_token: first.refresh_token,
    }, "refresh rotation");
    if (!rotated.ok || !rotated.data?.access_token || !rotated.data?.refresh_token
      || rotated.data.refresh_token === first.refresh_token) {
      throw new Error("Rotation du refresh token non démontrée (HTTP " + rotated.status + ").");
    }
    authTokens.push(rotated.data.access_token);
    assertSameAuthSession(firstClaims, readAccessTokenClaims(rotated.data.access_token, "première rotation"), "première rotation");
    process.stdout.write("PASS — même utilisateur et même session_id après la première rotation.\\n");
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
    assertSameAuthSession(firstClaims, readAccessTokenClaims(current.data.access_token, "deuxième rotation"), "deuxième rotation");
    process.stdout.write("PASS — même utilisateur et même session_id après la deuxième rotation.\\n");
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
    const replayError = readAuthErrorCode(replay.data);
    if (replay.status !== 400 || replayError !== "refresh_token_already_used") {
      throw new Error(
        "Le rejeu ancêtre n'a pas produit le rejet Auth attendu : HTTP "
        + replay.status + ", code=" + replayError + "."
      );
    }
    process.stdout.write(
      "PASS — ancien refresh token ancêtre rejeté (HTTP " + replay.status
      + ", code=" + replayError + ").\\n"
    );

    // Reuse detection must revoke the whole session, not merely reject the replay request.
    const afterReuseDetection = await authRequest("/auth/v1/token?grant_type=refresh_token", {
      refresh_token: current.data.refresh_token,
    }, "current refresh token after ancestor reuse detection");
    if (afterReuseDetection.ok || hasUsableRefreshTokenPair(afterReuseDetection)) {
      if (afterReuseDetection.data?.access_token) {
        const descendantClaims = readAccessTokenClaims(afterReuseDetection.data.access_token, "refresh descendant après détection");
        assertSameAuthSession(firstClaims, descendantClaims, "refresh descendant après détection");
      }
      const diagnosticHoldMs = Math.max(0, Math.min(60000, Number(env.NAXA_E2E_DIAGNOSTIC_HOLD_MS || 0)));
      if (diagnosticHoldMs > 0) {
        process.stdout.write(
          "DIAGNOSTIC — session_id=" + firstClaims.sessionId
          + " ; refresh descendant accepté (HTTP " + afterReuseDetection.status
          + "); inspection Replay ouverte pendant " + diagnosticHoldMs + " ms avant nettoyage.\\n"
        );
        await new Promise(resolve => setTimeout(resolve, diagnosticHoldMs));
      }
      throw new Error(
        "La détection de réutilisation n'a pas révoqué la famille de session : "
        + "le jeton ancêtre a été refusé (HTTP " + replay.status + ", code=" + replayError + "), "
        + "mais le jeton descendant de la même session reste accepté (HTTP "
        + afterReuseDetection.status + "). En-têtes du rejeu : rotated="
        + (replay.diagnostics.rotated || "absent") + ", reuse="
        + (replay.diagnostics.reuse || "absent") + ", reuseCause="
        + (replay.diagnostics.reuseCause || "absent") + ", counter="
        + (replay.diagnostics.counter || "absent") + "."
      );
    }
    const descendantError = readAuthErrorCode(afterReuseDetection.data);
    const revokedCodes = new Set([
      "refresh_token_already_used",
      "refresh_token_not_found",
      "session_not_found",
      "session_expired",
    ]);
    if (afterReuseDetection.status !== 400 || !revokedCodes.has(descendantError)) {
      throw new Error(
        "Révocation de famille non prouvée : le descendant a répondu HTTP "
        + afterReuseDetection.status + ", code=" + descendantError
        + " ; un rejet Auth de session/refresh token était attendu."
      );
    }
    process.stdout.write(
      "PASS — session terminée après le rejeu : le refresh descendant est rejeté (HTTP "
      + afterReuseDetection.status + ", code=" + descendantError + ").\\n"
    );

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

module.exports = { assertReplayUrl, readAuthErrorCode };
