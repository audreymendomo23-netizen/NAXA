#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { chromium } = require("playwright");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const PROMOTEUR_EMAIL = "naxa.e2e.promoteur@example.invalid";
const PROMOTEUR_USERNAME = "naxa_e2e_promoteur";
const PROMOTEUR_MARKER = true;
const TARGET_PATH = "/pharmacie/promoteur/livraisons";

function required(value, label) {
  const result = String(value || "").trim();
  if (!result) throw new Error("Configuration manquante : " + label + ".");
  return result;
}

function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (
    url.protocol !== "https:"
    || url.hostname !== PROJECT_REF + ".supabase.co"
    || !["", "/"].includes(url.pathname)
  ) {
    throw new Error("Sécurité : ce contrôle est limité au projet Replay " + PROJECT_REF + ".");
  }
  return url.origin;
}

async function run(env = process.env) {
  const supabaseUrl = assertReplayUrl(env.NAXA_STORAGE_E2E_URL || env.SUPABASE_URL);
  const adminKey = required(env.NAXA_STORAGE_E2E_ADMIN_KEY || env.SUPABASE_SERVICE_ROLE_KEY, "clé Admin Replay");
  required(env.NAXA_STORAGE_E2E_ANON_KEY, "clé anonyme Replay");
  const baseUrl = String(env.NAXA_E2E_WEB_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

  const adminHeaders = {
    apikey: adminKey,
    "Content-Type": "application/json",
  };
  if (!adminKey.startsWith("sb_secret_") && !adminKey.startsWith("sb_publishable_")) {
    adminHeaders.Authorization = "Bearer " + adminKey;
  }

  async function adminRequest(path, method = "GET", body) {
    const response = await fetch(supabaseUrl + path, {
      method,
      headers: adminHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await response.text();
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { /* ne jamais afficher le corps Auth */ }
    if (!response.ok) {
      throw new Error("Contrôle Replay refusé (HTTP " + response.status + ") sur " + path.split("?")[0] + ".");
    }
    return payload;
  }

  // Précontrôle strict : l'identité et le profil existent déjà ; aucun endpoint de création n'est appelé.
  const profiles = await adminRequest(
    "/rest/v1/profiles?select=id,username,role,actif"
      + "&username=eq." + encodeURIComponent(PROMOTEUR_USERNAME) + "&limit=2"
  );
  assert.ok(Array.isArray(profiles) && profiles.length === 1, "La fixture Promoteur existante doit être unique.");
  const profile = profiles[0];
  assert.equal(profile.username, PROMOTEUR_USERNAME);
  assert.equal(profile.role, "promoteur", "La fixture ne doit pas être convertie depuis un autre rôle.");
  assert.equal(profile.actif, true, "La fixture Promoteur doit être active.");

  const authMatches = [];
  for (let page = 1; page <= 20; page += 1) {
    const listing = await adminRequest("/auth/v1/admin/users?page=" + page + "&per_page=50");
    const users = Array.isArray(listing?.users) ? listing.users : [];
    authMatches.push(...users.filter(user =>
      String(user.email || "").trim().toLowerCase() === PROMOTEUR_EMAIL
    ));
    if (users.length < 50) break;
  }
  assert.equal(authMatches.length, 1, "L'identité Auth Promoteur existante doit être unique.");
  const user = authMatches[0];
  assert.equal(user.id, profile.id, "L'identité Auth doit correspondre au profil Promoteur.");
  assert.ok(user.email_confirmed_at, "L'adresse de la fixture doit déjà être confirmée.");
  assert.equal(user.user_metadata?.naxa_e2e_promoteur, PROMOTEUR_MARKER,
    "Marqueur de fixture Promoteur absent : aucune modification Auth.");
  
  // Rotation limitée au mot de passe de cette fixture technique existante.
  // Aucun compte Auth/profil, affectation ou donnée métier n'est créé.
  const password = randomBytes(32).toString("base64url") + "Aa!9";
  await adminRequest(
    "/auth/v1/admin/users/" + encodeURIComponent(user.id),
    "PUT",
    { password }
  );

  let browser;
  let page;
  let loggedIn = false;
  let logoutPassed = false;
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();

    await context.addCookies([{
      name: "naxa-age-status-v2",
      value: "adult",
      url: baseUrl + "/",
      sameSite: "Lax",
    }]);
    await page.addInitScript(() => {
      window.localStorage.setItem("naxa-age-declaration-v1", JSON.stringify({
        confirmed: true,
        at: Date.now(),
      }));
    });

    const loginResponsePromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/auth/login"
        && response.request().method() === "POST",
      { timeout: 60000 }
    );
    await page.goto(
      baseUrl + "/connexion?espace=pharmacie&retour=" + encodeURIComponent("/pharmacie/promoteur"),
      { waitUntil: "domcontentloaded" }
    );
    await page.locator("#username").waitFor({ state: "visible", timeout: 30000 });
    await page.locator("#username").fill(PROMOTEUR_USERNAME);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Connexion", exact: true }).click();

    const loginResponse = await loginResponsePromise;
    if (!loginResponse.ok()) {
      throw new Error("Connexion UI Promoteur refusée (HTTP " + loginResponse.status() + ").");
    }
    await page.waitForURL(url => url.pathname === "/pharmacie/promoteur", {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });
    loggedIn = true;
    console.log("PASS — connexion navigateur sur la fixture Promoteur Replay existante.");

    const sideNav = page.getByRole("navigation", { name: "Sections Promoteur" });
    const sideLink = sideNav.getByRole("link", { name: "Livraisons du réseau", exact: true });
    assert.equal(await sideLink.count(), 1, "Le lien latéral Promoteur doit apparaître une fois.");

    const subNav = page.getByRole("navigation", { name: "Navigation des sous-pages Promoteur" });
    const subLink = subNav.getByRole("link", { name: "Livraisons de mon réseau", exact: true });
    assert.equal(await subLink.count(), 1, "Le lien des sous-pages Promoteur doit apparaître une fois.");
    console.log("PASS — liens latéral et sous-pages Promoteur visibles.");

    await subLink.click();
    await page.waitForURL(url => url.pathname === TARGET_PATH, { timeout: 30000 });
    await page.getByRole("heading", { name: "Livraisons de mon réseau", exact: true }).waitFor({
      state: "visible",
      timeout: 30000,
    });
    assert.equal(await sideNav.getByRole("link", { name: "Livraisons du réseau", exact: true })
      .getAttribute("aria-current"), "page");
    console.log("PASS — clic sous-navigation, route cible et titre affiché.");

    await page.goto(baseUrl + "/pharmacie/promoteur", { waitUntil: "domcontentloaded" });
    await sideNav.getByRole("link", { name: "Livraisons du réseau", exact: true }).click();
    await page.waitForURL(url => url.pathname === TARGET_PATH, { timeout: 30000 });
    await page.getByRole("heading", { name: "Livraisons de mon réseau", exact: true }).waitFor({
      state: "visible",
      timeout: 30000,
    });
    console.log("PASS — clic navigation latérale persistante.");

    // Le Promoteur ne possède aucun membership Partenaire en Replay : l'accès direct doit être refusé.
    await page.goto(baseUrl + "/partenaire/examens", { waitUntil: "domcontentloaded" });
    assert.notEqual(new URL(page.url()).pathname, "/partenaire/examens",
      "Un Promoteur sans membership ne doit pas entrer dans l'espace Partenaire.");
    console.log("PASS — garde serveur Partenaire refuse l'accès au Promoteur non membre.");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl + "/pharmacie/promoteur", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click();
    const mobileNav = page.getByRole("navigation", { name: "Sections Promoteur" });
    const mobileLink = mobileNav.getByRole("link", { name: "Livraisons du réseau", exact: true });
    await mobileLink.waitFor({ state: "visible", timeout: 15000 });
    await mobileLink.click();
    await page.waitForURL(url => url.pathname === TARGET_PATH, { timeout: 30000 });
    await page.getByRole("heading", { name: "Livraisons de mon réseau", exact: true }).waitFor({
      state: "visible",
      timeout: 30000,
    });
    console.log("PASS — menu mobile Promoteur ouvert et lien Livraisons cliquable.");

  } finally {
    if (loggedIn && page) {
      try {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(baseUrl + "/pharmacie/promoteur", { waitUntil: "domcontentloaded", timeout: 30000 });
        const logout = page.getByRole("button", { name: "Déconnexion", exact: true });
        if (await logout.count() === 1) {
          await logout.click();
          await page.waitForURL(url => url.pathname === "/connexion", { timeout: 30000 });
          logoutPassed = true;
          console.log("PASS — session navigateur Promoteur fermée par l'action de déconnexion NAXA.");
        }
      } catch (error) {
        console.error("ATTENTION — fermeture explicite de session non confirmée : "
          + (error instanceof Error ? error.message : "erreur inconnue"));
      }
    }
    if (browser) await browser.close();
  }

  assert.equal(logoutPassed, true, "La session navigateur doit être fermée avant le succès du contrôle.");
  console.log("RÉSULTAT — navigation Promoteur testée sur Replay, sans création de compte ni écriture métier.");
}

if (require.main === module) {
  run().catch(error => {
    console.error("ÉCHEC — " + (error instanceof Error ? error.message : "erreur inconnue"));
    process.exitCode = 1;
  });
}

module.exports = { assertReplayUrl };
