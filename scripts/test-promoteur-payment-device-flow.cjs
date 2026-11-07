const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20261107075228_promoteur_payment_device_capture_20261107.sql");
const register = read("src/app/api/promoteur/paiements/device/register/route.ts");
const intent = read("src/app/api/promoteur/paiements/intent/route.ts");
const capture = read("src/app/api/promoteur/paiements/capture/route.ts");
const page = read("src/app/promoteur/paiements/page.tsx");
const panel = read("src/components/promoteur/PaymentIntentPanel.tsx");
const audit = read("docs/audits/AUDIT_PAIEMENT_PROMOTEUR_CAPTURE_ANDROID_NAXA.md");

test("les données capture Android sont isolées et inaccessibles au client", () => {
  for (const table of ["naxa_promoteur_payment_devices", "naxa_promoteur_payment_intents", "naxa_promoteur_payment_capture_events"]) {
    assert.match(migration, new RegExp("alter table public\\." + table + " enable row level security"));
    assert.match(migration, new RegExp("revoke all on public\\." + table + " from public, anon, authenticated"));
  }
  assert.match(migration, /device_token_hash/);
  assert.match(migration, /payload_sha256/);
});

test("seul un Promoteur actif peut enrôler son téléphone avec sa session", () => {
  assert.match(register, /admin\.auth\.getUser\(accessToken\)/);
  assert.match(register, /profile\?\.role !== "promoteur"/);
  assert.match(register, /hashDeviceToken\(token\)/);
  assert.doesNotMatch(register, /console\.(log|error).*token/);
});

test("le paiement est préparé avant débit, montant et destination viennent du serveur", () => {
  assert.match(intent, /abonnements_promoteurs/);
  assert.match(intent, /naxa_promoteur_payment_devices/);
  assert.match(intent, /x-naxa-device-token/);
  assert.match(intent, /x-naxa-device-id/);
  assert.match(intent, /expected_amount: subscription\.montant_mensuel/);
  assert.match(intent, /status: "awaiting_payment"/);
  assert.match(page, /PaymentIntentPanel/);
  assert.match(panel, /la page web ne peut pas préparer un paiement à la place de ce téléphone/i);
});

test("la notification doit correspondre exactement au montant et au bénéficiaire", () => {
  assert.match(capture, /amount === intent\.expected_amount/);
  assert.match(capture, /normalize\(recipientReference\) === normalize\(destination\.reference_destination\)/);
  assert.match(capture, /unique|23505/);
  assert.match(capture, /device_token_hash/);
});

test("la capture crée seulement une déclaration en attente et ne confirme jamais l'abonnement", () => {
  assert.match(capture, /promoteur_soumettre_reglement/);
  assert.match(capture, /pending_admin_confirmation/);
  assert.doesNotMatch(capture, /admin_confirmer_reglement_promoteur/);
  assert.doesNotMatch(capture, /abonnements_promoteurs.*update/);
  assert.match(audit, /Seule la vérification indépendante par NAXA/);
});

test("le Promoteur est invité à vérifier sa session et le même téléphone Android", () => {
  assert.match(panel, /Compagnon Android non connecté/);
  assert.match(panel, /même compte/);
  assert.match(panel, /ce même téléphone/);
  assert.match(panel, /Ne partagez jamais votre code PIN ni un OTP/);
  assert.match(audit, /ne contient aucun projet Android/);
});

process.stdout.write("Contrat capture paiement Android Promoteur vérifié.\\n");
