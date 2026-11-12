"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function DeliveryReviewForm({reservationId}:{reservationId:string}) {
  const [rating,setRating]=useState(5);
  const [comment,setComment]=useState("");
  const [loading,setLoading]=useState(true);
  const [submitted,setSubmitted]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  useEffect(()=>{
    let active=true;
    void supabaseBrowser().rpc("naxa_client_delivery_review_exists",{p_reservation:reservationId})
      .then(({data,error:rpcError})=>{
        if(!active)return;
        if(rpcError)setError("Impossible de vérifier si un avis a déjà été transmis.");
        else setSubmitted(data===true);
        setLoading(false);
      });
    return()=>{active=false;};
  },[reservationId]);

  async function submit(){
    if(busy||rating<1||rating>5||comment.trim().length>500)return;
    setBusy(true);setError("");setMessage("");
    const {error:rpcError}=await supabaseBrowser().rpc("naxa_client_review_delivery",{
      p_reservation:reservationId,p_rating:rating,p_comment:comment.trim()||null,
    });
    if(rpcError)setError(rpcError.message||"L'avis n'a pas pu être enregistré.");
    else {setSubmitted(true);setMessage("Merci. Votre avis a été transmis à la pharmacie et au réseau NAXA.");}
    setBusy(false);
  }

  if(loading)return <section className="carte"><p className="text-sm text-slate-600">Vérification de votre avis…</p></section>;
  if(submitted)return <section className="carte space-y-2"><h2 className="font-extrabold">Merci pour votre retour</h2><p className="text-sm text-emerald-800">{message||"Votre avis a déjà été enregistré pour cette livraison."}</p></section>;

  return <section className="carte space-y-3">
    <div><h2 className="text-lg font-extrabold">Évaluer votre livraison</h2><p className="text-sm text-slate-600">Votre avis est demandé après confirmation de la réception.</p></div>
    <div role="radiogroup" aria-label="Note de livraison" className="flex flex-wrap gap-2">
      {[1,2,3,4,5].map(value=><button key={value} type="button" aria-pressed={rating===value} onClick={()=>setRating(value)}
        className={rating===value?"h-11 w-11 rounded-xl bg-[#0B3D26] font-black text-white":"h-11 w-11 rounded-xl border font-black text-slate-800"}>{value}</button>)}
    </div>
    <p className="text-xs text-slate-500">1 = très insatisfait · 5 = excellent</p>
    <label className="block text-sm font-semibold">Commentaire (facultatif)
      <textarea value={comment} onChange={event=>setComment(event.target.value)} rows={3} maxLength={500} className="champ mt-1" placeholder="Décrivez votre expérience de livraison"/>
    </label>
    <button type="button" disabled={busy||comment.trim().length>500} onClick={()=>void submit()} className="btn btn-vert w-full">{busy?"Transmission…":"Envoyer mon avis"}</button>
    {message&&<p role="status" className="text-sm text-emerald-800">{message}</p>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
