"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertReplayUrl,
  chooseHybridPharmacies,
  buildProfileMetadata,
  generateEphemeralPassword,
} = require("./e2e/provision-replay-promoteur-safe.cjs");

test("le provisionneur sécurisé reste strictement limité à Replay", () => {
  assert.equal(assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co"), "https://pwfftcsjyeibxxqhwysw.supabase.co");
  assert.throws(() => assertReplayUrl("https://eouwtuusnsuxaejsxknf.supabase.co"), /limité au projet Supabase Replay/);
  assert.throws(() => assertReplayUrl("http://pwfftcsjyeibxxqhwysw.supabase.co"), /limité au projet Supabase Replay/);
  assert.throws(() => assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co.evil.invalid"), /limité au projet Supabase Replay/);
});

test("il sélectionne exactement deux pharmacies démo HYBRIDE actives et libres", () => {
  const pharmacies = [
    { id: "p1", est_demo: true, actif: true, visible_recherche: true, archivee_le: null },
    { id: "p2", est_demo: true, actif: true, visible_recherche: true, archivee_le: null },
    { id: "p3", est_demo: true, actif: true, visible_recherche: true, archivee_le: null },
    { id: "p4", est_demo: false, actif: true, visible_recherche: true, archivee_le: null },
  ];
  const architectures = ["p1", "p2", "p3", "p4"].map(pharmacie_id => ({ pharmacie_id, architecture_code: "HYBRIDE", active: true }));
  const links = [{ promoteur_id: "other", pharmacie_id: "p1", actif: true }];
  assert.deepEqual(chooseHybridPharmacies(pharmacies, architectures, links, "new"), ["p2", "p3"]);
});

test("il préserve les liens existants du Promoteur courant et exclut les autres", () => {
  const pharmacies = ["p1", "p2", "p3"].map(id => ({ id, est_demo: true, actif: true, visible_recherche: true, archivee_le: null }));
  const architectures = pharmacies.map(p => ({ pharmacie_id: p.id, architecture_code: "HYBRIDE", active: true }));
  const links = [
    { promoteur_id: "same", pharmacie_id: "p2", actif: true },
    { promoteur_id: "other", pharmacie_id: "p1", actif: true },
  ];
  assert.deepEqual(chooseHybridPharmacies(pharmacies, architectures, links, "same"), ["p2", "p3"]);
});

test("il refuse si deux pharmacies démo HYBRIDE actives sont indisponibles", () => {
  assert.throws(() => chooseHybridPharmacies([], [], [], "new"), /Deux pharmacies démo actives HYBRIDE/);
});

test("les métadonnées sont explicitement marquées comme fixture de recette majeure", () => {
  const metadata = buildProfileMetadata();
  assert.equal(metadata.naxa_signup_pending, false);
  assert.equal(metadata.naxa_signup_completed, true);
  assert.equal(metadata.naxa_e2e_promoteur, true);
  assert.equal(metadata.naxa_e2e_fixture, true);
  assert.equal(metadata.phone_country, "CM");
  assert.match(metadata.username, /^[a-z0-9][a-z0-9._-]{2,29}$/);
});

test("le mot de passe de job est aléatoire et respecte la forme attendue", () => {
  const first = generateEphemeralPassword();
  const second = generateEphemeralPassword();
  assert.notEqual(first, second);
  assert.ok(first.length >= 12);
  assert.match(first, /[A-Z]/);
  assert.match(first, /[a-z]/);
  assert.match(first, /[0-9]/);
  assert.match(first, /[^A-Za-z0-9]/);
});
