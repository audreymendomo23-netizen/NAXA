"use client";

const DB_NAME = "naxa-offline-v1";
const DB_VERSION = 2;
const META = "meta";
const QUEUE = "queue";
const REF = "reference";
export type PendingOperation = { id: string; type: string; payload: unknown; createdAt: number; modifiedAt: number; deviceSequence: number; attempts: number; status: "pending" | "retry" | "conflict" | "rejected" | "failed_terminal"; terminalDetail?: unknown; terminalAt?: number };
type StoredOperation = Omit<PendingOperation, "payload" | "terminalDetail"> & { payloadCipher: Encrypted; terminalDetailCipher?: Encrypted };
type Encrypted = { iv: number[]; cipher: number[] };
type Meta = { id: string; salt?: number[]; pinHash?: number[]; deviceId?: string; pharmacyId?: string; pharmacyName?: string; role?: "pharmacie" | "caisse"; canEditStock?: boolean; tokenCipher?: Encrypted; lastSync?: number; pinFailures?: number; pinBlockedUntil?: number; pinBlockSeconds?: number; serverLocked?: boolean; serverTimeMs?: number; serverTimeLocalMs?: number; nextDeviceSequence?: number; lastIssuedModifiedAtMs?: number; lastObservedLocalMs?: number };
const LOCAL_IDLE_LOCK_MS = 15 * 60 * 1000;
let activeUnlocked: { deviceId: string; pharmacyId: string; pharmacyName: string; token: string; aes: CryptoKey; lastSync: number; lastActivityAt: number } | null = null;
function currentUnlocked() {
  if (activeUnlocked && Date.now() - activeUnlocked.lastActivityAt >= LOCAL_IDLE_LOCK_MS) activeUnlocked = null;
  return activeUnlocked;
}
export function touchLocalDeviceActivity() {
  const session = currentUnlocked();
  if (!session) return false;
  session.lastActivityAt = Date.now();
  return true;
}
export function lockLocalDevice() { activeUnlocked = null; }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains(META)) d.createObjectStore(META, { keyPath: "id" });
      if (!d.objectStoreNames.contains(QUEUE)) d.createObjectStore(QUEUE, { keyPath: "id" });
      if (!d.objectStoreNames.contains(REF)) d.createObjectStore(REF, { keyPath: "id" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(d => new Promise<T>((resolve, reject) => {
    const t = d.transaction(store, mode);
    const r = fn(t.objectStore(store));
    let result: T | undefined;
    let failure: DOMException | null = null;
    r.onsuccess = () => { result = r.result; };
    r.onerror = () => { failure = r.error; };
    t.oncomplete = () => { d.close(); resolve(result as T); };
    t.onabort = () => { d.close(); reject(failure ?? t.error ?? new Error("Transaction IndexedDB annulée")); };
    t.onerror = () => { failure = t.error; };
  }));
}
async function derive(pin: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey", "deriveBits"]);
  const params = { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" } as Pbkdf2Params;
  const aes = await crypto.subtle.deriveKey(params, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const bits = await crypto.subtle.deriveBits(params, material, 256);
  return { aes, hash: Array.from(new Uint8Array(bits)) };
}
async function encrypt(key: CryptoKey, value: string): Promise<Encrypted> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return { iv: Array.from(iv), cipher: Array.from(new Uint8Array(cipher)) };
}
async function decrypt(key: CryptoKey, value: Encrypted) {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(value.iv) }, key, new Uint8Array(value.cipher));
  return new TextDecoder().decode(plain);
}
export async function getLocalDeviceIdentity() {
  try {
    const meta = await tx<Meta | undefined>(META, "readonly", s => s.get("device"));
    if (!meta?.tokenCipher || !meta.salt || !meta.pinHash || !meta.deviceId || !meta.pharmacyId || !meta.pharmacyName) return null;
    return { deviceId: meta.deviceId, pharmacyId: meta.pharmacyId, pharmacyName: meta.pharmacyName ?? "", role: meta.role, canEditStock: meta.canEditStock === true };
  } catch {
    return null;
  }
}
export async function hasLocalDevice() {
  try { const m = await tx<Meta | undefined>(META, "readonly", s => s.get("device")); return Boolean(m?.tokenCipher); } catch { return false; }
}
export async function getLocalInstallationId() {
  const m = await tx<Meta | undefined>(META, "readonly", s => s.get("installation"));
  if (m?.id && (m as Meta & { value?: string }).value) return (m as Meta & { value: string }).value;
  const value = crypto.randomUUID();
  await tx(META, "readwrite", s => s.put({ id: "installation", value }));
  return value;
}
export async function assertLocalDeviceActivationAllowed() {
  const database = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = database.transaction([META, QUEUE, REF], "readonly");
    let checks = 0;
    let deviceExists = false;
    let queuedCount = 0;
    let referenceCount = 0;
    const finishCheck = () => {
      checks += 1;
      if (checks !== 3) return;
      if (deviceExists || queuedCount > 0 || referenceCount > 0) {
        reject(new Error("Un appareil ou des données hors ligne existent déjà. Réactivation et changement de PIN bloqués pour préserver la file chiffrée. Déverrouillez le poste existant et synchronisez-le avant toute procédure de remplacement."));
      }
    };
    const deviceRequest = t.objectStore(META).get("device");
    deviceRequest.onsuccess = () => { deviceExists = Boolean(deviceRequest.result); finishCheck(); };
    const queueRequest = t.objectStore(QUEUE).count();
    queueRequest.onsuccess = () => { queuedCount = Number(queueRequest.result ?? 0); finishCheck(); };
    const referenceRequest = t.objectStore(REF).count();
    referenceRequest.onsuccess = () => { referenceCount = Number(referenceRequest.result ?? 0); finishCheck(); };
    t.oncomplete = () => { database.close(); resolve(); };
    t.onerror = () => { database.close(); reject(t.error ?? new Error("Vérification de l'appareil local impossible.")); };
    t.onabort = () => { database.close(); reject(t.error ?? new Error("Vérification de l'appareil local annulée.")); };
  });
}
export async function activateLocalDevice(input: { pin: string; deviceId: string; pharmacyId: string; pharmacyName: string; role: "pharmacie" | "caisse"; canEditStock: true; token: string; serverTimeMs?: number; nextDeviceSequence?: number; reference?: unknown }) {
  if (!/^\d{4,6}$/.test(input.pin)) throw new Error("Le PIN doit contenir 4 à 6 chiffres");
  if (input.role !== "pharmacie" && input.role !== "caisse") throw new Error("Rôle local non autorisé.");
  const salt = crypto.getRandomValues(new Uint8Array(16)), { aes, hash } = await derive(input.pin, salt);
  const localNow = Date.now();
  const meta: Meta = { id: "device", salt: Array.from(salt), pinHash: hash, deviceId: input.deviceId, pharmacyId: input.pharmacyId, pharmacyName: input.pharmacyName, role: input.role, canEditStock: input.canEditStock, tokenCipher: await encrypt(aes, input.token), lastSync: localNow, serverTimeMs: input.serverTimeMs, serverTimeLocalMs: input.serverTimeMs ? localNow : undefined, nextDeviceSequence: Math.max(0, Math.floor(input.nextDeviceSequence ?? 0)), lastIssuedModifiedAtMs: 0, lastObservedLocalMs: localNow, pinFailures: 0, pinBlockedUntil: 0, pinBlockSeconds: 30 };
  // Check-and-insert in one read/write transaction: two tabs cannot race and re-key
  // an existing encrypted queue or snapshot.
  const database = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = database.transaction([META, QUEUE, REF], "readwrite");
    let checks = 0;
    let deviceExists = false;
    let queuedCount = 0;
    let referenceCount = 0;
    let guardError: Error | null = null;
    const finishCheck = () => {
      checks += 1;
      if (checks !== 3) return;
      if (deviceExists || queuedCount > 0 || referenceCount > 0) {
        guardError = new Error("Un appareil ou des données hors ligne existent déjà. Réactivation et changement de PIN bloqués pour préserver la file chiffrée. Déverrouillez le poste existant et synchronisez-le avant toute procédure de remplacement.");
        t.abort();
        return;
      }
      t.objectStore(META).add(meta);
    };
    const deviceRequest = t.objectStore(META).get("device");
    deviceRequest.onsuccess = () => { deviceExists = Boolean(deviceRequest.result); finishCheck(); };
    const queueRequest = t.objectStore(QUEUE).count();
    queueRequest.onsuccess = () => { queuedCount = Number(queueRequest.result ?? 0); finishCheck(); };
    const referenceRequest = t.objectStore(REF).count();
    referenceRequest.onsuccess = () => { referenceCount = Number(referenceRequest.result ?? 0); finishCheck(); };
    t.oncomplete = () => { database.close(); resolve(); };
    t.onerror = () => { /* IndexedDB abort handler reports the transaction failure. */ };
    t.onabort = () => { database.close(); reject(guardError ?? t.error ?? new Error("Activation locale annulée.")); };
  });
  activeUnlocked = { deviceId: input.deviceId, pharmacyId: input.pharmacyId, pharmacyName: input.pharmacyName, token: input.token, aes, lastSync: Date.now(), lastActivityAt: Date.now() };
  if (input.reference !== undefined) await saveReference(input.reference);
}
export async function unlockLocalDevice(pin: string, allowExpired = false) {
  const meta = await tx<Meta | undefined>(META, "readonly", s => s.get("device"));
  if (!meta || !meta.salt || !meta.pinHash || !meta.deviceId || !meta.pharmacyId || !meta.pharmacyName || !meta.tokenCipher) throw new Error("Aucun appareil activé sur cet appareil");
  if (meta.serverLocked && !allowExpired) throw new Error("Appareil désactivé ou expiré côté serveur. Reconnectez-vous en ligne.");
  if ((meta.pinBlockedUntil || 0) > Date.now()) throw new Error("Trop d'essais. Réessayez dans " + Math.ceil(((meta.pinBlockedUntil || 0) - Date.now()) / 1000) + " secondes.");
  const { aes, hash } = await derive(pin, new Uint8Array(meta.salt));
  if (hash.length !== meta.pinHash.length || hash.some((v, i) => v !== meta.pinHash?.[i])) {
    const failures = (meta.pinFailures || 0) + 1;
    meta.pinFailures = failures;
    if (failures >= 5) {
      const seconds = Math.min(900, meta.pinBlockSeconds || 30);
      meta.pinBlockedUntil = Date.now() + seconds * 1000;
      meta.pinBlockSeconds = Math.min(900, seconds * 2);
      meta.pinFailures = 0;
    }
    await tx(META, "readwrite", s => s.put(meta));
    throw new Error(meta.pinBlockedUntil && meta.pinBlockedUntil > Date.now() ? "Trop d'essais. Réessayez dans " + Math.ceil((meta.pinBlockedUntil - Date.now()) / 1000) + " secondes." : "PIN incorrect");
  }
  const localNow = Date.now();
  if (!allowExpired && ((typeof meta.serverTimeLocalMs === "number" && localNow < meta.serverTimeLocalMs)
    || (typeof meta.lastObservedLocalMs === "number" && localNow < meta.lastObservedLocalMs))) {
    throw new Error("L'horloge locale a reculé depuis la dernière synchronisation. Reconnectez l'appareil avant de le déverrouiller.");
  }
  const lastSync = meta.lastSync || 0;
  if (!allowExpired && (lastSync <= 0 || localNow - lastSync > 7 * 24 * 60 * 60 * 1000)) throw new Error("Appareil expiré après 7 jours sans synchronisation. Reconnectez-vous en ligne.");
  const token = await decrypt(aes, meta.tokenCipher);
  meta.pinFailures = 0; meta.pinBlockedUntil = 0; meta.pinBlockSeconds = 30;
  meta.lastObservedLocalMs = Math.max(meta.lastObservedLocalMs ?? 0, localNow);
  if (allowExpired) meta.serverLocked = false;
  await tx(META, "readwrite", s => s.put(meta));
  activeUnlocked = { deviceId: meta.deviceId, pharmacyId: meta.pharmacyId, pharmacyName: meta.pharmacyName, token, aes, lastSync, lastActivityAt: Date.now() };
  return activeUnlocked;
}
export function getUnlockedDevice() { return currentUnlocked(); }
export async function saveReference(data: unknown) {
  const session = currentUnlocked();
  if (!session) return;
  const value = await encrypt(session.aes, JSON.stringify(data));
  await tx(REF, "readwrite", s => s.put({ id: "snapshot", value, savedAt: Date.now() }));
}
export async function readReference() {
  const row = await tx<{ id: string; value: Encrypted; savedAt: number } | undefined>(REF, "readonly", s => s.get("snapshot"));
  const session = currentUnlocked();
  if (!row || !session) return undefined;
  try { return { id: row.id, value: JSON.parse(await decrypt(session.aes, row.value)), savedAt: row.savedAt }; } catch { return undefined; }
}
export async function saveServerTimeAnchor(serverTimeMs: number) {
  if (!Number.isSafeInteger(serverTimeMs) || serverTimeMs <= 0) throw new Error("Horloge serveur invalide");
  const localNow = Date.now();
  const meta = await tx<Meta | undefined>(META, "readonly", s => s.get("device"));
  if (!meta?.deviceId || !meta.tokenCipher) throw new Error("Appareil hors ligne non activé");
  meta.serverTimeMs = serverTimeMs;
  meta.serverTimeLocalMs = localNow;
  meta.lastSync = localNow;
  meta.lastObservedLocalMs = Math.max(meta.lastObservedLocalMs ?? 0, localNow);
  await tx(META, "readwrite", s => s.put(meta));
  const session = currentUnlocked();
  if (session) session.lastSync = localNow;
}

