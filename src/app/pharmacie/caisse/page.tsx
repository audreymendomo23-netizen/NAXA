"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/ranking";

type Produit={produit_id:string;nom:string;dosage:string|null;prix:number;quantite:number;emplacement:string|null;code_barre:string|null};
type Ligne=Produit&{q:number};

export default function CaissePage(){
  const sb=supabaseBrowser();
  const [pid,setPid]=useState<string|null>(null),[session,setSession]=useState<string|null>(null),[vente,setVente]=useState<string|null>(null);
  const [onglet,setOnglet]=useState<"caisse"|"recherche">("caisse"),[scan,setScan]=useState(""),[recherche,setRecherche]=useState(""),[bulk,setBulk]=useState(""),[resultats,setResultats]=useState<Produit[]>([]),[lignes,setLignes]=useState<Ligne[]>([]);
  const [percu,setPercu]=useState(""),[mode,setMode]=useState<"especes"|"orange_money"|"mtn_momo">("especes"),[reference,setReference]=useState(""),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
  const [pharmacie,setPharmacie]=useState("");
  type TicketRow={vente_id:string;numero_vente:string;pharmacie_id:string;client_id:string|null;statut:string;created_at:string;paid_at:string|null;total_brut:number;remise:number;total_net:number;mode_paiement:string|null;paiement_ref:string|null;produit_id:string|null;produit_nom:string|null;produit_dosage:string|null;quantite:number|null;prix_unitaire:number|null;total_ligne:number|null};
  const [ticketRows,setTicketRows]=useState<TicketRow[]>([]);
  const [printPending,setPrintPending]=useState(false);

  useEffect(()=>{(async()=>{
    const {data:u}=await sb.auth.getUser(); if(!u.user)return setMsg("Connexion requise.");
    const {data:p}=await sb.from("profiles").select("role,fonction_interne,pharmacie_id,actif").eq("id",u.user.id).single();
    if(!p?.pharmacie_id||p.actif===false||(!["caisse","promoteur"].includes(p.role) && !["caisse","pharmacien","pharmacien_assistant"].includes(p.fonction_interne??""))) return setMsg("Accès caisse non autorisé.");
    setPid(p.pharmacie_id);
    const {data:ph}=await sb.from("pharmacies").select("nom").eq("id",p.pharmacie_id).single(); setPharmacie(ph?.nom??"Pharmacie");
    const {data:c}=await sb.from("caisses").select("id").eq("pharmacie_id",p.pharmacie_id).eq("actif",true).limit(1).single();
    if(!c)return setMsg("Aucune caisse configurée.");
    let {data:s}=await sb.from("caisses_sessions").select("id").eq("caisse_id",c.id).eq("statut","ouverte").limit(1).single();
    if(!s){const r=await sb.rpc("caisse_ouvrir",{p_caisse:c.id,p_fond_initial:0}); if(r.error)return setMsg(r.error.message); s={id:r.data};}
    setSession(s.id);
    const v=await sb.rpc("vente_creer",{p_session:s.id}); if(v.error)return setMsg(v.error.message); setVente(v.data);
  })()},[sb]);

  useEffect(()=>{if(!printPending||ticketRows.length===0)return;window.print();setPrintPending(false);setTicketRows([]);(async()=>{if(!session)return;const v=await sb.rpc("vente_creer",{p_session:session});if(v.error)setMsg("Ticket imprimé, mais impossible d'ouvrir la vente suivante : "+v.error.message);else setVente(v.data)})()},[printPending,ticketRows,session,sb]);

  const total=useMemo(()=>lignes.reduce((n,l)=>n+l.prix*l.q,0),[lignes]);
  const rendu=Math.max(Number(percu||0)-total,0);

  async function lookup(code?:string){
    if(!pid)return;
    const q=code?.trim()||recherche.trim(); if(!q)return;
    const {data,error}=await sb.rpc("caisse_rechercher_produit",{p_pharmacie:pid,p_code_barre:code?.trim()||null,p_recherche:code?null:q});
    if(error)return setMsg(error.message);
    setResultats((data??[]) as Produit[]);
  }
  async function lookupBulk(){if(!pid)return;const codes=bulk.split(/\s+/).map(x=>x.trim()).filter(Boolean);if(!codes.length)return setMsg("Saisissez au moins un code-barres.");const {data,error}=await sb.rpc("caisse_rechercher_codes",{p_pharmacie:pid,p_codes:codes});if(error)return setMsg(error.message);setResultats((data??[]) as Produit[]);setMsg((data?.length??0)+" produit(s) trouvé(s).")}
  async function ajouter(p:Produit){
    if(!vente)return;
    const r=await sb.rpc("vente_ajouter_produit",{p_vente:vente,p_produit:p.produit_id,p_quantite:1});
    if(r.error)return setMsg(r.error.message);
    setLignes(x=>{const old=x.find(l=>l.produit_id===p.produit_id);return old?x.map(l=>l.produit_id===p.produit_id?{...l,q:l.q+1}:l):[...x,{...p,q:1}]});
    setScan(""); setMsg(p.nom+" ajouté.");
  }
  async function scanner(e:React.KeyboardEvent<HTMLInputElement>){
    if(e.key!=="Enter")return;
    e.preventDefault(); const code=scan.trim(); if(!code)return;
    const {data,error}=await sb.rpc("caisse_rechercher_produit",{p_pharmacie:pid,p_code_barre:code,p_recherche:null});
    if(error||!data?.length)return setMsg("Code-barres introuvable dans cette pharmacie.");
    await ajouter(data[0] as Produit);
  }
  async function payer(){
    if(!vente||total<=0)return setMsg("Ajoutez au moins un produit.");
    const montant=Number(percu); if(!Number.isFinite(montant)||montant<=0)return setMsg("Indiquez le montant perçu.");
    if(mode!=="especes"&&montant!==total)return setMsg("Le paiement électronique doit être validé pour le montant exact.");
    if(mode==="especes"&&montant<total)return setMsg("Montant perçu insuffisant.");
    if(mode!=="especes"&&!reference.trim())return setMsg("La référence opérateur est obligatoire.");
    setBusy(true);
    try{
      const p=await sb.rpc("vente_encaisser",{p_vente:vente,p_mode:mode,p_montant_percu:montant,p_reference:mode!=="especes"?reference:null});
      if(p.error)throw p.error;
      const f=await sb.rpc("vente_finaliser",{p_vente:vente}); if(f.error)throw f.error;
      const t=await sb.rpc("vente_ticket",{p_vente:vente}); if(t.error)throw t.error;
      if(!Array.isArray(t.data)||t.data.length===0)throw new Error("Vente payée, mais aucun ticket n'a été retourné.");
      setTicketRows(t.data as TicketRow[]);
      setMsg("Paiement validé. Monnaie rendue : "+fcfa(p.data?.[0]?.monnaie_rendue??0)+". Préparation du ticket…");
      setLignes([]);setPercu("");setReference("");setPrintPending(true);
    }catch(e:any){setMsg(e?.message??"Paiement impossible.")}finally{setBusy(false)}
  }

  const ticket=ticketRows[0];
  return <main className="mx-auto max-w-5xl px-4 pb-16">
    <style jsx global>{`
      @media print {
        body * { visibility: hidden !important; }
        #naxa-ticket-print, #naxa-ticket-print * { visibility: visible !important; }
        #naxa-ticket-print { position: absolute; left: 0; top: 0; width: 72mm; margin: 0; padding: 4mm; color: #000; background: #fff; font: 10pt monospace; }
      }
    `}</style>
    {ticket&&<section id="naxa-ticket-print" className="hidden print:block">
      <h1 className="text-center text-base font-bold">{pharmacie}</h1>
      <p className="text-center">Ticket de vente</p>
      <hr className="my-2 border-dashed border-black"/>
      <p>N° : {ticket.numero_vente}</p>
      <p>Date : {new Date(ticket.paid_at??ticket.created_at).toLocaleString("fr-FR")}</p>
      <p>Statut : {ticket.statut}</p>
      <hr className="my-2 border-dashed border-black"/>
      {ticketRows.map((row,index)=><div key={row.produit_id??index} className="mb-2">
        <p>{row.produit_nom??"Produit"} {row.produit_dosage??""}</p>
        <p>{row.quantite??0} × {fcfa(row.prix_unitaire??0)} <span className="float-right">{fcfa(row.total_ligne??0)}</span></p>
      </div>)}
      <hr className="my-2 border-dashed border-black"/>
      <p>Total brut : {fcfa(ticket.total_brut)}</p>
      <p>Remise : {fcfa(ticket.remise)}</p>
      <p className="font-bold">TOTAL PAYÉ : {fcfa(ticket.total_net)}</p>
      <p>Mode : {ticket.mode_paiement??"—"}</p>
      {ticket.paiement_ref&&<p>Référence : {ticket.paiement_ref}</p>}
      <p className="mt-3 text-center">Merci de votre confiance.</p>
    </section>}
    <header className="-mx-4 mb-4 flex items-center justify-between bg-naxa-green-900 px-4 py-3 text-white"><a href="/pharmacie">← Pharmacie</a><b>Caisse · {pharmacie}</b></header>
    <div className="mb-4 flex gap-2"><button className={onglet==="caisse"?"btn btn-vert":"btn btn-clair"} onClick={()=>setOnglet("caisse")}>Encaissement</button><button className={onglet==="recherche"?"btn btn-vert":"btn btn-clair"} onClick={()=>setOnglet("recherche")}>Recherche prix</button></div><div className="grid gap-4 lg:grid-cols-3">
      <section className="carte lg:col-span-2">
        <h1 className="text-xl font-extrabold">{onglet==="caisse"?"Encaissement":"Recherche prix"}</h1>
        <p className="text-sm mb-3">{onglet==="caisse"?"Scannez les codes-barres un par un. Le même champ accepte une succession de scans rapides.":"Recherchez sans créer de vente : nom, référence ou code-barres."}</p>
        {onglet==="caisse"&&<input autoFocus className="champ w-full" placeholder="Scanner le code-barres puis Entrée" value={scan} onChange={e=>setScan(e.target.value)} onKeyDown={scanner}/>}
        <div className="mt-3 flex gap-2"><input className="champ flex-1" placeholder="Recherche prix : nom, référence ou code" value={recherche} onChange={e=>setRecherche(e.target.value)} onKeyDown={e=>e.key==="Enter"&&lookup()}/><button className="btn btn-clair" onClick={()=>lookup()}>Rechercher</button></div>
        {onglet==="recherche"&&<div className="mt-3"><textarea className="champ min-h-24 w-full" placeholder="Recherche bulk : un code-barres par ligne ou séparé par espaces" value={bulk} onChange={e=>setBulk(e.target.value)}/><button className="btn btn-clair mt-2" onClick={lookupBulk}>Rechercher les codes</button></div>}
        {resultats.length>0&&<div className="mt-3 rounded border">{resultats.map(p=>onglet==="caisse"?<button key={p.produit_id} className="block w-full border-b p-3 text-left hover:bg-gray-50" onClick={()=>ajouter(p)}><b>{p.nom}</b> {p.dosage&&<span>{p.dosage}</span>} · {fcfa(p.prix)} · Stock {p.quantite} · {p.emplacement||"Emplacement non renseigné"}</button>:<div key={p.produit_id} className="border-b p-3"><b>{p.nom}</b> {p.dosage&&<span>{p.dosage}</span>} · <strong>{fcfa(p.prix)}</strong> · {p.emplacement||"Emplacement non renseigné"}</div>)}</div>}
        <div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Produit</th><th className="p-2">Qté</th><th className="p-2 text-right">Prix</th><th className="p-2 text-right">Total</th></tr></thead><tbody>{lignes.map(l=><tr key={l.produit_id} className="border-t"><td className="p-2">{l.nom}</td><td className="p-2 text-center">{l.q}</td><td className="p-2 text-right">{fcfa(l.prix)}</td><td className="p-2 text-right">{fcfa(l.prix*l.q)}</td></tr>)}</tbody></table></div>
      </section>
      <aside className="carte space-y-3"><h2 className="text-lg font-bold">À payer</h2><p className="text-3xl font-extrabold">{fcfa(total)}</p>
        <label className="block text-sm font-semibold">Montant perçu<input className="champ mt-1 w-full" inputMode="numeric" type="number" value={percu} onChange={e=>setPercu(e.target.value)}/></label>
        <p className="rounded bg-gray-50 p-3 font-bold">Monnaie à rendre : {fcfa(rendu)}</p>
        <div className="grid grid-cols-2 gap-2"><button className={mode==="especes"?"btn btn-vert":"btn btn-clair"} onClick={()=>setMode("especes")}>💵 Cash</button><button className={mode==="orange_money"?"btn btn-canari":"btn btn-clair"} onClick={()=>setMode("orange_money")}><span aria-hidden="true">Orange Money</span><span className="sr-only">Logo officiel Orange Money</span></button><button className={mode==="mtn_momo"?"btn btn-canari":"btn btn-clair"} onClick={()=>setMode("mtn_momo")}><span aria-hidden="true">MTN MoMo</span><span className="sr-only">Logo officiel MTN MoMo</span></button></div>
        {mode!=="especes"&&<label className="block text-sm font-semibold">Référence opérateur<input className="champ mt-1 w-full" required value={reference} onChange={e=>setReference(e.target.value)} placeholder="Référence reçue après confirmation opérateur"/></label>}
        <button disabled={busy} className="btn btn-vert w-full" onClick={payer}>{busy?"Traitement…":"Valider et imprimer le ticket"}</button>
        {msg&&<p role="status" className="text-sm">{msg}</p>}
        <p className="text-xs text-gray-600">Orange Money et MTN MoMo sont séparés comme canaux de paiement. La référence opérateur est obligatoire. La transaction électronique réelle doit être confirmée par le canal marchand officiel ; NAXA ne simule jamais un paiement.</p>
      </aside>
    </div>
  </main>;
}
