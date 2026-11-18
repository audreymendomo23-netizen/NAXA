"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "e2e", "verify-promoteur-navigation-browser.cjs"),
  "utf8"
);
const workflow = fs.readFileSync(
  path.join(__dirname, "..", ".github", "workflows", "naxa-nav-promoteur-e2e.yml"),
  "utf8"
);

test("la recette est limitée au projet Supabase Replay connu", () => {
  assert.match(source, /const PROJECT_REF = "pwfftcsjyeibxxqhwysw"/);
  assert.match(source, /assertReplayUrl\(env\.NAXA_STORAGE_E2E_URL \|\| env\.SUPABASE_URL\)/);
});

test("la recette réutilise uniquement la fixture Promoteur existante et marquée", () => {
  assert.match(source, /naxa_e2e_promoteur/);
  assert.match(source, /naxa\.e2e\.promoteur@example\.invalid/);
  assert.match(source, /naxa_e2e_promoteur, PROMOTEUR_MARKER/);
  assert.match(source, /profile\.role, "promoteur"/);
  assert.match(source, /profile\.actif, true/);
  assert.match(source, /authMatches\.length, 1/);
  assert.match(source, /espace=pharmacie/);
});

test("aucun endpoint de création Auth ou de données métier n'est utilisé", () => {
  assert.doesNotMatch(source, /adminRequest\([^\n]*\/auth\/v1\/admin\/users["']\s*,\s*["']POST/);
  assert.doesNotMatch(source, /\/rest\/v1\/(?:pharmacies|naxa_professional_assignments|partners|partner_members)/);
  assert.doesNotMatch(source, /method:\s*["']POST["']/);
  assert.match(source, /"PUT",\s*\{ password \}/);
});

test("la recette clique les deux navigations Promoteur et vérifie la destination", () => {
  assert.match(source, /Sections Promoteur/);
  assert.match(source, /Livraisons du réseau/);
  assert.match(source, /Navigation des sous-pages Promoteur/);
  assert.match(source, /Livraisons de mon réseau/);
  assert.match(source, /page\.waitForURL\(url => url\.pathname === TARGET_PATH/);
  assert.match(source, /390, height: 844/);
});

test("le serveur local possède ses variables Admin et rate-limit dédiées à Replay", () => {
  assert.match(workflow, /SUPABASE_SECRET_KEY=\"\$NAXA_STORAGE_E2E_ADMIN_KEY\"/);
  assert.match(workflow, /NAXA_RATE_LIMIT_SECRET=\"\$\(openssl rand -hex 32\)\"/);
  assert.match(workflow, /test \"\$\{#NAXA_RATE_LIMIT_SECRET\}\" -ge 32/);
});

test("la recette ferme explicitement la session navigateur", () => {
  assert.match(source, /Déconnexion/);
  assert.match(source, /logoutPassed, true/);
});

const runtime = fs.readFileSync(
  path.join(__dirname, "..", ".github", "e2e", "naxa-navigation-runtime.cjs"),
  "utf8"
);

test("la recette multi-rôles est strictement épinglée à Replay et exige un opt-in", () => {
  assert.match(runtime, /const PROJECT_REF = "pwfftcsjyeibxxqhwysw"/);
  assert.match(runtime, /assert\.equal\(process\.env\.NAXA_E2E_ALLOW_TEMP_FIXTURES, "true"/);
  assert.match(runtime, /assert\.equal\(new URL\(supabaseUrl\)\.origin, PROJECT_URL/);
});

test("la recette utilise trois identités E2E existantes et vérifie leurs marqueurs", () => {
  assert.match(runtime, /naxa_e2e_promoteur/);
  assert.match(runtime, /naxa_e2e_expiry_overflow/);
  assert.match(runtime, /naxa_e2e_acheteur/);
  assert.match(runtime, /naxa_e2e_fixture/);
  assert.match(runtime, /admin\.auth\.admin\.generateLink/);
  assert.match(runtime, /ssrClient\.auth\.verifyOtp/);
  assert.doesNotMatch(runtime, /admin\.auth\.admin\.createUser/);
});

test("les écritures Replay temporaires disposent d'un nettoyage vérifié", () => {
  assert.match(runtime, /naxa_professional_assignments/);
  assert.match(runtime, /partner_members/);
  assert.match(runtime, /partner_subscription_payments/);
  assert.match(runtime, /naxa_payment_destinations/);
  assert.match(runtime, /NAXA E2E — Destination non réelle/);
  assert.match(runtime, /E2E-REPLAY-NON-REEL/);
  assert.match(runtime, /partner_soumettre_reglement_abonnement/);
  assert.match(runtime, /admin_confirmer_reglement_partenaire/);
  assert.match(runtime, /assert\.equal\(pendingPayment\.status, "pending"/);
  assert.match(runtime, /assert\.equal\(confirmedPayment\.status, "confirmed"/);
  assert.match(runtime, /confirmation_source, "manual_admin"/);
  assert.match(runtime, /first_confirmed_payment_at/);
  assert.match(runtime, /monthly_fee_fcfa: 1/);
  assert.match(runtime, /state\.paymentId/);
  assert.match(runtime, /state\.paymentDestinationId/);
  assert.match(runtime, /from\("partners"\)\.insert/);
  assert.doesNotMatch(runtime, /admin\.from\("partner_subscriptions"\)\.insert/);
  assert.match(runtime, /from\("naxa_profile_active_roles"\)/);
  assert.match(runtime, /\.delete\(\)/);
  assert.match(runtime, /le partenaire temporaire est toujours présent/);
  assert.match(runtime, /le règlement partenaire temporaire est toujours présent/);
  assert.match(runtime, /la destination de paiement temporaire est toujours présente/);
  assert.match(runtime, /l'affectation Comptable temporaire est toujours présente/);
  assert.match(runtime, /les champs du profil Comptable n'ont pas été restaurés exactement/);
  assert.match(runtime, /Fermeture de session Auth refusée/);
  assert.match(runtime, /domain: cookieDomain/);
  assert.match(runtime, /Aucun cookie Auth SSR à injecter/);
  assert.match(runtime, /Cookie Auth sans domaine\/chemin valide/);
});

test("les clics navigateur couvrent Promoteur desktop/mobile, Comptable, Partenaire et Client", () => {
  for (const route of [
    "/pharmacie/promoteur/livraisons",
    "/pharmacie/comptable/creances-bordereaux",
    "/pharmacie/comptable/rejets-relances",
    "/pharmacie/comptable/rapports-exports",
    "/pharmacie/comptable/documents",
    "/pharmacie/comptable/referentiels",
    "/pharmacie/comptabilite/plan",
    "/partenaire/examens",
  ]) assert.ok(runtime.includes(route), "Route absente du scénario : " + route);
  assert.match(runtime, /Navigation des sous-pages Promoteur/);
  assert.match(runtime, /Sous-navigation Promoteur → Livraisons du réseau/);
  assert.match(runtime, /Navigation latérale Promoteur → Livraisons du réseau/);
  assert.match(runtime, /Retour sidebar au tableau de bord Comptable/);
  assert.ok(runtime.includes("dashboardLink.click()"));
  for (const route of ["/client", "/client/profil/favoris", "/panier", "/resultats?q=paracetamol", "/client/historique"]) {
    assert.ok(runtime.includes(route), "Route Client absente du scénario : " + route);
  }
  assert.match(runtime, /Article local de recette/);
  assert.match(runtime, /Filtrer par ville/);
  assert.match(runtime, /assurance-options/);
  assert.match(runtime, /history-period/);
  assert.match(runtime, /390, height: 844/);
});


test("Lot B2 exécute le vrai parcours Client Marketplace de bout en bout sur Replay", () => {
  assert.match(runtime, /prepareClientMarketplaceFixture/);
  assert.match(runtime, /clientPage\.locator\("main h1"\)\.filter\(\{ hasText: "Mes favoris" \}\)/);
  assert.match(runtime, /client\.rpc\("search_pharmacies_bulk"/);
  assert.doesNotMatch(runtime, /admin\.rpc\("search_pharmacies_bulk"/);
  assert.match(runtime, /Continuer avec cette pharmacie/);
  assert.match(runtime, /creer_transactions_client|C’est enregistré/);
  assert.match(runtime, /naxa_e2e_expiry_stock/);
  assert.match(runtime, /Confirmer disponibilité et préparer/);
  assert.match(runtime, /Décision réelle de la pharmacie/);
  assert.match(runtime, /Annuler la réservation/);
  assert.match(runtime, /marketplaceAvailableQuantity/);
  assert.match(runtime, /marketplaceInitialAvailable/);
  assert.match(runtime, /historique réel du Client/i);
  assert.match(runtime, /cleanupClientMarketplaceFixture/);
  assert.match(runtime, /PASS Lot B2 — recherche et favori persistants, réservation Client, confirmation Gestionnaire Stock, annulation Client, stock restauré=/);
});

test("le serveur reçoit ses secrets Replay avant d'être démarré et le nettoyage est garanti", () => {
  const adminSecret = workflow.indexOf('export SUPABASE_SECRET_KEY="$NAXA_STORAGE_E2E_ADMIN_KEY"');
  const rateSecret = workflow.indexOf('export NAXA_RATE_LIMIT_SECRET');
  const serverStart = workflow.indexOf('npm start -- --hostname 127\.0\.0\.1');
  assert.ok(adminSecret >= 0 && rateSecret >= 0 && serverStart >= 0);
  assert.ok(adminSecret < serverStart && rateSecret < serverStart,
    "Les variables doivent être exportées avant le processus Next.js.");
  assert.match(workflow, /NAXA_E2E_ALLOW_TEMP_FIXTURES: "true"/);
  assert.match(workflow, /if: always\(\)[\s\S]*naxa-navigation-runtime\.cjs --cleanup/);
});
