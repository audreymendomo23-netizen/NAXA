"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const route = fs.readFileSync(
  path.join(root, "src/app/api/cron/notifications/push/route.ts"),
  "utf8"
);
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115095450_responsable_quota_and_scoped_expiry_push.sql"),
  "utf8"
);
const middleware = fs.readFileSync(
  path.join(root, "src/middleware.ts"),
  "utf8"
);
const pushServiceWorker = fs.readFileSync(
  path.join(root, "public/naxa-push-sw.js"),
  "utf8"
);
const webPushE2E = fs.readFileSync(
  path.join(root, "scripts/e2e/verify-replay-expiry-webpush.cjs"),
  "utf8"
);
const replayWorkflow = fs.readFileSync(
  path.join(root, ".github/workflows/naxa-replay-promoteur-secret-safe-v2.yml"),
  "utf8"
);

test("le worker push accepte un identifiant UUID et conserve le mode batch historique", () => {
  assert.match(route, /const UUID_RE\s*=\s*\/\^\[0-9a-f\]/i);
  assert.match(route, /notificationId\s*\?\s*await db\.rpc\("claim_notification_push_outbox_for_notification"/);
  assert.match(route, /: await db\.rpc\("claim_notification_push_outbox",\s*\{\s*p_limit:\s*50\s*\}\)/);
  assert.match(route, /notificationId:\s*notificationId \?\? null/);
  assert.match(route, /webPushFailures/);
  assert.match(route, /webPushErrorCodes/);
  assert.match(route, /network_error/);
  assert.match(route, /webPushFailureDetails/);
  assert.match(route, /providerHost/);
  assert.match(route, /new URL\(sub\.endpoint\)\.hostname/);
  assert.match(route, /process\.env\.VERCEL_ENV !== "production"/);
  assert.match(route, /process\.env\.VERCEL_ENV === "production" \? \{\} : \{ webPushFailureDetails \}/);
});

test("le claim push ciblé est réservé au service_role et verrouille une seule notification", () => {
  assert.match(migration, /where o\.notification_id=p_notification_id/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /revoke all on function public\.claim_notification_push_outbox_for_notification\(uuid\)\s+from public,anon,authenticated/i);
  assert.match(migration, /grant execute on function public\.claim_notification_push_outbox_for_notification\(uuid\) to service_role/i);
});

test("le dispatcher réel de péremption ne peut être appelé qu'avec le JWT service_role", () => {
  assert.match(migration, /auth\.role\(\)/);
  assert.doesNotMatch(migration, /request\.jwt\.claim\.role/);
  assert.match(migration, /private\.dispatch_pharmacy_lot_expiry_alerts\(p_today,p_limit\)/);
  assert.match(migration, /grant execute on function public\.naxa_dispatch_pharmacy_lot_expiry_alerts_internal\(date,integer\)\s+to service_role/i);
  assert.match(migration, /revoke all on function public\.naxa_dispatch_pharmacy_lot_expiry_alerts_internal\(date,integer\)\s+from public,anon,authenticated/i);
});

test("le script Service Worker Push est servi sans redirection du middleware d'âge", () => {
  assert.ok(middleware.includes(String.raw`naxa-push-sw\\.js`));
  assert.ok(middleware.includes("matcher: ["));
  assert.ok(pushServiceWorker.includes('self.addEventListener("push"'));
  assert.ok(pushServiceWorker.includes("showNotification"));
});


test("la recette purge les anciennes souscriptions uniquement sur les trois profils E2E dédiés", () => {
  assert.ok(webPushE2E.includes("const e2eUserIds = [promoter.id, stock.id, responsable.id]"));
  assert.ok(webPushE2E.includes('"user_id=in.(" + e2eUserIds.map(encodeURIComponent).join(",") + ")"'));
  assert.match(webPushE2E, /naxa_push_subscriptions\?select=user_id,endpoint&" \+ e2eUserFilter/);
  assert.match(webPushE2E, /naxa_push_subscriptions\?" \+ e2eUserFilter,[\s\S]*?"DELETE"/);
  assert.match(webPushE2E, /remainingSubscriptions\.length !== 0/);
});

test("la recette envoie une seule notification par souscription via le worker NAXA", () => {
  assert.ok(webPushE2E.includes("stored.subscription?.keys?.p256dh"));
  assert.ok(webPushE2E.includes("stored.subscription?.keys?.auth"));
  assert.ok(webPushE2E.includes("endpointFingerprint"));
  assert.ok(webPushE2E.includes("endpointUrl.hostname"));
  assert.ok(webPushE2E.includes("Le worker NAXA n'a pas confirmé un envoi Web Push ciblé"));
  assert.doesNotMatch(webPushE2E, /webpush\\.sendNotification\\(subscription\\.subscription/);
  assert.ok(!webPushE2E.includes("naxa_e2e_transport_probe"));
});

test("la recette Web Push utilise des profils Chromium persistants, permission accordée et nettoyage garanti", () => {
  assert.ok(webPushE2E.includes('channel: "chromium"'));
  assert.ok(webPushE2E.includes("chromium.launchPersistentContext"));
  assert.ok(!webPushE2E.includes("await browser.newContext("));
  assert.ok(webPushE2E.includes('Notification.permission'));
  assert.ok(webPushE2E.includes('permissionStatus.state !== "granted"'));
  assert.ok(webPushE2E.includes('navigator.serviceWorker.register("/naxa-push-sw.js"'));
  assert.ok(webPushE2E.includes("fs.rmSync(profileDir"));
});

test("le serveur Next local Replay transmet la clé serveur attendue par supabaseAdmin sans modifier Production", () => {
  assert.ok(replayWorkflow.includes('NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NAXA_STORAGE_E2E_URL }}'));
  assert.ok(replayWorkflow.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NAXA_STORAGE_E2E_ANON_KEY }}'));
  assert.ok(replayWorkflow.includes('SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.NAXA_STORAGE_E2E_ADMIN_KEY }}'));
  assert.ok(replayWorkflow.includes('export SUPABASE_SECRET_KEY="$NAXA_STORAGE_E2E_ADMIN_KEY"'));
  assert.ok(replayWorkflow.includes('echo "::add-mask::$SUPABASE_SECRET_KEY"'));
  assert.ok(replayWorkflow.includes('if [ -z "$SUPABASE_SECRET_KEY" ]'));
  assert.ok(replayWorkflow.includes('test -n "$NAXA_STORAGE_E2E_URL"'));
  assert.ok(replayWorkflow.includes("Ce workflow est strictement limité à NAXA Replay"));
  assert.ok([
    "secrets.SUPABASE_URL",
    "secrets.SUPABASE_SERVICE_ROLE_KEY",
    "secrets.SUPABASE_SECRET_KEY",
    "secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "secrets.SUPABASE_ANON_KEY",
  ].every((secretName) => !replayWorkflow.includes(secretName)));
  assert.ok(!replayWorkflow.includes("VERCEL_ENV=production"));
});
