"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const { chromium } = require("playwright");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const PROJECT_URL = "https://" + PROJECT_REF + ".supabase.co";
const BASE_URL = (process.env.NAXA_E2E_WEB_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const STATE_FILE = path.join(process.env.RUNNER_TEMP || "/tmp", "naxa-support-livechat-e2e.json");
const CLIENT_USERNAME = "naxa_e2e_acheteur";
const ADMIN_USERNAME = "e2e_admin_261104";

function required(value, name) {
  assert.ok(value && String(value).trim(), "Secret Replay manquant : " + name);
  return value;
}

const supabaseUrl = required(process.env.NAXA_STORAGE_E2E_URL, "NAXA_STORAGE_E2E_URL");
const anonKey = required(process.env.NAXA_STORAGE_E2E_ANON_KEY, "NAXA_STORAGE_E2E_ANON_KEY");
const adminKey = required(process.env.NAXA_STORAGE_E2E_ADMIN_KEY, "NAXA_STORAGE_E2E_ADMIN_KEY");
assert.equal(new URL(supabaseUrl).origin, PROJECT_URL, "Sécurité : la recette est strictement limitée à Replay.");

const admin = createClient(PROJECT_URL, adminKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

let state = { ticketId: null, attachmentPaths: [] };
function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state), { mode: 0o600 });
}

async function cleanup() {
  if (!state.ticketId) {
    if (fs.existsSync(STATE_FILE)) {
      try { state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { /* état incomplet */ }
    }
  }
  if (!state.ticketId) {
    console.log("CLEANUP — aucun ticket de recette à supprimer.");
    return;
  }
  const { data: messages, error: readError } = await admin.from("messages_support")
    .select("id,piece_jointe_path").eq("ticket_id", state.ticketId);
  if (readError) throw readError;
  const paths = [...new Set([...(state.attachmentPaths || []), ...(messages || []).map(x => x.piece_jointe_path).filter(Boolean)])];
  if (paths.length) {
    const { error } = await admin.storage.from("naxa-support-attachments").remove(paths);
    if (error) throw error;
  }
  const { error: notificationError } = await admin.from("notifications").delete().eq("related_entity_id", state.ticketId);
  if (notificationError) throw notificationError;
  const { error: messageError } = await admin.from("messages_support").delete().eq("ticket_id", state.ticketId);
  if (messageError) throw messageError;
  const { error: ticketError } = await admin.from("tickets_support").delete().eq("id", state.ticketId);
  if (ticketError) throw ticketError;
  const { data: remaining, error: verifyError } = await admin.from("tickets_support").select("id").eq("id", state.ticketId);
  if (verifyError) throw verifyError;
  assert.equal((remaining || []).length, 0, "Le ticket E2E doit être supprimé après recette.");
  state = { ticketId: null, attachmentPaths: [] };
  try { fs.unlinkSync(STATE_FILE); } catch { /* absent */ }
  console.log("CLEANUP PASS — ticket, messages, notifications et objets Storage de recette supprimés de Replay.");
}

async function sessionFor(username, expectedRole) {
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,username,role,actif,age_verified").eq("username", username).single();
  if (profileError) throw profileError;
  assert.equal(profile.role, expectedRole, "Rôle inattendu pour " + username);
  assert.equal(profile.actif, true, "Profil inactif : " + username);
  if (expectedRole === "client") assert.equal(profile.age_verified, true, "Client sans déclaration d'âge.");
  const { data: authData, error: authError } = await admin.auth.admin.getUserById(profile.id);
  if (authError) throw authError;
  const user = authData.user;
  assert.ok(user?.email && user.email_confirmed_at, "Identité Auth confirmée manquante : " + username);
  assert.ok(String(user.user_metadata?.naxa_e2e_fixture || "").startsWith("NAXA-E2E-"),
    "Le marqueur de compte de recette est absent : " + username);

  const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink", email: user.email,
  });
  if (linkError) throw linkError;
  const tokenHash = generated?.properties?.hashed_token;
  assert.ok(tokenHash, "Lien Auth ponctuel non généré pour " + username);

  const cookieJar = new Map();
  const ssr = createServerClient(PROJECT_URL, anonKey, {
    cookies: {
      getAll: () => Array.from(cookieJar.values()).map(({ name, value }) => ({ name, value })),
      setAll: (cookies) => { for (const cookie of cookies) cookieJar.set(cookie.name, cookie); },
    },
  });
  const { data: verified, error: verifyError } = await ssr.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (verifyError) throw verifyError;
  assert.ok(verified.session?.access_token && cookieJar.size, "Session SSR absente pour " + username);
  return { profile, accessToken: verified.session.access_token, cookies: Array.from(cookieJar.values()) };
}

