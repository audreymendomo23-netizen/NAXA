const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const bearerPath = path.join(root, "src/lib/supabase/bearer-auth.ts");
const sessionPath = path.join(root, "src/app/api/v1/auth/session/route.ts");
const bearer = fs.readFileSync(bearerPath, "utf8");
const session = fs.readFileSync(sessionPath, "utf8");

test("l'authentification API lit uniquement un jeton Bearer", () => {
  assert.match(bearer, /headers\.get\(["']authorization["']\)/i);
  assert.match(bearer, /Bearer\\s\+/);
  assert.doesNotMatch(bearer, /next\/headers|createServerClient|cookies\(/);
});

test("le jeton est validé par Supabase Auth avant d'être accepté", () => {
  assert.match(bearer, /supabase\.auth\.getUser\(token\)/);
  assert.match(bearer, /AUTH_INVALID/);
  assert.match(bearer, /AUTH_UNAVAILABLE/);
});

test("le client de requête utilise la clé publique et conserve le JWT pour RLS", () => {
  assert.match(bearer, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(bearer, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(bearer, /Authorization:\s*\`Bearer \${token}\`/);
  assert.match(bearer, /persistSession:\s*false/);
  assert.match(bearer, /autoRefreshToken:\s*false/);
  assert.doesNotMatch(bearer, /SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY/);
});

test("le bootstrap v1 ne lit que le profil de l'utilisateur authentifié", () => {
  assert.match(session, /authenticateSupabaseBearer\(request\)/);
  assert.match(session, /\.from\(["']profiles["']\)/);
  assert.match(session, /\.eq\(["']id["'],\s*auth\.user\.id\)/);
  assert.match(session, /ageVerified:\s*profile\.age_verified\s*===\s*true/);
  assert.match(session, /PROFILE_INACTIVE/);
  assert.match(session, /Cache-Control/);
  assert.doesNotMatch(session, /supabaseAdmin|SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY/);
});
