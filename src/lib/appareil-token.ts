import { createHash, randomBytes } from "node:crypto";
export function createDeviceToken() { return randomBytes(32).toString("base64url"); }
export function hashDeviceToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function deviceTokenFromRequest(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}
