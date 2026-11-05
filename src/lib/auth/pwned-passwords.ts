import { createHash } from "node:crypto";

/**
 * Checks a password against Have I Been Pwned Pwned Passwords using the
 * k-anonymity range endpoint. Only the first five SHA-1 hex characters leave
 * the NAXA server; the password and full hash are never transmitted or stored.
 */
export async function checkPwnedPassword(password: string): Promise<{ compromised: boolean; prevalence: number }> {
  if (typeof password !== "string" || password.length === 0 || password.length > 1024) {
    throw new Error("Invalid password input");
  }

  const fullHash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = fullHash.slice(0, 5);
  const suffix = fullHash.slice(5);

  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Add-Padding": "true",
      "User-Agent": "NAXA-Password-Security/1.0",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Pwned Passwords unavailable (HTTP ${response.status})`);
  }

  const body = await response.text();
  if (body.length > 1_000_000) {
    throw new Error("Pwned Passwords response exceeded the expected size");
  }

  for (const line of body.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;

    const returnedSuffix = line.slice(0, separator).trim().toUpperCase();
    if (returnedSuffix !== suffix) continue;

    const count = Number.parseInt(line.slice(separator + 1).trim(), 10);
    if (!Number.isFinite(count) || count < 0) throw new Error("Invalid Pwned Passwords response");
    return { compromised: count > 0, prevalence: count };
  }

  return { compromised: false, prevalence: 0 };
}
