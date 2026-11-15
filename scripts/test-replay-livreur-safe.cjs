"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertReplayUrl,
  buildCourierMetadata,
  assertCourierFixture,
  generateEphemeralPassword,
} = require("./e2e/provision-replay-livreur-safe.cjs");

const authUser = () => ({
  id: "courier-fixture-id",
  email: "naxa.e2e.livreur@example.invalid",
  email_confirmed_at: "2026-11-15T00:00:00.000Z",
  user_metadata: {
    naxa_e2e_fixture: "NAXA-E2E-LIVREUR-20261115",
    naxa_e2e_persona: "livreur",
    username: "naxa_e2e_livreur",
  },
});
const profile = () => ({
  id: "courier-fixture-id",
  role: "client",
  actif: true,
  age_verified: true,
  consent_accepted_at: "2026-11-15T00:00:00.000Z",
  username: "naxa_e2e_livreur",
  first_name: "Compte",
  last_name: "Livreur E2E",
  phone: "+237600000099",
  date_of_birth: "1990-01-01",
  fonction_interne: null,
});

test("URL Replay only ; Production et hôtes falsifiés refusés", () => {
  assert.equal(
    assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co"),
    "https://pwfftcsjyeibxxqhwysw.supabase.co"
  );
  assert.throws(() => assertReplayUrl("https://eouwtuusnsuxaejsxknf.supabase.co"), /limité au projet Replay/);
  assert.throws(() => assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co.evil.invalid"), /limité au projet Replay/);
});

test("métadonnées de création réservées à la fixture Livreur", () => {
  const metadata = buildCourierMetadata();
  assert.equal(metadata.username, "naxa_e2e_livreur");
  assert.equal(metadata.phone_country, "CM");
  assert.equal(metadata.naxa_signup_pending, false);
  assert.equal(metadata.naxa_e2e_fixture, "NAXA-E2E-LIVREUR-20261115");
  assert.equal(metadata.naxa_e2e_persona, "livreur");
  assert.equal(metadata.consent_accepted, true);
});

test("accepte une identité Client confirmée et complète destinée au poste Livreur", () => {
  assert.equal(assertCourierFixture(authUser(), profile()), true);
});

test("refuse une identité Auth qui n'est pas la fixture dédiée", () => {
  const wrong = authUser();
  wrong.email = "client@example.invalid";
  assert.throws(() => assertCourierFixture(wrong, profile()), /adresse ne correspond pas/);
});

test("refuse une fixture avec des marqueurs différents", () => {
  const wrong = authUser();
  wrong.user_metadata.naxa_e2e_persona = "client";
  assert.throws(() => assertCourierFixture(wrong, profile()), /marqueurs exacts/);
});

test("refuse un compte non confirmé ou un profil racine non Client", () => {
  const unconfirmed = authUser();
  unconfirmed.email_confirmed_at = null;
  assert.throws(() => assertCourierFixture(unconfirmed, profile()), /doit déjà être confirmée/);
  assert.throws(() => assertCourierFixture(authUser(), { ...profile(), role: "promoteur" }), /profil Client doit rester/);
});

test("refuse un profil incomplet, mineur, non consentant ou inactif", () => {
  assert.throws(() => assertCourierFixture(authUser(), { ...profile(), age_verified: false }), /profil Client doit rester/);
  assert.throws(() => assertCourierFixture(authUser(), { ...profile(), consent_accepted_at: null }), /profil Client doit rester/);
  assert.throws(() => assertCourierFixture(authUser(), { ...profile(), first_name: null }), /profil Client doit rester/);
  assert.throws(() => assertCourierFixture(authUser(), { ...profile(), actif: false }), /profil Client doit rester/);
});

test("refuse un profil Auth non lié à la même identité", () => {
  assert.throws(() => assertCourierFixture(authUser(), { ...profile(), id: "other-id" }), /n'est pas lié/);
});

test("le mot de passe de recette est robuste et distinct à chaque génération", () => {
  const a = generateEphemeralPassword();
  const b = generateEphemeralPassword();
  assert.notEqual(a, b);
  assert.ok(a.length >= 40);
  assert.match(a, /[A-Z]/);
  assert.match(a, /[a-z]/);
  assert.match(a, /[0-9]/);
  assert.match(a, /[^A-Za-z0-9]/);
});
