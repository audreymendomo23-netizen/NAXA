"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const { chromium } = require("playwright");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const TEMP_PARTNER_NAME = "NAXA E2E Replay — Centre examens";
const PROJECT_URL = "https://" + PROJECT_REF + ".supabase.co";
const BASE_URL = process.env.NAXA_E2E_WEB_BASE_URL || "http://127.0.0.1:3000";
const PHARMACY_ID = "76dd4983-273a-4a83-ae3d-9a7838d3aa35";
const MARKETPLACE_PHARMACY_ID = "1a4f1ce5-cccf-477e-9a5b-474c8c9fc713";
const MARKETPLACE_PRODUCT_ID = "dfd7313c-46a4-455a-b67d-50f0ce2a3686";
const MARKETPLACE_PRODUCT_NAME = "NAXA E2E — Produit crédit comptoir";
const MARKETPLACE_PHARMACY_NAME = "NAXA E2E — Pharmacie de recette (non commerciale)";
const MARKETPLACE_QUANTITY = 2;
const RUN_LABEL = String(process.env.GITHUB_RUN_ID || Date.now()) + "-" + String(process.env.GITHUB_RUN_ATTEMPT || "1");
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
  historyReservationIds: [],
  historyPharmacyId: null,
  historyOriginalVisibleRecherche: null,
  marketplacePharmacyId: null,
  marketplaceOriginalVisibleRecherche: null,
  marketplaceProductId: null,
  marketplaceClientId: null,
  marketplaceReservationId: null,
  marketplaceInitialAvailable: null,
  marketplaceFavoriteCreated: false,
  stockManagerProfileId: null,
  stockManagerOriginalActiveRole: null,
  stockManagerOriginalFonctionInterne: null,
  stockManagerOriginalPharmacieId: null,
  comptableProfileId: null,
  originalFonctionInterne: null,
  originalPharmacieId: null,
  assignmentId: null,
  partnerId: null,
  paymentId: null,
  paymentDestinationId: null,
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

function diagnosticUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const queryKeys = Array.from(new Set(Array.from(url.searchParams.keys()))).sort();
    return url.origin + url.pathname + (queryKeys.length ? "?keys=" + queryKeys.join(",") : "");
  } catch {
    return "[URL non analysable]";
  }
}

function redactDiagnosticText(value) {
  return String(value || "")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[uuid redacted]")
    .replace(/\b(?:\+?237)?[0-9][0-9 .-]{7,}[0-9]\b/g, "[phone redacted]")
    .slice(0, 1800);
}

async function diagnosticResponseBody(response) {
  try {
    const raw = await response.text();
    if (!raw) return "[corps vide]";
    try {
      const parsed = JSON.parse(raw);
      const safe = (value, key = "") => {
        if (/token|password|secret|authorization|cookie|email|phone|telephone|user.?id|profile.?id|uuid/i.test(key)) return "[redacted]";
        if (Array.isArray(value)) return value.slice(0, 8).map((item) => safe(item));
        if (value && typeof value === "object") {
          return Object.fromEntries(Object.entries(value).slice(0, 20).map(([childKey, childValue]) => [childKey, safe(childValue, childKey)]));
        }
        return typeof value === "string" ? redactDiagnosticText(value) : value;
      };
      return JSON.stringify(safe(parsed)).slice(0, 1800);
    } catch {
      return redactDiagnosticText(raw);
    }
  } catch (error) {
    return "[corps inaccessible : " + redactDiagnosticText(error && error.message) + "]";
  }
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

async function setActiveStockManagerRole(profile, accessToken) {
  const userClient = createClient(PROJECT_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: "Bearer " + accessToken } },
  });
  const { data, error } = await userClient.rpc("naxa_select_active_role", {
    p_role_code: "gestionnaire_stock",
    p_pharmacie_id: MARKETPLACE_PHARMACY_ID,
    p_partner_id: null,
  });
  if (error) throw error;
  assert.equal(data, true, "La sélection du rôle Gestionnaire Stock B2 a été refusée.");
  const [business, pharmacy] = await Promise.all([
    userClient.rpc("naxa_business_function"),
    userClient.rpc("naxa_active_role_pharmacy"),
  ]);
  if (business.error) throw business.error;
  if (pharmacy.error) throw pharmacy.error;
  assert.equal(business.data, "gestionnaire_stock", "Le rôle actif du compte n'est pas Gestionnaire Stock.");
  assert.equal(pharmacy.data, MARKETPLACE_PHARMACY_ID, "Le périmètre actif du Gestionnaire Stock n'est pas la pharmacie Marketplace.");
  console.log("PASS session et périmètre — Gestionnaire Stock B2 sélectionné via son affectation Replay.");
}

async function assertClientSession(profile, session) {
  const client = createClient(PROJECT_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: "Bearer " + session.accessToken } },
  });
  const [{ data: authData, error: authError }, { data: visibleProfile, error: profileError }] = await Promise.all([
    client.auth.getUser(session.accessToken),
    client.from("profiles").select("id,username,role,actif,age_verified").eq("id", profile.id).maybeSingle(),
  ]);
  if (authError) throw new Error("Client E2E Auth token invalide : " + authError.message);
  assert.equal(authData.user?.id, profile.id, "L'identité Auth Client ne correspond pas au profil Replay.");
  if (profileError) throw new Error("Lecture RLS du profil Client impossible : " + profileError.message);
  assert.ok(visibleProfile, "Le profil Client est invisible sous son propre JWT.");
  assert.equal(visibleProfile.role, "client");
  assert.equal(visibleProfile.actif, true);
  assert.equal(visibleProfile.age_verified, true);
  const { data: purchases, error: purchasesError } = await client.from("client_achats")
    .select("reservation_id").order("achat_le", { ascending: false, nullsFirst: false }).limit(2000);
  if (purchasesError) throw new Error("Lecture de la vue client_achats sous le JWT Client impossible : " + purchasesError.message);
  console.log("PASS précontrôle JWT Client — profil personnel lisible, identité active, âge vérifié et vue client_achats accessible.");
  return Array.from(new Set((purchases || []).map((row) => row.reservation_id).filter(Boolean)));
}

async function assertClientHistoryIsolation(profileA, sessionA, profileB, sessionB, expectedReservationA, expectedReservationB) {
  assert.notEqual(profileA.id, profileB.id, "Les deux comptes Client doivent être distincts.");
  assert.ok(expectedReservationA && expectedReservationB && expectedReservationA !== expectedReservationB,
    "Les fixtures d'achat doivent être deux réservations distinctes.");
  const [historyA, historyB] = await Promise.all([
    assertClientSession(profileA, sessionA),
    assertClientSession(profileB, sessionB),
  ]);
  assert.ok(historyA.includes(expectedReservationA), "Le Client A ne voit pas son achat E2E.");
  assert.ok(historyB.includes(expectedReservationB), "Le Client B ne voit pas son achat E2E.");
  assert.ok(!historyA.includes(expectedReservationB), "Fuite d'historique : le Client A voit l'achat du Client B.");
  assert.ok(!historyB.includes(expectedReservationA), "Fuite d'historique : le Client B voit l'achat du Client A.");
  const idsA = new Set(historyA);
  const idsB = new Set(historyB);
  const overlap = historyA.filter((id) => idsB.has(id));
  assert.deepEqual(overlap, [], "Fuite d'historique : des réservations sont visibles dans les historiques A et B : " + overlap.join(", "));
  console.log("PASS isolation historique A/B — deux JWT distincts ; chaque Client voit son achat payé et aucun achat de l'autre compte.");
}

