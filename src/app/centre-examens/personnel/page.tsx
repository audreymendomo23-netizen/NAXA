import { getExamUserContext, requireExamCapability, EXAM_ROLE_LABELS } from "@/lib/examens/access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createExamStaffAccount, revokeExamStaff, setExamActiveRole } from "../actions";
import ExamStaffInvitePanel from "@/components/ExamStaffInvitePanel";

const roles=Object.entries(EXAM_ROLE_LABELS).filter(([key])=>key!=="directeur");

export default async function PersonnelExamensPage({searchParams}:{searchParams:{centre?:string;ok?:string;erreur?:string}}){
  const context=await getExamUserContext();
  const centerId=searchParams.centre||context.activeAssignments[0]?.center_id||"";
  const {sb,user}=await requireExamCapability(centerId,"staff_manage");
  const {data:assignments,error}=await sb.from("exam_staff_assignments")
    .select("id,user_id,role_key,is_active,active_role,assigned_at,revoked_at,note")
    .eq("center_id",centerId).order("assigned_at",{ascending:false});
  const active=(assignments??[]).filter((a:any)=>a.is_active);
  let profiles:any[]=[];
  try{
    const admin=supabaseAdmin();
    const ids=[...new Set(active.map((a:any)=>a.user_id))];
    if(ids.length){const {data}=await admin.from("profiles").select("id,username,first_name,last_name,phone,actif").in("id",ids);profiles=data??[];}
  }catch{}
  const profileById=new Map(profiles.map(p=>[p.id,p]));
  const ownRoles=active.filter((a:any)=>a.user_id===user.id);
  return <div className="space-y-4">
    <header><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Organisation du centre</p><h2 className="mt-1 text-2xl font-black">Personnel et affectations</h2><p className="mt-1 text-sm text-slate-600">Les postes Examens sont autonomes. Ils n’héritent pas des privilèges Pharmacie.</p></header>
    <ExamStaffInvitePanel centerId={centerId} />
    {searchParams.ok&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Modification enregistrée.</p>}
    {searchParams.erreur==="action"&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">Action refusée : vérifiez que le compte Client existe, est actif, confirmé et complet, et qu’il ne possède pas déjà ce poste dans ce centre.</p>}
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Impossible de charger les affectations.</p>}
    {searchParams.erreur==="configuration-email"&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">L’ajout direct est suspendu : la passerelle Google Apps Script ou l’URL publique HTTPS n’est pas configurée dans cet environnement. Utilisez temporairement l’invitation par lien.</p>}
    {searchParams.erreur==="creation-compte"&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">Le compte n’a pas pu être créé. Vérifiez l’adresse ou utilisez l’invitation par lien.</p>}
    {searchParams.ok==="compte-invite"&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Identité Auth créée en attente et e-mail d’activation confirmé par Google. Le collaborateur doit terminer son inscription et accepter son affectation.</p>}
    {searchParams.erreur==="envoi-email"&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Le compte en attente et l’invitation sont conservés, mais l’e-mail n’a pas été confirmé. Retrouvez l’invitation ci-dessous, copiez son lien et transmettez-le manuellement.</p>}
    <section className="rounded-2xl border bg-white p-5"><h3 className="font-extrabold">Ajout direct d’un collaborateur</h3><p className="mt-1 text-sm leading-6 text-slate-600">Saisissez son adresse e-mail. Si son compte Client NAXA est déjà complet, le poste est affecté immédiatement. Sinon, NAXA crée une identité en attente ou reprend son inscription, puis lui envoie un lien sécurisé pour terminer son compte et accepter l’affectation.</p><form action={createExamStaffAccount} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="center_id" value={centerId}/><label className="text-sm font-semibold">Adresse e-mail du collaborateur<input type="email" name="email" required maxLength={254} autoComplete="email" placeholder="collaborateur@exemple.com" className="mt-1 min-h-11 w-full rounded-lg border px-3"/></label><label className="text-sm font-semibold">Poste<select name="role_key" required className="mt-1 min-h-11 w-full rounded-lg border px-3">{roles.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><div className="sm:col-span-2"><button className="min-h-11 rounded-xl bg-blue-900 px-4 font-bold text-white">Ajouter directement</button></div></form><p className="mt-2 text-xs leading-5 text-slate-500">Le collaborateur confirme lui-même son e-mail, ses informations personnelles, sa majorité et son consentement. Aucun mot de passe n’est créé par le responsable.</p></section>
    <section className="rounded-2xl border bg-white p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-extrabold">Membres actifs</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{active.length} affectation(s)</span></div>
      {!active.length?<p className="mt-3 text-sm text-slate-500">Aucun membre supplémentaire n’est affecté.</p>:<div className="mt-3 divide-y">{active.map((a:any)=>{const p=profileById.get(a.user_id);return <article key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-bold">{[p?.first_name,p?.last_name].filter(Boolean).join(" ")||p?.username||"Compte NAXA"}</p><p className="text-sm text-slate-500">{EXAM_ROLE_LABELS[a.role_key as keyof typeof EXAM_ROLE_LABELS]??a.role_key} · {p?.username??a.user_id.slice(0,8)}</p>{a.user_id===user.id&&<p className="mt-1 text-xs font-bold text-blue-800">{a.active_role?"Poste actif":"Poste secondaire"}</p>}</div><div className="flex flex-wrap gap-2">{a.user_id===user.id&&!a.active_role&&<form action={setExamActiveRole}><input type="hidden" name="center_id" value={centerId}/><input type="hidden" name="assignment_id" value={a.id}/><button className="min-h-9 rounded-lg border px-3 text-xs font-bold">Activer mon poste</button></form>}{a.user_id!==user.id&&<form action={revokeExamStaff}><input type="hidden" name="center_id" value={centerId}/><input type="hidden" name="assignment_id" value={a.id}/><button className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700">Retirer</button></form>}</div></article>;})}</div>}
    </section>
    {ownRoles.length>1&&<section className="rounded-2xl border bg-blue-50 p-4"><h3 className="font-bold text-blue-950">Changer de poste actif</h3><div className="mt-2 flex flex-wrap gap-2">{ownRoles.filter((a:any)=>!a.active_role).map((a:any)=><form key={a.id} action={setExamActiveRole}><input type="hidden" name="center_id" value={centerId}/><input type="hidden" name="assignment_id" value={a.id}/><button className="rounded-full border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-900">Activer {EXAM_ROLE_LABELS[a.role_key as keyof typeof EXAM_ROLE_LABELS]}</button></form>)}</div></section>}
  </div>;
}
