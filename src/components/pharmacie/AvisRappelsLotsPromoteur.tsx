"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Notice = { produit_nom: string; numero_lot: string; reference_avis: string | null; motif: string; consigne: string; created_at: string; statut: string };
type Recipient = { id: string; avis_id: string; pharmacie_id: string; accuse_at: string | null; avis_rappels_lots_reseau: Notice | null; pharmacies: { nom: string } | null };

export function AvisRappelsLotsPromoteur() {
 const sb=useMemo(()=>supabaseBrowser(),[]),router=useRouter();
 const [rows,setRows]=useState<Recipient[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const load=useCallback(async()=>{
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)return;
  const {data:p}=await sb.from("profiles").select("role,actif").eq("id",auth.user.id).maybeSingle();
  if(p?.role!=="promoteur"||p.actif!==true)return;
  const {data:links,error:le}=await sb.from("promoteur_pharmacies").select("pharmacie_id").eq("promoteur_id",auth.user.id).eq("actif",true);
  if(le||!links?.length){setRows([]);return;}
  const ids=[...new Set(links.map(x=>x.pharmacie_id))];
  const {data,error:e}=await sb.from("avis_rappels_lots_destinataires").select("id,avis_id,pharmacie_id,accuse_at,avis_rappels_lots_reseau(produit_nom,numero_lot,reference_avis,motif,consigne,created_at,statut),pharmacies(nom)").in("pharmacie_id",ids).order("accuse_at",{ascending:true,nullsFirst:true});
  if(e){setError("Les avis réseau sont momentanément indisponibles.");return;}
  setRows((data??[]) as unknown as Recipient[]);
 },[sb]);
 useEffect(()=>{void load();},[load]);
 async function acknowledge(row:Recipient){
  if(busy||row.accuse_at)return;
  setBusy(true);setError("");
  const {error:e}=await sb.rpc("promoteur_accuser_avis_rappel_lot",{p_destinataire:row.id});
  if(e)setError(e.message||"Accusé de réception refusé.");else await load();
  setBusy(false);
 }
 const pending=rows.filter(r=>!r.accuse_at&&r.avis_rappels_lots_reseau?.statut==="actif");
 if(!rows.length&&!error)return null;
 return <section className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-slate-900">
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-extrabold">Avis de rappel réseau</h2><p className="text-sm text-slate-600">{pending.length} avis actif(s) en attente d’accusé de réception</p></div><button className="btn btn-clair" type="button" disabled={busy} onClick={()=>void load()}>Actualiser</button></div>
  {error&&<p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
  <div className="mt-3 space-y-2">{rows.filter(r=>r.avis_rappels_lots_reseau?.statut==="actif").map(r=>{const n=r.avis_rappels_lots_reseau;if(!n)return null;return <article key={r.id} className="rounded-xl border bg-white p-3"><p className="font-bold">{n.produit_nom} · lot {n.numero_lot}</p><p className="text-sm">{n.motif}</p><p className="text-sm text-slate-600">Consigne : {n.consigne}</p><p className="mt-1 text-xs text-slate-500">{r.pharmacies?.nom??"Pharmacie"} · réf. {n.reference_avis??"—"}</p>{r.accuse_at?<p className="mt-2 text-xs font-bold text-emerald-800">Accusé reçu le {new Date(r.accuse_at).toLocaleString("fr-FR")}</p>:<button className="btn btn-vert mt-2" type="button" disabled={busy} onClick={()=>void acknowledge(r)}>Accuser réception de l’avis</button>}</article>})}</div>
 </section>;
}
