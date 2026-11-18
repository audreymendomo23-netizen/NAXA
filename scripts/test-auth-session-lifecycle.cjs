"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { hasUsableRefreshTokenPair } = require("./e2e/refresh-session-check");

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
