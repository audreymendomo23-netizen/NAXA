"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const { chromium } = require("playwright");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const PROJECT_URL = "https://" + PROJECT_REF + ".supabase.co";
const BASE_URL = process.env.NAXA_E2E_WEB_BASE_URL || "http://127.0.0.1:3000";
const PHARMACY_ID = "76dd4983-273a-4a83-ae3d-9a7838d3aa35";
const RUN_LABEL = String(process.env.GITHUB_RUN_ID || Date.now()) + "-" + String(process.env.GITHUB_RUN_ATTEMPT || "1");
const TEMP_PARTNER_NAME = "NAXA E2E NAV TEMP " + RUN_LABEL;
const STATE_FILE = path.join(process.env.RUNNER_TEMP || "/tmp", "naxa-navigation-runtime-state.json");

const supabaseUrl = process.env.NAXA_STORAGE_E2E_URL;
const anonKey = process.env.NAXA_STORAGE_E2E_ANON_KEY;
const adminKey = process.env.NAXA_STORAGE_E2E_ADMIN_KEY;

function requireEnv(value, name) {
  assert.ok(value && String(value).trim(), "Secret manquant : " + name);
  return value;
}

requireEnv(supabaseUrl, "NAXA_STORAGE_E2E_URL");
requireEnv(anonKey, "NAXA_STORAGE_E2E_ANON_KEY");
requireEnv(adminKey, "NAXA_STORAGE_E2E_ADMIN_KEY");
assert.equal(new URL(supabaseUrl).origin, PROJECT_URL, "Projet non-Replay refusé.");

const admin = createClient(supabaseUrl, adminKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

let state = {
  runLabel: RUN_LABEL,
  comptableProfileId: null,
  originalFonctionInterne: null,
  originalPharmacieId: null,
  assignmentId: null,
  partnerId: null,
  partnerOwnerId: null,
};

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

async function profileByUsername(username) {
  const { data, error } = await admin.from("profiles")
    .select("id,username,role,actif,age_verified,fonction_interne,pharmacie_id")
    .eq("username", username).maybeSingle();
  if (error) throw error;
  assert.ok(data, "Profil Replay existant absent : " + username);
  assert.equal(data.actif, true, "Profil inactif : " + username);
  assert.equal(data.age_verified, true, "Profil sans déclaration d'âge : " + username);
  return data;
}

async function authUserForProfile(profile) {
  const { data, error } = await admin.auth.admin.getUserById(profile.id);
  if (error) throw error;
  assert.ok(data.user && data.user.email, "Le profil existant ne possède pas d'identité Auth utilisable.");
  assert.ok(data.user.email_confirmed_at, "L'identité Auth de recette n'est pas confirmée.");
  const promoterFixture = profile.username === "naxa_e2e_promoteur"
    && data.user.user_metadata?.naxa_e2e_promoteur === true;
  const namedFixture = String(data.user.user_metadata?.naxa_e2e_fixture || "").startsWith("NAXA-E2E-");
  assert.ok(promoterFixture || namedFixture, "Marqueur de compte E2E absent : aucun lien magique ne sera émis.");
  return data.user;
}

async function createExistingUserSession(profile) {
  const user = await authUserForProfile(profile);
  const { data: generated, error: generateError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (generateError) throw generateError;
  const tokenHash = generated && generated.properties && generated.properties.hashed_token;
  assert.ok(tokenHash, "Supabase n'a pas retourné le token-hash du lien ponctuel.");

  const cookieJar = new Map();
  const ssrClient = createServerClient(PROJECT_URL, anonKey, {
    cookies: {
      getAll: () => Array.from(cookieJar.values()).map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
      })),
      setAll: (cookiesToSet) => {
        for (const cookie of cookiesToSet) cookieJar.set(cookie.name, cookie);
      },
    },
  });

  const { data, error } = await ssrClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (error) throw error;
  assert.ok(data.session && data.session.access_token, "La session Auth ponctuelle n'a pas été créée.");
  assert.ok(cookieJar.size > 0, "Supabase SSR n'a pas émis de cookies de session.");

  return {
    userId: profile.id,
    accessToken: data.session.access_token,
    cookies: Array.from(cookieJar.values()),
  };
}

