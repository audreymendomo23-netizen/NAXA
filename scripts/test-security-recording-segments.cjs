const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261109010000_security_local_recording_segments.sql"),
  "utf8",
);
const sqlContract = fs.readFileSync(
  path.join(root, "supabase/tests/310_security_recording_segments.sql"),
  "utf8",
);

test("lot 13 : index des segments locaux lié à une pharmacie, caméra et passerelle", () => {
  for (const fragment of [
    "create table if not exists public.naxa_security_recording_segments",
    "foreign key (gateway_id, pharmacie_id)",
    "foreign key (camera_id, pharmacie_id)",
    "unique (camera_id, storage_path)",
    "started_at timestamptz not null",
    "ended_at timestamptz",
    "duration_seconds numeric",
    "codec text",
    "container_format text",
    "size_bytes bigint",
    "sha256 text",
    "retention_until timestamptz",
  ]) assert.ok(migration.includes(fragment), "Contrat absent : " + fragment);
});

test("lot 13 : état de segment cohérent, chemin relatif borné et audio interdit", () => {
  assert.match(migration, /status in \('recording','ready','protected','degraded','corrupt','deleted','error'\)/);
  assert.ok(migration.includes("storage_path !~"));
  assert.match(migration, /audio_enabled boolean not null default false/);
  assert.match(migration, /check \(audio_enabled = false\)/);
  assert.match(migration, /duration_seconds is not null and codec is not null and size_bytes is not null and sha256 is not null/);
  assert.match(migration, /protected_at is not null and protected_reason is not null/);
});

test("lot 13 : accès backend uniquement, RLS forcée et index de timeline/rétention", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on public\.naxa_security_recording_segments from public, anon, authenticated/);
  assert.match(migration, /grant all on public\.naxa_security_recording_segments to service_role/);
  for (const index of [
    "naxa_security_recording_segments_pharmacy_time_idx",
    "naxa_security_recording_segments_camera_time_idx",
    "naxa_security_recording_segments_retention_idx",
  ]) assert.ok(migration.includes(index), "Index absent : " + index);
});

test("lot 13 : vues, exports, suppressions et policies sont auditables", () => {
  for (const action of [
    "recording_segment_view",
    "recording_segment_export",
    "recording_segment_delete",
    "recording_policy_update",
  ]) assert.ok(migration.includes("'" + action + "'"), "Action d'audit absente : " + action);
  assert.ok(migration.includes("'recording_segment'"));
  assert.ok(migration.includes("'recording_policy'"));
  assert.match(sqlContract, /archive_actions_are_auditable/);
  assert.match(sqlContract, /archive_resource_is_auditable/);
});

test("lot 13 : test SQL couvre RLS, clés, audio, état et timeline", () => {
  for (const assertion of [
    "recording_segments_rls_forced",
    "browser_roles_have_no_direct_access",
    "backend_can_manage_recording_segments",
    "segment_gateway_bound_to_same_pharmacy",
    "segment_camera_bound_to_same_pharmacy",
    "audio_is_forbidden",
    "relative_storage_path_constraint_present",
    "ready_requires_hash_duration_codec_and_size",
    "protected_segments_require_reason_and_time",
    "camera_timeline_index_present",
    "retention_index_present",
  ]) assert.ok(sqlContract.includes(assertion), "Assertion SQL absente : " + assertion);
});
