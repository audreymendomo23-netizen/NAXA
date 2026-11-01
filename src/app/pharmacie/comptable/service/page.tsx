import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { ComptableSidebar } from "@/components/pharmacie/ComptableSidebar";

export const dynamic = "force-dynamic";

type Session = {
  id: string; pharmacie_id: string; comptable_id: string;
  started_at: string; ended_at: string | null; start_note: string | null; end_note: string | null;
};

async function authorizedContext() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable/service");
  const { data: profile, error } = await sb.from("profiles")
    .select("id,actif,pharmacie_id").eq("id",auth.user.id).maybeSingle();
  if (error || !profile || profile.actif !== true || !profile.pharmacie_id) redirect("/pharmacie");
  const { data: allowed, error: permissionError } = await sb.rpc("compta_scope_autorise", { p_pharmacie: profile.pharmacie_id });
  if (permissionError || allowed !== true) redirect("/pharmacie");
  return { sb, userId:auth.user.id, pharmacyId:profile.pharmacie_id };
}

async function startService(formData: FormData) {
  "use server";
  const { sb } = await authorizedContext();
  const note = String(formData.get("note") ?? "").trim().slice(0,1000);
  const { error } = await sb.rpc("comptable_service_demarrer",{p_note:note || null});
  redirect(error ? "/pharmacie/comptable/service?erreur=ouverture" : "/pharmacie/comptable/service?ok=ouvert");
}

async function endService(formData: FormData) {
  "use server";
  const { sb } = await authorizedContext();
  const sessionId = String(formData.get("session_id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0,1000);
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) redirect("/pharmacie/comptable/service?erreur=session");
  const { error } = await sb.rpc("comptable_service_terminer",{p_session:sessionId,p_note:note || null});
  redirect(error ? "/pharmacie/comptable/service?erreur=fermeture" : "/pharmacie/comptable/service?ok=ferme");
}

export default async function ComptableServicePage({searchParams}:{searchParams?:{ok?:string;erreur?:string}}) {
  const {sb,userId,pharmacyId}=await authorizedContext();
  const [{data:pharmacy},{data:rows,error}] = await Promise.all([
    sb.from("pharmacies").select("nom").eq("id",pharmacyId).maybeSingle(),
    sb.from("comptable_service_sessions")
      .select("id,pharmacie_id,comptable_id,started_at,ended_at,start_note,end_note")
      .eq("comptable_id",userId).eq("pharmacie_id",pharmacyId)
      .order("started_at",{ascending:false}).limit(100),
  ]);
  const sessions=(rows??[]) as Session[];
  const active=sessions.find(s=>!s.ended_at)??null;
  const okMessages:Record<string,string>={ouvert:"Prise de service enregistrée par le serveur.",ferme:"Fin de service enregistrée par le serveur."};
  const errorMessages:Record<string,string>={ouverture:"Ouverture refusée : vérifiez votre affectation, le périmètre et l’absence d’une session ouverte.",fermeture:"Clôture refusée : session introuvable, déjà terminée ou hors périmètre.",session:"Identifiant de session invalide."};
  const date=(v:string)=>new Intl.DateTimeFormat("fr-CM",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v));
  const duration=(start:string,end:string|null)=>{
    const ms=Math.max(0,(end?new Date(end).getTime():Date.now())-new Date(start).getTime());
    const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);
    return h? h+" h "+String(m).padStart(2,"0")+" min":m+" min";
  };
  return <main className="min-h-screen bg-[#F4F8F5] p-4 text-slate-900">
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="rounded-2xl bg-[#0B3D26] p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · Poste Comptable</p>
        <h1 className="mt-1 text-2xl font-black">Prise / fin de service</h1>
        <p className="mt-1 text-sm text-emerald-100">{pharmacy?.nom??"Pharmacie autorisée"} · Pointage personnel horodaté par le serveur.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <ComptableSidebar active="/pharmacie/comptable/service"/>
        <section className="min-w-0 space-y-4">
          {searchParams?.ok && okMessages[searchParams.ok] && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{okMessages[searchParams.ok]}</p>}
          {searchParams?.erreur && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{errorMessages[searchParams.erreur]??"Opération refusée."}</p>}
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">Historique indisponible. Aucune donnée de présence ne peut être confirmée.</p>}
          {!active ? <section className="rounded-2xl border bg-white p-5">
            <h2 className="text-lg font-extrabold">Démarrer mon service</h2>
            <p className="mt-1 text-sm text-slate-600">L’heure de prise de service est générée côté base de données. Une seule session ouverte est autorisée par compte.</p>
            <form action={startService} className="mt-4 space-y-3">
              <label className="block text-sm font-semibold">Note facultative<textarea name="note" maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border p-3" placeholder="Observation de prise de service"/></label>
              <button disabled={!!error} className="min-h-11 rounded-xl bg-[#0B3D26] px-5 font-bold text-white disabled:opacity-50">Prendre mon service</button>
            </form>
          </section> : <section className="rounded-2xl border border-amber-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Service en cours</p>
            <h2 className="mt-1 text-xl font-black">{pharmacy?.nom??"Pharmacie autorisée"}</h2>
            <p className="mt-1 text-sm text-slate-600">Début : {date(active.started_at)} · Durée provisoire : {duration(active.started_at,null)}</p>
            {active.start_note && <p className="mt-2 text-sm text-slate-600">Note : {active.start_note}</p>}
            <form action={endService} className="mt-4 space-y-3">
              <input type="hidden" name="session_id" value={active.id}/>
              <label className="block text-sm font-semibold">Note de fin facultative<textarea name="note" maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border p-3" placeholder="Observation de fin de service"/></label>
              <button className="min-h-11 rounded-xl bg-amber-700 px-5 font-bold text-white">Terminer mon service</button>
            </form>
          </section>}
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="text-lg font-extrabold">Mon historique de service</h2>
            <p className="mt-1 text-sm text-slate-600">Historique personnel limité aux sessions de votre compte et de cette pharmacie. Une session ouverte reste provisoire.</p>
            {sessions.length===0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune session enregistrée.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
              <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="px-3 py-3">Prise</th><th className="px-3 py-3">Fin</th><th className="px-3 py-3">Durée</th><th className="px-3 py-3">État</th></tr></thead>
              <tbody>{sessions.map(s=><tr key={s.id} className="border-b last:border-0"><td className="px-3 py-3">{date(s.started_at)}</td><td className="px-3 py-3">{s.ended_at?date(s.ended_at):"En cours"}</td><td className="px-3 py-3">{duration(s.started_at,s.ended_at)}</td><td className="px-3 py-3"><span className={s.ended_at?"text-emerald-800":"font-bold text-amber-800"}>{s.ended_at?"Clôturé":"Provisoire"}</span></td></tr>)}</tbody>
            </table></div>}
          </section>
        </section>
      </div>
    </div>
  </main>;
}
