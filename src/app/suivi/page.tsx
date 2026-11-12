import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { SuiviConnecte } from "@/components/suivi/SuiviConnecte";

export default async function SuiviPage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?next=%2Fsuivi");

  const {data:enabled,error}=await sb.rpc("suivi_is_enabled_user",{p_user_id:auth.user.id});
  if(error||enabled!==true) {
    return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">NAXA · Espace privé</p>
        <h1 className="mt-2 text-2xl font-black">Suivi connecté indisponible</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Cet espace privé n’est pas activé pour votre compte ou le service est temporairement indisponible. L’univers commercial des dispositifs médicaux reste distinct de cet espace de suivi personnel.</p>
        <a href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-4 font-bold text-white">Retour à NAXA</a>
      </section>
    </main>;
  }
  return <SuiviConnecte />;
}
