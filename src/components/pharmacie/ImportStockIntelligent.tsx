"use client";

import { useMemo, useState } from "react";
import {
  convertirLignesStock,
  detecterLigneEntete,
  scoreRapprochementProduit,
  suggererColonnesStock,
  validerLigneImportStock,
  type StockImportColumnMap,
  type StockImportField,
  type StockImportProduct,
} from "@/lib/importStock";

type Pharmacy = { id: string; nom: string };
type Product = StockImportProduct;
type ParsedSheet = {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
  headerRow: number;
  score: number;
};
type PreviewRow = ReturnType<typeof convertirLignesStock>[number] & {
  sourceSheet: string;
  productId: string;
  score: number;
  errors: string[];
};

const FIELDS: Array<{key:StockImportField;label:string}> = [
  {key:"name",label:"Nom / désignation"},
  {key:"dci",label:"DCI / principe actif"},
  {key:"dosage",label:"Dosage"},
  {key:"form",label:"Forme"},
  {key:"barcode",label:"Code-barres / CIP"},
  {key:"price",label:"Prix de vente FCFA"},
  {key:"quantity",label:"Quantité en stock"},
  {key:"batch",label:"Numéro de lot"},
  {key:"expiry",label:"Péremption"},
  {key:"location",label:"Emplacement"},
];


function readSheets(file:File):Promise<ParsedSheet[]> {
  return new Promise((resolve,reject)=>{
    void (async()=>{
      try{
        const XLSX=await import("xlsx");
        const workbook=XLSX.read(await file.arrayBuffer(),{cellDates:true,raw:true});
        const sheets:ParsedSheet[]=[];
        for(const sheetName of workbook.SheetNames){
          const matrix=XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName],{header:1,defval:"",raw:true,blankrows:false});
          if(!matrix.length)continue;
          let headerIndex=detecterLigneEntete(matrix);
          if(headerIndex<0)headerIndex=matrix.findIndex(row=>row.some(value=>String(value??"").trim().length>0));
          if(headerIndex<0)continue;
          const rawHeaders=matrix[headerIndex]??[];
          const headers:string[]=[];
          const seen=new Map<string,number>();
          rawHeaders.forEach((value,index)=>{
            const base=String(value??"").trim()||"Colonne "+(index+1);
            const count=(seen.get(base)??0)+1;
            seen.set(base,count);
            headers.push(count===1?base:base+" ("+count+")");
          });
          const rows=matrix.slice(headerIndex+1).flatMap(row=>{
            if(!row.some(value=>String(value??"").trim()!==""))return [];
            const record:Record<string,unknown>={};
            headers.forEach((header,index)=>{record[header]=row[index]??"";});
            return [record];
          });
          if(!rows.length)continue;
          const mapping=suggererColonnesStock(headers);
          const score=Object.keys(mapping).length*100+Math.min(rows.length,500)/10;
          sheets.push({name:sheetName,headers,rows,headerRow:headerIndex,score});
        }
        resolve(sheets.sort((a,b)=>b.score-a.score));
      }catch(error){reject(error);}
    })();
  });
}

function topMatches(row:ReturnType<typeof convertirLignesStock>[number],products:Product[]) {
  return products.map(product=>({product,score:scoreRapprochementProduit(row,product)}))
    .filter(item=>item.score>=0.28)
    .sort((a,b)=>b.score-a.score)
    .slice(0,8);
}