function browserCookies(session) {
  const cookieDomain = new URL(BASE_URL).hostname;
  return session.cookies.map((cookie) => {
    const options = cookie.options || {};
    const rawSameSite = String(options.sameSite || "lax").toLowerCase();
    const sameSite = rawSameSite === "strict" ? "Strict" : rawSameSite === "none" ? "None" : "Lax";
    assert.ok(cookie.name && typeof cookie.value === "string",
      "Supabase SSR a émis un cookie sans nom ou valeur.");
    const result = {
      name: cookie.name,
      value: cookie.value,
      domain: cookieDomain,
      path: "/",
      httpOnly: Boolean(options.httpOnly),
      secure: new URL(BASE_URL).protocol === "https:",
      sameSite,
    };
    if (options.expires instanceof Date) result.expires = options.expires.getTime() / 1000;
    else if (typeof options.expires === "number" && options.expires > 0) result.expires = options.expires;
    else if (typeof options.maxAge === "number" && options.maxAge > 0) {
      result.expires = Math.floor(Date.now() / 1000) + options.maxAge;
    }
    return result;
  });
}

async function browserContext(browser, session, viewport) {
  const context = await browser.newContext({ viewport });
  const authCookies = browserCookies(session);
  assert.ok(authCookies.length > 0, "Aucun cookie Auth SSR à injecter.");
  for (const cookie of authCookies) {
    assert.ok(cookie.domain && cookie.path, "Cookie Auth sans domaine/chemin valide.");
  }
  await context.addCookies(authCookies);
  await context.addCookies([{
    name: "naxa-age-status-v2",
    value: "adult",
    domain: new URL(BASE_URL).hostname,
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  }]);
  return context;
}

async function expectPath(page, pathname, label) {
  await page.waitForURL((url) => url.pathname === pathname, { timeout: 20000 });
  assert.equal(new URL(page.url()).pathname, pathname, label + " : URL inattendue.");
  console.log("PASS navigation — " + label);
}

async function expectPageHeading(page, label) {
  await page.locator("main h1, main h2").first().waitFor({ state: "visible", timeout: 15000 });
  console.log("PASS rendu — " + label);
}

async function setActiveComptableRole(profile, accessToken) {
  const userClient = createClient(PROJECT_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: "Bearer " + accessToken } },
  });
  const { data, error } = await userClient.rpc("naxa_select_active_role", {
    p_role_code: "comptable",
    p_pharmacie_id: PHARMACY_ID,
    p_partner_id: null,
  });
  if (error) throw error;
  assert.equal(data, true, "La sélection du rôle Comptable a été refusée.");

  const [business, pharmacy, allowed] = await Promise.all([
    userClient.rpc("naxa_business_function"),
    userClient.rpc("naxa_active_role_pharmacy"),
    userClient.rpc("compta_scope_autorise", { p_pharmacie: PHARMACY_ID }),
  ]);
  if (business.error) throw business.error;
  if (pharmacy.error) throw pharmacy.error;
  if (allowed.error) throw allowed.error;
  assert.equal(business.data, "comptable", "Le rôle actif n'est pas Comptable.");
  assert.equal(pharmacy.data, PHARMACY_ID, "La pharmacie active ne correspond pas à la fixture Replay.");
  assert.equal(allowed.data, true, "Le périmètre Comptable n'est pas autorisé.");
  console.log("PASS session et périmètre — Comptable Replay");
}

async function signOutSession(session) {
  if (!session || !session.accessToken) return;
  const response = await fetch(PROJECT_URL + "/auth/v1/logout?scope=local", {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: "Bearer " + session.accessToken,
    },
  });
  if (!response.ok) {
    throw new Error("Fermeture de session Auth refusée (HTTP " + response.status + ").");
  }
}

