import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { saveHomeServiceReminderPreferences } from "../actions";

const offsets = [
  { value: 1440, label: "24 heures avant" },
  { value: 120, label: "2 heures avant" },
  { value: 60, label: "1 heure avant" },
  { value: 30, label: "30 minutes avant" },
  { value: 15, label: "15 minutes avant" },
  { value: 0, label: "À l’heure du rendez-vous" },
];

export default async function HomeServiceReminderSettings({ searchParams }: { searchParams: { ok?: string; erreur?: string } }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/partenaire/prestations/parametres");

  const { data: members, error: membersError } = await sb.from("partner_members")
    .select("partner_id,member_role,partners!inner(id,name,status,partner_type)")
    .eq("user_id", auth.user.id).in("member_role", ["owner", "manager", "operator"]);
  const active = (members ?? []).filter((m: any) =>
    m.partners?.status === "active" && m.partners?.partner_type === "professionnel_domicile"
  );
  if (membersError || !active.length) redirect("/");

  const ids = active.map((m: any) => m.partner_id);
  const { data: preferences, error: preferenceError } = await sb.from("home_service_reminder_preferences")
    .select("partner_id,enabled,offsets_minutes")
    .eq("user_id", auth.user.id).in("partner_id", ids);

  return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-5 pt-5">
      <header className="flex items-center justify-between rounded-2xl bg-[#064B2A] px-4 py-3 text-white">
        <strong>NAXA · Mes préférences</strong>
        <Link href="/partenaire/prestations" className="text-sm font-bold underline">Retour aux rendez-vous</Link>
      </header>
      <section className="rounded-3xl border border-[#CDE8E0] bg-white p-5 sm:p-7">
        <p className="text-xs font-extrabold uppercase tracking-widest text-teal-700">Prestations à domicile</p>
        <h1 className="mt-2 text-2xl font-black">Rappels de rendez-vous</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Choisissez les moments où NAXA doit vous rappeler les rendez-vous confirmés. Ces réglages s’appliquent à votre compte pour chaque établissement auquel vous êtes affecté. Fuseau horaire : Yaoundé (Africa/Douala).</p>
      </section>
      {searchParams.ok && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Vos préférences ont été enregistrées.</p>}
      {searchParams.erreur && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{searchParams.erreur === "delais" ? "Sélectionnez au moins un délai de rappel." : "L’enregistrement des préférences a échoué. Réessayez."}</p>}
      {preferenceError && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">La configuration des rappels nécessite la migration NAXA dédiée. Elle n’est pas encore disponible dans la base consultée.</p>}
      {!preferenceError && active.map((membership: any) => {
        const preference = (preferences ?? []).find((item: any) => item.partner_id === membership.partner_id);
        const selected = preference?.offsets_minutes ?? [1440, 120, 30];
        return <section key={membership.partner_id} className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold">{membership.partners.name}</h2>
          <p className="mt-1 text-xs text-slate-500">Préférences personnelles de votre compte pour cet établissement.</p>
          <form action={saveHomeServiceReminderPreferences} className="mt-4 space-y-4">
            <input type="hidden" name="partner_id" value={membership.partner_id}/>
            <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold">
              <input type="checkbox" name="enabled" defaultChecked={preference?.enabled ?? true} className="h-5 w-5 rounded border-slate-300"/>
              Activer les rappels pour cet établissement
            </label>
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-bold">Me prévenir…</legend>
              {offsets.map((offset) => <label key={offset.value} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                <input type="checkbox" name="offsets_minutes" value={offset.value} defaultChecked={selected.includes(offset.value)} className="h-4 w-4 rounded border-slate-300"/>
                {offset.label}
              </label>)}
            </fieldset>
            <p className="text-xs leading-5 text-slate-500">Le rappel est envoyé dans NAXA et en notification Push sur les appareils où vous avez activé les notifications. Le mode sonore dépend des réglages Android et du navigateur.</p>
            <button className="min-h-11 w-full rounded-xl bg-[#064B2A] px-4 font-bold text-white">Enregistrer mes préférences</button>
          </form>
        </section>;
      })}
    </div>
  </main>;
}
