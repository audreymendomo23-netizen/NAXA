const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const api = fs.readFileSync(path.join(root, "src/app/api/admin/messagerie/route.ts"), "utf8");
const page = fs.readFileSync(path.join(root, "src/app/admin/messagerie/page.tsx"), "utf8");
const inbox = fs.readFileSync(path.join(root, "src/components/admin/AdminInbox.tsx"), "utf8");

test("GET et POST refusent toute session qui n'est pas un administrateur actif", () => {
  assert.match(api, /auth\.getUser\(\)/);
  assert.match(api, /profile\?\.role !== "admin" \|\| profile\.actif !== true/);
  assert.equal((api.match(/const admin = await activeAdmin\(\);/g) ?? []).length, 2);
});

test("GET valide le ticket et ne lit que le fil demandé", () => {
  assert.match(api, /export async function GET\(/);
  assert.match(api, /ticketId/);
  assert.match(api, /\.eq\("id", ticketId\)/);
  assert.match(api, /\.eq\("ticket_id", ticket\.id\)/);
  assert.match(api, /Cache-Control.*private, no-store/);
});

test("POST conserve les garde-fous de statut et de longueur", () => {
  assert.match(api, /ticket\.statut !== "ouvert"/);
  assert.match(api, /contenu\.length > 2000/);
  assert.match(api, /status: 409/);
  assert.match(api, /status: 201/);
});

test("la page serveur ne charge aucun message pour l'ensemble des tickets", () => {
  assert.doesNotMatch(page, /from\("messages_support"\)/);
  assert.match(page, /<AdminInbox tickets=/);
});

test("l'interface ne charge que le fil sélectionné et gère les états asynchrones", () => {
  assert.match(inbox, /messagerie\?ticket_id=\$\{encodeURIComponent\(selected\)\}/);
  assert.match(inbox, /maxLength=\{2000\}/);
  assert.match(inbox, /AbortController/);
  assert.match(inbox, /threadLoading/);
  assert.match(inbox, /threadError/);
  assert.match(inbox, /setThreadRevision/);
});

process.stdout.write("Contrat statique messagerie Admin vérifié.\n");
