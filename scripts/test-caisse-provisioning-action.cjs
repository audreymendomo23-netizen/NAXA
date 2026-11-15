"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const action = fs.readFileSync(
  path.join(root, "src/app/pharmacie/actions.ts"),
  "utf8"
);

test("la création du poste Caisse appelle le provisionnement complet", () => {
  assert.match(action, /sb\.rpc\(["']naxa_provision_caisse["']/);
  assert.doesNotMatch(action, /sb\.rpc\(["']naxa_grant_professional_assignment["']/);
  assert.match(action, /Compte professionnel n'a pas pu être attribué|compte_non_eligible/);
});

test("le provisionnement est déclenché seulement après validation du compte Auth et du périmètre", () => {
  const finalized = action.indexOf("isFinalizedNaxaProfile");
  const scope = action.indexOf("CREATE_CAISSE");
  const provision = action.indexOf('sb.rpc("naxa_provision_caisse"');
  assert.ok(finalized >= 0 && scope >= 0 && provision > finalized && provision > scope);
});
