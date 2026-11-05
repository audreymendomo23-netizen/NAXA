#!/usr/bin/env node
"use strict";

/**
 * NAXA Supabase Storage binary E2E.
 *
 * This test creates two temporary Auth users, sends actual PDF/PNG bytes over
 * Storage HTTP, verifies owner isolation and signed downloads, then removes all
 * objects and users. It is hard-pinned to the dedicated Replay project.
 *
 * Required environment:
 *   NAXA_STORAGE_E2E_URL
 *   NAXA_STORAGE_E2E_ANON_KEY
 *   NAXA_STORAGE_E2E_ADMIN_KEY (sb_secret_* or legacy service_role JWT)
 *
 * Optional role-matrix environment:
 *   NAXA_STORAGE_E2E_ADMIN_EMAIL / NAXA_STORAGE_E2E_ADMIN_PASSWORD
 *   NAXA_STORAGE_E2E_PROMOTEUR_EMAIL / NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD
 *   NAXA_STORAGE_E2E_PROMOTEUR_PHARMACY_ID
 *   NAXA_STORAGE_E2E_OTHER_PHARMACY_ID
 * Set NAXA_STORAGE_E2E_REQUIRE_ROLE_MATRIX=1 to require both real roles.
 */

const { randomUUID } = require("node:crypto");

const PROJECT_REF = "pwfftcsjyeibxxqhwysw";
const BUCKET_CREDIT = "credit-marketplace-justificatifs";
const BUCKET_PHARMACY_DOCS = "pharmacie-documents";
const BUCKET_PROMOTER_PROOFS = "preuves-reglements-promoteurs";
const BUCKET_PHARMACY_PHOTOS = "pharmacies-photos";
const BUCKET_MEDICAMENTS = "medicaments";
const BUCKET_PRODUCTS_PHOTOS = "produits-photos";

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) throw new Error("Variable requise absente : " + name);
  return value;
}

const supabaseUrl = required("NAXA_STORAGE_E2E_URL", process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)
  .replace(/\/+$/, "");
const anonKey = required("NAXA_STORAGE_E2E_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);
const adminKey = required(
  "NAXA_STORAGE_E2E_ADMIN_KEY",
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const parsedUrl = new URL(supabaseUrl);
if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== PROJECT_REF + ".supabase.co") {
  throw new Error("Sécurité : ce harnais est limité au projet Supabase Replay " + PROJECT_REF + ".");
}

function headersFor(apiKey, accessToken, contentType) {
  const headers = new Headers();
  headers.set("apikey", apiKey);
  if (accessToken) headers.set("Authorization", "Bearer " + accessToken);
  else if (!apiKey.startsWith("sb_secret_") && !apiKey.startsWith("sb_publishable_")) headers.set("Authorization", "Bearer " + apiKey);
  if (contentType) headers.set("Content-Type", contentType);
  return headers;
}

async function http(path, options) {
  const apiKey = options.apiKey || anonKey;
  const headers = headersFor(apiKey, options.accessToken, options.contentType);
  if (options.extraHeaders) {
    for (const [key, value] of Object.entries(options.extraHeaders)) headers.set(key, value);
  }
  return fetch(supabaseUrl + path, {
    method: options.method || "GET",
    headers,
    body: options.body,
    redirect: "manual",
  });
}

async function json(response) {
  const value = await response.text();
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

function encodedPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function objectPath(bucket, path, mode) {
  return "/storage/v1/object/" + (mode ? mode + "/" : "") + bucket + "/" + encodedPath(path);
}

async function createTemporaryUser() {
  const email = "naxa-storage-e2e-" + randomUUID() + "@example.invalid";
  const password = randomUUID() + "Aa!9";
  const response = await http("/auth/v1/admin/users", {
    method: "POST",
    apiKey: adminKey,
    contentType: "application/json",
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { naxa_storage_e2e: true } }),
  });
  const payload = await json(response);
  if (!response.ok || !payload.id) {
    throw new Error("Création du compte temporaire refusée (HTTP " + response.status + ").");
  }

  const login = await http("/auth/v1/token?grant_type=password", {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({ email, password }),
  });
  const session = await json(login);
  if (!login.ok || !session.access_token || !session.user?.id) {
    await deleteUser(payload.id).catch(() => undefined);
    throw new Error("Connexion du compte temporaire impossible (HTTP " + login.status + ").");
  }
  return { id: session.user.id, token: session.access_token };
}

async function loginExisting(email, password, label) {
  const response = await http("/auth/v1/token?grant_type=password", {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({ email, password }),
  });
  const session = await json(response);
  if (!response.ok || !session.access_token || !session.user?.id) {
    throw new Error("Connexion du rôle " + label + " impossible (HTTP " + response.status + ").");
  }
  return { id: session.user.id, token: session.access_token };
}

