/**
 * NAXA — courrier de bienvenue Google Apps Script
 * À coller dans un projet Google Apps Script dédié.
 * Script Properties requises :
 *   NAXA_WELCOME_SECRET = secret long aléatoire
 *   NAXA_WELCOME_FROM_NAME = NAXA (facultatif)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty("NAXA_WELCOME_SECRET");
    if (!secret || !p.secret || !constantTimeEquals_(String(p.secret), secret)) {
      return json_({ sent: false, error: "unauthorized" });
    }
    if (!validEmail_(p.to) || typeof p.html !== "string" || typeof p.subject !== "string" || !/^[a-zA-Z0-9_-]{8,160}$/.test(String(p.idempotencyKey || ""))) {
      return json_({ sent: false, error: "invalid_request" });
    }
    const key = "sent_" + p.idempotencyKey;
    if (props.getProperty(key)) return json_({ sent: true, alreadySent: true });

    const fromName = props.getProperty("NAXA_WELCOME_FROM_NAME") || "NAXA";
    const plainText = typeof p.text === "string" && p.text.trim()
      ? p.text.slice(0, 10000)
      : "Votre compte NAXA est prêt. Ouvrez ce message dans un client compatible HTML.";
    MailApp.sendEmail(String(p.to), String(p.subject).slice(0, 180), plainText, {
      htmlBody: String(p.html).slice(0, 30000),
      name: fromName,
    });
    props.setProperty(key, new Date().toISOString());
    if (String(p.idempotencyKey).indexOf("naxa-notification-") === 0) pruneNotificationKeys_(props);
    return json_({ sent: true, alreadySent: false });
  } catch (err) {
    console.error("NAXA welcome email failed: " + String(err));
    return json_({ sent: false, error: "send_failed" });
  } finally {
    lock.releaseLock();
  }
}

function validEmail_(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}


/**
 * Nettoie uniquement les clés de notifications après 30 jours.
 * Les clés de bienvenue restent conservées pour préserver leur anti-doublon historique.
 */
function pruneNotificationKeys_(props) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const all = props.getProperties();
  Object.keys(all).forEach(function(key) {
    if (key.indexOf("sent_naxa-notification-") !== 0) return;
    const sentAt = Date.parse(all[key]);
    if (!sentAt || sentAt < cutoff) props.deleteProperty(key);
  });
}


/**
 * Worker planifié : appelle le endpoint NAXA protégé par CRON_SECRET.
 * Propriétés requises : NAXA_WORKER_URL et NAXA_CRON_SECRET.
 * Le déclencheur tourne sous le compte Google propriétaire du script.
 */
function processNaxaNotificationQueue() {
  const props = PropertiesService.getScriptProperties();
  const workerUrl = String(props.getProperty("NAXA_WORKER_URL") || "").trim();
  const cronSecret = String(props.getProperty("NAXA_CRON_SECRET") || "");
  if (!workerUrl || !cronSecret) {
    throw new Error("Configurer NAXA_WORKER_URL et NAXA_CRON_SECRET dans les propriétés du script.");
  }
  if (!/^https:\/\//i.test(workerUrl) || !/\/api\/cron\/validite$/.test(workerUrl)) {
    throw new Error("NAXA_WORKER_URL doit cibler l'endpoint HTTPS /api/cron/validite.");
  }

  const response = UrlFetchApp.fetch(workerUrl, {
    method: "get",
    headers: { Authorization: "Bearer " + cronSecret },
    muteHttpExceptions: true,
    followRedirects: false
  });
  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error("Worker NAXA HTTP " + status + " : " + body.slice(0, 300));
  }
  let result;
  try {
    result = JSON.parse(body);
  } catch (_) {
    throw new Error("Réponse JSON invalide du worker NAXA.");
  }
  console.log("NAXA notification worker: " + JSON.stringify({
    claimed: result.claimed,
    sent: result.sent,
    retried: result.retried,
    dead: result.dead
  }));
  return result;
}

/**
 * À exécuter une seule fois manuellement après configuration des propriétés.
 * Remplace tout ancien déclencheur de ce handler pour éviter les doublons.
 */
function installNaxaNotificationTrigger() {
  const handler = "processNaxaNotificationQueue";
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handler) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(handler).timeBased().everyMinutes(5).create();
  return "Déclencheur NAXA installé : toutes les 5 minutes.";
}

/** Arrêt d'urgence du déclencheur de notifications. */
function removeNaxaNotificationTrigger() {
  const handler = "processNaxaNotificationQueue";
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });
  return "Déclencheurs NAXA supprimés : " + removed;
}
