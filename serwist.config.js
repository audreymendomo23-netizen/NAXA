// @ts-check
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { serwist } from "@serwist/next/config";

// Seul l'écran statique hors-ligne est précaché explicitement.
// Les pages Next prérendues ne sont pas ajoutées automatiquement afin
// d'empêcher toute mise en cache involontaire de contenus personnalisés.
const offlineRevision = createHash("sha256")
  .update(readFileSync("public/offline.html"))
  .digest("hex");

export default serwist({
  swSrc: "worker/sw.ts",
  swDest: "public/sw.js",
  precachePrerendered: false,
  additionalPrecacheEntries: [
    { url: "/offline.html", revision: offlineRevision },
  ],
});
