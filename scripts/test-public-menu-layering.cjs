const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const header = fs.readFileSync(path.join(root, "src/components/EnTeteAccueil.tsx"), "utf8");
const home = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");

test("le menu public reste au-dessus du panneau de recherche qui chevauche le header", () => {
  assert.match(header, /<header className="relative z-20 isolate[^"]*overflow-visible/);
  assert.match(header, /id="menu-accueil"[\s\S]*?className="absolute right-0 top-full z-50/);
  assert.match(home, /<div className="relative z-10 mx-auto -mt-5/);
});

test("les deux entrées du menu public gardent leurs destinations de connexion", () => {
  assert.match(header, /href="\/connexion\?espace=client"/);
  assert.match(header, /href="\/connexion\?espace=pharmacie"/);
});

process.stdout.write("Contrat de superposition et de navigation du menu public vérifié.\n");