async function createClientHistoryFixtures(profileA, profileB) {
  assert.notEqual(profileA.id, profileB.id, "Les comptes clients A/B doivent être distincts avant seed.");
  const historyPharmacyId = "1a4f1ce5-cccf-477e-9a5b-474c8c9fc713";
  const expectedPharmacyName = "NAXA E2E — Pharmacie de recette (non commerciale)";
  const { data: pharmacy, error: pharmacyError } = await admin.from("pharmacies")
    .select("id,nom,actif,est_demo,visible_recherche,archivee_le")
    .eq("id", historyPharmacyId).single();
  if (pharmacyError) throw pharmacyError;
  assert.equal(pharmacy.nom, expectedPharmacyName, "La pharmacie fixture Replay a changé d'identité.");
  assert.equal(pharmacy.actif, true, "La pharmacie fixture Replay doit être active.");
  assert.equal(pharmacy.est_demo, false, "La pharmacie fixture doit être la pharmacie E2E non commerciale, pas une pharmacie démo.");
  assert.equal(pharmacy.archivee_le, null, "La pharmacie fixture est archivée.");
  assert.equal(pharmacy.visible_recherche, false, "La pharmacie fixture ne doit pas être déjà publiée avant le test.");

  const { data: stock, error: stockError } = await admin.from("stocks")
    .select("pharmacie_id,produit_id,prix,quantite")
    .eq("pharmacie_id", historyPharmacyId).gt("quantite", 0).limit(1).maybeSingle();
  if (stockError) throw stockError;
  assert.ok(stock, "Aucun stock positif disponible dans la pharmacie interne de recette Replay.");
  assert.ok(stock.prix > 0, "Le prix de la fixture produit doit être strictement positif.");

  const { data: product, error: productError } = await admin.from("produits")
    .select("id,nom").eq("id", stock.produit_id).single();
  if (productError) throw productError;
  assert.equal(product.nom, "NAXA E2E — Produit crédit comptoir",
    "Le produit de fixture attendu a changé ; aucun autre produit ne sera publié par le test.");

  state.historyPharmacyId = historyPharmacyId;
  state.historyOriginalVisibleRecherche = pharmacy.visible_recherche;
  state.historyReservationIds = [];
  saveState();

  const { data: publishedPharmacy, error: publishError } = await admin.from("pharmacies")
    .update({ visible_recherche: true })
    .eq("id", historyPharmacyId).eq("visible_recherche", false)
    .select("id,visible_recherche").single();
  if (publishError) throw publishError;
  assert.equal(publishedPharmacy.visible_recherche, true, "La visibilité temporaire du produit de recette a échoué.");

  const { data: productVisible, error: visibilityError } = await admin.rpc("marketplace_produit_visible", {
    p_produit: stock.produit_id,
  });
  if (visibilityError) throw visibilityError;
  assert.equal(productVisible, true, "Le produit E2E reste masqué par la règle de visibilité Marketplace.");

  const reservationIds = [];
  for (const fixture of [
    { profile: profileA, suffix: "A" },
    { profile: profileB, suffix: "B" },
  ]) {
    const reservationId = randomUUID();
    const createdAt = new Date().toISOString();

    // Persist the exact ID before insert so the finally cleanup can remove
    // a partially created fixture even if a later statement fails.
    state.historyReservationIds.push(reservationId);
    saveState();

    const { error: reservationError } = await admin.from("reservations").insert({
      id: reservationId,
      client_id: fixture.profile.id,
      pharmacie_id: historyPharmacyId,
      statut: "payee",
      total: stock.prix,
      paiement_ref: null,
      created_at: createdAt,
      mode: "reservation",
      paiement_statut: "effectue",
      paiement_mode: "especes_retrait",
      paiement_valide_at: createdAt,
      stock_decremented: false,
    });
    if (reservationError) throw reservationError;

    const { error: itemError } = await admin.from("reservation_items").insert({
      reservation_id: reservationId,
      produit_id: stock.produit_id,
      quantite: 1,
      prix_unitaire: stock.prix,
    });
    if (itemError) throw itemError;

    const { error: eventError } = await admin.from("reservation_events").insert({
      reservation_id: reservationId,
      client_id: fixture.profile.id,
      pharmacie_id: historyPharmacyId,
      event_type: "status_changed",
      from_statut: "confirmee",
      to_statut: "payee",
      paiement_ref: null,
      occurred_at: createdAt,
      detail: { e2e: true, run_label: RUN_LABEL, suffix: fixture.suffix, test: "client_history_isolation_ab" },
    });
    if (eventError) throw eventError;

    reservationIds.push(reservationId);
  }

  console.log("PASS fixtures historique — deux achats E2E payés créés pour deux Clients distincts ; aucune ligne de stock n'a été débitée.");
  return { reservationA: reservationIds[0], reservationB: reservationIds[1] };
}

async function cleanupClientHistoryFixtures() {
  if (!state.historyPharmacyId && !(state.historyReservationIds || []).length) return;
  const failures = [];
  const reservationIds = Array.isArray(state.historyReservationIds) ? state.historyReservationIds.filter(Boolean) : [];

  if (reservationIds.length) {
    const deleted = await admin.from("reservations").delete()
      .in("id", reservationIds).select("id");
    if (deleted.error) failures.push("suppression des réservations A/B temporaires : " + deleted.error.message);

    const remainingReservations = await admin.from("reservations")
      .select("id", { count: "exact", head: true }).in("id", reservationIds);
    if (remainingReservations.error || (remainingReservations.count || 0) !== 0) {
      failures.push("des réservations A/B temporaires sont toujours présentes.");
    }
  }

  if (state.historyPharmacyId && typeof state.historyOriginalVisibleRecherche === "boolean") {
    const restored = await admin.from("pharmacies")
      .update({ visible_recherche: state.historyOriginalVisibleRecherche })
      .eq("id", state.historyPharmacyId)
      .select("visible_recherche").single();
    if (restored.error || !restored.data
      || restored.data.visible_recherche !== state.historyOriginalVisibleRecherche) {
      failures.push("la visibilité Marketplace de la pharmacie interne n'a pas été restaurée.");
    }
  }

  if (failures.length) {
    console.error("ECHEC NETTOYAGE HISTORIQUE A/B — " + failures.join(" | "));
    throw new Error("Les fixtures temporaires de l'historique Client ne sont pas propres.");
  }

  state.historyReservationIds = [];
  state.historyPharmacyId = null;
  state.historyOriginalVisibleRecherche = null;
  saveState();
  console.log("PASS nettoyage historique A/B — réservations et événements temporaires supprimés ; visibilité initiale restaurée.");
}


