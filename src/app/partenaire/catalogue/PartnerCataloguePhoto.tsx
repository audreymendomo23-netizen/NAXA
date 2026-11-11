"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  enregistrerPhotoProduitCatalogue,
  retirerPhotoProduitCatalogue,
} from "@/app/partenaire/catalogue/actions";

const BUCKET = "partner-catalogue-photos";
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_STORED_BYTES = 2 * 1024 * 1024;

async function convertirWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Conversion d’image indisponible.");

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.84, 0.72]) {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => value ? resolve(value) : reject(new Error("Compression WebP impossible.")),
          "image/webp",
          quality,
        );
      });
      if (blob.size <= MAX_STORED_BYTES) return blob;
    }
    throw new Error("Image trop lourde après compression. Choisissez une photo plus légère.");
  } finally {
    bitmap.close();
  }
}

function sourceHttps(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function PartnerCataloguePhoto({
  productId,
  partnerId,
  productName,
  photoUrl,
  photoPath,
  photoSourceUrl,
  photoLicence,
}: {
  productId: string;
  partnerId: string;
  productName: string;
  photoUrl: string | null;
  photoPath: string | null;
  photoSourceUrl: string | null;
  photoLicence: string | null;
}) {
  const router = useRouter();
  const [sourceUrl, setSourceUrl] = useState(photoSourceUrl ?? "");
  const [licence, setLicence] = useState(photoLicence ?? "");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "saving" | "removing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function upload(file: File) {
    setMessage("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 1 || file.size > MAX_SOURCE_BYTES) {
      setStatus("error");
      setMessage("Formats acceptés : JPEG, PNG ou WebP, jusqu’à 12 Mo avant compression.");
      return;
    }
    if (!sourceHttps(sourceUrl.trim()) || licence.trim().length < 5 || !rightsConfirmed) {
      setStatus("error");
      setMessage("Indiquez la source HTTPS, la licence ou autorisation et confirmez vos droits d’utilisation.");
      return;
    }

    let uploadedPath: string | null = null;
    const sb = supabaseBrowser();
    try {
      setStatus("uploading");
      const blob = await convertirWebp(file);
      uploadedPath = partnerId + "/" + productId + "/" + crypto.randomUUID() + ".webp";
      const { error: uploadError } = await sb.storage.from(BUCKET).upload(uploadedPath, blob, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      setStatus("saving");
      const form = new FormData();
      form.set("partner_id", partnerId);
      form.set("product_id", productId);
      form.set("photo_path", uploadedPath);
      form.set("photo_source_url", sourceUrl.trim());
      form.set("photo_licence", licence.trim());
      form.set("rights_confirmed", rightsConfirmed ? "on" : "");

      const saved = await enregistrerPhotoProduitCatalogue(form);
      if (!saved.ok) throw new Error(saved.message);

      setStatus("success");
      setMessage("Photo enregistrée dans la bibliothèque NAXA, avec sa source et la déclaration de droits.");
      router.refresh();
    } catch (error) {
      if (uploadedPath) {
        await sb.storage.from(BUCKET).remove([uploadedPath]).catch(() => undefined);
      }
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Téléversement impossible. Vérifiez l’accès au partenaire.");
    }
  }

  async function removePhoto() {
    setStatus("removing");
    setMessage("");
    try {
      const form = new FormData();
      form.set("partner_id", partnerId);
      form.set("product_id", productId);
      const result = await retirerPhotoProduitCatalogue(form);
      if (!result.ok) throw new Error(result.message);
      setStatus("success");
      setMessage("Photo retirée du catalogue. Le fichier n’est plus associé au produit.");
      setSourceUrl("");
      setLicence("");
      setRightsConfirmed(false);
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Retrait de la photo impossible.");
    }
  }

  const busy = status === "uploading" || status === "saving" || status === "removing";

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3" aria-label={"Photo du produit " + productName}>
      <div className="flex items-start gap-3">
        {photoUrl ? (
          <img src={photoUrl} alt={"Photo de " + productName} loading="lazy" className="h-20 w-20 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1" />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-3xl text-slate-400" aria-hidden="true">◇</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900">Bibliothèque photo du produit</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Photo convertie en WebP et stockée dans NAXA. Elle sera visible dans la boutique quand le produit sera publié.
          </p>
          {photoPath && <p className="mt-1 break-all text-[11px] text-emerald-800">Fichier NAXA : {photoPath.split("/").pop()}</p>}
          {!photoPath && photoUrl && <p className="mt-1 text-[11px] text-amber-800">Photo actuelle externe ou ancienne : ajoutez une copie avec provenance pour l’intégrer à la bibliothèque NAXA.</p>}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
          Source originale (URL HTTPS)
          <input value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} maxLength={1000} type="url" placeholder="https://fabricant.example/produit" className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" disabled={busy} />
        </label>
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
          Licence ou autorisation de réutilisation
          <input value={licence} onChange={event => setLicence(event.target.value)} maxLength={500} placeholder="Ex. autorisation du fabricant, référence…" className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" disabled={busy} />
        </label>
        <label className="flex items-start gap-2 text-xs leading-5 text-slate-700 sm:col-span-2">
          <input type="checkbox" checked={rightsConfirmed} onChange={event => setRightsConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" disabled={busy} />
          Je confirme que cette photo représente le produit et que je dispose des droits ou de l’autorisation permettant son utilisation commerciale.
        </label>
        <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg bg-teal-800 px-3 py-2 text-center text-xs font-bold text-white hover:bg-teal-900">
          {status === "uploading" ? "Compression / envoi…" : status === "saving" ? "Enregistrement…" : photoUrl ? "Remplacer la photo" : "Ajouter à la bibliothèque"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
        {photoUrl && (
          <button type="button" onClick={() => void removePhoto()} disabled={busy} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
            {status === "removing" ? "Retrait…" : "Retirer la photo"}
          </button>
        )}
      </div>
      {message && <p role={status === "error" ? "alert" : "status"} className={status === "error" ? "mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-800" : "mt-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800"}>{message}</p>}
      {photoPath && <p className="mt-2 text-[10px] leading-4 text-slate-500">Chemin lié : {photoPath}</p>}
    </section>
  );
}
