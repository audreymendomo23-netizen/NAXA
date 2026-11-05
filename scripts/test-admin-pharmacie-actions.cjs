const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "../src/app/admin/pharmacies/[id]/actions.ts"),
  "utf8",
);

test("l'action de gestion Bébé & Maman valide les UUID pharmacie au format canonique", () => {
  const start = source.indexOf("export async function changerStatutServiceBebeMaman");
  assert.notEqual(start, -1, "action de gestion Bébé & Maman absente");
  const action = source.slice(start);

  assert.ok(
    action.includes(
      "if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pharmacieId))",
    ),
    "le contrôle doit respecter les cinq groupes UUID 8-4-4-4-12",
  );

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.equal(uuid.test("01800000-0000-4000-8000-000000000001"), true);
  assert.equal(uuid.test("01800000-0000-4000-8000-00000000001"), false);
  assert.equal(uuid.test("01800000-0000-9000-8000-000000000001"), false);
});

test("la mutation conserve le garde Admin actif et le contrôle d'éligibilité pharmacie", () => {
  assert.match(source, /requireAdminActive\("\/admin\/pharmacies"\)/);
  assert.match(source, /await requireAdmin\(\)/);
  assert.doesNotMatch(source, /profile\?\.role !== "admin"/);
  const start = source.indexOf("export async function changerStatutServiceBebeMaman");
  const action = source.slice(start);
  assert.match(action, /await requireAdmin\(\)/);
  assert.ok(action.includes("if (!pharmacy || (enabled && (!pharmacy.actif || !pharmacy.visible_recherche)))"));
  assert.match(action, /admin_set_pharmacie_bebe_maman_service/);
});

process.stdout.write("Contrat gestion service Bébé & Maman Admin vérifié.\n");
