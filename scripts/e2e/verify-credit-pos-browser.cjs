#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const { chromium } = require("playwright");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const PHARMACY_ID = "1a4f1ce5-cccf-477e-9a5b-474c8c9fc713";
const PRODUCT_ID = process.env.NAXA_STORAGE_E2E_CREDIT_PRODUCT_ID || "";
const PRODUCT_NAME = "NAXA E2E — Produit crédit comptoir";
const PROMOTER_EMAIL = "naxa.e2e.promoteur@example.invalid";
const CASHIER_EMAIL = "naxa.e2e.expiry-stock@example.invalid";
const CLIENT_EMAIL = "naxa.e2e.client-acheteur@example.invalid";
const PROMOTER_USERNAME = "naxa_e2e_promoteur";
const CASHIER_USERNAME = "naxa_e2e_expiry_stock";
const CLIENT_USERNAME = "naxa_e2e_acheteur";
const CREDIT_LIMIT = 500;
const SALE_AMOUNT = 1000;

function required(value, label) {
  const result = String(value || "").trim();
  if (!result) throw new Error("Configuration manquante : " + label + ".");
  return result;
}

function readSecret(path, label) {
  const file = required(path, label);
  if (!fs.existsSync(file)) throw new Error("Fichier secret absent pour " + label + ".");
  const value = fs.readFileSync(file, "utf8");
  if (!value) throw new Error("Fichier secret vide pour " + label + ".");
  return value;
}

function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (url.protocol !== "https:" || url.hostname !== PROJECT_REF + ".supabase.co"
    || !["", "/"].includes(url.pathname)) {
    throw new Error("Sécurité : la recette navigateur crédit est limitée à Replay.");
  }
  return url.origin;
}

