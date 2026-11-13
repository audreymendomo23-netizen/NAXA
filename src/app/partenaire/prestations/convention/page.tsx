import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { PartnerIndependentAgreementAcceptance } from "@/components/partenaire/PartnerIndependentAgreementAcceptance";

export default async function PartnerIndependentAgreementPage(){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?next=%2Fpartenaire%2Fprestations%2Fconvention");
  const {data:members,error:memberError}=await sb.from("partner_members")
    .select("partner_id,member_role,partners!inner(id,name,status,partner_type)")
    .eq("user_id",auth.user.id).eq("member_role","owner").eq("partners.status","active").eq("partners.partner_type","professionnel_domicile");
  const partners=(members??[]).filter((row:any)=>row.partners?.partner_type==="professionnel_domicile"&&row.partners?.status==="active");
  const ids=partners.map((row:any)=>row.partner_id);
  const [{data:templates},{data:agreements}]=await Promise.all([
    sb.from("partner_independent_agreement_templates").select("id,version,title,body,sha256")
      .eq("partner_type","professionnel_domicile").eq("status","published").limit(1),
    ids.length?sb.from("partner_independent_agreements").select("partner_id,status,expires_at")
      .eq("professional_user_id",auth.user.id).in("partner_id",ids):Promise.resolve({data:[],error:null})
  ]);
  const template=templates?.[0]??null;
  const statusByPartner=new Map((agreements??[]).map((row:any)=>[
    row.partner_id,
    row.status==="active"&&row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()?"expired":row.status
  ]));
  return <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
    <Link href="/partenaire/prestations" className="text-sm font-bold text-emerald-800 underline">← Espace Prestations et soins à domicile</Link>
    <header><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">NAXA · Partenaire unique</p><h1 className="mt-1 text-2xl font-black">Convention indépendante</h1><p className="mt-2 text-sm leading-6 text-slate-600">Le Suivi connecté et l’univers Prestations et soins à domicile conduisent à la même catégorie de Partenaire. Un agrément médical ou une affectation comme salarié ne remplace jamais une convention autonome acceptée personnellement et validée par NAXA.</p></header>
    {memberError?<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Impossible de vérifier le titulaire de votre Partenaire. Réessayez après reconnexion.</p>
    :!partners.length?<section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-extrabold">Aucun Partenaire indépendant associé à ce compte</h2><p className="mt-2 text-sm leading-6 text-amber-950">Votre éventuelle affectation comme salarié d’une structure ne crée pas un Partenaire personnel. Pour obtenir un statut indépendant, NAXA doit d’abord créer et valider un dossier Partenaire distinct à votre nom. Cette étape ne modifie pas votre relation de travail existante.</p><p className="mt-3 text-sm text-amber-950">Le raccourci depuis Dispositifs connectés mène à cette même procédure ; il ne crée pas une catégorie professionnelle séparée.</p></section>
    :partners.map((row:any)=><PartnerIndependentAgreementAcceptance key={row.partner_id} partnerId={row.partner_id} partnerName={row.partners.name} template={template} existingStatus={statusByPartner.get(row.partner_id)??null}/>)}
    <p className="text-xs leading-5 text-slate-500">Aucune publication indépendante, disponibilité individuelle ou localisation publique n’est activée par la seule validation de l’agrément médical. La convention doit être active dans NAXA.</p>
  </main>;
}