function cookiesFor(baseUrl, session) {
  const hostname = new URL(baseUrl).hostname;
  return session.cookies.map(cookie => {
    const opts = cookie.options || {};
    const same = String(opts.sameSite || "lax").toLowerCase();
    const item = {
      name: cookie.name, value: cookie.value, domain: hostname, path: "/",
      httpOnly: Boolean(opts.httpOnly), secure: new URL(baseUrl).protocol === "https:",
      sameSite: same === "strict" ? "Strict" : same === "none" ? "None" : "Lax",
    };
    if (opts.expires instanceof Date) item.expires = opts.expires.getTime() / 1000;
    else if (typeof opts.maxAge === "number" && opts.maxAge > 0) item.expires = Math.floor(Date.now() / 1000) + opts.maxAge;
    return item;
  });
}

async function makeContext(browser, session, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addCookies(cookiesFor(BASE_URL, session));
  await context.addCookies([{
    name: "naxa-age-status-v2", value: "adult", domain: new URL(BASE_URL).hostname,
    path: "/", httpOnly: false, secure: false, sameSite: "Lax",
  }]);
  await context.addInitScript(() => {
    try { localStorage.setItem("naxa-age-declaration-v1", JSON.stringify({ confirmed: true, at: Date.now() })); } catch {}
  });
  return context;
}

async function waitForText(locator, text, label, timeout = 20000) {
  await locator.getByText(text, { exact: true }).waitFor({ state: "visible", timeout });
  console.log("PASS — " + label);
}

