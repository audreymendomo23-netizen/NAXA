"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertReplayUrl,
  buildPharmacyPayload,
  assertPrivatePharmacy,
  buildMetadata,
  assertFixture,
  generateEphemeralPassword,
  PERSONAS,
  PHARMACY_SLUG,
} = require("./e2e/provision-replay-expiry-pharmacy-safe.cjs");

test("le provisionneur expiry est strictement limité au projet Replay", () => {
  assert.equal(assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co"), "https://pwfftcsjyeibxxqhwysw.supabase.co");
  assert.throws(() => assertReplayUrl("https://eouwtuusnsuxaejsxknf.supabase.co"), /limitées au projet Replay/);
  assert.throws(() => assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co.evil.invalid"), /limitées au projet Replay/);
});

test("la pharmacie de recette est explicitement non commerciale et jamais listée publiquement", () => {
  const row = buildPharmacyPayload();
  assert.equal(row.slug, PHARMACY_SLUG);
  assert.equal(row.est_demo, false);
  assert.equal(row.visible_recherche, false);
  assert.equal(row.actif, true);
  assert.equal(row.livraison_active, false);
  assert.equal(assertPrivatePharmacy({ ...row, archivee_le: null }), true);
  assert.throws(() => assertPrivatePharmacy({ ...row, visible_recherche: true, archivee_le: null }), /invisible en recherche/);
  assert.throws(() => assertPrivatePharmacy({ ...row, est_demo: true, archivee_le: null }), /non-démo/);
});

test("les trois identités sont distinctes et gardent le rôle racine Client", () => {
  assert.equal(PERSONAS.length, 3);
  assert.equal(new Set(PERSONAS.map(row => row.email)).size, 3);
  assert.equal(new Set(PERSONAS.map(row => row.username)).size, 3);
  assert.equal(PERSONAS.filter(row => row.assigned).length, 2);
  assert.ok(PERSONAS.every(row => row.role === "responsable" || row.role === "gestionnaire_stock"));
});

test("métadonnées de compte et profil technique complets", () => {
  for (const persona of PERSONAS) {
    const metadata = buildMetadata(persona);
    assert.equal(metadata.naxa_e2e_fixture, "NAXA-E2E-EXPIRY-REPLAY-20261115");
    assert.equal(metadata.naxa_e2e_persona, persona.key);
    assert.equal(metadata.naxa_signup_completed, true);
    assert.equal(metadata.consent_accepted, true);
    const user = {
      id: "fixture-" + persona.key,
      email: persona.email,
      email_confirmed_at: "2026-11-15T08:00:00.000Z",
      user_metadata: metadata,
    };
    const profile = {
      id: user.id,
      role: "client",
      actif: true,
      age_verified: true,
      consent_accepted_at: "2026-11-15T08:00:00.000Z",
      username: persona.username,
      first_name: persona.firstName,
      last_name: persona.lastName,
      phone: persona.phone,
      date_of_birth: "1990-01-01",
    };
    assert.equal(assertFixture(user, profile, persona), true);
  }
});

test("les identités étrangères ou les profils non Client sont refusés", () => {
  const persona = PERSONAS[0];
  const user = { id: "fixture", email: persona.email, email_confirmed_at: "2026-11-15T08:00:00.000Z", user_metadata: buildMetadata(persona) };
  const profile = { id: user.id, role: "client", actif: true, age_verified: true, consent_accepted_at: "2026-11-15T08:00:00.000Z", username: persona.username, first_name: persona.firstName, last_name: persona.lastName, phone: persona.phone, date_of_birth: "1990-01-01" };
  assert.throws(() => assertFixture(user, { ...profile, role: "promoteur" }, persona), /Profil racine Client/);
  assert.throws(() => assertFixture({ ...user, email_confirmed_at: null }, profile, persona), /non confirmée/);
});

test("le mot de passe éphémère reste aléatoire et robuste", () => {
  const first = generateEphemeralPassword();
  const second = generateEphemeralPassword();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  assert.match(first, /[A-Z]/);
  assert.match(first, /[a-z]/);
  assert.match(first, /[0-9]/);
  assert.match(first, /[^A-Za-z0-9]/);
});
