"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Notice = { id: string; produit_nom: string; numero_lot: string; reference_avis: string | null; motif: string; consigne: string; statut: string; created_at: string };
type Recipient = { avis_id: string; pharmacie_id: string; accuse_at: string | null; pharmacies: { nom: string } | null };

export function AdminRappelLotNotice() {
  const sb=useMemo(()=>supabaseBrowser(),[]),router=useRouter();
  const [ready,setReady]=useState(false),[notices,setNotices]=useState<Notice[]>([]),[recipients,setRecipients]=useState<Recipient[]>([]);
  const [product,setProduct]=useState(""),[lot,setLot]=useState(""),[reference,setReference]=useState(""),[motif,setMotif]=useState(""),[consigne,setConsigne]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const load=useCallback(async()=>{
    const {data:auth}=await sb.auth.getUser();
    if(!auth.user){router.replace("/connexion?retour=/admin/rappels-lots");return;}
    const {data:p}=await sb.from("profiles").select("role,actif").eq("id",auth.user.id).maybeSingle();
    if(p?.role!=="admin"||p.actif!==true){router.replace("/");return;}
    const {data:n,error:ne}=await sb.from("avis_rappels_lots_reseau")
      .select("id,produit_nom,numero_lot,reference_avis,motif,consigne,statut,created_at")
      .order("created_at",{ascending:false}).limit(100);
    if(ne){setError("Impossible de charger les avis réseau.");return;}

    const noticeRows=(n??[]) as Notice[];
    const noticeIds=noticeRows.map(item=>item.id);
    const recipientRows:Recipient[]=[];
    const pageSize=500;
    if(noticeIds.length){
      for(let offset=0;;offset+=pageSize){
        const {data:r,error:re}=await sb.from("avis_rappels_lots_destinataires")
          .select("avis_id,pharmacie_id,accuse_at,pharmacies(nom)")
          .in("avis_id",noticeIds).order("avis_id",{ascending:true})
          .range(offset,offset+pageSize-1);
        if(re){setError("Impossible de charger les accusés de réception.");return;}
        const page=(r??[]) as unknown as Recipient[];
        recipientRows.push(...page);
        if(page.length<pageSize)break;
      }
    }
    setNotices(noticeRows);setRecipients(recipientRows);setReady(true);
  },[router,sb]);
  useEffect(()=>{void load();},[load]);
  async function diffuse(){
    if(busy)return;
    setBusy(true);setError("");setMessage("");
    try {
      const {data,error:e}=await sb.rpc("admin_avis_rappel_lot_diffuser",{p_produit_nom:product.trim(),p_numero_lot:lot.trim(),p_reference_avis:reference.trim()||null,p_motif:motif.trim(),p_consigne:consigne.trim()});
      if(e || typeof data !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data)) {
        setError(e?.message || "La diffusion n’a pas été confirmée par Supabase.");
        return;
      }
      setMessage("Avis diffusé aux pharmacies actives. Aucun stock ni aucune vente n’a été consulté.");
      setProduct("");setLot("");setReference("");setMotif("");setConsigne("");
      await load();
    } catch {
      setError("La diffusion a échoué. Vérifiez la connexion puis réessayez.");
    } finally {
      setBusy(false);
    }
  }
  return <main className="mx-auto min-h-dvh max-w-5xl space-y-5 px-4 py-6 text-slate-900">
    <header className="rounded-3xl bg-[#0B3D26] p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-white/70">NAXA · Administration · F64-ADM</p><h1 className="mt-2 text-2xl font-extrabold">Avis réseau de rappel de lot</h1><p className="mt-2 text-sm text-white/80">Diffusez une consigne officielle. L’administration ne voit ni les stocks, ni les ventes, ni les clients des pharmacies.</p></header>
    {message&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    <section className="rounded-2xl border bg-white p-4 sm:p-5"><h2 className="text-lg font-extrabold">Nouvel avis</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">Produit<input className="champ mt-1 w-full" value={product} maxLength={180} onChange={e=>setProduct(e.target.value)}/></label>
      <label className="text-sm font-semibold">Numéro de lot<input className="champ mt-1 w-full" value={lot} maxLength={120} onChange={e=>setLot(e.target.value)}/></label>
      <label className="text-sm font-semibold sm:col-span-2">Référence officielle (facultative)<input className="champ mt-1 w-full" value={reference} maxLength={120} onChange={e=>setReference(e.target.value)}/></label>
      <label className="text-sm font-semibold sm:col-span-2">Motif<textarea className="champ mt-1 w-full" rows={2} value={motif} maxLength={500} onChange={e=>setMotif(e.target.value)}/></label>
      <label className="text-sm font-semibold sm:col-span-2">Consigne<textarea className="champ mt-1 w-full" rows={2} value={consigne} maxLength={500} onChange={e=>setConsigne(e.target.value)}/></label>
    </div><button type="button" className="btn btn-vert mt-4" disabled={busy||product.trim().length<2||!lot.trim()||motif.trim().length<5||consigne.trim().length<5} onClick={()=>void diffuse()}>{busy?"Diffusion…":"Diffuser aux pharmacies actives"}</button></section>
    <section className="rounded-2xl border bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold">Historique et accusés de réception</h2><button className="btn btn-clair" type="button" disabled={!ready||busy} onClick={()=>void load()}>Actualiser</button></div>
      {notices.length===0?<p className="mt-3 text-sm text-slate-500">Aucun avis diffusé.</p>:<div className="mt-3 space-y-3">{notices.map(n=>{const targets=recipients.filter(r=>r.avis_id===n.id);return <article key={n.id} className="rounded-xl border p-3"><p className="font-extrabold">{n.produit_nom} · lot {n.numero_lot}</p><p className="text-sm">{n.motif}</p><p className="text-sm text-slate-600">Consigne : {n.consigne}</p><p className="mt-1 text-xs text-slate-500">Réf. {n.reference_avis??"—"} · {new Date(n.created_at).toLocaleString("fr-FR")}</p><p className="mt-2 text-sm font-bold">{targets.filter(t=>t.accuse_at).length}/{targets.length} pharmacie(s) ont accusé réception</p><div className="mt-2 space-y-1">{targets.map(t=><p key={t.pharmacie_id} className="text-xs text-slate-600">{t.pharmacies?.nom??"Pharmacie"} — {t.accuse_at?("reçu le "+new Date(t.accuse_at).toLocaleString("fr-FR")):"en attente"}</p>)}</div></article>})}</div>}
    </section>
  </main>;
}
