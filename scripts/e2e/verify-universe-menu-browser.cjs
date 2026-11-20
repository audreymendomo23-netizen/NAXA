#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const CLIENT_EMAIL = "naxa.e2e.client-acheteur@example.invalid";
const CLIENT_USERNAME = "naxa_e2e_acheteur";
const EXPECTED_UNIVERSES = {
  pharmacie: true,
  parapharmacie: false,
  "bebe-maman": false,
  examens: false,
  prestations: false,
  dispositifs: false,
  suivi: false,
};
const PUBLIC_PICKER = [
  { id: "pharmacie", label: "Pharmacie" },
  { id: "parapharmacie", label: "Parapharmacie" },
  { id: "bebe-maman", label: "Bébé & Maman" },
  { id: "dispositifs", label: "Dispositifs connectés" },
  { id: "examens", label: "Examens médicaux" },
  { id: "prestations", label: "Soins & Prestations à domicile" },
];
const LOCKED_MENU = [
  "Parapharmacie",
  "Bébé & Maman",
  "Dispositifs connectés",
  "Examens médicaux",
  "Soins & Prestations à domicile",
];
const LOCKED_ROUTES = [
  ["parapharmacie", "parapharmacie"],
  ["bebe-maman", "bebe-maman"],
  ["examens", "examens"],
  ["prestations", "prestations"],
  ["suivi", "suivi"],
  ["centre-examens", "examens"],
];

function required(value, label) {
  const result = String(value || "").trim();
  if (!result) throw new Error("Configuration manquante : " + label + ".");
  return result;
}

function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (url.protocol !== "https:" || url.hostname !== PROJECT_REF + ".supabase.co"
    || !["", "/"].includes(url.pathname)) {
    throw new Error("Sécurité : recette du menu limitée au projet Replay " + PROJECT_REF + ".");
  }
  return url.origin;
}

function readSecret(path, label) {
  const file = required(path, label);
  if (!fs.existsSync(file)) throw new Error("Fichier secret absent pour " + label + ".");
  const value = fs.readFileSync(file, "utf8");
  if (!value) throw new Error("Fichier secret vide pour " + label + ".");
  return value;
}

function assertUniverseStatus(payload) {
  if (!payload || typeof payload !== "object" || !payload.universes
    || typeof payload.universes !== "object") {
    throw new Error("Réponse du statut des univers invalide.");
  }
  for (const [slug, expected] of Object.entries(EXPECTED_UNIVERSES)) {
    if (payload.universes[slug] !== expected) {
      throw new Error("Statut inattendu pour " + slug + " : attendu "
        + expected + ", reçu " + String(payload.universes[slug]) + ".");
    }
  }
  return true;
}

