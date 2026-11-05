const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const helper = read("src/lib/admin/is-demo-pharmacy.ts");
const home = read("src/app/admin/page.tsx");
const layout = read("src/app/admin/layout.tsx");
const alerts = read("src/app/admin/alertes/page.tsx");

test("le filtre Admin reprend les mêmes marqueurs que la migration qui masque les pharmacies de démo", () => {
  const match = helper.match(/DEMO_PHARMACY_NAME_PATTERN\s*=\s*\/(.+)\/iu/);
  assert.ok(match, "le prédicat de détection des noms de démonstration doit exister");
  const isDemo = (name) => new RegExp(match[1], "iu").test(name ?? "");
  for (const name of ["Pharmacie Démo", "Pharmacie demo", "Pharmacie test", "Pharmacie mock", "Pharmacie exemple", "Pharmacie fictif"]) {
    assert.equal(isDemo(name), true, name);
  }
  for (const name of ["Pharmacie Protestante", "Pharmacie du Centre", "Testament Pharmacie", "Pharmacie Nouvelle"]) {
    assert.equal(isDemo(name), false, name);
  }
});

test("le tableau de bord compte les pharmacies opérationnelles hors démos", () => {
  assert.match(home, /toutesLesPharmacies=pharmacies\?\?\[\]/);
  assert.match(home, /select\("id,nom,ville,quartier,stock_updated_at,actif,visible_recherche,est_demo"\)/);
  assert.match(home, /listePharmacies=toutesLesPharmacies\.filter\(x=>!isDemoPharmacy\(x\.nom,x\.est_demo\)\)/);
  assert.match(home, /stocksHorodates=listePharmacies\.filter/);
  assert.match(home, /CatalogueCreation pharmacies=\{listePharmacies\.filter\(x=>x\.actif===true&&x\.visible_recherche===true\)/);
});

test("le badge de navigation et la page Alertes appliquent le même périmètre", () => {
  assert.match(layout, /select\("id,nom,stock_updated_at,actif,visible_recherche,est_demo"\)/);
  assert.match(layout, /isDemoPharmacy\(p\.nom,p\.est_demo\)/);
  assert.match(alerts, /select\("id,nom,stock_updated_at,actif,visible_recherche,est_demo"\)/);
  assert.match(alerts, /isDemoPharmacy\(p\.nom, p\.est_demo\)/);
});

process.stdout.write("Contrat de périmètre KPI Admin hors pharmacies démo vérifié.\n");


test("le flag canonique est_demo prime sur le nom lorsqu’il est renseigné", () => {
  assert.match(helper, /if \(demoFlag !== null && demoFlag !== undefined\) return demoFlag/);
});
