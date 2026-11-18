"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { hasUsableRefreshTokenPair } = require("./e2e/refresh-session-check.cjs");
const { readAuthErrorCode } = require("./e2e/verify-auth-session-lifecycle.cjs");
const { readAccessTokenFromCookies } = require("./e2e/read-ssr-access-token.cjs");

test("a successful refresh response with both tokens is a usable session", () => {
  assert.equal(hasUsableRefreshTokenPair({
    ok: true,
    status: 200,
    data: { access_token: "access", refresh_token: "refresh" },
  }), true);
});

test("HTTP 200 without a token pair is not a usable refresh session", () => {
  assert.equal(hasUsableRefreshTokenPair({ ok: true, status: 200, data: {} }), false);
  assert.equal(hasUsableRefreshTokenPair({ ok: true, status: 200, data: { msg: "revoked" } }), false);
});

test("partial token responses cannot be mistaken for a usable session", () => {
  assert.equal(hasUsableRefreshTokenPair({
    ok: true, status: 200, data: { access_token: "access" },
  }), false);
  assert.equal(hasUsableRefreshTokenPair({
    ok: true, status: 200, data: { refresh_token: "refresh" },
  }), false);
});

test("rejected refresh requests are never considered usable", () => {
  assert.equal(hasUsableRefreshTokenPair({
    ok: false, status: 400, data: { error_code: "refresh_token_already_used" },
  }), false);
});

test("SSR cookie reader extracts an access token from a single base64 cookie", () => {
  const value = "base64-" + Buffer.from(JSON.stringify({ access_token: "browser-access" })).toString("base64url");
  assert.equal(readAccessTokenFromCookies([
    { name: "sb-replay-auth-token", value },
  ]), "browser-access");
});

test("SSR cookie reader reassembles numbered cookie chunks in order", () => {
  const value = "base64-" + Buffer.from(JSON.stringify({ access_token: "chunked-access" })).toString("base64url");
  const split = Math.floor(value.length / 2);
  assert.equal(readAccessTokenFromCookies([
    { name: "sb-replay-auth-token.1", value: value.slice(split) },
    { name: "sb-replay-auth-token.0", value: value.slice(0, split) },
  ]), "chunked-access");
});

test("SSR cookie reader rejects absent or malformed authentication cookies", () => {
  assert.throws(() => readAccessTokenFromCookies([]), /Cookie Auth absent/);
  assert.throws(() => readAccessTokenFromCookies([
    { name: "sb-replay-auth-token", value: "base64-not-json" },
  ]), /Impossible de lire/);
});


test("Supabase Auth semantic error_code wins over a numeric response code", () => {
  assert.equal(readAuthErrorCode({ code: 400, error_code: "refresh_token_already_used" }), "refresh_token_already_used");
});

test("Auth error code falls back to a string code and ignores numeric-only codes", () => {
  assert.equal(readAuthErrorCode({ code: "session_not_found" }), "session_not_found");
  assert.equal(readAuthErrorCode({ code: 400, msg: "Possible abuse attempt" }), "non fourni");
});