async function deleteUser(userId) {
  const response = await http("/auth/v1/admin/users/" + encodeURIComponent(userId), {
    method: "DELETE",
    apiKey: adminKey,
  });
  if (!response.ok && response.status !== 404) {
    throw new Error("Nettoyage du compte temporaire impossible (HTTP " + response.status + ").");
  }
}

async function upload(bucket, path, bytes, mime, token, apiKey) {
  return http(objectPath(bucket, path), {
    method: "POST",
    apiKey,
    accessToken: token,
    contentType: mime,
    extraHeaders: { "x-upsert": "false", "cache-control": "60" },
    body: bytes,
  });
}

async function download(bucket, path, token) {
  return http(objectPath(bucket, path, "authenticated"), { accessToken: token });
}

async function removeWithUser(bucket, path, token) {
  return http("/storage/v1/object/" + bucket, {
    method: "DELETE",
    accessToken: token,
    contentType: "application/json",
    body: JSON.stringify({ prefixes: [path] }),
  });
}

async function removeWithAdmin(bucket, path) {
  const response = await http("/storage/v1/object/" + bucket, {
    method: "DELETE",
    apiKey: adminKey,
    contentType: "application/json",
    body: JSON.stringify({ prefixes: [path] }),
  });
  if (!response.ok) throw new Error("Nettoyage Storage impossible (HTTP " + response.status + ").");
}

function makePdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    "<< /Length 47 >>\nstream\nBT /F1 12 Tf 20 60 Td (NAXA Storage E2E) Tj ET\nendstream",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += (i + 1) + " 0 obj\n" + objects[i] + "\nendobj\n";
  }
  const xref = Buffer.byteLength(pdf, "binary");
  pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
  return Buffer.from(pdf, "binary");
}

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWQAAAABJRU5ErkJggg==",
  "base64"
);

async function expectDenied(response, label) {
  if (response.ok) throw new Error("ÉCHEC sécurité : " + label + " a été accepté (HTTP " + response.status + ").");
}

async function expectBytes(response, expected, label) {
  if (!response.ok) throw new Error(label + " refusé (HTTP " + response.status + ").");
  const received = Buffer.from(await response.arrayBuffer());
  if (!received.equals(expected)) throw new Error(label + " : contenu binaire différent.");
}

