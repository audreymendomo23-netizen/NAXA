const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "../src/app/admin/univers/actions.ts"),
  "utf8",
);

function action(name, nextName) {
  const start = source.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `action absente: ${name}`);
  const end = nextName
    ? source.indexOf(`export async function ${nextName}(`, start)
    : source.length;
  return source.slice(start, end === -1 ? source.length : end);
}

test("toutes les mutations de partenaires et d'univers exigent un Admin actif", () => {
  assert.match(source, /requireAdminActive\("\/admin\/univers"\)/);
  assert.match(source, /async function admin\(\)/);
});

test("le changement de statut partenaire ne journalise pas une mise à jour zéro ligne", () => {
  const body = action("changerStatutPartenaire", "changerActivationUnivers");
  assert.match(body, /\.update\(patch\)[\s\S]*?\.eq\("id", id\)\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(body, /error \|\| updated\?\.id !== id/);
  assert.ok(body.indexOf("updated?.id !== id") < body.indexOf('action: "partner.status_changed"'));
});

test("la suppression d'un compte de test exige une ligne réellement supprimée", () => {
  const body = action("retirerCompteTestSuivi", "creerProduitPartenaire");
  assert.match(body, /\.delete\(\)\.eq\("user_id", userId\)\.select\("user_id"\)\.maybeSingle\(\)/);
  assert.match(body, /error \|\| deleted\?\.user_id !== userId/);
  assert.ok(body.indexOf("deleted?.user_id !== userId") < body.indexOf('action: "tracking.test_account_removed"'));
});

test("le changement de statut d'un produit partenaire vérifie la ligne modifiée", () => {
  const body = action("changerStatutProduitPartenaire", "ajouterProfessionnelSuivi");
  assert.match(body, /\.update\(\{ status, updated_at:[\s\S]*?\.eq\("id", id\)\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(body, /error \|\| updated\?\.id !== id/);
  assert.ok(body.indexOf("updated?.id !== id") < body.indexOf('action: "partner_product.status_changed"'));
});

test("la désactivation d'un professionnel vérifie la ligne modifiée", () => {
  const body = action("retirerProfessionnelSuivi");
  assert.match(body, /\.update\(\{ verified: false \}\)[\s\S]*?\.eq\("user_id", userId\)\.select\("user_id"\)\.maybeSingle\(\)/);
  assert.match(body, /error \|\| updated\?\.user_id !== userId/);
  assert.ok(body.indexOf("updated?.user_id !== userId") < body.indexOf('action: "tracking.professional_unverified"'));
});

process.stdout.write("Contrat des mutations Admin univers/partenaires vérifié.\n");
