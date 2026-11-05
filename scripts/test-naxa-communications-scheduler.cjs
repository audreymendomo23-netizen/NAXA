"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "google-welcome-email.gs"), "utf8");
const posologieRoute = fs.readFileSync(path.join(__dirname, "../src/app/api/cron/posologie/route.ts"), "utf8");

function executeWorker({ emailStatus = 200, pushStatus = 200, workerUrl = "https://nnaxa.vercel.app/api/cron/validite" } = {}) {
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
        const isPush = url.endsWith("/api/cron/posologie");
        const status = isPush ? pushStatus : emailStatus;
        const payload = isPush
          ? { ok: true, checked: 2, due: 1, sent: 1, failed: 0 }
          : { claimed: 1, sent: 1, retried: 0, dead: 0 };
        return {
          getResponseCode: () => status,
          getContentText: () => status >= 200 && status < 300
            ? JSON.stringify(payload)
            : "<html>Vercel SSO</html>",
        };
      },
    },
    console: { log: () => undefined },
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "google-welcome-email.gs" });
  return { result: context.processNaxaNotificationQueue(), calls };
}

test("le déclencheur appelle les workers e-mail et Push sur le domaine Production", () => {
  const { result, calls } = executeWorker();

  assert.deepEqual(calls.map((call) => call.url), [
    "https://nnaxa.vercel.app/api/cron/validite",
    "https://nnaxa.vercel.app/api/cron/posologie",
  ]);
  for (const call of calls) {
    assert.equal(call.options.followRedirects, false);
    assert.equal(call.options.headers.Authorization, "Bearer test-cron-secret");
    assert.equal(call.options.headers["x-vercel-protection-bypass"], "test-vercel-bypass-secret");
  }
  assert.equal(result.email.sent, 1);
  assert.equal(result.push.sent, 1);
});

test("un retour SSO/HTTP non-2xx est un échec, même si le second worker répond", () => {
  const calls = [];
  const properties = {
    NAXA_WORKER_URL: "https://nnaxa.vercel.app/api/cron/validite",
    NAXA_CRON_SECRET: "test-cron-secret",
    NAXA_VERCEL_BYPASS_SECRET: "test-vercel-bypass-secret",
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (key) => properties[key] || null }),
    },
    UrlFetchApp: {
      fetch: (url) => {
        calls.push(url);
        const isPush = url.endsWith("/api/cron/posologie");
        return {
          getResponseCode: () => isPush ? 200 : 302,
          getContentText: () => isPush
            ? JSON.stringify({ ok: true, checked: 0, due: 0, sent: 0, failed: 0 })
            : "<html>SSO</html>",
        };
      },
    },
    console: { log: () => undefined },
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "google-welcome-email.gs" });

  assert.throws(() => context.processNaxaNotificationQueue(), /email: HTTP 302/);
  assert.equal(calls.length, 2, "le worker Push doit quand même être tenté");
});

test("un alias Preview ou protégé est refusé avant tout appel", () => {
  assert.throws(
    () => executeWorker({ workerUrl: "https://naxa-git-main-naxa3.vercel.app/api/cron/validite" }),
    /domaine stable Production/,
  );
});

test("le worker Push utilise le client Admin adapté à l'environnement", () => {
  assert.match(posologieRoute, /import \{ supabaseAdmin \} from "@\/lib\/supabase\/server";/);
  assert.match(posologieRoute, /db = supabaseAdmin\(\);/);
  assert.doesNotMatch(posologieRoute, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(posologieRoute, /createClient\(/);
});
