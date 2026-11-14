const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const ussd = fs.readFileSync(path.join(root, "src/lib/merchant-payment.ts"), "utf8");
const api = fs.readFileSync(path.join(root, "src/app/api/pay/[id]/route.ts"), "utf8");
const client = fs.readFileSync(path.join(root, "src/components/DeliveryPaymentSelector.tsx"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261113163408_merchant_payment_destinations.sql"), "utf8");

assert.match(ussd, /!Number\.isSafeInteger\(amount\)\s*\|\|\s*amount <= 0/);
assert.match(ussd, /!\/\^\\d\{6\}\$\/\.test\(merchantCode\)/);
assert.match(ussd, /\*126\*4\*/);
assert.match(ussd, /#150\*47#/);
assert.match(ussd, /tel:\$\{encodeURIComponent\(ussd\)\}/);
assert.match(api, /\.eq\("client_id", auth\.user\.id\)/);
assert.match(api, /\.eq\("is_active", true\)/);
assert.match(api, /buildMerchantPaymentUssd\(channel, destination\.merchant_code, amount\)/);
assert.match(client, /buildTelephoneUri\(details\.ussd\)/);
assert.match(migration, /naxa_merchant_payment_destination_audit/);
assert.match(migration, /grant execute on function public\.naxa_save_merchant_payment_destination[\s\S]*to service_role/);

console.log("PASS — règles de génération USSD, accès bénéficiaire et audit de configuration marchande.");
