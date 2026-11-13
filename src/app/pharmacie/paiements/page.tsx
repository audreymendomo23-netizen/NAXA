import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { savePharmacyMerchantPayment } from "./actions";

type Destination = {
  canal: "mtn_momo" | "orange_money";
  merchant_name: string;
  merchant_phone: string;
  merchant_code: string;
  is_active: boolean;
};

const channels = [
  { value: "mtn_momo", label: "MTN Mobile Money" },
  { value: "orange_money", label: "Orange Money" },
] as const;

async function loadPharmacyScope() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/paiements");
  const { data: profile } = await sb.from("profiles")
    .select("id,role,pharmacie_id,actif")
    .eq("id", auth.user.id).maybeSingle();
  const { data: businessFunction, error: functionError } = await sb.rpc("naxa_business_function");
  if (
    functionError || !profile || profile.actif !== true ||
    !["pharmacie", "responsable"].includes(profile.role ?? "") ||
    !["pharmacie", "responsable"].includes(businessFunction ?? "") ||
    !profile.pharmacie_id
  ) redirect("/");
  const { data: pharmacy, error } = await sb.from("pharmacies")
    .select("id,nom,ville,quartier,actif")
    .eq("id", profile.pharmacie_id).maybeSingle();
  if (error || !pharmacy || pharmacy.actif !== true) redirect("/");
  return { userId: auth.user.id, pharmacy };
}

export default async function PharmacyMerchantPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ ok?: string; erreur?: string }>;
}) {
  const { pharmacy } = await loadPharmacyScope();
  const { data, error } = await supabaseAdmin().from("naxa_merchant_payment_destinations")
    .select("canal,merchant_name,merchant_phone,merchant_code,is_active")
    .eq("pharmacie_id", pharmacy.id);
  const params = searchParams ? await searchParams : {};
  const destinations = (data ?? []) as Destination[];

  return (
    <main className="min-h-dvh bg-naxa-green-50 px-4 py-6 text-naxa-green-900">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-3xl bg-naxa-green-900 p-5 text-white sm:p-7">
          <Link href="/pharmacie" className="text-sm font-semibold text-white/80 underline">Retour à l’espace pharmacie</Link>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-widest text-white/70">Paiements marchands</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Coordonnées de réception · {pharmacy.nom}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">Configurez séparément les coordonnées MTN et Orange de cette pharmacie. Le Client verra uniquement les coordonnées actives correspondant à l’opérateur choisi.</p>
        </header>

        {params.ok && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Configuration enregistrée et historisée.</p>}
        {params.erreur && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">Configuration invalide ou accès insuffisant. Vérifiez les informations puis réessayez.</p>}
        {error && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">La configuration marchande est indisponible. Vérifiez que la migration dédiée est appliquée.</p>}

        <section className="grid gap-4 lg:grid-cols-2">
          {channels.map((channel) => {
            const current = destinations.find((item) => item.canal === channel.value);
            return (
              <form key={channel.value} action={savePharmacyMerchantPayment} className="space-y-3 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-extrabold">{channel.label}</h2>
                  <span className={current?.is_active ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-900" : "rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600"}>{current?.is_active ? "Actif" : "Désactivé"}</span>
                </div>
                <input type="hidden" name="pharmacie_id" value={pharmacy.id}/>
                <input type="hidden" name="canal" value={channel.value}/>
                <label className="block text-sm font-semibold">Nom exact du bénéficiaire
                  <input name="merchant_name" required minLength={2} maxLength={120} defaultValue={current?.merchant_name ?? ""} className="champ mt-1" placeholder="Nom affiché par l’opérateur"/>
                </label>
                <label className="block text-sm font-semibold">Téléphone marchand
                  <input name="merchant_phone" required maxLength={32} defaultValue={current?.merchant_phone ?? ""} className="champ mt-1" placeholder="+237 6XX XX XX XX"/>
                </label>
                <label className="block text-sm font-semibold">Code marchand (exactement 6 chiffres)
                  <input name="merchant_code" required inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} defaultValue={current?.merchant_code ?? ""} className="champ mt-1 tracking-widest" placeholder="000000"/>
                </label>
                <label className="flex items-center gap-3 text-sm font-semibold">
                  <input name="is_active" type="checkbox" defaultChecked={current?.is_active ?? false} className="h-4 w-4"/>
                  Activer ce moyen de paiement
                </label>
                <button className="min-h-11 w-full rounded-xl bg-naxa-green-900 px-4 font-bold text-white">Enregistrer {channel.label}</button>
              </form>
            );
          })}
        </section>
        <p className="text-xs text-slate-500">Les coordonnées sont privées à cette pharmacie. Elles sont historisées lors de chaque modification et ne sont jamais partagées avec une autre pharmacie.</p>
      </div>
    </main>
  );
}