async function run(env = process.env) {
  const { chromium } = require("playwright");
  const supabaseUrl = assertReplayUrl(env.NAXA_STORAGE_E2E_URL || env.SUPABASE_URL);
  const anonKey = required(env.NAXA_STORAGE_E2E_ANON_KEY, "clé publique Replay");
  const webBase = String(env.NAXA_E2E_WEB_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const clientPassword = readSecret(env.NAXA_STORAGE_E2E_CLIENT_PASSWORD_FILE, "Client acheteur E2E");

  const statusResponse = await fetch(webBase + "/api/universes/status", { cache: "no-store" });
  if (!statusResponse.ok) {
    throw new Error("GET /api/universes/status a répondu HTTP " + statusResponse.status + ".");
  }
  const statusPayload = await statusResponse.json();
  assertUniverseStatus(statusPayload);
  process.stdout.write("PASS — API combinée 200 : Pharmacie ouverte et cinq autres espaces verrouillés.\n");

  let browser;
  let clientPage;
  let clientAccessToken = null;
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

    // 1. Accueil public : les six cartes doivent rester visibles, avec la seule
    // Pharmacie active quand les cinq univers métier sont désactivés sur Replay.
    const publicPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await publicPage.context().addCookies([{
      name: "naxa-age-status-v2",
      value: "adult",
      url: webBase + "/",
      sameSite: "Lax",
    }]);
    await publicPage.addInitScript(() => {
      window.localStorage.setItem("naxa-home-age-declaration-v1", JSON.stringify({
        confirmed: true,
        at: Date.now(),
      }));
    });
    await publicPage.goto(webBase + "/?choisirEcosysteme=1", { waitUntil: "domcontentloaded" });
    await publicPage.locator("#naxa-intro-overlay").waitFor({ state: "attached", timeout: 15000 });
    await publicPage.waitForTimeout(100);
    const selectorStatus = publicPage.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/universes/status"
        && response.request().method() === "GET",
    { timeout: 30000 });
    await publicPage.keyboard.press("Escape");
    await publicPage.getByRole("heading", { name: "Choisissez votre écosystème", exact: true })
      .waitFor({ state: "visible", timeout: 30000 });
    const selectorResponse = await selectorStatus;
    if (!selectorResponse.ok()) throw new Error("Le sélecteur public n'a pas reçu l'état central.");
    const publicCards = publicPage.locator("main button[data-universe-id]");
    for (const item of PUBLIC_PICKER) {
      const card = publicPage.locator('main button[data-universe-id="' + item.id + '"]');
      if (await card.count() !== 1) {
        throw new Error("Carte publique absente ou dupliquée : " + item.id + " (" + item.label + ").");
      }
      if (await card.getByText(item.label, { exact: true }).count() !== 1) {
        throw new Error("Libellé public absent ou dupliqué pour " + item.label + ".");
      }
      const enabled = await card.isEnabled();
      if (enabled !== (item.id === "pharmacie")) {
        throw new Error("Disponibilité incohérente sur la carte publique " + item.label + ".");
      }
    }
    if (await publicCards.count() !== 6) {
      throw new Error("Le sélecteur public doit afficher exactement six cartes.");
    }
    process.stdout.write("PASS — sélecteur public : six cartes visibles, Pharmacie seule activée.\n");
    await publicPage.close();

    // 2. Connexion Client réelle : la navigation du menu doit refléter le même RPC.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    clientPage = await context.newPage();
    await context.addCookies([{
      name: "naxa-age-status-v2",
      value: "adult",
      url: webBase + "/",
      sameSite: "Lax",
    }]);
    await clientPage.addInitScript(() => {
      window.localStorage.setItem("naxa-age-declaration-v1", JSON.stringify({
        confirmed: true,
        at: Date.now(),
      }));
    });
    await clientPage.goto(webBase + "/connexion?espace=client&retour="
      + encodeURIComponent("/client"), { waitUntil: "domcontentloaded" });
    await clientPage.locator("#username").waitFor({ state: "visible", timeout: 30000 });
    await clientPage.locator("#username").fill(CLIENT_USERNAME);
    await clientPage.locator("#password").fill(clientPassword);
    const menuStatusPromise = clientPage.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/universes/status"
        && response.request().method() === "GET",
    { timeout: 30000 });
    const loginPromise = clientPage.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/auth/login"
        && response.request().method() === "POST",
    { timeout: 60000 });
    await clientPage.getByRole("button", { name: "Connexion", exact: true }).click();
    const loginResponse = await loginPromise;
    if (!loginResponse.ok()) {
      throw new Error("Connexion Client E2E refusée (HTTP " + loginResponse.status() + ").");
    }
    await clientPage.waitForURL(url => url.pathname === "/client", {
      timeout: 60000, waitUntil: "domcontentloaded",
    });
    await clientPage.getByRole("button", { name: "Autres services", exact: true })
      .waitFor({ state: "visible", timeout: 30000 });

    const menuStatus = await menuStatusPromise;
    if (!menuStatus.ok()) throw new Error("Le menu Client n'a pas reçu le statut central des univers.");
    assertUniverseStatus(await menuStatus.json());
    await clientPage.getByRole("button", { name: "Autres services", exact: true }).click();
    const menu = clientPage.locator('nav[data-naxa-client-menu][aria-label="Changer d’écosystème"]');
    await menu.waitFor({ state: "visible", timeout: 15000 });
    await menu.getByText("Changer d’écosystème", { exact: true }).waitFor({ state: "visible" });

    for (const label of LOCKED_MENU) {
      const item = menu.locator("button").filter({ hasText: label });
      if (await item.count() !== 1 || !(await item.isDisabled())
        || await item.getAttribute("aria-disabled") !== "true") {
        throw new Error("Le menu Client doit garder " + label + " visible et non cliquable.");
      }
    }
    if (await menu.locator("a").count() !== 0) {
      throw new Error("Aucun lien d'accès ne doit être rendu pour un univers verrouillé.");
    }
    if (await menu.locator("button").filter({ hasText: "Pharmacie" }).count() !== 0) {
      throw new Error("Le menu secondaire ne doit pas dupliquer l'écosystème actuellement actif.");
    }
    process.stdout.write("PASS — menu Client : cinq univers secondaires visibles, tous verrouillés et non cliquables.\n");

    // 3. Les gardes de routes directes doivent pointer vers la même décision Admin.
    for (const [route, slug] of LOCKED_ROUTES) {
      await clientPage.goto(webBase + "/" + route, { waitUntil: "domcontentloaded" });
      const destination = new URL(clientPage.url());
      if (destination.pathname !== "/"
        || destination.searchParams.get("universVerrouille") !== slug
        || destination.searchParams.get("choisirEcosysteme") !== "1") {
        throw new Error("La route /" + route + " n'a pas été redirigée par le verrou Admin attendu.");
      }
    }
    process.stdout.write("PASS — six accès directs verrouillés redirigés vers le sélecteur public avec le slug exact.\n");

    // Capture du jeton de la session navigateur pour une déconnexion locale Auth contrôlée.
    clientAccessToken = await clientPage.evaluate(() => {
      for (const key of Object.keys(window.localStorage)) {
        if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
        try {
          const stored = JSON.parse(window.localStorage.getItem(key) || "null");
          if (typeof stored?.access_token === "string") return stored.access_token;
        } catch { /* autre entrée de stockage : ignorer */ }
      }
      return null;
    }).catch(() => null);
  } finally {
    if (clientAccessToken) {
      await fetch(supabaseUrl + "/auth/v1/logout?scope=local", {
        method: "POST",
        headers: { apikey: anonKey, Authorization: "Bearer " + clientAccessToken },
      }).catch(() => null);
    }
    if (clientPage) await clientPage.close().catch(() => null);
    if (browser) await browser.close().catch(() => null);
  }

  process.stdout.write("RESULT — menu, sélecteur public, statut API et gardes URL testés sur Replay.\n");
  return true;
}

if (require.main === module) {
  run().catch(error => {
    process.stderr.write("UNIVERSES MENU BROWSER E2E BLOQUÉ — "
      + (error?.message || "erreur inconnue") + "\n");
    process.exitCode = 1;
  });
}

module.exports = { assertReplayUrl, assertUniverseStatus, EXPECTED_UNIVERSES, PUBLIC_PICKER, LOCKED_MENU, LOCKED_ROUTES };
