"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Pharmacy={id:string;nom:string;ville:string|null;quartier:string|null};
type Ordonnance={
  id:string;
  pharmacie_id:string;
  pharmacie_nom:string;
  document_ref:string;
  statut:string;
  motif_rejet:string|null;
  created_at:string;
  preparation_statut:string|null;
  motif_complement:string|null;
};

const BUCKET="naxa-client-prescriptions";
const dateLabel=(value:string)=>new Date(value).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});
const statusLabel=(row:Ordonnance)=>{
  if(row.preparation_statut==="complement_requis")return "Complément demandé";
  if(row.statut==="en_attente")return "En attente du Pharmacien";
  if(row.statut==="validee")return "Validée par le Pharmacien";
  if(row.statut==="rejetee")return "Refusée";
  if(row.statut==="expiree")return "Expirée";
  return row.statut;
};

export default function ClientOrdonnances(){
  const router=useRouter();
  const sb=useMemo(()=>supabaseBrowser(),[]);
  const [userId,setUserId]=useState("");
  const [pharmacies,setPharmacies]=useState<Pharmacy[]>([]);
  const [rows,setRows]=useState<Ordonnance[]>([]);
  const [pharmacyId,setPharmacyId]=useState("");
  const [note,setNote]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  const loadRows=useCallback(async()=>{
    const {data,error:queryError}=await sb.rpc("naxa_client_mes_ordonnances");
    if(queryError){setError("Le suivi de vos ordonnances est momentanément indisponible.");return;}
    setRows((data??[]) as Ordonnance[]);
    setError("");
  },[sb]);

  useEffect(()=>{
    let stopped=false;
    let channel:ReturnType<typeof sb.channel>|null=null;
    const init=async()=>{
      const {data:auth,error:authError}=await sb.auth.getUser();
      if(stopped)return;
      if(authError||!auth.user){
        router.replace("/connexion?retour=%2Fclient%2Fordonnances");
        return;
      }
      setUserId(auth.user.id);
      const {data:pharmacyRows,error:pharmacyError}=await sb.from("pharmacies")
        .select("id,nom,ville,quartier")
        .eq("actif",true).eq("visible_recherche",true).is("archivee_le",null)
        .or("est_demo.is.null,est_demo.eq.false")
        .order("nom");
      if(stopped)return;
      if(pharmacyError)setError("La liste des pharmacies disponibles ne peut pas être chargée.");
      else setPharmacies((pharmacyRows??[]) as Pharmacy[]);
      await loadRows();
      if(stopped)return;
      channel=sb.channel("client-prescriptions-"+auth.user.id)
        .on("postgres_changes",{event:"*",schema:"public",table:"prescriptions",filter:"client_id=eq."+auth.user.id},()=>{void loadRows()})
        .subscribe();
      setLoading(false);
    };
    void init();
    const poll=window.setInterval(()=>{if(document.visibilityState==="visible")void loadRows()},30000);
    return()=>{
      stopped=true;window.clearInterval(poll);
      if(channel)void sb.removeChannel(channel);
    };
  },[sb,router,loadRows]);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setError("");setMessage("");
    if(!userId){setError("Connexion requise.");return;}
    if(!pharmacyId){setError("Choisissez la pharmacie qui doit recevoir l'ordonnance.");return;}
    if(!file){setError("Joignez votre ordonnance au format PDF, JPEG ou PNG.");return;}
    if(!["application/pdf","image/jpeg","image/png"].includes(file.type)||file.size===0||file.size>10*1024*1024){
      setError("Format refusé ou fichier supérieur à 10 Mo. Utilisez PDF, JPEG ou PNG.");
      return;
    }
    const extension=file.type==="application/pdf"?"pdf":file.type==="image/png"?"png":"jpg";
    const path=userId+"/"+pharmacyId+"/"+crypto.randomUUID()+"."+extension;
    setBusy(true);
    const {error:uploadError}=await sb.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false});
    if(uploadError){setBusy(false);setError("Le document n'a pas pu être transmis de manière sécurisée.");return;}
    const {data,error:submitError}=await sb.rpc("naxa_client_soumettre_ordonnance",{
      p_pharmacie:pharmacyId,p_document_path:path,p_note:note.trim()||null,
    });
    if(submitError){
      await sb.storage.from(BUCKET).remove([path]);
      setBusy(false);setError(submitError.message||"La transmission de l'ordonnance a échoué.");return;
    }
    setFile(null);setNote("");setMessage("Ordonnance transmise à la pharmacie. Vous verrez ici chaque décision du Pharmacien.");
    const input=document.getElementById("naxa-client-ordonnance-file") as HTMLInputElement|null;
    if(input)input.value="";
    await loadRows();setBusy(false);
  }

  async function openDocument(row:Ordonnance){
    const tab=window.open("about:blank","_blank");
    if(tab)tab.opener=null;
    const {data,error:signError}=await sb.storage.from(BUCKET).createSignedUrl(row.document_ref,300);
    if(signError||!data?.signedUrl){
      if(tab)tab.close();
      setError("Le document n'est pas accessible depuis cette session.");
      return;
    }
    if(tab)tab.location.href=data.signedUrl;
    else window.location.assign(data.signedUrl);
  }

  return <main className="min-h-dvh bg-[#F4F8F5] px-4 pb-12 pt-5 text-[#123A28]">
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B3D26] p-4 text-white">
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-100">Espace Client · NAXA</p><h1 className="mt-1 text-2xl font-black">Mes ordonnances</h1><p className="mt-1 text-sm text-emerald-50">Transmission sécurisée et suivi des décisions de la pharmacie.</p></div>
        <Link href="/client" className="rounded-xl border border-white/30 px-4 py-2 text-sm font-bold underline">← Espace Client</Link>
      </header>

      {message&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{message}</p>}
      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-extrabold">Transmettre une ordonnance</h2>
        <p className="mt-1 text-sm text-slate-600">Choisissez la pharmacie destinataire et joignez le document original. L’ordonnance reste privée et n’est accessible qu’à vous, à la pharmacie concernée et aux contrôles Admin autorisés.</p>
        <form onSubmit={submit} className="mt-4 grid gap-3">
          <label className="text-sm font-semibold">Pharmacie destinataire
            <select required value={pharmacyId} onChange={event=>setPharmacyId(event.target.value)} className="mt-1 w-full rounded-xl border p-3">
              <option value="">Choisir une pharmacie</option>
              {pharmacies.map(pharmacy=><option key={pharmacy.id} value={pharmacy.id}>{pharmacy.nom}{pharmacy.quartier?" · "+pharmacy.quartier:""}{pharmacy.ville?" · "+pharmacy.ville:""}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Document original (PDF, JPEG ou PNG · 10 Mo maximum)
            <input id="naxa-client-ordonnance-file" required type="file" accept="application/pdf,image/jpeg,image/png" onChange={event=>setFile(event.target.files?.[0]??null)} className="mt-1 w-full rounded-xl border p-3"/>
          </label>
          <label className="text-sm font-semibold">Information utile au Pharmacien (facultatif)
            <textarea rows={3} maxLength={2000} value={note} onChange={event=>setNote(event.target.value)} className="mt-1 w-full rounded-xl border p-3" placeholder="Précisez le contexte ou une information utile à l'examen du document."/>
          </label>
          <button disabled={busy||loading||pharmacies.length===0} className="min-h-12 rounded-xl bg-[#0B3D26] px-4 py-3 font-extrabold text-white disabled:opacity-50">{busy?"Transmission sécurisée…":"Transmettre à la pharmacie"}</button>
          {pharmacies.length===0&&!loading&&<p className="text-xs text-amber-800">Aucune pharmacie publique disponible n'est actuellement proposée.</p>}
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold">Suivi de mes transmissions</h2><span className="text-sm text-slate-500">{rows.length} dossier(s)</span></div>
        {loading?<p className="rounded-xl border bg-white p-4 text-sm">Chargement de vos ordonnances…</p>
          :rows.length===0?<p className="rounded-xl border border-dashed bg-white p-5 text-sm text-slate-600">Aucune ordonnance transmise pour le moment.</p>
          :rows.map(row=><article key={row.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h3 className="font-bold">{row.pharmacie_nom}</h3><p className="text-xs text-slate-500">{dateLabel(row.created_at)} · Dossier {row.id.slice(0,8).toUpperCase()}</p></div>
              <span className={"rounded-full px-3 py-1 text-xs font-bold "+(row.statut==="validee"?"bg-emerald-100 text-emerald-900":row.statut==="rejetee"?"bg-red-100 text-red-900":row.preparation_statut==="complement_requis"?"bg-amber-100 text-amber-900":"bg-slate-100 text-slate-700")}>{statusLabel(row)}</span>
            </div>
            {row.motif_complement&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><b>Complément demandé :</b> {row.motif_complement}</p>}
            {row.motif_rejet&&<p className="rounded-xl bg-red-50 p-3 text-sm text-red-900"><b>Motif du refus :</b> {row.motif_rejet}</p>}
            <button type="button" onClick={()=>void openDocument(row)} className="min-h-10 rounded-lg border px-3 py-2 text-sm font-bold underline">Ouvrir mon document</button>
          </article>)}
      </section>
      <p className="text-xs leading-5 text-slate-500">NAXA transmet le document à la pharmacie sélectionnée. La décision clinique appartient au Pharmacien habilité de cette pharmacie.</p>
    </div>
  </main>;
}
