"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ImportStockIntelligent } from "@/components/pharmacie/ImportStockIntelligent";
import type { StockImportProduct } from "@/lib/importStock";

type Pharmacie = { id: string; nom: string };

export function ImportAdmin({ pharmacies }: { pharmacies: Pharmacie[] }) {
  const [products,setProducts]=useState<StockImportProduct[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    void (async()=>{
      try{
        const sb=supabaseBrowser();
        const {data,error:queryError}=await sb.from("produits")
          .select("id,nom,dci,dosage,forme,code_barre,conditionnement")
          .order("nom",{ascending:true}).limit(5000);
        if(!active)return;
        if(queryError)throw queryError;
        setProducts((data??[]) as StockImportProduct[]);
      }catch{
        if(active)setError("Le catalogue produits n’a pas pu être chargé. L’import reste verrouillé.");
      }finally{
        if(active)setLoading(false);
      }
    })();
    return()=>{active=false;};
  },[]);

  return (
    <section className="space-y-3">
      {loading&&<p role="status" className="text-sm text-slate-500">Chargement du catalogue NAXA…</p>}
      {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!loading&&!error&&<ImportStockIntelligent pharmacies={pharmacies} products={products}/>}
    </section>
  );
}