async function marketplaceAvailableQuantity() {
  const { data, error } = await admin.rpc("marketplace_offre_stock_disponible", {
    p_pharmacie: MARKETPLACE_PHARMACY_ID, p_produit: MARKETPLACE_PRODUCT_ID,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row && Number.isFinite(Number(row.quantite)) ? Number(row.quantite) : 0;
}

async function prepareClientMarketplaceFixture(clientProfile, client) {
  const [pharmacyResult, stockResult, productResult, favoriteResult] = await Promise.all([
    admin.from("pharmacies").select("id,nom,actif,est_demo,visible_recherche,archivee_le").eq("id", MARKETPLACE_PHARMACY_ID).single(),
    admin.from("stocks").select("pharmacie_id,produit_id,prix,quantite").eq("pharmacie_id", MARKETPLACE_PHARMACY_ID).eq("produit_id", MARKETPLACE_PRODUCT_ID).single(),
    admin.from("produits").select("id,nom").eq("id", MARKETPLACE_PRODUCT_ID).single(),
    admin.from("favoris_client").select("id").eq("user_id", clientProfile.id).eq("produit_ref", MARKETPLACE_PRODUCT_ID).maybeSingle(),
  ]);
  for (const result of [pharmacyResult, stockResult, productResult, favoriteResult]) if (result.error) throw result.error;
  const pharmacy = pharmacyResult.data, stock = stockResult.data;
  assert.equal(pharmacy.nom, MARKETPLACE_PHARMACY_NAME);
  assert.equal(pharmacy.actif, true);
  assert.equal(pharmacy.est_demo, false);
  assert.equal(pharmacy.archivee_le, null);
  assert.equal(pharmacy.visible_recherche, false);
  assert.equal(productResult.data.nom, MARKETPLACE_PRODUCT_NAME);
  assert.ok(stock.quantite >= MARKETPLACE_QUANTITY);
  assert.ok(stock.prix > 0);
  assert.equal(favoriteResult.data, null, "Préserver un éventuel favori préexistant.");

  state.marketplacePharmacyId = MARKETPLACE_PHARMACY_ID;
  state.marketplaceOriginalVisibleRecherche = pharmacy.visible_recherche;
  state.marketplaceProductId = MARKETPLACE_PRODUCT_ID;
  state.marketplaceClientId = clientProfile.id;
  state.marketplaceReservationId = null;
  state.marketplaceInitialAvailable = null;
  state.marketplaceFavoriteCreated = false;
  saveState();

  const { data: published, error: publishError } = await admin.from("pharmacies")
    .update({ visible_recherche: true }).eq("id", MARKETPLACE_PHARMACY_ID)
    .eq("visible_recherche", false).select("id,visible_recherche").single();
  if (publishError) throw publishError;
  assert.equal(published.visible_recherche, true);

  const [available, visible, search] = await Promise.all([
    marketplaceAvailableQuantity(),
    admin.rpc("marketplace_produit_visible", { p_produit: MARKETPLACE_PRODUCT_ID }),
    client.rpc("search_pharmacies_bulk", {
      p_terms: ["crédit comptoir"], p_quantities: [MARKETPLACE_QUANTITY],
      p_lat: 3.87, p_lng: 11.52, p_rayon_km: 35,
    }),
  ]);
  if (visible.error) throw visible.error;
  if (search.error) throw search.error;
  assert.ok(visible.data);
  assert.ok(available >= MARKETPLACE_QUANTITY);
  assert.ok((search.data || []).some(row => row.pharmacie_id === MARKETPLACE_PHARMACY_ID
    && row.trouves === 1 && row.demandes === 1
    && Array.isArray(row.items) && row.items.some(item => item.produit_id === MARKETPLACE_PRODUCT_ID)),
  "La recherche bulk Replay ne retourne pas l'offre complète.");
  state.marketplaceInitialAvailable = available;
  saveState();
  console.log("PASS préparation B2 — pharmacie publiée temporairement, produit visible, offre Yaoundé, stock public=" + available + ".");
  return { available, quantity: MARKETPLACE_QUANTITY };
}

async function waitForClientFavorite(client, expectedPresent) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const { data, error } = await client.from("favoris_client").select("id,produit_ref,nom,demo")
      .eq("produit_ref", MARKETPLACE_PRODUCT_ID);
    if (error) throw error;
    if ((data || []).length === (expectedPresent ? 1 : 0)) return (data || [])[0] || null;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Le favori Marketplace persistant n'a pas atteint l'état attendu.");
}

async function cleanupClientMarketplaceFixture() {
  if (!state.marketplacePharmacyId && !state.marketplaceReservationId && !state.marketplaceFavoriteCreated) return;
  const failures = [];
  if (state.marketplaceReservationId) {
    const { data: current, error: currentError } = await admin.from("reservations")
      .select("id,client_id,pharmacie_id,statut").eq("id", state.marketplaceReservationId).maybeSingle();
    if (currentError) failures.push("lecture réservation Marketplace : " + currentError.message);
    else if (current && ["en_attente", "confirmee"].includes(current.statut)) {
      try {
        const { data: profile, error: profileError } = await admin.from("profiles")
          .select("id,username,role,actif,age_verified,fonction_interne,pharmacie_id")
          .eq("id", state.marketplaceClientId).single();
        if (profileError) throw profileError;
        const session = await createExistingUserSession(profile);
        try {
          const client = createClient(PROJECT_URL, anonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: { headers: { Authorization: "Bearer " + session.accessToken } },
          });
          const result = await client.rpc("set_reservation_status", {
            p_id: state.marketplaceReservationId, p_statut: "annulee",
          });
          if (result.error) throw result.error;
        } finally { await signOutSession(session); }
      } catch (error) {
        failures.push("annulation de secours par le Client : " + String(error && error.message ? error.message : error));
      }
    }
    const { data: after, error: afterError } = await admin.from("reservations")
      .select("id,statut").eq("id", state.marketplaceReservationId).maybeSingle();
    if (afterError) failures.push("vérification réservation Marketplace : " + afterError.message);
    else if (after && !["annulee", "expiree"].includes(after.statut)) failures.push("réservation Marketplace toujours active.");
    if (state.marketplaceInitialAvailable !== null && state.marketplaceInitialAvailable !== undefined) {
      try {
        const available = await marketplaceAvailableQuantity();
        if (available !== state.marketplaceInitialAvailable) failures.push("stock non restauré : attendu "
          + state.marketplaceInitialAvailable + ", obtenu " + available + ".");
      } catch (error) { failures.push("lecture stock après annulation : " + String(error && error.message ? error.message : error)); }
    }
    if (after && ["annulee", "expiree"].includes(after.statut)) {
      const deleted = await admin.from("reservations").delete().eq("id", state.marketplaceReservationId).select("id");
      if (deleted.error) failures.push("suppression réservation Marketplace : " + deleted.error.message);
      const remaining = await admin.from("reservations").select("id", { count: "exact", head: true }).eq("id", state.marketplaceReservationId);
      if (remaining.error || (remaining.count || 0) !== 0) failures.push("réservation Marketplace éphémère encore présente.");
    }
  }
  if (state.marketplaceFavoriteCreated && state.marketplaceClientId && state.marketplaceProductId) {
    const removed = await admin.from("favoris_client").delete().eq("user_id", state.marketplaceClientId).eq("produit_ref", state.marketplaceProductId);
    if (removed.error) failures.push("suppression favori Marketplace : " + removed.error.message);
    const remaining = await admin.from("favoris_client").select("id", { count: "exact", head: true })
      .eq("user_id", state.marketplaceClientId).eq("produit_ref", state.marketplaceProductId);
    if (remaining.error || (remaining.count || 0) !== 0) failures.push("favori Marketplace encore présent.");
  }
  if (state.marketplacePharmacyId && typeof state.marketplaceOriginalVisibleRecherche === "boolean") {
    const restored = await admin.from("pharmacies").update({ visible_recherche: state.marketplaceOriginalVisibleRecherche })
      .eq("id", state.marketplacePharmacyId).select("visible_recherche").single();
    if (restored.error || !restored.data || restored.data.visible_recherche !== state.marketplaceOriginalVisibleRecherche) {
      failures.push("visibilité initiale pharmacie Marketplace non restaurée.");
    }
  }
  if (failures.length) {
    console.error("ECHEC NETTOYAGE LOT B2 — " + failures.join(" | "));
    throw new Error("Les fixtures temporaires du Lot B2 ne sont pas propres.");
  }
  state.marketplacePharmacyId = null;
  state.marketplaceOriginalVisibleRecherche = null;
  state.marketplaceProductId = null;
  state.marketplaceClientId = null;
  state.marketplaceReservationId = null;
  state.marketplaceInitialAvailable = null;
  state.marketplaceFavoriteCreated = false;
  saveState();
  console.log("PASS nettoyage Lot B2 — réservation annulée/supprimée, stock restauré, favori supprimé, visibilité restaurée.");
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

  if (state.marketplacePharmacyId || state.marketplaceReservationId || state.marketplaceFavoriteCreated) {
    try { await cleanupClientMarketplaceFixture(); }
    catch (error) { failures.push("Lot B2 Marketplace : " + String(error && error.message ? error.message : error)); }
  }

  if (state.historyPharmacyId || (state.historyReservationIds || []).length) {
    try {
      await cleanupClientHistoryFixtures();
    } catch (error) {
      failures.push("historique Client A/B : " + String(error && error.message ? error.message : error));
    }
  }

  if (state.paymentId) {
    const notificationDelete = await admin.from("notifications").delete().eq("related_entity_id", state.paymentId);
    if (notificationDelete.error) failures.push("suppression des notifications de paiement temporaires : " + notificationDelete.error.message);
    const paymentDelete = await admin.from("partner_subscription_payments").delete().eq("id", state.paymentId);
    if (paymentDelete.error) failures.push("suppression du règlement partenaire temporaire : " + paymentDelete.error.message);
    const remainingPayment = await admin.from("partner_subscription_payments").select("id", { count: "exact", head: true }).eq("id", state.paymentId);
    if (remainingPayment.error || (remainingPayment.count || 0) !== 0) failures.push("le règlement partenaire temporaire est toujours présent.");
  }

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

  if (state.stockManagerProfileId) {
    if (state.stockManagerOriginalActiveRole) {
      const roleRestore = await admin.from("naxa_profile_active_roles").upsert({
        profile_id: state.stockManagerProfileId,
        role_code: state.stockManagerOriginalActiveRole.role_code,
        pharmacie_id: state.stockManagerOriginalActiveRole.pharmacie_id,
        partner_id: state.stockManagerOriginalActiveRole.partner_id,
        selected_at: state.stockManagerOriginalActiveRole.selected_at,
        updated_at: state.stockManagerOriginalActiveRole.updated_at,
      }, { onConflict: "profile_id" });
      if (roleRestore.error) failures.push("restauration du rôle actif initial Gestionnaire Stock : " + roleRestore.error.message);
    } else {
      const roleDelete = await admin.from("naxa_profile_active_roles").delete().eq("profile_id", state.stockManagerProfileId);
      if (roleDelete.error) failures.push("suppression du rôle actif temporaire Gestionnaire Stock : " + roleDelete.error.message);
    }
    const profileRestore = await admin.from("profiles").update({
      fonction_interne: state.stockManagerOriginalFonctionInterne,
      pharmacie_id: state.stockManagerOriginalPharmacieId,
    }).eq("id", state.stockManagerProfileId);
    if (profileRestore.error) failures.push("restauration du profil Gestionnaire Stock : " + profileRestore.error.message);
    const [profileCheck, roleCheck] = await Promise.all([
      admin.from("profiles").select("fonction_interne,pharmacie_id").eq("id", state.stockManagerProfileId).maybeSingle(),
      admin.from("naxa_profile_active_roles").select("role_code,pharmacie_id,partner_id")
        .eq("profile_id", state.stockManagerProfileId).maybeSingle(),
    ]);
    if (profileCheck.error || !profileCheck.data
      || profileCheck.data.fonction_interne !== state.stockManagerOriginalFonctionInterne
      || profileCheck.data.pharmacie_id !== state.stockManagerOriginalPharmacieId) {
      failures.push("les champs initiaux du profil Gestionnaire Stock n'ont pas été restaurés.");
    }
    if (state.stockManagerOriginalActiveRole) {
      if (roleCheck.error || !roleCheck.data
        || roleCheck.data.role_code !== state.stockManagerOriginalActiveRole.role_code
        || roleCheck.data.pharmacie_id !== state.stockManagerOriginalActiveRole.pharmacie_id
        || roleCheck.data.partner_id !== state.stockManagerOriginalActiveRole.partner_id) {
        failures.push("le rôle actif initial du Gestionnaire Stock n'est pas restauré.");
      }
    } else if (roleCheck.error || roleCheck.data) {
      failures.push("le rôle actif temporaire du Gestionnaire Stock n'a pas été retiré.");
    }
  }

  if (state.assignmentId) {
    const assignmentDelete = await admin.from("naxa_professional_assignments").delete().eq("id", state.assignmentId);
    if (assignmentDelete.error) failures.push("suppression de l'affectation Comptable temporaire : " + assignmentDelete.error.message);
    const remainingAssignment = await admin.from("naxa_professional_assignments")
      .select("id", { count: "exact", head: true }).eq("id", state.assignmentId);
    if (remainingAssignment.error || (remainingAssignment.count || 0) !== 0) failures.push("l'affectation Comptable temporaire est toujours présente.");
  }

  if (state.paymentDestinationId) {
    const destinationDelete = await admin.from("naxa_payment_destinations").delete().eq("id", state.paymentDestinationId);
    if (destinationDelete.error) failures.push("suppression de la destination de paiement temporaire : " + destinationDelete.error.message);
    const remainingDestination = await admin.from("naxa_payment_destinations").select("id", { count: "exact", head: true }).eq("id", state.paymentDestinationId);
    if (remainingDestination.error || (remainingDestination.count || 0) !== 0) failures.push("la destination de paiement temporaire est toujours présente.");
  }

  if (failures.length) {
    console.error("ECHEC NETTOYAGE — ne pas considérer Replay comme propre : " + failures.join(" | "));
    throw new Error("Nettoyage des fixtures Replay incomplet.");
  }

  fs.unlinkSync(STATE_FILE);
  console.log("PASS nettoyage — fixtures temporaires présentes dans le registre supprimées et contrôlées.");
}

