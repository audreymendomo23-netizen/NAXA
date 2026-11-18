"use strict";

function hasUsableRefreshTokenPair(result) {
  return Boolean(
    result
    && result.ok === true
    && typeof result.data?.access_token === "string"
    && result.data.access_token.length > 0
    && typeof result.data?.refresh_token === "string"
    && result.data.refresh_token.length > 0
  );
}

function readAuthErrorCode(data) {
  if (!data || typeof data !== "object") return "non fourni";
  // Supabase Auth may return a numeric HTTP-like code beside its semantic error_code.
  const candidates = [data.error_code, data.code, data.error, data.error_description];
  const value = candidates.find(candidate => typeof candidate === "string" && candidate.trim());
  return value ? value.trim() : "non fourni";
}

module.exports = { hasUsableRefreshTokenPair, readAuthErrorCode };
