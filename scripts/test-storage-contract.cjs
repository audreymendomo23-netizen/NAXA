const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20261105140000_restore_required_storage_buckets_and_policies.sql");
const sqlTest = read("supabase/tests/20261105140000_storage_bucket_and_policy_contract.sql");
const creditForm = read("src/components/DemandeCreditMarketplaceForm.tsx");
const logoManager = read("src/components/pharmacie/PromoteurLogoManager.tsx");
const logoRoute = read("src/app/api/pharmacie/logo/route.ts");
const creditProofRoute = read("src/app/api/pharmacie/promoteur/credits/[id]/justificatif/route.ts");
const paymentActions = read("src/app/promoteur/paiements/actions.ts");
const binaryE2E = read("scripts/storage-e2e.cjs");
const packageJson = JSON.parse(read("package.json"));
const gitlab = read(".gitlab-ci.yml");

test("les buckets absents du Replay sont restaurés avec visibilité, taille et MIME attendus", () => {
  assert.match(migration, /'pharmacies-photos',[\s\S]*true,\s*524288,\s*array\['image\/jpeg','image\/png','image\/webp'\]/);
  assert.match(migration, /'medicaments',[\s\S]*true,\s*5242880,\s*array\['image\/jpeg','image\/png','image\/webp'\]/);
  assert.match(migration, /on conflict \(id\) do update/);
});

test("les logos Promoteur sont bornés à une pharmacie active rattachée au Promoteur courant", () => {
  assert.match(migration, /promoteur_pharmacy_logo_insert/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /promoteur_pharmacies pp[\s\S]*pp\.actif is true/);
  assert.match(migration, /pharmacies ph[\s\S]*ph\.actif is true/);
  assert.match(logoManager, /\.upload\(path,blob,[\s\S]*upsert:false/);
  assert.match(logoManager, /logos\/\$\{selected\.id\}\/\$\{crypto\.randomUUID\(\)\}\.webp/);
});

test("les endpoints privés vérifient la session et utilisent des liens signés courts", () => {
  assert.match(creditProofRoute, /supabaseServer\(\)/);
  assert.match(creditProofRoute, /row\.origine!=="marketplace"/);
  assert.match(creditProofRoute, /createSignedUrl\(row\.justificatif_path,60/);
  assert.match(creditProofRoute, /NextResponse\.redirect\(signed\.signedUrl\)/);
  assert.match(paymentActions, /\.eq\("promoteur_id", user\.id\)/);
  assert.match(paymentActions, /storage\.from\("preuves-reglements-promoteurs"\)/);
  assert.match(paymentActions, /createSignedUrl|\.storage/);
});

test("les dépôts métier directs et les compensations restent branchés", () => {
  assert.match(creditForm, /authData\.user\.id \+ "\/" \+ crypto\.randomUUID\(\)/);
  assert.match(creditForm, /upsert:\s*false/);
  assert.match(creditForm, /storage\.from\("credit-marketplace-justificatifs"\)/);
  assert.match(creditForm, /storage\.[\s\S]*remove\(\[uploadedPath\]\)/);
  assert.match(logoRoute, /p\.role==="promoteur"/);
  assert.match(logoRoute, /promoteur_pharmacies/);
  assert.match(logoRoute, /ph\.actif!==true/);
});

test("le harnais binaire est limité au Replay, envoie des octets et nettoie les comptes/fichiers", () => {
  assert.match(binaryE2E, /const PROJECT_REF = "pwfftcsjyeibxxqhwysw"/);
  assert.match(binaryE2E, /method: "POST"/);
  assert.match(binaryE2E, /Buffer\.from/);
  assert.match(binaryE2E, /download\(bucket, path, token\)/);
  assert.match(binaryE2E, /createTemporaryUser/);
  assert.match(binaryE2E, /deleteUser\(id\)/);
  assert.match(binaryE2E, /removeWithAdmin/);
  assert.match(binaryE2E, /NAXA_STORAGE_E2E_REQUIRE_ROLE_MATRIX/);
});

test("le contrat SQL couvre les accès privés et le propriétaire des justificatifs", () => {
  assert.match(sqlTest, /pharmacie_documents_storage_admin_insert/);
  assert.match(sqlTest, /pharmacie_documents_storage_admin_select/);
  assert.match(sqlTest, /pharmacie_documents_storage_admin_update/);
  assert.match(sqlTest, /pharmacie_documents_storage_admin_delete/);
  assert.match(sqlTest, /credit_marketplace_proof_insert_own/);
  assert.match(sqlTest, /credit_marketplace_proof_read_own/);
  assert.match(sqlTest, /credit_marketplace_proof_delete_own/);
  assert.match(sqlTest, /server-mediated/);
  assert.match(sqlTest, /preuves-reglements-promoteurs/);
});

process.stdout.write("Contrat Storage NAXA vérifié.\n");

test("le test binaire est exposé en commande et en job GitLab manuel sans déploiement", () => {
  assert.equal(packageJson.scripts["test:storage:e2e"], "node scripts/storage-e2e.cjs");
  assert.match(gitlab, /storage_binary_e2e:/);
  assert.match(gitlab, /NAXA_STORAGE_E2E_ENABLED == "1"/);
  assert.doesNotMatch(gitlab, /deploy_storage|vercel deploy/i);
});
