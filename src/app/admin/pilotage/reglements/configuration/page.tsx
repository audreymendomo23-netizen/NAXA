import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { supabaseAdmin } from "@/lib/supabase/server";
import { enregistrerDestinationPaiement } from "./actions";

const CHANNELS = [
  { canal: "orange_money", label: "Orange Money", placeholder: "Code marchand Orange Money" },
  { canal: "mtn_momo", label: "MTN Mobile Money", placeholder: "Code marchand MTN MoMo" },
] as const;

type Destination = {
  canal: string;
  beneficiaire: string;
  reference_destination: string;
  instructions: string | null;
  actif: boolean;
  updated_at: string;
};

export default async function ConfigurationDestinationsPaiement({
  searchParams,
}: {
  searchParams?: Promise<{ ok?: string; erreur?: string }>;
}) {
  const query = await searchParams;
  await requireAdminActive("/admin/pilotage/reglements/configuration");
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("naxa_payment_destinations")
    .select("canal,beneficiaire,reference_destination,instructions,actif,updated_at");

  const destinations = new Map((data ?? []).map(row => [row.canal, row as Destination]));
  const messages: Record<string, string> = {
    champs: "Vérifiez le bénéficiaire, la destination et les instructions (500 caractères maximum).",
    enregistrement: "La destination n'a pas pu être enregistrée.",
  };

  return (
    <main className="min-h-screen bg-[#F4F8F5] p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-3xl bg-[#0B3D26] p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">NAXA · Administration</p>
          <h1 className="mt-1 text-2xl font-black">Destinations de paiement Promoteur</h1>
          <p className="mt-2 text-sm text-white/80">
            Configurez les coordonnées affichées au Promoteur avant son paiement externe.
            Chaque déclaration conserve un instantané des coordonnées utilisées, même si vous les modifiez ensuite.
          </p>
          <Link href="/admin/pilotage/reglements" className="mt-3 inline-block text-sm font-bold underline">
            Retour aux paiements à vérifier
          </Link>
        </header>

        {query?.ok === "enregistre" && (
          <p role="status" className="rounded-2xl bg-white p-4 text-green-800">
            Destination enregistrée. Les nouvelles déclarations utiliseront ces coordonnées ; les déclarations déjà soumises gardent leur instantané.
          </p>
        )}
        {query?.erreur && (
          <p role="alert" className="rounded-2xl bg-white p-4 text-red-700">
            {messages[query?.erreur ?? ''] ?? "Une erreur est survenue."}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            La configuration n'a pas pu être lue. Aucune destination n'est supposée active.
          </p>
        )}

        <section className="grid gap-4">
          {CHANNELS.map(channel => {
            const current = destinations.get(channel.canal);
            return (
              <article key={channel.canal} className="rounded-3xl bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-extrabold">{channel.label}</h2>
                  <span className={"rounded-full px-3 py-1 text-xs font-bold " + (current?.actif ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700")}>
                    {current?.actif ? "Active" : "Non configurée / inactive"}
                  </span>
                </div>
                <form action={enregistrerDestinationPaiement} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="canal" value={channel.canal} />
                  <label className="grid gap-1 text-sm font-semibold">
                    Nom du bénéficiaire
                    <input
                      name="beneficiaire"
                      required
                      minLength={2}
                      maxLength={160}
                      defaultValue={current?.beneficiaire ?? ""}
                      placeholder="Nom légal du bénéficiaire NAXA"
                      className="min-h-11 rounded-xl border border-slate-300 px-3"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    Code marchand
                    <input
                      name="reference_destination"
                      required
                      minLength={3}
                      maxLength={160}
                      defaultValue={current?.reference_destination ?? ""}
                      placeholder={channel.placeholder}
                      className="min-h-11 rounded-xl border border-slate-300 px-3"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
                    Instructions affichées au Promoteur
                    <textarea
                      name="instructions"
                      maxLength={500}
                      rows={2}
                      defaultValue={current?.instructions ?? ""}
                      placeholder="Ex. indiquez la référence de transaction dans votre déclaration."
                      className="rounded-xl border border-slate-300 p-3 font-normal"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input name="actif" type="checkbox" defaultChecked={current?.actif ?? false} className="h-4 w-4 accent-[#0F6B3F]" />
                    Autoriser ce canal pour les nouvelles déclarations
                  </label>
                  {current?.updated_at && (
                    <p className="text-xs text-slate-500 sm:col-span-2">
                      Dernière modification : {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Douala" }).format(new Date(current.updated_at))}
                    </p>
                  )}
                  <button className="min-h-11 rounded-full bg-[#0F6B3F] px-5 font-bold text-white sm:col-span-2">
                    Enregistrer {channel.label}
                  </button>
                </form>
              </article>
            );
          })}
        </section>
        <p className="text-xs text-slate-500">
          Les coordonnées ne sont pas préremplies. N'activez un canal qu'après avoir vérifié le code marchand réel.
        </p>
      </div>
    </main>
  );
}