async function cleanup() {
  if (!fs.existsSync(STATE_FILE)) {
    console.log("INFO : aucune fixture temporaire à nettoyer.");
    return;
  }
  state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  const failures = [];

  if (state.partnerId) {
    const membershipDelete = await admin.from("partner_members").delete().eq("partner_id", state.partnerId);
    if (membershipDelete.error) failures.push("suppression de l'adhésion partenaire : " + membershipDelete.error.message);
    const remainingMembership = await admin.from("partner_members").select("partner_id", { count: "exact", head: true }).eq("partner_id", state.partnerId);
    if (remainingMembership.error || (remainingMembership.count || 0) !== 0) failures.push("l'adhésion partenaire temporaire est toujours présente.");
    const partnerDelete = await admin.from("partners").delete().eq("id", state.partnerId);
    if (partnerDelete.error) failures.push("suppression du partenaire temporaire : " + partnerDelete.error.message);
    const remainingPartner = await admin.from("partners").select("id", { count: "exact", head: true }).eq("id", state.partnerId);
    if (remainingPartner.error || (remainingPartner.count || 0) !== 0) failures.push("le partenaire temporaire est toujours présent.");
  }

  if (state.comptableProfileId) {
    const activeRoleDelete = await admin.from("naxa_profile_active_roles").delete().eq("profile_id", state.comptableProfileId);
    if (activeRoleDelete.error) failures.push("suppression du rôle actif temporaire : " + activeRoleDelete.error.message);
    const remainingActiveRole = await admin.from("naxa_profile_active_roles").select("profile_id", { count: "exact", head: true }).eq("profile_id", state.comptableProfileId);
    if (remainingActiveRole.error || (remainingActiveRole.count || 0) !== 0) failures.push("le rôle actif temporaire est toujours présent.");
    const profileRestore = await admin.from("profiles").update({
      fonction_interne: state.originalFonctionInterne,
      pharmacie_id: state.originalPharmacieId,
    }).eq("id", state.comptableProfileId);
    if (profileRestore.error) failures.push("restauration du profil Comptable : " + profileRestore.error.message);
    const restoredProfile = await admin.from("profiles").select("fonction_interne,pharmacie_id").eq("id", state.comptableProfileId).maybeSingle();
    if (restoredProfile.error || !restoredProfile.data
      || restoredProfile.data.fonction_interne !== state.originalFonctionInterne
      || restoredProfile.data.pharmacie_id !== state.originalPharmacieId) {
      failures.push("les champs du profil Comptable n'ont pas été restaurés exactement.");
    }
  }

  if (state.assignmentId) {
    const assignmentDelete = await admin.from("naxa_professional_assignments").delete().eq("id", state.assignmentId);
    if (assignmentDelete.error) failures.push("suppression de l'affectation Comptable temporaire : " + assignmentDelete.error.message);
    const remainingAssignment = await admin.from("naxa_professional_assignments")
      .select("id", { count: "exact", head: true }).eq("id", state.assignmentId);
    if (remainingAssignment.error || (remainingAssignment.count || 0) !== 0) failures.push("l'affectation Comptable temporaire est toujours présente.");
  }

  if (failures.length) {
    console.error("ECHEC NETTOYAGE — ne pas considérer Replay comme propre : " + failures.join(" | "));
    throw new Error("Nettoyage des fixtures Replay incomplet.");
  }

  fs.unlinkSync(STATE_FILE);
  console.log("PASS nettoyage — affectation Comptable, rôle actif, partenaire et adhésion temporaires supprimés.");
}

