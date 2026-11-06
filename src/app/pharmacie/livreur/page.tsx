import {redirect} from "next/navigation";
import {supabaseServer} from "@/lib/supabase/server";
import {LivreurWorkspaceClient} from "@/components/pharmacie/LivreurWorkspaceClient";

export const dynamic="force-dynamic";

export default async function LivreurWorkspacePage(){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/livreur");

  const [{data:profile,error:profileError},{data:role,error:roleError},{data:pharmacyId,error:pharmacyError}]=await Promise.all([
    sb.from("profiles").select("actif").eq("id",auth.user.id).maybeSingle(),
    sb.rpc("naxa_business_function"),
    sb.rpc("naxa_active_role_pharmacy"),
  ]);
  if(profileError||roleError||pharmacyError||profile?.actif!==true||role!=="livreur"||typeof pharmacyId!=="string"){
    redirect("/");
  }

  const {data:pharmacy,error:pharmacyError2}=await sb.from("pharmacies")
    .select("id,nom,actif,archivee_le").eq("id",pharmacyId).maybeSingle();
  if(pharmacyError2||!pharmacy?.actif||pharmacy.archivee_le)redirect("/");

  return <LivreurWorkspaceClient pharmacyName={pharmacy.nom}/>;
}
