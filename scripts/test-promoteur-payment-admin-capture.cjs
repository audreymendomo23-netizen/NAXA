const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const files = [
  "src/app/api/admin/paiements/device/register/route.ts",
  "src/app/api/admin/paiements/capture/route.ts",
  "src/lib/promoteurPaymentProofOcr.ts",
  "src/components/admin/PromoteurPaymentProofOcr.tsx",
  "src/app/admin/pilotage/reglements/actions.ts",
  "src/app/admin/pilotage/reglements/page.tsx",
  "src/app/api/promoteur/paiements/capture/route.ts",
  "src/app/api/promoteur/paiements/share/route.ts",
  "src/app/api/client/paiements/livraison/share/route.ts",
  "src/app/api/admin/paiements/share/route.ts",
  "src/components/DeliveryPaymentSelector.tsx",
];
const sources = Object.fromEntries(files.map(file => [file, read(file)]));
const migration = read("supabase/migrations/20261111022000_promoteur_payment_admin_sms_auto_confirm.sql");
const rpcMigration = read("supabase/migrations/20261111022500_promoteur_payment_admin_sms_auto_confirm_rpc.sql");
const declarationFix = read("supabase/migrations/20261111023000_promoteur_payment_declaration_sms_received_at_fix.sql");
const dualProofMigration = read("supabase/migrations/20261113152925_promoteur_payment_require_dual_sms_proofs.sql");
const deliveryProofMigration = read("supabase/migrations/20261113152922_payment_sms_declarations_and_dual_proof_guard.sql");
const sqlTest = read("supabase/tests/promoteur_payment_admin_sms_auto_confirm.sql");
const androidRoot = "android/payment-companion/";
const androidManifest = read(androidRoot + "app/src/main/AndroidManifest.xml");
const androidAdminManifest = read(androidRoot + "app/src/admin/AndroidManifest.xml");
const androidShareActivity = read(androidRoot + "app/src/main/java/cm/naxa/paymentcompanion/PaymentShareActivity.kt");
const androidParser = read(androidRoot + "app/src/main/java/cm/naxa/paymentcompanion/SmsPaymentParser.kt");
const androidReceiver = read(androidRoot + "app/src/main/java/cm/naxa/paymentcompanion/SmsReceiver.kt");
const androidClassifier = read(androidRoot + "app/src/main/java/cm/naxa/paymentcompanion/SmsOriginClassifier.kt");
const androidApi = read(androidRoot + "app/src/main/java/cm/naxa/paymentcompanion/NaxaApi.kt");
const androidVault = read(androidRoot + "app/src/main/java/cm/naxa/paymentcompanion/SecureVault.kt");
const androidBuild = read(androidRoot + "app/build.gradle");
const androidRootBuild = read(androidRoot + "build.gradle");
const androidReadme = read(androidRoot + "README.md");
const paymentOcrAssets = read("src/app/api/ocr-assets/[...asset]/route.ts");

test("toutes les nouvelles routes/composants TypeScript se transpilent", () => {
  for (const [file, source] of Object.entries(sources)) {
    const isTsx = file.endsWith(".tsx");
    const result = ts.transpileModule(source, {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: isTsx ? ts.JsxEmit.ReactJSX : ts.JsxEmit.Preserve,
      },
    });
    const errors = (result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 0, file + ": " + errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, "\n")).join(" | "));
  }
});

test("enrôlement Admin : rôle actif, canal et destination réelle", () => {
  const source = sources["src/app/api/admin/paiements/device/register/route.ts"];
  assert.match(source, /profile\?\.role !== "admin"/);
  assert.match(source, /profile\.actif !== true/);
  assert.match(source, /naxa_payment_destinations/);
  assert.match(source, /hashDeviceToken\(token\)/);
  assert.match(source, /Cache-Control.*no-store/);
});

test("capture Admin : expéditeur brut exact et SMS crédit seulement", () => {
  const source = sources["src/app/api/admin/paiements/capture/route.ts"];
  assert.match(source, /senderOriginAddress/);
  assert.match(source, /MobileMoney/);
  assert.match(source, /OrangeMoney/);
  assert.match(source, /senderOriginAddress !== expectedSender/);
  assert.match(source, /direction === "merchant_credit"/);
  assert.match(source, /payloadHash/);
  assert.match(source, /naxa_promoteur_payment_auto_confirm_admin_sms/);
});

test("capture Admin : ambiguïté ou payeur non identifiable interdit le renouvellement", () => {
  const source = sources["src/app/api/admin/paiements/capture/route.ts"];
  assert.match(source, /pendingMatches\.length > 1/);
  assert.match(source, /match_status: "ambiguous"/);
  assert.match(source, /if \(!declaredPhone \|\| declaredPhone !== phoneTail\(parsed\.payerNumber\)\) return false/);
  assert.match(source, /status: "manual_review"/);
  assert.match(dualProofMigration, /source_level=1/);
  assert.match(dualProofMigration, /payer_sms/);
  assert.match(dualProofMigration, /source_level=2/);
  assert.match(dualProofMigration, /merchant_sms/);
});

test("les références de débit et de crédit peuvent différer mais doivent prouver le même règlement", () => {
  assert.match(dualProofMigration, /c\.source_level=1\s+and c\.source_type='payer_sms'/);
  assert.match(dualProofMigration, /c\.reference_normalisee=e\.reference_normalisee/);
  assert.match(dualProofMigration, /c\.source_level=2\s+and c\.source_type='merchant_sms'/);
  assert.doesNotMatch(
    dualProofMigration,
    /c\.reference_normalisee=e\.reference_normalisee\s+and c\.canal=e\.canal\s+and c\.source_level=1/
  );
});

