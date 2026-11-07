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
assert.match(screen, /Flux vidéo réel non encore connecté/);
assert.match(screen, /Flux non activé/);
assert.doesNotMatch(screen, /<video\b/i);
assert.match(layout, /label:"9\. Sécurité",href:"\/pharmacie\/promoteur\/securite",icon:"◉"/);
assert.match(navigation, /"◉":/);
assert.match(dashboard, /\.in\("pharmacie_id", scopedIds\)/);
assert.match(dashboard, /<PromoteurSecuriteIntelligente/);

console.log("PASS — menu latéral Promoteur « Sécurité » et route dédiés");
console.log("PASS — sélection de pharmacie, grille 2 × 2, pagination et navigation caméra");
console.log("PASS — aucun faux flux vidéo n'est rendu");
console.log("PASS — données du centre chargées sur le périmètre des pharmacies autorisées");
