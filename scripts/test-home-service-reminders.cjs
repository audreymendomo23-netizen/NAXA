const fs = require("node:fs");
const assert = require("node:assert/strict");

const cron = fs.readFileSync("src/app/api/cron/posologie/route.ts", "utf8");
const serviceWorker = fs.readFileSync("public/naxa-push-sw.js", "utf8");
const schema = fs.readFileSync("supabase/migrations/20261111160000_home_services_appointments_reminders.sql", "utf8");
const lifecycle = fs.readFileSync("supabase/migrations/20261111170000_home_service_reminder_lifecycle.sql", "utf8");
const settings = fs.readFileSync("src/app/partenaire/prestations/parametres/page.tsx", "utf8");
const actions = fs.readFileSync("src/app/partenaire/prestations/actions.ts", "utf8");

assert.match(schema, /create table if not exists public\.home_service_reminder_preferences/, "les préférences par professionnel/établissement doivent être persistées");
assert.match(schema, /create table if not exists public\.home_service_reminder_dispatches/, "la file de rappels doit être persistée");
assert.match(schema, /revoke all on public\.home_service_reminder_dispatches from public,anon,authenticated/, "la file interne ne doit pas être exposée aux rôles API");
assert.match(schema, /grant all on public\.home_service_reminder_dispatches to service_role/, "seul le worker privilégié doit écrire dans la file");
assert.match(schema, /grant execute on function public\.claim_home_service_reminder_dispatches\(integer\) to service_role/, "la revendication atomique doit être réservée au worker");
assert.match(schema, /p_scheduled_at < now\(\)\+interval '5 minutes'/, "la confirmation doit exiger un vrai rendez-vous futur");

for (const offset of ["1440", "120", "60", "30", "15", "0"]) {
  assert.match(settings, new RegExp(`value:\\s*${offset},`), "délai de rappel manquant: " + offset);
  assert.ok(actions.includes(offset), "le serveur doit accepter le délai de rappel: " + offset);
}

assert.match(lifecycle, /sync_home_service_reminder_preferences_trigger/, "les changements de préférences doivent synchroniser les files");
assert.match(lifecycle, /sync_home_service_reminder_members_trigger/, "les changements d'affectation doivent synchroniser les files");
assert.match(lifecycle, /sync_home_service_reminder_partner_trigger/, "la suspension du partenaire doit invalider les files");
assert.match(lifecycle, /sync_home_service_reminder_profile_trigger/, "la désactivation du profil doit invalider les files");
assert.match(lifecycle, /appointment_cancelled/, "l'annulation d'un rendez-vous doit être terminale");
assert.match(lifecycle, /appointment_completed/, "la clôture d'un rendez-vous doit être terminale");
assert.match(lifecycle, /max_attempts_exhausted/, "les tentatives épuisées doivent être terminales");
assert.match(lifecycle, /for update of d skip locked/i, "les workers concurrents doivent revendiquer les tâches sans doublon");

assert.match(cron, /rpc\("claim_home_service_reminder_dispatches"/, "le cron doit utiliser la RPC atomique des rendez-vous");
assert.match(cron, /rpc\("claim_naxa_notification_push_outbox"/, "le cron doit utiliser la file centrale des notifications");
assert.match(cron, /select\("status,scheduled_at"\)/, "le rendez-vous doit être revérifié juste avant le traitement du rappel");
assert.match(cron, /select\("state"\)[\s\S]*?dispatchGuard\.data\?\.state !== "processing"/, "le worker doit vérifier qu'il possède encore le verrou de dispatch");
assert.match(cron, /related_entity_id: dispatch\.dispatch_id/, "la notification in-app doit être liée à son dispatch pour permettre son retrait lors d'un report");
assert.match(cron, /Number\(dispatch\.attempts\) >= 12 \? "failed" : "pending"/, "le worker doit arrêter les retries après 12 tentatives");
assert.match(cron, /homeServiceRemindersCancelled/, "le worker doit compter les rappels annulés comme tels");
assert.match(cron, /webpush\.sendNotification\(subscription\.subscription, payload/, "le worker doit distribuer les notifications Push");

assert.match(serviceWorker, /self\.registration\.showNotification/, "le service worker doit afficher les notifications système");
assert.match(serviceWorker, /notificationclick/, "les notifications doivent ouvrir la destination NAXA");
assert.match(serviceWorker, /target\.origin !== self\.location\.origin/, "le clic ne doit pas ouvrir une destination externe");
assert.match(serviceWorker, /payload\.vibrate/, "le motif de vibration doit être transmis au navigateur");

console.log("PASS — rendez-vous, préférences, invalidation, file atomique, retries et distribution Push vérifiés");
