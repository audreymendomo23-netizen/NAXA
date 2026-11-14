"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertReplayUrl,
  chooseHybridPharmacies,
  chooseUnlinkedHybridPharmacy,
  buildPromoteurProfilePatch,
  buildProfileMetadata,
  generateEphemeralPassword,
} = require("./e2e/provision-replay-promoteur-safe-v2.cjs");

test("URL Replay only : Production and spoofed hosts are rejected", () => {
  assert.equal(assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co"), "https://pwfftcsjyeibxxqhwysw.supabase.co");
  assert.throws(() => assertReplayUrl("https://eouwtuusnsuxaejsxknf.supabase.co"), /limité au projet Supabase Replay/);
  assert.throws(() => assertReplayUrl("http://pwfftcsjyeibxxqhwysw.supabase.co"), /limité au projet Supabase Replay/);
  assert.throws(() => assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co.evil.invalid"), /limité au projet Supabase Replay/);
});

test("sélectionne deux pharmacies démo HYBRIDE à rattacher", () => {
  const pharmacies = ["p1","p2","p3","p4"].map(id => ({ id, est_demo:true, actif:true, visible_recherche:true, archivee_le:null }));
  const architectures = pharmacies.map(p => ({ pharmacie_id:p.id, architecture_code:"HYBRIDE", active:true }));
  const links = [{ promoteur_id:"other", pharmacie_id:"p1", actif:true }];
  assert.deepEqual(chooseHybridPharmacies(pharmacies, architectures, links, "new"), ["p2","p3"]);
});

test("choisit une troisième pharmacie HYBRIDE libre et non rattachée", () => {
  const pharmacies = ["p1","p2","p3","p4"].map(id => ({ id, est_demo:true, actif:true, visible_recherche:true, archivee_le:null }));
  const architectures = pharmacies.map(p => ({ pharmacie_id:p.id, architecture_code:"HYBRIDE", active:true }));
  const links = [
    { promoteur_id:"same", pharmacie_id:"p1", actif:true },
    { promoteur_id:"same", pharmacie_id:"p2", actif:true },
    { promoteur_id:"other", pharmacie_id:"p3", actif:true },
  ];
  assert.equal(chooseUnlinkedHybridPharmacy(pharmacies,architectures,links,"same",["p1","p2"]),"p4");
});

test("refuse de prendre comme pharmacie tierce un établissement déjà lié", () => {
  const pharmacies = ["p1","p2","p3"].map(id => ({ id, est_demo:true, actif:true, visible_recherche:true, archivee_le:null }));
  const architectures = pharmacies.map(p => ({ pharmacie_id:p.id, architecture_code:"HYBRIDE", active:true }));
  const links = [{ promoteur_id:"same", pharmacie_id:"p3", actif:true }];
  assert.throws(() => chooseUnlinkedHybridPharmacy(pharmacies,architectures,links,"same",["p1","p2"]), /troisième pharmacie démo HYBRIDE/);
});

test("refuse les pharmacies sans architecture HYBRIDE ou non démo/actives", () => {
  const pharmacies = [
    { id:"p1", est_demo:true, actif:true, visible_recherche:true, archivee_le:null },
    { id:"p2", est_demo:false, actif:true, visible_recherche:true, archivee_le:null },
    { id:"p3", est_demo:true, actif:false, visible_recherche:true, archivee_le:null },
  ];
  const architectures = pharmacies.map(p => ({ pharmacie_id:p.id, architecture_code:"ORPHELIN", active:true }));
  assert.throws(() => chooseUnlinkedHybridPharmacy(pharmacies,architectures,[],"same",[]), /troisième pharmacie démo HYBRIDE/);
});

test("finalise le Promoteur comme propriétaire racine de l'architecture HYBRIDE", () => {
  assert.deepEqual(buildPromoteurProfilePatch("pharmacy-uuid"), {
    role: "promoteur",
    actif: true,
    pharmacie_id: "pharmacy-uuid",
    fonction_interne: "promoteur",
    niveau_interne: 1,
    niveau_hierarchique: 1,
    architecture_code: "HYBRIDE",
  });
});

test("les métadonnées du compte restent explicitement réservées à la recette", () => {
  const metadata = buildProfileMetadata();
  assert.equal(metadata.naxa_signup_pending,false);
  assert.equal(metadata.naxa_signup_completed,true);
  assert.equal(metadata.naxa_e2e_promoteur,true);
  assert.equal(metadata.naxa_e2e_fixture,true);
  assert.equal(metadata.phone_country,"CM");
});

test("le mot de passe éphémère de chaque job est aléatoire", () => {
  const a=generateEphemeralPassword(), b=generateEphemeralPassword();
  assert.notEqual(a,b);
  assert.ok(a.length>=12);
  assert.match(a,/[A-Z]/);
  assert.match(a,/[a-z]/);
  assert.match(a,/[0-9]/);
  assert.match(a,/[^A-Za-z0-9]/);
});
