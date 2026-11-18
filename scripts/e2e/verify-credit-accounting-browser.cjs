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
  // Configuration stable et isolée sur la seule pharmacie technique Replay.
  // Elle est réutilisée par les exécutions suivantes afin que le worker puisse
  // comptabiliser les événements sans créer des mappings concurrents.
  const debitCode = "NAXAE2ECD";
  const creditCode = "NAXAE2ECC";
  const journalCode = "NAXAE2CR";
  const today = localDate();
  const [year, month] = today.split("-").map(Number);
  const monthStart = year + "-" + String(month).padStart(2, "0") + "-01";
  const monthEndDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = year + "-" + String(month).padStart(2, "0") + "-" + String(monthEndDay).padStart(2, "0");
  let browser = null;
  let promoterToken = null;
  let pharmacyId = PHARMACY_ID;
  let promoterId = null;
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

    const accountsBefore = await rows("compta_plan_comptable?select=id,code,libelle,statut&pharmacie_id=eq." + pharmacyId);
    const reusableAccounts = new Map();
    for (const [code, expectedLabel] of [
      [debitCode, "Compte technique E2E — débit crédit client"],
      [creditCode, "Compte technique E2E — crédit client"],
    ]) {
      const found = accountsBefore.filter(x => x.code === code);
      if (found.length > 1) throw new Error("Plusieurs comptes portent le code technique " + code + ".");
      if (found.length === 1) {
        if (found[0].statut !== "valide" || found[0].libelle !== expectedLabel) {
          throw new Error("Le compte technique " + code + " existe mais n'est pas validé ou ne correspond plus au contrat E2E.");
        }
        reusableAccounts.set(code, found[0]);
      }
    }

    const periodsBefore = await rows("compta_periodes?select=id,date_debut,date_fin,statut&pharmacie_id=eq."
      + pharmacyId + "&order=date_debut.asc");
    const coveringPeriod = periodsBefore.filter(x => x.statut === "ouverte"
      && x.date_debut <= monthStart && x.date_fin >= today);
    if (coveringPeriod.length > 1) throw new Error("Plusieurs périodes comptables ouvertes couvrent la période de recette.");
    if (!coveringPeriod.length && periodsBefore.some(x =>
      x.date_debut <= monthEnd && x.date_fin >= monthStart)) {
      throw new Error("Une période comptable existante chevauche le mois E2E sans couvrir les dates de recette ; aucune période concurrente ne sera créée.");
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

    if (!reusableAccounts.has(debitCode)) {
      await createAndValidateAccount(debitCode, "Compte technique E2E — débit crédit client", 1);
    }
    if (!reusableAccounts.has(creditCode)) {
      await createAndValidateAccount(creditCode, "Compte technique E2E — crédit client", 4);
    }
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
      const journalLabel = event === "credit_octroi"
        ? "Octroi de crédit client"
        : "Remboursement de crédit client";
      const existing = await rows("compta_parametre?select=id,cle,valeur,statut,valide_du,valide_jusquau&pharmacie_id=eq."
        + pharmacyId + "&cle=eq.journal_code." + event);
      if (existing.length > 1) throw new Error("Journal comptable " + event + " dupliqué sur Replay.");
      if (existing.length === 1) {
        if (existing[0].valeur !== journalCode) {
          throw new Error("Le journal " + event + " existe avec un code différent ; aucun écrasement automatique.");
        }
        const validityCoversRun = existing[0].valide_du !== null
          && existing[0].valide_du <= monthStart
          && (existing[0].valide_jusquau === null || existing[0].valide_jusquau >= monthEnd);
        if (existing[0].statut === "valide" && validityCoversRun) return;
        if (existing[0].statut === "valide" && !validityCoversRun) {
          throw new Error("Le journal " + event + " est validé mais ne couvre pas toutes les dates des événements Replay ; intervention manuelle requise.");
        }
        if (existing[0].statut !== "a_valider") {
          throw new Error("État inattendu du journal " + event + " : " + existing[0].statut);
        }
        const pendingArticle = journalSection.locator("article").filter({ hasText: journalCode })
          .filter({ hasText: journalLabel }).last();
        await pendingArticle.waitFor({ state: "visible", timeout: 30000 });
        await pendingArticle.getByRole("button", { name: "Valider", exact: true }).click();
        await pendingArticle.getByText(/^Validé\s*·/).waitFor({ timeout: 30000 });
        return;
      }
      await journalForm.locator("select").first().selectOption(event);
      await journalForm.locator("input").first().fill(journalCode);
      // Le journal doit couvrir les remboursements déjà générés ce mois-ci,
      // pas uniquement les opérations postérieures au jour du test.
      await journalForm.locator('input[type="date"]').first().fill(monthStart);
      await journalForm.getByRole("button", { name: "Ajouter le journal", exact: true }).click();
      const article = journalSection.locator("article").filter({ hasText: journalCode })
        .filter({ hasText: journalLabel }).last();
      await article.waitFor({ state: "visible", timeout: 30000 });
      await article.getByRole("button", { name: "Valider", exact: true }).click();
      await article.getByText(/^Validé\s*·/).waitFor({ timeout: 30000 });
    }
    await createAndValidateJournal("credit_octroi");
    await createAndValidateJournal("credit_remboursement");

    // Ouvrir une vraie période mensuelle depuis l'interface Promoteur.
    // Elle reste attachée à la pharmacie technique Replay pour que le cron puisse
    // poster durablement les événements de cette recette.
    if (!coveringPeriod.length) {
      const periodSection = page.locator("section").filter({
        has: page.getByRole("heading", { name: "Périodes comptables", exact: true }),
      }).first();
      const periodForm = periodSection.locator("form").first();
      await periodForm.locator('input[type="date"]').nth(0).fill(monthStart);
      await periodForm.locator('input[type="date"]').nth(1).fill(monthEnd);
      await periodForm.getByRole("button", { name: "Ouvrir la période", exact: true }).click();
      await periodSection.locator("article").filter({ hasText: monthStart })
        .filter({ hasText: monthEnd }).waitFor({ state: "visible", timeout: 30000 });
    }

    const mappingSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Mappings débit / crédit", exact: true }),
    }).first();
    const mappingForm = mappingSection.locator("form").first();
    async function createAndValidateMapping(event, sens, accountId, accountCode) {
      const current = await rows("compta_mapping_compte?select=id,evenement_type,sens,compte_id,statut"
        + "&pharmacie_id=eq." + pharmacyId + "&evenement_type=eq." + event + "&sens=eq." + sens);
      if (current.length > 1) throw new Error("Mapping " + event + " / " + sens + " dupliqué sur Replay.");
      if (current.length === 1) {
        if (current[0].compte_id !== accountId) {
          throw new Error("Le mapping " + event + " / " + sens + " pointe vers un autre compte ; aucun remplacement automatique.");
        }
        if (current[0].statut === "valide") return;
        if (current[0].statut !== "a_valider") {
          throw new Error("État inattendu du mapping " + event + " / " + sens + " : " + current[0].statut);
        }
        const pendingArticle = mappingSection.locator("article")
          .filter({ hasText: event + " · " + (sens === "debit" ? "Débit" : "Crédit") })
          .filter({ hasText: accountCode }).last();
        await pendingArticle.waitFor({ state: "visible", timeout: 30000 });
        await pendingArticle.getByRole("button", { name: "Valider mapping", exact: true }).click();
        await pendingArticle.getByText(/^Validé\s*·/).waitFor({ timeout: 30000 });
        return;
      }
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
    const finalParams = await rows("compta_parametre?select=id,cle,valeur,statut,valide_du,valide_jusquau&pharmacie_id=eq." + pharmacyId);
    const validJournals = finalParams.filter(x => x.valeur === journalCode
      && x.statut === "valide"
      && x.valide_du !== null && x.valide_du <= monthStart
      && (x.valide_jusquau === null || x.valide_jusquau >= monthEnd));
    const journalEvents = new Set(validJournals.map(x => x.cle.replace("journal_code.", "")));
    const expectedMappings = finalMappings.filter(x =>
      [debitAccount.id, creditAccount.id].includes(x.compte_id)
      && ["credit_octroi", "credit_remboursement"].includes(x.evenement_type)
      && x.statut === "valide");
    const finalPeriods = await rows("compta_periodes?select=id,date_debut,date_fin,statut&pharmacie_id=eq." + pharmacyId);
    const validatedPeriod = finalPeriods.filter(x => x.statut === "ouverte"
      && x.date_debut <= monthStart && x.date_fin >= today);
    if (journalEvents.size !== 2 || !journalEvents.has("credit_octroi")
      || !journalEvents.has("credit_remboursement") || expectedMappings.length !== 4
      || validatedPeriod.length !== 1) {
      throw new Error("La configuration comptable durable (journaux valides sur le mois, mappings, période) n'est pas complète ou validée.");
    }

    process.stdout.write("PASS — le Promoteur ouvre le plan comptable de sa pharmacie technique et dispose du droit d'écriture.\\n");
    process.stdout.write("PASS — création puis validation de deux comptes techniques via l'interface.\\n");
    process.stdout.write("PASS — création puis validation des journaux octroi et remboursement de crédit.\\n");
    process.stdout.write("PASS — quatre mappings débit/crédit crédit créés ou réutilisés et validés depuis l'interface Promoteur.\\n");
    process.stdout.write("PASS — période comptable mensuelle ouverte et couvrant les événements de remboursement Replay.\\n");
    process.stdout.write("PASS — paramètres comptables techniques conservés pour le worker Replay, sans toucher aux vraies pharmacies.\\n");
  } catch (error) {
    primaryError = error;
  } finally {
    if (browser) await browser.close().catch(() => null);
    process.stdout.write("INFO — la configuration comptable de la seule pharmacie technique Replay est conservée pour le traitement outbox.\\n");
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