test("OCR : fichier image/PDF local, limite pages, aucun texte brut persistant", () => {
  const ocr = sources["src/lib/promoteurPaymentProofOcr.ts"];
  const action = sources["src/app/admin/pilotage/reglements/actions.ts"];
  const component = sources["src/components/admin/PromoteurPaymentProofOcr.tsx"];
  assert.match(ocr, /application\/pdf/);
  assert.match(ocr, /Math\.min\(pdf\.numPages, 3\)/);
  assert.match(ocr, /createWorker\("fra\+eng"/);
  assert.match(paymentOcrAssets, /eng\.traineddata\.gz/);
  assert.match(ocr, /worker\.recognize/);
  assert.match(action, /rawTextStored: false/);
  assert.match(action, /verification_details: details/);
  assert.doesNotMatch(action, /verification_details:.*ocrText/);
  assert.match(component, /lirePreuvePaiement/);
  assert.match(component, /analyserPreuvePaiementOcr/);
});

test("interface Admin affiche l'historique SMS et le lanceur OCR", () => {
  const page = sources["src/app/admin/pilotage/reglements/page.tsx"];
  assert.match(page, /naxa_admin_payment_capture_events/);
  assert.match(page, /SMS reçus sur le téléphone Admin/);
  assert.match(page, /PromoteurPaymentProofOcr/);
});

test("migration SQL réserve l'accès aux RPC et aux tables Admin", () => {
  assert.match(migration, /naxa_admin_payment_devices/);
  assert.match(migration, /naxa_admin_payment_capture_events/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.naxa_admin_payment_devices from public,anon,authenticated/);
  assert.match(migration, /naxa_admin_payment_capture_reference_unique/);
  assert.match(rpcMigration, /naxa_promoteur_payment_auto_confirm_admin_sms/);
  assert.match(rpcMigration, /admin_confirmer_reglement_promoteur/);
  assert.match(rpcMigration, /service_role/);
  assert.match(declarationFix, /provider_occurred_at,sms_received_at/);
  assert.match(dualProofMigration, /naxa_promoteur_payment_auto_confirm_admin_sms/);
  assert.match(deliveryProofMigration, /naxa_client_declarer_paiement_livraison_v2/);
  assert.match(deliveryProofMigration, /payer_number/);
  assert.match(deliveryProofMigration, /declared_amount/);
  assert.match(sqlTest, /has_function_privilege/);
});


test("compagnon Android : la variante standard ne déclare aucune permission de lecture SMS", () => {
  assert.doesNotMatch(androidManifest, /RECEIVE_SMS|READ_SMS/);
  assert.doesNotMatch(androidManifest, /SmsReceiver/);
  assert.match(androidManifest, /android\.intent\.action\.SEND/);
  assert.match(androidManifest, /text\/plain/);
  assert.match(androidShareActivity, /Intent\.ACTION_SEND/);
  assert.match(androidShareActivity, /EXTRA_TEXT/);
  assert.match(androidAdminManifest, /android\.permission\.RECEIVE_SMS/);
  assert.doesNotMatch(androidAdminManifest, /READ_SMS|NotificationListenerService/);
  assert.match(androidReceiver, /Telephony\.Sms\.Intents\.getMessagesFromIntent/);
  assert.match(androidReceiver, /originatingAddress/);
  assert.match(androidReceiver, /role, hasExplicitConsent, hasAndroidPermission/);
  assert.doesNotMatch(androidReceiver, /getDisplayOriginatingAddress/);
});

test("compagnon Android : capture Admin uniquement et partage volontaire Client/Promoteur", () => {
  assert.match(androidClassifier, /"OrangeMoney" ->/);
  assert.match(androidClassifier, /"MobileMoney" ->/);
  assert.doesNotMatch(androidClassifier, /uppercase|replace\(Regex/);
  assert.match(androidReceiver, /SmsOriginClassifier\.channelFromRawOrigin/);
  assert.match(androidApi, /api\/admin\/paiements\/capture/);
  assert.match(androidApi, /api\/promoteur\/paiements\/share/);
  assert.match(androidApi, /api\/client\/paiements\/livraison\/share/);
  assert.doesNotMatch(androidApi, /api\/promoteur\/paiements\/capture/);
  assert.match(androidShareActivity, /submitPromoterPayment/);
  assert.match(androidShareActivity, /submitClientPayment/);
  assert.match(androidParser, /payer_debit/);
  assert.match(androidBuild, /ADMIN_CAPTURE_ENABLED/);
  assert.match(androidBuild, /productFlavors/);
  assert.match(sources["src/app/api/promoteur/paiements/capture/route.ts"], /status: 410/);
});

test("compagnon Android : jetons chiffres par Android Keystore AES-GCM", () => {
  assert.match(androidVault, /AndroidKeyStore/);
  assert.match(androidVault, /AES\/GCM\/NoPadding/);
  assert.doesNotMatch(androidVault, /smsText|smsBody|messageBody/);
  assert.match(androidApi, /deviceToken/);
  assert.match(androidApi, /smsReceivedAt/);
});

test("compagnon Android : versions Gradle/API et restriction Play Protect documentees", () => {
  assert.match(androidRootBuild, /9\.4\.0/);
  assert.match(androidBuild, /compileSdk 36/);
  assert.match(androidBuild, /targetSdk 36/);
  assert.match(androidReadme, /hard-restricted/);
  assert.match(androidReadme, /Play Protect/);
  assert.match(androidReadme, /ne jamais désactiver Play Protect/i);
});
