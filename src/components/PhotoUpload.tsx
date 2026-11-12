"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

async function reduire(f: File): Promise<Blob> {
  const bmp = await createImageBitmap(f);
  const ratio = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * ratio));
  c.height = Math.max(1, Math.round(bmp.height * ratio));
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, ko) => c.toBlob((b) => b ? ok(b) : ko(new Error("compression")), "image/webp", 0.86));
}

export function PhotoUpload({ produitId, photoUrl }: { produitId: string; photoUrl: string | null }) {
  const router = useRouter();
  const [etat, setEtat] = useState<"repos" | "envoi" | "ok" | "erreur">("repos");
  const [sourceUrl, setSourceUrl] = useState("");
  const [licence, setLicence] = useState("");
  const [droitsConfirmes, setDroitsConfirmes] = useState(false);

  async function envoyer(f: File) {
    if (!sourceUrl.trim().startsWith("https://") || licence.trim().length < 5 || !droitsConfirmes) {
      setEtat("erreur");
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      setEtat("erreur");
      return;
    }
    setEtat("envoi");
    let chemin: string | null = null;
    const sb = supabaseBrowser();
    try {
      const blob = await reduire(f);
      if (blob.size > 5 * 1024 * 1024) throw new Error("image trop lourde");
      chemin = `${produitId}-${Date.now()}.webp`;
      const { error } = await sb.storage.from("medicaments").upload(chemin, blob, {
        contentType: "image/webp",
        cacheControl: "86400",
        upsert: false
      });
      if (error) throw error;
      const { data } = sb.storage.from("medicaments").getPublicUrl(chemin);
      const { data: updated, error: updateError } = await sb.from("produits").update({
        photo_path: chemin,
        photo_source_url: sourceUrl.trim().slice(0, 1000),
        photo_licence: licence.trim().slice(0, 500),
        photo_verifiee_le: new Date().toISOString(),
        photo_url: data.publicUrl
      }).eq("id", produitId).select("id").maybeSingle();
      if (updateError || updated?.id !== produitId) throw updateError ?? new Error("Produit introuvable ou modification refusée.");
      setEtat("ok");
      router.refresh();
    } catch {
      if (chemin) await sb.storage.from("medicaments").remove([chemin]).catch(() => undefined);
      setEtat("erreur");
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <div className="flex items-center gap-3">
        {photoUrl
          ? <Image unoptimized src={photoUrl} alt="" width={64} height={64} className="h-16 w-16 rounded-lg bg-white object-contain" />
          : <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-naxa-green-100 text-xs">Aucune</span>}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Photo du médicament</p>
          <p className="text-xs text-slate-600">Stockée dans Supabase Storage après déclaration des droits.</p>
        </div>
      </div>
      <label className="block text-sm font-semibold">
        URL de la source originale (HTTPS)
        <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://fabricant.example/produit" className="champ mt-1 !rounded-xl !py-2" maxLength={1000} required />
      </label>
      <label className="block text-sm font-semibold">
        Licence ou autorisation de réutilisation commerciale
        <input value={licence} onChange={(e) => setLicence(e.target.value)} placeholder="Ex. CC0, autorisation fabricant réf. …" className="champ mt-1 !rounded-xl !py-2" maxLength={500} required />
      </label>
      <label className="flex items-start gap-2 text-xs text-slate-700">
        <input type="checkbox" checked={droitsConfirmes} onChange={(e) => setDroitsConfirmes(e.target.checked)} className="mt-0.5 h-4 w-4" />
        Je confirme avoir vérifié les droits d'utilisation commerciale de cette image et sa correspondance avec le médicament.
      </label>
      <label className="btn btn-clair inline-flex cursor-pointer text-sm">
        {etat === "envoi" ? "Envoi…" : photoUrl ? "Remplacer la photo" : "Ajouter une photo"}
        <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={etat === "envoi"} onChange={(e) => e.target.files?.[0] && envoyer(e.target.files[0])} />
      </label>
      {etat === "ok" && <p role="status" className="text-sm font-semibold text-emerald-700">Photo enregistrée avec sa provenance et sa licence.</p>}
      {etat === "erreur" && <p role="alert" className="text-sm text-red-700">Échec : vérifiez l'URL HTTPS, la licence, la confirmation des droits et la taille de l'image.</p>}
    </div>
  );
}
