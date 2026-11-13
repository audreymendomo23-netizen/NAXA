import Link from "next/link";
import { redirect } from "next/navigation";
import { loadPromoteurAccess } from "@/lib/promoteur-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { savePharmacyMerchantPayment } from "./actions";

type Destination = {
  pharmacie_id: string;
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

export default async function PharmacyMerchantPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ ok?: string; erreur?: string }>;
}) {
  const access = await loadPromoteurAccess();
  if (access.profile.role !== "promoteur") redirect("/");
  const pharmacies = (access.pharmacies ?? []).filter((pharmacy) =>
    access.activeLinkIds.has(pharmacy.id) && pharmacy.actif && pharmacy.visible_recherche && pharmacy.archivee_le === null
  );
  const ids = pharmacies.map((pharmacy) => pharmacy.id);
  const { data, error } = ids.length
    ? await supabaseAdmin().from("naxa_merchant_payment_destinations")
        .select("pharmacie_id,canal,merchant_name,merchant_phone,merchant_code,is_active")
        .in("pharmacie_id", ids)
    : { data: [] as Destination[], error: null };
  const params = searchParams ? await searchParams : {};
  const destinations = (data ?? []) as Destination[];

  return (
    <main className="min-h-dvh bg-naxa-green-50 px-4 py-6 text-naxa-green-900">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-3xl bg-naxa-green-900 p-5 text-white sm:p-7">
          <Link href="/pharmacie/promoteur" className="text-sm font-semibold text-white/80 underline">Retour à l’espace Promoteur</Link>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-widest text-white/70">Paiements marchands</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Coordonnées de réception</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">Configurez séparément MTN et Orange pour chaque pharmacie de votre réseau. Le Client verra uniquement les coordonnées actives de la pharmacie qui reçoit son paiement. Le code marchand doit comporter exactement six chiffres.</p>
        </header>

        {params.ok && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Configuration enregistrée et historisée.</p>}
        {params.erreur && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">Configuration invalide ou accès insuffisant. Vérifiez les informations puis réessayez.</p>}
        {error && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">La configuration des coordonnées marchandes n’est pas encore disponible dans la base consultée. Appliquez la migration dédiée avant utilisation.</p>}

        {!pharmacies.length && <p className="rounded-2xl bg-white p-5 text-sm">Aucune pharmacie active de votre réseau n’est disponible pour cette configuration.</p>}

        {pharmacies.map((pharmacy) => (
          <section key={pharmacy.id} className="space-y-4 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-xl font-extrabold">{pharmacy.nom}</h2>
              <p className="text-sm text-slate-500">{[pharmacy.quartier, pharmacy.ville].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {channels.map((channel) => {
                const current = destinations.find((item) => item.pharmacie_id === pharmacy.id && item.canal === channel.value);
                return (
                  <form key={channel.value} action={savePharmacyMerchantPayment} className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    <input type="hidden" name="pharmacie_id" value={pharmacy.id}/>
                    <input type="hidden" name="canal" value={channel.value}/>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-extrabold">{channel.label}</h3>
                      <span className={current?.is_active ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-900" : "rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600"}>{current?.is_active ? "Actif" : "Désactivé"}</span>
                    </div>
                    <label className="block text-sm font-semibold">Nom exact du bénéficiaire
                      <input name="merchant_name" required minLength={2} maxLength={120} defaultValue={current?.merchant_name ?? ""} className="champ mt-1" placeholder="Nom affiché par l’opérateur"/>
                    </label>
                    <label className="block text-sm font-semibold">Téléphone marchand
                      <input name="merchant_phone" required maxLength={32} defaultValue={current?.merchant_phone ?? ""} className="champ mt-1" placeholder="+237 6XX XX XX XX"/>
                    </label>
                    <label className="block text-sm font-semibold">Code marchand (6 chiffres)
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
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