async function run(env = process.env) {
  const supabaseUrl = assertReplayUrl(env.NAXA_STORAGE_E2E_URL || env.SUPABASE_URL);
  const anonKey = required(env.NAXA_STORAGE_E2E_ANON_KEY, "clé anonyme Replay");
  const adminKey = required(env.NAXA_STORAGE_E2E_ADMIN_KEY, "clé Admin Replay");
  const webBase = String(env.NAXA_E2E_WEB_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  if (!PRODUCT_ID) throw new Error("Identifiant du produit privé de recette absent.");
  const promoterPassword = readSecret(env.NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD_FILE, "Promoteur");
  const cashierPassword = readSecret(env.NAXA_STORAGE_E2E_EXPIRY_STOCK_PASSWORD_FILE, "Caisse/Stock");
  const clientPassword = readSecret(env.NAXA_STORAGE_E2E_CLIENT_PASSWORD_FILE, "Client");

  const apiTokens = [];
  let browser;
  let cashierUserId = null;
  let clientUserId = null;
  let promoterUserId = null;
  let cashierToken = null;
  let promoterToken = null;
  let saleId = null;
  let requestId = null;
  let creditId = null;
  let sessionId = null;
  let sessionClosed = false;
  let browserFailure = null;

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
      const detail = typeof data?.message === "string" ? data.message
        : typeof data?.hint === "string" ? data.hint : "requête refusée";
      throw new Error((options.label || path) + " : HTTP " + response.status + " — " + detail.slice(0, 240));
    }
    return data;
  }

  async function rows(path) {
    const result = await request("/rest/v1/" + path, { admin: true, label: "Contrôle Replay" });
    if (!Array.isArray(result)) throw new Error("Projection REST inattendue.");
    return result;
  }

  async function loginAuth(email, password, label) {
    const auth = await request("/auth/v1/token?grant_type=password", {
      method: "POST", body: { email, password }, label: "Connexion Auth " + label,
    });
    if (!auth?.access_token || !auth?.user?.id) throw new Error("Session Auth incomplète pour " + label + ".");
    apiTokens.push(auth.access_token);
    return { id: auth.user.id, token: auth.access_token };
  }

  async function rpc(name, token, args, label) {
    return request("/rest/v1/rpc/" + name, {
      method: "POST", token, body: args, label: label || name,
    });
  }

  async function ensureTreasuryAccount(channel) {
    const accountId = await rpc("caisse_credit_tresorerie_compte_creer", cashierToken, {
      p_pharmacie: PHARMACY_ID,
      p_canal: channel,
    }, "Configuration du compte trésorerie " + channel);
    if (typeof accountId !== "string") throw new Error("Compte trésorerie non confirmé pour " + channel + ".");
    return accountId;
  }

  async function pageLogin(page, username, password, espace, retour) {
    // Le middleware protège aussi /connexion par la déclaration d’âge.
    // Le compte est provisionné majeur ; on reproduit les deux marqueurs de cette déclaration
    // dans ce contexte de navigateur isolé, sans désactiver les contrôles applicatifs.
    await page.context().addCookies([{
      name: "naxa-age-status-v2",
      value: "adult",
      url: webBase + "/",
      sameSite: "Lax",
    }]);
    await page.addInitScript(() => {
      window.localStorage.setItem("naxa-age-declaration-v1", JSON.stringify({
        confirmed: true,
        at: Date.now(),
      }));
    });
    const response = await page.goto(webBase + "/connexion?espace=" + espace + "&retour=" + encodeURIComponent(retour), {
      waitUntil: "domcontentloaded",
    });
    try {
      await page.locator("#username").waitFor({ state: "visible", timeout: 30000 });
    } catch {
      const diagnostic = await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        body: document.body?.innerText?.slice(0, 500) || "",
      })).catch(() => ({ url: page.url(), title: "", body: "" }));
      throw new Error("Formulaire de connexion absent après contrôle d’âge (HTTP "
        + (response?.status() ?? "inconnu") + ", URL " + diagnostic.url
        + ", titre " + diagnostic.title + ", contenu " + diagnostic.body + ").");
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
      await page.waitForURL(url => url.pathname === retour, {
        timeout: 60000,
        waitUntil: "domcontentloaded",
      });
    } catch {
      const diagnostic = await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        body: document.body?.innerText?.slice(0, 500) || "",
      })).catch(() => ({ url: page.url(), title: "", body: "" }));
      throw new Error("API login acceptée mais destination absente (attendue " + retour
        + ", URL " + diagnostic.url + ", titre " + diagnostic.title
        + ", contenu " + diagnostic.body + ").");
    }
  }

  async function ensureSingle(rowsList, label) {
    if (rowsList.length !== 1) throw new Error(label + " : une ligne unique était attendue, reçu " + rowsList.length + ".");
    return rowsList[0];
  }

  async function recoverAndCloseSession() {
    if (!cashierToken || !cashierUserId) return;
    const openRows = await rows(
      "caisses_sessions?select=id,caisse_id,fond_initial,statut&ouvert_par=eq."
        + encodeURIComponent(cashierUserId) + "&statut=eq.ouverte&limit=3"
    ).catch(() => []);
    if (openRows.length === 0) return;
    if (openRows.length !== 1) throw new Error("Plusieurs sessions Caisse techniques sont ouvertes ; clôture automatique refusée.");
    const open = openRows[0];
    const drafts = await rows(
      "ventes?select=id,client_id&caisse_session_id=eq."
        + encodeURIComponent(open.id) + "&statut=eq.brouillon&limit=3"
    );
    let stockToRestore = 0;
    let stockBeforeRecovery = null;
    const finalizedDraftIds = new Set();
    for (const draft of drafts) {
      const decisions = await rows(
        "client_credit_requests?select=id,statut,consumed_at&vente_id=eq."
          + encodeURIComponent(draft.id) + "&limit=5"
      );
      const approved = decisions.find(item => item.statut === "approuvee" && item.consumed_at === null);
      if (approved) {
        const saleLines = await rows(
          "vente_lignes?select=produit_id,quantite&vente_id=eq." + encodeURIComponent(draft.id)
        );
        const restoreQuantity = saleLines
          .filter(line => line.produit_id === PRODUCT_ID)
          .reduce((sum, line) => sum + Number(line.quantite || 0), 0);
        if (restoreQuantity > 0) {
          if (stockBeforeRecovery === null) {
            const stockRows = await rows(
              "stocks?select=quantite&pharmacie_id=eq." + encodeURIComponent(PHARMACY_ID)
                + "&produit_id=eq." + encodeURIComponent(PRODUCT_ID) + "&limit=2"
            );
            const stock = await ensureSingle(stockRows, "Stock avant récupération Caisse");
            stockBeforeRecovery = Number(stock.quantite);
          }
        }
        const resumed = await rpc("vente_credit_finaliser", cashierToken, {
          p_vente: draft.id,
          p_reference: "NAXA-E2E-CREDIT-RECOVERY-" + crypto.randomUUID(),
        }, "Finalisation de récupération après approbation");
        const result = Array.isArray(resumed) ? resumed[0] : resumed;
        if (result?.resultat !== "finalisee") {
          throw new Error("Une demande approuvée ne peut pas être abandonnée ; reprise de la même vente impossible.");
        }
        stockToRestore += restoreQuantity;
        finalizedDraftIds.add(draft.id);
        continue;
      }

      for (const item of decisions.filter(item => item.statut === "en_attente")) {
        if (promoterToken) await rpc("client_credit_demande_decider", promoterToken, {
          p_demande: item.id, p_approuver: false,
        }, "Refus de la demande technique incomplète");
      }
      await rpc("vente_brouillon_abandonner", cashierToken, {
        p_vente: draft.id,
      }, "Abandon du panier incomplet");
    }

    // Le navigateur peut avoir finalisé la vente avant une erreur d'affichage
    // Client. Dans ce cas le brouillon a disparu : retrouver uniquement les
    // ventes crédit du Client, du Caissier et de la session E2E courante.
    const completedSales = await rows(
      "ventes?select=id,total_net,statut,mode_paiement,client_id,caisse_session_id,created_by"
        + "&caisse_session_id=eq." + encodeURIComponent(open.id)
        + "&created_by=eq." + encodeURIComponent(cashierUserId)
        + "&client_id=eq." + encodeURIComponent(clientUserId || "")
        + "&statut=eq.payee&mode_paiement=eq.credit&total_net=eq." + SALE_AMOUNT + "&limit=10"
    );
    for (const sale of completedSales) {
      if (finalizedDraftIds.has(sale.id)) continue;
      const decisions = await rows(
        "client_credit_requests?select=id,statut,consumed_at&vente_id=eq."
          + encodeURIComponent(sale.id) + "&limit=5"
      );
      if (!decisions.some(item => item.statut === "approuvee" && item.consumed_at !== null)) {
        throw new Error("Vente crédit de récupération sans demande Promoteur approuvée et consommée ; stock non modifié.");
      }
      const saleLines = await rows(
        "vente_lignes?select=produit_id,quantite&vente_id=eq." + encodeURIComponent(sale.id)
      );
      const restoreQuantity = saleLines
        .filter(line => line.produit_id === PRODUCT_ID)
        .reduce((sum, line) => sum + Number(line.quantite || 0), 0);
      if (restoreQuantity > 0) {
        if (stockBeforeRecovery === null) {
          const stockRows = await rows(
            "stocks?select=quantite&pharmacie_id=eq." + encodeURIComponent(PHARMACY_ID)
              + "&produit_id=eq." + encodeURIComponent(PRODUCT_ID) + "&limit=2"
          );
          stockBeforeRecovery = Number((await ensureSingle(stockRows, "Stock avant récupération vente finalisée")).quantite);
        }
        stockToRestore += restoreQuantity;
      }
    }

    if (!creditId && clientUserId) {
      const accounts = await rows(
        "client_credits?select=id,solde&client_id=eq." + encodeURIComponent(clientUserId)
          + "&pharmacie_id=eq." + encodeURIComponent(PHARMACY_ID) + "&limit=2"
      );
      if (accounts.length === 1) creditId = accounts[0].id;
    }
    if (creditId) {
      const credits = await rows("client_credits?select=solde&id=eq." + encodeURIComponent(creditId) + "&limit=1");
      const balance = Number(credits[0]?.solde ?? 0);
      if (balance > 0) {
        const treasuryAccountId = await ensureTreasuryAccount("especes");
        const recoveryReference = "NAXA-E2E-CREDIT-RECOVERY-" + crypto.randomUUID();
        await rpc("client_credit_rembourser", cashierToken, {
          p_credit: creditId,
          p_montant: balance,
          p_mode: "especes",
          p_reference: recoveryReference,
          p_motif: "Régularisation de la fixture technique non commerciale Replay",
          p_idempotency_key: crypto.randomUUID(),
          p_verification_beneficiaire: false,
          p_verification_montant: false,
          p_confirmation_client_vue: false,
        }, "Remboursement compensatoire de la fixture");
        const refundMovement = await rows(
          "tresorerie_mouvements?select=id,compte_id,nature,montant,source_type,canal_paiement,origine"
            + "&source_type=eq.credit_remboursement&canal_paiement=eq.especes&reference=eq."
            + encodeURIComponent(recoveryReference) + "&limit=2"
        );
        if (refundMovement.length !== 1 || refundMovement[0].compte_id !== treasuryAccountId
          || refundMovement[0].nature !== "encaissement" || Number(refundMovement[0].montant) !== balance
          || refundMovement[0].origine !== "comptoir") {
          throw new Error("Le mouvement trésorerie du remboursement compensatoire n'a pas été confirmé.");
        }
      }
    }
    const refunds = await rows(
      "client_credit_operations?select=montant&caisse_session_id=eq."
        + encodeURIComponent(open.id) + "&nature=eq.remboursement&mode_paiement=eq.especes"
    );
    const refundTotal = refunds.reduce((sum, item) => sum + Number(item.montant || 0), 0);
    const close = await rpc("caisse_cloturer", cashierToken, {
      p_session: open.id, p_total_compte: Number(open.fond_initial || 0) + refundTotal,
    }, "Clôture de récupération du poste Caisse");
    const result = Array.isArray(close) ? close[0] : close;
    if (!result || Number(result.ecart) !== 0) throw new Error("La session Caisse de récupération n'a pas été rapprochée à zéro.");

    // Une vente approuvée récupérée est finalisée par le RPC métier et a donc
    // légitimement consommé son stock. Restaurer uniquement cette quantité de
    // fixture, via le RPC Gestionnaire Stock audité, pour laisser le prochain
    // scénario POS repartir exactement de son stock initial.
    if (stockToRestore > 0) {
      if (Number(stockBeforeRecovery) + stockToRestore !== 4) {
        throw new Error("La récupération ne correspond pas exactement au stock initial de quatre unités ; restitution bloquée.");
      }
      const selectedStockRole = await rpc("naxa_select_active_role", cashierToken, {
        p_role_code: "gestionnaire_stock", p_pharmacie_id: PHARMACY_ID,
      }, "Activation du rôle Gestionnaire Stock pour la restitution de fixture");
      if (selectedStockRole !== true
        || await rpc("naxa_business_function", cashierToken, {}, "Vérification rôle Gestionnaire Stock") !== "gestionnaire_stock") {
        throw new Error("Le rôle Gestionnaire Stock n'a pas été activé pour restituer le stock de fixture.");
      }
      try {
        const restored = await rpc("gestionnaire_stock_quantite_ajuster", cashierToken, {
          p_pharmacie: PHARMACY_ID,
          p_produit: PRODUCT_ID,
          p_delta: stockToRestore,
          p_type: "retour",
          p_motif: "Restitution contrôlée du stock après récupération d'une recette POS interrompue",
          p_lot: null,
        }, "Restitution du stock de recette après récupération");
        if (restored !== true) throw new Error("La restitution du stock de recette n'a pas été confirmée.");
        const finalStock = await rows(
          "stocks?select=quantite&pharmacie_id=eq." + encodeURIComponent(PHARMACY_ID)
            + "&produit_id=eq." + encodeURIComponent(PRODUCT_ID) + "&limit=2"
        );
        const quantity = Number((await ensureSingle(finalStock, "Stock après récupération Caisse")).quantite);
        if (quantity !== 4) {
          throw new Error("Le stock de recette n'est pas revenu à la quantité cible quatre après récupération.");
        }
      } finally {
        const selectedCashierRole = await rpc("naxa_select_active_role", cashierToken, {
          p_role_code: "caisse", p_pharmacie_id: PHARMACY_ID,
        }, "Retour au rôle Caisse après restitution du stock");
        if (selectedCashierRole !== true
          || await rpc("naxa_business_function", cashierToken, {}, "Vérification du retour au rôle Caisse") !== "caisse") {
          throw new Error("Le compte de recette n'a pas retrouvé son rôle Caisse après restitution.");
        }
      }
    }
  }

  try {
    const [promoter, cashier, client] = await Promise.all([
      loginAuth(PROMOTER_EMAIL, promoterPassword, "Promoteur"),
      loginAuth(CASHIER_EMAIL, cashierPassword, "Caisse/Stock"),
      loginAuth(CLIENT_EMAIL, clientPassword, "Client"),
    ]);
    promoterToken = promoter.token;
    cashierToken = cashier.token;
    promoterUserId = promoter.id;
    cashierUserId = cashier.id;
    clientUserId = client.id;

    const pharmacy = await ensureSingle(await rows(
      "pharmacies?select=id,actif,archivee_le,visible_recherche,est_demo&id=eq."
        + encodeURIComponent(PHARMACY_ID) + "&limit=2"
    ), "Pharmacie crédit Replay");
    if (pharmacy.actif !== true || pharmacy.archivee_le !== null
      || pharmacy.visible_recherche !== false || pharmacy.est_demo !== false) {
      throw new Error("La pharmacie de recette n'est plus masquée ou non commerciale.");
    }
    const product = await ensureSingle(await rows(
      "stocks?select=pharmacie_id,produit_id,prix,quantite&pharmacie_id=eq."
        + encodeURIComponent(PHARMACY_ID) + "&produit_id=eq."
        + encodeURIComponent(PRODUCT_ID) + "&limit=2"
    ), "Référence produit crédit");
    if (Number(product.prix) !== 1000 || Number(product.quantite) < 1) {
      throw new Error("Le stock technique doit contenir au moins une unité à 1 000 FCFA.");
    }

    const selectedPromoterRole = await rpc("naxa_select_active_role", promoterToken, {
      p_role_code: "promoteur", p_pharmacie_id: null,
    }, "Sélection du rôle Promoteur");
    if (selectedPromoterRole !== true) throw new Error("Le Promoteur n'a pas pu activer son rôle métier.");
    const selectedCashierRole = await rpc("naxa_select_active_role", cashierToken, {
      p_role_code: "caisse", p_pharmacie_id: PHARMACY_ID,
    }, "Sélection du rôle Caisse sur pharmacie masquée");
    if (selectedCashierRole !== true) throw new Error("La Caisse n'a pas pu activer son rôle sur la pharmacie masquée.");
    const cashierBusinessFunction = await rpc("naxa_business_function", cashierToken, {}, "Vérification du rôle métier Caisse");
    const cashierActivePharmacy = await rpc("naxa_active_role_pharmacy", cashierToken, {}, "Vérification de la pharmacie active Caisse");
    if (cashierBusinessFunction !== "caisse" || cashierActivePharmacy !== PHARMACY_ID) {
      throw new Error("Le contexte Caisse actif ne correspond pas à la pharmacie technique masquée.");
    }

    const existingSessions = await rows(
      "caisses_sessions?select=id&ouvert_par=eq." + encodeURIComponent(cashierUserId)
        + "&statut=eq.ouverte&limit=2"
    );
    if (existingSessions.length) {
      await recoverAndCloseSession();
    }
    const existingDrafts = await rows(
      "ventes?select=id&created_by=eq." + encodeURIComponent(cashierUserId)
        + "&pharmacie_id=eq." + encodeURIComponent(PHARMACY_ID)
        + "&statut=eq.brouillon&limit=2"
    );
    if (existingDrafts.length) throw new Error("Un brouillon non réconcilié subsiste avant le début de la recette.");

    const staleRequests = await rows(
      "client_credit_requests?select=id,statut,consumed_at&client_id=eq."
        + encodeURIComponent(clientUserId) + "&pharmacie_id=eq."
        + encodeURIComponent(PHARMACY_ID)
        + "&statut=in.(en_attente,approuvee)&consumed_at=is.null&limit=5"
    );
    if (staleRequests.length) {
      throw new Error("Une demande de crédit technique non résolue subsiste ; récupération Caisse nécessaire avant une nouvelle recette.");
    }

    const accountRows = await rows(
      "client_credits?select=id,solde&client_id=eq." + encodeURIComponent(clientUserId)
        + "&pharmacie_id=eq." + encodeURIComponent(PHARMACY_ID) + "&limit=2"
    );
    if (accountRows.length > 1 || (accountRows.length === 1 && Number(accountRows[0].solde) !== 0)) {
      throw new Error("Le compte crédit technique doit être absent ou à solde nul avant cette recette.");
    }

    browser = await chromium.launch({ headless: true });
    const promoterContext = await browser.newContext();
    const promoterPage = await promoterContext.newPage();
    promoterPage.setDefaultTimeout(30000);
    await pageLogin(promoterPage, PROMOTER_USERNAME, promoterPassword, "pharmacie", "/pharmacie/promoteur/credits");
    await promoterPage.getByRole("heading", { name: /Crédits clients/ }).waitFor();

    const creditForm = promoterPage.locator("form").filter({
      has: promoterPage.locator('input[name="client_id"]'),
    }).first();
    await creditForm.locator('select[name="pharmacie_id"]').selectOption(PHARMACY_ID);
    await creditForm.locator('input[name="client_id"]').fill(clientUserId);
    await creditForm.locator('input[name="plafond"]').fill(String(CREDIT_LIMIT));
    await creditForm.getByRole("button", { name: "Enregistrer le plafond de crédit" }).click();
    await promoterPage.waitForURL(url => url.searchParams.get("ok") === "configuration", { timeout: 30000 });

    const cashierContext = await browser.newContext();
    const cashierPage = await cashierContext.newPage();
    cashierPage.setDefaultTimeout(30000);
    await pageLogin(cashierPage, CASHIER_USERNAME, cashierPassword, "pharmacie", "/pharmacie/caisse");
    await cashierPage.getByRole("heading", { name: "Poste de caisse" }).waitFor();

    const openSessionButton = cashierPage.getByRole("button", { name: "Ouvrir la session", exact: true });
    if (await openSessionButton.count()) {
      const fund = cashierPage.locator('input[type="number"]').first();
      await fund.fill("0");
      await openSessionButton.click();
    }
    await cashierPage.getByText("Session ouverte", { exact: true }).waitFor();
    const sessionRows = await rows(
      "caisses_sessions?select=id,caisse_id,ouvert_par,statut,fond_initial&ouvert_par=eq."
        + encodeURIComponent(cashierUserId) + "&statut=eq.ouverte&limit=2"
    );
    const session = await ensureSingle(sessionRows, "Session de caisse ouverte");
    sessionId = session.id;

    const clientSelect = cashierPage.locator("label").filter({
      hasText: "Client (facultatif pour une vente comptant)",
    }).locator("select");
    await clientSelect.waitFor();
    await clientSelect.selectOption(clientUserId);
    await cashierPage.getByRole("button", { name: "Nouvelle vente", exact: true }).click();
    await cashierPage.getByText("Nouvelle vente créée.", { exact: false }).waitFor();

    const productSearch = cashierPage.locator('input[placeholder="Nom, référence ou code-barres"]');
    await productSearch.fill(PRODUCT_NAME);
    await cashierPage.getByRole("button", { name: "Rechercher", exact: true }).click();
    const productButton = cashierPage.locator("button").filter({ hasText: PRODUCT_NAME }).first();
    await productButton.waitFor();
    const statusNotice = cashierPage.locator('[aria-live="polite"]');
    const priorNotice = await statusNotice.textContent().catch(() => "");
    await productButton.click();
    const productRow = cashierPage.getByRole("row").filter({ hasText: PRODUCT_NAME });
    try {
      await productRow.waitFor({ state: "visible", timeout: 15000 });
    } catch {
      await cashierPage.waitForFunction((previous) => {
        const node = document.querySelector('[aria-live="polite"]');
        return Boolean(node && node.textContent?.trim() && node.textContent.trim() !== previous);
      }, priorNotice, { timeout: 10000 }).catch(() => null);
      const notice = (await statusNotice.textContent().catch(() => ""))?.trim();
      throw new Error("Ajout du produit refusé ou non confirmé par le panier Caisse ; message métier : "
        + String(notice || "aucun message de résultat affiché").slice(0, 300));
    }

    await cashierPage.getByRole("button", { name: "Finaliser la vente à crédit", exact: true }).click();
    await cashierPage.getByText(/Dépassement du plafond/).waitFor();

    const draftRows = await rows(
      "ventes?select=id,total_net,statut,mode_paiement,client_id,caisse_session_id,created_by"
        + "&caisse_session_id=eq." + encodeURIComponent(sessionId)
        + "&created_by=eq." + encodeURIComponent(cashierUserId)
        + "&statut=eq.brouillon&order=created_at.desc&limit=2"
    );
    const draft = await ensureSingle(draftRows, "Brouillon à crédit");
    saleId = draft.id;
    if (Number(draft.total_net) !== SALE_AMOUNT || draft.client_id !== clientUserId) {
      throw new Error("Le brouillon ne correspond pas au panier Client attendu de 1 000 FCFA.");
    }
    const pendingRows = await rows(
      "client_credit_requests?select=id,montant,statut,origine,vente_id&vente_id=eq."
        + encodeURIComponent(saleId) + "&limit=2"
    );
    const pending = await ensureSingle(pendingRows, "Demande de dépassement crédit");
    requestId = pending.id;
    if (pending.statut !== "en_attente" || pending.origine !== "caisse"
      || Number(pending.montant) !== SALE_AMOUNT) {
      throw new Error("La demande de dépassement ne respecte pas le contrat du crédit comptoir.");
    }
    const stockBeforeApproval = await rows(
      "stocks?select=quantite&pharmacie_id=eq." + encodeURIComponent(PHARMACY_ID)
        + "&produit_id=eq." + encodeURIComponent(PRODUCT_ID) + "&limit=1"
    );
    if (Number(stockBeforeApproval[0]?.quantite) !== 4) {
      throw new Error("Le stock physique a été modifié avant la décision Promoteur.");
    }
    const prePayment = await rows(
      "vente_paiements?select=id&vente_id=eq." + encodeURIComponent(saleId) + "&limit=1"
    );
    if (prePayment.length) throw new Error("Un paiement POS a été créé avant l'approbation du crédit.");

    await promoterPage.reload();
    const requestCard = promoterPage.locator("article").filter({ hasText: saleId });
    await requestCard.getByRole("button", { name: "Approuver le crédit comptoir", exact: true }).click();
    await promoterPage.waitForURL(url => url.searchParams.get("ok") === "approuvee", { timeout: 30000 });

    const approvedRows = await rows(
      "client_credit_requests?select=id,statut,origine,vente_id&id=eq."
        + encodeURIComponent(requestId) + "&limit=1"
    );
    if (approvedRows.length !== 1 || approvedRows[0].statut !== "approuvee") {
      throw new Error("La décision Promoteur n'a pas approuvé la demande comptoir.");
    }
    const stockAfterApproval = await rows(
      "stocks?select=quantite&pharmacie_id=eq." + encodeURIComponent(PHARMACY_ID)
        + "&produit_id=eq." + encodeURIComponent(PRODUCT_ID) + "&limit=1"
    );
    if (Number(stockAfterApproval[0]?.quantite) !== 4) {
      throw new Error("L'approbation du crédit comptoir a déplacé le stock avant la reprise POS.");
    }

    await cashierPage.reload();
    const finalizationButton = cashierPage.getByRole("button", { name: "Finaliser la vente à crédit", exact: true });
    await finalizationButton.waitFor({ state: "visible" });
    await finalizationButton.click();
    try {
      await cashierPage.getByText(/Vente à crédit finalisée/).waitFor({ timeout: 30000 });
    } catch {
      const notice = (await cashierPage.locator('[aria-live="polite"]').textContent().catch(() => ""))?.trim();
      const state = await rows(
        "ventes?select=statut,total_net,mode_paiement&id=eq."
          + encodeURIComponent(saleId) + "&limit=1"
      ).catch(() => []);
      throw new Error("Finalisation POS refusée après approbation Promoteur ; message Caisse : "
        + String(notice || "aucun message métier affiché").slice(0, 260)
        + " ; état vente : " + JSON.stringify(state[0] || null));
    }

    const paidRows = await rows(
      "ventes?select=id,total_net,statut,mode_paiement,client_id,caisse_session_id"
        + "&id=eq." + encodeURIComponent(saleId) + "&limit=1"
    );
    const paid = await ensureSingle(paidRows, "Vente à crédit finalisée");
    if (paid.statut !== "payee" || paid.mode_paiement !== "credit"
      || paid.client_id !== clientUserId || paid.caisse_session_id !== sessionId) {
      throw new Error("La vente POS à crédit n'a pas été finalisée dans la session attendue.");
    }
    const paymentRows = await rows(
      "vente_paiements?select=mode,montant,monnaie_rendue&vente_id=eq."
        + encodeURIComponent(saleId) + "&limit=2"
    );
    if (paymentRows.length !== 1 || paymentRows[0].mode !== "credit"
      || Number(paymentRows[0].montant) !== SALE_AMOUNT) {
      throw new Error("Le paiement POS de crédit n'est pas enregistré comme crédit.");
    }
    const stockAfterSale = await rows(
      "stocks?select=quantite&pharmacie_id=eq." + encodeURIComponent(PHARMACY_ID)
        + "&produit_id=eq." + encodeURIComponent(PRODUCT_ID) + "&limit=1"
    );
    if (Number(stockAfterSale[0]?.quantite) !== 3) {
      throw new Error("Le stock doit être diminué une seule fois après la finalisation POS.");
    }

    const account = await ensureSingle(await rows(
      "client_credits?select=id,solde,plafond&client_id=eq." + encodeURIComponent(clientUserId)
        + "&pharmacie_id=eq." + encodeURIComponent(PHARMACY_ID) + "&limit=2"
    ), "Compte crédit du Client");
    creditId = account.id;
    if (Number(account.solde) !== SALE_AMOUNT || Number(account.plafond) !== CREDIT_LIMIT) {
      throw new Error("Le solde ou le plafond du compte Client ne correspond pas à la vente approuvée.");
    }
    const creditOps = await rows(
      "client_credit_operations?select=id,nature,montant,caisse_session_id,mode_paiement,created_by,vente_id"
        + "&vente_id=eq." + encodeURIComponent(saleId) + "&nature=eq.credit&limit=2"
    );
    const creditOp = await ensureSingle(creditOps, "Opération d'octroi POS");
    if (Number(creditOp.montant) !== SALE_AMOUNT || creditOp.caisse_session_id !== sessionId
      || creditOp.created_by !== cashierUserId) {
      throw new Error("L'opération d'octroi n'est pas liée à la session et au titulaire Caisse.");
    }

    const clientContext = await browser.newContext();
    const clientPage = await clientContext.newPage();
    clientPage.setDefaultTimeout(30000);
    await pageLogin(clientPage, CLIENT_USERNAME, clientPassword, "client", "/achats/credit/suivi");
    await clientPage.getByRole("heading", { name: "Mes crédits et remboursements" }).waitFor();
    await clientPage.getByText("Achat à crédit", { exact: false }).first().waitFor();

    const refundPlans = [
      { channel: "especes", amount: 100, reference: "NAXA-E2E-CREDIT-BROWSER-CASH-" + crypto.randomUUID() },
      { channel: "orange_money", amount: 300, reference: "NAXA-E2E-CREDIT-BROWSER-ORANGE-" + crypto.randomUUID() },
      { channel: "mtn_momo", amount: 600, reference: "NAXA-E2E-CREDIT-BROWSER-MTN-" + crypto.randomUUID() },
    ];
    const treasuryAccountByChannel = {};
    for (const plan of refundPlans) {
      treasuryAccountByChannel[plan.channel] = await ensureTreasuryAccount(plan.channel);
    }
    const mappedTreasuryAccounts = await rpc("caisse_credit_tresorerie_comptes_lister", cashierToken, {
      p_pharmacie: PHARMACY_ID,
    }, "Vérification des comptes trésorerie Caisse");
    if (!Array.isArray(mappedTreasuryAccounts) || refundPlans.some(plan =>
      !mappedTreasuryAccounts.some(row => row.canal_paiement === plan.channel
        && row.account_id === treasuryAccountByChannel[plan.channel]))) {
      throw new Error("Les trois comptes de trésorerie ne sont pas visibles depuis le rôle Caisse.");
    }

    await cashierPage.reload();
    await cashierPage.getByRole("heading", { name: "Poste de caisse" }).waitFor();
    await cashierPage.getByText("Session ouverte", { exact: true }).waitFor();
    const refundSection = cashierPage.locator("#caisse-remboursements-credit");
    await refundSection.getByRole("heading", { name: "Remboursement des crédits clients", exact: true }).waitFor();

    // Les comptes sont créés par la RPC officielle avant le rendu du formulaire.
    // Forcer ensuite leur chargement via la même action visible qu'un caissier
    // utilise lorsqu'un canal n'est pas encore affiché, puis attendre la sélection
    // effective : la seule présence des comptes en base ne suffit pas.
    for (const channel of refundPlans) {
      const channelLabel = channel.channel === "especes" ? "Espèces"
        : channel.channel === "orange_money" ? "Orange Money" : "MTN MoMo";
      const channelLabelLocator = refundSection.locator("label").filter({ hasText: channelLabel }).first();
      const channelSelect = channelLabelLocator.locator("select");
      await channelSelect.waitFor({ state: "visible" });
      if (!(await channelSelect.inputValue())) {
        const channelRow = channelLabelLocator.locator("xpath=..");
        const createAccountButton = channelRow.getByRole("button", { name: "Créer compte à 0 FCFA", exact: true });
        await createAccountButton.waitFor({ state: "visible" });
        await createAccountButton.click();
      }
      await cashierPage.waitForFunction((label) => {
        const section = document.querySelector("#caisse-remboursements-credit");
        if (!section) return false;
        const field = [...section.querySelectorAll("label")]
          .find(item => (item.textContent || "").trim().startsWith(label));
        const select = field?.querySelector("select");
        return Boolean(select && select.value);
      }, channelLabel, { timeout: 30000 });
    }

    const refundClientSelect = refundSection.locator("label").filter({
      hasText: "Client et compte crédit",
    }).locator("select");
    await refundClientSelect.waitFor({ state: "visible" });
    await refundClientSelect.selectOption(creditId);
    const refundChannelSelect = refundSection.locator("label").filter({
      hasText: "Canal du remboursement",
    }).locator("select");
    const refundAmountInput = refundSection.locator("label").filter({
      hasText: "Montant remboursé (FCFA)",
    }).locator("input");
    const refundReferenceInput = refundSection.locator("label").filter({
      hasText: "Référence de transaction",
    }).locator("input");
    const refundSubmit = refundSection.getByRole("button", { name: "Confirmer le remboursement", exact: true });

    for (const plan of refundPlans) {
      await refundChannelSelect.selectOption(plan.channel);
      await refundAmountInput.fill(String(plan.amount));
      await refundReferenceInput.fill(plan.reference);
      if (plan.channel !== "especes") {
        const confirmations = refundSection.locator('input[type="checkbox"]');
        await confirmations.first().waitFor({ state: "visible" });
        if (await confirmations.count() !== 3) {
          throw new Error("Les trois confirmations visuelles obligatoires ne sont pas affichées pour " + plan.channel + ".");
        }
        for (let i = 0; i < 3; i += 1) await confirmations.nth(i).check();
      }

      try {
        await cashierPage.waitForFunction(() => {
          const button = document.querySelector('#caisse-credit-refund-submit');
          return Boolean(button && !button.disabled);
        }, null, { timeout: 20000 });
      } catch {
        const formState = await refundSection.evaluate(section => ({
          selects: [...section.querySelectorAll("select")].map(item => ({
            value: item.value,
            options: [...item.options].map(option => ({ value: option.value, text: option.textContent })),
          })),
          inputs: [...section.querySelectorAll("input")].map(item => ({
            type: item.type,
            value: item.type === "checkbox" ? item.checked : item.value,
          })),
          notice: document.querySelector('[aria-live="polite"]')?.textContent || "",
        }));
        throw new Error("Le bouton de remboursement reste désactivé pour " + plan.channel + " : " + JSON.stringify(formState));
      }

      await refundSubmit.click();
      const refundTicket = cashierPage.locator("#refund-ticket");
      await refundTicket.getByRole("heading", { name: "NAXA · Reçu de remboursement crédit", exact: true }).waitFor();
      const receiptText = (await refundTicket.textContent()) || "";
      const expectedChannelLabel = plan.channel === "especes" ? "Espèces"
        : plan.channel === "orange_money" ? "Orange Money" : "MTN MoMo";
      if (!receiptText.includes(plan.reference) || !receiptText.includes(expectedChannelLabel)
        || !receiptText.includes("Origine")) {
        throw new Error("Le reçu " + plan.channel + " ne contient pas la référence, le canal et l'origine comptoir.");
      }

      const refundOps = await rows(
        "client_credit_operations?select=id,nature,montant,mode_paiement,caisse_session_id,created_by,reference,verification_beneficiaire,verification_montant,confirmation_client_vue,verification_effectuee_par,verification_effectuee_at"
          + "&reference=eq." + encodeURIComponent(plan.reference) + "&limit=2"
      );
      const refundOp = await ensureSingle(refundOps, "Opération de remboursement " + plan.channel + " créée par l'interface Caisse");
      if (refundOp.nature !== "remboursement" || Number(refundOp.montant) !== plan.amount
        || refundOp.mode_paiement !== plan.channel || refundOp.caisse_session_id !== sessionId
        || refundOp.created_by !== cashierUserId || refundOp.reference !== plan.reference) {
        throw new Error("Le remboursement " + plan.channel + " n'est pas lié au caissier/session attendus.");
      }
      if (plan.channel !== "especes" && (refundOp.verification_beneficiaire !== true
        || refundOp.verification_montant !== true || refundOp.confirmation_client_vue !== true
        || refundOp.verification_effectuee_par !== cashierUserId || !refundOp.verification_effectuee_at)) {
        throw new Error("Les trois preuves visuelles du remboursement " + plan.channel + " ne sont pas persistées.");
      }

      const movementRows = await rows(
        "tresorerie_mouvements?select=id,compte_id,nature,montant,source_type,source_id,canal_paiement,origine"
          + "&source_type=eq.credit_remboursement&source_id=eq." + encodeURIComponent(refundOp.id) + "&limit=2"
      );
      const movement = await ensureSingle(movementRows, "Mouvement trésorerie " + plan.channel);
      if (movement.compte_id !== treasuryAccountByChannel[plan.channel] || movement.nature !== "encaissement"
        || Number(movement.montant) !== plan.amount || movement.canal_paiement !== plan.channel
        || movement.origine !== "comptoir") {
        throw new Error("Le mouvement trésorerie " + plan.channel + " est absent ou incorrect.");
      }

      const events = await rows(
        "compta_evenement?select=id,evenement_type,source_type,source_id,donnees"
          + "&source_type=eq.credit_operation&source_id=eq." + encodeURIComponent(refundOp.id)
          + "&evenement_type=eq.credit_remboursement&limit=2"
      );
      if (events.length !== 1 || events[0].donnees?.montant_fcfa !== String(plan.amount)) {
        throw new Error("L'outbox du remboursement " + plan.channel + " n'est pas unique ou conforme.");
      }

      await refundTicket.getByRole("button", { name: "Fermer", exact: true }).click();
      await refundTicket.waitFor({ state: "detached" });
    }

    const accountAfterRefund = await rows(
      "client_credits?select=solde&id=eq." + encodeURIComponent(creditId) + "&limit=1"
    );
    if (Number(accountAfterRefund[0]?.solde) !== 0) throw new Error("Le solde Client n'est pas revenu à zéro après remboursement complet.");

    const refundSessionRows = await rows(
      "client_credit_operations?select=montant,mode_paiement&caisse_session_id=eq."
        + encodeURIComponent(sessionId) + "&nature=eq.remboursement"
    );
    const allRefundTotal = refundSessionRows.reduce((sum, row) => sum + Number(row.montant || 0), 0);
    const cashDrawerTotal = refundSessionRows
      .filter(row => row.mode_paiement === "especes")
      .reduce((sum, row) => sum + Number(row.montant || 0), 0);
    if (allRefundTotal !== 1000 || cashDrawerTotal !== 100) {
      throw new Error("La session doit rapprocher 1 000 FCFA, dont 100 FCFA au tiroir espèces.");
    }
    const closeRows = await rpc("caisse_cloturer", cashierToken, {
      p_session: sessionId, p_total_compte: cashDrawerTotal,
    }, "Clôture de la session Caisse après remboursement multicanal");
    const closed = Array.isArray(closeRows) ? closeRows[0] : closeRows;
    if (!closed || Number(closed.total_theorique) !== cashDrawerTotal
      || Number(closed.total_compte) !== cashDrawerTotal || Number(closed.ecart) !== 0) {
      throw new Error("Le rapprochement Caisse espèces n'est pas à zéro après séparation des canaux.");
    }
    sessionClosed = true;

    await clientPage.reload();
    await clientPage.getByRole("heading", { name: "Mes crédits et remboursements" }).waitFor();
    const refundReceiptHeading = clientPage.getByRole("heading", {
      name: "Mes reçus de remboursement",
      exact: true,
    });
    if (await refundReceiptHeading.count() !== 1) {
      throw new Error("Le reçu de remboursement doit présenter un titre unique dans le suivi Client.");
    }
    await refundReceiptHeading.waitFor({ state: "visible" });
    await clientPage.getByText("0 FCFA", { exact: false }).first().waitFor();
    for (const plan of refundPlans) {
      const expectedChannelLabel = plan.channel === "especes" ? "Espèces"
        : plan.channel === "orange_money" ? "Orange Money" : "MTN MoMo";
      const receipt = clientPage.locator(".credit-repayment-receipt").filter({ hasText: plan.reference });
      if (await receipt.count() !== 1) {
        throw new Error("Le reçu Client du remboursement " + plan.channel + " est absent ou dupliqué.");
      }
      await receipt.getByText(expectedChannelLabel, { exact: true }).waitFor({ state: "visible" });
      await receipt.getByRole("heading", {
        name: Number(plan.amount).toLocaleString("fr-FR") + " FCFA reçus", exact: true,
      }).waitFor({ state: "visible" });
    }

    process.stdout.write("PASS — Client acheteur, Promoteur, Caisse/Stock authentifiés dans le navigateur NAXA.\n");
    process.stdout.write("PASS — le panier au-dessus du plafond crée une demande Caisse sans paiement ni débit de stock.\n");
    process.stdout.write("PASS — le Promoteur approuve la demande ; le même brouillon reprend et débite le stock une seule fois.\n");
    process.stdout.write("PASS — suivi Client, opération d'octroi et remboursement réel via JWT Caisse ; solde revenu à zéro.\n");
    process.stdout.write("PASS — outbox remboursement et clôture Caisse rapprochée sans écart ; session fermée.\n");
    process.stdout.write("INFO — vente, opérations et outbox restent auditées dans la pharmacie technique masquée non commerciale ; aucun produit/offre public n'est créé.\n");
  } catch (error) {
    browserFailure = error;
  } finally {
    if (!sessionClosed && cashierToken && cashierUserId) {
      try {
        await recoverAndCloseSession();
      } catch (error) {
        if (browserFailure) process.stderr.write("RECUPERATION SESSION Caisse — " + error.message + "\n");
        else browserFailure = error;
      }
    }
    if (browser) await browser.close().catch(() => null);
    for (const token of [...new Set(apiTokens)].reverse()) {
      await request("/auth/v1/logout?scope=local", {
        method: "POST", token, label: "Fermeture session API E2E",
      }).catch(() => null);
    }
  }

  if (browserFailure) throw browserFailure;
  return true;
}

if (require.main === module) {
  run().catch(error => {
    process.stderr.write("CRÉDIT POS NAVIGATEUR E2E BLOQUÉ — " + (error?.message || "erreur inconnue") + "\n");
    process.exitCode = 1;
  });
}

module.exports = { assertReplayUrl, run, PHARMACY_ID, PRODUCT_NAME };
