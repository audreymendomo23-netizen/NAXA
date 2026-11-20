"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

const auth = read("src/lib/support/native-bearer.ts");
const create = read("src/app/api/v1/support/calls/route.ts");
const call = read("src/app/api/v1/support/calls/[callId]/route.ts");
const ice = read("src/app/api/v1/support/calls/[callId]/ice/route.ts");
const heartbeat = read("src/app/api/v1/support/calls/[callId]/heartbeat/route.ts");
const share = read("src/app/api/v1/support/calls/[callId]/screen-share/route.ts");

assert.match(auth, /authenticateSupabaseBearer\(request\)/);
assert.match(auth, /\.eq\("id", auth\.user\.id\)/);
assert.match(auth, /profile\.actif !== true/);
assert.match(auth, /profile\.age_verified !== true/);
assert.doesNotMatch(auth, /supabaseServer|cookies\(|request\.json\(\)/);

for (const [name, source] of [["create", create], ["call", call], ["ice", ice], ["heartbeat", heartbeat], ["share", share]]) {
  assert.match(source, /authenticateNativeSupportUser\(request\)/, name + " must verify the native Bearer token");
  assert.match(source, /Cache-Control/ , name + " responses must be private and uncached");
  assert.doesNotMatch(source, /supabaseServer\(\)/, name + " must not fall back to cookie auth");
  assert.doesNotMatch(source, /process\.env\.(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)/,
    name + " must not expose or read service-role secrets in request data");
}

assert.match(create, /p_actor_user_id:\s*auth\.user\.id/);
assert.match(create, /p_ticket_id:\s*ticketId/);
assert.doesNotMatch(create, /p_actor_user_id:\s*body\./);
assert.match(create, /naxa_support_call_request/);

assert.match(call, /call\.requester_user_id !== auth\.user\.id/);
assert.match(call, /action !== "cancel" && action !== "end"/);
assert.match(call, /naxa_support_call_transition/);
assert.doesNotMatch(call, /body\.actor_user_id|body\.requester_user_id/);

assert.match(ice, /call\.requester_user_id !== auth\.user\.id/);
assert.match(ice, /call\.status !== "accepted"/);
assert.match(ice, /createHmac\("sha1"/);
assert.match(ice, /NAXA_TURN_SHARED_SECRET/);
assert.match(ice, /Cache-Control/);

assert.match(heartbeat, /call\.requester_user_id !== auth\.user\.id/);
assert.match(heartbeat, /naxa_support_call_heartbeat/);
assert.match(heartbeat, /p_actor_user_id:\s*auth\.user\.id/);

assert.match(share, /call\.requester_user_id !== auth\.user\.id/);
assert.match(share, /call\.status !== "accepted"/);
assert.match(share, /ACTIONS = new Set\(\["consented", "started", "stopped", "denied"\]\)/);
assert.match(share, /REASONS = new Set/);
assert.match(share, /naxa_support_call_screen_share_event/);
assert.match(share, /p_actor_user_id:\s*auth\.user\.id/);
assert.doesNotMatch(share, /body\.actor_user_id|body\.requester_user_id/);

console.log("PASS — API native Support : Bearer vérifié, identité non usurpable, appel participant-only, TURN éphémère et audit de partage contrôlé.");