async function run() {
  const [clientSession, adminSession] = await Promise.all([
    sessionFor(CLIENT_USERNAME, "client"),
    sessionFor(ADMIN_USERNAME, "admin"),
  ]);
  const clientCheck = createClient(PROJECT_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: "Bearer " + clientSession.accessToken } },
  });
  const [{ data: authUser, error: authError }, { data: activeRole, error: roleError }] = await Promise.all([
    clientCheck.auth.getUser(clientSession.accessToken),
    clientCheck.rpc("naxa_business_function"),
  ]);
  if (authError) throw authError;
  if (roleError) throw roleError;
  assert.equal(authUser.user.id, clientSession.profile.id);
  assert.equal(activeRole, "client");
  console.log("PASS — deux identités Replay existantes vérifiées : Client actif et Admin actif.");

  let browser;
  let clientContext;
  let adminContext;
  let clientPage;
  let adminPage;
  let createdTicketId = null;
  const subject = "E2E Livechat " + Date.now();
  const firstMessage = "Premier message Client — " + subject;
  const adminReply = "Réponse Admin temps réel — " + subject;
  const clientReply = "Réponse Client temps réel — " + subject;
  const reconnectReply = "Réponse après reconnexion — " + subject;

  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    clientContext = await makeContext(browser, clientSession, { width: 390, height: 844 });
    adminContext = await makeContext(browser, adminSession, { width: 1440, height: 1000 });
    clientPage = await clientContext.newPage();
    adminPage = await adminContext.newPage();

    await clientPage.goto(BASE_URL + "/client", { waitUntil: "domcontentloaded" });
    const trigger = clientPage.getByRole("button", { name: "Ouvrir le livechat NAXA" });
    await trigger.waitFor({ state: "visible", timeout: 30000 });
    await trigger.click();
    const dialog = clientPage.getByRole("dialog", { name: "Livechat avec l’équipe NAXA" });
    await dialog.waitFor({ state: "visible" });
    await dialog.getByRole("button", { name: "Écrire à NAXA", exact: true }).click();
    await dialog.getByLabel("Sujet").fill(subject);
    await dialog.getByLabel("Ton premier message").fill(firstMessage);
    await dialog.getByRole("button", { name: "Démarrer la conversation" }).click();
    await dialog.getByText(subject, { exact: false }).waitFor({ state: "visible", timeout: 30000 });

    const { data: created, error: ticketError } = await admin.from("tickets_support")
      .select("id,reference_code,statut,type,auteur_profile_id").eq("auteur_profile_id", clientSession.profile.id)
      .eq("sujet", subject).eq("type", "support_naxa").single();
    if (ticketError) throw ticketError;
    assert.equal(created.statut, "ouvert");
    assert.equal(created.auteur_profile_id, clientSession.profile.id);
    createdTicketId = created.id;
    state.ticketId = createdTicketId;
    saveState();
    console.log("PASS — le Client ouvre une conversation réelle via le widget.");

    await adminPage.goto(BASE_URL + "/admin/messagerie", { waitUntil: "domcontentloaded" });
    await adminPage.getByRole("heading", { name: "Messagerie", exact: true }).waitFor({ state: "visible", timeout: 30000 });
    const ticketButton = adminPage.getByRole("button").filter({ hasText: subject }).first();
    await ticketButton.waitFor({ state: "visible", timeout: 30000 });
    await ticketButton.click();
    await waitForText(adminPage, firstMessage, "création du ticket reçue dans la boîte Admin");
    await adminPage.getByLabel("Répondre au ticket").fill(adminReply);
    await adminPage.getByRole("button", { name: "Envoyer la réponse" }).click();
    await waitForText(dialog, adminReply, "réponse Admin reçue en direct par le Client");

    await dialog.getByLabel("Votre message").fill(clientReply);
    await dialog.getByRole("button", { name: "Envoyer le message" }).click();
    await waitForText(adminPage, clientReply, "réponse Client reçue en direct dans la boîte Admin");

    await clientPage.goto(BASE_URL + "/assistance?ticket=" + createdTicketId, { waitUntil: "domcontentloaded" });
    await clientPage.getByRole("heading", { name: "Écrire à l’équipe NAXA" }).waitFor({ state: "visible", timeout: 30000 });
    await clientPage.getByLabel("Répondre à l’équipe NAXA").fill("Document de preuve E2E — " + subject);
    await clientPage.getByLabel("Joindre un fichier (facultatif)").setInputFiles({
      name: "preuve-livechat.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"),
    });
    await clientPage.getByRole("button", { name: "Envoyer ma réponse" }).click();
    await clientPage.getByText("preuve-livechat.pdf", { exact: false }).waitFor({ state: "visible", timeout: 30000 });
    const { data: attachmentMessage, error: attachmentError } = await admin.from("messages_support")
      .select("piece_jointe_path,piece_jointe_nom,piece_jointe_taille").eq("ticket_id", createdTicketId)
      .eq("piece_jointe_nom", "preuve-livechat.pdf").single();
    if (attachmentError) throw attachmentError;
    assert.ok(attachmentMessage.piece_jointe_path && attachmentMessage.piece_jointe_taille > 0);
    state.attachmentPaths.push(attachmentMessage.piece_jointe_path);
    saveState();
    console.log("PASS — pièce jointe PDF chargée, enregistrée en privé et reliée au message.");

    await clientPage.getByRole("button", { name: "Fermer le livechat" }).click().catch(() => {});
    await clientPage.goto(BASE_URL + "/client", { waitUntil: "domcontentloaded" });
    const reopenedTrigger = clientPage.getByRole("button", { name: "Ouvrir le livechat NAXA" });
    await reopenedTrigger.waitFor({ state: "visible", timeout: 30000 });
    await reopenedTrigger.click();
    const activeDialog = clientPage.getByRole("dialog", { name: "Livechat avec l’équipe NAXA" });
    await activeDialog.getByText("Temps réel actif", { exact: false }).waitFor({ state: "visible", timeout: 30000 });

    await adminPage.getByRole("button", { name: "Marquer résolue" }).click();
    await waitForText(activeDialog, "Résolue", "statut Résolue synchronisé vers le Client");
    await activeDialog.getByLabel("Votre message").fill("Réouverture par réponse Client — " + subject);
    await activeDialog.getByRole("button", { name: "Envoyer le message" }).click();
    await waitForText(activeDialog, "En cours", "réponse Client rouvre un ticket résolu");

    await adminPage.getByRole("button", { name: "Clôturer" }).click();
    await waitForText(activeDialog, "Clôturée", "clôture Admin synchronisée vers le Client");
    await activeDialog.getByText("Cette conversation est clôturée.", { exact: true }).waitFor({ state: "visible" });
    assert.equal(await activeDialog.getByLabel("Votre message").count(), 0, "Un ticket fermé ne doit plus proposer de réponse.");

    await adminPage.getByRole("button", { name: "Réouvrir" }).click();
    await waitForText(activeDialog, "En cours", "réouverture Admin synchronisée vers le Client");

    // Déconnexion réseau puis reconnexion du contexte Client : le canal doit se réabonner.
    await clientContext.setOffline(true);
    await clientPage.waitForTimeout(1200);
    await clientContext.setOffline(false);
    await activeDialog.getByText("● Temps réel actif", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
    await adminPage.getByLabel("Répondre au ticket").fill(reconnectReply);
    await adminPage.getByRole("button", { name: "Envoyer la réponse" }).click();
    await waitForText(activeDialog, reconnectReply, "message Admin reçu après reconnexion Realtime");

    const { data: notificationRows, error: notificationError } = await admin.from("notifications")
      .select("user_id,type,related_entity_id").eq("related_entity_id", createdTicketId);
    if (notificationError) throw notificationError;
    const types = new Set((notificationRows || []).map(row => row.type));
    assert.ok(types.has("support_naxa_nouvelle_demande"), "Notification Admin de création absente.");
    assert.ok(types.has("support_naxa_nouveau_message"), "Notification Admin de réponse Client absente.");
    assert.ok(types.has("support_naxa_reponse"), "Notification Client de réponse Admin absente.");
    assert.ok(types.has("support_naxa_statut"), "Notification Client de changement de statut absente.");
    console.log("PASS — notifications Admin/Client de création, réponses et statuts vérifiées.");

    await activeDialog.getByRole("button", { name: "Fermer le livechat" }).click();
    await clientPage.goto(BASE_URL + "/aide", { waitUntil: "domcontentloaded" });
    await clientPage.getByRole("heading", { name: "Parler gratuitement à une pharmacie" }).waitFor({ state: "visible", timeout: 30000 });
    await clientPage.getByRole("heading", { name: "Nouvelle conversation", exact: true }).waitFor({ state: "visible" });
    await clientPage.getByLabel("Pharmacie").waitFor({ state: "visible" });
    await clientPage.getByRole("button", { name: "Ouvrir le livechat NAXA" }).waitFor({ state: "visible" });
    console.log("PASS — non-régression /aide : chat pharmacie disponible et widget Assistance NAXA distinct.");

    console.log("RÉSULTAT — R09-10 navigateur Client ↔ Admin : PASS sur Replay.");
  } finally {
    if (clientContext) await clientContext.close().catch(() => {});
    if (adminContext) await adminContext.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (createdTicketId) {
      state.ticketId = createdTicketId;
      saveState();
    }
    await cleanup();
  }
}

if (process.argv.includes("--cleanup")) {
  cleanup().catch(error => { console.error("CLEANUP FAIL — " + error.message); process.exitCode = 1; });
} else {
  run().catch(error => { console.error("R09-10 FAIL — " + (error.stack || error.message)); process.exitCode = 1; });
}
