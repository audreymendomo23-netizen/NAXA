import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { SuiviAccreditationManager, type AccreditationRow } from "@/components/admin/SuiviAccreditationManager";
import Link from "next/link";

export default async function AdminSuiviProfessionnels(){
  const {sb}=await requireAdminActive("/admin/suivi-professionnels");
  const {data,error}=await sb.from("suivi_professionals")
    .select("user_id,professional_role,display_name,registration_number,issuing_authority,specialty,credential_storage_path,verification_status,verified,verified_at,verification_expires_at,created_at")
    .order("created_at",{ascending:false}).limit(500);
  const rows:AccreditationRow[]=await Promise.all((data??[]).map(async row=>{
    let document_url:string|null=null;
    if(row.credential_storage_path){
      const {data:signed}=await sb.storage.from("suivi-accreditations").createSignedUrl(row.credential_storage_path,600);
      document_url=signed?.signedUrl??null;
    }
    return {...row,document_url};
  }));
  return <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
    <Link href="/admin" className="text-sm font-bold text-emerald-800 underline">← Administration NAXA</Link>
    <header><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">Contrôle des accès médicaux</p><h1 className="mt-1 text-2xl font-black">Accréditations des professionnels de santé</h1><p className="mt-2 text-sm text-slate-600">Seuls les dossiers validés par un administrateur NAXA et dont le compte reste actif apparaissent dans l'annuaire de suivi santé.</p></header>
    {error?<p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">Impossible de charger les dossiers d'accréditation. Vérifiez les droits Admin et les migrations.</p>:<SuiviAccreditationManager initialRows={rows}/>}
  </main>;
}
