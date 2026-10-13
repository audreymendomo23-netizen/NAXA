"use client";

/**
 * navigator.onLine only reports the network interface state. It does not prove
 * that NAXA and its authentication backend are reachable (e.g. Wi-Fi without Internet).
 */
export async function isNaxaBackendReachable(timeoutMs = 3000): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.onLine) return false;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("/api/health", {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}
