const fs = require("node:fs");
const assert = require("node:assert/strict");

const scanner = fs.readFileSync("src/components/ScannerShell.tsx", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const copyScript = fs.readFileSync("scripts/copy-pdf-worker.cjs", "utf8");

assert.match(scanner, /await import\("pdfjs-dist\/legacy\/build\/pdf\.mjs"\)/, "le scanner doit utiliser la même build PDF.js legacy");
assert.match(scanner, /GlobalWorkerOptions\.workerSrc = "\/pdf\.worker\.min\.mjs"/, "le worker doit être chargé depuis une URL statique de même origine");
assert.doesNotMatch(scanner, /new URL\("pdfjs-dist\/legacy\/build\/pdf\.worker\.min\.mjs", import\.meta\.url\)/, "le worker ESM ne doit plus entrer dans le bundle Webpack");
assert.match(copyScript, /require\.resolve\("pdfjs-dist\/legacy\/build\/pdf\.worker\.min\.mjs"\)/, "la copie doit provenir exactement de la version PDF.js installée");
assert.match(copyScript, /copyFileSync\(source, destination\)/, "le worker doit être copié sans transformation ni minification supplémentaire");
assert.match(copyScript, /statSync\(destination\)[\s\S]*?size === 0/, "la préparation doit refuser un worker vide");
assert.equal(packageJson.scripts.predev, "node scripts/copy-pdf-worker.cjs", "le worker doit être disponible en développement");
assert.equal(packageJson.scripts.prebuild, "npm run quality && node scripts/copy-pdf-worker.cjs", "le worker doit être préparé après les contrôles qualité et avant Next build");

console.log("PASS — PDF.js ESM worker served as same-origin public asset, not bundled by Webpack");