async function run() {
  assert.equal(process.env.NAXA_E2E_ALLOW_TEMP_FIXTURES, "true",
    "Création des fixtures temporaire refusée sans opt-in explicite NAXA_E2E_ALLOW_TEMP_FIXTURES=true.");
  const promoter = await profileByUsername("naxa_e2e_promoteur");
  const comptable = await profileByUsername("naxa_e2e_expiry_overflow");
  const partnerOwner = await profileByUsername("naxa_e2e_acheteur");
  const stockManager = await profileByUsername("naxa_e2e_expiry_stock");
  assert.equal(promoter.role, "promoteur", "Le profil Promoteur existant a changé de rôle.");
  assert.equal(comptable.role, "client", "Le profil de recette destiné au rôle temporaire n'est plus Client.");
  assert.equal(partnerOwner.role, "client", "Le profil Client destiné au partenaire n'est plus Client.");
  assert.equal(stockManager.role, "client", "Le profil de décision B2 doit conserver son identité racine Client.");
  assert.equal(stockManager.pharmacie_id, MARKETPLACE_PHARMACY_ID, "Le Gestionnaire Stock B2 n'est pas affecté à la pharmacie Marketplace attendue.");
  assert.equal(comptable.fonction_interne, null, "Le profil Comptable de recette possède déjà une fonction interne.");
  assert.equal(comptable.pharmacie_id, null, "Le profil Comptable de recette possède déjà une pharmacie active.");

  const [activeRole, assignment, pharmacy, promoterLink, stockManagerRole, stockManagerAssignment] = await Promise.all([
    admin.from("naxa_profile_active_roles").select("profile_id").eq("profile_id", comptable.id).maybeSingle(),
    admin.from("naxa_professional_assignments").select("id").eq("profile_id", comptable.id).eq("role_code", "comptable").eq("statut", "active"),
    admin.from("pharmacies").select("id,actif,est_demo").eq("id", PHARMACY_ID).single(),
    admin.from("promoteur_pharmacies").select("pharmacie_id,actif").eq("promoteur_id", promoter.id).eq("pharmacie_id", PHARMACY_ID).eq("actif", true).maybeSingle(),
    admin.from("naxa_profile_active_roles").select("profile_id,role_code,pharmacie_id,partner_id,selected_at,updated_at")
      .eq("profile_id", stockManager.id).maybeSingle(),
    admin.from("naxa_professional_assignments").select("id,role_code,pharmacie_id,statut,commence_at,expire_at")
      .eq("profile_id", stockManager.id).eq("role_code", "gestionnaire_stock")
      .eq("pharmacie_id", MARKETPLACE_PHARMACY_ID).eq("statut", "active").maybeSingle(),
  ]);
  for (const result of [activeRole, assignment, pharmacy, promoterLink, stockManagerRole, stockManagerAssignment]) {
    if (result.error) throw result.error;
  }
  assert.equal(activeRole.data, null, "Une sélection de rôle préexistante empêche un test réversible.");
  assert.equal((assignment.data || []).length, 0, "Une affectation Comptable préexistante empêche un test réversible.");
  assert.equal(pharmacy.data.actif, true, "La pharmacie de recette n'est pas active.");
  assert.equal(pharmacy.data.est_demo, true, "La pharmacie sélectionnée n'est pas une pharmacie E2E.");
  assert.ok(promoterLink.data, "Le Promoteur existant n'est pas propriétaire de la pharmacie de recette.");

  assert.ok(stockManagerAssignment.data, "Aucune affectation Gestionnaire Stock active vers la pharmacie Marketplace.");
  assert.ok(new Date(stockManagerAssignment.data.commence_at).getTime() <= Date.now(),
    "L'affectation Gestionnaire Stock B2 n'a pas encore commencé.");
  assert.ok(!stockManagerAssignment.data.expire_at || new Date(stockManagerAssignment.data.expire_at).getTime() > Date.now(),
    "L'affectation Gestionnaire Stock B2 a expiré.");

  state.stockManagerProfileId = stockManager.id;
  state.stockManagerOriginalActiveRole = stockManagerRole.data;
  state.stockManagerOriginalFonctionInterne = stockManager.fonction_interne;
  state.stockManagerOriginalPharmacieId = stockManager.pharmacie_id;
  state.comptableProfileId = comptable.id;
  state.originalFonctionInterne = comptable.fonction_interne;
  state.originalPharmacieId = comptable.pharmacie_id;
  saveState();

  const sessions = [];
  let browser;
  try {
    const promoterSession = await createExistingUserSession(promoter);
    sessions.push(promoterSession);
    const comptableSession = await createExistingUserSession(comptable);
    sessions.push(comptableSession);
    const clientSession = await createExistingUserSession(partnerOwner);
    sessions.push(clientSession);
    const stockManagerSession = await createExistingUserSession(stockManager);
    sessions.push(stockManagerSession);
    await setActiveStockManagerRole(stockManager, stockManagerSession.accessToken);
    const clientBSession = await createExistingUserSession(comptable);
    sessions.push(clientBSession);
    const historyFixtures = await createClientHistoryFixtures(partnerOwner, comptable);
    await assertClientHistoryIsolation(
      partnerOwner, clientSession, comptable, clientBSession,
      historyFixtures.reservationA, historyFixtures.reservationB
    );
    await cleanupClientHistoryFixtures();

    // Do not assign a professional function to Client B until its Client RLS
    // history has been checked. The same account becomes Comptable only after
    // the A/B isolation proof is complete.
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
    console.log("INFO : affectation Comptable temporaire ajoutée après la recette Client A/B.");

    const adminProfile = await profileByUsername("e2e_admin_261104");
    assert.equal(adminProfile.role, "admin", "Le compte Admin E2E n'a plus le rôle Admin.");
    const adminSession = await createExistingUserSession(adminProfile);
    sessions.push(adminSession);

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
    promoterMobilePage.setDefaultNavigationTimeout(30000);
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
      // Revenir par le lien réel de la sidebar plutôt que recharger la même URL :
      // cela évite d'interrompre une navigation App Router encore en cours.
      if (new URL(comptablePage.url()).pathname !== "/pharmacie/comptable") {
        const dashboardNav = comptablePage.locator("aside")
          .filter({ hasText: "Compte Comptable" })
          .locator('nav[aria-label="Navigation Comptable"]');
        const dashboardLink = dashboardNav.locator('a[href="/pharmacie/comptable"]');
        await dashboardLink.waitFor({ state: "visible" });
        await dashboardLink.click();
        await expectPath(comptablePage, "/pharmacie/comptable", "Retour sidebar au tableau de bord Comptable");
        await expectPageHeading(comptablePage, "Retour tableau de bord Comptable");
      }
      // Cibler explicitement la sidebar du layout, pas la navigation de cartes
      // rendue aussi dans le dashboard. Vérifier le texte et le href réels.
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

    // Fixture partenaire éphémère Replay : comptes Promoteur et Admin existants uniquement.
    // Le paiement est explicitement synthétique, passe par les RPC réelles, puis est nettoyé.
    const { data: tempPartner, error: partnerInsertError } = await admin.from("partners").insert({
      name: TEMP_PARTNER_NAME, partner_type: "centre_examen", city: "Yaoundé",
      status: "active", created_by: promoter.id,
    }).select("id").single();
    if (partnerInsertError) throw partnerInsertError;
    state.partnerId = tempPartner.id;
    saveState();

    const { error: universeInsertError } = await admin.from("partner_universes").insert({
      partner_id: state.partnerId, universe_slug: "examens", enabled: true,
    });
    if (universeInsertError) throw universeInsertError;
    const { error: dossierInsertError } = await admin.from("admin_partner_dossiers").insert({
      partner_id: state.partnerId, promoteur_id: promoter.id, universe_slug: "examens",
      monthly_fee_fcfa: 1, dossier_status: "validated", created_by: promoter.id,
    });
    if (dossierInsertError) throw dossierInsertError;
    const { error: memberInsertError } = await admin.from("partner_members").insert({
      partner_id: state.partnerId, user_id: promoter.id, member_role: "owner",
    });
    if (memberInsertError) throw memberInsertError;

    const { data: destination, error: destinationError } = await admin.from("naxa_payment_destinations").insert({
      canal: "orange_money", beneficiaire: "NAXA E2E — Destination non réelle",
      reference_destination: "E2E-REPLAY-NON-REEL",
      instructions: "Simulation automatisée Replay uniquement — aucun paiement réel.",
      actif: true, updated_by: adminProfile.id,
    }).select("id").single();
    if (destinationError) throw destinationError;
    state.paymentDestinationId = destination.id;
    saveState();

    const promoterClient = createClient(PROJECT_URL, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: "Bearer " + promoterSession.accessToken } },
    });
    const { data: submittedPaymentId, error: submitPaymentError } = await promoterClient.rpc("partner_soumettre_reglement_abonnement", {
      p_partner_id: state.partnerId, p_montant: 1, p_canal: "orange_money",
      p_compte_payeur: "E2E-REPLAY-NON-REEL",
      p_reference: "NAXA-E2E-REPLAY-" + RUN_LABEL,
      p_paye_le: new Date().toISOString(), p_preuve_path: null,
    });
    if (submitPaymentError) throw submitPaymentError;
    assert.ok(submittedPaymentId, "La déclaration de paiement partenaire n'a pas retourné d'identifiant.");
    state.paymentId = submittedPaymentId;
    saveState();

    const { data: pendingPayment, error: pendingPaymentError } = await admin.from("partner_subscription_payments")
      .select("status").eq("id", submittedPaymentId).single();
    if (pendingPaymentError) throw pendingPaymentError;
    assert.equal(pendingPayment.status, "pending", "Le règlement doit rester en attente avant décision Admin.");
    const { data: hiddenBeforePayment, error: hiddenBeforePaymentError } = await promoterClient.from("partners")
      .select("id").eq("id", state.partnerId).maybeSingle();
    if (hiddenBeforePaymentError) throw hiddenBeforePaymentError;
    assert.equal(hiddenBeforePayment, null, "Un partenaire sans paiement confirmé est visible.");

    const adminClient = createClient(PROJECT_URL, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: "Bearer " + adminSession.accessToken } },
    });
    const { error: confirmPaymentError } = await adminClient.rpc("admin_confirmer_reglement_partenaire", {
      p_reglement: submittedPaymentId, p_admin: adminProfile.id,
    });
    if (confirmPaymentError) throw confirmPaymentError;

    const [{ data: confirmedPayment, error: confirmedPaymentError }, { data: activeSubscription, error: activeSubscriptionError }, { data: visiblePartner, error: visiblePartnerError }] = await Promise.all([
      admin.from("partner_subscription_payments").select("status,confirmation_source,receipt_number").eq("id", submittedPaymentId).single(),
      admin.from("partner_subscriptions").select("status,first_confirmed_payment_at,period_start,due_date").eq("partner_id", state.partnerId).eq("status", "active").single(),
      promoterClient.from("partners").select("id,status").eq("id", state.partnerId).single(),
    ]);
    if (confirmedPaymentError) throw confirmedPaymentError;
    if (activeSubscriptionError) throw activeSubscriptionError;
    if (visiblePartnerError) throw visiblePartnerError;
    assert.equal(confirmedPayment.status, "confirmed", "Le règlement synthétique n'a pas été confirmé.");
    assert.equal(confirmedPayment.confirmation_source, "manual_admin", "Source Admin non enregistrée.");
    assert.ok(confirmedPayment.receipt_number, "Reçu partenaire absent.");
    assert.equal(activeSubscription.status, "active", "Cycle partenaire non activé.");
    assert.ok(activeSubscription.first_confirmed_payment_at, "Date du premier paiement confirmé absente.");
    assert.ok(activeSubscription.period_start && activeSubscription.due_date, "Bornes du cycle mensuel absentes.");
    assert.equal(visiblePartner.status, "active", "Partenaire payé non lisible sous JWT Promoteur.");
    console.log("PASS Partenaire — RPC déclaration, attente, confirmation Admin, reçu, cycle et garde RLS.");

    const partnerContext = await browserContext(browser, promoterSession, { width: 1440, height: 900 });
    const partnerPage = await partnerContext.newPage();
    partnerPage.setDefaultTimeout(15000);
    const partnerBackendErrors = [];
    partnerPage.on("response", (response) => {
      const url = response.url();
      if ((url.includes("/rest/v1/") || url.includes("/api/")) && response.status() >= 400) {
        partnerBackendErrors.push("HTTP " + response.status() + " " + url);
      }
    });
    partnerPage.on("pageerror", (error) => partnerBackendErrors.push("PAGEERROR " + error.message));
    await partnerPage.goto(BASE_URL + "/partenaire/catalogue", { waitUntil: "domcontentloaded" });
    await expectPath(partnerPage, "/partenaire/catalogue", "Ouverture du catalogue partenaire");
    const catalogueExamensLink = partnerPage.getByRole("link", { name: "Centres et examens", exact: true });
    await catalogueExamensLink.waitFor({ state: "visible" });
    await catalogueExamensLink.click();
    await expectPath(partnerPage, "/partenaire/examens", "Catalogue partenaire → Centres et examens");
    await partnerPage.getByRole("heading", { name: "Centres et examens", exact: true }).waitFor({ state: "visible" });
    await partnerPage.getByText("Créer la fiche de ton centre", { exact: true }).waitFor({ state: "visible" });
    await partnerPage.getByRole("textbox").first().waitFor({ state: "visible" });
    assert.deepEqual(partnerBackendErrors, [], "La recette Partenaire Examens a rencontré des erreurs API ou navigateur : " + partnerBackendErrors.join(" | "));
    console.log("PASS Partenaire Examens — session Promoteur, catalogue Examens et formulaire de création visibles, aucune erreur API/page.");

    await partnerPage.goto(BASE_URL + "/partenaire/reservations", { waitUntil: "domcontentloaded" });
    await expectPath(partnerPage, "/partenaire/reservations", "Ouverture des réservations partenaire");
    await partnerPage.getByRole("link", { name: "Centres et examens", exact: true }).waitFor({ state: "visible" });
    await partnerPage.getByRole("link", { name: "Centres et examens", exact: true }).click();
    await expectPath(partnerPage, "/partenaire/examens", "Réservations partenaire → Centres et examens");
    assert.deepEqual(partnerBackendErrors, [], "La navigation Partenaire Examens / réservations a rencontré des erreurs API ou navigateur : " + partnerBackendErrors.join(" | "));
    await partnerContext.close();

    // Client E2E : session d'un profil Client Replay déjà existant.
    // Les données panier/favori ci-dessous sont locales, marquées démo et supprimées par les actions UI.
    const clientDesktopContext = await browserContext(browser, clientSession, { width: 1440, height: 900 });
    const clientDesktopPage = await clientDesktopContext.newPage();
    clientDesktopPage.setDefaultTimeout(20000);
    await clientDesktopPage.goto(BASE_URL + "/client", { waitUntil: "domcontentloaded" });
    await expectPath(clientDesktopPage, "/client", "Ouverture espace Client desktop");
    await expectPageHeading(clientDesktopPage, "Espace Client desktop");
    await clientDesktopContext.close();
    console.log("PASS Client desktop — espace personnel rendu sous la session Client.");

    const clientContext = await browserContext(browser, clientSession, { width: 390, height: 844 });
    const clientPage = await clientContext.newPage();
    clientPage.setDefaultTimeout(20000);
    const clientPurchase400s = [];
    clientPage.on("pageerror", (error) => {
      console.error("CLIENT PAGEERROR — " + redactDiagnosticText(error.message));
      if (error.stack) console.error("CLIENT PAGEERROR STACK — " + redactDiagnosticText(error.stack));
    });
    clientPage.on("console", (message) => {
      if (message.type() === "error") console.error("CLIENT CONSOLE — " + redactDiagnosticText(message.text()));
    });
    clientPage.on("response", async (response) => {
      if (response.status() >= 400) {
        const request = response.request();
        const method = request.method();
        const safeUrl = diagnosticUrl(response.url());
        if (response.status() === 400) {
          let requestData = "[aucun corps de requête]";
          try {
            const postData = request.postData();
            if (postData) requestData = redactDiagnosticText(postData);
          } catch { requestData = "[corps de requête inaccessible]"; }
          const responseBody = await diagnosticResponseBody(response);
          if (safeUrl.includes("/rest/v1/client_achats")) clientPurchase400s.push(safeUrl + " — " + responseBody);
          console.error("CLIENT HTTP 400 DIAGNOSTIC — " + method + " " + safeUrl
            + " — resource=" + request.resourceType()
            + " — request=" + requestData
            + " — response=" + responseBody);
        } else if (response.status() >= 500) {
          console.error("CLIENT HTTP ERROR — " + response.status() + " " + method + " " + safeUrl);
        }
      }
    });
    clientPage.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText || "unknown";
      const line = "CLIENT REQUEST FAILED — " + request.method() + " " + diagnosticUrl(request.url()) + " — " + failure;
      if (failure.includes("ERR_ABORTED")) console.log("CLIENT REQUEST ABORTED (navigation/cancellation à qualifier) — " + line);
      else console.error(line);
    });
    const clientResponse = await clientPage.goto(BASE_URL + "/client", { waitUntil: "domcontentloaded" });
    const clientCookies = await clientContext.cookies(BASE_URL);
    console.log("INFO Client route — HTTP " + (clientResponse?.status() ?? "none") + ", URL " + clientPage.url()
      + ", cookies " + JSON.stringify(clientCookies.map(cookie => ({ name: cookie.name, value: cookie.name === "naxa-age-status-v2" ? cookie.value : "[masked]" }))));
    await expectPath(clientPage, "/client", "Ouverture espace Client");
    await expectPageHeading(clientPage, "Espace Client");
    // Le Provider lit localStorage au premier montage : injecter la fixture avant
    // la toute première navigation, et ne la réinitialiser qu'une seule fois par onglet.
    await clientPage.addInitScript(() => {
      if (window.sessionStorage.getItem("naxa-e2e-panier-seeded") === "1") return;
      window.localStorage.setItem("naxa-favoris-v1", JSON.stringify([{
        id: "naxa-e2e-ui-favori-local",
        nom: "Article local de recette",
        dosage: "1 unité",
        photo_url: null,
        prix: 1000,
        pharmacie: "Fixture locale isolée",
        demo: true,
        savedAt: Date.now()
      }]));
      window.localStorage.setItem("naxa-panier-v1", JSON.stringify([
        {
          produit_id: "naxa-e2e-ui-panier-local",
          nom: "Article local de recette",
          dosage: "1 unité",
          quantite: 1,
          type_article: "medicament",
          owner_type: "pharmacie",
          owner_id: "11111111-1111-4111-8111-111111111111",
          pharmacie_id: "11111111-1111-4111-8111-111111111111",
          pharmacie_nom: "Pharmacie E2E A",
          prix_unitaire_fcfa: 1000,
          quantite_max: 10
        },
        {
          produit_id: "naxa-e2e-ui-panier-local",
          nom: "Article local de recette",
          dosage: "1 unité",
          quantite: 1,
          type_article: "medicament",
          owner_type: "pharmacie",
          owner_id: "22222222-2222-4222-8222-222222222222",
          pharmacie_id: "22222222-2222-4222-8222-222222222222",
          pharmacie_nom: "Pharmacie E2E B",
          prix_unitaire_fcfa: 1200,
          quantite_max: 10
        }
      ]));
      window.sessionStorage.setItem("naxa-e2e-panier-seeded", "1");
    });

    await clientPage.goto(BASE_URL + "/client/profil/favoris", { waitUntil: "domcontentloaded" });
    await expectPath(clientPage, "/client/profil/favoris", "Client → Favoris");
    await clientPage.getByRole("heading", { name: "Mes favoris", exact: true }).first().waitFor({ state: "visible" });
    await clientPage.getByText("Article local de recette", { exact: true }).waitFor({ state: "visible" });
    await clientPage.getByRole("button", { name: "Retirer Article local de recette des favoris", exact: true }).click();
    await clientPage.getByText("Votre liste est encore vide", { exact: true }).waitFor({ state: "visible" });
    console.log("PASS Client — affichage et retrait UI d'un favori local démo (aucune écriture métier).");

    await clientPage.goto(BASE_URL + "/panier", { waitUntil: "domcontentloaded" });
    await expectPath(clientPage, "/panier", "Client → Panier");
    await clientPage.locator("main h1").filter({ hasText: /^Mon panier$/ }).waitFor({ state: "visible" });
    const pharmacyA = clientPage.locator("article.carte").filter({
      has: clientPage.getByRole("heading", { name: "Pharmacie · Pharmacie E2E A", exact: true })
    });
    const pharmacyB = clientPage.locator("article.carte").filter({
      has: clientPage.getByRole("heading", { name: "Pharmacie · Pharmacie E2E B", exact: true })
    });
    await pharmacyA.waitFor({ state: "visible" });
    await pharmacyB.waitFor({ state: "visible" });
    await pharmacyA.getByRole("button", { name: "+", exact: true }).click();
    await pharmacyA.locator("li output").filter({ hasText: /^2$/ }).waitFor({ state: "visible" });
    await pharmacyB.locator("li output").filter({ hasText: /^1$/ }).waitFor({ state: "visible" });
    await pharmacyA.getByRole("button", { name: "Retirer", exact: true }).click();
    await pharmacyA.waitFor({ state: "detached" });
    await pharmacyB.locator("li output").filter({ hasText: /^1$/ }).waitFor({ state: "visible" });
    await pharmacyB.getByRole("button", { name: "Retirer", exact: true }).click();
    await clientPage.getByText("Votre panier est vide.", { exact: true }).waitFor({ state: "visible" });
    console.log("PASS Client — même produit, deux propriétaires : quantité et retrait isolés par pharmacie.");

    await clientPage.goto(BASE_URL + "/resultats?q=paracetamol", { waitUntil: "domcontentloaded" });
    await expectPath(clientPage, "/resultats", "Client → Recherche Marketplace");
    await clientPage.getByRole("textbox", { name: "Médicament recherché" }).waitFor({ state: "visible" });
    await clientPage.locator('[aria-label="Filtres de recherche"]').waitFor({ state: "visible" });
    await clientPage.getByRole("combobox", { name: "Filtrer par ville" }).selectOption("Yaoundé");
    await clientPage.getByRole("button", { name: /Assurance/ }).click();
    await clientPage.locator("#assurance-options").waitFor({ state: "visible" });
    console.log("PASS Client — recherche Marketplace, filtre ville et panneau Assurance interactifs.");

    // Lot B2 positif : offre réelle Replay, favori persistant, réservation et annulation Client.
    const b2Client = createClient(PROJECT_URL, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: "Bearer " + clientSession.accessToken } },
    });
    const b2Fixture = await prepareClientMarketplaceFixture(partnerOwner, b2Client);
    const b2SearchUrl = BASE_URL + "/resultats?bulk=1&q=" + encodeURIComponent("crédit comptoir") + "&n=" + String(b2Fixture.quantity);
    const b2SearchTrace = [];
    const b2MetadataTrace = [];
    clientPage.on("response", async (response) => {
      const request = response.request();
      if (response.url().includes("/rest/v1/rpc/search_pharmacies_bulk")) {
        let body = null;
        let requestBody = null;
        try { body = await response.json(); } catch {}
        try { requestBody = request.postDataJSON(); } catch {}
        b2SearchTrace.push({
          status: response.status(),
          request: requestBody && {
            p_terms: requestBody.p_terms,
            p_quantities: requestBody.p_quantities,
            p_lat: requestBody.p_lat,
            p_lng: requestBody.p_lng,
            p_rayon_km: requestBody.p_rayon_km,
          },
          body: Array.isArray(body) ? body.map((row) => ({
            pharmacie_id: row.pharmacie_id,
            nom: row.nom,
            distance_km: row.distance_km,
            trouves: row.trouves,
            demandes: row.demandes,
          })) : body,
        });
      }
      if (response.url().includes("/rest/v1/pharmacies?")) {
        let body = null;
        try { body = await response.json(); } catch {}
        b2MetadataTrace.push({
          status: response.status(),
          body: Array.isArray(body) ? body.map((row) => ({
            id: row.id, nom: row.nom, actif: row.actif,
            est_demo: row.est_demo, visible_recherche: row.visible_recherche,
            archivee_le: row.archivee_le, ville: row.ville,
          })) : body,
        });
      }
    });
    await clientPage.goto(b2SearchUrl, { waitUntil: "domcontentloaded" });
    await expectPath(clientPage, "/resultats", "Lot B2 → recherche de l'offre réelle Replay");
    // Attendre l'effet client de chargement des assureurs : le simple DOMContentLoaded
    // ne garantit pas que l'hydratation React ait terminé avant les interactions Playwright.
    await clientPage.waitForResponse((response) =>
      response.url().includes("/rest/v1/marketplace_assureurs?")
      && response.status() === 200, { timeout: 15000 });
    b2SearchTrace.length = 0;
    b2MetadataTrace.length = 0;
    // Utiliser le sélecteur principal de localité : il synchronise ville, coordonnées
    // et statut de localisation, contrairement au filtre secondaire qui ne règle que la ville.
    const b2CitySelect = clientPage.locator("#naxa-ville");
    await b2CitySelect.waitFor({ state: "visible" });
    const initialB2City = await b2CitySelect.inputValue();
    const expectedB2Search = clientPage.waitForResponse((response) => {
      if (!response.url().includes("/rest/v1/rpc/search_pharmacies_bulk")) return false;
      try {
        const body = response.request().postDataJSON();
        return Number(body.p_lat) === 3.848
          && Number(body.p_lng) === 11.5021
          && Number(body.p_rayon_km) === 35;
      } catch {
        return false;
      }
    }, { timeout: 20000 }).then(
      (response) => ({ response }),
      (error) => ({ error })
    );
    await b2CitySelect.selectOption("Yaoundé");
    await expect(b2CitySelect).toHaveValue("Yaoundé");
    await expect(clientPage.locator('select[aria-label="Filtrer par ville"]')).toHaveValue("Yaoundé");
    const expectedB2SearchResult = await expectedB2Search;
    if (expectedB2SearchResult.error) {
      throw new Error(
        "Réponse RPC bulk Yaoundé absente après sélection de la localité "
        + "(valeur initiale=" + JSON.stringify(initialB2City)
        + ", valeur finale=" + JSON.stringify(await b2CitySelect.inputValue().catch(() => "page fermée"))
        + ") : " + expectedB2SearchResult.error.message
      );
    }
    const b2SearchResponse = expectedB2SearchResult.response;
    assert.equal(b2SearchResponse.status(), 200, "Le RPC bulk Yaoundé doit répondre HTTP 200.");
    const b2SearchBody = await b2SearchResponse.json();
    assert.ok(Array.isArray(b2SearchBody) && b2SearchBody.some((row) =>
      row.pharmacie_id === MARKETPLACE_PHARMACY_ID
      && row.trouves === 1 && row.demandes === 1
    ), "Le RPC bulk Yaoundé n'a pas retourné l'offre Replay attendue après sélection de la localité.");
    const b2OfferCard = clientPage.locator("article").filter({ hasText: MARKETPLACE_PHARMACY_NAME }).first();
    try {
      await b2OfferCard.waitFor({ state: "visible", timeout: 30000 });
    } catch (error) {
      const mainText = await clientPage.locator("main").innerText().catch(() => "");
      console.error("TRACE B2 recherche bulk — " + JSON.stringify({
        url: clientPage.url(), rpc: b2SearchTrace, metadata: b2MetadataTrace,
        mainText: mainText.slice(0, 5000)
      }));
      throw error;
    }
    await b2OfferCard.getByText(MARKETPLACE_PRODUCT_NAME, { exact: false }).waitFor({ state: "visible" });
    await b2OfferCard.getByRole("button", { name: "Ajouter " + MARKETPLACE_PRODUCT_NAME + " aux favoris", exact: true }).click();
    state.marketplaceFavoriteCreated = true;
    saveState();
    const favoriteRow = await waitForClientFavorite(b2Client, true);
    assert.ok(favoriteRow && favoriteRow.demo === false, "Le favori n'est pas persisté comme offre réelle.");
    await clientPage.goto(BASE_URL + "/client/profil/favoris", { waitUntil: "domcontentloaded" });
    await expectPath(clientPage, "/client/profil/favoris", "Lot B2 → favoris persistants du Client");
    await clientPage.locator("main h1").filter({ hasText: "Mes favoris" }).waitFor({ state: "visible" });
    await clientPage.getByText(MARKETPLACE_PRODUCT_NAME, { exact: true }).waitFor({ state: "visible" });
    await clientPage.getByRole("button", {
      name: "Retirer " + MARKETPLACE_PRODUCT_NAME + " des favoris", exact: true,
    }).click();
    await clientPage.getByText("Votre liste est encore vide", { exact: true }).waitFor({ state: "visible" });
    await waitForClientFavorite(b2Client, false);
    console.log("PASS Lot B2 — offre Marketplace réelle, favori synchronisé en base puis retrait confirmé.");

    await clientPage.goto(b2SearchUrl, { waitUntil: "domcontentloaded" });
    await expectPath(clientPage, "/resultats", "Lot B2 → retour à l'offre Marketplace");
    await clientPage.locator('select[aria-label="Filtrer par ville"]').selectOption("Yaoundé");
    const b2ReservationCard = clientPage.locator("article").filter({ hasText: MARKETPLACE_PHARMACY_NAME }).first();
    await b2ReservationCard.waitFor({ state: "visible", timeout: 30000 });
    await b2ReservationCard.getByRole("button", { name: "Continuer avec cette pharmacie", exact: true }).click();
    await expectPath(clientPage, "/commande/nouvelle", "Lot B2 → panier réel lié à la pharmacie");
    await clientPage.getByRole("heading", { name: MARKETPLACE_PHARMACY_NAME, exact: true }).waitFor({ state: "visible" });
    await clientPage.getByRole("button", { name: "Confirmer", exact: true }).click();
    await clientPage.getByRole("heading", { name: "C’est enregistré", exact: true }).waitFor({ state: "visible", timeout: 30000 });
    const followLink = clientPage.locator('a[href^="/reservation/"]').filter({ hasText: "Ouvrir le suivi" }).first();
    const followHref = await followLink.getAttribute("href");
    assert.ok(followHref, "Lien de suivi de réservation absent.");
    const reservationId = followHref.split("/").filter(Boolean).pop();
    assert.ok(reservationId, "Identifiant de réservation absent.");
    state.marketplaceReservationId = reservationId;
    saveState();

    const { data: reservation, error: reservationError } = await b2Client.from("reservations")
      .select("id,client_id,pharmacie_id,statut,mode,total").eq("id", reservationId).maybeSingle();
    if (reservationError) throw reservationError;
    assert.ok(reservation, "Réservation non lisible sous le JWT Client.");
    assert.equal(reservation.client_id, partnerOwner.id);
    assert.equal(reservation.pharmacie_id, MARKETPLACE_PHARMACY_ID);
    assert.equal(reservation.statut, "en_attente");
    assert.equal(reservation.mode, "reservation");
    assert.equal(Number(reservation.total), 1000 * b2Fixture.quantity);
    const { data: reservationItems, error: itemsError } = await b2Client.from("reservation_items")
      .select("reservation_id,produit_id,quantite,prix_unitaire").eq("reservation_id", reservationId);
    if (itemsError) throw itemsError;
    assert.ok((reservationItems || []).some(item => item.produit_id === MARKETPLACE_PRODUCT_ID
      && Number(item.quantite) === b2Fixture.quantity && Number(item.prix_unitaire) === 1000),
    "La ligne de réservation ne correspond pas à la sélection Marketplace.");
    const afterHold = await marketplaceAvailableQuantity();
    assert.equal(afterHold, b2Fixture.available - b2Fixture.quantity);
    assert.ok(afterHold < b2Fixture.quantity,
      "La fixture B2 doit laisser moins que la quantité demandée après le hold Client A.");

    // Un second Client vérifie immédiatement que le stock restant ne permet plus
    // de finaliser la même quantité dans cette pharmacie.
    const unavailableContext = await browserContext(browser, clientBSession, { width: 1440, height: 900 });
    try {
      const unavailablePage = await unavailableContext.newPage();
      unavailablePage.setDefaultTimeout(20000);
      await unavailablePage.goto(b2SearchUrl, { waitUntil: "domcontentloaded" });
      await expectPath(unavailablePage, "/resultats", "Lot B2 → contrôle d'indisponibilité Client B");
      await unavailablePage.locator('select[aria-label="Filtrer par ville"]').selectOption("Yaoundé");
      await unavailablePage.locator('[role="status"]').filter({ hasText: "Aucune pharmacie" })
        .first().waitFor({ state: "visible" });
      const unavailableCard = unavailablePage.locator("article")
        .filter({ hasText: MARKETPLACE_PHARMACY_NAME }).first();
      if (await unavailableCard.count()) {
        await unavailableCard.getByText(
          "Sélection incomplète : quantité insuffisante ou médicament non trouvé. Aucun ajout groupé possible.",
          { exact: true }
        ).waitFor({ state: "visible" });
        assert.equal(
          await unavailableCard.getByRole("button", { name: "Continuer avec cette pharmacie", exact: true }).count(),
          0,
          "Le Client B ne doit pas pouvoir continuer avec une quantité devenue insuffisante."
        );
      }
      console.log("PASS Lot B2 — Client B ne peut pas finaliser la quantité demandée pendant le hold du Client A.");
    } finally {
      await unavailableContext.close();
    }

    // Décision réelle de la pharmacie : le Gestionnaire Stock confirme sous son propre JWT.
    const stockContext = await browserContext(browser, stockManagerSession, { width: 1440, height: 900 });
    const stockPage = await stockContext.newPage();
    stockPage.setDefaultTimeout(20000);
    await stockPage.goto(BASE_URL + "/pharmacie/gestionnaire-stock/reservations?reservation=" + reservationId,
      { waitUntil: "domcontentloaded" });
    await expectPath(stockPage, "/pharmacie/gestionnaire-stock/reservations",
      "Lot B2 → file des réservations du Gestionnaire de stock");
    await stockPage.getByRole("heading", { name: "Réservations Marketplace", exact: true }).waitFor({ state: "visible" });
    const stockReservationCard = stockPage.locator("article").filter({
      hasText: reservationId.slice(0, 8).toUpperCase(),
    });
    await stockReservationCard.waitFor({ state: "visible" });
    await stockReservationCard.getByRole("button", {
      name: "Confirmer disponibilité et préparer", exact: true,
    }).click();
    await stockPage.getByText(
      "Réservation confirmée. Le dossier est transmis au parcours de préparation et de retrait.",
      { exact: true }
    ).waitFor({ state: "visible" });
    const { data: pharmacyConfirmed, error: pharmacyConfirmedError } = await admin.from("reservations")
      .select("id,statut").eq("id", reservationId).maybeSingle();
    if (pharmacyConfirmedError) throw pharmacyConfirmedError;
    assert.equal(pharmacyConfirmed?.statut, "confirmee",
      "La décision du Gestionnaire de stock n'a pas été persistée.");
    await stockContext.close();
    console.log("PASS Lot B2 — décision pharmacie depuis l'espace Gestionnaire de stock, JWT et périmètre de l'affectation.");

    await clientPage.goto(BASE_URL + "/reservation/" + reservationId, { waitUntil: "domcontentloaded" });
    await expectPath(clientPage, "/reservation/" + reservationId, "Lot B2 → suivi de réservation Client");
    await clientPage.getByText("Statut : Confirmée par la pharmacie", { exact: true }).waitFor({ state: "visible" });
    await clientPage.getByRole("button", { name: "Annuler la réservation", exact: true }).click();
    await clientPage.getByText("Cette transaction est annulée.", { exact: true }).waitFor({ state: "visible" });
    const { data: cancelled, error: cancelledError } = await b2Client.from("reservations")
      .select("id,statut").eq("id", reservationId).maybeSingle();
    if (cancelledError) throw cancelledError;
    assert.equal(cancelled?.statut, "annulee");
    const afterCancel = await marketplaceAvailableQuantity();
    assert.equal(afterCancel, b2Fixture.available, "L'annulation n'a pas restauré exactement le stock disponible.");

    await clientPage.goto(BASE_URL + "/client/historique", { waitUntil: "domcontentloaded" });
    await expectPath(clientPage, "/client/historique", "Lot B2 → historique réel du Client");
    await clientPage.locator("#history-period").selectOption("all");
    await clientPage.locator("#history-search").fill(reservationId);
    const historyEntry = clientPage.locator("li.carte").filter({ hasText: reservationId.slice(0, 8).toUpperCase() });
    await historyEntry.waitFor({ state: "visible" });
    await historyEntry.getByText("Annulée", { exact: true }).waitFor({ state: "visible" });
    await historyEntry.getByRole("link", { name: "Ouvrir le suivi", exact: true }).waitFor({ state: "visible" });
    console.log("PASS Lot B2 — recherche et favori persistants, réservation Client, confirmation Gestionnaire Stock, annulation Client, stock restauré=" + b2Fixture.available + ", historique Annulée.");


    await clientPage.goto(BASE_URL + "/client/historique", { waitUntil: "domcontentloaded" });
    await expectPath(clientPage, "/client/historique", "Client → Historique");
    await clientPage.getByRole("heading", { name: "Historique", exact: true }).waitFor({ state: "visible" });
    await clientPage.locator("#history-period").selectOption("all");
    await clientPage.locator("#history-search").fill("aucune commande E2E");
    await clientPage.getByText("Aucun élément ne correspond à ces critères.", { exact: true }).waitFor({ state: "visible" });
    await clientPage.waitForTimeout(1200);
    assert.deepEqual(clientPurchase400s, [], "La vue client_achats a retourné une erreur HTTP 400 : " + clientPurchase400s.join(" | "));
    console.log("PASS Client — historique, filtre de période, recherche, B2 persistant et absence de HTTP 400 sur client_achats.");
    await clientContext.close();

    console.log("RESULTAT NAVIGATION : PASS — Promoteur desktop/mobile, 6 entrées Comptable, Partenaire, Client desktop/mobile et Lot B2 positif (favori persistant, recherche réelle, réservation, annulation, stock, historique).");
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
