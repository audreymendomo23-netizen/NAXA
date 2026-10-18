import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

const labels: Record<string,string> = {
  tension_systolique:"Tension systolique", tension_diastolique:"Tension diastolique",
  frequence_cardiaque:"Fréquence cardiaque", temperature:"Température",
  saturation_oxygene:"Saturation en oxygène", glycemie:"Glycémie", poids:"Poids",
  taille:"Taille", imc:"IMC", frequence_respiratoire:"Fréquence respiratoire",
  cholesterol_total:"Cholestérol total", sommeil_heures:"Durée de sommeil",
  pas_jour:"Nombre de pas", activite_minutes:"Activité", hydratation_ml:"Hydratation",
  douleur_score:"Douleur ressentie", humeur_score:"Humeur ressentie",
  cycle_jour:"Jour du cycle", medicament_pris:"Prise déclarée", symptome_note:"Note personnelle"
};

export default async function SuiviProfessionnelPage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return <main className="min-h-screen bg-[#F8FAFC] p-6"><div className="mx-auto max-w-xl rounded-2xl border bg-white p-6"><h1 className="text-2xl font-black">Espace professionnel</h1><p className="mt-3 text-slate-600">Connectez-vous avec un compte professionnel autorisé pour accéder aux données explicitement partagées.</p><Link href="/connexion?retour=/suivi/professionnel" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#1D4ED8] px-4 font-bold text-white">Connexion</Link></div></main>;
  const [{ data: allowed }, { data: professional }] = await Promise.all([
    sb.rpc("is_suivi_test_account", { p_user_id: auth.user.id }),
    sb.from("suivi_professionals").select("professional_role,display_name,verified").eq("user_id", auth.user.id).maybeSingle()
  ]);
  if (allowed !== true || !professional?.verified) return <main className="min-h-screen bg-[#F8FAFC] p-6"><div className="mx-auto max-w-xl rounded-2xl border border-blue-200 bg-white p-6"><p className="text-sm font-bold uppercase tracking-widest text-[#1D4ED8]">NAXA · Suivi connecté</p><h1 className="mt-2 text-2xl font-black">Accès professionnel non activé</h1><p className="mt-3 leading-6 text-slate-600">Cette page est réservée aux comptes de test autorisés et aux professionnels dont le rôle a été vérifié. Aucune donnée de santé n’a été chargée.</p><Link href="/suivi" className="mt-4 inline-flex min-h-11 items-center rounded-xl border px-4 font-bold">Retour au suivi</Link></div></main>;
  const { data: rows, error } = await sb.from("suivi_measurements").select("id,user_id,measurement_type,value_numeric,value_text,unit,measured_at,source,note").order("measured_at",{ascending:false}).limit(200);
  return <main className="min-h-screen bg-[#F8FAFC] px-4 pb-12 text-slate-900"><div className="mx-auto max-w-5xl pt-5">
    <header className="rounded-2xl bg-[#1D4ED8] p-5 text-white"><p className="text-xs font-extrabold uppercase tracking-widest">NAXA · Espace professionnel de test</p><h1 className="mt-1 text-3xl font-black">{professional.professional_role === "pharmacien" ? "Tableau pharmacien" : "Tableau médecin"}</h1><p className="mt-2 text-sm">Connecté : {professional.display_name}. Seules les mesures dont le propriétaire a autorisé le type sont visibles.</p></header>
    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Confidentialité :</strong> utilisez les informations uniquement dans le cadre autorisé. Cette interface ne fournit ni diagnostic, ni prescription, ni posologie.</div>
    {error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">Les données partagées ne peuvent pas être chargées actuellement.</p> : !rows?.length ? <p className="mt-4 rounded-xl border bg-white p-5 text-sm text-slate-600">Aucune donnée n’a été partagée avec ce compte.</p> : <section className="mt-4 rounded-2xl border bg-white p-5"><h2 className="text-xl font-extrabold">Données partagées</h2><ul className="mt-3 space-y-3">{rows.map((r:any)=><li key={r.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{labels[r.measurement_type]??r.measurement_type}</h3><time className="text-xs text-slate-500">{new Date(r.measured_at).toLocaleString("fr-FR")}</time></div><p className="mt-1 text-sm">{r.value_numeric ?? r.value_text} {r.unit??""}</p><p className="mt-1 break-all font-mono text-xs text-slate-500">Compte propriétaire : {r.user_id}</p>{r.note&&<p className="mt-2 text-sm text-slate-600">{r.note}</p>}</li>)}</ul></section>}
    <Link href="/suivi" className="mt-5 inline-flex min-h-11 items-center rounded-xl border bg-white px-4 font-bold">Retour à mon suivi</Link>
  </div></main>;
}
