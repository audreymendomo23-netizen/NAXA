const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

test("Client login activates the independent Client workspace context", () => {
  const source = read("src/app/api/auth/login/route.ts");
  assert.match(source, /naxa_select_active_role/);
  assert.match(source, /p_role_code:\s*"client"/);
  assert.match(source, /hasClientIdentity/);
});

test("Admin SPD provisioning reuses an existing identity found by username or phone", () => {
  const source = read("src/app/admin/creation-univers-actions.ts");
  assert.match(source, /ilike\("username",\s*username\)/);
  assert.match(source, /eq\("phone",\s*normalizedPhone\)/);
  assert.match(source, /existingProfile\.username\?\.toLowerCase\(\)\s*===\s*username/);
  assert.match(source, /Réutilisation de l'identité Auth existante/);
  assert.match(source, /auth\.admin\.createUser/); // only the new-identity branch
  assert.match(source, /naxa_request_cumulative_activity/);
});

test("SPD switcher uses server-authorized, paid memberships", () => {
  const source = read("src/components/EspaceNaxaSwitcher.tsx");
  assert.match(source, /naxa_list_accessible_spd_workspaces/);
  assert.match(source, /addPartner\("prestations"/);
  assert.match(source, /hasClientIdentity/);
});

test("Cumulative approvals and notifications use the active workspace context", () => {
  const page = read("src/app/naxa/cumuls/page.tsx");
  const notifications = read("src/app/notifications/page.tsx");
  assert.match(page, /sb\.rpc\("naxa_business_function"\)/);
  assert.match(page, /const isAdmin=activeRole==="admin"/);
  assert.match(page, /sb\.rpc\("naxa_active_role_partner"\)/);
  assert.match(page, /activeRole==="prestations"&&activePartner===approval\.organization_id/);
  assert.match(notifications, /cumulative_activity_request/);
  assert.match(notifications, /href="\/naxa\/cumuls"/);
});

test("Both directions of cumulative authorization are wired before granting access", () => {
  const pharmacy = read("src/app/pharmacie/affectations/actions.ts");
  const admin = read("src/app/admin/creation-univers-actions.ts");
  assert.match(pharmacy, /p_direction:"SPD_VERS_PHARMACIE"/);
  assert.match(admin, /p_direction:\s*"PHARMACIE_VERS_SPD"/);
});

test("Replay migrations include reconciliation, SPD switcher and Client privacy guards", () => {
  const migrations = [
    "supabase/migrations/20261116194956_naxa_cumulative_source_reconciliation_guards.sql",
    "supabase/migrations/20261116195501_naxa_admin_client_identity_workspace_access.sql",
    "supabase/migrations/20261116195526_naxa_admin_client_context_resolution.sql",
    "supabase/migrations/20261116195628_naxa_list_authorized_spd_workspaces.sql",
    "supabase/migrations/20261116200105_naxa_client_personal_data_workspace_isolation.sql",
    "supabase/migrations/20261116200725_naxa_cumulative_decision_context_mismatch_is_denied.sql",
  ];
  for (const file of migrations) assert.ok(exists(file), `Missing migration: ${file}`);
  assert.match(read(migrations[0]), /naxa_cumulative_source_change_trigger/);
  assert.match(read(migrations[3]), /naxa_list_accessible_spd_workspaces/);
  assert.match(read(migrations[4]), /naxa_client_identity_is_staff_of_pharmacy/);
  assert.match(read(migrations[4]), /naxa_client_identity_is_partner_member/);
  assert.match(read(migrations[5]), /Active le contexte Promoteur/);
  assert.match(read(migrations[5]), /naxa_active_role_partner/);
});

test("Replay SQL E2E suites cover identity, approvals, RLS, Admin context and personal data", () => {
  const suites = [
    "supabase/tests/20261116_naxa_identity_cumulative_replay.sql",
    "supabase/tests/20261116_naxa_cumulative_multi_promoter_reconciliation_replay.sql",
    "supabase/tests/20261116_naxa_cumulative_rls_replay.sql",
    "supabase/tests/20261116_naxa_admin_client_workspace_replay.sql",
    "supabase/tests/20261116_naxa_client_data_privacy_replay.sql",
  ];
  for (const file of suites) {
    assert.ok(exists(file), `Missing Replay E2E suite: ${file}`);
    const sql = read(file);
    assert.match(sql, /begin;/i);
    assert.match(sql, /rollback;/i);
  }
});
