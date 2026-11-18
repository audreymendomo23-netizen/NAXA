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

module.exports = { hasUsableRefreshTokenPair };
