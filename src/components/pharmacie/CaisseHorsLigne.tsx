"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppareilHorsLigne } from "@/components/pharmacie/AppareilHorsLigne";
import { fcfa } from "@/lib/ranking";
import { enregistrerOperation, listPendingOperations, pendingCount, terminalCount, readReference } from "@/lib/offline-db";

type Produit = { produit_id:string; nom:string; dosage:string|null; prix:number; quantite:number; code_barre:string|null; emplacement:string|null };
type Ligne = Produit & { quantitePanier:number };
type Session = { id:string; caisse_id:string; fond_initial:number; ouvert_at:string; ouvert_par:string; nom?:string };

export function CaisseHorsLigne({ pharmacieId, pharmacyName }: { pharmacieId:string; pharmacyName:string }) {
  const [online,setOnline]=useState(true);
  const [session,setSession]=useState<Session|null>(null);
  const [products,setProducts]=useState<Produit[]>([]);
  const [ready,setReady]=useState(false);
  const [query,setQuery]=useState("");
  const [cart,setCart]=useState<Ligne[]>([]);
  const [cashReceived,setCashReceived]=useState("");
  const [pending,setPending]=useState(0);
  const [terminal,setTerminal]=useState(0);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  const refreshQueue=useCallback(async()=>{
    const values=await Promise.all([pendingCount(),terminalCount()]);
    setPending(values[0]);setTerminal(values[1]);
  },[]);

  const loadSnapshot=useCallback(async()=>{
    try{
      const saved=await readReference();
      const snapshot=saved?.value&&typeof saved.value==="object"?saved.value as Record<string,unknown>:null;
      const pharmacy=snapshot?.pharmacie&&typeof snapshot.pharmacie==="object"?snapshot.pharmacie as Record<string,unknown>:null;
      if(!snapshot||!pharmacy||pharmacy.id!==pharmacieId){
        setSession(null);setProducts([]);setReady(false);
        setMessage("Aucun instantané chiffré correspondant à cette pharmacie. Reconnectez et synchronisez le poste.");
        return;
      }
      const pendingOps=await listPendingOperations();
      const stockRows=Array.isArray(snapshot.stock)?snapshot.stock as Array<Record<string,unknown>>:[];
      const quantities=new Map<string,number>(stockRows.map(row=>[String(row.produit_id??""),Number(row.quantite??0)]));
      for(const operation of pendingOps){
        if(!operation.payload||typeof operation.payload!=="object")continue;
        const payload=operation.payload as Record<string,unknown>;
        if(operation.type==="stock_set_quantity"){
          const id=String(payload.produit_id??"");const q=Number(payload.quantite);
          if(id&&Number.isSafeInteger(q)&&q>=0)quantities.set(id,q);
        }else if(operation.type==="caisse_sale"&&Array.isArray(payload.lignes)){
          for(const raw of payload.lignes){
            if(!raw||typeof raw!=="object")continue;
            const line=raw as Record<string,unknown>;const id=String(line.produit_id??"");const q=Number(line.quantite);
            if(id&&Number.isSafeInteger(q)&&q>0)quantities.set(id,Math.max(0,(quantities.get(id)??0)-q));
          }
        }
      }
      const mapped=stockRows.map(row=>{
        const nested=row.produits&&typeof row.produits==="object"?row.produits as Record<string,unknown>:{};
        const id=String(row.produit_id??"");
        return {
          produit_id:id,nom:String(nested.nom??"Produit"),
          dosage:typeof nested.dosage==="string"?nested.dosage:null,
          prix:Number(row.prix??0),quantite:quantities.get(id)??0,
          code_barre:typeof nested.code_barre==="string"?nested.code_barre:null,
          emplacement:typeof row.emplacement==="string"?row.emplacement:null
        } satisfies Produit;
      }).filter(item=>item.produit_id&&Number.isSafeInteger(item.prix)&&item.prix>=0);
      const rawSession=snapshot.caisse_session&&typeof snapshot.caisse_session==="object"?snapshot.caisse_session as Record<string,unknown>:null;
      setProducts(mapped);
      if(rawSession&&typeof rawSession.id==="string"&&typeof rawSession.caisse_id==="string"){
        setSession({
          id:rawSession.id,caisse_id:rawSession.caisse_id,
          fond_initial:Number(rawSession.fond_initial??0),
          ouvert_at:String(rawSession.ouvert_at??""),
          ouvert_par:String(rawSession.ouvert_par??""),
          nom:typeof rawSession.nom==="string"?rawSession.nom:undefined
        });
        setMessage("Session et catalogue mémorisés. Ventes en espèces uniquement ; confirmation au retour du réseau.");
      }else{
        setSession(null);
        setMessage("Catalogue mémorisé, mais aucune session Caisse unique et ouverte n’est disponible. Les ventes restent bloquées.");
      }
      setReady(true);await refreshQueue();
    }catch{
      setReady(false);setMessage("Impossible de lire l’instantané chiffré. Déverrouillez et synchronisez le poste.");
    }
  },[pharmacieId,refreshQueue]);

  const onUnlocked=useCallback(()=>{void loadSnapshot();},[loadSnapshot]);

  useEffect(()=>{
    setOnline(navigator.onLine);
    const update=()=>setOnline(navigator.onLine);
    window.addEventListener("online",update);window.addEventListener("offline",update);
    return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};
  },[]);

  const visible=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase("fr");
    return products.filter(p=>!needle||p.nom.toLocaleLowerCase("fr").includes(needle)||(p.dosage??"").toLocaleLowerCase("fr").includes(needle)||(p.code_barre??"").toLocaleLowerCase("fr").includes(needle)).slice(0,30);
  },[products,query]);
  const total=useMemo(()=>cart.reduce((sum,line)=>sum+line.prix*line.quantitePanier,0),[cart]);
  const tender=Number(cashReceived);
  const change=Number.isSafeInteger(tender)&&tender>=0?Math.max(0,tender-total):0;

  function add(product:Produit){
    if(!session||!ready)return setMessage("La session Caisse locale n’est pas disponible.");
    setCart(current=>{
      const existing=current.find(line=>line.produit_id===product.produit_id);
      if((existing?.quantitePanier??0)>=product.quantite){setMessage("Quantité supérieure au stock mémorisé.");return current;}
      return existing
        ?current.map(line=>line.produit_id===product.produit_id?{...line,quantitePanier:line.quantitePanier+1}:line)
        :[...current,{...product,quantitePanier:1}];
    });
    setMessage(product.nom+" ajouté au panier local.");
  }

  async function queueSale(){
    if(online)return setMessage("Le réseau est disponible : utilisez le parcours Caisse normal.");
    if(!session||!ready||cart.length===0||busy)return;
    if(terminal>0)return setMessage("Vente bloquée : résolvez d’abord les opérations terminales de la file.");
    const amount=Number(cashReceived);
    if(!Number.isSafeInteger(amount)||amount<=0||amount<total)return setMessage("Le montant espèces reçu doit être entier et couvrir le total.");
    setBusy(true);
    try{
      const lines=cart.map(line=>({produit_id:line.produit_id,quantite:line.quantitePanier,prix_unitaire:line.prix}));
      const id=await enregistrerOperation("caisse_sale",{session_id:session.id,total_attendu:total,montant_percu:amount,lignes:lines});
      setProducts(current=>current.map(product=>{
        const sold=lines.find(line=>line.produit_id===product.produit_id)?.quantite??0;
        return sold?{...product,quantite:Math.max(0,product.quantite-sold)}:product;
      }));
      setCart([]);setCashReceived("");await refreshQueue();
      setMessage("Vente chiffrée localement ("+id.slice(0,8)+"). Elle sera confirmée par le serveur au retour du réseau ; aucun ticket définitif n’est encore émis.");
    }catch(error){
      setMessage(error instanceof Error?error.message:"Mise en file locale impossible. Le panier est conservé.");
    }finally{setBusy(false);}
  }

  return (
    <section className="carte my-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-extrabold">Ventes hors connexion · Caisse</h2><p className="text-xs text-slate-600">File chiffrée · espèces uniquement · confirmation après synchronisation</p></div>
        <span className={online?"rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800":"rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900"}>{online?"En ligne":"Hors ligne"}</span>
      </div>
      <AppareilHorsLigne pharmacyId={pharmacieId} pharmacyName={pharmacyName} onUnlocked={onUnlocked}/>
      {!online&&<>
        {session&&<p className="text-sm text-slate-600">Session mémorisée : {session.nom??"Caisse"} · {session.ouvert_at?new Date(session.ouvert_at).toLocaleString("fr-FR"):"date inconnue"}</p>}
        {ready&&!session&&<p role="alert" className="text-sm text-amber-900">{message}</p>}
        {ready&&session&&<>
          <label className="block text-sm font-semibold">Rechercher dans le catalogue mémorisé<input className="champ mt-1 w-full" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Nom, dosage ou code-barres"/></label>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border p-2">
            {visible.map(product=><button type="button" key={product.produit_id} onClick={()=>add(product)} className="flex w-full items-center justify-between gap-3 rounded-lg p-2 text-left hover:bg-gray-50">
              <span><b>{product.nom}</b>{product.dosage?" · "+product.dosage:""}<span className="block text-xs text-slate-500">Stock mémorisé : {product.quantite}</span></span>
              <span className="whitespace-nowrap text-sm font-bold">{fcfa(product.prix)}</span>
            </button>)}
            {visible.length===0&&<p className="p-2 text-sm text-slate-500">Aucun produit correspondant.</p>}
          </div>
          <div className="space-y-2">
            <h3 className="font-bold">Panier différé ({cart.length} référence(s))</h3>
            {cart.map(line=><div key={line.produit_id} className="flex items-center justify-between gap-2 border-b py-2 text-sm">
              <span>{line.nom} × {line.quantitePanier}</span><span className="font-semibold">{fcfa(line.prix*line.quantitePanier)}</span>
              <button type="button" className="text-red-700 underline" onClick={()=>setCart(current=>current.filter(item=>item.produit_id!==line.produit_id))}>Retirer</button>
            </div>)}
            <div className="flex justify-between text-lg font-extrabold"><span>Total</span><span>{fcfa(total)}</span></div>
            <label className="block text-sm font-semibold">Espèces reçues (FCFA)<input className="champ mt-1 w-full" inputMode="numeric" type="number" min="1" step="1" value={cashReceived} onChange={event=>setCashReceived(event.target.value)}/></label>
            <p className="text-sm">Monnaie à rendre estimée : <b>{fcfa(change)}</b></p>
            <button type="button" className="btn btn-vert w-full" disabled={busy||!cart.length||tender<total||terminal>0} onClick={()=>void queueSale()}>{busy?"Enregistrement…":"Enregistrer la vente hors connexion"}</button>
          </div>
        </>}
        <p className="text-xs text-slate-600">Le prix, le total, la session, le stock et les lots seront revérifiés par le serveur au retour du réseau. Aucun ticket définitif n’est délivré hors connexion.</p>
      </>}
      {online&&<p className="text-xs text-slate-600">Activez ce poste maintenant pour mémoriser le catalogue et l’unique session Caisse ouverte.</p>}
      {message&&<p role="status" aria-live="polite" className="rounded-xl border p-3 text-sm">{message}</p>}
      {(pending>0||terminal>0)&&<p className="text-xs font-semibold text-amber-900">{pending} opération(s) en attente · {terminal} à résoudre</p>}
    </section>
  );
}
