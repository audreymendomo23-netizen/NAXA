"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115182000_make_cash_register_provisioning_idempotent.sql"),
  "utf8"
).toUpperCase();

test("Caisse provisioning retains the authenticated caller and canonical assignment guard", () => {
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /AUTH\.UID\(\)/);
  assert.match(migration, /NAXA_GRANT_PROFESSIONAL_ASSIGNMENT/);
  assert.match(migration, /CREATE_CAISSE/);
  assert.match(migration, /NAXA-CAISSE-RESOURCE:/);
});

test("only the exact overlapping active Caisse assignment can be treated as idempotent", () => {
  assert.match(migration, /WHEN RAISE_EXCEPTION/);
  assert.match(migration, /UNE AFFECTATION ACTIVE DE CE RÔLE CHEVAUCHE DÉJÀ LA PÉRIODE/);
  assert.match(migration, /ROLE_CODE = 'CAISSE'/);
  assert.match(migration, /STATUT = 'ACTIVE'/);
  assert.match(migration, /COMMENCE_AT <= NOW\(\)/);
  assert.match(migration, /EXPIRE_AT IS NULL OR A\.EXPIRE_AT > NOW\(\)/);
  assert.match(migration, /P\.ACTIF = TRUE/);
  assert.match(migration, /PH\.ACTIF = TRUE/);
  assert.match(migration, /PH\.ARCHIVEE_LE IS NULL/);
});

test("Caisse physical resource remains unique and inactive resources are never silently reactivated", () => {
  assert.match(migration, /INSERT INTO PUBLIC\.CAISSES/);
  assert.match(migration, /'CAISSE PRINCIPALE'/);
  assert.match(migration, /UNE CAISSE EXISTE DÉJÀ MAIS ELLE EST INACTIVE/);
  assert.match(migration, /PG_CATALOG\.PG_ADVISORY_XACT_LOCK/);
});

test("RPC ACL excludes anon and PUBLIC while retaining authenticated/service_role", () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION PUBLIC\.NAXA_PROVISION_CAISSE\(UUID, UUID\) FROM PUBLIC, ANON/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION PUBLIC\.NAXA_PROVISION_CAISSE\(UUID, UUID\) TO AUTHENTICATED, SERVICE_ROLE/);
});
