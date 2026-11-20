"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertReplayUrl,
  buildDirectorMetadata,
  assertDirectorFixture,
  assertExamRoster,
  STAFF_ROLES,
} = require("./e2e/provision-replay-exam-center-staff.cjs");

const user = () => ({
  id: "exam-director-id",
  email: "naxa.e2e.exam-director@example.invalid",
  email_confirmed_at: "2026-11-20T08:00:00.000Z",
  user_metadata: buildDirectorMetadata(),
});
const profile = () => ({
  id: "exam-director-id",
  username: "naxa_e2e_exam_director",
  role: "client",
  actif: true,
  age_verified: true,
  consent_accepted_at: "2026-11-20T08:00:00.000Z",
  date_of_birth: "1990-01-01",
  first_name: "Compte",
  last_name: "Directeur Centre E2E",
  phone: "+237600000088",
});

test("provisionnement strictement Replay", () => {
  assert.equal(assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co"), "https://pwfftcsjyeibxxqhwysw.supabase.co");
  assert.throws(() => assertReplayUrl("https://eouwtuusnsuxaejsxknf.supabase.co"), /Replay/);
  assert.throws(() => assertReplayUrl("http://pwfftcsjyeibxxqhwysw.supabase.co"), /Replay/);
  assert.throws(() => assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co.evil.invalid"), /Replay/);
});

test("métadonnées directeur limitées à une fixture Client déclarée", () => {
  const metadata = buildDirectorMetadata();
  assert.equal(metadata.naxa_signup_completed, true);
  assert.equal(metadata.naxa_signup_pending, false);
  assert.equal(metadata.naxa_e2e_persona, "exam_director");
  assert.equal(metadata.username, "naxa_e2e_exam_director");
});

test("accepte uniquement un directeur E2E Client confirmé, majeur, complet et actif", () => {
  assert.equal(assertDirectorFixture(user(), profile()), true);
});

test("refuse une autre identité ou un compte non confirmé", () => {
  const wrongEmail = user();
  wrongEmail.email = "naxa.home@gmail.com";
  assert.throws(() => assertDirectorFixture(wrongEmail, profile()), /email/);
  const unconfirmed = user();
  unconfirmed.email_confirmed_at = null;
  assert.throws(() => assertDirectorFixture(unconfirmed, profile()), /confirmée/);
});

test("refuse un profil suspendu, incomplet ou d'un rôle autre que Client", () => {
  assert.throws(() => assertDirectorFixture(user(), { ...profile(), actif: false }), /Client actif/);
  assert.throws(() => assertDirectorFixture(user(), { ...profile(), role: "admin" }), /Client actif/);
  assert.throws(() => assertDirectorFixture(user(), { ...profile(), age_verified: false }), /majeur/);
  assert.throws(() => assertDirectorFixture(user(), { ...profile(), phone: null }), /complet/);
});

test("matrice des neuf postes et directeur distincts", () => {
  assert.equal(STAFF_ROLES.length, 9);
  const assignments = STAFF_ROLES.map((role, i) => ({
    user_id: "staff-" + i,
    role_key: role,
    is_active: true,
    active_role: true,
    revoked_at: null,
  }));
  assert.equal(assertExamRoster(assignments, "director-id"), true);
  assert.throws(() => assertExamRoster(assignments.slice(0, 8), "director-id"), /9 postes/);
  assert.throws(() => assertExamRoster([{ ...assignments[0], user_id: "director-id" }, ...assignments.slice(1)], "director-id"), /distinct/);
  assert.throws(() => assertExamRoster([assignments[0], ...assignments.slice(1).map(x => ({ ...x, user_id: assignments[0].user_id }))], "director-id"), /distinct/);
});
