import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { PartnerIndependentAgreementAdmin } from "@/components/admin/PartnerIndependentAgreementAdmin";

export default async function AdminPartnerIndependentAgreements(){
  const {sb}=await requireAdminActive("/admin/prestations/conventions");
  const [{data:pending,error:pendingError},{data:templates,error:templateError}]=await Promise.all([
    sb.from("partner_independent_agreements").select("id,partner_id,professional_user_id,agreement_version,accepted_at,partners!partner_independent_agreements_partner_id_fkey(name,city),profiles!partner_independent_agreements_professional_user_id_fkey(username,first_name,last_name),template:partner_independent_agreement_templates!partner_independent_agreements_template_id_fkey(version,title,body,sha256)")
      .eq("status","pending_review").order("accepted_at",{ascending:true}).limit(200),
    sb.from("partner_independent_agreement_templates").select("id,version,title,body,sha256")
      .eq("partner_type","professionnel_domicile").eq("status","published").limit(1)
  ]);
  const rows=(pending??[]).map((row:any)=>({
    ...row,partners:Array.isArray(row.partners)?row.partners[0]:row.partners,
    profiles:Array.isArray(row.profiles)?row.profiles[0]:row.profiles,
    template:Array.isArray(row.template)?row.template[0]:row.template
  }));
  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
    <Link href="/admin/prestations" className="text-sm font-bold text-emerald-800 underline">← Administration des Prestations</Link>
    <header><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">NAXA · Contrôle des Partenaires</p><h1 className="mt-1 text-2xl font-black">Conventions indépendantes</h1><p className="mt-2 text-sm leading-6 text-slate-600">Une convention distincte de tout emploi ou affectation. L’accord n’accorde les droits indépendants qu’après acceptation du titulaire et approbation d’un Admin actif.</p></header>
    {(pendingError||templateError)?<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Impossible de charger les conventions. Vérifiez la migration, les droits Admin et le schéma Replay.</p>
    :<PartnerIndependentAgreementAdmin initialPending={rows} template={templates?.[0]??null}/>}
  </main>;
}
