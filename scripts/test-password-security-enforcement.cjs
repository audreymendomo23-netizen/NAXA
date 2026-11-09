const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const pharmacyRoute = read("src/app/api/auth/update-password/route.ts");
const promoterRoute = read("src/app/api/auth/update-promoteur-password/route.ts");
const sessionRoute = read("src/app/api/auth/update-user-password/route.ts");
const signupPage = read("src/app/(auth)/creation-compte/page.tsx");
const resetPage = read("src/app/(auth)/nouveau-mot-de-passe/page.tsx");
const promoterForm = read("src/components/pharmacie/PromoteurPasswordForm.tsx");

test("pharmacy and promoter password APIs check HIBP before admin password writes", () => {
  for (const route of [pharmacyRoute, promoterRoute]) {
    assert.match(route, /import \{ checkPwnedPassword \}/);
    assert.match(route, /await checkPwnedPassword\(/);
    assert.match(route, /PASSWORD_COMPROMISED/);
    assert.match(route, /PASSWORD_CHECK_UNAVAILABLE/);
    assert.ok(route.indexOf("await checkPwnedPassword(") < route.indexOf("auth.admin.updateUserById("));
  }
});

test("signup and recovery password writes use the authenticated server endpoint", () => {
  for (const page of [signupPage, resetPage]) {
    assert.match(page, /\/api\/auth\/update-user-password/);
    assert.doesNotMatch(page, /auth\.updateUser\(\s*\{\s*password/);
    assert.doesNotMatch(page, /verifierSecuriteMotDePasse/);
  }
  assert.match(sessionRoute, /await server\.auth\.getUser\(/);
  assert.match(sessionRoute, /await checkPwnedPassword\(/);
  assert.match(sessionRoute, /await server\.auth\.updateUser\(\{ password \}\)/);
  assert.match(sessionRoute, /PASSWORD_COMPROMISED/);
  assert.match(sessionRoute, /PASSWORD_CHECK_UNAVAILABLE/);
  assert.ok(sessionRoute.indexOf("await checkPwnedPassword(") < sessionRoute.indexOf("await server.auth.updateUser({ password })"));
});

test("promoter password form relies on server-side enforcement", () => {
  assert.match(promoterForm, /\/api\/auth\/update-promoteur-password/);
  assert.doesNotMatch(promoterForm, /verifierSecuriteMotDePasse/);
});
