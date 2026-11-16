#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { chromium } = require("playwright");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const PHARMACY_ID = "1a4f1ce5-cccf-477e-9a5b-474c8c9fc713";
const PROMOTER_EMAIL = "naxa.e2e.promoteur@example.invalid";
const PROMOTER_USERNAME = "naxa_e2e_promoteur";

function required(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error("Configuration absente : " + label + ".");
  return text;
}
function readSecret(file) {
  const target = required(file, "mot de passe Promoteur");
  if (!fs.existsSync(target)) throw new Error("Fichier de mot de passe Promoteur absent.");
  return fs.readFileSync(target, "utf8");
}
function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (url.protocol !== "https:" || url.hostname !== PROJECT_REF + ".supabase.co"
    || !["", "/"].includes(url.pathname)) {
    throw new Error("Sécurité : recette comptable limitée au projet Replay.");
  }
  return url.origin;
}
function localDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const item = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return item.year + "-" + item.month + "-" + item.day;
}

async function run(env = process.env) {
  const supabaseUrl = assertReplayUrl(env.NAXA_STORAGE_E2E_URL || env.SUPABASE_URL);
  const anonKey = required(env.NAXA_STORAGE_E2E_ANON_KEY, "clé anonyme Replay");
  const adminKey = required(env.NAXA_STORAGE_E2E_ADMIN_KEY, "clé Admin Replay");
  const webBase = String(env.NAXA_E2E_WEB_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const promoterPasswordFile = required(env.NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD_FILE, "fichier secret Promoteur");
  const promoterPassword = readSecret(promoterPasswordFile);
  const runSuffix = String(env.GITHUB_RUN_ID || Date.now()).replace(/\D/g, "").slice(-7)
    + String(env.GITHUB_RUN_ATTEMPT || "1").replace(/\D/g, "").slice(-1);
  const debitCode = "E2E" + runSuffix + "D";
  const creditCode = "E2E" + runSuffix + "C";
  const journalCode = "E2E" + runSuffix;
  const today = localDate();
  let browser = null;
  let promoterToken = null;
  let pharmacyId = PHARMACY_ID;
  let promoterId = null;
  let initialAccountIds = new Set();
  let initialMappingIds = new Set();
  let initialParamIds = new Set();
  let primaryError = null;
  const apiTokens = [];

  async function request(path, options = {}) {
    const admin = options.admin === true;
    const headers = { apikey: admin ? adminKey : anonKey, "Content-Type": "application/json" };
    if (options.token) headers.Authorization = "Bearer " + options.token;
    else if (admin && !adminKey.startsWith("sb_secret_")) headers.Authorization = "Bearer " + adminKey;
    else if (!admin && !anonKey.startsWith("sb_publishable_")) headers.Authorization = "Bearer " + anonKey;
    if (options.prefer) headers.Prefer = options.prefer;
    const response = await fetch(supabaseUrl + path, {
      method: options.method || "GET", headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!response.ok) {
      const detail = typeof data?.message === "string" ? data.message : String(raw || "requête refusée");
      throw new Error((options.label || path) + " : HTTP " + response.status + " — " + detail.slice(0, 280));
    }
    return data;
  }
  async function rows(path) {
    const result = await request("/rest/v1/" + path, { admin: true, label: "Lecture de contrôle comptable Replay" });
    if (!Array.isArray(result)) throw new Error("Réponse REST invalide pour " + path);
    return result;
  }
  async function rpc(name, token, args) {
    return request("/rest/v1/rpc/" + name, { method: "POST", token, body: args, label: "RPC " + name });
  }
  async function login(email, password) {
    const data = await request("/auth/v1/token?grant_type=password", {
      method: "POST", body: { email, password }, label: "Connexion Promoteur",
    });
    if (!data?.access_token || !data?.user?.id) throw new Error("Session Promoteur absente.");
    apiTokens.push(data.access_token);
    return { id: data.user.id, token: data.access_token };
  }
  async function pageLogin(page) {
    await page.context().addCookies([{
      name: "naxa-age-status-v2", value: "adult", url: webBase + "/", sameSite: "Lax",
    }]);
    await page.addInitScript(() => {
      window.localStorage.setItem("naxa-age-declaration-v1", JSON.stringify({ confirmed: true, at: Date.now() }));
    });
    const response = await page.goto(webBase + "/connexion?espace=pharmacie&retour="
      + encodeURIComponent("/pharmacie/comptabilite/plan"), { waitUntil: "domcontentloaded" });
    await page.locator("#username").waitFor({ state: "visible", timeout: 30000 }).catch(async () => {
      const url = page.url();
      const body = await page.locator("body").innerText().catch(() => "");
      throw new Error("Écran de connexion absent (HTTP " + (response?.status() ?? "?")
        + ", URL " + url + ", " + body.slice(0, 400) + ").");
    });
    await page.locator("#username").fill(PROMOTER_USERNAME);
    await page.locator("#password").fill(promoterPassword);
    const loginResponsePromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/auth/login"
        && response.request().method() === "POST",
    { timeout: 60000 });
    await page.getByRole("button", { name: "Connexion", exact: true }).click();
    const loginResponse = await loginResponsePromise;
    let loginPayload = null;
    try { loginPayload = await loginResponse.json(); } catch { /* diagnostic HTTP conservé */ }
    if (!loginResponse.ok()) {
      throw new Error("API login Promoteur refusée (HTTP " + loginResponse.status() + ") : "
        + String(loginPayload?.error || loginPayload?.message || "réponse sans détail").slice(0, 240));
    }
    try {
      await page.waitForURL(url => url.pathname === "/pharmacie/comptabilite/plan", {
        timeout: 60000, waitUntil: "domcontentloaded",
      });
    } catch {
      const diagnostic = await page.evaluate(() => ({
        url: window.location.href, title: document.title,
        body: document.body?.innerText?.slice(0, 500) || "",
      })).catch(() => ({ url: page.url(), title: "", body: "" }));
      throw new Error("API login Promoteur acceptée mais destination comptable absente (URL "
        + diagnostic.url + ", titre " + diagnostic.title + ", contenu " + diagnostic.body + ").");
    }
  }

  async function cleanupCreatedRows() {
    const accountRows = await rows("compta_plan_comptable?select=id,code,pharmacie_id&pharmacie_id=eq." + pharmacyId);
    const newAccounts = accountRows.filter(x => !initialAccountIds.has(x.id)
      && [debitCode, creditCode].includes(x.code));
    const newAccountIds = new Set(newAccounts.map(x => x.id));

    const mappingRows = await rows("compta_mapping_compte?select=id,evenement_type,sens,compte_id,pharmacie_id&pharmacie_id=eq." + pharmacyId);
    const newMappings = mappingRows.filter(x => !initialMappingIds.has(x.id)
      && newAccountIds.has(x.compte_id));
    const paramRows = await rows("compta_parametre?select=id,cle,valeur,pharmacie_id&pharmacie_id=eq." + pharmacyId);
    const newParams = paramRows.filter(x => !initialParamIds.has(x.id)
      && ["credit_octroi", "credit_remboursement"].some(event => x.cle === "journal_code." + event)
      && x.valeur === journalCode);

    async function removeIds(table, ids) {
      const list = [...ids];
      if (!list.length) return;
      await request("/rest/v1/" + table + "?id=in.(" + list.join(",") + ")", {
        method: "DELETE", admin: true, prefer: "return=minimal",
        label: "Nettoyage des seules lignes comptables techniques " + table,
      });
    }
    await removeIds("compta_mapping_compte", newMappings.map(x => x.id));
    await removeIds("compta_parametre", newParams.map(x => x.id));
    await removeIds("compta_plan_comptable", newAccounts.map(x => x.id));
    return { accounts: newAccounts.length, mappings: newMappings.length, journals: newParams.length };
  }

  try {
    const promoter = await login(PROMOTER_EMAIL, promoterPassword);
    promoterId = promoter.id;
    promoterToken = promoter.token;

    const profiles = await rows("profiles?select=id,role,actif,niveau_interne&id=eq." + promoterId + "&limit=1");
    if (profiles.length !== 1 || profiles[0].role !== "promoteur"
      || profiles[0].actif !== true || profiles[0].niveau_interne !== 1) {
      throw new Error("Le profil Promoteur de recette n'est pas actif.");
    }
    await rpc("naxa_select_active_role", promoterToken, { p_role_code: "promoteur", p_pharmacie_id: null });
    const scope = await rpc("compta_plan_lister_pharmacies", promoterToken, {});
    if (!Array.isArray(scope) || !scope.some(x => x.pharmacie_id === PHARMACY_ID)) {
      throw new Error("La pharmacie technique est absente du périmètre comptable du Promoteur.");
    }
    const pharmacy = await rows("pharmacies?select=id,actif,archivee_le,est_demo,visible_recherche&id=eq."
      + PHARMACY_ID + "&limit=1");
    if (pharmacy.length !== 1 || pharmacy[0].actif !== true || pharmacy[0].archivee_le !== null
      || pharmacy[0].est_demo !== false || pharmacy[0].visible_recherche !== false) {
      throw new Error("Pharmacie comptable technique non conforme au périmètre Replay masqué.");
    }
    const permission = await rpc("compta_plan_lire", promoterToken, { p_pharmacie: PHARMACY_ID });
    if (!permission || permission.ecriture_autorisee !== true) {
      throw new Error("Le Promoteur n'obtient pas le droit d'écriture comptable sur la pharmacie technique.");
    }

    const accountsBefore = await rows("compta_plan_comptable?select=id,code,statut&pharmacie_id=eq." + pharmacyId);
    const mappingsBefore = await rows("compta_mapping_compte?select=id,evenement_type,sens,compte_id,statut&pharmacie_id=eq." + pharmacyId);
    const paramsBefore = await rows("compta_parametre?select=id,cle,valeur,statut&pharmacie_id=eq." + pharmacyId);
    initialAccountIds = new Set(accountsBefore.map(x => x.id));
    initialMappingIds = new Set(mappingsBefore.map(x => x.id));
    initialParamIds = new Set(paramsBefore.map(x => x.id));
    if (accountsBefore.some(x => [debitCode, creditCode].includes(x.code))) {
      throw new Error("Collision de code E2E comptable avant démarrage.");
    }
    if (paramsBefore.some(x => ["credit_octroi", "credit_remboursement"]
      .some(event => x.cle === "journal_code." + event) && x.statut === "valide")) {
      throw new Error("Un journal crédit déjà validé existe sur la pharmacie technique ; la recette refuse d'écraser sa configuration.");
    }
    if (mappingsBefore.some(x => ["credit_octroi", "credit_remboursement"].includes(x.evenement_type)
      && x.statut === "valide")) {
      throw new Error("Un mapping crédit déjà validé existe sur la pharmacie technique ; la recette refuse de chevaucher la configuration.");
    }

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await pageLogin(page);
    await page.getByRole("heading", { name: "Plan comptable & mappings", exact: true }).waitFor();

    const pharmacySelect = page.getByLabel("Pharmacie du réseau");
    if (await pharmacySelect.count()) {
      await pharmacySelect.selectOption(PHARMACY_ID);
      await page.getByText("Écriture & validation autorisées", { exact: true }).waitFor();
    }
    await page.getByText("Écriture & validation autorisées", { exact: true }).waitFor();
    await page.getByRole("heading", { name: "Journaux comptables", exact: true }).waitFor();

    const accountSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Plan comptable", exact: true }),
    }).first();
    const accountForm = accountSection.locator("form").first();

    async function createAndValidateAccount(code, label, classNo) {
      await accountForm.locator('input[placeholder="Code du compte"]').fill(code);
      await accountForm.locator('input[placeholder="Libellé"]').fill(label);
      await accountForm.locator("select").selectOption(String(classNo));
      await accountForm.getByRole("button", { name: "Ajouter un compte", exact: true }).click();
      const row = page.locator("tr").filter({ hasText: code }).first();
      await row.waitFor({ state: "visible", timeout: 30000 });
      await row.getByRole("button", { name: "Valider", exact: true }).click();
      await row.getByText("Validé", { exact: true }).waitFor({ timeout: 30000 });
    }

    await createAndValidateAccount(debitCode, "Compte technique E2E — débit crédit client", 1);
    await createAndValidateAccount(creditCode, "Compte technique E2E — crédit client", 4);
    const createdAccounts = await rows("compta_plan_comptable?select=id,code,statut&pharmacie_id=eq."
      + pharmacyId);
    const debitAccount = createdAccounts.find(x => x.code === debitCode && x.statut === "valide");
    const creditAccount = createdAccounts.find(x => x.code === creditCode && x.statut === "valide");
    if (!debitAccount || !creditAccount) throw new Error("Les deux comptes techniques n'ont pas été validés.");

    const journalSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Journaux comptables", exact: true }),
    }).first();
    const journalForm = journalSection.locator("form").first();
    async function createAndValidateJournal(event) {
      await journalForm.locator("select").first().selectOption(event);
      await journalForm.locator("input").first().fill(journalCode);
      await journalForm.locator('input[type="date"]').first().fill(today);
      await journalForm.getByRole("button", { name: "Ajouter le journal", exact: true }).click();
      const journalLabel = event === "credit_octroi"
        ? "Octroi de crédit client"
        : "Remboursement de crédit client";
      const article = journalSection.locator("article").filter({ hasText: journalCode })
        .filter({ hasText: journalLabel }).last();
      await article.waitFor({ state: "visible", timeout: 30000 });
      await article.getByRole("button", { name: "Valider", exact: true }).click();
      await article.getByText(/^Validé\s*·/).waitFor({ timeout: 30000 });
    }
    await createAndValidateJournal("credit_octroi");
    await createAndValidateJournal("credit_remboursement");

    const mappingSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Mappings débit / crédit", exact: true }),
    }).first();
    const mappingForm = mappingSection.locator("form").first();
    async function createAndValidateMapping(event, sens, accountId, accountCode) {
      const selects = mappingForm.locator("select");
      await selects.nth(0).selectOption(event);
      await selects.nth(1).selectOption(sens);
      await selects.nth(2).selectOption(accountId);
      await mappingForm.getByRole("button", { name: "Ajouter le mapping", exact: true }).click();
      const article = mappingSection.locator("article")
        .filter({ hasText: event + " · " + (sens === "debit" ? "Débit" : "Crédit") })
        .filter({ hasText: accountCode }).last();
      await article.waitFor({ state: "visible", timeout: 30000 });
      await article.getByRole("button", { name: "Valider mapping", exact: true }).click();
      await article.getByText(/^Validé\s*·/).waitFor({ timeout: 30000 });
    }
    for (const event of ["credit_octroi", "credit_remboursement"]) {
      await createAndValidateMapping(event, "debit", debitAccount.id, debitCode);
      await createAndValidateMapping(event, "credit", creditAccount.id, creditCode);
    }

    const finalAccounts = await rows("compta_plan_comptable?select=id,code,statut&pharmacie_id=eq." + pharmacyId);
    const finalMappings = await rows("compta_mapping_compte?select=id,evenement_type,sens,compte_id,statut&pharmacie_id=eq." + pharmacyId);
    const finalParams = await rows("compta_parametre?select=id,cle,valeur,statut&pharmacie_id=eq." + pharmacyId);
    const journalEvents = new Set(finalParams.filter(x => x.valeur === journalCode
      && x.statut === "valide").map(x => x.cle.replace("journal_code.", "")));
    const expectedMappings = finalMappings.filter(x =>
      [debitAccount.id, creditAccount.id].includes(x.compte_id)
      && ["credit_octroi", "credit_remboursement"].includes(x.evenement_type)
      && x.statut === "valide");
    if (journalEvents.size !== 2 || !journalEvents.has("credit_octroi")
      || !journalEvents.has("credit_remboursement") || expectedMappings.length !== 4) {
      throw new Error("La configuration comptable de crédit créée par l'interface n'est pas complète ou validée.");
    }

    process.stdout.write("PASS — le Promoteur ouvre le plan comptable de sa pharmacie technique et dispose du droit d'écriture.\\n");
    process.stdout.write("PASS — création puis validation de deux comptes techniques via l'interface.\\n");
    process.stdout.write("PASS — création puis validation des journaux octroi et remboursement de crédit.\\n");
    process.stdout.write("PASS — quatre mappings débit/crédit crédit créés puis validés depuis l'interface Promoteur.\\n");
  } catch (error) {
    primaryError = error;
  } finally {
    if (browser) await browser.close().catch(() => null);
    try {
      const cleaned = await cleanupCreatedRows();
      process.stdout.write("INFO — nettoyage des seules lignes de configuration E2E : "
        + cleaned.accounts + " compte(s), " + cleaned.journals + " journal(aux), "
        + cleaned.mappings + " mapping(s). L'audit fonctionnel est conservé.\\n");
    } catch (error) {
      if (primaryError) process.stderr.write("NETTOYAGE COMPTABLE — " + error.message + "\\n");
      else primaryError = error;
    }
    for (const token of [...new Set(apiTokens)].reverse()) {
      await request("/auth/v1/logout?scope=local", {
        method: "POST", token, label: "Fermeture session Auth comptable",
      }).catch(() => null);
    }
  }
  if (primaryError) throw primaryError;
  return true;
}

if (require.main === module) {
  run().catch(error => {
    process.stderr.write("COMPTABILITÉ CRÉDIT BROWSER E2E BLOQUÉE — " + (error?.message || "erreur inconnue") + "\\n");
    process.exitCode = 1;
  });
}
module.exports = { run, assertReplayUrl, PHARMACY_ID };
