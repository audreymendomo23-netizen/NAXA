import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
export async function GET(_req: Request,{params}:{params:{id:string}}){
  const {data:r}=await supabaseServer().from("reservations").select("total,pharmacie_id,statut").eq("id",params.id).single();
  if(!r||!["en_attente","confirmee"].includes(r.statut)) return NextResponse.json({}, {status:404});
  const {data:priv}=await supabaseAdmin().from("pharmacie_privee").select("code_marchand").eq("pharmacie_id",r.pharmacie_id).single();
  if(!priv?.code_marchand) return NextResponse.json({}, {status:404});
  return NextResponse.json({code_marchand:priv.code_marchand,total:r.total});
}