export type QueuedSuiviMeasurement = {
  user_id: string;
  device_id: string;
  measurement_type: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  measured_at: string;
  received_at: string;
  device_event_id: string;
  sync_origin: string;
  source: string;
  device_model_snapshot: string | null;
  device_brand_snapshot?: string | null;
  note: string | null;
};

type OutboxEntry = { eventId: string; userId: string; queuedAt: number; row: QueuedSuiviMeasurement };

const DB_NAME = "naxa-suivi-offline";
const STORE_NAME = "measurement-outbox";
const MAX_PENDING = 500;

function openOutbox(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Stockage local indisponible."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "eventId" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("queuedAt", "queuedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Ouverture de la file locale impossible."));
  });
}

export async function enqueueSuiviMeasurements(rows: QueuedSuiviMeasurement[]): Promise<number> {
  if (!rows.length) return 0;
  const db = await openOutbox();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const now = Date.now();
    for (const row of rows) {
      if (!row.user_id || !row.device_id || !row.device_event_id) continue;
      const entry: OutboxEntry = {
        eventId: row.device_event_id,
        userId: row.user_id,
        queuedAt: now,
        row
      };
      store.put(entry);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Écriture locale impossible."));
      tx.onabort = () => reject(tx.error ?? new Error("Écriture locale interrompue."));
    });
    const count = await countQueuedSuiviMeasurements();
    if (count > MAX_PENDING) {
      const entries = await listQueuedSuiviMeasurements();
      const overflow = entries.slice(0, count - MAX_PENDING);
      if (overflow.length) await removeQueuedSuiviMeasurements(overflow.map(entry => entry.eventId));
    }
    return Math.min(rows.length, MAX_PENDING);
  } finally {
    db.close();
  }
}

export async function listQueuedSuiviMeasurements(userId?: string): Promise<OutboxEntry[]> {
  const db = await openOutbox();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = userId
        ? tx.objectStore(STORE_NAME).index("userId").getAll(userId)
        : tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as OutboxEntry[]).sort((a, b) => a.queuedAt - b.queuedAt));
      request.onerror = () => reject(request.error ?? new Error("Lecture de la file locale impossible."));
    });
  } finally {
    db.close();
  }
}

export async function removeQueuedSuiviMeasurements(eventIds: string[]): Promise<void> {
  if (!eventIds.length) return;
  const db = await openOutbox();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      eventIds.forEach(id => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Suppression de la file locale impossible."));
      tx.onabort = () => reject(tx.error ?? new Error("Suppression locale interrompue."));
    });
  } finally {
    db.close();
  }
}

export async function countQueuedSuiviMeasurements(userId?: string): Promise<number> {
  const db = await openOutbox();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = userId
        ? tx.objectStore(STORE_NAME).index("userId").count(userId)
        : tx.objectStore(STORE_NAME).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Comptage local impossible."));
    });
  } finally {
    db.close();
  }
}

export async function clearQueuedSuiviMeasurements(userId: string): Promise<void> {
  const entries = await listQueuedSuiviMeasurements(userId);
  await removeQueuedSuiviMeasurements(entries.map(entry => entry.eventId));
}
