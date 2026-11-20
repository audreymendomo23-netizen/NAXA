"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261120120000_exam_center_pending_setup_staff_manage.sql"), "utf8");
const centerPage = fs.readFileSync(path.join(root, "src/app/centre-examens/page.tsx"), "utf8");
const inviteContract = fs.readFileSync(path.join(root, "supabase/tests/20261111163814_exam_staff_invites_contract.sql"), "utf8");
const setupContract = fs.readFileSync(path.join(root, "supabase/tests/20261120120000_exam_center_pending_setup_staff_manage.sql"), "utf8");

test("l'exception de préparation est limitée à staff_manage pour le Directeur du Centre draft", () => {
  assert.match(migration, /p_capability\s*=\s*'staff_manage'/);
  assert.match(migration, /a\.role_key\s*=\s*'directeur'/);
  assert.match(migration, /c\.status\s*=\s*'draft'/);
  assert.match(migration, /pa\.status\s*=\s*'pending'/);
  assert.match(migration, /d\.dossier_status\s*=\s*'pending'/);
  assert.match(migration, /d\.universe_slug\s*=\s*'examens'/);
  assert.match(migration, /pu\.enabled\s+is\s+false/);
  assert.match(migration, /pm\.member_role\s+in\s*\('owner','manager'\)/);
});

test("l'exception ne supprime pas le verrou de paiement pour les capacités opérationnelles", () => {
  assert.match(migration, /private\.naxa_partner_has_confirmed_payment\(c\.partner_id\)/);
  assert.match(migration, /p_capability\s*=\s*'staff_manage'/);
  assert.match(migration, /or\s+private\.exam_has_capability\(id,'staff_manage'\)/);
  assert.match(setupContract, /appointments_read/);
  assert.match(setupContract, /finance_read/);
  assert.match(setupContract, /results_publish/);
});

test("le dashboard d'un Centre brouillon ne présente que le module Personnel", () => {
  assert.match(centerPage, /const initialSetup\s*=\s*center\?\.status==="draft"/);
  assert.match(centerPage, /!initialSetup&&center\?\.status==="active"/);
  assert.match(centerPage, /initialSetup\?x\[0\]==="personnel"/);
});

test("le contrat historique des invitations utilise maintenant un Centre pending/draft", () => {
  assert.match(inviteContract, /'centre_examen','pending'/);
  assert.match(inviteContract, /'examens',false/);
  assert.match(inviteContract, /'draft'/);
  assert.match(inviteContract, /dossier_status/);
});

test("le contrat SQL teste l'invitation réelle et le refus des capacités opérationnelles avant paiement", () => {
  assert.match(setupContract, /exam_create_staff_invite/);
  assert.match(setupContract, /exam_accept_staff_invite/);
  assert.match(setupContract, /staff_manage/);
  assert.match(setupContract, /appointments_manage/);
  assert.match(setupContract, /finance_write/);
  assert.match(setupContract, /results_draft/);
  assert.match(setupContract, /rollback;/);
});
