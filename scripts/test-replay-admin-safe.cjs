"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertReplayUrl,
  assertAdminFixture,
  generateEphemeralPassword,
} = require("./e2e/provision-replay-admin-safe.cjs");

const user = () => ({
  id: "admin-fixture-id",
  email: "naxa.e2e.20261104.admin@example.invalid",
  email_confirmed_at: "2026-11-04T15:02:12.731Z",
  user_metadata: {
    naxa_e2e_fixture: "NAXA-E2E-20261104",
    naxa_e2e_persona: "admin",
    naxa_signup_pending: true,
  },
});
const profile = () => ({
  id: "admin-fixture-id",
  role: "admin",
  actif: true,
});

test("URL Replay only : Production et hôtes falsifiés sont refusés", () => {
  assert.equal(
    assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co"),
    "https://pwfftcsjyeibxxqhwysw.supabase.co"
  );
  assert.throws(() => assertReplayUrl("https://eouwtuusnsuxaejsxknf.supabase.co"), /limité au projet Replay/);
  assert.throws(() => assertReplayUrl("http://pwfftcsjyeibxxqhwysw.supabase.co"), /limité au projet Replay/);
  assert.throws(() => assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co.evil.invalid"), /limité au projet Replay/);
});

test("accepte uniquement la fixture Auth Admin préexistante, confirmée et active", () => {
  assert.equal(assertAdminFixture(user(), profile()), true);
});

test("refuse toute autre identité, même avec profil Admin", () => {
  const wrong = user();
  wrong.email = "naxa.home@gmail.com";
  assert.throws(() => assertAdminFixture(wrong, profile()), /adresse Admin ne correspond pas/);
});

test("refuse un marqueur de fixture absent ou incorrect", () => {
  const wrong = user();
  wrong.user_metadata.naxa_e2e_persona = "client";
  assert.throws(() => assertAdminFixture(wrong, profile()), /marqueurs de fixture attendus/);
});

test("refuse un compte Auth non confirmé sans le confirmer automatiquement", () => {
  const unconfirmed = user();
  unconfirmed.email_confirmed_at = null;
  assert.throws(() => assertAdminFixture(unconfirmed, profile()), /doit déjà être confirmée/);
});

test("refuse une conversion ou une réactivation implicite du profil", () => {
  assert.throws(() => assertAdminFixture(user(), { ...profile(), role: "client" }), /doit déjà être Admin actif/);
  assert.throws(() => assertAdminFixture(user(), { ...profile(), actif: false }), /doit déjà être Admin actif/);
});

test("refuse un profil non lié à la même identité Auth", () => {
  assert.throws(() => assertAdminFixture(user(), { ...profile(), id: "different-id" }), /n'est pas lié/);
});

test("le mot de passe de test est aléatoire et robuste", () => {
  const a = generateEphemeralPassword();
  const b = generateEphemeralPassword();
  assert.notEqual(a, b);
  assert.ok(a.length >= 40);
  assert.match(a, /[A-Z]/);
  assert.match(a, /[a-z]/);
  assert.match(a, /[0-9]/);
  assert.match(a, /[^A-Za-z0-9]/);
});
