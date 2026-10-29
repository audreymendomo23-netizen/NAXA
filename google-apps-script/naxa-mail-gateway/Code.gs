/**
 * NAXA — Passerelle e-mail Google Apps Script.
 *
 * Déploiement manuel requis : Application Web, exécuter en tant que propriétaire.
 * Configurer Script Property NAXA_MAIL_SECRET avec le même secret que
 * GOOGLE_APPS_SCRIPT_SECRET côté serveur NAXA.
 */
const NAXA_BRAND = "NAXA";
const SENT_PREFIX = "naxa_mail_sent_";
const SENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return json_({ ok: false, error: "BUSY" });
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const configuredSecret = props.getProperty("NAXA_MAIL_SECRET");
    const raw = e && e.postData && e.postData.contents;
    if (!configuredSecret || !raw) return json_({ ok: false, error: "UNAUTHORIZED" });

    const payload = JSON.parse(raw);
    if (!constantTimeEquals_(String(payload.secret || ""), configuredSecret)) {
      return json_({ ok: false, error: "UNAUTHORIZED" });
    }

    const key = String(payload.idempotencyKey || "");
    const to = String(payload.to || "").trim();
    const subject = String(payload.subject || "").trim().slice(0, 180);
    const textBody = String(payload.text || "").slice(0, 10000);
    const htmlBody = String(payload.html || "").slice(0, 30000);
    if (!/^[a-f0-9-]{20,80}$/i.test(key) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ||
        !subject || !textBody) {
      return json_({ ok: false, error: "INVALID_PAYLOAD" });
    }

    const sentKey = SENT_PREFIX + key;
    const existing = props.getProperty(sentKey);
    if (existing) {
      const previous = JSON.parse(existing);
      return json_({ ok: true, idempotent: true, messageId: previous.messageId || key });
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      return json_({ ok: false, error: "DAILY_QUOTA_EXHAUSTED" });
    }

    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: textBody,
      htmlBody: htmlBody,
      name: NAXA_BRAND
    });

    const messageId = key;
    props.setProperty(sentKey, JSON.stringify({
      messageId: messageId,
      sentAt: Date.now()
    }));
    pruneOldSentKeys_(props);

    return json_({ ok: true, idempotent: true, messageId: messageId });
  } catch (err) {
    return json_({ ok: false, error: "DELIVERY_FAILED", detail: String(err).slice(0, 300) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({
    ok: true,
    service: "NAXA Google Mail Gateway",
    quotaRemaining: MailApp.getRemainingDailyQuota()
  });
}

function pruneOldSentKeys_(props) {
  const all = props.getProperties();
  const cutoff = Date.now() - SENT_TTL_MS;
  Object.keys(all).forEach(function(key) {
    if (!key.startsWith(SENT_PREFIX)) return;
    try {
      const value = JSON.parse(all[key]);
      if (!value.sentAt || value.sentAt < cutoff) props.deleteProperty(key);
    } catch (_) {
      props.deleteProperty(key);
    }
  });
}

function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}


/** Test manuel depuis l'éditeur Apps Script; destinataire contrôlé par propriété. */
function testNaxaMailGateway() {
  const props = PropertiesService.getScriptProperties();
  const recipient = String(props.getProperty('NAXA_TEST_EMAIL') || '').trim();
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(recipient)) throw new Error('Définir NAXA_TEST_EMAIL avec une adresse valide.');
  if (MailApp.getRemainingDailyQuota() < 1) throw new Error('Quota quotidien MailApp épuisé.');
  MailApp.sendEmail({to: recipient, subject: 'NAXA — Test de configuration Google Mail', body: 'Ceci est un message de test du canal e-mail Google de NAXA.', name: NAXA_BRAND});
  return 'Message de test envoyé à l’adresse de recette configurée.';
}
