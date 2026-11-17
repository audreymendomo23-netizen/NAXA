/**
 * NAXA — passerelle e-mail commune (Google Apps Script / Gmail).
 *
 * Déploiement : Web App exécutée en tant que propriétaire, URL /exec.
 * Script Properties requises :
 *   NAXA_WELCOME_SECRET       secret partagé avec GOOGLE_APPS_SCRIPT_SECRET
 *   NAXA_WELCOME_FROM_NAME    facultatif, valeur conseillée : NAXA
 *   NAXA_WORKER_URL           https://nnaxa.vercel.app/api/cron/validite
 *   NAXA_CRON_SECRET          valeur de CRON_SECRET côté Vercel
 *   NAXA_VERCEL_BYPASS_SECRET secret de bypass Vercel, distinct des autres secrets
 *
 * Les e-mails OTP Supabase restent hors de cette passerelle.
 */

function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    lock.waitLock(15000);
    locked = true;
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const props = PropertiesService.getScriptProperties();
    const expectedSecret = props.getProperty("NAXA_WELCOME_SECRET");

    if (!expectedSecret || !payload.secret ||
        !constantTimeEquals_(String(payload.secret), expectedSecret)) {
      return json_({ sent: false, error: "unauthorized" });
    }

    const idempotencyKey = String(payload.idempotencyKey || "");
    if (!validEmail_(payload.to) ||
        typeof payload.subject !== "string" ||
        typeof payload.html !== "string" ||
        !/^[a-zA-Z0-9_-]{8,160}$/.test(idempotencyKey) ||
        payload.subject.trim().length < 1 ||
        payload.subject.length > 180 ||
        payload.html.length > 30000) {
      return json_({ sent: false, error: "invalid_request" });
    }

    const propertyKey = "sent_" + idempotencyKey;
    if (props.getProperty(propertyKey)) {
      return json_({ sent: true, alreadySent: true });
    }

    const plainText = typeof payload.text === "string" && payload.text.trim()
      ? payload.text.slice(0, 10000)
      : "Votre compte NAXA est prêt. Ouvrez ce message dans un client compatible HTML.";
    const fromName = props.getProperty("NAXA_WELCOME_FROM_NAME") || "NAXA";

    MailApp.sendEmail(String(payload.to), payload.subject.trim(), plainText, {
      htmlBody: payload.html,
      name: fromName
    });

    // Enregistrer seulement après que MailApp a accepté l'envoi.
    props.setProperty(propertyKey, new Date().toISOString());
    pruneNotificationKeys_(props);
    return json_({ sent: true, alreadySent: false });
  } catch (error) {
    console.error("NAXA email gateway failure: " + String(error));
    return json_({ sent: false, error: "send_failed" });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function validEmail_(value) {
  return typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Purge les clés d'événements/notifications de plus de 30 jours.
 * Les clés de bienvenue sont conservées afin de préserver leur anti-doublon.
 */
function pruneNotificationKeys_(props) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const all = props.getProperties();
  Object.keys(all).forEach(function(key) {
    if (key.indexOf("sent_naxa-notification-") !== 0 &&
        key.indexOf("sent_naxa-email-event-") !== 0) return;
    const sentAt = Date.parse(all[key]);
    if (!sentAt || sentAt < cutoff) props.deleteProperty(key);
  });
}

/**
 * Worker planifié : appelle le worker e-mail NAXA.
 * Les secrets sont des propriétés distinctes et ne sont jamais journalisés.
 */
function processNaxaNotificationQueue() {
  const props = PropertiesService.getScriptProperties();
  const workerUrl = String(props.getProperty("NAXA_WORKER_URL") || "").trim();
  const cronSecret = String(props.getProperty("NAXA_CRON_SECRET") || "");
  const bypassSecret = String(props.getProperty("NAXA_VERCEL_BYPASS_SECRET") || "");

  if (!workerUrl || !cronSecret || !bypassSecret) {
    throw new Error("Configurer NAXA_WORKER_URL, NAXA_CRON_SECRET et NAXA_VERCEL_BYPASS_SECRET.");
  }
  if (!/^https:\/\/nnaxa\.vercel\.app\/api\/cron\/validite$/.test(workerUrl)) {
    throw new Error("NAXA_WORKER_URL doit cibler https://nnaxa.vercel.app/api/cron/validite.");
  }

  const response = UrlFetchApp.fetch(workerUrl, {
    method: "get",
    headers: {
      Authorization: "Bearer " + cronSecret,
      "x-vercel-protection-bypass": bypassSecret
    },
    muteHttpExceptions: true,
    followRedirects: false
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error("Worker e-mail NAXA HTTP " + status + " (redirection/refus ou erreur serveur).");
  }

  let result;
  try {
    result = JSON.parse(response.getContentText());
  } catch (_) {
    throw new Error("Réponse JSON invalide du worker e-mail NAXA.");
  }

  ["claimed", "sent", "retried", "dead"].forEach(function(key) {
    if (!result || typeof result[key] !== "number") {
      throw new Error("Contrat JSON du worker e-mail NAXA invalide : " + key);
    }
  });

  const summary = {
    httpStatus: status,
    claimed: result.claimed,
    sent: result.sent,
    retried: result.retried,
    dead: result.dead,
    syncErrors: Array.isArray(result.syncErrors) ? result.syncErrors.length : 0
  };
  console.log("NAXA email worker: " + JSON.stringify(summary));
  return summary;
}

/** À exécuter une seule fois après configuration des propriétés. */
function installNaxaNotificationTrigger() {
  const handler = "processNaxaNotificationQueue";
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handler) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(handler).timeBased().everyMinutes(5).create();
  return "Déclencheur NAXA installé : toutes les 5 minutes.";
}

/** Arrêt d'urgence du déclencheur e-mail. */
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
