const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "../src/app/admin/univers/actions.ts"),
  "utf8",
);
const notices = fs.readFileSync(
  path.join(__dirname, "../src/components/admin/AdminRappelLotNotice.tsx"),
  "utf8",
);
const universeStatusRoute = fs.readFileSync(
  path.join(__dirname, "../src/app/api/universes/status/route.ts"),
  "utf8",
);
const ecosystemes = fs.readFileSync(
  path.join(__dirname, "../src/lib/ecosystemes.ts"),
  "utf8",
);
const selection = fs.readFileSync(path.join(__dirname, "../src/components/SelectionEcosysteme.tsx"), "utf8");
const clientHeader = fs.readFileSync(path.join(__dirname, "../src/components/EnTeteClient.tsx"), "utf8");
const universeMenu = fs.readFileSync(path.join(__dirname, "../src/components/universes/MenuUnivers.tsx"), "utf8");
const middleware = fs.readFileSync(path.join(__dirname, "../src/middleware.ts"), "utf8");
const faqPage = fs.readFileSync(path.join(__dirname, "../src/app/faq/page.tsx"), "utf8");
const clientShell = fs.readFileSync(path.join(__dirname, "../src/components/ParcoursClientShell.tsx"), "utf8");

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

test("la diffusion d'avis réseau exige un UUID retourné par la RPC avant le succès", () => {
  assert.match(notices, /admin_avis_rappel_lot_diffuser/);
  assert.match(notices, /typeof data !== "string"/);
  assert.ok(notices.includes("/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data)"));
  assert.match(notices, /setMessage\("Avis diffusé aux pharmacies actives/);
  assert.ok(notices.indexOf('typeof data !== "string"') < notices.indexOf('setMessage("Avis diffusé aux pharmacies actives'));
  assert.match(notices, /finally \{\s*setBusy\(false\);\s*\}/);
});

test("les accusés de réception chargent toutes les lignes des avis affichés sans lecture globale", () => {
  assert.match(notices, /\.in\("avis_id",noticeIds\)/);
  assert.match(notices, /\.range\(offset,offset\+pageSize-1\)/);
  assert.match(notices, /\.order\("avis_id",\{ascending:true\}\)\.order\("pharmacie_id",\{ascending:true\}\)/);
  assert.match(notices, /if\(page\.length<pageSize\)break/);
  assert.match(notices, /if\(re\)\{setError\("Impossible de charger les accusés de réception\."/);
});

test("les six espaces sont visibles et les deux espaces connectés sont qualifiés", () => {
  const ids = ["pharmacie", "parapharmacie", "bebe-maman", "dispositifs", "examens", "prestations"];
  for (const id of ids) assert.ok(ecosystemes.includes('id:"' + id + '"'), "espace absent: " + id);
  assert.equal((ecosystemes.match(/id:"(?:pharmacie|parapharmacie|bebe-maman|dispositifs|examens|prestations)"/g) || []).length, 6);
  assert.equal((ecosystemes.match(/nature:"autonome"/g) || []).length, 4);
  assert.equal((ecosystemes.match(/nature:"connecte"/g) || []).length, 2);
  assert.ok(ecosystemes.includes('export type EcosystemeId = (typeof DEFINITIONS_ECOSYSTEMES)[number]["id"]'));
  assert.ok(!ecosystemes.includes('id:"aide"'));
  assert.ok(selection.includes("ECOSYSTEMES.map("));
  assert.ok(!selection.includes("ECOSYSTEMES.filter("));
  assert.ok(selection.includes('item.nature === "connecte"'));
});

test("le statut public reflète les cinq verrous Admin et traduit suivi en dispositifs", () => {
  for (const slug of ["parapharmacie", "bebe-maman", "examens", "suivi", "prestations"]) {
    assert.ok(universeStatusRoute.includes('"' + slug + '"'));
  }
  assert.ok(universeStatusRoute.includes("dispositifs: suiviEnabled"));
  assert.ok(universeStatusRoute.includes("suivi: suiviEnabled"));
  assert.ok(!universeStatusRoute.includes('"aide"'));
});

test("les routes directes Bébé & Maman et Suivi respectent le verrou Admin", () => {
  assert.ok(middleware.includes('prefix: "/bebe-maman", slug: "bebe-maman"'));
  assert.ok(middleware.includes('prefix: "/suivi", slug: "suivi"'));
  assert.ok(middleware.includes('ecosystemeCatalogue === "parapharmacie" || ecosystemeCatalogue === "bebe-maman"'));
});

test("Besoin d’aide ouvre la FAQ et le chat pharmacie reste séparé", () => {
  assert.ok(clientHeader.includes('href: "/faq"'));
  assert.ok(clientHeader.includes('ouvrirAction("/faq")'));
  assert.ok(!clientHeader.includes('chemin === "/aide"'));
  assert.ok(universeMenu.includes('href="/faq"'));
  assert.ok(faqPage.includes("export default function FaqPage"));
  assert.ok(faqPage.includes('href="/aide"'));
  assert.ok(clientShell.includes('pathname === "/faq"'));
});
