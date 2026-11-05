"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const gasSource = fs.readFileSync(path.join(__dirname, "google-welcome-email.gs"), "utf8");
const posologieRoute = fs.readFileSync(path.join(__dirname, "../src/app/api/cron/posologie/route.ts"), "utf8");

function executeEmailWorker({ status = 200, workerUrl = "https://nnaxa.vercel.app/api/cron/validite" } = {}) {
  const calls = [];
  const properties = {
    NAXA_WORKER_URL: workerUrl,
    NAXA_CRON_SECRET: "test-cron-secret",
    NAXA_VERCEL_BYPASS_SECRET: "test-vercel-bypass-secret",
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties[key] || null,
      }),
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        calls.push({ url, options });
        return {
          getResponseCode: () => status,
          getContentText: () => status >= 200 && status < 300
            ? JSON.stringify({ claimed: 1, sent: 1, retried: 0, dead: 0 })
            : "<html>Vercel SSO</html>",
        };
      },
    },
    console: { log: () => undefined },
  };
  vm.createContext(context);
  vm.runInContext(gasSource, context, { filename: "google-welcome-email.gs" });
  return { result: context.processNaxaNotificationQueue(), calls };
}

test("Apps Script déclenche uniquement le worker e-mail sur le domaine Production", () => {
  const { result, calls } = executeEmailWorker();

  assert.deepEqual(calls.map((call) => call.url), [
    "https://nnaxa.vercel.app/api/cron/validite",
  ]);
  assert.equal(calls[0].options.followRedirects, false);
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-cron-secret");
  assert.equal(calls[0].options.headers["x-vercel-protection-bypass"], "test-vercel-bypass-secret");
  assert.equal(result.httpStatus, 200);
  assert.equal(result.claimed, 1);
  assert.equal(result.sent, 1);
});

test("un retour SSO/HTTP non-2xx est un échec, pas un faux succès", () => {
  assert.throws(() => executeEmailWorker({ status: 302 }), /HTTP 302/);
});

test("un alias Preview ou protégé est refusé avant tout appel", () => {
  const calls = [];
  assert.throws(
    () => executeEmailWorker({ workerUrl: "https://naxa-git-main-naxa3.vercel.app/api/cron/validite" }),
    /domaine stable Production/,
  );
});

test("le worker Push vérifie le jeton Vault en Production et CRON_SECRET hors Production", () => {
  assert.match(posologieRoute, /import \{ supabaseAdmin \} from "@\/lib\/supabase\/server";/);
  assert.match(posologieRoute, /process\.env\.VERCEL_ENV === "production"/);
  assert.match(posologieRoute, /rpc\(\s*"naxa_verify_posology_cron_secret"/);
  assert.match(posologieRoute, /p_candidate:\s*bearer/);
  assert.match(posologieRoute, /const secret = process\.env\.CRON_SECRET/);
  assert.doesNotMatch(posologieRoute, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(posologieRoute, /createClient\(/);
});

test("Google Apps Script ne double-dispatche pas les rappels Push", () => {
  assert.equal(gasSource.split("UrlFetchApp.fetch(").length - 1, 1);
  assert.match(gasSource, /\/api\/cron\/validite/);
  assert.match(gasSource, /Le Web Push est dispatché directement par pg_cron/);
});
