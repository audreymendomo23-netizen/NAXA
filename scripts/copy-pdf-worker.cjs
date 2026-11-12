const fs = require("node:fs");
const path = require("node:path");

const source = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
const destination = path.resolve(process.cwd(), "public", "pdf.worker.min.mjs");

if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
  throw new Error("Le worker PDF.js attendu est introuvable : " + source);
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);

const copied = fs.statSync(destination);
if (!copied.isFile() || copied.size === 0) {
  throw new Error("La copie du worker PDF.js est vide ou invalide.");
}

console.log("PDF.js worker installé :", destination, "(" + copied.size + " octets)");
