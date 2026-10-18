"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
const safeUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
export async function transitionReservationPartenaire(form: FormData) {
 const sb=supabaseServer(); const {data:auth}=await sb.auth.getUser();
 if(!auth.user) redirect("/connexion?retour=/partenaire/reservations");
 const id=String(form.get("reservation_id")??""); const status=String(form.get("status")??"");
 if(!safeUuid(id)||!["confirmed","ready","picked_up"].includes(status)) redirect("/partenaire/reservations?erreur=transition");
 const {data:members,error:memberError}=await sb.from("partner_members").select("partner_id,member_role,partners!inner(status)").eq("user_id",auth.user.id).in("member_role",["owner","manager","operator"]);
 if(memberError||!members?.length) redirect("/");
 const ids=(members as any[]).filter(m=>m.partners?.status==="active").map(m=>m.partner_id);
 const {data:r}=await sb.from("universe_reservations").select("id,partner_id,status").eq("id",id).maybeSingle();
 if(!r||!ids.includes(r.partner_id)) redirect("/partenaire/reservations?erreur=acces");
 const allowed:Record<string,string[]>={requested:["confirmed"],confirmed:["ready"],ready:["picked_up"]};
 if(!(allowed[r.status]??[]).includes(status)) redirect("/partenaire/reservations?erreur=transition");
 const {error}=await sb.rpc("transition_universe_reservation",{p_reservation_id:id,p_status:status});
 if(error) redirect("/partenaire/reservations?erreur=transition");
 const {data:updated}=await sb.from("universe_reservations").select("status").eq("id",id).maybeSingle();
 if(updated?.status!==status) redirect("/partenaire/reservations?erreur=transition");
 revalidatePath("/partenaire/reservations"); revalidatePath("/partenaire/catalogue"); revalidatePath("/client"); revalidatePath("/univers-reservation/" + id);
 redirect("/partenaire/reservations?ok="+status);
}
