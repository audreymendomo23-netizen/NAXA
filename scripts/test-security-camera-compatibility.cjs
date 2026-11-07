const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migration_302_security_camera_universal_connectivity.sql"), "utf8");
const component = fs.readFileSync(path.join(root, "src/components/pharmacie/PromoteurSecuriteIntelligente.tsx"), "utf8");
const page = fs.readFileSync(path.join(root, "src/app/pharmacie/promoteur/page.tsx"), "utf8");
const doc = fs.readFileSync(path.join(root, "docs/security/AUDIT_FAISABILITE_360_NAXA_SECURITE_INTELLIGENTE_2026-11-07.md"), "utf8");

test("connecteurs : protocoles standards, APIs constructeurs, NVR/DVR et encodeurs analogiques", () => {
  for (const protocol of ["onvif", "rtsp", "rtsps", "https_api", "vendor_sdk", "nvr_channel", "analog_encoder", "cloud_api"]) {
    assert.match(migration, new RegExp("'" + protocol + "'"));
  }
  for (const adapter of ["generic.onvif", "generic.rtsp", "generic.rtsps", "generic.nvr_onvif", "bridge.analog_encoder", "vendor.hikvision.isapi", "vendor.dahua.cgi", "vendor.axis.vapix", "vendor.hanwha.sunapi", "vendor.uniview.lapi"]) {
    assert.ok(migration.includes(adapter), "Adaptateur absent : " + adapter);
  }
});

test("connexion : secret externe, passerelle du même établissement et état testé", () => {
  assert.match(migration, /auth_secret_reference/);
  assert.ok(migration.includes("foreign key (camera_id, pharmacie_id)"));
  assert.ok(migration.includes("foreign key (gateway_id, pharmacie_id)"));
  assert.match(migration, /connection_status <> 'connected' or last_tested_at is not null/);
  assert.doesNotMatch(migration, /camera_password|password\s+text|rtsp_url\s+text/i);
});

test("tableau Promoteur : connecteurs visibles seulement pour le réseau pharmacie actif", () => {
  assert.match(page, /naxa_security_camera_connections/);
  assert.ok(page.includes('.in("pharmacie_id", scopedIds)'));
  assert.match(component, /connections=|connections:/);
  assert.match(component, /Connexion|connecteur|Adaptateur/);
});

test("documentation : limite des caméras propriétaires et validation modèle/firmware", () => {
  assert.match(doc, /caméras propriétaires/);
  assert.match(doc, /modèle et firmware/);
  assert.match(doc, /encodeur analogique/);
  assert.match(doc, /API officielle/);
});
