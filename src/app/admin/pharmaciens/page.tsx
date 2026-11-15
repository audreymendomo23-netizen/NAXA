import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { AccreditationsPharmacienManager, type AccreditationPharmacienRow } from "@/components/admin/AccreditationsPharmacienManager";

export default async function AdminAccreditationsPharmacienPage(){
  const {sb}=await requireAdminActive("/admin/pharmaciens");
  const {data,error}=await sb.from("naxa_pharmacien_accreditations")
    .select("id,profile_id,pharmacie_id,proposed_by,registration_number,issuing_authority,specialty,valid_until,status,created_at,review_note,credential_storage_path")
    .order("created_at",{ascending:false}).limit(300);
  if(error){
    return <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <Link href="/admin" className="text-sm font-bold text-emerald-800 underline">← Administration NAXA</Link>
      <h1 className="text-2xl font-black">Agrément des Pharmaciens</h1>
      <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">Impossible de charger la file d'agrément. Vérifiez la migration et les droits Admin.</p>
    </main>;
  }

  const rows=data??[];
  const profileIds=[...new Set(rows.flatMap(row=>[row.profile_id,row.proposed_by]))];
  const pharmacyIds=[...new Set(rows.map(row=>row.pharmacie_id))];
  const [{data:profiles},{data:pharmacies}]=await Promise.all([
    profileIds.length?sb.from("profiles").select("id,username,first_name,last_name").in("id",profileIds):Promise.resolve({data:[]}),
    pharmacyIds.length?sb.from("pharmacies").select("id,nom").in("id",pharmacyIds):Promise.resolve({data:[]}),
  ]);
  const profileMap=new Map((profiles??[]).map(profile=>[profile.id,
    [profile.first_name,profile.last_name].filter(Boolean).join(" ")||profile.username||profile.id
  ]));
  const pharmacyMap=new Map((pharmacies??[]).map(pharmacy=>[pharmacy.id,pharmacy.nom]));
  const mapped:AccreditationPharmacienRow[]=await Promise.all(rows.map(async row=>{
    const {data:signed}=await sb.storage.from("naxa-pharmacien-accreditations")
      .createSignedUrl(row.credential_storage_path,300);
    return {
      id:row.id,profile_id:row.profile_id,pharmacie_id:row.pharmacie_id,
      proposed_by:row.proposed_by,registration_number:row.registration_number,
      issuing_authority:row.issuing_authority,specialty:row.specialty,
      valid_until:row.valid_until,status:row.status,created_at:row.created_at,
      review_note:row.review_note,credential_url:signed?.signedUrl??null,
      pharmacist_label:profileMap.get(row.profile_id)??row.profile_id,
      promoter_label:profileMap.get(row.proposed_by)??row.proposed_by,
      pharmacy_label:pharmacyMap.get(row.pharmacie_id)??row.pharmacie_id,
    };
  }));

  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
    <Link href="/admin" className="text-sm font-bold text-emerald-800 underline">← Administration NAXA</Link>
    <header className="rounded-2xl bg-[#0B3D26] p-5 text-white">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">Contrôle des accès professionnels</p>
      <h1 className="mt-1 text-2xl font-black">Agrément des Pharmaciens</h1>
      <p className="mt-2 text-sm text-emerald-50">Chaque poste Pharmacien doit être proposé par un Promoteur, puis approuvé par l’Administrateur avant toute activation dans une pharmacie.</p>
      <p className="mt-3 text-sm font-bold">{mapped.filter(row=>row.status==="pending_admin").length} proposition(s) en attente · {mapped.filter(row=>row.status==="approved").length} agrément(s) validé(s)</p>
    </header>
    <AccreditationsPharmacienManager initialRows={mapped}/>
  </main>;
}
