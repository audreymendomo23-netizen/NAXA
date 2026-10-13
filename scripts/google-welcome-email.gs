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
    MailApp.sendEmail(String(p.to), String(p.subject), "Votre compte NAXA est prêt. Ouvrez ce message dans un client compatible HTML.", {
      htmlBody: p.html,
      name: fromName,
    });
    props.setProperty(key, new Date().toISOString());
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
