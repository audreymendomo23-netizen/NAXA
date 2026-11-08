const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const screen = read("src/components/pharmacie/PromoteurSecuriteIntelligente.tsx");
const layout = read("src/app/pharmacie/promoteur/layout.tsx");
const navigation = read("src/components/pharmacie/NavPromoteur.tsx");
const dashboard = read("src/app/pharmacie/promoteur/page.tsx");

assert.match(screen, /^"use client";/);
assert.match(screen, /setSelectedPharmacyId/);
assert.match(screen, /Toutes mes pharmacies/);
assert.match(screen, /slice\(safePage \* 4, safePage \* 4 \+ 4\)/);
assert.match(screen, /grid-cols-2/);
assert.match(screen, /setFocusedCameraId\(camera\.id\)/);
assert.match(screen, /Caméra précédente/);
assert.match(screen, /Caméra suivante/);
assert.match(screen, /SecurityWhepPlayer/);
assert.match(screen, /camera\.id === focusedCamera\?\.id/);
assert.match(screen, /<SecurityWhepPlayer cameraId=\{camera\.id\} compact/);
assert.match(screen, /<SecurityWhepPlayer cameraId=\{focusedCamera\.id\}/);
const player = read("src/components/pharmacie/SecurityWhepPlayer.tsx");
assert.match(player, /<video\b/i);
assert.match(player, /api\/security\/cameras\/live-session/);
assert.match(player, /application\/sdp/);
assert.doesNotMatch(player, /rtsp:\/\//i);
assert.match(layout, /label:"9\. Sécurité",href:"\/pharmacie\/promoteur\/securite",icon:"◉"/);
assert.match(navigation, /"◉":/);
assert.match(dashboard, /\.in\("pharmacie_id", scopedIds\)/);
assert.match(dashboard, /<PromoteurSecuriteIntelligente/);

console.log("PASS — menu latéral Promoteur « Sécurité » et route dédiés");
console.log("PASS — sélection de pharmacie, grille 2 × 2, pagination et navigation caméra");
console.log("PASS — lecteur vidéo WHEP derrière autorisation de session NAXA");
console.log("PASS — données du centre chargées sur le périmètre des pharmacies autorisées");


const actions = read("src/app/pharmacie/promoteur/actions.ts");
const form = read("src/components/pharmacie/PromoteurSecurityInventoryForm.tsx");

assert.match(form, /declarerCameraSecurite/);
assert.match(form, /name="pharmacie_id"/);
assert.match(form, /name="gateway_id"/);
assert.match(form, /name="manufacturer"/);
assert.match(form, /name="model"/);
assert.match(actions, /access\.activeLinkIds\.has\(pharmacyId\)/);
assert.match(actions, /pharmacy\.visible_recherche/);
assert.match(actions, /status: "inventory"/);
assert.match(actions, /tunnel_status: "not_configured"/);
assert.match(actions, /status: "registered"/);
assert.match(actions, /action: "device_update"/);
assert.match(actions, /resource_type: "camera"/);
assert.match(dashboard, /label,serial_number,firmware_version,tunnel_status/);
assert.doesNotMatch(form, /name="(?:password|token|rtsp_url|endpoint_host|auth_secret_reference)"/i);
assert.doesNotMatch(actions, /auth_secret_reference\s*:/);
console.log("PASS — déclaration caméra limitée au réseau Promoteur, inventaire et tunnel non configuré");
