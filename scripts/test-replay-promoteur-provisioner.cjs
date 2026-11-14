"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertReplayUrl,
  chooseHybridPharmacies,
  buildProfileMetadata,
  generateEphemeralPassword,
} = require("./e2e/provision-replay-promoteur.cjs");

test("le provisionneur accepte uniquement l'URL HTTPS de Replay", () => {
  assert.equal(assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co"), "https://pwfftcsjyeibxxqhwysw.supabase.co");
  assert.throws(() => assertReplayUrl("https://eouwtuusnsuxaejsxknf.supabase.co"), /limité au projet Supabase Replay/);
  assert.throws(() => assertReplayUrl("http://pwfftcsjyeibxxqhwysw.supabase.co"), /limité au projet Supabase Replay/);
  assert.throws(() => assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co.evil.invalid"), /limité au projet Supabase Replay/);
});

test("sélectionne deux pharmacies démo HYBRIDE actives et libres", () => {
  const pharmacies = [
    { id: "p1", est_demo: true, actif: true, visible_recherche: true, archivee_le: null },
    { id: "p2", est_demo: true, actif: true, visible_recherche: true, archivee_le: null },
    { id: "p3", est_demo: true, actif: true, visible_recherche: true, archivee_le: null },
    { id: "p4", est_demo: false, actif: true, visible_recherche: true, archivee_le: null },
  ];
  const architectures = ["p1", "p2", "p3", "p4"].map(pharmacie_id => ({
    pharmacie_id, architecture_code: "HYBRIDE", active: true,
  }));
  const links = [{ promoteur_id: "autre", pharmacie_id: "p1", actif: true }];
  assert.deepEqual(chooseHybridPharmacies(pharmacies, architectures, links, "nouveau"), ["p2", "p3"]);
});

test("réutilise les liens du Promoteur courant sans prendre ceux d'un autre", () => {
  const pharmacies = ["p1", "p2", "p3"].map(id => ({
    id, est_demo: true, actif: true, visible_recherche: true, archivee_le: null,
  }));
  const architectures = pharmacies.map(p => ({
    pharmacie_id: p.id, architecture_code: "HYBRIDE", active: true,
  }));
  const links = [
    { promoteur_id: "same", pharmacie_id: "p2", actif: true },
    { promoteur_id: "other", pharmacie_id: "p1", actif: true },
  ];
  assert.deepEqual(chooseHybridPharmacies(pharmacies, architectures, links, "same"), ["p2", "p3"]);
});

test("refuse le provisionnement sans deux pharmacies démo HYBRIDE disponibles", () => {
  assert.throws(
    () => chooseHybridPharmacies([], [], [], "new"),
    /Deux pharmacies démo actives HYBRIDE/,
  );
});

test("les métadonnées identifient une identité de recette majeure et confirmée", () => {
  const metadata = buildProfileMetadata();
  assert.equal(metadata.naxa_signup_pending, false);
  assert.equal(metadata.naxa_signup_completed, true);
  assert.equal(metadata.naxa_e2e_promoteur, true);
  assert.equal(metadata.naxa_e2e_fixture, true);
  assert.equal(metadata.phone_country, "CM");
  assert.match(metadata.username, /^[a-z0-9][a-z0-9._-]{2,29}$/);
});

test("le mot de passe de job est aléatoire et conforme aux règles de forme", () => {
  const first = generateEphemeralPassword();
  const second = generateEphemeralPassword();
  assert.notEqual(first, second);
  assert.ok(first.length >= 12);
  assert.match(first, /[A-Z]/);
  assert.match(first, /[a-z]/);
  assert.match(first, /[0-9]/);
  assert.match(first, /[^A-Za-z0-9]/);
});
