"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MAX_QTE, usePanier } from "@/lib/panier";

type Pharmacy = { id: string; nom: string };
const localDate = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

export function DemandeCreditMarketplaceForm({ pharmacies }: { pharmacies: Pharmacy[] }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { lignes, pret, vider } = usePanier();
  const [pharmacie, setPharmacie] = useState("");
  const [telephone, setTelephone] = useState("");
  const [dateRemboursement, setDateRemboursement] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const [demandeId, setDemandeId] = useState("");
  const quantitesValides = lignes.length > 0 && lignes.length <= 10 && lignes.every(l => Number.isSafeInteger(l.quantite) && l.quantite >= 1 && l.quantite <= MAX_QTE);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setErreur("");
    if (!quantitesValides) return setErreur("Le panier doit contenir de 1 à 10 produits avec des quantités valides.");
    if (!pharmacie) return setErreur("Choisissez la pharmacie de retrait.");
    if (!/^\+?[0-9 ()-]{8,24}$/.test(telephone.trim())) return setErreur("Renseignez un numéro de téléphone valide.");
    if (!dateRemboursement || dateRemboursement <= localDate()) return setErreur("Choisissez une date future de remboursement.");
    if (!fichier) return setErreur("Ajoutez un justificatif photo ou PDF.");
    if (!["application/pdf","image/jpeg","image/png","image/webp"].includes(fichier.type) || fichier.size <= 0 || fichier.size > 10*1024*1024) return setErreur("Le justificatif doit être une photo JPG, PNG, WebP ou un PDF de 10 Mo maximum.");

    setBusy(true);
    let uploadedPath = "";
    try {
      const { data: authData, error: authError } = await sb.auth.getUser();
      if (authError || !authData.user) throw new Error("Connectez-vous pour demander un crédit.");
      const ext = fichier.type === "application/pdf" ? "pdf" : fichier.type === "image/jpeg" ? "jpg" : fichier.type === "image/png" ? "png" : "webp";
      uploadedPath = authData.user.id + "/" + crypto.randomUUID() + "." + ext;
      const { error: uploadError } = await sb.storage.from("credit-marketplace-justificatifs").upload(uploadedPath, fichier, { contentType: fichier.type, upsert: false });
      if (uploadError) throw new Error("Le justificatif n’a pas pu être envoyé. Vérifiez le fichier et réessayez.");
      const { data, error } = await sb.rpc("client_credit_marketplace_soumettre", {
        p_pharmacie: pharmacie,
        p_items: lignes.map(l => ({ produit_id: l.produit_id, quantite: l.quantite })),
        p_telephone: telephone.trim(),
        p_date_remboursement: dateRemboursement,
        p_justificatif_path: uploadedPath,
      });
      if (error || !data) {
        await sb.storage.from("credit-marketplace-justificatifs").remove([uploadedPath]);
        uploadedPath = "";
        throw new Error(error?.message || "La demande n’a pas été enregistrée.");
      }
      setDemandeId(String(data)); vider();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de soumettre la demande.");
    } finally { setBusy(false); }
  };

  if (demandeId) return <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="status">
    <h2 className="text-xl font-extrabold text-emerald-950">Demande transmise</h2>
    <p className="mt-2 text-sm text-emerald-900">Votre demande est en attente de décision. Aucun crédit n’est activé et aucun retrait n’est encore autorisé.</p>
    <p className="mt-3 break-all text-xs text-emerald-900">Référence : {demandeId}</p><a href="/achats/credit/suivi" className="mt-4 inline-block font-bold text-emerald-950 underline">Suivre mes demandes de crédit</a>
  </section>;

  return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" noValidate>
    <label className="block text-sm font-bold">Pharmacie de retrait
      <select className="champ mt-1 w-full" value={pharmacie} onChange={e=>setPharmacie(e.target.value)} required disabled={busy}>
        <option value="">Choisir une pharmacie</option>{pharmacies.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
      </select>
    </label>
    <label className="block text-sm font-bold">Téléphone à renseigner
      <input className="champ mt-1 w-full" type="tel" autoComplete="tel" inputMode="tel" value={telephone} onChange={e=>setTelephone(e.target.value)} required maxLength={24} placeholder="Ex. +237 6…" disabled={busy}/>
    </label>
    <label className="block text-sm font-bold">Date prévue de remboursement
      <input className="champ mt-1 w-full" type="date" min={localDate()} value={dateRemboursement} onChange={e=>setDateRemboursement(e.target.value)} required disabled={busy}/>
    </label>
    <label className="block text-sm font-bold">Justificatif obligatoire
      <input className="champ mt-1 w-full" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setFichier(e.target.files?.[0]??null)} required disabled={busy}/>
      <span className="mt-1 block text-xs font-normal text-slate-600">Photo JPG, PNG, WebP ou PDF · 10 Mo maximum.</span>
      {fichier && <span className="mt-1 block break-all text-xs text-slate-700">{fichier.name}</span>}
    </label>
    {erreur && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{erreur}</p>}
    {!pret && <p className="text-sm text-slate-600">Chargement du panier…</p>}
    {pret && !lignes.length && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Le panier est vide. Revenez aux achats et ajoutez les médicaments demandés.</p>}
    {pret && lignes.length>0 && <div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-extrabold">Médicaments demandés</p><ul className="mt-2 space-y-1">{lignes.map(l=><li key={l.produit_id}>{l.quantite} × {l.nom}</li>)}</ul><p className="mt-2 text-xs text-slate-600">Le montant et la disponibilité sont recalculés par le serveur.</p></div>}
    <button type="submit" className="btn btn-vert w-full" disabled={busy || !pret || !quantitesValides || !pharmacies.length}>{busy?"Transmission en cours…":"Soumettre la demande de crédit"}</button>
    <p className="text-xs leading-relaxed text-slate-500">La géolocalisation n’est pas demandée. Aucun commentaire complémentaire n’est collecté. La soumission ne réserve pas le stock et n’active pas le crédit.</p>
  </form>;
}
