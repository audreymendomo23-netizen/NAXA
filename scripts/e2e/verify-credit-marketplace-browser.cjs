#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const { chromium } = require("playwright");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const PHARMACY_ID = "1a4f1ce5-cccf-477e-9a5b-474c8c9fc713";
const PRODUCT_ID = "dfd7313c-46a4-455a-b67d-50f0ce2a3686";
const PRODUCT_NAME = "NAXA E2E — Produit crédit comptoir";
const PROMOTER_EMAIL = "naxa.e2e.promoteur@example.invalid";
const PROMOTER_USERNAME = "naxa_e2e_promoteur";
const CLIENT_EMAIL = "naxa.e2e.client-acheteur@example.invalid";
const CLIENT_USERNAME = "naxa_e2e_acheteur";

function required(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error("Configuration absente : " + label + ".");
  return text;
}
function readSecret(file, label) {
  const target = required(file, label);
  if (!fs.existsSync(target)) throw new Error("Fichier de mot de passe absent pour " + label + ".");
  return fs.readFileSync(target, "utf8");
}
function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (url.protocol !== "https:" || url.hostname !== PROJECT_REF + ".supabase.co"
    || !["", "/"].includes(url.pathname)) {
    throw new Error("Sécurité : recette Marketplace limitée au projet Replay.");
  }
  return url.origin;
}
function futureCameroonDate(days) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(Date.now() + days * 86400000));
  const part = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return part.year + "-" + part.month + "-" + part.day;
}

