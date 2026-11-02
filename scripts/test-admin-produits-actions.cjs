const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "../src/app/admin/produits/actions.ts"),
  "utf8",
);
const photoUpload = fs.readFileSync(
  path.join(__dirname, "../src/components/PhotoUpload.tsx"),
  "utf8",
);
const adminProfile = fs.readFileSync(
  path.join(__dirname, "../src/app/admin/profil/page.tsx"),
  "utf8",
);

test("les deux actions de fiche sont réservées à un administrateur actif", () => {
  assert.match(source, /requireAdminActive\("\/admin\/produits"\)/);
  assert.equal((source.match(/await exigerAdmin\(\)/g) ?? []).length, 2);
});

test("les identifiants de produit sont validés avant lecture ou mutation", () => {
  assert.ok(source.includes("const UUID = /^[0-9a-f]{8}-"));
  assert.equal((source.match(/if \(!UUID\.test\(id\)\)/g) ?? []).length, 2);
});

test("enregistrerFiche ne confirme jamais une mise à jour sans ligne retournée", () => {
  const start = source.indexOf("export async function enregistrerFiche");
  const end = source.indexOf("export async function brouillonIA", start);
  const action = source.slice(start, end);
  assert.match(action, /\.update\(\{/);
  assert.match(action, /\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(action, /if \(error \|\| updated\?\.id !== id\) redirect\(/);
  assert.ok(action.indexOf("updated?.id !== id") < action.indexOf("&ok=1"));
});

test("brouillonIA vérifie la ligne produite avant de déclarer le succès", () => {
  const start = source.indexOf("export async function brouillonIA");
  const action = source.slice(start);
  assert.match(action, /productError \|\| !p/);
  assert.match(action, /\.update\(\{ \.\.\.fiche/);
  assert.match(action, /\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(action, /updateError \|\| updated\?\.id !== id/);
  assert.ok(action.indexOf("updated?.id !== id") < action.indexOf("&ok=ia"));
});
process.stdout.write("Contrat actions fiches produits Admin vérifié.\n");

test("l'upload ne confirme pas une photo si les métadonnées produit n'ont pas été enregistrées", () => {
  assert.match(photoUpload, /\.eq\("id", produitId\)\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(photoUpload, /updateError \|\| updated\?\.id !== produitId/);
  assert.match(photoUpload, /if \(chemin\) await sb\.storage\.from\("medicaments"\)\.remove\(\[chemin\]\)/);
  assert.ok(photoUpload.indexOf("updated?.id !== produitId") < photoUpload.indexOf('setEtat("ok")'));
});

test("le profil personnel ne confirme pas une mise à jour sans ligne retournée", () => {
  assert.match(adminProfile, /\.eq\("id", auth\.user\.id\)\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(adminProfile, /updateError \|\| updated\?\.id !== auth\.user\.id/);
  assert.ok(adminProfile.indexOf("updated?.id !== auth.user.id") < adminProfile.indexOf('setMessage("Profil mis à jour.")'));
});