export async function enregistrerOperation(type: string, payload: unknown): Promise<string> {
  const session = currentUnlocked();
  if (!session) throw new Error("Déverrouillez l'appareil avant d'enregistrer une opération hors ligne.");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Contenu d'opération invalide.");
  }

  let safePayload = payload;
  if (type === "stock_set_quantity") {
    const input = payload as Record<string, unknown>;
    const productId = String(input.produit_id ?? input.produitId ?? input.product_id ?? "");
    const quantity = Number(input.quantite ?? input.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 0) {
      throw new Error("Modification hors ligne impossible : produit ou quantité invalide.");
    }
    const reference = await readReference();
    const snapshot = reference?.value as { stock?: Array<Record<string, unknown>> } | undefined;
    const row = snapshot?.stock?.find((item) => {
      const nested = item.produits && typeof item.produits === "object" ? item.produits as Record<string, unknown> : {};
      return String(item.produit_id ?? item.product_id ?? nested.id ?? "") === productId;
    });
    const baseUpdatedAt = row?.updated_at ?? row?.updatedAt;
    if (typeof baseUpdatedAt !== "string" || !Number.isFinite(Date.parse(baseUpdatedAt))) {
      throw new Error("Modification hors ligne impossible : horodatage du stock de référence absent. Synchronisez d'abord l'appareil.");
    }
    safePayload = { ...input, produit_id: productId, quantite: quantity, base_updated_at: baseUpdatedAt };
  }

  // Encrypt before opening the IndexedDB write transaction; WebCrypto yields and would
  // otherwise allow the transaction to auto-close before the queue write.
  const payloadCipher = await encrypt(session.aes, JSON.stringify(safePayload));
  const id = crypto.randomUUID();
  const localNow = Date.now();
  const d = await openDb();
  return new Promise<string>((resolve, reject) => {
    const t = d.transaction([META, QUEUE], "readwrite");
    const metaStore = t.objectStore(META);
    const queueStore = t.objectStore(QUEUE);
    const request = metaStore.get("device");
    let resultError: Error | null = null;
    request.onsuccess = () => {
      const meta = request.result as Meta | undefined;
      if (!meta?.deviceId || !meta.serverTimeMs || !meta.serverTimeLocalMs) {
        resultError = new Error("Synchronisez l'appareil en ligne avant de créer une opération hors ligne.");
        t.abort();
        return;
      }
      if (typeof meta.lastObservedLocalMs === "number" && localNow < meta.lastObservedLocalMs) {
        resultError = new Error("L'horloge de cet appareil a reculé. Reconnectez-le pour recalibrer la chronologie.");
        t.abort();
        return;
      }
      const elapsed = localNow - meta.serverTimeLocalMs;
      if (elapsed < 0 || elapsed > 7 * 24 * 60 * 60 * 1000) {
        resultError = new Error("L'ancrage horaire de l'appareil a expiré. Reconnectez-le avant de continuer.");
        t.abort();
        return;
      }
      const estimatedServerTime = meta.serverTimeMs + elapsed;
      const modifiedAt = Math.max(estimatedServerTime, (meta.lastIssuedModifiedAtMs ?? 0) + 1);
      const deviceSequence = (meta.nextDeviceSequence ?? 0) + 1;
      meta.nextDeviceSequence = deviceSequence;
      meta.lastIssuedModifiedAtMs = modifiedAt;
      meta.lastObservedLocalMs = localNow;
      metaStore.put(meta);
      const operation: StoredOperation = {
        id, type, createdAt: localNow, modifiedAt, deviceSequence,
        attempts: 0, status: "pending", payloadCipher
      };
      queueStore.add(operation);
    };
    t.oncomplete = () => { d.close(); resolve(id); };
    t.onerror = () => { d.close(); reject(resultError ?? t.error ?? new Error("Échec de mise en file hors ligne")); };
    t.onabort = () => { d.close(); reject(resultError ?? t.error ?? new Error("Opération hors ligne annulée")); };
  });
}

