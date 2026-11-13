#!/usr/bin/env node
"use strict";

/**
 * NAXA Storage backup export (read-only).
 *
 * Enumerates every bucket and recursively downloads every object to a local
 * directory. The output includes bucket settings, object metadata, byte sizes
 * and SHA-256 checksums. This script never creates, updates or deletes Storage
 * objects.
 *
 * Required environment:
 *   NAXA_BACKUP_STORAGE_URL
 *   NAXA_BACKUP_STORAGE_SERVICE_ROLE_KEY
 *   NAXA_BACKUP_STORAGE_PROJECT_REF
 *
 * Current safety gate: only the dedicated NAXA Replay project is allowed.
 * Production must not be enabled until the Replay rehearsal and restore drill
 * have passed and Production credentials have been deliberately configured.
 */

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

const REPLAY_PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const PAGE_SIZE = 100;
const OUTPUT_ROOT = path.resolve("backup/storage");

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error("Variable requise absente : " + name);
  }
  return value.trim();
}

function safeSegment(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    value.includes("\0") ||
    value.includes("\\") ||
    value.startsWith("/")
  ) {
    throw new Error("Segment de chemin Storage invalide (" + label + ").");
  }
  return value;
}

function destinationFor(bucketId, objectName) {
  const bucket = safeSegment(bucketId, "bucket");
  const segments = objectName.split("/").map((part) => safeSegment(part, "objet"));
  const destination = path.resolve(OUTPUT_ROOT, bucket, ...segments);
  if (!destination.startsWith(OUTPUT_ROOT + path.sep)) {
    throw new Error("Chemin de sauvegarde hors du répertoire autorisé.");
  }
  return destination;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function listAllBuckets(client) {
  const { data, error } = await client.storage.listBuckets({ limit: 1000, offset: 0 });
  if (error) throw new Error("Inventaire des buckets impossible (API Storage).");
  if (!Array.isArray(data)) throw new Error("Réponse d'inventaire des buckets invalide.");
  return data;
}

async function walkBucket(client, bucket, prefix, inventory, counts) {
  let offset = 0;

  for (;;) {
    const { data, error } = await client.storage.from(bucket.id).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error("Inventaire d'un préfixe Storage impossible (bucket " + bucket.id + ").");
    }
    if (!Array.isArray(data)) {
      throw new Error("Réponse d'inventaire Storage invalide (bucket " + bucket.id + ").");
    }

    for (const item of data) {
      if (!item || typeof item.name !== "string" || item.name.length === 0) {
        throw new Error("Entrée Storage invalide (bucket " + bucket.id + ").");
      }

      const objectName = prefix ? prefix + "/" + item.name : item.name;

      // In the Storage list API, folders have a null id; files have an id.
      if (item.id === null) {
        await walkBucket(client, bucket, objectName, inventory, counts);
        continue;
      }

      const destination = destinationFor(bucket.id, objectName);
      const { data: blob, error: downloadError } = await client.storage
        .from(bucket.id)
        .download(objectName);

      if (downloadError || !blob) {
        throw new Error("Téléchargement d'un objet Storage impossible (bucket " + bucket.id + ").");
      }

      const bytes = Buffer.from(await blob.arrayBuffer());
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, bytes, { flag: "wx" });

      inventory.push({
        bucket_id: bucket.id,
        name: objectName,
        size_bytes: bytes.length,
        sha256: sha256(bytes),
        created_at: item.created_at || null,
        updated_at: item.updated_at || null,
        last_accessed_at: item.last_accessed_at || null,
        metadata: item.metadata || null,
      });
      counts.objects += 1;
      counts.bytes += bytes.length;
    }

    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }
}

async function main() {
  const url = required("NAXA_BACKUP_STORAGE_URL").replace(/\/+$/, "");
  const key = required("NAXA_BACKUP_STORAGE_SERVICE_ROLE_KEY");
  const projectRef = required("NAXA_BACKUP_STORAGE_PROJECT_REF");

  if (projectRef !== REPLAY_PROJECT_REF) {
    throw new Error("Sécurité : cette première version est strictement limitée au projet Replay.");
  }

  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== projectRef + ".supabase.co" ||
    (parsed.pathname !== "" && parsed.pathname !== "/") ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Sécurité : URL Supabase Replay inattendue.");
  }

  if (key.startsWith("sb_publishable_")) {
    throw new Error("La clé Storage fournie n'a pas les privilèges serveur requis.");
  }

  await fs.rm(OUTPUT_ROOT, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const buckets = await listAllBuckets(client);
  if (buckets.length === 0) {
    throw new Error("Aucun bucket retourné : export refusé pour éviter une sauvegarde vide trompeuse.");
  }

  const inventory = [];
  const counts = { buckets: buckets.length, objects: 0, bytes: 0 };

  for (const bucket of buckets) {
    safeSegment(bucket.id, "bucket");
    await walkBucket(client, bucket, "", inventory, counts);
    process.stdout.write("Bucket exporté : " + bucket.id + "\n");
  }

  const manifest = {
    format: "naxa-storage-backup-v1",
    project_ref: projectRef,
    created_at_utc: new Date().toISOString(),
    read_only: true,
    restore_tested: false,
    bucket_count: buckets.length,
    object_count: counts.objects,
    total_bytes: counts.bytes,
    buckets: buckets.map((bucket) => ({
      id: bucket.id,
      name: bucket.name,
      public: bucket.public,
      file_size_limit: bucket.file_size_limit,
      allowed_mime_types: bucket.allowed_mime_types || null,
      created_at: bucket.created_at || null,
      updated_at: bucket.updated_at || null,
    })),
    objects: inventory,
  };

  await fs.writeFile(
    path.join(OUTPUT_ROOT, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    { encoding: "utf8", flag: "wx" }
  );

  process.stdout.write(
    "Storage export terminé : " +
    counts.buckets + " buckets, " +
    counts.objects + " objets, " +
    counts.bytes + " octets. Aucun objet distant modifié.\n"
  );
}

main().catch((error) => {
  process.stderr.write("NAXA Storage backup FAILED — " + (error?.message || "erreur inconnue") + "\n");
  process.exitCode = 1;
});
