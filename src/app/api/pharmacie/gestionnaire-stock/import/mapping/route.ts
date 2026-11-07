import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = ["name","dci","dosage","form","barcode","price","quantity","batch","expiry","location"] as const;
type Field = typeof FIELDS[number];
type Mapping = Partial<Record<Field, string>>;

function heuristic(headers: string[]): Mapping {
  const aliases: Record<Field,string[]> = {
    name:["nom","designation","produit","libelle","article","medicament","item","product","drug","specialite"],
    dci:["dci","principe actif","substance active","ingredient","generic name","molecule"],
    dosage:["dosage","strength","concentration","teneur"],
    form:["forme","form","presentation","forme galenique"],
    barcode:["code barre","barcode","ean","gtin","cip","sku","code produit","reference produit"],
    price:["prix","pu","pv","pvttc","prix vente","prix de vente","tarif","selling price","unit price"],
    quantity:["quantite","qte","stock","qty","quantity","on hand","available","stock final","existence"],
    batch:["lot","numero lot","batch","batch number","lot number"],
    expiry:["peremption","date peremption","expiration","expiry","expiry date","dlc"],
    location:["emplacement","rayon","etagere","bac","location","shelf","zone"]
  };
  const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const result: Mapping = {};
  const used = new Set<string>();
  for (const field of FIELDS) {
    const match = headers.map(header=>{
      const h=normalize(header);
      const score=aliases[field].reduce((best,alias)=>{
        const a=normalize(alias);
        return Math.max(best,h===a?1:(h.includes(a)||a.includes(h))?0.7:0);
      },0);
      return {header,score};
    }).filter(item=>item.score>=0.7&&!used.has(item.header)).sort((a,b)=>b.score-a.score)[0];
    if(match){result[field]=match.header;used.add(match.header);}
  }
  return result;
}
function parseJson(text:string): unknown {
  const cleaned=text.replace(/^﻿/,"").replace(/^```(?:json)?/i,"").replace(/```$/,"").trim();
  const start=cleaned.indexOf("{"), end=cleaned.lastIndexOf("}");
  return JSON.parse(start>=0&&end>start?cleaned.slice(start,end+1):cleaned);
}
function sanitizeMapping(value:unknown, headers:string[]):Mapping {
  const source=value&&typeof value==="object"?value as Record<string,unknown>:{};
  const allowed=new Set(headers);
  const out:Mapping={};
  for(const field of FIELDS){
    const header=source[field];
    if(typeof header==="string"&&allowed.has(header)&&!Object.values(out).includes(header)) out[field]=header;
  }
  return out;
}
async function authorized(pharmacieId:string){
  const sb=supabaseServer();
  const {data:{user},error}=await sb.auth.getUser();
  if(error||!user)return {error:NextResponse.json({error:"Connexion requise."},{status:401})};
  const {data:profile,error:profileError}=await sb.from("profiles").select("actif").eq("id",user.id).maybeSingle();
  if(profileError||profile?.actif!==true)return {error:NextResponse.json({error:"Compte inactif."},{status:403})};
  const {data:allowed,error:privilegeError}=await sb.rpc("naxa_has_privilege",{
    p_privilege:"IMPORT_STOCK",p_pharmacie:pharmacieId,p_scope:"PHARMACIE"
  });
  const {data:isAdmin}=await sb.rpc("is_admin");
  if(privilegeError||!(allowed===true||isAdmin===true))return {error:NextResponse.json({error:"Privilège IMPORT_STOCK requis pour cette pharmacie."},{status:403})};
  return {sb};
}

