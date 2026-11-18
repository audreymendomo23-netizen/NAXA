#!/usr/bin/env node
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("les quatre parcours résolvent le nom d'utilisateur par égalité exacte", () => {
  const routes = [
    "src/app/api/auth/login/route.ts",
    "src/app/api/auth/username-recognition/route.ts",
    "src/app/api/auth/username-availability/route.ts",
    "src/app/api/auth/forgot-password/route.ts",
    "src/app/api/auth/forgot-password/verify/route.ts",
  ];
  for (const route of routes) {
    const content = source(route);
    assert.match(content, /\.eq\(["']username["'],\s*(?:username|normalized)\)/, route);
    assert.doesNotMatch(content, /\.ilike\(["']username["']/, route);
  }
});

test("un refus métier après authentification ne révoque que la session locale créée", () => {
  const login = source("src/app/api/auth/login/route.ts");
  const signOutCalls = login.match(/supabase\.auth\.signOut\([^)]*\)/g) || [];
  assert.ok(signOutCalls.length > 0, "les chemins de refus doivent nettoyer leur session");
  assert.ok(
    signOutCalls.every(call => /scope:\s*["']local["']/.test(call)),
    "un refus de contexte ne doit pas déconnecter les autres appareils",
  );
});

test("le scope OTP de récupération est aligné entre route, RPC et contrainte SQL", () => {
  const route = source("src/app/api/auth/forgot-password/route.ts");
  const rpc = source("supabase/migrations/20261117224500_naxa_rate_limit_allow_password_reset_scope.sql");
  const constraint = source("supabase/migrations/20261117224600_naxa_rate_limit_password_reset_scope_constraint.sql");
  assert.match(route, /rateLimit\(["']ip_password_reset["']/);
  assert.match(rpc, /'ip_password_reset'/);
  assert.match(constraint, /'ip_password_reset'/);
});

test("les vérifications OTP déposent la session dans les cookies de la réponse", () => {
  const signup = source("src/app/api/auth/signup-otp/verify/route.ts");
  const recovery = source("src/app/api/auth/forgot-password/verify/route.ts");
  for (const route of [signup, recovery]) {
    assert.match(route, /supabaseServer\(response\)/);
    assert.match(route, /verifyOtp\(/);
    assert.match(route, /type:\s*["']email["']/);
  }
});

test("la recette de rejeu corrèle chaque rotation au même utilisateur et session_id", () => {
  const script = source("scripts/e2e/verify-auth-session-lifecycle.cjs");
  assert.match(script, /assertSameAuthSession\(firstClaims,\s*readAccessTokenClaims\(rotated\.data\.access_token/);
  assert.match(script, /assertSameAuthSession\(firstClaims,\s*readAccessTokenClaims\(current\.data\.access_token/);
  assert.match(script, /sb-auth-refresh-token-rotated/);
  assert.match(script, /afterReuseDetection/);
});
