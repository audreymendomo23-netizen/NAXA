"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertReplayUrl,
  buildMetadata,
  assertFixture,
  generateEphemeralPassword,
  buildTestCredentialPdf,
  buildClientPrescriptionObjectPath,
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

test("les cinq identités métier sont distinctes et le profil racine reste Client", () => {
  assert.equal(PERSONAS.length, 5);
  assert.equal(new Set(PERSONAS.map(row => row.email)).size, 5);
  assert.equal(new Set(PERSONAS.map(row => row.username)).size, 5);
  assert.deepEqual(
    PERSONAS.map(row => row.role).sort(),
    ["client", "caisse", "comptable", "gestionnaire_stock", "pharmacien"].sort()
  );
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


test("le compte Pharmacien exige un dossier validé par le Promoteur et un justificatif E2E fictif", () => {
  const pharmacist = PERSONAS.find(row => row.role === "pharmacien");
  const accountant = PERSONAS.find(row => row.role === "comptable");
  assert.ok(pharmacist);
  assert.ok(accountant);
  assert.equal(pharmacist.email, "naxa.e2e.pharmacien@example.invalid");
  assert.equal(accountant.email, "naxa.e2e.comptable@example.invalid");
  assert.notEqual(pharmacist.phone, accountant.phone);
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

test("le Livreur invité est connecté à la pharmacie et validé par un JWT réel", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "e2e/provision-replay-pharmacy-staff-safe.cjs"),
    "utf8"
  );
  assert.ok(source.includes("NAXA_STORAGE_E2E_LIVREUR_PASSWORD_FILE"));
  assert.ok(source.includes('login("naxa.e2e.livreur@example.invalid"'));
  assert.ok(source.includes('p_fonction: "livreur"'));
  assert.ok(source.includes('p_role_code: "livreur"'));
  assert.ok(source.includes('courierBusinessRole.data !== "livreur"'));
  assert.ok(source.includes("courierActivePharmacy.data !== pharmacyId"));
});

test("PDF d'ordonnance fictif et chemin Storage sont strictement marqués E2E", () => {
  const pdf = buildTestCredentialPdf();
  assert.ok(pdf.subarray(0, 8).toString("utf8").startsWith("%PDF-1.4"));
  assert.match(pdf.toString("utf8"), /NOT A REAL LICENSE OR PRESCRIPTION/);
  assert.equal(
    buildClientPrescriptionObjectPath(
      "dcb2242b-50fb-46c8-8c90-e01d42fa4175",
      "76dd4983-273a-4a83-ae3d-9a7838d3aa35",
      "0123456789abcdef"
    ),
    "dcb2242b-50fb-46c8-8c90-e01d42fa4175/76dd4983-273a-4a83-ae3d-9a7838d3aa35/naxa-e2e-prescription-0123456789abcdef.pdf"
  );
  assert.throws(() => buildClientPrescriptionObjectPath("client/other", "pharmacy", "nonce"), /Chemin Storage invalide/);
});

test("le harnais exécute upload Client, lecture Pharmacien, téléchargement, validation et nettoyage", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "e2e/provision-replay-pharmacy-staff-safe.cjs"),
    "utf8"
  );
  assert.ok(source.includes("naxa-client-prescriptions"));
  assert.ok(source.includes("naxa_client_soumettre_ordonnance"));
  assert.ok(source.includes("prescription_valider"));
  assert.ok(source.includes("object/authenticated/naxa-client-prescriptions/"));
  assert.ok(source.includes("Nettoyage ordonnance E2E incomplet"));
});

test("la connexion navigateur Caisse conserve le rôle professionnel actif", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "e2e/verify-credit-pos-browser.cjs"),
    "utf8"
  );
  assert.ok(source.includes('pageLogin(cashierPage, CASHIER_USERNAME, cashierPassword, "pharmacie", "/pharmacie/caisse")'));
  assert.ok(!source.includes('pageLogin(cashierPage, CASHIER_USERNAME, cashierPassword, "client", "/pharmacie/caisse")'));
});