export async function POST(request:NextRequest){
  let body:unknown;
  try{body=await request.json();}catch{return NextResponse.json({error:"Corps JSON invalide."},{status:400});}
  const payload=body&&typeof body==="object"?body as Record<string,unknown>:{};
  const pharmacieId=String(payload.pharmacieId??"");
  const headers=Array.isArray(payload.headers)?payload.headers.filter((x):x is string=>typeof x==="string").slice(0,80):[];
  const samples=Array.isArray(payload.samples)?payload.samples.slice(0,6):[];
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pharmacieId)
    ||headers.length<2||headers.some(h=>h.length>120))return NextResponse.json({error:"Pharmacie ou en-têtes invalides."},{status:400});
  const auth=await authorized(pharmacieId);
  if("error" in auth)return auth.error;
  const safeSamples=samples.filter((row):row is Record<string,unknown>=>Boolean(row)&&typeof row==="object"&&!Array.isArray(row))
    .map(row=>Object.fromEntries(headers.map(header=>{
      const value=row[header];
      const text=String(value??"").slice(0,48);
      // Exclure les téléphones, e-mails, identifiants et valeurs longues : l’IA ne reçoit que des exemples de données produit/stock.
      const safe=/@|(?:\+?237)?\s?6\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}|\b\d{12,}\b/i.test(text)?"[valeur masquée]":text;
      return [header,safe];
    })));
  const deterministic=heuristic(headers);
  const geminiKey=process.env.GEMINI_API_KEY??process.env.GOOGLE_GEMINI_API_KEY;
  const groqKey=process.env.GROQ_API_KEY;
  const prompt=[
    "Tu es un expert en migration de données de pharmacies vers un ERP.",
    "Associe chaque champ canonique au nom exact d'une colonne source, ou null si absent.",
    "Champs permis: "+FIELDS.join(", ")+".",
    "name=nom commercial/article; dci=principe actif; dosage=concentration; form=forme galénique; barcode=EAN/CIP/SKU; price=prix de vente FCFA; quantity=stock physique disponible; batch=numéro de lot; expiry=date de péremption; location=rayon/emplacement.",
    "Les en-têtes peuvent être en français, anglais, abréviations ou libellés propres à un logiciel de pharmacie.",
    "Ne jamais confondre prix d'achat et prix de vente, stock théorique et stock physique, code fournisseur et code-barres.",
    "Réponds uniquement en JSON: {mapping:{...},confidence:{...},notes:[...]}.",
    "En-têtes autorisés: "+JSON.stringify(headers),
    "Exemples de lignes: "+JSON.stringify(safeSamples)
  ].join("\n");
  if(geminiKey){
    try{
      const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="+encodeURIComponent(geminiKey),{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0,responseMimeType:"application/json"}}),
        signal:AbortSignal.timeout(9000),cache:"no-store"
      });
      if(response.ok){
        const json=await response.json() as {candidates?:Array<{content?:{parts?:Array<{text?:string}>}}>};
        const text=json.candidates?.[0]?.content?.parts?.map(p=>p.text??"").join("\n")??"";
        const parsed=parseJson(text) as {mapping?:unknown;confidence?:unknown;notes?:unknown};
        const mapping=sanitizeMapping(parsed.mapping,headers);
        return NextResponse.json({mapping,confidence:parsed.confidence??{},notes:Array.isArray(parsed.notes)?parsed.notes.slice(0,8):[],provider:"gemini",fallback:false});
      }
    }catch{/* Le mapping heuristique reste disponible. */}
  }
  if(groqKey){
    try{
      const response=await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+groqKey},
        body:JSON.stringify({model:"llama-3.3-70b-versatile",temperature:0,response_format:{type:"json_object"},messages:[{role:"user",content:prompt}]}),
        signal:AbortSignal.timeout(9000),cache:"no-store"
      });
      if(response.ok){
        const json=await response.json() as {choices?:Array<{message?:{content?:string}}>};
        const parsed=parseJson(json.choices?.[0]?.message?.content??"") as {mapping?:unknown;confidence?:unknown;notes?:unknown};
        const mapping=sanitizeMapping(parsed.mapping,headers);
        return NextResponse.json({mapping,confidence:parsed.confidence??{},notes:Array.isArray(parsed.notes)?parsed.notes.slice(0,8):[],provider:"groq",fallback:false});
      }
    }catch{/* Le mapping heuristique reste disponible. */}
  }
  return NextResponse.json({mapping:deterministic,confidence:{},notes:["Mapping local par synonymes. Aucun fournisseur IA configuré ou joignable; vérifiez les colonnes avant import."],provider:"local",fallback:true});
}