export async function listPendingOperations(): Promise<PendingOperation[]> {
  const rows = await tx<StoredOperation[]>(QUEUE, "readonly", s => s.getAll());
  const session = currentUnlocked();
  const pending = rows.filter(x => x.status === "pending" || x.status === "retry" || (x.status as string) === "failed");
  const output: PendingOperation[] = [];
  for (const row of pending) {
    // Legacy queue entries predate the trusted chronology and cannot safely be applied.
    if (!Number.isSafeInteger(row.modifiedAt) || !Number.isSafeInteger(row.deviceSequence) || row.deviceSequence <= 0) {
      const terminal = { ...row, status: "failed_terminal" as const, terminalAt: Date.now(),
        terminalDetail: { reason: "legacy_operation_without_trusted_chronology", message: "Cette opération a été créée avant l'ancrage horaire et la séquence appareil. Vérifiez le stock puis créez une nouvelle correction." } };
      if (row.payloadCipher) {
        await tx(QUEUE, "readwrite", s => s.put(terminal));
      } else if ((row as unknown as { payload?: unknown }).payload !== undefined && session) {
        const legacyPayload = (row as unknown as { payload: unknown }).payload;
        const payloadCipher = await encrypt(session.aes, JSON.stringify(legacyPayload));
        const migrated = { ...terminal, payloadCipher } as StoredOperation;
        delete (migrated as unknown as { payload?: unknown }).payload;
        await tx(QUEUE, "readwrite", s => s.put(migrated));
      } else {
        await tx(QUEUE, "readwrite", s => s.put(terminal));
      }
      continue;
    }
    if (!session) throw new Error("Déverrouillez l'appareil pour lire la file hors ligne.");
    let payload: unknown;
    if (row.payloadCipher) {
      payload = JSON.parse(await decrypt(session.aes, row.payloadCipher));
    } else {
      const legacyPayload = (row as unknown as { payload?: unknown }).payload;
      payload = legacyPayload;
      const payloadCipher = await encrypt(session.aes, JSON.stringify(legacyPayload ?? {}));
      const migrated = { ...row, payloadCipher } as StoredOperation;
      delete (migrated as unknown as { payload?: unknown }).payload;
      await tx(QUEUE, "readwrite", s => s.put(migrated));
    }
    output.push({ id: row.id, type: row.type, payload, createdAt: row.createdAt,
      modifiedAt: row.modifiedAt, deviceSequence: row.deviceSequence, attempts: row.attempts,
      status: row.status === "failed" ? "retry" : row.status as "pending" | "retry" });
  }
  return output.sort((a, b) => a.modifiedAt - b.modifiedAt || a.deviceSequence - b.deviceSequence || a.id.localeCompare(b.id));
}