export function ImportStockIntelligent({pharmacies,products}:{pharmacies:Pharmacy[];products:Product[]}){
  const [pharmacieId,setPharmacieId]=useState(pharmacies[0]?.id??"");
  const [fileName,setFileName]=useState("");
  const [sheets,setSheets]=useState<ParsedSheet[]>([]);
  const [sheetName,setSheetName]=useState("");
  const [mapping,setMapping]=useState<StockImportColumnMap>({});
  const [provider,setProvider]=useState("");
  const [aiNotes,setAiNotes]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);
  const [importing,setImporting]=useState(false);
  const [confirmSnapshot,setConfirmSnapshot]=useState(false);
  const [overrides,setOverrides]=useState<Record<number,string>>({});
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [result,setResult]=useState<Record<string,unknown>|null>(null);

  const currentSheet=sheets.find(sheet=>sheet.name===sheetName)??sheets[0]??null;
  const converted=useMemo(()=>{
    if(!currentSheet)return [];
    return convertirLignesStock(currentSheet.rows,mapping).map(row=>({...row,sourceRow:row.sourceRow+currentSheet.headerRow+1}));
  },[currentSheet,mapping]);
  const preview=useMemo<PreviewRow[]>(()=>{
    return converted.map(row=>{
      const candidates=topMatches(row,products);
      const best=candidates[0];
      const second=candidates[1];
      const decisive=Boolean(best&&best.score>=0.96&&(!second||best.score-second.score>=0.12));
      const productId=overrides[row.sourceRow]??(decisive?best!.product.id:"");
      const errors=validerLigneImportStock(row);
      if(!productId)errors.push("Produit à rapprocher manuellement");
      if(productId&&!products.some(product=>product.id===productId))errors.push("Produit du catalogue introuvable");
      return {...row,sourceSheet:currentSheet?.name??"",productId,score:best?.score??0,errors};
    });
  },[converted,products,overrides,currentSheet]);
  const goodRows=preview.filter(row=>row.errors.length===0);
  const skippedRows=preview.length-goodRows.length;
  const unmapped= currentSheet?currentSheet.headers.filter(header=>!Object.values(mapping).includes(header)):[];
  const canImport=Boolean(pharmacieId&&goodRows.length&&confirmSnapshot&&!loading&&!importing);

  async function chooseFile(file:File|null){
    setError("");setMessage("");setResult(null);setSheets([]);setOverrides({});setConfirmSnapshot(false);setProvider("");setAiNotes([]);
    if(!file)return;
    if(file.size>20*1024*1024){setError("Fichier trop volumineux : limite de 20 Mo.");return;}
    setLoading(true);setFileName(file.name);
    try{
      const parsed=await readSheets(file);
      if(!parsed.length)throw new Error("Aucune feuille avec en-têtes et lignes n’a été détectée.");
      setSheets(parsed);setSheetName(parsed[0].name);
      const initial=suggererColonnesStock(parsed[0].headers);
      setMapping(initial);
      const response=await fetch("/api/pharmacie/gestionnaire-stock/import/mapping",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({pharmacieId,headers:parsed[0].headers,samples:parsed[0].rows.slice(0,5)})
      });
      if(response.ok){
        const data=await response.json() as {mapping?:StockImportColumnMap;provider?:string;notes?:string[];fallback?:boolean};
        setMapping({...initial,...(data.mapping??{})});setProvider(data.provider??"local");setAiNotes(data.notes??[]);
        setMessage(data.fallback?"Mapping automatique local proposé. Vérifiez les colonnes avant import.":"Les colonnes ont été analysées par "+(data.provider??"l’IA")+". Vérifiez les correspondances proposées.");
      }else{
        setProvider("local");setAiNotes(["Service IA indisponible ou privilège manquant. Le mapping local reste utilisable."]);
        setMessage("Correspondances locales proposées. Vérifiez les colonnes.");
      }
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Lecture du fichier impossible.");
    }finally{setLoading(false);}
  }

  async function changeSheet(name:string){
    const sheet=sheets.find(item=>item.name===name);
    if(!sheet)return;
    setSheetName(name);setOverrides({});
    const initial=suggererColonnesStock(sheet.headers);
    setMapping(initial);setMessage("");setAiNotes([]);
    try{
      const response=await fetch("/api/pharmacie/gestionnaire-stock/import/mapping",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({pharmacieId,headers:sheet.headers,samples:sheet.rows.slice(0,5)})
      });
      if(response.ok){
        const data=await response.json() as {mapping?:StockImportColumnMap;provider?:string;notes?:string[]};
        setMapping({...initial,...(data.mapping??{})});setProvider(data.provider??"local");setAiNotes(data.notes??[]);
      }
    }catch{/* Le mapping local reste disponible. */}
  }

  async function importRows(){
    if(!canImport)return;
    setImporting(true);setError("");setMessage("");setResult(null);
    try{
      const lignes=goodRows.map(row=>({
        produit_id:row.productId,nom:row.name,
        quantite:Math.round(row.quantity??0),
        prix:row.price===null?null:Math.round(row.price),
        lot:row.batch,peremption:row.expiry,emplacement:row.location,
      }));
      const response=await fetch("/api/pharmacie/gestionnaire-stock/import/apply",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({pharmacieId,lignes})
      });
      const data=await response.json() as {ok?:boolean;result?:Record<string,unknown>;error?:string;details?:string[]};
      if(!response.ok)throw new Error([data.error,...(data.details??[])].filter(Boolean).join("\n"));
      setResult(data.result??{});setMessage("Import enregistré. Le stock de chaque référence importée correspond maintenant au fichier source.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Import refusé.");}
    finally{setImporting(false);}
  }

  return (
    <section className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Assistant intelligent de reprise</p>
        <h2 className="mt-1 text-lg font-extrabold text-slate-900">Importer un stock depuis n’importe quel logiciel</h2>
        <p className="mt-1 text-sm text-slate-600">Excel, CSV, TSV ou export compatible XLSX. NAXA détecte la feuille, la ligne d’en-tête, les colonnes et les références du catalogue. Vous validez avant écriture.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Pharmacie cible
          <select value={pharmacieId} onChange={event=>{setPharmacieId(event.target.value);setMessage("");setResult(null);}} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white p-2">
            {pharmacies.map(pharmacy=><option key={pharmacy.id} value={pharmacy.id}>{pharmacy.nom}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Fichier exporté
          <input type="file" accept=".xlsx,.xls,.csv,.tsv,.ods,.txt" onChange={event=>void chooseFile(event.target.files?.[0]??null)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 p-2 text-xs"/>
        </label>
      </div>
      {fileName&&<p className="break-all text-xs text-slate-500">Fichier : {fileName}</p>}
      {loading&&<p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Analyse des feuilles et correspondance intelligente des colonnes…</p>}
      {message&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
      {error&&<pre role="alert" className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</pre>}
      {aiNotes.map((note,index)=><p key={index} className="text-xs text-amber-800">{note}</p>)}
      {currentSheet&&(
        <>
          {sheets.length>1&&<label className="block text-sm font-semibold">Feuille à importer
            <select value={currentSheet.name} onChange={event=>void changeSheet(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border p-2">
              {sheets.map(sheet=><option key={sheet.name} value={sheet.name}>{sheet.name} · {sheet.rows.length} lignes</option>)}
            </select>
          </label>}
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">Correspondance des colonnes</h3>
              <span className="text-xs text-slate-500">Moteur : {provider||"détection locale"} · {Object.keys(mapping).length}/{FIELDS.length} champs associés</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map(field=>(
                <label key={field.key} className="text-xs font-semibold text-slate-700">{field.label}
                  <select value={mapping[field.key]??""} onChange={event=>setMapping(old=>({...old,[field.key]:event.target.value||undefined}))} className="mt-1 min-h-10 w-full rounded-lg border bg-white p-2">
                    <option value="">Non présent / ignorer</option>
                    {currentSheet.headers.map(header=><option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {unmapped.length>0&&<p className="mt-3 text-xs text-slate-500">Autres colonnes détectées mais non utilisées : {unmapped.join(" · ")}</p>}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border p-3"><p className="text-xs text-slate-500">Lignes candidates</p><p className="text-2xl font-black">{preview.length}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-slate-500">Prêtes à importer</p><p className="text-2xl font-black text-emerald-700">{goodRows.length}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-slate-500">À corriger / rapprocher</p><p className="text-2xl font-black text-amber-700">{skippedRows}</p></div>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead className="bg-slate-100"><tr><th className="p-2">Ligne</th><th className="p-2">Produit importé</th><th className="p-2">Produit catalogue NAXA</th><th className="p-2">Qté</th><th className="p-2">Prix FCFA</th><th className="p-2">Lot / péremption</th><th className="p-2">Contrôle</th></tr></thead>
              <tbody>
                {preview.slice(0,100).map(row=>{
                  const candidates=topMatches(row,products);
                  return <tr key={row.sourceRow} className="border-t align-top">
                    <td className="p-2">{row.sourceRow}</td>
                    <td className="max-w-52 p-2"><p className="font-semibold">{row.name||row.barcode||"Sans nom"}</p><p className="text-slate-500">{[row.dci,row.dosage,row.form].filter(Boolean).join(" · ")}</p></td>
                    <td className="min-w-60 p-2">
                      <select value={row.productId} onChange={event=>setOverrides(old=>({...old,[row.sourceRow]:event.target.value}))} className="w-full rounded-lg border p-2">
                        <option value="">À rapprocher</option>
                        {candidates.map(({product,score})=><option key={product.id} value={product.id}>{product.nom} {product.dosage??""} · {Math.round(score*100)}%</option>)}
                        {products.slice(0,40).filter(product=>!candidates.some(item=>item.product.id===product.id)).map(product=><option key={product.id} value={product.id}>{product.nom} {product.dosage??""}</option>)}
                      </select>
                    </td>
                    <td className="p-2 tabular-nums">{row.quantity??"—"}</td>
                    <td className="p-2 tabular-nums">{row.price===null?"Conserver / vérifier":Math.round(row.price).toLocaleString("fr-FR")}</td>
                    <td className="p-2">{row.batch||"—"}<br/>{row.expiry||"—"}</td>
                    <td className="max-w-60 p-2">{row.errors.length?<span className="text-amber-800">{row.errors.join(" · ")}</span>:<span className="font-bold text-emerald-700">Prête</span>}</td>
                  </tr>;
                })}
              </tbody>
            </table>
            {preview.length>100&&<p className="p-2 text-xs text-slate-500">Aperçu limité aux 100 premières lignes ; les {preview.length} lignes candidates sont évaluées avant l’import.</p>}
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <input type="checkbox" checked={confirmSnapshot} onChange={event=>setConfirmSnapshot(event.target.checked)} className="mt-1 h-4 w-4"/>
            <span><strong>Je confirme qu’il s’agit d’un inventaire total.</strong> Les quantités du fichier remplacent les quantités agrégées actuelles pour les références importées ; elles ne sont pas ajoutées aux quantités existantes.</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={!canImport} onClick={()=>void importRows()} className="min-h-11 rounded-xl bg-[#0B3D26] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
              {importing?"Import en cours…":"Importer "+goodRows.length+" références"}
            </button>
            {preview.length>0&&<span className="text-xs text-slate-500">{skippedRows} lignes ne seront pas importées tant qu’elles ne sont pas corrigées.</span>}
          </div>
          {result&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            <p className="font-bold">Import terminé</p>
            <p>{String(result.references_importees??0)} références · {String(result.lignes_lues??0)} lignes · {String(result.lots_importes??0)} lots importés.</p>
            <p className="mt-1 text-xs">Les quantités importées sont un instantané de l’inventaire, pas un mouvement d’addition.</p>
          </div>}
        </>
      )}
    </section>
  );
}
