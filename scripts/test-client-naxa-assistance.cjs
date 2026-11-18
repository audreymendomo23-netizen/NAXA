const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const page = read("src/app/assistance/page.tsx");
const actions = read("src/app/assistance/actions.ts");
const faqRoute = read("src/app/faq/page.tsx");
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
const widget = read("src/components/NaxaSupportWidget.tsx");
const faqInteractive = read("src/components/FaqInteractive.tsx");
const header = read("src/components/EnTeteClient.tsx");
const liveMigration = read("supabase/migrations/20261118150000_naxa_livechat_realtime.sql");
const liveSqlTest = read("supabase/tests/20261118_naxa_livechat_realtime.sql");
const professionalMigration = read("supabase/migrations/20261118150000_naxa_professional_support_access.sql");
const professionalSqlTest = read("supabase/tests/20261118_naxa_professional_support_access.sql");
const professionalNotificationsMigration = read("supabase/migrations/20261118193000_naxa_professional_support_notifications.sql");
const professionalReopenMigration = read("supabase/migrations/20261118200000_naxa_professional_support_reopen.sql");
const professionalBrowser = read("scripts/e2e/naxa-professional-support-browser.cjs");

test("l’assistance Client NAXA est distincte du chat pharmacie", () => {
  assert.match(page, /Écrire à l’équipe NAXA/);
  assert.match(actions, /rpc\("open_naxa_support_ticket"/);
  assert.doesNotMatch(actions, /open_pharmacist_chat/);
  assert.match(liveMigration, /pharmacie_id is null/);
  assert.match(liveMigration, /'support_naxa'/);
  assert.match(pharmacyChat, /open_pharmacist_chat/);
  assert.ok(faqInteractive.includes('href="/assistance"'));
  assert.ok(faqInteractive.includes('href="/aide"'));
  assert.match(faqRoute, /FaqInteractive/);
  assert.match(notifications, /support_naxa_reponse/);
  assert.match(notifications, /support_naxa_nouvelle_demande/);
  assert.match(notifications, /support_naxa_nouveau_message/);
  assert.match(notifications, /related_entity_id/);
  assert.match(notificationHook, /related_entity_id/);
});

test("la demande est réservée à un compte actif hors Admin et validée côté serveur", () => {
  assert.match(actions, /auth\.getUser\(\)/);
  assert.match(actions, /profile\.role === "admin"/);
  assert.match(actions, /profile\.actif !== true/);
  assert.match(actions, /sb\.rpc\("naxa_business_function"\)/);
  assert.match(actions, /activeRole === "admin"/);
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

test("chaque compte peut suivre et reprendre son dossier sans accéder aux tickets d’autrui", () => {
  assert.match(page, /eq\("auteur_profile_id", profile\.id\)/);
  assert.match(page, /eq\("type", "support_naxa"\)/);
  assert.match(page, /activeRole === "admin"/);
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
  assert.match(liveMigration, /naxa_support_notify_new_ticket/);
  assert.match(adminApi, /support_naxa_statut/);
  assert.match(adminPage, /reference_code,categorie,last_activity_at/);
  assert.match(adminInbox, /Prendre en charge/);
  assert.match(adminInbox, /Attendre le demandeur/);
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
  assert.match(shell, /pathname === "\/parapharmacie"/);
  assert.match(shell, /pathname === "\/bebe-maman"/);
  assert.match(shell, /pathname === "\/suivi"/);
  assert.match(shell, /pathname === "\/examens"/);
  assert.match(shell, /pathname === "\/prestations"/);
  assert.match(shell, /pathname !== "\/faq"/);
  assert.match(shell, /widgetProfessionnelVisible/);
  assert.match(shell, /appartientAuParcoursProfessionnel/);
  assert.match(shell, /suivi\/professionnel/);
  assert.match(shell, /profile\.role === "client"/);
  assert.match(shell, /activeRole === "client"/);
  assert.match(middleware, /"\/assistance"/);
  assert.match(nextConfig, /bodySizeLimit: "5mb"/);
});

test("le widget canari est un livechat temps réel sur les espaces professionnels et hors FAQ", () => {
  assert.match(shell, /NaxaSupportWidget/);
  assert.match(shell, /pathname !== "\/faq"/);
  assert.match(widget, /bg-\[#FFE23D\]/);
  assert.match(widget, /rpc\("open_naxa_support_ticket"/);
  assert.match(widget, /postgres_changes/);
  assert.match(widget, /messages_support/);
  assert.match(widget, /tickets_support/);
  assert.match(widget, /aria-label="Livechat avec l’équipe NAXA"/);
  assert.match(widget, /ticket_id=eq\./);
  assert.match(widget, /MAX_MESSAGE_LENGTH/);
  assert.match(widget, /Consulter la FAQ NAXA/);
});

test("la FAQ recherche et filtre les réponses, et le raccourci conserve son feedback", () => {
  assert.match(faqInteractive, /type="search"/);
  assert.match(faqInteractive, /aria-label="Catégories de la FAQ"/);
  assert.match(faqInteractive, /setCategory/);
  assert.match(header, /notifierNAXA\("Bienvenue dans le Centre d’aide NAXA/);
  assert.match(header, /Cet écosystème est actuellement verrouillé/);
});

test("la base active Realtime et crée un dossier atomique notifiant les Admins", () => {
  assert.match(liveMigration, /open_naxa_support_ticket/);
  assert.match(liveMigration, /security invoker/i);
  assert.match(liveMigration, /supabase_realtime add table public\.tickets_support/);
  assert.match(liveMigration, /supabase_realtime add table public\.messages_support/);
  assert.match(liveMigration, /trg_naxa_support_notify_new_ticket/);
  assert.match(liveMigration, /trg_naxa_support_notify_client_reply/);
  assert.match(liveSqlTest, /naxa_livechat_realtime_structure_pass/);
});

process.stdout.write("Contrats statiques Assistance NAXA et Livechat définis.\n");


test("l’assistance directe couvre les professionnels, leur confidentialité et la recette Replay", () => {
  assert.match(actions, /profile\.role === "admin"/);
  assert.match(actions, /activeRole === "admin"/);
  assert.match(page, /const isClient = activeRole === "client"/);
  assert.match(professionalMigration, /tickets_support_account_create_naxa_support/);
  assert.match(professionalMigration, /public\.naxa_business_function\(\)\s*<>\s*'admin'/);
  assert.match(professionalMigration, /naxa_support_attachment_read_own/);
  assert.match(professionalSqlTest, /Fuite du dossier Livreur vers le Promoteur/);
  assert.match(professionalNotificationsMigration, /Le demandeur a répondu/);
  assert.match(professionalNotificationsMigration, /Nouvelle demande d’assistance NAXA/);
  assert.match(professionalReopenMigration, /v_profile\.role<>'admin'::public\.role_type/);
  assert.match(professionalReopenMigration, /resolved_at=case/);
  assert.match(professionalBrowser, /naxa_e2e_livreur/);
  assert.match(professionalBrowser, /naxa_e2e_promoteur/);
  assert.match(professionalBrowser, /réponse Admin reçue en direct/i);
});