export async function listTerminalOperations(): Promise<Array<{ id: string; type: string; createdAt: number; status: string; terminalDetail?: unknown; terminalAt?: number }>> {
  const rows = await tx<StoredOperation[]>(QUEUE, "readonly", s => s.getAll());
  const session = currentUnlocked();
  const terminal = rows.filter(x => ["conflict", "rejected", "failed_terminal"].includes(x.status));
  const result: Array<{ id: string; type: string; createdAt: number; status: string; terminalDetail?: unknown; terminalAt?: number }> = [];
  for (const row of terminal) {
    let terminalDetail: unknown;
    if (row.terminalDetailCipher && session) {
      try { terminalDetail = JSON.parse(await decrypt(session.aes, row.terminalDetailCipher)); }
      catch { terminalDetail = { reason: "terminal_detail_unreadable" }; }
    } else if (row.terminalDetail !== undefined) {
      terminalDetail = row.terminalDetail;
    }
    result.push({ id: row.id, type: row.type, createdAt: row.createdAt, status: row.status, terminalDetail, terminalAt: row.terminalAt });
  }
  return result.sort((a, b) => (b.terminalAt ?? b.createdAt) - (a.terminalAt ?? a.createdAt));
}

export async function markOperationAttempt(id: string) {
  const d = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = d.transaction(QUEUE, "readwrite"), s = t.objectStore(QUEUE), r = s.get(id);
    r.onsuccess = () => {
      if (r.result) {
        r.result.attempts = (r.result.attempts ?? 0) + 1;
        r.result.status = "retry";
        s.put(r.result);
      }
    };
    t.oncomplete = () => { d.close(); resolve(); };
    t.onerror = () => { d.close(); reject(t.error); };
  });
}
export async function markOperationTerminal(id: string, status: "conflict" | "rejected" | "failed_terminal", detail: unknown) {
  const session = currentUnlocked();
  if (!session) throw new Error("Déverrouillez l'appareil avant d'archiver le résultat de synchronisation.");
  const terminalDetailCipher = await encrypt(session.aes, JSON.stringify(detail ?? {}));
  const d = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = d.transaction(QUEUE, "readwrite"), s = t.objectStore(QUEUE), r = s.get(id);
    r.onsuccess = () => {
      if (r.result) {
        r.result.status = status;
        r.result.terminalAt = Date.now();
        r.result.terminalDetailCipher = terminalDetailCipher;
        delete r.result.terminalDetail;
        r.result.attempts = (r.result.attempts ?? 0) + 1;
        s.put(r.result);
      }
    };
    t.oncomplete = () => { d.close(); resolve(); };
    t.onerror = () => { d.close(); reject(t.error); };
  });
}
export async function removeOperation(id: string) { await tx(QUEUE, "readwrite", s => s.delete(id)); }
export async function markLocalSync() { const meta=await tx<Meta|undefined>(META,"readonly",s=>s.get("device"));if(!meta)return;meta.lastSync=Date.now();await tx(META,"readwrite",s=>s.put(meta));const session=currentUnlocked();if(session)session.lastSync=meta.lastSync; }
export async function pendingCount() { return (await listPendingOperations()).length; }
export async function terminalCount() { return (await listTerminalOperations()).length; }
export async function clearLocalDevice() {
  const d = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = d.transaction([META, QUEUE, REF], "readwrite");
    t.objectStore(META).clear(); t.objectStore(QUEUE).clear(); t.objectStore(REF).clear();
    t.oncomplete = () => { d.close(); activeUnlocked = null; resolve(); }; t.onerror = () => { d.close(); reject(t.error); };
  });
}

export async function saveTokenEncryptedForSession(pin: string, token: string) {
  const meta = await tx<Meta | undefined>(META, "readonly", s => s.get("device"));
  if (!meta?.salt) throw new Error("Appareil absent");
  const { aes } = await derive(pin, new Uint8Array(meta.salt));
  meta.tokenCipher = await encrypt(aes, token);
  await tx(META, "readwrite", s => s.put(meta));
}

export async function markDeviceServerLocked() { const meta=await tx<Meta|undefined>(META,"readonly",s=>s.get("device"));if(!meta)return;meta.serverLocked=true;await tx(META,"readwrite",s=>s.put(meta)); }
