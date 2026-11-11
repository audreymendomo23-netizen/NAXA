const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/lib/promoteurPaymentSms.ts");
const ai = read("src/lib/promoteurPaymentSmsAI.ts");
const migration = read("supabase/migrations/20261111013000_promoteur_payment_three_stage_verification.sql");
const sqlTest = read("supabase/tests/promoteur_payment_three_stage_verification.sql");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
});
const mod = { exports: {} };
new Function("module", "exports", compiled.outputText)(mod, mod.exports);
const sms = mod.exports;

test("OrangeMoney payeur : extrait reference PP, montant, numero et libelle marchand", () => {
  const parsed = sms.parsePromoteurPaymentSms(
    "Paiement de AXX NKOLBISSON PISTE reussi par 699731541 MAKWETSING SOKAMTE. ID transaction: PP261104.2236.A61758, Montant:5000 FCFA. Solde: 64.81 FCFA.",
    "orange_money", "OrangeMoney"
  );
  assert.equal(parsed.direction, "payer_debit");
  assert.equal(parsed.amount, 5000);
  assert.equal(parsed.reference, "pp261104.2236.a61758");
  assert.equal(parsed.merchantLabel, "axx nkolbisson piste");
  assert.equal(parsed.senderTrusted, true);
});

test("OrangeMoney marchand : extrait reference MP et les deux numeros", () => {
  const parsed = sms.parsePromoteurPaymentSms(
    "Payment de 692998468 ATANGANABEKONO par 690557734 MENDOMO NKO reussi. Informations detaillees: ID transaction: MP240510.1622.C30408, Montant transaction:1100 FCFA. Frais:0 FCFA, Commission:11 FCFA, Nouveau Solde:64.81 FCFA.",
    "orange_money", "OrangeMoney"
  );
  assert.equal(parsed.direction, "merchant_credit");
  assert.equal(parsed.amount, 1100);
  assert.equal(parsed.merchantNumber, "692998468");
  assert.equal(parsed.payerNumber, "690557734");
  assert.equal(parsed.reference, "mp240510.1622.c30408");
});

test("MTN debit : date/heure convertie depuis Africa/Douala et ID financier extrait", () => {
  const parsed = sms.parsePromoteurPaymentSms(
    "Votre paiement de 50 XAF a STEVE LOIC AYMAR BISSIONGOL BISSIONGOL (237653928155) a ete finalise a 2026-07-31 19:50:11. Votre nouveau solde : 807 XAF. Identifiant de transaction financiere : 18162121196. ID de transaction externe : -.",
    "mtn_momo", "MobileMoney"
  );
  assert.equal(parsed.direction, "payer_debit");
  assert.equal(parsed.amount, 50);
  assert.equal(parsed.merchantNumber, "237653928155");
  assert.equal(parsed.reference, "18162121196");
  assert.equal(parsed.occurredAt, "2026-07-31T18:50:11.000Z");
});

test("MTN credit : reconnait le SMS recu par le marchand", () => {
  const parsed = sms.parsePromoteurPaymentSms(
    "Vous avez recu 310 XAF de STEVE LOIC AYMAR BISSIONGOL BISSIONGOL (237653928155) sur votre compte mobile money à 2026-07-31 20:55:22. Message de l'expéditeur: 0. Votre nouveau solde: 324 XAF. FRAIS: FCFA 3. Financial Transaction Id: 18163477725.",
    "mtn_momo", "MobileMoney"
  );
  assert.equal(parsed.direction, "merchant_credit");
  assert.equal(parsed.amount, 310);
  assert.equal(parsed.payerNumber, "237653928155");
  assert.equal(parsed.reference, "18163477725");
  assert.equal(parsed.occurredAt, "2026-07-31T19:55:22.000Z");
});

test("MTN Successintegral court est uniquement informatif", () => {
  const parsed = sms.parsePromoteurPaymentSms(
    "Paiement Successintegral de 50 a MARCHAND 237653928155. Merci d'utiliser MTN MoMo.",
    "mtn_momo", "MobileMoney"
  );
  assert.equal(parsed.direction, "informative_only");
  assert.equal(parsed.reference, null);
  assert.equal(parsed.occurredAt, null);
  assert.equal(parsed.quality, "informative_only");
});

test("un expéditeur numérique ou différent de l'ID officiel est rejeté", () => {
  const parsed = sms.parsePromoteurPaymentSms(
    "Paiement de AXX NKOLBISSON PISTE reussi par 699731541 NOM. ID transaction: PP261104.2236.A61758, Montant:5000 FCFA.",
    "orange_money", "699731541"
  );
  assert.equal(parsed.senderTrusted, false);
});

test("preuve manuelle analysée : ne peut jamais renouveler automatiquement", () => {
  const parsed = sms.parsePromoteurPaymentSms(
    "Paiement de AXX NKOLBISSON PISTE reussi par 699731541 NOM. ID transaction: PP261104.2236.A61758, Montant:5000 FCFA.",
    "orange_money", "OrangeMoney"
  );
  const validation = sms.validatePromoteurPaymentSms(parsed, {
    channel: "orange_money",
    amount: 5000,
    payerNumber: "699731541",
    reference: "PP261104.2236.A61758",
    paidAt: new Date().toISOString(),
    merchantName: "AXX NKOLBISSON PISTE",
  }, { provenance: "manual_submission" });
  assert.equal(validation.eligibleForAutomaticConfirmation, false);
  assert.equal(validation.status, "manual_review");
  assert.ok(validation.reasons.some(item => item.includes("transmises manuellement")));
});

test("IA Gemini/Groq : extraction seule, validation de chaque champ source", () => {
  assert.match(ai, /GEMINI_API_KEY/);
  assert.match(ai, /GROQ_API_KEY/);
  assert.match(ai, /temperature: 0/);
  assert.match(ai, /normalizePaymentReference\(raw\)/);
  assert.match(ai, /Never infer missing values/);
  assert.match(ai, /senderTrusted: false/);
});

test("migration : unicite globale des references et suivi separe des horodatages", () => {
  assert.match(migration, /reference_normalisee/);
  assert.match(migration, /naxa_promoteur_payment_reference_claims_unique/);
  assert.match(migration, /provider_occurred_at/);
  assert.match(migration, /sms_received_at/);
  assert.match(migration, /verification_deadline_at/);
  assert.match(migration, /interval '24 hours'/);
  assert.match(migration, /private\.naxa_promoteur_valide/);
  assert.match(sqlTest, /rollback/i);
  assert.match(sqlTest, /has_function_privilege/);
});
