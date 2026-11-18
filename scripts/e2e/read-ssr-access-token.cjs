"use strict";

function readAccessTokenFromCookies(cookies) {
  const matches = cookies.filter(cookie => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name));
  if (matches.length === 0) throw new Error("Cookie Auth absent pendant la fermeture de la session navigateur.");
  const baseName = matches[0].name.replace(/\.\d+$/, "");
  const encoded = matches
    .filter(cookie => cookie.name === baseName || cookie.name.startsWith(baseName + "."))
    .sort((a, b) => {
      const ai = Number(a.name.slice(baseName.length + 1)) || 0;
      const bi = Number(b.name.slice(baseName.length + 1)) || 0;
      return ai - bi;
    })
    .map(cookie => cookie.value)
    .join("");
  const raw = encoded.startsWith("base64-")
    ? Buffer.from(encoded.slice(7), "base64url").toString("utf8")
    : encoded;
  let session;
  try { session = JSON.parse(raw); } catch {
    throw new Error("Impossible de lire le cookie Auth SSR pour fermer la session navigateur.");
  }
  const accessToken = Array.isArray(session) ? session[0] : session?.access_token;
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("Le cookie Auth SSR ne contient aucun access token exploitable pour la fermeture.");
  }
  return accessToken;
}

module.exports = { readAccessTokenFromCookies };