async function run(env = process.env) {
  const supabaseUrl = assertReplayUrl(env.NAXA_STORAGE_E2E_URL || env.SUPABASE_URL);
  const anonKey = required(env.NAXA_STORAGE_E2E_ANON_KEY, "clé anonyme Replay");
  const adminKey = required(env.NAXA_STORAGE_E2E_ADMIN_KEY, "clé Admin Replay");
  const webBase = String(env.NAXA_E2E_WEB_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const promoterPassword = readSecret(env.NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD_FILE, "Promoteur");
  const clientPassword = readSecret(env.NAXA_STORAGE_E2E_CLIENT_PASSWORD_FILE, "Client");
  const apiTokens = [];
  let promoterToken = null;
  let clientToken = null;
  let promoterId = null;
  let clientId = null;
  let requestId = null;
  let browser = null;
  let listingEnabled = false;
  let uploadedPath = "";
  let primaryError = null;

  async function request(path, options = {}) {
    const admin = options.admin === true;
    const headers = {
      apikey: admin ? adminKey : anonKey,
      "Content-Type": "application/json",
    };
    if (options.token) headers.Authorization = "Bearer " + options.token;
    else if (admin && !adminKey.startsWith("sb_secret_")) headers.Authorization = "Bearer " + adminKey;
    else if (!admin && !anonKey.startsWith("sb_publishable_")) headers.Authorization = "Bearer " + anonKey;
    if (options.prefer) headers.Prefer = options.prefer;
    const response = await fetch(supabaseUrl + path, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!response.ok) {
      const detail = typeof data?.message === "string" ? data.message : String(raw || "requête refusée");
      throw new Error((options.label || path) + " : HTTP " + response.status + " — " + detail.slice(0, 300));
    }
    return data;
  }
  async function rows(path) {
    const data = await request("/rest/v1/" + path, { admin: true, label: "Lecture contrôlée Replay" });
    if (!Array.isArray(data)) throw new Error("Réponse REST invalide pour " + path);
    return data;
  }
  async function rpc(name, token, args) {
    return request("/rest/v1/rpc/" + name, {
      method: "POST", token, body: args, label: "RPC " + name,
    });
  }
  async function login(email, password, label) {
    const data = await request("/auth/v1/token?grant_type=password", {
      method: "POST", body: { email, password }, label: "Connexion Auth " + label,
    });
    if (!data?.access_token || !data?.user?.id) throw new Error("Session Auth incomplète pour " + label + ".");
    apiTokens.push(data.access_token);
    return { id: data.user.id, token: data.access_token };
  }
  async function pageLogin(page, username, password, space, returnPath) {
    await page.context().addCookies([{
      name: "naxa-age-status-v2", value: "adult", url: webBase + "/", sameSite: "Lax",
    }]);
    await page.addInitScript(() => {
      window.localStorage.setItem("naxa-age-declaration-v1", JSON.stringify({ confirmed: true, at: Date.now() }));
    });
    const response = await page.goto(webBase + "/connexion?espace=" + space + "&retour=" + encodeURIComponent(returnPath), {
      waitUntil: "domcontentloaded",
    });
    try {
      await page.locator("#username").waitFor({ state: "visible", timeout: 30000 });
    } catch {
      const details = await page.evaluate(() => ({
        url: window.location.href, title: document.title, body: document.body?.innerText?.slice(0, 400) || "",
      })).catch(() => ({ url: page.url(), title: "", body: "" }));
      throw new Error("Écran de connexion absent (HTTP " + (response?.status() ?? "?")
        + ", URL " + details.url + ", " + details.title + ", " + details.body + ").");
    }
    await page.locator("#username").fill(username);
    await page.locator("#password").fill(password);
    const loginResponsePromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/auth/login"
        && response.request().method() === "POST",
    { timeout: 60000 });
    await page.getByRole("button", { name: "Connexion", exact: true }).click();
    const loginResponse = await loginResponsePromise;
    let loginPayload = null;
    try { loginPayload = await loginResponse.json(); } catch { /* diagnostic HTTP conservé */ }
    if (!loginResponse.ok()) {
      throw new Error("API login refusée (HTTP " + loginResponse.status() + ") : "
        + String(loginPayload?.error || loginPayload?.message || "réponse sans détail").slice(0, 240));
    }
    try {
      await page.waitForURL(url => url.pathname === returnPath, {
        timeout: 60000,
        waitUntil: "domcontentloaded",
      });
    } catch {
      const diagnostic = await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        body: document.body?.innerText?.slice(0, 500) || "",
      })).catch(() => ({ url: page.url(), title: "", body: "" }));
      throw new Error("API login acceptée mais destination Marketplace absente (attendue " + returnPath
        + ", URL " + diagnostic.url + ", titre " + diagnostic.title
        + ", contenu " + diagnostic.body + ").");
    }
  }

  try {
    const [promoter, client] = await Promise.all([
      login(PROMOTER_EMAIL, promoterPassword, "Promoteur"),
      login(CLIENT_EMAIL, clientPassword, "Client"),
    ]);
    promoterToken = promoter.token; promoterId = promoter.id;
    clientToken = client.token; clientId = client.id;

    const profiles = await rows("profiles?select=id,role,actif,age_verified,consent_accepted_at&id=in.("
      + promoterId + "," + clientId + ")");
    const clientProfile = profiles.find(x => x.id === clientId);
    const promoterProfile = profiles.find(x => x.id === promoterId);
    if (!clientProfile || clientProfile.role !== "client" || clientProfile.actif !== true
      || clientProfile.age_verified !== true || !clientProfile.consent_accepted_at) {
      throw new Error("Le profil Client de recette n'est pas majeur, actif ou complet.");
    }
    if (!promoterProfile || promoterProfile.role !== "promoteur" || promoterProfile.actif !== true) {
      throw new Error("Le profil Promoteur de recette n'est pas actif.");
    }

    const pharmacies = await rows("pharmacies?select=id,nom,actif,archivee_le,visible_recherche,est_demo&id=eq."
      + PHARMACY_ID + "&limit=2");
    if (pharmacies.length !== 1 || pharmacies[0].actif !== true || pharmacies[0].archivee_le !== null
      || pharmacies[0].visible_recherche !== false || pharmacies[0].est_demo !== false) {
      throw new Error("La pharmacie technique doit commencer masquée, active et non commerciale.");
    }
    const links = await rows("promoteur_pharmacies?select=pharmacie_id,actif&promoteur_id=eq."
      + promoterId + "&pharmacie_id=eq." + PHARMACY_ID + "&actif=eq.true");
    if (links.length !== 1) throw new Error("La pharmacie de recette n'est pas dans le réseau du Promoteur.");

    const stockBefore = await rows("stocks?select=pharmacie_id,produit_id,prix,quantite,updated_at"
      + "&pharmacie_id=eq." + PHARMACY_ID + "&produit_id=eq." + PRODUCT_ID + "&limit=2");
    if (stockBefore.length !== 1 || Number(stockBefore[0].prix) !== 1000 || Number(stockBefore[0].quantite) < 1) {
      throw new Error("Produit interne absent ou stock non disponible.");
    }
    if (Date.now() - new Date(stockBefore[0].updated_at).getTime() > 48 * 3600 * 1000) {
      throw new Error("Le stock technique n'est plus assez récent pour l'offre Marketplace.");
    }

    await rpc("naxa_select_active_role", promoterToken, { p_role_code: "promoteur", p_pharmacie_id: null });
    await rpc("client_credit_configurer", promoterToken, {
      p_client: clientId, p_pharmacie: PHARMACY_ID, p_plafond: 5000,
    });
    const credits = await rows("client_credits?select=id,plafond,solde,actif&client_id=eq."
      + clientId + "&pharmacie_id=eq." + PHARMACY_ID + "&limit=2");
    if (credits.length !== 1 || credits[0].actif !== true || Number(credits[0].solde) !== 0) {
      throw new Error("Le compte crédit Marketplace du Client doit être unique, actif et soldé.");
    }

    const activeRequests = await rows("client_credit_requests?select=id,statut,consumed_at,origine,created_at"
      + "&client_id=eq." + clientId + "&pharmacie_id=eq." + PHARMACY_ID
      + "&statut=in.(en_attente,approuvee)&consumed_at=is.null");
    if (activeRequests.length) {
      const recoverable = activeRequests.filter(item => item.statut === "en_attente"
        && item.origine === "marketplace" && Number.isFinite(Date.parse(item.created_at))
        && Date.parse(item.created_at) < Date.now());
      if (activeRequests.length !== 1 || recoverable.length !== 1) {
        throw new Error("Le Client a une demande de crédit active qui n'est pas une ancienne fixture Marketplace sûre à récupérer ; recette arrêtée sans écraser son état.");
      }
      await rpc("client_credit_demande_decider", promoterToken, {
        p_demande: recoverable[0].id, p_approuver: false,
      });
      const recovered = await rows("client_credit_requests?select=id,statut,decided_by,decided_at&id=eq."
        + recoverable[0].id + "&limit=2");
      if (recovered.length !== 1 || recovered[0].statut !== "rejetee"
        || recovered[0].decided_by !== promoterId || !recovered[0].decided_at) {
        throw new Error("La récupération métier de l'ancienne demande Marketplace n'est pas confirmée.");
      }
      process.stdout.write("RECOVERY PASS — ancienne demande Marketplace technique refusée par le Promoteur et journalisée.\\n");
    }

    const changed = await request("/rest/v1/pharmacies?id=eq." + PHARMACY_ID, {
      method: "PATCH", admin: true, body: { visible_recherche: true },
      prefer: "return=representation", label: "Exposition temporaire de la pharmacie technique sur Replay",
    });
    // Dès que PATCH répond avec succès, le bloc finally doit remasquer la pharmacie,
    // y compris si la réponse ne contient pas la ligne attendue.
    listingEnabled = true;
    if (!Array.isArray(changed) || changed.length !== 1 || changed[0].visible_recherche !== true) {
      throw new Error("La visibilité Marketplace temporaire n'a pas pu être activée sur Replay.");
    }

    const offers = await rpc("marketplace_offre_stock_disponible", clientToken, {
      p_pharmacie: PHARMACY_ID, p_produit: PRODUCT_ID,
    });
    const offer = Array.isArray(offers) ? offers[0] : offers;
    if (!offer || Number(offer.prix) !== 1000 || Number(offer.quantite) < 1) {
      throw new Error("Aucune offre Marketplace publique n'est retournée pour le produit de recette.");
    }
    const publicProduct = await request("/rest/v1/produits?select=id,nom&id=eq." + PRODUCT_ID, {
      token: clientToken, label: "Lecture publique du produit de recette",
    });
    if (!Array.isArray(publicProduct) || publicProduct.length !== 1 || publicProduct[0].nom !== PRODUCT_NAME) {
      throw new Error("Le produit n'est pas lisible par le Client dans le catalogue public.");
    }

    browser = await chromium.launch({ headless: true });
    const clientContext = await browser.newContext();
    const clientPage = await clientContext.newPage();
    clientPage.setDefaultTimeout(30000);
    await pageLogin(clientPage, CLIENT_USERNAME, clientPassword, "client",
      "/offre/" + PHARMACY_ID + "/" + PRODUCT_ID);
    await clientPage.goto(webBase + "/offre/" + PHARMACY_ID + "/" + PRODUCT_ID, {
      waitUntil: "domcontentloaded",
    });
    await clientPage.getByRole("heading", { name: PRODUCT_NAME, exact: true }).waitFor();
    await clientPage.getByRole("button", { name: /Ajouter NAXA E2E.*au panier/ }).click();
    await clientPage.waitForURL(url => url.pathname === "/commande/nouvelle", { timeout: 60000 });

    const basket = await clientPage.evaluate(() => JSON.parse(window.localStorage.getItem("naxa-panier-v1") || "[]"));
    if (!Array.isArray(basket) || basket.length !== 1 || basket[0].produit_id !== PRODUCT_ID
      || basket[0].pharmacie_id !== PHARMACY_ID || Number(basket[0].quantite) !== 1) {
      throw new Error("Le produit de la pharmacie technique n'a pas été ajouté au panier client.");
    }

    await clientPage.goto(webBase + "/achats/credit", { waitUntil: "domcontentloaded" });
    await clientPage.getByRole("heading", { name: "Demande d’achat à crédit", exact: true }).waitFor();
    const creditForm = clientPage.locator("form").first();
    await creditForm.locator("select").first().selectOption(PHARMACY_ID);
    await creditForm.locator('input[type="tel"]').fill("+237690000000");
    await creditForm.locator('input[type="date"]').fill(futureCameroonDate(2));
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");
    await creditForm.locator('input[type="file"]').setInputFiles({
      name: "naxa-replay-justificatif-credit.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    const submit = creditForm.getByRole("button", { name: "Soumettre la demande de crédit", exact: true });
    await submit.waitFor({ state: "visible" });
    await submit.click();
    await clientPage.getByRole("heading", { name: "Demande transmise", exact: true }).waitFor({ timeout: 60000 });
    const referenceText = await clientPage.getByText(/Référence\s*:/).innerText();
    const match = referenceText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    if (!match) throw new Error("Référence de demande Marketplace absente de l'écran Client.");
    requestId = match[0];

    const pending = await rows("client_credit_requests?select=id,pharmacie_id,client_id,montant,statut,origine,panier_items,reservation_id,justificatif_path"
      + "&id=eq." + requestId + "&limit=2");
    const stockAfterSubmit = await rows("stocks?select=quantite&pharmacie_id=eq."
      + PHARMACY_ID + "&produit_id=eq." + PRODUCT_ID + "&limit=2");
    if (pending.length !== 1 || pending[0].statut !== "en_attente" || pending[0].origine !== "marketplace"
      || pending[0].pharmacie_id !== PHARMACY_ID || pending[0].client_id !== clientId
      || Number(pending[0].montant) !== 1000 || pending[0].reservation_id !== null
      || !pending[0].justificatif_path || !Array.isArray(pending[0].panier_items)
      || pending[0].panier_items.length !== 1 || pending[0].panier_items[0].produit_id !== PRODUCT_ID
      || Number(stockAfterSubmit[0]?.quantite) !== Number(stockBefore[0].quantite)) {
      throw new Error("La demande Marketplace n'est pas en attente sans débit de stock.");
    }

    const promoterContext = await browser.newContext();
    const promoterPage = await promoterContext.newPage();
    promoterPage.setDefaultTimeout(30000);
    await pageLogin(promoterPage, PROMOTER_USERNAME, promoterPassword, "pharmacie", "/pharmacie/promoteur/credits");
    await promoterPage.getByRole("heading", { name: /Crédits clients/ }).waitFor();
    // La référence affichée dans l'interface est dérivée de l'UUID de la demande.
    // On cible cet identifiant exact, jamais le nom du produit ou une position de carte.
    const requestReference = requestId.replace(/-/g, "").slice(0, 8).toUpperCase();
    const requestHeading = promoterPage.getByRole("heading", {
      name: "Demande #" + requestReference,
      exact: true,
    });
    await requestHeading.waitFor({ state: "visible", timeout: 60000 });
    const requestCard = promoterPage.locator("article").filter({ has: requestHeading });
    if (await requestCard.count() !== 1) {
      throw new Error("La référence exacte de la demande Marketplace doit identifier une seule carte.");
    }
    const requestCardText = await requestCard.innerText();
    if (!requestCardText.includes("Source : Marketplace") || !requestCardText.includes("en_attente")) {
      throw new Error("La carte ciblée n'est pas la demande Marketplace encore en attente.");
    }
    const refuseButton = requestCard.getByRole("button", { name: "Refuser", exact: true });
    if (await refuseButton.count() !== 1) {
      throw new Error("La demande Marketplace en attente doit exposer un unique bouton Refuser.");
    }
    await refuseButton.click();
    await promoterPage.waitForURL(url => url.pathname === "/pharmacie/promoteur/credits"
      && url.searchParams.get("ok") === "rejetee", { timeout: 60000 });
    await promoterPage.getByText("Demande refusée ; aucun stock n’a été débité.", { exact: true }).waitFor();

    const rejected = await rows("client_credit_requests?select=id,statut,decided_by,reservation_id,consumed_at"
      + "&id=eq." + requestId + "&limit=1");
    const stockAfterReject = await rows("stocks?select=quantite&pharmacie_id=eq."
      + PHARMACY_ID + "&produit_id=eq." + PRODUCT_ID + "&limit=1");
    if (rejected.length !== 1 || rejected[0].statut !== "rejetee"
      || rejected[0].decided_by !== promoterId || rejected[0].reservation_id !== null
      || rejected[0].consumed_at !== null
      || Number(stockAfterReject[0]?.quantite) !== Number(stockBefore[0].quantite)) {
      throw new Error("Le refus Promoteur Marketplace a modifié le stock ou n'a pas été enregistré.");
    }

    process.stdout.write("PASS — le Client authentifié voit l’offre privée de recette publiée temporairement sur Replay.\\n");
    process.stdout.write("PASS — ajout au panier, formulaire Marketplace, justificatif PDF et soumission Client.\\n");
    process.stdout.write("PASS — demande enregistrée « en_attente » à 1 000 FCFA, sans réservation ni débit de stock.\\n");
    process.stdout.write("PASS — le Promoteur refuse depuis son interface ; la demande passe à « rejetee », stock inchangé.\\n");
    process.stdout.write("INFO — la visibilité de la pharmacie sera rétablie à false dans le bloc de nettoyage. Le justificatif de recette reste dans le bucket privé avec la demande auditée.\\n");
  } catch (error) {
    primaryError = error;
  } finally {
    if (requestId && promoterToken) {
      try {
        const state = await rows("client_credit_requests?select=id,statut&id=eq." + requestId + "&limit=1");
        if (state.length === 1 && state[0].statut === "en_attente") {
          await rpc("client_credit_demande_decider", promoterToken, {
            p_demande: requestId, p_approuver: false,
          });
        }
      } catch (error) {
        if (primaryError) process.stderr.write("RÉCUPÉRATION DEMANDE — " + error.message + "\\n");
        else primaryError = error;
      }
    }
    if (listingEnabled) {
      try {
        const restored = await request("/rest/v1/pharmacies?id=eq." + PHARMACY_ID, {
          method: "PATCH", admin: true, body: { visible_recherche: false },
          prefer: "return=representation", label: "Restauration du masquage Replay",
        });
        if (!Array.isArray(restored) || restored.length !== 1 || restored[0].visible_recherche !== false) {
          throw new Error("Le masquage Marketplace de la pharmacie de recette n'a pas été restauré.");
        }
      } catch (error) {
        if (primaryError) process.stderr.write("RESTAURATION VISIBILITÉ — " + error.message + "\\n");
        else primaryError = error;
      }
    }
    if (browser) await browser.close().catch(() => null);
    for (const token of [...new Set(apiTokens)].reverse()) {
      await request("/auth/v1/logout?scope=local", {
        method: "POST", token, label: "Fermeture session Auth Marketplace",
      }).catch(() => null);
    }
  }
  if (primaryError) throw primaryError;
  return true;
}

if (require.main === module) {
  run().catch(error => {
    process.stderr.write("MARKETPLACE CREDIT BROWSER E2E BLOQUÉ — " + (error?.message || "erreur inconnue") + "\\n");
    process.exitCode = 1;
  });
}
module.exports = { run, assertReplayUrl, PHARMACY_ID, PRODUCT_ID };
