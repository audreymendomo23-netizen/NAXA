const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const page = read("src/app/assistance/page.tsx");
const actions = read("src/app/assistance/actions.ts");
const faq = read("src/app/faq/page.tsx");
const shell = read("src/components/ParcoursClientShell.tsx");
const middleware = read("src/middleware.ts");
const adminApi = read("src/app/api/admin/messagerie/route.ts");
const adminPage = read("src/app/admin/messagerie/page.tsx");
const adminInbox = read("src/components/admin/AdminInbox.tsx");
const migration = read("supabase/migrations/20261118130000_naxa_client_support_workspace.sql");
const sqlTest = read("supabase/tests/20261118_naxa_client_support_workspace.sql");
const nextConfig = read("next.config.mjs");
const pharmacyChat = read("src/app/aide/actions.ts");
const notifications = read("src/app/notifications/page.tsx");
const notificationHook = read("src/lib/messagerie.ts");

test("l’assistance Client NAXA est distincte du chat pharmacie", () => {
  assert.match(page, /Écrire à l’équipe NAXA/);
  assert.match(actions, /type: "support_naxa"/);
  assert.match(actions, /pharmacie_id: null/);
  assert.doesNotMatch(actions, /open_pharmacist_chat/);
  assert.match(pharmacyChat, /open_pharmacist_chat/);
  assert.match(faq, /href="\/assistance"/);
  assert.match(faq, /href="\/aide"/);
  assert.match(notifications, /support_naxa_reponse/);
  assert.match(notifications, /support_naxa_nouvelle_demande/);
  assert.match(notifications, /related_entity_id/);
  assert.match(notificationHook, /related_entity_id/);
});

test("la demande est réservée au Client actif et validée côté serveur", () => {
  assert.match(actions, /auth\.getUser\(\)/);
  assert.match(actions, /profile\.role !== "client"/);
  assert.match(actions, /profile\.actif !== true/);
  assert.match(actions, /CATEGORIES\.has\(categorie\)/);
  assert.match(actions, /sujet\.length < 5/);
  assert.match(actions, /MAX_MESSAGE_LENGTH = 2000/);
});

test("les pièces jointes sont limitées, vérifiées et stockées dans un bucket privé", () => {
  assert.match(actions, /MAX_ATTACHMENT_BYTES = 4 \* 1024 \* 1024/);
  assert.match(actions, /application\/pdf/);
  assert.match(actions, /image\/jpeg/);
  assert.match(actions, /image\/png/);
  assert.match(actions, /image\/webp/);
  assert.match(actions, /value\.slice\(0, 12\)\.arrayBuffer\(\)/);
  assert.match(actions, /naxa-support-attachments/);
  assert.match(migration, /public = false/);
  assert.match(migration, /naxa_support_attachment_insert_own/);
  assert.match(migration, /naxa_support_attachment_read_own/);
  assert.match(migration, /naxa_support_attachment_delete_own/);
  assert.match(sqlTest, /file_size_limit=4194304/);
});

test("le Client peut suivre et reprendre son dossier sans accéder aux tickets d’autrui", () => {
  assert.match(page, /eq\("auteur_profile_id", profile\.id\)/);
  assert.match(page, /eq\("type", "support_naxa"\)/);
  assert.match(page, /reference_code/);
  assert.match(page, /last_activity_at/);
  assert.match(page, /createSignedUrl/);
  assert.match(page, /envoyerReponseNaxa/);
  assert.match(actions, /eq\("auteur_profile_id", profile\.id\)/);
  assert.match(actions, /ticket\.statut === "ferme"/);
});

test("la boîte Admin répond, change les statuts et notifie le Client", () => {
  assert.match(adminApi, /activeAdmin/);
  assert.match(adminApi, /createSignedUrl/);
  assert.match(adminApi, /export async function PATCH/);
  assert.match(adminApi, /support_naxa_reponse/);
  assert.match(actions, /support_naxa_nouvelle_demande/);
  assert.match(adminApi, /support_naxa_statut/);
  assert.match(adminPage, /reference_code,categorie,last_activity_at/);
  assert.match(adminInbox, /Prendre en charge/);
  assert.match(adminInbox, /Attendre le Client/);
  assert.match(adminInbox, /Marquer résolue/);
  assert.match(adminInbox, /Réouvrir/);
});

test("la base sépare support_naxa et conseil_pharmacien et conserve le cycle d’état", () => {
  assert.match(migration, /tickets_support_client_create_naxa_support/);
  assert.match(migration, /t\.type = 'support_naxa'/);
  assert.match(migration, /t\.type = 'conseil_pharmacien'/);
  assert.match(migration, /en_attente_client/);
  assert.match(migration, /first_response_at/);
  assert.match(sqlTest, /messages_support_chat_participant_insert/);
});

test("la route est réservée et conserve l’en-tête Client ; les pièces jointes passent le body limit Next", () => {
  assert.match(shell, /pathname === "\/assistance"/);
  assert.match(middleware, /"\/assistance"/);
  assert.match(nextConfig, /bodySizeLimit: "5mb"/);
});

process.stdout.write("Contrat statique Assistance Client NAXA défini.\n");
