"use client";

const DB_NAME = "naxa-offline-v1";
const DB_VERSION = 1;
const META = "meta";
const QUEUE = "queue";
const REF = "reference";
export type PendingOperation = { id: string; type: string; payload: unknown; createdAt: number; attempts: number; status: "pending" | "failed" };
type StoredOperation = Omit<PendingOperation, "payload"> & { payloadCipher: Encrypted };
type Encrypted = { iv: number[]; cipher: number[] };
type Meta = { id: string; salt?: number[]; pinHash?: number[]; deviceId?: string; pharmacyId?: string; pharmacyName?: string; tokenCipher?: Encrypted; lastSync?: number; pinFailures?: number; pinBlockedUntil?: number; pinBlockSeconds?: number; serverLocked?: boolean };
let activeUnlocked: { deviceId: string; pharmacyId: string; pharmacyName: string; token: string; aes: CryptoKey; lastSync: number } | null = null;

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
    const t = d.transaction(store, mode), r = fn(t.objectStore(store));
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    t.oncomplete = () => d.close(); t.onerror = () => { d.close(); reject(t.error); };
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
    return { deviceId: meta.deviceId, pharmacyId: meta.pharmacyId, pharmacyName: meta.pharmacyName ?? "" };
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
export async function activateLocalDevice(input: { pin: string; deviceId: string; pharmacyId: string; pharmacyName: string; token: string; reference?: unknown }) {
  if (!/^\d{4,6}$/.test(input.pin)) throw new Error("Le PIN doit contenir 4 à 6 chiffres");
  const salt = crypto.getRandomValues(new Uint8Array(16)), { aes, hash } = await derive(input.pin, salt);
  const meta: Meta = { id: "device", salt: Array.from(salt), pinHash: hash, deviceId: input.deviceId, pharmacyId: input.pharmacyId, pharmacyName: input.pharmacyName, tokenCipher: await encrypt(aes, input.token), lastSync: Date.now(), pinFailures: 0, pinBlockedUntil: 0, pinBlockSeconds: 30 };
  await tx(META, "readwrite", s => s.put(meta));
  activeUnlocked = { deviceId: input.deviceId, pharmacyId: input.pharmacyId, pharmacyName: input.pharmacyName, token: input.token, aes, lastSync: Date.now() };
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
  const lastSync = meta.lastSync || 0;
  if (!allowExpired && Date.now() - lastSync > 7 * 24 * 60 * 60 * 1000) throw new Error("Appareil expiré après 7 jours sans synchronisation. Reconnectez-vous en ligne.");
  const token = await decrypt(aes, meta.tokenCipher);
  meta.pinFailures = 0; meta.pinBlockedUntil = 0; meta.pinBlockSeconds = 30; if (allowExpired) meta.serverLocked = false;
  await tx(META, "readwrite", s => s.put(meta));
  activeUnlocked = { deviceId: meta.deviceId, pharmacyId: meta.pharmacyId, pharmacyName: meta.pharmacyName, token, aes, lastSync };
  return activeUnlocked;
}
export function getUnlockedDevice() { return activeUnlocked; }
export async function saveReference(data: unknown) {
  if (!activeUnlocked) return;
  const value = await encrypt(activeUnlocked.aes, JSON.stringify(data));
  await tx(REF, "readwrite", s => s.put({ id: "snapshot", value, savedAt: Date.now() }));
}
export async function readReference() {
  const row = await tx<{ id: string; value: Encrypted; savedAt: number } | undefined>(REF, "readonly", s => s.get("snapshot"));
  if (!row || !activeUnlocked) return undefined;
  try { return { id: row.id, value: JSON.parse(await decrypt(activeUnlocked.aes, row.value)), savedAt: row.savedAt }; } catch { return undefined; }
}
export async function enregistrerOperation(type: string, payload: unknown): Promise<string> {
  let safePayload = payload;
  if (type === "stock_set_quantity") {
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || !activeUnlocked) {
      throw new Error("Modification hors ligne impossible : référence de stock indisponible.");
    }
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
  const id = crypto.randomUUID(), operation: PendingOperation = { id, type, payload: safePayload, createdAt: Date.now(), attempts: 0, status: "pending" };
  await tx(QUEUE, "readwrite", s => s.add(operation)); return id;
}
export async function listPendingOperations() {
  // A transient failure must not strand an encrypted operation outside the retry queue.
  return (await tx<PendingOperation[]>(QUEUE, "readonly", s => s.getAll()))
    .filter(x => x.status === "pending" || x.status === "failed")
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}
export async function markOperationAttempt(id: string, failed: boolean) {
  const d = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = d.transaction(QUEUE, "readwrite"), s = t.objectStore(QUEUE), r = s.get(id);
    r.onsuccess = () => { if (r.result) { r.result.attempts++; r.result.status = failed ? "failed" : "pending"; s.put(r.result); } };
    t.oncomplete = () => { d.close(); resolve(); }; t.onerror = () => { d.close(); reject(t.error); };
  });
}
export async function removeOperation(id: string) { await tx(QUEUE, "readwrite", s => s.delete(id)); }
export async function markLocalSync() { const meta=await tx<Meta|undefined>(META,"readonly",s=>s.get("device"));if(!meta)return;meta.lastSync=Date.now();await tx(META,"readwrite",s=>s.put(meta));if(activeUnlocked)activeUnlocked.lastSync=meta.lastSync; }
export async function pendingCount() { return (await listPendingOperations()).length; }
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
