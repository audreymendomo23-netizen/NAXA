"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertReplayUrl,
  assertUniverseStatus,
  EXPECTED_UNIVERSES,
  PUBLIC_PICKER,
  LOCKED_MENU,
  LOCKED_ROUTES,
} = require("./e2e/verify-universe-menu-browser.cjs");

test("statut public exige exactement les six écosystèmes et les deux alias Dispositifs/Suivi", () => {
  assert.equal(assertUniverseStatus({ universes: { ...EXPECTED_UNIVERSES } }), true);
  assert.equal(PUBLIC_PICKER.length, 6);
  assert.equal(new Set(PUBLIC_PICKER.map(item => item.id)).size, 6);
  assert.equal(LOCKED_MENU.length, 5);
  assert.equal(LOCKED_ROUTES.length, 6);
});

test("les six cartes possèdent un identifiant de sélection stable", () => {
  assert.deepEqual(PUBLIC_PICKER.map(item => item.id), [
    "pharmacie","parapharmacie","bebe-maman","dispositifs","examens","prestations",
  ]);
});

test("le statut fail-closed refuse un slug manquant, un slug ouvert ou une réponse inconnue", () => {
  const missing = { universes: { ...EXPECTED_UNIVERSES } };
  delete missing.universes.examens;
  assert.throws(() => assertUniverseStatus(missing), /examens/);
  assert.throws(() => assertUniverseStatus({
    universes: { ...EXPECTED_UNIVERSES, prestations: true },
  }), /prestations/);
  assert.throws(() => assertUniverseStatus({}), /invalide/);
});

test("l'API et le navigateur restent strictement limités au projet Replay", () => {
  assert.equal(assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co"), "https://pwfftcsjyeibxxqhwysw.supabase.co");
  assert.throws(() => assertReplayUrl("https://eouwtuusnsuxaejsxknf.supabase.co"), /Replay/);
  assert.throws(() => assertReplayUrl("http://pwfftcsjyeibxxqhwysw.supabase.co"), /Replay/);
});
