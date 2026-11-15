"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertReplayUrl,
  buildMetadata,
  assertFixture,
  generateEphemeralPassword,
  PERSONAS,
} = require("./e2e/provision-replay-pharmacy-staff-safe.cjs");

test("provisionnement d'équipe strictement épinglé à Replay", () => {
  assert.equal(
    assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co"),
    "https://pwfftcsjyeibxxqhwysw.supabase.co"
  );
  assert.throws(() => assertReplayUrl("https://eouwtuusnsuxaejsxknf.supabase.co"), /limitées au projet Replay/);
  assert.throws(() => assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co.evil.invalid"), /limitées au projet Replay/);
});

test("les trois identités métier sont distinctes et le profil racine reste Client", () => {
  assert.equal(PERSONAS.length, 3);
  assert.equal(new Set(PERSONAS.map(row => row.email)).size, 3);
  assert.equal(new Set(PERSONAS.map(row => row.username)).size, 3);
  assert.ok(PERSONAS.every(row => row.role === "client" || ["gestionnaire_stock", "caisse"].includes(row.role)));
});

test("métadonnées E2E complètes, majeures et sans secret", () => {
  for (const persona of PERSONAS) {
    const metadata = buildMetadata(persona);
    assert.equal(metadata.username, persona.username);
    assert.equal(metadata.phone_country, "CM");
    assert.equal(metadata.date_of_birth, "1990-01-01");
    assert.equal(metadata.naxa_signup_completed, true);
    assert.equal(metadata.naxa_signup_pending, false);
    assert.equal(metadata.naxa_e2e_fixture, "NAXA-E2E-PHARMACY-STAFF-20261115");
    assert.equal(metadata.naxa_e2e_persona, persona.key);
    assert.equal(metadata.consent_accepted, true);
  }
});

test("profils E2E doivent être Auth confirmés, racine Client, majeurs, consentants et liés", () => {
  for (const persona of PERSONAS) {
    const user = {
      id: "fixture-" + persona.key,
      email: persona.email,
      email_confirmed_at: "2026-11-15T08:00:00.000Z",
      user_metadata: {
        naxa_e2e_fixture: "NAXA-E2E-PHARMACY-STAFF-20261115",
        naxa_e2e_persona: persona.key,
        username: persona.username,
        naxa_signup_completed: true,
      },
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

test("refuse une identité Auth ou un profil non conforme", () => {
  const persona = PERSONAS[0];
  const user = {
    id: "fixture-stock",
    email: persona.email,
    email_confirmed_at: "2026-11-15T08:00:00.000Z",
    user_metadata: buildMetadata(persona),
  };
  const profile = {
    id: user.id, role: "client", actif: true, age_verified: true,
    consent_accepted_at: "2026-11-15T08:00:00.000Z",
    username: persona.username, first_name: persona.firstName,
    last_name: persona.lastName, phone: persona.phone, date_of_birth: "1990-01-01",
  };
  assert.throws(() => assertFixture(user, profile, { ...persona, email: "other@example.invalid" }), /Adresse Auth inattendue/);
  assert.throws(() => assertFixture(user, { ...profile, role: "promoteur" }, persona), /Profil racine Client incomplet/);
  assert.throws(() => assertFixture(user, { ...profile, age_verified: false }, persona), /Profil racine Client incomplet/);
  assert.throws(() => assertFixture({ ...user, email_confirmed_at: null }, profile, persona), /Adresse non confirmée/);
});

test("mot de passe éphémère distinct et robuste", () => {
  const first = generateEphemeralPassword();
  const second = generateEphemeralPassword();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  assert.match(first, /[A-Z]/);
  assert.match(first, /[a-z]/);
  assert.match(first, /[0-9]/);
  assert.match(first, /[^A-Za-z0-9]/);
});
