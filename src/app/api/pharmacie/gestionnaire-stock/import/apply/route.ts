import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ImportLine={
  produit_id:string;
  nom:string;
  quantite:number;
  prix:number|null;
  cout_achat:number|null;
  lot:string|null;
  peremption:string|null;
  emplacement:string|null;
};

export async function POST(request:NextRequest){
  let body:unknown;
  try{body=await request.json();}catch{return NextResponse.json({error:"Corps JSON invalide."},{status:400});}
  const payload=body&&typeof body==="object"?body as Record<string,unknown>:{};
  const pharmacieId=String(payload.pharmacieId??"");
  const raw=Array.isArray(payload.lignes)?payload.lignes:[];
  if(!UUID.test(pharmacieId)||raw.length<1||raw.length>5000)return NextResponse.json({error:"Pharmacie ou nombre de lignes invalide."},{status:400});
  const lines:ImportLine[]=[];
  const errors:string[]=[];
  raw.forEach((entry,index)=>{
    const row=entry&&typeof entry==="object"?entry as Record<string,unknown>:{};
    const produit_id=String(row.produit_id??"");
    const nom=String(row.nom??"").trim().slice(0,250);
    const quantite=Number(row.quantite);
    const prix=row.prix===null||row.prix===undefined||row.prix===""?null:Number(row.prix);
    const cout_achat=row.cout_achat===null||row.cout_achat===undefined||row.cout_achat===""?null:Number(row.cout_achat);
    const lot=String(row.lot??"").trim()||null;
    const peremption=String(row.peremption??"").trim()||null;
    const emplacement=String(row.emplacement??"").trim().slice(0,160)||null;
    if(!UUID.test(produit_id))errors.push("Ligne "+(index+1)+": médicament non rapproché.");
    if(nom.length<2)errors.push("Ligne "+(index+1)+": nom du produit invalide.");
    if(!Number.isSafeInteger(quantite)||quantite<0)errors.push("Ligne "+(index+1)+": quantité invalide.");
    if(prix!==null&&(!Number.isSafeInteger(prix)||prix<0))errors.push("Ligne "+(index+1)+": prix de vente invalide.");
    if(cout_achat!==null&&(!Number.isSafeInteger(cout_achat)||cout_achat<0))errors.push("Ligne "+(index+1)+": coût d’achat invalide.");
    if(Boolean(lot)!==Boolean(peremption))errors.push("Ligne "+(index+1)+": lot et péremption doivent être renseignés ensemble.");
    if(lot&&(!Number.isSafeInteger(quantite)||quantite<=0||!/^\d{4}-\d{2}-\d{2}$/.test(peremption??"")))errors.push("Ligne "+(index+1)+": détails de lot incomplets.");
    lines.push({produit_id,nom,quantite,prix,cout_achat,lot,peremption,emplacement});
  });
  if(errors.length)return NextResponse.json({error:"L’import contient des lignes à corriger.",details:errors.slice(0,40),totalErrors:errors.length},{status:422});

  const sb=supabaseServer();
  const {data:{user},error:authError}=await sb.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Connexion requise."},{status:401});
  const {data:profile,error:profileError}=await sb.from("profiles").select("actif").eq("id",user.id).maybeSingle();
  if(profileError||profile?.actif!==true)return NextResponse.json({error:"Compte inactif."},{status:403});
  const [{data:allowed,error:privilegeError},{data:isAdmin,error:adminError}]=await Promise.all([
    sb.rpc("naxa_has_privilege",{p_privilege:"IMPORT_STOCK",p_pharmacie:pharmacieId,p_scope:"PHARMACIE"}),
    sb.rpc("is_admin")
  ]);
  if(privilegeError||adminError||!(allowed===true||isAdmin===true))return NextResponse.json({error:"Privilège IMPORT_STOCK requis pour cette pharmacie."},{status:403});
  const {data,error}=await sb.rpc("naxa_import_stock_batch",{p_pharmacie:pharmacieId,p_lignes:lines});
  if(error)return NextResponse.json({error:error.message||"Import refusé par les contrôles du stock."},{status:409});
  return NextResponse.json({ok:true,result:data},{status:200,headers:{"Cache-Control":"no-store"}});
}
