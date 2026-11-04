"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listPendingOperations,
  listTerminalOperations,
  pendingCount,
  terminalCount,
  removeOperation,
  markOperationAttempt,
  markOperationTerminal,
  saveServerTimeAnchor,
  saveReference,
  readReference,
  markLocalSync,
  markDeviceServerLocked,
  getUnlockedDevice,
} from "@/lib/offline-db";

type TerminalItem = Awaited<ReturnType<typeof listTerminalOperations>>[number];

function reasonOf(detail: unknown) {
  if (!detail || typeof detail !== "object") return "Résultat serveur à examiner";
  const record = detail as Record<string, unknown>;
  return typeof record.reason === "string"
    ? record.reason
    : typeof record.message === "string"
      ? record.message
      : "Résultat serveur à examiner";
}

export function EtatHorsLigne() {
  const [online, setOnline] = useState(true);
  const [count, setCount] = useState(0);
  const [terminals, setTerminals] = useState<TerminalItem[]>([]);
  const [synced, setSynced] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    setOnline(navigator.onLine);
    const [pending, terminal] = await Promise.all([
      pendingCount().catch(() => 0),
      listTerminalOperations().catch(() => [] as TerminalItem[]),
    ]);
    setCount(pending);
    setTerminals(terminal);
  }, []);

  const mergeReference = useCallback(async (reference: unknown) => {
    if (reference === undefined || reference === null) return;
    const old = await readReference();
    const previous = old?.value && typeof old.value === "object"
      ? old.value as Record<string, unknown>
      : {};
    await saveReference({ ...previous, ...(reference as Record<string, unknown>) });
  }, []);

  const acceptServerClock = useCallback(async (data: Record<string, unknown>) => {
    if (typeof data.serverTimeMs === "number") {
      await saveServerTimeAnchor(data.serverTimeMs);
    }
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    const device = getUnlockedDevice();
    if (!device) return;

    let allOk = true;
    try {
      const operations = await listPendingOperations();
      if (operations.length === 0) {
        const ping = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + device.token },
          body: JSON.stringify({ operations: [] }),
        });
        if (ping.status === 401) {
          await markDeviceServerLocked();
          window.location.replace("/connexion?espace=pharmacie");
          return;
        }
        if (!ping.ok) throw new Error("sync failed");
        const data = await ping.json() as Record<string, unknown>;
        await acceptServerClock(data);
        await mergeReference(data.reference);
      }

      for (const operation of operations) {
        try {
          const response = await fetch("/api/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + device.token },
            body: JSON.stringify({ operations: [operation] }),
          });
          if (response.status === 401) {
            await markDeviceServerLocked();
            window.location.replace("/connexion?espace=pharmacie");
            return;
          }
          if (!response.ok) throw new Error("sync failed");

          const data = await response.json() as Record<string, unknown>;
          await acceptServerClock(data);
          await mergeReference(data.reference);

          const results = Array.isArray(data.results) ? data.results as Array<Record<string, unknown>> : [];
          const result = results.find((item) => item.id === operation.id);
          const status = typeof result?.status === "string" ? result.status : "retry";

          if (status === "applied" || status === "already_applied") {
            await removeOperation(operation.id);
          } else if (status === "retry") {
            // Only transient/network failures remain eligible for automatic retry.
            await markOperationAttempt(operation.id);
            allOk = false;
            break;
          } else if (status === "conflict") {
            await markOperationTerminal(operation.id, "conflict", result?.detail ?? result);
          } else if (status === "rejected") {
            await markOperationTerminal(operation.id, "rejected", result?.detail ?? result);
          } else if (status === "failed") {
            await markOperationTerminal(operation.id, "failed_terminal", result?.detail ?? result);
          } else {
            await markOperationAttempt(operation.id);
            allOk = false;
            break;
          }
        } catch {
          await markOperationAttempt(operation.id).catch(() => undefined);
          allOk = false;
          break;
        }
      }

      if (allOk) {
        await markLocalSync();
        setSynced(true);
      }
      await refresh();
    } catch {
      allOk = false;
      await refresh();
    }
  }, [acceptServerClock, mergeReference, refresh]);

  useEffect(() => {
    void refresh();
    void sync();
    const onConnectivity = () => {
      void refresh();
      if (navigator.onLine) void sync();
    };
    window.addEventListener("online", onConnectivity);
    window.addEventListener("offline", onConnectivity);
    const timer = window.setInterval(() => {
      if (navigator.onLine) void sync();
    }, 60_000);
    return () => {
      window.removeEventListener("online", onConnectivity);
      window.removeEventListener("offline", onConnectivity);
      window.clearInterval(timer);
    };
  }, [refresh, sync]);

  return (
    <div className="inline-flex flex-wrap items-center gap-2 text-xs font-semibold" aria-live="polite">
      <span className={`inline-block h-2 w-2 rounded-full ${!online ? "bg-gray-400" : count ? "bg-yellow-400" : "bg-green-500"}`} />
      <span>{!online ? "Hors ligne" : count ? `En attente d'envoi (${count})` : synced ? "Synchronisé" : "Connecté"}</span>
      {terminals.length > 0 && (
        <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)} className="font-normal">
          <summary className="cursor-pointer font-semibold text-amber-800">
            {terminals.length} opération(s) à examiner
          </summary>
          <ul className="mt-2 max-w-xl space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-amber-950">
            {terminals.map((item) => (
              <li key={item.id}>
                <strong>{item.type}</strong> · {reasonOf(item.terminalDetail)}
                <span className="ml-1 text-xs text-amber-800">({item.id.slice(0, 8)})</span>
              </li>
            ))}
            <li className="pt-1 text-xs">
              Ces opérations ne sont plus réessayées automatiquement. Vérifiez le stock serveur avant de créer une nouvelle correction.
            </li>
          </ul>
        </details>
      )}
    </div>
  );
}

export async function enregistrerNoteDeCaisse(note: string) {
  const { enregistrerOperation } = await import("@/lib/offline-db");
  return enregistrerOperation("note_caisse_test", { note: note.slice(0, 500) });
}