async function run() {
  assert.equal(process.env.NAXA_E2E_ALLOW_TEMP_FIXTURES, "true",
    "Création des fixtures temporaire refusée sans opt-in explicite NAXA_E2E_ALLOW_TEMP_FIXTURES=true.");
  const promoter = await profileByUsername("naxa_e2e_promoteur");
  const comptable = await profileByUsername("naxa_e2e_expiry_overflow");
  const partnerOwner = await profileByUsername("naxa_e2e_acheteur");
  assert.equal(promoter.role, "promoteur", "Le profil Promoteur existant a changé de rôle.");
  assert.equal(comptable.role, "client", "Le profil de recette destiné au rôle temporaire n'est plus Client.");
  assert.equal(partnerOwner.role, "client", "Le profil Client destiné au partenaire n'est plus Client.");
  assert.equal(comptable.fonction_interne, null, "Le profil Comptable de recette possède déjà une fonction interne.");
  assert.equal(comptable.pharmacie_id, null, "Le profil Comptable de recette possède déjà une pharmacie active.");

  const [activeRole, assignment, partnersByName, memberships, pharmacy, promoterLink] = await Promise.all([
    admin.from("naxa_profile_active_roles").select("profile_id").eq("profile_id", comptable.id).maybeSingle(),
    admin.from("naxa_professional_assignments").select("id").eq("profile_id", comptable.id).eq("role_code", "comptable").eq("statut", "active"),
    admin.from("partners").select("id").eq("name", TEMP_PARTNER_NAME),
    admin.from("partner_members").select("partner_id").eq("user_id", partnerOwner.id),
    admin.from("pharmacies").select("id,actif,est_demo").eq("id", PHARMACY_ID).single(),
    admin.from("promoteur_pharmacies").select("pharmacie_id,actif").eq("promoteur_id", promoter.id).eq("pharmacie_id", PHARMACY_ID).eq("actif", true).maybeSingle(),
  ]);
  for (const result of [activeRole, assignment, partnersByName, memberships, pharmacy, promoterLink]) {
    if (result.error) throw result.error;
  }
  assert.equal(activeRole.data, null, "Une sélection de rôle préexistante empêche un test réversible.");
  assert.equal((assignment.data || []).length, 0, "Une affectation Comptable préexistante empêche un test réversible.");
  assert.equal((partnersByName.data || []).length, 0, "Collision de nom de fixture partenaire.");
  assert.equal((memberships.data || []).length, 0, "Le compte Client de recette possède déjà une adhésion partenaire.");
  assert.equal(pharmacy.data.actif, true, "La pharmacie de recette n'est pas active.");
  assert.equal(pharmacy.data.est_demo, true, "La pharmacie sélectionnée n'est pas une pharmacie E2E.");
  assert.ok(promoterLink.data, "Le Promoteur existant n'est pas propriétaire de la pharmacie de recette.");

  state.comptableProfileId = comptable.id;
  state.originalFonctionInterne = comptable.fonction_interne;
  state.originalPharmacieId = comptable.pharmacie_id;
  state.partnerOwnerId = partnerOwner.id;
  saveState();

  const { data: insertedAssignment, error: assignmentError } = await admin.from("naxa_professional_assignments")
    .insert({
      profile_id: comptable.id,
      pharmacie_id: PHARMACY_ID,
      fonction: "comptable",
      role_code: "comptable",
      statut: "active",
      motif: "Navigation runtime E2E temporaire " + RUN_LABEL,
      nature_affectation: "ordinaire",
      commence_at: new Date().toISOString(),
      accorde_par: promoter.id,
    })
    .select("id").single();
  if (assignmentError) throw assignmentError;
  state.assignmentId = insertedAssignment.id;
  saveState();
  console.log("INFO : affectation Comptable temporaire ajoutée à un profil Auth existant.");

  const { data: insertedPartner, error: partnerError } = await admin.from("partners")
    .insert({
      name: TEMP_PARTNER_NAME,
      partner_type: "centre_examen",
      city: "Yaoundé",
      status: "active",
      created_by: partnerOwner.id,
    })
    .select("id").single();
  if (partnerError) throw partnerError;
  state.partnerId = insertedPartner.id;
  saveState();

  const { error: membershipError } = await admin.from("partner_members").insert({
    partner_id: state.partnerId,
    user_id: partnerOwner.id,
    member_role: "owner",
  });
  if (membershipError) throw membershipError;
  console.log("INFO : partenaire et adhésion owner temporaires ajoutés ; aucun compte Auth créé.");

  const sessions = [];
  let browser;
  try {
    const promoterSession = await createExistingUserSession(promoter);
    sessions.push(promoterSession);
    const comptableSession = await createExistingUserSession(comptable);
    sessions.push(comptableSession);
    const partnerSession = await createExistingUserSession(partnerOwner);
    sessions.push(partnerSession);

    await setActiveComptableRole(comptable, comptableSession.accessToken);
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

    const promoterContext = await browserContext(browser, promoterSession, { width: 1440, height: 900 });
    const promoterPage = await promoterContext.newPage();
    promoterPage.setDefaultTimeout(15000);
    await promoterPage.goto(BASE_URL + "/pharmacie/promoteur", { waitUntil: "domcontentloaded" });
    const subNavigation = promoterPage.getByRole("navigation", { name: "Navigation des sous-pages Promoteur" });
    const subNavigationLink = subNavigation.locator('a[href="/pharmacie/promoteur/livraisons"]');
    await subNavigationLink.waitFor({ state: "visible" });
    await subNavigationLink.click();
    await expectPath(promoterPage, "/pharmacie/promoteur/livraisons", "Sous-navigation Promoteur → Livraisons du réseau");
    await expectPageHeading(promoterPage, "Sous-navigation Promoteur → Livraisons du réseau");
    await promoterPage.goto(BASE_URL + "/pharmacie/promoteur", { waitUntil: "domcontentloaded" });
    const promoterNavigation = promoterPage.getByRole("navigation", { name: "Sections Promoteur" });
    const promoterLink = promoterNavigation.locator('a[href="/pharmacie/promoteur/livraisons"]');
    await promoterLink.waitFor({ state: "visible" });
    await promoterLink.click();
    await expectPath(promoterPage, "/pharmacie/promoteur/livraisons", "Navigation latérale Promoteur → Livraisons du réseau");
    await expectPageHeading(promoterPage, "Navigation latérale Promoteur → Livraisons du réseau");
    await promoterContext.close();

    const promoterMobileContext = await browserContext(browser, promoterSession, { width: 390, height: 844 });
    const promoterMobilePage = await promoterMobileContext.newPage();
    promoterMobilePage.setDefaultTimeout(15000);
    await promoterMobilePage.goto(BASE_URL + "/pharmacie/promoteur", { waitUntil: "domcontentloaded" });
    await promoterMobilePage.getByRole("button", { name: "Ouvrir le menu de navigation" }).click();
    const mobilePromoterLink = promoterMobilePage.locator('a[href="/pharmacie/promoteur/livraisons"]').first();
    await mobilePromoterLink.waitFor({ state: "visible" });
    await mobilePromoterLink.click();
    await expectPath(promoterMobilePage, "/pharmacie/promoteur/livraisons", "Promoteur mobile → Livraisons du réseau");
    await promoterMobileContext.close();

    const comptableContext = await browserContext(browser, comptableSession, { width: 1440, height: 900 });
    const comptablePage = await comptableContext.newPage();
    comptablePage.setDefaultTimeout(15000);
    await comptablePage.goto(BASE_URL + "/pharmacie/comptable", { waitUntil: "domcontentloaded" });
    await expectPath(comptablePage, "/pharmacie/comptable", "Ouverture espace Comptable");
    await expectPageHeading(comptablePage, "Tableau de bord Comptable");

    const comptableLinks = [
      { label: "Créances & bordereaux", href: "/pharmacie/comptable/creances-bordereaux" },
      { label: "Rejets & relances", href: "/pharmacie/comptable/rejets-relances" },
      { label: "Rapports & exports", href: "/pharmacie/comptable/rapports-exports" },
      { label: "Documents", href: "/pharmacie/comptable/documents" },
      { label: "Assureurs & fournisseurs", href: "/pharmacie/comptable/referentiels" },
      { label: "Plan comptable & mappings", href: "/pharmacie/comptabilite/plan" },
    ];
    for (const item of comptableLinks) {
      // Cibler explicitement la sidebar du layout, pas la navigation de cartes
      // rendue aussi dans le dashboard. Vérifier le texte et le href réels.
      await comptablePage.goto(BASE_URL + "/pharmacie/comptable", { waitUntil: "domcontentloaded" });
      await expectPath(comptablePage, "/pharmacie/comptable", "Retour au tableau de bord Comptable");
      const sidebar = comptablePage.locator("aside").filter({ hasText: "Compte Comptable" });
      const sidebarNav = sidebar.locator('nav[aria-label="Navigation Comptable"]');
      await sidebarNav.waitFor({ state: "visible" });
      const entries = await sidebarNav.locator("a").evaluateAll((nodes) => nodes.map((node) => ({
        href: node.getAttribute("href"),
        label: (node.textContent || "").replace(/\s+/g, " ").trim(),
        visible: node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden",
      })));
      console.log("INFO sidebar Comptable — " + JSON.stringify(entries));
      // Le href reste l'identifiant stable ; l'intitulé est vérifié séparément.
      const targetLink = sidebarNav.locator("a[href='" + item.href + "']");
      await targetLink.waitFor({ state: "visible" });
      const actualLabel = (await targetLink.innerText()).replace(/\s+/g, " ").trim();
      assert.equal(actualLabel, item.label, "Intitulé incorrect pour " + item.href);
      await targetLink.click();
      await expectPath(comptablePage, item.href, "Comptable → " + item.label);
      await expectPageHeading(comptablePage, "Comptable → " + item.label);
      console.log("PASS sidebar Comptable — " + item.label);
    }
    await comptableContext.close();

    const partnerContext = await browserContext(browser, partnerSession, { width: 1440, height: 900 });
    const partnerPage = await partnerContext.newPage();
    partnerPage.setDefaultTimeout(15000);
    await partnerPage.goto(BASE_URL + "/partenaire/catalogue", { waitUntil: "domcontentloaded" });
    await expectPath(partnerPage, "/partenaire/catalogue", "Ouverture du catalogue partenaire");
    const catalogueExamensLink = partnerPage.getByRole("link", { name: "Centres et examens", exact: true });
    await catalogueExamensLink.waitFor({ state: "visible" });
    await catalogueExamensLink.click();
    await expectPath(partnerPage, "/partenaire/examens", "Catalogue partenaire → Centres et examens");
    await partnerPage.getByRole("heading", { name: "Centres et examens", exact: true }).waitFor({ state: "visible" });
    await partnerPage.getByText("Créer la fiche de ton centre", { exact: true }).waitFor({ state: "visible" });
    console.log("PASS rendu — Partenaire → Centres et examens");

    await partnerPage.goto(BASE_URL + "/partenaire/reservations", { waitUntil: "domcontentloaded" });
    await expectPath(partnerPage, "/partenaire/reservations", "Ouverture des réservations partenaire");
    await partnerPage.getByRole("link", { name: "Centres et examens", exact: true }).waitFor({ state: "visible" });
    await partnerPage.getByRole("link", { name: "Centres et examens", exact: true }).click();
    await expectPath(partnerPage, "/partenaire/examens", "Réservations partenaire → Centres et examens");
    await partnerContext.close();

    console.log("RESULTAT NAVIGATION : PASS — Promoteur desktop/mobile, 6 entrées Comptable, Partenaire depuis Catalogue et Réservations.");
  } finally {
    const shutdownFailures = [];
    try {
      if (browser) await browser.close();
    } catch (error) {
      shutdownFailures.push("fermeture Chromium : " + String(error && error.message ? error.message : error));
    }
    const logoutResults = await Promise.allSettled(sessions.map(signOutSession));
    for (const result of logoutResults) {
      if (result.status === "rejected") {
        shutdownFailures.push("fermeture Auth : " + String(result.reason && result.reason.message ? result.reason.message : result.reason));
      }
    }
    await cleanup();
    if (shutdownFailures.length) throw new Error(shutdownFailures.join(" | "));
  }
}

if (process.argv.includes("--cleanup")) {
  cleanup().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
} else {
  run().catch(async (error) => {
    console.error("ECHEC NAVIGATION RUNTIME : " + String(error && error.message ? error.message : error));
    try { await cleanup(); } catch (cleanupError) {
      console.error("ECHEC CRITIQUE : Replay peut contenir des fixtures temporaires non nettoyées.");
      process.exitCode = 2;
      return;
    }
    process.exitCode = 1;
  });
}
