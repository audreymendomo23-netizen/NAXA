"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const manifest = read("android/app/src/main/AndroidManifest.xml");
const gradle = read("android/app/build.gradle.kts");
const realtime = read("android/app/src/main/java/cm/naxa/app/NaxaSupportRealtime.kt");
const repository = read("android/app/src/main/java/cm/naxa/app/NativeSupportRepository.kt");
const rtc = read("android/app/src/main/java/cm/naxa/app/NativeSupportRtcClient.kt");
const service = read("android/app/src/main/java/cm/naxa/app/NaxaMediaProjectionService.kt");
const screen = read("android/app/src/main/java/cm/naxa/app/NativeSupportScreen.kt");
const main = read("android/app/src/main/java/cm/naxa/app/MainActivity.kt");
const professional = read("android/app/src/main/java/cm/naxa/app/NativeProfessionalWorkspaceScreen.kt");
const courier = read("android/app/src/main/java/cm/naxa/app/NativeCourierWorkspaceScreen.kt");
const nativeAuth = read("src/lib/support/native-bearer.ts");
const apiRoot = read("src/app/api/v1/support/calls/route.ts");
const apiCall = read("src/app/api/v1/support/calls/[callId]/route.ts");
const apiIce = read("src/app/api/v1/support/calls/[callId]/ice/route.ts");
const apiHeartbeat = read("src/app/api/v1/support/calls/[callId]/heartbeat/route.ts");
const apiShare = read("src/app/api/v1/support/calls/[callId]/screen-share/route.ts");

assert.match(gradle, /io\.github\.webrtc-sdk:android:150\.7871\.08/);
assert.match(manifest, /android\.permission\.RECORD_AUDIO/);
assert.match(manifest, /android\.permission\.FOREGROUND_SERVICE_MICROPHONE/);
assert.match(manifest, /android\.permission\.FOREGROUND_SERVICE_MEDIA_PROJECTION/);
assert.match(manifest, /android:foregroundServiceType="mediaProjection\|microphone"/);
assert.match(manifest, /android:name="\.NaxaMediaProjectionService"[\s\S]*?android:exported="false"/);

assert.match(nativeAuth, /authenticateSupabaseBearer\(request\)/);
assert.match(nativeAuth, /profile\.actif !== true/);
assert.match(nativeAuth, /profile\.age_verified !== true/);
for (const [name, source] of [
  ["create", apiRoot], ["call", apiCall], ["ice", apiIce], ["heartbeat", apiHeartbeat], ["screen-share", apiShare]
]) {
  assert.match(source, /authenticateNativeSupportUser\(request\)/, name + " must validate Bearer and profile state");
  assert.match(source, /Cache-Control/ , name + " must disable shared/proxy caches");
  assert.doesNotMatch(source, /supabaseServer\(\)/, name + " must not fall back to cookie identity");
}
assert.match(apiRoot, /p_actor_user_id:\s*auth\.user\.id/);
assert.doesNotMatch(apiRoot, /p_actor_user_id:\s*body\./);
assert.match(apiShare, /p_actor_user_id:\s*auth\.user\.id/);
assert.match(apiShare, /call\.requester_user_id !== auth\.user\.id/);
assert.match(apiIce, /NAXA_TURN_SHARED_SECRET/);

assert.match(repository, /header\("Authorization", "Bearer \$token"\)/);
assert.match(repository, /header\("apikey", BuildConfig\.SUPABASE_ANON_KEY\)/);
assert.match(repository, /NativeSupportApiException/);
assert.match(repository, /"\/api\/v1\/support\/calls"/);

assert.match(realtime, /encodedPath\("\/realtime\/v1\/websocket"\)/);
assert.match(realtime, /\.scheme\("https"\)/);
assert.doesNotMatch(realtime, /\.scheme\("wss"\)/);
assert.match(realtime, /addQueryParameter\("vsn", "1\.0\.0"\)/);
assert.match(realtime, /\.put\("private", true\)/);
assert.match(realtime, /\.put\("access_token", accessToken\)/);
assert.match(realtime, /heartbeat/);
assert.match(realtime, /"realtime:naxa-support-call:\$callId"/);
assert.match(realtime, /\.put\("type", "broadcast"\)/);
assert.match(realtime, /\.put\("event", "signal"\)/);

assert.match(rtc, /PeerConnection\.IceTransportsType\.RELAY/);
assert.match(rtc, /RtpTransceiverDirection\.SEND_ONLY/);
assert.match(rtc, /createAnswer/);
assert.match(rtc, /"kind", "answer"/);
assert.match(rtc, /ScreenCapturerAndroid/);
assert.match(rtc, /capturer\.initialize\(textureHelper, context\.applicationContext, source\.capturerObserver\)/);
assert.match(rtc, /NaxaMediaProjectionService\.startProjection\(context\)/);
assert.ok(
  rtc.indexOf("NaxaMediaProjectionService.startProjection(context)") >
    rtc.indexOf("try {", rtc.indexOf("suspend fun startScreenShare")),
  "MediaProjection service must be promoted inside the guarded capture lifecycle."
);
assert.match(rtc, /screenShareEvent\(id, sessionId, "consented"\)/);
assert.match(rtc, /screenShareEvent\(id, sessionId, "started"\)/);
assert.match(rtc, /screenShareEvent\(id, sessionId, "stopped", reason\)/);
assert.match(rtc, /screen-share-started/);
assert.match(rtc, /screen-share-stopped/);
assert.match(rtc, /MediaProjection\.Callback\(\)/);
assert.match(rtc, /startCapture\(width, height, 15\)/);
assert.match(rtc, /1280f \/ longestEdge/);
assert.match(rtc, /NaxaMediaProjectionService\.stop\(context\)/);
assert.doesNotMatch(rtc, /createDataChannel\(|MediaRecorder|AudioRecord/);

assert.match(service, /suspendCancellableCoroutine/);
assert.match(service, /startForegroundSession\(includeProjection = false\)/);
assert.match(service, /startForegroundSession\(includeProjection = true\)/);
assert.match(service, /resultReceiver\?\.send\(Activity\.RESULT_OK/);
assert.match(service, /suspend fun startAudio/);
assert.match(service, /suspend fun startProjection/);
assert.match(service, /suspend fun stopProjection/);

assert.match(screen, /Activity\.RESULT_OK && result\.data != null/);
assert.match(screen, /checked = screenShareConsent/);
assert.match(screen, /createScreenCaptureIntent\(\)/);
assert.match(screen, /screenShareEvent\(callId, sessionId, "denied", "user_cancelled"\)/);
assert.match(screen, /repository\.transition\(call\.id, action\)/);
assert.match(screen, /statusCode in setOf\(401, 403\)/);
assert.match(screen, /LaunchedEffect\(currentCall\?\.id, rtcRetryNonce\)/);

assert.match(main, /NativeSupportScreen\(/);
assert.match(main, /onOpenSupport = \{ showingSupport = true \}/);
assert.match(professional, /onOpenSupport: \(\) -> Unit/);
assert.match(courier, /onOpenSupport: \(\) -> Unit/);

console.log("PASS — Support Android natif : Bearer/RLS, Realtime privé, WebRTC TURN, MediaProjection consentie, cycle d’audit, révocation, raccrochage et points d’accès Client/Professionnel.");