async function run() {
  const createdUsers = [];
  const cleanupObjects = [];
  const passed = [];
  const skipped = [];
  const suffix = randomUUID();
  const pdf = makePdf();
  let userA;
  let userB;

  async function check(name, callback) {
    await callback();
    passed.push(name);
    process.stdout.write("PASS — " + name + "\n");
  }

  try {
    userA = await createTemporaryUser();
    createdUsers.push(userA.id);
    userB = await createTemporaryUser();
    createdUsers.push(userB.id);

    const privatePath = userA.id + "/naxa-storage-e2e-" + suffix + ".pdf";
    cleanupObjects.push([BUCKET_CREDIT, privatePath]);

    await check("upload binaire PDF par le propriétaire", async () => {
      const response = await upload(BUCKET_CREDIT, privatePath, pdf, "application/pdf", userA.token);
      if (!response.ok) throw new Error("Upload propriétaire refusé (HTTP " + response.status + ").");
    });

    await check("téléchargement authentifié par le propriétaire", async () => {
      await expectBytes(await download(BUCKET_CREDIT, privatePath, userA.token), pdf, "Téléchargement propriétaire");
    });

    await check("téléchargement refusé à un autre utilisateur", async () => {
      await expectDenied(await download(BUCKET_CREDIT, privatePath, userB.token), "lecture inter-utilisateurs");
    });

    await check("upload refusé dans le dossier d'un autre utilisateur", async () => {
      const response = await upload(BUCKET_CREDIT, privatePath, pdf, "application/pdf", userB.token);
      await expectDenied(response, "écriture inter-utilisateurs");
    });

    await check("lecture privée refusée sans session", async () => {
      const response = await http(objectPath(BUCKET_CREDIT, privatePath, "authenticated"), {});
      await expectDenied(response, "lecture anonyme du bucket privé");
    });

    await check("URL signée consommable par le propriétaire", async () => {
      const response = await http("/storage/v1/object/sign/" + BUCKET_CREDIT + "/" + encodedPath(privatePath), {
        method: "POST",
        accessToken: userA.token,
        contentType: "application/json",
        body: JSON.stringify({ expiresIn: 60 }),
      });
      const payload = await json(response);
      const signed = payload.signedURL || payload.signedUrl;
      if (!response.ok || typeof signed !== "string") {
        throw new Error("Création du lien signé propriétaire refusée (HTTP " + response.status + ").");
      }
      let signedUrl;
      if (/^https?:\/\//i.test(signed)) signedUrl = signed;
      else if (signed.startsWith("/storage/v1/")) signedUrl = supabaseUrl + signed;
      else if (signed.startsWith("/")) signedUrl = supabaseUrl + "/storage/v1" + signed;
      else signedUrl = supabaseUrl + "/storage/v1/" + signed;
      const signedResponse = await fetch(signedUrl, { redirect: "manual" });
      await expectBytes(signedResponse, pdf, "Téléchargement par URL signée");
    });

    await check("création d'URL signée refusée à un autre utilisateur", async () => {
      const response = await http("/storage/v1/object/sign/" + BUCKET_CREDIT + "/" + encodedPath(privatePath), {
        method: "POST",
        accessToken: userB.token,
        contentType: "application/json",
        body: JSON.stringify({ expiresIn: 60 }),
      });
      await expectDenied(response, "signature inter-utilisateurs");
    });

    await check("type MIME interdit rejeté", async () => {
      const badPath = userA.id + "/naxa-storage-e2e-" + suffix + ".txt";
      const response = await upload(BUCKET_CREDIT, badPath, Buffer.from("not a document"), "text/plain", userA.token);
      if (response.ok) {
        await removeWithAdmin(BUCKET_CREDIT, badPath);
        throw new Error("Le bucket privé a accepté un type MIME non autorisé.");
      }
    });

    await check("accès direct refusé aux buckets réservés aux services et à l'administration", async () => {
      const cases = [
        [BUCKET_PHARMACY_DOCS, "storage-e2e-" + suffix + ".pdf", pdf, "application/pdf"],
        [BUCKET_PROMOTER_PROOFS, userA.id + "/storage-e2e-" + suffix + ".pdf", pdf, "application/pdf"],
        [BUCKET_MEDICAMENTS, "storage-e2e-" + suffix + ".png", PNG, "image/png"],
        [BUCKET_PRODUCTS_PHOTOS, "storage-e2e-" + suffix + ".png", PNG, "image/png"],
        [BUCKET_PHARMACY_PHOTOS, "logos/00000000-0000-4000-8000-000000000000/storage-e2e-" + suffix + ".png", PNG, "image/png"],
      ];
      for (const [bucket, path, bytes, mime] of cases) {
        const response = await upload(bucket, path, bytes, mime, userA.token);
        if (response.ok) {
          await removeWithAdmin(bucket, path);
          throw new Error("Un compte client a pu déposer un fichier dans " + bucket + ".");
        }
      }
    });

    await check("lecture HTTP publique d'un vrai objet image", async () => {
      const publicPath = "storage-e2e/" + suffix + ".png";
      cleanupObjects.push([BUCKET_PHARMACY_PHOTOS, publicPath]);
      const serviceUpload = await upload(BUCKET_PHARMACY_PHOTOS, publicPath, PNG, "image/png", null, adminKey);
      if (!serviceUpload.ok) throw new Error("Préparation de l'objet public impossible (HTTP " + serviceUpload.status + ").");
      const publicResponse = await http(objectPath(BUCKET_PHARMACY_PHOTOS, publicPath, "public"), {});
      await expectBytes(publicResponse, PNG, "Lecture publique de l'image");
    });

    const adminEmail = process.env.NAXA_STORAGE_E2E_ADMIN_EMAIL;
    const adminPassword = process.env.NAXA_STORAGE_E2E_ADMIN_PASSWORD;
    const promoterEmail = process.env.NAXA_STORAGE_E2E_PROMOTEUR_EMAIL;
    const promoterPassword = process.env.NAXA_STORAGE_E2E_PROMOTEUR_PASSWORD;
    const pharmacyId = process.env.NAXA_STORAGE_E2E_PROMOTEUR_PHARMACY_ID;
    const otherPharmacyId = process.env.NAXA_STORAGE_E2E_OTHER_PHARMACY_ID;
    const requireRoleMatrix = process.env.NAXA_STORAGE_E2E_REQUIRE_ROLE_MATRIX === "1";

    if (adminEmail && adminPassword) {
      const admin = await loginExisting(adminEmail, adminPassword, "Admin actif");
      const docPath = "storage-e2e/" + suffix + ".pdf";
      const medicinePath = "storage-e2e/" + suffix + ".png";
      cleanupObjects.push([BUCKET_PHARMACY_DOCS, docPath], [BUCKET_MEDICAMENTS, medicinePath]);

      await check("Admin actif : dépôt et lecture d'un document privé", async () => {
        const response = await upload(BUCKET_PHARMACY_DOCS, docPath, pdf, "application/pdf", admin.token);
        if (!response.ok) throw new Error("Le dépôt Admin dans pharmacie-documents a échoué (HTTP " + response.status + ").");
        await expectBytes(await download(BUCKET_PHARMACY_DOCS, docPath, admin.token), pdf, "Lecture Admin du document");
      });

      await check("Admin actif : remplacement et lecture publique d'une photo médicament", async () => {
        const first = await upload(BUCKET_MEDICAMENTS, medicinePath, PNG, "image/png", admin.token);
        if (!first.ok) throw new Error("Le premier dépôt Admin médicament a échoué (HTTP " + first.status + ").");
        const replacement = Buffer.concat([PNG, Buffer.from([0])]);
        const replaced = await http(objectPath(BUCKET_MEDICAMENTS, medicinePath), {
          method: "POST", accessToken: admin.token, contentType: "image/png",
          extraHeaders: { "x-upsert": "true" }, body: replacement,
        });
        if (!replaced.ok) throw new Error("Le remplacement Admin médicament a échoué (HTTP " + replaced.status + ").");
        const publicRead = await http(objectPath(BUCKET_MEDICAMENTS, medicinePath, "public"), {});
        await expectBytes(publicRead, replacement, "Lecture publique après remplacement");
      });

      await check("non-Admin : lecture des documents de pharmacie refusée", async () => {
        await expectDenied(await download(BUCKET_PHARMACY_DOCS, docPath, userA.token), "lecture document Admin");
      });
    } else {
      skipped.push("matrice Admin active (identifiants Admin non configurés)");
    }

    if (promoterEmail && promoterPassword && pharmacyId && otherPharmacyId) {
      const promoter = await loginExisting(promoterEmail, promoterPassword, "Promoteur actif");
      const ownPath = "logos/" + pharmacyId + "/storage-e2e-" + suffix + ".png";
      const otherPath = "logos/" + otherPharmacyId + "/storage-e2e-" + suffix + ".png";
      cleanupObjects.push([BUCKET_PHARMACY_PHOTOS, ownPath]);

      await check("Promoteur actif : dépôt dans sa pharmacie liée", async () => {
        const response = await upload(BUCKET_PHARMACY_PHOTOS, ownPath, PNG, "image/png", promoter.token);
        if (!response.ok) throw new Error("Le dépôt Promoteur dans sa pharmacie a échoué (HTTP " + response.status + ").");
      });

      await check("Promoteur actif : remplacement dans sa pharmacie liée", async () => {
        const replacement = Buffer.concat([PNG, Buffer.from([0])]);
        const response = await http(objectPath(BUCKET_PHARMACY_PHOTOS, ownPath), {
          method: "POST", accessToken: promoter.token, contentType: "image/png",
          extraHeaders: { "x-upsert": "true" }, body: replacement,
        });
        if (!response.ok) throw new Error("Le remplacement du logo a échoué (HTTP " + response.status + ").");
        await expectBytes(
          await http(objectPath(BUCKET_PHARMACY_PHOTOS, ownPath, "public"), {}),
          replacement,
          "Lecture publique du logo remplacé"
        );
      });

      await check("Promoteur actif : refus d'écriture dans une autre pharmacie", async () => {
        await expectDenied(
          await upload(BUCKET_PHARMACY_PHOTOS, otherPath, PNG, "image/png", promoter.token),
          "écriture Promoteur inter-pharmacies"
        );
      });
    } else if (requireRoleMatrix) {
      throw new Error("Matrice de rôles obligatoire : renseignez les identifiants Admin, Promoteur et les deux UUID de pharmacie.");
    } else {
      skipped.push("matrice Promoteur multi-pharmacies (compte et UUID de recette non configurés)");
    }

    const deleted = await removeWithUser(BUCKET_CREDIT, privatePath, userA.token);
    if (!deleted.ok) throw new Error("Le propriétaire n'a pas pu supprimer son fichier de recette (HTTP " + deleted.status + ").");
    process.stdout.write("PASS — suppression du fichier privé par son propriétaire\n");
    passed.push("suppression du fichier privé par son propriétaire");
  } finally {
    for (const [bucket, path] of cleanupObjects.reverse()) {
      await removeWithAdmin(bucket, path).catch(() => undefined);
    }
    for (const id of createdUsers.reverse()) {
      await deleteUser(id).catch(() => undefined);
    }
  }

  process.stdout.write("\nStorage E2E Replay : " + passed.length + " PASS, " + skipped.length + " SKIP.\n");
  for (const item of skipped) process.stdout.write("SKIP — " + item + "\n");
  if (process.env.NAXA_STORAGE_E2E_REQUIRE_ROLE_MATRIX === "1" && skipped.length) {
    throw new Error("La matrice complète de rôles était obligatoire.");
  }
}

run().catch((error) => {
  process.stderr.write("Storage E2E FAILED — " + (error?.message || "erreur inconnue") + "\n");
  process.exitCode = 1;
});
