#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const webpush = require("web-push");
const { chromium } = require("playwright");
const {
  sumLotQuantities,
  assertStockLotBalance,
  buildStockPayload,
  buildStockRestorePayload,
  restErrorSummary,
} = require("./expiry-stock-aggregate.cjs");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const TEST_PHARMACY_SLUG = "naxa-e2e-expiry-replay-20261115";
const PRODUCT_NAME = "Amlodipine NAXA Test";
const ORIGIN = process.env.NAXA_E2E_PUSH_ORIGIN || "http://127.0.0.1:3000";

function assertReplayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL Supabase invalide."); }
  if (url.protocol !== "https:" || url.hostname !== PROJECT_REF + ".supabase.co" || !["", "/"].includes(url.pathname)) {
    throw new Error("Sécurité : le test push est limité à Replay.");
  }
  return url.origin;
}

function localCameroonDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(item => [item.type, item.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function addDays(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

async function run(env = process.env) {
  const baseUrl = assertReplayUrl(env.SUPABASE_URL || env.NAXA_STORAGE_E2E_URL || "");
  const adminKey = String(env.SUPABASE_SERVICE_ROLE_KEY || env.NAXA_STORAGE_E2E_ADMIN_KEY || "").trim();
  const anonKey = String(env.NAXA_STORAGE_E2E_ANON_KEY || "").trim();
  const cronSecret = String(env.CRON_SECRET || "").trim();
  const vapidPublic = String(env.NAXA_VAPID_PUBLIC_KEY || "").trim();
  const vapidPrivate = String(env.NAXA_VAPID_PRIVATE_KEY || "").trim();
  if (!adminKey || !anonKey || !cronSecret || !vapidPublic || !vapidPrivate) {
    throw new Error("Clés Replay, CRON_SECRET et clés VAPID éphémères requises.");
  }
  webpush.setVapidDetails("mailto:naxa.home@gmail.com", vapidPublic, vapidPrivate);

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* do not log raw response */ }
    return { ok: response.ok, status: response.status, data };
  }

  async function admin(path, method = "GET", body, prefer) {
    const headers = { apikey: adminKey, Authorization: "Bearer " + adminKey, "Content-Type": "application/json" };
    if (prefer) headers.Prefer = prefer;
    const result = await fetchJson(baseUrl + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!result.ok) {
      const summary = restErrorSummary(result.data);
      throw new Error(
        "Échec REST Replay HTTP " + result.status + " sur " + path.split("?")[0]
        + (summary ? " [" + summary + "]" : "") + "."
      );
    }
    return result.data;
  }

  async function login(email, passwordFile, label) {
    if (!email || !passwordFile || !fs.existsSync(passwordFile)) throw new Error("Identifiants E2E manquants pour " + label + ".");
    const password = fs.readFileSync(passwordFile, "utf8");
    const result = await fetchJson(baseUrl + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!result.ok || !result.data?.access_token || !result.data?.user?.id) {
      throw new Error("Connexion Auth Replay impossible pour " + label + " (HTTP " + result.status + ").");
    }
    return { id: result.data.user.id, token: result.data.access_token, email };
  }

  const pharmacyId = String(env.NAXA_STORAGE_E2E_EXPIRY_PHARMACY_ID || "").trim();
  const expectedIds = {
    stock: String(env.NAXA_STORAGE_E2E_EXPIRY_STOCK_ID || "").trim(),
    responsable: String(env.NAXA_STORAGE_E2E_EXPIRY_RESPONSABLE_ID || "").trim(),
  };
  if (!pharmacyId || !expectedIds.stock || !expectedIds.responsable) {
    throw new Error("Identifiants de pharmacie et de personnel E2E requis.");
  }

  const pharmacyRows = await admin("/rest/v1/pharmacies?select=id,nom,slug,est_demo,visible_recherche,actif&id=eq."
    + encodeURIComponent(pharmacyId) + "&limit=1");
  if (!Array.isArray(pharmacyRows) || pharmacyRows.length !== 1
    || pharmacyRows[0].slug !== TEST_PHARMACY_SLUG || pharmacyRows[0].est_demo !== false
    || pharmacyRows[0].visible_recherche !== false || pharmacyRows[0].actif !== true) {
    throw new Error("Refus : pharmacie technique non-démo masquée en recherche publique requise.");
  }

  let promoter = null;
  let stock = null;
  let responsable = null;
  let productId = null;
  let lotNumber = null;
  let lotId = null;
  let baseStock = null;
  let baseLotsQuantity = 0;
  let stockRowTouched = false;
  const notificationIds = [];
  const subscriptions = [];
  const contexts = [];
  const profileDirs = [];
  try {
    promoter = await login(
      env.NAXA_STORAGE_E2E_PROMOTEUR_EMAIL || "naxa.e2e.promoteur@example.invalid",
      env.NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD_FILE,
      "Promoteur",
    );
    stock = await login(env.NAXA_STORAGE_E2E_EXPIRY_STOCK_EMAIL, env.NAXA_STORAGE_E2E_EXPIRY_STOCK_PASSWORD_FILE, "Gestionnaire Stock");
    responsable = await login(env.NAXA_STORAGE_E2E_EXPIRY_RESPONSABLE_EMAIL, env.NAXA_STORAGE_E2E_EXPIRY_RESPONSABLE_PASSWORD_FILE, "Responsable");
    if (stock.id !== expectedIds.stock || responsable.id !== expectedIds.responsable) {
      throw new Error("Les sessions Auth ne correspondent pas aux profils provisionnés.");
    }
    const e2eUserIds = [promoter.id, stock.id, responsable.id];
    if (new Set(e2eUserIds).size !== 3) {
      throw new Error("Les trois identités Web Push E2E doivent être distinctes.");
    }
    // Ces profils sont exclusivement des comptes de recette example.invalid.
    // Purger leurs endpoints résiduels avant le nouveau test évite qu'un ancien
    // endpoint expiré (404/410) fasse échouer une souscription Chromium fraîche.
    const e2eUserFilter = "user_id=in.(" + e2eUserIds.map(encodeURIComponent).join(",") + ")";
    const staleSubscriptions = await admin(
      "/rest/v1/naxa_push_subscriptions?select=user_id,endpoint&" + e2eUserFilter
    );
    if (!Array.isArray(staleSubscriptions)) {
      throw new Error("Lecture des anciennes souscriptions Web Push E2E invalide.");
    }
    if (staleSubscriptions.length) {
      await admin("/rest/v1/naxa_push_subscriptions?" + e2eUserFilter,
        "DELETE", undefined, "return=minimal");
    }
    const remainingSubscriptions = await admin(
      "/rest/v1/naxa_push_subscriptions?select=user_id&" + e2eUserFilter
    );
    if (!Array.isArray(remainingSubscriptions) || remainingSubscriptions.length !== 0) {
      throw new Error("Des souscriptions Push résiduelles subsistent sur les seuls profils E2E.");
    }
    process.stdout.write("INFO — purge ciblée des anciennes souscriptions des trois profils E2E : "
      + staleSubscriptions.length + " supprimée(s).\\n");

    const products = await admin("/rest/v1/produits?select=id,nom&nom=eq." + encodeURIComponent(PRODUCT_NAME) + "&limit=2");
    if (!Array.isArray(products) || products.length !== 1) throw new Error("Produit technique existant introuvable ou ambigu.");
    productId = products[0].id;
    lotNumber = "NAXA-E2E-EXPIRY-" + String(env.GITHUB_RUN_ID || Date.now()).replace(/[^0-9]/g, "")
      + "-" + String(env.GITHUB_RUN_ATTEMPT || "1").replace(/[^0-9]/g, "");
    const expiryDate = addDays(localCameroonDate(), 3);
    const stockFilter = "&pharmacie_id=eq." + encodeURIComponent(pharmacyId)
      + "&produit_id=eq." + encodeURIComponent(productId);

    const [existingStocks, existingLots] = await Promise.all([
      admin("/rest/v1/stocks?select=pharmacie_id,produit_id,prix,quantite,date_peremption,emplacement"
        + stockFilter + "&limit=2"),
      admin("/rest/v1/stocks_lots?select=id,lot,quantite" + stockFilter),
    ]);
    if (!Array.isArray(existingStocks) || existingStocks.length > 1) {
      throw new Error("Le stock agrégé de la fixture est ambigu.");
    }
    baseStock = existingStocks[0] ?? null;
    baseLotsQuantity = assertStockLotBalance(baseStock, existingLots);

    // Respect the lot/aggregate invariant before inserting the new test lot.
    await admin("/rest/v1/stocks?on_conflict=pharmacie_id,produit_id", "POST",
      buildStockPayload({ pharmacyId, productId, stockRow: baseStock, baseLotsQuantity }),
      "resolution=merge-duplicates,return=minimal");
    stockRowTouched = true;

    await admin("/rest/v1/stocks_lots?on_conflict=pharmacie_id,produit_id,lot", "POST", {
      pharmacie_id: pharmacyId, produit_id: productId, lot: lotNumber, numero_lot: lotNumber,
      peremption: expiryDate, date_peremption: expiryDate, quantite: 5, bloque: false,
      emplacement: "E2E — non commercial",
    }, "resolution=merge-duplicates,return=minimal");

    const lotRows = await admin("/rest/v1/stocks_lots?select=id,pharmacie_id,produit_id,lot,date_peremption,quantite&pharmacie_id=eq."
      + encodeURIComponent(pharmacyId) + "&produit_id=eq." + encodeURIComponent(productId)
      + "&lot=eq." + encodeURIComponent(lotNumber) + "&limit=1");
    if (!Array.isArray(lotRows) || lotRows.length !== 1 || lotRows[0].quantite !== 5) {
      throw new Error("Le lot J-3 de test n'a pas été créé correctement.");
    }
    lotId = lotRows[0].id;

    const lotsAfterInsert = await admin("/rest/v1/stocks_lots?select=id,quantite" + stockFilter);
    const expectedAggregate = sumLotQuantities(lotsAfterInsert);
    if (expectedAggregate !== baseLotsQuantity + 5) {
      throw new Error("La somme des lots a changé de manière inattendue pendant la création du lot E2E.");
    }
    await admin("/rest/v1/stocks?pharmacie_id=eq." + encodeURIComponent(pharmacyId)
      + "&produit_id=eq." + encodeURIComponent(productId),
      "PATCH", { quantite: expectedAggregate }, "return=minimal");

    const stockAfterInsert = await admin("/rest/v1/stocks?select=quantite" + stockFilter + "&limit=1");
    if (!Array.isArray(stockAfterInsert) || stockAfterInsert.length !== 1
      || Number(stockAfterInsert[0].quantite) !== expectedAggregate) {
      throw new Error("Le stock agrégé ne correspond pas à la somme des lots après création.");
    }

    const dispatched = await fetchJson(baseUrl + "/rest/v1/rpc/naxa_dispatch_pharmacy_lot_expiry_alerts_internal", {
      method: "POST",
      headers: { apikey: adminKey, Authorization: "Bearer " + adminKey, "Content-Type": "application/json" },
      body: JSON.stringify({ p_today: localCameroonDate(), p_limit: 1000 }),
    });
    if (!dispatched.ok) {
      const summary = restErrorSummary(dispatched.data);
      throw new Error("Le dispatcher a refusé la distribution (HTTP " + dispatched.status
        + (summary ? " [" + summary + "]" : "") + ").");
    }
    if (typeof dispatched.data !== "number" || dispatched.data < 3) {
      throw new Error("Le dispatcher n'a pas émis les trois rappels attendus (résultat "
        + String(dispatched.data).slice(0, 80) + ").");
    }

    const notifications = await admin("/rest/v1/notifications?select=id,user_id,type,related_entity_id,titre,corps"
      + "&related_entity_id=eq." + encodeURIComponent(lotId)
      + "&type=eq.lot_expiry_reminder&limit=20");
    const byUser = new Map((notifications || []).map(row => [row.user_id, row]));
    const identities = [
      { label: "Promoteur", session: promoter, notification: byUser.get(promoter.id) },
      { label: "Gestionnaire Stock", session: stock, notification: byUser.get(stock.id) },
      { label: "Responsable", session: responsable, notification: byUser.get(responsable.id) },
    ];
    notificationIds.push(...identities.map(item => item.notification?.id).filter(Boolean));
    for (const item of identities) if (!item.notification) {
      throw new Error("Le dispatcher n'a pas ciblé le rôle actif : " + item.label + ".");
    }

    for (const identity of identities) {
      // A non-persistent off-the-record context is denied Push subscriptions by Chromium.
      // Push subscriptions are denied in that profile mode even when Notifications
      // permission is granted. Give each test identity its own persistent temp profile.
      const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "naxa-webpush-profile-"));
      profileDirs.push(userDataDir);
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        channel: "chromium",
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      contexts.push(context);
      await context.grantPermissions(["notifications"], { origin: ORIGIN });
      const page = await context.newPage();
      await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded", timeout: 30000 });

      const subscription = await page.evaluate(async (publicKey) => {
        const permission = Notification.permission;
        if (permission !== "granted") {
          throw new Error("Permission Notifications non accordée dans Chromium (" + permission + ").");
        }
        const permissionStatus = await navigator.permissions.query({ name: "notifications" });
        if (permissionStatus.state !== "granted") {
          throw new Error("Permission API Notifications non accordée dans Chromium (" + permissionStatus.state + ").");
        }
        const registration = await navigator.serviceWorker.register("/naxa-push-sw.js", { scope: "/naxa-push/" });
        await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) await existing.unsubscribe();
        const normalized = publicKey.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
        const raw = atob(padded);
        const key = Uint8Array.from(raw, character => character.charCodeAt(0));
        const created = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        return { scope: registration.scope, subscription: created.toJSON() };
      }, vapidPublic);
      if (!subscription.scope.startsWith(ORIGIN + "/naxa-push/") || !subscription.subscription?.endpoint) {
        throw new Error("Souscription Web Push invalide pour " + identity.label + ".");
      }

      const saved = await fetchJson(baseUrl + "/rest/v1/naxa_push_subscriptions?on_conflict=endpoint", {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: "Bearer " + identity.session.token,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          endpoint: subscription.subscription.endpoint,
          user_id: identity.session.id,
          subscription: subscription.subscription,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!saved.ok) throw new Error("Souscription authentifiée refusée pour " + identity.label + " (HTTP " + saved.status + ").");

      const storedRows = await admin("/rest/v1/naxa_push_subscriptions?select=user_id,endpoint,subscription&user_id=eq."
        + encodeURIComponent(identity.session.id));
      const stored = Array.isArray(storedRows)
        ? storedRows.find(row => row.endpoint === subscription.subscription.endpoint)
        : null;
      if (!stored || stored.user_id !== identity.session.id
        || stored.subscription?.keys?.p256dh !== subscription.subscription.keys?.p256dh
        || stored.subscription?.keys?.auth !== subscription.subscription.keys?.auth) {
        throw new Error("Souscription stockée différente de la souscription Chromium pour " + identity.label + ".");
      }
      // Une seule livraison par souscription : le worker NAXA est le test réel.
      // La lecture REST ci-dessus confirme que l'endpoint et les clés stockées
      // correspondent exactement à la souscription créée par Chromium.
      const endpointUrl = new URL(subscription.subscription.endpoint);
      const endpointFingerprint = crypto.createHash("sha256")
        .update(subscription.subscription.endpoint).digest("hex").slice(0, 12);
      process.stdout.write("PASS — souscription Chromium persistée et relue pour " + identity.label
        + " (hôte " + endpointUrl.hostname + ", empreinte " + endpointFingerprint + ").\\n");
      subscriptions.push({ userId: identity.session.id, endpoint: subscription.subscription.endpoint, page, notification: identity.notification, label: identity.label });
    }

    for (const item of subscriptions) {
      const sent = await fetchJson(ORIGIN + "/api/cron/notifications/push?notification_id=" + encodeURIComponent(item.notification.id), {
        method: "GET", headers: { Authorization: "Bearer " + cronSecret },
      });
      if (!sent.ok || sent.data?.claimed !== 1 || sent.data?.sent !== 1 || sent.data?.webPushSent !== 1) {
        const counters = ["claimed", "sent", "noDevice", "retried", "failed", "webPushSent", "fcmSent", "webPushFailures"]
          .map((key) => key + "=" + String(Number(sent.data?.[key] ?? 0))).join(", ")
          + " ; webPushErrorCodes=" + JSON.stringify(sent.data?.webPushErrorCodes ?? [])
          + " ; webPushFailureDetails=" + JSON.stringify(sent.data?.webPushFailureDetails ?? []);
        const workerError = typeof sent.data?.error === "string" ? " · " + sent.data.error.slice(0, 120) : "";
        throw new Error(
          "Le worker NAXA n'a pas confirmé un envoi Web Push ciblé pour " + item.label
          + " (HTTP " + sent.status + " ; " + counters + workerError + ")."
        );
      }
      await item.page.waitForFunction(async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          const shown = await registration.getNotifications();
          if (shown.some(notification => notification.data?.type === "lot_expiry_reminder"
            && notification.title.toLowerCase().includes("péremption"))) return true;
        }
        return false;
      }, { timeout: 25000 });
    }

    process.stdout.write("PASS — dispatcher J-3 : Promoteur, Gestionnaire Stock et Responsable.\n");
    process.stdout.write("PASS — 3 souscriptions authentifiées créées par Chromium.\n");
    process.stdout.write("PASS — worker NAXA : 3 envois Web Push ciblés et 3 notifications constatées dans le Service Worker Chromium.\n");
    process.stdout.write("PASS — réception navigateur Web Push réelle ; pas d'affirmation de reçu Android FCM physique.\n");
    process.stdout.write("EXPIRY_LOT_ID=" + lotId + "\n");
    process.stdout.write("EXPIRY_NOTIFICATION_IDS=" + identities.map(row => row.notification.id).join(",") + "\n");
  } finally {
    for (const item of subscriptions) {
      await admin("/rest/v1/naxa_push_subscriptions?endpoint=eq." + encodeURIComponent(item.endpoint)
        + "&user_id=eq." + encodeURIComponent(item.userId), "DELETE", undefined, "return=minimal").catch(() => null);
    }
    if (notificationIds.length) {
      await admin("/rest/v1/notifications?id=in.(" + notificationIds.map(encodeURIComponent).join(",") + ")",
        "DELETE", undefined, "return=minimal").catch(() => null);
    }
    if (productId && lotNumber && stockRowTouched) {
      const lotFilter = "/rest/v1/stocks_lots?pharmacie_id=eq." + encodeURIComponent(pharmacyId)
        + "&produit_id=eq." + encodeURIComponent(productId)
        + "&lot=eq." + encodeURIComponent(lotNumber);
      await admin(lotFilter, "DELETE", undefined, "return=minimal").catch(async () => {
        // If an audit/operational reference prevents deletion, keep a zero-quantity lot
        // and restore the aggregate to the remaining sum rather than breaking stock integrity.
        await admin(lotFilter, "PATCH", { quantite: 0 }, "return=minimal").catch(() => null);
      });

      const remainingLots = await admin("/rest/v1/stocks_lots?select=quantite&pharmacie_id=eq."
        + encodeURIComponent(pharmacyId) + "&produit_id=eq." + encodeURIComponent(productId)).catch(() => null);
      if (Array.isArray(remainingLots)) {
        const restorePayload = buildStockRestorePayload({ stockRow: baseStock, remainingLots });
        const stockPath = "/rest/v1/stocks?pharmacie_id=eq." + encodeURIComponent(pharmacyId)
          + "&produit_id=eq." + encodeURIComponent(productId);
        if (restorePayload) {
          await admin(stockPath, "PATCH", restorePayload, "return=minimal").catch(() => null);
        } else {
          await admin(stockPath, "DELETE", undefined, "return=minimal").catch(() => null);
        }
      }
    }
    for (const session of [promoter, stock, responsable].filter(Boolean)) {
      await fetchJson(baseUrl + "/auth/v1/logout?scope=local", {
        method: "POST",
        headers: { apikey: anonKey, Authorization: "Bearer " + session.token, "Content-Type": "application/json" },
      }).catch(() => null);
    }
    for (const context of contexts) await context.close().catch(() => null);
    for (const profileDir of profileDirs) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  run().catch(error => {
    process.stderr.write("RECETTE WEB PUSH PÉREMPTION E2E BLOQUÉE — " + (error?.message || "erreur inconnue") + "\n");
    process.exitCode = 1;
  });
}

module.exports = { assertReplayUrl, localCameroonDate, addDays, sumLotQuantities, restErrorSummary };
