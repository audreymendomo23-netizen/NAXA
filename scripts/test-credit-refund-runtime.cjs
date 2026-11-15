"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { assertReplayUrl } = require("./e2e/verify-credit-refund-runtime.cjs");

test("credit refund runtime E2E is pinned to the NAXA Replay project", () => {
  assert.equal(
    assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co"),
    "https://pwfftcsjyeibxxqhwysw.supabase.co",
  );
});

test("credit refund runtime E2E refuses Production and non-HTTPS endpoints", () => {
  assert.throws(() => assertReplayUrl("https://eouwtuusnsuxaejsxknf.supabase.co"), /limité au projet Replay/);
  assert.throws(() => assertReplayUrl("http://pwfftcsjyeibxxqhwysw.supabase.co"), /limité au projet Replay/);
  assert.throws(() => assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co/other"), /limité au projet Replay/);
});
