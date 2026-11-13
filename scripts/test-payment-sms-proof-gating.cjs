const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/lib/promoteurPaymentSms.ts");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    strict: true,
  },
}).outputText;
const moduleRef = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleRef,
  exports: moduleRef.exports,
  require,
});
const { isPayerSmsEligibleForAutomaticMatch, parsePromoteurPaymentSms } = moduleRef.exports;

assert.equal(typeof isPayerSmsEligibleForAutomaticMatch, "function");

const complete = {
  channel: "mtn_momo",
  direction: "payer_debit",
  success: true,
  amount: 2500,
  reference: "MTN-REF-2026-12345",
  occurredAt: "2026-11-13T18:20:00.000Z",
  payerNumber: "237699000000",
  merchantNumber: "237677000000",
  merchantLabel: "Pharmacie",
  senderId: null,
  senderTrusted: false,
  parser: "rules",
  quality: "complete",
};

assert.equal(isPayerSmsEligibleForAutomaticMatch(complete), true,
  "un SMS de débit complet doit être éligible");

const parsedCompleteMtn = parsePromoteurPaymentSms(
  "Votre paiement de 2 500 FCFA à Pharmacie NAXA (237677000000) a été finalisé à 2026-11-13 18:20:00. Identifiant de transaction financière : MTN-REF-2026-12345",
  "mtn_momo"
);
assert.equal(parsedCompleteMtn?.quality, "complete",
  "le format MTN complet du Cameroun doit fournir une preuve de débit exploitable");
assert.equal(isPayerSmsEligibleForAutomaticMatch(parsedCompleteMtn), true,
  "le SMS MTN complet extrait doit être éligible");

const parsedIncompleteMtn = parsePromoteurPaymentSms(
  "Votre paiement de 2 500 FCFA à Pharmacie NAXA (237677000000) a été finalisé à 2026-11-13 18:20:00.",
  "mtn_momo"
);
assert.equal(parsedIncompleteMtn?.quality, "incomplete",
  "le SMS MTN sans ID de transaction doit être reconnu comme incomplet");
assert.equal(isPayerSmsEligibleForAutomaticMatch(parsedIncompleteMtn), false,
  "le SMS MTN sans ID ne doit jamais déclencher le rapprochement automatique");

assert.equal(isPayerSmsEligibleForAutomaticMatch({ ...complete, quality: "incomplete" }), false,
  "un SMS reconnu mais incomplet ne doit jamais être une preuve automatique");

assert.equal(isPayerSmsEligibleForAutomaticMatch({ ...complete, amount: null }), false,
  "un montant absent ne doit pas être remplacé par le montant déclaré");

assert.equal(isPayerSmsEligibleForAutomaticMatch({ ...complete, reference: null }), false,
  "une référence absente ne doit pas être remplacée par la référence saisie");

assert.equal(isPayerSmsEligibleForAutomaticMatch({ ...complete, direction: "merchant_credit" }), false,
  "un SMS de crédit ne peut pas être présenté comme le SMS de débit Client");

assert.equal(isPayerSmsEligibleForAutomaticMatch(null), false,
  "un SMS non reconnu doit rester en revue manuelle");

assert.equal(isPayerSmsEligibleForAutomaticMatch(complete, { amountManuallyEdited: true }), false,
  "une correction manuelle du montant retire l'éligibilité automatique");

assert.equal(isPayerSmsEligibleForAutomaticMatch(complete, { referenceManuallyEdited: true }), false,
  "une correction manuelle de la référence retire l'éligibilité automatique");

assert.equal(isPayerSmsEligibleForAutomaticMatch(complete, { dateManuallyEdited: true }), false,
  "une date corrigée ne doit pas remplacer l'horodatage présent dans le SMS");

const orangeWithoutProviderDate = { ...complete, channel: "orange_money", occurredAt: null };
assert.equal(isPayerSmsEligibleForAutomaticMatch(orangeWithoutProviderDate, { dateManuallyEdited: true }), true,
  "une correction de date ne bloque pas la preuve lorsque le SMS Orange ne fournit aucun horodatage");

const partnerRoute = read("src/app/api/client/paiements/univers/share/route.ts");
const deliveryRoute = read("src/app/api/client/paiements/livraison/share/route.ts");
assert.match(partnerRoute, /isPayerSmsEligibleForAutomaticMatch/);
assert.match(deliveryRoute, /isPayerSmsEligibleForAutomaticMatch/);
assert.match(partnerRoute, /p_proof_source:completePayerSms\?"shared_sms":"manual_entry"/);
assert.match(deliveryRoute, /p_proof_source: parsedProof \? "shared_sms" : "manual_entry"/);

assert.match(partnerRoute, /p_payer_number:completePayerSms\?\(extractedPayer\?\.payerNumber\?\?null\):\(payerNumber\|\|null\)/);
assert.match(deliveryRoute, /p_payer_number: parsedProof \? \(extractedPayer\?\.payerNumber \?\? null\) : \(payerNumber \|\| null\)/);

console.log("PASS — SMS partiel/corrigé bloqué en preuve automatique ; complétude commune appliquée aux parcours Pharmacie et Partenaire.");
