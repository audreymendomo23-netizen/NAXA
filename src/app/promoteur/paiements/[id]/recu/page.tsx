import { notFound, redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import { ReceiptPrintButton } from "./ReceiptPrintButton";

const money = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
const dt = (s: string | null) => s ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Douala" }).format(new Date(s)) : "—";
const dateTime = (s: string | null) => s ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Douala" }).format(new Date(s)) : "—";

export default async function RecuReglementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/connexion");
  const { data: profile } = await sb.from("profiles").select("role,first_name,last_name,username").eq("id", user.id).maybeSingle();
  if (profile?.role !== "promoteur") notFound();

  const db = supabaseAdmin();
  const { data: r, error } = await db.from("abonnement_promoteur_reglements")
    .select("id,promoteur_id,montant,canal,canal_autre,compte_payeur,reference,paye_le,numero_recu,identifiant_paiement,periode_du,periode_au,confirme_le,statut")
    .eq("id", id).eq("promoteur_id", user.id).maybeSingle();
  if (error || !r || r.statut !== "confirme" || !r.numero_recu || !r.identifiant_paiement) notFound();

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.username || "Promoteur";
  const { data: pharmacyLinks } = await db.from("promoteur_pharmacies").select("pharmacie_id").eq("promoteur_id", user.id);
  const pharmacyIds = [...new Set((pharmacyLinks ?? []).map((link) => link.pharmacie_id).filter(Boolean))];
  const { data: pharmacies } = pharmacyIds.length
    ? await db.from("pharmacies").select("id,nom").in("id", pharmacyIds)
    : { data: [] as { id: string; nom: string }[] };
  const pharmacyNames = (pharmacies ?? []).map((pharmacy) => pharmacy.nom).filter(Boolean);
  const canal = ({
    especes: "Espèces", orange_money: "Orange Money", mtn_momo: "MTN Mobile Money",
    virement: "Virement bancaire", depot_bancaire: "Dépôt bancaire", autre: "Autre",
  } as Record<string, string>)[r.canal] ?? r.canal;

  return <main className="min-h-screen bg-slate-100 p-4 print:bg-white">
    <article className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm print:shadow-none sm:p-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#0F6B3F] pb-5">
        <div className="flex items-center gap-3"><img src="/naxa-logo.png" alt="Logo NAXA" className="h-auto w-36 object-contain"/><div><h1 className="text-2xl font-black">Reçu de paiement</h1><p className="mt-1 text-sm text-slate-500">Abonnement mensuel Promoteur</p></div></div>
        <div className="text-right"><p className="text-xs text-slate-500">N° de reçu</p><p className="font-extrabold">{r.numero_recu}</p><p className="mt-2 text-xs text-slate-500">ID de paiement</p><p className="font-extrabold">{r.identifiant_paiement}</p></div>
      </header>

      <p className="mt-5 text-sm leading-6 text-slate-600">Ce reçu atteste que NAXA a vérifié et confirmé l’encaissement du paiement déclaré ci-dessous. Il est généré à la validation administrative.</p>
      <div className="mt-6 rounded-2xl bg-[#F4F8F5] p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Motif du paiement</p><p className="mt-1 font-extrabold">Renouvellement de l’abonnement mensuel Promoteur NAXA</p><p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Montant encaissé</p><p className="mt-1 text-2xl font-black text-[#0F6B3F]">{money(r.montant)}</p></div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-sm text-slate-500">Promoteur / Payeur</dt><dd className="font-bold">{name}</dd></div>
        <div className="sm:col-span-2"><dt className="text-sm text-slate-500">Pharmacie(s) rattachée(s) au Promoteur</dt><dd className="font-bold">{pharmacyNames.length ? pharmacyNames.join(", ") : "Aucune pharmacie rattachée dans le dossier"}</dd></div>
        <div><dt className="text-sm text-slate-500">Canal de paiement</dt><dd className="font-semibold">{canal}{r.canal_autre ? " · " + r.canal_autre : ""}</dd></div>
        <div><dt className="text-sm text-slate-500">Compte / numéro ayant effectué le paiement</dt><dd className="font-semibold">{r.compte_payeur || "Non renseigné"}</dd></div>
        <div><dt className="text-sm text-slate-500">Référence de transaction</dt><dd className="font-semibold">{r.reference || "Non renseignée"}</dd></div>
        <div><dt className="text-sm text-slate-500">Date de paiement déclarée par le Promoteur</dt><dd className="font-semibold">{dateTime(r.paye_le)}</dd></div>
        <div><dt className="text-sm text-slate-500">Date de validation administrative</dt><dd className="font-semibold">{dateTime(r.confirme_le)}</dd></div>
        <div><dt className="text-sm text-slate-500">Début de la nouvelle période</dt><dd className="font-semibold">{dt(r.periode_du)}</dd></div>
        <div><dt className="text-sm text-slate-500">Prochaine échéance (31 jours après validation)</dt><dd className="font-bold text-[#0F6B3F]">{dt(r.periode_au)}</dd></div>
      </dl>

      <section className="mt-10 border-t pt-5">
        <p className="text-sm text-slate-600">Pour NAXA,</p>
        <img src="/signature-bitseki.svg" alt="Signature de l’administrateur NAXA" className="mt-2 h-16 w-56 object-contain object-left"/>
        <p className="mt-1 font-extrabold">BITSEKI MAYAKA Bienvenu</p>
        <p className="text-sm text-slate-600">Chief Executive Officer</p>
      </section>

      <p className="mt-8 border-t pt-4 text-xs leading-5 text-slate-500">Ce reçu est disponible dans votre espace Promoteur. Vous pouvez l’imprimer ou l’enregistrer au format PDF depuis votre navigateur. Le reçu conserve la date de paiement déclarée ; la période d’abonnement, elle, démarre à la validation administrative.</p>
      <div className="mt-6 flex flex-wrap gap-3 print:hidden"><ReceiptPrintButton/><a href="/promoteur/paiements" className="rounded-full border px-5 py-3 text-sm font-bold">Retour aux paiements</a></div>
    </article>
  </main>;
}
