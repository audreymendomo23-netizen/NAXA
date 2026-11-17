const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/auth/forgot-password/route.ts"),
  "utf8",
);

test("password reset does not disclose whether a username exists", () => {
  assert.match(source, /function genericResponse\(\)/);
  assert.match(source, /if \(!profile\) return genericResponse\(\)/);
  assert.match(source, /!isFinalizedNaxaProfile\(profile, userData\.user\)/);
  assert.doesNotMatch(source, /NOT_FOUND|status:\s*404/);
});

test("password reset is rate-limited before profile lookup", () => {
  const limit = source.indexOf('rateLimit("ip_password_reset"');
  const lookup = source.indexOf('.from("profiles")');
  assert.ok(limit >= 0 && lookup > limit);
  assert.match(source, /tooManyAttempts\(ipGate\.retryAfter\)/);
});

test("password reset responses are not cacheable", () => {
  assert.match(source, /"Cache-Control": "no-store"/);
});
